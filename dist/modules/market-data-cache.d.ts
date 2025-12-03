/**
 * Market Data Caching System
 * Reduces Yahoo Finance API calls and improves performance
 */
interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    symbol: string;
}
interface CacheStats {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    hitRate: number;
    hits: number;
    misses: number;
}
interface MarketDataResponse {
    success: boolean;
    data?: {
        ohlcv?: Array<any>;
    };
    [key: string]: any;
}
/**
 * In-memory cache for market data
 * Cache TTL: 5 minutes for real-time trading
 */
declare class MarketDataCache<T = any> {
    private cache;
    private ttlMs;
    private hitCount;
    private missCount;
    constructor(ttlMs?: number);
    /**
     * Generate cache key for symbol and timeframe
     */
    private getCacheKey;
    /**
     * Check if cached data is still valid
     */
    private isValid;
    /**
     * Get cached market data if available and valid
     */
    get(symbol: string, days?: number): T | null;
    /**
     * Store market data in cache
     */
    set(symbol: string, data: T, days?: number): void;
    /**
     * Clear expired entries from cache
     */
    cleanup(): number;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Get hit count (for external tracking)
     */
    getHitCount(): number;
    /**
     * Get miss count (for external tracking)
     */
    getMissCount(): number;
    /**
     * Increment hit count
     */
    incrementHitCount(): void;
    /**
     * Increment miss count
     */
    incrementMissCount(): void;
}
declare const globalMarketDataCache: MarketDataCache<MarketDataResponse>;
/**
 * Get cached market data or return null
 */
export declare function getCachedMarketData(symbol: string, days?: number): MarketDataResponse | null;
/**
 * Cache market data for future use
 */
export declare function cacheMarketData(symbol: string, data: MarketDataResponse, days?: number): void;
/**
 * Get cache statistics
 */
export declare function getCacheStats(): CacheStats;
/**
 * Clean up expired cache entries
 */
export declare function cleanupCache(): number;
/**
 * Clear all cached data
 */
export declare function clearCache(): void;
/**
 * Cached market data wrapper with automatic cleanup
 */
export declare function withCache<T extends MarketDataResponse>(symbol: string, fetchFunction: () => Promise<T>, days?: number): Promise<T>;
/**
 * Create a new cache instance with custom TTL
 */
export declare function createMarketDataCache<T = MarketDataResponse>(ttlMs?: number): MarketDataCache<T>;
export { globalMarketDataCache };
export type { CacheEntry, CacheStats, MarketDataResponse };
declare const _default: {
    getCachedMarketData: typeof getCachedMarketData;
    cacheMarketData: typeof cacheMarketData;
    getCacheStats: typeof getCacheStats;
    cleanupCache: typeof cleanupCache;
    clearCache: typeof clearCache;
    withCache: typeof withCache;
    createMarketDataCache: typeof createMarketDataCache;
    globalMarketDataCache: MarketDataCache<MarketDataResponse>;
};
export default _default;
//# sourceMappingURL=market-data-cache.d.ts.map