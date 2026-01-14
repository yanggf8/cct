/**
 * Cron-Based Signal Tracking System
 * Track morning predictions through intraday and end-of-day analysis
 */

import { createLogger } from './logging.js';
import { rateLimitedFetch } from './rate-limiter.js';
import { writeD1JobResult, readD1ReportSnapshot } from './d1-job-storage.js';
import type { CloudflareEnvironment } from '../types.js';

// Type definitions
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
  trading_signals?: { [symbol: string]: TradingSignal };
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

const logger = createLogger('cron-signal-tracking');

/**
 * Signal Tracking for Cron-Based System
 */
class CronSignalTracker {
  private confidenceThreshold: number;

  constructor() {
    this.confidenceThreshold = 70;
  }

  /**
   * Save morning predictions for tracking throughout the day
   */
  async saveMorningPredictions(
    env: CloudflareEnvironment,
    analysisData: AnalysisData,
    date: Date
  ): Promise<boolean> {
    const dateStr = date.toISOString().split('T')[0];

    try {
      // Extract high-confidence signals from analysis
      const highConfidenceSignals: MorningPrediction[] = [];

      for (const [symbol, signal] of Object.entries(analysisData.trading_signals || {})) {
        if (signal.enhanced_prediction && signal.enhanced_prediction.confidence >= (this.confidenceThreshold / 100)) {
          highConfidenceSignals.push({
            id: crypto.randomUUID(),
            symbol,
            prediction: signal.enhanced_prediction.direction,
            confidence: signal.enhanced_prediction.confidence,
            morningPrice: signal.current_price,
            predictedPrice: signal.predicted_price,
            timestamp: new Date().toISOString(),
            status: 'pending',
            analysis: {
              sentiment_layers: signal.sentiment_layers || [],
              reasoning: signal.reasoning || ''
            }
          });
        }
      }

      if (highConfidenceSignals.length === 0) {
        logger.info('No high-confidence signals to track', { date: dateStr });
        return false;
      }

      // Save predictions for later tracking
      const predictionsData: PredictionsData = {
        date: dateStr,
        predictions: highConfidenceSignals,
        metadata: {
          totalSignals: highConfidenceSignals.length,
          averageConfidence: highConfidenceSignals.reduce((sum: any, s: any) => sum + s.confidence, 0) / highConfidenceSignals.length,
          bullishCount: highConfidenceSignals.filter(s => s.prediction === 'up').length,
          bearishCount: highConfidenceSignals.filter(s => s.prediction === 'down').length,
          generatedAt: new Date().toISOString()
        }
      };

      logger.info('Saving morning predictions to D1', {
        date: dateStr,
        signalCount: highConfidenceSignals.length
      });

      // Write to D1 scheduled_job_results table
      const success = await writeD1JobResult(
        env,
        dateStr,
        'morning_predictions',
        predictionsData,
        {
          signalCount: highConfidenceSignals.length,
          averageConfidence: predictionsData.metadata.averageConfidence,
          bullishCount: predictionsData.metadata.bullishCount,
          bearishCount: predictionsData.metadata.bearishCount
        },
        'cron'
      );

      if (success) {
        logger.info('D1 morning predictions saved successfully', {
          date: dateStr,
          signalCount: highConfidenceSignals.length,
          avgConfidence: predictionsData.metadata.averageConfidence.toFixed(1)
        });
        return true;
      } else {
        logger.error('D1 morning predictions save failed', {
          date: dateStr,
          signalCount: highConfidenceSignals.length
        });
        return false;
      }

    } catch (error: any) {
      logger.error('Failed to save morning predictions', {
        date: dateStr,
        error: (error instanceof Error ? error.message : String(error))
      });
      return false;
    }
  }

  /**
   * Get morning predictions for performance tracking
   */
  async getMorningPredictions(env: CloudflareEnvironment, date: Date): Promise<PredictionsData | null> {
    const dateStr = date.toISOString().split('T')[0];

    try {
      // Read from D1 scheduled_job_results table
      const result = await readD1ReportSnapshot(env, dateStr, 'morning_predictions');
      if (result && result.data) {
        return result.data as PredictionsData;
      }
    } catch (error: any) {
      logger.error('Failed to retrieve morning predictions from D1', {
        date: dateStr,
        error: (error instanceof Error ? error.message : String(error))
      });
    }

    return null;
  }

