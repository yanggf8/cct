/**
 * D1 Cold Storage Module - Option D Implementation
 *
 * Provides persistent cold storage implementation with analytics rollups.
 * Integrates with existing D1Adapter for cold storage operations.
 *
 * @version 1.0.0 - D1 Cold Storage Implementation
 * @since 2025-11-28
 */

import { createLogger } from './logging.js';
import type { CloudflareEnvironment, D1Database } from '../types.js';

const logger = createLogger('d1-storage');

// ============================================================================
// Schema Definition
// ============================================================================

export interface ColdStorageRecord {
  key: string;
  value: string;
  timestamp: string;
  ttl?: number; // seconds
  checksum?: string;
  storage_class: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
  created_at: string;
  updated_at: string;
}

export interface CacheRollupRecord {
  day: string;
  keyspace: string;
  storage_class: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
  hits: number;
  misses: number;
  p50_latency: number;
  p99_latency: number;
  errors: number;
  egress_bytes: number;
  compute_ms: number;
  total_operations: number;
  created_at: string;
}

export interface RollupMetrics {
  hits: number;
  misses: number;
  errors: number;
  totalOperations: number;
  latencies: number[];
  egressBytes: number;
  computeMs: number;
}

// ============================================================================
// D1 Cold Storage Class
// ============================================================================

export class D1ColdStorage {
  private db: D1Database;
  private initialized: boolean = false;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Initialize D1 schema with idempotent CREATE TABLE statements
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    if (this.initialized) {
      return { success: true };
    }

