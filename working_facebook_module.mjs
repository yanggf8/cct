// Working Facebook Messenger module using import syntax
import fetch from 'node-fetch';

const FACEBOOK_PAGE_TOKEN = "EAAPCVgodoZCIBPca69MUJq6WNdbeUoZCAO8nKyiFVmpuJO5dwNA99JzzEASwNUQsi1a6qVWOo8FolOGNdk0qVZCl3wOeNpSrFbw0Yyvw2DLmPm3JGg1SNXrQD9nyemZA87ZCk1i9deyZAheoF4ZCFI22DZBVfruOCjfgju9rAqRnEBmyVED75B3qOoZAXTyUdDMMuCqrtXEpbbqrIRgefSstC06CJhyvn7E4UWLrAbNa0f1RnQw0CwAZDZD";
const FACEBOOK_RECIPIENT_ID = "10163155915743620";

// EXACT Facebook implementation from working commit c4ad8ea
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
    
    // Send daily summary using EXACT working implementation
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
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
    
    if (response.ok) {
      console.log('✅ Facebook daily summary sent successfully');
      const result = await response.json();
      console.log('📤 Response:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.json();
      console.log('❌ Facebook daily summary failed:', JSON.stringify(error, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Facebook daily summary error:', error.message);
  }
}

// Test function
async function testWorkingFacebook() {
  console.log('🧪 Testing WORKING Facebook module with import...');
  
  // Mock analysis results like the working version
  const mockAnalysis = {
    trading_signals: {
      "AAPL": {
        action: "HOLD NEUTRAL",
        confidence: 0.682,
        current_price: 238.47,
        reasoning: "NEUTRAL price prediction (TFT+N-HITS-Ensemble) + NEUTRAL sentiment"
      },
      "TSLA": {
        action: "HOLD NEUTRAL", 
        confidence: 0.678,
        current_price: 334.09,
        reasoning: "NEUTRAL price prediction (TFT+N-HITS-Ensemble) + NEUTRAL sentiment"
      }
    },
    performance_metrics: {
      success_rate: 100.0,
      avg_confidence: 0.680,
      high_confidence_signals: 0,
      signal_distribution: {"BUY": 0, "SELL": 0, "HOLD": 5}
    }
  };
  
  const env = {
    FACEBOOK_PAGE_TOKEN: FACEBOOK_PAGE_TOKEN,
    FACEBOOK_RECIPIENT_ID: FACEBOOK_RECIPIENT_ID
  };
  
  await sendFacebookDailySummary(mockAnalysis, env);
}

// Run test
testWorkingFacebook().catch(console.error);