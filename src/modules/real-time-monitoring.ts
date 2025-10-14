/**
 * Real-time Monitoring System
 *
 * Comprehensive monitoring and alerting system for the real-time data integration platform.
 * Provides real-time metrics, automated health checks, performance monitoring, and alerting.
 *
 * Features:
 * - Real-time API health monitoring
 * - Performance metrics collection
 * - Automated alerting system
 * - Dashboard data aggregation
 * - System health scoring
 * - Historical metrics tracking
 *
 * @author Real-time Data Integration - Phase 5
 * @since 2025-10-14
 */

import { createLogger } from './logging.js';
import { initializeAPIHealthMonitor, type SystemHealthReport } from './api-health-monitor.js';
import { initializeIntegrationTestSuite, type TestSuite } from './integration-test-suite.js';
import { CacheManager } from './cache-manager.js';
import { CircuitBreakerFactory } from './circuit-breaker.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('real-time-monitoring');

/**
 * System Metrics Interface
 */
export interface SystemMetrics {
  timestamp: string;
  uptime_ms: number;
  api_health: {
    fred_api: 'healthy' | 'degraded' | 'unhealthy';
    yahoo_finance: 'healthy' | 'degraded' | 'unhealthy';
    ai_models: 'healthy' | 'degraded' | 'unhealthy';
    cache_system: 'healthy' | 'degraded' | 'unhealthy';
  };
  performance: {
    average_response_time_ms: number;
    success_rate: number;
    error_rate: number;
    requests_per_minute: number;
  };
  data_quality: {
    real_data_available: boolean;
    data_freshness_hours: number;
    cache_hit_rate: number;
    validation_pass_rate: number;
  };
  system_health: {
    overall_score: number; // 0-100
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    active_alerts: number;
    last_health_check: string;
  };
}

/**
 * Alert Configuration
 */
export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'api' | 'performance' | 'data_quality' | 'system';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  resolved_at?: string;
  metadata?: any;
}

/**
 * Monitoring Dashboard Data
 */
export interface MonitoringDashboard {
  timestamp: string;
  system_metrics: SystemMetrics;
  recent_health_reports: SystemHealthReport[];
  recent_test_results: TestSuite[];
  active_alerts: Alert[];
  performance_trends: {
    response_time_trend: Array<{ timestamp: string; value: number }>;
    success_rate_trend: Array<{ timestamp: string; value: number }>;
    error_rate_trend: Array<{ timestamp: string; value: number }>;
  };
}

/**
 * Real-time Monitoring System Configuration
 */
export interface MonitoringConfig {
  healthCheckIntervalMinutes?: number;
  performanceTrackingEnabled?: boolean;
  alertingEnabled?: boolean;
  maxAlerts?: number;
  metricsRetentionHours?: number;
  dashboardRefreshIntervalSeconds?: number;
}

/**
 * Real-time Monitoring System Implementation
 */
export class RealTimeMonitoringSystem {
  private env: CloudflareEnvironment;
  private config: MonitoringConfig;
  private healthMonitor;
  private testSuite;
  private cacheManager;
  private startTime: number;
  private activeAlerts: Map<string, Alert> = new Map();
  private metricsHistory: SystemMetrics[] = [];

  constructor(env: CloudflareEnvironment, config: MonitoringConfig = {}) {
    this.env = env;
    this.config = {
      healthCheckIntervalMinutes: 5,
      performanceTrackingEnabled: true,
      alertingEnabled: true,
      maxAlerts: 50,
      metricsRetentionHours: 24,
      dashboardRefreshIntervalSeconds: 30,
      ...config
    };

    this.healthMonitor = initializeAPIHealthMonitor(env, {
      enableAutoChecks: true,
      checkIntervalMinutes: this.config.healthCheckIntervalMinutes,
      enableAlerts: this.config.alertingEnabled
    });

    this.testSuite = initializeIntegrationTestSuite(env, {
      enablePerformanceTests: true,
      enableDataQualityTests: true,
      enableEndToEndTests: false // Skip expensive tests in monitoring
    });

    this.cacheManager = new CacheManager(env);
    this.startTime = Date.now();
  }

