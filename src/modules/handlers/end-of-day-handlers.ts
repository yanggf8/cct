/**
 * End-of-Day Summary Handler
 * Analyzes high-confidence signal performance and provides market close insights
 */

import { createLogger } from '../logging.js';
import { createHandler } from '../handler-factory.js';
import { generateEndOfDayAnalysis } from '../report/end-of-day-analysis.js';
import { getEndOfDaySummaryData } from '../report-data-retrieval.js';
import { writeD1ReportSnapshot } from '../d1-job-storage.js';
import { createSimplifiedEnhancedDAL } from '../simplified-enhanced-dal.js';
import { SHARED_NAV_CSS, getSharedNavHTML, getNavScripts } from '../../utils/html-templates.js';
import type { CloudflareEnvironment } from '../../types';

const logger = createLogger('end-of-day-handlers');

/**
 * Generate End-of-Day Summary Page
 */
export const handleEndOfDaySummary = createHandler('end-of-day-summary', async (request: Request, env: CloudflareEnvironment, ctx: any) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const url = new URL(request.url);
  const bypassCache = url.searchParams.get('bypass') === '1';

  // Fast path: check DO cache first (unless bypass)
  if (!bypassCache) {
    try {
      const dal = createSimplifiedEnhancedDAL(env);
      const cached = await dal.read(`end_of_day_html_${dateStr}`);
      if (cached.success && cached.data) {
        return new Response(cached.data, {
          headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=300', 'X-Cache': 'HIT', 'X-Request-ID': requestId }
        });
      }
    } catch (e) { /* continue */ }
  }

  logger.info('🏁 [END-OF-DAY] Starting end-of-day summary generation', {
    requestId,
    bypassCache
  });

  logger.debug('📊 [END-OF-DAY] Retrieving end-of-day summary data', {
    requestId,
    date: dateStr
  });

  let endOfDayData: any = null;

  try {
    endOfDayData = await getEndOfDaySummaryData(env, today);

    if (endOfDayData) {
      logger.info('✅ [END-OF-DAY] End-of-day data retrieved successfully', {
        requestId,
        signalCount: endOfDayData.signals?.length || 0,
        hasTomorrowOutlook: !!endOfDayData.tomorrowOutlook,
        hasData: true
      });
    } else {
      logger.warn('⚠️ [END-OF-DAY] No end-of-day data found for today', {
        requestId
      });
    }

  } catch (error: any) {
    logger.error('❌ [END-OF-DAY] Failed to retrieve end-of-day data', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });
  }

  // Generate HTML
  const htmlContent = generateEndOfDayHTML(endOfDayData, requestId, today);

  // Write snapshot to D1 and cache HTML
  const dal = createSimplifiedEnhancedDAL(env);
  if (endOfDayData) {
    await writeD1ReportSnapshot(env, dateStr, 'end-of-day', endOfDayData, {
      processingTimeMs: Date.now() - startTime,
      hasTomorrowOutlook: !!endOfDayData.tomorrowOutlook
    });
    await dal.write(`end_of_day_${dateStr}`, endOfDayData, { expirationTtl: 86400 });
  }
  await dal.write(`end_of_day_html_${dateStr}`, htmlContent, { expirationTtl: 300 });

  logger.info('🎯 [END-OF-DAY] End-of-day summary completed', {
    requestId,
    duration: Date.now() - startTime,
    hasData: !!endOfDayData
  });

  return new Response(htmlContent, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300' // 5 minute cache
    }
  });
});

/**
 * Generate comprehensive end-of-day HTML
 */
