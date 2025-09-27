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
    PROCESSING_DELAY_MS: 2000 // Delay between symbol processing
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
    BATCH_SIZE: 50 // For batch operations
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
      SYMBOLS: env.TRADING_SYMBOLS ? env.TRADING_SYMBOLS.split(',') : CONFIG.TRADING.SYMBOLS
    },
    LOGGING: {
      ...CONFIG.LOGGING,
      LEVEL: env.LOG_LEVEL || 'info'
    }
  };
}