/**
 * Configuration Module
 * Centralized configuration management for TFT Trading System
 */

export const CONFIG = {
  // API Timeouts (milliseconds)
  TIMEOUTS: {
    API_REQUEST: 30000,
    KV_OPERATION: 5000,
    FACEBOOK_MESSAGE: 15000,
    ANALYSIS_PIPELINE: 120000,
    NEWS_FETCH: 20000,
    AI_MODEL_REQUEST: 45000
  },

  // Retry Configuration
  RETRY_COUNTS: {
    DEFAULT: 3,
    CRITICAL: 5,
    KV_OPERATIONS: 2,
    FACEBOOK_MESSAGING: 3,
    AI_MODEL_CALLS: 2
  },

  // Cron Schedule Configuration (EST/EDT times)
  CRON_SCHEDULES: {
    MORNING: { hour: 8, minute: 30, description: 'Morning predictions + alerts' },
    MIDDAY: { hour: 12, minute: 0, description: 'Midday validation + forecasts' },
    DAILY: { hour: 16, minute: 5, description: 'Daily validation + next-day predictions' },
    FRIDAY: { hour: 16, minute: 0, day: 5, description: 'Weekly market close report' },
    SUNDAY: { hour: 10, minute: 0, day: 0, description: 'Weekly accuracy report' }
  },

  // Trading Configuration
  TRADING: {
    SYMBOLS: ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'],
    MIN_NEWS_ARTICLES: 5,
    MAX_NEWS_ARTICLES: 20,
    CONFIDENCE_THRESHOLD: 0.6,
    SIGNAL_CONFIDENCE_THRESHOLD: 0.7,
    PROCESSING_DELAY_MS: 2000, // Delay between symbol processing
    HIGH_CONFIDENCE_THRESHOLD: 0.7, // For signal filtering
    MAX_SYMBOL_PROCESSING_TIME_MS: 30000 // Per symbol timeout
  },

  // Market Data Configuration
  MARKET_DATA: {
    CACHE_TTL: 300, // 5 minutes
    RATE_LIMIT_REQUESTS_PER_MINUTE: 20,
    RATE_LIMIT_WINDOW_MS: 60000,
    YAHOO_FINANCE_BASE_URL: 'https://query1.finance.yahoo.com',
    API_TIMEOUT_MS: 10000,
    MAX_RETRIES: 3,
    BACKOFF_MULTIPLIER: 2,
    INITIAL_BACKOFF_MS: 1000
  },

  // AI Model Configuration
  AI_MODELS: {
    GPT_OSS_120B: {
      name: 'gpt-oss-120b',
      max_tokens: 2000,
      temperature: 0.1,
      primary: true
    },
    DISTILBERT: {
      name: 'distilbert-sst-2-int8',
      fallback: true
    }
  },

  // KV Storage Configuration
  KV_STORAGE: {
    ANALYSIS_TTL: 604800, // 7 days
    GRANULAR_TTL: 7776000, // 90 days
    DAILY_SUMMARY_TTL: 604800, // 7 days
    STATUS_TTL: 604800, // 7 days for job status
    REPORT_CACHE_TTL: 180, // 3 minutes for report caching
    METADATA_TTL: 2592000, // 30 days for metadata
    BATCH_SIZE: 50, // For batch operations
    CONSISTENCY_TIMEOUT_MS: 15000, // 15 seconds for KV consistency
    CONSISTENCY_RETRY_DELAY_MS: 1000, // 1 second between retries
    MAX_RETRIES: 3 // Maximum retry attempts
  },

  // Facebook Messaging Configuration
  FACEBOOK: {
    MESSAGE_LENGTH_LIMIT: 300,
    RETRY_DELAY_MS: 2000,
    MAX_MESSAGE_ATTEMPTS: 3
  },

  // Logging Configuration
  LOGGING: {
    LEVELS: {
      ERROR: 'error',
      WARN: 'warn',
      INFO: 'info',
      DEBUG: 'debug'
    },
    REQUEST_ID_LENGTH: 36,
    MAX_LOG_PAYLOAD_SIZE: 1000
  },

  // Performance Monitoring
  PERFORMANCE: {
    SLOW_REQUEST_THRESHOLD_MS: 5000,
    MEMORY_WARNING_THRESHOLD_MB: 100,
    SUCCESS_RATE_THRESHOLD: 0.95
  },

  // API Endpoints
  ENDPOINTS: {
    HEALTH: '/health',
    ANALYZE: '/analyze',
    DAILY_SUMMARY: '/daily-summary',
    WEEKLY_ANALYSIS: '/weekly-analysis',
    CRON_HEALTH: '/cron-health'
  },

  // Business Metrics
  BUSINESS_KPI: {
    PREDICTION_ACCURACY_TARGET: 0.70,
    RESPONSE_TIME_TARGET_MS: 200,
    UPTIME_TARGET: 0.999,
    COST_PER_ANALYSIS_TARGET: 0.00 // $0.00 with Cloudflare AI
  },

  // Handler Configuration
  HANDLERS: {
    DEFAULT_TIMEOUT_MS: 30000,
    ENABLE_METRICS: true,
    ENABLE_AUTH: false,
    CONSISTENCY_CHECK_TIMEOUT_MS: 45000, // Extended timeout for consistency checks
    REQUEST_ID_LENGTH: 36
  },

  // Analysis Configuration
  ANALYSIS: {
    MAX_SYMBOLS_PER_BATCH: 5,
    DEFAULT_TIMEZONE: 'America/New_York',
    DATE_FORMAT: 'YYYY-MM-DD',
    WORKER_VERSION: '2.0',
    ENABLE_ENHANCED_FEATURES: true,
    SENTIMENT_SOURCES: ['free_news', 'ai_sentiment_analysis']
  },

  // UI/UX Configuration
  UI: {
    METRICS_GRID_COLUMNS: 'repeat(auto-fit, minmax(200px, 1fr))',
    CONFIDENCE_BAR_HEIGHT: '8px',
    DEFAULT_PAGE_TITLE: 'TFT Trading System',
    MAX_CONTENT_LENGTH: 30000,
    MOBILE_BREAKPOINT: '768px'
  },

  // Error Messages
  ERROR_MESSAGES: {
    MISSING_DEPENDENCIES: 'Waiting for Required Data',
    KV_CONSISTENCY: 'KV eventual consistency delays',
    MODEL_LOADING: 'Models not loaded',
    INVALID_SYMBOL: 'Invalid trading symbol',
    TIMEOUT: 'Operation timeout',
    RATE_LIMIT: 'Rate limit exceeded'
  }
};

