/**
 * Business Intelligence Dashboard Routes
 * Provides endpoints for real-time BI dashboards and cost-to-serve intelligence
 * Phase 3 Implementation: Scaffolding foundation for operational health monitoring
 */
import type { CloudflareEnvironment } from '../../types.js';
/**
 * GET /api/v1/dashboard/metrics - Get overall dashboard metrics
 */
export declare function getDashboardMetrics(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext, headers: Record<string, string>): Promise<Response>;
/**
 * GET /api/v1/dashboard/economics - Get cost-to-serve metrics
 */
export declare function getCostToServeMetrics(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext, headers: Record<string, string>): Promise<Response>;
/**
 * GET /api/v1/dashboard/guards - Get guard violation monitoring data
 */
export declare function getGuardViolationData(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext, headers: Record<string, string>): Promise<Response>;
/**
 * GET /api/v1/dashboard/health - Get dashboard system health
 */
export declare function getDashboardHealth(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext, headers: Record<string, string>): Promise<Response>;
/**
 * POST /api/v1/dashboard/refresh - Force refresh dashboard data
 */
export declare function refreshDashboardData(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext, headers: Record<string, string>): Promise<Response>;
export declare const dashboardRouteHandlers: {
    'GET /api/v1/dashboard/metrics': typeof getDashboardMetrics;
    'GET /api/v1/dashboard/economics': typeof getCostToServeMetrics;
    'GET /api/v1/dashboard/guards': typeof getGuardViolationData;
    'GET /api/v1/dashboard/health': typeof getDashboardHealth;
    'POST /api/v1/dashboard/refresh': typeof refreshDashboardData;
};
//# sourceMappingURL=dashboard-routes.d.ts.map