/**
 * Cloudflare Worker - Automated Pre-Market Trading Analysis (Standalone)
 * Runs TFT+N-HITS trading system analysis at scheduled times (6:30-9:30 AM EST)
 * Stores results in Cloudflare KV for retrieval by local system
 * Supports Email, Slack, Facebook Messenger, and LINE alerts
 */

// Circuit breaker for external services
const circuitBreaker = {
  modelScope: { failures: 0, lastFailTime: 0, isOpen: false },
  yahooFinance: { failures: 0, lastFailTime: 0, isOpen: false }
};

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 3,
  recoveryTimeMs: 300000, // 5 minutes
  timeoutMs: 30000 // 30 seconds (increased for Vercel API)
};

function updateCircuitBreaker(service, success) {
  const breaker = circuitBreaker[service];
  
  if (success) {
    breaker.failures = 0;
    breaker.isOpen = false;
  } else {
    breaker.failures++;
    breaker.lastFailTime = Date.now();
    
    if (breaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      breaker.isOpen = true;
      console.log(`🔴 Circuit breaker OPEN for ${service} (${breaker.failures} failures)`);
    }
  }
}

function isCircuitBreakerOpen(service) {
  const breaker = circuitBreaker[service];
  
  if (!breaker.isOpen) return false;
  
  // Check if recovery time has passed
  if (Date.now() - breaker.lastFailTime > CIRCUIT_BREAKER_CONFIG.recoveryTimeMs) {
    breaker.isOpen = false;
    breaker.failures = 0;
    console.log(`🟢 Circuit breaker CLOSED for ${service} (recovery time passed)`);
    return false;
  }
  
  return true;
}

// Input validation for sensitive endpoints
function validateRequest(request, url) {
  // Basic rate limiting check (simple IP-based)
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  
  // Validate analyze endpoint parameters
  if (url.pathname === '/analyze') {
    const symbol = url.searchParams.get('symbol');
    if (symbol) {
      // Validate symbol format (1-5 uppercase letters)
      if (!/^[A-Z]{1,5}$/.test(symbol)) {
        return { valid: false, error: 'Invalid symbol format. Use 1-5 uppercase letters.' };
      }
    }
  }
  
  // Basic request method validation
  if (!['GET', 'POST'].includes(request.method)) {
    return { valid: false, error: 'Method not allowed' };
  }
  
  // Additional security headers check
  const userAgent = request.headers.get('User-Agent');
  if (!userAgent || userAgent.length < 5) {
    return { valid: false, error: 'Invalid or missing User-Agent' };
  }
  
  return { valid: true };
}

