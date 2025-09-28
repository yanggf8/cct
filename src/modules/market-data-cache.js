/**
 * Market Data Caching System
 * Reduces Yahoo Finance API calls and improves performance
 */

import { createLogger } from './logging.js';

const logger = createLogger('market-data-cache');

/**
 * In-memory cache for market data
 * Cache TTL: 5 minutes for real-time trading
 */
class MarketDataCache {
  constructor(ttlMs = 5 * 60 * 1000) { // 5 minutes default
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  /**
   * Generate cache key for symbol and timeframe
   */
  getCacheKey(symbol, days = 50) {
    return `${symbol}_${days}d`;
  }

  /**
   * Check if cached data is still valid
   */
  isValid(cacheEntry) {
    if (!cacheEntry) return false;

    const now = Date.now();
    const age = now - cacheEntry.timestamp;

    return age < this.ttlMs;
  }

  /**
   * Get cached market data if available and valid
   */
  get(symbol, days = 50) {
    const key = this.getCacheKey(symbol, days);
    const entry = this.cache.get(key);

    if (this.isValid(entry)) {
      logger.debug(`Cache hit for ${symbol}`, {
        symbol,
        age: Date.now() - entry.timestamp,
        ttl: this.ttlMs
      });
      return entry.data;
    }

    if (entry) {
      // Clean up expired entry
      this.cache.delete(key);
      logger.debug(`Cache expired for ${symbol}`, {
        symbol,
        age: Date.now() - entry.timestamp
      });
    }

    return null;
  }

  /**
   * Store market data in cache
   */
  set(symbol, data, days = 50) {
    const key = this.getCacheKey(symbol, days);
    const entry = {
      data: data,
      timestamp: Date.now(),
      symbol: symbol
    };

    this.cache.set(key, entry);

    logger.debug(`Cached market data for ${symbol}`, {
      symbol,
      dataPoints: data?.data?.ohlcv?.length || 0,
      cacheSize: this.cache.size
    });
  }

  /**
   * Clear expired entries from cache
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }

    return cleanedCount;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (this.isValid(entry)) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
      hits: this.hitCount || 0,
      misses: this.missCount || 0
    };
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;

    logger.info(`Cleared all cache entries`, { entriesCleared: size });
  }
}

// Global cache instance
const globalMarketDataCache = new MarketDataCache();

// Track hit/miss statistics
globalMarketDataCache.hitCount = 0;
globalMarketDataCache.missCount = 0;

/**
 * Get cached market data or return null
 */
export function getCachedMarketData(symbol, days = 50) {
  const cached = globalMarketDataCache.get(symbol, days);

  if (cached) {
    globalMarketDataCache.hitCount++;
    return cached;
  } else {
    globalMarketDataCache.missCount++;
    return null;
  }
}

/**
 * Cache market data for future use
 */
export function cacheMarketData(symbol, data, days = 50) {
  globalMarketDataCache.set(symbol, data, days);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return globalMarketDataCache.getStats();
}

/**
 * Clean up expired cache entries
 */
export function cleanupCache() {
  return globalMarketDataCache.cleanup();
}

/**
 * Clear all cached data
 */
export function clearCache() {
  globalMarketDataCache.clear();
}

/**
 * Cached market data wrapper with automatic cleanup
 */
export async function withCache(symbol, fetchFunction, days = 50) {
  // Try to get from cache first
  const cached = getCachedMarketData(symbol, days);
  if (cached) {
    return cached;
  }

  // Cache miss - fetch fresh data
  logger.debug(`Cache miss for ${symbol}, fetching fresh data`);

  try {
    const freshData = await fetchFunction();

    // Cache the fresh data if successful
    if (freshData && freshData.success) {
      cacheMarketData(symbol, freshData, days);
    }

    return freshData;

  } catch (error) {
    logger.warn(`Failed to fetch fresh data for ${symbol}`, { error: error.message });
    throw error;
  }
}

// Periodic cleanup every 10 minutes
setInterval(() => {
  cleanupCache();
}, 10 * 60 * 1000);