/**
 * Cloudflare Worker - Automated Pre-Market Trading Analysis
 * Runs TFT+N-HITS trading system analysis at scheduled times (6:30-9:30 AM EST)
 * Uses real Neural Hierarchical Interpolation for Time Series as backup
 * Stores results in Cloudflare KV for retrieval by local system
 * Supports Email, Slack, Facebook Messenger, and LINE alerts
 */

// Import messenger alert functions
import { sendFacebookMessengerAlert, sendLINEAlert, sendCriticalMessengerAlert } from './messenger-alerts.js';

export default {
  async scheduled(controller, env, ctx) {
    const scheduledTime = new Date(controller.scheduledTime);
    const estTime = new Date(scheduledTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
    
    console.log(`🚀 Scheduled analysis triggered at ${estTime.toISOString()}`);
    
    try {
      const analysisResult = await runPreMarketAnalysis(env);
      
      // Store results in KV for local system retrieval
      await env.TRADING_RESULTS.put(
        `analysis_${estTime.toISOString().split('T')[0]}`, // YYYY-MM-DD key
        JSON.stringify(analysisResult),
        { expirationTtl: 86400 } // 24 hours
      );
      
      // Send notifications if enabled
      if (analysisResult.alerts && analysisResult.alerts.length > 0) {
        await sendAlerts(analysisResult, env);
      }
      
      console.log(`✅ Analysis completed: ${analysisResult.symbols_analyzed.length} symbols`);
      
    } catch (error) {
      console.error(`❌ Scheduled analysis failed:`, error);
      
      // Store error for debugging
      await env.TRADING_RESULTS.put(
        `error_${estTime.toISOString()}`,
        JSON.stringify({
          error: error.message,
          timestamp: estTime.toISOString(),
          type: 'scheduled_analysis_failure'
        }),
        { expirationTtl: 86400 }
      );
      
      // Send critical alert
      await sendCriticalAlert(error.message, env);
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle different endpoints
    if (url.pathname === '/analyze') {
      return handleManualAnalysis(request, env);
    } else if (url.pathname === '/results') {
      return handleGetResults(request, env);
    } else if (url.pathname === '/health') {
      return handleHealthCheck(request, env);
    } else {
      return new Response('Trading System Worker API\nEndpoints: /analyze, /results, /health', { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};

/**
 * Run complete pre-market analysis for all symbols
 */
async function runPreMarketAnalysis(env) {
  const symbols = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'NVDA'];
  const analysisResults = {
    run_id: `worker_${new Date().toISOString().replace(/[:.]/g, '_')}`,
    timestamp: new Date().toISOString(),
    symbols_analyzed: [],
    trading_signals: {},
    alerts: [],
    performance_metrics: {},
    status: 'running',
    worker_version: '1.0-Cloudflare'
  };
  
  console.log(`📊 Starting analysis for ${symbols.length} symbols...`);
  
  // Analyze each symbol
  for (const symbol of symbols) {
    try {
      console.log(`   📈 Analyzing ${symbol}...`);
      
      // Get market data
      const marketData = await getMarketData(symbol);
      if (!marketData.success) {
        throw new Error(`Market data failed: ${marketData.error}`);
      }
      
      // Get TFT prediction (primary)
      let priceSignal;
      try {
        priceSignal = await getTFTPrediction(symbol, marketData.data, env);
        priceSignal.model_used = 'TFT-Primary';
      } catch (tftError) {
        console.log(`   ⚠️ TFT failed for ${symbol}, using N-HITS backup: ${tftError.message}`);
        // Fallback to real N-HITS neural network model
        priceSignal = await getRealNHITSPrediction(symbol, marketData.data, env);
        priceSignal.model_used = priceSignal.model_type || 'Real-NHITS-Backup';
      }
      
      // Get sentiment analysis
      const sentimentSignal = await getSentimentAnalysis(symbol, env);
      
      // Combine signals
      const combinedSignal = combineSignals(priceSignal, sentimentSignal, symbol, marketData.current_price);
      
      analysisResults.symbols_analyzed.push(symbol);
      analysisResults.trading_signals[symbol] = combinedSignal;
      
      // Check for high-confidence signals
      if (combinedSignal.confidence > 0.85 && combinedSignal.action.includes('BUY') || combinedSignal.action.includes('SELL')) {
        analysisResults.alerts.push({
          level: 'HIGH_CONFIDENCE',
          symbol: symbol,
          message: `🎯 High confidence signal: ${symbol} - ${combinedSignal.action} (${(combinedSignal.confidence * 100).toFixed(1)}%)`,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`   ✅ ${symbol}: ${combinedSignal.action} (conf: ${(combinedSignal.confidence * 100).toFixed(1)}%)`);
      
    } catch (error) {
      console.error(`   ❌ ${symbol} analysis failed:`, error.message);
      analysisResults.alerts.push({
        level: 'ERROR',
        symbol: symbol,
        message: `Analysis failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Generate performance metrics
  analysisResults.performance_metrics = generatePerformanceMetrics(analysisResults);
  analysisResults.status = 'completed';
  
  return analysisResults;
}

/**
 * Get market data from Yahoo Finance API
 */
async function getMarketData(symbol) {
  try {
    // Using Yahoo Finance API alternative endpoint
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const result = data.chart.result[0];
    
    if (!result || !result.indicators || !result.indicators.quote[0]) {
      throw new Error('Invalid data format');
    }
    
    const quote = result.indicators.quote[0];
    const timestamps = result.timestamp;
    const current_price = quote.close[quote.close.length - 1];
    
    // Format last 30 days of OHLCV data
    const ohlcv_data = [];
    const days_to_take = Math.min(30, timestamps.length);
    
    for (let i = timestamps.length - days_to_take; i < timestamps.length; i++) {
      if (quote.open[i] && quote.high[i] && quote.low[i] && quote.close[i]) {
        ohlcv_data.push([
          quote.open[i],
          quote.high[i], 
          quote.low[i],
          quote.close[i],
          quote.volume[i] || 0
        ]);
      }
    }
    
    return {
      success: true,
      current_price: current_price,
      data: ohlcv_data
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get TFT prediction from ModelScope API
 */
async function getTFTPrediction(symbol, ohlcv_data, env) {
  try {
    // Call ModelScope API
    const response = await fetch('https://www.modelscope.cn/api/v1/models/yanggf2/tft-primary-nhits-backup-predictor/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.MODELSCOPE_API_TOKEN}`
      },
      body: JSON.stringify({
        symbol: symbol,
        sequence_data: ohlcv_data,
        model_type: 'TFT'
      })
    });
    
    if (!response.ok) {
      throw new Error(`ModelScope API error: ${response.status}`);
    }
    
    const result = await response.json();
    
    return {
      signal_score: result.predicted_direction === 'UP' ? 0.7 : -0.7,
      confidence: result.confidence || 0.8,
      predicted_price: result.predicted_price,
      current_price: result.current_price,
      direction: result.predicted_direction,
      model_latency: result.inference_time || 45
    };
    
  } catch (error) {
    throw new Error(`TFT prediction failed: ${error.message}`);
  }
}

/**
 * Get Real N-HITS prediction (backup model)
 * Uses local N-HITS API service for authentic neural network predictions
 */
async function getRealNHITSPrediction(symbol, ohlcv_data, env) {
  try {
    // Try to call local N-HITS API service
    const nhits_api_url = env.NHITS_API_URL || 'http://localhost:5000';
    
    const response = await fetch(`${nhits_api_url}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: symbol
      }),
      timeout: 5000 // 5 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`N-HITS API error: ${response.status}`);
    }
    
    const nhitsResult = await response.json();
    
    // Convert N-HITS API response to worker format
    return {
      signal_score: nhitsResult.signal_score || 0,
      confidence: nhitsResult.confidence || 0.7,
      predicted_price: nhitsResult.predicted_price,
      current_price: nhitsResult.current_price,
      direction: nhitsResult.direction || 'NEUTRAL',
      model_latency: nhitsResult.inference_time_ms || 50,
      model_type: nhitsResult.model_used || 'Real-NHITS-Neural',
      is_neural: nhitsResult.is_neural || false,
      architecture: nhitsResult.model_type || 'Neural Hierarchical Interpolation'
    };
    
  } catch (error) {
    console.log(`   ⚠️ N-HITS API failed for ${symbol}, using statistical fallback: ${error.message}`);
    
    // Fallback to enhanced statistical model (better than simple moving average)
    return getStatisticalFallback(symbol, ohlcv_data);
  }
}

/**
 * Enhanced statistical fallback (when N-HITS API is unavailable)
 * Uses hierarchical trend analysis inspired by N-HITS architecture
 */
function getStatisticalFallback(symbol, ohlcv_data) {
  try {
    const closes = ohlcv_data.map(d => d[3]); // Close prices
    const current_price = closes[closes.length - 1];
    
    // Multi-scale trend analysis (mimics N-HITS hierarchical structure)
    const short_trend = closes.length >= 5 ? 
      (closes.slice(-5).reduce((a, b) => a + b) / 5 - closes.slice(-10, -5).reduce((a, b) => a + b) / 5) / current_price : 0;
    
    const medium_trend = closes.length >= 10 ? 
      (closes.slice(-10).reduce((a, b) => a + b) / 10 - closes.slice(-20, -10).reduce((a, b) => a + b) / 10) / current_price : 0;
    
    // Hierarchical combination (weighted like N-HITS stacks)
    const combined_trend = 0.5 * short_trend + 0.3 * medium_trend;
    const predicted_change = combined_trend * 0.8; // Conservative prediction
    const predicted_price = current_price * (1 + predicted_change);
    
    return {
      signal_score: combined_trend > 0 ? 0.5 : -0.5,
      confidence: 0.6, // Moderate confidence for statistical model
      predicted_price: predicted_price,
      current_price: current_price,
      direction: combined_trend > 0 ? 'UP' : 'DOWN',
      model_latency: 5,
      model_type: 'Statistical-Hierarchical-Fallback',
      is_neural: false,
      note: 'Enhanced statistical model with hierarchical trend analysis'
    };
    
  } catch (error) {
    // Ultimate fallback
    return {
      signal_score: 0,
      confidence: 0.5,
      predicted_price: current_price,
      current_price: current_price,
      direction: 'NEUTRAL',
      model_latency: 1,
      model_type: 'Neutral-Fallback',
      error: error.message
    };
  }
}

/**
 * Get sentiment analysis using Cloudflare AI
 */
async function getSentimentAnalysis(symbol, env) {
  try {
    console.log(`   🔍 Getting AI sentiment for ${symbol}...`);
    
    // Generate financial news query
    const newsQuery = `${symbol} stock market news financial earnings revenue profit`;
    
    // Use Cloudflare AI for sentiment analysis
    const sentiment = await env.AI.run('@cf/huggingface/distilbert-sst-2-int8', {
      text: `Financial outlook for ${symbol}: Recent market performance and analyst sentiment`
    });
    
    console.log(`   ✅ AI sentiment for ${symbol}:`, sentiment);
    
    // Convert sentiment to signal
    const isPositive = sentiment.label === 'POSITIVE';
    const confidence = sentiment.score;
    
    return {
      signal_score: isPositive ? 1.0 : -1.0,
      confidence: confidence,
      sentiment: isPositive ? 'BULLISH' : 'BEARISH',
      recommendation: isPositive ? 'BUY' : 'SELL'
    };
    
  } catch (error) {
    console.error(`   ❌ Sentiment AI failed for ${symbol}:`, error.message);
    // Return neutral sentiment on error
    return {
      signal_score: 0.0,
      confidence: 0.5,
      sentiment: 'NEUTRAL',
      recommendation: 'HOLD',
      error: error.message
    };
  }
}

/**
 * Combine price and sentiment signals
 */
function combineSignals(priceSignal, sentimentSignal, symbol, currentPrice) {
  // Weighted combination: 60% price, 40% sentiment
  const priceWeight = 0.6;
  const sentimentWeight = 0.4;
  
  const combinedScore = (priceSignal.signal_score * priceWeight) + (sentimentSignal.signal_score * sentimentWeight);
  const avgConfidence = (priceSignal.confidence * priceWeight) + (sentimentSignal.confidence * sentimentWeight);
  
  // Determine action based on combined score
  let action;
  if (combinedScore > 0.5) {
    action = 'BUY STRONG';
  } else if (combinedScore > 0.2) {
    action = 'BUY WEAK';
  } else if (combinedScore < -0.5) {
    action = 'SELL STRONG';
  } else if (combinedScore < -0.2) {
    action = 'SELL WEAK';
  } else {
    action = 'HOLD NEUTRAL';
  }
  
  return {
    success: true,
    symbol: symbol,
    action: action,
    signal_score: combinedScore,
    confidence: avgConfidence,
    current_price: currentPrice,
    reasoning: `${priceSignal.direction} price prediction (${priceSignal.model_used}) + ${sentimentSignal.sentiment} sentiment`,
    timestamp: new Date().toISOString(),
    system_version: '5.0-Cloudflare-Worker',
    components: {
      price_prediction: {
        signal_score: priceSignal.signal_score,
        confidence: priceSignal.confidence,
        model_used: priceSignal.model_used,
        predicted_price: priceSignal.predicted_price,
        direction: priceSignal.direction,
        latency_ms: priceSignal.model_latency
      },
      sentiment_analysis: {
        signal_score: sentimentSignal.signal_score,
        confidence: sentimentSignal.confidence,
        sentiment: sentimentSignal.sentiment,
        recommendation: sentimentSignal.recommendation
      }
    }
  };
}

/**
 * Generate performance metrics
 */
function generatePerformanceMetrics(analysisResults) {
  const signals = analysisResults.trading_signals;
  const successfulAnalyses = Object.values(signals).filter(s => s.success).length;
  
  // Signal distribution
  const signalCounts = { BUY: 0, SELL: 0, HOLD: 0 };
  const confidenceScores = [];
  
  Object.values(signals).forEach(signal => {
    if (signal.success) {
      const action = signal.action.split(' ')[0];
      if (action in signalCounts) {
        signalCounts[action]++;
      }
      confidenceScores.push(signal.confidence);
    }
  });
  
  const avgConfidence = confidenceScores.length > 0 ? 
    confidenceScores.reduce((a, b) => a + b) / confidenceScores.length : 0;
  
  return {
    success_rate: (successfulAnalyses / analysisResults.symbols_analyzed.length) * 100,
    signal_distribution: signalCounts,
    avg_confidence: avgConfidence,
    high_confidence_signals: confidenceScores.filter(c => c > 0.85).length,
    total_symbols: analysisResults.symbols_analyzed.length,
    successful_analyses: successfulAnalyses
  };
}

/**
 * Send alerts via configured channels
 */
async function sendAlerts(analysisResults, env) {
  const alerts = analysisResults.alerts.filter(a => a.level === 'HIGH_CONFIDENCE');
  
  if (alerts.length === 0) return;
  
  // Send email alerts
  if (env.EMAIL_ENABLED === 'true') {
    await sendEmailAlerts(alerts, analysisResults, env);
  }
  
  // Send Slack alerts  
  if (env.SLACK_WEBHOOK_URL) {
    await sendSlackAlerts(alerts, analysisResults, env);
  }
  
  // Send Facebook Messenger alerts
  if (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) {
    await sendFacebookMessengerAlert(alerts, analysisResults, env);
  }
  
  // Send LINE alerts
  if (env.LINE_CHANNEL_TOKEN && env.LINE_USER_ID) {
    await sendLINEAlert(alerts, analysisResults, env);
  }
}

/**
 * Send email alerts using MailChannels
 */
async function sendEmailAlerts(alerts, analysisResults, env) {
  try {
    const emailContent = `
Trading System Alert - ${new Date().toLocaleDateString()}

${alerts.length} high-confidence trading signals detected:

${alerts.map(alert => `• ${alert.symbol}: ${alert.message}`).join('\n')}

Performance Summary:
• Success Rate: ${analysisResults.performance_metrics.success_rate.toFixed(1)}%
• Average Confidence: ${(analysisResults.performance_metrics.avg_confidence * 100).toFixed(1)}%
• Signal Distribution: ${JSON.stringify(analysisResults.performance_metrics.signal_distribution)}

View full results: https://your-worker-url.workers.dev/results

Generated by Cloudflare Trading Worker
    `;
    
    await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: env.ALERT_EMAIL }]
        }],
        from: { email: 'alerts@tradingsystem.workers.dev' },
        subject: `Trading Alert - ${alerts.length} High Confidence Signals`,
        content: [{ type: 'text/plain', value: emailContent }]
      })
    });
    
  } catch (error) {
    console.error('Email alert failed:', error);
  }
}

/**
 * Send Slack alerts
 */
async function sendSlackAlerts(alerts, analysisResults, env) {
  try {
    const slackMessage = {
      text: `🎯 Trading System Alert - ${alerts.length} High Confidence Signals`,
      attachments: [
        {
          color: 'good',
          fields: alerts.map(alert => ({
            title: alert.symbol,
            value: alert.message.replace('🎯 High confidence signal: ', ''),
            short: true
          }))
        },
        {
          color: '#36a64f',
          title: 'Performance Summary',
          text: `Success Rate: ${analysisResults.performance_metrics.success_rate.toFixed(1)}% | Avg Confidence: ${(analysisResults.performance_metrics.avg_confidence * 100).toFixed(1)}%`
        }
      ]
    };
    
    await fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    });
    
  } catch (error) {
    console.error('Slack alert failed:', error);
  }
}

/**
 * Send critical error alert
 */
async function sendCriticalAlert(errorMessage, env) {
  // Send Slack alert
  if (env.SLACK_WEBHOOK_URL) {
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
              { title: 'Timestamp', value: new Date().toISOString(), short: true }
            ]
          }]
        })
      });
    } catch (error) {
      console.error('Critical alert failed:', error);
    }
  }
  
  // Send messenger alerts (Facebook + LINE)
  await sendCriticalMessengerAlert(errorMessage, env);
}

/**
 * Handle manual analysis request
 */
async function handleManualAnalysis(request, env) {
  try {
    const result = await runPreMarketAnalysis(env);
    
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle get results request
 */
async function handleGetResults(request, env) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    const result = await env.TRADING_RESULTS.get(`analysis_${date}`);
    
    if (result) {
      return new Response(result, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'No results found for date' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle health check
 */
async function handleHealthCheck(request, env) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0-Cloudflare-Worker',
    services: {
      kv_storage: 'available',
      ai_service: env.AI ? 'available' : 'unavailable',
      modelscope_api: env.MODELSCOPE_API_TOKEN ? 'configured' : 'not_configured'
    }
  };
  
  return new Response(JSON.stringify(health, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}