    try {
      logger.info('Initializing D1 cold storage schema');

      // Create cold_storage table
      const createColdStorage = `
        CREATE TABLE IF NOT EXISTS cold_storage (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          ttl INT,
          checksum TEXT,
          storage_class TEXT NOT NULL CHECK (storage_class IN ('hot_cache', 'warm_cache', 'cold_storage', 'ephemeral')),
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await this.db.exec(createColdStorage);

      // Create indexes for performance
      const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_cold_storage_class ON cold_storage(storage_class)',
        'CREATE INDEX IF NOT EXISTS idx_cold_storage_timestamp ON cold_storage(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_cold_storage_ttl ON cold_storage(ttl)',
        'CREATE INDEX IF NOT EXISTS idx_cold_storage_created_at ON cold_storage(created_at)'
      ];

      for (const indexSql of createIndexes) {
        await this.db.exec(indexSql);
      }

      // Create cache_rollups table
      const createRollups = `
        CREATE TABLE IF NOT EXISTS cache_rollups (
          day DATE PRIMARY KEY,
          keyspace TEXT NOT NULL,
          storage_class TEXT NOT NULL CHECK (storage_class IN ('hot_cache', 'warm_cache', 'cold_storage', 'ephemeral')),
          hits INTEGER DEFAULT 0,
          misses INTEGER DEFAULT 0,
          p50_latency REAL DEFAULT 0.0,
          p99_latency REAL DEFAULT 0.0,
          errors INTEGER DEFAULT 0,
          egress_bytes BIGINT DEFAULT 0,
          compute_ms INTEGER DEFAULT 0,
          total_operations INTEGER DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await this.db.exec(createRollups);

      // Create rollup indexes
      const createRollupIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_cache_rollups_day_keyspace ON cache_rollups(day, keyspace)',
        'CREATE INDEX IF NOT EXISTS idx_cache_rollups_day_storage_class ON cache_rollups(day, storage_class)',
        'CREATE INDEX IF NOT EXISTS idx_cache_rollups_keyspace ON cache_rollups(keyspace)'
      ];

      for (const indexSql of createRollupIndexes) {
        await this.db.exec(indexSql);
      }

      this.initialized = true;
      logger.info('D1 cold storage schema initialized successfully');

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize D1 cold storage schema', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Store data in cold storage with TTL support
   */
  async put(
    key: string,
    value: string,
    storageClass: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral',
    options?: { ttl?: number; checksum?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return initResult;
        }
      }

      const checksum = options?.checksum || this.calculateChecksum(value);
      const now = new Date().toISOString();

      const upsertSql = `
        INSERT OR REPLACE INTO cold_storage (
          key, value, timestamp, ttl, checksum, storage_class, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.prepare(upsertSql).bind(
        key,
        value,
        now,
        options?.ttl || null,
        checksum,
        storageClass,
        now,
        now
      ).run();

      logger.debug('Cold storage put successful', {
        key,
        storageClass,
        ttl: options?.ttl
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Cold storage put failed', { key, storageClass, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Retrieve data from cold storage with TTL checking
   */
  async get(key: string): Promise<{ success: boolean; data?: ColdStorageRecord; error?: string }> {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return initResult;
        }
      }

      const selectSql = `
        SELECT key, value, timestamp, ttl, checksum, storage_class, created_at, updated_at
        FROM cold_storage
        WHERE key = ?
      `;

      const result = await this.db.prepare(selectSql).bind(key).first();

      if (!result) {
        return { success: false, error: 'Key not found' };
      }

      // Check TTL expiration
      if (result.ttl) {
        const createdAt = new Date(result.created_at).getTime();
        const expiryTime = createdAt + (result.ttl * 1000);
        const now = Date.now();

        if (now > expiryTime) {
          // Record expired entry and delete it
          await this.pruneExpiredKey(key);
          return { success: false, error: 'Key expired' };
        }
      }

      // Verify checksum if present
      if (result.checksum) {
        const currentChecksum = this.calculateChecksum(result.value);
        if (currentChecksum !== result.checksum) {
          logger.warn('Checksum mismatch detected', { key, expected: result.checksum, actual: currentChecksum });
          return { success: false, error: 'Checksum validation failed' };
        }
      }

      const record: ColdStorageRecord = {
        key: result.key,
        value: result.value,
        timestamp: result.timestamp,
        ttl: result.ttl,
        checksum: result.checksum,
        storage_class: result.storage_class as any,
        created_at: result.created_at,
        updated_at: result.updated_at
      };

      logger.debug('Cold storage get successful', {
        key,
        storageClass: record.storage_class,
        hasTtl: !!record.ttl
      });

      return { success: true, data: record };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Cold storage get failed', { key, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delete data from cold storage
   */
  async delete(key: string): Promise<{ success: boolean; error?: string; deleted?: boolean }> {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return initResult;
        }
      }

      const deleteSql = `DELETE FROM cold_storage WHERE key = ?`;
      const result = await this.db.prepare(deleteSql).bind(key).run();

      const deleted = result.changes > 0;

      logger.debug('Cold storage delete result', {
        key,
        deleted,
        changes: result.changes
      });

      return { success: true, deleted };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Cold storage delete failed', { key, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * List keys in cold storage with optional filtering
   */
  async list(options?: {
    prefix?: string;
    storageClass?: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
    limit?: number;
  }): Promise<{ success: boolean; keys?: string[]; error?: string }> {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return initResult;
        }
      }

      let listSql = `SELECT key FROM cold_storage`;
      const params: any[] = [];

      const conditions: string[] = [];

      if (options?.prefix) {
        conditions.push('key LIKE ?');
        params.push(`${options.prefix}%`);
      }

      if (options?.storageClass) {
        conditions.push('storage_class = ?');
        params.push(options.storageClass);
      }

      if (conditions.length > 0) {
        listSql += ' WHERE ' + conditions.join(' AND ');
      }

      if (options?.limit) {
        listSql += ' LIMIT ?';
        params.push(options.limit);
      }

      const result = await this.db.prepare(listSql).bind(...params).all();
      const keys = result.map((row: any) => row.key);

      logger.debug('Cold storage list result', {
        options,
        count: keys.length
      });

      return { success: true, keys };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Cold storage list failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Upsert daily rollup metrics
   */
  async upsertRollup(
    day: string,
    keyspace: string,
    storageClass: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral',
    metrics: RollupMetrics
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return initResult;
        }
      }

      // Calculate percentiles
      const sortedLatencies = [...metrics.latencies].sort((a, b) => a - b);
      const p50Index = Math.floor(sortedLatencies.length * 0.5);
      const p99Index = Math.floor(sortedLatencies.length * 0.99);
      const p50Latency = sortedLatencies[p50Index] || 0;
      const p99Latency = sortedLatencies[p99Index] || 0;

      const upsertSql = `
        INSERT OR REPLACE INTO cache_rollups (
          day, keyspace, storage_class, hits, misses, p50_latency, p99_latency,
          errors, egress_bytes, compute_ms, total_operations, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.prepare(upsertSql).bind(
        day,
        keyspace,
        storageClass,
        metrics.hits,
        metrics.misses,
        p50Latency,
        p99Latency,
        metrics.errors,
        metrics.egressBytes,
        metrics.computeMs,
        metrics.totalOperations,
        new Date().toISOString()
      ).run();

      logger.debug('Rollup upsert successful', {
        day,
        keyspace,
        storageClass,
        hits: metrics.hits,
        misses: metrics.misses,
        totalOps: metrics.totalOperations
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Rollup upsert failed', {
        day,
        keyspace,
        storageClass,
        error: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get rollup data for a specific day or date range
   */
  async getRollups(
    day?: string,
    keyspace?: string,
    storageClass?: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral'
  ): Promise<{ success: boolean; rollups?: CacheRollupRecord[]; error?: string }> {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return initResult;
        }
      }

      let querySql = `
        SELECT day, keyspace, storage_class, hits, misses, p50_latency, p99_latency,
               errors, egress_bytes, compute_ms, total_operations, created_at
        FROM cache_rollups
      `;

      const params: any[] = [];
      const conditions: string[] = [];

      if (day) {
        conditions.push('day = ?');
        params.push(day);
      }

      if (keyspace) {
        conditions.push('keyspace = ?');
        params.push(keyspace);
      }

      if (storageClass) {
        conditions.push('storage_class = ?');
        params.push(storageClass);
      }

      if (conditions.length > 0) {
        querySql += ' WHERE ' + conditions.join(' AND ');
      }

      querySql += ' ORDER BY day DESC, keyspace, storage_class';

      const result = await this.db.prepare(querySql).bind(...params).all();
      const rollups = result.map((row: any): CacheRollupRecord => ({
        day: row.day,
        keyspace: row.keyspace,
        storage_class: row.storage_class as any,
        hits: row.hits,
        misses: row.misses,
        p50_latency: row.p50_latency,
        p99_latency: row.p99_latency,
        errors: row.errors,
        egress_bytes: row.egress_bytes,
        compute_ms: row.compute_ms,
        total_operations: row.total_operations,
        created_at: row.created_at
      }));

      return { success: true, rollups };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Get rollups failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Prune expired keys from cold storage
   */
  async pruneExpired(): Promise<{ success: boolean; pruned?: number; error?: string }> {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return initResult;
        }
      }

      const pruneSql = `
        DELETE FROM cold_storage
        WHERE ttl IS NOT NULL AND
              (julianday('now') - julianday(created_at)) * 86400 > ttl
      `;

      const result = await this.db.exec(pruneSql);
      const pruned = result.changes || 0;

      if (pruned > 0) {
        logger.info('Pruned expired cold storage entries', { pruned });
      }

      return { success: true, pruned };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Prune expired entries failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get cold storage statistics
   */
  async getStats(): Promise<{
    success: boolean;
    totalEntries?: number;
    entriesByClass?: Record<string, number>;
    error?: string;
  }> {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return initResult;
        }
      }

      // Get total entries
      const totalResult = await this.db.prepare('SELECT COUNT(*) as count FROM cold_storage').first();
      const totalEntries = totalResult?.count || 0;

      // Get entries by storage class
      const classResult = await this.db.prepare(`
        SELECT storage_class, COUNT(*) as count
        FROM cold_storage
        GROUP BY storage_class
      `).all();

      const entriesByClass = classResult.reduce((acc: Record<string, number>, row: any) => {
        acc[row.storage_class] = row.count;
        return acc;
      }, {});

      return { success: true, totalEntries, entriesByClass };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Get stats failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Prune a specific expired key
   */
  private async pruneExpiredKey(key: string): Promise<void> {
    try {
      const deleteSql = 'DELETE FROM cold_storage WHERE key = ?';
      await this.db.prepare(deleteSql).bind(key).run();
    } catch (error) {
      logger.warn('Failed to prune expired key', { key, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Calculate simple checksum for value integrity
   */
  private calculateChecksum(value: string): string {
    // Simple hash function for demonstration
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char) & 0xffffffff;
    }
    return hash.toString(16);
  }

  /**
   * Check if database is healthy and accessible
   */
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Test basic query
      await this.db.prepare('SELECT 1').first();

      // Check if tables exist
      const tableCheck = await this.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name IN ('cold_storage', 'cache_rollups')
      `).all();

      if (tableCheck.length !== 2) {
        issues.push(`Missing tables: ${2 - tableCheck.length}/2`);
      }

      return { healthy: issues.length === 0, issues };
    } catch (error) {
      issues.push(`Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { healthy: false, issues };
    }
  }
}

/**
 * Create D1 cold storage instance
 */
export function createD1ColdStorage(db: D1Database): D1ColdStorage {
  return new D1ColdStorage(db);
}

/**
 * Default D1 cold storage instance
 */
export const defaultD1ColdStorage = createD1ColdStorage(null as any);