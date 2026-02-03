/**
 * Weekly Review Handler
 * Analyzes high-confidence signal accuracy patterns and provides comprehensive weekly insights
 */

import { createLogger } from '../logging.js';
import { createHandler } from '../handler-factory.js';
import { generateWeeklyReviewAnalysis } from '../report/weekly-review-analysis.js';
import { AI_MODEL_DISPLAY } from '../config.js';
import { getWeeklyReviewData } from '../report-data-retrieval.js';
import { readD1ReportSnapshot } from '../d1-job-storage.js';
import { createSimplifiedEnhancedDAL } from '../simplified-enhanced-dal.js';
import { SHARED_NAV_CSS, getSharedNavHTML, getNavScripts } from '../../utils/html-templates.js';
import { generatePendingPageHTML } from './pending-page.js';
import type { CloudflareEnvironment } from '../../types';
import { getTodayInZone, getTimezoneFromDO, getWeekSunday } from './date-utils.js';

const logger = createLogger('weekly-review-handlers');

/**
 * Generate Weekly Review Page
 */
export const handleWeeklyReview = createHandler('weekly-review', async (request: Request, env: CloudflareEnvironment, ctx: any) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const url = new URL(request.url);
  const bypassCache = url.searchParams.get('bypass') === '1';
  const weekParam = url.searchParams.get('week');
  const runId = url.searchParams.get('run_id');

  // Determine which week to show (uses timezone from ?tz > DO setting > ET)
  const weekSunday = await getWeekSunday(weekParam, url, env.CACHE_DO as any);
  const weekStr = weekSunday.toISOString().split('T')[0];
  const cacheKey = `weekly_html_${weekStr}`;

  // Fast path: check DO cache first (unless bypass)
  if (!bypassCache) {
    try {
      const dal = createSimplifiedEnhancedDAL(env);
      const cached = await dal.read(cacheKey);
      if (cached.success && cached.data) {
        return new Response(cached.data, {
          headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=600', 'X-Cache': 'HIT', 'X-Request-ID': requestId }
        });
      }
    } catch (e) { /* continue */ }
  }

  logger.info('📈 [WEEKLY-REVIEW] Starting weekly review generation', {
    requestId,
    week: weekStr,
    bypassCache
  });

  logger.debug('📊 [WEEKLY-REVIEW] Retrieving weekly review data', {
    requestId,
    week: weekStr
  });

  let weeklyData: any = null;
  let dataSource: 'd1_cron' | 'd1_fallback' | 'live' = 'live';

  try {
    // First, try to read the cron job's WeeklyReviewAnalysis from D1 (scheduled_job_results)
    // This is the primary source - written by scheduler.ts with full analysis
    const d1Snapshot = await readD1ReportSnapshot(env, weekStr, 'weekly');

    if (d1Snapshot?.data) {
      // Check if this is a WeeklyReviewAnalysis from the cron (has weeklyOverview, patternAnalysis)
      if (d1Snapshot.data.weeklyOverview && d1Snapshot.data.patternAnalysis) {
        logger.info('✅ [WEEKLY-REVIEW] Using cron analysis from D1', {
          requestId,
          week: weekStr,
          generatedAt: d1Snapshot.data.generated_at || d1Snapshot.createdAt,
          generationStatus: d1Snapshot.data._generation?.status
        });
        weeklyData = d1Snapshot.data;
        dataSource = 'd1_cron';
      }
    }

    // If no cron data, fall back to getWeeklyReviewData (live generation)
    if (!weeklyData) {
      logger.info('📊 [WEEKLY-REVIEW] No cron data, falling back to live generation', {
        requestId,
        week: weekStr
      });
      weeklyData = await getWeeklyReviewData(env, weekSunday);
      dataSource = weeklyData?._generation ? 'd1_fallback' : 'live';
    }

    if (weeklyData) {
      logger.info('✅ [WEEKLY-REVIEW] Weekly data retrieved successfully', {
        requestId,
        week: weekStr,
        dataSource,
        totalSignals: weeklyData.weeklyOverview?.totalSignals || weeklyData.totalSignals || 0,
        tradingDays: weeklyData.weeklyOverview?.totalTradingDays || weeklyData.tradingDays || 0,
        hasData: true
      });
    } else {
      logger.warn('⚠️ [WEEKLY-REVIEW] No weekly data found for week', {
        requestId,
        week: weekStr
      });
    }

  } catch (error: any) {
    logger.error('❌ [WEEKLY-REVIEW] Failed to retrieve weekly data', {
      requestId,
      week: weekStr,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });
  }

  // If no data, show pending page or no data page
  if (!weeklyData) {
    const isPastWeek = weekSunday < new Date(new Date().setDate(new Date().getDate() - new Date().getDay()));
    const pendingPage = generatePendingPageHTML({
      title: 'Weekly Review',
      reportType: 'weekly',
      dateStr: weekStr,
      scheduledHourUTC: 14, // 14:00 UTC = 9:00 AM ET (matches cron schedule in scheduler.ts)
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

  // Generate HTML with week label
  const thisSunday = await getWeekSunday(null, url, env.CACHE_DO as any);
  const isThisWeek = weekSunday.toDateString() === thisSunday.toDateString();
  const weekLabel = isThisWeek ? 'This Week' : 'Week of ' + weekSunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const htmlContent = generateWeeklyReviewHTML(weeklyData, requestId, weekSunday, weekLabel, runId || undefined);

  // Cache HTML in DO (don't write to D1 - cron job is the source of truth for scheduled_job_results)
  const dal = createSimplifiedEnhancedDAL(env);
  if (weeklyData) {
    await dal.write(`weekly_${weekStr}`, weeklyData, { expirationTtl: 86400 });
  }
  await dal.write(cacheKey, htmlContent, { expirationTtl: 600 });

  logger.info('🎯 [WEEKLY-REVIEW] Weekly review completed', {
    requestId,
    week: weekStr,
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
  weekSunday: Date,
  weekLabel: string,
  runId?: string
): string {
  const weekEnd = new Date(weekSunday);
  weekEnd.setDate(weekSunday.getDate() + 6);

  const weekRange = `${weekSunday.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;

  // Normalize data: WeeklyReviewAnalysis (cron) uses weeklyOverview, WeeklyReviewData uses flat fields
  // This ensures the renderer works with both formats
  const isCronFormat = weeklyData?.weeklyOverview && weeklyData?.patternAnalysis;
  const normalizedData = isCronFormat ? {
    // avgConfidence should be a 0..1 fraction (UI multiplies by 100). Prefer modelStats if present.
    avgConfidence: (() => {
      const confidences = [
        weeklyData.modelStats?.primary?.avgConfidence,
        weeklyData.modelStats?.mate?.avgConfidence,
      ].filter((v: any) => typeof v === 'number' && Number.isFinite(v));
      if (confidences.length === 0) return null;
      return confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length;
    })(),
    totalSignals: weeklyData.weeklyOverview?.totalSignals || 0,
    tradingDays: weeklyData.weeklyOverview?.totalTradingDays || 0,
    accuracyRate: (weeklyData.accuracyMetrics?.weeklyAverage || 0) / 100, // Convert percentage to decimal
    modelStats: weeklyData.modelStats,
    generatedAt: weeklyData._generation?.generatedAt || weeklyData.generated_at,
    _generation: weeklyData._generation,
    // Extended cron data
    insights: weeklyData.insights,
    topPerformers: weeklyData.topPerformers,
    underperformers: weeklyData.underperformers,
    nextWeekOutlook: weeklyData.nextWeekOutlook,
    patternAnalysis: weeklyData.patternAnalysis,
    trends: weeklyData.trends
  } : weeklyData;

  // Check for actual data
  const hasRealData = normalizedData && (normalizedData.totalSignals > 0 || normalizedData.tradingDays > 0);

  // Check generation status for failure visibility
  const genMeta = normalizedData?._generation;
  const genStatus = genMeta?.status || (hasRealData ? 'success' : 'unknown');
  const genErrors = genMeta?.errors || [];
  const genWarnings = genMeta?.warnings || [];
  const isPartialOrFailed = genStatus === 'partial' || genStatus === 'failed' || genStatus === 'default';

  // Scheduled time: Sunday 14:00 UTC (≈ 9:00 AM ET / 10:00 AM EDT depending on DST)
  const scheduledUtc = Date.UTC(weekSunday.getUTCFullYear(), weekSunday.getUTCMonth(), weekSunday.getUTCDate(), 14, 0);

  // Determine display status - show both ET and local time
  let statusDisplay: string;
  if (hasRealData && normalizedData.generatedAt) {
    const ts = new Date(normalizedData.generatedAt).getTime();
    statusDisplay = `Generated <span class="gen-time" data-ts="${ts}"></span>`;
  } else if (hasRealData) {
    statusDisplay = `Data available`;
  } else {
    statusDisplay = `⚠️ No data available`;
  }

  // Build status banner for partial/failed generation
  let statusBanner = '';
  if (isPartialOrFailed) {
    const bannerClass = genStatus === 'failed' ? 'error-banner' : 'warning-banner';
    const icon = genStatus === 'failed' ? '❌' : '⚠️';
    const title = genStatus === 'failed' ? 'Generation Failed' : genStatus === 'partial' ? 'Partial Data' : 'Default Data';
    const messages = [...genErrors, ...genWarnings];
    statusBanner = `
        <div class="${bannerClass}" style="background: ${genStatus === 'failed' ? '#dc262620' : '#f59e0b20'}; border: 1px solid ${genStatus === 'failed' ? '#dc2626' : '#f59e0b'}; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 8px 0; color: ${genStatus === 'failed' ? '#dc2626' : '#f59e0b'};">${icon} ${title}</h4>
            <p style="margin: 0; font-size: 0.9rem; opacity: 0.9;">
              ${messages.length > 0 ? messages.join('<br>') : 'Check job execution logs for details.'}
            </p>
            <p style="margin: 8px 0 0 0; font-size: 0.8rem; opacity: 0.7;">
              Data source: ${genMeta?.dataSource || 'unknown'} | Trading days found: ${genMeta?.tradingDaysFound || 0}
            </p>
        </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Trading Review - ${weekLabel}</title>
    <link rel="stylesheet" href="/css/reports.css">
    ${getNavScripts()}
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
    <script src="js/cct-api.js"></script>
</head>
<body>
    ${getSharedNavHTML('weekly')}
    <div class="container">
        <div class="header">
            <h1>📊 Weekly Trading Review</h1>
            <p>Comprehensive analysis of your trading performance and signal accuracy</p>
            <div class="date-display">
              <div class="target-date">
                <span class="date-label">Week:</span>
                <span class="date-value">${weekRange}</span>
              </div>
              <div class="generated-date">
                <span class="date-label">${hasRealData ? 'Generated:' : 'Scheduled:'}</span>
                <span class="date-value">${statusDisplay}</span>
              </div>
              ${runId ? `<div class="run-id-display">
                <span class="date-label">Run ID:</span>
                <span class="date-value" style="font-family: monospace; font-size: 0.85em;">${runId.slice(-12)}</span>
              </div>` : ''}
            </div>
        </div>

        ${statusBanner}

        ${!hasRealData ? `
        <div class="no-data">
            <h3>⚠️ No Weekly Data Available</h3>
            <p>There is no trading data available for this week.</p>
            <button class="refresh-button" onclick="location.reload()">Refresh Page</button>
        </div>
        ` : `
        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Signals</h3>
                <div class="value">${normalizedData.totalSignals || 0}</div>
                <div class="label">High-confidence predictions</div>
            </div>
            <div class="summary-card">
                <h3>Accuracy Rate</h3>
                <div class="value">${normalizedData.accuracyRate ? Math.round(normalizedData.accuracyRate * 100) + '%' : 'N/A'}</div>
                <div class="label">Overall success rate</div>
            </div>
            <div class="summary-card">
                <h3>Trading Days</h3>
                <div class="value">${normalizedData.tradingDays || 0}</div>
                <div class="label">Days analyzed</div>
            </div>
            <div class="summary-card">
                <h3>Avg Confidence</h3>
                <div class="value">${normalizedData.avgConfidence ? Math.round(normalizedData.avgConfidence * 100) + '%' : 'N/A'}</div>
                <div class="label">Prediction confidence</div>
            </div>
        </div>

        <!-- Dual Model Performance -->
        <div class="dual-model-section" style="margin-bottom: 40px;">
            <h2 style="text-align: center; margin-bottom: 20px;">🤖 AI Model Performance</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 800px; margin: 0 auto;">
                <div class="summary-card">
                    <h3>${AI_MODEL_DISPLAY.primary.name}</h3>
                    <div class="value">${normalizedData.modelStats?.primary?.accuracy ? Math.round(normalizedData.modelStats.primary.accuracy * 100) + '%' : 'N/A'}</div>
                    <div class="label">${normalizedData.modelStats?.primary?.total || 0} predictions</div>
                    <div style="font-size: 0.8rem; margin-top: 8px; opacity: 0.7;">
                        ✓ ${normalizedData.modelStats?.primary?.success || 0} success |
                        ✗ ${normalizedData.modelStats?.primary?.failed || 0} failed
                    </div>
                </div>
                <div class="summary-card">
                    <h3>${AI_MODEL_DISPLAY.secondary.name}</h3>
                    <div class="value">${normalizedData.modelStats?.mate?.accuracy ? Math.round(normalizedData.modelStats.mate.accuracy * 100) + '%' : 'N/A'}</div>
                    <div class="label">${normalizedData.modelStats?.mate?.total || 0} predictions</div>
                    <div style="font-size: 0.8rem; margin-top: 8px; opacity: 0.7;">
                        ✓ ${normalizedData.modelStats?.mate?.success || 0} success |
                        ✗ ${normalizedData.modelStats?.mate?.failed || 0} failed
                    </div>
                </div>
            </div>
            <div style="text-align: center; margin-top: 15px; font-size: 0.9rem; opacity: 0.8;">
                Agreement Rate: ${normalizedData.modelStats?.agreementRate ? Math.round(normalizedData.modelStats.agreementRate * 100) + '%' : 'N/A'}
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
                    ${generatePerformanceTableRows(normalizedData)}
                </tbody>
            </table>
        </div>

        <!-- Insights Section -->
        <div class="insights-section">
            <h2>🔍 Weekly Insights</h2>
            ${generateInsightsHTML(normalizedData)}
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
                    labels: ${JSON.stringify(normalizedData.dailyData?.map((d: any) => d.date) || normalizedData.patternAnalysis?.dailyVariations?.map((d: any) => d.day) || [])},
                    datasets: [{
                        label: 'Daily Accuracy (%)',
                        data: ${JSON.stringify(normalizedData.dailyData?.map((d: any) => (d.accuracy || 0) * 100) || normalizedData.patternAnalysis?.dailyVariations?.map((d: any) => d.accuracy || 0) || [])},
                        borderColor: '#f0b90b',
                        backgroundColor: 'rgba(240, 185, 11, 0.1)',
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
    normalizedData.signalDistribution?.bullish || 0,
    normalizedData.signalDistribution?.bearish || 0,
    normalizedData.signalDistribution?.neutral || 0
  ])},
                        backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
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
                    labels: ${JSON.stringify(normalizedData.symbolPerformance?.map((s: any) => s.symbol) || normalizedData.topPerformers?.map((p: any) => p.symbol) || [])},
                    datasets: [{
                        label: 'Accuracy (%)',
                        data: ${JSON.stringify(normalizedData.symbolPerformance?.map((s: any) => (s.accuracy || 0) * 100) || normalizedData.topPerformers?.map((p: any) => (p.accuracy || p.avgReturn || 0) * 100) || [])},
                        backgroundColor: 'rgba(240, 185, 11, 0.8)',
                        borderColor: '#f0b90b',
                        borderWidth: 1
                    }]
                },
                options: chartOptions
            });
        }
    </script>
    ` : ''}
    <script>
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
 * Generate performance table rows HTML
 */
function generatePerformanceTableRows(weeklyData: any): string {
  // Support both formats: dailyData (legacy) or patternAnalysis.dailyVariations (cron)
  const dailyData = weeklyData.dailyData || weeklyData.patternAnalysis?.dailyVariations;

  if (!dailyData || dailyData.length === 0) {
    return '<tr><td colspan="6" style="text-align: center; padding: 20px;">No daily performance data available</td></tr>';
  }

  return dailyData.map((day: any) => {
    // Handle both formats: accuracy as percentage (cron) or decimal (legacy)
    const rawAccuracy = day.accuracy || 0;
    const accuracy = rawAccuracy > 1 ? Math.round(rawAccuracy) : Math.round(rawAccuracy * 100);
    const confidence = day.avgConfidence ? Math.round(day.avgConfidence * 100) : 0;
    const accuracyClass = accuracy >= 70 ? 'accuracy-high' : accuracy >= 50 ? 'accuracy-medium' : 'accuracy-low';

    return `
      <tr>
        <td>${day.date || day.day || 'N/A'}</td>
        <td>${day.totalSignals || day.signals || 0}</td>
        <td>${day.correctSignals || Math.round((day.signals || 0) * (rawAccuracy > 1 ? rawAccuracy / 100 : rawAccuracy)) || 0}</td>
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
  // Use current Sunday as anchor - analysis functions look back to find Mon-Fri
  // This aligns with scheduler.ts and getWeekSunday() in date-utils.ts
  const weekSunday = new Date();
  const weeklyData = analysisResult || await generateWeeklyReviewAnalysis(env as any, weekSunday);

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

  // Use pre-generated insights from cron if available
  if (weeklyData.insights?.length > 0) {
    weeklyData.insights.forEach((insight: any) => {
      insights.push({
        title: insight.title || insight.type || '📊 Insight',
        content: insight.content || insight.description || insight.message || JSON.stringify(insight)
      });
    });
  } else {
    // Generate insights from normalized data
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
  }

  // Add next week outlook if available from cron
  if (weeklyData.nextWeekOutlook) {
    insights.push({
      title: '🔮 Next Week Outlook',
      content: weeklyData.nextWeekOutlook.summary || weeklyData.nextWeekOutlook.description || 'See detailed outlook below.'
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
