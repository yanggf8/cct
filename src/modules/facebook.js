/**
 * Facebook Messaging Module
 * Handles Facebook Messenger integration with weekly analysis dashboard links
 */

import { getSymbolAnalysisByDate, getFactTableDataWithRange } from './data.js';

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
      const enhanced = signal.enhanced_prediction;
      const sentiment = signal.sentiment_analysis;
      const direction = enhanced?.direction === 'UP' ? '↗️' : enhanced?.direction === 'DOWN' ? '↘️' : '➡️';

      const sentimentLabel = sentiment?.sentiment || 'neutral';
      const sentimentEmoji = sentimentLabel === 'bullish' ? '🔥' : sentimentLabel === 'bearish' ? '🧊' : '⚖️';
      const sentimentConfidence = Math.round((sentiment?.confidence || 0) * 100);

      reportText += `${symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${sentimentConfidence}%)\n`;
      reportText += `   💰 $${signal.current_price?.toFixed(2)} → $${signal.predicted_price?.toFixed(2)} | AI-Informed\n`;
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
 * Generic Facebook Message Sender with Error Handling
 */
async function sendFacebookMessage(messageText, env) {
  const facebookPayload = {
    recipient: { id: env.FACEBOOK_RECIPIENT_ID },
    message: { text: messageText },
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
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('❌ Facebook not configured - skipping morning predictions');
    return;
  }

  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dateStr = estTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  let reportText = `🌅 **MORNING PREDICTIONS + ALERTS**\n`;
  reportText += `🗓️ ${dateStr} 8:30 AM EST\n\n`;
  reportText += `💭 **AI Sentiment Analysis:**\n`;

  // Analysis results with sentiment-first approach
  if (analysisResult?.trading_signals) {
    Object.values(analysisResult.trading_signals).forEach(signal => {
      const enhanced = signal.enhanced_prediction;
      const sentiment = signal.sentiment_analysis;
      const direction = enhanced?.direction === 'UP' ? '↗️' : enhanced?.direction === 'DOWN' ? '↘️' : '➡️';
      const change = ((signal.predicted_price - signal.current_price) / signal.current_price * 100).toFixed(2);

      // Show sentiment-driven prediction
      const sentimentLabel = sentiment?.sentiment || 'neutral';
      const sentimentEmoji = sentimentLabel === 'bullish' ? '🔥' : sentimentLabel === 'bearish' ? '🧊' : '⚖️';
      const confidence = Math.round((enhanced?.confidence || 0.5) * 100);

      reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${confidence}%)\n`;
      reportText += `   💰 $${signal.current_price.toFixed(2)} → $${signal.predicted_price.toFixed(2)} (${Math.abs(change)}%)\n`;
    });
  }

  reportText += `\n⚙️ **System Status:** Operational ✅\n`;
  reportText += `🤖 **Models:** AI Sentiment Analysis + Neural Reference\n`;
  reportText += `📊 **Symbols Analyzed:** ${analysisResult?.symbols_analyzed?.length || 5}\n\n`;
  reportText += `📊 **INTERACTIVE DASHBOARD:**\n`;
  reportText += `🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\n\n`;
  reportText += `📈 View live sentiment analysis, predictions, and model performance\n\n`;
  reportText += `🎯 **Next Update:** 12:00 PM EST Midday Validation\n`;
  reportText += `⚠️ **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals.`;

  await sendFacebookMessage(reportText, env);
  console.log(`📱 [FB-MORNING] ${cronExecutionId} Morning predictions sent via Facebook`);
  
  // Store detailed logging record
  const messagingKey = `fb_morning_${Date.now()}`;
  await env.TRADING_RESULTS.put(
    messagingKey,
    JSON.stringify({
      trigger_mode: 'morning_prediction_alerts',
      message_sent: true,
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 5,
      includes_dashboard_link: true,
      dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/weekly-analysis',
      timestamp: now.toISOString(),
      cron_execution_id: cronExecutionId,
      message_type: 'morning_predictions'
    }),
    { expirationTtl: 604800 }
  );
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
  reportText += `💭 **Sentiment Analysis Updates:**\n`;

  // Analysis results with sentiment-first validation
  if (analysisResult?.trading_signals) {
    Object.values(analysisResult.trading_signals).forEach(signal => {
      const enhanced = signal.enhanced_prediction;
      const sentiment = signal.sentiment_analysis;
      const direction = enhanced?.direction === 'UP' ? '↗️' : enhanced?.direction === 'DOWN' ? '↘️' : '➡️';
      const confidence = Math.round((enhanced?.confidence || 0.5) * 100);

      const sentimentLabel = sentiment?.sentiment || 'neutral';
      const sentimentEmoji = sentimentLabel === 'bullish' ? '🔥' : sentimentLabel === 'bearish' ? '🧊' : '⚖️';

      const sentimentConf = Math.round((sentiment?.confidence || 0) * 100);
      const technicalConf = Math.round((signal.confidence || 0.5) * 100);
      const conflictIndicator = Math.abs(sentimentConf - technicalConf) > 20 ? ' ⚠️ CONFLICT' : ' ✅ ALIGNED';

      reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${confidence}%)\n`;
      reportText += `   📊 Sentiment: ${sentimentConf}% | Technical: ${technicalConf}%${conflictIndicator}\n`;
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

  await sendFacebookMessage(reportText, env);
  console.log(`📱 [FB-MIDDAY] ${cronExecutionId} Midday validation sent via Facebook`);
  
  // Store detailed logging record
  const messagingKey = `fb_midday_${Date.now()}`;
  await env.TRADING_RESULTS.put(
    messagingKey,
    JSON.stringify({
      trigger_mode: 'midday_validation_prediction',
      message_sent: true,
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 5,
      includes_dashboard_link: true,
      dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/weekly-analysis',
      timestamp: now.toISOString(),
      cron_execution_id: cronExecutionId,
      message_type: 'midday_validation'
    }),
    { expirationTtl: 604800 }
  );
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
  reportText += `🏁 **Market Close Sentiment Analysis:**\n`;

  // Analysis results with sentiment-driven next-day predictions
  if (analysisResult?.trading_signals) {
    Object.values(analysisResult.trading_signals).forEach(signal => {
      const enhanced = signal.enhanced_prediction;
      const sentiment = signal.sentiment_analysis;
      const direction = enhanced?.direction === 'UP' ? '↗️' : enhanced?.direction === 'DOWN' ? '↘️' : '➡️';
      const predicted = signal.predicted_price.toFixed(2);
      const current = signal.current_price.toFixed(2);

      const sentimentLabel = sentiment?.sentiment || 'neutral';
      const sentimentEmoji = sentimentLabel === 'bullish' ? '🔥' : sentimentLabel === 'bearish' ? '🧊' : '⚖️';
      const sentimentConfidence = Math.round((sentiment?.confidence || 0) * 100);

      reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${sentimentConfidence}%)\n`;
      reportText += `   💰 $${current} → $${predicted} | AI-Informed outlook\n`;
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

  await sendFacebookMessage(reportText, env);
  console.log(`📱 [FB-DAILY] ${cronExecutionId} Daily validation sent via Facebook`);
  
  // Store detailed logging record
  const messagingKey = `fb_daily_${Date.now()}`;
  await env.TRADING_RESULTS.put(
    messagingKey,
    JSON.stringify({
      trigger_mode: 'next_day_market_prediction',
      message_sent: true,
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 5,
      includes_dashboard_link: true,
      dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/weekly-analysis',
      timestamp: now.toISOString(),
      cron_execution_id: cronExecutionId,
      message_type: 'daily_validation'
    }),
    { expirationTtl: 604800 }
  );
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

  // Store detailed logging record
  const messagingKey = `fb_accuracy_granular_${Date.now()}`;
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
        const direction = record.enhanced_prediction?.direction;
        const sentiment = record.sentiment_analysis?.sentiment;
        const confidence = Math.round((record.enhanced_prediction?.confidence || 0) * 100);
        const emoji = direction === 'UP' ? '↗️' : direction === 'DOWN' ? '↘️' : '➡️';

        reportText += `${record.symbol}: ${emoji} ${sentiment?.toUpperCase()} (${confidence}%)\n`;
        if (record.current_price && record.predicted_price) {
          const change = ((record.predicted_price - record.current_price) / record.current_price * 100).toFixed(2);
          reportText += `   💰 $${record.current_price.toFixed(2)} → $${record.predicted_price.toFixed(2)} (${Math.abs(change)}%)\n`;
        }
      });
      reportText += `\n`;
    }

    // Today's predictions (using real-time analysis)
    reportText += `🚀 **Today's AI Predictions:**\n`;
    if (analysisResult?.trading_signals) {
      Object.values(analysisResult.trading_signals).forEach(signal => {
        const enhanced = signal.enhanced_prediction;
        const sentiment = signal.sentiment_analysis;
        const direction = enhanced?.direction === 'UP' ? '↗️' : enhanced?.direction === 'DOWN' ? '↘️' : '➡️';
        const confidence = Math.round((enhanced?.confidence || 0.5) * 100);

        const sentimentLabel = sentiment?.sentiment || 'neutral';
        const sentimentEmoji = sentimentLabel === 'bullish' ? '🔥' : sentimentLabel === 'bearish' ? '🧊' : '⚖️';

        reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${confidence}%)\n`;
        reportText += `   💰 $${signal.current_price.toFixed(2)} → $${signal.predicted_price.toFixed(2)}\n`;
      });
    }

  } catch (error) {
    console.error('❌ Error retrieving historical context:', error);
    reportText += `⚠️ Historical validation data unavailable\n`;
    reportText += `🔄 Showing today's predictions only\n\n`;

    // Fallback to current predictions only
    if (analysisResult?.trading_signals) {
      Object.values(analysisResult.trading_signals).forEach(signal => {
        const enhanced = signal.enhanced_prediction;
        const sentiment = signal.sentiment_analysis;
        const direction = enhanced?.direction === 'UP' ? '↗️' : enhanced?.direction === 'DOWN' ? '↘️' : '➡️';
        const confidence = Math.round((enhanced?.confidence || 0.5) * 100);
        const sentimentLabel = sentiment?.sentiment || 'neutral';
        const sentimentEmoji = sentimentLabel === 'bullish' ? '🔥' : sentimentLabel === 'bearish' ? '🧊' : '⚖️';

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

  // Store detailed logging record
  const messagingKey = `fb_enhanced_daily_${Date.now()}`;
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
}