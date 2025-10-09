/**
 * Enhanced Data Access Layer (DAL) - TypeScript
 * Integration of existing DAL with multi-level cache manager
 * Phase 2: Enhanced Caching System - Data Access Improvement Plan
 *
 * This module wraps the existing DAL to provide intelligent caching
 * while maintaining backward compatibility with existing code.
 */

import { createDAL, DataAccessLayer, type KVReadResult, type KVWriteResult, type AnalysisData, type TradingSignal, type HighConfidenceSignalsData, type SignalTrackingRecord, type MarketPriceData, type DailyReport } from './dal.js';
import { CacheManager, createCacheManager, type CacheStats } from './cache-manager.js';
import { getCacheNamespace, getCacheConfigForEnvironment } from './cache-config.js';
import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('enhanced-dal');

/**
 * Enhanced DAL configuration
 */
export interface EnhancedDALConfig {
  enableCache: boolean;
  environment: string;
  cacheOptions?: {
    l1MaxSize?: number;
    enabled?: boolean;
  };
}

/**
 * Cache-aware read result with additional metadata
 */
export interface EnhancedKVReadResult<T> extends KVReadResult<T> {
  cacheHit: boolean;
  cacheSource: 'l1' | 'l2' | 'none';
  responseTime: number;
}

/**
 * Cache-aware write result with additional metadata
 */
export interface EnhancedKVWriteResult extends KVWriteResult {
  cacheInvalidated: boolean;
  responseTime: number;
}

/**
 * Enhanced Data Access Layer with integrated multi-level caching
 */
export class EnhancedDataAccessLayer {
  private dal: DataAccessLayer;
  private cacheManager: CacheManager;
  private config: EnhancedDALConfig;
  private enabled: boolean;

  constructor(
    env: CloudflareEnvironment,
    config: EnhancedDALConfig
  ) {
    this.dal = createDAL(env);
    this.config = config;

    const cacheConfig = getCacheConfigForEnvironment(config.environment);
    this.cacheManager = createCacheManager(env, {
      l1MaxSize: config.cacheOptions?.l1MaxSize || cacheConfig.defaultL1MaxSize,
      enabled: config.enableCache && cacheConfig.enabled
    });

    this.enabled = config.enableCache && cacheConfig.enabled;

    logger.info('Enhanced DAL initialized', {
      cacheEnabled: this.enabled,
      environment: config.environment,
      cacheNamespaces: this.cacheManager.getHealthStatus().namespaces
    });
  }

  /**
   * Measure operation execution time
   */
  private async measureTime<T>(operation: () => Promise<T>): Promise<{ result: T; time: number }> {
    const start = Date.now();
    const result = await operation();
    const time = Date.now() - start;
    return { result, time };
  }

  /**
   * Generic cached read operation
   */
  private async cachedRead<T>(
    namespace: string,
    key: string,
    fetchFn: () => Promise<KVReadResult<T>>
  ): Promise<EnhancedKVReadResult<T>> {
    if (!this.enabled) {
      const { result, time } = await this.measureTime(fetchFn);
      return {
        ...result,
        cacheHit: false,
        cacheSource: 'none',
        responseTime: time
      };
    }

    const { result, time } = await this.measureTime(async () => {
      const cacheResult = await this.cacheManager.get<T>(
        namespace,
        key,
        async () => {
          const kvResult = await fetchFn();
          return kvResult.success ? kvResult.data : null;
        }
      );

      if (cacheResult !== null) {
        return {
          success: true,
          data: cacheResult,
          key,
          source: 'kv' as const
        };
      }

      return {
        success: false,
        key,
        source: 'error' as const,
        error: 'Data not found in cache or KV'
      };
    });

    const cacheStats = this.cacheManager.getStats();
    const isCacheHit = result.success && cacheStats.totalRequests > 0 &&
                      (cacheStats.l1Hits + cacheStats.l2Hits) > 0;

    return {
      ...result,
      cacheHit: isCacheHit,
      cacheSource: isCacheHit ?
        (cacheStats.l1Hits > cacheStats.l2Hits ? 'l1' : 'l2') : 'none',
      responseTime: time
    };
  }

  /**
   * Generic cached write operation with cache invalidation
   */
  private async cachedWrite<T>(
    namespace: string,
    key: string,
    data: T,
    writeFn: () => Promise<KVWriteResult>
  ): Promise<EnhancedKVWriteResult> {
    const { result, time } = await this.measureTime(writeFn);

    // Invalidate cache entry on successful write
    let cacheInvalidated = false;
    if (result.success && this.enabled) {
      try {
        await this.cacheManager.delete(namespace, key);
        cacheInvalidated = true;
        logger.debug(`Cache invalidated for ${namespace}:${key}`);
      } catch (error) {
        logger.warn('Failed to invalidate cache', { namespace, key, error });
      }
    }

    return {
      ...result,
      cacheInvalidated,
      responseTime: time
    };
  }

