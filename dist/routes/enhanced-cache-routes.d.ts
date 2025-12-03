/**
 * Enhanced Cache API Routes
 * Provides 6 endpoints for testing and monitoring enhanced cache features
 * (Load testing removed - dual cache functionality covered by integration tests)
 */
/**
 * Create enhanced cache routes
 */
export declare function createEnhancedCacheRoutes(env: any): {
    path: string;
    method: string;
    handler: (request: Request, env: any, ctx: ExecutionContext) => Promise<Response>;
}[];
export default createEnhancedCacheRoutes;
//# sourceMappingURL=enhanced-cache-routes.d.ts.map