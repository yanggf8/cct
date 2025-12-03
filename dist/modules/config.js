/**
 * Configuration Module - TypeScript
 * Centralized, type-safe configuration management for TFT Trading System
 */
// Configuration Object
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
        PROCESSING_DELAY_MS: 2000,
        HIGH_CONFIDENCE_THRESHOLD: 0.7,
        MAX_SYMBOL_PROCESSING_TIME_MS: 30000
    },
    // Market Data Configuration
    MARKET_DATA: {
        FRED_API_BASE_URL: 'https://api.stlouisfed.org/fred',
        FRED_RATE_LIMIT_DELAY_MS: 1000,
        FRED_MAX_RETRIES: 3,
        FRED_CACHE_ENABLED: true,
        YAHOO_FINANCE_BASE_URL: 'https://query1.finance.yahoo.com',
        YAHOO_FINANCE_RATE_LIMIT: 20,
        API_TIMEOUT_MS: 10000,
        MAX_RETRIES: 3,
        BACKOFF_MULTIPLIER: 2,
        INITIAL_BACKOFF_MS: 1000,
        VIX_SYMBOL: '^VIX',
        MARKET_DATA_SYMBOLS: ['^VIX', '^TNX', '^TYX', 'DX-Y.NYB', 'GC=F', 'CL=F'],
        REFRESH_INTERVALS: {
            MARKET_HOURS: 300, // 5 minutes during market hours
            AFTER_HOURS: 1800, // 30 minutes after hours
            WEEKEND: 3600, // 1 hour on weekends
            FRED_ECONOMIC_DATA: 3600, // 1 hour for economic data
            MARKET_STRUCTURE: 300, // 5 minutes for market structure data
        }
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
        ANALYSIS_TTL: 604800,
        GRANULAR_TTL: 7776000,
        DAILY_SUMMARY_TTL: 604800,
        STATUS_TTL: 604800,
        REPORT_CACHE_TTL: 180,
        METADATA_TTL: 2592000,
        BATCH_SIZE: 50,
        CONSISTENCY_TIMEOUT_MS: 15000,
        CONSISTENCY_RETRY_DELAY_MS: 1000,
        MAX_RETRIES: 3
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
        COST_PER_ANALYSIS_TARGET: 0.00
    },
    // Handler Configuration
    HANDLERS: {
        DEFAULT_TIMEOUT_MS: 30000,
        ENABLE_METRICS: true,
        ENABLE_AUTH: false,
        CONSISTENCY_CHECK_TIMEOUT_MS: 45000,
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
    const key = operationType.toUpperCase();
    return CONFIG.TIMEOUTS[key] || CONFIG.TIMEOUTS.API_REQUEST;
}
/**
 * Get retry count for specific operation type
 */
