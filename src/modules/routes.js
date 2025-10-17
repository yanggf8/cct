/**
 * HTTP Request Routing Module
 * Enhanced with modular handlers and structured logging
 */

import { handleWeeklyAnalysisPage, handleWeeklyDataAPI } from './weekly-analysis.js';
import { handleHomeDashboardPage } from './home-dashboard.js';
import { handleSectorRotationDashboardPage } from './sector-rotation-dashboard.js';
import { servePredictiveAnalyticsDashboard } from './predictive-analytics-dashboard.js';
import { createRequestLogger, initLogging } from './logging.js';
import { PerformanceMonitor, BusinessMetrics } from './monitoring.js';

// Import modular handlers
import {
  handleManualAnalysis,
  handleEnhancedFeatureAnalysis,
  handleIndependentTechnicalAnalysis,
  handlePerSymbolAnalysis,
  handleSentimentTest,
  handleGetResults,
  handleFactTable,
  handleCronHealth,
  handleKVDebug,
  handleKVWriteTest,
  handleKVReadTest,
  handleKVGet,
  handleKVAnalysisWriteTest,
  handleKVAnalysisReadTest,
  handleHealthCheck,
  handleModelHealth,
  handleDebugEnvironment,
  handleWeeklyReview,
  handleDailySummaryAPI,
  handleDailySummaryPageRequest,
  handleBackfillDailySummaries,
  handleVerifyBackfill,
  handleGenerateMorningPredictions,
  handleStatusManagement,
  handleKVVerificationTest,
  handleProfessionalDashboard
} from './handlers/index.js';

// Import comprehensive report handlers
import { handlePreMarketBriefing, handleIntradayCheck, handleEndOfDaySummary } from './handlers/index.js';

// Import decomposed handler examples
import { handleIntradayCheckDecomposed } from './handlers/intraday-decomposed.js';

// Import optimization test endpoints (disabled for now)
// import {
//   handleOptimizationTest,
//   handleKPITest,
//   handleErrorTest,
//   handleOptimizedHealth,
//   handlePerformanceTest,
//   handleAlertTest,
//   handleEnhancementStatus
// } from './test-optimization-endpoint.js';

// Legacy handlers that haven't been modularized yet
import {
  handleFridayMondayPredictionsReport,
  handleFridayMarketCloseReport,
  handleHighConfidenceTest,
  handleKVCleanup,
  handleDebugWeekendMessage,
  handleSentimentDebugTest,
  handleModelScopeTest,
  handleTestLlama,
  handleR2Upload,
  handleFacebookTest
} from './handlers.js';

// Import web notification handlers
import {
  handleNotificationSubscription,
  handleNotificationUnsubscription,
  handleNotificationPreferences,
  handleNotificationHistory,
  handleTestNotification,
  handleNotificationStatus
} from './handlers/web-notification-handlers.js';

// Import new v1 API router
import { handleApiV1Request, handleApiV1CORS } from '../routes/api-v1.js';

// Import sector rotation routes
import { handleSectorRoute } from '../routes/sector-routes-simple.js';


/**
 * Serve static files for critical assets
 */
