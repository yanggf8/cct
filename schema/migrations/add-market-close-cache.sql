-- Migration: Add market_close_data table for caching Yahoo Finance data
-- Purpose: Cache market close data in D1 on first fetch, use cached data for reruns
-- Run: npx wrangler d1 execute cct-predict-jobs --remote --file=schema/migrations/add-market-close-cache.sql

CREATE TABLE IF NOT EXISTS market_close_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  close_date TEXT NOT NULL,              -- YYYY-MM-DD
  close_price REAL,
  previous_close REAL,
  day_change REAL,                       -- Percentage
  volume INTEGER,
  timestamp INTEGER,                     -- Unix timestamp from Yahoo
  data_source TEXT DEFAULT 'yahoo',      -- 'yahoo', 'manual', etc.
  fetch_status TEXT DEFAULT 'success',   -- 'success', 'failed', 'no_data'
  fetch_error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(symbol, close_date)
);

CREATE INDEX IF NOT EXISTS idx_market_close_symbol_date
  ON market_close_data(symbol, close_date DESC);
