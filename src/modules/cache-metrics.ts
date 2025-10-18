/**
 * Cache Metrics Tracking Module
 * Monitors cache performance across all layers with threshold-based alerts
 * Based on DAC v2.0 multi-tier cache observability patterns
 */

import { createLogger } from './logging.js';

const logger = createLogger('cache-metrics');

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
export class CacheMetrics {
  // Layer-wide metrics
  private l1Hits = 0;
  private l1Misses = 0;
  private l2Hits = 0;
  private l2Misses = 0;

  // Per-namespace metrics
  private namespaceMetrics: Map<CacheNamespace, {
    l1Hits: number;
    l1Misses: number;
    l2Hits: number;
    l2Misses: number;
  }> = new Map();

  // Threshold tracking
  private lastWarningTime: Map<string, number> = new Map();
  private readonly WARNING_INTERVAL_MS = 3600000; // 1 hour

  // Performance thresholds (%)
  private readonly THRESHOLDS = {
    L1: 70,
    L2: 60,
    OVERALL: 70,
    NAMESPACE: 65
  };

  constructor() {
    this.initializeNamespaces();
    logger.info('Cache metrics tracking initialized');
  }

  /**
   * Initialize namespace tracking
   */
  private initializeNamespaces(): void {
    const namespaces: CacheNamespace[] = [
      'analysis',
      'market_data',
      'sector_data',
      'reports',
      'api_responses'
    ];

    for (const ns of namespaces) {
      this.namespaceMetrics.set(ns, {
        l1Hits: 0,
        l1Misses: 0,
        l2Hits: 0,
        l2Misses: 0
      });
    }
  }

  /**
   * Record a cache hit
   */
  recordHit(layer: CacheLayer, namespace?: CacheNamespace): void {
    // Update layer-wide metrics
    if (layer === 'L1') {
      this.l1Hits++;
    } else {
      this.l2Hits++;
    }

    // Update namespace metrics
    if (namespace && namespace !== 'overall') {
      const nsMetrics = this.namespaceMetrics.get(namespace);
      if (nsMetrics) {
        if (layer === 'L1') {
          nsMetrics.l1Hits++;
        } else {
          nsMetrics.l2Hits++;
        }
      }
    }

    logger.debug(`Cache ${layer} hit${namespace ? ` [${namespace}]` : ''}`);
  }

  /**
   * Record a cache miss
   */
  recordMiss(layer: CacheLayer, namespace?: CacheNamespace): void {
    // Update layer-wide metrics
    if (layer === 'L1') {
      this.l1Misses++;
    } else {
      this.l2Misses++;
    }

    // Update namespace metrics
    if (namespace && namespace !== 'overall') {
      const nsMetrics = this.namespaceMetrics.get(namespace);
      if (nsMetrics) {
        if (layer === 'L1') {
          nsMetrics.l1Misses++;
        } else {
          nsMetrics.l2Misses++;
        }
      }
    }

    logger.debug(`Cache ${layer} miss${namespace ? ` [${namespace}]` : ''}`);

    // Check thresholds
    this.checkThresholds();
  }

  /**
   * Check cache performance against thresholds
   */
  private checkThresholds(): void {
    const stats = this.getStats();

    // Check layer thresholds
    this.checkLayerThreshold('L1', stats.layers.l1);
    this.checkLayerThreshold('L2', stats.layers.l2);
    this.checkLayerThreshold('OVERALL', stats.overall);

    // Check namespace thresholds
    for (const nsMetrics of stats.namespaces) {
      this.checkNamespaceThreshold(nsMetrics);
    }
  }

  /**
   * Check layer threshold and log warning if needed
   */
  private checkLayerThreshold(layer: string, metrics: CacheLayerMetrics): void {
    // Only check after we have at least 10 requests
    if (metrics.totalRequests < 10) return;

    const threshold = this.THRESHOLDS[layer as keyof typeof this.THRESHOLDS];
    if (!threshold) return;

    if (metrics.hitRate < threshold) {
      const warningKey = `layer:${layer}`;
      if (this.shouldWarn(warningKey)) {
        logger.warn(`${layer} cache hit rate below threshold`, {
          layer,
          hitRate: metrics.hitRate.toFixed(1) + '%',
          threshold: threshold + '%',
          hits: metrics.hits,
          misses: metrics.misses,
          totalRequests: metrics.totalRequests
        });
      }
    }
  }

  /**
   * Check namespace threshold and log warning if needed
   */
  private checkNamespaceThreshold(nsMetrics: CacheNamespaceMetrics): void {
    const metrics = nsMetrics.overall;

    // Only check after we have at least 5 requests
    if (metrics.totalRequests < 5) return;

    if (metrics.hitRate < this.THRESHOLDS.NAMESPACE) {
      const warningKey = `namespace:${nsMetrics.namespace}`;
      if (this.shouldWarn(warningKey)) {
        logger.warn(`Namespace cache hit rate below threshold`, {
          namespace: nsMetrics.namespace,
          hitRate: metrics.hitRate.toFixed(1) + '%',
          threshold: this.THRESHOLDS.NAMESPACE + '%',
          hits: metrics.hits,
          misses: metrics.misses
        });
      }
    }
  }

  /**
   * Check if we should emit a warning (rate limiting)
   */
  private shouldWarn(key: string): boolean {
    const now = Date.now();
    const lastWarning = this.lastWarningTime.get(key) || 0;

    if (now - lastWarning > this.WARNING_INTERVAL_MS) {
      this.lastWarningTime.set(key, now);
      return true;
    }

    return false;
  }

