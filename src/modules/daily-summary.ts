/**
 * Daily Summary Module
 * Generates comprehensive daily analysis summaries with KV persistence
 */

import {
  getCurrentDateEST,
  validateDateParameter,
  formatDateForDisplay,
  getDailySummaryKVKey,
  getDailyAnalysisKVKey,
  isTradingDay
} from './timezone-utils.js';
import { getSymbolAnalysisByDate } from './data.js';
import { KVKeyFactory, KeyTypes, KeyHelpers } from './kv-key-factory.js';
import { createDAL } from './dal.js';
import type { CloudflareEnvironment } from '../types.js';

// Type definitions
interface SentimentCounts {
  bullish: number;
  bearish: number;
  neutral: number;
}

interface MorningPrediction {
  direction: 'UP' | 'DOWN' | 'NEUTRAL' | 'UNKNOWN';
  confidence: number;
  sentiment: string;
  reasoning: string;
}

interface MiddayUpdate {
  ai_confidence: number;
  technical_confidence: number;
  confidence_difference: number;
  conflict: boolean;
  conflict_severity: 'none' | 'moderate' | 'high';
}

interface DailyValidation {
  predicted_direction: string;
  actual_direction: string;
  correct: boolean | null;
  price_accuracy: number | null;
}

interface NextDayOutlook {
  direction: string;
  confidence: number;
  key_factors: string[];
}

interface ProcessedSymbolData {
  symbol: string;
  morning_prediction: MorningPrediction;
  midday_update: MiddayUpdate;
  daily_validation: DailyValidation;
  next_day_outlook: NextDayOutlook;
  articles_analyzed: number;
  analysis_timestamp: string;
}

interface SummaryMetrics {
  overall_accuracy: number;
  total_predictions: number;
  correct_predictions: number;
  average_confidence: number;
  major_conflicts: string[];
  sentiment_distribution: SentimentCounts;
  system_status: "operational" | "no_data" | "error";
}

interface ChartsData {
  confidence_trend: Array<{
    symbol: string;
    morning: number;
    midday_ai: number;
    midday_technical: number;
  }>;
  accuracy_breakdown: {
    labels: string[];
    predicted: string[];
    conflicts: boolean[];
    confidence_levels: number[];
  };
  conflict_analysis: Array<{
    symbol: string;
    ai_confidence: number;
    technical_confidence: number;
    difference: number;
    severity: string;
  }>;
  generated_for_date: string;
}

interface DailySummary {
  date: string;
  display_date: string;
  is_trading_day: boolean;
  generated_at: string;
  summary: SummaryMetrics;
  symbols: ProcessedSymbolData[];
  charts_data: ChartsData;
}

interface AnalysisRecord {
  symbol: string;
  trading_signals?: any;
  sentiment_layers?: Array<{
    sentiment?: string;
    confidence?: number;
    reasoning?: string;
  }>;
  articles_analyzed?: number;
  timestamp?: string;
}

/**
 * Generate daily summary data structure
 */
export async function generateDailySummary(
  dateStr: string,
  env: CloudflareEnvironment
): Promise<DailySummary> {
  console.log(`📊 [DAILY-SUMMARY] Generating summary for ${dateStr}`);

  try {
    // Get analysis data for the date
    const analysisData = await getSymbolAnalysisByDate(env, dateStr);

    if (!analysisData || analysisData.length === 0) {
      console.log(`⚠️ [DAILY-SUMMARY] No analysis data found for ${dateStr}`);
      return generateEmptyDailySummary(dateStr);
    }

    // Process symbol-level data
    const symbols: ProcessedSymbolData[] = [];
    let totalPredictions = 0;
    let correctPredictions = 0;
    let totalConfidence = 0;
    const majorConflicts: string[] = [];
    const sentimentCounts: SentimentCounts = { bullish: 0, bearish: 0, neutral: 0 };

    for (const record of analysisData) {
      const symbolData = await processSymbolData(record, dateStr);
      symbols.push(symbolData);

      // Aggregate metrics
      totalPredictions++;
      if (symbolData.daily_validation && symbolData.daily_validation.correct) {
        correctPredictions++;
      }

      // Track confidence
      if (symbolData.morning_prediction && symbolData.morning_prediction.confidence) {
        totalConfidence += symbolData.morning_prediction.confidence;
      }

      // Track major conflicts
      if (symbolData.midday_update && symbolData.midday_update.conflict) {
        majorConflicts.push(symbolData.symbol);
      }

      // Track sentiment distribution
      if (symbolData.morning_prediction && symbolData.morning_prediction.sentiment) {
        const sentiment = symbolData.morning_prediction.sentiment.toLowerCase();
        if (sentimentCounts.hasOwnProperty(sentiment)) {
          sentimentCounts[sentiment as keyof SentimentCounts]++;
        }
      }
    }

    // Calculate summary metrics
    const overallAccuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
    const averageConfidence = totalPredictions > 0 ? totalConfidence / totalPredictions : 0;

    // Generate charts data
    const chartsData = generateChartsData(symbols, dateStr);

    const summary: DailySummary = {
      date: dateStr,
      display_date: formatDateForDisplay(dateStr),
      is_trading_day: isTradingDay(dateStr),
      generated_at: new Date().toISOString(),
      summary: {
        overall_accuracy: overallAccuracy,
        total_predictions: totalPredictions,
        correct_predictions: correctPredictions,
        average_confidence: averageConfidence,
        major_conflicts: majorConflicts,
        sentiment_distribution: sentimentCounts,
        system_status: "operational"
      },
      symbols: symbols,
      charts_data: chartsData
    };

    console.log(`✅ [DAILY-SUMMARY] Generated summary for ${dateStr}: ${totalPredictions} symbols, ${Math.round(overallAccuracy * 100)}% accuracy`);
    return summary;

  } catch (error: any) {
    console.error(`❌ [DAILY-SUMMARY] Error generating summary for ${dateStr}:`, error);
    throw error;
  }
}

