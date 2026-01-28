/**
 * Jobs Routes (API v1)
 * D1 query endpoints for job execution history and report snapshots
 */

import { ApiResponseFactory, ProcessingTimer, HttpStatus } from '../modules/api-v1-responses.js';
import { validateApiKey, generateRequestId } from './api-v1.js';
import { createLogger } from '../modules/logging.js';
import { handleScheduledEvent } from '../modules/scheduler.js';
import {
  getD1Predictions,
  getD1LatestReportSnapshot,
  readD1ReportSnapshot,
  writeD1JobResult,
  deleteD1ReportSnapshot,
  TriggerSource,
  startJobRun,
  completeJobRun,
  generateRunId,
  writeJobDateResult,
  startJobStage,
  endJobStage,
  markStaleJobsAsFailed,
  type ReportType,
  type JobTriggerSource
} from '../modules/d1-job-storage.js';
import { getPortfolioSymbols } from '../modules/config.js';

/**
 * Detect trigger source from request headers
 * - GitHub Actions sets User-Agent containing "GitHub-Hookshot" or custom header
 * - Can be explicitly set via X-Trigger-Source header
 * - Defaults to 'manual-api' for API calls
 */
function detectTriggerSource(request: Request): TriggerSource {
  const userAgent = request.headers.get('User-Agent') || '';
  const explicitSource = request.headers.get('X-Trigger-Source');

  // Explicit header takes precedence
  if (explicitSource) {
    const validSources: TriggerSource[] = ['github-actions', 'manual-api', 'cron', 'scheduler', 'unknown'];
    if (validSources.includes(explicitSource as TriggerSource)) {
      return explicitSource as TriggerSource;
    }
  }

  // Detect GitHub Actions
  if (userAgent.includes('GitHub-Hookshot') || request.headers.get('X-GitHub-Actions')) {
    return 'github-actions';
  }

  // Default to manual-api for API endpoint calls
  return 'manual-api';
}
import { createPreMarketDataBridge } from '../modules/pre-market-data-bridge.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('jobs-routes');

/**
 * Map TriggerSource to JobTriggerSource for nav status tracking
 */
function mapTriggerSource(source: TriggerSource): JobTriggerSource {
  switch (source) {
    case 'github-actions': return 'github_actions';
    case 'cron': return 'cron';
    case 'scheduler': return 'cron';
    default: return 'manual';
  }
}

/**
 * Handle all jobs routes
 */
