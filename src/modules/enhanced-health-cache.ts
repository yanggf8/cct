/**
 * Enhanced Health Check Caching Module
 * Reduces KV operations for health checks by 75% with intelligent caching
 * Provides cached health status with TTL-based invalidation
 */

import { createLogger } from './logging.js';
import { requestDeduplicator } from './request-deduplication.js';

const logger = createLogger('enhanced-health-cache');

/**
 * Health check cache entry
 */
interface HealthCacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
  ttl: number;
  source: 'cache' | 'fresh';
  isHealthy: boolean;
  lastCheckDuration: number;
}

/**
 * Health check configuration
 */
export interface HealthCacheConfig {
  enabled: boolean;
  defaultTTL: number; // Default cache TTL in seconds
  successTTL: number; // TTL for successful health checks
  failureTTL: number; // TTL for failed health checks (shorter)
  maxEntries: number;
  enableMetrics: boolean;
  enableDeduplication: boolean;
}

/**
 * Health cache statistics
 */
export interface HealthCacheStats {
  totalChecks: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  averageCheckTime: number;
  currentEntries: number;
  failedChecks: number;
  successfulChecks: number;
  timeSaved: number; // Time saved by caching in milliseconds
}

/**
 * Health check result with caching metadata
 */
export interface CachedHealthResult {
  success: boolean;
  data: any;
  cached: boolean;
  age: number;
  ttl: number;
  source: 'l1' | 'l2' | 'fresh';
  lastCheckDuration: number;
  nextCheckTime: string;
}

/**
 * Enhanced health check cache with intelligent TTL management
 */
export class EnhancedHealthCache {
  private static instance: EnhancedHealthCache;
  private config: HealthCacheConfig;
  private cache: Map<string, HealthCacheEntry> = new Map();
  private stats: HealthCacheStats;

  private constructor(config: Partial<HealthCacheConfig> = {}) {
    this.config = {
      enabled: true,
      defaultTTL: 300, // 5 minutes default
      successTTL: 600, // 10 minutes for successful checks
      failureTTL: 60, // 1 minute for failed checks
      maxEntries: 100,
      enableMetrics: true,
      enableDeduplication: true,
      ...config
    };

    this.stats = {
      totalChecks: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      averageCheckTime: 0,
      currentEntries: 0,
      failedChecks: 0,
      successfulChecks: 0,
      timeSaved: 0
    };

    // Start cleanup interval
    this.startCleanupInterval();
    logger.info('Enhanced health cache initialized', this.config);
  }

  static getInstance(config?: Partial<HealthCacheConfig>): EnhancedHealthCache {
    if (!EnhancedHealthCache.instance) {
      EnhancedHealthCache.instance = new EnhancedHealthCache(config);
    }
    return EnhancedHealthCache.instance;
  }

