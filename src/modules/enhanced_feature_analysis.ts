/**
 * Enhanced Feature Analysis Module
 * Integrates 33 technical indicators with existing GPT-OSS-120B + DistilBERT-SST-2 dual AI models
 * Combines feature-rich analysis with sentiment for maximum prediction accuracy
 */

import { createTechnicalFeatures, normalizeTechnicalFeatures } from './technical_indicators.js';
import { getFreeStockNews, analyzeTextSentiment } from './free_sentiment_pipeline.js';
import { runEnhancedAnalysis } from './enhanced_analysis.js';
import type { CloudflareEnvironment } from '../types.js';

// Type definitions
interface FeatureWeights {
  dual_ai_models: number;
  technical_features: number;
  sentiment_analysis: number;
}

interface FeatureImportance {
  'rsi_14': number;
  'bb_position': number;
  'macd_histogram': number;
  'return_5d': number;
  'volume_ratio': number;
  'price_vs_sma20': number;
  'atr': number;
  'stoch_k': number;
  'williams_r': number;
  'sma20_slope': number;
}

interface SentimentData {
  sentiment_score: number;
  confidence: number;
  reasoning: string;
  error?: string;
}

interface NeuralSignal {
  symbol: string;
  current_price: number;
  predicted_price: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  [key: string]: any;
}

interface TechnicalFeatures {
  [key: string]: number | null;
  close: number;
  rsi_14: number | null;
  bb_position: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  price_vs_sma20: number | null;
  volume_ratio: number | null;
  williams_r: number | null;
  stoch_k: number | null;
}

interface TechnicalPrediction {
  predicted_price: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  technical_score: number;
  reasoning: string;
  signal_strength: number;
}

interface NeuralComponent {
  predicted_price: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  weight: number;
}

interface TechnicalComponent extends TechnicalPrediction {
  weight: number;
  feature_count: number;
}

interface SentimentComponent {
  sentiment_score: number;
  confidence: number;
  reasoning: string;
  weight: number;
}

interface Components {
  neural_networks: NeuralComponent | null;
  technical_features: TechnicalComponent | null;
  sentiment_analysis: SentimentComponent;
}

interface EnhancedSignal {
  symbol: string;
  timestamp: string;
  current_price: number;
  predicted_price: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  model: string;
  components: Components;
  technical_summary?: string;
  feature_status?: string;
  error?: string;
}

interface SystemPerformance {
  success_rate: number;
  avg_confidence: number;
  feature_coverage: number;
}

interface Methodology {
  neural_networks: string;
  technical_features: string;
  sentiment_analysis: string;
}

interface EnhancedFeatureAnalysisResult {
  timestamp: string;
  analysis_type: string;
  feature_count: number;
  symbols_analyzed: string[];
  trading_signals: { [symbol: string]: EnhancedSignal | any };
  system_performance: SystemPerformance;
  methodology: Methodology;
}

interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ConsensusVotes {
  UP: number;
  DOWN: number;
  NEUTRAL: number;
}

interface CombinedPrediction {
  predicted_price: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  consensus_votes: ConsensusVotes;
}

// Feature weights for ensemble prediction
const FEATURE_WEIGHTS: FeatureWeights = {
  dual_ai_models: 0.5,    // GPT-OSS-120B + DistilBERT-SST-2 base models
  technical_features: 0.3, // 33 technical indicators
  sentiment_analysis: 0.2  // News sentiment
};

// Feature importance from local XGBoost training (top features)
const FEATURE_IMPORTANCE: FeatureImportance = {
  'rsi_14': 0.15,
  'bb_position': 0.12,
  'macd_histogram': 0.10,
  'return_5d': 0.08,
  'volume_ratio': 0.07,
  'price_vs_sma20': 0.06,
  'atr': 0.05,
  'stoch_k': 0.04,
  'williams_r': 0.04,
  'sma20_slope': 0.03
};

/**
 * Enhanced stock analysis with technical features
 */
