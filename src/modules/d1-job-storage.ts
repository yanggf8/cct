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
  model: string;
  analysis_type: string;
  trading_signals: string;
  created_at: string;
}

export interface D1JobExecution {
  id: number;
  job_type: string;
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
  execution_date: string;
  report_type: string;
  report_content: string;
  metadata: string;
  created_at: string;
}

/**
 * Trigger source types for tracking who/what initiated a job
 */
export type TriggerSource = 'github-actions' | 'manual-api' | 'cron' | 'scheduler' | 'unknown';

/**
 * Write report snapshot to D1 scheduled_job_results table
 * Safe: returns false if table doesn't exist (migration not applied)
 */
export async function writeD1ReportSnapshot(
  env: CloudflareEnvironment,
  executionDate: string,
  reportType: string,
  reportContent: any,
  metadata?: any,
  triggerSource: TriggerSource = 'unknown'
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    logger.warn('D1 database not available for write');
    return false;
  }

  const contentJson = JSON.stringify(reportContent);
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  try {

    // Upsert: replace if same date+type exists
    await db.prepare(`
      INSERT OR REPLACE INTO scheduled_job_results (execution_date, report_type, report_content, metadata, trigger_source, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(executionDate, reportType, contentJson, metadataJson, triggerSource).run();

    logger.info('D1 report snapshot written', { executionDate, reportType, triggerSource });
    return true;
  } catch (error) {
    const errMsg = (error as Error).message;
    // Gracefully handle missing table (migration not applied) or missing column (migration pending)
    if (errMsg.includes('no such table') || errMsg.includes('scheduled_job_results')) {
      logger.warn('D1 scheduled_job_results table not found - migration not applied', { executionDate, reportType });
    } else if (errMsg.includes('no column named trigger_source')) {
      // Fallback: write without trigger_source if column doesn't exist yet
      logger.warn('trigger_source column not found - using legacy write', { executionDate, reportType });
      await db.prepare(`
        INSERT OR REPLACE INTO scheduled_job_results (execution_date, report_type, report_content, metadata, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(executionDate, reportType, contentJson, metadataJson).run();
      return true;
    } else {
      logger.error('D1 write failed', { error: errMsg, executionDate, reportType });
    }
    return false;
  }
}

/**
 * Read report snapshot from D1
 * Safe: returns null if table doesn't exist
 */
export async function readD1ReportSnapshot(
  env: CloudflareEnvironment,
  executionDate: string,
  reportType: string
): Promise<{ data: any; createdAt: string } | null> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return null;

  try {
    const result = await db.prepare(
      'SELECT report_content, metadata, created_at FROM scheduled_job_results WHERE execution_date = ? AND report_type = ?'
    ).bind(executionDate, reportType).first<{ report_content: string; metadata: string; created_at: string }>();

    if (result?.report_content) {
      try {
        const content = JSON.parse(result.report_content);
        content._d1_metadata = result.metadata ? JSON.parse(result.metadata) : null;
        content._source = 'd1_snapshot';
        content._d1_created_at = result.created_at;
        return { data: content, createdAt: result.created_at };
      } catch (parseError) {
        logger.error('D1 JSON parse failed', { executionDate, reportType, error: (parseError as Error).message });
        return null;
      }
    }
    return null;
  } catch (error) {
    const errMsg = (error as Error).message;
    if (errMsg.includes('no such table')) {
      logger.debug('D1 scheduled_job_results table not found - using predictions fallback');
    } else {
      logger.error('D1 read failed', { error: errMsg });
    }
    return null;
  }
}

/**
 * Get latest report snapshot from D1 (any date)
 * Safe: returns null if table doesn't exist
 */
