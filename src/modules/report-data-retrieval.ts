/**
 * Report Data Retrieval Module - TypeScript
 * KV data access functions for the 4-report workflow with comprehensive type safety
 */

import { createLogger } from './logging.js';
import { tomorrowOutlookTracker, type MarketBias, type ConfidenceLevel, type VolatilityLevel } from './tomorrow-outlook-tracker.js';
import { runEnhancedAnalysis, type EnhancedAnalysisResults } from './enhanced_analysis.js';
import { createDAL } from './dal.js';
import type { CloudflareEnvironment, DALResult } from '../types.js';

const logger = createLogger('report-data-retrieval');

// Type Definitions

export interface PredictionPerformance {
  accuracy?: number;
  isCorrect?: boolean;
  actualChange?: number;
}

export interface Prediction {
  symbol: string;
  prediction: 'up' | 'down' | 'neutral';
  confidence: number;
  status: 'validated' | 'divergent' | 'tracking' | 'unknown';
  performance?: PredictionPerformance;
  [key: string]: any;
}

export interface PredictionsData {
  predictions: Prediction[];
  generatedAt: string;
  [key: string]: any;
}

export interface PerformanceSummary {
  totalSignals: number;
  averageAccuracy: number;
  validatedSignals: number;
  divergentSignals: number;
  trackingSignals: number;
  signalsByStatus: Record<string, Prediction[]>;
  bullishSignals: number;
  bearishSignals: number;
}

export interface IntradayPerformanceSummary extends PerformanceSummary {
  [key: string]: any;
}

export interface TopPerformer {
  symbol: string;
  prediction: 'up' | 'down' | 'neutral';
  confidence: number;
  performance: PredictionPerformance;
  [key: string]: any;
}

export interface EndOfDaySummary extends PerformanceSummary {
  topPerformers: TopPerformer[];
  underperformers: TopPerformer[];
  successRate: number;
}

export interface TomorrowOutlook {
  marketBias: MarketBias;
  confidence: ConfidenceLevel;
  reasoning: string;
  keyFocus: string;
  recommendations: string[];
  basedOnData?: 'ai_analysis' | 'pattern_analysis';
  aiModelUsed?: string;
  analysisTimestamp?: string;
  symbolsAnalyzed?: number;
  highConfidenceSignals?: number;
  aiInsights?: string[];
  keyFactors?: string[];
  generatedAt?: string;
  [key: string]: any;
}

export interface OutlookEvaluation {
  score: number;
  details: {
    biasCorrect: boolean;
    confidenceCorrect: boolean;
    performanceFactors: string[];
  };
  [key: string]: any;
}

export interface YesterdayOutlook {
  outlook: TomorrowOutlook;
  evaluationStatus: 'pending' | 'evaluated' | 'expired';
  [key: string]: any;
}

export interface ActualMarketData {
  marketBias: MarketBias;
  volatility: VolatilityLevel;
  averageChange: number;
  [key: string]: any;
}

export interface PreMarketBriefingData {
  date: string;
  analysis: any;
  morningPredictions: PredictionsData | null;
  outlookEvaluation: OutlookEvaluation | null;
  yesterdayOutlook: TomorrowOutlook | null;
  marketStatus: 'pre-market';
  generatedAt: string;
}

export interface IntradayCheckData {
  date: string;
  morningPredictions: PredictionsData | null;
  performanceSummary: IntradayPerformanceSummary | null;
  marketStatus: 'intraday';
  currentTime: string;
  generatedAt: string;
}

export interface EndOfDaySummaryData {
  date: string;
  finalSummary: EndOfDaySummary | null;
  tomorrowOutlook: TomorrowOutlook | null;
  marketStatus: 'closed';
  closingTime: string;
  generatedAt: string;
}

export interface SingleDayPerformance {
  type: 'summary' | 'predictions';
  summary?: EndOfDaySummary;
  tomorrowOutlook?: TomorrowOutlook;
  predictions?: Prediction[];
  performanceSummary?: IntradayPerformanceSummary;
}

export interface WeeklyDayPerformance extends SingleDayPerformance {
  date: string;
  dayName: string;
}

export interface DayPerformanceRecord {
  date: string;
  dayName: string;
  accuracy: number;
  signals: number;
}

export interface WeeklyTrends {
  accuracyTrend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  [key: string]: any;
}

export interface WeeklyOverview {
  totalTradingDays: number;
  totalSignals: number;
  averageAccuracy: number;
  overallPerformance: 'excellent' | 'good' | 'needs improvement' | 'unknown';
  successRate: number;
}

export interface WeeklyAnalysis {
  overview: WeeklyOverview;
  dailyPerformances: DayPerformanceRecord[];
  bestDay: DayPerformanceRecord | null;
  worstDay: DayPerformanceRecord | null;
  trends: WeeklyTrends;
}

export interface WeeklyPeriod {
  start: string;
  end: string;
  year: number;
}

