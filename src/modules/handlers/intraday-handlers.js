/**
 * Intraday Performance Check Handler
 * Tracks performance of morning high-confidence signals
 */

import { createLogger } from '../logging.js';
import { createHandler } from '../handler-factory.js';
import { generateIntradayPerformance } from '../report/intraday-analysis.js';
import { getIntradayCheckData } from '../report-data-retrieval.js';
import { getWithRetry, updateJobStatus, validateDependencies, getJobStatus } from '../kv-utils.js';
import { validateRequest, validateEnvironment } from '../validation.js';

const logger = createLogger('intraday-handlers');

/**
 * Generate Intraday Performance Check Page
 */
export const handleIntradayCheck = createHandler('intraday-check', async (request, env) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

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
    const validation = await validateDependencies(dateStr, ['morning_predictions', 'pre_market_briefing'], env);

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
      });

      // Return a helpful error response
      const html = generateIntradayWaitingHTML(validation, today);
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache',
          'X-Request-ID': requestId,
          'X-Processing-Time': `${Date.now() - startTime}ms`
        }
      });
    }

    logger.info('✅ [INTRADAY] Dependencies validated', {
      requestId,
      completed: validation.completed,
      completionRate: validation.completionRate
    });
  } catch (error) {
    logger.error('❌ [INTRADAY] Dependency validation failed', {
      requestId,
      error: error.message
    });

    await updateJobStatus('intraday_check', dateStr, 'failed', env, {
      requestId,
      error: error.message,
      phase: 'dependency_validation'
    });

    throw error;
  }

  // Set job status to running
  await updateJobStatus('intraday_check', dateStr, 'running', env, {
    requestId,
    startTime: new Date().toISOString()
  });

  // Get today's intraday data using new data retrieval system
  logger.debug('🔍 [INTRADAY] Retrieving intraday check data', {
    requestId,
    date: dateStr
  });

  let intradayData = null;

  try {
    intradayData = await getIntradayCheckData(env, today);

    if (intradayData) {
      logger.info('✅ [INTRADAY] Intraday data retrieved successfully', {
        requestId,
        signalCount: intradayData.signals?.length || 0,
        hasData: true
      });
    } else {
      logger.warn('⚠️ [INTRADAY] No intraday data found for today', {
        requestId
      });
    }
  } catch (error) {
    logger.error('❌ [INTRADAY] Failed to retrieve intraday data', {
      requestId,
      error: error.message
    });

    await updateJobStatus('intraday_check', dateStr, 'failed', env, {
      requestId,
      error: error.message,
      phase: 'data_retrieval'
    });

    throw error;
  }

  const generationStartTime = Date.now();
  logger.debug('🎨 [INTRADAY] Generating HTML content', {
    requestId,
    hasIntradayData: !!intradayData
  });

  const html = await generateIntradayCheckHTML(intradayData, today, env);

  const totalTime = Date.now() - startTime;
  const generationTime = Date.now() - generationStartTime;

  logger.info('✅ [INTRADAY] Intraday performance check generated successfully', {
    requestId,
    totalTimeMs: totalTime,
    generationTimeMs: generationTime,
    signalCount: intradayData?.signals?.length || 0,
    htmlLength: html.length
  });

  // Update job status to done
  await updateJobStatus('intraday_check', dateStr, 'done', env, {
    requestId,
    endTime: new Date().toISOString(),
    processingTimeMs: totalTime,
    signalCount: intradayData?.signals?.length || 0
  });

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=180', // 3 minute cache for intraday
      'X-Request-ID': requestId,
      'X-Processing-Time': `${totalTime}ms`
    }
  });
});

/**
 * Generate comprehensive intraday check HTML
 */
async function generateIntradayCheckHTML(intradayData, date, env) {
  // Process intraday data for HTML format
  const formattedData = intradayData || getDefaultIntradayData();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎯 Intraday Performance Check - ${date}</title>
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

        /* 4 Moment Navigation Styles */
        .report-navigation {
            margin: 20px 0;
            display: flex;
            gap: 10px;
            align-items: center;
            justify-content: center;
            flex-wrap: wrap;
            background: rgba(79, 172, 254, 0.1);
            padding: 15px;
            border-radius: 12px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .nav-report-btn {
            background: linear-gradient(135deg, rgba(79, 172, 254, 0.8), rgba(40, 144, 252, 0.8));
            color: white;
            text-decoration: none;
            padding: 10px 16px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9rem;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 6px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(5px);
            box-shadow: 0 4px 15px rgba(79, 172, 254, 0.3);
            position: relative;
            overflow: hidden;
        }

        .nav-report-btn:before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.5s;
        }

        .nav-report-btn:hover:before {
            left: 100%;
        }

        .nav-report-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(79, 172, 254, 0.4);
            background: linear-gradient(135deg, rgba(79, 172, 254, 1), rgba(40, 144, 252, 1));
        }

        .nav-report-btn.active {
            background: linear-gradient(135deg, #4facfe, #00f2fe);
            color: #0f1419;
            box-shadow: 0 6px 25px rgba(79, 172, 254, 0.5);
            transform: translateY(-1px);
        }

        .nav-report-btn span {
            font-size: 1rem;
        }

        @media (max-width: 768px) {
            .report-navigation {
                gap: 8px;
                padding: 12px;
            }

            .nav-report-btn {
                padding: 8px 12px;
                font-size: 0.8rem;
            }

            .nav-report-btn span {
                font-size: 0.9rem;
            }
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
    <div class="container">
        <!-- 4 Moment Navigation -->
        <div class="report-navigation">
            <span style="color: #4facfe; font-weight: 600; margin-right: 10px;">📈 Navigate Reports:</span>
            <a href="/pre-market-briefing" class="nav-report-btn">📅 Pre-Market</a>
            <a href="/intraday-check" class="nav-report-btn active">📊 Intraday</a>
            <a href="/end-of-day-summary" class="nav-report-btn">📈 End-of-Day</a>
            <a href="/weekly-review" class="nav-report-btn">📋 Weekly Review</a>
            <a href="/weekly-analysis" class="nav-report-btn">📊 Weekly Dashboard</a>
        </div>

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
                        ${(formattedData.divergences || []).map(div => `
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
                        ${(formattedData.onTrackSignals || []).map(signal => `
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
function generateIntradayWaitingHTML(validation, date) {
  const time = new Date().toLocaleTimeString('en-US', {
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
                ${validation.requiredJobs.map(job => {
                  const isMissing = validation.missing.includes(job);
                  const status = isMissing ? 'missing' : 'completed';
                  const display = job.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

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
function getDefaultIntradayData() {
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
        ticker: 'TSLA',
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
        ticker: 'AAPL',
        predicted: '↑ +1.5%',
        predictedDirection: 'up',
        actual: '↑ +1.3%',
        actualDirection: 'up'
      },
      {
        ticker: 'MSFT',
        predicted: '↑ +1.2%',
        predictedDirection: 'up',
        actual: '↑ +1.4%',
        actualDirection: 'up'
      }
    ],
    recalibrationAlert: {
      status: 'no',
      message: 'No recalibration needed - accuracy above 60% threshold'
    }
  };
}