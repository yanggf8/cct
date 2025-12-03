/**
 * Health & Monitoring Route Definitions
 * Handles system health, monitoring, and diagnostic endpoints
 */
import { handleHealthCheck, handleModelHealth, handleCronHealth } from '../handlers/index.js';
/**
 * Register all health and monitoring routes
 */
export function registerHealthRoutes(router) {
    // Core health checks
    router.get('/health', handleHealthCheck);
    router.get('/model-health', handleModelHealth);
    router.get('/cron-health', handleCronHealth);
    // Optimized health endpoints
    router.get('/health-optimized', handleHealthCheck);
}
//# sourceMappingURL=health-routes.js.map