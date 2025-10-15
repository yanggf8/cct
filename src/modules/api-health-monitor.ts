/**
 * API Health Monitor Module
 *
 * Comprehensive health monitoring for all external API integrations.
 * Provides unified health checks, performance metrics, and status reporting.
 *
 * Features:
 * - FRED API health monitoring
 * - Yahoo Finance API health monitoring
 * - Circuit breaker status monitoring
 * - Cache health monitoring
 * - Performance metrics collection
 * - Automated health check scheduling
 *
 * @author Real-time Data Integration - Phase 1
 * @since 2025-10-14
 */

import { createLogger } from './logging.js';
import { createFredApiClientWithHealthCheck, type FredClientFactoryOptions } from './fred-api-factory.js';
import { getAPIConfiguration } from './config.js';
import { getMarketStructureIndicators, healthCheck as yahooHealthCheck } from './yahoo-finance-integration.js';
import { CacheManager } from './cache-manager.js';
import { CircuitBreakerFactory, CircuitState } from './circuit-breaker.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('api-health-monitor');

/**
 * API Health Status Types
 */
export type APIHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface APIHealthCheck {
  api: string;
  status: APIHealthStatus;
  lastCheck: string;
  responseTime?: number;
  errorMessage?: string;
  details?: any;
  metrics?: {
    successRate?: number;
    averageResponseTime?: number;
    requestCount?: number;
    errorCount?: number;
  };
}

export interface SystemHealthReport {
  timestamp: string;
  overallStatus: APIHealthStatus;
  apis: Record<string, APIHealthCheck>;
  systemMetrics: {
    totalAPIs: number;
    healthyAPIs: number;
    degradedAPIs: number;
    unhealthyAPIs: number;
    averageResponseTime: number;
  };
  recommendations: string[];
  alerts: string[];
}

/**
 * API Health Monitor Configuration
 */
export interface APIHealthMonitorOptions {
  enableAutoChecks?: boolean;
  checkIntervalMinutes?: number;
  timeoutMs?: number;
  retries?: number;
  enableAlerts?: boolean;
}

/**
 * API Health Monitor Implementation
 */
export class APIHealthMonitor {
  private env: CloudflareEnvironment;
  private options: APIHealthMonitorOptions;
  private healthChecks: Map<string, APIHealthCheck> = new Map();
  private isMonitoring = false;
  private monitoringInterval?: ReturnType<typeof setInterval>;

