/**
 * Sector Data Fetcher Module - TypeScript
 * Batch data fetching with semaphore concurrency control and circuit breaker protection
 * CRITICAL PRODUCTION FIX: Prevents rate limit bans during cold starts with semaphore pattern
 * Enhanced with data validation and integrated circuit breaker
 */
import { DOSectorCacheAdapter } from './do-cache-adapter.js';
import type { SectorData } from './sector-cache-manager.js';
export declare const SECTOR_SYMBOLS: readonly ["XLK", "XLV", "XLF", "XLY", "XLC", "XLI", "XLP", "XLE", "XLU", "XLRE", "XLB", "SPY"];
declare enum CircuitState {
    CLOSED = "CLOSED",// Normal operation
    OPEN = "OPEN",// Circuit is open, no requests
    HALF_OPEN = "HALF_OPEN"
}
/**
 * Sector Data Fetcher with semaphore concurrency control
 */
export declare class SectorDataFetcher {
    private cache;
    private semaphore;
    private circuitBreaker;
    private fetchStats;
    constructor(cache: DOSectorCacheAdapter | null);
    /**
     * Fetch sector data for multiple symbols with concurrency control
     */
    fetchSectorData(symbols: string[]): Promise<Map<string, SectorData | null>>;
    /**
     * Fetch single symbol with semaphore control
     */
    private fetchWithSemaphore;
    /**
     * Fetch data from Yahoo Finance API
     */
    private fetchFromAPI;
    /**
     * Handle successful request
     */
    private handleSuccess;
    /**
     * Handle failed request
     */
    private handleFailure;
    /**
     * Update fetch statistics
     */
    private updateFetchStats;
    /**
     * Get system health status
     */
    getHealthStatus(): {
        semaphore: {
            availablePermits: number;
            queueLength: number;
            maxPermits: number;
        };
        circuitBreaker: {
            state: CircuitState;
            failureCount: number;
            lastFailureTime: number;
        };
        performance: {
            successRate: number;
            averageResponseTime: number;
            circuitBreakerTrips: number;
        };
    };
    /**
     * Get fetch statistics
     */
    getStats(): {
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
        successRate: number;
        averageResponseTime: number;
        circuitBreakerTrips: number;
    };
    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker(): void;
    /**
     * Test system with load
     */
    testLoad(symbols: string[], concurrency?: number): Promise<{
        success: boolean;
        duration: number;
        errors: string[];
        healthStatus: any;
    }>;
    /**
     * Warm up system
     */
    warmUp(testSymbols?: string[]): Promise<void>;
}
export default SectorDataFetcher;
//# sourceMappingURL=sector-data-fetcher.d.ts.map