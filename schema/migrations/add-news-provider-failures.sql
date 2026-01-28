-- Track news provider failures for debugging and monitoring
-- Created: 2026-01-29

CREATE TABLE IF NOT EXISTS news_provider_failures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'DAC', 'Finnhub', 'FMP', 'NewsAPI', 'Yahoo'
    error_type TEXT NOT NULL, -- 'timeout', 'rate_limit', 'no_data', 'api_error', 'network_error'
    error_message TEXT,
    request_context TEXT, -- JSON with additional context (endpoint, params, etc.)
    job_type TEXT, -- 'pre-market', 'intraday', 'end-of-day'
    run_id TEXT, -- Link to job_run_results
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_provider_failures_symbol ON news_provider_failures(symbol);
CREATE INDEX IF NOT EXISTS idx_provider_failures_provider ON news_provider_failures(provider);
CREATE INDEX IF NOT EXISTS idx_provider_failures_created ON news_provider_failures(created_at);
CREATE INDEX IF NOT EXISTS idx_provider_failures_run_id ON news_provider_failures(run_id);
