/**
 * SLO Monitoring and Alert Policies
 * Service Level Objectives monitoring with alerting for HTML endpoints
 */

import { createCache } from './cache-abstraction.js';
import type { CloudflareEnvironment } from '../types.js';

export interface SLOMetrics {
  endpoint: string;
  timestamp: string;
  requestId: string;
  responseTimeMs: number;
  statusCode: number;
  success: boolean;
  canaryStatus?: boolean;
  errorType?: string;
  userAgent?: string;
  userId?: string;
}

export interface SLOThresholds {
  // Response time thresholds (in milliseconds)
  p50ResponseTime: number;    // 50th percentile target
  p90ResponseTime: number;    // 90th percentile target
  p95ResponseTime: number;    // 95th percentile target
  p99ResponseTime: number;    // 99th percentile target

  // Availability thresholds
  availabilityTarget: number; // Percentage (0-100)
  errorRateThreshold: number; // Percentage (0-100)

  // Canary-specific thresholds
  canaryErrorRateThreshold: number; // Higher tolerance for canary
  canaryResponseTimeMultiplier: number; // Allow canary to be slower
}

export interface SLOStatus {
  endpoint: string;
  currentMetrics: {
    availability: number;
    errorRate: number;
    p50ResponseTime: number;
    p90ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  thresholds: SLOThresholds;
  complianceStatus: {
    availability: 'PASS' | 'WARN' | 'FAIL';
    errorRate: 'PASS' | 'WARN' | 'FAIL';
    responseTime: 'PASS' | 'WARN' | 'FAIL';
  };
  overall: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  lastUpdated: string;
  sampleSize: number;
}

export interface AlertPolicy {
  enabled: boolean;
  thresholdType: 'response_time' | 'error_rate' | 'availability';
  operator: 'gt' | 'lt' | 'eq';
  threshold: number;
  duration: number; // Minutes
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  channels: string[]; // webhook, email, slack
  cooldown: number; // Minutes between alerts
}

/**
 * SLO Monitoring Manager
 */
export class SLOMonitoringManager {
  private env: CloudflareEnvironment;
  private metricsBuffer: Map<string, SLOMetrics[]> = new Map();
  private alertCooldowns: Map<string, number> = new Map();

  // Default SLO thresholds for HTML endpoints
  private readonly defaultThresholds: Record<string, SLOThresholds> = {
    // Critical pages (main dashboard, pre-market)
    '/pre-market-briefing': {
      p50ResponseTime: 500,
      p90ResponseTime: 1000,
      p95ResponseTime: 1500,
      p99ResponseTime: 3000,
      availabilityTarget: 99.9,
      errorRateThreshold: 0.1,
      canaryErrorRateThreshold: 0.5,
      canaryResponseTimeMultiplier: 1.5
    },
    '/intraday-check': {
      p50ResponseTime: 300,
      p90ResponseTime: 800,
      p95ResponseTime: 1200,
      p99ResponseTime: 2000,
      availabilityTarget: 99.5,
      errorRateThreshold: 0.2,
      canaryErrorRateThreshold: 1.0,
      canaryResponseTimeMultiplier: 1.5
    },
    '/end-of-day-summary': {
      p50ResponseTime: 800,
      p90ResponseTime: 1500,
      p95ResponseTime: 2000,
      p99ResponseTime: 4000,
      availabilityTarget: 99.0,
      errorRateThreshold: 0.5,
      canaryErrorRateThreshold: 1.5,
      canaryResponseTimeMultiplier: 2.0
    },
    '/weekly-review': {
      p50ResponseTime: 1000,
      p90ResponseTime: 2000,
      p95ResponseTime: 3000,
      p99ResponseTime: 5000,
      availabilityTarget: 98.0,
      errorRateThreshold: 1.0,
      canaryErrorRateThreshold: 2.0,
      canaryResponseTimeMultiplier: 2.0
    },
    '/daily-summary': {
      p50ResponseTime: 600,
      p90ResponseTime: 1200,
      p95ResponseTime: 1800,
      p99ResponseTime: 3500,
      availabilityTarget: 99.0,
      errorRateThreshold: 0.5,
      canaryErrorRateThreshold: 1.0,
      canaryResponseTimeMultiplier: 1.5
    },
    '/weekly-analysis': {
      p50ResponseTime: 1200,
      p90ResponseTime: 2500,
      p95ResponseTime: 4000,
      p99ResponseTime: 6000,
      availabilityTarget: 97.0,
      errorRateThreshold: 1.5,
      canaryErrorRateThreshold: 3.0,
      canaryResponseTimeMultiplier: 2.0
    },
    // Default thresholds for other endpoints
    'default': {
      p50ResponseTime: 1000,
      p90ResponseTime: 2000,
      p95ResponseTime: 3000,
      p99ResponseTime: 5000,
      availabilityTarget: 95.0,
      errorRateThreshold: 2.0,
      canaryErrorRateThreshold: 5.0,
      canaryResponseTimeMultiplier: 2.0
    }
  };

