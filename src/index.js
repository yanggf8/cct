/**
 * TFT Trading System - Main Entry Point
 * Modular Cloudflare Worker Architecture
 */

import { handleScheduledEvent } from './modules/scheduler.js';
import { handleHttpRequest } from './modules/routes.js';

export default {
  /**
   * Handle scheduled cron events
   */
  async scheduled(controller, env, ctx) {
    return handleScheduledEvent(controller, env, ctx);
  },

  /**
   * Handle HTTP requests
   */
  async fetch(request, env, ctx) {
    return handleHttpRequest(request, env, ctx);
  }
};