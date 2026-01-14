-- Add report_snapshots table for storing job report data
-- This table stores the generated report content from jobs (pre-market, intraday, end-of-day, weekly)

CREATE TABLE IF NOT EXISTS report_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  report_type TEXT NOT NULL, -- 'pre-market', 'intraday', 'end-of-day', 'weekly'
  content TEXT NOT NULL, -- JSON blob of the report data
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, report_type, created_at)
);

CREATE INDEX IF NOT EXISTS idx_report_snapshots_date_type ON report_snapshots(report_date, report_type);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_created ON report_snapshots(created_at);
