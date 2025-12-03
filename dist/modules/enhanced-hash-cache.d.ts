/**
 * Enhanced HashCache - In-Memory Cache with TTL and LRU Eviction
 * Inspired by DAC implementation with memory-based limits and intelligent management
 * Replaces basic Map-based L1 cache for superior performance
 */
/**
 * Cache entry with comprehensive metadata
 */
export interface EnhancedCacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
    lastAccessed: number;
    hits: number;
    size: number;
    l1Timestamp: number;
    l2Timestamp?: number;
    cacheSource: 'l1' | 'l2' | 'fresh';
}
/**
 * Enhanced cache statistics with memory tracking
 */
export interface EnhancedCacheStats {
    hits: number;
    misses: number;
    evictions: number;
    currentSize: number;
    currentMemoryMB: number;
    hitRate: number;
    oldestEntry?: number;
    newestEntry?: number;
}
/**
 * Cache timestamp information for API responses
 */
export interface CacheTimestampInfo {
    l1Timestamp: string;
    l2Timestamp?: string;
    cacheSource: 'l1' | 'l2' | 'fresh';
    ageSeconds: number;
    ttlSeconds: number;
    expiresAt: string;
    isStale: boolean;
    isWithinGracePeriod: boolean;
}
/**
 * Enhanced HashCache configuration
 */
export interface EnhancedHashCacheConfig {
    maxSize: number;
    maxMemoryMB: number;
    defaultTTL: number;
    staleGracePeriod: number;
    enableStaleWhileRevalidate: boolean;
    cleanupInterval: number;
    enableStats: boolean;
}
/**
 * Enhanced in-memory cache with:
 * - TTL-based expiration
 * - LRU eviction with memory limits
 * - Automatic cleanup
 * - Comprehensive statistics
 * - Memory management
 */
export declare class EnhancedHashCache<T = any> {
    private cache;
    private config;
    private stats;
    private lastCleanup;
    private enabled;
    private backgroundRefreshCallbacks;
    private refreshingKeys;
    constructor(config?: Partial<EnhancedHashCacheConfig>);
    /**
     * Get value from cache with automatic cleanup and statistics
     * Returns null if key doesn't exist or has expired
     */
    get(key: string): Promise<T | null>;
    /**
     * Set value in cache with optional TTL and intelligent eviction
     */
    set(key: string, data: T, ttl?: number): Promise<void>;
    /**
     * Delete key from cache
     */
    delete(key: string): Promise<boolean>;
    /**
     * Check if key exists and is not expired
     */
    has(key: string): Promise<boolean>;
    /**
     * Clear all entries from cache
     */
    clear(): Promise<void>;
    /**
     * Get current cache size (number of entries)
     */
    size(): number;
    /**
     * Get all keys (non-expired entries only)
     */
    keys(): string[];
    /**
     * Get comprehensive cache statistics
     */
    getStats(): EnhancedCacheStats;
    /**
     * Get detailed cache information for debugging
     */
    getDetailedInfo(): {
        config: EnhancedHashCacheConfig;
        stats: EnhancedCacheStats;
        entries: Array<{
            key: string;
            age: number;
            ttl: number;
            hits: number;
            size: number;
        }>;
    };
    /**
     * Enable/disable cache
     */
    setEnabled(enabled: boolean): void;
    /**
     * Check if cache is enabled
     */
    isEnabled(): boolean;
    /**
     * Force cleanup of expired entries
     */
    cleanup(): Promise<number>;
    /**
     * Run cleanup if interval has passed
     */
    private maybeCleanup;
    /**
     * Evict entries if size or memory limit would be exceeded
     */
    private maybeEvict;
    /**
     * Evict least recently used entry
     */
    private evictLRU;
    /**
     * Estimate size of value in bytes
     */
    private estimateSize;
    /**
     * Update cache statistics
     */
    private updateStats;
    /**
     * Record cache hit
     */
    private recordHit;
    /**
     * Record cache miss
     */
    private recordMiss;
    /**
     * Update hit rate
     */
    private updateHitRate;
    /**
     * Reset statistics
     */
    private resetStats;
    /**
     * Register a background refresh callback for a key pattern
     * This enables the Stale-While-Revalidate pattern
     */
    setBackgroundRefreshCallback(keyPattern: string, refreshFn: () => Promise<T>): void;
    /**
     * Trigger background refresh for a stale cache entry
     * Non-blocking - serves stale data immediately while refreshing in background
     */
    private triggerBackgroundRefresh;
    /**
     * Enable or disable Stale-While-Revalidate pattern
     */
    setStaleWhileRevalidate(enabled: boolean): void;
    /**
     * Check if Stale-While-Revalidate is enabled
     */
    isStaleWhileRevalidateEnabled(): boolean;
    /**
     * Get timestamp information for a cache entry
     */
    getTimestampInfo(key: string): CacheTimestampInfo | null;
    /**
     * Get data with timestamp information
     */
    getWithTimestampInfo(key: string): Promise<{
        data: T | null;
        timestampInfo: CacheTimestampInfo | null;
    }>;
}
/**
 * Factory function to create enhanced hash cache instances
 */
export declare function createEnhancedHashCache<T = any>(config?: Partial<EnhancedHashCacheConfig>): EnhancedHashCache<T>;
export default EnhancedHashCache;
//# sourceMappingURL=enhanced-hash-cache.d.ts.map