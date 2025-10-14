/**
 * Simple Sector Data Fetcher - TypeScript
 * Conservative Yahoo Finance data fetching with ZERO external dependencies
 * No AI/News APIs - pure market data analysis only
 */

import { SECTOR_CONFIG } from './sector-config.js';

interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
}

interface SectorData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  ohlc: OHLCVBar;
}

interface SectorSnapshot {
  timestamp: string;
  date: string;
  sectors: SectorData[];
  spy: SectorData;
  metadata: {
    fetchedAt: string;
    source: 'cache' | 'api';
    apiCalls: number;
    fetchTimeMs: number;
  };
}

class Semaphore {
  private running = 0;
  private queue: (() => void)[] = [];

  constructor(private max: number) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = async () => {
        this.running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          const next = this.queue.shift();
          if (next) next();
        }
      };

      if (this.running < this.max) {
        run();
      } else {
        this.queue.push(run);
      }
    });
  }
}

class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = 0;

  constructor(
    private failureThreshold = 3,
    private timeoutMs = 60000,
    private successThreshold = 2
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeoutMs;
    }
  }

  getState(): string {
    return this.state;
  }
}

export class SimpleSectorFetcher {
  private semaphore: Semaphore;
  private circuitBreaker: CircuitBreaker;
  private requestCount = 0;

  constructor() {
    this.semaphore = new Semaphore(SECTOR_CONFIG.RATE_LIMITING.MAX_CONCURRENT_REQUESTS);
    this.circuitBreaker = new CircuitBreaker(3, 60000, 2);
  }

