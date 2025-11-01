/**
 * Cache Abstraction Layer
 * Smart routing: DO Cache (primary) → KV (fallback)
 *
 * Purpose:
 * - Make DO cache the default for ALL cache operations
 * - Automatic fallback to KV if DO cache unavailable
 * - Single source of truth for cache routing logic
 * - Type-safe interface matching KV API
 */

import { DualCacheDO, isDOCacheEnabled } from './dual-cache-do.js';
import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('cache-abstraction');

/**
 * Cache write options
 */
export interface CacheWriteOptions {
  expirationTtl?: number; // TTL in seconds
  metadata?: Record<string, any>;
}

/**
 * Cache list options
 */
export interface CacheListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Cache list result
 */
export interface CacheListResult {
  keys: Array<{ name: string; expiration?: number; metadata?: any }>;
  list_complete: boolean;
  cursor?: string;
}

/**
 * Cache Abstraction Layer
 *
 * Provides unified interface for cache operations with smart routing:
 * 1. Check if DO cache is enabled (FEATURE_FLAG_DO_CACHE=true + CACHE_DO binding)
 * 2. If yes → Use DO cache (persistent memory, <1ms latency)
 * 3. If no → Fall back to KV (traditional storage, 10-50ms latency)
 *
 * Features:
 * - Zero breaking changes (same interface as KV)
 * - Automatic serialization/deserialization
 * - Comprehensive logging for observability
 * - Type-safe operations
 * - Graceful degradation
 */
export class CacheAbstraction {
  private doCache: DualCacheDO | null;
  private env: CloudflareEnvironment;
  private useDO: boolean;

  constructor(env: CloudflareEnvironment) {
    this.env = env;
    this.useDO = isDOCacheEnabled(env);

    if (this.useDO) {
      this.doCache = new DualCacheDO(env.CACHE_DO!);
      logger.info('CACHE_ABSTRACTION_INIT', 'Using DO cache (primary)');
    } else {
      this.doCache = null;
      logger.info('CACHE_ABSTRACTION_INIT', 'Using KV cache (fallback)');
    }
  }

  /**
   * Write value to cache
   * Routes to DO cache if enabled, otherwise KV
   */
  async put(key: string, value: any, options?: CacheWriteOptions): Promise<void> {
    const ttl = options?.expirationTtl || 3600;

    try {
      if (this.doCache) {
        // Primary: Use DO cache
        await this.doCache.set(key, value, { ttl });
        logger.debug('CACHE_PUT_DO', { key, ttl, source: 'do' });
      } else {
        // Fallback: Use KV
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        await this.env.TRADING_RESULTS.put(key, serialized, options);
        logger.debug('CACHE_PUT_KV', { key, ttl, source: 'kv' });
      }
    } catch (error) {
      logger.error('CACHE_PUT_ERROR', `Failed to write ${key}`, error);
      throw error;
    }
  }

  /**
   * Read value from cache
   * Routes to DO cache if enabled, otherwise KV
   */
  async get(key: string): Promise<any | null> {
    try {
      if (this.doCache) {
        // Primary: Use DO cache
        const value = await this.doCache.get(key, { ttl: 3600 });
        logger.debug('CACHE_GET_DO', { key, hit: value !== null, source: 'do' });
        return value;
      } else {
        // Fallback: Use KV
        const value = await this.env.TRADING_RESULTS.get(key);
        logger.debug('CACHE_GET_KV', { key, hit: value !== null, source: 'kv' });

        // Try to parse JSON, return as-is if not JSON
        if (value) {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return null;
      }
    } catch (error) {
      logger.error('CACHE_GET_ERROR', `Failed to read ${key}`, error);
      return null;
    }
  }

  /**
   * Delete value from cache
   * Routes to DO cache if enabled, otherwise KV
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.doCache) {
        // Primary: Use DO cache
        await this.doCache.delete(key, { ttl: 0 });
        logger.debug('CACHE_DELETE_DO', { key, source: 'do' });
      } else {
        // Fallback: Use KV
        await this.env.TRADING_RESULTS.delete(key);
        logger.debug('CACHE_DELETE_KV', { key, source: 'kv' });
      }
    } catch (error) {
      logger.error('CACHE_DELETE_ERROR', `Failed to delete ${key}`, error);
      throw error;
    }
  }

  /**
   * List keys in cache
   * Note: Only available for KV (DO cache doesn't support list operation)
   */
  async list(options?: CacheListOptions): Promise<CacheListResult> {
    try {
      if (this.doCache) {
        // DO cache doesn't support list - use KV fallback for this operation
        logger.warn('CACHE_LIST_WARNING', 'List operation not supported in DO cache, falling back to KV');
      }

      // Always use KV for list operations
      const result = await this.env.TRADING_RESULTS.list(options);
      logger.debug('CACHE_LIST_KV', {
        prefix: options?.prefix,
        count: result.keys.length,
        source: 'kv'
      });

      return result as CacheListResult;
    } catch (error) {
      logger.error('CACHE_LIST_ERROR', 'Failed to list keys', error);
      return { keys: [], list_complete: true };
    }
  }

  /**
   * Get cache source being used
   */
  getSource(): 'do' | 'kv' {
    return this.useDO ? 'do' : 'kv';
  }

  /**
   * Check if DO cache is active
   */
  isUsingDO(): boolean {
    return this.useDO;
  }

  /**
   * Get cache statistics (if DO cache is active)
   */
  async getStats(): Promise<any | null> {
    if (this.doCache) {
      try {
        return await this.doCache.getStats();
      } catch (error) {
        logger.error('CACHE_STATS_ERROR', 'Failed to get stats', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Clear all cache entries
   * Note: Only works with DO cache
   */
  async clear(): Promise<void> {
    if (this.doCache) {
      try {
        await this.doCache.clear();
        logger.info('CACHE_CLEAR_DO', 'All cache entries cleared');
      } catch (error) {
        logger.error('CACHE_CLEAR_ERROR', 'Failed to clear cache', error);
        throw error;
      }
    } else {
      logger.warn('CACHE_CLEAR_WARNING', 'Clear operation only supported with DO cache');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; source: 'do' | 'kv' }> {
    try {
      if (this.doCache) {
        const healthy = await this.doCache.healthCheck();
        return { healthy, source: 'do' };
      } else {
        // KV health check - try a simple get
        const testKey = '_health_check_' + Date.now();
        await this.env.TRADING_RESULTS.put(testKey, 'test', { expirationTtl: 60 });
        const value = await this.env.TRADING_RESULTS.get(testKey);
        await this.env.TRADING_RESULTS.delete(testKey);

        return { healthy: value === 'test', source: 'kv' };
      }
    } catch (error) {
      logger.error('CACHE_HEALTH_ERROR', 'Health check failed', error);
      return { healthy: false, source: this.useDO ? 'do' : 'kv' };
    }
  }
}

/**
 * Factory function to create cache abstraction instances
 * Replaces direct env.TRADING_RESULTS access
 */
export function createCache(env: CloudflareEnvironment): CacheAbstraction {
  return new CacheAbstraction(env);
}

/**
 * Helper: Check if cache operation should use DO
 * Useful for conditional logic in existing code
 */
export function shouldUseDOCache(env: CloudflareEnvironment): boolean {
  return isDOCacheEnabled(env);
}
