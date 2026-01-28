-- ============================================
-- D1 Migration: Clean up legacy scheduled_job_results
-- DESTRUCTIVE: Drops and recreates table for multi-run snapshots
-- Run: npx wrangler d1 execute cct-predict-jobs --remote --file=schema/migrations/cleanup-scheduled-jobs.sql
-- ============================================

-- Drop old table with execution_date
DROP TABLE IF EXISTS scheduled_job_results;

-- Create new table (multi-run: multiple rows per scheduled_date/report_type)
CREATE TABLE scheduled_job_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,           -- The market date this report is FOR
  report_type TEXT NOT NULL,              -- pre-market/intraday/end-of-day/weekly/analysis/morning_predictions/etc.
  report_content TEXT NOT NULL,           -- JSON blob of report data
  metadata TEXT,                          -- Optional metadata JSON
  trigger_source TEXT DEFAULT 'unknown',  -- github-actions, manual-api, cron, scheduler
  run_id TEXT,                            -- Optional link to job_run_results(run_id)
  created_at TEXT DEFAULT (datetime('now')), -- When the report was generated
  UNIQUE(run_id)                          -- Multiple NULLs allowed; enforces 1 row per run_id when present
);

-- Indexes for efficient queries
CREATE INDEX idx_scheduled_results_date ON scheduled_job_results(scheduled_date DESC);
CREATE INDEX idx_scheduled_results_type ON scheduled_job_results(report_type);
CREATE INDEX idx_scheduled_results_created ON scheduled_job_results(created_at DESC);
CREATE INDEX idx_scheduled_results_lookup ON scheduled_job_results(scheduled_date DESC, report_type, created_at DESC);
CREATE INDEX idx_scheduled_results_run ON scheduled_job_results(run_id);