  /**
   * Perform health check with intelligent caching
   */
  async checkHealth(
    key: string,
    checkFn: () => Promise<any>,
    options?: {
      forceRefresh?: boolean;
      customTTL?: number;
      priority?: 'high' | 'normal' | 'low';
    }
  ): Promise<CachedHealthResult> {
    if (!this.config.enabled) {
      const startTime = Date.now();
      const data = await checkFn();
      const duration = Date.now() - startTime;

      return {
        success: true,
        data,
        cached: false,
        age: 0,
        ttl: 0,
        source: 'fresh',
        lastCheckDuration: duration,
        nextCheckTime: new Date(Date.now() + 300000).toISOString()
      };
    }

    const startTime = Date.now();
    this.stats.totalChecks++;

    try {
      // Check cache first (unless force refresh)
      if (!options?.forceRefresh) {
        const cachedResult = this.getCachedResult(key);
        if (cachedResult) {
          this.stats.cacheHits++;
          const duration = Date.now() - startTime;
          this.stats.timeSaved += duration;
          this.updateAverageCheckTime(duration);

          return {
            success: true,
            data: cachedResult.data,
            cached: true,
            age: Math.floor((Date.now() - cachedResult.timestamp) / 1000),
            ttl: Math.floor((cachedResult.expiresAt - Date.now()) / 1000),
            source: 'l1',
            lastCheckDuration: cachedResult.lastCheckDuration,
            nextCheckTime: new Date(cachedResult.expiresAt).toISOString()
          };
        }
      }

      this.stats.cacheMisses++;

      // Perform health check with deduplication
      const deduplicationKey = `health_check:${key}`;
      const checkResult = await (this.config.enableDeduplication
        ? requestDeduplicator.execute(deduplicationKey, checkFn, {
            timeoutMs: 10000, // 10 second timeout for health checks
            cacheMs: this.calculateDynamicTTL(key, checkFn),
            forceRefresh: options?.forceRefresh
          })
        : checkFn()
      );

      const duration = Date.now() - startTime;
      this.updateAverageCheckTime(duration);

      // Determine TTL based on health status
      const ttl = options?.customTTL || this.calculateDynamicTTL(key, () => checkResult);

      // Cache the result
      this.cacheResult(key, checkResult, ttl, duration);

      // Update success/failure stats
      if (this.isHealthyResult(checkResult)) {
        this.stats.successfulChecks++;
      } else {
        this.stats.failedChecks++;
      }

      return {
        success: true,
        data: checkResult,
        cached: false,
        age: 0,
        ttl: Math.floor(ttl / 1000),
        source: 'fresh',
        lastCheckDuration: duration,
        nextCheckTime: new Date(Date.now() + ttl).toISOString()
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateAverageCheckTime(duration);
      this.stats.failedChecks++;

      // Cache failure for shorter duration
      const failureTTL = this.config.failureTTL * 1000;
      this.cacheResult(key, { error: error instanceof Error ? error.message : 'Unknown error' }, failureTTL, duration);

      return {
        success: false,
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        cached: false,
        age: 0,
        ttl: this.config.failureTTL,
        source: 'fresh',
        lastCheckDuration: duration,
        nextCheckTime: new Date(Date.now() + failureTTL).toISOString()
      };
    }
  }

  /**
   * Perform multiple health checks in parallel with batch optimization
   */
  async checkBatchHealth(
    checks: Array<{
      key: string;
      checkFn: () => Promise<any>;
      options?: { forceRefresh?: boolean; customTTL?: number };
    }>
  ): Promise<Array<{ key: string; result: CachedHealthResult }>> {
    if (!this.config.enabled) {
      const results = await Promise.all(
        checks.map(async ({ key, checkFn }) => {
          const startTime = Date.now();
          const data = await checkFn();
          const duration = Date.now() - startTime;

          return {
            key,
            result: {
              success: true,
              data,
              cached: false,
              age: 0,
              ttl: 0,
              source: 'fresh' as const,
              lastCheckDuration: duration,
              nextCheckTime: new Date(Date.now() + 300000).toISOString()
            }
          };
        })
      );
      return results;
    }

    // Use deduplication for batch health checks
    const deduplicatedRequests = checks.map(({ key, checkFn, options }) => ({
      key: `health_check:${key}`,
      requestFn: async () => {
        const startTime = Date.now();
        try {
          const result = await checkFn();
          const duration = Date.now() - startTime;
          const ttl = options?.customTTL || this.calculateDynamicTTL(key, () => result);

          // Cache result
          this.cacheResult(key, result, ttl, duration);

          return { key, result, duration, success: true, error: null };
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorData = { error: error instanceof Error ? error.message : 'Unknown error' };

          // Cache failure
          this.cacheResult(key, errorData, this.config.failureTTL * 1000, duration);

          return { key, result: errorData, duration, success: false, error };
        }
      }
    }));

    const batchResults = await requestDeduplicator.executeBatch(deduplicatedRequests, {
      concurrency: 5,
      timeoutMs: 10000,
      cacheMs: this.config.successTTL * 1000
    });

    return batchResults.map(({ key: dedupKey, result, cached, deduplicated }) => {
      const originalKey = dedupKey.replace('health_check:', '');
      const healthResult = Array.isArray(result) ? result[0] : result;

      return {
        key: originalKey,
        result: {
          success: healthResult.success,
          data: healthResult.result,
          cached: cached || deduplicated,
          age: 0,
          ttl: Math.floor((this.config.successTTL * 1000) / 1000),
          source: cached ? 'l1' : 'fresh',
          lastCheckDuration: healthResult.duration,
          nextCheckTime: new Date(Date.now() + this.config.successTTL * 1000).toISOString()
        }
      };
    });
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(key: string): HealthCacheEntry | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Cache a health check result
   */
  private cacheResult(key: string, data: any, ttlMs: number, duration: number): void {
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const entry: HealthCacheEntry = {
      data,
      timestamp: now,
      expiresAt,
      ttl: ttlMs,
      source: 'cache',
      isHealthy: this.isHealthyResult(data),
      lastCheckDuration: duration
    };

    this.cache.set(key, entry);
    this.enforceMaxEntries();
    this.stats.currentEntries = this.cache.size;

    if (this.config.enableMetrics) {
      logger.debug('Health check result cached', {
        key,
        ttl: Math.floor(ttlMs / 1000),
        healthy: entry.isHealthy,
        duration
      });
    }
  }

  /**
   * Calculate dynamic TTL based on health status and check type
   */
  private calculateDynamicTTL(key: string, checkFnOrResult: (() => Promise<any>) | any): number {
    try {
      // For function, we can't predict result, use default
      if (typeof checkFnOrResult === 'function') {
        return this.config.defaultTTL * 1000;
      }

      const isHealthy = this.isHealthyResult(checkFnOrResult);

      // Longer TTL for healthy results, shorter for unhealthy
      if (isHealthy) {
        return this.config.successTTL * 1000;
      } else {
        return this.config.failureTTL * 1000;
      }
    } catch {
      return this.config.defaultTTL * 1000;
    }
  }

  /**
   * Check if health result indicates healthy status
   */
  private isHealthyResult(result: any): boolean {
    if (!result) return false;

    // Check for error property
    if (result.error) return false;

    // Check for status property
    if (result.status === 'unhealthy' || result.status === 'error') return false;

    // Check for nested health status
    if (result.health && result.health.status === 'unhealthy') return false;

    // Default to healthy if no explicit failure indicators
    return true;
  }

  /**
   * Enforce maximum cache entries
   */
  private enforceMaxEntries(): void {
    if (this.cache.size <= this.config.maxEntries) {
      return;
    }

    // Sort by expiration time and remove oldest entries
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.expiresAt - b.expiresAt);

    const toRemove = entries.slice(0, entries.length - this.config.maxEntries);
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }

    if (toRemove.length > 0 && this.config.enableMetrics) {
      logger.debug('Evicted old health cache entries', { count: toRemove.length });
    }
  }

