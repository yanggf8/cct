/**
 * Market Drivers Cache Manager
 *
 * Implements L1 (in-memory) + L2 (KV) caching for Market Drivers data
 * following the same architecture as Sector Cache Manager.
 *
 * Features:
 * - L1 Memory Cache (5 min TTL)
 * - L2 KV Cache (10 min TTL)
 * - Circuit breaker protection
 * - Cache hit rate tracking
 * - Data validation
 *
 * @author Market Drivers Pipeline - Phase 2
 * @since 2025-10-10
 */

import { createLogger } from './logging.js';
import { createDAL } from './dal.js';
import { KeyHelpers } from './kv-key-factory.js';
import { CircuitBreakerFactory } from './circuit-breaker.js';
import type { MarketDriversSnapshot, MacroDrivers, MarketStructure, GeopoliticalRisk, MarketRegime } from './market-drivers.js';

const logger = createLogger('market-drivers-cache-manager');

/**
 * Cache Entry with TTL support
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  source: 'L1' | 'L2' | 'fresh';
}

/**
 * Cache Statistics
 */
interface CacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  l1Size: number;
  l2HitRate: number;
  l1HitRate: number;
  overallHitRate: number;
  memoryUsage: number;
}

/**
 * Market Drivers Cache Manager
 */
export class MarketDriversCacheManager {
  private dal;
  private circuitBreaker;

  // L1 Memory Cache
  private l1Cache = new Map<string, CacheEntry<any>>();
  private readonly L1_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly L2_TTL = 10 * 60 * 1000; // 10 minutes

  // Cache Statistics
  private stats: CacheStats = {
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0,
    l1Size: 0,
    l2HitRate: 0,
    l1HitRate: 0,
    overallHitRate: 0,
    memoryUsage: 0,
  };

  constructor(env: any) {
    this.dal = createDAL(env);
    this.circuitBreaker = CircuitBreakerFactory.getInstance('market-drivers-cache');

    // Cleanup expired entries every 2 minutes
    setInterval(() => this.cleanupExpiredL1Entries(), 2 * 60 * 1000);
  }

  /**
   * Get Market Drivers snapshot from cache
   */
  async getMarketDriversSnapshot(date?: Date | string): Promise<MarketDriversSnapshot | null> {
    const cacheKey = date
      ? KeyHelpers.getMarketDriversSnapshotKey(date)
      : KeyHelpers.getMarketDriversSnapshotKey();

    // Try L1 cache first
    const l1Result = this.getFromL1<MarketDriversSnapshot>(cacheKey);
    if (l1Result) {
      this.stats.l1Hits++;
      logger.debug('Market Drivers snapshot L1 cache hit', { date, source: 'L1' });
      return l1Result;
    }
    this.stats.l1Misses++;

    // Try L2 cache (KV)
    try {
      const l2Result = await this.getFromL2<MarketDriversSnapshot>(cacheKey);
      if (l2Result) {
        this.stats.l2Hits++;
        // Store in L1 for faster future access
        this.setToL1(cacheKey, l2Result);
        logger.debug('Market Drivers snapshot L2 cache hit', { date, source: 'L2' });
        return l2Result;
      }
      this.stats.l2Misses++;
    } catch (error: unknown) {
      logger.error('L2 cache read error for Market Drivers snapshot:', { error: error instanceof Error ? error.message : String(error) });
      this.stats.l2Misses++;
    }

    logger.debug('Market Drivers snapshot cache miss', { date });
    return null;
  }

  /**
   * Store Market Drivers snapshot in cache
   */
  async setMarketDriversSnapshot(data: MarketDriversSnapshot, date?: Date | string): Promise<void> {
    const cacheKey = date
      ? KeyHelpers.getMarketDriversSnapshotKey(date)
      : KeyHelpers.getMarketDriversSnapshotKey();

    // Store in L1 cache
    this.setToL1(cacheKey, { ...data, source: 'fresh' as const });

    // Store in L2 cache (KV) with circuit breaker protection
    try {
      await this.circuitBreaker.execute(async () => {
        const result = await this.dal.write(cacheKey, data, {
          expirationTtl: this.L2_TTL / 1000,
        });

        if (!result.success) {
          throw new Error(`Failed to write to L2 cache: ${result.error}`);
        }

        logger.debug('Market Drivers snapshot stored in L2 cache', {
          date,
          cacheKey,
          source: 'L2'
        });

        return result;
      });
    } catch (error: unknown) {
      logger.error('Failed to store Market Drivers snapshot in L2 cache:', { error: error instanceof Error ? error.message : String(error) });
      // Continue even if L2 cache fails - L1 cache is still available
    }
  }

