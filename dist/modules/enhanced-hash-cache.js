/**
 * Enhanced HashCache - In-Memory Cache with TTL and LRU Eviction
 * Inspired by DAC implementation with memory-based limits and intelligent management
 * Replaces basic Map-based L1 cache for superior performance
 */
import { createLogger } from './logging.js';
const logger = createLogger('enhanced-hash-cache');
/**
 * Enhanced in-memory cache with:
 * - TTL-based expiration
 * - LRU eviction with memory limits
 * - Automatic cleanup
 * - Comprehensive statistics
 * - Memory management
 */
export class EnhancedHashCache {
    constructor(config) {
        this.config = {
            maxSize: config?.maxSize || 1000,
            maxMemoryMB: config?.maxMemoryMB || 10,
            defaultTTL: config?.defaultTTL || 900, // 15 minutes
            staleGracePeriod: config?.staleGracePeriod || 300, // 5 minutes
            enableStaleWhileRevalidate: config?.enableStaleWhileRevalidate || false,
            cleanupInterval: config?.cleanupInterval || 60, // 1 minute
            enableStats: config?.enableStats !== false,
        };
        this.cache = new Map();
        this.enabled = true;
        this.lastCleanup = Date.now();
        this.backgroundRefreshCallbacks = new Map();
        this.refreshingKeys = new Set();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            currentSize: 0,
            currentMemoryMB: 0,
            hitRate: 0,
        };
        logger.info('Enhanced HashCache initialized', {
            maxSize: this.config.maxSize,
            maxMemoryMB: this.config.maxMemoryMB,
            defaultTTL: this.config.defaultTTL,
            staleGracePeriod: this.config.staleGracePeriod,
            cleanupInterval: this.config.cleanupInterval,
        });
    }
    /**
     * Get value from cache with automatic cleanup and statistics
     * Returns null if key doesn't exist or has expired
     */
    async get(key) {
        if (!this.enabled) {
            return null;
        }
        // Run cleanup if needed
        this.maybeCleanup();
        const entry = this.cache.get(key);
        if (!entry) {
            this.recordMiss();
            return null;
        }
        // Check if expired
        const now = Date.now();
        if (now > entry.expiresAt) { // Expired
            const gracePeriodEnd = entry.expiresAt + this.config.staleGracePeriod * 1000;
            if (now < gracePeriodEnd) {
                // Still within grace period, serve stale data
                this.recordHit(); // Treat as a hit to reflect KV load reduction
                entry.lastAccessed = now; // Update LRU
                // Stale-While-Revalidate pattern: trigger background refresh if enabled
                if (this.config.enableStaleWhileRevalidate) {
                    this.triggerBackgroundRefresh(key, entry);
                }
                logger.debug(`Serving stale cache entry from grace period: ${key}`);
                return entry.data;
            }
            else {
                // Expired and outside grace period
                this.cache.delete(key);
                this.updateStats();
                this.recordMiss();
                logger.debug(`Cache entry expired and removed: ${key}`);
                return null;
            }
        }
        // Update access statistics
        entry.lastAccessed = now;
        entry.hits++;
        this.recordHit();
        return entry.data;
    }
    /**
     * Set value in cache with optional TTL and intelligent eviction
     */
    async set(key, data, ttl) {
        if (!this.enabled) {
            return;
        }
        const effectiveTTL = ttl || this.config.defaultTTL;
        const now = Date.now();
        const expiresAt = now + effectiveTTL * 1000;
        const size = this.estimateSize(data);
        const entry = {
            data,
            timestamp: now,
            expiresAt,
            lastAccessed: now,
            hits: 0,
            size,
            l1Timestamp: now,
            l2Timestamp: undefined, // Will be set when promoted from L2
            cacheSource: 'fresh', // Fresh data initially
        };
        // Check if we need to evict before adding
        await this.maybeEvict(size);
        this.cache.set(key, entry);
        this.updateStats();
        logger.debug(`Cache set: ${key} (TTL: ${effectiveTTL}s, Size: ${size} bytes)`);
    }
    /**
     * Delete key from cache
     */
    async delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.updateStats();
            logger.debug(`Cache delete: ${key}`);
        }
        return deleted;
    }
    /**
     * Check if key exists and is not expired
     */
    async has(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }
        // Check if expired
        const now = Date.now();
        const gracePeriodEnd = entry.expiresAt + this.config.staleGracePeriod * 1000;
        if (now > gracePeriodEnd) {
            this.cache.delete(key);
            this.updateStats();
            return false;
        }
        return true;
    }
    /**
     * Clear all entries from cache
     */
    async clear() {
        this.cache.clear();
        this.resetStats();
        logger.info('Cache cleared');
    }
    /**
     * Get current cache size (number of entries)
     */
    size() {
        return this.cache.size;
    }
    /**
     * Get all keys (non-expired entries only)
     */
    keys() {
        const now = Date.now();
        const validKeys = [];
        for (const [key, entry] of Array.from(this.cache.entries())) {
            if (now <= entry.expiresAt) {
                validKeys.push(key);
            }
        }
        return validKeys;
    }
    /**
     * Get comprehensive cache statistics
     */
    getStats() {
        this.updateStats();
        return { ...this.stats };
    }
    /**
     * Get detailed cache information for debugging
     */
    getDetailedInfo() {
        this.updateStats();
        const now = Date.now();
        const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
            key: key.length > 50 ? key.substring(0, 47) + '...' : key, // Truncate long keys
            age: Math.floor((now - entry.timestamp) / 1000),
            ttl: Math.max(0, Math.floor((entry.expiresAt - now) / 1000)),
            hits: entry.hits,
            size: entry.size,
        })).sort((a, b) => b.age - a.age); // Sort by age (oldest first)
        return {
            config: { ...this.config },
            stats: { ...this.stats },
            entries,
        };
    }
    /**
     * Enable/disable cache
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        logger.info(`Cache ${enabled ? 'enabled' : 'disabled'}`);
    }
    /**
     * Check if cache is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Force cleanup of expired entries
     */
    async cleanup() {
        const now = Date.now();
        let removed = 0;
        // A cleanup removes items that are past their TTL + grace period
        for (const [key, entry] of Array.from(this.cache.entries())) {
            if (now > entry.expiresAt + this.config.staleGracePeriod * 1000) {
                this.cache.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            this.updateStats();
            logger.info(`Cleanup removed ${removed} expired entries`);
        }
        this.lastCleanup = now;
        return removed;
    }
    /**
     * Run cleanup if interval has passed
     */
    maybeCleanup() {
        const now = Date.now();
        if (now - this.lastCleanup > this.config.cleanupInterval * 1000) {
            // Run cleanup asynchronously to avoid blocking
            this.cleanup().catch(error => {
                logger.error('Cleanup error:', { error: error instanceof Error ? error.message : 'Unknown error' });
            });
            this.lastCleanup = now;
        }
    }
    /**
     * Evict entries if size or memory limit would be exceeded
     */
    async maybeEvict(newEntrySize) {
        // Check size limit
        if (this.cache.size >= this.config.maxSize) {
            await this.evictLRU();
        }
        // Check memory limit
        const currentMemoryBytes = this.stats.currentMemoryMB * 1024 * 1024;
        const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;
        while (currentMemoryBytes + newEntrySize > maxMemoryBytes && this.cache.size > 0) {
            await this.evictLRU();
        }
    }
    /**
     * Evict least recently used entry
     */
    async evictLRU() {
        let oldestKey = null;
        let oldestTime = Infinity;
        // Find least recently used entry
        for (const [key, entry] of Array.from(this.cache.entries())) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;
            this.updateStats();
            logger.debug(`LRU evicted: ${oldestKey}`);
        }
    }
    /**
     * Estimate size of value in bytes
     */
    estimateSize(value) {
        try {
            const json = JSON.stringify(value);
            // Rough estimate: 2 bytes per character for UTF-16
            return json.length * 2;
        }
        catch {
            // Fallback for non-serializable values
            return 1024; // 1KB default
        }
    }
    /**
     * Update cache statistics
     */
    updateStats() {
        this.stats.currentSize = this.cache.size;
        let totalSize = 0;
        let oldestTimestamp = Infinity;
        let newestTimestamp = 0;
        const now = Date.now();
        for (const entry of Array.from(this.cache.values())) {
            totalSize += entry.size;
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
            }
            if (entry.timestamp > newestTimestamp) {
                newestTimestamp = entry.timestamp;
            }
        }
        this.stats.currentMemoryMB = totalSize / (1024 * 1024);
        if (oldestTimestamp !== Infinity) {
            this.stats.oldestEntry = Math.floor((now - oldestTimestamp) / 1000);
            this.stats.newestEntry = Math.floor((now - newestTimestamp) / 1000);
        }
    }
    /**
     * Record cache hit
     */
    recordHit() {
        if (this.config.enableStats) {
            this.stats.hits++;
            this.updateHitRate();
        }
    }
    /**
     * Record cache miss
     */
    recordMiss() {
        if (this.config.enableStats) {
            this.stats.misses++;
            this.updateHitRate();
        }
    }
    /**
     * Update hit rate
     */
    updateHitRate() {
        if (this.config.enableStats) {
            const total = this.stats.hits + this.stats.misses;
            this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
        }
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            currentSize: 0,
            currentMemoryMB: 0,
            hitRate: 0,
        };
    }
    /**
     * Register a background refresh callback for a key pattern
     * This enables the Stale-While-Revalidate pattern
     */
    setBackgroundRefreshCallback(keyPattern, refreshFn) {
        this.backgroundRefreshCallbacks.set(keyPattern, refreshFn);
        logger.debug(`Registered background refresh callback for pattern: ${keyPattern}`);
    }
    /**
     * Trigger background refresh for a stale cache entry
     * Non-blocking - serves stale data immediately while refreshing in background
     */
    async triggerBackgroundRefresh(key, entry) {
        // Prevent duplicate refreshes for the same key
        if (this.refreshingKeys.has(key)) {
            logger.debug(`Background refresh already in progress for key: ${key}`);
            return;
        }
        // Find matching refresh callback
        let refreshFn = null;
        for (const [pattern, callback] of Array.from(this.backgroundRefreshCallbacks.entries())) {
            if (key.includes(pattern) || key.match(new RegExp(pattern))) {
                refreshFn = callback;
                break;
            }
        }
        if (!refreshFn) {
            // No refresh callback registered for this key
            return;
        }
        // Mark as refreshing to prevent duplicates
        this.refreshingKeys.add(key);
        // Background refresh - non-blocking
        refreshFn().then(async (freshData) => {
            try {
                // Update cache with fresh data, preserving original TTL
                const originalTTL = Math.round((entry.expiresAt - entry.timestamp) / 1000);
                await this.set(key, freshData, originalTTL);
                logger.info(`Background refresh completed for key: ${key}`, {
                    age: Date.now() - entry.timestamp,
                    originalTTL
                });
            }
            catch (error) {
                logger.error(`Background refresh failed for key: ${key}`, {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
            finally {
                // Remove from refreshing set
                this.refreshingKeys.delete(key);
            }
        }).catch((error) => {
            logger.error(`Background refresh error for key: ${key}`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            this.refreshingKeys.delete(key);
        });
        logger.debug(`Triggered background refresh for key: ${key}`);
    }
    /**
     * Enable or disable Stale-While-Revalidate pattern
     */
    setStaleWhileRevalidate(enabled) {
        this.config.enableStaleWhileRevalidate = enabled;
        logger.info(`Stale-While-Revalidate ${enabled ? 'enabled' : 'disabled'}`);
    }
    /**
     * Check if Stale-While-Revalidate is enabled
     */
    isStaleWhileRevalidateEnabled() {
        return this.config.enableStaleWhileRevalidate;
    }
    /**
     * Get timestamp information for a cache entry
     */
    getTimestampInfo(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        const now = Date.now();
        const ageSeconds = Math.floor((now - entry.l1Timestamp) / 1000);
        const ttlSeconds = Math.floor((entry.expiresAt - entry.l1Timestamp) / 1000);
        const isExpired = now > entry.expiresAt;
        const gracePeriodEnd = entry.expiresAt + (this.config.staleGracePeriod * 1000);
        const isWithinGracePeriod = isExpired && now < gracePeriodEnd;
        return {
            l1Timestamp: new Date(entry.l1Timestamp).toISOString(),
            l2Timestamp: entry.l2Timestamp ? new Date(entry.l2Timestamp).toISOString() : undefined,
            cacheSource: entry.cacheSource,
            ageSeconds,
            ttlSeconds,
            expiresAt: new Date(entry.expiresAt).toISOString(),
            isStale: isExpired,
            isWithinGracePeriod
        };
    }
    /**
     * Get data with timestamp information
     */
    async getWithTimestampInfo(key) {
        const data = await this.get(key);
        const timestampInfo = this.getTimestampInfo(key);
        return { data, timestampInfo };
    }
}
/**
 * Factory function to create enhanced hash cache instances
 */
export function createEnhancedHashCache(config) {
    return new EnhancedHashCache(config);
}
export default EnhancedHashCache;
//# sourceMappingURL=enhanced-hash-cache.js.map