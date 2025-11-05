// @ts-ignore - Suppressing TypeScript errors

/**
 * Durable Objects Cache Adapter
 * Replaces legacy CacheManager with DO-based implementation
 * Provides backward compatibility while eliminating KV operations
 */

import { DualCacheDO, type DualCacheConfig } from './dual-cache-do.js';
import { createLogger } from './logging.js';
import type { CacheNamespace, CacheLevelConfig } from './cache-manager.js';

// Type definitions for compatibility
export interface SectorData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  timestamp: string;
}

const logger = createLogger('do-cache-adapter');

/**
 * DO Cache Adapter - Drop-in replacement for CacheManager
 * Maintains API compatibility while using DO cache internally
 */
export class DOCacheAdapter {
  private doCache: DualCacheDO | null = null;
  private enabled: boolean = false;

  constructor(env: any, options?: { enabled?: boolean }) {
    if (options?.enabled !== false && env?.CACHE_DO) {
      this.doCache = new DualCacheDO(env.CACHE_DO);
      this.enabled = true;
      logger.info('DO_CACHE_ADAPTER: Initialized with Durable Objects cache');
    } else {
      this.enabled = false;
      logger.info('DO_CACHE_ADAPTER: Cache disabled (DO binding not available)');
    }
  }

  /**
   * Get value from cache with namespace support
   */
  async get<T>(namespace: string, key: string, ttl?: number): Promise<T | null> {
    if (!this.doCache) return null;

    const config: DualCacheConfig = {
      ttl: ttl || 3600,
      namespace,
      staleWhileRevalidate: 600
    };

    return (this as any).doCacheget<T>(key, config);
  }

  /**
   * Set value in cache with namespace support
   */
  async set<T>(namespace: string, key: string, value: T, ttl?: number): Promise<void> {
    if (!this.doCache) return;

    const config: DualCacheConfig = {
      ttl: ttl || 3600,
      namespace,
      staleWhileRevalidate: 600
    };

    return (this as any).doCache.set(key, value, config);
  }

  /**
   * Get with stale-while-revalidate support
   */
  async getWithStaleRevalidate<T>(
    namespace: string,
    key: string,
    revalidateFn?: () => Promise<T | null>,
    ttl?: number
  ): Promise<{ data: T | null; isStale: boolean; metadata?: any }> {
    if (!this.doCache) {
      return { data: null, isStale: false };
    }

    const config: DualCacheConfig = {
      ttl: ttl || 3600,
      namespace,
      staleWhileRevalidate: 600
    };

    const result = await (this as any).doCache.getWithStaleRevalidate(key,  config, revalidateFn);
    return {
      data: (result as any).data,
      isStale: (result as any).isStale,
      metadata: (result as any).metadata
    };
  }

  /**
   * Delete key from cache
   */
  async delete(namespace: string, key: string): Promise<void> {
    if (!this.doCache) return;

    const config: DualCacheConfig = {
      ttl: 3600,
      namespace
    };

    return (this as any).doCache.delete(key,  config);
  }

