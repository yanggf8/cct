/**
 * Integration Test Routes (API v1)
 * Handles all integration testing endpoints
 * Provides comprehensive testing and monitoring capabilities
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Handle all integration test routes
 */
export declare function handleIntegrationTestRoutes(request: Request, env: CloudflareEnvironment, path: string, headers: Record<string, string>): Promise<Response>;
/**
 * Handle full test suite execution
 * POST /api/v1/integration-tests/run-full
 */
declare function handleRunFullTestSuite(request: Request, env: CloudflareEnvironment, headers: Record<string, string>, requestId: string): Promise<Response>;
/**
 * Handle quick health check
 * GET /api/v1/integration-tests/health-check
 */
declare function handleHealthCheck(request: Request, env: CloudflareEnvironment, headers: Record<string, string>, requestId: string): Promise<Response>;
/**
 * Handle test status request
 * GET /api/v1/integration-tests/status
 */
declare function handleTestStatus(request: Request, env: CloudflareEnvironment, headers: Record<string, string>, requestId: string): Promise<Response>;
/**
 * Integration test routes export
 */
export declare const integrationTestRoutes: {
    '/api/v1/integration-tests/run-full': typeof handleRunFullTestSuite;
    '/api/v1/integration-tests/health-check': typeof handleHealthCheck;
    '/api/v1/integration-tests/status': typeof handleTestStatus;
};
export default integrationTestRoutes;
//# sourceMappingURL=integration-test-routes.d.ts.map