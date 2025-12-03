import type { KVNamespace, DurableObjectNamespace, R2Bucket, D1Database, MessageBatch, Email, CloudflareEnvironment as CfEnvironment } from './types/cloudflare';
import type { CloudflareAI } from './types/ai-analysis';
export { AppError, EnhancedError, ValidationError, NetworkError, DatabaseError, ExternalAPIError, toAppError, isAppError } from './types/errors';
export { CloudflareAI, GPTInput, GPTOutput, DistilBERTInput, DistilBERTOutput, DualAIAnalysisResult, BatchAnalysisResult, SingleModelAnalysis, isGPTAnalysisResult, isDistilBERTAnalysisResult, isDualAIAnalysisResult } from './types/ai-analysis';
export { KVNamespace, DurableObjectNamespace, DurableObjectState, DurableObjectStorage, DurableObjectId, R2Bucket, D1Database, MessageBatch, ScheduledEvent, Email, Ai, CloudflareEnvironment as CfEnvironment } from './types/cloudflare';
export { ApiResponse as ApiResponseType, ErrorResponse as ErrorResponseType, RequestContext, SymbolsRequest, SymbolRequest, AnalysisApiRequest, createSuccessResponse, createErrorResponse, isErrorResponse, isSuccessResponse } from './types/api';
declare global {
    interface KVNamespace {
    }
    interface DurableObjectNamespace {
    }
    interface DurableObjectState {
    }
    interface DurableObjectStorage {
    }
    interface DurableObjectId {
    }
    interface R2Bucket {
    }
    interface D1Database {
    }
    interface MessageBatch {
    }
    interface ScheduledEvent {
    }
    interface Email {
    }
    interface Ai {
    }
}
/**
 * Core TypeScript Type Definitions for Dual AI Sentiment Analysis System
 *
 * This file contains all shared interfaces and types used across the sentiment analysis system.
 * Created as part of Phase 5 type safety improvements (2025-10-01).
 */
/**
 * Enhanced Cloudflare Worker Environment Interface
 * Replaces all `env: any` usage with properly typed environment bindings
 */
export interface CloudflareEnvironment extends CfEnvironment {
    MARKET_ANALYSIS_CACHE: KVNamespace;
    CACHE_DO_KV?: KVNamespace;
    ANALYSIS_CACHE?: KVNamespace;
    USER_SESSIONS?: KVNamespace;
    RATE_LIMIT?: KVNamespace;
    SYSTEM_CONFIG?: KVNamespace;
    TRADING_MODELS?: R2Bucket;
    TRAINED_MODELS?: R2Bucket;
    DATA_EXPORTS?: R2Bucket;
    USER_FILES?: R2Bucket;
    DATABASE?: D1Database;
    ANALYTICS_DB?: D1Database;
    USER_DB?: D1Database;
    CACHE_DO?: DurableObjectNamespace;
    USER_SESSIONS_DO?: DurableObjectNamespace;
    RATE_LIMIT_DO?: DurableObjectNamespace;
    ANALYTICS_DO?: DurableObjectNamespace;
    AI: CloudflareAI;
    ANALYSIS_QUEUE?: MessageBatch;
    NOTIFICATION_QUEUE?: MessageBatch;
    REPORT_QUEUE?: MessageBatch;
    EMAIL?: Email;
    FMP_API_KEY?: string;
    NEWSAPI_KEY?: string;
    WORKER_API_KEY?: string;
    FRED_API_KEY?: string;
    FRED_API_KEYS?: string;
    OPENAI_API_KEY?: string;
    HUGGINGFACE_API_KEY?: string;
    FACEBOOK_PAGE_TOKEN?: string;
    FACEBOOK_RECIPIENT_ID?: string;
    TWITTER_API_KEY?: string;
    TWITTER_API_SECRET?: string;
    SLACK_WEBHOOK_URL?: string;
    DISCORD_WEBHOOK_URL?: string;
    YAHOO_FINANCE_RATE_LIMIT?: string;
    RATE_LIMIT_WINDOW?: string;
    MARKET_DATA_CACHE_TTL?: string;
    ENVIRONMENT?: string;
    LOG_LEVEL?: string;
    STRUCTURED_LOGGING?: string;
    GPT_MAX_TOKENS?: string;
    GPT_TEMPERATURE?: string;
    ANALYSIS_CONFIDENCE_THRESHOLD?: string;
    TRADING_SYMBOLS?: string;
    SIGNAL_CONFIDENCE_THRESHOLD?: string;
    MAX_POSITION_SIZE?: string;
    RISK_LEVEL?: string;
    FEATURE_FLAG_DO_CACHE?: string;
    FEATURE_FLAG_AI_ENHANCEMENT?: string;
    FEATURE_FLAG_REAL_TIME_ANALYSIS?: string;
    FEATURE_FLAG_SECTOR_ROTATION?: string;
    [key: string]: any;
}
/**
 * Sentiment classification from AI models
 */
