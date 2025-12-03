/**
 * AI-Powered Predictive Analytics Engine
 * Advanced forecasting system using dual AI models for market predictions
 * Integrates with existing GPT-OSS-120B and DistilBERT models
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Market prediction result with confidence scores
 */
export interface MarketPrediction {
    timestamp: string;
    predictionType: 'market_direction' | 'sector_rotation' | 'volatility_forecast' | 'regime_transition';
    timeframe: '1d' | '3d' | '1w' | '2w' | '1m';
    prediction: 'bullish' | 'bearish' | 'neutral' | 'volatile';
    confidence: number;
    aiAgreement: 'AGREE' | 'PARTIAL_AGREE' | 'DISAGREE';
    gptAnalysis: {
        reasoning: string;
        keyFactors: string[];
        riskFactors: string[];
        predictedMove: number;
        confidenceBreakdown: {
            technical: number;
            fundamental: number;
            sentiment: number;
            risk: number;
        };
    };
    distilbertAnalysis: {
        sentimentScore: number;
        sentimentLabel: 'positive' | 'negative' | 'neutral';
        confidence: number;
        keySignals: string[];
    };
    synthesizedInsights: {
        primaryDriver: string;
        secondaryDrivers: string[];
        riskLevel: 'low' | 'medium' | 'high' | 'extreme';
        actionableSignals: string[];
        contrarianIndicators: string[];
    };
    dataSourceSummary: {
        marketDrivers: boolean;
        sectorRotation: boolean;
        sentimentData: boolean;
        macroData: boolean;
    };
    modelPerformance: {
        gptResponseTime: number;
        distilbertResponseTime: number;
        totalProcessingTime: number;
        accuracyEstimate: number;
    };
}
/**
 * Predictive analytics configuration
 */
export interface PredictiveAnalyticsConfig {
    enableCache: boolean;
    defaultTimeframe: '1d' | '3d' | '1w' | '2w' | '1m';
    minConfidenceThreshold: number;
    maxPredictionAge: number;
    enableEnsemble: boolean;
    riskAdjustment: boolean;
}
/**
 * AI-Powered Predictive Analytics Engine
 */
export declare class AIPredictiveAnalytics {
    private env;
    private dal;
    private config;
    constructor(env: CloudflareEnvironment, config?: Partial<PredictiveAnalyticsConfig>);
    /**
     * Generate comprehensive market prediction using dual AI analysis
     */
    generateMarketPrediction(predictionType: MarketPrediction['predictionType'], timeframe?: MarketPrediction['timeframe']): Promise<MarketPrediction>;
    /**
     * Gather comprehensive market data for AI analysis
     */
    private gatherMarketData;
    /**
     * Fetch market drivers data
     */
    private fetchMarketDrivers;
    /**
     * Fetch sector rotation data
     */
    private fetchSectorRotation;
    /**
     * Fetch sentiment data
     */
    private fetchSentimentData;
    /**
     * Prepare analysis context for AI models
     */
    private prepareAnalysisContext;
    /**
     * Run GPT analysis for complex reasoning
     */
    private runGPTAnalysis;
    /**
     * Run DistilBERT analysis for sentiment classification
     */
    private runDistilbertAnalysis;
    /**
     * Extract key signals from context based on sentiment
     */
    private extractKeySignals;
    /**
     * Synthesize results from both AI models
     */
    private synthesizeResults;
    /**
     * Calculate agreement between AI models
     */
    private calculateAgreement;
    /**
     * Determine final direction based on AI agreement
     */
    private determineFinalDirection;
    private normalizeDirection;
    /**
     * Calculate combined confidence score
     */
    private calculateCombinedConfidence;
    /**
     * Generate synthesized insights
     */
    private generateInsights;
    /**
     * Identify primary market driver
     */
    private identifyPrimaryDriver;
    /**
     * Assess overall risk level
     */
    private assessRiskLevel;
    /**
     * Generate actionable signals
     */
    private generateActionableSignals;
    /**
     * Identify contrarian indicators
     */
    private identifyContrarianSignals;
    /**
     * Calculate accuracy estimate based on agreement and data quality
     */
    private calculateAccuracyEstimate;
    /**
     * Cache prediction for future reference
     */
    private cachePrediction;
    /**
     * Get recent predictions
     */
    getRecentPredictions(predictionType?: MarketPrediction['predictionType'], limit?: number): Promise<MarketPrediction[]>;
    /**
     * Get prediction accuracy statistics
     */
    getPredictionAccuracy(): Promise<{
        totalPredictions: number;
        averageConfidence: number;
        agreementDistribution: Record<string, number>;
        averageAccuracy: number;
    }>;
}
/**
 * Factory function
 */
export declare function createAIPredictiveAnalytics(env: CloudflareEnvironment, config?: Partial<PredictiveAnalyticsConfig>): AIPredictiveAnalytics;
export default AIPredictiveAnalytics;
//# sourceMappingURL=ai-predictive-analytics.d.ts.map