  /**
   * Read analysis data with caching
   */
  async getAnalysis(date: string): Promise<EnhancedKVReadResult<AnalysisData>> {
    return await this.cachedRead(
      'analysis_results',
      `analysis_${date}`,
      () => this.dal.getAnalysis(date)
    );
  }

  /**
   * Store analysis data with cache invalidation
   */
  async storeAnalysis(
    date: string,
    data: AnalysisData,
    options?: any
  ): Promise<EnhancedKVWriteResult> {
    return await this.cachedWrite(
      'analysis_results',
      `analysis_${date}`,
      data,
      () => this.dal.storeAnalysis(date, data, options)
    );
  }

  /**
   * Get manual analysis with caching
   */
  async getManualAnalysis(timestamp: number): Promise<EnhancedKVReadResult<AnalysisData>> {
    return await this.cachedRead(
      'analysis_results',
      `manual_analysis_${timestamp}`,
      () => this.dal.getManualAnalysis(timestamp)
    );
  }

  /**
   * Store manual analysis with cache invalidation
   */
  async storeManualAnalysis(
    timestamp: number,
    data: AnalysisData
  ): Promise<EnhancedKVWriteResult> {
    return await this.cachedWrite(
      'analysis_results',
      `manual_analysis_${timestamp}`,
      data,
      () => this.dal.storeManualAnalysis(timestamp, data)
    );
  }

