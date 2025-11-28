/**
 * Core Analysis Module - TypeScript
 * ✅ GPT-OSS-120B POWERED: Advanced AI analysis using Cloudflare's built-in AI models
 * Uses state-of-the-art language models for market sentiment and trading signal generation
 */

import { runEnhancedAnalysis, type EnhancedAnalysisResults } from './enhanced_analysis.js';
import { validateEnvironment, validateSymbols, validateMarketData } from './validation.js';
import { rateLimitedFetch } from './rate-limiter.js';
import { withCache, getCacheStats } from './market-data-cache.js';
import { createLogger } from './logging.js';
import { createSimplifiedEnhancedDAL, type CacheAwareResult } from './simplified-enhanced-dal.js';
import { CONFIG } from './config.js';
import type { CloudflareEnvironment, SentimentLayer, TrackedSignal } from '../types.js';
import { isSignalTrackingData } from '../types.js';

const logger = createLogger('analysis');

// Type Definitions
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
}
export interface TradingSignal {
  direction: 'up' | 'down' | 'neutral' | 'hold';
  target_price?: number;
  current_price: number;
  confidence: number;
  reasoning: string;
  timestamp?: Date | string;
  technical_indicators?: Record<string, number | string>;
  market_conditions?: string | Record<string, number | string>;
  tags?: string[];
  sentiment_layers?: SentimentLayer[];
  model_type?: string;
}

export interface SymbolAnalysisResult {
  symbol: string;
  direction: 'up' | 'down' | 'neutral' | 'hold';
  current_price: number;
  predicted_price: number;
  confidence: number;
  reasoning: string;
  model_type: string;
  timestamp: Date;
  technical_indicators: Record<string, number | string>;
  market_conditions: string | Record<string, number | string>;
  sentiment_layers?: SentimentLayer[];
  tags?: string[];
}

export interface PerformanceMetrics {
  success_rate: number;
  total_symbols: number;
  successful_analyses: number;
  failed_analyses: number;
  cache_stats?: {
    hit_rate: number;
    cache_hits: number;
    cache_misses: number;
    total_entries: number;
  };
}

export interface AnalysisResults {
  symbols_analyzed: string[];
  trading_signals: Record<string, SymbolAnalysisResult>;
  analysis_time: string;
  trigger_mode: string;
  performance_metrics: PerformanceMetrics;
}

export interface AnalysisOptions {
  triggerMode?: string;
}

export interface MarketDataResponse {
  success: boolean;
  data?: {
    symbol: string;
    current_price: number;
    ohlcv: number[][];
    last_updated: string;
  };
  error?: string;
}

export interface DualAIStatistics {
  agreement_rate?: number;
  confidence_gap?: number;
  model_consistency?: number;
}

export interface ExecutionMetrics {
  total_time_ms?: number;
  model_time_ms?: number;
  data_fetch_time_ms?: number;
}

export interface EnhancedAnalysisResult {
  trading_signals?: TradingSignal[];
  overall_sentiment?: string | { sentiment: string; confidence: number };
  market_conditions?: string | Record<string, number | string>;
  sentiment_signals?: Record<string, number | string>;
  analysis_time?: string;
  trigger_mode?: string;
  symbols_analyzed?: string[];
  dual_ai_statistics?: DualAIStatistics;
  execution_metrics?: ExecutionMetrics;
}

export interface HighConfidenceSignal {
  id: string;
  symbol: string;
  prediction: 'up' | 'down' | 'neutral' | 'hold';
  confidence: number;
  currentPrice: number;
  predictedPrice: number;
  timestamp: string;
  status: 'pending' | 'tracking' | 'completed' | 'failed';
  analysisData: {
    sentiment_layers: SentimentLayer[];
    market_conditions: string | Record<string, number | string>;
    reasoning: string;
    tags: string[];
  };
  tracking: {
    morningSignal: {
      prediction: string;
      confidence: number;
      generatedAt: string;
    };
    intradayPerformance: PerformanceData | null;
    endOfDayPerformance: PerformanceData | null;
    weeklyPerformance: PerformanceData | null;
  };
}

