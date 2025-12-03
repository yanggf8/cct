/**
 * Report Data Retrieval Module - TypeScript
 * KV data access functions for the 4-report workflow with comprehensive type safety
 */
import { type MarketBias, type ConfidenceLevel, type VolatilityLevel } from './tomorrow-outlook-tracker.js';
import { type EnhancedAnalysisResults } from './enhanced_analysis.js';
import type { CloudflareEnvironment } from '../types.js';
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
export declare class ReportDataRetrieval {
    private confidenceThreshold;
    constructor();
    /**
     * PRE-MARKET BRIEFING (8:30 AM) - Get morning predictions + evaluate yesterday's outlook
     */
    getPreMarketBriefingData(env: CloudflareEnvironment, date: Date): Promise<PreMarketBriefingData>;
    /**
     * INTRADAY CHECK (12:00 PM) - Get updated morning predictions with current performance
     */
    getIntradayCheckData(env: CloudflareEnvironment, date: Date): Promise<IntradayCheckData>;
    /**
     * END-OF-DAY SUMMARY (4:05 PM) - Get complete day performance + store tomorrow outlook
     */
    getEndOfDaySummaryData(env: CloudflareEnvironment, date: Date): Promise<EndOfDaySummaryData>;
    /**
     * WEEKLY REVIEW (Sunday) - Get weekly performance patterns
     */
    getWeeklyReviewData(env: CloudflareEnvironment, date: Date): Promise<WeeklyReviewData>;
    /**
     * Get last 5 trading days of performance data
     */
    getWeeklyPerformanceData(env: CloudflareEnvironment, currentDate: Date): Promise<WeeklyDayPerformance[]>;
    /**
     * Get single day performance data
     */
    getSingleDayPerformanceData(env: CloudflareEnvironment, dateStr: string): Promise<SingleDayPerformance | null>;
    /**
     * Helper functions for generating summaries
     */
    generateIntradayPerformanceSummary(predictionsData: PredictionsData | null): IntradayPerformanceSummary;
    generateEndOfDaySummary(predictionsData: PredictionsData | null): EndOfDaySummary;
    generateTomorrowOutlook(predictionsData: PredictionsData | null): TomorrowOutlook;
    generateAITomorrowOutlook(aiAnalysis: EnhancedAnalysisResults, predictionsData: PredictionsData): TomorrowOutlook;
    generateWeeklyAnalysis(weeklyData: WeeklyDayPerformance[]): WeeklyAnalysis;
    calculateDirectionalAccuracy(predictions: Prediction[], direction: 'up' | 'down'): number;
    generateRecommendations(performanceSummary: PerformanceSummary): string[];
    identifyWeeklyTrends(dailyPerformances: DayPerformanceRecord[]): WeeklyTrends;
    getWeeklyPeriod(date: Date): WeeklyPeriod;
    /**
     * Get yesterday's predictions for outlook evaluation
     */
    getYesterdaysPredictions(env: CloudflareEnvironment, currentDate: Date): Promise<PredictionsData | null>;
    /**
     * Generate actual market data from predictions for outlook evaluation
     */
    generateActualMarketData(predictionsData: PredictionsData | null): ActualMarketData;
    getDefaultPreMarketData(dateStr: string): PreMarketBriefingData;
    getDefaultIntradayData(dateStr: string): IntradayCheckData;
    getDefaultEndOfDayData(dateStr: string): EndOfDaySummaryData;
    getDefaultWeeklyData(dateStr: string): WeeklyReviewData;
    getDefaultWeeklyAnalysis(): WeeklyAnalysis;
    /**
     * Send Facebook error notification for data issues
     * NOTE: Disabled to prevent repetitive alert spam - system uses fallback data instead
     */
    sendDataErrorNotification(reportType: string, errorType: string, dateStr: string, env: CloudflareEnvironment): Promise<void>;
}
declare const reportDataRetrieval: ReportDataRetrieval;
export declare function getPreMarketBriefingData(env: CloudflareEnvironment, date: Date): Promise<PreMarketBriefingData>;
export declare function getIntradayCheckData(env: CloudflareEnvironment, date: Date): Promise<IntradayCheckData>;
export declare function getEndOfDaySummaryData(env: CloudflareEnvironment, date: Date): Promise<EndOfDaySummaryData>;
export declare function getWeeklyReviewData(env: CloudflareEnvironment, date: Date): Promise<WeeklyReviewData>;
export { reportDataRetrieval };
//# sourceMappingURL=report-data-retrieval.d.ts.map