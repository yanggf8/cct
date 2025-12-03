/**
 * Cache configuration for Durable Objects
 */
export interface DualCacheConfig {
    ttl: number;
    staleWhileRevalidate?: number;
    namespace?: string;
}
/**
 * Cache metadata for debugging and monitoring
 */
export interface CacheMetadata {
    cachedAt: string;
    expiresAt: string;
    lastAccessed: string;
    age: number;
    ttl: number;
    cacheSource: 'l1';
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
export declare class DualCacheDO<T = any> {
    private doNamespace;
    l1Cache: any;
    constructor(doNamespace: DurableObjectNamespace);
    /**
     * Get Durable Object stub
     * Uses named ID for singleton instance
     */
    private getStub;
    /**
     * Get value from DO cache
     */
    get(key: string, config: DualCacheConfig): Promise<T | null>;
    /**
     * Set value in DO cache
     */
    set(key: string, value: T, config: DualCacheConfig): Promise<void>;
    /**
     * Get value with stale-while-revalidate logic
     */
    getWithStaleRevalidate(key: string, config: DualCacheConfig, revalidateFn?: () => Promise<T | null>): Promise<{
        data: T | null;
        metadata: CacheMetadata | null;
        isStale: boolean;
    }>;
    /**
     * Delete key from cache
     */
    delete(key: string, config: DualCacheConfig): Promise<void>;
    /**
     * Clear all cache entries
     */
    clear(): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): Promise<any>;
    /**
     * Get cache metadata for debugging
     */
    getMetadata(config?: DualCacheConfig): Promise<{
        [key: string]: any;
    }>;
    /**
     * Build namespaced key
     */
    private buildKey;
    /**
     * Check if DO cache is available
     */
    healthCheck(): Promise<boolean>;
    /**
     * Perform comprehensive health assessment (compatibility with enhanced-cache-routes)
     */
    performHealthAssessment(): Promise<any>;
    /**
     * Get configuration summary (compatibility method)
     */
    getConfigurationSummary(): any;
    /**
     * Get all enhanced configurations (compatibility method)
     */
    getAllEnhancedConfigs(): any;
    /**
     * Get L1 statistics (compatibility method)
     */
    getL1Stats(): any;
    /**
     * Get detailed L1 information (compatibility method)
     */
    getL1DetailedInfo(): any;
    /**
     * Get promotion statistics (compatibility method)
     */
    getPromotionStats(): any;
    /**
     * Get performance trends (compatibility method)
     */
    getPerformanceTrends(): any;
    /**
     * Get access patterns (compatibility method)
     */
    getAccessPatterns(): any;
    /**
     * Check if promotion is enabled (compatibility method)
     */
    isPromotionEnabled(): boolean;
    /**
     * Get system status (compatibility method)
     */
    getSystemStatus(): Promise<any>;
    /**
     * Get timestamp info (compatibility method)
     */
    getTimestampInfo(namespace: string, key: string): any;
    /**
     * Get deduplication statistics (compatibility method)
     */
    getDeduplicationStats(): any;
    /**
     * Get deduplication cache info (compatibility method)
     */
    getDeduplicationCacheInfo(): any;
    /**
     * Get deduplication pending requests (compatibility method)
     */
    getDeduplicationPendingRequests(): any;
    /**
     * Set value with namespace support (compatibility method)
     */
    setWithNamespace(namespace: string, key: string, value: any, ttl?: number): Promise<void>;
    /**
     * Get value with namespace support (compatibility method)
     */
    getWithNamespace(namespace: string, key: string): Promise<any>;
}
/**
 * Check if DO cache is enabled
 * Returns true if FEATURE_FLAG_DO_CACHE=true and CACHE_DO binding exists
 */
export declare function isDOCacheEnabled(env: any): boolean;
/**
 * Factory function to create cache instances
 * Returns DO cache if available, null otherwise
 */
export declare function createCacheInstance(env: any, useDO?: boolean): DualCacheDO<any> | null;
//# sourceMappingURL=dual-cache-do.d.ts.map