/**
 * Simplified Enhanced Data Access Layer (DAL) - Phase 4 Implementation
 * Data Access Improvement Plan - DAC-Inspired Architecture
 *
 * Simplified implementation following DAC patterns:
 * - Direct namespace-based operations
 * - Integrated cache management (no wrapper complexity)
 * - Clean, simple interface
 * - Production-ready error handling
 */
import type { CloudflareEnvironment } from '../types.js';
import type { AnalysisData, HighConfidenceSignalsData, SignalTrackingRecord, MarketPriceData, DailyReport, KVWriteOptions } from './dal.js';
/**
 * Simplified DAL Configuration
 */
export interface SimplifiedDALConfig {
    enableCache: boolean;
    environment: string;
    defaultTTL?: number;
    maxRetries?: number;
}
/**
 * Cache-aware result with metadata
 */
export interface CacheAwareResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    cached: boolean;
    cacheSource?: 'l1' | 'l2' | 'kv';
    responseTime: number;
    timestamp: string;
}
/**
 * Simplified Enhanced DAL - DAC Pattern Implementation
 *
 * Key principles:
 * 1. Direct namespace operations (no complex abstraction)
 * 2. Built-in cache management
 * 3. Simple, consistent interface
 * 4. Production-ready with comprehensive error handling
 */
export declare class SimplifiedEnhancedDAL {
    private env;
    private config;
    private cache;
    private doCacheManager;
    private stats;
    constructor(env: CloudflareEnvironment, config: SimplifiedDALConfig);
    /**
     * Measure operation performance
     */
    private measureOperation;
    /**
     * Check cache with TTL validation
     */
    private checkCache;
    /**
     * Store in cache with TTL
     */
    private setCache;
    /**
     * Cleanup expired cache entries
     */
    private cleanupCache;
    /**
     * Retry helper with exponential backoff
     */
    private retry;
    /**
     * Generic KV get operation with cache
     */
    private get;
    /**
     * Generic KV put operation with cache invalidation
     */
    private put;
    /**
     * Generic KV delete operation
     */
    private delete;
    /**
     * Generic KV list operation
     */
    private list;
    /**
     * Get analysis data for date
     */
    getAnalysis(date: string): Promise<CacheAwareResult<AnalysisData>>;
    /**
     * Store analysis data
     */
    storeAnalysis(date: string, data: AnalysisData, options?: KVWriteOptions): Promise<CacheAwareResult<void>>;
    /**
     * Get manual analysis
     */
    getManualAnalysis(timestamp: number): Promise<CacheAwareResult<AnalysisData>>;
    /**
     * Store manual analysis
     */
    storeManualAnalysis(timestamp: number, data: AnalysisData): Promise<CacheAwareResult<void>>;
    /**
     * Get high-confidence signals
     */
    getHighConfidenceSignals(date: Date | string): Promise<CacheAwareResult<HighConfidenceSignalsData>>;
    /**
     * Store high-confidence signals
     */
    storeHighConfidenceSignals(date: Date | string, signals: any[]): Promise<CacheAwareResult<void>>;
    /**
     * Get signal tracking data
     */
    getSignalTracking(date: Date | string): Promise<CacheAwareResult<SignalTrackingRecord>>;
    /**
     * Update signal tracking
     */
    updateSignalTracking(signalId: string, trackingData: any, date: Date | string): Promise<CacheAwareResult<void>>;
    /**
     * Get market prices
     */
    getMarketPrices(symbol: string): Promise<CacheAwareResult<MarketPriceData>>;
    /**
     * Store market prices
     */
    storeMarketPrices(symbol: string, priceData: any): Promise<CacheAwareResult<void>>;
    /**
     * Get daily report
     */
    getDailyReport(reportType: 'pre-market' | 'intraday' | 'end-of-day', date: Date | string): Promise<CacheAwareResult<DailyReport>>;
    /**
     * Store daily report
     */
    storeDailyReport(reportType: 'pre-market' | 'intraday' | 'end-of-day', date: Date | string, reportData: any): Promise<CacheAwareResult<void>>;
    /**
     * Generic read operation
     */
    read<T = any>(key: string): Promise<CacheAwareResult<T>>;
    /**
     * Generic write operation
     */
    write(key: string, data: any, options?: KVWriteOptions): Promise<CacheAwareResult<void>>;
    /**
     * List keys with prefix
     */
    listKeys(prefix: string, limit?: number): Promise<{
        keys: string[];
        cursor?: string;
    }>;
    /**
     * Delete key
     */
    deleteKey(key: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Get performance statistics
     */
    getPerformanceStats(): {
        cache: {
            hits: number;
            misses: number;
            hitRate: number;
        };
        performance: {
            totalOperations: number;
            averageResponseTime: number;
            cacheSize: number;
        };
    };
}
/**
 * Factory function
 */
export declare function createSimplifiedEnhancedDAL(env: CloudflareEnvironment, config?: Partial<SimplifiedDALConfig>): SimplifiedEnhancedDAL;
export default SimplifiedEnhancedDAL;
//# sourceMappingURL=simplified-enhanced-dal.d.ts.map