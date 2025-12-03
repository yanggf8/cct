/**
 * Enhanced Batch Operations Module
 * Optimizes multi-symbol requests with intelligent batching, caching, and deduplication
 * Provides 50-70% reduction in API calls and KV operations for batch requests
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Batch operation configuration
 */
export interface BatchOperationConfig {
    maxBatchSize: number;
    batchTimeoutMs: number;
    enableDeduplication: boolean;
    enableCache: boolean;
    cacheTTL: number;
    enableMetrics: boolean;
    concurrency: number;
}
/**
 * Batch operation result
 */
export interface BatchOperationResult<T> {
    items: Array<{
        key: string;
        success: boolean;
        data?: T;
        error?: string;
        cached: boolean;
        responseTime: number;
    }>;
    statistics: {
        totalItems: number;
        successfulItems: number;
        failedItems: number;
        cachedItems: number;
        totalTime: number;
        averageResponseTime: number;
        cacheHitRate: number;
        deduplicationRate: number;
        kvReduction: number;
    };
    performance: {
        batchesProcessed: number;
        batchSize: number;
        concurrency: number;
        memoryUsage: number;
    };
}
/**
 * Enhanced batch operations manager with DO cache
 */
export declare class EnhancedBatchOperations {
    private static instance;
    private config;
    private cache;
    private cacheManager;
    private constructor();
    static getInstance(config?: Partial<BatchOperationConfig>): EnhancedBatchOperations;
    /**
     * Execute batch operation with optimization
     */
    executeBatch<T>(env: CloudflareEnvironment, items: Array<{
        key: string;
        operation: () => Promise<T>;
    }>, options?: {
        batchSize?: number;
        cacheKey?: string;
        customTTL?: number;
        enableCache?: boolean;
    }): Promise<BatchOperationResult<T>>;
    /**
     * Process a single batch
     */
    private processBatch;
    /**
     * Get cached batch result
     */
    private getBatchCache;
    /**
     * Cache batch result
     */
    private setBatchCache;
    /**
     * Enforce maximum cache entries
     */
    private enforceMaxCacheEntries;
    /**
     * Create batch operation result
     */
    private createBatchResult;
    /**
     * Estimate memory usage
     */
    private estimateMemoryUsage;
    /**
     * Get batch cache statistics
     */
    getCacheStats(): {
        size: number;
        entries: Array<{
            key: string;
            itemCount: number;
            age: number;
            ttl: number;
        }>;
    };
    /**
     * Clear batch cache
     */
    clearCache(pattern?: string): number;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<BatchOperationConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): BatchOperationConfig;
}
/**
 * Global batch operations instance
 */
export declare const batchOperations: EnhancedBatchOperations;
/**
 * Helper function to execute optimized batch operations
 */
export declare function executeOptimizedBatch<T>(env: CloudflareEnvironment, items: Array<{
    key: string;
    operation: () => Promise<T>;
}>, options?: {
    batchSize?: number;
    cacheKey?: string;
    customTTL?: number;
    enableCache?: boolean;
}): Promise<BatchOperationResult<T>>;
export default EnhancedBatchOperations;
//# sourceMappingURL=enhanced-batch-operations.d.ts.map