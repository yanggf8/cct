/**
 * CCT API Cache Manager
 * Intelligent client-side caching system for API responses
 * Phase 3: Frontend API Client - Data Access Improvement Plan
 */

/**
 * Cache Entry Structure
 */
class CacheEntry {
  constructor(data, ttl, metadata = {}) {
    this.data = data;
    this.timestamp = Date.now();
    this.ttl = ttl; // Time to live in milliseconds
    this.metadata = {
      hitCount: 0,
      lastAccessed: Date.now(),
      ...metadata
    };
  }

  isExpired() {
    return Date.now() - this.timestamp > this.ttl;
  }

  get age() {
    return Date.now() - this.timestamp;
  }

  get timeToExpiry() {
    return Math.max(0, this.ttl - this.age);
  }

  touch() {
    this.metadata.lastAccessed = Date.now();
    this.metadata.hitCount++;
  }
}

/**
 * LRU (Least Recently Used) Cache Implementation
 */
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0
    };
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      // Remove least recently used item
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }

    this.cache.set(key, value);
    this.stats.size = this.cache.size;
  }

  get(key) {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    if (this.cache.delete(key)) {
      this.stats.size = this.cache.size;
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.stats.size = 0;
  }

  keys() {
    return this.cache.keys();
  }

  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      occupancy: this.stats.size / this.maxSize
    };
  }
}

/**
 * API Cache Manager
 */
class ApiCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTtl = options.defaultTtl || 300000; // 5 minutes
    this.storagePrefix = options.storagePrefix || 'cct_api_cache_';
    this.persistenceEnabled = options.persistenceEnabled !== false;

    // In-memory LRU cache
    this.lruCache = new LRUCache(this.maxSize);

    // Persistent storage (localStorage)
    this.persistentCache = this.persistenceEnabled ? new PersistentCache(this.storagePrefix) : null;

    // Cache namespaces for different data types
    this.namespaces = {
      sentiment: { ttl: 180000 }, // 3 minutes
      market_data: { ttl: 300000 }, // 5 minutes
      reports: { ttl: 900000 }, // 15 minutes
      sectors: { ttl: 600000 }, // 10 minutes
      market_drivers: { ttl: 1200000 }, // 20 minutes
      system: { ttl: 30000 }, // 30 seconds
      default: { ttl: this.defaultTtl }
    };

    // Statistics
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      staleHits: 0,
      errors: 0,
      startTime: Date.now()
    };

    // Background cleanup
    this.startCleanupTask();
  }

  /**
   * Generate cache key from request parameters
   */
  generateKey(method, url, params = {}) {
    const normalizedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');

    return `${method.toUpperCase()}:${url}:${normalizedParams}`;
  }

  /**
   * Get namespace configuration for a key
   */
  getNamespace(key) {
    if (key.includes('sentiment')) return this.namespaces.sentiment;
    if (key.includes('market') || key.includes('data')) return this.namespaces.market_data;
    if (key.includes('report')) return this.namespaces.reports;
    if (key.includes('sector')) return this.namespaces.sectors;
    if (key.includes('market-drivers')) return this.namespaces.market_drivers;
    if (key.includes('health') || key.includes('system')) return this.namespaces.system;
    return this.namespaces.default;
  }

  /**
   * Get data from cache
   */
  get(key, options = {}) {
    this.stats.totalRequests++;

    try {
      // Try LRU cache first
      const cached = this.lruCache.get(key);

      if (cached && !cached.isExpired()) {
        cached.touch();
        this.stats.cacheHits++;
        return cached.data;
      }

      // Check persistent cache if enabled
      if (this.persistentCache) {
        const persistentData = this.persistentCache.get(key);
        if (persistentData && !persistentData.isExpired()) {
          // Restore to LRU cache
          this.lruCache.set(key, persistentData);
          persistentData.touch();
          this.stats.cacheHits++;
          this.stats.staleHits++; // Hit from persistent storage
          return persistentData.data;
        }
      }

      this.stats.cacheMisses++;
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Set data in cache
   */
  set(key, data, options = {}) {
    try {
      const namespace = this.getNamespace(key);
      const ttl = options.ttl || namespace.ttl || this.defaultTtl;

      const entry = new CacheEntry(data, ttl, {
        ...options.metadata,
        endpoint: key.split(':')[1], // Extract URL from key
        cachedAt: new Date().toISOString()
      });

      // Store in LRU cache
      this.lruCache.set(key, entry);

      // Store in persistent cache if enabled and TTL > 1 minute
      if (this.persistentCache && ttl > 60000) {
        this.persistentCache.set(key, entry);
      }

      return true;

    } catch (error) {
      console.error('Cache set error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete data from cache
   */
  delete(key) {
    try {
      this.lruCache.delete(key);
      if (this.persistentCache) {
        this.persistentCache.delete(key);
      }
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Clear cache by pattern or completely
   */
  clear(pattern = null) {
    try {
      if (!pattern) {
        this.lruCache.clear();
        if (this.persistentCache) {
          this.persistentCache.clear();
        }
      } else {
        // Clear by pattern
        const keysToDelete = [];
        for (const key of this.lruCache.keys()) {
          if (key.includes(pattern)) {
            keysToDelete.push(key);
          }
        }

        keysToDelete.forEach(key => this.delete(key));
      }
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const lruStats = this.lruCache.getStats();
    const uptime = Date.now() - this.stats.startTime;

    return {
      overall: {
        totalRequests: this.stats.totalRequests,
        cacheHits: this.stats.cacheHits,
        cacheMisses: this.stats.cacheMisses,
        hitRate: this.stats.cacheHits / this.stats.totalRequests || 0,
        errorRate: this.stats.errors / this.stats.totalRequests || 0,
        uptimeMs: uptime,
        uptime: this.formatUptime(uptime)
      },
      lruCache: lruStats,
      persistence: {
        enabled: this.persistenceEnabled,
        staleHits: this.stats.staleHits
      },
      namespaces: this.getNamespaceStats()
    };
  }

  /**
   * Get namespace-specific statistics
   */
  getNamespaceStats() {
    const stats = {};

    for (const [name, config] of Object.entries(this.namespaces)) {
      stats[name] = {
        ttl: config.ttl,
        estimatedEntries: this.estimateNamespaceEntries(name)
      };
    }

    return stats;
  }

  /**
   * Estimate entries in a namespace
   */
  estimateNamespaceEntries(namespace) {
    let count = 0;
    for (const key of this.lruCache.keys()) {
      if (key.includes(namespace)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Start background cleanup task
   */
  startCleanupTask() {
    // Run cleanup every 2 minutes
    setInterval(() => {
      this.cleanup();
    }, 120000);
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    try {
      const cleanedCount = { lru: 0, persistent: 0 };

      // Clean LRU cache
      const lruKeysToDelete = [];
      for (const key of this.lruCache.keys()) {
        const entry = this.lruCache.get(key);
        if (entry && entry.isExpired()) {
          lruKeysToDelete.push(key);
        }
      }

      lruKeysToDelete.forEach(key => {
        this.lruCache.delete(key);
        cleanedCount.lru++;
      });

      // Clean persistent cache
      if (this.persistentCache) {
        cleanedCount.persistent = this.persistentCache.cleanup();
      }

      if (cleanedCount.lru > 0 || cleanedCount.persistent > 0) {
        console.log(`Cache cleanup: ${cleanedCount.lru} LRU, ${cleanedCount.persistent} persistent entries removed`);
      }

    } catch (error) {
      console.error('Cache cleanup error:', error);
      this.stats.errors++;
    }
  }

  /**
   * Format uptime for display
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Get cache health status
   */
  getHealthStatus() {
    const stats = this.getStats();
    const lruOccupancy = stats.lruCache.occupancy;

    let status = 'healthy';
    if (lruOccupancy > 0.9) status = 'warning';
    if (lruOccupancy >= 1.0) status = 'critical';
    if (stats.overall.errorRate > 0.1) status = 'degraded';

    return {
      status,
      memoryUsage: `${(lruOccupancy * 100).toFixed(1)}%`,
      totalEntries: stats.lruCache.size,
      maxEntries: this.maxSize,
      hitRate: `${(stats.overall.hitRate * 100).toFixed(1)}%`,
      uptime: stats.overall.uptime
    };
  }

  /**
   * Export cache data for debugging
   */
  exportData() {
    const data = {
      stats: this.getStats(),
      entries: [],
      timestamp: new Date().toISOString()
    };

    // Sample some entries for debugging (limit to 10)
    let sampled = 0;
    for (const key of this.lruCache.keys()) {
      if (sampled >= 10) break;

      const entry = this.lruCache.get(key);
      data.entries.push({
        key: key,
        age: entry.age,
        ttl: entry.ttl,
        expires: entry.timeToExpiry,
        hitCount: entry.metadata.hitCount,
        endpoint: entry.metadata.endpoint
      });

      sampled++;
    }

    return data;
  }
}

/**
 * Persistent Cache using localStorage
 */
class PersistentCache {
  constructor(prefix = 'cache_') {
    this.prefix = prefix;
    this.maxPersistentEntries = 50; // Limit persistent storage
  }

  generateStorageKey(key) {
    // Hash the key to avoid localStorage key length limits
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${this.prefix}${Math.abs(hash)}`;
  }

  get(key) {
    try {
      const storageKey = this.generateStorageKey(key);
      const stored = localStorage.getItem(storageKey);

      if (!stored) return null;

      const data = JSON.parse(stored);

      // Reconstruct CacheEntry
      const entry = new CacheEntry(data.data, data.ttl, data.metadata);
      entry.timestamp = data.timestamp;

      return entry;
    } catch (error) {
      console.error('Persistent cache get error:', error);
      return null;
    }
  }

  set(key, entry) {
    try {
      const storageKey = this.generateStorageKey(key);

      // Don't persist very short-lived entries
      if (entry.ttl < 60000) return false;

      // Check storage limit
      if (this.getStorageUsage() >= this.maxPersistentEntries) {
        this.evictOldest();
      }

      const dataToStore = {
        data: entry.data,
        timestamp: entry.timestamp,
        ttl: entry.ttl,
        metadata: entry.metadata
      };

      localStorage.setItem(storageKey, JSON.stringify(dataToStore));
      return true;
    } catch (error) {
      console.error('Persistent cache set error:', error);
      return false;
    }
  }

  delete(key) {
    try {
      const storageKey = this.generateStorageKey(key);
      localStorage.removeItem(storageKey);
      return true;
    } catch (error) {
      console.error('Persistent cache delete error:', error);
      return false;
    }
  }

  clear() {
    try {
      // Remove all cache entries with our prefix
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Persistent cache clear error:', error);
      return false;
    }
  }

  getStorageUsage() {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        count++;
      }
    }
    return count;
  }

  evictOldest() {
    let oldestKey = null;
    let oldestTimestamp = Infinity;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.timestamp < oldestTimestamp) {
            oldestTimestamp = data.timestamp;
            oldestKey = key;
          }
        } catch (error) {
          // Remove corrupted entries
          localStorage.removeItem(key);
        }
      }
    }

    if (oldestKey) {
      localStorage.removeItem(oldestKey);
    }
  }

  cleanup() {
    let cleaned = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          const entry = new CacheEntry(data.data, data.ttl, data.metadata);
          entry.timestamp = data.timestamp;

          if (entry.isExpired()) {
            localStorage.removeItem(key);
            cleaned++;
            i--; // Adjust index after removal
          }
        } catch (error) {
          localStorage.removeItem(key);
          cleaned++;
          i--;
        }
      }
    }
    return cleaned;
  }
}

// Export for global use
if (typeof window !== 'undefined') {
  window.ApiCache = ApiCache;
  window.CacheEntry = CacheEntry;

  // Create default cache instance
  window.apiCache = new ApiCache({
    maxSize: 100,
    defaultTtl: 300000, // 5 minutes
    persistenceEnabled: true
  });
}