export async function handleJobsRoutes(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const timer = new ProcessingTimer();
  const requestId = generateRequestId();
  const url = new URL(request.url);

  // Read-only endpoints are public, write endpoints require auth
  const isWriteEndpoint = path === '/api/v1/jobs/trigger' || path === '/api/v1/jobs/pre-market' || path === '/api/v1/jobs/intraday' || path.startsWith('/api/v1/jobs/runs/');

  if (isWriteEndpoint) {
    const authResult = validateApiKey(request, env);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify(ApiResponseFactory.error('API key required', 'UNAUTHORIZED', { requestId })),
        { status: HttpStatus.UNAUTHORIZED, headers }
      );
    }
  }

  try {
    // POST /api/v1/jobs/pre-market - Execute pre-market analysis job (protected)
    if (path === '/api/v1/jobs/pre-market' && request.method === 'POST') {
      return await handlePreMarketJob(request, env, headers, requestId, timer);
    }

    // POST /api/v1/jobs/intraday - Execute intraday analysis job (protected)
    if (path === '/api/v1/jobs/intraday' && request.method === 'POST') {
      return await handleIntradayJob(request, env, headers, requestId, timer);
    }

    // POST /api/v1/jobs/trigger - Manually trigger a scheduled job (protected)
    if (path === '/api/v1/jobs/trigger' && request.method === 'POST') {
      return await handleJobTrigger(request, env, headers, requestId, timer);
    }

    // GET /api/v1/jobs/history - Get job execution history (public)
    if (path === '/api/v1/jobs/history') {
      return await handleJobsHistory(env, url, headers, requestId, timer);
    }

    // GET /api/v1/jobs/latest - Get latest job results
    if (path === '/api/v1/jobs/latest') {
      return await handleJobsLatest(env, url, headers, requestId, timer);
    }

    // GET /api/v1/jobs/snapshots/:date/:type - Get specific report snapshot
    const snapshotMatch = path.match(/^\/api\/v1\/jobs\/snapshots\/(\d{4}-\d{2}-\d{2})\/(.+)$/);
    if (snapshotMatch) {
      const [, date, reportType] = snapshotMatch;
      return await handleJobSnapshot(env, date, reportType, headers, requestId, timer);
    }

    // GET /api/v1/jobs/runs - List all job runs (public)
    if (path === '/api/v1/jobs/runs' && request.method === 'GET') {
      return await handleJobRunsList(env, url, headers, requestId, timer);
    }

    // DELETE /api/v1/jobs/runs/:runId - Delete a job run (protected)
    const runDeleteMatch = path.match(/^\/api\/v1\/jobs\/runs\/([^/]+)$/);
    if (runDeleteMatch && request.method === 'DELETE') {
      const [, runId] = runDeleteMatch;
      return await handleDeleteJobRun(env, runId, headers, requestId, timer);
    }

    return new Response(
      JSON.stringify(ApiResponseFactory.error('Jobs endpoint not found', 'NOT_FOUND', { path })),
      { status: HttpStatus.NOT_FOUND, headers }
    );
  } catch (error) {
    logger.error('Jobs route error', { error: (error as Error).message, path });
    return new Response(
      JSON.stringify(ApiResponseFactory.error('Internal server error', 'INTERNAL_ERROR', { requestId })),
      { status: HttpStatus.INTERNAL_SERVER_ERROR, headers }
    );
  }
}

/**
 * GET /api/v1/jobs/history
 * Query params: ?limit=10&type=analysis
 */
async function handleJobsHistory(
  env: CloudflareEnvironment,
  url: URL,
  headers: Record<string, string>,
  requestId: string,
  timer: ProcessingTimer
): Promise<Response> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    return new Response(
      JSON.stringify(ApiResponseFactory.error('D1 database not available', 'DB_UNAVAILABLE', { requestId })),
      { status: HttpStatus.SERVICE_UNAVAILABLE, headers }
    );
  }

  const parsedLimit = parseInt(url.searchParams.get('limit') || '10');
  const limit = Math.min(Number.isNaN(parsedLimit) ? 10 : parsedLimit, 100);
  const jobType = url.searchParams.get('type');

  try {
    const query = jobType
      ? 'SELECT * FROM job_executions WHERE job_type = ? ORDER BY executed_at DESC LIMIT ?'
      : 'SELECT * FROM job_executions ORDER BY executed_at DESC LIMIT ?';
    
    const stmt = jobType ? db.prepare(query).bind(jobType, limit) : db.prepare(query).bind(limit);
    const result = await stmt.all();

    return new Response(
      JSON.stringify(ApiResponseFactory.success({
        jobs: result.results || [],
        count: result.results?.length || 0,
        limit
      }, { requestId, processingTime: timer.getElapsedMs() })),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    const errMsg = (error as Error).message;
    if (errMsg.includes('no such table')) {
      return new Response(
        JSON.stringify(ApiResponseFactory.success({ jobs: [], count: 0, message: 'job_executions table not found' }, { requestId })),
        { status: HttpStatus.OK, headers }
      );
    }
    throw error;
  }
}

/**
 * GET /api/v1/jobs/runs
 * List all job runs from job_run_results table
 * Query params: ?limit=50&date=2026-01-28&type=pre-market
 */
