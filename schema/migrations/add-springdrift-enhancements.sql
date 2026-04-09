-- Springdrift Paper Implementation - Full Schema
-- Creates all Phase 2-5 tables for forensic auditability and case-based reasoning
-- Migration Date: 2026-04-09

-- ============================================================================
-- Phase 2: AI Call Telemetry
-- Append-only log of every model call for forensic auditability
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_call_telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  scheduled_date TEXT,
  report_type TEXT,
  symbol TEXT NOT NULL,
  model_role TEXT NOT NULL CHECK(model_role IN ('primary', 'mate')),
  model_name TEXT NOT NULL,
  prompt_version TEXT,
  prompt_hash TEXT,                -- SHA-256 hash for forensic prompt reconstruction
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  status TEXT NOT NULL CHECK(status IN ('success', 'failed')),
  error_class TEXT,
  error_message TEXT,
  reasoning_chain TEXT,            -- Extracted <think> blocks from reasoning models
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_call_telemetry_run ON ai_call_telemetry(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_call_telemetry_symbol ON ai_call_telemetry(symbol);
CREATE INDEX IF NOT EXISTS idx_ai_call_telemetry_created ON ai_call_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_call_telemetry_has_reasoning ON ai_call_telemetry(model_role) WHERE reasoning_chain IS NOT NULL;

-- ============================================================================
-- Phase 3: System Events
-- Pipeline-health events: circuit breaker transitions, timeouts, fallbacks
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  scheduled_date TEXT,
  report_type TEXT,
  event_type TEXT NOT NULL,
  component TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('info', 'warn', 'error')),
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_system_events_run ON system_events(run_id);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events(created_at DESC);

-- ============================================================================
-- Phase 4: Per-Symbol Accuracy / Outcome Calibration
-- Tracks prediction hit-rate per symbol, model, and horizon
-- ============================================================================
CREATE TABLE IF NOT EXISTS per_symbol_accuracy (
  symbol TEXT NOT NULL,
  model_name TEXT NOT NULL,
  horizon TEXT NOT NULL,           -- e.g. '1d_close'
  window_days INTEGER NOT NULL,    -- e.g. 30
  sample_size INTEGER NOT NULL,
  hit_rate REAL NOT NULL,
  avg_confidence REAL,
  calibration_error REAL,          -- |avg_confidence - hit_rate|
  last_evaluated_date TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (symbol, model_name, horizon, window_days)
);

CREATE INDEX IF NOT EXISTS idx_per_symbol_accuracy_symbol ON per_symbol_accuracy(symbol);
CREATE INDEX IF NOT EXISTS idx_per_symbol_accuracy_model ON per_symbol_accuracy(model_name);
