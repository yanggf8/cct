/**
 * Pre-Market Briefing Handler
 * Comprehensive battle plan for the trading day
 */

import { createLogger } from '../logging.js';
import { createSuccessResponse } from '../response-factory.js';
import { createHandler } from '../handler-factory.js';
import { generatePreMarketSignals } from '../report/pre-market-analysis.js';
import { getPreMarketBriefingData } from '../report-data-retrieval.js';
import { validateRequest, validateEnvironment, safeValidate } from '../validation.js';
import { getWithRetry, updateJobStatus, validateDependencies, getJobStatus } from '../kv-utils.js';

const logger = createLogger('briefing-handlers');

/**
 * Generate Pre-Market Briefing Page
 */
export const handlePreMarketBriefing = createHandler('pre-market-briefing', async (request, env) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  logger.info('🚀 [PRE-MARKET] Starting pre-market briefing generation', {
    requestId,
    date: dateStr,
    url: request.url,
    userAgent: request.headers.get('user-agent')?.substring(0, 100) || 'unknown'
  });

  // Validate inputs
  validateRequest(request);
  validateEnvironment(env);

  logger.debug('✅ [PRE-MARKET] Input validation passed', { requestId });

  // Check dependencies using new status system
  logger.debug('🔗 [PRE-MARKET] Checking dependencies', { requestId });

  try {
    const validation = await validateDependencies(dateStr, ['analysis', 'morning_predictions'], env);

    if (!validation.isValid) {
      logger.warn('⚠️ [PRE-MARKET] Dependencies not satisfied', {
        requestId,
        missing: validation.missing,
        completionRate: validation.completionRate
      });

      // Set job status to waiting
      await updateJobStatus('pre_market_briefing', dateStr, 'waiting', env, {
        requestId,
        missingDependencies: validation.missing,
        reason: 'Dependencies not satisfied'
      });

      // Return a helpful error response
      const html = generatePreMarketWaitingHTML(validation, today);
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache',
          'X-Request-ID': requestId,
          'X-Processing-Time': `${Date.now() - startTime}ms`
        }
      });
    }

    logger.info('✅ [PRE-MARKET] Dependencies validated', {
      requestId,
      completed: validation.completed,
      completionRate: validation.completionRate
    });
  } catch (error) {
    logger.error('❌ [PRE-MARKET] Dependency validation failed', {
      requestId,
      error: error.message
    });

    await updateJobStatus('pre_market_briefing', dateStr, 'failed', env, {
      requestId,
      error: error.message,
      phase: 'dependency_validation'
    });

    throw error;
  }

  // Set job status to running
  await updateJobStatus('pre_market_briefing', dateStr, 'running', env, {
    requestId,
    startTime: startTime,
    phase: 'data_retrieval'
  });

  // Get today's briefing data using new data retrieval system
  logger.debug('📊 [PRE-MARKET] Retrieving pre-market briefing data', {
    requestId,
    date: dateStr
  });

  let briefingData = null;
  try {
    briefingData = await getPreMarketBriefingData(env, today);

    if (briefingData) {
      logger.info('✅ [PRE-MARKET] Briefing data retrieved successfully', {
        requestId,
        signalCount: briefingData.signals?.length || 0,
        hasData: true
      });
    } else {
      logger.warn('⚠️ [PRE-MARKET] No briefing data found for today', {
        requestId
      });
    }
  } catch (error) {
    logger.error('❌ [PRE-MARKET] Failed to retrieve briefing data', {
      requestId,
      error: error.message
    });

    await updateJobStatus('pre_market_briefing', dateStr, 'failed', env, {
      requestId,
      error: error.message,
      phase: 'data_retrieval'
    });

    throw error;
  }

  const generationStartTime = Date.now();
  logger.debug('🎨 [PRE-MARKET] Generating HTML content', { requestId });

  const html = generatePreMarketBriefingHTML(briefingData, today);

  const totalTime = Date.now() - startTime;
  const generationTime = Date.now() - generationStartTime;

  logger.info('✅ [PRE-MARKET] Pre-market briefing generated successfully', {
    requestId,
    totalTimeMs: totalTime,
    generationTimeMs: generationTime,
    dataSize: briefingData ? 'present' : 'missing',
    htmlLength: html.length
  });

  // Set job status to completed
  await updateJobStatus('pre_market_briefing', dateStr, 'done', env, {
    requestId,
    totalTimeMs: totalTime,
    generationTimeMs: generationTime,
    hasData: !!briefingData,
    signalCount: briefingData?.signals?.length || 0,
    completedAt: new Date().toISOString()
  });

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=300', // 5 minute cache
      'X-Request-ID': requestId,
      'X-Processing-Time': `${totalTime}ms`
    }
  });
});