async function handleJobRunsList(
  env: CloudflareEnvironment,
  url: URL,
  headers: Record<string, string>,
  requestId: string,
  timer: ProcessingTimer
): Promise<Response> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    return new Response(
      JSON.stringify(ApiResponseFactory.error('D1 database not available', 'DB_UNAVAILABLE', { requestId })),
      { status: HttpStatus.SERVICE_UNAVAILABLE, headers }
    );
  }

  const parsedLimit = parseInt(url.searchParams.get('limit') || '50');
  const limit = Math.min(Number.isNaN(parsedLimit) ? 50 : parsedLimit, 200);
  const dateFilter = url.searchParams.get('date');
  const typeFilter = url.searchParams.get('type');

  try {
    let query = 'SELECT run_id, scheduled_date, report_type, status, current_stage, started_at, executed_at, trigger_source, created_at FROM job_run_results';
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (dateFilter) {
      conditions.push('scheduled_date = ?');
      params.push(dateFilter);
    }
    if (typeFilter) {
      conditions.push('report_type = ?');
      params.push(typeFilter);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(query).bind(...params);
    const result = await stmt.all();

    return new Response(
      JSON.stringify(ApiResponseFactory.success({
        runs: result.results || [],
        count: result.results?.length || 0,
        limit
      }, { requestId, processingTime: timer.getElapsedMs() })),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    const errMsg = (error as Error).message;
    if (errMsg.includes('no such table')) {
      return new Response(
        JSON.stringify(ApiResponseFactory.success({ runs: [], count: 0, message: 'job_run_results table not found' }, { requestId })),
        { status: HttpStatus.OK, headers }
      );
    }
    throw error;
  }
}

/**
 * DELETE /api/v1/jobs/runs/:runId
 * Delete a job run and its associated data (protected)
 */
async function handleDeleteJobRun(
  env: CloudflareEnvironment,
  runId: string,
  headers: Record<string, string>,
  requestId: string,
  timer: ProcessingTimer
): Promise<Response> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) {
    return new Response(
      JSON.stringify(ApiResponseFactory.error('D1 database not available', 'DB_UNAVAILABLE', { requestId })),
      { status: HttpStatus.SERVICE_UNAVAILABLE, headers }
    );
  }

  try {
    // Get run info first
    const runResult = await db.prepare('SELECT scheduled_date, report_type FROM job_run_results WHERE run_id = ?').bind(runId).first();
    if (!runResult) {
      return new Response(
        JSON.stringify(ApiResponseFactory.error('Run not found', 'NOT_FOUND', { runId })),
        { status: HttpStatus.NOT_FOUND, headers }
      );
    }

    // Delete in order: stage_log → scheduled_job_results → job_run_results
    await db.prepare('DELETE FROM job_stage_log WHERE run_id = ?').bind(runId).run();
    await db.prepare('DELETE FROM scheduled_job_results WHERE run_id = ?').bind(runId).run();
    await db.prepare('DELETE FROM job_run_results WHERE run_id = ?').bind(runId).run();

    // Update job_date_results to point to the next latest run (if any)
    const nextRun = await db.prepare(
      'SELECT run_id FROM job_run_results WHERE scheduled_date = ? AND report_type = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(runResult.scheduled_date, runResult.report_type).first<{ run_id: string }>();

    if (nextRun) {
      // Update to point to the next latest run
      const latestRunDetails = await db.prepare(
        'SELECT status, current_stage, started_at, executed_at, trigger_source FROM job_run_results WHERE run_id = ?'
      ).bind(nextRun.run_id).first();

      if (latestRunDetails) {
        await db.prepare(`
          UPDATE job_date_results
          SET latest_run_id = ?, status = ?, current_stage = ?, started_at = ?, executed_at = ?, trigger_source = ?, updated_at = datetime('now')
          WHERE scheduled_date = ? AND report_type = ?
        `).bind(
          nextRun.run_id,
          latestRunDetails.status,
          latestRunDetails.current_stage,
          latestRunDetails.started_at,
          latestRunDetails.executed_at,
          latestRunDetails.trigger_source,
          runResult.scheduled_date,
          runResult.report_type
        ).run();
      }
    } else {
      // No more runs - delete the date summary
      await db.prepare('DELETE FROM job_date_results WHERE scheduled_date = ? AND report_type = ?')
        .bind(runResult.scheduled_date, runResult.report_type).run();
    }

    logger.info('Deleted job run', { runId, scheduledDate: runResult.scheduled_date, reportType: runResult.report_type });

    return new Response(
      JSON.stringify(ApiResponseFactory.success({
        deleted: true,
        runId,
        scheduledDate: runResult.scheduled_date,
        reportType: runResult.report_type
      }, { requestId, processingTime: timer.getElapsedMs() })),
      { status: HttpStatus.OK, headers }
    );
  } catch (error) {
    logger.error('Failed to delete job run', { error: (error as Error).message, runId });
    throw error;
  }
}

