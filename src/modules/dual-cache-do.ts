// Durable Objects-Based Dual Cache (Replaces HashCache + KV)
// Eliminates ALL KV operations for cache (zero reads, zero writes)
// Provides persistent L1 cache that survives worker restarts

import { CacheDurableObject } from './cache-durable-object.js';
import { createLogger } from './logging.js';

const logger = createLogger('dual-cache-do');

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
export class DualCacheDO<T = any> {
  private doNamespace: DurableObjectNamespace;

  constructor(doNamespace: DurableObjectNamespace) {
    this.doNamespace = doNamespace;
  }

  /**
   * Get Durable Object stub
   * Uses named ID for singleton instance
   */
  private getStub(): DurableObjectStub {
    // Use named ID for global cache (single instance per account)
    const id = this.doNamespace.idFromName('global-cache');
    return this.doNamespace.get(id);
  }

  /**
   * Get value from DO cache
   */
  async get(key: string, config: DualCacheConfig): Promise<T | null> {
    try {
      const stub = this.getStub();
      const value = await (stub as any).get(this.buildKey(key, config));

      if (value !== null) {
        logger.info(`DUAL_CACHE_DO HIT: ${key}`);
      } else {
        logger.info(`DUAL_CACHE_DO MISS: ${key}`);
      }

      return value;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`DUAL_CACHE_DO_GET_ERROR: Failed to get ${key}`, { error: errorMsg });
      return null;
    }
  }

  /**
   * Set value in DO cache
   */
  async set(key: string, value: T, config: DualCacheConfig): Promise<void> {
    try {
      const stub = this.getStub();
      await (stub as any).set(this.buildKey(key, config), value, config.ttl);

      logger.debug(`DUAL_CACHE_DO SET: ${key} (TTL: ${config.ttl}s)`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`DUAL_CACHE_DO_SET_ERROR: Failed to set ${key}`, { error: errorMsg });
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
      const stub = this.getStub();
      const metadata = await (stub as any).getCacheMetadata();
      const fullKey = this.buildKey(key, config);
      const entryMeta = metadata[fullKey];

      // Get value
      const value = await this.get(key, config);

      if (value === null) {
        return { data: null, metadata: null, isStale: false };
      }

      // Check if stale
      let isStale = false;
      if (entryMeta && config.staleWhileRevalidate) {
        isStale = entryMeta.ttl < 0 && Math.abs(entryMeta.ttl) <= config.staleWhileRevalidate;
      }

      // Background refresh if stale and revalidate function provided
      if (isStale && revalidateFn) {
        logger.info(`DUAL_CACHE_DO_BACKGROUND_REFRESH: Refreshing stale key: ${key}`);

        // Don't await - fire and forget
        revalidateFn().then(newValue => {
          if (newValue !== null) {
            this.set(key, newValue, config);
          }
        }).catch((error: unknown) => {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`DUAL_CACHE_DO_REFRESH_ERROR: Background refresh failed for ${key}`, { error: errorMsg });
        });
      }

      const cacheMetadata: CacheMetadata = {
        ...entryMeta,
        cacheSource: 'l1'
      };

      return { data: value, metadata: cacheMetadata, isStale };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`DUAL_CACHE_DO_STALE_ERROR: Failed to get with stale revalidate: ${key}`, { error: errorMsg });
      return { data: null, metadata: null, isStale: false };
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string, config: DualCacheConfig): Promise<void> {
    try {
      const stub = this.getStub();
      await (stub as any).delete(this.buildKey(key, config));

      logger.debug(`DUAL_CACHE_DO DELETE: ${key}`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`DUAL_CACHE_DO_DELETE_ERROR: Failed to delete ${key}`, { error: errorMsg });
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const stub = this.getStub();
      await (stub as any).clear();

      logger.info(`DUAL_CACHE_DO: Cache cleared completely`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`DUAL_CACHE_DO_CLEAR_ERROR: Failed to clear cache`, { error: errorMsg });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      const stub = this.getStub();
      return await (stub as any).getStats();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`DUAL_CACHE_DO_STATS_ERROR: Failed to get stats`, { error: errorMsg });
      return null;
    }
  }

  /**
   * Get cache metadata for debugging
   */
  async getMetadata(config?: DualCacheConfig): Promise<{ [key: string]: any }> {
    try {
      const stub = this.getStub();
      const metadata = await (stub as any).getCacheMetadata();

      // Filter by namespace if specified
      if (config?.namespace) {
        const filtered: { [key: string]: any } = {};
        const prefix = `${config.namespace}:`;
        for (const [key, value] of Object.entries(metadata)) {
          if (key.startsWith(prefix)) {
            filtered[key] = value;
          }
        }
        return filtered;
      }

      return metadata;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`DUAL_CACHE_DO_METADATA_ERROR: Failed to get metadata`, { error: errorMsg });
      return {};
    }
  }

  /**
   * Build namespaced key
   */
  private buildKey(key: string, config: DualCacheConfig): string {
    return config.namespace ? `${config.namespace}:${key}` : key;
  }

  /**
   * Check if DO cache is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const stub = this.getStub();
      const stats = await (stub as any).getStats();
      return stats !== null;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`DUAL_CACHE_DO_HEALTH_ERROR: Health check failed`, { error: errorMsg });
      return false;
    }
  }
}

/**
 * Factory function to create cache instances
 * Used by routes to get the appropriate cache implementation
 */
export function createCacheInstance(env: any, useDO: boolean = true): any {
  if (useDO && env.CACHE_DO) {
    logger.info(`CACHE_FACTORY: Using Durable Objects cache`);
    return new DualCacheDO(env.CACHE_DO);
  } else {
    // Strict DO-only policy: no legacy cache fallback
    logger.info(`CACHE_FACTORY: No cache (DO disabled or unavailable)`);
    return null;
  }
}

/**
 * Feature flag checker
 */
export function isDOCacheEnabled(env: any): boolean {
  return !!(env && env.CACHE_DO);
}