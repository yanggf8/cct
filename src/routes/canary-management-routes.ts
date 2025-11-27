/**
 * Canary Management Routes - Admin endpoints for managing canary rollouts
 * Protected endpoints for configuring feature flags and monitoring canary status
 */

import { CanaryToggleManager } from '../modules/canary-toggle.js';
import { ApiResponseFactory } from '../modules/api-v1-responses.js';
import type { CloudflareEnvironment } from '../types.js';

/**
 * Handle canary status request
 */
export async function handleCanaryStatus(request: Request, env: CloudflareEnvironment): Promise<Response> {
  try {
    const canaryManager = new CanaryToggleManager(env);
    const statuses = await canaryManager.getAllCanaryStatuses();

    return ApiResponseFactory.success({
      service: 'canary-management',
      timestamp: new Date().toISOString(),
      data: {
        routes: statuses,
        summary: {
          total_routes: Object.keys(statuses).length,
          enabled_routes: Object.values(statuses).filter(config => config.enabled).length,
          total_rollout_percentage: Object.values(statuses).reduce((sum, config) => sum + config.percentage, 0)
        }
      }
    });

  } catch (error) {
    console.error('Canary status request failed:', error);
    return ApiResponseFactory.error(
      'Failed to retrieve canary status',
      'CANARY_STATUS_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Handle canary configuration update
 */
export async function handleCanaryUpdate(request: Request, env: CloudflareEnvironment): Promise<Response> {
  try {
    const body = await request.json() as {
      route: string;
      enabled: boolean;
      percentage: number;
      whitelist?: string[];
      blacklist?: string[];
    };

    const { route, enabled, percentage, whitelist = [], blacklist = [] } = body;

    // Validate request
    if (!route) {
      return ApiResponseFactory.error('Route is required', 'MISSING_ROUTE');
    }

    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
      return ApiResponseFactory.error('Percentage must be between 0 and 100', 'INVALID_PERCENTAGE');
    }

    const canaryManager = new CanaryToggleManager(env);

    if (enabled) {
      await canaryManager.enableCanary(route, percentage, { whitelist, blacklist });
    } else {
      await canaryManager.disableCanary(route);
    }

    const updatedConfig = await canaryManager.getCanaryConfig(route);

    return ApiResponseFactory.success({
      service: 'canary-management',
      message: `Canary configuration updated for ${route}`,
      timestamp: new Date().toISOString(),
      data: {
        route,
        config: updatedConfig
      }
    });

  } catch (error) {
    console.error('Canary update request failed:', error);
    return ApiResponseFactory.error(
      'Failed to update canary configuration',
      'CANARY_UPDATE_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Handle canary enable request
 */
export async function handleCanaryEnable(request: Request, env: CloudflareEnvironment): Promise<Response> {
  try {
    const url = new URL(request.url);
    const route = url.searchParams.get('route');
    const percentageParam = url.searchParams.get('percentage');
    const percentage = percentageParam ? parseInt(percentageParam, 10) : 10;

    if (!route) {
      return ApiResponseFactory.error('Route parameter is required', 'MISSING_ROUTE');
    }

    const canaryManager = new CanaryToggleManager(env);
    await canaryManager.enableCanary(route, percentage);

    const config = await canaryManager.getCanaryConfig(route);

    return ApiResponseFactory.success({
      service: 'canary-management',
      message: `Canary enabled for ${route} at ${percentage}% rollout`,
      timestamp: new Date().toISOString(),
      data: {
        route,
        config
      }
    });

  } catch (error) {
    console.error('Canary enable request failed:', error);
    return ApiResponseFactory.error(
      'Failed to enable canary',
      'CANARY_ENABLE_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Handle canary disable request
 */
export async function handleCanaryDisable(request: Request, env: CloudflareEnvironment): Promise<Response> {
  try {
    const url = new URL(request.url);
    const route = url.searchParams.get('route');

    if (!route) {
      return ApiResponseFactory.error('Route parameter is required', 'MISSING_ROUTE');
    }

    const canaryManager = new CanaryToggleManager(env);
    await canaryManager.disableCanary(route);

    const config = await canaryManager.getCanaryConfig(route);

    return ApiResponseFactory.success({
      service: 'canary-management',
      message: `Canary disabled for ${route}`,
      timestamp: new Date().toISOString(),
      data: {
        route,
        config
      }
    });

  } catch (error) {
    console.error('Canary disable request failed:', error);
    return ApiResponseFactory.error(
      'Failed to disable canary',
      'CANARY_DISABLE_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Handle canary traffic simulation
 */
export async function handleCanarySimulate(request: Request, env: CloudflareEnvironment): Promise<Response> {
  try {
    const body = await request.json() as {
      route: string;
      user_count?: number;
    };

    const { route, user_count = 100 } = body;

    if (!route) {
      return ApiResponseFactory.error('Route is required', 'MISSING_ROUTE');
    }

    const canaryManager = new CanaryToggleManager(env);
    const config = await canaryManager.getCanaryConfig(route);

    // Simulate traffic distribution
    const simulation = {
      total_users: user_count,
      canary_users: 0,
      stable_users: 0,
      canary_percentage: config.percentage,
      distribution: [] as Array<{
        userId: string;
        isInCanary: boolean;
        reason: string;
      }>
    };

    // Generate mock user IDs for simulation
    for (let i = 0; i < user_count; i++) {
      const mockUserId = `user-${i}`;
      const mockRequest = new Request(`https://example.com${route}`, {
        headers: {
          'X-API-Key': `key-${mockUserId}`,
          'X-Request-ID': `req-${i}`
        }
      });

      const context = await canaryManager.isInCanary(mockRequest, route);

      if (context.isInCanary) {
        simulation.canary_users++;
      } else {
        simulation.stable_users++;
      }

      simulation.distribution.push({
        userId: mockUserId,
        isInCanary: context.isInCanary,
        reason: context.reason || 'unknown'
      });
    }

    return ApiResponseFactory.success({
      service: 'canary-management',
      message: `Traffic simulation completed for ${route}`,
      timestamp: new Date().toISOString(),
      data: {
        route,
        config,
        simulation
      }
    });

  } catch (error) {
    console.error('Canary simulation request failed:', error);
    return ApiResponseFactory.error(
      'Failed to simulate canary traffic',
      'CANARY_SIMULATION_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Canary Management Route Handler
 */
export async function handleCanaryManagementRequest(request: Request, env: CloudflareEnvironment): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route to specific handlers
    if (path === '/api/v1/canary/status') {
      return await handleCanaryStatus(request, env);
    } else if (path === '/api/v1/canary/update') {
      return await handleCanaryUpdate(request, env);
    } else if (path === '/api/v1/canary/enable') {
      return await handleCanaryEnable(request, env);
    } else if (path === '/api/v1/canary/disable') {
      return await handleCanaryDisable(request, env);
    } else if (path === '/api/v1/canary/simulate') {
      return await handleCanarySimulate(request, env);
    } else {
      return ApiResponseFactory.error('Canary management endpoint not found', 'ENDPOINT_NOT_FOUND', {
        available_endpoints: [
          'GET /api/v1/canary/status',
          'POST /api/v1/canary/update',
          'POST /api/v1/canary/enable',
          'POST /api/v1/canary/disable',
          'POST /api/v1/canary/simulate'
        ]
      });
    }

  } catch (error) {
    console.error('Canary management request failed:', error);
    return ApiResponseFactory.error(
      'Canary management request failed',
      'CANARY_MANAGEMENT_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}