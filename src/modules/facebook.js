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