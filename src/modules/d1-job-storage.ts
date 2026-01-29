/**
 * D1 Job Storage Adapter
 * Reads job results from D1 as fallback when DO cache misses
 * Writes report snapshots to D1 for persistence
 */

import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('d1-job-storage');

export interface D1SymbolPrediction {
  id: number;
  symbol: string;
  prediction_date: string;
  sentiment: string;
  confidence: number;
  direction: string;
  model: string | null;
  analysis_type: string | null;
  trading_signals: string | null;
  created_at: string;
  // Status and error tracking
  status?: string;
  error_message?: string | null;
  raw_response?: string | null;
  error_summary?: string | null;
  // Article tracking
  articles_count?: number;
  articles_content?: string;
  news_source?: string;
  // Dual model tracking columns
  gemma_status?: string;
  gemma_error?: string;
  gemma_confidence?: number;
  gemma_response_time_ms?: number;
  distilbert_status?: string;
  distilbert_error?: string;
  distilbert_confidence?: number;
  distilbert_response_time_ms?: number;
  model_selection_reason?: string;
}

export interface D1JobExecution {
  id: number;
  job_type: string;
  scheduled_date?: string | null;
  status: string;
  executed_at: string;
  execution_time_ms: number;
  symbols_processed: number;
  symbols_successful: number;
  symbols_fallback: number;
  symbols_failed: number;
  success_rate: number;
  errors: string;
  created_at: string;
}

export interface D1ScheduledJobResult {
  id: number;
  scheduled_date: string;  // The market date this report is FOR
  report_type: string;
  report_content: string;
  metadata: string;
  created_at: string;      // When the report was generated
}

/**
 * Trigger source types for tracking who/what initiated a job
 */
export type TriggerSource = 'github-actions' | 'manual-api' | 'cron' | 'scheduler' | 'unknown';

/**
 * Write report snapshot to D1 scheduled_job_results table
 * Multi-run: inserts a new row per write (latest is selected by created_at)
 * Safe: returns false if table doesn't exist (migration not applied)
 *
 * @param scheduledDate - The market date this report is FOR
 * @param reportType - Type of report (pre-market, intraday, etc.)
 * @param reportContent - The report data
 * @param metadata - Optional metadata
 * @param triggerSource - What triggered this job
 */
