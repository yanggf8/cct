/**
 * Sector Cache Manager
 * Durable Object backed caching with TTL, namespacing and lightweight metrics
 */
export interface SectorData {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp?: number;
    marketCap?: number;
    dayHigh?: number;
    dayLow?: number;
    fiftyDayAverage?: number;
    twoHundredDayAverage?: number;
    indicators?: Record<string, unknown>;
    [key: string]: unknown;
}
export declare class SectorCacheManager {
    private cache;
    private sectorOptions;
    private snapshotOptions;
    private metricsOptions;
    constructor(env: any);
    private readMetrics;
    private writeMetrics;
    getSectorData(symbol: string): Promise<SectorData | null>;
    setSectorData(symbol: string, data: SectorData): Promise<void>;
    setBatchSectorData(dataMap: Map<string, SectorData>): Promise<void>;
    getSectorSnapshot(): Promise<any | null>;
    setSectorSnapshot(snapshot: any): Promise<void>;
    clearAllCaches(): Promise<void>;
    getCacheStats(): Promise<Record<string, any>>;
}
export default SectorCacheManager;
//# sourceMappingURL=sector-cache-manager.d.ts.map