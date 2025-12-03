/**
 * End-of-Day Analysis Module
 * Market close analysis with high-confidence signal performance review and tomorrow's outlook
 */
import type { CloudflareEnvironment } from '../../types.js';
interface TradingSignal {
    sentiment_layers?: Array<{
        sentiment: string;
        confidence: number;
        reasoning: string;
    }>;
    overall_confidence?: number;
    primary_direction?: string;
}
interface AnalysisSignal {
    trading_signals?: TradingSignal;
    sentiment_layers?: Array<{
        sentiment: string;
        confidence: number;
        reasoning: string;
    }>;
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
/**
 * Generate comprehensive end-of-day analysis
 */
export declare function generateEndOfDayAnalysis(analysisData: AnalysisData | null, morningPredictions: MorningPredictions | null, intradayData: IntradayData | null, env: CloudflareEnvironment): Promise<EndOfDayResult>;
export type { TradingSignal, AnalysisSignal, AnalysisData, MarketClosePerformance, MarketCloseData, SignalBreakdown, TopPerformer, SignalPerformance, TomorrowOutlook, MarketInsights, EndOfDayResult, MorningPredictions, IntradayData };
//# sourceMappingURL=end-of-day-analysis.d.ts.map