export interface HighConfidenceSignalsData {
  date: string;
  signals: HighConfidenceSignal[];
  metadata: {
    totalSignals: number;
    highConfidenceSignals: number;
    averageConfidence: number;
    generatedAt: string;
    symbols: string[];
  };
}

export interface SignalTracking {
  morningSignal: {
    prediction: string;
    confidence: number;
    generatedAt: string;
  };
  intradayPerformance: PerformanceData | null;
  endOfDayPerformance: PerformanceData | null;
  weeklyPerformance: PerformanceData | null;
}

export interface SignalTrackingData {
  date: string;
  signals: TrackedSignal[];
  lastUpdated: string;
}

export interface PerformanceData {
  status?: string;
  [key: string]: any;
}

/**
 * Analyze a single symbol with dual AI models
 * Extracted from runBasicAnalysis for better testability and maintainability
 */
async function analyzeSingleSymbol(
  env: CloudflareEnvironment,
  symbol: string,
  currentTime: Date
): Promise<SymbolAnalysisResult> {
  logger.info('Analyzing symbol with dual AI models', { symbol, models: 'GPT-OSS-120B + DistilBERT-SST-2' });

  // Get real market data with caching and validation
  const marketData = await withCache(symbol, () => getMarketData(symbol));
  validateMarketData(marketData);

  if (!marketData.data) {
    throw new Error('Market data is undefined');
  }

  // Run GPT-OSS-120B enhanced analysis
  logger.debug('Starting GPT-OSS-120B analysis', {
    symbol,
    candleCount: marketData.data.ohlcv.length,
    currentPrice: marketData.data.ohlcv[marketData.data.ohlcv.length - 1][3].toFixed(2)
  });

  const gptAnalysis: EnhancedAnalysisResults = await runEnhancedAnalysis(env, {
    symbol: symbol,
    marketData: marketData.data,
    currentTime: currentTime
  });

  logger.debug('GPT analysis completed', { symbol, sentiment: gptAnalysis.sentiment_signals?.[symbol]?.sentiment_analysis?.sentiment });

  if (!gptAnalysis || !gptAnalysis.sentiment_signals || !gptAnalysis.sentiment_signals[symbol]) {
    logger.error('GPT analysis failed - no trading signals generated', { symbol });
    throw new Error('GPT-OSS-120B analysis failed to generate trading signals');
  }

  // Create a compatible signal structure from the sentiment analysis
  const sentimentSignal = gptAnalysis.sentiment_signals[symbol];
  const direction: 'up' | 'down' | 'neutral' =
    sentimentSignal.sentiment_analysis?.sentiment === 'bullish' ? 'up' :
    sentimentSignal.sentiment_analysis?.sentiment === 'bearish' ? 'down' : 'neutral';

  const primarySignal = {
    direction,
    current_price: marketData.data.ohlcv[marketData.data.ohlcv.length - 1][3],
    target_price: marketData.data.ohlcv[marketData.data.ohlcv.length - 1][3], // Use current as fallback
    confidence: sentimentSignal.sentiment_analysis?.confidence || 0.7,
    reasoning: sentimentSignal.sentiment_analysis?.reasoning || 'GPT-OSS-120B analysis',
    market_conditions: 'Unknown'
  };
  const combinedSignal: SymbolAnalysisResult = {
    symbol: symbol,
    direction: primarySignal.direction,
    current_price: marketData.data.ohlcv[marketData.data.ohlcv.length - 1][3],
    predicted_price: primarySignal.target_price || primarySignal.current_price,
    confidence: primarySignal.confidence || 0.7,
    reasoning: primarySignal.reasoning || 'GPT-OSS-120B analysis',
    model_type: 'GPT-OSS-120B',
    timestamp: currentTime,
    technical_indicators: {},
    market_conditions: 'GPT-OSS-120B analysis complete'
  };

  logger.info('Symbol analysis successful', {
    symbol,
    direction: combinedSignal.direction,
    currentPrice: combinedSignal.current_price.toFixed(2),
    predictedPrice: combinedSignal.predicted_price.toFixed(2),
    confidence: (combinedSignal.confidence * 100).toFixed(1)
  });

  return combinedSignal;
}

