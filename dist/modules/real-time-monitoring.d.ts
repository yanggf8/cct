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
import { type SystemHealthReport } from './api-health-monitor.js';
import { type TestSuite } from './integration-test-suite.js';
import type { CloudflareEnvironment } from '../types.js';
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
        overall_score: number;
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
        response_time_trend: Array<{
            timestamp: string;
            value: number;
        }>;
        success_rate_trend: Array<{
            timestamp: string;
            value: number;
        }>;
        error_rate_trend: Array<{
            timestamp: string;
            value: number;
        }>;
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
export declare class RealTimeMonitoringSystem {
    private env;
    private config;
    private healthMonitor;
    private testSuite;
    private cacheManager;
    private startTime;
    private activeAlerts;
    private metricsHistory;
    constructor(env: CloudflareEnvironment, config?: MonitoringConfig);
    /**
     * Get current system metrics
     */
    getCurrentMetrics(): Promise<SystemMetrics>;
    /**
     * Get monitoring dashboard data
     */
    getDashboardData(): Promise<MonitoringDashboard>;
    /**
     * Calculate performance metrics
     */
    private calculatePerformanceMetrics;
    /**
     * Calculate data quality metrics
     */
    private calculateDataQualityMetrics;
    /**
     * Calculate overall health score
     */
    private calculateHealthScore;
    /**
     * Get health status based on score
     */
    private getHealthStatus;
    /**
     * Check for alerts based on metrics
     */
    private checkForAlerts;
    /**
     * Create and manage alerts
     */
    private createAlert;
    /**
     * Resolve alert
     */
    resolveAlert(alertId: string): Promise<void>;
    /**
     * Get recent health reports
     */
    private getRecentHealthReports;
    /**
     * Get recent test results
     */
    private getRecentTestResults;
    /**
     * Calculate performance trends
     */
    private calculatePerformanceTrends;
    /**
     * Get metrics retention limit
     */
    private getMetricsRetentionLimit;
    /**
     * Start monitoring
     */
    startMonitoring(): void;
    /**
     * Stop monitoring
     */
    stopMonitoring(): void;
}
/**
 * Initialize Real-time Monitoring System
 */
export declare function initializeRealTimeMonitoring(env: CloudflareEnvironment, config?: MonitoringConfig): RealTimeMonitoringSystem;
export default RealTimeMonitoringSystem;
//# sourceMappingURL=real-time-monitoring.d.ts.map