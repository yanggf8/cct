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

import { createLogger } from './logging.js';
import type {
  MacroDrivers,
  MarketStructure,
  GeopoliticalRisk,
  MarketRegime,
  MarketRegimeType,
  RegimeRule
} from './market-drivers.js';

const logger = createLogger('market-regime-classifier');

/**
 * Enhanced Regime Analysis
 */
export interface EnhancedRegimeAnalysis extends MarketRegime {
  // Factor contributions (how much each factor influenced the decision)
  factorContributions: {
    vix: { score: number; weight: number; description: string };
    yieldCurve: { score: number; weight: number; description: string };
    economicGrowth: { score: number; weight: number; description: string };
    inflation: { score: number; weight: number; description: string };
    geopoliticalRisk: { score: number; weight: number; description: string };
    marketMomentum: { score: number; weight: number; description: string };
  };

  // Regime strength indicators
  regimeStrength: {
    overall: number;              // 0-100 strength of current regime
    consensus: number;            // How consistent are the signals (0-100)
    volatility: number;           // Regime volatility score (0-100)
    durability: number;           // Expected duration confidence (0-100)
  };

  // Transition indicators
  transitionRisk: {
    probability: number;          // Probability of regime change (0-100)
    likelyNextRegimes: MarketRegimeType[]; // Most likely next regimes
    triggerFactors: string[];     // Factors that could trigger transition
    estimatedDuration: string;    // Expected remaining duration
  };

  // Historical context
  historicalContext: {
    similarPeriods: string[];     // Previous similar regime periods
    averageDuration: number;      // Historical average duration (days)
    typicalTriggers: string[];    // Typical factors that ended this regime
    successRate: number;          // Historical prediction success rate
  };

  // Trading implications
  tradingImplications: {
    recommendedAllocation: {
      equities: number;           // 0-100% allocation recommendation
      bonds: number;              // 0-100% allocation recommendation
      cash: number;               // 0-100% allocation recommendation
      gold: number;               // 0-100% allocation recommendation
    };
    riskTolerance: string;        // Current risk tolerance level
    volatilityExpectation: string; // Expected market volatility
    sectorBias: string;           // Recommended sector bias
  };
}

/**
 * Regime Classification Configuration
 */
interface RegimeClassificationConfig {
  // Factor weights (must sum to 1.0)
  factorWeights: {
    vix: number;
    yieldCurve: number;
    economicGrowth: number;
    inflation: number;
    geopoliticalRisk: number;
    marketMomentum: number;
  };

  // Confidence thresholds
  confidenceThresholds: {
    minimum: number;              // Minimum confidence to make a classification
    strong: number;               // Confidence threshold for strong classification
    weak: number;                 // Confidence threshold for weak classification
  };

  // Regime stability requirements
  stabilityRequirements: {
    minimumConsensus: number;     // Minimum factor consensus
    maximumVolatility: number;    // Maximum allowed factor disagreement
    minimumHistory: number;       // Minimum data points required
  };
}

/**
 * Market Regime Classifier Implementation
 */
export class MarketRegimeClassifier {
  private config: RegimeClassificationConfig;
  private regimeHistory: Array<{
    regime: MarketRegimeType;
    timestamp: number;
    confidence: number;
    drivers: any;
  }> = [];

  constructor(config?: Partial<RegimeClassificationConfig>) {
    // Default configuration
    this.config = {
      factorWeights: {
        vix: 0.25,                 // 25% - Market fear/volatility
        yieldCurve: 0.20,          // 20% - Economic health indicator
        economicGrowth: 0.20,      // 20% - Economic expansion/contraction
        inflation: 0.15,           // 15% - Price stability
        geopoliticalRisk: 0.10,    // 10% - External shocks
        marketMomentum: 0.10,      // 10% - Short-term trend
      },
      confidenceThresholds: {
        minimum: 40,               // 40% minimum confidence
        strong: 75,                // 75% for strong classification
        weak: 55,                  // 55% for weak classification
      },
      stabilityRequirements: {
        minimumConsensus: 60,      // 60% factor agreement
        maximumVolatility: 40,     // 40% maximum disagreement
        minimumHistory: 10,        // 10 historical data points
      },
      ...config
    };

    logger.info('Market Regime Classifier initialized', { config: this.config });
  }

  /**
   * Classify current market regime using all available data
   */
  async classifyMarketRegime(
    macro: MacroDrivers,
    marketStructure: MarketStructure,
    geopolitical: GeopoliticalRisk
  ): Promise<EnhancedRegimeAnalysis> {
    try {
      logger.info('Starting market regime classification');

      // Analyze each factor
      const factorScores = await this.analyzeFactors(macro, marketStructure, geopolitical);

      // Calculate regime probabilities
      const regimeProbabilities = this.calculateRegimeProbabilities(factorScores);

      // Determine primary regime
      const primaryRegime = this.determinePrimaryRegime(regimeProbabilities);

      // Calculate confidence and stability
      const confidence = this.calculateConfidence(regimeProbabilities, factorScores);
      const consensus = this.calculateConsensus(factorScores);
      const stability = this.assessStability(factorScores, primaryRegime);

      // Generate comprehensive regime analysis
      const analysis = await this.generateRegimeAnalysis(
        primaryRegime,
        confidence,
        factorScores,
        regimeProbabilities,
        macro,
        marketStructure,
        geopolitical
      );

      // Store in history
      this.storeRegimeHistory(analysis);

      logger.info('Market regime classification completed', {
        regime: analysis.currentRegime,
        confidence: analysis.confidence,
        stability: analysis.stabilityScore,
        consensus: consensus
      });

      return analysis;

    } catch (error: unknown) {
      logger.error('Failed to classify market regime:', { error: error instanceof Error ? error.message : String(error) });
      // Return default analysis
      return this.getDefaultRegimeAnalysis();
    }
  }