  /**
   * Update signal performance with current prices (for intraday check)
   */
  async updateSignalPerformance(
    env: CloudflareEnvironment,
    date: Date
  ): Promise<PredictionsData | null> {
    const dateStr = date.toISOString().split('T')[0];
    const predictionsData = await this.getMorningPredictions(env, date);

    if (!predictionsData || !predictionsData.predictions) {
      logger.warn('No morning predictions found for performance update', { date: dateStr });
      return null;
    }

    try {
      // Get current prices for all symbols
      const symbols = predictionsData.predictions.map(p => p.symbol);
      const currentPrices = await this.getCurrentPrices(symbols);

      // Update each prediction with current performance
      const updatedPredictions = predictionsData.predictions.map(prediction => {
        const currentPrice = currentPrices[prediction.symbol];
        if (!currentPrice) return prediction;

        const performance = this.calculatePredictionPerformance(prediction, currentPrice);

        return {
          ...prediction,
          currentPrice: currentPrice.currentPrice,
          currentChange: currentPrice.changePercent,
          performance,
          lastUpdated: new Date().toISOString()
        };
      });

      // Save updated predictions to D1
      const updatedData: PredictionsData = {
        ...predictionsData,
        predictions: updatedPredictions,
        lastPerformanceUpdate: new Date().toISOString()
      };

      const writeSuccess = await writeD1JobResult(
        env,
        dateStr,
        'morning_predictions',
        updatedData,
        {
          performanceUpdate: true,
          symbolCount: symbols.length,
          updatedAt: new Date().toISOString()
        },
        'cron'
      );

      if (!writeSuccess) {
        logger.warn('Failed to write updated predictions to D1', { date: dateStr });
      }

      logger.info('Updated signal performance', {
        date: dateStr,
        symbolCount: symbols.length,
        successfulUpdates: updatedPredictions.filter(p => p.performance).length
      });

      return updatedData;

    } catch (error: any) {
      logger.error('Failed to update signal performance', {
        date: dateStr,
        error: (error instanceof Error ? error.message : String(error))
      });
      return null;
    }
  }

  /**
   * Get current prices for multiple symbols
   */
  async getCurrentPrices(symbols: string[]): Promise<PriceData> {
    const prices: PriceData = {};

    for (const symbol of symbols) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;

        const response = await rateLimitedFetch(url, {
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const data = await response.json() as any;
          const result = data.chart.result[0];

          if (result && result.indicators && result.timestamp) {
            const timestamps = result.timestamp;
            const quote = result.indicators.quote[0];
            const latestIndex = timestamps.length - 1;

            const currentPrice = quote.close[latestIndex];
            const previousPrice = quote.close[latestIndex - 1] || currentPrice;
            const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;

            prices[symbol] = {
              currentPrice,
              changePercent,
              timestamp: timestamps[latestIndex] * 1000
            };
          }
        }
      } catch (error: any) {
        logger.warn('Failed to get current price', { symbol, error: (error instanceof Error ? error.message : String(error)) });
      }
    }