  /**
   * Get current system metrics
   */
  async getCurrentMetrics(): Promise<SystemMetrics> {
    try {
      const now = Date.now();
      const uptime = now - this.startTime;

      // Get API health status
      const healthReport = await this.healthMonitor.performAllHealthChecks();

      // Calculate performance metrics
      const performanceMetrics = await this.calculatePerformanceMetrics();

      // Get data quality metrics
      const dataQualityMetrics = await this.calculateDataQualityMetrics();

      // Calculate overall system health score
      const healthScore = this.calculateHealthScore(healthReport, performanceMetrics, dataQualityMetrics);

      const metrics: SystemMetrics = {
        timestamp: new Date().toISOString(),
        uptime_ms: uptime,
        api_health: {
          fred_api: healthReport.apis.fred?.status || 'unhealthy',
          yahoo_finance: healthReport.apis['yahoo-finance']?.status || 'unhealthy',
          ai_models: healthReport.apis.circuit_breaker?.status || 'unhealthy',
          cache_system: healthReport.apis.cache?.status || 'unhealthy'
        },
        performance: {
          average_response_time_ms: performanceMetrics.avgResponseTime,
          success_rate: performanceMetrics.successRate,
          error_rate: performanceMetrics.errorRate,
          requests_per_minute: performanceMetrics.requestsPerMinute
        },
        data_quality: {
          real_data_available: dataQualityMetrics.realDataAvailable,
          data_freshness_hours: dataQualityMetrics.dataFreshnessHours,
          cache_hit_rate: dataQualityMetrics.cacheHitRate,
          validation_pass_rate: dataQualityMetrics.validationPassRate
        },
        system_health: {
          overall_score: healthScore,
          status: this.getHealthStatus(healthScore),
          active_alerts: this.activeAlerts.size,
          last_health_check: new Date().toISOString()
        }
      };

      // Store metrics in history
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > this.getMetricsRetentionLimit()) {
        this.metricsHistory.shift(); // Remove oldest metrics
      }

      // Check for alerts
      if (this.config.alertingEnabled) {
        await this.checkForAlerts(metrics);
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to get current metrics:', error);

      // Return degraded metrics
      return {
        timestamp: new Date().toISOString(),
        uptime_ms: Date.now() - this.startTime,
        api_health: {
          fred_api: 'unhealthy',
          yahoo_finance: 'unhealthy',
          ai_models: 'unhealthy',
          cache_system: 'unhealthy'
        },
        performance: {
          average_response_time_ms: 9999,
          success_rate: 0,
          error_rate: 100,
          requests_per_minute: 0
        },
        data_quality: {
          real_data_available: false,
          data_freshness_hours: 999,
          cache_hit_rate: 0,
          validation_pass_rate: 0
        },
        system_health: {
          overall_score: 0,
          status: 'critical',
          active_alerts: this.activeAlerts.size,
          last_health_check: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Get monitoring dashboard data
   */
  async getDashboardData(): Promise<MonitoringDashboard> {
    try {
      // Get current metrics
      const systemMetrics = await this.getCurrentMetrics();

      // Get recent health reports
      const recentHealthReports = await this.getRecentHealthReports();

      // Get recent test results
      const recentTestResults = await this.getRecentTestResults();

      // Calculate performance trends
      const performanceTrends = this.calculatePerformanceTrends();

      const dashboard: MonitoringDashboard = {
        timestamp: new Date().toISOString(),
        system_metrics: systemMetrics,
        recent_health_reports: recentHealthReports,
        recent_test_results: recentTestResults,
        active_alerts: Array.from(this.activeAlerts.values()),
        performance_trends: performanceTrends
      };

      return dashboard;
    } catch (error) {
      logger.error('Failed to get dashboard data:', error);
      throw error;
    }
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(): Promise<{
    avgResponseTime: number;
    successRate: number;
    errorRate: number;
    requestsPerMinute: number;
  }> {
    try {
      // Get circuit breaker metrics for performance indicators
      const circuitBreaker = CircuitBreakerFactory.getInstance('api-health-monitor');
      const cbMetrics = circuitBreaker.getMetrics();

      // Get cache statistics
      const cacheStats = this.cacheManager.getCacheStats();

      // Calculate metrics
      const avgResponseTime = cbMetrics.averageResponseTime || 0;
      const successRate = cbMetrics.successRate || 0;
      const errorRate = (1 - successRate) * 100;
      const requestsPerMinute = cbMetrics.requestCount || 0;

      return {
        avgResponseTime,
        successRate: successRate * 100,
        errorRate,
        requestsPerMinute
      };
    } catch (error) {
      logger.warn('Failed to calculate performance metrics:', error);
      return {
        avgResponseTime: 0,
        successRate: 0,
        errorRate: 100,
        requestsPerMinute: 0
      };
    }
  }

  /**
   * Calculate data quality metrics
   */
  private async calculateDataQualityMetrics(): Promise<{
    realDataAvailable: boolean;
    dataFreshnessHours: number;
    cacheHitRate: number;
    validationPassRate: number;
  }> {
    try {
      // Check if real API keys are configured
      const hasRealFREDKey = this.env.FRED_API_KEY && !['demo-key', 'mock-key', 'test-key'].includes(this.env.FRED_API_KEY);

      // Get cache statistics
      const cacheStats = this.cacheManager.getCacheStats();

      // Mock data freshness calculation (would be based on actual data timestamps)
      const dataFreshnessHours = hasRealFREDKey ? 0.5 : 999; // 30 minutes for real data

      return {
        realDataAvailable: hasRealFREDKey,
        dataFreshnessHours,
        cacheHitRate: cacheStats.overallHitRate || 0,
        validationPassRate: 0.95 // Mock validation pass rate
      };
    } catch (error) {
      logger.warn('Failed to calculate data quality metrics:', error);
      return {
        realDataAvailable: false,
        dataFreshnessHours: 999,
        cacheHitRate: 0,
        validationPassRate: 0
      };
    }
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(
    healthReport: SystemHealthReport,
    performanceMetrics: any,
    dataQualityMetrics: any
  ): number {
    let score = 0;

    // API health (40% weight)
    const healthyAPIs = Object.values(healthReport.apis).filter(api => api.status === 'healthy').length;
    const totalAPIs = Object.keys(healthReport.apis).length;
    score += (healthyAPIs / totalAPIs) * 40;

    // Performance (30% weight)
    const performanceScore = performanceMetrics.successRate >= 95 ? 30 :
                            performanceMetrics.successRate >= 90 ? 20 :
                            performanceMetrics.successRate >= 80 ? 10 : 0;
    score += performanceScore;

    // Data quality (30% weight)
    const dataQualityScore = dataQualityMetrics.realDataAvailable ? 15 : 0;
    const freshnessScore = dataQualityMetrics.dataFreshnessHours < 1 ? 15 : 0;
    score += dataQualityScore + freshnessScore;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Get health status based on score
   */
  private getHealthStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }

  /**
   * Check for alerts based on metrics
   */
  private async checkForAlerts(metrics: SystemMetrics): Promise<void> {
    const now = new Date().toISOString();

    // Check for critical alerts
    if (metrics.system_health.overall_score < 40) {
      await this.createAlert({
        type: 'critical',
        category: 'system',
        title: 'Critical System Health',
        message: `System health score is ${metrics.system_health.overall_score}`,
        timestamp: now,
        resolved: false
      });
    }

    // Check for API alerts
    if (metrics.api_health.fred_api === 'unhealthy') {
      await this.createAlert({
        type: 'critical',
        category: 'api',
        title: 'FRED API Unhealthy',
        message: 'FRED API is not responding correctly',
        timestamp: now,
        resolved: false
      });
    }

    if (metrics.api_health.yahoo_finance === 'unhealthy') {
      await this.createAlert({
        type: 'critical',
        category: 'api',
        title: 'Yahoo Finance API Unhealthy',
        message: 'Yahoo Finance API is not responding correctly',
        timestamp: now,
        resolved: false
      });
    }

    // Check for performance alerts
    if (metrics.performance.error_rate > 10) {
      await this.createAlert({
        type: 'warning',
        category: 'performance',
        title: 'High Error Rate',
        message: `Error rate is ${metrics.performance.error_rate}%`,
        timestamp: now,
        resolved: false
      });
    }

    if (metrics.performance.average_response_time_ms > 5000) {
      await this.createAlert({
        type: 'warning',
        category: 'performance',
        title: 'High Response Time',
        message: `Average response time is ${metrics.performance.average_response_time_ms}ms`,
        timestamp: now,
        resolved: false
      });
    }

    // Check for data quality alerts
    if (!metrics.data_quality.real_data_available) {
      await this.createAlert({
        type: 'warning',
        category: 'data_quality',
        title: 'Mock Data in Use',
        message: 'System is using mock data instead of real API data',
        timestamp: now,
        resolved: false
      });
    }

    if (metrics.data_quality.data_freshness_hours > 24) {
      await this.createAlert({
        type: 'warning',
        category: 'data_quality',
        title: 'Stale Data',
        message: `Data is ${metrics.data_quality.data_freshness_hours} hours old`,
        timestamp: now,
        resolved: false
      });
    }
  }

  /**
   * Create and manage alerts
   */
  private async createAlert(alert: Omit<Alert, 'id'>): Promise<void> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullAlert: Alert = {
      ...alert,
      id: alertId
    };

    // Add to active alerts
    this.activeAlerts.set(alertId, fullAlert);

    // Clean up old alerts if too many
    if (this.activeAlerts.size > this.config.maxAlerts) {
      const sortedAlerts = Array.from(this.activeAlerts.entries())
        .sort(([, a], [, b]) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Remove oldest alerts
      const toRemove = sortedAlerts.slice(0, sortedAlerts.length - this.config.maxAlerts);
      toRemove.forEach(([id]) => this.activeAlerts.delete(id));
    }

    logger.warn('Alert created', {
      alertId: fullAlert.id,
      type: fullAlert.type,
      category: fullAlert.category,
      title: fullAlert.title
    });
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolved_at = new Date().toISOString();
      logger.info('Alert resolved', { alertId, title: alert.title });
    }
  }

  /**
   * Get recent health reports
   */
  private async getRecentHealthReports(): Promise<SystemHealthReport[]> {
    try {
      // In a real implementation, this would fetch from a database or cache
      // For now, return empty array
      return [];
    } catch (error) {
      logger.warn('Failed to get recent health reports:', error);
      return [];
    }
  }

  /**
   * Get recent test results
   */
  private async getRecentTestResults(): Promise<TestSuite[]> {
    try {
      // In a real implementation, this would fetch from a database or cache
      // For now, return empty array
      return [];
    } catch (error) {
      logger.warn('Failed to get recent test results:', error);
      return [];
    }
  }

  /**
   * Calculate performance trends
   */
  private calculatePerformanceTrends(): {
    response_time_trend: Array<{ timestamp: string; value: number }>;
    success_rate_trend: Array<{ timestamp: string; value: number }>;
    error_rate_trend: Array<{ timestamp: string; value: number }>;
  } {
    const recentMetrics = this.metricsHistory.slice(-20); // Last 20 data points

    return {
      response_time_trend: recentMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.performance.average_response_time_ms
      })),
      success_rate_trend: recentMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.performance.success_rate
      })),
      error_rate_trend: recentMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.performance.error_rate
      }))
    };
  }

  /**
   * Get metrics retention limit
   */
  private getMetricsRetentionLimit(): number {
    const retentionHours = this.config.metricsRetentionHours || 24;
    const dataPointsPerHour = 60 / (this.config.healthCheckIntervalMinutes || 5);
    return retentionHours * dataPointsPerHour;
  }

  /**
   * Start monitoring
   */
  startMonitoring(): void {
    if (this.config.alertingEnabled) {
      this.healthMonitor.startMonitoring();
      logger.info('Real-time monitoring system started');
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.healthMonitor.stopMonitoring();
    logger.info('Real-time monitoring system stopped');
  }
}

/**
 * Initialize Real-time Monitoring System
 */
export function initializeRealTimeMonitoring(
  env: CloudflareEnvironment,
  config?: MonitoringConfig
): RealTimeMonitoringSystem {
  return new RealTimeMonitoringSystem(env, config);
}

export default RealTimeMonitoringSystem;