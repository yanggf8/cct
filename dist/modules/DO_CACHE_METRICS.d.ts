/**
 * Cache Metrics Tracking Module
 * Monitors cache performance across all layers with threshold-based alerts
 * Based on DAC v2.0 multi-tier cache observability patterns
 */
export type CacheLayer = 'L1' | 'L2';
export type CacheNamespace = 'analysis' | 'market_data' | 'sector_data' | 'reports' | 'api_responses' | 'overall';
export interface CacheLayerMetrics {
    hits: number;
    misses: number;
    hitRate: number;
    totalRequests: number;
}
export interface CacheNamespaceMetrics {
    namespace: CacheNamespace;
    l1: CacheLayerMetrics;
    l2: CacheLayerMetrics;
    overall: CacheLayerMetrics;
}
export interface CacheMetricsStats {
    layers: {
        l1: CacheLayerMetrics;
        l2: CacheLayerMetrics;
    };
    namespaces: CacheNamespaceMetrics[];
    overall: CacheLayerMetrics;
    timestamp: string;
    health: {
        status: 'healthy' | 'degraded' | 'unhealthy';
        issues: string[];
    };
}
/**
 * Cache Metrics Tracker
 *
 * Tracks cache performance with:
 * - Per-layer metrics (L1, L2)
 * - Per-namespace metrics (analysis, market_data, etc.)
 * - Threshold-based monitoring with automatic alerts
 * - Health status assessment
 *
 * Target hit rates:
 * - L1: >70% (in-memory, very fast)
 * - L2: >60% (KV, fast)
 * - Overall: >70% (combined)
 * - Per-namespace: >65%
 */
export declare class CacheMetrics {
    private l1Hits;
    private l1Misses;
    private l2Hits;
    private l2Misses;
    private namespaceMetrics;
    private lastWarningTime;
    private readonly WARNING_INTERVAL_MS;
    private readonly THRESHOLDS;
    constructor();
    /**
     * Initialize namespace tracking
     */
    private initializeNamespaces;
    /**
     * Record a cache hit
     */
    recordHit(layer: CacheLayer, namespace?: CacheNamespace): void;
    /**
     * Record a cache miss
     */
    recordMiss(layer: CacheLayer, namespace?: CacheNamespace): void;
    /**
     * Check cache performance against thresholds
     */
    private checkThresholds;
    /**
     * Check layer threshold and log warning if needed
     */
    private checkLayerThreshold;
    /**
     * Check namespace threshold and log warning if needed
     */
    private checkNamespaceThreshold;
    /**
     * Check if we should emit a warning (rate limiting)
     */
    private shouldWarn;
    /**
     * Calculate layer metrics
     */
    private calculateLayerMetrics;
    /**
     * Get comprehensive cache metrics
     */
    getStats(): CacheMetricsStats;
    /**
     * Assess overall cache health
     */
    private assessHealth;
    /**
     * Check if cache is healthy (overall hit rate meets threshold)
     */
    isHealthy(): boolean;
    /**
     * Get hit rate for specific layer
     */
    getHitRate(layer: CacheLayer): number;
    /**
     * Get hit rate for specific namespace
     */
    getNamespaceHitRate(namespace: CacheNamespace): number;
    /**
     * Reset all metrics
     */
    reset(): void;
    /**
     * Get summary for logging
     */
    getSummary(): string;
}
/**
 * Global cache metrics instance
 */
export declare const cacheMetrics: CacheMetrics;
//# sourceMappingURL=DO_CACHE_METRICS.d.ts.map