  /**
   * Analyze individual factors contributing to regime classification
   */
  private async analyzeFactors(
    macro: MacroDrivers,
    marketStructure: MarketStructure,
    geopolitical: GeopoliticalRisk
  ): Promise<EnhancedRegimeAnalysis['factorContributions']> {
    return {
      vix: await this.analyzeVIXFactor(marketStructure),
      yieldCurve: await this.analyzeYieldCurveFactor(macro, marketStructure),
      economicGrowth: await this.analyzeEconomicGrowthFactor(macro),
      inflation: await this.analyzeInflationFactor(macro),
      geopoliticalRisk: await this.analyzeGeopoliticalFactor(geopolitical),
      marketMomentum: await this.analyzeMomentumFactor(marketStructure),
    };
  }

  /**
   * Analyze VIX factor (market fear/volatility)
   */
  private async analyzeVIXFactor(marketStructure: MarketStructure): Promise<{ score: number; weight: number; description: string }> {
    const vix = marketStructure.vix.value;
    const vixPercentile = marketStructure.vixPercentile;

    let score = 50; // Neutral score
    let description = 'VIX levels are normal, indicating moderate market volatility';

    if (vix < 15) {
      score = 20; // Very low volatility = bullish
      description = `Very low VIX (${vix}) suggests complacency and potential bullish conditions`;
    } else if (vix < 20) {
      score = 30; // Low volatility = bullish-bearish neutral
      description = `Low VIX (${vix}) indicates relatively calm market conditions`;
    } else if (vix < 25) {
      score = 60; // Moderate volatility = bearish-bullish neutral
      description = `Moderate VIX (${vix}) suggests normal market volatility`;
    } else if (vix < 35) {
      score = 75; // High volatility = bearish
      description = `Elevated VIX (${vix}) indicates increased market fear and uncertainty`;
    } else {
      score = 90; // Very high volatility = strong bearish
      description = `Very high VIX (${vix}) signals significant market stress and fear`;
    }

    // Adjust based on VIX trend
    if (marketStructure.vixTrend === 'bullish') {
      score += 10;
      description += ' (rising trend increases bearish bias)';
    } else if (marketStructure.vixTrend === 'bearish') {
      score -= 10;
      description += ' (falling trend reduces bearish bias)';
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      weight: this.config.factorWeights.vix,
      description
    };
  }

  /**
   * Analyze yield curve factor
   */
  private async analyzeYieldCurveFactor(macro: MacroDrivers, marketStructure: MarketStructure): Promise<{ score: number; weight: number; description: string }> {
    const yieldSpread = macro.yieldCurveSpread.value;
    const curveStatus = marketStructure.yieldCurveStatus;

    let score = 50;
    let description = 'Yield curve shows normal term structure';

    if (curveStatus === 'inverted') {
      if (yieldSpread < -1.0) {
        score = 85; // Strongly inverted = recession signal
        description = `Strongly inverted yield curve (${yieldSpread}%) is a strong recession indicator`;
      } else {
        score = 70; // Mildly inverted = warning signal
        description = `Mildly inverted yield curve (${yieldSpread}%) suggests economic slowing`;
      }
    } else if (curveStatus === 'flattening') {
      score = 60; // Flat = uncertain/transitioning
      description = `Flat yield curve indicates uncertain economic transition period`;
    } else { // Normal
      if (yieldSpread > 1.5) {
        score = 30; // Steep = bullish
        description = `Steep yield curve (${yieldSpread}%) suggests healthy economic expansion`;
      } else {
        score = 40; // Normal = neutral-bullish
        description = `Normal yield curve (${yieldSpread}%) indicates balanced economic conditions`;
      }
    }

    return {
      score,
      weight: this.config.factorWeights.yieldCurve,
      description
    };
  }

