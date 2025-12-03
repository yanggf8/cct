/**
 * Health Check and Monitoring HTTP Request Handlers
 * Handles system health, monitoring, and diagnostic endpoints
 */
import type { CloudflareEnvironment } from '../../types';
/**
 * Handle basic health check requests
 */
export declare const handleHealthCheck: import("../handler-factory.js").HandlerFunction<Response>;
/**
 * Handle model health check requests
 */
export declare function handleModelHealth(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle debug environment requests
 */
export declare function handleDebugEnvironment(request: Request, env: CloudflareEnvironment): Promise<Response>;
//# sourceMappingURL=health-handlers.d.ts.map