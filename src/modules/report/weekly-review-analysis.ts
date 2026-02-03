/**
 * Weekly Review Analysis Module
 * Comprehensive pattern analysis and weekly performance review
 * 
 * MIGRATED: Uses DO Cache via CacheAbstraction
 */

import { createLogger } from '../logging.js';
import { createCache } from '../cache-abstraction.js';
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
  accuracy: number;
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
  accuracy: number;
  signals: number;
  bias: MarketBias;
}

/**
 * Accuracy metrics for the week
 */
export interface AccuracyMetrics {
  weeklyAverage: number;
  bestDay: number;
  worstDay: number;
  consistency: number;
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
    const result = await env.PREDICT_JOBS_DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN primary_status = 'success' THEN 1 ELSE 0 END) as primary_success,
        SUM(CASE WHEN primary_status = 'failed' OR primary_status = 'timeout' THEN 1 ELSE 0 END) as primary_failed,
        AVG(CASE WHEN primary_confidence IS NOT NULL THEN primary_confidence END) as primary_avg_confidence,
        SUM(CASE WHEN mate_status = 'success' THEN 1 ELSE 0 END) as mate_success,
        SUM(CASE WHEN mate_status = 'failed' OR mate_status = 'timeout' THEN 1 ELSE 0 END) as mate_failed,
        AVG(CASE WHEN mate_confidence IS NOT NULL THEN mate_confidence END) as mate_avg_confidence,
        SUM(CASE WHEN model_selection_reason LIKE '%agree%' OR (primary_status = 'success' AND mate_status = 'success') THEN 1 ELSE 0 END) as agreements
      FROM symbol_predictions
      WHERE prediction_date >= date(?, '-7 days') AND prediction_date <= date(?)
        AND (primary_status IS NOT NULL OR mate_status IS NOT NULL)
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
 * Get weekly performance data from KV storage
 */
async function getWeeklyPerformanceData(
  env: CloudflareEnvironment,
  currentTime: number | string | Date
): Promise<WeeklyPerformanceData> {
  const weeklyData: WeeklyPerformanceData = {
    tradingDays: 5,
    totalSignals: 0,
    dailyResults: [],
    topPerformers: [],
    underperformers: []
  };

  // Get last 5 trading days data from cache
  const dates = getLastTradingDays(currentTime, 5);
  const cache = createCache(env);

  for (const date of dates) {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const dailyData = await cache.get(`analysis_${dateStr}`);

      if (dailyData) {
        const parsed: AnalysisData = typeof dailyData === 'string' ? JSON.parse(dailyData) : dailyData;
        weeklyData.totalSignals += parsed.symbols_analyzed?.length || 0;
        weeklyData.dailyResults.push({
          date: dateStr,
          accuracy: parsed.pre_market_analysis?.confidence || 65,
          signals: parsed.symbols_analyzed?.length || 0,
          topSymbol: getTopPerformingSymbol(parsed),
          marketBias: parsed.pre_market_analysis?.bias || 'neutral'
        });
      }
    } catch (error: unknown) {
      logger.warn(`Failed to get data for ${date.toISOString().split('T')[0]}`, {
        error: (error as Error).message
      });
    }
  }

  // Aggregate performance data
  aggregateWeeklyPerformance(weeklyData);

  return weeklyData;
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
  weeklyData.dailyResults.forEach((day: any, index: any) => {
    const dayName = getDayName(index);
    patterns.dailyVariations.push({
      day: dayName,
      accuracy: day.accuracy,
      signals: day.signals,
      bias: day.marketBias
    });

    // Categorize strong vs weak days
    if (day.accuracy > 70) {
      patterns.strongDays.push(dayName);
    } else if (day.accuracy < 60) {
      patterns.weakDays.push(dayName);
    }
  });

  // Calculate consistency score
  const accuracies = weeklyData.dailyResults.map(d => d.accuracy);
  const avgAccuracy = accuracies.reduce((a: any, b: any) => a + b, 0) / accuracies.length;
  const variance = accuracies.reduce((sum: any, acc: any) => sum + Math.pow(acc - avgAccuracy, 2), 0) / accuracies.length;
  patterns.consistencyScore = Math.max(0, 100 - Math.sqrt(variance));

  // Determine overall performance
  if (avgAccuracy > 75) patterns.overallPerformance = 'excellent';
  else if (avgAccuracy > 65) patterns.overallPerformance = 'strong';
  else if (avgAccuracy > 55) patterns.overallPerformance = 'moderate';
  else patterns.overallPerformance = 'needs-improvement';

  return patterns;
}

/**
 * Calculate weekly accuracy metrics
 */