export interface WeeklyReviewData {
  date: string;
  weeklyData: WeeklyDayPerformance[];
  weeklyAnalysis: WeeklyAnalysis;
  period: WeeklyPeriod;
  generatedAt: string;
}

/**
 * Data retrieval functions for each report type
 */
export class ReportDataRetrieval {
  private confidenceThreshold: number;

  constructor() {
    this.confidenceThreshold = 70;
  }

  /**
   * PRE-MARKET BRIEFING (8:30 AM) - Get morning predictions + evaluate yesterday's outlook
   */
  async getPreMarketBriefingData(env: CloudflareEnvironment, date: Date): Promise<PreMarketBriefingData> {
    const dateStr = date.toISOString().split('T')[0];

    try {
      const dal = createDAL(env);

      // Get today's analysis
      const analysisKey = `analysis_${dateStr}`;
      const analysisResult: DALResult = await dal.read(analysisKey);

      // Get morning predictions (if available)
      const predictionsKey = `morning_predictions_${dateStr}`;
      const predictionsResult: DALResult = await dal.read(predictionsKey);

      // Evaluate yesterday's outlook accuracy
      let outlookEvaluation: OutlookEvaluation | null = null;
      const yesterdayOutlook: YesterdayOutlook | null = await tomorrowOutlookTracker.getTodaysOutlook(env, date);

      if (yesterdayOutlook && yesterdayOutlook.evaluationStatus === 'pending') {
        // We need actual market data to evaluate - for now, we'll use yesterday's predictions
        const yesterdayPredictions = await this.getYesterdaysPredictions(env, date);
        if (yesterdayPredictions) {
          const actualMarketData: ActualMarketData = this.generateActualMarketData(yesterdayPredictions);
          outlookEvaluation = await tomorrowOutlookTracker.evaluateTodaysOutlook(env, date, actualMarketData);
        }
      }

      const result: PreMarketBriefingData = {
        date: dateStr,
        analysis: analysisResult.success ? analysisResult.data : null,
        morningPredictions: predictionsResult.success ? predictionsResult.data : null,
        outlookEvaluation,
        yesterdayOutlook: yesterdayOutlook?.outlook || null,
        marketStatus: 'pre-market',
        generatedAt: new Date().toISOString()
      };

      // Log ERROR level for missing critical data
      if (!result.analysis) {
        logger.error('⚠️ [PRE-MARKET] CRITICAL: Missing analysis data from KV', {
          date: dateStr,
          key: `analysis_${dateStr}`,
          impact: 'Using fallback default data - report may not reflect actual market analysis',
          action: 'Manual investigation required for KV storage system'
        });

        // Send Facebook error notification
        // Facebook error notification disabled to prevent spam
        // this.sendDataErrorNotification('Pre-Market Briefing', 'Missing analysis data', dateStr, env);
        console.log(`[DISABLED] Would have sent Facebook error notification for Pre-Market Briefing - Missing analysis data`);
      }

      if (!result.morningPredictions) {
        logger.warn('⚠️ [PRE-MARKET] WARNING: Missing morning predictions data', {
          date: dateStr,
          key: `morning_predictions_${dateStr}`,
          impact: 'Using default signals - trading recommendations may not reflect actual AI analysis',
          action: 'Check cron job execution for morning signal generation'
        });
      }

      logger.info('Retrieved pre-market briefing data', {
        date: dateStr,
        hasAnalysis: !!result.analysis,
        hasPredictions: !!result.morningPredictions,
        outlookEvaluated: !!outlookEvaluation,
        usingFallback: !result.analysis || !result.morningPredictions
      });

      return result;

    } catch (error) {
      logger.error('Failed to retrieve pre-market briefing data', {
        date: dateStr,
        error: (error as Error).message
      });
      return this.getDefaultPreMarketData(dateStr);
    }
  }

  /**
   * INTRADAY CHECK (12:00 PM) - Get updated morning predictions with current performance
   */
  async getIntradayCheckData(env: CloudflareEnvironment, date: Date): Promise<IntradayCheckData> {
    const dateStr = date.toISOString().split('T')[0];

    try {
      const dal = createDAL(env);

      // Get morning predictions with performance updates
      const predictionsKey = `morning_predictions_${dateStr}`;
      const predictionsResult: DALResult = await dal.read(predictionsKey);

      let predictions: PredictionsData | null = null;
      let performanceSummary: IntradayPerformanceSummary | null = null;

      if (predictionsResult.success && predictionsResult.data) {
        predictions = predictionsResult.data;
        performanceSummary = this.generateIntradayPerformanceSummary(predictions);
      }

      const result: IntradayCheckData = {
        date: dateStr,
        morningPredictions: predictions,
        performanceSummary,
        marketStatus: 'intraday',
        currentTime: new Date().toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          minute: '2-digit'
        }) + ' EDT',
        generatedAt: new Date().toISOString()
      };