export async function writeD1JobResult(
  env: CloudflareEnvironment,
  scheduledDate: string,
  reportType: string,
  reportContent: any,
  metadata?: any,
  triggerSource: TriggerSource = 'unknown',
  runId?: string
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    logger.warn('D1 database not available for write');
    return false;
  }

  const contentJson = JSON.stringify(reportContent);
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  const createdAt = new Date().toISOString();

  try {
    await db.prepare(`
      INSERT INTO scheduled_job_results (scheduled_date, report_type, report_content, metadata, trigger_source, run_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(scheduledDate, reportType, contentJson, metadataJson, triggerSource, runId ?? null, createdAt).run();

    logger.info('D1 report snapshot written', { scheduledDate, reportType, triggerSource });
    return true;
  } catch (error) {
    const errMsg = (error as Error).message;
    if (errMsg.includes('no column named trigger_source')) {
      // Fallback: write without trigger_source if column doesn't exist yet
      logger.warn('trigger_source column not found - writing without it', { scheduledDate, reportType });
      await db.prepare(`
        INSERT INTO scheduled_job_results (scheduled_date, report_type, report_content, metadata, run_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(scheduledDate, reportType, contentJson, metadataJson, runId ?? null, createdAt).run();
      return true;
    } else if (errMsg.includes('no column named run_id')) {
      // Fallback: older schema without run_id
      logger.warn('run_id column not found - writing without it', { scheduledDate, reportType });
      await db.prepare(`
        INSERT INTO scheduled_job_results (scheduled_date, report_type, report_content, metadata, trigger_source, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(scheduledDate, reportType, contentJson, metadataJson, triggerSource, createdAt).run();
      return true;
    } else if (errMsg.includes('no such table') || errMsg.includes('scheduled_job_results')) {
      logger.warn('D1 scheduled_job_results table not found - migration not applied', { scheduledDate, reportType });
    } else {
      logger.error('D1 write failed', { error: errMsg, scheduledDate, reportType });
    }
    return false;
  }
}

/**
 * Delete existing report snapshot for a specific scheduled_date + report_type
 * Safe: returns true even if table doesn't exist (graceful no-op)
 */
export async function deleteD1ReportSnapshot(
  env: CloudflareEnvironment,
  scheduledDate: string,
  reportType: string
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    logger.warn('D1 database not available for delete');
    return true; // Graceful no-op
  }

  try {
    await db.prepare(
      `DELETE FROM scheduled_job_results
       WHERE scheduled_date = ? AND report_type = ?`
    ).bind(scheduledDate, reportType).run();

    logger.info('Deleted D1 report snapshot', { scheduledDate, reportType });
    return true;
  } catch (error) {
    const errMsg = (error as Error).message;
    if (errMsg.includes('no such table') || errMsg.includes('scheduled_job_results')) {
      logger.warn('D1 scheduled_job_results table not found - skipping delete', { scheduledDate, reportType });
      return true; // Graceful no-op if table doesn't exist
    }
    logger.error('D1 delete failed', { error: errMsg, scheduledDate, reportType });
    return false;
  }
}

/**
 * Read report snapshot from D1
 * Key selector: scheduled_date + report_type
 * Safe: returns null if table doesn't exist
 */
export async function readD1ReportSnapshot(
  env: CloudflareEnvironment,
  scheduledDate: string,
  reportType: string
): Promise<{ data: any; createdAt: string; scheduledDate: string; runId: string | null } | null> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return null;

  // Row type including run_id
  type SnapshotRow = { report_content: string; metadata: string; created_at: string; scheduled_date: string; run_id: string | null };

  // Helper to parse result
  const parseResult = (result: SnapshotRow | null) => {
    if (!result?.report_content) return null;
    try {
      const content = JSON.parse(result.report_content);
      content._d1_metadata = result.metadata ? JSON.parse(result.metadata) : null;
      content._source = 'd1_snapshot';
      content._d1_created_at = result.created_at;
      content._scheduled_date = result.scheduled_date;
      content._run_id = result.run_id;  // Inject run_id into content for lineage
      return { data: content, createdAt: result.created_at, scheduledDate: result.scheduled_date, runId: result.run_id };
    } catch (parseError) {
      logger.error('D1 JSON parse failed', { scheduledDate, reportType, error: (parseError as Error).message });
      return null;
    }
  };

  try {
    // Prefer rows with run_id (from proper job tracking) over legacy rows without
    const result = await db.prepare(
      `SELECT report_content, metadata, created_at, scheduled_date, run_id
       FROM scheduled_job_results
       WHERE scheduled_date = ? AND report_type = ?
       ORDER BY
         CASE WHEN run_id IS NOT NULL THEN 0 ELSE 1 END,
         created_at DESC
       LIMIT 1`
    ).bind(scheduledDate, reportType).first<SnapshotRow>();

    return parseResult(result);
  } catch (error) {
    const errMsg = (error as Error).message;

    // Fallback: If run_id column doesn't exist, retry without it
    if (errMsg.includes('no such column') && errMsg.includes('run_id')) {
      logger.warn('run_id column not found in scheduled_job_results - using legacy query', { scheduledDate, reportType });
      try {
        const result = await db.prepare(
          `SELECT report_content, metadata, created_at, scheduled_date
           FROM scheduled_job_results
           WHERE scheduled_date = ? AND report_type = ?
           ORDER BY created_at DESC
           LIMIT 1`
        ).bind(scheduledDate, reportType).first<{ report_content: string; metadata: string; created_at: string; scheduled_date: string }>();
        // Legacy path: no run_id column
        if (!result?.report_content) return null;
        try {
          const content = JSON.parse(result.report_content);
          content._d1_metadata = result.metadata ? JSON.parse(result.metadata) : null;
          content._source = 'd1_snapshot';
          content._d1_created_at = result.created_at;
          content._scheduled_date = result.scheduled_date;
          content._run_id = null;
          return { data: content, createdAt: result.created_at, scheduledDate: result.scheduled_date, runId: null };
        } catch (parseError) {
          logger.error('D1 JSON parse failed (legacy)', { scheduledDate, reportType, error: (parseError as Error).message });
          return null;
        }
      } catch (fallbackError) {
        logger.error('D1 fallback read failed', { error: (fallbackError as Error).message, scheduledDate, reportType });
        return null;
      }
    }

    if (errMsg.includes('no such table')) {
      logger.debug('D1 scheduled_job_results table not found - using predictions fallback');
    } else {
      logger.error('D1 read failed', { error: errMsg, scheduledDate, reportType });
    }
    return null;
  }
}

/**
 * Read report snapshot by run_id (for accessing specific historical runs)
 */
export async function readD1ReportSnapshotByRunId(
  env: CloudflareEnvironment,
  runId: string
): Promise<{ data: any; createdAt: string; scheduledDate: string; reportType: string } | null> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return null;

  try {
    const result = await db.prepare(`
      SELECT report_content, created_at, scheduled_date, report_type
      FROM scheduled_job_results
      WHERE run_id = ?
      LIMIT 1
    `).bind(runId).first<{ report_content: string; created_at: string; scheduled_date: string; report_type: string }>();

    if (!result?.report_content) return null;

    const content = JSON.parse(result.report_content);
    content._source = 'd1_snapshot_by_run_id';
    content._d1_created_at = result.created_at;
    content._scheduled_date = result.scheduled_date;
    
    return {
      data: content,
      createdAt: result.created_at,
      scheduledDate: result.scheduled_date,
      reportType: result.report_type
    };
  } catch (error) {
    logger.error('readD1ReportSnapshotByRunId failed', { error: (error as Error).message, runId });
    return null;
  }
}

/**
 * Get latest report snapshot from D1 (any date)
 * Returns the most recent report by scheduled_date
 * Safe: returns null if table doesn't exist
 */
export async function getD1LatestReportSnapshot(
  env: CloudflareEnvironment,
  reportType: string
): Promise<{ data: any; scheduledDate: string; createdAt: string; runId: string | null } | null> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return null;

  type LatestRow = { scheduled_date: string; report_content: string; metadata: string; created_at: string; run_id: string | null };

  try {
    const result = await db.prepare(
      `SELECT scheduled_date, report_content, metadata, created_at, run_id
       FROM scheduled_job_results
       WHERE report_type = ?
       ORDER BY scheduled_date DESC, created_at DESC
       LIMIT 1`
    ).bind(reportType).first<LatestRow>();

    if (result?.report_content) {
      try {
        const content = JSON.parse(result.report_content);
        content._d1_metadata = result.metadata ? JSON.parse(result.metadata) : null;
        content._source = 'd1_snapshot';
        content._d1_created_at = result.created_at;
        content._scheduled_date = result.scheduled_date;
        content._run_id = result.run_id;
        content.source_date = result.scheduled_date;
        return { data: content, scheduledDate: result.scheduled_date, createdAt: result.created_at, runId: result.run_id };
      } catch (parseError) {
        logger.error('D1 JSON parse failed', { reportType, error: (parseError as Error).message });
        return null;
      }
    }
    return null;
  } catch (error) {
    const errMsg = (error as Error).message;
    // Handle missing run_id column gracefully (legacy schema)
    if (errMsg.includes('no such column') && errMsg.includes('run_id')) {
      logger.warn('run_id column not found in getD1LatestReportSnapshot - using legacy query', { reportType });
      try {
        const result = await db.prepare(
          `SELECT scheduled_date, report_content, metadata, created_at
           FROM scheduled_job_results
           WHERE report_type = ?
           ORDER BY scheduled_date DESC, created_at DESC
           LIMIT 1`
        ).bind(reportType).first<{ scheduled_date: string; report_content: string; metadata: string; created_at: string }>();
        if (result?.report_content) {
          const content = JSON.parse(result.report_content);
          content._d1_metadata = result.metadata ? JSON.parse(result.metadata) : null;
          content._source = 'd1_snapshot';
          content._d1_created_at = result.created_at;
          content._scheduled_date = result.scheduled_date;
          content._run_id = null;
          content.source_date = result.scheduled_date;
          return { data: content, scheduledDate: result.scheduled_date, createdAt: result.created_at, runId: null };
        }
        return null;
      } catch (fallbackError) {
        logger.error('D1 latest read failed (legacy fallback)', { error: (fallbackError as Error).message, reportType });
        return null;
      }
    }
    if (!errMsg.includes('no such table')) {
      logger.error('D1 latest read failed', { error: errMsg, reportType });
    }
    return null;
  }
}

/**
 * Get symbol predictions from D1 for a specific date
 */
export async function getD1Predictions(
  env: CloudflareEnvironment,
  date: string
): Promise<D1SymbolPrediction[] | null> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    logger.warn('D1 database not available');
    return null;
  }

  try {
    const result = await db.prepare(
      'SELECT * FROM symbol_predictions WHERE prediction_date = ? ORDER BY created_at DESC'
    ).bind(date).all<D1SymbolPrediction>();

    if (result.results && result.results.length > 0) {
      logger.info('D1 fallback: Found predictions', { date, count: result.results.length });
      return result.results;
    }
    return null;
  } catch (error) {
    logger.error('D1 query failed', { error: (error as Error).message });
    return null;
  }
}

/**
 * Get latest job execution from D1
 */
export async function getD1LatestJob(
  env: CloudflareEnvironment,
  jobType?: string
): Promise<D1JobExecution | null> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return null;

  try {
    const query = jobType
      ? 'SELECT * FROM job_executions WHERE job_type = ? ORDER BY executed_at DESC LIMIT 1'
      : 'SELECT * FROM job_executions ORDER BY executed_at DESC LIMIT 1';
    
    const stmt = jobType ? db.prepare(query).bind(jobType) : db.prepare(query);
    const result = await stmt.first<D1JobExecution>();
    return result || null;
  } catch (error) {
    logger.error('D1 job query failed', { error: (error as Error).message });
    return null;
  }
}

/**
 * Transform D1 predictions to analysis format expected by reports
 */
export function transformD1ToAnalysis(predictions: D1SymbolPrediction[]): any {
  const signals = predictions.map(p => {
    let tradingSignals: any = {};
    try {
      tradingSignals = JSON.parse(p.trading_signals || '{}');
    } catch { /* ignore parse errors */ }

    // Build dual_model structure from D1 columns
    const dualModel: any = {};
    if (p.gemma_status || p.gemma_confidence !== undefined) {
      dualModel.gemma = {
        status: p.gemma_status || 'unknown',
        confidence: p.gemma_confidence,
        error: p.gemma_error,
        response_time_ms: p.gemma_response_time_ms,
        direction: p.sentiment // Gemma is primary, so use main sentiment
      };
    }
    if (p.distilbert_status || p.distilbert_confidence !== undefined) {
      dualModel.distilbert = {
        status: p.distilbert_status || 'unknown',
        confidence: p.distilbert_confidence,
        error: p.distilbert_error,
        response_time_ms: p.distilbert_response_time_ms,
        direction: p.direction
      };
    }
    if (p.model_selection_reason) {
      dualModel.selection_reason = p.model_selection_reason;
    }

    return {
      symbol: p.symbol,
      direction: p.sentiment || p.direction,
      confidence: p.confidence,
      overall_confidence: p.confidence,
      recommendation: tradingSignals.recommendation || 'HOLD',
      agreement_type: tradingSignals.signal_type === 'AGREEMENT' ? 'full_agreement' : 'partial_agreement',
      gpt_sentiment: p.sentiment,
      gpt_confidence: p.gemma_confidence ?? p.confidence,
      gpt_reasoning: tradingSignals.entry_signals?.reasoning || '',
      distilbert_sentiment: p.direction,
      distilbert_confidence: p.distilbert_confidence ?? p.confidence,
      news_count: p.articles_count || 0,
      articles_count: p.articles_count || 0,
      articles_content: p.articles_content,
      news_source: p.news_source,
      top_articles: [],
      dual_model: Object.keys(dualModel).length > 0 ? dualModel : undefined,
      models: Object.keys(dualModel).length > 0 ? {
        gpt: dualModel.gemma,
        distilbert: dualModel.distilbert
      } : undefined
    };
  });

  return {
    timestamp: predictions[0]?.created_at || new Date().toISOString(),
    generated_at: predictions[0]?.created_at || new Date().toISOString(),
    market_sentiment: {
      overall_sentiment: calculateOverallSentiment(predictions),
      sentiment_label: calculateOverallSentiment(predictions),
      confidence: calculateAverageConfidence(predictions)
    },
    signals,
    overall_confidence: calculateAverageConfidence(predictions),
    source: 'd1_fallback'
  };
}

/**
 * Transform D1 predictions to PredictionsData format (for intraday/EOD)
 */
export function transformD1ToPredictions(predictions: D1SymbolPrediction[]): any {
  return {
    predictions: predictions.map(p => {
      let tradingSignals: any = {};
      try {
        tradingSignals = JSON.parse(p.trading_signals || '{}');
      } catch { /* ignore */ }

      return {
        symbol: p.symbol,
        prediction: p.direction?.toLowerCase() === 'up' ? 'up' : (p.direction?.toLowerCase() === 'down' ? 'down' : 'neutral'),
        confidence: p.confidence,
        status: 'tracking',
        performance: { accuracy: 0, isCorrect: false, actualChange: 0 }
      };
    }),
    generatedAt: predictions[0]?.created_at || new Date().toISOString(),
    source: 'd1_fallback'
  };
}

function calculateOverallSentiment(predictions: D1SymbolPrediction[]): string {
  const sentiments = predictions.map(p => p.sentiment?.toLowerCase() || 'neutral');
  const bullish = sentiments.filter(s => s === 'bullish' || s === 'up').length;
  const bearish = sentiments.filter(s => s === 'bearish' || s === 'down').length;
  
  if (bullish > bearish) return 'BULLISH';
  if (bearish > bullish) return 'BEARISH';
  return 'NEUTRAL';
}

function calculateAverageConfidence(predictions: D1SymbolPrediction[]): number {
  if (predictions.length === 0) return 0;
  const sum = predictions.reduce((acc, p) => acc + (p.confidence || 0), 0);
  return sum / predictions.length;
}


/**
 * Generic D1 fallback for any report type
 * Tries: D1 snapshot (today) → D1 snapshot (latest) → D1 predictions (today) → D1 predictions (yesterday)
 * Returns data with source metadata; caller decides whether to cache
 * Uses predictions-shaped data for intraday/end-of-day, analysis-shaped for others
 * 
 * Stale fallback rules:
 * - If querying today and before scheduled time → return null (pending state)
 * - If querying today and after scheduled time but no data → return stale with warning
 * - If querying past date → return stale fallback if available
 */
export async function getD1FallbackData(
  env: CloudflareEnvironment,
  dateStr: string,
  reportType: string,
  options: { skipTodaySnapshot?: boolean; allowStaleForToday?: boolean } = {}
): Promise<{ data: any; source: string; sourceDate: string; isStale: boolean; createdAt?: string | null; runId?: string | null } | null> {
  const usePredictionsShape = reportType === 'intraday' || reportType === 'end-of-day' || reportType === 'predictions';

  // Determine if querying "today" in ET
  const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayET = nowET.toISOString().split('T')[0];
  const isQueryingToday = dateStr === todayET;

  // Schedule times in ET (hour)
  const scheduleHoursET: Record<string, number> = {
    'pre-market': 8,   // 8:30 AM ET
    'intraday': 12,    // 12:00 PM ET
    'end-of-day': 16,  // 4:05 PM ET
    'weekly': 10       // 10:00 AM ET (Sunday)
  };
  const scheduleMinutesET: Record<string, number> = {
    'pre-market': 30,
    'intraday': 0,
    'end-of-day': 5,
    'weekly': 0
  };
  const scheduleHour = scheduleHoursET[reportType] ?? 8;
  const scheduleMinute = scheduleMinutesET[reportType] ?? 0;
  const currentHourET = nowET.getHours();
  const currentMinuteET = nowET.getMinutes();
  const isBeforeSchedule = currentHourET < scheduleHour || (currentHourET === scheduleHour && currentMinuteET < scheduleMinute);

  // Allow stale for today defaults to false for all reports - never show wrong scheduled_date
  // If querying Jan 20, only show data with scheduled_date = Jan 20, not Jan 19
  const allowStaleForToday = options.allowStaleForToday ?? false;

  // 1. Try D1 snapshot for requested scheduled_date (key selector)
  if (!options.skipTodaySnapshot) {
    const snapshotResult = await readD1ReportSnapshot(env, dateStr, reportType);
    if (snapshotResult) {
      // Verify the scheduled_date matches what was requested
      const snapshotScheduledDate = snapshotResult.scheduledDate || snapshotResult.data?._scheduled_date || snapshotResult.data?.source_date;
      const isExactMatch = snapshotScheduledDate === dateStr;

      if (isExactMatch) {
        return { data: snapshotResult.data, source: 'd1_snapshot', sourceDate: dateStr, isStale: false, createdAt: snapshotResult.createdAt, runId: snapshotResult.runId };
      }
      // scheduled_date mismatch - treat as not found
      logger.debug('D1 fallback: scheduled_date mismatch', { requested: dateStr, found: snapshotScheduledDate, reportType });
    }
  }

  // 2. If querying today and before schedule, don't return stale data (pending state)
  if (isQueryingToday && isBeforeSchedule && !allowStaleForToday) {
    logger.debug('D1 fallback: querying today before schedule, returning null (pending)', { reportType, dateStr, currentHourET, currentMinuteET, scheduleHour, scheduleMinute });
    return null;
  }

  // 3. Try latest D1 snapshot ONLY if allowStaleForToday is explicitly true
  // By default, we DON'T show data from a different scheduled_date
  if (!allowStaleForToday) {
    logger.debug('D1 fallback: no exact scheduled_date match and stale not allowed', { requested: dateStr, reportType });
    return null;
  }

  const latestSnapshot = await getD1LatestReportSnapshot(env, reportType);
  if (latestSnapshot) {
    const isStale = latestSnapshot.scheduledDate !== dateStr;
    
    // If querying today and latest is from a different day, only return if explicitly allowed or after schedule
    if (isQueryingToday && isStale && !allowStaleForToday && isBeforeSchedule) {
      logger.debug('D1 fallback: stale snapshot exists but querying today before schedule', { reportType, dateStr, snapshotDate: latestSnapshot.scheduledDate, currentHourET, currentMinuteET, scheduleHour, scheduleMinute });
      return null;
    }
    
    latestSnapshot.data.is_stale = isStale;
    latestSnapshot.data.source_date = latestSnapshot.scheduledDate;
    return {
      data: latestSnapshot.data,
      source: 'd1_snapshot',
      sourceDate: latestSnapshot.scheduledDate,
      isStale,
      createdAt: latestSnapshot.createdAt,
      runId: latestSnapshot.runId
    };
  }

  // 4. Try D1 predictions for today
  let predictions = await getD1Predictions(env, dateStr);
  if (predictions && predictions.length > 0) {
    const data = usePredictionsShape ? transformD1ToPredictions(predictions) : transformD1ToAnalysis(predictions);
    return { data, source: 'd1_predictions', sourceDate: dateStr, isStale: false, createdAt: data.generated_at || null };
  }

  // 5. Try D1 predictions for yesterday
  const yesterday = new Date(dateStr);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  predictions = await getD1Predictions(env, yesterdayStr);
  if (predictions && predictions.length > 0) {
    const data = usePredictionsShape ? transformD1ToPredictions(predictions) : transformD1ToAnalysis(predictions);
    data.is_stale = true;
    data.source_date = yesterdayStr;
    return { data, source: 'd1_predictions', sourceDate: yesterdayStr, isStale: true, createdAt: data.generated_at || null };
  }

  return null;
}

/**
 * Update job status in D1 job_executions table
 * Replaces KV-based updateJobStatus for unified storage
 */
export async function updateD1JobStatus(
  env: CloudflareEnvironment,
  jobType: string,
  date: string,
  status: 'done' | 'partial' | 'failed' | 'running' | 'pending',
  metadata: {
    symbols_processed?: number;
    execution_time_ms?: number;
    symbols_successful?: number;
    symbols_fallback?: number;
    symbols_failed?: number;
    errors?: string[];
    [key: string]: any;
  } = {},
  options?: { scheduledDate?: string }
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    logger.warn('D1 database not available for job status update');
    return false;
  }

  // Normalize scheduled date to ET to avoid timezone drift in comparisons
  const normalizeToETDate = (dateStr: string): string => {
    const base = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00Z`);
    const etDate = new Date(base.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    return etDate.toISOString().split('T')[0];
  };

  const executedAt = new Date().toISOString();
  const scheduledDate = normalizeToETDate(options?.scheduledDate || date);
  const symbolsProcessed = metadata.symbols_processed ?? 0;
  const symbolsSuccessful = metadata.symbols_successful ?? symbolsProcessed;
  const symbolsFallback = metadata.symbols_fallback ?? 0;
  const symbolsFailed = metadata.symbols_failed ?? 0;
  const successRate = symbolsProcessed > 0 ? (symbolsSuccessful / symbolsProcessed) : 1;
  const errorsJson = JSON.stringify(metadata.errors || []);

  try {
    await db.prepare(`
      INSERT INTO job_executions (job_type, scheduled_date, status, executed_at, execution_time_ms, symbols_processed, symbols_successful, symbols_fallback, symbols_failed, success_rate, errors)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      jobType,
      scheduledDate,
      status === 'done' ? 'success' : status,
      executedAt,
      metadata.execution_time_ms ?? 0,
      symbolsProcessed,
      symbolsSuccessful,
      symbolsFallback,
      symbolsFailed,
      successRate,
      errorsJson
    ).run();

    logger.info('D1 job status updated', { jobType, date, scheduledDate, status, symbolsProcessed });
    return true;
  } catch (error) {
    const errMsg = (error as Error).message;
    if (errMsg.includes('no column named scheduled_date')) {
      logger.warn('job_executions.scheduled_date column not found - falling back to legacy insert', { jobType, date });
      try {
        await db.prepare(`
          INSERT INTO job_executions (job_type, status, executed_at, execution_time_ms, symbols_processed, symbols_successful, symbols_fallback, symbols_failed, success_rate, errors)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          jobType,
          status === 'done' ? 'success' : status,
          executedAt,
          metadata.execution_time_ms ?? 0,
          symbolsProcessed,
          symbolsSuccessful,
          symbolsFallback,
          symbolsFailed,
          successRate,
          errorsJson
        ).run();
        return true;
      } catch (legacyError) {
        logger.error('D1 job status legacy insert failed', { error: (legacyError as Error).message, jobType, date });
        return false;
      }
    }
    if (errMsg.includes('no such table')) {
      logger.warn('D1 job_executions table not found - migration not applied', { jobType, date });
    } else {
      logger.error('D1 job status update failed', { error: errMsg, jobType, date });
    }
    return false;
  }
}

