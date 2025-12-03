/**
 * Configuration Module - TypeScript
 * Centralized, type-safe configuration management for TFT Trading System
 */
import type { CloudflareEnvironment } from '../types.js';
export interface TimeoutConfig {
    API_REQUEST: number;
    KV_OPERATION: number;
    FACEBOOK_MESSAGE: number;
    ANALYSIS_PIPELINE: number;
    NEWS_FETCH: number;
    AI_MODEL_REQUEST: number;
}
export interface RetryConfig {
    DEFAULT: number;
    CRITICAL: number;
    KV_OPERATIONS: number;
    FACEBOOK_MESSAGING: number;
    AI_MODEL_CALLS: number;
}
export interface CronScheduleItem {
    hour: number;
    minute: number;
    day?: number;
    description: string;
}
export interface CronSchedules {
    MORNING: CronScheduleItem;
    MIDDAY: CronScheduleItem;
    DAILY: CronScheduleItem;
    FRIDAY: CronScheduleItem;
    SUNDAY: CronScheduleItem;
}
export interface TradingConfig {
    SYMBOLS: string[];
    MIN_NEWS_ARTICLES: number;
    MAX_NEWS_ARTICLES: number;
    CONFIDENCE_THRESHOLD: number;
    SIGNAL_CONFIDENCE_THRESHOLD: number;
    PROCESSING_DELAY_MS: number;
    HIGH_CONFIDENCE_THRESHOLD: number;
    MAX_SYMBOL_PROCESSING_TIME_MS: number;
}
export interface MarketDataConfig {
    FRED_API_KEY?: string;
    FRED_API_BASE_URL: string;
    FRED_RATE_LIMIT_DELAY_MS: number;
    FRED_MAX_RETRIES: number;
    FRED_CACHE_ENABLED: boolean;
    YAHOO_FINANCE_BASE_URL: string;
    YAHOO_FINANCE_RATE_LIMIT: number;
    API_TIMEOUT_MS: number;
    MAX_RETRIES: number;
    BACKOFF_MULTIPLIER: number;
    INITIAL_BACKOFF_MS: number;
    VIX_SYMBOL: string;
    MARKET_DATA_SYMBOLS: string[];
    REFRESH_INTERVALS: {
        MARKET_HOURS: number;
        AFTER_HOURS: number;
        WEEKEND: number;
        FRED_ECONOMIC_DATA: number;
        MARKET_STRUCTURE: number;
    };
}
export interface AIModelConfig {
    name: string;
    max_tokens?: number;
    temperature?: number;
    primary?: boolean;
    fallback?: boolean;
}
export interface AIModelsConfig {
    GPT_OSS_120B: AIModelConfig;
    DISTILBERT: AIModelConfig;
}
export interface KVStorageConfig {
    ANALYSIS_TTL: number;
    GRANULAR_TTL: number;
    DAILY_SUMMARY_TTL: number;
    STATUS_TTL: number;
    REPORT_CACHE_TTL: number;
    METADATA_TTL: number;
    BATCH_SIZE: number;
    CONSISTENCY_TIMEOUT_MS: number;
    CONSISTENCY_RETRY_DELAY_MS: number;
    MAX_RETRIES: number;
}
export interface StorageClassConfig {
    hot_cache: 'disabled' | 'dual' | 'do' | 'do_final';
    warm_cache: 'disabled' | 'dual' | 'do' | 'do_final';
    cold_storage: 'disabled' | 'd1';
    ephemeral: 'disabled' | 'memory';
}
export interface StorageRoutingPattern {
    pattern: string;
    storageClass: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
}
export interface StorageAdapterConfig {
    enabled: boolean;
    modes: StorageClassConfig;
    keyPatterns: StorageRoutingPattern[];
    recencyThreshold: number;
    ttlPolicies: {
        hot_cache: number;
        warm_cache: number;
        cold_storage: number;
        ephemeral: number;
    };
}
export interface MetricsConfig {
    enabled: boolean;
    prometheus: {
        enabled: boolean;
        endpoint: string;
        refreshInterval: number;
    };
    json: {
        enabled: boolean;
        endpoint: string;
        refreshInterval: number;
    };
    collection: {
        enabled: boolean;
        sampleRate: number;
        maxOperations: number;
    };
    production: {
        enforceQuotas: boolean;
        maxMemoryMB: number;
        maxLatencyMs: number;
        errorThreshold: number;
    };
}
export interface FacebookConfig {
    MESSAGE_LENGTH_LIMIT: number;
    RETRY_DELAY_MS: number;
    MAX_MESSAGE_ATTEMPTS: number;
}
export interface LoggingLevels {
    ERROR: string;
    WARN: string;
    INFO: string;
    DEBUG: string;
}
export interface LoggingConfig {
    LEVELS: LoggingLevels;
    REQUEST_ID_LENGTH: number;
    MAX_LOG_PAYLOAD_SIZE: number;
    LEVEL?: string;
}
export interface PerformanceConfig {
    SLOW_REQUEST_THRESHOLD_MS: number;
    MEMORY_WARNING_THRESHOLD_MB: number;
    SUCCESS_RATE_THRESHOLD: number;
}
export interface EndpointsConfig {
    HEALTH: string;
    ANALYZE: string;
    DAILY_SUMMARY: string;
    WEEKLY_ANALYSIS: string;
    CRON_HEALTH: string;
}
export interface BusinessKPIConfig {
    PREDICTION_ACCURACY_TARGET: number;
    RESPONSE_TIME_TARGET_MS: number;
    UPTIME_TARGET: number;
    COST_PER_ANALYSIS_TARGET: number;
}
export interface HandlersConfig {
    DEFAULT_TIMEOUT_MS: number;
    ENABLE_METRICS: boolean;
    ENABLE_AUTH: boolean;
    CONSISTENCY_CHECK_TIMEOUT_MS: number;
    REQUEST_ID_LENGTH: number;
}
export interface AnalysisConfig {
    MAX_SYMBOLS_PER_BATCH: number;
    DEFAULT_TIMEZONE: string;
    DATE_FORMAT: string;
    WORKER_VERSION: string;
    ENABLE_ENHANCED_FEATURES: boolean;
    SENTIMENT_SOURCES: string[];
    TIMEZONE?: string;
}
export interface UIConfig {
    METRICS_GRID_COLUMNS: string;
    CONFIDENCE_BAR_HEIGHT: string;
    DEFAULT_PAGE_TITLE: string;
    MAX_CONTENT_LENGTH: number;
    MOBILE_BREAKPOINT: string;
}
export interface ErrorMessagesConfig {
    MISSING_DEPENDENCIES: string;
    KV_CONSISTENCY: string;
    MODEL_LOADING: string;
    INVALID_SYMBOL: string;
    TIMEOUT: string;
    RATE_LIMIT: string;
}
export interface SystemConfig {
    TIMEOUTS: TimeoutConfig;
    RETRY_COUNTS: RetryConfig;
    CRON_SCHEDULES: CronSchedules;
    TRADING: TradingConfig;
    MARKET_DATA: MarketDataConfig;
    AI_MODELS: AIModelsConfig;
    KV_STORAGE: KVStorageConfig;
    FACEBOOK: FacebookConfig;
    LOGGING: LoggingConfig;
    PERFORMANCE: PerformanceConfig;
    ENDPOINTS: EndpointsConfig;
    BUSINESS_KPI: BusinessKPIConfig;
    HANDLERS: HandlersConfig;
    ANALYSIS: AnalysisConfig;
    UI: UIConfig;
    ERROR_MESSAGES: ErrorMessagesConfig;
}
export declare const CONFIG: SystemConfig;
/**
 * Get cron schedule configuration by trigger mode
 */
