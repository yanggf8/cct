/**
 * Production Monitoring and Metrics System
 * Tracks system performance, business metrics, and operational health
 */

import { createLogger } from './logging.js';
import { CONFIG } from './config.js';
import { createDAL } from './dal.js';

const logger = createLogger('monitoring');

/**
 * System metrics collection
 */
class SystemMetrics {
  private metrics: Map<string, any> = new Map();
  private counters: Map<string, number> = new Map();
  private timers: Map<string, any> = new Map();

  constructor() {
    // Properties are already initialized above
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: any, value: any = 1, tags: any = {}) {
    const key = this.createMetricKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    logger.business(name, current + value, {
      type: 'counter',
      tags,
      increment: value
    });
  }

  /**
   * Record a gauge metric (current value)
   */
  recordGauge(name: any, value: any, tags: any = {}) {
    const key = this.createMetricKey(name, tags);
    this.metrics.set(key, {
      name,
      value,
      tags,
      timestamp: Date.now(),
      type: 'gauge'
    });

    logger.business(name, value, {
      type: 'gauge',
      tags
    });
  }

  /**
   * Record a timer metric (duration)
   */
  recordTimer(name: any, duration: any, tags: any = {}) {
    const key = this.createMetricKey(name, tags);
    this.timers.set(key, {
      name,
      duration,
      tags,
      timestamp: Date.now(),
      type: 'timer'
    });

    logger.performance(name, duration, {
      type: 'timer',
      tags
    });
  }

  /**
   * Create a timer instance
   */
  timer(name: string, tags: Record<string, any> = {}) {
    const startTime = Date.now();
    return {
      stop: () => {
        const duration = Date.now() - startTime;
        this.recordTimer(name, duration, tags);
        return duration;
      }
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.metrics),
      timers: Object.fromEntries(this.timers),
      timestamp: Date.now()
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.clear();
    this.counters.clear();
    this.timers.clear();
  }

  /**
   * Create a unique key for metric storage
   */
  createMetricKey(name: string, tags: Record<string, any>) {
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return tagString ? `${name}[${tagString}]` : name;
  }
}

// Global metrics instance
const systemMetrics = new SystemMetrics();

/**
 * Business metrics tracking
 */
export const BusinessMetrics = {
  // Analysis metrics
  analysisRequested: (type: any, symbols: any) => {
    systemMetrics.incrementCounter('analysis.requested', 1, { type });
    systemMetrics.recordGauge('analysis.symbols_count', symbols, { type });
  },

  analysisCompleted: (type: string, symbols: number, duration: number) => {
    systemMetrics.incrementCounter('analysis.completed', 1, { type });
    systemMetrics.recordTimer('analysis.duration', duration, { type });
    systemMetrics.recordGauge('analysis.success_rate', 100, { type });
  },

  analysisFailed: (type: any, error: any) => {
    systemMetrics.incrementCounter('analysis.failed', 1, { type, error });
    systemMetrics.recordGauge('analysis.success_rate', 0, { type });
  },

  // Prediction metrics
  predictionMade: (symbol: string, confidence: number, direction: string) => {
    systemMetrics.incrementCounter('predictions.made', 1, { symbol, direction });
    systemMetrics.recordGauge('predictions.confidence', confidence * 100, { symbol });
  },

  predictionValidated: (symbol: string, correct: boolean, confidence: number) => {
    systemMetrics.incrementCounter('predictions.validated', 1, { symbol, correct: correct.toString() });
    systemMetrics.recordGauge('predictions.accuracy', correct ? 100 : 0, { symbol });
  },

  // API metrics
  apiRequest: (endpoint: string, method: string, status: number, duration: number) => {
    systemMetrics.incrementCounter('api.requests', 1, { endpoint, method, status: status.toString() });
    systemMetrics.recordTimer('api.response_time', duration, { endpoint });
  },

  // Facebook metrics
  facebookMessageSent: (type: any, success: any) => {
    systemMetrics.incrementCounter('facebook.messages_sent', 1, { type, success: success.toString() });
  },

  // KV storage metrics
  kvOperation: (operation, success, duration) => {
    systemMetrics.incrementCounter('kv.operations', 1, { operation, success: success.toString() });
    systemMetrics.recordTimer('kv.operation_time', duration, { operation });
  },

  // Daily summary metrics
  dailySummaryGenerated: (date: any, predictions: any) => {
    systemMetrics.incrementCounter('daily_summary.generated', 1, { date });
    systemMetrics.recordGauge('daily_summary.predictions', predictions, { date });
  },

  dailySummaryViewed: (date: any) => {
    systemMetrics.incrementCounter('daily_summary.views', 1, { date });
  }
};

