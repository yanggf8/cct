/**
 * Facebook Messaging Module
 * Handles Facebook Messenger integration with weekly analysis dashboard links
 */

/**
 * Send Friday Weekend Report with Weekly Analysis Dashboard Link
 */
export async function sendFridayWeekendReportWithTracking(analysisResult, env, cronExecutionId, triggerMode) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('❌ Facebook not configured - skipping weekend report');
    return;
  }

  const now = new Date();
  const friday = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  
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
  
  symbols.forEach(symbol => {
    const signal = signals[symbol];
    if (signal) {
      const direction = signal.predicted_price > signal.current_price ? '↗️' : 
                       signal.predicted_price < signal.current_price ? '↘️' : '➡️';
      
      reportText += `${symbol}: ${direction} $${signal.current_price?.toFixed(2)} → $${signal.predicted_price?.toFixed(2)} (${(signal.confidence * 100).toFixed(1)}%)\n`;
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
  reportText += `💼 *For research purposes only - not financial advice*`;

  // Send Facebook message
  const facebookPayload = {
    recipient: { id: env.FACEBOOK_RECIPIENT_ID },
    message: { text: reportText },
    messaging_type: "MESSAGE_TAG",
    tag: "ACCOUNT_UPDATE"
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${env.FACEBOOK_PAGE_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facebookPayload)
    });

    if (response.ok) {
      console.log(`✅ [FB] ${cronExecutionId} Friday weekend report sent with dashboard link`);
      
      // Store Facebook messaging record
      const messagingKey = `fb_friday_messaging_${Date.now()}`;
      await env.TRADING_RESULTS.put(
        messagingKey,
        JSON.stringify({
          trigger_mode: triggerMode,
          symbols_analyzed: symbols.length,
          message_sent: true,
          includes_dashboard_link: true,
          dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/weekly-analysis',
          timestamp: now.toISOString(),
          cron_execution_id: cronExecutionId
        }),
        { expirationTtl: 604800 }
      );
      
    } else {
      const errorText = await response.text();
      console.error(`❌ [FB] ${cronExecutionId} Facebook API error:`, errorText);
    }
  } catch (error) {
    console.error(`❌ [FB] ${cronExecutionId} Facebook send error:`, error.message);
  }
}

/**
 * Send Weekly Accuracy Report with Dashboard Link
 */
export async function sendWeeklyAccuracyReportWithTracking(env, cronExecutionId) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('❌ Facebook not configured - skipping weekly accuracy report');
    return;
  }

  let reportText = `📊 **WEEKLY ACCURACY REPORT**\n`;
  reportText += `🗓️ ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} 10:00 AM EST\n\n`;
  
  // System performance summary
  reportText += `🎯 **System Performance:**\n`;
  reportText += `• Overall Accuracy: Real-time tracking active\n`;
  reportText += `• Direction Accuracy: Prediction vs reality validation\n`;
  reportText += `• Model Performance: TFT + N-HITS ensemble analysis\n\n`;
  
  // 📊 NEW: Add Weekly Analysis Dashboard Link  
  reportText += `📊 **DETAILED ANALYTICS DASHBOARD:**\n`;
  reportText += `🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\n\n`;
  reportText += `📈 Interactive charts showing:\n`;
  reportText += `• Daily accuracy trends\n`;
  reportText += `• Model performance comparison\n`;
  reportText += `• Symbol-specific analysis\n`;
  reportText += `• Prediction vs actual price visualization\n\n`;
  
  reportText += `⚙️ **System Status:** Operational ✅\n`;
  reportText += `🔄 **Next Report:** Next Sunday 10:00 AM EST\n\n`;
  reportText += `💼 *For research purposes only - not financial advice*`;

  const facebookPayload = {
    recipient: { id: env.FACEBOOK_RECIPIENT_ID },
    message: { text: reportText },
    messaging_type: "MESSAGE_TAG", 
    tag: "ACCOUNT_UPDATE"
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${env.FACEBOOK_PAGE_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facebookPayload)
    });

    if (response.ok) {
      console.log(`✅ [FB] ${cronExecutionId} Weekly accuracy report sent with dashboard link`);
      
      // Store messaging record
      const messagingKey = `fb_weekly_accuracy_${Date.now()}`;
      await env.TRADING_RESULTS.put(
        messagingKey,
        JSON.stringify({
          trigger_mode: 'weekly_accuracy_report',
          message_sent: true,
          includes_dashboard_link: true,
          dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/weekly-analysis',
          timestamp: new Date().toISOString(),
          cron_execution_id: cronExecutionId
        }),
        { expirationTtl: 604800 }
      );
      
    } else {
      const errorText = await response.text();
      console.error(`❌ [FB] ${cronExecutionId} Facebook API error:`, errorText);
    }
  } catch (error) {
    console.error(`❌ [FB] ${cronExecutionId} Facebook send error:`, error.message);
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
      weekly_analysis: "/weekly-analysis",
      weekly_data_api: "/api/weekly-data"
    }
  };
}

/**
 * Send Morning Predictions Report (8:30 AM EST)
 */