  /**
   * Analyze economic growth factor
   */
  private async analyzeEconomicGrowthFactor(macro: MacroDrivers): Promise<{ score: number; weight: number; description: string }> {
    const gdpGrowth = macro.gdpGrowthRate.value;
    const unemployment = macro.unemploymentRate.value;
    const consumerConfidence = macro.consumerConfidence.value;

    let score = 50;
    let description = 'Economic growth indicators are mixed';

    // GDP growth component
    let gdpScore = 50;
    if (gdpGrowth > 3.0) {
      gdpScore = 20; // Strong growth = bullish
    } else if (gdpGrowth > 2.0) {
      gdpScore = 30; // Moderate growth = bullish-neutral
    } else if (gdpGrowth > 1.0) {
      gdpScore = 60; // Slow growth = bearish-neutral
    } else if (gdpGrowth > 0) {
      gdpScore = 75; // Very slow growth = bearish
    } else {
      gdpScore = 90; // Contraction = strong bearish
    }

    // Unemployment component
    let unemploymentScore = 50;
    if (unemployment < 3.5) {
      unemploymentScore = 20; // Very low unemployment = bullish
    } else if (unemployment < 4.5) {
      unemploymentScore = 30; // Low unemployment = bullish
    } else if (unemployment < 6.0) {
      unemploymentScore = 60; // Moderate unemployment = bearish-neutral
    } else {
      unemploymentScore = 80; // High unemployment = bearish
    }

    // Consumer confidence component
    let confidenceScore = 50;
    if (consumerConfidence > 100) {
      confidenceScore = 20; // Very high confidence = bullish
    } else if (consumerConfidence > 80) {
      confidenceScore = 30; // High confidence = bullish
    } else if (consumerConfidence > 60) {
      confidenceScore = 60; // Moderate confidence = bearish-neutral
    } else {
      confidenceScore = 75; // Low confidence = bearish
    }

    // Weighted average
    score = (gdpScore * 0.4) + (unemploymentScore * 0.3) + (confidenceScore * 0.3);

    description = `Economic analysis: GDP growth ${gdpGrowth}%, unemployment ${unemployment}%, consumer confidence ${consumerConfidence}`;

    return {
      score: Math.round(score),
      weight: this.config.factorWeights.economicGrowth,
      description
    };
  }

  /**
   * Analyze inflation factor
   */
  private async analyzeInflationFactor(macro: MacroDrivers): Promise<{ score: number; weight: number; description: string }> {
    const inflationRate = macro.inflationRate.value;
    const fedFundsRate = macro.fedFundsRate.value;

    let score = 50;
    let description = 'Inflation levels are moderate';

    // Inflation level assessment
    if (inflationRate < 2.0) {
      score = 35; // Low inflation = slightly bullish (Fed may be accommodative)
      description = `Low inflation (${inflationRate}%) may allow accommodative Fed policy`;
    } else if (inflationRate < 3.0) {
      score = 40; // Mild inflation = neutral
      description = `Mild inflation (${inflationRate}%) is within Fed target range`;
    } else if (inflationRate < 4.0) {
      score = 65; // Moderate inflation = slightly bearish
      description = `Moderate inflation (${inflationRate}%) may prompt tighter Fed policy`;
    } else if (inflationRate < 6.0) {
      score = 80; // High inflation = bearish
      description = `High inflation (${inflationRate}%) will likely lead to aggressive Fed tightening`;
    } else {
      score = 90; // Very high inflation = strong bearish
      description = `Very high inflation (${inflationRate}%) creates significant market headwinds`;
    }

    // Adjust for real rates
    const realRate = fedFundsRate - inflationRate;
    if (realRate < -2) {
      score += 10; // Very negative real rates support equities
      description += ' (negative real rates support equities)';
    } else if (realRate > 2) {
      score -= 10; // High real rates pressure equities
      description += ' (high real rates pressure equities)';
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      weight: this.config.factorWeights.inflation,
      description
    };
  }

  /**
   * Analyze geopolitical risk factor
   */
  private async analyzeGeopoliticalFactor(geopolitical: GeopoliticalRisk): Promise<{ score: number; weight: number; description: string }> {
    const overallRisk = geopolitical.overallRiskScore.value;
    const events = geopolitical.highImpactEvents;

    let score = 50;
    let description = 'Geopolitical risk levels are moderate';

    if (overallRisk < 0.2) {
      score = 25; // Low risk = bullish
      description = `Low geopolitical risk (${overallRisk}) creates favorable market conditions`;
    } else if (overallRisk < 0.4) {
      score = 45; // Moderate-low risk = neutral-bullish
      description = `Moderate geopolitical risk (${overallRisk}) is manageable for markets`;
    } else if (overallRisk < 0.6) {
      score = 65; // Moderate-high risk = neutral-bearish
      description = `Elevated geopolitical risk (${overallRisk}) increases market uncertainty`;
    } else {
      score = 85; // High risk = bearish
      description = `High geopolitical risk (${overallRisk}) creates significant market headwinds`;
    }

    // Adjust for high-impact events
    if (events > 5) {
      score += 15;
      description += ` (${events} high-impact events escalate concerns)`;
    } else if (events > 2) {
      score += 5;
      description += ` (${events} high-impact events add to concerns)`;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      weight: this.config.factorWeights.geopoliticalRisk,
      description
    };
  }

  /**
   * Analyze market momentum factor
   */
  private async analyzeMomentumFactor(marketStructure: MarketStructure): Promise<{ score: number; weight: number; description: string }> {
    const spyTrend = marketStructure.spyTrend;
    const dollarTrend = marketStructure.dollarTrend;
    const spy = marketStructure.spy;

    let score = 50;
    let description = 'Market momentum is mixed';

    // S&P 500 trend component
    let momentumScore = 50;
    if (spyTrend === 'bullish') {
      momentumScore = 25; // Bullish = lower score (less bearish)
      description = `S&P 500 showing bullish trend supports positive momentum`;
    } else if (spyTrend === 'bearish') {
      momentumScore = 75; // Bearish = higher score (more bearish)
      description = `S&P 500 showing bearish trend indicates negative momentum`;
    } else {
      description = `S&P 500 trend is neutral, indicating uncertain momentum`;
    }

    // Dollar strength impact (inverse correlation with equities)
    if (dollarTrend === 'bullish') {
      momentumScore += 10;
      description += '; strengthening dollar adds headwinds';
    } else if (dollarTrend === 'bearish') {
      momentumScore -= 10;
      description += '; weakening dollar provides tailwinds';
    }

    score = Math.max(0, Math.min(100, momentumScore));

    return {
      score,
      weight: this.config.factorWeights.marketMomentum,
      description
    };
  }

