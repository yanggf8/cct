// @ts-ignore - Suppressing TypeScript errors

/**
 * Handler Factory Module
 * Standardized handler creation with built-in logging, monitoring, and error handling
 */

import { createLogger } from './logging.js';
import { logBusinessMetric } from './logging.js';
import { CONFIG } from './config.js';
import { ApiResponseFactory } from '../modules/api-v1-responses.js';
import type { CloudflareEnvironment } from '../types.js';

// Type definitions
interface HandlerOptions {
  timeout?: number;
  enableMetrics?: boolean;
  enableAuth?: boolean;
  requiredAuth?: boolean;
}

interface ValidationSchema {
  required?: string[];
  [key: string]: any;
}

interface EnhancedContext extends ExecutionContext {
  requestId: string;
  logger: ReturnType<typeof createLogger>;
  startTime: number;
  userAgent: string;
  cronExecutionId?: string;
  estTime?: Date;
  scheduledTime?: Date;
  validatedBody?: any;
}

interface HandlerFunction<T = Response> {
  (request: Request, env: CloudflareEnvironment, ctx: EnhancedContext): Promise<T>;
}

interface CronHandlerFunction {
  (controller: ScheduledController, env: CloudflareEnvironment, ctx: EnhancedContext): Promise<any>;
}

interface HealthCheckFunction {
  (env: CloudflareEnvironment, ctx: EnhancedContext): Promise<Record<string, any>>;
}

interface APIResponse {
  success: boolean;
  error?: string;
  requestId?: string;
  service?: string;
  timestamp?: string;
  status?: string;
  [key: string]: any;
}

interface CronContext extends ExecutionContext {
  cronExecutionId: string;
  logger: ReturnType<typeof createLogger>;
  estTime: Date;
  scheduledTime: Date;
}

/**
 * Create a standardized handler with built-in logging and monitoring
 */
export function createHandler<T = Response>(
  serviceName: string,
  handlerFn: HandlerFunction<T>,
  options: HandlerOptions = {}
): HandlerFunction<T | Response> {
  const logger = createLogger(serviceName);
  const {
    timeout = (CONFIG as any).TIMEOUTS?.API_REQUEST || 30000,
    enableMetrics = true,
    enableAuth = false,
    requiredAuth = false
  } = options;

  return async (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext): Promise<T | Response> => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    const userAgent = request.headers.get('User-Agent') || 'unknown';

    // Create enhanced context
    const enhancedCtx: EnhancedContext = {
      ...ctx,
      requestId,
      logger,
      startTime,
      userAgent
    };

    try {
      // Log request start
      logger.info(`${serviceName} request started`, {
        requestId,
        method: request.method,
        url: request.url,
        userAgent,
        timestamp: new Date().toISOString()
      });

      // Authentication check if required
      if (enableAuth && requiredAuth) {
        const apiKey = request.headers.get('X-API-Key');
        if (!apiKey || apiKey !== env.WORKER_API_KEY) {
          logger.warn('Unauthorized access attempt', { requestId, userAgent });
          throw new Error('Unauthorized');
        }
      }

      // Execute handler with timeout
      const timeoutPromise = new Promise<never>((_: any, reject: any) =>
        setTimeout(() => reject(new Error(`Handler timeout after ${timeout}ms`)), timeout)
      );

      const result = await Promise.race([
        handlerFn(request, env, enhancedCtx),
        timeoutPromise
      ]);

      // Calculate performance metrics
      const duration = Date.now() - startTime;

      // Log successful completion
      logger.info(`${serviceName} completed successfully`, {
        requestId,
        duration,
        status: 'success',
        timestamp: new Date().toISOString()
      });

      // Track business metrics if enabled
      if (enableMetrics) {
        logBusinessMetric(`${serviceName}_request_duration`, duration, {
          service: serviceName,
          status: 'success',
          requestId
        });

        logBusinessMetric(`${serviceName}_request_count`, 1, {
          service: serviceName,
          status: 'success'
        });

        // Track slow requests
        if (duration > (CONFIG as any).PERFORMANCESLOW_REQUEST_THRESHOLD_MS) {
          logger.warn(`Slow request detected`, {
            requestId,
            service: serviceName,
            duration,
            threshold: (CONFIG as any).PERFORMANCESLOW_REQUEST_THRESHOLD_MS
          });
        }
      }

      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Log error with context
      logger.error(`${serviceName} failed`, {
        requestId,
        error: error.message,
        stack: error.stack,
        duration,
        userAgent,
        timestamp: new Date().toISOString()
      });

      // Track error metrics if enabled
      if (enableMetrics) {
        logBusinessMetric(`${serviceName}_request_count`, 1, {
          service: serviceName,
          status: 'error'
        });

        logBusinessMetric(`${serviceName}_error_rate`, 1, {
          service: serviceName,
          errorType: error.name || 'UnknownError'
        });
      }

      // Return standardized error response using ApiResponseFactory
      let statusCode = 500;
      let errorCode = 'INTERNAL_ERROR';

      if (error.message === 'Unauthorized') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
      } else if (error.message.includes('timeout')) {
        statusCode = 504;
        errorCode = 'TIMEOUT_ERROR';
      } else if (error.message.includes('validation')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (error.message.includes('not found')) {
        statusCode = 404;
        errorCode = 'NOT_FOUND';
      }

      const errorResponse = ApiResponseFactory.error(
        error.message,
        errorCode,
        {
          requestId,
          service: serviceName,
          userAgent,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString()
        }
      );

      return new Response(JSON.stringify(errorResponse), {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        }
      });
    }
  };
}

