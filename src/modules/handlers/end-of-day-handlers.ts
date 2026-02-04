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
import { getD1FallbackData, readD1ReportSnapshotByRunId, getMatchedPreMarketRunId } from '../d1-job-storage.js';
import { AI_MODEL_DISPLAY } from '../config.js';
import { createSimplifiedEnhancedDAL } from '../simplified-enhanced-dal.js';
import { SHARED_NAV_CSS, getSharedNavHTML, getNavScripts } from '../../utils/html-templates.js';
import type { CloudflareEnvironment } from '../../types';
import { getTodayInZone, resolveQueryDate, getCurrentTimeET } from './date-utils.js';
import { generatePendingPageHTML } from './pending-page.js';

const logger = createLogger('end-of-day-handlers');

/**
 * Fetch job run details including errors and stage information
 */
async function fetchJobRunDetails(env: CloudflareEnvironment, runId: string): Promise<{ status: string; current_stage: string | null; errors_json: string | null; warnings_json: string | null } | null> {
    const db = env.PREDICT_JOBS_DB;
    if (!db) return null;

    try {
        const result = await db.prepare(`
            SELECT status, current_stage, errors_json, warnings_json
            FROM job_run_results
            WHERE run_id = ?
            LIMIT 1
        `).bind(runId).first<{ status: string; current_stage: string | null; errors_json: string | null; warnings_json: string | null }>();

        return result || null;
    } catch (error) {
        logger.error('Failed to fetch job run details', { error: (error as Error).message, runId });
        return null;
    }
}

/**
 * Fetch job stage log for a run
 */
async function fetchJobStageLog(env: CloudflareEnvironment, runId: string): Promise<Array<{ stage: string; started_at: string; ended_at: string | null }>> {
    const db = env.PREDICT_JOBS_DB;
    if (!db) return [];

    try {
        const result = await db.prepare(`
            SELECT stage, started_at, ended_at
            FROM job_stage_log
            WHERE run_id = ?
            ORDER BY started_at ASC
        `).bind(runId).all();

        return (result.results || []) as Array<{ stage: string; started_at: string; ended_at: string | null }>;
    } catch (error) {
        logger.error('Failed to fetch job stage log', { error: (error as Error).message, runId });
        return [];
    }
}

/**
 * Generate End-of-Day Summary Page
 */
