/**
 * Enhanced KV Consistency Handler
 * Addresses eventual consistency with read-after-write consistency patterns
 */
import type { CloudflareEnvironment } from '../types.js';
export type StrategyType = 'CRITICAL' | 'STANDARD' | 'BACKGROUND';
export interface RetryStrategy {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    timeout: number;
}
export interface ConsistencyConfig {
    MAX_CONSISTENCY_DELAY: number;
    RETRY_STRATEGIES: {
        CRITICAL: RetryStrategy;
        STANDARD: RetryStrategy;
        BACKGROUND: RetryStrategy;
    };
}
export interface ConsistencyOptions {
    strategy?: StrategyType;
    timeout?: number;
    description?: string;
}
export interface AtomicOperationOptions {
    timeout?: number;
    rollbackOnFailure?: boolean;
    consistencyCheck?: (env: CloudflareEnvironment, operationId: string, result: any) => Promise<boolean>;
    rollback?: (env: CloudflareEnvironment, operationId: string, result: any) => Promise<void>;
}
export interface AtomicOperationResult {
    success: boolean;
    result: any;
    consistencyAchieved: boolean;
    error?: string;
}
export interface DependencyConsistencyResult {
    isValid: boolean;
    consistentJobs: string[];
    inconsistentJobs: string[];
}
export type ConsistencyCondition = (env: CloudflareEnvironment, key: string) => Promise<boolean>;
/**
 * KV Eventual Consistency Configuration
 */
export declare const CONSISTENCY_CONFIG: ConsistencyConfig;
/**
 * Wait for KV consistency with configurable timeout
 */
export declare function waitForConsistency(key: string, condition: ConsistencyCondition, env: CloudflareEnvironment, options?: ConsistencyOptions): Promise<boolean>;
/**
 * Read-after-write consistency pattern for critical operations
 */
export declare function verifyWriteConsistency(key: string, expectedValue: string, env: CloudflareEnvironment, options?: ConsistencyOptions): Promise<boolean>;
/**
 * Status consistency pattern for job status updates
 */
export declare function verifyStatusConsistency(date: string, jobType: string, expectedStatus: string, env: CloudflareEnvironment): Promise<boolean>;
/**
 * Dependency consistency pattern for multi-job pipelines
 */
export declare function verifyDependencyConsistency(date: string, dependencies: string[], env: CloudflareEnvironment): Promise<DependencyConsistencyResult>;
/**
 * Atomic-like operation pattern for complex KV operations
 */
export declare function executeAtomicLikeOperation(operationId: string, operation: (env: CloudflareEnvironment) => Promise<any>, env: CloudflareEnvironment, options?: AtomicOperationOptions): Promise<AtomicOperationResult>;
/**
 * Get consistency configuration for different operation types
 */
export declare function getConsistencyConfig(operationType: string): RetryStrategy;
/**
 * Helper function to create a consistency check function for KV existence
 */
export declare function createExistenceCheck(expectedValue?: string): ConsistencyCondition;
/**
 * Helper function to create a consistency check function for JSON data
 */
export declare function createJsonCheck<T = any>(validator: (data: T) => boolean): ConsistencyCondition;
/**
 * Batch consistency verification for multiple keys
 */
export declare function verifyBatchConsistency(checks: Array<{
    key: string;
    condition: ConsistencyCondition;
    options?: ConsistencyOptions;
}>, env: CloudflareEnvironment): Promise<Array<{
    key: string;
    consistent: boolean;
    error?: string;
}>>;
declare const _default: {
    waitForConsistency: typeof waitForConsistency;
    verifyWriteConsistency: typeof verifyWriteConsistency;
    verifyStatusConsistency: typeof verifyStatusConsistency;
    verifyDependencyConsistency: typeof verifyDependencyConsistency;
    executeAtomicLikeOperation: typeof executeAtomicLikeOperation;
    getConsistencyConfig: typeof getConsistencyConfig;
    createExistenceCheck: typeof createExistenceCheck;
    createJsonCheck: typeof createJsonCheck;
    verifyBatchConsistency: typeof verifyBatchConsistency;
    CONSISTENCY_CONFIG: ConsistencyConfig;
};
export default _default;
//# sourceMappingURL=kv-consistency.d.ts.map