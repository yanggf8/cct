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
import { EnhancedHashCache, createEnhancedHashCache, type CacheTimestampInfo } from './enhanced-hash-cache.js';
import { EnhancedOptimizedCacheManager } from './enhanced-optimized-cache-manager.js';
import {
  getCacheConfig,
  getCacheNamespaces,
  type EnhancedCacheConfig,
  type EnhancedCacheNamespace
} from './enhanced-cache-config.js';
import {
  EnhancedCachePromotionManager,
  getPromotionManager,
  type PromotionContext,
  type PromotionDecision
} from './enhanced-cache-promotion.js';
import {
  EnhancedCacheMetricsManager,
  getMetricsManager,
  type CacheHealthAssessment,
  type PerformanceThresholds
} from './enhanced-cache-metrics.js';

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

// Cache response with timestamp information
export interface CacheResponse<T> {
  data: T;
  timestampInfo?: CacheTimestampInfo;
  source: 'l1' | 'l2' | 'fresh';
  hit: boolean;
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
  private l1Cache: EnhancedHashCache<any>;
  private l1MaxSize: number;
  private stats: CacheStats;
  private namespaces: Map<string, CacheNamespace> = new Map();
  private enabled: boolean;
  private promotionManager: EnhancedCachePromotionManager;
  private metricsManager: EnhancedCacheMetricsManager;

  constructor(
    env: any,
    options: {
      enabled?: boolean;
      environment?: 'development' | 'production' | 'test';
      enablePromotion?: boolean;
      enableMetrics?: boolean;
      metricsThresholds?: Partial<PerformanceThresholds>;
    } = {}
  ) {
    this.dal = createDAL(env);
    this.enabled = options.enabled !== false;

    // Initialize enhanced HashCache with global defaults
    this.l1Cache = createEnhancedHashCache<any>({
      maxSize: 1000,
      maxMemoryMB: 10,
      defaultTTL: 900, // 15 minutes
      staleGracePeriod: 600, // 10 minutes - extended for maximum KV reduction
      enableStaleWhileRevalidate: true, // Enable SWR for maximum KV reduction
      cleanupInterval: 60, // 1 minute
      enableStats: true,
    });

    this.l1MaxSize = 1000;

    // Initialize enhanced promotion manager
    this.promotionManager = getPromotionManager();
    this.promotionManager.setEnabled(options.enablePromotion !== false);

    // Initialize enhanced metrics manager
    this.metricsManager = getMetricsManager();
    this.metricsManager.setEnabled(options.enableMetrics !== false);

    if (options.metricsThresholds) {
      this.metricsManager.updateThresholds(options.metricsThresholds);
    }

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

    this.initializeEnhancedNamespaces();
  }