  /**
   * Calculate regime probabilities based on factor scores
   */
  private calculateRegimeProbabilities(factorScores: EnhancedRegimeAnalysis['factorContributions']): Record<MarketRegimeType, number> {
    const regimes: MarketRegimeType[] = [
      'bullish_expansion',
      'bearish_contraction',
      'stagflation',
      'goldilocks',
      'risk_off',
      'risk_on',
      'transitioning',
      'uncertain'
    ];

    const probabilities: Record<MarketRegimeType, number> = {} as any;

    for (const regime of regimes) {
      probabilities[regime] = this.calculateRegimeScore(regime, factorScores);
    }

    // Normalize probabilities to sum to 100
    const total = Object.values(probabilities).reduce((sum: any, prob: any) => sum + prob, 0);
    if (total > 0) {
      for (const regime of regimes) {
        probabilities[regime] = (probabilities[regime] / total) * 100;
      }
    }

    return probabilities;
  }

  /**
   * Calculate score for a specific regime based on factor scores
   */
  private calculateRegimeScore(regime: MarketRegimeType, factorScores: EnhancedRegimeAnalysis['factorContributions']): number {
    let score = 0;

    switch (regime) {
      case 'bullish_expansion':
        // Low VIX, steep yield curve, strong growth, moderate inflation
        score += (100 - factorScores.vix.score) * factorScores.vix.weight * 2;
        score += (100 - factorScores.yieldCurve.score) * factorScores.yieldCurve.weight * 1.5;
        score += (100 - factorScores.economicGrowth.score) * factorScores.economicGrowth.weight * 2;
        score += (100 - factorScores.inflation.score) * factorScores.inflation.weight * 1.2;
        score += (100 - factorScores.geopoliticalRisk.score) * factorScores.geopoliticalRisk.weight * 1.5;
        score += (100 - factorScores.marketMomentum.score) * factorScores.marketMomentum.weight * 1.8;
        break;

      case 'bearish_contraction':
        // High VIX, inverted yield curve, weak growth, any inflation
        score += factorScores.vix.score * factorScores.vix.weight * 2;
        score += factorScores.yieldCurve.score * factorScores.yieldCurve.weight * 2;
        score += factorScores.economicGrowth.score * factorScores.economicGrowth.weight * 1.8;
        score += factorScores.inflation.score * factorScores.inflation.weight * 1.2;
        score += factorScores.geopoliticalRisk.score * factorScores.geopoliticalRisk.weight * 1.5;
        score += factorScores.marketMomentum.score * factorScores.marketMomentum.weight * 1.5;
        break;

      case 'stagflation':
        // High inflation + weak growth, moderate-high VIX
        score += factorScores.inflation.score * factorScores.inflation.weight * 2.5;
        score += factorScores.economicGrowth.score * factorScores.economicGrowth.weight * 2;
        score += factorScores.vix.score * factorScores.vix.weight * 1.5;
        score += (100 - factorScores.yieldCurve.score) * factorScores.yieldCurve.weight * 0.8;
        break;

      case 'goldilocks':
        // Low inflation, moderate growth, low VIX, normal yield curve
        score += Math.abs(50 - factorScores.inflation.score) * factorScores.inflation.weight * 2;
        score += Math.abs(40 - factorScores.economicGrowth.score) * factorScores.economicGrowth.weight * 2;
        score += Math.abs(30 - factorScores.vix.score) * factorScores.vix.weight * 1.5;
        score += Math.abs(40 - factorScores.yieldCurve.score) * factorScores.yieldCurve.weight * 1.5;
        break;

      case 'risk_off':
        // High VIX, high geopolitical risk, weak momentum
        score += factorScores.vix.score * factorScores.vix.weight * 2.5;
        score += factorScores.geopoliticalRisk.score * factorScores.geopoliticalRisk.weight * 2;
        score += factorScores.marketMomentum.score * factorScores.marketMomentum.weight * 1.8;
        break;

      case 'risk_on':
        // Low VIX, low geopolitical risk, strong momentum
        score += (100 - factorScores.vix.score) * factorScores.vix.weight * 2;
        score += (100 - factorScores.geopoliticalRisk.score) * factorScores.geopoliticalRisk.weight * 1.8;
        score += (100 - factorScores.marketMomentum.score) * factorScores.marketMomentum.weight * 2;
        break;

      case 'transitioning':
        // Mixed signals across factors
        const variance = this.calculateFactorVariance(factorScores);
        score += variance * 2; // High variance = transition
        break;

      case 'uncertain':
        // All factors near neutral
        const distanceFromNeutral = this.calculateDistanceFromNeutral(factorScores);
        score = Math.max(0, 100 - distanceFromNeutral);
        break;
    }

    return score;
  }

  /**
   * Determine primary regime from probabilities
   */
  private determinePrimaryRegime(probabilities: Record<MarketRegimeType, number>): MarketRegimeType {
    let maxProbability = 0;
    let primaryRegime: MarketRegimeType = 'uncertain';

    for (const [regime, probability] of Object.entries(probabilities)) {
      if (probability > maxProbability) {
        maxProbability = probability;
        primaryRegime = regime as MarketRegimeType;
      }
    }

    return primaryRegime;
  }

