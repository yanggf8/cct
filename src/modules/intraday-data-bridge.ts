/**
 * Intraday Data Bridge
 * Compares morning predictions with current sentiment to track accuracy
 * 
 * @author Phase 3 - Intraday Implementation
 * @since 2026-01-15
 */

import { batchDualAIAnalysis, type DualAIComparisonResult } from './dual-ai-analysis.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('intraday-data-bridge');

/**
 * Raw morning prediction from D1 with full dual model data
 */
interface MorningPrediction {
  symbol: string;
  sentiment: string;
  confidence: number | null;  // D1 can return null
  articles_count: number;
  // Dual model data from D1
  gemma_status: string | null;
  gemma_error: string | null;
  gemma_confidence: number | null;
  gemma_response_time_ms: number | null;
  distilbert_status: string | null;
  distilbert_error: string | null;
  distilbert_confidence: number | null;
  distilbert_response_time_ms: number | null;
  model_selection_reason: string | null;
  // Additional data
  direction: string | null;
  trading_signals: string | null;
}

/**
 * Model result for display - includes status, error, confidence
 */
export interface ModelDisplayResult {
  status: 'success' | 'failed' | 'timeout' | 'skipped' | 'no_data';
  error: string | null;           // Actual error message if failed
  confidence: number | null;
  direction: string | null;
  response_time_ms: number | null;
}

/**
 * Sentiment data for one time period (pre-market or intraday)
 */
export interface PeriodSentimentData {
  direction: string;              // 'bullish' | 'bearish' | 'neutral' | 'failed'
  confidence: number | null;
  reasoning: string;
  gemma: ModelDisplayResult;
  distilbert: ModelDisplayResult;
  agreement: string;              // 'AGREE' | 'DISAGREE' | 'PARTIAL' | 'ERROR'
  articles_count: number;
  status: 'success' | 'partial' | 'failed';
  error: string | null;           // Overall error if both models failed
}

/**
 * Side-by-side comparison for a single symbol
 */
export interface IntradaySymbolComparison {
  symbol: string;
  premarket: PeriodSentimentData;
  intraday: PeriodSentimentData;
  comparison: {
    direction_match: boolean;
    confidence_change: number | null;  // intraday - premarket (null if either missing)
    status: 'consistent' | 'shifted' | 'reversed' | 'incomplete';
  };
}

/**
 * Legacy interface for backward compatibility
 */
interface IntradayPerformance {
  symbol: string;
  morning_prediction: string;
  morning_confidence: number;
  current_sentiment: string;
  current_confidence: number;
  performance: 'on_track' | 'diverged' | 'strengthened' | 'weakened';
  accuracy_score: number;
}

/**
 * Enhanced analysis data with side-by-side comparisons
 */
interface IntradayAnalysisData {
  timestamp: string;
  market_status: 'open' | 'closed';
  symbols: IntradayPerformance[];
  comparisons: IntradaySymbolComparison[];  // NEW: Full comparison data
  overall_accuracy: number;
  on_track_count: number;
  diverged_count: number;
  total_symbols: number;
  message?: string;  // Optional message for empty/error states
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
      // 1. Get morning predictions from D1 (with full dual model data)
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

      // 3. Build side-by-side comparisons (NEW)
      const comparisons: IntradaySymbolComparison[] = [];
      const performance: IntradayPerformance[] = [];

      for (const morning of morningPredictions) {
        const current = currentAnalysis.results.find(r => r.symbol === morning.symbol);

        // Build pre-market sentiment data from D1
        const premarketData = this.buildPeriodSentimentFromMorning(morning);

        // Build intraday sentiment data from fresh analysis (even if failed)
        const intradayData = this.buildPeriodSentimentFromIntraday(current);

        // Build comparison result
        const comparison = this.buildComparison(premarketData, intradayData);

        comparisons.push({
          symbol: morning.symbol,
          premarket: premarketData,
          intraday: intradayData,
          comparison
        });

        // Also build legacy performance data for backward compatibility
        if (current && !current.error) {
          const perf = this.calculatePerformance(morning, current);
          performance.push(perf);
        }
      }

      // 4. Calculate overall metrics
      const consistentCount = comparisons.filter(c => c.comparison.status === 'consistent').length;
      const onTrackCount = performance.filter(p => p.performance === 'on_track' || p.performance === 'strengthened').length;
      const overallAccuracy = comparisons.length > 0 ? consistentCount / comparisons.length : 0;

      const analysisData: IntradayAnalysisData = {
        timestamp: new Date().toISOString(),
        market_status: this.isMarketOpen() ? 'open' : 'closed',
        symbols: performance,
        comparisons,  // NEW: Full comparison data
        overall_accuracy: overallAccuracy,
        on_track_count: onTrackCount,
        diverged_count: comparisons.filter(c => c.comparison.status === 'reversed').length,
        total_symbols: comparisons.length
      };