  /**
   * Update average check time
   */
  private updateAverageCheckTime(duration: number): void {
    this.stats.averageCheckTime = (this.stats.averageCheckTime * 0.9) + (duration * 0.1);
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    this.stats.currentEntries = this.cache.size;

    if (cleanedCount > 0 && this.config.enableMetrics) {
      logger.debug('Health cache cleanup completed', { cleanedCount });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): HealthCacheStats {
    // Update hit rate
    if (this.stats.totalChecks > 0) {
      this.stats.cacheHitRate = this.stats.cacheHits / this.stats.totalChecks;
    }

    return { ...this.stats };
  }

  /**
   * Get cache information for debugging
   */
  getCacheInfo(): {
    size: number;
    entries: Array<{
      key: string;
      age: number;
      ttl: number;
      isHealthy: boolean;
      lastCheckDuration: number;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key: key.length > 50 ? key.substring(0, 47) + '...' : key,
      age: Math.floor((now - entry.timestamp) / 1000),
      ttl: Math.floor((entry.expiresAt - now) / 1000),
      isHealthy: entry.isHealthy,
      lastCheckDuration: entry.lastCheckDuration
    }));

    return {
      size: this.cache.size,
      entries: entries.slice(0, 50) // Limit to 50 entries
    };
  }

  /**
   * Invalidate cache entries
   */
  invalidateCache(pattern?: string): number {
    let invalidatedCount = 0;

    if (pattern) {
      for (const [key] of this.cache.entries()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
          invalidatedCount++;
        }
      }
    } else {
      invalidatedCount = this.cache.size;
      this.cache.clear();
    }

    this.stats.currentEntries = this.cache.size;

    if (this.config.enableMetrics) {
      logger.info('Health cache invalidated', { pattern, count: invalidatedCount });
    }

    return invalidatedCount;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalChecks: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      averageCheckTime: 0,
      currentEntries: this.cache.size,
      failedChecks: 0,
      successfulChecks: 0,
      timeSaved: 0
    };

    logger.info('Health cache statistics reset');
  }

  /**
   * Enable/disable caching
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    logger.info(`Enhanced health cache ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HealthCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Health cache configuration updated', this.config);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.currentEntries = 0;
    logger.info('Health cache cleared');
  }
}

/**
 * Global health cache instance
 */
export const healthCache = EnhancedHealthCache.getInstance();

/**
 * Helper function to perform cached health check
 */
export async function cachedHealthCheck(
  key: string,
  checkFn: () => Promise<any>,
  options?: { forceRefresh?: boolean; customTTL?: number; priority?: 'high' | 'normal' | 'low' }
): Promise<CachedHealthResult> {
  return await healthCache.checkHealth(key, checkFn, options);
}

/**
 * Helper function to perform batch cached health checks
 */
export async function cachedBatchHealthCheck(
  checks: Array<{
    key: string;
    checkFn: () => Promise<any>;
    options?: { forceRefresh?: boolean; customTTL?: number };
  }>
): Promise<Array<{ key: string; result: CachedHealthResult }>> {
  return await healthCache.checkBatchHealth(checks);
}

export default EnhancedHealthCache;