  /**
   * Calculate overall confidence in classification
   */
  private calculateConfidence(
    probabilities: Record<MarketRegimeType, number>,
    factorScores: EnhancedRegimeAnalysis['factorContributions']
  ): number {
    // Confidence based on:
    // 1. Gap between top two regimes
    const sortedProbs = Object.entries(probabilities).sort(([, a], [, b]) => b - a);
    const topGap = sortedProbs[0][1] - (sortedProbs[1]?.[1] || 0);

    // 2. Consensus among factors (lower variance = higher confidence)
    const factorVariance = this.calculateFactorVariance(factorScores);
    const consensusScore = Math.max(0, 100 - factorVariance);

    // 3. Overall probability magnitude
    const maxProbability = sortedProbs[0][1];

    // Weighted confidence calculation
    const confidence = (topGap * 0.4) + (consensusScore * 0.3) + (maxProbability * 0.3);

    return Math.round(Math.max(this.config.confidenceThresholds.minimum, Math.min(100, confidence)));
  }

  /**
   * Calculate factor consensus
   */
  private calculateConsensus(factorScores: EnhancedRegimeAnalysis['factorContributions']): number {
    const scores = Object.values(factorScores).map(factor => factor.score);
    const mean = scores.reduce((sum: any, score: any) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum: any, score: any) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);

