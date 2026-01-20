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
import { generatePendingPageHTML } from './pending-page.js';

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
  let d1Result = fallback ? {
    data: fallback.data,
    createdAt: fallback.createdAt || fallback.data?._d1_created_at || fallback.data?.generated_at || new Date().toISOString(),
    isStale: fallback.isStale || false,
    sourceDate: fallback.sourceDate || queryDateStr
  } : null;

  if (fallback) {
    logger.info('PRE-MARKET: Data retrieved', { source: fallback.source, sourceDate: fallback.sourceDate, isStale: fallback.isStale });
  }

  // Strict-date guard: if the only available data is from a different date, treat as no data for the requested day
  if (d1Result && d1Result.sourceDate !== queryDateStr) {
    logger.warn('PRE-MARKET: No D1 data for requested date; stale snapshot will NOT be used', {
      requestedDate: queryDateStr,
      sourceDate: d1Result.sourceDate
    });
    d1Result = null;
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
  const sourceDate = d1Result?.sourceDate || queryDateStr;
  // isStale: D1 marked the data old/out-of-date (sourceDate != queryDate)
  const isStale = d1Result?.isStale || false;
  // isPending: querying today with no exact match data, and before schedule
  // Show pending even if stale fallback data exists - don't show yesterday's data as "today"
  const isPending = (!d1Result || isStale) && isQueryingToday && showScheduled;

  // D1 record exists = we have data (regardless of signal count)
  const hasD1Data = !!d1Result;

  // Extract signals for display
  let signals: any[] = [];
  if (briefingData) {
    // Check trading_signals first (new format with dual model data)
    if (briefingData.trading_signals && Object.keys(briefingData.trading_signals).length > 0) {
      signals = Object.values(briefingData.trading_signals).map((s: any) => ({
        symbol: s.symbol,
        direction: s.trading_signals?.primary_direction?.toLowerCase() || s.sentiment_layers?.[0]?.sentiment || 'neutral',
        confidence: s.confidence_metrics?.overall_confidence ??
          s.enhanced_prediction?.confidence ??
          s.confidence ??
          s.sentiment_layers?.[0]?.confidence ??
          0,
        reasoning: s.enhanced_prediction?.sentiment_analysis?.reasoning || s.sentiment_layers?.[0]?.reasoning || '',
        // Include dual model data
        dual_model: s.dual_model,
        models: s.dual_model ? {
          gpt: s.dual_model.gemma,
          distilbert: s.dual_model.distilbert
        } : undefined,
        // Include articles data
        articles_count: s.articles_count,
        articles_content: s.articles_content
      }));
    } else if (briefingData.signals && briefingData.signals.length > 0) {
      // Fallback to signals array (legacy format)
      signals = briefingData.signals;
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

  // Check if data is genuinely stale (>1 day difference) vs timezone edge case (consecutive day)
  // Only show stale warning for genuinely old data, not timezone differences
  const daysDiff = Math.abs(Math.round((new Date(queryDateStr + 'T00:00:00Z').getTime() - new Date(sourceDate + 'T00:00:00Z').getTime()) / (1000 * 60 * 60 * 24)));
  const shouldShowStaleWarning = isStale && daysDiff > 1;

  // Determine display status - D1 is source of truth
  // Show both ET and local time for generated reports
  let statusDisplay: string;
  if (hasD1Data && d1CreatedAt) {
    const ts = new Date(d1CreatedAt).getTime();
    if (isStale) {
      statusDisplay = `Generated <span class="gen-time" data-ts="${ts}"></span>`;
    } else {
      statusDisplay = `Generated <span class="gen-time" data-ts="${ts}"></span>`;
    }
  } else if (showScheduled) {
    statusDisplay = `⏳ Scheduled: <span class="sched-time" data-utch="13" data-utcm="30"></span>`;
  } else {
    statusDisplay = `⚠️ No data available`;
  }

  // Branch: pending (not yet executed today) vs stale (old data) vs normal
  if (isPending) {
    // Report hasn't run yet for today
    return generatePendingPageHTML({
      title: 'Pre-Market Briefing',
      reportType: 'pre-market',
      dateStr: queryDateStr,
      scheduledHourUTC: 13,
      scheduledMinuteUTC: 30
    });
  }

  // For stale data (over time), show report with warning
  const staleWarning = shouldShowStaleWarning ? `
        <div class="stale-warning">
            ⚠️ <strong>Stale Data:</strong> Showing data from <strong>${sourceDateFormatted}</strong>.
            ${isQueryingToday ? `Today's report is scheduled for <span class="sched-time" data-utch="13" data-utcm="30"></span>.` : ''}
            <button class="refresh-button" style="margin-left: 15px; padding: 6px 12px; font-size: 0.85rem;" onclick="location.reload()">Refresh</button>
        </div>
        ` : '';

  // Display date: use actual D1 sourceDate when data exists, queryDate only for pending/no-data
  const displayDate = hasD1Data ? sourceDate : queryDateStr;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pre-Market Briefing - ${displayDate}</title>
    ${getNavScripts()}
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
    <script src="js/cct-api.js"></script>
    <style>
        /* Core styles handled by reports.css */
    </style>
</head>
</head>
<body>
    ${getSharedNavHTML('pre-market')}
    <div class="container">
        <div class="header">
            <h1>🚀 Pre-Market Briefing</h1>
            <p>Comprehensive trading battle plan for the market session</p>
            <div class="date-display">
              <div class="target-date">
                <span class="date-label">Target Day:</span>
                <span class="date-value">${new Date(queryDateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
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
            ${staleWarning}
            <div class="market-status">
                <span class="status-dot"></span>
                <span>Pre-Market Active</span>
            </div>
        </div>

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
    <link rel="stylesheet" href="/css/reports.css">
    <style>
        body {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .error-content {
            text-align: center;
            max-width: 600px;
            padding: 40px;
            background: var(--error-glow);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(239, 68, 68, 0.25);
        }
        .error-content h2 {
            color: var(--error);
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
            border-radius: var(--radius-md);
            margin-bottom: 20px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
            text-align: left;
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
 * Generate signal cards HTML with dual model display
 */
function generateSignalCards(signals: any[]): string {
  if (!signals || signals.length === 0) {
    return '<div style="text-align: center; opacity: 0.7;">No signals available yet</div>';
  }

  return signals.slice(0, 6).map(signal => {
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

    // Articles section
    let articlesHtml = '';
    const articlesCount = signal.articles_count || signal.articles_analyzed || 0;
    let articlesList: string[] = [];
    try {
      articlesList = signal.articles_content ? (typeof signal.articles_content === 'string' ? JSON.parse(signal.articles_content) : signal.articles_content) : [];
    } catch { /* ignore */ }
    
    if (articlesCount > 0 || articlesList.length > 0) {
      articlesHtml = `
        <div class="articles-section" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(240,185,11,0.15);">
          <div style="font-size: 0.8rem; color: rgba(250,248,245,0.65); margin-bottom: 6px;">📰 ${articlesCount} articles analyzed</div>
          ${articlesList.length > 0 ? `<ul style="margin: 0; padding-left: 16px; font-size: 0.75rem; color: rgba(250,248,245,0.75);">
            ${articlesList.slice(0, 3).map((t: string) => `<li style="margin-bottom: 4px;">${t.length > 60 ? t.slice(0, 60) + '...' : t}</li>`).join('')}
          </ul>` : ''}
        </div>
      `;
    }

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
        ${agreementBadge}
        ${dualModelCards}
        ${articlesHtml}
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
