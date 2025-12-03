/**
 * Sector Cache Manager
 * Durable Object backed caching with TTL, namespacing and lightweight metrics
 */
import { SimpleCache } from './simple-cache-do.js';
import { createLogger } from './logging.js';
const logger = createLogger('sector-cache-manager');
const SECTOR_NAMESPACE = 'sector_data';
const SNAPSHOT_NAMESPACE = 'sector_snapshot';
const METRICS_NAMESPACE = 'sector_metrics';
const SECTOR_TTL_SECONDS = 120;
const SNAPSHOT_TTL_SECONDS = 300;
const METRICS_TTL_SECONDS = 86400;
const SNAPSHOT_KEY = 'latest';
const METRICS_KEY = 'metrics';
const ESTIMATED_ENTRY_SIZE_BYTES = 2048;
const createDefaultMetrics = () => ({
    totalRequests: 0,
    hits: 0,
    misses: 0,
    lastUpdated: new Date(0).toISOString()
});
export class SectorCacheManager {
    constructor(env) {
        if (!env?.CACHE_DO) {
            logger.warn('Sector cache disabled: CACHE_DO binding missing');
            this.cache = null;
        }
        else {
            this.cache = new SimpleCache(env.CACHE_DO);
        }
        this.sectorOptions = {
            namespace: SECTOR_NAMESPACE,
            ttl: SECTOR_TTL_SECONDS
        };
        this.snapshotOptions = {
            namespace: SNAPSHOT_NAMESPACE,
            ttl: SNAPSHOT_TTL_SECONDS
        };
        this.metricsOptions = {
            namespace: METRICS_NAMESPACE,
            ttl: METRICS_TTL_SECONDS
        };
    }
    async readMetrics() {
        if (!this.cache) {
            return createDefaultMetrics();
        }
        try {
            const stored = await this.cache.get(METRICS_KEY, this.metricsOptions);
            if (stored && typeof stored === 'object') {
                return {
                    ...createDefaultMetrics(),
                    ...stored,
                    lastUpdated: stored.lastUpdated ?? new Date().toISOString()
                };
            }
        }
        catch (error) {
            logger.error('Failed to read cache metrics', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
        return createDefaultMetrics();
    }
    async writeMetrics(metrics) {
        if (!this.cache) {
            return;
        }
        try {
            metrics.lastUpdated = new Date().toISOString();
            await this.cache.set(METRICS_KEY, metrics, this.metricsOptions);
        }
        catch (error) {
            logger.error('Failed to persist cache metrics', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async getSectorData(symbol) {
        if (!this.cache) {
            return null;
        }
        const key = symbol.toUpperCase();
        const metrics = await this.readMetrics();
        metrics.totalRequests += 1;
        try {
            const cached = await this.cache.get(key, { namespace: this.sectorOptions.namespace });
            if (cached !== null && cached !== undefined) {
                metrics.hits += 1;
                await this.writeMetrics(metrics);
                return cached;
            }
            metrics.misses += 1;
            metrics.lastMissKey = key;
            await this.writeMetrics(metrics);
            return null;
        }
        catch (error) {
            logger.error('Failed to read sector cache entry', {
                symbol: key,
                error: error instanceof Error ? error.message : String(error)
            });
            metrics.misses += 1;
            metrics.lastMissKey = key;
            await this.writeMetrics(metrics);
            return null;
        }
    }
    async setSectorData(symbol, data) {
        if (!this.cache) {
            return;
        }
        const key = symbol.toUpperCase();
        try {
            await this.cache.set(key, data, this.sectorOptions);
        }
        catch (error) {
            logger.error('Failed to write sector cache entry', {
                symbol: key,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async setBatchSectorData(dataMap) {
        if (!this.cache) {
            return;
        }
        await Promise.all(Array.from(dataMap.entries()).map(([symbol, data]) => this.setSectorData(symbol, data)));
    }
    async getSectorSnapshot() {
        if (!this.cache) {
            return null;
        }
        try {
            return await this.cache.get(SNAPSHOT_KEY, { namespace: this.snapshotOptions.namespace });
        }
        catch (error) {
            logger.error('Failed to read sector snapshot', {
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }
    async setSectorSnapshot(snapshot) {
        if (!this.cache) {
            return;
        }
        try {
            await this.cache.set(SNAPSHOT_KEY, snapshot, this.snapshotOptions);
            const metrics = await this.readMetrics();
            metrics.lastSnapshotAt = new Date().toISOString();
            await this.writeMetrics(metrics);
        }
        catch (error) {
            logger.error('Failed to write sector snapshot', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async clearAllCaches() {
        if (!this.cache) {
            return;
        }
        try {
            await this.cache.clear({ namespace: this.sectorOptions.namespace });
            await this.cache.clear({ namespace: this.snapshotOptions.namespace });
            await this.cache.clear({ namespace: this.metricsOptions.namespace });
            await this.writeMetrics(createDefaultMetrics());
        }
        catch (error) {
            logger.error('Failed to clear sector caches', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async getCacheStats() {
        if (!this.cache) {
            return { enabled: false };
        }
        const metrics = await this.readMetrics();
        let entryCount = 0;
        try {
            const metadata = await this.cache.getMetadata({ namespace: this.sectorOptions.namespace });
            entryCount = Object.keys(metadata).length;
        }
        catch (error) {
            logger.error('Failed to read cache metadata', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
        const totalRequests = Math.max(metrics.totalRequests, 1);
        const hitRate = metrics.hits / totalRequests;
        return {
            enabled: true,
            totalRequests: metrics.totalRequests,
            hits: metrics.hits,
            misses: metrics.misses,
            hitRate,
            entryCount,
            memoryUsage: entryCount * ESTIMATED_ENTRY_SIZE_BYTES,
            lastSnapshotAt: metrics.lastSnapshotAt,
            lastUpdated: metrics.lastUpdated,
            lastMissKey: metrics.lastMissKey
        };
    }
}
export default SectorCacheManager;
//# sourceMappingURL=sector-cache-manager.js.map