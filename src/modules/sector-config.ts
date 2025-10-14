/**
 * Sector Configuration - TypeScript
 * Conservative configuration for sector rotation analysis
 * ZERO dependencies on AI/News APIs - Yahoo Finance data ONLY
 */

export const SECTOR_CONFIG = {
  // SPDR Sector ETF Symbols + S&P 500 Benchmark
  SYMBOLS: [
    'XLK',   // Technology
    'XLV',   // Health Care
    'XLF',   // Financials
    'XLY',   // Consumer Discretionary
    'XLC',   // Communication Services
    'XLI',   // Industrials
    'XLP',   // Consumer Staples
    'XLE',   // Energy
    'XLU',   // Utilities
    'XLRE',  // Real Estate
    'XLB',   // Materials
    'SPY'    // S&P 500 Benchmark
  ],

  // Sector Names for Display
  SECTOR_NAMES: {
    'XLK': 'Technology',
    'XLV': 'Health Care',
    'XLF': 'Financials',
    'XLY': 'Consumer Discretionary',
    'XLC': 'Communication Services',
    'XLI': 'Industrials',
    'XLP': 'Consumer Staples',
    'XLE': 'Energy',
    'XLU': 'Utilities',
    'XLRE': 'Real Estate',
    'XLB': 'Materials',
    'SPY': 'S&P 500'
  },

  // Conservative Refresh Intervals (seconds)
  REFRESH_INTERVALS: {
    MARKET_HOURS: 600,      // 10 minutes (conservative)
    AFTER_HOURS: 3600,      // 1 hour
    WEEKEND: 21600          // 6 hours
  },

  // Aggressive Caching to Minimize API Calls
  CACHE_TTL: {
    L1_MEMORY: 300,         // 5 minutes (in-memory)
    L2_KV: 1800,            // 30 minutes (KV storage - long!)
    L3_KV_AFTER_HOURS: 7200 // 2 hours (after hours)
  },

  // Conservative Rate Limiting
  RATE_LIMITING: {
    MAX_CONCURRENT_REQUESTS: 3,     // Very conservative
    BATCH_DELAY_MS: 4000,           // 4 seconds between symbols
    RATE_LIMIT_BUFFER: 0.6,         // Use 60% of available limit
    MAX_RETRIES: 2,                 // Reduce retries
    RETRY_DELAY_MS: 8000            // 8 seconds between retries
  },

  // Timeframes for Analysis
  TIMEFRAMES: {
    SHORT: '1M',    // 1 month for momentum
    MEDIUM: '3M',   // 3 months for primary analysis
    LONG: '6M'      // 6 months for trend confirmation
  },

  // Indicator Periods
  INDICATORS: {
    OBV: 0,                    // Cumulative (no period)
    CMF: 20,                   // 20-period Chaikin Money Flow
    MOMENTUM: 10,              // 10-period rate of change
    RELATIVE_STRENGTH: 60      // 60-day rolling window
  },

  // Rotation Quadrant Thresholds
  QUADRANT_THRESHOLDS: {
    RS_PERFORMANCE: 100,       // RS > 100 = outperforming SPY
    MOMENTUM_POSITIVE: 0,      // Momentum > 0 = positive
    MIN_VOLUME: 100000,        // Minimum daily volume for ETFs
    STALE_DATA_MINUTES: 15     // Data considered stale after 15 minutes
  },

  // Data Validation Rules
  VALIDATION: {
    MIN_PRICE: 1,              // Minimum valid price
    MAX_PRICE_CHANGE: 50,      // Max daily change % (filters errors)
    MIN_VOLUME: 10000,         // Minimum volume threshold
    MAX_SPREAD_BPS: 500        // Max bid-ask spread in bps
  },

  // Performance Monitoring
  PERFORMANCE: {
    MAX_FETCH_TIME_MS: 30000,  // 30 seconds max for batch
    MAX_CALCULATION_TIME_MS: 2000, // 2 seconds max for indicators
    CACHE_HIT_RATE_TARGET: 0.85,  // 85% cache hit rate target
    SUCCESS_RATE_TARGET: 0.99     // 99% success rate target
  }
};

export default SECTOR_CONFIG;