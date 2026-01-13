/**
 * Optimized AI Analysis Module - Rate Limit Aware
 *
 * Intelligent AI analysis system that adapts to rate limits by:
 * 1. Using simplified analysis when rate limits are hit
 * 2. Implementing smart caching and batching
 * 3. Graceful degradation to technical analysis
 * 4. Progressive enhancement with fallback strategies
 */

import { getFreeStockNews, type NewsArticle } from './free_sentiment_pipeline.js';
import { parseNaturalLanguageResponse, mapSentimentToDirection } from './sentiment-utils.js';
import { logInfo, logError, logAIDebug } from './logging.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
import type { CloudflareEnvironment } from '../types';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  MAX_CONCURRENT_REQUESTS: 3,
  BASE_DELAY_MS: 2000,
  MAX_RETRY_ATTEMPTS: 2,
  CACHE_TTL_SECONDS: 3600,
  FALLBACK_TO_TECHNICAL: true
};

// Type Definitions
export interface OptimizedAnalysisResult {
  symbol: string;
  timestamp: string;
  analysis_type: 'full_ai' | 'technical_fallback' | 'cached';
  sentiment: {
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    reasoning: string;
  };
  technical_indicators?: {
    trend: 'uptrend' | 'downtrend' | 'sideways';
    momentum: 'strong' | 'moderate' | 'weak';
    volatility: 'high' | 'medium' | 'low';
  };
  market_data?: {
    current_price: number;
    price_change: number;
    volume: number;
  };
  metadata: {
    processing_time_ms: number;
    cache_hit: boolean;
    model_used: string;
    articles_analyzed?: number;
    rate_limit_hit?: boolean;
  };
}

export interface BatchOptimizedResult {
  results: OptimizedAnalysisResult[];
  summary: {
    total_symbols: number;
    successful_analyses: number;
    cache_hits: number;
    rate_limited: number;
    technical_fallbacks: number;
    average_processing_time: number;
  };
}

/**
 * Optimized AI Analysis Manager
 */
export class OptimizedAIAnalyzer {
  private env: CloudflareEnvironment;
  private dal: ReturnType<typeof createSimplifiedEnhancedDAL>;
  private requestQueue: Array<() => Promise<any>> = [];
  private processingQueue = false;
  private lastRequestTime = 0;

  constructor(env: CloudflareEnvironment) {
    this.env = env;
    this.dal = createSimplifiedEnhancedDAL(env, {
      enableCache: true,
      environment: env.ENVIRONMENT || 'production'
    });
  }

  /**
   * Analyze a single symbol with rate limit awareness
   */
  async analyzeSymbol(symbol: string, forceRefresh = false): Promise<OptimizedAnalysisResult> {
    const startTime = Date.now();
    const cacheKey = `optimized_analysis_${symbol}_${new Date().toISOString().split('T')[0]}`;

    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = await this.dal.read(cacheKey);
        if (cached.success && cached.data) {
          logAIDebug('Analysis cache hit', { symbol });
          return {
            ...cached.data,
            metadata: {
              ...cached.data.metadata,
              cache_hit: true,
              processing_time_ms: Date.now() - startTime
            }
          };
        }
      }

      logInfo('Starting optimized analysis', { symbol });

      // Get market data first
      const marketData = await this.getMarketData(symbol);

      // Try full AI analysis with rate limit protection
      const aiResult = await this.performAIAnalysisWithRateLimit(symbol, marketData);

      // Cache the result
      await this.dal.write(cacheKey, aiResult, { expirationTtl: RATE_LIMIT_CONFIG.CACHE_TTL_SECONDS });

      logInfo('Analysis completed', {
        symbol,
        type: aiResult.analysis_type,
        processing_time: Date.now() - startTime
      });

