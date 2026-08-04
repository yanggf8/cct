/**
 * Weekly Review Analysis Module
 * Comprehensive pattern analysis and weekly performance review
 *
 * Reads the week's runs from D1 (`scheduled_job_results`), which is where the
 * pipeline stores them. It read the DO cache until 2026-08-04; the keys it
 * looked for there had no writer, so every weekly review found zero trading
 * days and finished `partial`.
 */

import { createLogger } from '../logging.js';
import { readD1ReportSnapshot } from '../d1-job-storage.js';
import { getLastTradingDays } from '../handlers/date-utils.js';
import type { CloudflareEnvironment as BaseEnv } from '../../types.js';

const logger = createLogger('weekly-review-analysis');

// ============================================================================
// Type Definitions and Interfaces
// ============================================================================

/**
 * Cloudflare Environment interface (uses base type)
 */
export type CloudflareEnvironment = BaseEnv;

/**
 * Performance level for weekly analysis
 */
export type PerformanceLevel = 'excellent' | 'strong' | 'moderate' | 'needs-improvement';

/**
 * Trend direction for various metrics
 */
export type TrendDirection = 'improving' | 'declining' | 'stable' | 'increasingly-bullish' | 'increasingly-bearish' | 'neutral';

/**
 * Market bias indicators
 */
export type MarketBias = 'bullish' | 'bearish' | 'neutral' | 'neutral-bullish';

/**
 * Insight levels for categorizing messages
 */
export type InsightLevel = 'positive' | 'warning' | 'info' | 'negative';

/**
 * Insight types for categorization
 */
export type InsightType = 'performance' | 'consistency' | 'trend' | 'patterns';

/**
 * Confidence levels for outlook
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Volatility expectations
 */
export type VolatilityLevel = 'high' | 'moderate' | 'low';

/**
 * Performance consistency indicators
 */
export type ConsistencyLevel = 'high' | 'medium' | 'low';

/**
 * Pattern strength indicators
 */
export type PatternStrength = 'high' | 'medium' | 'low';

/**
 * Rotation strength for sector analysis
 */
export type RotationStrength = 'strong' | 'moderate' | 'weak';

/**
 * Weekly momentum indicators
 */
export type WeeklyMomentum = 'bullish' | 'bearish' | 'neutral';

/**
 * Daily result entry from KV storage
 */
export interface DailyResult {
  date: string;
  /**
   * Realised accuracy for the day, from its end-of-day run. `null` while that
   * run has not happened yet — the day's signals are real but nothing has
   * settled, and an invented figure here would flow straight into the weekly
   * average.
   */
  accuracy: number | null;
  signals: number;
  topSymbol: string | null;
  marketBias: MarketBias;
}

/**
 * Weekly performance data structure
 */
export interface WeeklyPerformanceData {
  tradingDays: number;
  totalSignals: number;
  dailyResults: DailyResult[];
  topPerformers: WeeklyPerformer[];
  underperformers: WeeklyPerformer[];
}

/**
 * Individual performer (top or underperforming)
 */
export interface WeeklyPerformer {
  symbol: string;
  weeklyGain?: string;
  weeklyLoss?: string;
  consistency: ConsistencyLevel;
}

/**
 * Pattern analysis results
 */
export interface PatternAnalysis {
  overallPerformance: PerformanceLevel;
  consistencyScore: number;
  dailyVariations: DailyVariation[];
  strongDays: string[];
  weakDays: string[];
  patternStrength: PatternStrength;
}

/**
 * Daily variation in performance
 */
export interface DailyVariation {
  day: string;
  /** `null` for a day that has not been scored yet — see DailyResult.accuracy. */
  accuracy: number | null;
  signals: number;
  bias: MarketBias;
}

/**
 * Accuracy metrics for the week
 */
