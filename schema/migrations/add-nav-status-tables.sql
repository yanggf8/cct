-- Navigation Status Summary (fresh start, no historical data)
-- Cutover date: 2026-01-28 (update NAV_CUTOVER_DATE in trading-calendar.ts on deploy)

CREATE TABLE IF NOT EXISTS job_date_results (
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  status TEXT NOT NULL CHECK(status IN ('success','partial','failed','running')),
  current_stage TEXT,
  errors_json TEXT,
  warnings_json TEXT,
  executed_at TEXT,
  started_at TEXT,
  trigger_source TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (scheduled_date, report_type)
);

CREATE INDEX IF NOT EXISTS idx_job_date_results_date ON job_date_results(scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_date_results_status ON job_date_results(status) WHERE status = 'running';

-- Job Stage Log (append-only stage transitions)
CREATE TABLE IF NOT EXISTS job_stage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  stage TEXT NOT NULL CHECK(stage IN ('init','data_fetch','ai_analysis','storage','finalize')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (scheduled_date, report_type) REFERENCES job_date_results(scheduled_date, report_type)
);

CREATE INDEX IF NOT EXISTS idx_job_stage_log_lookup ON job_stage_log(scheduled_date, report_type, stage);