/**
 * Process individual symbol data into daily summary format
 */
async function processSymbolData(
  record: AnalysisRecord,
  dateStr: string
): Promise<ProcessedSymbolData> {
  try {
    // Extract symbol from record
    const symbol = record.symbol || 'UNKNOWN';

    // Extract trading signals and sentiment layers
    const tradingSignals = record.trading_signals || record;
    const sentimentLayers = record.sentiment_layers || [];
    const primarySentiment = sentimentLayers[0] || {};

    // Morning prediction data
    const morningPrediction: MorningPrediction = {
      direction: tradingSignals.primary_direction || 'NEUTRAL',
      confidence: tradingSignals.overall_confidence || primarySentiment.confidence || 0,
      sentiment: primarySentiment.sentiment || 'neutral',
      reasoning: primarySentiment.reasoning || 'AI analysis'
    };

    // Midday update (conflict analysis between AI and technical)
    const aiConfidence = primarySentiment.confidence || 0;
    const technicalConfidence = tradingSignals.overall_confidence || 0;
    const confidenceDiff = Math.abs(aiConfidence - technicalConfidence);
    const hasConflict = confidenceDiff > 0.15; // 15% difference threshold

    const middayUpdate: MiddayUpdate = {
      ai_confidence: aiConfidence,
      technical_confidence: technicalConfidence,
      confidence_difference: confidenceDiff,
      conflict: hasConflict,
      conflict_severity: hasConflict ? (confidenceDiff > 0.25 ? 'high' : 'moderate') : 'none'
    };

    // Daily validation (actual vs predicted - simplified for now)
    // In a real implementation, you'd compare against actual market data
    const dailyValidation: DailyValidation = {
      predicted_direction: morningPrediction.direction,
      actual_direction: 'UNKNOWN', // Would be populated with real market data
      correct: null, // Would be calculated based on actual data
      price_accuracy: null // Would be calculated based on actual price movements
    };

    // Next day outlook (sentiment-driven prediction)
    const nextDayOutlook: NextDayOutlook = {
      direction: morningPrediction.direction, // Simplified - would use more sophisticated logic
      confidence: Math.max(0.5, morningPrediction.confidence * 0.9), // Slightly reduced confidence for next day
      key_factors: ['AI sentiment analysis', 'Technical indicators', 'Market momentum']
    };

    return {
      symbol: symbol,
      morning_prediction: morningPrediction,
      midday_update: middayUpdate,
      daily_validation: dailyValidation,
      next_day_outlook: nextDayOutlook,
      articles_analyzed: record.articles_analyzed || 0,
      analysis_timestamp: record.timestamp || dateStr
    };

  } catch (error: any) {
    console.error(`❌ [DAILY-SUMMARY] Error processing symbol data:`, error);
    return generateEmptySymbolData(record.symbol || 'UNKNOWN');
  }
}

/**
 * Generate charts data for visualization
 */
