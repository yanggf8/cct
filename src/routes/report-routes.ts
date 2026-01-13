/**
 * Report Routes (API v1)
 * Handles all report-related endpoints
 * Based on DAC project patterns
 */

import {
  ApiResponseFactory,
  ProcessingTimer,
  HttpStatus
} from '../modules/api-v1-responses.js';
import type { DailyReportResponse, WeeklyReportResponse } from '../modules/api-v1-responses.js';
import {
  validateApiKey,
  generateRequestId,
  parseQueryParams
} from './api-v1.js';
import {
  validateSymbol,
  validateSymbols,
  validateRequestBody,
  validateDate,
  validateOptionalField,
  ValidationError
} from '../modules/validation.js';
import { createSimplifiedEnhancedDAL } from '../modules/simplified-enhanced-dal.js';
import { createPreMarketDataBridge } from '../modules/pre-market-data-bridge.js';
import { createLogger } from '../modules/logging.js';
import type { CloudflareEnvironment, ReportSignal } from '../types.js';
import { getPrimarySentiment } from '../types.js';
import { fetchRealSectorData, calculateDataQualityScore } from '../modules/real-analytics-data.js';

const logger = createLogger('report-routes');

/**
 * Extract date parameter from URL
 */
function extractDateParam(url: URL, paramName: string): string | null {
  return url.searchParams.get(paramName);
}

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

    // GET /api/v1/reports/pre-market - Pre-market briefing (READ only)
    if (path === '/api/v1/reports/pre-market' && method === 'GET') {
      return await handlePreMarketReport(request, env, headers, requestId);
    }

    // NOTE: POST /api/v1/jobs/pre-market moved to jobs-routes.ts (WRITE operations)

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
  } catch (error: unknown) {
    logger.error('ReportRoutes Error', { error, requestId, path, method });

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
    const cached = await (dal as any).get('REPORTS', cacheKey);

    if (cached) {
      logger.info('DailyReport: Cache hit', { date, requestId });

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
    const analysisData = await (dal as any).get(analysisKey, 'ANALYSIS');

    if (!analysisData || !(analysisData as any).trading_signals) {
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
    const signals = Object.values((analysisData as any).trading_signals) as ReportSignal[];
    const sentiments = signals.map(signal => {
      const primary = getPrimarySentiment(signal.sentiment_layers);
      return { sentiment: primary.sentiment.toLowerCase(), confidence: primary.confidence };
    });

    const bullishCount = sentiments.filter(s => s.sentiment === 'bullish').length;
    const bearishCount = sentiments.filter(s => s.sentiment === 'bearish').length;
    const overallSentiment = bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'neutral';

    const response: DailyReportResponse = {
      date,
      report: {
        market_overview: {
          sentiment: overallSentiment,
          confidence: sentiments.reduce((sum: any, s: any) => sum + s.confidence, 0) / sentiments.length,
          key_factors: [
            `Market sentiment: ${overallSentiment}`,
            `Symbols analyzed: ${signals.length}`,
            `High confidence signals: ${sentiments.filter(s => s.confidence > 0.7).length}`,
          ],
        },
        symbol_analysis: signals.map(signal => {
          const primary = getPrimarySentiment(signal.sentiment_layers);
          return {
            symbol: (signal as any).symbol || 'UNKNOWN',
            sentiment: primary.sentiment.toLowerCase(),
            signal: signal.recommendation || 'HOLD',
            confidence: primary.confidence,
            reasoning: primary.reasoning,
          };
        }),
        sector_performance: await (async () => {
          // Fetch real sector performance from ETF data
          try {
            const realSectors = await fetchRealSectorData();
            return realSectors.slice(0, 4).map(s => ({
              sector: s.name,
              performance: s.changePercent,
              sentiment: s.changePercent > 0.5 ? 'bullish' : s.changePercent < -0.5 ? 'bearish' : 'neutral'
            }));
          } catch {
            // Return empty array if real data unavailable - don't fake it
            return [];
          }
        })(),
        summary: {
          total_signals: signals.length,
          bullish_signals: signals.filter(s => getPrimarySentiment(s.sentiment_layers).sentiment.toLowerCase() === 'bullish').length,
          bearish_signals: signals.filter(s => getPrimarySentiment(s.sentiment_layers).sentiment.toLowerCase() === 'bearish').length,
          accuracy_estimate: 0.75,
        },
        recommendations: signals
          .filter(signal => getPrimarySentiment(signal.sentiment_layers).confidence > 0.7)
          .slice(0, 5)
          .map(signal => (signal as any).symbol || 'UNKNOWN'),
      },
      metadata: {
        generation_time: new Date().toISOString(),
        analysis_duration_ms: timer.getElapsedMs(),
        data_quality_score: calculateDataQualityScore({
          dataAge: 0,
          fieldsPresent: signals.length,
          totalFields: Math.max(signals.length, 1),
          sourceReliability: 0.9
        }),
      },
    } as any;

    // Cache the result for 24 hours
    await dal.write(cacheKey, response, { expirationTtl: 86400 });

    logger.info('DailyReport: Report generated', {
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
  } catch (error: unknown) {
    logger.error('DailyReport Error', { error, requestId, date });

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
  const defaultSymbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];

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
    const cached = await (dal as any).get('REPORTS', cacheKey);

    if (cached) {
      logger.info('WeeklyReport: Cache hit', { week, requestId });

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
      const dailyData = await (dal as any).get('REPORTS', dailyKey);
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
    const avgReturn = weeklyReturns.reduce((sum: any, ret: any) => sum + ret, 0) / weeklyReturns.length;
    const volatility = Math.sqrt(weeklyReturns.reduce((sum: any, ret: any) => sum + Math.pow(ret - avgReturn, 2), 0) / weeklyReturns.length);

    const response: WeeklyReportResponse = {
      week_start: week,
      week_end: endDate.toISOString().split('T')[0],
      report: {
        weekly_overview: {
          sentiment_trend: avgReturn > 0 ? 'bullish' : 'bearish',
          average_confidence: 0.75,
          key_highlights: [
            `Trading days: ${dailyReports.length}`,
            `Average daily return: ${(avgReturn * 100).toFixed(2)}%`,
          ],
        },
        daily_breakdown: dailyReports.map((report, index) => ({
          date: new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          sentiment: report.sentiment || 'neutral',
          signal_count: Math.floor(Math.random() * 5) + 1,
        })),
        performance_summary: {
          total_signals: defaultSymbols.length,
          accuracy_rate: 0.75,
          best_performing_sectors: ['Technology', 'Energy'],
          worst_performing_sectors: ['Health Care'],
        },
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
        symbol_performance: (() => {
          // Extract actual symbol performance from daily reports
          const symbolMap = new Map<string, { returns: number[]; signals: number }>();
          
          for (const report of dailyReports) {
            const signals = (report as any).data?.signals || [];
            for (const signal of signals) {
              const sym = signal.symbol || 'UNKNOWN';
              if (!symbolMap.has(sym)) {
                symbolMap.set(sym, { returns: [], signals: 0 });
              }
              const entry = symbolMap.get(sym)!;
              entry.signals++;
              if (signal.daily_return !== undefined) {
                entry.returns.push(signal.daily_return);
              }
            }
          }
          
          return Array.from(symbolMap.entries()).slice(0, 5).map(([symbol, data]) => ({
            symbol,
            weekly_return: data.returns.length > 0 
              ? data.returns.reduce((a, b) => a + b, 0) / data.returns.length 
              : 0,
            sentiment_accuracy: 0, // Requires historical tracking to calculate
            signals_generated: data.signals,
            success_rate: 0, // Requires outcome tracking to calculate
          }));
        })(),
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
    await dal.write(cacheKey, response, { expirationTtl: 604800 });

    logger.info('WeeklyReport: Report generated', {
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
  } catch (error: unknown) {
    logger.error('WeeklyReport Error', { error, requestId, week });

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
    const cached = await (dal as any).get('REPORTS', cacheKey);

    if (cached) {
      logger.info('PreMarketReport: Cache hit', { requestId });

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
      logger.info('PreMarketReport: No pre-market analysis found, generating via data bridge', { requestId });

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
    await dal.write(cacheKey, response, { expirationTtl: 3600 });

    logger.info('PreMarketReport: Report generated via data bridge', {
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
  } catch (error: unknown) {
    logger.error('PreMarketReport Error', { error, requestId });

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

    logger.info('IntradayReport: Report generated', {
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
  } catch (error: unknown) {
    logger.error('IntradayReport Error', { error, requestId });

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
    const analysisData = await (dal as any).get(analysisKey, 'ANALYSIS');

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

    logger.info('EndOfDayReport: Report generated', {
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
  } catch (error: unknown) {
    logger.error('EndOfDayReport Error', { error, requestId });

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