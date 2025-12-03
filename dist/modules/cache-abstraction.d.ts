/**
 * Cache Abstraction Layer
 * Smart routing: DO Cache (primary) → KV (fallback)
 *
 * Purpose:
 * - Make DO cache the default for ALL cache operations
 * - Automatic fallback to KV if DO cache unavailable
 * - Single source of truth for cache routing logic
 * - Type-safe interface matching KV API
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Cache write options
 */
export interface CacheWriteOptions {
    expirationTtl?: number;
    metadata?: Record<string, any>;
}
/**
 * Cache list options
 */
export interface CacheListOptions {
    prefix?: string;
    limit?: number;
    cursor?: string;
}
/**
 * Cache list result
 */
export interface CacheListResult {
    keys: Array<{
        name: string;
        expiration?: number;
        metadata?: any;
    }>;
    list_complete: boolean;
    cursor?: string;
}
/**
 * Cache Abstraction Layer
 *
 * Provides unified interface for cache operations with smart routing:
 * 1. Check if DO cache is enabled (FEATURE_FLAG_DO_CACHE=true + CACHE_DO binding)
 * 2. If yes → Use DO cache (persistent memory, <1ms latency)
 * 3. If no → Fall back to KV (traditional storage, 10-50ms latency)
 *
 * Features:
 * - Zero breaking changes (same interface as KV)
 * - Automatic serialization/deserialization
 * - Comprehensive logging for observability
 * - Type-safe operations
 * - Graceful degradation
 */
export declare class CacheAbstraction {
    private doCache;
    private env;
    private useDO;
    constructor(env: CloudflareEnvironment);
    /**
     * Write value to cache
     * Routes to DO cache if enabled, otherwise KV
     */
    put(key: string, value: any, options?: CacheWriteOptions): Promise<void>;
    /**
     * Read value from cache
     * Routes to DO cache if enabled, otherwise KV
     */
    get(key: string): Promise<any | null>;
    /**
     * Delete value from cache
     * Routes to DO cache if enabled, otherwise KV
     */
    delete(key: string): Promise<void>;
    /**
     * List keys in cache
     * Note: Only available for KV (DO cache doesn't support list operation)
     */
    list(options?: CacheListOptions): Promise<CacheListResult>;
    /**
     * Get cache source being used
     */
    getSource(): 'do' | 'kv';
    /**
     * Check if DO cache is active
     */
    isUsingDO(): boolean;
    /**
     * Get cache statistics (if DO cache is active)
     */
    getStats(): Promise<any | null>;
    /**
     * Clear all cache entries
     * Note: Only works with DO cache
     */
    clear(): Promise<void>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        healthy: boolean;
        source: 'do' | 'kv';
    }>;
}
/**
 * Factory function to create cache abstraction instances
 * Replaces direct env.MARKET_ANALYSIS_CACHE access
 */
export declare function createCache(env: CloudflareEnvironment): CacheAbstraction;
/**
 * Helper: Check if cache operation should use DO
 * Useful for conditional logic in existing code
 */
export declare function shouldUseDOCache(env: CloudflareEnvironment): boolean;
//# sourceMappingURL=cache-abstraction.d.ts.map