/**
 * Enhanced Cache Metrics and Health Monitoring System
 * Inspired by DAC implementation with comprehensive health assessment
 * Provides real-time metrics, health monitoring, and performance insights
 */

import { createLogger } from './logging.js';
import type { EnhancedCacheConfig } from './enhanced-cache-config.js';
import type { EnhancedHashCache } from './enhanced-hash-cache.js';

const logger = createLogger('enhanced-cache-metrics');

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
  l1HitRate: number;        // Minimum L1 hit rate (0-1)
  l2HitRate: number;        // Minimum L2 hit rate (0-1)
  overallHitRate: number;   // Minimum overall hit rate (0-1)
  avgResponseTime: number;  // Maximum average response time (ms)
  maxMemoryUsage: number;   // Maximum memory usage (MB)
  errorRate: number;        // Maximum error rate (0-1)
  promotionRate: number;    // Minimum promotion rate (0-1)
  sampleRate?: number;      // Optional sampling rate for metrics
  maxRecentOperations?: number; // Max recent operations to track
}

/**
 * Health status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical';

// Detailed metrics for a cache layer - moved to legacy section below

// ============================================================================
// DAC-Aligned Metrics Infrastructure
// ============================================================================

export interface MetricsLabels {
  system: string;           // 'CCT'
  layer: string;             // 'do' | 'kv' | 'edge'
  storage_class: string;    // 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral'
  keyspace: string;         // 'market_analysis_cache' | 'sector_cache' | 'fred' | 'yahoo' | 'analysis' | 'report'
  op: string;               // 'get' | 'put' | 'del' | 'list'
  result?: string;          // 'hit' | 'miss' | 'ok' | 'error'
  from_class?: string;      // For promotion tracking
  to_class?: string;        // For demotion tracking
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
  buckets: { le: number; count: number }[];
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

// Legacy interface for backward compatibility
export interface LayerMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
  currentSize: number;
  maxMemoryMB: number;
  // Extended properties used by health assessment
  errorRate?: number;
  evictions?: number;
  currentMemoryMB?: number;
  errors?: number;
}

/**
 * Comprehensive cache health assessment
 */
export interface CacheHealthAssessment {
  status: HealthStatus;
  overallScore: number;      // 0-100 score
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
export class EnhancedCacheMetricsManager {
  private thresholds: PerformanceThresholds;
  private metricsHistory: RealTimeMetrics[];
  private maxHistorySize: number;
  private enabled: boolean;

  // DAC-Aligned Metrics Storage
  private counters: Map<string, CounterMetric> = new Map();
  private histograms: Map<string, HistogramMetric> = new Map();
  private gauges: Map<string, GaugeMetric> = new Map();
  private recentOperations: OperationMetrics[] = [];
  private maxRecentOperations = 10000; // Keep last 10K ops for percentiles

  // Prometheus histogram buckets (in milliseconds)
  private readonly latencyBuckets = [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  constructor(customThresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      l1HitRate: 0.7,          // 70%
      l2HitRate: 0.5,          // 50%
      overallHitRate: 0.6,     // 60%
      avgResponseTime: 100,    // 100ms
      maxMemoryUsage: 50,      // 50MB
      errorRate: 0.05,         // 5%
      promotionRate: 0.3,      // 30%
      ...customThresholds,
    };

    this.metricsHistory = [];
    this.maxHistorySize = 1000; // Keep last 1000 data points
    this.enabled = true;

    logger.info('Enhanced Cache Metrics Manager initialized', {
      thresholds: this.thresholds,
    });
  }