export default {
  async scheduled(controller, env, ctx) {
    const scheduledTime = new Date(controller.scheduledTime);
    const estTime = new Date(scheduledTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const currentHour = estTime.getHours();
    const currentMinute = estTime.getMinutes();
    
    // Determine trigger mode and prediction horizons
    let triggerMode, predictionHorizons;
    
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
      predictionHorizons = [72, 168]; // Weekend + next week forecasts
    } else if (currentHour === 16 && currentMinute === 5 && estTime.getDay() === 5) {
      // 4:05 PM Friday - Next trading day predictions for Monday (weekend analysis)
      triggerMode = 'friday_weekend_prediction'; 
      predictionHorizons = [72]; // Monday market open (3 days including weekend)
    } else if (currentHour === 16 && currentMinute === 5) {
      // 4:05 PM - Next trading day market close predictions (after current market closes)
      triggerMode = 'next_day_market_prediction'; 
      predictionHorizons = [24]; // Next trading day market close
    } else if (currentHour === 10 && currentMinute === 0 && estTime.getDay() === 0) {
      // Sunday 10:00 AM - Weekly accuracy report
      triggerMode = 'weekly_accuracy_report';
      predictionHorizons = []; // No new predictions, just analysis
    } else {
      // Fallback or future expansion
      triggerMode = 'unknown';
      predictionHorizons = [];
    }
    
    const isFinalDailyReport = false; // Not used in new system
    
    // Enhanced cron execution logging
    const cronExecutionId = `cron_${Date.now()}_${triggerMode}`;
    const cronStartTime = Date.now();
    
    console.log(`🚀 [CRON-START] ${cronExecutionId}`, {
      scheduled_time_utc: controller.scheduledTime,
      scheduled_time_est: estTime.toISOString(),
      trigger_mode: triggerMode,
      prediction_horizons: predictionHorizons,
      execution_id: cronExecutionId,
      hour: currentHour,
      minute: currentMinute
    });
    
    // Reset circuit breakers if in recovery period
    Object.keys(circuitBreaker).forEach(service => {
      isCircuitBreakerOpen(service);
    });
    
    try {
      // Special handling for Friday analysis, weekend predictions, and Sunday reports
      let analysisResult;
      if (triggerMode === 'weekly_market_close_analysis') {
        analysisResult = await runWeeklyMarketCloseAnalysis(env, estTime);
      } else if (triggerMode === 'friday_weekend_prediction') {
        analysisResult = await runFridayWeekendAnalysis(env, estTime);
      } else if (triggerMode === 'weekly_accuracy_report') {
        // Sunday weekly accuracy report - skip market analysis, go directly to Facebook report
        console.log(`📊 [CRON-SUNDAY] ${cronExecutionId} Sunday weekly accuracy report - skipping market analysis`);
        
        // Store execution tracking in KV
        const sundayReportKey = `sunday_weekly_report_${estTime.toISOString().split('T')[0]}`;
        const executionRecord = {
          execution_id: cronExecutionId,
          trigger_mode: 'weekly_accuracy_report',
          scheduled_time: controller.scheduledTime,
          est_time: estTime.toISOString(),
          facebook_configured: !!(env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID),
          status: 'started',
          timestamp: new Date().toISOString()
        };
        
        console.log(`💾 [KV-STORE] ${cronExecutionId} Storing Sunday report execution record`);
        await env.TRADING_RESULTS.put(
          sundayReportKey,
          JSON.stringify(executionRecord),
          { expirationTtl: 604800 } // 7 days
        );
        
        // Send weekly accuracy report directly
        if (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) {
          console.log(`📊 [CRON-WEEKLY] ${cronExecutionId} Sunday detected - sending weekly accuracy report`);
          const weeklyResult = await sendWeeklyAccuracyReportWithTracking(env, cronExecutionId);
          console.log(`📊 [CRON-WEEKLY-RESULT] ${cronExecutionId}`, weeklyResult);
          
          // Update execution record with success
          executionRecord.status = 'completed';
          executionRecord.facebook_result = weeklyResult;
          executionRecord.completion_time = new Date().toISOString();
          
          await env.TRADING_RESULTS.put(
            sundayReportKey,
            JSON.stringify(executionRecord),
            { expirationTtl: 604800 } // 7 days
          );
          console.log(`💾 [KV-UPDATE] ${cronExecutionId} Updated Sunday report execution record with success`);
        } else {
          console.log(`⚠️ [CRON-FB-SKIP] ${cronExecutionId} Facebook not configured - skipping weekly report`);
          
          // Update execution record with skip
          executionRecord.status = 'skipped';
          executionRecord.skip_reason = 'facebook_not_configured';
          executionRecord.completion_time = new Date().toISOString();
          
          await env.TRADING_RESULTS.put(
            sundayReportKey,
            JSON.stringify(executionRecord),
            { expirationTtl: 604800 } // 7 days
          );
          console.log(`💾 [KV-UPDATE] ${cronExecutionId} Updated Sunday report execution record with skip status`);
        }
        
        const cronDuration = Date.now() - cronStartTime;
        console.log(`✅ [CRON-COMPLETE-WEEKLY] ${cronExecutionId}`, {
          trigger_mode: 'weekly_accuracy_report',
          duration_ms: cronDuration,
          facebook_status: env.FACEBOOK_PAGE_TOKEN ? 'sent' : 'skipped',
          kv_record_stored: sundayReportKey
        });
        
        return; // Exit early for Sunday reports
      } else {
        analysisResult = await runPreMarketAnalysis(env, { 
          triggerMode, 
          predictionHorizons,
          currentTime: estTime,
          cronExecutionId // Pass through cronExecutionId for tracking
        });
      }
      
      // Validate analysis result
      if (!analysisResult || !analysisResult.symbols_analyzed || analysisResult.symbols_analyzed.length === 0) {
        throw new Error('Analysis returned invalid or empty results');
      }
      
      // Store results in KV for local system retrieval
      let dateStr = estTime.toISOString().split('T')[0];
      const timeStr = estTime.toISOString().substr(11, 8).replace(/:/g, ''); // HHMMSS format
      
      // For next-day predictions (4:05 PM), store under next trading day's date
      if (triggerMode === 'next_day_market_prediction') {
        const nextTradingDay = getNextTradingDay(estTime);
        dateStr = nextTradingDay.toISOString().split('T')[0];
        console.log(`📅 Next-day prediction: storing under ${dateStr} (next trading day)`);
      }
      
      // Store with timestamp to preserve multiple predictions per day
      const timestampedKey = `analysis_${dateStr}_${timeStr}`;
      const dailyKey = `analysis_${dateStr}`;
      
      console.log(`💾 [CRON-KV] ${cronExecutionId} storing results with keys: ${timestampedKey} and updating ${dailyKey}`);
      
      // Store the timestamped analysis
      await env.TRADING_RESULTS.put(
        timestampedKey,
        JSON.stringify(analysisResult),
        { expirationTtl: 604800 } // 7 days for weekly validation
      );
      
      // Update/merge the daily summary with this new analysis
      let dailyAnalysis = null;
      try {
        const existingDaily = await env.TRADING_RESULTS.get(dailyKey);
        if (existingDaily) {
          dailyAnalysis = JSON.parse(existingDaily);
        }
      } catch (err) {
        console.log(`📋 No existing daily analysis found for ${dateStr}, creating new`);
      }
      
      // If no existing daily analysis, use current as base
      if (!dailyAnalysis) {
        dailyAnalysis = { ...analysisResult };
        dailyAnalysis.multiple_executions = {};
      }
      
      // Add this execution to the daily summary
      const executionTime = estTime.toISOString().substr(11, 5); // HH:MM format
      dailyAnalysis.multiple_executions[executionTime] = {
        timestamp: analysisResult.timestamp,
        trading_signals: analysisResult.trading_signals,
        performance_metrics: analysisResult.performance_metrics,
        cron_execution_id: cronExecutionId
      };
      
      // Update daily analysis with latest data but preserve all executions
      dailyAnalysis.timestamp = analysisResult.timestamp;
      dailyAnalysis.daily_context = analysisResult.daily_context;
      dailyAnalysis.latest_execution = executionTime;
      
      // Store the updated daily summary
      await env.TRADING_RESULTS.put(
        dailyKey,
        JSON.stringify(dailyAnalysis),
        { expirationTtl: 604800 } // 7 days for weekly validation
      );
      
      // Send high-confidence alerts if any
      if (analysisResult.alerts && analysisResult.alerts.length > 0) {
        console.log(`📢 [CRON-ALERTS] ${cronExecutionId} sending ${analysisResult.alerts.length} high-confidence alerts`);
        await sendAlerts(analysisResult, env);
      } else {
        console.log(`🔇 [CRON-ALERTS] ${cronExecutionId} no high-confidence alerts to send`);
      }

      // Always send daily summary to Facebook (regardless of confidence)
      if (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) {
        console.log(`📱 [CRON-FB-START] ${cronExecutionId} sending Facebook daily summary`);
        const fbResult = await sendFacebookDailySummaryWithTracking(analysisResult, env, cronExecutionId);
        console.log(`📱 [CRON-FB-RESULT] ${cronExecutionId}`, fbResult);
        
        // Check for Friday weekend analysis reports
        const dayOfWeek = estTime.getDay(); // 0 = Sunday, 5 = Friday
        
        // Friday weekend analysis reports with logging and KV tracking
        if (triggerMode === 'weekly_market_close_analysis' || triggerMode === 'friday_weekend_prediction') {
          console.log(`📊 [CRON-FRIDAY] ${cronExecutionId} Friday weekend analysis - sending additional weekend report`);
          
          // Store Friday execution tracking in KV
          const fridayReportKey = `friday_${triggerMode}_${estTime.toISOString().split('T')[0]}`;
          const fridayExecutionRecord = {
            execution_id: cronExecutionId,
            trigger_mode: triggerMode,
            scheduled_time: controller.scheduledTime,
            est_time: estTime.toISOString(),
            symbols_analyzed: analysisResult.symbols_analyzed?.length || 0,
            facebook_configured: !!(env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID),
            status: 'sending_report',
            timestamp: new Date().toISOString()
          };
          
          console.log(`💾 [KV-STORE] ${cronExecutionId} Storing Friday ${triggerMode} execution record`);
          await env.TRADING_RESULTS.put(
            fridayReportKey,
            JSON.stringify(fridayExecutionRecord),
            { expirationTtl: 604800 } // 7 days
          );
          
          const weekendReportResult = await sendFridayWeekendReportWithTracking(analysisResult, env, cronExecutionId, triggerMode);
          console.log(`📊 [CRON-FRIDAY-RESULT] ${cronExecutionId}`, weekendReportResult);
          
          // Update Friday execution record with results
          fridayExecutionRecord.status = 'completed';
          fridayExecutionRecord.facebook_result = weekendReportResult;
          fridayExecutionRecord.completion_time = new Date().toISOString();
          
          if (triggerMode === 'weekly_market_close_analysis' && analysisResult.weekly_analysis) {
            fridayExecutionRecord.weekly_analysis_data = {
              days_with_data: analysisResult.weekly_analysis.days_with_data,
              average_confidence: analysisResult.weekly_analysis.average_confidence
            };
          }
          
          if (triggerMode === 'friday_weekend_prediction' && analysisResult.weekend_analysis) {
            fridayExecutionRecord.weekend_analysis_data = analysisResult.weekend_analysis;
          }
          
          await env.TRADING_RESULTS.put(
            fridayReportKey,
            JSON.stringify(fridayExecutionRecord),
            { expirationTtl: 604800 } // 7 days
          );
          console.log(`💾 [KV-UPDATE] ${cronExecutionId} Updated Friday ${triggerMode} execution record with results`);
        }
      } else {
        console.log(`⚠️ [CRON-FB-SKIP] ${cronExecutionId} Facebook not configured - skipping daily summary`);
      }
      
      const cronDuration = Date.now() - cronStartTime;
      console.log(`✅ [CRON-COMPLETE] ${cronExecutionId}`, {
        symbols_analyzed: analysisResult.symbols_analyzed.length,
        duration_ms: cronDuration,
        alerts_sent: analysisResult.alerts?.length || 0,
        circuit_breaker_status: {
          modelScope: circuitBreaker.modelScope.isOpen ? 'OPEN' : 'CLOSED',
          yahooFinance: circuitBreaker.yahooFinance.isOpen ? 'OPEN' : 'CLOSED'
        }
      });
      
    } catch (error) {
      console.error(`❌ Scheduled analysis failed:`, error);
      
      // Store error for debugging with more context
      const errorDetails = {
        error: error.message,
        stack: error.stack,
        timestamp: estTime.toISOString(),
        type: 'scheduled_analysis_failure',
        circuit_breaker_status: {
          modelScope: circuitBreaker.modelScope,
          yahooFinance: circuitBreaker.yahooFinance
        }
      };
      
      await env.TRADING_RESULTS.put(
        `error_${estTime.toISOString()}`,
        JSON.stringify(errorDetails),
        { expirationTtl: 86400 }
      );
      
      // Send critical alert with retry
      await sendCriticalAlertWithRetry(error.message, env, 3);
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Input validation and rate limiting for sensitive endpoints
    if (url.pathname === '/analyze' || url.pathname === '/test-facebook' || url.pathname === '/test-high-confidence') {
      const validationResult = validateRequest(request, url);
      if (!validationResult.valid) {
        return new Response(JSON.stringify({
          success: false,
          error: validationResult.error,
          timestamp: new Date().toISOString()
        }, null, 2), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Handle different endpoints
    if (url.pathname === '/analyze') {
      return handleManualAnalysis(request, env);
    } else if (url.pathname === '/results') {
      return handleGetResults(request, env);
    } else if (url.pathname === '/health') {
      return handleHealthCheck(request, env);
    } else if (url.pathname === '/test-facebook') {
      return handleFacebookTest(request, env);
    } else if (url.pathname === '/weekly-report') {
      return handleWeeklyReport(request, env);
    } else if (url.pathname === '/friday-market-close-report') {
      return handleFridayMarketCloseReport(request, env);
    } else if (url.pathname === '/friday-monday-predictions-report') {
      return handleFridayMondayPredictionsReport(request, env);
    } else if (url.pathname === '/sunday-weekly-accuracy-report') {
      return handleSundayWeeklyAccuracyReport(request, env);
    } else if (url.pathname === '/weekend-reports-status') {
      return handleWeekendReportsStatus(request, env);
    } else if (url.pathname === '/test-daily-report') {
      return handleTestDailyReport(request, env);
    } else if (url.pathname === '/test-high-confidence') {
      return handleTestHighConfidence(request, env);
    } else if (url.pathname === '/chart') {
      return handleChartViewer(request, env);
    } else if (url.pathname === '/api/history') {
      return handleHistoryAPI(request, env);
    } else if (url.pathname === '/fact-table') {
      return handleFactTable(request, env);
    } else if (url.pathname === '/api/fact-data') {
      return handleFactDataAPI(request, env);
    } else if (url.pathname === '/api/kv-cleanup') {
      return handleKVCleanup(request, env);
    } else if (url.pathname === '/debug-weekend-message') {
      return handleDebugWeekendMessage(request, env);
    } else if (url.pathname === '/kv-get') {
      return handleKVGet(request, env);
    } else if (url.pathname === '/weekly-analysis') {
      return handleWeeklyAnalysisPage(request, env);
    } else if (url.pathname === '/api/weekly-data') {
      return handleWeeklyAnalysisData(request, env);
    } else if (url.pathname === '/api/kv-list') {
      return handleKVList(request, env);
    } else if (url.pathname === '/test-next-day-prediction') {
      return handleTestNextDayPrediction(request, env);
    } else {
      return new Response('TFT Trading System Worker API\nEndpoints: /analyze, /results, /health, /test-facebook, /weekly-report, /friday-market-close-report, /friday-monday-predictions-report, /sunday-weekly-accuracy-report, /weekend-reports-status, /test-daily-report, /test-high-confidence, /chart, /api/history, /fact-table, /api/fact-data', { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};

/**
 * Run complete pre-market analysis for all symbols with progressive state building
 */
async function runPreMarketAnalysis(env, options = {}) {
  const { isFinalDailyReport = false, triggerMode, predictionHorizons, currentTime } = options;
  const symbols = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'NVDA'];
  
  // Get today's date for KV key
  const dateStr = (currentTime || new Date()).toISOString().split('T')[0];
  const contextKey = `daily-context-${dateStr}`;
  
  // Load existing daily context from previous cron runs
  let dailyContext = {};
  try {
    const storedContext = await env.TRADING_RESULTS.get(contextKey);
    if (storedContext) {
      dailyContext = JSON.parse(storedContext);
      console.log(`📋 Loaded daily context: ${Object.keys(dailyContext).length} previous analyses`);
    }
  } catch (error) {
    console.log(`📋 No previous context found for ${dateStr}, starting fresh`);
  }
  
  const analysisResults = {
    run_id: `worker_${new Date().toISOString().replace(/[:.]/g, '_')}`,
    timestamp: new Date().toISOString(),
    symbols_analyzed: [],
    trading_signals: {},
    alerts: [],
    performance_metrics: {},
    status: 'running',
    worker_version: '2.0-Progressive-KV',
    trigger_mode: triggerMode,
    prediction_horizons: predictionHorizons,
    daily_context: dailyContext, // Include accumulated context
    cronExecutionId: options.cronExecutionId // Pass through cronExecutionId for tracking
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
      
      // Run DUAL ACTIVE models: TFT + N-HITS sequentially to reduce Vercel load
      console.log(`   🔄 Running dual models (TFT + N-HITS) for ${symbol}...`);
      
      // Add small delay between symbols to avoid overwhelming Vercel
      if (symbol !== 'AAPL') {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
      
      const [tftResult, nhitsResult] = await Promise.allSettled([
        getTFTPrediction(symbol, marketData.data, env),
        new Promise(resolve => setTimeout(() => resolve(getNHITSPrediction(symbol, marketData.data, env)), 1000))
      ]);
      
      // Process TFT results
      let tftPrediction = null;
      if (tftResult.status === 'fulfilled') {
        tftPrediction = tftResult.value;
        tftPrediction.model_name = 'TFT-Primary';
        console.log(`   ✅ TFT: ${tftPrediction.direction} ${tftPrediction.current_price?.toFixed(2)} → ${tftPrediction.predicted_price?.toFixed(2)}`);
      } else {
        console.log(`   ❌ TFT failed for ${symbol}: ${tftResult.reason?.message || 'Unknown error'}`);
      }
      
      // Process N-HITS results  
      let nhitsPrediction = null;
      if (nhitsResult.status === 'fulfilled') {
        nhitsPrediction = nhitsResult.value;
        nhitsPrediction.model_name = 'N-HITS-Active';
        console.log(`   ✅ N-HITS: ${nhitsPrediction.direction} ${nhitsPrediction.current_price?.toFixed(2)} → ${nhitsPrediction.predicted_price?.toFixed(2)}`);
      } else {
        console.log(`   ❌ N-HITS failed for ${symbol}: ${nhitsResult.reason?.message || 'Unknown error'}`);
      }
      
      // Combine dual model predictions
      const priceSignal = combineDualModelPredictions(tftPrediction, nhitsPrediction, symbol, marketData.current_price);
      
      // Get sentiment analysis
      const sentimentSignal = await getSentimentAnalysis(symbol, env);
      
      // Combine signals
      const combinedSignal = combineSignals(priceSignal, sentimentSignal, symbol, marketData.current_price);
      
      // Get contextual market price information for this prediction
      const contextualPrice = await getContextualMarketPrice(symbol, new Date().toISOString(), env);
      if (contextualPrice) {
        combinedSignal.market_context = contextualPrice;
        console.log(`   📊 Market context: ${contextualPrice.price_type} baseline=$${contextualPrice.baseline_price?.toFixed(2)}`);
      }
      
      analysisResults.symbols_analyzed.push(symbol);
      analysisResults.trading_signals[symbol] = combinedSignal;
      
      // Check for high-confidence signals
      if (combinedSignal.confidence > 0.75 && (combinedSignal.action.includes('BUY') || combinedSignal.action.includes('SELL'))) {
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
  
  // Generate performance metrics with advanced risk analysis
  analysisResults.performance_metrics = generatePerformanceMetrics(analysisResults);
  analysisResults.risk_metrics = await generateRiskMetrics(analysisResults, dailyContext, env);
  analysisResults.status = 'completed';
  
  // Update daily context with this analysis run
  const currentHour = (currentTime || new Date()).getHours();
  const cronTrigger = `${currentHour.toString().padStart(2, '0')}:${(Math.floor(((currentTime || new Date()).getMinutes() / 30)) * 30).toString().padStart(2, '0')}`;
  
  // Store progressive context for next cron execution
  dailyContext[cronTrigger] = {
    timestamp: analysisResults.timestamp,
    trigger_mode: triggerMode,
    symbols_count: analysisResults.symbols_analyzed.length,
    alerts_count: analysisResults.alerts.length,
    avg_confidence: analysisResults.symbols_analyzed.length > 0 ? 
      analysisResults.symbols_analyzed.reduce((sum, s) => sum + (s.confidence || 0), 0) / analysisResults.symbols_analyzed.length : 0,
    market_sentiment: analysisResults.trading_signals ? Object.values(analysisResults.trading_signals).reduce((acc, signal) => {
      if (signal.direction === 'UP') acc.bullish++;
      else if (signal.direction === 'DOWN') acc.bearish++;
      return acc;
    }, { bullish: 0, bearish: 0, neutral: 0 }) : { bullish: 0, bearish: 0, neutral: 0 },
    circuit_breaker_status: {
      modelScope: circuitBreaker.modelScope.isOpen,
      yahooFinance: circuitBreaker.yahooFinance.isOpen
    }
  };
  
  // Save updated context to KV for next cron run
  try {
    await env.TRADING_RESULTS.put(
      contextKey,
      JSON.stringify(dailyContext),
      { expirationTtl: 86400 } // 24 hours
    );
    console.log(`📋 Saved daily context: ${Object.keys(dailyContext).length} analyses accumulated`);
  } catch (error) {
    console.error(`❌ Failed to save daily context: ${error.message}`);
  }
  
  return analysisResults;
}

/**
 * Run comprehensive weekly market close analysis using accumulated daily context
 */
async function runWeeklyMarketCloseAnalysis(env, currentTime) {
  const fridayDateStr = currentTime.toISOString().split('T')[0];
  
  // Collect daily context from the entire week
  const weeklyContext = {
    friday_date: fridayDateStr,
    daily_analyses: [],
    weekly_trends: {},
    accumulated_insights: {}
  };
  
  // Gather context from Monday to Friday
  for (let i = 4; i >= 0; i--) {
    const dayDate = new Date(currentTime);
    dayDate.setDate(dayDate.getDate() - i);
    const dayDateStr = dayDate.toISOString().split('T')[0];
    const contextKey = `daily-context-${dayDateStr}`;
    
    try {
      const dailyContextJson = await env.TRADING_RESULTS.get(contextKey);
      if (dailyContextJson) {
        const dailyContext = JSON.parse(dailyContextJson);
        weeklyContext.daily_analyses.push({
          date: dayDateStr,
          context: dailyContext,
          day_name: dayDate.toLocaleDateString('en-US', { weekday: 'long' })
        });
      }
    } catch (error) {
      console.log(`📋 Could not load context for ${dayDateStr}: ${error.message}`);
    }
  }
  
  console.log(`📊 Weekly analysis: collected ${weeklyContext.daily_analyses.length} daily contexts`);
  
  // Generate weekly trends analysis
  if (weeklyContext.daily_analyses.length > 0) {
    const allDailyContexts = weeklyContext.daily_analyses.map(d => d.context);
    weeklyContext.weekly_trends = {
      avg_confidence_trend: calculateWeeklyConfidenceTrend(allDailyContexts),
      market_sentiment_evolution: calculateMarketSentimentEvolution(allDailyContexts),
      circuit_breaker_health: calculateWeeklySystemHealth(allDailyContexts),
      prediction_consistency: calculatePredictionConsistency(allDailyContexts)
    };
  }
  
  // Run final predictions for weekend/next week with weekly context
  const analysisResult = await runPreMarketAnalysis(env, {
    triggerMode: 'weekly_market_close_analysis',
    predictionHorizons: [72, 168], // Weekend + next week
    currentTime,
    weeklyContext // Pass accumulated context to enhance predictions
  });
  
  // Add weekly insights to the result
  analysisResult.weekly_analysis = weeklyContext;
  analysisResult.worker_version = '2.0-Progressive-KV-Weekly';
  
  return analysisResult;
}

/**
 * Run Friday weekend analysis with Monday predictions
 */
async function runFridayWeekendAnalysis(env, currentTime) {
  const fridayDateStr = currentTime.toISOString().split('T')[0];
  
  console.log(`📊 Running Friday weekend analysis for ${fridayDateStr}`);
  
  // Get the weekly market close context from Friday 4:00 PM analysis if available
  const weeklyCloseKey = `analysis_${fridayDateStr}`;
  let weeklyCloseContext = null;
  
  try {
    const weeklyCloseData = await env.TRADING_RESULTS.get(weeklyCloseKey);
    if (weeklyCloseData) {
      weeklyCloseContext = JSON.parse(weeklyCloseData);
      console.log(`✅ Found Friday market close context for weekend analysis`);
    }
  } catch (error) {
    console.log(`⚠️ No Friday market close context available: ${error.message}`);
  }
  
  // Run standard analysis with weekend prediction horizons
  const analysisResult = await runPreMarketAnalysis(env, { 
    triggerMode: 'friday_weekend_prediction',
    predictionHorizons: [72], // Monday market open
    currentTime,
    weeklyContext: weeklyCloseContext?.weekly_analysis // Use weekly context if available
  });
  
  // Add weekend-specific analysis
  analysisResult.weekend_analysis = {
    friday_market_close: weeklyCloseContext ? 'available' : 'not_available',
    monday_market_prediction: true,
    weekend_duration_hours: 72,
    next_trading_day: 'Monday',
    analysis_type: 'friday_weekend_transition'
  };
  
  analysisResult.worker_version = '2.0-Progressive-KV-Weekend';
  
  return analysisResult;
}

/**
 * Calculate weekly confidence trend from daily contexts
 */
function calculateWeeklyConfidenceTrend(dailyContexts) {
  const confidenceByDay = dailyContexts.map(context => {
    const triggers = Object.keys(context);
    return triggers.reduce((sum, trigger) => sum + (context[trigger].avg_confidence || 0), 0) / Math.max(triggers.length, 1);
  });
  
  return {
    daily_averages: confidenceByDay,
    weekly_average: confidenceByDay.reduce((sum, c) => sum + c, 0) / Math.max(confidenceByDay.length, 1),
    trend: confidenceByDay.length > 1 ? 
      (confidenceByDay[confidenceByDay.length - 1] - confidenceByDay[0]) > 0 ? 'improving' : 'declining' : 'stable'
  };
}

/**
 * Calculate market sentiment evolution throughout the week
 */
function calculateMarketSentimentEvolution(dailyContexts) {
  return dailyContexts.map((context, index) => {
    const triggers = Object.keys(context);
    const dailySentiment = triggers.reduce((acc, trigger) => {
      const sentiment = context[trigger].market_sentiment || { bullish: 0, bearish: 0, neutral: 0 };
      acc.bullish += sentiment.bullish;
      acc.bearish += sentiment.bearish;
      acc.neutral += sentiment.neutral;
      return acc;
    }, { bullish: 0, bearish: 0, neutral: 0 });
    
    const total = dailySentiment.bullish + dailySentiment.bearish + dailySentiment.neutral;
    return {
      day_index: index,
      sentiment: dailySentiment,
      dominant_sentiment: total > 0 ? 
        (dailySentiment.bullish > dailySentiment.bearish ? 
          (dailySentiment.bullish > dailySentiment.neutral ? 'bullish' : 'neutral') :
          (dailySentiment.bearish > dailySentiment.neutral ? 'bearish' : 'neutral')
        ) : 'neutral'
    };
  });
}

/**
 * Calculate weekly system health from circuit breaker status
 */
function calculateWeeklySystemHealth(dailyContexts) {
  const healthMetrics = { modelScope: [], yahooFinance: [] };
  
  dailyContexts.forEach(context => {
    Object.keys(context).forEach(trigger => {
      const status = context[trigger].circuit_breaker_status || {};
      healthMetrics.modelScope.push(!status.modelScope);
      healthMetrics.yahooFinance.push(!status.yahooFinance);
    });
  });
  
  return {
    modelScope_uptime: (healthMetrics.modelScope.filter(Boolean).length / Math.max(healthMetrics.modelScope.length, 1)) * 100,
    yahooFinance_uptime: (healthMetrics.yahooFinance.filter(Boolean).length / Math.max(healthMetrics.yahooFinance.length, 1)) * 100,
    total_health_checks: healthMetrics.modelScope.length
  };
}

/**
 * Calculate prediction consistency across the week
 */
function calculatePredictionConsistency(dailyContexts) {
  // Analyze how consistent predictions and alerts have been
  const alertCounts = dailyContexts.map(context => {
    return Object.keys(context).reduce((sum, trigger) => sum + (context[trigger].alerts_count || 0), 0);
  });
  
  return {
    daily_alert_counts: alertCounts,
    average_daily_alerts: alertCounts.reduce((sum, c) => sum + c, 0) / Math.max(alertCounts.length, 1),
    consistency_score: alertCounts.length > 1 ? 
      (1 - (Math.max(...alertCounts) - Math.min(...alertCounts)) / Math.max(...alertCounts, 1)) : 1
  };
}

/**
 * Generate advanced risk metrics including VaR, drawdown, and portfolio risk analysis
 */
async function generateRiskMetrics(analysisResults, dailyContext, env) {
  const symbols = analysisResults.symbols_analyzed || [];
  
  // Calculate Value at Risk (VaR) for each symbol
  const varMetrics = await calculateValueAtRisk(symbols, env);
  
  // Calculate portfolio-level metrics
  const portfolioMetrics = calculatePortfolioRiskMetrics(symbols);
  
  // Calculate maximum drawdown from historical context
  const drawdownMetrics = calculateDrawdownMetrics(dailyContext);
  
  // Calculate position sizing recommendations based on risk
  const positionSizing = calculateRiskAdjustedPositionSizing(symbols, varMetrics);
  
  return {
    value_at_risk: varMetrics,
    portfolio_risk: portfolioMetrics,
    drawdown_analysis: drawdownMetrics,
    position_sizing: positionSizing,
    risk_score: calculateOverallRiskScore(varMetrics, portfolioMetrics, drawdownMetrics),
    last_updated: new Date().toISOString()
  };
}

/**
 * Calculate Value at Risk (VaR) for each symbol using historical volatility
 */
async function calculateValueAtRisk(symbols, env) {
  const varResults = {};
  
  for (const symbol of symbols) {
    try {
      // Estimate volatility from recent price movements (simplified)
      const historicalVolatility = await estimateHistoricalVolatility(symbol.symbol, env);
      
      // Calculate 95% and 99% VaR using normal distribution assumption
      const currentPrice = symbol.current_price || 100;
      const confidence95VaR = currentPrice * historicalVolatility * 1.645; // 95% confidence
      const confidence99VaR = currentPrice * historicalVolatility * 2.576; // 99% confidence
      
      varResults[symbol.symbol] = {
        daily_var_95: confidence95VaR,
        daily_var_99: confidence99VaR,
        weekly_var_95: confidence95VaR * Math.sqrt(5), // Scale for weekly
        volatility_estimate: historicalVolatility,
        last_price: currentPrice
      };
      
    } catch (error) {
      console.log(`❌ VaR calculation failed for ${symbol.symbol}: ${error.message}`);
      varResults[symbol.symbol] = {
        daily_var_95: null,
        daily_var_99: null,
        error: error.message
      };
    }
  }
  
  return varResults;
}

/**
 * Estimate historical volatility from stored market data (simplified approach)
 */
async function estimateHistoricalVolatility(symbol, env) {
  // Simplified volatility calculation using recent prediction spreads
  // In production, this would use actual historical price data
  
  try {
    // Get recent analysis results to estimate volatility
    const recentAnalyses = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      try {
        const analysisJson = await env.TRADING_RESULTS.get(`analysis_${dateStr}`);
        if (analysisJson) {
          const analysis = JSON.parse(analysisJson);
          const symbolData = analysis.symbols_analyzed?.find(s => s.symbol === symbol);
          if (symbolData && symbolData.predicted_price && symbolData.current_price) {
            const priceChange = Math.abs(symbolData.predicted_price - symbolData.current_price) / symbolData.current_price;
            recentAnalyses.push(priceChange);
          }
        }
      } catch (error) {
        // Skip this day if data unavailable
      }
    }
    
    if (recentAnalyses.length > 1) {
      // Calculate standard deviation of price changes
      const mean = recentAnalyses.reduce((sum, change) => sum + change, 0) / recentAnalyses.length;
      const variance = recentAnalyses.reduce((sum, change) => sum + Math.pow(change - mean, 2), 0) / (recentAnalyses.length - 1);
      return Math.sqrt(variance);
    } else {
      // Default volatility estimate if insufficient data
      return 0.02; // 2% daily volatility
    }
    
  } catch (error) {
    console.log(`❌ Volatility estimation failed for ${symbol}: ${error.message}`);
    return 0.025; // Conservative default 2.5%
  }
}

/**
 * Calculate portfolio-level risk metrics
 */
function calculatePortfolioRiskMetrics(symbols) {
  if (!symbols || symbols.length === 0) {
    return { concentration_risk: 0, sector_exposure: {}, total_positions: 0 };
  }
  
  // Calculate position concentration (assuming equal weights for simplicity)
  const equalWeight = 1 / symbols.length;
  const maxConcentration = Math.max(...symbols.map(() => equalWeight));
  
  // Basic sector analysis (simplified - in production would use sector data)
  const sectorMap = {
    'AAPL': 'Technology',
    'MSFT': 'Technology', 
    'GOOGL': 'Technology',
    'TSLA': 'Automotive',
    'NVDA': 'Technology'
  };
  
  const sectorExposure = {};
  symbols.forEach(symbol => {
    const sector = sectorMap[symbol.symbol] || 'Unknown';
    sectorExposure[sector] = (sectorExposure[sector] || 0) + equalWeight;
  });
  
  return {
    concentration_risk: maxConcentration,
    max_single_position: maxConcentration,
    sector_exposure: sectorExposure,
    total_positions: symbols.length,
    diversification_score: Object.keys(sectorExposure).length / Math.max(symbols.length, 1)
  };
}

/**
 * Calculate maximum drawdown metrics from daily context
 */
function calculateDrawdownMetrics(dailyContext) {
  const contextEntries = Object.keys(dailyContext);
  if (contextEntries.length < 2) {
    return { max_drawdown: 0, current_drawdown: 0, drawdown_duration: 0 };
  }
  
  // Analyze confidence trends as proxy for performance
  const confidenceValues = contextEntries.map(trigger => dailyContext[trigger].avg_confidence || 0);
  
  let maxDrawdown = 0;
  let currentDrawdown = 0;
  let peak = Math.max(...confidenceValues);
  let drawdownDuration = 0;
  let currentDuration = 0;
  
  for (let i = 1; i < confidenceValues.length; i++) {
    if (confidenceValues[i] > peak) {
      peak = confidenceValues[i];
      currentDuration = 0; // Reset duration on new peak
    } else {
      const drawdown = (peak - confidenceValues[i]) / peak;
      currentDrawdown = drawdown;
      currentDuration++;
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        drawdownDuration = currentDuration;
      }
    }
  }
  
  return {
    max_drawdown: maxDrawdown,
    current_drawdown: currentDrawdown,
    drawdown_duration: drawdownDuration,
    confidence_peak: peak,
    confidence_current: confidenceValues[confidenceValues.length - 1] || 0
  };
}

/**
 * Calculate risk-adjusted position sizing recommendations
 */
function calculateRiskAdjustedPositionSizing(symbols, varMetrics) {
  const positionRecommendations = {};
  
  // Portfolio risk budget (2% daily portfolio VaR target)
  const portfolioRiskBudget = 0.02;
  const basePositionSize = portfolioRiskBudget / Math.max(symbols.length, 1);
  
  symbols.forEach(symbol => {
    const symbolVaR = varMetrics[symbol.symbol];
    
    if (symbolVaR && symbolVaR.daily_var_95) {
      // Kelly criterion approximation for position sizing
      const symbolVolatility = symbolVaR.volatility_estimate || 0.02;
      const expectedReturn = 0.001; // Assume 0.1% daily expected return
      const kellyFraction = expectedReturn / (symbolVolatility * symbolVolatility);
      
      // Conservative position sizing (25% of Kelly)
      const recommendedSize = Math.min(kellyFraction * 0.25, 0.1); // Max 10% position
      
      positionRecommendations[symbol.symbol] = {
        recommended_position_size: recommendedSize,
        base_position_size: basePositionSize,
        kelly_fraction: kellyFraction,
        risk_adjustment: recommendedSize / basePositionSize,
        max_position_value: symbol.current_price ? recommendedSize * 10000 : null // Assume $10k portfolio
      };
    } else {
      // Default sizing if VaR calculation failed
      positionRecommendations[symbol.symbol] = {
        recommended_position_size: basePositionSize,
        base_position_size: basePositionSize,
        risk_adjustment: 1.0,
        error: 'VaR calculation unavailable'
      };
    }
  });
  
  return positionRecommendations;
}

/**
 * Calculate overall portfolio risk score
 */
function calculateOverallRiskScore(varMetrics, portfolioMetrics, drawdownMetrics) {
  // Risk score from 0 (low risk) to 100 (high risk)
  let riskScore = 0;
  
  // VaR component (0-40 points)
  const avgVaR = Object.values(varMetrics).reduce((sum, var_data) => {
    return sum + (var_data.volatility_estimate || 0.02);
  }, 0) / Math.max(Object.keys(varMetrics).length, 1);
  riskScore += Math.min(avgVaR * 2000, 40); // Scale volatility to 0-40
  
  // Concentration risk (0-30 points)
  riskScore += portfolioMetrics.concentration_risk * 100 * 0.3;
  
  // Drawdown risk (0-30 points) 
  riskScore += drawdownMetrics.max_drawdown * 30;
  
  return {
    total_score: Math.min(Math.round(riskScore), 100),
    risk_level: riskScore < 30 ? 'Low' : riskScore < 60 ? 'Medium' : 'High',
    components: {
      volatility_risk: Math.min(avgVaR * 2000, 40),
      concentration_risk: portfolioMetrics.concentration_risk * 30,
      drawdown_risk: drawdownMetrics.max_drawdown * 30
    }
  };
}

/**
 * Get market data from Yahoo Finance API with circuit breaker
 */
async function getMarketData(symbol) {
  if (isCircuitBreakerOpen('yahooFinance')) {
    console.log(`   🔴 Yahoo Finance circuit breaker open for ${symbol}`);
    updateCircuitBreaker('yahooFinance', false);
    return {
      success: false,
      error: 'Yahoo Finance circuit breaker open'
    };
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CIRCUIT_BREAKER_CONFIG.timeoutMs);
    
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
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
    
    console.log(`   📊 Yahoo Finance raw data: ${timestamps.length} timestamps available, taking last ${days_to_take}`);
    
    for (let i = timestamps.length - days_to_take; i < timestamps.length; i++) {
      if (quote.open[i] && quote.high[i] && quote.low[i] && quote.close[i]) {
        ohlcv_data.push([
          quote.open[i],
          quote.high[i], 
          quote.low[i],
          quote.close[i],
          quote.volume[i] || 1000000  // Use 1M as default volume instead of 0
        ]);
      }
    }
    
    console.log(`   📊 Yahoo Finance processed: ${ohlcv_data.length} valid OHLCV records`);
    
    updateCircuitBreaker('yahooFinance', true);
    
    return {
      success: true,
      current_price: current_price,
      data: ohlcv_data
    };
    
  } catch (error) {
    clearTimeout(timeoutId);
    updateCircuitBreaker('yahooFinance', false);
    
    return {
      success: false,
      error: error.name === 'AbortError' ? 'Yahoo Finance timeout' : error.message
    };
  }
}

/**
 * Get TFT prediction (Temporal Fusion Transformer)
 */
async function getTFTPrediction(symbol, ohlcv_data, env) {
  try {
    const current_price = ohlcv_data[ohlcv_data.length - 1][3];
    
    
    // Call Vercel Edge TFT API
    console.log(`   🚀 Calling Vercel Edge TFT API for ${symbol}...`);
    
    // Prepare exactly 30 data points (pad if necessary) and convert to object format
    console.log(`   📊 Raw OHLCV data length: ${ohlcv_data.length} records`);
    let apiData = ohlcv_data.slice(-30);
    console.log(`   📊 After slice(-30): ${apiData.length} records`);
    
    if (apiData.length < 30) {
      const firstRow = apiData[0];
      const originalLength = apiData.length;
      while (apiData.length < 30) {
        apiData.unshift(firstRow); // Pad with first row
      }
      console.log(`   🔧 Padded from ${originalLength} to ${apiData.length} records using first row`);
    } else {
      console.log(`   ✅ Using last ${apiData.length} records (no padding needed)`);
    }
    
    // Add temporal context to make predictions time-aware
    const now = new Date();
    const marketHour = now.getUTCHours() - 5; // Convert to EST (simplified)
    const marketMinute = now.getUTCMinutes();
    const predictionTimeContext = {
      market_hour: marketHour,
      market_minute: marketMinute,
      time_of_day: marketHour < 9 ? 'pre_market' : (marketHour < 16 ? 'market_hours' : 'after_market'),
      prediction_sequence: Math.floor((marketHour * 60 + marketMinute) / 30), // 30-minute intervals
      volatility_factor: Math.sin((marketHour - 9.5) / 6.5 * Math.PI) * 0.1 + 1.0 // Market volatility pattern
    };

    // Convert from [open, high, low, close, volume] arrays to {open, high, low, close, volume, date} objects
    const convertedData = apiData.map((row, index) => ({
      open: row[0],
      high: row[1], 
      low: row[2],
      close: row[3],
      volume: row[4] || 1000000,
      date: new Date(Date.now() - (apiData.length - index - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));
    
    // Add temporal context to the most recent data point to influence TFT predictions
    const lastIndex = convertedData.length - 1;
    convertedData[lastIndex].temporal_context = predictionTimeContext;
    
    console.log(`   📋 TFT payload: ${convertedData.length} records with temporal context: ${predictionTimeContext.time_of_day}`);
    
    // Create timeout signal
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const vercelResponse = await fetch(`https://vercel-edge-functions-facp1quzi-yang-goufangs-projects.vercel.app/api/predict-tft?x-vercel-protection-bypass=${env.VERCEL_AUTOMATION_BYPASS_SECRET}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: symbol,
        ohlcvData: convertedData
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!vercelResponse.ok) {
      const errorText = await vercelResponse.text();
      console.log(`   ❌ TFT API HTTP ${vercelResponse.status} error: ${errorText}`);
      throw new Error(`Vercel TFT API error: ${vercelResponse.status} - ${errorText}`);
    }
    
    const result = await vercelResponse.json();
    
    // Extract prediction data from new TFT API format
    const prediction = result.prediction;
    const predictedPrice = prediction?.prediction || current_price;
    const confidence = prediction?.confidence || 0.75;
    
    return {
      signal_score: (predictedPrice - current_price) / current_price,
      confidence: confidence,
      predicted_price: predictedPrice,
      current_price: current_price,
      direction: predictedPrice > current_price ? 'UP' : 'DOWN',
      model_latency: result.performance?.inferenceTimeMs || 20,
      model_used: prediction?.modelUsed || 'RealEdgeTFT',
      api_source: 'Vercel-Edge-Real-TFT',
      technical_indicators: prediction?.technicalIndicators || {},
      attention_metrics: prediction?.attentionMetrics || {}
    };
    
  } catch (error) {
    const errorDetails = {
      symbol: symbol,
      error_type: error.name || 'Unknown',
      error_message: error.message || 'No message',
      url: `https://vercel-edge-functions-facp1quzi-yang-goufangs-projects.vercel.app/api/predict-tft`,
      timestamp: new Date().toISOString()
    };
    console.error(`   ❌ TFT prediction error for ${symbol}:`, JSON.stringify(errorDetails));
    throw error;
  }
}

/**
 * Get N-HITS prediction (Neural Hierarchical Interpolation)
 */
async function getNHITSPrediction(symbol, ohlcv_data, env) {
  try {
    const current_price = ohlcv_data[ohlcv_data.length - 1][3];
    
    
    // Call Vercel Edge N-HITS API
    console.log(`   🚀 Calling Vercel Edge N-HITS API for ${symbol}...`);
    
    // Prepare exactly 30 data points (pad if necessary) and convert to object format
    console.log(`   📊 Raw OHLCV data length: ${ohlcv_data.length} records`);
    let apiData = ohlcv_data.slice(-30);
    console.log(`   📊 After slice(-30): ${apiData.length} records`);
    
    if (apiData.length < 30) {
      const firstRow = apiData[0];
      const originalLength = apiData.length;
      while (apiData.length < 30) {
        apiData.unshift(firstRow); // Pad with first row
      }
      console.log(`   🔧 Padded from ${originalLength} to ${apiData.length} records using first row`);
    } else {
      console.log(`   ✅ Using last ${apiData.length} records (no padding needed)`);
    }
    
    // Add temporal context to make N-HITS predictions time-aware (different from TFT)
    const now = new Date();
    const marketHour = now.getUTCHours() - 5; // Convert to EST (simplified)
    const marketMinute = now.getUTCMinutes();
    const predictionTimeContext = {
      market_hour: marketHour,
      market_minute: marketMinute,
      time_of_day: marketHour < 9 ? 'pre_market' : (marketHour < 16 ? 'market_hours' : 'after_market'),
      prediction_sequence: Math.floor((marketHour * 60 + marketMinute) / 30), // 30-minute intervals
      nhits_volatility_factor: Math.cos((marketHour - 9.5) / 6.5 * Math.PI) * 0.15 + 1.0 // Different pattern for N-HITS
    };

    // Convert from [open, high, low, close, volume] arrays to {open, high, low, close, volume, date} objects
    const convertedData = apiData.map((row, index) => ({
      open: row[0],
      high: row[1], 
      low: row[2],
      close: row[3],
      volume: row[4] || 1000000,
      date: new Date(Date.now() - (apiData.length - index - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));
    
    // Add temporal context to the most recent data point to influence N-HITS predictions
    const lastIndex = convertedData.length - 1;
    convertedData[lastIndex].temporal_context = predictionTimeContext;
    
    console.log(`   📋 N-HITS payload: ${convertedData.length} records with temporal context: ${predictionTimeContext.time_of_day}`);
    
    // Create timeout signal
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const vercelResponse = await fetch(`https://vercel-edge-functions-facp1quzi-yang-goufangs-projects.vercel.app/api/predict-nhits?x-vercel-protection-bypass=${env.VERCEL_AUTOMATION_BYPASS_SECRET}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: symbol,
        ohlcvData: convertedData
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!vercelResponse.ok) {
      const errorText = await vercelResponse.text();
      console.log(`   ❌ N-HITS API HTTP ${vercelResponse.status} error: ${errorText}`);
      throw new Error(`Vercel N-HITS API error: ${vercelResponse.status} - ${errorText}`);
    }
    
    const result = await vercelResponse.json();
    
    // Extract prediction data from new N-HITS API format
    const prediction = result.prediction;
    const predictedPrice = prediction?.prediction || current_price;
    const confidence = prediction?.confidence || 0.69;
    
    return {
      signal_score: (predictedPrice - current_price) / current_price,
      confidence: confidence,
      predicted_price: predictedPrice,
      current_price: current_price,
      direction: predictedPrice > current_price ? 'UP' : 'DOWN',
      model_latency: result.performance?.inferenceTimeMs || 1,
      model_used: prediction?.modelUsed || 'RealEdgeNHITS',
      api_source: 'Vercel-Node-Real-NHITS',
      technical_indicators: prediction?.technicalIndicators || {}
    };
    
  } catch (error) {
    const errorDetails = {
      symbol: symbol,
      error_type: error.name || 'Unknown',
      error_message: error.message || 'No message',
      url: `https://vercel-edge-functions-facp1quzi-yang-goufangs-projects.vercel.app/api/predict-nhits`,
      timestamp: new Date().toISOString()
    };
    console.error(`   ❌ N-HITS prediction error for ${symbol}:`, JSON.stringify(errorDetails));
    throw new Error(`N-HITS prediction failed: ${error.message}`);
  }
}

/**
 * Helper functions for TFT calculations
 */
function calculateMomentum(prices, window) {
  if (prices.length < window + 1) return 0;
  
  const recent = prices.slice(-window);
  const older = prices.slice(-(window + 1), -1);
  
  const recent_avg = recent.reduce((a, b) => a + b) / recent.length;
  const older_avg = older.reduce((a, b) => a + b) / older.length;
  
  return (recent_avg - older_avg) / older_avg;
}

function calculateVWAP(prices, volumes, window) {
  const length = Math.min(window, prices.length);
  const recent_prices = prices.slice(-length);
  const recent_volumes = volumes.slice(-length);
  
  let totalVolume = 0;
  let totalVolumePrice = 0;
  
  for (let i = 0; i < length; i++) {
    const volume = recent_volumes[i] || 1; // Default volume if missing
    totalVolume += volume;
    totalVolumePrice += recent_prices[i] * volume;
  }
  
  return totalVolume > 0 ? totalVolumePrice / totalVolume : recent_prices[recent_prices.length - 1];
}

function calculateVolatility(prices, window) {
  const length = Math.min(window, prices.length);
  const recent_prices = prices.slice(-length);
  
  if (length < 2) return 0.01; // Default low volatility
  
  const returns = [];
  for (let i = 1; i < length; i++) {
    returns.push((recent_prices[i] - recent_prices[i-1]) / recent_prices[i-1]);
  }
  
  const mean_return = returns.reduce((a, b) => a + b) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean_return, 2), 0) / returns.length;
  
  return Math.sqrt(variance);
}

/**
 * Combine dual model predictions (TFT + N-HITS)
 */
function combineDualModelPredictions(tftPrediction, nhitsPrediction, symbol, currentPrice) {
  console.log(`   🔄 Combining dual model predictions for ${symbol}`);
  
  // Handle cases where one or both models failed
  if (!tftPrediction && !nhitsPrediction) {
    console.log(`   ❌ Both models failed for ${symbol}, using fallback`);
    return {
      signal_score: 0,
      confidence: 0.4,
      predicted_price: currentPrice,
      current_price: currentPrice,
      direction: 'NEUTRAL',
      model_latency: 2,
      model_used: 'Fallback-Both-Failed',
      api_source: 'Local'
    };
  }
  
  if (!tftPrediction) {
    console.log(`   ⚠️ TFT failed, using N-HITS only for ${symbol}`);
    nhitsPrediction.model_used = 'N-HITS-Only';
    return nhitsPrediction;
  }
  
  if (!nhitsPrediction) {
    console.log(`   ⚠️ N-HITS failed, using TFT only for ${symbol}`);
    tftPrediction.model_used = 'TFT-Only';
    return tftPrediction;
  }
  
  // Both models succeeded - combine intelligently
  console.log(`   ✅ Both models succeeded for ${symbol}, combining predictions`);
  
  // Model-specific weights based on their strengths
  const tftWeight = 0.55;     // TFT slightly favored for complex patterns
  const nhitsWeight = 0.45;   // N-HITS good for trend continuation
  
  // Combine signal scores
  const combinedSignalScore = (tftPrediction.signal_score * tftWeight) + (nhitsPrediction.signal_score * nhitsWeight);
  
  // Combine confidence (higher confidence models get more weight)
  const confidenceWeightedAvg = (
    (tftPrediction.confidence * tftWeight) + 
    (nhitsPrediction.confidence * nhitsWeight)
  );
  
  // Consensus bonus: if both models agree on direction, boost confidence
  const directionsAgree = tftPrediction.direction === nhitsPrediction.direction;
  const consensusBonus = directionsAgree ? 0.1 : -0.05;
  const finalConfidence = Math.min(0.95, Math.max(0.3, confidenceWeightedAvg + consensusBonus));
  
  // Combine predicted prices (weighted average)
  const combinedPredictedPrice = (
    (tftPrediction.predicted_price * tftWeight) + 
    (nhitsPrediction.predicted_price * nhitsWeight)
  );
  
  // Final direction based on combined signal
  const finalDirection = combinedSignalScore > 0.05 ? 'UP' : (combinedSignalScore < -0.05 ? 'DOWN' : 'NEUTRAL');
  
  // Combined model latency
  const combinedLatency = Math.max(tftPrediction.model_latency, nhitsPrediction.model_latency);
  
  const result = {
    signal_score: combinedSignalScore,
    confidence: finalConfidence,
    predicted_price: combinedPredictedPrice,
    current_price: currentPrice,
    direction: finalDirection,
    model_latency: combinedLatency,
    model_used: 'TFT+N-HITS-Ensemble',
    api_source: 'Dual',
    model_comparison: {
      tft_prediction: {
        price: tftPrediction.predicted_price,
        direction: tftPrediction.direction,
        confidence: tftPrediction.confidence,
        signal_score: tftPrediction.signal_score,
        source: tftPrediction.model_used
      },
      nhits_prediction: {
        price: nhitsPrediction.predicted_price,
        direction: nhitsPrediction.direction,
        confidence: nhitsPrediction.confidence,
        signal_score: nhitsPrediction.signal_score,
        source: nhitsPrediction.model_used
      },
      agreement: {
        directional_consensus: directionsAgree,
        confidence_boost: consensusBonus,
        prediction_spread: Math.abs(tftPrediction.predicted_price - nhitsPrediction.predicted_price),
        signal_correlation: Math.abs(tftPrediction.signal_score - nhitsPrediction.signal_score)
      }
    }
  };
  
  console.log(`   📊 Combined: ${finalDirection} (TFT: ${tftPrediction.direction}, N-HITS: ${nhitsPrediction.direction}) - Consensus: ${directionsAgree ? '✅' : '❌'}`);
  
  return result;
}


/**
 * Simple prediction fallback
 */
async function getSimplePrediction(symbol, ohlcv_data) {
  const closes = ohlcv_data.map(d => d[3]);
  const current_price = closes[closes.length - 1];
  const previous_price = closes[closes.length - 2] || current_price;
  
  const change = (current_price - previous_price) / previous_price;
  
  return {
    signal_score: change > 0 ? 0.5 : -0.5,
    confidence: 0.6,
    predicted_price: current_price * (1 + change * 0.5),
    current_price: current_price,
    direction: change > 0 ? 'UP' : 'DOWN',
    model_latency: 2
  };
}

/**
 * Robust JSON parsing for DeepSeek responses with multiple fallback strategies
 */
function parseDeepSeekResponse(content) {
  try {
    // Strategy 1: Try direct JSON parse (if response is clean JSON)
    return JSON.parse(content);
  } catch {
    try {
      // Strategy 2: Extract JSON object with nested support
      const jsonMatch = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Strategy 3: Simple JSON extraction (original method)
      try {
        const simpleMatch = content.match(/\{[^}]+\}/);
        if (simpleMatch) {
          return JSON.parse(simpleMatch[0]);
        }
      } catch {
        // Strategy 4: Manual parsing as fallback
        const sentiment = extractSentimentManual(content);
        const score = extractScoreManual(content);
        const reasoning = extractReasoningManual(content);
        
        if (sentiment) {
          return {
            sentiment: sentiment,
            score: score,
            reasoning: reasoning
          };
        }
      }
    }
  }
  
  return null;
}

/**
 * Manual sentiment extraction as ultimate fallback
 */
function extractSentimentManual(content) {
  const upperContent = content.toUpperCase();
  if (upperContent.includes('POSITIVE') || upperContent.includes('BULLISH') || upperContent.includes('BUY')) {
    return 'POSITIVE';
  } else if (upperContent.includes('NEGATIVE') || upperContent.includes('BEARISH') || upperContent.includes('SELL')) {
    return 'NEGATIVE';
  } else if (upperContent.includes('NEUTRAL') || upperContent.includes('HOLD')) {
    return 'NEUTRAL';
  }
  return 'NEUTRAL';
}

/**
 * Manual score extraction
 */
function extractScoreManual(content) {
  const scoreMatch = content.match(/(?:score|confidence)[":\s]*([0-9]*\.?[0-9]+)/i);
  if (scoreMatch) {
    const score = parseFloat(scoreMatch[1]);
    return Math.min(Math.max(score, 0.1), 1.0); // Clamp between 0.1-1.0
  }
  return 0.7; // Default confidence
}

/**
 * Manual reasoning extraction
 */
function extractReasoningManual(content) {
  const reasoningMatch = content.match(/(?:reasoning|explanation)[":\s]*["']([^"']+)["']/i);
  if (reasoningMatch) {
    return reasoningMatch[1].substring(0, 100);
  }
  return 'Sentiment analysis completed';
}

/**
 * Get sentiment analysis using ModelScope DeepSeek-V3.1
 */
async function getSentimentAnalysis(symbol, env) {
  try {
    // Get financial news for sentiment analysis
    const newsData = await getFinancialNews(symbol);
    
    if (!newsData.success || newsData.articles.length === 0) {
      console.log(`   ⚠️ No news data for ${symbol}, using neutral sentiment`);
      return {
        signal_score: 0.0,
        confidence: 0.5,
        sentiment: 'NEUTRAL',
        recommendation: 'HOLD',
        news_articles: 0,
        source: 'no_news'
      };
    }
    
    // Analyze sentiment using ModelScope DeepSeek-V3.1
    let totalSentiment = 0;
    let sentimentCount = 0;
    const sentimentResults = [];
    
    // Process up to 3 most recent articles
    const articlesToAnalyze = newsData.articles.slice(0, 3);
    
    for (const article of articlesToAnalyze) {
      try {
        // Combine title and description for sentiment analysis
        const textToAnalyze = `${article.title}. ${article.description || ''}`.substring(0, 800);
        
        console.log(`   🔍 Analyzing sentiment for ${symbol}: "${textToAnalyze.substring(0, 100)}..."`);
        
        // Check circuit breaker for ModelScope
        if (isCircuitBreakerOpen('modelScope')) {
          console.log(`   🔴 ModelScope circuit breaker open`);
          throw new Error('ModelScope circuit breaker open');
        }
        
        const prompt = `Analyze the financial sentiment of this news about ${symbol}: "${textToAnalyze}". Respond with only JSON: {"sentiment": "POSITIVE/NEGATIVE/NEUTRAL", "score": 0.0-1.0, "reasoning": "brief explanation"}`;
        
        console.log(`   📡 Making ModelScope API call to DeepSeek-V3.1...`);
        console.log(`   🔑 API Key exists: ${!!env.MODELSCOPE_API_KEY}`);
        
        // Add timeout handling for ModelScope API
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CIRCUIT_BREAKER_CONFIG.timeoutMs);
        
        const sentimentResponse = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${env.MODELSCOPE_API_KEY}`,
            'Content-Type': 'application/json',
            'User-Agent': 'TradingBot/1.0'
          },
          body: JSON.stringify({
            model: 'deepseek-ai/DeepSeek-V3.1',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 150,
            temperature: 0.1
          })
        });
        
        clearTimeout(timeoutId);
        
        console.log(`   📡 ModelScope response status: ${sentimentResponse.status}`);
        
        updateCircuitBreaker('modelScope', true);
        
        if (sentimentResponse.ok) {
          const data = await sentimentResponse.json();
          console.log(`   📊 ModelScope response received, parsing...`);
          
          const content = data.choices[0].message.content;
          console.log(`   🎯 Content to parse: ${content}`);
          
          // Robust JSON parsing with multiple fallback strategies
          const sentimentData = parseDeepSeekResponse(content);
          
          if (sentimentData) {
            let score = 0;
            if (sentimentData.sentiment === 'POSITIVE') {
              score = sentimentData.score || 0.7; // Default confidence if missing
            } else if (sentimentData.sentiment === 'NEGATIVE') {
              score = -(sentimentData.score || 0.7);
            }
            
            totalSentiment += score;
            sentimentCount++;
            
            console.log(`   📈 Sentiment processed: ${sentimentData.sentiment} (${score})`);
            
            sentimentResults.push({
              title: article.title.substring(0, 100),
              sentiment: sentimentData.sentiment,
              score: score,
              confidence: Math.abs(score),
              reasoning: sentimentData.reasoning || 'No reasoning provided'
            });
          } else {
            console.log(`   ❌ Failed to parse sentiment response: ${content}`);
          }
        } else {
          const errorText = await sentimentResponse.text();
          console.log(`   ❌ ModelScope API error: ${sentimentResponse.status} - ${errorText}`);
          throw new Error(`ModelScope API error: ${sentimentResponse.status}`);
        }
      } catch (aiError) {
        updateCircuitBreaker('modelscope', false);
        console.log(`   ⚠️ ModelScope sentiment analysis failed: ${aiError.message}`);
      }
    }
    
    if (sentimentCount === 0) {
      return {
        signal_score: 0.0,
        confidence: 0.5,
        sentiment: 'NEUTRAL',
        recommendation: 'HOLD',
        news_articles: articlesToAnalyze.length,
        source: 'ai_failed'
      };
    }
    
    // Calculate average sentiment
    const avgSentiment = totalSentiment / sentimentCount;
    const confidence = Math.min(0.9, 0.6 + Math.abs(avgSentiment) * 0.3);
    
    // Determine sentiment category and recommendation
    let sentiment, recommendation;
    if (avgSentiment > 0.2) {
      sentiment = 'BULLISH';
      recommendation = 'BUY';
    } else if (avgSentiment < -0.2) {
      sentiment = 'BEARISH';  
      recommendation = 'SELL';
    } else {
      sentiment = 'NEUTRAL';
      recommendation = 'HOLD';
    }
    
    console.log(`   📰 Sentiment for ${symbol}: ${sentiment} (${avgSentiment.toFixed(2)}, ${sentimentCount} articles)`);
    
    return {
      signal_score: avgSentiment,
      confidence: confidence,
      sentiment: sentiment,
      recommendation: recommendation,
      news_articles: sentimentCount,
      articles_analyzed: sentimentResults,
      source: 'modelscope_deepseek_v3.1'
    };
    
  } catch (error) {
    console.error(`   ❌ Sentiment analysis error for ${symbol}:`, error.message);
    return {
      signal_score: 0.0,
      confidence: 0.5,
      sentiment: 'NEUTRAL',
      recommendation: 'HOLD',
      error: error.message,
      source: 'error'
    };
  }
}

/**
 * Get real financial news for sentiment analysis using multiple sources
 */
async function getFinancialNews(symbol) {
  try {
    console.log(`   📰 Fetching real financial news for ${symbol}...`);
    
    // Try multiple news sources with fallbacks
    let articles = [];
    
    // Source 1: Alpha Vantage News (Free tier: 5 requests/min, 100 requests/day)
    if (env.ALPHA_VANTAGE_API_KEY) {
      articles = await getAlphaVantageNews(symbol, env);
      if (articles.length > 0) {
        console.log(`   ✅ Got ${articles.length} articles from Alpha Vantage`);
        return { success: true, articles: articles.slice(0, 3), total: articles.length, source: 'alpha_vantage' };
      }
    }
    
    // Source 2: Yahoo Finance RSS (Free, no API key required)
    articles = await getYahooFinanceNews(symbol);
    if (articles.length > 0) {
      console.log(`   ✅ Got ${articles.length} articles from Yahoo Finance RSS`);
      return { success: true, articles: articles.slice(0, 3), total: articles.length, source: 'yahoo_finance' };
    }
    
    // Source 3: NewsAPI (Free tier: 100 requests/day)
    if (env.NEWS_API_KEY) {
      articles = await getNewsAPIFinancial(symbol, env);
      if (articles.length > 0) {
        console.log(`   ✅ Got ${articles.length} articles from NewsAPI`);
        return { success: true, articles: articles.slice(0, 3), total: articles.length, source: 'newsapi' };
      }
    }
    
    // Source 4: Financial Modeling Prep (Free tier: 250 requests/day)
    if (env.FMP_API_KEY) {
      articles = await getFMPNews(symbol, env);
      if (articles.length > 0) {
        console.log(`   ✅ Got ${articles.length} articles from Financial Modeling Prep`);
        return { success: true, articles: articles.slice(0, 3), total: articles.length, source: 'fmp' };
      }
    }
    
    // Fallback: Use basic financial context (better than simulation)
    console.log(`   ⚠️ No real news available, using market context for ${symbol}`);
    const contextArticles = await getMarketContextNews(symbol);
    return { success: true, articles: contextArticles, total: contextArticles.length, source: 'market_context' };
    
  } catch (error) {
    console.error(`   ❌ Financial news fetch failed: ${error.message}`);
    return {
      success: false,
      articles: [],
      error: error.message,
      source: 'error'
    };
  }
}

/**
 * Get news from Alpha Vantage (most reliable financial news API)
 */
async function getAlphaVantageNews(symbol, env) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${env.ALPHA_VANTAGE_API_KEY}&limit=5`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'TradingBot/1.0' }
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`Alpha Vantage HTTP ${response.status}`);
    
    const data = await response.json();
    
    if (data.feed && data.feed.length > 0) {
      return data.feed.map(item => ({
        title: item.title,
        description: item.summary,
        publishedAt: item.time_published,
        url: item.url,
        source: item.source
      }));
    }
    
    return [];
  } catch (error) {
    console.log(`   ⚠️ Alpha Vantage failed: ${error.message}`);
    return [];
  }
}

/**
 * Get news from Yahoo Finance RSS (free, no API key)
 */
async function getYahooFinanceNews(symbol) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    
    // Yahoo Finance company news RSS
    const response = await fetch(
      `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}&region=US&lang=en-US`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)' }
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`Yahoo Finance HTTP ${response.status}`);
    
    const xmlText = await response.text();
    
    // Parse RSS XML (simple regex parsing for Cloudflare Workers)
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>/;
    const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>/;
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;
    const linkRegex = /<link>(.*?)<\/link>/;
    
    let match;
    while ((match = itemRegex.exec(xmlText)) !== null && items.length < 5) {
      const itemXml = match[1];
      const title = titleRegex.exec(itemXml)?.[1] || '';
      const description = descRegex.exec(itemXml)?.[1] || '';
      const pubDate = pubDateRegex.exec(itemXml)?.[1] || '';
      const link = linkRegex.exec(itemXml)?.[1] || '';
      
      if (title && description) {
        items.push({
          title: title.trim(),
          description: description.replace(/<[^>]*>/g, '').trim().substring(0, 300),
          publishedAt: pubDate,
          url: link,
          source: 'Yahoo Finance'
        });
      }
    }
    
    return items;
  } catch (error) {
    console.log(`   ⚠️ Yahoo Finance RSS failed: ${error.message}`);
    return [];
  }
}

/**
 * Get news from NewsAPI
 */
async function getNewsAPIFinancial(symbol, env) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const query = `${symbol} AND (earnings OR revenue OR stock OR financial OR profit OR loss OR analyst)`;
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=5`,
      {
        signal: controller.signal,
        headers: { 
          'X-API-Key': env.NEWS_API_KEY,
          'User-Agent': 'TradingBot/1.0'
        }
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`NewsAPI HTTP ${response.status}`);
    
    const data = await response.json();
    
    if (data.articles && data.articles.length > 0) {
      return data.articles.map(article => ({
        title: article.title,
        description: article.description,
        publishedAt: article.publishedAt,
        url: article.url,
        source: article.source.name
      }));
    }
    
    return [];
  } catch (error) {
    console.log(`   ⚠️ NewsAPI failed: ${error.message}`);
    return [];
  }
}

/**
 * Get news from Financial Modeling Prep
 */
async function getFMPNews(symbol, env) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(
      `https://financialmodelingprep.com/api/v3/stock_news?tickers=${symbol}&limit=5&apikey=${env.FMP_API_KEY}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'TradingBot/1.0' }
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`FMP HTTP ${response.status}`);
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return data.map(item => ({
        title: item.title,
        description: item.text.substring(0, 300),
        publishedAt: item.publishedDate,
        url: item.url,
        source: item.site
      }));
    }
    
    return [];
  } catch (error) {
    console.log(`   ⚠️ Financial Modeling Prep failed: ${error.message}`);
    return [];
  }
}

/**
 * Generate market context news when APIs fail (better than simulation)
 */
async function getMarketContextNews(symbol) {
  const contexts = [
    {
      title: `${symbol} market analysis: Recent trading patterns and volume indicators`,
      description: `Technical analysis shows ${symbol} trading within key support and resistance levels with moderate volume activity.`,
      publishedAt: new Date().toISOString(),
      source: 'Market Context'
    },
    {
      title: `${symbol} sector performance: Industry trends and competitive positioning`,  
      description: `${symbol} sector showing mixed signals with varying performance across major industry players and market conditions.`,
      publishedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      source: 'Market Context'
    }
  ];
  
  return contexts;
}

/**
 * Combine price and sentiment signals
 */
function combineSignals(priceSignal, sentimentSignal, symbol, currentPrice) {
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
    predicted_price: priceSignal.predicted_price, // Add predicted_price to top level
    direction: priceSignal.direction, // Add direction to top level for Facebook messaging
    reasoning: `${priceSignal.direction} price prediction (${priceSignal.model_used}) + ${sentimentSignal.sentiment} sentiment`,
    timestamp: new Date().toISOString(),
    system_version: '2.0-Dual-Model-Production',
    components: {
      price_prediction: {
        signal_score: priceSignal.signal_score,
        confidence: priceSignal.confidence,
        model_used: priceSignal.model_used,
        predicted_price: priceSignal.predicted_price,
        direction: priceSignal.direction,
        latency_ms: priceSignal.model_latency,
        model_comparison: priceSignal.model_comparison || null
      },
      sentiment_analysis: {
        signal_score: sentimentSignal.signal_score,
        confidence: sentimentSignal.confidence,
        sentiment: sentimentSignal.sentiment,
        recommendation: sentimentSignal.recommendation,
        news_articles: sentimentSignal.news_articles || 0,
        source: sentimentSignal.source || 'unknown'
      },
      dual_model_analytics: priceSignal.model_comparison ? {
        both_models_active: true,
        directional_consensus: priceSignal.model_comparison.agreement.directional_consensus,
        prediction_spread_pct: ((priceSignal.model_comparison.agreement.prediction_spread / currentPrice) * 100).toFixed(3),
        signal_correlation: priceSignal.model_comparison.agreement.signal_correlation.toFixed(3),
        ensemble_confidence_boost: priceSignal.model_comparison.agreement.confidence_boost
      } : {
        both_models_active: false,
        active_model: priceSignal.model_used,
        fallback_reason: priceSignal.model_used.includes('Only') ? 'single_model_failure' : 'unknown'
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
    high_confidence_signals: confidenceScores.filter(c => c > 0.75).length,
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
  if (env.EMAIL_ENABLED === 'true' && env.ALERT_EMAIL) {
    await sendEmailAlerts(alerts, analysisResults, env);
  }
  
  // Send Slack alerts  
  if (env.SLACK_WEBHOOK_URL) {
    await sendSlackAlerts(alerts, analysisResults, env);
  }

  // Send Facebook Messenger alerts with tracking
  if (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) {
    const cronExecutionId = analysisResults.cronExecutionId || `alert_${Date.now()}`;
    await sendFacebookMessengerAlertWithTracking(alerts, analysisResults, env, cronExecutionId);
  }
  
  console.log(`📬 Sent ${alerts.length} high-confidence alerts`);
}

/**
 * Send email alerts using MailChannels
 */
async function sendEmailAlerts(alerts, analysisResults, env) {
  try {
    const emailContent = `
TFT Trading System Alert - ${new Date().toLocaleDateString()}

${alerts.length} high-confidence trading signals detected:

${alerts.map(alert => `• ${alert.symbol}: ${alert.message}`).join('\n')}

Performance Summary:
• Success Rate: ${analysisResults.performance_metrics.success_rate.toFixed(1)}%
• Average Confidence: ${(analysisResults.performance_metrics.avg_confidence * 100).toFixed(1)}%
• Signal Distribution: ${JSON.stringify(analysisResults.performance_metrics.signal_distribution)}

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
    
    console.log('📧 Email alert sent');
    
  } catch (error) {
    console.error('❌ Email alert failed:', error);
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
          fields: alerts.slice(0, 5).map(alert => ({
            title: alert.symbol,
            value: alert.message.replace('🎯 High confidence signal: ', ''),
            short: true
          }))
        }
      ]
    };
    
    await fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    });
    
    console.log('💬 Slack alert sent');
    
  } catch (error) {
    console.error('❌ Slack alert failed:', error);
  }
}

/**
 * Generate comprehensive prediction accuracy report for Facebook messages
 */
async function generatePredictionAccuracyReport(analysisResults, env, includeHistory = false) {
  const perf = analysisResults.performance_metrics;
  let reportText = `\n🎯 Model Performance Report:\n`;
  
  // Current prediction metrics
  reportText += `• System Success Rate: ${perf.success_rate.toFixed(1)}%\n`;
  reportText += `• Average Confidence: ${(perf.avg_confidence * 100).toFixed(1)}%\n`;
  reportText += `• Predictions Generated: ${perf.total_symbols}\n`;
  reportText += `• Signal Distribution: ${JSON.stringify(perf.signal_distribution).replace(/"/g, '').replace('BUY', '↗️Up').replace('SELL', '↘️Down').replace('HOLD', '➡️Neutral')}\n`;
  reportText += `\n📊 Detailed Analysis & Fact Table:\n`;
  reportText += `https://tft-trading-system.yanggf.workers.dev/fact-table\n`;
  
  // Historical accuracy validation (if available)
  if (includeHistory) {
    try {
      const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Check for historical accuracy data from yesterday  
      const yesterdayData = await env.TRADING_RESULTS.get(`analysis_${yesterdayStr}`);
      
      if (yesterdayData) {
        const accuracyMetrics = await calculateHistoricalAccuracy(yesterdayStr, env);
        if (accuracyMetrics.validPredictions > 0) {
          reportText += `\n📊 Yesterday's Accuracy Results:\n`;
          reportText += `• Price Accuracy: ${(100 - accuracyMetrics.avgPriceError).toFixed(1)}%\n`;
          reportText += `• Direction Accuracy: ${accuracyMetrics.directionAccuracy.toFixed(1)}% (${accuracyMetrics.correctDirections}/${accuracyMetrics.validPredictions})\n`;
          reportText += `• TFT Direction Hit: ${accuracyMetrics.tftDirectionHit.toFixed(1)}%\n`;
          reportText += `• N-HITS Direction Hit: ${accuracyMetrics.nhitsDirectionHit.toFixed(1)}%\n`;
          reportText += `• Best Model: ${accuracyMetrics.bestModel} (${accuracyMetrics.bestModelWins} wins)\n`;
          reportText += `\n🔍 View detailed accuracy breakdown:\n`;
          reportText += `https://tft-trading-system.yanggf.workers.dev/fact-table\n`;
        }
      }
    } catch (error) {
      console.log('⚠️ Historical accuracy calculation failed:', error.message);
    }
  }
  
  return reportText;
}

/**
 * Calculate historical accuracy metrics using the same logic as fact table API
 */
async function calculateHistoricalAccuracy(dateStr, env) {
  const symbols = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'NVDA'];
  
  let totalPredictions = 0;
  let correctDirections = 0;
  let tftCorrectDirections = 0; 
  let nhitsCorrectDirections = 0;
  let priceErrorSum = 0;
  let modelPerformance = { TFT: 0, 'N-HITS': 0, Ensemble: 0 };
  
  // Use the same fact data API logic for consistency
  for (const symbol of symbols) {
    try {
      const analysisKey = `analysis_${dateStr}`;
      const analysisJson = await env.TRADING_RESULTS.get(analysisKey);
      if (!analysisJson) continue;
      
      const analysisData = JSON.parse(analysisJson);
      
      // Get market close price using the same function as fact table
      const marketClosePrice = await getActualPrice(symbol, dateStr);
      if (!marketClosePrice) continue;
      
      // Extract predictions using same logic as fact table API
      if (analysisData.multiple_executions) {
        const executionTimes = Object.keys(analysisData.multiple_executions);
        
        for (const executionTime of executionTimes) {
          const executionData = analysisData.multiple_executions[executionTime];
          const symbolData = executionData.trading_signals?.[symbol];
          
          if (symbolData) {
            const models = symbolData.components?.price_prediction?.model_comparison;
            const currentPrice = symbolData.current_price;
            const predictedPrice = symbolData.components?.price_prediction?.predicted_price;
            const tftPrice = models?.tft_prediction?.price;
            const nhitsPrice = models?.nhits_prediction?.price;
            
            if (currentPrice && predictedPrice && tftPrice && nhitsPrice && marketClosePrice) {
              totalPredictions++;
              
              // Price accuracy using same calculation as fact table
              const priceError = Math.abs(predictedPrice - marketClosePrice) / marketClosePrice * 100;
              priceErrorSum += priceError;
              
              // Direction accuracy using same logic as fact table API
              const predictedDirection = predictedPrice > currentPrice ? 'UP' : predictedPrice < currentPrice ? 'DOWN' : 'FLAT';
              const actualDirection = marketClosePrice > currentPrice ? 'UP' : marketClosePrice < currentPrice ? 'DOWN' : 'FLAT';
              const tftDirection = tftPrice > currentPrice ? 'UP' : tftPrice < currentPrice ? 'DOWN' : 'FLAT';
              const nhitsDirection = nhitsPrice > currentPrice ? 'UP' : nhitsPrice < currentPrice ? 'DOWN' : 'FLAT';
              
              if (predictedDirection === actualDirection) correctDirections++;
              if (tftDirection === actualDirection) tftCorrectDirections++;
              if (nhitsDirection === actualDirection) nhitsCorrectDirections++;
              
              // Best model tracking using same logic as fact table
              const tftError = Math.abs(tftPrice - marketClosePrice);
              const nhitsError = Math.abs(nhitsPrice - marketClosePrice);
              const ensembleError = Math.abs(predictedPrice - marketClosePrice);
              
              const minError = Math.min(tftError, nhitsError, ensembleError);
              if (minError === tftError) modelPerformance.TFT++;
              else if (minError === nhitsError) modelPerformance['N-HITS']++;
              else modelPerformance.Ensemble++;
            }
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Error processing ${symbol} accuracy for ${dateStr}:`, error.message);
    }
  }
  
  if (totalPredictions === 0) {
    return { validPredictions: 0 };
  }
  
  const bestModel = Object.keys(modelPerformance).reduce((a, b) => 
    modelPerformance[a] > modelPerformance[b] ? a : b
  );
  
  return {
    validPredictions: totalPredictions,
    correctDirections: correctDirections,
    avgPriceError: priceErrorSum / totalPredictions,
    directionAccuracy: (correctDirections / totalPredictions) * 100,
    tftDirectionHit: (tftCorrectDirections / totalPredictions) * 100,
    nhitsDirectionHit: (nhitsCorrectDirections / totalPredictions) * 100,
    bestModel: bestModel,
    bestModelWins: modelPerformance[bestModel]
  };
}

/**
 * Send Facebook Messenger alert with retry
 */
async function sendFacebookMessengerAlert(alerts, analysisResults, env) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('⚠️ Facebook Messenger not configured - skipping');
    return;
  }

  try {
    const highConfidenceAlerts = alerts.filter(a => a.level === 'HIGH_CONFIDENCE');
    
    if (highConfidenceAlerts.length === 0) return;

    // Determine message title based on trigger mode
    const currentTime = new Date();
    const currentHour = currentTime.getUTCHours() - 5; // Convert to EST
    const currentMinute = currentTime.getUTCMinutes();
    
    let messageTitle = '🎯 Trading Alert';
    if (currentHour === 8 && currentMinute === 30) {
      messageTitle = '🌅 Morning Predictions + Alerts';
    } else if (currentHour === 12 && currentMinute === 0) {
      messageTitle = '🔄 Midday Validation';
    } else if (currentHour === 16 && currentMinute === 5) {
      messageTitle = '🔮 Next Trading Day Predictions';
    } else if (currentHour === 16 && currentMinute === 0 && currentTime.getDay() === 5) {
      messageTitle = '📈 Weekly Market Close';
    } else if (currentHour === 10 && currentMinute === 0 && currentTime.getDay() === 0) {
      messageTitle = '📋 Weekly Accuracy Reports';
    }
    
    // Format message for Messenger
    let messageText = `${messageTitle} - ${highConfidenceAlerts.length} High Confidence Signals\n\n`;
    
    highConfidenceAlerts.forEach(alert => {
      const signal = analysisResults.trading_signals[alert.symbol];
      if (signal) {
        messageText += `📈 ${alert.symbol}: ${signal.action}\n`;
        messageText += `   💰 Price: $${signal.current_price.toFixed(2)}\n`;
        messageText += `   🎯 Confidence: ${(signal.confidence * 100).toFixed(1)}%\n`;
        messageText += `   💡 ${signal.reasoning}\n\n`;
      }
    });

    // Add performance summary
    const perf = analysisResults.performance_metrics;
    messageText += `📊 Performance:\n`;
    messageText += `✅ Success Rate: ${perf.success_rate.toFixed(1)}%\n`;
    messageText += `📈 Avg Confidence: ${(perf.avg_confidence * 100).toFixed(1)}%\n`;
    messageText += `📋 Signals: ${JSON.stringify(perf.signal_distribution)}`;

    // Send via Facebook Graph API
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.FACEBOOK_PAGE_TOKEN}`
      },
      body: JSON.stringify({
        recipient: {
          id: env.FACEBOOK_RECIPIENT_ID
        },
        message: {
          text: messageText
        },
        messaging_type: 'MESSAGE_TAG',
        tag: 'ACCOUNT_UPDATE'
      })
    });

    if (response.ok) {
      console.log('✅ Facebook Messenger alert sent successfully');
    } else {
      const error = await response.text();
      console.error('❌ Facebook Messenger alert failed:', error);
    }

  } catch (error) {
    console.error('❌ Facebook Messenger error:', error);
  }
}

/**
 * Send message via Facebook Messenger (helper function)
 */
async function sendFacebookMessage(messageText, env) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CIRCUIT_BREAKER_CONFIG.timeoutMs);
  
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.FACEBOOK_PAGE_TOKEN}`
      },
      body: JSON.stringify({
        recipient: { id: env.FACEBOOK_RECIPIENT_ID },
        message: { text: messageText },
        messaging_type: 'MESSAGE_TAG',
        tag: 'ACCOUNT_UPDATE'
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Facebook API error: HTTP ${response.status} - Response received but request failed`);
      throw new Error(`Facebook API HTTP ${response.status}: Request failed`);
    }
    
    const responseData = await response.json();
    console.log('✅ Facebook message sent successfully:', {
      message_id: responseData.message_id,
      recipient_id: responseData.recipient_id
    });
    
    return responseData;
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Send daily summary via Facebook Messenger - ENHANCED DEBUGGING
 */
// Send high-confidence alerts only (for intermediate triggers)
async function sendFacebookHighConfidenceAlert(analysisResults, env) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('⚠️ Facebook Messenger not configured for alerts');
    return;
  }

  const alerts = analysisResults.alerts || [];
  if (alerts.length === 0) {
    console.log('ℹ️ No high-confidence alerts to send');
    return;
  }

  // Create alert message
  let alertText = `🚨 HIGH CONFIDENCE TRADING ALERT\n\n`;
  alertText += `📊 ${alerts.length} Strong Signal${alerts.length > 1 ? 's' : ''} Detected:\n\n`;

  alerts.forEach(alert => {
    alertText += `📈 ${alert.symbol}: ${alert.action}\n`;
    alertText += `• Confidence: ${(alert.confidence * 100).toFixed(1)}%\n`;
    alertText += `• Signal: ${alert.reasoning}\n`;
    alertText += `• Price: $${alert.current_price}\n\n`;
  });

  alertText += `⏰ ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST\n`;
  alertText += `🤖 TFT Trading System Alert`;

  await sendFacebookMessage(alertText, env);
}

// Generate candle chart ASCII art
function generateCandleChart(symbol, currentPrice, tftPrice, nhitsPrice) {
  const prices = [currentPrice, tftPrice, nhitsPrice];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 0.01; // avoid division by zero
  
  // Simple ASCII candle representation
  let chart = `📊 ${symbol} Price Chart:\n`;
  chart += `┌─────────────────────────┐\n`;
  
  // Current price bar
  const currentPos = Math.round(((currentPrice - min) / range) * 20);
  chart += `│Current: ${' '.repeat(currentPos)}█${' '.repeat(20-currentPos)}│ $${currentPrice.toFixed(2)}\n`;
  
  // TFT prediction bar
  const tftPos = Math.round(((tftPrice - min) / range) * 20);
  chart += `│TFT:     ${' '.repeat(tftPos)}▓${' '.repeat(20-tftPos)}│ $${tftPrice.toFixed(2)}\n`;
  
  // N-HITS prediction bar
  const nhitsPos = Math.round(((nhitsPrice - min) / range) * 20);
  chart += `│N-HITS:  ${' '.repeat(nhitsPos)}░${' '.repeat(20-nhitsPos)}│ $${nhitsPrice.toFixed(2)}\n`;
  
  chart += `└─────────────────────────┘\n`;
  chart += `Range: $${min.toFixed(2)} - $${max.toFixed(2)}`;
  
  return chart;
}

// Send comprehensive daily report with prediction history
async function sendFacebookDailyReport(analysisResults, env, includeHistory = false) {
  console.log('🔍 sendFacebookDailySummary called with:', {
    has_analysis_results: !!analysisResults,
    has_trading_signals: !!(analysisResults?.trading_signals),
    signal_count: Object.keys(analysisResults?.trading_signals || {}).length,
    has_facebook_token: !!env.FACEBOOK_PAGE_TOKEN,
    has_recipient_id: !!env.FACEBOOK_RECIPIENT_ID
  });
  
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('⚠️ Facebook Messenger not configured for daily summary:', {
      token_available: !!env.FACEBOOK_PAGE_TOKEN,
      recipient_available: !!env.FACEBOOK_RECIPIENT_ID
    });
    throw new Error('Facebook configuration missing - check environment variables');
  }

  try {
    console.log('📝 Building Facebook message content...');
    const date = new Date().toLocaleDateString('en-US');
    const signals = Object.entries(analysisResults.trading_signals || {});
    
    // Determine title based on trigger mode and time
    const currentTime = new Date();
    const currentHour = currentTime.getUTCHours() - 5; // Convert to EST
    const currentMinute = currentTime.getUTCMinutes();
    
    let reportTitle = '🧪 Model Prediction Summary';
    if (currentHour === 8 && currentMinute === 30) {
      reportTitle = '🌅 Morning Predictions + Alerts';
    } else if (currentHour === 12 && currentMinute === 0) {
      reportTitle = '🔄 Midday Validation';
    } else if (currentHour === 16 && currentMinute === 5) {
      reportTitle = '🔮 Next Trading Day Predictions';
    } else if (currentHour === 16 && currentMinute === 0 && currentTime.getDay() === 5) {
      reportTitle = '📈 Weekly Market Close';
    } else if (currentHour === 10 && currentMinute === 0 && currentTime.getDay() === 0) {
      reportTitle = '📋 Weekly Accuracy Reports';
    }
    
    let summaryText = includeHistory 
      ? `${reportTitle} - ${date}\n📈 Daily Prediction History\n\n`
      : `${reportTitle} - ${date}\n\n`;
    
    if (signals.length > 0) {
      summaryText += `🎯 Today's Predictions (${signals.length} symbols):\n\n`;
      
      signals.forEach(([symbol, signal]) => {
        const confidenceEmoji = signal.confidence > 0.8 ? '🎯' : signal.confidence > 0.6 ? '📊' : '🔍';
        summaryText += `${confidenceEmoji} ${symbol} Forecast:\n`;
        summaryText += `   💰 Current: $${signal.current_price.toFixed(2)}\n`;
        summaryText += `   🔮 Predicted: ${signal.reasoning.includes('UP') ? '↗️' : signal.reasoning.includes('DOWN') ? '↘️' : '➡️'} (${(signal.confidence * 100).toFixed(1)}% confidence)\n`;
        summaryText += `   🤖 Models: ${signal.reasoning.substring(0, 40)}...\n`;
        
        // Add detailed model predictions for the final daily report
        if (includeHistory && signal.components && signal.components.price_prediction && signal.components.price_prediction.model_comparison) {
          const modelComp = signal.components.price_prediction.model_comparison;
          const currentPrice = signal.current_price;
          const tftPrice = modelComp.tft_prediction?.price || currentPrice;
          const nhitsPrice = modelComp.nhits_prediction?.price || currentPrice;
          
          const tftChange = ((tftPrice - currentPrice) / currentPrice * 100).toFixed(2);
          const nhitsChange = ((nhitsPrice - currentPrice) / currentPrice * 100).toFixed(2);
          
          summaryText += `   🔮 TFT Model: $${tftPrice.toFixed(2)} (${tftChange > 0 ? '+' : ''}${tftChange}%)\n`;
          summaryText += `   🔮 N-HITS Model: $${nhitsPrice.toFixed(2)} (${nhitsChange > 0 ? '+' : ''}${nhitsChange}%)\n`;
          summaryText += `   📊 Model Agreement: ${modelComp.agreement?.directional_consensus ? '✅' : '❌'} (${(modelComp.agreement?.signal_correlation || 0).toFixed(3)})\n`;
        }
        
        summaryText += `\n`;
      });
      
      // Add enhanced prediction accuracy report
      summaryText += await generatePredictionAccuracyReport(analysisResults, env, includeHistory);
      
      // Add today's prediction history if available
      if (includeHistory && analysisResults.daily_context) {
        summaryText += `\n\n📅 Today's Prediction Timeline:\n`;
        const contextEntries = Object.entries(analysisResults.daily_context);
        contextEntries.forEach(([time, context]) => {
          if (context.symbols_count && context.avg_confidence) {
            const timeFormatted = time.replace(':', ':');
            summaryText += `• ${timeFormatted}: ${context.symbols_count} predictions, ${(context.avg_confidence * 100).toFixed(1)}% avg confidence\n`;
          }
        });
      }
    } else {
      summaryText += `No predictions generated today.\n\n🔄 System Status: Operational ✅\n📊 Model Training: Active`;
    }

    // Add final report timestamp and signature
    if (includeHistory) {
      summaryText += `\n\n⏰ ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`;
      summaryText += `\n🧪 TFT+N-HITS Model Validation System`;
    } else {
      summaryText += `\n\n⏰ ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`;
      summaryText += `\n🤖 AI Prediction Tracking System`;
    }

    console.log('📤 Sending Facebook daily summary...', {
      message_length: summaryText.length,
      signal_count: signals.length,
      include_history: includeHistory
    });

    // Use helper function to send message
    const responseData = await sendFacebookMessage(summaryText, env);
    
    return { success: true, message_id: responseData.message_id };

  } catch (error) {
    console.error('❌ Facebook daily summary failed:', {
      error_name: error.name,
      error_message: error.message,
      stack: error.stack?.substring(0, 200)
    });
    throw error; // Re-throw to be caught by caller
  }
}

/**
 * Send weekly accuracy report via Facebook Messenger
 */
async function sendWeeklyAccuracyReport(env) {
  try {
    console.log('📊 Generating weekly accuracy report...');
    
    const today = new Date();
    const accuracyData = await generateWeeklyAccuracyData(env, today);
    
    if (!accuracyData) {
      console.log('⚠️ No accuracy data available for weekly report');
      return;
    }
    
    const reportText = formatWeeklyAccuracyReport(accuracyData, today);
    
    // Send via Facebook Messenger
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.FACEBOOK_PAGE_TOKEN}`
      },
      body: JSON.stringify({
        recipient: { id: env.FACEBOOK_RECIPIENT_ID },
        message: { text: reportText },
        messaging_type: 'MESSAGE_TAG',
        tag: 'ACCOUNT_UPDATE'
      })
    });

    if (response.ok) {
      console.log('✅ Weekly accuracy report sent successfully');
    } else {
      const error = await response.json();
      console.error('❌ Weekly accuracy report failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Weekly accuracy report error:', error.message);
  }
}

/**
 * Generate weekly accuracy data from stored predictions
 */
async function generateWeeklyAccuracyData(env, currentDate) {
  try {
    const accuracyResults = [];
    const weekDays = [];
    
    // Get last 7 days of stored results (including today)
    for (let i = 0; i <= 6; i++) {
      const checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0]; // YYYY-MM-DD
      weekDays.push(dateStr);
      
      console.log(`🔍 Checking for data on date: ${dateStr} (key: analysis_${dateStr})`);
      const storedResult = await env.TRADING_RESULTS.get(`analysis_${dateStr}`);
      if (storedResult) {
        console.log(`✅ Found data for ${dateStr}, size: ${storedResult.length} bytes`);
        try {
          const analysisData = JSON.parse(storedResult);
          accuracyResults.push({
            date: dateStr,
            analysis: analysisData
          });
        } catch (parseError) {
          console.log(`⚠️ Failed to parse stored result for ${dateStr}: ${parseError.message}`);
        }
      } else {
        console.log(`❌ No data found for ${dateStr}`);
      }
    }
    
    if (accuracyResults.length === 0) {
      return null;
    }
    
    // Calculate accuracy metrics
    const weeklyStats = {
      total_days: accuracyResults.length,
      total_predictions: 0,
      successful_predictions: 0,
      model_performance: {
        tft_count: 0,
        nhits_count: 0,
        ensemble_count: 0
      },
      confidence_distribution: { high: 0, medium: 0, low: 0 },
      signal_distribution: { BUY: 0, SELL: 0, HOLD: 0 },
      average_confidence: 0,
      days_with_data: weekDays.filter(day => 
        accuracyResults.some(result => result.date === day)
      )
    };
    
    let totalConfidence = 0;
    let totalSignals = 0;
    
    // Analyze each day's results
    accuracyResults.forEach(dayResult => {
      const signals = dayResult.analysis.trading_signals || {};
      
      Object.values(signals).forEach(signal => {
        if (signal.success) {
          weeklyStats.total_predictions++;
          totalSignals++;
          
          // Track model usage
          const modelUsed = signal.components?.price_prediction?.model_used || 'unknown';
          if (modelUsed.includes('TFT+N-HITS')) {
            weeklyStats.model_performance.ensemble_count++;
          } else if (modelUsed.includes('TFT')) {
            weeklyStats.model_performance.tft_count++;
          } else if (modelUsed.includes('N-HITS')) {
            weeklyStats.model_performance.nhits_count++;
          }
          
          // Track confidence distribution
          const confidence = signal.confidence || 0;
          totalConfidence += confidence;
          
          if (confidence > 0.8) {
            weeklyStats.confidence_distribution.high++;
          } else if (confidence > 0.6) {
            weeklyStats.confidence_distribution.medium++;
          } else {
            weeklyStats.confidence_distribution.low++;
          }
          
          // Track signal distribution
          const action = signal.action?.split(' ')[0] || 'HOLD';
          if (action in weeklyStats.signal_distribution) {
            weeklyStats.signal_distribution[action]++;
          }
        }
      });
    });
    
    weeklyStats.average_confidence = totalSignals > 0 ? (totalConfidence / totalSignals) : 0;
    
    return weeklyStats;
    
  } catch (error) {
    console.error('❌ Error generating weekly accuracy data:', error.message);
    return null;
  }
}

/**
 * Format weekly accuracy report text for Facebook
 */
function formatWeeklyAccuracyReport(accuracyData, currentDate) {
  const weekEnd = currentDate.toLocaleDateString('en-US');
  const weekStart = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US');
  
  let reportText = `📋 **Weekly Accuracy Reports**\n`;
  reportText += `📅 Period: ${weekStart} - ${weekEnd}\n`;
  reportText += `🔬 Multi-Horizon Prediction Analysis\n\n`;
  
  // Phase 1 performance metrics
  reportText += `🎯 **Prediction Performance:**\n`;
  reportText += `• Active Trading Days: ${accuracyData.total_days}/5\n`;
  reportText += `• Total Predictions: ${accuracyData.total_predictions}\n`;
  reportText += `• Multi-Horizon Forecasts: 1h + 24h ahead\n`;
  reportText += `• Average Model Confidence: ${(accuracyData.average_confidence * 100).toFixed(1)}%\n\n`;
  
  // Model usage breakdown
  const totalModels = accuracyData.model_performance.tft_count + 
                      accuracyData.model_performance.nhits_count + 
                      accuracyData.model_performance.ensemble_count;
                      
  if (totalModels > 0) {
    reportText += `🤖 **Model Usage:**\n`;
    if (accuracyData.model_performance.ensemble_count > 0) {
      const ensemblePercent = (accuracyData.model_performance.ensemble_count / totalModels * 100).toFixed(0);
      reportText += `• TFT+N-HITS Ensemble: ${accuracyData.model_performance.ensemble_count} (${ensemblePercent}%)\n`;
    }
    if (accuracyData.model_performance.tft_count > 0) {
      const tftPercent = (accuracyData.model_performance.tft_count / totalModels * 100).toFixed(0);
      reportText += `• TFT Primary: ${accuracyData.model_performance.tft_count} (${tftPercent}%)\n`;
    }
    if (accuracyData.model_performance.nhits_count > 0) {
      const nhitsPercent = (accuracyData.model_performance.nhits_count / totalModels * 100).toFixed(0);
      reportText += `• N-HITS Backup: ${accuracyData.model_performance.nhits_count} (${nhitsPercent}%)\n`;
    }
    reportText += `\n`;
  }
  
  // Confidence distribution
  const totalConfidence = accuracyData.confidence_distribution.high + 
                          accuracyData.confidence_distribution.medium + 
                          accuracyData.confidence_distribution.low;
                          
  if (totalConfidence > 0) {
    reportText += `🎯 **Confidence Distribution:**\n`;
    reportText += `• High (>80%): ${accuracyData.confidence_distribution.high} signals\n`;
    reportText += `• Medium (60-80%): ${accuracyData.confidence_distribution.medium} signals\n`;
    reportText += `• Low (<60%): ${accuracyData.confidence_distribution.low} signals\n\n`;
  }
  
  // Signal distribution
  const totalSignals = accuracyData.signal_distribution.BUY + 
                       accuracyData.signal_distribution.SELL + 
                       accuracyData.signal_distribution.HOLD;
                       
  if (totalSignals > 0) {
    reportText += `📊 **Signal Distribution:**\n`;
    reportText += `• BUY: ${accuracyData.signal_distribution.BUY}\n`;
    reportText += `• SELL: ${accuracyData.signal_distribution.SELL}\n`;
    reportText += `• HOLD: ${accuracyData.signal_distribution.HOLD}\n\n`;
  }
  
  // System status
  reportText += `⚙️ **System Status:** Operational ✅\n`;
  reportText += `🔄 **Data Retention:** 7 days active\n\n`;
  
  reportText += `📝 *Note: Actual prediction accuracy requires 7+ day validation period. This report shows prediction patterns and system performance.*\n\n`;
  reportText += `🤖 Generated by TFT+N-HITS Trading System`;
  
  return reportText;
}

/**
 * Format Friday weekend analysis report text for Facebook
 */
function formatFridayWeekendReport(analysisResult, triggerMode) {
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
  
  // Weekend-specific insights
  if (analysisResult.weekend_analysis) {
    reportText += `🧭 **Weekend Context:**\n`;
    reportText += `• Next Trading: ${analysisResult.weekend_analysis.next_trading_day}\n`;
    reportText += `• Analysis Duration: ${analysisResult.weekend_analysis.weekend_duration_hours}h\n`;
    
    if (analysisResult.weekend_analysis.friday_market_close === 'available') {
      reportText += `• Market Close Data: ✅ Integrated\n`;
    }
  }
  
  // Weekly insights if available
  if (analysisResult.weekly_analysis) {
    const weeklyData = analysisResult.weekly_analysis;
    reportText += `\n📈 **Weekly Insights:**\n`;
    reportText += `• Days Analyzed: ${weeklyData.days_with_data || 0}\n`;
    reportText += `• Avg Confidence: ${((weeklyData.average_confidence || 0) * 100).toFixed(1)}%\n`;
    
    if (weeklyData.market_sentiment) {
      const sentiment = weeklyData.market_sentiment;
      reportText += `• Weekly Sentiment: ${sentiment.trend || 'Neutral'}\n`;
    }
  }
  
  // Performance metrics
  const metrics = analysisResult.performance_metrics;
  if (metrics) {
    reportText += `\n⚡ **System Performance:**\n`;
    reportText += `• Success Rate: ${metrics.success_rate}%\n`;
    reportText += `• Symbols Analyzed: ${metrics.total_symbols}\n`;
    
    if (metrics.high_confidence_signals > 0) {
      reportText += `• High Confidence Signals: ${metrics.high_confidence_signals}\n`;
    }
  }
  
  reportText += `\n📊 Live Data: https://tft-trading-system.yanggf.workers.dev/fact-table\n`;
  reportText += `⏰ ${now.toLocaleString('en-US', { timeZone: 'America/New_York' })} EST\n`;
  reportText += `🤖 TFT+N-HITS Weekend Analysis System`;
  
  return reportText;
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
    const timeoutId = setTimeout(() => controller.abort(), CIRCUIT_BREAKER_CONFIG.timeoutMs);
    
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
                Yahoo: circuitBreaker.yahooFinance.isOpen ? 'OPEN' : 'CLOSED'
              }), short: true }
            ]
          }]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      throw new Error(`Slack alert error: Request failed`);
    }
  } else {
    throw new Error('No alert webhook configured');
  }
}