async function serveStaticFile(pathname) {
  // Security check - prevent directory traversal
  if (pathname.includes('..') || pathname.includes('//')) {
    return new Response('Forbidden', { status: 403 });
  }

  // Only handle specific critical static files that we need
  if (pathname === '/js/api-client.js') {
    // Return a basic API client implementation
    const apiClientJS = `
// CCT API Client for Trading Platform
console.log('CCT API Client module loaded');

class CCTApiClient {
    constructor() {
        this.baseUrl = '';
        this.cache = new Map();
    }

    async getSectorSnapshot() {
        try {
            const response = await fetch('/api/v1/sectors/snapshot');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Failed to fetch sector snapshot:', error);
            throw error;
        }
    }

    async get(endpoint) {
        try {
            const response = await fetch(this.baseUrl + endpoint);
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
}

// Initialize global API client
window.cctApi = new CCTApiClient();
console.log('CCT API Client initialized');
`;

    return new Response(apiClientJS, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  if (pathname === '/js/web-notifications.js') {
    // Return a basic web notifications implementation
    const webNotificationsJS = `
// Web Notifications System for CCT Trading Platform
console.log('Web Notifications module loaded');

// Notification System
class WebNotificationSystem {
    constructor() {
        this.isSupported = 'Notification' in window;
        this.permission = this.isSupported ? Notification.permission : 'denied';
        this.statistics = {
            preMarket: { sent: 0, failed: 0 },
            intraday: { sent: 0, failed: 0 },
            endOfDay: { sent: 0, failed: 0 },
            weeklyReview: { sent: 0, failed: 0 }
        };
    }

    async requestPermission() {
        if (!this.isSupported) {
            console.warn('Notifications not supported in this browser');
            return false;
        }

        if (this.permission === 'default') {
            this.permission = await Notification.requestPermission();
        }

        return this.permission === 'granted';
    }

    async sendNotification(title, options = {}) {
        if (!this.isSupported || this.permission !== 'granted') {
            console.warn('Notification permission not granted');
            return false;
        }

        try {
            const notification = new Notification(title, {
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'cct-trading',
                requireInteraction: false,
                ...options
            });

            // Auto-close after 5 seconds
            setTimeout(() => {
                notification.close();
            }, 5000);

            return true;
        } catch (error) {
            console.error('Failed to send notification:', error);
            return false;
        }
    }
}

// Global notification system
window.cctNotifications = new WebNotificationSystem();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Web Notifications initialized');
});
`;

    return new Response(webNotificationsJS, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  return null; // Not a static file we handle
}

/**
 * Validate request for sensitive endpoints
 */
function validateRequest(request, url, env) {
  // Check API key for sensitive endpoints (removed Facebook endpoints)
  const sensitiveEndpoints = ['/analyze', '/enhanced-feature-analysis', '/technical-analysis', '/r2-upload', '/test-high-confidence', '/test-sentiment', '/analyze-symbol', '/admin/backfill-daily-summaries', '/admin/verify-backfill', '/api/notifications/test'];

  if (sensitiveEndpoints.includes(url.pathname)) {
    const apiKey = request.headers.get('X-API-KEY');
    const validApiKey = env.WORKER_API_KEY;

    if (!validApiKey) {
      return { valid: false, error: 'API key not configured' };
    }

    if (!apiKey || apiKey !== validApiKey) {
      return { valid: false, error: 'Invalid or missing API key' };
    }
  }

  // Basic user agent validation for additional protection
  const userAgent = request.headers.get('User-Agent') || '';
  if (userAgent.includes('bot') && !userAgent.includes('Googlebot')) {
    return { valid: false, error: 'Blocked user agent' };
  }

  return { valid: true };
}

/**
 * Main HTTP request handler with monitoring and structured logging
 */
export async function handleHttpRequest(request, env, ctx) {
  // Initialize logging and monitoring
  initLogging(env);
  const requestLogger = createRequestLogger('http');
  const url = new URL(request.url);

  // Start performance monitoring
  const monitor = PerformanceMonitor.monitorRequest(request);

  // Log incoming request
  const startTime = requestLogger.logRequest(request);

  // Handle health endpoints before authentication validation (public access)
  if (url.pathname === '/health') {
    return handleHealthCheck(request, env);
  }
  if (url.pathname === '/model-health') {
    return handleModelHealth(request, env);
  }

  try {
    // Handle static files first
    if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/') ||
        url.pathname.startsWith('/images/') || url.pathname.startsWith('/assets/')) {
      const staticResponse = await serveStaticFile(url.pathname);
      if (staticResponse) {
        return staticResponse;
      }
    }

    // Input validation and API key check for sensitive endpoints
    const validationResult = validateRequest(request, url, env);
    if (!validationResult.valid) {
      const errorResponse = new Response(JSON.stringify({
        success: false,
        error: validationResult.error,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: validationResult.error.includes('API key') ? 401 : 400,
        headers: { 'Content-Type': 'application/json' }
      });

      // Log security event
      if (validationResult.error.includes('API key')) {
        BusinessMetrics.apiRequest(url.pathname, request.method, 401, Date.now() - startTime);
      }

      monitor.complete(errorResponse);
      requestLogger.logResponse(errorResponse, url.pathname, startTime);
      return errorResponse;
    }

    // Handle CORS preflight for v1 API
    if (url.pathname.startsWith('/api/v1/') && request.method === 'OPTIONS') {
      return handleApiV1CORS();
    }

    // Handle sector rotation routes
    if (url.pathname.startsWith('/api/sectors/')) {
      return await handleSectorRoute(request, env, ctx);
    }

    // Handle v1 API routes (this handles all /api/v1/* including market-drivers, market-intelligence, predictive)
    if (url.pathname.startsWith('/api/v1/')) {
      return await handleApiV1Request(request, env, ctx);
    }

    // Route requests to appropriate handlers
    let response;
    switch (url.pathname) {
      case '/':
        response = await handleHomeDashboardPage(request, env);
        break;
      case '/analyze':
        response = await handleManualAnalysis(request, env);
        break;
      case '/generate-morning-predictions':
        response = await handleGenerateMorningPredictions(request, env);
        break;
    case '/enhanced-feature-analysis':
      return handleEnhancedFeatureAnalysis(request, env);
    case '/technical-analysis':
      return handleIndependentTechnicalAnalysis(request, env);
    case '/results':
      return handleGetResults(request, env);
    // Optimization test endpoints (disabled for now)
    // case '/test-optimization':
    //   return handleOptimizationTest(request, env);
    // case '/test-kpi':
    //   return handleKPITest(request, env);
    // case '/test-error':
    //   return handleErrorTest(request, env);
    // case '/health-optimized':
    //   return handleOptimizedHealth(request, env);
    // case '/test-performance':
    //   return handlePerformanceTest(request, env);
    // case '/test-alert':
    //   return handleAlertTest(request, env);
    // case '/enhancement-status':
    //   return handleEnhancementStatus(request, env);
    // Web Notification System (replaces Facebook integration)
    case '/api/notifications/subscribe':
      return handleNotificationSubscription(request, env);
    case '/api/notifications/unsubscribe':
      return handleNotificationUnsubscription(request, env);
    case '/api/notifications/preferences':
      return handleNotificationPreferences(request, env);
    case '/api/notifications/history':
      return handleNotificationHistory(request, env);
    case '/api/notifications/test':
      return handleTestNotification(request, env);
    case '/api/notifications/status':
      return handleNotificationStatus(request, env);

    case '/weekly-report':
      return handleWeeklyReview(request, env);
    case '/friday-market-close-report':
      return handleFridayMarketCloseReport(request, env);
    case '/friday-monday-predictions-report':
      return handleFridayMondayPredictionsReport(request, env);
    case '/test-high-confidence':
      return handleHighConfidenceTest(request, env);
    case '/fact-table':
      return handleFactTable(request, env);
    case '/kv-cleanup':
      return handleKVCleanup(request, env);
    case '/debug-weekend-message':
      return handleDebugWeekendMessage(request, env);
    case '/kv-get':
      return handleKVGet(request, env);
    case '/kv-debug':
      return handleKVDebug(request, env);
    case '/kv-write-test':
      return handleKVWriteTest(request, env);
    case '/kv-read-test':
      return handleKVReadTest(request, env);
    case '/kv-analysis-write-test':
      return handleKVAnalysisWriteTest(request, env);
    case '/kv-analysis-read-test':
      return handleKVAnalysisReadTest(request, env);
    case '/weekly-analysis':
      return handleWeeklyAnalysisPage(request, env);
    case '/api/weekly-data':
      return handleWeeklyDataAPI(request, env);
    case '/sector-rotation':
      return handleSectorRotationDashboardPage(request, env);
    case '/predictive-analytics':
      response = await servePredictiveAnalyticsDashboard(request, env);
      break;
    case '/daily-summary':
      response = await handleDailySummaryPageRequest(request, env);
      break;
    case '/pre-market-briefing':
      return new Response(JSON.stringify({ ok: true, message: 'pre-market briefing stub' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    case '/intraday-check':
      return new Response(JSON.stringify({ ok: true, message: 'intraday check stub' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    case '/intraday-check-decomposed':
      return handleIntradayCheckDecomposed(request, env);
    case '/end-of-day-summary':
      return new Response(JSON.stringify({ ok: true, message: 'end-of-day summary stub' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    case '/weekly-review':
      return new Response(JSON.stringify({ ok: true, message: 'weekly review stub' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    case '/test-sentiment':
      return handleSentimentTest(request, env);
    case '/status-management':
      return handleStatusManagement(request, env);
    case '/kv-verification-test':
      return handleKVVerificationTest(request, env);
    case '/debug-sentiment':
      return handleSentimentDebugTest(request, env);
    case '/test-modelscope':
      return handleModelScopeTest(request, env);
    case '/test-llama':
      return handleTestLlama(request, env);
    case '/debug-env':
      return handleDebugEnvironment(request, env);
    case '/r2-upload':
      return handleR2Upload(request, env);
    case '/analyze-symbol':
      return handlePerSymbolAnalysis(request, env);
    case '/cron-health':
      return handleCronHealth(request, env);
    case '/api/daily-summary':
      return handleDailySummaryAPI(request, env);
    case '/admin/backfill-daily-summaries':
      return handleBackfillDailySummaries(request, env);
    case '/admin/verify-backfill':
      return handleVerifyBackfill(request, env);
    case '/send-real-facebook':
      return handleFacebookTest(request, env);
    case '/favicon.ico':
      // Return a simple 1x1 transparent GIF as favicon
      const faviconData = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02,
        0x02, 0x04, 0x01, 0x00, 0x3b
      ]);
      return new Response(faviconData, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'public, max-age=86400'
        }
      });
    default:
      // Default response for root and unknown paths
      // Note: '/' is handled above in the switch case

      if (url.pathname === '/status') {
        return new Response(JSON.stringify({
          success: true,
          message: 'TFT Trading System Worker is operational',
          timestamp: new Date().toISOString(),
          version: env.WORKER_VERSION || '2.0-Modular',
          endpoints: [
            '/health - Health check',
            '/model-health - Model files R2 accessibility check',
            '/r2-upload - R2 enhanced model files upload API',
            '/analyze - Enhanced analysis (Neural Networks + Sentiment)',
            '/results - Get latest results',
            '/fact-table - Prediction accuracy table',
            '/weekly-analysis - Weekly analysis dashboard',
            '/api/weekly-data - Weekly analysis data API',
            '/pre-market-briefing - Morning high-confidence signals (≥70%)',
            '/intraday-check - Real-time signal performance tracking',
            '/end-of-day-summary - Market close analysis & tomorrow outlook',
            '/weekly-review - Comprehensive high-confidence signal analysis',
            '/api/notifications/subscribe - Subscribe to web notifications',
            '/api/notifications/preferences - Update notification preferences',
            '/api/notifications/test - Test web notifications',
            '/api/notifications/status - Notification system status',
            '/test-sentiment - Sentiment enhancement validation',
            '/analyze-symbol?symbol=AAPL - Fine-grained per-symbol analysis',
            '/cron-health - Cron job execution health monitoring',
            '/predictive-analytics - AI-powered predictive analytics dashboard (NEW)',
            '/api/sectors/snapshot - Sector rotation snapshot (NEW)',
            '/api/sectors/analysis - Complete sector rotation analysis (NEW)',
            '/api/sectors/health - Sector system health check (NEW)',
            '/api/sectors/test - Test sector data fetching (NEW)'
          ]
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      response = new Response(JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        requested_path: url.pathname,
        timestamp: new Date().toISOString(),
        available_endpoints: [
          '/', '/health', '/model-health', '/analyze', '/results', '/fact-table',
          '/weekly-analysis', '/api/weekly-data', '/pre-market-briefing', '/intraday-check',
          '/end-of-day-summary', '/weekly-review', '/api/notifications/subscribe',
          '/api/notifications/preferences', '/api/notifications/test', '/api/notifications/status',
          '/test-sentiment', '/daily-summary', '/api/sectors/snapshot', '/api/sectors/analysis',
          '/api/sectors/health', '/api/sectors/test'
        ]
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
      break;
    }

    // Complete monitoring and logging
    if (response) {
      monitor.complete(response);
      requestLogger.logResponse(response, url.pathname, startTime);
      return response;
    }

  } catch (error) {
    // Handle unexpected errors
    const errorResponse = new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });

    monitor.complete(errorResponse);
    requestLogger.logResponse(errorResponse, url.pathname, startTime, {
      error: error.message
    });

    return errorResponse;
  }
}