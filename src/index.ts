/**
 * Production Worker Entry Point
 * Handles all routes, scheduled events, and production infrastructure
 */

import { createEnhancedRequestHandler } from './modules/enhanced-request-handler.js';
import { handleScheduledEvent } from './modules/scheduler.js';
import { createLogger } from './modules/logging.js';
import type { CloudflareEnvironment } from './types.js';

const logger = createLogger('worker');

export default {
  async fetch(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext): Promise<Response> {
    try {
      const handler = createEnhancedRequestHandler(env);
      return await handler.handleRequest(request, ctx);
    } catch (error) {
      logger.error('Worker error:', { error: error instanceof Error ? error.message : String(error) });
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  async scheduled(event: any, env: CloudflareEnvironment, ctx: ExecutionContext): Promise<void> {
    try {
      await handleScheduledEvent(event, env, ctx);
    } catch (error) {
      logger.error('Scheduled event error:', { error: error instanceof Error ? error.message : String(error) });
    }
  }
};

// Export DO classes for wrangler
export { CacheDurableObject } from './modules/cache-durable-object.js';
export { SimpleCacheDO } from './modules/simple-cache-do.js';
export { RateLimiterDO } from './modules/rate-limiter-do.js';
export { PortfolioDO } from './durable-objects/portfolio-do.js';
