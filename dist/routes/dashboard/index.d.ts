/**
 * Dashboard Routes Index
 * Exports all dashboard-related route handlers for the main API router
 */
import { getDashboardMetrics, getCostToServeMetrics, getGuardViolationData, getDashboardHealth, refreshDashboardData } from './dashboard-routes.js';
export { getDashboardMetrics, getCostToServeMetrics, getGuardViolationData, getDashboardHealth, refreshDashboardData };
/**
 * Main dashboard route handler that routes requests to the appropriate endpoint
 */
export declare function handleDashboardRoutes(request: Request, env: any, ctx: ExecutionContext, headers: Record<string, string>): Promise<Response>;
//# sourceMappingURL=index.d.ts.map