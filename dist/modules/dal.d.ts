/**
 * Data Access Layer (DAL) - TypeScript
 * Centralized, type-safe KV storage operations with retry logic and error handling
 *
 * Design Goals:
 * - Type safety for all KV operations
 * - Consistent error handling across the application
 * - Automatic retry logic with exponential backoff
 * - KV Key Factory integration
 * - Comprehensive logging
 * - Support for eventual consistency (60s delay awareness)
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Type Definitions
 */
export interface TradingSentimentLayer {
    sentiment: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    reasoning?: string;
    model?: string;
    source?: string;
}
export interface TradingSignal {
    symbol: string;
    sentiment_layers: TradingSentimentLayer[];
    timestamp?: string;
}
export interface AnalysisData {
    test_mode?: boolean;
    test_request_id?: string;
    symbols_analyzed: string[];
    trading_signals: Record<string, TradingSignal>;
    timestamp: string;
    data_source?: string;
    cron_execution_id?: string;
    trigger_mode?: string;
    last_updated?: string;
    analysis_type?: string;
    request_id?: string;
    generated_at?: string;
}
export interface KVWriteOptions {
    expirationTtl?: number;
    expiration?: number;
    metadata?: Record<string, any>;
}
export interface KVReadResult<T> {
    success: boolean;
    data?: T;
    key: string;
    source: 'kv' | 'cache' | 'error';
    error?: string;
}
export interface KVWriteResult {
    success: boolean;
    key: string;
    ttl?: number;
    error?: string;
}
export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
}
export interface HighConfidenceSignal {
    symbol: string;
    prediction: 'up' | 'down' | 'neutral';
    confidence: number;
    reasoning?: string;
    timestamp?: string;
}
export interface HighConfidenceSignalsData {
    date: string;
    signals: HighConfidenceSignal[];
    metadata: {
        totalSignals: number;
        highConfidenceSignals: number;
        averageConfidence: number;
        bullishSignals: number;
        bearishSignals: number;
        neutralSignals: number;
        generatedAt: string;
        symbols: string[];
    };
}
export interface SignalTrackingData {
    id: string;
    status?: string;
    confidence?: number;
    prediction?: string;
    actual?: string;
    accuracy?: number;
    createdAt: string;
    lastUpdated?: string;
    [key: string]: any;
}
export interface SignalTrackingRecord {
    date: string;
    signals: SignalTrackingData[];
    lastUpdated: string;
}
export interface MarketPriceData {
    symbol: string;
    currentPrice: number;
    timestamp: string;
    priceHistory: Array<{
        price: number;
        timestamp: string;
    }>;
    volume?: number;
    change?: number;
    changePercent?: number;
}
export interface ReportMetadata {
    reportType: string;
    date: string;
    generatedAt: string;
    version: string;
}
export interface DailyReport {
    metadata: ReportMetadata;
    [key: string]: any;
}
export declare const TTL_CONFIG: {
    SIGNAL_DATA: number;
    DAILY_REPORTS: number;
    WEEKLY_REPORTS: number;
    MARKET_PRICES: number;
    INTRADAY_DATA: number;
    CONFIG: number | null;
};
export declare class DataAccessLayer {
    private env;
    private retryConfig;
    private cache;
    private hitCount;
    private missCount;
    private readonly maxCacheSize;
    private readonly cacheTTL;
    constructor(env: CloudflareEnvironment, retryConfig?: Partial<RetryConfig>);
    /**
     * Clean up expired cache entries
     */
    private cleanupCache;
    /**
     * Evict least recently used entries if cache is full
     */
    private evictLRU;
    /**
     * Safe JSON parsing with detailed error handling
     * Separates JSON parse errors from other errors
     */
    private safeJsonParse;
    /**
     * Retry helper with exponential backoff
     */
    private retry;
    /**
     * Generic read helper with cache support
     * Reduces code duplication across all read methods
     */
    private _genericRead;
    /**
     * Generic write helper with automatic TTL management
     * Reduces code duplication across all write methods
     */
    private _genericWrite;
    /**
     * Read analysis data for a specific date
     */
    getAnalysis(date: string): Promise<KVReadResult<AnalysisData>>;
    /**
     * Write analysis data for a specific date
     */
    storeAnalysis(date: string, data: AnalysisData, options?: KVWriteOptions): Promise<KVWriteResult>;
    /**
     * Get manual/on-demand analysis by timestamp
     */
    getManualAnalysis(timestamp: number): Promise<KVReadResult<AnalysisData>>;
    /**
     * Store manual/on-demand analysis
     */
    storeManualAnalysis(timestamp: number, data: AnalysisData): Promise<KVWriteResult>;
    /**
     * List all keys with a given prefix
     */
    listKeys(prefix: string, limit?: number): Promise<{
        keys: string[];
        cursor?: string;
    }>;
    /**
     * Delete a key from KV
     */
    deleteKey(key: string): Promise<boolean>;
    /**
     * Generic read operation for any key type
     */
    read<T = any>(key: string): Promise<KVReadResult<T>>;
    /**
     * Generic write operation for any key type
     */
    write(key: string, data: any, options?: KVWriteOptions): Promise<KVWriteResult>;
    /**
     * Store high-confidence signals with metadata
     */
    storeHighConfidenceSignals(date: Date | string, signals: HighConfidenceSignal[]): Promise<KVWriteResult>;
    /**
     * Get high-confidence signals for a specific date
     */
    getHighConfidenceSignals(date: Date | string): Promise<KVReadResult<HighConfidenceSignalsData>>;
    /**
     * Update signal tracking data in real-time
     */
    updateSignalTracking(signalId: string, trackingData: Partial<SignalTrackingData>, date: Date | string): Promise<KVWriteResult>;
    /**
     * Get signal tracking data for a date
     */
    getSignalTracking(date: Date | string): Promise<KVReadResult<SignalTrackingRecord>>;
    /**
     * Store market prices for real-time tracking
     */
    storeMarketPrices(symbol: string, priceData: Omit<MarketPriceData, 'symbol' | 'timestamp'>): Promise<KVWriteResult>;
    /**
     * Get current market prices
     */
    getMarketPrices(symbol: string): Promise<KVReadResult<MarketPriceData>>;
    /**
     * Store daily report data
     */
    storeDailyReport(reportType: 'pre-market' | 'intraday' | 'end-of-day', date: Date | string, reportData: any): Promise<KVWriteResult>;
    /**
     * Get daily report data
     */
    getDailyReport(reportType: 'pre-market' | 'intraday' | 'end-of-day', date: Date | string): Promise<KVReadResult<DailyReport>>;
    /**
     * Get performance statistics
     */
    getPerformanceStats(): {
        cacheHits: number;
        cacheMisses: number;
        totalRequests: number;
        hitRate: number;
        cacheSize: number;
    };
    /**
     * Clear cache entries
     */
    clearCache(): void;
}
/**
 * Factory function to create DAL instance
 */
export declare function createDAL(env: CloudflareEnvironment, retryConfig?: Partial<RetryConfig>): DataAccessLayer;
/**
 * Export types for use in JavaScript files
 */
export type { TradingSentimentLayer as SentimentLayer, TradingSignal as Signal, AnalysisData as Analysis, };
//# sourceMappingURL=dal.d.ts.map