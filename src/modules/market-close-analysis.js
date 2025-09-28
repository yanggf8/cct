/**
 * Market Close Analysis Module
 * End-of-day analysis and tomorrow outlook prediction
 */

import { createLogger } from './logging.js';
import { kvStorageManager } from './kv-storage-manager.js';
import { realTimeSignalTracker } from './real-time-tracking.js';
import { rateLimitedFetch } from './rate-limiter.js';

const logger = createLogger('market-close-analysis');

/**
 * Market Close Analysis Configuration
 */
const MARKET_CLOSE_CONFIG = {
  // Market times (EST)
  MARKET_CLOSE_TIME: '16:00',
  ANALYSIS_DELAY: 5 * 60 * 1000, // 5 minutes after close

  // Performance thresholds
  HIGH_ACCURACY_THRESHOLD: 0.8,
  GOOD_ACCURACY_THRESHOLD: 0.65,
  POOR_ACCURACY_THRESHOLD: 0.5,

  // Confidence levels
  HIGH_CONFIDENCE_MIN: 70,
  VERY_HIGH_CONFIDENCE_MIN: 85,

  // Signal status thresholds
  DIVERGENCE_THRESHOLD_HIGH: 0.05,
  DIVERGENCE_THRESHOLD_MEDIUM: 0.02
};

/**
 * Market Close Analysis Engine
 */
class MarketCloseAnalysisEngine {
  constructor() {
    this.marketData = new Map();
    this.signalPerformance = new Map();
  }

  /**
   * Run comprehensive market close analysis
   */
  async runMarketCloseAnalysis(env, date) {
    const analysisId = crypto.randomUUID();
    logger.info('🏁 [MARKET-CLOSE] Starting market close analysis', {
      analysisId,
      date: date.toISOString().split('T')[0]
    });

    try {
      // Get today's signals
      const todaySignals = await kvStorageManager.getHighConfidenceSignals(env, date);
      if (!todaySignals || !todaySignals.signals) {
        logger.warn('No signals found for today', { date: date.toISOString().split('T')[0] });
        return this.getDefaultMarketCloseAnalysis();
      }

      // Load active signals for performance tracking
      await realTimeSignalTracker.loadActiveSignals(env, date);

      // Update all signal performances with current prices
      await realTimeSignalTracker.updateAllSignalPerformances(env, date);

      // Get final signal summary
      const signalSummary = await realTimeSignalTracker.getSignalSummary(env, date);

      // Get market close data
      const marketCloseData = await this.getMarketCloseData(env, todaySignals.signals);

      // Generate tomorrow outlook
      const tomorrowOutlook = await this.generateTomorrowOutlook(env, todaySignals.signals, signalSummary);

      // Calculate performance metrics
      const performanceMetrics = this.calculatePerformanceMetrics(signalSummary);

      // Build comprehensive analysis result
      const analysisResult = {
        analysisId,
        date: date.toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        marketCloseData,
        signalSummary,
        tomorrowOutlook,
        performanceMetrics,
        topPerformers: signalSummary.topPerformers || [],
        underperformers: signalSummary.underperformers || [],
        divergentSignals: realTimeSignalTracker.getDivergentSignals(),
        systemStatus: 'operational',
        metadata: {
          totalSignals: todaySignals.signals.length,
          analysisDuration: Date.now() - Date.now(), // Will be updated
          version: '1.0'
        }
      };

      // Store analysis result
      await this.storeMarketCloseAnalysis(env, date, analysisResult);

      logger.info('✅ [MARKET-CLOSE] Market close analysis completed', {
        analysisId,
        signalCount: todaySignals.signals.length,
        averageAccuracy: signalSummary.averageAccuracy.toFixed(2)
      });

      return analysisResult;

    } catch (error) {
      logger.error('❌ [MARKET-CLOSE] Market close analysis failed', {
        analysisId,
        error: error.message
      });
      return this.getDefaultMarketCloseAnalysis();
    }
  }

