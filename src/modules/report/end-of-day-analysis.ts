/**
 * End-of-Day Analysis Module
 * Market close analysis with high-confidence signal performance review and tomorrow's outlook
 */

import { createLogger } from '../logging.js';
import { rateLimitedFetch } from '../rate-limiter.js';
import { extractDualModelData } from '../data.js';
import type { CloudflareEnvironment } from '../../types.js';

// Type definitions
interface TradingSignal {
  sentiment_layers?: Array<{
    sentiment: string;
    confidence: number;
    reasoning: string;
    model?: string;
  }>;
  overall_confidence?: number;
  primary_direction?: string;
  dual_model?: any;
}

interface AnalysisSignal {
  symbol?: string;
  trading_signals?: TradingSignal;
  sentiment_layers?: Array<{
    sentiment: string;
    confidence: number;
    reasoning: string;
    model?: string;
  }>;
  dual_model?: any;
  models?: {
    gpt?: { direction?: string; confidence?: number; error?: string };
    distilbert?: { direction?: string; confidence?: number; error?: string };
  };
  comparison?: { agree?: boolean; agreement_type?: string; match_details?: any };
  signal?: { direction?: string; confidence?: number };
}

interface AnalysisData {
  symbols_analyzed: string[];
  trading_signals: Record<string, AnalysisSignal>;
}

interface MarketClosePerformance {
  symbol: string;
  closePrice: number | null;
  dayChange: number | null;
  volume: number | null;
  previousClose?: number | null;
  timestamp?: number;
  dataAge?: number;
  error?: string;
  dataSource?: string;
}

interface MarketCloseData {
  [symbol: string]: MarketClosePerformance;
}

interface SignalBreakdown {
  ticker: string;
  predicted: string;
  predictedDirection: string;
  actual: string;
  actualDirection: string;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  correct: boolean;
}

interface TopPerformer {
  ticker: string;
  performance: string;
}

interface SignalPerformance {
  overallAccuracy: number;
  totalSignals: number;
  correctCalls: number;
  wrongCalls: number;
  modelGrade: string;
  topWinners: TopPerformer[];
  topLosers: TopPerformer[];
  signalBreakdown: SignalBreakdown[];
  modelStats?: {
    gemma: { accuracy: number; correct: number; total: number } | null;
    distilbert: { accuracy: number; correct: number; total: number } | null;
    agreementRate: number | null;
  };
}

interface TomorrowOutlook {
  marketBias: string;
  volatilityLevel: string;
  confidenceLevel: string;
  keyFocus: string;
}

interface MarketInsights {
  modelPerformance: string;
  sectorAnalysis: string;
  volatilityPatterns: string;
  signalQuality: string;
}

interface EndOfDayResult extends SignalPerformance {
  tomorrowOutlook: TomorrowOutlook;
  insights: MarketInsights;
  marketCloseTime: string;
}

interface MorningPredictions {
  [symbol: string]: any;
}

interface IntradayData {
  [symbol: string]: any;
}

const logger = createLogger('end-of-day-analysis');

/**
 * Write end-of-day dual model results to symbol_predictions for queryability
 */
