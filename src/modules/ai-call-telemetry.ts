/**
 * AI Call Telemetry - Phase 2
 * Append-only log of every model call: latency, status, error class.
 * Fire-and-forget (never throws) to avoid impacting the hot path.
 */

import type { CloudflareEnvironment } from '../types.js';

export interface AICallRecord {
  run_id?: string;
  scheduled_date?: string;
  report_type?: string;
  symbol: string;
  model_role: 'primary' | 'mate';
  model_name: string;
  latency_ms: number;
  status: 'success' | 'failed';
  error_class?: string;
  error_message?: string;
}

/**
 * Log one row per model call. Fire-and-forget — never throws.
 */
export function logAICall(env: CloudflareEnvironment, record: AICallRecord): void {
  if (!env.PREDICT_JOBS_DB) return;
  // Intentionally not awaited — telemetry must not block the hot path
  env.PREDICT_JOBS_DB.prepare(`
    INSERT INTO ai_call_telemetry
      (run_id, scheduled_date, report_type, symbol, model_role, model_name,
       latency_ms, status, error_class, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    record.run_id ?? null,
    record.scheduled_date ?? null,
    record.report_type ?? null,
    record.symbol,
    record.model_role,
    record.model_name,
    record.latency_ms,
    record.status,
    record.error_class ?? null,
    record.error_message ?? null,
  ).run().catch(() => { /* swallow — telemetry is best-effort */ });
}
