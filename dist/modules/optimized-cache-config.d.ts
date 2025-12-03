/**
 * Optimized Cache Configuration
 * Enables all KV reduction optimizations for production deployment
 * Manages feature flags and optimization settings
 */
export interface OptimizedCacheSettings {
    enableKeyAliasing: boolean;
    enableBatchOperations: boolean;
    enableMemoryStaticData: boolean;
    enablePredictivePrefetching: boolean;
    enableVectorizedProcessing: boolean;
    maxMemoryBudgetMB: number;
    preFetchThreshold: number;
    batchSizes: {
        high: number;
        medium: number;
        low: number;
    };
    cacheHitRateTarget: number;
    kvOperationReductionTarget: number;
    enableMonitoring: boolean;
    debugMode: boolean;
    enableOptimizationLogging: boolean;
}
/**
 * Optimized Cache Configuration Manager
 * Centralized configuration for all KV optimization features
 */
export declare class OptimizedCacheConfig {
    private static instance;
    private settings;
    private constructor();
    static getInstance(): OptimizedCacheConfig;
    /**
     * Get all current settings
     */
    getSettings(): OptimizedCacheSettings;
    /**
     * Update specific settings
     */
    updateSettings(newSettings: Partial<OptimizedCacheSettings>): void;
    /**
     * Get environment-specific settings
     */
    getEnvironmentSettings(): OptimizedCacheSettings;
    /**
     * Get optimization feature summary
     */
    getOptimizationFeatures(): {
        totalFeatures: number;
        enabledFeatures: string[];
        estimatedKVReduction: string;
        estimatedMemoryUsage: string;
    };
    /**
     * Validate configuration
     */
    validateConfiguration(): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    };
    /**
     * Get configuration for specific environment
     */
    getEnvironmentConfiguration(env: 'development' | 'staging' | 'production'): OptimizedCacheSettings;
    /**
     * Export configuration for monitoring
     */
    exportConfiguration(): string;
    /**
     * Get KV operation reduction projection
     */
    getKVReductionProjection(): {
        currentDailyKV: number;
        optimizedDailyKV: number;
        percentageReduction: number;
        costSavings: string;
    };
}
//# sourceMappingURL=optimized-cache-config.d.ts.map