    return prices;
  }

  /**
   * Calculate prediction performance
   */
  calculatePredictionPerformance(
    prediction: MorningPrediction,
    currentPrice: CurrentPrice
  ): PredictionPerformance {
    const predictedChange = prediction.predictedPrice - prediction.morningPrice;
    const actualChange = currentPrice.currentPrice - prediction.morningPrice;
    const morningPrice = prediction.morningPrice;

    // Calculate accuracy
    let isCorrect = false;
    let accuracy = 0;

    if (prediction.prediction === 'up' && actualChange > 0) {
      isCorrect = true;
      accuracy = Math.min(actualChange / morningPrice * 100, 100) / 100; // Scale to 0-1
    } else if (prediction.prediction === 'down' && actualChange < 0) {
      isCorrect = true;
      accuracy = Math.min(Math.abs(actualChange) / morningPrice * 100, 100) / 100;
    } else if (prediction.prediction === 'neutral' && Math.abs(actualChange) / morningPrice < 0.005) {
      isCorrect = true;
      accuracy = 1 - (Math.abs(actualChange) / morningPrice) / 0.005;
    }

    // Calculate divergence
    const divergence = Math.abs(predictedChange - actualChange) / Math.abs(morningPrice);
    let divergenceLevel: 'low' | 'medium' | 'high' = 'low';
    if (divergence > 0.05) divergenceLevel = 'high';
    else if (divergence > 0.02) divergenceLevel = 'medium';

    // Determine status
    let status: 'pending' | 'tracking' | 'validated' | 'divergent' = prediction.status;
    if (isCorrect && accuracy > 0.7) {
      status = 'validated';
    } else if (divergenceLevel === 'high') {
      status = 'divergent';
    } else if (isCorrect) {
      status = 'tracking';
    }

    return {
      isCorrect,
      accuracy: Math.round(accuracy * 100),
      divergenceLevel,
      status,
      predictedChange: predictedChange / morningPrice * 100,
      actualChange: actualChange / morningPrice * 100
    };
  }

  /**
   * Generate end-of-day summary
   */
  async generateEndOfDaySummary(env: CloudflareEnvironment, date: Date): Promise<EndOfDaySummary> {
    const dateStr = date.toISOString().split('T')[0];
    const predictionsData = await this.getMorningPredictions(env, date);

    if (!predictionsData || !predictionsData.predictions) {
      return this.getDefaultSummary();
    }

    try {
      const predictions = predictionsData.predictions;

      // Calculate overall performance
      const totalSignals = predictions.length;
      const correctSignals = predictions.filter(p => p.performance?.isCorrect).length;
      const validatedSignals = predictions.filter(p => p.status === 'validated').length;
      const divergentSignals = predictions.filter(p => p.status === 'divergent').length;

      const averageAccuracy = predictions.reduce((sum: any, p: any) =>
        sum + (p.performance?.accuracy || 0), 0) / totalSignals;

      // Get top performers
      const topPerformers = predictions
        .filter(p => (p.performance?.accuracy ?? 0) > 0)
        .sort((a: any, b: any) => (b.performance?.accuracy ?? 0) - (a.performance?.accuracy ?? 0))
        .slice(0, 3);

      // Get underperformers
      const underperformers = predictions
        .filter(p => p.performance?.accuracy !== undefined)
        .sort((a: any, b: any) => a.performance!.accuracy - b.performance!.accuracy)
        .slice(0, 3);

      // Generate tomorrow outlook based on today's performance
      const tomorrowOutlook = this.generateTomorrowOutlook(predictions, {
        totalSignals,
        averageAccuracy,
        validatedSignals,
        divergentSignals
      });

      return {
        date: dateStr,
        summary: {
          totalSignals,
          correctSignals,
          validatedSignals,
          divergentSignals,
          averageAccuracy: Math.round(averageAccuracy),
          successRate: Math.round((correctSignals / totalSignals) * 100)
        },
        topPerformers: topPerformers.map(p => ({
          symbol: p.symbol,
          prediction: p.prediction,
          confidence: p.confidence,
          accuracy: p.performance?.accuracy || 0,
          status: p.status
        })),
        underperformers: underperformers.map(p => ({
          symbol: p.symbol,
          prediction: p.prediction,
          confidence: p.confidence,
          accuracy: p.performance?.accuracy || 0,
          status: p.status
        })),
        tomorrowOutlook,
        generatedAt: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error('Failed to generate end-of-day summary', {
        date: dateStr,
        error: (error instanceof Error ? error.message : String(error))
      });
      return this.getDefaultSummary();
    }
  }

  /**
   * Generate tomorrow outlook based on today's performance
   */
  generateTomorrowOutlook(
    predictions: MorningPrediction[],
    performance: PerformanceSummary
  ): TomorrowOutlook {
    const outlook: TomorrowOutlook = {
      marketBias: 'neutral',
      confidence: 'medium',
      keyFocus: 'Market Open',
      reasoning: '',
      recommendations: []
    };

    try {
      const { averageAccuracy, validatedSignals, divergentSignals, totalSignals } = performance;

      // Determine confidence based on today's performance
      if (averageAccuracy > 70 && divergentSignals / totalSignals < 0.2) {
        outlook.confidence = 'high';
        outlook.reasoning = 'High prediction accuracy supports confident outlook';
      } else if (averageAccuracy < 50 || divergentSignals / totalSignals > 0.4) {
        outlook.confidence = 'low';
        outlook.reasoning = 'Variable performance suggests cautious approach';
      }

      // Determine market bias
      const bullishAccuracy = this.calculateDirectionalAccuracy(predictions, 'up');
      const bearishAccuracy = this.calculateDirectionalAccuracy(predictions, 'down');

      if (bullishAccuracy > bearishAccuracy && bullishAccuracy > 60) {
        outlook.marketBias = 'bullish';
        outlook.keyFocus = 'Long opportunities';
      } else if (bearishAccuracy > bullishAccuracy && bearishAccuracy > 60) {
        outlook.marketBias = 'bearish';
        outlook.keyFocus = 'Risk management';
      }

      // Add recommendations
      if (divergentSignals > 0) {
        outlook.recommendations.push('Monitor signals showing high divergence');
      }

      if (averageAccuracy > 70) {
        outlook.recommendations.push('Consider scaling into high-confidence signals');
      } else if (averageAccuracy < 50) {
        outlook.recommendations.push('Reduce position sizes and focus on validation');
      }

    } catch (error: any) {
      logger.error('Failed to generate tomorrow outlook', { error: (error instanceof Error ? error.message : String(error)) });
    }

    return outlook;
  }

  /**
   * Calculate directional accuracy
   */
  calculateDirectionalAccuracy(predictions: MorningPrediction[], direction: 'up' | 'down'): number {
    const directionSignals = predictions.filter(p => p.prediction === direction);
    if (directionSignals.length === 0) return 0;

    const correctSignals = directionSignals.filter(p => p.performance?.isCorrect).length;
    return (correctSignals / directionSignals.length) * 100;
  }

  /**
   * Get default summary
   */
  private getDefaultSummary(): EndOfDaySummary {
    return {
      summary: {
        totalSignals: 0,
        correctSignals: 0,
        validatedSignals: 0,
        divergentSignals: 0,
        averageAccuracy: 0,
        successRate: 0
      },
      topPerformers: [],
      underperformers: [],
      tomorrowOutlook: {
        marketBias: 'neutral',
        confidence: 'medium',
        keyFocus: 'Market Open',
        reasoning: 'No data available',
        recommendations: []
      }
    };
  }
}

// Global instance
const cronSignalTracker = new CronSignalTracker();

export {
  CronSignalTracker,
  cronSignalTracker
};

// Export types for external use
export type {
  SignalAnalysis,
  TradingSignal,
  AnalysisData,
  MorningPrediction,
  PredictionPerformance,
  PredictionsData,
  CurrentPrice,
  PriceData,
  PerformanceSummary,
  EndOfDaySummary,
  TomorrowOutlook
};