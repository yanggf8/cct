/**
 * Sector Data Fetcher Module - TypeScript
 * Batch data fetching with semaphore concurrency control and circuit breaker protection
 * CRITICAL PRODUCTION FIX: Prevents rate limit bans during cold starts with semaphore pattern
 * Enhanced with data validation and integrated circuit breaker
 */

import { SectorCacheManager, SectorData } from './sector-cache-manager.js';
import { createLogger } from './logging.js';
import { getTimeout, getRetryCount } from './config.js';
import { DataValidator, validateOHLCVBar } from './data-validation.js';

const logger = createLogger('sector-data-fetcher');

// Sector Symbols Configuration
export const SECTOR_SYMBOLS = [
  'XLK', // Technology
  'XLV', // Health Care
  'XLF', // Financials
  'XLY', // Consumer Discretionary
  'XLC', // Communication Services
  'XLI', // Industrials
  'XLP', // Consumer Staples
  'XLE', // Energy
  'XLU', // Utilities
  'XLRE', // Real Estate
  'XLB', // Materials
  'SPY'  // S&P 500 Benchmark
] as const;

// Concurrency Configuration
const CONCURRENCY_CONFIG = {
  MAX_CONCURRENT_REQUESTS: 4, // Rovodev critical fix - semaphore limit
  BATCH_SIZE: 12, // 11 sector ETFs + SPY
  REQUEST_TIMEOUT: 8000, // 8 seconds per request
  CIRCUIT_BREAKER_THRESHOLD: 5, // 5 failures trigger circuit breaker
  CIRCUIT_BREAKER_TIMEOUT: 60000, // 1 minute circuit breaker timeout
} as const;

// Circuit breaker states
enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Circuit is open, no requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

// Circuit breaker interface
interface CircuitBreaker {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

// Yahoo Finance data interface
interface YahooFinanceData {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  marketCap: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  fiftyDayAverage: number;
  twoHundredDayAverage: number;
}

// Semaphore implementation for concurrency control
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise<void>((resolve: any) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      resolve();
    } else {
      this.permits++;
    }
  }

  availablePermits(): number {
    return this.permits;
  }

  queueLength(): number {
    return this.waitQueue.length;
  }
}

/**
 * Sector Data Fetcher with semaphore concurrency control
 */
