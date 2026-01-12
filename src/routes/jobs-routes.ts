/**
 * Jobs Routes (API v1)
 * D1 query endpoints for job execution history and report snapshots
 */

import { ApiResponseFactory, ProcessingTimer, HttpStatus } from '../modules/api-v1-responses.js';
import { validateApiKey, generateRequestId } from './api-v1.js';
import { createLogger } from '../modules/logging.js';
import { handleScheduledEvent } from '../modules/scheduler.js';
import { getD1Predictions, getD1LatestReportSnapshot, readD1ReportSnapshot } from '../modules/d1-job-storage.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('jobs-routes');

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

  // Require API key
  const authResult = validateApiKey(request, env);
  if (!authResult.valid) {
    return new Response(
      JSON.stringify(ApiResponseFactory.error('API key required', 'UNAUTHORIZED', { requestId })),
      { status: HttpStatus.UNAUTHORIZED, headers }
    );
  }

  try {
    // POST /api/v1/jobs/trigger - Manually trigger a scheduled job
    if (path === '/api/v1/jobs/trigger' && request.method === 'POST') {
      return await handleJobTrigger(request, env, headers, requestId, timer);
    }

    // GET /api/v1/jobs/history - Get job execution history
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
        executionDate: snapshot.executionDate,
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
      executionDate: today,
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
  const snapshot = await readD1ReportSnapshot(env, date, reportType);
  
  if (snapshot) {
    return new Response(
      JSON.stringify(ApiResponseFactory.success({
        date,
        reportType,
        data: snapshot
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
  let body: { triggerMode?: string } = {};
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

  const controller = { scheduledTime: new Date() };
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