/**
 * Generate comprehensive pre-market briefing HTML
 */
function generatePreMarketBriefingHTML(briefingData, date) {
  // Process briefing data for HTML format
  const formattedData = briefingData || getDefaultBriefingData();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>☀️ Pre-Market Briefing - ${date}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #2d4a70 100%);
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

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 20px 0;
            border-bottom: 2px solid rgba(255, 255, 255, 0.1);
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #ffd700, #ffb347);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header .date {
            font-size: 1.2rem;
            opacity: 0.8;
        }

        .market-bias {
            text-align: center;
            margin-bottom: 40px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            border-left: 4px solid #4CAF50;
        }

        .market-bias h2 {
            font-size: 1.8rem;
            margin-bottom: 10px;
        }

        .bias-indicator {
            font-size: 3rem;
            margin: 10px 0;
        }

        .bias-bullish { color: #4CAF50; }
        .bias-bearish { color: #f44336; }
        .bias-neutral { color: #ff9800; }

        .confidence {
            font-size: 1.4rem;
            opacity: 0.9;
        }

        .ideas-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }

        .ideas-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 25px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ideas-card.long {
            border-left: 4px solid #4CAF50;
        }

        .ideas-card.short {
            border-left: 4px solid #f44336;
        }

        .ideas-card h3 {
            font-size: 1.5rem;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .confidence-note {
            font-size: 0.85rem;
            opacity: 0.7;
            margin-bottom: 15px;
            font-style: italic;
        }

        .no-signals {
            text-align: center;
            padding: 20px;
            opacity: 0.6;
            font-style: italic;
            border: 1px dashed rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            margin-top: 15px;
        }

        .ideas-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }

        .ideas-table th,
        .ideas-table td {
            padding: 12px 8px;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ideas-table th {
            background: rgba(255, 255, 255, 0.1);
            font-weight: 600;
            font-size: 0.9rem;
        }

        .ideas-table td {
            font-family: 'Courier New', monospace;
        }

        .ticker {
            font-weight: bold;
            font-size: 1.1rem;
        }

        .prediction.up {
            color: #4CAF50;
            font-weight: bold;
        }

        .prediction.down {
            color: #f44336;
            font-weight: bold;
        }

        .confidence-bar {
            display: inline-block;
            width: 50px;
            height: 8px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            overflow: hidden;
            vertical-align: middle;
            margin-left: 5px;
        }

        .confidence-fill {
            height: 100%;
            background: linear-gradient(90deg, #ff9800, #4CAF50);
            transition: width 0.3s ease;
        }

        .sectors-section {
            margin-bottom: 40px;
        }

        .sectors-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-top: 20px;
        }

        .sector-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            padding: 20px;
            text-align: center;
        }

        .sector-card.strongest {
            border: 2px solid #4CAF50;
            background: rgba(76, 175, 80, 0.1);
        }

        .sector-card.weakest {
            border: 2px solid #f44336;
            background: rgba(244, 67, 54, 0.1);
        }

        .sector-list {
            margin-top: 15px;
            font-size: 1.1rem;
        }

        .risk-section {
            background: rgba(255, 152, 0, 0.1);
            border-radius: 12px;
            padding: 25px;
            border: 2px solid #ff9800;
            margin-bottom: 30px;
        }

        .risk-section h3 {
            color: #ff9800;
            margin-bottom: 20px;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .risk-item {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            border-left: 3px solid #ff9800;
        }

        .risk-symbol {
            font-weight: bold;
            color: #ffd700;
            font-size: 1.1rem;
        }

        .risk-description {
            margin-top: 5px;
            opacity: 0.9;
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
            .ideas-section {
                grid-template-columns: 1fr;
            }

            .sectors-grid {
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
        <div class="header">
            <h1>☀️ Pre-Market Briefing</h1>
            <div class="date">${new Date(date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</div>
        </div>

        <div class="market-bias">
            <h2>Overall Market Bias</h2>
            <div class="bias-indicator ${formattedData.overallBias.toLowerCase()}">${formattedData.overallBias.toUpperCase()}</div>
            <div class="confidence">${Math.round(formattedData.averageConfidence)}% confidence</div>
        </div>

        <div class="ideas-section">
            <div class="ideas-card long">
                <h3>📈 Top 3 High-Confidence Ups</h3>
                <div class="confidence-note">≥70% confidence threshold from stock universe</div>
                <table class="ideas-table">
                    <thead>
                        <tr>
                            <th>Ticker</th>
                            <th>Prediction</th>
                            <th>Confidence</th>
                            <th>Key Driver</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(formattedData.highConfidenceUps || []).map(signal => `
                            <tr>
                                <td class="ticker">${signal.symbol}</td>
                                <td class="prediction up">↑ ${((signal.predictedPrice - signal.currentPrice) / signal.currentPrice * 100).toFixed(1)}%</td>
                                <td>
                                    ${Math.round(signal.confidence * 100)}%
                                    <div class="confidence-bar">
                                        <div class="confidence-fill" style="width: ${signal.confidence * 100}%"></div>
                                    </div>
                                </td>
                                <td>Technical momentum</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${(formattedData.highConfidenceUps || []).length === 0 ? '<div class="no-signals">No high-confidence bullish signals today</div>' : ''}
            </div>

            <div class="ideas-card short">
                <h3>📉 Top 3 High-Confidence Downs</h3>
                <div class="confidence-note">≥70% confidence threshold from stock universe</div>
                <table class="ideas-table">
                    <thead>
                        <tr>
                            <th>Ticker</th>
                            <th>Prediction</th>
                            <th>Confidence</th>
                            <th>Key Driver</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(formattedData.highConfidenceDowns || []).map(signal => `
                            <tr>
                                <td class="ticker">${signal.symbol}</td>
                                <td class="prediction down">↓ ${((signal.currentPrice - signal.predictedPrice) / signal.currentPrice * 100).toFixed(1)}%</td>
                                <td>
                                    ${Math.round(signal.confidence * 100)}%
                                    <div class="confidence-bar">
                                        <div class="confidence-fill" style="width: ${signal.confidence * 100}%"></div>
                                    </div>
                                </td>
                                <td>Technical weakness</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${(formattedData.highConfidenceDowns || []).length === 0 ? '<div class="no-signals">No high-confidence bearish signals today</div>' : ''}
            </div>
        </div>

        <div class="sectors-section">
            <h3>🔎 Sectors to Watch</h3>
            <div class="sectors-grid">
                <div class="sector-card strongest">
                    <h4>💪 Strongest</h4>
                    <div class="sector-list">${(formattedData.strongestSectors || ['Technology', 'Financials']).join(', ')}</div>
                </div>
                <div class="sector-card weakest">
                    <h4>📉 Weakest</h4>
                    <div class="sector-list">${(formattedData.weakestSectors || ['Healthcare', 'Energy']).join(', ')}</div>
                </div>
            </div>
        </div>

        <div class="risk-section">
            <h3>⚠️ Risk Watchlist</h3>
            ${(formattedData.riskItems || [
                { symbol: 'SPY', description: 'Monitor for overall market volatility' },
                { symbol: 'QQQ', description: 'Tech sector concentration risk' }
            ]).map(item => `
                <div class="risk-item">
                    <div class="risk-symbol">${item.symbol}</div>
                    <div class="risk-description">${item.description}</div>
                </div>
            `).join('')}
        </div>

        <div class="footer">
            <p>Last updated: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EDT</p>
            <p>Next update: Intraday Check at 12:00 PM EDT</p>
            <div class="disclaimer">
                ⚠️ <strong>DISCLAIMER:</strong> This analysis is for research and educational purposes only.
                AI models may be inaccurate. Not financial advice - consult licensed professionals before trading.
            </div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate waiting HTML when dependencies are not satisfied
 */
function generatePreMarketWaitingHTML(validation, date) {
  const { missing, completionRate } = validation;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>⏳ Pre-Market Briefing - Waiting for Dependencies</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #2d4a70 100%);
            color: #ffffff;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            padding: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            text-align: center;
        }

        .header {
            margin-bottom: 40px;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            color: #ffd700;
        }

        .header .date {
            font-size: 1.2rem;
            opacity: 0.8;
        }

        .waiting-content {
            margin-bottom: 40px;
        }

        .waiting-icon {
            font-size: 4rem;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { opacity: 0.5; }
            50% { opacity: 1; }
            100% { opacity: 0.5; }
        }

        .status-message {
            font-size: 1.5rem;
            margin-bottom: 20px;
            color: #ff9800;
        }

        .dependency-list {
            background: rgba(255, 152, 0, 0.1);
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            border: 1px solid rgba(255, 152, 0, 0.3);
        }

        .dependency-list h3 {
            margin-bottom: 15px;
            color: #ff9800;
        }

        .missing-item {
            background: rgba(244, 67, 54, 0.1);
            border-radius: 5px;
            padding: 10px;
            margin: 5px 0;
            border-left: 3px solid #f44336;
        }

        .completion-rate {
            font-size: 1.2rem;
            margin: 20px 0;
            padding: 15px;
            background: rgba(76, 175, 80, 0.1);
            border-radius: 10px;
            border: 1px solid rgba(76, 175, 80, 0.3);
        }

        .auto-refresh {
            margin-top: 30px;
            padding: 15px;
            background: rgba(33, 150, 243, 0.1);
            border-radius: 10px;
            border: 1px solid rgba(33, 150, 243, 0.3);
        }

        .refresh-button {
            background: linear-gradient(135deg, #2196F3, #1976D2);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 25px;
            font-size: 1rem;
            cursor: pointer;
            margin-top: 15px;
            transition: transform 0.2s;
        }

        .refresh-button:hover {
            transform: scale(1.05);
        }

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏳ Pre-Market Briefing</h1>
            <div class="date">${new Date(date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</div>
        </div>

        <div class="waiting-content">
            <div class="waiting-icon">⏳</div>
            <div class="status-message">Waiting for Required Data</div>

            <div class="completion-rate">
                <strong>Data Readiness:</strong> ${Math.round(completionRate * 100)}% Complete
            </div>

            <div class="dependency-list">
                <h3>📋 Missing Dependencies</h3>
                ${missing.map(job => `
                    <div class="missing-item">
                        <strong>${job.replace('_', ' ').toUpperCase()}</strong>
                        <div>Required data not yet available</div>
                    </div>
                `).join('')}
            </div>

            <div class="auto-refresh">
                <h3>🔄 Auto-Refresh</h3>
                <p>This page will automatically refresh every 30 seconds until all dependencies are satisfied.</p>
                <button class="refresh-button" onclick="window.location.reload()">
                    Refresh Now
                </button>
            </div>
        </div>

        <div class="footer">
            <p>The Pre-Market Briefing requires analysis data and morning predictions to be generated first.</p>
            <p>Please check back in a few minutes or contact support if this issue persists.</p>
        </div>
    </div>

    <script>
        // Auto-refresh every 30 seconds
        setTimeout(function() {
            window.location.reload();
        }, 30000);

        // Play a subtle sound when dependencies are met (if supported)
        function checkDependencies() {
            fetch(window.location.href)
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.text();
                })
                .then(html => {
                    if (!html.includes('Missing Dependencies')) {
                        // Dependencies met, play notification
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('Pre-Market Briefing Ready', {
                                body: 'All dependencies satisfied. Briefing is now available.',
                                icon: '/favicon.ico'
                            });
                        }
                        window.location.reload();
                    }
                })
                .catch(error => {
                    console.log('Dependency check failed:', error);
                });
        }

        // Check every 10 seconds
        setInterval(checkDependencies, 10000);

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    </script>
</body>
</html>`;
}

/**
 * Default briefing data when no analysis is available
 */
function getDefaultBriefingData() {
  return {
    bias: 'neutral',
    biasDisplay: 'NEUTRAL',
    confidence: 50,
    highConfidenceUps: [
      { symbol: 'AAPL', expectedMove: '1.5', confidence: 75, driver: 'Technical breakout pattern' },
      { symbol: 'MSFT', expectedMove: '1.2', confidence: 73, driver: 'Cloud momentum strength' }
    ],
    highConfidenceDowns: [
      { symbol: 'TSLA', expectedMove: '2.1', confidence: 76, driver: 'Production headwinds' }
    ],
    strongestSectors: ['Technology', 'Consumer Discretionary'],
    weakestSectors: ['Healthcare', 'Energy'],
    riskItems: [
      { symbol: 'SPY', description: 'Monitor for overall market volatility' },
      { symbol: 'QQQ', description: 'Tech sector concentration risk' }
    ]
  };
}

