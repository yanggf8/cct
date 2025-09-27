/**
 * Handler Factory Module
 * Standardized handler creation with built-in logging, monitoring, and error handling
 */

import { createLogger } from './logging.js';
import { logBusinessMetric } from './logging.js';
import { CONFIG } from './config.js';

/**
 * Create a standardized handler with built-in logging and monitoring
 */
export function createHandler(serviceName, handlerFn, options = {}) {
  const logger = createLogger(serviceName);
  const {
    timeout = CONFIG.TIMEOUTS.API_REQUEST,
    enableMetrics = true,
    enableAuth = false,
    requiredAuth = false
  } = options;

  return async (request, env, ctx) => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    const userAgent = request.headers.get('User-Agent') || 'unknown';

    // Create enhanced context
    const enhancedCtx = {
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
        const apiKey = request.headers.get('X-API-KEY');
        if (!apiKey || apiKey !== env.WORKER_API_KEY) {
          logger.warn('Unauthorized access attempt', { requestId, userAgent });
          throw new Error('Unauthorized');
        }
      }

      // Execute handler with timeout
      const timeoutPromise = new Promise((_, reject) =>
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
        if (duration > CONFIG.PERFORMANCE.SLOW_REQUEST_THRESHOLD_MS) {
          logger.warn(`Slow request detected`, {
            requestId,
            service: serviceName,
            duration,
            threshold: CONFIG.PERFORMANCE.SLOW_REQUEST_THRESHOLD_MS
          });
        }
      }

      return result;

    } catch (error) {
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

      // Return standardized error response
      const statusCode = error.message === 'Unauthorized' ? 401 :
                        error.message.includes('timeout') ? 504 : 500;

      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        requestId,
        service: serviceName,
        timestamp: new Date().toISOString()
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
}

/**
 * Create a cron handler with specialized cron monitoring
 */
export function createCronHandler(serviceName, cronHandlerFn) {
  const logger = createLogger(`cron-${serviceName}`);

  return async (controller, env, ctx) => {
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
      });

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

    } catch (error) {
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
export function createAPIHandler(serviceName, apiHandlerFn, validationSchema = null) {
  return createHandler(serviceName, async (request, env, ctx) => {
    // Validate request if schema provided
    if (validationSchema && request.method === 'POST') {
      try {
        const body = await request.json();
        // Simple validation - can be enhanced with proper schema validation
        if (validationSchema.required) {
          for (const field of validationSchema.required) {
            if (!(field in body)) {
              throw new Error(`Missing required field: ${field}`);
            }
          }
        }
        ctx.validatedBody = body;
      } catch (error) {
        throw new Error(`Request validation failed: ${error.message}`);
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
export function createHealthHandler(serviceName, healthCheckFn) {
  return createHandler(serviceName, async (request, env, ctx) => {
    const healthData = await healthCheckFn(env, ctx);

    return new Response(JSON.stringify({
      success: true,
      status: 'healthy',
      service: serviceName,
      timestamp: new Date().toISOString(),
      requestId: ctx.requestId,
      ...healthData
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }, {
    enableMetrics: true,
    timeout: CONFIG.TIMEOUTS.KV_OPERATION
  });
}