/**
 * Create a cron handler with specialized cron monitoring
 */
export function createCronHandler(
  serviceName: string,
  cronHandlerFn: CronHandlerFunction
): (controller: ScheduledController, env: CloudflareEnvironment, ctx: ExecutionContext) => Promise<any> {
  const logger = createLogger(`cron-${serviceName}`);

  return async (controller: ScheduledController, env: CloudflareEnvironment, ctx: ExecutionContext): Promise<any> => {
    const cronExecutionId = `cron_${Date.now()}`;
    const scheduledTime = new Date(controller.scheduledTime);
    const estTime = new Date(scheduledTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const startTime = Date.now();

    try {
      logger.info(`Cron ${serviceName} started`, {
        cronExecutionId,
        scheduledTime: scheduledTime.toISOString(),
        estTime: estTime.toISOString(),
        service: serviceName
      });

      const result = await cronHandlerFn(controller, env, {
        ...ctx,
        cronExecutionId,
        logger,
        estTime,
        scheduledTime
      } as EnhancedContext);

      const duration = Date.now() - startTime;

      logger.info(`Cron ${serviceName} completed`, {
        cronExecutionId,
        duration,
        status: 'success',
        service: serviceName
      });

      // Track cron execution metrics
      logBusinessMetric('cron_execution_duration', duration, {
        service: serviceName,
        status: 'success',
        cronExecutionId
      });

      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error(`Cron ${serviceName} failed`, {
        cronExecutionId,
        error: error.message,
        duration,
        service: serviceName
      });

      // Track cron failure metrics
      logBusinessMetric('cron_execution_count', 1, {
        service: serviceName,
        status: 'error'
      });

      throw error; // Re-throw for cron system handling
    }
  };
}

/**
 * Create an API handler with built-in request validation
 */
export function createAPIHandler(
  serviceName: string,
  apiHandlerFn: HandlerFunction,
  validationSchema: ValidationSchema | null = null
): HandlerFunction {
  return createHandler(serviceName, async (request: Request, env: CloudflareEnvironment, ctx: EnhancedContext): Promise<Response> => {
    // Validate request if schema provided
    if (validationSchema && request.method === 'POST') {
      try {
        const body = await request.json();
        // Simple validation - can be enhanced with proper schema validation
        if (validationSchema.required) {
          for (const field of validationSchema.required) {
            if (!(field in (body as any))) {
              throw new Error(`Missing required field: ${field}`);
            }
          }
        }
        ctx.validatedBody = body;
      } catch (error: any) {
        throw new Error(`Request validation failed: ${(error instanceof Error ? error.message : String(error))}`);
      }
    }

    return await apiHandlerFn(request, env, ctx);
  }, {
    enableMetrics: true,
    enableAuth: true
  });
}

/**
 * Create a health check handler with system diagnostics
 */
export function createHealthHandler(
  serviceName: string,
  healthCheckFn: HealthCheckFunction
): HandlerFunction {
  return createHandler(serviceName, async (request: Request, env: CloudflareEnvironment, ctx: EnhancedContext): Promise<Response> => {
    const healthData = await healthCheckFn(env, ctx);

    const healthResponse: APIResponse = {
      success: true,
      status: 'healthy',
      service: serviceName,
      timestamp: new Date().toISOString(),
      requestId: ctx.requestId,
      ...healthData
    };

    return new Response(JSON.stringify(healthResponse), {
      headers: { 'Content-Type': 'application/json' }
    });
  }, {
    enableMetrics: true,
    timeout: (CONFIG as any).TIMEOUTSKV_OPERATION
  });
}

/**
 * Create a batch handler for processing multiple items
 */
export function createBatchHandler<T = any>(
  serviceName: string,
  batchHandlerFn: (items: T[], env: CloudflareEnvironment, ctx: EnhancedContext) => Promise<any>,
  options: {
    maxBatchSize?: number;
    timeout?: number;
    enableMetrics?: boolean;
  } = {}
): HandlerFunction {
  const {
    maxBatchSize = 100,
    timeout = (CONFIG as any).TIMEOUTS?.BATCH_OPERATION || 30000,
    enableMetrics = true
  } = options;

  return createHandler(serviceName, async (request: Request, env: CloudflareEnvironment, ctx: EnhancedContext): Promise<Response> => {
    const body = await request.json() as { items: T[] };
    const items = body.items || [];

    if (items.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No items provided for batch processing'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (items.length > maxBatchSize) {
      return new Response(JSON.stringify({
        success: false,
        error: `Batch size exceeds maximum of ${maxBatchSize} items`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    (ctx as any).loggerinfo(`Processing batch of ${items.length} items`, {
      requestId: ctx.requestId,
      service: serviceName,
      batchSize: items.length
    });

    const results = await batchHandlerFn(items, env, ctx);

    return new Response(JSON.stringify({
      success: true,
      requestId: ctx.requestId,
      processedItems: items.length,
      results,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }, {
    enableMetrics,
    timeout
  });
}

/**
 * Create a cached handler with built-in caching support
 */
export function createCachedHandler<T = any>(
  serviceName: string,
  handlerFn: HandlerFunction<T>,
  options: {
    cacheKey?: (request: Request) => string;
    cacheTTL?: number;
    enableMetrics?: boolean;
  } = {}
): HandlerFunction<T | Response> {
  const {
    cacheKey = (req: Request) => req.url,
    cacheTTL = (CONFIG as any).CACHE?.DEFAULT_TTL || 300,
    enableMetrics = true
  } = options;

  return createHandler(serviceName, async (request: Request, env: CloudflareEnvironment, ctx: EnhancedContext): Promise<T | Response> => {
    const key = cacheKey(request);

    // Try to get from cache first
    if (env.CACHE) {
      try {
        const cached = await (env as any).CACHE.get(key, 'json');
        if (cached) {
          (ctx as any).logger.debug(`Cache hit for ${serviceName}`, {
            requestId: ctx.requestId,
            cacheKey: key
          });

          if (enableMetrics) {
            logBusinessMetric(`${serviceName}_cache_hit`, 1, {
              service: serviceName,
              cacheKey: key
            });
          }

          return cached;
        }
      } catch (error: any) {
        (ctx as any).loggerwarn(`Cache retrieval failed for ${serviceName}`, {
          requestId: ctx.requestId,
          cacheKey: key,
          error: error.message
        });
      }
    }

    // Cache miss - execute handler
    (ctx as any).loggerdebug(`Cache miss for ${serviceName}`, {
      requestId: ctx.requestId,
      cacheKey: key
    });

    const result = await handlerFn(request, env, ctx);

    // Store in cache if successful
    if (env.CACHE && result instanceof Response && (result as any).ok) {
      try {
        const resultData = await (result as any).clone().text();
        await (env as any).CACHE.put(key, resultData, { expirationTtl: cacheTTL });

        if (enableMetrics) {
          logBusinessMetric(`${serviceName}_cache_miss`, 1, {
            service: serviceName,
            cacheKey: key
          });
        }
      } catch (error: any) {
        (ctx as any).loggerwarn(`Cache storage failed for ${serviceName}`, {
          requestId: ctx.requestId,
          cacheKey: key,
          error: error.message
        });
      }
    }

    return result;
  }, {
    enableMetrics
  });
}

// Export types for external use
export type {
  HandlerOptions,
  ValidationSchema,
  EnhancedContext,
  HandlerFunction,
  CronHandlerFunction,
  HealthCheckFunction,
  APIResponse,
  CronContext
};