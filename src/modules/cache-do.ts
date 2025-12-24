// Durable Objects-Based Dual Cache (Replaces HashCache + KV)
// Eliminates ALL KV operations for cache (zero reads, zero writes)
// Provides persistent L1 cache that survives worker restarts

import { CacheDurableObject } from './cache-durable-object.js';
import { createLogger } from './logging.js';

const logger = createLogger('cache-do');

/**
 * Cache configuration for Durable Objects
 */
export interface DualCacheConfig {
  ttl: number; // TTL in seconds
  staleWhileRevalidate?: number; // Grace period in seconds
  namespace?: string; // Cache namespace for key isolation
}

/**
 * Cache metadata for debugging and monitoring
 */
export interface CacheMetadata {
  cachedAt: string;
  expiresAt: string;
  lastAccessed: string;
  age: number; // Age in seconds
  ttl: number; // Remaining TTL in seconds
  cacheSource: 'l1'; // Always L1 for DO cache
}

/**
 * Durable Objects cache manager
 * Replaces: HashCache (L1) + KV (L2) → Single DO layer
 *
 * Benefits:
 * - Zero KV operations (100% elimination)
 * - Persistent in-memory cache (survives worker restarts)
 * - Always <1ms latency (no 50ms L2 fallback)
 * - Simpler architecture (single cache layer)
 */
export class CacheDO<T = any> {
  private doNamespace: DurableObjectNamespace;
  public l1Cache: any; // Compatibility property for enhanced-cache-routes

  constructor(doNamespace: DurableObjectNamespace) {
    this.doNamespace = doNamespace;
    this.l1Cache = {
      isStaleWhileRevalidateEnabled: () => true
    };
  }

  /**
   * Get Durable Object stub
   * Uses named ID for singleton instance
   */
  private getStub(): DurableObjectStub {
    const id = this.doNamespace.idFromName('global-cache');
    return this.doNamespace.get(id);
  }

