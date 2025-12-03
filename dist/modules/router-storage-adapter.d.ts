/**
 * Router Storage Adapter
 *
 * Routes storage operations to appropriate adapters based on key patterns and storage classes.
 * Supports dual-mode operations for migration scenarios.
 *
 * @version 2.0.0 - Storage Architecture Modernization
 * @since 2025-11-28
 */
import type { StorageAdapter, StorageClass, StorageResult, StorageOptions } from './storage-adapters.js';
import { DOAdapter, D1Adapter, MemoryAdapter } from './storage-adapters.js';
import { StorageGuards } from './storage-guards.js';
import type { CloudflareEnvironment } from '../types.js';
export interface KeyPattern {
    pattern: string;
    regex: RegExp;
    storageClass: StorageClass;
}
export interface StorageMode {
    hot_cache: 'disabled' | 'dual' | 'do' | 'do_final';
    warm_cache: 'disabled' | 'dual' | 'do' | 'do_final';
    cold_storage: 'disabled' | 'd1';
    ephemeral: 'disabled' | 'memory';
}
export interface RouterConfig {
    modes: StorageMode;
    keyPatterns: KeyPattern[];
    recencyThreshold: number;
    adapters: {
        hot?: DOAdapter;
        warm?: DOAdapter;
        cold?: D1Adapter;
        ephemeral?: MemoryAdapter;
        fallback?: StorageAdapter;
    };
}
export declare class RouterStorageAdapter implements StorageAdapter {
    readonly name = "RouterStorageAdapter";
    readonly storageClass: "hot_cache";
    readonly enabled = true;
    private config;
    private stats;
    private storageGuards?;
    private metricsCollector?;
    constructor(config: RouterConfig);
    /**
     * Set storage guards for KV operation enforcement
     */
    setStorageGuards(storageGuards: StorageGuards): void;
    /**
     * Set metrics collector for instrumentation
     */
    setMetricsCollector(metricsCollector: any): void;
    get(key: string): Promise<StorageResult>;
    put(key: string, value: any, options?: StorageOptions): Promise<StorageResult>;
    delete(key: string): Promise<StorageResult>;
    list(options?: {
        prefix?: string;
        limit?: number;
    }): Promise<StorageResult<string[]>>;
    private resolveRoute;
    private isRecentAnalysis;
    private getAdapter;
    private isDualMode;
    private dualPut;
    private dualDelete;
    private getActiveAdapters;
    /**
     * Promote data from DO to D1 cold storage
     * Used when hot cache data ages out or needs long-term persistence
     */
    promoteToDo(key: string, targetStorageClass?: 'warm_cache' | 'cold_storage'): Promise<StorageResult>;
    /**
     * Demote data from D1 back to DO hot cache
     * Used when cold data is accessed frequently enough to warrant hot caching
     */
    demoteToDo(key: string, sourceStorageClass?: 'cold_storage' | 'warm_cache'): Promise<StorageResult>;
    /**
     * Batch promote multiple keys from hot to cold storage
     * Optimized for bulk operations during cache maintenance
     */
    batchPromote(keys: string[], targetStorageClass?: 'warm_cache' | 'cold_storage'): Promise<{
        results: StorageResult[];
        summary: {
            successful: number;
            failed: number;
        };
    }>;
    /**
     * Get lifecycle statistics for monitoring and optimization
     */
    getLifecycleStats(): {
        promotions: {
            total: number;
            successful: number;
            failed: number;
            avgLatency: number;
        };
        demotions: {
            total: number;
            successful: number;
            failed: number;
            avgLatency: number;
        };
        byStorageClass: Record<string, {
            promotions: number;
            demotions: number;
        }>;
    };
    /**
     * Record lifecycle operation metrics
     */
    private recordLifecycleMetrics;
    /**
     * Extract keyspace from key for metrics (reuse existing logic)
     */
    private extractKeyspaceFromKey;
    getStats(): Promise<any>;
    healthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
    }>;
    close(): Promise<void>;
}
export declare function createDefaultRouterConfig(env: CloudflareEnvironment): RouterConfig;
//# sourceMappingURL=router-storage-adapter.d.ts.map