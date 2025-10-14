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
import { createDAL, DataAccessLayer } from './dal.js';
import type { CloudflareEnvironment } from '../types.js';

/**
 * Type Definitions
 */

export interface ScheduledController {
  scheduledTime: number | string | Date;
  cron?: string;
}

export interface AnalysisResult {
  symbols_analyzed?: string[];
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

/**
 * Handle scheduled cron events
 */
export async function handleScheduledEvent(
  controller: ScheduledController,
  env: CloudflareEnvironment,
  ctx: ExecutionContext
): Promise<Response> {
  const scheduledTime = new Date(controller.scheduledTime);

  // Get the scheduled time in UTC for cron matching
  const utcHour = scheduledTime.getUTCHours();
  const utcMinute = scheduledTime.getUTCMinutes();
  const utcDay = scheduledTime.getUTCDay(); // 0=Sunday, 1=Monday, ..., 5=Friday

  // Get EST/EDT time for logging and business logic
  const estTime = new Date(scheduledTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const estHour = estTime.getHours();
  const estMinute = estTime.getMinutes();
  const estDay = estTime.getDay();

  console.log(`🕐 [PRODUCTION-CRON] UTC: ${utcHour}:${utcMinute.toString().padStart(2, '0')} (Day ${utcDay}) | EST/EDT: ${estHour}:${estMinute.toString().padStart(2, '0')} (Day ${estDay}) | Scheduled: ${scheduledTime.toISOString()}`);

  const cronExecutionId = `cron_${Date.now()}`;
  let triggerMode: string;
  let predictionHorizons: number[];

  // Determine trigger mode based on UTC schedule (matching wrangler.toml cron expressions)
  if (utcHour === 12 && utcMinute === 30 && utcDay >= 1 && utcDay <= 5) {
    // 30 12 * * 1-5 = 12:30 PM UTC = 8:30 AM EST/7:30 AM EDT - Morning predictions
    triggerMode = 'morning_prediction_alerts';
    predictionHorizons = [1, 24]; // 1-hour and 24-hour forecasts
  } else if (utcHour === 16 && utcMinute === 0 && utcDay >= 1 && utcDay <= 5) {
    // 0 16 * * 1-5 = 4:00 PM UTC = 12:00 PM EST/11:00 AM EDT - Midday validation
    triggerMode = 'midday_validation_prediction';
    predictionHorizons = [8, 24]; // 8-hour (market close) + next-day
  } else if (utcHour === 20 && utcMinute === 5 && utcDay >= 1 && utcDay <= 5) {
    // 5 20 * * 1-5 = 8:05 PM UTC = 4:05 PM EST/3:05 PM EDT - Daily validation
    triggerMode = 'next_day_market_prediction';
    predictionHorizons = [17, 24]; // Market close + next trading day
  } else if (utcHour === 14 && utcMinute === 0 && utcDay === 0) {
    // 0 14 * * SUN = 2:00 PM UTC = 10:00 AM EST/9:00 AM EDT Sunday - Weekly Review
    triggerMode = 'weekly_review_analysis';
    predictionHorizons = []; // No predictions, just pattern analysis
  } else if (utcHour === 13 && utcMinute === 30 && utcDay >= 1 && utcDay <= 5) {
    // 30 13 * * 1-5 = 1:30 PM UTC = 9:30 AM EST/8:30 AM EDT - Sector Rotation Refresh
    triggerMode = 'sector_rotation_refresh';
    predictionHorizons = []; // No predictions, just sector data refresh
  } else {
    console.log(`⚠️ [CRON] Unrecognized schedule: UTC ${utcHour}:${utcMinute} (Day ${utcDay}) | EST/EDT ${estHour}:${estMinute} (Day ${estDay})`);
    return new Response('Unrecognized cron schedule', { status: 400 });
  }

  console.log(`✅ [CRON-START] ${cronExecutionId}`, {
    trigger_mode: triggerMode,
    est_time: estTime.toISOString(),
    utc_time: scheduledTime.toISOString(),
    prediction_horizons: predictionHorizons
  });

  try {
    let analysisResult: AnalysisResult | null = null;

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

      // Generate weekly analysis result
      analysisResult = await generateWeeklyReviewAnalysis(env, estTime);

      console.log(`📱 [CRON-FB-WEEKLY] ${cronExecutionId} Sending weekly review via Facebook`);
      await sendWeeklyReviewWithTracking(analysisResult, env, cronExecutionId);
      console.log(`✅ [CRON-FB-WEEKLY] ${cronExecutionId} Weekly Facebook message completed`);

      console.log(`✅ [CRON-COMPLETE-WEEKLY] ${cronExecutionId} Weekly review analysis completed`);
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
            sectors_analyzed: sectorResult.sectors?.length || 0,
            top_performer: sectorResult.summary?.topPerformer,
            worst_performer: sectorResult.summary?.worstPerformer
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
      return new Response('Sector rotation refresh completed successfully', { status: 200 });

    } else {
      // Enhanced pre-market analysis with sentiment
      console.log(`🚀 [CRON-ENHANCED] ${cronExecutionId} Running enhanced analysis with sentiment...`);
      analysisResult = await runEnhancedPreMarketAnalysis(env, {
        triggerMode,
        predictionHorizons,
        currentTime: estTime,
        cronExecutionId
      });

      // Send Facebook messages for daily cron jobs
      console.log(`📱 [CRON-FB] ${cronExecutionId} Attempting Facebook message for trigger: ${triggerMode}`);
      if (triggerMode === 'morning_prediction_alerts') {
        console.log(`📱 [CRON-FB-MORNING] ${cronExecutionId} Sending morning predictions via Facebook`);
        await sendMorningPredictionsWithTracking(analysisResult, env, cronExecutionId);
        console.log(`✅ [CRON-FB-MORNING] ${cronExecutionId} Morning Facebook message completed`);
      } else if (triggerMode === 'midday_validation_prediction') {
        console.log(`📱 [CRON-FB-MIDDAY] ${cronExecutionId} Sending midday validation via Facebook`);
        await sendMiddayValidationWithTracking(analysisResult, env, cronExecutionId);
        console.log(`✅ [CRON-FB-MIDDAY] ${cronExecutionId} Midday Facebook message completed`);
      } else if (triggerMode === 'next_day_market_prediction') {
        console.log(`📱 [CRON-FB-DAILY] ${cronExecutionId} Sending daily validation via Facebook`);
        await sendDailyValidationWithTracking(analysisResult, env, cronExecutionId);
        console.log(`✅ [CRON-FB-DAILY] ${cronExecutionId} Daily Facebook message completed`);
      }
      console.log(`📱 [CRON-FB-COMPLETE] ${cronExecutionId} All Facebook messaging completed for ${triggerMode}`);
    }

    // Store results in KV using DAL
    if (analysisResult) {
      const dal: DataAccessLayer = createDAL(env);
      let dateStr = estTime.toISOString().split('T')[0];
      const timeStr = estTime.toISOString().substr(11, 8).replace(/:/g, '');

      const timestampedKey = `analysis_${dateStr}_${timeStr}`;
      const dailyKey = `analysis_${dateStr}`;

      console.log(`💾 [CRON-DAL] ${cronExecutionId} storing results with keys: ${timestampedKey} and ${dailyKey}`);

      try {
        // Store the timestamped analysis using DAL
        const timestampedResult = await dal.write(
          timestampedKey,
          {
            ...analysisResult,
            cron_execution_id: cronExecutionId,
            trigger_mode: triggerMode,
            timestamp: estTime.toISOString()
          },
          KVUtils.getOptions('analysis')
        );

        if (timestampedResult.success) {
          console.log(`✅ [CRON-DAL] ${cronExecutionId} Timestamped key stored: ${timestampedKey}`);
        } else {
          console.error(`❌ [CRON-DAL] ${cronExecutionId} Timestamped write failed: ${timestampedResult.error}`);
        }

        // Update the daily summary using DAL
        const dailyResult = await dal.write(
          dailyKey,
          {
            ...analysisResult,
            cron_execution_id: cronExecutionId,
            trigger_mode: triggerMode,
            last_updated: estTime.toISOString()
          },
          KVUtils.getOptions('daily_summary')
        );

        if (dailyResult.success) {
          console.log(`✅ [CRON-DAL] ${cronExecutionId} Daily key stored: ${dailyKey}`);
        } else {
          console.error(`❌ [CRON-DAL] ${cronExecutionId} Daily write failed: ${dailyResult.error}`);
        }
      } catch (dalError: any) {
        console.error(`❌ [CRON-DAL-ERROR] ${cronExecutionId} DAL operation failed:`, {
          error: dalError.message,
          stack: dalError.stack,
          timestampedKey,
          dailyKey
        });
        // Continue execution even if DAL fails
      }
    }

    const cronDuration = Date.now() - scheduledTime.getTime();
    console.log(`✅ [CRON-COMPLETE] ${cronExecutionId}`, {
      trigger_mode: triggerMode,
      duration_ms: cronDuration,
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 0,
      facebook_status: env.FACEBOOK_PAGE_TOKEN ? 'sent' : 'skipped'
    });

    const response: CronResponse = {
      success: true,
      trigger_mode: triggerMode,
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 0,
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
