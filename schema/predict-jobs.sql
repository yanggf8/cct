-- Prediction Job Executions
CREATE TABLE IF NOT EXISTS job_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  executed_at TEXT NOT NULL,
  execution_time_ms INTEGER,
  symbols_processed INTEGER DEFAULT 0,
  symbols_successful INTEGER DEFAULT 0,
  symbols_fallback INTEGER DEFAULT 0,
  symbols_failed INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0,
  errors TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Symbol Predictions
CREATE TABLE IF NOT EXISTS symbol_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  prediction_date TEXT NOT NULL,
  sentiment TEXT,
  confidence REAL,
  direction TEXT,
  model TEXT,
  analysis_type TEXT,
  trading_signals TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(symbol, prediction_date)
);

-- Daily Analysis Summary
CREATE TABLE IF NOT EXISTS daily_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_date TEXT NOT NULL UNIQUE,
  total_symbols INTEGER,
  execution_time INTEGER,
  summary TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_job_executions_type ON job_executions(job_type);
CREATE INDEX IF NOT EXISTS idx_job_executions_date ON job_executions(executed_at);
CREATE INDEX IF NOT EXISTS idx_symbol_predictions_date ON symbol_predictions(prediction_date);
CREATE INDEX IF NOT EXISTS idx_symbol_predictions_symbol ON symbol_predictions(symbol);

-- Navigation Status Summary (fresh start, no historical data)
CREATE TABLE IF NOT EXISTS job_date_results (
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly','sector-rotation')),
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
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly','sector-rotation')),
  stage TEXT NOT NULL CHECK(stage IN ('init','data_fetch','ai_analysis','storage','finalize')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (scheduled_date, report_type) REFERENCES job_date_results(scheduled_date, report_type)
);

CREATE INDEX IF NOT EXISTS idx_job_stage_log_lookup ON job_stage_log(scheduled_date, report_type, stage);

-- News Provider Failure Tracking (added 2026-01-29)
CREATE TABLE IF NOT EXISTS news_provider_failures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'DAC', 'Finnhub', 'FMP', 'NewsAPI', 'Yahoo'
    error_type TEXT NOT NULL, -- 'timeout', 'rate_limit', 'no_data', 'api_error', 'network_error'
    error_message TEXT,
    request_context TEXT, -- JSON with additional context
    job_type TEXT, -- 'pre-market', 'intraday', 'end-of-day'
    run_id TEXT, -- Link to job_run_results
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_provider_failures_symbol ON news_provider_failures(symbol);
CREATE INDEX IF NOT EXISTS idx_provider_failures_provider ON news_provider_failures(provider);
CREATE INDEX IF NOT EXISTS idx_provider_failures_created ON news_provider_failures(created_at);
CREATE INDEX IF NOT EXISTS idx_provider_failures_run_id ON news_provider_failures(run_id);