async function writeEndOfDayToD1(
  env: CloudflareEnvironment,
  date: string,
  analysisData: AnalysisData | null
): Promise<void> {
  if (!env.PREDICT_JOBS_DB || !analysisData || !analysisData.trading_signals) return;

  try {
    let actualUpdates = 0;
    const symbols = Object.keys(analysisData.trading_signals);

    for (const symbol of symbols) {
      const signal = analysisData.trading_signals[symbol];
      const dualModelData = extractDualModelData(signal);

      // Update existing prediction with end-of-day status (if dual model data present)
      if (Object.keys(dualModelData).length > 0) {
        await env.PREDICT_JOBS_DB.prepare(`
          UPDATE symbol_predictions SET
            gemma_status = COALESCE(?, gemma_status),
            gemma_error = COALESCE(?, gemma_error),
            gemma_confidence = COALESCE(?, gemma_confidence),
            gemma_response_time_ms = COALESCE(?, gemma_response_time_ms),
            distilbert_status = COALESCE(?, distilbert_status),
            distilbert_error = COALESCE(?, distilbert_error),
            distilbert_confidence = COALESCE(?, distilbert_confidence),
            distilbert_response_time_ms = COALESCE(?, distilbert_response_time_ms),
            model_selection_reason = COALESCE(?, model_selection_reason)
          WHERE symbol = ? AND prediction_date = ?
        `).bind(
          dualModelData.gemma_status || null,
          dualModelData.gemma_error || null,
          dualModelData.gemma_confidence ?? null,
          dualModelData.gemma_response_time_ms ?? null,
          dualModelData.distilbert_status || null,
          dualModelData.distilbert_error || null,
          dualModelData.distilbert_confidence ?? null,
          dualModelData.distilbert_response_time_ms ?? null,
          dualModelData.model_selection_reason || null,
          symbol,
          date
        ).run();
        actualUpdates++;
      }
    }

    logger.info('End-of-Day Analysis: Wrote dual model data to D1', { count: actualUpdates, total: symbols.length });
  } catch (error: unknown) {
    logger.warn('End-of-Day Analysis: Failed to write dual model data to D1', { error });
  }
}

/**
 * Generate comprehensive end-of-day analysis
 */
export async function generateEndOfDayAnalysis(
  analysisData: AnalysisData | null,
  morningPredictions: MorningPredictions | null,
  intradayData: IntradayData | null,
  env: CloudflareEnvironment
): Promise<EndOfDayResult> {
  logger.info('Generating end-of-day market close analysis');

  try {
    const today = new Date().toISOString().split('T')[0];

    // Get final market close data
    const marketCloseData = await getMarketClosePerformance(analysisData?.symbols_analyzed || [], env);

    // Analyze high-confidence signal performance
    const signalPerformance = analyzeHighConfidenceSignals(
      analysisData,
      morningPredictions,
      marketCloseData
    );

    // Generate tomorrow's outlook
    const tomorrowOutlook = generateTomorrowOutlook(analysisData, signalPerformance);

    // Persist per-symbol dual model results
    await writeEndOfDayToD1(env, today, analysisData);

    // Compile comprehensive end-of-day data
    const endOfDayResults: EndOfDayResult = {
      ...signalPerformance,
      tomorrowOutlook,
      insights: generateMarketInsights(signalPerformance, marketCloseData),
      marketCloseTime: new Date().toISOString()
    };

    return endOfDayResults;

  } catch (error: any) {
    logger.error('Error generating end-of-day analysis', { error: (error instanceof Error ? error.message : String(error)) });
    throw error;
  }
}

/**
 * Analyze performance of high-confidence signals at market close
 * Supports both legacy sentiment_layers format and dual-model format (models.gpt/distilbert)
 */
