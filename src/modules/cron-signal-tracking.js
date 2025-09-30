/**
 * Cron-Based Signal Tracking System
 * Track morning predictions through intraday and end-of-day analysis
 */

import { createLogger } from './logging.js';
import { kvStorageManager } from './kv-storage-manager.js';
import { rateLimitedFetch } from './rate-limiter.js';
import { updateJobStatus, putWithVerification, logKVOperation } from './kv-utils.js';
import { createDAL } from './dal.js';

const logger = createLogger('cron-signal-tracking');

/**
 * Signal Tracking for Cron-Based System
 */
class CronSignalTracker {
  constructor() {
    this.confidenceThreshold = 70;
  }

  /**
   * Save morning predictions for tracking throughout the day
   */
  async saveMorningPredictions(env, analysisData, date) {
    const dateStr = date.toISOString().split('T')[0];
    const predictionsKey = `morning_predictions_${dateStr}`;

    try {
      // Extract high-confidence signals from analysis
      const highConfidenceSignals = [];

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
      const predictionsData = {
        date: dateStr,
        predictions: highConfidenceSignals,
        metadata: {
          totalSignals: highConfidenceSignals.length,
          averageConfidence: highConfidenceSignals.reduce((sum, s) => sum + s.confidence, 0) / highConfidenceSignals.length,
          bullishCount: highConfidenceSignals.filter(s => s.prediction === 'up').length,
          bearishCount: highConfidenceSignals.filter(s => s.prediction === 'down').length,
          generatedAt: new Date().toISOString()
        }
      };

      const predictionsJson = JSON.stringify(predictionsData);

      logger.info('Saving morning predictions to KV', {
        date: dateStr,
        key: predictionsKey,
        signalCount: highConfidenceSignals.length,
        bytes: predictionsJson.length
      });

      const success = await putWithVerification(predictionsKey, predictionsJson, env, {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days
      });

      if (success) {
        logKVOperation('SAVE_MORNING_PREDICTIONS', predictionsKey, true, {
          date: dateStr,
          signalCount: highConfidenceSignals.length,
          avgConfidence: predictionsData.metadata.averageConfidence.toFixed(1),
          totalBytes: predictionsJson.length
        });

        // Update job status for morning predictions
        try {
          await updateJobStatus('morning_predictions', dateStr, 'done', env, {
            signalCount: highConfidenceSignals.length,
            averageConfidence: predictionsData.metadata.averageConfidence,
            bullishCount: predictionsData.metadata.bullishCount,
            bearishCount: predictionsData.metadata.bearishCount
          });
        } catch (statusError) {
          logger.warn('Failed to update morning predictions job status', {
            date: dateStr,
            error: statusError.message
          });
        }

        return true;
      } else {
        logKVOperation('SAVE_MORNING_PREDICTIONS', predictionsKey, false, {
          date: dateStr,
          signalCount: highConfidenceSignals.length,
          error: 'KV verification failed'
        });

        return false;
      }

    } catch (error) {
      logger.error('Failed to save morning predictions', {
        date: dateStr,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get morning predictions for performance tracking
   */
  async getMorningPredictions(env, date) {
    const dateStr = date.toISOString().split('T')[0];
    const predictionsKey = `morning_predictions_${dateStr}`;

    try {
      const dal = createDAL(env);
      const result = await dal.read(predictionsKey);
      if (result.success && result.data) {
        return result.data;
      }
    } catch (error) {
      logger.error('Failed to retrieve morning predictions', {
        date: dateStr,
        error: error.message
      });
    }

    return null;
  }

  /**
   * Update signal performance with current prices (for intraday check)
   */
  async updateSignalPerformance(env, date) {
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

      // Save updated predictions
      const updatedData = {
        ...predictionsData,
        predictions: updatedPredictions,
        lastPerformanceUpdate: new Date().toISOString()
      };

      const dal = createDAL(env);
      const writeResult = await dal.write(`morning_predictions_${dateStr}`, updatedData, {
        expirationTtl: 7 * 24 * 60 * 60
      });

      if (!writeResult.success) {
        logger.warn('Failed to write updated predictions', { error: writeResult.error });
      }

      logger.info('Updated signal performance', {
        date: dateStr,
        symbolCount: symbols.length,
        successfulUpdates: updatedPredictions.filter(p => p.performance).length
      });

      return updatedData;

    } catch (error) {
      logger.error('Failed to update signal performance', {
        date: dateStr,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get current prices for multiple symbols
   */
  async getCurrentPrices(symbols) {
    const prices = {};

    for (const symbol of symbols) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;

        const response = await rateLimitedFetch(url, {
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const data = await response.json();
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
      } catch (error) {
        logger.warn('Failed to get current price', { symbol, error: error.message });
      }
    }

    return prices;
  }

  /**
   * Calculate prediction performance
   */
  calculatePredictionPerformance(prediction, currentPrice) {
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
    let divergenceLevel = 'low';
    if (divergence > 0.05) divergenceLevel = 'high';
    else if (divergence > 0.02) divergenceLevel = 'medium';

    // Determine status
    let status = prediction.status;
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
  async generateEndOfDaySummary(env, date) {
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

      const averageAccuracy = predictions.reduce((sum, p) =>
        sum + (p.performance?.accuracy || 0), 0) / totalSignals;

      // Get top performers
      const topPerformers = predictions
        .filter(p => p.performance?.accuracy > 0)
        .sort((a, b) => b.performance.accuracy - a.performance.accuracy)
        .slice(0, 3);

      // Get underperformers
      const underperformers = predictions
        .filter(p => p.performance?.accuracy !== undefined)
        .sort((a, b) => a.performance.accuracy - b.performance.accuracy)
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

    } catch (error) {
      logger.error('Failed to generate end-of-day summary', {
        date: dateStr,
        error: error.message
      });
      return this.getDefaultSummary();
    }
  }

  /**
   * Generate tomorrow outlook based on today's performance
   */
  generateTomorrowOutlook(predictions, performance) {
    const outlook = {
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

    } catch (error) {
      logger.error('Failed to generate tomorrow outlook', { error: error.message });
    }

    return outlook;
  }

  /**
   * Calculate directional accuracy
   */
  calculateDirectionalAccuracy(predictions, direction) {
    const directionSignals = predictions.filter(p => p.prediction === direction);
    if (directionSignals.length === 0) return 0;

    const correctSignals = directionSignals.filter(p => p.performance?.isCorrect).length;
    return (correctSignals / directionSignals.length) * 100;
  }

  /**
   * Get default summary
   */
  getDefaultSummary() {
    return {
      summary: {
        totalSignals: 0,
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