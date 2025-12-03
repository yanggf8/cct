/**
 * Enhanced Cache Metrics and Health Monitoring System
 * Inspired by DAC implementation with comprehensive health assessment
 * Provides real-time metrics, health monitoring, and performance insights
 */
import type { EnhancedCacheConfig } from './enhanced-cache-config.js';
import type { EnhancedHashCache } from './enhanced-hash-cache.js';
/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
    l1HitRate: number;
    l2HitRate: number;
    overallHitRate: number;
    avgResponseTime: number;
    maxMemoryUsage: number;
    errorRate: number;
    promotionRate: number;
}
/**
 * Health status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical';
export interface MetricsLabels {
    system: string;
    layer: string;
    storage_class: string;
    keyspace: string;
    op: string;
    result?: string;
}
export interface OperationMetrics {
    timestamp: number;
    durationMs: number;
    labels: MetricsLabels;
    success: boolean;
}
export interface CounterMetric {
    name: string;
    labels: Partial<MetricsLabels>;
    value: number;
}
export interface HistogramMetric {
    name: string;
    labels: Partial<MetricsLabels>;
    buckets: {
        le: number;
        count: number;
    }[];
    count: number;
    sum: number;
}
export interface GaugeMetric {
    name: string;
    labels: Partial<MetricsLabels>;
    value: number;
}
export interface MetricsSnapshot {
    timestamp: string;
    totals: {
        operations_total: number;
        hits_total: number;
        misses_total: number;
        errors_total: number;
        evictions_total: number;
    };
    byLabels: Record<string, {
        operations_total: number;
        hits_total: number;
        misses_total: number;
        errors_total: number;
        avg_latency_ms: number;
        p50_latency_ms: number;
        p90_latency_ms: number;
        p99_latency_ms: number;
    }>;
    gauges: {
        cache_entries: number;
        cache_bytes: number;
        do_storage_quota_used: number;
        key_cardinality: number;
    };
}
export interface LayerMetrics {
    hits: number;
    misses: number;
    hitRate: number;
    avgResponseTime: number;
    currentSize: number;
    maxMemoryMB: number;
}
/**
 * Comprehensive cache health assessment
 */
export interface CacheHealthAssessment {
    status: HealthStatus;
    overallScore: number;
    l1Metrics: LayerMetrics;
    l2Metrics: LayerMetrics;
    promotionMetrics: {
        totalPromotions: number;
        successfulPromotions: number;
        promotionRate: number;
        avgPromotionTime: number;
    };
    performanceInsights: string[];
    recommendations: string[];
    issues: Array<{
        severity: 'low' | 'medium' | 'high' | 'critical';
        type: string;
        description: string;
        impact: string;
        solution: string;
    }>;
    lastAssessment: number;
}
/**
 * Real-time metrics collection
 */
export interface RealTimeMetrics {
    timestamp: number;
    l1HitRate: number;
    l2HitRate: number;
    overallHitRate: number;
    avgResponseTime: number;
    memoryUsageMB: number;
    activePromotions: number;
    errorRate: number;
    requestsPerSecond: number;
}
/**
 * Enhanced cache metrics manager with DAC-aligned metrics
 */
