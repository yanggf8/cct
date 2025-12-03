/**
 * Modular HTTP Request Routing
 * Replaces monolithic switch statement with type-safe routing architecture
 */
import { Router } from './router/index.js';
import type { CloudflareEnvironment } from '../types.js';
/**
 * Create and configure the application router
 */
export declare function createAppRouter(): Router;
/**
 * Main HTTP request handler with routing
 */
export declare function handleHttpRequest(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext): Promise<Response>;
/**
 * Request validation middleware
 */
export declare function validateRequest(apiKey: string): (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext, next: () => Promise<Response>) => Promise<Response>;
//# sourceMappingURL=routes-new.d.ts.map