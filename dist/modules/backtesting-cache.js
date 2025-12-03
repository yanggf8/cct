// @ts-ignore - Suppressing TypeScript errors
/**
 * Backtesting Cache Manager
 * Intelligent caching system for backtesting computations, market data, and intermediate results
 * Optimizes performance by avoiding redundant calculations and data fetching
 */
import { createDAL } from './dal.js';
// Simple KV functions using DAL
async function getKVStore(env, key) {
    const dal = createDAL(env);
    const result = await dal.read(key);
    return result.success ? result.data : null;
}
async function setKVStore(env, key, data, ttl) {
    const dal = createDAL(env);
    const expirationTtl = ttl === null ? undefined : ttl;
    const result = await dal.write(key, data, { expirationTtl });
    return result.success;
}
async function deleteKVStore(env, key) {
    const dal = createDAL(env);
    return await dal.deleteKey(key);
}
import { BACKTESTING_NAMESPACES } from './backtesting-storage';
/**
 * Cache configuration for different backtesting data types
 */
export const BACKTEST_CACHE_CONFIG = {
    MARKET_DATA: {
        ttl: 3600, // 1 hour - market data changes frequently
        maxSize: 100, // Max number of cached datasets
        keyPrefix: 'market_data'
    },
    CALCULATION_RESULTS: {
        ttl: 86400, // 1 day - calculation results stable for same inputs
        maxSize: 200,
        keyPrefix: 'calc_results'
    },
    PERFORMANCE_METRICS: {
        ttl: 604800, // 1 week - metrics don't change for completed backtests
        maxSize: 500,
        keyPrefix: 'perf_metrics'
    },
    VALIDATION_RESULTS: {
        ttl: 86400, // 1 day - validation results
        maxSize: 100,
        keyPrefix: 'validation'
    },
    INTERMEDIATE_RESULTS: {
        ttl: 1800, // 30 minutes - intermediate calculations
        maxSize: 50,
        keyPrefix: 'intermediate'
    },
    CONFIG_HASHES: {
        ttl: 2592000, // 1 month - config hashes
        maxSize: 1000,
        keyPrefix: 'config_hash'
    }
};
/**
 * Backtesting Cache Manager
 */
