/**
 * Tomorrow Outlook Tracking System
 * Store and evaluate tomorrow outlook predictions
 */
import type { CloudflareEnvironment } from '../types.js';
export type MarketBias = 'bullish' | 'bearish' | 'neutral';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type VolatilityLevel = 'low' | 'moderate' | 'high';
export type EvaluationStatus = 'pending' | 'evaluated' | 'expired';
interface OutlookData {
    marketBias: MarketBias;
    confidence: ConfidenceLevel;
    keyFocus: string;
    riskLevel: string;
    expectedVolatility: VolatilityLevel;
    recommendedApproach: string;
    reasoning: string;
    topSignals: Array<{
        symbol: string;
        accuracy: number;
        confidence: number;
    }>;
    riskFactors: string[];
    recommendations?: string[];
}
interface ActualMarketData {
    marketBias: MarketBias;
    volatility: VolatilityLevel;
    averageChange?: number;
    [key: string]: any;
}
interface OutlookRecord {
    targetDate: string;
    generatedOn: string;
    generatedAt: string;
    outlook: OutlookData;
    evaluationStatus: EvaluationStatus;
    actualPerformance: ActualMarketData | null;
    accuracyScore: number | null;
    evaluationDetails?: EvaluationDetails;
    evaluationDate: string | null;
}
interface EvaluationDetails {
    biasCorrect: boolean;
    confidenceCorrect: boolean;
    performanceFactors: string[];
}
interface OutlookAccuracyHistory {
    date: string;
    predictedBias: MarketBias;
    actualBias: MarketBias;
    confidence: ConfidenceLevel;
    accuracyScore: number;
    biasCorrect: boolean;
}
interface BestPrediction {
    date: string;
    accuracy: number;
    predictedBias: MarketBias;
    actualBias: MarketBias;
}
interface WorstPrediction {
    date: string;
    accuracy: number;
    predictedBias: MarketBias;
    actualBias: MarketBias;
}
interface OutlookAccuracyStats {
    totalOutlooks: number;
    averageAccuracy: number;
    biasAccuracy: number;
    bestPrediction: BestPrediction | null;
    worstPrediction: WorstPrediction | null;
}
/**
 * Tomorrow Outlook Tracker
 */
export declare class TomorrowOutlookTracker {
    private outlookHistory;
    /**
     * Store tomorrow outlook when generated at EOD
     */
    storeTomorrowOutlook(env: CloudflareEnvironment, currentDate: Date, outlookData: OutlookData): Promise<boolean>;
    /**
     * Get today's outlook (generated yesterday)
     */
    getTodaysOutlook(env: CloudflareEnvironment, currentDate: Date): Promise<OutlookRecord | null>;
    /**
     * Evaluate today's outlook against actual performance
     */
    evaluateTodaysOutlook(env: CloudflareEnvironment, currentDate: Date, actualMarketData: ActualMarketData): Promise<OutlookRecord | null>;
    /**
     * Evaluate outlook accuracy
     */
    private evaluateOutlookAccuracy;
    /**
     * Check if confidence level was appropriate
     */
    private wasConfidenceAppropriate;
    /**
     * Calculate performance bonus points
     */
    private calculatePerformanceBonus;
    /**
     * Get performance factors details
     */
    private getPerformanceFactors;
    /**
     * Predict volatility from outlook
     */
    private predictVolatilityFromOutlook;
    /**
     * Get outlook accuracy history (last N days)
     */
    getOutlookAccuracyHistory(env: CloudflareEnvironment, days?: number): Promise<OutlookAccuracyHistory[]>;
    /**
     * Get recent outlook evaluations (simplified implementation)
     */
    private getRecentOutlookEvaluations;
    /**
     * Get outlook accuracy statistics
     */
    getOutlookAccuracyStats(env: CloudflareEnvironment): Promise<OutlookAccuracyStats>;
    /**
     * Get outlook performance trends
     */
    getOutlookPerformanceTrends(env: CloudflareEnvironment, days?: number): Promise<{
        accuracyTrend: 'improving' | 'stable' | 'declining';
        biasAccuracyTrend: 'improving' | 'stable' | 'declining';
        confidenceAccuracyTrend: 'improving' | 'stable' | 'declining';
        weeklyAverages: Array<{
            week: string;
            accuracy: number;
            biasAccuracy: number;
        }>;
    }>;
    /**
     * Calculate trend from series of values
     */
    private calculateTrend;
    /**
     * Get week start date for a given date
     */
    private getWeekStart;
    /**
     * Clean up expired outlook records
     */
    cleanupExpiredOutlooks(env: CloudflareEnvironment): Promise<number>;
}
declare const tomorrowOutlookTracker: TomorrowOutlookTracker;
export { tomorrowOutlookTracker };
//# sourceMappingURL=tomorrow-outlook-tracker.d.ts.map