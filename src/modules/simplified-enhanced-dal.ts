/**
 * Simplified Enhanced Data Access Layer (DAL) - Phase 4 Implementation
 * Data Access Improvement Plan - DAC-Inspired Architecture
 *
 * Simplified implementation following DAC patterns:
 * - Direct namespace-based operations
 * - Integrated cache management (no wrapper complexity)
 * - Clean, simple interface
 * - Production-ready error handling
 */

import { KVKeyFactory, KeyTypes, KeyHelpers } from './kv-key-factory.js';
import { createLogger } from './logging.js';
import { EnhancedCacheFactory } from './enhanced-cache-factory.js';
import type { CloudflareEnvironment } from '../types.js';
import type {
  AnalysisData,
  TradingSignal,
  HighConfidenceSignalsData,
  SignalTrackingRecord,
  MarketPriceData,
  DailyReport,
  KVWriteOptions,
  KVReadResult,
  KVWriteResult
} from './dal.js';
import { TTL_CONFIG } from './dal.js';

const logger = createLogger('simplified-dal');

/**
 * Simplified DAL Configuration
 */
export interface SimplifiedDALConfig {
  enableCache: boolean;
  environment: string;
  defaultTTL?: number;
  maxRetries?: number;
}

/**
 * Cache-aware result with metadata
 */
export interface CacheAwareResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached: boolean;
  cacheSource?: 'l1' | 'l2' | 'kv';
  responseTime: number;
  timestamp: string;
}

/**
 * Simplified Enhanced DAL - DAC Pattern Implementation
 *
 * Key principles:
 * 1. Direct namespace operations (no complex abstraction)
 * 2. Built-in cache management
 * 3. Simple, consistent interface
 * 4. Production-ready with comprehensive error handling
 */
