/**
 * API Rate Limiter and Authentication Enhancements
 * Provides comprehensive rate limiting and authentication security for API endpoints
 */
import { RateLimiterStatus } from './rate-limiter.js';
interface SecurityConfig {
    apiRequestsPerMinute: number;
    authRequestsPerMinute: number;
    burstAllowance: number;
    maxFailedAttempts: number;
    lockoutDurationMs: number;
    ipRequestsPerMinute: number;
    suspiciousActivityThreshold: number;
}
interface FailedAttempt {
    timestamp: number;
    ip: string;
    apiKey?: string;
    userAgent?: string;
    endpoint?: string;
}
interface SuspiciousActivity {
    ip: string;
    activityCount: number;
    firstSeen: number;
    lastSeen: number;
    activities: string[];
}
/**
 * API Security Manager
 */
declare class APISecurityManager {
    private config;
    private apiLimiters;
    private ipLimiters;
    private authLimiter;
    private failedAttempts;
    private suspiciousIPs;
    private lockedOutAPIKeys;
    private lockedOutIPs;
    constructor(config?: Partial<SecurityConfig>);
    /**
     * Extract client IP from request
     */
    private extractClientIP;
    /**
     * Extract user agent from request
     */
    private extractUserAgent;
    /**
     * Extract endpoint from request URL
     */
    private extractEndpoint;
    /**
     * Clean up old records
     */
    private cleanup;
    /**
     * Record failed authentication attempt
     */
    recordFailedAttempt(request: Request, apiKey?: string, reason?: string): void;
    /**
     * Track suspicious activity
     */
    private trackSuspiciousActivity;
    /**
     * Check if API key is locked out
     */
    isApiKeyLockedOut(apiKey: string): boolean;
    /**
     * Check if IP is locked out
     */
    isIPLockedOut(request: Request): boolean;
    /**
     * Check API rate limit
     */
    checkAPIRateLimit(apiKey: string): {
        allowed: boolean;
        status?: RateLimiterStatus;
        retryAfter?: number;
    };
    /**
     * Check IP rate limit
     */
    checkIPRateLimit(request: Request): {
        allowed: boolean;
        status?: RateLimiterStatus;
        retryAfter?: number;
    };
    /**
     * Check authentication rate limit
     */
    checkAuthRateLimit(request: Request): {
        allowed: boolean;
        retryAfter?: number;
    };
    /**
     * Record successful API request
     */
    recordSuccessfulRequest(apiKey: string, request: Request): void;
    /**
     * Get security status
     */
    getSecurityStatus(): any;
    /**
     * Reset security data (for testing/admin)
     */
    reset(): void;
}
declare const securityManager: APISecurityManager;
/**
 * Middleware function for API security checking
 */
export declare function checkAPISecurity(request: Request, apiKey?: string): {
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
    rateLimitStatus?: RateLimiterStatus;
};
/**
 * Record authentication attempt
 */
export declare function recordAuthAttempt(request: Request, apiKey: string | null, success: boolean, reason?: string): void;
/**
 * Get security status for monitoring
 */
export declare function getSecurityStatus(): any;
/**
 * Reset security data (admin function)
 */
export declare function resetSecurity(): void;
export { securityManager };
export type { SecurityConfig, FailedAttempt, SuspiciousActivity };
//# sourceMappingURL=api-security.d.ts.map