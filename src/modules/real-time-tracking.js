/**
 * Real-Time Signal Tracking System
 * Live monitoring and performance analysis for high-confidence signals
 */

import { createLogger } from './logging.js';
import { kvStorageManager } from './kv-storage-manager.js';
import { rateLimitedFetch } from './rate-limiter.js';
import { withCache } from './market-data-cache.js';

const logger = createLogger('real-time-tracking');

/**
 * Real-time tracking configuration
 */
const TRACKING_CONFIG = {
  // Update intervals (in milliseconds)
  PRICE_UPDATE_INTERVAL: 5 * 60 * 1000, // 5 minutes
  SIGNAL_CHECK_INTERVAL: 10 * 60 * 1000, // 10 minutes
  PERFORMANCE_UPDATE_INTERVAL: 15 * 60 * 1000, // 15 minutes

  // Performance thresholds
  DIVERGENCE_THRESHOLD_HIGH: 0.05, // 5% divergence
  DIVERGENCE_THRESHOLD_MEDIUM: 0.02, // 2% divergence
  ACCURACY_THRESHOLD_HIGH: 0.8, // 80% accuracy
  ACCURACY_THRESHOLD_LOW: 0.6, // 60% accuracy

  // Confidence levels
  HIGH_CONFIDENCE_MIN: 70,
  VERY_HIGH_CONFIDENCE_MIN: 85
};

/**
 * Real-time price tracking
 */
class RealTimePriceTracker {
  constructor() {
    this.priceCache = new Map();
    this.lastUpdateTime = new Map();
  }

