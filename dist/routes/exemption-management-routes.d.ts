/**
 * Exemption Management Routes - Admin endpoints for managing production exemptions
 * Protected endpoints for tracking and managing production exemptions
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Handle exemption report request
 */
export declare function handleExemptionReport(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle exemption validation request
 */
export declare function handleExemptionValidation(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle exemption creation request
 */
export declare function handleExemptionCreate(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle exemption revocation request
 */
export declare function handleExemptionRevoke(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle exemption maintenance tasks
 */
export declare function handleExemptionMaintenance(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Generate weekly exemption report
 */
export declare function handleWeeklyReport(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Exemption Management Route Handler
 */
export declare function handleExemptionManagementRequest(request: Request, env: CloudflareEnvironment): Promise<Response>;
//# sourceMappingURL=exemption-management-routes.d.ts.map