/**
 * Enhanced Business KPI Tracking
 */
export const BusinessKPI = {
  /**
   * Track prediction accuracy against targets
   */
  trackPredictionAccuracy: (accuracy: any) => {
    const target = CONFIG.BUSINESS_KPI.PREDICTION_ACCURACY_TARGET;
    const isOnTarget = accuracy >= target;

    systemMetrics.recordGauge('kpi.prediction_accuracy', accuracy * 100);
    systemMetrics.recordGauge('kpi.prediction_accuracy_vs_target',
      isOnTarget ? 100 : (accuracy / target) * 100);

    if (!isOnTarget) {
      logger.warn('Prediction accuracy below target', {
        accuracy,
        target,
        deficit: target - accuracy
      });
    }
  },

  /**
   * Track system performance against targets
   */
  trackPerformanceKPI: (responseTime: any, operation: any) => {
    const target = CONFIG.BUSINESS_KPI.RESPONSE_TIME_TARGET_MS;
    const performance = responseTime <= target ? 100 : (target / responseTime) * 100;

    systemMetrics.recordGauge('kpi.response_time_performance', performance, { operation });
    systemMetrics.recordTimer('kpi.response_time', responseTime, { operation });

    if (responseTime > target) {
      logger.warn('Response time exceeds target', {
        responseTime,
        target,
        operation,
        excess: responseTime - target
      });
    }
  },

  /**
   * Track cost efficiency (should remain $0.00)
   */
  trackCostEfficiency: (actualCost = 0) => {
    const target = CONFIG.BUSINESS_KPI.COST_PER_ANALYSIS_TARGET;
    const efficiency = actualCost === target ? 100 : 0;

    systemMetrics.recordGauge('kpi.cost_efficiency', efficiency);
    systemMetrics.recordGauge('kpi.actual_cost', actualCost);

    if (actualCost > target) {
      logger.warn('Cost exceeds target', {
        actualCost,
        target,
        excess: actualCost - target
      });
    }
  },

  /**
   * Track system uptime against target
   */
  trackUptimeKPI: (uptimePercentage: any) => {
    const target = CONFIG.BUSINESS_KPI.UPTIME_TARGET;
    const performance = uptimePercentage >= target ? 100 : (uptimePercentage / target) * 100;

    systemMetrics.recordGauge('kpi.uptime_performance', performance);
    systemMetrics.recordGauge('kpi.uptime_percentage', uptimePercentage * 100);

    if (uptimePercentage < target) {
      logger.error('Uptime below target', {
        uptime: uptimePercentage,
        target,
        downtime: (1 - uptimePercentage) * 100
      });
    }
  },

  /**
   * Track cron execution reliability
   */
  trackCronReliability: (successCount, totalCount, triggerMode) => {
    const reliability = totalCount > 0 ? (successCount / totalCount) : 1;

    systemMetrics.recordGauge('kpi.cron_reliability', reliability * 100, { triggerMode });
    systemMetrics.incrementCounter('kpi.cron_executions', totalCount, { triggerMode });
    systemMetrics.incrementCounter('kpi.cron_successes', successCount, { triggerMode });

    if (reliability < 0.95) {
      logger.error('Cron reliability below threshold', {
        reliability,
        successCount,
        totalCount,
        triggerMode
      });
    }
  },

  /**
   * Generate KPI dashboard data
   */
  generateKPIDashboard: () => {
    const metrics = systemMetrics.getAllMetrics();

    return {
      prediction_accuracy: {
        current: getLatestGauge(metrics.gauges, 'kpi.prediction_accuracy') || 0,
        target: CONFIG.BUSINESS_KPI.PREDICTION_ACCURACY_TARGET * 100,
        status: getKPIStatus('kpi.prediction_accuracy_vs_target', metrics.gauges)
      },
      response_time: {
        current: getLatestTimer(metrics.timers, 'kpi.response_time') || 0,
        target: CONFIG.BUSINESS_KPI.RESPONSE_TIME_TARGET_MS,
        status: getKPIStatus('kpi.response_time_performance', metrics.gauges)
      },
      cost_efficiency: {
        current: getLatestGauge(metrics.gauges, 'kpi.actual_cost') || 0,
        target: CONFIG.BUSINESS_KPI.COST_PER_ANALYSIS_TARGET,
        status: getLatestGauge(metrics.gauges, 'kpi.cost_efficiency') || 100
      },
      uptime: {
        current: getLatestGauge(metrics.gauges, 'kpi.uptime_percentage') || 100,
        target: CONFIG.BUSINESS_KPI.UPTIME_TARGET * 100,
        status: getKPIStatus('kpi.uptime_performance', metrics.gauges)
      },
      cron_reliability: {
        current: getLatestGauge(metrics.gauges, 'kpi.cron_reliability') || 100,
        target: 95,
        executions: getLatestCounter(metrics.counters, 'kpi.cron_executions') || 0
      },
      timestamp: new Date().toISOString(),
      overall_health: calculateOverallKPIHealth(metrics)
    };
  }
};