/**
 * Get cron schedule configuration by trigger mode
 */
export function getCronConfig(triggerMode) {
  const scheduleMap = {
    'morning_prediction_alerts': CONFIG.CRON_SCHEDULES.MORNING,
    'midday_validation_prediction': CONFIG.CRON_SCHEDULES.MIDDAY,
    'next_day_market_prediction': CONFIG.CRON_SCHEDULES.DAILY,
    'weekly_market_close_analysis': CONFIG.CRON_SCHEDULES.FRIDAY,
    'weekly_accuracy_report': CONFIG.CRON_SCHEDULES.SUNDAY
  };

  return scheduleMap[triggerMode] || null;
}

/**
 * Get timeout for specific operation type
 */
export function getTimeout(operationType) {
  return CONFIG.TIMEOUTS[operationType.toUpperCase()] || CONFIG.TIMEOUTS.DEFAULT;
}

/**
 * Get retry count for specific operation type
 */
export function getRetryCount(operationType) {
  return CONFIG.RETRY_COUNTS[operationType.toUpperCase()] || CONFIG.RETRY_COUNTS.DEFAULT;
}

/**
 * Validate trading symbol
 */
export function isValidSymbol(symbol) {
  return CONFIG.TRADING.SYMBOLS.includes(symbol.toUpperCase());
}

/**
 * Get environment-aware configuration
 */
