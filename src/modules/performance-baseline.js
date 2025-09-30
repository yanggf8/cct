/**
 * Performance Baseline Monitoring Module
 * Tracks and analyzes system performance trends over time
 */

import { createLogger } from './logging.js';
import { CONFIG } from './config.js';
import { BusinessKPI, SystemMetrics } from './monitoring.js';
import { createDAL } from './dal.js';

const logger = createLogger('performance-baseline');

/**
 * Performance baseline tracking
 */
export class PerformanceBaseline {
  constructor(env) {
    this.env = env;
    this.metrics = new Map();
    this.trends = new Map();
  }

  /**
   * Record a performance measurement
   */
  async recordMeasurement(operation, value, metadata = {}) {
    const timestamp = Date.now();
    const measurement = {
      operation,
      value,
      timestamp,
      metadata
    };

    // Store in KV for persistence
    const key = `perf_baseline_${operation}_${timestamp}`;
    const dal = createDAL(this.env);
    const writeResult = await dal.write(key, measurement, {
      expirationTtl: CONFIG.KV_STORAGE.GRANULAR_TTL // 90 days
    });

    if (!writeResult.success) {
      logger.warn('Failed to write performance measurement', {
        operation,
        error: writeResult.error
      });
    }

    // Update in-memory cache
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const operationMetrics = this.metrics.get(operation);
    operationMetrics.push(measurement);

    // Keep only recent measurements in memory (last 100)
    if (operationMetrics.length > 100) {
      operationMetrics.splice(0, operationMetrics.length - 100);
    }

    logger.info('Performance measurement recorded', {
      operation,
      value,
      trend: this.calculateTrend(operation),
      metadata
    });
  }

