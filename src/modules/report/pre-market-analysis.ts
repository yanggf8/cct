/**
 * Pre-Market Analysis Module
 * Core logic for morning high-confidence signal analysis (≥70%)
 */

import { createLogger } from '../logging.js';

// Type definitions
interface TradingSignal {
  sentiment_layers?: Array<{
    sentiment: string;
    confidence: number;
    reasoning: string;
  }>;
  overall_confidence?: number;
  primary_direction?: string;
}

interface AIModel {
  direction: string;
  confidence: number;
}

interface DualAIComparison {
  agree: boolean;
  agreement_type: string;
}

interface TradingSignalData {
  direction: string;
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  action: string;
}

interface AnalysisSignal {
  analysis_type?: string;
  models?: {
    gpt?: AIModel;
    distilbert?: AIModel;
  };
  comparison?: DualAIComparison;
  signal?: TradingSignalData;
  trading_signals?: TradingSignal;
  sentiment_layers?: Array<{
    sentiment: string;
    confidence: number;
    reasoning: string;
  }>;
}

interface AnalysisData {
  trading_signals: Record<string, AnalysisSignal>;
}

interface ProcessedSignal {
  symbol: string;
  sentiment: string;
  direction: string;
  confidence: number;
  expectedMove: string;
  driver: string;
  aiInsights?: {
    agree: boolean;
    agreement_type: string;
    gpt_direction?: string;
    distilbert_direction?: string;
    signal_action?: string;
  };
}

interface PreMarketResult {
  bias: string;
  biasDisplay: string;
  confidence: number;
  bullishCount: number;
  bearishCount: number;
  totalSymbols: number;
  highConfidenceUps: ProcessedSignal[];
  highConfidenceDowns: ProcessedSignal[];
  strongestSectors: string[];
  weakestSectors: string[];
  riskItems: Array<{ symbol: string; description: string }>;
}

const logger = createLogger('pre-market-analysis');

/**
 * Generate high-confidence pre-market signals from analysis data
 */
export function generatePreMarketSignals(analysisData: AnalysisData | null): PreMarketResult {
  logger.info('Processing pre-market signals with high-confidence filtering');

  const CONFIDENCE_THRESHOLD = 0.70; // 70%

  // Handle missing analysis data
  if (!analysisData || !analysisData.trading_signals) {
    logger.warn('No analysis data available, using fallback');
    return getDefaultPreMarketData();
  }

  // Process real analysis data
  const signals = analysisData.trading_signals;
  const symbols = Object.keys(signals);

  // Calculate market bias
  let bullishCount = 0;
  let bearishCount = 0;
  let totalConfidence = 0;

  const processedSignals: ProcessedSignal[] = symbols.map(symbol => {
    const signal = signals[symbol];
    const tradingSignals = signal.trading_signals || signal;

    // Check if this is dual AI analysis
    const isDualAI = signal.analysis_type === 'dual_ai_comparison' ||
                     signal.models?.gpt ||
                     signal.comparison?.agree !== undefined;

    let sentiment: string, confidence: number, direction: string, aiInsights: ProcessedSignal['aiInsights'] = null;

    if (isDualAI) {
      // Process dual AI analysis
      const comparison = signal.comparison || {};
      const models = signal.models || {};
      const tradingSignal = signal.signal || {};

      // Use agreement status and signal for sentiment/direction
      if ((comparison as any).agree && (tradingSignal as any).direction) {
        sentiment = (tradingSignal as any).direction;
        confidence = ((tradingSignal as any).strength === 'STRONG' ? 0.85 :
                      (tradingSignal as any).strength === 'MODERATE' ? 0.75 : 0.65) * 100;
      } else {
        // For partial agreement or disagreement, use weighted average
        const gptConfidence = models.gpt?.confidence || 0;
        const dbConfidence = models.distilbert?.confidence || 0;
        confidence = ((gptConfidence + dbConfidence) / 2) * 100;

        // Use dominant model direction
        sentiment = models.gpt?.direction || models.distilbert?.direction || 'neutral';
      }

      direction = sentiment === 'bullish' ? 'up' : sentiment === 'bearish' ? 'down' : 'neutral';

      // Add AI insights for dual AI analysis
      aiInsights = {
        agree: (comparison as any).agree,
        agreement_type: (comparison as any).agreement_type,
        gpt_direction: (models as any).gpt?.direction,
        distilbert_direction: (models as any).distilbert?.direction,
        signal_action: (tradingSignal as any).action
      };

    } else {
      // Process legacy analysis
      const sentimentLayer = signal.sentiment_layers?.[0];
      sentiment = (sentimentLayer as any)?.sentiment || 'neutral';
      confidence = ((sentimentLayer as any)?.confidence || (tradingSignals as any)?.overall_confidence || 0) * 100;
      direction = (tradingSignals as any)?.primary_direction === 'BULLISH' ? 'up' :
                   (tradingSignals as any)?.primary_direction === 'BEARISH' ? 'down' : 'neutral';
    }

    if (sentiment === 'bullish') bullishCount++;
    if (sentiment === 'bearish') bearishCount++;
    totalConfidence += confidence;

    return {
      symbol,
      sentiment,
      direction,
      confidence: Math.round(confidence),
      expectedMove: calculateExpectedMove(confidence),
      driver: generateMarketDriver(sentiment, confidence),
      aiInsights // Add dual AI insights if available
    };
  });

  // Filter high-confidence signals
  const highConfidenceUps = processedSignals
    .filter(s => s.direction === 'up' && s.confidence >= (CONFIDENCE_THRESHOLD * 100))
    .slice(0, 3);

  const highConfidenceDowns = processedSignals
    .filter(s => s.direction === 'down' && s.confidence >= (CONFIDENCE_THRESHOLD * 100))
    .slice(0, 3);

  // Calculate overall market bias
  const avgConfidence = Math.round(totalConfidence / symbols.length);
  const bias = bullishCount > bearishCount ? 'bullish' :
               bearishCount > bullishCount ? 'bearish' : 'neutral';

  return {
    bias,
    biasDisplay: bias.toUpperCase(),
    confidence: avgConfidence,
    bullishCount,
    bearishCount,
    totalSymbols: symbols.length,
    highConfidenceUps,
    highConfidenceDowns,
    strongestSectors: identifyStrongestSectors(processedSignals),
    weakestSectors: identifyWeakestSectors(processedSignals),
    riskItems: generateRiskItems(processedSignals)
  };
}

