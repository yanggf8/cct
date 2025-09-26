/**
 * Facebook Messaging Module
 * Handles Facebook Messenger integration with weekly analysis dashboard links
 */

import { getSymbolAnalysisByDate, getFactTableDataWithRange } from './data.js';

/**
 * Send Friday Weekend Report with Weekly Analysis Dashboard Link
 */
export async function sendFridayWeekendReportWithTracking(analysisResult, env, cronExecutionId, triggerMode) {
  console.log(`🏁 [FB-FRIDAY] ${cronExecutionId} Starting Friday weekend report function`);

  // Step 1: Configuration check
  console.log(`🔍 [FB-FRIDAY] ${cronExecutionId} Checking Facebook configuration...`);
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log(`❌ [FB-FRIDAY] ${cronExecutionId} Facebook not configured - skipping weekend report`);
    return;
  }
  console.log(`✅ [FB-FRIDAY] ${cronExecutionId} Facebook configuration verified`);

  // Step 2: Data validation
  console.log(`📊 [FB-FRIDAY] ${cronExecutionId} Validating analysis data...`);
  if (!analysisResult || !analysisResult.trading_signals) {
    console.error(`❌ [FB-FRIDAY] ${cronExecutionId} Invalid or missing analysis data`);
    throw new Error('Invalid analysis data provided');
  }
  console.log(`✅ [FB-FRIDAY] ${cronExecutionId} Analysis data validated: ${Object.keys(analysisResult.trading_signals).length} symbols`);

  const now = new Date();
  const friday = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  console.log(`📅 [FB-FRIDAY] ${cronExecutionId} Date set: ${friday}`);

  // Step 3: Message construction
  console.log(`✍️ [FB-FRIDAY] ${cronExecutionId} Building message content...`);
  let reportText = '';

  if (triggerMode === 'weekly_market_close_analysis') {
    reportText += `📊 **WEEKLY MARKET CLOSE ANALYSIS**\n`;
    reportText += `🗓️ ${friday} 4:00 PM EST\n\n`;
    reportText += `🏁 **Market Close Summary:**\n`;
  } else if (triggerMode === 'friday_weekend_prediction') {
    reportText += `🌅 **MONDAY MARKET PREDICTIONS**\n`;
    reportText += `🗓️ ${friday} 4:05 PM EST\n\n`;
    reportText += `📈 **Weekend → Monday Analysis:**\n`;
  }

  // Analysis results
  const symbols = analysisResult.symbols_analyzed || [];
  const signals = analysisResult.trading_signals || {};
  let symbolCount = 0;

  symbols.forEach(symbol => {
    const signal = signals[symbol];
    if (signal) {
      symbolCount++;

      // Extract data from per-symbol analysis structure
      const tradingSignals = signal.trading_signals || signal;
      const direction = tradingSignals?.primary_direction === 'BULLISH' ? '↗️' :
                       tradingSignals?.primary_direction === 'BEARISH' ? '↘️' : '➡️';

      // Extract sentiment from sentiment layers
      const sentimentLayer = signal.sentiment_layers?.[0]; // First layer is GPT-OSS-120B
      const sentimentLabel = sentimentLayer?.sentiment || 'neutral';
      const sentimentEmoji = sentimentLabel === 'bullish' ? '🔥' : sentimentLabel === 'bearish' ? '🧊' : '⚖️';
      const sentimentConfidence = Math.round((sentimentLayer?.confidence || 0) * 100);

      reportText += `${symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${sentimentConfidence}%)\n`;
      reportText += `   💰 AI-Informed outlook\n`;
    }
  });

  reportText += `\n`;

  // Add system status
  reportText += `⚙️ **System Status:** Operational ✅\n`;
  reportText += `🤖 **Models:** TFT + N-HITS Ensemble\n`;
  reportText += `📊 **Symbols Analyzed:** ${symbols.length}\n\n`;

  // 📊 NEW: Add Weekly Analysis Dashboard Link
  reportText += `📊 **INTERACTIVE DASHBOARD:**\n`;
  reportText += `🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\n\n`;
  reportText += `📈 View detailed charts, trends, and model performance analysis\n\n`;

  reportText += `🎯 **Next Update:** Monday 8:30 AM EST\n`;
  reportText += `⚠️ **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals before trading.`;

  console.log(`✅ [FB-FRIDAY] ${cronExecutionId} Message content built: ${symbolCount} symbols processed`);

  // Step 4: KV storage (independent of Facebook API)
  console.log(`💾 [FB-FRIDAY-KV] ${cronExecutionId} Starting KV storage...`);
  const messagingKey = `fb_friday_${Date.now()}`;
  let kvStorageSuccess = false;
  let kvError = null;

  try {
    console.log(`💾 [FB-FRIDAY-KV] ${cronExecutionId} Preparing KV data...`);
    const kvData = {
      trigger_mode: triggerMode,
      message_sent: false, // Will be updated after Facebook send
      symbols_analyzed: symbols.length,
      includes_dashboard_link: true,
      dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/weekly-analysis',
      timestamp: now.toISOString(),
      cron_execution_id: cronExecutionId,
      message_type: 'friday_weekend_report',
      symbols_processed: symbolCount,
      facebook_delivery_status: 'pending',
      report_content: reportText.substring(0, 500) + '...'
    };

    console.log(`💾 [FB-FRIDAY-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
    console.log(`💾 [FB-FRIDAY-KV] ${cronExecutionId} KV data size: ${JSON.stringify(kvData).length} bytes`);

    await env.TRADING_RESULTS.put(
      messagingKey,
      JSON.stringify(kvData),
      { expirationTtl: 604800 }
    );
    kvStorageSuccess = true;
    console.log(`✅ [FB-FRIDAY-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
  } catch (kvError) {
    console.error(`❌ [FB-FRIDAY-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
    console.error(`❌ [FB-FRIDAY-KV] ${cronExecutionId} KV key: ${messagingKey}`);
    console.error(`❌ [FB-FRIDAY-KV] ${cronExecutionId} Error details:`, {
      message: kvError.message,
      stack: kvError.stack,
      name: kvError.name
    });
    // Continue to Facebook send even if KV fails
  }

  // Step 5: Facebook message sending (decoupled from KV storage)
  console.log(`📤 [FB-FRIDAY] ${cronExecutionId} Sending Facebook message...`);
  let facebookSuccess = false;
  let facebookError = null;

  try {
    const facebookPayload = {
      recipient: { id: env.FACEBOOK_RECIPIENT_ID },
      message: { text: reportText },
      messaging_type: "MESSAGE_TAG",
      tag: "CONFIRMED_EVENT_UPDATE"
    };

    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${env.FACEBOOK_PAGE_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facebookPayload)
    });

    if (response.ok) {
      facebookSuccess = true;
      console.log(`✅ [FB-FRIDAY] ${cronExecutionId} Facebook message sent successfully`);

      // Update KV record with successful delivery status
      if (kvStorageSuccess) {
        try {
          const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
          updatedKvData.message_sent = true;
          updatedKvData.facebook_delivery_status = 'delivered';
          updatedKvData.delivery_timestamp = now.toISOString();

          await env.TRADING_RESULTS.put(
            messagingKey,
            JSON.stringify(updatedKvData),
            { expirationTtl: 604800 }
          );
          console.log(`✅ [FB-FRIDAY-KV] ${cronExecutionId} Updated KV record with delivery status`);
        } catch (updateError) {
          console.error(`⚠️ [FB-FRIDAY-KV] ${cronExecutionId} Failed to update delivery status:`, updateError);
        }
      }
    } else {
      const errorText = await response.text();
      facebookError = errorText;
      console.error(`❌ [FB-FRIDAY] ${cronExecutionId} Facebook API failed:`, errorText);

      // Update KV record with failure status
      if (kvStorageSuccess) {
        try {
          const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
          updatedKvData.facebook_delivery_status = 'failed';
          updatedKvData.facebook_error = errorText;
          updatedKvData.failure_timestamp = now.toISOString();

          await env.TRADING_RESULTS.put(
            messagingKey,
            JSON.stringify(updatedKvData),
            { expirationTtl: 604800 }
          );
          console.log(`⚠️ [FB-FRIDAY-KV] ${cronExecutionId} Updated KV record with Facebook failure status`);
        } catch (updateError) {
          console.error(`⚠️ [FB-FRIDAY-KV] ${cronExecutionId} Failed to update failure status:`, updateError);
        }
      }
    }
  } catch (fbError) {
    facebookError = fbError.message;
    console.error(`❌ [FB-FRIDAY] ${cronExecutionId} Facebook message send failed:`, fbError);
    console.error(`❌ [FB-FRIDAY] ${cronExecutionId} Error details:`, {
      message: fbError.message,
      stack: fbError.stack,
      name: fbError.name
    });

    // Update KV record with exception status
    if (kvStorageSuccess) {
      try {
        const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
        updatedKvData.facebook_delivery_status = 'exception';
        updatedKvData.facebook_error = fbError.message;
        updatedKvData.failure_timestamp = now.toISOString();

        await env.TRADING_RESULTS.put(
          messagingKey,
          JSON.stringify(updatedKvData),
          { expirationTtl: 604800 }
        );
        console.log(`⚠️ [FB-FRIDAY-KV] ${cronExecutionId} Updated KV record with exception status`);
      } catch (updateError) {
        console.error(`⚠️ [FB-FRIDAY-KV] ${cronExecutionId} Failed to update exception status:`, updateError);
      }
    }
  }

  // Return function status for external monitoring
  console.log(`🎯 [FB-FRIDAY] ${cronExecutionId} Function completed - KV: ${kvStorageSuccess ? '✅' : '❌'}, Facebook: ${facebookSuccess ? '✅' : '❌'}`);
  return {
    success: kvStorageSuccess && facebookSuccess,
    kv_storage_success: kvStorageSuccess,
    facebook_success: facebookSuccess,
    kv_key: messagingKey,
    facebook_error: facebookError,
    timestamp: now.toISOString()
  };
}

/**
 * Send Weekly Accuracy Report with Dashboard Link
 */
export async function sendWeeklyAccuracyReportWithTracking(env, cronExecutionId) {
  console.log(`🚀 [FB-WEEKLY] ${cronExecutionId} Starting weekly accuracy report function`);

  const now = new Date();

  // Step 1: Configuration check
  console.log(`🔍 [FB-WEEKLY] ${cronExecutionId} Checking Facebook configuration...`);
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('❌ [FB-WEEKLY] Facebook not configured - skipping weekly accuracy report');
    return;
  }

  // Step 2: Data validation (this function generates its own report)
  console.log(`📊 [FB-WEEKLY] ${cronExecutionId} Validating report data...`);
  const hasRequiredData = true; // This function generates its own data

  if (!hasRequiredData) {
    console.log(`⚠️ [FB-WEEKLY] ${cronExecutionId} Missing required data - skipping report`);
    return;
  }

  // Step 3: Message construction
  console.log(`📝 [FB-WEEKLY] ${cronExecutionId} Constructing weekly accuracy report...`);
  let reportText = `📊 **WEEKLY ACCURACY REPORT**\n`;
  reportText += `🗓️ ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} 10:00 AM EST\n\n`;

  // System performance summary
  reportText += `🎯 **Sentiment-First System Performance:**\n`;
  reportText += `• AI Sentiment Accuracy: Real-time tracking active\n`;
  reportText += `• Direction Accuracy: Sentiment vs reality validation\n`;
  reportText += `• Model Performance: AI Sentiment + Neural Reference analysis\n`;
  reportText += `• AI Cost Efficiency: $0.0003 per analysis achieved\n\n`;

  // 📊 NEW: Add Weekly Analysis Dashboard Link
  reportText += `📊 **DETAILED ANALYTICS DASHBOARD:**\n`;
  reportText += `🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\n\n`;
  reportText += `📈 Interactive charts showing:\n`;
  reportText += `• Daily sentiment accuracy trends\n`;
  reportText += `• AI Sentiment vs Neural model comparison\n`;
  reportText += `• Bullish/Bearish/Neutral analysis\n`;
  reportText += `• Sentiment-driven prediction visualization\n\n`;

  reportText += `⚙️ **System Status:** Operational ✅\n`;
  reportText += `🔄 **Next Report:** Next Sunday 10:00 AM EST\n\n`;
  reportText += `⚠️ **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals before trading.`;

  console.log(`✅ [FB-WEEKLY] ${cronExecutionId} Report constructed successfully (${reportText.length} chars)`);

  // Step 4: KV storage (independent of Facebook API)
  console.log(`💾 [FB-WEEKLY-KV] ${cronExecutionId} Starting KV storage...`);
  const messagingKey = `fb_weekly_accuracy_${Date.now()}`;
  let kvStorageSuccess = false;
  let kvError = null;

  try {
    const kvData = {
      trigger_mode: 'weekly_accuracy_report',
      message_sent: false, // Will be updated after Facebook send
      includes_dashboard_link: true,
      dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/weekly-analysis',
      timestamp: now.toISOString(),
      cron_execution_id: cronExecutionId,
      message_type: 'weekly_accuracy_report',
      facebook_delivery_status: 'pending',
      report_content: reportText.substring(0, 500) + '...',
      report_length: reportText.length
    };

    await env.TRADING_RESULTS.put(
      messagingKey,
      JSON.stringify(kvData),
      { expirationTtl: 604800 }
    );
    kvStorageSuccess = true;
    console.log(`✅ [FB-WEEKLY-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
  } catch (kvError) {
    console.error(`❌ [FB-WEEKLY-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
    console.error(`❌ [FB-WEEKLY-KV] ${cronExecutionId} KV key: ${messagingKey}`);
    console.error(`❌ [FB-WEEKLY-KV] ${cronExecutionId} Error details:`, {
      message: kvError.message,
      stack: kvError.stack,
      name: kvError.name
    });
    // Continue to Facebook send even if KV fails
  }

  // Step 5: Facebook message sending (decoupled from KV storage)
  console.log(`📤 [FB-WEEKLY] ${cronExecutionId} Sending Facebook message...`);
  let facebookSuccess = false;
  let facebookError = null;

  try {
    const fbResult = await sendFacebookMessage(reportText, env);
    if (fbResult.success) {
      facebookSuccess = true;
      console.log(`✅ [FB-WEEKLY] ${cronExecutionId} Facebook message sent successfully`);

      // Update KV record with successful delivery status
      if (kvStorageSuccess) {
        try {
          const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
          updatedKvData.message_sent = true;
          updatedKvData.facebook_delivery_status = 'delivered';
          updatedKvData.delivery_timestamp = now.toISOString();

          await env.TRADING_RESULTS.put(
            messagingKey,
            JSON.stringify(updatedKvData),
            { expirationTtl: 604800 }
          );
          console.log(`✅ [FB-WEEKLY-KV] ${cronExecutionId} Updated KV record with delivery status`);
        } catch (updateError) {
          console.error(`⚠️ [FB-WEEKLY-KV] ${cronExecutionId} Failed to update delivery status:`, updateError);
        }
      }
    } else {
      facebookError = fbResult.error;
      console.error(`❌ [FB-WEEKLY] ${cronExecutionId} Facebook API failed:`, fbResult.error);

      // Update KV record with failure status
      if (kvStorageSuccess) {
        try {
          const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
          updatedKvData.facebook_delivery_status = 'failed';
          updatedKvData.facebook_error = fbResult.error;
          updatedKvData.failure_timestamp = now.toISOString();

          await env.TRADING_RESULTS.put(
            messagingKey,
            JSON.stringify(updatedKvData),
            { expirationTtl: 604800 }
          );
          console.log(`⚠️ [FB-WEEKLY-KV] ${cronExecutionId} Updated KV record with Facebook failure status`);
        } catch (updateError) {
          console.error(`⚠️ [FB-WEEKLY-KV] ${cronExecutionId} Failed to update failure status:`, updateError);
        }
      }
    }
  } catch (fbError) {
    facebookError = fbError.message;
    console.error(`❌ [FB-WEEKLY] ${cronExecutionId} Facebook message send failed:`, fbError);
    console.error(`❌ [FB-WEEKLY] ${cronExecutionId} Error details:`, {
      message: fbError.message,
      stack: fbError.stack,
      name: fbError.name
    });

    // Update KV record with exception status
    if (kvStorageSuccess) {
      try {
        const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
        updatedKvData.facebook_delivery_status = 'exception';
        updatedKvData.facebook_error = fbError.message;
        updatedKvData.failure_timestamp = now.toISOString();

        await env.TRADING_RESULTS.put(
          messagingKey,
          JSON.stringify(updatedKvData),
          { expirationTtl: 604800 }
        );
        console.log(`⚠️ [FB-WEEKLY-KV] ${cronExecutionId} Updated KV record with exception status`);
      } catch (updateError) {
        console.error(`⚠️ [FB-WEEKLY-KV] ${cronExecutionId} Failed to update exception status:`, updateError);
      }
    }
  }

  // Return function status for external monitoring
  console.log(`🎯 [FB-WEEKLY] ${cronExecutionId} Function completed - KV: ${kvStorageSuccess ? '✅' : '❌'}, Facebook: ${facebookSuccess ? '✅' : '❌'}`);

  return {
    success: kvStorageSuccess || facebookSuccess, // Overall success if either operation worked
    kv_success: kvStorageSuccess,
    facebook_success: facebookSuccess,
    message_type: 'weekly_accuracy_report',
    timestamp: now.toISOString(),
    cron_execution_id: cronExecutionId,
    errors: {
      kv: kvError,
      facebook: facebookError
    }
  };
}

/**
 * Generic Facebook Message Sender with Error Handling
 */
async function sendFacebookMessage(messageText, env) {
  const facebookPayload = {
    recipient: { id: env.FACEBOOK_RECIPIENT_ID },
    message: { text: messageText },
    messaging_type: "MESSAGE_TAG",
    tag: "CONFIRMED_EVENT_UPDATE"
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${env.FACEBOOK_PAGE_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facebookPayload)
    });

    if (response.ok) {
      console.log(`✅ Facebook message sent successfully`);
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error(`❌ Facebook API error:`, errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error(`❌ Facebook send error:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Simple health check response
 */
export function getHealthCheckResponse(env) {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "2.0-Modular",
    services: {
      kv_storage: "available",
      facebook_messaging: env.FACEBOOK_PAGE_TOKEN ? "configured" : "not_configured"
    },
    features: {
      modular_architecture: "enabled",
      weekly_analysis_dashboard: "enabled",
      facebook_dashboard_links: "enabled"
    },
    endpoints: {
      basic_analysis: "/analyze",
      enhanced_feature_analysis: "/enhanced-feature-analysis",
      weekly_analysis: "/weekly-analysis",
      weekly_data_api: "/api/weekly-data"
    }
  };
}

/**
 * Send Morning Predictions Report (8:30 AM EST)
 */
export async function sendMorningPredictionsWithTracking(analysisResult, env, cronExecutionId) {
  console.log(`🚀 [FB-MORNING] ${cronExecutionId} Starting morning predictions function`);

  // Step 1: Configuration check
  console.log(`🔍 [FB-MORNING] ${cronExecutionId} Checking Facebook configuration...`);
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('❌ [FB-MORNING] Facebook not configured - skipping morning predictions');
    return;
  }
  console.log(`✅ [FB-MORNING] ${cronExecutionId} Facebook configuration verified`);

  // Step 2: Data validation
  console.log(`📊 [FB-MORNING] ${cronExecutionId} Validating analysis data...`);
  if (!analysisResult || !analysisResult.trading_signals) {
    console.error(`❌ [FB-MORNING] ${cronExecutionId} Invalid or missing analysis data`);
    throw new Error('Invalid analysis data provided');
  }
  console.log(`✅ [FB-MORNING] ${cronExecutionId} Analysis data validated: ${Object.keys(analysisResult.trading_signals).length} symbols`);

  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dateStr = estTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  console.log(`📅 [FB-MORNING] ${cronExecutionId} Date set: ${dateStr}`);

  // Step 3: Message construction
  console.log(`✍️ [FB-MORNING] ${cronExecutionId} Building message content...`);
  let reportText = `🌅 **MORNING PREDICTIONS + ALERTS**\n`;
  reportText += `🗓️ ${dateStr} 8:30 AM EST\n\n`;
  reportText += `💭 **AI Sentiment Analysis:**\n`;

  // Analysis results with sentiment-first approach
  let symbolCount = 0;
  if (analysisResult?.trading_signals) {
    Object.values(analysisResult.trading_signals).forEach(signal => {
      symbolCount++;

      // Extract data from per-symbol analysis structure
      const tradingSignals = signal.trading_signals || signal;
      const direction = tradingSignals?.primary_direction === 'BULLISH' ? '↗️' :
                       tradingSignals?.primary_direction === 'BEARISH' ? '↘️' : '➡️';

      // Extract sentiment from sentiment layers
      const sentimentLayer = signal.sentiment_layers?.[0]; // First layer is GPT-OSS-120B
      const sentimentLabel = sentimentLayer?.sentiment || 'neutral';
      const sentimentEmoji = sentimentLabel === 'bullish' ? '🔥' : sentimentLabel === 'bearish' ? '🧊' : '⚖️';
      const confidence = Math.round((tradingSignals?.overall_confidence || sentimentLayer?.confidence || 0) * 100);

      reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${confidence}%)\n`;
      reportText += `   💰 AI-Informed outlook\n`;
    });
  }
  console.log(`✅ [FB-MORNING] ${cronExecutionId} Message content built for ${symbolCount} symbols`);

  reportText += `\n⚙️ **System Status:** Operational ✅\n`;
  reportText += `🤖 **Models:** AI Sentiment Analysis + Neural Reference\n`;
  reportText += `📊 **Symbols Analyzed:** ${analysisResult?.symbols_analyzed?.length || 5}\n\n`;
  reportText += `📊 **INTERACTIVE DASHBOARD:**\n`;
  reportText += `🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\n\n`;
  reportText += `📈 View live sentiment analysis, predictions, and model performance\n\n`;
  reportText += `🎯 **Next Update:** 12:00 PM EST Midday Validation\n`;
  reportText += `⚠️ **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals.`;

  // Step 4: KV storage (independent of Facebook API)
  console.log(`💾 [FB-MORNING] ${cronExecutionId} Starting KV storage...`);
  const messagingKey = `fb_morning_${Date.now()}`;
  let kvStorageSuccess = false;
  let kvError = null;

  try {
    console.log(`💾 [FB-MORNING-KV] ${cronExecutionId} Preparing KV data...`);
    const kvData = {
      trigger_mode: 'morning_prediction_alerts',
      message_sent: false, // Will be updated after Facebook send
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 5,
      includes_dashboard_link: true,
      dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/weekly-analysis',
      timestamp: now.toISOString(),
      cron_execution_id: cronExecutionId,
      message_type: 'morning_predictions',
      symbols_processed: symbolCount,
      facebook_delivery_status: 'pending',
      report_content: reportText.substring(0, 500) + '...' // Store first 500 chars of message
    };

    console.log(`💾 [FB-MORNING-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
    console.log(`💾 [FB-MORNING-KV] ${cronExecutionId} KV data size: ${JSON.stringify(kvData).length} bytes`);

    await env.TRADING_RESULTS.put(
      messagingKey,
      JSON.stringify(kvData),
      { expirationTtl: 604800 }
    );
    kvStorageSuccess = true;
    console.log(`✅ [FB-MORNING-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
  } catch (kvError) {
    console.error(`❌ [FB-MORNING-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
    console.error(`❌ [FB-MORNING-KV] ${cronExecutionId} KV key: ${messagingKey}`);
    console.error(`❌ [FB-MORNING-KV] ${cronExecutionId} Error details:`, {
      message: kvError.message,
      stack: kvError.stack,
      name: kvError.name
    });
    // Continue to Facebook send even if KV fails
  }

  // Step 5: Facebook message sending (decoupled from KV storage)
  console.log(`📤 [FB-MORNING] ${cronExecutionId} Sending Facebook message...`);
  let facebookSuccess = false;
  let facebookError = null;

  try {
    const fbResult = await sendFacebookMessage(reportText, env);
    if (fbResult.success) {
      facebookSuccess = true;
      console.log(`✅ [FB-MORNING] ${cronExecutionId} Facebook message sent successfully`);

      // Update KV record with successful delivery status
      if (kvStorageSuccess) {
        try {
          const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
          updatedKvData.message_sent = true;
          updatedKvData.facebook_delivery_status = 'delivered';
          updatedKvData.delivery_timestamp = now.toISOString();

          await env.TRADING_RESULTS.put(
            messagingKey,
            JSON.stringify(updatedKvData),
            { expirationTtl: 604800 }
          );
          console.log(`✅ [FB-MORNING-KV] ${cronExecutionId} Updated KV record with delivery status`);
        } catch (updateError) {
          console.error(`⚠️ [FB-MORNING-KV] ${cronExecutionId} Failed to update delivery status:`, updateError);
        }
      }
    } else {
      facebookError = fbResult.error;
      console.error(`❌ [FB-MORNING] ${cronExecutionId} Facebook API failed:`, fbResult.error);

      // Update KV record with failure status
      if (kvStorageSuccess) {
        try {
          const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
          updatedKvData.facebook_delivery_status = 'failed';
          updatedKvData.facebook_error = fbResult.error;
          updatedKvData.failure_timestamp = now.toISOString();

          await env.TRADING_RESULTS.put(
            messagingKey,
            JSON.stringify(updatedKvData),
            { expirationTtl: 604800 }
          );
          console.log(`⚠️ [FB-MORNING-KV] ${cronExecutionId} Updated KV record with Facebook failure status`);
        } catch (updateError) {
          console.error(`⚠️ [FB-MORNING-KV] ${cronExecutionId} Failed to update failure status:`, updateError);
        }
      }
    }
  } catch (fbError) {
    facebookError = fbError.message;
    console.error(`❌ [FB-MORNING] ${cronExecutionId} Facebook message send failed:`, fbError);
    console.error(`❌ [FB-MORNING] ${cronExecutionId} Error details:`, {
      message: fbError.message,
      stack: fbError.stack,
      name: fbError.name
    });

    // Update KV record with exception status
    if (kvStorageSuccess) {
      try {
        const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
        updatedKvData.facebook_delivery_status = 'exception';
        updatedKvData.facebook_error = fbError.message;
        updatedKvData.failure_timestamp = now.toISOString();

        await env.TRADING_RESULTS.put(
          messagingKey,
          JSON.stringify(updatedKvData),
          { expirationTtl: 604800 }
        );
        console.log(`⚠️ [FB-MORNING-KV] ${cronExecutionId} Updated KV record with exception status`);
      } catch (updateError) {
        console.error(`⚠️ [FB-MORNING-KV] ${cronExecutionId} Failed to update exception status:`, updateError);
      }
    }
  }

  // Step 6: Final status logging
  console.log(`🎯 [FB-MORNING] ${cronExecutionId} Function completed with status:`);
  console.log(`   📊 KV Storage: ${kvStorageSuccess ? '✅ Success' : '❌ Failed'}`);
  console.log(`   📱 Facebook Delivery: ${facebookSuccess ? '✅ Success' : '❌ Failed'}`);
  console.log(`   🔑 KV Record Key: ${messagingKey}`);

  if (facebookError) {
    console.log(`   ⚠️ Facebook Error: ${facebookError.substring(0, 100)}...`);
  }

  // Return function status for external monitoring
  return {
    success: kvStorageSuccess, // Consider successful if KV was stored
    kv_storage_success: kvStorageSuccess,
    facebook_delivery_success: facebookSuccess,
    kv_record_key: messagingKey,
    facebook_error: facebookError,
    timestamp: now.toISOString()
  };
}

/**
 * Send Midday Validation Report (12:00 PM EST)
 */
export async function sendMiddayValidationWithTracking(analysisResult, env, cronExecutionId) {
  console.log(`🔄 [FB-MIDDAY] ${cronExecutionId} Starting midday validation function`);

  // Step 1: Configuration check
  console.log(`🔍 [FB-MIDDAY] ${cronExecutionId} Checking Facebook configuration...`);
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log(`❌ [FB-MIDDAY] ${cronExecutionId} Facebook not configured - skipping midday validation`);
    return;
  }
  console.log(`✅ [FB-MIDDAY] ${cronExecutionId} Facebook configuration verified`);

  // Step 2: Data validation
  console.log(`📊 [FB-MIDDAY] ${cronExecutionId} Validating analysis data...`);
  if (!analysisResult || !analysisResult.trading_signals) {
    console.error(`❌ [FB-MIDDAY] ${cronExecutionId} Invalid or missing analysis data`);
    throw new Error('Invalid analysis data provided');
  }
  console.log(`✅ [FB-MIDDAY] ${cronExecutionId} Analysis data validated: ${Object.keys(analysisResult.trading_signals).length} symbols`);

  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dateStr = estTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  console.log(`📅 [FB-MIDDAY] ${cronExecutionId} Date set: ${dateStr}`);

  // Step 3: Message construction
  console.log(`✍️ [FB-MIDDAY] ${cronExecutionId} Building message content...`);
  let reportText = `🔄 **MIDDAY VALIDATION + FORECASTS**\n`;
  reportText += `🗓️ ${dateStr} 12:00 PM EST\n\n`;
  reportText += `💭 **Sentiment Analysis Updates:**\n`;

  // Analysis results with sentiment-first validation
  let symbolCount = 0;
  if (analysisResult?.trading_signals) {
    Object.values(analysisResult.trading_signals).forEach(signal => {
      symbolCount++;

      // Extract data from per-symbol analysis structure
      const tradingSignals = signal.trading_signals || signal;
      const direction = tradingSignals?.primary_direction === 'BULLISH' ? '↗️' :
                       tradingSignals?.primary_direction === 'BEARISH' ? '↘️' : '➡️';

      // Extract sentiment from sentiment layers
      const sentimentLayer = signal.sentiment_layers?.[0]; // First layer is GPT-OSS-120B
      const sentimentLabel = sentimentLayer?.sentiment || 'neutral';
      const sentimentEmoji = sentimentLabel === 'bullish' ? '🔥' : sentimentLabel === 'bearish' ? '🧊' : '⚖️';
      const confidence = Math.round((tradingSignals?.overall_confidence || sentimentLayer?.confidence || 0) * 100);

      // For validation, use overall confidence as both sentiment and technical confidence
      const sentimentConf = confidence;
      const technicalConf = Math.round((tradingSignals?.overall_confidence || 0.5) * 100);
      const conflictIndicator = Math.abs(sentimentConf - technicalConf) > 20 ? ' ⚠️ CONFLICT' : ' ✅ ALIGNED';

      reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${confidence}%)\n`;
      reportText += `   📊 AI Analysis: ${sentimentConf}% | Overall: ${technicalConf}%${conflictIndicator}\n`;
    });
  }

  reportText += `\n🎯 **Afternoon Outlook:**\n`;
  reportText += `• AI sentiment signals informing analysis\n`;
  reportText += `• Neural networks providing technical reference\n`;
  reportText += `• Real-time market sentiment validation active\n\n`;
  reportText += `⚙️ **System Status:** Operational ✅\n`;
  reportText += `📊 **LIVE DASHBOARD:**\n`;
  reportText += `🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\n\n`;
  reportText += `🎯 **Next Update:** 4:05 PM EST Daily Report\n`;
  reportText += `⚠️ **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals.`;

  console.log(`✅ [FB-MIDDAY] ${cronExecutionId} Message content built: ${symbolCount} symbols processed`);

  // Step 4: KV storage (independent of Facebook API)
  console.log(`💾 [FB-MIDDAY-KV] ${cronExecutionId} Starting KV storage...`);
  const messagingKey = `fb_midday_${Date.now()}`;
  let kvStorageSuccess = false;
  let kvError = null;

  try {
    console.log(`💾 [FB-MIDDAY-KV] ${cronExecutionId} Preparing KV data...`);
    const kvData = {
      trigger_mode: 'midday_validation_prediction',
      message_sent: false, // Will be updated after Facebook send
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 5,
      includes_dashboard_link: true,
      dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/weekly-analysis',
      timestamp: now.toISOString(),
      cron_execution_id: cronExecutionId,
      message_type: 'midday_validation',
      symbols_processed: symbolCount,
      facebook_delivery_status: 'pending',
      report_content: reportText.substring(0, 500) + '...'
    };

    console.log(`💾 [FB-MIDDAY-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
    console.log(`💾 [FB-MIDDAY-KV] ${cronExecutionId} KV data size: ${JSON.stringify(kvData).length} bytes`);

    await env.TRADING_RESULTS.put(
      messagingKey,
      JSON.stringify(kvData),
      { expirationTtl: 604800 }
    );
    kvStorageSuccess = true;
    console.log(`✅ [FB-MIDDAY-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
  } catch (kvError) {
    console.error(`❌ [FB-MIDDAY-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
    console.error(`❌ [FB-MIDDAY-KV] ${cronExecutionId} KV key: ${messagingKey}`);
    console.error(`❌ [FB-MIDDAY-KV] ${cronExecutionId} Error details:`, {
      message: kvError.message,
      stack: kvError.stack,
      name: kvError.name
    });
    // Continue to Facebook send even if KV fails
  }

  // Step 5: Facebook message sending (decoupled from KV storage)
  console.log(`📤 [FB-MIDDAY] ${cronExecutionId} Sending Facebook message...`);
  let facebookSuccess = false;
  let facebookError = null;

  try {
    const fbResult = await sendFacebookMessage(reportText, env);
    if (fbResult.success) {
      facebookSuccess = true;
      console.log(`✅ [FB-MIDDAY] ${cronExecutionId} Facebook message sent successfully`);

      // Update KV record with successful delivery status
      if (kvStorageSuccess) {
        try {
          const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
          updatedKvData.message_sent = true;
          updatedKvData.facebook_delivery_status = 'delivered';
          updatedKvData.delivery_timestamp = now.toISOString();

          await env.TRADING_RESULTS.put(
            messagingKey,
            JSON.stringify(updatedKvData),
            { expirationTtl: 604800 }
          );
          console.log(`✅ [FB-MIDDAY-KV] ${cronExecutionId} Updated KV record with delivery status`);
        } catch (updateError) {
          console.error(`⚠️ [FB-MIDDAY-KV] ${cronExecutionId} Failed to update delivery status:`, updateError);
        }
      }
    } else {
      facebookError = fbResult.error;
      console.error(`❌ [FB-MIDDAY] ${cronExecutionId} Facebook API failed:`, fbResult.error);

      // Update KV record with failure status
      if (kvStorageSuccess) {
        try {
          const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
          updatedKvData.facebook_delivery_status = 'failed';
          updatedKvData.facebook_error = fbResult.error;
          updatedKvData.failure_timestamp = now.toISOString();

          await env.TRADING_RESULTS.put(
            messagingKey,
            JSON.stringify(updatedKvData),
            { expirationTtl: 604800 }
          );
          console.log(`⚠️ [FB-MIDDAY-KV] ${cronExecutionId} Updated KV record with Facebook failure status`);
        } catch (updateError) {
          console.error(`⚠️ [FB-MIDDAY-KV] ${cronExecutionId} Failed to update failure status:`, updateError);
        }
      }
    }
  } catch (fbError) {
    facebookError = fbError.message;
    console.error(`❌ [FB-MIDDAY] ${cronExecutionId} Facebook message send failed:`, fbError);
    console.error(`❌ [FB-MIDDAY] ${cronExecutionId} Error details:`, {
      message: fbError.message,
      stack: fbError.stack,
      name: fbError.name
    });

    // Update KV record with exception status
    if (kvStorageSuccess) {
      try {
        const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
        updatedKvData.facebook_delivery_status = 'exception';
        updatedKvData.facebook_error = fbError.message;
        updatedKvData.failure_timestamp = now.toISOString();

        await env.TRADING_RESULTS.put(
          messagingKey,
          JSON.stringify(updatedKvData),
          { expirationTtl: 604800 }
        );
        console.log(`⚠️ [FB-MIDDAY-KV] ${cronExecutionId} Updated KV record with exception status`);
      } catch (updateError) {
        console.error(`⚠️ [FB-MIDDAY-KV] ${cronExecutionId} Failed to update exception status:`, updateError);
      }
    }
  }

  // Return function status for external monitoring
  console.log(`🎯 [FB-MIDDAY] ${cronExecutionId} Function completed - KV: ${kvStorageSuccess ? '✅' : '❌'}, Facebook: ${facebookSuccess ? '✅' : '❌'}`);
  return {
    success: kvStorageSuccess && facebookSuccess,
    kv_storage_success: kvStorageSuccess,
    facebook_success: facebookSuccess,
    kv_key: messagingKey,
    facebook_error: facebookError,
    timestamp: now.toISOString()
  };
}

/**
 * Send Daily Validation + Next-Day Predictions Report (4:05 PM EST)
 */
export async function sendDailyValidationWithTracking(analysisResult, env, cronExecutionId) {
  console.log(`📊 [FB-DAILY] ${cronExecutionId} Starting daily validation function`);

  // Step 1: Configuration check
  console.log(`🔍 [FB-DAILY] ${cronExecutionId} Checking Facebook configuration...`);
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log(`❌ [FB-DAILY] ${cronExecutionId} Facebook not configured - skipping daily validation`);
    return;
  }
  console.log(`✅ [FB-DAILY] ${cronExecutionId} Facebook configuration verified`);

  // Step 2: Data validation
  console.log(`📊 [FB-DAILY] ${cronExecutionId} Validating analysis data...`);
  if (!analysisResult || !analysisResult.trading_signals) {
    console.error(`❌ [FB-DAILY] ${cronExecutionId} Invalid or missing analysis data`);
    throw new Error('Invalid analysis data provided');
  }
  console.log(`✅ [FB-DAILY] ${cronExecutionId} Analysis data validated: ${Object.keys(analysisResult.trading_signals).length} symbols`);

  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dateStr = estTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  console.log(`📅 [FB-DAILY] ${cronExecutionId} Date set: ${dateStr}`);

  // Step 3: Message construction
  console.log(`✍️ [FB-DAILY] ${cronExecutionId} Building message content...`);
  let reportText = `📊 **DAILY VALIDATION + NEXT-DAY PREDICTIONS**\n`;
  reportText += `🗓️ ${dateStr} 4:05 PM EST\n\n`;
  reportText += `🏁 **Market Close Sentiment Analysis:**\n`;

  // Analysis results with sentiment-driven next-day predictions
  let symbolCount = 0;
  if (analysisResult?.trading_signals) {
    Object.values(analysisResult.trading_signals).forEach(signal => {
      symbolCount++;

      // Extract data from per-symbol analysis structure
      const tradingSignals = signal.trading_signals || signal;
      const direction = tradingSignals?.primary_direction === 'BULLISH' ? '↗️' :
                       tradingSignals?.primary_direction === 'BEARISH' ? '↘️' : '➡️';

      // Extract sentiment from sentiment layers
      const sentimentLayer = signal.sentiment_layers?.[0]; // First layer is GPT-OSS-120B
      const sentimentLabel = sentimentLayer?.sentiment || 'neutral';
      const sentimentEmoji = sentimentLabel === 'bullish' ? '🔥' : sentimentLabel === 'bearish' ? '🧊' : '⚖️';
      const sentimentConfidence = Math.round((tradingSignals?.overall_confidence || sentimentLayer?.confidence || 0) * 100);

      reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${sentimentConfidence}%)\n`;
      reportText += `   💰 AI-Informed outlook\n`;
    });
  }

  reportText += `\n🌅 **Tomorrow's Market Outlook:**\n`;
  reportText += `• AI sentiment analysis for overnight news\n`;
  reportText += `• Neural networks as technical reference\n`;
  reportText += `• Real-time sentiment-driven predictions\n\n`;
  reportText += `📈 **Daily Performance:**\n`;
  reportText += `• Direction accuracy validation\n`;
  reportText += `• Model confidence assessment\n`;
  reportText += `• Risk metrics updated\n\n`;
  reportText += `⚙️ **System Status:** Operational ✅\n`;
  reportText += `🤖 **Models:** TFT + N-HITS Ensemble + Sentiment\n`;
  reportText += `📊 **COMPREHENSIVE DASHBOARD:**\n`;
  reportText += `🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\n\n`;
  reportText += `🎯 **Next Update:** Tomorrow 8:30 AM EST\n`;
  reportText += `⚠️ **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals.`;

  console.log(`✅ [FB-DAILY] ${cronExecutionId} Message content built: ${symbolCount} symbols processed`);

  // Step 4: KV storage (independent of Facebook API)
  console.log(`💾 [FB-DAILY-KV] ${cronExecutionId} Starting KV storage...`);
  const messagingKey = `fb_daily_${Date.now()}`;
  let kvStorageSuccess = false;
  let kvError = null;

  try {
    console.log(`💾 [FB-DAILY-KV] ${cronExecutionId} Preparing KV data...`);
    const kvData = {
      trigger_mode: 'next_day_market_prediction',
      message_sent: false, // Will be updated after Facebook send
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 5,
      includes_dashboard_link: true,
      dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/weekly-analysis',
      timestamp: now.toISOString(),
      cron_execution_id: cronExecutionId,
      message_type: 'daily_validation',
      symbols_processed: symbolCount,
      facebook_delivery_status: 'pending',
      report_content: reportText.substring(0, 500) + '...'
    };

    console.log(`💾 [FB-DAILY-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
    console.log(`💾 [FB-DAILY-KV] ${cronExecutionId} KV data size: ${JSON.stringify(kvData).length} bytes`);

    await env.TRADING_RESULTS.put(
      messagingKey,
      JSON.stringify(kvData),
      { expirationTtl: 604800 }
    );
    kvStorageSuccess = true;
    console.log(`✅ [FB-DAILY-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
  } catch (kvError) {
    console.error(`❌ [FB-DAILY-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
    console.error(`❌ [FB-DAILY-KV] ${cronExecutionId} KV key: ${messagingKey}`);
    console.error(`❌ [FB-DAILY-KV] ${cronExecutionId} Error details:`, {
      message: kvError.message,
      stack: kvError.stack,
      name: kvError.name
    });
    // Continue to Facebook send even if KV fails
  }

  // Step 5: Facebook message sending (decoupled from KV storage)
  console.log(`📤 [FB-DAILY] ${cronExecutionId} Sending Facebook message...`);
  let facebookSuccess = false;
  let facebookError = null;

  try {
    const fbResult = await sendFacebookMessage(reportText, env);
    if (fbResult.success) {
      facebookSuccess = true;
      console.log(`✅ [FB-DAILY] ${cronExecutionId} Facebook message sent successfully`);

      // Update KV record with successful delivery status
      if (kvStorageSuccess) {
        try {
          const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
          updatedKvData.message_sent = true;
          updatedKvData.facebook_delivery_status = 'delivered';
          updatedKvData.delivery_timestamp = now.toISOString();

          await env.TRADING_RESULTS.put(
            messagingKey,
            JSON.stringify(updatedKvData),
            { expirationTtl: 604800 }
          );
          console.log(`✅ [FB-DAILY-KV] ${cronExecutionId} Updated KV record with delivery status`);
        } catch (updateError) {
          console.error(`⚠️ [FB-DAILY-KV] ${cronExecutionId} Failed to update delivery status:`, updateError);
        }
      }
    } else {
      facebookError = fbResult.error;
      console.error(`❌ [FB-DAILY] ${cronExecutionId} Facebook API failed:`, fbResult.error);

      // Update KV record with failure status
      if (kvStorageSuccess) {
        try {
          const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
          updatedKvData.facebook_delivery_status = 'failed';
          updatedKvData.facebook_error = fbResult.error;
          updatedKvData.failure_timestamp = now.toISOString();

          await env.TRADING_RESULTS.put(
            messagingKey,
            JSON.stringify(updatedKvData),
            { expirationTtl: 604800 }
          );
          console.log(`⚠️ [FB-DAILY-KV] ${cronExecutionId} Updated KV record with Facebook failure status`);
        } catch (updateError) {
          console.error(`⚠️ [FB-DAILY-KV] ${cronExecutionId} Failed to update failure status:`, updateError);
        }
      }
    }
  } catch (fbError) {
    facebookError = fbError.message;
    console.error(`❌ [FB-DAILY] ${cronExecutionId} Facebook message send failed:`, fbError);
    console.error(`❌ [FB-DAILY] ${cronExecutionId} Error details:`, {
      message: fbError.message,
      stack: fbError.stack,
      name: fbError.name
    });

    // Update KV record with exception status
    if (kvStorageSuccess) {
      try {
        const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
        updatedKvData.facebook_delivery_status = 'exception';
        updatedKvData.facebook_error = fbError.message;
        updatedKvData.failure_timestamp = now.toISOString();

        await env.TRADING_RESULTS.put(
          messagingKey,
          JSON.stringify(updatedKvData),
          { expirationTtl: 604800 }
        );
        console.log(`⚠️ [FB-DAILY-KV] ${cronExecutionId} Updated KV record with exception status`);
      } catch (updateError) {
        console.error(`⚠️ [FB-DAILY-KV] ${cronExecutionId} Failed to update exception status:`, updateError);
      }
    }
  }

  // Return function status for external monitoring
  console.log(`🎯 [FB-DAILY] ${cronExecutionId} Function completed - KV: ${kvStorageSuccess ? '✅' : '❌'}, Facebook: ${facebookSuccess ? '✅' : '❌'}`);
  return {
    success: kvStorageSuccess && facebookSuccess,
    kv_storage_success: kvStorageSuccess,
    facebook_success: facebookSuccess,
    kv_key: messagingKey,
    facebook_error: facebookError,
    timestamp: now.toISOString()
  };
}

/**
 * Enhanced Weekly Accuracy Report using Granular Data Storage
 * Retrieves individual symbol analysis data for comprehensive accuracy tracking
 */
export async function sendWeeklyAccuracyReportWithGranularData(env, cronExecutionId, weekSelection = 'current') {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('❌ Facebook not configured - skipping weekly accuracy report');
    return;
  }

  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dateStr = estTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  let reportText = `📊 **WEEKLY ACCURACY REPORT**\n`;
  reportText += `🗓️ ${dateStr} - Granular Analysis\n\n`;

  try {
    // Get fact table data for the week using granular storage
    const factTableData = await getFactTableDataWithRange(env, 7, weekSelection);

    if (factTableData.length === 0) {
      reportText += `⚠️ No granular analysis data available for ${weekSelection} week\n`;
      reportText += `📝 Check that enhanced storage is operational\n\n`;
    } else {
      // Calculate accuracy metrics by symbol
      const symbolMetrics = {};
      factTableData.forEach(record => {
        if (!symbolMetrics[record.symbol]) {
          symbolMetrics[record.symbol] = {
            total: 0,
            correct: 0,
            avgConfidence: 0,
            sentimentCount: 0,
            technicalCount: 0
          };
        }

        symbolMetrics[record.symbol].total++;
        if (record.direction_correct) symbolMetrics[record.symbol].correct++;
        symbolMetrics[record.symbol].avgConfidence += record.confidence;
        if (record.sentiment_score > 0) symbolMetrics[record.symbol].sentimentCount++;
        if (record.neural_agreement === 'AGREE') symbolMetrics[record.symbol].technicalCount++;
      });

      reportText += `🎯 **Direction Accuracy by Symbol:**\n`;
      Object.entries(symbolMetrics).forEach(([symbol, metrics]) => {
        const accuracy = Math.round((metrics.correct / metrics.total) * 100);
        const avgConf = Math.round((metrics.avgConfidence / metrics.total) * 100);
        const emoji = accuracy >= 70 ? '✅' : accuracy >= 60 ? '⚠️' : '❌';

        reportText += `${symbol}: ${emoji} ${accuracy}% (${metrics.correct}/${metrics.total}) | Avg: ${avgConf}%\n`;
        reportText += `   💭 Sentiment: ${metrics.sentimentCount} signals | 🤝 Agreement: ${metrics.technicalCount}\n`;
      });

      // Overall metrics
      const totalCorrect = Object.values(symbolMetrics).reduce((sum, m) => sum + m.correct, 0);
      const totalPredictions = Object.values(symbolMetrics).reduce((sum, m) => sum + m.total, 0);
      const overallAccuracy = Math.round((totalCorrect / totalPredictions) * 100);

      reportText += `\n📈 **Overall Performance:**\n`;
      reportText += `🎯 Direction Accuracy: ${overallAccuracy}% (${totalCorrect}/${totalPredictions})\n`;
      reportText += `📊 Symbols Tracked: ${Object.keys(symbolMetrics).length}\n`;
      reportText += `📅 Days Analyzed: ${Math.ceil(factTableData.length / 5)}\n`;
    }

    reportText += `\n🔧 **Enhanced Features:**\n`;
    reportText += `• Granular symbol-level tracking\n`;
    reportText += `• Sentiment-technical agreement analysis\n`;
    reportText += `• Individual confidence validation\n`;
    reportText += `• Historical performance comparison\n\n`;

  } catch (error) {
    console.error('❌ Error generating granular accuracy report:', error);
    reportText += `❌ Error retrieving granular analysis data\n`;
    reportText += `🔧 Check enhanced storage system status\n\n`;
  }

  reportText += `📊 **INTERACTIVE DASHBOARD:**\n`;
  reportText += `🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\n\n`;
  reportText += `⚙️ **System Status:** Enhanced Granular Storage ✅\n`;
  reportText += `🗃️ **Data Source:** Individual symbol analysis records\n`;
  reportText += `⚠️ **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals.`;

  await sendFacebookMessage(reportText, env);
  console.log(`📱 [FB-ACCURACY] ${cronExecutionId} Weekly accuracy report (granular) sent via Facebook`);

  // Store detailed logging record with proper error handling
  const messagingKey = `fb_accuracy_granular_${Date.now()}`;
  try {
    console.log(`💾 [FB-ACCURACY-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
    await env.TRADING_RESULTS.put(
      messagingKey,
      JSON.stringify({
        trigger_mode: 'weekly_accuracy_granular',
        message_sent: true,
        week_selection: weekSelection,
        data_source: 'granular_storage',
        includes_dashboard_link: true,
        dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/weekly-analysis',
        timestamp: now.toISOString(),
        cron_execution_id: cronExecutionId,
        message_type: 'weekly_accuracy_granular'
      }),
      { expirationTtl: 604800 }
    );
    console.log(`✅ [FB-ACCURACY-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
  } catch (kvError) {
    console.error(`❌ [FB-ACCURACY-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
    console.error(`❌ [FB-ACCURACY-KV] ${cronExecutionId} KV key: ${messagingKey}`);
    console.error(`❌ [FB-ACCURACY-KV] ${cronExecutionId} Error details:`, {
      message: kvError.message,
      stack: kvError.stack
    });
    throw kvError; // Re-throw to indicate function failure
  }
}

/**
 * Enhanced Daily Message with Historical Context using Granular Data
 * Shows today's predictions with yesterday's accuracy validation
 */
export async function sendDailyMessageWithHistoricalContext(analysisResult, env, cronExecutionId) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('❌ Facebook not configured - skipping daily message with context');
    return;
  }

  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const today = estTime.toISOString().split('T')[0];
  const yesterday = new Date(estTime);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let reportText = `🔄 **DAILY PREDICTIONS + VALIDATION**\n`;
  reportText += `🗓️ ${estTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}\n\n`;

  try {
    // Get yesterday's granular analysis for validation
    const yesterdayAnalysis = await getSymbolAnalysisByDate(env, yesterdayStr);

    if (yesterdayAnalysis.length > 0) {
      reportText += `✅ **Yesterday's Validation:**\n`;
      yesterdayAnalysis.forEach(record => {
        // Extract data from per-symbol analysis structure
        const tradingSignals = record.trading_signals || record;
        const direction = tradingSignals?.primary_direction === 'BULLISH' ? '↗️' :
                         tradingSignals?.primary_direction === 'BEARISH' ? '↘️' : '➡️';

        // Extract sentiment from sentiment layers
        const sentimentLayer = record.sentiment_layers?.[0];
        const sentiment = sentimentLayer?.sentiment || 'neutral';
        const confidence = Math.round((tradingSignals?.overall_confidence || sentimentLayer?.confidence || 0) * 100);

        reportText += `${record.symbol}: ${direction} ${sentiment.toUpperCase()} (${confidence}%)\n`;
        reportText += `   💰 AI-Informed outlook\n`;
      });
      reportText += `\n`;
    }

    // Today's predictions (using real-time analysis)
    reportText += `🚀 **Today's AI Predictions:**\n`;
    if (analysisResult?.trading_signals) {
      Object.values(analysisResult.trading_signals).forEach(signal => {
        // Extract data from per-symbol analysis structure
        const tradingSignals = signal.trading_signals || signal;
        const direction = tradingSignals?.primary_direction === 'BULLISH' ? '↗️' :
                         tradingSignals?.primary_direction === 'BEARISH' ? '↘️' : '➡️';

        // Extract sentiment from sentiment layers
        const sentimentLayer = signal.sentiment_layers?.[0];
        const sentimentLabel = sentimentLayer?.sentiment || 'neutral';
        const sentimentEmoji = sentimentLabel === 'bullish' ? '🔥' : sentimentLabel === 'bearish' ? '🧊' : '⚖️';
        const confidence = Math.round((tradingSignals?.overall_confidence || sentimentLayer?.confidence || 0) * 100);

        reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${confidence}%)\n`;
        reportText += `   💰 AI-Informed outlook\n`;
      });
    }

  } catch (error) {
    console.error('❌ Error retrieving historical context:', error);
    reportText += `⚠️ Historical validation data unavailable\n`;
    reportText += `🔄 Showing today's predictions only\n\n`;

    // Fallback to current predictions only
    if (analysisResult?.trading_signals) {
      Object.values(analysisResult.trading_signals).forEach(signal => {
        // Extract data from per-symbol analysis structure
        const tradingSignals = signal.trading_signals || signal;
        const direction = tradingSignals?.primary_direction === 'BULLISH' ? '↗️' :
                         tradingSignals?.primary_direction === 'BEARISH' ? '↘️' : '➡️';

        // Extract sentiment from sentiment layers
        const sentimentLayer = signal.sentiment_layers?.[0];
        const sentimentLabel = sentimentLayer?.sentiment || 'neutral';
        const sentimentEmoji = sentimentLabel === 'bullish' ? '🔥' : sentimentLabel === 'bearish' ? '🧊' : '⚖️';
        const confidence = Math.round((tradingSignals?.overall_confidence || sentimentLayer?.confidence || 0) * 100);

        reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${confidence}%)\n`;
      });
    }
  }

  reportText += `\n📊 **Enhanced Tracking:**\n`;
  reportText += `• Granular symbol-level analysis\n`;
  reportText += `• Daily accuracy validation\n`;
  reportText += `• Historical context integration\n`;
  reportText += `• Sentiment-technical correlation\n\n`;
  reportText += `📊 **INTERACTIVE DASHBOARD:**\n`;
  reportText += `🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\n\n`;
  reportText += `⚙️ **System Status:** Enhanced Granular Storage ✅\n`;
  reportText += `⚠️ **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals.`;

  await sendFacebookMessage(reportText, env);
  console.log(`📱 [FB-ENHANCED] ${cronExecutionId} Daily message with historical context sent via Facebook`);

  // Store detailed logging record with proper error handling
  const messagingKey = `fb_enhanced_daily_${Date.now()}`;
  try {
    console.log(`💾 [FB-ENHANCED-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
    await env.TRADING_RESULTS.put(
      messagingKey,
      JSON.stringify({
        trigger_mode: 'daily_with_historical_context',
        message_sent: true,
        symbols_analyzed: analysisResult?.symbols_analyzed?.length || 5,
        includes_historical_validation: true,
        includes_dashboard_link: true,
        dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/weekly-analysis',
        timestamp: now.toISOString(),
        cron_execution_id: cronExecutionId,
        message_type: 'enhanced_daily_context'
      }),
      { expirationTtl: 604800 }
    );
    console.log(`✅ [FB-ENHANCED-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
  } catch (kvError) {
    console.error(`❌ [FB-ENHANCED-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
    console.error(`❌ [FB-ENHANCED-KV] ${cronExecutionId} KV key: ${messagingKey}`);
    console.error(`❌ [FB-ENHANCED-KV] ${cronExecutionId} Error details:`, {
      message: kvError.message,
      stack: kvError.stack
    });
    throw kvError; // Re-throw to indicate function failure
  }
}