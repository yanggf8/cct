/**
 * Predictive Analytics Module
 * Advanced analytics for market forecasting and pattern recognition
 * Enhances institutional value with predictive capabilities
 */
import type { CloudflareEnvironment } from '../types.js';
export interface PredictiveSignals {
    timestamp: string;
    short_term_outlook: {
        direction: 'bullish' | 'bearish' | 'neutral';
        confidence: number;
        confidence_interval: {
            lower_bound: number;
            upper_bound: number;
            level: number;
        };
        probability_distribution: {
            bullish: number;
            bearish: number;
            neutral: number;
        };
        time_horizon: '1-3 days' | '1 week' | '2-4 weeks';
        key_factors: Array<{
            factor: string;
            impact: 'positive' | 'negative' | 'neutral';
            weight: number;
            description: string;
        }>;
        backtesting_reference: {
            historical_accuracy: number;
            sample_size: number;
            time_period: string;
            win_rate: number;
        };
    };
    sector_predictions: {
        top_performers: Array<{
            symbol: string;
            name: string;
            predicted_return: number;
            confidence: number;
            confidence_interval: {
                lower_bound: number;
                upper_bound: number;
                level: number;
            };
            time_horizon: string;
            rationale: string;
            risk_adjusted_return: number;
            max_drawdown_risk: number;
            supporting_factors: string[];
            historical_performance: {
                avg_return_12m: number;
                volatility: number;
                sharpe_ratio: number;
                max_drawdown: number;
            };
        }>;
        underperformers: Array<{
            symbol: string;
            name: string;
            predicted_return: number;
            confidence: number;
            confidence_interval: {
                lower_bound: number;
                upper_bound: number;
                level: number;
            };
            time_horizon: string;
            rationale: string;
            risk_adjusted_return: number;
            max_drawdown_risk: number;
            risk_factors: string[];
            historical_performance: {
                avg_return_12m: number;
                volatility: number;
                sharpe_ratio: number;
                max_drawdown: number;
            };
        }>;
    };
    regime_forecast: {
        current_regime: string;
        stability_score: number;
        probability_of_change: number;
        likely_next_regime: string;
        time_to_transition: string;
        confidence: number;
        regime_transition_matrix: {
            [regime: string]: {
                [target_regime: string]: number;
            };
        };
        historical_regime_accuracy: number;
    };
    risk_indicators: {
        volatility_outlook: 'increasing' | 'stable' | 'decreasing';
        tail_risk_probability: number;
        correlation_breakdown_risk: number;
        liquidity_stress_indicators: string[];
        stress_test_results: {
            scenario_1: {
                name: string;
                probability: number;
                impact: 'severe' | 'moderate' | 'mild';
                portfolio_impact: number;
            };
            scenario_2: {
                name: string;
                probability: number;
                impact: 'severe' | 'moderate' | 'mild';
                portfolio_impact: number;
            };
        };
        var_metrics: {
            var_95_1day: number;
            var_99_1day: number;
            cvar_95_1day: number;
            expected_shortfall: number;
        };
    };
    macro_signals: {
        fed_policy_outlook: string;
        economic_momentum: string;
        yield_curve_outlook: string;
        dollar_outlook: string;
        leading_indicators: {
            name: string;
            current_value: number;
            trend: 'improving' | 'declining' | 'stable';
            significance: 'high' | 'medium' | 'low';
            correlation_to_market: number;
        }[];
    };
}
export interface PatternAnalysis {
    timestamp: string;
    market_patterns: {
        seasonal_tendencies: Array<{
            pattern: string;
            historical_accuracy: number;
            current_relevance: string;
            expected_impact: string;
        }>;
        technical_patterns: Array<{
            pattern_name: string;
            timeframe: string;
            reliability: number;
            price_target?: number;
            confidence: number;
        }>;
        sentiment_patterns: Array<{
            pattern: string;
            current_status: string;
            historical_significance: number;
        }>;
    };
    intermarket_relationships: {
        correlations: Array<{
            asset1: string;
            asset2: string;
            correlation: number;
            trend: 'strengthening' | 'weakening' | 'stable';
            implications: string;
        }>;
        relative_strength: Array<{
            symbol: string;
            relative_strength_index: number;
            trend: 'improving' | 'declining' | 'stable';
            significance: string;
        }>;
    };
}
export interface PredictiveInsights {
    timestamp: string;
    overall_outlook: {
        market_direction: 'bullish' | 'bearish' | 'neutral';
        confidence_level: number;
        confidence_interval: {
            lower_bound: number;
            upper_bound: number;
            level: number;
        };
        scenario_analysis: {
            base_case: {
                direction: 'bullish' | 'bearish' | 'neutral';
                probability: number;
                expected_return: number;
                rationale: string;
            };
            bull_case: {
                direction: 'bullish' | 'bearish' | 'neutral';
                probability: number;
                expected_return: number;
                rationale: string;
                triggers: string[];
            };
            bear_case: {
                direction: 'bullish' | 'bearish' | 'neutral';
                probability: number;
                expected_return: number;
                rationale: string;
                triggers: string[];
            };
        };
        investment_thesis: string;
        key_catalysts: Array<{
            catalyst: string;
            impact_level: 'high' | 'medium' | 'low';
            timeframe: string;
            probability: number;
        }>;
        risk_factors: Array<{
            risk: string;
            severity: 'high' | 'medium' | 'low';
            mitigation: string;
            probability: number;
        }>;
        backtesting_performance: {
            accuracy_1m: number;
            accuracy_3m: number;
            accuracy_6m: number;
            avg_confidence_vs_accuracy: number;
            calibration_quality: number;
        };
    };
    tactical_recommendations: {
        position_sizing: {
            recommendation: string;
            risk_adjusted_sizing: {
                conservative: number;
                moderate: number;
                aggressive: number;
            };
            reasoning: string;
        };
        sector_allocation: Array<{
            sector: string;
            allocation_percentage: number;
            confidence: number;
            reasoning: string;
            risk_metrics: {
                beta: number;
                volatility: number;
                max_drawdown: number;
                correlation_to_market: number;
            };
        }>;
        hedge_suggestions: Array<{
            hedge_type: string;
            rationale: string;
            effectiveness: number;
            cost_estimate: string;
            implementation: string;
        }>;
    };
    strategic_view: {
        market_cycle_stage: string;
        cycle_confidence: number;
        long_term_outlook: string;
        major_themes: Array<{
            theme: string;
            strength: 'emerging' | 'established' | 'fading';
            time_horizon: string;
            confidence: number;
            investment_implications: string;
            related_sectors: string[];
        }>;
        macro_drivers: Array<{
            driver: string;
            current_state: string;
            expected_trajectory: 'improving' | 'stable' | 'deteriorating';
            market_impact: 'positive' | 'negative' | 'neutral';
            confidence: number;
        }>;
    };
    quantitative_factors: {
        valuation_metrics: {
            market_pe_ratio: number;
            historical_percentile: number;
            forward_pe: number;
            PEG_ratio: number;
            price_to_sales: number;
        };
        sentiment_indicators: {
            fear_greed_index: number;
            put_call_ratio: number;
            insider_trading: 'bullish' | 'bearish' | 'neutral';
            short_interest: number;
        };
        technical_signals: Array<{
            indicator: string;
            signal: 'bullish' | 'bearish' | 'neutral';
            strength: number;
            timeframe: string;
        }>;
    };
}
/**
 * Predictive Analytics Engine
 */