  constructor(env: CloudflareEnvironment) {
    this.env = env;
  }

  /**
   * Record SLO metrics for a request
   */
  async recordMetrics(metrics: SLOMetrics): Promise<void> {
    const endpoint = metrics.endpoint;

    // Add to in-memory buffer
    if (!this.metricsBuffer.has(endpoint)) {
      this.metricsBuffer.set(endpoint, []);
    }

    const buffer = this.metricsBuffer.get(endpoint)!;
    buffer.push(metrics);

    // Keep only last 1000 metrics per endpoint
    if (buffer.length > 1000) {
      buffer.splice(0, buffer.length - 1000);
    }

    // Persist to DO periodically
    if (buffer.length % 10 === 0) {
      await this.persistMetrics(endpoint, buffer);
    }

    // Check for alerts
    await this.checkAlerts(endpoint, metrics);
  }

  /**
   * Get current SLO status for an endpoint
   */
  async getSLOStatus(endpoint: string, timeWindowMinutes: number = 60): Promise<SLOStatus> {
    const metrics = await this.getMetrics(endpoint, timeWindowMinutes);
    const thresholds = this.defaultThresholds[endpoint] || this.defaultThresholds['default'];

    // Calculate metrics
    const successfulRequests = metrics.filter(m => m.success && m.statusCode < 500).length;
    const totalRequests = metrics.length;

    const availability = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    const errorRate = totalRequests > 0 ? ((totalRequests - successfulRequests) / totalRequests) * 100 : 100;

    const responseTimes = metrics
      .filter(m => m.success)
      .map(m => m.responseTimeMs)
      .sort((a, b) => a - b);

    const percentiles = this.calculatePercentiles(responseTimes);

    // Check compliance
    const complianceStatus = {
      availability: this.checkThreshold(availability, thresholds.availabilityTarget, 'gt'),
      errorRate: this.checkThreshold(errorRate, thresholds.errorRateThreshold, 'lt'),
      responseTime: this.checkThreshold(percentiles.p95, thresholds.p95ResponseTime, 'lt')
    };

    // Overall status
    const failedChecks = Object.values(complianceStatus).filter(status => status === 'FAIL').length;
    const warningChecks = Object.values(complianceStatus).filter(status => status === 'WARN').length;

    let overall: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    if (failedChecks > 0) {
      overall = 'CRITICAL';
    } else if (warningChecks > 0) {
      overall = 'WARNING';
    } else {
      overall = 'HEALTHY';
    }

    return {
      endpoint,
      currentMetrics: {
        availability,
        errorRate,
        p50ResponseTime: percentiles.p50,
        p90ResponseTime: percentiles.p90,
        p95ResponseTime: percentiles.p95,
        p99ResponseTime: percentiles.p99
      },
      thresholds,
      complianceStatus,
      overall,
      lastUpdated: new Date().toISOString(),
      sampleSize: totalRequests
    };
  }

  /**
   * Get all SLO statuses
   */
  async getAllSLOStatuses(): Promise<SLOStatus[]> {
    const endpoints = [
      '/pre-market-briefing',
      '/intraday-check',
      '/end-of-day-summary',
      '/weekly-review',
      '/daily-summary',
      '/weekly-analysis'
    ];

    const statuses = await Promise.all(
      endpoints.map(endpoint => this.getSLOStatus(endpoint))
    );

    return statuses;
  }

