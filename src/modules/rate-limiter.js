/**
 * Rate Limiter for Yahoo Finance API
 * Ensures we don't exceed API rate limits
 */

import { createLogger } from './logging.js';

const logger = createLogger('rate-limiter');

/**
 * Simple rate limiter implementation
 */
class RateLimiter {
  constructor(maxRequests = 20, windowMs = 60000) { // 20 requests per minute by default
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  /**
   * Check if request is allowed
   */
  isAllowed() {
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
  getRetryAfter() {
    if (this.requests.length === 0) return 0;

    const oldestRequest = Math.min(...this.requests);
    const retryAfter = this.windowMs - (Date.now() - oldestRequest);

    return Math.max(0, retryAfter);
  }

  /**
   * Get current status
   */
  getStatus() {
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

export function configureYahooRateLimiter(maxRequests, windowMs) {
  if (typeof maxRequests === 'number' && maxRequests > 0) {
    yahooFinanceRateLimiter.maxRequests = maxRequests;
  }
  if (typeof windowMs === 'number' && windowMs > 0) {
    yahooFinanceRateLimiter.windowMs = windowMs;
  }
}
/**
 * Rate-limited fetch for Yahoo Finance API
 */
export async function rateLimitedFetch(url, options = {}, rateLimiter = yahooFinanceRateLimiter) {
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

  } catch (error) {
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
export function getYahooFinanceRateStatus() {
  return yahooFinanceRateLimiter.getStatus();
}

/**
 * Reset rate limiter (for testing)
 */
export function resetRateLimiter() {
  yahooFinanceRateLimiter.requests = [];
  fallbackApiRateLimiter.requests = [];
}

/**
 * Batch rate-limited requests with intelligent spacing
 */
export async function batchRateLimitedRequests(urls, options = {}) {
  const results = [];
  const batchSize = 3; // Process 3 at a time
  const delayBetweenBatches = 2000; // 2 second delay between batches

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(urls.length / batchSize)}`);

    // Process batch in parallel but with rate limiting
    const batchPromises = batch.map(async (url, index) => {
      // Stagger requests within batch by 200ms each
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, index * 200));
      }

      try {
        return await rateLimitedFetch(url, options);
      } catch (error) {
        logger.warn(`Request failed in batch: ${url}`, { error: error.message });
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
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
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