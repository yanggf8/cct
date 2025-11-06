/**
 * Pre-Market Data Bridge Module
 * Bridges the gap between sentiment analysis data and pre-market reporting
 * Transforms modern API v1 sentiment data into the legacy format expected by pre-market reports
 */

import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
import { createLogger } from './logging.js';
import { batchDualAIAnalysis } from './dual-ai-analysis.js';
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
}

/**
 * Analysis data structure expected by pre-market reports
 */
interface AnalysisData {
  trading_signals: Record<string, TradingSignal>;
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
  market_sentiment?: string;
  sector_sentiment?: string;
}

/**
 * Pre-Market Data Bridge
 * Transforms modern sentiment data into legacy format for pre-market reporting
 */
export class PreMarketDataBridge {
  private dal: ReturnType<typeof createSimplifiedEnhancedDAL>;

  constructor(env: CloudflareEnvironment) {
    this.dal = createSimplifiedEnhancedDAL(env, {
      enableCache: true,
      environment: env.ENVIRONMENT || 'production'
    });
  }

  /**
   * Generate and store pre-market analysis data from modern sentiment data
   * This bridges the gap between the modern API and legacy reporting system
   */
  async generatePreMarketAnalysis(symbols: string[] = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']): Promise<AnalysisData> {
    logger.info('PreMarketDataBridge: Generating pre-market analysis', { symbols });

    try {
      const trading_signals: Record<string, TradingSignal> = {};
      const today = new Date().toISOString().split('T')[0];

      // Get sentiment data for each symbol
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
              }]
            };

            logger.debug(`Generated signal for ${symbol}`, {
              sentiment: sentimentData.sentiment,
              confidence: sentimentData.confidence
            });
          }
        } catch (error: unknown) {
          logger.warn(`Failed to get sentiment for ${symbol}`, { error, symbol });
        }
      }

      // Create the analysis data structure
      const analysisData: AnalysisData = {
        trading_signals,
        timestamp: new Date().toISOString(),
        generated_at: new Date().toISOString()
      };

      // Store in the expected format for pre-market reports
      const analysisKey = `analysis_${today}`;
      await (this.dal as any).put(analysisKey, analysisData, { expirationTtl: 86400 }); // 24 hours

      logger.info('PreMarketDataBridge: Pre-market analysis generated and stored', {
        symbols_count: Object.keys(trading_signals).length,
        analysis_key: analysisKey,
        high_confidence_signals: Object.values(trading_signals).filter(s => s.sentiment_layers[0].confidence > 0.7).length
      });

      return analysisData;

    } catch (error: unknown) {
      logger.error('PreMarketDataBridge: Failed to generate pre-market analysis', error);
      throw error;
    }
  }

  /**
   * Get symbol sentiment data from cache or by triggering analysis
   */
  private async getSymbolSentimentData(symbol: string): Promise<ModernSentimentData | null> {
    try {
      // Try to get from cache first
      const cacheKey = `sentiment_symbol_${symbol}_${new Date().toISOString().split('T')[0]}`;
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
            const model = firstResult.models.gpt || firstResult.models.distilbert;

            const sentimentData: ModernSentimentData = {
              symbol,
              sentiment: this.normalizeSentiment(model.direction),
              confidence: model.confidence,
              signal: firstResult.signal?.action || 'HOLD',
              reasoning: model.reasoning || 'Sentiment analysis completed',
              articles_analyzed: model.articles_analyzed || 0,
              market_sentiment: model.direction,
              sector_sentiment: model.direction
            };

            logger.info(`Generated sentiment data for ${symbol}`, {
              symbol,
              sentiment: sentimentData.sentiment,
              confidence: sentimentData.confidence,
              articles_analyzed: sentimentData.articles_analyzed,
              model_used: model.model,
              signal_action: sentimentData.signal
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
   */
  async refreshPreMarketAnalysis(symbols?: string[]): Promise<AnalysisData> {
    logger.info('Force refreshing pre-market analysis', { symbols });

    // Clear existing cache
    const today = new Date().toISOString().split('T')[0];
    const analysisKey = `analysis_${today}`;

    try {
      await (this.dal as any).delete(analysisKey);
      logger.info('Cleared existing pre-market analysis', { analysisKey });
    } catch (error: unknown) {
      logger.warn('Failed to clear existing analysis', { analysisKey, error });
    }

    // Generate fresh data
    return await this.generatePreMarketAnalysis(symbols);
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
      return await this.dal.get(analysisKey, 1 as any);
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