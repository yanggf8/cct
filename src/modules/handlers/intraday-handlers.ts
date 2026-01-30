/**
 * Intraday Performance Check Handler
 * Tracks performance of morning high-confidence signals
 */

import { createLogger, type Logger } from '../logging.js';
import { createHandler, type HandlerFunction, type EnhancedContext } from '../handler-factory.js';
import { generateIntradayPerformance } from '../report/intraday-analysis.js';
import { AI_MODEL_DISPLAY } from '../config.js';
import { getIntradayCheckData } from '../report-data-retrieval.js';
import { readD1ReportSnapshotByRunId, writeD1JobResult } from '../d1-job-storage.js';
import { createSimplifiedEnhancedDAL } from '../simplified-enhanced-dal.js';
import { generatePendingPageHTML } from './pending-page.js';
import {
  getWithRetry,
  validateDependencies,
  getJobStatus
} from '../kv-utils.js';
import { SHARED_NAV_CSS, getSharedNavHTML, getNavScripts } from '../../utils/html-templates.js';
import type { CloudflareEnvironment } from '../../types';
import { validateRequest, validateEnvironment } from '../validation.js';
import { resolveQueryDate } from './date-utils.js';
import type { IntradaySymbolComparison, PeriodSentimentData, ModelDisplayResult } from '../intraday-data-bridge.js';

const logger: Logger = createLogger('intraday-handlers');

// ============================================================================
// Security Helpers
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Intraday signal performance data
 */
export interface IntradaySignal {
  symbol: string;
  predicted: string;
  predictedDirection: 'up' | 'down' | 'flat';
  actual: string;
  actualDirection: 'up' | 'down' | 'flat';
  performance?: number;
  confidence?: number;
  reason?: string;
}

/**
 * Divergence tracking information
 */
export interface DivergenceData extends IntradaySignal {
  level: 'high' | 'medium' | 'low';
  reason?: string;
}

/**
 * Model health status information
 */
export interface ModelHealthStatus {
  status: 'on-track' | 'divergence' | 'off-track' | 'pending' | 'scheduled';
  display: string;
  accuracy?: number;
  lastUpdated?: string;
}

/**
 * Performance tracking summary
 */
export interface PerformanceTracking {
  totalSignals: number;
  correctCalls: number;
  wrongCalls: number;
  pendingCalls: number;
  avgDivergence: number;
  liveAccuracy: number;
}

/**
 * Recalibration alert information
 */
export interface RecalibrationAlert {
  status: 'yes' | 'no' | 'warning' | 'pending';
  message: string;
  threshold: number;
  currentValue?: number;
}

/**
 * Complete intraday performance data
 */
export interface IntradayPerformanceData {
  modelHealth: ModelHealthStatus;
  liveAccuracy: number;
  totalSignals: number;
  correctCalls: number;
  wrongCalls: number;
  pendingCalls: number;
  avgDivergence: number;
  divergences: DivergenceData[];
  onTrackSignals: IntradaySignal[];
  recalibrationAlert: RecalibrationAlert;
  lastUpdated?: string;
  generatedAt?: string;
  pre_market_run_id?: string | null;
}

/**
 * Dependency validation result
 */
export interface DependencyValidation {
  isValid: boolean;
  completed: string[];
  missing: string[];
  requiredJobs: string[];
  completionRate: number;
  date: string;
}

/**
 * Job status update metadata
 */
export interface JobStatusMetadata {
  requestId: string;
  startTime?: string;
  endTime?: string;
  processingTimeMs?: number;
  signalCount?: number;
  missingDependencies?: string[];
  error?: string;
  phase?: string;
  reason?: string;
}

/**
 * HTML generation context
 */
export interface HTMLGenerationContext {
  date: Date;
  env: CloudflareEnvironment;
  requestId?: string;
  processingTime?: number;
}

/**
 * API Response headers
 */
export interface ResponseHeaders {
  'Content-Type': string;
  'Cache-Control'?: string;
  'X-Request-ID'?: string;
  'X-Processing-Time'?: string;
}

// ============================================================================
// Main Handler Function
// ============================================================================

/**
 * Generate Intraday Performance Check Page
 */
