/**
 * Cache Manager Module - TypeScript
 * Multi-level caching system with L1 memory cache and L2 KV cache
 * Intelligent cache management with namespace-based organization
 * Phase 2: Enhanced Caching System - Data Access Improvement Plan
 */

import { KVNamespace } from '@cloudflare/workers-types';
import { createDAL, DataAccessLayer as DAL } from './dal.js';
import { createLogger } from './logging.js';
import { getTimeout, getRetryCount } from './config.js';
import { ErrorUtils, type RetryOptions } from './shared-utilities.js';
import { KVKeyFactory, KeyTypes } from './kv-key-factory.js';
import { cacheMetrics, type CacheNamespace as MetricsCacheNamespace } from './cache-metrics.js';

const logger = createLogger('cache-manager');

// Cache level configuration
export interface CacheLevelConfig {
  name: string;
  ttl: number; // Time to live in seconds
  maxSize?: number; // Maximum number of entries (for L1)
  enabled: boolean;
}

// Cache entry with metadata
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
}

// Cache statistics
export interface CacheStats {
  totalRequests: number;
  l1Hits: number;
  l2Hits: number;
  misses: number;
  l1HitRate: number;
  l2HitRate: number;
  overallHitRate: number;
  l1Size: number;
  l2Size: number;
  evictions: number;
  errors: number;
}

// Cache namespace configuration
export interface CacheNamespace {
  name: string;
  prefix: string;
  l1Config: CacheLevelConfig;
  l2Config: CacheLevelConfig;
  version: string;
}

/**
 * Cache Manager with L1 (memory) and L2 (KV) caching
 */
export class CacheManager {
  private dal: DAL;
  private keyFactory = KVKeyFactory;
  private l1Cache: Map<string, CacheEntry<any>> = new Map();
  private l1MaxSize: number;
  private stats: CacheStats;
  private namespaces: Map<string, CacheNamespace> = new Map();
  private enabled: boolean;

  constructor(
    env: any,
    options: {
      l1MaxSize?: number;
      enabled?: boolean;
    } = {}
  ) {
    this.dal = createDAL(env);
    this.l1MaxSize = options.l1MaxSize || 1000;
    this.enabled = options.enabled !== false;

    this.stats = {
      totalRequests: 0,
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      l1HitRate: 0,
      l2HitRate: 0,
      overallHitRate: 0,
      l1Size: 0,
      l2Size: 0,
      evictions: 0,
      errors: 0
    };

    this.initializeDefaultNamespaces();
  }

  /**
   * Initialize default cache namespaces
   */
  private initializeDefaultNamespaces(): void {
    // Analysis data cache
    this.addNamespace({
      name: 'analysis',
      prefix: 'analysis',
      l1Config: {
        name: 'analysis_l1',
        ttl: 60, // 1 minute
        maxSize: 100,
        enabled: true
      },
      l2Config: {
        name: 'analysis_l2',
        ttl: 3600, // 1 hour
        enabled: true
      },
      version: '1.0'
    });

    // Market data cache
    this.addNamespace({
      name: 'market_data',
      prefix: 'market_data',
      l1Config: {
        name: 'market_data_l1',
        ttl: 30, // 30 seconds
        maxSize: 200,
        enabled: true
      },
      l2Config: {
        name: 'market_data_l2',
        ttl: 300, // 5 minutes
        enabled: true
      },
      version: '1.0'
    });

    // Sector data cache
    this.addNamespace({
      name: 'sector_data',
      prefix: 'sector_data',
      l1Config: {
        name: 'sector_data_l1',
        ttl: 45, // 45 seconds
        maxSize: 150,
        enabled: true
      },
      l2Config: {
        name: 'sector_data_l2',
        ttl: 600, // 10 minutes
        enabled: true
      },
      version: '1.0'
    });

    // Report cache
    this.addNamespace({
      name: 'reports',
      prefix: 'reports',
      l1Config: {
        name: 'reports_l1',
        ttl: 300, // 5 minutes
        maxSize: 50,
        enabled: true
      },
      l2Config: {
        name: 'reports_l2',
        ttl: 1800, // 30 minutes
        enabled: true
      },
      version: '1.0'
    });

    // API response cache
    this.addNamespace({
      name: 'api_responses',
      prefix: 'api_responses',
      l1Config: {
        name: 'api_responses_l1',
        ttl: 120, // 2 minutes
        maxSize: 300,
        enabled: true
      },
      l2Config: {
        name: 'api_responses_l2',
        ttl: 900, // 15 minutes
        enabled: true
      },
      version: '1.0'
    });

    logger.info(`Initialized ${this.namespaces.size} cache namespaces`);
  }

