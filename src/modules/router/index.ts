/**
 * Modular Router Infrastructure
 * Replaces monolithic switch statement with type-safe routing
 */

import { createLogger } from '../logging.js';
import type { CloudflareEnvironment } from '../../types.js';

const logger = createLogger('router');

export type RouteHandler = (
  request: Request,
  env: CloudflareEnvironment,
  ctx: ExecutionContext
) => Promise<Response> | Response;

export type Middleware = (
  request: Request,
  env: CloudflareEnvironment,
  ctx: ExecutionContext,
  next: () => Promise<Response>
) => Promise<Response>;

export interface RouteConfig {
  path: string;
  handler: RouteHandler;
  method?: string;
  middleware?: Middleware[];
}

/**
 * Modern Router for Cloudflare Workers
 */
export class Router {
  private routes: Map<string, RouteHandler> = new Map();
  private globalMiddleware: Middleware[] = [];

  /**
   * Register a route handler
   */
  register(path: string, handler: RouteHandler, method?: string): void {
    const key = method ? `${method}:${path}` : path;
    this.routes.set(key, handler);
    logger.debug('Route registered', { path, method: method || 'ALL' });
  }

  /**
   * Register GET route
   */
  get(path: string, handler: RouteHandler): void {
    this.register(path, handler, 'GET');
  }

  /**
   * Register POST route
   */
  post(path: string, handler: RouteHandler): void {
    this.register(path, handler, 'POST');
  }

  /**
   * Register global middleware
   */
  use(middleware: Middleware): void {
    this.globalMiddleware.push(middleware);
    logger.debug('Global middleware registered');
  }

  /**
   * Handle incoming request
   */
  async handle(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext = {}): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // Try method-specific route first
    const methodKey = `${method}:${pathname}`;
    let handler = this.routes.get(methodKey);

    // Fall back to method-agnostic route
    if (!handler) {
      handler = this.routes.get(pathname);
    }

    if (!handler) {
      logger.warn('Route not found', { pathname, method });
      return new Response('Not Found', { status: 404 });
    }

    // Build middleware chain
    const executeHandler = async (): Promise<Response> => {
      return await handler(request, env, ctx);
    };

    // Apply middleware in reverse order
    let finalHandler = executeHandler;
    for (let i = this.globalMiddleware.length - 1; i >= 0; i--) {
      const middleware = this.globalMiddleware[i];
      const nextHandler = finalHandler;
      finalHandler = () => middleware(request, env, ctx, nextHandler);
    }

    try {
      return await finalHandler();
    } catch (error: any) {
      logger.error('Route handler error', {
        pathname,
        method,
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
   * Get all registered routes (for debugging)
   */
  getRoutes(): string[] {
    return Array.from(this.routes.keys());
  }
}

/**
 * Factory function to create router instance
 */
export function createRouter(): Router {
  return new Router();
}
