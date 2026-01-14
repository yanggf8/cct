/**
 * Intraday Data Bridge
 * Compares morning predictions with current sentiment to track accuracy
 * 
 * @author Phase 3 - Intraday Implementation
 * @since 2026-01-15
 */

import { batchDualAIAnalysis } from './dual-ai-analysis.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('intraday-data-bridge');

interface MorningPrediction {
  symbol: string;
  sentiment: string;
  confidence: number;
  articles_count: number;
}

interface IntradayPerformance {
  symbol: string;
  morning_prediction: string;
  morning_confidence: number;
  current_sentiment: string;
  current_confidence: number;
  performance: 'on_track' | 'diverged' | 'strengthened' | 'weakened';
  accuracy_score: number;
}

interface IntradayAnalysisData {
  timestamp: string;
  market_status: 'open' | 'closed';
  symbols: IntradayPerformance[];
  overall_accuracy: number;
  on_track_count: number;
  diverged_count: number;
  total_symbols: number;
}

export class IntradayDataBridge {
  private dal: ReturnType<typeof createSimplifiedEnhancedDAL>;
  private env: CloudflareEnvironment;

  constructor(env: CloudflareEnvironment) {
    this.env = env;
    this.dal = createSimplifiedEnhancedDAL(env, { enableCache: true });
  }

  /**
   * Generate intraday analysis comparing morning predictions with current sentiment
   */
  async generateIntradayAnalysis(): Promise<IntradayAnalysisData> {
    logger.info('IntradayDataBridge: Generating intraday analysis');
    const today = new Date().toISOString().split('T')[0];

    try {
      // 1. Get morning predictions from D1
      const morningPredictions = await this.getMorningPredictions(today);
      
      if (morningPredictions.length === 0) {
        logger.warn('IntradayDataBridge: No morning predictions found', { date: today });
        return this.createEmptyAnalysis();
      }

      // 2. Get current sentiment for same symbols
      const symbols = morningPredictions.map(p => p.symbol);
      logger.info('IntradayDataBridge: Analyzing current sentiment', { symbols });
      
      const currentAnalysis = await batchDualAIAnalysis(symbols, this.env, {
        timeout: 30000,
        cacheResults: false, // Don't cache intraday checks
        skipCache: true // Always get fresh data
      });

      // 3. Compare and calculate performance
      const performance: IntradayPerformance[] = [];
      
      for (const morning of morningPredictions) {
        const current = currentAnalysis.results.find(r => r.symbol === morning.symbol);
        
        if (!current || current.error) {
          logger.warn('IntradayDataBridge: Failed to get current sentiment', { 
            symbol: morning.symbol,
            error: current?.error 
          });
          continue;
        }

        const perf = this.calculatePerformance(morning, current);
        performance.push(perf);
      }

      // 4. Calculate overall metrics
      const onTrackCount = performance.filter(p => p.performance === 'on_track' || p.performance === 'strengthened').length;
      const overallAccuracy = performance.length > 0 ? onTrackCount / performance.length : 0;

      const analysisData: IntradayAnalysisData = {
        timestamp: new Date().toISOString(),
        market_status: this.isMarketOpen() ? 'open' : 'closed',
        symbols: performance,
        overall_accuracy: overallAccuracy,
        on_track_count: onTrackCount,
        diverged_count: performance.length - onTrackCount,
        total_symbols: performance.length
      };

      logger.info('IntradayDataBridge: Intraday analysis generated', {
        total_symbols: performance.length,
        on_track: onTrackCount,
        accuracy: overallAccuracy
      });

      return analysisData;

    } catch (error: unknown) {
      logger.error('IntradayDataBridge: Failed to generate intraday analysis', error);
      throw error;
    }
  }

  /**
   * Get morning predictions from D1
   */
  private async getMorningPredictions(date: string): Promise<MorningPrediction[]> {
    if (!this.env.PREDICT_JOBS_DB) {
      logger.warn('IntradayDataBridge: PREDICT_JOBS_DB not available');
      return [];
    }

    try {
      const result = await this.env.PREDICT_JOBS_DB
        .prepare(`
          SELECT symbol, sentiment, confidence, articles_count 
          FROM symbol_predictions 
          WHERE prediction_date = ? AND status = 'success'
          ORDER BY confidence DESC
        `)
        .bind(date)
        .all();

      return (result.results || []) as MorningPrediction[];
    } catch (error: unknown) {
      logger.error('IntradayDataBridge: Failed to fetch morning predictions', { error, date });
      return [];
    }
  }

  /**
   * Calculate performance metrics for a symbol
   */
  private calculatePerformance(
    morning: MorningPrediction,
    current: any
  ): IntradayPerformance {
    const currentDirection = current.signal?.direction || 'neutral';
    const currentConfidence = current.signal?.confidence || 0;

    // Normalize sentiments for comparison
    const morningNorm = this.normalizeSentiment(morning.sentiment);
    const currentNorm = this.normalizeSentiment(currentDirection);

    // Determine performance
    let performance: IntradayPerformance['performance'];
    let accuracyScore: number;

    if (morningNorm === currentNorm) {
      // Same direction
      if (currentConfidence > morning.confidence) {
        performance = 'strengthened';
        accuracyScore = 1.0;
      } else {
        performance = 'on_track';
        accuracyScore = 0.9;
      }
    } else if (morningNorm === 'neutral' || currentNorm === 'neutral') {
      // One is neutral - partial match
      performance = 'weakened';
      accuracyScore = 0.5;
    } else {
      // Opposite directions
      performance = 'diverged';
      accuracyScore = 0.0;
    }

    return {
      symbol: morning.symbol,
      morning_prediction: morning.sentiment,
      morning_confidence: morning.confidence,
      current_sentiment: currentDirection,
      current_confidence: currentConfidence,
      performance,
      accuracy_score: accuracyScore
    };
  }

  /**
   * Normalize sentiment to up/down/neutral
   */
  private normalizeSentiment(sentiment: string): 'up' | 'down' | 'neutral' {
    const s = sentiment.toLowerCase();
    if (s.includes('bull') || s === 'up' || s === 'positive') return 'up';
    if (s.includes('bear') || s === 'down' || s === 'negative') return 'down';
    return 'neutral';
  }

  /**
   * Check if market is currently open
   */
  private isMarketOpen(): boolean {
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = et.getDay();
    const hour = et.getHours();
    const minute = et.getMinutes();

    // Monday-Friday, 9:30 AM - 4:00 PM ET
    if (day === 0 || day === 6) return false; // Weekend
    if (hour < 9 || hour >= 16) return false;
    if (hour === 9 && minute < 30) return false;

    return true;
  }

  /**
   * Create empty analysis when no data available
   */
  private createEmptyAnalysis(): IntradayAnalysisData {
    return {
      timestamp: new Date().toISOString(),
      market_status: this.isMarketOpen() ? 'open' : 'closed',
      symbols: [],
      overall_accuracy: 0,
      on_track_count: 0,
      diverged_count: 0,
      total_symbols: 0
    };
  }
}