    // Convert standard deviation to consensus (lower deviation = higher consensus)
    return Math.max(0, Math.min(100, 100 - (standardDeviation * 2)));
  }

  /**
   * Assess regime stability
   */
  private assessStability(
    factorScores: EnhancedRegimeAnalysis['factorContributions'],
    primaryRegime: MarketRegimeType
  ): number {
    let stability = 50; // Base stability

    // Factor consensus contributes to stability
    const consensus = this.calculateConsensus(factorScores);
    stability += (consensus - 50) * 0.5;

    // Historical consistency
    const recentHistory = this.regimeHistory.slice(-5);
    if (recentHistory.length > 0) {
      const recentConsensus = recentHistory.filter(h => h.regime === primaryRegime).length / recentHistory.length;
      stability += (recentConsensus - 0.5) * 100;
    }

    return Math.round(Math.max(0, Math.min(100, stability)));
  }

  /**
   * Generate comprehensive regime analysis
   */
  private async generateRegimeAnalysis(
    regime: MarketRegimeType,
    confidence: number,
    factorScores: EnhancedRegimeAnalysis['factorContributions'],
    probabilities: Record<MarketRegimeType, number>,
    macro: MacroDrivers,
    marketStructure: MarketStructure,
    geopolitical: GeopoliticalRisk
  ): Promise<EnhancedRegimeAnalysis> {
    const stability = this.assessStability(factorScores, regime);
    const consensus = this.calculateConsensus(factorScores);

    // Determine regime characteristics
    const regimeCharacteristics = this.getRegimeCharacteristics(regime);

    // Calculate transition risk
    const transitionRisk = this.calculateTransitionRisk(regime, factorScores, probabilities);

    // Get historical context
    const historicalContext = this.getHistoricalContext(regime);

    // Generate trading implications
    const tradingImplications = this.generateTradingImplications(regime, factorScores);

    return {
      currentRegime: regime,
      confidence,
      riskLevel: this.determineRiskLevel(regime, confidence),
      description: regimeCharacteristics.description,
      favoredSectors: regimeCharacteristics.favoredSectors,
      avoidedSectors: regimeCharacteristics.avoidedSectors,
      strategy: regimeCharacteristics.strategy,
      positionSizing: regimeCharacteristics.positionSizing,
      duration: regimeCharacteristics.duration,
      previousRegime: this.regimeHistory.length > 0 ? this.regimeHistory[this.regimeHistory.length - 1].regime : 'uncertain',
      regimeChangeDate: this.regimeHistory.length > 0 ?
        (function() {
          try {
            const date = new Date(this.regimeHistory[this.regimeHistory.length - 1].timestamp);
            return isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0];
          } catch {
            return new Date().toISOString().split('T')[0];
          }
        }).call(this) :
        new Date().toISOString().split('T')[0],
      stabilityScore: stability,
      lastUpdated: new Date().toISOString(),
      factorContributions: factorScores,
      regimeStrength: {
        overall: confidence,
        consensus: consensus,
        volatility: Math.round(this.calculateFactorVariance(factorScores)),
        durability: Math.round(this.calculateDurabilityScore(regime, stability, consensus))
      },
      transitionRisk,
      historicalContext,
      tradingImplications
    };
  }

  /**
   * Get predefined characteristics for each regime
   */
  private getRegimeCharacteristics(regime: MarketRegimeType) {
    const characteristics = {
      bullish_expansion: {
        description: 'Strong economic expansion with rising corporate earnings and investor confidence',
        favoredSectors: ['Technology', 'Consumer Discretionary', 'Financials', 'Industrials'],
        avoidedSectors: ['Utilities', 'Consumer Staples', 'Healthcare'],
        strategy: 'Growth-oriented with emphasis on cyclical sectors',
        positionSizing: 'Moderate to aggressive',
        duration: '12-24 months'
      },
      bearish_contraction: {
        description: 'Economic contraction with declining earnings and rising investor fear',
        favoredSectors: ['Utilities', 'Consumer Staples', 'Healthcare', 'Gold'],
        avoidedSectors: ['Technology', 'Consumer Discretionary', 'Financials'],
        strategy: 'Capital preservation with defensive sector focus',
        positionSizing: 'Conservative',
        duration: '6-18 months'
      },
      stagflation: {
        description: 'High inflation with weak economic growth creating difficult market conditions',
        favoredSectors: ['Energy', 'Materials', 'Gold', 'Real Estate'],
        avoidedSectors: ['Technology', 'Consumer Discretionary', 'Financials'],
        strategy: 'Inflation protection with selective growth opportunities',
        positionSizing: 'Conservative to moderate',
        duration: '12-36 months'
      },
      goldilocks: {
        description: 'Ideal conditions with moderate growth, low inflation, and stable markets',
        favoredSectors: ['Technology', 'Healthcare', 'Consumer Discretionary', 'Industrials'],
        avoidedSectors: ['Utilities', 'Energy'],
        strategy: 'Balanced growth with quality focus',
        positionSizing: 'Moderate',
        duration: '18-36 months'
      },
      risk_off: {
        description: 'Market flight to safety due to heightened uncertainty and risk aversion',
        favoredSectors: ['Utilities', 'Consumer Staples', 'Healthcare', 'Gold', 'Government Bonds'],
        avoidedSectors: ['Technology', 'Financials', 'Emerging Markets'],
        strategy: 'Defensive positioning with capital preservation priority',
        positionSizing: 'Conservative',
        duration: '3-9 months'
      },
      risk_on: {
        description: 'Investor appetite for risk returning with improving market sentiment',
        favoredSectors: ['Technology', 'Financials', 'Consumer Discretionary', 'Emerging Markets'],
        avoidedSectors: ['Utilities', 'Consumer Staples', 'Government Bonds'],
        strategy: 'Opportunistic growth with cyclicals emphasis',
        positionSizing: 'Moderate to aggressive',
        duration: '6-12 months'
      },
      transitioning: {
        description: 'Market in transition period with mixed signals and changing leadership',
        favoredSectors: ['Healthcare', 'Technology', 'Consumer Staples'],
        avoidedSectors: ['Highly cyclical sectors'],
        strategy: 'Flexible positioning with quality bias',
        positionSizing: 'Conservative to moderate',
        duration: '1-6 months'
      },
      uncertain: {
        description: 'Unclear market direction with conflicting signals across indicators',
        favoredSectors: ['Healthcare', 'Technology', 'Consumer Staples'],
        avoidedSectors: ['Highly speculative sectors'],
        strategy: 'Wait-and-see with diversified quality focus',
        positionSizing: 'Conservative',
        duration: '1-3 months'
      }
    };

    return characteristics[regime] || characteristics.uncertain;
  }

  /**
   * Calculate transition risk
   */
  private calculateTransitionRisk(
    currentRegime: MarketRegimeType,
    factorScores: EnhancedRegimeAnalysis['factorContributions'],
    probabilities: Record<MarketRegimeType, number>
  ): EnhancedRegimeAnalysis['transitionRisk'] {
    // Calculate probability of regime change
    const currentProb = probabilities[currentRegime];
    const secondBestProb = Object.values(probabilities)
      .sort((a: any, b: any) => b - a)[1] || 0;

    const transitionProbability = Math.max(0, secondBestProb - currentProb + 20);

    // Identify likely next regimes
    const sortedProbs = Object.entries(probabilities)
      .sort(([, a], [, b]) => b - a)
      .filter(([regime]) => regime !== currentRegime)
      .slice(0, 2)
      .map(([regime]) => regime as MarketRegimeType);

    // Identify trigger factors
    const triggerFactors = this.identifyTriggerFactors(currentRegime, factorScores);

    // Estimate remaining duration
    const estimatedDuration = this.estimateRegimeDuration(currentRegime, factorScores);

    return {
      probability: Math.round(transitionProbability),
      likelyNextRegimes: sortedProbs,
      triggerFactors,
      estimatedDuration
    };
  }

  /**
   * Get historical context for current regime
   */
  private getHistoricalContext(regime: MarketRegimeType): EnhancedRegimeAnalysis['historicalContext'] {
    // This would typically reference historical data
    // For now, providing reasonable defaults based on regime characteristics
    const contexts = {
      bullish_expansion: {
        similarPeriods: ['2017-2019', '2003-2007', '1991-1999'],
        averageDuration: 24, // months
        typicalTriggers: ['Fed tightening', 'Recession signals', 'Major geopolitical events'],
        successRate: 75
      },
      bearish_contraction: {
        similarPeriods: ['2008-2009', '2000-2002', '1973-1974'],
        averageDuration: 12,
        typicalTriggers: ['Monetary easing', 'Fiscal stimulus', 'Market stabilization'],
        successRate: 80
      },
      stagflation: {
        similarPeriods: ['1970s', '2021-2023'],
        averageDuration: 36,
        typicalTriggers: ['Fed policy success', 'Energy price stabilization', 'Supply chain improvements'],
        successRate: 65
      },
      goldilocks: {
        similarPeriods: ['1995-2000', '2012-2019', '2010s'],
        averageDuration: 30,
        typicalTriggers: ['Inflation pickup', 'Policy tightening', 'External shocks'],
        successRate: 85
      },
      risk_off: {
        similarPeriods: ['2008', '2020', '2022'],
        averageDuration: 6,
        typicalTriggers: ['Stabilization', 'Policy intervention', 'Peak fear'],
        successRate: 70
      },
      risk_on: {
        similarPeriods: ['2009', '2020-2021', '2016-2017'],
        averageDuration: 9,
        typicalTriggers: ['Policy tightening', 'Valuation concerns', 'External shocks'],
        successRate: 75
      },
      transitioning: {
        similarPeriods: ['Various transition periods'],
        averageDuration: 3,
        typicalTriggers: ['Clear directional signals', 'Policy clarity'],
        successRate: 60
      },
      uncertain: {
        similarPeriods: ['Conflicting signal periods'],
        averageDuration: 2,
        typicalTriggers: ['Clear trend emergence', 'Major policy events'],
        successRate: 55
      }
    };

    return contexts[regime] || contexts.uncertain;
  }

  /**
   * Generate trading implications
   */
  private generateTradingImplications(
    regime: MarketRegimeType,
    factorScores: EnhancedRegimeAnalysis['factorContributions']
  ): EnhancedRegimeAnalysis['tradingImplications'] {
    const implications = {
      bullish_expansion: {
        recommendedAllocation: { equities: 70, bonds: 20, cash: 5, gold: 5 },
        riskTolerance: 'Aggressive',
        volatilityExpectation: 'Low to moderate',
        sectorBias: 'Growth and cyclical sectors'
      },
      bearish_contraction: {
        recommendedAllocation: { equities: 30, bonds: 50, cash: 15, gold: 5 },
        riskTolerance: 'Conservative',
        volatilityExpectation: 'High',
        sectorBias: 'Defensive and quality sectors'
      },
      stagflation: {
        recommendedAllocation: { equities: 40, bonds: 25, cash: 20, gold: 15 },
        riskTolerance: 'Conservative to moderate',
        volatilityExpectation: 'High',
        sectorBias: 'Inflation-resistant sectors'
      },
      goldilocks: {
        recommendedAllocation: { equities: 60, bonds: 30, cash: 5, gold: 5 },
        riskTolerance: 'Moderate',
        volatilityExpectation: 'Low',
        sectorBias: 'Quality growth sectors'
      },
      risk_off: {
        recommendedAllocation: { equities: 35, bonds: 45, cash: 15, gold: 5 },
        riskTolerance: 'Conservative',
        volatilityExpectation: 'Moderate to high',
        sectorBias: 'Defensive and safety sectors'
      },
      risk_on: {
        recommendedAllocation: { equities: 65, bonds: 25, cash: 5, gold: 5 },
        riskTolerance: 'Moderate to aggressive',
        volatilityExpectation: 'Moderate',
        sectorBias: 'Cyclical and growth sectors'
      },
      transitioning: {
        recommendedAllocation: { equities: 50, bonds: 35, cash: 10, gold: 5 },
        riskTolerance: 'Moderate',
        volatilityExpectation: 'Moderate',
        sectorBias: 'Balanced with quality focus'
      },
      uncertain: {
        recommendedAllocation: { equities: 45, bonds: 35, cash: 15, gold: 5 },
        riskTolerance: 'Conservative to moderate',
        volatilityExpectation: 'Moderate',
        sectorBias: 'Diversified quality sectors'
      }
    };

    return implications[regime] || implications.uncertain;
  }

  // Helper methods
  private calculateFactorVariance(factorScores: EnhancedRegimeAnalysis['factorContributions']): number {
    const scores = Object.values(factorScores).map(factor => factor.score);
    const mean = scores.reduce((sum: any, score: any) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum: any, score: any) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    return variance;
  }

  private calculateDistanceFromNeutral(factorScores: EnhancedRegimeAnalysis['factorContributions']): number {
    return Object.values(factorScores).reduce((sum: any, factor: any) => {
      return sum + Math.abs(factor.score - 50);
    }, 0);
  }

  private determineRiskLevel(regime: MarketRegimeType, confidence: number): 'low' | 'medium' | 'high' | 'extreme' {
    const highRiskRegimes = ['bearish_contraction', 'stagflation', 'risk_off'];
    const lowRiskRegimes = ['goldilocks', 'bullish_expansion', 'risk_on'];

    if (highRiskRegimes.includes(regime) && confidence > 70) return 'extreme';
    if (highRiskRegimes.includes(regime)) return 'high';
    if (lowRiskRegimes.includes(regime) && confidence > 70) return 'low';
    return 'medium';
  }

  private calculateDurabilityScore(regime: MarketRegimeType, stability: number, consensus: number): number {
    let durability = (stability + consensus) / 2;

    // Adjust based on regime type
    const durableRegimes = ['goldilocks', 'bullish_expansion', 'bearish_contraction'];
    const volatileRegimes = ['transitioning', 'uncertain', 'risk_off'];

    if (durableRegimes.includes(regime)) {
      durability += 10;
    } else if (volatileRegimes.includes(regime)) {
      durability -= 15;
    }

    return Math.round(Math.max(0, Math.min(100, durability)));
  }

  private identifyTriggerFactors(regime: MarketRegimeType, factorScores: EnhancedRegimeAnalysis['factorContributions']): string[] {
    const triggers: string[] = [];

    // Check for extreme factor scores that could trigger transitions
    if (factorScores.vix.score > 80) triggers.push('VIX spike above 30');
    if (factorScores.vix.score < 20) triggers.push('VIX compression below 15');

    if (factorScores.yieldCurve.score > 75) triggers.push('Significant yield curve inversion');
    if (factorScores.yieldCurve.score < 30) triggers.push('Yield curve steepening');

    if (factorScores.geopoliticalRisk.score > 80) triggers.push('Major geopolitical escalation');
    if (factorScores.geopoliticalRisk.score < 20) triggers.push('Geopolitical risk resolution');

    return triggers.length > 0 ? triggers : ['Normal market evolution'];
  }

  private estimateRegimeDuration(regime: MarketRegimeType, factorScores: EnhancedRegimeAnalysis['factorContributions']): string {
    const historicalContext = this.getHistoricalContext(regime);
    const avgMonths = historicalContext.averageDuration;

    // Adjust based on current stability
    const consensus = this.calculateConsensus(factorScores);
    const adjustment = consensus > 70 ? 1.2 : consensus < 50 ? 0.8 : 1.0;
    const adjustedMonths = Math.round(avgMonths * adjustment);

    if (adjustedMonths < 3) return '1-3 months';
    if (adjustedMonths < 6) return '3-6 months';
    if (adjustedMonths < 12) return '6-12 months';
    if (adjustedMonths < 24) return '1-2 years';
    return '2+ years';
  }

  private storeRegimeHistory(analysis: EnhancedRegimeAnalysis): void {
    this.regimeHistory.push({
      regime: analysis.currentRegime,
      timestamp: Date.now(),
      confidence: analysis.confidence,
      drivers: analysis.factorContributions
    });

    // Keep only last 50 entries
    if (this.regimeHistory.length > 50) {
      this.regimeHistory = this.regimeHistory.slice(-50);
    }
  }

  private getDefaultRegimeAnalysis(): EnhancedRegimeAnalysis {
    return {
      currentRegime: 'uncertain',
      confidence: 50,
      riskLevel: 'medium',
      description: 'Unable to determine market regime due to insufficient data',
      favoredSectors: ['Technology', 'Healthcare', 'Consumer Staples'],
      avoidedSectors: ['Highly speculative sectors'],
      strategy: 'Conservative positioning until clarity emerges',
      positionSizing: 'Conservative',
      duration: '1-3 months',
      previousRegime: 'uncertain',
      regimeChangeDate: new Date().toISOString().split('T')[0],
      stabilityScore: 50,
      lastUpdated: new Date().toISOString(),
      factorContributions: {
        vix: { score: 50, weight: 0.25, description: 'VIX analysis unavailable' },
        yieldCurve: { score: 50, weight: 0.20, description: 'Yield curve analysis unavailable' },
        economicGrowth: { score: 50, weight: 0.20, description: 'Economic growth analysis unavailable' },
        inflation: { score: 50, weight: 0.15, description: 'Inflation analysis unavailable' },
        geopoliticalRisk: { score: 50, weight: 0.10, description: 'Geopolitical risk analysis unavailable' },
        marketMomentum: { score: 50, weight: 0.10, description: 'Market momentum analysis unavailable' }
      },
      regimeStrength: {
        overall: 50,
        consensus: 50,
        volatility: 50,
        durability: 50
      },
      transitionRisk: {
        probability: 50,
        likelyNextRegimes: ['uncertain', 'transitioning'],
        triggerFactors: ['Insufficient data'],
        estimatedDuration: '1-3 months'
      },
      historicalContext: {
        similarPeriods: [],
        averageDuration: 0,
        typicalTriggers: [],
        successRate: 0
      },
      tradingImplications: {
        recommendedAllocation: { equities: 50, bonds: 35, cash: 10, gold: 5 },
        riskTolerance: 'Conservative',
        volatilityExpectation: 'Moderate',
        sectorBias: 'Diversified quality sectors'
      }
    };
  }

  /**
   * Get regime classification history
   */
  getRegimeHistory(): Array<{
    regime: MarketRegimeType;
    timestamp: number;
    confidence: number;
    drivers: any;
  }> {
    return [...this.regimeHistory];
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const historyLength = this.regimeHistory.length;
      const recentClassifications = this.regimeHistory.slice(-10);
      const averageConfidence = recentClassifications.length > 0
        ? recentClassifications.reduce((sum: any, h: any) => sum + h.confidence, 0) / recentClassifications.length
        : 0;

      return {
        status: historyLength > 0 ? 'healthy' : 'unhealthy',
        details: {
          historyLength,
          averageConfidence: Math.round(averageConfidence),
          config: this.config,
          lastClassification: this.regimeHistory.length > 0
            ? (function() {
                try {
                  const date = new Date(this.regimeHistory[this.regimeHistory.length - 1].timestamp);
                  return isNaN(date.getTime()) ? null : date.toISOString();
                } catch {
                  return null;
                }
              }).call(this)
            : null
        }
      };
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        details: { error: (error instanceof Error ? error.message : String(error)) }
      };
    }
  }
}

/**
 * Initialize Market Regime Classifier
 */
export function initializeMarketRegimeClassifier(config?: Partial<RegimeClassificationConfig>): MarketRegimeClassifier {
  return new MarketRegimeClassifier(config);
}

export default MarketRegimeClassifier;