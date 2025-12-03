/**
 * D1 Cold Storage Module - Option D Implementation
 *
 * Provides persistent cold storage implementation with analytics rollups.
 * Integrates with existing D1Adapter for cold storage operations.
 *
 * @version 1.0.0 - D1 Cold Storage Implementation
 * @since 2025-11-28
 */
import type { D1Database } from '../types.js';
export interface ColdStorageRecord {
    key: string;
    value: string;
    timestamp: string;
    ttl?: number;
    checksum?: string;
    storage_class: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
    created_at: string;
    updated_at: string;
}
export interface CacheRollupRecord {
    day: string;
    keyspace: string;
    storage_class: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
    hits: number;
    misses: number;
    p50_latency: number;
    p99_latency: number;
    errors: number;
    egress_bytes: number;
    compute_ms: number;
    total_operations: number;
    created_at: string;
}
export interface RollupMetrics {
    hits: number;
    misses: number;
    errors: number;
    totalOperations: number;
    latencies: number[];
    egressBytes: number;
    computeMs: number;
}
export declare class D1ColdStorage {
    private db;
    private initialized;
    constructor(db: D1Database);
    /**
     * Initialize D1 schema with idempotent CREATE TABLE statements
     */
    initialize(): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Store data in cold storage with TTL support
     */
    put(key: string, value: string, storageClass: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral', options?: {
        ttl?: number;
        checksum?: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Retrieve data from cold storage with TTL checking
     */
    get(key: string): Promise<{
        success: boolean;
        data?: ColdStorageRecord;
        error?: string;
    }>;
    /**
     * Delete data from cold storage
     */
    delete(key: string): Promise<{
        success: boolean;
        error?: string;
        deleted?: boolean;
    }>;
    /**
     * List keys in cold storage with optional filtering
     */
    list(options?: {
        prefix?: string;
        storageClass?: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
        limit?: number;
    }): Promise<{
        success: boolean;
        keys?: string[];
        error?: string;
    }>;
    /**
     * Upsert daily rollup metrics
     */
    upsertRollup(day: string, keyspace: string, storageClass: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral', metrics: RollupMetrics): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get rollup data for a specific day or date range
     */
    getRollups(day?: string, keyspace?: string, storageClass?: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral'): Promise<{
        success: boolean;
        rollups?: CacheRollupRecord[];
        error?: string;
    }>;
    /**
     * Prune expired keys from cold storage
     */
    pruneExpired(): Promise<{
        success: boolean;
        pruned?: number;
        error?: string;
    }>;
    /**
     * Get cold storage statistics
     */
    getStats(): Promise<{
        success: boolean;
        totalEntries?: number;
        entriesByClass?: Record<string, number>;
        error?: string;
    }>;
    /**
     * Prune a specific expired key
     */
    private pruneExpiredKey;
    /**
     * Calculate simple checksum for value integrity
     */
    private calculateChecksum;
    /**
     * Check if database is healthy and accessible
     */
    healthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
    }>;
}
/**
 * Create D1 cold storage instance
 */
export declare function createD1ColdStorage(db: D1Database): D1ColdStorage;
/**
 * Default D1 cold storage instance
 */
export declare const defaultD1ColdStorage: D1ColdStorage;
//# sourceMappingURL=d1-storage.d.ts.map