  /**
   * Perform comprehensive health assessment
   */
  async assessHealth(
    l1Cache: EnhancedHashCache<any>,
    l2Stats: any,
    promotionStats: any,
    cacheConfigs: Record<string, EnhancedCacheConfig>
  ): Promise<CacheHealthAssessment> {
    if (!this.enabled) {
      return this.createDisabledAssessment();
    }

    const timestamp = Date.now();

    try {
      // Collect L1 metrics
      const l1Metrics = this.collectL1Metrics(l1Cache);

      // Collect L2 metrics
      const l2Metrics = this.collectL2Metrics(l2Stats);

      // Collect promotion metrics
      const promotionMetrics = this.collectPromotionMetrics(promotionStats);

      // Calculate overall health score
      const overallScore = this.calculateHealthScore(l1Metrics, l2Metrics, promotionMetrics);

      // Determine health status
      const status = this.determineHealthStatus(overallScore, l1Metrics, l2Metrics);

      // Generate insights and recommendations
      const insights = this.generateInsights(l1Metrics, l2Metrics, promotionMetrics);
      const recommendations = this.generateRecommendations(l1Metrics, l2Metrics, promotionMetrics);

      // Identify issues
      const issues = this.identifyIssues(l1Metrics, l2Metrics, promotionMetrics);

      const assessment: CacheHealthAssessment = {
        status,
        overallScore,
        l1Metrics,
        l2Metrics,
        promotionMetrics,
        performanceInsights: insights,
        recommendations,
        issues,
        lastAssessment: timestamp,
      };

      // Record metrics for history
      this.recordMetrics(assessment);

      logger.debug('Health assessment completed', {
        status,
        score: overallScore,
        issues: issues.length,
      });

      return assessment;

    } catch (error: unknown) {
      logger.error('Health assessment failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return this.createErrorAssessment(error);
    }
  }

  /**
   * Collect L1 cache metrics
   */
  private collectL1Metrics(l1Cache: EnhancedHashCache<any>): LayerMetrics {
    const stats = l1Cache.getStats();
    const total = stats.hits + stats.misses;

    return {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hitRate,
      avgResponseTime: 5, // L1 should be ~5ms
      currentSize: stats.currentSize,
      maxMemoryMB: 10, // Default L1 memory limit
      currentMemoryMB: stats.currentMemoryMB,
      evictions: stats.evictions,
      errors: 0, // L1 rarely has errors
      errorRate: 0,
    };
  }

  /**
   * Collect L2 cache metrics
   */
  private collectL2Metrics(l2Stats: any): LayerMetrics {
    const hits = l2Stats.l2Hits || 0;
    const misses = l2Stats.misses || 0;
    const total = hits + misses;

    return {
      hits,
      misses,
      hitRate: total > 0 ? hits / total : 0,
      avgResponseTime: 50, // L2 (KV) should be ~50ms
      currentSize: l2Stats.l2Size || 0,
      maxMemoryMB: 1000, // KV has much larger limits
      currentMemoryMB: 0, // KV memory usage not easily trackable
      evictions: 0, // KV handles eviction automatically
      errors: l2Stats.errors || 0,
      errorRate: total > 0 ? (l2Stats.errors || 0) / total : 0,
    };
  }

  /**
   * Collect promotion metrics
   */
  private collectPromotionMetrics(promotionStats: any) {
    const total = promotionStats.totalPromotions || 0;
    const successful = promotionStats.successfulPromotions || 0;

    return {
      totalPromotions: total,
      successfulPromotions: successful,
      promotionRate: total > 0 ? successful / total : 0,
      avgPromotionTime: promotionStats.avgPromotionTime || 0,
    };
  }

  /**
   * Calculate overall health score (0-100)
   */
  private calculateHealthScore(
    l1Metrics: LayerMetrics,
    l2Metrics: LayerMetrics,
    promotionMetrics: any
  ): number {
    let score = 0;
    let weights = 0;

    // L1 performance (40% weight)
    if (l1Metrics.hitRate >= this.thresholds.l1HitRate) {
      score += 40 * (l1Metrics.hitRate / this.thresholds.l1HitRate);
    } else {
      score += 40 * l1Metrics.hitRate;
    }
    weights += 40;

    // L2 performance (30% weight)
    if (l2Metrics.hitRate >= this.thresholds.l2HitRate) {
      score += 30 * (l2Metrics.hitRate / this.thresholds.l2HitRate);
    } else {
      score += 30 * l2Metrics.hitRate;
    }
    weights += 30;

    // Error rate (20% weight)
    const errorPenalty = Math.min(l1Metrics.errorRate + l2Metrics.errorRate, 1);
    score += 20 * (1 - errorPenalty);
    weights += 20;

    // Promotion effectiveness (10% weight)
    if (promotionMetrics.promotionRate >= this.thresholds.promotionRate) {
      score += 10;
    } else {
      score += 10 * (promotionMetrics.promotionRate / this.thresholds.promotionRate);
    }
    weights += 10;

    return weights > 0 ? Math.round(score) : 0;
  }

  /**
   * Determine health status based on score and metrics
   */
  private determineHealthStatus(
    score: number,
    l1Metrics: LayerMetrics,
    l2Metrics: LayerMetrics
  ): HealthStatus {
    // Critical issues first
    if (l1Metrics.errorRate > 0.1 || l2Metrics.errorRate > 0.1) {
      return 'critical';
    }

    // Very poor performance
    if (score < 30) {
      return 'critical';
    }

    // Poor performance
    if (score < 50) {
      return 'unhealthy';
    }

    // Some issues
    if (score < 70) {
      return 'degraded';
    }

    // Good performance
    return 'healthy';
  }

  /**
   * Generate performance insights
   */
  private generateInsights(
    l1Metrics: LayerMetrics,
    l2Metrics: LayerMetrics,
    promotionMetrics: any
  ): string[] {
    const insights: string[] = [];

    // L1 insights
    if (l1Metrics.hitRate > 0.8) {
      insights.push('L1 cache performing excellently with high hit rate');
    } else if (l1Metrics.hitRate < 0.5) {
      insights.push('L1 cache hit rate is below optimal levels');
    }

    if (l1Metrics.evictions > 100) {
      insights.push('High L1 eviction count indicates memory pressure');
    }

    // L2 insights
    if (l2Metrics.hitRate > 0.6) {
      insights.push('L2 cache providing good backup coverage');
    } else if (l2Metrics.hitRate < 0.3) {
      insights.push('L2 cache hit rate is low, consider increasing TTL');
    }

    // Promotion insights
    if (promotionMetrics.promotionRate > 0.7) {
      insights.push('Intelligent promotion working effectively');
    } else if (promotionMetrics.promotionRate < 0.3) {
      insights.push('Low promotion rate may indicate suboptimal strategy');
    }

    // Memory insights
    if (l1Metrics.currentMemoryMB > l1Metrics.maxMemoryMB * 0.8) {
      insights.push('L1 memory usage approaching limit');
    }

    return insights;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    l1Metrics: LayerMetrics,
    l2Metrics: LayerMetrics,
    promotionMetrics: any
  ): string[] {
    const recommendations: string[] = [];

    // L1 recommendations
    if (l1Metrics.hitRate < this.thresholds.l1HitRate) {
      recommendations.push('Consider increasing L1 TTL or cache size to improve hit rate');
    }

    if (l1Metrics.evictions > 50) {
      recommendations.push('Increase L1 memory limit to reduce evictions');
    }

    // L2 recommendations
    if (l2Metrics.hitRate < this.thresholds.l2HitRate) {
      recommendations.push('Review L2 TTL settings - may be too short for usage patterns');
    }

    // Promotion recommendations
    if (promotionMetrics.promotionRate < this.thresholds.promotionRate) {
      recommendations.push('Adjust promotion strategies to be more aggressive for frequently accessed data');
    }

    // Performance recommendations
    if (l1Metrics.avgResponseTime > 10) {
      recommendations.push('L1 response time is high - investigate potential bottlenecks');
    }

    return recommendations;
  }

  /**
   * Identify performance issues
   */
  private identifyIssues(
    l1Metrics: LayerMetrics,
    l2Metrics: LayerMetrics,
    promotionMetrics: any
  ): Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    description: string;
    impact: string;
    solution: string;
  }> {
    const issues: any[] = [];

    // Critical issues
    if (l1Metrics.errorRate > 0.1) {
      issues.push({
        severity: 'critical',
        type: 'High Error Rate',
        description: `L1 error rate is ${(l1Metrics.errorRate * 100).toFixed(1)}%`,
        impact: 'Cache failures causing service degradation',
        solution: 'Investigate L1 cache implementation for bugs or configuration issues',
      });
    }

    if (l2Metrics.errorRate > 0.1) {
      issues.push({
        severity: 'critical',
        type: 'L2 Errors',
        description: `L2 error rate is ${(l2Metrics.errorRate * 100).toFixed(1)}%`,
        impact: 'Persistent storage failures',
        solution: 'Check KV storage configuration and connectivity',
      });
    }

    // High severity issues
    if (l1Metrics.hitRate < 0.3) {
      issues.push({
        severity: 'high',
        type: 'Low L1 Hit Rate',
        description: `L1 hit rate is ${(l1Metrics.hitRate * 100).toFixed(1)}%`,
        impact: 'Poor cache performance leading to slower response times',
        solution: 'Increase L1 cache size or review TTL settings',
      });
    }

    // Medium severity issues
    if (l1Metrics.evictions > 200) {
      issues.push({
        severity: 'medium',
        type: 'High Eviction Rate',
        description: `${l1Metrics.evictions} items evicted from L1 cache`,
        impact: 'Frequent cache churn reducing effectiveness',
        solution: 'Increase L1 memory allocation or review data retention policies',
      });
    }

    // Low severity issues
    if (promotionMetrics.avgPromotionTime > 20) {
      issues.push({
        severity: 'low',
        type: 'Slow Promotion',
        description: `Average promotion time is ${promotionMetrics.avgPromotionTime.toFixed(1)}ms`,
        impact: 'Minor delay in cache warming',
        solution: 'Optimize promotion logic or reduce data size for promoted items',
      });
    }

    return issues;
  }

