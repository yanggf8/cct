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
import { KVKeyFactory, KeyTypes, KeyHelpers } from './kv-key-factory.js';
import { createLogger } from './logging.js';
const logger = createLogger('dal');
// TTL Configuration (from kv-storage-manager)
export const TTL_CONFIG = {
    SIGNAL_DATA: 90 * 24 * 60 * 60, // 90 days
    DAILY_REPORTS: 7 * 24 * 60 * 60, // 7 days
    WEEKLY_REPORTS: 30 * 24 * 60 * 60, // 30 days
    MARKET_PRICES: 24 * 60 * 60, // 1 day
    INTRADAY_DATA: 3 * 24 * 60 * 60, // 3 days
    CONFIG: null // No expiration
};
export class DataAccessLayer {
    constructor(env, retryConfig) {
        this.maxCacheSize = 100;
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
        this.env = env;
        this.retryConfig = {
            maxRetries: retryConfig?.maxRetries ?? 3,
            baseDelay: retryConfig?.baseDelay ?? 1000,
            maxDelay: retryConfig?.maxDelay ?? 10000,
        };
        this.cache = new Map();
        this.hitCount = 0;
        this.missCount = 0;
    }
    /**
     * Clean up expired cache entries
     */
    cleanupCache() {
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.cacheTTL) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
    }
    /**
     * Evict least recently used entries if cache is full
     */
    evictLRU() {
        if (this.cache.size >= this.maxCacheSize) {
            let oldestKey = '';
            let oldestTime = Date.now();
            let lowestAccess = Infinity;
            this.cache.forEach((entry, key) => {
                if (entry.accessCount < lowestAccess ||
                    (entry.accessCount === lowestAccess && entry.timestamp < oldestTime)) {
                    oldestKey = key;
                    oldestTime = entry.timestamp;
                    lowestAccess = entry.accessCount;
                }
            });
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }
    }
    /**
     * Safe JSON parsing with detailed error handling
     * Separates JSON parse errors from other errors
     */
    safeJsonParse(jsonString, context) {
        try {
            return JSON.parse(jsonString);
        }
        catch (error) {
            logger.error('JSON parsing failed', {
                context,
                error: (error instanceof Error ? error.message : String(error)),
                dataPreview: jsonString.substring(0, 100),
            });
            throw new Error(`JSON parse error in ${context}: ${error.message}`);
        }
    }
    /**
     * Retry helper with exponential backoff
     */
    async retry(operation, operationName) {
        let lastError;
        for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (attempt < this.retryConfig.maxRetries - 1) {
                    const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt), this.retryConfig.maxDelay);
                    logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
                        attempt: attempt + 1,
                        maxRetries: this.retryConfig.maxRetries,
                        error: error.message,
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        logger.error(`${operationName} failed after ${this.retryConfig.maxRetries} attempts`, {
            error: lastError?.message,
            stack: lastError?.stack,
        });
        throw lastError;
    }
    /**
     * Generic read helper with cache support
     * Reduces code duplication across all read methods
     */
    async _genericRead(key, operationName, useCache = false) {
        // Check cache first if enabled
        if (useCache && this.cache.has(key)) {
            const entry = this.cache.get(key);
            entry.accessCount++;
            this.hitCount++;
            logger.debug(`Cache hit for ${operationName}`, { key });
            return {
                success: true,
                data: entry.data,
                key,
                source: 'cache',
            };
        }
        try {
            const data = await this.retry(() => this.env.MARKET_ANALYSIS_CACHE.get(key), operationName);
            if (data) {
                const parsed = this.safeJsonParse(data, operationName);
                // Update cache if enabled
                if (useCache) {
                    this.cleanupCache();
                    this.evictLRU();
                    this.cache.set(key, {
                        data: parsed,
                        timestamp: Date.now(),
                        accessCount: 1
                    });
                    this.missCount++;
                }
                logger.debug(`${operationName} successful`, { key });
                return {
                    success: true,
                    data: parsed,
                    key,
                    source: 'kv',
                };
            }
            if (useCache) {
                this.missCount++;
            }
            logger.warn(`${operationName}: Data not found`, { key });
            return {
                success: false,
                key,
                source: 'error',
                error: 'Data not found',
            };
        }
        catch (error) {
            if (useCache) {
                this.missCount++;
            }
            logger.error(`${operationName} failed`, {
                key,
                error: error.message,
                stack: error.stack,
            });
            return {
                success: false,
                key,
                source: 'error',
                error: error.message,
            };
        }
    }
    /**
     * Generic write helper with automatic TTL management
     * Reduces code duplication across all write methods
     */
    async _genericWrite(key, data, operationName, options) {
        try {
            const serialized = JSON.stringify(data);
            await this.retry(() => this.env.MARKET_ANALYSIS_CACHE.put(key, serialized, options), operationName);
            // Invalidate cache on write
            if (this.cache.has(key)) {
                this.cache.delete(key);
            }
            logger.info(`${operationName} successful`, {
                key,
                ttl: options?.expirationTtl,
                dataSize: serialized.length,
            });
            return {
                success: true,
                key,
                ttl: options?.expirationTtl,
            };
        }
        catch (error) {
            logger.error(`${operationName} failed`, {
                key,
                error: error.message,
                stack: error.stack,
            });
            return {
                success: false,
                key,
                error: error.message,
            };
        }
    }
    /**
     * Read analysis data for a specific date
     */
    async getAnalysis(date) {
        const key = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date });
        logger.info('Reading analysis from KV', { key, date });
        const result = await this._genericRead(key, 'getAnalysis', false);
        if (result.success && result.data) {
            logger.info('Analysis retrieved successfully', {
                key,
                symbolsCount: result.data.symbols_analyzed?.length ?? 0,
            });
        }
        return result;
    }
    /**
     * Write analysis data for a specific date
     */
    async storeAnalysis(date, data, options) {
        const key = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date });
        logger.info('Writing analysis to KV', {
            key,
            date,
            symbolsCount: data.symbols_analyzed?.length ?? 0,
        });
        const kvOptions = options ?? KeyHelpers.getKVOptions(KeyTypes.ANALYSIS);
        return await this._genericWrite(key, data, 'storeAnalysis', kvOptions);
    }
    /**
     * Get manual/on-demand analysis by timestamp
     */
    async getManualAnalysis(timestamp) {
        const key = KVKeyFactory.generateKey(KeyTypes.MANUAL_ANALYSIS, { timestamp });
        logger.info('Reading manual analysis from KV', { key, timestamp });
        return await this._genericRead(key, 'getManualAnalysis', false);
    }
    /**
     * Store manual/on-demand analysis
     */
    async storeManualAnalysis(timestamp, data) {
        const key = KVKeyFactory.generateKey(KeyTypes.MANUAL_ANALYSIS, { timestamp });
        logger.info('Writing manual analysis to KV', { key, timestamp });
        const enhancedData = {
            ...data,
            analysis_type: 'manual_on_demand',
            generated_at: new Date().toISOString(),
        };
        const kvOptions = KeyHelpers.getKVOptions(KeyTypes.MANUAL_ANALYSIS);
        return await this._genericWrite(key, enhancedData, 'storeManualAnalysis', kvOptions);
    }
    /**
     * List all keys with a given prefix
     */
    async listKeys(prefix, limit) {
        try {
            logger.info('Listing KV keys', { prefix, limit });
            const result = await this.retry(() => this.env.MARKET_ANALYSIS_CACHE.list({ prefix, limit }), 'listKeys');
            const keys = result.keys.map((k) => k.name);
            logger.info('Keys listed successfully', {
                prefix,
                count: keys.length,
                cursor: result.cursor,
            });
            return {
                keys,
                cursor: result.cursor,
            };
        }
        catch (error) {
            logger.error('Failed to list keys', {
                prefix,
                error: (error instanceof Error ? error.message : String(error)),
            });
            return { keys: [] };
        }
    }
    /**
     * Delete a key from KV
     */
    async deleteKey(key) {
        try {
            logger.info('Deleting KV key', { key });
            await this.retry(() => this.env.MARKET_ANALYSIS_CACHE.delete(key), 'deleteKey');
            logger.info('Key deleted successfully', { key });
            return true;
        }
        catch (error) {
            logger.error('Failed to delete key', {
                key,
                error: (error instanceof Error ? error.message : String(error)),
            });
            return false;
        }
    }
    /**
     * Generic read operation for any key type
     */
    async read(key) {
        try {
            logger.info('Reading from KV', { key });
            const data = await this.retry(() => this.env.MARKET_ANALYSIS_CACHE.get(key), 'read');
            if (data) {
                const parsed = this.safeJsonParse(data, 'read');
                return {
                    success: true,
                    data: parsed,
                    key,
                    source: 'kv',
                };
            }
            return {
                success: false,
                key,
                source: 'error',
                error: 'Data not found',
            };
        }
        catch (error) {
            logger.error('Failed to read from KV', {
                key,
                error: (error instanceof Error ? error.message : String(error)),
            });
            return {
                success: false,
                key,
                source: 'error',
                error: error.message,
            };
        }
    }
    /**
     * Generic write operation for any key type
     */
    async write(key, data, options) {
        try {
            logger.info('Writing to KV', { key });
            const writeOptions = options ?? {};
            await this.retry(() => this.env.MARKET_ANALYSIS_CACHE.put(key, JSON.stringify(data), writeOptions), 'write');
            logger.info('Write successful', { key, ttl: options?.expirationTtl });
            return {
                success: true,
                key,
                ttl: options?.expirationTtl,
            };
        }
        catch (error) {
            logger.error('Failed to write to KV', {
                key,
                error: (error instanceof Error ? error.message : String(error)),
            });
            return {
                success: false,
                key,
                error: error.message,
            };
        }
    }
    // ============================================================================
    // Signal Tracking Methods (from kv-storage-manager)
    // ============================================================================
    /**
     * Store high-confidence signals with metadata
     */
    async storeHighConfidenceSignals(date, signals) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        const key = `high_confidence_signals_${dateStr}`;
        const signalsData = {
            date: dateStr,
            signals: signals,
            metadata: {
                totalSignals: signals.length,
                highConfidenceSignals: signals.filter(s => s.confidence >= 80).length,
                averageConfidence: signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length,
                bullishSignals: signals.filter(s => s.prediction === 'up').length,
                bearishSignals: signals.filter(s => s.prediction === 'down').length,
                neutralSignals: signals.filter(s => s.prediction === 'neutral').length,
                generatedAt: new Date().toISOString(),
                symbols: signals.map(s => s.symbol)
            }
        };
        logger.info('Storing high-confidence signals', {
            date: dateStr,
            signalCount: signals.length,
            highConfidenceCount: signalsData.metadata.highConfidenceSignals,
        });
        const result = await this._genericWrite(key, signalsData, 'storeHighConfidenceSignals', { expirationTtl: TTL_CONFIG.SIGNAL_DATA });
        // Update cache on successful write
        if (result.success) {
            this.cache.set(key, {
                data: signalsData,
                timestamp: Date.now(),
                accessCount: 0
            });
        }
        return result;
    }
    /**
     * Get high-confidence signals for a specific date
     */
    async getHighConfidenceSignals(date) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        const key = `high_confidence_signals_${dateStr}`;
        return await this._genericRead(key, 'getHighConfidenceSignals', true);
    }
    /**
     * Update signal tracking data in real-time
     */
    async updateSignalTracking(signalId, trackingData, date) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        const key = `signal_tracking_${dateStr}`;
        const existingResult = await this.getSignalTracking(date);
        let trackingRecord;
        if (existingResult.success && existingResult.data) {
            trackingRecord = existingResult.data;
        }
        else {
            trackingRecord = {
                date: dateStr,
                signals: [],
                lastUpdated: new Date().toISOString()
            };
        }
        // Find and update the signal
        const signalIndex = trackingRecord.signals.findIndex(s => s.id === signalId);
        if (signalIndex >= 0) {
            trackingRecord.signals[signalIndex] = {
                ...trackingRecord.signals[signalIndex],
                ...trackingData,
                lastUpdated: new Date().toISOString()
            };
        }
        else {
            // Add new signal
            trackingRecord.signals.push({
                id: signalId,
                ...trackingData,
                createdAt: new Date().toISOString()
            });
        }
        trackingRecord.lastUpdated = new Date().toISOString();
        logger.debug('Updating signal tracking', { signalId, date: dateStr, status: trackingData.status });
        const result = await this._genericWrite(key, trackingRecord, 'updateSignalTracking', { expirationTtl: TTL_CONFIG.SIGNAL_DATA });
        // Update cache on successful write
        if (result.success) {
            this.cache.set(key, {
                data: trackingRecord,
                timestamp: Date.now(),
                accessCount: 0
            });
        }
        return result;
    }
    /**
     * Get signal tracking data for a date
     */
    async getSignalTracking(date) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        const key = `signal_tracking_${dateStr}`;
        return await this._genericRead(key, 'getSignalTracking', true);
    }
    /**
     * Store market prices for real-time tracking
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
        logger.debug('Storing market prices', {
            symbol,
            currentPrice: priceData.currentPrice,
            changePercent: priceData.changePercent
        });
        const result = await this._genericWrite(key, marketData, 'storeMarketPrices', { expirationTtl: TTL_CONFIG.MARKET_PRICES });
        // Update cache on successful write
        if (result.success) {
            this.cache.set(key, {
                data: marketData,
                timestamp: Date.now(),
                accessCount: 0
            });
        }
        return result;
    }
    /**
     * Get current market prices
     */
    async getMarketPrices(symbol) {
        const key = `market_prices_${symbol}`;
        return await this._genericRead(key, 'getMarketPrices', true);
    }
    /**
     * Store daily report data
     */
    async storeDailyReport(reportType, date, reportData) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        let key;
        switch (reportType) {
            case 'pre-market':
                key = `pre_market_briefing_${dateStr}`;
                break;
            case 'intraday':
                key = `intraday_check_${dateStr}`;
                break;
            case 'end-of-day':
                key = `end_of_day_summary_${dateStr}`;
                break;
            default:
                logger.error('Unknown report type', { reportType });
                return {
                    success: false,
                    key: '',
                    error: 'Unknown report type'
                };
        }
        const enhancedReportData = {
            ...reportData,
            metadata: {
                reportType,
                date: dateStr,
                generatedAt: new Date().toISOString(),
                version: '1.0'
            }
        };
        logger.info('Storing daily report', { reportType, date: dateStr });
        const result = await this._genericWrite(key, enhancedReportData, 'storeDailyReport', { expirationTtl: TTL_CONFIG.DAILY_REPORTS });
        // Update cache on successful write
        if (result.success) {
            this.cache.set(key, {
                data: enhancedReportData,
                timestamp: Date.now(),
                accessCount: 0
            });
        }
        return result;
    }
    /**
     * Get daily report data
     */
    async getDailyReport(reportType, date) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        let key;
        switch (reportType) {
            case 'pre-market':
                key = `pre_market_briefing_${dateStr}`;
                break;
            case 'intraday':
                key = `intraday_check_${dateStr}`;
                break;
            case 'end-of-day':
                key = `end_of_day_summary_${dateStr}`;
                break;
            default:
                logger.error('Unknown report type', { reportType });
                return {
                    success: false,
                    key: '',
                    source: 'error',
                    error: 'Unknown report type'
                };
        }
        return await this._genericRead(key, 'getDailyReport', true);
    }
    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        const totalRequests = this.hitCount + this.missCount;
        const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;
        return {
            cacheHits: this.hitCount,
            cacheMisses: this.missCount,
            totalRequests,
            hitRate: hitRate,
            cacheSize: this.cache.size
        };
    }
    /**
     * Clear cache entries
     */
    clearCache() {
        this.cache.clear();
        this.hitCount = 0;
        this.missCount = 0;
        logger.info('Cleared DAL cache');
    }
}
/**
 * Factory function to create DAL instance
 */
export function createDAL(env, retryConfig) {
    return new DataAccessLayer(env, retryConfig);
}
//# sourceMappingURL=dal.js.map