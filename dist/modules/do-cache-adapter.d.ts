export interface SectorData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    marketCap?: number;
    timestamp: string;
}
/**
 * DO Cache Adapter - Drop-in replacement for CacheManager
 * Maintains API compatibility while using DO cache internally
 */
export declare class DOCacheAdapter {
    private doCache;
    private enabled;
    constructor(env: any, options?: {
        enabled?: boolean;
    });
    /**
     * Get value from cache with namespace support
     */
    get<T>(namespace: string, key: string, ttl?: number): Promise<T | null>;
    /**
     * Set value in cache with namespace support
     */
    set<T>(namespace: string, key: string, value: T, ttl?: number): Promise<void>;
    /**
     * Get with stale-while-revalidate support
     */
    getWithStaleRevalidate<T>(namespace: string, key: string, revalidateFn?: () => Promise<T | null>, ttl?: number): Promise<{
        data: T | null;
        isStale: boolean;
        metadata?: any;
    }>;
    /**
     * Delete key from cache
     */
    delete(namespace: string, key: string): Promise<void>;
    /**
     * Clear namespace or entire cache
     */
    clear(namespace?: string): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): Promise<any>;
    /**
     * Health check
     */
    healthCheck(): Promise<boolean>;
    /**
     * Get health assessment (compatibility with enhanced cache routes)
     */
    performHealthAssessment(): Promise<any>;
    /**
     * Check if cache is enabled
     */
    isEnabled(): boolean;
    /**
     * Get configuration summary
     */
    getConfigurationSummary(): any;
    /**
     * Compatibility methods for existing cache manager API
     */
    getL1Stats(): any;
    getL1DetailedInfo(): any;
    getL2Stats(): any;
    getPromotionStats(): any;
    isPromotionEnabled(): boolean;
    getPerformanceTrends(): any;
    getAccessPatterns(): any;
    getSystemStatus(): Promise<any>;
    getTimestampInfo(namespace: string, key: string): any;
    getDeduplicationStats(): any;
    getDeduplicationCacheInfo(): any;
    getDeduplicationPendingRequests(): any;
    getAllEnhancedConfigs(): any;
    setWithNamespace(namespace: string, key: string, value: any, ttl?: number): Promise<void>;
    getWithNamespace(namespace: string, key: string): Promise<any>;
    forceRefresh(namespace: string, key: string): Promise<void>;
}
/**
 * Factory function to create DO cache adapter
 * Drop-in replacement for createCacheManager
 */
export declare function createDOCacheAdapter(env: any, options?: {
    enabled?: boolean;
}): DOCacheAdapter;
/**
 * Sector-specific DO cache adapter
 * Replaces SectorCacheManager
 */
export declare class DOSectorCacheAdapter extends DOCacheAdapter {
    constructor(env: any);
    /**
     * Get sector data with typed interface
     */
    getSectorData(symbol: string): Promise<any>;
    /**
     * Set sector data with typed interface
     */
    setSectorData(symbol: string, data: any): Promise<void>;
    /**
     * Get sector snapshot
     */
    getSectorSnapshot(): Promise<any>;
    /**
     * Set sector snapshot
     */
    setSectorSnapshot(data: any): Promise<void>;
}
/**
 * Market drivers specific DO cache adapter
 * Replaces MarketDriversCacheManager
 */
export declare class DOMarketDriversCacheAdapter extends DOCacheAdapter {
    constructor(env: any);
    /**
     * Get market drivers data
     */
    getMarketDrivers(): Promise<any>;
    /**
     * Set market drivers data
     */
    setMarketDrivers(data: any): Promise<void>;
    /**
     * Get FRED data
     */
    getFredData(indicator: string): Promise<any>;
    /**
     * Set FRED data
     */
    setFredData(indicator: string, data: any): Promise<void>;
}
/**
 * Backtesting specific DO cache adapter
 * Replaces BacktestingCacheManager
 */
export declare class DOBacktestingCacheAdapter extends DOCacheAdapter {
    constructor(env: any);
    /**
     * Get backtest results
     */
    getBacktestResults(strategyId: string): Promise<any>;
    /**
     * Set backtest results
     */
    setBacktestResults(strategyId: string, results: any): Promise<void>;
    /**
     * Get historical data
     */
    getHistoricalData(symbol: string, period: string): Promise<any>;
    /**
     * Set historical data
     */
    setHistoricalData(symbol: string, period: string, data: any): Promise<void>;
}
export default DOCacheAdapter;
//# sourceMappingURL=do-cache-adapter.d.ts.map