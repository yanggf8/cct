/**
 * Enhanced KV Storage Manager for 4-Report Workflow
 * Real-time signal tracking and data persistence
 */

import { createLogger } from './logging.js';

const logger = createLogger('kv-storage-manager');

/**
 * KV Storage Schema for 4-Report System
 */
const KV_KEYS = {
  // Signal Tracking (Real-time)
  HIGH_CONFIDENCE_SIGNALS: (date) => `high_confidence_signals_${date}`,
  SIGNAL_TRACKING: (date) => `signal_tracking_${date}`,
  SIGNAL_PERFORMANCE: (date) => `signal_performance_${date}`,

  // Market Data (Real-time)
  MARKET_PRICES: (symbol) => `market_prices_${symbol}`,
  INTRADAY_DATA: (date) => `intraday_data_${date}`,

  // Report Data (Daily)
  PRE_MARKET_BRIEFING: (date) => `pre_market_briefing_${date}`,
  INTRADAY_CHECK: (date) => `intraday_check_${date}`,
  END_OF_DAY_SUMMARY: (date) => `end_of_day_summary_${date}`,

  // Weekly Data
  WEEKLY_SIGNALS: (weekStart) => `weekly_signals_${weekStart}`,
  WEEKLY_PERFORMANCE: (weekStart) => `weekly_performance_${weekStart}`,
  WEEKLY_REVIEW: (weekStart) => `weekly_review_${weekStart}`,

  // Configuration
  SYSTEM_CONFIG: 'system_config',
  PERFORMANCE_METRICS: 'performance_metrics',
  SIGNAL_THRESHOLDS: 'signal_thresholds'
};

/**
 * TTL Configuration (in seconds)
 */
const TTL_CONFIG = {
  // Signal tracking data - 90 days for analysis
  SIGNAL_DATA: 90 * 24 * 60 * 60,

  // Daily reports - 7 days for quick access
  DAILY_REPORTS: 7 * 24 * 60 * 60,

  // Weekly reports - 30 days for trend analysis
  WEEKLY_REPORTS: 30 * 24 * 60 * 60,

  // Market prices - 1 day for real-time data
  MARKET_PRICES: 24 * 60 * 60,

  // Intraday data - 3 days for performance analysis
  INTRADAY_DATA: 3 * 24 * 60 * 60,

  // Configuration - No expiration
  CONFIG: null
};

/**
 * Enhanced KV Storage Manager
 */
