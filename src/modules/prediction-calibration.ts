/**
 * Prediction Calibration - Phase 4
 * Joins symbol_predictions with market_close_data to compute per-symbol accuracy.
 * Runs as a scheduled job after market close.
 */

import type { CloudflareEnvironment } from '../types.js';
import { createLogger } from './logging.js';

const logger = createLogger('prediction-calibration');

const HORIZON = '1d_close';
const WINDOW_DAYS = 30;

/**
 * Run calibration for all symbols that have both predictions and realized close data
 * within the last WINDOW_DAYS days.
 */
export async function runCalibration(env: CloudflareEnvironment): Promise<{ symbols_evaluated: number }> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    logger.warn('Calibration skipped: no D1 database');
    return { symbols_evaluated: 0 };
  }

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  // Fetch predictions joined with realized close data
  const rows = await db.prepare(`
    SELECT
      sp.symbol,
      sp.prediction_date,
      sp.direction,
      sp.confidence,
      sp.model,
      mcd.day_change
    FROM symbol_predictions sp
    JOIN market_close_data mcd
      ON sp.symbol = mcd.symbol AND sp.prediction_date = mcd.close_date
    WHERE sp.prediction_date >= ?
      AND sp.status = 'success'
      AND sp.direction IS NOT NULL
      AND mcd.fetch_status = 'success'
  `).bind(cutoff).all();

  if (!rows.results || rows.results.length === 0) {
    logger.info('Calibration: no joined rows found', { cutoff });
    return { symbols_evaluated: 0 };
  }

  // Group by symbol + model — normalise null/unknown model to 'gpt-oss-120b' (primary is always run)
  const groups = new Map<string, { hits: number; total: number; confidences: number[] }>();

  for (const row of rows.results as any[]) {
    const modelName = row.model || 'gpt-oss-120b';
    const key = `${row.symbol}||${modelName}`;
    if (!groups.has(key)) groups.set(key, { hits: 0, total: 0, confidences: [] });
    const g = groups.get(key)!;
    g.total++;
    // A "hit" = direction matches realized move sign
    const predictedUp = ['bullish', 'up'].includes((row.direction || '').toLowerCase());
    const actualUp = (row.day_change ?? 0) > 0;
    if (predictedUp === actualUp) g.hits++;
    if (row.confidence != null) g.confidences.push(row.confidence);
  }

  let symbolsEvaluated = 0;
  for (const [key, g] of groups) {
    const [symbol, modelName] = key.split('||');
    const hitRate = g.total > 0 ? g.hits / g.total : 0;
    const avgConf = g.confidences.length > 0
      ? g.confidences.reduce((a, b) => a + b, 0) / g.confidences.length
      : null;
    // Simple calibration error: |avg_confidence - hit_rate|
    const calibrationError = avgConf != null ? Math.abs(avgConf - hitRate) : null;

    try {
      await db.prepare(`
        INSERT INTO per_symbol_accuracy
          (symbol, model_name, horizon, window_days, sample_size, hit_rate, avg_confidence,
           calibration_error, last_evaluated_date, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(symbol, model_name, horizon, window_days) DO UPDATE SET
          sample_size = excluded.sample_size,
          hit_rate = excluded.hit_rate,
          avg_confidence = excluded.avg_confidence,
          calibration_error = excluded.calibration_error,
          last_evaluated_date = excluded.last_evaluated_date,
          updated_at = excluded.updated_at
      `).bind(symbol, modelName, HORIZON, WINDOW_DAYS, g.total, hitRate, avgConf ?? null, calibrationError ?? null, today).run();
      symbolsEvaluated++;
    } catch (e) {
      logger.warn(`Calibration upsert failed for ${symbol}`, { error: e });
    }
  }

  logger.info(`Calibration complete`, { symbols_evaluated: symbolsEvaluated, cutoff });
  return { symbols_evaluated: symbolsEvaluated };
}

/**
 * Fetch aggregate model-level hit rate across all symbols (Phase 5).
 * One query, not per-symbol. Returns null if insufficient data.
 */
export async function getModelHitRate(
  env: CloudflareEnvironment,
  modelName: string = 'gpt-oss-120b',
  horizon: string = HORIZON,
  windowDays: number = WINDOW_DAYS
): Promise<{ sample_size: number; hit_rate: number } | null> {
  if (!env.PREDICT_JOBS_DB) return null;
  try {
    const row = await env.PREDICT_JOBS_DB.prepare(`
      SELECT SUM(sample_size) AS total_samples,
             SUM(hit_rate * sample_size) / SUM(sample_size) AS weighted_hit_rate
      FROM per_symbol_accuracy
      WHERE model_name = ? AND horizon = ? AND window_days = ?
        AND sample_size > 0
    `).bind(modelName, horizon, windowDays).first<any>();
    if (!row || !row.total_samples) return null;
    return { sample_size: row.total_samples, hit_rate: row.weighted_hit_rate };
  } catch {
    return null;
  }
}

/**
 * Fetch aggregate symbol-level hit rate across all recorded model selections.
 * Returns null if no data available — never throws.
 */
export async function getSymbolHitRate(
  env: CloudflareEnvironment,
  symbol: string,
  horizon: string = HORIZON,
  windowDays: number = WINDOW_DAYS
): Promise<{ sample_size: number; hit_rate: number; avg_confidence: number | null } | null> {
  if (!env.PREDICT_JOBS_DB) return null;
  try {
    const row = await env.PREDICT_JOBS_DB.prepare(`
      SELECT
        SUM(sample_size) AS total_samples,
        SUM(hit_rate * sample_size) / SUM(sample_size) AS weighted_hit_rate,
        SUM(COALESCE(avg_confidence, 0) * sample_size) / SUM(sample_size) AS weighted_avg_confidence
      FROM per_symbol_accuracy
      WHERE symbol = ? AND horizon = ? AND window_days = ?
        AND sample_size > 0
    `).bind(symbol, horizon, windowDays).first<any>();
    if (!row || !row.total_samples) return null;
    return {
      sample_size: row.total_samples,
      hit_rate: row.weighted_hit_rate,
      avg_confidence: row.weighted_avg_confidence,
    };
  } catch {
    return null;
  }
}
