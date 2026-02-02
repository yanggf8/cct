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
  latest_run_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (scheduled_date, report_type)
);

CREATE INDEX IF NOT EXISTS idx_job_date_results_date ON job_date_results(scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_date_results_status ON job_date_results(status) WHERE status = 'running';

-- ============================================================================
-- Navigation Status Tables v2.3 (Multi-Run Support)
-- NOTE (added 2026-02-02): job_stage_log includes per-stage outcome fields
-- ============================================================================

-- Run history (multiple rows per scheduled_date/report_type)
CREATE TABLE IF NOT EXISTS job_run_results (
  run_id TEXT PRIMARY KEY,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly','sector-rotation')),
  status TEXT NOT NULL CHECK(status IN ('success','partial','failed','running')),
  current_stage TEXT,
  errors_json TEXT,
  warnings_json TEXT,
  started_at TEXT NOT NULL,
  executed_at TEXT,
  trigger_source TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_job_run_results_lookup ON job_run_results(scheduled_date, report_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_run_results_status ON job_run_results(status) WHERE status = 'running';

-- Stage timeline per run (append-only inserts, update ended_at + outcome)
CREATE TABLE IF NOT EXISTS job_stage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly','sector-rotation')),
  stage TEXT NOT NULL CHECK(stage IN ('init','data_fetch','ai_analysis','storage','finalize')),
  status TEXT CHECK(status IN ('running','success','failed')),
  errors_json TEXT,
  warnings_json TEXT,
  details_json TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES job_run_results(run_id)
);

CREATE INDEX IF NOT EXISTS idx_job_stage_log_run ON job_stage_log(run_id, stage);
CREATE INDEX IF NOT EXISTS idx_job_stage_log_lookup ON job_stage_log(scheduled_date, report_type, stage);

-- Report content snapshots (multi-run, report_type intentionally unconstrained)
CREATE TABLE IF NOT EXISTS scheduled_job_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL,
  report_content TEXT NOT NULL,
  metadata TEXT,
  trigger_source TEXT,
  run_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scheduled_job_results_lookup ON scheduled_job_results(scheduled_date DESC, report_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_job_results_run ON scheduled_job_results(run_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_job_results_run_unique ON scheduled_job_results(run_id);

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


-- News Cache Statistics (added 2026-01-29)
-- Track cache hit/miss rates for monitoring
CREATE TABLE IF NOT EXISTS news_cache_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  cache_result TEXT NOT NULL CHECK(cache_result IN ('hit', 'miss')),
  articles_count INTEGER DEFAULT 0,
  job_type TEXT, -- 'pre-market', 'intraday', 'end-of-day'
  run_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_cache_stats_symbol ON news_cache_stats(symbol);
CREATE INDEX IF NOT EXISTS idx_news_cache_stats_result ON news_cache_stats(cache_result);
CREATE INDEX IF NOT EXISTS idx_news_cache_stats_created ON news_cache_stats(created_at);

-- Weekend News Cache (added 2026-02-02)
-- Persists Friday's news articles so Monday pre-market can fall back to them
-- when live news providers have no fresh articles early Monday morning
CREATE TABLE IF NOT EXISTS weekend_news_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  articles_json TEXT NOT NULL,  -- JSON array of NewsArticle objects
  articles_count INTEGER NOT NULL DEFAULT 0,
  fetch_date TEXT NOT NULL,     -- Date articles were fetched (e.g., '2026-02-06' for Friday)
  valid_until TEXT NOT NULL,    -- When this cache expires (Monday 18:00 UTC)
  source_providers TEXT,        -- Which providers contributed ('finnhub,fmp,yahoo')
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(symbol, fetch_date)
);

CREATE INDEX IF NOT EXISTS idx_weekend_news_cache_symbol ON weekend_news_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_weekend_news_cache_valid ON weekend_news_cache(valid_until);
CREATE INDEX IF NOT EXISTS idx_weekend_news_cache_fetch ON weekend_news_cache(fetch_date DESC);

-- News Fetch Log (added 2026-02-02)
-- Detailed per-symbol tracking of each news provider attempt
-- Critical for diagnosing "0 articles" failures
CREATE TABLE IF NOT EXISTS news_fetch_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  fetch_date TEXT NOT NULL,     -- ISO timestamp of fetch attempt
  total_articles INTEGER NOT NULL DEFAULT 0,
  attempts_json TEXT,           -- Full JSON array of all attempts
  -- Per-provider status columns for easy querying
  finnhub_status TEXT,          -- 'success', 'failed', 'skipped', 'no_data', 'not_attempted'
  finnhub_count INTEGER DEFAULT 0,
  finnhub_error TEXT,
  fmp_status TEXT,
  fmp_count INTEGER DEFAULT 0,
  fmp_error TEXT,
  newsapi_status TEXT,
  newsapi_count INTEGER DEFAULT 0,
  newsapi_error TEXT,
  yahoo_status TEXT,
  yahoo_count INTEGER DEFAULT 0,
  yahoo_error TEXT,
  weekend_cache_status TEXT,
  weekend_cache_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_fetch_log_symbol ON news_fetch_log(symbol);
CREATE INDEX IF NOT EXISTS idx_news_fetch_log_date ON news_fetch_log(fetch_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_fetch_log_total ON news_fetch_log(total_articles);
-- Index for finding failures (total_articles = 0)
CREATE INDEX IF NOT EXISTS idx_news_fetch_log_failures ON news_fetch_log(total_articles) WHERE total_articles = 0;
