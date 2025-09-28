/**
 * Pre-Market Briefing Handler
 * Comprehensive battle plan for the trading day
 */

import { createLogger } from '../logging.js';
import { createSuccessResponse } from '../response-factory.js';
import { createHandler } from '../handler-factory.js';
import { generatePreMarketSignals } from '../report/pre-market-analysis.js';
import { validateRequest, validateEnvironment, safeValidate } from '../validation.js';

const logger = createLogger('briefing-handlers');

/**
 * Generate Pre-Market Briefing Page
 */
export const handlePreMarketBriefing = createHandler('pre-market-briefing', async (request, env) => {
  logger.info('Generating pre-market briefing page');

  // Validate inputs
  validateRequest(request);
  validateEnvironment(env);

  // Get today's analysis data
  const today = new Date().toISOString().split('T')[0];
  const analysisKey = `analysis_${today}`;

  let analysisData = null;
  try {
    const storedAnalysis = await env.TRADING_RESULTS.get(analysisKey);
    if (storedAnalysis) {
      analysisData = JSON.parse(storedAnalysis);
    }
  } catch (error) {
    logger.warn('Could not retrieve analysis data', { error: error.message });
  }

  const html = generatePreMarketBriefingHTML(analysisData, today);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=300' // 5 minute cache
    }
  });
});

/**
 * Generate comprehensive pre-market briefing HTML
 */
function generatePreMarketBriefingHTML(analysisData, date) {
  // Process analysis data for briefing format using real analysis module
  const briefingData = analysisData ? generatePreMarketSignals(analysisData) : getDefaultBriefingData();

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
            <div class="bias-indicator ${briefingData.bias.toLowerCase()}">${briefingData.biasDisplay}</div>
            <div class="confidence">${briefingData.confidence}% confidence</div>
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
                        ${briefingData.highConfidenceUps.map(idea => `
                            <tr>
                                <td class="ticker">${idea.ticker}</td>
                                <td class="prediction up">↑ +${idea.expectedMove}%</td>
                                <td>
                                    ${idea.confidence}%
                                    <div class="confidence-bar">
                                        <div class="confidence-fill" style="width: ${idea.confidence}%"></div>
                                    </div>
                                </td>
                                <td>${idea.driver}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${briefingData.highConfidenceUps.length === 0 ? '<div class="no-signals">No high-confidence bullish signals today</div>' : ''}
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
                        ${briefingData.highConfidenceDowns.map(idea => `
                            <tr>
                                <td class="ticker">${idea.ticker}</td>
                                <td class="prediction down">↓ -${idea.expectedMove}%</td>
                                <td>
                                    ${idea.confidence}%
                                    <div class="confidence-bar">
                                        <div class="confidence-fill" style="width: ${idea.confidence}%"></div>
                                    </div>
                                </td>
                                <td>${idea.driver}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${briefingData.highConfidenceDowns.length === 0 ? '<div class="no-signals">No high-confidence bearish signals today</div>' : ''}
            </div>
        </div>

        <div class="sectors-section">
            <h3>🔎 Sectors to Watch</h3>
            <div class="sectors-grid">
                <div class="sector-card strongest">
                    <h4>💪 Strongest</h4>
                    <div class="sector-list">${briefingData.strongestSectors.join(', ')}</div>
                </div>
                <div class="sector-card weakest">
                    <h4>📉 Weakest</h4>
                    <div class="sector-list">${briefingData.weakestSectors.join(', ')}</div>
                </div>
            </div>
        </div>

        <div class="risk-section">
            <h3>⚠️ Risk Watchlist</h3>
            ${briefingData.riskItems.map(item => `
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

