/**
 * Pre-Market Briefing Handler
 * Comprehensive battle plan for the sentiment analysis day
 */

import { createLogger } from '../logging.js';
import { createSuccessResponse } from '../response-factory.js';
import { createHandler } from '../handler-factory.js';
import { generatePreMarketSignals } from '../report/pre-market-analysis.js';
import { getPreMarketBriefingData } from '../report-data-retrieval.js';
import { validateRequest, validateEnvironment, safeValidate } from '../validation.js';
import { SHARED_NAV_CSS, getSharedNavHTML, getNavScripts } from '../../utils/html-templates.js';
import type { CloudflareEnvironment } from '../../types';

import { createSimplifiedEnhancedDAL } from '../simplified-enhanced-dal.js';

const logger = createLogger('briefing-handlers');

/**
 * Generate Pre-Market Briefing Page
 */
export const handlePreMarketBriefing = createHandler('pre-market-briefing', async (request: Request, env: CloudflareEnvironment, ctx: any) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const url = new URL(request.url);
  const bypassCache = url.searchParams.get('bypass') === '1';
  
  // Support ?date=yesterday or ?date=YYYY-MM-DD
  const dateParam = url.searchParams.get('date');
  let targetDate = new Date();
  if (dateParam === 'yesterday') {
    targetDate.setDate(targetDate.getDate() - 1);
  } else if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    targetDate = new Date(dateParam + 'T12:00:00Z');
  }
  const dateStr = targetDate.toISOString().split('T')[0];

  logger.info('🚀 [PRE-MARKET] Starting pre-market briefing generation', {
    requestId,
    date: dateStr,
    bypassCache
  });

  // Validate inputs
  validateRequest(request);
  validateEnvironment(env);

  const dal = createSimplifiedEnhancedDAL(env);

  // Fast path: check DO HTML cache first (unless bypass)
  if (!bypassCache) {
    try {
      const cached = await dal.read(`premarket_html_${dateStr}`);
      if (cached.success && cached.data) {
        return new Response(cached.data, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'X-Cache': 'HIT',
            'X-Request-ID': requestId
          }
        });
      }
    } catch (e) { /* continue to generate */ }
  }

  logger.debug('✅ [PRE-MARKET] Input validation passed', { requestId });

  try {
    // Try to get pre-market briefing data first
    let briefingData: any = null;

    try {
      const rawData = await getPreMarketBriefingData(env, targetDate);

      // Transform data structure: extract signals from analysis
      if (rawData && rawData.analysis) {
        const isPartialFallback = rawData.analysis.source === 'd1_fallback';
        const isStale = rawData.analysis.is_stale === true;
        const sourceDate = rawData.analysis.source_date || dateStr;
        
        // Extract signals from either 'signals' or 'sentiment_signals' (D1 format)
        let signals = rawData.analysis.signals || [];
        if ((!signals || signals.length === 0) && rawData.analysis.sentiment_signals) {
          signals = Object.values(rawData.analysis.sentiment_signals).map((s: any) => ({
            symbol: s.symbol,
            direction: s.sentiment_analysis?.sentiment || 'neutral',
            sentiment: s.sentiment_analysis?.sentiment || 'neutral',
            confidence: s.sentiment_analysis?.confidence, // Keep null/undefined for failed
            reasoning: s.sentiment_analysis?.reasoning || '',
            signal_strength: s.sentiment_analysis?.dual_ai_comparison?.signal_strength || 'MODERATE',
            timestamp: s.timestamp
          }));
        }
        
        // Validated signals = have real confidence data (not null/undefined)
        const validatedSignals = signals.filter((s: any) => typeof s.confidence === 'number' && s.confidence > 0);
        // High confidence signals = confidence >= 60%
        const highConfidenceSignals = validatedSignals.filter((s: any) => s.confidence >= 0.6);
        const avgConfidence = validatedSignals.length > 0
          ? validatedSignals.reduce((sum: number, s: any) => sum + s.confidence, 0) / validatedSignals.length
          : 0;

        briefingData = {
          ...rawData,
          signals,
          totalSignals: signals.length,
          validatedSignals: validatedSignals.length,
          highConfidenceSignals: highConfidenceSignals.length,
          avgConfidence,
          marketSentiment: rawData.analysis.market_sentiment?.overall_sentiment || 'NEUTRAL',
          isPartialFallback,
          isStale,
          sourceDate,
          dataQuality: isStale ? 'stale' : (isPartialFallback ? 'partial' : 'full')
        };
        logger.info('✅ [PRE-MARKET] Pre-market data found', {
          requestId,
          signalsCount: briefingData.signals?.length || 0,
          validatedSignals: briefingData.validatedSignals || 0,
          highConfidenceSignals: briefingData.highConfidenceSignals || 0,
          avgConfidence: Math.round((briefingData.avgConfidence || 0) * 100) + '%',
          hasAnalysis: true,
          isPartialFallback,
          isStale,
          sourceDate
        });
      }
    } catch (dataError) {
      logger.warn('⚠️ [PRE-MARKET] No existing data found', { requestId, error: String(dataError) });
    }

    // If no data exists, show partial briefing (don't auto-generate - that's for scheduled jobs)
    if (!briefingData) {
      logger.warn('⚠️ [PRE-MARKET] No data available', { requestId, dateStr });
      const partialBriefing = generatePartialBriefing(dateStr, 0);
      return new Response(partialBriefing, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
          'X-Request-ID': requestId
        }
      });
    }

    logger.debug('✅ [PRE-MARKET] Data available, generating briefing', { requestId });

    // Generate comprehensive pre-market HTML
    const htmlContent = generatePreMarketHTML(briefingData, requestId, targetDate);

    // Cache HTML for fast subsequent loads
    try {
      await dal.write(`premarket_html_${dateStr}`, htmlContent, { expirationTtl: 300 });
    } catch (e) { /* ignore cache write errors */ }

    logger.info('🎯 [PRE-MARKET] Pre-market briefing completed', {
      requestId,
      duration: Date.now() - startTime,
      hasData: !!briefingData
    });

    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'MISS',
        'X-Request-ID': requestId,
        'X-Processing-Time': `${Date.now() - startTime}ms`
      }
    });

  } catch (error: any) {
    logger.error('❌ [PRE-MARKET] Pre-market briefing failed', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack,
      duration: Date.now() - startTime
    });

    return new Response(generateErrorHTML(error, requestId), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
});