  /**
   * Call DO via fetch
   */
  private async call(action: string, body?: any): Promise<any> {
    const stub = this.getStub();
    const response = await stub.fetch(`https://do/${action}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    return response.json();
  }

  /**
   * Get value from DO cache
   */
  async get(key: string, config: DualCacheConfig): Promise<T | null> {
    try {
      const result = await this.call('get', { key: this.buildKey(key, config) });
      if (result.value !== null && result.value !== undefined) {
        logger.info(`CACHE_DO HIT: ${key}`);
        return result.value;
      }
      logger.info(`CACHE_DO MISS: ${key}`);
      return null;
    } catch (error: unknown) {
      logger.error(`CACHE_DO_GET_ERROR: ${key}`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Set value in DO cache
   */
  async set(key: string, value: T, config: DualCacheConfig): Promise<void> {
    try {
      await this.call('set', { key: this.buildKey(key, config), value, ttl: config.ttl });
      logger.debug(`CACHE_DO SET: ${key} (TTL: ${config.ttl}s)`);
    } catch (error: unknown) {
      logger.error(`CACHE_DO_SET_ERROR: ${key}`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Get value with stale-while-revalidate logic
   */
  async getWithStaleRevalidate(
    key: string,
    config: DualCacheConfig,
    revalidateFn?: () => Promise<T | null>
  ): Promise<{ data: T | null; metadata: CacheMetadata | null; isStale: boolean }> {
    try {
      const value = await this.get(key, config);
      if (value === null) {
        return { data: null, metadata: null, isStale: false };
      }

      // For now, assume not stale (DO handles TTL internally)
      const cacheMetadata: CacheMetadata = {
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + config.ttl * 1000).toISOString(),
        lastAccessed: new Date().toISOString(),
        age: 0,
        ttl: config.ttl,
        cacheSource: 'l1'
      };

      return { data: value, metadata: cacheMetadata, isStale: false };
    } catch (error: unknown) {
      logger.error(`CACHE_DO_STALE_ERROR: ${key}`, { error: error instanceof Error ? error.message : String(error) });
      return { data: null, metadata: null, isStale: false };
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string, config: DualCacheConfig): Promise<void> {
    try {
      await this.call('delete', { key: this.buildKey(key, config) });
      logger.debug(`CACHE_DO DELETE: ${key}`);
    } catch (error: unknown) {
      logger.error(`CACHE_DO_DELETE_ERROR: ${key}`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * List keys matching prefix
   */
  async list(options: { prefix?: string; namespace?: string }): Promise<string[]> {
    try {
      const prefix = options.namespace ? `${options.namespace}:${options.prefix || ''}` : options.prefix;
      const result = await this.call('list', { prefix });
      return result?.keys || [];
    } catch (error: unknown) {
      logger.error(`CACHE_DO_LIST_ERROR`, { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      await this.call('clear', {});
      logger.info(`CACHE_DO: Cache cleared`);
    } catch (error: unknown) {
      logger.error(`CACHE_DO_CLEAR_ERROR`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      const stats = await this.call('stats');
      const hits = stats?.hits ?? 0;
      const misses = stats?.misses ?? 0;
      const total = hits + misses;
      const hitRate = total > 0 ? hits / total : 0;
      const now = Date.now();

      return {
        totalRequests: total,
        l1Hits: hits,
        l2Hits: 0,
        misses,
        l1HitRate: hitRate,
        l2HitRate: 0,
        overallHitRate: hitRate,
        l1Size: stats?.size ?? 0,
        l2Size: 0,
        evictions: stats?.evictions ?? 0,
        oldestEntry: stats?.oldestEntry,
        newestEntry: stats?.newestEntry,
        oldestEntryAge: stats?.oldestTimestamp ? now - stats.oldestTimestamp : null,
        newestEntryAge: stats?.newestTimestamp ? now - stats.newestTimestamp : null
      };
    } catch (error: unknown) {
      logger.error(`CACHE_DO_STATS_ERROR`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Check if DO cache is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.call('health');
      return result?.healthy === true;
    } catch (error: unknown) {
      logger.error(`CACHE_DO_HEALTH_ERROR`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Build namespaced key
   */
  private buildKey(key: string, config: DualCacheConfig): string {
    return config.namespace ? `${config.namespace}:${key}` : key;
  }

  // ============ Compatibility Methods ============

  async getL1Stats() {
    const stats = await this.getStats();
    const hits = stats?.l1Hits ?? 0;
    const misses = stats?.misses ?? 0;
    const total = hits + misses;
    const hitRate = total > 0 ? hits / total : 0;

    return {
      hits,
      misses,
      currentSize: stats?.l1Size ?? 0,
      hitRate,
      evictions: stats?.evictions ?? 0,
      oldestEntry: stats?.oldestEntryAge ?? null,
      newestEntry: stats?.newestEntryAge ?? null,
      memoryUsage: 0
    };
  }
  async getL1DetailedInfo() { 
    const stats = await this.getStats();
    return {
      currentMemoryMB: 0,
      entries: [],
      averageAge: 0,
      hitRate: stats?.l1HitRate ?? 0,
      evictionRate: 0
    }; 
  }
  getPromotionStats() { 
    return { totalPromotions: 0, successfulPromotions: 0, failedPromotions: 0, promotionRate: 0, averagePromotionTime: 0 }; 
  }
  getPerformanceTrends() { 
    return { hitRateTrend: [], responseTimeTrend: [], memoryUsageTrend: [], evictionRateTrend: [] }; 
  }
  getAccessPatterns() { return []; }
  isPromotionEnabled() { return false; }
  getTimestampInfo(_ns: string, _key: string) { return null; }
  getDeduplicationStats() { 
    return { 
      totalRequests: 0, deduplicatedRequests: 0, cacheHits: 0, pendingRequests: 0, 
      timeoutRequests: 0, deduplicationRate: 0, averageResponseTime: 0, memoryUsage: 0 
    }; 
  }
  getDeduplicationCacheInfo() { return {}; }
  getDeduplicationPendingRequests() { return []; }
  getAllEnhancedConfigs() { return { namespaces: [], defaults: { ttl: 3600 } }; }
  getConfigurationSummary() { return { enabled: true, architecture: 'DO-only', environment: 'production' }; }
  async getMetadata(_config?: DualCacheConfig) { return {}; }
  async performHealthAssessment() {
    const healthy = await this.healthCheck();
    const stats = await this.getStats();
    const assessment = {
      status: healthy ? 'healthy' : 'error',
      overallScore: healthy ? 100 : 0,
      l1Metrics: {
        enabled: true,
        isHealthy: healthy,
        totalEntries: stats?.l1Size ?? 0,
        hitRate: stats?.l1HitRate ?? 0,
        memoryUsage: 0
      },
      l2Metrics: { enabled: false },
      issues: healthy ? [] : ['Durable Object cache is not responding'],
      recommendations: healthy ? [] : ['Verify CACHE_DO binding and Durable Object deployment']
    };
    return { status: assessment.status, overallScore: assessment.overallScore, assessment };
  }
  async getSystemStatus() {
    const healthy = await this.healthCheck();
    const stats = await this.getStats();
    return {
      status: healthy ? 'operational' : 'error',
      enabled: true,
      architecture: 'Durable Objects',
      l1Cache: {
        enabled: true,
        type: 'persistent-in-memory',
        status: healthy ? 'healthy' : 'error',
        size: stats?.l1Size ?? 0,
        hitRate: stats?.l1HitRate ?? 0
      },
      l2Cache: { enabled: false, type: 'kv', status: 'disabled' }
    };
  }
  async setWithNamespace(ns: string, key: string, value: any, ttl?: number) {
    return this.set(key, value, { ttl: ttl || 3600, namespace: ns });
  }
  async getWithNamespace(ns: string, key: string) {
    return this.get(key, { ttl: 3600, namespace: ns });
  }
}

/**
 * Check if DO cache is enabled
 * Returns true if FEATURE_FLAG_DO_CACHE=true and CACHE_DO binding exists
 */
export function isDOCacheEnabled(env: any): boolean {
  return env?.FEATURE_FLAG_DO_CACHE === 'true' && env?.CACHE_DO !== undefined;
}

/**
 * Factory function to create cache instances
 * Returns DO cache if available, null otherwise
 */
export function createCacheInstance(env: any, useDO: boolean = true): CacheDO<any> | null {
  if (useDO && env?.CACHE_DO) {
    logger.info(`CACHE_FACTORY: Using Durable Objects cache`);
    return new CacheDO(env.CACHE_DO);
  }

  logger.info(`CACHE_FACTORY: No cache (DO binding not available)`);
  return null;
}
