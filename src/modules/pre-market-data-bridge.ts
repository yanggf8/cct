/**
 * Pre-Market Data Bridge Module
 * Bridges the gap between sentiment analysis data and pre-market reporting
 * Transforms modern API v1 sentiment data into the legacy format expected by pre-market reports
 */

import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
import { createLogger } from './logging.js';
import { batchDualAIAnalysis, performDualAIComparison } from './dual-ai-analysis.js';
import { extractDualModelData } from './data.js';
import { getFreeStockNews } from './free_sentiment_pipeline.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('pre-market-data-bridge');

/**
 * Trading signal structure expected by pre-market reports
 */
interface TradingSignal {
  symbol: string;
  sentiment_layers: Array<{
    sentiment: string;
    confidence: number;
    reasoning: string;
  }>;
  dual_model?: DualModelData;
  articles_count?: number;
  articles_content?: string[];
}

/**
 * Market Pulse data structure for market index sentiment (v3.10.0)
 * Now includes status and error fields for failure tracking
 */
interface MarketPulseData {
  symbol: string;
  name: string;
  status: 'success' | 'failed' | 'unavailable';
  direction?: string;
  confidence?: number;
  articles_count: number;
  source: string;
  reasoning?: string;
  error?: string;  // Failure reason when status != 'success'
  dual_model?: DualModelData;
  generated_at?: string;
}

/**
 * Analysis data structure expected by pre-market reports
 */
interface AnalysisData {
  trading_signals: Record<string, TradingSignal>;
  market_pulse?: MarketPulseData;
  timestamp: string;
  generated_at: string;
}

/**
 * Symbol sentiment data from modern API v1
 */
interface ModernSentimentData {
  symbol: string;
  sentiment: string;
  confidence: number;
  signal?: string;
  reasoning?: string;
  articles_analyzed?: number;
  articles_titles?: string[];
  market_sentiment?: string;
  sector_sentiment?: string;
  // Dual-model tracking for diagnostics
  dual_model?: DualModelData;
}

/**
 * Dual-model data structure for comprehensive logging
 */
interface DualModelData {
  gemma?: {
    status: 'success' | 'failed' | 'timeout' | 'skipped';
    confidence?: number;
    direction?: string;
    error?: string;
    response_time_ms?: number;
  };
  distilbert?: {
    status: 'success' | 'failed' | 'timeout' | 'skipped';
    confidence?: number;
    direction?: string;
    error?: string;
    response_time_ms?: number;
  };
  selection_reason?: string;
}

/**
 * Write symbol prediction to D1 (success or failure)
 * Now captures both models' results for diagnostics
 */