function analyzeHighConfidenceSignals(
  analysisData: AnalysisData | null,
  morningPredictions: MorningPredictions | null,
  marketCloseData: MarketCloseData
): SignalPerformance {
  const signals = analysisData?.trading_signals || {};
  const CONFIDENCE_THRESHOLD = 0.70;

  let totalSignals = 0;
  let correctCalls = 0;
  let wrongCalls = 0;
  const signalBreakdown: SignalBreakdown[] = [];
  const topWinners: TopPerformer[] = [];
  const topLosers: TopPerformer[] = [];
  
  // Dual-model tracking
  let gemmaCorrect = 0, gemmaTotal = 0;
  let distilbertCorrect = 0, distilbertTotal = 0;
  let agreementCount = 0;

  function normalizeDirection(direction: unknown): 'up' | 'down' | 'neutral' {
    const dir = (typeof direction === 'string' ? direction : '').toLowerCase();
    if (dir === 'bullish' || dir === 'up' || dir === 'positive') return 'up';
    if (dir === 'bearish' || dir === 'down' || dir === 'negative') return 'down';
    return 'neutral';
  }

  function pickConfidence0to1(signal: AnalysisSignal, tradingSignals: any, sentimentLayer: any): number {
    const winner = signal.comparison?.match_details?.winner_confidence;
    if (typeof winner === 'number' && winner >= 0 && winner <= 1) return winner;

    const gpt = signal.models?.gpt?.confidence;
    const distilbert = signal.models?.distilbert?.confidence;
    const candidateMax = Math.max(
      typeof gpt === 'number' ? gpt : 0,
      typeof distilbert === 'number' ? distilbert : 0,
    );
    if (candidateMax > 0 && candidateMax <= 1) return candidateMax;

    const legacy = sentimentLayer?.confidence ?? tradingSignals?.overall_confidence ?? 0;
    return (typeof legacy === 'number' && legacy >= 0 && legacy <= 1) ? legacy : 0;
  }

  // Process ALL symbols in breakdown, gate accuracy metrics by confidence threshold
  Object.keys(signals).forEach(symbol => {
    const signal = signals[symbol];
    const tradingSignals = signal.trading_signals || signal;
    const sentimentLayer = signal.sentiment_layers?.[0];

    // Check for dual-model format (gpt = Gemma Sea Lion, distilbert = DistilBERT-SST-2)
    const isDualModel = signal.models?.gpt || signal.models?.distilbert || signal.comparison;
    const gemma = signal.models?.gpt;
    const distilbert = signal.models?.distilbert;
    const comparison = signal.comparison;

    // Extract direction and confidence - prefer dual-model if available
    const combinedDirection = isDualModel && signal.signal
      ? signal.signal.direction
      : (tradingSignals as any)?.primary_direction;

    const predictedDirection = normalizeDirection(combinedDirection);
    const confidence0to1 = pickConfidence0to1(signal, tradingSignals, sentimentLayer);
    const confidence = confidence0to1 * 100;

    // Track ALL symbols regardless of confidence
    totalSignals++;

    // Track dual-model agreement
    if (isDualModel && comparison) {
      if (comparison.agree) agreementCount++;
    }

    // Determine if this is a high-confidence signal (for accuracy metrics)
    const isHighConfidence = confidence0to1 >= CONFIDENCE_THRESHOLD;

    // Get market close performance
    const closePerformance = marketCloseData[symbol];
    if (closePerformance && closePerformance.dayChange !== null) {
      const actualDirection = closePerformance.dayChange > 0 ? 'up' : 'down';
      const isCorrect = predictedDirection !== 'neutral' && predictedDirection === actualDirection;

      // Only count accuracy for high-confidence signals
      if (isHighConfidence && predictedDirection !== 'neutral') {
        if (isCorrect) correctCalls++;
        else wrongCalls++;
      }

      // Track per-model accuracy if dual-model (only high-confidence)
      if (isHighConfidence) {
        if (gemma?.direction) {
          const gemmaDir = normalizeDirection(gemma.direction);
          if (gemmaDir !== 'neutral') {
            gemmaTotal++;
            if (gemmaDir === actualDirection) gemmaCorrect++;
          }
        }
        if (distilbert?.direction) {
          const distilbertDir = normalizeDirection(distilbert.direction);
          if (distilbertDir !== 'neutral') {
            distilbertTotal++;
            if (distilbertDir === actualDirection) distilbertCorrect++;
          }
        }
      }

      // Add ALL symbols to signal breakdown
      signalBreakdown.push({
        ticker: symbol,
        predicted: `${predictedDirection === 'up' ? '↑' : predictedDirection === 'down' ? '↓' : '→'} Expected`,
        predictedDirection,
        actual: `${actualDirection === 'up' ? '↑' : '↓'} ${Math.abs(closePerformance.dayChange).toFixed(1)}%`,
        actualDirection,
        confidence: Math.round(confidence),
        confidenceLevel: confidence > 80 ? 'high' : confidence > 60 ? 'medium' : 'low',
        correct: isCorrect,
        ...(isDualModel && {
          gemma_direction: gemma?.direction,
          distilbert_direction: distilbert?.direction,
          models_agree: comparison?.agree
        })
      });

      // Track top performers
      if (closePerformance.dayChange > 1) {
        topWinners.push({
          ticker: symbol,
          performance: `+${closePerformance.dayChange.toFixed(1)}%`
        });
      } else if (closePerformance.dayChange < -1) {
        topLosers.push({
          ticker: symbol,
          performance: `${closePerformance.dayChange.toFixed(1)}%`
        });
      }
    } else {
      // No market data - add as pending
      signalBreakdown.push({
        ticker: symbol,
        predicted: `${predictedDirection === 'up' ? '↑' : predictedDirection === 'down' ? '↓' : '→'} Expected`,
        predictedDirection,
        actual: 'Pending',
        actualDirection: 'pending',
        confidence: Math.round(confidence),
        confidenceLevel: confidence > 80 ? 'high' : confidence > 60 ? 'medium' : 'low',
        correct: false,
        ...(isDualModel && {
          gemma_direction: gemma?.direction,
          distilbert_direction: distilbert?.direction,
          models_agree: comparison?.agree
        })
      });
    }
  });

  // Sort top performers
  topWinners.sort((a: any, b: any) => parseFloat(b.performance) - parseFloat(a.performance));
  topLosers.sort((a: any, b: any) => parseFloat(a.performance) - parseFloat(b.performance));

  // Calculate overall accuracy
  const evaluatedSignals = correctCalls + wrongCalls;
  const overallAccuracy = evaluatedSignals > 0
    ? Math.round((correctCalls / evaluatedSignals) * 100)
    : 0;

  // Determine model grade
  const modelGrade = getModelGrade(overallAccuracy);

  return {
    overallAccuracy,
    totalSignals,
    correctCalls,
    wrongCalls,
    modelGrade,
    topWinners: topWinners.slice(0, 3),
    topLosers: topLosers.slice(0, 3),
    signalBreakdown,
    // Dual-model performance stats
    modelStats: {
      gemma: gemmaTotal > 0 ? { accuracy: gemmaCorrect / gemmaTotal, correct: gemmaCorrect, total: gemmaTotal } : null,
      distilbert: distilbertTotal > 0 ? { accuracy: distilbertCorrect / distilbertTotal, correct: distilbertCorrect, total: distilbertTotal } : null,
      agreementRate: totalSignals > 0 ? agreementCount / totalSignals : null
    }
  };
}

