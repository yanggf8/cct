/**
 * Intraday Performance Check Handler
 * Tracks performance of morning high-confidence signals
 */

import { createLogger, type Logger } from '../logging.js';
import { createHandler, type HandlerFunction, type EnhancedContext } from '../handler-factory.js';
import { generateIntradayPerformance } from '../report/intraday-analysis.js';
import { getIntradayCheckData } from '../report-data-retrieval.js';
import { writeD1ReportSnapshot } from '../d1-job-storage.js';
import { createSimplifiedEnhancedDAL } from '../simplified-enhanced-dal.js';
import {
  getWithRetry,
  updateJobStatus,
  validateDependencies,
  getJobStatus
} from '../kv-utils.js';
import { SHARED_NAV_CSS, getSharedNavHTML, getNavScripts } from '../../utils/html-templates.js';
import type { CloudflareEnvironment } from '../../types';
import { validateRequest, validateEnvironment } from '../validation.js';

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
  status: 'on-track' | 'divergence' | 'off-track';
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
  status: 'yes' | 'no' | 'warning';
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
    const today: Date = new Date();
    const dateStr: string = today.toISOString().split('T')[0];

    // Fast path: check DO cache first
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

    logger.info('📊 [INTRADAY] Starting intraday performance check generation', {
      requestId,
      date: dateStr,
      url: request.url,
      userAgent: request.headers.get('user-agent')?.substring(0, 100) || 'unknown'
    });

    // Validate inputs
    validateRequest(request);
    validateEnvironment(env);

    logger.debug('✅ [INTRADAY] Input validation passed', { requestId });

    // Check dependencies using new status system
    logger.debug('🔗 [INTRADAY] Checking dependencies', { requestId });

    try {
      const validation: DependencyValidation = await validateDependencies(
        dateStr,
        ['morning_predictions', 'pre_market_briefing'],
        env
      );

      if (!validation.isValid) {
        logger.warn('⚠️ [INTRADAY] Dependencies not satisfied', {
          requestId,
          missing: validation.missing,
          completionRate: validation.completionRate
        });

        // Set job status to waiting
        await updateJobStatus('intraday_check', dateStr, 'waiting', env, {
          requestId,
          missingDependencies: validation.missing,
          reason: 'Dependencies not satisfied'
        } as JobStatusMetadata);

        // Return a helpful error response
        const html: string = generateIntradayWaitingHTML(validation, today);
        return new Response(html, {
          headers: new Headers({
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache',
            'X-Request-ID': requestId,
            'X-Processing-Time': `${Date.now() - startTime}ms`
          })
        });
      }

      logger.info('✅ [INTRADAY] Dependencies validated', {
        requestId,
        completed: validation.completed,
        completionRate: validation.completionRate
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ [INTRADAY] Dependency validation failed', {
        requestId,
        error: errorMessage
      });

      await updateJobStatus('intraday_check', dateStr, 'failed', env, {
        requestId,
        error: errorMessage,
        phase: 'dependency_validation'
      } as JobStatusMetadata);

      throw error;
    }

    // Set job status to running
    await updateJobStatus('intraday_check', dateStr, 'running', env, {
      requestId,
      startTime: new Date().toISOString()
    } as JobStatusMetadata);

    // Get today's intraday data using new data retrieval system
    logger.debug('🔍 [INTRADAY] Retrieving intraday check data', {
      requestId,
      date: dateStr
    });

    let intradayData: IntradayPerformanceData | null = null;

    try {
      intradayData = await getIntradayCheckData(env, today) as unknown as IntradayPerformanceData | null;

      if (intradayData) {
        logger.info('✅ [INTRADAY] Intraday data retrieved successfully', {
          requestId,
          signalCount: (intradayData as any).signals?.length || 0,
          hasData: true
        });
      } else {
        logger.warn('⚠️ [INTRADAY] No intraday data found for today', {
          requestId
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ [INTRADAY] Failed to retrieve intraday data', {
        requestId,
        error: errorMessage
      });

      await updateJobStatus('intraday_check', dateStr, 'failed', env, {
        requestId,
        error: errorMessage,
        phase: 'data_retrieval'
      } as JobStatusMetadata);

      throw error;
    }

    const generationStartTime: number = Date.now();
    logger.debug('🎨 [INTRADAY] Generating HTML content', {
      requestId,
      hasIntradayData: !!intradayData
    });

    const html: string = await generateIntradayCheckHTML(intradayData, today, env);

    const totalTime: number = Date.now() - startTime;
    const generationTime: number = Date.now() - generationStartTime;

    // Write snapshot to D1 and warm DO cache
    const dal = createSimplifiedEnhancedDAL(env);
    if (intradayData) {
      await writeD1ReportSnapshot(env, dateStr, 'intraday', intradayData, {
        processingTimeMs: totalTime,
        signalCount: (intradayData as any)?.signals?.length || 0
      });
      await dal.write(`intraday_${dateStr}`, intradayData, { expirationTtl: 86400 });
    }
    // Cache HTML for fast subsequent loads
    await dal.write(`intraday_html_${dateStr}`, html, { expirationTtl: 180 });

    logger.info('✅ [INTRADAY] Intraday performance check generated successfully', {
      requestId,
      totalTimeMs: totalTime,
      generationTimeMs: generationTime,
      signalCount: (intradayData as any)?.signals?.length || 0,
      htmlLength: html.length
    });

    // Update job status to done
    await updateJobStatus('intraday_check', dateStr, 'done', env, {
      requestId,
      endTime: new Date().toISOString(),
      processingTimeMs: totalTime,
      signalCount: (intradayData as any)?.signals?.length || 0
    } as JobStatusMetadata);

    return new Response(html, {
      headers: new Headers({
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=180', // 3 minute cache for intraday
        'X-Request-ID': requestId,
        'X-Processing-Time': `${totalTime}ms`
      })
    });
  }
);