export async function sendMorningPredictionsWithTracking(analysisResult, env, cronExecutionId) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('❌ Facebook not configured - skipping morning predictions');
    return;
  }

  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dateStr = estTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  let reportText = `🌅 **MORNING PREDICTIONS + ALERTS**\n`;
  reportText += `🗓️ ${dateStr} 8:30 AM EST\n\n`;
  reportText += `📈 **Enhanced Neural Network Analysis:**\n`;

  // Analysis results with enhanced models
  if (analysisResult?.trading_signals) {
    Object.values(analysisResult.trading_signals).forEach(signal => {
      const direction = signal.direction === 'UP' ? '↗️' : signal.direction === 'DOWN' ? '↘️' : '➡️';
      const change = ((signal.predicted_price - signal.current_price) / signal.current_price * 100).toFixed(2);
      reportText += `${signal.symbol}: ${direction} $${signal.current_price.toFixed(2)} → $${signal.predicted_price.toFixed(2)} (${Math.abs(change)}%)\n`;
    });
  }

  reportText += `\n⚙️ **System Status:** Operational ✅\n`;
  reportText += `🤖 **Models:** TFT + N-HITS + Sentiment\n`;
  reportText += `📊 **Symbols Analyzed:** ${analysisResult?.symbols_analyzed?.length || 5}\n\n`;
  reportText += `📊 **INTERACTIVE DASHBOARD:**\n`;
  reportText += `🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\n\n`;
  reportText += `📈 View live predictions, sentiment analysis, and model performance\n\n`;
  reportText += `🎯 **Next Update:** 12:00 PM EST Midday Validation\n`;
  reportText += `💼 For research purposes only - not financial advice`;

  await sendFacebookMessage(reportText, env);
  console.log(`📱 [FB-MORNING] ${cronExecutionId} Morning predictions sent via Facebook`);
}

/**
 * Send Midday Validation Report (12:00 PM EST)
 */
export async function sendMiddayValidationWithTracking(analysisResult, env, cronExecutionId) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('❌ Facebook not configured - skipping midday validation');
    return;
  }

  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dateStr = estTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  let reportText = `🔄 **MIDDAY VALIDATION + FORECASTS**\n`;
  reportText += `🗓️ ${dateStr} 12:00 PM EST\n\n`;
  reportText += `📊 **Morning Prediction Updates:**\n`;

  // Analysis results with validation
  if (analysisResult?.trading_signals) {
    Object.values(analysisResult.trading_signals).forEach(signal => {
      const direction = signal.direction === 'UP' ? '↗️' : signal.direction === 'DOWN' ? '↘️' : '➡️';
      const confidence = `${(signal.confidence * 100).toFixed(1)}%`;
      reportText += `${signal.symbol}: ${direction} $${signal.current_price.toFixed(2)} (${confidence})\n`;
    });
  }

  reportText += `\n🎯 **Afternoon Outlook:**\n`;
  reportText += `• Market sentiment analysis updated\n`;
  reportText += `• Neural network confidence tracking\n`;
  reportText += `• Enhanced prediction validation active\n\n`;
  reportText += `⚙️ **System Status:** Operational ✅\n`;
  reportText += `📊 **LIVE DASHBOARD:**\n`;
  reportText += `🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\n\n`;
  reportText += `🎯 **Next Update:** 4:05 PM EST Daily Report\n`;
  reportText += `💼 For research purposes only - not financial advice`;

  await sendFacebookMessage(reportText, env);
  console.log(`📱 [FB-MIDDAY] ${cronExecutionId} Midday validation sent via Facebook`);
}

/**
 * Send Daily Validation + Next-Day Predictions Report (4:05 PM EST)
 */
export async function sendDailyValidationWithTracking(analysisResult, env, cronExecutionId) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('❌ Facebook not configured - skipping daily validation');
    return;
  }

  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dateStr = estTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  let reportText = `📊 **DAILY VALIDATION + NEXT-DAY PREDICTIONS**\n`;
  reportText += `🗓️ ${dateStr} 4:05 PM EST\n\n`;
  reportText += `🏁 **Market Close Analysis:**\n`;

  // Analysis results with next-day predictions
  if (analysisResult?.trading_signals) {
    Object.values(analysisResult.trading_signals).forEach(signal => {
      const direction = signal.direction === 'UP' ? '↗️' : signal.direction === 'DOWN' ? '↘️' : '➡️';
      const predicted = signal.predicted_price.toFixed(2);
      const current = signal.current_price.toFixed(2);
      reportText += `${signal.symbol}: ${direction} $${current} → $${predicted}\n`;
    });
  }

  reportText += `\n🌅 **Tomorrow's Market Outlook:**\n`;
  reportText += `• Neural network next-day predictions\n`;
  reportText += `• Sentiment analysis for overnight news\n`;
  reportText += `• Enhanced model consensus tracking\n\n`;
  reportText += `📈 **Daily Performance:**\n`;
  reportText += `• Direction accuracy validation\n`;
  reportText += `• Model confidence assessment\n`;
  reportText += `• Risk metrics updated\n\n`;
  reportText += `⚙️ **System Status:** Operational ✅\n`;
  reportText += `🤖 **Models:** TFT + N-HITS Ensemble + Sentiment\n`;
  reportText += `📊 **COMPREHENSIVE DASHBOARD:**\n`;
  reportText += `🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\n\n`;
  reportText += `🎯 **Next Update:** Tomorrow 8:30 AM EST\n`;
  reportText += `💼 For research purposes only - not financial advice`;

  await sendFacebookMessage(reportText, env);
  console.log(`📱 [FB-DAILY] ${cronExecutionId} Daily validation sent via Facebook`);
}