      logger.info('IntradayDataBridge: Intraday analysis generated', {
        total_symbols: comparisons.length,
        consistent: consistentCount,
        shifted: comparisons.filter(c => c.comparison.status === 'shifted').length,
        reversed: comparisons.filter(c => c.comparison.status === 'reversed').length,
        incomplete: comparisons.filter(c => c.comparison.status === 'incomplete').length,
        accuracy: overallAccuracy
      });

      // 5. Write intraday results to symbol_predictions for queryability
      await this.writeIntradayToD1(today, performance, currentAnalysis);

      return analysisData;

    } catch (error: unknown) {
      logger.error('IntradayDataBridge: Failed to generate intraday analysis', error);
      throw error;
    }
  }

  /**
   * Build PeriodSentimentData from morning D1 prediction
   */
  private buildPeriodSentimentFromMorning(morning: MorningPrediction): PeriodSentimentData {
    // Determine model statuses
    const gemmaStatus = this.parseModelStatus(morning.gemma_status);
    const distilbertStatus = this.parseModelStatus(morning.distilbert_status);

    // Check if we have any valid data
    const gemmaOk = gemmaStatus === 'success' && morning.gemma_confidence !== null;
    const distilbertOk = distilbertStatus === 'success' && morning.distilbert_confidence !== null;
    const bothFailed = !gemmaOk && !distilbertOk;

    // Determine overall status
    let status: 'success' | 'partial' | 'failed';
    let overallError: string | null = null;

    if (bothFailed) {
      status = 'failed';
      overallError = [morning.gemma_error, morning.distilbert_error].filter(Boolean).join('; ') || 'No data from pre-market job';
    } else if (gemmaOk && distilbertOk) {
      status = 'success';
    } else {
      status = 'partial';
    }

    // Extract reasoning from trading_signals if available
    let reasoning = 'No reasoning available';
    if (morning.trading_signals) {
      try {
        const signals = JSON.parse(morning.trading_signals);
        reasoning = signals.reasoning || signals.signal?.reasoning || 'Analysis from pre-market job';
      } catch {
        reasoning = 'Pre-market analysis completed';
      }
    }

    // Determine agreement from model_selection_reason
    let agreement = 'PARTIAL';
    if (morning.model_selection_reason) {
      if (morning.model_selection_reason.includes('agree') || morning.model_selection_reason.includes('AGREE')) {
        agreement = 'AGREE';
      } else if (morning.model_selection_reason.includes('disagree') || morning.model_selection_reason.includes('DISAGREE')) {
        agreement = 'DISAGREE';
      }
    }
    if (bothFailed) agreement = 'ERROR';

    return {
      direction: morning.sentiment || morning.direction || 'neutral',
      confidence: morning.confidence,
      reasoning,
      gemma: {
        status: gemmaStatus,
        error: morning.gemma_error,
        confidence: morning.gemma_confidence,
        direction: morning.sentiment || null,
        response_time_ms: morning.gemma_response_time_ms
      },
      distilbert: {
        status: distilbertStatus,
        error: morning.distilbert_error,
        confidence: morning.distilbert_confidence,
        direction: morning.sentiment || null,
        response_time_ms: morning.distilbert_response_time_ms
      },
      agreement,
      articles_count: morning.articles_count || 0,
      status,
      error: overallError
    };
  }

  /**
   * Build PeriodSentimentData from fresh intraday AI analysis
   */
  private buildPeriodSentimentFromIntraday(result: DualAIComparisonResult | undefined): PeriodSentimentData {
    // Handle missing result
    if (!result) {
      return {
        direction: 'failed',
        confidence: null,
        reasoning: 'Intraday analysis not executed',
        gemma: { status: 'no_data', error: 'Analysis not run', confidence: null, direction: null, response_time_ms: null },
        distilbert: { status: 'no_data', error: 'Analysis not run', confidence: null, direction: null, response_time_ms: null },
        agreement: 'ERROR',
        articles_count: 0,
        status: 'failed',
        error: 'Intraday analysis not executed for this symbol'
      };
    }

    // Extract Gemma (gpt) result
    const gpt = result.models?.gpt;
    const gemmaStatus = this.parseModelStatus(gpt?.error ? 'failed' : (gpt ? 'success' : 'no_data'));
    const gemmaOk = !gpt?.error && gpt?.confidence !== null && gpt?.confidence !== undefined;

    // Extract DistilBERT result
    const db = result.models?.distilbert;
    const distilbertStatus = this.parseModelStatus(db?.error ? 'failed' : (db ? 'success' : 'no_data'));
    const distilbertOk = !db?.error && db?.confidence !== null && db?.confidence !== undefined;

    const bothFailed = !gemmaOk && !distilbertOk;

    // Determine overall status
    let status: 'success' | 'partial' | 'failed';
    let overallError: string | null = null;

    if (bothFailed) {
      status = 'failed';
      overallError = [gpt?.error, db?.error, result.error].filter(Boolean).join('; ') || 'Both models failed';
    } else if (gemmaOk && distilbertOk) {
      status = 'success';
    } else {
      status = 'partial';
    }

    // Determine agreement
    let agreement = 'PARTIAL';
    if (result.comparison?.agreement_type === 'full_agreement') {
      agreement = 'AGREE';
    } else if (result.comparison?.agreement_type === 'disagreement') {
      agreement = 'DISAGREE';
    } else if (result.comparison?.agreement_type === 'error' || bothFailed) {
      agreement = 'ERROR';
    }

    return {
      direction: result.signal?.direction || 'neutral',
      confidence: result.signal?.strength === 'FAILED' ? null : (
        ((gpt?.confidence ?? 0) + (db?.confidence ?? 0)) / (gemmaOk && distilbertOk ? 2 : 1) || null
      ),
      reasoning: result.signal?.reasoning || gpt?.reasoning || 'Fresh intraday analysis',
      gemma: {
        status: gemmaStatus,
        error: gpt?.error || null,
        confidence: gpt?.confidence ?? null,
        direction: gpt?.direction || null,
        response_time_ms: gpt?.response_time_ms ?? null
      },
      distilbert: {
        status: distilbertStatus,
        error: db?.error || null,
        confidence: db?.confidence ?? null,
        direction: db?.direction || null,
        response_time_ms: db?.response_time_ms ?? null
      },
      agreement,
      articles_count: gpt?.articles_analyzed || db?.articles_analyzed || 0,
      status,
      error: overallError
    };
  }

  /**
   * Build comparison result between pre-market and intraday
   */
  private buildComparison(
    premarket: PeriodSentimentData,
    intraday: PeriodSentimentData
  ): IntradaySymbolComparison['comparison'] {
    // Check for incomplete data
    if (premarket.status === 'failed' || intraday.status === 'failed') {
      return {
        direction_match: false,
        confidence_change: null,
        status: 'incomplete'
      };
    }

    // Normalize directions for comparison
    const pmDir = this.normalizeSentiment(premarket.direction);
    const idDir = this.normalizeSentiment(intraday.direction);

    const directionMatch = pmDir === idDir;

    // Calculate confidence change (null if either is missing)
    let confidenceChange: number | null = null;
    if (premarket.confidence !== null && intraday.confidence !== null) {
      confidenceChange = intraday.confidence - premarket.confidence;
    }

    // Determine status
    let status: 'consistent' | 'shifted' | 'reversed' | 'incomplete';
    if (directionMatch) {
      status = 'consistent';
    } else if (pmDir === 'neutral' || idDir === 'neutral') {
      status = 'shifted';  // One is neutral, direction changed but not reversed
    } else {
      status = 'reversed';  // Bullish <-> Bearish
    }

    return {
      direction_match: directionMatch,
      confidence_change: confidenceChange,
      status
    };
  }

  /**
   * Parse model status string to typed status
   */
  private parseModelStatus(status: string | null | undefined): ModelDisplayResult['status'] {
    if (!status) return 'no_data';
    const s = status.toLowerCase();
    if (s === 'success' || s === 'ok') return 'success';
    if (s === 'timeout' || s.includes('timeout')) return 'timeout';
    if (s === 'skipped') return 'skipped';
    if (s === 'failed' || s.includes('fail') || s.includes('error')) return 'failed';
    return 'no_data';
  }

  /**
   * Get morning predictions from D1 with full dual model data
   */
  private async getMorningPredictions(date: string): Promise<MorningPrediction[]> {
    if (!this.env.PREDICT_JOBS_DB) {
      logger.warn('IntradayDataBridge: PREDICT_JOBS_DB not available');
      return [];
    }

    try {
      // Get latest successful pre-market run for this date
      const runResult = await this.env.PREDICT_JOBS_DB
        .prepare(`
          SELECT run_id
          FROM job_run_results
          WHERE scheduled_date = ? 
            AND report_type = 'pre-market'
            AND status IN ('success', 'partial')
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .bind(date)
        .first();

      if (!runResult || !runResult.run_id) {
        logger.warn('IntradayDataBridge: No successful pre-market run found', { date });
        return [];
      }

      const runId = runResult.run_id as string;
      logger.info('IntradayDataBridge: Using pre-market run', { date, runId });

      // Get report snapshot for this specific run
      const { readD1ReportSnapshotByRunId } = await import('./d1-job-storage.js');
      const snapshot = await readD1ReportSnapshotByRunId(this.env, runId);

      if (!snapshot || !snapshot.data) {
        logger.warn('IntradayDataBridge: No snapshot data for run', { runId });
        return [];
      }

      // Extract predictions from snapshot
      const reportData = snapshot.data;
      const tradingSignals = reportData.trading_signals;

      if (!tradingSignals) {
        logger.warn('IntradayDataBridge: No trading_signals in snapshot', { runId });
        return [];
      }

      // trading_signals is an object with symbol keys, not an array
      // Use Object.entries() to preserve the symbol key
      const signalsArray = typeof tradingSignals === 'object' && !Array.isArray(tradingSignals)
        ? Object.entries(tradingSignals).map(([symbol, signal]: [string, any]) => ({ symbol, ...signal }))
        : Array.isArray(tradingSignals)
        ? tradingSignals
        : [];

      // Transform to MorningPrediction format
      return signalsArray.map((signal: any) => ({
        symbol: signal.symbol || signal.ticker, // Prefer signal.symbol, fallback to ticker
        sentiment: signal.sentiment,
        confidence: signal.confidence,
        articles_count: signal.articles_count || 0,
        direction: signal.direction,
        trading_signals: signal,
        gemma_status: signal.gemma_status,
        gemma_error: signal.gemma_error,
        gemma_confidence: signal.gemma_confidence,
        gemma_response_time_ms: signal.gemma_response_time_ms,
        distilbert_status: signal.distilbert_status,
        distilbert_error: signal.distilbert_error,
        distilbert_confidence: signal.distilbert_confidence,
        distilbert_response_time_ms: signal.distilbert_response_time_ms,
        model_selection_reason: signal.model_selection_reason
      }));
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
    current: DualAIComparisonResult
  ): IntradayPerformance {
    const currentDirection = current.signal?.direction || 'neutral';

    // Derive current confidence from model confidences (signal.confidence doesn't exist)
    const gptConf = current.models?.gpt?.confidence ?? 0;
    const dbConf = current.models?.distilbert?.confidence ?? 0;
    const currentConfidence = gptConf > 0 && dbConf > 0 ? (gptConf + dbConf) / 2 : Math.max(gptConf, dbConf);

    // Normalize sentiments for comparison
    const morningNorm = this.normalizeSentiment(morning.sentiment);
    const currentNorm = this.normalizeSentiment(currentDirection);

    // Safely handle null morning confidence
    const morningConf = morning.confidence ?? 0;

    // Determine performance
    let performance: IntradayPerformance['performance'];
    let accuracyScore: number;

    if (morningNorm === currentNorm) {
      // Same direction
      if (currentConfidence > morningConf) {
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
      morning_confidence: morningConf,
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
      comparisons: [],  // NEW: Empty comparisons array
      overall_accuracy: 0,
      on_track_count: 0,
      diverged_count: 0,
      total_symbols: 0
    };
  }

  /**
   * Write intraday dual model results to symbol_predictions for queryability
   */
  private async writeIntradayToD1(
    date: string,
    performance: IntradayPerformance[],
    currentAnalysis: any
  ): Promise<void> {
    if (!this.env.PREDICT_JOBS_DB) return;

    try {
      const { extractDualModelData } = await import('./data.js');
      let actualUpdates = 0;

      for (const perf of performance) {
        const current = currentAnalysis.results?.find((r: any) => r.symbol === perf.symbol);
        if (!current) continue;

        const dualModelData = extractDualModelData(current);

        // Update existing prediction with intraday data
        await this.env.PREDICT_JOBS_DB.prepare(`
          UPDATE symbol_predictions SET
            gemma_status = COALESCE(?, gemma_status),
            gemma_error = COALESCE(?, gemma_error),
            gemma_confidence = COALESCE(?, gemma_confidence),
            gemma_response_time_ms = COALESCE(?, gemma_response_time_ms),
            distilbert_status = COALESCE(?, distilbert_status),
            distilbert_error = COALESCE(?, distilbert_error),
            distilbert_confidence = COALESCE(?, distilbert_confidence),
            distilbert_response_time_ms = COALESCE(?, distilbert_response_time_ms),
            model_selection_reason = COALESCE(?, model_selection_reason)
          WHERE symbol = ? AND prediction_date = ?
        `).bind(
          dualModelData.gemma_status || null,
          dualModelData.gemma_error || null,
          dualModelData.gemma_confidence ?? null,
          dualModelData.gemma_response_time_ms ?? null,
          dualModelData.distilbert_status || null,
          dualModelData.distilbert_error || null,
          dualModelData.distilbert_confidence ?? null,
          dualModelData.distilbert_response_time_ms ?? null,
          dualModelData.model_selection_reason || null,
          perf.symbol,
          date
        ).run();
        actualUpdates++;
      }

      logger.info('IntradayDataBridge: Wrote dual model data to D1', { count: actualUpdates, attempted: performance.length });
    } catch (error: unknown) {
      logger.warn('IntradayDataBridge: Failed to write intraday dual model data', { error });
    }
  }
}
