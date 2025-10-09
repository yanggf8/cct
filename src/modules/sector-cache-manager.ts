/**
 * Sector Cache Manager Module - TypeScript
 * Multi-layer caching system for sector rotation data with L1 (memory) + L2 (KV) cache
 * CRITICAL PRODUCTION FIX: Prevents thundering herd on Worker cold starts
 */

import { createDAL } from './dal.js';
import { KVKeyFactory, KeyTypes, KeyHelpers } from './kv-key-factory.js';
import { createLogger } from './logging.js';
import { getTimeout, getRetryCount } from './config.js';

const logger = createLogger('sector-cache-manager');

// Cache Configuration
const CACHE_CONFIG = {
  L1_TTL: 60, // 60 seconds L1 memory cache
  L2_TTL: 120, // 120 seconds L2 KV cache (Rovodev critical fix)
  MAX_CACHE_SIZE: 100, // Max items in L1 cache
  CLEANUP_INTERVAL: 300000, // 5 minutes cleanup interval
} as const;

// Sector data interface
export interface SectorData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
  // Technical indicators
  obv?: number; // On-Balance Volume
  cmf?: number; // Chaikin Money Flow
  relativeStrength?: number; // Relative strength vs SPY
  // Additional metrics
  marketCap?: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
}

// Cache entry interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

// Performance metrics interface
export interface CacheMetrics {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  totalRequests: number;
  l1HitRate: number;
  l2HitRate: number;
  overallHitRate: number;
  cacheSize: number;
  lastCleanup: number;
}

/**
 * Sector Cache Manager with dual-layer caching
 */
export class SectorCacheManager {
  private l1Cache = new Map<string, CacheEntry<SectorData>>();
  private l2DAL: any;
  private metrics: CacheMetrics;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(env: any) {
    this.l2DAL = createDAL(env);
    this.metrics = this.initializeMetrics();
    this.startCleanupTimer();
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): CacheMetrics {
    return {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      totalRequests: 0,
      l1HitRate: 0,
      l2HitRate: 0,
      overallHitRate: 0,
      cacheSize: 0,
      lastCleanup: Date.now()
    };
  }

