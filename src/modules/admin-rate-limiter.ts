/**
 * Admin API Rate Limiter
 * Lightweight token-bucket and sliding window rate limiting for admin APIs
 * Enforces per-API-key and per-IP limits on canary and exemptions endpoints
 */

import { createLogger } from './logging.js';

const logger = createLogger('admin-rate-limiter');

export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (request: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}

export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}

interface TokenBucket {
    tokens: number;
    lastRefill: number;
}

interface SlidingWindowCounter {
    windowStart: number;
    requestCount: number;
}

export class AdminRateLimiter {
    private readonly tokenBuckets = new Map<string, TokenBucket>();
    private readonly slidingWindows = new Map<string, SlidingWindowCounter>();
    private readonly config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = {
            maxRequests: 100,
            windowMs: 60000, // 1 minute
            skipSuccessfulRequests: false,
            skipFailedRequests: false,
            ...config
        };
    }

    /**
     * Token Bucket Rate Limiting
     * Refills tokens at a constant rate and consumes tokens per request
     */
    private checkTokenBucket(key: string): RateLimitResult {
        const now = Date.now();
        const bucket = this.tokenBuckets.get(key) || {
            tokens: this.config.maxRequests,
            lastRefill: now
        };

        // Calculate tokens to add based on time elapsed
        const timeSinceRefill = now - bucket.lastRefill;
        const tokensToAdd = Math.floor(
            (timeSinceRefill / this.config.windowMs) * this.config.maxRequests
        );

        // Refill tokens (don't exceed max)
        bucket.tokens = Math.min(this.config.maxRequests, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;

        // Check if request can be processed
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            this.tokenBuckets.set(key, bucket);

            return {
                allowed: true,
                limit: this.config.maxRequests,
                remaining: Math.floor(bucket.tokens),
                resetTime: now + this.config.windowMs
            };
        } else {
            // Calculate retry after time
            const retryAfter = Math.ceil(this.config.windowMs * (1 - bucket.tokens / this.config.maxRequests));

            logger.warn('Rate limit exceeded', {
                key,
                limit: this.config.maxRequests,
                remaining: 0,
                retryAfter
            });

            return {
                allowed: false,
                limit: this.config.maxRequests,
                remaining: 0,
                resetTime: now + this.config.windowMs,
                retryAfter
            };
        }
    }

    /**
     * Sliding Window Rate Limiting
     * Tracks requests in a sliding time window
     */
    private checkSlidingWindow(key: string): RateLimitResult {
        const now = Date.now();
        const window = this.slidingWindows.get(key) || {
            windowStart: now,
            requestCount: 0
        };

        // Reset window if expired
        if (now - window.windowStart > this.config.windowMs) {
            window.windowStart = now;
            window.requestCount = 0;
        }

        // Check limit
        if (window.requestCount < this.config.maxRequests) {
            window.requestCount += 1;
            this.slidingWindows.set(key, window);

            return {
                allowed: true,
                limit: this.config.maxRequests,
                remaining: this.config.maxRequests - window.requestCount,
                resetTime: window.windowStart + this.config.windowMs
            };
        } else {
            const retryAfter = Math.ceil((window.windowStart + this.config.windowMs - now) / 1000);

            logger.warn('Sliding window rate limit exceeded', {
                key,
                limit: this.config.maxRequests,
                currentCount: window.requestCount,
                retryAfter
            });

            return {
                allowed: false,
                limit: this.config.maxRequests,
                remaining: 0,
                resetTime: window.windowStart + this.config.windowMs,
                retryAfter
            };
        }
    }

    /**
     * Generate rate limit key based on API key and IP
     */
    private generateKey(request: Request): string {
        if (this.config.keyGenerator) {
            return this.config.keyGenerator(request);
        }

        const apiKey = request.headers.get('X-API-Key') || 'anonymous';
        const ip = request.headers.get('CF-Connecting-IP') ||
                  request.headers.get('X-Forwarded-For')?.split(',')[0] ||
                  request.headers.get('X-Real-IP') ||
                  'unknown';

        // Sanitize inputs to prevent key collision
        const sanitizedKey = apiKey.replace(/[:/]/g, '_').substring(0, 32);
        const sanitizedIp = ip.replace(/[:/]/g, '_').substring(0, 16);

        return `${sanitizedKey}:${sanitizedIp}`;
    }

    /**
     * Check rate limit using token bucket algorithm
     */
    public checkTokenBucket(request: Request): RateLimitResult {
        const key = this.generateKey(request);
        const result = this.checkTokenBucket(key);

        // Log rate limit events for observability
        if (!result.allowed) {
            logger.info('Rate limit event', {
                type: 'token_bucket_exceeded',
                key: this.generateKey(request),
                limit: result.limit,
                retryAfter: result.retryAfter,
                ip: request.headers.get('CF-Connecting-IP') || 'unknown',
                userAgent: request.headers.get('User-Agent')?.substring(0, 100) || 'unknown'
            });
        }

        return result;
    }

    /**
     * Check rate limit using sliding window algorithm
     */
    public checkSlidingWindow(request: Request): RateLimitResult {
        const key = this.generateKey(request);
        const result = this.checkSlidingWindow(key);

        // Log rate limit events for observability
        if (!result.allowed) {
            logger.info('Rate limit event', {
                type: 'sliding_window_exceeded',
                key: this.generateKey(request),
                limit: result.limit,
                retryAfter: result.retryAfter,
                ip: request.headers.get('CF-Connecting-IP') || 'unknown',
                userAgent: request.headers.get('User-Agent')?.substring(0, 100) || 'unknown'
            });
        }

        return result;
    }

    /**
     * Create rate limit response headers
     */
    public createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
        const headers: Record<string, string> = {
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
            'X-RateLimit-Policy': `token-bucket;w=${Math.floor(this.config.windowMs / 1000)};r=${this.config.maxRequests}`
        };

        if (result.retryAfter) {
            headers['Retry-After'] = result.retryAfter.toString();
        }

        return headers;
    }

    /**
     * Create rate limit exceeded response
     */
    public createRateLimitResponse(result: RateLimitResult): Response {
        const headers = this.createRateLimitHeaders(result);

        return new Response(JSON.stringify({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests. Please try again later.',
                retryAfter: result.retryAfter,
                limit: result.limit,
                resetTime: result.resetTime
            },
            metadata: {
                timestamp: new Date().toISOString(),
                endpoint: 'rate_limit',
                service: 'admin_api'
            }
        }), {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        });
    }

    /**
     * Clean up old rate limit data
     */
    public cleanup(): void {
        const now = Date.now();
        const cutoffTime = now - this.config.windowMs * 2; // Keep data for 2 windows

        let cleanedBuckets = 0;
        let cleanedWindows = 0;

        // Clean up token buckets
        for (const [key, bucket] of this.tokenBuckets.entries()) {
            if (bucket.lastRefill < cutoffTime) {
                this.tokenBuckets.delete(key);
                cleanedBuckets++;
            }
        }

        // Clean up sliding windows
        for (const [key, window] of this.slidingWindows.entries()) {
            if (window.windowStart < cutoffTime) {
                this.slidingWindows.delete(key);
                cleanedWindows++;
            }
        }

        if (cleanedBuckets > 0 || cleanedWindows > 0) {
            logger.debug('Rate limiter cleanup completed', {
                cleanedBuckets,
                cleanedWindows,
                remainingBuckets: this.tokenBuckets.size,
                remainingWindows: this.slidingWindows.size
            });
        }
    }

    /**
     * Get rate limit statistics
     */
    public getStats() {
        return {
            tokenBucketsCount: this.tokenBuckets.size,
            slidingWindowsCount: this.slidingWindows.size,
            config: {
                maxRequests: this.config.maxRequests,
                windowMs: this.config.windowMs,
                windowMinutes: Math.floor(this.config.windowMs / 60000)
            }
        };
    }
}

