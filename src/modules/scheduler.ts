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
import { writeD1JobResult, updateD1JobStatus } from './d1-job-storage.js';
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
      // Sunday 10:00 AM - Weekly Review Analysis
      console.log(`📊 [CRON-WEEKLY] ${cronExecutionId} Generating weekly review analysis`);

      // Analyze the previous week (Sunday prior to current execution)
      const weekSunday = new Date(estTime);
      weekSunday.setDate(weekSunday.getDate() - 7);

      // Generate weekly analysis result for that week
      analysisResult = await generateWeeklyReviewAnalysis(env as any, weekSunday);

      console.log(`📱 [CRON-FB-WEEKLY] ${cronExecutionId} Sending weekly review via Facebook`);
      await sendWeeklyReviewWithTracking(analysisResult, env, cronExecutionId);
      console.log(`✅ [CRON-FB-WEEKLY] ${cronExecutionId} Weekly Facebook message completed`);

      console.log(`✅ [CRON-COMPLETE-WEEKLY] ${cronExecutionId} Weekly review analysis completed`);

      // Write job execution status to job_executions table for dashboard tracking
      try {
        const jobType = 'weekly';
        await updateD1JobStatus(env, jobType, dateStr, 'done', {
          symbols_processed: 0,
          execution_time_ms: Date.now() - scheduledTime.getTime(),
          symbols_successful: 0,
          symbols_fallback: 0,
          symbols_failed: 0,
          errors: []
        });
        console.log(`✅ [CRON-JOB-STATUS] ${cronExecutionId} Weekly job status written to job_executions`);
      } catch (statusError: any) {
        console.error(`❌ [CRON-JOB-STATUS-ERROR] ${cronExecutionId} Failed to write weekly job status:`, {
          error: statusError.message
        });
      }

      return new Response('Weekly review analysis completed successfully', { status: 200 });

    } else if (triggerMode === 'sector_rotation_refresh') {
      // 9:30 AM EST - Sector Rotation Data Refresh
      console.log(`🔄 [CRON-SECTORS] ${cronExecutionId} Refreshing sector rotation data`);

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
        }
      } catch (sectorError: any) {
        console.error(`❌ [CRON-SECTORS] ${cronExecutionId} Sector rotation refresh failed:`, {
          error: sectorError.message,
          stack: sectorError.stack
        });
        // Continue execution - sector refresh failure is not critical
      }

      console.log(`✅ [CRON-COMPLETE-SECTORS] ${cronExecutionId} Sector rotation refresh completed`);

      // Write job execution status to job_executions table for dashboard tracking
      try {
        const jobType = 'sector-rotation';
        await updateD1JobStatus(env, jobType, dateStr, 'done', {
          symbols_processed: 0,
          execution_time_ms: Date.now() - scheduledTime.getTime(),
          symbols_successful: 0,
          symbols_fallback: 0,
          symbols_failed: 0,
          errors: []
        });
        console.log(`✅ [CRON-JOB-STATUS] ${cronExecutionId} Sector rotation job status written to job_executions`);
      } catch (statusError: any) {
        console.error(`❌ [CRON-JOB-STATUS-ERROR] ${cronExecutionId} Failed to write sector rotation job status:`, {
          error: statusError.message
        });
      }

      return new Response('Sector rotation refresh completed successfully', { status: 200 });

    } else if (triggerMode === 'midday_validation_prediction') {
      // Intraday Performance Check
      console.log(`📊 [CRON-INTRADAY] ${cronExecutionId} Generating intraday analysis`);
      
      try {
        const { IntradayDataBridge } = await import('./intraday-data-bridge.js');
        const bridge = new IntradayDataBridge(env);
        const intradayResult = await bridge.generateIntradayAnalysis();
        
        // Validate intradayResult before creating analysisResult
        if (!intradayResult || !intradayResult.symbols || !Array.isArray(intradayResult.symbols)) {
          throw new Error(`Invalid intraday result: ${JSON.stringify(intradayResult)}`);
        }
        
        // Treat empty symbols array as a failure (no symbols analyzed)
        if (intradayResult.symbols.length === 0) {
          throw new Error('Intraday analysis produced no symbols - empty result');
        }
        
        // Transform to scheduler expected shape
        // Note: symbols_analyzed must be a number (not array) to match intraday UI expectations
        // and be consistent with /api/v1/jobs/intraday endpoint
        analysisResult = {
          ...intradayResult,
          symbols_analyzed: intradayResult.symbols.length, // Store as number, not array
          symbols_list: intradayResult.symbols.map(s => s.symbol), // Keep symbols array in separate field
          timestamp: intradayResult.timestamp,
          trigger_mode: triggerMode
        };
        
        console.log(`✅ [CRON-INTRADAY] ${cronExecutionId} Intraday analysis completed`, {
          symbols_count: intradayResult.symbols.length,
          overall_accuracy: intradayResult.overall_accuracy,
          on_track_count: intradayResult.on_track_count,
          diverged_count: intradayResult.diverged_count
        });
      } catch (intradayError: any) {
        console.error(`❌ [CRON-INTRADAY] ${cronExecutionId} Intraday analysis failed:`, {
          error: intradayError.message,
          stack: intradayError.stack
        });
        // Set analysisResult to null to ensure fail-fast check works
        analysisResult = null;
      }
      
      // Facebook messaging has been migrated to Chrome web notifications
      console.log(`📱 [CRON-FB] ${cronExecutionId} Facebook messaging disabled - using web notifications instead`);

      // If intraday analysis failed and produced no result, treat as failure
      if (!analysisResult) {
        console.error(`❌ [CRON-INTRADAY] ${cronExecutionId} Intraday analysis did not produce a valid result`);

        // Write failure status to job_executions
        try {
          const jobType = 'intraday';
          await updateD1JobStatus(env, jobType, dateStr, 'failed', {
            symbols_processed: 0,
            execution_time_ms: Date.now() - scheduledTime.getTime(),
            symbols_successful: 0,
            symbols_fallback: 0,
            symbols_failed: 0,
            errors: ['Intraday analysis failed - no valid result generated']
          });
          console.log(`✅ [CRON-JOB-STATUS] ${cronExecutionId} Intraday failure status written to job_executions`);
        } catch (statusError: any) {
          console.error(`❌ [CRON-JOB-STATUS-ERROR] ${cronExecutionId} Failed to write intraday error status:`, {
            error: statusError.message
          });
        }

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

      // Write success status to job_executions
      try {
        const jobType = 'intraday';
        const symbolsAnalyzed = Array.isArray(analysisResult.symbols_analyzed)
          ? analysisResult.symbols_analyzed.length
          : (typeof analysisResult.symbols_analyzed === 'number' ? analysisResult.symbols_analyzed : 0);
        await updateD1JobStatus(env, jobType, dateStr, 'done', {
          symbols_processed: symbolsAnalyzed,
          execution_time_ms: Date.now() - scheduledTime.getTime(),
          symbols_successful: symbolsAnalyzed,
          symbols_fallback: 0,
          symbols_failed: 0,
          errors: []
        });
        console.log(`✅ [CRON-JOB-STATUS] ${cronExecutionId} Intraday job status written to job_executions`);
      } catch (statusError: any) {
        console.error(`❌ [CRON-JOB-STATUS-ERROR] ${cronExecutionId} Failed to write intraday job status:`, {
          error: statusError.message
        });
      }

    } else if (triggerMode === 'next_day_market_prediction') {
      // End-of-Day Summary (~4:05 PM ET)
      console.log(`🏁 [CRON-EOD] ${cronExecutionId} Generating end-of-day analysis`);

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
        
        // Morning predictions from pre-market
        const morningPredictions = analysisData?.trading_signals || null;

        const eodResult = await generateEndOfDayAnalysis(analysisData, morningPredictions, intradayData, env);

        if (!eodResult) {
          throw new Error('End-of-day analysis returned null');
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
      } catch (eodError: any) {
        console.error(`❌ [CRON-EOD] ${cronExecutionId} End-of-day analysis failed:`, {
          error: eodError.message,
          stack: eodError.stack
        });
        analysisResult = null;
      }

      // If end-of-day failed, write failure status and stop before generic writer runs
      if (!analysisResult) {
        try {
          const jobType = 'end-of-day';
          await updateD1JobStatus(env, jobType, dateStr, 'failed', {
            symbols_processed: 0,
            execution_time_ms: Date.now() - scheduledTime.getTime(),
            symbols_successful: 0,
            symbols_fallback: 0,
            symbols_failed: 0,
            errors: ['End-of-day analysis failed']
          });
          console.log(`✅ [CRON-JOB-STATUS] ${cronExecutionId} End-of-day failure status written to job_executions`);
        } catch (statusError: any) {
          console.error(`❌ [CRON-JOB-STATUS-ERROR] ${cronExecutionId} Failed to write end-of-day failure status:`, {
            error: statusError.message
          });
        }

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
      analysisResult = await runEnhancedPreMarketAnalysis(env, {
        triggerMode,
        predictionHorizons,
        currentTime: estTime,
        cronExecutionId
      });

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
          }, 'cron');
          console.log(`✅ [CRON-D1] ${cronExecutionId} D1 snapshot written: ${d1ReportType} for ${dateStr}, success: ${d1Written}`);

          // Write job execution status to job_executions table for dashboard tracking
          try {
            const jobTypeMap: Record<string, string> = {
              'morning_prediction_alerts': 'pre-market',
              'midday_validation_prediction': 'intraday',
              'next_day_market_prediction': 'end-of-day'
            };
            const jobType = jobTypeMap[triggerMode] || triggerMode;
            const symbolsAnalyzedRaw = analysisResult?.symbols_analyzed;
            const symbolsAnalyzed: number = Array.isArray(symbolsAnalyzedRaw)
              ? symbolsAnalyzedRaw.length
              : (typeof symbolsAnalyzedRaw === 'number' ? symbolsAnalyzedRaw : 0);

            await updateD1JobStatus(env, jobType, dateStr, 'done', {
              symbols_processed: symbolsAnalyzed,
              execution_time_ms: Date.now() - scheduledTime.getTime(),
              symbols_successful: symbolsAnalyzed,
              symbols_fallback: 0,
              symbols_failed: 0,
              errors: []
            });
            console.log(`✅ [CRON-JOB-STATUS] ${cronExecutionId} Job status written to job_executions: ${jobType}`);
          } catch (statusError: any) {
            console.error(`❌ [CRON-JOB-STATUS-ERROR] ${cronExecutionId} Failed to write job status:`, {
              error: statusError.message,
              jobType: triggerMode
            });
          }
        } catch (d1Error: any) {
          console.error(`❌ [CRON-D1-ERROR] ${cronExecutionId} D1 write failed:`, {
            error: d1Error.message,
            stack: d1Error.stack,
            reportType: d1ReportType,
            dateStr
          });
          // Continue execution even if D1 fails
        }
      }
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

    // Write failure status to job_executions table for dashboard tracking
    try {
      const jobTypeMap: Record<string, string> = {
        'morning_prediction_alerts': 'pre-market',
        'midday_validation_prediction': 'intraday',
        'next_day_market_prediction': 'end-of-day',
        'weekly_review_analysis': 'weekly',
        'sector_rotation_refresh': 'sector-rotation'
      };
      const jobType = jobTypeMap[triggerMode] || triggerMode;
      const dateStr = estTime.toISOString().split('T')[0];

      await updateD1JobStatus(env, jobType, dateStr, 'failed', {
        symbols_processed: 0,
        execution_time_ms: Date.now() - scheduledTime.getTime(),
        symbols_successful: 0,
        symbols_fallback: 0,
        symbols_failed: 0,
        errors: [error.message]
      });
      console.log(`✅ [CRON-JOB-STATUS] ${cronExecutionId} Failed job status written to job_executions: ${jobType}`);
    } catch (statusError: any) {
      console.error(`❌ [CRON-JOB-STATUS-ERROR] ${cronExecutionId} Failed to write error status:`, {
        error: statusError.message
      });
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
