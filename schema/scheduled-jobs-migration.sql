-- ============================================
-- D1 Migration: scheduled_job_results table
-- Primary key: scheduled_date + report_type
-- Run: npx wrangler d1 execute cct-predict-jobs --remote --file=schema/scheduled-jobs-migration.sql
-- ============================================

-- Create scheduled_job_results table for full report snapshots
CREATE TABLE IF NOT EXISTS scheduled_job_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,           -- The market date this report is FOR
  report_type TEXT NOT NULL,              -- pre-market, intraday, end-of-day, weekly
  report_content TEXT,                    -- JSON blob of report data
  metadata TEXT,                          -- Optional metadata JSON
  trigger_source TEXT DEFAULT 'unknown',  -- github-actions, manual-api, cron, scheduler
  created_at TEXT DEFAULT (datetime('now')), -- When the report was generated
  UNIQUE(scheduled_date, report_type)     -- Composite primary key
);

CREATE INDEX IF NOT EXISTS idx_scheduled_results_date ON scheduled_job_results(scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_results_type ON scheduled_job_results(report_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_results_created ON scheduled_job_results(created_at DESC);
