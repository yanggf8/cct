/**
 * Performance Baseline Monitoring Module
 * Tracks and analyzes system performance trends over time
 */
import type { CloudflareEnvironment } from '../types.js';
export type TrendType = 'insufficient-data' | 'baseline-establishing' | 'stable' | 'improving' | 'degrading';
export type OperationStatus = 'unknown' | 'excellent' | 'good' | 'acceptable' | 'poor';
export type OverallHealth = 'unknown' | 'excellent' | 'good' | 'acceptable' | 'needs-attention';
interface MeasurementMetadata {
    [key: string]: any;
}
interface PerformanceMeasurement {
    operation: string;
    value: number;
    timestamp: number;
    metadata: MeasurementMetadata;
}
interface OperationReport {
    measurements: number;
    average: number;
    min: number;
    max: number;
    trend: TrendType;
    target: number | null;
    status: OperationStatus;
}
interface PerformanceAlert {
    severity: 'medium' | 'high';
    operation: string;
    message: string;
    current: number;
    target: number | null;
    trend?: TrendType;
    status?: OperationStatus;
}
interface PerformanceRecommendation {
    type: 'performance';
    priority: 'medium' | 'high';
    operation: string;
    message: string;
    action: string;
}
interface KeyMetric {
    average: number;
    target: number | null;
    status: OperationStatus;
    trend: TrendType;
}
interface WeeklySummary {
    period: string;
    generatedAt: string;
    overallHealth: OverallHealth;
    keyMetrics: Record<string, KeyMetric>;
    trends: {
        improving: number;
        stable: number;
        degrading: number;
    };
    recommendations: PerformanceRecommendation[];
}
interface BaselineReport {
    timeframe: string;
    generatedAt: string;
    operations: Record<string, OperationReport>;
    summary: {
        totalMeasurements: number;
        operationsTracked: number;
        trends: {
            improving: number;
            stable: number;
            degrading: number;
        };
    };
}
interface RequestTracker {
    start: () => number;
    end: (startTime: number, env: CloudflareEnvironment, metadata?: MeasurementMetadata) => Promise<number>;
}
/**
 * Performance baseline tracking
 */
export declare class PerformanceBaseline {
    private env;
    private metrics;
    private trends;
    constructor(env: CloudflareEnvironment);
    /**
     * Record a performance measurement
     */
    recordMeasurement(operation: string, value: number, metadata?: MeasurementMetadata): Promise<void>;
    /**
     * Calculate performance trend for an operation
     */
    calculateTrend(operation: string): TrendType;
    /**
     * Get performance baseline report
     */
    getBaselineReport(timeframe?: string): Promise<BaselineReport>;
    /**
     * Get operation target based on business KPIs
     */
    private getOperationTarget;
    /**
     * Get operation status vs target
     */
    private getOperationStatus;
    /**
     * Parse timeframe string to milliseconds
     */
    private parseTimeframe;
    /**
     * Check for performance alerts
     */
    checkPerformanceAlerts(): Promise<PerformanceAlert[]>;
    /**
     * Get weekly performance summary
     */
    getWeeklySummary(): Promise<WeeklySummary>;
    /**
     * Calculate overall health from report
     */
    private calculateOverallHealth;
    /**
     * Generate performance recommendations
     */
    private generateRecommendations;
    /**
     * Get performance statistics for all operations
     */
    getPerformanceStatistics(): Promise<{
        totalOperations: number;
        totalMeasurements: number;
        operationCounts: Record<string, number>;
        averagePerformance: Record<string, number>;
        trendDistribution: Record<TrendType, number>;
    }>;
    /**
     * Clear old performance data
     */
    clearOldData(olderThanDays?: number): Promise<number>;
}
/**
 * Get or create global performance tracker
 */
export declare function getPerformanceTracker(env: CloudflareEnvironment): PerformanceBaseline;
/**
 * Middleware to automatically track request performance
 */
export declare function trackRequestPerformance(operation: string): RequestTracker;
/**
 * Performance monitoring middleware for handlers
 */
export declare function createPerformanceMiddleware(operation: string): (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext, next: () => Promise<Response>) => Promise<Response>;
declare const _default: {
    PerformanceBaseline: typeof PerformanceBaseline;
    getPerformanceTracker: typeof getPerformanceTracker;
    trackRequestPerformance: typeof trackRequestPerformance;
    createPerformanceMiddleware: typeof createPerformanceMiddleware;
};
export default _default;
export type { MeasurementMetadata, PerformanceMeasurement, OperationReport, PerformanceAlert, PerformanceRecommendation, KeyMetric, WeeklySummary, BaselineReport, RequestTracker };
//# sourceMappingURL=performance-baseline.d.ts.map