  /**
   * Calculate layer metrics
   */
  private calculateLayerMetrics(hits: number, misses: number): CacheLayerMetrics {
    const totalRequests = hits + misses;
    const hitRate = totalRequests > 0 ? (hits / totalRequests) * 100 : 0;

    return {
      hits,
      misses,
      hitRate: parseFloat(hitRate.toFixed(2)),
      totalRequests
    };
  }

  /**
   * Get comprehensive cache metrics
   */
  getStats(): CacheMetricsStats {
    // Layer-wide metrics
    const l1Metrics = this.calculateLayerMetrics(this.l1Hits, this.l1Misses);
    const l2Metrics = this.calculateLayerMetrics(this.l2Hits, this.l2Misses);

    // Overall metrics
    const totalHits = this.l1Hits + this.l2Hits;
    const totalMisses = this.l1Misses + this.l2Misses;
    const overallMetrics = this.calculateLayerMetrics(totalHits, totalMisses);

    // Namespace metrics
    const namespaceMetrics: CacheNamespaceMetrics[] = [];
    for (const [namespace, metrics] of this.namespaceMetrics.entries()) {
      const l1 = this.calculateLayerMetrics(metrics.l1Hits, metrics.l1Misses);
      const l2 = this.calculateLayerMetrics(metrics.l2Hits, metrics.l2Misses);
      const nsOverall = this.calculateLayerMetrics(
        metrics.l1Hits + metrics.l2Hits,
        metrics.l1Misses + metrics.l2Misses
      );

      namespaceMetrics.push({
        namespace,
        l1,
        l2,
        overall: nsOverall
      });
    }

    // Health assessment
    const health = this.assessHealth(l1Metrics, l2Metrics, overallMetrics, namespaceMetrics);

    return {
      layers: {
        l1: l1Metrics,
        l2: l2Metrics
      },
      namespaces: namespaceMetrics,
      overall: overallMetrics,
      timestamp: new Date().toISOString(),
      health
    };
  }

  /**
   * Assess overall cache health
   */
  private assessHealth(
    l1: CacheLayerMetrics,
    l2: CacheLayerMetrics,
    overall: CacheLayerMetrics,
    namespaces: CacheNamespaceMetrics[]
  ): { status: 'healthy' | 'degraded' | 'unhealthy'; issues: string[] } {
    const issues: string[] = [];

    // Check layer health (only if we have sufficient data)
    if (l1.totalRequests >= 10 && l1.hitRate < this.THRESHOLDS.L1) {
      issues.push(`L1 hit rate (${l1.hitRate.toFixed(1)}%) below target (${this.THRESHOLDS.L1}%)`);
    }

    if (l2.totalRequests >= 10 && l2.hitRate < this.THRESHOLDS.L2) {
      issues.push(`L2 hit rate (${l2.hitRate.toFixed(1)}%) below target (${this.THRESHOLDS.L2}%)`);
    }

    if (overall.totalRequests >= 10 && overall.hitRate < this.THRESHOLDS.OVERALL) {
      issues.push(`Overall hit rate (${overall.hitRate.toFixed(1)}%) below target (${this.THRESHOLDS.OVERALL}%)`);
    }

    // Check namespace health (only if we have sufficient data)
    for (const ns of namespaces) {
      if (ns.overall.totalRequests >= 5 && ns.overall.hitRate < this.THRESHOLDS.NAMESPACE) {
        issues.push(`Namespace '${ns.namespace}' hit rate (${ns.overall.hitRate.toFixed(1)}%) below target (${this.THRESHOLDS.NAMESPACE}%)`);
      }
    }

    // Determine status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (issues.length <= 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, issues };
  }

  /**
   * Check if cache is healthy (overall hit rate meets threshold)
   */
  isHealthy(): boolean {
    const stats = this.getStats();
    return stats.health.status === 'healthy';
  }

  /**
   * Get hit rate for specific layer
   */
  getHitRate(layer: CacheLayer): number {
    const stats = this.getStats();
    return layer === 'L1' ? stats.layers.l1.hitRate : stats.layers.l2.hitRate;
  }

  /**
   * Get hit rate for specific namespace
   */
  getNamespaceHitRate(namespace: CacheNamespace): number {
    const stats = this.getStats();
    const nsMetrics = stats.namespaces.find(m => m.namespace === namespace);
    return nsMetrics?.overall.hitRate || 0;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.l1Hits = 0;
    this.l1Misses = 0;
    this.l2Hits = 0;
    this.l2Misses = 0;

    for (const metrics of this.namespaceMetrics.values()) {
      metrics.l1Hits = 0;
      metrics.l1Misses = 0;
      metrics.l2Hits = 0;
      metrics.l2Misses = 0;
    }

    this.lastWarningTime.clear();
    logger.info('Cache metrics reset');
  }

  /**
   * Get summary for logging
   */
  getSummary(): string {
    const stats = this.getStats();
    return `Cache: L1=${stats.layers.l1.hitRate.toFixed(1)}%, L2=${stats.layers.l2.hitRate.toFixed(1)}%, Overall=${stats.overall.hitRate.toFixed(1)}% [${stats.health.status}]`;
  }
}

/**
 * Global cache metrics instance
 */
export const cacheMetrics = new CacheMetrics();
