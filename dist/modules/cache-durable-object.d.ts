import { DurableObject } from 'cloudflare:workers';
import type { CloudflareEnvironment } from '../types.js';
/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
    size: number;
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
    oldestEntry?: string;
    newestEntry?: string;
}
/**
 * Durable Object for persistent cache storage with KV backup
 *
 * Features:
 * - Persistent in-memory Map (survives worker restarts)
 * - Dual persistence: DO storage + KV namespace (shared across workers)
 * - TTL-based expiration
 * - LRU eviction when at capacity
 * - Automatic cleanup via Alarms API
 * - <1ms read/write latency
 *
 * Architecture:
 * - Primary: DO persistent memory (fastest, <1ms)
 * - Backup: KV namespace (shared across all workers)
 * - Load order: KV first (shared), then DO storage (instance-specific)
 *
 * Benefits:
 * - Cache survives DO restarts (KV backup)
 * - Cache shared across workers (KV namespace)
 * - Best performance (DO memory) + best durability (KV)
 * - Single cache layer with dual persistence
 */
interface DOState {
    storage: {
        get<T = any>(key: string): Promise<T | undefined>;
        put(key: string, value: any): Promise<void>;
        deleteAll(): Promise<void>;
        setAlarm(scheduledTime: number): Promise<void>;
    };
}
export declare class CacheDurableObject extends DurableObject {
    private cache;
    private maxSize;
    private stats;
    private cleanupScheduled;
    constructor(state: any, env: CloudflareEnvironment);
    state: DOState;
    env: CloudflareEnvironment;
    /**
     * Initialize from persistent storage (cold start)
     * Tries KV first (shared across workers), then falls back to DO storage
     */
    private initializeFromStorage;
    /**
     * Get value from cache
     */
    get(key: string): Promise<any | null>;
    /**
     * Set value in cache with TTL
     */
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    /**
     * Delete key from cache
     */
    delete(key: string): Promise<boolean>;
    /**
     * Clear all cache entries
     * Clears both DO storage and KV namespace
     */
    clear(): Promise<void>;
    /**
     * Get cache statistics
     */
    getStats(): Promise<CacheStats>;
    /**
     * Get cache metadata with timestamps (for debugging)
     */
    getCacheMetadata(): Promise<{
        [key: string]: any;
    }>;
    /**
     * Evict least recently used entry
     */
    private evictLRU;
    /**
     * Update statistics in persistent storage
     */
    private updateStats;
    /**
     * Persist cache to storage (DO storage + KV for redundancy)
     * Writes to both DO's built-in storage and main KV namespace
     * This ensures cache survives DO restarts AND is shared across workers
     */
    private persistToStorage;
    /**
     * Schedule cleanup alarm
     */
    private scheduleCleanup;
    alarm(): Promise<void>;
    /**
     * Clean up expired entries
     */
    private cleanupExpired;
}
export {};
//# sourceMappingURL=cache-durable-object.d.ts.map