  /**
   * Get current market price for a symbol
   */
  async getCurrentPrice(symbol) {
    try {
      // Use cached data if recent (within 5 minutes)
      const lastUpdate = this.lastUpdateTime.get(symbol);
      const now = Date.now();

      if (lastUpdate && (now - lastUpdate < TRACKING_CONFIG.PRICE_UPDATE_INTERVAL)) {
        return this.priceCache.get(symbol);
      }

      // Fetch fresh data from Yahoo Finance
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;

      const response = await rateLimitedFetch(url, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance API returned ${response.status}`);
      }

      const data = await response.json();
      const result = data.chart.result[0];

      if (!result || !result.indicators) {
        throw new Error('Invalid response format from Yahoo Finance');
      }

      const timestamps = result.timestamp;
      const quote = result.indicators.quote[0];

      if (!timestamps || timestamps.length === 0) {
        throw new Error('No price data available');
      }

      // Get the latest price
      const latestIndex = timestamps.length - 1;
      const currentPrice = quote.close[latestIndex];
      const previousPrice = quote.close[latestIndex - 1] || currentPrice;

      const priceData = {
        symbol,
        currentPrice,
        previousPrice,
        change: currentPrice - previousPrice,
        changePercent: ((currentPrice - previousPrice) / previousPrice) * 100,
        timestamp: timestamps[latestIndex] * 1000, // Convert to milliseconds
        volume: quote.volume[latestIndex] || 0,
        lastUpdated: Date.now()
      };

      // Update cache
      this.priceCache.set(symbol, priceData);
      this.lastUpdateTime.set(symbol, Date.now());

      logger.debug('Updated current price', {
        symbol,
        currentPrice,
        changePercent: priceData.changePercent.toFixed(2)
      });

      return priceData;
    } catch (error) {
      logger.error('Failed to get current price', {
        symbol,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get batch prices for multiple symbols
   */
  async getBatchPrices(symbols) {
    const prices = {};
    const promises = symbols.map(async (symbol) => {
      const price = await this.getCurrentPrice(symbol);
      return { symbol, price };
    });

    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        prices[result.value.symbol] = result.value.price;
      } else {
        logger.warn('Failed to get price for symbol', {
          symbol: symbols[index],
          error: result.reason?.message
        });
      }
    });

    return prices;
  }

  /**
   * Clear price cache
   */
  clearCache() {
    this.priceCache.clear();
    this.lastUpdateTime.clear();
    logger.info('Cleared price tracking cache');
  }
}

/**
 * Real-time signal performance tracking
 */
class RealTimeSignalTracker {
  constructor() {
    this.priceTracker = new RealTimePriceTracker();
    this.activeSignals = new Map();
  }

  /**
   * Load active signals for tracking
   */
  async loadActiveSignals(env, date) {
    try {
      const signalsData = await kvStorageManager.getHighConfidenceSignals(env, date);
      if (signalsData && signalsData.signals) {
        signalsData.signals.forEach(signal => {
          this.activeSignals.set(signal.id, signal);
        });

        logger.info('Loaded active signals for tracking', {
          date: date.toISOString().split('T')[0],
          signalCount: signalsData.signals.length
        });
      }
    } catch (error) {
      logger.error('Failed to load active signals', {
        date: date.toISOString().split('T')[0],
        error: error.message
      });
    }
  }

  /**
   * Update all signal performances in real-time
   */
  async updateAllSignalPerformances(env, date) {
    const symbols = Array.from(this.activeSignals.values()).map(s => s.symbol);
    const uniqueSymbols = [...new Set(symbols)];

    if (uniqueSymbols.length === 0) {
      logger.debug('No active signals to track');
      return;
    }

    // Get current prices for all symbols
    const currentPrices = await this.priceTracker.getBatchPrices(uniqueSymbols);

    // Update each signal's performance
    const updates = [];
    for (const [signalId, signal] of this.activeSignals) {
      const currentPrice = currentPrices[signal.symbol];
      if (currentPrice) {
        const performanceUpdate = this.calculateSignalPerformance(signal, currentPrice);
        updates.push(this.updateSignalPerformance(env, signalId, performanceUpdate, date));
      }
    }

    // Wait for all updates to complete
    await Promise.allSettled(updates);

    logger.debug('Updated all signal performances', {
      signalCount: this.activeSignals.size,
      symbolCount: uniqueSymbols.length
    });
  }

  /**
   * Calculate signal performance based on current price
   */
  calculateSignalPerformance(signal, currentPrice) {
    const prediction = signal.prediction;
    const predictedPrice = signal.predictedPrice;
    const currentPriceValue = currentPrice.currentPrice;
    const changePercent = currentPrice.changePercent;

    // Calculate prediction accuracy
    let isCorrect = false;
    let accuracy = 0;

    if (prediction === 'up' && changePercent > 0) {
      isCorrect = true;
      accuracy = Math.min(changePercent * 10, 1); // Scale change to accuracy
    } else if (prediction === 'down' && changePercent < 0) {
      isCorrect = true;
      accuracy = Math.min(Math.abs(changePercent) * 10, 1);
    } else if (prediction === 'neutral' && Math.abs(changePercent) < 0.5) {
      isCorrect = true;
      accuracy = 1 - Math.abs(changePercent) / 0.5;
    }

    // Calculate divergence level
    const predictedChange = predictedPrice - signal.currentPrice;
    const actualChange = currentPriceValue - signal.currentPrice;
    const divergence = Math.abs(predictedChange - actualChange) / Math.abs(signal.currentPrice);

    let divergenceLevel = 'low';
    if (divergence > TRACKING_CONFIG.DIVERGENCE_THRESHOLD_HIGH) {
      divergenceLevel = 'high';
    } else if (divergence > TRACKING_CONFIG.DIVERGENCE_THRESHOLD_MEDIUM) {
      divergenceLevel = 'medium';
    }

    // Determine signal status
    let status = signal.status;
    if (divergenceLevel === 'high' && !isCorrect) {
      status = 'divergent';
    } else if (isCorrect && accuracy > TRACKING_CONFIG.ACCURACY_THRESHOLD_HIGH) {
      status = 'validated';
    } else if (isCorrect && accuracy > TRACKING_CONFIG.ACCURACY_THRESHOLD_LOW) {
      status = 'tracking';
    }

    return {
      currentPrice: currentPriceValue,
      changePercent,
      isCorrect,
      accuracy,
      divergenceLevel,
      status,
      lastUpdated: Date.now(),
      priceTimestamp: currentPrice.timestamp
    };
  }

  /**
   * Update individual signal performance
   */
  async updateSignalPerformance(env, signalId, performanceUpdate, date) {
    try {
      // Update in-memory tracking
      const signal = this.activeSignals.get(signalId);
      if (signal) {
        signal.tracking.intradayPerformance = performanceUpdate;
        signal.status = performanceUpdate.status;
      }

      // Update KV storage
      await kvStorageManager.updateSignalTracking(env, signalId, {
        intradayPerformance: performanceUpdate,
        status: performanceUpdate.status,
        lastUpdated: new Date().toISOString()
      }, date);

      logger.debug('Updated signal performance', {
        signalId,
        symbol: signal?.symbol,
        status: performanceUpdate.status,
        accuracy: performanceUpdate.accuracy.toFixed(2)
      });
    } catch (error) {
      logger.error('Failed to update signal performance', {
        signalId,
        error: error.message
      });
    }
  }

  /**
   * Get signal summary for intraday report
   */
  async getSignalSummary(env, date) {
    const signals = Array.from(this.activeSignals.values());

    const summary = {
      totalSignals: signals.length,
      highConfidenceSignals: signals.filter(s => s.confidence >= TRACKING_CONFIG.HIGH_CONFIDENCE_MIN).length,
      validatedSignals: signals.filter(s => s.status === 'validated').length,
      divergentSignals: signals.filter(s => s.status === 'divergent').length,
      trackingSignals: signals.filter(s => s.status === 'tracking').length,
      averageAccuracy: 0,
      topPerformers: [],
      underperformers: [],
      signalsByStatus: {}
    };

    // Calculate average accuracy
    const validPerformances = signals
      .map(s => s.tracking?.intradayPerformance?.accuracy)
      .filter(acc => acc !== undefined && acc !== null);

    if (validPerformances.length > 0) {
      summary.averageAccuracy = validPerformances.reduce((sum, acc) => sum + acc, 0) / validPerformances.length;
    }

    // Group signals by status
    signals.forEach(signal => {
      const status = signal.status;
      if (!summary.signalsByStatus[status]) {
        summary.signalsByStatus[status] = [];
      }
      summary.signalsByStatus[status].push(signal);
    });

    // Identify top performers and underperformers
    const signalPerformances = signals
      .map(signal => ({
        symbol: signal.symbol,
        confidence: signal.confidence,
        accuracy: signal.tracking?.intradayPerformance?.accuracy || 0,
        divergenceLevel: signal.tracking?.intradayPerformance?.divergenceLevel || 'unknown',
        status: signal.status
      }))
      .filter(sp => sp.accuracy > 0);

    // Sort by accuracy
    signalPerformances.sort((a, b) => b.accuracy - a.accuracy);

    summary.topPerformers = signalPerformances.slice(0, 3);
    summary.underperformers = signalPerformances.slice(-3).reverse();

    return summary;
  }

  /**
   * Get divergent signals for alerting
   */
  getDivergentSignals() {
    return Array.from(this.activeSignals.values()).filter(signal =>
      signal.tracking?.intradayPerformance?.divergenceLevel === 'high'
    );
  }

  /**
   * Clear active signals
   */
  clearActiveSignals() {
    this.activeSignals.clear();
    this.priceTracker.clearCache();
    logger.info('Cleared active signals tracking');
  }
}

// Global instance
const realTimeSignalTracker = new RealTimeSignalTracker();

export {
  RealTimePriceTracker,
  RealTimeSignalTracker,
  TRACKING_CONFIG,
  realTimeSignalTracker
};