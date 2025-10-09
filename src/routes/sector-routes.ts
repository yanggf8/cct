/**
 * Sector Routes - TypeScript
 * RESTful API endpoints for sector rotation analysis
 * Provides comprehensive sector data with indicators and performance metrics
 *
 * @author Sector Rotation Pipeline v1.3
 * @since 2025-10-10
 */

import { createLogger } from '../modules/logging.js';
import { SectorCacheManager } from '../modules/sector-cache-manager.js';
import { SectorDataFetcher } from '../modules/sector-data-fetcher.js';
import { SectorIndicators } from '../modules/sector-indicators.js';
import { ApiResponseFactory } from '../modules/api-v1-responses.js';
import { CircuitBreakerFactory } from '../modules/circuit-breaker.js';

const logger = createLogger('sector-routes');

// Standard sector symbols
const SECTOR_SYMBOLS = [
  'XLK', // Technology
  'XLV', // Health Care
  'XLF', // Financials
  'XLY', // Consumer Discretionary
  'XLC', // Communication Services
  'XLI', // Industrial
  'XLP', // Consumer Staples
  'XLE', // Energy
  'XLU', // Utilities
  'XLRE', // Real Estate
  'XLB', // Materials
  'SPY'  // S&P 500 (Benchmark)
];

/**
 * Sector snapshot response interface
 */
export interface SectorSnapshotResponse {
  timestamp: number;
  date: string;
  sectors: {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    indicators?: {
      obv?: {
        value: number;
        trend: 'up' | 'down' | 'neutral';
        volumeTrend: 'accumulating' | 'distributing' | 'neutral';
      };
      cmf?: {
        value: number;
        signal: 'bullish' | 'bearish' | 'neutral';
      };
      relativeStrength?: {
        value: number;
        trend: 'outperforming' | 'underperforming' | 'neutral';
        benchmark: string;
      };
    };
    marketCap?: number;
    dayHigh?: number;
    dayLow?: number;
  }[];
  summary: {
    totalSectors: number;
    bullishSectors: number;
    bearishSectors: number;
    neutralSectors: number;
    topPerformer: string;
    worstPerformer: string;
    averageChange: number;
  };
  metadata: {
    cacheHit: boolean;
    responseTime: number;
    dataFreshness: number;
    l1CacheHitRate: number;
    l2CacheHitRate: number;
  };
}

/**
 * Initialize sector services
 */
function initializeSectorServices(env: any) {
  const cacheManager = new SectorCacheManager(env);
  const dataFetcher = new SectorDataFetcher(cacheManager);
  const indicators = new SectorIndicators(env);
  const circuitBreaker = CircuitBreakerFactory.getInstance('sector-api');

  return {
    cacheManager,
    dataFetcher,
    indicators,
    circuitBreaker
  };
}

/**
 * GET /api/sectors/snapshot
 * Get comprehensive sector snapshot with real-time data and technical indicators
 */
export async function getSectorSnapshot(request: any, env: any): Promise<Response> {
  const startTime = Date.now();
  let cacheHit = false;

  try {
    const services = initializeSectorServices(env);

    // Check circuit breaker first
    if (!services.circuitBreaker.canExecute()) {
      const body = ApiResponseFactory.error(
        'Service temporarily unavailable due to high error rate',
        'SECTOR_API_CIRCUIT_OPEN'
      );
      return new Response(JSON.stringify(body), { status: 503 });
    }

    // Try to get from cache first
    const cachedSnapshot = await services.cacheManager.getSectorSnapshot();
    if (cachedSnapshot) {
      cacheHit = true;
      const responseTime = Date.now() - startTime;

      const body = ApiResponseFactory.success(
        {
          ...cachedSnapshot,
          metadata: {
            ...cachedSnapshot.metadata,
            cacheHit: true,
            responseTime
          }
        },
        'Sector snapshot retrieved from cache'
      );
      return new Response(JSON.stringify(body), { status: 200 });
    }

    // Fetch fresh data
    const freshData = await services.circuitBreaker.execute(async () => {
      return await fetchFreshSectorData(services);
    });

    const responseTime = Date.now() - startTime;

    // Cache the fresh data
    await services.cacheManager.setSectorSnapshot(freshData);

    const body = ApiResponseFactory.success(
      freshData,
      'Sector snapshot generated successfully'
    );
    return new Response(JSON.stringify(body), { status: 200 });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Error in getSectorSnapshot:', error);

    const body = ApiResponseFactory.error(
      'Failed to generate sector snapshot',
      'SECTOR_SNAPSHOT_ERROR',
      {
        error: error.message,
        responseTime,
        cacheHit
      }
    );
    return new Response(JSON.stringify(body), { status: 500 });
  }
}