export function getEnvConfig(env) {
  return {
    ...CONFIG,
    TRADING: {
      ...CONFIG.TRADING,
      SYMBOLS: env.TRADING_SYMBOLS ? env.TRADING_SYMBOLS.split(',') : CONFIG.TRADING.SYMBOLS,
      MIN_NEWS_ARTICLES: parseInt(env.MIN_NEWS_ARTICLES) || CONFIG.TRADING.MIN_NEWS_ARTICLES,
      MAX_NEWS_ARTICLES: parseInt(env.MAX_NEWS_ARTICLES) || CONFIG.TRADING.MAX_NEWS_ARTICLES,
      CONFIDENCE_THRESHOLD: parseFloat(env.CONFIDENCE_THRESHOLD) || CONFIG.TRADING.CONFIDENCE_THRESHOLD,
      SIGNAL_CONFIDENCE_THRESHOLD: parseFloat(env.SIGNAL_CONFIDENCE_THRESHOLD) || CONFIG.TRADING.SIGNAL_CONFIDENCE_THRESHOLD
    },
    LOGGING: {
      ...CONFIG.LOGGING,
      LEVEL: env.LOG_LEVEL || 'info'
    },
    AI_MODELS: {
      ...CONFIG.AI_MODELS,
      GPT_OSS_120B: {
        ...CONFIG.AI_MODELS.GPT_OSS_120B,
        max_tokens: parseInt(env.GPT_MAX_TOKENS) || CONFIG.AI_MODELS.GPT_OSS_120B.max_tokens,
        temperature: parseFloat(env.GPT_TEMPERATURE) || CONFIG.AI_MODELS.GPT_OSS_120B.temperature
      }
    },
    KV_STORAGE: {
      ...CONFIG.KV_STORAGE,
      ANALYSIS_TTL: parseInt(env.KV_ANALYSIS_TTL) || CONFIG.KV_STORAGE.ANALYSIS_TTL,
      GRANULAR_TTL: parseInt(env.KV_GRANULAR_TTL) || CONFIG.KV_STORAGE.GRANULAR_TTL
    },
    MARKET_DATA: {
      ...CONFIG.MARKET_DATA,
      CACHE_TTL: parseInt(env.MARKET_DATA_CACHE_TTL) || CONFIG.MARKET_DATA.CACHE_TTL,
      RATE_LIMIT_REQUESTS_PER_MINUTE: parseInt(env.YAHOO_FINANCE_RATE_LIMIT) || CONFIG.MARKET_DATA.RATE_LIMIT_REQUESTS_PER_MINUTE,
      RATE_LIMIT_WINDOW_MS: parseInt(env.RATE_LIMIT_WINDOW) || CONFIG.MARKET_DATA.RATE_LIMIT_WINDOW_MS
    },
    ANALYSIS: {
      ...CONFIG.ANALYSIS,
      TIMEZONE: env.TIMEZONE || CONFIG.ANALYSIS.DEFAULT_TIMEZONE,
      WORKER_VERSION: env.WORKER_VERSION || CONFIG.ANALYSIS.WORKER_VERSION
    }
  };
}

/**
 * Get KV TTL by key type
 */
export function getKVTTl(keyType) {
  const ttlMap = {
    'analysis': CONFIG.KV_STORAGE.ANALYSIS_TTL,
    'granular': CONFIG.KV_STORAGE.GRANULAR_TTL,
    'daily_summary': CONFIG.KV_STORAGE.DAILY_SUMMARY_TTL,
    'status': CONFIG.KV_STORAGE.STATUS_TTL,
    'report_cache': CONFIG.KV_STORAGE.REPORT_CACHE_TTL,
    'metadata': CONFIG.KV_STORAGE.METADATA_TTL
  };

  return ttlMap[keyType.toLowerCase()] || CONFIG.KV_STORAGE.ANALYSIS_TTL;
}

/**
 * Get UI configuration value
 */
export function getUIConfig(key) {
  return CONFIG.UI[key.toUpperCase()] || null;
}

/**
 * Get error message by type
 */
export function getErrorMessage(errorType) {
  return CONFIG.ERROR_MESSAGES[errorType.toUpperCase()] || 'Unknown error';
}

/**
 * Get handler configuration
 */
export function getHandlerConfig() {
  return CONFIG.HANDLERS;
}

/**
 * Get market data configuration
 */
export function getMarketDataConfig() {
  return CONFIG.MARKET_DATA;
}

/**
 * Get analysis configuration
 */
export function getAnalysisConfig() {
  return CONFIG.ANALYSIS;
}

/**
 * Check if enhanced features are enabled
 */
export function isEnhancedFeaturesEnabled() {
  return CONFIG.ANALYSIS.ENABLE_ENHANCED_FEATURES;
}