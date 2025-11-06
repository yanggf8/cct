/**
 * Rate Limiter for Yahoo Finance API
 * Ensures we don't exceed API rate limits
 */

import { createLogger } from './logging.js';

const logger = createLogger('rate-limiter');

// Type definitions
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
class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private requests: number[];

  constructor(maxRequests: number = 20, windowMs: number = 60000) { // 20 requests per minute by default
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  /**
   * Check if request is allowed
   */
  isAllowed(): boolean {
    const now = Date.now();

    // Remove old requests outside the window
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);

    // Check if we're under the limit
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }

    return false;
  }

  /**
   * Get time until next request is allowed
   */
  getRetryAfter(): number {
    if (this.requests.length === 0) return 0;

    const oldestRequest = Math.min(...this.requests);
    const retryAfter = this.windowMs - (Date.now() - oldestRequest);

    return Math.max(0, retryAfter);
  }

  /**
   * Get current status
   */
  getStatus(): RateLimiterStatus {
    const now = Date.now();
    const activeRequests = this.requests.filter(timestamp => now - timestamp < this.windowMs);

    return {
      requestsInWindow: activeRequests.length,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      remaining: this.maxRequests - activeRequests.length,
      retryAfter: this.getRetryAfter()
    };
  }
}

// Global rate limiters for different APIs
const yahooFinanceRateLimiter = new RateLimiter(20, 60000); // 20 requests per minute
const fallbackApiRateLimiter = new RateLimiter(10, 60000); // 10 requests per minute for fallback

export function configureYahooRateLimiter(maxRequests: number, windowMs: number): void {
  if (typeof maxRequests === 'number' && maxRequests > 0) {
    (yahooFinanceRateLimiter as any).maxRequests = maxRequests;
  }
  if (typeof windowMs === 'number' && windowMs > 0) {
    (yahooFinanceRateLimiter as any).windowMs = windowMs;
  }
}

/**
 * Rate-limited fetch for Yahoo Finance API
 */
export async function rateLimitedFetch(
  url: string,
  options: RequestInit = {},
  rateLimiter: RateLimiter = yahooFinanceRateLimiter
): Promise<Response> {
  const status = rateLimiter.getStatus();

  if (!rateLimiter.isAllowed()) {
    const retryAfter = rateLimiter.getRetryAfter();
    logger.warn('Rate limit exceeded', {
      url,
      retryAfter,
      status
    });

    throw new Error(`Rate limit exceeded. Retry after ${Math.ceil(retryAfter / 1000)} seconds`);
  }

  logger.debug('Making rate-limited request', {
    url,
    remaining: status.remaining,
    requestsInWindow: status.requestsInWindow
  });

  // Add delay between requests to be more respectful
  if (status.requestsInWindow > 5) {
    const delay = Math.min(1000, status.requestsInWindow * 100); // Up to 1 second delay
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)',
        ...options.headers
      }
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      throw new Error(`API rate limit exceeded. Retry after ${retryAfter} seconds`);
    }

    return response;

  } catch (error: any) {
    if (error.name === 'AbortError') {
      logger.warn('Request timeout', { url });
      throw new Error('Request timeout - Yahoo Finance API did not respond');
    }
    throw error;
  }
}

/**
 * Get Yahoo Finance rate limiter status
 */
export function getYahooFinanceRateStatus(): RateLimiterStatus {
  return yahooFinanceRateLimiter.getStatus();
}

/**
 * Reset rate limiter (for testing)
 */
export function resetRateLimiter(): void {
  (yahooFinanceRateLimiter as any).requests = [];
  (fallbackApiRateLimiter as any).requests = [];
}

/**
 * Batch rate-limited requests with intelligent spacing
 */
export async function batchRateLimitedRequests(
  urls: string[],
  options: RequestInit = {}
): Promise<BatchRequestResult[]> {
  const results: BatchRequestResult[] = [];
  const batchSize = 3; // Process 3 at a time
  const delayBetweenBatches = 2000; // 2 second delay between batches

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(urls.length / batchSize)}`);

    // Process batch in parallel but with rate limiting
    const batchPromises = batch.map(async (url: string, index: number): Promise<BatchRequestResult> => {
      // Stagger requests within batch by 200ms each
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, index * 200));
      }

      try {
        const response = await rateLimitedFetch(url, options);
        return { url, status: response.status, statusText: response.statusText, headers: response.headers };
      } catch (error: any) {
        logger.warn(`Request failed in batch: ${url}`, { error: (error instanceof Error ? error.message : String(error)) });
        return { error: error.message, url };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Delay between batches (except for last batch)
    if (i + batchSize < urls.length) {
      logger.debug(`Waiting ${delayBetweenBatches}ms before next batch`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return results;
}

/**
 * Smart retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: error.message,
        attempt,
        maxRetries
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Create a new rate limiter instance
 */
export function createRateLimiter(
  maxRequests: number = 20,
  windowMs: number = 60000
): RateLimiter {
  return new RateLimiter(maxRequests, windowMs);
}

// Export the default rate limiters
export { yahooFinanceRateLimiter, fallbackApiRateLimiter };

// Export types for external use
export type {
  RateLimiterStatus,
  BatchRequestResult
};