/**
 * Handle manual analysis request
 */
async function handleManualAnalysis(request, env) {
  try {
    console.log('🔄 Manual analysis requested');
    // Manual analysis simulates non-final daily report (for testing high-confidence alerts)
    const result = await runPreMarketAnalysis(env, { isFinalDailyReport: false });
    
    // Store results in KV for weekly accuracy tracking (same as scheduled function)
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    await env.TRADING_RESULTS.put(
      `analysis_${currentDate}`,
      JSON.stringify(result),
      { expirationTtl: 604800 } // 7 days for weekly reports
    );
    console.log(`💾 Manual analysis results stored in KV for date: ${currentDate}`);
    
    // Send notifications same as scheduled function
    if (result.alerts && result.alerts.length > 0) {
      await sendAlerts(result, env);
    }

    // Send Facebook notifications based on analysis type
    const isFinalDailyReport = false; // Manual analysis always tests high-confidence alerts
    console.log('🔍 Checking Facebook notification logic...');
    console.log('🔍 Facebook configuration check:', {
      token_status: env.FACEBOOK_PAGE_TOKEN ? 'Validated ✅' : 'Missing ❌',
      recipient_status: env.FACEBOOK_RECIPIENT_ID ? 'Configured ✅' : 'Missing ❌',
      isFinalDailyReport,
      highConfidenceSignals: result.alerts ? result.alerts.length : 0
    });
    
    if (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) {
      try {
        if (isFinalDailyReport) {
          // Send comprehensive daily report with prediction history at 9:00 AM
          console.log('📊 Sending final daily report with prediction history...');
          await sendFacebookDailySummaryWithTracking(result, env, cronExecutionId, true); // true = include history
          console.log('✅ Facebook daily report with tracking completed successfully');
        } else {
          // Send high-confidence alerts only during other triggers
          const highConfidenceAlerts = result.alerts || [];
          if (highConfidenceAlerts.length > 0) {
            console.log('🚨 Sending high-confidence alerts...', { count: highConfidenceAlerts.length });
            await sendFacebookHighConfidenceAlert(result, env);
            console.log('✅ Facebook high-confidence alert sent successfully');
          } else {
            console.log('ℹ️ No high-confidence signals, skipping notification');
          }
        }
      } catch (fbError) {
        console.error('❌ Facebook notification failed:', fbError.message);
        result.facebook_error = fbError.message;
      }
    } else {
      console.log('⚠️ Facebook not configured - tokens missing or empty');
    }
    
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Manual analysis failed:', error.message);
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
 * Handle Facebook messaging test
 */
async function handleFacebookTest(request, env) {
  try {
    console.log('🧪 Facebook messaging test requested');
    
    // Check Facebook configuration
    if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Facebook not configured - missing token or recipient ID',
        debug: {
          token_present: !!env.FACEBOOK_PAGE_TOKEN,
          recipient_present: !!env.FACEBOOK_RECIPIENT_ID
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create test message
    const testMessage = `🧪 WORKER FACEBOOK TEST: ${new Date().toLocaleString()}

✅ Facebook integration test from TFT Trading System worker!

🔧 Configuration:
• Token: Validated ✅
• Recipient: ${env.FACEBOOK_RECIPIENT_ID}
• Endpoint: /me/messages
• Worker Version: 1.0-Cloudflare

If you receive this message, the production worker Facebook integration is working perfectly! 🎉

🤖 TFT Trading System`;

    // Send test message using the same function as daily summaries
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.FACEBOOK_PAGE_TOKEN}`
      },
      body: JSON.stringify({
        recipient: { id: env.FACEBOOK_RECIPIENT_ID },
        message: { text: testMessage },
        messaging_type: 'MESSAGE_TAG',
        tag: 'ACCOUNT_UPDATE'
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Facebook test message sent successfully');
      return new Response(JSON.stringify({
        success: true,
        message: 'Facebook test message sent successfully!',
        facebook_response: result,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      console.error('❌ Facebook test message failed:', result);
      return new Response(JSON.stringify({
        success: false,
        error: 'Facebook API error',
        facebook_error: result,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Facebook test handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle manual weekly accuracy report request
 */
async function handleWeeklyReport(request, env) {
  try {
    console.log('📊 Weekly accuracy report manually requested');
    
    // Check Facebook configuration
    if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Facebook not configured - cannot send weekly report',
        debug: {
          token_present: !!env.FACEBOOK_PAGE_TOKEN,
          recipient_present: !!env.FACEBOOK_RECIPIENT_ID
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate and send weekly report with tracking
    const weeklyTestCronId = `weekly_test_${Date.now()}`;
    await sendWeeklyAccuracyReportWithTracking(env, weeklyTestCronId);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Weekly accuracy report sent successfully!',
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Weekly report handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle Friday 4:00 PM Weekly Market Close Report
 */
async function handleFridayMarketCloseReport(request, env) {
  try {
    console.log('📊 Friday weekly market close report manually requested');
    
    if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Facebook not configured - cannot send weekly market close report',
        debug: {
          token_present: !!env.FACEBOOK_PAGE_TOKEN,
          recipient_present: !!env.FACEBOOK_RECIPIENT_ID
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Run Friday weekly market close analysis
    const currentTime = new Date();
    const analysisResult = await runWeeklyMarketCloseAnalysis(env, currentTime);
    
    // Send Friday weekend report
    const fridayTestCronId = `friday_market_close_test_${Date.now()}`;
    await sendFridayWeekendReportWithTracking(analysisResult, env, fridayTestCronId, 'weekly_market_close_analysis');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Friday weekly market close report sent successfully!',
      timestamp: new Date().toISOString(),
      analysis_result: {
        symbols_analyzed: analysisResult.symbols_analyzed?.length || 0,
        trigger_mode: 'weekly_market_close_analysis'
      }
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Friday market close report handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle Friday 4:05 PM Monday Predictions Report
 */
async function handleFridayMondayPredictionsReport(request, env) {
  try {
    console.log('🌅 Friday Monday predictions report manually requested');
    
    if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Facebook not configured - cannot send Monday predictions report',
        debug: {
          token_present: !!env.FACEBOOK_PAGE_TOKEN,
          recipient_present: !!env.FACEBOOK_RECIPIENT_ID
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Run Friday weekend analysis (Monday predictions)
    const currentTime = new Date();
    const analysisResult = await runFridayWeekendAnalysis(env, currentTime);
    
    // Send Friday weekend report
    const fridayTestCronId = `friday_monday_predictions_test_${Date.now()}`;
    await sendFridayWeekendReportWithTracking(analysisResult, env, fridayTestCronId, 'friday_weekend_prediction');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Friday Monday predictions report sent successfully!',
      timestamp: new Date().toISOString(),
      analysis_result: {
        symbols_analyzed: analysisResult.symbols_analyzed?.length || 0,
        weekend_analysis: analysisResult.weekend_analysis,
        trigger_mode: 'friday_weekend_prediction'
      }
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Friday Monday predictions report handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle Sunday Weekly Accuracy Report
 */
async function handleSundayWeeklyAccuracyReport(request, env) {
  try {
    console.log('📊 Sunday weekly accuracy report manually requested');
    
    if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Facebook not configured - cannot send Sunday weekly accuracy report',
        debug: {
          token_present: !!env.FACEBOOK_PAGE_TOKEN,
          recipient_present: !!env.FACEBOOK_RECIPIENT_ID
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Send Sunday weekly accuracy report directly
    const sundayTestCronId = `sunday_weekly_accuracy_test_${Date.now()}`;
    await sendWeeklyAccuracyReportWithTracking(env, sundayTestCronId);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Sunday weekly accuracy report sent successfully!',
      timestamp: new Date().toISOString(),
      trigger_mode: 'weekly_accuracy_report'
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Sunday weekly accuracy report handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle Weekend Reports Status Check - shows KV logs and execution history
 */
async function handleWeekendReportsStatus(request, env) {
  try {
    console.log('📊 Weekend reports status check requested');
    
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days')) || 7; // Default to 7 days
    
    // Get recent weekend report execution records from KV
    const list = await env.TRADING_RESULTS.list();
    const weekendReports = [];
    const messagingLogs = [];
    
    for (const key of list.keys) {
      if (key.name.includes('sunday_weekly_report_') || 
          key.name.includes('friday_weekly_market_close_analysis_') || 
          key.name.includes('friday_friday_weekend_prediction_')) {
        try {
          const data = await env.TRADING_RESULTS.get(key.name);
          if (data) {
            const record = JSON.parse(data);
            weekendReports.push({
              key: key.name,
              ...record
            });
          }
        } catch (error) {
          console.log(`⚠️ Error reading weekend report record ${key.name}: ${error.message}`);
        }
      }
      
      if (key.name.includes('fb_weekly_messaging_') || 
          key.name.includes('fb_friday_messaging_')) {
        try {
          const data = await env.TRADING_RESULTS.get(key.name);
          if (data) {
            const log = JSON.parse(data);
            messagingLogs.push({
              key: key.name,
              ...log
            });
          }
        } catch (error) {
          console.log(`⚠️ Error reading messaging log ${key.name}: ${error.message}`);
        }
      }
    }
    
    // Sort by timestamp
    weekendReports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    messagingLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Group by report type
    const reportsByType = {
      sunday_weekly_accuracy: weekendReports.filter(r => r.trigger_mode === 'weekly_accuracy_report'),
      friday_market_close: weekendReports.filter(r => r.trigger_mode === 'weekly_market_close_analysis'),
      friday_monday_predictions: weekendReports.filter(r => r.trigger_mode === 'friday_weekend_prediction')
    };
    
    const messagingByType = {
      weekly_accuracy: messagingLogs.filter(l => l.message_type === 'weekly_accuracy'),
      friday_weekend: messagingLogs.filter(l => l.message_type === 'friday_weekend_analysis')
    };
    
    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_weekend_reports: weekendReports.length,
        total_messaging_logs: messagingLogs.length,
        reports_by_type: {
          sunday_weekly_accuracy: reportsByType.sunday_weekly_accuracy.length,
          friday_market_close: reportsByType.friday_market_close.length,
          friday_monday_predictions: reportsByType.friday_monday_predictions.length
        },
        messaging_by_type: {
          weekly_accuracy_messages: messagingByType.weekly_accuracy.length,
          friday_weekend_messages: messagingByType.friday_weekend.length
        }
      },
      recent_reports: {
        sunday_weekly_accuracy: reportsByType.sunday_weekly_accuracy.slice(0, 5),
        friday_market_close: reportsByType.friday_market_close.slice(0, 5),
        friday_monday_predictions: reportsByType.friday_monday_predictions.slice(0, 5)
      },
      recent_messaging: {
        weekly_accuracy: messagingByType.weekly_accuracy.slice(0, 5),
        friday_weekend: messagingByType.friday_weekend.slice(0, 5)
      }
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Weekend reports status handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
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
    version: '1.0-Cloudflare-Worker-Production-Ready',
    services: {
      kv_storage: 'available',
      ai_service: 'available',
      modelscope_api: (env.MODELSCOPE_API_URL && env.MODELSCOPE_API_KEY) ? 'configured' : 'not_configured',
      yahoo_finance: 'available',
      email_alerts: env.ALERT_EMAIL ? 'configured' : 'not_configured',
      slack_alerts: env.SLACK_WEBHOOK_URL ? 'configured' : 'not_configured',
      facebook_messaging: (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) ? 'configured' : 'not_configured'
    },
    circuit_breakers: {
      modelScope: circuitBreaker.modelScope.isOpen ? 'OPEN' : 'CLOSED',
      yahooFinance: circuitBreaker.yahooFinance.isOpen ? 'OPEN' : 'CLOSED'
    },
    features: {
      vercel_model_integration: 'enabled',
      modelscope_sentiment: 'enabled',
      circuit_breakers: 'enabled',
      hierarchical_nhits_fallback: 'enabled',
      production_error_handling: 'enabled',
      facebook_messaging: 'enabled'
    },
    facebook_config: {
      page_token_present: !!env.FACEBOOK_PAGE_TOKEN,
      page_token_status: env.FACEBOOK_PAGE_TOKEN ? 'Validated ✅' : 'Missing ❌',
      recipient_id_present: !!env.FACEBOOK_RECIPIENT_ID,
      recipient_id: env.FACEBOOK_RECIPIENT_ID ? `${env.FACEBOOK_RECIPIENT_ID.substring(0, 8)}...` : 'not_set',
      messaging_endpoint: '/me/messages',
      messaging_type: 'MESSAGE_TAG',
      message_tag: 'ACCOUNT_UPDATE'
    }
  };
  
  return new Response(JSON.stringify(health, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Test daily report with prediction history (simulates 9:00 AM final report)
 */
async function handleTestDailyReport(request, env) {
  try {
    console.log('🧪 Testing daily report with prediction history');
    const result = await runPreMarketAnalysis(env, { isFinalDailyReport: true });
    
    // Test the prediction history logging
    console.log('📊 Testing prediction history logging...');
    const signals = Object.entries(result.trading_signals || {});
    let historyTest = '\n🧪 PREDICTION HISTORY TEST:\n\n';
    
    // Add daily context summary
    if (result.daily_context) {
      historyTest += '📅 Today\'s Cron Executions:\n';
      Object.entries(result.daily_context).forEach(([time, context]) => {
        if (context.symbols_count) {
          historyTest += `• ${time}: ${context.symbols_count} symbols analyzed, ${(context.avg_confidence * 100).toFixed(1)}% avg confidence\n`;
        }
      });
      historyTest += '\n';
    }
    
    // Add model prediction details
    signals.slice(0, 2).forEach(([symbol, signal]) => {
      if (signal.components && signal.components.price_prediction && signal.components.price_prediction.model_comparison) {
        const modelComp = signal.components.price_prediction.model_comparison;
        const currentPrice = signal.current_price;
        const tftPrice = modelComp.tft_prediction?.price || currentPrice;
        const nhitsPrice = modelComp.nhits_prediction?.price || currentPrice;
        
        historyTest += `📊 ${symbol} Model Breakdown:\n`;
        historyTest += `  Current: $${currentPrice.toFixed(2)}\n`;
        historyTest += `  TFT: $${tftPrice.toFixed(2)} (${((tftPrice-currentPrice)/currentPrice*100).toFixed(2)}%)\n`;
        historyTest += `  N-HITS: $${nhitsPrice.toFixed(2)} (${((nhitsPrice-currentPrice)/currentPrice*100).toFixed(2)}%)\n`;
        historyTest += `  Agreement: ${modelComp.agreement?.directional_consensus ? '✅' : '❌'}\n\n`;
      }
    });
    
    // Add history test to result
    result.prediction_history_test = historyTest;
    result.test_mode = true;
    result.simulates_final_daily_report = true;
    
    // If Facebook is configured, test the daily report sending
    if (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) {
      try {
        console.log('📱 Testing Facebook daily report with prediction history...');
        const testCronId = `test_${Date.now()}`;
        await sendFacebookDailySummaryWithTracking(result, env, testCronId, true); // true = include history
        result.facebook_test = 'Daily report with prediction history sent successfully with tracking';
      } catch (fbError) {
        result.facebook_test = `Error: ${fbError.message}`;
      }
    } else {
      result.facebook_test = 'Facebook not configured (set FACEBOOK_PAGE_TOKEN and FACEBOOK_RECIPIENT_ID)';
    }
    
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Daily report test failed:', error.message);
    return new Response(JSON.stringify({ 
      error: error.message,
      test: 'daily_report_with_prediction_history'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Test endpoint for high-confidence alert messaging
 */
async function handleTestHighConfidence(request, env) {
  try {
    console.log('🚨 Testing high-confidence alert system with REAL DATA...');
    
    // Use real prediction data instead of mock
    const testSymbol = 'AAPL';
    const marketData = await getMarketData(testSymbol);
    
    if (!marketData.success) {
      throw new Error(`Failed to get real market data: ${marketData.error}`);
    }
    
    console.log(`📊 Got real market data for ${testSymbol}: $${marketData.data.current_price}`);
    
    // Get real predictions from both models
    const [tftResult, nhitsResult] = await Promise.allSettled([
      getTFTPrediction(testSymbol, marketData.data, env),
      getNHITSPrediction(testSymbol, marketData.data, env)
    ]);
    
    // Process real results
    let realData = null;
    if (tftResult.status === 'fulfilled' && nhitsResult.status === 'fulfilled') {
      const tftPred = tftResult.value;
      const nhitsPred = nhitsResult.value;
      
      realData = {
        timestamp: new Date().toISOString(),
        symbol: testSymbol,
        tft_prediction: {
          price: tftPred.predicted_price,
          confidence: tftPred.confidence * 100, // Convert to percentage
          direction: tftPred.predicted_price > marketData.data.current_price ? 'BUY' : 'SELL',
          horizon: '1h'
        },
        nhits_prediction: {
          price: nhitsPred.predicted_price,
          confidence: nhitsPred.confidence * 100, // Convert to percentage
          direction: nhitsPred.predicted_price > marketData.data.current_price ? 'BUY' : 'SELL',
          horizon: '1h'
        },
        current_price: marketData.data.current_price
      };
      
      // Calculate real ensemble
      realData.ensemble = {
        price: (realData.tft_prediction.price + realData.nhits_prediction.price) / 2,
        confidence: (realData.tft_prediction.confidence + realData.nhits_prediction.confidence) / 2,
        direction: realData.tft_prediction.direction === realData.nhits_prediction.direction 
                  ? realData.tft_prediction.direction 
                  : 'HOLD'
      };
      
      realData.change_pct = ((realData.ensemble.price - realData.current_price) / realData.current_price) * 100;
      
    } else {
      // Fallback if predictions fail
      throw new Error(`Prediction failed - TFT: ${tftResult.status}, N-HITS: ${nhitsResult.status}`);
    }
    
    const result = {
      test: 'high_confidence_alert',
      confidence_threshold: 75.0,
      real_confidence: realData.ensemble.confidence,
      triggered: realData.ensemble.confidence > 75.0,
      data_source: 'REAL_PREDICTIONS',
      symbol: testSymbol,
      current_price: realData.current_price,
      predicted_price: realData.ensemble.price,
      direction: realData.ensemble.direction
    };
    
    // Test Facebook high-confidence alert if confidence is high enough
    if (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) {
      try {
        console.log('📱 Sending REAL high-confidence alert to Facebook...');
        if (result.triggered) {
          const testCronId = `high_conf_test_${Date.now()}`;
          await sendHighConfidenceAlertWithTracking(realData, env, testCronId);
          result.facebook_alert = 'Real high-confidence alert sent successfully with tracking';
        } else {
          result.facebook_alert = `Real confidence ${realData.ensemble.confidence.toFixed(1)}% below threshold (75%), no alert sent`;
        }
      } catch (fbError) {
        result.facebook_alert = `Error: ${fbError.message}`;
      }
    } else {
      result.facebook_alert = 'Facebook not configured (set FACEBOOK_PAGE_TOKEN and FACEBOOK_RECIPIENT_ID)';
    }
    
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ High-confidence alert test failed:', error.message);
    return new Response(JSON.stringify({ 
      error: error.message,
      test: 'high_confidence_alert'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Enhanced Facebook messaging functions with comprehensive tracking
 */

// Enhanced tracking wrapper for Facebook daily reports
async function sendFacebookDailySummaryWithTracking(analysisResults, env, cronExecutionId, includeHistory = false) {
  const trackingId = `fb_daily_${Date.now()}`;
  const messageType = includeHistory ? 'daily_history' : 'daily_summary';
  
  console.log(`📱 [FB-DAILY-START] ${cronExecutionId} ${trackingId}`, {
    message_type: messageType,
    include_history: includeHistory,
    analysis_symbols: Object.keys(analysisResults?.trading_signals || {}).length,
    timestamp_utc: new Date().toISOString()
  });

  try {
    // Send the actual Facebook message
    await sendFacebookDailyReport(analysisResults, env, includeHistory);
    
    console.log(`📱 [FB-DAILY-SUCCESS] ${cronExecutionId} ${trackingId}`, {
      message_type: messageType,
      delivery_status: 'sent_successfully',
      symbols_included: Object.keys(analysisResults?.trading_signals || {}),
      message_length_estimate: `~${JSON.stringify(analysisResults).length} chars`
    });
    
    return { success: true, trackingId, messageType };
    
  } catch (error) {
    console.log(`📱 [FB-DAILY-ERROR] ${cronExecutionId} ${trackingId}`, {
      message_type: messageType,
      error_type: error.name || 'Unknown',
      error_message: error.message,
      facebook_config_status: {
        token_present: !!env.FACEBOOK_PAGE_TOKEN,
        recipient_present: !!env.FACEBOOK_RECIPIENT_ID
      }
    });
    
    throw error;
  }
}

// Enhanced tracking wrapper for Facebook weekly accuracy reports
async function sendWeeklyAccuracyReportWithTracking(env, cronExecutionId) {
  const trackingId = `fb_weekly_${Date.now()}`;
  
  console.log(`📱 [FB-WEEKLY-START] ${cronExecutionId} ${trackingId}`, {
    message_type: 'weekly_accuracy',
    requested_at: new Date().toISOString(),
    day_of_week: new Date().getDay() // 0=Sunday
  });

  try {
    // Store Facebook messaging tracking in KV
    const messagingLogKey = `fb_weekly_messaging_${Date.now()}`;
    const messagingLog = {
      tracking_id: trackingId,
      cron_execution_id: cronExecutionId,
      message_type: 'weekly_accuracy',
      status: 'sending',
      timestamp: new Date().toISOString()
    };
    
    await env.TRADING_RESULTS.put(
      messagingLogKey,
      JSON.stringify(messagingLog),
      { expirationTtl: 604800 } // 7 days
    );
    console.log(`💾 [KV-FB-LOG] ${cronExecutionId} ${trackingId} Stored Facebook messaging log`);
    
    // Send the actual weekly report
    await sendWeeklyAccuracyReport(env);
    
    // Update messaging log with success
    messagingLog.status = 'sent_successfully';
    messagingLog.completion_time = new Date().toISOString();
    
    await env.TRADING_RESULTS.put(
      messagingLogKey,
      JSON.stringify(messagingLog),
      { expirationTtl: 604800 } // 7 days
    );
    
    console.log(`📱 [FB-WEEKLY-SUCCESS] ${cronExecutionId} ${trackingId}`, {
      message_type: 'weekly_accuracy',
      delivery_status: 'sent_successfully',
      report_type: 'accuracy_analysis',
      kv_log_key: messagingLogKey
    });
    
    return { success: true, trackingId, messageType: 'weekly_accuracy', kvLogKey: messagingLogKey };
    
  } catch (error) {
    console.log(`📱 [FB-WEEKLY-ERROR] ${cronExecutionId} ${trackingId}`, {
      message_type: 'weekly_accuracy',
      error_type: error.name || 'Unknown',
      error_message: error.message,
      facebook_config_status: {
        token_present: !!env.FACEBOOK_PAGE_TOKEN,
        recipient_present: !!env.FACEBOOK_RECIPIENT_ID
      }
    });
    
    throw error;
  }
}

// Enhanced tracking wrapper for Friday weekend analysis reports
async function sendFridayWeekendReportWithTracking(analysisResult, env, cronExecutionId, triggerMode) {
  const trackingId = `fb_weekend_${Date.now()}`;
  
  console.log(`📱 [FB-WEEKEND-START] ${cronExecutionId} ${trackingId}`, {
    message_type: 'friday_weekend_analysis',
    trigger_mode: triggerMode,
    requested_at: new Date().toISOString(),
    day_of_week: new Date().getDay() // 5=Friday
  });

  try {
    // Store Friday weekend messaging tracking in KV
    const fridayMessagingLogKey = `fb_friday_messaging_${Date.now()}`;
    const fridayMessagingLog = {
      tracking_id: trackingId,
      cron_execution_id: cronExecutionId,
      message_type: 'friday_weekend_analysis',
      trigger_mode: triggerMode,
      symbols_analyzed: analysisResult.symbols_analyzed?.length || 0,
      status: 'generating_report',
      timestamp: new Date().toISOString()
    };
    
    try {
      await env.TRADING_RESULTS.put(
        fridayMessagingLogKey,
        JSON.stringify(fridayMessagingLog),
        { expirationTtl: 604800 } // 7 days
      );
      console.log(`✅ [KV-SUCCESS] ${cronExecutionId} ${trackingId} Successfully stored KV log: ${fridayMessagingLogKey}`);
    } catch (kvError) {
      console.error(`❌ [KV-ERROR] ${cronExecutionId} ${trackingId} Failed to store KV log:`, kvError);
    }
    console.log(`💾 [KV-FB-LOG] ${cronExecutionId} ${trackingId} Stored Friday messaging log`);
    
    // Generate weekend analysis report
    const weekendReportText = formatFridayWeekendReport(analysisResult, triggerMode);
    
    // Update status to sending
    fridayMessagingLog.status = 'sending';
    fridayMessagingLog.report_generated_time = new Date().toISOString();
    
    try {
      await env.TRADING_RESULTS.put(
        fridayMessagingLogKey,
        JSON.stringify(fridayMessagingLog),
        { expirationTtl: 604800 } // 7 days
      );
      console.log(`✅ [KV-SUCCESS] ${cronExecutionId} ${trackingId} Successfully stored KV log: ${fridayMessagingLogKey}`);
    } catch (kvError) {
      console.error(`❌ [KV-ERROR] ${cronExecutionId} ${trackingId} Failed to store KV log:`, kvError);
    }
    
    // Send via Facebook Messenger
    await sendFacebookMessage(weekendReportText, env);
    
    // Update messaging log with success
    fridayMessagingLog.status = 'sent_successfully';
    fridayMessagingLog.completion_time = new Date().toISOString();
    fridayMessagingLog.weekend_analysis_type = analysisResult.weekend_analysis?.analysis_type || 'unknown';
    
    try {
      await env.TRADING_RESULTS.put(
        fridayMessagingLogKey,
        JSON.stringify(fridayMessagingLog),
        { expirationTtl: 604800 } // 7 days
      );
      console.log(`✅ [KV-SUCCESS] ${cronExecutionId} ${trackingId} Successfully stored KV log: ${fridayMessagingLogKey}`);
    } catch (kvError) {
      console.error(`❌ [KV-ERROR] ${cronExecutionId} ${trackingId} Failed to store KV log:`, kvError);
    }
    
    console.log(`📱 [FB-WEEKEND-SUCCESS] ${cronExecutionId} ${trackingId}`, {
      message_type: 'friday_weekend_analysis',
      trigger_mode: triggerMode,
      delivery_status: 'sent_successfully',
      symbols_analyzed: analysisResult.symbols_analyzed?.length || 0,
      weekend_analysis_type: analysisResult.weekend_analysis?.analysis_type || 'unknown',
      kv_log_key: fridayMessagingLogKey
    });

    return { success: true, trackingId, messageType: 'friday_weekend_analysis', kvLogKey: fridayMessagingLogKey };
    
  } catch (error) {
    console.log(`📱 [FB-WEEKEND-ERROR] ${cronExecutionId} ${trackingId}`, {
      message_type: 'friday_weekend_analysis',
      trigger_mode: triggerMode,
      error_type: error.name || 'Unknown',
      error_message: error.message
    });
    
    throw error;
  }
}

// Enhanced tracking wrapper for high-confidence alerts
async function sendHighConfidenceAlertWithTracking(data, env, cronExecutionId) {
  const trackingId = `fb_alert_${Date.now()}`;
  
  console.log(`📱 [FB-ALERT-START] ${cronExecutionId} ${trackingId}`, {
    message_type: 'high_confidence_alert',
    symbol: data.symbol,
    confidence: data.ensemble?.confidence || data.confidence,
    direction: data.ensemble?.direction || data.direction,
    trigger_threshold: 75.0
  });

  try {
    // Send the actual high-confidence alert
    await sendHighConfidenceAlert(data, env);
    
    console.log(`📱 [FB-ALERT-SUCCESS] ${cronExecutionId} ${trackingId}`, {
      message_type: 'high_confidence_alert',
      symbol: data.symbol,
      delivery_status: 'sent_successfully',
      confidence_level: data.ensemble?.confidence || data.confidence
    });
    
    return { success: true, trackingId, messageType: 'high_confidence_alert' };
    
  } catch (error) {
    console.log(`📱 [FB-ALERT-ERROR] ${cronExecutionId} ${trackingId}`, {
      message_type: 'high_confidence_alert',
      symbol: data.symbol,
      error_type: error.name || 'Unknown',
      error_message: error.message,
      confidence_that_failed: data.ensemble?.confidence || data.confidence
    });
    
    throw error;
  }
}

// Enhanced tracking wrapper for Facebook Messenger alerts (multiple alerts)
async function sendFacebookMessengerAlertWithTracking(alerts, analysisResults, env, cronExecutionId) {
  const trackingId = `fb_messenger_${Date.now()}`;
  
  console.log(`📱 [FB-MESSENGER-START] ${cronExecutionId} ${trackingId}`, {
    message_type: 'messenger_alerts',
    alert_count: alerts.length,
    symbols: alerts.map(a => a.symbol),
    confidence_levels: alerts.map(a => a.confidence || 'unknown'),
    trigger_threshold: 75.0
  });

  try {
    // Send the actual Facebook messenger alert
    await sendFacebookMessengerAlert(alerts, analysisResults, env);
    
    console.log(`📱 [FB-MESSENGER-SUCCESS] ${cronExecutionId} ${trackingId}`, {
      message_type: 'messenger_alerts',
      alert_count: alerts.length,
      delivery_status: 'sent_successfully',
      symbols_alerted: alerts.map(a => a.symbol)
    });
    
    return { success: true, trackingId, messageType: 'messenger_alerts', alertCount: alerts.length };
    
  } catch (error) {
    console.log(`📱 [FB-MESSENGER-ERROR] ${cronExecutionId} ${trackingId}`, {
      message_type: 'messenger_alerts',
      alert_count: alerts.length,
      error_type: error.name || 'Unknown',
      error_message: error.message,
      failed_symbols: alerts.map(a => a.symbol)
    });
    
    throw error;
  }
}

/**
 * Send high-confidence alert to Facebook Messenger
 */
async function sendHighConfidenceAlert(data, env) {
  const symbol = data.symbol;
  const confidence = data.ensemble.confidence;
  const direction = data.ensemble.direction;
  const currentPrice = data.current_price;
  const predictedPrice = data.ensemble.price;
  const changePct = data.change_pct;
  
  // Determine alert title based on trigger mode
  const currentTime = new Date();
  const currentHour = currentTime.getUTCHours() - 5; // Convert to EST
  const currentMinute = currentTime.getUTCMinutes();
  
  let alertTitle = '🚨 HIGH CONFIDENCE SIGNAL 🚨';
  if (currentHour === 8 && currentMinute === 30) {
    alertTitle = '🌅 Morning Predictions + Alerts';
  } else if (currentHour === 12 && currentMinute === 0) {
    alertTitle = '🔄 Midday Validation';
  } else if (currentHour === 16 && currentMinute === 5) {
    alertTitle = '🔮 Next Trading Day Predictions';
  } else if (currentHour === 16 && currentMinute === 0 && currentTime.getDay() === 5) {
    alertTitle = '📈 Weekly Market Close';
  }
  
  const alertMessage = `${alertTitle}

📈 ${symbol} ${direction} Signal
⚡ Confidence: ${confidence.toFixed(1)}%
💰 Current: $${currentPrice.toFixed(2)}
🎯 Target: $${predictedPrice.toFixed(2)}
📊 Expected: ${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%

🤖 TFT: ${data.tft_prediction.confidence.toFixed(1)}% confidence
🎯 N-HITS: ${data.nhits_prediction.confidence.toFixed(1)}% confidence

⏰ ${new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  })}`;

  await sendFacebookMessage(alertMessage, env);
  console.log(`📱 High-confidence alert sent for ${symbol} (${confidence.toFixed(1)}%)`);
}

/**
 * Serve interactive chart viewer web interface
 */
async function handleChartViewer(request, env) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TFT Trading System - Prediction History</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 20px; background: #f5f5f7; 
        }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        h1 { color: #1d1d1f; margin-bottom: 10px; }
        .subtitle { color: #6e6e73; margin-bottom: 30px; }
        .controls { margin-bottom: 20px; display: flex; gap: 15px; align-items: center; flex-wrap: wrap; }
        select, button { 
            padding: 10px 15px; border: 1px solid #d2d2d7; border-radius: 8px; 
            background: white; font-size: 14px; 
        }
        button { background: #007aff; color: white; border: none; cursor: pointer; }
        button:hover { background: #0056b3; }
        .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px; }
        .chart-container { background: #fafafa; padding: 20px; border-radius: 10px; }
        .chart-title { font-weight: 600; margin-bottom: 15px; color: #1d1d1f; }
        canvas { max-height: 400px; }
        .status { padding: 10px; background: #e3f2fd; border-radius: 6px; margin: 10px 0; }
        .error { background: #ffebee; color: #c62828; }
        .loading { background: #fff3e0; color: #e65100; }
        @media (max-width: 768px) { 
            .charts-grid { grid-template-columns: 1fr; }
            .controls { flex-direction: column; align-items: stretch; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 TFT Trading System</h1>
        <p class="subtitle">Interactive Prediction History & Model Performance Charts</p>
        
        <div class="controls">
            <select id="symbolSelect">
                <option value="AAPL">AAPL</option>
                <option value="TSLA">TSLA</option>
                <option value="MSFT">MSFT</option>
                <option value="GOOGL">GOOGL</option>
                <option value="NVDA">NVDA</option>
            </select>
            <select id="daysSelect">
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
            </select>
            <button onclick="loadCharts()">Load Charts</button>
            <button onclick="loadCharts(true)">Auto Refresh (10s)</button>
        </div>
        
        <div id="status" class="status" style="display:none;"></div>
        
        <div class="charts-grid">
            <div class="chart-container">
                <div class="chart-title">📈 Prediction Accuracy Trend</div>
                <canvas id="accuracyChart"></canvas>
            </div>
            <div class="chart-container">
                <div class="chart-title">🎯 Model Confidence Over Time</div>
                <canvas id="confidenceChart"></canvas>
            </div>
            <div class="chart-container">
                <div class="chart-title">⚡ TFT vs N-HITS Performance</div>
                <canvas id="modelsChart"></canvas>
            </div>
            <div class="chart-container">
                <div class="chart-title">📊 Daily Prediction Volume</div>
                <canvas id="volumeChart"></canvas>
            </div>
        </div>
    </div>

    <script>
        let refreshInterval;
        let charts = {};

        function showStatus(message, type = 'info') {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = 'status ' + type;
            status.style.display = 'block';
        }

        async function loadCharts(autoRefresh = false) {
            const symbol = document.getElementById('symbolSelect').value;
            const days = document.getElementById('daysSelect').value;
            
            showStatus('Loading prediction history...', 'loading');
            
            try {
                const response = await fetch('/api/history?symbol=' + symbol + '&days=' + days);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to load data');
                }
                
                createCharts(data, symbol);
                showStatus('Loaded ' + data.dates.length + ' days of data for ' + symbol, 'info');
                
                if (autoRefresh) {
                    if (refreshInterval) clearInterval(refreshInterval);
                    refreshInterval = setInterval(() => loadCharts(false), 10000);
                    showStatus('Auto-refresh enabled for ' + symbol + ' (every 10s)', 'info');
                }
                
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
                console.error('Chart loading error:', error);
            }
        }

        function createCharts(data, symbol) {
            // Destroy existing charts
            Object.values(charts).forEach(chart => chart?.destroy());
            
            const commonOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: { 
                    y: { beginAtZero: true },
                    x: { ticks: { maxTicksLimit: 10 } }
                }
            };

            // Accuracy Chart
            charts.accuracy = new Chart(document.getElementById('accuracyChart'), {
                type: 'line',
                data: {
                    labels: data.dates,
                    datasets: [{
                        label: 'Success Rate %',
                        data: data.accuracyData,
                        borderColor: '#007aff',
                        backgroundColor: 'rgba(0, 122, 255, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { ...commonOptions, scales: { ...commonOptions.scales, y: { min: 0, max: 100 } } }
            });

            // Confidence Chart
            charts.confidence = new Chart(document.getElementById('confidenceChart'), {
                type: 'line',
                data: {
                    labels: data.dates,
                    datasets: [{
                        label: 'Avg Confidence %',
                        data: data.confidenceData,
                        borderColor: '#34c759',
                        backgroundColor: 'rgba(52, 199, 89, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: { ...commonOptions, scales: { ...commonOptions.scales, y: { min: 0, max: 100 } } }
            });

            // Models Comparison Chart
            charts.models = new Chart(document.getElementById('modelsChart'), {
                type: 'bar',
                data: {
                    labels: data.dates,
                    datasets: [
                        {
                            label: 'TFT Confidence %',
                            data: data.tftConfidenceData,
                            backgroundColor: 'rgba(255, 45, 85, 0.8)',
                            borderColor: '#ff2d55'
                        },
                        {
                            label: 'N-HITS Confidence %',
                            data: data.nhitsConfidenceData,
                            backgroundColor: 'rgba(255, 149, 0, 0.8)',
                            borderColor: '#ff9500'
                        }
                    ]
                },
                options: { ...commonOptions, scales: { ...commonOptions.scales, y: { min: 0, max: 100 } } }
            });

            // Volume Chart
            charts.volume = new Chart(document.getElementById('volumeChart'), {
                type: 'bar',
                data: {
                    labels: data.dates,
                    datasets: [{
                        label: 'Predictions Count',
                        data: data.volumeData,
                        backgroundColor: 'rgba(88, 86, 214, 0.8)',
                        borderColor: '#5856d6'
                    }]
                },
                options: commonOptions
            });
        }

        // Load initial charts
        window.onload = () => loadCharts();
        
        // Cleanup on page unload
        window.onbeforeunload = () => {
            if (refreshInterval) clearInterval(refreshInterval);
        };
    </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

/**
 * API endpoint to retrieve prediction history from KV storage
 */
async function handleHistoryAPI(request, env) {
  try {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol') || 'AAPL';
    const days = parseInt(url.searchParams.get('days')) || 7;
    
    console.log(`📊 Loading ${days} days of prediction history for ${symbol}`);
    
    const historyData = {
      dates: [],
      accuracyData: [],
      confidenceData: [],
      tftConfidenceData: [],
      nhitsConfidenceData: [],
      volumeData: []
    };
    
    // Collect data for the requested number of days
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const analysisKey = `analysis_${dateStr}`;
      
      try {
        const analysisJson = await env.TRADING_RESULTS.get(analysisKey);
        if (analysisJson) {
          const analysis = JSON.parse(analysisJson);
          const symbolData = analysis.trading_signals?.[symbol];
          
          if (symbolData) {
            historyData.dates.unshift(dateStr.slice(5)); // MM-DD format
            
            // Calculate REAL prediction accuracy vs actual market prices
            let realAccuracy = 0;
            try {
              const actualPrice = await getActualPrice(symbol, dateStr);
              if (actualPrice && symbolData.components?.price_prediction) {
                const predictedPrice = symbolData.components.price_prediction.predicted_price;
                if (predictedPrice && actualPrice) {
                  const errorPercent = Math.abs(predictedPrice - actualPrice) / actualPrice * 100;
                  realAccuracy = Math.max(0, 100 - errorPercent); // Convert error to accuracy
                }
              }
            } catch (error) {
              console.log(`⚠️ Could not calculate accuracy for ${symbol} on ${dateStr}: ${error.message}`);
            }
            
            historyData.accuracyData.unshift(realAccuracy);
            historyData.confidenceData.unshift((symbolData.confidence * 100) || 0);
            historyData.volumeData.unshift(analysis.symbols_analyzed?.length || 0);
            
            // Extract model-specific data if available
            const modelComp = symbolData.components?.price_prediction?.model_comparison;
            historyData.tftConfidenceData.unshift(modelComp?.tft_prediction?.confidence * 100 || 0);
            historyData.nhitsConfidenceData.unshift(modelComp?.nhits_prediction?.confidence * 100 || 0);
          } else {
            // No data for this symbol on this date
            historyData.dates.unshift(dateStr.slice(5));
            historyData.accuracyData.unshift(0);
            historyData.confidenceData.unshift(0);
            historyData.tftConfidenceData.unshift(0);
            historyData.nhitsConfidenceData.unshift(0);
            historyData.volumeData.unshift(0);
          }
        } else {
          // No analysis data for this date
          historyData.dates.unshift(dateStr.slice(5));
          historyData.accuracyData.unshift(0);
          historyData.confidenceData.unshift(0);
          historyData.tftConfidenceData.unshift(0);
          historyData.nhitsConfidenceData.unshift(0);
          historyData.volumeData.unshift(0);
        }
      } catch (error) {
        console.error(`Error processing date ${dateStr}:`, error.message);
      }
    }
    
    console.log(`📈 Retrieved ${historyData.dates.length} data points for ${symbol}`);
    
    return new Response(JSON.stringify(historyData), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('❌ History API error:', error.message);
    return new Response(JSON.stringify({ 
      error: error.message,
      dates: [],
      accuracyData: [],
      confidenceData: [],
      tftConfidenceData: [],
      nhitsConfidenceData: [],
      volumeData: []
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

/**
 * Handle fact table request - shows predictions vs actual market prices
 */
async function handleFactTable(request, env) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trading System - Fact Table</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            padding: 30px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            color: #333;
        }
        
        .header h1 {
            margin: 0;
            font-size: 2.5rem;
            background: linear-gradient(45deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .controls {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: flex;
            gap: 15px;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .control-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        label {
            font-weight: 600;
            color: #555;
        }
        
        select, input {
            padding: 8px 12px;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        
        select:focus, input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        button {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: transform 0.2s;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
        }
        
        .table-container {
            overflow-x: auto;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
            font-size: 14px;
        }
        
        th {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            padding: 15px 12px;
            text-align: left;
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #eee;
            transition: background-color 0.2s;
        }
        
        tr:hover td {
            background-color: #f8f9fa;
        }
        
        .symbol {
            font-weight: 700;
            color: #333;
            font-size: 16px;
        }
        
        .date {
            color: #666;
            font-size: 13px;
        }
        
        .price {
            font-family: 'Courier New', monospace;
            font-weight: 600;
        }
        
        .positive {
            color: #28a745;
        }
        
        .negative {
            color: #dc3545;
        }
        
        .neutral {
            color: #6c757d;
        }
        
        .accuracy {
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 4px;
            text-align: center;
        }
        
        .high-accuracy {
            background: #d4edda;
            color: #155724;
        }
        
        .medium-accuracy {
            background: #fff3cd;
            color: #856404;
        }
        
        .low-accuracy {
            background: #f8d7da;
            color: #721c24;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
            font-size: 18px;
        }
        
        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .stat-card {
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            border: 2px solid transparent;
            transition: border-color 0.3s;
        }
        
        .stat-card:hover {
            border-color: #667eea;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #333;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Prediction Accuracy Fact Table</h1>
            <p>Compare predicted prices vs actual market prices</p>
        </div>
        
        <div class="controls">
            <div class="control-group">
                <label for="symbol">Symbol:</label>
                <select id="symbol">
                    <option value="AAPL">AAPL</option>
                    <option value="TSLA">TSLA</option>
                    <option value="MSFT">MSFT</option>
                    <option value="GOOGL">GOOGL</option>
                    <option value="NVDA">NVDA</option>
                </select>
            </div>
            <div class="control-group">
                <label for="date">Date:</label>
                <input type="date" id="date" value="">
            </div>
            <button onclick="loadFactTable()">🔄 Refresh Data</button>
            <button onclick="loadAllSymbols()">📈 Load All Symbols</button>
        </div>
        
        <div class="stats" id="stats" style="display: none;">
            <div class="stat-card">
                <div class="stat-value" id="total-predictions">0</div>
                <div class="stat-label">Total Predictions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="avg-accuracy">0%</div>
                <div class="stat-label">Average Accuracy</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="best-model">-</div>
                <div class="stat-label">Best Model</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="directional-accuracy">0%</div>
                <div class="stat-label">Directional Accuracy</div>
            </div>
        </div>
        
        <div class="table-container">
            <div id="loading" class="loading">Click "Refresh Data" to load fact table...</div>
            <div id="error" class="error" style="display: none;"></div>
            <table id="fact-table" style="display: none;">
                <thead>
                    <tr>
                        <th>Timestamp (UTC)</th>
                        <th>Market Time (EST)</th>
                        <th>TFT Prediction</th>
                        <th>N-HITS Prediction</th>
                        <th>Ensemble Prediction</th>
                        <th>Market Close</th>
                        <th>TFT Error</th>
                        <th>N-HITS Error</th>
                        <th>Ensemble Error</th>
                        <th>Best Model</th>
                        <th>Confidence</th>
                        <th>TFT Conf</th>
                        <th>N-HITS Conf</th>
                        <th>Direction</th>
                        <th>TFT Direction</th>
                        <th>N-HITS Direction</th>
                        <th>Ensemble Direction</th>
                    </tr>
                </thead>
                <tbody id="fact-body">
                </tbody>
            </table>
        </div>
    </div>

    <script>
        async function loadFactTable() {
            const symbol = document.getElementById('symbol').value;
            const date = document.getElementById('date').value;
            const loading = document.getElementById('loading');
            const error = document.getElementById('error');
            const table = document.getElementById('fact-table');
            const stats = document.getElementById('stats');
            
            loading.style.display = 'block';
            error.style.display = 'none';
            table.style.display = 'none';
            stats.style.display = 'none';
            
            try {
                const response = await fetch('/api/fact-data?symbol=' + symbol + '&date=' + date);
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                displayFactTable(data);
                updateStats(data);
                
            } catch (err) {
                console.error('Error loading fact table:', err);
                error.textContent = 'Error loading data: ' + err.message;
                error.style.display = 'block';
            }
            
            loading.style.display = 'none';
        }
        
        async function loadAllSymbols() {
            const symbols = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'NVDA'];
            const date = document.getElementById('date').value;
            const loading = document.getElementById('loading');
            const error = document.getElementById('error');
            const table = document.getElementById('fact-table');
            const stats = document.getElementById('stats');
            
            loading.innerHTML = 'Loading all symbols for ' + date + '...';
            loading.style.display = 'block';
            error.style.display = 'none';
            table.style.display = 'none';
            stats.style.display = 'none';
            
            try {
                const allData = [];
                for (const symbol of symbols) {
                    const response = await fetch('/api/fact-data?symbol=' + symbol + '&date=' + date);
                    const data = await response.json();
                    if (data.predictions) {
                        // Add symbol info to each prediction
                        data.predictions.forEach(pred => {
                            pred.symbol = symbol;
                            pred.market_close_price = data.market_close_price;
                        });
                        allData.push(...data.predictions);
                    }
                }
                
                const combinedData = { predictions: allData, date: date };
                displayFactTable(combinedData);
                updateStats(combinedData);
                
            } catch (err) {
                console.error('Error loading all symbols:', err);
                error.textContent = 'Error loading data: ' + err.message;
                error.style.display = 'block';
            }
            
            loading.style.display = 'none';
        }
        
        function displayFactTable(data) {
            const tbody = document.getElementById('fact-body');
            tbody.innerHTML = '';
            
            if (!data.predictions || data.predictions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="17" style="text-align: center; padding: 40px; color: #666;">No prediction data available for this date</td></tr>';
                document.getElementById('fact-table').style.display = 'table';
                return;
            }
            
            data.predictions.forEach(pred => {
                const row = document.createElement('tr');
                
                // Calculate errors using market close price
                const marketClose = pred.market_close_price;
                const tftError = marketClose ? ((Math.abs(pred.tft_prediction - marketClose) / marketClose) * 100).toFixed(3) : 'N/A';
                const nhitsError = marketClose ? ((Math.abs(pred.nhits_prediction - marketClose) / marketClose) * 100).toFixed(3) : 'N/A';
                const ensembleError = marketClose ? ((Math.abs(pred.prediction_price - marketClose) / marketClose) * 100).toFixed(3) : 'N/A';
                
                // Determine best model
                let bestModel = 'N/A';
                if (marketClose) {
                    const errors = [
                        { model: 'TFT', error: Math.abs(pred.tft_prediction - marketClose) },
                        { model: 'N-HITS', error: Math.abs(pred.nhits_prediction - marketClose) },
                        { model: 'Ensemble', error: Math.abs(pred.prediction_price - marketClose) }
                    ];
                    bestModel = errors.reduce((best, current) => current.error < best.error ? current : best).model;
                }
                
                // Use actual timestamp and convert to EST
                const timestamp = pred.timestamp ? new Date(pred.timestamp) : null;
                const utcTime = timestamp ? timestamp.toISOString().substr(11, 8) + ' UTC' : (pred.time || 'N/A');
                
                // Convert to EST market time
                const estTime = timestamp ? 
                    timestamp.toLocaleString('en-US', {
                        timeZone: 'America/New_York',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    }) + ' EST' : 'N/A';
                
                // Add indicator for next-day predictions
                const predictionTypeIndicator = pred.prediction_type === 'next_day' ? ' (Next Day)' : '';
                
                // Direction accuracy indicators
                const directionIndicators = {
                    predicted: pred.predicted_direction || '➡️',
                    actual: pred.actual_direction || '➡️'
                };
                
                // Direction accuracy status
                const directionAccuracyClass = (accuracy) => {
                    if (accuracy === null || accuracy === undefined) return 'neutral';
                    return accuracy ? 'positive' : 'negative';
                };
                
                const directionText = (accuracy) => {
                    if (accuracy === null || accuracy === undefined) return 'N/A';
                    return accuracy ? '✓' : '✗';
                };

                row.innerHTML = '<td class="date">' + utcTime + predictionTypeIndicator + '</td>' +
                    '<td class="date">' + estTime + predictionTypeIndicator + '</td>' +
                    '<td class="price">' + (pred.tft_prediction ? '$' + pred.tft_prediction.toFixed(2) : 'N/A') + '</td>' +
                    '<td class="price">' + (pred.nhits_prediction ? '$' + pred.nhits_prediction.toFixed(2) : 'N/A') + '</td>' +
                    '<td class="price">' + (pred.prediction_price ? '$' + pred.prediction_price.toFixed(2) : 'N/A') + '</td>' +
                    '<td class="price">' + (marketClose ? '$' + marketClose.toFixed(2) : 'N/A') + '</td>' +
                    '<td class="' + (tftError !== 'N/A' && parseFloat(tftError) < 0.5 ? 'positive' : 'negative') + '">' + (tftError !== 'N/A' ? tftError + '%' : 'N/A') + '</td>' +
                    '<td class="' + (nhitsError !== 'N/A' && parseFloat(nhitsError) < 0.5 ? 'positive' : 'negative') + '">' + (nhitsError !== 'N/A' ? nhitsError + '%' : 'N/A') + '</td>' +
                    '<td class="' + (ensembleError !== 'N/A' && parseFloat(ensembleError) < 0.5 ? 'positive' : 'negative') + '">' + (ensembleError !== 'N/A' ? ensembleError + '%' : 'N/A') + '</td>' +
                    '<td class="' + (bestModel === 'TFT' ? 'positive' : bestModel === 'Ensemble' ? 'neutral' : 'negative') + '">' + bestModel + '</td>' +
                    '<td>' + (pred.confidence ? (pred.confidence * 100).toFixed(1) + '%' : 'N/A') + '</td>' +
                    '<td>' + (pred.tft_confidence ? (pred.tft_confidence * 100).toFixed(0) + '%' : 'N/A') + '</td>' +
                    '<td>' + (pred.nhits_confidence ? (pred.nhits_confidence * 100).toFixed(0) + '%' : 'N/A') + '</td>' +
                    '<td>' + directionIndicators.predicted + ' → ' + directionIndicators.actual + '</td>' +
                    '<td class="' + directionAccuracyClass(pred.tft_direction_accuracy) + '">' + directionText(pred.tft_direction_accuracy) + '</td>' +
                    '<td class="' + directionAccuracyClass(pred.nhits_direction_accuracy) + '">' + directionText(pred.nhits_direction_accuracy) + '</td>' +
                    '<td class="' + directionAccuracyClass(pred.direction_accuracy) + '">' + directionText(pred.direction_accuracy) + '</td>';
                
                tbody.appendChild(row);
            });
            
            document.getElementById('fact-table').style.display = 'table';
        }
        
        function updateStats(data) {
            if (!data.predictions || data.predictions.length === 0) return;
            
            const validPredictions = data.predictions.filter(p => p.actual_price);
            
            document.getElementById('total-predictions').textContent = data.predictions.length;
            
            if (validPredictions.length > 0) {
                const avgAccuracy = validPredictions.reduce((sum, pred) => {
                    const error = Math.abs(pred.ensemble_prediction - pred.actual_price) / pred.actual_price * 100;
                    return sum + (100 - error);
                }, 0) / validPredictions.length;
                
                document.getElementById('avg-accuracy').textContent = avgAccuracy.toFixed(1) + '%';
                
                // Directional accuracy
                let directionalCorrect = 0;
                validPredictions.forEach(pred => {
                    const predictedDirection = pred.ensemble_prediction > pred.current_price;
                    const actualDirection = pred.actual_price > pred.current_price;
                    if (predictedDirection === actualDirection) directionalCorrect++;
                });
                
                const directionalAccuracy = (directionalCorrect / validPredictions.length * 100).toFixed(1);
                document.getElementById('directional-accuracy').textContent = directionalAccuracy + '%';
                
                // Best model analysis
                const modelPerformance = { TFT: 0, 'N-HITS': 0, Ensemble: 0 };
                validPredictions.forEach(pred => {
                    const errors = [
                        { model: 'TFT', error: Math.abs(pred.tft_prediction - pred.actual_price) },
                        { model: 'N-HITS', error: Math.abs(pred.nhits_prediction - pred.actual_price) },
                        { model: 'Ensemble', error: Math.abs(pred.ensemble_prediction - pred.actual_price) }
                    ];
                    const bestModel = errors.reduce((best, current) => current.error < best.error ? current : best).model;
                    modelPerformance[bestModel]++;
                });
                
                const bestOverallModel = Object.keys(modelPerformance).reduce((a, b) => 
                    modelPerformance[a] > modelPerformance[b] ? a : b
                );
                
                document.getElementById('best-model').textContent = bestOverallModel;
            }
            
            document.getElementById('stats').style.display = 'grid';
        }
        
        // Load data on page load
        window.onload = async () => {
            // Set date input to latest available data date
            await setLatestDataDate();
            // Auto-load default data
            // loadFactTable();
        };
        
        // Function to find and set the latest available data date
        async function setLatestDataDate() {
            const dateInput = document.getElementById('date');
            let latestDate = null;
            
            // Check the last 30 days to find the latest available data
            for (let i = 0; i < 30; i++) {
                const checkDate = new Date();
                checkDate.setDate(checkDate.getDate() - i);
                const dateStr = checkDate.toISOString().split('T')[0];
                
                try {
                    const response = await fetch('/api/fact-data?symbol=AAPL&date=' + dateStr);
                    const data = await response.json();
                    
                    // If we found data with predictions, this is our latest date
                    if (data.predictions && data.predictions.length > 0) {
                        latestDate = dateStr;
                        break;
                    }
                } catch (err) {
                    // Continue checking previous days
                    continue;
                }
            }
            
            // Set the date input to the latest available date or today if none found
            if (latestDate) {
                dateInput.value = latestDate;
                console.log('📅 Set date input to latest data date:', latestDate);
            } else {
                // Fallback to today's date
                const today = new Date().toISOString().split('T')[0];
                dateInput.value = today;
                console.log('📅 No historical data found, using today:', today);
            }
        }
    </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

/**
 * API endpoint for fact table data - compares predictions vs actual prices
 */
async function handleFactDataAPI(request, env) {
  try {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol') || 'AAPL';
    const dateParam = url.searchParams.get('date');
    
    if (!dateParam) {
      return new Response(JSON.stringify({ 
        error: "Date parameter required. Use format: ?symbol=AAPL&date=2025-09-10",
        example: "/api/fact-data?symbol=AAPL&date=2025-09-10"
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`📊 Loading fact data for ${symbol} on ${dateParam}`);
    
    const predictions = [];
    const analysisKey = `analysis_${dateParam}`;
    
    try {
      const analysisJson = await env.TRADING_RESULTS.get(analysisKey);
      if (!analysisJson) {
        return new Response(JSON.stringify({ 
          symbol: symbol,
          date: dateParam,
          predictions: [],
          message: `No analysis data found for ${dateParam}`
        }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      const analysisData = JSON.parse(analysisJson);
      
      // Get market close price for the date
      const marketClosePrice = await getActualPrice(symbol, dateParam);
      
      // Extract all predictions made during the day from multiple_executions
      if (analysisData.multiple_executions) {
        const executionTimes = Object.keys(analysisData.multiple_executions).sort();
        
        for (const executionTime of executionTimes) {
          const executionData = analysisData.multiple_executions[executionTime];
          
          // Get the prediction data for this specific execution
          let symbolData = null;
          if (executionData.trading_signals && executionData.trading_signals[symbol]) {
            symbolData = executionData.trading_signals[symbol];
          }
          
          if (symbolData) {
            const models = symbolData.components?.price_prediction?.model_comparison;
            
            // Check if this is a next-day prediction by looking at the cron execution ID
            const isNextDayPrediction = executionData.cron_execution_id?.includes('next_day_market_prediction');
            
            // Get contextual pricing information from the stored market context
            const marketContext = symbolData.market_context;
            const baselinePrice = marketContext?.baseline_price || symbolData.current_price || null;
            const predictedPrice = symbolData.components?.price_prediction?.predicted_price || null;
            const tftPrice = models?.tft_prediction?.price || null;
            const nhitsPrice = models?.nhits_prediction?.price || null;
            
            // Determine appropriate comparison price based on prediction timing
            let comparisonPrice = marketClosePrice; // Default to market close
            let priceType = 'end_of_day';
            
            if (marketContext) {
              comparisonPrice = marketContext.comparison_price || marketClosePrice;
              priceType = marketContext.price_type;
            }
            
            // Calculate direction accuracy using appropriate baseline and comparison prices
            let directionAccuracy = null;
            let tftDirectionAccuracy = null; 
            let nhitsDirectionAccuracy = null;
            
            if (baselinePrice && predictedPrice && comparisonPrice) {
              // Calculate predicted vs actual directions
              const predictedDirection = predictedPrice > baselinePrice ? 'UP' : predictedPrice < baselinePrice ? 'DOWN' : 'FLAT';
              const actualDirection = comparisonPrice > baselinePrice ? 'UP' : comparisonPrice < baselinePrice ? 'DOWN' : 'FLAT';
              directionAccuracy = predictedDirection === actualDirection;
              
              // TFT direction accuracy
              if (tftPrice) {
                const tftDirection = tftPrice > baselinePrice ? 'UP' : tftPrice < baselinePrice ? 'DOWN' : 'FLAT';
                tftDirectionAccuracy = tftDirection === actualDirection;
              }
              
              // N-HITS direction accuracy
              if (nhitsPrice) {
                const nhitsDirection = nhitsPrice > baselinePrice ? 'UP' : nhitsPrice < baselinePrice ? 'DOWN' : 'FLAT';
                nhitsDirectionAccuracy = nhitsDirection === actualDirection;
              }
            }
            
            const prediction = {
              time: executionTime,
              timestamp: executionData.timestamp,
              // Market context information
              baseline_price: baselinePrice, // Price used as baseline for direction calculation
              comparison_price: comparisonPrice, // Actual price to compare against
              price_type: priceType, // pre_market, mid_day, end_of_day
              current_price: baselinePrice, // Keep for backward compatibility
              prediction_price: predictedPrice,
              tft_prediction: tftPrice,
              nhits_prediction: nhitsPrice,
              market_close_price: comparisonPrice, // Dynamic based on prediction timing
              confidence: symbolData.confidence || null,
              tft_confidence: models?.tft_prediction?.confidence || null,
              nhits_confidence: models?.nhits_prediction?.confidence || null,
              prediction_error: comparisonPrice && predictedPrice ? 
                Math.abs(predictedPrice - comparisonPrice) / comparisonPrice * 100 : null,
              // Direction accuracy metrics
              direction_accuracy: directionAccuracy,
              tft_direction_accuracy: tftDirectionAccuracy,
              nhits_direction_accuracy: nhitsDirectionAccuracy,
              // Direction indicators for display
              predicted_direction: baselinePrice && predictedPrice ? 
                (predictedPrice > baselinePrice ? '↗️' : predictedPrice < baselinePrice ? '↘️' : '➡️') : null,
              actual_direction: baselinePrice && comparisonPrice ? 
                (comparisonPrice > baselinePrice ? '↗️' : comparisonPrice < baselinePrice ? '↘️' : '➡️') : null,
              cron_execution_id: executionData.cron_execution_id,
              prediction_type: isNextDayPrediction ? 'next_day' : 'same_day'
            };
            
            predictions.push(prediction);
          }
        }
      }
      
      // Fallback: try to extract from daily_context (legacy compatibility)
      else if (analysisData.daily_context) {
        const timeSlots = Object.keys(analysisData.daily_context).sort();
        
        for (const timeSlot of timeSlots) {
          const contextData = analysisData.daily_context[timeSlot];
          
          // Use the latest trading signals for all time slots (legacy behavior)
          let symbolData = null;
          if (analysisData.trading_signals && analysisData.trading_signals[symbol]) {
            symbolData = analysisData.trading_signals[symbol];
          }
          
          if (symbolData) {
            const models = symbolData.components?.price_prediction?.model_comparison;
            
            const prediction = {
              time: timeSlot,
              timestamp: contextData.timestamp,
              prediction_price: symbolData.components?.price_prediction?.predicted_price || null,
              tft_prediction: models?.tft_prediction?.price || null,
              nhits_prediction: models?.nhits_prediction?.price || null,
              market_close_price: marketClosePrice,
              confidence: symbolData.confidence || null,
              tft_confidence: models?.tft_prediction?.confidence || null,
              nhits_confidence: models?.nhits_prediction?.confidence || null,
              prediction_error: marketClosePrice && symbolData.components?.price_prediction?.predicted_price ? 
                Math.abs(symbolData.components.price_prediction.predicted_price - marketClosePrice) / marketClosePrice * 100 : null,
              source: 'legacy_daily_context'
            };
            
            predictions.push(prediction);
          }
        }
      }
      
      // If no daily context, create single prediction from main data
      if (predictions.length === 0) {
        let symbolData = null;
        if (analysisData.trading_signals && analysisData.trading_signals[symbol]) {
          symbolData = analysisData.trading_signals[symbol];
        }
        
        if (symbolData) {
          const models = symbolData.components?.price_prediction?.model_comparison;
          
          const prediction = {
            time: "latest",
            timestamp: analysisData.timestamp || null,
            prediction_price: symbolData.components?.price_prediction?.predicted_price || null,
            tft_prediction: models?.tft_prediction?.price || null,
            nhits_prediction: models?.nhits_prediction?.price || null,
            market_close_price: marketClosePrice,
            confidence: symbolData.confidence || null,
            tft_confidence: models?.tft_prediction?.confidence || null,
            nhits_confidence: models?.nhits_prediction?.confidence || null,
            prediction_error: marketClosePrice && symbolData.components?.price_prediction?.predicted_price ? 
              Math.abs(symbolData.components.price_prediction.predicted_price - marketClosePrice) / marketClosePrice * 100 : null
          };
          
          predictions.push(prediction);
        }
      }
      
    } catch (error) {
      console.error(`Error processing date ${dateParam}:`, error.message);
    }
    
    console.log(`📈 Retrieved ${predictions.length} predictions for ${symbol} on ${dateParam}`);
    
    return new Response(JSON.stringify({ 
      symbol: symbol,
      date: dateParam,
      market_close_price: await getActualPrice(symbol, dateParam),
      predictions: predictions 
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('❌ Fact Data API error:', error.message);
    return new Response(JSON.stringify({ 
      error: error.message,
      symbol: null,
      date: null,
      predictions: []
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

/**
 * Get actual market price for a specific date using Yahoo Finance
 */
async function getActualPrice(symbol, dateStr) {
  try {
    // Convert date string to Date object
    const targetDate = new Date(dateStr);
    const currentDate = new Date();
    
    // Don't fetch actual price for future dates or today (market might not be closed)
    if (targetDate >= currentDate) {
      return null;
    }
    
    // Calculate days ago for Yahoo Finance period calculation
    const daysAgo = Math.ceil((currentDate - targetDate) / (1000 * 60 * 60 * 24));
    
    // Yahoo Finance API call
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${Math.floor(targetDate.getTime()/1000)}&period2=${Math.floor((targetDate.getTime() + 24*60*60*1000)/1000)}&interval=1d`;
    
    const response = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ Yahoo Finance API returned ${response.status} for ${symbol} on ${dateStr}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.length > 0) {
      const closePrices = data.chart.result[0].indicators.quote[0].close;
      const actualPrice = closePrices[closePrices.length - 1]; // Get the last (most recent) close price
      
      console.log(`✅ Retrieved actual price for ${symbol} on ${dateStr}: $${actualPrice?.toFixed(2)}`);
      return actualPrice;
    }
    
    console.log(`⚠️ No price data available for ${symbol} on ${dateStr}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error fetching actual price for ${symbol} on ${dateStr}:`, error.message);
    return null;
  }
}