export declare class PredictiveAnalyticsEngine {
    private env;
    private dal;
    constructor(env: CloudflareEnvironment);
    /**
     * Generate predictive signals based on current market data
     */
    generatePredictiveSignals(): Promise<PredictiveSignals>;
    /**
     * Analyze market patterns and relationships
     */
    analyzePatterns(): Promise<PatternAnalysis>;
    /**
     * Generate comprehensive predictive insights
     */
    generatePredictiveInsights(): Promise<PredictiveInsights>;
    /**
     * Analyze short-term market outlook with enhanced confidence and probability distributions
     */
    private analyzeShortTermOutlook;
    /**
     * Generate backtesting reference data
     */
    private generateBacktestingReference;
    /**
     * Generate sector performance predictions with enhanced metrics
     */
    private generateSectorPredictions;
    /**
     * Calculate sector scoring for ranking
     */
    private calculateSectorScore;
    /**
     * Generate sector rationale
     */
    private generateSectorRationale;
    /**
     * Generate supporting factors for sectors
     */
    private generateSupportingFactors;
    /**
     * Generate risk factors for sectors
     */
    private generateRiskFactors;
    /**
     * Forecast regime transitions
     */
    private forecastRegimeTransition;
    /**
     * Assess risk indicators with stress testing and VaR metrics
     */
    private assessRiskIndicators;
    /**
     * Generate stress test scenarios
     */
    private generateStressTestResults;
    /**
     * Calculate VaR metrics
     */
    private calculateVaRMetrics;
    /**
     * Analyze macro signals with leading indicators
     */
    private analyzeMacroSignals;
    /**
     * Generate leading economic indicators
     */
    private generateLeadingIndicators;
    /**
     * Identify seasonal patterns
     */
    private identifySeasonalPatterns;
    /**
     * Identify technical patterns
     */
    private identifyTechnicalPatterns;
    /**
     * Identify sentiment patterns
     */
    private identifySentimentPatterns;
    /**
     * Analyze correlations
     */
    private analyzeCorrelations;
    /**
     * Analyze relative strength
     */
    private analyzeRelativeStrength;
    /**
     * Synthesize overall outlook with enhanced scenario analysis and confidence intervals
     */
    private synthesizeOverallOutlook;
    /**
     * Generate scenario analysis
     */
    private generateScenarioAnalysis;
    /**
     * Generate base case rationale
     */
    private generateBaseCaseRationale;
    /**
     * Generate bull case triggers
     */
    private generateBullCaseTriggers;
    /**
     * Generate bear case triggers
     */
    private generateBearCaseTriggers;
    /**
     * Generate enhanced investment thesis
     */
    private generateEnhancedInvestmentThesis;
    /**
     * Identify enhanced key catalysts
     */
    private identifyEnhancedKeyCatalysts;
    /**
     * Identify enhanced risk factors
     */
    private identifyEnhancedRiskFactors;
    /**
     * Generate backtesting performance metrics
     */
    private generateBacktestingPerformance;
    /**
     * Generate tactical recommendations with risk-adjusted sizing
     */
    private generateTacticalRecommendations;
    /**
     * Estimate sector beta
     */
    private estimateSectorBeta;
    /**
     * Estimate sector correlation to market
     */
    private estimateSectorCorrelation;
    /**
     * Generate strategic view with enhanced themes and macro drivers
     */
    private generateStrategicView;
    /**
     * Identify enhanced major themes
     */
    private identifyEnhancedMajorThemes;
    /**
     * Generate macro drivers
     */
    private generateMacroDrivers;
    /**
     * Generate quantitative factors for institutional analysis
     */
    private generateQuantitativeFactors;
    /**
     * Generate investment thesis
     */
    private generateInvestmentThesis;
    /**
     * Identify key catalysts
     */
    private identifyKeyCatalysts;
    /**
     * Identify risk factors
     */
    private identifyRiskFactors;
    /**
     * Identify major themes
     */
    private identifyMajorThemes;
}
/**
 * Generate predictive signals
 */
export declare function generatePredictiveSignals(env: CloudflareEnvironment): Promise<PredictiveSignals>;
/**
 * Analyze market patterns
 */
export declare function analyzeMarketPatterns(env: CloudflareEnvironment): Promise<PatternAnalysis>;
/**
 * Generate comprehensive predictive insights
 */
export declare function generatePredictiveInsights(env: CloudflareEnvironment): Promise<PredictiveInsights>;
//# sourceMappingURL=predictive-analytics.d.ts.map