export const handleEndOfDaySummary = createHandler('end-of-day-summary', async (request: Request, env: CloudflareEnvironment, ctx: any) => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    const url = new URL(request.url);
    const bypassCache = url.searchParams.get('bypass') === '1';
    const runId = url.searchParams.get('run_id');

    // Resolve query date: ?date > ?tz > DO setting > ET default
    let queryDateStr = await resolveQueryDate(url, env.CACHE_DO as any);
    const todayET = getTodayInZone('America/New_York');

    // Fast path: check DO HTML cache first (unless bypass)
    const isRunIdView = !!runId;
    if (!bypassCache && !isRunIdView) {
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

    // Prefer exact run_id lookup when provided
    let d1Result: { data: any; createdAt: string; isStale?: boolean; sourceDate?: string } | null = null;
    let jobRunDetails: { status: string; current_stage: string | null; errors_json: string | null; warnings_json: string | null } | null = null;
    
    if (runId) {
        const runSnapshot = await readD1ReportSnapshotByRunId(env, runId);
        if (runSnapshot) {
            queryDateStr = runSnapshot.scheduledDate;
            d1Result = {
                data: runSnapshot.data,
                createdAt: runSnapshot.createdAt,
                isStale: false,
                sourceDate: runSnapshot.scheduledDate
            };
            logger.info('END-OF-DAY: Loaded snapshot by run_id', { requestId, runId, scheduledDate: runSnapshot.scheduledDate });
            
            // Fetch job run details for failure info
            jobRunDetails = await fetchJobRunDetails(env, runId);
            
            // Also fetch stage log to embed in page
            if (jobRunDetails && (jobRunDetails.status === 'failed' || jobRunDetails.status === 'partial')) {
                const stageLog = await fetchJobStageLog(env, runId);
                (jobRunDetails as any).stageLog = stageLog;
            }
        } else {
            logger.warn('END-OF-DAY: run_id not found; falling back to date-based lookup', { requestId, runId, queryDateStr });
        }
    }

    // Use getD1FallbackData which handles full fallback chain and returns createdAt
    const fallback = d1Result ? null : await getD1FallbackData(env, queryDateStr, 'end-of-day');
    if (!d1Result) {
        d1Result = fallback ? {
            data: fallback.data,
            createdAt: fallback.createdAt || fallback.data?._d1_created_at || fallback.data?.generated_at || new Date().toISOString(),
            isStale: fallback.isStale || false,
            sourceDate: fallback.sourceDate || queryDateStr
        } : null;
    }

    if (fallback) {
        logger.info('END-OF-DAY: Data retrieved', { source: fallback.source, sourceDate: fallback.sourceDate, isStale: fallback.isStale });
    }

    // Fetch matched pre-market run_id for this date
    const matchedPreMarket = await getMatchedPreMarketRunId(env, queryDateStr);
    if (matchedPreMarket) {
        logger.info('END-OF-DAY: Matched pre-market run found', { runId: matchedPreMarket.runId, createdAt: matchedPreMarket.createdAt });
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
    const htmlContent = generateEndOfDayHTML(d1Result, queryDateStr, isQueryingToday, beforeScheduleET, isPending, sourceDate, dataDateDiffers, runId || undefined, jobRunDetails, matchedPreMarket);

    // Cache HTML for fast subsequent loads
    try {
        const dal = createSimplifiedEnhancedDAL(env);
        if (!isRunIdView) {
            await dal.write(`end_of_day_html_${queryDateStr}`, htmlContent, { expirationTtl: 300 });
        }
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
    dataDateDiffers: boolean,
    runId?: string,
    jobRunDetails?: { status: string; current_stage: string | null; errors_json: string | null; warnings_json: string | null } | null,
    matchedPreMarket?: { runId: string; createdAt: string } | null
): string {
    const rawData = d1Result?.data;
    // Transform stored schema to frontend expected schema
    const endOfDayData = rawData ? transformEodDataForFrontend(rawData) : null;
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
    <link rel="stylesheet" href="/css/reports.css">
    ${getNavScripts()}
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
    <script src="js/cct-api.js"></script>
    <style>
        /* End-of-Day Specific Components */
        .failure-section {
            background: rgba(239, 68, 68, 0.1);
            border: 2px solid rgba(239, 68, 68, 0.3);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 30px;
        }

        .failure-section h2 {
            color: #ef4444;
            margin-bottom: 20px;
            font-size: 1.3rem;
        }

        .failure-info {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .failure-status, .failure-stage {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
        }

        .failure-status .label, .failure-stage .label {
            font-weight: 600;
            color: rgba(255, 255, 255, 0.7);
        }

        .failure-status .value {
            font-weight: bold;
            padding: 4px 12px;
            border-radius: 6px;
        }

        .failure-status .value.failed {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
        }

        .failure-status .value.partial {
            background: rgba(245, 158, 11, 0.2);
            color: #f59e0b;
        }

        .failure-errors, .failure-warnings {
            margin-top: 12px;
        }

        .failure-errors h3, .failure-warnings h3 {
            font-size: 1rem;
            margin-bottom: 8px;
        }

        .error-log, .warning-log {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 16px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.85rem;
            line-height: 1.5;
            color: #fcd535;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .stage-log-section {
            margin-top: 20px;
        }

        .stage-log-section h3 {
            font-size: 1rem;
            margin-bottom: 12px;
        }

        .stage-timeline {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .stage-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            border-left: 3px solid;
        }

        .stage-item.completed {
            border-left-color: #10b981;
        }

        .stage-item.running {
            border-left-color: #f59e0b;
        }

        .stage-item.failed {
            border-left-color: #ef4444;
        }

        .stage-icon {
            font-size: 1.2rem;
        }

        .stage-name {
            flex: 1;
            font-weight: 600;
        }

        .stage-time {
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.6);
        }

        .stage-duration {
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.5);
            font-style: italic;
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
            color: #f0b90b;
        }

        .outlook-content {
            text-align: center;
            padding: 20px;
        }

        .outlook-direction {
            font-size: 1.8rem;
            font-weight: bold;
            margin-bottom: 10px;
            color: #fcd535;
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

        /* Enhanced Dual Model Display Styles */
        .dual-model-section {
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .dual-model-header {
            font-size: 0.9rem;
            color: #f0b90b;
            margin-bottom: 12px;
            font-weight: 600;
        }

        .dual-model-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 12px;
        }

        .model-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 12px;
            border-left: 3px solid rgba(255, 255, 255, 0.3);
        }

        .model-card.bullish {
            border-left-color: #10b981;
            background: rgba(16, 185, 129, 0.1);
        }

        .model-card.bearish {
            border-left-color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
        }

        .model-card.neutral {
            border-left-color: #f59e0b;
            background: rgba(245, 158, 11, 0.1);
        }

        .model-name {
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.6);
            margin-bottom: 4px;
            font-weight: 500;
        }

        .model-result {
            font-size: 1rem;
            font-weight: bold;
            margin-bottom: 6px;
        }

        .model-confidence {
            font-size: 0.85rem;
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 6px;
        }

        .model-confidence strong {
            color: #fcd535;
        }

        .model-reasoning {
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.6);
            line-height: 1.4;
            font-style: italic;
            cursor: help;
        }

        .combined-action {
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 12px;
            background: rgba(240, 185, 11, 0.1);
            border-radius: 6px;
            margin-bottom: 8px;
        }

        .signal-reasoning {
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.7);
            padding: 8px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 6px;
            margin-bottom: 8px;
        }

        .articles-count {
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.5);
            text-align: right;
        }

        .agreement-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: bold;
            margin-top: 8px;
        }

        .agreement-badge.agree {
            background: rgba(16, 185, 129, 0.2);
            color: #10b981;
        }

        .agreement-badge.disagree {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
        }

        /* Market Pulse EOD Section */
        .market-pulse-eod {
            background: linear-gradient(135deg, rgba(79, 172, 254, 0.1) 0%, rgba(240, 185, 11, 0.1) 100%);
            border: 1px solid rgba(240, 185, 11, 0.3);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 32px;
        }
        .market-pulse-eod h2 {
            color: #f0b90b;
            margin: 0 0 8px 0;
        }
        .market-pulse-note {
            color: rgba(250, 248, 245, 0.6);
            font-size: 0.85rem;
            margin: 0 0 20px 0;
            font-style: italic;
        }
        .market-pulse-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
        }
        @media (max-width: 768px) {
            .market-pulse-grid {
                grid-template-columns: 1fr;
            }
        }
        .pulse-card {
            background: rgba(26, 26, 26, 0.8);
            border-radius: 8px;
            padding: 16px;
            text-align: center;
        }
        .pulse-card h4 {
            color: rgba(250, 248, 245, 0.8);
            margin: 0 0 12px 0;
            font-size: 0.9rem;
        }
        .pulse-direction {
            font-size: 1.5rem;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .pulse-direction.bullish, .pulse-direction.up { color: #10b981; }
        .pulse-direction.bearish, .pulse-direction.down { color: #ef4444; }
        .pulse-direction.neutral { color: #f0b90b; }
        .pulse-confidence {
            font-size: 0.9rem;
            color: rgba(250, 248, 245, 0.7);
        }
        .pulse-dual-model {
            margin-top: 12px;
            display: flex;
            gap: 8px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .pulse-dual-model .model-tag {
            background: rgba(79, 172, 254, 0.2);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            color: rgba(250, 248, 245, 0.8);
        }
        .pulse-articles {
            margin-top: 8px;
            font-size: 0.8rem;
            color: rgba(250, 248, 245, 0.5);
        }
        .pulse-change {
            font-size: 1.8rem;
            font-weight: bold;
        }
        .pulse-change.positive { color: #10b981; }
        .pulse-change.negative { color: #ef4444; }
        .pulse-price {
            font-size: 0.9rem;
            color: rgba(250, 248, 245, 0.6);
            margin-top: 4px;
        }
        .pulse-pending {
            color: rgba(250, 248, 245, 0.5);
            font-style: italic;
        }
        .pulse-result {
            font-size: 1.4rem;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .pulse-result.correct { color: #10b981; }
        .pulse-result.incorrect { color: #ef4444; }
        .pulse-result.neutral { color: #f0b90b; }
        .pulse-result-note {
            font-size: 0.8rem;
            color: rgba(250, 248, 245, 0.6);
        }

        .matched-premarket-display {
            margin-top: 8px;
        }

        .matched-premarket-display a:hover {
            color: #fcd535;
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
              ${runId ? `<div class="run-id-display">
                <span class="date-label">Run ID:</span>
                <span class="date-value" style="font-family: monospace; font-size: 0.85em;">${runId.slice(-12)}</span>
              </div>` : ''}
              ${matchedPreMarket ? `<div class="matched-premarket-display">
                <span class="date-label">Pre-Market Run:</span>
                <a href="/pre-market-briefing?run_id=${matchedPreMarket.runId}" class="date-value" style="font-family: monospace; font-size: 0.85em; color: #4facfe; text-decoration: underline;">${matchedPreMarket.runId.slice(-12)}</a>
              </div>` : ''}
              </div>
            </div>
            ${dataDateWarning}
        </div>

        ${jobRunDetails && (jobRunDetails.status === 'failed' || jobRunDetails.status === 'partial') ? `
        <div class="failure-section">
            <h2>🔍 Job Execution Details</h2>
            <div class="failure-info">
                <div class="failure-status">
                    <span class="label">Status:</span>
                    <span class="value ${jobRunDetails.status}">${jobRunDetails.status === 'failed' ? '❌ Failed' : '⚠️ Partial Success'}</span>
                </div>
                ${jobRunDetails.current_stage ? `
                <div class="failure-stage">
                    <span class="label">Last Stage:</span>
                    <span class="value">${jobRunDetails.current_stage}</span>
                </div>
                ` : ''}
                ${jobRunDetails.errors_json ? `
                <div class="failure-errors">
                    <h3>❌ Errors</h3>
                    <pre class="error-log">${formatErrorsJson(jobRunDetails.errors_json)}</pre>
                </div>
                ` : ''}
                ${jobRunDetails.warnings_json ? `
                <div class="failure-warnings">
                    <h3>⚠️ Warnings</h3>
                    <pre class="warning-log">${formatErrorsJson(jobRunDetails.warnings_json)}</pre>
                </div>
                ` : ''}
                <div class="stage-log-section" id="stage-log-container">
                    <h3>📋 Job Progress Log</h3>
                    <div class="loading">Loading stage log...</div>
                </div>
            </div>
        </div>
        ` : ''}

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
                <div class="value">${endOfDayData.avgConfidence ? Math.round(endOfDayData.avgConfidence) + '%' : 'N/A'}</div>
                <div class="label">Prediction confidence</div>
            </div>
        </div>

        <!-- Market Pulse Section (SPY benchmark - separate from portfolio accuracy) -->
        ${endOfDayData.marketPulse ? `
        <div class="market-pulse-eod">
            <h2>📊 Market Pulse (SPY)</h2>
            <p class="market-pulse-note">S&P 500 benchmark - tracked separately from portfolio signals</p>
            <div class="market-pulse-grid">
                <div class="pulse-card predicted">
                    <h4>🔮 Pre-Market Prediction</h4>
                    <div class="pulse-direction ${endOfDayData.marketPulse.predicted?.direction?.toLowerCase() === 'bullish' ? 'bullish' : endOfDayData.marketPulse.predicted?.direction?.toLowerCase() === 'bearish' ? 'bearish' : 'neutral'}">
                        ${getDirectionEmoji(endOfDayData.marketPulse.predicted?.direction)} ${escapeHtml(endOfDayData.marketPulse.predicted?.direction?.toUpperCase() || 'N/A')}
                    </div>
                    <div class="pulse-confidence">Confidence: ${endOfDayData.marketPulse.predicted?.confidence ? Math.round(endOfDayData.marketPulse.predicted.confidence * 100) + '%' : 'N/A'}</div>
                    ${endOfDayData.marketPulse.predicted?.dual_model ? `
                    <div class="pulse-dual-model">
                        <span class="model-tag">GPT-OSS: ${endOfDayData.marketPulse.predicted.dual_model.primary?.direction || 'N/A'}</span>
                        <span class="model-tag">DeepSeek: ${endOfDayData.marketPulse.predicted.dual_model.mate?.direction || 'N/A'}</span>
                    </div>
                    ` : ''}
                    ${endOfDayData.marketPulse.predicted?.articles_count ? `<div class="pulse-articles">${endOfDayData.marketPulse.predicted.articles_count} articles analyzed</div>` : ''}
                </div>
                <div class="pulse-card actual">
                    <h4>📈 Actual Close</h4>
                    ${endOfDayData.marketPulse.actual ? `
                    <div class="pulse-direction ${endOfDayData.marketPulse.actual.direction}">
                        ${endOfDayData.marketPulse.actual.direction === 'up' ? '📈' : '📉'} ${endOfDayData.marketPulse.actual.direction.toUpperCase()}
                    </div>
                    <div class="pulse-change ${endOfDayData.marketPulse.actual.dayChange >= 0 ? 'positive' : 'negative'}">
                        ${endOfDayData.marketPulse.actual.dayChange >= 0 ? '+' : ''}${endOfDayData.marketPulse.actual.dayChange.toFixed(2)}%
                    </div>
                    <div class="pulse-price">Close: $${endOfDayData.marketPulse.actual.closePrice.toFixed(2)}</div>
                    ` : `
                    <div class="pulse-pending">Awaiting market close data</div>
                    `}
                </div>
                <div class="pulse-card result">
                    <h4>🎯 Result</h4>
                    ${endOfDayData.marketPulse.correct !== null ? `
                    <div class="pulse-result ${endOfDayData.marketPulse.correct ? 'correct' : 'incorrect'}">
                        ${endOfDayData.marketPulse.correct ? '✓ CORRECT' : '✗ INCORRECT'}
                    </div>
                    <div class="pulse-result-note">
                        Predicted ${endOfDayData.marketPulse.predicted?.direction || 'N/A'}, market went ${endOfDayData.marketPulse.actual?.direction || 'N/A'}
                    </div>
                    ` : `
                    <div class="pulse-result neutral">— NEUTRAL</div>
                    <div class="pulse-result-note">Neutral prediction - no right/wrong</div>
                    `}
                </div>
            </div>
        </div>
        ` : ''}

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
                ${generateSignalCards(endOfDayData.signals || endOfDayData.signalBreakdown || [])}
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
                        backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
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
                        data: ${JSON.stringify(endOfDayData.confidenceData?.map((c: any) => (c.confidence || 0)) || [])},
                        backgroundColor: 'rgba(79, 172, 254, 0.8)',
                        borderColor: '#f0b90b',
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
      // Fetch and render stage log if run_id is present
      const runId = '${escapeJs(runId || '')}';
      const embeddedStageLog = ${jobRunDetails && (jobRunDetails as any).stageLog ? JSON.stringify((jobRunDetails as any).stageLog) : 'null'};
      
      if (runId) {
        if (embeddedStageLog && embeddedStageLog.length > 0) {
          // Use embedded stage log (faster, no extra API call)
          renderStageLog(embeddedStageLog);
        } else {
          // Fetch from API
          fetchStageLog(runId);
        }
      }

      async function fetchStageLog(runId) {
        try {
          const response = await fetch(\`/api/v1/jobs/runs/\${runId}/stages\`);
          const data = await response.json();
          
          if (data.success && data.data.stages && data.data.stages.length > 0) {
            renderStageLog(data.data.stages);
          } else {
            document.getElementById('stage-log-container').innerHTML = '<p style="color: rgba(255,255,255,0.6); font-style: italic;">No stage log available</p>';
          }
        } catch (error) {
          console.error('Failed to fetch stage log:', error);
          document.getElementById('stage-log-container').innerHTML = '<p style="color: #ef4444;">Failed to load stage log</p>';
        }
      }

      function renderStageLog(stages) {
        const stageIcons = {
          init: '🚀',
          data_fetch: '📥',
          ai_analysis: '🤖',
          storage: '💾',
          finalize: '✅'
        };

        const stageNames = {
          init: 'Initialization',
          data_fetch: 'Data Fetch',
          ai_analysis: 'AI Analysis',
          storage: 'Storage',
          finalize: 'Finalization'
        };

        const items = stages.map(stage => {
          const isCompleted = !!stage.ended_at;
          const statusClass = isCompleted ? 'completed' : 'running';
          const icon = stageIcons[stage.stage] || '📋';
          const name = stageNames[stage.stage] || stage.stage;
          
          const startTime = new Date(stage.started_at).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
          });
          
          let duration = '';
          if (isCompleted) {
            const start = new Date(stage.started_at).getTime();
            const end = new Date(stage.ended_at).getTime();
            const durationMs = end - start;
            duration = durationMs < 1000 ? \`\${durationMs}ms\` : \`\${(durationMs / 1000).toFixed(1)}s\`;
          }

          return \`
            <div class="stage-item \${statusClass}">
              <span class="stage-icon">\${icon}</span>
              <span class="stage-name">\${name}</span>
              <span class="stage-time">\${startTime}</span>
              \${duration ? \`<span class="stage-duration">(\${duration})</span>\` : '<span class="stage-duration">In progress...</span>'}
            </div>
          \`;
        }).join('');

        document.getElementById('stage-log-container').innerHTML = \`
          <h3>📋 Job Progress Log</h3>
          <div class="stage-timeline">\${items}</div>
        \`;
      }

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
 * Transform stored EOD schema to frontend expected schema
 * Stored: signalBreakdown, overallAccuracy (0-100), tomorrowOutlook.marketBias
 * Frontend: signals, accuracyRate (0-1), tomorrowOutlook.direction
 * 
 * Preserves dual AI details: primary/mate directions, confidence levels, reasoning
 */
function transformEodDataForFrontend(raw: any): any {
    if (!raw) return null;

    // Map signalBreakdown to signals array expected by frontend
    // Preserve all dual AI details for display
    const signals = (raw.signalBreakdown || []).map((s: any) => ({
        symbol: s.ticker,
        ticker: s.ticker, // Keep both for compatibility
        predicted: s.predicted,
        predictedDirection: s.predictedDirection,
        actual: s.actual,
        actualDirection: s.actualDirection,
        confidence: (s.confidence || 0), // Keep as 0-100 for display
        confidenceLevel: s.confidenceLevel,
        correct: s.correct,
        // Dual AI details
        primary_direction: s.primary_direction,
        primary_confidence: s.primary_confidence,
        primary_reasoning: s.primary_reasoning,
        mate_direction: s.mate_direction,
        mate_confidence: s.mate_confidence,
        mate_reasoning: s.mate_reasoning,
        models_agree: s.models_agree,
        action: s.action,
        signal_reasoning: s.signal_reasoning,
        articles_count: s.articles_count
    }));

    // Calculate performance distribution from signals
    const performanceDistribution = {
        correct: raw.correctCalls || signals.filter((s: any) => s.correct).length,
        incorrect: raw.wrongCalls || signals.filter((s: any) => !s.correct && s.actual).length,
        pending: signals.filter((s: any) => !s.actual).length
    };

    // Build confidence data from signals
    const confidenceData = signals.map((s: any) => ({
        symbol: s.symbol,
        confidence: s.confidence
    }));

    // Build symbol performance from signals + topWinners/topLosers
    const symbolPerformance = [
        ...(raw.topWinners || []).map((w: any) => ({
            symbol: w.ticker,
            performance: parseFloat(w.performance?.replace('%', '').replace('+', '') || '0') / 100
        })),
        ...(raw.topLosers || []).map((l: any) => ({
            symbol: l.ticker,
            performance: parseFloat(l.performance?.replace('%', '').replace('+', '') || '0') / 100
        }))
    ];

    // Transform tomorrowOutlook
    const biasToDirection: Record<string, string> = {
        'Bullish': 'bullish',
        'Neutral-Bullish': 'bullish',
        'Bearish': 'bearish',
        'Neutral-Bearish': 'bearish',
        'Neutral': 'neutral'
    };
    const levelToConfidence: Record<string, number> = {
        'High': 0.8,
        'Medium': 0.6,
        'Low': 0.4
    };
    const tomorrowOutlook = raw.tomorrowOutlook ? {
        direction: biasToDirection[raw.tomorrowOutlook.marketBias] || 'neutral',
        confidence: levelToConfidence[raw.tomorrowOutlook.confidenceLevel] || 0.5,
        reasoning: raw.tomorrowOutlook.keyFocus ?
            `Focus: ${raw.tomorrowOutlook.keyFocus}. Volatility: ${raw.tomorrowOutlook.volatilityLevel || 'Moderate'}.` :
            raw.insights?.modelPerformance || 'Analysis in progress...'
    } : null;

    // Calculate average confidence
    const avgConfidence = signals.length > 0
        ? signals.reduce((sum: number, s: any) => sum + (s.confidence || 0), 0) / signals.length
        : 0;

    return {
        ...raw,
        signals,
        accuracyRate: (raw.overallAccuracy || 0) / 100, // Convert 0-100 to 0-1
        avgConfidence,
        marketClose: raw.marketCloseTime ? 'Closed' : null,
        performanceDistribution,
        confidenceData,
        symbolPerformance,
        tomorrowOutlook: tomorrowOutlook || raw.tomorrowOutlook
    };
}

/**
 * HTML-escape a string to prevent XSS
 */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Escape for safe JS string interpolation (prevents script injection)
 * Handles: quotes, backslashes, HTML delimiters, newlines, and U+2028/U+2029 line separators
 */
function escapeJs(str: string): string {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/</g, '\\x3c')
        .replace(/>/g, '\\x3e')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\u2028/g, '\\u2028')  // Line separator
        .replace(/\u2029/g, '\\u2029'); // Paragraph separator
}

/**
 * Format errors JSON for display (HTML-escaped)
 */
function formatErrorsJson(errorsJson: string): string {
    try {
        const errors = JSON.parse(errorsJson);
        if (Array.isArray(errors)) {
            return errors.map((err, idx) => {
                if (typeof err === 'string') return escapeHtml(`${idx + 1}. ${err}`);
                if (typeof err === 'object') {
                    const msg = `${idx + 1}. ${err.symbol || err.stage || 'Error'}: ${err.error || err.message || JSON.stringify(err)}`;
                    return escapeHtml(msg);
                }
                return escapeHtml(`${idx + 1}. ${JSON.stringify(err)}`);
            }).join('\n');
        }
        return escapeHtml(JSON.stringify(errors, null, 2));
    } catch {
        return escapeHtml(errorsJson);
    }
}

/**
 * Generate signal cards HTML with dual model display
 * Shows full dual AI sentiment details: directions and confidence levels for all symbols
 */
function generateSignalCards(signals: any[]): string {
    if (!signals || signals.length === 0) {
        return '<p style="text-align: center; opacity: 0.7; grid-column: 1 / -1; padding: 40px;">No signal data available for today.</p>';
    }

    return signals.map(signal => {
        // Map signalBreakdown structure to expected format
        const symbol = signal.ticker || signal.symbol;
        const predictedDirection = signal.predictedDirection || signal.direction;
        const actualDirection = signal.actualDirection;
        const confidence = signal.confidence || 0;
        const isCorrect = signal.correct;
        
        const accuracyClass = isCorrect ? 'accuracy-correct' : 'accuracy-incorrect';
        
        // Extract dual model data if available (model-agnostic naming with backward compat)
        const primaryDir = signal.primary_direction || signal.gemma_direction;
        const mateDir = signal.mate_direction || signal.distilbert_direction;
        const primaryConf = signal.primary_confidence;
        const mateConf = signal.mate_confidence;
        const primaryReasoning = signal.primary_reasoning;
        const mateReasoning = signal.mate_reasoning;
        const modelsAgree = signal.models_agree;
        const action = signal.action;
        const signalReasoning = signal.signal_reasoning;
        const articlesCount = signal.articles_count;

        const hasDualModel = primaryDir || mateDir;

        // Format confidence for display (handle 0-1 vs 0-100 scale)
        const formatConf = (conf: number | null | undefined): string => {
            if (conf === null || conf === undefined) return 'N/A';
            // If value is <= 1, treat as 0-1 scale and convert to percentage
            const pct = conf <= 1 ? Math.round(conf * 100) : Math.round(conf);
            return `${pct}%`;
        };

        // Agreement badge
        const agreementBadge = hasDualModel ? `
          <div class="agreement-badge ${modelsAgree ? 'agree' : 'disagree'}">
            ${modelsAgree ? '✓ MODELS AGREE' : '✗ MODELS DISAGREE'}
          </div>
        ` : '';

        // Enhanced dual model cards with confidence levels and optional reasoning
        const dualModelCards = hasDualModel ? `
          <div class="dual-model-section">
            <h5 class="dual-model-header">🤖 Dual AI Analysis</h5>
            <div class="dual-model-grid">
              <div class="model-card ${primaryDir?.toLowerCase() === 'bullish' ? 'bullish' : primaryDir?.toLowerCase() === 'bearish' ? 'bearish' : 'neutral'}">
                <div class="model-name">${AI_MODEL_DISPLAY.primary.name}</div>
                <div class="model-result">${getDirectionEmoji(primaryDir)} ${primaryDir?.toUpperCase() || 'N/A'}</div>
                <div class="model-confidence">Confidence: <strong>${formatConf(primaryConf)}</strong></div>
                ${primaryReasoning ? `<div class="model-reasoning" title="${escapeHtml(primaryReasoning)}">${escapeHtml(primaryReasoning.slice(0, 80))}${primaryReasoning.length > 80 ? '...' : ''}</div>` : ''}
              </div>
              <div class="model-card ${mateDir?.toLowerCase() === 'bullish' ? 'bullish' : mateDir?.toLowerCase() === 'bearish' ? 'bearish' : 'neutral'}">
                <div class="model-name">${AI_MODEL_DISPLAY.secondary.name}</div>
                <div class="model-result">${getDirectionEmoji(mateDir)} ${mateDir?.toUpperCase() || 'N/A'}</div>
                <div class="model-confidence">Confidence: <strong>${formatConf(mateConf)}</strong></div>
                ${mateReasoning ? `<div class="model-reasoning" title="${escapeHtml(mateReasoning)}">${escapeHtml(mateReasoning.slice(0, 80))}${mateReasoning.length > 80 ? '...' : ''}</div>` : ''}
              </div>
            </div>
            ${action ? `<div class="combined-action">Combined Signal: <strong>${escapeHtml(action)}</strong></div>` : ''}
            ${signalReasoning ? `<div class="signal-reasoning">${escapeHtml(signalReasoning)}</div>` : ''}
            ${articlesCount !== undefined ? `<div class="articles-count">📰 ${articlesCount} article${articlesCount !== 1 ? 's' : ''} analyzed</div>` : ''}
          </div>
        ` : '';

        return `
      <div class="signal-card">
        <h4>${escapeHtml(symbol)} ${getDirectionEmoji(predictedDirection)}</h4>
        <div class="signal-detail">
          <span class="label">Predicted:</span>
          <span class="value">${escapeHtml(signal.predicted || predictedDirection?.toUpperCase() || 'N/A')}</span>
        </div>
        <div class="signal-detail">
          <span class="label">Actual:</span>
          <span class="value">${escapeHtml(signal.actual || actualDirection?.toUpperCase() || 'N/A')}</span>
        </div>
        <div class="signal-detail">
          <span class="label">Combined Confidence:</span>
          <span class="value">${confidence}%</span>
        </div>
        <div class="signal-detail">
          <span class="label">Result:</span>
          <span class="value">
            <span class="accuracy-badge ${accuracyClass}">
              ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}
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
