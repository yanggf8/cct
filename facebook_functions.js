async function sendFacebookDailySummary(analysisResults, env) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('⚠️ Facebook Messenger not configured for daily summary');
    return;
  }

  try {
    const date = new Date().toLocaleDateString('en-US');
    const signals = Object.entries(analysisResults.trading_signals || {});
    
    let summaryText = `📊 Daily Trading Summary - ${date}\n\n`;
    
    if (signals.length > 0) {
      summaryText += `📈 Today's Analysis (${signals.length} symbols):\n\n`;
      
      signals.forEach(([symbol, signal]) => {
        const confidenceEmoji = signal.confidence > 0.8 ? '🔥' : signal.confidence > 0.6 ? '📈' : '💭';
        summaryText += `${confidenceEmoji} ${symbol}: ${signal.action}\n`;
        summaryText += `   💰 $${signal.current_price.toFixed(2)} | ${(signal.confidence * 100).toFixed(1)}%\n`;
        summaryText += `   ${signal.reasoning.substring(0, 50)}...\n\n`;
      });
      
      // Add performance metrics
      const perf = analysisResults.performance_metrics;
      summaryText += `📊 Performance Metrics:\n`;
      summaryText += `• Success Rate: ${perf.success_rate.toFixed(1)}%\n`;
      summaryText += `• Average Confidence: ${(perf.avg_confidence * 100).toFixed(1)}%\n`;
      summaryText += `• High Confidence Signals: ${perf.high_confidence_signals}\n`;
      summaryText += `• Signal Distribution: ${JSON.stringify(perf.signal_distribution)}`;
      
    } else {
      summaryText += `No trading signals generated today.\n\nSystem Status: Operational ✅`;
    }

    // Send daily summary
    await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.FACEBOOK_PAGE_TOKEN}`
      },
      body: JSON.stringify({
        recipient: { id: env.FACEBOOK_RECIPIENT_ID },
        message: { text: summaryText },
        messaging_type: 'UPDATE'
      })
    });

    console.log('✅ Facebook daily summary sent');

  } catch (error) {
    console.error('❌ Facebook daily summary failed:', error);
  }
}

/**
 * Send critical error alert with retry
 */
async function sendCriticalAlertWithRetry(errorMessage, env, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sendCriticalAlert(errorMessage, env);
      console.log(`✅ Critical alert sent (attempt ${attempt})`);
      return;
    } catch (error) {
      console.log(`⚠️ Critical alert failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
  }
  console.error(`❌ All ${maxRetries} critical alert attempts failed`);
}

/**
 * Send critical error alert
 */
async function sendCriticalAlert(errorMessage, env) {
  if (env.SLACK_WEBHOOK_URL) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    try {
      await fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '🚨 CRITICAL: Trading System Worker Failed',
          attachments: [{
            color: 'danger',
            fields: [
              { title: 'Error', value: errorMessage, short: false },
              { title: 'Timestamp', value: new Date().toISOString(), short: true },
              { title: 'Circuit Breakers', value: JSON.stringify({
                ModelScope: circuitBreaker.modelScope.isOpen ? 'OPEN' : 'CLOSED',
                Yahoo: circuitBreaker.yahooFinance.isOpen ? 'OPEN' : 'CLOSED',
                AI: circuitBreaker.cloudflareAI.isOpen ? 'OPEN' : 'CLOSED'
              }), short: true }
            ]
          }]
        }),