export async function getD1LatestReportSnapshot(
  env: CloudflareEnvironment,
  reportType: string
): Promise<{ data: any; executionDate: string; createdAt: string } | null> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return null;

  try {
    const result = await db.prepare(
      'SELECT execution_date, report_content, metadata, created_at FROM scheduled_job_results WHERE report_type = ? ORDER BY execution_date DESC LIMIT 1'
    ).bind(reportType).first<{ execution_date: string; report_content: string; metadata: string; created_at: string }>();

    if (result?.report_content) {
      try {
        const content = JSON.parse(result.report_content);
        content._d1_metadata = result.metadata ? JSON.parse(result.metadata) : null;
        content._source = 'd1_snapshot';
        content._d1_created_at = result.created_at;
        content.source_date = result.execution_date;
        return { data: content, executionDate: result.execution_date, createdAt: result.created_at };
      } catch (parseError) {
        logger.error('D1 JSON parse failed', { reportType, error: (parseError as Error).message });
        return null;
      }
    }
    return null;
  } catch (error) {
    const errMsg = (error as Error).message;
    if (!errMsg.includes('no such table')) {
      logger.error('D1 latest read failed', { error: errMsg });
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

    return {
      symbol: p.symbol,
      overall_confidence: p.confidence,
      recommendation: tradingSignals.recommendation || 'HOLD',
      agreement_type: tradingSignals.signal_type === 'AGREEMENT' ? 'full_agreement' : 'partial_agreement',
      gpt_sentiment: p.sentiment,
      gpt_confidence: p.confidence,
      gpt_reasoning: tradingSignals.entry_signals?.reasoning || '',
      distilbert_sentiment: p.direction,
      distilbert_confidence: p.confidence,
      news_count: 0,
      top_articles: []
    };
  });

  return {
    timestamp: predictions[0]?.created_at || new Date().toISOString(),
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
 */
export async function getD1FallbackData(
  env: CloudflareEnvironment,
  dateStr: string,
  reportType: string,
  options: { skipTodaySnapshot?: boolean } = {}
): Promise<{ data: any; source: string; sourceDate: string; isStale: boolean; createdAt?: string | null } | null> {
  const usePredictionsShape = reportType === 'intraday' || reportType === 'end-of-day' || reportType === 'predictions';

  // 1. Try D1 snapshot for today with exact report type (unless skipped)
  if (!options.skipTodaySnapshot) {
    const snapshotResult = await readD1ReportSnapshot(env, dateStr, reportType);
    if (snapshotResult) {
      return { data: snapshotResult.data, source: 'd1_snapshot', sourceDate: dateStr, isStale: false, createdAt: snapshotResult.createdAt };
    }
  }

  // 2. Try latest D1 snapshot (may be stale)
  const latestSnapshot = await getD1LatestReportSnapshot(env, reportType);
  if (latestSnapshot) {
    const isStale = latestSnapshot.executionDate !== dateStr;
    latestSnapshot.data.is_stale = isStale;
    latestSnapshot.data.source_date = latestSnapshot.executionDate;
    return {
      data: latestSnapshot.data,
      source: 'd1_snapshot',
      sourceDate: latestSnapshot.executionDate,
      isStale,
      createdAt: latestSnapshot.createdAt
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
  status: 'done' | 'failed' | 'running' | 'pending',
  metadata: {
    symbols_processed?: number;
    execution_time_ms?: number;
    symbols_successful?: number;
    symbols_fallback?: number;
    symbols_failed?: number;
    errors?: string[];
    [key: string]: any;
  } = {}
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    logger.warn('D1 database not available for job status update');
    return false;
  }

  const executedAt = new Date().toISOString();
  const symbolsProcessed = metadata.symbols_processed ?? 0;
  const symbolsSuccessful = metadata.symbols_successful ?? symbolsProcessed;
  const symbolsFallback = metadata.symbols_fallback ?? 0;
  const symbolsFailed = metadata.symbols_failed ?? 0;
  const successRate = symbolsProcessed > 0 ? (symbolsSuccessful / symbolsProcessed) : 1;
  const errorsJson = JSON.stringify(metadata.errors || []);

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

    logger.info('D1 job status updated', { jobType, date, status, symbolsProcessed });
    return true;
  } catch (error) {
    const errMsg = (error as Error).message;
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
): Promise<{ status: string; timestamp: string; metadata: any } | null> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return null;

  try {
    const result = await db.prepare(`
      SELECT status, executed_at, execution_time_ms, symbols_processed, symbols_successful, symbols_fallback, symbols_failed, success_rate, errors
      FROM job_executions
      WHERE job_type = ? AND DATE(executed_at) = ?
      ORDER BY executed_at DESC
      LIMIT 1
    `).bind(jobType, date).first<{
      status: string;
      executed_at: string;
      execution_time_ms: number;
      symbols_processed: number;
      symbols_successful: number;
      symbols_fallback: number;
      symbols_failed: number;
      success_rate: number;
      errors: string;
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
        }
      };
    }
    return null;
  } catch (error) {
    logger.debug('D1 job status query failed', { error: (error as Error).message, jobType, date });
    return null;
  }
}