/**
 * Get job status from D1 job_executions table
 * Replaces KV-based getJobStatus
 */
export async function getD1JobStatus(
  env: CloudflareEnvironment,
  jobType: string,
  date: string
): Promise<{ status: string; timestamp: string; metadata: any; scheduled_date?: string } | null> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return null;

  const normalizeToETDate = (dateStr: string): string => {
    const base = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00Z`);
    const etDate = new Date(base.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    return etDate.toISOString().split('T')[0];
  };

  const scheduledDate = normalizeToETDate(date);

  try {
    const result = await db.prepare(`
      SELECT status, executed_at, execution_time_ms, symbols_processed, symbols_successful, symbols_fallback, symbols_failed, success_rate, errors, scheduled_date
      FROM job_executions
      WHERE job_type = ? AND coalesce(scheduled_date, DATE(executed_at)) = ?
      ORDER BY executed_at DESC
      LIMIT 1
    `).bind(jobType, scheduledDate).first<{
      status: string;
      executed_at: string;
      execution_time_ms: number;
      symbols_processed: number;
      symbols_successful: number;
      symbols_fallback: number;
      symbols_failed: number;
      success_rate: number;
      errors: string;
      scheduled_date?: string;
    }>();

    if (result) {
      return {
        status: result.status === 'success' ? 'done' : result.status,
        timestamp: result.executed_at,
        metadata: {
          execution_time_ms: result.execution_time_ms,
          symbols_processed: result.symbols_processed,
          symbols_successful: result.symbols_successful,
          symbols_fallback: result.symbols_fallback,
          symbols_failed: result.symbols_failed,
          success_rate: result.success_rate,
          errors: JSON.parse(result.errors || '[]')
        },
        scheduled_date: result.scheduled_date || scheduledDate
      };
    }
    return null;
  } catch (error) {
    logger.debug('D1 job status query failed', { error: (error as Error).message, jobType, date });
    return null;
  }
}

// ============================================================================
// Navigation Status Tables (job_date_results + job_stage_log)
// ============================================================================

export type ReportType = 'pre-market' | 'intraday' | 'end-of-day' | 'weekly' | 'sector-rotation';
export type JobStatus = 'running' | 'success' | 'partial' | 'failed';
export type JobStage = 'init' | 'data_fetch' | 'ai_analysis' | 'storage' | 'finalize';
export type JobTriggerSource = 'cron' | 'manual' | 'github_actions';

export interface JobDateResult {
  scheduled_date: string;
  report_type: ReportType;
  status: JobStatus;
  current_stage: JobStage | null;
  errors_json: string | null;
  warnings_json: string | null;
  executed_at: string | null;
  started_at: string | null;
  trigger_source: JobTriggerSource | null;
  latest_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobStageLogEntry {
  id: number;
  run_id: string;
  scheduled_date: string;
  report_type: ReportType;
  stage: JobStage;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface JobRunResult {
  run_id: string;
  scheduled_date: string;
  report_type: ReportType;
  status: JobStatus;
  current_stage: JobStage | null;
  errors_json: string | null;
  warnings_json: string | null;
  started_at: string;
  executed_at: string | null;
  trigger_source: JobTriggerSource | null;
  created_at: string;
}

export function generateRunId(scheduledDate: string, reportType: ReportType): string {
  return `${scheduledDate}_${reportType}_${crypto.randomUUID()}`;
}

export async function startJobRun(
  env: CloudflareEnvironment,
  params: {
    scheduledDate: string;
    reportType: ReportType;
    triggerSource: JobTriggerSource;
  }
): Promise<string | null> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return null;

  const runId = generateRunId(params.scheduledDate, params.reportType);
  const now = new Date().toISOString();

  try {
    await db.batch([
      db.prepare(`
        INSERT INTO job_run_results
        (run_id, scheduled_date, report_type, status, current_stage, started_at, trigger_source, created_at)
        VALUES (?, ?, ?, 'running', 'init', ?, ?, ?)
      `).bind(runId, params.scheduledDate, params.reportType, now, params.triggerSource, now),
      db.prepare(`
        INSERT INTO job_date_results
        (scheduled_date, report_type, status, started_at, trigger_source, current_stage, latest_run_id, updated_at, created_at)
        VALUES (?, ?, 'running', ?, ?, 'init', ?, ?, ?)
        ON CONFLICT(scheduled_date, report_type) DO UPDATE SET
          status = excluded.status,
          started_at = excluded.started_at,
          trigger_source = excluded.trigger_source,
          current_stage = excluded.current_stage,
          latest_run_id = excluded.latest_run_id,
          updated_at = excluded.updated_at,
          errors_json = NULL,
          warnings_json = NULL,
          executed_at = NULL
      `).bind(params.scheduledDate, params.reportType, now, params.triggerSource, runId, now, now),
    ]);

    return runId;
  } catch (error) {
    logger.error('startJobRun failed', { error: (error as Error).message, ...params });
    return null;
  }
}

export async function updateRunStage(
  env: CloudflareEnvironment,
  params: {
    runId: string;
    scheduledDate: string;
    reportType: ReportType;
    stage: JobStage;
  }
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return false;

  const now = new Date().toISOString();

  try {
    await db.batch([
      db.prepare(`UPDATE job_run_results SET current_stage = ? WHERE run_id = ?`).bind(params.stage, params.runId),
      db.prepare(`
        UPDATE job_date_results
        SET current_stage = ?, updated_at = ?
        WHERE scheduled_date = ? AND report_type = ? AND latest_run_id = ?
      `).bind(params.stage, now, params.scheduledDate, params.reportType, params.runId),
    ]);
    return true;
  } catch (error) {
    logger.debug('updateRunStage failed', { error: (error as Error).message, ...params });
    return false;
  }
}

export async function completeJobRun(
  env: CloudflareEnvironment,
  params: {
    runId: string;
    scheduledDate: string;
    reportType: ReportType;
    status: Exclude<JobStatus, 'running'>;
    errors?: string[];
    warnings?: string[];
    currentStage?: JobStage;
  }
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return false;

  const now = new Date().toISOString();
  const errorsJson = params.errors ? JSON.stringify(params.errors) : null;
  const warningsJson = params.warnings ? JSON.stringify(params.warnings) : null;
  const stage = params.currentStage ?? 'finalize';

  try {
    await db.batch([
      db.prepare(`
        UPDATE job_run_results
        SET status = ?, current_stage = ?, errors_json = ?, warnings_json = ?, executed_at = ?
        WHERE run_id = ?
      `).bind(params.status, stage, errorsJson, warningsJson, now, params.runId),
      db.prepare(`
        UPDATE job_date_results
        SET status = ?, current_stage = ?, errors_json = ?, warnings_json = ?, executed_at = ?, updated_at = ?
        WHERE scheduled_date = ? AND report_type = ? AND latest_run_id = ?
      `).bind(params.status, stage, errorsJson, warningsJson, now, now, params.scheduledDate, params.reportType, params.runId),
    ]);
    return true;
  } catch (error) {
    logger.error('completeJobRun failed', { error: (error as Error).message, ...params });
    return false;
  }
}

/**
 * Write or update job status in job_date_results table
 * Used for navigation status display
 */
export async function writeJobDateResult(
  env: CloudflareEnvironment,
  params: {
    scheduledDate: string;
    reportType: ReportType;
    status: JobStatus;
    currentStage?: JobStage;
    errors?: string[];
    warnings?: string[];
    triggerSource: JobTriggerSource;
  }
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    logger.warn('D1 database not available for writeJobDateResult');
    return false;
  }

  const now = new Date().toISOString();

  try {
    if (params.status === 'running') {
      // Job starting - insert with running status, preserve created_at on update
      await db.prepare(`
        INSERT INTO job_date_results
        (scheduled_date, report_type, status, started_at, trigger_source, current_stage, updated_at, created_at)
        VALUES (?, ?, 'running', ?, ?, ?, ?, ?)
        ON CONFLICT(scheduled_date, report_type) DO UPDATE SET
          status = excluded.status,
          started_at = excluded.started_at,
          trigger_source = excluded.trigger_source,
          current_stage = excluded.current_stage,
          updated_at = excluded.updated_at
      `).bind(
        params.scheduledDate,
        params.reportType,
        now,
        params.triggerSource,
        params.currentStage ?? 'init',
        now,
        now
      ).run();
    } else {
      // Job completed - update with final status, preserve started_at and created_at
      await db.prepare(`
        INSERT INTO job_date_results
        (scheduled_date, report_type, status, errors_json, warnings_json, executed_at, trigger_source, current_stage, updated_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(scheduled_date, report_type) DO UPDATE SET
          status = excluded.status,
          errors_json = excluded.errors_json,
          warnings_json = excluded.warnings_json,
          executed_at = excluded.executed_at,
          trigger_source = COALESCE(job_date_results.trigger_source, excluded.trigger_source),
          current_stage = excluded.current_stage,
          updated_at = excluded.updated_at
      `).bind(
        params.scheduledDate,
        params.reportType,
        params.status,
        params.errors ? JSON.stringify(params.errors) : null,
        params.warnings ? JSON.stringify(params.warnings) : null,
        now,
        params.triggerSource,
        params.currentStage ?? 'finalize',
        now,
        now
      ).run();
    }

    logger.info('Job date result written', {
      scheduledDate: params.scheduledDate,
      reportType: params.reportType,
      status: params.status,
      stage: params.currentStage
    });
    return true;
  } catch (error) {
    const errMsg = (error as Error).message;
    if (errMsg.includes('no such table')) {
      logger.warn('job_date_results table not found - migration not applied');
    } else {
      logger.error('writeJobDateResult failed', { error: errMsg, ...params });
    }
    return false;
  }
}

/**
 * Update current stage in job_date_results (for progress tracking)
 */
export async function updateJobStage(
  env: CloudflareEnvironment,
  scheduledDate: string,
  reportType: ReportType,
  stage: JobStage
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return false;

  try {
    await db.prepare(`
      UPDATE job_date_results
      SET current_stage = ?, updated_at = ?
      WHERE scheduled_date = ? AND report_type = ?
    `).bind(stage, new Date().toISOString(), scheduledDate, reportType).run();
    return true;
  } catch (error) {
    logger.debug('updateJobStage failed', { error: (error as Error).message });
    return false;
  }
}

/**
 * Start a job stage - append to job_stage_log
 */
export async function startJobStage(
  env: CloudflareEnvironment,
  params: {
    runId: string;
    scheduledDate: string;
    reportType: ReportType;
    stage: JobStage;
  }
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    logger.warn('D1 database not available for startJobStage');
    return false;
  }

  const now = new Date().toISOString();

  try {
    // Insert stage start
    await db.prepare(`
      INSERT INTO job_stage_log (run_id, scheduled_date, report_type, stage, started_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(params.runId, params.scheduledDate, params.reportType, params.stage, now).run();

    await updateRunStage(env, {
      runId: params.runId,
      scheduledDate: params.scheduledDate,
      reportType: params.reportType,
      stage: params.stage,
    });

    logger.debug('Job stage started', params);
    return true;
  } catch (error) {
    const errMsg = (error as Error).message;
    if (errMsg.includes('no such table')) {
      logger.warn('job_stage_log table not found - migration not applied');
    } else {
      logger.error('startJobStage failed', { error: errMsg, ...params });
    }
    return false;
  }
}

/**
 * End a job stage - update ended_at in job_stage_log
 */
export async function endJobStage(
  env: CloudflareEnvironment,
  params: {
    runId: string;
    stage: JobStage;
  }
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    logger.warn('D1 database not available for endJobStage');
    return false;
  }

  const now = new Date().toISOString();

  try {
    await db.prepare(`
      UPDATE job_stage_log
      SET ended_at = ?
      WHERE run_id = ? AND stage = ? AND ended_at IS NULL
    `).bind(now, params.runId, params.stage).run();

    logger.debug('Job stage ended', params);
    return true;
  } catch (error) {
    logger.error('endJobStage failed', { error: (error as Error).message, ...params });
    return false;
  }
}

