/**
 * API Rate Limiter and Authentication Enhancements
 * Provides comprehensive rate limiting and authentication security for API endpoints
 */
import { createLogger } from './logging.js';
import { createRateLimiter } from './rate-limiter.js';
const logger = createLogger('api-security');
// Default security configuration
const DEFAULT_CONFIG = {
    apiRequestsPerMinute: 60, // 60 requests per minute per API key
    authRequestsPerMinute: 10, // 10 auth attempts per minute per IP
    burstAllowance: 10, // Allow 10 burst requests
    maxFailedAttempts: 5, // 5 failed attempts triggers lockout
    lockoutDurationMs: 15 * 60 * 1000, // 15 minute lockout
    ipRequestsPerMinute: 30, // 30 requests per minute per IP
    suspiciousActivityThreshold: 20 // Trigger alerts at this threshold
};
/**
 * API Security Manager
 */
class APISecurityManager {
    constructor(config = {}) {
        this.apiLimiters = new Map();
        this.ipLimiters = new Map();
        this.failedAttempts = [];
        this.suspiciousIPs = new Map();
        this.lockedOutAPIKeys = new Map();
        this.lockedOutIPs = new Map();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.authLimiter = createRateLimiter(this.config.authRequestsPerMinute, 60000);
        logger.info('API Security Manager initialized', { config: this.config });
    }
    /**
     * Extract client IP from request
     */
    extractClientIP(request) {
        // Try various headers for real IP
        const headers = [
            'CF-Connecting-IP', // Cloudflare
            'X-Forwarded-For', // Standard proxy
            'X-Real-IP', // Nginx
            'X-Client-IP', // Apache
        ];
        for (const header of headers) {
            const ip = request.headers.get(header);
            if (ip) {
                // X-Forwarded-For can contain multiple IPs, take the first one
                return ip.split(',')[0].trim();
            }
        }
        // Fallback (shouldn't happen in production with proper headers)
        return 'unknown';
    }
    /**
     * Extract user agent from request
     */
    extractUserAgent(request) {
        return request.headers.get('User-Agent') || 'unknown';
    }
    /**
     * Extract endpoint from request URL
     */
    extractEndpoint(request) {
        const url = new URL(request.url);
        return url.pathname;
    }
    /**
     * Clean up old records
     */
    cleanup() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        // Clean old failed attempts
        this.failedAttempts = this.failedAttempts.filter(attempt => now - attempt.timestamp < oneHourAgo);
        // Clean old suspicious activity
        for (const [ip, activity] of this.suspiciousIPs.entries()) {
            if (now - activity.lastSeen > oneHourAgo) {
                this.suspiciousIPs.delete(ip);
            }
        }
        // Clean expired lockouts
        for (const [apiKey, lockoutTime] of this.lockedOutAPIKeys.entries()) {
            if (now > lockoutTime) {
                this.lockedOutAPIKeys.delete(apiKey);
                logger.info('API key lockout expired', { apiKey });
            }
        }
        for (const [ip, lockoutTime] of this.lockedOutIPs.entries()) {
            if (now > lockoutTime) {
                this.lockedOutIPs.delete(ip);
                logger.info('IP lockout expired', { ip });
            }
        }
    }
    /**
     * Record failed authentication attempt
     */
    recordFailedAttempt(request, apiKey, reason) {
        this.cleanup();
        const ip = this.extractClientIP(request);
        const userAgent = this.extractUserAgent(request);
        const endpoint = this.extractEndpoint(request);
        const attempt = {
            timestamp: Date.now(),
            ip,
            apiKey,
            userAgent,
            endpoint
        };
        this.failedAttempts.push(attempt);
        // Check for lockout conditions
        const recentFailures = this.failedAttempts.filter(a => a.apiKey === apiKey &&
            Date.now() - a.timestamp < 60000 // Last minute
        );
        if (recentFailures.length >= this.config.maxFailedAttempts) {
            if (apiKey) {
                this.lockedOutAPIKeys.set(apiKey, Date.now() + this.config.lockoutDurationMs);
                logger.warn('API key locked out due to repeated failures', {
                    apiKey,
                    failureCount: recentFailures.length,
                    reason
                });
            }
            this.lockedOutIPs.set(ip, Date.now() + this.config.lockoutDurationMs);
            logger.warn('IP locked out due to repeated failures', {
                ip,
                failureCount: recentFailures.length,
                userAgent,
                reason
            });
        }
        // Track suspicious activity
        this.trackSuspiciousActivity(ip, `failed_auth_${reason || 'unknown'}`);
    }
    /**
     * Track suspicious activity
     */
    trackSuspiciousActivity(ip, activity) {
        if (!this.suspiciousIPs.has(ip)) {
            this.suspiciousIPs.set(ip, {
                ip,
                activityCount: 0,
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                activities: []
            });
        }
        const activityRecord = this.suspiciousIPs.get(ip);
        activityRecord.activityCount++;
        activityRecord.lastSeen = Date.now();
        activityRecord.activities.push(activity);
        // Log suspicious activity
        if (activityRecord.activityCount >= this.config.suspiciousActivityThreshold) {
            logger.warn('Suspicious activity detected', {
                ip,
                activityCount: activityRecord.activityCount,
                activities: activityRecord.activities.slice(-10), // Last 10 activities
                timeWindow: Math.round((Date.now() - activityRecord.firstSeen) / 1000 / 60) // minutes
            });
        }
    }
    /**
     * Check if API key is locked out
     */
    isApiKeyLockedOut(apiKey) {
        const lockoutTime = this.lockedOutAPIKeys.get(apiKey);
        if (!lockoutTime)
            return false;
        if (Date.now() > lockoutTime) {
            this.lockedOutAPIKeys.delete(apiKey);
            return false;
        }
        return true;
    }
    /**
     * Check if IP is locked out
     */
    isIPLockedOut(request) {
        const ip = this.extractClientIP(request);
        const lockoutTime = this.lockedOutIPs.get(ip);
        if (!lockoutTime)
            return false;
        if (Date.now() > lockoutTime) {
            this.lockedOutIPs.delete(ip);
            return false;
        }
        return true;
    }
    /**
     * Check API rate limit
     */
    checkAPIRateLimit(apiKey) {
        // Check if API key is locked out
        if (this.isApiKeyLockedOut(apiKey)) {
            const lockoutTime = this.lockedOutAPIKeys.get(apiKey);
            const retryAfter = Math.ceil((lockoutTime - Date.now()) / 1000);
            return { allowed: false, retryAfter };
        }
        // Get or create rate limiter for this API key
        if (!this.apiLimiters.has(apiKey)) {
            this.apiLimiters.set(apiKey, createRateLimiter(this.config.apiRequestsPerMinute + this.config.burstAllowance, 60000));
        }
        const limiter = this.apiLimiters.get(apiKey);
        if (!limiter.isAllowed()) {
            const retryAfter = Math.ceil(limiter.getRetryAfter() / 1000);
            return { allowed: false, status: limiter.getStatus(), retryAfter };
        }
        return { allowed: true, status: limiter.getStatus() };
    }
    /**
     * Check IP rate limit
     */
    checkIPRateLimit(request) {
        // Check if IP is locked out
        if (this.isIPLockedOut(request)) {
            const ip = this.extractClientIP(request);
            const lockoutTime = this.lockedOutIPs.get(ip);
            const retryAfter = Math.ceil((lockoutTime - Date.now()) / 1000);
            return { allowed: false, retryAfter };
        }
        const ip = this.extractClientIP(request);
        // Get or create rate limiter for this IP
        if (!this.ipLimiters.has(ip)) {
            this.ipLimiters.set(ip, createRateLimiter(this.config.ipRequestsPerMinute, 60000));
        }
        const limiter = this.ipLimiters.get(ip);
        if (!limiter.isAllowed()) {
            const retryAfter = Math.ceil(limiter.getRetryAfter() / 1000);
            return { allowed: false, status: limiter.getStatus(), retryAfter };
        }
        return { allowed: true, status: limiter.getStatus() };
    }
    /**
     * Check authentication rate limit
     */
    checkAuthRateLimit(request) {
        if (!this.authLimiter.isAllowed()) {
            const retryAfter = Math.ceil(this.authLimiter.getRetryAfter() / 1000);
            return { allowed: false, retryAfter };
        }
        return { allowed: true };
    }
    /**
     * Record successful API request
     */
    recordSuccessfulRequest(apiKey, request) {
        const ip = this.extractClientIP(request);
        const endpoint = this.extractEndpoint(request);
        logger.debug('Successful API request', {
            apiKey: apiKey.substring(0, 8) + '...',
            ip,
            endpoint
        });
        // Reset failed attempt count on success
        this.failedAttempts = this.failedAttempts.filter(attempt => !(attempt.apiKey === apiKey && attempt.ip === ip));
    }
    /**
     * Get security status
     */
    getSecurityStatus() {
        this.cleanup();
        return {
            config: this.config,
            activeAPIKeys: this.apiLimiters.size,
            activeIPs: this.ipLimiters.size,
            lockedOutAPIKeys: this.lockedOutAPIKeys.size,
            lockedOutIPs: this.lockedOutIPs.size,
            recentFailedAttempts: this.failedAttempts.length,
            suspiciousIPs: this.suspiciousIPs.size,
            authLimiterStatus: this.authLimiter.getStatus()
        };
    }
    /**
     * Reset security data (for testing/admin)
     */
    reset() {
        this.apiLimiters.clear();
        this.ipLimiters.clear();
        this.failedAttempts = [];
        this.suspiciousIPs.clear();
        this.lockedOutAPIKeys.clear();
        this.lockedOutIPs.clear();
        logger.info('API Security Manager reset');
    }
}
// Global security manager instance
const securityManager = new APISecurityManager();
/**
 * Middleware function for API security checking
 */