/**
 * Helper functions for KPI calculations
 */
function getLatestGauge(gauges: any, metricName: any) {
  const matching = Object.entries(gauges)
    .filter(([key]) => key.startsWith(metricName))
    .map(([, value]) => value)
    .sort((a: any, b: any) => b.timestamp - a.timestamp);

  return matching.length > 0 ? ((matching[0] as any).value) : null;
}

function getLatestTimer(timers: any, metricName: any) {
  const matching = Object.entries(timers)
    .filter(([key]) => key.startsWith(metricName))
    .map(([, value]) => value)
    .sort((a: any, b: any) => b.timestamp - a.timestamp);

  return matching.length > 0 ? ((matching[0] as any).duration) : null;
}

function getLatestCounter(counters: any, metricName: any) {
  const matching = Object.entries(counters as Record<string, number>)
    .filter(([key]) => key.startsWith(metricName))
    .reduce((sum, [, value]) => sum + (value as number), 0);

  return matching;
}

function getKPIStatus(performanceMetric: any, gauges: any) {
  const performance = getLatestGauge(gauges, performanceMetric);
  if (performance === null) return 'unknown';
  if (performance >= 95) return 'excellent';
  if (performance >= 80) return 'good';
  if (performance >= 60) return 'acceptable';
  return 'poor';
}

function calculateOverallKPIHealth(metrics: any) {
  const kpiMetrics = [
    getLatestGauge(metrics.gauges, 'kpi.prediction_accuracy_vs_target'),
    getLatestGauge(metrics.gauges, 'kpi.response_time_performance'),
    getLatestGauge(metrics.gauges, 'kpi.cost_efficiency'),
    getLatestGauge(metrics.gauges, 'kpi.uptime_performance'),
    getLatestGauge(metrics.gauges, 'kpi.cron_reliability')
  ].filter(v => v !== null);

  if (kpiMetrics.length === 0) return 'unknown';

  const avgPerformance = kpiMetrics.reduce((sum: any, val: any) => sum + val, 0) / kpiMetrics.length;

  if (avgPerformance >= 95) return 'excellent';
  if (avgPerformance >= 85) return 'good';
  if (avgPerformance >= 70) return 'acceptable';
  return 'needs-attention';
}

/**
 * Performance monitoring
 */
export const PerformanceMonitor = {
  /**
   * Monitor HTTP request performance
   */
  monitorRequest: (request: any, handler?: any) => {
    const url = new URL(request.url);
    const startTime = Date.now();

    return {
      complete: (response: any) => {
        const duration = Date.now() - startTime;
        BusinessMetrics.apiRequest(
          url.pathname,
          request.method,
          response.status,
          duration
        );

        logger.response(response.status, url.pathname, duration, {
          method: request.method,
          userAgent: request.headers.get('User-Agent'),
          ip: request.headers.get('CF-Connecting-IP')
        });
      }
    };
  },

  /**
   * Monitor async operation performance
   */
  monitorOperation: (name, operation, tags = {}) => {
    const timer = systemMetrics.timer(name, tags);

    return operation().finally(() => {
      timer.stop();
    });
  }
};