export const handleIntradayCheck = createHandler(
  'intraday-check',
  async (request: Request, env: CloudflareEnvironment): Promise<Response> => {
    const requestId: string = crypto.randomUUID();
    const startTime: number = Date.now();
    const url = new URL(request.url);
    const bypassCache = url.searchParams.get('bypass') === '1';
    const runId = url.searchParams.get('run_id');
    const isRunIdView = !!runId;

    // Resolve query date: ?date > ?tz > DO setting > ET default
    let dateStr = await resolveQueryDate(url, env.CACHE_DO as any);
    let today = new Date(dateStr + 'T12:00:00Z');

    // Fast path: check DO cache first (unless bypass requested)
    if (!bypassCache && !isRunIdView) {
      try {
        const dal = createSimplifiedEnhancedDAL(env);
        const cached = await dal.read(`intraday_html_${dateStr}`);
        if (cached.success && cached.data) {
          return new Response(cached.data, {
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=180',
              'X-Cache': 'HIT',
              'X-Request-ID': requestId
            }
          });
        }
      } catch (e) { /* continue to generate */ }
    }

    logger.info('📊 [INTRADAY] Starting intraday performance check generation', {
      requestId,
      date: dateStr
    });

    // Read from D1 scheduled_job_results (same as API endpoint)
    let intradayData: IntradayPerformanceData | null = null;
    let comparisons: IntradaySymbolComparison[] = [];
    let hasRealJobData = false;

    if (env.PREDICT_JOBS_DB) {
      try {
        // Prefer exact run_id lookup when provided
        let content: any | null = null;
        if (runId) {
          const runSnapshot = await readD1ReportSnapshotByRunId(env, runId);
          if (runSnapshot) {
            dateStr = runSnapshot.scheduledDate;
            today = new Date(dateStr + 'T12:00:00Z');
            content = runSnapshot.data;
            logger.info('📊 [INTRADAY] Loaded snapshot by run_id', { requestId, runId, scheduledDate: dateStr });
          } else {
            logger.warn('📊 [INTRADAY] run_id not found; falling back to latest-by-date', { requestId, runId, dateStr });
          }
        }

        if (!content) {
          // Prefer rows with run_id (tracked runs) over legacy rows without
          const snapshot = await env.PREDICT_JOBS_DB
            .prepare(`SELECT report_content FROM scheduled_job_results
                      WHERE scheduled_date = ? AND report_type = ?
                      ORDER BY CASE WHEN run_id IS NOT NULL THEN 0 ELSE 1 END, created_at DESC
                      LIMIT 1`)
            .bind(dateStr, 'intraday')
            .first();
          if (snapshot && snapshot.report_content) {
            content = typeof snapshot.report_content === 'string'
              ? JSON.parse(snapshot.report_content)
              : snapshot.report_content;
          }
        }

        if (content) {

          hasRealJobData = true;

          // Extract comparisons if available (new format)
          if (content.comparisons && Array.isArray(content.comparisons)) {
            comparisons = content.comparisons;
            logger.info('📊 [INTRADAY] Loaded comparisons from D1', {
              count: comparisons.length,
              requestId
            });
          }

          // Transform D1 data to IntradayPerformanceData format
          const symbols = content.symbols || [];
          const divergences: DivergenceData[] = symbols
            .filter((s: any) => s.performance === 'diverged')
            .map((s: any) => ({
              symbol: s.symbol,
              predicted: s.morning_prediction,
              predictedDirection: s.morning_prediction === 'bullish' ? 'up' : s.morning_prediction === 'bearish' ? 'down' : 'flat',
              actual: s.current_sentiment,
              actualDirection: s.current_sentiment === 'UP' ? 'up' : s.current_sentiment === 'DOWN' ? 'down' : 'flat',
              performance: s.accuracy_score,
              confidence: s.morning_confidence,
              level: s.morning_confidence >= 0.7 ? 'high' : s.morning_confidence >= 0.5 ? 'medium' : 'low',
              reason: `Morning: ${s.morning_prediction} (${(s.morning_confidence * 100).toFixed(0)}%), Current: ${s.current_sentiment}`
            }));

          const onTrackSignals: IntradaySignal[] = symbols
            .filter((s: any) => s.performance === 'on_track' || s.performance === 'strengthened')
            .map((s: any) => ({
              symbol: s.symbol,
              predicted: s.morning_prediction,
              predictedDirection: s.morning_prediction === 'bullish' ? 'up' : s.morning_prediction === 'bearish' ? 'down' : 'flat',
              actual: s.current_sentiment,
              actualDirection: s.current_sentiment === 'UP' ? 'up' : s.current_sentiment === 'DOWN' ? 'down' : 'flat',
              performance: s.accuracy_score,
              confidence: s.morning_confidence,
              reason: `Morning: ${s.morning_prediction} (${(s.morning_confidence * 100).toFixed(0)}%), Current: ${s.current_sentiment}`
            }));

          const accuracy = content.overall_accuracy * 100;

          intradayData = {
            modelHealth: {
              status: accuracy >= 60 ? 'on-track' : accuracy >= 40 ? 'divergence' : 'off-track',
              display: accuracy >= 60 ? '✅ On Track' : accuracy >= 40 ? '⚠️ Divergence' : '❌ Off Track',
              accuracy
            },
            liveAccuracy: accuracy,
            totalSignals: content.symbols_analyzed || 0,
            correctCalls: content.on_track_count || 0,
            wrongCalls: content.diverged_count || 0,
            pendingCalls: 0,
            avgDivergence: 0,
            divergences,
            onTrackSignals,
            recalibrationAlert: {
              status: accuracy < 50 ? 'yes' : accuracy < 60 ? 'warning' : 'no',
              message: accuracy < 50 ? 'Model recalibration recommended' : accuracy < 60 ? 'Monitor performance' : 'Performance within acceptable range',
              threshold: 60,
              currentValue: accuracy
            },
            lastUpdated: content.timestamp,
            generatedAt: content.timestamp,
            pre_market_run_id: content.pre_market_run_id || null
          };

          logger.info('📊 [INTRADAY] Loaded data from D1', {
            symbols: content.symbols_analyzed,
            accuracy,
            requestId
          });
        }
      } catch (error) {
        logger.error('📊 [INTRADAY] Failed to read from D1', { error, requestId });
      }
    }

    // Fallback to old method if D1 data not available
    if (!hasRealJobData) {
      try {
        const intradayCheckData = await getIntradayCheckData(env, today);
        // Check if job actually ran (has predictions)
        hasRealJobData = !!(intradayCheckData?.morningPredictions?.predictions?.length);

        if (intradayCheckData && hasRealJobData) {
          const ps = intradayCheckData.performanceSummary;
          const rawAccuracy = ps?.averageAccuracy;
          const hasAccuracy = typeof rawAccuracy === 'number' && rawAccuracy > 0;
          const accuracy = hasAccuracy ? rawAccuracy : null;
          const predictions = intradayCheckData.morningPredictions?.predictions || [];

          // Build divergences and onTrackSignals from actual predictions
          const divergences: DivergenceData[] = predictions
            .filter((p: any) => p.status === 'divergent')
            .map((p: any) => ({
              symbol: p.symbol,
              predicted: p.prediction || 'unknown',
              predictedDirection: (p.prediction === 'up' ? 'up' : p.prediction === 'down' ? 'down' : 'flat') as 'up' | 'down' | 'flat',
              actual: p.performance?.actualDirection || 'unknown',
              actualDirection: (p.performance?.actualDirection === 'up' ? 'up' : p.performance?.actualDirection === 'down' ? 'down' : 'flat') as 'up' | 'down' | 'flat',
              performance: p.performance?.accuracy,
              confidence: p.confidence,
              level: (p.confidence || 0) >= 70 ? 'high' : (p.confidence || 0) >= 50 ? 'medium' : 'low' as 'high' | 'medium' | 'low',
              reason: p.reasoning
            }));

          const onTrackSignals: IntradaySignal[] = predictions
            .filter((p: any) => p.status === 'validated' || p.status === 'tracking')
            .map((p: any) => ({
              symbol: p.symbol,
              predicted: p.prediction || 'unknown',
              predictedDirection: (p.prediction === 'up' ? 'up' : p.prediction === 'down' ? 'down' : 'flat') as 'up' | 'down' | 'flat',
              actual: p.performance?.actualDirection || 'pending',
              actualDirection: (p.performance?.actualDirection === 'up' ? 'up' : p.performance?.actualDirection === 'down' ? 'down' : 'flat') as 'up' | 'down' | 'flat',
              performance: p.performance?.accuracy,
              confidence: p.confidence,
              reason: p.reasoning
            }));

          // Determine schedule info (ET)
          const nowETDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
          const currentHourET = nowETDate.getHours();
          const intradayScheduledHour = 12; // 12:00 PM ET
          const beforeSchedule = currentHourET < intradayScheduledHour;
          const scheduleInfo = beforeSchedule
            ? `Scheduled: <span class="sched-time" data-utch="17" data-utcm="0"></span>`
            : 'Job should have run - check execution';

          intradayData = {
            modelHealth: {
              status: !hasAccuracy ? 'pending' : accuracy! >= 60 ? 'on-track' : accuracy! >= 40 ? 'divergence' : 'off-track',
              display: !hasAccuracy ? `⏳ ${scheduleInfo}` : accuracy! >= 60 ? '✅ On Track' : accuracy! >= 40 ? '⚠️ Divergence' : '❌ Off Track',
              accuracy: hasAccuracy ? accuracy! : undefined
            },
            liveAccuracy: accuracy || 0,
            totalSignals: ps?.totalSignals || 0,
            correctCalls: ps?.validatedSignals || 0,
            wrongCalls: ps?.divergentSignals || 0,
            pendingCalls: ps?.trackingSignals || 0,
            avgDivergence: accuracy ? 100 - accuracy : 0,
            divergences,
            onTrackSignals,
            recalibrationAlert: {
              status: !hasAccuracy ? 'pending' : accuracy! >= 60 ? 'no' : accuracy! >= 40 ? 'warning' : 'yes',
              message: !hasAccuracy
                ? 'Accuracy pending - waiting for validation data'
                : accuracy! >= 60
                  ? 'No recalibration needed - accuracy above 60%'
                  : accuracy! >= 40
                    ? 'Accuracy below 60% - monitor closely'
                    : 'Accuracy below 40% - recalibration recommended',
              threshold: 60,
              currentValue: accuracy || 0
            },
            generatedAt: intradayCheckData.generatedAt,
            lastUpdated: intradayCheckData.generatedAt
          };
        }
      } catch (error: unknown) {
        logger.error('❌ [INTRADAY] Failed to retrieve data', { requestId, error: (error as Error).message });
      }
    }

    // If no real data (no predictions from job), show pending page
    if (!hasRealJobData) {
      // Debug: Return diagnostic info instead of pending page when bypass or debug param is set
      const bypassParam = url.searchParams.get('bypass');
      const debugParam = url.searchParams.get('debug');
      if (bypassParam === '1' || bypassParam === 'true' || debugParam === '1' || debugParam === 'true') {
        return new Response(JSON.stringify({
          error: 'No real job data found',
          dateStr,
          runId,
          hasD1: !!env.PREDICT_JOBS_DB,
          requestId
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const pendingPage = generatePendingPageHTML({
        title: 'Intraday Performance Check',
        reportType: 'intraday',
        dateStr,
        scheduledHourUTC: 17,
        scheduledMinuteUTC: 0
      });
      return new Response(pendingPage, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
          'X-Request-ID': requestId
        }
      });
    }

    const html: string = await generateIntradayCheckHTML(intradayData, today, env, comparisons, hasRealJobData, runId || undefined);
    const totalTime: number = Date.now() - startTime;

    // Cache HTML for fast subsequent loads
    try {
      const dal = createSimplifiedEnhancedDAL(env);
      if (!isRunIdView) {
        await dal.write(`intraday_html_${dateStr}`, html, { expirationTtl: 180 });
      }
    } catch (e) { /* ignore cache write errors */ }

    // Write to D1 as source of truth
    if (!isRunIdView && intradayData) {
      try {
        await writeD1JobResult(env, dateStr, 'intraday', intradayData, {
          ai_models: {
            primary: AI_MODEL_DISPLAY.primary.id,
            secondary: AI_MODEL_DISPLAY.secondary.id
          }
        }, 'scheduler');
      } catch (e) { /* ignore D1 write errors */ }
    }

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=180',
        'X-Request-ID': requestId,
        'X-Processing-Time': `${totalTime}ms`
      }
    });
  }
);

