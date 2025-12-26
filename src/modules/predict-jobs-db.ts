/**
 * Prediction Jobs D1 Storage
 * Stores and retrieves prediction job execution results and symbol predictions
 */

import type { CloudflareEnvironment } from '../types.js';

export interface JobExecution {
  id?: number;
  job_type: string;
  status: 'success' | 'partial' | 'failed';
  executed_at: string;
  execution_time_ms: number;
  symbols_processed: number;
  symbols_successful: number;
  symbols_fallback: number;
  symbols_failed: number;
  success_rate: number;
  errors: string[];
  created_at?: string;
}

export interface SymbolPrediction {
  id?: number;
  symbol: string;
  prediction_date: string;
  sentiment: string;
  confidence: number;
  direction: string;
  model: string;
  analysis_type: string;
  trading_signals?: any;
  created_at?: string;
}

export interface DailyAnalysisSummary {
  id?: number;
  analysis_date: string;
  total_symbols: number;
  execution_time: number;
  summary?: any;
  created_at?: string;
}

export class PredictJobsDB {
  constructor(private db: D1Database) {}

  // Job Executions
  async saveExecution(job: Omit<JobExecution, 'id' | 'created_at'>): Promise<number> {
    const result = await this.db.prepare(`
      INSERT INTO job_executions (job_type, status, executed_at, execution_time_ms, symbols_processed, symbols_successful, symbols_fallback, symbols_failed, success_rate, errors)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      job.job_type,
      job.status,
      job.executed_at,
      job.execution_time_ms,
      job.symbols_processed,
      job.symbols_successful,
      job.symbols_fallback,
      job.symbols_failed,
      job.success_rate,
      JSON.stringify(job.errors)
    ).run();
    return result.meta.last_row_id;
  }

  async getExecutionsByDate(date: string): Promise<JobExecution[]> {
    const result = await this.db.prepare(`
      SELECT * FROM job_executions WHERE DATE(executed_at) = ? ORDER BY executed_at DESC
    `).bind(date).all();
    return (result.results || []).map(this.mapJobRow);
  }

  async getRecentExecutions(limit = 20): Promise<JobExecution[]> {
    const result = await this.db.prepare(`
      SELECT * FROM job_executions ORDER BY executed_at DESC LIMIT ?
    `).bind(limit).all();
    return (result.results || []).map(this.mapJobRow);
  }

  // Symbol Predictions
  async savePrediction(pred: Omit<SymbolPrediction, 'id' | 'created_at'>): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO symbol_predictions (symbol, prediction_date, sentiment, confidence, direction, model, analysis_type, trading_signals)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      pred.symbol,
      pred.prediction_date,
      pred.sentiment,
      pred.confidence,
      pred.direction,
      pred.model,
      pred.analysis_type,
      JSON.stringify(pred.trading_signals || {})
    ).run();
  }

  async savePredictionsBatch(predictions: Omit<SymbolPrediction, 'id' | 'created_at'>[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO symbol_predictions (symbol, prediction_date, sentiment, confidence, direction, model, analysis_type, trading_signals)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await this.db.batch(predictions.map(p => stmt.bind(
      p.symbol, p.prediction_date, p.sentiment, p.confidence, p.direction, p.model, p.analysis_type, JSON.stringify(p.trading_signals || {})
    )));
  }

  async getPredictionsByDate(date: string): Promise<SymbolPrediction[]> {
    const result = await this.db.prepare(`
      SELECT * FROM symbol_predictions WHERE prediction_date = ? ORDER BY symbol
    `).bind(date).all();
    return (result.results || []).map(this.mapPredictionRow);
  }

  async getPredictionBySymbol(symbol: string, date: string): Promise<SymbolPrediction | null> {
    const result = await this.db.prepare(`
      SELECT * FROM symbol_predictions WHERE symbol = ? AND prediction_date = ?
    `).bind(symbol, date).first();
    return result ? this.mapPredictionRow(result) : null;
  }

  // Daily Analysis Summary
  async saveDailyAnalysis(summary: Omit<DailyAnalysisSummary, 'id' | 'created_at'>): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO daily_analysis (analysis_date, total_symbols, execution_time, summary)
      VALUES (?, ?, ?, ?)
    `).bind(
      summary.analysis_date,
      summary.total_symbols,
      summary.execution_time,
      JSON.stringify(summary.summary || {})
    ).run();
  }

  async getDailyAnalysis(date: string): Promise<DailyAnalysisSummary | null> {
    const result = await this.db.prepare(`
      SELECT * FROM daily_analysis WHERE analysis_date = ?
    `).bind(date).first();
    return result ? this.mapDailyRow(result) : null;
  }

  private mapJobRow(row: any): JobExecution {
    return { ...row, errors: JSON.parse(row.errors || '[]') };
  }

  private mapPredictionRow(row: any): SymbolPrediction {
    return { ...row, trading_signals: JSON.parse(row.trading_signals || '{}') };
  }

  private mapDailyRow(row: any): DailyAnalysisSummary {
    return { ...row, summary: JSON.parse(row.summary || '{}') };
  }
}

export function getPredictJobsDB(env: CloudflareEnvironment): PredictJobsDB | null {
  if (!env.PREDICT_JOBS_DB) return null;
  return new PredictJobsDB(env.PREDICT_JOBS_DB as unknown as D1Database);
}