// Pre-configured rate limiters for different admin API endpoints
export const adminApiRateLimits = {
    // Canary APIs - Higher limits for operational flexibility
    canaryManagement: new AdminRateLimiter({
        maxRequests: 50,
        windowMs: 60000 // 50 requests per minute
    }),

    // Exemptions APIs - Moderate limits to prevent abuse
    exemptionsManagement: new AdminRateLimiter({
        maxRequests: 30,
        windowMs: 60000 // 30 requests per minute
    }),

    // High-volume bulk operations - Stricter limits
    bulkOperations: new AdminRateLimiter({
        maxRequests: 10,
        windowMs: 60000 // 10 requests per minute
    }),

    // Schema validation and CI operations - Moderate limits
    ciOperations: new AdminRateLimiter({
        maxRequests: 20,
        windowMs: 60000 // 20 requests per minute
    })
};

/**
 * Rate limiting middleware for admin API routes
 */
export function createRateLimitMiddleware(
    rateLimiter: AdminRateLimiter,
    algorithm: 'token-bucket' | 'sliding-window' = 'token-bucket'
) {
    return (request: Request): Response | null => {
        const result = algorithm === 'token-bucket'
            ? rateLimiter.checkTokenBucket(request)
            : rateLimiter.checkSlidingWindow(request);

        if (!result.allowed) {
            return rateLimiter.createRateLimitResponse(result);
        }

        return null; // Allow request to proceed
    };
}

/**
 * Apply rate limiting to a response with proper headers
 */
export function applyRateLimitHeaders(
    response: Response,
    result: RateLimitResult
): Response {
    const headers = rateLimiter.createRateLimitHeaders(result);

    // Add headers to response
    Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    return response;
}

/**
 * Setup periodic cleanup of rate limit data
 */
export function setupAdminRateLimitCleanup() {
    // Clean up every 5 minutes
    setInterval(() => {
        Object.values(adminApiRateLimits).forEach(limiter => limiter.cleanup());
    }, 5 * 60 * 1000);

    logger.info('Admin rate limiter cleanup scheduled (every 5 minutes)');
}

/**
 * Get all rate limiter statistics for monitoring
 */
export function getAllAdminRateLimitStats() {
    return Object.entries(adminApiRateLimits).map(([name, limiter]) => ({
        name,
        ...limiter.getStats()
    }));
}

export default AdminRateLimiter;