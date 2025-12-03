/**
 * Enhanced Cache Factory
 * Creates either standard or optimized cache manager based on configuration
 * Enables seamless switching between legacy and optimized systems
 */
import { DOCacheAdapter } from './do-cache-adapter.js';
import { EnhancedOptimizedCacheManager } from './enhanced-optimized-cache-manager.js';
export interface OptimizedCacheSettings {
    enableKeyAliasing: boolean;
    enableBatchOperations: boolean;
    enableMemoryStaticData: boolean;
    enablePredictivePrefetching: boolean;
    enableVectorizedProcessing: boolean;
    enableMonitoring: boolean;
}
export interface CacheManagerFactory {
    createDOCacheAdapter(env: any, options?: any): DOCacheAdapter | EnhancedOptimizedCacheManager;
    createOptimizedCacheManager(env: any, config?: Partial<OptimizedCacheSettings>): EnhancedOptimizedCacheManager;
    isOptimizationEnabled(): boolean;
}
/**
 * Cache Manager Factory Implementation
 */
export declare class EnhancedCacheFactoryImpl implements CacheManagerFactory {
    private static instance;
    private optimizationConfig;
    private constructor();
    static getInstance(): EnhancedCacheFactoryImpl;
    /**
     * Create cache manager based on environment and configuration
     */
    createDOCacheAdapter(env: any, options?: any): DOCacheAdapter | EnhancedOptimizedCacheManager;
    /**
     * Create optimized cache manager explicitly
     */
    createOptimizedCacheManager(env: any, config?: Partial<OptimizedCacheSettings>): EnhancedOptimizedCacheManager;
    /**
     * Check if optimization is enabled via environment variable
     */
    isOptimizationEnabled(): boolean;
    /**
     * Get optimization status summary
     */
    getOptimizationStatus(): {
        enabled: boolean;
        features: string[];
        settings: any;
        projection: {
            currentKV: number;
            optimizedKV: number;
            reduction: number;
            percentage: string;
        };
    };
    /**
     * Enable/disable optimizations dynamically
     */
    setOptimizationEnabled(enabled: boolean): void;
    /**
     * Get cache manager type information
     */
    getCacheManagerType(env: any): {
        type: 'standard' | 'optimized';
        features: string[];
        reason: string;
    };
}
export declare const EnhancedCacheFactory: EnhancedCacheFactoryImpl;
//# sourceMappingURL=enhanced-cache-factory.d.ts.map