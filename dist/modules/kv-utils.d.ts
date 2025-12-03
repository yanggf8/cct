/**
 * KV Utility Functions for Hybrid Data Pipeline
 * Handles eventual consistency, atomic status updates, and dependency validation
 */
import type { CloudflareEnvironment } from '../types.js';
interface KVOperationOptions {
    expirationTtl?: number;
    [key: string]: any;
}
interface JobStatusData {
    status: string;
    timestamp: string;
    [key: string]: any;
}
interface DependencyValidationResult {
    isValid: boolean;
    completed: string[];
    missing: string[];
    completionRate: number;
    date: string;
    requiredJobs: string[];
}
/**
 * Get KV value with retry logic for eventual consistency
 */
export declare function getWithRetry(key: string, env: CloudflareEnvironment, maxRetries?: number, delay?: number): Promise<string>;
/**
 * Put KV value with success verification
 */
export declare function putWithVerification(key: string, value: string, env: CloudflareEnvironment, options?: KVOperationOptions): Promise<boolean>;
/**
 * Delete KV value with success verification
 */
export declare function deleteWithVerification(key: string, env: CloudflareEnvironment): Promise<boolean>;
/**
 * Log comprehensive KV operation summary
 */
export declare function logKVOperation(operation: string, key: string, success: boolean, details?: Record<string, any>): void;
/**
 * Get multiple KV values with batch retry logic
 */
export declare function getMultipleWithRetry(keys: string[], env: CloudflareEnvironment): Promise<Record<string, string | null>>;
/**
 * Update job status with atomic individual key approach
 */
export declare function updateJobStatus(jobType: string, date: string, status: string, env: CloudflareEnvironment, metadata?: Record<string, any>): Promise<void>;
/**
 * Get job status for a specific job and date
 */
export declare function getJobStatus(jobType: string, date: string, env: CloudflareEnvironment): Promise<JobStatusData | null>;
/**
 * Validate that all required dependencies are completed
 */
export declare function validateDependencies(date: string, requiredJobs: string[], env: CloudflareEnvironment): Promise<DependencyValidationResult>;
export type { KVOperationOptions, JobStatusData, DependencyValidationResult };
//# sourceMappingURL=kv-utils.d.ts.map