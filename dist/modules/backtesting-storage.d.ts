/**
 * Backtesting Results Storage and Retrieval System
 * Institutional-grade persistence layer for backtest results, metadata, and analysis data
 * Following DAC patterns and integrating with existing KV infrastructure
 */
export declare const BACKTESTING_NAMESPACES: {
    RUNS: string;
    RESULTS: string;
    METRICS: string;
    VALIDATION: string;
    COMPARISONS: string;
    HISTORY: string;
    CACHE: string;
};
export declare const BACKTESTING_TTL: {
    RUN_CACHE: number;
    RESULTS_CACHE: number;
    METRICS_CACHE: number;
    VALIDATION_CACHE: number;
    HISTORY_CACHE: number;
    COMPARISON_CACHE: number;
};
/**
 * Backtesting Results Storage Manager
 */
export declare class BacktestingStorageManager {
    private env;
    private timer;
    constructor(env: any);
    private _store;
    /**
     * Store a new backtest run
     */
    storeBacktestRun(runId: string, backtestConfig: any, initialStatus?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'): Promise<{
        runId: string;
        config: any;
        status: "failed" | "completed" | "queued" | "running" | "cancelled";
        createdAt: string;
        updatedAt: string;
        progress: number;
        currentStep: string;
        metadata: {
            version: string;
            engine: string;
            processingTime: number;
            estimatedDuration: number;
        };
    }>;
    /**
     * Update run status and progress
     */
    updateRunStatus(runId: string, status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled', progress?: number | null, currentStep?: string | null, error?: unknown): Promise<any>;
    /**
     * Store complete backtest results
     */
    storeBacktestResults(runId: string, results: any): Promise<any>;
    /**
     * Retrieve backtest run information
     */
    getBacktestRun(runId: string): Promise<any>;
    /**
     * Retrieve detailed backtest results
     */
    getBacktestResults(runId: string): Promise<any>;
    /**
     * Retrieve performance metrics only
     */
    getPerformanceMetrics(runId: string): Promise<any>;
    /**
     * Store validation results
     */
    storeValidationResults(runId: string, validationResults: any): Promise<any>;
    /**
     * Retrieve validation results
     */
    getValidationResults(runId: string): Promise<any>;
    /**
     * Store comparison results
     */
    storeComparisonResults(comparisonId: string, comparisonResults: any): Promise<any>;
    /**
     * Retrieve comparison results
     */
    getComparisonResults(comparisonId: string): Promise<any>;
    /**
     * Get backtest history with filtering and pagination
     */
    getBacktestHistory(filters?: any, pagination?: any): Promise<{
        runs: any;
        pagination: {
            page: any;
            limit: any;
            total: any;
            pages: number;
        };
    }>;
    /**
     * Delete backtest data (for cleanup)
     */
    deleteBacktestData(runId: string): Promise<boolean>;
    /**
     * Get storage statistics
     */
    getStorageStats(): Promise<{
        totalRuns: number;
        completedRuns: number;
        failedRuns: number;
        activeRuns: number;
        totalResults: number;
        totalValidations: number;
        totalComparisons: number;
        storageUsage: {
            runs: number;
            results: number;
            metrics: number;
            validation: number;
            comparisons: number;
        };
    }>;
    /**
     * Cleanup old data
     */
    cleanupOldData(retentionDays?: number): Promise<{
        cleanedCount: number;
        cutoffDate: string;
    }>;
    /**
     * Update history index
     * @private
     */
    _updateHistoryIndex(runId: string, eventType: string, data: any): Promise<void>;
    /**
     * Estimate backtest duration
     * @private
     */
    _estimateDuration(config: any): number;
    /**
     * Calculate date range
     * @private
     */
    _calculateDateRange(config: any): number;
}
/**
 * Factory function for creating storage manager instances
 */
export declare function createBacktestingStorage(env: any): BacktestingStorageManager;
/**
 * Utility functions for backtesting storage
 */
export declare function getBacktestRunStatus(env: any, runId: string): Promise<any>;
export declare function getStoredBacktestResults(env: any, runId: string): Promise<any>;
export declare function getStoredPerformanceMetrics(env: any, runId: string): Promise<any>;
export declare function listBacktestHistory(env: any, filters?: any, pagination?: any): Promise<{
    runs: any;
    pagination: {
        page: any;
        limit: any;
        total: any;
        pages: number;
    };
}>;
export declare function cleanupOldBacktestData(env: any, retentionDays?: number): Promise<{
    cleanedCount: number;
    cutoffDate: string;
}>;
//# sourceMappingURL=backtesting-storage.d.ts.map