  /**
   * Add a new cache namespace
   */
  addNamespace(namespace: CacheNamespace): void {
    this.namespaces.set(namespace.name, namespace);
    logger.debug(`Added cache namespace: ${namespace.name}`);
  }

  /**
   * Get a value from cache (L1 first, then L2)
   */
  async get<T>(
    namespace: string,
    key: string,
    fetchFn?: () => Promise<T>
  ): Promise<T | null> {
    if (!this.enabled) {
      return fetchFn ? await fetchFn() : null;
    }

    this.stats.totalRequests++;
    const fullKey = this.buildCacheKey(namespace, key);
    const cacheNs = this.namespaces.get(namespace);

    if (!cacheNs) {
      logger.warn(`Cache namespace not found: ${namespace}`);
      this.stats.errors++;
      return fetchFn ? await fetchFn() : null;
    }

    try {
      // Try L1 cache first
      if (cacheNs.l1Config.enabled) {
        const l1Result = this.getFromL1<T>(fullKey, cacheNs.l1Config.ttl);
        if (l1Result !== null) {
          this.stats.l1Hits++;
          cacheMetrics.recordHit('L1', namespace as MetricsCacheNamespace);
          logger.debug(`L1 cache hit: ${fullKey}`);
          return l1Result;
        }
        // Record L1 miss only if we attempted L1 lookup
        cacheMetrics.recordMiss('L1', namespace as MetricsCacheNamespace);
      }

      // Try L2 cache
      if (cacheNs.l2Config.enabled) {
        const l2Result = await this.getFromL2<T>(fullKey, namespace);
        if (l2Result !== null) {
          this.stats.l2Hits++;
          cacheMetrics.recordHit('L2', namespace as MetricsCacheNamespace);
          logger.debug(`L2 cache hit: ${fullKey}`);

          // Promote to L1 cache
          if (cacheNs.l1Config.enabled) {
            this.setToL1(fullKey, l2Result, cacheNs.l1Config.ttl);
          }

          return l2Result;
        }
        // Record L2 miss only if we attempted L2 lookup
        cacheMetrics.recordMiss('L2', namespace as MetricsCacheNamespace);
      }

      // Cache miss - fetch data if function provided
      this.stats.misses++;
      logger.debug(`Cache miss: ${fullKey}`);

      if (fetchFn) {
        const data = await fetchFn();
        if (data !== null) {
          // Store in both L1 and L2
          await this.set(namespace, key, data);
        }
        return data;
      }

      return null;

    } catch (error) {
      logger.error(`Cache get error for ${fullKey}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        fullKey,
        namespace
      });
      this.stats.errors++;
      return fetchFn ? await fetchFn() : null;
    }
  }

  /**
   * Set a value in both L1 and L2 cache
   */
  async set<T>(
    namespace: string,
    key: string,
    data: T,
    customTTL?: { l1?: number; l2?: number }
  ): Promise<void> {
    if (!this.enabled) return;

    const fullKey = this.buildCacheKey(namespace, key);
    const cacheNs = this.namespaces.get(namespace);

    if (!cacheNs) {
      logger.warn(`Cache namespace not found: ${namespace}`);
      return;
    }

    try {
      // Set L1 cache
      if (cacheNs.l1Config.enabled) {
        const l1TTL = customTTL?.l1 || cacheNs.l1Config.ttl;
        this.setToL1(fullKey, data, l1TTL);
      }

      // Set L2 cache
      if (cacheNs.l2Config.enabled) {
        const l2TTL = customTTL?.l2 || cacheNs.l2Config.ttl;
        await this.setToL2(fullKey, data, namespace, l2TTL);
      }

      logger.debug(`Cache set: ${fullKey}`);

    } catch (error) {
      logger.error(`Cache set error for ${fullKey}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        fullKey,
        namespace
      });
      this.stats.errors++;
    }
  }

  /**
   * Delete a value from both L1 and L2 cache
   */
  async delete(namespace: string, key: string): Promise<void> {
    const fullKey = this.buildCacheKey(namespace, key);

    try {
      // Delete from L1
      this.l1Cache.delete(fullKey);

      // Delete from L2
      const kvKey = this.keyFactory.generateKey(
        KeyTypes.TEMPORARY,
        { purpose: fullKey, timestamp: 0 }
      );
      await this.dal.deleteKey(kvKey);

      logger.debug(`Cache delete: ${fullKey}`);

    } catch (error) {
      logger.error(`Cache delete error for ${fullKey}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        fullKey
      });
      this.stats.errors++;
    }
  }

  /**
   * Clear all cache or specific namespace
   */
  async clear(namespace?: string): Promise<void> {
    try {
      if (namespace) {
        // Clear specific namespace
        const prefix = `${namespace}:`;

        // Clear L1
        for (const key of this.l1Cache.keys()) {
          if (key.startsWith(prefix)) {
            this.l1Cache.delete(key);
          }
        }

        // Clear L2
        const kvKeys = await this.dal.listKeys(`${prefix}*`);
        for (const kvKey of kvKeys.keys) {
          await this.dal.deleteKey(kvKey);
        }

        logger.info(`Cleared cache namespace: ${namespace}`);
      } else {
        // Clear all cache
        this.l1Cache.clear();

        // Clear all L2 cache keys
        const allKeys = await this.dal.listKeys('cache:*');
        for (const key of allKeys.keys) {
          await this.dal.deleteKey(key);
        }

        logger.info('Cleared all cache');
      }

    } catch (error) {
      logger.error('Cache clear error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        namespace
      });
      this.stats.errors++;
    }
  }

  /**
   * Get value from L1 cache
   */
  private getFromL1<T>(key: string, ttl: number): T | null {
    const entry = this.l1Cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > (ttl * 1000)) {
      // Expired
      this.l1Cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.hits++;
    entry.lastAccessed = now;
    return entry.data;
  }

  /**
   * Set value in L1 cache with eviction policy
   */
  private setToL1<T>(key: string, data: T, ttl: number): void {
    // Check if we need to evict entries
    if (this.l1Cache.size >= this.l1MaxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      lastAccessed: Date.now()
    };

    this.l1Cache.set(key, entry);
  }

  /**
   * Get value from L2 cache (KV)
   */
  private async getFromL2<T>(key: string, namespace: string): Promise<T | null> {
    const kvKey = this.keyFactory.generateKey(
        KeyTypes.TEMPORARY,
        { purpose: key, timestamp: 0 }
      );

    const result = await this.dal.read(kvKey);
    if (!result) return null;

    try {
      const cacheEntry: CacheEntry<T> = JSON.parse(result);
      const now = Date.now();

      // Check if expired
      if (now - cacheEntry.timestamp > (cacheEntry.ttl * 1000)) {
        await this.dal.deleteKey(kvKey);
        return null;
      }

      return cacheEntry.data;

    } catch (error) {
      logger.error(`L2 cache parse error for ${key}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
        kvKey
      });
      await this.dal.deleteKey(kvKey);
      return null;
    }
  }

  /**
   * Set value in L2 cache (KV)
   */
  private async setToL2<T>(
    key: string,
    data: T,
    namespace: string,
    ttl: number
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      lastAccessed: Date.now()
    };

    const kvKey = this.keyFactory.generateKey(
        KeyTypes.TEMPORARY,
        { purpose: key, timestamp: ttl }
      );

    await this.dal.write(kvKey, JSON.stringify(entry));
  }

  /**
   * Evict least recently used entries from L1 cache
   */
  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.l1Cache.delete(oldestKey);
      this.stats.evictions++;
      logger.debug(`L1 cache evicted: ${oldestKey}`);
    }
  }

  /**
   * Build cache key with namespace
   */
  private buildCacheKey(namespace: string, key: string): string {
    const cacheNs = this.namespaces.get(namespace);
    const prefix = cacheNs?.prefix || namespace;
    const version = cacheNs?.version || '1.0';
    return `cache:${prefix}:${version}:${key}`;
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.l1Size = this.l1Cache.size;
    this.stats.l1HitRate = this.stats.totalRequests > 0
      ? this.stats.l1Hits / this.stats.totalRequests
      : 0;
    this.stats.l2HitRate = this.stats.totalRequests > 0
      ? this.stats.l2Hits / this.stats.totalRequests
      : 0;
    this.stats.overallHitRate = this.stats.totalRequests > 0
      ? (this.stats.l1Hits + this.stats.l2Hits) / this.stats.totalRequests
      : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get comprehensive metrics including detailed health info
   */
  getMetricsStats() {
    return cacheMetrics.getStats();
  }

  /**
   * Get metrics summary for logging
   */
  getMetricsSummary(): string {
    return cacheMetrics.getSummary();
  }

  /**
   * Get health status (enhanced with metrics-based assessment)
   */
  getHealthStatus(): {
    enabled: boolean;
    namespaces: number;
    l1Size: number;
    l1MaxSize: number;
    hitRate: number;
    status: 'healthy' | 'warning' | 'error';
    metricsHealth: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      issues: string[];
    };
  } {
    this.updateStats();

    // Get metrics-based health assessment
    const metricsStats = cacheMetrics.getStats();
    const metricsHealth = metricsStats.health;

    // Combine error-based and metrics-based status
    let status: 'healthy' | 'warning' | 'error' = 'healthy';

    // Check for errors first
    if (this.stats.errors > 0) {
      status = 'warning';
    }
    if (this.stats.errors > 10) {
      status = 'error';
    }

    // Downgrade status based on metrics health
    if (metricsHealth.status === 'degraded' && status === 'healthy') {
      status = 'warning';
    }
    if (metricsHealth.status === 'unhealthy') {
      status = 'error';
    }

    return {
      enabled: this.enabled,
      namespaces: this.namespaces.size,
      l1Size: this.stats.l1Size,
      l1MaxSize: this.l1MaxSize,
      hitRate: this.stats.overallHitRate,
      status,
      metricsHealth
    };
  }

  /**
   * Reset statistics (both internal and metrics)
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      l1HitRate: 0,
      l2HitRate: 0,
      overallHitRate: 0,
      l1Size: 0,
      l2Size: 0,
      evictions: 0,
      errors: 0
    };
    cacheMetrics.reset();
    logger.info('Cache statistics reset (including metrics)');
  }

  /**
   * Enable/disable caching
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info(`Cache ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;

    try {
      // Cleanup L1 cache
      for (const [key, entry] of this.l1Cache.entries()) {
        if (now - entry.timestamp > (entry.ttl * 1000)) {
          this.l1Cache.delete(key);
          cleanedCount++;
        }
      }

      // Cleanup L2 cache (handled by KV TTL, but we can check)
      const allKeys = await this.dal.listKeys('cache:*');
      for (const kvKey of allKeys.keys) {
        const result = await this.dal.read(kvKey);
        if (result) {
          try {
            const cacheEntry: CacheEntry<any> = JSON.parse(result);
            if (now - cacheEntry.timestamp > (cacheEntry.ttl * 1000)) {
              await this.dal.deleteKey(kvKey);
              cleanedCount++;
            }
          } catch {
            // Invalid entry, delete it
            await this.dal.deleteKey(kvKey);
            cleanedCount++;
          }
        }
      }

      logger.info(`Cache cleanup completed: ${cleanedCount} entries removed`);

    } catch (error) {
      logger.error('Cache cleanup error:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.stats.errors++;
    }
  }
}

/**
 * Create cache manager instance
 */
export function createCacheManager(
  env: any,
  options?: {
    l1MaxSize?: number;
    enabled?: boolean;
  }
): CacheManager {
  return new CacheManager(env, options);
}

export default CacheManager;