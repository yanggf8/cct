/**
 * Market Regime Classification System
 *
 * Advanced market regime detection and classification using multiple data sources
 * from the Market Drivers system. Implements sophisticated pattern recognition
 * to identify current market conditions and predict likely future behavior.
 *
 * Features:
 * - Multi-factor regime classification (6 regime types)
 * - Confidence scoring and stability metrics
 * - Dynamic rule-based classification
 * - Historical regime tracking
 * - Regime transition analysis
 * - Sector performance guidance per regime
 *
 * @author Market Drivers Pipeline - Phase 2 Day 4
 * @since 2025-10-10
 */
import type { MacroDrivers, MarketStructure, GeopoliticalRisk, MarketRegime, MarketRegimeType } from './market-drivers.js';
/**
 * Enhanced Regime Analysis
 */
export interface EnhancedRegimeAnalysis extends MarketRegime {
    factorContributions: {
        vix: {
            score: number;
            weight: number;
            description: string;
        };
        yieldCurve: {
            score: number;
            weight: number;
            description: string;
        };
        economicGrowth: {
            score: number;
            weight: number;
            description: string;
        };
        inflation: {
            score: number;
            weight: number;
            description: string;
        };
        geopoliticalRisk: {
            score: number;
            weight: number;
            description: string;
        };
        marketMomentum: {
            score: number;
            weight: number;
            description: string;
        };
    };
    regimeStrength: {
        overall: number;
        consensus: number;
        volatility: number;
        durability: number;
    };
    transitionRisk: {
        probability: number;
        likelyNextRegimes: MarketRegimeType[];
        triggerFactors: string[];
        estimatedDuration: string;
    };
    historicalContext: {
        similarPeriods: string[];
        averageDuration: number;
        typicalTriggers: string[];
        successRate: number;
    };
    tradingImplications: {
        recommendedAllocation: {
            equities: number;
            bonds: number;
            cash: number;
            gold: number;
        };
        riskTolerance: string;
        volatilityExpectation: string;
        sectorBias: string;
    };
}
/**
 * Regime Classification Configuration
 */
interface RegimeClassificationConfig {
    factorWeights: {
        vix: number;
        yieldCurve: number;
        economicGrowth: number;
        inflation: number;
        geopoliticalRisk: number;
        marketMomentum: number;
    };
    confidenceThresholds: {
        minimum: number;
        strong: number;
        weak: number;
    };
    stabilityRequirements: {
        minimumConsensus: number;
        maximumVolatility: number;
        minimumHistory: number;
    };
}
/**
 * Market Regime Classifier Implementation
 */
export declare class MarketRegimeClassifier {
    private config;
    private regimeHistory;
    constructor(config?: Partial<RegimeClassificationConfig>);
    /**
     * Classify current market regime using all available data
     */
    classifyMarketRegime(macro: MacroDrivers, marketStructure: MarketStructure, geopolitical: GeopoliticalRisk): Promise<EnhancedRegimeAnalysis>;
    /**
     * Analyze individual factors contributing to regime classification
     */
    private analyzeFactors;
    /**
     * Analyze VIX factor (market fear/volatility)
     */
    private analyzeVIXFactor;
    /**
     * Analyze yield curve factor
     */
    private analyzeYieldCurveFactor;
    /**
     * Analyze economic growth factor
     */
    private analyzeEconomicGrowthFactor;
    /**
     * Analyze inflation factor
     */
    private analyzeInflationFactor;
    /**
     * Analyze geopolitical risk factor
     */
    private analyzeGeopoliticalFactor;
    /**
     * Analyze market momentum factor
     */
    private analyzeMomentumFactor;
    /**
     * Calculate regime probabilities based on factor scores
     */
    private calculateRegimeProbabilities;
    /**
     * Calculate score for a specific regime based on factor scores
     */
    private calculateRegimeScore;
    /**
     * Determine primary regime from probabilities
     */
    private determinePrimaryRegime;
    /**
     * Calculate overall confidence in classification
     */
    private calculateConfidence;
    /**
     * Calculate factor consensus
     */
    private calculateConsensus;
    /**
     * Assess regime stability
     */
    private assessStability;
    /**
     * Generate comprehensive regime analysis
     */
    private generateRegimeAnalysis;
    /**
     * Get predefined characteristics for each regime
     */
    private getRegimeCharacteristics;
    /**
     * Calculate transition risk
     */
    private calculateTransitionRisk;
    /**
     * Get historical context for current regime
     */
    private getHistoricalContext;
    /**
     * Generate trading implications
     */
    private generateTradingImplications;
    private calculateFactorVariance;
    private calculateDistanceFromNeutral;
    private determineRiskLevel;
    private calculateDurabilityScore;
    private identifyTriggerFactors;
    private estimateRegimeDuration;
    private storeRegimeHistory;
    private getDefaultRegimeAnalysis;
    /**
     * Get regime classification history
     */
    getRegimeHistory(): Array<{
        regime: MarketRegimeType;
        timestamp: number;
        confidence: number;
        drivers: any;
    }>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
/**
 * Initialize Market Regime Classifier
 */
export declare function initializeMarketRegimeClassifier(config?: Partial<RegimeClassificationConfig>): MarketRegimeClassifier;
export default MarketRegimeClassifier;
//# sourceMappingURL=market-regime-classifier.d.ts.map