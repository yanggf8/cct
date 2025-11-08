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
}

/**
 * Health status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical';

/**
 * Detailed metrics for a cache layer
 */
export interface LayerMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
  currentSize: number;
  maxMemoryMB: number;
  currentMemoryMB: number;
  evictions: number;
  errors: number;
  errorRate: number;
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
 * Enhanced cache metrics manager
 */
export class EnhancedCacheMetricsManager {
  private thresholds: PerformanceThresholds;
  private metricsHistory: RealTimeMetrics[];
  private maxHistorySize: number;
  private enabled: boolean;

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
    logger.info('Metrics history cleared');
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