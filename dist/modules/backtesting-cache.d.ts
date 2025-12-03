/**
 * Cache configuration for different backtesting data types
 */
export declare const BACKTEST_CACHE_CONFIG: {
    readonly MARKET_DATA: {
        readonly ttl: 3600;
        readonly maxSize: 100;
        readonly keyPrefix: "market_data";
    };
    readonly CALCULATION_RESULTS: {
        readonly ttl: 86400;
        readonly maxSize: 200;
        readonly keyPrefix: "calc_results";
    };
    readonly PERFORMANCE_METRICS: {
        readonly ttl: 604800;
        readonly maxSize: 500;
        readonly keyPrefix: "perf_metrics";
    };
    readonly VALIDATION_RESULTS: {
        readonly ttl: 86400;
        readonly maxSize: 100;
        readonly keyPrefix: "validation";
    };
    readonly INTERMEDIATE_RESULTS: {
        readonly ttl: 1800;
        readonly maxSize: 50;
        readonly keyPrefix: "intermediate";
    };
    readonly CONFIG_HASHES: {
        readonly ttl: 2592000;
        readonly maxSize: 1000;
        readonly keyPrefix: "config_hash";
    };
};
export type BacktestCacheType = keyof typeof BACKTEST_CACHE_CONFIG;
interface DateRange {
    start: string;
    end: string;
}
type AnyParams = Record<string, any>;
interface CacheEntry<T = any> {
    data: T;
    cachedAt: string;
    type: BacktestCacheType;
    identifier: string;
    params: AnyParams;
    ttl: number | null;
    version: string;
}
/**
 * Backtesting Cache Manager
 */
export declare class BacktestingCacheManager {
    private env;
    private cacheStats;
    constructor(env: any);
    /**
     * Generate cache key for backtesting data
     */
    generateCacheKey(type: BacktestCacheType, identifier: string, params?: AnyParams): string;
    /**
     * Get cached data
     */
    get<T = any>(type: BacktestCacheType, identifier: string, params?: AnyParams): Promise<T | null>;
    /**
     * Set cached data
     */
    set<T = any>(type: BacktestCacheType, identifier: string, data: T, params?: AnyParams, customTTL?: number | null): Promise<CacheEntry<T>>;
    /**
     * Delete cached data
     */
    delete(type: BacktestCacheType, identifier: string, params?: AnyParams): Promise<void>;
    /**
     * Clear all cache for a specific type
     */
    clearType(type: BacktestCacheType): Promise<void>;
    /**
     * Get or set pattern (cache-aside)
     */
    getOrSet<T = any>(type: BacktestCacheType, identifier: string, factory: (params: AnyParams) => Promise<T>, params?: AnyParams, customTTL?: number | null): Promise<T>;
    /**
     * Cache market data for backtesting
     */
    cacheMarketData(symbols: string[], startDate: string, endDate: string, marketData: any[]): Promise<CacheEntry<any[]>>;
    /**
     * Get cached market data
     */
    getCachedMarketData(symbols: string[], startDate: string, endDate: string): Promise<any>;
    /**
     * Cache calculation results
     */
    cacheCalculationResult(configHash: string, calculationType: string, results: any): Promise<CacheEntry<any>>;
    /**
     * Get cached calculation results
     */
    getCachedCalculationResult(configHash: string, calculationType: string): Promise<any>;
    /**
     * Cache performance metrics
     */
    cachePerformanceMetrics(runId: string, metrics: any): Promise<CacheEntry<any>>;
    /**
     * Get cached performance metrics
     */
    getCachedPerformanceMetrics(runId: string): Promise<any>;
    /**
     * Cache validation results
     */
    cacheValidationResults(validationId: string, results: any): Promise<CacheEntry<any>>;
    /**
     * Get cached validation results
     */
    getCachedValidationResults(validationId: string): Promise<any>;
    /**
     * Cache intermediate computation results
     */
    cacheIntermediateResult(computationId: string, step: string, results: any): Promise<CacheEntry<any>>;
    /**
     * Get cached intermediate results
     */
    getCachedIntermediateResult(computationId: string, step: string): Promise<any>;
    /**
     * Generate and cache configuration hash
     */
    getConfigHash(config: AnyParams): Promise<string>;
    /**
     * Check if configuration has been used before
     */
    hasConfigurationBeenUsed(config: AnyParams): Promise<boolean>;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        hitRate: string;
        totalOperations: any;
        hits: number;
        misses: number;
        sets: number;
        deletes: number;
        evictions: number;
    };
    /**
     * Reset cache statistics
     */
    resetStats(): void;
    /**
     * Warm up cache with common data
     */
    warmupCache(symbols: string[][], dateRanges: DateRange[]): Promise<void>;
    /**
     * Invalidate cache for specific symbols or date ranges
     */
    invalidateCache(symbols?: string[][], dateRanges?: DateRange[]): Promise<number>;
    /**
     * Get cache size information
     */
    getCacheSize(): Promise<Record<string, any>>;
    /**
     * Hash parameters for cache key generation
     * @private
     */
    _hashParams(params: AnyParams): string;
    /**
     * Simple string hash function
     * @private
     */
    _hashString(str: string): string;
    /**
     * Calculate days between two dates
     * @private
     */
    _calculateDaysBetween(startDate: string, endDate: string): number;
    /**
     * Get and cache market data (helper method)
     * @private
     */
    _getAndCacheMarketData(symbols: string[], startDate: string, endDate: string): Promise<any>;
    /**
     * Evict old cache entries if needed
     * @private
     */
    _evictIfNeeded(type: BacktestCacheType): Promise<void>;
}
/**
 * Factory function for creating cache manager instances
 */
export declare function createBacktestingCache(env: any): any;
/**
 * Utility functions for backtesting cache
 */
export declare function getCachedBacktestResults(env: any, runId: string): Promise<any>;
export declare function setCachedBacktestResults(env: any, runId: string, results: any): Promise<any>;
export declare function getCachedMarketData(env: any, symbols: string[], startDate: string, endDate: string): Promise<any>;
export declare function setCachedMarketData(env: any, symbols: string[], startDate: string, endDate: string, marketData: any[]): Promise<any>;
export {};
//# sourceMappingURL=backtesting-cache.d.ts.map