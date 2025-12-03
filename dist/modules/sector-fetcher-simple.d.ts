/**
 * Simple Sector Data Fetcher - TypeScript
 * Conservative Yahoo Finance data fetching with ZERO external dependencies
 * No AI/News APIs - pure market data analysis only
 */
interface OHLCVBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjustedClose?: number;
}
interface SectorData {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    ohlc: OHLCVBar;
}
interface SectorSnapshot {
    timestamp: string;
    date: string;
    sectors: SectorData[];
    spy: SectorData;
    metadata: {
        fetchedAt: string;
        source: 'cache' | 'api';
        apiCalls: number;
        fetchTimeMs: number;
    };
}
export declare class SimpleSectorFetcher {
    private semaphore;
    private circuitBreaker;
    private requestCount;
    constructor();
    /**
     * Simple logger (no external dependencies)
     */
    private log;
    /**
     * Validate OHLCV data before using
     */
    private validateOHLCV;
    /**
     * Fetch single symbol data from Yahoo Finance
     */
    private fetchSymbolData;
    /**
     * Fetch current sector snapshot with conservative concurrency
     */
    fetchSectorSnapshot(): Promise<SectorSnapshot>;
    /**
     * Get circuit breaker status for monitoring
     */
    getCircuitBreakerStatus(): {
        state: string;
        failures: number;
    };
    /**
     * Test the system with minimal symbols
     */
    testFetch(): Promise<{
        success: boolean;
        message: string;
        data?: any;
    }>;
}
export default SimpleSectorFetcher;
//# sourceMappingURL=sector-fetcher-simple.d.ts.map