function generateChartsData(
  symbols: ProcessedSymbolData[],
  dateStr: string
): ChartsData {
  const confidenceTrend = symbols.map(symbol => ({
    symbol: symbol.symbol,
    morning: symbol.morning_prediction.confidence,
    midday_ai: symbol.midday_update.ai_confidence,
    midday_technical: symbol.midday_update.technical_confidence
  }));

  const accuracyBreakdown = {
    labels: symbols.map(s => s.symbol),
    predicted: symbols.map(s => s.morning_prediction.direction),
    conflicts: symbols.map(s => s.midday_update.conflict),
    confidence_levels: symbols.map(s => s.morning_prediction.confidence)
  };

  const conflictAnalysis = symbols.filter(s => s.midday_update.conflict).map(s => ({
    symbol: s.symbol,
    ai_confidence: s.midday_update.ai_confidence,
    technical_confidence: s.midday_update.technical_confidence,
    difference: s.midday_update.confidence_difference,
    severity: s.midday_update.conflict_severity
  }));

  return {
    confidence_trend: confidenceTrend,
    accuracy_breakdown: accuracyBreakdown,
    conflict_analysis: conflictAnalysis,
    generated_for_date: dateStr
  };
}

/**
 * Generate empty daily summary for dates with no data
 */
function generateEmptyDailySummary(dateStr: string): DailySummary {
  return {
    date: dateStr,
    display_date: formatDateForDisplay(dateStr),
    is_trading_day: isTradingDay(dateStr),
    generated_at: new Date().toISOString(),
    summary: {
      overall_accuracy: 0,
      total_predictions: 0,
      correct_predictions: 0,
      average_confidence: 0,
      major_conflicts: [],
      sentiment_distribution: { bullish: 0, bearish: 0, neutral: 0 },
      system_status: "no_data"
    },
    symbols: [],
    charts_data: {
      confidence_trend: [],
      accuracy_breakdown: { labels: [], predicted: [], conflicts: [], confidence_levels: [] },
      conflict_analysis: []
    }
  };
}

/**
 * Generate empty symbol data structure
 */
function generateEmptySymbolData(symbol: string): ProcessedSymbolData {
  return {
    symbol: symbol,
    morning_prediction: {
      direction: 'UNKNOWN',
      confidence: 0,
      sentiment: 'neutral',
      reasoning: 'No data available'
    },
    midday_update: {
      ai_confidence: 0,
      technical_confidence: 0,
      confidence_difference: 0,
      conflict: false,
      conflict_severity: 'none'
    },
    daily_validation: {
      predicted_direction: 'UNKNOWN',
      actual_direction: 'UNKNOWN',
      correct: null,
      price_accuracy: null
    },
    next_day_outlook: {
      direction: 'UNKNOWN',
      confidence: 0,
      key_factors: []
    },
    articles_analyzed: 0,
    analysis_timestamp: new Date().toISOString()
  };
}

/**
 * Retrieve daily summary from KV storage or generate if not exists
 */
export async function getDailySummary(
  dateStr: string,
  env: CloudflareEnvironment
): Promise<DailySummary> {
  const validatedDate = validateDateParameter(dateStr);
  const kvKey = getDailySummaryKVKey(validatedDate);

  console.log(`🔍 [DAILY-SUMMARY] Checking KV storage for ${kvKey}`);

  try {
    const dal = createDAL(env);

    // Check KV storage first using DAL
    const cachedResult = await dal.read(kvKey);

    if (cachedResult.success && cachedResult.data) {
      console.log(`✅ [DAILY-SUMMARY] Found cached summary for ${validatedDate}`);
      return cachedResult.data as DailySummary;
    }

    // Generate summary if not cached
    console.log(`🔄 [DAILY-SUMMARY] Generating new summary for ${validatedDate}`);
    const summary = await generateDailySummary(validatedDate, env);

    // Persist to KV with 90-day TTL using DAL
    console.log(`💾 [DAILY-SUMMARY] Storing summary in KV: ${kvKey}`);
    const writeResult = await dal.write(
      kvKey,
      summary,
      { expirationTtl: 7776000 } // 90 days
    );

    if (!writeResult.success) {
      console.error(`❌ [DAILY-SUMMARY] Failed to store summary: ${writeResult.error}`);
      // Continue anyway - we still have the generated summary
    }

    return summary;

  } catch (error: any) {
    console.error(`❌ [DAILY-SUMMARY] Error retrieving/generating summary for ${validatedDate}:`, error);
    throw error;
  }
}

// Export types for external use
export type {
  SentimentCounts,
  MorningPrediction,
  MiddayUpdate,
  DailyValidation,
  NextDayOutlook,
  ProcessedSymbolData,
  SummaryMetrics,
  ChartsData,
  DailySummary,
  AnalysisRecord
};