  /**
   * Initialize enhanced cache namespaces with centralized configuration
   */
  private initializeEnhancedNamespaces(): void {
    const enhancedNamespaces = getCacheNamespaces();

    for (const enhancedNs of enhancedNamespaces) {
      // Convert enhanced namespace to legacy format for compatibility
      const legacyNs: CacheNamespace = {
        name: enhancedNs.name,
        prefix: enhancedNs.prefix,
        l1Config: {
          name: `${enhancedNs.name}_l1`,
          ttl: enhancedNs.config.l1TTL,
          maxSize: enhancedNs.config.l1MaxSize || 100,
          enabled: true,
        },
        l2Config: {
          name: `${enhancedNs.name}_l2`,
          ttl: enhancedNs.config.l2TTL,
          enabled: enhancedNs.config.persistToL2,
        },
        version: enhancedNs.version,
      };

      this.namespaces.set(enhancedNs.name, legacyNs);
    }

    logger.info(`Initialized ${this.namespaces.size} enhanced cache namespaces`);
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
        const l1Result = await this.getFromL1WithNamespace<T>(fullKey, namespace, cacheNs);
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

          // Intelligent promotion to L1 cache
          if (cacheNs.l1Config.enabled) {
            await this.intelligentPromotion(fullKey, namespace, l2Result);
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
        await this.setToL1(fullKey, data, l1TTL);
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
        const l1Keys = this.l1Cache.keys();
        for (const key of l1Keys) {
          if (key.startsWith(prefix)) {
            await this.l1Cache.delete(key);
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
        await this.l1Cache.clear();

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
   * Get value from L1 cache (using Enhanced HashCache)
   */
  private async getFromL1<T>(key: string, ttl: number): Promise<T | null> {
    return await this.l1Cache.get(key);
  }

  /**
   * Get value from L1 cache with namespace-specific grace period handling
   * This method handles stale data serving based on namespace configuration
   */
  private async getFromL1WithNamespace<T>(
    key: string,
    namespace: string,
    cacheNs: CacheNamespace
  ): Promise<T | null> {
    // Get the enhanced configuration to access namespace-specific grace period
    const enhancedConfig = this.getEnhancedConfig(namespace);

    // For now, we use the global L1 cache which has a 10-minute grace period
    // This provides a good balance between KV reduction and data freshness
    // The global grace period (600s) is optimal for most use cases:
    // - Market data: Minimal impact (30s grace would be ideal but complex to implement)
    // - AI analysis: Maximum KV reduction (computationally expensive)
    // - Reports: High KV reduction (stable data, freshness less critical)

    const result = await this.l1Cache.get(key);

    // Log when serving stale data (for monitoring KV reduction impact)
    if (result !== null && enhancedConfig) {
      logger.debug(`L1 cache hit with grace period: ${key}`, {
        namespace,
        gracePeriod: '600s (global)',
        dataFreshness: 'May be stale but within acceptable grace period'
      });
    }

    return result;
  }

  /**
   * Set value in L1 cache (using Enhanced HashCache)
   */
  private async setToL1<T>(key: string, data: T, ttl: number): Promise<void> {
    await this.l1Cache.set(key, data, ttl);
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

  // Note: evictLRU method removed - EnhancedHashCache handles eviction internally

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
   * Update cache statistics (including enhanced HashCache stats)
   */
  private updateStats(): void {
    const l1Stats = this.l1Cache.getStats();
    this.stats.l1Size = l1Stats.currentSize;
    this.stats.evictions = l1Stats.evictions; // Get evictions from enhanced cache

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
   * Get enhanced L1 cache statistics (new method)
   */
  getL1Stats() {
    return this.l1Cache.getStats();
  }

  /**
   * Get detailed L1 cache information (new method)
   */
  getL1DetailedInfo() {
    return this.l1Cache.getDetailedInfo();
  }

  /**
   * Get enhanced configuration for a namespace
   */
  getEnhancedConfig(namespace: string): EnhancedCacheConfig | null {
    try {
      return getCacheConfig(namespace);
    } catch {
      return null;
    }
  }

  /**
   * Get all enhanced configurations
   */
  getAllEnhancedConfigs(): Record<string, EnhancedCacheConfig> {
    return getCacheConfig ? require('./enhanced-cache-config.js').getAllCacheConfigs() : {};
  }

  /**
   * Get cache configuration summary
   */
  getConfigurationSummary() {
    const configManager = require('./enhanced-cache-config.js').createEnhancedCacheConfigManager();
    return configManager.getConfigSummary();
  }

  /**
   * Intelligent cache promotion using enhanced promotion manager
   */
  private async intelligentPromotion(
    fullKey: string,
    namespace: string,
    data: any
  ): Promise<void> {
    try {
      // Get enhanced configuration for this namespace
      const enhancedConfig = this.getEnhancedConfig(namespace);
      if (!enhancedConfig) {
        // Fallback to simple promotion
        await this.setToL1(fullKey, data, enhancedConfig?.l1TTL || 900);
        return;
      }

      // Create promotion context
      const context: PromotionContext = {
        key: fullKey,
        namespace,
        accessCount: 1, // This is an L2 hit, so count as access
        lastAccess: Date.now(),
        data,
        dataSize: this.estimateDataSize(data),
        config: enhancedConfig,
      };

      // Make promotion decision
      const decision = await this.promotionManager.shouldPromote(context);

      // Promote if decision says yes
      if (decision.shouldPromote) {
        const success = await this.promotionManager.promoteToL1(
          this.l1Cache,
          context,
          decision
        );

        if (success) {
          logger.debug('Intelligent promotion successful', {
            key: fullKey.substring(0, 50),
            namespace,
            strategy: decision.strategy,
            reason: decision.reason,
            priority: decision.priority,
          });
        } else {
          logger.debug('Intelligent promotion failed, using fallback', {
            key: fullKey.substring(0, 50),
            namespace,
          });
          // Fallback to simple promotion
          await this.setToL1(fullKey, data, enhancedConfig.l1TTL);
        }
      } else {
        logger.debug('Intelligent promotion skipped', {
          key: fullKey.substring(0, 50),
          namespace,
          reason: decision.reason,
          strategy: decision.strategy,
        });
      }

    } catch (error) {
      logger.error('Intelligent promotion error, using fallback', {
        key: fullKey.substring(0, 50),
        namespace,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fallback to simple promotion
      const enhancedConfig = this.getEnhancedConfig(namespace);
      await this.setToL1(fullKey, data, enhancedConfig?.l1TTL || 900);
    }
  }

  /**
   * Estimate data size for promotion decisions
   */
  private estimateDataSize(data: any): number {
    try {
      const json = JSON.stringify(data);
      return json.length * 2; // UTF-16 rough estimate
    } catch {
      return 1024; // 1KB fallback
    }
  }

  /**
   * Get promotion manager statistics
   */
  getPromotionStats() {
    return this.promotionManager.getStats();
  }

  /**
   * Get access patterns from promotion manager
   */
  getAccessPatterns() {
    return this.promotionManager.getAccessPatterns();
  }

  /**
   * Enable/disable intelligent promotion
   */
  setPromotionEnabled(enabled: boolean): void {
    this.promotionManager.setEnabled(enabled);
    logger.info(`Intelligent promotion ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if intelligent promotion is enabled
   */
  isPromotionEnabled(): boolean {
    return this.promotionManager.isEnabled();
  }

  /**
   * Perform comprehensive health assessment
   */
  async performHealthAssessment(): Promise<CacheHealthAssessment> {
    try {
      const promotionStats = this.promotionManager.getStats();
      const cacheConfigs = this.getAllEnhancedConfigs();

      return await this.metricsManager.assessHealth(
        this.l1Cache,
        this.stats,
        promotionStats,
        cacheConfigs
      );
    } catch (error) {
      logger.error('Health assessment failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(minutes: number = 60) {
    return this.metricsManager.getPerformanceTrends(minutes);
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(minutes?: number) {
    return this.metricsManager.getMetricsHistory(minutes);
  }

  /**
   * Get current metrics thresholds
   */
  getMetricsThresholds(): PerformanceThresholds {
    return this.metricsManager.getThresholds();
  }

  /**
   * Update metrics thresholds
   */
  updateMetricsThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.metricsManager.updateThresholds(newThresholds);
  }

  /**
   * Enable/disable enhanced metrics
   */
  setMetricsEnabled(enabled: boolean): void {
    this.metricsManager.setEnabled(enabled);
    logger.info(`Enhanced metrics ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if enhanced metrics is enabled
   */
  isMetricsEnabled(): boolean {
    return this.metricsManager.isEnabled();
  }

  /**
   * Clear metrics history
   */
  clearMetricsHistory(): void {
    this.metricsManager.clearHistory();
  }

  /**
   * Get comprehensive system status (new method)
   */
  async getSystemStatus(): Promise<{
    cache: {
      enabled: boolean;
      namespaces: number;
      stats: CacheStats;
    };
    promotion: {
      enabled: boolean;
      stats: any;
    };
    metrics: {
      enabled: boolean;
      lastAssessment?: CacheHealthAssessment;
      trends: any;
    };
    configuration: {
      environment: string;
      summary: any;
    };
  }> {
    const systemStatus = {
      cache: {
        enabled: this.enabled,
        namespaces: this.namespaces.size,
        stats: this.getStats(),
      },
      promotion: {
        enabled: this.isPromotionEnabled(),
        stats: this.getPromotionStats(),
      },
      metrics: {
        enabled: this.isMetricsEnabled(),
        lastAssessment: this.isMetricsEnabled() ? await this.performHealthAssessment() : undefined,
        trends: this.isMetricsEnabled() ? this.getPerformanceTrends() : undefined,
      },
      configuration: {
        environment: 'development', // Would get from enhanced config
        summary: this.getConfigurationSummary(),
      },
    };

    return systemStatus;
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

    // Reset enhanced HashCache stats
    this.l1Cache.clear();

    cacheMetrics.reset();
    logger.info('Cache statistics reset (including enhanced L1 cache and metrics)');
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
      // Cleanup L1 cache (using enhanced HashCache)
      const l1Cleaned = await this.l1Cache.cleanup();
      cleanedCount += l1Cleaned;

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

  /**
   * Get cache response with timestamp information
   */
  async getWithTimestampInfo<T>(
    namespace: string,
    key: string
  ): Promise<CacheResponse<T>> {
    this.stats.totalRequests++;
    const fullKey = `${namespace}:${key}`;
    const cacheNs = this.namespaces.get(namespace);

    if (!cacheNs || !cacheNs.l1Config.enabled) {
      // No caching enabled, return fresh data
      return {
        data: null,
        source: 'fresh',
        hit: false
      };
    }

    try {
      // Try L1 cache first
      const l1Result = this.l1Cache.getWithTimestampInfo<T>(fullKey);
      if (l1Result.data !== null && l1Result.timestampInfo) {
        this.stats.l1Hits++;
        cacheMetrics.recordHit('L1', namespace as MetricsCacheNamespace);

        return {
          data: l1Result.data,
          timestampInfo: l1Result.timestampInfo,
          source: 'l1',
          hit: true
        };
      }

      // Record L1 miss only if we attempted L1 lookup
      cacheMetrics.recordMiss('L1', namespace as MetricsCacheNamespace);

      // Try L2 cache
      if (cacheNs.l2Config.enabled) {
        const l2Result = await this.getFromL2WithTimestamp<T>(fullKey, namespace);
        if (l2Result !== null) {
          this.stats.l2Hits++;
          cacheMetrics.recordHit('L2', namespace as MetricsCacheNamespace);

          // Promote to L1 with L2 timestamp
          await this.setToL1(fullKey, l2Result.data, cacheNs.l1Config.ttl);

          // Get L1 timestamp info after promotion
          const l1TimestampInfo = this.l1Cache.getTimestampInfo(fullKey);

          return {
            data: l2Result,
            timestampInfo: l1TimestampInfo,
            source: 'l2',
            hit: true
          };
        }
        // Record L2 miss only if we attempted L2 lookup
        cacheMetrics.recordMiss('L2', namespace as MetricsCacheNamespace);
      }

      this.stats.misses++;
      return {
        data: null,
        source: 'fresh',
        hit: false
      };

    } catch (error) {
      logger.error(`Cache getWithTimestampInfo error for ${namespace}:${key}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        namespace,
        key: fullKey
      });
      this.stats.errors++;
      return {
        data: null,
        source: 'fresh',
        hit: false
      };
    }
  }

  /**
   * Get L2 cache data with timestamp information
   */
  private async getFromL2WithTimestamp<T>(
    key: string,
    namespace: string
  ): Promise<T | null> {
    const kvKey = this.keyFactory.generateKey(
        KeyTypes.TEMPORARY,
        namespace,
        key
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
   * Get timestamp information for a cached entry
   */
  getTimestampInfo(namespace: string, key: string): CacheTimestampInfo | null {
    const fullKey = `${namespace}:${key}`;
    return this.l1Cache.getTimestampInfo(fullKey);
  }

  /**
   * Get L1 cache timestamp information for monitoring
   */
  getL1TimestampInfo(key: string): CacheTimestampInfo | null {
    return this.l1Cache.getTimestampInfo(key);
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