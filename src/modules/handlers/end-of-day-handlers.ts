/**
 * End-of-Day Summary Handler
 * Analyzes high-confidence signal performance and provides market close insights
 * 
 * Data flow (D1 is source of truth with fallback):
 * 1. Read from D1 for queryDate
 * 2. If no D1 data, try fallback chain (latest D1 snapshot, predictions)
 * 3. If data exists → show it with created_at timestamp
 * 4. If no data AND querying today AND before 4:05 PM ET → show "Scheduled"
 * 5. If no data AND past scheduled time → show "No data available"
 */

import { createLogger } from '../logging.js';
import { createHandler } from '../handler-factory.js';
import { getD1FallbackData } from '../d1-job-storage.js';
import { createSimplifiedEnhancedDAL } from '../simplified-enhanced-dal.js';
import { SHARED_NAV_CSS, getSharedNavHTML, getNavScripts } from '../../utils/html-templates.js';
import type { CloudflareEnvironment } from '../../types';
import { getTodayInZone, resolveQueryDate, getCurrentTimeET } from './date-utils.js';

const logger = createLogger('end-of-day-handlers');

/**
 * Generate End-of-Day Summary Page
 */
export const handleEndOfDaySummary = createHandler('end-of-day-summary', async (request: Request, env: CloudflareEnvironment, ctx: any) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const url = new URL(request.url);
  const bypassCache = url.searchParams.get('bypass') === '1';
  
  // Resolve query date: ?date > ?tz > DO setting > ET default
  const queryDateStr = await resolveQueryDate(url, env.CACHE_DO as any);
  const todayET = getTodayInZone('America/New_York');

  // Fast path: check DO HTML cache first (unless bypass)
  if (!bypassCache) {
    try {
      const dal = createSimplifiedEnhancedDAL(env);
      const cached = await dal.read(`end_of_day_html_${queryDateStr}`);
      if (cached.success && cached.data) {
        return new Response(cached.data, {
          headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=300', 'X-Cache': 'HIT', 'X-Request-ID': requestId }
        });
      }
    } catch (e) { /* continue */ }
  }

  logger.info('🏁 [END-OF-DAY] Starting end-of-day summary generation', { requestId, queryDate: queryDateStr, bypassCache });

  // Use getD1FallbackData which handles full fallback chain and returns createdAt
  const fallback = await getD1FallbackData(env, queryDateStr, 'end-of-day');
  const d1Result = fallback ? {
    data: fallback.data,
    createdAt: fallback.createdAt || fallback.data?._d1_created_at || fallback.data?.generated_at || new Date().toISOString()
  } : null;
  
  if (fallback) {
    logger.info('END-OF-DAY: Data retrieved', { source: fallback.source, sourceDate: fallback.sourceDate, isStale: fallback.isStale });
  }
  
  // Determine schedule status
  const isQueryingToday = queryDateStr === todayET;
  const { hour, minute } = getCurrentTimeET();
  const beforeScheduleET = hour < 16 || (hour === 16 && minute < 5); // Before 4:05 PM ET

  // Generate HTML based on D1 data availability
  const htmlContent = generateEndOfDayHTML(d1Result, queryDateStr, isQueryingToday, beforeScheduleET);

  // Cache HTML for fast subsequent loads
  try {
    const dal = createSimplifiedEnhancedDAL(env);
    await dal.write(`end_of_day_html_${queryDateStr}`, htmlContent, { expirationTtl: 300 });
  } catch (e) { /* ignore */ }

  logger.info('🎯 [END-OF-DAY] End-of-day summary completed', { requestId, duration: Date.now() - startTime, hasD1Data: !!d1Result });

  return new Response(htmlContent, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Request-ID': requestId }
  });
});

/**
 * Generate end-of-day HTML page
 * 
 * Status display logic (D1 is source of truth):
 * 1. If D1 has data → show "Generated {d1_created_at} ET"
 * 2. If no D1 data AND querying today AND before 4:05 PM ET → show "Scheduled"
 * 3. If no D1 data AND past scheduled time → show "No data available"
 */
function generateEndOfDayHTML(
  d1Result: { data: any; createdAt: string } | null,
  queryDateStr: string,
  isQueryingToday: boolean,
  beforeScheduleET: boolean
): string {
  const endOfDayData = d1Result?.data;
  const d1CreatedAt = d1Result?.createdAt;
  
  // D1 record exists = we have data (regardless of signal count)
  const hasD1Data = !!d1Result;
  
  // Determine display status - show both ET and local time
  let statusDisplay: string;
  if (hasD1Data && d1CreatedAt) {
    const ts = new Date(d1CreatedAt).getTime();
    statusDisplay = `Generated <span class="gen-time" data-ts="${ts}"></span>`;
  } else if (isQueryingToday && beforeScheduleET) {
    statusDisplay = `⏳ Scheduled: <span class="sched-time" data-utch="21" data-utcm="5"></span>`;
  } else {
    statusDisplay = `⚠️ No data available`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>End-of-Day Trading Summary - ${queryDateStr}</title>
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
            <div class="date-display">${new Date(queryDateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })} • ${statusDisplay}</div>
        </div>

        ${!hasD1Data ? `
        <div class="no-data">
            <h3>${isQueryingToday && beforeScheduleET ? '⏳ Report Not Yet Generated' : '⚠️ No End-of-Day Data Available'}</h3>
            <p>${isQueryingToday && beforeScheduleET ? `This report will be generated at <span class="sched-time" data-utch="21" data-utcm="5"></span>.` : 'There is no end-of-day data available for this date.'}</p>
            <button class="refresh-button" onclick="location.reload()">Refresh Page</button>
        </div>
        ` : `
        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Signals</h3>
                <div class="value">${endOfDayData?.totalSignals || endOfDayData?.finalSummary?.totalSignals || 0}</div>
                <div class="label">High-confidence predictions</div>
            </div>
            <div class="summary-card">
                <h3>Accuracy Rate</h3>
                <div class="value">${endOfDayData?.accuracyRate ? Math.round(endOfDayData.accuracyRate * 100) + '%' : 'N/A'}</div>
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

    ${hasD1Data ? `
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
        const et = d.toLocaleTimeString('en-US', {timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true});
        const local = d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
        el.textContent = et + ' ET (' + local + ' local)';
      });
    </script>
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
