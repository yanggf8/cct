/**
 * Modular Router Infrastructure
 * Replaces monolithic switch statement with type-safe routing
 */
import { createLogger } from '../logging.js';
const logger = createLogger('router');
/**
 * Modern Router for Cloudflare Workers
 */
export class Router {
    constructor() {
        this.routes = new Map();
        this.globalMiddleware = [];
    }
    /**
     * Register a route handler
     */
    register(path, handler, method) {
        const key = method ? `${method}:${path}` : path;
        this.routes.set(key, handler);
        logger.debug('Route registered', { path, method: method || 'ALL' });
    }
    /**
     * Register GET route
     */
    get(path, handler) {
        this.register(path, handler, 'GET');
    }
    /**
     * Register POST route
     */
    post(path, handler) {
        this.register(path, handler, 'POST');
    }
    /**
     * Register global middleware
     */
    use(middleware) {
        this.globalMiddleware.push(middleware);
        logger.debug('Global middleware registered');
    }
    /**
     * Handle incoming request
     */
    async handle(request, env, ctx) {
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
        const executeHandler = async () => {
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
        }
        catch (error) {
            logger.error('Route handler error', {
                pathname,
                method,
                error: (error instanceof Error ? error.message : String(error)),
                stack: error.stack
            });
            return new Response(JSON.stringify({
                success: false,
                error: 'Internal server error',
                message: error.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    /**
     * Get all registered routes (for debugging)
     */
    getRoutes() {
        return Array.from(this.routes.keys());
    }
}
/**
 * Factory function to create router instance
 */
export function createRouter() {
    return new Router();
}
//# sourceMappingURL=index.js.map