export async function runEnhancedFeatureAnalysis(
  symbols: string[],
  env: CloudflareEnvironment
): Promise<EnhancedFeatureAnalysisResult> {
  console.log('🔬 Enhanced Feature Analysis - Technical Indicators + Neural Networks + Sentiment');

  const results: EnhancedFeatureAnalysisResult = {
    timestamp: new Date().toISOString(),
    analysis_type: 'enhanced_feature_analysis',
    feature_count: 33,
    symbols_analyzed: symbols,
    trading_signals: {},
    system_performance: {
      success_rate: 100,
      avg_confidence: 0,
      feature_coverage: 0
    },
    methodology: {
      neural_networks: `${FEATURE_WEIGHTS.dual_ai_models * 100}%`,
      technical_features: `${FEATURE_WEIGHTS.technical_features * 100}%`,
      sentiment_analysis: `${FEATURE_WEIGHTS.sentiment_analysis * 100}%`
    }
  };

  let totalConfidence = 0;
  let successfulAnalyses = 0;
  let totalFeatureCoverage = 0;

  for (const symbol of symbols) {
    try {
      console.log(`📊 Analyzing ${symbol} with enhanced features (SEQUENTIAL EXECUTION - Rate Limit Safe)...`);

      // **SEQUENTIAL EXECUTION** - Avoid ModelScope rate limiting by running components sequentially
      console.log(`🔄 Starting sequential analysis for ${symbol}: Sentiment → Neural → Technical (Rate Limit Safe)`);

      // 1. Sentiment analysis first (most critical, rate-limited API)
      console.log(`💭 Step 1/3: Starting sentiment analysis for ${symbol}...`);
      let sentimentData: SentimentData;
      try {
        sentimentData = await getStockSentiment(symbol, env);
        console.log(`✅ Sentiment analysis complete for ${symbol}:`, sentimentData.sentiment_score);
      } catch (error: any) {
        console.error(`❌ Sentiment analysis failed for ${symbol}:`, (error instanceof Error ? error.message : String(error)));
        sentimentData = {
          sentiment_score: 0,
          confidence: 0.1,
          reasoning: 'Sentiment failed',
          error: error.message
        };
      }

      // 2. Neural network analysis (independent, can run after sentiment)
      console.log(`🧠 Step 2/3: Starting neural analysis for ${symbol}...`);
      let neuralAnalysis: NeuralSignal | null;
      try {
        const analysis = await runEnhancedAnalysis(env, { symbols: [symbol] });
        neuralAnalysis = (analysis as any).trading_signals?.[symbol];
        console.log(`✅ Neural analysis complete for ${symbol}`);
      } catch (error: any) {
        console.error(`❌ Neural analysis failed for ${symbol}:`, (error instanceof Error ? error.message : String(error)));
        neuralAnalysis = null;
      }

      // 3. Technical indicators (independent, runs last)
      console.log(`📈 Step 3/3: Starting market data fetch for ${symbol}...`);
      let extendedData: OHLCData[] | null;
      try {
        extendedData = await fetchExtendedMarketData(symbol, env);
        console.log(`✅ Market data fetched for ${symbol}:`, extendedData ? `${extendedData.length} points` : 'null');
      } catch (error: any) {
        console.error(`❌ Market data failed for ${symbol}:`, (error instanceof Error ? error.message : String(error)));
        extendedData = null;
      }

      console.log(`✅ Sequential analysis complete for ${symbol}`);

      // Calculate technical features from market data
      const technicalFeatures = extendedData ? createTechnicalFeatures(extendedData) : null;
      console.log(`🔧 Technical features for ${symbol}:`, technicalFeatures ? 'calculated' : 'null');

      // 5. Create enhanced prediction using all parallel results
      const enhancedSignal = await createEnhancedPrediction(
        neuralAnalysis,  // Note: changed from neuralSignal to neuralAnalysis
        technicalFeatures,
        sentimentData,
        symbol
      );

      results.trading_signals[symbol] = enhancedSignal;
      totalConfidence += enhancedSignal.confidence;
      successfulAnalyses++;

      if (technicalFeatures) {
        totalFeatureCoverage += calculateFeatureCoverage(technicalFeatures);
      }

    } catch (error: any) {
      console.error(`❌ Error in sequential analysis for ${symbol}:`, (error instanceof Error ? error.message : String(error)));

      // Fallback to basic neural network analysis only
      try {
        const fallbackAnalysis = await runEnhancedAnalysis(env, { symbols: [symbol] });
        (results as any).trading_signals[symbol] = {
          ...(fallbackAnalysis as any).trading_signals?.[symbol],
          feature_status: 'fallback_to_neural_only',
          components: {
            neural_networks: (fallbackAnalysis as any).trading_signals?.[symbol] ? {
              predicted_price: (fallbackAnalysis as any).trading_signals?.[symbol]?.predicted_price,
              direction: (fallbackAnalysis as any).trading_signals?.[symbol]?.direction,
              confidence: (fallbackAnalysis as any).trading_signals?.[symbol]?.confidence,
              weight: FEATURE_WEIGHTS.dual_ai_models
            } : null,
            technical_features: null,
            sentiment_analysis: {
              sentiment_score: 0,
              confidence: 0.1,
              reasoning: 'Parallel execution failed',
              weight: FEATURE_WEIGHTS.sentiment_analysis
            }
          },
          error: error.message
        };
      } catch (fallbackError: any) {
        results.trading_signals[symbol] = {
          symbol: symbol,
          error: `Parallel analysis failed: ${error.message}, Fallback failed: ${fallbackError.message}`,
          status: 'complete_failure'
        };
      }
    }
  }

  // Calculate system performance
  results.system_performance.avg_confidence = successfulAnalyses > 0 ?
    totalConfidence / successfulAnalyses : 0;
  results.system_performance.feature_coverage = successfulAnalyses > 0 ?
    totalFeatureCoverage / successfulAnalyses : 0;
  results.system_performance.success_rate = (successfulAnalyses / symbols.length) * 100;

  console.log(`✅ Enhanced Feature Analysis Complete: ${successfulAnalyses}/${symbols.length} symbols`);
  return results;
}

