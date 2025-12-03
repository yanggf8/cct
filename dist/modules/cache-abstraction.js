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
const logger = createLogger('cache-abstraction');
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
    constructor(env) {
        this.env = env;
        this.useDO = isDOCacheEnabled(env);
        if (this.useDO) {
            this.doCache = new DualCacheDO(env.CACHE_DO);
            logger.info('CACHE_ABSTRACTION_INIT', { source: 'DO cache (primary)' });
        }
        else {
            this.doCache = null;
            logger.info('CACHE_ABSTRACTION_INIT', { source: 'KV cache (fallback)' });
        }
    }
    /**
     * Write value to cache
     * Routes to DO cache if enabled, otherwise KV
     */
    async put(key, value, options) {
        const ttl = options?.expirationTtl || 3600;
        try {
            if (this.doCache) {
                // Primary: Use DO cache
                await this.doCache.set(key, value, { ttl });
                logger.debug('CACHE_PUT_DO', { key, ttl, source: 'do' });
            }
            else {
                // Fallback: Use KV
                const serialized = typeof value === 'string' ? value : JSON.stringify(value);
                await this.env.MARKET_ANALYSIS_CACHE.put(key, serialized, options);
                logger.debug('CACHE_PUT_KV', { key, ttl, source: 'kv' });
            }
        }
        catch (error) {
            logger.error('CACHE_PUT_ERROR', { key, error: String(error) });
            throw error;
        }
    }
    /**
     * Read value from cache
     * Routes to DO cache if enabled, otherwise KV
     */
    async get(key) {
        try {
            if (this.doCache) {
                // Primary: Use DO cache
                const value = await this.doCache.get(key, { ttl: 3600 });
                logger.debug('CACHE_GET_DO', { key, hit: value !== null, source: 'do' });
                return value;
            }
            else {
                // Fallback: Use KV
                const value = await this.env.MARKET_ANALYSIS_CACHE.get(key);
                logger.debug('CACHE_GET_KV', { key, hit: value !== null, source: 'kv' });
                // Try to parse JSON, return as-is if not JSON
                if (value) {
                    try {
                        return JSON.parse(value);
                    }
                    catch {
                        return value;
                    }
                }
                return null;
            }
        }
        catch (error) {
            logger.error('CACHE_GET_ERROR', { key, error: String(error) });
            return null;
        }
    }
    /**
     * Delete value from cache
     * Routes to DO cache if enabled, otherwise KV
     */
    async delete(key) {
        try {
            if (this.doCache) {
                // Primary: Use DO cache
                await this.doCache.delete(key, { ttl: 0 });
                logger.debug('CACHE_DELETE_DO', { key, source: 'do' });
            }
            else {
                // Fallback: Use KV
                await this.env.MARKET_ANALYSIS_CACHE.delete(key);
                logger.debug('CACHE_DELETE_KV', { key, source: 'kv' });
            }
        }
        catch (error) {
            logger.error('CACHE_DELETE_ERROR', { key, error: String(error) });
            throw error;
        }
    }
    /**
     * List keys in cache
     * Note: Only available for KV (DO cache doesn't support list operation)
     */
    async list(options) {
        try {
            if (this.doCache) {
                // DO cache doesn't support list - use KV fallback for this operation
                logger.warn('CACHE_LIST_WARNING', { message: 'List operation not supported in DO cache, falling back to KV' });
            }
            // Always use KV for list operations
            const result = await this.env.MARKET_ANALYSIS_CACHE.list(options);
            logger.debug('CACHE_LIST_KV', {
                prefix: options?.prefix,
                count: result.keys.length,
                source: 'kv'
            });
            return result;
        }
        catch (error) {
            logger.error('CACHE_LIST_ERROR', { error: String(error) });
            return { keys: [], list_complete: true };
        }
    }
    /**
     * Get cache source being used
     */
    getSource() {
        return this.useDO ? 'do' : 'kv';
    }
    /**
     * Check if DO cache is active
     */
    isUsingDO() {
        return this.useDO;
    }
    /**
     * Get cache statistics (if DO cache is active)
     */
    async getStats() {
        if (this.doCache) {
            try {
                return await this.doCache.getStats();
            }
            catch (error) {
                logger.error('CACHE_STATS_ERROR', { error: String(error) });
                return null;
            }
        }
        return null;
    }
    /**
     * Clear all cache entries
     * Note: Only works with DO cache
     */
    async clear() {
        if (this.doCache) {
            try {
                await this.doCache.clear();
                logger.info('CACHE_CLEAR_DO', { message: 'All cache entries cleared' });
            }
            catch (error) {
                logger.error('CACHE_CLEAR_ERROR', { error: String(error) });
                throw error;
            }
        }
        else {
            logger.warn('CACHE_CLEAR_WARNING', { message: 'Clear operation only supported with DO cache' });
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            if (this.doCache) {
                const healthy = await this.doCache.healthCheck();
                return { healthy, source: 'do' };
            }
            else {
                // KV health check - try a simple get
                const testKey = '_health_check_' + Date.now();
                await this.env.MARKET_ANALYSIS_CACHE.put(testKey, 'test', { expirationTtl: 60 });
                const value = await this.env.MARKET_ANALYSIS_CACHE.get(testKey);
                await this.env.MARKET_ANALYSIS_CACHE.delete(testKey);
                return { healthy: value === 'test', source: 'kv' };
            }
        }
        catch (error) {
            logger.error('CACHE_HEALTH_ERROR', { error: String(error) });
            return { healthy: false, source: this.useDO ? 'do' : 'kv' };
        }
    }
}
/**
 * Factory function to create cache abstraction instances
 * Replaces direct env.MARKET_ANALYSIS_CACHE access
 */
export function createCache(env) {
    return new CacheAbstraction(env);
}
/**
 * Helper: Check if cache operation should use DO
 * Useful for conditional logic in existing code
 */
export function shouldUseDOCache(env) {
    return isDOCacheEnabled(env);
}
//# sourceMappingURL=cache-abstraction.js.map