export function getRetryCount(operationType) {
    const key = operationType.toUpperCase();
    return CONFIG.RETRY_COUNTS[key] || CONFIG.RETRY_COUNTS.DEFAULT;
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
    const mode = (env.ENVIRONMENT || 'development').toLowerCase();
    return {
        ...CONFIG,
        TRADING: {
            ...CONFIG.TRADING,
            SYMBOLS: env.TRADING_SYMBOLS ? env.TRADING_SYMBOLS.split(',') : CONFIG.TRADING.SYMBOLS,
            MIN_NEWS_ARTICLES: parseInt(env.MIN_NEWS_ARTICLES || '') || CONFIG.TRADING.MIN_NEWS_ARTICLES,
            MAX_NEWS_ARTICLES: parseInt(env.MAX_NEWS_ARTICLES || '') || CONFIG.TRADING.MAX_NEWS_ARTICLES,
            CONFIDENCE_THRESHOLD: parseFloat(env.CONFIDENCE_THRESHOLD || '') || CONFIG.TRADING.CONFIDENCE_THRESHOLD,
            SIGNAL_CONFIDENCE_THRESHOLD: parseFloat(env.SIGNAL_CONFIDENCE_THRESHOLD || '') || CONFIG.TRADING.SIGNAL_CONFIDENCE_THRESHOLD
        },
        LOGGING: {
            ...CONFIG.LOGGING,
            LEVEL: env.LOG_LEVEL || (mode === 'production' ? 'info' : 'debug')
        },
        AI_MODELS: {
            ...CONFIG.AI_MODELS,
            GPT_OSS_120B: {
                ...CONFIG.AI_MODELS.GPT_OSS_120B,
                max_tokens: parseInt(env.GPT_MAX_TOKENS || '') || CONFIG.AI_MODELS.GPT_OSS_120B.max_tokens,
                temperature: parseFloat(env.GPT_TEMPERATURE || '') || CONFIG.AI_MODELS.GPT_OSS_120B.temperature
            }
        },
        KV_STORAGE: {
            ...CONFIG.KV_STORAGE,
            ANALYSIS_TTL: parseInt(env.KV_ANALYSIS_TTL) || CONFIG.KV_STORAGE.ANALYSIS_TTL,
            GRANULAR_TTL: parseInt(env.KV_GRANULAR_TTL) || CONFIG.KV_STORAGE.GRANULAR_TTL
        },
        MARKET_DATA: {
            ...CONFIG.MARKET_DATA,
            FRED_API_KEY: env.FRED_API_KEY || env.FRED_API_KEYS?.split(',')[0]?.trim() || (mode === 'development' ? 'demo-key' : undefined),
            FRED_RATE_LIMIT_DELAY_MS: parseInt(env.FRED_RATE_LIMIT_DELAY_MS || '') || CONFIG.MARKET_DATA.FRED_RATE_LIMIT_DELAY_MS,
            FRED_MAX_RETRIES: parseInt(env.FRED_MAX_RETRIES || '') || CONFIG.MARKET_DATA.FRED_MAX_RETRIES,
            FRED_CACHE_ENABLED: env.FRED_CACHE_ENABLED !== 'false',
            YAHOO_FINANCE_RATE_LIMIT: parseInt(env.YAHOO_FINANCE_RATE_LIMIT || '') || CONFIG.MARKET_DATA.YAHOO_FINANCE_RATE_LIMIT,
            VIX_SYMBOL: env.VIX_SYMBOL || CONFIG.MARKET_DATA.VIX_SYMBOL,
            MARKET_DATA_SYMBOLS: env.MARKET_DATA_SYMBOLS ? env.MARKET_DATA_SYMBOLS.split(',').map((s) => s.trim()) : CONFIG.MARKET_DATA.MARKET_DATA_SYMBOLS,
            REFRESH_INTERVALS: {
                MARKET_HOURS: parseInt(env.MARKET_REFRESH_MARKET_HOURS) || CONFIG.MARKET_DATA.REFRESH_INTERVALS.MARKET_HOURS,
                AFTER_HOURS: parseInt(env.MARKET_REFRESH_AFTER_HOURS) || CONFIG.MARKET_DATA.REFRESH_INTERVALS.AFTER_HOURS,
                WEEKEND: parseInt(env.MARKET_REFRESH_WEEKEND) || CONFIG.MARKET_DATA.REFRESH_INTERVALS.WEEKEND,
                FRED_ECONOMIC_DATA: parseInt(env.FRED_REFRESH_ECONOMIC_DATA) || CONFIG.MARKET_DATA.REFRESH_INTERVALS.FRED_ECONOMIC_DATA,
                MARKET_STRUCTURE: parseInt(env.MARKET_REFRESH_STRUCTURE) || CONFIG.MARKET_DATA.REFRESH_INTERVALS.MARKET_STRUCTURE,
            }
        },
        ANALYSIS: {
            ...CONFIG.ANALYSIS,
            TIMEZONE: env.TIMEZONE || CONFIG.ANALYSIS.DEFAULT_TIMEZONE,
            WORKER_VERSION: env.WORKER_VERSION || CONFIG.ANALYSIS.WORKER_VERSION
        }
    };
}
/**
 * API environment validation and key helpers
 */
export function validateAPIEnvironment(env) {
    const mode = (env.ENVIRONMENT || 'development').toLowerCase();
    if (mode === 'production') {
        const missing = [];
        if (!env.FRED_API_KEY && !env.FRED_API_KEYS)
            missing.push('FRED_API_KEY or FRED_API_KEYS');
        if (missing.length) {
            throw new Error(`Missing required API configuration for production: ${missing.join(', ')}`);
        }
    }
}
export function getFredApiKeys(env) {
    const keys = env.FRED_API_KEYS || env.FRED_API_KEY || '';
    return keys
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
}
/**
 * Validate API key and check if real API integration is available
 */
export function isRealAPIAvailable(env) {
    const config = getEnvConfig(env);
    const mode = (env.ENVIRONMENT || 'development').toLowerCase();
    // Check if FRED API key is configured and not a demo/mock key
    const hasRealFREDKey = config.MARKET_DATA.FRED_API_KEY &&
        !['demo-key', 'mock-key', 'test-key'].includes(config.MARKET_DATA.FRED_API_KEY);
    // In production mode, require real API keys
    if (mode === 'production') {
        return hasRealFREDKey || false;
    }
    // In development mode, allow demo key but log warning
    if (!hasRealFREDKey) {
        console.warn('⚠️ Using demo/mock FRED API key. Set FRED_API_KEY environment variable for real data.');
    }
    return true; // Always available in dev mode
}
/**
 * Get API configuration with proper validation
 */
