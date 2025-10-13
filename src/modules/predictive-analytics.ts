/**
 * Predictive Analytics Module
 * Advanced analytics for market forecasting and pattern recognition
 * Enhances institutional value with predictive capabilities
 */

import { createLogger } from './logging.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
import { initializeMarketDrivers } from './market-drivers.js';
import { getCachedSectorRotationResults } from './sector-rotation-workflow.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('predictive-analytics');

export interface PredictiveSignals {
  timestamp: string;
  short_term_outlook: {
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    time_horizon: '1-3 days' | '1 week' | '2-4 weeks';
    key_factors: string[];
  };
  sector_predictions: {
    top_performers: Array<{
      symbol: string;
      name: string;
      predicted_return: number;
      confidence: number;
      time_horizon: string;
      rationale: string;
    }>;
    underperformers: Array<{
      symbol: string;
      name: string;
      predicted_return: number;
      confidence: number;
      time_horizon: string;
      rationale: string;
    }>;
  };
  regime_forecast: {
    current_regime: string;
    stability_score: number;
    probability_of_change: number;
    likely_next_regime: string;
    time_to_transition: string;
    confidence: number;
  };
  risk_indicators: {
    volatility_outlook: 'increasing' | 'stable' | 'decreasing';
    tail_risk_probability: number;
    correlation_breakdown_risk: number;
    liquidity_stress_indicators: string[];
  };
  macro_signals: {
    fed_policy_outlook: string;
    economic_momentum: string;
    yield_curve_outlook: string;
    dollar_outlook: string;
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
    investment_thesis: string;
    key_catalysts: string[];
    risk_factors: string[];
  };
  tactical_recommendations: {
    position_sizing: string;
    sector_allocation: Array<{
      sector: string;
      allocation_percentage: number;
      reasoning: string;
    }>;
    hedge_suggestions: string[];
  };
  strategic_view: {
    market_cycle_stage: string;
    long_term_outlook: string;
    major_themes: Array<{
      theme: string;
      strength: 'emerging' | 'established' | 'fading';
      time_horizon: string;
    }>;
  };
}

/**
 * Predictive Analytics Engine
 */
export class PredictiveAnalyticsEngine {
  private env: CloudflareEnvironment;
  private dal: ReturnType<typeof createSimplifiedEnhancedDAL>;

  constructor(env: CloudflareEnvironment) {
    this.env = env;
    this.dal = createSimplifiedEnhancedDAL(env, {
      enableCache: true,
      environment: env.ENVIRONMENT || 'production'
    });
  }

