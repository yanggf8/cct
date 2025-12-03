/**
 * Market Drivers Cache Manager
 *
 * Implements L1 (in-memory) + L2 (KV) caching for Market Drivers data
 * following the same architecture as Sector Cache Manager.
 *
 * Features:
 * - L1 Memory Cache (5 min TTL)
 * - L2 KV Cache (10 min TTL)
 * - Circuit breaker protection
 * - Cache hit rate tracking
 * - Data validation
 *
 * @author Market Drivers Pipeline - Phase 2
 * @since 2025-10-10
 */
import { createLogger } from './logging.js';
import { createDAL } from './dal.js';
import { KeyHelpers } from './kv-key-factory.js';
import { CircuitBreakerFactory } from './circuit-breaker.js';
import { createCacheInstance } from './dual-cache-do.js';
const logger = createLogger('market-drivers-cache-manager');
/**
 * Market Drivers Cache Manager with Durable Objects
 */
export class MarketDriversCacheManager {
    constructor(env) {
        // Cache TTLs
        this.DEFAULT_TTL = 10 * 60; // 10 minutes
        // Cache Statistics
        this.stats = {
            l1Hits: 0,
            l1Misses: 0,
            l2Hits: 0,
            l2Misses: 0,
            l1Size: 0,
            l2HitRate: 0,
            l1HitRate: 0,
            overallHitRate: 0,
            memoryUsage: 0,
        };
        this.dal = createDAL(env);
        this.circuitBreaker = CircuitBreakerFactory.getInstance('market-drivers-cache');
        // Initialize TTLs
        this.L1_TTL = 5 * 60 * 1000; // 5 minutes
        this.L2_TTL = 10 * 60 * 1000; // 10 minutes
        // Initialize L1 cache
        this.l1Cache = new Map();
        // Initialize DO cache if available
        this.cacheManager = createCacheInstance(env, true);
        if (this.cacheManager) {
            logger.info('MARKET_DRIVERS_CACHE: Using Durable Objects cache');
        }
        else {
            logger.info('MARKET_DRIVERS_CACHE: Cache disabled (DO binding not available)');
        }
    }
    /**
     * Get Market Drivers snapshot from cache
     */
    async getMarketDriversSnapshot(date) {
        const cacheKey = date
            ? KeyHelpers.getMarketDriversSnapshotKey(date)
            : KeyHelpers.getMarketDriversSnapshotKey();
        // Try DO cache
        if (this.cacheManager) {
            try {
                const result = await this.cacheManager.get(cacheKey, {
                    ttl: this.DEFAULT_TTL,
                    namespace: 'market_drivers'
                });
                if (result) {
                    this.stats.l1Hits++; // Treat DO cache as L1 equivalent
                    logger.debug('Market Drivers snapshot DO cache hit', { date, source: 'DO' });
                    return result;
                }
                this.stats.l1Misses++;
            }
            catch (error) {
                logger.error('DO cache read error for Market Drivers snapshot:', { error: error instanceof Error ? error.message : String(error) });
                this.stats.l1Misses++;
            }
        }
        else {
            this.stats.l1Misses++;
        }
        logger.debug('Market Drivers snapshot cache miss', { date });
        return null;
    }
    /**
     * Store Market Drivers snapshot in DO cache
     */
    async setMarketDriversSnapshot(data, date) {
        const cacheKey = date
            ? KeyHelpers.getMarketDriversSnapshotKey(date)
            : KeyHelpers.getMarketDriversSnapshotKey();
        // Store in DO cache
        if (this.cacheManager) {
            try {
                await this.cacheManager.set(cacheKey, { ...data, source: 'fresh' }, {
                    ttl: this.DEFAULT_TTL,
                    namespace: 'market_drivers'
                });
                logger.debug('Market Drivers snapshot stored in DO cache', { date });
            }
            catch (error) {
                logger.error('Failed to store Market Drivers snapshot in DO cache:', { error: error instanceof Error ? error.message : String(error) });
            }
        }
    }
    /**
     * Get Macro Drivers data from cache
     */
    async getMacroDrivers(date) {
        const cacheKey = date
            ? KeyHelpers.getMarketDriversMacroKey(date)
            : KeyHelpers.getMarketDriversMacroKey();
        // Try L1 cache first
        const l1Result = this.getFromL1(cacheKey);
        if (l1Result) {
            this.stats.l1Hits++;
            logger.debug('Macro Drivers L1 cache hit', { date });
            return l1Result;
        }
        this.stats.l1Misses++;
        // Try L2 cache
        try {
            const l2Result = await this.getFromL2(cacheKey);
            if (l2Result) {
                this.stats.l2Hits++;
                this.setToL1(cacheKey, l2Result);
                logger.debug('Macro Drivers L2 cache hit', { date });
                return l2Result;
            }
            this.stats.l2Misses++;
        }
        catch (error) {
            logger.error('L2 cache read error for Macro Drivers:', { error: error instanceof Error ? error.message : String(error) });
            this.stats.l2Misses++;
        }
        return null;
    }
    /**
     * Store Macro Drivers data in cache
     */
    async setMacroDrivers(data, date) {
        const cacheKey = date
            ? KeyHelpers.getMarketDriversMacroKey(date)
            : KeyHelpers.getMarketDriversMacroKey();
        this.setToL1(cacheKey, data);
        try {
            await this.circuitBreaker.execute(async () => {
                const result = await this.dal.write(cacheKey, data, {
                    expirationTtl: this.L2_TTL / 1000,
                });
                if (!result.success) {
                    throw new Error(`Failed to write to L2 cache: ${result.error}`);
                }
                return result;
            });
        }
        catch (error) {
            logger.error('Failed to store Macro Drivers in L2 cache:', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    /**
     * Get Market Structure data from cache
     */
    async getMarketStructure(date) {
        const cacheKey = date
            ? KeyHelpers.getMarketDriversMarketStructureKey(date)
            : KeyHelpers.getMarketDriversMarketStructureKey();
        const l1Result = this.getFromL1(cacheKey);
        if (l1Result) {
            this.stats.l1Hits++;
            return l1Result;
        }
        this.stats.l1Misses++;
        try {
            const l2Result = await this.getFromL2(cacheKey);
            if (l2Result) {
                this.stats.l2Hits++;
                this.setToL1(cacheKey, l2Result);
                return l2Result;
            }
            this.stats.l2Misses++;
        }
        catch (error) {
            logger.error('L2 cache read error for Market Structure:', { error: error instanceof Error ? error.message : String(error) });
            this.stats.l2Misses++;
        }
        return null;
    }
    /**
     * Store Market Structure data in cache
     */
    async setMarketStructure(data, date) {
        const cacheKey = date
            ? KeyHelpers.getMarketDriversMarketStructureKey(date)
            : KeyHelpers.getMarketDriversMarketStructureKey();
        this.setToL1(cacheKey, data);
        try {
            await this.circuitBreaker.execute(async () => {
                const result = await this.dal.write(cacheKey, data, {
                    expirationTtl: this.L2_TTL / 1000,
                });
                if (!result.success) {
                    throw new Error(`Failed to write to L2 cache: ${result.error}`);
                }
                return result;
            });
        }
        catch (error) {
            logger.error('Failed to store Market Structure in L2 cache:', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    /**
     * Get Geopolitical Risk data from cache
     */
    async getGeopoliticalRisk(date) {
        const cacheKey = date
            ? KeyHelpers.getMarketDriversGeopoliticalKey(date)
            : KeyHelpers.getMarketDriversGeopoliticalKey();
        const l1Result = this.getFromL1(cacheKey);
        if (l1Result) {
            this.stats.l1Hits++;
            return l1Result;
        }
        this.stats.l1Misses++;
        try {
            const l2Result = await this.getFromL2(cacheKey);
            if (l2Result) {
                this.stats.l2Hits++;
                this.setToL1(cacheKey, l2Result);
                return l2Result;
            }
            this.stats.l2Misses++;
        }
        catch (error) {
            logger.error('L2 cache read error for Geopolitical Risk:', { error: error instanceof Error ? error.message : String(error) });
            this.stats.l2Misses++;
        }
        return null;
    }
    /**
     * Store Geopolitical Risk data in cache
     */
    async setGeopoliticalRisk(data, date) {
        const cacheKey = date
            ? KeyHelpers.getMarketDriversGeopoliticalKey(date)
            : KeyHelpers.getMarketDriversGeopoliticalKey();
        this.setToL1(cacheKey, data);
        try {
            await this.circuitBreaker.execute(async () => {
                const result = await this.dal.write(cacheKey, data, {
                    expirationTtl: this.L2_TTL / 1000,
                });
                if (!result.success) {
                    throw new Error(`Failed to write to L2 cache: ${result.error}`);
                }
                return result;
            });
        }
        catch (error) {
            logger.error('Failed to store Geopolitical Risk in L2 cache:', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    /**
     * Validate Market Drivers data
     */
    validateMarketDriversData(data) {
        try {
            // Check basic structure
            if (!data.timestamp || !data.date) {
                logger.warn('Market Drivers data missing timestamp or date');
                return false;
            }
            // Validate macro data
            if (!data.macro || typeof data.macro.fedFundsRate !== 'number') {
                logger.warn('Market Drivers data has invalid macro structure');
                return false;
            }
            // Validate market structure
            if (!data.marketStructure || typeof data.marketStructure.vix !== 'number') {
                logger.warn('Market Drivers data has invalid market structure');
                return false;
            }
            // Validate geopolitical data
            if (!data.geopolitical || typeof data.geopolitical.overallRiskScore !== 'number') {
                logger.warn('Market Drivers data has invalid geopolitical data');
                return false;
            }
            // Validate regime data
            if (!data.regime || !data.regime.currentRegime) {
                logger.warn('Market Drivers data has invalid regime information');
                return false;
            }
            // Check for reasonable values
            if (data.marketStructure.vix < 0 || data.marketStructure.vix > 100) {
                logger.warn('Market Drivers VIX value out of reasonable range', { vix: data.marketStructure.vix });
                return false;
            }
            if (data.macro.fedFundsRate < 0 || data.macro.fedFundsRate > 30) {
                logger.warn('Market Drivers Fed Funds Rate out of reasonable range', {
                    fedFundsRate: data.macro.fedFundsRate
                });
                return false;
            }
            return true;
        }
        catch (error) {
            logger.error('Error validating Market Drivers data:', { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        this.updateStats();
        return { ...this.stats };
    }
    /**
     * Clear all caches (L1 and L2 for specific date)
     */
    async clearCache(date) {
        // Clear L1 cache
        const pattern = date
            ? `market_drivers_${typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0]}`
            : 'market_drivers_';
        for (const key of this.l1Cache.keys()) {
            if (key.startsWith(pattern)) {
                this.l1Cache.delete(key);
            }
        }
        // Clear L2 cache
        if (date) {
            const keys = [
                KeyHelpers.getMarketDriversSnapshotKey(date),
                KeyHelpers.getMarketDriversMacroKey(date),
                KeyHelpers.getMarketDriversMarketStructureKey(date),
                KeyHelpers.getMarketDriversGeopoliticalKey(date),
                KeyHelpers.getMarketDriversRegimeKey(date),
                KeyHelpers.getMarketDriversRiskAssessmentKey(date),
            ];
            for (const key of keys) {
                try {
                    await this.dal.deleteKey(key);
                }
                catch (error) {
                    logger.error(`Failed to delete L2 cache key ${key}:`, { error: error instanceof Error ? error.message : String(error) });
                }
            }
        }
        logger.info('Market Drivers cache cleared', { date });
    }
    /**
     * L1 Cache operations
     */
    getFromL1(key) {
        const entry = this.l1Cache.get(key);
        if (!entry) {
            return null;
        }
        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.l1Cache.delete(key);
            return null;
        }
        return entry.data;
    }
    setToL1(key, data) {
        this.l1Cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: this.L1_TTL,
            source: 'L1',
        });
    }
    async getFromL2(key) {
        const result = await this.dal.read(key);
        return result.success ? result.data : null;
    }
    /**
     * Clean up expired L1 entries
     */
    cleanupExpiredL1Entries() {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [key, entry] of this.l1Cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.l1Cache.delete(key);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger.debug(`Cleaned up ${cleanedCount} expired L1 cache entries`);
        }
    }
    /**
     * Update cache statistics
     */
    updateStats() {
        const totalRequests = this.stats.l1Hits + this.stats.l1Misses;
        const l2Requests = this.stats.l2Hits + this.stats.l2Misses;
        this.stats.l1HitRate = totalRequests > 0 ? (this.stats.l1Hits / totalRequests) : 0;
        this.stats.l2HitRate = l2Requests > 0 ? (this.stats.l2Hits / l2Requests) : 0;
        this.stats.overallHitRate = totalRequests > 0 ? ((this.stats.l1Hits + this.stats.l2Hits) / totalRequests) : 0;
        this.stats.l1Size = this.l1Cache.size;
        this.stats.memoryUsage = this.estimateMemoryUsage();
    }
    /**
     * Estimate memory usage of L1 cache
     */
    estimateMemoryUsage() {
        let totalSize = 0;
        for (const [key, entry] of this.l1Cache.entries()) {
            // Rough estimation: key + data + overhead
            totalSize += key.length * 2 + JSON.stringify(entry.data).length * 2 + 200;
        }
        return totalSize;
    }
}
/**
 * Initialize Market Drivers Cache Manager
 */
export function initializeMarketDriversCacheManager(env) {
    // @ts-ignore - Adapter not implemented
    return new globalThis.DOMarketDriversCacheAdapter(env);
}
export default MarketDriversCacheManager;
//# sourceMappingURL=market-drivers-cache-manager.js.map