/**
 * Backtesting API Routes (API v1)
 * Institutional-grade backtesting and model validation endpoints
 * Based on DAC project patterns
 */

import {
  ApiResponseFactory,
  HttpStatus,
  ProcessingTimer,
  generateRequestId
} from '../modules/api-v1-responses.js';
import {
  validateApiKey,
  parseQueryParams,
  generateRequestId as generateApiRequestId
} from './api-v1.js';
import { runBacktest } from '../modules/backtesting-engine.js';
import { createModelValidator } from '../modules/model-validator.js';
import { createWalkForwardOptimizer } from '../modules/advanced-validation.js';
import { createMonteCarloSimulator } from '../modules/advanced-validation.js';
import { createSimplifiedEnhancedDAL } from '../modules/simplified-enhanced-dal.js';
import { createBacktestingStorage } from '../modules/backtesting-storage.js';
import { createBacktestingCache } from '../modules/backtesting-cache.js';
import { createLogger } from '../modules/logging.js';
import type {
  CloudflareEnvironment,
  BacktestConfig,
  RunBacktestRequest,
  RunBacktestResponse,
  BacktestStatusResponse,
  BacktestResultsResponse,
  CompareBacktestsRequest,
  CompareBacktestsResponse,
  BacktestHistoryResponse,
  BacktestSummary
} from '../types/backtesting.js';

const logger = createLogger('backtesting-routes');

/**
 * Handle all backtesting routes
 */