export type Sentiment = 'bullish' | 'bearish' | 'neutral';
/**
 * Trading signal recommendation
 */
export type Signal = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | 'AVOID';
/**
 * AI model agreement status
 */
export type AgreementStatus = 'AGREE' | 'PARTIAL_AGREE' | 'DISAGREE';
/**
 * Individual AI model analysis result
 */
export interface ModelAnalysis {
    sentiment: Sentiment;
    confidence: number;
    reasoning?: string;
    articles_analyzed?: number;
}
/**
 * Dual AI model comparison
 */
export interface DualAIComparison {
    agree: AgreementStatus;
    confidence_gap?: number;
    recommendation?: string;
}
/**
 * Complete dual AI signal with both models
 */
export interface DualAISignal {
    symbol: string;
    models: {
        gpt?: ModelAnalysis;
        distilbert?: ModelAnalysis;
    };
    comparison: DualAIComparison;
    final_signal: Signal;
    confidence: number;
    timestamp: string;
}
/**
 * Legacy sentiment layer (for backward compatibility)
 */
export interface SentimentLayer {
    sentiment: Sentiment;
    confidence: number;
    reasoning?: string;
}
/**
 * Analysis result for a single symbol
 */
export interface SymbolAnalysis {
    symbol: string;
    sentiment_layers?: SentimentLayer[];
    models?: {
        gpt?: ModelAnalysis;
        distilbert?: ModelAnalysis;
    };
    comparison?: DualAIComparison;
    final_signal?: Signal;
    confidence: number;
    news_count?: number;
    timestamp: string;
}
/**
 * Complete analysis result for all symbols
 */
export interface AnalysisResult {
    date: string;
    symbols: SymbolAnalysis[];
    summary: {
        total_symbols: number;
        high_confidence_count: number;
        bullish_count: number;
        bearish_count: number;
        neutral_count: number;
        system_status: string;
    };
    metadata: {
        analysis_version: string;
        execution_time_ms?: number;
        timestamp: string;
    };
}
/**
 * Market data structure
 */
export interface MarketData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
}
/**
 * Enhanced signal from enhanced feature analysis
 */
export interface EnhancedSignal {
    signal: Signal;
    confidence: number;
    feature_contribution: {
        [key: string]: number;
    };
    sentiment?: Sentiment;
    reasoning?: string;
}
/**
 * System performance metrics
 */
export interface SystemPerformance {
    accuracy: number;
    avg_confidence: number;
    feature_coverage: number;
}
/**
 * Methodology information
 */
export interface Methodology {
    neural_networks: string;
    technical_features: string;
    sentiment_analysis: string;
}
/**
 * Enhanced feature analysis result
 */
export interface EnhancedFeatureAnalysisResult {
    timestamp: string;
    analysis_type: string;
    feature_count: number;
    symbols_analyzed: string[];
    trading_signals: {
        [symbol: string]: EnhancedSignal | any;
    };
    system_performance: SystemPerformance;
    methodology: Methodology;
}
/**
 * Alias for backward compatibility
 */
/**
 * Individual signal for tracking
 */
export interface TrackedSignal {
    id: string;
    symbol: string;
    signal: Signal;
    confidence: number;
    sentiment?: Sentiment;
    models?: {
        gpt?: ModelAnalysis;
        distilbert?: ModelAnalysis;
    };
    comparison?: DualAIComparison;
    prediction: string;
    currentPrice: number;
    status: string;
    tracking: {
        morningSignal: {
            prediction: string;
            confidence: number;
            generatedAt: string;
        };
        intradayPerformance: any;
        endOfDayPerformance: any;
        weeklyPerformance: any;
    };
}
/**
 * Signal tracking data structure
 */
