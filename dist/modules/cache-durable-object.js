// Durable Object Cache - Persistent In-Memory Cache with KV Backup
// Uses DO's persistent memory + KV namespace for maximum durability
// Survives worker restarts, provides <1ms latency, shared across workers
import { DurableObject } from 'cloudflare:workers';
import { createLogger } from './logging.js';
const logger = createLogger('cache-durable-object');
export class CacheDurableObject extends DurableObject {
    constructor(state, env) {
        super(state, env);
        this.maxSize = 1000; // Max entries
        this.cleanupScheduled = false;
        this.state = state;
        this.env = env;
        this.cache = new Map();
        this.stats = {
            size: 0,
            hits: 0,
            misses: 0,
            evictions: 0,
            hitRate: 0
        };
        // Load existing data from storage if any
        this.initializeFromStorage();
    }
    /**
     * Initialize from persistent storage (cold start)
     * Tries KV first (shared across workers), then falls back to DO storage
     */
    async initializeFromStorage() {
        try {
            // Try KV first (shared across workers)
            if (this.env.CACHE_DO_KV) {
                const kvStored = await this.env.CACHE_DO_KV.get('do_cache_entries');
                if (kvStored) {
                    const data = JSON.parse(kvStored);
                    this.cache = new Map(data.entries || []);
                    const kvStatsStr = await this.env.CACHE_DO_KV.get('do_cache_stats');
                    if (kvStatsStr) {
                        this.stats = JSON.parse(kvStatsStr);
                    }
                    logger.info('CACHE_DO_INIT', { source: 'kv', entries: this.cache.size });
                }
            }
            // If KV empty, try DO storage
            if (this.cache.size === 0) {
                const stored = await this.state.storage.get('cache');
                if (stored) {
                    this.cache = new Map(stored.entries || []);
                    const storedStats = await this.state.storage.get('stats');
                    if (storedStats) {
                        this.stats = storedStats;
                    }
                    logger.info('CACHE_DO_INIT', { source: 'do_storage', entries: this.cache.size });
                }
            }
            // Schedule cleanup alarm if not already scheduled
            if (!this.cleanupScheduled) {
                await this.scheduleCleanup();
            }
        }
        catch (error) {
            logger.error('CACHE_DO_INIT_ERROR', { error: error instanceof Error ? error.message : 'Failed to initialize from storage' });
        }
    }
    /**
     * Get value from cache
     */
    async get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            await this.updateStats();
            return null;
        }
        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            await this.updateStats();
            return null;
        }
        // Update access time and stats
        entry.lastAccessed = Date.now();
        this.stats.hits++;
        await this.updateStats();
        logger.debug('CACHE_DO_HIT', { key, hits: this.stats.hits });
        return entry.value;
    }
    /**
     * Set value in cache with TTL
     */
    async set(key, value, ttlSeconds = 3600) {
        const now = Date.now();
        const expiresAt = now + (ttlSeconds * 1000);
        const entry = {
            value,
            expiresAt,
            lastAccessed: now,
            cachedAt: new Date().toISOString()
        };
        // Check if we need to evict (at capacity)
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            await this.evictLRU();
        }
        this.cache.set(key, entry);
        await this.persistToStorage();
        logger.debug('CACHE_DO_SET', { key, ttl: ttlSeconds, size: this.cache.size });
    }
    /**
     * Delete key from cache
     */
    async delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            await this.persistToStorage();
        }
        return deleted;
    }
    /**
     * Clear all cache entries
     * Clears both DO storage and KV namespace
     */
    async clear() {
        this.cache.clear();
        this.stats = {
            size: 0,
            hits: 0,
            misses: 0,
            evictions: 0,
            hitRate: 0
        };
        await this.state.storage.deleteAll();
        // Also clear KV namespace
        if (this.env.CACHE_DO_KV) {
            await this.env.CACHE_DO_KV.delete('do_cache_entries');
            await this.env.CACHE_DO_KV.delete('do_cache_stats');
        }
        logger.info('CACHE_DO_CLEAR', { message: 'Cache cleared from DO storage + KV' });
    }
    /**
     * Get cache statistics
     */
    async getStats() {
        this.stats.size = this.cache.size;
        this.stats.hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
            : 0;
        // Find oldest and newest entries
        let oldestTime = Infinity;
        let newestTime = 0;
        let oldestKey = '';
        let newestKey = '';
        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
            if (entry.lastAccessed > newestTime) {
                newestTime = entry.lastAccessed;
                newestKey = key;
            }
        }
        this.stats.oldestEntry = oldestKey || undefined;
        this.stats.newestEntry = newestKey || undefined;
        return { ...this.stats };
    }
    /**
     * Get cache metadata with timestamps (for debugging)
     */
    async getCacheMetadata() {
        const metadata = {};
        for (const [key, entry] of this.cache.entries()) {
            metadata[key] = {
                cachedAt: entry.cachedAt,
                expiresAt: new Date(entry.expiresAt).toISOString(),
                lastAccessed: new Date(entry.lastAccessed).toISOString(),
                age: Math.floor((Date.now() - entry.lastAccessed) / 1000),
                ttl: Math.floor((entry.expiresAt - Date.now()) / 1000)
            };
        }
        return metadata;
    }
    /**
     * Evict least recently used entry
     */
    async evictLRU() {
        let oldestKey = '';
        let oldestTime = Infinity;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;
            logger.debug('CACHE_DO_EVICT', { key: oldestKey, reason: 'LRU' });
        }
    }
    /**
     * Update statistics in persistent storage
     */
    async updateStats() {
        await this.state.storage.put('stats', this.stats);
    }
    /**
     * Persist cache to storage (DO storage + KV for redundancy)
     * Writes to both DO's built-in storage and main KV namespace
     * This ensures cache survives DO restarts AND is shared across workers
     */
    async persistToStorage() {
        try {
            const entries = Array.from(this.cache.entries());
            const data = { entries };
            // Persist to DO storage (for DO instance recovery)
            await this.state.storage.put('cache', data);
            await this.updateStats();
            // Also persist to KV namespace (for sharing across workers)
            if (this.env.CACHE_DO_KV) {
                await this.env.CACHE_DO_KV.put('do_cache_entries', JSON.stringify(data));
                await this.env.CACHE_DO_KV.put('do_cache_stats', JSON.stringify(this.stats));
                logger.debug('CACHE_DO_PERSIST', { synced_entries: entries.length });
            }
        }
        catch (error) {
            logger.error('CACHE_DO_PERSIST_ERROR', { error: error instanceof Error ? error.message : 'Failed to persist cache' });
        }
    }
    /**
     * Schedule cleanup alarm
     */
    async scheduleCleanup() {
        try {
            await this.state.storage.setAlarm(Date.now() + 300000);
            this.cleanupScheduled = true;
        }
        catch (error) {
            logger.error('CACHE_DO_ALARM_ERROR', { error: error instanceof Error ? error.message : 'Failed to schedule cleanup' });
        }
    }
    // Alarm handler invoked by the platform
    async alarm() {
        try {
            await this.cleanupExpired();
            await this.scheduleCleanup();
        }
        catch (error) {
            logger.error('CACHE_DO_ALARM_HANDLER_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    /**
     * Clean up expired entries
     */
    async cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            await this.persistToStorage();
            logger.info('CACHE_DO_CLEANUP', { cleaned });
        }
    }
}
//# sourceMappingURL=cache-durable-object.js.map