/**
 * Calculate expected price movement based on confidence
 */
function calculateExpectedMove(confidence: number): string {
  const baseMove = 1.0; // Base 1% move
  const confidenceMultiplier = confidence / 100;
  const move = baseMove * (1 + confidenceMultiplier);
  return move.toFixed(1);
}

/**
 * Generate market driver based on sentiment and confidence
 */
function generateMarketDriver(sentiment: string, confidence: number): string {
  const drivers = {
    bullish: {
      high: ['Strong earnings momentum', 'Technical breakout pattern', 'Sector leadership', 'Positive sentiment surge'],
      medium: ['Moderate momentum', 'Support level hold', 'Sector strength', 'News catalyst'],
      low: ['Weak momentum', 'Technical signals', 'Market following', 'Mixed sentiment']
    },
    bearish: {
      high: ['Negative earnings outlook', 'Technical breakdown', 'Sector weakness', 'Strong selling pressure'],
      medium: ['Profit taking pressure', 'Resistance rejection', 'Sector rotation', 'Mixed fundamentals'],
      low: ['Weak momentum', 'Technical concerns', 'Market caution', 'Neutral sentiment']
    },
    neutral: {
      high: ['Consolidation pattern', 'Mixed signals', 'Awaiting catalyst', 'Range-bound'],
      medium: ['Sideways momentum', 'Uncertain outlook', 'Mixed technicals', 'Flat sentiment'],
      low: ['No clear direction', 'Low conviction', 'Market indecision', 'Wait and see']
    }
  };

  const confidenceLevel = confidence > 80 ? 'high' : confidence > 60 ? 'medium' : 'low';
  const driverList = drivers[sentiment as keyof typeof drivers] || drivers.neutral;
  const levelDrivers = driverList[confidenceLevel as keyof typeof driverList] || driverList.medium;

  return levelDrivers[Math.floor(Math.random() * levelDrivers.length)];
}

/**
 * Identify strongest sectors (simplified mapping for now)
 */
function identifyStrongestSectors(signals: ProcessedSignal[]): string[] {
  // For now, use symbol mapping - in future this will be real sector analysis
  const techSymbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA'];
  const techStrength = signals
    .filter(s => techSymbols.includes(s.symbol) && s.direction === 'up')
    .length;

  return techStrength >= 2 ? ['Technology', 'Consumer Discretionary'] : ['Healthcare', 'Financials'];
}

/**
 * Identify weakest sectors (simplified mapping for now)
 */
function identifyWeakestSectors(signals: ProcessedSignal[]): string[] {
  return ['Energy', 'Utilities']; // Placeholder - will be real analysis in Phase 2
}

/**
 * Generate risk items based on signals
 */
function generateRiskItems(signals: ProcessedSignal[]): Array<{ symbol: string; description: string }> {
  const highVolatilitySymbols = signals.filter(s => s.confidence < 60);

  return [
    { symbol: 'SPY', description: 'Monitor for overall market volatility' },
    { symbol: 'VIX', description: 'Volatility spike risk' }
  ];
}

/**
 * Default pre-market data when no analysis is available
 */
function getDefaultPreMarketData(): PreMarketResult {
  return {
    bias: 'neutral',
    biasDisplay: 'NEUTRAL',
    confidence: 50,
    bullishCount: 2,
    bearishCount: 2,
    totalSymbols: 5,
    highConfidenceUps: [
      { symbol: 'AAPL', expectedMove: '1.5', confidence: 75, driver: 'Technical breakout pattern', sentiment: 'BULLISH', direction: 'UP' },
      { symbol: 'MSFT', expectedMove: '1.2', confidence: 73, driver: 'Cloud momentum strength', sentiment: 'BULLISH', direction: 'UP' }
    ],
    highConfidenceDowns: [
      { symbol: 'TSLA', expectedMove: '2.1', confidence: 76, driver: 'Production headwinds', sentiment: 'BEARISH', direction: 'DOWN' }
    ],
    strongestSectors: ['Technology', 'Consumer Discretionary'],
    weakestSectors: ['Healthcare', 'Energy'],
    riskItems: [
      { symbol: 'SPY', description: 'Market volatility expected' },
      { symbol: 'QQQ', description: 'Tech sector concentration risk' }
    ]
  };
}

// Export types for external use
export type {
  TradingSignal,
  AIModel,
  DualAIComparison,
  TradingSignalData,
  AnalysisSignal,
  AnalysisData,
  ProcessedSignal,
  PreMarketResult
};