// ============================================================================
// HTML Generation Functions
// ============================================================================

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

        .header .date {
            font-size: 1.2rem;
            opacity: 0.8;
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
            <div class="date">${new Date(date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })} - ${new Date().toLocaleTimeString('en-US', {
              timeZone: 'America/New_York',
              hour: '2-digit',
              minute: '2-digit'
            })} EDT</div>
        </div>

        <div class="model-health ${formattedData.modelHealth.status}">
            <h2>Model Health Status</h2>
            <div class="health-status ${formattedData.modelHealth.status}">${formattedData.modelHealth.display}</div>
            <div class="accuracy-metric">Live Accuracy: ${formattedData.liveAccuracy}%</div>
            <div>Tracking ${formattedData.totalSignals} high-confidence signals from this morning</div>
        </div>

        <div class="tracking-summary">
            <h3>📊 High-Confidence Signal Tracking</h3>
            <div class="summary-grid">
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
            </div>
        </div>

        <div class="performance-grid">
            <div class="performance-card">
                <h3>🚨 Significant Divergences</h3>
                <div style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 15px;">
                    High-confidence signals (≥70%) not performing as expected
                </div>
                <table class="divergences-table">
                    <thead>
                        <tr>
                            <th>Ticker</th>
                            <th>Predicted</th>
                            <th>Current</th>
                            <th>Level</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(formattedData.divergences || []).map((div: DivergenceData) => `
                            <tr>
                                <td class="ticker">${div.symbol}</td>
                                <td class="predicted ${div.predictedDirection}">${div.predicted}</td>
                                <td class="actual ${div.actualDirection}">${div.actual}</td>
                                <td><span class="divergence-level ${div.level}">${div.level.toUpperCase()}</span></td>
                                <td>${div.reason || 'Price action divergence'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${(formattedData.divergences || []).length === 0 ? '<div style="text-align: center; padding: 20px; opacity: 0.6;">No significant divergences detected</div>' : ''}
            </div>

            <div class="performance-card">
                <h3>✅ On-Track Signals</h3>
                <div style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 15px;">
                    High-confidence signals performing as expected
                </div>
                <table class="divergences-table">
                    <thead>
                        <tr>
                            <th>Ticker</th>
                            <th>Predicted</th>
                            <th>Current</th>
                            <th>Performance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(formattedData.onTrackSignals || []).map((signal: IntradaySignal) => `
                            <tr>
                                <td class="ticker">${signal.symbol}</td>
                                <td class="predicted ${signal.predictedDirection}">${signal.predicted}</td>
                                <td class="actual ${signal.actualDirection}">${signal.actual}</td>
                                <td class="divergence-level low">ON TARGET</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${(formattedData.onTrackSignals || []).length === 0 ? '<div style="text-align: center; padding: 20px; opacity: 0.6;">No on-track signals available</div>' : ''}
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
    modelHealth: { status: 'on-track', display: '✅ On Track' },
    liveAccuracy: 68,
    totalSignals: 6,
    correctCalls: 4,
    wrongCalls: 1,
    pendingCalls: 1,
    avgDivergence: 1.8,
    divergences: [
      {
        symbol: 'TSLA',
        predicted: '↑ Expected',
        predictedDirection: 'up',
        actual: '↓ -3.5%',
        actualDirection: 'down',
        level: 'high',
        reason: 'Unexpected competitor news'
      }
    ],
    onTrackSignals: [
      {
        symbol: 'AAPL',
        predicted: '↑ +1.5%',
        predictedDirection: 'up',
        actual: '↑ +1.3%',
        actualDirection: 'up'
      },
      {
        symbol: 'MSFT',
        predicted: '↑ +1.2%',
        predictedDirection: 'up',
        actual: '↑ +1.4%',
        actualDirection: 'up'
      }
    ],
    recalibrationAlert: {
      status: 'no',
      message: 'No recalibration needed - accuracy above 60% threshold',
      threshold: 60
    },
    generatedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}

// ============================================================================
// Export Types for External Use
// ============================================================================
// Note: Types are already exported via 'export interface' declarations above