/**
 * Generate comprehensive pre-market HTML
 */
function generatePreMarketHTML(
  briefingData: any,
  requestId: string,
  currentDate: Date
): string {
  const today = currentDate.toISOString().split('T')[0];
  
  // Check for actual data (signals > 0)
  const hasRealData = briefingData && (briefingData.totalSignals > 0 || briefingData.signals?.length > 0);
  
  // Scheduled time: 8:30 AM ET
  const scheduledUtc = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate(), 13, 30);
  const beforeSchedule = Date.now() < scheduledUtc;
  
  // Determine display status - local time computed client-side
  let statusDisplay: string;
  if (hasRealData) {
    statusDisplay = `Generated ${currentDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })} ET`;
  } else if (beforeSchedule) {
    statusDisplay = `⏳ Scheduled: 8:30 AM ET (<span class="local-time" data-et="8:30 AM"></span>)`;
  } else {
    statusDisplay = `⚠️ No data available`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pre-Market Briefing - ${today}</title>
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
            <p>Comprehensive trading battle plan for today's market session</p>
            <div class="date-display">${currentDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })} • ${statusDisplay}</div>
            ${briefingData?.isStale ? `<div class="stale-warning">⚠️ Showing data from ${briefingData.sourceDate} (latest available)</div>` : ''}
            ${briefingData?.isPartialFallback && !briefingData?.isStale ? `<div class="partial-warning">ℹ️ Partial data from D1 fallback</div>` : ''}
            <div class="market-status">
                <span class="status-dot"></span>
                <span>Pre-Market Active</span>
            </div>
        </div>

        ${!hasRealData ? `
        <div class="no-data">
            <h3>${beforeSchedule ? '⏳ Report Not Yet Generated' : '⚠️ No Pre-Market Data Available'}</h3>
            <p>${beforeSchedule ? `This report will be generated at 8:30 AM ET (<span class="local-time" data-et="8:30 AM"></span>).` : 'There is no pre-market data available for this date.'}</p>
            <p>Pre-market data is typically available 30-60 minutes before market open. Please check back closer to market opening.</p>
            <button class="refresh-button" onclick="location.reload()">Refresh Page</button>
        </div>
        ` : `
        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card">
                <h3>High Confidence</h3>
                <div class="value">${briefingData.highConfidenceSignals}/${briefingData.totalSignals}</div>
                <div class="label">Signals ≥60% confidence</div>
            </div>
            <div class="summary-card">
                <h3>Validated</h3>
                <div class="value">${briefingData.validatedSignals}/${briefingData.totalSignals}</div>
                <div class="label">With real AI data</div>
            </div>
            <div class="summary-card">
                <h3>Avg Confidence</h3>
                <div class="value">${briefingData.validatedSignals > 0
                  ? Math.round(briefingData.avgConfidence * 100) + '%'
                  : 'N/A'}</div>
                <div class="label">${briefingData.validatedSignals > 0
                  ? 'From validated signals'
                  : 'No validated signals'}</div>
            </div>
            <div class="summary-card">
                <h3>Market Sentiment</h3>
                <div class="value">${briefingData.marketSentiment || 'NEUTRAL'}</div>
                <div class="label">Overall market mood</div>
            </div>
            <div class="summary-card">
                <h3>Key Focus</h3>
                <div class="value">${briefingData.keyFocus || 'BALANCED'}</div>
                <div class="label">Trading strategy</div>
            </div>
        </div>

        <!-- Market Overview -->
        <div class="market-overview">
            <h2>📊 Market Overview</h2>
            <div class="market-grid">
                ${generateMarketOverview(briefingData.marketData)}
            </div>
        </div>

        <!-- Signals Section -->
        <div class="signals-section">
            <h2>🎯 High-Confidence Signals</h2>
            <div class="signal-grid">
                ${generateSignalCards(briefingData.signals || [])}
            </div>
        </div>

        <!-- Action Items -->
        <div class="action-items">
            <h2>⚡ Today's Action Items</h2>
            <ul class="action-list">
                ${generateActionItems(briefingData.actionItems || [])}
            </ul>
        </div>
        `}
    </div>

    ${hasRealData ? `
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
      document.querySelectorAll('.local-time').forEach(el => {
        const et = el.dataset.et;
        const dateStr = new Date().toLocaleDateString('en-US', {timeZone: 'America/New_York'}) + ' ' + et;
        const etDate = new Date(dateStr + ' EST');
        el.textContent = etDate.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) + ' local';
      });
    </script>
</body>
</html>`;
}

