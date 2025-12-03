/**
 * Sector Routes - Simple Implementation
 * Rate-limit-safe sector rotation API endpoints
 * ZERO AI/News API dependencies - pure market data analysis
 */
interface SectorSnapshotResponse {
    success: boolean;
    data?: {
        timestamp: string;
        date: string;
        sectors: any[];
        spy: any;
        metadata: {
            fetchedAt: string;
            source: string;
            apiCalls: number;
            fetchTimeMs: number;
        };
    };
    error?: string;
    timestamp: string;
}
interface SectorAnalysisResponse {
    success: boolean;
    data?: {
        timestamp: string;
        sectors: any[];
        summary: {
            leadingStrength: string[];
            weakeningStrength: string[];
            laggingWeakness: string[];
            improvingWeakness: string[];
        };
        marketAnalysis: {
            trend: string;
            confidence: number;
            topSectors: string[];
            weakSectors: string[];
        };
    };
    error?: string;
    timestamp: string;
}
export declare class SectorRoutes {
    private fetcher;
    private indicators;
    constructor();
    /**
     * GET /api/sectors/snapshot
     * Get current sector snapshot with real-time data
     */
    handleSectorSnapshot(): Promise<SectorSnapshotResponse>;
    /**
     * GET /api/sectors/analysis
     * Get complete sector rotation analysis
     */
    handleSectorAnalysis(): Promise<SectorAnalysisResponse>;
    /**
     * GET /api/sectors/health
     * Get sector system health status
     */
    handleSectorHealth(): Promise<{
        success: boolean;
        data?: {
            status: string;
            fetcher: any;
            config: any;
            lastUpdate?: string;
        };
        error?: string;
        timestamp: string;
    }>;
    /**
     * GET /api/sectors/test
     * Test the sector system with minimal API calls
     */
    handleSectorTest(): Promise<{
        success: boolean;
        message: string;
        data?: any;
        timestamp: string;
    }>;
    /**
     * GET /api/sectors/config
     * Get sector configuration (for debugging)
     */
    handleSectorConfig(): Promise<{
        success: boolean;
        data?: any;
        timestamp: string;
    }>;
}
/**
 * Route handler function for Cloudflare Workers
 */
export declare function handleSectorRoute(request: Request, env: any, ctx: any): Promise<Response>;
export default handleSectorRoute;
//# sourceMappingURL=sector-routes-simple.d.ts.map