// ============================================================================
// HTML Generation Functions
// ============================================================================

/**
 * Generate side-by-side comparison card for a single symbol
 */
function generateSymbolComparisonCard(comparison: IntradaySymbolComparison): string {
  const { symbol, premarket, intraday, comparison: cmp } = comparison;

  // Status badge
  const statusConfig: Record<string, { emoji: string; label: string; color: string }> = {
    consistent: { emoji: '✅', label: 'CONSISTENT', color: '#4CAF50' },
    shifted: { emoji: '🔄', label: 'SHIFTED', color: '#ff9800' },
    reversed: { emoji: '🔃', label: 'REVERSED', color: '#f44336' },
    incomplete: { emoji: '⚠️', label: 'INCOMPLETE', color: '#9e9e9e' }
  };
  const status = statusConfig[cmp.status] || statusConfig.incomplete;

  // Helper to render a period column
  const renderPeriodColumn = (period: PeriodSentimentData, label: string): string => {
    const dirEmoji = getDirectionEmoji(period.direction);
    const conf = period.confidence !== null ? `${Math.round(period.confidence * 100)}%` : '—';

    // Model result renderer (with XSS protection)
    const renderModel = (model: ModelDisplayResult, name: string): string => {
      if (model.status === 'no_data') {
        return `<div class="model-row no-data"><span class="model-name">${escapeHtml(name)}</span><span class="model-status">No data</span></div>`;
      }
      if (model.status === 'failed' || model.status === 'timeout') {
        const errorMsg = model.error || (model.status === 'timeout' ? 'Timeout' : 'Failed');
        const escapedError = escapeHtml(errorMsg);
        const truncatedError = errorMsg.length > 25 ? escapeHtml(errorMsg.substring(0, 25)) + '...' : escapedError;
        return `<div class="model-row failed"><span class="model-name">${escapeHtml(name)}</span><span class="model-error" title="${escapedError}">✗ ${truncatedError}</span></div>`;
      }
      const modelConf = model.confidence !== null ? `${Math.round(model.confidence * 100)}%` : '—';
      const modelDir = escapeHtml(model.direction) || '—';
      return `<div class="model-row success"><span class="model-name">${escapeHtml(name)}</span><span class="model-result">${modelDir.toUpperCase()} (${modelConf})</span></div>`;
    };

    // Agreement badge
    const agreementClass = period.agreement === 'AGREE' ? 'agree' : period.agreement === 'DISAGREE' ? 'disagree' : period.agreement === 'ERROR' ? 'error' : 'partial';

    // Period status indicator
    const periodStatusClass = period.status === 'success' ? 'success' : period.status === 'partial' ? 'partial' : 'failed';

    // Escape user-controlled content
    const escapedError = escapeHtml(period.error || 'Analysis failed');
    const escapedDirection = escapeHtml(period.direction);
    const escapedReasoning = escapeHtml(period.reasoning);
    const truncatedReasoning = period.reasoning.length > 80
      ? escapeHtml(period.reasoning.substring(0, 80)) + '...'
      : escapedReasoning;

    return `
      <div class="period-column ${periodStatusClass}">
        <div class="period-header">${escapeHtml(label)}</div>
        ${period.status === 'failed' ? `
          <div class="period-error">
            <span class="error-icon">⚠️</span>
            <span class="error-text">${escapedError}</span>
          </div>
        ` : `
          <div class="direction-row">
            <span class="direction-emoji">${dirEmoji}</span>
            <span class="direction-text ${escapedDirection}">${escapedDirection.toUpperCase()}</span>
            <span class="confidence">${conf}</span>
          </div>
          <div class="models-section">
            ${renderModel(period.gemma, AI_MODEL_DISPLAY.primary.short)}
            ${renderModel(period.distilbert, AI_MODEL_DISPLAY.secondary.short)}
          </div>
          <div class="agreement-badge ${agreementClass}">${escapeHtml(period.agreement)}</div>
          <div class="reasoning">"${truncatedReasoning}"</div>
        `}
      </div>
    `;
  };

  // Confidence change indicator
  let confChangeHtml = '';
  if (cmp.confidence_change !== null) {
    const changeVal = Math.round(cmp.confidence_change * 100);
    const changeClass = changeVal > 0 ? 'positive' : changeVal < 0 ? 'negative' : 'neutral';
    confChangeHtml = `<span class="conf-change ${changeClass}">${changeVal > 0 ? '+' : ''}${changeVal}%</span>`;
  }

  return `
    <div class="comparison-card">
      <div class="card-header">
        <h4 class="symbol-name">${escapeHtml(symbol)}</h4>
        <div class="status-badge" style="background: ${status.color}20; color: ${status.color}; border: 1px solid ${status.color}40;">
          ${status.emoji} ${status.label}
        </div>
      </div>
      <div class="comparison-grid">
        ${renderPeriodColumn(premarket, 'PRE-MARKET')}
        <div class="comparison-divider">
          <div class="arrow">→</div>
          ${confChangeHtml}
        </div>
        ${renderPeriodColumn(intraday, 'INTRADAY')}
      </div>
    </div>
  `;
}

