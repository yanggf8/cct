/**
 * Integration Test Routes (API v1)
 * Handles all integration testing endpoints
 * Provides comprehensive testing and monitoring capabilities
 */

import {
  ApiResponseFactory,
  ProcessingTimer,
  HttpStatus
} from '../modules/api-v1-responses.js';
import {
  validateApiKey,
  generateRequestId
} from './api-v1.js';
import { initializeIntegrationTestSuite, type TestSuite } from '../modules/integration-test-suite.js';
import { createLogger } from '../modules/logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('integration-test-routes');

/**
 * Handle all integration test routes
 */
export async function handleIntegrationTestRoutes(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const method = request.method;
  const requestId = headers['X-Request-ID'] || generateRequestId();

  // Validate API key for protected endpoints
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Invalid or missing API key',
          'UNAUTHORIZED',
          { requestId }
        )
      ),
      {
        status: HttpStatus.UNAUTHORIZED,
        headers,
      }
    );
  }

  try {
    // POST /api/v1/integration-tests/run-full - Run complete test suite
    if (path === '/api/v1/integration-tests/run-full' && method === 'POST') {
      return await handleRunFullTestSuite(request, env, headers, requestId);
    }

    // GET /api/v1/integration-tests/health-check - Run quick health check
    if (path === '/api/v1/integration-tests/health-check' && method === 'GET') {
      return await handleHealthCheck(request, env, headers, requestId);
    }

    // GET /api/v1/integration-tests/status - Get test status
    if (path === '/api/v1/integration-tests/status' && method === 'GET') {
      return await handleTestStatus(request, env, headers, requestId);
    }

    // Method not allowed for existing paths
    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          `Method ${method} not allowed for ${path}`,
          'METHOD_NOT_ALLOWED',
          { requestId }
        )
      ),
      {
        status: HttpStatus.METHOD_NOT_ALLOWED,
        headers,
      }
    );
  } catch (error: unknown) {
    logger.error('IntegrationTestRoutes Error', error, { requestId, path, method });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Internal server error',
          'INTERNAL_ERROR',
          {
            requestId,
            path,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle full test suite execution
 * POST /api/v1/integration-tests/run-full
 */
async function handleRunFullTestSuite(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    logger.info('Starting full integration test suite', { requestId });

    // Parse request body for configuration options
    let config = {};
    try {
      const body = await request.json();
      config = body.config || {};
    } catch (error: unknown) {
      // Use default config if no body provided
      config = {};
    }

    // Initialize and run test suite
    const testSuite = initializeIntegrationTestSuite(env, config);
    const results = await testSuite.runFullTestSuite();

    logger.info('Integration test suite completed', {
      overallStatus: results.overall_status,
      passed: results.passed,
      failed: results.failed,
      warnings: results.warnings,
      duration: results.total_duration_ms,
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(results, {
          source: 'live',
          ttl: 300, // 5 minutes
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error: unknown) {
    logger.error('RunFullTestSuite Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to run integration test suite',
          'TEST_SUITE_ERROR',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle quick health check
 * GET /api/v1/integration-tests/health-check
 */
async function handleHealthCheck(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    logger.info('Starting quick health check', { requestId });

    // Initialize and run quick health check
    const testSuite = initializeIntegrationTestSuite(env, {
      enablePerformanceTests: false,
      enableDataQualityTests: false,
      enableEndToEndTests: false
    });
    const results = await testSuite.runQuickHealthCheck();

    logger.info('Quick health check completed', {
      overallStatus: results.overall_status,
      passed: results.passed,
      failed: results.failed,
      duration: results.total_duration_ms,
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(results, {
          source: 'live',
          ttl: 60, // 1 minute
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error: unknown) {
    logger.error('HealthCheck Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to perform health check',
          'HEALTH_CHECK_ERROR',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle test status request
 * GET /api/v1/integration-tests/status
 */
async function handleTestStatus(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    // Get system status without running tests
    const status = {
      timestamp: new Date().toISOString(),
      system_status: 'operational',
      test_capabilities: {
        full_test_suite: true,
        quick_health_check: true,
        api_connectivity_tests: true,
        performance_tests: true,
        data_quality_tests: true,
        end_to_end_tests: true
      },
      environment: {
        environment: env.ENVIRONMENT || 'development',
        fred_api_available: !!env.FRED_API_KEY,
        ai_models_available: true,
        cache_available: true
      },
      last_test_results: null, // Would be populated from cache in production
      recommendations: [
        'Run POST /api/v1/integration-tests/run-full for comprehensive testing',
        'Run GET /api/v1/integration-tests/health-check for quick status check',
        'Monitor test results regularly to ensure system health'
      ]
    };

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(status, {
          source: 'static',
          ttl: 300,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error: unknown) {
    logger.error('TestStatus Error', error, { requestId });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to get test status',
          'STATUS_ERROR',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Integration test routes export
 */
export const integrationTestRoutes = {
  '/api/v1/integration-tests/run-full': handleRunFullTestSuite,
  '/api/v1/integration-tests/health-check': handleHealthCheck,
  '/api/v1/integration-tests/status': handleTestStatus
};

export default integrationTestRoutes;