export function getAPIConfiguration(env) {
    const config = getEnvConfig(env);
    const isRealAPI = isRealAPIAvailable(env);
    return {
        fred: {
            apiKey: config.MARKET_DATA.FRED_API_KEY,
            baseUrl: config.MARKET_DATA.FRED_API_BASE_URL,
            rateLimitDelay: config.MARKET_DATA.FRED_RATE_LIMIT_DELAY_MS,
            maxRetries: config.MARKET_DATA.FRED_MAX_RETRIES,
            cacheEnabled: config.MARKET_DATA.FRED_CACHE_ENABLED,
            isRealData: isRealAPI && !['demo-key', 'mock-key', 'test-key'].includes(config.MARKET_DATA.FRED_API_KEY || '')
        },
        yahooFinance: {
            baseUrl: config.MARKET_DATA.YAHOO_FINANCE_BASE_URL,
            rateLimit: config.MARKET_DATA.YAHOO_FINANCE_RATE_LIMIT,
            symbols: config.MARKET_DATA.MARKET_DATA_SYMBOLS,
            vixSymbol: config.MARKET_DATA.VIX_SYMBOL
        },
        refreshIntervals: config.MARKET_DATA.REFRESH_INTERVALS,
        isDevelopment: (env.ENVIRONMENT || 'development').toLowerCase() === 'development',
        isProduction: (env.ENVIRONMENT || 'development').toLowerCase() === 'production'
    };
}
/**
 * Get KV TTL by key type
 */
export function getKVTTL(keyType) {
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
    const uiKey = key.toUpperCase();
    return CONFIG.UI[uiKey] || null;
}
/**
 * Get error message by type
 */
export function getErrorMessage(errorType) {
    const errorKey = errorType.toUpperCase();
    return CONFIG.ERROR_MESSAGES[errorKey] || 'Unknown error';
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
/**
 * Get storage adapter configuration
 */
export function getStorageAdapterConfig(env) {
    // Default disabled for safety - can be enabled via environment variables
    const enabled = env.STORAGE_ADAPTER_ENABLED === 'true' || process.env.STORAGE_ADAPTER_ENABLED === 'true';
    return {
        enabled,
        modes: {
            hot_cache: env.HOT_CACHE_MODE || 'disabled',
            warm_cache: env.WARM_CACHE_MODE || 'disabled',
            cold_storage: env.COLD_STORAGE_MODE === 'd1' ? 'd1' : 'disabled',
            ephemeral: env.EPHEMERAL_MODE === 'memory' ? 'memory' : 'disabled'
        },
        keyPatterns: [
            { pattern: '^analysis_.*', storageClass: 'hot_cache' },
            { pattern: '^dual_ai_analysis_.*', storageClass: 'hot_cache' },
            { pattern: '^market_cache_.*', storageClass: 'hot_cache' },
            { pattern: '^report_cache_.*', storageClass: 'hot_cache' },
            { pattern: '^job_.*_status_.*', storageClass: 'ephemeral' },
            { pattern: '^daily_summary_.*', storageClass: 'cold_storage' },
            { pattern: '^facebook_.*', storageClass: 'cold_storage' },
            { pattern: '.*', storageClass: 'hot_cache' } // Default fallback
        ],
        recencyThreshold: 24, // 24 hours for analysis hot/warm split
        ttlPolicies: {
            hot_cache: 3600, // 1 hour
            warm_cache: 604800, // 7 days
            cold_storage: 7776000, // 90 days
            ephemeral: 3600 // 1 hour
        }
    };
}
/**
 * Get metrics configuration with production safety controls
 */
export function getMetricsConfig(env) {
    // Metrics are enabled by default when storage adapters are enabled
    const storageAdapterEnabled = env.STORAGE_ADAPTER_ENABLED === 'true';
    const metricsEnabled = storageAdapterEnabled &&
        (env.METRICS_ENABLED !== 'false'); // Can be explicitly disabled
    return {
        enabled: metricsEnabled,
        prometheus: {
            enabled: env.METRICS_PROMETHEUS_ENABLED !== 'false', // Default enabled
            endpoint: '/api/v1/cache/metrics.prom',
            refreshInterval: parseInt(env.METRICS_REFRESH_INTERVAL || '30', 10)
        },
        json: {
            enabled: env.METRICS_JSON_ENABLED !== 'false', // Default enabled
            endpoint: '/api/v1/cache/metrics',
            refreshInterval: parseInt(env.METRICS_REFRESH_INTERVAL || '30', 10)
        },
        collection: {
            enabled: env.METRICS_COLLECTION_ENABLED !== 'false', // Default enabled
            sampleRate: Math.max(0.0, Math.min(1.0, parseFloat(env.METRICS_SAMPLE_RATE || '1.0'))),
            maxOperations: parseInt(env.METRICS_MAX_OPERATIONS || '10000', 10)
        },
        production: {
            enforceQuotas: env.PRODUCTION_METRICS_ENFORCE_QUOTAS === 'true', // Default false
            maxMemoryMB: parseInt(env.PRODUCTION_METRICS_MAX_MEMORY_MB || '50', 10),
            maxLatencyMs: parseInt(env.PRODUCTION_METRICS_MAX_LATENCY_MS || '100', 10),
            errorThreshold: Math.max(0.0, Math.min(1.0, parseFloat(env.PRODUCTION_METRICS_ERROR_THRESHOLD || '0.05')))
        }
    };
}
//# sourceMappingURL=config.js.map