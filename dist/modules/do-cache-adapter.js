// @ts-ignore - Suppressing TypeScript errors
/**
 * Durable Objects Cache Adapter
 * Replaces legacy CacheManager with DO-based implementation
 * Provides backward compatibility while eliminating KV operations
 */
import { DualCacheDO } from './dual-cache-do.js';
import { createLogger } from './logging.js';
const logger = createLogger('do-cache-adapter');
/**
 * DO Cache Adapter - Drop-in replacement for CacheManager
 * Maintains API compatibility while using DO cache internally
 */
export class DOCacheAdapter {
    constructor(env, options) {
        this.doCache = null;
        this.enabled = false;
        if (options?.enabled !== false && env?.CACHE_DO) {
            this.doCache = new DualCacheDO(env.CACHE_DO);
            this.enabled = true;
            logger.info('DO_CACHE_ADAPTER: Initialized with Durable Objects cache');
        }
        else {
            this.enabled = false;
            logger.info('DO_CACHE_ADAPTER: Cache disabled (DO binding not available)');
        }
    }
    /**
     * Get value from cache with namespace support
     */
    async get(namespace, key, ttl) {
        if (!this.doCache)
            return null;
        const config = {
            ttl: ttl || 3600,
            namespace,
            staleWhileRevalidate: 600
        };
        return this.doCache.get(key, config);
    }
    /**
     * Set value in cache with namespace support
     */
    async set(namespace, key, value, ttl) {
        if (!this.doCache)
            return;
        const config = {
            ttl: ttl || 3600,
            namespace,
            staleWhileRevalidate: 600
        };
        return this.doCache.set(key, value, config);
    }
    /**
     * Get with stale-while-revalidate support
     */
    async getWithStaleRevalidate(namespace, key, revalidateFn, ttl) {
        if (!this.doCache) {
            return { data: null, isStale: false };
        }
        const config = {
            ttl: ttl || 3600,
            namespace,
            staleWhileRevalidate: 600
        };
        const result = await this.doCache.getWithStaleRevalidate(key, config, revalidateFn);
        return {
            data: result.data,
            isStale: result.isStale,
            metadata: result.metadata
        };
    }
    /**
     * Delete key from cache
     */
    async delete(namespace, key) {
        if (!this.doCache)
            return;
        const config = {
            ttl: 3600,
            namespace
        };
        return this.doCache.delete(key, config);
    }
    /**
     * Clear namespace or entire cache
     */
    async clear(namespace) {
        if (!this.doCache)
            return;
        if (namespace) {
            // Clear specific namespace - would need DO implementation
            logger.info(`DO_CACHE_ADAPTER: Clearing namespace: ${namespace}`);
            // For now, just log - full implementation would require DO method
        }
        else {
            return this.doCache.clear();
        }
    }
    /**
     * Get cache statistics
     */
    async getStats() {
        if (!this.doCache) {
            return {
                enabled: false,
                totalEntries: 0,
                memoryUsage: 0,
                hitRate: 0
            };
        }
        const stats = await this.doCache.getStats();
        return {
            enabled: true,
            totalEntries: stats?.totalEntries || 0,
            memoryUsage: stats?.memoryUsage || 0,
            hitRate: stats?.hitRate || 0,
            architecture: 'Durable Objects'
        };
    }
    /**
     * Health check
     */
    async healthCheck() {
        if (!this.doCache)
            return false;
        return this.doCache.healthCheck();
    }
    /**
     * Get health assessment (compatibility with enhanced cache routes)
     */
    async performHealthAssessment() {
        if (!this.doCache) {
            return {
                status: 'disabled',
                overallScore: 0,
                issues: ['DO cache not available'],
                recommendations: ['Configure CACHE_DO binding in wrangler.toml'],
                timestamp: new Date().toISOString()
            };
        }
        return this.doCache.performHealthAssessment();
    }
    /**
     * Check if cache is enabled
     */
    isEnabled() {
        return this.enabled && this.doCache !== null;
    }
    /**
     * Get configuration summary
     */
    getConfigurationSummary() {
        if (!this.doCache) {
            return {
                enabled: false,
                architecture: 'disabled',
                reason: 'DO cache not available'
            };
        }
        return this.doCache.getConfigurationSummary();
    }
    /**
     * Compatibility methods for existing cache manager API
     */
    // L1 cache compatibility
    getL1Stats() {
        return this.doCache?.getL1Stats() || { enabled: false };
    }
    getL1DetailedInfo() {
        return this.doCache?.getL1DetailedInfo() || { enabled: false };
    }
    // L2 cache compatibility (always disabled for DO)
    getL2Stats() {
        return { enabled: false, message: 'L2 KV cache disabled (DO-only architecture)' };
    }
    // Promotion compatibility (not applicable for DO)
    getPromotionStats() {
        return this.doCache?.getPromotionStats() || { enabled: false };
    }
    isPromotionEnabled() {
        return false; // No promotion in DO-only architecture
    }
    // Performance and access patterns
    getPerformanceTrends() {
        return this.doCache?.getPerformanceTrends() || [];
    }
    getAccessPatterns() {
        return this.doCache?.getAccessPatterns() || [];
    }
    // System status
    async getSystemStatus() {
        if (!this.doCache) {
            return {
                status: 'disabled',
                enabled: false,
                architecture: 'none',
                reason: 'DO cache not available'
            };
        }
        return this.doCache.getSystemStatus();
    }
    // Timestamp info
    getTimestampInfo(namespace, key) {
        return this.doCache?.getTimestampInfo(namespace, key) || null;
    }
    // Deduplication (not implemented in DO cache yet)
    getDeduplicationStats() {
        return this.doCache?.getDeduplicationStats() || { enabled: false };
    }
    getDeduplicationCacheInfo() {
        return this.doCache?.getDeduplicationCacheInfo() || {};
    }
    getDeduplicationPendingRequests() {
        return this.doCache?.getDeduplicationPendingRequests() || [];
    }
    // Enhanced configurations
    getAllEnhancedConfigs() {
        return this.doCache?.getAllEnhancedConfigs() || { namespaces: [] };
    }
    // Namespace-specific methods
    async setWithNamespace(namespace, key, value, ttl) {
        return this.set(namespace, key, value, ttl);
    }
    async getWithNamespace(namespace, key) {
        return this.get(namespace, key);
    }
    // Force refresh (background refresh)
    async forceRefresh(namespace, key) {
        // For DO cache, we can trigger a delete to force refresh on next access
        await this.delete(namespace, key);
        logger.info(`DO_CACHE_ADAPTER: Forced refresh for ${namespace}:${key}`);
    }
}
/**
 * Factory function to create DO cache adapter
 * Drop-in replacement for createCacheManager
 */