  /**
   * Clear namespace or entire cache
   */
  async clear(namespace?: string): Promise<void> {
    if (!this.doCache) return;

    if (namespace) {
      // Clear specific namespace - would need DO implementation
      logger.info(`DO_CACHE_ADAPTER: Clearing namespace: ${namespace}`);
      // For now, just log - full implementation would require DO method
    } else {
      return (this as any).doCache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    if (!this.doCache) {
      return {
        enabled: false,
        totalEntries: 0,
        memoryUsage: 0,
        hitRate: 0
      };
    }

    const stats = await (this as any).doCache.getStats();
    return {
      enabled: true,
      totalEntries: stats?.totalEntries || 0,
      memoryUsage: stats?.memoryUsage || 0,
      hitRate: stats?.hitRate || 0,
      architecture: 'Durable Objects'
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.doCache) return false;
    return (this as any).doCache.healthCheck();
  }

  /**
   * Get health assessment (compatibility with enhanced cache routes)
   */
  async performHealthAssessment(): Promise<any> {
    if (!this.doCache) {
      return {
        status: 'disabled',
        overallScore: 0,
        issues: ['DO cache not available'],
        recommendations: ['Configure CACHE_DO binding in wrangler.toml'],
        timestamp: new Date().toISOString()
      };
    }

    return (this as any).doCache.performHealthAssessment();
  }

  /**
   * Check if cache is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.doCache !== null;
  }

  /**
   * Get configuration summary
   */
  getConfigurationSummary(): any {
    if (!this.doCache) {
      return {
        enabled: false,
        architecture: 'disabled',
        reason: 'DO cache not available'
      };
    }

    return (this as any).doCache.getConfigurationSummary();
  }

  /**
   * Compatibility methods for existing cache manager API
   */

  // L1 cache compatibility
  getL1Stats(): any {
    return this.doCache?.getL1Stats() || { enabled: false };
  }

  getL1DetailedInfo(): any {
    return this.doCache?.getL1DetailedInfo() || { enabled: false };
  }

  // L2 cache compatibility (always disabled for DO)
  getL2Stats(): any {
    return { enabled: false, message: 'L2 KV cache disabled (DO-only architecture)' };
  }

  // Promotion compatibility (not applicable for DO)
  getPromotionStats(): any {
    return this.doCache?.getPromotionStats() || { enabled: false };
  }

  isPromotionEnabled(): boolean {
    return false; // No promotion in DO-only architecture
  }

  // Performance and access patterns
  getPerformanceTrends(): any {
    return this.doCache?.getPerformanceTrends() || [];
  }

  getAccessPatterns(): any {
    return this.doCache?.getAccessPatterns() || [];
  }

  // System status
  async getSystemStatus(): Promise<any> {
    if (!this.doCache) {
      return {
        status: 'disabled',
        enabled: false,
        architecture: 'none',
        reason: 'DO cache not available'
      };
    }

    return (this as any).doCache.getSystemStatus();
  }

  // Timestamp info
  getTimestampInfo(namespace: string, key: string): any {
    return this.doCache?.getTimestampInfo(namespace,  key) || null;
  }

  // Deduplication (not implemented in DO cache yet)
  getDeduplicationStats(): any {
    return this.doCache?.getDeduplicationStats() || { enabled: false };
  }

  getDeduplicationCacheInfo(): any {
    return this.doCache?.getDeduplicationCacheInfo() || {};
  }

  getDeduplicationPendingRequests(): any {
    return this.doCache?.getDeduplicationPendingRequests() || [];
  }

  // Enhanced configurations
  getAllEnhancedConfigs(): any {
    return this.doCache?.getAllEnhancedConfigs() || { namespaces: [] };
  }

  // Namespace-specific methods
  async setWithNamespace(namespace: string, key: string, value: any, ttl?: number): Promise<void> {
    return this.set(namespace,  key, value, ttl);
  }

  async getWithNamespace(namespace: string, key: string): Promise<any> {
    return this.get(namespace, key);
  }

  // Force refresh (background refresh)
  async forceRefresh(namespace: string, key: string): Promise<void> {
    // For DO cache, we can trigger a delete to force refresh on next access
    await this.delete(namespace,  key);
    logger.info(`DO_CACHE_ADAPTER: Forced refresh for ${namespace}:${key}`);
  }
}

/**
 * Factory function to create DO cache adapter
 * Drop-in replacement for createCacheManager
 */
export function createDOCacheAdapter(
  env: any,
  options?: { enabled?: boolean }
): DOCacheAdapter {
  return new DOCacheAdapter(env,  options);
}

/**
 * Sector-specific DO cache adapter
 * Replaces SectorCacheManager
 */
export class DOSectorCacheAdapter extends DOCacheAdapter {
  constructor(env: any) {
    super(env,  { enabled: true });
  }

  /**
   * Get sector data with typed interface
   */
  async getSectorData(symbol: string): Promise<any> {
    return this.get('sector_data', symbol, 1800 /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */); // 30 minutes TTL
  }

  /**
   * Set sector data with typed interface
   */
  async setSectorData(symbol: string, data: any): Promise<void> {
    return this.set('sector_data', symbol, data, 1800);
  }

  /**
   * Get sector snapshot
   */
  async getSectorSnapshot(): Promise<any> {
    return this.get('sector_data', 'snapshot', 900 /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */); // 15 minutes TTL
  }

  /**
   * Set sector snapshot
   */
  async setSectorSnapshot(data: any): Promise<void> {
    return this.set('sector_data', 'snapshot', data, 900);
  }
}

/**
 * Market drivers specific DO cache adapter
 * Replaces MarketDriversCacheManager
 */
export class DOMarketDriversCacheAdapter extends DOCacheAdapter {
  constructor(env: any) {
    super(env,  { enabled: true });
  }

  /**
   * Get market drivers data
   */
  async getMarketDrivers(): Promise<any> {
    return this.get('market_drivers', 'current', 3600 /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */); // 1 hour TTL
  }

  /**
   * Set market drivers data
   */
  async setMarketDrivers(data: any): Promise<void> {
    return this.set('market_drivers', 'current', data, 3600);
  }

  /**
   * Get FRED data
   */
  async getFredData(indicator: string): Promise<any> {
    return this.get('fred_data', indicator, 86400 /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */); // 24 hours TTL
  }

  /**
   * Set FRED data
   */
  async setFredData(indicator: string, data: any): Promise<void> {
    return this.set('fred_data', indicator, data, 86400);
  }
}

/**
 * Backtesting specific DO cache adapter
 * Replaces BacktestingCacheManager
 */
export class DOBacktestingCacheAdapter extends DOCacheAdapter {
  constructor(env: any) {
    super(env,  { enabled: true });
  }

  /**
   * Get backtest results
   */
  async getBacktestResults(strategyId: string): Promise<any> {
    return this.get('backtesting', strategyId, 7200 /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */); // 2 hours TTL
  }

  /**
   * Set backtest results
   */
  async setBacktestResults(strategyId: string, results: any): Promise<void> {
    return this.set('backtesting', strategyId, results, 7200);
  }

  /**
   * Get historical data
   */
  async getHistoricalData(symbol: string, period: string): Promise<any> {
    return this.get('historical_data', `${symbol}_${period}`, 86400 /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */); // 24 hours TTL
  }

  /**
   * Set historical data
   */
  async setHistoricalData(symbol: string, period: string, data: any): Promise<void> {
    return this.set('historical_data', `${symbol}_${period}`, data, 86400);
  }
}

export default DOCacheAdapter;