/**
 * GET /api/v1/jobs/latest
 * Query params: ?type=analysis|intraday|end-of-day|weekly
 */
async function handleJobsLatest(
  env: CloudflareEnvironment,
  url: URL,
  headers: Record<string, string>,
  requestId: string,
  timer: ProcessingTimer
): Promise<Response> {
  const reportType = url.searchParams.get('type') || 'analysis';
  
  const snapshot = await getD1LatestReportSnapshot(env, reportType);
  
  if (snapshot) {
    return new Response(
      JSON.stringify(ApiResponseFactory.success({
        reportType,
        scheduledDate: snapshot.scheduledDate,
        data: snapshot.data
      }, { requestId, processingTime: timer.getElapsedMs() })),
      { status: HttpStatus.OK, headers }
    );
  }

  // Fallback to predictions if no snapshot
  const today = new Date().toISOString().split('T')[0];
  const predictions = await getD1Predictions(env, today);
  
  return new Response(
    JSON.stringify(ApiResponseFactory.success({
      reportType,
      scheduledDate: today,
      predictions: predictions || [],
      source: 'predictions_fallback'
    }, { requestId, processingTime: timer.getElapsedMs() })),
    { status: HttpStatus.OK, headers }
  );
}

/**
 * GET /api/v1/jobs/snapshots/:date/:type
 */
async function handleJobSnapshot(
  env: CloudflareEnvironment,
  date: string,
  reportType: string,
  headers: Record<string, string>,
  requestId: string,
  timer: ProcessingTimer
): Promise<Response> {
  const result = await readD1ReportSnapshot(env, date, reportType);
  
  if (result) {
    return new Response(
      JSON.stringify(ApiResponseFactory.success({
        date,
        reportType,
        data: result.data,
        createdAt: result.createdAt
      }, { requestId, processingTime: timer.getElapsedMs() })),
      { status: HttpStatus.OK, headers }
    );
  }

  return new Response(
    JSON.stringify(ApiResponseFactory.error('Snapshot not found', 'NOT_FOUND', { date, reportType, requestId })),
    { status: HttpStatus.NOT_FOUND, headers }
  );
}


/**
 * POST /api/v1/jobs/trigger
 * Body: { "triggerMode": "weekly_review_analysis" }
 * Valid modes: morning_prediction_alerts, midday_validation_prediction, 
 *              next_day_market_prediction, weekly_review_analysis, sector_rotation_refresh
 */
