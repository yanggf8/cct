/**
 * Pre-Market Briefing Handler
 * Comprehensive battle plan for the sentiment analysis day
 * 
 * Data flow (D1 is source of truth with fallback):
 * 1. Read from D1 for queryDate
 * 2. If no D1 data, try fallback chain (latest D1 snapshot, predictions)
 * 3. If data exists → show it with created_at timestamp
 * 4. If no data AND querying today-or-future AND before that date's 8:30 AM ET → show "Scheduled"
 * 5. If no data AND past scheduled time → show "No data available"
 */

import { createLogger } from '../logging.js';
import { createHandler } from '../handler-factory.js';
import { getD1FallbackData } from '../d1-job-storage.js';
import { validateRequest, validateEnvironment } from '../validation.js';
import { SHARED_NAV_CSS, getSharedNavHTML, getNavScripts } from '../../utils/html-templates.js';
import type { CloudflareEnvironment } from '../../types';
import { createSimplifiedEnhancedDAL } from '../simplified-enhanced-dal.js';
import { getTodayInZone, resolveQueryDate, getCurrentTimeET } from './date-utils.js';

const logger = createLogger('briefing-handlers');

/**
 * Generate Pre-Market Briefing Page
 */
export const handlePreMarketBriefing = createHandler('pre-market-briefing', async (request: Request, env: CloudflareEnvironment, ctx: any) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const url = new URL(request.url);
  const bypassCache = url.searchParams.get('bypass') === '1';
  
  // Resolve query date: ?date > ?tz > DO setting > ET default
  const queryDateStr = await resolveQueryDate(url, env.CACHE_DO as any);
  const todayET = getTodayInZone('America/New_York');

  logger.info('🚀 [PRE-MARKET] Starting pre-market briefing generation', { requestId, queryDate: queryDateStr, bypassCache });

  validateRequest(request);
  validateEnvironment(env);

  const dal = createSimplifiedEnhancedDAL(env);

  // Fast path: check DO HTML cache first (unless bypass)
  if (!bypassCache) {
    try {
      const cached = await dal.read(`premarket_html_${queryDateStr}`);
      if (cached.success && cached.data) {
        return new Response(cached.data, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Cache': 'HIT', 'X-Request-ID': requestId }
        });
      }
    } catch (e) { /* continue */ }
  }

  // Use getD1FallbackData which handles full fallback chain and returns createdAt
  const fallback = await getD1FallbackData(env, queryDateStr, 'pre-market');
  const d1Result = fallback ? {
    data: fallback.data,
    createdAt: fallback.createdAt || fallback.data?._d1_created_at || fallback.data?.generated_at || new Date().toISOString(),
    isStale: fallback.isStale || false,
    sourceDate: fallback.sourceDate || queryDateStr
  } : null;
  
  if (fallback) {
    logger.info('PRE-MARKET: Data retrieved', { source: fallback.source, sourceDate: fallback.sourceDate, isStale: fallback.isStale });
  }
  
  // Determine schedule status
  // queryDateStr is user's "today" (may be ahead of ET)
  // Show "Scheduled" if: querying today-or-future AND before that date's schedule time in ET
  const { hour, minute } = getCurrentTimeET();
  const queryDate = new Date(queryDateStr + 'T00:00:00Z');
  const todayETDate = new Date(todayET + 'T00:00:00Z');
  const isQueryingFuture = queryDate > todayETDate;
  const isQueryingToday = queryDateStr === todayET;
  const beforeScheduleET = hour < 8 || (hour === 8 && minute < 30); // Before 8:30 AM ET
  
  // Show scheduled if: querying future date OR (querying ET's today AND before schedule)
  const showScheduled = isQueryingFuture || (isQueryingToday && beforeScheduleET);

  // Generate HTML based on D1 data availability
  const htmlContent = generatePreMarketHTML(d1Result, queryDateStr, showScheduled, isQueryingFuture, isQueryingToday);

  // Cache HTML for fast subsequent loads
  try {
    await dal.write(`premarket_html_${queryDateStr}`, htmlContent, { expirationTtl: 300 });
  } catch (e) { /* ignore */ }

  logger.info('🎯 [PRE-MARKET] Pre-market briefing completed', { requestId, duration: Date.now() - startTime, hasD1Data: !!d1Result });

  return new Response(htmlContent, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Request-ID': requestId }
  });
});

