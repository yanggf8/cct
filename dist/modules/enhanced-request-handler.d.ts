import type { CloudflareEnvironment } from '../types.js';
/**
 * Enhanced request handler with DAL improvements and migration support
 */
export declare class EnhancedRequestHandler {
    private env;
    private dal;
    private migrationManager;
    constructor(env: CloudflareEnvironment);
    /**
     * Handle HTTP request with enhanced features
     */
    handleRequest(request: Request, ctx: ExecutionContext): Promise<Response>;
    /**
     * Handle new API requests with enhanced DAL
     */
    private handleNewAPIRequest;
    /**
     * Handle API v1 root documentation endpoint
     */
    private handleAPIv1Root;
    /**
     * Handle results endpoint (legacy compatibility)
     */
    private handleResults;
    /**
     * Handle legacy requests with enhanced monitoring
     */
    private handleLegacyRequest;
    /**
     * Handle fallback requests for endpoints not yet in new API
     */
    private handleFallbackRequest;
    /**
     * Enhanced health check with DAL and migration status
     */
    private handleEnhancedHealthCheck;
    /**
     * DAL status endpoint
     */
    private handleDALStatus;
    /**
     * Migration status endpoint
     */
    private handleMigrationStatus;
    /**
     * Performance test endpoint
     */
    private handlePerformanceTest;
    /**
     * Cache clear endpoint
     */
    private handleCacheClear;
    /**
     * Expose DAL performance stats for external diagnostics.
     */
    getDalPerformanceStats(): any;
    /**
     * Expose migration statistics for external diagnostics.
     */
    getMigrationStatistics(): Promise<any>;
}
/**
 * Create enhanced request handler instance
 */
export declare function createEnhancedRequestHandler(env: CloudflareEnvironment): EnhancedRequestHandler;
export default EnhancedRequestHandler;
//# sourceMappingURL=enhanced-request-handler.d.ts.map