  /**
   * Calculate performance trend for an operation
   */
  calculateTrend(operation) {
    const measurements = this.metrics.get(operation) || [];
    if (measurements.length < 2) return 'insufficient-data';

    const recent = measurements.slice(-10); // Last 10 measurements
    const older = measurements.slice(-20, -10); // Previous 10 measurements

    if (older.length === 0) return 'baseline-establishing';

    const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.value, 0) / older.length;

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (Math.abs(changePercent) < 5) return 'stable';
    if (changePercent > 0) return 'degrading';
    return 'improving';
  }

  /**
   * Get performance baseline report
   */
  async getBaselineReport(timeframe = '24h') {
    const now = Date.now();
    const timeframeMs = this.parseTimeframe(timeframe);
    const since = now - timeframeMs;

    const report = {
      timeframe,
      generatedAt: new Date().toISOString(),
      operations: {},
      summary: {
        totalMeasurements: 0,
        operationsTracked: 0,
        trends: {
          improving: 0,
          stable: 0,
          degrading: 0
        }
      }
    };

    // Analyze each tracked operation
    for (const [operation, measurements] of this.metrics.entries()) {
      const recentMeasurements = measurements.filter(m => m.timestamp >= since);

      if (recentMeasurements.length === 0) continue;

      const values = recentMeasurements.map(m => m.value);
      const trend = this.calculateTrend(operation);

      const operationReport = {
        measurements: recentMeasurements.length,
        average: values.reduce((sum, v) => sum + v, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        trend,
        target: this.getOperationTarget(operation),
        status: this.getOperationStatus(operation, values)
      };

      report.operations[operation] = operationReport;
      report.summary.totalMeasurements += recentMeasurements.length;
      report.summary.operationsTracked++;

      // Count trends
      if (trend === 'improving') report.summary.trends.improving++;
      else if (trend === 'stable') report.summary.trends.stable++;
      else if (trend === 'degrading') report.summary.trends.degrading++;
    }

    return report;
  }

  /**
   * Get operation target based on business KPIs
   */
  getOperationTarget(operation) {
    const targetMap = {
      'api_response_time': CONFIG.BUSINESS_KPI.RESPONSE_TIME_TARGET_MS,
      'analysis_duration': 30000, // 30 seconds
      'kv_operation_time': 1000, // 1 second
      'prediction_accuracy': CONFIG.BUSINESS_KPI.PREDICTION_ACCURACY_TARGET * 100
    };

    return targetMap[operation] || null;
  }

  /**
   * Get operation status vs target
   */
  getOperationStatus(operation, values) {
    const target = this.getOperationTarget(operation);
    if (!target) return 'unknown';

    const average = values.reduce((sum, v) => sum + v, 0) / values.length;

    // For time-based metrics, lower is better
    if (operation.includes('time') || operation.includes('duration')) {
      if (average <= target * 0.8) return 'excellent';
      if (average <= target) return 'good';
      if (average <= target * 1.2) return 'acceptable';
      return 'poor';
    }

    // For accuracy metrics, higher is better
    if (operation.includes('accuracy')) {
      if (average >= target * 1.1) return 'excellent';
      if (average >= target) return 'good';
      if (average >= target * 0.9) return 'acceptable';
      return 'poor';
    }

    return 'unknown';
  }

  /**
   * Parse timeframe string to milliseconds
   */
  parseTimeframe(timeframe) {
    const timeframeMap = {
      '1h': 3600000,
      '6h': 21600000,
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000
    };

    return timeframeMap[timeframe] || 86400000; // Default to 24h
  }

  /**
   * Check for performance alerts
   */
  async checkPerformanceAlerts() {
    const alerts = [];
    const report = await this.getBaselineReport('1h');

    for (const [operation, data] of Object.entries(report.operations)) {
      // Alert on degrading trends
      if (data.trend === 'degrading') {
        alerts.push({
          severity: 'medium',
          operation,
          message: `Performance degrading for ${operation}`,
          current: data.average,
          target: data.target,
          trend: data.trend
        });
      }

      // Alert on poor performance vs targets
      if (data.status === 'poor') {
        alerts.push({
          severity: 'high',
          operation,
          message: `Performance below target for ${operation}`,
          current: data.average,
          target: data.target,
          status: data.status
        });
      }
    }

    if (alerts.length > 0) {
      logger.warn('Performance alerts detected', {
        alertCount: alerts.length,
        alerts: alerts.slice(0, 3) // Log first 3 alerts
      });
    }

    return alerts;
  }

  /**
   * Get weekly performance summary
   */
  async getWeeklySummary() {
    const weeklyReport = await this.getBaselineReport('7d');

    const summary = {
      period: '7 days',
      generatedAt: new Date().toISOString(),
      overallHealth: this.calculateOverallHealth(weeklyReport),
      keyMetrics: {},
      trends: weeklyReport.summary.trends,
      recommendations: []
    };

    // Extract key metrics
    for (const [operation, data] of Object.entries(weeklyReport.operations)) {
      if (['api_response_time', 'analysis_duration', 'prediction_accuracy'].includes(operation)) {
        summary.keyMetrics[operation] = {
          average: Math.round(data.average),
          target: data.target,
          status: data.status,
          trend: data.trend
        };
      }
    }

    // Generate recommendations
    summary.recommendations = this.generateRecommendations(weeklyReport);

    return summary;
  }

  /**
   * Calculate overall health from report
   */
  calculateOverallHealth(report) {
    let excellentCount = 0;
    let goodCount = 0;
    let acceptableCount = 0;
    let poorCount = 0;

    for (const data of Object.values(report.operations)) {
      switch (data.status) {
        case 'excellent': excellentCount++; break;
        case 'good': goodCount++; break;
        case 'acceptable': acceptableCount++; break;
        case 'poor': poorCount++; break;
      }
    }

    const total = excellentCount + goodCount + acceptableCount + poorCount;
    if (total === 0) return 'unknown';

    const excellentPercent = (excellentCount / total) * 100;
    const goodPercent = ((excellentCount + goodCount) / total) * 100;

    if (excellentPercent >= 80) return 'excellent';
    if (goodPercent >= 80) return 'good';
    if (poorCount === 0) return 'acceptable';
    return 'needs-attention';
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(report) {
    const recommendations = [];

    for (const [operation, data] of Object.entries(report.operations)) {
      if (data.trend === 'degrading') {
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          operation,
          message: `Monitor ${operation} - showing degrading trend`,
          action: 'investigate recent changes and optimize if needed'
        });
      }

      if (data.status === 'poor') {
        recommendations.push({
          type: 'performance',
          priority: 'high',
          operation,
          message: `Optimize ${operation} - performing below target`,
          action: `Current: ${Math.round(data.average)}, Target: ${data.target}`
        });
      }
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }
}

/**
 * Global performance tracker instance
 */
let globalTracker = null;

/**
 * Get or create global performance tracker
 */
export function getPerformanceTracker(env) {
  if (!globalTracker) {
    globalTracker = new PerformanceBaseline(env);
  }
  return globalTracker;
}

/**
 * Middleware to automatically track request performance
 */
export function trackRequestPerformance(operation) {
  return {
    start: () => {
      return Date.now();
    },
    end: async (startTime, env, metadata = {}) => {
      const duration = Date.now() - startTime;
      const tracker = getPerformanceTracker(env);
      await tracker.recordMeasurement(operation, duration, metadata);

      // Track business KPI if it's a critical operation
      if (operation === 'api_response_time') {
        BusinessKPI.trackPerformanceKPI(duration, operation);
      }

      return duration;
    }
  };
}