      // Log ERROR level for missing critical data
      if (!predictions) {
        logger.error('⚠️ [INTRADAY] CRITICAL: Missing morning predictions for performance tracking', {
          date: dateStr,
          key: `morning_predictions_${dateStr}`,
          impact: 'Cannot track real-time signal performance - using default tracking data',
          action: 'Check morning prediction generation and KV storage'
        });

        // Send Facebook error notification
        // Facebook error notification disabled to prevent spam
        // this.sendDataErrorNotification('Intraday Performance Check', 'Missing morning predictions', dateStr, env);
        console.log(`[DISABLED] Would have sent Facebook error notification for Intraday Performance Check - Missing morning predictions`);
      }

      logger.info('Retrieved intraday check data', {
        date: dateStr,
        hasPredictions: !!predictions,
        signalCount: predictions?.predictions?.length || 0,
        usingFallback: !predictions
      });

      return result;

    } catch (error) {
      logger.error('Failed to retrieve intraday check data', {
        date: dateStr,
        error: (error as Error).message
      });
      return this.getDefaultIntradayData(dateStr);
    }
  }

  /**
   * END-OF-DAY SUMMARY (4:05 PM) - Get complete day performance + store tomorrow outlook
   */
  async getEndOfDaySummaryData(env: CloudflareEnvironment, date: Date): Promise<EndOfDaySummaryData> {
    const dateStr = date.toISOString().split('T')[0];

    try {
      const dal = createDAL(env);

      // Get morning predictions with final performance
      const predictionsKey = `morning_predictions_${dateStr}`;
      const predictionsResult: DALResult = await dal.read(predictionsKey);

      // Get end-of-day summary if available
      const summaryKey = `end_of_day_summary_${dateStr}`;
      const summaryResult: DALResult = await dal.read(summaryKey);

      let finalSummary: EndOfDaySummary | null = null;
      let tomorrowOutlook: TomorrowOutlook | null = null;

      if (predictionsResult.success && predictionsResult.data) {
        const predictions: PredictionsData = predictionsResult.data;
        finalSummary = this.generateEndOfDaySummary(predictions);

        // Generate AI-powered tomorrow outlook
        try {
          logger.info('🤖 [END-OF-DAY] Running AI analysis for tomorrow outlook', { date: dateStr });
          const aiAnalysis: EnhancedAnalysisResults = await runEnhancedAnalysis(env, {
            purpose: 'tomorrow_outlook',
            context: 'end_of_day_summary'
          });

          tomorrowOutlook = this.generateAITomorrowOutlook(aiAnalysis, predictions);
          logger.info('✅ [END-OF-DAY] AI-powered tomorrow outlook generated', {
            date: dateStr,
            marketBias: tomorrowOutlook.marketBias,
            confidence: tomorrowOutlook.confidence
          });
        } catch (error) {
          logger.warn('⚠️ [END-OF-DAY] AI analysis failed, using fallback', {
            date: dateStr,
            error: (error as Error).message
          });
          // Fallback to simple pattern analysis
          tomorrowOutlook = this.generateTomorrowOutlook(predictions);
        }

        // Store tomorrow outlook for next day evaluation
        if (tomorrowOutlook) {
          await tomorrowOutlookTracker.storeTomorrowOutlook(env, date, tomorrowOutlook);
        }
      }

      // If pre-computed summary exists, use it
      if (summaryResult.success && summaryResult.data) {
        const parsedSummary = summaryResult.data;
        finalSummary = parsedSummary.summary || finalSummary;
        tomorrowOutlook = parsedSummary.tomorrowOutlook || tomorrowOutlook;
      }

      const result: EndOfDaySummaryData = {
        date: dateStr,
        finalSummary,
        tomorrowOutlook,
        marketStatus: 'closed',
        closingTime: '4:00 PM EDT',
        generatedAt: new Date().toISOString()
      };

      // Log ERROR level for missing critical data
      if (!predictionsResult.success || !predictionsResult.data) {
        logger.error('⚠️ [END-OF-DAY] CRITICAL: Missing predictions data for summary analysis', {
          date: dateStr,
          key: `predictions_${dateStr}`,
          impact: 'Cannot generate daily performance summary - using default data',
          action: 'Check daily prediction generation and KV storage system'
        });

        // Send Facebook error notification
        // Facebook error notification disabled to prevent spam
        // this.sendDataErrorNotification('End-of-Day Summary', 'Missing predictions data', dateStr, env);
        console.log(`[DISABLED] Would have sent Facebook error notification for End-of-Day Summary - Missing predictions data`);
      }

      if (!result.finalSummary) {
        logger.warn('⚠️ [END-OF-DAY] WARNING: Missing analysis data', {
          date: dateStr,
          key: `analysis_${dateStr}`,
          impact: 'Limited analysis context available for summary',
          action: 'Check daily analysis execution and storage'
        });
      }

      // Log if using pattern-based outlook instead of AI
      if (tomorrowOutlook && tomorrowOutlook.basedOnData !== 'ai_analysis') {
        logger.warn('⚠️ [END-OF-DAY] WARNING: Using pattern-based tomorrow outlook instead of AI analysis', {
          date: dateStr,
          outlookSource: tomorrowOutlook.basedOnData || 'pattern_analysis',
          impact: 'Tomorrow outlook not using fresh AI predictions',
          action: 'Check AI analysis execution for tomorrow outlook generation'
        });
      }

      logger.info('Retrieved end-of-day summary data', {
        date: dateStr,
        hasFinalSummary: !!finalSummary,
        hasTomorrowOutlook: !!tomorrowOutlook,
        outlookStored: !!tomorrowOutlook,
        usingFallback: !predictionsResult.success || !predictionsResult.data,
        outlookType: tomorrowOutlook?.basedOnData || 'pattern_analysis'
      });

      return result;

    } catch (error) {
      logger.error('Failed to retrieve end-of-day summary data', {
        date: dateStr,
        error: (error as Error).message
      });
      return this.getDefaultEndOfDayData(dateStr);
    }
  }

  /**
   * WEEKLY REVIEW (Sunday) - Get weekly performance patterns
   */
  async getWeeklyReviewData(env: CloudflareEnvironment, date: Date): Promise<WeeklyReviewData> {
    const dateStr = date.toISOString().split('T')[0];

    try {
      // Get last 5 trading days of data
      const weeklyData: WeeklyDayPerformance[] = await this.getWeeklyPerformanceData(env, date);

      // Generate weekly analysis
      const weeklyAnalysis: WeeklyAnalysis = this.generateWeeklyAnalysis(weeklyData);

      const result: WeeklyReviewData = {
        date: dateStr,
        weeklyData,
        weeklyAnalysis,
        period: this.getWeeklyPeriod(date),
        generatedAt: new Date().toISOString()
      };

      // Log ERROR level for missing critical weekly data
      if (weeklyData.length === 0) {
        logger.error('⚠️ [WEEKLY-REVIEW] CRITICAL: No weekly performance data found in KV', {
          date: dateStr,
          expectedTradingDays: 5,
          actualDaysFound: weeklyData.length,
          impact: 'Using fallback default data - weekly review may not reflect actual market performance',
          action: 'Manual investigation required for daily summary storage and weekly aggregation'
        });

        // Facebook error notification disabled to prevent spam
        // await this.sendDataErrorNotification('Weekly Review', 'Missing weekly performance data', dateStr, env);
        console.log(`[DISABLED] Would have sent Facebook error notification for Weekly Review - Missing weekly performance data`);
      } else if (weeklyData.length < 3) {
        logger.warn('⚠️ [WEEKLY-REVIEW] WARNING: Insufficient weekly data for comprehensive analysis', {
          date: dateStr,
          expectedTradingDays: 5,
          actualDaysFound: weeklyData.length,
          impact: 'Limited weekly analysis context - patterns may not be statistically significant',
          action: 'Check daily summary generation for missing trading days'
        });
      }

      logger.info('Retrieved weekly review data', {
        date: dateStr,
        daysAnalyzed: weeklyData.length,
        avgAccuracy: weeklyAnalysis.overview.averageAccuracy.toFixed(1),
        usingFallback: weeklyData.length === 0
      });

      return result;

    } catch (error) {
      logger.error('❌ [WEEKLY-REVIEW] CRITICAL: Failed to retrieve weekly review data', {
        date: dateStr,
        error: (error as Error).message,
        impact: 'Weekly review failed - using fallback data only',
        action: 'Investigate KV storage and weekly data aggregation systems'
      });

      // Send Facebook error notification for system failure
      // Facebook error notification disabled to prevent spam
      // await this.sendDataErrorNotification('Weekly Review', `System error: ${(error as Error).message}`, dateStr, env);
      console.log(`[DISABLED] Would have sent Facebook error notification for Weekly Review - System error: ${(error as Error).message}`);

      return this.getDefaultWeeklyData(dateStr);
    }
  }

  /**
   * Get last 5 trading days of performance data
   */
  async getWeeklyPerformanceData(env: CloudflareEnvironment, currentDate: Date): Promise<WeeklyDayPerformance[]> {
    const dates: Date[] = [];
    const current = new Date(currentDate);

    // Go back to find last 5 trading days (weekdays)
    let daysBack = 0;
    while (dates.length < 5 && daysBack < 14) { // Max 14 days back
      const checkDate = new Date(current);
      checkDate.setDate(current.getDate() - daysBack);

      // Check if it's a weekday (Monday = 1, Friday = 5)
      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        dates.push(checkDate);
      }

      daysBack++;
    }

    // Get data for each trading day
    const weeklyData: WeeklyDayPerformance[] = [];
    for (const date of dates.reverse()) {
      const dateStr = date.toISOString().split('T')[0];
      const dayData: SingleDayPerformance | null = await this.getSingleDayPerformanceData(env, dateStr);
      if (dayData) {
        weeklyData.push({
          date: dateStr,
          dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
          ...dayData
        });
      }
    }

    return weeklyData;
  }

  /**
   * Get single day performance data
   */
  async getSingleDayPerformanceData(env: CloudflareEnvironment, dateStr: string): Promise<SingleDayPerformance | null> {
    try {
      const dal = createDAL(env);

      // Try to get end-of-day summary first
      const summaryKey = `end_of_day_summary_${dateStr}`;
      const summaryResult: DALResult = await dal.read(summaryKey);

      if (summaryResult.success && summaryResult.data) {
        const parsed = summaryResult.data;
        return {
          type: 'summary',
          summary: parsed.summary,
          tomorrowOutlook: parsed.tomorrowOutlook
        };
      }

      // Fall back to morning predictions
      const predictionsKey = `morning_predictions_${dateStr}`;
      const predictionsResult: DALResult = await dal.read(predictionsKey);

      if (predictionsResult.success && predictionsResult.data) {
        const parsed = predictionsResult.data;
        const performanceSummary = this.generateIntradayPerformanceSummary(parsed);
        return {
          type: 'predictions',
          predictions: parsed.predictions,
          performanceSummary
        };
      }

      return null;

    } catch (error) {
      logger.warn('Failed to get single day performance data', {
        date: dateStr,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Helper functions for generating summaries
   */
  generateIntradayPerformanceSummary(predictionsData: PredictionsData | null): IntradayPerformanceSummary {
    if (!predictionsData || !predictionsData.predictions) {
      return {
        totalSignals: 0,
        averageAccuracy: 0,
        validatedSignals: 0,
        divergentSignals: 0,
        trackingSignals: 0,
        signalsByStatus: {},
        bullishSignals: 0,
        bearishSignals: 0
      };
    }

    const predictions: Prediction[] = predictionsData.predictions;

    const totalSignals = predictions.length;
    const validatedSignals = predictions.filter(p => p.status === 'validated').length;
    const divergentSignals = predictions.filter(p => p.status === 'divergent').length;
    const trackingSignals = predictions.filter(p => p.status === 'tracking').length;

    const signalsWithPerformance = predictions.filter(p => p.performance?.accuracy !== undefined);
    const averageAccuracy = signalsWithPerformance.length > 0
      ? signalsWithPerformance.reduce((sum, p) => sum + (p.performance?.accuracy || 0), 0) / signalsWithPerformance.length
      : 0;

    // Group by status
    const signalsByStatus: Record<string, Prediction[]> = {};
    predictions.forEach(p => {
      const status = p.status || 'unknown';
      if (!signalsByStatus[status]) {
        signalsByStatus[status] = [];
      }
      signalsByStatus[status].push(p);
    });

    return {
      totalSignals,
      averageAccuracy: Math.round(averageAccuracy),
      validatedSignals,
      divergentSignals,
      trackingSignals,
      signalsByStatus,
      bullishSignals: predictions.filter(p => p.prediction === 'up').length,
      bearishSignals: predictions.filter(p => p.prediction === 'down').length
    };
  }

  generateEndOfDaySummary(predictionsData: PredictionsData | null): EndOfDaySummary {
    const performanceSummary = this.generateIntradayPerformanceSummary(predictionsData);

    // Get top performers and underperformers
    const predictions: Prediction[] = predictionsData?.predictions || [];
    const topPerformers: TopPerformer[] = predictions
      .filter(p => p.performance?.accuracy !== undefined)
      .sort((a, b) => (b.performance?.accuracy || 0) - (a.performance?.accuracy || 0))
      .slice(0, 3)
      .map(p => ({
        symbol: p.symbol,
        prediction: p.prediction,
        confidence: p.confidence,
        performance: p.performance as PredictionPerformance
      }));

    const underperformers: TopPerformer[] = predictions
      .filter(p => p.performance?.accuracy !== undefined)
      .sort((a, b) => (a.performance?.accuracy || 0) - (b.performance?.accuracy || 0))
      .slice(0, 3)
      .map(p => ({
        symbol: p.symbol,
        prediction: p.prediction,
        confidence: p.confidence,
        performance: p.performance as PredictionPerformance
      }));

    return {
      ...performanceSummary,
      topPerformers,
      underperformers,
      successRate: performanceSummary.totalSignals > 0
        ? Math.round((performanceSummary.validatedSignals / performanceSummary.totalSignals) * 100)
        : 0
    };
  }

  generateTomorrowOutlook(predictionsData: PredictionsData | null): TomorrowOutlook {
    const performanceSummary = this.generateIntradayPerformanceSummary(predictionsData);

    let marketBias: MarketBias = 'neutral';
    let confidence: ConfidenceLevel = 'medium';
    let reasoning = '';

    // Determine bias based on performance
    const { validatedSignals, divergentSignals, averageAccuracy } = performanceSummary;

    if (averageAccuracy > 70 && divergentSignals === 0) {
      confidence = 'high';
      reasoning = 'Strong signal performance supports confident outlook';
    } else if (averageAccuracy < 50 || divergentSignals > validatedSignals) {
      confidence = 'low';
      reasoning = 'Poor signal performance suggests cautious approach';
    }

    // Determine bias based on directional accuracy
    const predictions: Prediction[] = predictionsData?.predictions || [];
    const bullishAccuracy = this.calculateDirectionalAccuracy(predictions, 'up');
    const bearishAccuracy = this.calculateDirectionalAccuracy(predictions, 'down');

    if (bullishAccuracy > bearishAccuracy && bullishAccuracy > 60) {
      marketBias = 'bullish';
    } else if (bearishAccuracy > bullishAccuracy && bearishAccuracy > 60) {
      marketBias = 'bearish';
    }

    return {
      marketBias,
      confidence,
      reasoning,
      keyFocus: marketBias === 'bullish' ? 'Long opportunities' :
                 marketBias === 'bearish' ? 'Risk management' : 'Market neutral',
      recommendations: this.generateRecommendations(performanceSummary)
    };
  }

  generateAITomorrowOutlook(aiAnalysis: EnhancedAnalysisResults, predictionsData: PredictionsData): TomorrowOutlook {
    // Extract AI-based predictions and sentiment
    const tradingSignals = aiAnalysis.sentiment_signals || {};
    const symbols = Object.keys(tradingSignals);

    let marketBias: MarketBias = 'neutral';
    let confidence: ConfidenceLevel = 'medium';
    let reasoning = '';
    let aiInsights: string[] = [];
    let keyFactors: string[] = [];

    // Analyze AI trading signals
    let bullishCount = 0;
    let bearishCount = 0;
    let highConfidenceSignals = 0;

    symbols.forEach(symbol => {
      const signal = tradingSignals[symbol];
      if (signal && signal.sentiment_analysis) {
        const direction = signal.sentiment_analysis.sentiment.toLowerCase();
        if (direction === 'positive') bullishCount++;
        else if (direction === 'negative') bearishCount++;

        if (signal.sentiment_analysis.confidence >= 0.7) {
          highConfidenceSignals++;
        }
      }
    });

    // Determine market bias from AI signals
    if (bullishCount > bearishCount * 1.5) {
      marketBias = 'bullish';
      reasoning = 'AI analysis shows strong bullish sentiment across multiple symbols';
    } else if (bearishCount > bullishCount * 1.5) {
      marketBias = 'bearish';
      reasoning = 'AI analysis indicates bearish market conditions';
    } else if (bullishCount === bearishCount) {
      marketBias = 'neutral';
      reasoning = 'AI analysis shows balanced market conditions';
    }

    // Set confidence based on AI signal strength
    if (highConfidenceSignals >= 3) {
      confidence = 'high';
      reasoning += ' with high-confidence AI signals';
    } else if (highConfidenceSignals >= 1) {
      confidence = 'medium';
      reasoning += ' with moderate AI signal confidence';
    } else {
      confidence = 'low';
      reasoning += ' with limited AI signal confidence';
    }

    // Extract key factors from AI analysis
    if (aiAnalysis.execution_metrics) {
      keyFactors.push(`Analysis method: ${aiAnalysis.execution_metrics.analysis_method}`);
      if (aiAnalysis.execution_metrics.sentiment_sources) {
        keyFactors.push(`Sentiment sources: ${aiAnalysis.execution_metrics.sentiment_sources.join(', ')}`);
      }
    }

    // Add AI model information
    aiInsights.push('GPT-OSS-120B sentiment analysis');
    aiInsights.push('Multi-symbol AI prediction');
    aiInsights.push(`${symbols.length} symbols analyzed`);

    return {
      marketBias,
      confidence,
      reasoning,
      keyFactors,
      aiInsights,
      basedOnData: 'ai_analysis',
      aiModelUsed: 'GPT-OSS-120B + DistilBERT',
      analysisTimestamp: aiAnalysis.analysis_time,
      symbolsAnalyzed: symbols.length,
      highConfidenceSignals,
      generatedAt: new Date().toISOString()
    };
  }

  generateWeeklyAnalysis(weeklyData: WeeklyDayPerformance[]): WeeklyAnalysis {
    if (weeklyData.length === 0) {
      return this.getDefaultWeeklyAnalysis();
    }

    const totalSignals = weeklyData.reduce((sum, day) => sum + (day.summary?.totalSignals || 0), 0);
    const totalValidated = weeklyData.reduce((sum, day) => sum + (day.summary?.validatedSignals || 0), 0);
    const averageAccuracy = weeklyData.reduce((sum, day) => sum + (day.summary?.averageAccuracy || 0), 0) / weeklyData.length;

    // Find best and worst performing days
    const dayPerformances: DayPerformanceRecord[] = weeklyData.map(day => ({
      date: day.date,
      dayName: day.dayName,
      accuracy: day.summary?.averageAccuracy || 0,
      signals: day.summary?.totalSignals || 0
    }));

    const bestDay = dayPerformances.reduce((best, current) =>
      current.accuracy > best.accuracy ? current : best);
    const worstDay = dayPerformances.reduce((worst, current) =>
      current.accuracy < worst.accuracy ? current : worst);

    return {
      overview: {
        totalTradingDays: weeklyData.length,
        totalSignals,
        averageAccuracy: Math.round(averageAccuracy),
        overallPerformance: averageAccuracy > 70 ? 'excellent' :
                           averageAccuracy > 60 ? 'good' : 'needs improvement',
        successRate: totalSignals > 0 ? Math.round((totalValidated / totalSignals) * 100) : 0
      },
      dailyPerformances: dayPerformances,
      bestDay,
      worstDay,
      trends: this.identifyWeeklyTrends(dayPerformances)
    };
  }

  calculateDirectionalAccuracy(predictions: Prediction[], direction: 'up' | 'down'): number {
    const directionSignals = predictions.filter(p => p.prediction === direction);
    if (directionSignals.length === 0) return 0;

    const correctSignals = directionSignals.filter(p => p.performance?.isCorrect).length;
    return Math.round((correctSignals / directionSignals.length) * 100);
  }

  generateRecommendations(performanceSummary: PerformanceSummary): string[] {
    const recommendations: string[] = [];

    if (performanceSummary.divergentSignals > 0) {
      recommendations.push('Monitor divergent signals closely');
    }

    if (performanceSummary.averageAccuracy > 70) {
      recommendations.push('High confidence in signal accuracy');
    } else if (performanceSummary.averageAccuracy < 50) {
      recommendations.push('Consider reducing position sizes');
    }

    return recommendations;
  }

  identifyWeeklyTrends(dailyPerformances: DayPerformanceRecord[]): WeeklyTrends {
    if (dailyPerformances.length < 3) return { accuracyTrend: 'insufficient_data' };

    const firstHalf = dailyPerformances.slice(0, Math.floor(dailyPerformances.length / 2));
    const secondHalf = dailyPerformances.slice(Math.floor(dailyPerformances.length / 2));

    const firstAvg = firstHalf.reduce((sum, day) => sum + day.accuracy, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, day) => sum + day.accuracy, 0) / secondHalf.length;

    if (secondAvg > firstAvg + 10) return { accuracyTrend: 'improving' };
    if (secondAvg < firstAvg - 10) return { accuracyTrend: 'declining' };
    return { accuracyTrend: 'stable' };
  }

  getWeeklyPeriod(date: Date): WeeklyPeriod {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay() + 1); // Monday

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4); // Friday

    return {
      start: startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      end: endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      year: date.getFullYear()
    };
  }

  /**
   * Get yesterday's predictions for outlook evaluation
   */
  async getYesterdaysPredictions(env: CloudflareEnvironment, currentDate: Date): Promise<PredictionsData | null> {
    const yesterday = new Date(currentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    try {
      const dal = createDAL(env);
      const predictionsKey = `morning_predictions_${yesterdayStr}`;
      const predictionsResult: DALResult = await dal.read(predictionsKey);
      if (predictionsResult.success && predictionsResult.data) {
        return predictionsResult.data;
      }
    } catch (error) {
      logger.warn('Failed to get yesterday\'s predictions', {
        date: yesterdayStr,
        error: (error as Error).message
      });
    }

    return null;
  }

  /**
   * Generate actual market data from predictions for outlook evaluation
   */
  generateActualMarketData(predictionsData: PredictionsData | null): ActualMarketData {
    if (!predictionsData || !predictionsData.predictions) {
      return {
        marketBias: 'neutral',
        volatility: 'moderate',
        averageChange: 0
      };
    }

    const predictions: Prediction[] = predictionsData.predictions;

    // Calculate actual market bias based on prediction performance
    const bullishAccuracy = this.calculateDirectionalAccuracy(predictions, 'up');
    const bearishAccuracy = this.calculateDirectionalAccuracy(predictions, 'down');

    let marketBias: MarketBias = 'neutral';
    if (bullishAccuracy > bearishAccuracy && bullishAccuracy > 60) {
      marketBias = 'bullish';
    } else if (bearishAccuracy > bullishAccuracy && bearishAccuracy > 60) {
      marketBias = 'bearish';
    }

    // Calculate volatility based on prediction divergence
    const divergentSignals = predictions.filter(p => p.status === 'divergent').length;
    const totalSignals = predictions.length;
    const divergenceRate = divergentSignals / totalSignals;

    let volatility: VolatilityLevel = 'moderate';
    if (divergenceRate > 0.3) volatility = 'high';
    else if (divergenceRate < 0.1) volatility = 'low';

    // Calculate average change based on actual performance
    const avgChange = predictions.reduce((sum, p) => {
      const actualChange = p.performance?.actualChange || 0;
      return sum + actualChange;
    }, 0) / predictions.length;

    return {
      marketBias,
      volatility,
      averageChange: avgChange
    };
  }

  // Default data methods
  getDefaultPreMarketData(dateStr: string): PreMarketBriefingData {
    return {
      date: dateStr,
      analysis: null,
      morningPredictions: null,
      outlookEvaluation: null,
      yesterdayOutlook: null,
      marketStatus: 'pre-market',
      generatedAt: new Date().toISOString()
    };
  }

  getDefaultIntradayData(dateStr: string): IntradayCheckData {
    return {
      date: dateStr,
      morningPredictions: null,
      performanceSummary: this.generateIntradayPerformanceSummary(null),
      marketStatus: 'intraday',
      currentTime: new Date().toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' EDT',
      generatedAt: new Date().toISOString()
    };
  }

  getDefaultEndOfDayData(dateStr: string): EndOfDaySummaryData {
    return {
      date: dateStr,
      finalSummary: this.generateEndOfDaySummary(null),
      tomorrowOutlook: this.generateTomorrowOutlook(null),
      marketStatus: 'closed',
      closingTime: '4:00 PM EDT',
      generatedAt: new Date().toISOString()
    };
  }

  getDefaultWeeklyData(dateStr: string): WeeklyReviewData {
    return {
      date: dateStr,
      weeklyData: [],
      weeklyAnalysis: this.getDefaultWeeklyAnalysis(),
      period: this.getWeeklyPeriod(new Date(dateStr)),
      generatedAt: new Date().toISOString()
    };
  }

  getDefaultWeeklyAnalysis(): WeeklyAnalysis {
    return {
      overview: {
        totalTradingDays: 0,
        totalSignals: 0,
        averageAccuracy: 0,
        overallPerformance: 'unknown',
        successRate: 0
      },
      dailyPerformances: [],
      bestDay: null,
      worstDay: null,
      trends: { accuracyTrend: 'insufficient_data' }
    };
  }

  /**
   * Send Facebook error notification for data issues
   * NOTE: Disabled to prevent repetitive alert spam - system uses fallback data instead
   */
  async sendDataErrorNotification(reportType: string, errorType: string, dateStr: string, env: CloudflareEnvironment): Promise<void> {
    console.log(`📱 [FACEBOOK-ALERT-DISABLED] Data error notification skipped for ${reportType}: ${errorType}`);
    console.log(`📱 [FACEBOOK-ALERT-DISABLED] System will use fallback data instead of sending alerts`);

    // Return immediately without sending Facebook notifications
    return;

    /* Original code preserved but disabled:
    try {
      const errorMessage = `🚨 DATA ALERT: ${reportType}\n` +
        `⚠️ Issue: ${errorType}\n` +
        `📅 Date: ${dateStr}\n` +
        `🔧 Impact: Report using fallback data - may not reflect actual analysis\n` +
        `🛠️  Action: Required - Check KV storage and cron job execution\n` +
        `⏰ Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EDT`;

      // Import Facebook function dynamically
      const { sendFacebookMessage } = await import('./facebook.js');

      logger.info(`📱 [FACEBOOK] Sending data error notification for ${reportType}`, {
        reportType,
        errorType,
        dateStr
      });

      await sendFacebookMessage(errorMessage, env);

      logger.info(`✅ [FACEBOOK] Data error notification sent for ${reportType}`);

    } catch (fbError) {
      logger.error('❌ [FACEBOOK] Failed to send data error notification', {
        reportType,
        errorType,
        dateStr,
        fbError: (fbError as Error).message
      });
    }
    */
  }
}

// Global instance
const reportDataRetrieval = new ReportDataRetrieval();

// Export functions for each report type
export async function getPreMarketBriefingData(env: CloudflareEnvironment, date: Date): Promise<PreMarketBriefingData> {
  return await reportDataRetrieval.getPreMarketBriefingData(env, date);
}

export async function getIntradayCheckData(env: CloudflareEnvironment, date: Date): Promise<IntradayCheckData> {
  return await reportDataRetrieval.getIntradayCheckData(env, date);
}

export async function getEndOfDaySummaryData(env: CloudflareEnvironment, date: Date): Promise<EndOfDaySummaryData> {
  return await reportDataRetrieval.getEndOfDaySummaryData(env, date);
}

export async function getWeeklyReviewData(env: CloudflareEnvironment, date: Date): Promise<WeeklyReviewData> {
  return await reportDataRetrieval.getWeeklyReviewData(env, date);
}

export {
  reportDataRetrieval
};