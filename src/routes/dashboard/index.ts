/**
 * Dashboard Routes Index
 * Exports all dashboard-related route handlers for the main API router
 */

import {
  getDashboardMetrics,
  getCostToServeMetrics,
  getGuardViolationData,
  getDashboardHealth,
  refreshDashboardData
} from './dashboard-routes.js';

export {
  getDashboardMetrics,
  getCostToServeMetrics,
  getGuardViolationData,
  getDashboardHealth,
  refreshDashboardData
};

/**
 * Main dashboard route handler that routes requests to the appropriate endpoint
 */
export async function handleDashboardRoutes(
  request: Request,
  env: any,
  ctx: ExecutionContext,
  headers: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Route to specific dashboard endpoints
  if (path === '/api/v1/dashboard/metrics' && request.method === 'GET') {
    return await getDashboardMetrics(request, env, ctx, headers);
  } else if (path === '/api/v1/dashboard/economics' && request.method === 'GET') {
    return await getCostToServeMetrics(request, env, ctx, headers);
  } else if (path === '/api/v1/dashboard/guards' && request.method === 'GET') {
    return await getGuardViolationData(request, env, ctx, headers);
  } else if (path === '/api/v1/dashboard/health' && request.method === 'GET') {
    return await getDashboardHealth(request, env, ctx, headers);
  } else if (path === '/api/v1/dashboard/refresh' && request.method === 'POST') {
    return await refreshDashboardData(request, env, ctx, headers);
  } else {
    // Endpoint not found
    const { ApiResponseFactory, HttpStatus } = await import('../../modules/api-v1-responses.js');
    const body = ApiResponseFactory.error('Dashboard endpoint not found', 'NOT_FOUND', {
      requested_path: path,
      method: request.method,
      available_endpoints: [
        'GET /api/v1/dashboard/metrics',
        'GET /api/v1/dashboard/economics',
        'GET /api/v1/dashboard/guards',
        'GET /api/v1/dashboard/health',
        'POST /api/v1/dashboard/refresh'
      ]
    });
    return new Response(JSON.stringify(body), { status: HttpStatus.NOT_FOUND, headers });
  }
}