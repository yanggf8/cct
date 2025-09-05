/**
 * Hybrid Architecture Integration for Cloudflare Worker
 * Orchestrates ModelScope Custom TFT+N-HITS models with DeepSeek V3.1 sentiment analysis
 */

// ============================================================================
// HYBRID PREDICTION ENGINE - ModelScope Custom Models + Enhanced Sentiment
// ============================================================================

/**
 * Get predictions from ModelScope custom TFT + N-HITS deployment
 * @param {Array} symbols - Array of stock symbols
 * @param {Object} ohlcvData - OHLCV data for each symbol
 * @param {Object} currentPrices - Current prices for each symbol
 * @param {Object} env - Environment variables
 * @returns {Object} Predictions from custom ModelScope deployment
 */
async function getModelScopePredictions(symbols, ohlcvData, currentPrices, env) {
  const startTime = Date.now();
  
  try {
    console.log(`🔮 Calling ModelScope custom TFT+N-HITS deployment for ${symbols.join(', ')}`);
    
    // Check circuit breaker
    if (isCircuitBreakerOpen('modelscope_custom')) {
      console.log('🔴 ModelScope custom models circuit breaker open');
      throw new Error('ModelScope custom models circuit breaker open');
    }
    
    // Prepare request payload
    const payload = {
      symbols: symbols,
      ohlcv_data: ohlcvData,
      current_prices: currentPrices,
      config: {
        batch_size: symbols.length,
        timeout: 25000,  // 25 second timeout
        ensemble_mode: 'dual_active'  // TFT + N-HITS both active
      }
    };
    
    const response = await fetch(env.MODELSCOPE_CUSTOM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.MODELSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Request-ID': `cfw-${Date.now()}`
      },
      body: JSON.stringify(payload),
      timeout: 30000  // 30 second timeout
    });
    
    updateCircuitBreaker('modelscope_custom', true);
    
    if (!response.ok) {
      throw new Error(`ModelScope custom API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const latency = Date.now() - startTime;
    
    // Validate response structure
    if (!data.predictions) {
      throw new Error('Invalid response structure from ModelScope custom deployment');
    }
    
    // Process and enhance predictions
    const enhancedPredictions = {};
    
    for (const symbol of symbols) {
      const prediction = data.predictions[symbol];
      
      if (prediction && !prediction.error) {
        // Calculate additional metrics
        const currentPrice = currentPrices[symbol];
        const ensemblePrediction = prediction.ensemble_prediction;
        const priceChange = ((ensemblePrediction - currentPrice) / currentPrice) * 100;
        
        enhancedPredictions[symbol] = {
          // Core predictions
          tft_prediction: prediction.tft_prediction,
          nhits_prediction: prediction.nhits_prediction,
          ensemble_prediction: ensemblePrediction,
          
          // Enhanced metrics
          price_change_percent: priceChange,
          direction: priceChange > 0 ? 'UP' : 'DOWN',
          confidence: prediction.confidence,
          model_weights: prediction.model_weights,
          
          // Model diagnostics
          consensus: prediction.metadata?.consensus || false,
          prediction_spread: prediction.metadata?.prediction_spread || 0,
          model_correlation: prediction.metadata?.model_correlation || 0,
          
          // Performance metrics
          model_latency: prediction.metadata?.model_latency_ms || 0,
          current_price: currentPrice,
          
          // Quality indicators
          signal_strength: Math.abs(priceChange) * prediction.confidence,
          risk_adjusted_return: priceChange * prediction.confidence,
          
          source: 'modelscope_custom_tft_nhits'
        };
      } else {
        // Handle prediction errors with fallback
        console.log(`⚠️ ModelScope custom prediction failed for ${symbol}: ${prediction?.error || 'Unknown error'}`);
        
        enhancedPredictions[symbol] = {
          error: prediction?.error || 'Prediction failed',
          tft_prediction: currentPrice,
          nhits_prediction: currentPrice,
          ensemble_prediction: currentPrice,
          price_change_percent: 0,
          direction: 'HOLD',
          confidence: 0.1,
          source: 'modelscope_custom_error'
        };
      }
    }
    
    console.log(`✅ ModelScope custom predictions completed in ${latency}ms`);
    
    return {
      success: true,
      predictions: enhancedPredictions,
      metadata: {
        total_latency_ms: latency,
        models_used: ['TFT', 'N-HITS'],
        ensemble_method: 'weighted_consensus',
        deployment_version: data.metadata?.deployment_version || 'v1.0',
        batch_size: symbols.length,
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    updateCircuitBreaker('modelscope_custom', false);
    console.error(`❌ ModelScope custom prediction failed: ${error.message}`);
    
    // Return fallback mathematical predictions
    const fallbackPredictions = {};
    for (const symbol of symbols) {
      fallbackPredictions[symbol] = await getFallbackPrediction(symbol, currentPrices[symbol]);
    }
    
    return {
      success: false,
      error: error.message,
      predictions: fallbackPredictions,
      metadata: {
        total_latency_ms: Date.now() - startTime,
        fallback_used: true,
        source: 'mathematical_fallback'
      }
    };
  }
}

/**
 * Hybrid prediction engine that combines ModelScope predictions with enhanced sentiment
 */
async function runHybridPredictionEngine(symbols, env) {
  console.log(`🚀 Starting hybrid prediction engine for ${symbols.join(', ')}`);
  const startTime = Date.now();
  
  try {
    // Step 1: Get OHLCV data for all symbols
    console.log('📊 Fetching OHLCV data...');
    const dataPromises = symbols.map(symbol => getOHLCVData(symbol));
    const ohlcvResults = await Promise.allSettled(dataPromises);
    
    const ohlcvData = {};
    const currentPrices = {};
    const validSymbols = [];
    
    ohlcvResults.forEach((result, index) => {
      const symbol = symbols[index];
      if (result.status === 'fulfilled' && result.value.success) {
        ohlcvData[symbol] = result.value.data;
        currentPrices[symbol] = result.value.current_price;
        validSymbols.push(symbol);
      } else {
        console.log(`⚠️ Failed to get data for ${symbol}`);
      }
    });
    
    if (validSymbols.length === 0) {
      throw new Error('No valid OHLCV data available');
    }
    
    // Step 2: Get predictions from ModelScope custom deployment (parallel)
    console.log('🔮 Getting ModelScope custom predictions...');
    const predictionPromise = getModelScopePredictions(validSymbols, ohlcvData, currentPrices, env);
    
    // Step 3: Get enhanced sentiment analysis (parallel)
    console.log('📰 Getting enhanced sentiment analysis...');
    const sentimentPromises = validSymbols.map(symbol => 
      getEnhancedSentimentAnalysis(symbol, env)
    );
    
    // Wait for both predictions and sentiment
    const [predictionResult, sentimentResults] = await Promise.all([
      predictionPromise,
      Promise.allSettled(sentimentPromises)
    ]);
    
    // Step 4: Combine predictions with sentiment
    console.log('⚡ Combining predictions with sentiment analysis...');
    const hybridSignals = {};
    
    validSymbols.forEach((symbol, index) => {
      const prediction = predictionResult.predictions[symbol];
      const sentimentResult = sentimentResults[index];
      
      let sentiment = {
        signal_score: 0,
        confidence: 0.5,
        sentiment: 'NEUTRAL',
        market_impact: 'MINIMAL'
      };
      
      if (sentimentResult.status === 'fulfilled') {
        sentiment = sentimentResult.value;
      }
      
      // Combine prediction with sentiment using weighted ensemble
      const predictionWeight = 0.7;  // 70% weight to price prediction
      const sentimentWeight = 0.3;   // 30% weight to sentiment
      
      // Calculate combined signal strength
      const predictionSignal = (prediction.price_change_percent / 100) * prediction.confidence;
      const sentimentSignal = sentiment.signal_score * sentiment.confidence;
      
      const combinedSignal = (predictionSignal * predictionWeight) + (sentimentSignal * sentimentWeight);
      const combinedConfidence = (prediction.confidence * predictionWeight) + (sentiment.confidence * sentimentWeight);
      
      // Determine final recommendation
      let recommendation = 'HOLD';
      let signalStrength = 'LOW';
      
      if (combinedSignal > 0.05) {  // 5% threshold
        recommendation = combinedSignal > 0.15 ? 'STRONG_BUY' : 'BUY';
        signalStrength = combinedSignal > 0.15 ? 'HIGH' : 'MEDIUM';
      } else if (combinedSignal < -0.05) {
        recommendation = combinedSignal < -0.15 ? 'STRONG_SELL' : 'SELL';
        signalStrength = combinedSignal < -0.15 ? 'HIGH' : 'MEDIUM';
      }
      
      hybridSignals[symbol] = {
        // Combined signals
        combined_signal: combinedSignal,
        combined_confidence: combinedConfidence,
        recommendation: recommendation,
        signal_strength: signalStrength,
        
        // Price prediction components
        price_prediction: {
          tft: prediction.tft_prediction,
          nhits: prediction.nhits_prediction,
          ensemble: prediction.ensemble_prediction,
          change_percent: prediction.price_change_percent,
          direction: prediction.direction,
          confidence: prediction.confidence,
          consensus: prediction.consensus
        },
        
        // Sentiment components
        sentiment_analysis: {
          overall_sentiment: sentiment.sentiment,
          signal_score: sentiment.signal_score,
          confidence: sentiment.confidence,
          market_impact: sentiment.market_impact,
          reasoning: sentiment.reasoning,
          aspects: sentiment.aspects,
          news_articles: sentiment.news_articles
        },
        
        // Current market data
        current_price: currentPrices[symbol],
        
        // Model diagnostics
        model_weights: prediction.model_weights,
        prediction_spread: prediction.prediction_spread,
        
        // Source tracking
        prediction_source: prediction.source,
        sentiment_source: sentiment.source,
        analysis_timestamp: new Date().toISOString()
      };
    });
    
    const totalLatency = Date.now() - startTime;
    console.log(`✅ Hybrid prediction engine completed in ${totalLatency}ms`);
    
    return {
      success: true,
      signals: hybridSignals,
      metadata: {
        total_latency_ms: totalLatency,
        symbols_processed: validSymbols.length,
        prediction_model: 'modelscope_custom_tft_nhits',
        sentiment_model: 'deepseek_v3.1_enhanced',
        ensemble_weights: {
          prediction: predictionWeight,
          sentiment: sentimentWeight
        },
        processing_timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error(`❌ Hybrid prediction engine failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      signals: {},
      metadata: {
        total_latency_ms: Date.now() - startTime,
        error_timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Enhanced circuit breaker system for hybrid architecture
 */
const circuitBreakers = {
  modelscope_custom: { failures: 0, lastFailure: 0, threshold: 3 },
  deepseek_sentiment: { failures: 0, lastFailure: 0, threshold: 5 },
  yahoo_finance: { failures: 0, lastFailure: 0, threshold: 5 }
};

function updateCircuitBreaker(service, success) {
  const breaker = circuitBreakers[service];
  if (!breaker) return;
  
  if (success) {
    breaker.failures = 0;
  } else {
    breaker.failures++;
    breaker.lastFailure = Date.now();
  }
}

function isCircuitBreakerOpen(service) {
  const breaker = circuitBreakers[service];
  if (!breaker) return false;
  
  if (breaker.failures >= breaker.threshold) {
    const timeSinceFailure = Date.now() - breaker.lastFailure;
    const recoveryTime = 5 * 60 * 1000; // 5 minutes
    
    if (timeSinceFailure < recoveryTime) {
      return true;
    } else {
      // Reset circuit breaker after recovery time
      breaker.failures = 0;
      return false;
    }
  }
  
  return false;
}

/**
 * High-confidence alert detection for hybrid signals
 */
function detectHighConfidenceAlerts(hybridSignals) {
  const alerts = [];
  const confidenceThreshold = 0.85;
  
  Object.entries(hybridSignals).forEach(([symbol, signal]) => {
    if (signal.combined_confidence > confidenceThreshold && signal.signal_strength !== 'LOW') {
      alerts.push({
        symbol: symbol,
        recommendation: signal.recommendation,
        confidence: (signal.combined_confidence * 100).toFixed(1),
        signal_strength: signal.signal_strength,
        price_change: signal.price_prediction.change_percent.toFixed(2),
        current_price: signal.current_price.toFixed(2),
        target_price: signal.price_prediction.ensemble.toFixed(2),
        sentiment: signal.sentiment_analysis.overall_sentiment,
        market_impact: signal.sentiment_analysis.market_impact,
        reasoning: `Price: ${signal.price_prediction.change_percent.toFixed(2)}% (${signal.price_prediction.confidence.toFixed(2)}), Sentiment: ${signal.sentiment_analysis.signal_score.toFixed(2)} (${signal.sentiment_analysis.confidence.toFixed(2)})`,
        models_consensus: signal.price_prediction.consensus,
        timestamp: signal.analysis_timestamp
      });
    }
  });
  
  return alerts;
}

// Export functions for integration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runHybridPredictionEngine,
    getModelScopePredictions,
    detectHighConfidenceAlerts,
    updateCircuitBreaker,
    isCircuitBreakerOpen
  };
}