/**
 * Generate pre-market HTML page
 *
 * Status display logic (D1 is source of truth):
 * 1. If D1 has data → show "Generated {d1_created_at} ET"
 * 2. If data is stale (from different date) → show stale warning
 * 3. If no D1 data AND querying today AND before 8:30 AM ET → show "Scheduled"
 * 4. If no D1 data AND past scheduled time → show "No data available"
 */
function generatePreMarketHTML(
  d1Result: { data: any; createdAt: string; isStale?: boolean; sourceDate?: string } | null,
  queryDateStr: string,
  showScheduled: boolean,
  isQueryingFuture: boolean,
  isQueryingToday: boolean
): string {
  const briefingData = d1Result?.data;
  const d1CreatedAt = d1Result?.createdAt;
  const isStale = d1Result?.isStale || false;
  const sourceDate = d1Result?.sourceDate || queryDateStr;

  // D1 record exists = we have data (regardless of signal count)
  const hasD1Data = !!d1Result;

  // Extract signals for display
  let signals: any[] = [];
  if (briefingData) {
    signals = briefingData.signals || [];
    if (signals.length === 0 && briefingData.trading_signals) {
      signals = Object.values(briefingData.trading_signals).map((s: any) => ({
        symbol: s.symbol,
        direction: s.sentiment_layers?.[0]?.sentiment || 'neutral',
        confidence: s.sentiment_layers?.[0]?.confidence || 0,
        reasoning: s.sentiment_layers?.[0]?.reasoning || ''
      }));
    }
  }
  const totalSignals = signals.length;
  const highConfidenceSignals = signals.filter((s: any) => (s.confidence || 0) >= 0.6).length;

  // Format source date for display
  const sourceDateFormatted = new Date(sourceDate + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  // Format query date for display
  const queryDateFormatted = new Date(queryDateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  // Context-aware text: "today's" vs "this date's" / "{date}'s"
  const sessionContext = isQueryingToday ? "today's" : `${queryDateFormatted}'s`;
  const sessionContextCapitalized = isQueryingToday ? "Today's" : `${queryDateFormatted}'s`;

  // Determine display status - D1 is source of truth
  // Show both ET and local time for generated reports
  let statusDisplay: string;
  if (hasD1Data && d1CreatedAt) {
    const ts = new Date(d1CreatedAt).getTime();
    if (isStale) {
      statusDisplay = `⚠️ Showing data from ${sourceDateFormatted} (${sessionContext} report not yet available)`;
    } else {
      statusDisplay = `Generated <span class="gen-time" data-ts="${ts}"></span>`;
    }
  } else if (showScheduled) {
    statusDisplay = `⏳ Scheduled: <span class="sched-time" data-utch="13" data-utcm="30"></span>`;
  } else {
    statusDisplay = `⚠️ No data available`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pre-Market Briefing - ${queryDateStr}</title>
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

        .stale-warning {
            background: rgba(255, 193, 7, 0.2);
            border: 1px solid rgba(255, 193, 7, 0.5);
            color: #ffc107;
            padding: 8px 16px;
            border-radius: 8px;
            margin: 10px 0;
            font-size: 0.9rem;
        }

        .partial-warning {
            background: rgba(23, 162, 184, 0.2);
            border: 1px solid rgba(23, 162, 184, 0.5);
            color: #17a2b8;
            padding: 8px 16px;
            border-radius: 8px;
            margin: 10px 0;
            font-size: 0.9rem;
        }

        .market-status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: rgba(79, 172, 254, 0.1);
            border: 1px solid rgba(79, 172, 254, 0.3);
            border-radius: 20px;
            font-size: 0.9rem;
            color: #4facfe;
            margin-top: 15px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #4facfe;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
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

        .confidence-bar {
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            margin: 8px 0;
            overflow: hidden;
        }

        .confidence-fill {
            height: 100%;
            background: linear-gradient(90deg, #ff6b6b 0%, #feca57 50%, #48dbfb 100%);
            border-radius: 3px;
            transition: width 0.3s ease;
        }

        .market-overview {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            margin-bottom: 40px;
        }

        .market-overview h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
            text-align: center;
            color: #4facfe;
        }

        .market-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }

        .market-item {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            padding: 15px;
            text-align: center;
        }

        .market-item .label {
            font-size: 0.9rem;
            opacity: 0.7;
            margin-bottom: 5px;
        }

        .market-item .value {
            font-size: 1.3rem;
            font-weight: bold;
            color: #00f2fe;
        }

        .action-items {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .action-items h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
            text-align: center;
            color: #4facfe;
        }

        .action-list {
            list-style: none;
        }

        .action-item {
            margin-bottom: 15px;
            padding: 15px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            border-left: 4px solid #4facfe;
        }

        .action-item h4 {
            color: #00f2fe;
            margin-bottom: 8px;
        }

        .action-item p {
            color: rgba(255, 255, 255, 0.9);
            font-size: 0.95rem;
        }

        @media (max-width: 768px) {
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
    ${getSharedNavHTML('pre-market')}
    <div class="container">
        <div class="header">
            <h1>🚀 Pre-Market Briefing</h1>
            <p>Comprehensive trading battle plan for ${sessionContext} market session</p>
            <div class="date-display">${new Date(queryDateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })} • ${statusDisplay}</div>
            <div class="market-status">
                <span class="status-dot"></span>
                <span>Pre-Market Active</span>
            </div>
        </div>

        ${isStale && hasD1Data ? `
        <div class="stale-warning">
            ⚠️ <strong>Stale Data:</strong> ${sessionContextCapitalized} pre-market report has not been generated yet.
            Showing data from <strong>${sourceDateFormatted}</strong>.
            ${isQueryingToday ? `The report is scheduled for <span class="sched-time" data-utch="13" data-utcm="30"></span>.` : ''}
            <button class="refresh-button" style="margin-left: 15px; padding: 6px 12px; font-size: 0.85rem;" onclick="location.reload()">Refresh</button>
        </div>
        ` : ''}

        ${!hasD1Data ? `
        <div class="no-data">
            <h3>${showScheduled ? '⏳ Report Not Yet Generated' : '⚠️ No Pre-Market Data Available'}</h3>
            <p>${showScheduled
              ? (isQueryingFuture
                ? 'This report is scheduled for the selected date. It will appear after generation at <span class="sched-time" data-utch="13" data-utcm="30"></span> on that day.'
                : 'This report will be generated at <span class="sched-time" data-utch="13" data-utcm="30"></span>.')
              : 'There is no pre-market data available for this date.'}</p>
            <p>Pre-market data is typically available 30-60 minutes before market open. Please check back closer to market opening.</p>
            <button class="refresh-button" onclick="location.reload()">Refresh Page</button>
        </div>
        ` : `
        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card">
                <h3>High Confidence</h3>
                <div class="value">${highConfidenceSignals}/${totalSignals}</div>
                <div class="label">Signals ≥60% confidence</div>
            </div>
            <div class="summary-card">
                <h3>Total Signals</h3>
                <div class="value">${totalSignals}</div>
                <div class="label">Analyzed symbols</div>
            </div>
            <div class="summary-card">
                <h3>Market Sentiment</h3>
                <div class="value">${briefingData?.market_sentiment?.overall_sentiment || 'NEUTRAL'}</div>
                <div class="label">Overall market mood</div>
            </div>
        </div>

        <!-- Signals Section -->
        <div class="signals-section">
            <h2>🎯 All Signals</h2>
            <div class="signal-grid">
                ${generateSignalCards(signals)}
            </div>
        </div>

        <!-- Action Items -->
        <div class="action-items">
            <h2>⚡ Today's Action Items</h2>
            <ul class="action-list">
                ${generateActionItems(briefingData?.actionItems || briefingData?.action_items || [])}
            </ul>
        </div>
        `}
    </div>

    ${hasD1Data ? `
    <script>
        // Initialize interactive elements
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Pre-Market Briefing loaded successfully');

            // Auto-refresh every 5 minutes during pre-market
            setInterval(() => {
                if (new Date().getHours() < 9 || new Date().getHours() >= 16) {
                    location.reload();
                }
            }, 300000);
        });
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
 * Generate error HTML
 */
function generateErrorHTML(error: any, requestId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pre-Market Briefing Error</title>
    ${getNavScripts()}
    <style>
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
        .error-content {
            text-align: center;
            max-width: 600px;
            padding: 40px;
            background: rgba(255, 107, 107, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 107, 107, 0.3);
        }
        .error-content h2 {
            color: #ff6b6b;
            margin-bottom: 20px;
            font-size: 1.5rem;
        }
        .error-content p {
            margin-bottom: 30px;
            opacity: 0.9;
        }
        .error-details {
            background: rgba(0, 0, 0, 0.2);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-family: monospace;
            font-size: 0.9rem;
            text-align: left;
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
    </style>
</head>
<body>
    ${getSharedNavHTML('pre-market')}
    <div class="error-content">
        <h2>❌ Pre-Market Briefing Error</h2>
        <p>Sorry, we encountered an error while generating the pre-market briefing.</p>
        <div class="error-details">
            Error ID: ${requestId}<br>
            Message: ${error.message}<br>
            Time: ${new Date().toISOString()}
        </div>
        <button class="refresh-button" onclick="location.reload()">Try Again</button>
    </div>
</body>
</html>`;
}

/**
 * Generate market overview HTML
 */
function generateMarketOverview(marketData: any): string {
  if (!marketData) {
    return '<div style="text-align: center; opacity: 0.7;">Market data not available yet</div>';
  }

  const items = [
    { label: 'S&P 500', value: marketData.spx || 'Loading...' },
    { label: 'NASDAQ', value: marketData.nasdaq || 'Loading...' },
    { label: 'DOW', value: marketData.dow || 'Loading...' },
    { label: 'VIX', value: marketData.vix || 'Loading...' }
  ];

  return items.map(item => `
    <div class="market-item">
      <div class="label">${item.label}</div>
      <div class="value">${item.value}</div>
    </div>
  `).join('');
}

/**
 * Generate signal cards HTML
 */
function generateSignalCards(signals: any[]): string {
  if (!signals || signals.length === 0) {
    return '<div style="text-align: center; opacity: 0.7;">No signals available yet</div>';
  }

  return signals.slice(0, 6).map(signal => {
    const confidence = Math.round((signal.confidence || 0) * 100);
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
        <div class="confidence-bar">
          <div class="confidence-fill" style="width: ${confidence}%"></div>
        </div>
        <div class="signal-detail">
          <span class="label">Strategy:</span>
          <span class="value">${signal.strategy || 'Standard'}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Generate action items HTML
 */
function generateActionItems(actionItems: any[]): string {
  if (!actionItems || actionItems.length === 0) {
    return '<li class="action-item"><h4>📋 Monitor Market</h4><p>Watch for pre-market movements and news that could impact the trading session.</p></li>';
  }

  return actionItems.map((item: any, index: any) => `
    <li class="action-item">
      <h4>${item.title || `Action ${index + 1}`}</h4>
      <p>${item.description || 'Monitor market conditions and adjust strategy accordingly.'}</p>
    </li>
  `).join('');
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
