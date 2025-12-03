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
import { initializeAPIHealthMonitor } from './api-health-monitor.js';
import { initializeIntegrationTestSuite } from './integration-test-suite.js';
import { DOCacheAdapter } from './do-cache-adapter.js';
import { CircuitBreakerFactory } from './circuit-breaker.js';
const logger = createLogger('real-time-monitoring');
/**
 * Real-time Monitoring System Implementation
 */
export class RealTimeMonitoringSystem {
    constructor(env, config = {}) {
        this.activeAlerts = new Map();
        this.metricsHistory = [];
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
        this.cacheManager = new DOCacheAdapter(env);
        this.startTime = Date.now();
    }
    /**
     * Get current system metrics
     */
    async getCurrentMetrics() {
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
            const metrics = {
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
        }
        catch (error) {
            logger.error('Failed to get current metrics:', { error: error instanceof Error ? error.message : String(error) });
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
    async getDashboardData() {
        try {
            // Get current metrics
            const systemMetrics = await this.getCurrentMetrics();
            // Get recent health reports
            const recentHealthReports = await this.getRecentHealthReports();
            // Get recent test results
            const recentTestResults = await this.getRecentTestResults();
            // Calculate performance trends
            const performanceTrends = this.calculatePerformanceTrends();
            const dashboard = {
                timestamp: new Date().toISOString(),
                system_metrics: systemMetrics,
                recent_health_reports: recentHealthReports,
                recent_test_results: recentTestResults,
                active_alerts: Array.from(this.activeAlerts.values()),
                performance_trends: performanceTrends
            };
            return dashboard;
        }
        catch (error) {
            logger.error('Failed to get dashboard data:', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    /**
     * Calculate performance metrics
     */
    async calculatePerformanceMetrics() {
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
        }
        catch (error) {
            logger.warn('Failed to calculate performance metrics:', { error: error instanceof Error ? error.message : String(error) });
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
    async calculateDataQualityMetrics() {
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
        }
        catch (error) {
            logger.warn('Failed to calculate data quality metrics:', { error: error instanceof Error ? error.message : String(error) });
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
    calculateHealthScore(healthReport, performanceMetrics, dataQualityMetrics) {
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
    getHealthStatus(score) {
        if (score >= 90)
            return 'excellent';
        if (score >= 75)
            return 'good';
        if (score >= 60)
            return 'fair';
        if (score >= 40)
            return 'poor';
        return 'critical';
    }
    /**
     * Check for alerts based on metrics
     */
    async checkForAlerts(metrics) {
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
    async createAlert(alert) {
        const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullAlert = {
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
    async resolveAlert(alertId) {
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
    async getRecentHealthReports() {
        try {
            // In a real implementation, this would fetch from a database or cache
            // For now, return empty array
            return [];
        }
        catch (error) {
            logger.warn('Failed to get recent health reports:', { error: error instanceof Error ? error.message : String(error) });
            return [];
        }
    }
    /**
     * Get recent test results
     */
    async getRecentTestResults() {
        try {
            // In a real implementation, this would fetch from a database or cache
            // For now, return empty array
            return [];
        }
        catch (error) {
            logger.warn('Failed to get recent test results:', { error: error instanceof Error ? error.message : String(error) });
            return [];
        }
    }
    /**
     * Calculate performance trends
     */
    calculatePerformanceTrends() {
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
    getMetricsRetentionLimit() {
        const retentionHours = this.config.metricsRetentionHours || 24;
        const dataPointsPerHour = 60 / (this.config.healthCheckIntervalMinutes || 5);
        return retentionHours * dataPointsPerHour;
    }
    /**
     * Start monitoring
     */
    startMonitoring() {
        if (this.config.alertingEnabled) {
            this.healthMonitor.startMonitoring();
            logger.info('Real-time monitoring system started');
        }
    }
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        this.healthMonitor.stopMonitoring();
        logger.info('Real-time monitoring system stopped');
    }
}
/**
 * Initialize Real-time Monitoring System
 */
export function initializeRealTimeMonitoring(env, config) {
    return new RealTimeMonitoringSystem(env, config);
}
export default RealTimeMonitoringSystem;
//# sourceMappingURL=real-time-monitoring.js.map