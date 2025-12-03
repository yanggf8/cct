/**
 * Weekly Review Analysis Module
 * Comprehensive pattern analysis and weekly performance review
 */
/**
 * Cloudflare Environment interface
 */
export interface CloudflareEnvironment {
    MARKET_ANALYSIS_CACHE: KVNamespace;
}
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
/**
 * Generate comprehensive weekly review analysis
 */
export declare function generateWeeklyReviewAnalysis(env: CloudflareEnvironment, currentTime: number | string | Date): Promise<WeeklyReviewAnalysis>;
//# sourceMappingURL=weekly-review-analysis.d.ts.map