/**
 * Generate tomorrow's market outlook based on current analysis
 */
function generateTomorrowOutlook(
  analysisData: AnalysisData | null,
  signalPerformance: SignalPerformance
): TomorrowOutlook {
  const signals = analysisData?.trading_signals || {};
  const symbolCount = Object.keys(signals).length;

  function normalizeSentiment(value: unknown): 'bullish' | 'bearish' | 'neutral' {
    const s = (typeof value === 'string' ? value : '').toLowerCase();
    if (s === 'bullish' || s === 'up' || s === 'positive') return 'bullish';
    if (s === 'bearish' || s === 'down' || s === 'negative') return 'bearish';
    return 'neutral';
  }

  // Analyze sentiment distribution for tomorrow
  let bullishSignals = 0;
  let bearishSignals = 0;

  Object.values(signals).forEach(signal => {
    const sentimentLayer = signal.sentiment_layers?.[0];
    const sentiment =
      sentimentLayer?.sentiment ??
      signal.signal?.direction ??
      signal.trading_signals?.primary_direction ??
      'neutral';
    const normalized = normalizeSentiment(sentiment);

    if (normalized === 'bullish') bullishSignals++;
    if (normalized === 'bearish') bearishSignals++;
  });

  // Determine market bias for tomorrow
  const marketBias = bullishSignals > bearishSignals ? 'Bullish' :
                    bearishSignals > bullishSignals ? 'Bearish' : 'Neutral';

  // Determine volatility expectation
  const evaluatedSignals = signalPerformance.correctCalls + signalPerformance.wrongCalls;
  const volatilityLevel = evaluatedSignals === 0 ? 'Unknown' :
                         signalPerformance.overallAccuracy < 60 ? 'High' :
                         signalPerformance.overallAccuracy > 75 ? 'Low' : 'Moderate';

  // Determine model confidence for tomorrow
  const confidenceLevel = evaluatedSignals === 0 ? 'Low' :
                         signalPerformance.overallAccuracy > 70 ? 'High' :
                         signalPerformance.overallAccuracy > 50 ? 'Medium' : 'Low';

  // Identify key focus area
  const keyFocus = identifyTomorrowFocus(signals, signalPerformance);

  return {
    marketBias,
    volatilityLevel,
    confidenceLevel,
    keyFocus
  };
}

