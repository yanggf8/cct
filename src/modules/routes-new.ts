/**
 * Modular HTTP Request Routing
 * Replaces monolithic switch statement with type-safe routing architecture
 */

import { createRouter, Router } from './router/index.js';
import { createRequestLogger, initLogging } from './logging.js';
import { PerformanceMonitor, BusinessMetrics } from './monitoring';

// Import route registration functions
import { registerAnalysisRoutes } from './routes/analysis-routes.js';
import { registerReportRoutes } from './routes/report-routes.js';
import { registerHealthRoutes } from './routes/health-routes.js';
import { registerAdminRoutes } from './routes/admin-routes.js';
import { registerFacebookRoutes } from './routes/facebook-routes.js';
import { registerDataRoutes } from './routes/data-routes.js';
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
  registerFacebookRoutes(router);
  registerDataRoutes(router);

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
  initLogging(env);
  const logger = createRequestLogger(request);

  // Start performance monitoring
  const perfMonitor = new PerformanceMonitor();

  try {
    const url = new URL(request.url);
    logger.info('Incoming request', {
      method: request.method,
      pathname: url.pathname
    });

    // Create router instance
    const router = createAppRouter();

    // Handle request through router
    const response = await router.handle(request, env, ctx);

    // Record metrics
    const duration = perfMonitor.end();
    BusinessMetrics.recordHttpRequest(url.pathname, response.status, duration);

    logger.info('Request completed', {
      status: response.status,
      duration: `${duration.toFixed(2)}ms`
    });

    return response;

  } catch (error: any) {
    logger.error('Unhandled error in request handler', {
      error: error.message,
      stack: error.stack
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
    const providedKey = request.headers.get('X-API-KEY');

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
