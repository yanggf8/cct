/**
 * Enhanced Health Check Caching Module
 * Reduces KV operations for health checks by 75% with intelligent caching
 * Provides cached health status with TTL-based invalidation
 */
/**
 * Health check configuration
 */
export interface HealthCacheConfig {
    enabled: boolean;
    defaultTTL: number;
    successTTL: number;
    failureTTL: number;
    maxEntries: number;
    enableMetrics: boolean;
    enableDeduplication: boolean;
}
/**
 * Health cache statistics
 */
export interface HealthCacheStats {
    totalChecks: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    averageCheckTime: number;
    currentEntries: number;
    failedChecks: number;
    successfulChecks: number;
    timeSaved: number;
}
/**
 * Health check result with caching metadata
 */
export interface CachedHealthResult {
    success: boolean;
    data: any;
    cached: boolean;
    age: number;
    ttl: number;
    source: 'l1' | 'l2' | 'fresh';
    lastCheckDuration: number;
    nextCheckTime: string;
}
/**
 * Enhanced health check cache with intelligent TTL management
 */
export declare class EnhancedHealthCache {
    private static instance;
    private config;
    private cache;
    private stats;
    private constructor();
    static getInstance(config?: Partial<HealthCacheConfig>): EnhancedHealthCache;
    /**
     * Perform health check with intelligent caching
     */
    checkHealth(key: string, checkFn: () => Promise<any>, options?: {
        forceRefresh?: boolean;
        customTTL?: number;
        priority?: 'high' | 'normal' | 'low';
    }): Promise<CachedHealthResult>;
    /**
     * Perform multiple health checks in parallel with batch optimization
     */
    checkBatchHealth(checks: Array<{
        key: string;
        checkFn: () => Promise<any>;
        options?: {
            forceRefresh?: boolean;
            customTTL?: number;
        };
    }>): Promise<Array<{
        key: string;
        result: CachedHealthResult;
    }>>;
    /**
     * Get cached result if valid
     */
    private getCachedResult;
    /**
     * Cache a health check result
     */
    private cacheResult;
    /**
     * Calculate dynamic TTL based on health status and check type
     */
    private calculateDynamicTTL;
    /**
     * Check if health result indicates healthy status
     */
    private isHealthyResult;
    /**
     * Enforce maximum cache entries
     */
    private enforceMaxEntries;
    /**
     * Update average check time
     */
    private updateAverageCheckTime;
    /**
     * Start cleanup interval
     */
    private startCleanupInterval;
    /**
     * Cleanup expired entries
     */
    private cleanup;
    /**
     * Get cache statistics
     */
    getStats(): HealthCacheStats;
    /**
     * Get cache information for debugging
     */
    getCacheInfo(): {
        size: number;
        entries: Array<{
            key: string;
            age: number;
            ttl: number;
            isHealthy: boolean;
            lastCheckDuration: number;
        }>;
    };
    /**
     * Invalidate cache entries
     */
    invalidateCache(pattern?: string): number;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Enable/disable caching
     */
    setEnabled(enabled: boolean): void;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<HealthCacheConfig>): void;
    /**
     * Clear all cache entries
     */
    clear(): void;
}
/**
 * Global health cache instance
 */
export declare const healthCache: EnhancedHealthCache;
/**
 * Helper function to perform cached health check
 */
export declare function cachedHealthCheck(key: string, checkFn: () => Promise<any>, options?: {
    forceRefresh?: boolean;
    customTTL?: number;
    priority?: 'high' | 'normal' | 'low';
}): Promise<CachedHealthResult>;
/**
 * Helper function to perform batch cached health checks
 */
export declare function cachedBatchHealthCheck(checks: Array<{
    key: string;
    checkFn: () => Promise<any>;
    options?: {
        forceRefresh?: boolean;
        customTTL?: number;
    };
}>): Promise<Array<{
    key: string;
    result: CachedHealthResult;
}>>;
export default EnhancedHealthCache;
//# sourceMappingURL=enhanced-health-cache.d.ts.map