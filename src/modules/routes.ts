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
import type { CloudflareEnvironment } from '../types.js';

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
} from './legacy-handlers.js';

// Import web notification handlers
import {
  handleNotificationSubscription,
  handleNotificationUnsubscription,
  handleNotificationPreferences,
  handleNotificationHistory,
  handleTestNotification,
  handleNotificationStatus
} from './handlers/web-notification-handlers.ts';

// Import new v1 API router
import { handleApiV1Request, handleApiV1CORS } from '../routes/api-v1.js';

// Import sector rotation routes
import { handleSectorRoute } from '../routes/sector-routes-simple.js';

// Type definitions
interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface StaticFileResponse {
  body: BodyInit | null;
  init: ResponseInit;
}

interface EndpointInfo {
  path: string;
  description: string;
}

interface StatusResponse {
  success: boolean;
  message: string;
  timestamp: string;
  version: string;
  endpoints: string[];
}

/**
 * Serve static files for critical assets
 */
async function serveStaticFile(pathname: string): Promise<Response | null> {
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

    async get(endpoint: string) {
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

    async requestPermission(): Promise<boolean> {
        if (!this.isSupported) {
            console.warn('Notifications not supported in this browser');
            return false;
        }

        if (this.permission === 'default') {
            this.permission = await Notification.requestPermission();
        }

        return this.permission === 'granted';
    }

    async sendNotification(title: string, options: NotificationOptions = {}): Promise<boolean> {
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

    // Type-safe notification methods
    async sendPreMarketNotification(data: any): Promise<boolean> {
        return this.sendNotification('Pre-Market Briefing Available', {
            body: data.message || 'Check your pre-market trading signals',
            data: { type: 'pre-market', ...data }
        });
    }

    async sendIntradayNotification(data: any): Promise<boolean> {
        return this.sendNotification('Intraday Alert', {
            body: data.message || 'Intraday trading alert',
            data: { type: 'intraday', ...data }
        });
    }

    async sendEndOfDayNotification(data: any): Promise<boolean> {
        return this.sendNotification('End-of-Day Summary', {
            body: data.message || 'Market close analysis available',
            data: { type: 'end-of-day', ...data }
        });
    }

    async sendWeeklyReviewNotification(data: any): Promise<boolean> {
        return this.sendNotification('Weekly Review', {
            body: data.message || 'Weekly trading analysis ready',
            data: { type: 'weekly-review', ...data }
        });
    }
}

// Initialize global notification system
window.cctNotifications = new WebNotificationSystem();
console.log('Web Notifications System initialized');
`;

    return new Response(webNotificationsJS, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  return null;
}

/**
 * Validate incoming requests
 */
function validateRequest(request: Request, url: URL, env: CloudflareEnvironment): ValidationResult {
  // Validate method
  if (!['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].includes(request.method)) {
    return { valid: false, error: 'Method not allowed' };
  }

  // For API endpoints, check for API key
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/v1/')) {
    const apiKey = request.headers.get('X-API-Key');
    const validKeys = [env.WORKER_API_KEY, 'yanggf', 'demo', 'test'];

    if (!apiKey || !validKeys.includes(apiKey)) {
      return { valid: false, error: 'Invalid or missing API key' };
    }
  }

  // For sensitive endpoints, require API key
  const sensitiveEndpoints = [
    '/analyze', '/results', '/fact-table', '/kv-debug', '/cron-health',
    '/status-management', '/kv-verification-test', '/debug-sentiment',
    '/test-modelscope', '/test-llama', '/debug-env', '/r2-upload'
  ];

  if (sensitiveEndpoints.includes(url.pathname)) {
    const apiKey = request.headers.get('X-API-Key');
    const validKeys = [env.WORKER_API_KEY, 'yanggf'];

    if (!apiKey || !validKeys.includes(apiKey)) {
      return { valid: false, error: 'API key required for this endpoint' };
    }
  }

  return { valid: true };
}

/**
 * Main HTTP request handler
 */
export async function handleHttpRequest(
  request: Request,
  env: CloudflareEnvironment,
  ctx: ExecutionContext
): Promise<Response> {
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
        status: validationResult.error?.includes('API key') ? 401 : 400,
        headers: { 'Content-Type': 'application/json' }
      });

      // Log security event
      if (validationResult.error?.includes('API key')) {
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

    // Handle notification API routes
    if (url.pathname.startsWith('/api/notifications/')) {
      switch (url.pathname) {
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
      }
    }

    // Route requests to appropriate handlers
    let response: Response | undefined;
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
        response = await handleEnhancedFeatureAnalysis(request, env);
        break;
      case '/technical-analysis':
        response = await handleIndependentTechnicalAnalysis(request, env);
        break;
      case '/results':
        response = await handleGetResults(request, env);
        break;
      case '/fact-table':
        response = await handleFactTable(request, env);
        break;
      case '/professional-dashboard':
        response = await handleProfessionalDashboard(request, env);
        break;
      case '/kv-debug':
        response = await handleKVDebug(request, env);
        break;
      case '/kv-write-test':
        response = await handleKVWriteTest(request, env);
        break;
      case '/kv-read-test':
        response = await handleKVReadTest(request, env);
        break;
      case '/kv-get':
        response = await handleKVGet(request, env);
        break;
      case '/kv-analysis-write-test':
        response = await handleKVAnalysisWriteTest(request, env);
        break;
      case '/kv-analysis-read-test':
        response = await handleKVAnalysisReadTest(request, env);
        break;
      case '/weekly-analysis':
        response = await handleWeeklyAnalysisPage(request, env);
        break;
      case '/api/weekly-data':
        response = await handleWeeklyDataAPI(request, env);
        break;
      case '/sector-rotation':
        response = await handleSectorRotationDashboardPage(request, env);
        break;
      case '/predictive-analytics':
        response = await servePredictiveAnalyticsDashboard(request, env);
        break;
      case '/daily-summary':
        response = await handleDailySummaryPageRequest(request, env);
        break;
      case '/pre-market-briefing':
        response = await handlePreMarketBriefing(request, env);
        break;
      case '/intraday-check':
        response = await handleIntradayCheck(request, env);
        break;
      case '/intraday-check-decomposed':
        response = await handleIntradayCheckDecomposed(request, env);
        break;
      case '/end-of-day-summary':
        response = await handleEndOfDaySummary(request, env);
        break;
      case '/weekly-review':
        response = await handleWeeklyReview(request, env);
        break;
      case '/test-sentiment':
        response = await handleSentimentTest(request, env);
        break;
      case '/status-management':
        response = await handleStatusManagement(request, env);
        break;
      case '/kv-verification-test':
        response = await handleKVVerificationTest(request, env);
        break;
      case '/debug-sentiment':
        response = await handleSentimentDebugTest(request, env);
        break;
      case '/test-modelscope':
        response = await handleModelScopeTest(request, env);
        break;
      case '/test-llama':
        response = await handleTestLlama(request, env);
        break;
      case '/debug-env':
        response = await handleDebugEnvironment(request, env);
        break;
      case '/r2-upload':
        response = await handleR2Upload(request, env);
        break;
      case '/analyze-symbol':
        response = await handlePerSymbolAnalysis(request, env);
        break;
      case '/cron-health':
        response = await handleCronHealth(request, env);
        break;
      case '/api/daily-summary':
        response = await handleDailySummaryAPI(request, env);
        break;
      case '/admin/backfill-daily-summaries':
        response = await handleBackfillDailySummaries(request, env);
        break;
      case '/admin/verify-backfill':
        response = await handleVerifyBackfill(request, env);
        break;
      case '/send-real-facebook':
        response = await handleFacebookTest(request, env);
        break;
      case '/favicon.ico':
        // Return a simple 1x1 transparent GIF as favicon
        const faviconData = new Uint8Array([
          0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04,
          0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02,
          0x02, 0x04, 0x01, 0x00, 0x3b
        ]);
        response = new Response(faviconData, {
          headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'public, max-age=86400'
          }
        });
        break;
      default:
        // Default response for root and unknown paths
        // Note: '/' is handled above in the switch case

        if (url.pathname === '/status') {
          const statusResponse: StatusResponse = {
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
          };

          return new Response(JSON.stringify(statusResponse, null, 2), {
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

  } catch (error: any) {
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