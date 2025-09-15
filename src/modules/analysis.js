/**
 * Core Analysis Module
 * ✅ REAL NEURAL NETWORKS: Genuine TFT + N-HITS models deployed on Vercel
 * Uses authentic Temporal Fusion Transformer and Neural Hierarchical Interpolation models
 */

/**
 * Run comprehensive analysis
 * ✅ GENUINE NEURAL NETWORKS: Real TFT + N-HITS models with ensemble predictions
 */
export async function runBasicAnalysis(env, options = {}) {
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];
  const currentTime = new Date();

  const analysisResults = {
    symbols_analyzed: symbols,
    trading_signals: {},
    analysis_time: currentTime.toISOString(),
    trigger_mode: options.triggerMode || 'manual_analysis',
    performance_metrics: {
      success_rate: 0,
      total_symbols: symbols.length,
      successful_analyses: 0,
      failed_analyses: 0
    }
  };

  console.log(`🧠 Starting genuine neural network analysis for ${symbols.length} symbols...`);

  let successfulAnalyses = 0;

  // Analyze each symbol with genuine neural networks
  for (const symbol of symbols) {
    try {
      console.log(`   🧠 Analyzing ${symbol} with TFT + N-HITS neural networks...`);

      // Get real market data
      const marketData = await getMarketData(symbol);
      if (!marketData.success) {
        throw new Error(`Market data failed: ${marketData.error}`);
      }

      // Run dual neural network inference (TFT + N-HITS models)
      const [tftResult, nhitsResult] = await Promise.allSettled([
        callTFTModel(symbol, marketData.data, env),
        callNHITSModel(symbol, marketData.data, env)
      ]);

      // Process model results
      const tftPrediction = tftResult.status === 'fulfilled' ? tftResult.value : null;
      const nhitsPrediction = nhitsResult.status === 'fulfilled' ? nhitsResult.value : null;

      if (!tftPrediction && !nhitsPrediction) {
        throw new Error('Both TFT and N-HITS models failed');
      }

      // Combine predictions using ensemble logic
      const combinedSignal = combineModelPredictions(
        symbol,
        marketData.data,
        tftPrediction,
        nhitsPrediction,
        currentTime
      );

      analysisResults.trading_signals[symbol] = combinedSignal;
      successfulAnalyses++;

      console.log(`   ✅ ${symbol}: ${combinedSignal.direction} $${combinedSignal.current_price.toFixed(2)} → $${combinedSignal.predicted_price.toFixed(2)} (${(combinedSignal.confidence * 100).toFixed(1)}%)`);

    } catch (error) {
      console.error(`   ❌ ${symbol} analysis failed:`, error.message);
      analysisResults.performance_metrics.failed_analyses++;
    }
  }

  // Update performance metrics
  analysisResults.performance_metrics.successful_analyses = successfulAnalyses;
  analysisResults.performance_metrics.success_rate = (successfulAnalyses / symbols.length) * 100;

  console.log(`✅ Neural network analysis completed: ${successfulAnalyses}/${symbols.length} symbols successful`);
  return analysisResults;
}

/**
 * Get real market data from Yahoo Finance
 */
async function getMarketData(symbol) {
  try {
    console.log(`   📊 Fetching real market data for ${symbol}...`);

    // Yahoo Finance API call for recent OHLCV data
    const days = 35; // Get 35 days to ensure we have enough data
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (days * 24 * 60 * 60);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API returned ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart.result[0];

    if (!result || !result.indicators) {
      throw new Error('Invalid response format from Yahoo Finance');
    }

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const volume = result.indicators.quote[0].volume;

    // Convert to OHLCV format
    const ohlcv = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] && quote.high[i] && quote.low[i] && quote.close[i] && volume[i]) {
        ohlcv.push([
          quote.open[i],
          quote.high[i],
          quote.low[i],
          quote.close[i],
          volume[i]
        ]);
      }
    }

    if (ohlcv.length < 10) {
      throw new Error('Insufficient historical data');
    }

    const currentPrice = ohlcv[ohlcv.length - 1][3]; // Last close price

    console.log(`   📊 Retrieved ${ohlcv.length} days of data for ${symbol}, current: $${currentPrice.toFixed(2)}`);

    return {
      success: true,
      data: {
        symbol,
        current_price: currentPrice,
        ohlcv: ohlcv,
        last_updated: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error(`   ❌ Market data error for ${symbol}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Call real TFT model via Vercel endpoint
 */
async function callTFTModel(symbol, marketData, env) {
  const baseUrl = env.TFT_MODEL_URL || 'https://vercel-models-42w3vt2ze-yang-goufangs-projects.vercel.app/api/predict-tft';
  const tftUrl = `${baseUrl}?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${env.VERCEL_BYPASS_TOKEN}`;

  try {
    console.log(`   🧠 Calling TFT model for ${symbol}...`);

    const response = await fetch(tftUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: symbol,
        ohlcv: marketData.ohlcv,
        options: {
          sequence_length: 30
        }
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`TFT model returned ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'TFT model failed');
    }

    console.log(`   ✅ TFT: $${result.prediction.predicted_price} (${(result.prediction.confidence * 100).toFixed(1)}%)`);

    return {
      success: true,
      model: 'TFT',
      predicted_price: result.prediction.predicted_price,
      confidence: result.prediction.confidence,
      direction: result.prediction.direction,
      temporal_features: result.prediction.temporal_features,
      inference_time: result.metadata.inference_time_ms
    };

  } catch (error) {
    console.error(`   ❌ TFT model error for ${symbol}:`, error.message);
    return {
      success: false,
      error: error.message,
      model: 'TFT'
    };
  }
}

