/**
 * Sector Routes - TypeScript
 * RESTful API endpoints for sector rotation analysis
 * Provides comprehensive sector data with indicators and performance metrics
 *
 * @author Sector Rotation Pipeline v1.3
 * @since 2025-10-10
 */
/**
 * Sector snapshot response interface
 */
export interface SectorSnapshotResponse {
    timestamp: number;
    date: string;
    sectors: {
        symbol: string;
        name: string;
        price: number;
        change: number;
        changePercent: number;
        volume: number;
        indicators?: {
            obv?: {
                value: number;
                trend: 'up' | 'down' | 'neutral';
                volumeTrend: 'accumulating' | 'distributing' | 'neutral';
            };
            cmf?: {
                value: number;
                signal: 'bullish' | 'bearish' | 'neutral';
            };
            relativeStrength?: {
                value: number;
                trend: 'outperforming' | 'underperforming' | 'neutral';
                benchmark: string;
            };
        };
        marketCap?: number;
        dayHigh?: number;
        dayLow?: number;
    }[];
    summary: {
        totalSectors: number;
        bullishSectors: number;
        bearishSectors: number;
        neutralSectors: number;
        topPerformer: string;
        worstPerformer: string;
        averageChange: number;
    };
    metadata: {
        cacheHit: boolean;
        responseTime: number;
        dataFreshness: number;
        l1CacheHitRate: number;
        l2CacheHitRate: number;
    };
}
/**
 * GET /api/sectors/snapshot
 * Get comprehensive sector snapshot with real-time data and technical indicators
 */
export declare function getSectorSnapshot(request: any, env: any): Promise<Response>;
/**
 * GET /api/sectors/health
 * Health check for sector services
 */
export declare function getSectorHealth(request: any, env: any): Promise<Response>;
/**
 * GET /api/sectors/symbols
 * Get list of supported sector symbols
 */
export declare function getSectorSymbols(request: any, env: any): Promise<Response>;
/**
 * Sector routes export
 */
export declare function getSectorIndicatorsSymbol(request: any, env: any, symbolParam?: string): Promise<Response>;
export declare const sectorRoutes: {
    '/api/v1/sectors/snapshot': typeof getSectorSnapshot;
    '/api/v1/sectors/health': typeof getSectorHealth;
    '/api/v1/sectors/symbols': typeof getSectorSymbols;
};
export default sectorRoutes;
//# sourceMappingURL=sector-routes.d.ts.map