async function writeSymbolPredictionToD1(
  env: CloudflareEnvironment,
  symbol: string,
  date: string,
  data: {
    status: 'success' | 'failed' | 'skipped';
    sentiment?: string;
    confidence?: number;
    direction?: string;
    model?: string;
    error_message?: string;
    news_source?: string;
    articles_count?: number;
    articles_content?: string[];
    raw_response?: any;
    dual_model?: DualModelData;
  }
): Promise<void> {
  if (!env.PREDICT_JOBS_DB) return;

  try {
    // Check if new columns exist (graceful upgrade)
    const hasNewColumns = await checkDualModelColumnsExist(env);
    const hasArticlesContent = await checkArticlesContentColumnExists(env);

    const dualModelData = data.dual_model ? extractDualModelData({ dual_model: data.dual_model }) : {};
    const articlesJson = data.articles_content?.length ? JSON.stringify(data.articles_content.slice(0, 10)) : null;

    if (hasNewColumns && hasArticlesContent) {
      // Use enhanced INSERT with dual-model logging + articles_content
      await env.PREDICT_JOBS_DB.prepare(`
        INSERT OR REPLACE INTO symbol_predictions
        (symbol, prediction_date, sentiment, confidence, direction, model, status, error_message, news_source, articles_count, articles_content, raw_response,
         gemma_status, gemma_error, gemma_confidence, gemma_response_time_ms,
         distilbert_status, distilbert_error, distilbert_confidence, distilbert_response_time_ms,
         model_selection_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        symbol,
        date,
        data.sentiment || null,
        data.confidence || null,
        data.direction || null,
        data.model || null,
        data.status,
        data.error_message || null,
        data.news_source || null,
        data.articles_count || 0,
        articlesJson,
        data.raw_response ? JSON.stringify(data.raw_response) : null,
        dualModelData.gemma_status || null,
        dualModelData.gemma_error || null,
        dualModelData.gemma_confidence ?? null,
        dualModelData.gemma_response_time_ms ?? null,
        dualModelData.distilbert_status || null,
        dualModelData.distilbert_error || null,
        dualModelData.distilbert_confidence ?? null,
        dualModelData.distilbert_response_time_ms ?? null,
        dualModelData.model_selection_reason || null
      ).run();
    } else if (hasNewColumns) {
      // Use enhanced INSERT with dual-model logging (no articles_content)
      await env.PREDICT_JOBS_DB.prepare(`
        INSERT OR REPLACE INTO symbol_predictions
        (symbol, prediction_date, sentiment, confidence, direction, model, status, error_message, news_source, articles_count, raw_response,
         gemma_status, gemma_error, gemma_confidence, gemma_response_time_ms,
         distilbert_status, distilbert_error, distilbert_confidence, distilbert_response_time_ms,
         model_selection_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        symbol,
        date,
        data.sentiment || null,
        data.confidence || null,
        data.direction || null,
        data.model || null,
        data.status,
        data.error_message || null,
        data.news_source || null,
        data.articles_count || 0,
        data.raw_response ? JSON.stringify(data.raw_response) : null,
        dualModelData.gemma_status || null,
        dualModelData.gemma_error || null,
        dualModelData.gemma_confidence ?? null,
        dualModelData.gemma_response_time_ms ?? null,
        dualModelData.distilbert_status || null,
        dualModelData.distilbert_error || null,
        dualModelData.distilbert_confidence ?? null,
        dualModelData.distilbert_response_time_ms ?? null,
        dualModelData.model_selection_reason || null
      ).run();
    } else {
      // Fallback to original INSERT (before migration)
      await env.PREDICT_JOBS_DB.prepare(`
        INSERT OR REPLACE INTO symbol_predictions
        (symbol, prediction_date, sentiment, confidence, direction, model, status, error_message, news_source, articles_count, raw_response, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        symbol,
        date,
        data.sentiment || null,
        data.confidence || null,
        data.direction || null,
        data.model || null,
        data.status,
        data.error_message || null,
        data.news_source || null,
        data.articles_count || 0,
        data.raw_response ? JSON.stringify(data.raw_response) : null
      ).run();
    }
  } catch (e) {
    logger.warn(`Failed to write symbol prediction to D1: ${symbol}`, { error: e });
  }
}

// Cache for column existence checks
let dualModelColumnsExist: boolean | null = null;
let articlesContentColumnExists: boolean | null = null;

async function checkDualModelColumnsExist(env: CloudflareEnvironment): Promise<boolean> {
  if (dualModelColumnsExist !== null) return dualModelColumnsExist;

  try {
    const result = await env.PREDICT_JOBS_DB!.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='symbol_predictions'"
    ).first<{ sql: string }>();

    dualModelColumnsExist = result?.sql?.includes('gemma_status') || false;
    return dualModelColumnsExist;
  } catch {
    dualModelColumnsExist = false;
    return false;
  }
}

async function checkArticlesContentColumnExists(env: CloudflareEnvironment): Promise<boolean> {
  if (articlesContentColumnExists !== null) return articlesContentColumnExists;

  try {
    const result = await env.PREDICT_JOBS_DB!.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='symbol_predictions'"
    ).first<{ sql: string }>();

    articlesContentColumnExists = result?.sql?.includes('articles_content') || false;
    return articlesContentColumnExists;
  } catch {
    articlesContentColumnExists = false;
    return false;
  }
}

/**
 * Pre-Market Data Bridge
 * Transforms modern sentiment data into legacy format for pre-market reporting
 */
export class PreMarketDataBridge {
  private dal: ReturnType<typeof createSimplifiedEnhancedDAL>;
  private env: CloudflareEnvironment;

  constructor(env: CloudflareEnvironment) {
    this.env = env;
    this.dal = createSimplifiedEnhancedDAL(env, {
      enableCache: true,
      environment: env.ENVIRONMENT || 'production'
    });
  }

  /**
   * Generate Market Pulse data for market index sentiment (v3.10.0)
   * Fetches SPY news via Finnhub pipeline (same as other symbols)
   * Uses 1-hour cache to reduce AI calls
   * Returns failure info instead of null for better observability
   */
  async generateMarketPulse(): Promise<MarketPulseData> {
    const CACHE_TTL_HOURS = 1;
    const cacheKey = 'market_pulse_SPY';
    const now = new Date().toISOString();

    // Helper to create failure response
    const failureResponse = (error: string): MarketPulseData => ({
      symbol: 'SPY',
      name: 'S&P 500 ETF',
      status: 'failed',
      articles_count: 0,
      source: 'none',
      error,
      generated_at: now
    });

    // Helper to create unavailable response
    const unavailableResponse = (error: string): MarketPulseData => ({
      symbol: 'SPY',
      name: 'S&P 500 ETF',
      status: 'unavailable',
      articles_count: 0,
      source: 'none',
      error,
      generated_at: now
    });

    logger.info('PreMarketDataBridge: Generating market pulse for SPY');

    try {
      // Check cache first - reuse if less than 1 hour old
      const cached = await (this.dal as any).get(cacheKey);
      if (cached && cached.data && cached.data.cached_at) {
        const cacheAge = Date.now() - new Date(cached.data.cached_at).getTime();
        const cacheAgeHours = cacheAge / (1000 * 60 * 60);

        if (cacheAgeHours < CACHE_TTL_HOURS) {
          logger.info('PreMarketDataBridge: Using cached market pulse', {
            cacheAgeMinutes: Math.round(cacheAge / 60000),
            direction: cached.data.direction
          });
          return cached.data;
        }
        logger.info('PreMarketDataBridge: Cache expired, regenerating market pulse');
      }

      // Fetch SPY news using standard Finnhub pipeline (same as other symbols)
      const spyNews = await getFreeStockNews('SPY', this.env);

      if (!spyNews || spyNews.length === 0) {
        const error = 'No SPY news available from Finnhub/fallback sources';
        logger.warn('PreMarketDataBridge: ' + error);
        return failureResponse(error);
      }

      logger.info('PreMarketDataBridge: Fetched SPY news via Finnhub pipeline', {
        count: spyNews.length
      });

      // Derive actual source from news articles
      const sourceTypes = new Set(spyNews.map(n => n.source_type).filter(Boolean));
      const actualSource = sourceTypes.size === 1 
        ? Array.from(sourceTypes)[0] 
        : sourceTypes.size > 1 
          ? 'mixed' 
          : 'unknown';

      // Run dual AI analysis on SPY with the fetched news
      const result = await performDualAIComparison('SPY', spyNews, this.env);

      if (result.error || (!result.models?.gpt && !result.models?.distilbert)) {
        const error = `AI analysis failed: ${result.error || 'both models returned no results'}`;
        logger.warn('PreMarketDataBridge: SPY analysis failed', {
          error: result.error,
          hasGPT: !!result.models?.gpt,
          hasDistilBERT: !!result.models?.distilbert
        });
        return {
          symbol: 'SPY',
          name: 'S&P 500 ETF',
          status: 'failed',
          articles_count: spyNews.length,
          source: actualSource,
          error,
          dual_model: {
            gemma: result.models?.gpt ? {
              status: result.models.gpt.error ? 'failed' : 'success',
              confidence: result.models.gpt.confidence,
              direction: result.models.gpt.direction,
              error: result.models.gpt.error
            } : { status: 'skipped' },
            distilbert: result.models?.distilbert ? {
              status: result.models.distilbert.error ? 'failed' : 'success',
              confidence: result.models.distilbert.confidence,
              direction: result.models.distilbert.direction,
              error: result.models.distilbert.error
            } : { status: 'skipped' }
          },
          generated_at: now
        };
      }

      // Use GPT (Gemma) if available, fall back to DistilBERT
      const selectedModel = result.models.gpt || result.models.distilbert;

      const marketPulse: MarketPulseData = {
        symbol: 'SPY',
        name: 'S&P 500 ETF',
        status: 'success',
        direction: this.normalizeSentiment(selectedModel!.direction),
        confidence: selectedModel!.confidence,
        articles_count: spyNews.length,
        source: actualSource,
        reasoning: selectedModel!.reasoning,
        dual_model: {
          gemma: result.models.gpt ? {
            status: result.models.gpt.error ? 'failed' : 'success',
            confidence: result.models.gpt.confidence,
            direction: result.models.gpt.direction,
            error: result.models.gpt.error
          } : { status: 'skipped' },
          distilbert: result.models.distilbert ? {
            status: result.models.distilbert.error ? 'failed' : 'success',
            confidence: result.models.distilbert.confidence,
            direction: result.models.distilbert.direction,
            error: result.models.distilbert.error
          } : { status: 'skipped' }
        },
        generated_at: now
      };

      // Add cached_at timestamp and cache for 1 hour
      const marketPulseWithCache = {
        ...marketPulse,
        cached_at: now
      };

      try {
        await (this.dal as any).put(cacheKey, marketPulseWithCache, { expirationTtl: 3600 }); // 1 hour TTL
        logger.info('PreMarketDataBridge: Market pulse cached', { cacheKey });
      } catch (cacheError) {
        logger.warn('PreMarketDataBridge: Failed to cache market pulse', { error: cacheError });
      }

      logger.info('PreMarketDataBridge: Market pulse generated', {
        status: marketPulse.status,
        direction: marketPulse.direction,
        confidence: marketPulse.confidence,
        articles_count: marketPulse.articles_count
      });

      return marketPulseWithCache;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('PreMarketDataBridge: Failed to generate market pulse', { error: errorMsg });
      return {
        symbol: 'SPY',
        name: 'S&P 500 ETF',
        status: 'failed',
        articles_count: 0,
        source: 'none',
        error: `Exception: ${errorMsg}`,
        generated_at: new Date().toISOString()
      };
    }
  }

  /**
   * Generate and store pre-market analysis data from modern sentiment data
   * This bridges the gap between the modern API and legacy reporting system
   * @param symbols - Symbols to analyze
   * @param targetDate - Optional target date (YYYY-MM-DD) for reruns, defaults to today
   */
  async generatePreMarketAnalysis(symbols: string[] = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'], targetDate?: string): Promise<AnalysisData> {
    const today = targetDate || new Date().toISOString().split('T')[0];
    logger.info('PreMarketDataBridge: Generating pre-market analysis', { symbols, targetDate: today, isRerun: !!targetDate });

    try {
      const trading_signals: Record<string, TradingSignal> = {};

      // Get sentiment data for each symbol (always uses live/current data)
      for (const symbol of symbols) {
        try {
          const sentimentData = await this.getSymbolSentimentData(symbol);

          if (sentimentData && sentimentData.confidence > 0.3) {
            trading_signals[symbol] = {
              symbol,
              sentiment_layers: [{
                sentiment: this.normalizeSentiment(sentimentData.sentiment),
                confidence: sentimentData.confidence,
                reasoning: sentimentData.reasoning || `${sentimentData.sentiment} sentiment analysis with ${sentimentData.confidence}% confidence`
              }],
              // Include dual model data for display
              dual_model: sentimentData.dual_model,
              articles_count: sentimentData.articles_analyzed,
              articles_content: sentimentData.articles_titles
            };

            // Write success to D1 with dual-model logging
            // news_source: Finnhub is primary (v3.10.1), fallbacks: FMP → NewsAPI → Yahoo
            await writeSymbolPredictionToD1(this.env, symbol, today, {
              status: 'success',
              sentiment: sentimentData.sentiment,
              confidence: sentimentData.confidence,
              direction: sentimentData.sentiment,
              articles_count: sentimentData.articles_analyzed,
              articles_content: sentimentData.articles_titles,
              news_source: 'finnhub',  // Primary source (v3.10.1)
              dual_model: sentimentData.dual_model
            });

            logger.debug(`Generated signal for ${symbol}`, {
              sentiment: sentimentData.sentiment,
              confidence: sentimentData.confidence
            });
          } else {
            // Determine the actual failure reason
            let failureReason = 'Unknown';
            if (!sentimentData) {
              failureReason = 'No sentiment data returned';
            } else if (sentimentData.articles_analyzed === 0) {
              failureReason = 'No news articles available';
            } else if (sentimentData.confidence <= 0.3) {
              failureReason = `Low confidence: ${sentimentData.confidence}`;
            } else if (sentimentData.reasoning) {
              failureReason = sentimentData.reasoning;
            }

            // Include skipped symbols in trading_signals so they appear in the report
            trading_signals[symbol] = {
              symbol,
              sentiment_layers: [{
                sentiment: 'skipped',
                confidence: sentimentData?.confidence || 0,
                reasoning: failureReason
              }],
              dual_model: sentimentData?.dual_model,
              articles_count: sentimentData?.articles_analyzed || 0,
              status: 'skipped',
              error_message: failureReason
            } as any;

            // Write skipped to D1 with detailed reason and dual-model logging
            await writeSymbolPredictionToD1(this.env, symbol, today, {
              status: 'skipped',
              confidence: sentimentData?.confidence,
              error_message: failureReason,
              articles_count: sentimentData?.articles_analyzed || 0,
              raw_response: sentimentData,
              dual_model: sentimentData?.dual_model
            });
          }
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.warn(`Failed to get sentiment for ${symbol}`, { error: errMsg, symbol });

          // Include failed symbols in trading_signals so they appear in the report
          trading_signals[symbol] = {
            symbol,
            sentiment_layers: [{
              sentiment: 'failed',
              confidence: 0,
              reasoning: errMsg
            }],
            status: 'failed',
            error_message: errMsg
          } as any;
          
          // Write failure to D1
          await writeSymbolPredictionToD1(this.env, symbol, today, {
            status: 'failed',
            error_message: errMsg,
            raw_response: { error: errMsg, stack: error instanceof Error ? error.stack : undefined }
          });
        }
      }

      // Generate Market Pulse (SPY sentiment) - v3.10.0
      // Now always returns a MarketPulseData with status (success/failed/unavailable)
      const marketPulse = await this.generateMarketPulse();

      // Create the analysis data structure
      const analysisData: AnalysisData = {
        trading_signals,
        market_pulse: marketPulse,
        timestamp: new Date().toISOString(),
        generated_at: new Date().toISOString()
      };

      // Store in the expected format for pre-market reports
      const analysisKey = `analysis_${today}`;
      await (this.dal as any).put(analysisKey, analysisData, { expirationTtl: 86400 }); // 24 hours

      // Warm the report cache with formatted data (v3.10.1)
      // This ensures the report endpoint returns fresh data immediately after job completion
      const reportCacheKey = `pre_market_report_${today}`;
      const allSignals = Object.values(trading_signals).map((signal: any) => ({
        symbol: signal.symbol,
        sentiment: signal.sentiment_layers?.[0]?.sentiment || 'neutral',
        confidence: signal.sentiment_layers?.[0]?.confidence ?? signal.confidence ?? null,
        gemma_confidence: signal.dual_model?.gemma?.confidence ?? null,
        distilbert_confidence: signal.dual_model?.distilbert?.confidence ?? null,
        status: signal.status || 'success',
        reason: signal.sentiment_layers?.[0]?.reasoning || ''
      }));

      const reportData = {
        type: 'pre_market_briefing',
        timestamp: new Date().toISOString(),
        market_status: 'pre_market',
        date: today,
        is_stale: false,
        key_insights: ['Pre-market analysis complete', `Data from ${today}`, 'Fresh data available'],
        high_confidence_signals: allSignals.filter(s => s.confidence !== null && s.confidence > 0.6),
        all_signals: allSignals,
        market_pulse: marketPulse,
        data_source: 'd1_snapshot',
        generated_at: new Date().toISOString(),
        symbols_analyzed: Object.keys(trading_signals).length
      };

      try {
        // Invalidate HTML cache first to ensure fresh page rendering
        const htmlCacheKey = `premarket_html_${today}`;
        try {
          await (this.dal as any).delete(htmlCacheKey);
          logger.info('PreMarketDataBridge: HTML cache invalidated', { htmlCacheKey });
        } catch (e) { /* ignore - may not exist */ }

        await (this.dal as any).put(reportCacheKey, reportData, { expirationTtl: 3600 }); // 1 hour
        logger.info('PreMarketDataBridge: Report cache warmed', { reportCacheKey });
      } catch (cacheError) {
        logger.warn('PreMarketDataBridge: Failed to warm report cache', { error: cacheError });
      }

      logger.info('PreMarketDataBridge: Pre-market analysis generated and stored', {
        symbols_count: Object.keys(trading_signals).length,
        analysis_key: analysisKey,
        market_pulse_status: marketPulse.status,
        market_pulse_direction: marketPulse.direction,
        market_pulse_error: marketPulse.error,
        high_confidence_signals: Object.values(trading_signals).filter(s => (
          (s as any).confidence_metrics?.overall_confidence ??
          (s as any).enhanced_prediction?.confidence ??
          s.sentiment_layers?.[0]?.confidence ??
          (s as any).confidence ??
          0
        ) > 0.7).length
      });

      return analysisData;

    } catch (error: unknown) {
      logger.error('PreMarketDataBridge: Failed to generate pre-market analysis', error);
      throw error;
    }
  }

  /**
   * Get symbol sentiment data from cache or by triggering analysis
   * @param symbol - Symbol to analyze
   */
  private async getSymbolSentimentData(symbol: string): Promise<ModernSentimentData | null> {
    try {
      // Try to get from cache first (always use today for live data)
      const actualToday = new Date().toISOString().split('T')[0];
      const cacheKey = `sentiment_symbol_${symbol}_${actualToday}`;
      const cached = await (this.dal as any).get(cacheKey);

      if (cached && cached.data) {
        logger.debug(`Cache hit for ${symbol}`, { symbol });
        return cached.data;
      }

      // If not in cache, trigger real-time sentiment analysis
      logger.info(`No cached data for ${symbol}, triggering real-time analysis`, { symbol });

      try {
        const batchResult = await batchDualAIAnalysis([symbol], (this.dal as any).env, {
          timeout: 15000, // 15 seconds for individual analysis
          cacheResults: true, // Cache the results for future use
          skipCache: false // Use existing cache if available
        });

        if (batchResult && batchResult.results && batchResult.results.length > 0) {
          const firstResult = batchResult.results[0];
          logger.info(`Batch analysis result for ${symbol}`, {
            symbol,
            hasError: !!firstResult.error,
            hasGPT: !!firstResult.models?.gpt,
            hasDistilBERT: !!firstResult.models?.distilbert,
            gptDirection: firstResult.models?.gpt?.direction,
            distilbertDirection: firstResult.models?.distilbert?.direction,
            signalAction: firstResult.signal?.action
          });

          if (firstResult && !firstResult.error && (firstResult.models?.gpt || firstResult.models?.distilbert)) {
            // Use GPT if available, otherwise fall back to DistilBERT
            const gptModel = firstResult.models.gpt;
            const distilbertModel = firstResult.models.distilbert;
            const selectedModel = gptModel || distilbertModel;

            // Determine selection reason
            let selectionReason = 'gemma_success';
            if (!gptModel && distilbertModel) {
              selectionReason = gptModel?.error?.includes('timeout') ? 'timeout_fallback' : 'gemma_failed_fallback';
            }

            // Build dual-model diagnostic data
            const dualModelData: DualModelData = {
              gemma: gptModel ? {
                status: gptModel.error ? 'failed' : 'success',
                confidence: gptModel.confidence,
                direction: gptModel.direction,
                error: gptModel.error
              } : {
                status: 'skipped',
                error: 'No GPT model data'
              },
              distilbert: distilbertModel ? {
                status: distilbertModel.error ? 'failed' : 'success',
                confidence: distilbertModel.confidence,
                direction: distilbertModel.direction,
                error: distilbertModel.error
              } : {
                status: 'skipped',
                error: 'No DistilBERT model data'
              },
              selection_reason: selectionReason
            };

            const sentimentData: ModernSentimentData = {
              symbol,
              sentiment: this.normalizeSentiment(selectedModel!.direction),
              confidence: selectedModel!.confidence,
              signal: firstResult.signal?.action || 'HOLD',
              reasoning: selectedModel!.reasoning || 'Sentiment analysis completed',
              articles_analyzed: selectedModel!.articles_analyzed || 0,
              articles_titles: selectedModel!.articles_titles || [],
              market_sentiment: selectedModel!.direction,
              sector_sentiment: selectedModel!.direction,
              dual_model: dualModelData
            };

            logger.info(`Generated sentiment data for ${symbol}`, {
              symbol,
              sentiment: sentimentData.sentiment,
              confidence: sentimentData.confidence,
              articles_analyzed: sentimentData.articles_analyzed,
              model_used: selectedModel!.model,
              signal_action: sentimentData.signal,
              gemma_status: dualModelData.gemma?.status,
              distilbert_status: dualModelData.distilbert?.status,
              selection_reason: selectionReason
            });

            return sentimentData;
          } else {
            logger.warn(`No valid model data found for ${symbol}`, {
              symbol,
              hasError: !!firstResult?.error,
              error: firstResult?.error,
              hasGPT: !!firstResult?.models?.gpt,
              hasDistilBERT: !!firstResult?.models?.distilbert
            });
          }
        }

        logger.warn(`Failed to generate sentiment data for ${symbol}`, {
          symbol,
          resultsCount: batchResult?.results?.length || 0,
          statistics: batchResult?.statistics
        });
        return null;

      } catch (analysisError: unknown) {
        logger.error(`Error triggering sentiment analysis for ${symbol}`, { symbol, error: analysisError });
        return null;
      }

    } catch (error: unknown) {
      logger.warn(`Error getting sentiment data for ${symbol}`, { symbol, error });
      return null;
    }
  }

  /**
   * Normalize sentiment values to match expected format
   */
  private normalizeSentiment(sentiment: string): string {
    const sentimentMap: Record<string, string> = {
      'bullish': 'bullish',
      'bearish': 'bearish',
      'neutral': 'neutral',
      'positive': 'bullish',
      'negative': 'bearish',
      'up': 'bullish',
      'down': 'bearish',
      'buy': 'bullish',
      'sell': 'bearish',
      'hold': 'neutral'
    };

    return sentimentMap[sentiment.toLowerCase()] || 'neutral';
  }

  /**
   * Force refresh of pre-market analysis data
   * @param symbols - Symbols to analyze
   * @param targetDate - Optional target date (YYYY-MM-DD) for reruns, defaults to today
   */
  async refreshPreMarketAnalysis(symbols?: string[], targetDate?: string): Promise<AnalysisData> {
    const today = targetDate || new Date().toISOString().split('T')[0];
    logger.info('Force refreshing pre-market analysis', { symbols, targetDate: today, isRerun: !!targetDate });

    // Clear existing cache
    const analysisKey = `analysis_${today}`;

    try {
      await (this.dal as any).delete(analysisKey);
      logger.info('Cleared existing pre-market analysis', { analysisKey });
    } catch (error: unknown) {
      logger.warn('Failed to clear existing analysis', { analysisKey, error });
    }

    // Generate fresh data
    return await this.generatePreMarketAnalysis(symbols, today);
  }

  /**
   * Check if pre-market analysis data exists
   */
  async hasPreMarketAnalysis(): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const analysisKey = `analysis_${today}`;
      const analysisData = await (this.dal as any).get(analysisKey);

      return !!(analysisData && (analysisData as any).trading_signals);
    } catch (error: unknown) {
      logger.warn('PreMarketDataBridge: Error checking pre-market analysis', error);
      return false;
    }
  }

  /**
   * Get current pre-market analysis data
   */
  async getCurrentPreMarketAnalysis(): Promise<AnalysisData | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const analysisKey = `analysis_${today}`;
      return await (this.dal as any).get(analysisKey, 1 as any) as any;
    } catch (error: unknown) {
      logger.warn('PreMarketDataBridge: Error getting current analysis', error);
      return null;
    }
  }
}

/**
 * Create pre-market data bridge instance
 */
export function createPreMarketDataBridge(env: CloudflareEnvironment): PreMarketDataBridge {
  return new PreMarketDataBridge(env);
}

/**
 * Quick utility function to generate pre-market data
 * This can be called by scripts or other modules
 */
export async function generatePreMarketData(env: CloudflareEnvironment, symbols?: string[]): Promise<void> {
  const bridge = createPreMarketDataBridge(env);
  await bridge.generatePreMarketAnalysis(symbols);
}

/**
 * Quick utility function to refresh pre-market data
 */
export async function refreshPreMarketData(env: CloudflareEnvironment, symbols?: string[]): Promise<void> {
  const bridge = createPreMarketDataBridge(env);
  await bridge.refreshPreMarketAnalysis(symbols);
}
