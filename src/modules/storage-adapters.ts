/**
 * Storage Adapters Interface and Implementation
 *
 * Provides unified interface for different storage backends:
 * - DO Cache (hot/warm storage)
 * - D1 Database (cold storage)
 * - Memory (ephemeral storage)
 * - KV Fallback (legacy compatibility)
 *
 * @version 2.0.0 - Storage Architecture Modernization
 * @since 2025-11-28
 */

import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('storage-adapters');

// ============================================================================
// Storage Classes and Configuration
// ============================================================================

export type StorageClass = 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';

export interface StorageOptions {
  ttl?: number; // TTL in seconds
  metadata?: Record<string, any>;
  checksum?: string;
}

export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
  deleted?: boolean;
  metadata?: {
    timestamp: string;
    storageClass: StorageClass;
    backend: string;
    ttl?: number;
    // Extended properties for routing
    adapterErrors?: string[];
    dualMode?: boolean;
    promoted?: boolean;
    demoted?: boolean;
    routedClass?: StorageClass;
    routedAdapter?: string;
    size?: number;
    fallbackWrite?: boolean;
    fallbackDelete?: boolean;
    fromClass?: StorageClass;
    toClass?: StorageClass;
    originalSize?: number;
    compressedSize?: number;
  };
}

export interface StorageStats {
  totalOperations: number;
  hits: number;
  misses: number;
  errors: number;
  avgLatency: number;
  storageUsed: number;
  lastAccess: string;
}

// ============================================================================
// Base Storage Adapter Interface
// ============================================================================

export interface StorageAdapter {
  readonly name: string;
  readonly storageClass: StorageClass;
  readonly enabled: boolean;

  // Core operations
  get(key: string): Promise<StorageResult>;
  put(key: string, value: any, options?: StorageOptions): Promise<StorageResult>;
  delete(key: string): Promise<StorageResult>;
  list(options?: { prefix?: string; limit?: number }): Promise<StorageResult<string[]>>;

  // Metadata and health
  getStats(): Promise<StorageStats>;
  healthCheck(): Promise<{ healthy: boolean; issues: string[] }>;

  // Lifecycle
  close(): Promise<void>;
}

// ============================================================================
// DO Cache Adapter (Hot/Warm Storage)
// ============================================================================

export interface DOAdapterConfig {
  doNamespace: any; // DurableObjectNamespace
  defaultTtl: number;
  maxSize: number;
  evictionPolicy: 'lru' | 'ttl';
}

export class DOAdapter implements StorageAdapter {
  readonly name = 'DOAdapter';
  readonly storageClass: StorageClass;
  readonly enabled: boolean;
  private doCache: any;
  private config: DOAdapterConfig;
  private stats: StorageStats;
  private metricsCollector: any; // Will be injected for metrics

  constructor(storageClass: StorageClass, config: DOAdapterConfig) {
    this.storageClass = storageClass;
    this.enabled = true;
    this.config = config;
    this.stats = {
      totalOperations: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      avgLatency: 0,
      storageUsed: 0,
      lastAccess: new Date().toISOString()
    };
  }

  /**
   * Set metrics collector for instrumentation
   */
  setMetricsCollector(metricsCollector: any): void {
    this.metricsCollector = metricsCollector;
  }