export class SectorDataFetcher {
  private cache: SectorCacheManager | null;
  private semaphore: Semaphore;
  private circuitBreaker: CircuitBreaker;
  private fetchStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    circuitBreakerTrips: 0,
    averageResponseTime: 0
  };

  constructor(cache: SectorCacheManager | null) {
    this.cache = cache;
    this.semaphore = new Semaphore(CONCURRENCY_CONFIG.MAX_CONCURRENT_REQUESTS);
    this.circuitBreaker = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0
    };
  }

  /**
   * Fetch sector data for multiple symbols with concurrency control
   */
  async fetchSectorData(symbols: string[]): Promise<Map<string, SectorData | null>> {
    logger.info(`Fetching sector data for ${symbols.length} symbols with semaphore control`);

    const results = new Map<string, SectorData | null>();
    const startTime = Date.now();

    try {
      // Check if circuit breaker is open
      if (this.circuitBreaker.state === CircuitState.OPEN) {
        if (Date.now() - this.circuitBreaker.lastFailureTime > CONCURRENCY_CONFIG.CIRCUIT_BREAKER_TIMEOUT) {
          this.circuitBreaker.state = CircuitState.HALF_OPEN;
          logger.info('Circuit breaker entering HALF_OPEN state');
        } else {
          logger.warn('Circuit breaker OPEN, skipping requests');
          symbols.forEach(symbol => results.set(symbol, null));
          return results;
        }
      }

      // Fetch with semaphore control
      const fetchPromises = symbols.map(symbol => this.fetchWithSemaphore(symbol));
      const fetchResults = await Promise.allSettled(fetchPromises);

      // Process results
      fetchResults.forEach((result: any, index: any) => {
        const symbol = symbols[index];
        if (result.status === 'fulfilled') {
          results.set(symbol, result.value);
          this.handleSuccess();
        } else {
          logger.error(`Fetch failed for ${symbol}:`, result.reason);
          results.set(symbol, null);
          this.handleFailure();
        }
      });

      // Update statistics
      const duration = Date.now() - startTime;
      this.updateFetchStats(symbols.length, duration);

      logger.info(`Completed fetching ${symbols.length} symbols in ${duration}ms`);
      return results;

    } catch (error: unknown) {
      logger.error('Error in fetchSectorData:', { error: error instanceof Error ? error.message : String(error) });
      symbols.forEach(symbol => results.set(symbol, null));
      return results;
    }
  }

  /**
   * Fetch single symbol with semaphore control
   */
  private async fetchWithSemaphore(symbol: string): Promise<SectorData | null> {
    await this.semaphore.acquire();

    try {
      // Check cache first
      if (this.cache) {
        const cachedData = await this.cache.getSectorData(symbol);
        if (cachedData) {
          logger.debug(`Cache hit for ${symbol}`);
          return cachedData;
        }
      }

      // Fetch from API
      const freshData = await this.fetchFromAPI(symbol);
      if (freshData) {
        // Store in cache
        if (this.cache) {
          await this.cache.setSectorData(symbol, freshData);
        }
        logger.debug(`Fetched and cached ${symbol}`);
      }

      return freshData;

    } finally {
      this.semaphore.release();
    }
  }

  /**
   * Fetch data from Yahoo Finance API
   */
  private async fetchFromAPI(symbol: string): Promise<SectorData | null> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONCURRENCY_CONFIG.REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const chart = data.chart;

      if (!chart || !chart.result || chart.result.length === 0) {
        throw new Error('No data returned from Yahoo Finance');
      }

      const result = chart.result[0];
      const meta = result.meta;
      const quotes = result.quotes || [];

      if (!meta || quotes.length === 0) {
        throw new Error('Invalid data format from Yahoo Finance');
      }

      // Convert to SectorData format
      const sectorData: SectorData = {
        symbol: meta.symbol,
        name: meta.longName || meta.shortName || symbol,
        price: meta.regularMarketPrice || 0,
        change: meta.regularMarketChange || 0,
        changePercent: meta.regularMarketChangePercent || 0,
        volume: meta.regularMarketVolume || 0,
        timestamp: Date.now(),
        marketCap: meta.marketCap,
        dayHigh: meta.regularMarketDayHigh,
        dayLow: meta.regularMarketDayLow,
        fiftyDayAverage: meta.fiftyDayAverage,
        twoHundredDayAverage: meta.twoHundredDayAverage
      };

      return sectorData;

    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`Timeout fetching ${symbol} after ${CONCURRENCY_CONFIG.REQUEST_TIMEOUT}ms`);
      } else {
        logger.error(`API error for ${symbol}:`, { error: error instanceof Error ? error.message : String(error) });
      }
      return null;

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handle successful request
   */
  private handleSuccess(): void {
    this.fetchStats.successfulRequests++;

    if (this.circuitBreaker.state === CircuitState.HALF_OPEN) {
      this.circuitBreaker.successCount++;
      if (this.circuitBreaker.successCount >= 3) {
        // Close circuit breaker after 3 consecutive successes
        this.circuitBreaker.state = CircuitState.CLOSED;
        this.circuitBreaker.failureCount = 0;
        this.circuitBreaker.successCount = 0;
        logger.info('Circuit breaker CLOSED after successful recovery');
      }
    } else if (this.circuitBreaker.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.circuitBreaker.failureCount = Math.max(0, this.circuitBreaker.failureCount - 1);
    }
  }

  /**
   * Handle failed request
   */
  private handleFailure(): void {
    this.fetchStats.failedRequests++;
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failureCount >= CONCURRENCY_CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
      if (this.circuitBreaker.state === CircuitState.CLOSED ||
          this.circuitBreaker.state === CircuitState.HALF_OPEN) {
        this.circuitBreaker.state = CircuitState.OPEN;
        this.fetchStats.circuitBreakerTrips++;
        logger.warn(`Circuit breaker OPEN after ${this.circuitBreaker.failureCount} failures`);
      }
    }
  }

  /**
   * Update fetch statistics
   */
  private updateFetchStats(requestCount: number, duration: number): void {
    this.fetchStats.totalRequests += requestCount;
    this.fetchStats.averageResponseTime =
      (this.fetchStats.averageResponseTime + duration) / 2;
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    semaphore: {
      availablePermits: number;
      queueLength: number;
      maxPermits: number;
    };
    circuitBreaker: {
      state: CircuitState;
      failureCount: number;
      lastFailureTime: number;
    };
    performance: {
      successRate: number;
      averageResponseTime: number;
      circuitBreakerTrips: number;
    };
  } {
    const successRate = this.fetchStats.totalRequests > 0
      ? this.fetchStats.successfulRequests / this.fetchStats.totalRequests
      : 0;

    return {
      semaphore: {
        availablePermits: this.semaphore.availablePermits(),
        queueLength: this.semaphore.queueLength(),
        maxPermits: CONCURRENCY_CONFIG.MAX_CONCURRENT_REQUESTS
      },
      circuitBreaker: {
        state: this.circuitBreaker.state,
        failureCount: this.circuitBreaker.failureCount,
        lastFailureTime: this.circuitBreaker.lastFailureTime
      },
      performance: {
        successRate,
        averageResponseTime: this.fetchStats.averageResponseTime,
        circuitBreakerTrips: this.fetchStats.circuitBreakerTrips
      }
    };
  }

  /**
   * Get fetch statistics
   */
  getStats(): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    averageResponseTime: number;
    circuitBreakerTrips: number;
  } {
    const successRate = this.fetchStats.totalRequests > 0
      ? this.fetchStats.successfulRequests / this.fetchStats.totalRequests
      : 0;

    return {
      ...this.fetchStats,
      successRate
    };
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0
    };
    logger.info('Circuit breaker manually reset');
  }

  /**
   * Test system with load
   */
  async testLoad(symbols: string[], concurrency: number = 4): Promise<{
    success: boolean;
    duration: number;
    errors: string[];
    healthStatus: any;
  }> {
    logger.info(`Testing load with ${symbols.length} symbols at ${concurrency} concurrency`);

    const startTime = Date.now();
    const errors: string[] = [];
    const tempSemaphore = new Semaphore(concurrency);

    try {
      const promises = symbols.map(async (symbol: any) => {
        await tempSemaphore.acquire();
        try {
          const data = await this.fetchWithSemaphore(symbol);
          return { symbol, data, error: null };
        } catch (error: unknown) {
          errors.push(`${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return { symbol, data: null, error };
        } finally {
          tempSemaphore.release();
        }
      });

      const results = await Promise.allSettled(promises);
      const duration = Date.now() - startTime;
      const successCount = results.filter(r =>
        r.status === 'fulfilled' && r.value.data !== null
      ).length;

      return {
        success: successCount === symbols.length,
        duration,
        errors,
        healthStatus: this.getHealthStatus()
      };

    } catch (error: unknown) {
      return {
        success: false,
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        healthStatus: this.getHealthStatus()
      };
    }
  }

  /**
   * Warm up system
   */
  async warmUp(testSymbols: string[] = ['SPY', 'XLK', 'XLF']): Promise<void> {
    logger.info('Warming up sector data fetcher');

    try {
      await this.fetchSectorData(testSymbols);
      logger.info('Sector data fetcher warm-up completed');
    } catch (error: unknown) {
      logger.error('Error during warm-up:', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export default SectorDataFetcher;