class KVStorageManager {
  constructor() {
    this.cache = new Map();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Store high-confidence signals with metadata
   */
  async storeHighConfidenceSignals(env, date, signals) {
    const dateStr = date.toISOString().split('T')[0];
    const signalsKey = KV_KEYS.HIGH_CONFIDENCE_SIGNALS(dateStr);

    try {
      const signalsData = {
        date: dateStr,
        signals: signals,
        metadata: {
          totalSignals: signals.length,
          highConfidenceSignals: signals.filter(s => s.confidence >= 80).length,
          averageConfidence: signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length,
          bullishSignals: signals.filter(s => s.prediction === 'up').length,
          bearishSignals: signals.filter(s => s.prediction === 'down').length,
          neutralSignals: signals.filter(s => s.prediction === 'neutral').length,
          generatedAt: new Date().toISOString(),
          symbols: signals.map(s => s.symbol)
        }
      };

      await env.TRADING_RESULTS.put(signalsKey, JSON.stringify(signalsData), {
        expirationTtl: TTL_CONFIG.SIGNAL_DATA
      });

      // Update cache
      this.cache.set(signalsKey, signalsData);

      logger.info('Stored high-confidence signals', {
        date: dateStr,
        signalCount: signals.length,
        highConfidenceCount: signalsData.metadata.highConfidenceSignals,
        averageConfidence: signalsData.metadata.averageConfidence.toFixed(1)
      });

      return true;
    } catch (error) {
      logger.error('Failed to store high-confidence signals', {
        date: dateStr,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get high-confidence signals for a specific date
   */
  async getHighConfidenceSignals(env, date) {
    const dateStr = date.toISOString().split('T')[0];
    const signalsKey = KV_KEYS.HIGH_CONFIDENCE_SIGNALS(dateStr);

    // Check cache first
    if (this.cache.has(signalsKey)) {
      this.hitCount++;
      return this.cache.get(signalsKey);
    }

    try {
      const signalsData = await env.TRADING_RESULTS.get(signalsKey);
      if (signalsData) {
        const parsed = JSON.parse(signalsData);
        this.cache.set(signalsKey, parsed);
        this.missCount++;
        return parsed;
      }
    } catch (error) {
      logger.error('Failed to retrieve high-confidence signals', {
        date: dateStr,
        error: error.message
      });
    }

    this.missCount++;
    return null;
  }

  /**
   * Update signal tracking data in real-time
   */
  async updateSignalTracking(env, signalId, trackingData, date) {
    const dateStr = date.toISOString().split('T')[0];
    const trackingKey = KV_KEYS.SIGNAL_TRACKING(dateStr);

    try {
      let trackingRecord = await this.getSignalTracking(env, date);

      if (!trackingRecord) {
        trackingRecord = {
          date: dateStr,
          signals: [],
          lastUpdated: new Date().toISOString()
        };
      }

      // Find and update the signal
      const signalIndex = trackingRecord.signals.findIndex(s => s.id === signalId);
      if (signalIndex >= 0) {
        trackingRecord.signals[signalIndex] = {
          ...trackingRecord.signals[signalIndex],
          ...trackingData,
          lastUpdated: new Date().toISOString()
        };
      } else {
        // Add new signal
        trackingRecord.signals.push({
          id: signalId,
          ...trackingData,
          createdAt: new Date().toISOString()
        });
      }

      trackingRecord.lastUpdated = new Date().toISOString();

      await env.TRADING_RESULTS.put(trackingKey, JSON.stringify(trackingRecord), {
        expirationTtl: TTL_CONFIG.SIGNAL_DATA
      });

      // Update cache
      this.cache.set(trackingKey, trackingRecord);

      logger.debug('Updated signal tracking', {
        signalId,
        date: dateStr,
        status: trackingData.status
      });

      return true;
    } catch (error) {
      logger.error('Failed to update signal tracking', {
        signalId,
        date: dateStr,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get signal tracking data for a date
   */
  async getSignalTracking(env, date) {
    const dateStr = date.toISOString().split('T')[0];
    const trackingKey = KV_KEYS.SIGNAL_TRACKING(dateStr);

    // Check cache first
    if (this.cache.has(trackingKey)) {
      this.hitCount++;
      return this.cache.get(trackingKey);
    }

    try {
      const trackingData = await env.TRADING_RESULTS.get(trackingKey);
      if (trackingData) {
        const parsed = JSON.parse(trackingData);
        this.cache.set(trackingKey, parsed);
        this.missCount++;
        return parsed;
      }
    } catch (error) {
      logger.error('Failed to retrieve signal tracking', {
        date: dateStr,
        error: error.message
      });
    }

    this.missCount++;
    return null;
  }

  /**
   * Store market prices for real-time tracking
   */
  async storeMarketPrices(env, symbol, priceData) {
    const pricesKey = KV_KEYS.MARKET_PRICES(symbol);

    try {
      const marketData = {
        symbol,
        currentPrice: priceData.currentPrice,
        timestamp: new Date().toISOString(),
        priceHistory: priceData.priceHistory || [],
        volume: priceData.volume,
        change: priceData.change,
        changePercent: priceData.changePercent
      };

      await env.TRADING_RESULTS.put(pricesKey, JSON.stringify(marketData), {
        expirationTtl: TTL_CONFIG.MARKET_PRICES
      });

      // Update cache
      this.cache.set(pricesKey, marketData);

      logger.debug('Stored market prices', {
        symbol,
        currentPrice: priceData.currentPrice,
        changePercent: priceData.changePercent
      });

      return true;
    } catch (error) {
      logger.error('Failed to store market prices', {
        symbol,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get current market prices
   */
  async getMarketPrices(env, symbol) {
    const pricesKey = KV_KEYS.MARKET_PRICES(symbol);

    // Check cache first
    if (this.cache.has(pricesKey)) {
      this.hitCount++;
      return this.cache.get(pricesKey);
    }

    try {
      const pricesData = await env.TRADING_RESULTS.get(pricesKey);
      if (pricesData) {
        const parsed = JSON.parse(pricesData);
        this.cache.set(pricesKey, parsed);
        this.missCount++;
        return parsed;
      }
    } catch (error) {
      logger.error('Failed to retrieve market prices', {
        symbol,
        error: error.message
      });
    }

    this.missCount++;
    return null;
  }

  /**
   * Store daily report data
   */
  async storeDailyReport(env, reportType, date, reportData) {
    const dateStr = date.toISOString().split('T')[0];
    let reportKey;

    switch (reportType) {
      case 'pre-market':
        reportKey = KV_KEYS.PRE_MARKET_BRIEFING(dateStr);
        break;
      case 'intraday':
        reportKey = KV_KEYS.INTRADAY_CHECK(dateStr);
        break;
      case 'end-of-day':
        reportKey = KV_KEYS.END_OF_DAY_SUMMARY(dateStr);
        break;
      default:
        logger.error('Unknown report type', { reportType });
        return false;
    }

    try {
      const enhancedReportData = {
        ...reportData,
        metadata: {
          reportType,
          date: dateStr,
          generatedAt: new Date().toISOString(),
          version: '1.0'
        }
      };

      await env.TRADING_RESULTS.put(reportKey, JSON.stringify(enhancedReportData), {
        expirationTtl: TTL_CONFIG.DAILY_REPORTS
      });

      // Update cache
      this.cache.set(reportKey, enhancedReportData);

      logger.info('Stored daily report', {
        reportType,
        date: dateStr,
        dataSize: JSON.stringify(enhancedReportData).length
      });

      return true;
    } catch (error) {
      logger.error('Failed to store daily report', {
        reportType,
        date: dateStr,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get daily report data
   */
  async getDailyReport(env, reportType, date) {
    const dateStr = date.toISOString().split('T')[0];
    let reportKey;

    switch (reportType) {
      case 'pre-market':
        reportKey = KV_KEYS.PRE_MARKET_BRIEFING(dateStr);
        break;
      case 'intraday':
        reportKey = KV_KEYS.INTRADAY_CHECK(dateStr);
        break;
      case 'end-of-day':
        reportKey = KV_KEYS.END_OF_DAY_SUMMARY(dateStr);
        break;
      default:
        logger.error('Unknown report type', { reportType });
        return null;
    }

    // Check cache first
    if (this.cache.has(reportKey)) {
      this.hitCount++;
      return this.cache.get(reportKey);
    }

    try {
      const reportData = await env.TRADING_RESULTS.get(reportKey);
      if (reportData) {
        const parsed = JSON.parse(reportData);
        this.cache.set(reportKey, parsed);
        this.missCount++;
        return parsed;
      }
    } catch (error) {
      logger.error('Failed to retrieve daily report', {
        reportType,
        date: dateStr,
        error: error.message
      });
    }

    this.missCount++;
    return null;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

    return {
      cacheHits: this.hitCount,
      cacheMisses: this.missCount,
      totalRequests,
      hitRate: hitRate,
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear cache entries
   */
  clearCache() {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    logger.info('Cleared KV storage cache');
  }
}

// Global instance
const kvStorageManager = new KVStorageManager();

export {
  KVStorageManager,
  KV_KEYS,
  TTL_CONFIG,
  kvStorageManager
};