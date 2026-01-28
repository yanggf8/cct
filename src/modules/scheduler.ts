/**
 * Cron Scheduler Module - TypeScript
 * Handles all scheduled events (cron triggers) - fully modular
 */

import { runPreMarketAnalysis, runWeeklyMarketCloseAnalysis } from './analysis.js';
import { runEnhancedAnalysis, runEnhancedPreMarketAnalysis } from './enhanced_analysis.js';
import { generateWeeklyReviewAnalysis } from './report/weekly-review-analysis.js';
import { performSectorRotationAnalysis } from './sector-rotation-workflow.js';
import { KVUtils } from './shared-utilities.js';
import { initializeRealTimeDataManager } from './real-time-data-manager.js';
// Facebook imports removed - migrated to Chrome web notifications
// No-op stubs for compatibility
import { sendWeeklyReviewWithTracking } from './handlers/weekly-review-handlers.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
import { writeD1JobResult, startJobRun, completeJobRun, startJobStage, endJobStage, generateRunId } from './d1-job-storage.js';
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
  overrideTriggerMode?: string
): Promise<Response> {
  const scheduledTime = new Date(controller.scheduledTime);
  const cronExecutionId = `cron_${Date.now()}`;
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
    // Get the scheduled time in UTC for cron matching
    const utcHour = scheduledTime.getUTCHours();
    const utcMinute = scheduledTime.getUTCMinutes();
    const utcDay = scheduledTime.getUTCDay();

    // Get EST/EDT time for logging
    const estTime = new Date(scheduledTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const estHour = estTime.getHours();
    const estMinute = estTime.getMinutes();
    const estDay = estTime.getDay();

    console.log(`🕐 [PRODUCTION-CRON] UTC: ${utcHour}:${utcMinute.toString().padStart(2, '0')} (Day ${utcDay}) | EST/EDT: ${estHour}:${estMinute.toString().padStart(2, '0')} (Day ${estDay}) | Scheduled: ${scheduledTime.toISOString()}`);

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
      console.log(`⚠️ [CRON] Unrecognized schedule: UTC ${utcHour}:${utcMinute} (Day ${utcDay}) | EST/EDT ${estHour}:${estMinute} (Day ${estDay})`);
      return new Response('Unrecognized cron schedule', { status: 400 });
    }
  }

  // Get EST time for business logic
  const estTime = new Date(scheduledTime.toLocaleString("en-US", { timeZone: "America/New_York" }));

  console.log(`✅ [CRON-START] ${cronExecutionId}`, {
    trigger_mode: triggerMode,
    est_time: estTime.toISOString(),
    utc_time: scheduledTime.toISOString(),
    prediction_horizons: predictionHorizons
  });

  try {
    let analysisResult: AnalysisResult | null = null;
    const dateStr = estTime.toISOString().split('T')[0];

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
        triggerSource: 'cron'
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
      const weekSunday = new Date(estTime);
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
          generated_at: estTime.toISOString(),
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
        triggerSource: 'cron'
      });
      const sectorRunTrackingEnabled = !!sectorRunId;

      let sectorStatus: 'success' | 'failed' = 'success';
      let sectorErrors: string[] = [];

      try {
        // Perform sector rotation analysis
        const sectorResult = await performSectorRotationAnalysis(env, {
          triggerMode,
          currentTime: estTime,
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
        triggerSource: 'cron'
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
          timestamp: estTime.toISOString()
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
        triggerSource: 'cron'
      });
      const runTrackingEnabled = !!runId;

      if (!runId) {
        console.warn(`⚠️ [CRON-EOD] ${cronExecutionId} Run tracking unavailable, using fallback`);
      }

      if (runTrackingEnabled) {
        await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'end-of-day', stage: 'init' });
        await endJobStage(env, { runId, stage: 'init' });
        await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'end-of-day', stage: 'data_fetch' });
      }

      try {
        const { generateEndOfDayAnalysis } = await import('./report/end-of-day-analysis.js');
        const dal = createSimplifiedEnhancedDAL(env);
        
        // Fetch morning predictions and analysis data from cache/D1
        const morningAnalysis = await dal.read(`analysis_${dateStr}`);
        const analysisData = morningAnalysis.success ? morningAnalysis.data : null;
        
        // Fetch intraday data if available
        const intradayResult = await dal.read(`intraday_${dateStr}`);
        const intradayData = intradayResult.success ? intradayResult.data : null;

        // Validate required inputs so failures are explicit (not silent zero-signal runs)
        const missingInputs: string[] = [];
        if (!analysisData) missingInputs.push('morning analysis (analysis cache)');
        if (!analysisData?.trading_signals) missingInputs.push('morning predictions (trading_signals)');
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
          timestamp: estTime.toISOString(),
          trigger_mode: triggerMode
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
            accuracyRate: eodResult.overallAccuracy
          }, 'cron', runTrackingEnabled ? runId : undefined);
          console.log(`✅ [CRON-D1] ${cronExecutionId} D1 snapshot written: end-of-day for ${dateStr}`);
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
        console.error(`❌ [CRON-EOD] ${cronExecutionId} End-of-day analysis failed:`, {
          error: eodError.message,
          stack: eodError.stack
        });
        analysisResult = null;

        // Complete job with failure
        if (runTrackingEnabled) {
          await completeJobRun(env, {
            runId,
            scheduledDate: dateStr,
            reportType: 'end-of-day',
            status: 'failed',
            errors: [eodError.message]
          });
        }
      }

      // If end-of-day failed, write failure status and stop before generic writer runs
      if (!analysisResult) {
        const errorResponse: CronResponse = {
          success: false,
          trigger_mode: triggerMode,
          error: 'End-of-day analysis failed - no valid result generated',
          execution_id: cronExecutionId,
          timestamp: estTime.toISOString()
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
        triggerSource: 'cron'
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

      analysisResult = await runEnhancedPreMarketAnalysis(env, {
        triggerMode,
        predictionHorizons,
        currentTime: estTime,
        cronExecutionId
      });

      if (runTrackingEnabled) {
        await endJobStage(env, { runId, stage: 'ai_analysis' });
      }

      // Facebook messaging has been migrated to Chrome web notifications
      console.log(`📱 [CRON-FB] ${cronExecutionId} Facebook messaging disabled - using web notifications instead`);
    }

    // Store results in KV using DAL (skip for intraday to prevent overwriting pre-market data)
    // dateStr is needed for both KV and D1 writes
    if (analysisResult && triggerMode !== 'midday_validation_prediction') {
      const dal = createSimplifiedEnhancedDAL(env);
      const timeStr = estTime.toISOString().substr(11, 8).replace(/:/g, '');

      const timestampedKey = `analysis_${dateStr}_${timeStr}`;
      const dailyKey = `analysis_${dateStr}`;

      console.log(`💾 [CRON-DAL] ${cronExecutionId} storing results with keys: ${timestampedKey} and ${dailyKey}`);

      try {
        // Store the timestamped analysis using enhanced DAL
        const timestampedResult = await dal.write(
          timestampedKey,
          {
            ...analysisResult,
            cron_execution_id: cronExecutionId,
            trigger_mode: triggerMode,
            timestamp: estTime.toISOString()
          }
        );

        console.log(`✅ [CRON-DAL] ${cronExecutionId} Timestamped key stored: ${timestampedKey}`);

        // Update the daily summary using enhanced DAL
        const dailyResult = await dal.write(
          dailyKey,
          {
            ...analysisResult,
            cron_execution_id: cronExecutionId,
            trigger_mode: triggerMode,
            last_updated: estTime.toISOString()
          }
        );

        console.log(`✅ [CRON-DAL] ${cronExecutionId} Daily key stored: ${dailyKey}`);
      } catch (dalError: any) {
        console.error(`❌ [CRON-DAL-ERROR] ${cronExecutionId} DAL operation failed:`, {
          error: dalError.message,
          stack: dalError.stack,
          timestampedKey,
          dailyKey
        });
        // Continue execution even if DAL fails
      }
    } else if (analysisResult && triggerMode === 'midday_validation_prediction') {
      console.log(`⏭️ [CRON-DAL-SKIP] ${cronExecutionId} Skipping KV writes for intraday job (D1 only)`);
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
          const d1Written = await writeD1JobResult(env, dateStr, d1ReportType, {
            ...analysisResult,
            cron_execution_id: cronExecutionId,
            trigger_mode: triggerMode,
            generated_at: estTime.toISOString()
          }, {
            processingTimeMs: Date.now() - scheduledTime.getTime(),
            ai_models: {
              primary: '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
              secondary: '@cf/huggingface/distilbert-sst-2-int8'
            }
          }, 'cron', activeRunTrackingEnabled ? activeRunId! : undefined);
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

          // End storage stage for jobs with run tracking
          if (activeRunTrackingEnabled && activeRunId && (d1ReportType === 'pre-market' || d1ReportType === 'intraday')) {
            await endJobStage(env, { runId: activeRunId, stage: 'storage' });
          }

          // Complete job run for pre-market and intraday
          if (activeRunTrackingEnabled && activeRunId && (d1ReportType === 'pre-market' || d1ReportType === 'intraday')) {
            // Use partial status for intraday with empty symbols (no pre-market data)
            const jobStatus = (d1ReportType === 'intraday' && intradayHasEmptySymbols) ? 'partial' : 'success';
            const warnings = (d1ReportType === 'intraday' && intradayHasEmptySymbols)
              ? ['No pre-market data available for intraday comparison']
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
            await endJobStage(env, { runId: activeRunId, stage: 'storage' });
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
      const failureError = 'Analysis returned null or undefined - no valid result generated';
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
        timestamp: estTime.toISOString()
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
      timestamp: estTime.toISOString()
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
              { title: 'Time', value: estTime.toISOString(), short: true }
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
      const dateStr = estTime.toISOString().split('T')[0];

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
      timestamp: estTime.toISOString()
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