  /**
   * Call DO via fetch (DO stubs only expose fetch, not direct methods)
   */
  private async callDO(stub: any, action: string, body?: any): Promise<any> {
    const response = await stub.fetch(`https://do/${action}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    return response.json();
  }

  async get(key: string): Promise<StorageResult> {
    const startTime = Date.now();
    this.stats.totalOperations++;
    let duration = 0;

    try {
      const doId = this.config.doNamespace.idFromName('cache');
      const stub = this.config.doNamespace.get(doId);

      const result = await this.callDO(stub, 'get', { key });
      const value = result?.value;
      duration = Date.now() - startTime;
      
      if (value !== null && value !== undefined) {
        this.stats.hits++;
      } else {
        this.stats.misses++;
      }

      // Record metrics if collector is available
      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('get', {
          layer: 'do',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(key)
        }, duration, true, value !== null);
      }

      return {
        success: true,
        data: value,
        metadata: {
          timestamp: new Date().toISOString(),
          storageClass: this.storageClass,
          backend: 'durable-object',
          ttl: this.config.defaultTtl
        }
      };
    } catch (error) {
      this.stats.misses++;
      this.stats.errors++;
      duration = Date.now() - startTime;

      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('get', {
          layer: 'do',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(key)
        }, duration, false);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp: new Date().toISOString(),
          storageClass: this.storageClass,
          backend: 'durable-object'
        }
      };
    } finally {
      this.updateLatency(duration);
    }
  }

  async put(key: string, value: any, options?: StorageOptions): Promise<StorageResult> {
    const startTime = Date.now();
    this.stats.totalOperations++;

    try {
      const ttl = options?.ttl || this.config.defaultTtl;
      const doId = this.config.doNamespace.idFromName('cache');
      const stub = this.config.doNamespace.get(doId);

      await this.callDO(stub, 'set', { key, value, ttl });
      const duration = Date.now() - startTime;

      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('put', {
          layer: 'do',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(key)
        }, duration, true);
      }

      return {
        success: true,
        metadata: {
          timestamp: new Date().toISOString(),
          storageClass: this.storageClass,
          backend: 'durable-object',
          ttl
        }
      };
    } catch (error) {
      this.stats.errors++;
      const duration = Date.now() - startTime;

      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('put', {
          layer: 'do',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(key)
        }, duration, false);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp: new Date().toISOString(),
          storageClass: this.storageClass,
          backend: 'durable-object'
        }
      };
    } finally {
      this.updateLatency(Date.now() - startTime);
    }
  }

  async delete(key: string): Promise<StorageResult> {
    const startTime = Date.now();
    this.stats.totalOperations++;

    try {
      const doId = this.config.doNamespace.idFromName('cache');
      const stub = this.config.doNamespace.get(doId);

      await this.callDO(stub, 'delete', { key });
      const duration = Date.now() - startTime;

      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('del', {
          layer: 'do',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(key)
        }, duration, true);
      }

      return {
        success: true,
        metadata: {
          timestamp: new Date().toISOString(),
          storageClass: this.storageClass,
          backend: 'durable-object'
        }
      };
    } catch (error) {
      this.stats.errors++;
      const duration = Date.now() - startTime;

      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('del', {
          layer: 'do',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(key)
        }, duration, false);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp: new Date().toISOString(),
          storageClass: this.storageClass,
          backend: 'durable-object'
        }
      };
    } finally {
      this.updateLatency(Date.now() - startTime);
    }
  }

  async list(options?: { prefix?: string; limit?: number }): Promise<StorageResult<string[]>> {
    const startTime = Date.now();
    this.stats.totalOperations++;

    try {
      const doId = this.config.doNamespace.idFromName('cache');
      const stub = this.config.doNamespace.get(doId);

      // DO doesn't have native list, so we'll need to implement this in the DO itself
      // For now, return empty list
      const keys: string[] = [];
      const duration = Date.now() - startTime;

      // Record metrics if collector is available
      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('list', {
          layer: 'do',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(options?.prefix || '')
        }, duration, true);
      }

      return {
        success: true,
        data: keys,
        metadata: {
          timestamp: new Date().toISOString(),
          storageClass: this.storageClass,
          backend: 'durable-object'
        }
      };
    } catch (error) {
      this.stats.errors++;
      const duration = Date.now() - startTime;

      // Record error metrics if collector is available
      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('list', {
          layer: 'do',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(options?.prefix || '')
        }, duration, false);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          timestamp: new Date().toISOString(),
          storageClass: this.storageClass,
          backend: 'durable-object'
        }
      };
    } finally {
      this.updateLatency(Date.now() - startTime);
    }
  }

  async getStats(): Promise<StorageStats> {
    return { ...this.stats };
  }

  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    if (!this.config.doNamespace) {
      issues.push('DO namespace not available');
    }

    // Test basic operation
    try {
      const testKey = `health_check_${Date.now()}`;
      const result = await this.put(testKey, 'test');
      if (!result.success) {
        issues.push('DO write operation failed');
      }
      await this.delete(testKey);
    } catch (error) {
      issues.push(`DO health check failed: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  async close(): Promise<void> {
    // DO connections don't need explicit closing
    logger.debug('DOAdapter closed');
  }

  private updateLatency(latency: number): void {
    const totalLatency = this.stats.avgLatency * (this.stats.totalOperations - 1) + latency;
    this.stats.avgLatency = totalLatency / this.stats.totalOperations;
    this.stats.lastAccess = new Date().toISOString();
  }

  private extractKeyspace(key: string): string {
    // Extract keyspace from key pattern for metrics
    // Examples:
    // - "analysis_AAPL_2024-01-01" -> "analysis"
    // - "market_cache_QQQ" -> "market_cache"
    // - "job_status_12345" -> "job_status"
    // - "daily_summary_2024-01-01" -> "daily_summary"

    const parts = key.split('_');
    if (parts.length >= 2) {
      return parts.slice(0, 2).join('_');
    } else if (parts.length === 1) {
      return parts[0];
    } else {
      return 'unknown';
    }
  }
}

// ============================================================================
// D1 Database Adapter (Cold Storage)
// ============================================================================

export interface D1AdapterConfig {
  db: any; // D1Database binding
  tableName: string;
}

export class D1Adapter implements StorageAdapter {
  readonly name = 'D1Adapter';
  readonly storageClass = 'cold_storage' as const;
  readonly enabled: boolean;
  private config: D1AdapterConfig;
  private stats: StorageStats;
  private metricsCollector: any; // Will be injected for metrics

  constructor(config: D1AdapterConfig) {
    this.enabled = !!config.db;
    this.config = config;
    this.stats = {
      totalOperations: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      avgLatency: 0,
      storageUsed: 0,
      lastAccess: new Date().toISOString()
    };
  }

  /**
   * Set metrics collector for instrumentation
   */
  setMetricsCollector(metricsCollector: any): void {
    this.metricsCollector = metricsCollector;
  }

  async get(key: string): Promise<StorageResult> {
    const startTime = Date.now();
    this.stats.totalOperations++;

    if (!this.enabled) {
      return {
        success: false,
        error: 'D1 adapter not enabled'
      };
    }

    try {
      const result = await this.config.db
        .prepare(`SELECT value, metadata FROM ${this.config.tableName} WHERE key = ?`)
        .bind(key)
        .first();

      const duration = Date.now() - startTime;

      if (result) {
        this.stats.hits++;

        // Record metrics if collector is available
        if (this.metricsCollector) {
          this.metricsCollector.recordOperation('get', {
            layer: 'kv',
            storage_class: this.storageClass,
            keyspace: this.extractKeyspace(key)
          }, duration, true, true);
        }

        return {
          success: true,
          data: JSON.parse(result.value),
          metadata: JSON.parse(result.metadata)
        };
      } else {
        this.stats.misses++;

        // Record miss metrics if collector is available
        if (this.metricsCollector) {
          this.metricsCollector.recordOperation('get', {
            layer: 'kv',
            storage_class: this.storageClass,
            keyspace: this.extractKeyspace(key)
          }, duration, true, false);
        }

        return {
          success: false,
          error: 'Key not found'
        };
      }
    } catch (error) {
      this.stats.errors++;
      const duration = Date.now() - startTime;

      // Record error metrics if collector is available
      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('get', {
          layer: 'kv',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(key)
        }, duration, false);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.updateLatency(Date.now() - startTime);
    }
  }

  async put(key: string, value: any, options?: StorageOptions): Promise<StorageResult> {
    const startTime = Date.now();
    this.stats.totalOperations++;

    if (!this.enabled) {
      return {
        success: false,
        error: 'D1 adapter not enabled'
      };
    }

    try {
      const metadata = {
        timestamp: new Date().toISOString(),
        storageClass: this.storageClass,
        backend: 'd1-database',
        ttl: options?.ttl,
        checksum: options?.checksum
      };

      await this.config.db
        .prepare(`INSERT OR REPLACE INTO ${this.config.tableName} (key, value, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(key, JSON.stringify(value), JSON.stringify(metadata), new Date().toISOString(), new Date().toISOString())
        .run();

      const duration = Date.now() - startTime;

      // Record metrics if collector is available
      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('put', {
          layer: 'kv',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(key)
        }, duration, true);
      }

      return {
        success: true,
        metadata
      };
    } catch (error) {
      this.stats.errors++;
      const duration = Date.now() - startTime;

      // Record error metrics if collector is available
      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('put', {
          layer: 'kv',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(key)
        }, duration, false);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.updateLatency(Date.now() - startTime);
    }
  }

  async delete(key: string): Promise<StorageResult> {
    const startTime = Date.now();
    this.stats.totalOperations++;

    if (!this.enabled) {
      return {
        success: false,
        error: 'D1 adapter not enabled'
      };
    }

    try {
      const result = await this.config.db
        .prepare(`DELETE FROM ${this.config.tableName} WHERE key = ?`)
        .bind(key)
        .run();

      const duration = Date.now() - startTime;

      // Record metrics if collector is available
      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('del', {
          layer: 'kv',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(key)
        }, duration, true);
      }

      return {
        success: true,
        data: result.changes,
        metadata: {
          timestamp: new Date().toISOString(),
          storageClass: this.storageClass,
          backend: 'd1-database'
        }
      };
    } catch (error) {
      this.stats.errors++;
      const duration = Date.now() - startTime;

      // Record error metrics if collector is available
      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('del', {
          layer: 'kv',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(key)
        }, duration, false);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.updateLatency(Date.now() - startTime);
    }
  }

  async list(options?: { prefix?: string; limit?: number }): Promise<StorageResult<string[]>> {
    const startTime = Date.now();
    this.stats.totalOperations++;

    if (!this.enabled) {
      return {
        success: false,
        error: 'D1 adapter not enabled'
      };
    }

    try {
      let query = `SELECT key FROM ${this.config.tableName}`;
      const params: any[] = [];

      if (options?.prefix) {
        query += ' WHERE key LIKE ?';
        params.push(`${options.prefix}%`);
      }

      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
      }

      const results = await this.config.db.prepare(query).bind(...params).all();
      const keys = results.results.map((row: any) => row.key);
      const duration = Date.now() - startTime;

      // Record metrics if collector is available
      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('list', {
          layer: 'kv',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(options?.prefix || '')
        }, duration, true);
      }

      return {
        success: true,
        data: keys
      };
    } catch (error) {
      this.stats.errors++;
      const duration = Date.now() - startTime;

      // Record error metrics if collector is available
      if (this.metricsCollector) {
        this.metricsCollector.recordOperation('list', {
          layer: 'kv',
          storage_class: this.storageClass,
          keyspace: this.extractKeyspace(options?.prefix || '')
        }, duration, false);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.updateLatency(Date.now() - startTime);
    }
  }

  async getStats(): Promise<StorageStats> {
    return { ...this.stats };
  }

  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    if (!this.enabled) {
      issues.push('D1 adapter not enabled');
      return { healthy: false, issues };
    }

    try {
      // Test basic query
      await this.config.db.prepare('SELECT 1').first();
    } catch (error) {
      issues.push(`D1 health check failed: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  async close(): Promise<void> {
    // D1 connections don't need explicit closing
    logger.debug('D1Adapter closed');
  }

  private updateLatency(latency: number): void {
    const totalLatency = this.stats.avgLatency * (this.stats.totalOperations - 1) + latency;
    this.stats.avgLatency = totalLatency / this.stats.totalOperations;
    this.stats.lastAccess = new Date().toISOString();
  }

  private extractKeyspace(key: string): string {
    // Extract keyspace from key pattern for metrics
    // Examples:
    // - "analysis_AAPL_2024-01-01" -> "analysis"
    // - "market_cache_QQQ" -> "market_cache"
    // - "job_status_12345" -> "job_status"
    // - "daily_summary_2024-01-01" -> "daily_summary"

    const parts = key.split('_');
    if (parts.length >= 2) {
      return parts.slice(0, 2).join('_');
    } else if (parts.length === 1) {
      return parts[0];
    } else {
      return 'unknown';
    }
  }
}

// ============================================================================
// Memory Adapter (Ephemeral Storage)
// ============================================================================

export class MemoryAdapter implements StorageAdapter {
  readonly name = 'MemoryAdapter';
  readonly storageClass = 'ephemeral' as const;
  readonly enabled = true;
  private cache = new Map<string, { value: any; expiry: number; metadata: any }>();
  private stats: StorageStats;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private metricsCollector: any; // Will be injected for metrics

  constructor() {
    this.stats = {
      totalOperations: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      avgLatency: 0,
      storageUsed: 0,
      lastAccess: new Date().toISOString()
    };

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Set metrics collector for instrumentation
   */
  setMetricsCollector(metricsCollector: any): void {
    this.metricsCollector = metricsCollector;
  }

  async get(key: string): Promise<StorageResult> {
    const startTime = Date.now();
    this.stats.totalOperations++;

    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.stats.misses++;
        return {
          success: false,
          error: 'Key not found'
        };
      }

      // Check expiry
      if (entry.expiry < Date.now()) {
        this.cache.delete(key);
        this.stats.misses++;
        return {
          success: false,
          error: 'Key expired'
        };
      }

      this.stats.hits++;
      return {
        success: true,
        data: entry.value,
        metadata: entry.metadata
      };
    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.updateLatency(Date.now() - startTime);
    }
  }

  async put(key: string, value: any, options?: StorageOptions): Promise<StorageResult> {
    const startTime = Date.now();
    this.stats.totalOperations++;

    try {
      const ttl = options?.ttl || 3600; // Default 1 hour
      const metadata = {
        timestamp: new Date().toISOString(),
        storageClass: this.storageClass,
        backend: 'memory',
        ttl
      };

      this.cache.set(key, {
        value,
        expiry: Date.now() + (ttl * 1000),
        metadata
      });

      this.stats.storageUsed = this.cache.size;

      return {
        success: true,
        metadata
      };
    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.updateLatency(Date.now() - startTime);
    }
  }

  async delete(key: string): Promise<StorageResult> {
    const startTime = Date.now();
    this.stats.totalOperations++;

    try {
      const deleted = this.cache.delete(key);
      this.stats.storageUsed = this.cache.size;

      return {
        success: deleted,
        metadata: {
          timestamp: new Date().toISOString(),
          storageClass: this.storageClass,
          backend: 'memory'
        }
      };
    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.updateLatency(Date.now() - startTime);
    }
  }

  async list(options?: { prefix?: string; limit?: number }): Promise<StorageResult<string[]>> {
    const startTime = Date.now();
    this.stats.totalOperations++;

    try {
      let keys = Array.from(this.cache.keys());

      if (options?.prefix) {
        keys = keys.filter(key => key.startsWith(options.prefix));
      }

      if (options?.limit) {
        keys = keys.slice(0, options.limit);
      }

      return {
        success: true,
        data: keys
      };
    } catch (error) {
      this.stats.errors++;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.updateLatency(Date.now() - startTime);
    }
  }

  async getStats(): Promise<StorageStats> {
    return {
      ...this.stats,
      storageUsed: this.cache.size
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    // Memory adapter is always healthy if not exceeding memory limits
    const issues: string[] = [];

    if (this.cache.size > 10000) {
      issues.push('Memory cache size exceeds recommended limit');
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    logger.debug('MemoryAdapter closed');
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.expiry < now) {
        this.cache.delete(key);
      }
    }
    this.stats.storageUsed = this.cache.size;
  }

  private updateLatency(latency: number): void {
    const totalLatency = this.stats.avgLatency * (this.stats.totalOperations - 1) + latency;
    this.stats.avgLatency = totalLatency / this.stats.totalOperations;
    this.stats.lastAccess = new Date().toISOString();
  }

  private extractKeyspace(key: string): string {
    // Extract keyspace from key pattern for metrics
    // Examples:
    // - "analysis_AAPL_2024-01-01" -> "analysis"
    // - "market_cache_QQQ" -> "market_cache"
    // - "job_status_12345" -> "job_status"
    // - "daily_summary_2024-01-01" -> "daily_summary"

    const parts = key.split('_');
    if (parts.length >= 2) {
      return parts.slice(0, 2).join('_');
    } else if (parts.length === 1) {
      return parts[0];
    } else {
      return 'unknown';
    }
  }
}