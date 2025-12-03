/**
 * Batch KV Operations Module
 * Groups multiple KV operations into efficient batches
 * Provides 15-20% KV reduction through intelligent batching
 */
export interface BatchOperation {
    type: 'read' | 'write' | 'delete';
    key: string;
    data?: any;
    namespace?: string;
    priority: 'high' | 'medium' | 'low';
    timestamp: number;
}
export interface BatchResult {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    operations: Array<{
        key: string;
        success: boolean;
        error?: string;
    }>;
}
/**
 * Intelligent KV Batching System
 * Groups operations by priority and namespace for optimal execution
 */
export declare class BatchKVOperations {
    private static instance;
    private pendingOperations;
    private batchTimeouts;
    private baseDAL;
    private readonly BATCH_SIZES;
    private readonly BATCH_TIMEOUTS;
    private constructor();
    static getInstance(baseDAL: any): BatchKVOperations;
    /**
     * Schedule a batch operation with automatic batching
     */
    scheduleRead(key: string, namespace?: string, priority?: 'high' | 'medium' | 'low'): Promise<any>;
    /**
     * Schedule multiple reads in a batch
     */
    scheduleBatchRead(keys: string[], namespace?: string, priority?: 'high' | 'medium' | 'low'): Promise<Map<string, any>>;
    /**
     * Schedule a write operation with batching
     */
    scheduleWrite(key: string, data: any, namespace?: string, priority?: 'high' | 'medium' | 'low'): Promise<boolean>;
    /**
     * Schedule multiple writes in a batch
     */
    scheduleBatchWrite(entries: Array<{
        key: string;
        data: any;
    }>, namespace?: string, priority?: 'high' | 'medium' | 'low'): Promise<boolean[]>;
    /**
     * Execute batch operations immediately (don't wait for timeout)
     */
    executeBatch(batchKey: string): Promise<BatchResult>;
    /**
     * Execute batch read operations
     */
    private executeBatchReads;
    /**
     * Execute batch write operations
     */
    private executeBatchWrites;
    /**
     * Schedule batch execution based on priority
     */
    private scheduleBatchExecution;
    /**
     * Group operations by namespace
     */
    private groupByNamespace;
    /**
     * Generate batch key
     */
    private getBatchKey;
    /**
     * Wait for specific operation completion
     */
    private waitForOperationCompletion;
    /**
     * Wait for batch completion
     */
    private waitForBatchCompletion;
    /**
     * Get batch statistics for monitoring
     */
    getBatchStats(): {
        pendingBatches: number;
        totalPendingOperations: number;
        pendingByPriority: Record<string, number>;
        batchEfficiency: number;
    };
    /**
     * Force execute all pending batches
     */
    flushAllBatches(): Promise<BatchResult[]>;
    /**
     * Cancel pending operations
     */
    cancelBatch(batchKey: string): boolean;
    /**
     * Cleanup old batches and timeouts
     */
    cleanup(): void;
}
//# sourceMappingURL=batch-kv-operations.d.ts.map