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
import { generatePendingPageHTML } from './pending-page.js';

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

    // Check if we need to redirect to last market day
    // If resolved date is a weekend, redirect to last market day
    const dateParam = url.searchParams.get('date');
    const resolvedDate = new Date(queryDateStr + 'T00:00:00Z');
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
        logger.info('END-OF-DAY: Redirect to last market day', {
            from: queryDateStr,
            to: lastMarketDay,
            reason: 'weekend'
        });
        return Response.redirect(redirectUrl.toString(), 302);
    }

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
    // Fix: use >= comparison for pending logic (handles users ahead of ET)
    const queryDate = new Date(queryDateStr + 'T00:00:00Z');
    const todayETDate = new Date(todayET + 'T00:00:00Z');
    const isQueryingTodayOrFuture = queryDate >= todayETDate;
    const isQueryingToday = queryDateStr === todayET;
    const { hour, minute } = getCurrentTimeET();
    const beforeScheduleET = hour < 16 || (hour === 16 && minute < 5); // Before 4:05 PM ET
    const sourceDate = fallback?.sourceDate || queryDateStr;
    // isStale: data is old/not on time (from D1)
    const isStale = fallback?.isStale || false;
    // dataDateDiffers: data is from a different day than requested
    const dataDateDiffers = fallback && sourceDate !== queryDateStr;
    // isPending: querying today/future with no exact match data, and before schedule
    // Show pending even if stale fallback data exists - don't show yesterday's data as "today"
    const isPending = (!d1Result || isStale || dataDateDiffers) && isQueryingTodayOrFuture && beforeScheduleET;

    // Generate HTML based on D1 data availability
    const htmlContent = generateEndOfDayHTML(d1Result, queryDateStr, isQueryingToday, beforeScheduleET, isPending, sourceDate, dataDateDiffers);

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
    d1Result: { data: any; createdAt: string; isStale?: boolean } | null,
    queryDateStr: string,
    isQueryingToday: boolean,
    beforeScheduleET: boolean,
    isPending: boolean,
    sourceDate: string,
    dataDateDiffers: boolean
): string {
    const endOfDayData = d1Result?.data;
    const d1CreatedAt = d1Result?.createdAt;
    const isStale = d1Result?.isStale || false;

    // D1 record exists = we have data (regardless of signal count)
    const hasD1Data = !!d1Result;

    // Display date: always show the REQUESTED date as "Target Day"
    // sourceDate is used only for warnings when data differs
    const displayDate = queryDateStr;

    // Show warning when data is from a different day than requested
    const dataDateWarning = dataDateDiffers ? `
        <div class="stale-warning">
            ⚠️ <strong>Data Mismatch:</strong> Showing data from <strong>${new Date(sourceDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>; you requested <strong>${new Date(queryDateStr + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>.
            ${isQueryingToday ? `Today's report is scheduled for <span class="sched-time" data-utch="21" data-utcm="5"></span>.` : ''}
            <button class="refresh-button" style="margin-left: 15px; padding: 6px 12px; font-size: 0.85rem;" onclick="location.reload()">Refresh</button>
        </div>
        ` : '';

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

    // Branch: pending (not yet executed) vs normal
    if (isPending) {
        // Report hasn't run yet for today
        return generatePendingPageHTML({
            title: 'End-of-Day Summary',
            reportType: 'end-of-day',
            dateStr: queryDateStr,
            scheduledHourUTC: 21,
            scheduledMinuteUTC: 5
        });
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>End-of-Day Trading Summary - ${displayDate}</title>
    ${getNavScripts()}
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
    <script src="js/cct-api.js"></script>
    <style>
        /* Core styles handled by reports.css */

        /* End-of-Day Specific Components */
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
    </style>
</head>
</head>
<body>
    ${getSharedNavHTML('end-of-day')}
    <div class="container">
        <div class="header">
            <h1>🏁 End-of-Day Trading Summary</h1>
            <p>Comprehensive analysis of trading performance and market close</p>
            <div class="date-display">
              <div class="target-date">
                <span class="date-label">Target Day:</span>
                <span class="date-value">${new Date(displayDate + 'T12:00:00Z').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })}</span>
              </div>
              <div class="generated-date">
                <span class="date-label">${hasD1Data ? 'Generated:' : 'Scheduled:'}</span>
                <span class="date-value">${statusDisplay}</span>
              </div>
            </div>
            ${dataDateWarning}
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
 * Generate signal cards HTML with dual model display
 */
function generateSignalCards(signals: any[]): string {
    if (!signals || signals.length === 0) {
        return '<p style="text-align: center; opacity: 0.7; grid-column: 1 / -1; padding: 40px;">No signal data available for today.</p>';
    }

    return signals.map(signal => {
        const accuracyClass = signal.status === 'correct' ? 'accuracy-correct' :
            signal.status === 'incorrect' ? 'accuracy-incorrect' : 'accuracy-pending';
        
        const confidence = Math.round((signal.confidence || 0) * 100);

        // Extract dual model data
        const gemma = signal.dual_model?.gemma || signal.models?.gpt || {};
        const distilbert = signal.dual_model?.distilbert || signal.models?.distilbert || {};
        const agreement = signal.agreement?.status || signal.dual_model?.agreement || 
          (gemma.direction && distilbert.direction && gemma.direction === distilbert.direction ? 'AGREE' : 
           gemma.direction && distilbert.direction ? 'DISAGREE' : 'PARTIAL');
        
        const hasDualModel = gemma.status || distilbert.status || gemma.direction || distilbert.direction;
        
        // Agreement badge
        const agreementBadge = hasDualModel ? `
          <div class="agreement-badge ${agreement.toLowerCase()}">
            ${agreement === 'AGREE' ? '✓ MODELS AGREE' : agreement === 'DISAGREE' ? '✗ MODELS DISAGREE' : '◐ PARTIAL AGREEMENT'}
          </div>
        ` : '';
        
        // Dual model cards
        const dualModelCards = hasDualModel ? `
          <div class="dual-model-grid">
            <div class="model-card ${gemma.status === 'failed' || gemma.error ? 'failed' : ''}">
              <div class="model-name">Gemma Sea Lion</div>
              <div class="model-status">${gemma.status === 'failed' || gemma.error ? '✗ ' + (gemma.error || 'FAILED') : gemma.direction ? '✓ SUCCESS' : '—'}</div>
              <div class="model-result">${gemma.direction?.toUpperCase() || 'N/A'} ${gemma.confidence ? Math.round(gemma.confidence * 100) + '%' : ''}</div>
            </div>
            <div class="model-card ${distilbert.status === 'failed' || distilbert.error ? 'failed' : ''}">
              <div class="model-name">DistilBERT</div>
              <div class="model-status">${distilbert.status === 'failed' || distilbert.error ? '✗ ' + (distilbert.error || 'FAILED') : distilbert.direction ? '✓ SUCCESS' : '—'}</div>
              <div class="model-result">${distilbert.direction?.toUpperCase() || 'N/A'} ${distilbert.confidence ? Math.round(distilbert.confidence * 100) + '%' : ''}</div>
            </div>
          </div>
        ` : '';

        return `
      <div class="signal-card">
        <h4>${signal.symbol} ${getDirectionEmoji(signal.direction)}</h4>
        <div class="signal-detail">
          <span class="label">Direction:</span>
          <span class="value">${signal.direction?.toUpperCase() || 'N/A'}</span>
        </div>
        <div class="signal-detail">
          <span class="label">Confidence:</span>
          <span class="value">${confidence}%</span>
        </div>
        <div class="signal-detail">
          <span class="label">Status:</span>
          <span class="value">
            <span class="accuracy-badge ${accuracyClass}">
              ${signal.status?.toUpperCase() || 'PENDING'}
            </span>
          </span>
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
