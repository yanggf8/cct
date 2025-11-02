/**
 * Enhanced HashCache - In-Memory Cache with TTL and LRU Eviction
 * Inspired by DAC implementation with memory-based limits and intelligent management
 * Replaces basic Map-based L1 cache for superior performance
 */

import { createLogger } from './logging.js';

const logger = createLogger('enhanced-hash-cache');

/**
 * Cache entry with comprehensive metadata
 */
export interface EnhancedCacheEntry<T> {
  data: T;
  timestamp: number; // Creation timestamp
  expiresAt: number; // Expiration timestamp
  lastAccessed: number; // For LRU eviction
  hits: number; // Access count for statistics
  size: number; // Estimated size in bytes
  // Timestamp information for L1/L2 cache tracking
  l1Timestamp: number; // L1 cache creation timestamp
  l2Timestamp?: number; // L2 cache creation timestamp (if available)
  cacheSource: 'l1' | 'l2' | 'fresh'; // Source of cache entry
}

/**
 * Enhanced cache statistics with memory tracking
 */
export interface EnhancedCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  currentSize: number; // Number of entries
  currentMemoryMB: number; // Memory usage in MB
  hitRate: number;
  oldestEntry?: number; // Age of oldest entry in seconds
  newestEntry?: number; // Age of newest entry in seconds
}

/**
 * Cache timestamp information for API responses
 */
export interface CacheTimestampInfo {
  l1Timestamp: string; // ISO string of L1 cache time
  l2Timestamp?: string; // ISO string of L2 cache time (if available)
  cacheSource: 'l1' | 'l2' | 'fresh'; // Source of the data
  ageSeconds: number; // Age of the data in seconds
  ttlSeconds: number; // Original TTL
  expiresAt: string; // Expiration time (ISO string)
  isStale: boolean; // Whether data is in grace period
  isWithinGracePeriod: boolean; // Whether data is within grace period
}

/**
 * Enhanced HashCache configuration
 */
export interface EnhancedHashCacheConfig {
  maxSize: number; // Max number of entries (default: 1000)
  maxMemoryMB: number; // Max memory in MB (default: 10)
  defaultTTL: number; // Default TTL in seconds (default: 900 - 15 min)
  staleGracePeriod: number; // Grace period in seconds to serve stale data
  enableStaleWhileRevalidate: boolean; // Enable SWR pattern (default: false)
  cleanupInterval: number; // Cleanup interval in seconds (default: 60)
  enableStats: boolean; // Enable detailed statistics (default: true)
}

/**
 * Enhanced in-memory cache with:
 * - TTL-based expiration
 * - LRU eviction with memory limits
 * - Automatic cleanup
 * - Comprehensive statistics
 * - Memory management
 */
export class EnhancedHashCache<T = any> {
  private cache: Map<string, EnhancedCacheEntry<T>>;
  private config: EnhancedHashCacheConfig;
  private stats: EnhancedCacheStats;
  private lastCleanup: number;
  private enabled: boolean;
  private backgroundRefreshCallbacks: Map<string, () => Promise<T>>;
  private refreshingKeys: Set<string>; // Prevent duplicate refreshes