/**
 * Get job date results for multiple dates (for navigation)
 */
export async function getJobDateResults(
  env: CloudflareEnvironment,
  dates: string[]
): Promise<Map<string, Map<ReportType, JobDateResult>>> {
  const db = env.PREDICT_JOBS_DB;
  const results = new Map<string, Map<ReportType, JobDateResult>>();

  if (!db || dates.length === 0) return results;

  try {
    // Query all results for the given dates
    const placeholders = dates.map(() => '?').join(',');
    const query = `
      SELECT * FROM job_date_results
      WHERE scheduled_date IN (${placeholders})
    `;
    const stmt = db.prepare(query);
    const bound = stmt.bind(...dates);
    const queryResult = await bound.all<JobDateResult>();

    // Organize results by date and report_type
    for (const row of queryResult.results || []) {
      if (!results.has(row.scheduled_date)) {
        results.set(row.scheduled_date, new Map());
      }
      results.get(row.scheduled_date)!.set(row.report_type, row);
    }

    return results;
  } catch (error) {
    const errMsg = (error as Error).message;
    if (!errMsg.includes('no such table')) {
      logger.error('getJobDateResults failed', { error: errMsg, dates });
    }
    return results;
  }
}

/**
 * Get stage log for a specific job (for debugging/display)
 */