  /**
   * Record metrics for historical tracking
   */
  private recordMetrics(assessment: CacheHealthAssessment): void {
    const metrics: RealTimeMetrics = {
      timestamp: assessment.lastAssessment,
      l1HitRate: assessment.l1Metrics.hitRate,
      l2HitRate: assessment.l2Metrics.hitRate,
      overallHitRate: (assessment.l1Metrics.hits + assessment.l2Metrics.hits) /
                      (assessment.l1Metrics.hits + assessment.l1Metrics.misses + assessment.l2Metrics.hits + assessment.l2Metrics.misses),
      avgResponseTime: (assessment.l1Metrics.avgResponseTime + assessment.l2Metrics.avgResponseTime) / 2,
      memoryUsageMB: assessment.l1Metrics.currentMemoryMB,
      activePromotions: assessment.promotionMetrics.totalPromotions,
      errorRate: Math.max(assessment.l1Metrics.errorRate, assessment.l2Metrics.errorRate),
      requestsPerSecond: 0, // Would need external tracking
    };

    this.metricsHistory.push(metrics);

    // Maintain history size
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(minutes?: number): RealTimeMetrics[] {
    if (!minutes) {
      return [...this.metricsHistory];
    }

    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(minutes: number = 60): {
    hitRateTrend: 'improving' | 'stable' | 'declining';
    memoryTrend: 'increasing' | 'stable' | 'decreasing';
    errorTrend: 'improving' | 'stable' | 'worsening';
  } {
    const recent = this.getMetricsHistory(minutes);
    if (recent.length < 2) {
      return {
        hitRateTrend: 'stable',
        memoryTrend: 'stable',
        errorTrend: 'stable',
      };
    }

    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    // Hit rate trend
    const hitRateChange = newest.overallHitRate - oldest.overallHitRate;
    const hitRateTrend = hitRateChange > 0.05 ? 'improving' :
                         hitRateChange < -0.05 ? 'declining' : 'stable';

    // Memory trend
    const memoryChange = newest.memoryUsageMB - oldest.memoryUsageMB;
    const memoryTrend = memoryChange > 1 ? 'increasing' :
                        memoryChange < -1 ? 'decreasing' : 'stable';

    // Error trend
    const errorChange = newest.errorRate - oldest.errorRate;
    const errorTrend = errorChange < -0.01 ? 'improving' :
                       errorChange > 0.01 ? 'worsening' : 'stable';

    return {
      hitRateTrend,
      memoryTrend,
      errorTrend,
    };
  }

  /**
   * Create disabled assessment
   */
  private createDisabledAssessment(): CacheHealthAssessment {
    return {
      status: 'degraded',
      overallScore: 0,
      l1Metrics: {
        hits: 0, misses: 0, hitRate: 0, avgResponseTime: 0,
        currentSize: 0, maxMemoryMB: 0, currentMemoryMB: 0,
        evictions: 0, errors: 0, errorRate: 0,
      },
      l2Metrics: {
        hits: 0, misses: 0, hitRate: 0, avgResponseTime: 0,
        currentSize: 0, maxMemoryMB: 0, currentMemoryMB: 0,
        evictions: 0, errors: 0, errorRate: 0,
      },
      promotionMetrics: {
        totalPromotions: 0, successfulPromotions: 0,
        promotionRate: 0, avgPromotionTime: 0,
      },
      performanceInsights: ['Metrics monitoring disabled'],
      recommendations: ['Enable metrics monitoring for performance insights'],
      issues: [],
      lastAssessment: Date.now(),
    };
  }

  /**
   * Create error assessment
   */
  private createErrorAssessment(error: any): CacheHealthAssessment {
    return {
      status: 'critical',
      overallScore: 0,
      l1Metrics: {
        hits: 0, misses: 0, hitRate: 0, avgResponseTime: 0,
        currentSize: 0, maxMemoryMB: 0, currentMemoryMB: 0,
        evictions: 0, errors: 1, errorRate: 1,
      },
      l2Metrics: {
        hits: 0, misses: 0, hitRate: 0, avgResponseTime: 0,
        currentSize: 0, maxMemoryMB: 0, currentMemoryMB: 0,
        evictions: 0, errors: 1, errorRate: 1,
      },
      promotionMetrics: {
        totalPromotions: 0, successfulPromotions: 0,
        promotionRate: 0, avgPromotionTime: 0,
      },
      performanceInsights: ['Health assessment failed'],
      recommendations: ['Investigate metrics collection system'],
      issues: [{
        severity: 'critical',
        type: 'Metrics Collection Error',
        description: error instanceof Error ? error.message : 'Unknown error',
        impact: 'Unable to monitor cache performance',
        solution: 'Fix metrics collection implementation',
      }],
      lastAssessment: Date.now(),
    };
  }

  /**
   * Enable/disable metrics collection
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info(`Enhanced metrics ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if metrics collection is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Performance thresholds updated', { thresholds: this.thresholds });
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.metricsHistory = [];
    this.recentOperations = [];
    logger.info('Metrics history cleared');
  }

  // ============================================================================
  // DAC-Aligned Metrics Methods
  // ============================================================================

  /**
   * Record a cache operation for metrics collection
   */
  recordOperation(
    operation: 'get' | 'put' | 'del' | 'list',
    labels: Partial<MetricsLabels>,
    durationMs: number,
    success: boolean,
    hit?: boolean
  ): void {
    if (!this.enabled) return;

    const fullLabels: MetricsLabels = {
      system: 'CCT',
      layer: labels.layer || 'do',
      storage_class: labels.storage_class || 'hot_cache',
      keyspace: labels.keyspace || 'market_analysis_cache',
      op: operation,
      result: hit ? (hit ? 'hit' : 'miss') : (success ? 'ok' : 'error')
    };

    const operationMetric: OperationMetrics = {
      timestamp: Date.now(),
      durationMs,
      labels: fullLabels,
      success
    };

    // Store for percentile calculation
    this.recentOperations.push(operationMetric);
    if (this.recentOperations.length > this.maxRecentOperations) {
      this.recentOperations.shift();
    }

    // Update counters
    this.incrementCounter('cache_operations_total', fullLabels);

    if (!success) {
      this.incrementCounter('cache_errors_total', fullLabels);
    }

    // Update hit/miss counters for get operations
    if (operation === 'get' && hit !== undefined) {
      if (hit) {
        this.incrementCounter('cache_hits_total', fullLabels);
      } else {
        this.incrementCounter('cache_misses_total', fullLabels);
      }
    }

    // Update latency histogram
    this.recordHistogram('cache_latency_ms', fullLabels, durationMs);
  }

  /**
   * Record cache eviction
   */
  recordEviction(storageClass: string, keyspace: string, count: number = 1): void {
    if (!this.enabled) return;

    this.incrementCounter('cache_evictions_total', {
      system: 'CCT',
      storage_class: storageClass,
      keyspace
    }, count);
  }

  /**
   * Set gauge value
   */
  setGauge(name: string, labels: Partial<MetricsLabels>, value: number): void {
    if (!this.enabled) return;

    const fullLabels: Partial<MetricsLabels> = {
      system: 'CCT',
      ...labels
    };

    const key = this.gaugeKey(name, fullLabels);
    this.gauges.set(key, {
      name,
      labels: fullLabels,
      value
    });
  }

  // ============================================================================
  // D1 Cold Storage Specific Metrics
  // ============================================================================

  /**
   * Record D1 cold storage operation with enhanced labeling
   */
  recordD1Operation(
    operation: 'get' | 'put' | 'del' | 'list' | 'rollup' | 'prune',
    keyspace: string,
    durationMs: number,
    success: boolean,
    additionalLabels?: {
      ttl?: number;
      checksummed?: boolean;
      storage_class?: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
      result?: 'hit' | 'miss' | 'ok' | 'error' | 'created' | 'updated';
    }
  ): void {
    if (!this.enabled) return;

    const fullLabels: MetricsLabels = {
      system: 'CCT',
      layer: 'd1',
      storage_class: additionalLabels?.storage_class || 'cold_storage',
      keyspace,
      op: operation,
      result: additionalLabels?.result || (success ? 'ok' : 'error')
    };

    const operationMetric: OperationMetrics = {
      timestamp: Date.now(),
      durationMs,
      labels: fullLabels,
      success
    };

    // Store for percentile calculation
    this.recentOperations.push(operationMetric);
    if (this.recentOperations.length > this.maxRecentOperations) {
      this.recentOperations.shift();
    }

    // Update D1-specific counters
    this.incrementCounter('d1_operations_total', fullLabels);

    if (!success) {
      this.incrementCounter('d1_errors_total', fullLabels);
    }

    // Special handling for rollups
    if (operation === 'rollup') {
      this.incrementCounter('d1_rollups_total', {
        system: 'CCT',
        layer: 'd1',
        keyspace
      });
    }

    // Special handling for prune operations
    if (operation === 'prune') {
      this.incrementCounter('d1_prunes_total', {
        system: 'CCT',
        layer: 'd1',
        keyspace
      });
    }

    // Update latency histogram
    this.recordHistogram('d1_operation_latency_ms', fullLabels, durationMs);

    // Set TTL gauge if provided
    if (additionalLabels?.ttl) {
      this.setGauge('d1_entry_ttl_seconds', {
        system: 'CCT',
        layer: 'd1',
        storage_class: additionalLabels.storage_class || 'cold_storage',
        keyspace
      }, additionalLabels.ttl);
    }
  }

  /**
   * Record D1 storage statistics (gauges)
   */
  recordD1StorageStats(
    keyspace: string,
    stats: {
      totalEntries: number;
      entriesByClass: Record<string, number>;
      prunedEntries?: number;
      expiredEntries?: number;
      checksumValidations?: number;
      checksumFailures?: number;
    }
  ): void {
    if (!this.enabled) return;

    const baseLabels = {
      system: 'CCT',
      layer: 'd1',
      keyspace
    };

    // Set total entries gauge
    this.setGauge('d1_total_entries', baseLabels, stats.totalEntries);

    // Set per-class entries
    Object.entries(stats.entriesByClass).forEach(([storageClass, count]) => {
      this.setGauge('d1_entries_by_class', {
        ...baseLabels,
        storage_class: storageClass
      }, count);
    });

    // Set pruning stats if provided
    if (stats.prunedEntries !== undefined) {
      this.setGauge('d1_pruned_entries_total', baseLabels, stats.prunedEntries);
    }

    if (stats.expiredEntries !== undefined) {
      this.setGauge('d1_expired_entries_total', baseLabels, stats.expiredEntries);
    }

    // Set checksum validation stats if provided
    if (stats.checksumValidations !== undefined) {
      this.setGauge('d1_checksum_validations_total', baseLabels, stats.checksumValidations);
    }

    if (stats.checksumFailures !== undefined) {
      this.setGauge('d1_checksum_failures_total', baseLabels, stats.checksumFailures);
    }
  }

  /**
   * Record D1 cache rollup metrics
   */
  recordD1RollupMetrics(
    day: string,
    keyspace: string,
    storageClass: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral',
    rollupData: {
      hits: number;
      misses: number;
      errors: number;
      totalOperations: number;
      p50Latency: number;
      p99Latency: number;
      egressBytes: number;
      computeMs: number;
    }
  ): void {
    if (!this.enabled) return;

    const baseLabels = {
      system: 'CCT',
      layer: 'd1',
      storage_class: storageClass,
      keyspace
    };

    // Set rollup counters
    this.setGauge('d1_rollup_hits', baseLabels, rollupData.hits);
    this.setGauge('d1_rollup_misses', baseLabels, rollupData.misses);
    this.setGauge('d1_rollup_errors', baseLabels, rollupData.errors);
    this.setGauge('d1_rollup_operations', baseLabels, rollupData.totalOperations);

    // Set rollup latency gauges
    this.setGauge('d1_rollup_p50_latency_ms', baseLabels, rollupData.p50Latency);
    this.setGauge('d1_rollup_p99_latency_ms', baseLabels, rollupData.p99Latency);

    // Set rollup resource usage
    this.setGauge('d1_rollup_egress_bytes', baseLabels, rollupData.egressBytes);
    this.setGauge('d1_rollup_compute_ms', baseLabels, rollupData.computeMs);

    // Calculate and set hit rate
    const hitRate = rollupData.totalOperations > 0 ? rollupData.hits / rollupData.totalOperations : 0;
    this.setGauge('d1_rollup_hit_rate', baseLabels, hitRate);

    // Record as a daily rollup operation
    this.recordD1Operation('rollup', keyspace, 0, true, {
      storage_class: storageClass,
      result: 'ok'
    });
  }

  /**
   * Record D1 lifecycle operation (promotion/demotion)
   */
  recordD1LifecycleOperation(
    operation: 'promotion' | 'demotion',
    fromClass: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral',
    toClass: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral',
    keyspace: string,
    durationMs: number,
    success: boolean,
    dataSize?: number
  ): void {
    if (!this.enabled) return;

    const fullLabels: MetricsLabels = {
      system: 'CCT',
      layer: 'd1',
      storage_class: toClass,
      keyspace,
      op: 'lifecycle',
      result: success ? 'ok' : 'error'
    };

    const operationMetric: OperationMetrics = {
      timestamp: Date.now(),
      durationMs,
      labels: fullLabels,
      success
    };

    // Store for percentile calculation
    this.recentOperations.push(operationMetric);
    if (this.recentOperations.length > this.maxRecentOperations) {
      this.recentOperations.shift();
    }

    // Update lifecycle counters
    this.incrementCounter(`d1_lifecycle_${operation}_total`, {
      system: 'CCT',
      layer: 'd1',
      keyspace,
      from_class: fromClass,
      to_class: toClass
    });

    // Update latency histogram
    this.recordHistogram(`d1_lifecycle_${operation}_latency_ms`, fullLabels, durationMs);

    // Set data size gauge if provided
    if (dataSize !== undefined) {
      this.setGauge('d1_lifecycle_transfer_bytes', {
        system: 'CCT',
        layer: 'd1',
        keyspace,
        from_class: fromClass,
        to_class: toClass
      }, dataSize);
    }
  }

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
  } {
    if (!this.enabled) {
      return {
        operations: {},
        errors: {},
        rollups: {},
        prunes: {},
        latency: { avg: 0, p50: 0, p95: 0, p99: 0 },
        storage: { totalEntries: 0, entriesByClass: {} }
      };
    }

    // Filter D1 operations
    const d1Operations = this.recentOperations.filter(op => op.labels.layer === 'd1');

    // Calculate operation counts by keyspace and storage class
    const operations: Record<string, number> = {};
    const errors: Record<string, number> = {};
    const rollups: Record<string, number> = {};
    const prunes: Record<string, number> = {};

    d1Operations.forEach(op => {
      const key = `${op.labels.keyspace}_${op.labels.storage_class}`;
      operations[key] = (operations[key] || 0) + 1;

      if (!op.success) {
        errors[key] = (errors[key] || 0) + 1;
      }

      if (op.labels.op === 'rollup') {
        rollups[key] = (rollups[key] || 0) + 1;
      }

      if (op.labels.op === 'prune') {
        prunes[key] = (prunes[key] || 0) + 1;
      }
    });

    // Calculate latency percentiles
    const latencies = d1Operations.map(op => op.durationMs).sort((a, b) => a - b);
    const latency = {
      avg: latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0,
      p50: this.calculatePercentile(latencies, 0.5),
      p95: this.calculatePercentile(latencies, 0.95),
      p99: this.calculatePercentile(latencies, 0.99)
    };

    // Get storage stats from gauges
    let totalEntries = 0;
    const entriesByClass: Record<string, number> = {};

    this.gauges.forEach((gauge, key) => {
      if (gauge.name === 'd1_total_entries') {
        totalEntries = gauge.value;
      } else if (gauge.name === 'd1_entries_by_class') {
        const storageClass = gauge.labels.storage_class || 'unknown';
        entriesByClass[storageClass] = gauge.value;
      }
    });

    return {
      operations,
      errors,
      rollups,
      prunes,
      latency,
      storage: {
        totalEntries,
        entriesByClass
      }
    };
  }

  /**
   * Increment counter
   */
  private incrementCounter(name: string, labels: Partial<MetricsLabels>, value: number = 1): void {
    const key = this.counterKey(name, labels);
    const existing = this.counters.get(key);

    this.counters.set(key, {
      name,
      labels,
      value: (existing?.value || 0) + value
    });
  }

  /**
   * Record histogram value
   */
  private recordHistogram(name: string, labels: Partial<MetricsLabels>, value: number): void {
    const key = this.histogramKey(name, labels);
    const existing = this.histograms.get(key);

    if (!existing) {
      // Create new histogram with Prometheus buckets
      const buckets = this.latencyBuckets.map(le => ({ le, count: 0 }));

      this.histograms.set(key, {
        name,
        labels,
        buckets,
        count: 0,
        sum: 0
      });
    }

    const histogram = this.histograms.get(key)!;
    histogram.count++;
    histogram.sum += value;

    // Find appropriate bucket
    for (const bucket of histogram.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      } else {
        break;
      }
    }
  }

