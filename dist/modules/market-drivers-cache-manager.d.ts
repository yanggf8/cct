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
import type { MarketDriversSnapshot, MacroDrivers, MarketStructure, GeopoliticalRisk } from './market-drivers.js';
/**
 * Cache Entry with TTL support
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
    source: 'L1' | 'L2' | 'fresh';
}
/**
 * Cache Statistics
 */
interface CacheStats {
    l1Hits: number;
    l1Misses: number;
    l2Hits: number;
    l2Misses: number;
    l1Size: number;
    l2HitRate: number;
    l1HitRate: number;
    overallHitRate: number;
    memoryUsage: number;
}
/**
 * Market Drivers Cache Manager with Durable Objects
 */
export declare class MarketDriversCacheManager {
    private dal;
    private circuitBreaker;
    private cacheManager;
    private readonly DEFAULT_TTL;
    L1_TTL: number;
    L2_TTL: number;
    l1Cache: Map<string, CacheEntry<any>>;
    private stats;
    constructor(env: any);
    /**
     * Get Market Drivers snapshot from cache
     */
    getMarketDriversSnapshot(date?: Date | string): Promise<MarketDriversSnapshot | null>;
    /**
     * Store Market Drivers snapshot in DO cache
     */
    setMarketDriversSnapshot(data: MarketDriversSnapshot, date?: Date | string): Promise<void>;
    /**
     * Get Macro Drivers data from cache
     */
    getMacroDrivers(date?: Date | string): Promise<MacroDrivers | null>;
    /**
     * Store Macro Drivers data in cache
     */
    setMacroDrivers(data: MacroDrivers, date?: Date | string): Promise<void>;
    /**
     * Get Market Structure data from cache
     */
    getMarketStructure(date?: Date | string): Promise<MarketStructure | null>;
    /**
     * Store Market Structure data in cache
     */
    setMarketStructure(data: MarketStructure, date?: Date | string): Promise<void>;
    /**
     * Get Geopolitical Risk data from cache
     */
    getGeopoliticalRisk(date?: Date | string): Promise<GeopoliticalRisk | null>;
    /**
     * Store Geopolitical Risk data in cache
     */
    setGeopoliticalRisk(data: GeopoliticalRisk, date?: Date | string): Promise<void>;
    /**
     * Validate Market Drivers data
     */
    validateMarketDriversData(data: MarketDriversSnapshot): boolean;
    /**
     * Get cache statistics
     */
    getCacheStats(): CacheStats;
    /**
     * Clear all caches (L1 and L2 for specific date)
     */
    clearCache(date?: Date | string): Promise<void>;
    /**
     * L1 Cache operations
     */
    private getFromL1;
    private setToL1;
    private getFromL2;
    /**
     * Clean up expired L1 entries
     */
    private cleanupExpiredL1Entries;
    /**
     * Update cache statistics
     */
    private updateStats;
    /**
     * Estimate memory usage of L1 cache
     */
    private estimateMemoryUsage;
}
/**
 * Initialize Market Drivers Cache Manager
 */
export declare function initializeMarketDriversCacheManager(env: any): any;
export default MarketDriversCacheManager;
//# sourceMappingURL=market-drivers-cache-manager.d.ts.map