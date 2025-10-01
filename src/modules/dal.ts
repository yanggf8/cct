/**
 * Data Access Layer (DAL) - TypeScript
 * Centralized, type-safe KV storage operations with retry logic and error handling
 *
 * Design Goals:
 * - Type safety for all KV operations
 * - Consistent error handling across the application
 * - Automatic retry logic with exponential backoff
 * - KV Key Factory integration
 * - Comprehensive logging
 * - Support for eventual consistency (60s delay awareness)
 */

import { KVKeyFactory, KeyTypes, KeyHelpers } from './kv-key-factory.js';
import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('dal');

/**
 * Type Definitions
 */

export interface TradingSentimentLayer {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  reasoning?: string;
  model?: string;
  source?: string;
}

export interface TradingSignal {
  symbol: string;
  sentiment_layers: TradingSentimentLayer[];
  timestamp?: string;
}

export interface AnalysisData {
  test_mode?: boolean;
  test_request_id?: string;
  symbols_analyzed: string[];
  trading_signals: Record<string, TradingSignal>;
  timestamp: string;
  data_source?: string;
  cron_execution_id?: string;
  trigger_mode?: string;
  last_updated?: string;
  analysis_type?: string;
  request_id?: string;
  generated_at?: string;
}

export interface KVWriteOptions {
  expirationTtl?: number;
  expiration?: number;
  metadata?: Record<string, any>;
}

export interface KVReadResult<T> {
  success: boolean;
  data?: T;
  key: string;
  source: 'kv' | 'cache' | 'error';
  error?: string;
}

export interface KVWriteResult {
  success: boolean;
  key: string;
  ttl?: number;
  error?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

// Signal and Tracking Types (from kv-storage-manager)
export interface HighConfidenceSignal {
  symbol: string;
  prediction: 'up' | 'down' | 'neutral';
  confidence: number;
  reasoning?: string;
  timestamp?: string;
}

export interface HighConfidenceSignalsData {
  date: string;
  signals: HighConfidenceSignal[];
  metadata: {
    totalSignals: number;
    highConfidenceSignals: number;
    averageConfidence: number;
    bullishSignals: number;
    bearishSignals: number;
    neutralSignals: number;
    generatedAt: string;
    symbols: string[];
  };
}

export interface SignalTrackingData {
  id: string;
  status?: string;
  confidence?: number;
  prediction?: string;
  actual?: string;
  accuracy?: number;
  createdAt: string;
  lastUpdated?: string;
  [key: string]: any;
}

export interface SignalTrackingRecord {
  date: string;
  signals: SignalTrackingData[];
  lastUpdated: string;
}

export interface MarketPriceData {
  symbol: string;
  currentPrice: number;
  timestamp: string;
  priceHistory: Array<{
    price: number;
    timestamp: string;
  }>;
  volume?: number;
  change?: number;
  changePercent?: number;
}

export interface ReportMetadata {
  reportType: string;
  date: string;
  generatedAt: string;
  version: string;
}

export interface DailyReport {
  metadata: ReportMetadata;
  [key: string]: any;
}

// TTL Configuration (from kv-storage-manager)
export const TTL_CONFIG = {
  SIGNAL_DATA: 90 * 24 * 60 * 60,      // 90 days
  DAILY_REPORTS: 7 * 24 * 60 * 60,     // 7 days
  WEEKLY_REPORTS: 30 * 24 * 60 * 60,   // 30 days
  MARKET_PRICES: 24 * 60 * 60,         // 1 day
  INTRADAY_DATA: 3 * 24 * 60 * 60,     // 3 days
  CONFIG: null as number | null        // No expiration
};

/**
 * Data Access Layer Class
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
}

export class DataAccessLayer {
  private env: CloudflareEnvironment;
  private retryConfig: RetryConfig;
  private cache: Map<string, CacheEntry<any>>;
  private hitCount: number;
  private missCount: number;
  private readonly maxCacheSize = 100;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(env: CloudflareEnvironment, retryConfig?: Partial<RetryConfig>) {
    this.env = env;
    this.retryConfig = {
      maxRetries: retryConfig?.maxRetries ?? 3,
      baseDelay: retryConfig?.baseDelay ?? 1000,
      maxDelay: retryConfig?.maxDelay ?? 10000,
    };
    this.cache = new Map();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict least recently used entries if cache is full
   */
  private evictLRU(): void {
    if (this.cache.size >= this.maxCacheSize) {
      let oldestKey = '';
      let oldestTime = Date.now();
      let lowestAccess = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.accessCount < lowestAccess ||
            (entry.accessCount === lowestAccess && entry.timestamp < oldestTime)) {
          oldestKey = key;
          oldestTime = entry.timestamp;
          lowestAccess = entry.accessCount;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Safe JSON parsing with detailed error handling
   * Separates JSON parse errors from other errors
   */
  private safeJsonParse<T>(jsonString: string, context: string): T {
    try {
      return JSON.parse(jsonString) as T;
    } catch (error: any) {
      logger.error('JSON parsing failed', {
        context,
        error: error.message,
        dataPreview: jsonString.substring(0, 100),
      });
      throw new Error(`JSON parse error in ${context}: ${error.message}`);
    }
  }

  /**
   * Retry helper with exponential backoff
   */
  private async retry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        if (attempt < this.retryConfig.maxRetries - 1) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt),
            this.retryConfig.maxDelay
          );

          logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries: this.retryConfig.maxRetries,
            error: error.message,
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error(`${operationName} failed after ${this.retryConfig.maxRetries} attempts`, {
      error: lastError?.message,
      stack: lastError?.stack,
    });

    throw lastError;
  }

  /**
   * Generic read helper with cache support
   * Reduces code duplication across all read methods
   */
  private async _genericRead<T>(
    key: string,
    operationName: string,
    useCache: boolean = false
  ): Promise<KVReadResult<T>> {
    // Check cache first if enabled
    if (useCache && this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.accessCount++;
      this.hitCount++;
      logger.debug(`Cache hit for ${operationName}`, { key });
      return {
        success: true,
        data: entry.data as T,
        key,
        source: 'cache',
      };
    }

    try {
      const data = await this.retry(
        () => this.env.TRADING_RESULTS.get(key),
        operationName
      );

      if (data) {
        const parsed = this.safeJsonParse<T>(data as string, operationName);

        // Update cache if enabled
        if (useCache) {
          this.cleanupCache();
          this.evictLRU();
          this.cache.set(key, {
            data: parsed,
            timestamp: Date.now(),
            accessCount: 1
          });
          this.missCount++;
        }

        logger.debug(`${operationName} successful`, { key });
        return {
          success: true,
          data: parsed,
          key,
          source: 'kv',
        };
      }

      if (useCache) {
        this.missCount++;
      }

      logger.warn(`${operationName}: Data not found`, { key });
      return {
        success: false,
        key,
        source: 'error',
        error: 'Data not found',
      };

    } catch (error: any) {
      if (useCache) {
        this.missCount++;
      }

      logger.error(`${operationName} failed`, {
        key,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        key,
        source: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Generic write helper with automatic TTL management
   * Reduces code duplication across all write methods
   */
  private async _genericWrite<T>(
    key: string,
    data: T,
    operationName: string,
    options?: KVWriteOptions
  ): Promise<KVWriteResult> {
    try {
      const serialized = JSON.stringify(data);

      await this.retry(
        () => this.env.TRADING_RESULTS.put(key, serialized, options),
        operationName
      );

      // Invalidate cache on write
      if (this.cache.has(key)) {
        this.cache.delete(key);
      }

      logger.info(`${operationName} successful`, {
        key,
        ttl: options?.expirationTtl,
        dataSize: serialized.length,
      });

      return {
        success: true,
        key,
        ttl: options?.expirationTtl,
      };

    } catch (error: any) {
      logger.error(`${operationName} failed`, {
        key,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        key,
        error: error.message,
      };
    }
  }

  /**
   * Read analysis data for a specific date
   */
  async getAnalysis(date: string): Promise<KVReadResult<AnalysisData>> {
    const key = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date });
    logger.info('Reading analysis from KV', { key, date });

    const result = await this._genericRead<AnalysisData>(key, 'getAnalysis', false);

    if (result.success && result.data) {
      logger.info('Analysis retrieved successfully', {
        key,
        symbolsCount: result.data.symbols_analyzed?.length ?? 0,
      });
    }

    return result;
  }

  /**
   * Write analysis data for a specific date
   */
  async storeAnalysis(
    date: string,
    data: AnalysisData,
    options?: KVWriteOptions
  ): Promise<KVWriteResult> {
    const key = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date });

    logger.info('Writing analysis to KV', {
      key,
      date,
      symbolsCount: data.symbols_analyzed?.length ?? 0,
    });

    const kvOptions: KVWriteOptions = options ?? KeyHelpers.getKVOptions(KeyTypes.ANALYSIS);
    return await this._genericWrite<AnalysisData>(key, data, 'storeAnalysis', kvOptions);
  }

  /**
   * Get manual/on-demand analysis by timestamp
   */
  async getManualAnalysis(timestamp: number): Promise<KVReadResult<AnalysisData>> {
    const key = KVKeyFactory.generateKey(KeyTypes.MANUAL_ANALYSIS, { timestamp });
    logger.info('Reading manual analysis from KV', { key, timestamp });
    return await this._genericRead<AnalysisData>(key, 'getManualAnalysis', false);
  }

  /**
   * Store manual/on-demand analysis
   */
  async storeManualAnalysis(
    timestamp: number,
    data: AnalysisData
  ): Promise<KVWriteResult> {
    const key = KVKeyFactory.generateKey(KeyTypes.MANUAL_ANALYSIS, { timestamp });
    logger.info('Writing manual analysis to KV', { key, timestamp });

    const enhancedData = {
      ...data,
      analysis_type: 'manual_on_demand',
      generated_at: new Date().toISOString(),
    };

    const kvOptions: KVWriteOptions = KeyHelpers.getKVOptions(KeyTypes.MANUAL_ANALYSIS);
    return await this._genericWrite<typeof enhancedData>(key, enhancedData, 'storeManualAnalysis', kvOptions);
  }

  /**
   * List all keys with a given prefix
   */
  async listKeys(prefix: string, limit?: number): Promise<{ keys: string[], cursor?: string }> {
    try {
      logger.info('Listing KV keys', { prefix, limit });

      const result: any = await this.retry(
        () => this.env.TRADING_RESULTS.list({ prefix, limit }),
        'listKeys'
      );

      const keys = result.keys.map((k: any) => k.name);

      logger.info('Keys listed successfully', {
        prefix,
        count: keys.length,
        cursor: result.cursor,
      });

      return {
        keys,
        cursor: result.cursor,
      };

    } catch (error: any) {
      logger.error('Failed to list keys', {
        prefix,
        error: error.message,
      });

      return { keys: [] };
    }
  }

  /**
   * Delete a key from KV
   */
  async deleteKey(key: string): Promise<boolean> {
    try {
      logger.info('Deleting KV key', { key });

      await this.retry(
        () => this.env.TRADING_RESULTS.delete(key),
        'deleteKey'
      );

      logger.info('Key deleted successfully', { key });
      return true;

    } catch (error: any) {
      logger.error('Failed to delete key', {
        key,
        error: error.message,
      });

      return false;
    }
  }

  /**
   * Generic read operation for any key type
   */
  async read<T = any>(key: string): Promise<KVReadResult<T>> {
    try {
      logger.info('Reading from KV', { key });

      const data = await this.retry(
        () => this.env.TRADING_RESULTS.get(key),
        'read'
      );

      if (data) {
        const parsed = this.safeJsonParse<T>(data as string, 'read');
        return {
          success: true,
          data: parsed,
          key,
          source: 'kv',
        };
      }

      return {
        success: false,
        key,
        source: 'error',
        error: 'Data not found',
      };

    } catch (error: any) {
      logger.error('Failed to read from KV', {
        key,
        error: error.message,
      });

      return {
        success: false,
        key,
        source: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Generic write operation for any key type
   */
  async write(
    key: string,
    data: any,
    options?: KVWriteOptions
  ): Promise<KVWriteResult> {
    try {
      logger.info('Writing to KV', { key });

      const writeOptions: any = options ?? {};

      await this.retry(
        () => this.env.TRADING_RESULTS.put(key, JSON.stringify(data), writeOptions),
        'write'
      );

      logger.info('Write successful', { key, ttl: options?.expirationTtl });

      return {
        success: true,
        key,
        ttl: options?.expirationTtl,
      };

    } catch (error: any) {
      logger.error('Failed to write to KV', {
        key,
        error: error.message,
      });

      return {
        success: false,
        key,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // Signal Tracking Methods (from kv-storage-manager)
  // ============================================================================

  /**
   * Store high-confidence signals with metadata
   */
  async storeHighConfidenceSignals(
    date: Date | string,
    signals: HighConfidenceSignal[]
  ): Promise<KVWriteResult> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const key = `high_confidence_signals_${dateStr}`;

    const signalsData: HighConfidenceSignalsData = {
      date: dateStr,
      signals: signals,
      metadata: {
        totalSignals: signals.length,
        highConfidenceSignals: signals.filter(s => s.confidence >= 80).length,
        averageConfidence: signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length,
        bullishSignals: signals.filter(s => s.prediction === 'up').length,
        bearishSignals: signals.filter(s => s.prediction === 'down').length,
        neutralSignals: signals.filter(s => s.prediction === 'neutral').length,
        generatedAt: new Date().toISOString(),
        symbols: signals.map(s => s.symbol)
      }
    };

    logger.info('Storing high-confidence signals', {
      date: dateStr,
      signalCount: signals.length,
      highConfidenceCount: signalsData.metadata.highConfidenceSignals,
    });

    const result = await this._genericWrite<HighConfidenceSignalsData>(
      key,
      signalsData,
      'storeHighConfidenceSignals',
      { expirationTtl: TTL_CONFIG.SIGNAL_DATA }
    );

    // Update cache on successful write
    if (result.success) {
      this.cache.set(key, signalsData);
    }

    return result;
  }

  /**
   * Get high-confidence signals for a specific date
   */
  async getHighConfidenceSignals(
    date: Date | string
  ): Promise<KVReadResult<HighConfidenceSignalsData>> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const key = `high_confidence_signals_${dateStr}`;
    return await this._genericRead<HighConfidenceSignalsData>(key, 'getHighConfidenceSignals', true);
  }

  /**
   * Update signal tracking data in real-time
   */
  async updateSignalTracking(
    signalId: string,
    trackingData: Partial<SignalTrackingData>,
    date: Date | string
  ): Promise<KVWriteResult> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const key = `signal_tracking_${dateStr}`;

    const existingResult = await this.getSignalTracking(date);

    let trackingRecord: SignalTrackingRecord;
    if (existingResult.success && existingResult.data) {
      trackingRecord = existingResult.data;
    } else {
      trackingRecord = {
        date: dateStr,
        signals: [],
        lastUpdated: new Date().toISOString()
      };
    }

    // Find and update the signal
    const signalIndex = trackingRecord.signals.findIndex(s => s.id === signalId);
    if (signalIndex >= 0) {
      trackingRecord.signals[signalIndex] = {
        ...trackingRecord.signals[signalIndex],
        ...trackingData,
        lastUpdated: new Date().toISOString()
      };
    } else {
      // Add new signal
      trackingRecord.signals.push({
        id: signalId,
        ...trackingData,
        createdAt: new Date().toISOString()
      } as SignalTrackingData);
    }

    trackingRecord.lastUpdated = new Date().toISOString();

    logger.debug('Updating signal tracking', { signalId, date: dateStr, status: trackingData.status });

    const result = await this._genericWrite<SignalTrackingRecord>(
      key,
      trackingRecord,
      'updateSignalTracking',
      { expirationTtl: TTL_CONFIG.SIGNAL_DATA }
    );

    // Update cache on successful write
    if (result.success) {
      this.cache.set(key, trackingRecord);
    }

    return result;
  }

  /**
   * Get signal tracking data for a date
   */
  async getSignalTracking(
    date: Date | string
  ): Promise<KVReadResult<SignalTrackingRecord>> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const key = `signal_tracking_${dateStr}`;
    return await this._genericRead<SignalTrackingRecord>(key, 'getSignalTracking', true);
  }

  /**
   * Store market prices for real-time tracking
   */
  async storeMarketPrices(
    symbol: string,
    priceData: Omit<MarketPriceData, 'symbol' | 'timestamp'>
  ): Promise<KVWriteResult> {
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

    logger.debug('Storing market prices', {
      symbol,
      currentPrice: priceData.currentPrice,
      changePercent: priceData.changePercent
    });

    const result = await this._genericWrite<MarketPriceData>(
      key,
      marketData,
      'storeMarketPrices',
      { expirationTtl: TTL_CONFIG.MARKET_PRICES }
    );

    // Update cache on successful write
    if (result.success) {
      this.cache.set(key, marketData);
    }

    return result;
  }

  /**
   * Get current market prices
   */
  async getMarketPrices(symbol: string): Promise<KVReadResult<MarketPriceData>> {
    const key = `market_prices_${symbol}`;
    return await this._genericRead<MarketPriceData>(key, 'getMarketPrices', true);
  }

  /**
   * Store daily report data
   */
  async storeDailyReport(
    reportType: 'pre-market' | 'intraday' | 'end-of-day',
    date: Date | string,
    reportData: any
  ): Promise<KVWriteResult> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    let key: string;

    switch (reportType) {
      case 'pre-market':
        key = `pre_market_briefing_${dateStr}`;
        break;
      case 'intraday':
        key = `intraday_check_${dateStr}`;
        break;
      case 'end-of-day':
        key = `end_of_day_summary_${dateStr}`;
        break;
      default:
        logger.error('Unknown report type', { reportType });
        return {
          success: false,
          key: '',
          error: 'Unknown report type'
        };
    }

    const enhancedReportData: DailyReport = {
      ...reportData,
      metadata: {
        reportType,
        date: dateStr,
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    };

    logger.info('Storing daily report', { reportType, date: dateStr });

    const result = await this._genericWrite<DailyReport>(
      key,
      enhancedReportData,
      'storeDailyReport',
      { expirationTtl: TTL_CONFIG.DAILY_REPORTS }
    );

    // Update cache on successful write
    if (result.success) {
      this.cache.set(key, enhancedReportData);
    }

    return result;
  }

  /**
   * Get daily report data
   */
  async getDailyReport(
    reportType: 'pre-market' | 'intraday' | 'end-of-day',
    date: Date | string
  ): Promise<KVReadResult<DailyReport>> {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    let key: string;

    switch (reportType) {
      case 'pre-market':
        key = `pre_market_briefing_${dateStr}`;
        break;
      case 'intraday':
        key = `intraday_check_${dateStr}`;
        break;
      case 'end-of-day':
        key = `end_of_day_summary_${dateStr}`;
        break;
      default:
        logger.error('Unknown report type', { reportType });
        return {
          success: false,
          key: '',
          source: 'error',
          error: 'Unknown report type'
        };
    }

    return await this._genericRead<DailyReport>(key, 'getDailyReport', true);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    cacheHits: number;
    cacheMisses: number;
    totalRequests: number;
    hitRate: number;
    cacheSize: number;
  } {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

    return {
      cacheHits: this.hitCount,
      cacheMisses: this.missCount,
      totalRequests,
      hitRate: hitRate,
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear cache entries
   */
  clearCache(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    logger.info('Cleared DAL cache');
  }
}

/**
 * Factory function to create DAL instance
 */
export function createDAL(env: CloudflareEnvironment, retryConfig?: Partial<RetryConfig>): DataAccessLayer {
  return new DataAccessLayer(env, retryConfig);
}

/**
 * Export types for use in JavaScript files
 */
export type {
  TradingSentimentLayer as SentimentLayer,
  TradingSignal as Signal,
  AnalysisData as Analysis,
};