/**
 * Health monitoring
 */
export const HealthMonitor = {
  /**
   * Check system health
   */
  async checkHealth(env) {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        kv_storage: {},
        ai_models: {}
      },
      metrics: {}
    };

    // Check KV storage using DAL
    try {
      const dal = createDAL(env);
      const testKey = `health_check_${Date.now()}`;
      const timer = systemMetrics.timer('health.kv_check');

      // Test write, read, delete operations
      const writeResult = await dal.write(testKey, 'test', { expirationTtl: 60 });
      const readResult = await dal.read(testKey);
      const deleteResult = await dal.deleteKey(testKey);

      const kvDuration = timer.stop();

      if (writeResult.success && readResult.success && deleteResult) {
        health.components.kv_storage = {
          status: 'healthy',
          response_time_ms: kvDuration
        };
      } else {
        throw new Error('One or more DAL operations failed');
      }
    } catch (error: unknown) {
      health.components.kv_storage = {
        status: 'unhealthy',
        error: (error instanceof Error ? error.message : String(error))
      };
      health.status = 'degraded';
    }

    // Check AI models
    try {
      if (env.AI) {
        const timer = systemMetrics.timer('health.ai_check');

        await env.AI.run('@cf/openchat/openchat-3.5-0106', {
          messages: [{ role: 'user', content: 'health check' }],
          max_tokens: 5
        });

        const aiDuration = timer.stop();

        health.components.ai_models = {
          status: 'healthy',
          response_time_ms: aiDuration
        };
      } else {
        health.components.ai_models = {
          status: 'unavailable',
          error: 'AI binding not available'
        };
      }
    } catch (error: unknown) {
      health.components.ai_models = {
        status: 'unhealthy',
        error: (error instanceof Error ? error.message : String(error))
      };
      health.status = 'degraded';
    }

    // Add metrics summary
    health.metrics = {
      counters: Object.fromEntries((systemMetrics as any).counters),
      recent_timers: Array.from((systemMetrics as any).timers.values())
        .slice(-10)
        .map(({ name, duration, timestamp }) => ({ name, duration, timestamp }))
    };

    return health;
  },

  /**
   * Log health check result
   */
  logHealthCheck: (component, status, details = {}) => {
    logger.info(`Health check: ${component}`, {
      type: 'health_check',
      component,
      status,
      details,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Alert system (placeholder for future implementation)
 */
export const AlertManager = {
  /**
   * Send alert (placeholder)
   */
  sendAlert: (severity, message, context = {}) => {
    logger.warn(`Alert: ${message}`, {
      type: 'alert',
      severity,
      context,
      timestamp: new Date().toISOString()
    });

    // Future: Integration with Slack, Discord, email, etc.
  },

  /**
   * Check for alerting conditions
   */
  checkAlerts: (metrics: any) => {
    // Example alert conditions
    const alerts = [];

    // High error rate
    const errorRate = metrics.counters['api.requests[status:500]'] || 0;
    const totalRequests = Object.entries(metrics.counters)
      .filter(([key]) => key.startsWith('api.requests'))
      .reduce((sum, [, value]) => sum + (value as number), 0);

    if (totalRequests > 10 && errorRate / totalRequests > 0.1) {
      alerts.push({
        severity: 'high',
        message: `High error rate detected: ${Math.round(errorRate / totalRequests * 100)}%`,
        context: { errorRate, totalRequests }
      });
    }

    // Slow response times
    const recentTimers = Object.values(metrics.timers || {});
    const slowRequests = recentTimers.filter((timer: any) => (timer as any).duration > 5000);

    if (slowRequests.length > 0) {
      alerts.push({
        severity: 'medium',
        message: `Slow responses detected: ${slowRequests.length} requests > 5s`,
        context: { slowRequests: slowRequests.length }
      });
    }

    return alerts;
  }
};

/**
 * Export system metrics instance
 */
export { systemMetrics as SystemMetrics };

/**
 * Initialize monitoring
 */
export function initMonitoring(env: any) {
  logger.info('Monitoring system initialized', {
    timestamp: new Date().toISOString()
  });
}
