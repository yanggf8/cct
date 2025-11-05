/**
 * Sentiment Analysis Routes (API v1)
 * Handles all sentiment-related endpoints
 * Based on DAC project patterns
 */

import {
  ApiResponseFactory,
  SentimentAnalysisResponse,
  SymbolSentimentResponse,
  MarketSentimentData,
  SectorSentimentData,
  ProcessingTimer,
  HttpStatus
} from '../modules/api-v1-responses.js';
import {
  validateApiKey,
  parseQueryParams,
  extractSymbolsParam,
  generateRequestId
} from './api-v1.js';
import { batchDualAIAnalysis, enhancedBatchDualAIAnalysis } from '../modules/dual-ai-analysis.js';
import { createSimplifiedEnhancedDAL } from '../modules/simplified-enhanced-dal.js';
import { createLogger } from '../modules/logging.js';
import { createCacheInstance } from '../modules/dual-cache-do.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('sentiment-routes');

/**
 * Cache helper function - only for Durable Objects cache
 * External APIs use KV cache independently
 */
async function getFromCache(key: string, cacheInstance: any, namespace: string = 'sentiment_analysis'): Promise<any | null> {
  if (!cacheInstance) {
    return null; // Cache disabled
  }
  // Durable Objects cache interface only
  return await cacheInstance.get(key, { ttl: 3600, namespace });
}

async function setCache(key: string, data: any, cacheInstance: any, namespace: string = 'sentiment_analysis', ttl: number = 3600): Promise<void> {
  if (!cacheInstance) {
    return; // Cache disabled
  }
  // Durable Objects cache interface only
  await cacheInstance.set(key, data, { ttl, namespace });
}

/**
 * Handle all sentiment analysis routes
 */