export async function handleBacktestingRoutes(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const method = request.method;
  const url = new URL(request.url);
  const requestId = headers['X-Request-ID'] || generateApiRequestId();

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
    // POST /api/v1/backtesting/run - Execute backtesting simulation
    if (path === '/api/v1/backtesting/run' && method === 'POST') {
      return await handleRunBacktest(request, env, headers, requestId);
    }

    // GET /api/v1/backtesting/status/:id - Get backtest status
    const statusMatch = path.match(/^\/api\/v1\/backtesting\/status\/([a-zA-Z0-9_-]+)$/);
    if (statusMatch && method === 'GET') {
      const backtestId = statusMatch[1];
      return await handleBacktestStatus(backtestId, request, env, headers, requestId);
    }

    // GET /api/v1/backtesting/results/:id - Retrieve backtesting results
    const resultsMatch = path.match(/^\/api\/v1\/backtesting\/results\/([a-zA-Z0-9_-]+)$/);
    if (resultsMatch && method === 'GET') {
      const backtestId = resultsMatch[1];
      return await handleGetBacktestResults(backtestId, request, env, headers, requestId);
    }

    // GET /api/v1/backtesting/performance/:id - Get detailed performance metrics
    const performanceMatch = path.match(/^\/api\/v1\/backtesting\/performance\/([a-zA-Z0-9_-]+)$/);
    if (performanceMatch && method === 'GET') {
      const backtestId = performanceMatch[1];
      return await handleGetPerformanceMetrics(backtestId, request, env, headers, requestId);
    }

    // POST /api/v1/backtesting/compare - Compare multiple strategies
    if (path === '/api/v1/backtesting/compare' && method === 'POST') {
      return await handleCompareBacktests(request, env, headers, requestId);
    }

    // GET /api/v1/backtesting/history - List backtesting runs
    if (path === '/api/v1/backtesting/history' && method === 'GET') {
      return await handleBacktestHistory(request, env, headers, requestId);
    }

    // GET /api/v1/backtesting/validate/:id - Get validation results
    const validationMatch = path.match(/^\/api\/v1\/backtesting\/validate\/([a-zA-Z0-9_-]+)$/);
    if (validationMatch && method === 'GET') {
      const backtestId = validationMatch[1];
      return await handleGetValidationResults(backtestId, request, env, headers, requestId);
    }

    // POST /api/v1/backtesting/walk-forward/:id - Run walk-forward optimization
    const walkForwardMatch = path.match(/^\/api\/v1\/backtesting\/walk-forward\/([a-zA-Z0-9_-]+)$/);
    if (walkForwardMatch && method === 'POST') {
      const backtestId = walkForwardMatch[1];
      return await handleWalkForwardOptimization(backtestId, request, env, headers, requestId);
    }

    // POST /api/v1/backtesting/monte-carlo/:id - Run Monte Carlo simulation
    const monteCarloMatch = path.match(/^\/api\/v1\/backtesting\/monte-carlo\/([a-zA-Z0-9_-]+)$/);
    if (monteCarloMatch && method === 'POST') {
      const backtestId = monteCarloMatch[1];
      return await handleMonteCarloSimulation(backtestId, request, env, headers, requestId);
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
  } catch (error) {
    logger.error('BacktestingRoutes Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      path,
      method
    });

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
 * Handle backtesting execution request
 */
async function handleRunBacktest(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env, {
    enableCache: true,
    environment: env.ENVIRONMENT || 'production'
  });

  try {
    const requestBody: RunBacktestRequest = await request.json();

    // Validate backtest configuration
    const validationErrors = validateBacktestConfig(requestBody.config);
    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'Invalid backtest configuration',
            'INVALID_CONFIG',
            {
              requestId,
              errors: validationErrors
            }
          )
        ),
        {
          status: HttpStatus.BAD_REQUEST,
          headers,
        }
      );
    }

    // Generate unique backtest ID
    const backtestId = generateBacktestId();

    // Initialize storage systems
    const storage = createBacktestingStorage(env);
    const cache = createBacktestingCache(env);

    // Store initial backtest run using storage manager
    await storage.storeBacktestRun(backtestId, requestBody.config, 'queued');

    logger.info('Backtest queued', {
      backtestId,
      strategy: requestBody.config.strategy.type,
      symbols: requestBody.config.data.symbols
    });

    // Start backtesting in background
    if (!requestBody.dryRun) {
      executeBacktestInBackground(backtestId, requestBody, env, storage, cache);
    }

    const response: RunBacktestResponse = {
      backtestId,
      status: 'queued',
      estimatedDuration: estimateBacktestDuration(requestBody.config),
      queuePosition: getQueuePosition(),
      startedAt: backtestStatusData.startedAt,
      estimatedCompletion: new Date(Date.now() + estimateBacktestDuration(requestBody.config) * 1000).toISOString()
    };

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          requestId,
          processingTime: timer.finish()
        })
      ),
      { status: HttpStatus.CREATED, headers }
    );

  } catch (error) {
    logger.error('RunBacktest Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to start backtest',
          'BACKTEST_START_ERROR',
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
 * Handle backtest status request
 */
async function handleBacktestStatus(
  backtestId: string,
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env, {
    enableCache: true,
    environment: env.ENVIRONMENT || 'production'
  });

  try {
    // Initialize storage systems
    const storage = createBacktestingStorage(env);

    // Get backtest run from storage
    const runData = await storage.getBacktestRun(backtestId);

    if (runData) {
      const response: BacktestStatusResponse = {
        backtestId,
        status: runData.status,
        progress: runData.progress || 0,
        currentStage: runData.currentStep || 'Unknown',
        startedAt: runData.createdAt,
        estimatedCompletion: runData.metadata?.estimatedCompletion,
        error: runData.error?.message,
        resultId: runData.resultId
      };

      return new Response(
        JSON.stringify(
          ApiResponseFactory.success(response, {
            source: 'storage',
            requestId,
            processingTime: timer.finish(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // Backtest not found
    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Backtest not found',
          'NOT_FOUND',
          { requestId, backtestId }
        )
      ),
      {
        status: HttpStatus.NOT_FOUND,
        headers,
      }
    );

  } catch (error) {
    logger.error('BacktestStatus Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      backtestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to get backtest status',
          'STATUS_ERROR',
          {
            requestId,
            backtestId,
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
 * Handle backtest results request
 */
async function handleGetBacktestResults(
  backtestId: string,
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env, {
    enableCache: true,
    environment: env.ENVIRONMENT || 'production'
  });

  try {
    // Initialize storage systems
    const storage = createBacktestingStorage(env);

    // Get backtest results from storage
    const results = await storage.getBacktestResults(backtestId);

    if (results) {
      const response: BacktestResultsResponse = {
        id: backtestId,
        result: results,
        downloadUrls: generateDownloadUrls(backtestId, env),
        relatedBacktests: [] // TODO: Implement related backtest discovery
      };

      return new Response(
        JSON.stringify(
          ApiResponseFactory.success(response, {
            source: 'storage',
            requestId,
            processingTime: timer.finish(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // Result not found
    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Backtest results not found',
          'NOT_FOUND',
          { requestId, backtestId }
        )
      ),
      {
        status: HttpStatus.NOT_FOUND,
        headers,
      }
    );

  } catch (error) {
    logger.error('GetBacktestResults Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      backtestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to get backtest results',
          'RESULTS_ERROR',
          {
            requestId,
            backtestId,
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
 * Handle performance metrics request
 */
async function handleGetPerformanceMetrics(
  backtestId: string,
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env, {
    enableCache: true,
    environment: env.ENVIRONMENT || 'production'
  });

  try {
    // Initialize storage systems
    const storage = createBacktestingStorage(env);

    // Get performance metrics from storage
    const metrics = await storage.getPerformanceMetrics(backtestId);

    if (!metrics) {
      // If metrics not found separately, try to get from full results
      const results = await storage.getBacktestResults(backtestId);
      if (!results) {
        return new Response(
          JSON.stringify(
            ApiResponseFactory.error(
              'Backtest results not found',
              'NOT_FOUND',
              { requestId, backtestId }
            )
          ),
          {
            status: HttpStatus.NOT_FOUND,
            headers,
          }
        );
      }

      // Return detailed performance metrics from full results
      const performanceDetails = {
        basic: results.performanceMetrics,
        risk: results.riskMetrics,
        attribution: results.attributionAnalysis,
        sector: results.sectorAnalysis,
        regime: results.regimeAnalysis,
        correlation: results.correlationAnalysis
      };

      return new Response(
        JSON.stringify(
          ApiResponseFactory.success(performanceDetails, {
            source: 'storage',
            requestId,
            processingTime: timer.finish()
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // Return cached performance metrics
    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(metrics, {
          source: 'cached',
          requestId,
          processingTime: timer.finish()
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error) {
    logger.error('GetPerformanceMetrics Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      backtestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to get performance metrics',
          'PERFORMANCE_ERROR',
          {
            requestId,
            backtestId,
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
 * Handle backtest comparison request
 */
async function handleCompareBacktests(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env, {
    enableCache: true,
    environment: env.ENVIRONMENT || 'production'
  });

  try {
    const requestBody: CompareBacktestsRequest = await request.json();

    // Validate request
    if (!requestBody.backtestIds || requestBody.backtestIds.length < 2) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'At least 2 backtest IDs required for comparison',
            'INVALID_REQUEST',
            { requestId }
          )
        ),
        {
          status: HttpStatus.BAD_REQUEST,
          headers,
        }
      );
    }

    // Fetch all backtest results
    const backtestResults = [];
    for (const backtestId of requestBody.backtestIds) {
      const cached = await dal.read(`backtest_result_${backtestId}`);
      if (cached.success && cached.data) {
        backtestResults.push({
          id: backtestId,
          ...cached.data
        });
      }
    }

    if (backtestResults.length < 2) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'Insufficient valid backtest results found',
            'INSUFFICIENT_DATA',
            { requestId, foundCount: backtestResults.length }
          )
        ),
        {
          status: HttpStatus.BAD_REQUEST,
          headers,
        }
      );
    }

    // Perform comparison analysis
    const comparison = await performBacktestComparison(backtestResults, requestBody);
    const ranking = generateRanking(backtestResults);
    const statisticalTests = performComparisonStatisticalTests(backtestResults);
    const recommendations = generateComparisonRecommendations(comparison, statisticalTests);

    const response: CompareBacktestsResponse = {
      comparison,
      ranking,
      statisticalTests,
      recommendations
    };

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          requestId,
          processingTime: timer.finish()
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error) {
    logger.error('CompareBacktests Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to compare backtests',
          'COMPARISON_ERROR',
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
 * Handle backtest history request
 */
async function handleBacktestHistory(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env, {
    enableCache: true,
    environment: env.ENVIRONMENT || 'production'
  });

  try {
    const url = new URL(request.url);
    const params = parseQueryParams(url);

    // Initialize storage systems
    const storage = createBacktestingStorage(env);

    // Parse pagination parameters
    const page = parseInt(params.page as string) || 1;
    const pageSize = Math.min(parseInt(params.pageSize as string) || 10, 50);
    const status = params.status as string;
    const strategy = params.strategy as string;

    // Build filters object
    const filters: any = {};
    if (status) filters.status = status;
    if (strategy) filters.strategy = strategy;

    // Query backtest history using storage manager
    const historyResult = await storage.getBacktestHistory(filters, {
      page,
      limit: pageSize
    });

    const response: BacktestHistoryResponse = {
      backtests: historyResult.runs,
      pagination: {
        page,
        pageSize,
        total: historyResult.pagination.total,
        totalPages: historyResult.pagination.pages,
        hasNext: page < historyResult.pagination.pages,
        hasPrev: page > 1
      },
      filters: {
        appliedFilters: { status, strategy },
        availableFilters: [
          { field: 'status', type: 'select', options: ['queued', 'running', 'completed', 'failed'] },
          { field: 'strategy', type: 'text' },
          { field: 'dateRange', type: 'date' }
        ]
      }
    };

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          requestId,
          processingTime: timer.finish()
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error) {
    logger.error('BacktestHistory Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to get backtest history',
          'HISTORY_ERROR',
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
 * Handle validation results request
 */
async function handleGetValidationResults(
  backtestId: string,
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env, {
    enableCache: true,
    environment: env.ENVIRONMENT || 'production'
  });

  try {
    // Check if validation results exist
    const cached = await dal.read(`backtest_validation_${backtestId}`);

    if (cached.success && cached.data) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cached.data, 'hit', {
            source: 'cache',
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // If validation results don't exist, trigger validation
    const resultCached = await dal.read(`backtest_result_${backtestId}`);
    if (!resultCached.success || !resultCached.data) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'Backtest results not found',
            'NOT_FOUND',
            { requestId, backtestId }
          )
        ),
        {
          status: HttpStatus.NOT_FOUND,
          headers,
        }
      );
    }

    // Run validation in background and return status
    runValidationInBackground(backtestId, resultCached.data, env);

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success({
          status: 'running',
          message: 'Validation started in background',
          backtestId
        }, {
          source: 'fresh',
          requestId,
          processingTime: timer.finish()
        })
      ),
      { status: HttpStatus.ACCEPTED, headers }
    );

  } catch (error) {
    logger.error('GetValidationResults Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      backtestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to get validation results',
          'VALIDATION_ERROR',
          {
            requestId,
            backtestId,
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
 * Handle walk-forward optimization request
 */
async function handleWalkForwardOptimization(
  backtestId: string,
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env, {
    enableCache: true,
    environment: env.ENVIRONMENT || 'production'
  });

  try {
    // Get backtest results
    const resultCached = await dal.read(`backtest_result_${backtestId}`);
    if (!resultCached.success || !resultCached.data) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'Backtest results not found',
            'NOT_FOUND',
            { requestId, backtestId }
          )
        ),
        {
          status: HttpStatus.NOT_FOUND,
          headers,
        }
      );
    }

    // Check if walk-forward results already exist
    const wfCached = await dal.read(`backtest_walkforward_${backtestId}`);
    if (wfCached.success && wfCached.data) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(wfCached.data, 'hit', {
            source: 'cache',
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // Run walk-forward optimization in background
    runWalkForwardInBackground(backtestId, resultCached.data, env);

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success({
          status: 'running',
          message: 'Walk-forward optimization started in background',
          backtestId
        }, {
          source: 'fresh',
          requestId,
          processingTime: timer.finish()
        })
      ),
      { status: HttpStatus.ACCEPTED, headers }
    );

  } catch (error) {
    logger.error('WalkForwardOptimization Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      backtestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to start walk-forward optimization',
          'WALK_FORWARD_ERROR',
          {
            requestId,
            backtestId,
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
 * Handle Monte Carlo simulation request
 */
async function handleMonteCarloSimulation(
  backtestId: string,
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const dal = createSimplifiedEnhancedDAL(env, {
    enableCache: true,
    environment: env.ENVIRONMENT || 'production'
  });

  try {
    const requestBody = await request.json();
    const numSimulations = requestBody.numSimulations || 1000;

    // Get backtest results
    const resultCached = await dal.read(`backtest_result_${backtestId}`);
    if (!resultCached.success || !resultCached.data) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'Backtest results not found',
            'NOT_FOUND',
            { requestId, backtestId }
          )
        ),
        {
          status: HttpStatus.NOT_FOUND,
          headers,
        }
      );
    }

    // Check if Monte Carlo results already exist
    const mcCached = await dal.read(`backtest_montecarlo_${backtestId}`);
    if (mcCached.success && mcCached.data) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(mcCached.data, 'hit', {
            source: 'cache',
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // Run Monte Carlo simulation in background
    runMonteCarloInBackground(backtestId, resultCached.data, env, numSimulations);

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success({
          status: 'running',
          message: 'Monte Carlo simulation started in background',
          backtestId,
          numSimulations
        }, {
          source: 'fresh',
          requestId,
          processingTime: timer.finish()
        })
      ),
      { status: HttpStatus.ACCEPTED, headers }
    );

  } catch (error) {
    logger.error('MonteCarloSimulation Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      backtestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to start Monte Carlo simulation',
          'MONTE_CARLO_ERROR',
          {
            requestId,
            backtestId,
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

// ===== Helper Functions =====

function generateBacktestId(): string {
  return `bt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

function estimateBacktestDuration(config: BacktestConfig): number {
  // Simplified duration estimation in seconds
  const baseTime = 30; // 30 seconds base
  const symbolsMultiplier = config.data.symbols.length * 5; // 5 seconds per symbol
  const yearsMultiplier = Math.ceil(
      (new Date(config.data.endDate).getTime() - new Date(config.data.startDate).getTime()) /
      (1000 * 60 * 60 * 24 * 365)
    ) * 10; // 10 seconds per year

  return baseTime + symbolsMultiplier + yearsMultiplier;
}

function getQueuePosition(): number {
  // Simplified queue position
  return backtestStatus.size + 1;
}

function validateBacktestConfig(config: BacktestConfig): string[] {
  const errors: string[] = [];

  if (!config.id || config.id.trim() === '') {
    errors.push('Backtest ID is required');
  }

  if (!config.name || config.name.trim() === '') {
    errors.push('Backtest name is required');
  }

  if (!config.strategy || !config.strategy.type) {
    errors.push('Strategy configuration is required');
  }

  if (!config.data || !config.data.symbols || config.data.symbols.length === 0) {
    errors.push('At least one symbol is required');
  }

  if (!config.data.startDate || !config.data.endDate) {
    errors.push('Start and end dates are required');
  }

  if (config.data.startDate >= config.data.endDate) {
    errors.push('End date must be after start date');
  }

  if (!config.execution || config.execution.initialCapital <= 0) {
    errors.push('Initial capital must be positive');
  }

  return errors;
}

async function executeBacktestInBackground(
  backtestId: string,
  request: RunBacktestRequest,
  env: CloudflareEnvironment,
  storage: any,
  cache: any
): Promise<void> {
  try {
    // Update status to running
    await storage.updateRunStatus(backtestId, 'running', 0, 'Initializing simulation');

    // Run backtest
    const result = await runBacktest(request.config, env);

    // Store results using storage manager
    await storage.storeBacktestResults(backtestId, result);

    // Cache performance metrics for faster retrieval
    await cache.cachePerformanceMetrics(backtestId, result.performanceMetrics);

    logger.info('Backtest completed', {
      backtestId,
      finalReturn: result.performanceMetrics?.totalReturn || result.performance?.totalReturn
    });

  } catch (error) {
    // Update status to failed
    await storage.updateRunStatus(backtestId, 'failed', null, 'Failed', error);

    logger.error('Background backtest failed', {
      backtestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function generateDownloadUrls(backtestId: string, env: CloudflareEnvironment): any {
  const baseUrl = `https://${env.CLOUDFLARE_API_URL || 'api.example.com'}/backtesting/${backtestId}`;

  return {
    pdf: `${baseUrl}/download/pdf`,
    csv: `${baseUrl}/download/csv`,
    json: `${baseUrl}/download/json`,
    excel: `${baseUrl}/download/excel`
  };
}

async function findRelatedBacktests(backtestId: string, dal: any): Promise<string[]> {
  // Simplified related backtest finding
  // In a real implementation, this would use similarity metrics
  return [];
}

async function queryBacktestHistory(
  dal: any,
  filters: any
): Promise<BacktestSummary[]> {
  // Simplified history query
  // In a real implementation, this would query a proper database
  return [];
}

async function countBacktestHistory(dal: any, filters: any): Promise<number> {
  // Simplified count query
  return 0;
}

async function performBacktestComparison(backtestResults: any[], request: CompareBacktestsRequest): Promise<any> {
  // Simplified comparison logic
  const metrics = request.metrics || ['totalReturn', 'sharpeRatio', 'maxDrawdown', 'winRate'];
  const comparisonData: any = {};

  for (const metric of metrics) {
    comparisonData[metric] = backtestResults.map(result => result.performance[metric] || 0);
  }

  return {
    backtestIds: backtestResults.map(r => r.id),
    metrics: comparisonData,
    statisticalSignificance: {},
    charts: []
  };
}

function generateRanking(backtestResults: any[]): any {
  // Simplified ranking logic
  return {
    bySharpe: [],
    byReturn: [],
    byCalmar: [],
    byWinRate: [],
    overall: []
  };
}

function performComparisonStatisticalTests(backtestResults: any[]): any[] {
  // Simplified statistical tests
  return [];
}

function generateComparisonRecommendations(comparison: any, tests: any[]): any[] {
  // Simplified recommendations
  return [];
}

async function runValidationInBackground(
  backtestId: string,
  result: any,
  env: CloudflareEnvironment
): Promise<void> {
  try {
    const storage = createBacktestingStorage(env);
    const cache = createBacktestingCache(env);

    const validator = createModelValidator(
      result.config,
      env,
      result.equityCurve,
      result.trades,
      result.positions
    );

    const validation = await validator.validateModel();

    // Store validation results using storage manager
    await storage.storeValidationResults(backtestId, validation);

    // Cache validation results for faster retrieval
    await cache.cacheValidationResults(`validation_${backtestId}`, validation);

    logger.info('Validation completed', { backtestId, overallScore: validation.overallScore });

  } catch (error) {
    logger.error('Background validation failed', {
      backtestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function runWalkForwardInBackground(
  backtestId: string,
  result: any,
  env: CloudflareEnvironment
): Promise<void> {
  try {
    const storage = createBacktestingStorage(env);
    const cache = createBacktestingCache(env);

    const optimizer = createWalkForwardOptimizer(
      result.config,
      env,
      result.equityCurve,
      result.trades,
      result.positions
    );

    const walkForwardResult = await optimizer.performWalkForwardOptimization();

    // Store walk-forward results using storage manager
    await storage.storeValidationResults(`walkforward_${backtestId}`, walkForwardResult);

    // Cache walk-forward results for faster retrieval
    await cache.cacheValidationResults(`walkforward_${backtestId}`, walkForwardResult);

    logger.info('Walk-forward optimization completed', { backtestId });

  } catch (error) {
    logger.error('Background walk-forward optimization failed', {
      backtestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function runMonteCarloInBackground(
  backtestId: string,
  result: any,
  env: CloudflareEnvironment,
  numSimulations: number
): Promise<void> {
  try {
    const storage = createBacktestingStorage(env);
    const cache = createBacktestingCache(env);

    const simulator = createMonteCarloSimulator(
      result.config,
      env,
      result.equityCurve,
      result.trades,
      result.positions
    );

    const monteCarloResult = await simulator.performMonteCarloSimulation(numSimulations);

    // Store Monte Carlo results using storage manager
    await storage.storeValidationResults(`montecarlo_${backtestId}`, monteCarloResult);

    // Cache Monte Carlo results for faster retrieval
    await cache.cacheValidationResults(`montecarlo_${backtestId}`, monteCarloResult);

    logger.info('Monte Carlo simulation completed', {
      backtestId,
      numSimulations,
      meanReturn: monteCarloResult.summary.meanReturn
    });

  } catch (error) {
    logger.error('Background Monte Carlo simulation failed', {
      backtestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}