  constructor(env: CloudflareEnvironment, options: APIHealthMonitorOptions = {}) {
    this.env = env;
    this.options = {
      enableAutoChecks: true,
      checkIntervalMinutes: 5,
      timeoutMs: 10000,
      retries: 2,
      enableAlerts: true,
      ...options
    };
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Health monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting API health monitoring', {
      interval: `${this.options.checkIntervalMinutes} minutes`,
      timeout: `${this.options.timeoutMs}ms`
    });

    // Initial health check
    this.performAllHealthChecks();

    // Set up recurring checks
    if (this.options.enableAutoChecks) {
      this.monitoringInterval = setInterval(() => {
        this.performAllHealthChecks();
      }, this.options.checkIntervalMinutes * 60 * 1000);
    }
  }

  /**
   * Stop continuous health monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('API health monitoring stopped');
  }

  /**
   * Perform health check for all APIs
   */
  async performAllHealthChecks(): Promise<SystemHealthReport> {
    logger.info('Performing comprehensive API health checks');

    const startTime = Date.now();
    const checks: Promise<{ name: string; check: APIHealthCheck }>[] = [];

    // Add FRED API health check
    checks.push(this.checkFREDAPI());

    // Add Yahoo Finance API health check
    checks.push(this.checkYahooFinanceAPI());

    // Add cache health check
    checks.push(this.checkCacheHealth());

    // Add circuit breaker health check
    checks.push(this.checkCircuitBreakerHealth());

    // Wait for all checks to complete
    const results = await Promise.allSettled(checks);
    const apiHealthChecks: Record<string, APIHealthCheck> = {};

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        apiHealthChecks[result.value.name] = result.value.check;
      } else {
        const apiNames = ['fred', 'yahoo-finance', 'cache', 'circuit-breaker'];
        const apiName = apiNames[index] || 'unknown';

        apiHealthChecks[apiName] = {
          api: apiName,
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          errorMessage: result.reason?.message || 'Unknown error',
          metrics: {
            successRate: 0,
            errorCount: 1
          }
        };

        logger.error(`Health check failed for ${apiName}:`, result.reason);
      }
    });

    // Calculate overall system health
    const report = this.generateHealthReport(apiHealthChecks);

    logger.info('API health checks completed', {
      overallStatus: report.overallStatus,
      healthyAPIs: report.systemMetrics.healthyAPIs,
      totalAPIs: report.systemMetrics.totalAPIs,
      duration: `${Date.now() - startTime}ms`
    });

    // Send alerts if enabled
    if (this.options.enableAlerts) {
      this.sendAlerts(report);
    }

    return report;
  }

  /**
   * Check FRED API health
   */
  private async checkFREDAPI(): Promise<{ name: string; check: APIHealthCheck }> {
    const startTime = Date.now();

    try {
      const { client, health } = await createFredApiClientWithHealthCheck(this.env, {
        enableLogging: false
      });

      const responseTime = Date.now() - startTime;

      return {
        name: 'fred',
        check: {
          api: 'fred',
          status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
          lastCheck: new Date().toISOString(),
          responseTime,
          details: health,
          metrics: {
            successRate: health.status === 'healthy' ? 100 : 0,
            averageResponseTime: responseTime,
            requestCount: 1,
            errorCount: health.status === 'healthy' ? 0 : 1
          }
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: 'fred',
        check: {
          api: 'fred',
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          responseTime,
          errorMessage: error.message,
          metrics: {
            successRate: 0,
            averageResponseTime: responseTime,
            requestCount: 1,
            errorCount: 1
          }
        }
      };
    }
  }

  /**
   * Check Yahoo Finance API health
   */
  private async checkYahooFinanceAPI(): Promise<{ name: string; check: APIHealthCheck }> {
    const startTime = Date.now();

    try {
      const health = await yahooHealthCheck();
      const responseTime = Date.now() - startTime;

      return {
        name: 'yahoo-finance',
        check: {
          api: 'yahoo-finance',
          status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
          lastCheck: new Date().toISOString(),
          responseTime,
          details: health,
          metrics: {
            successRate: health.status === 'healthy' ? 100 : 0,
            averageResponseTime: responseTime,
            requestCount: 1,
            errorCount: health.status === 'healthy' ? 0 : 1
          }
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: 'yahoo-finance',
        check: {
          api: 'yahoo-finance',
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          responseTime,
          errorMessage: error.message,
          metrics: {
            successRate: 0,
            averageResponseTime: responseTime,
            requestCount: 1,
            errorCount: 1
          }
        }
      };
    }
  }

  /**
   * Check cache health
   */
  private async checkCacheHealth(): Promise<{ name: string; check: APIHealthCheck }> {
    const startTime = Date.now();

    try {
      // Test cache operations
      const cacheManager = new CacheManager(this.env);
      const testKey = `health_check_${Date.now()}`;
      const testValue = { test: true, timestamp: Date.now() };

      // Write test
      await cacheManager.set(testKey, testValue, { ttl: 60 });

      // Read test
      const retrieved = await cacheManager.get(testKey);

      // Cleanup
      await cacheManager.delete(testKey);

      const responseTime = Date.now() - startTime;
      const isHealthy = retrieved && retrieved.test === true;

      return {
        name: 'cache',
        check: {
          api: 'cache',
          status: isHealthy ? 'healthy' : 'unhealthy',
          lastCheck: new Date().toISOString(),
          responseTime,
          details: {
            testPassed: isHealthy,
            cacheType: 'multi-level',
            l1Enabled: true,
            l2Enabled: true
          },
          metrics: {
            successRate: isHealthy ? 100 : 0,
            averageResponseTime: responseTime,
            requestCount: 1,
            errorCount: isHealthy ? 0 : 1
          }
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: 'cache',
        check: {
          api: 'cache',
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          responseTime,
          errorMessage: error.message,
          metrics: {
            successRate: 0,
            averageResponseTime: responseTime,
            requestCount: 1,
            errorCount: 1
          }
        }
      };
    }
  }

  /**
   * Check circuit breaker health
   */
  private async checkCircuitBreakerHealth(): Promise<{ name: string; check: APIHealthCheck }> {
    const startTime = Date.now();

    try {
      // Get circuit breaker metrics
      const circuitBreaker = CircuitBreakerFactory.getInstance('api-health-monitor');
      const metrics = circuitBreaker.getMetrics();

      const responseTime = Date.now() - startTime;

      // Determine health based on circuit breaker state
      let status: APIHealthStatus = 'healthy';
      if (metrics.state === CircuitState.OPEN) {
        status = 'unhealthy';
      } else if (metrics.state === CircuitState.HALF_OPEN) {
        status = 'degraded';
      }

      return {
        name: 'circuit-breaker',
        check: {
          api: 'circuit-breaker',
          status,
          lastCheck: new Date().toISOString(),
          responseTime,
          details: metrics,
          metrics: {
            successRate: metrics.successRate || 0,
            averageResponseTime: responseTime,
            requestCount: metrics.requestCount || 0,
            errorCount: metrics.failureCount || 0
          }
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        name: 'circuit-breaker',
        check: {
          api: 'circuit-breaker',
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          responseTime,
          errorMessage: error.message,
          metrics: {
            successRate: 0,
            averageResponseTime: responseTime,
            requestCount: 1,
            errorCount: 1
          }
        }
      };
    }
  }

  /**
   * Generate comprehensive health report
   */
  private generateHealthReport(apiChecks: Record<string, APIHealthCheck>): SystemHealthReport {
    const checks = Object.values(apiChecks);
    const healthyCount = checks.filter(c => c.status === 'healthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const totalCount = checks.length;

    // Calculate overall status
    let overallStatus: APIHealthStatus = 'healthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    // Calculate average response time
    const responseTimes = checks
      .filter(c => c.responseTime !== undefined)
      .map(c => c.responseTime!);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(apiChecks);

    // Generate alerts
    const alerts = this.generateAlerts(apiChecks);

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      apis: apiChecks,
      systemMetrics: {
        totalAPIs: totalCount,
        healthyAPIs: healthyCount,
        degradedAPIs: degradedCount,
        unhealthyAPIs: unhealthyCount,
        averageResponseTime
      },
      recommendations,
      alerts
    };
  }

  /**
   * Generate recommendations based on health check results
   */
  private generateRecommendations(apiChecks: Record<string, APIHealthCheck>): string[] {
    const recommendations: string[] = [];

    Object.entries(apiChecks).forEach(([api, check]) => {
      switch (check.status) {
        case 'unhealthy':
          if (api === 'fred') {
            recommendations.push('Check FRED API key configuration and rate limits');
          } else if (api === 'yahoo-finance') {
            recommendations.push('Monitor Yahoo Finance API for potential rate limiting or service issues');
          } else if (api === 'cache') {
            recommendations.push('Verify KV storage connectivity and permissions');
          } else if (api === 'circuit-breaker') {
            recommendations.push('Review circuit breaker configuration and recent error patterns');
          }
          break;

        case 'degraded':
          if (api === 'circuit-breaker') {
            recommendations.push('Monitor API response times and error rates to prevent circuit breaker opening');
          } else {
            recommendations.push(`Monitor ${api} performance metrics for potential issues`);
          }
          break;
      }

      // Check for slow response times
      if (check.responseTime && check.responseTime > 5000) {
        recommendations.push(`Optimize ${api} API response time (current: ${check.responseTime}ms)`);
      }
    });

    return recommendations;
  }

  /**
   * Generate alerts based on health check results
   */
  private generateAlerts(apiChecks: Record<string, APIHealthCheck>): string[] {
    const alerts: string[] = [];

    Object.entries(apiChecks).forEach(([api, check]) => {
      if (check.status === 'unhealthy') {
        alerts.push(`🚨 CRITICAL: ${api.toUpperCase()} API is unhealthy`);
      } else if (check.status === 'degraded') {
        alerts.push(`⚠️ WARNING: ${api.toUpperCase()} API is degraded`);
      }

      // Check for high error rates
      if (check.metrics?.successRate && check.metrics.successRate < 95) {
        alerts.push(`📊 Low success rate for ${api}: ${check.metrics.successRate}%`);
      }
    });

    return alerts;
  }

  /**
   * Send alerts (implementation depends on alerting system)
   */
  private sendAlerts(report: SystemHealthReport): void {
    if (report.alerts.length === 0) {
      return;
    }

    logger.warn('System health alerts generated', {
      overallStatus: report.overallStatus,
      alertCount: report.alerts.length,
      alerts: report.alerts
    });

    // Here you could integrate with various alerting systems:
    // - Email notifications
    // - Slack/Teams webhooks
    // - SMS alerts
    // - Push notifications
    // - Custom monitoring systems
  }

  /**
   * Get current health status without performing new checks
   */
  getCurrentHealth(): SystemHealthReport | null {
    if (this.healthChecks.size === 0) {
      return null;
    }

    const apiChecks: Record<string, APIHealthCheck> = {};
    this.healthChecks.forEach((check, name) => {
      apiChecks[name] = check;
    });

    return this.generateHealthReport(apiChecks);
  }

  /**
   * Get health check history (simplified version)
   */
  getHealthHistory(): SystemHealthReport[] {
    // In a real implementation, you might store historical data
    // For now, return an empty array
    return [];
  }
}

/**
 * Initialize API Health Monitor
 */
export function initializeAPIHealthMonitor(
  env: CloudflareEnvironment,
  options?: APIHealthMonitorOptions
): APIHealthMonitor {
  return new APIHealthMonitor(env, options);
}

export default APIHealthMonitor;