/**
 * Fetch extended market data for technical indicators using Financial Modeling Prep API
 */
async function fetchExtendedMarketData(
  symbol: string,
  env: CloudflareEnvironment
): Promise<OHLCData[] | null> {
  try {
    // Try FMP API first (we have API key configured)
    if (env.FMP_API_KEY) {
      console.log(`📈 Fetching 3mo data for ${symbol} using FMP API...`);
      const fmpUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?from=${getDateXMonthsAgo(3)}&to=${getCurrentDate()}&apikey=${env.FMP_API_KEY}`;
      const response = await fetch(fmpUrl);
      const data = await response.json() as { historical?: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }> };

      if (data.historical && data.historical.length > 0) {
        const ohlcData: OHLCData[] = data.historical.reverse().map(day => ({
          timestamp: new Date(day.date).getTime() / 1000,
          open: day.open,
          high: day.high,
          low: day.low,
          close: day.close,
          volume: day.volume
        }));

        console.log(`📈 FMP: Fetched ${ohlcData.length} data points for ${symbol}`);
        return ohlcData;
      }
    }

    // Fallback to Yahoo Finance (with retry logic for rate limits)
    console.log(`📈 Fallback: Fetching ${symbol} using Yahoo Finance...`);
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;

    // Add small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as any;

    if (!data.chart?.result?.[0]) {
      throw new Error(`No Yahoo Finance data for ${symbol}`);
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];

    const ohlcData: OHLCData[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] && quote.high[i] && quote.low[i] && quote.close[i] && quote.volume[i]) {
        ohlcData.push({
          timestamp: timestamps[i],
          open: quote.open[i],
          high: quote.high[i],
          low: quote.low[i],
          close: quote.close[i],
          volume: quote.volume[i]
        });
      }
    }

    console.log(`📈 Yahoo: Fetched ${ohlcData.length} data points for ${symbol}`);
    return ohlcData;

  } catch (error: any) {
    console.error(`❌ Error fetching extended data for ${symbol}:`, (error instanceof Error ? error.message : String(error)));
    return null;
  }
}

/**
 * Helper functions for date calculations
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getDateXMonthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}

/**
 * Get sentiment analysis for stock
 */
async function getStockSentiment(symbol: string, env: CloudflareEnvironment): Promise<SentimentData> {
  try {
    const newsData = await getFreeStockNews(symbol, env);

    if (env.MODELSCOPE_API_KEY && newsData.length > 0) {
      return await getModelScopeAISentiment(symbol, newsData, env) as any;
    } else {
      // Fallback to rule-based sentiment from news text
      const newsText = newsData.slice(0, 3).map(article => `${article.title}: ${article.summary}`).join(' ');
      return analyzeTextSentiment(newsText);
    }
  } catch (error: any) {
    console.error(`❌ Error getting sentiment for ${symbol}:`, (error instanceof Error ? error.message : String(error)));
    return {
      sentiment_score: 0,
      confidence: 0.1,
      reasoning: 'Sentiment analysis failed',
      error: error.message
    };
  }
}

/**
 * Get ModelScope AI sentiment (placeholder - would need implementation)
 */
async function getModelScopeAISentiment(
  symbol: string,
  newsData: any[],
  env: CloudflareEnvironment
): Promise<SentimentData> {
  // This would implement ModelScope AI sentiment analysis
  // For now, fallback to basic sentiment
  const newsText = newsData.slice(0, 3).map(article => `${article.title}: ${article.summary}`).join(' ');
  return analyzeTextSentiment(newsText);
}

/**
 * Create enhanced prediction combining all analysis types
 */
async function createEnhancedPrediction(
  neuralSignal: NeuralSignal | null,
  technicalFeatures: TechnicalFeatures | null,
  sentimentData: SentimentData,
  symbol: string
): Promise<EnhancedSignal> {
  const enhancedSignal: EnhancedSignal = {
    symbol: symbol,
    timestamp: new Date().toISOString(),
    current_price: neuralSignal?.current_price || 0,
    model: 'enhanced_feature_prediction',
    predicted_price: 0, // Will be calculated
    direction: 'NEUTRAL', // Will be calculated
    confidence: 0, // Will be calculated

    // Component predictions
    components: {
      neural_networks: neuralSignal ? {
        predicted_price: neuralSignal.predicted_price,
        direction: neuralSignal.direction,
        confidence: neuralSignal.confidence,
        weight: FEATURE_WEIGHTS.dual_ai_models
      } : null,
      technical_features: null,
      sentiment_analysis: {
        sentiment_score: sentimentData.sentiment_score,
        confidence: sentimentData.confidence,
        reasoning: sentimentData.reasoning,
        weight: FEATURE_WEIGHTS.sentiment_analysis
      }
    }
  };

  // Technical feature analysis
  if (technicalFeatures && neuralSignal) {
    const technicalPrediction = analyzeTechnicalFeatures(technicalFeatures as any, neuralSignal.current_price);
    enhancedSignal.components.technical_features = {
      ...technicalPrediction,
      weight: FEATURE_WEIGHTS.technical_features,
      feature_count: Object.keys(technicalFeatures).length
    };
  }

  // Combine all predictions
  const combinedPrediction = combineEnhancedPredictions(
    enhancedSignal.components,
    neuralSignal?.current_price || 0
  );

  // Add combined results
  enhancedSignal.predicted_price = combinedPrediction.predicted_price;
  enhancedSignal.direction = combinedPrediction.direction;
  enhancedSignal.confidence = combinedPrediction.confidence;
  enhancedSignal.model = 'Enhanced-Neural-Technical-Sentiment';

  // Technical feature summary
  if (technicalFeatures) {
    enhancedSignal.technical_summary = createTechnicalSummary(technicalFeatures);
  }

  return enhancedSignal;
}

/**
 * Analyze technical features using local model insights
 */
function analyzeTechnicalFeatures(
  features: TechnicalFeatures,
  currentPrice: number
): TechnicalPrediction {
  const normalizedFeatures = normalizeTechnicalFeatures(features);

  // Feature-based signals (based on local XGBoost insights)
  let technicalScore = 0;
  let signalStrength = 0;
  const reasoningFactors: string[] = [];

  // RSI Analysis
  if (features.rsi_14 !== null) {
    if (features.rsi_14 > 70) {
      technicalScore -= 0.3; // Overbought
      reasoningFactors.push(`RSI overbought (${features.rsi_14.toFixed(1)})`);
    } else if (features.rsi_14 < 30) {
      technicalScore += 0.3; // Oversold
      reasoningFactors.push(`RSI oversold (${features.rsi_14.toFixed(1)})`);
    }
    signalStrength += 0.15;
  }

  // Bollinger Band Position
  if (features.bb_position !== null) {
    if (features.bb_position > 0.8) {
      technicalScore -= 0.2; // Near upper band
      reasoningFactors.push('Near Bollinger upper band');
    } else if (features.bb_position < 0.2) {
      technicalScore += 0.2; // Near lower band
      reasoningFactors.push('Near Bollinger lower band');
    }
    signalStrength += 0.12;
  }

  // MACD Analysis
  if (features.macd !== null && features.macd_signal !== null) {
    const macdBullish = features.macd > features.macd_signal;
    if (macdBullish && features.macd_histogram > 0) {
      technicalScore += 0.2;
      reasoningFactors.push('MACD bullish crossover');
    } else if (!macdBullish && features.macd_histogram < 0) {
      technicalScore -= 0.2;
      reasoningFactors.push('MACD bearish crossover');
    }
    signalStrength += 0.10;
  }

  // Price vs Moving Averages
  if (features.price_vs_sma20 !== null) {
    if (features.price_vs_sma20 > 0.05) {
      technicalScore += 0.15; // Strong above SMA20
      reasoningFactors.push('Strong above SMA20');
    } else if (features.price_vs_sma20 < -0.05) {
      technicalScore -= 0.15; // Strong below SMA20
      reasoningFactors.push('Strong below SMA20');
    }
    signalStrength += 0.06;
  }

  // Volume Analysis
  if (features.volume_ratio !== null && features.volume_ratio > 1.5) {
    technicalScore += 0.1; // High volume confirmation
    reasoningFactors.push(`High volume (${features.volume_ratio.toFixed(1)}x avg)`);
    signalStrength += 0.07;
  }

  // Determine direction and confidence
  let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
  if (technicalScore > 0.1) direction = 'UP';
  else if (technicalScore < -0.1) direction = 'DOWN';

  const confidence = Math.min(0.95, Math.max(0.1, signalStrength));
  const priceChange = technicalScore * 0.01; // Max 1% price movement prediction
  const predictedPrice = currentPrice * (1 + priceChange);

  return {
    predicted_price: predictedPrice,
    direction: direction,
    confidence: confidence,
    technical_score: technicalScore,
    reasoning: reasoningFactors.join(', ') || 'Neutral technical indicators',
    signal_strength: signalStrength
  };
}

/**
 * Combine enhanced predictions from all sources
 */
function combineEnhancedPredictions(
  components: Components,
  currentPrice: number
): CombinedPrediction {
  let weightedPrediction = 0;
  let totalWeight = 0;
  let totalConfidence = 0;
  const directionalVotes: ConsensusVotes = { UP: 0, DOWN: 0, NEUTRAL: 0 };

  // Neural networks component
  if (components.neural_networks) {
    const neuralChange = (components.neural_networks.predicted_price - currentPrice) / currentPrice;
    weightedPrediction += neuralChange * components.neural_networks.weight;
    totalWeight += components.neural_networks.weight;
    totalConfidence += components.neural_networks.confidence * components.neural_networks.weight;
    directionalVotes[components.neural_networks.direction] += components.neural_networks.weight;
  }

  // Technical features component
  if (components.technical_features) {
    const techChange = (components.technical_features.predicted_price - currentPrice) / currentPrice;
    weightedPrediction += techChange * components.technical_features.weight;
    totalWeight += components.technical_features.weight;
    totalConfidence += components.technical_features.confidence * components.technical_features.weight;
    directionalVotes[components.technical_features.direction] += components.technical_features.weight;
  }

  // Sentiment component
  if (components.sentiment_analysis && components.sentiment_analysis.sentiment_score !== undefined) {
    const sentimentChange = components.sentiment_analysis.sentiment_score * 0.02; // Max 2% from sentiment
    weightedPrediction += sentimentChange * components.sentiment_analysis.weight;
    totalWeight += components.sentiment_analysis.weight;
    totalConfidence += components.sentiment_analysis.confidence * components.sentiment_analysis.weight;

    // Convert sentiment to direction vote
    if (components.sentiment_analysis.sentiment_score > 0.1) {
      directionalVotes.UP += components.sentiment_analysis.weight;
    } else if (components.sentiment_analysis.sentiment_score < -0.1) {
      directionalVotes.DOWN += components.sentiment_analysis.weight;
    } else {
      directionalVotes.NEUTRAL += components.sentiment_analysis.weight;
    }
  }

  // Calculate final prediction
  const finalPredictedPrice = currentPrice * (1 + weightedPrediction);
  const finalConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;

  // Determine direction by vote
  const finalDirection: 'UP' | 'DOWN' | 'NEUTRAL' = Object.keys(directionalVotes).reduce((a: any, b: any) =>
    directionalVotes[a as keyof ConsensusVotes] > directionalVotes[b as keyof ConsensusVotes] ? a : b
  ) as 'UP' | 'DOWN' | 'NEUTRAL';

  return {
    predicted_price: finalPredictedPrice,
    direction: finalDirection,
    confidence: finalConfidence,
    consensus_votes: directionalVotes
  };
}

/**
 * Create technical summary for display
 */
function createTechnicalSummary(features: TechnicalFeatures): string {
  const summary: string[] = [];

  if (features.rsi_14 !== null) {
    summary.push(`RSI: ${features.rsi_14.toFixed(1)}`);
  }

  if (features.bb_position !== null) {
    const position = features.bb_position > 0.8 ? 'Upper' :
                    features.bb_position < 0.2 ? 'Lower' : 'Middle';
    summary.push(`BB: ${position}`);
  }

  if (features.macd !== null && features.macd_signal !== null) {
    const trend = features.macd > features.macd_signal ? 'Bullish' : 'Bearish';
    summary.push(`MACD: ${trend}`);
  }

  if (features.volume_ratio !== null) {
    summary.push(`Vol: ${features.volume_ratio.toFixed(1)}x`);
  }

  return summary.join(' | ');
}

/**
 * Calculate feature coverage (how many features have valid values)
 */
function calculateFeatureCoverage(features: TechnicalFeatures): number {
  const totalFeatures = Object.keys(features).length;
  const validFeatures = Object.values(features).filter(val => val !== null && val !== undefined).length;
  return (validFeatures / totalFeatures) * 100;
}

// Export types for external use
export type {
  FeatureWeights,
  FeatureImportance,
  SentimentData,
  NeuralSignal,
  TechnicalFeatures,
  TechnicalPrediction,
  NeuralComponent,
  TechnicalComponent,
  SentimentComponent,
  Components,
  EnhancedSignal,
  SystemPerformance,
  Methodology,
  EnhancedFeatureAnalysisResult,
  OHLCData,
  ConsensusVotes,
  CombinedPrediction
};

export default {
  runEnhancedFeatureAnalysis,
  FEATURE_WEIGHTS,
  FEATURE_IMPORTANCE
};