/**
 * Core Analysis Module - TypeScript
 * ✅ GPT-OSS-120B POWERED: Advanced AI analysis using Cloudflare's built-in AI models
 * Uses state-of-the-art language models for market sentiment and trading signal generation
 */

import { runEnhancedAnalysis } from './enhanced_analysis.js';
import { validateEnvironment, validateSymbols, validateMarketData } from './validation.js';
import { rateLimitedFetch } from './rate-limiter.js';
import { withCache, getCacheStats, type CacheStats } from './market-data-cache.js';
import { createLogger } from './logging.js';
import { createDAL, type DataAccessLayer } from './dal.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('analysis');

// Type Definitions
export interface TradingSignal {
  direction: 'up' | 'down' | 'neutral' | 'hold';
  target_price?: number;
  current_price: number;
  confidence: number;
  reasoning: string;
  timestamp?: Date | string;
  technical_indicators?: Record<string, any>;
  market_conditions?: string | Record<string, any>;
  tags?: string[];
  sentiment_layers?: any[];
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
  technical_indicators: Record<string, any>;
  market_conditions: string | Record<string, any>;
  sentiment_layers?: any[];
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

export interface EnhancedAnalysisResult {
  trading_signals?: TradingSignal[];
  overall_sentiment?: any;
  market_conditions?: string | Record<string, any>;
  sentiment_signals?: Record<string, any>;
  analysis_time?: string;
  trigger_mode?: string;
  symbols_analyzed?: string[];
  dual_ai_statistics?: any;
  execution_metrics?: any;
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
    sentiment_layers: any[];
    market_conditions: string | Record<string, any>;
    reasoning: string;
    tags: string[];
  };
  tracking: {
    morningSignal: {
      prediction: string;
      confidence: number;
      generatedAt: string;
    };
    intradayPerformance: any | null;
    endOfDayPerformance: any | null;
    weeklyPerformance: any | null;
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

export interface SignalTrackingData {
  date: string;
  signals: Array<{
    id: string;
    symbol: string;
    prediction: string;
    confidence: number;
    currentPrice: number;
    status: string;
    tracking: any;
  }>;
  lastUpdated: string;
}

export interface PerformanceData {
  status?: string;
  [key: string]: any;
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

  console.log(`🧠 Starting genuine neural network analysis for ${symbols.length} symbols...`);

  let successfulAnalyses = 0;

  // Analyze each symbol with genuine neural networks
  for (const symbol of symbols) {
    try {
      console.log(`   🧠 Analyzing ${symbol} with GPT-OSS-120B + DistilBERT-SST-2 models...`);

      // Get real market data with caching and validation
      const marketData = await withCache(symbol, () => getMarketData(symbol));
      validateMarketData(marketData);

      if (!marketData.data) {
        throw new Error('Market data is undefined');
      }

      // Run GPT-OSS-120B enhanced analysis
      console.log(`   🤖 Starting GPT-OSS-120B analysis for ${symbol}...`);
      console.log(`   📊 Market data length: ${marketData.data.ohlcv.length} candles`);
      console.log(`   📊 Current price: $${marketData.data.ohlcv[marketData.data.ohlcv.length - 1][3].toFixed(2)}`);

      const gptAnalysis: EnhancedAnalysisResult = await runEnhancedAnalysis(env, {
        symbol: symbol,
        marketData: marketData.data,
        currentTime: currentTime
      });

      console.log(`   🔍 GPT analysis completed for ${symbol}`);
      console.log(`   📈 Analysis result:`, gptAnalysis.overall_sentiment);

      if (!gptAnalysis || !gptAnalysis.trading_signals || gptAnalysis.trading_signals.length === 0) {
        console.error(`   ❌ GPT analysis failed for ${symbol} - no trading signals generated`);
        throw new Error('GPT-OSS-120B analysis failed to generate trading signals');
      }

      // Use the primary trading signal from GPT analysis
      const primarySignal = gptAnalysis.trading_signals[0];
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
        market_conditions: gptAnalysis.market_conditions || 'Unknown'
      };

      analysisResults.trading_signals[symbol] = combinedSignal;
      successfulAnalyses++;

      console.log(`   ✅ ${symbol}: ${combinedSignal.direction} $${combinedSignal.current_price.toFixed(2)} → $${combinedSignal.predicted_price.toFixed(2)} (${(combinedSignal.confidence * 100).toFixed(1)}%)`);

    } catch (error: any) {
      console.error(`   ❌ CRITICAL: ${symbol} analysis failed:`, error.message);
      console.error(`   ❌ Error name:`, error.name);
      console.error(`   ❌ Error stack:`, error.stack);
      console.error(`   ❌ Error details:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));

      // Add detailed context about where the failure occurred
      console.error(`   🔍 Analysis context for ${symbol}:`);
      console.error(`      - Current time: ${new Date().toISOString()}`);
      console.error(`      - Env bindings available: TRADING_RESULTS=${!!env.TRADING_RESULTS}, TRAINED_MODELS=${!!env.TRAINED_MODELS}`);

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

  console.log(`✅ Neural network analysis completed: ${successfulAnalyses}/${symbols.length} symbols successful`);
  console.log(`📊 Cache performance: ${cacheStats.hits} hits, ${cacheStats.misses} misses (${Math.round(cacheStats.hitRate * 100)}% hit rate)`);

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
    console.log(`   📊 Fetching real market data for ${symbol}...`);

    // Yahoo Finance API call for recent OHLCV data
    const days = 50; // Get 50 calendar days to ensure we have 30+ trading days
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (days * 24 * 60 * 60);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;

    const response = await rateLimitedFetch(url, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API returned ${response.status}`);
    }

    const data = await response.json();
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

    console.log(`   📊 Retrieved ${ohlcv.length} days of data for ${symbol}, current: $${currentPrice.toFixed(2)}`);

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
    console.error(`   ❌ Market data error for ${symbol}:`, error.message);
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
  console.log('📊 Running weekly market close analysis...');

  const analysis = await runBasicAnalysis(env, {
    triggerMode: 'weekly_market_close_analysis'
  });

  return analysis;
}

/**
 * Run pre-market analysis
 */
export async function runPreMarketAnalysis(env: CloudflareEnvironment, options: AnalysisOptions = {}): Promise<AnalysisResults> {
  console.log(`🌅 Running pre-market analysis (${options.triggerMode})...`);

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
        averageConfidence: signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length,
        generatedAt: currentTime.toISOString(),
        symbols: signals.map(s => s.symbol)
      }
    };

