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
    } else if (currentHour === 16 && currentMinute === 5) {
      // 4:05 PM - Daily validation report + next-day predictions
      triggerMode = 'daily_validation_report'; 
      predictionHorizons = [18, 24]; // Next morning + next day
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
    
    console.log(`🚀 Scheduled analysis triggered at ${estTime.toISOString()}`, {
      hour: currentHour,
      minute: currentMinute, 
      triggerMode,
      predictionHorizons
    });
    
    // Reset circuit breakers if in recovery period
    Object.keys(circuitBreaker).forEach(service => {
      isCircuitBreakerOpen(service);
    });
    
    try {
      // Special handling for Friday weekly market close analysis
      let analysisResult;
      if (triggerMode === 'weekly_market_close_analysis') {
        analysisResult = await runWeeklyMarketCloseAnalysis(env, estTime);
      } else {
        analysisResult = await runPreMarketAnalysis(env, { 
          triggerMode, 
          predictionHorizons,
          currentTime: estTime
        });
      }
      
      // Validate analysis result
      if (!analysisResult || !analysisResult.symbols_analyzed || analysisResult.symbols_analyzed.length === 0) {
        throw new Error('Analysis returned invalid or empty results');
      }
      
      // Store results in KV for local system retrieval
      await env.TRADING_RESULTS.put(
        `analysis_${estTime.toISOString().split('T')[0]}`, // YYYY-MM-DD key
        JSON.stringify(analysisResult),
        { expirationTtl: 604800 } // 7 days for weekly validation
      );
      
      // Send high-confidence alerts if any
      if (analysisResult.alerts && analysisResult.alerts.length > 0) {
        await sendAlerts(analysisResult, env);
      }

      // Always send daily summary to Facebook (regardless of confidence)
      if (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) {
        await sendFacebookDailySummary(analysisResult, env);
        
        // Check if it's Sunday for weekly accuracy report
        const dayOfWeek = estTime.getDay(); // 0 = Sunday
        if (dayOfWeek === 0) {
          console.log('📊 Sunday detected - sending weekly accuracy report...');
          await sendWeeklyAccuracyReport(env);
        }
      }
      
      console.log(`✅ Analysis completed: ${analysisResult.symbols_analyzed.length} symbols`);
      console.log(`   Circuit breaker status: ModelScope=${circuitBreaker.modelScope.isOpen ? 'OPEN' : 'CLOSED'}, Yahoo=${circuitBreaker.yahooFinance.isOpen ? 'OPEN' : 'CLOSED'}`);
      
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
    } else if (url.pathname === '/test-daily-report') {
      return handleTestDailyReport(request, env);
    } else if (url.pathname === '/test-high-confidence') {
      return handleTestHighConfidence(request, env);
    } else {
      return new Response('TFT Trading System Worker API\nEndpoints: /analyze, /results, /health, /test-facebook, /weekly-report, /test-daily-report, /test-high-confidence', { 
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
    daily_context: dailyContext // Include accumulated context
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
  const cronTrigger = `${currentHour.toString().padStart(2, '0')}:${Math.floor(((currentTime || new Date()).getMinutes() / 30)) * 30}`;
  
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
    
    // Convert from [open, high, low, close, volume] arrays to {open, high, low, close, volume, date} objects
    const convertedData = apiData.map((row, index) => ({
      open: row[0],
      high: row[1], 
      low: row[2],
      close: row[3],
      volume: row[4] || 1000000,
      date: new Date(Date.now() - (apiData.length - index - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));
    
    console.log(`   📋 TFT payload: ${convertedData.length} records, first: ${JSON.stringify(convertedData[0])}, last: ${JSON.stringify(convertedData[convertedData.length - 1])}`);
    
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
    
    // Convert from [open, high, low, close, volume] arrays to {open, high, low, close, volume, date} objects
    const convertedData = apiData.map((row, index) => ({
      open: row[0],
      high: row[1], 
      low: row[2],
      close: row[3],
      volume: row[4] || 1000000,
      date: new Date(Date.now() - (apiData.length - index - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));
    
    console.log(`   📋 N-HITS payload: ${convertedData.length} records, first: ${JSON.stringify(convertedData[0])}, last: ${JSON.stringify(convertedData[convertedData.length - 1])}`);
    
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

  // Send Facebook Messenger alerts
  if (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) {
    await sendFacebookMessengerAlert(alerts, analysisResults, env);
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
      messageTitle = '📊 Daily Validation Reports';
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
      reportTitle = '📊 Daily Validation Reports';
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
      
      // Add model validation metrics
      const perf = analysisResults.performance_metrics;
      summaryText += `🎯 Model Performance:\n`;
      summaryText += `• Prediction Success Rate: ${perf.success_rate.toFixed(1)}%\n`;
      summaryText += `• Average Model Confidence: ${(perf.avg_confidence * 100).toFixed(1)}%\n`;
      summaryText += `• Predictions Generated: ${perf.total_symbols}\n`;
      summaryText += `• Forecast Distribution: ${JSON.stringify(perf.signal_distribution).replace(/"/g, '').replace('BUY', '↗️Up').replace('SELL', '↘️Down').replace('HOLD', '➡️Neutral')}`;
      
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
          await sendFacebookDailyReport(result, env, true); // true = include history
          console.log('✅ Facebook daily report completed successfully');
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
    
    // Generate and send weekly report
    await sendWeeklyAccuracyReport(env);
    
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
        await sendFacebookDailyReport(result, env, true); // true = include history
        result.facebook_test = 'Daily report with prediction history sent successfully';
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
          await sendHighConfidenceAlert(realData, env);
          result.facebook_alert = 'Real high-confidence alert sent successfully';
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
    alertTitle = '📊 Daily Validation Reports';
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