async function handleJobTrigger(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string,
  timer: ProcessingTimer
): Promise<Response> {
  let body: { triggerMode?: string; scheduledDate?: string } = {};
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify(ApiResponseFactory.error('Invalid JSON body', 'BAD_REQUEST', { requestId })),
      { status: HttpStatus.BAD_REQUEST, headers }
    );
  }

  const { triggerMode } = body;
  if (!triggerMode) {
    return new Response(
      JSON.stringify(ApiResponseFactory.error('triggerMode required', 'BAD_REQUEST', { 
        requestId,
        valid_modes: ['morning_prediction_alerts', 'midday_validation_prediction', 'next_day_market_prediction', 'weekly_review_analysis', 'sector_rotation_refresh']
      })),
      { status: HttpStatus.BAD_REQUEST, headers }
    );
  }

  logger.info('Manual job trigger', { triggerMode, requestId });

  // Derive scheduled time based on triggerMode (GitHub Actions manual triggers)
  const now = new Date();
  const { triggerMode: mode = '' } = body;
  const utcDate = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth(),
    day: now.getUTCDate(),
  };

  // Optional explicit scheduledDate (YYYY-MM-DD) to override "today"
  let scheduledDateOverride: Date | null = null;
  if (body.scheduledDate && typeof body.scheduledDate === 'string') {
    const [y, m, d] = body.scheduledDate.split('-').map((v: string) => parseInt(v, 10));
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      scheduledDateOverride = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    }
  }

  const cronTimes: Record<string, { hour: number; minute: number }> = {
    morning_prediction_alerts: { hour: 12, minute: 30 },          // 08:30 ET
    midday_validation_prediction: { hour: 16, minute: 0 },        // 12:00 ET
    next_day_market_prediction: { hour: 1, minute: 0 },           // example: 01:00 UTC (adjust if needed)
    weekly_review_analysis: { hour: 14, minute: 0 },              // example: 09:00 ET (adjust if needed)
    sector_rotation_refresh: { hour: 11, minute: 0 }              // example: 06:00 ET (adjust if needed)
  };

  const cronTime = cronTimes[mode] || null;
  const dateBase = scheduledDateOverride || new Date(Date.UTC(utcDate.year, utcDate.month, utcDate.day, 0, 0, 0));
  const scheduledTime = cronTime
    ? new Date(Date.UTC(dateBase.getUTCFullYear(), dateBase.getUTCMonth(), dateBase.getUTCDate(), cronTime.hour, cronTime.minute, 0))
    : now;

  const controller = { scheduledTime };
  const ctx = { waitUntil: (p: Promise<any>) => p, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;

  const result = await handleScheduledEvent(controller, env, ctx, triggerMode);
  const resultBody = await result.text();

  if (result.status !== 200) {
    return new Response(
      JSON.stringify(ApiResponseFactory.error(resultBody || 'Job execution failed', 'JOB_FAILED', { 
        triggerMode, 
        requestId, 
        processingTime: timer.getElapsedMs() 
      })),
      { status: result.status, headers }
    );
  }

  return new Response(
    JSON.stringify(ApiResponseFactory.success({
      triggerMode,
      result: resultBody
    }, { requestId, processingTime: timer.getElapsedMs() })),
    { status: HttpStatus.OK, headers }
  );
}

/**
 * POST /api/v1/jobs/pre-market
 * Execute pre-market analysis job
 * Body: { "symbols": ["AAPL", "MSFT", ...] } (optional, defaults to top 5)
 */