export function createDOCacheAdapter(env, options) {
    return new DOCacheAdapter(env, options);
}
/**
 * Sector-specific DO cache adapter
 * Replaces SectorCacheManager
 */
export class DOSectorCacheAdapter extends DOCacheAdapter {
    constructor(env) {
        super(env, { enabled: true });
    }
    /**
     * Get sector data with typed interface
     */
    async getSectorData(symbol) {
        return this.get('sector_data', symbol, 1800 /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */); // 30 minutes TTL
    }
    /**
     * Set sector data with typed interface
     */
    async setSectorData(symbol, data) {
        return this.set('sector_data', symbol, data, 1800);
    }
    /**
     * Get sector snapshot
     */
    async getSectorSnapshot() {
        return this.get('sector_data', 'snapshot', 900 /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */); // 15 minutes TTL
    }
    /**
     * Set sector snapshot
     */
    async setSectorSnapshot(data) {
        return this.set('sector_data', 'snapshot', data, 900);
    }
}
/**
 * Market drivers specific DO cache adapter
 * Replaces MarketDriversCacheManager
 */
export class DOMarketDriversCacheAdapter extends DOCacheAdapter {
    constructor(env) {
        super(env, { enabled: true });
    }
    /**
     * Get market drivers data
     */
    async getMarketDrivers() {
        return this.get('market_drivers', 'current', 3600 /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */); // 1 hour TTL
    }
    /**
     * Set market drivers data
     */
    async setMarketDrivers(data) {
        return this.set('market_drivers', 'current', data, 3600);
    }
    /**
     * Get FRED data
     */
    async getFredData(indicator) {
        return this.get('fred_data', indicator, 86400 /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */); // 24 hours TTL
    }
    /**
     * Set FRED data
     */
    async setFredData(indicator, data) {
        return this.set('fred_data', indicator, data, 86400);
    }
}
/**
 * Backtesting specific DO cache adapter
 * Replaces BacktestingCacheManager
 */
export class DOBacktestingCacheAdapter extends DOCacheAdapter {
    constructor(env) {
        super(env, { enabled: true });
    }
    /**
     * Get backtest results
     */
    async getBacktestResults(strategyId) {
        return this.get('backtesting', strategyId, 7200 /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */); // 2 hours TTL
    }
    /**
     * Set backtest results
     */
    async setBacktestResults(strategyId, results) {
        return this.set('backtesting', strategyId, results, 7200);
    }
    /**
     * Get historical data
     */
    async getHistoricalData(symbol, period) {
        return this.get('historical_data', `${symbol}_${period}`, 86400 /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */ /* @ts-ignore */); // 24 hours TTL
    }
    /**
     * Set historical data
     */
    async setHistoricalData(symbol, period, data) {
        return this.set('historical_data', `${symbol}_${period}`, data, 86400);
    }
}
export default DOCacheAdapter;
//# sourceMappingURL=do-cache-adapter.js.map