/**
 * Market Data Caching System
 * Reduces Yahoo Finance API calls and improves performance
 */

import { createLogger } from './logging.js';

// Type definitions
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  symbol: string;
}

interface CacheStats {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  hitRate: number;
  hits: number;
  misses: number;
}

interface MarketDataResponse {
  success: boolean;
  data?: {
    ohlcv?: Array<any>;
  };
  [key: string]: any;
}

const logger = createLogger('market-data-cache');

/**
 * In-memory cache for market data
 * Cache TTL: 5 minutes for real-time trading
 */
class MarketDataCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private ttlMs: number;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(ttlMs: number = 5 * 60 * 1000) { // 5 minutes default
    this.ttlMs = ttlMs;
  }

  /**
   * Generate cache key for symbol and timeframe
   */
  private getCacheKey(symbol: string, days: number = 50): string {
    return `${symbol}_${days}d`;
  }

  /**
   * Check if cached data is still valid
   */
  private isValid(cacheEntry: CacheEntry<T> | undefined): boolean {
    if (!cacheEntry) return false;

    const now = Date.now();
    const age = now - cacheEntry.timestamp;

    return age < this.ttlMs;
  }

  /**
   * Get cached market data if available and valid
   */
  get(symbol: string, days: number = 50): T | null {
    const key = this.getCacheKey(symbol, days);
    const entry = this.cache.get(key);

    if (this.isValid(entry)) {
      logger.debug(`Cache hit for ${symbol}`, {
        symbol,
        age: Date.now() - entry!.timestamp,
        ttl: this.ttlMs
      });
      return entry!.data;
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
  set(symbol: string, data: T, days: number = 50): void {
    const key = this.getCacheKey(symbol, days);
    const entry: CacheEntry<T> = {
      data: data,
      timestamp: Date.now(),
      symbol: symbol
    };

    this.cache.set(key, entry);

    logger.debug(`Cached market data for ${symbol}`, {
      symbol,
      dataPoints: (data as any)?.data?.ohlcv?.length || 0,
      cacheSize: this.cache.size
    });
  }

  /**
   * Clear expired entries from cache
   */
  cleanup(): number {
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
  getStats(): CacheStats {
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
      hits: this.hitCount,
      misses: this.missCount
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;

    logger.info(`Cleared all cache entries`, { entriesCleared: size });
  }

  /**
   * Get hit count (for external tracking)
   */
  getHitCount(): number {
    return this.hitCount;
  }

  /**
   * Get miss count (for external tracking)
   */
  getMissCount(): number {
    return this.missCount;
  }

  /**
   * Increment hit count
   */
  incrementHitCount(): void {
    this.hitCount++;
  }

  /**
   * Increment miss count
   */
  incrementMissCount(): void {
    this.missCount++;
  }
}

// Global cache instance
const globalMarketDataCache = new MarketDataCache<MarketDataResponse>();

/**
 * Get cached market data or return null
 */
export function getCachedMarketData(symbol: string, days: number = 50): MarketDataResponse | null {
  const cached = globalMarketDataCache.get(symbol, days);

  if (cached) {
    globalMarketDataCache.incrementHitCount();
    return cached;
  } else {
    globalMarketDataCache.incrementMissCount();
    return null;
  }
}

/**
 * Cache market data for future use
 */
export function cacheMarketData(symbol: string, data: MarketDataResponse, days: number = 50): void {
  globalMarketDataCache.set(symbol, data, days);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  return globalMarketDataCache.getStats();
}

/**
 * Clean up expired cache entries
 */
export function cleanupCache(): number {
  return globalMarketDataCache.cleanup();
}

/**
 * Clear all cached data
 */
export function clearCache(): void {
  globalMarketDataCache.clear();
}

/**
 * Cached market data wrapper with automatic cleanup
 */
export async function withCache<T extends MarketDataResponse>(
  symbol: string,
  fetchFunction: () => Promise<T>,
  days: number = 50
): Promise<T> {
  // Try to get from cache first
  const cached = getCachedMarketData(symbol, days) as T | null;
  if (cached) {
    return cached;
  }

  // Cache miss - fetch fresh data
  logger.debug(`Cache miss for ${symbol}, fetching fresh data`);

  try {
    const freshData = await fetchFunction();

    // Cache the fresh data if successful
    if (freshData && freshData.success) {
      cacheMarketData(symbol, freshData as MarketDataResponse, days);
    }

    return freshData;

  } catch (error: any) {
    logger.warn(`Failed to fetch fresh data for ${symbol}`, { error: error.message });
    throw error;
  }
}

/**
 * Create a new cache instance with custom TTL
 */
export function createMarketDataCache<T = MarketDataResponse>(ttlMs?: number): MarketDataCache<T> {
  return new MarketDataCache<T>(ttlMs);
}

// Export the global cache instance for direct access
export { globalMarketDataCache };

// Export types for external use
export type {
  CacheEntry,
  CacheStats,
  MarketDataResponse
};

export default {
  getCachedMarketData,
  cacheMarketData,
  getCacheStats,
  cleanupCache,
  clearCache,
  withCache,
  createMarketDataCache,
  globalMarketDataCache
};