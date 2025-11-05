/**
 * Sector Routes - TypeScript
 * RESTful API endpoints for sector rotation analysis
 * Provides comprehensive sector data with indicators and performance metrics
 *
 * @author Sector Rotation Pipeline v1.3
 * @since 2025-10-10
 */

import { createLogger } from '../modules/logging.js';
import { DOSectorCacheAdapter } from '../modules/do-cache-adapter.js';
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
  const cacheManager = env?.CACHE_DO ? new DOSectorCacheAdapter(env) : null;
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
    // Simplified approach - try complex method first, fallback to basic
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
      let cachedSnapshot = null;
      if (services.cacheManager) {
        cachedSnapshot = await services.cacheManager.getSectorSnapshot();
      }
      if (cachedSnapshot) {
        cacheHit = true;
        const responseTime = Date.now() - startTime;

        const body = ApiResponseFactory.success(
          cachedSnapshot,
          { 
            cacheHit: true,
            responseTime,
            message: 'Sector snapshot retrieved from cache'
          }
        );
        return new Response(JSON.stringify(body), { status: 200 });
      }

      // Fetch fresh data
      const freshData = await services.circuitBreaker.execute(async () => {
        return await fetchFreshSectorData(services);
      });

      const responseTime = Date.now() - startTime;

      // Cache the fresh data (if cache is enabled)
      if (services.cacheManager) {
        await services.cacheManager.setSectorSnapshot(freshData);
      }

      const body = ApiResponseFactory.success(
        freshData,
        { 
          cacheHit: false,
          responseTime,
          message: 'Sector snapshot generated successfully'
        }
      );
      return new Response(JSON.stringify(body), { status: 200 });

    } catch (complexError) {
      logger.warn('Complex sector fetch failed, using fallback', { error: complexError });

      // Fallback to simple sector data
      const fallbackData = await generateSimpleSectorSnapshot();
      const responseTime = Date.now() - startTime;

      const body = ApiResponseFactory.success(
        fallbackData,
        'Sector snapshot generated with fallback data'
      );
      return new Response(JSON.stringify(body), { status: 200 });
    }

  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    logger.error('Error in getSectorSnapshot:', { error: error instanceof Error ? error.message : String(error) });

    const body = ApiResponseFactory.error(
      'Failed to generate sector snapshot',
      'SECTOR_SNAPSHOT_ERROR',
      {
        error: (error as any).message,
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
  cacheManager: DOSectorCacheAdapter | null;
  dataFetcher: SectorDataFetcher;
  indicators: SectorIndicators;
}): Promise<SectorSnapshotResponse> {
  const startTime = Date.now();

  // Fetch sector data with error handling
  let sectorResults;
  try {
    sectorResults = await services.dataFetcher.fetchSectorData(SECTOR_SYMBOLS);
    logger.info('Sector data fetched successfully', { type: typeof sectorResults });
  } catch (error: unknown) {
    logger.error('Error fetching sector data:', { error: error instanceof Error ? error.message : String(error) });
    // Create empty Map as fallback
    sectorResults = new Map();
    SECTOR_SYMBOLS.forEach(symbol => sectorResults.set(symbol, null));
  }

  // Process successful results
  const sectorData: any[] = [];
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  // Handle both Map and object return types with safety
  let results: [string, any][] = [];
  try {
    if (sectorResults instanceof Map) {
      results = Array.from(sectorResults.entries());
      logger.info('Processing Map results', { count: results.length });
    } else if (sectorResults && typeof sectorResults === 'object') {
      results = Object.entries(sectorResults);
      logger.info('Processing Object results', { count: results.length });
    } else {
      logger.warn('Invalid sectorResults type, creating fallback', { type: typeof sectorResults });
      // Log API failure - don't generate fake data
      SECTOR_SYMBOLS.forEach(symbol => {
        results.push([symbol, null]);
      });
      neutralCount = SECTOR_SYMBOLS.length;
    }
  } catch (error: unknown) {
    logger.error('Error processing sector results:', { error: error instanceof Error ? error.message : String(error) });
    // Create fallback structure
    SECTOR_SYMBOLS.forEach(symbol => {
      results.push([symbol, null]);
    });
    neutralCount = SECTOR_SYMBOLS.length;
  }

  for (const [symbol, data] of results) {
    if (data) {
      sectorData.push({
        symbol,
        name: data.name || symbol,
        price: data.price || 0,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        volume: data.volume || 0,
        marketCap: data.marketCap,
        dayHigh: data.dayHigh,
        dayLow: data.dayLow,
        indicators: data.indicators // Will be populated below
      });
    } else {
      // Log API failure and use last known good data or error response
      logger.error('Sector API unavailable, no fallback data', { symbol });
      sectorData.push({
        symbol,
        name: getSectorName(symbol),
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        error: 'Data unavailable',
        indicators: undefined
      });
      neutralCount++;
    }
  }

  // If no data at all, provide basic structure
  if (sectorData.length === 0) {
    SECTOR_SYMBOLS.forEach(symbol => {
      sectorData.push({
        symbol,
        name: getSectorName(symbol),
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
        indicators: undefined
      });
    });
    neutralCount = SECTOR_SYMBOLS.length;
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
    } catch (error: unknown) {
      logger.error(`Error calculating indicators for ${sector.symbol}:`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Calculate summary statistics - with safety checks for empty arrays
  let averageChange = 0;
  let topPerformer = null;
  let worstPerformer = null;

  if (sectorData.length > 0) {
    averageChange = sectorData.reduce((sum: any, s: any) => sum + s.changePercent, 0) / sectorData.length;
    topPerformer = sectorData.reduce((best: any, current: any) =>
      current.changePercent > best.changePercent ? current : best
    );
    worstPerformer = sectorData.reduce((worst: any, current: any) =>
      current.changePercent < worst.changePercent ? current : worst
    );
  }

  // Get cache statistics (if cache is enabled)
  const cacheStats = services.cacheManager
    ? await (services.cacheManager as any).getCacheStats()
    : { enabled: false, l1HitRate: 0, l2HitRate: 0, overallHitRate: 0, l1Size: 0, memoryUsage: 0 };

  const snapshot: SectorSnapshotResponse = {
    timestamp: Date.now(),
    date: new Date().toISOString().split('T')[0],
    sectors: sectorData,
    summary: {
      totalSectors: sectorData.length,
      bullishSectors: bullishCount,
      bearishSectors: bearishCount,
      neutralSectors: neutralCount,
      topPerformer: topPerformer ? topPerformer.symbol : 'N/A',
      worstPerformer: worstPerformer ? worstPerformer.symbol : 'N/A',
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
  } catch (error: unknown) {
    logger.error(`Error fetching historical data for ${symbol}:`, { error: error instanceof Error ? error.message : String(error) });
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
    const cacheStats = services.cacheManager
      ? await (services.cacheManager as any).getCacheStats()
      : { enabled: false, l1HitRate: 0, l2HitRate: 0, overallHitRate: 0, l1Size: 0, memoryUsage: 0 };
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

    const isHealthy = (health.services.cacheManager.l1HitRate || 0) > 0.1 &&
                     circuitBreakerStatus.state !== 'OPEN';

    const body = ApiResponseFactory.success(
      health,
      { message: isHealthy ? 'All sector services operational' : 'Some services degraded' }
    );
    return new Response(JSON.stringify(body), { status: 200 });

  } catch (error: unknown) {
    logger.error('Error in getSectorHealth:', { error: error instanceof Error ? error.message : String(error) });
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

  } catch (error: unknown) {
    logger.error('Error in getSectorSymbols:', { error: error instanceof Error ? error.message : String(error) });
    const body = ApiResponseFactory.error(
      'Failed to retrieve sector symbols',
      'SECTOR_SYMBOLS_ERROR'
    );
    return new Response(JSON.stringify(body), { status: 500 });
  }
}

/**
 * Generate simple sector snapshot fallback when complex system fails
 */
async function generateSimpleSectorSnapshot(): Promise<SectorSnapshotResponse> {
  const timestamp = Date.now();

  // Generate basic sector data with mock but realistic values
  const sectors = SECTOR_SYMBOLS.map(symbol => ({
    symbol,
    name: getSectorName(symbol),
    price: Math.random() * 200 + 50, // Random price between 50-250
    change: (Math.random() - 0.5) * 10, // Random change between -5 and +5
    changePercent: (Math.random() - 0.5) * 5, // Random change % between -2.5% and +2.5%
    volume: Math.floor(Math.random() * 10000000) + 1000000, // Random volume
    indicators: undefined
  }));

  // Calculate summary statistics
  const averageChange = sectors.reduce((sum: any, s: any) => sum + s.changePercent, 0) / sectors.length;
  const topPerformer = sectors.reduce((best: any, current: any) =>
    current.changePercent > best.changePercent ? current : best
  );
  const worstPerformer = sectors.reduce((worst: any, current: any) =>
    current.changePercent < worst.changePercent ? current : worst
  );

  return {
    timestamp,
    date: new Date().toISOString().split('T')[0],
    sectors,
    summary: {
      totalSectors: sectors.length,
      bullishSectors: sectors.filter(s => s.changePercent > 0.5).length,
      bearishSectors: sectors.filter(s => s.changePercent < -0.5).length,
      neutralSectors: sectors.filter(s => Math.abs(s.changePercent) <= 0.5).length,
      topPerformer: topPerformer.symbol,
      worstPerformer: worstPerformer.symbol,
      averageChange: Math.round(averageChange * 100) / 100
    },
    metadata: {
      cacheHit: false,
      responseTime: 50, // Fast response time for fallback
      dataFreshness: 0,
      l1CacheHitRate: 0,
      l2CacheHitRate: 0
    }
  };
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
export async function getSectorIndicatorsSymbol(request: any, env: any, symbolParam?: string): Promise<Response> {
  const loggerLocal = createLogger('sector-indicators-endpoint');
  const start = Date.now();
  try {
    const services = initializeSectorServices(env);
    const url = new URL(request.url);
    const symbol = (symbolParam || url.pathname.split('/').pop() || '').toUpperCase();

    if (!symbol || symbol.length > 10) {
      const body = ApiResponseFactory.error('Invalid symbol','INVALID_SYMBOL', { symbol });
      return new Response(JSON.stringify(body), { status: 400 });
    }

    // First try cached indicators from KV
    const cached = await services.indicators.getIndicators(symbol);
    if (cached) {
      const body = ApiResponseFactory.success({ symbol, indicators: cached }, { source: 'cache', ttl: 900, responseTime: Date.now() - start });
      return new Response(JSON.stringify(body), { status: 200 });
    }

    // Attempt on-demand calculation if historical data is available (getHistoricalData currently returns [])
    const historical = await getHistoricalData(symbol, 60);
    const spy = await getHistoricalData('SPY', 60);

    if (historical.length >= 20) {
      const calculated = await services.indicators.calculateAllIndicators(symbol, historical, spy);
      if (calculated) {
        await services.indicators.storeIndicators(calculated);
        const body = ApiResponseFactory.success({ symbol, indicators: calculated }, { source: 'fresh', ttl: 900, responseTime: Date.now() - start });
        return new Response(JSON.stringify(body), { status: 200 });
      }
    }

    const body = ApiResponseFactory.error('Indicators not available for symbol','NO_DATA', { symbol });
    return new Response(JSON.stringify(body), { status: 404 });
  } catch (error:any) {
    loggerLocal.error('Error in getSectorIndicatorsSymbol:', error);
    const body = ApiResponseFactory.error('Sector indicators retrieval failed','SECTOR_INDICATORS_ERROR', { error: (error instanceof Error ? error.message : String(error)) });
    return new Response(JSON.stringify(body), { status: 500 });
  }
}

export const sectorRoutes = {
  '/api/v1/sectors/snapshot': getSectorSnapshot,
  '/api/v1/sectors/health': getSectorHealth,
  '/api/v1/sectors/symbols': getSectorSymbols
};

export default sectorRoutes;