  /**
   * Get market close data for signals
   */
  async getMarketCloseData(env, signals) {
    const symbols = signals.map(s => s.symbol);
    const uniqueSymbols = [...new Set(symbols)];

    const marketCloseData = {
      status: 'normal',
      volatility: 'moderate',
      volume: 'average',
      marketConditions: {},
      closingPrices: {},
      marketEvents: []
    };

    try {
      // Get current market data for all symbols
      const marketDataPromises = uniqueSymbols.map(symbol => this.getSymbolMarketData(symbol));
      const marketDataResults = await Promise.allSettled(marketDataPromises);

      // Process market data
      marketDataResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const symbol = uniqueSymbols[index];
          marketCloseData.closingPrices[symbol] = result.value;
        }
      });

      // Determine overall market status
      const priceChanges = Object.values(marketCloseData.closingPrices).map(p => p.changePercent);
      const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
      const volatility = Math.sqrt(priceChanges.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / priceChanges.length);

      // Set market status
      if (Math.abs(avgChange) > 1) {
        marketCloseData.status = avgChange > 0 ? 'bullish' : 'bearish';
      }

      if (volatility > 2) {
        marketCloseData.volatility = 'high';
      } else if (volatility < 0.5) {
        marketCloseData.volatility = 'low';
      }

      marketCloseData.marketConditions = {
        averageChange: avgChange,
        volatility,
        trendStrength: Math.abs(avgChange),
        riskLevel: this.calculateRiskLevel(volatility, avgChange)
      };

    } catch (error) {
      logger.error('Failed to get market close data', { error: error.message });
    }

    return marketCloseData;
  }

  /**
   * Get symbol market data
   */
  async getSymbolMarketData(symbol) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;

      const response = await rateLimitedFetch(url, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance API returned ${response.status}`);
      }

      const data = await response.json();
      const result = data.chart.result[0];

      if (!result || !result.indicators || !result.timestamp || result.timestamp.length < 2) {
        throw new Error('Insufficient market data');
      }

      const timestamps = result.timestamp;
      const quote = result.indicators.quote[0];

      const todayIndex = timestamps.length - 1;
      const yesterdayIndex = timestamps.length - 2;

      const todayClose = quote.close[todayIndex];
      const yesterdayClose = quote.close[yesterdayIndex];
      const todayVolume = quote.volume[todayIndex] || 0;

      const change = todayClose - yesterdayClose;
      const changePercent = (change / yesterdayClose) * 100;

      return {
        symbol,
        currentPrice: todayClose,
        previousClose: yesterdayClose,
        change,
        changePercent,
        volume: todayVolume,
        timestamp: timestamps[todayIndex] * 1000
      };

    } catch (error) {
      logger.error('Failed to get symbol market data', { symbol, error: error.message });
      return null;
    }
  }

  /**
   * Generate tomorrow outlook
   */
  async generateTomorrowOutlook(env, signals, signalSummary) {
    const outlook = {
      marketBias: 'neutral',
      confidenceLevel: 'medium',
      keyFocus: 'Market Open',
      riskLevel: 'moderate',
      expectedVolatility: 'moderate',
      recommendedApproach: 'Balanced approach with selective signal execution',
      reasoning: '',
      topSignals: [],
      riskFactors: []
    };

    try {
      // Analyze signal performance trends
      const avgAccuracy = signalSummary.averageAccuracy || 0;
      const divergentCount = signalSummary.divergentSignals || 0;
      const totalSignals = signalSummary.totalSignals || 1;

      // Determine market bias based on signal performance
      const bullishAccuracy = this.calculateBullishAccuracy(signals);
      const bearishAccuracy = this.calculateBearishAccuracy(signals);

      if (bullishAccuracy > bearishAccuracy && bullishAccuracy > 0.6) {
        outlook.marketBias = 'bullish';
      } else if (bearishAccuracy > bullishAccuracy && bearishAccuracy > 0.6) {
        outlook.marketBias = 'bearish';
      }

      // Determine confidence level
      if (avgAccuracy > MARKET_CLOSE_CONFIG.HIGH_ACCURACY_THRESHOLD && divergentCount / totalSignals < 0.2) {
        outlook.confidenceLevel = 'high';
      } else if (avgAccuracy < MARKET_CLOSE_CONFIG.GOOD_ACCURACY_THRESHOLD || divergentCount / totalSignals > 0.4) {
        outlook.confidenceLevel = 'low';
      }

      // Set key focus based on performance
      if (divergentCount > 0) {
        outlook.keyFocus = 'Signal Validation';
        outlook.riskFactors.push('High divergence detected in some signals');
      } else if (avgAccuracy > 0.8) {
        outlook.keyFocus = 'Opportunity Identification';
      } else {
        outlook.keyFocus = 'Risk Management';
      }

      // Set risk level
      const divergenceRate = divergentCount / totalSignals;
      if (divergenceRate > 0.3) {
        outlook.riskLevel = 'high';
        outlook.expectedVolatility = 'high';
      } else if (divergenceRate < 0.1 && avgAccuracy > 0.7) {
        outlook.riskLevel = 'low';
        outlook.expectedVolatility = 'low';
      }

      // Generate reasoning
      outlook.reasoning = this.generateOutlookReasoning(outlook, signalSummary);

      // Get top performing signals for tomorrow
      outlook.topSignals = signalSummary.topPerformers?.slice(0, 3) || [];

    } catch (error) {
      logger.error('Failed to generate tomorrow outlook', { error: error.message });
    }

    return outlook;
  }

  /**
   * Calculate performance metrics
   */
  calculatePerformanceMetrics(signalSummary) {
    const metrics = {
      overallAccuracy: signalSummary.averageAccuracy || 0,
      highConfidenceAccuracy: 0,
      signalReliability: 0,
      predictionQuality: 'unknown',
      consistencyScore: 0
    };

    try {
      const totalSignals = signalSummary.totalSignals || 1;
      const validatedSignals = signalSummary.validatedSignals || 0;
      const divergentSignals = signalSummary.divergentSignals || 0;
      const highConfidenceSignals = signalSummary.highConfidenceSignals || 0;

      // Calculate overall metrics
      metrics.signalReliability = validatedSignals / totalSignals;
      metrics.consistencyScore = Math.max(0, 100 - (divergentSignals / totalSignals) * 100);

      // Determine prediction quality
      if (metrics.overallAccuracy > 0.8 && metrics.signalReliability > 0.8) {
        metrics.predictionQuality = 'excellent';
      } else if (metrics.overallAccuracy > 0.65 && metrics.signalReliability > 0.65) {
        metrics.predictionQuality = 'good';
      } else if (metrics.overallAccuracy > 0.5) {
        metrics.predictionQuality = 'moderate';
      } else {
        metrics.predictionQuality = 'poor';
      }

    } catch (error) {
      logger.error('Failed to calculate performance metrics', { error: error.message });
    }

    return metrics;
  }

  /**
   * Store market close analysis
   */
  async storeMarketCloseAnalysis(env, date, analysisResult) {
    try {
      await kvStorageManager.storeDailyReport(
        env,
        'end-of-day',
        date,
        analysisResult
      );

      logger.debug('Stored market close analysis', {
        date: date.toISOString().split('T')[0],
        analysisId: analysisResult.analysisId
      });

    } catch (error) {
      logger.error('Failed to store market close analysis', {
        date: date.toISOString().split('T')[0],
        error: error.message
      });
    }
  }

  /**
   * Helper functions
   */
  calculateBullishAccuracy(signals) {
    const bullishSignals = signals.filter(s => s.prediction === 'up');
    if (bullishSignals.length === 0) return 0;

    const accurateBullish = bullishSignals.filter(s => s.status === 'validated').length;
    return accurateBullish / bullishSignals.length;
  }

  calculateBearishAccuracy(signals) {
    const bearishSignals = signals.filter(s => s.prediction === 'down');
    if (bearishSignals.length === 0) return 0;

    const accurateBearish = bearishSignals.filter(s => s.status === 'validated').length;
    return accurateBearish / bearishSignals.length;
  }

  calculateRiskLevel(volatility, avgChange) {
    const riskScore = volatility + Math.abs(avgChange);
    if (riskScore > 3) return 'high';
    if (riskScore > 1.5) return 'moderate';
    return 'low';
  }

  generateOutlookReasoning(outlook, signalSummary) {
    const reasons = [];

    if (outlook.marketBias !== 'neutral') {
      reasons.push(`Market bias indicates ${outlook.marketBias} conditions`);
    }

    if (outlook.confidenceLevel === 'high') {
      reasons.push('High signal accuracy supports confident predictions');
    }

    if (signalSummary.divergentSignals > 0) {
      reasons.push('Some signals showing divergence requires monitoring');
    }

    if (outlook.riskLevel === 'high') {
      reasons.push('Higher volatility expected - caution advised');
    }

    return reasons.join('; ');
  }

  getDefaultMarketCloseAnalysis() {
    return {
      marketCloseData: {
        status: 'unknown',
        volatility: 'moderate',
        volume: 'average',
        closingPrices: {}
      },
      signalSummary: {
        totalSignals: 0,
        averageAccuracy: 0,
        topPerformers: [],
        underperformers: []
      },
      tomorrowOutlook: {
        marketBias: 'neutral',
        confidenceLevel: 'medium',
        keyFocus: 'Market Open',
        riskLevel: 'moderate'
      },
      performanceMetrics: {
        overallAccuracy: 0,
        predictionQuality: 'unknown'
      },
      systemStatus: 'operational'
    };
  }
}

// Global instance
const marketCloseAnalysisEngine = new MarketCloseAnalysisEngine();

export {
  MarketCloseAnalysisEngine,
  MARKET_CLOSE_CONFIG,
  marketCloseAnalysisEngine
};