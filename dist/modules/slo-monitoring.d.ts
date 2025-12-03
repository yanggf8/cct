/**
 * SLO Monitoring and Alert Policies
 * Service Level Objectives monitoring with alerting for HTML endpoints
 */
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
    p50ResponseTime: number;
    p90ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    availabilityTarget: number;
    errorRateThreshold: number;
    canaryErrorRateThreshold: number;
    canaryResponseTimeMultiplier: number;
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
    duration: number;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    channels: string[];
    cooldown: number;
}
/**
 * SLO Monitoring Manager
 */
export declare class SLOMonitoringManager {
    private env;
    private metricsBuffer;
    private alertCooldowns;
    private readonly defaultThresholds;
    constructor(env: CloudflareEnvironment);
    /**
     * Record SLO metrics for a request
     */
    recordMetrics(metrics: SLOMetrics): Promise<void>;
    /**
     * Get current SLO status for an endpoint
     */
    getSLOStatus(endpoint: string, timeWindowMinutes?: number): Promise<SLOStatus>;
    /**
     * Get all SLO statuses
     */
    getAllSLOStatuses(): Promise<SLOStatus[]>;
    /**
     * Check if alert should be triggered
     */
    private checkAlerts;
    /**
     * Trigger alert
     */
    private triggerAlert;
    /**
     * Get metrics for endpoint from storage
     */
    private getMetrics;
    /**
     * Persist metrics to storage
     */
    private persistMetrics;
    /**
     * Calculate percentiles
     */
    private calculatePercentiles;
    /**
     * Get percentile value
     */
    private getPercentile;
    /**
     * Calculate error rate
     */
    private calculateErrorRate;
    /**
     * Check threshold compliance
     */
    private checkThreshold;
    /**
     * Get recent alerts
     */
    getRecentAlerts(timeWindowMinutes?: number): Promise<any[]>;
    /**
     * Clear metrics buffer
     */
    clearMetrics(): void;
}
/**
 * Create SLO monitoring middleware
 */
export declare function createSLOMonitoringMiddleware(sloManager: SLOMonitoringManager): (request: Request, response: Response, endpoint: string) => Promise<void>;
//# sourceMappingURL=slo-monitoring.d.ts.map