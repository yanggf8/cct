/**
 * DAL Migration Examples - Phase 4 Implementation
 * Data Access Improvement Plan - Migration Guide
 *
 * This file demonstrates how to migrate from the original DAL
 * to the simplified enhanced DAL with zero breaking changes.
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Example 1: Basic Migration - Read Operations
 *
 * BEFORE: Original DAL
 * AFTER: Simplified Enhanced DAL with cache awareness
 */
export declare function exampleMigration_ReadAnalysis(env: CloudflareEnvironment): Promise<void>;
/**
 * Example 2: Write Operations with Cache Invalidation
 */
export declare function exampleMigration_StoreAnalysis(env: CloudflareEnvironment): Promise<void>;
/**
 * Example 3: Signal Tracking Operations
 */
export declare function exampleMigration_SignalTracking(env: CloudflareEnvironment): Promise<void>;
/**
 * Example 4: Performance Comparison
 */
export declare function exampleMigration_PerformanceComparison(env: CloudflareEnvironment): Promise<void>;
/**
 * Example 5: Batch Operations
 */
export declare function exampleMigration_BatchOperations(env: CloudflareEnvironment): Promise<void>;
/**
 * Example 6: Error Handling and Fallbacks
 */
export declare function exampleMigration_ErrorHandling(env: CloudflareEnvironment): Promise<void>;
/**
 * Complete Migration Example - All scenarios
 */
export declare function runCompleteMigrationExample(env: CloudflareEnvironment): Promise<void>;
/**
 * Migration Helper - Check Compatibility
 */
export declare function checkMigrationCompatibility(): {
    originalDALMethods: string[];
    enhancedDALMethods: string[];
    compatibility: string[];
};
declare const _default: {
    runCompleteMigrationExample: typeof runCompleteMigrationExample;
    exampleMigration_ReadAnalysis: typeof exampleMigration_ReadAnalysis;
    exampleMigration_StoreAnalysis: typeof exampleMigration_StoreAnalysis;
    exampleMigration_SignalTracking: typeof exampleMigration_SignalTracking;
    exampleMigration_PerformanceComparison: typeof exampleMigration_PerformanceComparison;
    exampleMigration_BatchOperations: typeof exampleMigration_BatchOperations;
    exampleMigration_ErrorHandling: typeof exampleMigration_ErrorHandling;
    checkMigrationCompatibility: typeof checkMigrationCompatibility;
};
export default _default;
//# sourceMappingURL=dal-migration-examples.d.ts.map