  /**
   * Generate predictive signals based on current market data
   */
  async generatePredictiveSignals(): Promise<PredictiveSignals> {
    try {
      logger.info('Starting predictive signals generation');

      // Get current market data
      const marketDrivers = initializeMarketDrivers(this.env);
      const driversSnapshot = await marketDrivers.getMarketDriversSnapshot();
      const sectorRotation = await getCachedSectorRotationResults(this.env);

      // Generate predictive components
      const shortTermOutlook = this.analyzeShortTermOutlook(driversSnapshot, sectorRotation);
      const sectorPredictions = this.generateSectorPredictions(sectorRotation, driversSnapshot);
      const regimeForecast = this.forecastRegimeTransition(driversSnapshot, sectorRotation);
      const riskIndicators = this.assessRiskIndicators(driversSnapshot, sectorRotation);
      const macroSignals = this.analyzeMacroSignals(driversSnapshot);

      const signals: PredictiveSignals = {
        timestamp: new Date().toISOString(),
        short_term_outlook: shortTermOutlook,
        sector_predictions: sectorPredictions,
        regime_forecast: regimeForecast,
        risk_indicators: riskIndicators,
        macro_signals: macroSignals
      };

      logger.info('Predictive signals generated', {
        outlook: shortTermOutlook.direction,
        confidence: shortTermOutlook.confidence,
        regimeStability: regimeForecast.stability_score
      });

      return signals;

    } catch (error: any) {
      logger.error('Failed to generate predictive signals', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Analyze market patterns and relationships
   */
  async analyzePatterns(): Promise<PatternAnalysis> {
    try {
      logger.info('Starting pattern analysis');

      const marketDrivers = initializeMarketDrivers(this.env);
      const driversSnapshot = await marketDrivers.getMarketDriversSnapshot();
      const sectorRotation = await getCachedSectorRotationResults(this.env);

      const seasonalTendencies = this.identifySeasonalPatterns();
      const technicalPatterns = this.identifyTechnicalPatterns(sectorRotation);
      const sentimentPatterns = this.identifySentimentPatterns(driversSnapshot);
      const correlations = this.analyzeCorrelations(driversSnapshot, sectorRotation);
      const relativeStrength = this.analyzeRelativeStrength(sectorRotation);

      const analysis: PatternAnalysis = {
        timestamp: new Date().toISOString(),
        market_patterns: {
          seasonal_tendencies: seasonalTendencies,
          technical_patterns: technicalPatterns,
          sentiment_patterns: sentimentPatterns
        },
        intermarket_relationships: {
          correlations,
          relative_strength: relativeStrength
        }
      };

      logger.info('Pattern analysis completed', {
        patternsIdentified: seasonalTendencies.length + technicalPatterns.length,
        correlationsAnalyzed: correlations.length
      });

      return analysis;

    } catch (error: any) {
      logger.error('Failed to analyze patterns', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate comprehensive predictive insights
   */
  async generatePredictiveInsights(): Promise<PredictiveInsights> {
    try {
      logger.info('Starting comprehensive predictive insights generation');

      const signals = await this.generatePredictiveSignals();
      const patterns = await this.analyzePatterns();

      const overallOutlook = this.synthesizeOverallOutlook(signals, patterns);
      const tacticalRecommendations = this.generateTacticalRecommendations(signals, patterns);
      const strategicView = this.generateStrategicView(signals, patterns);

      const insights: PredictiveInsights = {
        timestamp: new Date().toISOString(),
        overall_outlook: overallOutlook,
        tactical_recommendations: tacticalRecommendations,
        strategic_view: strategicView
      };

      logger.info('Predictive insights generated', {
        outlook: overallOutlook.market_direction,
        confidence: overallOutlook.confidence_level
      });

      return insights;

    } catch (error: any) {
      logger.error('Failed to generate predictive insights', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Analyze short-term market outlook
   */
  private analyzeShortTermOutlook(driversSnapshot: any, sectorRotation: any): PredictiveSignals['short_term_outlook'] {
    const vix = driversSnapshot.marketStructure.vix;
    const riskOnRiskOff = driversSnapshot.riskOnRiskOff;
    const confidence = driversSnapshot.regime.confidence;

    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let outlookConfidence = 0.5;
    let timeHorizon: '1-3 days' | '1 week' | '2-4 weeks' = '1 week';
    const keyFactors: string[] = [];

    // Analyze volatility trends
    if (vix < 18 && riskOnRiskOff === 'risk_on') {
      direction = 'bullish';
      outlookConfidence = Math.min(0.8, confidence / 100 + 0.2);
      keyFactors.push('Low volatility environment');
      keyFactors.push('Risk-on sentiment');
      timeHorizon = '1-3 days';
    } else if (vix > 25 || riskOnRiskOff === 'risk_off') {
      direction = 'bearish';
      outlookConfidence = Math.min(0.8, (100 - confidence) / 100 + 0.2);
      keyFactors.push('Elevated volatility');
      keyFactors.push('Risk-off sentiment');
      timeHorizon = '2-4 weeks';
    } else {
      direction = 'neutral';
      outlookConfidence = 0.5;
      keyFactors.push('Mixed market signals');
      timeHorizon = '1 week';
    }

    // Consider sector rotation data
    if (sectorRotation) {
      const leadingSectorPerf = sectorRotation.etfAnalyses.find(
        etf => etf.symbol === sectorRotation.rotationSignals.leadingSector
      )?.performanceMetrics.daily || 0;

      if (leadingSectorPerf > 1.5 && direction === 'neutral') {
        direction = 'bullish';
        outlookConfidence += 0.1;
        keyFactors.push('Strong sector leadership');
      } else if (leadingSectorPerf < -1.5 && direction === 'neutral') {
        direction = 'bearish';
        outlookConfidence += 0.1;
        keyFactors.push('Weak sector performance');
      }
    }

    return {
      direction,
      confidence: Math.min(0.9, outlookConfidence),
      time_horizon: timeHorizon,
      key_factors: keyFactors
    };
  }

  /**
   * Generate sector performance predictions
   */
  private generateSectorPredictions(sectorRotation: any, driversSnapshot: any): PredictiveSignals['sector_predictions'] {
    if (!sectorRotation) {
      return {
        top_performers: [],
        underperformers: []
      };
    }

    const favoredSectors = driversSnapshot.regime.favoredSectors || [];
    const avoidedSectors = driversSnapshot.regime.avoidedSectors || [];

    // Predict top performers
    const topPerformers = sectorRotation.etfAnalyses
      .filter(etf => {
        const isFavored = favoredSectors.some(favored =>
          etf.name.toLowerCase().includes(favored.toLowerCase())
        );
        const positiveMomentum = etf.performanceMetrics.daily > -0.5;
        const positiveSentiment = etf.sentiment.overall !== 'bearish';

        return isFavored && positiveMomentum && positiveSentiment;
      })
      .sort((a, b) => b.performanceMetrics.daily - a.performanceMetrics.daily)
      .slice(0, 3)
      .map(etf => ({
        symbol: etf.symbol,
        name: etf.name,
        predicted_return: Math.max(0.5, etf.performanceMetrics.daily * 1.5),
        confidence: 0.65 + (etf.performanceMetrics.daily > 0 ? 0.15 : 0),
        time_horizon: '2-4 weeks',
        rationale: `Aligned with ${driversSnapshot.regime.currentRegime} regime, current momentum: ${etf.performanceMetrics.daily.toFixed(2)}%`
      }));

    // Predict underperformers
    const underperformers = sectorRotation.etfAnalyses
      .filter(etf => {
        const isAvoided = avoidedSectors.some(avoided =>
          etf.name.toLowerCase().includes(avoided.toLowerCase())
        );
        const negativeMomentum = etf.performanceMetrics.daily < -0.5;
        const bearishSentiment = etf.sentiment.overall === 'bearish';

        return isAvoided || (negativeMomentum && bearishSentiment);
      })
      .sort((a, b) => a.performanceMetrics.daily - b.performanceMetrics.daily)
      .slice(0, 2)
      .map(etf => ({
        symbol: etf.symbol,
        name: etf.name,
        predicted_return: Math.min(-0.5, etf.performanceMetrics.daily * 1.2),
        confidence: 0.6 + (etf.sentiment.overall === 'bearish' ? 0.2 : 0),
        time_horizon: '2-4 weeks',
        rationale: `Out of favor in current ${driversSnapshot.regime.currentRegime} regime, weak momentum: ${etf.performanceMetrics.daily.toFixed(2)}%`
      }));

    return {
      top_performers: topPerformers,
      underperformers: underperformers
    };
  }

  /**
   * Forecast regime transitions
   */
  private forecastRegimeTransition(driversSnapshot: any, sectorRotation: any): PredictiveSignals['regime_forecast'] {
    const currentRegime = driversSnapshot.regime.currentRegime;
    const confidence = driversSnapshot.regime.confidence;
    const riskLevel = driversSnapshot.regime.riskLevel;
    const vix = driversSnapshot.marketStructure.vix;

    // Calculate stability score
    let stabilityScore = confidence / 100;

    if (vix > 30) stabilityScore -= 0.2;
    else if (vix < 15) stabilityScore += 0.1;

    if (riskLevel === 'high') stabilityScore -= 0.15;
    else if (riskLevel === 'low') stabilityScore += 0.1;

    stabilityScore = Math.max(0, Math.min(1, stabilityScore));

    // Determine probability of change
    const probabilityOfChange = (1 - stabilityScore) * 0.8;

    // Predict likely next regime
    let likelyNextRegime = currentRegime;
    let timeToTransition = '3-6 months';

    if (currentRegime === 'transitioning') {
      if (riskLevel === 'low' && vix < 20) {
        likelyNextRegime = 'bullish_expansion';
        timeToTransition = '1-2 months';
      } else if (riskLevel === 'high' || vix > 25) {
        likelyNextRegime = 'risk_off';
        timeToTransition = '1-3 months';
      }
    } else if (currentRegime.includes('bullish') && vix > 25) {
      likelyNextRegime = 'transitioning';
      timeToTransition = '2-4 months';
    } else if (currentRegime.includes('bearish') && vix < 18) {
      likelyNextRegime = 'transitioning';
      timeToTransition = '2-4 months';
    }

    return {
      current_regime: currentRegime,
      stability_score: Math.round(stabilityScore * 100) / 100,
      probability_of_change: Math.round(probabilityOfChange * 100) / 100,
      likely_next_regime: likelyNextRegime,
      time_to_transition: timeToTransition,
      confidence: Math.round((confidence / 100) * 100) / 100
    };
  }

  /**
   * Assess risk indicators
   */
  private assessRiskIndicators(driversSnapshot: any, sectorRotation: any): PredictiveSignals['risk_indicators'] {
    const vix = driversSnapshot.marketStructure.vix;
    const vixTrend = driversSnapshot.marketStructure.vix > 25 ? 'increasing' : 'stable';
    const geopoliticalRisk = driversSnapshot.geopolitical.overallRiskScore;
    const yieldCurveSpread = driversSnapshot.macro.yieldCurveSpread;

    // Calculate tail risk probability
    let tailRiskProbability = 0.1; // Base probability

    if (vix > 30) tailRiskProbability += 0.3;
    else if (vix > 25) tailRiskProbability += 0.2;
    else if (vix > 20) tailRiskProbability += 0.1;

    if (yieldCurveSpread < -0.5) tailRiskProbability += 0.2;
    else if (yieldCurveSpread < 0) tailRiskProbability += 0.1;

    if (geopoliticalRisk > 0.7) tailRiskProbability += 0.15;
    else if (geopoliticalRisk > 0.5) tailRiskProbability += 0.1;

    tailRiskProbability = Math.min(0.8, tailRiskProbability);

    // Calculate correlation breakdown risk
    let correlationBreakdownRisk = 0.05;

    if (vix > 35) correlationBreakdownRisk += 0.4;
    else if (vix > 28) correlationBreakdownRisk += 0.2;
    else if (vix > 22) correlationBreakdownRisk += 0.1;

    if (driversSnapshot.regime.currentRegime === 'transitioning') {
      correlationBreakdownRisk += 0.1;
    }

    correlationBreakdownRisk = Math.min(0.6, correlationBreakdownRisk);

    // Identify liquidity stress indicators
    const liquidityStressIndicators: string[] = [];

    if (vix > 30) liquidityStressIndicators.push('Elevated VIX indicating stress');
    if (yieldCurveSpread < -0.5) liquidityStressIndicators.push('Inverted yield curve stress');
    if (geopoliticalRisk > 0.7) liquidityStressIndicators.push('High geopolitical risk');

    if (sectorRotation) {
      const decliningSectors = sectorRotation.rotationSignals.decliningSectors?.length || 0;
      if (decliningSectors > 5) {
        liquidityStressIndicators.push('Broad sector weakness');
      }
    }

    return {
      volatility_outlook: vixTrend as 'increasing' | 'stable' | 'decreasing',
      tail_risk_probability: Math.round(tailRiskProbability * 100) / 100,
      correlation_breakdown_risk: Math.round(correlationBreakdownRisk * 100) / 100,
      liquidity_stress_indicators: liquidityStressIndicators
    };
  }

  /**
   * Analyze macro signals
   */
  private analyzeMacroSignals(driversSnapshot: any): PredictiveSignals['macro_signals'] {
    const fedFundsRate = driversSnapshot.macro.fedFundsRate;
    const unemploymentRate = driversSnapshot.macro.unemploymentRate;
    const inflationRate = driversSnapshot.macro.inflationRate;
    const yieldCurveSpread = driversSnapshot.macro.yieldCurveSpread;
    const dollarTrend = driversSnapshot.marketStructure.dollarTrend;

    // Fed policy outlook
    let fedPolicyOutlook = 'Neutral';
    if (inflationRate > 3 && fedFundsRate < 5) {
      fedPolicyOutlook = 'Hawkish (rate hikes likely)';
    } else if (unemploymentRate > 5 && fedFundsRate > 3) {
      fedPolicyOutlook = 'Dovish (rate cuts likely)';
    } else if (yieldCurveSpread < -0.5) {
      fedPolicyOutlook = 'Policy response to recession risk';
    }

    // Economic momentum
    let economicMomentum = 'Moderate';
    if (yieldCurveSpread > 0.5 && unemploymentRate < 4) {
      economicMomentum = 'Strong';
    } else if (yieldCurveSpread < -0.5 || unemploymentRate > 5) {
      economicMomentum = 'Weakening';
    }

    // Yield curve outlook
    let yieldCurveOutlook = 'Stable flattening';
    if (yieldCurveSpread < -1) {
      yieldCurveOutlook = 'Deep inversion persistence';
    } else if (yieldCurveSpread > 1) {
      yieldCurveOutlook = 'Steepening trend';
    }

    // Dollar outlook
    let dollarOutlook = dollarTrend;
    if (fedPolicyOutlook.includes('Hawkish')) {
      dollarOutlook += ' (rate hike support)';
    } else if (fedPolicyOutlook.includes('Dovish')) {
      dollarOutlook += ' (rate cut pressure)';
    }

    return {
      fed_policy_outlook: fedPolicyOutlook,
      economic_momentum: economicMomentum,
      yield_curve_outlook: yieldCurveOutlook,
      dollar_outlook: dollarOutlook
    };
  }

  /**
   * Identify seasonal patterns
   */
  private identifySeasonalPatterns(): PatternAnalysis['market_patterns']['seasonal_tendencies'] {
    const currentMonth = new Date().getMonth();
    const patterns = [];

    // December: Santa Claus Rally
    if (currentMonth === 11) {
      patterns.push({
        pattern: 'Santa Claus Rally',
        historical_accuracy: 0.75,
        current_relevance: 'Entering typical period',
        expected_impact: 'Positive market bias through year-end'
      });
    }

    // January: January Effect
    if (currentMonth === 0) {
      patterns.push({
        pattern: 'January Effect',
        historical_accuracy: 0.70,
        current_relevance: 'Small-cap strength typical',
        expected_impact: 'Positive bias, especially in smaller companies'
      });
    }

    // September: Historical weakness
    if (currentMonth === 8) {
      patterns.push({
        pattern: 'September Weakness',
        historical_accuracy: 0.80,
        current_relevance: 'Historically worst month',
        expected_impact: 'Increased volatility, negative bias'
      });
    }

    // Summer months: Lower volume
    if (currentMonth >= 5 && currentMonth <= 7) {
      patterns.push({
        pattern: 'Summer Doldrums',
        historical_accuracy: 0.65,
        current_relevance: 'Lower trading volume period',
        expected_impact: 'Reduced liquidity, potential for exaggerated moves'
      });
    }

    return patterns;
  }

  /**
   * Identify technical patterns
   */
  private identifyTechnicalPatterns(sectorRotation: any): PatternAnalysis['market_patterns']['technical_patterns'] {
    const patterns = [];

    if (!sectorRotation) return patterns;

    sectorRotation.etfAnalyses.forEach(etf => {
      const rsi = etf.technicalIndicators?.rsi;
      const trend = etf.technicalIndicators?.trend;
      const ma50 = etf.technicalIndicators?.movingAvg50;
      const ma200 = etf.technicalIndicators?.movingAvg200;

      if (rsi) {
        if (rsi < 30) {
          patterns.push({
            pattern_name: `${etf.symbol} Oversold`,
            timeframe: 'Daily',
            reliability: 0.70,
            confidence: 0.75,
            price_target: undefined
          });
        } else if (rsi > 70) {
          patterns.push({
            pattern_name: `${etf.symbol} Overbought`,
            timeframe: 'Daily',
            reliability: 0.70,
            confidence: 0.75,
            price_target: undefined
          });
        }
      }

      if (ma50 && ma200 && ma50 > ma200 && trend === 'uptrend') {
        patterns.push({
          pattern_name: `${etf.symbol} Golden Cross`,
          timeframe: 'Daily',
          reliability: 0.75,
          confidence: 0.80,
          price_target: undefined
        });
      } else if (ma50 && ma200 && ma50 < ma200 && trend === 'downtrend') {
        patterns.push({
          pattern_name: `${etf.symbol} Death Cross`,
          timeframe: 'Daily',
          reliability: 0.75,
          confidence: 0.80,
          price_target: undefined
        });
      }
    });

    return patterns;
  }

  /**
   * Identify sentiment patterns
   */
  private identifySentimentPatterns(driversSnapshot: any): PatternAnalysis['market_patterns']['sentiment_patterns'] {
    const patterns = [];

    const riskOnRiskOff = driversSnapshot.riskOnRiskOff;
    const vix = driversSnapshot.marketStructure.vix;

    if (riskOnRiskOff === 'risk_on' && vix < 20) {
      patterns.push({
        pattern: 'Risk-On with Low Volatility',
        current_status: 'Active',
        historical_significance: 0.85
      });
    } else if (riskOnRiskOff === 'risk_off' && vix > 25) {
      patterns.push({
        pattern: 'Risk-Aversion with High Volatility',
        current_status: 'Active',
        historical_significance: 0.80
      });
    }

    const confidence = driversSnapshot.regime.confidence;
    if (confidence > 80) {
      patterns.push({
        pattern: 'High Regime Confidence',
        current_status: 'Active',
        historical_significance: 0.75
      });
    } else if (confidence < 50) {
      patterns.push({
        pattern: 'Low Regime Confidence',
        current_status: 'Active',
        historical_significance: 0.70
      });
    }

    return patterns;
  }

  /**
   * Analyze correlations
   */
  private analyzeCorrelations(driversSnapshot: any, sectorRotation: any): PatternAnalysis['intermarket_relationships']['correlations'] {
    const correlations = [];

    // VIX vs S&P correlation
    const vix = driversSnapshot.marketStructure.vix;
    const spy = driversSnapshot.marketStructure.spy;
    let vixSpyCorrelation = -0.7; // Typical negative correlation

    if (vix > 30) {
      vixSpyCorrelation = -0.85; // Stronger in high volatility
    } else if (vix < 15) {
      vixSpyCorrelation = -0.4; // Weaker in low volatility
    }

    correlations.push({
      asset1: 'VIX',
      asset2: 'S&P 500',
      correlation: vixSpyCorrelation,
      trend: vix > 25 ? 'strengthening' : 'stable',
      implications: vixSpyCorrelation < -0.7 ? 'Strong safe-haven demand' : 'Moderate hedging behavior'
    });

    // Dollar vs sectors correlation
    const dollarTrend = driversSnapshot.marketStructure.dollarTrend;
    if (sectorRotation) {
      const techSector = sectorRotation.etfAnalyses.find(etf => etf.symbol === 'XLK');
      const materialsSector = sectorRotation.etfAnalyses.find(etf => etf.symbol === 'XLB');

      if (techSector && materialsSector) {
        const techPerf = techSector.performanceMetrics.daily;
        const materialsPerf = materialsSector.performanceMetrics.daily;

        // Strong dollar typically helps materials, hurts tech
        let dollarTechCorrelation = dollarTrend === 'strengthening' ? -0.3 : 0.1;
        let dollarMaterialsCorrelation = dollarTrend === 'strengthening' ? 0.4 : -0.1;

        correlations.push({
          asset1: 'US Dollar',
          asset2: 'Technology (XLK)',
          correlation: dollarTechCorrelation,
          trend: dollarTrend === 'strengthening' ? 'strengthening' : 'weakening',
          implications: dollarTechCorrelation < -0.2 ? 'Strong dollar headwind for tech' : 'Minimal impact'
        });

        correlations.push({
          asset1: 'US Dollar',
          asset2: 'Materials (XLB)',
          correlation: dollarMaterialsCorrelation,
          trend: dollarTrend === 'strengthening' ? 'strengthening' : 'weakening',
          implications: dollarMaterialsCorrelation > 0.2 ? 'Strong dollar tailwind for materials' : 'Minimal impact'
        });
      }
    }

    return correlations;
  }

  /**
   * Analyze relative strength
   */
  private analyzeRelativeStrength(sectorRotation: any): PatternAnalysis['intermarket_relationships']['relative_strength'] {
    if (!sectorRotation) return [];

    const relativeStrength = sectorRotation.etfAnalyses.map(etf => {
      const performance = etf.performanceMetrics.daily;
      const volatility = etf.performanceMetrics.volatility;

      // Simple RSI calculation based on performance
      let rsi = 50 + (performance * 10); // Rough approximation
      rsi = Math.max(0, Math.min(100, rsi));

      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (performance > 1) trend = 'improving';
      else if (performance < -1) trend = 'declining';

      let significance = '';
      if (performance > 2) significance = 'Strong outperformance';
      else if (performance > 1) significance = 'Moderate outperformance';
      else if (performance < -2) significance = 'Significant underperformance';
      else if (performance < -1) significance = 'Moderate underperformance';

      return {
        symbol: etf.symbol,
        relative_strength_index: rsi,
        trend,
        significance
      };
    });

    return relativeStrength;
  }

  /**
   * Synthesize overall outlook
   */
  private synthesizeOverallOutlook(signals: PredictiveSignals, patterns: PatternAnalysis): PredictiveInsights['overall_outlook'] {
    const shortTermDirection = signals.short_term_outlook.direction;
    const regimeStability = signals.regime_forecast.stability_score;
    const tailRisk = signals.risk_indicators.tail_risk_probability;

    let marketDirection: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let confidenceLevel = 0.5;

    if (shortTermDirection === 'bullish' && regimeStability > 0.6 && tailRisk < 0.3) {
      marketDirection = 'bullish';
      confidenceLevel = 0.75;
    } else if (shortTermDirection === 'bearish' || tailRisk > 0.5) {
      marketDirection = 'bearish';
      confidenceLevel = 0.65;
    } else {
      marketDirection = 'neutral';
      confidenceLevel = 0.55;
    }

    const investmentThesis = this.generateInvestmentThesis(signals, patterns);
    const keyCatalysts = this.identifyKeyCatalysts(signals, patterns);
    const riskFactors = this.identifyRiskFactors(signals, patterns);

    return {
      market_direction: marketDirection,
      confidence_level: confidenceLevel,
      investment_thesis: investmentThesis,
      key_catalysts: keyCatalysts,
      risk_factors: riskFactors
    };
  }

  /**
   * Generate tactical recommendations
   */
  private generateTacticalRecommendations(signals: PredictiveSignals, patterns: PatternAnalysis): PredictiveInsights['tactical_recommendations'] {
    const riskLevel = signals.risk_indicators.tail_risk_probability;
    const marketDirection = signals.short_term_outlook.direction;

    let positionSizing = 'Normal';
    if (riskLevel > 0.5) {
      positionSizing = 'Conservative (reduce exposure by 20-30%)';
    } else if (marketDirection === 'bullish' && riskLevel < 0.2) {
      positionSizing = 'Aggressive (increase exposure by 15-25%)';
    }

    const sectorAllocation = (signals.sector_predictions?.top_performers || []).map(perf => ({
      sector: perf.name,
      allocation_percentage: 15 + (perf.confidence * 10),
      reasoning: perf.rationale
    }));

    const hedgeSuggestions: string[] = [];
    if (riskLevel > 0.4) {
      hedgeSuggestions.push('Consider defensive sector exposure');
    }
    if (signals.risk_indicators.volatility_outlook === 'increasing') {
      hedgeSuggestions.push('Options hedges for elevated volatility');
    }
    if (signals.regime_forecast.probability_of_change > 0.6) {
      hedgeSuggestions.push('Increased cash position during transition');
    }

    return {
      position_sizing: positionSizing,
      sector_allocation: sectorAllocation,
      hedge_suggestions: hedgeSuggestions
    };
  }

  /**
   * Generate strategic view
   */
  private generateStrategicView(signals: PredictiveSignals, patterns: PatternAnalysis): PredictiveInsights['strategic_view'] {
    const currentRegime = signals.regime_forecast.current_regime;
    const regimeStability = signals.regime_forecast.stability_score;

    let marketCycleStage = 'Mid-cycle';
    if (currentRegime.includes('bullish') && regimeStability > 0.7) {
      marketCycleStage = 'Late cycle';
    } else if (currentRegime === 'transitioning') {
      marketCycleStage = 'Cycle turning point';
    } else if (currentRegime.includes('bearish')) {
      marketCycleStage = 'Early cycle recovery';
    }

    let longTermOutlook = 'Constructive with volatility';
    if (signals.macro_signals.economic_momentum === 'Strong') {
      longTermOutlook = 'Bullish with solid fundamentals';
    } else if (signals.macro_signals.economic_momentum === 'Weakening') {
      longTermOutlook = 'Cautious with selective opportunities';
    }

    const majorThemes = this.identifyMajorThemes(signals, patterns);

    return {
      market_cycle_stage: marketCycleStage,
      long_term_outlook: longTermOutlook,
      major_themes: majorThemes
    };
  }

  /**
   * Generate investment thesis
   */
  private generateInvestmentThesis(signals: PredictiveSignals, patterns: PatternAnalysis): string {
    const regime = signals.regime_forecast.current_regime;
    const stability = signals.regime_forecast.stability_score;
    const direction = signals.short_term_outlook.direction;

    if (stability > 0.7 && direction === 'bullish') {
      return `Market in stable ${regime} regime with bullish short-term outlook. Favor growth-oriented sectors with strong momentum.`;
    } else if (stability < 0.5) {
      return `Market transitioning with low regime stability. Defensive positioning recommended with focus on quality and income.`;
    } else {
      return `Market in ${regime} regime with moderate stability. Balanced approach with selective opportunities in favored sectors.`;
    }
  }

  /**
   * Identify key catalysts
   */
  private identifyKeyCatalysts(signals: PredictiveSignals, patterns: PatternAnalysis): string[] {
    const catalysts: string[] = [];

    if (signals.macro_signals.fed_policy_outlook.includes('Dovish')) {
      catalysts.push('Potential Fed rate cuts supporting equities');
    } else if (signals.macro_signals.fed_policy_outlook.includes('Hawkish')) {
      catalysts.push('Fed rate hike cycle may pressure valuations');
    }

    if (signals.risk_indicators.volatility_outlook === 'decreasing') {
      catalysts.push('Declining volatility supports risk assets');
    }

    if (signals.sector_predictions?.top_performers?.length > 0) {
      catalysts.push(`Sector leadership from ${signals.sector_predictions.top_performers[0].name}`);
    }

    if (patterns.seasonal_tendencies?.length > 0) {
      catalysts.push(`Seasonal factors: ${patterns.seasonal_tendencies[0].pattern}`);
    }

    return catalysts;
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(signals: PredictiveSignals, patterns: PatternAnalysis): string[] {
    const risks: string[] = [];

    if (signals.risk_indicators.tail_risk_probability > 0.4) {
      risks.push('Elevated tail risk requires defensive positioning');
    }

    if (signals.regime_forecast.probability_of_change > 0.6) {
      risks.push('High probability of regime transition increases uncertainty');
    }

    if (signals.risk_indicators.correlation_breakdown_risk > 0.3) {
      risks.push('Potential correlation breakdown could affect diversification');
    }

    if (signals.macro_signals.yield_curve_outlook.includes('inversion')) {
      risks.push('Yield curve inversion signals recession risk');
    }

    if (signals.risk_indicators?.liquidity_stress_indicators?.length > 2) {
      risks.push('Multiple liquidity stress indicators detected');
    }

    return risks;
  }

  /**
   * Identify major themes
   */
  private identifyMajorThemes(signals: PredictiveSignals, patterns: PatternAnalysis): PredictiveInsights['strategic_view']['major_themes'] {
    const themes = [];

    // Technology theme
    const techSector = signals.sector_predictions.top_performers.find(p =>
      p.name.toLowerCase().includes('technology')
    );
    if (techSector) {
      themes.push({
        theme: 'Technology Leadership',
        strength: 'established',
        time_horizon: 'Long-term'
      });
    }

    // Defensive theme
    if (signals.risk_indicators.tail_risk_probability > 0.4) {
      themes.push({
        theme: 'Defensive Rotation',
        strength: 'emerging',
        time_horizon: 'Medium-term'
      });
    }

    // Rate sensitivity theme
    if (signals.macro_signals.fed_policy_outlook.includes('rate')) {
      themes.push({
        theme: 'Rate Sensitivity',
        strength: 'emerging',
        time_horizon: 'Medium-term'
      });
    }

    return themes;
  }
}

/**
 * Generate predictive signals
 */
export async function generatePredictiveSignals(env: CloudflareEnvironment): Promise<PredictiveSignals> {
  const engine = new PredictiveAnalyticsEngine(env);
  return await engine.generatePredictiveSignals();
}

/**
 * Analyze market patterns
 */
export async function analyzeMarketPatterns(env: CloudflareEnvironment): Promise<PatternAnalysis> {
  const engine = new PredictiveAnalyticsEngine(env);
  return await engine.analyzePatterns();
}

/**
 * Generate comprehensive predictive insights
 */
export async function generatePredictiveInsights(env: CloudflareEnvironment): Promise<PredictiveInsights> {
  const engine = new PredictiveAnalyticsEngine(env);
  return await engine.generatePredictiveInsights();
}