    const dal: DataAccessLayer = createDAL(env);

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
        prediction: s.prediction,
        confidence: s.confidence,
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
      error: error.message
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
    const dal: DataAccessLayer = createDAL(env);
    const result = await dal.read(trackingKey);
    if (result.success && result.data) {
      const trackingData = result.data as SignalTrackingData;
      return trackingData.signals as unknown as HighConfidenceSignal[] || [];
    }
  } catch (error: any) {
    logger.error('Failed to retrieve signals for tracking', {
      date: dateStr,
      error: error.message
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
    const dal: DataAccessLayer = createDAL(env);
    const result = await dal.read(trackingKey);

    if (result.success && result.data) {
      const parsed = result.data as SignalTrackingData;
      const signal = parsed.signals.find(s => s.id === signalId);

      if (signal) {
        signal.tracking.intradayPerformance = performanceData;
        signal.status = performanceData.status || signal.status;

        const writeResult = await dal.write(trackingKey, parsed);
        if (!writeResult.success) {
          logger.warn('Failed to update tracking data', { error: writeResult.error });
        }

        logger.debug('Updated signal performance tracking', {
          signalId,
          symbol: signal.symbol,
          status: signal.status
        });
      }
    }
  } catch (error: any) {
    logger.error('Failed to update signal performance tracking', {
      signalId,
      date: dateStr,
      error: error.message
    });
  }
}
