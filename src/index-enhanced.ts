/**
 * Enhanced Worker Entry Point with Data Access Improvements
 * Integrates simplified enhanced DAL and migration management
 *
 * This is the enhanced version of index.js with all improvements from the
 * Data Access Improvement Plan (5 phases complete)
 */

import { createEnhancedRequestHandler } from './modules/enhanced-request-handler.js';
import { handleScheduledEvent } from './modules/scheduler.js';
import { createLogger } from './modules/logging.js';
import type { CloudflareEnvironment } from './types.js';

const logger = createLogger('worker-enhanced');

interface EnhancedWorkerAPI {
  scheduled(event: any, env: CloudflareEnvironment, ctx: ExecutionContext): Promise<any>;
  fetch(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext): Promise<Response>;
}

interface SystemStatus {
  status: 'operational' | 'error';
  version: string;
  timestamp: string;
  dal?: any;
  migration?: any;
  error?: string;
}

export default {
  /**
   * Handle scheduled cron events (unchanged from original)
   */
  async scheduled(
    controller: { scheduledTime: number; cron: string },
    env: CloudflareEnvironment,
    ctx: ExecutionContext
  ): Promise<any> {
    try {
      // Initialize logging
      await import('./modules/logging.js').then(m => m.initLogging(env));

      logger.info('Scheduled event started', {
        scheduledTime: controller.scheduledTime,
        cron: controller.cron
      });

      const result = await handleScheduledEvent(controller, env, ctx);

      logger.info('Scheduled event completed', {
        duration: Date.now() - controller.scheduledTime
      });

      return result;

    } catch (error: any) {
      logger.error('Scheduled event failed', {
        error: error.message,
        stack: error.stack,
        scheduledTime: controller.scheduledTime,
        cron: controller.cron
      });

      throw error;
    }
  },

  /**
   * Handle HTTP requests with enhanced data access system
   */
  async fetch(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext): Promise<Response> {
    // Initialize enhanced system
    const startTime = Date.now();

    try {
      // Initialize logging
      await import('./modules/logging.js').then(m => m.initLogging(env));

      // Create enhanced request handler (cached across requests)
      let enhancedHandler = (global as any).enhancedRequestHandler;
      if (!enhancedHandler) {
        enhancedHandler = createEnhancedRequestHandler(env);
        (global as any).enhancedRequestHandler = enhancedHandler;

        logger.info('Enhanced request handler initialized', {
          environment: env.ENVIRONMENT || 'production',
          version: '2.0-enhanced'
        });
      }

      // Handle request with enhanced system
      const response = await enhancedHandler.handleRequest(request, ctx);

      // Add enhanced system headers
      response.headers.set('X-Worker-Version', '2.0-enhanced');
      response.headers.set('X-Response-Time', String(Date.now() - startTime));
      response.headers.set('X-Timestamp', new Date().toISOString());

      logger.debug('Request completed', {
        method: request.method,
        url: request.url,
        status: response.status,
        responseTime: Date.now() - startTime,
        enhancedSystem: true
      });

      return response;

    } catch (error: any) {
      // Enhanced error handling
      logger.error('Request failed', {
        method: request.method,
        url: request.url,
        error: error.message,
        stack: error.stack,
        responseTime: Date.now() - startTime
      });

      const errorResponse = new Response(JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString(),
        enhanced_system: true,
        request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }, null, 2), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Worker-Version': '2.0-enhanced',
          'X-Error-Id': `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      });

      return errorResponse;
    }
  }
} as EnhancedWorkerAPI;

/**
 * Development helper: Reset enhanced handler cache
 */
export function resetEnhancedHandler(): void {
  if ((global as any).enhancedRequestHandler) {
    delete (global as any).enhancedRequestHandler;
    logger.info('Enhanced request handler cache reset');
  }
}

/**
 * Development helper: Get system status
 */
export async function getSystemStatus(env: CloudflareEnvironment): Promise<SystemStatus> {
  try {
    const handler = createEnhancedRequestHandler(env);

    // Get DAL status
    const dalStats = handler.dal.getPerformanceStats();

    // Get migration status
    const migrationStats = await handler.migrationManager.getMigrationStatistics();

    return {
      status: 'operational',
      version: '2.0-enhanced',
      timestamp: new Date().toISOString(),
      dal: dalStats,
      migration: migrationStats
    };
  } catch (error: any) {
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}