export interface AccuracyMetrics {
  /**
   * Accuracy is `null` until at least one day of the week has closed and been
   * scored. These fields used to fall back to invented figures — 68% average,
   * 78% best, 25 signals — which is how a pipeline that had produced nothing
   * for weeks still rendered a healthy-looking review.
   */
  weeklyAverage: number | null;
  bestDay: number | null;
  worstDay: number | null;
  consistency: number | null;
  totalSignals: number;
  avgDailySignals: number;
  trend: TrendDirection;
}

/**
 * Weekly trend analysis
 */
export interface WeeklyTrends {
  accuracyTrend: TrendDirection;
  volumeTrend: TrendDirection;
  biasTrend: TrendDirection;
  consistencyTrend: TrendDirection | 'improving' | 'variable';
  weeklyMomentum: WeeklyMomentum;
}

/**
 * Individual insight or recommendation
 */
export interface WeeklyInsight {
  type: InsightType;
  level: InsightLevel;
  message: string;
}

/**
 * Sector rotation analysis
 */
export interface SectorRotation {
  dominantSectors: string[];
  rotatingSectors: string[];
  rotationStrength: RotationStrength;
  nextWeekPotential: string[];
}

/**
 * Next week outlook and recommendations
 */
export interface NextWeekOutlook {
  marketBias: MarketBias;
  confidenceLevel: ConfidenceLevel;
  keyFocus: string;
  expectedVolatility: VolatilityLevel;
  recommendedApproach: string;
}

/**
 * Weekly overview summary
 */
export interface WeeklyOverview {
  totalTradingDays: number;
  totalSignals: number;
  weeklyPerformance: PerformanceLevel;
  modelConsistency: number;
}

/**
 * Generation status for visibility into failures
 */
export type GenerationStatus = 'success' | 'partial' | 'default' | 'failed';

export interface GenerationMeta {
  status: GenerationStatus;
  errors: string[];
  warnings: string[];
  dataSource: 'live' | 'cache' | 'fallback' | 'default';
  tradingDaysFound: number;
  generatedAt: string;
}

/**
 * Complete weekly review analysis result
 */
export interface WeeklyReviewAnalysis {
  weeklyOverview: WeeklyOverview;
  accuracyMetrics: AccuracyMetrics;
  patternAnalysis: PatternAnalysis;
  trends: WeeklyTrends;
  insights: WeeklyInsight[];
  topPerformers: WeeklyPerformer[];
  underperformers: WeeklyPerformer[];
  sectorRotation: SectorRotation;
  nextWeekOutlook: NextWeekOutlook;
  modelStats?: {
    primary: { total: number; success: number; failed: number; accuracy: number | null; avgConfidence: number | null } | null;
    mate: { total: number; success: number; failed: number; accuracy: number | null; avgConfidence: number | null } | null;
    agreementRate: number | null;
  };
  /** Generation metadata for failure visibility - check this to detect default/failed data */
  _generation?: GenerationMeta;
}

/**
 * Trading signal structure from KV data
 */
export interface TradingSignal {
  sentiment_layers?: Array<{
    confidence: number;
    [key: string]: any;
  }>;
  [key: string]: any;
}

/**
 * Analysis data structure from KV storage
 */
