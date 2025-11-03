/**
 * Yahoo Finance Integration Module
 *
 * Provides simplified Yahoo Finance API integration for market structure indicators.
 * Uses the existing rate limiter and follows established patterns from the codebase.
 *
 * Features:
 * - Rate-limited Yahoo Finance API calls
 * - Simple market data fetching
 * - Error handling and retry logic
 * - Support for key market indicators (VIX, SPY, Dollar Index, etc.)
 *
 * @author Market Drivers Pipeline - Phase 2 Day 3
 * @since 2025-10-10
 */

import { createLogger } from './logging.js';
import { rateLimitedFetch, configureYahooRateLimiter } from './rate-limiter.js';
import { getMarketDataConfig } from './config.js';

const logger = createLogger('yahoo-finance-integration');

/**
 * Yahoo Finance API base URL
 */
const YAHOO_FINANCE_API_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

/**
 * Market data interface
 */
export interface MarketData {
  symbol: string;
  price: number;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketTime: number;
  currency: string;
  marketState: string;
  exchangeName: string;
  quoteType: string;
  success: boolean;
  timestamp: number;
}

/**
 * Get market data for a single symbol
 */
export async function getMarketData(symbol: string): Promise<MarketData | null> {
  try {
    // Ensure rate limiter reflects current config each call
    const cfg = getMarketDataConfig();
    configureYahooRateLimiter(cfg.RATE_LIMIT_REQUESTS_PER_MINUTE, cfg.RATE_LIMIT_WINDOW_MS);

    logger.debug(`Fetching market data for ${symbol}`);

    const url = `${YAHOO_FINANCE_API_URL}/${symbol}?interval=1d&range=1d`;

    const response = await rateLimitedFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      logger.warn(`Yahoo Finance API returned ${response.status} for ${symbol}`, {
        status: response.status,
        statusText: response.statusText,
        symbol
      });
      return null;
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]) {
      logger.warn(`No data returned from Yahoo Finance for ${symbol}`, { symbol });
      return null;
    }

    const result = data.chart.result[0];
    const meta = result.meta || {};
    const quotes = result.indicators?.quote?.[0] || [];
    const latestQuote = quotes[0] || {};

    // Extract price data
    const price = meta.regularMarketPrice || latestQuote.close || meta.previousClose || 0;
    const change = meta.regularMarketChange || 0;
    const changePercent = meta.regularMarketChangePercent || 0;

    const marketData: MarketData = {
      symbol,
      price,
      regularMarketPrice: price,
      regularMarketChange: change,
      regularMarketChangePercent: changePercent,
      regularMarketTime: meta.regularMarketTime || Date.now(),
      currency: meta.currency || 'USD',
      marketState: meta.marketState || 'CLOSED',
      exchangeName: meta.exchangeName || 'NASDAQ',
      quoteType: meta.quoteType || 'EQUITY',
      success: true,
      timestamp: Date.now(),
    };

    logger.debug(`Successfully fetched market data for ${symbol}`, {
      symbol,
      price,
      change: changePercent,
      marketState: marketData.marketState
    });

    return marketData;

  } catch (error: unknown) {
    logger.error(`Failed to fetch market data for ${symbol}:`, { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Get market data for multiple symbols (batch processing)
 */
export async function getBatchMarketData(symbols: string[]): Promise<Record<string, MarketData | null>> {
  const results: Record<string, MarketData | null> = {};

  logger.info(`Fetching batch market data for ${symbols.length} symbols`);

  // Process symbols with delays to avoid rate limits
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];

    try {
      // Add delay between requests (200ms minimum)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const marketData = await getMarketData(symbol);
      results[symbol] = marketData;

      logger.debug(`Batch fetch progress: ${i + 1}/${symbols.length} completed`);

    } catch (error: unknown) {
      logger.error(`Failed to fetch market data for ${symbol} in batch:`, { error: error instanceof Error ? error.message : String(error) });
      results[symbol] = null;
    }
  }

  const successCount = Object.values(results).filter(data => data !== null).length;
  logger.info(`Batch fetch completed: ${successCount}/${symbols.length} successful`);

  return results;
}

/**
 * Get specific market structure indicators
 */
export async function getMarketStructureIndicators(): Promise<{
  vix?: MarketData;
  spy?: MarketData;
  dollarIndex?: MarketData;
  tenYearTreasury?: MarketData;
  twoYearTreasury?: MarketData;
  qqq?: MarketData;
}> {
  const symbols = [
    '^VIX',        // VIX
    'SPY',         // S&P 500 ETF
    'DX-Y.NYB',    // US Dollar Index
    'TNX',         // 10-Year Treasury Yield
    'TYX',         // 2-Year Treasury Yield
    'QQQ',         // NASDAQ 100 ETF
  ];

  try {
    // Configure rate limiter dynamically from config
    const cfg = getMarketDataConfig();
    configureYahooRateLimiter(cfg.RATE_LIMIT_REQUESTS_PER_MINUTE, cfg.RATE_LIMIT_WINDOW_MS);

    const batchData = await getBatchMarketData(symbols);

    return {
      vix: batchData['^VIX'],
      spy: batchData['SPY'],
      dollarIndex: batchData['DX-Y.NYB'],
      tenYearTreasury: batchData['TNX'],
      twoYearTreasury: batchData['TYX'],
      qqq: batchData['QQQ'],
    };

  } catch (error: unknown) {
    logger.error('Failed to fetch market structure indicators:', { error: error instanceof Error ? error.message : String(error) });
    return {};
  }
}

/**
 * Health check for Yahoo Finance API
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  details: any;
}> {
  try {
    // Test with a simple symbol (SPY)
    const testData = await getMarketData('SPY');

    const isHealthy = testData !== null && testData.success;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      details: {
        testSymbol: 'SPY',
        testDataAvailable: testData !== null,
        success: testData?.success || false,
        timestamp: testData?.timestamp || null,
        apiEndpoint: YAHOO_FINANCE_API_URL
      }
    };

  } catch (error: unknown) {
    return {
      status: 'unhealthy',
      details: {
        error: (error instanceof Error ? error.message : String(error)),
        apiEndpoint: YAHOO_FINANCE_API_URL
      }
    };
  }
}

/**
 * Format market data for display
 */
export function formatMarketData(data: MarketData): string {
  const changeSymbol = data.regularMarketChange >= 0 ? '+' : '';
  const changeText = `${changeSymbol}${data.regularMarketChange.toFixed(2)} (${changeSymbol}${data.regularMarketChangePercent.toFixed(2)}%)`;

  return `${data.symbol}: $${data.price.toFixed(2)} ${changeText}`;
}

/**
 * Check if market is open
 */
export function isMarketOpen(marketData?: MarketData): boolean {
  if (!marketData) return false;

  const marketState = marketData.marketState.toUpperCase();
  return marketState === 'REGULAR' || marketState === 'PRE' || marketState === 'POST';
}

/**
 * Get market status description
 */
export function getMarketStatus(marketData?: MarketData): string {
  if (!marketData) return 'Unknown';

  const state = marketData.marketState.toUpperCase();

  switch (state) {
    case 'REGULAR':
      return 'Market Open';
    case 'PRE':
      return 'Pre-Market';
    case 'POST':
      return 'After Hours';
    case 'CLOSED':
      return 'Market Closed';
    default:
      return state;
  }
}

export async function getHistoricalData(symbol: string, startDate: string, endDate: string): Promise<any[]> {
  try {
    const cfg = getMarketDataConfig();
    configureYahooRateLimiter(cfg.RATE_LIMIT_REQUESTS_PER_MINUTE, cfg.RATE_LIMIT_WINDOW_MS);

    const period1 = Math.floor(new Date(startDate).getTime() / 1000);
    const period2 = Math.floor(new Date(endDate).getTime() / 1000);
    const url = `${YAHOO_FINANCE_API_URL}/${symbol}?interval=1d&period1=${period1}&period2=${period2}`;

    const response = await rateLimitedFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      logger.warn(`Yahoo Finance historical API returned ${response.status} for ${symbol}`, {
        status: response.status,
        statusText: response.statusText,
        symbol
      });
      return [];
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const opens: number[] = quotes.open || [];
    const highs: number[] = quotes.high || [];
    const lows: number[] = quotes.low || [];
    const closes: number[] = quotes.close || [];
    const volumes: number[] = quotes.volume || [];

    const bars: any[] = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      open: opens[i] ?? null,
      high: highs[i] ?? null,
      low: lows[i] ?? null,
      close: closes[i] ?? null,
      volume: volumes[i] ?? null,
    })).filter(b => b.close !== null);

    return bars;
  } catch (error: unknown) {
    logger.error(`Failed to fetch historical data for ${symbol}:`, { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

export default {
  getMarketData,
  getBatchMarketData,
  getMarketStructureIndicators,
  healthCheck,
  formatMarketData,
  isMarketOpen,
  getMarketStatus,
};