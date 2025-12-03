/**
 * Admin API Rate Limiter
 * Lightweight token-bucket and sliding window rate limiting for admin APIs
 * Enforces per-API-key and per-IP limits on canary and exemptions endpoints
 */
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
export declare class AdminRateLimiter {
    private readonly tokenBuckets;
    private readonly slidingWindows;
    private readonly config;
    constructor(config: RateLimitConfig);
    /**
     * Generate rate limit key based on API key and IP
     */
    private generateKey;
    /**
     * Create rate limit response headers
     */
    createRateLimitHeaders(result: RateLimitResult): Record<string, string>;
    /**
     * Create rate limit exceeded response
     */
    createRateLimitResponse(result: RateLimitResult): Response;
    /**
     * Clean up old rate limit data
     */
    cleanup(): void;
    /**
     * Get rate limit statistics
     */
    getStats(): {
        tokenBucketsCount: number;
        slidingWindowsCount: number;
        config: {
            maxRequests: number;
            windowMs: number;
            windowMinutes: number;
        };
    };
}
export declare const adminApiRateLimits: {
    canaryManagement: AdminRateLimiter;
    exemptionsManagement: AdminRateLimiter;
    bulkOperations: AdminRateLimiter;
    ciOperations: AdminRateLimiter;
};
/**
 * Rate limiting middleware for admin API routes
 */
export declare function createRateLimitMiddleware(rateLimiter: AdminRateLimiter, algorithm?: 'token-bucket' | 'sliding-window'): (request: Request) => Response | null;
/**
 * Apply rate limiting to a response with proper headers
 */
export declare function applyRateLimitHeaders(response: Response, result: RateLimitResult): Response;
/**
 * Setup periodic cleanup of rate limit data
 */
export declare function setupAdminRateLimitCleanup(): void;
/**
 * Get all rate limiter statistics for monitoring
 */
export declare function getAllAdminRateLimitStats(): {
    tokenBucketsCount: number;
    slidingWindowsCount: number;
    config: {
        maxRequests: number;
        windowMs: number;
        windowMinutes: number;
    };
    name: string;
}[];
export default AdminRateLimiter;
//# sourceMappingURL=admin-rate-limiter.d.ts.map