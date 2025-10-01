/**
 * Facebook & Social Media Route Definitions
 * Handles Facebook Messenger integration endpoints
 */

import { Router } from '../router/index.js';
import {
  handleFacebookTest,
  handleTestAllFacebookMessages,
  handleWeeklyReport,
  handleFridayMarketCloseReport,
  handleRealFacebookMessage
} from '../handlers/index.js';

/**
 * Register all Facebook/social media routes
 */
export function registerFacebookRoutes(router: Router): void {
  // Facebook testing
  router.get('/test-facebook', handleFacebookTest);
  router.get('/test-all-facebook', handleTestAllFacebookMessages);

  // Facebook message endpoints
  router.get('/weekly-report', handleWeeklyReport);
  router.get('/friday-market-close', handleFridayMarketCloseReport);
  router.get('/send-real-facebook', handleRealFacebookMessage);
}
