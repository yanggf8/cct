/**
 * HTML Generation Utilities for Report Handlers
 * Centralizes HTML generation logic to reduce handler complexity
 */
import { createLogger } from './logging.js';
const logger = createLogger('html-generators');
/**
 * Common HTML header template
 */
export function generateHTMLHeader(title, description) {
    const timestamp = new Date().toISOString();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Dual AI Sentiment Analysis</title>
    <meta name="description" content="${description}">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header {
            text-align: center;
            background: white;
            padding: 2rem;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        .header h1 { color: #2c3e50; margin-bottom: 0.5rem; }
        .header p { color: #7f8c8d; font-size: 1.1rem; }
        .status-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 25px;
            font-weight: bold;
            font-size: 0.9rem;
            margin-left: 1rem;
        }
        .status-healthy { background: #2ecc71; color: white; }
        .status-warning { background: #f39c12; color: white; }
        .status-error { background: #e74c3c; color: white; }
        .card {
            background: white;
            border-radius: 15px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        .card:hover { transform: translateY(-2px); }
        .card h2 { color: #2c3e50; margin-bottom: 1rem; border-bottom: 2px solid #3498db; padding-bottom: 0.5rem; }
        .signal-item {
            padding: 1rem;
            border-left: 4px solid #3498db;
            margin-bottom: 1rem;
            background: #f8f9fa;
            border-radius: 0 8px 8px 0;
        }
        .signal-item.bullish { border-left-color: #2ecc71; }
        .signal-item.bearish { border-left-color: #e74c3c; }
        .signal-item.neutral { border-left-color: #f39c12; }
        .confidence-bar {
            width: 100%;
            height: 8px;
            background: #ecf0f1;
            border-radius: 4px;
            overflow: hidden;
            margin: 0.5rem 0;
        }
        .confidence-fill {
            height: 100%;
            background: linear-gradient(90deg, #3498db, #2ecc71);
            border-radius: 4px;
            transition: width 0.3s ease;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 1rem 0;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
            border: 2px solid #e9ecef;
        }
        .metric-value { font-size: 2rem; font-weight: bold; color: #2c3e50; }
        .metric-label { color: #7f8c8d; font-size: 0.9rem; margin-top: 0.5rem; }
        .footer {
            text-align: center;
            padding: 2rem;
            color: #7f8c8d;
            margin-top: 2rem;
        }
        .timestamp { font-size: 0.9rem; opacity: 0.7; }
        .error-container {
            background: #fee;
            border: 1px solid #fcc;
            color: #c33;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
        }
        .warning-container {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
        }
        .success-container {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
        }
        .nav-tabs {
            display: flex;
            margin-bottom: 1rem;
            border-bottom: 2px solid #e9ecef;
        }
        .nav-tab {
            padding: 0.75rem 1.5rem;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1rem;
            color: #6c757d;
            border-bottom: 2px solid transparent;
            transition: all 0.3s ease;
        }
        .nav-tab.active {
            color: #3498db;
            border-bottom-color: #3498db;
        }
        .nav-tab:hover {
            color: #2c3e50;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }

        /* Dual AI Analysis Styles */
        .ai-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .agreement-badge {
            background: #3498db;
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
            white-space: nowrap;
        }
        .agreement-badge.agree { background: #2ecc71; }
        .agreement-badge.partial { background: #f39c12; }
        .agreement-badge.disagree { background: #e74c3c; }

        .ai-comparison {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin: 1rem 0;
        }

        .model-result {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .model-result:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .model-result h4 {
            margin-bottom: 0.5rem;
            color: #2c3e50;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .model-result .model-icon {
            font-size: 1.2rem;
        }

        .signal-recommendation {
            background: linear-gradient(135deg, #e8f5e8 0%, #d4edda 100%);
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
            position: relative;
            overflow: hidden;
        }

        .signal-recommendation::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: #28a745;
        }

        .agreement-details {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
            position: relative;
            overflow: hidden;
        }

        .agreement-details::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: #ffc107;
        }

        .agreement-details h4,
        .signal-recommendation h4 {
            margin-bottom: 0.5rem;
            color: #2c3e50;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .confidence-correlation {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin: 0.5rem 0;
            padding: 0.5rem;
            background: rgba(52, 152, 219, 0.1);
            border-radius: 4px;
        }

        .confidence-correlation-bar {
            flex: 1;
            height: 6px;
            background: #e9ecef;
            border-radius: 3px;
            position: relative;
            overflow: hidden;
        }

        .confidence-correlation-fill {
            height: 100%;
            background: linear-gradient(90deg, #3498db, #2ecc71);
            border-radius: 3px;
            transition: width 0.3s ease;
        }

        .agreement-visual-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            margin: 1rem 0;
            padding: 1rem;
            border-radius: 8px;
            font-weight: bold;
        }

        .agreement-visual-indicator.agree {
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .agreement-visual-indicator.partial {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            color: #856404;
            border: 1px solid #ffeaa7;
        }

        .agreement-visual-indicator.disagree {
            background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .model-confidence-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0.25rem 0;
            font-size: 0.85rem;
        }

        .confidence-value {
            font-weight: bold;
            color: #2c3e50;
            min-width: 45px;
        }

        .model-direction {
            display: inline-block;
            padding: 0.2rem 0.5rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: bold;
            text-transform: uppercase;
        }

        .model-direction.bullish {
            background: #d4edda;
            color: #155724;
        }

        .model-direction.bearish {
            background: #f8d7da;
            color: #721c24;
        }

        .model-direction.neutral {
            background: #fff3cd;
            color: #856404;
        }

        @media (max-width: 768px) {
            .ai-comparison { grid-template-columns: 1fr; }
            .ai-header { flex-direction: column; align-items: flex-start; }
            .container { padding: 10px; }
            .header { padding: 1.5rem; }
            .metrics-grid { grid-template-columns: 1fr; }
            .nav-tabs { flex-wrap: wrap; }
            .nav-tab { flex: 1; min-width: 120px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 ${title}</h1>
            <p>${description}</p>
            <span class="timestamp">Generated: ${new Date(timestamp).toLocaleString()}</span>
        </div>`;
}
/**
 * Common HTML footer template
 */
export function generateHTMLFooter(systemStatus = 'Operational') {
    return `
        <div class="footer">
            <p><strong>Dual AI Sentiment Analysis System</strong> | Status: <span class="status-badge status-healthy">${systemStatus}</span></p>
            <p>AI-Powered Sentiment Analysis with Dual AI Comparison System</p>
            <p class="timestamp">This system is for research and educational purposes only. Not financial advice.</p>
        </div>
    </div>
    <script>
        // Simple tab functionality
        document.addEventListener('DOMContentLoaded', function() {
            const tabs = document.querySelectorAll('.nav-tab');
            const contents = document.querySelectorAll('.tab-content');

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetId = tab.getAttribute('data-tab');

                    tabs.forEach(t => t.classList.remove('active'));
                    contents.forEach(c => c.classList.remove('active'));

                    tab.classList.add('active');
                    document.getElementById(targetId).classList.add('active');
                });
            });
        });
    </script>
</body>
</html>`;
}
/**
 * Generate metrics display grid
 */
export function generateMetricsGrid(metrics) {
    const metricCards = metrics.map(metric => `
        <div class="metric-card">
            <div class="metric-value">${metric.value}</div>
            <div class="metric-label">${metric.label}</div>
            ${metric.trend ? `<small style="color: ${metric.trendColor || '#6c757d'}">${metric.trend}</small>` : ''}
        </div>`).join('');
    return `
        <div class="metrics-grid">
            ${metricCards}
        </div>`;
}
/**
 * Generate signal display item
 */
export function generateSignalItem(signal) {
    const directionClass = signal.direction.toLowerCase();
    const confidence = signal.confidence || 0;
    const confidencePercentage = Math.round(confidence * 100);
    return `
        <div class="signal-item ${directionClass}">
            <h3>${signal.symbol} - ${signal.direction}</h3>
            <p><strong>Confidence:</strong> ${confidencePercentage}%</p>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${confidencePercentage}%"></div>
            </div>
            ${signal.reason ? `<p><strong>Reason:</strong> ${signal.reason}</p>` : ''}
            ${signal.targetPrice ? `<p><strong>Target:</strong> $${signal.targetPrice}</p>` : ''}
            ${signal.analysis ? `<p><strong>Analysis:</strong> ${signal.analysis}</p>` : ''}
        </div>`;
}
/**
 * Generate dual AI signal display item with enhanced model comparison
 */
export function generateDualAISignalItem(signal) {
    const comparison = signal.comparison || {};
    const models = signal.models || {};
    const tradingSignal = signal.signal || {};
    const gptResult = models.gpt || {};
    const distilbertResult = models.distilbert || {};
    const directionClass = tradingSignal.direction?.toLowerCase() || 'neutral';
    const agreementEmoji = comparison.agree ? '✅' :
        comparison.agreement_type === 'partial_agreement' ? '⚠️' : '❌';
    const avgConfidence = ((gptResult.confidence || 0) + (distilbertResult.confidence || 0)) / 2;
    const confidenceSpread = Math.abs((gptResult.confidence || 0) - (distilbertResult.confidence || 0));
    return `
        <div class="signal-item ${directionClass}">
            <div class="ai-header">
                <h3>${signal.symbol} - Dual AI Analysis</h3>
                <span class="agreement-badge ${comparison.agreement_type}" title="${comparison.agreement_type}">
                    ${agreementEmoji} ${comparison.agreement_type?.replace('_', ' ').toUpperCase()}
                </span>
            </div>

            <div class="agreement-visual-indicator ${comparison.agreement_type}">
                <span>${agreementEmoji}</span>
                <span>${comparison.agreement_type?.replace('_', ' ').toUpperCase()}</span>
                <span>Avg Confidence: ${Math.round(avgConfidence * 100)}%</span>
            </div>

            <div class="ai-comparison">
                <div class="model-result">
                    <h4><span class="model-icon">🤖</span> GPT-OSS-120B</h4>
                    <div class="model-confidence-indicator">
                        <span class="model-direction ${gptResult.direction?.toLowerCase() || 'neutral'}">
                            ${gptResult.direction?.toUpperCase() || 'N/A'}
                        </span>
                        <span class="confidence-value">${Math.round((gptResult.confidence || 0) * 100)}%</span>
                    </div>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${(gptResult.confidence || 0) * 100}%"></div>
                    </div>
                    ${gptResult.reasoning ? `<p style="font-size: 0.85rem; color: #6c757d; margin-top: 0.5rem;">${gptResult.reasoning.substring(0, 100)}...</p>` : ''}
                </div>

                <div class="model-result">
                    <h4><span class="model-icon">🧠</span> DistilBERT</h4>
                    <div class="model-confidence-indicator">
                        <span class="model-direction ${distilbertResult.direction?.toLowerCase() || 'neutral'}">
                            ${distilbertResult.direction?.toUpperCase() || 'N/A'}
                        </span>
                        <span class="confidence-value">${Math.round((distilbertResult.confidence || 0) * 100)}%</span>
                    </div>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${(distilbertResult.confidence || 0) * 100}%"></div>
                    </div>
                    ${distilbertResult.sentiment_breakdown ? `
                        <div style="font-size: 0.85rem; color: #6c757d; margin-top: 0.5rem;">
                            <strong>Sentiment:</strong>
                            📈 ${distilbertResult.sentiment_breakdown.bullish || 0} |
                            📉 ${distilbertResult.sentiment_breakdown.bearish || 0} |
                            ➖ ${distilbertResult.sentiment_breakdown.neutral || 0}
                        </div>
                    ` : ''}
                </div>
            </div>

            ${confidenceSpread < 0.2 ? `
                <div class="confidence-correlation">
                    <span style="font-size: 0.85rem; color: #6c757d;">High Confidence Correlation</span>
                    <div class="confidence-correlation-bar">
                        <div class="confidence-correlation-fill" style="width: ${Math.max((gptResult.confidence || 0), (distilbertResult.confidence || 0)) * 100}%"></div>
                    </div>
                    <span style="font-size: 0.85rem; font-weight: bold; color: #2c3e50;">Spread: ${Math.round(confidenceSpread * 100)}%</span>
                </div>
            ` : ''}

            ${tradingSignal.action ? `
                <div class="signal-recommendation">
                    <h4>🎯 Trading Recommendation</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.5rem;">
                        <div>
                            <strong>Action:</strong>
                            <span class="model-direction ${tradingSignal.direction?.toLowerCase() || 'neutral'}" style="margin-left: 0.5rem;">
                                ${tradingSignal.action}
                            </span>
                        </div>
                        <div>
                            <strong>Strength:</strong> ${tradingSignal.strength || 'MODERATE'}
                        </div>
                    </div>
                    <p style="margin: 0;"><strong>Reasoning:</strong> ${tradingSignal.reasoning || 'Not provided'}</p>
                </div>
            ` : ''}

            ${comparison.details ? `
                <div class="agreement-details">
                    <h4>📊 Agreement Analysis</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <strong>Match Direction:</strong> ${comparison.details.match_direction || 'N/A'}
                        </div>
                        <div>
                            <strong>Confidence Spread:</strong> ${Math.round((comparison.details.confidence_spread || 0) * 100)}%
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>`;
}
/**
 * Generate waiting/pending state display
 */
export function generateWaitingDisplay(message, validation = null) {
    const missingInfo = validation && validation.missing ? `
        <div class="warning-container">
            <h4>⏳ Waiting for Required Data</h4>
            <p>The following components need to complete first:</p>
            <ul>
                ${validation.missing.map(item => `<li>${item.replace(/_/g, ' ').toUpperCase()}</li>`).join('')}
            </ul>
            <p><strong>Completion Rate:</strong> ${validation.completionRate || 0}%</p>
        </div>` : '';
    return `
        <div class="warning-container">
            <h4>⏳ ${message}</h4>
            ${missingInfo}
            <p>This report will update automatically once the required data is available.</p>
            <p><small>Last checked: ${new Date().toLocaleString()}</small></p>
        </div>`;
}
/**
 * Generate error display
 */
export function generateErrorDisplay(error, details = null) {
    const detailsHtml = details ? `
        <div style="margin-top: 1rem; font-size: 0.9rem;">
            <strong>Details:</strong>
            <pre style="background: #f8f9fa; padding: 0.5rem; border-radius: 4px; overflow-x: auto;">${JSON.stringify(details, null, 2)}</pre>
        </div>` : '';
    return `
        <div class="error-container">
            <h4>❌ Error Occurred</h4>
            <p>${error}</p>
            ${detailsHtml}
            <p>Please try again later or check system status.</p>
        </div>`;
}
/**
 * Generate success display
 */
export function generateSuccessDisplay(message, data = null) {
    const dataHtml = data ? `
        <div style="margin-top: 1rem;">
            <strong>Results:</strong>
            <ul>
                ${Object.entries(data).map(([key, value]) => `<li><strong>${key.replace(/_/g, ' ')}:</strong> ${value}</li>`).join('')}
            </ul>
        </div>` : '';
    return `
        <div class="success-container">
            <h4>✅ ${message}</h4>
            ${dataHtml}
        </div>`;
}
/**
 * Generate loading spinner
 */
export function generateLoadingSpinner(message = 'Loading...') {
    return `
        <div style="text-align: center; padding: 2rem;">
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
            <p>${message}</p>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>`;
}
/**
 * Generate navigation tabs
 */
export function generateNavigationTabs(tabs) {
    const tabButtons = tabs.map(tab => `
        <button class="nav-tab ${tab.active ? 'active' : ''}" data-tab="${tab.id}">
            ${tab.label}
        </button>`).join('');
    return `
        <div class="nav-tabs">
            ${tabButtons}
        </div>`;
}
/**
 * Complete page generator
 */
export function generateCompletePage(title, description, content, status = 'Operational') {
    return generateHTMLHeader(title, description) + content + generateHTMLFooter(status);
}
/**
 * Generate enhanced metrics grid with trend indicators
 */
export function generateEnhancedMetricsGrid(metrics, title = 'Performance Metrics') {
    const metricCards = metrics.map(metric => `
        <div class="metric-card" style="position: relative; overflow: hidden;">
            <div class="metric-value" style="color: ${metric.color || '#2c3e50'};">${metric.value}</div>
            <div class="metric-label">${metric.label}</div>
            ${metric.trend ? `
                <div style="position: absolute; top: 10px; right: 10px;">
                    <span style="color: ${metric.trendColor || '#6c757d'}; font-size: 0.9rem;">
                        ${metric.trend}
                    </span>
                </div>
            ` : ''}
            ${metric.description ? `
                <div style="font-size: 0.8rem; color: #6c757d; margin-top: 0.25rem;">
                    ${metric.description}
                </div>
            ` : ''}
            ${metric.progress !== undefined ? `
                <div class="confidence-bar" style="margin-top: 0.5rem;">
                    <div class="confidence-fill" style="width: ${metric.progress}%; background: ${metric.progressColor || '#3498db'};"></div>
                </div>
            ` : ''}
        </div>`).join('');
    return `
        <div class="card">
            <h2>${title}</h2>
            <div class="metrics-grid">
                ${metricCards}
            </div>
        </div>`;
}
/**
 * Generate comprehensive dual AI analysis summary
 */
export function generateDualAISummary(analysis) {
    const totalSignals = Object.keys(analysis || {}).length;
    const agreementStats = calculateAgreementStats(analysis);
    return `
        <div class="card">
            <h2>🤖 Dual AI Analysis Summary</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">${totalSignals}</div>
                    <div class="metric-label">Symbols Analyzed</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: #2ecc71;">${agreementStats.agreementRate}%</div>
                    <div class="metric-label">Model Agreement Rate</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: #3498db;">${agreementStats.avgConfidence}%</div>
                    <div class="metric-label">Average Confidence</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: #f39c12;">${agreementStats.highConfidenceSignals}</div>
                    <div class="metric-label">High Confidence Signals</div>
                </div>
            </div>
        </div>`;
}
/**
 * Generate market sentiment overview
 */
export function generateMarketSentimentOverview(sentiment) {
    const bullish = sentiment.bullish || 0;
    const bearish = sentiment.bearish || 0;
    const neutral = sentiment.neutral || 0;
    const total = bullish + bearish + neutral;
    const bullishPercent = total > 0 ? (bullish / total) * 100 : 0;
    const bearishPercent = total > 0 ? (bearish / total) * 100 : 0;
    const neutralPercent = total > 0 ? (neutral / total) * 100 : 0;
    const marketBias = bullishPercent > bearishPercent ? 'BULLISH' :
        bearishPercent > bullishPercent ? 'BEARISH' : 'NEUTRAL';
    const biasColor = bullishPercent > bearishPercent ? '#2ecc71' :
        bearishPercent > bullishPercent ? '#e74c3c' : '#f39c12';
    return `
        <div class="card">
            <h2>📊 Market Sentiment Overview</h2>
            <div style="text-align: center; margin-bottom: 1rem;">
                <div style="font-size: 2rem; font-weight: bold; color: ${biasColor}; margin-bottom: 0.5rem;">
                    ${marketBias}
                </div>
                <div style="color: #6c757d; font-size: 0.9rem;">
                    Market Bias Based on ${total} Signal Analyses
                </div>
            </div>

            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: #2ecc71;">📈 Bullish: ${bullishPercent.toFixed(1)}%</span>
                    <span style="color: #e74c3c;">📉 Bearish: ${bearishPercent.toFixed(1)}%</span>
                    <span style="color: #f39c12;">➖ Neutral: ${neutralPercent.toFixed(1)}%</span>
                </div>
                <div style="height: 30px; background: #f8f9fa; border-radius: 15px; overflow: hidden; display: flex;">
                    <div style="width: ${bullishPercent}%; background: #2ecc71; display: flex; align-items: center; justify-content: center;">
                        ${bullishPercent > 10 ? `<span style="color: white; font-size: 0.8rem; font-weight: bold;">${bullishPercent.toFixed(0)}%</span>` : ''}
                    </div>
                    <div style="width: ${bearishPercent}%; background: #e74c3c; display: flex; align-items: center; justify-content: center;">
                        ${bearishPercent > 10 ? `<span style="color: white; font-size: 0.8rem; font-weight: bold;">${bearishPercent.toFixed(0)}%</span>` : ''}
                    </div>
                    <div style="width: ${neutralPercent}%; background: #f39c12; display: flex; align-items: center; justify-content: center;">
                        ${neutralPercent > 10 ? `<span style="color: white; font-size: 0.8rem; font-weight: bold;">${neutralPercent.toFixed(0)}%</span>` : ''}
                    </div>
                </div>
            </div>

            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value" style="color: #2ecc71;">${bullish}</div>
                    <div class="metric-label">Bullish Signals</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: #e74c3c;">${bearish}</div>
                    <div class="metric-label">Bearish Signals</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: #f39c12;">${neutral}</div>
                    <div class="metric-label">Neutral Signals</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${total}</div>
                    <div class="metric-label">Total Signals</div>
                </div>
            </div>
        </div>`;
}
/**
 * Calculate agreement statistics from analysis data
 */
function calculateAgreementStats(analysis) {
    const signals = Object.values(analysis || {});
    const totalSignals = signals.length;
    if (totalSignals === 0) {
        return {
            agreementRate: 0,
            avgConfidence: 0,
            highConfidenceSignals: 0
        };
    }
    const agreements = signals.filter(s => s.comparison?.agree).length;
    const confidences = signals.map(s => {
        const gptConf = s.models?.gpt?.confidence || 0;
        const dbConf = s.models?.distilbert?.confidence || 0;
        return (gptConf + dbConf) / 2;
    });
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    const highConfidenceSignals = confidences.filter(conf => conf >= 0.7).length;
    return {
        agreementRate: Math.round((agreements / totalSignals) * 100),
        avgConfidence: Math.round(avgConfidence * 100),
        highConfidenceSignals
    };
}
export default {
    generateHTMLHeader,
    generateHTMLFooter,
    generateMetricsGrid,
    generateSignalItem,
    generateDualAISignalItem,
    generateWaitingDisplay,
    generateErrorDisplay,
    generateSuccessDisplay,
    generateLoadingSpinner,
    generateNavigationTabs,
    generateCompletePage,
    generateEnhancedMetricsGrid,
    generateDualAISummary,
    generateMarketSentimentOverview
};
//# sourceMappingURL=html-generators.js.map