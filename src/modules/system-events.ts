/**
 * System Events - Phase 3
 * Persist pipeline-health events (circuit breaker transitions, timeouts, fallbacks).
 * Fire-and-forget — never throws.
 */

import type { CloudflareEnvironment } from '../types.js';

export type EventType =
  | 'circuit_breaker_open'
  | 'circuit_breaker_half_open'
  | 'circuit_breaker_closed'
  | 'model_timeout'
  | 'fallback_taken'
  | 'news_fetch_degraded';

export type EventSeverity = 'info' | 'warn' | 'error';

export interface SystemEventRecord {
  run_id?: string;
  scheduled_date?: string;
  report_type?: string;
  event_type: EventType;
  component: string;
  severity: EventSeverity;
  details?: Record<string, unknown>;
}

/**
 * Emit a pipeline-health event. Fire-and-forget — never throws.
 */
export function emitSystemEvent(env: CloudflareEnvironment, record: SystemEventRecord): void {
  if (!env.PREDICT_JOBS_DB) return;
  env.PREDICT_JOBS_DB.prepare(`
    INSERT INTO system_events
      (run_id, scheduled_date, report_type, event_type, component, severity, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    record.run_id ?? null,
    record.scheduled_date ?? null,
    record.report_type ?? null,
    record.event_type,
    record.component,
    record.severity,
    record.details ? JSON.stringify(record.details) : null,
  ).run().catch(() => { /* swallow */ });
}
