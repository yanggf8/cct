/**
 * Real Analytics Data Service
 * Provides real data for analytics routes - eliminates all Math.random() mock data
 */

import { createLogger } from './logging.js';
import { YahooFinanceIntegration } from './real-data-integration.js';

const logger = createLogger('real-analytics-data');

const yahooFinance = new YahooFinanceIntegration();

// In-memory cache for computed metrics
const metricsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

export interface RealModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  confidence_level: number;
  prediction_count: number;
  last_updated: string;
}

export interface RealMarketData {
  indices: {
    sp500: { value: number | null; change: number | null };
    nasdaq: { value: number | null; change: number | null };
    dow: { value: number | null; change: number | null };
  };
  vix: number | null;
  timestamp: string;
}

/**
 * Fetch real market indices data
 */
export async function fetchRealMarketIndices(): Promise<RealMarketData> {
  const cacheKey = 'market-indices';
  const cached = metricsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const symbols = ['^GSPC', '^IXIC', '^DJI', '^VIX'];
    const data = await yahooFinance.fetchMarketData(symbols);

    const result: RealMarketData = {
      indices: {
        sp500: { value: data[0]?.price ?? null, change: data[0]?.changePercent ?? null },
        nasdaq: { value: data[1]?.price ?? null, change: data[1]?.changePercent ?? null },
        dow: { value: data[2]?.price ?? null, change: data[2]?.changePercent ?? null }
      },
      vix: data[3]?.price ?? null,
      timestamp: new Date().toISOString()
    };

    metricsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    logger.error('Failed to fetch real market indices', { error });
    throw new Error('Unable to fetch real market data');
  }
}

/**
 * Fetch real sector data from ETFs
 */
export async function fetchRealSectorData(): Promise<Array<{
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
}>> {
  const sectorETFs = [
    { symbol: 'XLK', name: 'Technology' },
    { symbol: 'XLV', name: 'Health Care' },
    { symbol: 'XLF', name: 'Financials' },
    { symbol: 'XLE', name: 'Energy' },
    { symbol: 'XLY', name: 'Consumer Discretionary' },
    { symbol: 'XLI', name: 'Industrials' },
    { symbol: 'XLB', name: 'Materials' },
    { symbol: 'XLU', name: 'Utilities' },
    { symbol: 'XLRE', name: 'Real Estate' },
    { symbol: 'XLC', name: 'Communication Services' },
    { symbol: 'XLP', name: 'Consumer Staples' }
  ];

  const cacheKey = 'sector-data';
  const cached = metricsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const symbols = sectorETFs.map(s => s.symbol);
    const data = await yahooFinance.fetchMarketData(symbols);

    const result = sectorETFs.map((sector, i) => ({
      symbol: sector.symbol,
      name: sector.name,
      price: data[i]?.price ?? null,
      change: data[i]?.change ?? null,
      changePercent: data[i]?.changePercent ?? null,
      volume: data[i]?.volume ?? null
    }));

    metricsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    logger.error('Failed to fetch real sector data', { error });
    throw new Error('Unable to fetch real sector data');
  }
}

/**
 * Get stored model performance metrics from historical predictions
 * Returns metrics based on actual prediction history when available
 * Returns explicit "no_data" status when historical data is unavailable
 */
export async function getStoredModelMetrics(modelName: string, env: any): Promise<RealModelMetrics & { data_status: string }> {
  const cacheKey = `model-metrics:${modelName}`;
  const cached = metricsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // TODO: Implement actual retrieval from model validation storage
  // For now, return explicit "no historical data" status
  const metrics = {
    accuracy: null as number | null,
    precision: null as number | null,
    recall: null as number | null,
    f1_score: null as number | null,
    confidence_level: null as number | null,
    prediction_count: 0,
    last_updated: null as string | null,
    data_status: 'no_historical_data',
    notice: 'Model validation metrics require historical prediction tracking to be implemented'
  };

  metricsCache.set(cacheKey, { data: metrics, timestamp: Date.now() });
  return metrics as any;
}

/**
 * Calculate data quality score based on actual data freshness and completeness
 */
export function calculateDataQualityScore(data: {
  dataAge?: number;
  fieldsPresent?: number;
  totalFields?: number;
  sourceReliability?: number;
}): number {
  const { dataAge = 0, fieldsPresent = 0, totalFields = 1, sourceReliability = 1 } = data;

  const freshnessScore = Math.max(0, 1 - (dataAge / 3600000)); // Degrades over 1 hour
  const completenessScore = fieldsPresent / totalFields;
  const reliabilityScore = sourceReliability;

  return (freshnessScore * 0.3 + completenessScore * 0.4 + reliabilityScore * 0.3);
}
