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

/**
 * Data Access Layer Class
 */
export class DataAccessLayer {
  private env: any; // Cloudflare env binding
  private retryConfig: RetryConfig;

  constructor(env: any, retryConfig?: Partial<RetryConfig>) {
    this.env = env;
    this.retryConfig = {
      maxRetries: retryConfig?.maxRetries ?? 3,
      baseDelay: retryConfig?.baseDelay ?? 1000,
      maxDelay: retryConfig?.maxDelay ?? 10000,
    };
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
   * Read analysis data for a specific date
   */
  async getAnalysis(date: string): Promise<KVReadResult<AnalysisData>> {
    const key = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date });

    try {
      logger.info('Reading analysis from KV', { key, date });

      const data = await this.retry(
        () => this.env.TRADING_RESULTS.get(key),
        'getAnalysis'
      );

      if (data) {
        const parsed = JSON.parse(data as string) as AnalysisData;
        logger.info('Analysis retrieved successfully', {
          key,
          symbolsCount: parsed.symbols_analyzed?.length ?? 0,
        });

        return {
          success: true,
          data: parsed,
          key,
          source: 'kv',
        };
      }

      logger.warn('No analysis found for date', { key, date });
      return {
        success: false,
        key,
        source: 'error',
        error: 'Analysis not found',
      };

    } catch (error: any) {
      logger.error('Failed to read analysis', {
        key,
        date,
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
   * Write analysis data for a specific date
   */
  async storeAnalysis(
    date: string,
    data: AnalysisData,
    options?: KVWriteOptions
  ): Promise<KVWriteResult> {
    const key = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date });

    try {
      logger.info('Writing analysis to KV', {
        key,
        date,
        symbolsCount: data.symbols_analyzed?.length ?? 0,
      });

      const kvOptions: KVWriteOptions = options ?? KeyHelpers.getKVOptions(KeyTypes.ANALYSIS);

      await this.retry(
        () => this.env.TRADING_RESULTS.put(key, JSON.stringify(data), kvOptions),
        'storeAnalysis'
      );

      logger.info('Analysis stored successfully', { key, ttl: kvOptions.expirationTtl });

      return {
        success: true,
        key,
        ttl: kvOptions.expirationTtl,
      };

    } catch (error: any) {
      logger.error('Failed to write analysis', {
        key,
        date,
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
   * Get manual/on-demand analysis by timestamp
   */
  async getManualAnalysis(timestamp: number): Promise<KVReadResult<AnalysisData>> {
    const key = KVKeyFactory.generateKey(KeyTypes.MANUAL_ANALYSIS, { timestamp });

    try {
      logger.info('Reading manual analysis from KV', { key, timestamp });

      const data = await this.retry(
        () => this.env.TRADING_RESULTS.get(key),
        'getManualAnalysis'
      );

      if (data) {
        const parsed = JSON.parse(data as string) as AnalysisData;
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
        error: 'Manual analysis not found',
      };

    } catch (error: any) {
      logger.error('Failed to read manual analysis', {
        key,
        timestamp,
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
   * Store manual/on-demand analysis
   */
  async storeManualAnalysis(
    timestamp: number,
    data: AnalysisData
  ): Promise<KVWriteResult> {
    const key = KVKeyFactory.generateKey(KeyTypes.MANUAL_ANALYSIS, { timestamp });

    try {
      logger.info('Writing manual analysis to KV', { key, timestamp });

      const kvOptions: KVWriteOptions = KeyHelpers.getKVOptions(KeyTypes.MANUAL_ANALYSIS);

      await this.retry(
        () => this.env.TRADING_RESULTS.put(
          key,
          JSON.stringify({
            ...data,
            analysis_type: 'manual_on_demand',
            generated_at: new Date().toISOString(),
          }),
          kvOptions
        ),
        'storeManualAnalysis'
      );

      logger.info('Manual analysis stored successfully', { key, ttl: kvOptions.expirationTtl });

      return {
        success: true,
        key,
        ttl: kvOptions.expirationTtl,
      };

    } catch (error: any) {
      logger.error('Failed to write manual analysis', {
        key,
        timestamp,
        error: error.message,
      });

      return {
        success: false,
        key,
        error: error.message,
      };
    }
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
        const parsed = JSON.parse(data as string) as T;
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
}

/**
 * Factory function to create DAL instance
 */
export function createDAL(env: any, retryConfig?: Partial<RetryConfig>): DataAccessLayer {
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