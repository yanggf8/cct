/**
 * Daily Summary and Backfill HTTP Request Handlers
 * Handles daily summary system, backfill operations, and dashboard data
 */

import { getDailySummary, generateDailySummary } from '../daily-summary.js';
import { backfillDailySummaries } from '../backfill.js';
import { handleDailySummaryPage } from '../daily-summary-page.js';
import { createLogger, logBusinessMetric } from '../logging.js';
import type { CloudflareEnvironment } from '../../types/index.js';

// Type Definitions

interface SentimentCounts {
  bullish: number;
  bearish: number;
  neutral: number;
}

interface MorningPrediction {
  direction: 'UP' | 'DOWN' | 'NEUTRAL' | 'UNKNOWN';
  confidence: number;
  sentiment: string;
  reasoning: string;
}

interface MiddayUpdate {
  ai_confidence: number;
  technical_confidence: number;
  confidence_difference: number;
  conflict: boolean;
  conflict_severity: 'none' | 'moderate' | 'high';
}

interface DailyValidation {
  predicted_direction: string;
  actual_direction: string;
  correct: boolean | null;
  price_accuracy: number | null;
}

interface NextDayOutlook {
  direction: string;
  confidence: number;
  key_factors: string[];
}

interface ProcessedSymbolData {
  symbol: string;
  morning_prediction: MorningPrediction;
  midday_update: MiddayUpdate;
  daily_validation: DailyValidation;
  next_day_outlook: NextDayOutlook;
  articles_analyzed: number;
  analysis_timestamp: string;
}

interface SummaryMetrics {
  overall_accuracy: number;
  total_predictions: number;
  correct_predictions: number;
  average_confidence: number;
  major_conflicts: string[];
  sentiment_distribution: SentimentCounts;
  system_status: "operational" | "no_data" | "error";
}

interface ChartsData {
  confidence_trend: Array<{
    symbol: string;
    morning: number;
    midday_ai: number;
    midday_technical: number;
  }>;
  accuracy_breakdown: {
    labels: string[];
    predicted: string[];
    conflicts: boolean[];
    confidence_levels: number[];
  };
  conflict_analysis: Array<{
    symbol: string;
    ai_confidence: number;
    technical_confidence: number;
    difference: number;
    severity: string;
  }>;
  generated_for_date: string;
}

interface DailySummary {
  success: boolean;
  date?: string;
  display_date?: string;
  is_trading_day?: boolean;
  generated_at?: string;
  summary?: SummaryMetrics;
  symbols?: ProcessedSymbolData[];
  charts_data?: ChartsData;
  data?: DailySummary;
}

interface BackfillResult {
  date: string;
  status: 'success' | 'skipped' | 'failed';
  total_predictions?: number;
  accuracy?: number;
  is_trading_day: boolean;
  kv_key?: string;
  reason?: string;
  error?: string;
}

interface BackfillSummary {
  backfill_date: string;
  days_requested: number;
  total_dates: number;
  processed: number;
  skipped: number;
  failed: number;
  skip_existing: boolean;
  results: BackfillResult[];
}

interface VerificationDetail {
  date: string;
  status: 'found' | 'missing' | 'error';
  predictions?: number;
  accuracy?: number;
  generated_at?: string;
  is_trading_day?: boolean;
  error?: string;
}

interface VerificationResult {
  verification_date: string;
  days_checked: number;
  found: number;
  missing: number;
  coverage_percentage: number;
  details: VerificationDetail[];
}

interface DailySummaryApiResponse {
  success: boolean;
  data?: DailySummary;
  error?: string;
  provided_date?: string;
  example?: string;
  request_id: string;
  timestamp?: string;
}

interface BackfillApiResponse {
  success: boolean;
  error?: string;
  requested_days?: number;
  maximum_days?: number;
  backfill_result?: BackfillSummary;
  parameters?: {
    days: number;
    skip_existing: boolean;
    trading_days_only?: boolean;
  };
  request_id: string;
  timestamp?: string;
}

interface VerifyBackfillApiResponse {
  success: boolean;
  error?: string;
  requested_days?: number;
  maximum_days?: number;
  verification_result?: VerificationResult;
  parameters?: {
    days_checked: number;
  };
  request_id: string;
  timestamp?: string;
}

