/**
 * Enhanced Batch Operations Module
 * Optimizes multi-symbol requests with intelligent batching, caching, and deduplication
 * Provides 50-70% reduction in API calls and KV operations for batch requests
 */
import { requestDeduplicator } from './request-deduplication.js';
import { createLogger } from './logging.js';
import { createCacheInstance } from './dual-cache-do.js';
const logger = createLogger('enhanced-batch-operations');
/**
 * Enhanced batch operations manager with DO cache
 */
export class EnhancedBatchOperations {
    constructor(config = {}) {
        this.cache = new Map();
        this.config = {
            maxBatchSize: 10,
            batchTimeoutMs: 30000, // 30 seconds
            enableDeduplication: true,
            enableCache: true,
            cacheTTL: 300, // 5 minutes
            enableMetrics: true,
            concurrency: 5,
            ...config
        };
        logger.info('Enhanced batch operations initialized', this.config);
    }
    static getInstance(config) {
        if (!EnhancedBatchOperations.instance) {
            EnhancedBatchOperations.instance = new EnhancedBatchOperations(config);
        }
        return EnhancedBatchOperations.instance;
    }
    /**
     * Execute batch operation with optimization
     */
    async executeBatch(env, items, options) {
        const startTime = Date.now();
        const batchSize = options?.batchSize || this.config.maxBatchSize;
        const enableCache = options?.enableCache !== false && this.config.enableCache;
        // Check batch cache first
        if (enableCache && options?.cacheKey) {
            const cachedResult = this.getBatchCache(options.cacheKey);
            if (cachedResult) {
                logger.debug('Batch cache hit', { cacheKey: options.cacheKey, itemCount: items.length });
                const cachedItems = cachedResult.items.map(item => ({
                    key: item.key,
                    success: true,
                    data: item.data,
                    cached: true,
                    responseTime: 0
                }));
                return this.createBatchResult(items, cachedItems, startTime, true);
            }
        }
        // Group items into batches
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize).map(item => item.key));
        }
        // Execute batches with concurrency control
        const allResults = [];
        let cachedItems = 0;
        let deduplicatedItems = 0;
        // Process batches with concurrency limit
        const concurrentBatches = [];
        const maxConcurrent = Math.min(this.config.concurrency, batches.length);
        for (let i = 0; i < maxConcurrent; i++) {
            if (i < batches.length) {
                concurrentBatches.push(this.processBatch(env, items, batches[i], allResults, enableCache, () => {
                    cachedItems++;
                }, () => {
                    deduplicatedItems++;
                }));
            }
        }
        await Promise.all(concurrentBatches);
        // Cache the batch result if enabled
        if (enableCache && options?.cacheKey && allResults.some(r => r.success)) {
            const successfulResults = allResults
                .filter(r => r.success && r.data !== undefined)
                .map(r => ({ key: r.key, data: r.data, timestamp: Date.now() }));
            if (successfulResults.length > 0) {
                this.setBatchCache(options.cacheKey, successfulResults, options?.customTTL || this.config.cacheTTL);
            }
        }
        return this.createBatchResult(items, allResults, startTime, false, cachedItems, deduplicatedItems, batches.length);
    }
    /**
     * Process a single batch
     */
    async processBatch(env, allItems, batchKeys, results, enableCache, onCacheHit, onDeduplicated) {
        const batchItems = allItems.filter(item => batchKeys.includes(item.key));
        const batchPromises = batchItems.map(async (item) => {
            const itemStartTime = Date.now();
            try {
                let data;
                let cached = false;
                let deduplicated = false;
                // Use DO cache manager if available
                if (enableCache && !this.cacheManager) {
                    this.cacheManager = createCacheInstance(env, true);
                    if (this.cacheManager) {
                        logger.info('BATCH_OPERATIONS: Using Durable Objects cache');
                    }
                    else {
                        logger.info('BATCH_OPERATIONS: Cache disabled (DO binding not available)');
                    }
                }
                // Check individual cache first
                if (enableCache && this.cacheManager) {
                    const cachedData = await this.cacheManager.get(item.key, {
                        ttl: this.config.cacheTTL,
                        namespace: 'batch_operations'
                    });
                    if (cachedData) {
                        data = cachedData;
                        cached = true;
                        onCacheHit();
                    }
                }
                // If not cached, use deduplication or execute directly
                if (!cached) {
                    if (this.config.enableDeduplication) {
                        const deduplicationKey = `batch_operation:${item.key}`;
                        // Check if there's already a deduplicated request
                        data = await requestDeduplicator.execute(deduplicationKey, item.operation, {
                            timeoutMs: this.config.batchTimeoutMs,
                            cacheMs: this.config.cacheTTL * 1000,
                            forceRefresh: false
                        });
                        // Check if this was a deduplicated hit
                        const dedupStats = requestDeduplicator.getStats();
                        if (dedupStats.totalRequests > dedupStats.cacheHits) {
                            deduplicated = true;
                            onDeduplicated();
                        }
                    }
                    else {
                        data = await item.operation();
                    }
                    // Cache the result
                    if (enableCache && this.cacheManager && data) {
                        await this.cacheManager.set(item.key, data, {
                            ttl: this.config.cacheTTL,
                            namespace: 'batch_operations'
                        });
                    }
                }
                // Ensure we have data
                if (data === undefined) {
                    throw new Error(`No data returned for item: ${item.key}`);
                }
                const responseTime = Date.now() - itemStartTime;
                results.push({
                    key: item.key,
                    success: true,
                    data,
                    cached,
                    responseTime
                });
            }
            catch (error) {
                const responseTime = Date.now() - itemStartTime;
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({
                    key: item.key,
                    success: false,
                    error: errorMessage,
                    cached: false,
                    responseTime
                });
                logger.warn(`Batch operation failed for ${item.key}`, { error: errorMessage });
            }
        });
        await Promise.allSettled(batchPromises);
    }
    /**
     * Get cached batch result
     */
    getBatchCache(cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (!cached) {
            return null;
        }
        const now = Date.now();
        if (now > cached.expiresAt) {
            this.cache.delete(cacheKey);
            return null;
        }
        return cached;
    }
    /**
     * Cache batch result
     */
    setBatchCache(cacheKey, items, ttlSeconds) {
        const now = Date.now();
        const expiresAt = now + ttlSeconds * 1000;
        const entry = {
            items,
            timestamp: now,
            expiresAt,
            ttl: ttlSeconds,
            batchKey: cacheKey
        };
        this.cache.set(cacheKey, entry);
        this.enforceMaxCacheEntries();
        logger.debug('Batch result cached', { cacheKey, itemCount: items.length, ttl: ttlSeconds });
    }
    /**
     * Enforce maximum cache entries
     */
    enforceMaxCacheEntries() {
        const maxEntries = 100;
        if (this.cache.size <= maxEntries) {
            return;
        }
        // Sort by expiration time and remove oldest entries
        const entries = Array.from(this.cache.entries())
            .sort(([, a], [, b]) => a.expiresAt - b.expiresAt);
        const toRemove = entries.slice(0, entries.length - maxEntries);
        for (const [key] of toRemove) {
            this.cache.delete(key);
        }
    }
    /**
     * Create batch operation result
     */
    createBatchResult(originalItems, results, startTime, fromCache = false, cachedItems = 0, deduplicatedItems = 0, batchesProcessed = 1) {
        const totalTime = Date.now() - startTime;
        const successfulItems = results.filter(r => r.success).length;
        const failedItems = results.filter(r => !r.success).length;
        // Calculate average response time
        const totalResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0);
        const averageResponseTime = results.length > 0 ? totalResponseTime / results.length : 0;
        // Calculate metrics
        const cacheHitRate = results.length > 0 ? (cachedItems / results.length) : 0;
        const deduplicationRate = results.length > 0 ? (deduplicatedItems / results.length) : 0;
        const kvReduction = Math.round((cacheHitRate + deduplicationRate) * 100);
        // Ensure all original items are represented in results
        const finalResults = originalItems.map(item => {
            const result = results.find(r => r.key === item.key);
            if (result) {
                return result;
            }
            // Missing result - create error entry
            return {
                key: item.key,
                success: false,
                error: 'Item not processed',
                cached: false,
                responseTime: 0
            };
        });
        return {
            items: finalResults,
            statistics: {
                totalItems: originalItems.length,
                successfulItems,
                failedItems,
                cachedItems,
                totalTime,
                averageResponseTime: Math.round(averageResponseTime),
                cacheHitRate: Math.round(cacheHitRate * 100),
                deduplicationRate: Math.round(deduplicationRate * 100),
                kvReduction
            },
            performance: {
                batchesProcessed,
                batchSize: Math.ceil(originalItems.length / batchesProcessed),
                concurrency: this.config.concurrency,
                memoryUsage: Math.round(this.estimateMemoryUsage() / 1024) // KB
            }
        };
    }
    /**
     * Estimate memory usage
     */
    estimateMemoryUsage() {
        let totalSize = 0;
        // Cache entries
        for (const [key, entry] of this.cache.entries()) {
            totalSize += key.length * 2; // UTF-16
            totalSize += JSON.stringify(entry.items).length * 2;
            totalSize += 100; // Metadata
        }
        return totalSize;
    }
    /**
     * Get batch cache statistics
     */
    getCacheStats() {
        const now = Date.now();
        const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
            key: key.length > 100 ? key.substring(0, 97) + '...' : key,
            itemCount: entry.items.length,
            age: Math.floor((now - entry.timestamp) / 1000),
            ttl: Math.floor((entry.expiresAt - now) / 1000)
        }));
        return {
            size: this.cache.size,
            entries: entries.slice(0, 50) // Limit to 50 entries
        };
    }
    /**
     * Clear batch cache
     */
    clearCache(pattern) {
        let clearedCount = 0;
        if (pattern) {
            for (const [key] of this.cache.entries()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                    clearedCount++;
                }
            }
        }
        else {
            clearedCount = this.cache.size;
            this.cache.clear();
        }
        logger.info('Batch cache cleared', { pattern, count: clearedCount });
        return clearedCount;
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        logger.info('Batch operations configuration updated', this.config);
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
/**
 * Global batch operations instance
 */
export const batchOperations = EnhancedBatchOperations.getInstance();
/**
 * Helper function to execute optimized batch operations
 */
export async function executeOptimizedBatch(env, items, options) {
    return await batchOperations.executeBatch(env, items, options);
}
export default EnhancedBatchOperations;
//# sourceMappingURL=enhanced-batch-operations.js.map