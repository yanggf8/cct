/**
 * Weekly Review Handler
 * Analyzes high-confidence signal accuracy patterns and provides comprehensive weekly insights
 */

import { createLogger } from '../logging.js';
import { createHandler } from '../handler-factory.js';
import { generateWeeklyReviewAnalysis } from '../report/weekly-review-analysis.js';
import { getWeeklyReviewData } from '../report-data-retrieval.js';
import { writeD1ReportSnapshot } from '../d1-job-storage.js';
import { createSimplifiedEnhancedDAL } from '../simplified-enhanced-dal.js';
import { SHARED_NAV_CSS, getSharedNavHTML, getNavScripts } from '../../utils/html-templates.js';
import type { CloudflareEnvironment } from '../../types';

const logger = createLogger('weekly-review-handlers');

/**
 * Generate Weekly Review Page
 */
export const handleWeeklyReview = createHandler('weekly-review', async (request: Request, env: CloudflareEnvironment, ctx: any) => {
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
      const cached = await dal.read(`weekly_html_${dateStr}`);
      if (cached.success && cached.data) {
        return new Response(cached.data, {
          headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=600', 'X-Cache': 'HIT', 'X-Request-ID': requestId }
        });
      }
    } catch (e) { /* continue */ }
  }

  logger.info('📈 [WEEKLY-REVIEW] Starting weekly review generation', {
    requestId,
    bypassCache
  });

  logger.debug('📊 [WEEKLY-REVIEW] Retrieving weekly review data', {
    requestId,
    date: dateStr
  });

  let weeklyData: any = null;

  try {
    weeklyData = await getWeeklyReviewData(env, today);

    if (weeklyData) {
      logger.info('✅ [WEEKLY-REVIEW] Weekly data retrieved successfully', {
        requestId,
        totalSignals: weeklyData.totalSignals || 0,
        tradingDays: weeklyData.tradingDays || 0,
        hasData: true
      });
    } else {
      logger.warn('⚠️ [WEEKLY-REVIEW] No weekly data found for this week', {
        requestId
      });
    }

  } catch (error: any) {
    logger.error('❌ [WEEKLY-REVIEW] Failed to retrieve weekly data', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });
  }

  // Generate HTML
  const htmlContent = generateWeeklyReviewHTML(weeklyData, requestId, today);

  // Write snapshot to D1 and cache HTML
  const dal = createSimplifiedEnhancedDAL(env);
  if (weeklyData) {
    await writeD1ReportSnapshot(env, dateStr, 'weekly', weeklyData, {
      processingTimeMs: Date.now() - startTime,
      tradingDays: weeklyData.tradingDays || 0,
      ai_models: {
        primary: '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
        secondary: '@cf/huggingface/distilbert-sst-2-int8'
      }
    });
    await dal.write(`weekly_${dateStr}`, weeklyData, { expirationTtl: 86400 });
  }
  await dal.write(`weekly_html_${dateStr}`, htmlContent, { expirationTtl: 600 });

  logger.info('🎯 [WEEKLY-REVIEW] Weekly review completed', {
    requestId,
    duration: Date.now() - startTime,
    hasData: !!weeklyData
  });

  return new Response(htmlContent, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300' // 5 minute cache
    }
  });
});

/**
 * Generate comprehensive weekly review HTML
 */
