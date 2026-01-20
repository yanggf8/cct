/**
 * Intraday Performance Check Handler
 * Tracks performance of morning high-confidence signals
 */

import { createLogger, type Logger } from '../logging.js';
import { createHandler, type HandlerFunction, type EnhancedContext } from '../handler-factory.js';
import { generateIntradayPerformance } from '../report/intraday-analysis.js';
import { getIntradayCheckData } from '../report-data-retrieval.js';
import { writeD1JobResult } from '../d1-job-storage.js';
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
import { getTodayInZone, resolveQueryDate, getCurrentTimeET } from './date-utils.js';

const logger: Logger = createLogger('intraday-handlers');

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

    // Resolve query date: ?date > ?tz > DO setting > ET default
    const dateStr = await resolveQueryDate(url, env.CACHE_DO as any);
    const todayET = getTodayInZone('America/New_York');
    const today = new Date(dateStr + 'T12:00:00Z');

    // Check if we need to redirect to last market day
    // If resolved date is a weekend, redirect to last market day
    const dateParam = url.searchParams.get('date');
    const resolvedDate = new Date(dateStr + 'T00:00:00Z');
    const dayOfWeek = resolvedDate.getUTCDay(); // 0 = Sunday, 6 = Saturday

    if (dateParam === 'yesterday' && (dayOfWeek === 0 || dayOfWeek === 6)) {
      // Calculate last market day (Friday)
      const lastMarketDayDate = new Date(todayET + 'T00:00:00Z');
      let daysToSubtract;
      if (dayOfWeek === 0) {
        // Sunday -> go back 2 days to Friday
        daysToSubtract = 2;
      } else {
        // Saturday -> go back 1 day to Friday
        daysToSubtract = 1;
      }
      lastMarketDayDate.setDate(lastMarketDayDate.getDate() - daysToSubtract);
      const lastMarketDay = lastMarketDayDate.toISOString().split('T')[0];

      const redirectUrl = new URL(request.url);
      redirectUrl.searchParams.set('date', lastMarketDay);
      logger.info('INTRADAY: Redirect to last market day', {
        from: dateStr,
        to: lastMarketDay,
        reason: 'weekend'
      });
      return Response.redirect(redirectUrl.toString(), 302);
    }

    // Fast path: check DO cache first (unless bypass requested)
    if (!bypassCache) {
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
    let hasRealJobData = false;

    if (env.PREDICT_JOBS_DB) {
      try {
        const snapshot = await env.PREDICT_JOBS_DB
          .prepare('SELECT report_content FROM scheduled_job_results WHERE execution_date = ? AND report_type = ? ORDER BY created_at DESC LIMIT 1')
          .bind(dateStr, 'intraday')
          .first();

        if (snapshot && snapshot.report_content) {
          const content = typeof snapshot.report_content === 'string'
            ? JSON.parse(snapshot.report_content)
            : snapshot.report_content;

          hasRealJobData = true;

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
            generatedAt: content.timestamp
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

    const html: string = await generateIntradayCheckHTML(intradayData, today, env);
    const totalTime: number = Date.now() - startTime;

    // Cache HTML for fast subsequent loads
    try {
      const dal = createSimplifiedEnhancedDAL(env);
      await dal.write(`intraday_html_${dateStr}`, html, { expirationTtl: 180 });
    } catch (e) { /* ignore cache write errors */ }

    // Write to D1 as source of truth
    if (intradayData) {
      try {
        await writeD1JobResult(env, dateStr, 'intraday', intradayData, {
          ai_models: {
            primary: '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
            secondary: '@cf/huggingface/distilbert-sst-2-int8'
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
 * Generate signal cards HTML with dual model display
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
          <div class="model-name">Gemma Sea Lion</div>
          <div class="model-status">${gemma.status === 'failed' || gemma.error ? '✗ ' + (gemma.error || 'FAILED') : '✓ SUCCESS'}</div>
          <div class="model-result">${gemma.confidence ? Math.round(gemma.confidence * 100) + '%' : 'N/A'}</div>
        </div>
        <div class="model-card ${distilbert.status === 'failed' || distilbert.error ? 'failed' : ''}">
          <div class="model-name">DistilBERT</div>
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
 * Generate comprehensive intraday check HTML
 */
async function generateIntradayCheckHTML(
  intradayData: IntradayPerformanceData | null,
  date: Date,
  env: CloudflareEnvironment
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
  const hasRealData = formattedData.totalSignals > 0;
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
    <title>🎯 Intraday Performance Check - ${date}</title>
    ${getNavScripts()}
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #ffffff;
            min-height: 100vh;
            padding: 20px;
            padding-top: 80px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            padding: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 20px 0;
            border-bottom: 2px solid rgba(255, 255, 255, 0.1);
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #4CAF50, #2196F3);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .date-display {
            margin: 15px 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .target-date, .generated-date {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .date-label {
            font-weight: 600;
            color: #4facfe;
            font-size: 0.95rem;
        }

        .date-value {
            color: rgba(255, 255, 255, 0.9);
            font-size: 0.95rem;
        }

        .model-health {
            text-align: center;
            margin-bottom: 40px;
            padding: 25px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            border-left: 4px solid #4CAF50;
        }

        .model-health.warning {
            border-left-color: #ff9800;
            background: rgba(255, 152, 0, 0.1);
        }

        .model-health.error {
            border-left-color: #f44336;
            background: rgba(244, 67, 54, 0.1);
        }

        .health-status {
            font-size: 2.5rem;
            margin: 15px 0;
        }

        .health-status.on-track { color: #4CAF50; }
        .health-status.divergence { color: #ff9800; }
        .health-status.off-track { color: #f44336; }
        .health-status.pending { color: #9e9e9e; }

        .accuracy-metric {
            font-size: 1.8rem;
            margin: 10px 0;
        }

        .performance-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }

        .performance-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 25px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .performance-card h3 {
            font-size: 1.5rem;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .divergences-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }

        .divergences-table th,
        .divergences-table td {
            padding: 12px 8px;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .divergences-table th {
            background: rgba(255, 255, 255, 0.1);
            font-weight: 600;
            font-size: 0.9rem;
        }

        .divergences-table td {
            font-family: 'Courier New', monospace;
        }

        .model-mini {
            display: inline-block;
            width: 18px;
            height: 18px;
            line-height: 18px;
            text-align: center;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: bold;
            margin-right: 2px;
        }
        .model-mini.ok { background: rgba(76, 175, 80, 0.3); color: #4CAF50; }
        .model-mini.fail { background: rgba(244, 67, 54, 0.3); color: #f44336; }

        .ticker {
            font-weight: bold;
            font-size: 1.1rem;
        }

        .predicted.up {
            color: #4CAF50;
            font-weight: bold;
        }

        .predicted.down {
            color: #f44336;
            font-weight: bold;
        }

        .actual.up {
            color: #4CAF50;
            font-weight: bold;
        }

        .actual.down {
            color: #f44336;
            font-weight: bold;
        }

        .actual.flat {
            color: #ff9800;
            font-weight: bold;
        }

        .divergence-level {
            font-weight: bold;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85rem;
        }

        .divergence-level.high {
            background: rgba(244, 67, 54, 0.2);
            color: #f44336;
        }

        .divergence-level.medium {
            background: rgba(255, 152, 0, 0.2);
            color: #ff9800;
        }

        .divergence-level.low {
            background: rgba(76, 175, 80, 0.2);
            color: #4CAF50;
        }

        .recalibration-section {
            background: rgba(255, 152, 0, 0.1);
            border-radius: 12px;
            padding: 25px;
            border: 2px solid #ff9800;
            margin-bottom: 30px;
        }

        .recalibration-section h3 {
            color: #ff9800;
            margin-bottom: 15px;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .recalibration-alert {
            font-size: 1.2rem;
            margin-bottom: 15px;
        }

        .recalibration-alert.yes {
            color: #f44336;
            font-weight: bold;
        }

        .recalibration-alert.no {
            color: #4CAF50;
        }

        .tracking-summary {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
        }

        .tracking-summary h3 {
            margin-bottom: 20px;
            font-size: 1.5rem;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }

        .summary-metric {
            text-align: center;
            padding: 15px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
        }

        .summary-metric .value {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .summary-metric .label {
            font-size: 0.9rem;
            opacity: 0.8;
        }

        .signal-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .signal-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: transform 0.3s ease;
        }

        .signal-card:hover {
            transform: translateY(-3px);
            background: rgba(255, 255, 255, 0.08);
        }

        .signal-card h4 {
            color: #00f2fe;
            margin-bottom: 15px;
            font-size: 1.3rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .signal-detail {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .signal-detail:last-child {
            border-bottom: none;
        }

        .agreement-badge {
            text-align: center;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            margin: 15px 0 10px 0;
        }
        .agreement-badge.agree { background: rgba(72, 219, 251, 0.2); color: #48dbfb; }
        .agreement-badge.disagree { background: rgba(255, 107, 107, 0.2); color: #ff6b6b; }
        .agreement-badge.partial { background: rgba(254, 202, 87, 0.2); color: #feca57; }

        .dual-model-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 12px;
        }
        .model-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 10px;
            font-size: 0.8rem;
        }
        .model-card.failed { background: rgba(255, 107, 107, 0.1); }
        .model-name { font-weight: 600; color: #4facfe; margin-bottom: 4px; }
        .model-status { font-size: 0.75rem; opacity: 0.8; }
        .model-result { font-weight: 600; margin-top: 4px; }

        .footer {
            text-align: center;
            padding: 20px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            opacity: 0.7;
        }

        .disclaimer {
            background: rgba(244, 67, 54, 0.1);
            border: 1px solid #f44336;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
            font-size: 0.9rem;
        }

        @media (max-width: 768px) {
            .performance-grid {
                grid-template-columns: 1fr;
            }

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
            <h1>🎯 Intraday Performance Check</h1>
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
            </div>
        </div>

        <div class="model-health ${formattedData.modelHealth.status}">
            <div class="health-status ${formattedData.modelHealth.status}">${formattedData.modelHealth.display}</div>
            <div class="accuracy-metric">${formattedData.modelHealth.status === 'pending' || formattedData.modelHealth.status === 'scheduled'
      ? '⏳ Awaiting validation data'
      : `Live Accuracy: ${formattedData.liveAccuracy}%`
    }</div>
            <div>${formattedData.modelHealth.status === 'pending' || formattedData.modelHealth.status === 'scheduled'
      ? 'High-confidence signals will be tracked after job execution'
      : `Tracking ${formattedData.totalSignals} high-confidence signals from this morning`
    }</div>
        </div>

        <div class="tracking-summary">
            <h3>📊 High-Confidence Signal Tracking</h3>
            ${formattedData.modelHealth.status === 'pending' || formattedData.modelHealth.status === 'scheduled'
      ? `<div style="text-align: center; padding: 20px; opacity: 0.7;">
                  <div style="font-size: 1.2rem; margin-bottom: 10px;">⏳ Awaiting job execution</div>
                  <div>Signal tracking data will appear after the scheduled job runs</div>
                </div>`
      : `<div class="summary-grid">
                <div class="summary-metric">
                    <div class="value">${formattedData.correctCalls}</div>
                    <div class="label">Correct Calls</div>
                </div>
                <div class="summary-metric">
                    <div class="value">${formattedData.wrongCalls}</div>
                    <div class="label">Wrong Calls</div>
                </div>
                <div class="summary-metric">
                    <div class="value">${formattedData.pendingCalls}</div>
                    <div class="label">Still Tracking</div>
                </div>
                <div class="summary-metric">
                    <div class="value">${formattedData.avgDivergence}%</div>
                    <div class="label">Avg Divergence</div>
                </div>
            </div>`}
        </div>

        <div class="performance-grid">
            <div class="performance-card" style="grid-column: 1 / -1;">
                <h3>🚨 Significant Divergences</h3>
                <div style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 15px;">
                    High-confidence signals (≥70%) not performing as expected
                </div>
                <div class="signal-grid">
                    ${generateSignalCards(formattedData.divergences || [])}
                </div>
            </div>

            <div class="performance-card" style="grid-column: 1 / -1;">
                <h3>✅ On-Track Signals</h3>
                <div style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 15px;">
                    High-confidence signals performing as expected
                </div>
                <div class="signal-grid">
                    ${generateSignalCards(formattedData.onTrackSignals || [])}
                </div>
            </div>
        </div>

        <div class="recalibration-section">
            <h3>⚠️ Recalibration Alert</h3>
            <div class="recalibration-alert ${formattedData.recalibrationAlert.status}">
                ${formattedData.recalibrationAlert.message}
            </div>
            <div style="font-size: 0.9rem; opacity: 0.9;">
                Threshold: Recalibration triggered if live accuracy drops below 60%
            </div>
        </div>

        <div class="footer">
            <p>Last updated: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EDT</p>
            <p>Next update: End-of-Day Summary at 4:05 PM EDT</p>
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
      // Render generated times with ET and local (include full date for both)
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
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
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