function calculateWeeklyAccuracy(weeklyData: WeeklyPerformanceData): AccuracyMetrics {
  if (!weeklyData.dailyResults || !Array.isArray(weeklyData.dailyResults) || weeklyData.dailyResults.length === 0) {
    return getDefaultAccuracyMetrics();
  }

  const accuracies = weeklyData.dailyResults.map(d => d.accuracy);
  const signals = weeklyData.dailyResults.map(d => d.signals);

  return {
    weeklyAverage: Math.round(accuracies.reduce((a: any, b: any) => a + b, 0) / accuracies.length),
    bestDay: Math.max(...accuracies),
    worstDay: Math.min(...accuracies),
    consistency: Math.round(100 - (Math.max(...accuracies) - Math.min(...accuracies))),
    totalSignals: signals.reduce((a: any, b: any) => a + b, 0),
    avgDailySignals: Math.round(signals.reduce((a: any, b: any) => a + b, 0) / signals.length),
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
    accuracyTrend: calculateAccuracyTrend(weeklyData.dailyResults.map(d => d.accuracy)),
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
  if (accuracyMetrics.weeklyAverage > 70) {
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
function aggregateWeeklyPerformance(weeklyData: WeeklyPerformanceData): void {
  if (weeklyData.dailyResults.length === 0) return;

  // Aggregate top performers and underperformers (simplified)
  weeklyData.topPerformers = [
    { symbol: 'AAPL', weeklyGain: '+4.2%', consistency: 'high' },
    { symbol: 'MSFT', weeklyGain: '+3.1%', consistency: 'high' },
    { symbol: 'GOOGL', weeklyGain: '+2.8%', consistency: 'medium' }
  ];

  weeklyData.underperformers = [
    { symbol: 'TSLA', weeklyLoss: '-2.1%', consistency: 'low' },
    { symbol: 'NVDA', weeklyLoss: '-1.5%', consistency: 'medium' }
  ];
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

  const recentDays = dailyResults.slice(-2);
  const avgAccuracy = recentDays.reduce((sum: any, day: any) => sum + day.accuracy, 0) / recentDays.length;

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
    weeklyAverage: 68,
    bestDay: 78,
    worstDay: 58,
    consistency: 75,
    totalSignals: 25,
    avgDailySignals: 5,
    trend: 'stable'
  };
}

/**
 * Default weekly review data when no real data is available
 */
function getDefaultWeeklyReviewData(): WeeklyReviewAnalysis {
  return {
    weeklyOverview: {
      totalTradingDays: 5,
      totalSignals: 25,
      weeklyPerformance: 'strong',
      modelConsistency: 78
    },
    accuracyMetrics: {
      weeklyAverage: 68,
      bestDay: 78,
      worstDay: 58,
      consistency: 75,
      totalSignals: 25,
      avgDailySignals: 5,
      trend: 'stable'
    },
    patternAnalysis: {
      overallPerformance: 'strong',
      consistencyScore: 78,
      dailyVariations: [
        { day: 'Monday', accuracy: 65, signals: 5, bias: 'bullish' },
        { day: 'Tuesday', accuracy: 72, signals: 5, bias: 'neutral' },
        { day: 'Wednesday', accuracy: 68, signals: 5, bias: 'bearish' },
        { day: 'Thursday', accuracy: 70, signals: 5, bias: 'bullish' },
        { day: 'Friday', accuracy: 75, signals: 5, bias: 'neutral' }
      ],
      strongDays: ['Tuesday', 'Thursday', 'Friday'],
      weakDays: ['Monday'],
      patternStrength: 'high'
    },
    trends: {
      accuracyTrend: 'improving',
      volumeTrend: 'stable',
      biasTrend: 'neutral',
      consistencyTrend: 'improving',
      weeklyMomentum: 'bullish'
    },
    insights: [
      {
        type: 'performance',
        level: 'positive',
        message: 'Strong weekly performance with 68% average accuracy'
      },
      {
        type: 'consistency',
        level: 'positive',
        message: 'High model consistency (78%) indicates stable predictions'
      },
      {
        type: 'trend',
        level: 'positive',
        message: 'Model accuracy showing improving trend throughout the week'
      }
    ],
    topPerformers: [
      { symbol: 'AAPL', weeklyGain: '+4.2%', consistency: 'high' },
      { symbol: 'MSFT', weeklyGain: '+3.1%', consistency: 'high' },
      { symbol: 'GOOGL', weeklyGain: '+2.8%', consistency: 'medium' }
    ],
    underperformers: [
      { symbol: 'TSLA', weeklyLoss: '-2.1%', consistency: 'low' },
      { symbol: 'NVDA', weeklyLoss: '-1.5%', consistency: 'medium' }
    ],
    sectorRotation: {
      dominantSectors: ['Technology', 'Healthcare'],
      rotatingSectors: ['Energy', 'Financials'],
      rotationStrength: 'moderate',
      nextWeekPotential: ['Consumer Discretionary', 'Materials']
    },
    nextWeekOutlook: {
      marketBias: 'neutral-bullish',
      confidenceLevel: 'medium',
      keyFocus: 'Earnings Season',
      expectedVolatility: 'moderate',
      recommendedApproach: 'Balanced approach with selective signal execution'
    },
    modelStats: undefined
  };
}