  /**
   * Generate JSON metrics snapshot
   */
  toJSON(): MetricsSnapshot {
    const now = new Date().toISOString();

    // Calculate totals
    const totals = {
      operations_total: this.recentOperations.length,
      hits_total: this.recentOperations.filter(op => op.labels.result === 'hit').length,
      misses_total: this.recentOperations.filter(op => op.labels.result === 'miss').length,
      errors_total: this.recentOperations.filter(op => op.labels.result === 'error').length,
      evictions_total: Array.from(this.counters.values())
        .filter(c => c.name === 'cache_evictions_total')
        .reduce((sum, c) => sum + c.value, 0)
    };

    // Group by labels for detailed breakdown
    const byLabels: Record<string, any> = {};
    const labelGroups = new Map<string, OperationMetrics[]>();

    // Group operations by label combination
    for (const op of this.recentOperations) {
      const labelKey = this.labelKey(op.labels);
      if (!labelGroups.has(labelKey)) {
        labelGroups.set(labelKey, []);
      }
      labelGroups.get(labelKey)!.push(op);
    }

    // Calculate metrics for each label group
    for (const [labelKey, operations] of labelGroups) {
      const latencies = operations.map(op => op.durationMs).sort((a, b) => a - b);
      const count = operations.length;
      const hits = operations.filter(op => op.labels.result === 'hit').length;
      const misses = operations.filter(op => op.labels.result === 'miss').length;
      const errors = operations.filter(op => op.labels.result === 'error').length;

      byLabels[labelKey] = {
        operations_total: count,
        hits_total: hits,
        misses_total: misses,
        errors_total: errors,
        avg_latency_ms: count > 0 ? latencies.reduce((sum, l) => sum + l, 0) / count : 0,
        p50_latency_ms: this.calculatePercentile(latencies, 0.5),
        p90_latency_ms: this.calculatePercentile(latencies, 0.9),
        p99_latency_ms: this.calculatePercentile(latencies, 0.99)
      };
    }

    // Collect gauge values
    const gauges = {
      cache_entries: this.getGaugeValue('cache_entries'),
      cache_bytes: this.getGaugeValue('cache_bytes'),
      do_storage_quota_used: this.getGaugeValue('do_storage_quota_used'),
      key_cardinality: this.recentOperations.length
    };

    return {
      timestamp: now,
      totals,
      byLabels,
      gauges
    };
  }

