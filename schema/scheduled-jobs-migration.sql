-- ============================================
-- D1 Migration: scheduled_job_results table
-- NON-DESTRUCTIVE, IDEMPOTENT
-- Run: npx wrangler d1 execute cct-predict-jobs --remote --file=schema/scheduled-jobs-migration.sql
-- ============================================

-- Create scheduled_job_results table for full report snapshots
CREATE TABLE IF NOT EXISTS scheduled_job_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_date TEXT NOT NULL,
  report_type TEXT NOT NULL,
  report_content TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scheduled_results_date ON scheduled_job_results(execution_date DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_results_type ON scheduled_job_results(report_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_results_created ON scheduled_job_results(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_results_date_type ON scheduled_job_results(execution_date, report_type);