export interface AnalysisData {
  symbols_analyzed?: string[];
  pre_market_analysis?: {
    confidence?: number;
    bias?: MarketBias;
    [key: string]: any;
  };
  trading_signals?: Record<string, TradingSignal>;
  [key: string]: any;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate comprehensive weekly review analysis
 * Returns generation metadata (_generation) for failure visibility
 */
export async function generateWeeklyReviewAnalysis(
  env: CloudflareEnvironment,
  currentTime: number | string | Date
): Promise<WeeklyReviewAnalysis> {
  logger.info('Generating comprehensive weekly review analysis');

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Get weekly performance data
    const weeklyData = await getWeeklyPerformanceData(env, currentTime);

    // Check for meaningful data
    const tradingDaysFound = weeklyData.dailyResults?.length || 0;
    const hasRealData = tradingDaysFound > 0 && weeklyData.totalSignals > 0;

    if (!hasRealData) {
      warnings.push(`No trading data found (${tradingDaysFound} days, ${weeklyData.totalSignals} signals)`);
    }

    // Analyze weekly patterns
    const patternAnalysis = analyzeWeeklyPatterns(weeklyData);

    // Calculate accuracy metrics
    const accuracyMetrics = calculateWeeklyAccuracy(weeklyData);

    // Identify performance trends
    const trends = identifyWeeklyTrends(weeklyData, patternAnalysis);

    // Generate insights and recommendations
    const insights = generateWeeklyInsights(patternAnalysis, accuracyMetrics, trends);

    // Get dual-model stats from D1 symbol_predictions
    const modelStats = await getWeeklyDualModelStats(env, currentTime);

    if (!modelStats) {
      warnings.push('No dual-model stats available from D1');
    }

    // Determine generation status
    let status: GenerationStatus = 'success';
    if (!hasRealData && !modelStats) {
      status = 'partial'; // Some data missing
    }
    if (tradingDaysFound === 0) {
      status = 'partial'; // No trading days found
    }

    return {
      weeklyOverview: {
        totalTradingDays: weeklyData.tradingDays,
        totalSignals: weeklyData.totalSignals,
        weeklyPerformance: patternAnalysis.overallPerformance,
        modelConsistency: accuracyMetrics.consistency
      },
      accuracyMetrics,
      patternAnalysis,
      trends,
      insights,
      topPerformers: weeklyData.topPerformers,
      underperformers: weeklyData.underperformers,
      sectorRotation: analyzeSectorRotation(weeklyData),
      nextWeekOutlook: generateNextWeekOutlook(trends, patternAnalysis),
      modelStats,
      _generation: {
        status,
        errors,
        warnings,
        dataSource: hasRealData ? 'live' : 'fallback',
        tradingDaysFound,
        generatedAt: new Date().toISOString()
      }
    };

  } catch (error: unknown) {
    const errorMsg = (error as Error).message;
    logger.error('Error generating weekly review analysis', { error: errorMsg });
    errors.push(errorMsg);

    const defaultData = getDefaultWeeklyReviewData();
    defaultData._generation = {
      status: 'failed',
      errors,
      warnings,
      dataSource: 'default',
      tradingDaysFound: 0,
      generatedAt: new Date().toISOString()
    };
    return defaultData;
  }
}

/**
 * Get weekly dual-model statistics from D1 symbol_predictions table
 * Aggregates Gemma and DistilBERT performance over the past week
 */
export type WeeklyModelStats = {
  primary: { total: number; success: number; failed: number; accuracy: number | null; avgConfidence: number | null } | null;
  mate: { total: number; success: number; failed: number; accuracy: number | null; avgConfidence: number | null } | null;
  agreementRate: number | null;
};