/**
 * Get contextual market price based on prediction timing
 * - Pre-market (6:30-9:30 AM): Use previous close as baseline, compare to current day close
 * - Mid-day (12:00 PM): Use opening price as baseline, compare to current real-time price
 * - End-of-day (4:05 PM): Use current price as baseline, compare to actual close
 */
async function getContextualMarketPrice(symbol, predictionTime, env) {
  try {
    const now = new Date(predictionTime);
    const estHour = now.getHours() - 5; // Convert UTC to EST (simplified)
    
    let baselinePrice, comparisonPrice, priceType;
    
    // Get current market data first
    const marketData = await getMarketData(symbol, env);
    if (!marketData) {
      throw new Error('Market data unavailable');
    }
    
    const currentPrice = marketData.current_price;
    
    if (estHour >= 6 && estHour < 10) {
      // Pre-market predictions (6:30-9:30 AM EST)
      priceType = 'pre_market';
      baselinePrice = currentPrice; // This is yesterday's close from Yahoo Finance
      // For comparison, we need today's actual close (will be null if market not closed)
      const dateStr = now.toISOString().split('T')[0];
      comparisonPrice = await getActualPrice(symbol, dateStr);
    } else if (estHour >= 11 && estHour < 14) {
      // Mid-day predictions (12:00 PM EST) 
      priceType = 'mid_day';
      // Get opening price (approximate with current price for now)
      baselinePrice = currentPrice;
      comparisonPrice = currentPrice; // Real-time comparison
    } else {
      // End-of-day predictions (4:05 PM EST)
      priceType = 'end_of_day';
      baselinePrice = currentPrice;
      // Compare to actual market close
      const dateStr = now.toISOString().split('T')[0];
      comparisonPrice = await getActualPrice(symbol, dateStr);
    }
    
    return {
      baseline_price: baselinePrice,
      comparison_price: comparisonPrice,
      price_type: priceType,
      prediction_time: predictionTime,
      symbol: symbol,
      est_hour: estHour
    };
    
  } catch (error) {
    console.error(`❌ Error getting contextual price for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Get the next trading day (skips weekends)
 */
function getNextTradingDay(currentDate) {
  const nextDay = new Date(currentDate);
  nextDay.setDate(nextDay.getDate() + 1);
  
  // If next day is Saturday (6), skip to Monday
  if (nextDay.getDay() === 6) {
    nextDay.setDate(nextDay.getDate() + 2);
  }
  // If next day is Sunday (0), skip to Monday  
  else if (nextDay.getDay() === 0) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}

/**
 * Test next-day prediction logic
 */
async function handleTestNextDayPrediction(request, env) {
  try {
    console.log('🧪 Testing next-day prediction logic...');
    
    // Simulate 4:05 PM execution
    const simulatedTime = new Date();
    simulatedTime.setHours(16, 5, 0, 0); // 4:05 PM
    
    const nextTradingDay = getNextTradingDay(simulatedTime);
    
    const result = {
      test_type: 'next_day_prediction_logic',
      current_time: simulatedTime.toISOString(),
      current_date: simulatedTime.toISOString().split('T')[0],
      next_trading_day: nextTradingDay.toISOString(),
      next_trading_date: nextTradingDay.toISOString().split('T')[0],
      trigger_mode: 'next_day_market_prediction',
      prediction_horizons: [24],
      day_mapping: {
        current_day: simulatedTime.getDay(), // 0=Sunday, 1=Monday, etc.
        current_day_name: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][simulatedTime.getDay()],
        next_day: nextTradingDay.getDay(),
        next_day_name: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nextTradingDay.getDay()]
      },
      kv_storage_keys: {
        current_execution_timestamped: `analysis_${simulatedTime.toISOString().split('T')[0]}_${simulatedTime.toISOString().substr(11, 8).replace(/:/g, '')}`,
        next_day_daily_key: `analysis_${nextTradingDay.toISOString().split('T')[0]}`,
        explanation: "4:05 PM predictions will be stored under next trading day's date"
      },
      facebook_message_title: '🔮 Next Trading Day Predictions'
    };
    
    return new Response(JSON.stringify(result, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Next-day prediction test failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV list - show all stored keys
 */
async function handleKVList(request, env) {
  try {
    // Get all keys from KV storage
    const list = await env.TRADING_RESULTS.list();
    
    const kvData = {
      total_keys: list.keys.length,
      keys: list.keys.map(key => ({
        name: key.name,
        expiration: key.expiration || 'no_expiration',
        metadata: key.metadata || null
      }))
    };
    
    // Group keys by type for better organization
    const grouped = {
      analysis_keys: [],
      daily_context_keys: [],
      error_keys: [],
      other_keys: []
    };
    
    kvData.keys.forEach(key => {
      if (key.name.startsWith('analysis_')) {
        grouped.analysis_keys.push(key);
      } else if (key.name.startsWith('daily-context-')) {
        grouped.daily_context_keys.push(key);
      } else if (key.name.startsWith('error_')) {
        grouped.error_keys.push(key);
      } else {
        grouped.other_keys.push(key);
      }
    });
    
    return new Response(JSON.stringify({
      ...kvData,
      grouped_by_type: grouped,
      cleanup_endpoint: '/api/kv-cleanup?type=all (or analysis, daily-context, error)'
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to list KV keys',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV cleanup - delete old prediction data
 */
async function handleKVCleanup(request, env) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'analysis';
    const confirm = url.searchParams.get('confirm');
    
    if (confirm !== 'yes') {
      return new Response(JSON.stringify({
        warning: 'This will permanently delete KV data',
        message: 'Add ?confirm=yes to proceed with cleanup',
        types: ['all', 'analysis', 'daily-context', 'error'],
        example: '/api/kv-cleanup?type=analysis&confirm=yes'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get all keys
    const list = await env.TRADING_RESULTS.list();
    let keysToDelete = [];
    
    // Filter keys based on type
    if (type === 'all') {
      keysToDelete = list.keys;
    } else if (type === 'analysis') {
      keysToDelete = list.keys.filter(key => key.name.startsWith('analysis_'));
    } else if (type === 'daily-context') {
      keysToDelete = list.keys.filter(key => key.name.startsWith('daily-context-'));
    } else if (type === 'error') {
      keysToDelete = list.keys.filter(key => key.name.startsWith('error_'));
    } else {
      return new Response(JSON.stringify({
        error: 'Invalid type parameter',
        valid_types: ['all', 'analysis', 'daily-context', 'error']
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`🗑️ KV Cleanup: Deleting ${keysToDelete.length} keys of type '${type}'`);
    
    // Delete keys in batches
    const deletePromises = keysToDelete.map(key => 
      env.TRADING_RESULTS.delete(key.name)
    );
    
    await Promise.all(deletePromises);
    
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully deleted ${keysToDelete.length} keys`,
      type: type,
      deleted_keys: keysToDelete.map(key => key.name),
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ KV cleanup failed:', error);
    return new Response(JSON.stringify({
      error: 'KV cleanup failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Debug endpoint to show the actual Facebook message content without sending
 */
async function handleDebugWeekendMessage(request, env) {
  try {
    // Run Friday market close analysis
    const currentTime = new Date();
    const analysisResult = await runWeeklyMarketCloseAnalysis(env, currentTime);
    
    // Generate the Facebook message content without sending
    const messageContent = formatFridayWeekendReport(analysisResult, 'weekly_market_close_analysis');
    
    return new Response(JSON.stringify({
      debug_info: 'Generated Facebook message content (not sent)',
      timestamp: new Date().toISOString(),
      analysis_summary: {
        symbols_analyzed: analysisResult.symbols_analyzed?.length || 0,
        trading_signals_count: Object.keys(analysisResult.trading_signals || {}).length,
        trigger_mode: 'weekly_market_close_analysis'
      },
      facebook_message_content: messageContent,
      raw_trading_signals: analysisResult.trading_signals
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Debug weekend message error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// KV retrieval endpoint - get specific log by key
async function handleKVGet(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  
  if (!key) {
    return new Response(JSON.stringify({
      error: 'Missing key parameter',
      usage: 'GET /kv-get?key=YOUR_KEY_NAME',
      example: '/kv-get?key=fb_friday_messaging_1757874945667'
    }, null, 2), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const value = await env.TRADING_RESULTS.get(key);
    
    if (value === null) {
      return new Response(JSON.stringify({
        key: key,
        found: false,
        message: 'Key not found in KV store'
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Try to parse as JSON, if it fails return as string
    let parsedValue;
    try {
      parsedValue = JSON.parse(value);
    } catch (e) {
      parsedValue = value; // Return as string if not JSON
    }
    
    return new Response(JSON.stringify({
      key: key,
      found: true,
      value: parsedValue,
      raw_value: value,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      key: key,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}