-- Migration: Add 'sector-rotation' to report_type CHECK constraints
-- Date: 2026-01-28
-- Purpose: Support sector-rotation as a separate report type (was incorrectly aliased to 'weekly')

-- Drop and recreate job_run_results with updated CHECK constraint
DROP TABLE IF EXISTS job_run_results_new;
CREATE TABLE job_run_results_new (
  run_id TEXT PRIMARY KEY,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly','sector-rotation')),
  status TEXT NOT NULL CHECK(status IN ('running','success','failed','partial')),
  trigger_source TEXT CHECK(trigger_source IN ('cron','manual','api')),
  current_stage TEXT,
  started_at TEXT,
  executed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy existing data
INSERT INTO job_run_results_new SELECT * FROM job_run_results;

-- Drop old table and rename new one
DROP TABLE job_run_results;
ALTER TABLE job_run_results_new RENAME TO job_run_results;

-- Recreate indexes
CREATE INDEX idx_job_run_results_date_type ON job_run_results(scheduled_date, report_type);
CREATE INDEX idx_job_run_results_status ON job_run_results(status);
CREATE INDEX idx_job_run_results_created ON job_run_results(created_at DESC);

-- Drop and recreate job_date_results with updated CHECK constraint
DROP TABLE IF EXISTS job_date_results_new;
CREATE TABLE job_date_results_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly','sector-rotation')),
  latest_run_id TEXT NOT NULL,
  latest_status TEXT NOT NULL CHECK(latest_status IN ('running','success','failed','partial')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scheduled_date, report_type)
);

-- Copy existing data
INSERT INTO job_date_results_new SELECT * FROM job_date_results;

-- Drop old table and rename new one
DROP TABLE job_date_results;
ALTER TABLE job_date_results_new RENAME TO job_date_results;

-- Recreate indexes
CREATE INDEX idx_job_date_results_date ON job_date_results(scheduled_date DESC);
CREATE INDEX idx_job_date_results_type ON job_date_results(report_type);

-- Drop and recreate scheduled_job_results with updated CHECK constraint
DROP TABLE IF EXISTS scheduled_job_results_new;
CREATE TABLE scheduled_job_results_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly','sector-rotation')),
  run_id TEXT,
  report_content TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scheduled_date, report_type, run_id)
);

-- Copy existing data
INSERT INTO scheduled_job_results_new SELECT * FROM scheduled_job_results;

-- Drop old table and rename new one
DROP TABLE scheduled_job_results;
ALTER TABLE scheduled_job_results_new RENAME TO scheduled_job_results;

-- Recreate indexes
CREATE INDEX idx_scheduled_job_results_date_type ON scheduled_job_results(scheduled_date, report_type);
CREATE INDEX idx_scheduled_job_results_run_id ON scheduled_job_results(run_id);
CREATE INDEX idx_scheduled_job_results_created ON scheduled_job_results(created_at DESC);
