/**
 * HTTP Request Routing Module
 */

import { handleWeeklyAnalysisPage, handleWeeklyDataAPI } from './weekly-analysis.js';
import {
  handleManualAnalysis,
  handleEnhancedFeatureAnalysis,
  handleIndependentTechnicalAnalysis,
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
  handleSentimentTest,
  handleGPTDebugTest,
  handleModelScopeTest,
  handleTestLlama,
  handleDebugEnvironment,
  handleModelHealth,
  handleR2Upload,
  handleTestAllFacebookMessages
} from './handlers.js';

/**
 * Validate request for sensitive endpoints
 */
function validateRequest(request, url, env) {
  // Check API key for sensitive endpoints
  const sensitiveEndpoints = ['/analyze', '/enhanced-feature-analysis', '/technical-analysis', '/r2-upload', '/test-facebook', '/test-high-confidence', '/test-sentiment', '/test-all-facebook'];

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
 * Main HTTP request handler
 */
export async function handleHttpRequest(request, env, ctx) {
  const url = new URL(request.url);
  
  // Input validation and API key check for sensitive endpoints
  const validationResult = validateRequest(request, url, env);
  if (!validationResult.valid) {
    return new Response(JSON.stringify({
      success: false,
      error: validationResult.error,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: validationResult.error.includes('API key') ? 401 : 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Route requests to appropriate handlers
  switch (url.pathname) {
    case '/analyze':
      return handleManualAnalysis(request, env);
    case '/enhanced-feature-analysis':
      return handleEnhancedFeatureAnalysis(request, env);
    case '/technical-analysis':
      return handleIndependentTechnicalAnalysis(request, env);
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
    case '/debug-gpt':
      return handleGPTDebugTest(request, env);
    case '/test-modelscope':
      return handleModelScopeTest(request, env);
    case '/test-llama':
      return handleTestLlama(request, env);
    case '/debug-env':
      return handleDebugEnvironment(request, env);
    case '/model-health':
      return handleModelHealth(request, env);
    case '/r2-upload':
      return handleR2Upload(request, env);
    case '/test-all-facebook':
      return handleTestAllFacebookMessages(request, env);
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
            '/model-health - Model files R2 accessibility check',
            '/r2-upload - R2 enhanced model files upload API',
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
          '/', '/health', '/model-health', '/analyze', '/results', '/fact-table',
          '/weekly-analysis', '/api/weekly-data', '/test-sentiment'
        ]
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
  }
}