/**
 * Generate market insights based on actual performance data
 */
function generateMarketInsights(
  signalPerformance: SignalPerformance,
  marketCloseData: MarketCloseData
): MarketInsights {
  const { overallAccuracy, totalSignals, correctCalls, wrongCalls, modelStats } = signalPerformance;

  // Calculate actual volatility from market data
  const dayChanges = Object.values(marketCloseData)
    .filter(d => d.dayChange !== null)
    .map(d => Math.abs(d.dayChange!));
  const avgVolatility = dayChanges.length > 0
    ? dayChanges.reduce((a, b) => a + b, 0) / dayChanges.length
    : 0;

  // Determine performance description based on actual accuracy
  let performanceDesc: string;
  if (overallAccuracy >= 75) {
    performanceDesc = `Strong ${overallAccuracy}% accuracy on high-confidence signals.`;
  } else if (overallAccuracy >= 60) {
    performanceDesc = `Moderate ${overallAccuracy}% accuracy - ${correctCalls} correct, ${wrongCalls} incorrect.`;
  } else if (overallAccuracy > 0) {
    performanceDesc = `Below target ${overallAccuracy}% accuracy - reviewing signal quality.`;
  } else {
    performanceDesc = `No high-confidence signals to evaluate (${totalSignals} total signals tracked).`;
  }

  // Generate sector analysis from actual winners/losers
  const winners = signalPerformance.topWinners.map(w => w.ticker).join(', ') || 'none';
  const losers = signalPerformance.topLosers.map(l => l.ticker).join(', ') || 'none';
  const sectorDesc = `Top performers: ${winners}. Laggards: ${losers}.`;

  // Volatility insight from real data
  let volatilityDesc: string;
  if (avgVolatility > 2) {
    volatilityDesc = `High volatility day (avg ${avgVolatility.toFixed(1)}% moves).`;
  } else if (avgVolatility > 1) {
    volatilityDesc = `Moderate volatility (avg ${avgVolatility.toFixed(1)}% moves).`;
  } else if (avgVolatility > 0) {
    volatilityDesc = `Low volatility day (avg ${avgVolatility.toFixed(1)}% moves).`;
  } else {
    volatilityDesc = 'Market data pending for volatility analysis.';
  }

  // Signal quality from model agreement
  let signalQualityDesc: string;
  if (modelStats?.agreementRate !== null && modelStats?.agreementRate !== undefined) {
    const agreePct = (modelStats.agreementRate * 100).toFixed(0);
    signalQualityDesc = `Model agreement rate: ${agreePct}%. ${correctCalls + wrongCalls} high-confidence signals evaluated.`;
  } else {
    signalQualityDesc = `${totalSignals} signals tracked across all confidence levels.`;
  }

  return {
    modelPerformance: performanceDesc,
    sectorAnalysis: sectorDesc,
    volatilityPatterns: volatilityDesc,
    signalQuality: signalQualityDesc
  };
}

/**
 * Get real market close performance data from Yahoo Finance API
 */