export interface SignalTrackingData {
    date: string;
    signals: TrackedSignal[];
    metadata: {
        total_signals: number;
        high_confidence_count: number;
        timestamp: string;
    };
}
/**
 * Signal performance tracking
 */
export interface SignalPerformance {
    symbol: string;
    predicted_signal: Signal;
    actual_performance?: 'correct' | 'wrong' | 'pending';
    confidence: number;
    price_change?: number;
    timestamp: string;
}
/**
 * Supported messaging platforms
 */
export type MessagePlatform = 'facebook' | 'telegram' | 'slack' | 'discord' | 'email' | 'sms' | 'webhook' | 'other';
/**
 * Message delivery status
 */
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'retrying';
/**
 * Message type classification
 */
export type MessageType = 'morning_predictions' | 'midday_update' | 'end_of_day_summary' | 'friday_weekend_report' | 'weekly_accuracy_report' | 'alert' | 'notification' | 'system' | 'other';
/**
 * Message tracking record
 */
export interface MessageTracking {
    tracking_id: string;
    platform: MessagePlatform;
    message_type: MessageType;
    recipient_id: string;
    status: MessageStatus;
    platform_message_id?: string;
    error_message?: string;
    error_count: number;
    created_at: string;
    updated_at: string;
    sent_at?: string;
    delivered_at?: string;
    metadata?: Record<string, any>;
}
/**
 * KV operation result
 */
export interface KVResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    source?: 'cache' | 'kv' | 'error';
}
/**
 * KV read result with typed data
 */
export interface KVReadResult<T> extends KVResult<T> {
    data?: T;
}
/**
 * KV write result
 */
export interface KVWriteResult extends KVResult {
    key?: string;
}
/**
 * KV list result
 */
export interface KVListResult extends KVResult {
    keys?: Array<{
        name: string;
        expiration?: number;
        metadata?: any;
    }>;
    cursor?: string;
    list_complete?: boolean;
}
/**
 * Standard API success response
 */
export interface SuccessResponse<T = any> {
    success: true;
    data?: T;
    message?: string;
    timestamp?: string;
}
/**
 * Standard API error response
 */
export interface ErrorResponse {
    success: false;
    error: string;
    details?: any;
    timestamp?: string;
}
/**
 * API response union type
 */
export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;
/**
 * Service health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
/**
 * Individual service health
 */
export interface ServiceHealth {
    status: HealthStatus;
    message?: string;
    last_check?: string;
}
/**
 * System health response
 */
export interface SystemHealth {
    success: boolean;
    status: HealthStatus;
    version: string;
    services: {
        kv?: ServiceHealth;
        ai?: ServiceHealth;
        r2?: ServiceHealth;
        cron?: ServiceHealth;
    };
    timestamp: string;
}
/**
 * System configuration
 */
export interface SystemConfig {
    tradingSymbols: string[];
    ttl: {
        analysis: number;
        granular: number;
        daily_summary: number;
        status: number;
        report_cache: number;
        metadata: number;
    };
    retry: {
        maxRetries: number;
        initialDelay: number;
        maxDelay: number;
        timeout: number;
    };
    analysis: {
        minNewsArticles: number;
        maxNewsArticles: number;
        confidenceThreshold: number;
        signalConfidenceThreshold: number;
    };
    market: {
        dataCacheTTL: number;
        yahooFinanceRateLimit: number;
        rateLimitWindow: number;
    };
}
/**
 * Cron execution context
 */
export interface CronContext {
    scheduledTime: number;
    cron: string;
}
/**
 * Cron execution result
 */
export interface CronExecutionResult {
    success: boolean;
    cron_type: string;
    execution_id: string;
    execution_time_ms?: number;
    error?: string;
    timestamp: string;
}
/**
 * Type guard helper
 */
export type TypeGuard<T> = (value: any) => value is T;
/**
 * Async function type
 */
export type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;
/**
 * Retry options
 */
export interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    timeout?: number;
    onRetry?: (attempt: number, error: Error) => void;
}
/**
 * Type guard for SignalTrackingData
 */
