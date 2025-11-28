/**
 * Cache Abstraction Layer V2 - Storage Adapter Integration
 *
 * Provides backward compatibility with existing cache-abstraction.ts
 * while integrating the new StorageAdapter architecture.
 *
 * This module extends (not replaces) the existing cache abstraction,
 * allowing gradual migration to the new storage system.
 *
 * @version 2.0.0 - Storage Architecture Modernization
 * @since 2025-11-28
 */

import { createLogger } from './logging.js';
import { RouterStorageAdapter, createDefaultRouterConfig } from './router-storage-adapter.js';
import { DOAdapter, D1Adapter, MemoryAdapter } from './storage-adapters.js';
import type { StorageAdapter } from './storage-adapters.js';
import type { CloudflareEnvironment } from '../types.js';
import { getStorageAdapterConfig } from './config.js';
import { LegacyCacheAdapter } from './cache-abstraction.js';

const logger = createLogger('cache-abstraction-v2');

// ============================================================================
// Enhanced Cache Abstraction with Storage Adapter Support
// ============================================================================

export interface EnhancedCacheOptions {
  ttl?: number;
  metadata?: Record<string, any>;
  storageClass?: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
  forceLegacy?: boolean; // Force use of legacy KV system
}

export interface EnhancedCacheWriteOptions extends EnhancedCacheOptions {
  expirationTtl?: number;
}

export interface EnhancedCacheListOptions {
  prefix?: string;
  limit?: number;
  storageClass?: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
}

export interface EnhancedCacheListResult {
  keys: Array<{ name: string; expiration?: number; metadata?: any; storageClass?: string }>;
  list_complete: boolean;
  cursor?: string;
  metadata?: {
    totalKeys: number;
    storageClassBreakdown: Record<string, number>;
    adapterSources: string[];
  };
}

export interface EnhancedCacheStats {
  legacy: {
    hits: number;
    misses: number;
    hitRate: number;
    totalRequests: number;
  };
  router: {
    totalOperations: number;
    routerHits: number;
    routerMisses: number;
    hitRate: number;
    classStats: Record<string, { hits: number; errors: number }>;
  };
  adapters: Record<string, any>;
  modes: Record<string, string>;
}

// ============================================================================
// Enhanced Cache Manager
// ============================================================================

export class EnhancedCacheManager {
  private env: CloudflareEnvironment;
  private legacyAdapter: LegacyCacheAdapter;
  private routerAdapter: RouterStorageAdapter | null = null;
  private config: any;
  private enabled: boolean = false;

  constructor(env: CloudflareEnvironment) {
    this.env = env;
    this.legacyAdapter = new LegacyCacheAdapter(env);
    this.config = getStorageAdapterConfig(env);
    this.enabled = this.config.enabled;

    if (this.enabled) {
      this.initializeRouterAdapter();
      logger.info('Enhanced Cache Manager initialized with storage adapters', {
        modes: this.config.modes,
        keyPatternsCount: this.config.keyPatterns.length
      });
    } else {
      logger.info('Enhanced Cache Manager using legacy mode only');
    }
  }

  private async initializeRouterAdapter(): Promise<void> {
    try {
      // Create router configuration
      const routerConfig = createDefaultRouterConfig(this.env);

      // Update modes from config
      routerConfig.modes = this.config.modes;

      // Create adapters based on environment bindings and modes
      routerConfig.adapters = await this.createAdapters();

      // Create router adapter
      this.routerAdapter = new RouterStorageAdapter(routerConfig);

      logger.info('Router adapter initialized', {
        adapters: Object.keys(routerConfig.adapters),
        modes: routerConfig.modes
      });
    } catch (error) {
      logger.error('Failed to initialize router adapter', { error: error instanceof Error ? error.message : String(error) });
      this.enabled = false;
    }
  }

  private async createAdapters(): Promise<any> {
    const adapters: any = {};

    // Hot Cache Adapter (DO)
    if (this.config.modes.hot_cache !== 'disabled' && this.env.CACHE_DO) {
      adapters.hot = new DOAdapter('hot_cache', {
        doNamespace: this.env.CACHE_DO,
        defaultTtl: this.config.ttlPolicies.hot_cache,
        maxSize: 1000,
        evictionPolicy: 'lru'
      });
    }

    // Warm Cache Adapter (DO - can be same or different instance)
    if (this.config.modes.warm_cache !== 'disabled' && this.env.CACHE_DO) {
      adapters.warm = new DOAdapter('warm_cache', {
        doNamespace: this.env.CACHE_DO,
        defaultTtl: this.config.ttlPolicies.warm_cache,
        maxSize: 5000,
        evictionPolicy: 'lru'
      });
    }

    // Cold Storage Adapter (D1)
    if (this.config.modes.cold_storage === 'd1' && this.env.ANALYTICS_DB) {
      adapters.cold = new D1Adapter({
        db: this.env.ANALYTICS_DB,
        tableName: 'cache_storage'
      });
    }

    // Ephemeral Adapter (Memory)
    if (this.config.modes.ephemeral === 'memory') {
      adapters.ephemeral = new MemoryAdapter();
    }

    // Fallback Adapter (Legacy KV)
    if (this.env.MARKET_ANALYSIS_CACHE) {
      adapters.fallback = new LegacyKVAdapter(this.env);
    }

    return adapters;
  }