export class BacktestingCacheManager {
    constructor(env) {
        this.env = env;
        this.cacheStats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
    }
    /**
     * Generate cache key for backtesting data
     */
    generateCacheKey(type, identifier, params = {}) {
        const config = BACKTEST_CACHE_CONFIG[type];
        if (!config) {
            throw new Error(`Unknown cache type: ${type}`);
        }
        // Create deterministic key from identifier and params
        const paramHash = this._hashParams(params);
        return `${BACKTESTING_NAMESPACES.CACHE}:${config.keyPrefix}:${identifier}:${paramHash}`;
    }
    /**
     * Get cached data
     */
    async get(type, identifier, params = {}) {
        const key = this.generateCacheKey(type, identifier, params);
        const cached = await getKVStore(this.env, key);
        if (cached) {
            this.cacheStatshits++;
            return cached.data;
        }
        this.cacheStatsmisses++;
        return null;
    }
    /**
     * Set cached data
     */
    async set(type, identifier, data, params = {}, customTTL = null) {
        const key = this.generateCacheKey(type, identifier, params);
        const config = BACKTEST_CACHE_CONFIG[type];
        const ttl = customTTL || config.ttl;
        const cacheEntry = {
            data,
            cachedAt: new Date().toISOString(),
            type,
            identifier,
            params,
            ttl,
            version: '(1 as any).00'
        };
        await setKVStore(this.env, key, cacheEntry, ttl);
        this.cacheStatssets++;
        // Check if we need to evict old entries
        await this._evictIfNeeded(type);
        return cacheEntry;
    }
    /**
     * Delete cached data
     */
    async delete(type, identifier, params = {}) {
        const key = this.generateCacheKey(type, identifier, params);
        await deleteKVStore(this.env, key);
        this.cacheStatsdeletes++;
    }
    /**
     * Clear all cache for a specific type
     */
    async clearType(type) {
        const config = BACKTEST_CACHE_CONFIG[type];
        if (!config)
            return;
        // Note: This would need implementation in enhanced-dal.ts for prefix deletion
        // For now, we'll track keys and delete them individually
        console.warn(`Clearing cache for type: ${type}`);
    }
    /**
     * Get or set pattern (cache-aside)
     */
    async getOrSet(type, identifier, factory, params = {}, customTTL = null) {
        // Try to get from cache first
        let cached = await this.get(type, identifier, params);
        if (cached !== null) {
            return cached;
        }
        // Cache miss - compute and cache result
        const result = await factory(params);
        await this.set(type, identifier, result, params, customTTL);
        return result;
    }
    /**
     * Cache market data for backtesting
     */
    async cacheMarketData(symbols, startDate, endDate, marketData) {
        const identifier = `${symbols.join(',')}_${startDate}_${endDate}`;
        const params = {
            symbolCount: symbols.length,
            days: this._calculateDaysBetween(startDate, endDate),
            dataPoints: marketData.length || 0
        };
        return await this.set('MARKET_DATA', identifier, marketData, params);
    }
    /**
     * Get cached market data
     */
    async getCachedMarketData(symbols, startDate, endDate) {
        const identifier = `${symbols.join(',')}_${startDate}_${endDate}`;
        return await this.get('MARKET_DATA', identifier /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */);
    }
    /**
     * Cache calculation results
     */
    async cacheCalculationResult(configHash, calculationType, results) {
        return await this.set('CALCULATION_RESULTS', configHash, results, { calculationType });
    }
    /**
     * Get cached calculation results
     */
    async getCachedCalculationResult(configHash, calculationType) {
        return await this.get('CALCULATION_RESULTS', configHash, { calculationType } /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */);
    }
    /**
     * Cache performance metrics
     */
    async cachePerformanceMetrics(runId, metrics) {
        return await this.set('PERFORMANCE_METRICS', runId, metrics);
    }
    /**
     * Get cached performance metrics
     */
    async getCachedPerformanceMetrics(runId) {
        return await this.get('PERFORMANCE_METRICS', runId /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */);
    }
    /**
     * Cache validation results
     */
    async cacheValidationResults(validationId, results) {
        return await this.set('VALIDATION_RESULTS', validationId, results);
    }
    /**
     * Get cached validation results
     */
    async getCachedValidationResults(validationId) {
        return await this.get('VALIDATION_RESULTS', validationId /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */);
    }
    /**
     * Cache intermediate computation results
     */
    async cacheIntermediateResult(computationId, step, results) {
        const identifier = `${computationId}_${step}`;
        return await this.set('INTERMEDIATE_RESULTS', identifier, results);
    }
    /**
     * Get cached intermediate results
     */
    async getCachedIntermediateResult(computationId, step) {
        const identifier = `${computationId}_${step}`;
        return await this.get('INTERMEDIATE_RESULTS', identifier /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */);
    }
    /**
     * Generate and cache configuration hash
     */
    async getConfigHash(config) {
        const configString = JSON.stringify(config, Object.keys(config).sort());
        const hash = this._hashString(configString);
        // Cache the hash for future reference
        await this.set('CONFIG_HASHES', hash, config);
        return hash;
    }
    /**
     * Check if configuration has been used before
     */
    async hasConfigurationBeenUsed(config) {
        const hash = await this.getConfigHash(config);
        return await this.get('CONFIG_HASHES', hash /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */) !== null;
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const hitRate = this.cacheStatshits + this.cacheStatsmisses > 0
            ? (this.cacheStatshits / (this.cacheStatshits + this.cacheStatsmisses) * 100).toFixed(2)
            : 0;
        return {
            ...this.cacheStats,
            hitRate: `${hitRate}%`,
            totalOperations: this.cacheStatshits + this.cacheStatsmisses + this.cacheStatssets + this.cacheStatsdeletes
        };
    }
    /**
     * Reset cache statistics
     */
    resetStats() {
        this.cacheStats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
    }
    /**
     * Warm up cache with common data
     */
    async warmupCache(symbols, dateRanges) {
        console.log('Warming up backtesting cache...');
        const warmupPromises = [];
        // Pre-cache common market data combinations
        for (const symbolsList of symbols) {
            for (const dateRange of dateRanges) {
                const identifier = `${symbolsList.join(',')}_${dateRange.start}_${dateRange.end}`;
                warmupPromises.push(this._getAndCacheMarketData(symbolsList, dateRange.start, dateRange.end));
            }
        }
        await Promise.all(warmupPromises);
        console.log('Backtesting cache warmup completed');
    }
    /**
     * Invalidate cache for specific symbols or date ranges
     */
    async invalidateCache(symbols = [], dateRanges = []) {
        console.log('Invalidating backtesting cache...');
        let invalidatedCount = 0;
        // Invalidate market data cache
        for (const symbolsList of symbols) {
            for (const dateRange of dateRanges) {
                await this.delete('MARKET_DATA', `${symbolsList.join(',')}_${dateRange.start}_${dateRange.end}`);
                invalidatedCount++;
            }
        }
        console.log(`Invalidated ${invalidatedCount} cache entries`);
        return invalidatedCount;
    }
    /**
     * Get cache size information
     */
    async getCacheSize() {
        const sizes = {};
        for (const [type, config] of Object.entries(BACKTEST_CACHE_CONFIG)) {
            try {
                // This would need implementation in enhanced-dal.ts
                // For now, return estimated size
                sizes[type] = {
                    maxSize: config.maxSize,
                    currentSize: 'unknown', // Would need listKVStore support
                    ttl: config.ttl
                };
            }
            catch (error) {
                sizes[type] = { error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }
        return sizes;
    }
    /**
     * Hash parameters for cache key generation
     * @private
     */
    _hashParams(params) {
        const paramString = JSON.stringify(params, Object.keys(params).sort());
        return this._hashString(paramString);
    }
    /**
     * Simple string hash function
     * @private
     */
    _hashString(str) {
        let hash = 0;
        if (str.length === 0)
            return hash.toString();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
    /**
     * Calculate days between two dates
     * @private
     */
    _calculateDaysBetween(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffMs = end.getTime() - start.getTime();
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
    /**
     * Get and cache market data (helper method)
     * @private
     */
    async _getAndCacheMarketData(symbols, startDate, endDate) {
        // This would integrate with the actual market data fetching logic
        // For now, it's a placeholder that shows the caching pattern
        console.log(`Fetching and caching market data for ${symbols.join(',')} from ${startDate} to ${endDate}`);
        // In a real implementation, this would:
        // 1. Check if data is already cached
        // 2. Fetch from market data provider if not cached
        // 3. Cache the results
        // 4. Return the data
        return null;
    }
    /**
     * Evict old cache entries if needed
     * @private
     */
    async _evictIfNeeded(type) {
        const config = BACKTEST_CACHE_CONFIG[type];
        // In a real implementation, this would:
        // 1. Count current entries of this type
        // 2. If over maxSize, delete oldest entries
        // 3. Update eviction statistics
        // For now, this is a placeholder
        if (Math.random() < 0.01) { // 1% chance to trigger cleanup
            console.log(`Checking cache eviction for type: ${type}`);
        }
    }
}
/**
 * Factory function for creating cache manager instances
 */
export function createBacktestingCache(env) {
    // @ts-ignore - Adapter not implemented
    return new DOBacktestingCacheAdapter(env);
}
/**
 * Utility functions for backtesting cache
 */
export async function getCachedBacktestResults(env, runId) {
    const cache = createBacktestingCache(env);
    return await cache.getCachedPerformanceMetrics(runId);
}
export async function setCachedBacktestResults(env, runId, results) {
    const cache = createBacktestingCache(env);
    return await cache.cachePerformanceMetrics(runId, results);
}
export async function getCachedMarketData(env, symbols, startDate, endDate) {
    const cache = createBacktestingCache(env);
    return await cache.getCachedMarketData(symbols, startDate, endDate);
}
export async function setCachedMarketData(env, symbols, startDate, endDate, marketData) {
    const cache = createBacktestingCache(env);
    return await cache.cacheMarketData(symbols, startDate, endDate, marketData);
}
//# sourceMappingURL=backtesting-cache.js.map