export declare function isSignalTrackingData(value: unknown): value is SignalTrackingData;
/**
 * Type guard for AnalysisResult
 */
export declare function isAnalysisResult(value: unknown): value is AnalysisResult;
/**
 * Type guard for DualAISignal
 */
export declare function isDualAISignal(value: unknown): value is DualAISignal;
/**
 * Type guard for MessageTracking
 */
export declare function isMessageTracking(value: unknown): value is MessageTracking;
/**
 * Type guard for SymbolAnalysis
 */
export declare function isSymbolAnalysis(value: unknown): value is SymbolAnalysis;
/**
 * Type guard for KVResult
 */
export declare function isKVResult<T>(value: unknown): value is KVResult<T>;
/**
 * Type guard for ApiResponse
 */
export declare function isApiResponse<T>(value: unknown): value is ApiResponse<T>;
/**
 * Type guard for SystemHealth
 */
export declare function isSystemHealth(value: unknown): value is SystemHealth;
/**
 * Sector rotation analysis result
 */
export interface SectorRotationResult {
    timestamp: string;
    analysisDate: string;
    marketConditions: {
        overallTrend: 'bull' | 'bear' | 'neutral';
        volatility: 'low' | 'medium' | 'high';
        riskOn: boolean;
    };
    etfAnalyses: Array<{
        symbol: string;
        name: string;
        sentiment: {
            overall: 'bullish' | 'bearish' | 'neutral';
            confidence: number;
            reasoning: string;
            model: string;
        };
        technicalIndicators: {
            rsi: number;
            macd: number;
            movingAvg50: number;
            movingAvg200: number;
            trend: 'uptrend' | 'downtrend' | 'sideways';
        };
        performanceMetrics: {
            daily: number;
            weekly: number;
            monthly: number;
            ytd: number;
            volatility: number;
        };
        newsSentiment: {
            positiveCount: number;
            negativeCount: number;
            neutralCount: number;
            topHeadlines: string[];
        };
        rotationSignal: {
            strength: 'strong' | 'moderate' | 'weak';
            direction: 'inflow' | 'outflow' | 'neutral';
            reasoning: string;
        };
    }>;
    topSectors: {
        inflow: string[];
        outflow: string[];
    };
    rotationSignals: {
        leadingSector: string;
        laggingSector: string;
        emergingSectors: string[];
        decliningSectors: string[];
    };
    executionMetrics: {
        totalProcessingTime: number;
        averageTimePerETF: number;
        cacheHitRate: number;
        rateLimitAvoided: boolean;
    };
}
/**
 * Signal structure used in reports
 */
export interface ReportSignal {
    sentiment_layers?: SentimentLayer[];
    recommendation?: string;
    [key: string]: any;
}
/**
 * Request body for endpoints that accept symbols array
 */
export interface SymbolsRequestBody {
    symbols?: string[];
    [key: string]: any;
}
/**
 * Primary sentiment result from sentiment layers
 */
export interface PrimarySentimentResult {
    sentiment: string;
    confidence: number;
    reasoning: string;
}
/**
 * Safely extract primary sentiment from sentiment layers
 * @param layers - Optional array of sentiment layers
 * @returns Primary sentiment with defaults if layers are missing or empty
 */
export declare function getPrimarySentiment(layers?: SentimentLayer[]): PrimarySentimentResult;
/**
 * DeepPartial - makes all properties of a type recursively partial
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
/**
 * NonEmptyArray - ensures an array has at least one element
 */
export type NonEmptyArray<T> = [T, ...T[]];
/**
 * SafeGet - safely get nested object property with default value
 */
export declare function safeGet<T>(obj: any, path: string, defaultValue: T): T;
/**
 * AssertNonEmpty - runtime check that array is not empty
 */
export declare function assertNonEmpty<T>(array: T[], message?: string): NonEmptyArray<T>;
/**
 * Apply defaults to partial options object
 */
export declare function applyDefaults<T>(partial: Partial<T>, defaults: T): T;
/**
 * Normalize input to array - handles single item, array, or undefined
 */
export declare function asArray<T>(input: T | T[] | undefined | null): T[];
/**
 * Type guard for non-empty arrays
 */
export declare function isNonEmpty<T>(arr?: T[]): arr is NonEmptyArray<T>;
//# sourceMappingURL=types.d.ts.map