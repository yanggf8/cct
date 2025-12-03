/**
 * Enhanced Data Access Layer (DAL) - TypeScript
 * Integration of existing DAL with multi-level cache manager
 * Phase 2: Enhanced Caching System - Data Access Improvement Plan
 *
 * This module wraps the existing DAL to provide intelligent caching
 * while maintaining backward compatibility with existing code.
 */
import { type KVReadResult, type KVWriteResult, type AnalysisData, type HighConfidenceSignalsData, type SignalTrackingRecord, type MarketPriceData, type DailyReport } from './dal.js';
import type { CloudflareEnvironment } from '../types.js';
/**
 * Enhanced DAL configuration
 */
export interface EnhancedDALConfig {
    enableCache: boolean;
    environment: string;
    cacheOptions?: {
        l1MaxSize?: number;
        enabled?: boolean;
    };
}
/**
 * Cache-aware read result with additional metadata
 */
export interface EnhancedKVReadResult<T> extends KVReadResult<T> {
    cacheHit: boolean;
    cacheSource: 'l1' | 'l2' | 'none';
    responseTime: number;
}
/**
 * Cache-aware write result with additional metadata
 */
export interface EnhancedKVWriteResult extends KVWriteResult {
    cacheInvalidated: boolean;
    responseTime: number;
}
/**
 * Enhanced Data Access Layer with integrated DO caching
 */
export declare class EnhancedDataAccessLayer {
    private dal;
    private cacheManager;
    private config;
    private enabled;
    constructor(env: CloudflareEnvironment, config: EnhancedDALConfig);
    /**
     * Measure operation execution time
     */
    private measureTime;
    /**
     * Generic cached read operation
     */
    private cachedRead;
    /**
     * Generic cached write operation with cache invalidation
     */
    private cachedWrite;
    /**
     * Read analysis data with caching
     */
    getAnalysis(date: string): Promise<EnhancedKVReadResult<AnalysisData>>;
    /**
     * Store analysis data with cache invalidation
     */
    storeAnalysis(date: string, data: AnalysisData, options?: any): Promise<EnhancedKVWriteResult>;
    /**
     * Get manual analysis with caching
     */
    getManualAnalysis(timestamp: number): Promise<EnhancedKVReadResult<AnalysisData>>;
    /**
     * Store manual analysis with cache invalidation
     */
    storeManualAnalysis(timestamp: number, data: AnalysisData): Promise<EnhancedKVWriteResult>;
    /**
     * Get high-confidence signals with caching
     */
    getHighConfidenceSignals(date: Date | string): Promise<EnhancedKVReadResult<HighConfidenceSignalsData>>;
    /**
     * Store high-confidence signals with cache invalidation
     */
    storeHighConfidenceSignals(date: Date | string, signals: any[]): Promise<EnhancedKVWriteResult>;
    /**
     * Get signal tracking with caching
     */
    getSignalTracking(date: Date | string): Promise<EnhancedKVReadResult<SignalTrackingRecord>>;
    /**
     * Update signal tracking with cache invalidation
     */
    updateSignalTracking(signalId: string, trackingData: any, date: Date | string): Promise<EnhancedKVWriteResult>;
    /**
     * Get market prices with caching
     */
    getMarketPrices(symbol: string): Promise<EnhancedKVReadResult<MarketPriceData>>;
    /**
     * Store market prices with cache invalidation
     */
    storeMarketPrices(symbol: string, priceData: any): Promise<EnhancedKVWriteResult>;
    /**
     * Get daily report with caching
     */
    getDailyReport(reportType: 'pre-market' | 'intraday' | 'end-of-day', date: Date | string): Promise<EnhancedKVReadResult<DailyReport>>;
    /**
     * Store daily report with cache invalidation
     */
    storeDailyReport(reportType: 'pre-market' | 'intraday' | 'end-of-day', date: Date | string, reportData: any): Promise<EnhancedKVWriteResult>;
    /**
     * Get sector data with caching
     */
    getSectorData(symbol: string): Promise<EnhancedKVReadResult<any>>;
    /**
     * Store sector data with cache invalidation
     */
    storeSectorData(symbol: string, sectorData: any, ttl?: number): Promise<EnhancedKVWriteResult>;
    /**
     * Get market drivers data with caching
     */
    getMarketDriversData(type: string): Promise<EnhancedKVReadResult<any>>;
    /**
     * Store market drivers data with cache invalidation
     */
    storeMarketDriversData(type: string, data: any, ttl?: number): Promise<EnhancedKVWriteResult>;
    /**
     * Get API response with caching
     */
    getApiResponse(endpoint: string, params?: string): Promise<EnhancedKVReadResult<any>>;
    /**
     * Store API response with cache invalidation
     */
    storeApiResponse(endpoint: string, response: any, params?: string, ttl?: number): Promise<EnhancedKVWriteResult>;
    /**
     * Generic read operation with caching
     */
    read<T = any>(key: string): Promise<EnhancedKVReadResult<T>>;
    /**
     * Generic write operation with cache invalidation
     */
    write(key: string, data: any, options?: any): Promise<EnhancedKVWriteResult>;
    /**
     * List keys (no caching for this operation)
     */
    listKeys(prefix: string, limit?: number): Promise<{
        keys: string[];
        cursor?: string;
    }>;
    /**
     * Delete key with cache invalidation
     */
    deleteKey(key: string): Promise<boolean>;
    /**
     * Clear cache for specific namespace or all cache
     */
    clearCache(namespace?: string): Promise<void>;
    /**
     * Get cache statistics
     */
    getCacheStats(): any;
    /**
     * Get cache health status
     */
    getCacheHealthStatus(): any;
    /**
     * Get comprehensive performance statistics
     */
    getPerformanceStats(): {
        dal: any;
        cache: any;
        cacheHealth: any;
        enabled: boolean;
    };
    /**
     * Cleanup expired cache entries
     */
    cleanup(): Promise<void>;
    /**
     * Enable/disable caching
     */
    setCacheEnabled(enabled: boolean): void;
    /**
     * Reset cache statistics
     */
    resetCacheStats(): void;
}
/**
 * Factory function to create enhanced DAL instance
 */
export declare function createEnhancedDAL(env: CloudflareEnvironment, config?: Partial<EnhancedDALConfig>): EnhancedDataAccessLayer;
export default EnhancedDataAccessLayer;
//# sourceMappingURL=enhanced-dal.d.ts.map