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
import {
  readD1ReportSnapshot,
  getD1LatestReportSnapshot,
  getJobDateResults,
  type ReportType,
  type JobDateResult
} from '../modules/d1-job-storage.js';
import {
  getLastNTradingDays,
  formatDateForNav,
  getStatusForMissingRow,
  isMarketHours,
  NAV_CUTOVER_DATE
} from '../modules/trading-calendar.js';
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

    // GET /api/v1/reports/status - Navigation status for last N trading days
    if (path === '/api/v1/reports/status' && method === 'GET') {
      return await handleReportsStatus(request, env, headers, requestId);
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
  const url = new URL(request.url);
  const bypassCache = url.searchParams.get('bypass') === 'true' || url.searchParams.get('nocache') === 'true';

  try {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `pre_market_report_${today}`;

    // 1. Check DO cache first (unless bypass)
    if (!bypassCache) {
      const cachedResult = await dal.read(cacheKey);
      const cached = cachedResult.success ? cachedResult.data : null;

      // Validate cached data is actually valid pre-market data (not an old error response)
      if (cached && cached.type === 'pre_market_briefing' && !cached.error) {
        logger.info('PreMarketReport: DO cache hit', { requestId });

        return new Response(
          JSON.stringify(
            ApiResponseFactory.cached(cached, 'hit', {
              source: 'do_cache',
              ttl: 3600,
              requestId,
              processingTime: timer.getElapsedMs(),
            })
          ),
          { status: HttpStatus.OK, headers }
        );
      }

      // If cached data is invalid, log and continue to D1 fallback
      if (cached) {
        logger.warn('PreMarketReport: Invalid cached data detected, skipping', {
          requestId,
          hasError: !!cached.error,
          type: cached.type
        });
      }
    }

    // 2. D1 fallback - check for pre-market job result
    logger.info('PreMarketReport: DO cache miss, checking D1', { requestId });

    const d1Result = await readD1ReportSnapshot(env, today, 'pre-market');
    let d1Data = d1Result?.data;
    let isStale = false;
    let sourceDate = today;

    // If no data for today, try latest available
    if (!d1Data) {
      const latestSnapshot = await getD1LatestReportSnapshot(env, 'pre-market');
      if (latestSnapshot) {
        d1Data = latestSnapshot.data;
        sourceDate = latestSnapshot.scheduledDate;
        isStale = sourceDate !== today;
        logger.info('PreMarketReport: Using latest D1 snapshot', { sourceDate, isStale, requestId });
      }
    }

    if (d1Data && d1Data.trading_signals) {
      logger.info('PreMarketReport: D1 fallback hit', { requestId, sourceDate, isStale });

      // Transform D1 data to response format
      const tradingSignals = d1Data.trading_signals || {};

      // Calculate overall market sentiment from signals
      const allSignals = Object.values(tradingSignals).map((signal: any) => {
        const confidence = signal.confidence_metrics?.overall_confidence ??
          signal.enhanced_prediction?.confidence ??
          signal.sentiment_layers?.[0]?.confidence ??
          signal.confidence ??
          null;

        // Extract dual model confidence values
        const gemmaConfidence = signal.gemma_confidence ?? null;
        const distilbertConfidence = signal.distilbert_confidence ?? null;

        // Determine status based on explicit error fields first, then confidence
        // Per dual-ai-analysis contract: failures have error field AND confidence=0
        const hasError = !!(
          signal.error ||
          signal.error_message ||
          signal.status === 'failed' ||
          signal.status === 'skipped' ||
          signal.gemma_error ||
          signal.distilbert_error
        );

        // Status: failed if explicit error OR missing confidence
        const status = hasError || confidence === null ? 'failed' : 'success';

        // Failure reason: prioritize explicit error fields over reasoning
        const failureReason = status === 'failed'
          ? (signal.error ||
            signal.error_message ||
            signal.gemma_error ||
            signal.distilbert_error ||
            signal.status ||
            'Analysis failed')
          : undefined;

        return {
          symbol: signal.symbol,
          sentiment: signal.sentiment_layers?.[0]?.sentiment || 'neutral',
          confidence,
          gemma_confidence: gemmaConfidence,
          distilbert_confidence: distilbertConfidence,
          status,
          failure_reason: failureReason,
          reason: status === 'success' ? (signal.sentiment_layers?.[0]?.reasoning || '') : failureReason
        };
      });

      const response = {
        type: 'pre_market_briefing',
        timestamp: new Date().toISOString(),
        market_status: 'pre_market',
        date: sourceDate,
        is_stale: isStale,
        key_insights: [
          'Pre-market analysis complete',
          `Data from ${sourceDate}`,
          isStale ? 'Note: Using previous day data' : 'Fresh data available',
        ],
        high_confidence_signals: Object.values(tradingSignals)
          .filter((signal: any) => {
            const conf = signal.confidence_metrics?.overall_confidence ??
              signal.enhanced_prediction?.confidence ??
              signal.sentiment_layers?.[0]?.confidence ??
              signal.confidence ??
              null;
            const hasError = !!(
              signal.error ||
              signal.error_message ||
              signal.status === 'failed' ||
              signal.status === 'skipped' ||
              signal.gemma_error ||
              signal.distilbert_error
            );
            return !hasError && conf !== null && conf > 0.7;
          })
          .slice(0, 5)
          .map((signal: any) => {
            const confidence = signal.confidence_metrics?.overall_confidence ??
              signal.enhanced_prediction?.confidence ??
              signal.sentiment_layers?.[0]?.confidence ??
              signal.confidence ??
              null;

            // Extract dual model confidence (same as allSignals)
            const gemmaConfidence = signal.gemma_confidence ?? null;
            const distilbertConfidence = signal.distilbert_confidence ?? null;

            // Derive status using same logic as allSignals for consistency
            const hasError = !!(
              signal.error ||
              signal.error_message ||
              signal.status === 'failed' ||
              signal.status === 'skipped' ||
              signal.gemma_error ||
              signal.distilbert_error
            );
            const status = hasError || confidence === null ? 'failed' : 'success';

            // Failure reason: same logic as allSignals
            const failureReason = status === 'failed'
              ? (signal.error ||
                signal.error_message ||
                signal.gemma_error ||
                signal.distilbert_error ||
                signal.status ||
                'Analysis failed')
              : undefined;

            return {
              symbol: signal.symbol,
              sentiment: signal.sentiment_layers?.[0]?.sentiment || 'neutral',
              confidence,
              gemma_confidence: gemmaConfidence,
              distilbert_confidence: distilbertConfidence,
              status,
              failure_reason: failureReason,
              reason: status === 'success'
                ? (signal.sentiment_layers?.[0]?.reasoning || 'High confidence signal')
                : failureReason,
            };
          }),
        all_signals: allSignals,  // Already contains reason and status
        data_source: 'd1_snapshot',
        generated_at: d1Data.generated_at || d1Data.timestamp || sourceDate,
        symbols_analyzed: Object.keys(tradingSignals).length,
      };

      // Warm DO cache with D1 data (only if not stale)
      if (!isStale) {
        try {
          await dal.write(cacheKey, response, { expirationTtl: 3600 });
          logger.info('PreMarketReport: Warmed DO cache from D1', { requestId });
        } catch (e) {
          logger.warn('PreMarketReport: Failed to warm DO cache', { error: (e as Error).message });
        }
      }

      return new Response(
        JSON.stringify(
          ApiResponseFactory.success(response, {
            source: 'd1_fallback',
            ttl: 3600,
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // 3. No data in DO cache or D1 - return empty response (don't auto-generate)
    logger.info('PreMarketReport: No data found in DO cache or D1', { requestId });

    const emptyResponse = {
      type: 'pre_market_briefing',
      timestamp: new Date().toISOString(),
      market_status: 'pre_market',
      date: today,
      message: 'No pre-market data available. Run POST /api/v1/jobs/pre-market to generate.',
      high_confidence_signals: [],
      all_signals: [],
      data_source: 'none',
      symbols_analyzed: 0,
    };

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(emptyResponse, {
          source: 'empty',
          requestId,
          processingTime: timer.getElapsedMs(),
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
    const today = new Date().toISOString().split('T')[0];
    
    // Read from D1 report snapshots
    if (!env.PREDICT_JOBS_DB) {
      return new Response(
        JSON.stringify(ApiResponseFactory.error(
          'Database not available',
          'DB_ERROR',
          { requestId }
        )),
        { status: HttpStatus.INTERNAL_SERVER_ERROR, headers }
      );
    }

    const snapshot = await env.PREDICT_JOBS_DB
      .prepare('SELECT report_content, created_at FROM scheduled_job_results WHERE scheduled_date = ? AND report_type = ? ORDER BY created_at DESC LIMIT 1')
      .bind(today, 'intraday')
      .first();

    let response;
    
    if (snapshot && snapshot.report_content) {
      // Parse and return stored intraday data
      const content = typeof snapshot.report_content === 'string' 
        ? JSON.parse(snapshot.report_content) 
        : snapshot.report_content;
      
      response = content;
      
      logger.info('IntradayReport: Returning D1 data', {
        symbols_count: content.symbols_analyzed || 0,
        accuracy: content.overall_accuracy || 0,
        requestId
      });
    } else {
      // No data available - return message to run job
      response = {
        type: 'intraday_check',
        timestamp: new Date().toISOString(),
        market_status: isMarketOpen() ? 'open' : 'closed',
        message: 'No intraday data available. Run POST /api/v1/jobs/intraday to generate.',
        symbols: [],
        overall_accuracy: 0,
        on_track_count: 0,
        diverged_count: 0,
        total_symbols: 0
      };
      
      logger.info('IntradayReport: No D1 data available', { date: today, requestId });
    }

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: snapshot ? 'd1' : 'fresh',
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

/**
 * Handle reports status for navigation
 * GET /api/v1/reports/status?days=3
 * Returns job status for last N trading days
 */
async function handleReportsStatus(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const url = new URL(request.url);

  try {
    // Parse days parameter (default 3, max 10)
    const daysParam = url.searchParams.get('days');
    const days = Math.min(Math.max(parseInt(daysParam || '3', 10) || 3, 1), 10);

    // Note: Stale job cleanup moved to authenticated job handlers (jobs-routes.ts)
    // to avoid public write amplification

    // Get last N trading days
    const tradingDays = getLastNTradingDays(days);

    // Fetch job results from D1
    const jobResults = await getJobDateResults(env, tradingDays);

    // Build response data
    const data: Record<string, {
      label: string;
      'pre-market': JobStatusEntry;
      'intraday': JobStatusEntry;
      'end-of-day': JobStatusEntry;
    }> = {};

    const reportTypes: ReportType[] = ['pre-market', 'intraday', 'end-of-day'];

    for (const date of tradingDays) {
      const dateResults = jobResults.get(date);
      const dateEntry: Record<string, JobStatusEntry> = {};

      for (const reportType of reportTypes) {
        const result = dateResults?.get(reportType);

        if (result) {
          // Row exists - return stored status
          const entry: JobStatusEntry = {
            status: result.status
          };

          if (result.executed_at) {
            entry.executed_at = result.executed_at;
          }
          if (result.started_at && result.status === 'running') {
            entry.started_at = result.started_at;
          }
          if (result.current_stage) {
            entry.current_stage = result.current_stage;
          }
          if (result.errors_json) {
            try {
              entry.errors = JSON.parse(result.errors_json);
            } catch { /* ignore */ }
          }

          dateEntry[reportType] = entry;
        } else {
          // No row - compute n/a or missed based on cutover
          dateEntry[reportType] = {
            status: getStatusForMissingRow(date)
          };
        }
      }

      data[date] = {
        label: formatDateForNav(date),
        'pre-market': dateEntry['pre-market'],
        'intraday': dateEntry['intraday'],
        'end-of-day': dateEntry['end-of-day']
      };
    }

    const response = {
      success: true,
      data,
      meta: {
        timezone: 'America/New_York',
        cutover_date: NAV_CUTOVER_DATE,
        generated_at: new Date().toISOString()
      }
    };

    logger.info('ReportsStatus: Generated', {
      requestId,
      days,
      tradingDays: tradingDays.length,
      processingTime: timer.getElapsedMs()
    });

    // Cache TTL: 60s during market hours, 5min otherwise
    const cacheTtl = isMarketHours() ? 60 : 300;

    return new Response(
      JSON.stringify(response),
      {
        status: HttpStatus.OK,
        headers: {
          ...headers,
          'Cache-Control': `public, max-age=${cacheTtl}`
        }
      }
    );
  } catch (error: unknown) {
    logger.error('ReportsStatus Error', { error, requestId });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Database unavailable',
        fallback: true,
        data: {}
      }),
      {
        status: HttpStatus.OK, // Return 200 with fallback flag
        headers
      }
    );
  }
}

// Type for job status entry in response
interface JobStatusEntry {
  status: string;
  executed_at?: string;
  started_at?: string;
  current_stage?: string;
  errors?: string[];
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
