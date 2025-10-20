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
 * Enhanced HashCache configuration
 */
export interface EnhancedHashCacheConfig {
  maxSize: number; // Max number of entries (default: 1000)
  maxMemoryMB: number; // Max memory in MB (default: 10)
  defaultTTL: number; // Default TTL in seconds (default: 900 - 15 min)
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

  constructor(config?: Partial<EnhancedHashCacheConfig>) {
    this.config = {
      maxSize: config?.maxSize || 1000,
      maxMemoryMB: config?.maxMemoryMB || 10,
      defaultTTL: config?.defaultTTL || 900, // 15 minutes
      cleanupInterval: config?.cleanupInterval || 60, // 1 minute
      enableStats: config?.enableStats !== false,
    };

    this.cache = new Map();
    this.enabled = true;
    this.lastCleanup = Date.now();

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
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.updateStats();
      this.recordMiss();
      logger.debug(`Cache entry expired: ${key}`);
      return null;
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
    if (Date.now() > entry.expiresAt) {
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

    for (const [key, entry] of this.cache.entries()) {
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

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
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
    for (const [key, entry] of this.cache.entries()) {
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

    for (const entry of this.cache.values()) {
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