  /**
   * Get sector data with dual-layer caching
   */
  async getSectorData(symbol: string): Promise<SectorData | null> {
    this.metrics.totalRequests++;
    const cacheKey = this.getCacheKey(symbol);

    try {
      // Try L1 cache first (fastest)
      const l1Data = this.getFromL1(cacheKey);
      if (l1Data) {
        this.metrics.l1Hits++;
        logger.debug(`L1 cache hit for ${symbol}`);
        return l1Data;
      }
      this.metrics.l1Misses++;

      // Try L2 cache (KV)
      const l2Data = await this.getFromL2(cacheKey);
      if (l2Data) {
        this.metrics.l2Hits++;
        logger.debug(`L2 cache hit for ${symbol}`);

        // Promote to L1 cache
        this.setToL1(cacheKey, l2Data);
        return l2Data;
      }
      this.metrics.l2Misses++;

      logger.debug(`Cache miss for ${symbol}`);
      return null;
    } catch (error) {
      logger.error(`Error getting sector data for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Set sector data to both cache layers
   */
  async setSectorData(symbol: string, data: SectorData): Promise<void> {
    const cacheKey = this.getCacheKey(symbol);

    try {
      // Set to L1 cache
      this.setToL1(cacheKey, data);

      // Set to L2 cache (KV) with retry logic
      await this.setToL2(cacheKey, data);

      logger.debug(`Cached sector data for ${symbol}`);
    } catch (error) {
      logger.error(`Error setting sector data for ${symbol}:`, error);
      // Don't throw - cache failures shouldn't break the main flow
    }
  }

  /**
   * Batch get sector data
   */
  async getBatchSectorData(symbols: string[]): Promise<Map<string, SectorData | null>> {
    const results = new Map<string, SectorData | null>();

    // Process in parallel with controlled concurrency
    const batchSize = 4; // Rovodev semaphore recommendation
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchPromises = batch.map(async (symbol) => {
        const data = await this.getSectorData(symbol);
        return { symbol, data };
      });

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.set(result.value.symbol, result.value.data);
        } else {
          logger.error(`Batch get failed for ${batch[index]}:`, result.reason);
          results.set(batch[index], null);
        }
      });
    }

    return results;
  }

  /**
   * Batch set sector data
   */
  async setBatchSectorData(dataMap: Map<string, SectorData>): Promise<void> {
    const promises = Array.from(dataMap.entries()).map(async ([symbol, data]) => {
      await this.setSectorData(symbol, data);
    });

    await Promise.allSettled(promises);
  }

  /**
   * Get data from L1 cache
   */
  private getFromL1(cacheKey: string): SectorData | null {
    const entry = this.l1Cache.get(cacheKey);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.l1Cache.delete(cacheKey);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  /**
   * Set data to L1 cache
   */
  private setToL1(cacheKey: string, data: SectorData): void {
    // Clean up if cache is full
    if (this.l1Cache.size >= CACHE_CONFIG.MAX_CACHE_SIZE) {
      this.evictOldestEntries();
    }

    this.l1Cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: CACHE_CONFIG.L1_TTL,
      hits: 0
    });

    this.updateMetrics();
  }

  /**
   * Get data from L2 cache (KV)
   */
  private async getFromL2(cacheKey: string): Promise<SectorData | null> {
    try {
      const result = await this.l2DAL.read(cacheKey);
      if (!result || !result.data) return null;

      const entry = result.data as CacheEntry<SectorData>;

      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl * 1000) {
        // Clean up expired entry
        await this.l2DAL.deleteKey(cacheKey);
        return null;
      }

      return entry.data;
    } catch (error) {
      logger.error(`L2 cache read error for ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Set data to L2 cache (KV)
   */
  private async setToL2(cacheKey: string, data: SectorData): Promise<void> {
    const entry: CacheEntry<SectorData> = {
      data,
      timestamp: Date.now(),
      ttl: CACHE_CONFIG.L2_TTL,
      hits: 0
    };

    const kvOptions = KeyHelpers.getKVOptions(KeyTypes.MARKET_DATA_CACHE, {
      expirationTtl: CACHE_CONFIG.L2_TTL,
      metadata: {
        type: 'sector_data',
        timestamp: entry.timestamp,
        version: '1.0'
      }
    });

    await this.l2DAL.write(cacheKey, entry, kvOptions);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(symbol: string): string {
    return `sector_data_${symbol.toLowerCase()}`;
  }

  /**
   * Evict oldest entries from L1 cache
   */
  private evictOldestEntries(): void {
    const entries: Array<[string, CacheEntry<SectorData>]> = [];
    this.l1Cache.forEach((value, key) => {
      entries.push([key, value]);
    });

    // Sort by timestamp (oldest first) and remove 25% of entries
    entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
    const toRemove = Math.floor(entries.length * 0.25);

    for (let i = 0; i < toRemove; i++) {
      this.l1Cache.delete(entries[i][0]);
    }

    logger.debug(`Evicted ${toRemove} old entries from L1 cache`);
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.l1Cache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.l1Cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired entries from L1 cache`);
    }

    this.metrics.lastCleanup = now;
    this.updateMetrics();
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, CACHE_CONFIG.CLEANUP_INTERVAL);
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    this.metrics.cacheSize = this.l1Cache.size;
    this.metrics.l1HitRate = this.metrics.totalRequests > 0
      ? this.metrics.l1Hits / this.metrics.totalRequests
      : 0;
    this.metrics.l2HitRate = this.metrics.totalRequests > 0
      ? this.metrics.l2Hits / this.metrics.totalRequests
      : 0;
    this.metrics.overallHitRate = this.metrics.totalRequests > 0
      ? (this.metrics.l1Hits + this.metrics.l2Hits) / this.metrics.totalRequests
      : 0;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    // Clear L1 cache
    this.l1Cache.clear();

    // Clear L2 cache (delete keys with pattern)
    try {
      const keys = await this.l2DAL.listKeys({ prefix: 'sector_data_' });
      for (const key of keys) {
        await this.l2DAL.deleteKey(key);
      }
      logger.info('Cleared all sector caches');
    } catch (error) {
      logger.error('Error clearing L2 cache:', error);
    }

    // Reset metrics
    this.metrics = this.initializeMetrics();
  }

  /**
   * Warm up cache with common symbols
   */
  async warmUpCache(symbols: string[]): Promise<void> {
    logger.info(`Warming up cache with ${symbols.length} symbols`);

    for (const symbol of symbols) {
      try {
        await this.getSectorData(symbol);
      } catch (error) {
        logger.error(`Error warming up cache for ${symbol}:`, error);
      }
    }

    logger.info('Cache warm-up completed');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    l1Size: number;
    l1HitRate: number;
    l2HitRate: number;
    overallHitRate: number;
    totalRequests: number;
    memoryUsage: number;
  } {
    this.updateMetrics();

    return {
      l1Size: this.l1Cache.size,
      l1HitRate: this.metrics.l1HitRate,
      l2HitRate: this.metrics.l2HitRate,
      overallHitRate: this.metrics.overallHitRate,
      totalRequests: this.metrics.totalRequests,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    this.l1Cache.forEach((entry, key) => {
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += JSON.stringify(entry.data).length * 2;
      totalSize += 64; // Approximate overhead
    });
    return totalSize;
  }

  /**
   * Destroy cache manager
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.l1Cache.clear();
    logger.info('Sector cache manager destroyed');
  }
}

export default SectorCacheManager;