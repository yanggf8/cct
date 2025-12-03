/**
 * Rate Limiter for Yahoo Finance API
 * Ensures we don't exceed API rate limits
 */
interface RateLimiterStatus {
    requestsInWindow: number;
    maxRequests: number;
    windowMs: number;
    remaining: number;
    retryAfter: number;
}
interface BatchRequestResult {
    error?: string;
    url?: string;
    status?: number;
    statusText?: string;
    headers?: Headers;
}
/**
 * Simple rate limiter implementation
 */
declare class RateLimiter {
    private maxRequests;
    private windowMs;
    private requests;
    constructor(maxRequests?: number, windowMs?: number);
    /**
     * Check if request is allowed
     */
    isAllowed(): boolean;
    /**
     * Get time until next request is allowed
     */
    getRetryAfter(): number;
    /**
     * Get current status
     */
    getStatus(): RateLimiterStatus;
}
declare const yahooFinanceRateLimiter: RateLimiter;
declare const fallbackApiRateLimiter: RateLimiter;
export declare function configureYahooRateLimiter(maxRequests: number, windowMs: number): void;
/**
 * Rate-limited fetch for Yahoo Finance API
 */
export declare function rateLimitedFetch(url: string, options?: RequestInit, rateLimiter?: RateLimiter): Promise<Response>;
/**
 * Get Yahoo Finance rate limiter status
 */
export declare function getYahooFinanceRateStatus(): RateLimiterStatus;
/**
 * Reset rate limiter (for testing)
 */
export declare function resetRateLimiter(): void;
/**
 * Batch rate-limited requests with intelligent spacing
 */
export declare function batchRateLimitedRequests(urls: string[], options?: RequestInit): Promise<BatchRequestResult[]>;
/**
 * Smart retry with exponential backoff
 */
export declare function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries?: number, baseDelay?: number): Promise<T>;
/**
 * Create a new rate limiter instance
 */
export declare function createRateLimiter(maxRequests?: number, windowMs?: number): RateLimiter;
export { yahooFinanceRateLimiter, fallbackApiRateLimiter };
export type { RateLimiterStatus, BatchRequestResult };
//# sourceMappingURL=rate-limiter.d.ts.map