/**
 * Call real N-HITS model via Vercel endpoint
 */
async function callNHITSModel(symbol, marketData, env) {
  const baseUrl = env.NHITS_MODEL_URL || 'https://vercel-models-42w3vt2ze-yang-goufangs-projects.vercel.app/api/predict-nhits';
  const nhitsUrl = `${baseUrl}?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=${env.VERCEL_BYPASS_TOKEN}`;

  try {
    console.log(`   🔄 Calling N-HITS model for ${symbol}...`);

    const response = await fetch(nhitsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: symbol,
        ohlcv: marketData.ohlcv,
        options: {
          sequence_length: 30
        }
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`N-HITS model returned ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'N-HITS model failed');
    }

    console.log(`   ✅ N-HITS: $${result.prediction.predicted_price} (${(result.prediction.confidence * 100).toFixed(1)}%)`);

    return {
      success: true,
      model: 'N-HITS',
      predicted_price: result.prediction.predicted_price,
      confidence: result.prediction.confidence,
      direction: result.prediction.direction,
      hierarchical_features: result.prediction.hierarchical_features,
      inference_time: result.metadata.inference_time_ms
    };

  } catch (error) {
    console.error(`   ❌ N-HITS model error for ${symbol}:`, error.message);
    return {
      success: false,
      error: error.message,
      model: 'N-HITS'
    };
  }
}

/**
 * Combine TFT and N-HITS predictions using ensemble logic
 */
function combineModelPredictions(symbol, marketData, tftPrediction, nhitsPrediction, currentTime) {
  const currentPrice = marketData.current_price;

  // Handle cases where one or both models failed
  if (!tftPrediction && !nhitsPrediction) {
    throw new Error('Both models failed');
  }

  if (!tftPrediction) {
    console.log(`   ⚠️ ${symbol}: Using N-HITS only (TFT failed)`);
    return createSignalFromSingleModel(symbol, currentPrice, nhitsPrediction, currentTime);
  }

  if (!nhitsPrediction) {
    console.log(`   ⚠️ ${symbol}: Using TFT only (N-HITS failed)`);
    return createSignalFromSingleModel(symbol, currentPrice, tftPrediction, currentTime);
  }

  // Both models succeeded - create ensemble prediction
  console.log(`   🎯 ${symbol}: Ensemble prediction (TFT + N-HITS)`);

  // Weighted average (TFT: 55%, N-HITS: 45%)
  const tftWeight = 0.55;
  const nhitsWeight = 0.45;

  const ensemblePrice = (tftPrediction.predicted_price * tftWeight) +
                       (nhitsPrediction.predicted_price * nhitsWeight);

  // Ensemble confidence based on agreement
  const priceDifference = Math.abs(tftPrediction.predicted_price - nhitsPrediction.predicted_price);
  const agreementScore = Math.exp(-priceDifference / currentPrice * 10);
  const avgConfidence = (tftPrediction.confidence + nhitsPrediction.confidence) / 2;
  const ensembleConfidence = Math.min(0.95, avgConfidence * (0.8 + agreementScore * 0.2));

  // Direction consensus
  const tftDirection = tftPrediction.predicted_price > currentPrice ? 'UP' : 'DOWN';
  const nhitsDirection = nhitsPrediction.predicted_price > currentPrice ? 'UP' : 'DOWN';
  const ensembleDirection = ensemblePrice > currentPrice ? 'UP' : ensemblePrice < currentPrice ? 'DOWN' : 'NEUTRAL';
  const directionalConsensus = tftDirection === nhitsDirection;

  return {
    symbol: symbol,
    current_price: currentPrice,
    predicted_price: ensemblePrice,
    direction: ensembleDirection,
    confidence: ensembleConfidence,
    model: 'TFT+N-HITS-Ensemble',
    timestamp: currentTime.toISOString(),
    components: {
      tft: {
        predicted_price: tftPrediction.predicted_price,
        confidence: tftPrediction.confidence,
        direction: tftDirection
      },
      nhits: {
        predicted_price: nhitsPrediction.predicted_price,
        confidence: nhitsPrediction.confidence,
        direction: nhitsDirection
      },
      ensemble: {
        directional_consensus: directionalConsensus,
        agreement_score: agreementScore,
        price_difference_pct: (priceDifference / currentPrice * 100).toFixed(3)
      }
    }
  };
}

/**
 * Create signal from single model when other fails
 */
function createSignalFromSingleModel(symbol, currentPrice, modelPrediction, currentTime) {
  const direction = modelPrediction.predicted_price > currentPrice ? 'UP' :
                   modelPrediction.predicted_price < currentPrice ? 'DOWN' : 'NEUTRAL';

  return {
    symbol: symbol,
    current_price: currentPrice,
    predicted_price: modelPrediction.predicted_price,
    direction: direction,
    confidence: modelPrediction.confidence * 0.85, // Slight confidence penalty for single model
    model: modelPrediction.model,
    timestamp: currentTime.toISOString(),
    fallback_mode: true
  };
}

/**
 * Run weekend market close analysis
 */
export async function runWeeklyMarketCloseAnalysis(env, currentTime) {
  console.log('📊 Running weekly market close analysis...');
  
  const analysis = await runBasicAnalysis(env, {
    triggerMode: 'weekly_market_close_analysis'
  });
  
  return analysis;
}

/**
 * Run pre-market analysis 
 */
export async function runPreMarketAnalysis(env, options = {}) {
  console.log(`🌅 Running pre-market analysis (${options.triggerMode})...`);
  
  const analysis = await runBasicAnalysis(env, options);
  
  return analysis;
}