  /**
   * Get high-confidence signals with caching
   */
  async getHighConfidenceSignals(
    date: Date | string
  ): Promise<EnhancedKVReadResult<HighConfidenceSignalsData>> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return await this.cachedRead(
      'sentiment_analysis',
      `high_confidence_signals_${dateStr}`,
      () => this.dal.getHighConfidenceSignals(date)
    );
  }

  /**
   * Store high-confidence signals with cache invalidation
   */
  async storeHighConfidenceSignals(
    date: Date | string,
    signals: any[]
  ): Promise<EnhancedKVWriteResult> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return await this.cachedWrite(
      'sentiment_analysis',
      `high_confidence_signals_${dateStr}`,
      signals,
      () => this.dal.storeHighConfidenceSignals(date, signals)
    );
  }

  /**
   * Get signal tracking with caching
   */
  async getSignalTracking(
    date: Date | string
  ): Promise<EnhancedKVReadResult<SignalTrackingRecord>> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return await this.cachedRead(
      'sentiment_analysis',
      `signal_tracking_${dateStr}`,
      () => this.dal.getSignalTracking(date)
    );
  }

  /**
   * Update signal tracking with cache invalidation
   */
  async updateSignalTracking(
    signalId: string,
    trackingData: any,
    date: Date | string
  ): Promise<EnhancedKVWriteResult> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return await this.cachedWrite(
      'sentiment_analysis',
      `signal_tracking_${dateStr}`,
      { signalId, ...trackingData },
      () => this.dal.updateSignalTracking(signalId, trackingData, date)
    );
  }

  /**
   * Get market prices with caching
   */
  async getMarketPrices(symbol: string): Promise<EnhancedKVReadResult<MarketPriceData>> {
    return await this.cachedRead(
      'market_data',
      `market_prices_${symbol}`,
      () => this.dal.getMarketPrices(symbol)
    );
  }

  /**
   * Store market prices with cache invalidation
   */
  async storeMarketPrices(
    symbol: string,
    priceData: any
  ): Promise<EnhancedKVWriteResult> {
    return await this.cachedWrite(
      'market_data',
      `market_prices_${symbol}`,
      priceData,
      () => this.dal.storeMarketPrices(symbol, priceData)
    );
  }

  /**
   * Get daily report with caching
   */
  async getDailyReport(
    reportType: 'pre-market' | 'intraday' | 'end-of-day',
    date: Date | string
  ): Promise<EnhancedKVReadResult<DailyReport>> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return await this.cachedRead(
      'daily_reports',
      `${reportType}_report_${dateStr}`,
      () => this.dal.getDailyReport(reportType, date)
    );
  }

  /**
   * Store daily report with cache invalidation
   */
  async storeDailyReport(
    reportType: 'pre-market' | 'intraday' | 'end-of-day',
    date: Date | string,
    reportData: any
  ): Promise<EnhancedKVWriteResult> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return await this.cachedWrite(
      'daily_reports',
      `${reportType}_report_${dateStr}`,
      reportData,
      () => this.dal.storeDailyReport(reportType, date, reportData)
    );
  }

  /**
   * Get sector data with caching
   */
  async getSectorData(symbol: string): Promise<EnhancedKVReadResult<any>> {
    return await this.cachedRead(
      'sector_data',
      `sector_${symbol}`,
      async () => {
        // Use generic read method since DAL doesn't have specific sector data method
        const key = `sector_data_${symbol}`;
        return await this.dal.read(key);
      }
    );
  }

  /**
   * Store sector data with cache invalidation
   */
  async storeSectorData(
    symbol: string,
    sectorData: any,
    ttl?: number
  ): Promise<EnhancedKVWriteResult> {
    return await this.cachedWrite(
      'sector_data',
      `sector_${symbol}`,
      sectorData,
      async () => {
        const key = `sector_data_${symbol}`;
        return await this.dal.write(key, sectorData, { expirationTtl: ttl });
      }
    );
  }

  /**
   * Get market drivers data with caching
   */
  async getMarketDriversData(type: string): Promise<EnhancedKVReadResult<any>> {
    return await this.cachedRead(
      'market_drivers',
      `market_drivers_${type}`,
      async () => {
        const key = `market_drivers_${type}`;
        return await this.dal.read(key);
      }
    );
  }

  /**
   * Store market drivers data with cache invalidation
   */
  async storeMarketDriversData(
    type: string,
    data: any,
    ttl?: number
  ): Promise<EnhancedKVWriteResult> {
    return await this.cachedWrite(
      'market_drivers',
      `market_drivers_${type}`,
      data,
      async () => {
        const key = `market_drivers_${type}`;
        return await this.dal.write(key, data, { expirationTtl: ttl });
      }
    );
  }

  /**
   * Get API response with caching
   */
  async getApiResponse(endpoint: string, params?: string): Promise<EnhancedKVReadResult<any>> {
    const cacheKey = params ? `${endpoint}_${params}` : endpoint;
    return await this.cachedRead(
      'api_responses',
      cacheKey,
      async () => {
        const key = `api_response_${cacheKey}`;
        return await this.dal.read(key);
      }
    );
  }

  /**
   * Store API response with cache invalidation
   */
  async storeApiResponse(
    endpoint: string,
    response: any,
    params?: string,
    ttl?: number
  ): Promise<EnhancedKVWriteResult> {
    const cacheKey = params ? `${endpoint}_${params}` : endpoint;
    return await this.cachedWrite(
      'api_responses',
      cacheKey,
      response,
      async () => {
        const key = `api_response_${cacheKey}`;
        return await this.dal.write(key, response, { expirationTtl: ttl });
      }
    );
  }

  /**
   * Generic read operation with caching
   */
  async read<T = any>(key: string): Promise<EnhancedKVReadResult<T>> {
    return await this.cachedRead(
      'api_responses',
      key,
      () => this.dal.read<T>(key)
    );
  }

  /**
   * Generic write operation with cache invalidation
   */
  async write(
    key: string,
    data: any,
    options?: any
  ): Promise<EnhancedKVWriteResult> {
    return await this.cachedWrite(
      'api_responses',
      key,
      data,
      () => this.dal.write(key, data, options)
    );
  }

  /**
   * List keys (no caching for this operation)
   */
  async listKeys(prefix: string, limit?: number): Promise<{ keys: string[], cursor?: string }> {
    return await this.dal.listKeys(prefix, limit);
  }

  /**
   * Delete key with cache invalidation
   */
  async deleteKey(key: string): Promise<boolean> {
    // Delete from all cache namespaces
    if (this.enabled) {
      try {
        // Try to delete from common namespaces
        const namespaces = ['analysis_results', 'market_data', 'sector_data', 'market_drivers', 'api_responses'];
        for (const namespace of namespaces) {
          await this.cacheManager.delete(namespace, key);
        }
      } catch (error) {
        logger.warn('Failed to delete from cache', { key, error });
      }
    }

    return await this.dal.deleteKey(key);
  }

  /**
   * Clear cache for specific namespace or all cache
   */
  async clearCache(namespace?: string): Promise<void> {
    if (this.enabled) {
      await this.cacheManager.clear(namespace);
      logger.info(`Cache cleared${namespace ? ` for namespace: ${namespace}` : ' completely'}`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return this.cacheManager.getStats();
  }

  /**
   * Get cache health status
   */
  getCacheHealthStatus(): any {
    return this.cacheManager.getHealthStatus();
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats(): {
    dal: any;
    cache: CacheStats;
    cacheHealth: any;
    enabled: boolean;
  } {
    return {
      dal: this.dal.getPerformanceStats(),
      cache: this.getCacheStats(),
      cacheHealth: this.getCacheHealthStatus(),
      enabled: this.enabled
    };
  }

  /**
   * Cleanup expired cache entries
   */
  async cleanup(): Promise<void> {
    if (this.enabled) {
      await this.cacheManager.cleanup();
      logger.info('Cache cleanup completed');
    }
  }

  /**
   * Enable/disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.cacheManager.setEnabled(enabled);
    logger.info(`Cache ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Reset cache statistics
   */
  resetCacheStats(): void {
    this.cacheManager.resetStats();
    logger.info('Cache statistics reset');
  }
}

/**
 * Factory function to create enhanced DAL instance
 */
export function createEnhancedDAL(
  env: CloudflareEnvironment,
  config?: Partial<EnhancedDALConfig>
): EnhancedDataAccessLayer {
  const defaultConfig: EnhancedDALConfig = {
    enableCache: true,
    environment: env.ENVIRONMENT || 'development',
    cacheOptions: {
      l1MaxSize: 1000,
      enabled: true
    }
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new EnhancedDataAccessLayer(env, finalConfig);
}

export default EnhancedDataAccessLayer;