export async function getWeeklyDualModelStats(
  env: CloudflareEnvironment,
  currentTime: number | string | Date
): Promise<WeeklyModelStats | undefined> {
  if (!env.PREDICT_JOBS_DB) return undefined;

  try {
    const current = typeof currentTime === 'string' || typeof currentTime === 'number' ? new Date(currentTime) : currentTime;
    const endDate = current.toISOString().split('T')[0];
    // symbol_predictions keeps the legacy column names: gemma_* is the primary
    // model, distilbert_* the mate. This query named primary_*/mate_* until
    // 2026-08-04 — columns that do not exist — so it threw on every run and the
    // weekly review reported "No dual-model stats available from D1" forever.
    const result = await env.PREDICT_JOBS_DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN gemma_status = 'success' THEN 1 ELSE 0 END) as primary_success,
        SUM(CASE WHEN gemma_status = 'failed' OR gemma_status = 'timeout' THEN 1 ELSE 0 END) as primary_failed,
        AVG(CASE WHEN gemma_confidence IS NOT NULL THEN gemma_confidence END) as primary_avg_confidence,
        SUM(CASE WHEN distilbert_status = 'success' THEN 1 ELSE 0 END) as mate_success,
        SUM(CASE WHEN distilbert_status = 'failed' OR distilbert_status = 'timeout' THEN 1 ELSE 0 END) as mate_failed,
        AVG(CASE WHEN distilbert_confidence IS NOT NULL THEN distilbert_confidence END) as mate_avg_confidence,
        SUM(CASE WHEN model_selection_reason LIKE '%agree%' OR (gemma_status = 'success' AND distilbert_status = 'success') THEN 1 ELSE 0 END) as agreements
      FROM symbol_predictions
      WHERE prediction_date >= date(?, '-7 days') AND prediction_date <= date(?)
        AND (gemma_status IS NOT NULL OR distilbert_status IS NOT NULL)
    `).bind(endDate, endDate).first();

    if (!result || (result as any).total === 0) return undefined;

    const r = result as any;
    const primaryTotal = (r.primary_success || 0) + (r.primary_failed || 0);
    const mateTotal = (r.mate_success || 0) + (r.mate_failed || 0);

    return {
      primary: primaryTotal > 0 ? {
        total: primaryTotal,
        success: r.primary_success || 0,
        failed: r.primary_failed || 0,
        accuracy: primaryTotal > 0 ? (r.primary_success || 0) / primaryTotal : null,
        avgConfidence: r.primary_avg_confidence
      } : null,
      mate: mateTotal > 0 ? {
        total: mateTotal,
        success: r.mate_success || 0,
        failed: r.mate_failed || 0,
        accuracy: mateTotal > 0 ? (r.mate_success || 0) / mateTotal : null,
        avgConfidence: r.mate_avg_confidence
      } : null,
      agreementRate: r.total > 0 ? (r.agreements || 0) / r.total : null
    };
  } catch (error: unknown) {
    logger.warn('Failed to get weekly dual-model stats from D1', { error: (error as Error).message });
    return undefined;
  }
}

/**
 * Get weekly performance data from D1.
 *
 * This used to read `analysis_<date>` out of the DO cache. No writer for that
 * key exists anywhere in the codebase — the pipeline stores its runs in D1's
 * `scheduled_job_results` — so every day missed, `tradingDaysFound` was always
 * 0, and the Sunday weekly job could only ever finish `partial`.
 *
 * Two snapshots per day carry what this needs: the `pre-market` run holds the
 * signals the models produced, and the `end-of-day` run holds how those calls
 * actually turned out.
 */
async function getWeeklyPerformanceData(
  env: CloudflareEnvironment,
  currentTime: number | string | Date
): Promise<WeeklyPerformanceData> {
  const weeklyData: WeeklyPerformanceData = {
    tradingDays: 0,
    totalSignals: 0,
    dailyResults: [],
    topPerformers: [],
    underperformers: []
  };

  const dates = getLastTradingDays(currentTime, 5);

  // ticker -> that ticker's daily percentage moves across the week
  const moves = new Map<string, number[]>();

  for (const date of dates) {
    const dateStr = date.toISOString().split('T')[0];
    try {
      const preMarket = await readD1ReportSnapshot(env, dateStr, 'pre-market');
      const parsed = preMarket?.data as AnalysisData | undefined;
      if (!parsed?.trading_signals) continue;

      const signals = Object.values(parsed.trading_signals);
      weeklyData.totalSignals += signals.length;

      const endOfDay = (await readD1ReportSnapshot(env, dateStr, 'end-of-day'))?.data;

      // Accuracy is a settled fact, so it comes from the end-of-day run or not
      // at all. The old fallback of 65 invented a number for days that had no
      // outcome yet.
      const accuracy = typeof endOfDay?.overallAccuracy === 'number'
        ? endOfDay.overallAccuracy
        : null;

      // From `signalBreakdown`, which lists every analysed symbol.
      // topWinners/topLosers hold only the ±1% movers, so a week summed from
      // those drops each symbol's quiet days.
      for (const row of endOfDay?.signalBreakdown ?? []) {
        if (!row?.ticker || typeof row.actual !== 'string') continue;
        const magnitude = parseFloat(row.actual.replace(/[^0-9.]/g, ''));
        if (Number.isNaN(magnitude)) continue; // 'Pending'
        const pct = row.actualDirection === 'down' ? -magnitude : magnitude;
        moves.set(row.ticker, [...(moves.get(row.ticker) ?? []), pct]);
      }

      weeklyData.dailyResults.push({
        date: dateStr,
        accuracy,
        signals: signals.length,
        topSymbol: getTopPerformingSymbol(parsed),
        marketBias: deriveMarketBias(signals)
      });
    } catch (error: unknown) {
      logger.warn(`Failed to get data for ${dateStr}`, {
        error: (error as Error).message
      });
    }
  }

  weeklyData.tradingDays = weeklyData.dailyResults.length;

  // Aggregate performance data
  aggregateWeeklyPerformance(weeklyData, moves);

  return weeklyData;
}

/**
 * The day's bias, taken from the signals themselves.
 *
 * The snapshot has no summary field for this; reading `pre_market_analysis.bias`
 * always came back undefined and every day was reported neutral.
 */
function deriveMarketBias(signals: TradingSignal[]): MarketBias {
  let bullish = 0;
  let bearish = 0;
  for (const signal of signals) {
    const sentiment = (signal.sentiment_layers?.[0]?.sentiment || '').toLowerCase();
    if (sentiment === 'bullish') bullish++;
    else if (sentiment === 'bearish') bearish++;
  }
  if (bullish > bearish) return 'bullish';
  if (bearish > bullish) return 'bearish';
  return 'neutral';
}

/**
 * Analyze weekly patterns and trends
 */
function analyzeWeeklyPatterns(weeklyData: WeeklyPerformanceData): PatternAnalysis {
  const patterns: PatternAnalysis = {
    overallPerformance: 'strong',
    consistencyScore: 0,
    dailyVariations: [],
    strongDays: [],
    weakDays: [],
    patternStrength: 'high'
  };

  if (!weeklyData.dailyResults || !Array.isArray(weeklyData.dailyResults) || weeklyData.dailyResults.length === 0) {
    return patterns;
  }

  // Calculate daily variations
  weeklyData.dailyResults.forEach((day, index) => {
    const dayName = getDayName(index);
    patterns.dailyVariations.push({
      day: dayName,
      accuracy: day.accuracy,
      signals: day.signals,
      bias: day.marketBias
    });

    // Categorize strong vs weak days. A day with no end-of-day run yet is
    // neither — it has no realised accuracy to judge.
    if (day.accuracy === null) return;
    if (day.accuracy > 70) {
      patterns.strongDays.push(dayName);
    } else if (day.accuracy < 60) {
      patterns.weakDays.push(dayName);
    }
  });

  // Calculate consistency score over the days that have settled
  const accuracies = settledAccuracies(weeklyData);
  if (accuracies.length === 0) return patterns;

  const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - avgAccuracy, 2), 0) / accuracies.length;
  patterns.consistencyScore = Math.max(0, 100 - Math.sqrt(variance));

  // Determine overall performance
  if (avgAccuracy > 75) patterns.overallPerformance = 'excellent';
  else if (avgAccuracy > 65) patterns.overallPerformance = 'strong';
  else if (avgAccuracy > 55) patterns.overallPerformance = 'moderate';
  else patterns.overallPerformance = 'needs-improvement';

  return patterns;
}

/**
 * The accuracies of the days that actually have an outcome.
 */
function settledAccuracies(weeklyData: WeeklyPerformanceData): number[] {
  return weeklyData.dailyResults
    .map(d => d.accuracy)
    .filter((a): a is number => a !== null);
}

/**
 * Calculate weekly accuracy metrics
 */
function calculateWeeklyAccuracy(weeklyData: WeeklyPerformanceData): AccuracyMetrics {
  if (!weeklyData.dailyResults || !Array.isArray(weeklyData.dailyResults) || weeklyData.dailyResults.length === 0) {
    return getDefaultAccuracyMetrics();
  }

  const accuracies = settledAccuracies(weeklyData);
  const signals = weeklyData.dailyResults.map(d => d.signals);
  const totalSignals = signals.reduce((a, b) => a + b, 0);

  // Signal counts are known as soon as the pre-market run lands; accuracy is
  // only known once the day has closed. Report the counts either way rather
  // than letting an unsettled day turn the whole block into NaN.
  if (accuracies.length === 0) {
    return { ...getDefaultAccuracyMetrics(), totalSignals, avgDailySignals: Math.round(totalSignals / signals.length) };
  }

  return {
    weeklyAverage: Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length),
    bestDay: Math.max(...accuracies),
    worstDay: Math.min(...accuracies),
    consistency: Math.round(100 - (Math.max(...accuracies) - Math.min(...accuracies))),
    totalSignals,
    avgDailySignals: Math.round(totalSignals / signals.length),
    trend: calculateAccuracyTrend(accuracies)
  };
}

/**
 * Identify weekly trends
 */
function identifyWeeklyTrends(weeklyData: WeeklyPerformanceData, patternAnalysis: PatternAnalysis): WeeklyTrends {
  if (!weeklyData.dailyResults || !Array.isArray(weeklyData.dailyResults) || weeklyData.dailyResults.length === 0) {
    return {
      accuracyTrend: 'stable',
      volumeTrend: 'stable',
      biasTrend: 'neutral',
      consistencyTrend: 'variable',
      weeklyMomentum: 'neutral'
    };
  }

  return {
    accuracyTrend: calculateAccuracyTrend(settledAccuracies(weeklyData)),
    volumeTrend: calculateVolumeTrend(weeklyData.dailyResults.map(d => d.signals)),
    biasTrend: calculateBiasTrend(weeklyData.dailyResults.map(d => d.marketBias)),
    consistencyTrend: patternAnalysis.consistencyScore > 80 ? 'improving' : 'variable',
    weeklyMomentum: determineWeeklyMomentum(weeklyData.dailyResults)
  };
}

/**
 * Generate weekly insights and recommendations
 */
function generateWeeklyInsights(
  patternAnalysis: PatternAnalysis,
  accuracyMetrics: AccuracyMetrics,
  trends: WeeklyTrends
): WeeklyInsight[] {
  const insights: WeeklyInsight[] = [];

  // Performance insights
  if (accuracyMetrics.weeklyAverage !== null && accuracyMetrics.weeklyAverage > 70) {
    insights.push({
      type: 'performance',
      level: 'positive',
      message: `Strong weekly performance with ${accuracyMetrics.weeklyAverage}% average accuracy`
    });
  }

  // Consistency insights
  if (patternAnalysis.consistencyScore > 80) {
    insights.push({
      type: 'consistency',
      level: 'positive',
      message: `High model consistency (${Math.round(patternAnalysis.consistencyScore)}%) indicates stable predictions`
    });
  } else if (patternAnalysis.consistencyScore < 60) {
    insights.push({
      type: 'consistency',
      level: 'warning',
      message: `Variable performance detected - consider recalibration`
    });
  }

  // Trend insights
  if (trends.accuracyTrend === 'improving') {
    insights.push({
      type: 'trend',
      level: 'positive',
      message: 'Model accuracy showing improving trend throughout the week'
    });
  }

  // Day-specific insights
  if (patternAnalysis.strongDays.length > 0) {
    insights.push({
      type: 'patterns',
      level: 'info',
      message: `Strongest performance on: ${patternAnalysis.strongDays.join(', ')}`
    });
  }

  return insights;
}

/**
 * Analyze sector rotation patterns (placeholder for future implementation)
 */
function analyzeSectorRotation(weeklyData: WeeklyPerformanceData): SectorRotation {
  return {
    dominantSectors: ['Technology', 'Healthcare'],
    rotatingSectors: ['Energy', 'Financials'],
    rotationStrength: 'moderate',
    nextWeekPotential: ['Consumer Discretionary', 'Materials']
  };
}

/**
 * Generate next week outlook
 */
function generateNextWeekOutlook(trends: WeeklyTrends, patternAnalysis: PatternAnalysis): NextWeekOutlook {
  let confidence: ConfidenceLevel = 'medium';
  let bias: MarketBias = 'neutral';
  let keyFocus = 'Earnings Season';

  // Determine confidence based on consistency
  if (patternAnalysis.consistencyScore > 80 && trends.accuracyTrend === 'improving') {
    confidence = 'high';
  } else if (patternAnalysis.consistencyScore < 60) {
    confidence = 'low';
  }

  // Determine bias based on recent trends
  if (trends.weeklyMomentum === 'bullish') {
    bias = 'bullish';
  } else if (trends.weeklyMomentum === 'bearish') {
    bias = 'bearish';
  }

  return {
    marketBias: bias,
    confidenceLevel: confidence,
    keyFocus,
    expectedVolatility: confidence === 'low' ? 'high' : 'moderate',
    recommendedApproach: generateRecommendedApproach(confidence, bias)
  };
}

// ============================================================================
// Helper Functions
// ============================================================================


/**
 * Get day name from index
 */
function getDayName(index: number): string {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  return days[index] || `Day ${index + 1}`;
}

/**
 * Get top performing symbol from analysis data
 */
function getTopPerformingSymbol(analysisData: AnalysisData): string | null {
  const signals = analysisData.trading_signals || {};
  const symbols = Object.keys(signals);

  if (symbols.length === 0) return null;

  // Return highest confidence symbol
  let topSymbol = symbols[0];
  let highestConfidence = 0;

  symbols.forEach(symbol => {
    const signal = signals[symbol];
    const confidence = signal.sentiment_layers?.[0]?.confidence || 0;
    if (confidence > highestConfidence) {
      highestConfidence = confidence;
      topSymbol = symbol;
    }
  });

  return topSymbol;
}

/**
 * Aggregate weekly performance data
 */
function aggregateWeeklyPerformance(
  weeklyData: WeeklyPerformanceData,
  moves: Map<string, number[]>
): void {
  if (weeklyData.dailyResults.length === 0) return;

  // This block used to be a hardcoded list — AAPL +4.2%, MSFT +3.1%, TSLA
  // -2.1% — returned identically every week whatever the market did. The real
  // daily moves are in each day's end-of-day snapshot.
  const totals = Array.from(moves.entries()).map(([symbol, daily]) => {
    const total = daily.reduce((a, b) => a + b, 0);
    // Consistency is how often the symbol moved the same way it did overall.
    // One observation is not a track record, so it can never read as 'high'.
    const agreeing = daily.filter(d => (d >= 0) === (total >= 0)).length;
    const share = agreeing / daily.length;
    const consistency: ConsistencyLevel =
      daily.length >= 3 && share === 1 ? 'high' : share >= 0.6 ? 'medium' : 'low';
    return { symbol, total, consistency };
  });

  const fmt = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  weeklyData.topPerformers = totals
    .filter(t => t.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map(t => ({ symbol: t.symbol, weeklyGain: fmt(t.total), consistency: t.consistency }));

  weeklyData.underperformers = totals
    .filter(t => t.total < 0)
    .sort((a, b) => a.total - b.total)
    .slice(0, 3)
    .map(t => ({ symbol: t.symbol, weeklyLoss: fmt(t.total), consistency: t.consistency }));
}

/**
 * Calculate accuracy trend from array of accuracies
 */
function calculateAccuracyTrend(accuracies: number[]): TrendDirection {
  if (accuracies.length < 2) return 'stable';

  const firstHalf = accuracies.slice(0, Math.floor(accuracies.length / 2));
  const secondHalf = accuracies.slice(Math.floor(accuracies.length / 2));

  const firstAvg = firstHalf.reduce((a: any, b: any) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a: any, b: any) => a + b, 0) / secondHalf.length;

  if (secondAvg > firstAvg + 5) return 'improving';
  if (secondAvg < firstAvg - 5) return 'declining';
  return 'stable';
}

/**
 * Calculate volume trend from array of signal counts
 */
function calculateVolumeTrend(signals: number[]): TrendDirection {
  return calculateAccuracyTrend(signals); // Same logic for volume
}

/**
 * Calculate bias trend from array of market biases
 */
function calculateBiasTrend(biases: MarketBias[]): TrendDirection {
  const bullishCount = biases.filter(b => b === 'bullish').length;
  const bearishCount = biases.filter(b => b === 'bearish').length;

  if (bullishCount > bearishCount) return 'increasingly-bullish';
  if (bearishCount > bullishCount) return 'increasingly-bearish';
  return 'neutral';
}

/**
 * Determine weekly momentum from recent daily results
 */
function determineWeeklyMomentum(dailyResults: DailyResult[]): WeeklyMomentum {
  if (dailyResults.length < 2) return 'neutral';

  const recent = dailyResults
    .slice(-2)
    .map(d => d.accuracy)
    .filter((a): a is number => a !== null);
  if (recent.length === 0) return 'neutral';

  const avgAccuracy = recent.reduce((sum, a) => sum + a, 0) / recent.length;

  if (avgAccuracy > 70) return 'bullish';
  if (avgAccuracy < 55) return 'bearish';
  return 'neutral';
}

/**
 * Generate recommended approach based on confidence and bias
 */
function generateRecommendedApproach(confidence: ConfidenceLevel, bias: MarketBias): string {
  if (confidence === 'high' && bias === 'bullish') {
    return 'Aggressive positioning with high-confidence signals';
  } else if (confidence === 'low') {
    return 'Conservative approach with smaller position sizes';
  } else {
    return 'Balanced approach with selective signal execution';
  }
}

/**
 * Get default accuracy metrics when no real data is available
 */
function getDefaultAccuracyMetrics(): AccuracyMetrics {
  return {
    weeklyAverage: null,
    bestDay: null,
    worstDay: null,
    consistency: null,
    totalSignals: 0,
    avgDailySignals: 0,
    trend: 'stable'
  };
}

/**
 * Default weekly review data when no real data is available
 */
function getDefaultWeeklyReviewData(): WeeklyReviewAnalysis {
  return {
    weeklyOverview: {
      totalTradingDays: 0,
      totalSignals: 0,
      weeklyPerformance: 'needs-improvement',
      modelConsistency: 0
    },
    accuracyMetrics: getDefaultAccuracyMetrics(),
    patternAnalysis: {
      overallPerformance: 'needs-improvement',
      consistencyScore: 0,
      dailyVariations: [],
      strongDays: [],
      weakDays: [],
      patternStrength: 'low'
    },
    trends: {
      accuracyTrend: 'stable',
      volumeTrend: 'stable',
      biasTrend: 'neutral',
      consistencyTrend: 'variable',
      weeklyMomentum: 'neutral'
    },
    insights: [
      {
        type: 'performance',
        level: 'negative',
        message: 'Weekly review could not be generated — no analysis to report'
      }
    ],
    topPerformers: [],
    underperformers: [],
    sectorRotation: {
      dominantSectors: [],
      rotatingSectors: [],
      rotationStrength: 'weak',
      nextWeekPotential: []
    },
    nextWeekOutlook: {
      marketBias: 'neutral',
      confidenceLevel: 'low',
      keyFocus: 'Unavailable',
      expectedVolatility: 'moderate',
      recommendedApproach: 'No recommendation — the week produced no analysable data'
    },
    modelStats: undefined
  };
}
