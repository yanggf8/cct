/**
 * Cron-Based Signal Tracking System
 * Track morning predictions through intraday and end-of-day analysis
 */
import type { CloudflareEnvironment } from '../types.js';
interface SignalAnalysis {
    sentiment_layers?: Array<{
        sentiment?: string;
        confidence?: number;
        reasoning?: string;
    }>;
    reasoning?: string;
}
interface TradingSignal {
    enhanced_prediction?: {
        direction: 'up' | 'down' | 'neutral';
        confidence: number;
    };
    current_price: number;
    predicted_price: number;
    sentiment_layers?: Array<{
        sentiment?: string;
        confidence?: number;
        reasoning?: string;
    }>;
    reasoning?: string;
}
interface AnalysisData {
    trading_signals?: {
        [symbol: string]: TradingSignal;
    };
}
interface MorningPrediction {
    id: string;
    symbol: string;
    prediction: 'up' | 'down' | 'neutral';
    confidence: number;
    morningPrice: number;
    predictedPrice: number;
    timestamp: string;
    status: 'pending' | 'tracking' | 'validated' | 'divergent';
    analysis: SignalAnalysis;
    currentPrice?: number;
    currentChange?: number;
    performance?: PredictionPerformance;
    lastUpdated?: string;
}
interface PredictionPerformance {
    isCorrect: boolean;
    accuracy: number;
    divergenceLevel: 'low' | 'medium' | 'high';
    status: 'pending' | 'tracking' | 'validated' | 'divergent';
    predictedChange: number;
    actualChange: number;
}
interface PredictionsData {
    date: string;
    predictions: MorningPrediction[];
    metadata: {
        totalSignals: number;
        averageConfidence: number;
        bullishCount: number;
        bearishCount: number;
        generatedAt: string;
    };
    lastPerformanceUpdate?: string;
}
interface CurrentPrice {
    currentPrice: number;
    changePercent: number;
    timestamp: number;
}
interface PriceData {
    [symbol: string]: CurrentPrice;
}
interface PerformanceSummary {
    totalSignals: number;
    averageAccuracy: number;
    validatedSignals: number;
    divergentSignals: number;
}
interface EndOfDaySummary {
    date?: string;
    summary: {
        totalSignals: number;
        correctSignals: number;
        validatedSignals: number;
        divergentSignals: number;
        averageAccuracy: number;
        successRate: number;
    };
    topPerformers: Array<{
        symbol: string;
        prediction: string;
        confidence: number;
        accuracy: number;
        status: string;
    }>;
    underperformers: Array<{
        symbol: string;
        prediction: string;
        confidence: number;
        accuracy: number;
        status: string;
    }>;
    tomorrowOutlook: TomorrowOutlook;
    generatedAt?: string;
}
interface TomorrowOutlook {
    marketBias: 'bullish' | 'bearish' | 'neutral';
    confidence: 'high' | 'medium' | 'low';
    keyFocus: string;
    reasoning: string;
    recommendations: string[];
}
/**
 * Signal Tracking for Cron-Based System
 */
declare class CronSignalTracker {
    private confidenceThreshold;
    constructor();
    /**
     * Save morning predictions for tracking throughout the day
     */
    saveMorningPredictions(env: CloudflareEnvironment, analysisData: AnalysisData, date: Date): Promise<boolean>;
    /**
     * Get morning predictions for performance tracking
     */
    getMorningPredictions(env: CloudflareEnvironment, date: Date): Promise<PredictionsData | null>;
    /**
     * Update signal performance with current prices (for intraday check)
     */
    updateSignalPerformance(env: CloudflareEnvironment, date: Date): Promise<PredictionsData | null>;
    /**
     * Get current prices for multiple symbols
     */
    getCurrentPrices(symbols: string[]): Promise<PriceData>;
    /**
     * Calculate prediction performance
     */
    calculatePredictionPerformance(prediction: MorningPrediction, currentPrice: CurrentPrice): PredictionPerformance;
    /**
     * Generate end-of-day summary
     */
    generateEndOfDaySummary(env: CloudflareEnvironment, date: Date): Promise<EndOfDaySummary>;
    /**
     * Generate tomorrow outlook based on today's performance
     */
    generateTomorrowOutlook(predictions: MorningPrediction[], performance: PerformanceSummary): TomorrowOutlook;
    /**
     * Calculate directional accuracy
     */
    calculateDirectionalAccuracy(predictions: MorningPrediction[], direction: 'up' | 'down'): number;
    /**
     * Get default summary
     */
    private getDefaultSummary;
}
declare const cronSignalTracker: CronSignalTracker;
export { CronSignalTracker, cronSignalTracker };
export type { SignalAnalysis, TradingSignal, AnalysisData, MorningPrediction, PredictionPerformance, PredictionsData, CurrentPrice, PriceData, PerformanceSummary, EndOfDaySummary, TomorrowOutlook };
//# sourceMappingURL=cron-signal-tracking.d.ts.map