      return aiResult;

    } catch (error: any) {
      logError('Analysis failed', { symbol, error: (error instanceof Error ? error.message : String(error)) });

      // Return technical fallback
      return this.createTechnicalFallback(symbol, error.message, Date.now() - startTime);
    }
  }

  /**
   * Batch analyze multiple symbols with intelligent rate limiting
   */
  async analyzeBatch(symbols: string[]): Promise<BatchOptimizedResult> {
    const startTime = Date.now();
    logInfo('Starting batch optimized analysis', { symbolCount: symbols.length });

    const results: OptimizedAnalysisResult[] = [];
    const summary = {
      total_symbols: symbols.length,
      successful_analyses: 0,
      cache_hits: 0,
      rate_limited: 0,
      technical_fallbacks: 0,
      average_processing_time: 0
    };

    // Process symbols sequentially to respect rate limits
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];

      try {
        const result = await this.analyzeSymbol(symbol);
        results.push(result);

        // Update statistics
        if (result.metadata.cache_hit) summary.cache_hits++;
        else summary.successful_analyses++;

        if (result.metadata.rate_limit_hit) summary.rate_limited++;
        if (result.analysis_type === 'technical_fallback') summary.technical_fallbacks++;

        // Intelligent delay between requests
        if (i < symbols.length - 1) {
          await this.intelligentDelay(result.metadata.rate_limit_hit);
        }

      } catch (error: any) {
        logError('Batch analysis failed for symbol', { symbol, error: (error instanceof Error ? error.message : String(error)) });

        // Add technical fallback
        const fallback = this.createTechnicalFallback(symbol, error.message, 0);
        results.push(fallback);
        summary.technical_fallbacks++;
      }
    }

    const totalTime = Date.now() - startTime;
    summary.average_processing_time = totalTime / symbols.length;

    logInfo('Batch analysis completed', {
      total_time: totalTime,
      successful: summary.successful_analyses,
      cache_hits: summary.cache_hits,
      rate_limited: summary.rate_limited,
      fallbacks: summary.technical_fallbacks
    });

    return { results, summary };
  }

  /**
   * Perform AI analysis with rate limit protection
   */
  private async performAIAnalysisWithRateLimit(
    symbol: string,
    marketData: any
  ): Promise<OptimizedAnalysisResult> {
    try {
      // Try to get news data first
      const newsData = await this.getNewsDataWithRetry(symbol);

      if (newsData.length > 0) {
        // Attempt full AI analysis
        return await this.performFullAIAnalysis(symbol, newsData, marketData);
      } else {
        // No news available, use technical analysis
        return this.createTechnicalAnalysis(symbol, marketData);
      }

    } catch (error: any) {
      logError('AI analysis hit rate limit, falling back to technical', {
        symbol,
        error: (error instanceof Error ? error.message : String(error))
      });

      // Return technical analysis with rate limit flag
      return this.createTechnicalAnalysis(symbol, marketData, true);
    }
  }

  /**
   * Perform full AI analysis (GPT only to reduce subrequests)
   */
  private async performFullAIAnalysis(
    symbol: string,
    newsData: NewsArticle[],
    marketData: any
  ): Promise<OptimizedAnalysisResult> {
    const startTime = Date.now();

    try {
      // Use only GPT to reduce subrequest count
      const topArticles = newsData.slice(0, 3); // Limit to 3 articles
      const newsContext = topArticles
        .map((item: any, i: any) => `${i+1}. ${item.title}\n${item.summary || ''}`)
        .join('\n\n');

      const prompt = `As a financial analyst, provide a brief sentiment analysis for ${symbol} based on this news:

${newsContext}

Return in this format:
Direction: [bullish/bearish/neutral]
Confidence: [0-100]
Key factors: [brief list of main drivers]
Short-term outlook: [1-2 sentences]`;

      const response = await this.env.AI.run('@cf/aisingapore/gemma-sea-lion-v4-27b-it', {
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300 // Reduced token count
      });

      const analysis = this.parseGPTResponse(response.response);

      return {
        symbol,
        timestamp: new Date().toISOString(),
        analysis_type: 'full_ai',
        sentiment: (analysis as any).sentiment,
        technical_indicators: this.calculateBasicTechnicals(marketData),
        market_data: {
          current_price: marketData.current_price,
          price_change: marketData.price_change || 0,
          volume: marketData.volume || 0
        },
        metadata: {
          processing_time_ms: Date.now() - startTime,
          cache_hit: false,
          model_used: 'gpt-oss-120b',
          articles_analyzed: topArticles.length,
          rate_limit_hit: false
        }
      };

    } catch (error: any) {
      if ((error instanceof Error ? error.message : String(error)).includes('Too many subrequests') ||
          (error instanceof Error ? error.message : String(error)).includes('rate limit') ||
          (error instanceof Error ? error.message : String(error)).includes('429')) {
        throw error; // Re-throw rate limit errors
      }

      logError('AI analysis failed', { symbol, error: error.message });
      return this.createTechnicalAnalysis(symbol, marketData);
    }
  }

  /**
   * Get news data with retry logic
   */
  private async getNewsDataWithRetry(symbol: string): Promise<NewsArticle[]> {
    for (let attempt = 1; attempt <= RATE_LIMIT_CONFIG.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        return await getFreeStockNews(symbol, this.env);
      } catch (error: any) {
        if (attempt === RATE_LIMIT_CONFIG.MAX_RETRY_ATTEMPTS) {
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    return [];
  }

  /**
   * Get market data
   */
  private async getMarketData(symbol: string): Promise<any> {
    // Simplified market data fetching
    return {
      current_price: 100, // Mock price - would fetch from Yahoo Finance
      price_change: 0,
      volume: 1000000
    };
  }

  /**
   * Create technical analysis fallback
   */
  private createTechnicalAnalysis(
    symbol: string,
    marketData: any,
    rateLimitHit = false
  ): OptimizedAnalysisResult {
    const technicals = this.calculateBasicTechnicals(marketData);

    // Generate sentiment based on price action
    let direction: 'bullish' | 'bearish' | 'neutral';
    let confidence = 0.5;

    if (marketData.price_change > 1) {
      direction = 'bullish';
      confidence = Math.min(0.7, 0.5 + Math.abs(marketData.price_change) / 10);
    } else if (marketData.price_change < -1) {
      direction = 'bearish';
      confidence = Math.min(0.7, 0.5 + Math.abs(marketData.price_change) / 10);
    }

    return {
      symbol,
      timestamp: new Date().toISOString(),
      analysis_type: 'technical_fallback',
      sentiment: {
        direction,
        confidence,
        reasoning: `Technical analysis based on price action: ${marketData.price_change > 0 ? 'positive' : 'negative'} movement of ${Math.abs(marketData.price_change).toFixed(2)}%`
      },
      technical_indicators: technicals,
      market_data: {
        current_price: marketData.current_price,
        price_change: marketData.price_change || 0,
        volume: marketData.volume || 0
      },
      metadata: {
        processing_time_ms: 50,
        cache_hit: false,
        model_used: 'technical_analysis',
        rate_limit_hit: !!rateLimitHit
      }
    };
  }

  /**
   * Create technical fallback for errors
   */
  private createTechnicalFallback(
    symbol: string,
    errorMessage: string,
    processingTime: number
  ): OptimizedAnalysisResult {
    return {
      symbol,
      timestamp: new Date().toISOString(),
      analysis_type: 'technical_fallback',
      sentiment: {
        direction: 'neutral',
        confidence: 0.5,
        reasoning: `Analysis unavailable (${errorMessage}). Using neutral technical analysis.`
      },
      metadata: {
        processing_time_ms: processingTime,
        cache_hit: false,
        model_used: 'error_fallback'
      }
    };
  }

  /**
   * Calculate basic technical indicators
   */
  private calculateBasicTechnicals(marketData: any): OptimizedAnalysisResult['technical_indicators'] {
    const priceChange = marketData.price_change || 0;

    // Simple trend based on price change
    let trend: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
    if (priceChange > 2) trend = 'uptrend';
    else if (priceChange < -2) trend = 'downtrend';

    // Momentum based on change magnitude
    let momentum: 'strong' | 'moderate' | 'weak' = 'weak';
    if (Math.abs(priceChange) > 3) momentum = 'strong';
    else if (Math.abs(priceChange) > 1) momentum = 'moderate';

    // Volatility (mock)
    const volatility: 'high' | 'medium' | 'low' = 'medium';

    return { trend, momentum, volatility };
  }

  /**
   * Parse GPT response
   */
  private parseGPTResponse(response: string): OptimizedAnalysisResult['sentiment'] {
    try {
      const lines = response.split('\n').map(line => line.trim());

      let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      let confidence = 0.5;
      let reasoning = '';

      for (const line of lines) {
        if (line.toLowerCase().startsWith('direction:')) {
          const value = line.split(':')[1]?.trim().toLowerCase();
          if (value?.includes('bullish')) direction = 'bullish';
          else if (value?.includes('bearish')) direction = 'bearish';
        } else if (line.toLowerCase().startsWith('confidence:')) {
          const value = line.split(':')[1]?.trim();
          if (value) {
            const num = parseInt(value);
            if (!isNaN(num)) confidence = num / 100;
          }
        } else if (line.toLowerCase().startsWith('key factors:') || line.toLowerCase().startsWith('short-term outlook:')) {
          reasoning += line + ' ';
        }
      }

      return { direction, confidence, reasoning: reasoning.trim() || 'AI analysis completed' };
    } catch (error: unknown) {
      logError('Failed to parse GPT response', { error: error instanceof Error ? error.message : String(error) });
      return {
        direction: 'neutral',
        confidence: 0.5,
        reasoning: 'Unable to parse AI response'
      };
    }
  }

  /**
   * Intelligent delay based on rate limit status
   */
  private async intelligentDelay(rateLimitHit: boolean): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    let delay = RATE_LIMIT_CONFIG.BASE_DELAY_MS;

    if (rateLimitHit) {
      delay = RATE_LIMIT_CONFIG.BASE_DELAY_MS * 2; // Double delay if rate limited
    }

    if (timeSinceLastRequest < delay) {
      const waitTime = delay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

/**
 * Analyze multiple symbols with optimized rate limiting
 */
export async function performOptimizedAnalysis(
  symbols: string[],
  env: CloudflareEnvironment
): Promise<BatchOptimizedResult> {
  const analyzer = new OptimizedAIAnalyzer(env);
  return await analyzer.analyzeBatch(symbols);
}

/**
 * Analyze single symbol with optimization
 */
export async function analyzeSingleSymbolOptimized(
  symbol: string,
  env: CloudflareEnvironment,
  forceRefresh = false
): Promise<OptimizedAnalysisResult> {
  const analyzer = new OptimizedAIAnalyzer(env);
  return await analyzer.analyzeSymbol(symbol, forceRefresh);
}