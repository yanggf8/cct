/**
 * Data Route Definitions
 * Handles data retrieval and fact table endpoints
 */
import { handleGetResults, handleFactTable } from '../handlers/index.js';
/**
 * Register all data retrieval routes
 */
export function registerDataRoutes(router) {
    // Data retrieval
    router.get('/results', handleGetResults);
    router.get('/fact-table', handleFactTable);
}
//# sourceMappingURL=data-routes.js.map