-- ============================================================================
-- Navigation Status Tables v2.3 (Multi-Run Support)
-- Schema Transition: Drop old tables, create fresh schema (DESTRUCTIVE)
-- Supports multiple runs per scheduled_date/report_type
-- ============================================================================

-- Drop old tables
DROP TABLE IF EXISTS job_stage_log;
DROP TABLE IF EXISTS job_date_results;
DROP TABLE IF EXISTS job_run_results;
DROP TABLE IF EXISTS scheduled_job_results;

-- ============================================================================
-- 1. job_date_results: Navigation summary (ONE row per date/type)
-- ============================================================================
CREATE TABLE job_date_results (
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  status TEXT NOT NULL CHECK(status IN ('success','partial','failed','running')),
  current_stage TEXT,
  errors_json TEXT,
  warnings_json TEXT,
  executed_at TEXT,
  started_at TEXT,
  trigger_source TEXT,
  latest_run_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (scheduled_date, report_type)
);

CREATE INDEX idx_job_date_results_date ON job_date_results(scheduled_date DESC);
CREATE INDEX idx_job_date_results_status ON job_date_results(status) WHERE status = 'running';

-- ============================================================================
-- 2. job_run_results: Run history (multiple rows per date/type)
-- ============================================================================
CREATE TABLE job_run_results (
  run_id TEXT PRIMARY KEY,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  status TEXT NOT NULL CHECK(status IN ('success','partial','failed','running')),
  current_stage TEXT,
  errors_json TEXT,
  warnings_json TEXT,
  started_at TEXT NOT NULL,
  executed_at TEXT,
  trigger_source TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_job_run_results_lookup ON job_run_results(scheduled_date, report_type, created_at DESC);
CREATE INDEX idx_job_run_results_status ON job_run_results(status) WHERE status = 'running';

-- ============================================================================
-- 3. job_stage_log: Stage timeline per run (references run_id)
-- ============================================================================
CREATE TABLE job_stage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  stage TEXT NOT NULL CHECK(stage IN ('init','data_fetch','ai_analysis','storage','finalize')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES job_run_results(run_id)
);

CREATE INDEX idx_job_stage_log_run ON job_stage_log(run_id, stage);
CREATE INDEX idx_job_stage_log_lookup ON job_stage_log(scheduled_date, report_type, stage);

-- ============================================================================
-- 4. scheduled_job_results: Report content snapshots (multi-run)
--    NOTE: report_type is intentionally unconstrained (supports analysis/morning_predictions/etc.)
-- ============================================================================
CREATE TABLE scheduled_job_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL,
  report_content TEXT NOT NULL,
  metadata TEXT,
  trigger_source TEXT,
  run_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_scheduled_job_results_lookup ON scheduled_job_results(scheduled_date DESC, report_type, created_at DESC);
CREATE INDEX idx_scheduled_job_results_run ON scheduled_job_results(run_id);
CREATE UNIQUE INDEX idx_scheduled_job_results_run_unique ON scheduled_job_results(run_id);
