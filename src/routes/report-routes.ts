/**
 * Report Routes (API v1)
 * Handles all report-related endpoints
 * Based on DAC project patterns
 */

import {
  ApiResponseFactory,
  DailyReportResponse,
  WeeklyReportResponse,
  ProcessingTimer,
  HttpStatus,
  extractDateParam
} from '../modules/api-v1-responses.js';
import {
  validateApiKey,
  generateRequestId
} from './api-v1.js';
import { createSimplifiedEnhancedDAL } from '../modules/simplified-enhanced-dal.js';
import { createPreMarketDataBridge } from '../modules/pre-market-data-bridge.js';
import { createLogger } from '../modules/logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('report-routes');

/**
 * Handle all report routes
 */
export async function handleReportRoutes(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const method = request.method;
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
    // GET /api/v1/reports/daily/:date - Daily report
    const dailyMatch = path.match(/^\/api\/v1\/reports\/daily\/(\d{4}-\d{2}-\d{2})$/);
    if (dailyMatch && method === 'GET') {
      const date = dailyMatch[1];
      return await handleDailyReport(date, request, env, headers, requestId);
    }

    // GET /api/v1/reports/daily - Latest daily report
    if (path === '/api/v1/reports/daily' && method === 'GET') {
      const today = new Date().toISOString().split('T')[0];
      return await handleDailyReport(today, request, env, headers, requestId);
    }

    // GET /api/v1/reports/weekly/:week - Weekly report
    const weeklyMatch = path.match(/^\/api\/v1\/reports\/weekly\/(\d{4}-W\d{2})$/);
    if (weeklyMatch && method === 'GET') {
      const week = weeklyMatch[1];
      return await handleWeeklyReport(week, request, env, headers, requestId);
    }

    // GET /api/v1/reports/weekly - Latest weekly report
    if (path === '/api/v1/reports/weekly' && method === 'GET') {
      const week = getWeekString(new Date());
      return await handleWeeklyReport(week, request, env, headers, requestId);
    }

    // GET /api/v1/reports/pre-market - Pre-market briefing
    if (path === '/api/v1/reports/pre-market' && method === 'GET') {
      return await handlePreMarketReport(request, env, headers, requestId);
    }

    // POST /api/v1/reports/pre-market/generate - Force generate pre-market data
    if (path === '/api/v1/reports/pre-market/generate' && method === 'POST') {
      return await handlePreMarketDataGeneration(request, env, headers, requestId);
    }

    // GET /api/v1/reports/intraday - Intraday check
    if (path === '/api/v1/reports/intraday' && method === 'GET') {
      return await handleIntradayReport(request, env, headers, requestId);
    }

    // GET /api/v1/reports/end-of-day - End-of-day summary
    if (path === '/api/v1/reports/end-of-day' && method === 'GET') {
      return await handleEndOfDayReport(request, env, headers, requestId);
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
    logger.error('ReportRoutes Error', error, { requestId, path, method });

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
 * Handle daily report
 * GET /api/v1/reports/daily/:date
 */
async function handleDailyReport(
  date: string,
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env);
  const url = new URL(request.url);

  try {
    // Validate date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'Invalid date format. Expected YYYY-MM-DD',
            'INVALID_DATE',
            { requestId, date }
          )
        ),
        {
          status: HttpStatus.BAD_REQUEST,
          headers,
        }
      );
    }

    // Check cache first
    const cacheKey = `daily_report_${date}`;
    const cached = await dal.get<DailyReportResponse>('REPORTS', cacheKey);

    if (cached) {
      logger.info('DailyReport', 'Cache hit', { date, requestId });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cached, 'hit', {
            source: 'cache',
            ttl: 86400, // 24 hours
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // Get analysis data for the date
    const analysisKey = `analysis_${date}`;
    const analysisData = await dal.get(analysisKey, 'ANALYSIS');

    if (!analysisData || !analysisData.trading_signals) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'No daily report data available for this date',
            'NO_DATA',
            { requestId, date }
          )
        ),
        {
          status: HttpStatus.NOT_FOUND,
          headers,
        }
      );
    }

    // Transform analysis data to daily report format
    const signals = Object.values(analysisData.trading_signals);
    const sentiments = signals.map(signal => {
      const sentiment = signal.sentiment_layers?.[0]?.sentiment || 'neutral';
      const confidence = signal.sentiment_layers?.[0]?.confidence || 0.5;
      return { sentiment, confidence };
    });

    const bullishCount = sentiments.filter(s => s.sentiment === 'bullish').length;
    const bearishCount = sentiments.filter(s => s.sentiment === 'bearish').length;
    const overallSentiment = bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'neutral';

    const response: DailyReportResponse = {
      date,
      report: {
        market_overview: {
          sentiment: overallSentiment,
          confidence: sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length,
          key_factors: [
            `Market sentiment: ${overallSentiment}`,
            `Symbols analyzed: ${signals.length}`,
            `High confidence signals: ${sentiments.filter(s => s.confidence > 0.7).length}`,
          ],
        },
        symbol_analysis: signals.map(signal => ({
          symbol: signal.symbol,
          sentiment: signal.sentiment_layers?.[0]?.sentiment || 'neutral',
          signal: signal.recommendation || 'HOLD',
          confidence: signal.sentiment_layers?.[0]?.confidence || 0.5,
          reasoning: signal.sentiment_layers?.[0]?.reasoning || 'No reasoning available',
        })),
        sector_performance: [
          // Mock sector performance - TODO: Implement actual sector analysis
        // FUTURE ENHANCEMENT: Real sector analysis implementation
        // This would replace mock sector performance data with real analysis
        // Current implementation provides placeholder data for development/testing
        // Implementation considerations:
        // - Integrate with sector rotation analysis system for real-time sector performance
        // - Use sector ETF data (SPY, XLF, etc.) for performance benchmarks
        // - Calculate performance metrics based on actual market data and volatility
        // - Add API endpoint: GET /api/v1/sectors/performance
        // - Priority: High (core business functionality enhancement)
        // - Dependencies: Sector rotation analysis system, real-time market data feeds
        // - Estimated effort: 4-6 weeks development time
        // - GitHub Issue: #real-sector-performance-analysis
          { sector: 'Technology', performance: Math.random() * 10 - 5, sentiment: 'bullish' },
          { sector: 'Financials', performance: Math.random() * 10 - 5, sentiment: 'neutral' },
          { sector: 'Health Care', performance: Math.random() * 10 - 5, sentiment: 'bearish' },
          { sector: 'Energy', performance: Math.random() * 10 - 5, sentiment: 'bullish' },
        ],
        recommendations: signals
          .filter(signal => (signal.sentiment_layers?.[0]?.confidence || 0) > 0.7)
          .slice(0, 5)
          .map(signal => ({
            symbol: signal.symbol,
            action: signal.recommendation || 'HOLD',
            reason: `High confidence (${(signal.sentiment_layers?.[0]?.confidence || 0).toFixed(2)}) ${signal.sentiment_layers?.[0]?.sentiment} sentiment`,
          })),
      },
      metadata: {
        generation_time: new Date().toISOString(),
        analysis_duration_ms: timer.getElapsedMs(),
        data_quality_score: 0.85, // Mock quality score
      },
    };

    // Cache the result for 24 hours
    await dal.put('REPORTS', cacheKey, response, { expirationTtl: 86400 });

    logger.info('DailyReport', 'Report generated', {
      date,
      symbolsCount: signals.length,
      processingTime: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 86400,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    logger.error('DailyReport Error', error, { requestId, date });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate daily report',
          'REPORT_ERROR',
          {
            requestId,
            date,
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
 * Handle weekly report
 * GET /api/v1/reports/weekly/:week
 */
async function handleWeeklyReport(
  week: string,
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env);

  try {
    // Validate week format
    const weekRegex = /^\d{4}-W\d{2}$/;
    if (!weekRegex.test(week)) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'Invalid week format. Expected YYYY-W## (e.g., 2025-W41)',
            'INVALID_WEEK',
            { requestId, week }
          )
        ),
        {
          status: HttpStatus.BAD_REQUEST,
          headers,
        }
      );
    }

    // Parse week to get date range
    const [year, weekNum] = week.split('-W').map(Number);
    const startDate = getWeekStartDate(year, weekNum);
    const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);

    // Check cache first
    const cacheKey = `weekly_report_${week}`;
    const cached = await dal.get<WeeklyReportResponse>('REPORTS', cacheKey);

    if (cached) {
      logger.info('WeeklyReport', 'Cache hit', { week, requestId });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cached, 'hit', {
            source: 'cache',
            ttl: 604800, // 7 days
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // Collect daily data for the week
    const dailyReports = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dailyKey = `daily_report_${dateStr}`;
      const dailyData = await dal.get('REPORTS', dailyKey);
      if (dailyData) {
        dailyReports.push({ date: dateStr, data: dailyData });
      }
    }

    if (dailyReports.length === 0) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'No weekly report data available for this period',
            'NO_DATA',
            { requestId, week }
          )
        ),
        {
          status: HttpStatus.NOT_FOUND,
          headers,
        }
      );
    }

    // Calculate weekly metrics
    const weeklyReturns = dailyReports.map(report => Math.random() * 4 - 2); // Mock returns
    const avgReturn = weeklyReturns.reduce((sum, ret) => sum + ret, 0) / weeklyReturns.length;
    const volatility = Math.sqrt(weeklyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / weeklyReturns.length);

    const response: WeeklyReportResponse = {
      week,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      report: {
        weekly_summary: {
          overall_sentiment: avgReturn > 0 ? 'bullish' : avgReturn < 0 ? 'bearish' : 'neutral',
          weekly_return: avgReturn,
          volatility,
          key_events: [
            `Trading days: ${dailyReports.length}`,
            `Average daily return: ${(avgReturn * 100).toFixed(2)}%`,
            `Weekly volatility: ${(volatility * 100).toFixed(2)}%`,
          ],
        },
        symbol_performance: [
          // Mock symbol performance - TODO: Calculate from actual data
          {
            symbol: 'AAPL',
            weekly_return: Math.random() * 10 - 5,
            sentiment_accuracy: Math.random() * 0.4 + 0.6,
            signals_generated: Math.floor(Math.random() * 5) + 1,
            success_rate: Math.random() * 0.3 + 0.7,
          },
          {
            symbol: 'MSFT',
            weekly_return: Math.random() * 10 - 5,
            sentiment_accuracy: Math.random() * 0.4 + 0.6,
            signals_generated: Math.floor(Math.random() * 5) + 1,
            success_rate: Math.random() * 0.3 + 0.7,
          },
        ],
        patterns: {
          bullish_patterns: ['Strong opening momentum', 'Mid-week rally'],
          bearish_patterns: volatility > 2 ? ['High volatility periods'] : [],
          neutral_periods: avgReturn < 1 && avgReturn > -1 ? ['Sideways trading'] : [],
        },
        outlook: {
          next_week_sentiment: avgReturn > 0 ? 'bullish' : 'bearish',
          confidence: Math.min(Math.abs(avgReturn) / 5, 1),
          key_factors: [
            `Current trend: ${avgReturn > 0 ? 'positive' : 'negative'}`,
            `Volatility level: ${volatility > 2 ? 'high' : 'normal'}`,
            'Market conditions analyzed',
          ],
        },
      },
    };

    // Cache the result for 7 days
    await dal.put('REPORTS', cacheKey, response, { expirationTtl: 604800 });

    logger.info('WeeklyReport', 'Report generated', {
      week,
      dailyReportsCount: dailyReports.length,
      processingTime: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 604800,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    logger.error('WeeklyReport Error', error, { requestId, week });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate weekly report',
          'REPORT_ERROR',
          {
            requestId,
            week,
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
 * Handle pre-market report
 * GET /api/v1/reports/pre-market
 */
async function handlePreMarketReport(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env);
  const dataBridge = createPreMarketDataBridge(env);

  try {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `pre_market_report_${today}`;

    // Check cache first
    const cached = await dal.get<any>('REPORTS', cacheKey);

    if (cached) {
      logger.info('PreMarketReport', 'Cache hit', { requestId });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cached, 'hit', {
            source: 'cache',
            ttl: 3600, // 1 hour
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // Ensure pre-market analysis data exists using the data bridge
    const hasAnalysis = await dataBridge.hasPreMarketAnalysis();

    if (!hasAnalysis) {
      logger.info('PreMarketReport', 'No pre-market analysis found, generating via data bridge', { requestId });

      // Generate pre-market analysis data
      const defaultSymbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];
      await dataBridge.generatePreMarketAnalysis(defaultSymbols);
    }

    // Get the analysis data using the data bridge
    const analysisData = await dataBridge.getCurrentPreMarketAnalysis();

    // Generate response with proper handling for missing data
    const response = {
      type: 'pre_market_briefing',
      timestamp: new Date().toISOString(),
      market_status: 'pre_market',
      key_insights: [
        'Pre-market analysis complete',
        'High-confidence signals identified',
        'Market sentiment calculated',
      ],
      high_confidence_signals: analysisData?.trading_signals
        ? Object.values(analysisData.trading_signals)
            .filter(signal => (signal.sentiment_layers?.[0]?.confidence || 0) > 0.7)
            .slice(0, 3)
            .map(signal => ({
              symbol: signal.symbol,
              sentiment: signal.sentiment_layers?.[0]?.sentiment || 'neutral',
              confidence: signal.sentiment_layers?.[0]?.confidence || 0.5,
              reason: signal.sentiment_layers?.[0]?.reasoning || 'High confidence signal',
            }))
        : [],
      data_source: 'data_bridge',
      generated_at: analysisData?.generated_at || new Date().toISOString(),
      symbols_analyzed: analysisData ? Object.keys(analysisData.trading_signals).length : 0,
    };

    // Cache for 1 hour
    await dal.put('REPORTS', cacheKey, response, { expirationTtl: 3600 });

    logger.info('PreMarketReport', 'Report generated via data bridge', {
      signalsCount: response.high_confidence_signals.length,
      processingTime: timer.getElapsedMs(),
      symbols_analyzed: response.symbols_analyzed,
      data_source: response.data_source,
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 3600,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    logger.error('PreMarketReport Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate pre-market report',
          'REPORT_ERROR',
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
 * Handle pre-market data generation
 * POST /api/v1/reports/pre-market/generate
 */
async function handlePreMarketDataGeneration(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dataBridge = createPreMarketDataBridge(env);

  try {
    // Parse request body for optional symbols
    let symbols: string[] = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']; // Default symbols

    try {
      const body = await request.json();
      if (body.symbols && Array.isArray(body.symbols)) {
        symbols = body.symbols;
      }
    } catch (error) {
      // Use default symbols if body parsing fails
    }

    logger.info('PreMarketDataGeneration', 'Starting data generation', { symbols, requestId });

    // Force refresh pre-market analysis
    const analysisData = await dataBridge.refreshPreMarketAnalysis(symbols);

    const response = {
      success: true,
      message: 'Pre-market data generated successfully',
      data: {
        symbols_analyzed: Object.keys(analysisData.trading_signals).length,
        high_confidence_signals: Object.values(analysisData.trading_signals)
          .filter(signal => (signal.sentiment_layers?.[0]?.confidence || 0) > 0.7).length,
        generated_at: analysisData.generated_at,
        symbols: symbols
      },
      processing_time: timer.getElapsedMs(),
      timestamp: new Date().toISOString()
    };

    logger.info('PreMarketDataGeneration', 'Data generation completed', {
      symbols_count: Object.keys(analysisData.trading_signals).length,
      high_confidence_count: response.data.high_confidence_signals,
      processing_time: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          requestId,
          processingTime: timer.getElapsedMs(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('PreMarketDataGeneration Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate pre-market data',
          'GENERATION_ERROR',
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
 * Handle intraday report
 * GET /api/v1/reports/intraday
 */
async function handleIntradayReport(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    const response = {
      type: 'intraday_check',
      timestamp: new Date().toISOString(),
      market_status: isMarketOpen() ? 'open' : 'closed',
      current_performance: {
        time: new Date().toLocaleTimeString(),
        market_sentiment: 'neutral',
        tracking_predictions: 'Morning predictions being monitored',
      },
    };

    logger.info('IntradayReport', 'Report generated', {
      marketStatus: response.market_status,
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
    logger.error('IntradayReport Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate intraday report',
          'REPORT_ERROR',
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
 * Handle end-of-day report
 * GET /api/v1/reports/end-of-day
 */
async function handleEndOfDayReport(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env);

  try {
    const today = new Date().toISOString().split('T')[0];
    const analysisKey = `analysis_${today}`;
    const analysisData = await dal.get(analysisKey, 'ANALYSIS');

    const response = {
      type: 'end_of_day_summary',
      date: today,
      timestamp: new Date().toISOString(),
      market_status: 'closed',
      daily_summary: {
        symbols_analyzed: analysisData?.symbols_analyzed?.length || 0,
        overall_sentiment: 'neutral',
        key_events: [
          'Market closed',
          'Daily analysis complete',
          'Tomorrow\'s outlook prepared',
        ],
      },
      tomorrow_outlook: {
        sentiment: 'neutral',
        confidence: 0.5,
        key_factors: ['Weekend analysis', 'Global market conditions', 'Economic indicators'],
      },
    };

    logger.info('EndOfDayReport', 'Report generated', {
      symbolsCount: response.daily_summary.symbols_analyzed,
      processingTime: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 86400, // 24 hours
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    logger.error('EndOfDayReport Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate end-of-day report',
          'REPORT_ERROR',
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
function getWeekString(date: Date): string {
  const year = date.getFullYear();
  const week = Math.ceil((((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function getWeekStartDate(year: number, week: number): Date {
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7;
  const startDate = new Date(firstDayOfYear.getTime() + daysOffset * 24 * 60 * 60 * 1000);

  // Adjust to Monday
  const dayOfWeek = startDate.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return new Date(startDate.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
}

function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  // Weekend check
  if (day === 0 || day === 6) return false;

  // Market hours (9:30 AM - 4:00 PM EST)
  if (hour < 10 || hour > 16) return false;
  if (hour === 10 && now.getMinutes() < 30) return false;

  return true;
}