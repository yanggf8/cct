/**
 * Data Route Definitions
 * Handles data retrieval and fact table endpoints
 */

import { Router } from '../router/index.js';
import {
  handleGetResults,
  handleFactTable
} from '../handlers/index.js';

/**
 * Register all data retrieval routes
 */
export function registerDataRoutes(router: Router): void {
  // Data retrieval
  router.get('/results', handleGetResults);
  router.get('/fact-table', handleFactTable);
}