export function checkAPISecurity(request, apiKey) {
    // Check IP-based rate limiting first
    const ipCheck = securityManager.checkIPRateLimit(request);
    if (!ipCheck.allowed) {
        return {
            allowed: false,
            reason: 'IP_RATE_LIMIT_EXCEEDED',
            retryAfter: ipCheck.retryAfter
        };
    }
    // Check API key rate limiting if provided
    if (apiKey) {
        const apiCheck = securityManager.checkAPIRateLimit(apiKey);
        if (!apiCheck.allowed) {
            if (securityManager.isApiKeyLockedOut(apiKey)) {
                return {
                    allowed: false,
                    reason: 'API_KEY_LOCKED_OUT',
                    retryAfter: apiCheck.retryAfter
                };
            }
            return {
                allowed: false,
                reason: 'API_RATE_LIMIT_EXCEEDED',
                retryAfter: apiCheck.retryAfter,
                rateLimitStatus: apiCheck.status
            };
        }
    }
    return { allowed: true };
}
/**
 * Record authentication attempt
 */
export function recordAuthAttempt(request, apiKey, success, reason) {
    if (!success && apiKey) {
        securityManager.recordFailedAttempt(request, apiKey, reason);
    }
    else if (success && apiKey) {
        securityManager.recordSuccessfulRequest(apiKey, request);
    }
}
/**
 * Get security status for monitoring
 */
export function getSecurityStatus() {
    return securityManager.getSecurityStatus();
}
/**
 * Reset security data (admin function)
 */
export function resetSecurity() {
    securityManager.reset();
}
export { securityManager };
//# sourceMappingURL=api-security.js.map