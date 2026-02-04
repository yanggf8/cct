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
    primary?: { direction?: string; confidence?: number; error?: string; reasoning?: string };
    mate?: { direction?: string; confidence?: number; error?: string; reasoning?: string };
  };
  comparison?: { agree?: boolean; agreement_type?: string; match_details?: any };
  signal?: { direction?: string; confidence?: number; action?: string; reasoning?: string };
  articles_count?: number;
}

interface AnalysisData {
  symbols_analyzed: string[];
  trading_signals: Record<string, AnalysisSignal>;
}

interface MarketClosePerformance {
  symbol: string;
  closePrice: number | null;
  dayChange: number | null;
  previousClose?: number | null;
  volume?: number | null;        // Optional - not required for EOD analysis
  timestamp?: number;
  error?: string;
  dataSource?: string;
  usedFallbackDate?: boolean;    // True if data is from a different date (e.g., market holiday)
  actualDataDate?: string;       // The actual date of the data if different from requested
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
  // Pre-market prediction detail
  primary_direction?: string;
  primary_confidence?: number | null;
  primary_reasoning?: string;
  mate_direction?: string;
  mate_confidence?: number | null;
  mate_reasoning?: string;
  models_agree?: boolean;
  action?: string;
  signal_reasoning?: string;
  articles_count?: number;
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
    primary: { accuracy: number; correct: number; total: number } | null;
    mate: { accuracy: number; correct: number; total: number } | null;
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

interface MarketPulseEOD {
  symbol: string;                // SPY
  predicted: {
    direction: string;          // bullish/bearish/neutral
    confidence: number;         // 0-1
    reasoning?: string;
    dual_model?: {
      primary?: { direction?: string; confidence?: number };
      mate?: { direction?: string; confidence?: number };
    };
    articles_count?: number;
    generated_at?: string;
  } | null;
  actual: {
    dayChange: number;          // percentage
    direction: string;          // up/down
    closePrice: number;
  } | null;
  correct: boolean | null;      // null if no data
}

interface EndOfDayResult extends SignalPerformance {
  tomorrowOutlook: TomorrowOutlook;
  insights: MarketInsights;
  marketCloseTime: string;
  dataWarnings?: string[];       // Warnings about data quality (e.g., holiday fallbacks)
  marketPulse?: MarketPulseEOD;  // SPY market pulse predicted vs actual (separate from portfolio accuracy)
}

interface MorningPredictions {
  [symbol: string]: any;
}

interface IntradayData {
  [symbol: string]: any;
}

const logger = createLogger('end-of-day-analysis');

/**
 * Fetch market pulse prediction from pre-market report and compute EOD result
 * Separate from portfolio accuracy - SPY is a market benchmark
 */
async function getMarketPulseEOD(
  env: CloudflareEnvironment,
  targetDate: string
): Promise<MarketPulseEOD | undefined> {
  const SPY = 'SPY';
  
  try {
    // Step 1: Fetch pre-market market_pulse prediction from D1
    let predicted: MarketPulseEOD['predicted'] = null;
    
    if (env.PREDICT_JOBS_DB) {
      const preMarket = await env.PREDICT_JOBS_DB.prepare(`
        SELECT report_content FROM scheduled_job_results 
        WHERE report_type = 'pre-market' AND scheduled_date = ?
        ORDER BY created_at DESC LIMIT 1
      `).bind(targetDate).first<{ report_content: string }>();
      
      if (preMarket?.report_content) {
        try {
          const content = JSON.parse(preMarket.report_content);
          const pulse = content.market_pulse;
          if (pulse && pulse.status === 'success') {
            predicted = {
              direction: pulse.direction || 'neutral',
              confidence: pulse.confidence || 0,
              reasoning: pulse.reasoning,
              dual_model: pulse.dual_model,
              articles_count: pulse.articles_count,
              generated_at: pulse.generated_at
            };
          }
        } catch (parseError) {
          logger.warn('Failed to parse pre-market content for market_pulse', { error: parseError });
        }
      }
    }
    
    if (!predicted) {
      logger.info('No market pulse prediction found for EOD comparison');
      return undefined;
    }
    
    // Step 2: Fetch SPY actual close using same targetDate (ET-aligned)
    const spyCloseData = await getMarketClosePerformance([SPY], targetDate, env);
    const spyActual = spyCloseData[SPY];
    
    let actual: MarketPulseEOD['actual'] = null;
    let correct: boolean | null = null;
    
    if (spyActual && spyActual.dayChange !== null && spyActual.closePrice !== null) {
      const actualDirection = spyActual.dayChange > 0 ? 'up' : 'down';
      actual = {
        dayChange: spyActual.dayChange,
        direction: actualDirection,
        closePrice: spyActual.closePrice
      };
      
      // Compute correctness (bullish = up, bearish = down)
      const predictedDir = predicted.direction.toLowerCase();
      if (predictedDir === 'bullish' || predictedDir === 'up') {
        correct = actualDirection === 'up';
      } else if (predictedDir === 'bearish' || predictedDir === 'down') {
        correct = actualDirection === 'down';
      } else {
        correct = null; // neutral prediction - no right/wrong
      }
    }
    
    logger.info('Market Pulse EOD computed', {
      predictedDirection: predicted.direction,
      predictedConfidence: predicted.confidence,
      actualDirection: actual?.direction,
      actualChange: actual?.dayChange,
      correct
    });
    
    return {
      symbol: SPY,
      predicted,
      actual,
      correct
    };
    
  } catch (error: any) {
    logger.error('Failed to compute Market Pulse EOD', { error: error.message });
    return undefined;
  }
}

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
            primary_status = COALESCE(?, primary_status),
            primary_error = COALESCE(?, primary_error),
            primary_confidence = COALESCE(?, primary_confidence),
            primary_response_time_ms = COALESCE(?, primary_response_time_ms),
            mate_status = COALESCE(?, mate_status),
            mate_error = COALESCE(?, mate_error),
            mate_confidence = COALESCE(?, mate_confidence),
            mate_response_time_ms = COALESCE(?, mate_response_time_ms),
            model_selection_reason = COALESCE(?, model_selection_reason)
          WHERE symbol = ? AND prediction_date = ?
        `).bind(
          dualModelData.primary_status || null,
          dualModelData.primary_error || null,
          dualModelData.primary_confidence ?? null,
          dualModelData.primary_response_time_ms ?? null,
          dualModelData.mate_status || null,
          dualModelData.mate_error || null,
          dualModelData.mate_confidence ?? null,
          dualModelData.mate_response_time_ms ?? null,
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
 * @param targetDate - The business date (YYYY-MM-DD) in ET timezone. Must be passed from scheduler to avoid UTC/ET mismatch.
 */
export async function generateEndOfDayAnalysis(
  analysisData: AnalysisData | null,
  morningPredictions: MorningPredictions | null,
  intradayData: IntradayData | null,
  env: CloudflareEnvironment,
  targetDate?: string
): Promise<EndOfDayResult> {
  logger.info('Generating end-of-day market close analysis');

  try {
    // Use explicit targetDate from scheduler (ET-aware) to avoid UTC/ET date mismatch
    // EOD runs at 20:05 UTC which could be next day in UTC but same day in ET
    const today = targetDate || new Date().toISOString().split('T')[0];
    if (!targetDate) {
      logger.warn('generateEndOfDayAnalysis called without targetDate - using UTC fallback (may cause date mismatch)');
    }

    // Get final market close data
    // symbols_analyzed is stored as a count (number), not an array — derive symbols from trading_signals keys
    const symbols = Array.isArray(analysisData?.symbols_analyzed)
      ? analysisData.symbols_analyzed
      : Object.keys(analysisData?.trading_signals || {});
    const marketCloseData = await getMarketClosePerformance(symbols, today, env);

    // Collect data warnings (e.g., holiday fallbacks)
    const dataWarnings: string[] = [];
    const fallbackSymbols = Object.values(marketCloseData)
      .filter(d => d.usedFallbackDate)
      .map(d => `${d.symbol} (used ${d.actualDataDate})`);
    
    if (fallbackSymbols.length > 0) {
      dataWarnings.push(`Market data from different dates for: ${fallbackSymbols.join(', ')}. Accuracy calculations may be affected.`);
      logger.warn(`EOD analysis using fallback dates for ${fallbackSymbols.length} symbols - accuracy may be miscalibrated`);
    }

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

    // Fetch Market Pulse (SPY) predicted vs actual - separate from portfolio accuracy
    const marketPulse = await getMarketPulseEOD(env, today);

    // Compile comprehensive end-of-day data
    const endOfDayResults: EndOfDayResult = {
      ...signalPerformance,
      tomorrowOutlook,
      insights: generateMarketInsights(signalPerformance, marketCloseData),
      marketCloseTime: new Date().toISOString(),
      dataWarnings: dataWarnings.length > 0 ? dataWarnings : undefined,
      marketPulse
    };

    return endOfDayResults;

  } catch (error: any) {
    logger.error('Error generating end-of-day analysis', { error: (error instanceof Error ? error.message : String(error)) });
    throw error;
  }
}

/**
 * Analyze performance of high-confidence signals at market close
 * Supports both legacy sentiment_layers format and dual-model format (models.primary/mate)
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
  let primaryCorrect = 0, primaryTotal = 0;
  let mateCorrect = 0, mateTotal = 0;
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

    const primaryConf = signal.models?.primary?.confidence;
    const mateConf = signal.models?.mate?.confidence;
    const candidateMax = Math.max(
      typeof primaryConf === 'number' ? primaryConf : 0,
      typeof mateConf === 'number' ? mateConf : 0,
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

    // Check for dual-model format (primary = GPT-OSS, mate = DeepSeek-R1)
    const isDualModel = signal.models?.primary || signal.models?.mate || signal.comparison;
    const primary = signal.models?.primary;
    const mate = signal.models?.mate;
    const comparison = signal.comparison;
    
    // Compute models_agree: use actual direction comparison (most reliable)
    // Note: signal.type can be incorrect (e.g., "AGREEMENT" when directions differ)
    let modelsAgree: boolean | undefined;
    if (primary?.direction && mate?.direction) {
      // Compare normalized directions directly - this is the source of truth
      modelsAgree = normalizeDirection(primary.direction) === normalizeDirection(mate.direction);
    } else if (comparison?.agree !== undefined) {
      modelsAgree = comparison.agree;
    }
    // Don't use signal.type as it can be unreliable

    // Extract direction - prefer dual-model combined signal, fall back to individual models
    const combinedDirection =
      signal.signal?.direction ||                       // Dual-model combined signal
      signal.models?.primary?.direction ||              // Primary model direction
      signal.models?.mate?.direction ||                 // Mate model direction
      (tradingSignals as any)?.primary_direction ||     // Legacy format
      sentimentLayer?.sentiment;                        // Fallback to sentiment layer

    const predictedDirection = normalizeDirection(combinedDirection);
    const confidence0to1 = pickConfidence0to1(signal, tradingSignals, sentimentLayer);
    const confidence = confidence0to1 * 100;

    // Track ALL symbols regardless of confidence
    totalSignals++;

    // Track dual-model agreement
    if (isDualModel && modelsAgree) {
      agreementCount++;
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
        if (primary?.direction) {
          const primaryDir = normalizeDirection(primary.direction);
          if (primaryDir !== 'neutral') {
            primaryTotal++;
            if (primaryDir === actualDirection) primaryCorrect++;
          }
        }
        if (mate?.direction) {
          const mateDir = normalizeDirection(mate.direction);
          if (mateDir !== 'neutral') {
            mateTotal++;
            if (mateDir === actualDirection) mateCorrect++;
          }
        }
      }

      // Add ALL symbols to signal breakdown with full pre-market prediction info
      signalBreakdown.push({
        ticker: symbol,
        predicted: `${predictedDirection === 'up' ? '↑' : predictedDirection === 'down' ? '↓' : '→'} Expected`,
        predictedDirection,
        actual: `${actualDirection === 'up' ? '↑' : '↓'} ${Math.abs(closePerformance.dayChange).toFixed(1)}%`,
        actualDirection,
        confidence: Math.round(confidence),
        confidenceLevel: confidence > 80 ? 'high' : confidence > 60 ? 'medium' : 'low',
        correct: isCorrect,
        primary_direction: primary?.direction,
        primary_confidence: primary?.confidence ?? null,
        primary_reasoning: primary?.reasoning,
        mate_direction: mate?.direction,
        mate_confidence: mate?.confidence ?? null,
        mate_reasoning: mate?.reasoning,
        models_agree: modelsAgree,
        action: signal.signal?.action,
        signal_reasoning: signal.signal?.reasoning,
        articles_count: signal.articles_count,
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
      // No market data - add as pending with full pre-market prediction info
      signalBreakdown.push({
        ticker: symbol,
        predicted: `${predictedDirection === 'up' ? '↑' : predictedDirection === 'down' ? '↓' : '→'} Expected`,
        predictedDirection,
        actual: 'Pending',
        actualDirection: 'pending',
        confidence: Math.round(confidence),
        confidenceLevel: confidence > 80 ? 'high' : confidence > 60 ? 'medium' : 'low',
        correct: false,
        primary_direction: primary?.direction,
        primary_confidence: primary?.confidence ?? null,
        primary_reasoning: primary?.reasoning,
        mate_direction: mate?.direction,
        mate_confidence: mate?.confidence ?? null,
        mate_reasoning: mate?.reasoning,
        models_agree: modelsAgree,
        action: signal.signal?.action,
        signal_reasoning: signal.signal?.reasoning,
        articles_count: signal.articles_count,
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
      primary: primaryTotal > 0 ? { accuracy: primaryCorrect / primaryTotal, correct: primaryCorrect, total: primaryTotal } : null,
      mate: mateTotal > 0 ? { accuracy: mateCorrect / mateTotal, correct: mateCorrect, total: mateTotal } : null,
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
 * Get real market close performance data from Yahoo Finance API with D1 caching
 * First checks D1 cache, then fetches missing symbols from Yahoo and stores results
 */
async function getMarketClosePerformance(
  symbols: string[],
  closeDate: string,
  env: CloudflareEnvironment
): Promise<MarketCloseData> {
  logger.info(`Fetching market close data for ${symbols.length} symbols (date: ${closeDate})`);
  const performance: MarketCloseData = {};

  // Step 1: Check D1 cache for existing data
  const cachedSymbols = new Set<string>();
  if (env.PREDICT_JOBS_DB) {
    try {
      const placeholders = symbols.map(() => '?').join(',');
      const cached = await env.PREDICT_JOBS_DB.prepare(`
        SELECT symbol, close_price, previous_close, day_change, volume, timestamp, data_source, fetch_status, fetch_error
        FROM market_close_data
        WHERE close_date = ? AND symbol IN (${placeholders})
      `).bind(closeDate, ...symbols).all();

      if (cached.results && cached.results.length > 0) {
        logger.info(`D1 cache hit: ${cached.results.length}/${symbols.length} symbols`);
        for (const row of cached.results as any[]) {
          cachedSymbols.add(row.symbol);
          if (row.fetch_status === 'success') {
            performance[row.symbol] = {
              symbol: row.symbol,
              closePrice: row.close_price,
              dayChange: row.day_change,
              volume: row.volume,
              previousClose: row.previous_close,
              timestamp: row.timestamp,
              dataSource: `${row.data_source}_cached`
            };
          } else {
            // Cached failure - don't retry
            performance[row.symbol] = {
              symbol: row.symbol,
              closePrice: null,
              dayChange: null,
              volume: null,
              error: row.fetch_error || 'Previously failed',
              dataSource: 'cached_failed'
            };
          }
        }
      }
    } catch (cacheError: any) {
      logger.warn('D1 cache lookup failed, fetching all from Yahoo', { error: cacheError.message });
    }
  }

  // Step 2: Fetch missing symbols from Yahoo Finance
  const missingSymbols = symbols.filter(s => !cachedSymbols.has(s));
  if (missingSymbols.length > 0) {
    logger.info(`Fetching ${missingSymbols.length} symbols from Yahoo Finance`);
  }

  // Calculate date range for target date (covers target day + previous day for previousClose)
  // Using 10-day lookback to handle holidays and long weekends
  const targetDateMs = Date.parse(closeDate + 'T00:00:00Z');
  const period1 = Math.floor((targetDateMs - 10 * 24 * 60 * 60 * 1000) / 1000); // 10 days before target for holidays
  const period2 = Math.floor((targetDateMs + 24 * 60 * 60 * 1000) / 1000);      // End of target day

  for (const symbol of missingSymbols) {
    let fetchStatus: 'success' | 'failed' | 'no_data' = 'failed';
    let fetchError: string | null = null;

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;

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

      // Find the index matching the target date (or closest available)
      const targetDayStart = targetDateMs / 1000;
      const targetDayEnd = targetDayStart + 24 * 60 * 60;

      let targetIndex = -1;
      let usedFallbackDate = false;
      let actualDataDate: string | undefined;

      for (let i = timestamps.length - 1; i >= 0; i--) {
        if (timestamps[i] >= targetDayStart && timestamps[i] < targetDayEnd) {
          targetIndex = i;
          break;
        }
      }

      // Fallback to latest if target date not found (e.g., market holiday)
      if (targetIndex === -1) {
        targetIndex = timestamps.length - 1;
        usedFallbackDate = true;
        // Extract actual date from fallback timestamp
        const fallbackDate = new Date(timestamps[targetIndex] * 1000);
        actualDataDate = fallbackDate.toISOString().split('T')[0];
        logger.warn(`No exact data for ${symbol} on ${closeDate}, using fallback from ${actualDataDate} (market holiday?)`);
      }

      const previousIndex = Math.max(0, targetIndex - 1);

      // Validate we have distinct previous close data (not same day)
      if (previousIndex === targetIndex || timestamps[previousIndex] === timestamps[targetIndex]) {
        fetchStatus = 'no_data';
        throw new Error(`No previous trading day data for ${symbol} on ${closeDate} (holiday or market closed?)`);
      }

      const closePrice = quote.close[targetIndex];
      const previousClose = quote.close[previousIndex];
      const volume = quote.volume?.[targetIndex]; // Optional

      // Only closePrice and previousClose are required for EOD analysis
      if (closePrice === null || closePrice === undefined ||
          previousClose === null || previousClose === undefined) {
        fetchStatus = 'no_data';
        throw new Error(`Missing price data for ${symbol} on ${closeDate}`);
      }

      // Calculate day change
      const dayChange = ((closePrice - previousClose) / previousClose) * 100;

      performance[symbol] = {
        symbol,
        closePrice: closePrice,
        dayChange: dayChange,
        volume: volume ?? null,
        previousClose: previousClose,
        timestamp: timestamps[targetIndex],
        dataSource: 'yahoo',
        usedFallbackDate,
        actualDataDate
      };

      fetchStatus = 'success';
      logger.info(`Market data for ${symbol} (${closeDate}): $${closePrice.toFixed(2)} (${dayChange > 0 ? '+' : ''}${dayChange.toFixed(2)}%)`);

      // Store successful fetch in D1
      if (env.PREDICT_JOBS_DB) {
        try {
          await env.PREDICT_JOBS_DB.prepare(`
            INSERT OR REPLACE INTO market_close_data
            (symbol, close_date, close_price, previous_close, day_change, volume, timestamp, data_source, fetch_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'yahoo', 'success')
          `).bind(symbol, closeDate, closePrice, previousClose, dayChange, volume ?? null, timestamps[targetIndex]).run();
        } catch (storeError: any) {
          logger.warn(`Failed to cache market data for ${symbol}`, { error: storeError.message });
        }
      }

    } catch (error: any) {
      fetchError = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to get market data for ${symbol}: ${fetchError}`);

      // Use fallback data with clear indication it's not real
      performance[symbol] = {
        symbol,
        closePrice: null,
        dayChange: null,
        volume: null,
        error: fetchError,
        dataSource: 'failed'
      };

      // NOTE: We intentionally do NOT cache failed fetches permanently.
      // Transient Yahoo outages would otherwise permanently block data for that date.
      // If needed, failed fetches can be retried on the next EOD run or manual trigger.
      logger.info(`Skipping cache for failed fetch: ${symbol} on ${closeDate} (will retry on next run)`);
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
    const conf = signal.models?.primary?.confidence ||
                 signal.models?.mate?.confidence ||
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
