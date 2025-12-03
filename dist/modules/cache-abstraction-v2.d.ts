/**
 * Cache Abstraction Layer V2 - Storage Adapter Integration
 *
 * Provides backward compatibility with existing cache-abstraction.ts
 * while integrating the new StorageAdapter architecture.
 *
 * This module extends (not replaces) the existing cache abstraction,
 * allowing gradual migration to the new storage system.
 *
 * @version 2.0.0 - Storage Architecture Modernization
 * @since 2025-11-28
 */
import type { CloudflareEnvironment } from '../types.js';
export interface EnhancedCacheOptions {
    ttl?: number;
    metadata?: Record<string, any>;
    storageClass?: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
    forceLegacy?: boolean;
}
export interface EnhancedCacheWriteOptions extends EnhancedCacheOptions {
    expirationTtl?: number;
}
export interface EnhancedCacheListOptions {
    prefix?: string;
    limit?: number;
    storageClass?: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
}
export interface EnhancedCacheListResult {
    keys: Array<{
        name: string;
        expiration?: number;
        metadata?: any;
        storageClass?: string;
    }>;
    list_complete: boolean;
    cursor?: string;
    metadata?: {
        totalKeys: number;
        storageClassBreakdown: Record<string, number>;
        adapterSources: string[];
    };
}
export interface EnhancedCacheStats {
    legacy: {
        hits: number;
        misses: number;
        hitRate: number;
        totalRequests: number;
    };
    router: {
        totalOperations: number;
        routerHits: number;
        routerMisses: number;
        hitRate: number;
        classStats: Record<string, {
            hits: number;
            errors: number;
        }>;
    };
    adapters: Record<string, any>;
    modes: Record<string, string>;
}
export declare class EnhancedCacheManager {
    private env;
    private legacyAdapter;
    private routerAdapter;
    private config;
    private enabled;
    constructor(env: CloudflareEnvironment);
    private initializeRouterAdapter;
    private createAdapters;
    put(key: string, value: any, options?: EnhancedCacheWriteOptions): Promise<void>;
    get(key: string): Promise<any | null>;
    delete(key: string): Promise<void>;
    list(options?: EnhancedCacheListOptions): Promise<EnhancedCacheListResult>;
    getStats(): Promise<EnhancedCacheStats>;
    healthCheck(): Promise<{
        healthy: boolean;
        issues: string[];
        legacy?: any;
        router?: any;
    }>;
    isEnabled(): boolean;
    getConfiguration(): any;
    private calculateClassBreakdown;
    private getActiveAdapterSources;
    close(): Promise<void>;
}
export declare function createEnhancedCacheManager(env: CloudflareEnvironment): EnhancedCacheManager;
//# sourceMappingURL=cache-abstraction-v2.d.ts.map