/**
 * Fetch fresh sector data from APIs and calculate indicators
 */
async function fetchFreshSectorData(services: {
  cacheManager: SectorCacheManager;
  dataFetcher: SectorDataFetcher;
  indicators: SectorIndicators;
}): Promise<SectorSnapshotResponse> {
  const startTime = Date.now();

  // Fetch sector data
  const sectorResults = await services.dataFetcher.fetchSectorData(SECTOR_SYMBOLS);

  // Process successful results
  const sectorData: any[] = [];
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  for (const [symbol, data] of sectorResults.entries()) {
    if (data) {
      sectorData.push({
        symbol,
        name: data.name || symbol,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        volume: data.volume,
        marketCap: data.marketCap,
        dayHigh: data.dayHigh,
        dayLow: data.dayLow,
        indicators: data.indicators // Will be populated below
      });
    }
  }

  // Calculate indicators for each sector
  for (const sector of sectorData) {
    try {
      // Get historical data for indicator calculations
      const historicalData = await getHistoricalData(sector.symbol, 60); // 60 days of data

      if (historicalData.length >= 20) { // Minimum data for indicators
        // Get SPY data for relative strength calculation
        const spyData = await getHistoricalData('SPY', 60);

        // Calculate all indicators
        const indicators = await services.indicators.calculateAllIndicators(
          sector.symbol,
          historicalData,
          spyData
        );

        if (indicators) {
          sector.indicators = {
            obv: indicators.obv ? {
              value: indicators.obv.obv,
              trend: indicators.obv.obvTrend,
              volumeTrend: indicators.obv.volumeTrend
            } : undefined,
            cmf: indicators.cmf ? {
              value: indicators.cmf.cmf,
              signal: indicators.cmf.moneyFlowSignal
            } : undefined,
            relativeStrength: indicators.relativeStrength ? {
              value: indicators.relativeStrength.relativeStrength,
              trend: indicators.relativeStrength.rsTrend,
              benchmark: indicators.relativeStrength.benchmark
            } : undefined
          };

          // Count signals for summary
          if (indicators.overallSignal === 'bullish') bullishCount++;
          else if (indicators.overallSignal === 'bearish') bearishCount++;
          else neutralCount++;

          // Store indicators in cache
          await services.indicators.storeIndicators(indicators);
        }
      }
    } catch (error) {
      logger.error(`Error calculating indicators for ${sector.symbol}:`, error);
    }
  }

  // Calculate summary statistics
  const averageChange = sectorData.reduce((sum, s) => sum + s.changePercent, 0) / sectorData.length;
  const topPerformer = sectorData.reduce((best, current) =>
    current.changePercent > best.changePercent ? current : best
  );
  const worstPerformer = sectorData.reduce((worst, current) =>
    current.changePercent < worst.changePercent ? current : worst
  );

  // Get cache statistics
  const cacheStats = services.cacheManager.getCacheStats();

  const snapshot: SectorSnapshotResponse = {
    timestamp: Date.now(),
    date: new Date().toISOString().split('T')[0],
    sectors: sectorData,
    summary: {
      totalSectors: sectorData.length,
      bullishSectors: bullishCount,
      bearishSectors: bearishCount,
      neutralSectors: neutralCount,
      topPerformer: topPerformer.symbol,
      worstPerformer: worstPerformer.symbol,
      averageChange: Math.round(averageChange * 100) / 100
    },
    metadata: {
      cacheHit: false,
      responseTime: Date.now() - startTime,
      dataFreshness: 0, // Fresh data
      l1CacheHitRate: cacheStats.l1HitRate,
      l2CacheHitRate: cacheStats.l2HitRate
    }
  };

  return snapshot;
}

