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
import { handleManualAnalysis, handleEnhancedFeatureAnalysis, handleIndependentTechnicalAnalysis, handlePerSymbolAnalysis, handleSentimentTest, handleGetResults, handleFactTable, handleCronHealth, handleKVDebug, handleKVWriteTest, handleKVReadTest, handleKVGet, handleKVAnalysisWriteTest, handleKVAnalysisReadTest, handleHealthCheck, handleModelHealth, handleDebugEnvironment, handleWeeklyReview, handleDailySummaryAPI, handleDailySummaryPageRequest, handleBackfillDailySummaries, handleVerifyBackfill, handleGenerateMorningPredictions, handleStatusManagement, handleKVVerificationTest, handleProfessionalDashboard } from './handlers/index.js';
// Import comprehensive report handlers
import { handlePreMarketBriefing, handleIntradayCheck, handleEndOfDaySummary } from './handlers/index.js';
// Import decomposed handler examples
import { handleIntradayCheckDecomposed } from './handlers/intraday-decomposed.js';
import { handleIntradayCheckRefactored } from './handlers/intraday-refactored.js';
// Legacy handlers that haven't been modularized yet
import { handleSentimentDebugTest, handleModelScopeTest, handleTestLlama, handleR2Upload, handleFacebookTest } from './legacy-handlers.js';
// Import web notification handlers
import { handleNotificationSubscription, handleNotificationUnsubscription, handleNotificationPreferences, handleNotificationHistory, handleTestNotification, handleNotificationStatus } from './handlers/web-notification-handlers.js';
// Import new v1 API router
import { handleApiV1Request, handleApiV1CORS } from '../routes/api-v1.js';
// Import sector rotation routes
import { handleSectorRoute } from '../routes/sector-routes-simple.js';
// Import enhanced cache routes
import { createEnhancedCacheRoutes } from '../routes/enhanced-cache-routes.js';
import { API_CLIENT_CONTENT } from './api-client-content.js';
/**
 * Serve static files for critical assets
 */
