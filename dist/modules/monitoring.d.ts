/**
 * Production Monitoring and Metrics System
 * Tracks system performance, business metrics, and operational health
 */
/**
 * System metrics collection
 */
declare class SystemMetrics {
    private metrics;
    private counters;
    private timers;
    constructor();
    /**
     * Increment a counter metric
     */
    incrementCounter(name: any, value?: any, tags?: any): void;
    /**
     * Record a gauge metric (current value)
     */
    recordGauge(name: any, value: any, tags?: any): void;
    /**
     * Record a timer metric (duration)
     */
    recordTimer(name: any, duration: any, tags?: any): void;
    /**
     * Create a timer instance
     */
    timer(name: string, tags?: Record<string, any>): {
        stop: () => number;
    };
    /**
     * Get all metrics
     */
    getAllMetrics(): {
        counters: {
            [k: string]: number;
        };
        gauges: {
            [k: string]: any;
        };
        timers: {
            [k: string]: any;
        };
        timestamp: number;
    };
    /**
     * Reset all metrics
     */
    reset(): void;
    /**
     * Create a unique key for metric storage
     */
    createMetricKey(name: string, tags: Record<string, any>): string;
}
declare const systemMetrics: SystemMetrics;
/**
 * Business metrics tracking
 */
export declare const BusinessMetrics: {
    analysisRequested: (type: any, symbols: any) => void;
    analysisCompleted: (type: string, symbols: number, duration: number) => void;
    analysisFailed: (type: any, error: any) => void;
    predictionMade: (symbol: string, confidence: number, direction: string) => void;
    predictionValidated: (symbol: string, correct: boolean, confidence: number) => void;
    apiRequest: (endpoint: string, method: string, status: number, duration: number) => void;
    facebookMessageSent: (type: any, success: any) => void;
    kvOperation: (operation: any, success: any, duration: any) => void;
    dailySummaryGenerated: (date: any, predictions: any) => void;
    dailySummaryViewed: (date: any) => void;
};
/**
 * Enhanced Business KPI Tracking
 */
export declare const BusinessKPI: {
    /**
     * Track prediction accuracy against targets
     */
    trackPredictionAccuracy: (accuracy: any) => void;
    /**
     * Track system performance against targets
     */
    trackPerformanceKPI: (responseTime: any, operation: any) => void;
    /**
     * Track cost efficiency (should remain $0.00)
     */
    trackCostEfficiency: (actualCost?: number) => void;
    /**
     * Track system uptime against target
     */
    trackUptimeKPI: (uptimePercentage: any) => void;
    /**
     * Track cron execution reliability
     */
    trackCronReliability: (successCount: any, totalCount: any, triggerMode: any) => void;
    /**
     * Generate KPI dashboard data
     */
    generateKPIDashboard: () => {
        prediction_accuracy: {
            current: any;
            target: number;
            status: string;
        };
        response_time: {
            current: any;
            target: number;
            status: string;
        };
        cost_efficiency: {
            current: any;
            target: number;
            status: any;
        };
        uptime: {
            current: any;
            target: number;
            status: string;
        };
        cron_reliability: {
            current: any;
            target: number;
            executions: number;
        };
        timestamp: string;
        overall_health: string;
    };
};
/**
 * Performance monitoring
 */
export declare const PerformanceMonitor: {
    /**
     * Monitor HTTP request performance
     */
    monitorRequest: (request: any, handler?: any) => {
        complete: (response: any) => void;
    };
    /**
     * Monitor async operation performance
     */
    monitorOperation: (name: any, operation: any, tags?: {}) => any;
};
/**
 * Health monitoring
 */
export declare const HealthMonitor: {
    /**
     * Check system health
     */
    checkHealth(env: any): Promise<{
        status: string;
        timestamp: string;
        components: {
            kv_storage: {};
            ai_models: {};
        };
        metrics: {};
    }>;
    /**
     * Log health check result
     */
    logHealthCheck: (component: any, status: any, details?: {}) => void;
};
/**
 * Alert system (placeholder for future implementation)
 */
export declare const AlertManager: {
    /**
     * Send alert (placeholder)
     */
    sendAlert: (severity: any, message: any, context?: {}) => void;
    /**
     * Check for alerting conditions
     */
    checkAlerts: (metrics: any) => any[];
};
/**
 * Export system metrics instance
 */
export { systemMetrics as SystemMetrics };
/**
 * Initialize monitoring
 */
export declare function initMonitoring(env: any): void;
//# sourceMappingURL=monitoring.d.ts.map