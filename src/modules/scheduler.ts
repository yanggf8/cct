/**
 * Cron Scheduler Module - TypeScript
 * Handles all scheduled events (cron triggers) - fully modular
 */

import { runPreMarketAnalysis, runWeeklyMarketCloseAnalysis } from './analysis.js';
import { AI_MODEL_DISPLAY } from './config.js';
import { runEnhancedAnalysis, runEnhancedPreMarketAnalysis } from './enhanced_analysis.js';
import { generateWeeklyReviewAnalysis } from './report/weekly-review-analysis.js';
import { performSectorRotationAnalysis } from './sector-rotation-workflow.js';
import { KVUtils } from './shared-utilities.js';
import { initializeRealTimeDataManager } from './real-time-data-manager.js';
// Facebook imports removed - migrated to Chrome web notifications
// No-op stubs for compatibility
import { sendWeeklyReviewWithTracking } from './handlers/weekly-review-handlers.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
import { writeD1JobResult, startJobRun, completeJobRun, startJobStage, endJobStage, generateRunId, getD1FallbackData, readD1ReportSnapshotByRunId } from './d1-job-storage.js';
import type { JobTriggerSource } from './d1-job-storage.js';
import type { CloudflareEnvironment } from '../types.js';

/**
 * Type Definitions
 */

export interface ScheduledController {
  scheduledTime: number | string | Date;
  cron?: string;
}

export interface AnalysisResult {
  symbols_analyzed?: string[] | number;
  trading_signals?: Record<string, any>;
  timestamp?: string;
  trigger_mode?: string;
  cron_execution_id?: string;
  last_updated?: string;
  [key: string]: any;
}

export interface CronResponse {
  success: boolean;
  trigger_mode?: string;
  symbols_analyzed?: number;
  execution_id?: string;
  timestamp?: string;
  error?: string;
  diagnostics?: {
    dateStrUsed?: string;
    scheduledTimeUTC?: string;
    etTimeFormatted?: string;  // Properly formatted ET time (America/New_York)
    failureReason?: string;
  };
}

/**
 * Extract EST/EDT date string (YYYY-MM-DD) from a UTC timestamp
 * This correctly handles the timezone conversion to get the business date in America/New_York
 */
function getESTDateString(utcDate: Date): string {
  // Format in America/New_York timezone to get correct business date
  const estFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return estFormatter.format(utcDate); // Returns YYYY-MM-DD format
}

/**
 * Format a UTC date as an ISO-like string in America/New_York timezone
 * Returns format: YYYY-MM-DDTHH:MM:SS (no Z suffix, represents ET local time)
 */
function formatAsET(utcDate: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  // Format returns "YYYY-MM-DD, HH:MM:SS" - convert to ISO-like format
  const parts = formatter.format(utcDate).replace(', ', 'T');
  return parts;
}

/**
 * Get hour/minute in America/New_York timezone for logging
 */
function getETTimeParts(utcDate: Date): { hour: number; minute: number; dayOfWeek: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false
  });
  const parts = formatter.formatToParts(utcDate);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const weekdayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  const dayOfWeek = weekdayMap[parts.find(p => p.type === 'weekday')?.value || 'Sun'] || 0;
  return { hour, minute, dayOfWeek };
}

export interface SlackAlert {
  text: string;
  attachments?: Array<{
    color: string;
    fields: Array<{
      title: string;
      value: string;
      short: boolean;
    }>;
  }>;
}

// Valid trigger modes for manual invocation
const VALID_TRIGGER_MODES = [
  'morning_prediction_alerts',
  'midday_validation_prediction', 
  'next_day_market_prediction',
  'weekly_review_analysis',
  'sector_rotation_refresh'
] as const;

const TRIGGER_MODE_HORIZONS: Record<string, number[]> = {
  'morning_prediction_alerts': [1, 24],
  'midday_validation_prediction': [8, 24],
  'next_day_market_prediction': [17, 24],
  'weekly_review_analysis': [],
  'sector_rotation_refresh': []
};

/**
 * Handle scheduled cron events
 * @param controller - Cron controller with scheduledTime
 * @param env - Cloudflare environment
 * @param ctx - Execution context
 * @param overrideTriggerMode - Optional: bypass time detection and run specific job
 */
