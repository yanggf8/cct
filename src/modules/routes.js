/**
 * HTTP Request Routing Module
 */

import { handleWeeklyAnalysisPage, handleWeeklyDataAPI } from './weekly-analysis.js';
import {
  handleManualAnalysis,
  handleGetResults,
  handleHealthCheck,
  handleFacebookTest,
  handleWeeklyReport,
  handleFridayMarketCloseReport,
  handleFridayMondayPredictionsReport,
  handleHighConfidenceTest,
  handleFactTable,
  handleKVCleanup,
  handleDebugWeekendMessage,
  handleKVGet,
  handleSentimentTest
} from './handlers.js';

/**
 * Validate request for sensitive endpoints
 */
function validateRequest(request, url) {
  // Basic validation - can be enhanced with rate limiting, API keys, etc.
  const userAgent = request.headers.get('User-Agent') || '';
  
  // Block obviously malicious requests
  if (userAgent.includes('bot') && !userAgent.includes('Googlebot')) {
    return { valid: false, error: 'Blocked user agent' };
  }
  
  return { valid: true };
}

/**
 * Main HTTP request handler
 */
export async function handleHttpRequest(request, env, ctx) {
  const url = new URL(request.url);
  
  // Input validation and rate limiting for sensitive endpoints
  if (url.pathname === '/analyze' || url.pathname === '/test-facebook' || url.pathname === '/test-high-confidence') {
    const validationResult = validateRequest(request, url);
    if (!validationResult.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: validationResult.error,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Route requests to appropriate handlers
  switch (url.pathname) {
    case '/analyze':
      return handleManualAnalysis(request, env);
    case '/results':
      return handleGetResults(request, env);
    case '/health':
      return handleHealthCheck(request, env);
    case '/test-facebook':
      return handleFacebookTest(request, env);
    case '/weekly-report':
      return handleWeeklyReport(request, env);
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
    case '/weekly-analysis':
      return handleWeeklyAnalysisPage(request, env);
    case '/api/weekly-data':
      return handleWeeklyDataAPI(request, env);
    case '/test-sentiment':
      return handleSentimentTest(request, env);
    default:
      // Default response for root and unknown paths
      if (url.pathname === '/' || url.pathname === '/status') {
        return new Response(JSON.stringify({
          success: true,
          message: 'TFT Trading System Worker is operational',
          timestamp: new Date().toISOString(),
          version: env.WORKER_VERSION || '2.0-Modular',
          endpoints: [
            '/health - Health check',
            '/analyze - Enhanced analysis (Neural Networks + Sentiment)',
            '/results - Get latest results',
            '/fact-table - Prediction accuracy table',
            '/weekly-analysis - Weekly analysis dashboard',
            '/api/weekly-data - Weekly analysis data API',
            '/test-sentiment - Sentiment enhancement validation'
          ]
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        requested_path: url.pathname,
        timestamp: new Date().toISOString(),
        available_endpoints: [
          '/', '/health', '/analyze', '/results', '/fact-table',
          '/weekly-analysis', '/api/weekly-data', '/test-sentiment'
        ]
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
  }
}