  constructor(config?: Partial<EnhancedHashCacheConfig>) {
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
  async get(key: string): Promise<T | null> {
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
      } else {
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
  async set(key: string, data: T, ttl?: number): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const effectiveTTL = ttl || this.config.defaultTTL;
    const now = Date.now();
    const expiresAt = now + effectiveTTL * 1000;
    const size = this.estimateSize(data);

    const entry: EnhancedCacheEntry<T> = {
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
  async delete(key: string): Promise<boolean> {
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
  async has(key: string): Promise<boolean> {
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
  async clear(): Promise<void> {
    this.cache.clear();
    this.resetStats();
    logger.info('Cache cleared');
  }

  /**
   * Get current cache size (number of entries)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys (non-expired entries only)
   */
  keys(): string[] {
    const now = Date.now();
    const validKeys: string[] = [];

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
  getStats(): EnhancedCacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get detailed cache information for debugging
   */
  getDetailedInfo(): {
    config: EnhancedHashCacheConfig;
    stats: EnhancedCacheStats;
    entries: Array<{
      key: string;
      age: number; // Age in seconds
      ttl: number; // Remaining TTL in seconds
      hits: number;
      size: number;
    }>;
  } {
    this.updateStats();
    const now = Date.now();

    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key: key.length > 50 ? key.substring(0, 47) + '...' : key, // Truncate long keys
      age: Math.floor((now - entry.timestamp) / 1000),
      ttl: Math.max(0, Math.floor((entry.expiresAt - now) / 1000)),
      hits: entry.hits,
      size: entry.size,
    })).sort((a: any, b: any) => b.age - a.age); // Sort by age (oldest first)

    return {
      config: { ...this.config },
      stats: { ...this.stats },
      entries,
    };
  }

  /**
   * Enable/disable cache
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info(`Cache ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if cache is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Force cleanup of expired entries
   */
  async cleanup(): Promise<number> {
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
  private maybeCleanup(): void {
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
  private async maybeEvict(newEntrySize: number): Promise<void> {
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
  private async evictLRU(): Promise<void> {
    let oldestKey: string | null = null;
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
  private estimateSize(value: T): number {
    try {
      const json = JSON.stringify(value);
      // Rough estimate: 2 bytes per character for UTF-16
      return json.length * 2;
    } catch {
      // Fallback for non-serializable values
      return 1024; // 1KB default
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
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
  private recordHit(): void {
    if (this.config.enableStats) {
      this.stats.hits++;
      this.updateHitRate();
    }
  }

  /**
   * Record cache miss
   */
  private recordMiss(): void {
    if (this.config.enableStats) {
      this.stats.misses++;
      this.updateHitRate();
    }
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    if (this.config.enableStats) {
      const total = this.stats.hits + this.stats.misses;
      this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    }
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
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
  setBackgroundRefreshCallback(keyPattern: string, refreshFn: () => Promise<T>): void {
    this.backgroundRefreshCallbacks.set(keyPattern, refreshFn);
    logger.debug(`Registered background refresh callback for pattern: ${keyPattern}`);
  }

  /**
   * Trigger background refresh for a stale cache entry
   * Non-blocking - serves stale data immediately while refreshing in background
   */
  private async triggerBackgroundRefresh(key: string, entry: EnhancedCacheEntry<T>): Promise<void> {
    // Prevent duplicate refreshes for the same key
    if (this.refreshingKeys.has(key)) {
      logger.debug(`Background refresh already in progress for key: ${key}`);
      return;
    }

    // Find matching refresh callback
    let refreshFn: (() => Promise<T>) | null = null;
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
    refreshFn().then(async (freshData: any) => {
      try {
        // Update cache with fresh data, preserving original TTL
        const originalTTL = Math.round((entry.expiresAt - entry.timestamp) / 1000);
        await this.set(key, freshData, originalTTL);

        logger.info(`Background refresh completed for key: ${key}`, {
          age: Date.now() - entry.timestamp,
          originalTTL
        });
      } catch (error: unknown) {
        logger.error(`Background refresh failed for key: ${key}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        // Remove from refreshing set
        this.refreshingKeys.delete(key);
      }
    }).catch((error: any) => {
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
  setStaleWhileRevalidate(enabled: boolean): void {
    this.config.enableStaleWhileRevalidate = enabled;
    logger.info(`Stale-While-Revalidate ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if Stale-While-Revalidate is enabled
   */
  isStaleWhileRevalidateEnabled(): boolean {
    return this.config.enableStaleWhileRevalidate;
  }

  /**
   * Get timestamp information for a cache entry
   */
  getTimestampInfo(key: string): CacheTimestampInfo | null {
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
  async getWithTimestampInfo<T>(key: string): Promise<{ data: T | null, timestampInfo: CacheTimestampInfo | null }> {
    const data = await this.get<T>(key);
    const timestampInfo = this.getTimestampInfo(key);

    return { data, timestampInfo };
  }
}

/**
 * Factory function to create enhanced hash cache instances
 */
export function createEnhancedHashCache<T = any>(
  config?: Partial<EnhancedHashCacheConfig>
): EnhancedHashCache<T> {
  return new EnhancedHashCache<T>(config);
}

export default EnhancedHashCache;