async function serveStaticFile(pathname) {
    // Security check - prevent directory traversal
    if (pathname.includes('..') || pathname.includes('//')) {
        return new Response('Forbidden', { status: 403 });
    }
    // Only handle specific critical static files that we need
    if (pathname === '/test-market-clock.html') {
        // Serve market clock test page using same logic as dashboard
        return new Response(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Market Clock Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #1a1a2e; color: white; }
        .test-section { margin: 20px 0; padding: 15px; background: rgba(79, 172, 254, 0.1); border-radius: 8px; }
        .clock-display { font-size: 2rem; font-weight: bold; color: #4facfe; margin: 10px 0; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .success { background: rgba(0, 255, 136, 0.2); }
        .error { background: rgba(255, 0, 0, 0.2); }
        .info { background: rgba(79, 172, 254, 0.2); }
    </style>
</head>
<body>
    <h1>🕐 Market Clock Test (Production Logic)</h1>
    <div class="test-section">
        <h2>Current Market Clock Status</h2>
        <div class="clock-display" id="test-clock">Loading...</div>
        <div class="status info" id="test-session">Determining market session...</div>
        <div class="status info" id="test-timezone">Checking timezone...</div>
    </div>
    <script>
        // Use same logic as dashboard-main.js
        function updateMarketClock() {
            try {
                const now = new Date();
                const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
                const hours = estTime.getHours();
                const minutes = estTime.getMinutes();
                const seconds = estTime.getSeconds();

                // Update clock display
                document.getElementById('test-clock').textContent =
                    String(hours).padStart(2, '0') + ':' +
                    String(minutes).padStart(2, '0') + ':' +
                    String(seconds).padStart(2, '0');

                // Show timezone info
                document.getElementById('test-timezone').innerHTML =
                    'Local Time: ' + now.toLocaleString() + '<br>' +
                    'EST Time: ' + estTime.toLocaleString();

                // Determine market session (same as dashboard)
                updateMarketStatus(estTime);
            } catch (error) {
                console.error('Error:', error);
            }
        }

        function updateMarketStatus(estTime) {
            const day = estTime.getDay();
            const hours = estTime.getHours();
            const minutes = estTime.getMinutes();
            const currentTime = hours * 60 + minutes;
            let session = '';
            let statusClass = '';

            // Weekend
            if (day === 0 || day === 6) {
                session = 'Weekend';
                statusClass = 'error';
            }
            // Pre-market (4:00 AM - 9:30 AM ET)
            else if (hours >= 4 && (hours < 9 || (hours === 9 && minutes < 30))) {
                session = 'Pre-Market';
                statusClass = 'info';
            }
            // Market hours (9:30 AM - 4:00 PM ET)
            else if ((hours > 9 || (hours === 9 && minutes >= 30)) && hours < 16) {
                session = 'Market Open';
                statusClass = 'success';
            }
            // After-hours (4:00 PM - 8:00 PM ET)
            else if (hours >= 16 && hours < 20) {
                session = 'After Hours';
                statusClass = 'info';
            }
            // Closed
            else {
                session = 'Market Closed';
                statusClass = 'error';
            }

            const statusElement = document.getElementById('test-session');
            statusElement.innerHTML = '<strong>' + session + '</strong>';
            statusElement.className = 'status ' + statusClass;
        }

        // Initialize clock
        updateMarketClock();
        setInterval(updateMarketClock, 1000);
    </script>
</body>
</html>
    `, {
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache'
            }
        });
    }
    if (pathname === '/js/api-client.js') {
        // Serve the secure API client using proper static file serving
        return new Response(API_CLIENT_CONTENT, {
            headers: {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'no-cache'
            }
        });
    }
    if (pathname === '/js/secure-auth.js') {
        // Serve secure authentication module
        return new Response(`
/**
 * Secure Authentication Module
 * Replaces hardcoded API keys with proper authentication
 */

class SecureAuth {
    constructor() {
        this.apiKey = null;
        this.isAuthenticated = false;
    }

    // Initialize with API key
    async authenticate(apiKey) {
        if (!apiKey) {
            throw new Error('API key is required for authentication');
        }

        try {
            // Test API key validity
            const response = await fetch('/api/v1/data/health', {
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.apiKey = apiKey;
                this.isAuthenticated = true;

                // SECURITY: Session-based authentication only
                console.log('API key authenticated (session-based)');

                // Update global API client
                if (window.cctApi && window.cctApi.setApiKey) {
                    window.cctApi.setApiKey(apiKey);
                }

                return true;
            } else {
                throw new Error('Invalid API key');
            }
        } catch (error) {
            throw new Error(\`Authentication failed: \${error.message}\`);
        }
    }

    // Logout
    logout() {
        this.apiKey = null;
        this.isAuthenticated = false;

        // Session-based - no localStorage cleanup needed
        if (window.cctApi && window.cctApi.setApiKey) {
            window.cctApi.setApiKey(null);
        }
    }

    // Get authentication status
    getAuthStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            hasApiKey: !!this.apiKey
        };
    }
}

// Global authentication instance
window.secureAuth = new SecureAuth();

// Authentication helper functions
window.requireAuthentication = function() {
    if (!window.secureAuth.isAuthenticated) {
        throw new Error('Authentication required. Please provide a valid API key.');
    }
};

window.showAuthenticationDialog = function() {
    // Remove existing modal if any
    const existingModal = document.getElementById('auth-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.innerHTML = \`
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 30px; border-radius: 8px; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <h3 style="margin: 0 0 15px 0; color: #333;">Authentication Required</h3>
                <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
                    Please enter your API key to access all features of the trading dashboard.
                </p>
                <input type="password" id="apiKeyInput" placeholder="Enter your API key"
                    style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 15px; box-sizing: border-box;">
                <div style="display: flex; gap: 10px;">
                    <button onclick="submitApiKey()" style="flex: 1; background: #007cba; color: white; border: none; padding: 12px; border-radius: 4px; cursor: pointer; font-weight: 500;">Authenticate</button>
                    <button onclick="closeAuthDialog()" style="flex: 1; background: #ccc; color: #333; border: none; padding: 12px; border-radius: 4px; cursor: pointer;">Cancel</button>
                </div>
                <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
                    Your API key will be stored locally for convenience.
                </p>
            </div>
        </div>
    \`;
    document.body.appendChild(modal);

    // Focus input
    setTimeout(() => {
        const input = document.getElementById('apiKeyInput');
        if (input) input.focus();
    }, 100);
};

window.submitApiKey = async function() {
    const input = document.getElementById('apiKeyInput');
    const apiKey = input ? input.value.trim() : '';

    if (!apiKey) {
        alert('Please enter a valid API key');
        return;
    }

    try {
        await window.secureAuth.authenticate(apiKey);
        closeAuthDialog();

        // Show success message
        const successMsg = document.createElement('div');
        successMsg.innerHTML = \`
            <div style="position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 15px 20px; border-radius: 4px; z-index: 10000;">
                ✓ Authentication successful!
            </div>
        \`;
        document.body.appendChild(successMsg);

        setTimeout(() => successMsg.remove(), 3000);

        // Update dashboard API client without page reload
        setTimeout(() => location.reload(), 1000);

    } catch (error) {
        alert(\`Authentication failed: \${error.message}\`);
    }
};

window.closeAuthDialog = function() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.remove();
    }
};

// Handle Enter key in input
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.getElementById('apiKeyInput')) {
        submitApiKey();
    }
});

console.log('Secure Authentication module loaded');
    `, {
            headers: {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'no-cache'
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

    // Type-safe notification methods
    async sendPreMarketNotification(data) {
        return this.sendNotification('Pre-Market Briefing Available', {
            body: data.message || 'Check your pre-market trading signals',
            data: { type: 'pre-market', ...data }
        });
    }

    async sendIntradayNotification(data) {
        return this.sendNotification('Intraday Alert', {
            body: data.message || 'Intraday trading alert',
            data: { type: 'intraday', ...data }
        });
    }

    async sendEndOfDayNotification(data) {
        return this.sendNotification('End-of-Day Summary', {
            body: data.message || 'Market close analysis available',
            data: { type: 'end-of-day', ...data }
        });
    }

    async sendWeeklyReviewNotification(data) {
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
function validateRequest(request, url, env) {
    // Validate method
    if (!['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].includes(request.method)) {
        return { valid: false, error: 'Method not allowed' };
    }
    // For API endpoints, check for API key
    if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/v1/')) {
        const apiKey = request.headers.get('X-API-KEY');
        // Use X_API_KEY environment variable consistently
        const configuredApiKeys = env.API_KEYS ? env.API_KEYS.split(',') : [];
        const validKeys = [env.X_API_KEY, ...configuredApiKeys];
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
        const apiKey = request.headers.get('X-API-KEY');
        // Use X_API_KEY environment variable consistently
        const configuredApiKeys = env.API_KEYS ? env.API_KEYS.split(',') : [];
        const validKeys = [env.X_API_KEY, ...configuredApiKeys];
        if (!apiKey || !validKeys.includes(apiKey)) {
            return { valid: false, error: 'API key required for this endpoint' };
        }
    }
    return { valid: true };
}
/**
 * Main HTTP request handler
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
        return handleHealthCheck(request, env, ctx);
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
            return await handleApiV1Request(request, env, url.pathname);
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
        let response;
        switch (url.pathname) {
            case '/':
                response = await handleHomeDashboardPage(request, env);
                break;
            case '/analyze':
                response = await handleManualAnalysis(request, env, ctx);
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
                response = await handleProfessionalDashboard(request, env, ctx);
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
            case '/predictive-analytics-dashboard':
                response = await servePredictiveAnalyticsDashboard(request, env);
                break;
            case '/daily-summary':
                response = await handleDailySummaryPageRequest(request, env);
                break;
            case '/pre-market-briefing':
                response = await handlePreMarketBriefing(request, env, ctx);
                break;
            case '/intraday-check':
                response = await handleIntradayCheck(request, env, ctx);
                break;
            case '/intraday-check-decomposed':
                response = await handleIntradayCheckDecomposed(request, env, ctx);
                break;
            case '/intraday-check-refactored':
                response = await handleIntradayCheckRefactored(request, env);
                break;
            case '/end-of-day-summary':
                response = await handleEndOfDaySummary(request, env, ctx);
                break;
            case '/weekly-review':
                response = await handleWeeklyReview(request, env, ctx);
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
            case '/cache-health':
            case '/cache-config':
            case '/cache-metrics':
            case '/cache-promotion':
            case '/cache-system-status':
            case '/cache-warmup':
            case '/cache-test-load':
                // Handle enhanced cache routes
                const enhancedCacheRoutes = createEnhancedCacheRoutes(env);
                const cacheRoute = enhancedCacheRoutes.find(route => route.path === url.pathname);
                if (cacheRoute) {
                    response = await cacheRoute.handler(request, env, ctx);
                }
                else {
                    response = new Response(JSON.stringify({
                        success: false,
                        error: 'Cache route not found',
                        path: url.pathname
                    }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
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
                    const statusResponse = {
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
    }
    catch (error) {
        // Handle unexpected errors
        const errorResponse = new Response(JSON.stringify({
            success: false,
            error: 'Internal server error',
            message: (error instanceof Error ? error.message : String(error)),
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
//# sourceMappingURL=routes.js.map