async function getMarketClosePerformance(
  symbols: string[],
  env: CloudflareEnvironment
): Promise<MarketCloseData> {
  logger.info(`Fetching market close data for ${symbols.length} symbols`);
  const performance: MarketCloseData = {};

  for (const symbol of symbols) {
    try {
      // Get today's market data
      const today = new Date().toISOString().split('T')[0];
      const endDate = Math.floor(Date.now() / 1000);
      const startDate = endDate - (2 * 24 * 60 * 60); // Last 2 days to get today + yesterday

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;

      const response = await rateLimitedFetch(url, {
        signal: AbortSignal.timeout(8000) // 8 second timeout
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance API returned ${response.status}`);
      }

      const data = await response.json();
      const result = (data as any).chart.result[0];

      if (!result || !result.indicators || !result.timestamp) {
        throw new Error(`Invalid response format for ${symbol}`);
      }

      const quote = result.indicators.quote[0];
      const timestamps = result.timestamp;

      // Get latest available data (today's close or most recent)
      const latestIndex = timestamps.length - 1;
      const previousIndex = Math.max(0, latestIndex - 1);

      const closePrice = quote.close[latestIndex];
      const previousClose = quote.close[previousIndex];
      const volume = quote.volume[latestIndex];

      if (!closePrice || !previousClose || !volume) {
        throw new Error(`Missing price data for ${symbol}`);
      }

      // Calculate day change
      const dayChange = ((closePrice - previousClose) / previousClose) * 100;

      performance[symbol] = {
        symbol,
        closePrice: closePrice,
        dayChange: dayChange,
        volume: volume,
        previousClose: previousClose,
        timestamp: timestamps[latestIndex],
        dataAge: Date.now() / 1000 - timestamps[latestIndex] // Age in seconds
      };

      logger.info(`Market data for ${symbol}: $${closePrice.toFixed(2)} (${dayChange > 0 ? '+' : ''}${dayChange.toFixed(2)}%)`);

    } catch (error: any) {
      logger.warn(`Failed to get market data for ${symbol}: ${(error instanceof Error ? error.message : String(error))}`);

      // Use fallback data with clear indication it's not real
      performance[symbol] = {
        symbol,
        closePrice: null,
        dayChange: null,
        volume: null,
        error: error.message,
        dataSource: 'failed'
      };
    }
  }

  return performance;
}

/**
 * Determine model grade based on accuracy
 */
function getModelGrade(accuracy: number): string {
  if (accuracy >= 80) return 'A';
  if (accuracy >= 75) return 'A-';
  if (accuracy >= 70) return 'B+';
  if (accuracy >= 65) return 'B';
  if (accuracy >= 60) return 'B-';
  if (accuracy >= 55) return 'C+';
  if (accuracy >= 50) return 'C';
  return 'D';
}

/**
 * Identify key focus area for tomorrow based on actual signal data
 */
function identifyTomorrowFocus(signals: Record<string, AnalysisSignal>, performance: SignalPerformance): string {
  const symbolList = Object.keys(signals);

  // Find highest confidence signal
  let highestConfSymbol = '';
  let highestConf = 0;

  symbolList.forEach(symbol => {
    const signal = signals[symbol];
    const conf = signal.models?.gpt?.confidence ||
                 signal.models?.distilbert?.confidence ||
                 signal.sentiment_layers?.[0]?.confidence || 0;
    if (conf > highestConf) {
      highestConf = conf;
      highestConfSymbol = symbol;
    }
  });

  if (highestConfSymbol && highestConf > 0.7) {
    return `${highestConfSymbol} (${(highestConf * 100).toFixed(0)}% confidence)`;
  }

  // Fallback: report on model agreement or disagreement
  const agreementRate = performance.modelStats?.agreementRate;
  if (agreementRate !== null && agreementRate !== undefined) {
    if (agreementRate > 0.7) {
      return 'Strong model consensus signals';
    } else if (agreementRate < 0.3) {
      return 'Mixed signals - caution advised';
    }
  }

  return `${symbolList.length} symbols tracked`;
}

// Export types for external use
export type {
  TradingSignal,
  AnalysisSignal,
  AnalysisData,
  MarketClosePerformance,
  MarketCloseData,
  SignalBreakdown,
  TopPerformer,
  SignalPerformance,
  TomorrowOutlook,
  MarketInsights,
  EndOfDayResult,
  MorningPredictions,
  IntradayData
};