function generateWeeklyReviewHTML(
  weeklyData: any,
  requestId: string,
  currentDate: Date
): string {
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekRange = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
  
  // Check for actual data
  const hasRealData = weeklyData && (weeklyData.totalSignals > 0 || weeklyData.tradingDays > 0);
  
  // Scheduled time: Sunday 10:00 AM ET = 15:00 UTC
  const scheduledUtc = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate(), 15, 0);
  const isSunday = currentDate.getDay() === 0;
  const beforeSchedule = isSunday && Date.now() < scheduledUtc;
  
  // Determine display status - local time computed client-side
  let statusDisplay: string;
  if (hasRealData) {
    statusDisplay = `Generated ${currentDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })} ET`;
  } else if (beforeSchedule) {
    statusDisplay = `⏳ Scheduled: Sunday <span class="sched-time" data-utch="15" data-utcm="0"></span>`;
  } else {
    statusDisplay = `⚠️ No data available`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Trading Review - ${weekRange}</title>
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

        .week-range {
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

        .performance-table {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            margin-bottom: 40px;
        }

        .performance-table h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
            text-align: center;
            color: #4facfe;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        th {
            background: rgba(255, 255, 255, 0.05);
            font-weight: 600;
            color: #4facfe;
        }

        tr:hover {
            background: rgba(255, 255, 255, 0.03);
        }

        .accuracy-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .accuracy-high {
            background: rgba(79, 172, 254, 0.2);
            color: #4facfe;
        }

        .accuracy-medium {
            background: rgba(254, 202, 87, 0.2);
            color: #feca57;
        }

        .accuracy-low {
            background: rgba(255, 107, 107, 0.2);
            color: #ff6b6b;
        }

        .insights-section {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .insights-section h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
            text-align: center;
            color: #4facfe;
        }

        .insight-item {
            margin-bottom: 20px;
            padding: 15px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            border-left: 4px solid #4facfe;
        }

        .insight-item h4 {
            color: #00f2fe;
            margin-bottom: 8px;
        }

        .insight-item p {
            color: rgba(255, 255, 255, 0.9);
            font-size: 0.95rem;
        }

        @media (max-width: 768px) {
            .charts-section {
                grid-template-columns: 1fr;
            }

            .summary-grid {
                grid-template-columns: repeat(2, 1fr);
            }

            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    ${getSharedNavHTML('weekly')}
    <div class="container">
        <div class="header">
            <h1>📊 Weekly Trading Review</h1>
            <p>Comprehensive analysis of your trading performance and signal accuracy</p>
            <div class="week-range">${weekRange} • ${statusDisplay}</div>
        </div>

        ${!hasRealData ? `
        <div class="no-data">
            <h3>${beforeSchedule ? '⏳ Report Not Yet Generated' : '⚠️ No Weekly Data Available'}</h3>
            <p>${beforeSchedule ? `This report will be generated on Sunday <span class="sched-time" data-utch="15" data-utcm="0"></span>.` : 'There is no trading data available for this week.'}</p>
            <button class="refresh-button" onclick="location.reload()">Refresh Page</button>
        </div>
        ` : `
        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Signals</h3>
                <div class="value">${weeklyData.totalSignals || 0}</div>
                <div class="label">High-confidence predictions</div>
            </div>
            <div class="summary-card">
                <h3>Accuracy Rate</h3>
                <div class="value">${weeklyData.accuracyRate ? Math.round(weeklyData.accuracyRate * 100) + '%' : 'N/A'}</div>
                <div class="label">Overall success rate</div>
            </div>
            <div class="summary-card">
                <h3>Trading Days</h3>
                <div class="value">${weeklyData.tradingDays || 0}</div>
                <div class="label">Days analyzed</div>
            </div>
            <div class="summary-card">
                <h3>Avg Confidence</h3>
                <div class="value">${weeklyData.avgConfidence ? Math.round(weeklyData.avgConfidence * 100) + '%' : 'N/A'}</div>
                <div class="label">Prediction confidence</div>
            </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-section">
            <div class="chart-container">
                <h2>📈 Daily Accuracy Trend</h2>
                <div class="chart-wrapper">
                    <canvas id="accuracyTrendChart"></canvas>
                </div>
            </div>

            <div class="chart-container">
                <h2>🎯 Signal Distribution</h2>
                <div class="chart-wrapper">
                    <canvas id="signalDistributionChart"></canvas>
                </div>
            </div>

            <div class="chart-container full-width">
                <h2>📊 Performance by Symbol</h2>
                <div class="chart-wrapper">
                    <canvas id="symbolPerformanceChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Performance Table -->
        <div class="performance-table">
            <h2>📋 Daily Performance Breakdown</h2>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Signals</th>
                        <th>Correct</th>
                        <th>Accuracy</th>
                        <th>Avg Confidence</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${generatePerformanceTableRows(weeklyData)}
                </tbody>
            </table>
        </div>

        <!-- Insights Section -->
        <div class="insights-section">
            <h2>🔍 Weekly Insights</h2>
            ${generateInsightsHTML(weeklyData)}
        </div>
        `}
    </div>

    ${hasRealData ? `
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

            // Accuracy Trend Chart
            const accuracyCtx = document.getElementById('accuracyTrendChart').getContext('2d');
            new Chart(accuracyCtx, {
                type: 'line',
                data: {
                    labels: ${JSON.stringify(weeklyData.dailyData?.map((d: any) => d.date) || [])},
                    datasets: [{
                        label: 'Daily Accuracy (%)',
                        data: ${JSON.stringify(weeklyData.dailyData?.map((d: any) => (d.accuracy || 0) * 100) || [])},
                        borderColor: '#4facfe',
                        backgroundColor: 'rgba(79, 172, 254, 0.1)',
                        tension: 0.4
                    }]
                },
                options: chartOptions
            });

            // Signal Distribution Chart
            const distributionCtx = document.getElementById('signalDistributionChart').getContext('2d');
            new Chart(distributionCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Bullish', 'Bearish', 'Neutral'],
                    datasets: [{
                        data: ${JSON.stringify([
                            weeklyData.signalDistribution?.bullish || 0,
                            weeklyData.signalDistribution?.bearish || 0,
                            weeklyData.signalDistribution?.neutral || 0
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

            // Symbol Performance Chart
            const symbolCtx = document.getElementById('symbolPerformanceChart').getContext('2d');
            new Chart(symbolCtx, {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify(weeklyData.symbolPerformance?.map((s: any) => s.symbol) || [])},
                    datasets: [{
                        label: 'Accuracy (%)',
                        data: ${JSON.stringify(weeklyData.symbolPerformance?.map((s: any) => (s.accuracy || 0) * 100) || [])},
                        backgroundColor: 'rgba(79, 172, 254, 0.8)',
                        borderColor: '#4facfe',
                        borderWidth: 1
                    }]
                },
                options: chartOptions
            });
        }
    </script>
    ` : ''}
    <script>
      document.querySelectorAll('.sched-time').forEach(el => {
        const utcH = parseInt(el.dataset.utch);
        const utcM = parseInt(el.dataset.utcm || '0');
        const d = new Date();
        d.setUTCHours(utcH, utcM, 0, 0);
        const et = d.toLocaleTimeString('en-US', {timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true});
        const local = d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
        el.textContent = et + ' ET (' + local + ' local)';
      });
    </script>
</body>
</html>`;
}

/**
 * Generate performance table rows HTML
 */
function generatePerformanceTableRows(weeklyData: any): string {
  if (!weeklyData.dailyData || weeklyData.dailyData.length === 0) {
    return '<tr><td colspan="6" style="text-align: center; padding: 20px;">No daily performance data available</td></tr>';
  }

  return weeklyData.dailyData.map((day: any) => {
    const accuracy = day.accuracy ? Math.round(day.accuracy * 100) : 0;
    const confidence = day.avgConfidence ? Math.round(day.avgConfidence * 100) : 0;
    const accuracyClass = accuracy >= 70 ? 'accuracy-high' : accuracy >= 50 ? 'accuracy-medium' : 'accuracy-low';

    return `
      <tr>
        <td>${day.date}</td>
        <td>${day.totalSignals || 0}</td>
        <td>${day.correctSignals || 0}</td>
        <td><span class="accuracy-badge ${accuracyClass}">${accuracy}%</span></td>
        <td>${confidence}%</td>
        <td>${day.status || 'Completed'}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Send weekly review with tracking (cron job integration)
 */
export async function sendWeeklyReviewWithTracking(
  analysisResult: any,
  env: CloudflareEnvironment,
  cronExecutionId: string
): Promise<void> {
  console.log(`🚀 [WEEKLY-REVIEW] ${cronExecutionId} Starting weekly review with Facebook messaging`);

  // Generate the weekly analysis data using the report module
  const weeklyData = analysisResult || await generateWeeklyReviewAnalysis(env as any, new Date());

  const now = new Date();
  const weeklyAccuracy = weeklyData.accuracy || 68;
  const totalTrades = weeklyData.totalTrades || 25;
  const topPerformer = weeklyData.topPerformer || 'AAPL';
  const topPerformerGain = weeklyData.topPerformerGain || '+3.2%';
  const marketTrend = weeklyData.marketTrend || 'Mixed';

  // Note: Facebook integration has been removed - this is now a data processing function
  console.log(`📊 [WEEKLY-REVIEW] ${cronExecutionId} Weekly data processed:`, {
    accuracy: weeklyAccuracy,
    totalTrades,
    topPerformer,
    topPerformerGain,
    marketTrend
  });
}

/**
 * Generate insights HTML
 */
function generateInsightsHTML(weeklyData: any): string {
  const insights = [];

  if (weeklyData.accuracyRate && weeklyData.accuracyRate > 0.7) {
    insights.push({
      title: '🎯 Excellent Performance',
      content: `Your trading accuracy of ${Math.round(weeklyData.accuracyRate * 100)}% this week exceeds the 70% target threshold. Keep up the great work!`
    });
  } else if (weeklyData.accuracyRate && weeklyData.accuracyRate < 0.5) {
    insights.push({
      title: '⚠️ Performance Alert',
      content: `This week's accuracy of ${Math.round(weeklyData.accuracyRate * 100)}% is below 50%. Consider reviewing your signal generation criteria.`
    });
  }

  if (weeklyData.avgConfidence && weeklyData.avgConfidence > 0.8) {
    insights.push({
      title: '💪 High Confidence',
      content: `Average prediction confidence of ${Math.round(weeklyData.avgConfidence * 100)}% indicates strong signal quality this week.`
    });
  }

  if (weeklyData.totalSignals && weeklyData.totalSignals > 20) {
    insights.push({
      title: '📊 Active Trading',
      content: `Generated ${weeklyData.totalSignals} high-confidence signals this week, showing consistent market engagement.`
    });
  }

  // Add default insights if no specific ones
  if (insights.length === 0) {
    insights.push({
      title: '📈 Weekly Summary',
      content: 'Continue monitoring your signal accuracy and confidence levels to optimize trading performance.'
    });
  }

  return insights.map(insight => `
    <div class="insight-item">
      <h4>${insight.title}</h4>
      <p>${insight.content}</p>
    </div>
  `).join('');
}