export declare class EnhancedCacheMetricsManager {
    private thresholds;
    private metricsHistory;
    private maxHistorySize;
    private enabled;
    private counters;
    private histograms;
    private gauges;
    private recentOperations;
    private maxRecentOperations;
    private readonly latencyBuckets;
    constructor(customThresholds?: Partial<PerformanceThresholds>);
    /**
     * Perform comprehensive health assessment
     */
    assessHealth(l1Cache: EnhancedHashCache<any>, l2Stats: any, promotionStats: any, cacheConfigs: Record<string, EnhancedCacheConfig>): Promise<CacheHealthAssessment>;
    /**
     * Collect L1 cache metrics
     */
    private collectL1Metrics;
    /**
     * Collect L2 cache metrics
     */
    private collectL2Metrics;
    /**
     * Collect promotion metrics
     */
    private collectPromotionMetrics;
    /**
     * Calculate overall health score (0-100)
     */
    private calculateHealthScore;
    /**
     * Determine health status based on score and metrics
     */
    private determineHealthStatus;
    /**
     * Generate performance insights
     */
    private generateInsights;
    /**
     * Generate actionable recommendations
     */
    private generateRecommendations;
    /**
     * Identify performance issues
     */
    private identifyIssues;
    /**
     * Record metrics for historical tracking
     */
    private recordMetrics;
    /**
     * Get metrics history
     */
    getMetricsHistory(minutes?: number): RealTimeMetrics[];
    /**
     * Get performance trends
     */
    getPerformanceTrends(minutes?: number): {
        hitRateTrend: 'improving' | 'stable' | 'declining';
        memoryTrend: 'increasing' | 'stable' | 'decreasing';
        errorTrend: 'improving' | 'stable' | 'worsening';
    };
    /**
     * Create disabled assessment
     */
    private createDisabledAssessment;
    /**
     * Create error assessment
     */
    private createErrorAssessment;
    /**
     * Enable/disable metrics collection
     */
    setEnabled(enabled: boolean): void;
    /**
     * Check if metrics collection is enabled
     */
    isEnabled(): boolean;
    /**
     * Get current thresholds
     */
    getThresholds(): PerformanceThresholds;
    /**
     * Update performance thresholds
     */
    updateThresholds(newThresholds: Partial<PerformanceThresholds>): void;
    /**
     * Clear metrics history
     */
    clearHistory(): void;
    /**
     * Record a cache operation for metrics collection
     */
    recordOperation(operation: 'get' | 'put' | 'del' | 'list', labels: Partial<MetricsLabels>, durationMs: number, success: boolean, hit?: boolean): void;
    /**
     * Record cache eviction
     */
    recordEviction(storageClass: string, keyspace: string, count?: number): void;
    /**
     * Set gauge value
     */
    setGauge(name: string, labels: Partial<MetricsLabels>, value: number): void;
    /**
     * Record D1 cold storage operation with enhanced labeling
     */
    recordD1Operation(operation: 'get' | 'put' | 'del' | 'list' | 'rollup' | 'prune', keyspace: string, durationMs: number, success: boolean, additionalLabels?: {
        ttl?: number;
        checksummed?: boolean;
        storage_class?: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
        result?: 'hit' | 'miss' | 'ok' | 'error' | 'created' | 'updated';
    }): void;
    /**
     * Record D1 storage statistics (gauges)
     */
    recordD1StorageStats(keyspace: string, stats: {
        totalEntries: number;
        entriesByClass: Record<string, number>;
        prunedEntries?: number;
        expiredEntries?: number;
        checksumValidations?: number;
        checksumFailures?: number;
    }): void;
    /**
     * Record D1 cache rollup metrics
     */
    recordD1RollupMetrics(day: string, keyspace: string, storageClass: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral', rollupData: {
        hits: number;
        misses: number;
        errors: number;
        totalOperations: number;
        p50Latency: number;
        p99Latency: number;
        egressBytes: number;
        computeMs: number;
    }): void;
    /**
     * Record D1 lifecycle operation (promotion/demotion)
     */
    recordD1LifecycleOperation(operation: 'promotion' | 'demotion', fromClass: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral', toClass: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral', keyspace: string, durationMs: number, success: boolean, dataSize?: number): void;
    /**
     * Get D1-specific statistics
     */
    getD1Stats(): {
        operations: Record<string, number>;
        errors: Record<string, number>;
        rollups: Record<string, number>;
        prunes: Record<string, number>;
        latency: {
            avg: number;
            p50: number;
            p95: number;
            p99: number;
        };
        storage: {
            totalEntries: number;
            entriesByClass: Record<string, number>;
        };
    };
    /**
     * Increment counter
     */
    private incrementCounter;
    /**
     * Record histogram value
     */
    private recordHistogram;
    /**
     * Generate JSON metrics snapshot
     */
    toJSON(): MetricsSnapshot;
    /**
     * Generate Prometheus format metrics
     */
    renderPrometheus(): string;
    private counterKey;
    private histogramKey;
    private gaugeKey;
    private labelKey;
    private calculatePercentile;
    private getGaugeValue;
}
/**
 * Get or create global metrics manager
 */
export declare function getMetricsManager(): EnhancedCacheMetricsManager;
/**
 * Create enhanced cache metrics manager
 */
export declare function createEnhancedCacheMetricsManager(customThresholds?: Partial<PerformanceThresholds>): EnhancedCacheMetricsManager;
export default EnhancedCacheMetricsManager;
//# sourceMappingURL=enhanced-cache-metrics.d.ts.map