  /**
   * Check if alert should be triggered
   */
  private async checkAlerts(endpoint: string, metrics: SLOMetrics): Promise<void> {
    const thresholds = this.defaultThresholds[endpoint] || this.defaultThresholds['default'];

    // Response time alert
    if (metrics.responseTimeMs > thresholds.p95ResponseTime) {
      await this.triggerAlert('response_time', endpoint, {
        actual: metrics.responseTimeMs,
        threshold: thresholds.p95ResponseTime,
        severity: metrics.responseTimeMs > thresholds.p99ResponseTime ? 'CRITICAL' : 'WARNING'
      });
    }

    // Error rate alert (need to aggregate over time)
    const recentMetrics = await this.getMetrics(endpoint, 5); // Last 5 minutes
    if (recentMetrics.length >= 10) { // Minimum sample size
      const errorRate = this.calculateErrorRate(recentMetrics);
      const threshold = metrics.canaryStatus ? thresholds.canaryErrorRateThreshold : thresholds.errorRateThreshold;

      if (errorRate > threshold) {
        await this.triggerAlert('error_rate', endpoint, {
          actual: errorRate,
          threshold,
          severity: errorRate > threshold * 2 ? 'CRITICAL' : 'WARNING',
          timeWindow: '5 minutes'
        });
      }
    }
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(
    type: 'response_time' | 'error_rate',
    endpoint: string,
    details: any
  ): Promise<void> {
    const alertKey = `${type}:${endpoint}`;
    const now = Date.now();
    const lastAlert = this.alertCooldowns.get(alertKey) || 0;

    // Check cooldown (15 minutes default)
    if (now - lastAlert < 15 * 60 * 1000) {
      return;
    }

    // Update cooldown
    this.alertCooldowns.set(alertKey, now);

    // Create alert
    const alert = {
      id: crypto.randomUUID(),
      type,
      endpoint,
      severity: details.severity,
      timestamp: new Date().toISOString(),
      details,
      metadata: {
        requestId: details.requestId || 'unknown',
        canaryStatus: details.canaryStatus || false
      }
    };

    // Store alert in KV
    try {
      const alertKey = `alert:${alert.id}`;
      const cache = createCache(this.env);
      await cache.put(alertKey, alert, { expirationTtl: 24 * 60 * 60 });
    } catch (error) {
      console.error('Failed to store alert:', error);
    }

    // Log alert
    console.warn('SLO Alert triggered:', alert);

    // Here you could integrate with external alerting systems
    // - Send to webhook
    // - Send email notification
    // - Send to Slack
    // - Create PagerDuty incident
  }

  /**
   * Get metrics for endpoint from storage
   */
  private async getMetrics(endpoint: string, timeWindowMinutes: number): Promise<SLOMetrics[]> {
    try {
      // Try in-memory buffer first
      const buffer = this.metricsBuffer.get(endpoint) || [];
      const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

      const recentBuffer = buffer.filter(m => new Date(m.timestamp) > cutoffTime);

      // If we have enough recent metrics, use them
      if (recentBuffer.length >= 50) {
        return recentBuffer;
      }

      // Otherwise, try to get from DO
      const storageKey = `slo_metrics:${endpoint}:${Math.floor(Date.now() / (60 * 1000))}`;
      const cache = createCache(this.env);
      const stored = await cache.get(storageKey);
      if (stored) {
        return [...recentBuffer, ...(stored as SLOMetrics[])].filter(m => new Date(m.timestamp) > cutoffTime);
      }

      return recentBuffer;
    } catch (error) {
      console.error('Error getting SLO metrics:', error);
      return [];
    }
  }

  /**
   * Persist metrics to storage
   */
  private async persistMetrics(endpoint: string, metrics: SLOMetrics[]): Promise<void> {
    try {
      const storageKey = `slo_metrics:${endpoint}:${Math.floor(Date.now() / (60 * 1000))}`;
      const cache = createCache(this.env);
      await cache.put(storageKey, metrics, { expirationTtl: 7 * 24 * 60 * 60 });
    } catch (error) {
      console.error('Error persisting SLO metrics:', error);
    }
  }

  /**
   * Calculate percentiles
   */
  private calculatePercentiles(values: number[]): {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } {
    if (values.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);

    return {
      p50: this.getPercentile(sorted, 0.5),
      p90: this.getPercentile(sorted, 0.9),
      p95: this.getPercentile(sorted, 0.95),
      p99: this.getPercentile(sorted, 0.99)
    };
  }

  /**
   * Get percentile value
   */
  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(metrics: SLOMetrics[]): number {
    if (metrics.length === 0) return 100;

    const errors = metrics.filter(m => !m.success || m.statusCode >= 500).length;
    return (errors / metrics.length) * 100;
  }

  /**
   * Check threshold compliance
   */
  private checkThreshold(
    actual: number,
    threshold: number,
    operator: 'gt' | 'lt'
  ): 'PASS' | 'WARN' | 'FAIL' {
    const tolerance = 0.1; // 10% tolerance for warnings

    if (operator === 'gt') {
      if (actual >= threshold) return 'PASS';
      if (actual >= threshold * (1 - tolerance)) return 'WARN';
      return 'FAIL';
    } else {
      if (actual <= threshold) return 'PASS';
      if (actual <= threshold * (1 + tolerance)) return 'WARN';
      return 'FAIL';
    }
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts(timeWindowMinutes: number = 60): Promise<any[]> {
    try {
      // For simplicity, return empty array
      // In a real implementation, you'd query KV for recent alerts
      return [];
    } catch (error) {
      console.error('Error getting recent alerts:', error);
      return [];
    }
  }

  /**
   * Clear metrics buffer
   */
  clearMetrics(): void {
    this.metricsBuffer.clear();
    this.alertCooldowns.clear();
  }
}

/**
 * Create SLO monitoring middleware
 */
export function createSLOMonitoringMiddleware(
  sloManager: SLOMonitoringManager
) {
  return async (request: Request, response: Response, endpoint: string): Promise<void> => {
    const startTime = Date.now();
    const success = response.ok && response.status < 500;
    const responseTime = Date.now() - startTime;

    const metrics: SLOMetrics = {
      endpoint,
      timestamp: new Date().toISOString(),
      requestId: request.headers.get('X-Request-ID') || crypto.randomUUID(),
      responseTimeMs: responseTime,
      statusCode: response.status,
      success,
      canaryStatus: response.headers.get('X-Canary-Status') === 'true',
      userAgent: request.headers.get('User-Agent') || 'unknown',
      errorType: success ? undefined : 'http_error'
    };

    await sloManager.recordMetrics(metrics);
  };
}