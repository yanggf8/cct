/**
 * Cron Scheduler Module
 * Handles all scheduled events (cron triggers) - fully modular
 */

import { runPreMarketAnalysis, runWeeklyMarketCloseAnalysis } from './analysis.js';
import { runEnhancedAnalysis, runEnhancedPreMarketAnalysis } from './enhanced_analysis.js';
import { sendFridayWeekendReportWithTracking, sendWeeklyAccuracyReportWithTracking } from './facebook.js';

/**
 * Handle scheduled cron events
 */
export async function handleScheduledEvent(controller, env, ctx) {
  const scheduledTime = new Date(controller.scheduledTime);
  const estTime = new Date(scheduledTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const currentHour = estTime.getHours();
  const currentMinute = estTime.getMinutes();
  
  console.log(`🕐 [MODULAR-CRON] ${estTime.toISOString()} - Cron trigger received (${currentHour}:${currentMinute.toString().padStart(2, '0')})`);
  
  const cronExecutionId = `cron_${Date.now()}`;
  let triggerMode, predictionHorizons;
  
  // Determine trigger mode and prediction horizons
  if (currentHour === 8 && currentMinute === 30) {
    // 8:30 AM - Phase 1: 2-horizon predictions + high-confidence alerts
    triggerMode = 'morning_prediction_alerts';
    predictionHorizons = [1, 24]; // 1-hour and 24-hour forecasts
  } else if (currentHour === 12 && currentMinute === 0) {
    // 12:00 PM - Validate morning predictions + afternoon forecasts
    triggerMode = 'midday_validation_prediction';
    predictionHorizons = [8, 24]; // 8-hour (market close) + next-day
  } else if (currentHour === 16 && currentMinute === 0 && estTime.getDay() === 5) {
    // 4:00 PM Friday - Weekly market close comprehensive analysis
    triggerMode = 'weekly_market_close_analysis';
    predictionHorizons = [72, 168]; // Weekend + next week
  } else if (currentHour === 16 && currentMinute === 5) {
    // 4:05 PM - Daily validation report + next-day predictions
    triggerMode = 'next_day_market_prediction';
    predictionHorizons = [17, 24]; // Market close + next trading day
  } else if (currentHour === 10 && currentMinute === 0 && estTime.getDay() === 0) {
    // 10:00 AM Sunday - Weekly accuracy report
    triggerMode = 'weekly_accuracy_report';
    predictionHorizons = []; // No predictions, just accuracy reporting
  } else {
    console.log(`⚠️ [CRON] Unrecognized schedule: ${currentHour}:${currentMinute} on ${estTime.toDateString()}`);
    return new Response('Unrecognized cron schedule', { status: 400 });
  }
  
  console.log(`✅ [CRON-START] ${cronExecutionId}`, {
    trigger_mode: triggerMode,
    est_time: estTime.toISOString(),
    prediction_horizons: predictionHorizons
  });
  
  try {
    let analysisResult;
    
    if (triggerMode === 'weekly_accuracy_report') {
      // Sunday 10:00 AM - Weekly accuracy report
      console.log(`📊 [CRON-WEEKLY] ${cronExecutionId} Generating weekly accuracy report`);
      
      await sendWeeklyAccuracyReportWithTracking(env, cronExecutionId);
      
      console.log(`✅ [CRON-COMPLETE-WEEKLY] ${cronExecutionId} Weekly accuracy report completed`);
      return new Response('Weekly accuracy report sent successfully', { status: 200 });
      
    } else if (triggerMode === 'weekly_market_close_analysis') {
      // Friday 4:00 PM - Weekly market close analysis
      console.log(`🏁 [CRON-FRIDAY] ${cronExecutionId} Running weekly market close analysis`);
      
      analysisResult = await runWeeklyMarketCloseAnalysis(env, estTime);
      
      // Send Friday weekend report with dashboard link
      await sendFridayWeekendReportWithTracking(analysisResult, env, cronExecutionId, triggerMode);
      
    } else {
      // Enhanced pre-market analysis with sentiment
      console.log(`🚀 [CRON-ENHANCED] ${cronExecutionId} Running enhanced analysis with sentiment...`);
      analysisResult = await runEnhancedPreMarketAnalysis(env, {
        triggerMode,
        predictionHorizons,
        currentTime: estTime,
        cronExecutionId
      });
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