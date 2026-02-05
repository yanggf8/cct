-- D1 Schema Dump (cct-predict-jobs)
-- Generated: 2026-02-05
-- Database ID: dbcb468d-ec04-4e3b-87c5-748d5a30ff40
-- 14 tables, 34 indexes

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE daily_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_date TEXT NOT NULL UNIQUE,
  total_symbols INTEGER,
  execution_time INTEGER,
  summary TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE job_date_results (
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly','sector-rotation')),
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

CREATE TABLE job_executions (
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
  created_at TEXT DEFAULT (datetime('now')),
  scheduled_date TEXT
);

CREATE TABLE job_run_results (
  run_id TEXT PRIMARY KEY,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly','sector-rotation')),
  status TEXT NOT NULL CHECK(status IN ('running','success','failed','partial')),
  current_stage TEXT,
  errors_json TEXT,
  warnings_json TEXT,
  started_at TEXT NOT NULL,
  executed_at TEXT,
  trigger_source TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE job_stage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  stage TEXT NOT NULL CHECK(stage IN ('init','data_fetch','ai_analysis','storage','finalize')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  status TEXT,
  errors_json TEXT,
  warnings_json TEXT,
  details_json TEXT,
  FOREIGN KEY (run_id) REFERENCES job_run_results(run_id)
);

CREATE TABLE market_close_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  close_date TEXT NOT NULL,
  close_price REAL,
  previous_close REAL,
  day_change REAL,
  volume INTEGER,
  timestamp INTEGER,
  data_source TEXT DEFAULT 'yahoo',
  fetch_status TEXT DEFAULT 'success',
  fetch_error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(symbol, close_date)
);

CREATE TABLE news_cache_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  cache_result TEXT NOT NULL CHECK(cache_result IN ('hit', 'miss')),
  articles_count INTEGER DEFAULT 0,
  job_type TEXT,
  run_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE news_fetch_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  fetch_date TEXT NOT NULL,
  total_articles INTEGER NOT NULL DEFAULT 0,
  attempts_json TEXT,
  finnhub_status TEXT, finnhub_count INTEGER DEFAULT 0, finnhub_error TEXT,
  fmp_status TEXT, fmp_count INTEGER DEFAULT 0, fmp_error TEXT,
  newsapi_status TEXT, newsapi_count INTEGER DEFAULT 0, newsapi_error TEXT,
  yahoo_status TEXT, yahoo_count INTEGER DEFAULT 0, yahoo_error TEXT,
  weekend_cache_status TEXT, weekend_cache_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE news_provider_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  provider TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT,
  request_context TEXT,
  job_type TEXT,
  run_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE report_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date TEXT NOT NULL,
  report_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, report_type, created_at)
);

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

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- NOTE: Legacy column names (gemma_* = primary model, distilbert_* = mate model)
-- Code aliases: gemma → primary, distilbert → mate
CREATE TABLE symbol_predictions (
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
  status TEXT DEFAULT 'success',
  error_message TEXT,
  news_source TEXT,
  articles_count INTEGER DEFAULT 0,
  raw_response TEXT,
  error_summary TEXT,
  gemma_status TEXT,              -- Primary model (GPT-OSS 120B)
  gemma_error TEXT,
  gemma_confidence REAL,
  gemma_response_time_ms INTEGER,
  distilbert_status TEXT,         -- Mate model (DeepSeek-R1 32B)
  distilbert_error TEXT,
  distilbert_confidence REAL,
  distilbert_response_time_ms INTEGER,
  model_selection_reason TEXT,
  articles_content TEXT,
  UNIQUE(symbol, prediction_date)
);

CREATE TABLE weekend_news_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  articles_json TEXT NOT NULL,
  articles_count INTEGER NOT NULL DEFAULT 0,
  fetch_date TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  source_providers TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(symbol, fetch_date)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_job_date_results_date ON job_date_results(scheduled_date DESC);
CREATE INDEX idx_job_date_results_status ON job_date_results(status) WHERE status = 'running';
CREATE INDEX idx_job_date_results_type ON job_date_results(report_type);
CREATE INDEX idx_job_executions_date ON job_executions(executed_at);
CREATE INDEX idx_job_executions_status ON job_executions(status);
CREATE INDEX idx_job_executions_type ON job_executions(job_type);
CREATE INDEX idx_job_run_results_created ON job_run_results(created_at DESC);
CREATE INDEX idx_job_run_results_date_type ON job_run_results(scheduled_date, report_type);
CREATE INDEX idx_job_run_results_status ON job_run_results(status);
CREATE INDEX idx_job_stage_log_lookup ON job_stage_log(scheduled_date, report_type, stage);
CREATE INDEX idx_job_stage_log_run ON job_stage_log(run_id, stage);
CREATE INDEX idx_market_close_symbol_date ON market_close_data(symbol, close_date DESC);
CREATE INDEX idx_news_cache_stats_created ON news_cache_stats(created_at);
CREATE INDEX idx_news_cache_stats_result ON news_cache_stats(cache_result);
CREATE INDEX idx_news_cache_stats_symbol ON news_cache_stats(symbol);
CREATE INDEX idx_news_fetch_log_date ON news_fetch_log(fetch_date DESC);
CREATE INDEX idx_news_fetch_log_symbol ON news_fetch_log(symbol);
CREATE INDEX idx_news_fetch_log_total ON news_fetch_log(total_articles);
CREATE INDEX idx_provider_failures_created ON news_provider_failures(created_at);
CREATE INDEX idx_provider_failures_provider ON news_provider_failures(provider);
CREATE INDEX idx_provider_failures_run_id ON news_provider_failures(run_id);
CREATE INDEX idx_provider_failures_symbol ON news_provider_failures(symbol);
CREATE INDEX idx_report_snapshots_created ON report_snapshots(created_at);
CREATE INDEX idx_report_snapshots_date_type ON report_snapshots(report_date, report_type);
CREATE INDEX idx_scheduled_job_results_created ON scheduled_job_results(created_at DESC);
CREATE INDEX idx_scheduled_job_results_date_type ON scheduled_job_results(scheduled_date, report_type);
CREATE INDEX idx_scheduled_job_results_run_id ON scheduled_job_results(run_id);
CREATE INDEX idx_symbol_predictions_date ON symbol_predictions(prediction_date);
CREATE INDEX idx_symbol_predictions_distilbert_status ON symbol_predictions(distilbert_status);
CREATE INDEX idx_symbol_predictions_gemma_status ON symbol_predictions(gemma_status);
CREATE INDEX idx_symbol_predictions_symbol ON symbol_predictions(symbol);
CREATE INDEX idx_weekend_news_cache_fetch ON weekend_news_cache(fetch_date DESC);
CREATE INDEX idx_weekend_news_cache_symbol ON weekend_news_cache(symbol);
CREATE INDEX idx_weekend_news_cache_valid ON weekend_news_cache(valid_until);
