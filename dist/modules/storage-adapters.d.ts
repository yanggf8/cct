/**
 * Storage Adapters Interface and Implementation
 *
 * Provides unified interface for different storage backends:
 * - DO Cache (hot/warm storage)
 * - D1 Database (cold storage)
 * - Memory (ephemeral storage)
 * - KV Fallback (legacy compatibility)
 *
 * @version 2.0.0 - Storage Architecture Modernization
 * @since 2025-11-28
 */
export type StorageClass = 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
export interface StorageOptions {
    ttl?: number;
    metadata?: Record<string, any>;
    checksum?: string;
}
export interface StorageResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    metadata?: {
        timestamp: string;
        storageClass: StorageClass;
        backend: string;
        ttl?: number;
    };
}
export interface StorageStats {
    totalOperations: number;
    hits: number;
    misses: number;
    errors: number;
    avgLatency: number;
    storageUsed: number;
    lastAccess: string;
}
export interface StorageAdapter {
    readonly name: string;
    readonly storageClass: StorageClass;
    readonly enabled: boolean;
    get(key: string): Promise<StorageResult>;
    put(key: string, value: any, options?: StorageOptions): Promise<StorageResult>;
    delete(key: string): Promise<StorageResult>;
    list(options?: {
        prefix?: string;
        limit?: number;
    }): Promise<StorageResult<string[]>>;
    getStats(): Promise<StorageStats>;
    healthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
    }>;
    close(): Promise<void>;
}
export interface DOAdapterConfig {
    doNamespace: any;
    defaultTtl: number;
    maxSize: number;
    evictionPolicy: 'lru' | 'ttl';
}
export declare class DOAdapter implements StorageAdapter {
    readonly name = "DOAdapter";
    readonly storageClass: StorageClass;
    readonly enabled: boolean;
    private doCache;
    private config;
    private stats;
    private metricsCollector;
    constructor(storageClass: StorageClass, config: DOAdapterConfig);
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
    getStats(): Promise<StorageStats>;
    healthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
    }>;
    close(): Promise<void>;
    private updateLatency;
    private extractKeyspace;
}
export interface D1AdapterConfig {
    db: any;
    tableName: string;
}
export declare class D1Adapter implements StorageAdapter {
    readonly name = "D1Adapter";
    readonly storageClass: "cold_storage";
    readonly enabled: boolean;
    private config;
    private stats;
    private metricsCollector;
    constructor(config: D1AdapterConfig);
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
    getStats(): Promise<StorageStats>;
    healthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
    }>;
    close(): Promise<void>;
    private updateLatency;
    private extractKeyspace;
}
export declare class MemoryAdapter implements StorageAdapter {
    readonly name = "MemoryAdapter";
    readonly storageClass: "ephemeral";
    readonly enabled = true;
    private cache;
    private stats;
    private cleanupInterval;
    private metricsCollector;
    constructor();
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
    getStats(): Promise<StorageStats>;
    healthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
    }>;
    close(): Promise<void>;
    private cleanup;
    private updateLatency;
    private extractKeyspace;
}
//# sourceMappingURL=storage-adapters.d.ts.map