async function handlePreMarketJob(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string,
  timer: ProcessingTimer
): Promise<Response> {
  const dataBridge = createPreMarketDataBridge(env);

  // Declare scheduledDate outside try block so it's accessible in catch
  let scheduledDate = new Date().toISOString().split('T')[0];
  let runId: string | null = null;
  let runTrackingEnabled = false;
  let symbols: string[];

  // Clean up stale jobs (authenticated endpoint - safe to write)
  await markStaleJobsAsFailed(env);

  try {
    // Get portfolio symbols from DO (allows web-based management)
    const defaultSymbols = await getPortfolioSymbols(env);

    // Parse request body for optional symbols and date
    symbols = defaultSymbols;
    let targetDate: string | undefined = undefined; // Optional date for reruns

    try {
      const body = await request.json() as any;
      if (body.symbols && Array.isArray(body.symbols)) {
        symbols = body.symbols;
      }
      if (body.date && typeof body.date === 'string') {
        // Validate date format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
          targetDate = body.date;
        } else {
          logger.warn('Invalid date format provided, using today', { providedDate: body.date });
        }
      }
    } catch {
      // Use default symbols and date if body parsing fails
    }

    // Scheduled date: the job's planned/report date (can be past, present, or future)
    scheduledDate = targetDate || scheduledDate;

    // Detect trigger source for audit trail
    const triggerSource = detectTriggerSource(request);
    const navTriggerSource = mapTriggerSource(triggerSource);

    logger.info('PreMarketJob: Starting job execution', {
      symbols,
      scheduledDate,
      isRerun: !!targetDate,
      requestId
    });

    runId = await startJobRun(env, {
      scheduledDate,
      reportType: 'pre-market',
      triggerSource: navTriggerSource
    });
    runTrackingEnabled = !!runId;

    // Fallback: still execute the job even if run tracking is unavailable
    if (!runId) {
      await writeJobDateResult(env, {
        scheduledDate,
        reportType: 'pre-market',
        status: 'running',
        currentStage: 'init',
        triggerSource: navTriggerSource
      });
      runId = generateRunId(scheduledDate, 'pre-market');
    }

    if (runTrackingEnabled) {
      await startJobStage(env, { runId, scheduledDate, reportType: 'pre-market', stage: 'init' });
      await endJobStage(env, { runId, stage: 'init' });
    }

    // Start AI analysis stage
    if (runTrackingEnabled) {
      await startJobStage(env, { runId, scheduledDate, reportType: 'pre-market', stage: 'ai_analysis' });
    }

    // Execute pre-market analysis job with scheduled date for storage
    const analysisData = await dataBridge.refreshPreMarketAnalysis(symbols, scheduledDate);

    // End AI analysis stage
    if (runTrackingEnabled) {
      await endJobStage(env, { runId, stage: 'ai_analysis' });
    }

    // Build job result for D1 storage
    const jobResult = {
      date: scheduledDate, // Store under scheduled date
      job_type: 'pre-market',
      symbols_analyzed: Object.keys(analysisData.trading_signals).length,
      high_confidence_signals: Object.values(analysisData.trading_signals)
        .filter((signal: any) => (
          signal.confidence_metrics?.overall_confidence ??
          signal.enhanced_prediction?.confidence ??
          signal.sentiment_layers?.[0]?.confidence ??
          signal.confidence ??
          0
        ) > 0.7).length,
      trading_signals: analysisData.trading_signals,
      market_pulse: analysisData.market_pulse, // v3.10.0: SPY market sentiment
      generated_at: analysisData.generated_at,
      timestamp: analysisData.timestamp
    };

    // Start storage stage
    if (runTrackingEnabled) {
      await startJobStage(env, { runId, scheduledDate, reportType: 'pre-market', stage: 'storage' });
    }

    // Write to D1 with scheduled_date as primary key
    // - scheduled_date: the market date this report is FOR (primary key with report_type)
    // - created_at: when the report was generated (auto-set)
    const actualToday = new Date().toISOString().split('T')[0];

    // Warn if user provided a date but migration hasn't been applied
    if (targetDate && scheduledDate !== actualToday) {
      logger.warn('⚠️ Custom date parameter provided, but scheduled_date column may not exist. Run migration if reruns fail.', {
        providedDate: targetDate,
        scheduledDate,
        actualToday,
        requestId
      });
    }

    // One-shot cleanup: Delete old schema records for migration (controlled by env var)
    // TODO: Remove this after migration is complete and all old records are cleaned
    if (env.ENABLE_D1_CLEANUP === 'true') {
      logger.info('D1 cleanup enabled - deleting old records for scheduled date', { scheduledDate });
      await deleteD1ReportSnapshot(env, scheduledDate, 'pre-market');
    }

    const writeSuccess = await writeD1JobResult(
      env,
      scheduledDate,  // Primary key: the market date this report is FOR
      'pre-market',
      jobResult,
      {
        processingTimeMs: timer.getElapsedMs(),
        symbolsRequested: symbols,
        ai_models: {
          primary: '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
          secondary: '@cf/huggingface/distilbert-sst-2-int8'
        }
      },
      triggerSource,
      runId
    );

    // End storage stage
    if (runTrackingEnabled) {
      await endJobStage(env, { runId, stage: 'storage' });
    }

    if (!writeSuccess) {
      logger.error('Failed to write job result to D1', { scheduledDate, actualToday, requestId });
    }

    // Finalize stage
    if (runTrackingEnabled) {
      await startJobStage(env, { runId, scheduledDate, reportType: 'pre-market', stage: 'finalize' });
      await endJobStage(env, { runId, stage: 'finalize' });
    }

    // Mark job as success
    if (runTrackingEnabled) {
      if (writeSuccess) {
        await completeJobRun(env, {
          runId,
          scheduledDate,
          reportType: 'pre-market',
          status: 'success'
        });
      } else {
        await completeJobRun(env, {
          runId,
          scheduledDate,
          reportType: 'pre-market',
          status: 'failed',
          errors: ['Failed to write results to D1']
        });
      }
    } else {
      await writeJobDateResult(env, {
        scheduledDate,
        reportType: 'pre-market',
        status: writeSuccess ? 'success' : 'failed',
        currentStage: 'finalize',
        errors: writeSuccess ? undefined : ['Failed to write results to D1'],
        triggerSource: navTriggerSource
      });
    }

    const response = {
      success: true,
      job_type: 'pre-market',
      message: 'Pre-market job executed successfully',
      result: {
        symbols_analyzed: Object.keys(analysisData.trading_signals).length,
        high_confidence_signals: Object.values(analysisData.trading_signals)
          .filter((signal: any) => (
            signal.confidence_metrics?.overall_confidence ??
            signal.enhanced_prediction?.confidence ??
            signal.sentiment_layers?.[0]?.confidence ??
            signal.confidence ??
            0
          ) > 0.7).length,
        generated_at: analysisData.generated_at,
        symbols: symbols,
        // v3.10.0: Include market pulse status in response with dual model details
        market_pulse: analysisData.market_pulse ? {
          status: analysisData.market_pulse.status,
          direction: analysisData.market_pulse.direction,
          confidence: analysisData.market_pulse.confidence,
          articles_count: analysisData.market_pulse.articles_count,
          error: analysisData.market_pulse.error,
          dual_model: analysisData.market_pulse.dual_model
        } : null
      },
      processing_time_ms: timer.getElapsedMs(),
      timestamp: new Date().toISOString()
    };

    logger.info('PreMarketJob: Job execution completed', {
      symbols_count: Object.keys(analysisData.trading_signals).length,
      high_confidence_count: response.result.high_confidence_signals,
      processing_time: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(ApiResponseFactory.success(response, {
        requestId,
        processingTime: timer.getElapsedMs(),
      })),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('PreMarketJob Error', { error: error.message, scheduledDate, requestId });

    // Mark job as failed using the correct scheduledDate (outer scope)
    try {
      if (runTrackingEnabled && runId) {
        await completeJobRun(env, {
          runId,
          scheduledDate,
          reportType: 'pre-market',
          status: 'failed',
          errors: [error instanceof Error ? error.message : 'Unknown error']
        });
      } else {
        await writeJobDateResult(env, {
          scheduledDate,
          reportType: 'pre-market',
          status: 'failed',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          triggerSource: 'manual'
        });
      }
    } catch (e) {
      // Ignore - best effort
    }

    return new Response(
      JSON.stringify(ApiResponseFactory.error(
        'Failed to execute pre-market job',
        'JOB_ERROR',
        {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      )),
      { status: HttpStatus.INTERNAL_SERVER_ERROR, headers }
    );
  }
}

/**
 * POST /api/v1/jobs/intraday
 * Execute intraday analysis job
 */
async function handleIntradayJob(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string,
  timer: ProcessingTimer
): Promise<Response> {
  const today = new Date().toISOString().split('T')[0];
  const triggerSource = detectTriggerSource(request);
  const navTriggerSource = mapTriggerSource(triggerSource);
  let runId: string | null = null;
  let runTrackingEnabled = false;

  // Clean up stale jobs (authenticated endpoint - safe to write)
  await markStaleJobsAsFailed(env);

  try {
    const { IntradayDataBridge } = await import('../modules/intraday-data-bridge.js');
    const bridge = new IntradayDataBridge(env);

    logger.info('IntradayJob: Starting job execution', { requestId });

    runId = await startJobRun(env, {
      scheduledDate: today,
      reportType: 'intraday',
      triggerSource: navTriggerSource
    });
    runTrackingEnabled = !!runId;

    if (!runId) {
      await writeJobDateResult(env, {
        scheduledDate: today,
        reportType: 'intraday',
        status: 'running',
        currentStage: 'init',
        triggerSource: navTriggerSource
      });
      runId = generateRunId(today, 'intraday');
    }

    if (runTrackingEnabled) {
      await startJobStage(env, { runId, scheduledDate: today, reportType: 'intraday', stage: 'init' });
      await endJobStage(env, { runId, stage: 'init' });
    }

    // Start AI analysis stage
    if (runTrackingEnabled) {
      await startJobStage(env, { runId, scheduledDate: today, reportType: 'intraday', stage: 'ai_analysis' });
    }

    // Execute intraday analysis
    const analysisData = await bridge.generateIntradayAnalysis();

    // End AI analysis stage
    if (runTrackingEnabled) {
      await endJobStage(env, { runId, stage: 'ai_analysis' });
    }

    // Build job result for D1 storage (includes comparisons for new layout)
    const jobResult = {
      date: today,
      job_type: 'intraday',
      symbols_analyzed: analysisData.total_symbols,
      on_track_count: analysisData.on_track_count,
      diverged_count: analysisData.diverged_count,
      overall_accuracy: analysisData.overall_accuracy,
      market_status: analysisData.market_status,
      symbols: analysisData.symbols,
      comparisons: analysisData.comparisons,  // NEW: Side-by-side comparison data
      timestamp: analysisData.timestamp
    };

    // Start storage stage
    if (runTrackingEnabled) {
      await startJobStage(env, { runId, scheduledDate: today, reportType: 'intraday', stage: 'storage' });
    }

    // Write to D1
    await writeD1JobResult(env, today, 'intraday', jobResult, {
      processingTimeMs: timer.getElapsedMs(),
      symbolsAnalyzed: analysisData.total_symbols,
      accuracyRate: analysisData.overall_accuracy
    }, triggerSource, runId);

    // End storage stage
    if (runTrackingEnabled) {
      await endJobStage(env, { runId, stage: 'storage' });
    }

    // Finalize
    if (runTrackingEnabled) {
      await startJobStage(env, { runId, scheduledDate: today, reportType: 'intraday', stage: 'finalize' });
      await endJobStage(env, { runId, stage: 'finalize' });
    }

    // Mark job as success
    if (runTrackingEnabled) {
      await completeJobRun(env, {
        runId,
        scheduledDate: today,
        reportType: 'intraday',
        status: 'success'
      });
    } else {
      await writeJobDateResult(env, {
        scheduledDate: today,
        reportType: 'intraday',
        status: 'success',
        currentStage: 'finalize',
        triggerSource: navTriggerSource
      });
    }

    const response = {
      success: true,
      job_type: 'intraday',
      message: 'Intraday job executed successfully',
      result: {
        symbols_analyzed: analysisData.total_symbols,
        on_track: analysisData.on_track_count,
        diverged: analysisData.diverged_count,
        accuracy: analysisData.overall_accuracy,
        market_status: analysisData.market_status
      },
      processing_time_ms: timer.getElapsedMs(),
      timestamp: new Date().toISOString()
    };

    logger.info('IntradayJob: Job execution completed', {
      symbols_count: analysisData.total_symbols,
      accuracy: analysisData.overall_accuracy,
      processing_time: timer.getElapsedMs(),
      requestId
    });

    return new Response(
      JSON.stringify(ApiResponseFactory.success(response, {
        requestId,
        processingTime: timer.getElapsedMs(),
      })),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('IntradayJob Error', { error: error.message, requestId });

    // Mark job as failed
    try {
      if (runTrackingEnabled && runId) {
        await completeJobRun(env, {
          runId,
          scheduledDate: today,
          reportType: 'intraday',
          status: 'failed',
          errors: [error instanceof Error ? error.message : 'Unknown error']
        });
      } else {
        await writeJobDateResult(env, {
          scheduledDate: today,
          reportType: 'intraday',
          status: 'failed',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          triggerSource: navTriggerSource
        });
      }
    } catch (e) {
      // Ignore - best effort
    }

    return new Response(
      JSON.stringify(ApiResponseFactory.error(
        'Failed to execute intraday job',
        'JOB_ERROR',
        {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      )),
      { status: HttpStatus.INTERNAL_SERVER_ERROR, headers }
    );
  }
}
