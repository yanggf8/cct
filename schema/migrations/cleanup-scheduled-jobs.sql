-- ============================================
-- D1 Migration: Clean up legacy scheduled_job_results
-- DESTRUCTIVE: Drops and recreates table with scheduled_date as primary key
-- Run: npx wrangler d1 execute cct-predict-jobs --remote --file=schema/migrations/cleanup-scheduled-jobs.sql
-- ============================================

-- Drop old table with execution_date
DROP TABLE IF EXISTS scheduled_job_results;

-- Create new table with scheduled_date as primary key
CREATE TABLE scheduled_job_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,           -- The market date this report is FOR (primary key with report_type)
  report_type TEXT NOT NULL,              -- pre-market, intraday, end-of-day, weekly
  report_content TEXT,                    -- JSON blob of report data
  metadata TEXT,                          -- Optional metadata JSON
  trigger_source TEXT DEFAULT 'unknown',  -- github-actions, manual-api, cron, scheduler
  created_at TEXT DEFAULT (datetime('now')), -- When the report was generated
  UNIQUE(scheduled_date, report_type)     -- Primary key constraint
);

-- Indexes for efficient queries
CREATE INDEX idx_scheduled_results_date ON scheduled_job_results(scheduled_date DESC);
CREATE INDEX idx_scheduled_results_type ON scheduled_job_results(report_type);
CREATE INDEX idx_scheduled_results_created ON scheduled_job_results(created_at DESC);