/**
 * Run comprehensive analysis
 * ✅ GENUINE DUAL AI: Real GPT-OSS-120B + DistilBERT-SST-2 models with agreement logic
 */
export async function runBasicAnalysis(env: CloudflareEnvironment, options: AnalysisOptions = {}): Promise<AnalysisResults> {
  // Validate environment
  validateEnvironment(env);

  // Validate and sanitize symbols
  const symbolsRaw = (env.TRADING_SYMBOLS || 'AAPL,MSFT,GOOGL,TSLA,NVDA').split(',').map((s: string) => s.trim());
  const symbols = validateSymbols(symbolsRaw);
  const currentTime = new Date();

  const analysisResults: AnalysisResults = {
    symbols_analyzed: symbols,
    trading_signals: {},
    analysis_time: currentTime.toISOString(),
    trigger_mode: options.triggerMode || 'manual_analysis',
    performance_metrics: {
      success_rate: 0,
      total_symbols: symbols.length,
      successful_analyses: 0,
      failed_analyses: 0
    }
  };

  logger.info('Starting genuine neural network analysis', { symbolCount: symbols.length });

  let successfulAnalyses = 0;

  // Analyze each symbol with genuine neural networks
  for (const symbol of symbols) {
    try {
      const combinedSignal = await analyzeSingleSymbol(env, symbol, currentTime);
      analysisResults.trading_signals[symbol] = combinedSignal;
      successfulAnalyses++;

    } catch (error: any) {
      logger.error('Symbol analysis failed', {
        symbol,
        error: (error instanceof Error ? error.message : String(error)),
        errorName: error.name,
        stack: error.stack,
        errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        context: {
          currentTime: new Date().toISOString(),
          tradingResultsAvailable: !!env.MARKET_ANALYSIS_CACHE,
          trainedModelsAvailable: !!env.TRAINED_MODELS
        }
      });

      analysisResults.performance_metrics.failed_analyses++;
    }
  }

  // Update performance metrics
  analysisResults.performance_metrics.successful_analyses = successfulAnalyses;
  analysisResults.performance_metrics.success_rate = (successfulAnalyses / symbols.length) * 100;

  // Add cache statistics
  const cacheStats: CacheStats = getCacheStats();
  analysisResults.performance_metrics.cache_stats = {
    hit_rate: Math.round(cacheStats.hitRate * 100),
    cache_hits: cacheStats.hits,
    cache_misses: cacheStats.misses,
    total_entries: cacheStats.totalEntries
  };

  logger.info('Neural network analysis completed', {
    successfulAnalyses,
    totalSymbols: symbols.length,
    successRate: `${Math.round((successfulAnalyses / symbols.length) * 100)}%`
  });

  logger.info('Cache performance', {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate: `${Math.round(cacheStats.hitRate * 100)}%`
  });

  // Generate and track high-confidence signals
  const highConfidenceSignals = generateHighConfidenceSignals(analysisResults, currentTime, env);

  // Save signals to KV storage for 4-report workflow
  if (highConfidenceSignals.length > 0) {
    await saveHighConfidenceSignals(env, highConfidenceSignals, currentTime);
    logger.info('Generated high-confidence signals for 4-report workflow', {
      signalCount: highConfidenceSignals.length,
      symbols: highConfidenceSignals.map(s => s.symbol)
    });
  }

  return analysisResults;
}

/**
 * Get real market data from Yahoo Finance
 */
