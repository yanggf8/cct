/**
 * Sector Rotation Routes (API v1)
 * RESTful API endpoints for sector rotation analysis
 * Institutional-grade money flow tracking and relative strength analysis
 */

import {
  ApiResponseFactory,
  ProcessingTimer,
  HttpStatus
} from '../modules/api-v1-responses.js';
import {
  validateApiKey,
  generateRequestId
} from './api-v1.js';
import { SectorDataFetcher, SECTOR_SYMBOLS } from '../modules/sector-data-fetcher.js';
import { SectorCacheManager } from '../modules/sector-cache-manager.js';
import { SectorIndicators } from '../modules/sector-indicators.js';
import { createLogger } from '../modules/logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('sector-rotation-routes');

/**
 * Handle all sector rotation routes
 */
export async function handleSectorRotationRoutes(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const method = request.method;
  const requestId = headers['X-Request-ID'] || generateRequestId();

  // Sector rotation endpoints require API key authentication
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Invalid or missing API key',
          'UNAUTHORIZED',
          { requestId }
        )
      ),
      {
        status: HttpStatus.UNAUTHORIZED,
        headers,
      }
    );
  }

  try {
    // GET /api/v1/sectors/snapshot - Complete sector rotation snapshot
    if (path === '/api/v1/sectors/snapshot' && method === 'GET') {
      return await handleSectorSnapshot(request, env, headers, requestId);
    }

    // GET /api/v1/sectors/health - Sector rotation system health
    if (path === '/api/v1/sectors/health' && method === 'GET') {
      return await handleSectorHealth(request, env, headers, requestId);
    }

    // GET /api/v1/sectors/symbols - Get available sector symbols
    if (path === '/api/v1/sectors/symbols' && method === 'GET') {
      return await handleSectorSymbols(request, env, headers, requestId);
    }

    // GET /api/v1/sectors/indicators/:symbol - Get indicators for specific sector
    if (path.startsWith('/api/v1/sectors/indicators/') && method === 'GET') {
      return await handleSectorIndicators(request, env, path, headers, requestId);
    }

    // GET /api/v1/sectors/performance - Get sector performance analysis
    if (path === '/api/v1/sectors/performance' && method === 'GET') {
      return await handleSectorPerformance(request, env, headers, requestId);
    }

    // GET /api/v1/sectors/relative-strength - Get relative strength analysis
    if (path === '/api/v1/sectors/relative-strength' && method === 'GET') {
      return await handleRelativeStrength(request, env, headers, requestId);
    }

    // Method not allowed for existing paths
    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          `Method ${method} not allowed for ${path}`,
          'METHOD_NOT_ALLOWED',
          { requestId }
        )
      ),
      {
        status: HttpStatus.METHOD_NOT_ALLOWED,
        headers,
      }
    );
  } catch (error) {
    logger.error('SectorRotationRoutes Error', error, { requestId, path, method });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Internal server error',
          'INTERNAL_ERROR',
          {
            requestId,
            path,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle sector snapshot endpoint
 * GET /api/v1/sectors/snapshot
 */
async function handleSectorSnapshot(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const url = new URL(request.url);

  try {
    // Parse query parameters
    const useCache = url.searchParams.get('cache') !== 'false'; // Cache enabled by default
    const includeIndicators = url.searchParams.get('indicators') !== 'false'; // Include indicators by default

    // Initialize components
    const cacheManager = new SectorCacheManager(env);
    const dataFetcher = new SectorDataFetcher(cacheManager);
    const indicators = new SectorIndicators(env);

    // Check cache first (if enabled)
    if (useCache) {
      const cacheKey = `sector_snapshot_latest`;
      const cached = await cacheManager.getSectorData(cacheKey);

      if (cached) {
        logger.info('SectorSnapshot', 'Cache hit', { requestId });

        return new Response(
          JSON.stringify(
            ApiResponseFactory.cached(cached, 'hit', {
              source: 'cache',
              ttl: 300, // 5 minutes
              requestId,
              processingTime: timer.getElapsedMs(),
            })
          ),
          { status: HttpStatus.OK, headers }
        );
      }
    }

    // Fetch fresh sector data
    const sectorResults = await dataFetcher.fetchSectorData(SECTOR_SYMBOLS);

    // Convert results to array and filter successful fetches
    const sectors = Array.from(sectorResults.entries())
      .filter(([_, result]) => result !== null)
      .map(([symbol, data]) => ({
        symbol,
        ...data,
        lastUpdated: Date.now()
      }));

    if (sectors.length === 0) {
      throw new Error('No sector data available');
    }

    // Calculate performance metrics
    const benchmarkData = sectorResults.get('SPY');
    let relativeStrengthData: any[] = [];

    if (benchmarkData && includeIndicators) {
      // Calculate relative strength for all sectors vs SPY
      for (const [symbol, sectorData] of sectorResults.entries()) {
        if (symbol !== 'SPY' && sectorData) {
          const returnDiff = ((sectorData.changePercent || 0) - (benchmarkData.changePercent || 0));
          relativeStrengthData.push({
            symbol,
            relativeStrength: returnDiff,
            performance: sectorData.changePercent || 0,
            benchmarkPerformance: benchmarkData.changePercent || 0,
            signal: returnDiff > 0.5 ? 'outperforming' : returnDiff < -0.5 ? 'underperforming' : 'neutral'
          });
        }
      }

      // Sort by relative strength
      relativeStrengthData.sort((a, b) => b.relativeStrength - a.relativeStrength);
    }

    // Build comprehensive snapshot
    const snapshot = {
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      sectors: sectors,
      summary: {
        totalSectors: sectors.length,
        benchmark: benchmarkData,
        topPerformers: sectors
          .filter(s => s.symbol !== 'SPY')
          .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
          .slice(0, 3),
        worstPerformers: sectors
          .filter(s => s.symbol !== 'SPY')
          .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))
          .slice(0, 3),
      },
      relativeStrength: relativeStrengthData,
      marketSignals: {
        overallTrend: determineOverallTrend(sectors),
        riskOnRiskOff: determineRiskOnRiskOff(relativeStrengthData),
        sectorRotation: detectSectorRotation(relativeStrengthData)
      },
      metadata: {
        source: 'yahoo_finance',
        dataFreshness: calculateDataFreshness(sectors),
        cacheHitRate: cacheManager.getMetrics().overallHitRate,
        fetchMetrics: dataFetcher.getStats()
      }
    };

    // Cache the result (if enabled)
    if (useCache) {
      await cacheManager.setSectorData('sector_snapshot_latest', snapshot);
    }

    logger.info('SectorSnapshot', 'Data retrieved', {
      sectorCount: sectors.length,
      topPerformer: snapshot.summary.topPerformers[0]?.symbol,
      processingTime: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(snapshot, {
          source: 'fresh',
          ttl: 300,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    logger.error('SectorSnapshot Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to retrieve sector snapshot',
          'DATA_ERROR',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle sector health endpoint
 * GET /api/v1/sectors/health
 */
async function handleSectorHealth(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    // Initialize components
    const cacheManager = new SectorCacheManager(env);
    const dataFetcher = new SectorDataFetcher(cacheManager);

    // Test each component
    const cacheStats = cacheManager.getMetrics();
    const cacheHealth = { status: 'healthy', metrics: cacheStats };
    const dataFetcherStats = dataFetcher.getStats();
    const dataFetcherHealth = { status: 'healthy', details: { status: 'healthy', metrics: dataFetcherStats } };
    const dataFetcherHealthStatus = dataFetcher.getHealthStatus();
    const circuitBreakerMetrics = dataFetcherHealthStatus.circuitBreaker;

    // Calculate overall status
    const componentHealth = [
      cacheStats.overallHitRate >= 0, // Cache is working
      dataFetcherStats.successRate >= 0.8, // Data fetcher working
      dataFetcherHealthStatus.semaphore.availablePermits >= 0, // Semaphore working
      circuitBreakerMetrics.state !== 'OPEN' // Circuit breaker not open
    ];

    const overallStatus = componentHealth.filter(Boolean).length >= 3 ? 'healthy' :
                         componentHealth.filter(Boolean).length >= 2 ? 'degraded' : 'unhealthy';

    const response = {
      status: overallStatus,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      components: {
        cache: cacheHealth,
        dataFetcher: dataFetcherHealth,
        semaphore: dataFetcherHealthStatus.semaphore,
        circuitBreaker: circuitBreakerMetrics
      },
      metrics: {
        responseTimeMs: timer.getElapsedMs(),
        cacheHitRate: cacheStats.overallHitRate,
        fetchSuccessRate: dataFetcherStats.successRate,
        activeConnections: 4 - dataFetcherHealthStatus.semaphore.availablePermits,
        queuedRequests: dataFetcherHealthStatus.semaphore.queueLength
      },
      capabilities: {
        sectorCount: SECTOR_SYMBOLS.length,
        maxConcurrency: 4,
        cacheLayers: ['L1_Memory', 'L2_KV'],
        indicators: ['OBV', 'CMF', 'Relative_Strength']
      }
    };

    logger.info('SectorHealth', 'Health check completed', {
      overallStatus,
      processingTime: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 300, // 5 minutes
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    logger.error('SectorHealth Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to perform sector health check',
          'HEALTH_CHECK_ERROR',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle sector symbols endpoint
 * GET /api/v1/sectors/symbols
 */
async function handleSectorSymbols(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    const symbols = SECTOR_SYMBOLS.map(symbol => ({
      symbol,
      name: getSectorName(symbol),
      type: symbol === 'SPY' ? 'benchmark' : 'sector_etf',
      description: getSectorDescription(symbol)
    }));

    const response = {
      symbols,
      summary: {
        totalSymbols: symbols.length,
        sectorCount: symbols.filter(s => s.type === 'sector_etf').length,
        benchmark: symbols.find(s => s.type === 'benchmark')
      }
    };

    logger.info('SectorSymbols', 'Symbols retrieved', {
      count: symbols.length,
      processingTime: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 3600, // 1 hour
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    logger.error('SectorSymbols Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to retrieve sector symbols',
          'DATA_ERROR',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle sector indicators endpoint
 * GET /api/v1/sectors/indicators/:symbol
 */
async function handleSectorIndicators(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    // Extract symbol from path
    const symbol = path.split('/').pop()?.toUpperCase();

    if (!symbol) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'Symbol is required',
            'VALIDATION_ERROR',
            { requestId }
          )
        ),
        { status: HttpStatus.BAD_REQUEST, headers }
      );
    }

    // Validate symbol
    if (!SECTOR_SYMBOLS.includes(symbol as any)) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            `Invalid symbol: ${symbol}. Must be one of: ${SECTOR_SYMBOLS.join(', ')}`,
            'VALIDATION_ERROR',
            { requestId }
          )
        ),
        { status: HttpStatus.BAD_REQUEST, headers }
      );
    }

    // Initialize indicators calculator
    const indicators = new SectorIndicators(env);

    // Try to get cached indicators first
    const cachedIndicators = await indicators.getIndicators(symbol);

    if (cachedIndicators) {
      logger.info('SectorIndicators', 'Cache hit', { symbol, requestId });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cachedIndicators, 'hit', {
            source: 'cache',
            ttl: 600, // 10 minutes
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // If not cached, return placeholder (full implementation would fetch historical data)
    const response = {
      symbol,
      timestamp: Date.now(),
      message: 'Historical data calculation not implemented in MVP',
      note: 'This would calculate OBV, CMF, and Relative Strength indicators using historical price data'
    };

    logger.info('SectorIndicators', 'Placeholder response', { symbol, requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 600,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    logger.error('SectorIndicators Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to retrieve sector indicators',
          'DATA_ERROR',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle sector performance endpoint
 * GET /api/v1/sectors/performance
 */
async function handleSectorPerformance(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    // This would provide detailed performance analysis
    const response = {
      message: 'Sector performance analysis endpoint',
      note: 'This would provide detailed performance metrics, trends, and analysis',
      availableMetrics: [
        'daily_performance',
        'weekly_performance',
        'monthly_performance',
        'year_to_date',
        'volatility_metrics',
        'correlation_analysis'
      ]
    };

    logger.info('SectorPerformance', 'Placeholder response', { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 300,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    logger.error('SectorPerformance Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to retrieve sector performance',
          'DATA_ERROR',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle relative strength endpoint
 * GET /api/v1/sectors/relative-strength
 */
async function handleRelativeStrength(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    // This would provide comprehensive relative strength analysis
    const response = {
      message: 'Relative strength analysis endpoint',
      note: 'This would provide comprehensive relative strength analysis vs benchmark',
      availableAnalysis: [
        'rs_ratio_analysis',
        'momentum_analysis',
        'leadership_analysis',
        'trend_strength',
        'rotation_signals'
      ]
    };

    logger.info('RelativeStrength', 'Placeholder response', { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 300,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    logger.error('RelativeStrength Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to retrieve relative strength analysis',
          'DATA_ERROR',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

// Helper functions
function determineOverallTrend(sectors: any[]): 'bullish' | 'bearish' | 'neutral' {
  if (sectors.length === 0) return 'neutral';

  const positiveCount = sectors.filter(s => (s.changePercent || 0) > 0).length;
  const negativeCount = sectors.filter(s => (s.changePercent || 0) < 0).length;
  const totalCount = sectors.length;

  if (positiveCount / totalCount > 0.6) return 'bullish';
  if (negativeCount / totalCount > 0.6) return 'bearish';
  return 'neutral';
}

function determineRiskOnRiskOff(relativeStrength: any[]): 'risk_on' | 'risk_off' | 'neutral' {
  if (relativeStrength.length === 0) return 'neutral';

  // Cyclical sectors (risk-on): XLK, XLY, XLI, XLC
  // Defensive sectors (risk-off): XLV, XLP, XLU, XLE
  const cyclicalSymbols = ['XLK', 'XLY', 'XLI', 'XLC'];
  const defensiveSymbols = ['XLV', 'XLP', 'XLU', 'XLE'];

  const cyclicalPerformance = relativeStrength
    .filter(s => cyclicalSymbols.includes(s.symbol))
    .reduce((sum, s) => sum + s.relativeStrength, 0) / cyclicalSymbols.length;

  const defensivePerformance = relativeStrength
    .filter(s => defensiveSymbols.includes(s.symbol))
    .reduce((sum, s) => sum + s.relativeStrength, 0) / defensiveSymbols.length;

  if (cyclicalPerformance > defensivePerformance + 0.5) return 'risk_on';
  if (defensivePerformance > cyclicalPerformance + 0.5) return 'risk_off';
  return 'neutral';
}

function detectSectorRotation(relativeStrength: any[]): 'active' | 'minimal' | 'neutral' {
  if (relativeStrength.length < 2) return 'neutral';

  const strengths = relativeStrength.map(s => s.relativeStrength);
  const maxStrength = Math.max(...strengths);
  const minStrength = Math.min(...strengths);
  const spread = maxStrength - minStrength;

  if (spread > 2.0) return 'active';
  if (spread > 1.0) return 'minimal';
  return 'neutral';
}

function calculateDataFreshness(sectors: any[]): number {
  if (sectors.length === 0) return 0;

  const now = Date.now();
  const ages = sectors.map(s => now - (s.timestamp || 0));
  const avgAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;

  return Math.max(0, 1 - (avgAge / (5 * 60 * 1000))); // Freshness over 5 minutes
}

function getSectorName(symbol: string): string {
  const names: Record<string, string> = {
    'XLK': 'Technology Select Sector SPDR Fund',
    'XLV': 'Health Care Select Sector SPDR Fund',
    'XLF': 'Financial Select Sector SPDR Fund',
    'XLY': 'Consumer Discretionary Select Sector SPDR Fund',
    'XLC': 'Communication Services Select Sector SPDR Fund',
    'XLI': 'Industrial Select Sector SPDR Fund',
    'XLP': 'Consumer Staples Select Sector SPDR Fund',
    'XLE': 'Energy Select Sector SPDR Fund',
    'XLU': 'Utilities Select Sector SPDR Fund',
    'XLRE': 'Real Estate Select Sector SPDR Fund',
    'XLB': 'Materials Select Sector SPDR Fund',
    'SPY': 'SPDR S&P 500 ETF Trust'
  };
  return names[symbol] || symbol;
}

function getSectorDescription(symbol: string): string {
  const descriptions: Record<string, string> = {
    'XLK': 'Companies from the technology sector, including software, hardware, and IT services',
    'XLV': 'Companies from the health care sector, including pharmaceuticals, biotechnology, and health care providers',
    'XLF': 'Companies from the financial sector, including banks, insurance companies, and investment firms',
    'XLY': 'Companies from the consumer discretionary sector, including retail, automotive, and entertainment',
    'XLC': 'Companies from the communication services sector, including telecom, media, and internet services',
    'XLI': 'Companies from the industrial sector, including manufacturing, aerospace, and transportation',
    'XLP': 'Companies from the consumer staples sector, including food, beverages, and household products',
    'XLE': 'Companies from the energy sector, including oil, gas, and alternative energy companies',
    'XLU': 'Companies from the utilities sector, including electric, gas, and water utilities',
    'XLRE': 'Companies from the real estate sector, including REITs and real estate services',
    'XLB': 'Companies from the materials sector, including chemicals, metals, and mining',
    'SPY': 'Benchmark ETF tracking the S&P 500 index'
  };
  return descriptions[symbol] || 'Sector ETF';
}