/**
 * Market Close Analysis Module
 * End-of-day analysis and tomorrow outlook prediction
 */
import type { CloudflareEnvironment } from '../types.js';
interface MarketCloseConfig {
    MARKET_CLOSE_TIME: string;
    ANALYSIS_DELAY: number;
    HIGH_ACCURACY_THRESHOLD: number;
    GOOD_ACCURACY_THRESHOLD: number;
    POOR_ACCURACY_THRESHOLD: number;
    HIGH_CONFIDENCE_MIN: number;
    VERY_HIGH_CONFIDENCE_MIN: number;
    DIVERGENCE_THRESHOLD_HIGH: number;
    DIVERGENCE_THRESHOLD_MEDIUM: number;
}
interface SignalData {
    symbol: string;
    prediction: 'up' | 'down' | 'neutral';
    status: 'validated' | 'divergent' | 'pending';
    accuracy?: number;
}
interface SignalSummary {
    totalSignals: number;
    averageAccuracy: number;
    validatedSignals: number;
    divergentSignals: number;
    highConfidenceSignals: number;
    topPerformers?: Array<{
        symbol: string;
        accuracy: number;
        confidence: number;
    }>;
    underperformers?: Array<{
        symbol: string;
        accuracy: number;
        confidence: number;
    }>;
}
interface SymbolMarketData {
    symbol: string;
    currentPrice: number;
    previousClose: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: number;
}
interface MarketCloseData {
    status: 'normal' | 'bullish' | 'bearish' | 'unknown';
    volatility: 'low' | 'moderate' | 'high';
    volume: 'low' | 'average' | 'high';
    marketConditions: {
        averageChange?: number;
        volatility?: number;
        trendStrength?: number;
        riskLevel?: 'low' | 'moderate' | 'high';
    };
    closingPrices: {
        [symbol: string]: SymbolMarketData;
    };
    marketEvents: string[];
}
interface TomorrowOutlook {
    marketBias: 'bullish' | 'bearish' | 'neutral';
    confidenceLevel: 'high' | 'medium' | 'low';
    keyFocus: string;
    riskLevel: 'low' | 'moderate' | 'high';
    expectedVolatility: 'low' | 'moderate' | 'high';
    recommendedApproach: string;
    reasoning: string;
    topSignals: Array<{
        symbol: string;
        accuracy: number;
        confidence: number;
    }>;
    riskFactors: string[];
}
interface PerformanceMetrics {
    overallAccuracy: number;
    highConfidenceAccuracy: number;
    signalReliability: number;
    predictionQuality: 'excellent' | 'good' | 'moderate' | 'poor' | 'unknown';
    consistencyScore: number;
}
interface MarketCloseAnalysisResult {
    analysisId: string;
    date: string;
    timestamp: string;
    marketCloseData: MarketCloseData;
    signalSummary: SignalSummary;
    tomorrowOutlook: TomorrowOutlook;
    performanceMetrics: PerformanceMetrics;
    topPerformers: Array<{
        symbol: string;
        accuracy: number;
        confidence: number;
    }>;
    underperformers: Array<{
        symbol: string;
        accuracy: number;
        confidence: number;
    }>;
    divergentSignals: Array<{
        symbol: string;
        type: string;
    }>;
    systemStatus: 'operational' | 'degraded' | 'offline';
    metadata: {
        totalSignals: number;
        analysisDuration: number;
        version: string;
    };
}
interface DefaultMarketCloseAnalysis {
    marketCloseData: {
        status: 'unknown';
        volatility: 'moderate';
        volume: 'average';
        closingPrices: {
            [symbol: string]: any;
        };
    };
    signalSummary: {
        totalSignals: number;
        averageAccuracy: number;
        topPerformers: any[];
        underperformers: any[];
    };
    tomorrowOutlook: {
        marketBias: 'neutral';
        confidenceLevel: 'medium';
        keyFocus: 'Market Open';
        riskLevel: 'moderate';
    };
    performanceMetrics: {
        overallAccuracy: number;
        predictionQuality: 'unknown';
    };
    systemStatus: 'operational';
}
/**
 * Market Close Analysis Configuration
 */
declare const MARKET_CLOSE_CONFIG: MarketCloseConfig;
/**
 * Market Close Analysis Engine
 */
declare class MarketCloseAnalysisEngine {
    private marketData;
    private signalPerformance;
    /**
     * Run comprehensive market close analysis
     */
    runMarketCloseAnalysis(env: CloudflareEnvironment, date: Date): Promise<MarketCloseAnalysisResult | DefaultMarketCloseAnalysis>;
    /**
     * Get market close data for signals
     */
    getMarketCloseData(env: CloudflareEnvironment, signals: SignalData[]): Promise<MarketCloseData>;
    /**
     * Get symbol market data
     */
    getSymbolMarketData(symbol: string): Promise<SymbolMarketData | null>;
    /**
     * Generate tomorrow outlook
     */
    generateTomorrowOutlook(env: CloudflareEnvironment, signals: SignalData[], signalSummary: SignalSummary): Promise<TomorrowOutlook>;
    /**
     * Calculate performance metrics
     */
    calculatePerformanceMetrics(signalSummary: SignalSummary): PerformanceMetrics;
    /**
     * Store market close analysis
     */
    storeMarketCloseAnalysis(env: CloudflareEnvironment, date: Date, analysisResult: MarketCloseAnalysisResult): Promise<void>;
    /**
     * Helper functions
     */
    private calculateBullishAccuracy;
    private calculateBearishAccuracy;
    private calculateRiskLevel;
    private generateOutlookReasoning;
    private getDefaultMarketCloseAnalysis;
}
declare const marketCloseAnalysisEngine: MarketCloseAnalysisEngine;
export { MarketCloseAnalysisEngine, MARKET_CLOSE_CONFIG, marketCloseAnalysisEngine };
export type { MarketCloseConfig, SignalData, SignalSummary, SymbolMarketData, MarketCloseData, TomorrowOutlook, PerformanceMetrics, MarketCloseAnalysisResult, DefaultMarketCloseAnalysis };
//# sourceMappingURL=market-close-analysis.d.ts.map