export class SimplifiedEnhancedDAL {
  private env: CloudflareEnvironment;
  private config: SimplifiedDALConfig;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private optimizedCacheManager: any;

  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    operations: 0,
    totalResponseTime: 0
  };

  constructor(env: CloudflareEnvironment, config: SimplifiedDALConfig) {
    this.env = env;
    this.config = {
      enableCache: config.enableCache,
      environment: config.environment,
      defaultTTL: config.defaultTTL || 3600, // 1 hour default
      maxRetries: config.maxRetries || 3
    };

    this.cache = new Map();

    // Initialize enhanced optimized cache manager for maximum KV efficiency
    try {
      this.optimizedCacheManager = EnhancedCacheFactory.createOptimizedCacheManager(env, {
        enableKeyAliasing: true,
        enableBatchOperations: true,
        enableMemoryStaticData: true,
        enablePredictivePrefetching: true,
        enableVectorizedProcessing: true,
        enableMonitoring: true
      });
      logger.info('Enhanced Optimized Cache Manager initialized for SimplifiedEnhancedDAL');
    } catch (error: unknown) {
      logger.warn('Failed to initialize optimized cache manager, falling back to basic cache:', error);
      this.optimizedCacheManager = null;
    }

    logger.info('Simplified Enhanced DAL initialized', {
      cacheEnabled: this.config.enableCache,
      environment: this.config.environment,
      defaultTTL: this.config.defaultTTL,
      hasOptimizedCache: !!this.optimizedCacheManager
    });
  }

  /**
   * Measure operation performance
   */
  private async measureOperation<T>(operation: () => Promise<T>): Promise<{ result: T; time: number }> {
    const start = Date.now();
    const result = await operation();
    const time = Date.now() - start;

    this.stats.operations++;
    this.stats.totalResponseTime += time;

    return { result, time };
  }

  /**
   * Check cache with TTL validation
   */
  private checkCache<T>(key: string): { data: T; source: 'l1' } | null {
    if (!this.config.enableCache) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    this.stats.hits++;
    return { data: entry.data, source: 'l1' };
  }

  /**
   * Store in cache with TTL
   */
  private setCache<T>(key: string, data: T, ttl: number = this.config.defaultTTL): void {
    if (!this.config.enableCache) return;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Cleanup old entries if cache gets too large
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());

    for (const [key, entry] of entries) {
      const age = now - entry.timestamp;
      if (age > entry.ttl * 1000) {
        this.cache.delete(key);
      }
    }

    // If still too large, remove oldest entries
    if (this.cache.size > 500) {
      const sorted = entries.sort((a: any, b: any) => a[1].timestamp - b[1].timestamp);
      const toRemove = sorted.slice(0, this.cache.size - 500);

      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Retry helper with exponential backoff
   */
  private async retry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    const maxRetries = this.config.maxRetries || 3;
    const baseDelay = 1000;
    const maxDelay = 10000;

    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        if (attempt < maxRetries - 1) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          logger.warn(`${context} failed, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries,
            error: error.message
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error(`${context} failed after ${maxRetries} attempts`, {
      error: lastError?.message
    });

    throw lastError;
  }

  /**
   * Generic KV get operation with cache
   */
  private async get<T>(key: string, ttl?: number): Promise<CacheAwareResult<T>> {
    const { result, time } = await this.measureOperation(async () => {
      // Try optimized cache manager first (with predictive pre-fetching)
      if (this.optimizedCacheManager && this.config.enableCache) {
        try {
          const optimizedResult = await (this.optimizedCacheManager.read as any)(key, {
            useAliasing: true,
            useMemoryStatic: true,
            usePredictive: true,
            useBatching: true,
            priority: 'high'
          });

          if (optimizedResult.success && optimizedResult.data !== null) {
            this.stats.hits++;
            return {
              success: true,
              data: optimizedResult.data,
              cached: true,
              cacheSource: (optimizedResult.optimizations.includes('Memory-Only Static Data Hit') ? 'kv' :
                         optimizedResult.optimizations.includes('Predictive Pre-fetch Hit') ? 'l1' : 'l2') as 'kv' | 'l1' | 'l2',
              error: undefined
            };
          }
        } catch (error: unknown) {
          logger.warn('Optimized cache manager read failed, falling back to standard cache:', error);
        }
      }

      // Check basic cache first
      const cached = this.checkCache<T>(key);
      if (cached) {
        return {
          success: true,
          data: cached.data,
          cached: true,
          cacheSource: cached.source,
          error: undefined
        };
      }

      this.stats.misses++;

      // Fetch from KV
      try {
        const data = await this.retry(
          () => this.env.TRADING_RESULTS.get(key, 'json'),
          `KV get ${key}`
        );

        if (data !== null && data !== undefined) {
          // Cache the result
          this.setCache(key, data, ttl);

          return {
            success: true,
            data: data as T,
            cached: false,
            cacheSource: 'kv',
            error: undefined
          };
        }

        return {
          success: false,
          cached: false,
          error: 'Data not found'
        };

      } catch (error: any) {
        return {
          success: false,
          cached: false,
          error: (error instanceof Error ? error.message : String(error))
        };
      }
    });

    return {
      ...result,
      responseTime: time,
      timestamp: new Date().toISOString()
    } as CacheAwareResult<T>;
  }

  /**
   * Generic KV put operation with cache invalidation
   */
  private async put<T>(
    key: string,
    data: T,
    options?: KVWriteOptions
  ): Promise<CacheAwareResult<void>> {
    const { result, time } = await this.measureOperation(async () => {
      try {
        const writeOptions = options || { expirationTtl: this.config.defaultTTL };

        // Try optimized cache manager first for write operations
        if (this.optimizedCacheManager && this.config.enableCache) {
          try {
            const optimizedResult = await (this.optimizedCacheManager.write as any)(key, data, {
              useAliasing: true,
              useBatching: true,
              priority: 'medium'
            });

            if (optimizedResult.success) {
              // Invalidate basic cache entry
              this.cache.delete(key);

              return {
                success: true,
                cached: true,
                error: undefined
              };
            }
          } catch (error: unknown) {
            logger.warn('Optimized cache manager write failed, falling back to standard KV:', error);
          }
        }

        // Fallback to standard KV write
        await this.retry(
          () => this.env.TRADING_RESULTS.put(key, JSON.stringify(data), writeOptions),
          `KV put ${key}`
        );

        // Invalidate cache entry
        this.cache.delete(key);

        return {
          success: true,
          cached: false,
          error: undefined
        };

      } catch (error: any) {
        return {
          success: false,
          cached: false,
          error: (error instanceof Error ? error.message : String(error))
        };
      }
    });

    return {
      ...result,
      responseTime: time,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generic KV delete operation
   */
  private async delete(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.retry(
        () => this.env.TRADING_RESULTS.delete(key),
        `KV delete ${key}`
      );

      // Remove from cache
      this.cache.delete(key);

      return { success: true };

    } catch (error: any) {
      logger.error('Delete operation failed', { key, error: (error instanceof Error ? error.message : String(error)) });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generic KV list operation
   */
  private async list(prefix: string, limit?: number): Promise<{ keys: string[]; cursor?: string }> {
    try {
      const result = await this.retry(
        () => this.env.TRADING_RESULTS.list({ prefix, limit }),
        `KV list ${prefix}`
      );

      return {
        keys: result.keys.map((k: any) => k.name),
        cursor: result.cursor
      };

    } catch (error: any) {
      logger.error('List operation failed', { prefix, error: (error instanceof Error ? error.message : String(error)) });
      return { keys: [] };
    }
  }

  // ============================================================================
  // ANALYSIS OPERATIONS
  // ============================================================================

  /**
   * Get analysis data for date
   */
  async getAnalysis(date: string): Promise<CacheAwareResult<AnalysisData>> {
    const key = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date });
    const ttl = KeyHelpers.getKVOptions(KeyTypes.ANALYSIS).expirationTtl;

    logger.debug('Getting analysis data', { key, date });
    return await this.get<AnalysisData>(key, ttl);
  }

  /**
   * Store analysis data
   */
  async storeAnalysis(
    date: string,
    data: AnalysisData,
    options?: KVWriteOptions
  ): Promise<CacheAwareResult<void>> {
    const key = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date });
    const kvOptions = options || KeyHelpers.getKVOptions(KeyTypes.ANALYSIS);

    logger.info('Storing analysis data', {
      key,
      date,
      symbolsCount: data.symbols_analyzed?.length || 0
    });

    return await this.put(key, data, kvOptions);
  }

  /**
   * Get manual analysis
   */
  async getManualAnalysis(timestamp: number): Promise<CacheAwareResult<AnalysisData>> {
    const key = KVKeyFactory.generateKey(KeyTypes.MANUAL_ANALYSIS, { timestamp });
    const ttl = KeyHelpers.getKVOptions(KeyTypes.MANUAL_ANALYSIS).expirationTtl;

    return await this.get<AnalysisData>(key, ttl);
  }

  /**
   * Store manual analysis
   */
  async storeManualAnalysis(
    timestamp: number,
    data: AnalysisData
  ): Promise<CacheAwareResult<void>> {
    const key = KVKeyFactory.generateKey(KeyTypes.MANUAL_ANALYSIS, { timestamp });
    const options = KeyHelpers.getKVOptions(KeyTypes.MANUAL_ANALYSIS);

    const enhancedData = {
      ...data,
      analysis_type: 'manual_on_demand',
      generated_at: new Date().toISOString()
    };

    return await this.put(key, enhancedData, options);
  }

  // ============================================================================
  // SIGNAL TRACKING OPERATIONS
  // ============================================================================

  /**
   * Get high-confidence signals
   */
  async getHighConfidenceSignals(
    date: Date | string
  ): Promise<CacheAwareResult<HighConfidenceSignalsData>> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const key = `high_confidence_signals_${dateStr}`;

    return await this.get<HighConfidenceSignalsData>(key, TTL_CONFIG.SIGNAL_DATA);
  }

  /**
   * Store high-confidence signals
   */
  async storeHighConfidenceSignals(
    date: Date | string,
    signals: any[]
  ): Promise<CacheAwareResult<void>> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const key = `high_confidence_signals_${dateStr}`;

    const signalsData: HighConfidenceSignalsData = {
      date: dateStr,
      signals,
      metadata: {
        totalSignals: signals.length,
        highConfidenceSignals: signals.filter((s: any) => s.confidence >= 80).length,
        averageConfidence: signals.reduce((sum: number, s: any) => sum + s.confidence, 0) / signals.length,
        bullishSignals: signals.filter((s: any) => s.prediction === 'up').length,
        bearishSignals: signals.filter((s: any) => s.prediction === 'down').length,
        neutralSignals: signals.filter((s: any) => s.prediction === 'neutral').length,
        generatedAt: new Date().toISOString(),
        symbols: signals.map((s: any) => s.symbol)
      }
    };

    logger.info('Storing high-confidence signals', {
      date: dateStr,
      signalCount: signals.length,
      highConfidenceCount: signalsData.metadata.highConfidenceSignals
    });

    return await this.put(key, signalsData, { expirationTtl: TTL_CONFIG.SIGNAL_DATA });
  }

  /**
   * Get signal tracking data
   */
  async getSignalTracking(
    date: Date | string
  ): Promise<CacheAwareResult<SignalTrackingRecord>> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const key = `signal_tracking_${dateStr}`;

    return await this.get<SignalTrackingRecord>(key, TTL_CONFIG.SIGNAL_DATA);
  }

  /**
   * Update signal tracking
   */
  async updateSignalTracking(
    signalId: string,
    trackingData: any,
    date: Date | string
  ): Promise<CacheAwareResult<void>> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const key = `signal_tracking_${dateStr}`;

    // Get existing data
    const existing = await this.getSignalTracking(date);

    let trackingRecord: SignalTrackingRecord;
    if (existing.success && existing.data) {
      trackingRecord = existing.data;
    } else {
      trackingRecord = {
        date: dateStr,
        signals: [],
        lastUpdated: new Date().toISOString()
      };
    }

    // Update signal
    const signalIndex = trackingRecord.signals.findIndex(s => s.id === signalId);
    if (signalIndex >= 0) {
      trackingRecord.signals[signalIndex] = {
        ...trackingRecord.signals[signalIndex],
        ...trackingData,
        lastUpdated: new Date().toISOString()
      };
    } else {
      trackingRecord.signals.push({
        id: signalId,
        ...trackingData,
        createdAt: new Date().toISOString()
      });
    }

    trackingRecord.lastUpdated = new Date().toISOString();

    return await this.put(key, trackingRecord, { expirationTtl: TTL_CONFIG.SIGNAL_DATA });
  }

  // ============================================================================
  // MARKET DATA OPERATIONS
  // ============================================================================

  /**
   * Get market prices
   */
  async getMarketPrices(symbol: string): Promise<CacheAwareResult<MarketPriceData>> {
    const key = `market_prices_${symbol}`;

    return await this.get<MarketPriceData>(key, TTL_CONFIG.MARKET_PRICES);
  }

  /**
   * Store market prices
   */
  async storeMarketPrices(
    symbol: string,
    priceData: any
  ): Promise<CacheAwareResult<void>> {
    const key = `market_prices_${symbol}`;

    const marketData: MarketPriceData = {
      symbol,
      currentPrice: priceData.currentPrice,
      timestamp: new Date().toISOString(),
      priceHistory: priceData.priceHistory || [],
      volume: priceData.volume,
      change: priceData.change,
      changePercent: priceData.changePercent
    };

    return await this.put(key, marketData, { expirationTtl: TTL_CONFIG.MARKET_PRICES });
  }

  // ============================================================================
  // REPORT OPERATIONS
  // ============================================================================

  /**
   * Get daily report
   */
  async getDailyReport(
    reportType: 'pre-market' | 'intraday' | 'end-of-day',
    date: Date | string
  ): Promise<CacheAwareResult<DailyReport>> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const key = `${reportType}_report_${dateStr}`;

    return await this.get<DailyReport>(key, TTL_CONFIG.DAILY_REPORTS);
  }

  /**
   * Store daily report
   */
  async storeDailyReport(
    reportType: 'pre-market' | 'intraday' | 'end-of-day',
    date: Date | string,
    reportData: any
  ): Promise<CacheAwareResult<void>> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const key = `${reportType}_report_${dateStr}`;

    const enhancedReportData: DailyReport = {
      ...reportData,
      metadata: {
        reportType,
        date: dateStr,
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    };

    return await this.put(key, enhancedReportData, { expirationTtl: TTL_CONFIG.DAILY_REPORTS });
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Generic read operation
   */
  async read<T = any>(key: string): Promise<CacheAwareResult<T>> {
    return await this.get<T>(key);
  }

  /**
   * Generic write operation
   */
  async write(
    key: string,
    data: any,
    options?: KVWriteOptions
  ): Promise<CacheAwareResult<void>> {
    return await this.put(key, data, options);
  }

  /**
   * List keys with prefix
   */
  async listKeys(prefix: string, limit?: number): Promise<{ keys: string[]; cursor?: string }> {
    return await this.list(prefix, limit);
  }

  /**
   * Delete key
   */
  async deleteKey(key: string): Promise<{ success: boolean; error?: string }> {
    return await this.delete(key);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, operations: 0, totalResponseTime: 0 };
    logger.info('Cache cleared');
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    cache: {
      hits: number;
      misses: number;
      hitRate: number;
    };
    performance: {
      totalOperations: number;
      averageResponseTime: number;
      cacheSize: number;
    };
  } {
    const totalCacheRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalCacheRequests > 0 ? this.stats.hits / totalCacheRequests : 0;
    const avgResponseTime = this.stats.operations > 0 ? this.stats.totalResponseTime / this.stats.operations : 0;

    return {
      cache: {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: Math.round(hitRate * 100) / 100
      },
      performance: {
        totalOperations: this.stats.operations,
        averageResponseTime: Math.round(avgResponseTime * 100) / 100,
        cacheSize: this.cache.size
      }
    };
  }
}

/**
 * Factory function
 */
export function createSimplifiedEnhancedDAL(
  env: CloudflareEnvironment,
  config?: Partial<SimplifiedDALConfig>
): SimplifiedEnhancedDAL {
  const defaultConfig: SimplifiedDALConfig = {
    enableCache: true,
    environment: env.ENVIRONMENT || 'development',
    defaultTTL: 3600,
    maxRetries: 3
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new SimplifiedEnhancedDAL(env, finalConfig);
}

export default SimplifiedEnhancedDAL;