  /**
   * Generate Prometheus format metrics
   */
  renderPrometheus(): string {
    const lines: string[] = [];

    // Add HELP and TYPE for each metric type
    lines.push('# HELP cache_operations_total Total number of cache operations');
    lines.push('# TYPE cache_operations_total counter');
    lines.push('');

    lines.push('# HELP cache_hits_total Total number of cache hits');
    lines.push('# TYPE cache_hits_total counter');
    lines.push('');

    lines.push('# HELP cache_misses_total Total number of cache misses');
    lines.push('# TYPE cache_misses_total counter');
    lines.push('');

    lines.push('# HELP cache_errors_total Total number of cache errors');
    lines.push('# TYPE cache_errors_total counter');
    lines.push('');

    lines.push('# HELP cache_evictions_total Total number of cache evictions');
    lines.push('# TYPE cache_evictions_total counter');
    lines.push('');

    lines.push('# HELP cache_latency_ms Cache operation latency in milliseconds');
    lines.push('# TYPE cache_latency_ms histogram');
    lines.push('');

    // Render counters
    for (const counter of this.counters.values()) {
      const labelsStr = Object.entries(counter.labels)
        .map(([key, value]) => `${key}="${value}"`)
        .join(',');

      lines.push(`cache_${counter.name}_total{system="${counter.labels.system}",${labelsStr}} ${counter.value}`);
    }

    lines.push('');

    // Render histograms
    for (const histogram of this.histograms.values()) {
      const labelsStr = Object.entries(histogram.labels)
        .map(([key, value]) => `${key}="${value}"`)
        .join(',');

      lines.push(`cache_${histogram.name}_ms_bucket{system="${histogram.labels.system}",${labelsStr},le="${this.latencyBuckets[0]}"} 0`);

      // Add all buckets except the first one (already added as 0)
      for (let i = 1; i < histogram.buckets.length; i++) {
        lines.push(`cache_${histogram.name}_ms_bucket{system="${histogram.labels.system}",${labelsStr},le="${histogram.buckets[i].le}"} ${histogram.buckets[i].count}`);
      }

      // Add +Inf bucket
      lines.push(`cache_${histogram.name}_ms_bucket{system="${histogram.labels.system}",${labelsStr},le="+Inf"} ${histogram.count - histogram.buckets.reduce((sum, b) => sum + b.count, 0)}`);

      lines.push(`cache_${histogram.name}_ms_sum{system="${histogram.labels.system}",${labelsStr}} ${histogram.sum}`);
      lines.push(`cache_${histogram.name}_ms_count{system="${histogram.labels.system}",${labelsStr}} ${histogram.count}`);
    }

    lines.push('');

    // Render gauges
    for (const gauge of this.gauges.values()) {
      const labelsStr = Object.entries(gauge.labels)
        .filter(([key]) => key !== 'system') // Exclude system label from gauges
        .map(([key, value]) => `${key}="${value}"`)
        .join(',');

      if (labelsStr) {
        lines.push(`cache_${gauge.name}{system="${gauge.labels.system}",${labelsStr}} ${gauge.value}`);
      } else {
        lines.push(`cache_${gauge.name}{system="${gauge.labels.system}"} ${gauge.value}`);
      }
    }

    return lines.join('\n');
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private counterKey(name: string, labels: Partial<MetricsLabels>): string {
    const labelParts = Object.entries(labels).map(([key, value]) => `${key}:${value}`);
    return `${name}(${labelParts.join(',')})`;
  }

  private histogramKey(name: string, labels: Partial<MetricsLabels>): string {
    return this.counterKey(name, labels);
  }

  private gaugeKey(name: string, labels: Partial<MetricsLabels>): string {
    return this.counterKey(name, labels);
  }

  private labelKey(labels: MetricsLabels): string {
    return `${labels.system}:${labels.layer}:${labels.storage_class}:${labels.keyspace}:${labels.op}:${labels.result || ''}`;
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[index] || 0;
  }

  private getGaugeValue(name: string): number {
    return Array.from(this.gauges.values())
      .filter(g => g.name === name)
      .reduce((sum, g) => sum + g.value, 0);
  }
}

/**
 * Global metrics manager instance
 */
let globalMetricsManager: EnhancedCacheMetricsManager | null = null;

/**
 * Get or create global metrics manager
 */
export function getMetricsManager(): EnhancedCacheMetricsManager {
  if (!globalMetricsManager) {
    globalMetricsManager = new EnhancedCacheMetricsManager();
  }
  return globalMetricsManager;
}

/**
 * Create enhanced cache metrics manager
 */
export function createEnhancedCacheMetricsManager(
  customThresholds?: Partial<PerformanceThresholds>
): EnhancedCacheMetricsManager {
  return new EnhancedCacheMetricsManager(customThresholds);
}

export default EnhancedCacheMetricsManager;