/**
 * Get historical data for indicator calculations
 */
async function getHistoricalData(symbol: string, days: number): Promise<any[]> {
  // This would integrate with your existing market data fetching system
  // For now, return empty array - implement based on your existing data sources
  try {
    // Example: Use your existing rate-limited Yahoo Finance integration
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // This would use your existing fetchFromAPI method from sector-data-fetcher.ts
    // For now, return mock data structure
    return [];
  } catch (error) {
    logger.error(`Error fetching historical data for ${symbol}:`, error);
    return [];
  }
}

/**
 * GET /api/sectors/health
 * Health check for sector services
 */
export async function getSectorHealth(request: any, env: any): Promise<Response> {
  try {
    const services = initializeSectorServices(env);
    const cacheStats = services.cacheManager.getCacheStats();
    const circuitBreakerStatus = services.circuitBreaker.getMetrics();

    const health = {
      status: 'healthy',
      timestamp: Date.now(),
      services: {
        cacheManager: {
          status: 'operational',
          l1HitRate: cacheStats.l1HitRate,
          l2HitRate: cacheStats.l2HitRate,
          overallHitRate: cacheStats.overallHitRate,
          cacheSize: cacheStats.l1Size,
          memoryUsage: cacheStats.memoryUsage
        },
        dataFetcher: {
          status: 'operational',
          circuitBreakerStatus: circuitBreakerStatus
        },
        indicators: {
          status: 'operational'
        }
      }
    };

    const isHealthy = health.services.cacheManager.l1HitRate > 0.1 &&
                     circuitBreakerStatus.state !== 'OPEN';

    const body = ApiResponseFactory.success(
      health,
      isHealthy ? 'All sector services operational' : 'Some services degraded'
    );
    return new Response(JSON.stringify(body), { status: 200 });

  } catch (error) {
    logger.error('Error in getSectorHealth:', error);
    const body = ApiResponseFactory.error(
      'Sector health check failed',
      'SECTOR_HEALTH_ERROR'
    );
    return new Response(JSON.stringify(body), { status: 500 });
  }
}

/**
 * GET /api/sectors/symbols
 * Get list of supported sector symbols
 */
export async function getSectorSymbols(request: any, env: any): Promise<Response> {
  try {
    const symbols = SECTOR_SYMBOLS.map(symbol => ({
      symbol,
      type: symbol === 'SPY' ? 'benchmark' : 'sector',
      name: getSectorName(symbol)
    }));

    const body = ApiResponseFactory.success(
      { symbols, total: symbols.length },
      'Sector symbols retrieved successfully'
    );
    return new Response(JSON.stringify(body), { status: 200 });

  } catch (error) {
    logger.error('Error in getSectorSymbols:', error);
    const body = ApiResponseFactory.error(
      'Failed to retrieve sector symbols',
      'SECTOR_SYMBOLS_ERROR'
    );
    return new Response(JSON.stringify(body), { status: 500 });
  }
}

/**
 * Get sector name from symbol
 */
function getSectorName(symbol: string): string {
  const names: Record<string, string> = {
    'XLK': 'Technology',
    'XLV': 'Health Care',
    'XLF': 'Financials',
    'XLY': 'Consumer Discretionary',
    'XLC': 'Communication Services',
    'XLI': 'Industrial',
    'XLP': 'Consumer Staples',
    'XLE': 'Energy',
    'XLU': 'Utilities',
    'XLRE': 'Real Estate',
    'XLB': 'Materials',
    'SPY': 'S&P 500'
  };
  return names[symbol] || symbol;
}

/**
 * Sector routes export
 */
export const sectorRoutes = {
  '/api/v1/sectors/snapshot': getSectorSnapshot,
  '/api/v1/sectors/health': getSectorHealth,
  '/api/v1/sectors/symbols': getSectorSymbols
};

export default sectorRoutes;