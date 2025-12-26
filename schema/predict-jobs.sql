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
