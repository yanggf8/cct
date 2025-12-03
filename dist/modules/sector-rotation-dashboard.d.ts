/**
 * Sector Rotation Dashboard Module
 * Comprehensive Sector Rotation Analysis page
 * Displays 11 SPDR ETFs with live data, technical indicators, and rotation signals
 */
interface Env {
    MARKET_ANALYSIS_CACHE: KVNamespace;
    TRAINED_MODELS: R2Bucket;
    ENHANCED_MODELS: R2Bucket;
    AI: any;
    WORKER_VERSION?: string;
    TRADING_SYMBOLS?: string;
    LOG_LEVEL?: string;
    TIMEZONE?: string;
}
/**
 * Serve the Sector Rotation Dashboard HTML page
 */
export declare function handleSectorRotationDashboardPage(request: Request, env: Env): Promise<Response>;
export {};
//# sourceMappingURL=sector-rotation-dashboard.d.ts.map