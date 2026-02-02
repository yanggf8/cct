-- Migration: Add Weekend News Cache Table
-- Date: 2026-02-02
-- Purpose: Persist Friday's news articles so Monday pre-market can use them
--          when live news providers have no fresh content early Monday morning

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