async function getMarketData(symbol: string): Promise<MarketDataResponse> {
  try {
    logger.debug('Fetching real market data', { symbol });

    // Yahoo Finance API call for recent OHLCV data
    const days = 50; // Get 50 calendar days to ensure we have 30+ trading days
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (days * 24 * 60 * 60);

    const url = `${CONFIG.MARKET_DATA.YAHOO_FINANCE_BASE_URL}/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;

    const response = await rateLimitedFetch(url, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API returned ${response.status}`);
    }

    const data = await response.json() as any;
    const result = data.chart.result[0];

    if (!result || !result.indicators) {
      throw new Error('Invalid response format from Yahoo Finance');
    }

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const volume = result.indicators.quote[0].volume;

    // Convert to OHLCV format with timestamps
    const ohlcv: number[][] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] && quote.high[i] && quote.low[i] && quote.close[i] && volume[i]) {
        ohlcv.push([
          quote.open[i],
          quote.high[i],
          quote.low[i],
          quote.close[i],
          volume[i],
          timestamps[i] // Include timestamp for date conversion
        ]);
      }
    }

    if (ohlcv.length < 10) {
      throw new Error('Insufficient historical data');
    }

    const currentPrice = ohlcv[ohlcv.length - 1][3]; // Last close price (index unchanged)

    logger.debug('Market data retrieved', {
      symbol,
      dataPoints: ohlcv.length,
      currentPrice: currentPrice.toFixed(2)
    });

    return {
      success: true,
      data: {
        symbol,
        current_price: currentPrice,
        ohlcv: ohlcv,
        last_updated: new Date().toISOString()
      }
    };

  } catch (error: any) {
    logger.error('Market data error', { symbol, error: (error instanceof Error ? error.message : String(error)) });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Run weekend market close analysis
 */
export async function runWeeklyMarketCloseAnalysis(env: CloudflareEnvironment, currentTime: Date): Promise<AnalysisResults> {
  logger.info('Running weekly market close analysis');

  const analysis = await runBasicAnalysis(env, {
    triggerMode: 'weekly_market_close_analysis'
  });

  return analysis;
}

/**
 * Run pre-market analysis
 */
export async function runPreMarketAnalysis(env: CloudflareEnvironment, options: AnalysisOptions = {}): Promise<AnalysisResults> {
  logger.info('Running pre-market analysis', { triggerMode: options.triggerMode });

  const analysis = await runBasicAnalysis(env, options);

  return analysis;
}

/**
 * Generate high-confidence signals from analysis results
 */
function generateHighConfidenceSignals(
  analysisResults: AnalysisResults,
  currentTime: Date,
  env: CloudflareEnvironment
): HighConfidenceSignal[] {
  const signals: HighConfidenceSignal[] = [];
  const signalConfidenceThreshold = parseFloat(env.SIGNAL_CONFIDENCE_THRESHOLD || '0.7');

  for (const [symbol, signal] of Object.entries(analysisResults.trading_signals)) {
    if (signal.confidence >= signalConfidenceThreshold) {
      const enhancedSignal: HighConfidenceSignal = {
        id: crypto.randomUUID(),
        symbol,
        prediction: signal.direction,
        confidence: signal.confidence,
        currentPrice: signal.current_price,
        predictedPrice: signal.predicted_price,
        timestamp: currentTime.toISOString(),
        status: 'pending',
        analysisData: {
          sentiment_layers: signal.sentiment_layers || [],
          market_conditions: signal.market_conditions || {},
          reasoning: signal.reasoning || '',
          tags: signal.tags || []
        },
        tracking: {
          morningSignal: {
            prediction: signal.direction,
            confidence: signal.confidence,
            generatedAt: currentTime.toISOString()
          },
          intradayPerformance: null,
          endOfDayPerformance: null,
          weeklyPerformance: null
        }
      };

      signals.push(enhancedSignal);
      logger.debug('Generated high-confidence signal', {
        symbol,
        confidence: signal.confidence,
        prediction: signal.direction
      });
    }
  }

  return signals;
}

/**
 * Save high-confidence signals to KV storage
 */
async function saveHighConfidenceSignals(
  env: CloudflareEnvironment,
  signals: HighConfidenceSignal[],
  currentTime: Date
): Promise<void> {
  const dateStr = currentTime.toISOString().split('T')[0];
  const signalsKey = `high_confidence_signals_${dateStr}`;

  try {
    const signalsData: HighConfidenceSignalsData = {
      date: dateStr,
      signals: signals,
      metadata: {
        totalSignals: signals.length,
        highConfidenceSignals: signals.filter(s => s.confidence >= 80).length,
        averageConfidence: signals.reduce((sum: any, s: any) => sum + s.confidence, 0) / signals.length,
        generatedAt: currentTime.toISOString(),
        symbols: signals.map(s => s.symbol)
      }
    };

    const dal = createSimplifiedEnhancedDAL(env, {
      enableCache: true,
      environment: env.ENVIRONMENT || 'production'
    });

    const writeResult = await dal.write(signalsKey, signalsData);
    if (!writeResult.success) {
      logger.warn('Failed to write signals data', { error: writeResult.error });
    }

    // Also save for intraday tracking
    const trackingKey = `signal_tracking_${dateStr}`;
    const trackingData: SignalTrackingData = {
      date: dateStr,
      signals: signals.map(s => ({
        id: s.id,
        symbol: s.symbol,
        signal: s.prediction as 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | 'AVOID',
        prediction: s.prediction,
        confidence: s.confidence,
        sentiment: s.prediction === 'up' ? 'bullish' : s.prediction === 'down' ? 'bearish' : 'neutral',
        currentPrice: s.currentPrice,
        status: s.status,
        tracking: s.tracking
      })),
      lastUpdated: currentTime.toISOString()
    };

    const trackingWriteResult = await dal.write(trackingKey, trackingData);
    if (!trackingWriteResult.success) {
      logger.warn('Failed to write tracking data', { error: trackingWriteResult.error });
    }

    logger.info('Saved high-confidence signals to KV storage', {
      date: dateStr,
      signalCount: signals.length,
      trackingKey: trackingKey
    });

  } catch (error: any) {
    logger.error('Failed to save high-confidence signals to KV', {
      date: dateStr,
      error: (error instanceof Error ? error.message : String(error))
    });
  }
}

/**
 * Get high-confidence signals for intraday tracking
 */
export async function getHighConfidenceSignalsForTracking(env: CloudflareEnvironment, date: Date): Promise<HighConfidenceSignal[]> {
  const dateStr = date.toISOString().split('T')[0];
  const trackingKey = `signal_tracking_${dateStr}`;

  try {
    const dal = createSimplifiedEnhancedDAL(env, {
      enableCache: true,
      environment: env.ENVIRONMENT || 'production'
    });
    const result = await dal.read(trackingKey);
    if (result.success && result.data) {
      // Use type guard instead of type assertion
      if (isSignalTrackingData(result.data)) {
        return result.data.signals as unknown as HighConfidenceSignal[] || [];
      } else {
        logger.warn('Invalid signal tracking data structure', { date: dateStr });
      }
    }
  } catch (error: any) {
    logger.error('Failed to retrieve signals for tracking', {
      date: dateStr,
      error: (error instanceof Error ? error.message : String(error))
    });
  }

  return [];
}

/**
 * Update signal performance tracking
 */
export async function updateSignalPerformanceTracking(
  env: CloudflareEnvironment,
  signalId: string,
  performanceData: PerformanceData,
  date: Date
): Promise<void> {
  const dateStr = date.toISOString().split('T')[0];
  const trackingKey = `signal_tracking_${dateStr}`;

  try {
    const dal = createSimplifiedEnhancedDAL(env, {
      enableCache: true,
      environment: env.ENVIRONMENT || 'production'
    });
    const result = await dal.read(trackingKey);

    if (result.success && result.data) {
      // Use type guard instead of type assertion
      if (isSignalTrackingData(result.data)) {
        const signal = result.data.signals.find(s => s.id === signalId);

        if (signal) {
          signal.tracking.intradayPerformance = performanceData;
          signal.status = performanceData.status || signal.status;

          const writeResult = await dal.write(trackingKey, result.data);
          if (!writeResult.success) {
            logger.warn('Failed to update tracking data', { error: writeResult.error });
          }

          logger.debug('Updated signal performance tracking', {
            signalId,
            symbol: signal.symbol,
            status: signal.status
          });
        }
      } else {
        logger.warn('Invalid signal tracking data structure for update', { date: dateStr });
      }
    }
  } catch (error: any) {
    logger.error('Failed to update signal performance tracking', {
      signalId,
      date: dateStr,
      error: (error instanceof Error ? error.message : String(error))
    });
  }
}