/**
 * Generate partial briefing HTML
 */
function generatePartialBriefing(dateStr: string, completionRate: number): string {
  // Calculate scheduled time: 8:30 AM ET = 13:30 UTC
  const currentDate = new Date(dateStr + 'T12:00:00Z');
  const scheduledUtc = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate(), 13, 30);
  const localScheduled = new Date(scheduledUtc).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const beforeSchedule = Date.now() < scheduledUtc;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pre-Market Briefing - ${dateStr}</title>
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
        .partial-content {
            text-align: center;
            max-width: 600px;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .partial-content h2 {
            color: #feca57;
            margin-bottom: 20px;
            font-size: 1.5rem;
        }
        .partial-content p {
            margin-bottom: 20px;
            opacity: 0.9;
        }
        .schedule-info {
            background: rgba(79, 172, 254, 0.2);
            border: 1px solid rgba(79, 172, 254, 0.5);
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            font-size: 1.1rem;
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
            margin-top: 20px;
        }
        .refresh-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(79, 172, 254, 0.3);
        }
        .info-box {
            background: rgba(255, 255, 255, 0.05);
            border-left: 4px solid #4facfe;
            padding: 15px;
            margin: 20px 0;
            text-align: left;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    ${getSharedNavHTML('pre-market')}
    <div class="partial-content">
        <h2>${beforeSchedule ? '⏳ Report Not Yet Generated' : '⚠️ No Pre-Market Data Available'}</h2>
        <div class="schedule-info">
            ${beforeSchedule 
              ? `📅 Scheduled: <strong>8:30 AM ET</strong> (${localScheduled} local)`
              : `This report has no data for ${dateStr}`}
        </div>
        <p>${beforeSchedule 
          ? 'The pre-market briefing will be generated at the scheduled time above.'
          : 'The scheduled job may not have run. Check system status for details.'}</p>
        <button class="refresh-button" onclick="location.reload()">Refresh Page</button>
    </div>
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
    return '<div style="text-align: center; opacity: 0.7;">No high-confidence signals available yet</div>';
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
    return '<li class="action-item"><h4>📋 Monitor Market</h4><p>Watch for pre-market movements and news that could impact today\'s trading session.</p></li>';
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