export async function getJobStageLog(
  env: CloudflareEnvironment,
  params: {
    scheduledDate?: string;
    reportType?: ReportType;
    runId?: string;
  }
): Promise<JobStageLogEntry[]> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return [];

  try {
    if (params.runId) {
      const result = await db.prepare(`
        SELECT * FROM job_stage_log
        WHERE run_id = ?
        ORDER BY started_at ASC
      `).bind(params.runId).all<JobStageLogEntry>();
      return result.results || [];
    }

    if (!params.scheduledDate || !params.reportType) return [];

    const result = await db.prepare(`
      SELECT * FROM job_stage_log
      WHERE scheduled_date = ? AND report_type = ?
      ORDER BY started_at ASC
    `).bind(params.scheduledDate, params.reportType).all<JobStageLogEntry>();

    return result.results || [];
  } catch (error) {
    logger.debug('getJobStageLog failed', { error: (error as Error).message });
    return [];
  }
}

/**
 * Mark stale running jobs as failed (for cleanup)
 * Jobs running for more than 30 minutes are considered stale
 */
export async function markStaleJobsAsFailed(
  env: CloudflareEnvironment
): Promise<number> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return 0;

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  try {
    const results = await db.batch([
      db.prepare(`
        UPDATE job_run_results
        SET status = 'failed',
            errors_json = json_array('Job stalled - marked as failed after 30 minutes'),
            executed_at = ?
        WHERE status = 'running' AND started_at < ?
      `).bind(now, thirtyMinutesAgo),
      db.prepare(`
        UPDATE job_date_results
        SET status = 'failed',
            errors_json = json_array('Job stalled - marked as failed after 30 minutes'),
            executed_at = ?,
            updated_at = ?
        WHERE status = 'running' AND started_at < ?
      `).bind(now, now, thirtyMinutesAgo),
    ]);

    const affected = results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
    if (affected > 0) {
      logger.warn('Marked stale jobs as failed', { count: affected });
    }
    return affected;
  } catch (error) {
    logger.error('markStaleJobsAsFailed failed', { error: (error as Error).message });
    return 0;
  }
}
