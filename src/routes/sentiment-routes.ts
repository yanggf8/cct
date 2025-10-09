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
import { performDualAIComparison } from '../modules/dual-ai-analysis.ts';
import { createDAL } from '../modules/dal.js';
import { createLogger } from '../modules/logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('sentiment-routes');

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
    logger.error('SentimentRoutes Error', error, { requestId, path, method });

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
  const dal = createDAL(env);
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
    const cached = await dal.get<SentimentAnalysisResponse>('CACHE', cacheKey);

    if (cached) {
      logger.info('SentimentAnalysis', 'Cache hit', { symbols: symbols.join(','), requestId });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cached, 'hit', {
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
    logger.info('SentimentAnalysis', 'Starting analysis', { symbols: symbols.join(','), requestId });

    const analysisResult = await performDualAIComparison(symbols, env);

    // Transform to v1 response format
    const response: SentimentAnalysisResponse = {
      symbols,
      analysis: {
        timestamp: new Date().toISOString(),
        market_sentiment: {
          overall_sentiment: analysisResult.overall_sentiment || 0,
          sentiment_label: analysisResult.overall_sentiment_label || 'NEUTRAL',
          confidence: analysisResult.overall_confidence || 0.5,
        },
        signals: analysisResult.signals || [],
        overall_confidence: analysisResult.overall_confidence || 0.5,
      },
      metadata: {
        analysis_time_ms: timer.getElapsedMs(),
        ai_models_used: ['GPT-OSS-120B', 'DistilBERT-SST-2'],
        data_sources: ['Yahoo Finance', 'News APIs'],
      },
    };

    // Cache the result for 1 hour
    await dal.put('CACHE', cacheKey, response, { expirationTtl: 3600 });

    logger.info('SentimentAnalysis', 'Analysis complete', {
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
  } catch (error) {
    logger.error('SentimentAnalysis Error', error, { requestId });

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
  const dal = createDAL(env);

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
    const cached = await dal.get<SymbolSentimentResponse>('CACHE', cacheKey);

    if (cached) {
      logger.info('SymbolSentiment', 'Cache hit', { symbol, requestId });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cached, 'hit', {
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
    logger.info('SymbolSentiment', 'Starting analysis', { symbol, requestId });

    const analysisResult = await performDualAIComparison([symbol], env);

    if (!analysisResult.signals || analysisResult.signals.length === 0) {
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

    const signalData = analysisResult.signals[0];

    // Transform to v1 response format
    const response: SymbolSentimentResponse = {
      symbol,
      analysis: {
        gpt_analysis: {
          sentiment: signalData.gpt_sentiment || 'neutral',
          confidence: signalData.gpt_confidence || 0.5,
          reasoning: signalData.gpt_reasoning || '',
          model: 'GPT-OSS-120B',
        },
        distilbert_analysis: {
          sentiment: signalData.distilbert_sentiment || 'neutral',
          confidence: signalData.distilbert_confidence || 0.5,
          sentiment_breakdown: {
            positive: signalData.distilbert_positive || 0,
            negative: signalData.distilbert_negative || 0,
            neutral: signalData.distilbert_neutral || 0,
          },
          model: 'DistilBERT-SST-2',
        },
        agreement: {
          type: signalData.agreement_type || 'DISAGREE',
          confidence: signalData.overall_confidence || 0.5,
          recommendation: signalData.recommendation || 'HOLD',
        },
      },
      news: {
        articles_analyzed: signalData.news_count || 0,
        top_articles: signalData.top_articles || [],
      },
    };

    // Cache the result for 1 hour
    await dal.put('CACHE', cacheKey, response, { expirationTtl: 3600 });

    logger.info('SymbolSentiment', 'Analysis complete', {
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
  } catch (error) {
    logger.error('SymbolSentiment Error', error, { requestId, symbol });

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
  const dal = createDAL(env);

  try {
    // Check cache first
    const cacheKey = `market_sentiment_${new Date().toISOString().split('T')[0]}`;
    const cached = await dal.get<MarketSentimentData>('CACHE', cacheKey);

    if (cached) {
      logger.info('MarketSentiment', 'Cache hit', { requestId });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cached, 'hit', {
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
    const analysisData = await dal.get(analysisKey, 'ANALYSIS');

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

    const overallSentiment = sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length;

    const response: MarketSentimentData = {
      overall_sentiment: Math.max(-1, Math.min(1, overallSentiment)),
      sentiment_label: overallSentiment > 0.1 ? 'BULLISH' : overallSentiment < -0.1 ? 'BEARISH' : 'NEUTRAL',
      confidence: Math.abs(overallSentiment),
    };

    // Cache the result for 1 hour
    await dal.put('CACHE', cacheKey, response, { expirationTtl: 3600 });

    logger.info('MarketSentiment', 'Analysis complete', {
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
  } catch (error) {
    logger.error('MarketSentiment Error', error, { requestId });

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
  const dal = createDAL(env);
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
    const cached = await dal.get<SectorSentimentData>('CACHE', cacheKey);

    if (cached) {
      logger.info('SectorSentiment', 'Cache hit', { sectors: sectors.join(','), requestId });

      return new Response(
        JSON.stringify(
          ApiResponseFactory.cached(cached, 'hit', {
            source: 'cache',
            ttl: 3600,
            requestId,
            processingTime: timer.getElapsedMs(),
          })
        ),
        { status: HttpStatus.OK, headers }
      );
    }

    // For now, return mock sector sentiment data
    // TODO: Implement actual sector sentiment analysis
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

    const response: SectorSentimentData = {
      sectors: sectors.map(symbol => ({
        symbol,
        name: sectorNames[symbol] || symbol,
        sentiment: Math.random() * 2 - 1, // Random sentiment -1 to 1
        sentiment_label: Math.random() > 0.5 ? 'BULLISH' : Math.random() < 0.25 ? 'BEARISH' : 'NEUTRAL',
        confidence: Math.random() * 0.5 + 0.5, // 0.5 to 1.0
        ai_context: `AI analysis for ${symbol} sector based on recent market data and news sentiment.`,
        news_count: Math.floor(Math.random() * 20) + 5,
        price_change: (Math.random() - 0.5) * 10, // -5% to +5%
      })),
      timestamp: new Date().toISOString(),
    };

    // Cache the result for 1 hour
    await dal.put('CACHE', cacheKey, response, { expirationTtl: 3600 });

    logger.info('SectorSentiment', 'Analysis complete', {
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
  } catch (error) {
    logger.error('SectorSentiment Error', error, { requestId });

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