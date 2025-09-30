/**
 * Tomorrow Outlook Tracking System
 * Store and evaluate tomorrow outlook predictions
 */

import { createLogger } from './logging.js';
import { createDAL } from './dal.js';

const logger = createLogger('tomorrow-outlook-tracker');

/**
 * Tomorrow Outlook Tracker
 */
class TomorrowOutlookTracker {
  constructor() {
    this.outlookHistory = new Map();
  }

  /**
   * Store tomorrow outlook when generated at EOD
   */
  async storeTomorrowOutlook(env, currentDate, outlookData) {
    const currentDateString = currentDate.toISOString().split('T')[0];

    // Calculate tomorrow's date
    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    const outlookKey = `tomorrow_outlook_${tomorrowString}`;

    try {
      const outlookRecord = {
        targetDate: tomorrowString,
        generatedOn: currentDateString,
        generatedAt: new Date().toISOString(),
        outlook: outlookData,
        evaluationStatus: 'pending', // pending, evaluated, expired
        actualPerformance: null,
        accuracyScore: null,
        evaluationDate: null
      };

      const dal = createDAL(env);
      const writeResult = await dal.write(outlookKey, outlookRecord, {
        expirationTtl: 14 * 24 * 60 * 60 // 14 days
      });

      if (!writeResult.success) {
        throw new Error(`Failed to write outlook: ${writeResult.error}`);
      }

      logger.info('Stored tomorrow outlook', {
        targetDate: tomorrowString,
        generatedOn: currentDateString,
        marketBias: outlookData.marketBias,
        confidence: outlookData.confidence
      });

      return true;

    } catch (error) {
      logger.error('Failed to store tomorrow outlook', {
        targetDate: tomorrowString,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get today's outlook (generated yesterday)
   */
  async getTodaysOutlook(env, currentDate) {
    const currentDateString = currentDate.toISOString().split('T')[0];
    const outlookKey = `tomorrow_outlook_${currentDateString}`;

    try {
      const dal = createDAL(env);
      const result = await dal.read(outlookKey);
      if (result.success && result.data) {
        const parsed = result.data;
        logger.debug('Retrieved today\'s outlook', {
          targetDate: currentDateString,
          marketBias: parsed.outlook.marketBias,
          confidence: parsed.outlook.confidence
        });
        return parsed;
      }
    } catch (error) {
      logger.error('Failed to retrieve today\'s outlook', {
        targetDate: currentDateString,
        error: error.message
      });
    }

    return null;
  }

  /**
   * Evaluate today's outlook against actual performance
   */
  async evaluateTodaysOutlook(env, currentDate, actualMarketData) {
    const currentDateString = currentDate.toISOString().split('T')[0];
    const outlookKey = `tomorrow_outlook_${currentDateString}`;

    try {
      const dal = createDAL(env);

      // Get the outlook that was made for today
      const result = await dal.read(outlookKey);
      if (!result.success || !result.data) {
        logger.warn('No outlook found to evaluate', { targetDate: currentDateString });
        return null;
      }

      const outlookRecord = result.data;

      // Evaluate the outlook
      const evaluation = this.evaluateOutlookAccuracy(outlookRecord.outlook, actualMarketData);

      // Update the record with evaluation results
      outlookRecord.evaluationStatus = 'evaluated';
      outlookRecord.actualPerformance = actualMarketData;
      outlookRecord.accuracyScore = evaluation.score;
      outlookRecord.evaluationDetails = evaluation.details;
      outlookRecord.evaluationDate = new Date().toISOString();

      // Save the updated record
      const writeResult = await dal.write(outlookKey, outlookRecord, {
        expirationTtl: 14 * 24 * 60 * 60 // 14 days
      });

      if (!writeResult.success) {
        throw new Error(`Failed to update outlook: ${writeResult.error}`);
      }

      logger.info('Evaluated today\'s outlook', {
        targetDate: currentDateString,
        predictedBias: outlookRecord.outlook.marketBias,
        actualBias: actualMarketData.marketBias,
        accuracyScore: evaluation.score,
        wasCorrect: evaluation.details.biasCorrect
      });

      return outlookRecord;

    } catch (error) {
      logger.error('Failed to evaluate today\'s outlook', {
        targetDate: currentDateString,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Evaluate outlook accuracy
   */
  evaluateOutlookAccuracy(predictedOutlook, actualMarketData) {
    const evaluation = {
      score: 0,
      details: {
        biasCorrect: false,
        confidenceCorrect: false,
        performanceFactors: []
      }
    };

    try {
      // Check if market bias prediction was correct
      const biasCorrect = predictedOutlook.marketBias === actualMarketData.marketBias;
      evaluation.details.biasCorrect = biasCorrect;

      // Check if confidence level was appropriate
      const confidenceCorrect = this.wasConfidenceAppropriate(predictedOutlook.confidence, actualMarketData);
      evaluation.details.confidenceCorrect = confidenceCorrect;

      // Calculate overall accuracy score (0-100)
      let score = 0;
      if (biasCorrect) score += 50; // 50 points for correct bias
      if (confidenceCorrect) score += 30; // 30 points for appropriate confidence

      // Bonus points for performance factors
      const performanceBonus = this.calculatePerformanceBonus(predictedOutlook, actualMarketData);
      score += performanceBonus;

      evaluation.score = Math.min(100, Math.max(0, score));

      // Add performance factors details
      evaluation.details.performanceFactors = this.getPerformanceFactors(predictedOutlook, actualMarketData);

    } catch (error) {
      logger.error('Failed to evaluate outlook accuracy', { error: error.message });
      evaluation.score = 0;
    }

    return evaluation;
  }

  /**
   * Check if confidence level was appropriate
   */
  wasConfidenceAppropriate(predictedConfidence, actualMarketData) {
    const actualVolatility = actualMarketData.volatility || 'moderate';
    const actualChange = Math.abs(actualMarketData.averageChange || 0);

    // High confidence should correspond to predictable markets
    if (predictedConfidence === 'high') {
      return actualVolatility === 'low' || actualChange < 1;
    }

    // Low confidence should correspond to volatile/unpredictable markets
    if (predictedConfidence === 'low') {
      return actualVolatility === 'high' || actualChange > 2;
    }

    // Medium confidence is the default
    return predictedConfidence === 'medium';
  }

  /**
   * Calculate performance bonus points
   */
  calculatePerformanceBonus(predictedOutlook, actualMarketData) {
    let bonus = 0;

    // Bonus if key focus was appropriate
    if (predictedOutlook.keyFocus === 'Long opportunities' && actualMarketData.marketBias === 'bullish') {
      bonus += 10;
    } else if (predictedOutlook.keyFocus === 'Risk management' && actualMarketData.marketBias === 'bearish') {
      bonus += 10;
    }

    // Bonus if recommendations were relevant
    if (predictedOutlook.recommendations && predictedOutlook.recommendations.length > 0) {
      bonus += 5;
    }

    return bonus;
  }

  /**
   * Get performance factors details
   */
  getPerformanceFactors(predictedOutlook, actualMarketData) {
    const factors = [];

    // Bias accuracy
    if (predictedOutlook.marketBias === actualMarketData.marketBias) {
      factors.push(`Correctly predicted ${predictedOutlook.marketBias} bias`);
    } else {
      factors.push(`Incorrect bias prediction: predicted ${predictedOutlook.marketBias}, actual ${actualMarketData.marketBias}`);
    }

    // Volatility match
    const predictedVolatility = this.predictVolatilityFromOutlook(predictedOutlook);
    if (predictedVolatility === actualMarketData.volatility) {
      factors.push(`Correctly predicted ${predictedVolatility} volatility`);
    }

    // Key focus relevance
    if (predictedOutlook.keyFocus === 'Long opportunities' && actualMarketData.marketBias === 'bullish') {
      factors.push('Key focus aligned with market direction');
    }

    return factors;
  }

  /**
   * Predict volatility from outlook
   */
  predictVolatilityFromOutlook(outlook) {
    if (outlook.confidence === 'low') return 'high';
    if (outlook.confidence === 'high') return 'low';
    return 'moderate';
  }

  /**
   * Get outlook accuracy history (last N days)
   */
  async getOutlookAccuracyHistory(env, days = 30) {
    const history = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      // This would require listing all keys or maintaining an index
      // For now, we'll implement a simplified version
      const recentEvaluations = await this.getRecentOutlookEvaluations(env, cutoffDate);

      for (const evaluation of recentEvaluations) {
        if (evaluation.evaluationStatus === 'evaluated') {
          history.push({
            date: evaluation.targetDate,
            predictedBias: evaluation.outlook.marketBias,
            actualBias: evaluation.actualPerformance?.marketBias,
            confidence: evaluation.outlook.confidence,
            accuracyScore: evaluation.accuracyScore,
            biasCorrect: evaluation.evaluationDetails?.biasCorrect || false
          });
        }
      }

      // Sort by date
      history.sort((a, b) => new Date(b.date) - new Date(a.date));

      logger.info('Retrieved outlook accuracy history', {
        daysRequested: days,
        recordsFound: history.length,
        averageAccuracy: history.length > 0
          ? history.reduce((sum, h) => sum + h.accuracyScore, 0) / history.length
          : 0
      });

      return history;

    } catch (error) {
      logger.error('Failed to get outlook accuracy history', { error: error.message });
      return [];
    }
  }

  /**
   * Get recent outlook evaluations (simplified implementation)
   */
  async getRecentOutlookEvaluations(env, cutoffDate) {
    // Note: In a real implementation, you'd want to maintain an index
    // or use KV list functionality. For now, this is a placeholder.
    return [];
  }

  /**
   * Get outlook accuracy statistics
   */
  async getOutlookAccuracyStats(env) {
    try {
      const history = await this.getOutlookAccuracyHistory(env, 30);

      if (history.length === 0) {
        return {
          totalOutlooks: 0,
          averageAccuracy: 0,
          biasAccuracy: 0,
          bestPrediction: null,
          worstPrediction: null
        };
      }

      const totalOutlooks = history.length;
      const averageAccuracy = history.reduce((sum, h) => sum + h.accuracyScore, 0) / totalOutlooks;
      const biasCorrectCount = history.filter(h => h.biasCorrect).length;
      const biasAccuracy = (biasCorrectCount / totalOutlooks) * 100;

      const bestPrediction = history.reduce((best, current) =>
        current.accuracyScore > best.accuracyScore ? current : best);
      const worstPrediction = history.reduce((worst, current) =>
        current.accuracyScore < worst.accuracyScore ? current : worst);

      return {
        totalOutlooks,
        averageAccuracy: Math.round(averageAccuracy),
        biasAccuracy: Math.round(biasAccuracy),
        bestPrediction: {
          date: bestPrediction.date,
          accuracy: bestPrediction.accuracyScore,
          predictedBias: bestPrediction.predictedBias,
          actualBias: bestPrediction.actualBias
        },
        worstPrediction: {
          date: worstPrediction.date,
          accuracy: worstPrediction.accuracyScore,
          predictedBias: worstPrediction.predictedBias,
          actualBias: worstPrediction.actualBias
        }
      };

    } catch (error) {
      logger.error('Failed to get outlook accuracy stats', { error: error.message });
      return {
        totalOutlooks: 0,
        averageAccuracy: 0,
        biasAccuracy: 0,
        bestPrediction: null,
        worstPrediction: null
      };
    }
  }
}

// Global instance
const tomorrowOutlookTracker = new TomorrowOutlookTracker();

export {
  TomorrowOutlookTracker,
  tomorrowOutlookTracker
};