export declare function getCronConfig(triggerMode: string): CronScheduleItem | null;
/**
 * Get timeout for specific operation type
 */
export declare function getTimeout(operationType: string): number;
/**
 * Get retry count for specific operation type
 */
export declare function getRetryCount(operationType: string): number;
/**
 * Validate trading symbol
 */
export declare function isValidSymbol(symbol: string): boolean;
/**
 * Get environment-aware configuration
 */
export declare function getEnvConfig(env: CloudflareEnvironment): SystemConfig;
/**
 * API environment validation and key helpers
 */
export declare function validateAPIEnvironment(env: CloudflareEnvironment): void;
export declare function getFredApiKeys(env: CloudflareEnvironment): string[];
/**
 * Validate API key and check if real API integration is available
 */
export declare function isRealAPIAvailable(env: CloudflareEnvironment): boolean;
/**
 * Get API configuration with proper validation
 */
export declare function getAPIConfiguration(env: CloudflareEnvironment): {
    fred: {
        apiKey: string;
        baseUrl: string;
        rateLimitDelay: number;
        maxRetries: number;
        cacheEnabled: boolean;
        isRealData: boolean;
    };
    yahooFinance: {
        baseUrl: string;
        rateLimit: number;
        symbols: string[];
        vixSymbol: string;
    };
    refreshIntervals: {
        MARKET_HOURS: number;
        AFTER_HOURS: number;
        WEEKEND: number;
        FRED_ECONOMIC_DATA: number;
        MARKET_STRUCTURE: number;
    };
    isDevelopment: boolean;
    isProduction: boolean;
};
/**
 * Get KV TTL by key type
 */
export declare function getKVTTL(keyType: string): number;
/**
 * Get UI configuration value
 */
export declare function getUIConfig(key: string): string | number | null;
/**
 * Get error message by type
 */
export declare function getErrorMessage(errorType: string): string;
/**
 * Get handler configuration
 */
export declare function getHandlerConfig(): HandlersConfig;
/**
 * Get market data configuration
 */
export declare function getMarketDataConfig(): MarketDataConfig;
/**
 * Get analysis configuration
 */
export declare function getAnalysisConfig(): AnalysisConfig;
/**
 * Check if enhanced features are enabled
 */
export declare function isEnhancedFeaturesEnabled(): boolean;
/**
 * Get storage adapter configuration
 */
export declare function getStorageAdapterConfig(env: CloudflareEnvironment): StorageAdapterConfig;
/**
 * Get metrics configuration with production safety controls
 */
export declare function getMetricsConfig(env: CloudflareEnvironment): MetricsConfig;
//# sourceMappingURL=config.d.ts.map