function generateEndOfDayHTML(
  endOfDayData: any,
  requestId: string,
  currentDate: Date
): string {
  const today = currentDate.toISOString().split('T')[0];
  const hasData = endOfDayData && Object.keys(endOfDayData).length > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>End-of-Day Trading Summary - ${today}</title>
    ${getNavScripts()}
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
    <script src="js/cct-api.js"></script>
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
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .header h1 {
            font-size: 2.8rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #4facfe, #00f2fe);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
            margin-bottom: 15px;
        }

        .date-display {
            font-size: 1.1rem;
            color: #00f2fe;
            font-weight: 600;
        }

        .no-data {
            text-align: center;
            padding: 60px 20px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            margin-bottom: 40px;
        }

        .no-data h3 {
            font-size: 1.5rem;
            color: #feca57;
            margin-bottom: 15px;
        }

        .no-data p {
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 25px;
        }

        .refresh-button {
            background: linear-gradient(45deg, #4facfe, #00f2fe);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.3s ease;
        }

        .refresh-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(79, 172, 254, 0.3);
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .summary-card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 25px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            text-align: center;
            transition: transform 0.3s ease;
        }

        .summary-card:hover {
            transform: translateY(-5px);
        }

        .summary-card h3 {
            font-size: 1.1rem;
            margin-bottom: 10px;
            opacity: 0.8;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .summary-card .value {
            font-size: 2.5rem;
            font-weight: bold;
            color: #00f2fe;
            margin-bottom: 5px;
        }

        .summary-card .label {
            font-size: 0.9rem;
            opacity: 0.7;
        }

        .charts-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }

        .chart-container {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .chart-container.full-width {
            grid-column: 1 / -1;
        }

        .chart-container h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
            text-align: center;
            color: #4facfe;
        }

        .chart-wrapper {
            position: relative;
            height: 300px;
        }

        .signals-section {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            margin-bottom: 40px;
        }

        .signals-section h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
            text-align: center;
            color: #4facfe;
        }

        .signal-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
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

        .signal-detail .label {
            opacity: 0.8;
        }

        .signal-detail .value {
            font-weight: 600;
        }

        .accuracy-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .accuracy-correct {
            background: rgba(79, 172, 254, 0.2);
            color: #4facfe;
        }

        .accuracy-incorrect {
            background: rgba(255, 107, 107, 0.2);
            color: #ff6b6b;
        }

        .accuracy-pending {
            background: rgba(254, 202, 87, 0.2);
            color: #feca57;
        }

        .tomorrow-outlook {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            margin-bottom: 40px;
        }

        .tomorrow-outlook h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
            text-align: center;
            color: #4facfe;
        }

        .outlook-content {
            text-align: center;
            padding: 20px;
        }

        .outlook-direction {
            font-size: 1.8rem;
            font-weight: bold;
            margin-bottom: 10px;
            color: #00f2fe;
        }

        .outlook-confidence {
            font-size: 1.1rem;
            margin-bottom: 15px;
            opacity: 0.9;
        }

        .outlook-reasoning {
            font-size: 1rem;
            color: rgba(255, 255, 255, 0.8);
            max-width: 600px;
            margin: 0 auto;
        }

        @media (max-width: 768px) {
            .charts-section {
                grid-template-columns: 1fr;
            }

            .summary-grid {
                grid-template-columns: repeat(2, 1fr);
            }

            .signal-grid {
                grid-template-columns: 1fr;
            }

            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    ${getSharedNavHTML('end-of-day')}
    <div class="container">
        <div class="header">
            <h1>🏁 End-of-Day Trading Summary</h1>
            <p>Comprehensive analysis of today's trading performance and market close</p>
            <div class="date-display">${today}</div>
        </div>

        ${!hasData ? `
        <div class="no-data">
            <h3>⚠️ No End-of-Day Data Available</h3>
            <p>There is no end-of-day data available for today. This data is typically generated after market close.</p>
            <button class="refresh-button" onclick="location.reload()">Refresh Page</button>
        </div>
        ` : `
        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Signals</h3>
                <div class="value">${endOfDayData.totalSignals || 0}</div>
                <div class="label">High-confidence predictions</div>
            </div>
            <div class="summary-card">
                <h3>Accuracy Rate</h3>
                <div class="value">${endOfDayData.accuracyRate ? Math.round(endOfDayData.accuracyRate * 100) + '%' : 'N/A'}</div>
                <div class="label">Today's success rate</div>
            </div>
            <div class="summary-card">
                <h3>Market Close</h3>
                <div class="value">${endOfDayData.marketClose || 'N/A'}</div>
                <div class="label">Market status</div>
            </div>
            <div class="summary-card">
                <h3>Avg Confidence</h3>
                <div class="value">${endOfDayData.avgConfidence ? Math.round(endOfDayData.avgConfidence * 100) + '%' : 'N/A'}</div>
                <div class="label">Prediction confidence</div>
            </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-section">
            <div class="chart-container">
                <h2>📈 Signal Performance Distribution</h2>
                <div class="chart-wrapper">
                    <canvas id="signalPerformanceChart"></canvas>
                </div>
            </div>

            <div class="chart-container">
                <h2>🎯 Confidence Analysis</h2>
                <div class="chart-wrapper">
                    <canvas id="confidenceChart"></canvas>
                </div>
            </div>

            <div class="chart-container full-width">
                <h2>📊 Symbol Performance Overview</h2>
                <div class="chart-wrapper">
                    <canvas id="symbolPerformanceChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Signals Section -->
        <div class="signals-section">
            <h2>🔍 Detailed Signal Analysis</h2>
            <div class="signal-grid">
                ${generateSignalCards(endOfDayData.signals || [])}
            </div>
        </div>

        <!-- Tomorrow's Outlook -->
        ${endOfDayData.tomorrowOutlook ? `
        <div class="tomorrow-outlook">
            <h2>🌅 Tomorrow's Market Outlook</h2>
            <div class="outlook-content">
                <div class="outlook-direction">${getDirectionEmoji(endOfDayData.tomorrowOutlook.direction)} ${endOfDayData.tomorrowOutlook.direction?.toUpperCase() || 'NEUTRAL'}</div>
                <div class="outlook-confidence">Confidence: ${Math.round((endOfDayData.tomorrowOutlook.confidence || 0) * 100)}%</div>
                <div class="outlook-reasoning">${endOfDayData.tomorrowOutlook.reasoning || 'Analysis in progress...'}</div>
            </div>
        </div>
        ` : ''}
        `}
    </div>

    ${hasData ? `
    <script>
        // Initialize charts when page loads
        document.addEventListener('DOMContentLoaded', function() {
            initializeCharts();
        });

        function initializeCharts() {
            const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            };

            // Signal Performance Chart
            const performanceCtx = document.getElementById('signalPerformanceChart').getContext('2d');
            new Chart(performanceCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Correct', 'Incorrect', 'Pending'],
                    datasets: [{
                        data: ${JSON.stringify([
                            endOfDayData.performanceDistribution?.correct || 0,
                            endOfDayData.performanceDistribution?.incorrect || 0,
                            endOfDayData.performanceDistribution?.pending || 0
                        ])},
                        backgroundColor: ['#4facfe', '#ff6b6b', '#feca57'],
                        borderWidth: 0
                    }]
                },
                options: {
                    ...chartOptions,
                    scales: undefined
                }
            });

            // Confidence Chart
            const confidenceCtx = document.getElementById('confidenceChart').getContext('2d');
            new Chart(confidenceCtx, {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify(endOfDayData.confidenceData?.map((c: any) => c.symbol) || [])},
                    datasets: [{
                        label: 'Confidence (%)',
                        data: ${JSON.stringify(endOfDayData.confidenceData?.map((c: any) => (c.confidence || 0) * 100) || [])},
                        backgroundColor: 'rgba(79, 172, 254, 0.8)',
                        borderColor: '#4facfe',
                        borderWidth: 1
                    }]
                },
                options: chartOptions
            });

            // Symbol Performance Chart
            const symbolCtx = document.getElementById('symbolPerformanceChart').getContext('2d');
            new Chart(symbolCtx, {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify(endOfDayData.symbolPerformance?.map((s: any) => s.symbol) || [])},
                    datasets: [{
                        label: 'Performance (%)',
                        data: ${JSON.stringify(endOfDayData.symbolPerformance?.map((s: any) => (s.performance || 0) * 100) || [])},
                        backgroundColor: ${JSON.stringify(endOfDayData.symbolPerformance?.map((s: any) =>
                            s.performance >= 0 ? 'rgba(79, 172, 254, 0.8)' : 'rgba(255, 107, 107, 0.8)'
                        ) || [])},
                        borderColor: '#4facfe',
                        borderWidth: 1
                    }]
                },
                options: chartOptions
            });
        }
    </script>
    ` : ''}
</body>
</html>`;
}

/**
 * Generate signal cards HTML
 */
function generateSignalCards(signals: any[]): string {
  if (!signals || signals.length === 0) {
    return '<p style="text-align: center; opacity: 0.7;">No signal data available for today.</p>';
  }

  return signals.map(signal => {
    const accuracyClass = signal.status === 'correct' ? 'accuracy-correct' :
                         signal.status === 'incorrect' ? 'accuracy-incorrect' : 'accuracy-pending';

    return `
      <div class="signal-card">
        <h4>${signal.symbol} ${getDirectionEmoji(signal.direction)}</h4>
        <div class="signal-detail">
          <span class="label">Direction:</span>
          <span class="value">${signal.direction?.toUpperCase() || 'N/A'}</span>
        </div>
        <div class="signal-detail">
          <span class="label">Confidence:</span>
          <span class="value">${Math.round((signal.confidence || 0) * 100)}%</span>
        </div>
        <div class="signal-detail">
          <span class="label">Status:</span>
          <span class="value">
            <span class="accuracy-badge ${accuracyClass}">
              ${signal.status?.toUpperCase() || 'PENDING'}
            </span>
          </span>
        </div>
        <div class="signal-detail">
          <span class="label">Target:</span>
          <span class="value">$${signal.targetPrice || 'N/A'}</span>
        </div>
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