/**
 * Cron Scheduler Module
 * Handles all scheduled events (cron triggers) - fully modular
 */

import { runPreMarketAnalysis, runWeeklyMarketCloseAnalysis } from './analysis.js';
import { runEnhancedAnalysis, runEnhancedPreMarketAnalysis } from './enhanced_analysis.js';
import { generateWeeklyReviewAnalysis } from './report/weekly-review-analysis.js';
import {
  sendFridayWeekendReportWithTracking,
  sendWeeklyAccuracyReportWithTracking,
  sendMorningPredictionsWithTracking,
  sendMiddayValidationWithTracking,
  sendDailyValidationWithTracking
} from './facebook.js';
import { sendWeeklyReviewWithTracking } from './handlers/weekly-review-handlers.js';

/**
 * Handle scheduled cron events
 */
export async function handleScheduledEvent(controller, env, ctx) {
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
  let triggerMode, predictionHorizons;

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
    let analysisResult;
    
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
    
    // Store results in KV
    if (analysisResult) {
      let dateStr = estTime.toISOString().split('T')[0];
      const timeStr = estTime.toISOString().substr(11, 8).replace(/:/g, '');
      
      const timestampedKey = `analysis_${dateStr}_${timeStr}`;
      const dailyKey = `analysis_${dateStr}`;
      
      console.log(`💾 [CRON-KV] ${cronExecutionId} storing results with keys: ${timestampedKey} and ${dailyKey}`);
      
      // Store the timestamped analysis
      await env.TRADING_RESULTS.put(
        timestampedKey,
        JSON.stringify({
          ...analysisResult,
          cron_execution_id: cronExecutionId,
          trigger_mode: triggerMode,
          timestamp: estTime.toISOString()
        }),
        { expirationTtl: 604800 } // 7 days
      );
      
      // Update the daily summary
      await env.TRADING_RESULTS.put(
        dailyKey,
        JSON.stringify({
          ...analysisResult,
          cron_execution_id: cronExecutionId,
          trigger_mode: triggerMode,
          last_updated: estTime.toISOString()
        }),
        { expirationTtl: 604800 } // 7 days
      );
    }
    
    const cronDuration = Date.now() - scheduledTime.getTime();
    console.log(`✅ [CRON-COMPLETE] ${cronExecutionId}`, {
      trigger_mode: triggerMode,
      duration_ms: cronDuration,
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 0,
      facebook_status: env.FACEBOOK_PAGE_TOKEN ? 'sent' : 'skipped'
    });
    
    return new Response(JSON.stringify({
      success: true,
      trigger_mode: triggerMode,
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 0,
      execution_id: cronExecutionId,
      timestamp: estTime.toISOString()
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error(`❌ [CRON-ERROR] ${cronExecutionId}:`, error);
    
    // Send critical error alert if available
    if (env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 CRITICAL: Trading System Cron Failed`,
            attachments: [{
              color: 'danger',
              fields: [
                { title: 'Error', value: error.message, short: false },
                { title: 'Trigger Mode', value: triggerMode, short: true },
                { title: 'Time', value: estTime.toISOString(), short: true }
              ]
            }]
          }),
          signal: AbortSignal.timeout(10000)
        });
      } catch (alertError) {
        console.error('Failed to send error alert:', alertError);
      }
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      trigger_mode: triggerMode,
      execution_id: cronExecutionId,
      timestamp: estTime.toISOString()
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}