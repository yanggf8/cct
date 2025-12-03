/**
 * Production Guards Status Routes
 *
 * Provides endpoints to monitor and verify production guards configuration
 * Supports operational monitoring and health checks for strict mode
 *
 * @author Sprint 1-B - Macro/FRED Strict Mode Implementation
 * @since 2025-01-XX
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Get production guards configuration status
 */
export declare function handleProductionGuardsStatus(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Validate production guards configuration
 */
export declare function handleProductionGuardsValidate(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Health check for production guards
 */
export declare function handleProductionGuardsHealthCheck(request: Request, env: CloudflareEnvironment): Promise<Response>;
//# sourceMappingURL=production-guards-routes.d.ts.map