/**
 * Cache Manager Module - TypeScript
 * Multi-level caching system with L1 memory cache and L2 KV cache
 * Intelligent cache management with namespace-based organization
 * Phase 2: Enhanced Caching System - Data Access Improvement Plan
 */
import { type CacheTimestampInfo } from './enhanced-hash-cache.js';
import { type EnhancedCacheConfig } from './enhanced-cache-config.js';
import { type CacheHealthAssessment, type PerformanceThresholds } from './enhanced-cache-metrics.js';
export interface CacheLevelConfig {
    name: string;
    ttl: number;
    maxSize?: number;
    enabled: boolean;
}
export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
    hits: number;
    lastAccessed: number;
}
export interface CacheStats {
    totalRequests: number;
    l1Hits: number;
    l2Hits: number;
    misses: number;
    l1HitRate: number;
    l2HitRate: number;
    overallHitRate: number;
    l1Size: number;
    l2Size: number;
    evictions: number;
    errors: number;
}
export interface CacheResponse<T> {
    data: T | null;
    timestampInfo?: CacheTimestampInfo;
    source: 'l1' | 'l2' | 'fresh';
    hit: boolean;
}
export interface CacheNamespace {
    name: string;
    prefix: string;
    l1Config: CacheLevelConfig;
    l2Config: CacheLevelConfig;
    version: string;
}
/**
 * Cache Manager with L1 (memory) and L2 (KV) caching
 */