  /**
   * Get Macro Drivers data from cache
   */
  async getMacroDrivers(date?: Date | string): Promise<MacroDrivers | null> {
    const cacheKey = date
      ? KeyHelpers.getMarketDriversMacroKey(date)
      : KeyHelpers.getMarketDriversMacroKey();

    // Try L1 cache first
    const l1Result = this.getFromL1<MacroDrivers>(cacheKey);
    if (l1Result) {
      this.stats.l1Hits++;
      logger.debug('Macro Drivers L1 cache hit', { date });
      return l1Result;
    }
    this.stats.l1Misses++;

    // Try L2 cache
    try {
      const l2Result = await this.getFromL2<MacroDrivers>(cacheKey);
      if (l2Result) {
        this.stats.l2Hits++;
        this.setToL1(cacheKey, l2Result);
        logger.debug('Macro Drivers L2 cache hit', { date });
        return l2Result;
      }
      this.stats.l2Misses++;
    } catch (error: unknown) {
      logger.error('L2 cache read error for Macro Drivers:', { error: error instanceof Error ? error.message : String(error) });
      this.stats.l2Misses++;
    }

    return null;
  }

  /**
   * Store Macro Drivers data in cache
   */
  async setMacroDrivers(data: MacroDrivers, date?: Date | string): Promise<void> {
    const cacheKey = date
      ? KeyHelpers.getMarketDriversMacroKey(date)
      : KeyHelpers.getMarketDriversMacroKey();

    this.setToL1(cacheKey, data);

    try {
      await this.circuitBreaker.execute(async () => {
        const result = await this.dal.write(cacheKey, data, {
          expirationTtl: this.L2_TTL / 1000,
        });

        if (!result.success) {
          throw new Error(`Failed to write to L2 cache: ${result.error}`);
        }

        return result;
      });
    } catch (error: unknown) {
      logger.error('Failed to store Macro Drivers in L2 cache:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Get Market Structure data from cache
   */
  async getMarketStructure(date?: Date | string): Promise<MarketStructure | null> {
    const cacheKey = date
      ? KeyHelpers.getMarketDriversMarketStructureKey(date)
      : KeyHelpers.getMarketDriversMarketStructureKey();

    const l1Result = this.getFromL1<MarketStructure>(cacheKey);
    if (l1Result) {
      this.stats.l1Hits++;
      return l1Result;
    }
    this.stats.l1Misses++;

    try {
      const l2Result = await this.getFromL2<MarketStructure>(cacheKey);
      if (l2Result) {
        this.stats.l2Hits++;
        this.setToL1(cacheKey, l2Result);
        return l2Result;
      }
      this.stats.l2Misses++;
    } catch (error: unknown) {
      logger.error('L2 cache read error for Market Structure:', { error: error instanceof Error ? error.message : String(error) });
      this.stats.l2Misses++;
    }

    return null;
  }

  /**
   * Store Market Structure data in cache
   */
  async setMarketStructure(data: MarketStructure, date?: Date | string): Promise<void> {
    const cacheKey = date
      ? KeyHelpers.getMarketDriversMarketStructureKey(date)
      : KeyHelpers.getMarketDriversMarketStructureKey();

    this.setToL1(cacheKey, data);

    try {
      await this.circuitBreaker.execute(async () => {
        const result = await this.dal.write(cacheKey, data, {
          expirationTtl: this.L2_TTL / 1000,
        });

        if (!result.success) {
          throw new Error(`Failed to write to L2 cache: ${result.error}`);
        }

        return result;
      });
    } catch (error: unknown) {
      logger.error('Failed to store Market Structure in L2 cache:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Get Geopolitical Risk data from cache
   */
  async getGeopoliticalRisk(date?: Date | string): Promise<GeopoliticalRisk | null> {
    const cacheKey = date
      ? KeyHelpers.getMarketDriversGeopoliticalKey(date)
      : KeyHelpers.getMarketDriversGeopoliticalKey();

    const l1Result = this.getFromL1<GeopoliticalRisk>(cacheKey);
    if (l1Result) {
      this.stats.l1Hits++;
      return l1Result;
    }
    this.stats.l1Misses++;

    try {
      const l2Result = await this.getFromL2<GeopoliticalRisk>(cacheKey);
      if (l2Result) {
        this.stats.l2Hits++;
        this.setToL1(cacheKey, l2Result);
        return l2Result;
      }
      this.stats.l2Misses++;
    } catch (error: unknown) {
      logger.error('L2 cache read error for Geopolitical Risk:', { error: error instanceof Error ? error.message : String(error) });
      this.stats.l2Misses++;
    }

    return null;
  }

  /**
   * Store Geopolitical Risk data in cache
   */
  async setGeopoliticalRisk(data: GeopoliticalRisk, date?: Date | string): Promise<void> {
    const cacheKey = date
      ? KeyHelpers.getMarketDriversGeopoliticalKey(date)
      : KeyHelpers.getMarketDriversGeopoliticalKey();

    this.setToL1(cacheKey, data);

    try {
      await this.circuitBreaker.execute(async () => {
        const result = await this.dal.write(cacheKey, data, {
          expirationTtl: this.L2_TTL / 1000,
        });

        if (!result.success) {
          throw new Error(`Failed to write to L2 cache: ${result.error}`);
        }

        return result;
      });
    } catch (error: unknown) {
      logger.error('Failed to store Geopolitical Risk in L2 cache:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Validate Market Drivers data
   */
  validateMarketDriversData(data: MarketDriversSnapshot): boolean {
    try {
      // Check basic structure
      if (!data.timestamp || !data.date) {
        logger.warn('Market Drivers data missing timestamp or date');
        return false;
      }

      // Validate macro data
      if (!data.macro || typeof data.macro.fedFundsRate !== 'number') {
        logger.warn('Market Drivers data has invalid macro structure');
        return false;
      }

      // Validate market structure
      if (!data.marketStructure || typeof data.marketStructure.vix !== 'number') {
        logger.warn('Market Drivers data has invalid market structure');
        return false;
      }

      // Validate geopolitical data
      if (!data.geopolitical || typeof data.geopolitical.overallRiskScore !== 'number') {
        logger.warn('Market Drivers data has invalid geopolitical data');
        return false;
      }

      // Validate regime data
      if (!data.regime || !data.regime.currentRegime) {
        logger.warn('Market Drivers data has invalid regime information');
        return false;
      }

      // Check for reasonable values
      if (data.marketStructure.vix < 0 || data.marketStructure.vix > 100) {
        logger.warn('Market Drivers VIX value out of reasonable range', { vix: data.marketStructure.vix });
        return false;
      }

      if (data.macro.fedFundsRate < 0 || data.macro.fedFundsRate > 30) {
        logger.warn('Market Drivers Fed Funds Rate out of reasonable range', {
          fedFundsRate: data.macro.fedFundsRate
        });
        return false;
      }

      return true;
    } catch (error: unknown) {
      logger.error('Error validating Market Drivers data:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Clear all caches (L1 and L2 for specific date)
   */
  async clearCache(date?: Date | string): Promise<void> {
    // Clear L1 cache
    const pattern = date
      ? `market_drivers_${typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0]}`
      : 'market_drivers_';

    for (const key of this.l1Cache.keys()) {
      if (key.startsWith(pattern)) {
        this.l1Cache.delete(key);
      }
    }

    // Clear L2 cache
    if (date) {
      const keys = [
        KeyHelpers.getMarketDriversSnapshotKey(date),
        KeyHelpers.getMarketDriversMacroKey(date),
        KeyHelpers.getMarketDriversMarketStructureKey(date),
        KeyHelpers.getMarketDriversGeopoliticalKey(date),
        KeyHelpers.getMarketDriversRegimeKey(date),
        KeyHelpers.getMarketDriversRiskAssessmentKey(date),
      ];

      for (const key of keys) {
        try {
          await this.dal.deleteKey(key);
        } catch (error: unknown) {
          logger.error(`Failed to delete L2 cache key ${key}:`, { error: error instanceof Error ? error.message : String(error) });
        }
      }
    }

    logger.info('Market Drivers cache cleared', { date });
  }

  /**
   * L1 Cache operations
   */
  private getFromL1<T>(key: string): T | null {
    const entry = this.l1Cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.l1Cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setToL1<T>(key: string, data: T): void {
    this.l1Cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.L1_TTL,
      source: 'L1',
    });
  }

  private async getFromL2<T>(key: string): Promise<T | null> {
    const result = await this.dal.read<T>(key);
    return result.success ? result.data : null;
  }

  /**
   * Clean up expired L1 entries
   */
  private cleanupExpiredL1Entries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.l1Cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.l1Cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired L1 cache entries`);
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    const totalRequests = this.stats.l1Hits + this.stats.l1Misses;
    const l2Requests = this.stats.l2Hits + this.stats.l2Misses;

    this.stats.l1HitRate = totalRequests > 0 ? (this.stats.l1Hits / totalRequests) : 0;
    this.stats.l2HitRate = l2Requests > 0 ? (this.stats.l2Hits / l2Requests) : 0;
    this.stats.overallHitRate = totalRequests > 0 ? ((this.stats.l1Hits + this.stats.l2Hits) / totalRequests) : 0;
    this.stats.l1Size = this.l1Cache.size;
    this.stats.memoryUsage = this.estimateMemoryUsage();
  }

  /**
   * Estimate memory usage of L1 cache
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    for (const [key, entry] of this.l1Cache.entries()) {
      // Rough estimation: key + data + overhead
      totalSize += key.length * 2 + JSON.stringify(entry.data).length * 2 + 200;
    }
    return totalSize;
  }
}

/**
 * Initialize Market Drivers Cache Manager
 */
export function initializeMarketDriversCacheManager(env: any): MarketDriversCacheManager {
  return new MarketDriversCacheManager(env);
}

export default MarketDriversCacheManager;