  /**
   * Simple logger (no external dependencies)
   */
  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] [SimpleSectorFetcher] ${message}`;
    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }

  /**
   * Validate OHLCV data before using
   */
  private validateOHLCV(bar: OHLCVBar, symbol: string): boolean {
    // Check for negative range (data corruption)
    if (bar.high < bar.low) {
      this.log('WARN', `Invalid OHLC for ${symbol}: high (${bar.high}) < low (${bar.low})`);
      return false;
    }

    // Validate OHLC relationships
    const isValid =
      bar.high >= bar.low &&
      bar.high >= Math.max(bar.open, bar.close) &&
      bar.low <= Math.min(bar.open, bar.close) &&
      bar.volume >= SECTOR_CONFIG.VALIDATION.MIN_VOLUME &&
      bar.close >= SECTOR_CONFIG.VALIDATION.MIN_PRICE;

    // Check for extreme price changes (likely data errors)
    if (bar.open > 0) {
      const priceChange = Math.abs((bar.close - bar.open) / bar.open) * 100;
      if (priceChange > SECTOR_CONFIG.VALIDATION.MAX_PRICE_CHANGE) {
        this.log('WARN', `Extreme price change for ${symbol}: ${priceChange.toFixed(2)}%`);
        return false;
      }
    }

    if (!isValid) {
      this.log('WARN', `Invalid OHLCV data for ${symbol}`, bar);
    }

    return isValid;
  }

  /**
   * Fetch single symbol data from Yahoo Finance
   */
  private async fetchSymbolData(symbol: string): Promise<OHLCVBar[]> {
    return this.circuitBreaker.execute(async () => {
      this.requestCount++;

      // Conservative rate limiting
      await new Promise(resolve =>
        setTimeout(resolve, SECTOR_CONFIG.RATE_LIMITING.BATCH_DELAY_MS)
      );

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SectorAnalyzer/1.0)',
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance API error for ${symbol}: ${response.status}`);
      }

      const data = await response.json();
      const chart = data.chart?.result?.[0];

      if (!chart || !chart.timestamp || !chart.indicators) {
        throw new Error(`Invalid data format for ${symbol}`);
      }

      const quotes = chart.indicators.quote[0];
      const timestamps = chart.timestamp;

      if (!quotes || !quotes.close || !timestamps) {
        throw new Error(`Missing quote data for ${symbol}`);
      }

      // Build OHLCV bars (last 90 days)
      const bars: OHLCVBar[] = [];
      const startIndex = Math.max(0, timestamps.length - 90);

      for (let i = startIndex; i < timestamps.length; i++) {
        if (quotes.close[i] && quotes.high[i] && quotes.low[i] && quotes.open[i]) {
          const bar: OHLCVBar = {
            date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
            open: quotes.open[i] || 0,
            high: quotes.high[i] || 0,
            low: quotes.low[i] || 0,
            close: quotes.close[i] || 0,
            volume: quotes.volume[i] || 0,
            adjustedClose: quotes.adjclose?.[i]
          };

          if (this.validateOHLCV(bar, symbol)) {
            bars.push(bar);
          }
        }
      }

      if (bars.length === 0) {
        throw new Error(`No valid data for ${symbol}`);
      }

      this.log('INFO', `Fetched ${bars.length} bars for ${symbol}`);
      return bars;
    });
  }

  /**
   * Fetch current sector snapshot with conservative concurrency
   */
  async fetchSectorSnapshot(): Promise<SectorSnapshot> {
    const startTime = Date.now();
    this.requestCount = 0;

    try {
      this.log('INFO', `Fetching sector snapshot for ${SECTOR_CONFIG.SYMBOLS.length} symbols`);

      // Fetch all symbols with concurrency control
      const symbolPromises = SECTOR_CONFIG.SYMBOLS.map(symbol =>
        this.semaphore.execute(() => this.fetchSymbolData(symbol))
      );

      const results = await Promise.allSettled(symbolPromises);

      // Process successful results
      const sectors: SectorData[] = [];
      let spyData: SectorData | null = null;

      results.forEach((result, index) => {
        const symbol = SECTOR_CONFIG.SYMBOLS[index];

        if (result.status === 'fulfilled') {
          const bars = result.value;
          if (bars.length >= 2) {
            const latestBar = bars[bars.length - 1];
            const previousBar = bars[bars.length - 2];

            const sectorData: SectorData = {
              symbol,
              name: SECTOR_CONFIG.SECTOR_NAMES[symbol],
              price: latestBar.close,
              change: latestBar.close - previousBar.close,
              changePercent: ((latestBar.close - previousBar.close) / previousBar.close) * 100,
              volume: latestBar.volume,
              ohlc: latestBar
            };

            if (symbol === 'SPY') {
              spyData = sectorData;
            } else {
              sectors.push(sectorData);
            }
          }
        } else {
          this.log('ERROR', `Failed to fetch ${symbol}:`, result.reason);
        }
      });

      if (!spyData || sectors.length === 0) {
        throw new Error('Insufficient data for sector analysis');
      }

      const snapshot: SectorSnapshot = {
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        sectors: sectors.sort((a, b) => b.changePercent - a.changePercent),
        spy: spyData,
        metadata: {
          fetchedAt: new Date().toISOString(),
          source: 'api',
          apiCalls: this.requestCount,
          fetchTimeMs: Date.now() - startTime
        }
      };

      this.log('INFO', `Sector snapshot completed in ${snapshot.metadata.fetchTimeMs}ms, ${snapshot.metadata.apiCalls} API calls`);
      return snapshot;

    } catch (error) {
      this.log('ERROR', 'Failed to fetch sector snapshot:', error);
      throw error;
    }
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): { state: string; failures: number } {
    return {
      state: this.circuitBreaker.getState(),
      failures: this.requestCount
    };
  }

  /**
   * Test the system with minimal symbols
   */
  async testFetch(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      this.log('INFO', 'Testing sector fetch with SPY only');
      const testSymbols = ['SPY'];

      const results = await Promise.allSettled(
        testSymbols.map(symbol => this.semaphore.execute(() => this.fetchSymbolData(symbol)))
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;

      if (successCount === testSymbols.length) {
        return {
          success: true,
          message: `Test successful: ${successCount}/${testSymbols.length} symbols fetched`,
          data: this.getCircuitBreakerStatus()
        };
      } else {
        return {
          success: false,
          message: `Test failed: ${successCount}/${testSymbols.length} symbols fetched`,
          data: this.getCircuitBreakerStatus()
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: this.getCircuitBreakerStatus()
      };
    }
  }
}

export default SimpleSectorFetcher;