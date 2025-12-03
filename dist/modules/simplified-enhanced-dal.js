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
import { KVKeyFactory, KeyTypes, KeyHelpers } from './kv-key-factory.js';
import { createLogger } from './logging.js';
import { createCacheInstance } from './dual-cache-do.js';
import { TTL_CONFIG } from './dal.js';
const logger = createLogger('simplified-dal');
/**
 * Simplified Enhanced DAL - DAC Pattern Implementation
 *
 * Key principles:
 * 1. Direct namespace operations (no complex abstraction)
 * 2. Built-in cache management
 * 3. Simple, consistent interface
 * 4. Production-ready with comprehensive error handling
 */
export class SimplifiedEnhancedDAL {
    constructor(env, config) {
        // Cache statistics
        this.stats = {
            hits: 0,
            misses: 0,
            operations: 0,
            totalResponseTime: 0
        };
        this.env = env;
        this.config = {
            enableCache: config.enableCache,
            environment: config.environment,
            defaultTTL: config.defaultTTL || 3600, // 1 hour default
            maxRetries: config.maxRetries || 3
        };
        this.cache = new Map();
        // Initialize DO cache (persistent in-memory cache)
        if (config.enableCache) {
            this.doCacheManager = createCacheInstance(env, true);
            if (this.doCacheManager) {
                logger.info('Simplified Enhanced DAL: Using Durable Objects cache');
            }
            else {
                logger.info('Simplified Enhanced DAL: Cache disabled (DO binding not available)');
            }
        }
        else {
            this.doCacheManager = null;
            logger.info('Simplified Enhanced DAL: Cache disabled by configuration');
        }
        logger.info('Simplified Enhanced DAL initialized', {
            cacheEnabled: this.config.enableCache,
            environment: this.config.environment,
            defaultTTL: this.config.defaultTTL,
            hasDOCache: !!this.doCacheManager
        });
    }
    /**
     * Measure operation performance
     */
    async measureOperation(operation) {
        const start = Date.now();
        const result = await operation();
        const time = Date.now() - start;
        this.stats.operations++;
        this.stats.totalResponseTime += time;
        return { result, time };
    }
    /**
     * Check cache with TTL validation
     */
    checkCache(key) {
        if (!this.config.enableCache)
            return null;
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        const now = Date.now();
        const age = now - entry.timestamp;
        if (age > entry.ttl * 1000) {
            this.cache.delete(key);
            return null;
        }
        this.stats.hits++;
        return { data: entry.data, source: 'l1' };
    }
    /**
     * Store in cache with TTL
     */
    setCache(key, data, ttl = this.config.defaultTTL) {
        if (!this.config.enableCache)
            return;
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
        // Cleanup old entries if cache gets too large
        if (this.cache.size > 1000) {
            this.cleanupCache();
        }
    }
    /**
     * Cleanup expired cache entries
     */
    cleanupCache() {
        const now = Date.now();
        const entries = Array.from(this.cache.entries());
        for (const [key, entry] of entries) {
            const age = now - entry.timestamp;
            if (age > entry.ttl * 1000) {
                this.cache.delete(key);
            }
        }
        // If still too large, remove oldest entries
        if (this.cache.size > 500) {
            const sorted = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toRemove = sorted.slice(0, this.cache.size - 500);
            for (const [key] of toRemove) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Retry helper with exponential backoff
     */
    async retry(operation, context) {
        const maxRetries = this.config.maxRetries || 3;
        const baseDelay = 1000;
        const maxDelay = 10000;
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (attempt < maxRetries - 1) {
                    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
                    logger.warn(`${context} failed, retrying in ${delay}ms`, {
                        attempt: attempt + 1,
                        maxRetries,
                        error: error.message
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        logger.error(`${context} failed after ${maxRetries} attempts`, {
            error: lastError?.message
        });
        throw lastError;
    }
    /**
     * Generic KV get operation with cache
     */
    async get(key, ttl) {
        const { result, time } = await this.measureOperation(async () => {
            // Try DO cache first (persistent in-memory cache)
            if (this.doCacheManager && this.config.enableCache) {
                try {
                    const cachedData = await this.doCacheManager.get(key, {
                        ttl: ttl || this.config.defaultTTL,
                        namespace: 'SIMPLIFIED_DAL'
                    });
                    if (cachedData !== null) {
                        this.stats.hits++;
                        return {
                            success: true,
                            data: cachedData,
                            cached: true,
                            cacheSource: 'l1',
                            error: undefined
                        };
                    }
                }
                catch (error) {
                    logger.warn('DO cache read failed, falling back to basic cache:', error);
                }
            }
            // Check basic cache first
            const cached = this.checkCache(key);
            if (cached) {
                return {
                    success: true,
                    data: cached.data,
                    cached: true,
                    cacheSource: cached.source,
                    error: undefined
                };
            }
            this.stats.misses++;
            // Fetch from KV
            try {
                const data = await this.retry(() => this.env.MARKET_ANALYSIS_CACHE.get(key, 'json'), `KV get ${key}`);
                if (data !== null && data !== undefined) {
                    // Cache the result
                    this.setCache(key, data, ttl);
                    return {
                        success: true,
                        data: data,
                        cached: false,
                        cacheSource: 'kv',
                        error: undefined
                    };
                }
                return {
                    success: false,
                    cached: false,
                    error: 'Data not found'
                };
            }
            catch (error) {
                return {
                    success: false,
                    cached: false,
                    error: (error instanceof Error ? error.message : String(error))
                };
            }
        });
        return {
            ...result,
            responseTime: time,
            timestamp: new Date().toISOString()
        };
    }
    /**
     * Generic KV put operation with cache invalidation
     */
    async put(key, data, options) {
        const { result, time } = await this.measureOperation(async () => {
            try {
                const writeOptions = options || { expirationTtl: this.config.defaultTTL };
                // Try DO cache first for write operations
                if (this.doCacheManager && this.config.enableCache) {
                    try {
                        await this.doCacheManager.set(key, data, {
                            ttl: writeOptions.expirationTtl || this.config.defaultTTL,
                            namespace: 'SIMPLIFIED_DAL'
                        });
                        // Invalidate basic cache entry
                        this.cache.delete(key);
                        return {
                            success: true,
                            cached: true,
                            error: undefined
                        };
                    }
                    catch (error) {
                        logger.warn('DO cache write failed, falling back to standard KV:', error);
                    }
                }
                // Fallback to standard KV write
                await this.retry(() => this.env.MARKET_ANALYSIS_CACHE.put(key, JSON.stringify(data), writeOptions), `KV put ${key}`);
                // Invalidate cache entry
                this.cache.delete(key);
                return {
                    success: true,
                    cached: false,
                    error: undefined
                };
            }
            catch (error) {
                return {
                    success: false,
                    cached: false,
                    error: (error instanceof Error ? error.message : String(error))
                };
            }
        });
        return {
            ...result,
            responseTime: time,
            timestamp: new Date().toISOString()
        };
    }
    /**
     * Generic KV delete operation
     */
    async delete(key) {
        try {
            await this.retry(() => this.env.MARKET_ANALYSIS_CACHE.delete(key), `KV delete ${key}`);
            // Remove from cache
            this.cache.delete(key);
            return { success: true };
        }
        catch (error) {
            logger.error('Delete operation failed', { key, error: (error instanceof Error ? error.message : String(error)) });
            return { success: false, error: error.message };
        }
    }
    /**
     * Generic KV list operation
     */
    async list(prefix, limit) {
        try {
            const result = await this.retry(() => this.env.MARKET_ANALYSIS_CACHE.list({ prefix, limit }), `KV list ${prefix}`);
            return {
                keys: result.keys.map((k) => k.name),
                cursor: result.cursor
            };
        }
        catch (error) {
            logger.error('List operation failed', { prefix, error: (error instanceof Error ? error.message : String(error)) });
            return { keys: [] };
        }
    }
    // ============================================================================
    // ANALYSIS OPERATIONS
    // ============================================================================
    /**
     * Get analysis data for date
     */
    async getAnalysis(date) {
        const key = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date });
        const ttl = KeyHelpers.getKVOptions(KeyTypes.ANALYSIS).expirationTtl;
        logger.debug('Getting analysis data', { key, date });
        return await this.get(key, ttl);
    }
    /**
     * Store analysis data
     */
    async storeAnalysis(date, data, options) {
        const key = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date });
        const kvOptions = options || KeyHelpers.getKVOptions(KeyTypes.ANALYSIS);
        logger.info('Storing analysis data', {
            key,
            date,
            symbolsCount: data.symbols_analyzed?.length || 0
        });
        return await this.put(key, data, kvOptions);
    }
    /**
     * Get manual analysis
     */
    async getManualAnalysis(timestamp) {
        const key = KVKeyFactory.generateKey(KeyTypes.MANUAL_ANALYSIS, { timestamp });
        const ttl = KeyHelpers.getKVOptions(KeyTypes.MANUAL_ANALYSIS).expirationTtl;
        return await this.get(key, ttl);
    }
    /**
     * Store manual analysis
     */
    async storeManualAnalysis(timestamp, data) {
        const key = KVKeyFactory.generateKey(KeyTypes.MANUAL_ANALYSIS, { timestamp });
        const options = KeyHelpers.getKVOptions(KeyTypes.MANUAL_ANALYSIS);
        const enhancedData = {
            ...data,
            analysis_type: 'manual_on_demand',
            generated_at: new Date().toISOString()
        };
        return await this.put(key, enhancedData, options);
    }
    // ============================================================================
    // SIGNAL TRACKING OPERATIONS
    // ============================================================================
    /**
     * Get high-confidence signals
     */
    async getHighConfidenceSignals(date) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        const key = `high_confidence_signals_${dateStr}`;
        return await this.get(key, TTL_CONFIG.SIGNAL_DATA);
    }
    /**
     * Store high-confidence signals
     */
    async storeHighConfidenceSignals(date, signals) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        const key = `high_confidence_signals_${dateStr}`;
        const signalsData = {
            date: dateStr,
            signals,
            metadata: {
                totalSignals: signals.length,
                highConfidenceSignals: signals.filter((s) => s.confidence >= 80).length,
                averageConfidence: signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length,
                bullishSignals: signals.filter((s) => s.prediction === 'up').length,
                bearishSignals: signals.filter((s) => s.prediction === 'down').length,
                neutralSignals: signals.filter((s) => s.prediction === 'neutral').length,
                generatedAt: new Date().toISOString(),
                symbols: signals.map((s) => s.symbol)
            }
        };
        logger.info('Storing high-confidence signals', {
            date: dateStr,
            signalCount: signals.length,
            highConfidenceCount: signalsData.metadata.highConfidenceSignals
        });
        return await this.put(key, signalsData, { expirationTtl: TTL_CONFIG.SIGNAL_DATA });
    }
    /**
     * Get signal tracking data
     */
    async getSignalTracking(date) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        const key = `signal_tracking_${dateStr}`;
        return await this.get(key, TTL_CONFIG.SIGNAL_DATA);
    }
    /**
     * Update signal tracking
     */
    async updateSignalTracking(signalId, trackingData, date) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        const key = `signal_tracking_${dateStr}`;
        // Get existing data
        const existing = await this.getSignalTracking(date);
        let trackingRecord;
        if (existing.success && existing.data) {
            trackingRecord = existing.data;
        }
        else {
            trackingRecord = {
                date: dateStr,
                signals: [],
                lastUpdated: new Date().toISOString()
            };
        }
        // Update signal
        const signalIndex = trackingRecord.signals.findIndex(s => s.id === signalId);
        if (signalIndex >= 0) {
            trackingRecord.signals[signalIndex] = {
                ...trackingRecord.signals[signalIndex],
                ...trackingData,
                lastUpdated: new Date().toISOString()
            };
        }
        else {
            trackingRecord.signals.push({
                id: signalId,
                ...trackingData,
                createdAt: new Date().toISOString()
            });
        }
        trackingRecord.lastUpdated = new Date().toISOString();
        return await this.put(key, trackingRecord, { expirationTtl: TTL_CONFIG.SIGNAL_DATA });
    }
    // ============================================================================
    // MARKET DATA OPERATIONS
    // ============================================================================
    /**
     * Get market prices
     */
    async getMarketPrices(symbol) {
        const key = `market_prices_${symbol}`;
        return await this.get(key, TTL_CONFIG.MARKET_PRICES);
    }
    /**
     * Store market prices
     */
    async storeMarketPrices(symbol, priceData) {
        const key = `market_prices_${symbol}`;
        const marketData = {
            symbol,
            currentPrice: priceData.currentPrice,
            timestamp: new Date().toISOString(),
            priceHistory: priceData.priceHistory || [],
            volume: priceData.volume,
            change: priceData.change,
            changePercent: priceData.changePercent
        };
        return await this.put(key, marketData, { expirationTtl: TTL_CONFIG.MARKET_PRICES });
    }
    // ============================================================================
    // REPORT OPERATIONS
    // ============================================================================
    /**
     * Get daily report
     */
    async getDailyReport(reportType, date) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        const key = `${reportType}_report_${dateStr}`;
        return await this.get(key, TTL_CONFIG.DAILY_REPORTS);
    }
    /**
     * Store daily report
     */
    async storeDailyReport(reportType, date, reportData) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        const key = `${reportType}_report_${dateStr}`;
        const enhancedReportData = {
            ...reportData,
            metadata: {
                reportType,
                date: dateStr,
                generatedAt: new Date().toISOString(),
                version: '1.0'
            }
        };
        return await this.put(key, enhancedReportData, { expirationTtl: TTL_CONFIG.DAILY_REPORTS });
    }
    // ============================================================================
    // UTILITY OPERATIONS
    // ============================================================================
    /**
     * Generic read operation
     */
    async read(key) {
        return await this.get(key);
    }
    /**
     * Generic write operation
     */
    async write(key, data, options) {
        return await this.put(key, data, options);
    }
    /**
     * List keys with prefix
     */
    async listKeys(prefix, limit) {
        return await this.list(prefix, limit);
    }
    /**
     * Delete key
     */
    async deleteKey(key) {
        return await this.delete(key);
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0, operations: 0, totalResponseTime: 0 };
        logger.info('Cache cleared');
    }
    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        const totalCacheRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalCacheRequests > 0 ? this.stats.hits / totalCacheRequests : 0;
        const avgResponseTime = this.stats.operations > 0 ? this.stats.totalResponseTime / this.stats.operations : 0;
        return {
            cache: {
                hits: this.stats.hits,
                misses: this.stats.misses,
                hitRate: Math.round(hitRate * 100) / 100
            },
            performance: {
                totalOperations: this.stats.operations,
                averageResponseTime: Math.round(avgResponseTime * 100) / 100,
                cacheSize: this.cache.size
            }
        };
    }
}
/**
 * Factory function
 */
export function createSimplifiedEnhancedDAL(env, config) {
    const defaultConfig = {
        enableCache: true,
        environment: env.ENVIRONMENT || 'development',
        defaultTTL: 3600,
        maxRetries: 3
    };
    const finalConfig = { ...defaultConfig, ...config };
    return new SimplifiedEnhancedDAL(env, finalConfig);
}
export default SimplifiedEnhancedDAL;
//# sourceMappingURL=simplified-enhanced-dal.js.map