export async function handleSentimentRoutes(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const method = request.method;
  const url = new URL(request.url);
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
    // GET /api/v1/sentiment/analysis - Multi-symbol analysis
    if (path === '/api/v1/sentiment/analysis' && method === 'GET') {
      return await handleSentimentAnalysis(request, env, headers, requestId);
    }

    // GET /api/v1/sentiment/symbols/:symbol - Single symbol analysis
    const symbolMatch = path.match(/^\/api\/v1\/sentiment\/symbols\/([A-Z0-9]{1,10})$/);
    if (symbolMatch && method === 'GET') {
      const symbol = symbolMatch[1];
      return await handleSymbolSentiment(symbol, request, env, headers, requestId);
    }

    // GET /api/v1/sentiment/market - Market-wide sentiment
    if (path === '/api/v1/sentiment/market' && method === 'GET') {
      return await handleMarketSentiment(request, env, headers, requestId);
    }

    // GET /api/v1/sentiment/sectors - Sector sentiment analysis
    if (path === '/api/v1/sentiment/sectors' && method === 'GET') {
      return await handleSectorSentiment(request, env, headers, requestId);
    }

    // Note: Fine-grained endpoints temporarily removed - not yet implemented
    // // GET /api/v1/sentiment/fine-grained/:symbol - Fine-grained per-symbol analysis
    // const fgMatch = path.match(/^\/api\/v1\/sentiment\/fine-grained\/([A-Z0-9]{1,10})$/);
    // if (fgMatch && method === 'GET') {
    //   const symbol = fgMatch[1];
    //   return await handleFineGrainedSymbol(symbol, request, env, headers, requestId);
    // }

    // // POST /api/v1/sentiment/fine-grained/batch - Batch fine-grained analysis
    // if (path === '/api/v1/sentiment/fine-grained/batch' && method === 'POST') {
    //   return await handleFineGrainedBatch(request, env, headers, requestId);
    // }

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
    logger.error('SentimentRoutes Error', {
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
 * Handle multi-symbol sentiment analysis
 * GET /api/v1/sentiment/analysis?symbols=AAPL,MSFT,GOOGL
 */
async function handleSentimentAnalysis(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  // Use Durable Objects cache if enabled, otherwise no cache (simple)
  // External APIs (FMP, NewsAPI) use KV cache independently
  const cacheInstance = createCacheInstance(env, true);
  if (cacheInstance) {
    logger.info('SENTIMENT_ROUTES', 'Using Durable Objects cache (L1)');
  } else {
    // No cache - simple, direct execution
    logger.info('SENTIMENT_ROUTES', 'No cache (L1 disabled)');
  }
  const url = new URL(request.url);
  const params = parseQueryParams(url);

  try {
    // Extract symbols from query parameters
    const symbols = extractSymbolsParam(params);

    if (symbols.length === 0) {
      // Use default symbols if none provided
      const defaultSymbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];
      symbols.push(...defaultSymbols);
    }

    // Check cache first
    const cacheKey = `sentiment_analysis_${symbols.join(',')}_${new Date().toISOString().split('T')[0]}`;
    const cached = await getFromCache(cacheKey, cacheInstance);

    if (cached && cached.success && cached.data) {
      logger.info('SentimentAnalysis: Cache hit', { symbols: symbols.join(','), requestId });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cached.data, 'hit', {
            source: 'cache',
            ttl: 3600,
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // Perform fresh analysis
    logger.info('SentimentAnalysis: Starting analysis', { symbols: symbols.join(','), requestId });

      // Use enhanced batch analysis for optimization (50-70% KV reduction)
    const analysisResult = await enhancedBatchDualAIAnalysis(symbols, env, {
      enableOptimizedBatch: true,
      batchSize: 3, // Conservative for AI rate limits
      cacheKey: `sentiment_analysis_${symbols.join(',')}_${new Date().toISOString().split('T')[0]}`
    });

    // Transform BatchDualAIAnalysisResult to v1 response format
    const response: SentimentAnalysisResponse = {
      symbols,
      analysis: {
        timestamp: new Date().toISOString(),
        market_sentiment: {
          overall_sentiment: calculateOverallSentiment(analysisResult.results),
          sentiment_label: getSentimentLabel(calculateOverallSentiment(analysisResult.results)),
          confidence: calculateOverallConfidence(analysisResult.results),
        },
        signals: transformBatchResultsToSignals(analysisResult.results),
        overall_confidence: calculateOverallConfidence(analysisResult.results),
      },
      metadata: {
        analysis_time_ms: timer.getElapsedMs(),
        ai_models_used: ['GPT-OSS-120B', 'DistilBERT-SST-2'],
        data_sources: ['Yahoo Finance', 'News APIs'],
        ...(analysisResult.optimization && {
          optimization: {
            enabled: true,
            cacheHitRate: analysisResult.optimization.cacheHitRate,
            kvReduction: analysisResult.optimization.kvReduction,
            timeSaved: analysisResult.optimization.timeSaved,
            batchEfficiency: analysisResult.optimization.batchEfficiency,
            cachedItems: analysisResult.optimization.statistics.cachedItems,
            deduplicationRate: analysisResult.optimization.statistics.deduplicationRate
          }
        })
      },
    };

    // Cache the result for 1 hour
    await setCache(cacheKey, response, cacheInstance);

    logger.info('SentimentAnalysis: Analysis complete', {
      symbols: symbols.join(','),
      processingTime: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 3600,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error: unknown) {
    logger.error('SentimentAnalysis Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to perform sentiment analysis',
          'ANALYSIS_ERROR',
          { requestId, error: error instanceof Error ? error.message : 'Unknown error' }
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
 * Handle single symbol sentiment analysis
 * GET /api/v1/sentiment/symbols/:symbol
 */
async function handleSymbolSentiment(
  symbol: string,
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  // Use Durable Objects cache if enabled, otherwise no cache (simple)
  // External APIs (FMP, NewsAPI) use KV cache independently
  const cacheInstance = createCacheInstance(env, true);
  if (cacheInstance) {
    logger.info('SENTIMENT_ROUTES', 'Using Durable Objects cache (L1)');
  } else {
    // No cache - simple, direct execution
    logger.info('SENTIMENT_ROUTES', 'No cache (L1 disabled)');
  }

  try {
    // Validate symbol
    if (!symbol || symbol.length > 10) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'Invalid symbol format',
            'INVALID_SYMBOL',
            { requestId, symbol }
          )
        ),
        {
          status: HttpStatus.BAD_REQUEST,
          headers,
        }
      );
    }

    // Check cache first
    const cacheKey = `symbol_sentiment_${symbol}_${new Date().toISOString().split('T')[0]}`;
    const cached = await getFromCache(cacheKey, cacheInstance);

    if (cached && cached.success && cached.data) {
      logger.info('SymbolSentiment: Cache hit', { symbol, requestId });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cached.data, 'hit', {
            source: 'cache',
            ttl: 3600,
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // Perform fresh analysis for single symbol
    logger.info('SymbolSentiment: Starting analysis', { symbol, requestId });

    const analysisResult = await batchDualAIAnalysis([symbol], env);

    if (!analysisResult.results || analysisResult.results.length === 0 || analysisResult.results[0].error) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'No analysis data available for symbol',
            'NO_DATA',
            { requestId, symbol }
          )
        ),
        {
          status: HttpStatus.NOT_FOUND,
          headers,
        }
      );
    }

    const singleResult = analysisResult.results[0];
    const transformedSignal = transformBatchResultsToSignals([singleResult])[0];

    // Transform to v1 response format
    const response: SymbolSentimentResponse = {
      symbol,
      analysis: {
        gpt_analysis: {
          sentiment: transformedSignal.gpt_sentiment || 'neutral',
          confidence: transformedSignal.gpt_confidence || 0.5,
          reasoning: transformedSignal.gpt_reasoning || '',
          model: 'GPT-OSS-120B',
        },
        distilbert_analysis: {
          sentiment: transformedSignal.distilbert_sentiment || 'neutral',
          confidence: transformedSignal.distilbert_confidence || 0.5,
          sentiment_breakdown: {
            positive: transformedSignal.distilbert_positive || 0,
            negative: transformedSignal.distilbert_negative || 0,
            neutral: transformedSignal.distilbert_neutral || 0,
          },
          model: 'DistilBERT-SST-2',
        },
        agreement: {
          type: transformedSignal.agreement_type || 'DISAGREE',
          confidence: transformedSignal.overall_confidence || 0.5,
          recommendation: transformedSignal.recommendation || 'HOLD',
        },
      },
      news: {
        articles_analyzed: transformedSignal.news_count || 0,
        top_articles: transformedSignal.top_articles || [],
      },
    };

    // Cache the result for 1 hour
    await setCache(cacheKey, response, cacheInstance);

    logger.info('SymbolSentiment: Analysis complete', {
      symbol,
      processingTime: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 3600,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error: unknown) {
    logger.error('SymbolSentiment Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
        symbol
      });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to perform symbol sentiment analysis',
          'ANALYSIS_ERROR',
          {
            requestId,
            symbol,
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
 * Handle market-wide sentiment analysis
 * GET /api/v1/sentiment/market
 */
async function handleMarketSentiment(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  // Use Durable Objects cache if enabled, otherwise no cache (simple)
  // External APIs (FMP, NewsAPI) use KV cache independently
  const cacheInstance = createCacheInstance(env, true);
  if (cacheInstance) {
    logger.info('SENTIMENT_ROUTES', 'Using Durable Objects cache (L1)');
  } else {
    // No cache - simple, direct execution
    logger.info('SENTIMENT_ROUTES', 'No cache (L1 disabled)');
  }

  try {
    // Check cache first
    const cacheKey = `market_sentiment_${new Date().toISOString().split('T')[0]}`;
    const cached = await getFromCache(cacheKey, cacheInstance);

    if (cached && cached.success && cached.data) {
      logger.info('MarketSentiment: Cache hit', { requestId });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cached.data, 'hit', {
            source: 'cache',
            ttl: 3600,
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // Get recent analysis data to compute market sentiment
    const today = new Date().toISOString().split('T')[0];
    const analysisKey = `analysis_${today}`;
    const sentimentDal = createSimplifiedEnhancedDAL(env);
    const analysisResult = await sentimentDal.read(analysisKey);
    const analysisData = analysisResult.success ? analysisResult.data : null;

    if (!analysisData || !analysisData.trading_signals) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'No market data available',
            'NO_DATA',
            { requestId }
          )
        ),
        {
          status: HttpStatus.NOT_FOUND,
          headers,
        }
      );
    }

    // Compute market-wide sentiment from all symbols
    const signals = Object.values(analysisData.trading_signals);
    const sentimentScores = signals.map(signal => {
      const score = signal.sentiment_layers?.[0]?.confidence || 0;
      const sentiment = signal.sentiment_layers?.[0]?.sentiment || 'neutral';
      return sentiment === 'bullish' ? score : sentiment === 'bearish' ? -score : 0;
    });

    const overallSentiment = sentimentScores.reduce((sum: any, score: any) => sum + score, 0) / sentimentScores.length;

    const response: MarketSentimentData = {
      overall_sentiment: Math.max(-1, Math.min(1, overallSentiment)),
      sentiment_label: overallSentiment > 0.1 ? 'BULLISH' : overallSentiment < -0.1 ? 'BEARISH' : 'NEUTRAL',
      confidence: Math.abs(overallSentiment),
    };

    // Cache the result for 1 hour
    await setCache(cacheKey, response, cacheInstance);

    logger.info('MarketSentiment: Analysis complete', {
      overallSentiment: response.overall_sentiment,
      processingTime: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 3600,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error: unknown) {
    logger.error('MarketSentiment Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to compute market sentiment',
          'ANALYSIS_ERROR',
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
 * Handle sector sentiment analysis
 * GET /api/v1/sentiment/sectors?sectors=XLK,XLE,XLF
 */
async function handleSectorSentiment(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  // Use Durable Objects cache if enabled, otherwise no cache (simple)
  // External APIs (FMP, NewsAPI) use KV cache independently
  const cacheInstance = createCacheInstance(env, true);
  if (cacheInstance) {
    logger.info('SENTIMENT_ROUTES', 'Using Durable Objects cache (L1)');
  } else {
    // No cache - simple, direct execution
    logger.info('SENTIMENT_ROUTES', 'No cache (L1 disabled)');
  }
  const url = new URL(request.url);
  const params = parseQueryParams(url);

  try {
    // Extract sectors from query parameters
    const sectorsParam = params.sectors as string;
    const sectors = sectorsParam ? sectorsParam.split(',').map(s => s.trim().toUpperCase()) : [];

    if (sectors.length === 0) {
      return new Response(
        JSON.stringify(
          ApiResponseFactory.error(
            'No sectors specified. Use ?sectors=XLK,XLE,XLF',
            'NO_SECTORS',
            { requestId }
          )
        ),
        {
          status: HttpStatus.BAD_REQUEST,
          headers,
        }
      );
    }

    // Check cache first
    const cacheKey = `sector_sentiment_${sectors.join(',')}_${new Date().toISOString().split('T')[0]}`;
    const cached = await getFromCache(cacheKey, cacheInstance);

    if (cached && cached.success && cached.data) {
      logger.info('SectorSentiment: Cache hit', { sectors: sectors.join(','), requestId });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cached.data, 'hit', {
            source: 'cache',
            ttl: 3600,
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // Implement real sector sentiment analysis using AI models
    const sectorNames: Record<string, string> = {
      XLK: 'Technology',
      XLF: 'Financials',
      XLV: 'Health Care',
      XLE: 'Energy',
      XLY: 'Consumer Discretionary',
      XLP: 'Consumer Staples',
      XLI: 'Industrials',
      XLB: 'Materials',
      XLU: 'Utilities',
      XLRE: 'Real Estate',
      XLC: 'Communication Services',
    };

    // Perform real sector sentiment analysis
    const sectorAnalysis = [];

    for (const sector of sectors) {
      try {
        // Get sector-specific market data
        const { getBatchMarketData } = await import('../modules/yahoo-finance-integration.js');
        const marketData = await getBatchMarketData([sector]);

        // Analyze sector using AI models
        const aiResult = await batchDualAIAnalysis([sector], env);

        if (aiResult.results && aiResult.results.length > 0 && !aiResult.results[0].error) {
          const result = aiResult.results[0];
          const transformedSignal = transformBatchResultsToSignals([result])[0];
          const priceData = marketData[sector];

          // Determine sentiment label based on AI analysis
          let sentimentLabel = 'NEUTRAL';
          const sentiment = transformedSignal.overall_confidence || 0;
          if (transformedSignal.recommendation === 'BUY') {
            sentimentLabel = 'BULLISH';
          } else if (transformedSignal.recommendation === 'SELL') {
            sentimentLabel = 'BEARISH';
          }

          sectorAnalysis.push({
            symbol: sector,
            name: sectorNames[sector] || sector,
            sentiment: sentiment * (transformedSignal.recommendation === 'SELL' ? -1 : 1), // Convert to -1 to 1 scale
            sentiment_label: sentimentLabel,
            confidence: Math.abs(transformedSignal.overall_confidence || 0.5),
            ai_context: transformedSignal.gpt_reasoning || `AI analysis for ${sector} sector based on recent market data and news sentiment.`,
            news_count: transformedSignal.news_count || 0,
            price_change: priceData?.changePercent || 0,
            real_data: true,
            models_used: ['GPT-OSS-120B', 'DistilBERT-SST-2'],
            agreement_type: transformedSignal.agreement_type || 'DISAGREE'
          });
        } else {
          // Fallback if AI analysis fails
          sectorAnalysis.push({
            symbol: sector,
            name: sectorNames[sector] || sector,
            sentiment: 0,
            sentiment_label: 'NEUTRAL',
            confidence: 0.3,
            ai_context: `Unable to perform AI analysis for ${sector} sector. Technical data unavailable.`,
            news_count: 0,
            price_change: 0,
            real_data: false,
            models_used: [],
            agreement_type: 'NO_DATA'
          });
        }
      } catch (error: unknown) {
        logger.warn(`Failed to analyze sector ${sector}:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          sector
        });

        // Add fallback sector data
        sectorAnalysis.push({
          symbol: sector,
          name: sectorNames[sector] || sector,
          sentiment: 0,
          sentiment_label: 'NEUTRAL',
          confidence: 0.2,
          ai_context: `AI analysis failed for ${sector} sector due to technical issues.`,
          news_count: 0,
          price_change: 0,
          real_data: false,
          models_used: [],
          agreement_type: 'ERROR'
        });
      }
    }

    const response: SectorSentimentData = {
      sectors: sectorAnalysis,
      timestamp: new Date().toISOString(),
      analysis_metadata: {
        total_sectors: sectors.length,
        successful_analysis: sectorAnalysis.filter(s => s.real_data).length,
        ai_models_available: true,
        real_market_data: true
      }
    };

    // Cache the result for 1 hour
    await setCache(cacheKey, response, cacheInstance);

    logger.info('SectorSentiment: Analysis complete', {
      sectors: sectors.join(','),
      processingTime: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'fresh',
          ttl: 3600,
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );
  } catch (error: unknown) {
    logger.error('SectorSentiment Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to perform sector sentiment analysis',
          'ANALYSIS_ERROR',
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

// Helper functions to transform BatchDualAIAnalysisResult to v1 response format

function calculateOverallSentiment(results: any[]): number {
  if (!results || results.length === 0) return 0;

  const validResults = results.filter(r => !r.error && r.signal);
  if (validResults.length === 0) return 0;

  const sentiments = validResults.map(r => {
    const direction = r.signal.direction;
    if (direction === 'bullish' || direction === 'up') return 1;
    if (direction === 'bearish' || direction === 'down') return -1;
    return 0;
  });

  return sentiments.reduce((sum: any, sentiment: any) => sum + sentiment, 0) / sentiments.length;
}

function getSentimentLabel(sentiment: number): string {
  if (sentiment > 0.1) return 'BULLISH';
  if (sentiment < -0.1) return 'BEARISH';
  return 'NEUTRAL';
}

function calculateOverallConfidence(results: any[]): number {
  if (!results || results.length === 0) return 0.5;

  const validResults = results.filter(r => !r.error && r.models);
  if (validResults.length === 0) return 0.5;

  const confidences = validResults.map(r => {
    const gptConf = r.models.gpt?.confidence || 0;
    const dbConf = r.models.distilbert?.confidence || 0;
    return (gptConf + dbConf) / 2;
  });

  return confidences.reduce((sum: any, conf: any) => sum + conf, 0) / confidences.length;
}

function transformBatchResultsToSignals(results: any[]): any[] {
  if (!results || results.length === 0) return [];

  return results.filter(r => !r.error).map(result => ({
    symbol: result.symbol,
    overall_confidence: calculateOverallConfidence([result]),
    recommendation: getRecommendationFromSignal(result.signal),
    agreement_type: result.comparison?.agreement_type || 'DISAGREE',
    gpt_sentiment: result.models.gpt?.direction || 'neutral',
    gpt_confidence: result.models.gpt?.confidence || 0.5,
    gpt_reasoning: result.models.gpt?.reasoning || '',
    distilbert_sentiment: result.models.distilbert?.direction || 'neutral',
    distilbert_confidence: result.models.distilbert?.confidence || 0.5,
    distilbert_positive: result.models.distilbert?.sentiment_breakdown?.bullish || 0,
    distilbert_negative: result.models.distilbert?.sentiment_breakdown?.bearish || 0,
    distilbert_neutral: result.models.distilbert?.sentiment_breakdown?.neutral || 0,
    news_count: result.models.gpt?.articles_analyzed || result.models.distilbert?.articles_analyzed || 0,
    top_articles: [] // Could be populated if needed
  }));
}

function getRecommendationFromSignal(signal: any): string {
  if (!signal) return 'HOLD';

  const action = signal.action;
  if (action?.includes('BUY')) return 'BUY';
  if (action?.includes('SELL')) return 'SELL';
  return 'HOLD';
}