interface LogContext {
  requestId: string;
  dateParam?: string;
  targetDate?: string;
  providedDate?: string;
  expectedFormat?: string;
  totalPredictions?: number;
  accuracy?: number;
  generated?: boolean;
  daysRequested?: number;
  skipExisting?: boolean;
  maximum?: number;
  processed?: number;
  skipped?: number;
  failed?: number;
  daysToCheck?: number;
  found?: number;
  missing?: number;
  coveragePercentage?: number;
  daysChecked?: number;
  error?: string;
  stack?: string;
  status?: number;
  contentType?: string;
  daysProcessed?: number;
  daysSkipped?: number;
  daysFailed?: number;
}

const logger = createLogger('summary-handlers');

/**
 * Handle daily summary API requests
 */
export async function handleDailySummaryAPI(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const dateParam = url.searchParams.get('date');

  try {
    logger.info('Daily summary API requested', {
      requestId,
      dateParam: dateParam || 'today'
    } as LogContext);

    // Use provided date or default to today
    const targetDate = dateParam || new Date().toISOString().split('T')[0];

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      logger.warn('Invalid date format provided', {
        requestId,
        providedDate: dateParam,
        expectedFormat: 'YYYY-MM-DD'
      } as LogContext);

      const errorResponse: DailySummaryApiResponse = {
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD format.',
        provided_date: dateParam,
        example: '2025-09-27',
        request_id: requestId
      };

      return new Response(JSON.stringify(errorResponse, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Try to get existing daily summary
    let dailySummary = await getDailySummary(targetDate, env);

    if (!dailySummary) {
      logger.info('Daily summary not found, generating new one', {
        requestId,
        targetDate
      } as LogContext);

      // Generate new daily summary if it doesn't exist
      dailySummary = await generateDailySummary(targetDate, env);
    }

    logger.info('Daily summary API completed', {
      requestId,
      targetDate,
      totalPredictions: dailySummary?.data?.summary?.total_predictions || 0,
      accuracy: dailySummary?.data?.summary?.overall_accuracy || 0
    } as LogContext);

    logBusinessMetric('daily_summary_api_request', 1, {
      requestId,
      targetDate,
      generated: !dailySummary
    });

    const successResponse: DailySummaryApiResponse = {
      success: true,
      data: dailySummary,
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(successResponse, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    logger.error('Daily summary API failed', {
      requestId,
      dateParam,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    } as LogContext);

    const errorResponse: DailySummaryApiResponse = {
      success: false,
      error: error.message,
      provided_date: dateParam,
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle daily summary page requests
 */
export async function handleDailySummaryPageRequest(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Daily summary page requested', { requestId } as LogContext);

    const response = await handleDailySummaryPage(request, env);

    logger.info('Daily summary page served', {
      requestId,
      status: response.status,
      contentType: response.headers.get('Content-Type')
    } as LogContext);

    logBusinessMetric('daily_summary_page_view', 1, { requestId });

    return response;
  } catch (error: any) {
    logger.error('Daily summary page failed', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    } as LogContext);

    return new Response(`
      <html>
        <head><title>Error - Daily Summary</title></head>
        <body>
          <h1>Daily Summary Error</h1>
          <p>Failed to load daily summary page: ${error.message}</p>
          <p>Request ID: ${requestId}</p>
        </body>
      </html>
    `, {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/**
 * Handle backfill daily summaries requests
 */
export async function handleBackfillDailySummaries(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');
  const skipExistingParam = url.searchParams.get('skipExisting');

  try {
    const days = daysParam ? parseInt(daysParam, 10) : 30;
    const skipExisting = skipExistingParam !== 'false'; // Default to true

    logger.info('Backfill daily summaries requested', {
      requestId,
      daysRequested: days,
      skipExisting
    } as LogContext);

    if (days > 365) {
      logger.warn('Backfill request exceeds maximum days', {
        requestId,
        daysRequested: days,
        maximum: 365
      } as LogContext);

      const errorResponse: BackfillApiResponse = {
        success: false,
        error: 'Maximum backfill period is 365 days',
        requested_days: days,
        maximum_days: 365,
        request_id: requestId
      };

      return new Response(JSON.stringify(errorResponse, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const backfillResult = await backfillDailySummaries(env, days, skipExisting);

    logger.info('Backfill daily summaries completed', {
      requestId,
      daysRequested: days,
      processed: backfillResult.processed,
      skipped: backfillResult.skipped,
      failed: backfillResult.failed
    } as LogContext);

    logBusinessMetric('backfill_operation', 1, {
      requestId,
      daysProcessed: backfillResult.processed,
      daysSkipped: backfillResult.skipped,
      daysFailed: backfillResult.failed
    });

    const successResponse: BackfillApiResponse = {
      success: true,
      backfill_result: backfillResult,
      parameters: {
        days: days,
        skip_existing: skipExisting,
        trading_days_only: false
      },
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(successResponse, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    logger.error('Backfill daily summaries failed', {
      requestId,
      daysParam,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    } as LogContext);

    const errorResponse: BackfillApiResponse = {
      success: false,
      error: error.message,
      parameters: {
        days: daysParam ? parseInt(daysParam, 10) : 0,
        skip_existing: skipExistingParam !== null
      },
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle verify backfill requests
 */
export async function handleVerifyBackfill(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const daysParam = url.searchParams.get('days');

  try {
    const daysToCheck = daysParam ? parseInt(daysParam, 10) : 10;

    logger.info('Verify backfill requested', {
      requestId,
      daysToCheck
    } as LogContext);

    if (daysToCheck > 100) {
      logger.warn('Verify backfill request exceeds maximum days', {
        requestId,
        daysRequested: daysToCheck,
        maximum: 100
      } as LogContext);

      const errorResponse: VerifyBackfillApiResponse = {
        success: false,
        error: 'Maximum verification period is 100 days',
        requested_days: daysToCheck,
        maximum_days: 100,
        request_id: requestId
      };

      return new Response(JSON.stringify(errorResponse, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const verificationResult: VerificationResult = {
      verification_date: new Date().toISOString(),
      days_checked: daysToCheck,
      found: 0,
      missing: 0,
      coverage_percentage: 0,
      details: []
    };

    // Check each date for the specified number of days
    for (let i = 0; i < daysToCheck; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      try {
        const summary = await getDailySummary(dateStr, env);
        if (summary && summary.success) {
          verificationResult.found++;
          verificationResult.details.push({
            date: dateStr,
            status: 'found',
            predictions: summary.data?.summary?.total_predictions || 0,
            accuracy: summary.data?.summary?.overall_accuracy || 0,
            generated_at: summary.data?.generated_at,
            is_trading_day: summary.data?.is_trading_day
          });
        } else {
          verificationResult.missing++;
          verificationResult.details.push({
            date: dateStr,
            status: 'missing'
          });
        }
      } catch (error: any) {
        verificationResult.missing++;
        verificationResult.details.push({
          date: dateStr,
          status: 'error',
          error: (error instanceof Error ? error.message : String(error))
        });
      }
    }

    verificationResult.coverage_percentage = Math.round(
      (verificationResult.found / daysToCheck) * 100
    );

    logger.info('Verify backfill completed', {
      requestId,
      daysChecked: daysToCheck,
      found: verificationResult.found,
      missing: verificationResult.missing,
      coveragePercentage: verificationResult.coverage_percentage
    } as LogContext);

    logBusinessMetric('backfill_verification', 1, {
      requestId,
      coveragePercentage: verificationResult.coverage_percentage,
      daysChecked: daysToCheck
    });

    const successResponse: VerifyBackfillApiResponse = {
      success: true,
      verification_result: verificationResult,
      parameters: {
        days_checked: daysToCheck
      },
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(successResponse, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    logger.error('Verify backfill failed', {
      requestId,
      daysParam,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    } as LogContext);

    const errorResponse: VerifyBackfillApiResponse = {
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Export types for external use
export type {
  DailySummary,
  BackfillResult,
  BackfillSummary,
  VerificationResult,
  VerificationDetail,
  DailySummaryApiResponse,
  BackfillApiResponse,
  VerifyBackfillApiResponse,
  ProcessedSymbolData,
  SummaryMetrics,
  MorningPrediction,
  MiddayUpdate,
  DailyValidation,
  NextDayOutlook,
  ChartsData,
  SentimentCounts
};