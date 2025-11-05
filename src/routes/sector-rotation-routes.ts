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
  generateRequestId,
  parseQueryParams
} from './api-v1.js';
import { executeSectorRotationAnalysis, getCachedSectorRotationResults, SPDR_ETFs } from '../modules/sector-rotation-workflow.js';
import { createLogger } from '../modules/logging.js';
import type { CloudflareEnvironment, SectorRotationResult } from '../types.js';

const logger = createLogger('sector-rotation-routes');

/**
 * Handle sector rotation analysis routes
 */
export async function handleSectorRotationRoutes(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const method = request.method;
  const url = new URL(request.url);
  const requestId = headers['X-Request-ID'] || generateRequestId();

  // Validate API key for protected endpoints
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
    // POST /api/v1/sector-rotation/analysis - Run complete sector rotation analysis
    if (path === '/api/v1/sector-rotation/analysis' && method === 'POST') {
      return await handleSectorRotationAnalysis(request, env, headers, requestId);
    }

    // GET /api/v1/sector-rotation/results - Get cached analysis results
    if (path === '/api/v1/sector-rotation/results' && method === 'GET') {
      return await handleSectorRotationResults(request, env, headers, requestId);
    }

    // GET /api/v1/sector-rotation/sectors - Get sector information
    if (path === '/api/v1/sector-rotation/sectors' && method === 'GET') {
      return await handleSectorInformation(request, env, headers, requestId);
    }

    // GET /api/v1/sector-rotation/etf/:symbol - Get individual ETF analysis
    const etfMatch = path.match(/^\/api\/v1\/sector-rotation\/etf\/([A-Z]{2,4})$/);
    if (etfMatch && method === 'GET') {
      const symbol = etfMatch[1];
      return await handleETFAnalysis(symbol, request, env, headers, requestId);
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
  } catch (error: unknown) {
    logger.error('SectorRotationRoutes Error', { error: (error as any).message,  requestId, path, method });

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
 * Handle complete sector rotation analysis
 * POST /api/v1/sector-rotation/analysis
 */
async function handleSectorRotationAnalysis(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    logger.info('Starting sector rotation analysis', { requestId });

    // Execute sequential sector rotation workflow
    const result = await executeSectorRotationAnalysis(env);

    logger.info('Sector rotation analysis completed', {
      requestId,
      processingTime: timer.getElapsedMs(),
      etfsAnalyzed: result.etfAnalyses.length,
      leadingSector: result.rotationSignals.leadingSector
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(result, {
          source: 'fresh',
          ttl: 3600,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Sector rotation analysis failed', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to perform sector rotation analysis',
          'ANALYSIS_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
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
 * Handle cached sector rotation results
 * GET /api/v1/sector-rotation/results?date=2025-01-10
 */
async function handleSectorRotationResults(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const url = new URL(request.url);
  const params = parseQueryParams(url);

  try {
    // Get date from query params, default to today
    const date = params.date as string;
    const targetDate = date || new Date().toISOString().split('T')[0];

    logger.info('Retrieving sector rotation results', {
      requestId,
      targetDate
    });

    // Try to get cached results
    const cachedResults = await getCachedSectorRotationResults(env, targetDate);

    if (cachedResults) {
      logger.info('Sector rotation results cache hit', {
        requestId,
        date: targetDate,
        processingTime: timer.getElapsedMs()
      });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.success(cachedResults, {
            source: 'cache',
            ttl: 3600,
            requestId,
            processingTime: timer.finish(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // No cached results available
    logger.info('No cached sector rotation results found', {
      requestId,
      date: targetDate
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          `No sector rotation analysis available for ${targetDate}. Run the analysis first.`,
          'NO_DATA',
          {
            requestId,
            date: targetDate,
            suggestion: 'POST /api/v1/sector-rotation/analysis to generate new analysis'
          }
        )
      ),
      {
        status: HttpStatus.NOT_FOUND,
        headers,
      }
    );

  } catch (error: any) {
    logger.error('Failed to retrieve sector rotation results', {
      requestId,
      error: (error instanceof Error ? error.message : String(error))
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to retrieve sector rotation results',
          'RETRIEVAL_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
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
 * Handle sector information
 * GET /api/v1/sector-rotation/sectors
 */
async function handleSectorInformation(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    const sectors = Object.entries(SPDR_ETFs).map(([symbol, info]) => ({
      symbol,
      name: info.name,
      description: info.description,
      category: getSectorCategory(symbol as keyof typeof SPDR_ETFs)
    }));

    const response = {
      sectors,
      count: sectors.length,
      lastUpdated: new Date().toISOString(),
      marketConditions: {
        status: 'active',
        tradingHours: isMarketHours()
      }
    };

    logger.info('Sector information retrieved', {
      requestId,
      sectorCount: sectors.length,
      processingTime: timer.getElapsedMs()
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 86400, // Cache for 24 hours
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Failed to retrieve sector information', {
      requestId,
      error: (error instanceof Error ? error.message : String(error))
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to retrieve sector information',
          'SECTOR_INFO_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
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
 * Handle individual ETF analysis
 * GET /api/v1/sector-rotation/etf/:symbol
 */
async function handleETFAnalysis(
  symbol: string,
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    // Validate ETF symbol
    if (!SPDR_ETFs[symbol as keyof typeof SPDR_ETFs]) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            `Invalid ETF symbol: ${symbol}. Valid symbols: ${Object.keys(SPDR_ETFs).join(', ')}`,
            'INVALID_SYMBOL',
            { requestId, symbol }
          )
        ),
        {
          status: HttpStatus.BAD_REQUEST,
          headers,
        }
      );
    }

    // Get cached sector rotation results
    const today = new Date().toISOString().split('T')[0];
    const cachedResults = await getCachedSectorRotationResults(env, today);

    if (!cachedResults) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            `No analysis data available for ${symbol}. Run sector rotation analysis first.`,
            'NO_ANALYSIS_DATA',
            {
              requestId,
              symbol,
              suggestion: 'POST /api/v1/sector-rotation/analysis to generate new analysis'
            }
          )
        ),
        {
          status: HttpStatus.NOT_FOUND,
          headers,
        }
      );
    }

    // Find ETF analysis in results
    const etfAnalysis = cachedResults.etfAnalyses.find(etf => etf.symbol === symbol);

    if (!etfAnalysis) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            `No analysis data found for ${symbol} in today's results`,
            'NO_ETF_DATA',
            { requestId, symbol }
          )
        ),
        {
          status: HttpStatus.NOT_FOUND,
          headers,
        }
      );
    }

    // Add additional context to ETF analysis
    const response = {
      ...etfAnalysis,
      sectorInfo: SPDR_ETFs[symbol as keyof typeof SPDR_ETFs],
      marketConditions: cachedResults.marketConditions,
      rotationContext: {
        isLeadingSector: cachedResults.rotationSignals.leadingSector === symbol,
        isLaggingSector: cachedResults.rotationSignals.laggingSector === symbol,
        isEmerging: cachedResults.rotationSignals.emergingSectors.includes(symbol as any),
        isDeclining: cachedResults.rotationSignals.decliningSectors.includes(symbol as any),
        rank: cachedResults.etfAnalyses
          .sort((a: any, b: any) => b.performanceMetrics.daily - a.performanceMetrics.daily)
          .findIndex(etf => etf.symbol === symbol) + 1
      },
      lastUpdated: cachedResults.timestamp
    };

    logger.info('ETF analysis retrieved', {
      requestId,
      symbol,
      isLeadingSector: response.rotationContext.isLeadingSector,
      rank: response.rotationContext.rank,
      processingTime: timer.getElapsedMs()
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'cache',
          ttl: 3600,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Failed to retrieve ETF analysis', {
      requestId,
      symbol,
      error: (error instanceof Error ? error.message : String(error))
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to retrieve ETF analysis',
          'ETF_ANALYSIS_ERROR',
          {
            requestId,
            symbol,
            error: error.message,
            processingTime: timer.finish()
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
/**
 * Get sector category for ETF symbol
 */
function getSectorCategory(symbol: string): string {
  const categories: Record<string, string> = {
    XLK: 'Technology',
    XLF: 'Financial Services',
    XLV: 'Healthcare',
    XLE: 'Energy',
    XLY: 'Consumer Discretionary',
    XLP: 'Consumer Staples',
    XLI: 'Industrials',
    XLB: 'Materials',
    XLU: 'Utilities',
    XLRE: 'Real Estate',
    XLC: 'Communication Services'
  };

  return categories[symbol] || 'Unknown';
}

/**
 * Check if market is currently open
 */
function isMarketHours(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();

  // Weekend check
  if (day === 0 || day === 6) {
    return false;
  }

  // Market hours: 9:30 AM - 4:00 PM ET
  const currentMinutes = hour * 60 + minute;
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM

  return currentMinutes >= marketOpen && currentMinutes < marketClose;
}