export declare class CacheManager {
    private dal;
    private keyFactory;
    private l1Cache;
    private l1MaxSize;
    private stats;
    private namespaces;
    private enabled;
    private promotionManager;
    private metricsManager;
    constructor(env: any, options?: {
        enabled?: boolean;
        environment?: 'development' | 'production' | 'test';
        enablePromotion?: boolean;
        enableMetrics?: boolean;
        metricsThresholds?: Partial<PerformanceThresholds>;
    });
    /**
     * Initialize enhanced cache namespaces with centralized configuration
     */
    private initializeEnhancedNamespaces;
    /**
     * Add a new cache namespace
     */
    addNamespace(namespace: CacheNamespace): void;
    /**
     * Get a value from cache (L1 first, then L2) with request deduplication
     */
    get<T>(namespace: string, key: string, fetchFn?: () => Promise<T>): Promise<T | null>;
    /**
     * Set a value in both L1 and L2 cache
     */
    set<T>(namespace: string, key: string, data: T, customTTL?: {
        l1?: number;
        l2?: number;
    }): Promise<void>;
    /**
     * Delete a value from both L1 and L2 cache
     */
    delete(namespace: string, key: string): Promise<void>;
    /**
     * Clear all cache or specific namespace
     */
    clear(namespace?: string): Promise<void>;
    /**
     * Get value from L1 cache (using Enhanced HashCache)
     */
    private getFromL1;
    /**
     * Get value from L1 cache with namespace-specific grace period handling
     * This method handles stale data serving based on namespace configuration
     */
    private getFromL1WithNamespace;
    /**
     * Set value in L1 cache (using Enhanced HashCache)
     */
    private setToL1;
    /**
     * Get value from L2 cache (KV) - DAC-inspired approach
     * L2 cache never expires and always serves data if it exists
     */
    private getFromL2;
    /**
     * Set value in L2 cache (KV) - DAC-inspired approach
     * L2 cache never expires and only gets updated
     */
    private setToL2;
    /**
     * Build cache key with namespace
     */
    private buildCacheKey;
    /**
     * Update cache statistics (including enhanced HashCache stats)
     */
    private updateStats;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Get enhanced L1 cache statistics (new method)
     */
    getL1Stats(): import("./enhanced-hash-cache.js").EnhancedCacheStats;
    /**
     * Get detailed L1 cache information (new method)
     */
    getL1DetailedInfo(): {
        config: import("./enhanced-hash-cache.js").EnhancedHashCacheConfig;
        stats: import("./enhanced-hash-cache.js").EnhancedCacheStats;
        entries: Array<{
            key: string;
            age: number;
            ttl: number;
            hits: number;
            size: number;
        }>;
    };
    /**
     * Get enhanced configuration for a namespace
     */
    getEnhancedConfig(namespace: string): EnhancedCacheConfig | null;
    /**
     * Get all enhanced configurations
     */
    getAllEnhancedConfigs(): Record<string, EnhancedCacheConfig>;
    /**
     * Get cache configuration summary
     */
    getConfigurationSummary(): {
        environment: string;
        namespaces: number;
        avgL1TTL: number;
        avgL2TTL: number;
        totalMemoryMB: number;
    };
    /**
     * Intelligent cache promotion using enhanced promotion manager
     */
    private intelligentPromotion;
    /**
     * Estimate data size for promotion decisions
     */
    private estimateDataSize;
    /**
     * Get promotion manager statistics
     */
    getPromotionStats(): import("./enhanced-cache-promotion.js").PromotionStats;
    /**
     * Get access patterns from promotion manager
     */
    getAccessPatterns(): {
        key: string;
        count: number;
        lastAccess: number;
        firstAccess: number;
        age: number;
    }[];
    /**
     * Enable/disable intelligent promotion
     */
    setPromotionEnabled(enabled: boolean): void;
    /**
     * Check if intelligent promotion is enabled
     */
    isPromotionEnabled(): boolean;
    /**
     * Perform comprehensive health assessment
     */
    performHealthAssessment(): Promise<CacheHealthAssessment>;
    /**
     * Get performance trends
     */
    getPerformanceTrends(minutes?: number): {
        hitRateTrend: "improving" | "stable" | "declining";
        memoryTrend: "increasing" | "stable" | "decreasing";
        errorTrend: "improving" | "stable" | "worsening";
    };
    /**
     * Get metrics history
     */
    getMetricsHistory(minutes?: number): import("./enhanced-cache-metrics.js").RealTimeMetrics[];
    /**
     * Get current metrics thresholds
     */
    getMetricsThresholds(): PerformanceThresholds;
    /**
     * Update metrics thresholds
     */
    updateMetricsThresholds(newThresholds: Partial<PerformanceThresholds>): void;
    /**
     * Enable/disable enhanced metrics
     */
    setMetricsEnabled(enabled: boolean): void;
    /**
     * Check if enhanced metrics is enabled
     */
    isMetricsEnabled(): boolean;
    /**
     * Clear metrics history
     */
    clearMetricsHistory(): void;
    /**
     * Get comprehensive system status (new method)
     */
    getSystemStatus(): Promise<{
        cache: {
            enabled: boolean;
            namespaces: number;
            stats: CacheStats;
        };
        promotion: {
            enabled: boolean;
            stats: any;
        };
        metrics: {
            enabled: boolean;
            lastAssessment?: CacheHealthAssessment;
            trends: any;
        };
        configuration: {
            environment: string;
            summary: any;
        };
    }>;
    /**
     * Get comprehensive metrics including detailed health info
     */
    getMetricsStats(): import("./DO_CACHE_METRICS.js").CacheMetricsStats;
    /**
     * Get request deduplication statistics
     */
    getDeduplicationStats(): import("./request-deduplication.js").DeduplicationStats;
    /**
     * Get deduplication cache information
     */
    getDeduplicationCacheInfo(): {
        size: number;
        entries: Array<{
            key: string;
            age: number;
            ttl: number;
            size: number;
        }>;
    };
    /**
     * Get pending requests information from deduplicator
     */
    getDeduplicationPendingRequests(): {
        count: number;
        requests: Array<{
            key: string;
            age: number;
            subscribers: number;
        }>;
    };
    /**
     * Get metrics summary for logging
     */
    getMetricsSummary(): string;
    /**
     * Get health status (enhanced with metrics-based assessment)
     */
    getHealthStatus(): {
        enabled: boolean;
        namespaces: number;
        l1Size: number;
        l1MaxSize: number;
        hitRate: number;
        status: 'healthy' | 'warning' | 'error';
        metricsHealth: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            issues: string[];
        };
    };
    /**
     * Reset statistics (both internal and metrics)
     */
    resetStats(): void;
    /**
     * Enable/disable caching
     */
    setEnabled(enabled: boolean): void;
    /**
     * Cleanup expired entries
     */
    cleanup(): Promise<void>;
    /**
     * Get cache response with timestamp information
     */
    getWithTimestampInfo<T>(namespace: string, key: string): Promise<CacheResponse<T>>;
    /**
     * Get L2 cache data with timestamp information
     */
    private getFromL2WithTimestamp;
    /**
     * Get timestamp information for a cached entry
     */
    getTimestampInfo(namespace: string, key: string): CacheTimestampInfo | null;
    /**
     * Get L1 cache timestamp information for monitoring
     */
    getL1TimestampInfo(key: string): CacheTimestampInfo | null;
    /**
     * Check if current time is within business hours (DAC-inspired)
     */
    private isBusinessHours;
    /**
     * Schedule background refresh for stale cache entries (DAC-inspired)
     */
    private scheduleBackgroundRefresh;
    /**
     * Force refresh a cache entry (public API)
     */
    forceRefresh(namespace: string, key: string): Promise<void>;
}
/**
 * Create cache manager instance
 */
export declare function createCacheManager(env: any, options?: {
    l1MaxSize?: number;
    enabled?: boolean;
}): CacheManager;
export default CacheManager;
//# sourceMappingURL=cache-manager.d.ts.map