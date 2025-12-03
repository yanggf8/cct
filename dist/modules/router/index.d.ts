/**
 * Modular Router Infrastructure
 * Replaces monolithic switch statement with type-safe routing
 */
import type { CloudflareEnvironment } from '../../types.js';
export type RouteHandler = (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext) => Promise<Response> | Response;
export type Middleware = (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext, next: () => Promise<Response>) => Promise<Response>;
export interface RouteConfig {
    path: string;
    handler: RouteHandler;
    method?: string;
    middleware?: Middleware[];
}
/**
 * Modern Router for Cloudflare Workers
 */
export declare class Router {
    private routes;
    private globalMiddleware;
    /**
     * Register a route handler
     */
    register(path: string, handler: RouteHandler, method?: string): void;
    /**
     * Register GET route
     */
    get(path: string, handler: RouteHandler): void;
    /**
     * Register POST route
     */
    post(path: string, handler: RouteHandler): void;
    /**
     * Register global middleware
     */
    use(middleware: Middleware): void;
    /**
     * Handle incoming request
     */
    handle(request: Request, env: CloudflareEnvironment, ctx?: ExecutionContext): Promise<Response>;
    /**
     * Get all registered routes (for debugging)
     */
    getRoutes(): string[];
}
/**
 * Factory function to create router instance
 */
export declare function createRouter(): Router;
//# sourceMappingURL=index.d.ts.map