/**
 * Production Monitoring and Metrics System
 * Tracks system performance, business metrics, and operational health
 */

import { createLogger } from './logging.js';
import { CONFIG } from './config.js';

const logger = createLogger('monitoring');

/**
 * System metrics collection
 */
class SystemMetrics {
  constructor() {
    this.metrics = new Map();
    this.counters = new Map();
    this.timers = new Map();
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name, value = 1, tags = {}) {
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
  recordGauge(name, value, tags = {}) {
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
  recordTimer(name, duration, tags = {}) {
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
  timer(name, tags = {}) {
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
  createMetricKey(name, tags) {
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
  analysisRequested: (type, symbols) => {
    systemMetrics.incrementCounter('analysis.requested', 1, { type });
    systemMetrics.recordGauge('analysis.symbols_count', symbols, { type });
  },

  analysisCompleted: (type, symbols, duration) => {
    systemMetrics.incrementCounter('analysis.completed', 1, { type });
    systemMetrics.recordTimer('analysis.duration', duration, { type });
    systemMetrics.recordGauge('analysis.success_rate', 100, { type });
  },

  analysisFailed: (type, error) => {
    systemMetrics.incrementCounter('analysis.failed', 1, { type, error });
    systemMetrics.recordGauge('analysis.success_rate', 0, { type });
  },

  // Prediction metrics
  predictionMade: (symbol, confidence, direction) => {
    systemMetrics.incrementCounter('predictions.made', 1, { symbol, direction });
    systemMetrics.recordGauge('predictions.confidence', confidence * 100, { symbol });
  },

  predictionValidated: (symbol, correct, confidence) => {
    systemMetrics.incrementCounter('predictions.validated', 1, { symbol, correct: correct.toString() });
    systemMetrics.recordGauge('predictions.accuracy', correct ? 100 : 0, { symbol });
  },

  // API metrics
  apiRequest: (endpoint, method, status, duration) => {
    systemMetrics.incrementCounter('api.requests', 1, { endpoint, method, status: status.toString() });
    systemMetrics.recordTimer('api.response_time', duration, { endpoint });
  },

  // Facebook metrics
  facebookMessageSent: (type, success) => {
    systemMetrics.incrementCounter('facebook.messages_sent', 1, { type, success: success.toString() });
  },

  // KV storage metrics
  kvOperation: (operation, success, duration) => {
    systemMetrics.incrementCounter('kv.operations', 1, { operation, success: success.toString() });
    systemMetrics.recordTimer('kv.operation_time', duration, { operation });
  },

  // Daily summary metrics
  dailySummaryGenerated: (date, predictions) => {
    systemMetrics.incrementCounter('daily_summary.generated', 1, { date });
    systemMetrics.recordGauge('daily_summary.predictions', predictions, { date });
  },

  dailySummaryViewed: (date) => {
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
  trackPredictionAccuracy: (accuracy) => {
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
  trackPerformanceKPI: (responseTime, operation) => {
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
  trackUptimeKPI: (uptimePercentage) => {
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
function getLatestGauge(gauges, metricName) {
  const matching = Object.entries(gauges)
    .filter(([key]) => key.startsWith(metricName))
    .map(([, value]) => value)
    .sort((a, b) => b.timestamp - a.timestamp);

  return matching.length > 0 ? matching[0].value : null;
}

function getLatestTimer(timers, metricName) {
  const matching = Object.entries(timers)
    .filter(([key]) => key.startsWith(metricName))
    .map(([, value]) => value)
    .sort((a, b) => b.timestamp - a.timestamp);

  return matching.length > 0 ? matching[0].duration : null;
}

function getLatestCounter(counters, metricName) {
  const matching = Object.entries(counters)
    .filter(([key]) => key.startsWith(metricName))
    .reduce((sum, [, value]) => sum + value, 0);

  return matching;
}

function getKPIStatus(performanceMetric, gauges) {
  const performance = getLatestGauge(gauges, performanceMetric);
  if (performance === null) return 'unknown';
  if (performance >= 95) return 'excellent';
  if (performance >= 80) return 'good';
  if (performance >= 60) return 'acceptable';
  return 'poor';
}

function calculateOverallKPIHealth(metrics) {
  const kpiMetrics = [
    getLatestGauge(metrics.gauges, 'kpi.prediction_accuracy_vs_target'),
    getLatestGauge(metrics.gauges, 'kpi.response_time_performance'),
    getLatestGauge(metrics.gauges, 'kpi.cost_efficiency'),
    getLatestGauge(metrics.gauges, 'kpi.uptime_performance'),
    getLatestGauge(metrics.gauges, 'kpi.cron_reliability')
  ].filter(v => v !== null);

  if (kpiMetrics.length === 0) return 'unknown';

  const avgPerformance = kpiMetrics.reduce((sum, val) => sum + val, 0) / kpiMetrics.length;

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
  monitorRequest: (request, handler) => {
    const url = new URL(request.url);
    const startTime = Date.now();

    return {
      complete: (response) => {
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
      components: {},
      metrics: {}
    };

    // Check KV storage
    try {
      const testKey = `health_check_${Date.now()}`;
      const timer = systemMetrics.timer('health.kv_check');

      await env.TRADING_RESULTS.put(testKey, 'test');
      await env.TRADING_RESULTS.get(testKey);
      await env.TRADING_RESULTS.delete(testKey);

      const kvDuration = timer.stop();

      health.components.kv_storage = {
        status: 'healthy',
        response_time_ms: kvDuration
      };
    } catch (error) {
      health.components.kv_storage = {
        status: 'unhealthy',
        error: error.message
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
    } catch (error) {
      health.components.ai_models = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Add metrics summary
    health.metrics = {
      counters: Object.fromEntries(systemMetrics.counters),
      recent_timers: Array.from(systemMetrics.timers.values())
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
  checkAlerts: (metrics) => {
    // Example alert conditions
    const alerts = [];

    // High error rate
    const errorRate = metrics.counters['api.requests[status:500]'] || 0;
    const totalRequests = Object.entries(metrics.counters)
      .filter(([key]) => key.startsWith('api.requests'))
      .reduce((sum, [, value]) => sum + value, 0);

    if (totalRequests > 10 && errorRate / totalRequests > 0.1) {
      alerts.push({
        severity: 'high',
        message: `High error rate detected: ${Math.round(errorRate / totalRequests * 100)}%`,
        context: { errorRate, totalRequests }
      });
    }

    // Slow response times
    const recentTimers = Object.values(metrics.timers || {});
    const slowRequests = recentTimers.filter(timer => timer.duration > 5000);

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
export function initMonitoring(env) {
  logger.info('Monitoring system initialized', {
    timestamp: new Date().toISOString()
  });
}