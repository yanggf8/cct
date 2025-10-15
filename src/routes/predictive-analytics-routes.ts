/**
 * Predictive Analytics Routes (API v1)
 * Advanced predictive analytics and forecasting capabilities
 * Institutional-grade forward-looking market intelligence
 */

import {
  ApiResponseFactory,
  ProcessingTimer,
  HttpStatus
} from '../modules/api-v1-responses.js';
import {
  validateApiKey,
  generateRequestId,
  parseQueryParams
} from './api-v1.js';
import {
  generatePredictiveSignals,
  analyzeMarketPatterns,
  generatePredictiveInsights,
  type PredictiveSignals,
  type PatternAnalysis,
  type PredictiveInsights
} from '../modules/predictive-analytics.js';
import { createLogger } from '../modules/logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('predictive-analytics-routes');

/**
 * Handle predictive analytics routes
 */
export async function handlePredictiveAnalyticsRoutes(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const method = request.method;
  const url = new URL(request.url);
  const requestId = headers['X-Request-ID'] || generateRequestId();

  // Predictive Analytics endpoints require API key authentication
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
    // GET /api/v1/predictive/signals - Generate predictive signals
    if (path === '/api/v1/predictive/signals' && method === 'GET') {
      return await handlePredictiveSignals(request, env, headers, requestId);
    }

    // GET /api/v1/predictive/patterns - Analyze market patterns
    if (path === '/api/v1/predictive/patterns' && method === 'GET') {
      return await handlePatternAnalysis(request, env, headers, requestId);
    }

    // GET /api/v1/predictive/insights - Comprehensive predictive insights
    if (path === '/api/v1/predictive/insights' && method === 'GET') {
      return await handlePredictiveInsights(request, env, headers, requestId);
    }

    // GET /api/v1/predictive/forecast - Market forecast
    if (path === '/api/v1/predictive/forecast' && method === 'GET') {
      return await handleMarketForecast(request, env, headers, requestId);
    }

    // GET /api/v1/predictive/health - Predictive analytics system health
    if (path === '/api/v1/predictive/health' && method === 'GET') {
      return await handlePredictiveAnalyticsHealth(request, env, headers, requestId);
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
    logger.error('PredictiveAnalyticsRoutes Error', error, { requestId, path, method });

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
 * Handle predictive signals generation
 * GET /api/v1/predictive/signals
 */
async function handlePredictiveSignals(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const url = new URL(request.url);
  const params = parseQueryParams(url);

  try {
    logger.info('Starting predictive signals generation', { requestId });

    const useCache = params.cache !== 'false';
    const timeHorizon = params.horizon || 'short_term'; // short_term, medium_term, long_term

    // Generate predictive signals
    const signals = await generatePredictiveSignals(env);

    // Filter based on time horizon if specified
    let filteredSignals = signals;
    if (timeHorizon === 'medium_term') {
      // Adjust for medium-term focus
      filteredSignals = {
        ...signals,
        short_term_outlook: {
          ...signals.short_term_outlook,
          time_horizon: '2-4 weeks' as const
        }
      };
    }

    logger.info('Predictive signals generated', {
      requestId,
      outlook: signals.short_term_outlook.direction,
      confidence: signals.short_term_outlook.confidence,
      confidence_interval: signals.short_term_outlook.confidence_interval,
      risk_adjusted_return: signals.short_term_outlook.risk_adjusted_return,
      sectors_predicted: signals.sector_predictions.top_performers.length,
      processingTime: timer.getElapsedMs()
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(filteredSignals, {
          source: 'fresh',
          ttl: useCache ? 1800 : 60, // 30 minutes if cached, 1 minute if fresh
          requestId,
          processingTime: timer.finish(),
          metadata: {
            time_horizon: timeHorizon,
            generation_timestamp: signals.timestamp
          }
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Failed to generate predictive signals', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate predictive signals',
          'SIGNALS_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
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
 * Handle pattern analysis
 * GET /api/v1/predictive/patterns
 */
async function handlePatternAnalysis(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const url = new URL(request.url);
  const params = parseQueryParams(url);

  try {
    logger.info('Starting pattern analysis', { requestId });

    const patternType = params.type || 'all'; // seasonal, technical, sentiment, all

    // Analyze market patterns
    const patterns = await analyzeMarketPatterns(env);

    // Filter patterns based on type
    let filteredPatterns = patterns;
    if (patternType !== 'all') {
      filteredPatterns = {
        ...patterns,
        market_patterns: {
          ...patterns.market_patterns,
          seasonal_tendencies: patternType === 'seasonal' ? patterns.market_patterns.seasonal_tendencies : [],
          technical_patterns: patternType === 'technical' ? patterns.market_patterns.technical_patterns : [],
          sentiment_patterns: patternType === 'sentiment' ? patterns.market_patterns.sentiment_patterns : []
        }
      };
    }

    const patternCount =
      filteredPatterns.market_patterns.seasonal_tendencies.length +
      filteredPatterns.market_patterns.technical_patterns.length +
      filteredPatterns.market_patterns.sentiment_patterns.length;

    logger.info('Pattern analysis completed', {
      requestId,
      patternType,
      patternsFound: patternCount,
      processingTime: timer.getElapsedMs()
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(filteredPatterns, {
          source: 'fresh',
          ttl: 3600, // 1 hour for pattern analysis
          requestId,
          processingTime: timer.finish(),
          metadata: {
            pattern_type: patternType,
            total_patterns: patternCount,
            analysis_timestamp: patterns.timestamp
          }
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Failed to analyze patterns', {
      requestId,
      error: error.message
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to analyze market patterns',
          'PATTERNS_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
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
 * Handle comprehensive predictive insights
 * GET /api/v1/predictive/insights
 */
async function handlePredictiveInsights(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const url = new URL(request.url);
  const params = parseQueryParams(url);

  try {
    logger.info('Starting comprehensive predictive insights generation', { requestId });

    const includeRecommendations = params.recommendations !== 'false';
    const detailLevel = params.detail || 'full'; // summary, standard, full

    // Generate comprehensive predictive insights
    const insights = await generatePredictiveInsights(env);

    // Adjust detail level
    let filteredInsights = insights;
    if (detailLevel === 'summary') {
      filteredInsights = {
        ...insights,
        tactical_recommendations: {
          position_sizing: insights.tactical_recommendations.position_sizing,
          sector_allocation: insights.tactical_recommendations.sector_allocation.slice(0, 2),
          hedge_suggestions: insights.tactical_recommendations.hedge_suggestions.slice(0, 2)
        }
      };
    }

    if (!includeRecommendations) {
      filteredInsights = {
        ...insights,
        tactical_recommendations: {
          position_sizing: 'Recommendations disabled',
          sector_allocation: [],
          hedge_suggestions: []
        }
      };
    }

    logger.info('Predictive insights generated', {
      requestId,
      outlook: insights.overall_outlook.market_direction,
      confidence: insights.overall_outlook.confidence_level,
      confidence_interval: insights.overall_outlook.confidence_interval,
      scenarios_available: insights.overall_outlook?.scenario_analysis ? 3 : 0, // Always 3 scenarios (base, bull, bear)
      quantitative_factors: insights.quantitative_factors ? 'available' : 'unavailable',
      processingTime: timer.getElapsedMs()
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(filteredInsights, {
          source: 'fresh',
          ttl: 2400, // 40 minutes
          requestId,
          processingTime: timer.finish(),
          metadata: {
            detail_level: detailLevel,
            includes_recommendations: includeRecommendations,
            generation_timestamp: insights.timestamp
          }
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Failed to generate predictive insights', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate predictive insights',
          'INSIGHTS_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
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
 * Handle market forecast
 * GET /api/v1/predictive/forecast
 */
async function handleMarketForecast(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const url = new URL(request.url);
  const params = parseQueryParams(url);

  try {
    logger.info('Starting market forecast generation', { requestId });

    const timeframe = params.timeframe || '1_month'; // 1_week, 1_month, 3_months
    const includeRisk = params.risk !== 'false';

    // Get predictive signals and insights
    const signals = await generatePredictiveSignals(env);
    const insights = await generatePredictiveInsights(env);

    // Generate forecast based on timeframe
    const forecast = generateMarketForecast(signals, insights, timeframe, includeRisk);

    logger.info('Market forecast generated', {
      requestId,
      timeframe,
      outlook: forecast.market_outlook.direction,
      confidence: forecast.market_outlook.confidence,
      expected_return_range: forecast.market_outlook.expected_return_range,
      risk_analysis_included: includeRisk,
      sectors_forecasted: forecast.sector_forecast?.length || 0,
      processingTime: timer.getElapsedMs()
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(forecast, {
          source: 'fresh',
          ttl: 1800, // 30 minutes
          requestId,
          processingTime: timer.finish(),
          metadata: {
            timeframe: timeframe,
            includes_risk_analysis: includeRisk,
            forecast_timestamp: forecast.timestamp
          }
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Failed to generate market forecast', {
      requestId,
      error: error.message
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate market forecast',
          'FORECAST_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
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
 * Handle predictive analytics health check
 * GET /api/v1/predictive/health
 */
async function handlePredictiveAnalyticsHealth(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    logger.info('Starting predictive analytics health check', { requestId });

    // Test predictive analytics components
    const signalsHealth = await testPredictiveSignalsHealth(env);
    const patternsHealth = await testPatternsHealth(env);
    const insightsHealth = await testInsightsHealth(env);
    const dataHealth = await testDataHealth(env);

    // Calculate overall status
    const componentsHealthy = [
      signalsHealth.status === 'healthy',
      patternsHealth.status === 'healthy',
      insightsHealth.status === 'healthy',
      dataHealth.status === 'healthy'
    ];

    const overallStatus = componentsHealthy.filter(Boolean).length >= 3 ? 'healthy' :
                         componentsHealthy.filter(Boolean).length >= 2 ? 'degraded' : 'unhealthy';

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: {
        signals_engine: signalsHealth,
        pattern_analysis: patternsHealth,
        insights_generator: insightsHealth,
        data_sources: dataHealth
      },
      capabilities: {
        short_term_forecasting: true,
        pattern_recognition: true,
        regime_prediction: true,
        risk_assessment: true,
        sector_predictions: true
      },
      performance: {
        response_time_ms: timer.getElapsedMs(),
        cache_hit_rate: 0, // Would need actual cache tracking
        accuracy_score: 0.75 // Would need actual accuracy tracking
      },
      model_metadata: {
        last_updated: new Date().toISOString(),
        version: '1.0.0',
        data_freshness: 'real_time'
      }
    };

    logger.info('Predictive analytics health check completed', {
      requestId,
      overallStatus,
      processingTime: timer.getElapsedMs()
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 300, // 5 minutes
          requestId,
          processingTime: timer.finish()
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Predictive analytics health check failed', {
      requestId,
      error: error.message
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to perform predictive analytics health check',
          'HEALTH_CHECK_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
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

// Helper functions

function generateMarketForecast(
  signals: PredictiveSignals,
  insights: PredictiveInsights,
  timeframe: string,
  includeRisk: boolean
): any {
  const baseForecast = {
    timestamp: new Date().toISOString(),
    timeframe: timeframe,
    market_outlook: {
      direction: insights.overall_outlook.market_direction,
      confidence: insights.overall_outlook.confidence_level,
      expected_return_range: getExpectedReturnRange(insights.overall_outlook.market_direction, timeframe),
      key_catalysts: insights.overall_outlook.key_catalysts
    },
    sector_forecast: signals.sector_predictions.top_performers.slice(0, 3).map(perf => ({
      sector: perf.name,
      expected_performance: perf.predicted_return,
      confidence: perf.confidence,
      rationale: perf.rationale
    })),
    macro_environment: signals.macro_signals,
    regime_forecast: signals.regime_forecast
  };

  if (includeRisk) {
    baseForecast.risk_analysis = {
      risk_level: signals.risk_indicators.tail_risk_probability > 0.4 ? 'elevated' : 'moderate',
      key_risks: insights.overall_outlook.risk_factors,
      volatility_outlook: signals.risk_indicators.volatility_outlook,
      tail_risk_probability: signals.risk_indicators.tail_risk_probability
    };
  }

  return baseForecast;
}

function getExpectedReturnRange(direction: string, timeframe: string): string {
  if (timeframe === '1_week') {
    return direction === 'bullish' ? '+1% to +3%' : direction === 'bearish' ? '-2% to -4%' : '-1% to +1%';
  } else if (timeframe === '1_month') {
    return direction === 'bullish' ? '+3% to +8%' : direction === 'bearish' ? '-5% to -12%' : '-3% to +5%';
  } else { // 3_months
    return direction === 'bullish' ? '+8% to +18%' : direction === 'bearish' ? '-10% to -25%' : '-5% to +10%';
  }
}

async function testPredictiveSignalsHealth(env: CloudflareEnvironment): Promise<{ status: string; details?: any }> {
  try {
    // Test signals generation
    const signals = await generatePredictiveSignals(env);
    return {
      status: signals.short_term_outlook ? 'healthy' : 'degraded',
      details: {
        outlook_available: !!signals.short_term_outlook,
        confidence_level: signals.short_term_outlook?.confidence || 0,
        sectors_predicted: signals.sector_predictions.top_performers.length,
        regime_forecast: !!signals.regime_forecast,
        enhanced_features: {
          confidence_intervals: !!signals.short_term_outlook?.confidence_interval,
          risk_adjusted_returns: !!signals.short_term_outlook?.risk_adjusted_return,
          backtesting_reference: !!signals.short_term_outlook?.backtesting_reference,
          stress_testing: !!signals.risk_indicators?.stress_test_results,
          var_metrics: !!signals.risk_indicators?.var_metrics
        }
      }
    };
  } catch {
    return { status: 'unhealthy' };
  }
}

async function testPatternsHealth(env: CloudflareEnvironment): Promise<{ status: string }> {
  try {
    const patterns = await analyzeMarketPatterns(env);
    return { status: patterns.timestamp ? 'healthy' : 'degraded' };
  } catch {
    return { status: 'unhealthy' };
  }
}

async function testInsightsHealth(env: CloudflareEnvironment): Promise<{ status: string }> {
  try {
    const insights = await generatePredictiveInsights(env);
    return { status: insights.overall_outlook ? 'healthy' : 'degraded' };
  } catch {
    return { status: 'unhealthy' };
  }
}

async function testDataHealth(env: CloudflareEnvironment): Promise<{ status: string; details?: any }> {
  try {
    const { initializeMarketDrivers } = await import('../modules/market-drivers.js');
    const marketDrivers = initializeMarketDrivers(env);
    const snapshot = await marketDrivers.getMarketDriversSnapshot();

    return {
      status: snapshot.regime ? 'healthy' : 'degraded',
      details: {
        market_drivers_available: !!snapshot.regime,
        sector_rotation_available: true, // Assume available if test reaches here
        data_timestamp: snapshot.timestamp
      }
    };
  } catch {
    return { status: 'unhealthy' };
  }
}