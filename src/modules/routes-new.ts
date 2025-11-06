/**
 * Modular HTTP Request Routing
 * Replaces monolithic switch statement with type-safe routing architecture
 */

import { createRouter, Router } from './router/index.js';
import { createLogger } from './logging.js';
import { PerformanceMonitor, BusinessMetrics } from './monitoring';

// Import route registration functions
import { registerAnalysisRoutes } from './routes/analysis-routes.js';
import { registerReportRoutes } from './routes/report-routes.js';
import { registerHealthRoutes } from './routes/health-routes.js';
import { registerAdminRoutes } from './routes/admin-routes.js';
// Facebook routes removed - migrated to Chrome web notifications
import { registerDataRoutes } from './routes/data-routes.js';
import { registerRealTimeRoutes } from './routes/real-time-routes.js';
import type { CloudflareEnvironment } from '../types.js';

/**
 * Create and configure the application router
 */
export function createAppRouter(): Router {
  const router = createRouter();

  // Register all route modules
  registerAnalysisRoutes(router);
  registerReportRoutes(router);
  registerHealthRoutes(router);
  registerAdminRoutes(router);
  registerDataRoutes(router);
  registerRealTimeRoutes(router);

  return router;
}

/**
 * Main HTTP request handler with routing
 */
export async function handleHttpRequest(
  request: Request,
  env: CloudflareEnvironment,
  ctx: ExecutionContext
): Promise<Response> {
  // Initialize logging
  const logger = createLogger('request-handler');

  // Start performance monitoring
  const perfMonitor = PerformanceMonitor;
  const startTime = Date.now();

  try {
    const url = new URL((request as any).url);
    logger.info('Incoming request', {
      method: request.method,
      pathname: url.pathname
    });

    // Create router instance
    const router = createAppRouter();

    // Handle request through router
    const response = await router.handle(request, env, ctx);

    // Record metrics
    const duration = Date.now() - startTime;
    BusinessMetrics.apiRequest(url.pathname, request.method, (response as any).status, duration);

    logger.info('Request completed', {
      status: (response as any).status,
      duration: `${duration.toFixed(2)}ms`
    });

    return response;

  } catch (error: any) {
    logger.error('Unhandled error in request handler', {
      error: (error instanceof Error ? error.message : String(error)),
      stack: (error instanceof Error ? error.stack : undefined)
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Request validation middleware
 */
export function validateRequest(apiKey: string) {
  return async (
    request: Request,
    env: CloudflareEnvironment,
    ctx: ExecutionContext,
    next: () => Promise<Response>
  ): Promise<Response> => {
    const providedKey = request.headers.get('X-API-Key');

    if (providedKey !== apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid or missing API key'
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return next();
  };
}