export async function handleScheduledEvent(
  controller: ScheduledController,
  env: CloudflareEnvironment,
  ctx: ExecutionContext,
  overrideTriggerMode?: string,
  triggerSourceOverride?: JobTriggerSource
): Promise<Response> {
  const scheduledTime = new Date(controller.scheduledTime);
  const cronExecutionId = `cron_${Date.now()}`;
  const runTriggerSource: JobTriggerSource = triggerSourceOverride ?? 'cron';
  let triggerMode: string;
  let predictionHorizons: number[];
  let runId: string | null = null;
  let runTrackingEnabled = false;
  let intradayRunId: string | null = null;
  let intradayRunTrackingEnabled = false;
  let intradayHasEmptySymbols = false;  // Track if intraday has no pre-market data (for partial status)

  // Use override if provided and valid
  if (overrideTriggerMode) {
    if (!VALID_TRIGGER_MODES.includes(overrideTriggerMode as any)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid trigger mode', 
        valid_modes: VALID_TRIGGER_MODES 
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    triggerMode = overrideTriggerMode;
    predictionHorizons = TRIGGER_MODE_HORIZONS[triggerMode] || [];
    console.log(`🔧 [MANUAL-CRON] ${cronExecutionId} Running manual trigger: ${triggerMode}`);
  } else {
    // Get the scheduled time in UTC for cron matching (fixed UTC times, ET varies with DST)
    const utcHour = scheduledTime.getUTCHours();
    const utcMinute = scheduledTime.getUTCMinutes();
    const utcDay = scheduledTime.getUTCDay();

    // Get ET time for logging using proper timezone-aware formatting
    const etParts = getETTimeParts(scheduledTime);

    console.log(`🕐 [PRODUCTION-CRON] UTC: ${utcHour}:${utcMinute.toString().padStart(2, '0')} (Day ${utcDay}) | ET: ${etParts.hour}:${etParts.minute.toString().padStart(2, '0')} (Day ${etParts.dayOfWeek}) | Scheduled: ${scheduledTime.toISOString()}`);

    // Determine trigger mode based on UTC schedule
    if (utcHour === 12 && utcMinute === 30 && utcDay >= 1 && utcDay <= 5) {
      triggerMode = 'morning_prediction_alerts';
      predictionHorizons = [1, 24];
    } else if (utcHour === 16 && utcMinute === 0 && utcDay >= 1 && utcDay <= 5) {
      triggerMode = 'midday_validation_prediction';
      predictionHorizons = [8, 24];
    } else if (utcHour === 20 && utcMinute === 5 && utcDay >= 1 && utcDay <= 5) {
      triggerMode = 'next_day_market_prediction';
      predictionHorizons = [17, 24];
    } else if (utcHour === 14 && utcMinute === 0 && utcDay === 0) {
      triggerMode = 'weekly_review_analysis';
      predictionHorizons = [];
    } else if (utcHour === 13 && utcMinute === 30 && utcDay >= 1 && utcDay <= 5) {
      triggerMode = 'sector_rotation_refresh';
      predictionHorizons = [];
    } else {
      console.log(`⚠️ [CRON] Unrecognized schedule: UTC ${utcHour}:${utcMinute} (Day ${utcDay}) | ET: ${etParts.hour}:${etParts.minute} (Day ${etParts.dayOfWeek})`);
      return new Response('Unrecognized cron schedule', { status: 400 });
    }
  }

  // ET-formatted timestamp for logging (use scheduledTime.toISOString() for consistent UTC storage)
  const estTimeFormatted = formatAsET(scheduledTime);

  console.log(`✅ [CRON-START] ${cronExecutionId}`, {
    trigger_mode: triggerMode,
    est_time: estTimeFormatted,
    utc_time: scheduledTime.toISOString(),
    prediction_horizons: predictionHorizons
  });

  try {
    let analysisResult: AnalysisResult | null = null;
    let analysisFailureReason: string | null = null;
    const dateStr = getESTDateString(scheduledTime);

    // Real-time Data Manager integration for live data freshness and cache warming
    try {
      const rtdm = initializeRealTimeDataManager(env);
      if (triggerMode === 'morning_prediction_alerts') {
        await rtdm.warmCachesForMarketOpen(undefined, ctx);
        await rtdm.refreshAll({ priority: 'high', reason: 'pre_market' }, ctx);
      } else if (triggerMode === 'midday_validation_prediction') {
        await rtdm.refreshIncremental(ctx);
      } else if (triggerMode === 'next_day_market_prediction') {
        await rtdm.refreshAll({ priority: 'normal', reason: 'end_of_day', incremental: true }, ctx);
      } else if (triggerMode === 'weekly_review_analysis') {
        await rtdm.refreshAll({ priority: 'low', reason: 'weekly' }, ctx);
      } else if (triggerMode === 'sector_rotation_refresh') {
        await rtdm.refreshAll({ priority: 'normal', reason: 'intraday', incremental: true }, ctx);
      }
    } catch (rtdmError: any) {
      console.warn('Real-time Data Manager update failed (continuing with scheduled task):', rtdmError?.message || rtdmError);
    }

    if (triggerMode === 'weekly_review_analysis') {
      // Sunday 14:00 UTC (9:00 AM ET / 10:00 AM EDT) - Weekly Review Analysis
      console.log(`📊 [CRON-WEEKLY] ${cronExecutionId} Generating weekly review analysis`);

      // Start multi-run tracking
      const runId = await startJobRun(env, {
        scheduledDate: dateStr,
        reportType: 'weekly',
        triggerSource: runTriggerSource
      });
      const runTrackingEnabled = !!runId;

      // Fallback if run tracking unavailable
      if (!runId) {
        console.warn(`⚠️ [CRON-WEEKLY] ${cronExecutionId} Run tracking unavailable, using fallback`);
      }

      if (runTrackingEnabled) {
        await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'weekly', stage: 'init' });
        await endJobStage(env, { runId, stage: 'init' });
        await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'weekly', stage: 'ai_analysis' });
      }

      // Use current Sunday as week anchor - getLastTradingDays() will look back
      // to find the Mon-Fri that just completed. This aligns with the UI's
      // getWeekSunday() which also returns the current Sunday.
      const weekSunday = new Date(scheduledTime);
      // Note: Do NOT subtract 7 days here. The analysis functions already look
      // back from the anchor date to find the previous trading week (Mon-Fri).

      // Generate weekly analysis result for that week
      analysisResult = await generateWeeklyReviewAnalysis(env as any, weekSunday);

      // Check generation status for failure visibility
      const genMeta = (analysisResult as any)?._generation;
      const genStatus = genMeta?.status || 'unknown';
      const genErrors = genMeta?.errors || [];
      const genWarnings = genMeta?.warnings || [];

      console.log(`📊 [CRON-WEEKLY] ${cronExecutionId} Generation status: ${genStatus}`, {
        tradingDaysFound: genMeta?.tradingDaysFound,
        dataSource: genMeta?.dataSource,
        errors: genErrors,
        warnings: genWarnings
      });

      if (runTrackingEnabled) {
        await endJobStage(env, { runId, stage: 'ai_analysis' });
      }

      console.log(`📱 [CRON-FB-WEEKLY] ${cronExecutionId} Sending weekly review via Facebook`);
      await sendWeeklyReviewWithTracking(analysisResult, env, cronExecutionId);
      console.log(`✅ [CRON-FB-WEEKLY] ${cronExecutionId} Weekly Facebook message completed`);

      // Map generation status to job status
      // 'success' -> 'done', 'partial' -> 'partial', 'failed'/'default' -> 'failed'
      let jobStatus: 'done' | 'partial' | 'failed' = 'done';
      if (genStatus === 'partial') {
        jobStatus = 'partial';
        console.warn(`⚠️ [CRON-WEEKLY] ${cronExecutionId} Weekly review completed with PARTIAL data`);
      } else if (genStatus === 'failed' || genStatus === 'default') {
        jobStatus = 'failed';
        console.error(`❌ [CRON-WEEKLY] ${cronExecutionId} Weekly review FAILED - using default data`);
      }

      console.log(`${jobStatus === 'done' ? '✅' : jobStatus === 'partial' ? '⚠️' : '❌'} [CRON-COMPLETE-WEEKLY] ${cronExecutionId} Weekly review analysis completed with status: ${jobStatus}`);

      // Start storage stage
      if (runTrackingEnabled) {
        await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'weekly', stage: 'storage' });
      }

      // Write weekly report to scheduled_job_results table for frontend retrieval
      try {
        const d1Written = await writeD1JobResult(env, dateStr, 'weekly', {
          ...analysisResult,
          cron_execution_id: cronExecutionId,
          trigger_mode: triggerMode,
          generated_at: scheduledTime.toISOString(),
          job_status: jobStatus,
          _generation: genMeta
        }, {
          processingTimeMs: Date.now() - scheduledTime.getTime(),
          generation_status: genStatus,
          errors: genErrors,
          warnings: genWarnings
        }, 'cron', runTrackingEnabled ? runId : undefined);
        console.log(`✅ [CRON-D1] ${cronExecutionId} D1 snapshot written: weekly for ${dateStr}, success: ${d1Written}`);
      } catch (d1Error: any) {
        console.error(`❌ [CRON-D1-ERROR] ${cronExecutionId} D1 weekly write failed:`, {
          error: d1Error.message,
          stack: d1Error.stack,
          dateStr
        });
        // Continue execution even if D1 fails
      }

      // End storage stage and complete job
      if (runTrackingEnabled) {
        await endJobStage(env, { runId, stage: 'storage' });
        await completeJobRun(env, {
          runId,
          scheduledDate: dateStr,
          reportType: 'weekly',
          status: jobStatus === 'done' ? 'success' : jobStatus === 'partial' ? 'partial' : 'failed',
          warnings: genWarnings.length > 0 ? genWarnings : undefined,
          errors: genErrors.length > 0 ? genErrors : undefined
        });
      }

      const statusMessage = jobStatus === 'done'
        ? 'Weekly review analysis completed successfully'
        : jobStatus === 'partial'
        ? `Weekly review completed with partial data: ${genWarnings.join(', ')}`
        : `Weekly review failed: ${genErrors.join(', ')}`;

      return new Response(statusMessage, { status: jobStatus === 'failed' ? 500 : 200 });

    } else if (triggerMode === 'sector_rotation_refresh') {
      // 9:30 AM EST - Sector Rotation Data Refresh
      console.log(`🔄 [CRON-SECTORS] ${cronExecutionId} Refreshing sector rotation data`);

      // Start multi-run tracking for sector-rotation
      const sectorRunId = await startJobRun(env, {
        scheduledDate: dateStr,
        reportType: 'sector-rotation',
        triggerSource: runTriggerSource
      });
      const sectorRunTrackingEnabled = !!sectorRunId;

      let sectorStatus: 'success' | 'failed' = 'success';
      let sectorErrors: string[] = [];

      try {
        // Perform sector rotation analysis
        const sectorResult = await performSectorRotationAnalysis(env, {
          triggerMode,
          currentTime: scheduledTime,
          cronExecutionId
        });

        if (sectorResult) {
          console.log(`✅ [CRON-SECTORS] ${cronExecutionId} Sector rotation data refreshed successfully`, {
            sectors_analyzed: (sectorResult as any).sectors?.length || 0,
            top_performer: (sectorResult as any).summary?.topPerformer,
            worst_performer: (sectorResult as any).summary?.worstPerformer
          });
        } else {
          console.log(`⚠️ [CRON-SECTORS] ${cronExecutionId} Sector rotation analysis returned null`);
          sectorStatus = 'failed';
          sectorErrors.push('Sector rotation analysis returned null');
        }
      } catch (sectorError: any) {
        console.error(`❌ [CRON-SECTORS] ${cronExecutionId} Sector rotation refresh failed:`, {
          error: sectorError.message,
          stack: sectorError.stack
        });
        sectorStatus = 'failed';
        sectorErrors.push(sectorError.message);
        // Continue execution - sector refresh failure is not critical
      }

      // Complete multi-run tracking
      if (sectorRunTrackingEnabled && sectorRunId) {
        await completeJobRun(env, {
          runId: sectorRunId,
          scheduledDate: dateStr,
          reportType: 'sector-rotation',
          status: sectorStatus,
          errors: sectorErrors.length > 0 ? sectorErrors : undefined
        });
        console.log(`✅ [CRON-SECTORS] ${cronExecutionId} Job run recorded: ${sectorRunId} (${sectorStatus})`);
      }

      console.log(`✅ [CRON-COMPLETE-SECTORS] ${cronExecutionId} Sector rotation refresh completed`);

      return new Response('Sector rotation refresh completed successfully', { status: 200 });

    } else if (triggerMode === 'midday_validation_prediction') {
      // Intraday Performance Check
      console.log(`📊 [CRON-INTRADAY] ${cronExecutionId} Generating intraday analysis`);

      // Start multi-run tracking for intraday
      intradayRunId = await startJobRun(env, {
        scheduledDate: dateStr,
        reportType: 'intraday',
        triggerSource: runTriggerSource
      });
      intradayRunTrackingEnabled = !!intradayRunId;

      try {
        const { IntradayDataBridge } = await import('./intraday-data-bridge.js');
        const bridge = new IntradayDataBridge(env);
        const intradayResult = await bridge.generateIntradayAnalysis();

        // Validate intradayResult before creating analysisResult
        if (!intradayResult || !intradayResult.symbols || !Array.isArray(intradayResult.symbols)) {
          throw new Error(`Invalid intraday result: ${JSON.stringify(intradayResult)}`);
        }

        // Handle empty symbols array gracefully (no pre-market data available)
        // Mark as partial status - job ran but produced no useful data
        if (intradayResult.symbols.length === 0) {
          console.warn(`⚠️ [CRON-INTRADAY] ${cronExecutionId} Intraday analysis produced no symbols - empty pre-market data`);
          intradayHasEmptySymbols = true;  // Flag for partial status
          // Create valid empty result structure
          analysisResult = {
            symbols: [],
            symbols_analyzed: 0,
            symbols_list: [],
            overall_accuracy: 0,
            on_track_count: 0,
            diverged_count: 0,
            timestamp: intradayResult.timestamp || new Date().toISOString(),
            trigger_mode: triggerMode,
            market_status: intradayResult.market_status || 'unknown',
            message: intradayResult.message || 'No intraday data available. No pre-market analysis found.',
            pre_market_run_id: intradayResult.pre_market_run_id || null
          };
        } else {
          // Check if all comparisons are incomplete (either no intraday data OR no pre-market data)
          const allIncomplete = intradayResult.comparisons?.every((comp: any) => 
            comp.comparison?.status === 'incomplete' || 
            comp.intraday?.status === 'failed' ||
            comp.intraday?.articles_count === 0 ||
            comp.premarket?.status === 'failed' ||
            comp.premarket?.error
          );
          
          if (allIncomplete) {
            console.warn(`⚠️ [CRON-INTRADAY] ${cronExecutionId} All comparisons incomplete - missing pre-market or intraday data`);
            intradayHasEmptySymbols = true;  // Flag for partial status
          }

          // Transform to scheduler expected shape
          // Note: symbols_analyzed must be a number (not array) to match intraday UI expectations
          // and be consistent with /api/v1/jobs/intraday endpoint
          analysisResult = {
            ...intradayResult,
            symbols_analyzed: intradayResult.symbols.length, // Store as number, not array
            symbols_list: intradayResult.symbols.map(s => s.symbol), // Keep symbols array in separate field
            timestamp: intradayResult.timestamp,
            trigger_mode: triggerMode,
            pre_market_run_id: intradayResult.pre_market_run_id || null  // NEW: Track pre-market source
          };
        }

        console.log(`✅ [CRON-INTRADAY] ${cronExecutionId} Intraday analysis completed`, {
          symbols_count: intradayResult.symbols.length,
          overall_accuracy: intradayResult.overall_accuracy,
          on_track_count: intradayResult.on_track_count,
          diverged_count: intradayResult.diverged_count
        });

        // Note: completeJobRun() will be called after D1 write in shared section
      } catch (intradayError: any) {
        console.error(`❌ [CRON-INTRADAY] ${cronExecutionId} Intraday analysis failed:`, {
          error: intradayError.message,
          stack: intradayError.stack
        });
        // Set analysisResult to null to ensure fail-fast check works
        analysisResult = null;

        // Complete multi-run tracking with failure
        if (intradayRunTrackingEnabled && intradayRunId) {
          await completeJobRun(env, {
            runId: intradayRunId,
            scheduledDate: dateStr,
            reportType: 'intraday',
            status: 'failed',
            errors: [intradayError.message]
          });
          console.log(`✅ [CRON-INTRADAY] ${cronExecutionId} Job run recorded: ${intradayRunId} (failed)`);
        }
      }

      // Facebook messaging has been migrated to Chrome web notifications
      console.log(`📱 [CRON-FB] ${cronExecutionId} Facebook messaging disabled - using web notifications instead`);

      // If intraday analysis failed and produced no result, treat as failure
      if (!analysisResult) {
        console.error(`❌ [CRON-INTRADAY] ${cronExecutionId} Intraday analysis did not produce a valid result`);

        const errorResponse: CronResponse = {
          success: false,
          trigger_mode: triggerMode,
          error: 'Intraday analysis failed - no valid result generated',
          execution_id: cronExecutionId,
          timestamp: scheduledTime.toISOString()
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

    } else if (triggerMode === 'next_day_market_prediction') {
      // End-of-Day Summary (~4:05 PM ET)
      console.log(`🏁 [CRON-EOD] ${cronExecutionId} Generating end-of-day analysis`);

      // Start multi-run tracking
      const runId = await startJobRun(env, {
        scheduledDate: dateStr,
        reportType: 'end-of-day',
        triggerSource: runTriggerSource
      });
      const runTrackingEnabled = !!runId;

      if (!runId) {
        console.warn(`⚠️ [CRON-EOD] ${cronExecutionId} Run tracking unavailable, using fallback`);
      }

      // Declare variables outside try block for access in catch block diagnostics
      let analysisData: any = null;
      let intradayData: any = null;
      let preMarketRunId: string | null = null;
      let intradayRunIdSource: string | null = null;

      if (runTrackingEnabled) {
        await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'end-of-day', stage: 'init' });
        await endJobStage(env, { runId, stage: 'init' });
        await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'end-of-day', stage: 'data_fetch' });
      }

      try {
        const { generateEndOfDayAnalysis } = await import('./report/end-of-day-analysis.js');

        // Fetch morning predictions from D1 only (no KV cache)
        console.log(`⚠️ [CRON-EOD] ${cronExecutionId} Fetching pre-market data from D1...`);
        const d1Fallback = await getD1FallbackData(env, dateStr, 'pre-market');
        if (d1Fallback?.data) {
          analysisData = d1Fallback.data;
          preMarketRunId = d1Fallback.runId || null;
          console.log(`✅ [CRON-EOD] ${cronExecutionId} Pre-market data from D1 (source: ${d1Fallback.source}, run_id: ${preMarketRunId || 'unknown'})`);
        }

        // Fetch intraday data from D1 only (no KV cache)
        const intradayD1Fallback = await getD1FallbackData(env, dateStr, 'intraday');
        if (intradayD1Fallback?.data) {
          intradayData = intradayD1Fallback.data;
          intradayRunIdSource = intradayD1Fallback.runId || null;
          console.log(`✅ [CRON-EOD] ${cronExecutionId} Intraday data from D1 (source: ${intradayD1Fallback.source}, run_id: ${intradayRunIdSource || 'unknown'})`);
        }

        // Validate required inputs so failures are explicit (not silent zero-signal runs)
        const missingInputs: string[] = [];
        if (!analysisData) missingInputs.push('morning analysis (cache miss + D1 fallback failed)');
        if (!analysisData?.trading_signals) missingInputs.push('morning predictions (trading_signals missing in data)');
        if (missingInputs.length) {
          throw new Error(`Missing required data for end-of-day analysis: ${missingInputs.join(', ')}`);
        }
        if (!intradayData) {
          console.warn(`⚠️ [CRON-EOD] ${cronExecutionId} Intraday data missing for ${dateStr}; continuing with morning-only data`);
        }

        if (runTrackingEnabled) {
          await endJobStage(env, { runId, stage: 'data_fetch' });
          await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'end-of-day', stage: 'ai_analysis' });
        }
        
        // Morning predictions from pre-market
        const morningPredictions = analysisData?.trading_signals || null;

        const eodResult = await generateEndOfDayAnalysis(analysisData, morningPredictions, intradayData, env);

        if (!eodResult) {
          throw new Error('End-of-day analysis returned null');
        }

        if (runTrackingEnabled) {
          await endJobStage(env, { runId, stage: 'ai_analysis' });
        }

        // Normalize to scheduler expected shape
        const signalsCount = eodResult.totalSignals || eodResult.signalBreakdown?.length || 0;
        analysisResult = {
          ...eodResult,
          symbols_analyzed: signalsCount,
          symbols_list: eodResult.signalBreakdown?.map((s: any) => s.ticker) || [],
          timestamp: scheduledTime.toISOString(),
          trigger_mode: triggerMode,
          pre_market_run_id: preMarketRunId || null,
          intraday_run_id: intradayRunIdSource || null
        };

        console.log(`✅ [CRON-EOD] ${cronExecutionId} End-of-day analysis completed`, {
          signals_count: signalsCount,
          accuracy_rate: eodResult.overallAccuracy
        });

        // Write to D1 for report retrieval
        if (runTrackingEnabled) {
          await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'end-of-day', stage: 'storage' });
        }

        try {
          await writeD1JobResult(env, dateStr, 'end-of-day', analysisResult, {
            processingTimeMs: Date.now() - scheduledTime.getTime(),
            signalsCount,
            accuracyRate: eodResult.overallAccuracy,
            // Track source run IDs for lineage/debugging
            pre_market_run_id: preMarketRunId || null,
            intraday_run_id: intradayRunIdSource || null
          }, 'cron', runTrackingEnabled ? runId : undefined);
          console.log(`✅ [CRON-D1] ${cronExecutionId} D1 snapshot written: end-of-day for ${dateStr} (pre-market: ${preMarketRunId || 'unknown'}, intraday: ${intradayRunIdSource || 'none'})`);
        } catch (d1Error: any) {
          console.error(`❌ [CRON-D1-ERROR] ${cronExecutionId} D1 end-of-day write failed:`, {
            error: d1Error.message
          });
        }

        if (runTrackingEnabled) {
          await endJobStage(env, { runId, stage: 'storage' });
        }

        // Complete job successfully
        if (runTrackingEnabled) {
          await completeJobRun(env, {
            runId,
            scheduledDate: dateStr,
            reportType: 'end-of-day',
            status: 'success'
          });
        }

      } catch (eodError: any) {
        // Diagnostic info for debugging - log full details, expose minimal to HTTP response
        const fullDiagnostics = {
          error: eodError.message,
          stack: eodError.stack,  // Keep in logs only
          dateCalculation: {
            scheduledTimeUTC: scheduledTime.toISOString(),
            etTimeFormatted: estTimeFormatted,
            dateStrUsed: dateStr
          },
          dataStatus: {
            hasAnalysisData: !!analysisData,
            hasTradingSignals: !!analysisData?.trading_signals,
            hasIntradayData: !!intradayData,
            preMarketRunId: preMarketRunId || null,
            intradayRunId: intradayRunIdSource || null
          }
        };

        console.error(`❌ [CRON-EOD] ${cronExecutionId} End-of-day analysis failed:`, fullDiagnostics);
        analysisResult = null;

        // Store compact failure reason for D1 (no stack trace)
        analysisFailureReason = `dateStr=${dateStr}, hasPreMarket=${!!analysisData}, hasTradingSignals=${!!analysisData?.trading_signals}`;

        // Complete job with failure and compact diagnostics (no stack in D1)
        if (runTrackingEnabled) {
          await completeJobRun(env, {
            runId,
            scheduledDate: dateStr,
            reportType: 'end-of-day',
            status: 'failed',
            errors: [eodError.message, analysisFailureReason]
          });
        }
      }

      // If end-of-day failed, write failure status and stop before generic writer runs
      if (!analysisResult) {
        // Minimal error response - no stack traces, detailed diagnostics only if DEBUG_DIAGNOSTICS enabled
        const showDetailedDiagnostics = env.DEBUG_DIAGNOSTICS === 'true';

        const errorResponse: CronResponse = {
          success: false,
          trigger_mode: triggerMode,
          error: 'End-of-day analysis failed - no valid result generated',
          execution_id: cronExecutionId,
          timestamp: scheduledTime.toISOString(),
          // Only include diagnostics if explicitly enabled via env var
          ...(showDetailedDiagnostics && {
            diagnostics: {
              dateStrUsed: dateStr,
              scheduledTimeUTC: scheduledTime.toISOString(),
              etTimeFormatted: estTimeFormatted,
              failureReason: analysisFailureReason || 'Unknown'
            }
          })
        };

        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

    } else {
      // Enhanced pre-market analysis with sentiment (morning_prediction_alerts)
      console.log(`🚀 [CRON-ENHANCED] ${cronExecutionId} Running enhanced analysis with sentiment...`);

      // Start multi-run tracking
      runId = await startJobRun(env, {
        scheduledDate: dateStr,
        reportType: 'pre-market',
        triggerSource: runTriggerSource
      });
      runTrackingEnabled = !!runId;

      if (!runId) {
        console.warn(`⚠️ [CRON-PRE-MARKET] ${cronExecutionId} Run tracking unavailable, using fallback`);
      }

      if (runTrackingEnabled) {
        await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'pre-market', stage: 'init' });
        await endJobStage(env, { runId, stage: 'init' });
        await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'pre-market', stage: 'ai_analysis' });
      }

      try {
        analysisResult = await runEnhancedPreMarketAnalysis(env, {
          triggerMode,
          predictionHorizons,
          currentTime: scheduledTime,
          cronExecutionId,
          jobContext: {
            job_type: 'pre-market',
            run_id: runId || undefined
          }
        });

        if (runTrackingEnabled) {
          await endJobStage(env, { runId, stage: 'ai_analysis' });
        }

        // Facebook messaging has been migrated to Chrome web notifications
        console.log(`📱 [CRON-FB] ${cronExecutionId} Facebook messaging disabled - using web notifications instead`);
      } catch (preMarketError: any) {
        console.error(`❌ [CRON-PRE-MARKET] ${cronExecutionId} Pre-market analysis failed:`, {
          error: preMarketError.message,
          stack: preMarketError.stack
        });
        analysisResult = null;
        analysisFailureReason = `Pre-market analysis threw exception: ${preMarketError.message}`;

        // End dangling ai_analysis stage (try-path's endJobStage didn't execute)
        if (runTrackingEnabled) {
          await endJobStage(env, { runId, stage: 'ai_analysis', status: 'failed', errors: [preMarketError.message] });
        }
        // Fall through: null analysisResult handled by else-if at line ~889
      }
    }

    // Validate pre-market result has actual usable signals (catch truthy-but-junk results)
    if (analysisResult && triggerMode === 'morning_prediction_alerts') {
      const symbolsAnalyzed = analysisResult.symbols_analyzed;
      const symbolsCount = Array.isArray(symbolsAnalyzed)
        ? symbolsAnalyzed.length
        : (typeof symbolsAnalyzed === 'number' ? symbolsAnalyzed : 0);

      const tradingSignals = analysisResult.trading_signals;
      const signalList = (tradingSignals && typeof tradingSignals === 'object')
        ? Object.values(tradingSignals)
        : [];

      const totalSignals = signalList.length;
      const usableSignals = signalList.filter((signal: any) => {
        const direction = (signal?.enhanced_prediction?.direction ?? signal?.direction ?? '').toString().toLowerCase();
        // Filter out empty directions (safety check for missing data)
        if (!direction) return false;

        const rawConfidence =
          signal?.confidence_metrics?.overall_confidence ??
          signal?.enhanced_prediction?.confidence ??
          signal?.confidence ??
          null;
        const confidence = (typeof rawConfidence === 'number') ? rawConfidence : null;
        if (confidence === null) return false;
        if (confidence <= 0) return false;
        if (confidence > 1) return false;

        return true;
      }).length;

      if (symbolsCount === 0 || totalSignals === 0 || usableSignals === 0) {
        console.warn(`⚠️ [CRON-PRE-MARKET] ${cronExecutionId} Analysis returned no usable signals`, {
          symbols_count: symbolsCount,
          total_signals: totalSignals,
          usable_signals: usableSignals
        });
        analysisResult = null;
        analysisFailureReason = `Analysis returned no usable signals (symbols: ${symbolsCount}, total_signals: ${totalSignals}, usable: ${usableSignals})`;
      }
    }

    // Write to D1 with correct report type based on trigger mode
    // This runs for all trigger modes (including intraday)
    if (analysisResult) {
      const reportTypeMap: Record<string, string> = {
        'morning_prediction_alerts': 'pre-market',
        'midday_validation_prediction': 'intraday',
        'next_day_market_prediction': 'end-of-day'
      };
      const d1ReportType = reportTypeMap[triggerMode];
      if (d1ReportType) {
        // Determine which run tracking variables to use
        const activeRunId = d1ReportType === 'pre-market' ? runId : 
                           d1ReportType === 'intraday' ? intradayRunId : 
                           null;
        const activeRunTrackingEnabled = d1ReportType === 'pre-market' ? runTrackingEnabled :
                                        d1ReportType === 'intraday' ? intradayRunTrackingEnabled :
                                        false;

        // Start storage stage for jobs with run tracking
        if (activeRunTrackingEnabled && activeRunId && (d1ReportType === 'pre-market' || d1ReportType === 'intraday')) {
          await startJobStage(env, { runId: activeRunId, scheduledDate: dateStr, reportType: d1ReportType, stage: 'storage' });
        }

        try {
          const d1Metadata: Record<string, any> = {
            processingTimeMs: Date.now() - scheduledTime.getTime(),
            ai_models: {
              primary: AI_MODEL_DISPLAY.primary.id,
              secondary: AI_MODEL_DISPLAY.secondary.id
            }
          };
          if (d1ReportType === 'intraday') {
            d1Metadata.pre_market_run_id = (analysisResult as any)?.pre_market_run_id || null;
          }

          const d1Written = await writeD1JobResult(env, dateStr, d1ReportType, {
            ...analysisResult,
            cron_execution_id: cronExecutionId,
            trigger_mode: triggerMode,
            generated_at: scheduledTime.toISOString()
          }, d1Metadata, 'cron', activeRunTrackingEnabled ? activeRunId! : undefined);
          console.log(`✅ [CRON-D1] ${cronExecutionId} D1 snapshot written: ${d1ReportType} for ${dateStr}, success: ${d1Written}`);

          // Invalidate HTML cache to ensure fresh page rendering
          if (d1ReportType === 'intraday' || d1ReportType === 'end-of-day') {
            try {
              const dal = createSimplifiedEnhancedDAL(env);
              const htmlCacheKey = d1ReportType === 'intraday'
                ? `intraday_html_${dateStr}`
                : `end_of_day_html_${dateStr}`;
              await dal.deleteKey(htmlCacheKey);
              console.log(`🗑️ [CRON-CACHE] ${cronExecutionId} ${d1ReportType} HTML cache invalidated: ${htmlCacheKey}`);
            } catch (cacheErr) { /* ignore - cache key may not exist */ }
          }

          // Warm DO report cache for pre-market to ensure report endpoint returns fresh data
          if (d1ReportType === 'pre-market' && analysisResult) {
            try {
              const dal = createSimplifiedEnhancedDAL(env);
              const reportCacheKey = `pre_market_report_${dateStr}`;
              
              // Transform analysis result to report format expected by the report endpoint
              const tradingSignals = analysisResult.trading_signals || {};
              const roundConfidence = (v: number | null | undefined) => v != null ? Math.round(v * 1000) / 1000 : null;
              const allSignals = Object.values(tradingSignals).map((signal: any) => ({
                symbol: signal.symbol,
                sentiment: signal.enhanced_prediction?.direction || signal.trading_signals?.primary_direction || signal.direction || 'neutral',
                confidence: roundConfidence(signal.confidence_metrics?.overall_confidence ?? signal.trading_signals?.overall_confidence ?? signal.confidence),
                // Dual model confidences - model-agnostic naming
                primary_model: 'GPT-OSS 120B',
                primary_confidence: roundConfidence(signal.confidence_metrics?.confidence_breakdown?.primary_confidence),
                mate_model: 'DeepSeek-R1 32B',
                mate_confidence: roundConfidence(signal.confidence_metrics?.confidence_breakdown?.mate_confidence),
                status: (signal.confidence_metrics?.overall_confidence ?? signal.trading_signals?.overall_confidence ?? signal.confidence) ? 'success' : 'failed',
                reason: signal.trading_signals?.entry_signals?.reasoning || signal.sentiment_layers?.[0]?.reasoning || signal.signal?.reasoning || ''
              }));

              const reportData = {
                type: 'pre_market_briefing',
                timestamp: new Date().toISOString(),
                market_status: 'pre_market',
                date: dateStr,
                is_stale: false,
                key_insights: ['Pre-market analysis complete', `Data from ${dateStr}`, 'Fresh data available'],
                high_confidence_signals: allSignals.filter(s => s.confidence !== null && s.confidence > 0.7),
                all_signals: allSignals,
                high_confidence_count: allSignals.filter(s => s.confidence !== null && s.confidence > 0.7).length,
                data_source: 'd1_snapshot',
                generated_at: new Date().toISOString(),
                symbols_analyzed: allSignals.length
              };

              // Invalidate old cache first
              const htmlCacheKey = `premarket_html_${dateStr}`;
              try {
                await dal.deleteKey(htmlCacheKey);
              } catch (e) { /* ignore */ }

              // Write formatted report to DO cache
              await dal.write(reportCacheKey, reportData, { expirationTtl: 3600 });
              console.log(`✅ [CRON-CACHE] ${cronExecutionId} Pre-market report cache warmed: ${reportCacheKey} (${allSignals.length} symbols)`);
            } catch (cacheErr) {
              console.warn(`⚠️ [CRON-CACHE] ${cronExecutionId} Pre-market cache warming failed:`, cacheErr);
            }
          }

          // End storage stage for jobs with run tracking
          if (activeRunTrackingEnabled && activeRunId && (d1ReportType === 'pre-market' || d1ReportType === 'intraday')) {
            await endJobStage(env, { runId: activeRunId, stage: 'storage' });
          }

          // Complete job run for pre-market and intraday
          if (activeRunTrackingEnabled && activeRunId && (d1ReportType === 'pre-market' || d1ReportType === 'intraday')) {
            // Use partial status for intraday with empty symbols (no pre-market data)
            const jobStatus = (d1ReportType === 'intraday' && intradayHasEmptySymbols) ? 'partial' : 'success';
            const warnings = (d1ReportType === 'intraday' && intradayHasEmptySymbols)
              ? ['Intraday analysis incomplete - news fetch failed for all symbols or no pre-market data available']
              : undefined;
            await completeJobRun(env, {
              runId: activeRunId,
              scheduledDate: dateStr,
              reportType: d1ReportType,
              status: jobStatus,
              warnings
            });
            const statusEmoji = jobStatus === 'partial' ? '⚠️' : '✅';
            console.log(`${statusEmoji} [CRON-${d1ReportType.toUpperCase()}] ${cronExecutionId} Job run completed with status: ${jobStatus}, run_id: ${activeRunId}`);
          }
        } catch (d1Error: any) {
          console.error(`❌ [CRON-D1-ERROR] ${cronExecutionId} D1 write failed:`, {
            error: d1Error.message,
            stack: d1Error.stack,
            reportType: d1ReportType,
            dateStr
          });

          // End dangling storage stage for pre-market and intraday
          if (activeRunTrackingEnabled && activeRunId && (d1ReportType === 'pre-market' || d1ReportType === 'intraday')) {
            await endJobStage(env, { runId: activeRunId, stage: 'storage', status: 'failed', errors: [d1Error.message] });
          }

          // Complete job run with failure for pre-market and intraday
          if (activeRunTrackingEnabled && activeRunId && (d1ReportType === 'pre-market' || d1ReportType === 'intraday')) {
            await completeJobRun(env, {
              runId: activeRunId,
              scheduledDate: dateStr,
              reportType: d1ReportType,
              status: 'failed',
              errors: [d1Error.message]
            });
          }

          // Continue execution even if D1 fails
        }
      }
    } else if (triggerMode === 'morning_prediction_alerts') {
      // Bug fix: Handle null analysisResult - mark job as failed
      const failureError = analysisFailureReason || 'Analysis returned null or undefined - no valid result generated';
      console.warn(`⚠️ [CRON-PRE-MARKET] ${cronExecutionId} ${failureError}`);

      // Update multi-run tables if tracking enabled
      if (runTrackingEnabled && runId) {
        await completeJobRun(env, {
          runId,
          scheduledDate: dateStr,
          reportType: 'pre-market',
          status: 'failed',
          errors: [failureError]
        });
      }

      // Return failure response
      const errorResponse: CronResponse = {
        success: false,
        trigger_mode: triggerMode,
        error: failureError,
        execution_id: cronExecutionId,
        timestamp: scheduledTime.toISOString()
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cronDuration = Date.now() - scheduledTime.getTime();
    const symbolsAnalyzedRaw = analysisResult?.symbols_analyzed;
    const symbolsCount: number = Array.isArray(symbolsAnalyzedRaw)
      ? symbolsAnalyzedRaw.length
      : (typeof symbolsAnalyzedRaw === 'number' ? symbolsAnalyzedRaw : 0);
    console.log(`✅ [CRON-COMPLETE] ${cronExecutionId}`, {
      trigger_mode: triggerMode,
      duration_ms: cronDuration,
      symbols_analyzed: symbolsCount,
      facebook_status: env.FACEBOOK_PAGE_TOKEN ? 'sent' : 'skipped'
    });

    const response: CronResponse = {
      success: true,
      trigger_mode: triggerMode,
      symbols_analyzed: symbolsCount,
      execution_id: cronExecutionId,
      timestamp: scheduledTime.toISOString()
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`❌ [CRON-ERROR] ${cronExecutionId}:`, error);

    // Send critical error alert if available
    if (env.SLACK_WEBHOOK_URL) {
      try {
        const alert: SlackAlert = {
          text: `🚨 CRITICAL: Trading System Cron Failed`,
          attachments: [{
            color: 'danger',
            fields: [
              { title: 'Error', value: error.message, short: false },
              { title: 'Trigger Mode', value: triggerMode, short: true },
              { title: 'Time', value: scheduledTime.toISOString(), short: true }
            ]
          }]
        };

        await fetch(env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert),
          signal: AbortSignal.timeout(10000)
        });
      } catch (alertError) {
        console.error('Failed to send error alert:', alertError);
      }
    }

    // Update multi-run tables for pre-market failures
    if (runTrackingEnabled && runId) {
      const jobTypeMap: Record<string, string> = {
        'morning_prediction_alerts': 'pre-market',
        'midday_validation_prediction': 'intraday',
        'next_day_market_prediction': 'end-of-day',
        'weekly_review_analysis': 'weekly',
        'sector_rotation_refresh': 'sector-rotation'
      };
      const jobType = jobTypeMap[triggerMode] || triggerMode;
      const dateStr = getESTDateString(scheduledTime);

      try {
        await completeJobRun(env, {
          runId,
          scheduledDate: dateStr,
          reportType: jobType as 'pre-market' | 'intraday' | 'end-of-day' | 'weekly',
          status: 'failed',
          errors: [error.message]
        });
        console.log(`✅ [CRON] ${cronExecutionId} Failed job run recorded: ${runId}`);
      } catch (statusError: any) {
        console.error(`❌ [CRON-JOB-STATUS-ERROR] ${cronExecutionId} Failed to update multi-run tables:`, {
          error: statusError.message
        });
      }
    }

    const errorResponse: CronResponse = {
      success: false,
      error: error.message,
      trigger_mode: triggerMode,
      execution_id: cronExecutionId,
      timestamp: scheduledTime.toISOString()
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
