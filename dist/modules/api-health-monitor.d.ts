import type { CloudflareEnvironment } from '../types.js';
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
export declare class APIHealthMonitor {
    private env;
    private options;
    private healthChecks;
    private isMonitoring;
    private monitoringInterval?;
    constructor(env: CloudflareEnvironment, options?: APIHealthMonitorOptions);
    /**
     * Start continuous health monitoring
     */
    startMonitoring(): void;
    /**
     * Stop continuous health monitoring
     */
    stopMonitoring(): void;
    /**
     * Perform health check for all APIs
     */
    performAllHealthChecks(): Promise<SystemHealthReport>;
    /**
     * Check FRED API health
     */
    private checkFREDAPI;
    /**
     * Check Yahoo Finance API health
     */
    private checkYahooFinanceAPI;
    /**
     * Check cache health
     */
    private checkCacheHealth;
    /**
     * Check circuit breaker health
     */
    private checkCircuitBreakerHealth;
    /**
     * Generate comprehensive health report
     */
    private generateHealthReport;
    /**
     * Generate recommendations based on health check results
     */
    private generateRecommendations;
    /**
     * Generate alerts based on health check results
     */
    private generateAlerts;
    /**
     * Send alerts (implementation depends on alerting system)
     */
    private sendAlerts;
    /**
     * Get current health status without performing new checks
     */
    getCurrentHealth(): SystemHealthReport | null;
    /**
     * Get health check history (simplified version)
     */
    getHealthHistory(): SystemHealthReport[];
}
/**
 * Initialize API Health Monitor
 */
export declare function initializeAPIHealthMonitor(env: CloudflareEnvironment, options?: APIHealthMonitorOptions): APIHealthMonitor;
export default APIHealthMonitor;
//# sourceMappingURL=api-health-monitor.d.ts.map