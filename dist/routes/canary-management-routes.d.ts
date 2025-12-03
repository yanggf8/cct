/**
 * Canary Management Routes - Admin endpoints for managing canary rollouts
 * Protected endpoints for configuring feature flags and monitoring canary status
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Handle canary status request
 */
export declare function handleCanaryStatus(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle canary configuration update
 */
export declare function handleCanaryUpdate(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle canary enable request
 */
export declare function handleCanaryEnable(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle canary disable request
 */
export declare function handleCanaryDisable(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle canary traffic simulation
 */
export declare function handleCanarySimulate(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Canary Management Route Handler
 */
export declare function handleCanaryManagementRequest(request: Request, env: CloudflareEnvironment): Promise<Response>;
//# sourceMappingURL=canary-management-routes.d.ts.map