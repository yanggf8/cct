/**
 * Test Optimization Endpoint
 * Demonstrates the optimization modules in action
 */

import { createHandler, createAPIHandler, createHealthHandler } from './handler-factory.js';
import { createSuccessResponse, createErrorResponse, createAnalysisResponse } from './response-factory.js';
import { CONFIG, getTimeout, isValidSymbol } from './config.js';
import { BusinessKPI, BusinessMetrics } from './monitoring.js';

/**
 * Test optimization configuration
 */
export const handleOptimizationTest = createHandler('optimization-test', async (request, env, ctx) => {
  const url = new URL(request.url);
  const testType = url.searchParams.get('test') || 'all';

  const results = {
    timestamp: new Date().toISOString(),
    requestId: ctx.requestId,
    tests: {}
  };

  // Test 1: Configuration Module
  if (testType === 'all' || testType === 'config') {
    results.tests.configuration = {
      apiTimeout: getTimeout('API_REQUEST'),
      tradingSymbols: CONFIG.TRADING.SYMBOLS,
      businessKPIs: CONFIG.BUSINESS_KPI,
      symbolValidation: {
        validSymbol: isValidSymbol('AAPL'),
        invalidSymbol: isValidSymbol('INVALID')
      }
    };
  }

  // Test 2: Business Metrics
  if (testType === 'all' || testType === 'metrics') {
    // Track some test metrics
    BusinessMetrics.analysisRequested('optimization_test', 5);
    BusinessMetrics.apiRequest('/test-optimization', 'GET', 200, 150);
    BusinessKPI.trackPerformanceKPI(150, 'optimization-test');
    BusinessKPI.trackPredictionAccuracy(0.75);

    results.tests.businessMetrics = {
      metricsTracked: true,
      kpiDashboard: BusinessKPI.generateKPIDashboard()
    };
  }

  // Test 3: Response Factory
  if (testType === 'all' || testType === 'response') {
    results.tests.responseFactory = {
      standardizedFormat: true,
      metadata: {
        service: 'optimization-test',
        processingTime: Date.now() - ctx.startTime,
        requestCorrelation: ctx.requestId
      }
    };
  }

  return createSuccessResponse(results, {
    testType,
    optimizationModules: ['config', 'handler-factory', 'response-factory', 'monitoring'],
    performance: {
      responseTime: Date.now() - ctx.startTime,
      target: CONFIG.BUSINESS_KPI.RESPONSE_TIME_TARGET_MS
    }
  }, {
    requestId: ctx.requestId,
    service: 'optimization-test'
  });
}, {
  enableMetrics: true,
  enableAuth: false // Allow public access for testing
});

/**
 * Test KPI endpoint
 */
export const handleKPITest = createAPIHandler('kpi-test', async (request, env, ctx) => {
  // Generate sample KPI data
  BusinessKPI.trackPredictionAccuracy(0.72);
  BusinessKPI.trackPerformanceKPI(180, 'kpi-test');
  BusinessKPI.trackCostEfficiency(0.00);
  BusinessKPI.trackUptimeKPI(0.999);
  BusinessKPI.trackCronReliability(47, 50, 'morning_prediction_alerts');

  const dashboard = BusinessKPI.generateKPIDashboard();

  return createSuccessResponse(dashboard, {
    kpiType: 'real-time',
    generatedAt: new Date().toISOString(),
    metricsCount: Object.keys(dashboard).length - 2 // exclude timestamp and overall_health
  }, {
    requestId: ctx.requestId,
    service: 'kpi-dashboard'
  });
});

/**
 * Test error handling with optimization
 */
export const handleErrorTest = createHandler('error-test', async (request, env, ctx) => {
  const url = new URL(request.url);
  const errorType = url.searchParams.get('type') || 'validation';

  // Simulate different error types
  switch (errorType) {
    case 'validation':
      return createErrorResponse('Invalid symbol provided', {
        status: 400,
        details: { validSymbols: CONFIG.TRADING.SYMBOLS },
        requestId: ctx.requestId,
        service: 'error-test'
      });

    case 'timeout':
      return createErrorResponse('Operation timeout', {
        status: 504,
        details: { timeout: getTimeout('API_REQUEST') },
        requestId: ctx.requestId,
        service: 'error-test'
      });

    case 'unauthorized':
      return createErrorResponse('Unauthorized access', {
        status: 401,
        requestId: ctx.requestId,
        service: 'error-test'
      });

    default:
      throw new Error('Simulated internal server error');
  }
}, {
  enableMetrics: true,
  enableAuth: false
});

/**
 * Test health check with optimization
 */
export const handleOptimizedHealth = createHealthHandler('optimized-system', async (env, ctx) => {
  return {
    optimizationModules: {
      configuration: 'enabled',
      handlerFactory: 'enabled',
      responseFactory: 'enabled',
      enhancedKPIs: 'enabled'
    },
    performance: {
      configAccess: '<0.1ms',
      responseFormatting: '<1ms',
      handlerOverhead: '<0.5ms'
    },
    businessKPIs: BusinessKPI.generateKPIDashboard(),
    version: '2.0-Optimized'
  };
});