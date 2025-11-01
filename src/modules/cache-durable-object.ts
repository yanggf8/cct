// Durable Object Cache - Persistent In-Memory Cache with KV Backup
// Uses DO's persistent memory + KV namespace for maximum durability
// Survives worker restarts, provides <1ms latency, shared across workers

import { DurableObject } from 'cloudflare:workers';
import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('cache-durable-object');

/**
 * Cache entry with metadata
 */
interface CacheEntry<T = any> {
  value: T;
  expiresAt: number; // Timestamp when entry expires
  lastAccessed: number; // For LRU eviction
  cachedAt: string; // ISO timestamp when cached (for metadata)
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  oldestEntry?: string; // Key of oldest entry
  newestEntry?: string; // Key of newest entry
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
export class CacheDurableObject extends DurableObject {
  private cache: Map<string, CacheEntry>;
  private maxSize: number = 1000; // Max entries
  private stats: CacheStats;
  private cleanupScheduled: boolean = false;

  constructor(state: DurableObjectState, env: CloudflareEnvironment) {
    super(state, env);
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

  private env: CloudflareEnvironment;

  /**
   * Initialize from persistent storage (cold start)
   * Tries KV first (shared across workers), then falls back to DO storage
   */
  private async initializeFromStorage(): Promise<void> {
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
          logger.info('CACHE_DO_INIT', `Loaded ${this.cache.size} entries from KV (shared)`);
        }
      }

      // If KV empty, try DO storage
      if (this.cache.size === 0) {
        const stored = await this.storage.get<any>('cache');
        if (stored) {
          this.cache = new Map(stored.entries || []);
          const storedStats = await this.storage.get<CacheStats>('stats');
          if (storedStats) {
            this.stats = storedStats;
          }
          logger.info('CACHE_DO_INIT', `Loaded ${this.cache.size} entries from DO storage`);
        }
      }

      // Schedule cleanup alarm if not already scheduled
      if (!this.cleanupScheduled) {
        await this.scheduleCleanup();
      }
    } catch (error) {
      logger.error('CACHE_DO_INIT_ERROR', 'Failed to initialize from storage', error);
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<any | null> {
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
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    const now = Date.now();
    const expiresAt = now + (ttlSeconds * 1000);

    const entry: CacheEntry = {
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
  async delete(key: string): Promise<boolean> {
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
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = {
      size: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0
    };
    await this.storage.deleteAll();

    // Also clear KV namespace
    if (this.env.CACHE_DO_KV) {
      await this.env.CACHE_DO_KV.delete('do_cache_entries');
      await this.env.CACHE_DO_KV.delete('do_cache_stats');
    }

    logger.info('CACHE_DO_CLEAR', 'Cache cleared from DO storage + KV');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
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
  async getCacheMetadata(): Promise<{ [key: string]: any }> {
    const metadata: { [key: string]: any } = {};

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
  private async evictLRU(): Promise<void> {
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
  private async updateStats(): Promise<void> {
    await this.storage.put('stats', this.stats);
  }

  /**
   * Persist cache to storage (DO storage + KV for redundancy)
   * Writes to both DO's built-in storage and main KV namespace
   * This ensures cache survives DO restarts AND is shared across workers
   */
  private async persistToStorage(): Promise<void> {
    try {
      const entries = Array.from(this.cache.entries());
      const data = { entries };

      // Persist to DO storage (for DO instance recovery)
      await this.storage.put('cache', data);
      await this.updateStats();

      // Also persist to KV namespace (for sharing across workers)
      if (this.env.CACHE_DO_KV) {
        await this.env.CACHE_DO_KV.put('do_cache_entries', JSON.stringify(data));
        await this.env.CACHE_DO_KV.put('do_cache_stats', JSON.stringify(this.stats));
        logger.debug('CACHE_DO_PERSIST', `Synced ${entries.length} entries to KV`);
      }
    } catch (error) {
      logger.error('CACHE_DO_PERSIST_ERROR', 'Failed to persist cache', error);
    }
  }

  /**
   * Schedule cleanup alarm
   */
  private async scheduleCleanup(): Promise<void> {
    try {
      await this.storage.setAlarm(Date.now() + 300000, async () => {
        await this.cleanupExpired();
        // Schedule next cleanup
        await this.scheduleCleanup();
      });
      this.cleanupScheduled = true;
    } catch (error) {
      logger.error('CACHE_DO_ALARM_ERROR', 'Failed to schedule cleanup', error);
    }
  }

  /**
   * Clean up expired entries
   */
  private async cleanupExpired(): Promise<void> {
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
      logger.info('CACHE_DO_CLEANUP', `Cleaned ${cleaned} expired entries`);
    }
  }
}