  // ============================================================================
  // Cache Operations
  // ============================================================================

  async put(key: string, value: any, options?: EnhancedCacheWriteOptions): Promise<void> {
    if (options?.forceLegacy || !this.enabled || !this.routerAdapter) {
      return await this.legacyAdapter.put(key, value, options);
    }

    try {
      // Route through storage adapter
      const storageOptions: any = {
        ttl: options?.ttl || options?.expirationTtl,
        metadata: options?.metadata
      };

      const result = await this.routerAdapter.put(key, value, storageOptions);

      if (!result.success) {
        throw new Error(`Storage adapter put failed: ${result.error}`);
      }

      logger.debug('Enhanced cache PUT successful', {
        key,
        storageClass: result.metadata?.routedClass,
        adapter: result.metadata?.routedAdapter
      });
    } catch (error) {
      logger.warn('Storage adapter PUT failed, falling back to legacy', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to legacy
      return await this.legacyAdapter.put(key, value, options);
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.enabled || !this.routerAdapter) {
      return await this.legacyAdapter.get(key);
    }

    try {
      // Route through storage adapter
      const result = await this.routerAdapter.get(key);

      if (result.success && result.data !== undefined) {
        logger.debug('Enhanced cache GET hit', {
          key,
          storageClass: result.metadata?.routedClass,
          adapter: result.metadata?.routedAdapter
        });
        return result.data;
      } else {
        // Try legacy fallback if configured
        if (this.config.modes.hot_cache === 'dual' || this.config.modes.warm_cache === 'dual') {
          const legacyResult = await this.legacyAdapter.get(key);
          if (legacyResult !== null) {
            logger.debug('Enhanced cache GET hit in legacy fallback', { key });
            return legacyResult;
          }
        }

        return null;
      }
    } catch (error) {
      logger.warn('Storage adapter GET failed, falling back to legacy', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to legacy
      return await this.legacyAdapter.get(key);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.enabled || !this.routerAdapter) {
      return await this.legacyAdapter.delete(key);
    }

    try {
      const result = await this.routerAdapter.delete(key);

      if (!result.success) {
        throw new Error(`Storage adapter delete failed: ${result.error}`);
      }

      logger.debug('Enhanced cache DELETE successful', {
        key,
        storageClass: result.metadata?.routedClass,
        adapter: result.metadata?.routedAdapter
      });
    } catch (error) {
      logger.warn('Storage adapter DELETE failed, falling back to legacy', {
        key,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to legacy
      return await this.legacyAdapter.delete(key);
    }
  }

  async list(options?: EnhancedCacheListOptions): Promise<EnhancedCacheListResult> {
    if (!this.enabled || !this.routerAdapter) {
      // Convert legacy list to enhanced format
      const legacyResult = await this.legacyAdapter.list(options);
      return {
        keys: legacyResult.keys.map(key => ({
          name: key.name,
          expiration: key.expiration,
          metadata: key.metadata,
          storageClass: 'legacy'
        })),
        list_complete: legacyResult.list_complete,
        cursor: legacyResult.cursor,
        metadata: {
          totalKeys: legacyResult.keys.length,
          storageClassBreakdown: { legacy: legacyResult.keys.length },
          adapterSources: ['legacy']
        }
      };
    }

    try {
      const result = await this.routerAdapter.list(options);

      if (!result.success) {
        throw new Error(`Storage adapter list failed: ${result.error}`);
      }

      const enhancedKeys = (result.data || []).map(key => ({
        name: key,
        storageClass: options?.storageClass || 'auto-detected'
      }));

      return {
        keys: enhancedKeys,
        list_complete: true,
        metadata: {
          totalKeys: enhancedKeys.length,
          storageClassBreakdown: this.calculateClassBreakdown(enhancedKeys),
          adapterSources: this.getActiveAdapterSources()
        }
      };
    } catch (error) {
      logger.warn('Storage adapter list failed, falling back to legacy', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to legacy
      return await this.list({ ...options, forceLegacy: true });
    }
  }

  // ============================================================================
  // Health and Statistics
  // ============================================================================

  async getStats(): Promise<EnhancedCacheStats> {
    const legacyStats = await this.legacyAdapter.getStats();
    let routerStats = null;

    if (this.routerAdapter) {
      try {
        routerStats = await this.routerAdapter.getStats();
      } catch (error) {
        logger.warn('Failed to get router stats', { error });
      }
    }

    return {
      legacy: {
        hits: legacyStats.hits || 0,
        misses: legacyStats.misses || 0,
        hitRate: legacyStats.hitRate || 0,
        totalRequests: (legacyStats.hits || 0) + (legacyStats.misses || 0)
      },
      router: routerStats ? {
        totalOperations: routerStats.router?.totalOperations || 0,
        routerHits: routerStats.router?.routerHits || 0,
        routerMisses: routerStats.router?.routerMisses || 0,
        hitRate: routerStats.router?.hitRate || 0,
        classStats: routerStats.classStats || {}
      } : {
        totalOperations: 0,
        routerHits: 0,
        routerMisses: 0,
        hitRate: 0,
        classStats: {}
      },
      adapters: routerStats?.adapters || {},
      modes: this.config.modes
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; issues: string[]; legacy?: any; router?: any }> {
    const issues: string[] = [];
    let legacyHealth = null;
    let routerHealth = null;

    // Check legacy health
    try {
      legacyHealth = await this.legacyAdapter.healthCheck();
      if (!legacyHealth.healthy) {
        issues.push(...legacyHealth.issues.map(issue => `Legacy: ${issue}`));
      }
    } catch (error) {
      issues.push(`Legacy health check failed: ${error}`);
    }

    // Check router health if enabled
    if (this.routerAdapter) {
      try {
        routerHealth = await this.routerAdapter.healthCheck();
        if (!routerHealth.healthy) {
          issues.push(...routerHealth.issues.map(issue => `Router: ${issue}`));
        }
      } catch (error) {
        issues.push(`Router health check failed: ${error}`);
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
      legacy: legacyHealth,
      router: routerHealth
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  isEnabled(): boolean {
    return this.enabled;
  }

  getConfiguration(): any {
    return {
      enabled: this.enabled,
      modes: this.config.modes,
      keyPatterns: this.config.keyPatterns,
      ttlPolicies: this.config.ttlPolicies
    };
  }

  private calculateClassBreakdown(keys: Array<{ storageClass?: string }>): Record<string, number> {
    const breakdown: Record<string, number> = {};

    keys.forEach(key => {
      const storageClass = key.storageClass || 'unknown';
      breakdown[storageClass] = (breakdown[storageClass] || 0) + 1;
    });

    return breakdown;
  }

  private getActiveAdapterSources(): string[] {
    const sources: string[] = [];

    if (this.config.modes.hot_cache !== 'disabled') sources.push('hot_cache');
    if (this.config.modes.warm_cache !== 'disabled') sources.push('warm_cache');
    if (this.config.modes.cold_storage !== 'disabled') sources.push('cold_storage');
    if (this.config.modes.ephemeral !== 'disabled') sources.push('ephemeral');
    sources.push('fallback'); // Always included as fallback

    return sources;
  }

  async close(): Promise<void> {
    await this.legacyAdapter.close();

    if (this.routerAdapter) {
      await this.routerAdapter.close();
    }

    logger.debug('EnhancedCacheManager closed');
  }
}

// ============================================================================
// Legacy KV Adapter (Fallback)
// ============================================================================

class LegacyKVAdapter implements StorageAdapter {
  readonly name = 'LegacyKVAdapter';
  readonly storageClass = 'cold_storage' as const;
  readonly enabled = true;
  private env: CloudflareEnvironment;

  constructor(env: CloudflareEnvironment) {
    this.env = env;
  }

  async get(key: string): Promise<any> {
    return {
      success: true,
      data: await this.env.MARKET_ANALYSIS_CACHE.get(key),
      metadata: {
        timestamp: new Date().toISOString(),
        storageClass: this.storageClass,
        backend: 'legacy-kv'
      }
    };
  }

  async put(key: string, value: any, options?: any): Promise<any> {
    await this.env.MARKET_ANALYSIS_CACHE.put(key, value, options);
    return {
      success: true,
      metadata: {
        timestamp: new Date().toISOString(),
        storageClass: this.storageClass,
        backend: 'legacy-kv'
      }
    };
  }

  async delete(key: string): Promise<any> {
    await this.env.MARKET_ANALYSIS_CACHE.delete(key);
    return {
      success: true,
      metadata: {
        timestamp: new Date().toISOString(),
        storageClass: this.storageClass,
        backend: 'legacy-kv'
      }
    };
  }

  async list(options?: any): Promise<any> {
    const result = await this.env.MARKET_ANALYSIS_CACHE.list(options);
    return {
      success: true,
      data: result.keys.map((key: any) => key.name),
      metadata: {
        timestamp: new Date().toISOString(),
        storageClass: this.storageClass,
        backend: 'legacy-kv'
      }
    };
  }

  async getStats(): Promise<any> {
    return {
      totalOperations: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      avgLatency: 0,
      storageUsed: 0,
      lastAccess: new Date().toISOString()
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    if (!this.env.MARKET_ANALYSIS_CACHE) {
      issues.push('MARKET_ANALYSIS_CACHE binding not available');
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  async close(): Promise<void> {
    // KV doesn't need explicit closing
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createEnhancedCacheManager(env: CloudflareEnvironment): EnhancedCacheManager {
  return new EnhancedCacheManager(env);
}