/**
 * Generate summary stats for comparisons
 */
function generateComparisonSummary(comparisons: IntradaySymbolComparison[]): string {
  if (!comparisons || comparisons.length === 0) {
    return '<div class="summary-empty">No comparison data available</div>';
  }

  const consistent = comparisons.filter(c => c.comparison.status === 'consistent').length;
  const shifted = comparisons.filter(c => c.comparison.status === 'shifted').length;
  const reversed = comparisons.filter(c => c.comparison.status === 'reversed').length;
  const incomplete = comparisons.filter(c => c.comparison.status === 'incomplete').length;

  return `
    <div class="comparison-summary">
      <div class="summary-stat consistent">
        <span class="stat-value">${consistent}</span>
        <span class="stat-label">Consistent</span>
      </div>
      <div class="summary-stat shifted">
        <span class="stat-value">${shifted}</span>
        <span class="stat-label">Shifted</span>
      </div>
      <div class="summary-stat reversed">
        <span class="stat-value">${reversed}</span>
        <span class="stat-label">Reversed</span>
      </div>
      ${incomplete > 0 ? `
        <div class="summary-stat incomplete">
          <span class="stat-value">${incomplete}</span>
          <span class="stat-label">Incomplete</span>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Generate all comparison cards
 */
function generateComparisonCards(comparisons: IntradaySymbolComparison[]): string {
  if (!comparisons || comparisons.length === 0) {
    return '<div class="no-comparisons">No comparison data available yet. Run the intraday job to generate comparisons.</div>';
  }

  return comparisons.map(c => generateSymbolComparisonCard(c)).join('');
}

/**
 * Generate signal cards HTML with dual model display (LEGACY - kept for backward compatibility)
 */
function generateSignalCards(signals: any[]): string {
  if (!signals || signals.length === 0) {
    return '<div style="text-align: center; opacity: 0.7; grid-column: 1 / -1; padding: 40px;">No signals available yet</div>';
  }

  return signals.map(signal => {
    const confidence = Math.round((signal.confidence || 0) * 100);
    const accuracy = signal.performance === 'on_track' || signal.performance === 'strengthened' ? 'ok' : 
                     signal.performance === 'diverged' ? 'fail' : 'pending';
    
    // Extract dual model data
    const gemma = signal.gemma_status ? {
      status: signal.gemma_status,
      error: signal.gemma_error,
      confidence: signal.gemma_confidence,
      direction: signal.morning_prediction // Simplification for display
    } : (signal.dual_model?.gemma || {});

    const distilbert = signal.distilbert_status ? {
      status: signal.distilbert_status,
      error: signal.distilbert_error,
      confidence: signal.distilbert_confidence,
      direction: signal.morning_prediction // Simplification for display
    } : (signal.dual_model?.distilbert || {});

    const agreement = signal.agreement || signal.model_selection_reason || 'PARTIAL';
    
    const hasDualModel = gemma.status || distilbert.status;
    
    // Agreement badge
    const agreementBadge = hasDualModel ? `
      <div class="agreement-badge ${agreement.toLowerCase().includes('agree') ? 'agree' : agreement.toLowerCase().includes('diverge') || agreement.toLowerCase().includes('disagree') ? 'disagree' : 'partial'}">
        ${agreement.toUpperCase().includes('AGREE') ? '✓ MODELS AGREE' : agreement.toUpperCase().includes('DIVERGE') || agreement.toUpperCase().includes('DISAGREE') ? '✗ MODELS DISAGREE' : '◐ PARTIAL AGREEMENT'}
      </div>
    ` : '';
    
    // Dual model cards
    const dualModelCards = hasDualModel ? `
      <div class="dual-model-grid">
        <div class="model-card ${gemma.status === 'failed' || gemma.error ? 'failed' : ''}">
          <div class="model-name">${AI_MODEL_DISPLAY.primary.name}</div>
          <div class="model-status">${gemma.status === 'failed' || gemma.error ? '✗ ' + (gemma.error || 'FAILED') : '✓ SUCCESS'}</div>
          <div class="model-result">${gemma.confidence ? Math.round(gemma.confidence * 100) + '%' : 'N/A'}</div>
        </div>
        <div class="model-card ${distilbert.status === 'failed' || distilbert.error ? 'failed' : ''}">
          <div class="model-name">${AI_MODEL_DISPLAY.secondary.name}</div>
          <div class="model-status">${distilbert.status === 'failed' || distilbert.error ? '✗ ' + (distilbert.error || 'FAILED') : '✓ SUCCESS'}</div>
          <div class="model-result">${distilbert.confidence ? Math.round(distilbert.confidence * 100) + '%' : 'N/A'}</div>
        </div>
      </div>
    ` : '';

    return `
      <div class="signal-card">
        <h4>${signal.symbol} ${getDirectionEmoji(signal.predictedDirection || signal.predicted)}</h4>
        <div class="signal-detail">
          <span class="label">Morning:</span>
          <span class="value ${signal.predictedDirection || signal.predicted}">${(signal.predictedDirection || signal.predicted || 'N/A').toUpperCase()}</span>
        </div>
        <div class="signal-detail">
          <span class="label">Current:</span>
          <span class="value ${signal.actualDirection || signal.actual}">${(signal.actualDirection || signal.actual || 'PENDING').toUpperCase()}</span>
        </div>
        <div class="signal-detail">
          <span class="label">Status:</span>
          <span class="value"><span class="divergence-level ${accuracy === 'ok' ? 'low' : accuracy === 'fail' ? 'high' : 'medium'}">${accuracy === 'ok' ? 'ON TARGET' : accuracy === 'fail' ? 'DIVERGED' : 'TRACKING'}</span></span>
        </div>
        ${agreementBadge}
        ${dualModelCards}
      </div>
    `;
  }).join('');
}

/**
 * Get direction emoji
 */
function getDirectionEmoji(direction?: string): string {
  if (!direction) return '❓';
  switch (direction.toLowerCase()) {
    case 'bullish': case 'up': return '📈';
    case 'bearish': case 'down': return '📉';
    case 'neutral': case 'flat': return '➡️';
    default: return '❓';
  }
}

/**
 * Generate comprehensive intraday check HTML with side-by-side comparison
 */
async function generateIntradayCheckHTML(
  intradayData: IntradayPerformanceData | null,
  date: Date,
  env: CloudflareEnvironment,
  comparisons?: IntradaySymbolComparison[],
  hasJobData?: boolean,
  runId?: string
): Promise<string> {
  // Process intraday data for HTML format
  const formattedData: IntradayPerformanceData = intradayData || getDefaultIntradayData();

  // Ensure modelHealth exists
  if (!formattedData.modelHealth) {
    formattedData.modelHealth = {
      status: 'on-track',
      display: '✅ On Track'
    };
  }

  // Check for real data vs scheduled
  const hasComparisons = comparisons && comparisons.length > 0;
  const hasRealData = hasComparisons || formattedData.totalSignals > 0;
  const scheduledUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 17, 0); // 12:00 PM ET = 17:00 UTC
  const beforeSchedule = Date.now() < scheduledUtc;

  // Status display for header - show both ET and local time
  let statusDisplay: string;
  if (hasRealData && formattedData.generatedAt) {
    const ts = new Date(formattedData.generatedAt).getTime();
    statusDisplay = `Generated <span class="gen-time" data-ts="${ts}"></span>`;
  } else if (beforeSchedule) {
    statusDisplay = `⏳ Scheduled: <span class="sched-time" data-utch="17" data-utcm="0"></span>`;
  } else {
    statusDisplay = '⚠️ No data available';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📊 Intraday Sentiment Comparison - ${date}</title>
    <link rel="stylesheet" href="/css/reports.css">
    ${getNavScripts()}
    <style>
        /* Comparison Card Styles */
        .comparison-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .symbol-name {
            font-size: 1.4rem;
            font-weight: bold;
            margin: 0;
            color: #f0b90b;
        }
        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        .comparison-grid {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 15px;
            align-items: stretch;
        }
        .period-column {
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
            padding: 15px;
        }
        .period-column.failed {
            background: rgba(244, 67, 54, 0.1);
            border: 1px solid rgba(244, 67, 54, 0.3);
        }
        .period-column.partial {
            background: rgba(255, 152, 0, 0.1);
            border: 1px solid rgba(255, 152, 0, 0.3);
        }
        .period-header {
            font-size: 0.85rem;
            font-weight: 600;
            color: #888;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .period-error {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #f44336;
            font-size: 0.9rem;
            padding: 10px;
            background: rgba(244, 67, 54, 0.1);
            border-radius: 6px;
        }
        .direction-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
        }
        .direction-emoji {
            font-size: 1.5rem;
        }
        .direction-text {
            font-size: 1.1rem;
            font-weight: 600;
        }
        .direction-text.bullish, .direction-text.up { color: #4CAF50; }
        .direction-text.bearish, .direction-text.down { color: #f44336; }
        .direction-text.neutral { color: #9e9e9e; }
        .confidence {
            margin-left: auto;
            font-size: 1.1rem;
            color: #f0b90b;
        }
        .models-section {
            margin-bottom: 12px;
        }
        .model-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 0.85rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .model-row:last-child { border-bottom: none; }
        .model-name { color: #aaa; }
        .model-result { color: #4CAF50; }
        .model-row.failed .model-error { color: #f44336; font-size: 0.8rem; }
        .model-row.no-data .model-status { color: #666; font-style: italic; }
        .agreement-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .agreement-badge.agree { background: rgba(76, 175, 80, 0.2); color: #4CAF50; }
        .agreement-badge.disagree { background: rgba(244, 67, 54, 0.2); color: #f44336; }
        .agreement-badge.partial { background: rgba(255, 152, 0, 0.2); color: #ff9800; }
        .agreement-badge.error { background: rgba(158, 158, 158, 0.2); color: #9e9e9e; }
        .reasoning {
            font-size: 0.85rem;
            color: #aaa;
            font-style: italic;
            line-height: 1.4;
        }
        .comparison-divider {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 0 10px;
        }
        .comparison-divider .arrow {
            font-size: 1.5rem;
            color: #666;
        }
        .conf-change {
            font-size: 0.85rem;
            padding: 2px 8px;
            border-radius: 4px;
            margin-top: 5px;
        }
        .conf-change.positive { background: rgba(76, 175, 80, 0.2); color: #4CAF50; }
        .conf-change.negative { background: rgba(244, 67, 54, 0.2); color: #f44336; }
        .conf-change.neutral { background: rgba(158, 158, 158, 0.2); color: #9e9e9e; }

        /* Summary Styles */
        .comparison-summary {
            display: flex;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
            margin-bottom: 30px;
        }
        .summary-stat {
            text-align: center;
            padding: 15px 25px;
            border-radius: 8px;
            min-width: 100px;
        }
        .summary-stat.consistent { background: rgba(76, 175, 80, 0.15); border: 1px solid rgba(76, 175, 80, 0.3); }
        .summary-stat.shifted { background: rgba(255, 152, 0, 0.15); border: 1px solid rgba(255, 152, 0, 0.3); }
        .summary-stat.reversed { background: rgba(244, 67, 54, 0.15); border: 1px solid rgba(244, 67, 54, 0.3); }
        .summary-stat.incomplete { background: rgba(158, 158, 158, 0.15); border: 1px solid rgba(158, 158, 158, 0.3); }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            display: block;
        }
        .summary-stat.consistent .stat-value { color: #4CAF50; }
        .summary-stat.shifted .stat-value { color: #ff9800; }
        .summary-stat.reversed .stat-value { color: #f44336; }
        .summary-stat.incomplete .stat-value { color: #9e9e9e; }
        .stat-label {
            font-size: 0.85rem;
            color: #888;
            text-transform: uppercase;
        }
        .no-comparisons {
            text-align: center;
            padding: 40px;
            color: #888;
            font-style: italic;
        }

        /* Model Health */
        .model-health {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            border-left: 4px solid #4CAF50;
        }
        .model-health.warning { border-left-color: #ff9800; }
        .model-health.error, .model-health.off-track { border-left-color: #f44336; }
        .health-status { font-size: 2rem; margin: 10px 0; }
        .health-status.on-track { color: #4CAF50; }
        .health-status.divergence { color: #ff9800; }
        .health-status.off-track { color: #f44336; }
        .health-status.pending { color: #9e9e9e; }

        /* Responsive */
        @media (max-width: 768px) {
            .comparison-grid {
                grid-template-columns: 1fr;
            }
            .comparison-divider {
                flex-direction: row;
                padding: 10px 0;
            }
            .comparison-divider .arrow {
                transform: rotate(90deg);
            }
        }
    </style>
</head>
<body>
    ${getSharedNavHTML('intraday')}
    <div class="container">
        <div class="header">
            <h1>📊 Intraday Sentiment Comparison</h1>
            <div class="date-display">
              <div class="target-date">
                <span class="date-label">Target Day:</span>
                <span class="date-value">${new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}</span>
              </div>
              <div class="generated-date">
                <span class="date-label">${hasRealData ? 'Generated:' : 'Scheduled:'}</span>
                <span class="date-value">${statusDisplay}</span>
              </div>
              ${runId ? `<div class="run-id-display">
                <span class="date-label">Run ID:</span>
                <span class="date-value" style="font-family: monospace; font-size: 0.85em;">${runId.slice(-12)}</span>
              </div>` : ''}
              ${formattedData.pre_market_run_id ? `<div class="run-id-display">
                <span class="date-label">Pre-Market Run:</span>
                <a href="/pre-market-briefing?run_id=${formattedData.pre_market_run_id}" 
                   style="font-family: monospace; font-size: 0.85em; color: #007bff; text-decoration: none; cursor: pointer;"
                   onmouseover="this.style.textDecoration='underline'" 
                   onmouseout="this.style.textDecoration='none'"
                   title="View pre-market report">${formattedData.pre_market_run_id.slice(-12)}</a>
              </div>` : ''}
            </div>
        </div>

        ${hasComparisons ? `
          <div class="model-health ${formattedData.modelHealth.status}">
            <div class="health-status ${formattedData.modelHealth.status}">${formattedData.modelHealth.display}</div>
            <div>Comparing ${comparisons!.length} symbols: Pre-Market vs Intraday</div>
          </div>

          ${generateComparisonSummary(comparisons!)}

          <div class="comparisons-section">
            ${generateComparisonCards(comparisons!)}
          </div>
        ` : hasJobData ? `
          <div class="model-health divergence">
            <div class="health-status divergence">⚠️ No Comparison Data</div>
            <div>The intraday job ran but no pre-market predictions were available for comparison.</div>
            <div style="margin-top: 10px; font-size: 0.9rem; color: #888;">
              This typically happens when the pre-market job didn't run or failed before the intraday check.
              Check the <a href="/dashboard.html" style="color: #f0b90b;">Dashboard</a> for job history.
            </div>
          </div>
        ` : `
          <div class="model-health pending">
            <div class="health-status pending">⏳ Awaiting Data</div>
            <div>${beforeSchedule
              ? 'Intraday comparison will be available after the scheduled job runs at 12:00 PM ET'
              : 'No comparison data available. Run the intraday job to generate comparisons.'}</div>
          </div>
        `}

        <div class="footer">
            <p>Last updated: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</p>
            <p>Next update: End-of-Day Summary at 4:05 PM ET</p>
            <div class="disclaimer">
                ⚠️ <strong>DISCLAIMER:</strong> Real-time tracking for research and educational purposes only.
                Market conditions change rapidly. Not financial advice - consult licensed professionals before trading.
            </div>
        </div>
    </div>
    <script>
      // Render scheduled times with ET and local
      document.querySelectorAll('.sched-time').forEach(el => {
        const utcH = parseInt(el.dataset.utch);
        const utcM = parseInt(el.dataset.utcm || '0');
        const d = new Date();
        d.setUTCHours(utcH, utcM, 0, 0);
        const et = d.toLocaleTimeString('en-US', {timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true});
        const local = d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
        el.textContent = et + ' ET (' + local + ' local)';
      });
      // Render generated times with ET and local
      document.querySelectorAll('.gen-time').forEach(el => {
        const ts = parseInt(el.dataset.ts);
        const d = new Date(ts);
        const etDate = d.toLocaleDateString('en-US', {timeZone: 'America/New_York', month: 'short', day: 'numeric'});
        const etTime = d.toLocaleTimeString('en-US', {timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true});
        const localDate = d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
        const localTime = d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
        el.textContent = etDate + ', ' + etTime + ' ET (' + localDate + ', ' + localTime + ' local)';
      });
    </script>
</body>
</html>`;
}

/**
 * Generate waiting HTML when dependencies are not satisfied
 */
function generateIntradayWaitingHTML(validation: DependencyValidation, date: Date): string {
  const time: string = new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📊 Intraday Performance Check - Waiting for Dependencies</title>
    ${getNavScripts()}
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(160deg, #1a1714 0%, #1f1b16 40%, #2a241c 100%);
            color: #ffffff;
            min-height: 100vh;
            padding: 20px;
            padding-top: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .container {
            max-width: 800px;
            width: 100%;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            padding: 40px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            text-align: center;
        }

        .header {
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #ff9800, #f44336);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header .date {
            font-size: 1.2rem;
            opacity: 0.8;
        }

        .waiting-status {
            background: rgba(255, 152, 0, 0.1);
            border: 2px solid #ff9800;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
        }

        .waiting-icon {
            font-size: 4rem;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

        .waiting-title {
            font-size: 1.8rem;
            margin-bottom: 15px;
            color: #ff9800;
        }

        .waiting-description {
            font-size: 1.1rem;
            opacity: 0.9;
            margin-bottom: 25px;
        }

        .dependencies {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
        }

        .dependencies h3 {
            font-size: 1.4rem;
            margin-bottom: 20px;
            color: #4CAF50;
        }

        .dependency-list {
            list-style: none;
            margin: 20px 0;
        }

        .dependency-item {
            padding: 12px 20px;
            margin: 10px 0;
            border-radius: 8px;
            font-size: 1rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .dependency-item.missing {
            background: rgba(244, 67, 54, 0.2);
            border-left: 4px solid #f44336;
        }

        .dependency-item.completed {
            background: rgba(76, 175, 80, 0.2);
            border-left: 4px solid #4CAF50;
        }

        .dependency-status {
            font-weight: bold;
            font-size: 0.9rem;
        }

        .dependency-status.missing {
            color: #f44336;
        }

        .dependency-status.completed {
            color: #4CAF50;
        }

        .next-steps {
            background: rgba(33, 150, 243, 0.1);
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            border: 1px solid rgba(33, 150, 243, 0.3);
        }

        .next-steps h3 {
            font-size: 1.4rem;
            margin-bottom: 15px;
            color: #2196F3;
        }

        .next-steps ul {
            list-style: none;
            text-align: left;
        }

        .next-steps li {
            padding: 8px 0;
            font-size: 1rem;
        }

        .next-steps li::before {
            content: "⏰ ";
            margin-right: 10px;
        }

        .auto-refresh {
            font-size: 0.9rem;
            opacity: 0.8;
            margin-top: 20px;
        }

        .refresh-timer {
            font-weight: bold;
            color: #4CAF50;
        }

        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            opacity: 0.7;
            font-size: 0.9rem;
        }

        @media (max-width: 768px) {
            .container {
                margin: 10px;
                padding: 20px;
            }

            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    ${getSharedNavHTML('intraday')}
    <div class="container">
        <div class="header">
            <h1>📊 Intraday Performance Check</h1>
            <div class="date">${date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })} - ${time} EDT</div>
        </div>

        <div class="waiting-status">
            <div class="waiting-icon">⏳</div>
            <div class="waiting-title">Waiting for Required Data</div>
            <div class="waiting-description">
                The Intraday Performance Check is waiting for upstream analysis to complete.
            </div>
        </div>

        <div class="dependencies">
            <h3>📋 Dependency Status</h3>
            <div>Completion: <strong>${Math.round(validation.completionRate * 100)}%</strong> (${validation.completed.length}/${validation.requiredJobs.length} jobs)</div>

            <ul class="dependency-list">
                ${validation.requiredJobs.map((job: string) => {
    const isMissing: boolean = validation.missing.includes(job);
    const status: string = isMissing ? 'missing' : 'completed';
    const display: string = job.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

    return `
                    <li class="dependency-item ${status}">
                      <span>${display}</span>
                      <span class="dependency-status ${status}">
                        ${isMissing ? '❌ Missing' : '✅ Completed'}
                      </span>
                    </li>
                  `;
  }).join('')}
            </ul>
        </div>

        <div class="next-steps">
            <h3>⏰ Next Steps</h3>
            <ul>
                <li>Pre-Market Briefing runs at 8:30 AM EDT</li>
                <li>Intraday Check runs at 12:00 PM EDT</li>
                <li>Dependencies are processed automatically</li>
                <li>This page will refresh when data is available</li>
            </ul>
        </div>

        <div class="auto-refresh">
            <p>Next automatic refresh: <span class="refresh-timer" id="timer">30</span> seconds</p>
            <p>This page will automatically reload when dependencies are satisfied.</p>
        </div>

        <div class="footer">
            <p>🔄 Auto-refresh enabled | Dependencies monitored in real-time</p>
            <p>Intraday Performance Check - Real-time Signal Tracking System</p>
        </div>
    </div>

    <script>
        // Auto-refresh countdown
        let seconds = 30;
        const timerElement = document.getElementById('timer');

        const countdown = setInterval(() => {
            seconds--;
            timerElement.textContent = seconds;

            if (seconds <= 0) {
                clearInterval(countdown);
                window.location.reload();
            }
        }, 1000);

        // Check for completion more frequently
        const checkCompletion = setInterval(() => {
            fetch(window.location.href)
                .then(response => {
                    if (response.ok) {
                        clearInterval(checkCompletion);
                        clearInterval(countdown);
                        window.location.reload();
                    }
                })
                .catch(() => {
                    // Continue waiting
                });
        }, 5000);
    </script>
</body>
</html>`;
}

/**
 * Default intraday data when no analysis is available
 */
function getDefaultIntradayData(): IntradayPerformanceData {
  return {
    modelHealth: { status: 'pending', display: '⏳ Scheduled: 12:00 PM ET' },
    liveAccuracy: 0,
    totalSignals: 0,
    correctCalls: 0,
    wrongCalls: 0,
    pendingCalls: 0,
    avgDivergence: 0,
    divergences: [],
    onTrackSignals: [],
    recalibrationAlert: {
      status: 'pending',
      message: 'Awaiting intraday data',
      threshold: 60,
      currentValue: 0
    },
    generatedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}

// ============================================================================
// Export Types for External Use
// ============================================================================
// Note: Types are already exported via 'export interface' declarations above
