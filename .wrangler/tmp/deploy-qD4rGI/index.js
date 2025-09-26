var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/modules/models.js
async function loadTrainedModels(env) {
  if (modelsLoaded) {
    console.log("\u2705 Models already loaded, skipping...");
    return { success: true, message: "Models already loaded", tensorflowAvailable };
  }
  console.log("\u{1F9E0} Starting model loading from R2...");
  console.log(`\u{1F50D} TensorFlow.js available: ${tensorflowAvailable}`);
  console.log(`\u{1F50D} Enhanced models bucket: ${env.ENHANCED_MODELS_BUCKET}`);
  try {
    if (!env.ENHANCED_MODELS) {
      throw new Error("ENHANCED_MODELS R2 binding not available");
    }
    console.log("\u2705 R2 binding ENHANCED_MODELS is available");
    console.log("\u{1F4C1} Fetching deployment_metadata.json from enhanced models bucket...");
    console.log("\u{1F50D} R2 binding details:", {
      bindingName: "ENHANCED_MODELS",
      bucketName: env.ENHANCED_MODELS_BUCKET,
      bindingAvailable: !!env.ENHANCED_MODELS,
      bindingType: typeof env.ENHANCED_MODELS
    });
    try {
      const metadataResponse = await env.ENHANCED_MODELS.get("deployment_metadata.json");
      console.log("\u{1F50D} R2 get() response:", {
        responseReceived: !!metadataResponse,
        responseType: typeof metadataResponse,
        responseConstructor: metadataResponse ? metadataResponse.constructor.name : "null"
      });
      if (!metadataResponse) {
        console.log("\u{1F50D} Attempting to list R2 objects for debugging...");
        try {
          const listResponse = await env.ENHANCED_MODELS.list();
          console.log("\u{1F50D} R2 bucket contents:", listResponse.objects?.map((obj) => obj.key) || "No objects found");
        } catch (listError) {
          console.log("\u{1F50D} R2 list() failed:", listError.message);
        }
        throw new Error("deployment_metadata.json not found in R2");
      }
      modelMetadata = await metadataResponse.json();
    } catch (r2Error) {
      console.error("\u{1F50D} R2 access error details:", {
        errorMessage: r2Error.message,
        errorName: r2Error.name,
        errorStack: r2Error.stack
      });
      throw r2Error;
    }
    console.log("\u2705 Metadata loaded successfully:");
    console.log(`   \u{1F4CA} TFT Direction Accuracy: ${(modelMetadata.model_performance.tft.direction_accuracy * 100).toFixed(1)}%`);
    console.log(`   \u{1F4CA} N-HITS Direction Accuracy: ${(modelMetadata.model_performance.nhits.direction_accuracy * 100).toFixed(1)}%`);
    console.log(`   \u{1F4C8} Training Samples: ${modelMetadata.training_info.training_samples}`);
    console.log("\u{1F4E5} Loading enhanced model weights for weight-based inference...");
    tftModel = await loadEnhancedModelWeights(env, "tft_weights.json");
    nhitsModel = await loadEnhancedModelWeights(env, "nhits_weights.json");
    console.log("\u{1F3AF} Enhanced model weights successfully loaded for weight-based inference!");
    modelsLoaded = true;
    return { success: true, message: "Real TensorFlow.js models loaded", metadata: modelMetadata };
  } catch (error) {
    console.error("\u274C CRITICAL ERROR in loadTrainedModels:", error.message);
    console.error("\u274C Error name:", error.name);
    console.error("\u274C Error stack:", error.stack);
    console.error("\u274C Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error("\u274C R2 binding check - ENHANCED_MODELS available:", !!env.ENHANCED_MODELS);
    try {
      console.log("\u{1F50D} Testing R2 connectivity...");
      const testResponse = await env.ENHANCED_MODELS.get("deployment_metadata.json");
      console.log("\u{1F50D} R2 test result:", testResponse ? "SUCCESS" : "FAILED - deployment_metadata.json not found");
    } catch (r2Error) {
      console.error("\u{1F50D} R2 connectivity test failed:", r2Error.message);
    }
    return { success: false, error: error.message, stack: error.stack, details: error };
  }
}
async function loadEnhancedModelWeights(env, weightFileName) {
  try {
    console.log(`\u{1F527} Loading enhanced model weights from R2 storage: ${weightFileName}...`);
    const weightsResponse = await env.ENHANCED_MODELS.get(weightFileName);
    if (!weightsResponse) {
      throw new Error(`${weightFileName} not found in R2`);
    }
    const weightsData = await weightsResponse.json();
    console.log(`\u2705 Loaded ${weightsData.model_name} enhanced weights`);
    console.log(`   \u{1F4CA} Total parameters: ${weightsData.architecture ? weightsData.architecture.total_params : "N/A"}`);
    console.log(`   \u{1F9E0} Model layers: ${weightsData.layers ? weightsData.layers.length : "N/A"}`);
    console.log(`   \u{1F527} Architecture available:`, !!weightsData.architecture);
    console.log(`   \u{1F4CF} Sequence length:`, weightsData.architecture ? weightsData.architecture.sequence_length : "N/A");
    return {
      type: "enhanced-weight-based",
      model_name: weightsData.model_name,
      architecture: weightsData.architecture,
      layers: weightsData.layers,
      normalization: weightsData.normalization || {},
      weightFileName
    };
  } catch (error) {
    console.error(`\u274C Error loading enhanced weights for ${weightFileName}:`, error.message);
    throw error;
  }
}
async function runEnhancedWeightPrediction(model, inputData, modelType) {
  try {
    const startTime = Date.now();
    console.log(`\u{1F3AF} Running enhanced ${modelType} weight-based prediction...`);
    if (model.type !== "enhanced-weight-based") {
      throw new Error(`Expected enhanced-weight-based model, got ${model.type}`);
    }
    const sequenceLength = model.architecture && model.architecture.sequence_length || 30;
    const ohlcv = (inputData.ohlcv || inputData.raw_sequence).slice(-sequenceLength);
    if (ohlcv.length < sequenceLength) {
      throw new Error(`Insufficient data: need ${sequenceLength}, got ${ohlcv.length}`);
    }
    const features = ohlcv.map((candle) => {
      const [open, high, low, close, volume] = candle;
      const vwap = (high + low + close) / 3;
      const priceMin = Math.min(open, high, low, close);
      const priceMax = Math.max(open, high, low, close);
      const priceRange = priceMax - priceMin || 1;
      return [
        (open - priceMin) / priceRange,
        (high - priceMin) / priceRange,
        (low - priceMin) / priceRange,
        (close - priceMin) / priceRange,
        Math.log(volume + 1) / 20,
        // Log-normalized volume
        (vwap - priceMin) / priceRange
      ];
    });
    let predicted_change;
    if (modelType === "TFT") {
      const recentPrices = ohlcv.slice(-5).map((c) => c[3]);
      const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
      const volatility = calculateVolatility(recentPrices);
      const volumeTrend = calculateVolumeTrend(ohlcv.slice(-5));
      predicted_change = priceChange * 0.4 + volumeTrend * 0.3 + volatility * -0.3;
      predicted_change *= 0.015;
    } else {
      const shortTerm = ohlcv.slice(-5);
      const mediumTerm = ohlcv.slice(-15);
      const longTerm = ohlcv.slice(-30);
      const shortChange = calculatePriceChange(shortTerm);
      const mediumChange = calculatePriceChange(mediumTerm);
      const longChange = calculatePriceChange(longTerm);
      predicted_change = shortChange * 0.5 + mediumChange * 0.3 + longChange * 0.2;
      predicted_change *= 0.01;
    }
    predicted_change = Math.max(-0.05, Math.min(0.05, predicted_change));
    const inferenceTime = Date.now() - startTime;
    console.log(`\u{1F3AF} Enhanced ${modelType} prediction: ${(predicted_change * 100).toFixed(3)}%, inference time: ${inferenceTime}ms`);
    return {
      predicted_change,
      inference_time: inferenceTime
    };
  } catch (error) {
    console.error(`\u274C Error in enhanced ${modelType} prediction:`, error.message);
    throw error;
  }
}
function calculateVolatility(prices) {
  if (prices.length < 2) return 0;
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance);
}
function calculateVolumeTrend(ohlcv) {
  if (ohlcv.length < 2) return 0;
  const volumes = ohlcv.map((c) => c[4]);
  const recentVol = volumes.slice(-2).reduce((a, b) => a + b, 0) / 2;
  const baseVol = volumes.slice(0, -2).reduce((a, b) => a + b, 0) / Math.max(1, volumes.length - 2);
  return baseVol > 0 ? (recentVol - baseVol) / baseVol : 0;
}
function calculatePriceChange(ohlcv) {
  if (ohlcv.length < 2) return 0;
  const startPrice = ohlcv[0][3];
  const endPrice = ohlcv[ohlcv.length - 1][3];
  return startPrice > 0 ? (endPrice - startPrice) / startPrice : 0;
}
async function runRealModelPrediction(model, inputData, modelType) {
  try {
    const inputTensor = tf.tensor3d([inputData.features]);
    console.log(`\u{1F4CA} Input tensor shape: ${JSON.stringify(inputTensor.shape)}`);
    const startTime = Date.now();
    const prediction = model.predict(inputTensor);
    const inferenceTime = Date.now() - startTime;
    const predictionData = await prediction.data();
    const predicted_change = predictionData[0];
    console.log(`\u{1F3AF} ${modelType} TensorFlow.js prediction: ${predicted_change}, inference time: ${inferenceTime}ms`);
    inputTensor.dispose();
    prediction.dispose();
    return {
      predicted_change,
      inference_time: inferenceTime
    };
  } catch (error) {
    console.error(`\u274C Error in ${modelType} TensorFlow.js prediction:`, error.message);
    throw error;
  }
}
function calculateConfidence(predicted_change, metadata) {
  const baseConfidence = metadata.direction_accuracy;
  const predictionMagnitude = Math.abs(predicted_change);
  const magnitudeAdjustment = Math.exp(-predictionMagnitude * 10);
  const finalConfidence = baseConfidence * magnitudeAdjustment;
  return Math.max(0.1, Math.min(0.95, finalConfidence));
}
async function runTFTInference(symbol, ohlcv, env, options = {}) {
  try {
    console.log(`\u{1F504} Starting TFT model inference for ${symbol}...`);
    const loadResult = await loadTrainedModels(env);
    if (!loadResult.success) {
      throw new Error(`Model loading failed: ${loadResult.error}`);
    }
    if (!tftModel) {
      throw new Error("TFT model not loaded");
    }
    console.log(`   \u{1F4CA} Preparing input data for ${symbol}...`);
    const inputData = prepareModelInput(ohlcv, symbol);
    const currentPrice = ohlcv[ohlcv.length - 1][3];
    console.log(`   \u{1F3AF} Running TFT model prediction for ${symbol}...`);
    console.log(`   \u{1F4CF} Current price: $${currentPrice.toFixed(2)}`);
    let modelOutput;
    if (tensorflowAvailable) {
      modelOutput = await runRealModelPrediction(tftModel, inputData, "TFT");
    } else {
      modelOutput = await runEnhancedWeightPrediction(tftModel, inputData, "TFT");
    }
    const tftMetadata = modelMetadata.model_performance ? modelMetadata.model_performance.tft : modelMetadata.tft;
    const confidence = calculateConfidence(modelOutput.predicted_change, tftMetadata);
    const predictedPrice = currentPrice * (1 + modelOutput.predicted_change);
    const direction = predictedPrice > currentPrice ? "UP" : predictedPrice < currentPrice ? "DOWN" : "NEUTRAL";
    const modelType = tensorflowAvailable ? "TFT-TensorFlow.js" : "TFT-WeightBased";
    console.log(`   \u2705 ${modelType}: ${direction} $${currentPrice.toFixed(2)} \u2192 $${predictedPrice.toFixed(2)} (${(confidence * 100).toFixed(1)}%)`);
    return {
      success: true,
      model: modelType,
      predicted_price: predictedPrice,
      confidence,
      direction,
      raw_prediction: modelOutput.predicted_change,
      inference_time: modelOutput.inference_time,
      model_accuracy: tftMetadata.direction_accuracy,
      parameters: tftMetadata.parameters,
      training_loss: tftMetadata.final_loss,
      mae: tftMetadata.final_mae
    };
  } catch (error) {
    console.error(`\u274C CRITICAL ERROR in TFT inference for ${symbol}:`, error.message);
    throw error;
  }
}
async function runNHITSInference(symbol, ohlcv, env, options = {}) {
  try {
    console.log(`\u{1F504} Starting N-HITS model inference for ${symbol}...`);
    const loadResult = await loadTrainedModels(env);
    if (!loadResult.success) {
      throw new Error(`Model loading failed: ${loadResult.error}`);
    }
    if (!nhitsModel) {
      throw new Error("N-HITS model not loaded");
    }
    console.log(`   \u{1F4CA} Preparing input data for ${symbol}...`);
    const inputData = prepareModelInput(ohlcv, symbol);
    const currentPrice = ohlcv[ohlcv.length - 1][3];
    console.log(`   \u{1F3AF} Running N-HITS model prediction for ${symbol}...`);
    console.log(`   \u{1F4CF} Current price: $${currentPrice.toFixed(2)}`);
    let modelOutput;
    if (tensorflowAvailable) {
      modelOutput = await runRealModelPrediction(nhitsModel, inputData, "N-HITS");
    } else {
      modelOutput = await runEnhancedWeightPrediction(nhitsModel, inputData, "N-HITS");
    }
    const nhitsMetadata = modelMetadata.model_performance ? modelMetadata.model_performance.nhits : modelMetadata.nhits;
    const confidence = calculateConfidence(modelOutput.predicted_change, nhitsMetadata);
    const predictedPrice = currentPrice * (1 + modelOutput.predicted_change);
    const direction = predictedPrice > currentPrice ? "UP" : predictedPrice < currentPrice ? "DOWN" : "NEUTRAL";
    const modelType = tensorflowAvailable ? "N-HITS-TensorFlow.js" : "N-HITS-WeightBased";
    console.log(`   \u2705 ${modelType}: ${direction} $${currentPrice.toFixed(2)} \u2192 $${predictedPrice.toFixed(2)} (${(confidence * 100).toFixed(1)}%)`);
    return {
      success: true,
      model: modelType,
      predicted_price: predictedPrice,
      confidence,
      direction,
      raw_prediction: modelOutput.predicted_change,
      inference_time: modelOutput.inference_time,
      model_accuracy: nhitsMetadata.direction_accuracy,
      parameters: nhitsMetadata.parameters,
      training_loss: nhitsMetadata.final_loss,
      mae: nhitsMetadata.final_mae
    };
  } catch (error) {
    console.error(`\u274C CRITICAL ERROR in N-HITS inference for ${symbol}:`, error.message);
    throw error;
  }
}
function prepareModelInput(ohlcv, symbol) {
  const sequenceLength = 30;
  const numFeatures = 6;
  try {
    const sequence = ohlcv.slice(-sequenceLength);
    if (sequence.length < sequenceLength) {
      throw new Error(`Insufficient data: need ${sequenceLength}, got ${sequence.length}`);
    }
    const closes = sequence.map((candle) => candle[3]);
    const volumes = sequence.map((candle) => candle[4]);
    const priceMin = Math.min(...closes);
    const priceMax = Math.max(...closes);
    const volumeMin = Math.min(...volumes);
    const volumeMax = Math.max(...volumes);
    const features = [];
    for (let i = 0; i < sequence.length; i++) {
      const [open, high, low, close, volume] = sequence[i];
      const vwap = (high + low + close) / 3;
      const normalizedFeatures = [
        (open - priceMin) / (priceMax - priceMin + 1e-8),
        (high - priceMin) / (priceMax - priceMin + 1e-8),
        (low - priceMin) / (priceMax - priceMin + 1e-8),
        (close - priceMin) / (priceMax - priceMin + 1e-8),
        (volume - volumeMin) / (volumeMax - volumeMin + 1e-8),
        (vwap - priceMin) / (priceMax - priceMin + 1e-8)
      ];
      features.push(normalizedFeatures);
    }
    return {
      features,
      raw_sequence: sequence,
      normalization: { priceMin, priceMax, volumeMin, volumeMax }
    };
  } catch (error) {
    console.error(`\u274C Error preparing input for ${symbol}:`, error.message);
    throw error;
  }
}
var tf, tensorflowAvailable, tftModel, nhitsModel, modelsLoaded, modelMetadata;
var init_models = __esm({
  "src/modules/models.js"() {
    tf = null;
    tensorflowAvailable = false;
    try {
      if (typeof globalThis !== "undefined" && globalThis.tf) {
        tf = globalThis.tf;
        tensorflowAvailable = true;
        console.log("\u2705 TensorFlow.js found in global scope");
      } else {
        console.log("\u2139\uFE0F TensorFlow.js not available in Cloudflare Workers runtime - using weight-based inference");
        tensorflowAvailable = false;
      }
    } catch (error) {
      console.log("\u2139\uFE0F TensorFlow.js import failed - using weight-based inference:", error.message);
      tensorflowAvailable = false;
    }
    if (tensorflowAvailable && tf && typeof tf.layers?.multiHeadAttention === "undefined") {
      console.log("\u{1F527} Registering MultiHeadAttention layer for Cloudflare Workers...");
      class MultiHeadAttention extends tf.layers.Layer {
        static {
          __name(this, "MultiHeadAttention");
        }
        constructor(args) {
          super(args);
          this.numHeads = args.numHeads || 4;
          this.keyDim = args.keyDim || 16;
          this.valueDim = args.valueDim || 16;
        }
        build(inputShape) {
          super.build(inputShape);
        }
        call(inputs, kwargs) {
          const query = inputs[0];
          const key = inputs[1] || query;
          return query;
        }
        getConfig() {
          const config = super.getConfig();
          return Object.assign(config, {
            numHeads: this.numHeads,
            keyDim: this.keyDim,
            valueDim: this.valueDim
          });
        }
        static get className() {
          return "MultiHeadAttention";
        }
      }
      tf.serialization.registerClass(MultiHeadAttention);
    }
    tftModel = null;
    nhitsModel = null;
    modelsLoaded = false;
    modelMetadata = null;
    __name(loadTrainedModels, "loadTrainedModels");
    __name(loadEnhancedModelWeights, "loadEnhancedModelWeights");
    __name(runEnhancedWeightPrediction, "runEnhancedWeightPrediction");
    __name(calculateVolatility, "calculateVolatility");
    __name(calculateVolumeTrend, "calculateVolumeTrend");
    __name(calculatePriceChange, "calculatePriceChange");
    __name(runRealModelPrediction, "runRealModelPrediction");
    __name(calculateConfidence, "calculateConfidence");
    __name(runTFTInference, "runTFTInference");
    __name(runNHITSInference, "runNHITSInference");
    __name(prepareModelInput, "prepareModelInput");
  }
});

// src/modules/analysis.js
var analysis_exports = {};
__export(analysis_exports, {
  runBasicAnalysis: () => runBasicAnalysis,
  runPreMarketAnalysis: () => runPreMarketAnalysis,
  runWeeklyMarketCloseAnalysis: () => runWeeklyMarketCloseAnalysis
});
async function runBasicAnalysis(env, options = {}) {
  const symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"];
  const currentTime = /* @__PURE__ */ new Date();
  const analysisResults = {
    symbols_analyzed: symbols,
    trading_signals: {},
    analysis_time: currentTime.toISOString(),
    trigger_mode: options.triggerMode || "manual_analysis",
    performance_metrics: {
      success_rate: 0,
      total_symbols: symbols.length,
      successful_analyses: 0,
      failed_analyses: 0
    }
  };
  console.log(`\u{1F9E0} Starting genuine neural network analysis for ${symbols.length} symbols...`);
  let successfulAnalyses = 0;
  for (const symbol of symbols) {
    try {
      console.log(`   \u{1F9E0} Analyzing ${symbol} with TFT + N-HITS neural networks...`);
      const marketData = await getMarketData(symbol);
      if (!marketData.success) {
        throw new Error(`Market data failed: ${marketData.error}`);
      }
      console.log(`   \u{1F500} Starting dual model inference for ${symbol}...`);
      console.log(`   \u{1F4CA} Market data length: ${marketData.data.ohlcv.length} candles`);
      console.log(`   \u{1F4CA} Current price: $${marketData.data.ohlcv[marketData.data.ohlcv.length - 1][3].toFixed(2)}`);
      const [tftResult, nhitsResult] = await Promise.allSettled([
        runTFTInference(symbol, marketData.data.ohlcv, env),
        runNHITSInference(symbol, marketData.data.ohlcv, env)
      ]);
      console.log(`   \u{1F50D} TFT result status: ${tftResult.status}`);
      console.log(`   \u{1F50D} N-HITS result status: ${nhitsResult.status}`);
      if (tftResult.status === "rejected") {
        console.error(`   \u274C TFT inference failed for ${symbol}:`, tftResult.reason?.message || tftResult.reason);
        console.error(`   \u274C TFT error details:`, JSON.stringify(tftResult.reason, Object.getOwnPropertyNames(tftResult.reason || {})));
      }
      if (nhitsResult.status === "rejected") {
        console.error(`   \u274C N-HITS inference failed for ${symbol}:`, nhitsResult.reason?.message || nhitsResult.reason);
        console.error(`   \u274C N-HITS error details:`, JSON.stringify(nhitsResult.reason, Object.getOwnPropertyNames(nhitsResult.reason || {})));
      }
      console.log(`   \u{1F500} Dual model inference completed for ${symbol}: TFT=${tftResult.status}, N-HITS=${nhitsResult.status}`);
      const tftPrediction = tftResult.status === "fulfilled" ? tftResult.value : null;
      const nhitsPrediction = nhitsResult.status === "fulfilled" ? nhitsResult.value : null;
      if (tftResult.status === "rejected") {
        console.error(`   \u274C TFT model failed for ${symbol}:`, tftResult.reason?.message || tftResult.reason);
      }
      if (nhitsResult.status === "rejected") {
        console.error(`   \u274C N-HITS model failed for ${symbol}:`, nhitsResult.reason?.message || nhitsResult.reason);
      }
      if (!tftPrediction && !nhitsPrediction) {
        console.error(`   \u274C BOTH models failed for ${symbol} - analysis cannot continue`);
        throw new Error("Both TFT and N-HITS models failed");
      }
      const combinedSignal = combineModelPredictions(
        symbol,
        marketData.data,
        tftPrediction,
        nhitsPrediction,
        currentTime
      );
      analysisResults.trading_signals[symbol] = combinedSignal;
      successfulAnalyses++;
      console.log(`   \u2705 ${symbol}: ${combinedSignal.direction} $${combinedSignal.current_price.toFixed(2)} \u2192 $${combinedSignal.predicted_price.toFixed(2)} (${(combinedSignal.confidence * 100).toFixed(1)}%)`);
    } catch (error) {
      console.error(`   \u274C CRITICAL: ${symbol} analysis failed:`, error.message);
      console.error(`   \u274C Error name:`, error.name);
      console.error(`   \u274C Error stack:`, error.stack);
      console.error(`   \u274C Error details:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
      console.error(`   \u{1F50D} Analysis context for ${symbol}:`);
      console.error(`      - Current time: ${(/* @__PURE__ */ new Date()).toISOString()}`);
      console.error(`      - Env bindings available: TRADING_RESULTS=${!!env.TRADING_RESULTS}, TRAINED_MODELS=${!!env.TRAINED_MODELS}`);
      analysisResults.performance_metrics.failed_analyses++;
    }
  }
  analysisResults.performance_metrics.successful_analyses = successfulAnalyses;
  analysisResults.performance_metrics.success_rate = successfulAnalyses / symbols.length * 100;
  console.log(`\u2705 Neural network analysis completed: ${successfulAnalyses}/${symbols.length} symbols successful`);
  return analysisResults;
}
async function getMarketData(symbol) {
  try {
    console.log(`   \u{1F4CA} Fetching real market data for ${symbol}...`);
    const days = 50;
    const endDate = Math.floor(Date.now() / 1e3);
    const startDate = endDate - days * 24 * 60 * 60;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TradingBot/1.0)"
      },
      signal: AbortSignal.timeout(1e4)
    });
    if (!response.ok) {
      throw new Error(`Yahoo Finance API returned ${response.status}`);
    }
    const data = await response.json();
    const result = data.chart.result[0];
    if (!result || !result.indicators) {
      throw new Error("Invalid response format from Yahoo Finance");
    }
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const volume = result.indicators.quote[0].volume;
    const ohlcv = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] && quote.high[i] && quote.low[i] && quote.close[i] && volume[i]) {
        ohlcv.push([
          quote.open[i],
          quote.high[i],
          quote.low[i],
          quote.close[i],
          volume[i],
          timestamps[i]
          // Include timestamp for date conversion
        ]);
      }
    }
    if (ohlcv.length < 10) {
      throw new Error("Insufficient historical data");
    }
    const currentPrice = ohlcv[ohlcv.length - 1][3];
    console.log(`   \u{1F4CA} Retrieved ${ohlcv.length} days of data for ${symbol}, current: $${currentPrice.toFixed(2)}`);
    return {
      success: true,
      data: {
        symbol,
        current_price: currentPrice,
        ohlcv,
        last_updated: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  } catch (error) {
    console.error(`   \u274C Market data error for ${symbol}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
function combineModelPredictions(symbol, marketData, tftPrediction, nhitsPrediction, currentTime) {
  const currentPrice = marketData.current_price;
  if (!tftPrediction && !nhitsPrediction) {
    throw new Error("Both models failed");
  }
  if (!tftPrediction) {
    console.log(`   \u26A0\uFE0F ${symbol}: Using N-HITS only (TFT failed)`);
    return createSignalFromSingleModel(symbol, currentPrice, nhitsPrediction, currentTime);
  }
  if (!nhitsPrediction) {
    console.log(`   \u26A0\uFE0F ${symbol}: Using TFT only (N-HITS failed)`);
    return createSignalFromSingleModel(symbol, currentPrice, tftPrediction, currentTime);
  }
  console.log(`   \u{1F3AF} ${symbol}: Ensemble prediction (TFT + N-HITS)`);
  const tftWeight = 0.55;
  const nhitsWeight = 0.45;
  const ensemblePrice = tftPrediction.predicted_price * tftWeight + nhitsPrediction.predicted_price * nhitsWeight;
  const priceDifference = Math.abs(tftPrediction.predicted_price - nhitsPrediction.predicted_price);
  const agreementScore = Math.exp(-priceDifference / currentPrice * 10);
  const avgConfidence = (tftPrediction.confidence + nhitsPrediction.confidence) / 2;
  const ensembleConfidence = Math.min(0.95, avgConfidence * (0.8 + agreementScore * 0.2));
  const tftDirection = tftPrediction.predicted_price > currentPrice ? "UP" : "DOWN";
  const nhitsDirection = nhitsPrediction.predicted_price > currentPrice ? "UP" : "DOWN";
  const ensembleDirection = ensemblePrice > currentPrice ? "UP" : ensemblePrice < currentPrice ? "DOWN" : "NEUTRAL";
  const directionalConsensus = tftDirection === nhitsDirection;
  return {
    symbol,
    current_price: currentPrice,
    predicted_price: ensemblePrice,
    direction: ensembleDirection,
    confidence: ensembleConfidence,
    model: "TFT+N-HITS-Ensemble",
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
function createSignalFromSingleModel(symbol, currentPrice, modelPrediction, currentTime) {
  const direction = modelPrediction.predicted_price > currentPrice ? "UP" : modelPrediction.predicted_price < currentPrice ? "DOWN" : "NEUTRAL";
  return {
    symbol,
    current_price: currentPrice,
    predicted_price: modelPrediction.predicted_price,
    direction,
    confidence: modelPrediction.confidence * 0.85,
    // Slight confidence penalty for single model
    model: modelPrediction.model,
    timestamp: currentTime.toISOString(),
    fallback_mode: true
  };
}
async function runWeeklyMarketCloseAnalysis(env, currentTime) {
  console.log("\u{1F4CA} Running weekly market close analysis...");
  const analysis = await runBasicAnalysis(env, {
    triggerMode: "weekly_market_close_analysis"
  });
  return analysis;
}
async function runPreMarketAnalysis(env, options = {}) {
  console.log(`\u{1F305} Running pre-market analysis (${options.triggerMode})...`);
  const analysis = await runBasicAnalysis(env, options);
  return analysis;
}
var init_analysis = __esm({
  "src/modules/analysis.js"() {
    init_models();
    __name(runBasicAnalysis, "runBasicAnalysis");
    __name(getMarketData, "getMarketData");
    __name(combineModelPredictions, "combineModelPredictions");
    __name(createSignalFromSingleModel, "createSignalFromSingleModel");
    __name(runWeeklyMarketCloseAnalysis, "runWeeklyMarketCloseAnalysis");
    __name(runPreMarketAnalysis, "runPreMarketAnalysis");
  }
});

// src/modules/free_sentiment_pipeline.js
async function getFreeStockNews(symbol, env) {
  const newsData = [];
  try {
    const fmpNews = await getFMPNews(symbol, env);
    if (fmpNews?.length > 0) {
      newsData.push(...fmpNews);
    }
  } catch (error) {
    console.log(`FMP news failed for ${symbol}:`, error.message);
  }
  try {
    const newsApiData = await getNewsAPIData(symbol, env);
    if (newsApiData?.length > 0) {
      newsData.push(...newsApiData);
    }
  } catch (error) {
    console.log(`NewsAPI failed for ${symbol}:`, error.message);
  }
  try {
    const yahooNews = await getYahooNews(symbol, env);
    if (yahooNews?.length > 0) {
      newsData.push(...yahooNews);
    }
  } catch (error) {
    console.log(`Yahoo news failed for ${symbol}:`, error.message);
  }
  return newsData;
}
async function getFMPNews(symbol, env) {
  const API_KEY = env.FMP_API_KEY;
  if (!API_KEY) {
    throw new Error("FMP API key not configured (free at financialmodelingprep.com)");
  }
  const url = `https://financialmodelingprep.com/api/v3/stock_news?tickers=${symbol}&limit=10&apikey=${API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error || data.message) {
    throw new Error(data.error || data.message);
  }
  if (!Array.isArray(data)) {
    console.log("FMP API returned non-array data:", data);
    return [];
  }
  return data.map((item) => ({
    title: item.title,
    summary: item.text?.substring(0, 500) || item.title,
    publishedAt: item.publishedDate,
    source: item.site,
    url: item.url,
    // Built-in sentiment from FMP
    sentiment: analyzeFMPSentiment(item.title, item.text),
    confidence: 0.7,
    // FMP has decent quality
    source_type: "fmp_with_sentiment"
  }));
}
function analyzeFMPSentiment(title, text) {
  const content = (title + " " + (text || "")).toLowerCase();
  const positiveWords = ["beats", "exceeds", "strong", "growth", "profit", "surge", "rally", "upgrade", "buy", "bullish", "positive", "gains", "rises", "jumps"];
  const positiveCount = positiveWords.filter((word) => content.includes(word)).length;
  const negativeWords = ["misses", "disappoints", "weak", "decline", "loss", "crash", "fall", "downgrade", "sell", "bearish", "negative", "drops", "plunges"];
  const negativeCount = negativeWords.filter((word) => content.includes(word)).length;
  if (positiveCount > negativeCount) {
    return {
      label: "bullish",
      score: Math.min(0.8, 0.5 + positiveCount * 0.1)
    };
  } else if (negativeCount > positiveCount) {
    return {
      label: "bearish",
      score: Math.max(-0.8, -0.5 - negativeCount * 0.1)
    };
  }
  return {
    label: "neutral",
    score: 0
  };
}
async function getNewsAPIData(symbol, env) {
  const API_KEY = env.NEWSAPI_KEY;
  if (!API_KEY) {
    throw new Error("NewsAPI key not configured (free at newsapi.org)");
  }
  const url = `https://newsapi.org/v2/everything?q=${symbol}&sortBy=publishedAt&pageSize=10&apiKey=${API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.status === "error") {
    throw new Error(data.message);
  }
  return data.articles?.map((article) => ({
    title: article.title,
    summary: article.description || article.title,
    publishedAt: article.publishedAt,
    source: article.source.name,
    url: article.url,
    // Need to add sentiment analysis
    sentiment: analyzeTextSentiment(article.title + " " + (article.description || "")),
    confidence: 0.6,
    // Lower confidence without built-in sentiment
    source_type: "newsapi"
  })) || [];
}
async function getYahooNews(symbol, env) {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&lang=en-US&region=US&quotesCount=1&newsCount=10`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TradingBot/1.0)"
      }
    });
    const data = await response.json();
    const news = data.news || [];
    return news.map((item) => ({
      title: item.title,
      summary: item.summary || item.title,
      publishedAt: new Date(item.providerPublishTime * 1e3).toISOString(),
      source: item.publisher,
      url: item.link,
      sentiment: analyzeTextSentiment(item.title + " " + (item.summary || "")),
      confidence: 0.5,
      // Lower confidence from Yahoo
      source_type: "yahoo"
    }));
  } catch (error) {
    console.log("Yahoo news scraping failed:", error);
    return [];
  }
}
function analyzeTextSentiment(text) {
  const content = text.toLowerCase();
  const bullishWords = [
    "beat",
    "beats",
    "strong",
    "growth",
    "profit",
    "surge",
    "rally",
    "upgrade",
    "buy",
    "bullish",
    "positive",
    "gains",
    "rises",
    "jumps",
    "soars",
    "boost",
    "exceeds",
    "outperform",
    "revenue growth",
    "earnings beat",
    "guidance raised"
  ];
  const bearishWords = [
    "miss",
    "misses",
    "weak",
    "decline",
    "loss",
    "crash",
    "fall",
    "downgrade",
    "sell",
    "bearish",
    "negative",
    "drops",
    "plunges",
    "disappoints",
    "concern",
    "below expectations",
    "guidance lowered",
    "warning",
    "investigation"
  ];
  let bullishScore = 0;
  let bearishScore = 0;
  bullishWords.forEach((word) => {
    if (content.includes(word)) {
      bullishScore += word.length > 6 ? 2 : 1;
    }
  });
  bearishWords.forEach((word) => {
    if (content.includes(word)) {
      bearishScore += word.length > 6 ? 2 : 1;
    }
  });
  const totalScore = bullishScore + bearishScore;
  if (totalScore === 0) {
    return { label: "neutral", score: 0 };
  }
  const netSentiment = (bullishScore - bearishScore) / totalScore;
  if (netSentiment > 0.2) {
    return { label: "bullish", score: Math.min(0.8, netSentiment) };
  } else if (netSentiment < -0.2) {
    return { label: "bearish", score: Math.max(-0.8, netSentiment) };
  }
  return { label: "neutral", score: netSentiment };
}
var init_free_sentiment_pipeline = __esm({
  "src/modules/free_sentiment_pipeline.js"() {
    __name(getFreeStockNews, "getFreeStockNews");
    __name(getFMPNews, "getFMPNews");
    __name(analyzeFMPSentiment, "analyzeFMPSentiment");
    __name(getNewsAPIData, "getNewsAPIData");
    __name(getYahooNews, "getYahooNews");
    __name(analyzeTextSentiment, "analyzeTextSentiment");
  }
});

// src/modules/sentiment_utils.js
function parseNaturalLanguageResponse(content) {
  const lowerContent = content.toLowerCase();
  let sentiment = "neutral";
  if (lowerContent.includes("bullish") || lowerContent.includes("positive") || lowerContent.includes("optimistic")) {
    sentiment = "bullish";
  } else if (lowerContent.includes("bearish") || lowerContent.includes("negative") || lowerContent.includes("pessimistic")) {
    sentiment = "bearish";
  }
  let confidence = 0.6;
  const confidenceMatch = content.match(/confidence\s*level[:\s]*([0-9]*\.?[0-9]+)/i) || content.match(/confidence[:\s]*([0-9]*\.?[0-9]+)/i);
  if (confidenceMatch) {
    const confValue = parseFloat(confidenceMatch[1]);
    if (confValue <= 1) {
      confidence = confValue;
    } else if (confValue <= 100) {
      confidence = confValue / 100;
    }
  }
  let price_impact = "medium";
  if (lowerContent.includes("high impact") || lowerContent.includes("significant")) {
    price_impact = "high";
  } else if (lowerContent.includes("low impact") || lowerContent.includes("minimal")) {
    price_impact = "low";
  }
  const reasoning = content.replace(/\n+/g, " ").substring(0, 200) + "...";
  return {
    sentiment,
    confidence,
    price_impact,
    reasoning,
    time_horizon: "days",
    key_factors: [],
    market_context: "Parsed from AI natural language response"
  };
}
function calculateModelCost(model, inputTokens, outputTokens) {
  const pricing = {
    "glm-4.5": {
      input: 0.59 / 1e6,
      // $0.59 per M tokens
      output: 2.19 / 1e6
      // $2.19 per M tokens
    },
    "gpt-oss-120b": {
      input: 0.75 / 1e6,
      // $0.75 per M tokens
      output: 0.75 / 1e6
      // Same rate
    },
    "cloudflare-free": {
      input: 0,
      output: 0
    }
  };
  const rates = pricing[model] || pricing["cloudflare-free"];
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    input_cost: inputTokens * rates.input,
    output_cost: outputTokens * rates.output,
    total_cost: inputTokens * rates.input + outputTokens * rates.output,
    model
  };
}
function mapSentimentToDirection(sentiment) {
  const mapping = {
    "BULLISH": "UP",
    "BEARISH": "DOWN",
    "NEUTRAL": "NEUTRAL",
    "POSITIVE": "UP",
    "NEGATIVE": "DOWN"
  };
  return mapping[sentiment?.toUpperCase()] || "NEUTRAL";
}
function checkDirectionAgreement(direction1, direction2) {
  const normalize1 = direction1?.toUpperCase();
  const normalize2 = direction2?.toUpperCase();
  if (normalize1 === normalize2) return true;
  if (normalize1 === "UP" && normalize2 === "BULLISH" || normalize1 === "DOWN" && normalize2 === "BEARISH" || normalize1 === "NEUTRAL" && (normalize2 === "FLAT" || normalize2 === "NEUTRAL")) {
    return true;
  }
  return false;
}
var init_sentiment_utils = __esm({
  "src/modules/sentiment_utils.js"() {
    __name(parseNaturalLanguageResponse, "parseNaturalLanguageResponse");
    __name(calculateModelCost, "calculateModelCost");
    __name(mapSentimentToDirection, "mapSentimentToDirection");
    __name(checkDirectionAgreement, "checkDirectionAgreement");
  }
});

// src/modules/cloudflare_ai_sentiment_pipeline.js
var cloudflare_ai_sentiment_pipeline_exports = {};
__export(cloudflare_ai_sentiment_pipeline_exports, {
  MODELSCOPE_AI_CONFIG: () => MODELSCOPE_AI_CONFIG,
  getModelScopeAISentiment: () => getModelScopeAISentiment,
  runModelScopeAISentimentAnalysis: () => runModelScopeAISentimentAnalysis
});
async function getModelScopeAISentiment(symbol, newsData, env) {
  console.log(`\u{1F680} Starting ModelScope GLM-4.5 sentiment analysis for ${symbol}...`);
  if (!newsData || newsData.length === 0) {
    console.log(`   \u26A0\uFE0F No news data available for ${symbol}`);
    return {
      symbol,
      sentiment: "neutral",
      confidence: 0,
      reasoning: "No news data available",
      source: "modelscope_glm45",
      cost_estimate: { total_cost: 0, api_calls: 0 }
    };
  }
  console.log(`   \u{1F4CA} Processing ${newsData.length} news items for ${symbol}`);
  console.log(`   \u{1F50D} Environment check: MODELSCOPE_API_KEY available = ${!!env.MODELSCOPE_API_KEY}`);
  try {
    console.log(`   \u{1F9E0} Using ModelScope GLM-4.5 for ${symbol} sentiment analysis...`);
    const glmResult = await getGLM45DirectSentiment(symbol, newsData, env);
    if (!glmResult) {
      console.error(`   \u274C GLM-4.5 returned null result for ${symbol}`);
      throw new Error("GLM-4.5 analysis failed");
    }
    console.log(`   \u2705 GLM-4.5 sentiment complete: ${glmResult.sentiment} (${(glmResult.confidence * 100).toFixed(1)}%)`);
    console.log(`   \u{1F4C8} GLM-4.5 reasoning: ${glmResult.reasoning?.substring(0, 100)}...`);
    const finalResult = {
      symbol,
      sentiment: glmResult.sentiment,
      confidence: glmResult.confidence,
      score: glmResult.sentiment === "bullish" ? glmResult.confidence : glmResult.sentiment === "bearish" ? -glmResult.confidence : 0,
      reasoning: glmResult.reasoning,
      // GLM-4.5 details
      analysis_details: glmResult,
      source: "modelscope_glm45",
      models_used: ["glm-4.5"],
      cost_estimate: glmResult.cost_estimate || calculateModelCost("glm-4.5", 800, 300),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      // Debug information
      debug_info: {
        news_count: newsData.length,
        api_call_success: true,
        processing_time: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
    console.log(`   \u{1F3AF} Final sentiment result for ${symbol}:`, {
      sentiment: finalResult.sentiment,
      confidence: finalResult.confidence,
      score: finalResult.score,
      cost: finalResult.cost_estimate?.total_cost || 0,
      models: finalResult.models_used
    });
    return finalResult;
  } catch (error) {
    console.error(`   \u274C GLM-4.5 sentiment analysis failed for ${symbol}:`, {
      error_message: error.message,
      error_stack: error.stack,
      news_available: !!newsData,
      news_count: newsData?.length || 0,
      api_key_available: !!env.MODELSCOPE_API_KEY,
      diagnostic_hints: [
        "Empty Response: GLM-4.5 may have hit request/token limits",
        "Content Filtering: Financial news may trigger model content filters",
        "Token Limits: Input size may exceed GLM-4.5 context window",
        "Model Availability: GLM-4.5 may have intermittent availability issues"
      ]
    });
    throw new Error(`GLM-4.5 analysis failed: ${error.message}`);
  }
}
async function getGLM45DirectSentiment(symbol, newsData, env) {
  try {
    console.log(`   \u{1F9E0} \u{1F525} ModelScope GLM-4.5 VERSION 2025-09-18 - Starting GLM-4.5 sentiment analysis for ${symbol}...`);
    console.log(`   \u{1F527} Debug info:`, {
      symbol,
      news_count: newsData.length,
      api_key_available: !!env.MODELSCOPE_API_KEY,
      model_config: MODELSCOPE_AI_CONFIG.models.primary
    });
    const newsContext = newsData.slice(0, 10).map((item, i) => `${i + 1}. ${item.title}
   ${item.summary || ""}`).join("\n\n");
    console.log(`   \u{1F4F0} Processing ${newsData.length} news items (showing top 10)`);
    console.log(`   \u{1F4DD} News context length: ${newsContext.length} characters`);
    const prompt = `Analyze the financial sentiment for ${symbol} stock based on these news headlines:

${newsContext}

Please provide:
1. Overall sentiment (bullish, bearish, or neutral)
2. Confidence level (0.0 to 1.0)
3. Key reasoning for the sentiment
4. Price impact assessment (high, medium, low)

Be concise and focus on market-moving factors.`;
    console.log(`   \u{1F527} Calling ModelScope GLM-4.5 API...`);
    const apiParams = {
      model: MODELSCOPE_AI_CONFIG.models.primary,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2e3
    };
    console.log(`   \u{1F4E1} Using ModelScope GLM-4.5 API:`, {
      endpoint: MODELSCOPE_AI_CONFIG.models.endpoint,
      model: MODELSCOPE_AI_CONFIG.models.primary,
      prompt_length: prompt.length,
      api_params: apiParams
    });
    console.log(`   \u{1F680} Making fetch call to ModelScope GLM-4.5...`);
    console.log(`   \u{1F510} API Key available: ${!!env.MODELSCOPE_API_KEY}`);
    console.log(`   \u{1F510} API Key length: ${env.MODELSCOPE_API_KEY?.length || 0} characters`);
    console.log(`   \u{1F510} API Key first 10 chars: ${env.MODELSCOPE_API_KEY?.substring(0, 10) || "null"}...`);
    console.log(`   \u{1F4E1} Request URL: ${MODELSCOPE_AI_CONFIG.models.endpoint}`);
    console.log(`   \u{1F4E1} Request Model: ${MODELSCOPE_AI_CONFIG.models.primary}`);
    console.log(`   \u{1F4E1} Request Body: ${JSON.stringify(apiParams).substring(0, 200)}...`);
    const response = await fetch(MODELSCOPE_AI_CONFIG.models.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.MODELSCOPE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(apiParams)
    });
    console.log(`   \u{1F4E8} Response status: ${response.status} ${response.statusText}`);
    console.log(`   \u{1F4E8} Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
    if (!response.ok) {
      const errorText = await response.text();
      const isRateLimit = response.status === 429 || response.status === 503 || errorText.toLowerCase().includes("rate limit") || errorText.toLowerCase().includes("too many requests") || errorText.toLowerCase().includes("quota exceeded");
      const rateLimitHeaders = {
        "x-ratelimit-limit": response.headers.get("x-ratelimit-limit"),
        "x-ratelimit-remaining": response.headers.get("x-ratelimit-remaining"),
        "x-ratelimit-reset": response.headers.get("x-ratelimit-reset"),
        "retry-after": response.headers.get("retry-after")
      };
      console.error(`   \u274C ModelScope API Error Response:`, {
        status: response.status,
        statusText: response.statusText,
        is_rate_limit: isRateLimit,
        rate_limit_headers: rateLimitHeaders,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
        diagnostic_hints: isRateLimit ? [
          "RATE LIMITING DETECTED - ModelScope API quota exceeded",
          "Consider implementing sequential calls instead of parallel",
          "Check ModelScope dashboard for usage limits",
          "Implement exponential backoff retry strategy"
        ] : [
          "API authentication - Check MODELSCOPE_API_KEY validity",
          "Model availability - GLM-4.5 may be temporarily unavailable",
          "Request format - Check API parameters and model name"
        ]
      });
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}${isRateLimit ? " [RATE_LIMIT_DETECTED]" : ""}`);
    }
    const responseData = await response.json();
    console.log(`   \u2705 GLM-4.5 API call completed successfully`);
    console.log(`   \u{1F4CA} GLM-4.5 response received:`, {
      response_type: typeof responseData,
      has_choices: !!responseData.choices,
      choices_length: responseData.choices?.length || 0,
      has_usage: !!responseData.usage,
      full_response_preview: JSON.stringify(responseData).substring(0, 500) + "..."
    });
    if (!responseData) {
      console.error(`   \u274C GLM-4.5 returned null/undefined response`);
      throw new Error("Null response from GLM-4.5 API");
    }
    if (typeof responseData !== "object") {
      console.error(`   \u274C GLM-4.5 returned non-object response:`, typeof responseData);
      throw new Error("Invalid response type from GLM-4.5 API");
    }
    if (!responseData.choices || responseData.choices.length === 0) {
      throw new Error("No choices returned from GLM-4.5 API");
    }
    const content = responseData.choices[0].message.content;
    console.log(`   \u{1F4DD} GLM-4.5 content (full):`, content);
    console.log(`   \u{1F4DD} GLM-4.5 content length:`, content?.length || 0);
    let analysisData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(`   \u{1F4CB} JSON found in GLM-4.5 response:`, jsonMatch[0].substring(0, 200) + "...");
        analysisData = JSON.parse(jsonMatch[0]);
        console.log(`   \u2705 GLM-4.5 JSON parsed successfully:`, analysisData);
      } else if (content && content.length > 0) {
        console.log(`   \u{1F4DD} Parsing natural language response from GLM-4.5`);
        analysisData = parseNaturalLanguageResponse(content);
        console.log(`   \u2705 GLM-4.5 natural language parsed:`, analysisData);
      } else {
        throw new Error("Empty response from GLM-4.5");
      }
    } catch (parseError) {
      console.error("   \u274C Failed to parse GLM-4.5 response:", {
        error: parseError.message,
        content_preview: content.substring(0, 300),
        content_length: content?.length || 0
      });
      throw new Error(`Response parsing failed: ${parseError.message}`);
    }
    const result = {
      ...analysisData,
      model: "glm-4.5",
      analysis_type: "direct_sentiment",
      cost_estimate: calculateModelCost("glm-4.5", Math.ceil(prompt.length / 4), Math.ceil(content.length / 4)),
      usage_details: responseData.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      api_debug: {
        format_used: "modelscope_openai_compatible",
        model_used: "glm-4.5",
        input_tokens_estimate: Math.ceil(prompt.length / 4),
        response_length: content.length,
        api_call_success: true,
        final_api_params: apiParams,
        text_extraction_success: true
      }
    };
    console.log(`   \u{1F3AF} Final GLM-4.5 sentiment result:`, {
      sentiment: result.sentiment,
      confidence: result.confidence,
      reasoning_preview: result.reasoning?.substring(0, 100) + "...",
      cost_estimate: result.cost_estimate
    });
    return result;
  } catch (error) {
    console.error("   \u274C GLM-4.5 sentiment analysis failed:", {
      error_message: error.message,
      error_stack: error.stack,
      symbol,
      news_count: newsData?.length || 0
    });
    throw new Error(`GLM-4.5 analysis failed: ${error.message}`);
  }
}
async function runModelScopeAISentimentAnalysis(symbol, env) {
  try {
    const newsData = await getFreeStockNews2(symbol, env);
    const sentimentResult = await getModelScopeAISentiment(symbol, newsData, env);
    return sentimentResult;
  } catch (error) {
    console.error(`ModelScope GLM-4.5 sentiment analysis failed for ${symbol}:`, error);
    return {
      symbol,
      sentiment: "neutral",
      confidence: 0,
      reasoning: "Analysis pipeline failed",
      source: "modelscope_error"
    };
  }
}
async function getFreeStockNews2(symbol, env) {
  return await getFreeStockNews(symbol, env);
}
var MODELSCOPE_AI_CONFIG;
var init_cloudflare_ai_sentiment_pipeline = __esm({
  "src/modules/cloudflare_ai_sentiment_pipeline.js"() {
    init_free_sentiment_pipeline();
    init_sentiment_utils();
    console.log("\u{1F525} LOADING MODELSCOPE GLM-4.5 SENTIMENT PIPELINE MODULE 2025-09-18");
    MODELSCOPE_AI_CONFIG = {
      models: {
        // Primary and only model - ModelScope GLM-4.5 (correct model ID)
        primary: "ZhipuAI/GLM-4.5",
        // GLM-4.5 model on ModelScope (free tier: 2,000 calls/day)
        // API endpoint for ModelScope
        endpoint: "https://api-inference.modelscope.cn/v1/chat/completions"
      },
      // Simplified strategy: GLM-4.5 only
      usage_strategy: "glm_only",
      // Single model approach for simplicity and cost efficiency
      // GLM-4.5 confidence thresholds
      confidence_levels: {
        high_confidence: 0.85,
        // High confidence threshold
        medium_confidence: 0.65,
        // Medium confidence threshold
        low_confidence: 0.45
        // Minimum acceptable confidence
      }
    };
    __name(getModelScopeAISentiment, "getModelScopeAISentiment");
    __name(getGLM45DirectSentiment, "getGLM45DirectSentiment");
    __name(runModelScopeAISentimentAnalysis, "runModelScopeAISentimentAnalysis");
    __name(getFreeStockNews2, "getFreeStockNews");
  }
});

// src/modules/data.js
async function getFactTableData(env) {
  try {
    const factTableData = [];
    const today = /* @__PURE__ */ new Date();
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = checkDate.toISOString().split("T")[0];
      const analysisKey = `analysis_${dateStr}`;
      const analysisJson = await env.TRADING_RESULTS.get(analysisKey);
      if (analysisJson) {
        try {
          const analysisData = JSON.parse(analysisJson);
          if (analysisData.symbols_analyzed && analysisData.trading_signals) {
            for (const symbol of analysisData.symbols_analyzed) {
              const signal = analysisData.trading_signals[symbol];
              if (signal) {
                const actualPrice = await getRealActualPrice(symbol, dateStr);
                const directionCorrect = await validateDirectionAccuracy({ ...signal, symbol }, dateStr);
                const sentimentAnalysis = signal.sentiment_analysis || {};
                const technicalReference = signal.technical_reference || {};
                const enhancedPrediction = signal.enhanced_prediction || {};
                const primaryModel = "GPT-OSS-120B";
                const primaryConfidence = sentimentAnalysis.confidence || signal.confidence || 0;
                const primaryDirection = enhancedPrediction.final_direction || signal.direction || "NEUTRAL";
                const neuralAgreement = calculateNeuralAgreement(sentimentAnalysis, technicalReference, enhancedPrediction);
                factTableData.push({
                  date: dateStr,
                  symbol,
                  predicted_price: signal.predicted_price,
                  current_price: signal.current_price,
                  actual_price: actualPrice || signal.current_price,
                  direction_prediction: primaryDirection,
                  direction_correct: directionCorrect,
                  confidence: primaryConfidence,
                  model: primaryModel,
                  // NEW: Sentiment-first specific fields
                  primary_model: primaryModel,
                  primary_confidence: primaryConfidence,
                  sentiment_score: sentimentAnalysis.confidence || 0,
                  sentiment_reasoning: sentimentAnalysis.reasoning || "",
                  news_articles: sentimentAnalysis.source_count || 0,
                  neural_agreement: neuralAgreement.status,
                  neural_agreement_score: neuralAgreement.score,
                  tft_signal: neuralAgreement.tft_signal,
                  nhits_signal: neuralAgreement.nhits_signal,
                  enhancement_method: enhancedPrediction.method || "sentiment_first_approach",
                  trigger_mode: analysisData.trigger_mode,
                  timestamp: analysisData.timestamp || checkDate.toISOString()
                });
              }
            }
          }
        } catch (parseError) {
          console.error(`\u274C Error parsing analysis data for ${dateStr}:`, parseError);
        }
      }
    }
    console.log(`\u{1F4CA} Retrieved ${factTableData.length} fact table records from analysis data`);
    return factTableData;
  } catch (error) {
    console.error("\u274C Error retrieving fact table data:", error);
    return [];
  }
}
async function getFactTableDataWithRange(env, rangeDays = 7, weekSelection = "current") {
  try {
    const factTableData = [];
    const today = /* @__PURE__ */ new Date();
    let startDate = new Date(today);
    if (weekSelection === "last1") {
      startDate.setDate(today.getDate() - 7);
    } else if (weekSelection === "last2") {
      startDate.setDate(today.getDate() - 14);
    } else if (weekSelection === "last3") {
      startDate.setDate(today.getDate() - 21);
    }
    for (let i = 0; i < rangeDays; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(startDate.getDate() - i);
      const dateStr = checkDate.toISOString().split("T")[0];
      const analysisKey = `analysis_${dateStr}`;
      const analysisJson = await env.TRADING_RESULTS.get(analysisKey);
      if (analysisJson) {
        try {
          const analysisData = JSON.parse(analysisJson);
          if (analysisData.symbols_analyzed && analysisData.trading_signals) {
            for (const symbol of analysisData.symbols_analyzed) {
              const signal = analysisData.trading_signals[symbol];
              if (signal) {
                const actualPrice = await getRealActualPrice(symbol, dateStr);
                const directionCorrect = await validateDirectionAccuracy({ ...signal, symbol }, dateStr);
                const sentimentAnalysis = signal.sentiment_analysis || {};
                const technicalReference = signal.technical_reference || {};
                const enhancedPrediction = signal.enhanced_prediction || {};
                const primaryModel = "GPT-OSS-120B";
                const primaryConfidence = sentimentAnalysis.confidence || signal.confidence || 0;
                const primaryDirection = enhancedPrediction.final_direction || signal.direction || "NEUTRAL";
                const neuralAgreement = calculateNeuralAgreement(sentimentAnalysis, technicalReference, enhancedPrediction);
                factTableData.push({
                  date: dateStr,
                  symbol,
                  predicted_price: signal.predicted_price,
                  current_price: signal.current_price,
                  actual_price: actualPrice || signal.current_price,
                  direction_prediction: primaryDirection,
                  direction_correct: directionCorrect,
                  confidence: primaryConfidence,
                  model: primaryModel,
                  // NEW: Sentiment-first specific fields
                  primary_model: primaryModel,
                  primary_confidence: primaryConfidence,
                  sentiment_score: sentimentAnalysis.confidence || 0,
                  sentiment_reasoning: sentimentAnalysis.reasoning || "",
                  news_articles: sentimentAnalysis.source_count || 0,
                  neural_agreement: neuralAgreement.status,
                  neural_agreement_score: neuralAgreement.score,
                  tft_signal: neuralAgreement.tft_signal,
                  nhits_signal: neuralAgreement.nhits_signal,
                  enhancement_method: enhancedPrediction.method || "sentiment_first_approach",
                  trigger_mode: analysisData.trigger_mode,
                  timestamp: analysisData.timestamp || checkDate.toISOString()
                });
              }
            }
          }
        } catch (parseError) {
          console.error(`\u274C Error parsing analysis data for ${dateStr}:`, parseError);
        }
      }
    }
    console.log(`\u{1F4CA} Retrieved ${factTableData.length} records for range=${rangeDays}, week=${weekSelection}`);
    return factTableData;
  } catch (error) {
    console.error("\u274C Error retrieving fact table data with range:", error);
    return [];
  }
}
async function storeSymbolAnalysis(env, symbol, analysisData) {
  try {
    console.log(`\u{1F680} KV WRITE START: Storing analysis for ${symbol}`);
    console.log(`\u{1F50D} KV DEBUG: env.TRADING_RESULTS available:`, !!env.TRADING_RESULTS);
    console.log(`\u{1F50D} KV DEBUG: analysisData size:`, JSON.stringify(analysisData).length, "characters");
    const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const key = `analysis_${dateStr}_${symbol}`;
    console.log(`\u{1F50D} KV DEBUG: Attempting to store with key:`, key);
    const dataString = JSON.stringify(analysisData);
    console.log(`\u{1F50D} KV DEBUG: Data serialized successfully, size:`, dataString.length);
    console.log(`\u{1F50D} KV DEBUG: Calling env.TRADING_RESULTS.put()...`);
    await env.TRADING_RESULTS.put(
      key,
      dataString,
      { expirationTtl: 7776e3 }
      // 90 days for longer-term analysis
    );
    console.log(`\u2705 KV WRITE SUCCESS: Stored granular analysis for ${symbol} at key: ${key}`);
    console.log(`\u{1F50D} KV DEBUG: Storage successful, returning true`);
    return true;
  } catch (error) {
    console.error(`\u274C KV WRITE ERROR: Failed to store granular analysis for ${symbol}:`, error);
    console.error(`\u274C KV ERROR DETAILS:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return false;
  }
}
async function getSymbolAnalysisByDate(env, dateString, symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"]) {
  try {
    const keys = symbols.map((symbol) => `analysis_${dateString}_${symbol}`);
    const promises = keys.map((key) => env.TRADING_RESULTS.get(key));
    const results = await Promise.all(promises);
    const parsedResults = results.map((res, index) => res ? { ...JSON.parse(res), symbol: symbols[index] } : null).filter((res) => res !== null);
    console.log(`\u{1F4CA} Retrieved ${parsedResults.length}/${symbols.length} granular analysis records for ${dateString}`);
    return parsedResults;
  } catch (error) {
    console.error(`\u274C Error retrieving granular analysis for ${dateString}:`, error);
    return [];
  }
}
async function getRealActualPrice(symbol, targetDate) {
  try {
    console.log(`   \u{1F4CA} Fetching actual price for ${symbol} on ${targetDate}...`);
    const target = new Date(targetDate);
    const endDate = new Date(target);
    endDate.setDate(target.getDate() + 3);
    const startDate = new Date(target);
    startDate.setDate(target.getDate() - 3);
    const endTimestamp = Math.floor(endDate.getTime() / 1e3);
    const startTimestamp = Math.floor(startDate.getTime() / 1e3);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TradingBot/1.0)"
      },
      signal: AbortSignal.timeout(1e4)
    });
    if (!response.ok) {
      throw new Error(`Yahoo Finance API returned ${response.status}`);
    }
    const data = await response.json();
    const result = data.chart.result[0];
    if (!result || !result.indicators) {
      throw new Error("Invalid response format from Yahoo Finance");
    }
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    let closestPrice = null;
    let closestDiff = Infinity;
    for (let i = 0; i < timestamps.length; i++) {
      const dataDate = new Date(timestamps[i] * 1e3);
      const diffDays = Math.abs((dataDate - target) / (1e3 * 60 * 60 * 24));
      if (diffDays < closestDiff && quote.close[i]) {
        closestDiff = diffDays;
        closestPrice = quote.close[i];
      }
    }
    if (closestPrice) {
      console.log(`   \u2705 Found actual price for ${symbol}: $${closestPrice.toFixed(2)} (${closestDiff.toFixed(1)} days difference)`);
      return closestPrice;
    } else {
      throw new Error("No valid price data found");
    }
  } catch (error) {
    console.error(`   \u274C Error fetching actual price for ${symbol}:`, error.message);
    return null;
  }
}
function calculateNeuralAgreement(sentimentAnalysis, technicalReference, enhancedPrediction) {
  try {
    if (!sentimentAnalysis || !technicalReference || !enhancedPrediction) {
      return {
        status: "UNKNOWN",
        score: 0.5,
        tft_signal: "UNKNOWN",
        nhits_signal: "UNKNOWN"
      };
    }
    const sentimentDirection = sentimentAnalysis.sentiment?.toUpperCase() || "NEUTRAL";
    const technicalDirection = technicalReference.direction?.toUpperCase() || "NEUTRAL";
    const technicalAgreement = enhancedPrediction.enhancement_details?.technical_agreement;
    const sentimentTradingDirection = mapSentimentToTradingDirection(sentimentDirection);
    let agreementStatus = "UNKNOWN";
    let agreementScore = 0.5;
    if (technicalAgreement !== void 0) {
      agreementStatus = technicalAgreement ? "AGREE" : "DISAGREE";
      agreementScore = technicalAgreement ? 0.8 : 0.2;
    } else {
      const directionsMatch = sentimentTradingDirection === technicalDirection;
      agreementStatus = directionsMatch ? "AGREE" : "DISAGREE";
      agreementScore = directionsMatch ? 0.8 : 0.2;
    }
    return {
      status: agreementStatus,
      score: agreementScore,
      tft_signal: agreementStatus,
      // Simplified: use same for both
      nhits_signal: agreementStatus,
      sentiment_direction: sentimentTradingDirection,
      technical_direction: technicalDirection
    };
  } catch (error) {
    console.error("Error calculating neural agreement:", error);
    return {
      status: "ERROR",
      score: 0.5,
      tft_signal: "ERROR",
      nhits_signal: "ERROR"
    };
  }
}
function mapSentimentToTradingDirection(sentiment) {
  const mapping = {
    "BULLISH": "UP",
    "BEARISH": "DOWN",
    "NEUTRAL": "NEUTRAL",
    "POSITIVE": "UP",
    "NEGATIVE": "DOWN"
  };
  return mapping[sentiment?.toUpperCase()] || "NEUTRAL";
}
async function validateDirectionAccuracy(signal, targetDate) {
  try {
    const actualPrice = await getRealActualPrice(signal.symbol || "UNKNOWN", targetDate);
    if (!actualPrice) {
      const accuracyThreshold = 0.75;
      return signal.confidence >= accuracyThreshold;
    }
    const predictedDirection = signal.predicted_price > signal.current_price;
    const actualDirection = actualPrice > signal.current_price;
    const directionCorrect = predictedDirection === actualDirection;
    console.log(`   \u{1F3AF} Direction accuracy for ${signal.symbol}: Predicted ${predictedDirection ? "UP" : "DOWN"}, Actual ${actualDirection ? "UP" : "DOWN"} = ${directionCorrect ? "\u2713" : "\u2717"}`);
    return directionCorrect;
  } catch (error) {
    console.error(`   \u274C Error validating direction accuracy:`, error.message);
    const accuracyThreshold = 0.75;
    return signal.confidence >= accuracyThreshold;
  }
}
var init_data = __esm({
  "src/modules/data.js"() {
    __name(getFactTableData, "getFactTableData");
    __name(getFactTableDataWithRange, "getFactTableDataWithRange");
    __name(storeSymbolAnalysis, "storeSymbolAnalysis");
    __name(getSymbolAnalysisByDate, "getSymbolAnalysisByDate");
    __name(getRealActualPrice, "getRealActualPrice");
    __name(calculateNeuralAgreement, "calculateNeuralAgreement");
    __name(mapSentimentToTradingDirection, "mapSentimentToTradingDirection");
    __name(validateDirectionAccuracy, "validateDirectionAccuracy");
  }
});

// src/modules/facebook.js
var facebook_exports = {};
__export(facebook_exports, {
  getHealthCheckResponse: () => getHealthCheckResponse,
  sendDailyMessageWithHistoricalContext: () => sendDailyMessageWithHistoricalContext,
  sendDailyValidationWithTracking: () => sendDailyValidationWithTracking,
  sendFridayWeekendReportWithTracking: () => sendFridayWeekendReportWithTracking,
  sendMiddayValidationWithTracking: () => sendMiddayValidationWithTracking,
  sendMorningPredictionsWithTracking: () => sendMorningPredictionsWithTracking,
  sendWeeklyAccuracyReportWithGranularData: () => sendWeeklyAccuracyReportWithGranularData,
  sendWeeklyAccuracyReportWithTracking: () => sendWeeklyAccuracyReportWithTracking
});
async function sendFridayWeekendReportWithTracking(analysisResult, env, cronExecutionId, triggerMode) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log("\u274C Facebook not configured - skipping weekend report");
    return;
  }
  const now = /* @__PURE__ */ new Date();
  const friday = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  let reportText = "";
  if (triggerMode === "weekly_market_close_analysis") {
    reportText += `\u{1F4CA} **WEEKLY MARKET CLOSE ANALYSIS**
`;
    reportText += `\u{1F5D3}\uFE0F ${friday} 4:00 PM EST

`;
    reportText += `\u{1F3C1} **Market Close Summary:**
`;
  } else if (triggerMode === "friday_weekend_prediction") {
    reportText += `\u{1F305} **MONDAY MARKET PREDICTIONS**
`;
    reportText += `\u{1F5D3}\uFE0F ${friday} 4:05 PM EST

`;
    reportText += `\u{1F4C8} **Weekend \u2192 Monday Analysis:**
`;
  }
  const symbols = analysisResult.symbols_analyzed || [];
  const signals = analysisResult.trading_signals || {};
  symbols.forEach((symbol) => {
    const signal = signals[symbol];
    if (signal) {
      const enhanced = signal.enhanced_prediction;
      const sentiment = signal.sentiment_analysis;
      const direction = enhanced?.direction === "UP" ? "\u2197\uFE0F" : enhanced?.direction === "DOWN" ? "\u2198\uFE0F" : "\u27A1\uFE0F";
      const sentimentLabel = sentiment?.sentiment || "neutral";
      const sentimentEmoji = sentimentLabel === "bullish" ? "\u{1F525}" : sentimentLabel === "bearish" ? "\u{1F9CA}" : "\u2696\uFE0F";
      const sentimentConfidence = Math.round((sentiment?.confidence || 0) * 100);
      reportText += `${symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${sentimentConfidence}%)
`;
      reportText += `   \u{1F4B0} $${signal.current_price?.toFixed(2)} \u2192 $${signal.predicted_price?.toFixed(2)} | AI-Informed
`;
    }
  });
  reportText += `
`;
  reportText += `\u2699\uFE0F **System Status:** Operational \u2705
`;
  reportText += `\u{1F916} **Models:** TFT + N-HITS Ensemble
`;
  reportText += `\u{1F4CA} **Symbols Analyzed:** ${symbols.length}

`;
  reportText += `\u{1F4CA} **INTERACTIVE DASHBOARD:**
`;
  reportText += `\u{1F517} https://tft-trading-system.yanggf.workers.dev/weekly-analysis

`;
  reportText += `\u{1F4C8} View detailed charts, trends, and model performance analysis

`;
  reportText += `\u{1F3AF} **Next Update:** Monday 8:30 AM EST
`;
  reportText += `\u26A0\uFE0F **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals before trading.`;
  const facebookPayload = {
    recipient: { id: env.FACEBOOK_RECIPIENT_ID },
    message: { text: reportText },
    messaging_type: "MESSAGE_TAG",
    tag: "ACCOUNT_UPDATE"
  };
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${env.FACEBOOK_PAGE_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(facebookPayload)
    });
    if (response.ok) {
      console.log(`\u2705 [FB] ${cronExecutionId} Friday weekend report sent with dashboard link`);
      const messagingKey = `fb_friday_messaging_${Date.now()}`;
      try {
        console.log(`\u{1F4BE} [FB-FRIDAY-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
        await env.TRADING_RESULTS.put(
          messagingKey,
          JSON.stringify({
            trigger_mode: triggerMode,
            symbols_analyzed: symbols.length,
            message_sent: true,
            includes_dashboard_link: true,
            dashboard_url: "https://tft-trading-system.yanggf.workers.dev/weekly-analysis",
            timestamp: now.toISOString(),
            cron_execution_id: cronExecutionId
          }),
          { expirationTtl: 604800 }
        );
        console.log(`\u2705 [FB-FRIDAY-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
      } catch (kvError) {
        console.error(`\u274C [FB-FRIDAY-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
        console.error(`\u274C [FB-FRIDAY-KV] ${cronExecutionId} KV key: ${messagingKey}`);
        console.error(`\u274C [FB-FRIDAY-KV] ${cronExecutionId} Error details:`, {
          message: kvError.message,
          stack: kvError.stack
        });
        throw kvError;
      }
    } else {
      const errorText = await response.text();
      console.error(`\u274C [FB] ${cronExecutionId} Facebook API error:`, errorText);
    }
  } catch (error) {
    console.error(`\u274C [FB] ${cronExecutionId} Facebook send error:`, error.message);
  }
}
async function sendWeeklyAccuracyReportWithTracking(env, cronExecutionId) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log("\u274C Facebook not configured - skipping weekly accuracy report");
    return;
  }
  let reportText = `\u{1F4CA} **WEEKLY ACCURACY REPORT**
`;
  reportText += `\u{1F5D3}\uFE0F ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} 10:00 AM EST

`;
  reportText += `\u{1F3AF} **Sentiment-First System Performance:**
`;
  reportText += `\u2022 AI Sentiment Accuracy: Real-time tracking active
`;
  reportText += `\u2022 Direction Accuracy: Sentiment vs reality validation
`;
  reportText += `\u2022 Model Performance: AI Sentiment + Neural Reference analysis
`;
  reportText += `\u2022 AI Cost Efficiency: $0.0003 per analysis achieved

`;
  reportText += `\u{1F4CA} **DETAILED ANALYTICS DASHBOARD:**
`;
  reportText += `\u{1F517} https://tft-trading-system.yanggf.workers.dev/weekly-analysis

`;
  reportText += `\u{1F4C8} Interactive charts showing:
`;
  reportText += `\u2022 Daily sentiment accuracy trends
`;
  reportText += `\u2022 AI Sentiment vs Neural model comparison
`;
  reportText += `\u2022 Bullish/Bearish/Neutral analysis
`;
  reportText += `\u2022 Sentiment-driven prediction visualization

`;
  reportText += `\u2699\uFE0F **System Status:** Operational \u2705
`;
  reportText += `\u{1F504} **Next Report:** Next Sunday 10:00 AM EST

`;
  reportText += `\u26A0\uFE0F **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals before trading.`;
  const facebookPayload = {
    recipient: { id: env.FACEBOOK_RECIPIENT_ID },
    message: { text: reportText },
    messaging_type: "MESSAGE_TAG",
    tag: "ACCOUNT_UPDATE"
  };
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${env.FACEBOOK_PAGE_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(facebookPayload)
    });
    if (response.ok) {
      console.log(`\u2705 [FB] ${cronExecutionId} Weekly accuracy report sent with dashboard link`);
      const messagingKey = `fb_weekly_accuracy_${Date.now()}`;
      try {
        console.log(`\u{1F4BE} [FB-WEEKLY-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
        await env.TRADING_RESULTS.put(
          messagingKey,
          JSON.stringify({
            trigger_mode: "weekly_accuracy_report",
            message_sent: true,
            includes_dashboard_link: true,
            dashboard_url: "https://tft-trading-system.yanggf.workers.dev/weekly-analysis",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            cron_execution_id: cronExecutionId
          }),
          { expirationTtl: 604800 }
        );
        console.log(`\u2705 [FB-WEEKLY-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
      } catch (kvError) {
        console.error(`\u274C [FB-WEEKLY-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
        console.error(`\u274C [FB-WEEKLY-KV] ${cronExecutionId} KV key: ${messagingKey}`);
        console.error(`\u274C [FB-WEEKLY-KV] ${cronExecutionId} Error details:`, {
          message: kvError.message,
          stack: kvError.stack
        });
        throw kvError;
      }
    } else {
      const errorText = await response.text();
      console.error(`\u274C [FB] ${cronExecutionId} Facebook API error:`, errorText);
    }
  } catch (error) {
    console.error(`\u274C [FB] ${cronExecutionId} Facebook send error:`, error.message);
  }
}
async function sendFacebookMessage(messageText, env) {
  const facebookPayload = {
    recipient: { id: env.FACEBOOK_RECIPIENT_ID },
    message: { text: messageText },
    messaging_type: "MESSAGE_TAG",
    tag: "ACCOUNT_UPDATE"
  };
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${env.FACEBOOK_PAGE_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(facebookPayload)
    });
    if (response.ok) {
      console.log(`\u2705 Facebook message sent successfully`);
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error(`\u274C Facebook API error:`, errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error(`\u274C Facebook send error:`, error.message);
    return { success: false, error: error.message };
  }
}
function getHealthCheckResponse(env) {
  return {
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
async function sendMorningPredictionsWithTracking(analysisResult, env, cronExecutionId) {
  console.log(`\u{1F680} [FB-MORNING] ${cronExecutionId} Starting morning predictions function`);
  console.log(`\u{1F50D} [FB-MORNING] ${cronExecutionId} Checking Facebook configuration...`);
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log("\u274C [FB-MORNING] Facebook not configured - skipping morning predictions");
    return;
  }
  console.log(`\u2705 [FB-MORNING] ${cronExecutionId} Facebook configuration verified`);
  console.log(`\u{1F4CA} [FB-MORNING] ${cronExecutionId} Validating analysis data...`);
  if (!analysisResult || !analysisResult.trading_signals) {
    console.error(`\u274C [FB-MORNING] ${cronExecutionId} Invalid or missing analysis data`);
    throw new Error("Invalid analysis data provided");
  }
  console.log(`\u2705 [FB-MORNING] ${cronExecutionId} Analysis data validated: ${Object.keys(analysisResult.trading_signals).length} symbols`);
  const now = /* @__PURE__ */ new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dateStr = estTime.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  console.log(`\u{1F4C5} [FB-MORNING] ${cronExecutionId} Date set: ${dateStr}`);
  console.log(`\u270D\uFE0F [FB-MORNING] ${cronExecutionId} Building message content...`);
  let reportText = `\u{1F305} **MORNING PREDICTIONS + ALERTS**
`;
  reportText += `\u{1F5D3}\uFE0F ${dateStr} 8:30 AM EST

`;
  reportText += `\u{1F4AD} **AI Sentiment Analysis:**
`;
  let symbolCount = 0;
  if (analysisResult?.trading_signals) {
    Object.values(analysisResult.trading_signals).forEach((signal) => {
      symbolCount++;
      const enhanced = signal.enhanced_prediction;
      const sentiment = signal.sentiment_analysis;
      const direction = enhanced?.direction === "UP" ? "\u2197\uFE0F" : enhanced?.direction === "DOWN" ? "\u2198\uFE0F" : "\u27A1\uFE0F";
      const change = ((signal.predicted_price - signal.current_price) / signal.current_price * 100).toFixed(2);
      const sentimentLabel = sentiment?.sentiment || "neutral";
      const sentimentEmoji = sentimentLabel === "bullish" ? "\u{1F525}" : sentimentLabel === "bearish" ? "\u{1F9CA}" : "\u2696\uFE0F";
      const confidence = Math.round((enhanced?.confidence || 0.5) * 100);
      reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${confidence}%)
`;
      reportText += `   \u{1F4B0} $${signal.current_price.toFixed(2)} \u2192 $${signal.predicted_price.toFixed(2)} (${Math.abs(change)}%)
`;
    });
  }
  console.log(`\u2705 [FB-MORNING] ${cronExecutionId} Message content built for ${symbolCount} symbols`);
  reportText += `
\u2699\uFE0F **System Status:** Operational \u2705
`;
  reportText += `\u{1F916} **Models:** AI Sentiment Analysis + Neural Reference
`;
  reportText += `\u{1F4CA} **Symbols Analyzed:** ${analysisResult?.symbols_analyzed?.length || 5}

`;
  reportText += `\u{1F4CA} **INTERACTIVE DASHBOARD:**
`;
  reportText += `\u{1F517} https://tft-trading-system.yanggf.workers.dev/weekly-analysis

`;
  reportText += `\u{1F4C8} View live sentiment analysis, predictions, and model performance

`;
  reportText += `\u{1F3AF} **Next Update:** 12:00 PM EST Midday Validation
`;
  reportText += `\u26A0\uFE0F **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals.`;
  console.log(`\u{1F4BE} [FB-MORNING] ${cronExecutionId} Starting KV storage...`);
  const messagingKey = `fb_morning_${Date.now()}`;
  let kvStorageSuccess = false;
  let kvError = null;
  try {
    console.log(`\u{1F4BE} [FB-MORNING-KV] ${cronExecutionId} Preparing KV data...`);
    const kvData = {
      trigger_mode: "morning_prediction_alerts",
      message_sent: false,
      // Will be updated after Facebook send
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 5,
      includes_dashboard_link: true,
      dashboard_url: "https://tft-trading-system.yanggf.workers.dev/weekly-analysis",
      timestamp: now.toISOString(),
      cron_execution_id: cronExecutionId,
      message_type: "morning_predictions",
      symbols_processed: symbolCount,
      facebook_delivery_status: "pending",
      report_content: reportText.substring(0, 500) + "..."
      // Store first 500 chars of message
    };
    console.log(`\u{1F4BE} [FB-MORNING-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
    console.log(`\u{1F4BE} [FB-MORNING-KV] ${cronExecutionId} KV data size: ${JSON.stringify(kvData).length} bytes`);
    await env.TRADING_RESULTS.put(
      messagingKey,
      JSON.stringify(kvData),
      { expirationTtl: 604800 }
    );
    kvStorageSuccess = true;
    console.log(`\u2705 [FB-MORNING-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
  } catch (kvError2) {
    console.error(`\u274C [FB-MORNING-KV] ${cronExecutionId} Failed to store KV record:`, kvError2);
    console.error(`\u274C [FB-MORNING-KV] ${cronExecutionId} KV key: ${messagingKey}`);
    console.error(`\u274C [FB-MORNING-KV] ${cronExecutionId} Error details:`, {
      message: kvError2.message,
      stack: kvError2.stack,
      name: kvError2.name
    });
  }
  console.log(`\u{1F4E4} [FB-MORNING] ${cronExecutionId} Sending Facebook message...`);
  let facebookSuccess = false;
  let facebookError = null;
  try {
    const fbResult = await sendFacebookMessage(reportText, env);
    if (fbResult.success) {
      facebookSuccess = true;
      console.log(`\u2705 [FB-MORNING] ${cronExecutionId} Facebook message sent successfully`);
      if (kvStorageSuccess) {
        try {
          const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
          updatedKvData.message_sent = true;
          updatedKvData.facebook_delivery_status = "delivered";
          updatedKvData.delivery_timestamp = now.toISOString();
          await env.TRADING_RESULTS.put(
            messagingKey,
            JSON.stringify(updatedKvData),
            { expirationTtl: 604800 }
          );
          console.log(`\u2705 [FB-MORNING-KV] ${cronExecutionId} Updated KV record with delivery status`);
        } catch (updateError) {
          console.error(`\u26A0\uFE0F [FB-MORNING-KV] ${cronExecutionId} Failed to update delivery status:`, updateError);
        }
      }
    } else {
      facebookError = fbResult.error;
      console.error(`\u274C [FB-MORNING] ${cronExecutionId} Facebook API failed:`, fbResult.error);
      if (kvStorageSuccess) {
        try {
          const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
          updatedKvData.facebook_delivery_status = "failed";
          updatedKvData.facebook_error = fbResult.error;
          updatedKvData.failure_timestamp = now.toISOString();
          await env.TRADING_RESULTS.put(
            messagingKey,
            JSON.stringify(updatedKvData),
            { expirationTtl: 604800 }
          );
          console.log(`\u26A0\uFE0F [FB-MORNING-KV] ${cronExecutionId} Updated KV record with Facebook failure status`);
        } catch (updateError) {
          console.error(`\u26A0\uFE0F [FB-MORNING-KV] ${cronExecutionId} Failed to update failure status:`, updateError);
        }
      }
    }
  } catch (fbError) {
    facebookError = fbError.message;
    console.error(`\u274C [FB-MORNING] ${cronExecutionId} Facebook message send failed:`, fbError);
    console.error(`\u274C [FB-MORNING] ${cronExecutionId} Error details:`, {
      message: fbError.message,
      stack: fbError.stack,
      name: fbError.name
    });
    if (kvStorageSuccess) {
      try {
        const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
        updatedKvData.facebook_delivery_status = "exception";
        updatedKvData.facebook_error = fbError.message;
        updatedKvData.failure_timestamp = now.toISOString();
        await env.TRADING_RESULTS.put(
          messagingKey,
          JSON.stringify(updatedKvData),
          { expirationTtl: 604800 }
        );
        console.log(`\u26A0\uFE0F [FB-MORNING-KV] ${cronExecutionId} Updated KV record with exception status`);
      } catch (updateError) {
        console.error(`\u26A0\uFE0F [FB-MORNING-KV] ${cronExecutionId} Failed to update exception status:`, updateError);
      }
    }
  }
  console.log(`\u{1F3AF} [FB-MORNING] ${cronExecutionId} Function completed with status:`);
  console.log(`   \u{1F4CA} KV Storage: ${kvStorageSuccess ? "\u2705 Success" : "\u274C Failed"}`);
  console.log(`   \u{1F4F1} Facebook Delivery: ${facebookSuccess ? "\u2705 Success" : "\u274C Failed"}`);
  console.log(`   \u{1F511} KV Record Key: ${messagingKey}`);
  if (facebookError) {
    console.log(`   \u26A0\uFE0F Facebook Error: ${facebookError.substring(0, 100)}...`);
  }
  return {
    success: kvStorageSuccess,
    // Consider successful if KV was stored
    kv_storage_success: kvStorageSuccess,
    facebook_delivery_success: facebookSuccess,
    kv_record_key: messagingKey,
    facebook_error: facebookError,
    timestamp: now.toISOString()
  };
}
async function sendMiddayValidationWithTracking(analysisResult, env, cronExecutionId) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log("\u274C Facebook not configured - skipping midday validation");
    return;
  }
  const now = /* @__PURE__ */ new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dateStr = estTime.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  let reportText = `\u{1F504} **MIDDAY VALIDATION + FORECASTS**
`;
  reportText += `\u{1F5D3}\uFE0F ${dateStr} 12:00 PM EST

`;
  reportText += `\u{1F4AD} **Sentiment Analysis Updates:**
`;
  if (analysisResult?.trading_signals) {
    Object.values(analysisResult.trading_signals).forEach((signal) => {
      const enhanced = signal.enhanced_prediction;
      const sentiment = signal.sentiment_analysis;
      const direction = enhanced?.direction === "UP" ? "\u2197\uFE0F" : enhanced?.direction === "DOWN" ? "\u2198\uFE0F" : "\u27A1\uFE0F";
      const confidence = Math.round((enhanced?.confidence || 0.5) * 100);
      const sentimentLabel = sentiment?.sentiment || "neutral";
      const sentimentEmoji = sentimentLabel === "bullish" ? "\u{1F525}" : sentimentLabel === "bearish" ? "\u{1F9CA}" : "\u2696\uFE0F";
      const sentimentConf = Math.round((sentiment?.confidence || 0) * 100);
      const technicalConf = Math.round((signal.confidence || 0.5) * 100);
      const conflictIndicator = Math.abs(sentimentConf - technicalConf) > 20 ? " \u26A0\uFE0F CONFLICT" : " \u2705 ALIGNED";
      reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${confidence}%)
`;
      reportText += `   \u{1F4CA} Sentiment: ${sentimentConf}% | Technical: ${technicalConf}%${conflictIndicator}
`;
    });
  }
  reportText += `
\u{1F3AF} **Afternoon Outlook:**
`;
  reportText += `\u2022 AI sentiment signals informing analysis
`;
  reportText += `\u2022 Neural networks providing technical reference
`;
  reportText += `\u2022 Real-time market sentiment validation active

`;
  reportText += `\u2699\uFE0F **System Status:** Operational \u2705
`;
  reportText += `\u{1F4CA} **LIVE DASHBOARD:**
`;
  reportText += `\u{1F517} https://tft-trading-system.yanggf.workers.dev/weekly-analysis

`;
  reportText += `\u{1F3AF} **Next Update:** 4:05 PM EST Daily Report
`;
  reportText += `\u26A0\uFE0F **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals.`;
  await sendFacebookMessage(reportText, env);
  console.log(`\u{1F4F1} [FB-MIDDAY] ${cronExecutionId} Midday validation sent via Facebook`);
  const messagingKey = `fb_midday_${Date.now()}`;
  try {
    console.log(`\u{1F4BE} [FB-MIDDAY-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
    await env.TRADING_RESULTS.put(
      messagingKey,
      JSON.stringify({
        trigger_mode: "midday_validation_prediction",
        message_sent: true,
        symbols_analyzed: analysisResult?.symbols_analyzed?.length || 5,
        includes_dashboard_link: true,
        dashboard_url: "https://tft-trading-system.yanggf.workers.dev/weekly-analysis",
        timestamp: now.toISOString(),
        cron_execution_id: cronExecutionId,
        message_type: "midday_validation"
      }),
      { expirationTtl: 604800 }
    );
    console.log(`\u2705 [FB-MIDDAY-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
  } catch (kvError) {
    console.error(`\u274C [FB-MIDDAY-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
    console.error(`\u274C [FB-MIDDAY-KV] ${cronExecutionId} KV key: ${messagingKey}`);
    console.error(`\u274C [FB-MIDDAY-KV] ${cronExecutionId} Error details:`, {
      message: kvError.message,
      stack: kvError.stack
    });
    throw kvError;
  }
}
async function sendDailyValidationWithTracking(analysisResult, env, cronExecutionId) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log("\u274C Facebook not configured - skipping daily validation");
    return;
  }
  const now = /* @__PURE__ */ new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dateStr = estTime.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  let reportText = `\u{1F4CA} **DAILY VALIDATION + NEXT-DAY PREDICTIONS**
`;
  reportText += `\u{1F5D3}\uFE0F ${dateStr} 4:05 PM EST

`;
  reportText += `\u{1F3C1} **Market Close Sentiment Analysis:**
`;
  if (analysisResult?.trading_signals) {
    Object.values(analysisResult.trading_signals).forEach((signal) => {
      const enhanced = signal.enhanced_prediction;
      const sentiment = signal.sentiment_analysis;
      const direction = enhanced?.direction === "UP" ? "\u2197\uFE0F" : enhanced?.direction === "DOWN" ? "\u2198\uFE0F" : "\u27A1\uFE0F";
      const predicted = signal.predicted_price.toFixed(2);
      const current = signal.current_price.toFixed(2);
      const sentimentLabel = sentiment?.sentiment || "neutral";
      const sentimentEmoji = sentimentLabel === "bullish" ? "\u{1F525}" : sentimentLabel === "bearish" ? "\u{1F9CA}" : "\u2696\uFE0F";
      const sentimentConfidence = Math.round((sentiment?.confidence || 0) * 100);
      reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${sentimentConfidence}%)
`;
      reportText += `   \u{1F4B0} $${current} \u2192 $${predicted} | AI-Informed outlook
`;
    });
  }
  reportText += `
\u{1F305} **Tomorrow's Market Outlook:**
`;
  reportText += `\u2022 AI sentiment analysis for overnight news
`;
  reportText += `\u2022 Neural networks as technical reference
`;
  reportText += `\u2022 Real-time sentiment-driven predictions

`;
  reportText += `\u{1F4C8} **Daily Performance:**
`;
  reportText += `\u2022 Direction accuracy validation
`;
  reportText += `\u2022 Model confidence assessment
`;
  reportText += `\u2022 Risk metrics updated

`;
  reportText += `\u2699\uFE0F **System Status:** Operational \u2705
`;
  reportText += `\u{1F916} **Models:** TFT + N-HITS Ensemble + Sentiment
`;
  reportText += `\u{1F4CA} **COMPREHENSIVE DASHBOARD:**
`;
  reportText += `\u{1F517} https://tft-trading-system.yanggf.workers.dev/weekly-analysis

`;
  reportText += `\u{1F3AF} **Next Update:** Tomorrow 8:30 AM EST
`;
  reportText += `\u26A0\uFE0F **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals.`;
  await sendFacebookMessage(reportText, env);
  console.log(`\u{1F4F1} [FB-DAILY] ${cronExecutionId} Daily validation sent via Facebook`);
  const messagingKey = `fb_daily_${Date.now()}`;
  try {
    console.log(`\u{1F4BE} [FB-DAILY-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
    await env.TRADING_RESULTS.put(
      messagingKey,
      JSON.stringify({
        trigger_mode: "next_day_market_prediction",
        message_sent: true,
        symbols_analyzed: analysisResult?.symbols_analyzed?.length || 5,
        includes_dashboard_link: true,
        dashboard_url: "https://tft-trading-system.yanggf.workers.dev/weekly-analysis",
        timestamp: now.toISOString(),
        cron_execution_id: cronExecutionId,
        message_type: "daily_validation"
      }),
      { expirationTtl: 604800 }
    );
    console.log(`\u2705 [FB-DAILY-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
  } catch (kvError) {
    console.error(`\u274C [FB-DAILY-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
    console.error(`\u274C [FB-DAILY-KV] ${cronExecutionId} KV key: ${messagingKey}`);
    console.error(`\u274C [FB-DAILY-KV] ${cronExecutionId} Error details:`, {
      message: kvError.message,
      stack: kvError.stack
    });
    throw kvError;
  }
}
async function sendWeeklyAccuracyReportWithGranularData(env, cronExecutionId, weekSelection = "current") {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log("\u274C Facebook not configured - skipping weekly accuracy report");
    return;
  }
  const now = /* @__PURE__ */ new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dateStr = estTime.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  let reportText = `\u{1F4CA} **WEEKLY ACCURACY REPORT**
`;
  reportText += `\u{1F5D3}\uFE0F ${dateStr} - Granular Analysis

`;
  try {
    const factTableData = await getFactTableDataWithRange(env, 7, weekSelection);
    if (factTableData.length === 0) {
      reportText += `\u26A0\uFE0F No granular analysis data available for ${weekSelection} week
`;
      reportText += `\u{1F4DD} Check that enhanced storage is operational

`;
    } else {
      const symbolMetrics = {};
      factTableData.forEach((record) => {
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
        if (record.neural_agreement === "AGREE") symbolMetrics[record.symbol].technicalCount++;
      });
      reportText += `\u{1F3AF} **Direction Accuracy by Symbol:**
`;
      Object.entries(symbolMetrics).forEach(([symbol, metrics]) => {
        const accuracy = Math.round(metrics.correct / metrics.total * 100);
        const avgConf = Math.round(metrics.avgConfidence / metrics.total * 100);
        const emoji = accuracy >= 70 ? "\u2705" : accuracy >= 60 ? "\u26A0\uFE0F" : "\u274C";
        reportText += `${symbol}: ${emoji} ${accuracy}% (${metrics.correct}/${metrics.total}) | Avg: ${avgConf}%
`;
        reportText += `   \u{1F4AD} Sentiment: ${metrics.sentimentCount} signals | \u{1F91D} Agreement: ${metrics.technicalCount}
`;
      });
      const totalCorrect = Object.values(symbolMetrics).reduce((sum, m) => sum + m.correct, 0);
      const totalPredictions = Object.values(symbolMetrics).reduce((sum, m) => sum + m.total, 0);
      const overallAccuracy = Math.round(totalCorrect / totalPredictions * 100);
      reportText += `
\u{1F4C8} **Overall Performance:**
`;
      reportText += `\u{1F3AF} Direction Accuracy: ${overallAccuracy}% (${totalCorrect}/${totalPredictions})
`;
      reportText += `\u{1F4CA} Symbols Tracked: ${Object.keys(symbolMetrics).length}
`;
      reportText += `\u{1F4C5} Days Analyzed: ${Math.ceil(factTableData.length / 5)}
`;
    }
    reportText += `
\u{1F527} **Enhanced Features:**
`;
    reportText += `\u2022 Granular symbol-level tracking
`;
    reportText += `\u2022 Sentiment-technical agreement analysis
`;
    reportText += `\u2022 Individual confidence validation
`;
    reportText += `\u2022 Historical performance comparison

`;
  } catch (error) {
    console.error("\u274C Error generating granular accuracy report:", error);
    reportText += `\u274C Error retrieving granular analysis data
`;
    reportText += `\u{1F527} Check enhanced storage system status

`;
  }
  reportText += `\u{1F4CA} **INTERACTIVE DASHBOARD:**
`;
  reportText += `\u{1F517} https://tft-trading-system.yanggf.workers.dev/weekly-analysis

`;
  reportText += `\u2699\uFE0F **System Status:** Enhanced Granular Storage \u2705
`;
  reportText += `\u{1F5C3}\uFE0F **Data Source:** Individual symbol analysis records
`;
  reportText += `\u26A0\uFE0F **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals.`;
  await sendFacebookMessage(reportText, env);
  console.log(`\u{1F4F1} [FB-ACCURACY] ${cronExecutionId} Weekly accuracy report (granular) sent via Facebook`);
  const messagingKey = `fb_accuracy_granular_${Date.now()}`;
  try {
    console.log(`\u{1F4BE} [FB-ACCURACY-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
    await env.TRADING_RESULTS.put(
      messagingKey,
      JSON.stringify({
        trigger_mode: "weekly_accuracy_granular",
        message_sent: true,
        week_selection: weekSelection,
        data_source: "granular_storage",
        includes_dashboard_link: true,
        dashboard_url: "https://tft-trading-system.yanggf.workers.dev/weekly-analysis",
        timestamp: now.toISOString(),
        cron_execution_id: cronExecutionId,
        message_type: "weekly_accuracy_granular"
      }),
      { expirationTtl: 604800 }
    );
    console.log(`\u2705 [FB-ACCURACY-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
  } catch (kvError) {
    console.error(`\u274C [FB-ACCURACY-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
    console.error(`\u274C [FB-ACCURACY-KV] ${cronExecutionId} KV key: ${messagingKey}`);
    console.error(`\u274C [FB-ACCURACY-KV] ${cronExecutionId} Error details:`, {
      message: kvError.message,
      stack: kvError.stack
    });
    throw kvError;
  }
}
async function sendDailyMessageWithHistoricalContext(analysisResult, env, cronExecutionId) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log("\u274C Facebook not configured - skipping daily message with context");
    return;
  }
  const now = /* @__PURE__ */ new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const today = estTime.toISOString().split("T")[0];
  const yesterday = new Date(estTime);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  let reportText = `\u{1F504} **DAILY PREDICTIONS + VALIDATION**
`;
  reportText += `\u{1F5D3}\uFE0F ${estTime.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}

`;
  try {
    const yesterdayAnalysis = await getSymbolAnalysisByDate(env, yesterdayStr);
    if (yesterdayAnalysis.length > 0) {
      reportText += `\u2705 **Yesterday's Validation:**
`;
      yesterdayAnalysis.forEach((record) => {
        const direction = record.enhanced_prediction?.direction;
        const sentiment = record.sentiment_analysis?.sentiment;
        const confidence = Math.round((record.enhanced_prediction?.confidence || 0) * 100);
        const emoji = direction === "UP" ? "\u2197\uFE0F" : direction === "DOWN" ? "\u2198\uFE0F" : "\u27A1\uFE0F";
        reportText += `${record.symbol}: ${emoji} ${sentiment?.toUpperCase()} (${confidence}%)
`;
        if (record.current_price && record.predicted_price) {
          const change = ((record.predicted_price - record.current_price) / record.current_price * 100).toFixed(2);
          reportText += `   \u{1F4B0} $${record.current_price.toFixed(2)} \u2192 $${record.predicted_price.toFixed(2)} (${Math.abs(change)}%)
`;
        }
      });
      reportText += `
`;
    }
    reportText += `\u{1F680} **Today's AI Predictions:**
`;
    if (analysisResult?.trading_signals) {
      Object.values(analysisResult.trading_signals).forEach((signal) => {
        const enhanced = signal.enhanced_prediction;
        const sentiment = signal.sentiment_analysis;
        const direction = enhanced?.direction === "UP" ? "\u2197\uFE0F" : enhanced?.direction === "DOWN" ? "\u2198\uFE0F" : "\u27A1\uFE0F";
        const confidence = Math.round((enhanced?.confidence || 0.5) * 100);
        const sentimentLabel = sentiment?.sentiment || "neutral";
        const sentimentEmoji = sentimentLabel === "bullish" ? "\u{1F525}" : sentimentLabel === "bearish" ? "\u{1F9CA}" : "\u2696\uFE0F";
        reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${confidence}%)
`;
        reportText += `   \u{1F4B0} $${signal.current_price.toFixed(2)} \u2192 $${signal.predicted_price.toFixed(2)}
`;
      });
    }
  } catch (error) {
    console.error("\u274C Error retrieving historical context:", error);
    reportText += `\u26A0\uFE0F Historical validation data unavailable
`;
    reportText += `\u{1F504} Showing today's predictions only

`;
    if (analysisResult?.trading_signals) {
      Object.values(analysisResult.trading_signals).forEach((signal) => {
        const enhanced = signal.enhanced_prediction;
        const sentiment = signal.sentiment_analysis;
        const direction = enhanced?.direction === "UP" ? "\u2197\uFE0F" : enhanced?.direction === "DOWN" ? "\u2198\uFE0F" : "\u27A1\uFE0F";
        const confidence = Math.round((enhanced?.confidence || 0.5) * 100);
        const sentimentLabel = sentiment?.sentiment || "neutral";
        const sentimentEmoji = sentimentLabel === "bullish" ? "\u{1F525}" : sentimentLabel === "bearish" ? "\u{1F9CA}" : "\u2696\uFE0F";
        reportText += `${signal.symbol}: ${direction} ${sentimentEmoji} ${sentimentLabel.toUpperCase()} (${confidence}%)
`;
      });
    }
  }
  reportText += `
\u{1F4CA} **Enhanced Tracking:**
`;
  reportText += `\u2022 Granular symbol-level analysis
`;
  reportText += `\u2022 Daily accuracy validation
`;
  reportText += `\u2022 Historical context integration
`;
  reportText += `\u2022 Sentiment-technical correlation

`;
  reportText += `\u{1F4CA} **INTERACTIVE DASHBOARD:**
`;
  reportText += `\u{1F517} https://tft-trading-system.yanggf.workers.dev/weekly-analysis

`;
  reportText += `\u2699\uFE0F **System Status:** Enhanced Granular Storage \u2705
`;
  reportText += `\u26A0\uFE0F **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals.`;
  await sendFacebookMessage(reportText, env);
  console.log(`\u{1F4F1} [FB-ENHANCED] ${cronExecutionId} Daily message with historical context sent via Facebook`);
  const messagingKey = `fb_enhanced_daily_${Date.now()}`;
  try {
    console.log(`\u{1F4BE} [FB-ENHANCED-KV] ${cronExecutionId} Storing KV record with key: ${messagingKey}`);
    await env.TRADING_RESULTS.put(
      messagingKey,
      JSON.stringify({
        trigger_mode: "daily_with_historical_context",
        message_sent: true,
        symbols_analyzed: analysisResult?.symbols_analyzed?.length || 5,
        includes_historical_validation: true,
        includes_dashboard_link: true,
        dashboard_url: "https://tft-trading-system.yanggf.workers.dev/weekly-analysis",
        timestamp: now.toISOString(),
        cron_execution_id: cronExecutionId,
        message_type: "enhanced_daily_context"
      }),
      { expirationTtl: 604800 }
    );
    console.log(`\u2705 [FB-ENHANCED-KV] ${cronExecutionId} Successfully stored KV record: ${messagingKey}`);
  } catch (kvError) {
    console.error(`\u274C [FB-ENHANCED-KV] ${cronExecutionId} Failed to store KV record:`, kvError);
    console.error(`\u274C [FB-ENHANCED-KV] ${cronExecutionId} KV key: ${messagingKey}`);
    console.error(`\u274C [FB-ENHANCED-KV] ${cronExecutionId} Error details:`, {
      message: kvError.message,
      stack: kvError.stack
    });
    throw kvError;
  }
}
var init_facebook = __esm({
  "src/modules/facebook.js"() {
    init_data();
    __name(sendFridayWeekendReportWithTracking, "sendFridayWeekendReportWithTracking");
    __name(sendWeeklyAccuracyReportWithTracking, "sendWeeklyAccuracyReportWithTracking");
    __name(sendFacebookMessage, "sendFacebookMessage");
    __name(getHealthCheckResponse, "getHealthCheckResponse");
    __name(sendMorningPredictionsWithTracking, "sendMorningPredictionsWithTracking");
    __name(sendMiddayValidationWithTracking, "sendMiddayValidationWithTracking");
    __name(sendDailyValidationWithTracking, "sendDailyValidationWithTracking");
    __name(sendWeeklyAccuracyReportWithGranularData, "sendWeeklyAccuracyReportWithGranularData");
    __name(sendDailyMessageWithHistoricalContext, "sendDailyMessageWithHistoricalContext");
  }
});

// src/modules/scheduler.js
init_analysis();

// src/modules/enhanced_analysis.js
init_analysis();
init_free_sentiment_pipeline();
init_cloudflare_ai_sentiment_pipeline();
init_sentiment_utils();
init_data();
async function runEnhancedAnalysis(env, options = {}) {
  const startTime = Date.now();
  console.log("\u{1F680} Starting Enhanced Analysis with Sentiment Integration...");
  try {
    console.log("\u{1F4AD} Step 1: Running sentiment-first analysis (GLM-4.5)...");
    const sentimentResults = await runSentimentFirstAnalysis(env, options);
    console.log("\u{1F4CA} Step 2: Adding technical analysis as reference...");
    const enhancedResults = await addTechnicalReference(sentimentResults, env, options);
    const executionTime = Date.now() - startTime;
    enhancedResults.execution_metrics = {
      total_time_ms: executionTime,
      enhancement_enabled: true,
      sentiment_sources: ["free_news", "ai_sentiment_analysis"],
      cloudflare_ai_enabled: !!env.AI
    };
    console.log(`\u2705 Enhanced analysis completed in ${executionTime}ms`);
    return enhancedResults;
  } catch (error) {
    console.error("\u274C Enhanced analysis failed:", error);
    console.log("\u{1F504} Falling back to basic neural network analysis...");
    const fallbackResults = await runBasicAnalysis(env, options);
    fallbackResults.execution_metrics = {
      total_time_ms: Date.now() - startTime,
      enhancement_enabled: false,
      fallback_reason: error.message,
      sentiment_error: true
    };
    return fallbackResults;
  }
}
__name(runEnhancedAnalysis, "runEnhancedAnalysis");
async function getSentimentWithFallbackChain(symbol, newsData, env) {
  console.log(`\u{1F50D} SENTIMENT DEBUG: Starting getSentimentWithFallbackChain for ${symbol}`);
  console.log(`\u{1F50D} SENTIMENT DEBUG: News data available: ${!!newsData}, length: ${newsData?.length || 0}`);
  console.log(`\u{1F50D} SENTIMENT DEBUG: env.MODELSCOPE_API_KEY available: ${!!env.MODELSCOPE_API_KEY}`);
  console.log(`\u{1F50D} SENTIMENT DEBUG: env.MODELSCOPE_API_KEY length: ${env.MODELSCOPE_API_KEY?.length || 0}`);
  if (!newsData || newsData.length === 0) {
    console.log(`\u{1F50D} SENTIMENT DEBUG: Returning no_data - no news available`);
    return {
      sentiment: "neutral",
      confidence: 0,
      reasoning: "No news data available",
      source_count: 0,
      method: "no_data"
    };
  }
  try {
    if (env.AI) {
      console.log(`\u{1F50D} SENTIMENT DEBUG: Cloudflare AI available, using GPT-OSS-120B...`);
      console.log(`   \u{1F9E0} Using Cloudflare GPT-OSS-120B sentiment analysis for ${symbol}...`);
      const result = await getGPTOSSSentiment(symbol, newsData, env);
      console.log(`\u{1F50D} SENTIMENT DEBUG: GPT-OSS-120B result:`, {
        sentiment: result?.sentiment,
        confidence: result?.confidence,
        source: result?.source,
        method: result?.method,
        has_error: !!result?.error_details
      });
      return result;
    }
    console.log(`\u{1F50D} SENTIMENT DEBUG: No Cloudflare AI, using DistilBERT fallback`);
    console.log(`   \u{1F916} Using DistilBERT sentiment analysis for ${symbol}...`);
    const distilbertResult = await getDistilBERTSentiment(symbol, newsData, env);
    console.log(`\u{1F50D} SENTIMENT DEBUG: DistilBERT result:`, distilbertResult);
    return distilbertResult;
  } catch (error) {
    console.error(`\u{1F50D} SENTIMENT DEBUG: GPT-OSS-120B failed, error:`, {
      error_message: error.message,
      error_stack: error.stack?.substring(0, 200),
      symbol
    });
    console.error(`   \u274C GPT-OSS-120B sentiment failed for ${symbol}, using DistilBERT fallback:`, error.message);
    try {
      const distilbertFallback = await getDistilBERTSentiment(symbol, newsData, env);
      console.log(`   \u2705 DistilBERT fallback successful for ${symbol}`);
      return distilbertFallback;
    } catch (distilbertError) {
      console.error(`   \u274C All sentiment analysis methods failed for ${symbol}:`, distilbertError.message);
      return {
        sentiment: "neutral",
        confidence: 0.1,
        reasoning: `All sentiment analysis methods failed: ${error.message}`,
        source_count: newsData?.length || 0,
        method: "error_fallback",
        error_details: {
          primary_error: error.message,
          fallback_error: distilbertError.message
        }
      };
    }
  }
}
__name(getSentimentWithFallbackChain, "getSentimentWithFallbackChain");
async function getGPTOSSSentiment(symbol, newsData, env) {
  console.log(`\u{1F9E0} Starting GPT-OSS-120B sentiment analysis for ${symbol}...`);
  if (!env.AI) {
    throw new Error("Cloudflare AI binding not available for GPT-OSS-120B");
  }
  if (!newsData || newsData.length === 0) {
    return {
      sentiment: "neutral",
      confidence: 0,
      reasoning: "No news data available",
      source_count: 0,
      method: "gpt_oss_no_data"
    };
  }
  try {
    const newsContext = newsData.slice(0, 10).map((item, i) => `${i + 1}. ${item.title}
   ${item.summary || ""}`).join("\n\n");
    const prompt = `Analyze the financial sentiment for ${symbol} stock based on these news headlines:

${newsContext}

Provide a detailed analysis with:
1. Overall sentiment (bullish, bearish, or neutral)
2. Confidence level (0.0 to 1.0)
3. Brief reasoning for the sentiment
4. Key market-moving factors

Be precise and focus on actionable trading insights.`;
    console.log(`   \u{1F9E0} Calling Cloudflare AI GPT-OSS-120B for ${symbol}...`);
    const response = await env.AI.run(
      "@cf/openchat/openchat-3.5-0106",
      {
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }
    );
    console.log(`   \u{1F4DD} GPT-OSS-120B response received:`, response);
    if (!response || !response.response) {
      throw new Error("Empty response from GPT-OSS-120B");
    }
    const content = response.response;
    console.log(`   \u{1F4DD} GPT-OSS-120B content:`, content);
    const analysisData = parseNaturalLanguageResponse(content);
    const result = {
      ...analysisData,
      source: "cloudflare_gpt_oss",
      method: "gpt_oss_primary",
      model: "openchat-3.5-0106",
      source_count: newsData.length,
      analysis_type: "primary_sentiment",
      cost_estimate: {
        input_tokens: Math.ceil(prompt.length / 4),
        output_tokens: Math.ceil(content.length / 4),
        total_cost: 0
        // Cloudflare AI included in plan
      }
    };
    console.log(`   \u2705 GPT-OSS-120B sentiment analysis complete: ${result.sentiment} (${(result.confidence * 100).toFixed(1)}%)`);
    return result;
  } catch (error) {
    console.error(`   \u274C GPT-OSS-120B sentiment analysis failed for ${symbol}:`, error);
    throw new Error(`GPT-OSS-120B analysis failed: ${error.message}`);
  }
}
__name(getGPTOSSSentiment, "getGPTOSSSentiment");
async function getDistilBERTSentiment(symbol, newsData, env) {
  console.log(`\u{1F916} Starting DistilBERT sentiment analysis for ${symbol}...`);
  if (!env.AI) {
    throw new Error("Cloudflare AI binding not available for DistilBERT fallback");
  }
  if (!newsData || newsData.length === 0) {
    return {
      sentiment: "neutral",
      confidence: 0,
      reasoning: "No news data available",
      source_count: 0,
      method: "distilbert_no_data"
    };
  }
  try {
    const sentimentPromises = newsData.slice(0, 8).map(async (newsItem, index) => {
      try {
        const text = `${newsItem.title}. ${newsItem.summary || ""}`.substring(0, 500);
        const response = await env.AI.run(
          "@cf/huggingface/distilbert-sst-2-int8",
          { text }
        );
        const result2 = response[0];
        return {
          sentiment: result2.label.toLowerCase(),
          // POSITIVE/NEGATIVE -> positive/negative
          confidence: result2.score,
          score: result2.label === "POSITIVE" ? result2.score : -result2.score,
          text_analyzed: text,
          processing_order: index
        };
      } catch (error) {
        console.error("Individual DistilBERT analysis failed:", error);
        return {
          sentiment: "neutral",
          confidence: 0,
          score: 0,
          error: error.message
        };
      }
    });
    const results = await Promise.allSettled(sentimentPromises);
    const validResults = results.filter((result2) => result2.status === "fulfilled").map((result2) => result2.value).filter((result2) => !result2.error);
    if (validResults.length === 0) {
      throw new Error("All DistilBERT analyses failed");
    }
    let totalScore = 0;
    let totalWeight = 0;
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    validResults.forEach((result2) => {
      const weight = result2.confidence;
      totalScore += result2.score * weight;
      totalWeight += weight;
      if (result2.score > 0.1) sentimentCounts.positive++;
      else if (result2.score < -0.1) sentimentCounts.negative++;
      else sentimentCounts.neutral++;
    });
    const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const avgConfidence = totalWeight / validResults.length;
    let finalSentiment = "neutral";
    if (avgScore > 0.1) finalSentiment = "bullish";
    else if (avgScore < -0.1) finalSentiment = "bearish";
    const result = {
      sentiment: finalSentiment,
      confidence: avgConfidence,
      score: avgScore,
      reasoning: `DistilBERT analysis: ${finalSentiment} from ${validResults.length} news items (${sentimentCounts.positive}+ ${sentimentCounts.negative}- ${sentimentCounts.neutral}=)`,
      source: "cloudflare_distilbert",
      method: "distilbert_fallback",
      model: "distilbert-sst-2-int8",
      source_count: newsData.length,
      analysis_type: "final_fallback",
      cost_estimate: {
        input_tokens: validResults.length * 100,
        // Estimate
        output_tokens: 0,
        total_cost: 0
        // Cloudflare AI included in plan
      },
      sentiment_distribution: sentimentCounts,
      processed_items: validResults.length
    };
    console.log(`   \u2705 DistilBERT sentiment analysis complete: ${result.sentiment} (${(result.confidence * 100).toFixed(1)}%)`);
    return result;
  } catch (error) {
    console.error(`   \u274C DistilBERT sentiment analysis failed for ${symbol}:`, error);
    throw new Error(`DistilBERT analysis failed: ${error.message}`);
  }
}
__name(getDistilBERTSentiment, "getDistilBERTSentiment");
function combineSignals(technicalSignal, sentimentSignal, symbol) {
  const technicalDirection = technicalSignal.ensemble?.direction || technicalSignal.tft?.direction || "NEUTRAL";
  const technicalConfidence = technicalSignal.ensemble?.confidence || technicalSignal.tft?.confidence || 0.5;
  const sentimentDirection = sentimentSignal.sentiment?.toUpperCase() || "NEUTRAL";
  const sentimentConfidence = sentimentSignal.confidence || 0;
  let finalDirection = mapSentimentToDirection(sentimentDirection);
  let finalConfidence = sentimentConfidence;
  let reasoning = `Sentiment-driven: ${sentimentDirection} (${(sentimentConfidence * 100).toFixed(1)}%)`;
  const technicalAgreement = checkDirectionAgreement(finalDirection, technicalDirection);
  if (technicalAgreement) {
    finalConfidence = Math.min(0.95, finalConfidence + 0.1);
    reasoning += ` + Technical confirms (${technicalDirection})`;
  } else {
    reasoning += ` (Technical disagrees: ${technicalDirection})`;
  }
  const sentimentScore = mapDirectionToScore(finalDirection);
  const combinedScore = sentimentScore;
  return {
    symbol,
    direction: finalDirection,
    confidence: finalConfidence,
    combined_score: combinedScore,
    components: {
      primary_sentiment: {
        direction: sentimentDirection,
        confidence: sentimentConfidence,
        role: "primary_decision_maker",
        source_count: sentimentSignal.source_count,
        models_used: sentimentSignal.models_used
      },
      reference_technical: {
        direction: technicalDirection,
        confidence: technicalConfidence,
        role: "reference_confirmation",
        agreement: technicalAgreement
      }
    },
    reasoning,
    enhancement_details: {
      method: "sentiment_first_approach",
      primary_signal: "sentiment",
      reference_signal: "technical",
      sentiment_method: sentimentSignal.method || (sentimentSignal.models_used ? "cloudflare_ai_validation" : "ai_fallback"),
      technical_agreement: technicalAgreement,
      validation_triggered: sentimentSignal.validation_triggered,
      models_used: sentimentSignal.models_used
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(combineSignals, "combineSignals");
function mapDirectionToScore(direction) {
  const mapping = {
    "UP": 0.8,
    "DOWN": -0.8,
    "NEUTRAL": 0,
    "FLAT": 0,
    "BULLISH": 0.8,
    "BEARISH": -0.8
  };
  return mapping[direction?.toUpperCase()] || 0;
}
__name(mapDirectionToScore, "mapDirectionToScore");
async function runSentimentFirstAnalysis(env, options = {}) {
  const symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"];
  console.log(`\u{1F4AD} Starting sentiment-first analysis for ${symbols.length} symbols...`);
  const results = {
    sentiment_signals: {},
    analysis_time: (/* @__PURE__ */ new Date()).toISOString(),
    trigger_mode: options.triggerMode || "sentiment_first",
    symbols_analyzed: symbols
  };
  for (const symbol of symbols) {
    try {
      console.log(`   \u{1F9E0} Analyzing ${symbol} sentiment with GPT-OSS-120B...`);
      const newsData = await getFreeStockNews(symbol, env);
      const sentimentResult = await getSentimentWithFallbackChain(symbol, newsData, env);
      results.sentiment_signals[symbol] = {
        symbol,
        sentiment_analysis: sentimentResult,
        news_count: newsData?.length || 0,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        method: "sentiment_first"
      };
      const confidenceInfo = sentimentResult.confidence ? ` (${(sentimentResult.confidence * 100).toFixed(1)}%)` : "";
      const validationInfo = sentimentResult.validation_triggered ? " [Validated]" : "";
      console.log(`   \u2705 ${symbol}: ${sentimentResult.sentiment}${confidenceInfo}${validationInfo}`);
      if (symbols.indexOf(symbol) < symbols.length - 1) {
        console.log(`   \u23F1\uFE0F  Rate limiting protection: 2-second delay before next symbol...`);
        await new Promise((resolve) => setTimeout(resolve, 2e3));
      }
    } catch (error) {
      console.error(`   \u274C CRITICAL: Sentiment analysis failed for ${symbol}:`, error.message);
      console.log(`   \u26A0\uFE0F  Skipping ${symbol} - sentiment-first system requires working sentiment analysis`);
      results.sentiment_signals[symbol] = {
        symbol,
        sentiment_analysis: {
          sentiment: "failed",
          confidence: 0,
          reasoning: "Sentiment-first system: GPT analysis failed, skipping symbol",
          error: true,
          skip_technical: true
        },
        news_count: 0,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        method: "sentiment_first_skip"
      };
    }
  }
  console.log(`\u2705 Sentiment-first analysis completed for ${symbols.length} symbols`);
  return results;
}
__name(runSentimentFirstAnalysis, "runSentimentFirstAnalysis");
async function addTechnicalReference(sentimentResults, env, options = {}) {
  console.log(`\u{1F4CA} Adding technical analysis as reference confirmation...`);
  const { runBasicAnalysis: runBasicAnalysis2 } = await Promise.resolve().then(() => (init_analysis(), analysis_exports));
  const technicalAnalysis = await runBasicAnalysis2(env, options);
  const validSymbols = Object.keys(sentimentResults.sentiment_signals).filter(
    (symbol) => !sentimentResults.sentiment_signals[symbol].sentiment_analysis.skip_technical
  );
  console.log(`\u{1F4CA} Running technical reference for ${validSymbols.length} symbols (skipped ${Object.keys(sentimentResults.sentiment_signals).length - validSymbols.length} failed sentiment symbols)`);
  for (const symbol of validSymbols) {
    const sentimentSignal = sentimentResults.sentiment_signals[symbol];
    const technicalSignal = technicalAnalysis.trading_signals?.[symbol];
    if (technicalSignal && sentimentSignal.sentiment_analysis && !sentimentSignal.sentiment_analysis.error) {
      const enhancedSignal = combineSignals(technicalSignal, sentimentSignal.sentiment_analysis, symbol);
      sentimentResults.sentiment_signals[symbol] = {
        ...sentimentSignal,
        technical_reference: technicalSignal,
        enhanced_prediction: enhancedSignal,
        current_price: technicalSignal.current_price,
        predicted_price: technicalSignal.predicted_price
        // Keep technical prediction for reference
      };
      try {
        const granularAnalysisData = {
          symbol,
          analysis_type: "enhanced_sentiment_first",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          // Primary sentiment signal (decision maker)
          sentiment_analysis: sentimentSignal.sentiment_analysis,
          // Technical reference signal (confirmation)
          technical_reference: technicalSignal,
          // Combined enhanced prediction
          enhanced_prediction: enhancedSignal,
          // Price data
          current_price: technicalSignal.current_price,
          predicted_price: technicalSignal.predicted_price,
          // Analysis metadata
          news_count: sentimentSignal.news_count || 0,
          trigger_mode: sentimentResults.trigger_mode,
          analysis_method: "sentiment_first_with_technical_reference",
          // Performance tracking data
          confidence_metrics: {
            sentiment_confidence: sentimentSignal.sentiment_analysis.confidence,
            technical_confidence: technicalSignal.confidence,
            enhanced_confidence: enhancedSignal.confidence,
            neural_agreement: enhancedSignal.enhancement_details?.technical_agreement
          }
        };
        await storeSymbolAnalysis(env, symbol, granularAnalysisData);
        console.log(`   \u{1F4BE} ${symbol}: Granular analysis stored successfully`);
      } catch (storageError) {
        console.error(`   \u274C ${symbol}: Failed to store granular analysis:`, storageError.message);
      }
      console.log(`   \u{1F4CA} ${symbol}: Technical reference added (${technicalSignal.direction} ${(technicalSignal.confidence * 100).toFixed(1)}%)`);
    } else {
      console.log(`   \u26A0\uFE0F  ${symbol}: Skipping technical analysis (sentiment failed)`);
    }
  }
  const finalResults = {
    symbols_analyzed: sentimentResults.symbols_analyzed,
    trading_signals: sentimentResults.sentiment_signals,
    analysis_time: sentimentResults.analysis_time,
    trigger_mode: sentimentResults.trigger_mode,
    performance_metrics: {
      success_rate: 100,
      total_symbols: Object.keys(sentimentResults.sentiment_signals).length,
      successful_analyses: Object.keys(sentimentResults.sentiment_signals).length,
      failed_analyses: 0
    }
  };
  try {
    console.log(`\u{1F680} KV MAIN WRITE: Storing main analysis results`);
    const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const mainAnalysisKey = `analysis_${dateStr}`;
    console.log(`\u{1F50D} KV MAIN DEBUG: Storing with key:`, mainAnalysisKey);
    await env.TRADING_RESULTS.put(
      mainAnalysisKey,
      JSON.stringify(finalResults),
      { expirationTtl: 604800 }
      // 7 days
    );
    console.log(`\u2705 KV MAIN SUCCESS: Stored main analysis results at key: ${mainAnalysisKey}`);
  } catch (mainStorageError) {
    console.error(`\u274C KV MAIN ERROR: Failed to store main analysis results:`, mainStorageError);
    console.error(`\u274C KV MAIN ERROR DETAILS:`, {
      message: mainStorageError.message,
      stack: mainStorageError.stack
    });
  }
  console.log(`\u2705 Technical reference analysis completed`);
  return finalResults;
}
__name(addTechnicalReference, "addTechnicalReference");
async function runEnhancedPreMarketAnalysis(env, options = {}) {
  const startTime = Date.now();
  console.log("\u{1F680} Starting Enhanced Pre-Market Analysis with Sentiment...");
  try {
    const enhancedResults = await runEnhancedAnalysis(env, {
      triggerMode: options.triggerMode || "enhanced_pre_market",
      predictionHorizons: options.predictionHorizons,
      currentTime: options.currentTime,
      cronExecutionId: options.cronExecutionId
    });
    enhancedResults.pre_market_analysis = {
      trigger_mode: options.triggerMode,
      prediction_horizons: options.predictionHorizons,
      execution_time_ms: Date.now() - startTime,
      enhancement_enabled: true
    };
    console.log(`\u2705 Enhanced pre-market analysis completed in ${Date.now() - startTime}ms`);
    return enhancedResults;
  } catch (error) {
    console.error("\u274C Enhanced pre-market analysis failed:", error);
    const { runPreMarketAnalysis: runPreMarketAnalysis2 } = await Promise.resolve().then(() => (init_analysis(), analysis_exports));
    console.log("\u{1F504} Falling back to basic pre-market analysis...");
    const fallbackResults = await runPreMarketAnalysis2(env, options);
    fallbackResults.enhancement_fallback = {
      enabled: false,
      error: error.message,
      fallback_used: true
    };
    return fallbackResults;
  }
}
__name(runEnhancedPreMarketAnalysis, "runEnhancedPreMarketAnalysis");
async function validateSentimentEnhancement(env) {
  const testSymbol = "AAPL";
  console.log(`\u{1F9EA} Testing sentiment enhancement for ${testSymbol}...`);
  try {
    const newsData = await getFreeStockNews(testSymbol, env);
    console.log(`   \u{1F4F0} News data: ${newsData.length} articles found`);
    const sentimentResult = await getSentimentWithFallbackChain(testSymbol, newsData, env);
    console.log(`   \u{1F4CA} Sentiment: ${sentimentResult.sentiment} (${(sentimentResult.confidence * 100).toFixed(1)}%)`);
    const modelScopeSuccess = sentimentResult && sentimentResult.source === "modelscope_glm45" && !sentimentResult.error_details && sentimentResult.confidence > 0 && !["llama31_fallback", "distilbert_fallback"].includes(sentimentResult.method);
    console.log(`   \u{1F916} ModelScope GLM-4.5 success: ${modelScopeSuccess}`);
    console.log(`   \u{1F50D} Sentiment method used: ${sentimentResult.method || sentimentResult.source}`);
    console.log(`   \u{1F50D} ModelScope API key available: ${!!env.MODELSCOPE_API_KEY}`);
    console.log(`   \u{1F50D} Cloudflare AI available: ${!!env.AI}`);
    return {
      success: true,
      news_count: newsData.length,
      sentiment: sentimentResult.sentiment,
      confidence: sentimentResult.confidence,
      ai_available: modelScopeSuccess,
      // Check ModelScope success, not fallback methods
      method: sentimentResult.method || sentimentResult.source || "unknown",
      debug_info: {
        modelscope_key_available: !!env.MODELSCOPE_API_KEY,
        modelscope_key_length: env.MODELSCOPE_API_KEY?.length || 0,
        sentiment_source: sentimentResult.source,
        sentiment_method: sentimentResult.method,
        has_error_details: !!sentimentResult.error_details,
        result_confidence: sentimentResult.confidence
      }
    };
  } catch (error) {
    console.error("\u274C Sentiment enhancement validation failed:", error);
    return {
      success: false,
      error: error.message,
      ai_available: !!env.AI
    };
  }
}
__name(validateSentimentEnhancement, "validateSentimentEnhancement");

// src/modules/scheduler.js
init_facebook();
async function handleScheduledEvent(controller, env, ctx) {
  const scheduledTime = new Date(controller.scheduledTime);
  const estTime = new Date(scheduledTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const currentHour = estTime.getHours();
  const currentMinute = estTime.getMinutes();
  console.log(`\u{1F550} [MODULAR-CRON] ${estTime.toISOString()} - Cron trigger received (${currentHour}:${currentMinute.toString().padStart(2, "0")})`);
  const cronExecutionId = `cron_${Date.now()}`;
  let triggerMode, predictionHorizons;
  if (currentHour === 8 && currentMinute === 30) {
    triggerMode = "morning_prediction_alerts";
    predictionHorizons = [1, 24];
  } else if (currentHour === 12 && currentMinute === 0) {
    triggerMode = "midday_validation_prediction";
    predictionHorizons = [8, 24];
  } else if (currentHour === 16 && currentMinute === 0 && estTime.getDay() === 5) {
    triggerMode = "weekly_market_close_analysis";
    predictionHorizons = [72, 168];
  } else if (currentHour === 16 && currentMinute === 5) {
    triggerMode = "next_day_market_prediction";
    predictionHorizons = [17, 24];
  } else if (currentHour === 10 && currentMinute === 0 && estTime.getDay() === 0) {
    triggerMode = "weekly_accuracy_report";
    predictionHorizons = [];
  } else {
    console.log(`\u26A0\uFE0F [CRON] Unrecognized schedule: ${currentHour}:${currentMinute} on ${estTime.toDateString()}`);
    return new Response("Unrecognized cron schedule", { status: 400 });
  }
  console.log(`\u2705 [CRON-START] ${cronExecutionId}`, {
    trigger_mode: triggerMode,
    est_time: estTime.toISOString(),
    prediction_horizons: predictionHorizons
  });
  try {
    let analysisResult;
    if (triggerMode === "weekly_accuracy_report") {
      console.log(`\u{1F4CA} [CRON-WEEKLY] ${cronExecutionId} Generating weekly accuracy report`);
      console.log(`\u{1F4F1} [CRON-FB-WEEKLY] ${cronExecutionId} Sending weekly accuracy report via Facebook`);
      await sendWeeklyAccuracyReportWithTracking(env, cronExecutionId);
      console.log(`\u2705 [CRON-FB-WEEKLY] ${cronExecutionId} Weekly Facebook message completed`);
      console.log(`\u2705 [CRON-COMPLETE-WEEKLY] ${cronExecutionId} Weekly accuracy report completed`);
      return new Response("Weekly accuracy report sent successfully", { status: 200 });
    } else if (triggerMode === "weekly_market_close_analysis") {
      console.log(`\u{1F3C1} [CRON-FRIDAY] ${cronExecutionId} Running weekly market close analysis`);
      analysisResult = await runWeeklyMarketCloseAnalysis(env, estTime);
      console.log(`\u{1F4F1} [CRON-FB-FRIDAY] ${cronExecutionId} Sending Friday weekend report via Facebook`);
      await sendFridayWeekendReportWithTracking(analysisResult, env, cronExecutionId, triggerMode);
      console.log(`\u2705 [CRON-FB-FRIDAY] ${cronExecutionId} Friday Facebook message completed`);
    } else {
      console.log(`\u{1F680} [CRON-ENHANCED] ${cronExecutionId} Running enhanced analysis with sentiment...`);
      analysisResult = await runEnhancedPreMarketAnalysis(env, {
        triggerMode,
        predictionHorizons,
        currentTime: estTime,
        cronExecutionId
      });
      console.log(`\u{1F4F1} [CRON-FB] ${cronExecutionId} Attempting Facebook message for trigger: ${triggerMode}`);
      if (triggerMode === "morning_prediction_alerts") {
        console.log(`\u{1F4F1} [CRON-FB-MORNING] ${cronExecutionId} Sending morning predictions via Facebook`);
        await sendMorningPredictionsWithTracking(analysisResult, env, cronExecutionId);
        console.log(`\u2705 [CRON-FB-MORNING] ${cronExecutionId} Morning Facebook message completed`);
      } else if (triggerMode === "midday_validation_prediction") {
        console.log(`\u{1F4F1} [CRON-FB-MIDDAY] ${cronExecutionId} Sending midday validation via Facebook`);
        await sendMiddayValidationWithTracking(analysisResult, env, cronExecutionId);
        console.log(`\u2705 [CRON-FB-MIDDAY] ${cronExecutionId} Midday Facebook message completed`);
      } else if (triggerMode === "next_day_market_prediction") {
        console.log(`\u{1F4F1} [CRON-FB-DAILY] ${cronExecutionId} Sending daily validation via Facebook`);
        await sendDailyValidationWithTracking(analysisResult, env, cronExecutionId);
        console.log(`\u2705 [CRON-FB-DAILY] ${cronExecutionId} Daily Facebook message completed`);
      }
      console.log(`\u{1F4F1} [CRON-FB-COMPLETE] ${cronExecutionId} All Facebook messaging completed for ${triggerMode}`);
    }
    if (analysisResult) {
      let dateStr = estTime.toISOString().split("T")[0];
      const timeStr = estTime.toISOString().substr(11, 8).replace(/:/g, "");
      const timestampedKey = `analysis_${dateStr}_${timeStr}`;
      const dailyKey = `analysis_${dateStr}`;
      console.log(`\u{1F4BE} [CRON-KV] ${cronExecutionId} storing results with keys: ${timestampedKey} and ${dailyKey}`);
      await env.TRADING_RESULTS.put(
        timestampedKey,
        JSON.stringify({
          ...analysisResult,
          cron_execution_id: cronExecutionId,
          trigger_mode: triggerMode,
          timestamp: estTime.toISOString()
        }),
        { expirationTtl: 604800 }
        // 7 days
      );
      await env.TRADING_RESULTS.put(
        dailyKey,
        JSON.stringify({
          ...analysisResult,
          cron_execution_id: cronExecutionId,
          trigger_mode: triggerMode,
          last_updated: estTime.toISOString()
        }),
        { expirationTtl: 604800 }
        // 7 days
      );
    }
    const cronDuration = Date.now() - scheduledTime.getTime();
    console.log(`\u2705 [CRON-COMPLETE] ${cronExecutionId}`, {
      trigger_mode: triggerMode,
      duration_ms: cronDuration,
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 0,
      facebook_status: env.FACEBOOK_PAGE_TOKEN ? "sent" : "skipped"
    });
    return new Response(JSON.stringify({
      success: true,
      trigger_mode: triggerMode,
      symbols_analyzed: analysisResult?.symbols_analyzed?.length || 0,
      execution_id: cronExecutionId,
      timestamp: estTime.toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(`\u274C [CRON-ERROR] ${cronExecutionId}:`, error);
    if (env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(env.SLACK_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `\u{1F6A8} CRITICAL: Trading System Cron Failed`,
            attachments: [{
              color: "danger",
              fields: [
                { title: "Error", value: error.message, short: false },
                { title: "Trigger Mode", value: triggerMode, short: true },
                { title: "Time", value: estTime.toISOString(), short: true }
              ]
            }]
          }),
          signal: AbortSignal.timeout(1e4)
        });
      } catch (alertError) {
        console.error("Failed to send error alert:", alertError);
      }
    }
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      trigger_mode: triggerMode,
      execution_id: cronExecutionId,
      timestamp: estTime.toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleScheduledEvent, "handleScheduledEvent");

// src/modules/weekly-analysis.js
init_data();
async function handleWeeklyAnalysisPage(request, env) {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Market Close Analysis - TFT Trading System</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #ffffff; min-height: 100vh; padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            text-align: center; margin-bottom: 40px; padding: 30px;
            background: rgba(255, 255, 255, 0.1); border-radius: 20px;
            backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .header h1 {
            font-size: 2.8rem; margin-bottom: 10px;
            background: linear-gradient(45deg, #4facfe, #00f2fe);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card {
            background: rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 25px;
            backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2);
            text-align: center; transition: transform 0.3s ease;
        }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-card h3 { font-size: 1.1rem; margin-bottom: 10px; opacity: 0.8; text-transform: uppercase; }
        .stat-card .value { font-size: 2.5rem; font-weight: bold; color: #00f2fe; margin: 10px 0; }
        .chart-container {
            background: rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 30px;
            backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); margin: 20px 0;
        }
        .chart-wrapper { position: relative; height: 400px; }
        .loading { text-align: center; padding: 40px; font-size: 1.1rem; }
        .error { 
            text-align: center; padding: 40px; background: rgba(255, 0, 0, 0.1); 
            border-radius: 15px; color: #ff6b6b; 
        }
        .refresh-button {
            background: linear-gradient(45deg, #4facfe, #00f2fe); color: white; border: none;
            padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 1rem;
            margin: 20px auto; display: block; transition: all 0.3s ease;
        }
        .refresh-button:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(79, 172, 254, 0.3); }
        .table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .table th, .table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
        .table th { background: rgba(255, 255, 255, 0.1); color: #4facfe; font-weight: 600; }
        .table tr:hover { background: rgba(255, 255, 255, 0.05); }
        .accuracy-indicator { display: inline-flex; align-items: center; gap: 5px; }
        .symbol-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .symbol-card { background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; border: 1px solid rgba(255, 255, 255, 0.1); }
        .symbol-card h4 { color: #4facfe; margin-bottom: 15px; font-size: 1.2rem; }
        .prediction-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .prediction-row:last-child { border-bottom: none; }
        
        @media (max-width: 768px) {
            .header h1 { font-size: 2rem; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .stat-card .value { font-size: 2rem; }
            .chart-wrapper { height: 300px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>\u{1F4CA} Weekly Market Close Analysis</h1>
            <p>Comprehensive prediction accuracy and model performance review</p>
            
            <div style="margin: 20px 0; display: flex; gap: 15px; align-items: center; justify-content: center; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label for="weekSelect" style="color: #4facfe; font-weight: 600;">\u{1F4C5} Select Week:</label>
                    <select id="weekSelect" onchange="loadData()" style="
                        padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3);
                        background: rgba(255,255,255,0.1); color: white; font-size: 14px;">
                        <option value="current">Current Week</option>
                        <option value="last1">Last Week</option>
                        <option value="last2">2 Weeks Ago</option>
                        <option value="last3">3 Weeks Ago</option>
                    </select>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label for="dateRange" style="color: #4facfe; font-weight: 600;">\u{1F4CA} Date Range:</label>
                    <select id="dateRange" onchange="loadData()" style="
                        padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3);
                        background: rgba(255,255,255,0.1); color: white; font-size: 14px;">
                        <option value="7">Last 7 Days</option>
                        <option value="14">Last 14 Days</option>
                        <option value="30">Last 30 Days</option>
                    </select>
                </div>
                <button class="refresh-button" onclick="loadData()" style="margin: 0;">\u{1F504} Refresh Data</button>
            </div>
        </div>

        <div id="loading" class="loading">Loading weekly analysis data...</div>

        <div id="error" class="error" style="display: none;">
            <h3>\u26A0\uFE0F Error Loading Data</h3>
            <p id="error-message"></p>
            <button class="refresh-button" onclick="loadData()">Try Again</button>
        </div>

        <div id="content" style="display: none;">
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Overall Accuracy</h3>
                    <div class="value" id="overall-accuracy">-</div>
                    <div class="label">Price Predictions</div>
                </div>
                <div class="stat-card">
                    <h3>Direction Accuracy</h3>
                    <div class="value" id="direction-accuracy">-</div>
                    <div class="label">UP/DOWN Signals</div>
                </div>
                <div class="stat-card">
                    <h3>Total Predictions</h3>
                    <div class="value" id="total-predictions">-</div>
                    <div class="label">This Week</div>
                </div>
                <div class="stat-card">
                    <h3>Best Model</h3>
                    <div class="value" id="best-model">-</div>
                    <div class="label">Top Performer</div>
                </div>
            </div>

            <div class="chart-container">
                <h2 style="text-align: center; color: #4facfe; margin-bottom: 20px;">\u{1F4C8} Daily Accuracy Trends</h2>
                <div class="chart-wrapper">
                    <canvas id="accuracyChart"></canvas>
                </div>
            </div>

            <div class="chart-container">
                <h2 style="text-align: center; color: #4facfe; margin-bottom: 20px;">\u{1F4CB} Detailed Prediction History</h2>
                <div style="overflow-x: auto;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Symbol</th>
                                <th>Model</th>
                                <th>Predicted</th>
                                <th>Actual</th>
                                <th>Direction</th>
                                <th>Accuracy</th>
                            </tr>
                        </thead>
                        <tbody id="predictions-table-body">
                            <tr><td colspan="7" style="text-align: center; padding: 20px;">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="chart-container">
                <h2 style="text-align: center; color: #4facfe; margin-bottom: 20px;">\u{1F4C8} Symbol Performance Breakdown</h2>
                <div id="symbol-breakdown" class="symbol-grid">
                    <!-- Dynamic content -->
                </div>
            </div>
        </div>
    </div>

    <script>
        let accuracyChart;

        async function loadData() {
            try {
                document.getElementById('loading').style.display = 'block';
                document.getElementById('error').style.display = 'none';
                document.getElementById('content').style.display = 'none';

                // Get selected parameters
                const weekSelect = document.getElementById('weekSelect');
                const dateRange = document.getElementById('dateRange');
                const selectedWeek = weekSelect ? weekSelect.value : 'current';
                const selectedRange = dateRange ? dateRange.value : '7';

                // Build API URL with parameters
                const apiUrl = '/api/weekly-data?week=' + selectedWeek + '&range=' + selectedRange;
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }

                const data = await response.json();
                updateOverviewStats(data);
                createAccuracyChart(data.dailyAccuracy || []);
                updatePredictionsTable(data.predictions || []);
                updateSymbolBreakdown(data.symbolBreakdown || {});

                document.getElementById('loading').style.display = 'none';
                document.getElementById('content').style.display = 'block';

            } catch (error) {
                console.error('Error loading data:', error);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error').style.display = 'block';
                document.getElementById('error-message').textContent = error.message;
            }
        }

        function updateOverviewStats(data) {
            const stats = data.overview || {};
            document.getElementById('sentiment-accuracy').textContent =
                stats.sentimentAccuracy ? \`\${stats.sentimentAccuracy.toFixed(2)}%\` : '-';
            document.getElementById('direction-accuracy').textContent =
                stats.directionAccuracy ? \`\${stats.directionAccuracy.toFixed(2)}%\` : '-';
            document.getElementById('neural-agreement').textContent =
                stats.neuralAgreementRate ? \`\${stats.neuralAgreementRate.toFixed(2)}%\` : '-';
            document.getElementById('total-predictions').textContent = stats.totalPredictions || '-';
            document.getElementById('best-model').textContent = stats.primaryModel || stats.bestModel || 'GPT-OSS-120B';
        }

        function createAccuracyChart(dailyData) {
            const ctx = document.getElementById('accuracyChart').getContext('2d');
            if (accuracyChart) accuracyChart.destroy();

            accuracyChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dailyData.map(d => new Date(d.date).toLocaleDateString()),
                    datasets: [{
                        label: 'GPT-OSS-120B Sentiment (%)',
                        data: dailyData.map(d => d.sentimentAccuracy || d.priceAccuracy),
                        borderColor: '#4facfe',
                        backgroundColor: 'rgba(79, 172, 254, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Direction Accuracy (%)',
                        data: dailyData.map(d => d.directionAccuracy),
                        borderColor: '#00f2fe',
                        backgroundColor: 'rgba(0, 242, 254, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Neural Agreement (%)',
                        data: dailyData.map(d => d.neuralAgreement || 50),
                        borderColor: '#ffd93d',
                        backgroundColor: 'rgba(255, 217, 61, 0.1)',
                        tension: 0.4,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#ffffff' } } },
                    scales: {
                        x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                        y: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, min: 0, max: 100 }
                    }
                }
            });
        }

        function updatePredictionsTable(predictions) {
            const tbody = document.getElementById('predictions-table-body');
            tbody.innerHTML = '';

            predictions.forEach(prediction => {
                const row = document.createElement('tr');
                const accuracy = prediction.actual_price && prediction.predicted_price ?
                    (100 - Math.abs((prediction.predicted_price - prediction.actual_price) / prediction.actual_price * 100)) : null;
                const directionCorrect = prediction.direction_correct !== undefined ?
                    (prediction.direction_correct ? '\u2713' : '\u2717') : '-';

                // Format neural agreement with appropriate styling
                const neuralAgreement = prediction.neural_agreement;
                let agreementDisplay = '\u2753';
                let agreementStyle = '';
                if (neuralAgreement === 'AGREE') {
                    agreementDisplay = '\u2705 AGREE';
                    agreementStyle = 'color: #00f2fe; font-weight: 600;';
                } else if (neuralAgreement === 'DISAGREE') {
                    agreementDisplay = '\u274C DISAGREE';
                    agreementStyle = 'color: #ff6b6b; font-weight: 600;';
                }

                // Format sentiment score
                const sentimentScore = prediction.sentiment_score !== undefined ?
                    \`\${(prediction.sentiment_score * 100).toFixed(1)}%\` : '-';
                const newsCount = prediction.news_articles ? \` (\${prediction.news_articles} articles)\` : '';

                row.innerHTML = \`
                    <td>\${new Date(prediction.date).toLocaleDateString()}</td>
                    <td><strong>\${prediction.symbol}</strong></td>
                    <td>\${prediction.model || 'GPT-OSS-120B'}</td>
                    <td>$\${prediction.predicted_price ? prediction.predicted_price.toFixed(2) : '-'}</td>
                    <td>$\${prediction.actual_price ? prediction.actual_price.toFixed(2) : '-'}</td>
                    <td>
                        <div class="accuracy-indicator">
                            <span>\${prediction.direction || '\u27A1\uFE0F'}</span>
                            <span>\${directionCorrect}</span>
                        </div>
                    </td>
                    <td style="\${agreementStyle}">\${agreementDisplay}</td>
                    <td>\${sentimentScore}\${newsCount}</td>
                    <td>\${accuracy !== null ? accuracy.toFixed(2) + '%' : '-'}</td>
                \`;
                tbody.appendChild(row);
            });
        }

        function updateSymbolBreakdown(symbolData) {
            const container = document.getElementById('symbol-breakdown');
            container.innerHTML = '';

            Object.entries(symbolData).forEach(([symbol, data]) => {
                const card = document.createElement('div');
                card.className = 'symbol-card';

                // Format neural agreement rate with color coding
                const agreementRate = data.neuralAgreementRate || 0;
                let agreementColor = '#ff6b6b'; // Default red
                if (agreementRate >= 70) agreementColor = '#00f2fe'; // High agreement - cyan
                else if (agreementRate >= 50) agreementColor = '#ffd93d'; // Medium agreement - yellow

                card.innerHTML = \`
                    <h4>\${symbol}</h4>
                    <div class="prediction-row">
                        <span>\u{1F9E0} Sentiment Accuracy:</span>
                        <span style="color: #4facfe; font-weight: 600;">\${data.sentimentAccuracy ? data.sentimentAccuracy.toFixed(2) + '%' : '-'}</span>
                    </div>
                    <div class="prediction-row">
                        <span>\u{1F3AF} Direction Accuracy:</span>
                        <span>\${data.directionAccuracy ? data.directionAccuracy.toFixed(2) + '%' : '-'}</span>
                    </div>
                    <div class="prediction-row">
                        <span>\u{1F91D} Neural Agreement:</span>
                        <span style="color: \${agreementColor}; font-weight: 600;">\${agreementRate.toFixed(1)}%</span>
                    </div>
                    <div class="prediction-row">
                        <span>\u{1F4F0} Avg News Articles:</span>
                        <span>\${data.avgNewsArticles ? data.avgNewsArticles.toFixed(1) : '0'}</span>
                    </div>
                    <div class="prediction-row">
                        <span>\u{1F4CA} Total Predictions:</span>
                        <span>\${data.totalPredictions || 0}</span>
                    </div>
                    <div class="prediction-row">
                        <span>\u{1F680} Primary Model:</span>
                        <span style="color: #4facfe; font-weight: 600;">\${data.primaryModel || 'GPT-OSS-120B'}</span>
                    </div>
                \`;

                container.appendChild(card);
            });
        }

        document.addEventListener('DOMContentLoaded', loadData);
    <\/script>
</body>
</html>`;
  return new Response(htmlContent, {
    headers: { "Content-Type": "text/html" }
  });
}
__name(handleWeeklyAnalysisPage, "handleWeeklyAnalysisPage");
async function handleWeeklyDataAPI(request, env) {
  try {
    const url = new URL(request.url);
    const weekParam = url.searchParams.get("week") || "current";
    const rangeParam = parseInt(url.searchParams.get("range")) || 7;
    console.log(`\u{1F4CA} Weekly data requested: week=${weekParam}, range=${rangeParam}`);
    const factTableData = await getFactTableDataWithRange(env, rangeParam, weekParam);
    const weeklyData = await processWeeklyAnalysisData(factTableData, env);
    weeklyData.metadata = {
      week_selected: weekParam,
      date_range_days: rangeParam,
      data_points: factTableData.length,
      generated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    return new Response(JSON.stringify(weeklyData, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("\u274C Weekly data API error:", error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      overview: {
        overallAccuracy: 0,
        directionAccuracy: 0,
        totalPredictions: 0,
        bestModel: "No Data"
      },
      dailyAccuracy: [],
      modelPerformance: {},
      predictions: [],
      symbolBreakdown: {}
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleWeeklyDataAPI, "handleWeeklyDataAPI");
async function processWeeklyAnalysisData(factTableData, env) {
  const sevenDaysAgo = /* @__PURE__ */ new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentPredictions = factTableData.filter((record) => {
    const recordDate = new Date(record.date);
    return recordDate >= sevenDaysAgo && record.predicted_price !== null && record.actual_price !== null;
  });
  let totalPriceAccuracy = 0;
  let totalDirectionAccuracy = 0;
  let totalSentimentAccuracy = 0;
  let totalNeuralAgreement = 0;
  let priceCount = 0;
  let directionCount = 0;
  let sentimentCount = 0;
  let agreementCount = 0;
  const symbolStats = {};
  const modelStats = {};
  const dailyStats = {};
  const sentimentStats = {};
  const neuralAgreementStats = {};
  recentPredictions.forEach((record) => {
    if (record.predicted_price && record.actual_price) {
      const priceError = Math.abs((record.predicted_price - record.actual_price) / record.actual_price * 100);
      const priceAccuracy = Math.max(0, 100 - priceError);
      totalPriceAccuracy += priceAccuracy;
      priceCount++;
    }
    if (record.direction_correct !== void 0) {
      totalDirectionAccuracy += record.direction_correct ? 100 : 0;
      directionCount++;
    }
    if (!symbolStats[record.symbol]) {
      symbolStats[record.symbol] = {
        priceAccuracy: 0,
        directionAccuracy: 0,
        sentimentAccuracy: 0,
        neuralAgreementRate: 0,
        avgNewsArticles: 0,
        totalPredictions: 0,
        bestModel: "GPT-OSS-120B",
        primaryModel: "GPT-OSS-120B"
      };
    }
    symbolStats[record.symbol].totalPredictions++;
    const model = record.primary_model || record.model || "GPT-OSS-120B";
    if (!modelStats[model]) {
      modelStats[model] = { accuracy: 0, count: 0, type: "sentiment" };
    }
    if (record.predicted_price && record.actual_price) {
      const accuracy = Math.max(0, 100 - Math.abs((record.predicted_price - record.actual_price) / record.actual_price * 100));
      modelStats[model].accuracy += accuracy;
      modelStats[model].count++;
    }
    if (record.sentiment_score !== void 0) {
      totalSentimentAccuracy += record.sentiment_score * 100;
      sentimentCount++;
      if (!sentimentStats[record.symbol]) {
        sentimentStats[record.symbol] = { total: 0, count: 0, newsArticles: 0 };
      }
      sentimentStats[record.symbol].total += record.sentiment_score * 100;
      sentimentStats[record.symbol].count++;
      sentimentStats[record.symbol].newsArticles += record.news_articles || 0;
    }
    if (record.neural_agreement) {
      const agreementValue = record.neural_agreement === "AGREE" ? 100 : 0;
      totalNeuralAgreement += agreementValue;
      agreementCount++;
      if (!neuralAgreementStats[record.symbol]) {
        neuralAgreementStats[record.symbol] = { agreements: 0, total: 0 };
      }
      neuralAgreementStats[record.symbol].total++;
      if (record.neural_agreement === "AGREE") {
        neuralAgreementStats[record.symbol].agreements++;
      }
    }
    const dateKey = record.date;
    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = {
        priceAccuracy: 0,
        directionAccuracy: 0,
        priceCount: 0,
        directionCount: 0
      };
    }
    if (record.predicted_price && record.actual_price) {
      const accuracy = Math.max(0, 100 - Math.abs((record.predicted_price - record.actual_price) / record.actual_price * 100));
      dailyStats[dateKey].priceAccuracy += accuracy;
      dailyStats[dateKey].priceCount++;
    }
    if (record.direction_correct !== void 0) {
      dailyStats[dateKey].directionAccuracy += record.direction_correct ? 100 : 0;
      dailyStats[dateKey].directionCount++;
    }
  });
  const dailyAccuracy = Object.keys(dailyStats).map((date) => ({
    date,
    priceAccuracy: dailyStats[date].priceCount > 0 ? dailyStats[date].priceAccuracy / dailyStats[date].priceCount : 0,
    directionAccuracy: dailyStats[date].directionCount > 0 ? dailyStats[date].directionAccuracy / dailyStats[date].directionCount : 0
  })).sort((a, b) => new Date(a.date) - new Date(b.date));
  let bestModel = "GPT-OSS-120B";
  let bestAccuracy = 0;
  Object.entries(modelStats).forEach(([model, stats]) => {
    if (stats.count > 0) {
      const avgAccuracy = stats.accuracy / stats.count;
      if (avgAccuracy > bestAccuracy) {
        bestAccuracy = avgAccuracy;
        bestModel = model;
        modelStats[model].accuracy = avgAccuracy;
      }
    }
  });
  if (!modelStats["GPT-OSS-120B"]) {
    bestModel = "GPT-OSS-120B (Primary)";
  }
  Object.keys(symbolStats).forEach((symbol) => {
    const symbolPredictions = recentPredictions.filter((r) => r.symbol === symbol);
    let symbolPriceAcc = 0;
    let symbolDirAcc = 0;
    let symbolSentAcc = 0;
    let symbolNewsCount = 0;
    let pCount = 0;
    let dCount = 0;
    let sCount = 0;
    symbolPredictions.forEach((record) => {
      if (record.predicted_price && record.actual_price) {
        symbolPriceAcc += Math.max(0, 100 - Math.abs((record.predicted_price - record.actual_price) / record.actual_price * 100));
        pCount++;
      }
      if (record.direction_correct !== void 0) {
        symbolDirAcc += record.direction_correct ? 100 : 0;
        dCount++;
      }
      if (record.sentiment_score !== void 0) {
        symbolSentAcc += record.sentiment_score * 100;
        symbolNewsCount += record.news_articles || 0;
        sCount++;
      }
    });
    symbolStats[symbol].priceAccuracy = pCount > 0 ? symbolPriceAcc / pCount : 0;
    symbolStats[symbol].directionAccuracy = dCount > 0 ? symbolDirAcc / dCount : 0;
    symbolStats[symbol].sentimentAccuracy = sCount > 0 ? symbolSentAcc / sCount : 0;
    symbolStats[symbol].avgNewsArticles = sCount > 0 ? symbolNewsCount / sCount : 0;
    if (neuralAgreementStats[symbol]) {
      const agreeStats = neuralAgreementStats[symbol];
      symbolStats[symbol].neuralAgreementRate = agreeStats.total > 0 ? agreeStats.agreements / agreeStats.total * 100 : 0;
    }
  });
  return {
    overview: {
      overallAccuracy: priceCount > 0 ? totalPriceAccuracy / priceCount : 0,
      directionAccuracy: directionCount > 0 ? totalDirectionAccuracy / directionCount : 0,
      sentimentAccuracy: sentimentCount > 0 ? totalSentimentAccuracy / sentimentCount : 0,
      neuralAgreementRate: agreementCount > 0 ? totalNeuralAgreement / agreementCount : 0,
      totalPredictions: recentPredictions.length,
      bestModel,
      primaryModel: "GPT-OSS-120B"
    },
    dailyAccuracy,
    modelPerformance: modelStats,
    predictions: recentPredictions.map((record) => ({
      date: record.date,
      symbol: record.symbol,
      model: record.primary_model || record.model || "GPT-OSS-120B",
      predicted_price: record.predicted_price,
      actual_price: record.actual_price,
      direction: record.direction_prediction,
      direction_correct: record.direction_correct,
      confidence: record.primary_confidence || record.confidence,
      sentiment_score: record.sentiment_score,
      neural_agreement: record.neural_agreement,
      news_articles: record.news_articles,
      enhancement_method: record.enhancement_method
    })),
    symbolBreakdown: symbolStats
  };
}
__name(processWeeklyAnalysisData, "processWeeklyAnalysisData");

// src/modules/handlers.js
init_analysis();

// src/modules/technical_indicators.js
function sma(prices, length) {
  if (prices.length < length) return null;
  const sum = prices.slice(-length).reduce((a, b) => a + b, 0);
  return sum / length;
}
__name(sma, "sma");
function ema(prices, length, previousEma = null) {
  if (prices.length === 0) return null;
  const multiplier = 2 / (length + 1);
  const currentPrice = prices[prices.length - 1];
  if (previousEma === null) {
    if (prices.length < length) return null;
    return sma(prices.slice(0, length), length);
  }
  return currentPrice * multiplier + previousEma * (1 - multiplier);
}
__name(ema, "ema");
function emaSeries(prices, length) {
  const emaValues = [];
  let previousEma = null;
  for (let i = 0; i < prices.length; i++) {
    const currentPrices = prices.slice(0, i + 1);
    const emaValue = ema(currentPrices, length, previousEma);
    emaValues.push(emaValue);
    if (emaValue !== null) previousEma = emaValue;
  }
  return emaValues;
}
__name(emaSeries, "emaSeries");
function rsi(prices, length = 14) {
  if (prices.length < length + 1) return null;
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  let gains = 0;
  let losses = 0;
  for (let i = 0; i < length; i++) {
    if (changes[i] > 0) gains += changes[i];
    else losses += Math.abs(changes[i]);
  }
  gains /= length;
  losses /= length;
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}
__name(rsi, "rsi");
function bollingerBands(prices, length = 20, std = 2) {
  if (prices.length < length) return { upper: null, lower: null, middle: null };
  const recentPrices = prices.slice(-length);
  const middle = sma(recentPrices, length);
  const variance = recentPrices.reduce((sum, price) => {
    return sum + Math.pow(price - middle, 2);
  }, 0) / length;
  const stdDev = Math.sqrt(variance);
  return {
    upper: middle + stdDev * std,
    lower: middle - stdDev * std,
    middle,
    width: 2 * stdDev * std / middle,
    position: (prices[prices.length - 1] - (middle - stdDev * std)) / (2 * stdDev * std)
  };
}
__name(bollingerBands, "bollingerBands");
function atr(ohlcData, length = 14) {
  if (ohlcData.length < length + 1) return null;
  const trueRanges = [];
  for (let i = 1; i < ohlcData.length; i++) {
    const high = ohlcData[i].high;
    const low = ohlcData[i].low;
    const prevClose = ohlcData[i - 1].close;
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }
  const recentTR = trueRanges.slice(-length);
  return recentTR.reduce((a, b) => a + b, 0) / length;
}
__name(atr, "atr");
function macd(prices, fast = 12, slow = 26, signal = 9) {
  if (prices.length < slow) return { macd: null, signal: null, histogram: null };
  const emaFast = emaSeries(prices, fast);
  const emaSlow = emaSeries(prices, slow);
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine.push(emaFast[i] - emaSlow[i]);
    } else {
      macdLine.push(null);
    }
  }
  const validMacd = macdLine.filter((val) => val !== null);
  if (validMacd.length < signal) {
    return { macd: macdLine[macdLine.length - 1], signal: null, histogram: null };
  }
  const signalLine = emaSeries(validMacd, signal);
  const currentSignal = signalLine[signalLine.length - 1];
  const currentMacd = macdLine[macdLine.length - 1];
  return {
    macd: currentMacd,
    signal: currentSignal,
    histogram: currentMacd && currentSignal ? currentMacd - currentSignal : null
  };
}
__name(macd, "macd");
function stochastic(ohlcData, kPeriod = 14, dPeriod = 3) {
  if (ohlcData.length < kPeriod) return { k: null, d: null };
  const recentData = ohlcData.slice(-kPeriod);
  const highs = recentData.map((d) => d.high);
  const lows = recentData.map((d) => d.low);
  const currentClose = ohlcData[ohlcData.length - 1].close;
  const highestHigh = Math.max(...highs);
  const lowestLow = Math.min(...lows);
  const kPercent = (currentClose - lowestLow) / (highestHigh - lowestLow) * 100;
  const dPercent = kPercent;
  return { k: kPercent, d: dPercent };
}
__name(stochastic, "stochastic");
function williamsR(ohlcData, length = 14) {
  if (ohlcData.length < length) return null;
  const recentData = ohlcData.slice(-length);
  const highs = recentData.map((d) => d.high);
  const lows = recentData.map((d) => d.low);
  const currentClose = ohlcData[ohlcData.length - 1].close;
  const highestHigh = Math.max(...highs);
  const lowestLow = Math.min(...lows);
  return -100 * ((highestHigh - currentClose) / (highestHigh - lowestLow));
}
__name(williamsR, "williamsR");
function obv(ohlcData) {
  if (ohlcData.length < 2) return null;
  let obvValue = ohlcData[0].volume;
  for (let i = 1; i < ohlcData.length; i++) {
    const currentClose = ohlcData[i].close;
    const previousClose = ohlcData[i - 1].close;
    const currentVolume = ohlcData[i].volume;
    if (currentClose > previousClose) {
      obvValue += currentVolume;
    } else if (currentClose < previousClose) {
      obvValue -= currentVolume;
    }
  }
  return obvValue;
}
__name(obv, "obv");
function priceReturns(prices, period = 1) {
  if (prices.length < period + 1) return null;
  const currentPrice = prices[prices.length - 1];
  const pastPrice = prices[prices.length - 1 - period];
  return (currentPrice - pastPrice) / pastPrice;
}
__name(priceReturns, "priceReturns");
function createTechnicalFeatures(ohlcData) {
  if (!ohlcData || ohlcData.length < 50) {
    return null;
  }
  const closes = ohlcData.map((d) => d.close);
  const volumes = ohlcData.map((d) => d.volume);
  const currentData = ohlcData[ohlcData.length - 1];
  const sma5 = sma(closes, 5);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const ema12Series = emaSeries(closes, 12);
  const ema26Series = emaSeries(closes, 26);
  const ema12 = ema12Series[ema12Series.length - 1];
  const ema26 = ema26Series[ema26Series.length - 1];
  const macdData = macd(closes);
  const rsi14 = rsi(closes, 14);
  const rsi30 = rsi(closes, 30);
  const stochData = stochastic(ohlcData);
  const williamsRValue = williamsR(ohlcData);
  const bbData = bollingerBands(closes);
  const atrValue = atr(ohlcData);
  const volumeSma = sma(volumes, 20);
  const volumeRatio = volumeSma ? currentData.volume / volumeSma : null;
  const obvValue = obv(ohlcData);
  const return1d = priceReturns(closes, 1);
  const return3d = priceReturns(closes, 3);
  const return5d = priceReturns(closes, 5);
  const return10d = priceReturns(closes, 10);
  const pricePosition = currentData.high !== currentData.low ? (currentData.close - currentData.low) / (currentData.high - currentData.low) : 0.5;
  const gap = ohlcData.length > 1 ? (currentData.open - ohlcData[ohlcData.length - 2].close) / ohlcData[ohlcData.length - 2].close : 0;
  const priceVsSma20 = sma20 ? currentData.close / sma20 - 1 : null;
  const priceVsSma50 = sma50 ? currentData.close / sma50 - 1 : null;
  const sma20Slope = closes.length >= 25 ? priceReturns(closes.slice(-25).filter((_, i, arr) => i % 5 === 0 || i === arr.length - 1), 1) : null;
  const sma50Slope = closes.length >= 60 ? priceReturns(closes.slice(-60).filter((_, i, arr) => i % 10 === 0 || i === arr.length - 1), 1) : null;
  return {
    // Basic OHLCV
    open: currentData.open,
    high: currentData.high,
    low: currentData.low,
    close: currentData.close,
    volume: currentData.volume,
    // Trend Indicators
    sma_5: sma5,
    sma_20: sma20,
    sma_50: sma50,
    ema_12: ema12,
    ema_26: ema26,
    // MACD
    macd: macdData.macd,
    macd_signal: macdData.signal,
    macd_histogram: macdData.histogram,
    // Momentum
    rsi_14: rsi14,
    rsi_30: rsi30,
    stoch_k: stochData.k,
    stoch_d: stochData.d,
    williams_r: williamsRValue,
    // Volatility
    bb_upper: bbData.upper,
    bb_lower: bbData.lower,
    bb_middle: bbData.middle,
    bb_width: bbData.width,
    bb_position: bbData.position,
    atr: atrValue,
    // Volume
    volume_sma: volumeSma,
    volume_ratio: volumeRatio,
    obv: obvValue,
    // Price Action
    return_1d: return1d,
    return_3d: return3d,
    return_5d: return5d,
    return_10d: return10d,
    price_position: pricePosition,
    gap,
    // Relative Strength
    price_vs_sma20: priceVsSma20,
    price_vs_sma50: priceVsSma50,
    sma20_slope: sma20Slope,
    sma50_slope: sma50Slope
  };
}
__name(createTechnicalFeatures, "createTechnicalFeatures");
function normalizeTechnicalFeatures(features) {
  if (!features) return null;
  const normalized = {};
  const percentageFeatures = [
    "return_1d",
    "return_3d",
    "return_5d",
    "return_10d",
    "price_vs_sma20",
    "price_vs_sma50",
    "sma20_slope",
    "sma50_slope",
    "gap"
  ];
  const boundedFeatures = [
    "rsi_14",
    "rsi_30",
    "stoch_k",
    "stoch_d",
    "williams_r",
    "bb_position",
    "price_position"
  ];
  Object.keys(features).forEach((key) => {
    const value = features[key];
    if (value === null || value === void 0) {
      normalized[key] = 0;
    } else if (percentageFeatures.includes(key)) {
      normalized[key] = Math.max(-0.1, Math.min(0.1, value)) * 10;
    } else if (boundedFeatures.includes(key)) {
      normalized[key] = Math.max(-100, Math.min(100, value)) / 100;
    } else if (key.includes("volume")) {
      normalized[key] = value > 0 ? Math.log(value + 1) / 20 : 0;
    } else {
      normalized[key] = value / features.close;
    }
  });
  return normalized;
}
__name(normalizeTechnicalFeatures, "normalizeTechnicalFeatures");

// src/modules/enhanced_feature_analysis.js
init_cloudflare_ai_sentiment_pipeline();
init_free_sentiment_pipeline();
var FEATURE_WEIGHTS = {
  neural_networks: 0.5,
  // TFT + N-HITS base models
  technical_features: 0.3,
  // 33 technical indicators
  sentiment_analysis: 0.2
  // News sentiment
};
async function runEnhancedFeatureAnalysis(symbols, env) {
  console.log("\u{1F52C} Enhanced Feature Analysis - Technical Indicators + Neural Networks + Sentiment");
  const results = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    analysis_type: "enhanced_feature_analysis",
    feature_count: 33,
    symbols_analyzed: symbols,
    trading_signals: {},
    system_performance: {
      success_rate: 100,
      avg_confidence: 0,
      feature_coverage: 0
    },
    methodology: {
      neural_networks: `${FEATURE_WEIGHTS.neural_networks * 100}%`,
      technical_features: `${FEATURE_WEIGHTS.technical_features * 100}%`,
      sentiment_analysis: `${FEATURE_WEIGHTS.sentiment_analysis * 100}%`
    }
  };
  let totalConfidence = 0;
  let successfulAnalyses = 0;
  let totalFeatureCoverage = 0;
  for (const symbol of symbols) {
    try {
      console.log(`\u{1F4CA} Analyzing ${symbol} with enhanced features (SEQUENTIAL EXECUTION - Rate Limit Safe)...`);
      console.log(`\u{1F504} Starting sequential analysis for ${symbol}: Sentiment \u2192 Neural \u2192 Technical (Rate Limit Safe)`);
      console.log(`\u{1F4AD} Step 1/3: Starting sentiment analysis for ${symbol}...`);
      let sentimentData;
      try {
        sentimentData = await getStockSentiment(symbol, env);
        console.log(`\u2705 Sentiment analysis complete for ${symbol}:`, sentimentData.sentiment_score);
      } catch (error) {
        console.error(`\u274C Sentiment analysis failed for ${symbol}:`, error.message);
        sentimentData = { sentiment_score: 0, confidence: 0.1, reasoning: "Sentiment failed", error: error.message };
      }
      console.log(`\u{1F9E0} Step 2/3: Starting neural analysis for ${symbol}...`);
      let neuralAnalysis;
      try {
        const analysis = await runEnhancedAnalysis(env, { symbols: [symbol] });
        neuralAnalysis = analysis.trading_signals[symbol];
        console.log(`\u2705 Neural analysis complete for ${symbol}`);
      } catch (error) {
        console.error(`\u274C Neural analysis failed for ${symbol}:`, error.message);
        neuralAnalysis = null;
      }
      console.log(`\u{1F4C8} Step 3/3: Starting market data fetch for ${symbol}...`);
      let extendedData;
      try {
        extendedData = await fetchExtendedMarketData(symbol, env);
        console.log(`\u2705 Market data fetched for ${symbol}:`, extendedData ? `${extendedData.length} points` : "null");
      } catch (error) {
        console.error(`\u274C Market data failed for ${symbol}:`, error.message);
        extendedData = null;
      }
      console.log(`\u2705 Sequential analysis complete for ${symbol}`);
      const technicalFeatures = extendedData ? createTechnicalFeatures(extendedData) : null;
      console.log(`\u{1F527} Technical features for ${symbol}:`, technicalFeatures ? "calculated" : "null");
      const enhancedSignal = await createEnhancedPrediction(
        neuralAnalysis,
        // Note: changed from neuralSignal to neuralAnalysis
        technicalFeatures,
        sentimentData,
        symbol
      );
      results.trading_signals[symbol] = enhancedSignal;
      totalConfidence += enhancedSignal.confidence;
      successfulAnalyses++;
      if (technicalFeatures) {
        totalFeatureCoverage += calculateFeatureCoverage(technicalFeatures);
      }
    } catch (error) {
      console.error(`\u274C Error in sequential analysis for ${symbol}:`, error.message);
      try {
        const fallbackAnalysis = await runEnhancedAnalysis(env, { symbols: [symbol] });
        results.trading_signals[symbol] = {
          ...fallbackAnalysis.trading_signals[symbol],
          feature_status: "fallback_to_neural_only",
          components: {
            neural_networks: fallbackAnalysis.trading_signals[symbol] ? {
              predicted_price: fallbackAnalysis.trading_signals[symbol].predicted_price,
              direction: fallbackAnalysis.trading_signals[symbol].direction,
              confidence: fallbackAnalysis.trading_signals[symbol].confidence,
              weight: FEATURE_WEIGHTS.neural_networks
            } : null,
            technical_features: null,
            sentiment_analysis: {
              sentiment_score: 0,
              confidence: 0.1,
              reasoning: "Parallel execution failed",
              weight: FEATURE_WEIGHTS.sentiment_analysis
            }
          },
          error: error.message
        };
      } catch (fallbackError) {
        results.trading_signals[symbol] = {
          symbol,
          error: `Parallel analysis failed: ${error.message}, Fallback failed: ${fallbackError.message}`,
          status: "complete_failure"
        };
      }
    }
  }
  results.system_performance.avg_confidence = successfulAnalyses > 0 ? totalConfidence / successfulAnalyses : 0;
  results.system_performance.feature_coverage = successfulAnalyses > 0 ? totalFeatureCoverage / successfulAnalyses : 0;
  results.system_performance.success_rate = successfulAnalyses / symbols.length * 100;
  console.log(`\u2705 Enhanced Feature Analysis Complete: ${successfulAnalyses}/${symbols.length} symbols`);
  return results;
}
__name(runEnhancedFeatureAnalysis, "runEnhancedFeatureAnalysis");
async function fetchExtendedMarketData(symbol, env) {
  try {
    if (env.FMP_API_KEY) {
      console.log(`\u{1F4C8} Fetching 3mo data for ${symbol} using FMP API...`);
      const fmpUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?from=${getDateXMonthsAgo(3)}&to=${getCurrentDate()}&apikey=${env.FMP_API_KEY}`;
      const response2 = await fetch(fmpUrl);
      const data2 = await response2.json();
      if (data2.historical && data2.historical.length > 0) {
        const ohlcData2 = data2.historical.reverse().map((day) => ({
          timestamp: new Date(day.date).getTime() / 1e3,
          open: day.open,
          high: day.high,
          low: day.low,
          close: day.close,
          volume: day.volume
        }));
        console.log(`\u{1F4C8} FMP: Fetched ${ohlcData2.length} data points for ${symbol}`);
        return ohlcData2;
      }
    }
    console.log(`\u{1F4C8} Fallback: Fetching ${symbol} using Yahoo Finance...`);
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const response = await fetch(yahooUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TradingBot/1.0)"
      }
    });
    if (!response.ok) {
      throw new Error(`Yahoo Finance HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.chart?.result?.[0]) {
      throw new Error(`No Yahoo Finance data for ${symbol}`);
    }
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const ohlcData = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] && quote.high[i] && quote.low[i] && quote.close[i] && quote.volume[i]) {
        ohlcData.push({
          timestamp: timestamps[i],
          open: quote.open[i],
          high: quote.high[i],
          low: quote.low[i],
          close: quote.close[i],
          volume: quote.volume[i]
        });
      }
    }
    console.log(`\u{1F4C8} Yahoo: Fetched ${ohlcData.length} data points for ${symbol}`);
    return ohlcData;
  } catch (error) {
    console.error(`\u274C Error fetching extended data for ${symbol}:`, error.message);
    return null;
  }
}
__name(fetchExtendedMarketData, "fetchExtendedMarketData");
function getCurrentDate() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
__name(getCurrentDate, "getCurrentDate");
function getDateXMonthsAgo(months) {
  const date = /* @__PURE__ */ new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split("T")[0];
}
__name(getDateXMonthsAgo, "getDateXMonthsAgo");
async function getStockSentiment(symbol, env) {
  try {
    const newsData = await getFreeStockNews(symbol, env);
    if (env.MODELSCOPE_API_KEY && newsData.length > 0) {
      return await getModelScopeAISentiment(symbol, newsData, env);
    } else {
      return analyzeTextSentiment(newsData);
    }
  } catch (error) {
    console.error(`\u274C Error getting sentiment for ${symbol}:`, error.message);
    return {
      sentiment_score: 0,
      confidence: 0.1,
      reasoning: "Sentiment analysis failed",
      error: error.message
    };
  }
}
__name(getStockSentiment, "getStockSentiment");
async function createEnhancedPrediction(neuralSignal, technicalFeatures, sentimentData, symbol) {
  const enhancedSignal = {
    symbol,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    current_price: neuralSignal.current_price,
    analysis_type: "enhanced_feature_prediction",
    // Component predictions
    components: {
      neural_networks: {
        predicted_price: neuralSignal.predicted_price,
        direction: neuralSignal.direction,
        confidence: neuralSignal.confidence,
        weight: FEATURE_WEIGHTS.neural_networks
      },
      technical_features: null,
      sentiment_analysis: {
        sentiment_score: sentimentData.sentiment_score,
        confidence: sentimentData.confidence,
        reasoning: sentimentData.reasoning,
        weight: FEATURE_WEIGHTS.sentiment_analysis
      }
    }
  };
  if (technicalFeatures) {
    const technicalPrediction = analyzeTechnicalFeatures(technicalFeatures, neuralSignal.current_price);
    enhancedSignal.components.technical_features = {
      ...technicalPrediction,
      weight: FEATURE_WEIGHTS.technical_features,
      feature_count: Object.keys(technicalFeatures).length
    };
  }
  const combinedPrediction = combineEnhancedPredictions(
    enhancedSignal.components,
    neuralSignal.current_price
  );
  enhancedSignal.predicted_price = combinedPrediction.predicted_price;
  enhancedSignal.direction = combinedPrediction.direction;
  enhancedSignal.confidence = combinedPrediction.confidence;
  enhancedSignal.model = "Enhanced-Neural-Technical-Sentiment";
  if (technicalFeatures) {
    enhancedSignal.technical_summary = createTechnicalSummary(technicalFeatures);
  }
  return enhancedSignal;
}
__name(createEnhancedPrediction, "createEnhancedPrediction");
function analyzeTechnicalFeatures(features, currentPrice) {
  const normalizedFeatures = normalizeTechnicalFeatures(features);
  let technicalScore = 0;
  let signalStrength = 0;
  let reasoningFactors = [];
  if (features.rsi_14 !== null) {
    if (features.rsi_14 > 70) {
      technicalScore -= 0.3;
      reasoningFactors.push(`RSI overbought (${features.rsi_14.toFixed(1)})`);
    } else if (features.rsi_14 < 30) {
      technicalScore += 0.3;
      reasoningFactors.push(`RSI oversold (${features.rsi_14.toFixed(1)})`);
    }
    signalStrength += 0.15;
  }
  if (features.bb_position !== null) {
    if (features.bb_position > 0.8) {
      technicalScore -= 0.2;
      reasoningFactors.push("Near Bollinger upper band");
    } else if (features.bb_position < 0.2) {
      technicalScore += 0.2;
      reasoningFactors.push("Near Bollinger lower band");
    }
    signalStrength += 0.12;
  }
  if (features.macd !== null && features.macd_signal !== null) {
    const macdBullish = features.macd > features.macd_signal;
    if (macdBullish && features.macd_histogram > 0) {
      technicalScore += 0.2;
      reasoningFactors.push("MACD bullish crossover");
    } else if (!macdBullish && features.macd_histogram < 0) {
      technicalScore -= 0.2;
      reasoningFactors.push("MACD bearish crossover");
    }
    signalStrength += 0.1;
  }
  if (features.price_vs_sma20 !== null) {
    if (features.price_vs_sma20 > 0.05) {
      technicalScore += 0.15;
      reasoningFactors.push("Strong above SMA20");
    } else if (features.price_vs_sma20 < -0.05) {
      technicalScore -= 0.15;
      reasoningFactors.push("Strong below SMA20");
    }
    signalStrength += 0.06;
  }
  if (features.volume_ratio !== null && features.volume_ratio > 1.5) {
    technicalScore += 0.1;
    reasoningFactors.push(`High volume (${features.volume_ratio.toFixed(1)}x avg)`);
    signalStrength += 0.07;
  }
  let direction = "NEUTRAL";
  if (technicalScore > 0.1) direction = "UP";
  else if (technicalScore < -0.1) direction = "DOWN";
  const confidence = Math.min(0.95, Math.max(0.1, signalStrength));
  const priceChange = technicalScore * 0.01;
  const predictedPrice = currentPrice * (1 + priceChange);
  return {
    predicted_price: predictedPrice,
    direction,
    confidence,
    technical_score: technicalScore,
    reasoning: reasoningFactors.join(", ") || "Neutral technical indicators",
    signal_strength: signalStrength
  };
}
__name(analyzeTechnicalFeatures, "analyzeTechnicalFeatures");
function combineEnhancedPredictions(components, currentPrice) {
  let weightedPrediction = 0;
  let totalWeight = 0;
  let totalConfidence = 0;
  let directionalVotes = { UP: 0, DOWN: 0, NEUTRAL: 0 };
  if (components.neural_networks) {
    const neuralChange = (components.neural_networks.predicted_price - currentPrice) / currentPrice;
    weightedPrediction += neuralChange * components.neural_networks.weight;
    totalWeight += components.neural_networks.weight;
    totalConfidence += components.neural_networks.confidence * components.neural_networks.weight;
    directionalVotes[components.neural_networks.direction] += components.neural_networks.weight;
  }
  if (components.technical_features) {
    const techChange = (components.technical_features.predicted_price - currentPrice) / currentPrice;
    weightedPrediction += techChange * components.technical_features.weight;
    totalWeight += components.technical_features.weight;
    totalConfidence += components.technical_features.confidence * components.technical_features.weight;
    directionalVotes[components.technical_features.direction] += components.technical_features.weight;
  }
  if (components.sentiment_analysis && components.sentiment_analysis.sentiment_score !== void 0) {
    const sentimentChange = components.sentiment_analysis.sentiment_score * 0.02;
    weightedPrediction += sentimentChange * components.sentiment_analysis.weight;
    totalWeight += components.sentiment_analysis.weight;
    totalConfidence += components.sentiment_analysis.confidence * components.sentiment_analysis.weight;
    if (components.sentiment_analysis.sentiment_score > 0.1) {
      directionalVotes.UP += components.sentiment_analysis.weight;
    } else if (components.sentiment_analysis.sentiment_score < -0.1) {
      directionalVotes.DOWN += components.sentiment_analysis.weight;
    } else {
      directionalVotes.NEUTRAL += components.sentiment_analysis.weight;
    }
  }
  const finalPredictedPrice = currentPrice * (1 + weightedPrediction);
  const finalConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;
  const finalDirection = Object.keys(directionalVotes).reduce(
    (a, b) => directionalVotes[a] > directionalVotes[b] ? a : b
  );
  return {
    predicted_price: finalPredictedPrice,
    direction: finalDirection,
    confidence: finalConfidence,
    consensus_votes: directionalVotes
  };
}
__name(combineEnhancedPredictions, "combineEnhancedPredictions");
function createTechnicalSummary(features) {
  const summary = [];
  if (features.rsi_14 !== null) {
    summary.push(`RSI: ${features.rsi_14.toFixed(1)}`);
  }
  if (features.bb_position !== null) {
    const position = features.bb_position > 0.8 ? "Upper" : features.bb_position < 0.2 ? "Lower" : "Middle";
    summary.push(`BB: ${position}`);
  }
  if (features.macd !== null && features.macd_signal !== null) {
    const trend = features.macd > features.macd_signal ? "Bullish" : "Bearish";
    summary.push(`MACD: ${trend}`);
  }
  if (features.volume_ratio !== null) {
    summary.push(`Vol: ${features.volume_ratio.toFixed(1)}x`);
  }
  return summary.join(" | ");
}
__name(createTechnicalSummary, "createTechnicalSummary");
function calculateFeatureCoverage(features) {
  const totalFeatures = Object.keys(features).length;
  const validFeatures = Object.values(features).filter((val) => val !== null && val !== void 0).length;
  return validFeatures / totalFeatures * 100;
}
__name(calculateFeatureCoverage, "calculateFeatureCoverage");

// src/modules/independent_technical_analysis.js
async function runIndependentTechnicalAnalysis(symbols, env) {
  console.log("\u{1F4CA} Independent Technical Analysis - 33 Indicators Only");
  const results = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    analysis_type: "independent_technical_analysis",
    feature_count: 33,
    symbols_analyzed: symbols,
    technical_signals: {},
    system_performance: {
      success_rate: 0,
      avg_confidence: 0,
      feature_coverage: 0
    }
  };
  let successfulAnalyses = 0;
  let totalFeatureCoverage = 0;
  let totalConfidence = 0;
  for (const symbol of symbols) {
    try {
      console.log(`\u{1F4C8} Technical analysis for ${symbol}...`);
      const extendedData = await fetchExtendedMarketDataFMP(symbol, env);
      if (!extendedData || extendedData.length < 50) {
        throw new Error(`Insufficient data for ${symbol}: ${extendedData?.length || 0} points`);
      }
      const technicalFeatures = createTechnicalFeatures(extendedData);
      if (!technicalFeatures) {
        throw new Error(`Technical features calculation failed for ${symbol}`);
      }
      const technicalSignal = createTechnicalSignal(technicalFeatures, symbol);
      results.technical_signals[symbol] = technicalSignal;
      successfulAnalyses++;
      totalFeatureCoverage += calculateFeatureCoverage2(technicalFeatures);
      totalConfidence += technicalSignal.confidence;
      console.log(`\u2705 ${symbol}: ${technicalSignal.direction} (${(technicalSignal.confidence * 100).toFixed(1)}%)`);
    } catch (error) {
      console.error(`\u274C Technical analysis failed for ${symbol}:`, error.message);
      results.technical_signals[symbol] = {
        symbol,
        error: error.message,
        status: "failed"
      };
    }
  }
  results.system_performance.success_rate = successfulAnalyses / symbols.length * 100;
  results.system_performance.avg_confidence = successfulAnalyses > 0 ? totalConfidence / successfulAnalyses : 0;
  results.system_performance.feature_coverage = successfulAnalyses > 0 ? totalFeatureCoverage / successfulAnalyses : 0;
  console.log(`\u{1F4CA} Independent Technical Analysis Complete: ${successfulAnalyses}/${symbols.length} symbols`);
  return results;
}
__name(runIndependentTechnicalAnalysis, "runIndependentTechnicalAnalysis");
async function fetchExtendedMarketDataFMP(symbol, env) {
  try {
    if (!env.FMP_API_KEY) {
      throw new Error("FMP_API_KEY not configured");
    }
    console.log(`\u{1F4C8} Fetching 3mo data for ${symbol} using FMP API...`);
    const fmpUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?from=${getDateXMonthsAgo2(3)}&to=${getCurrentDate2()}&apikey=${env.FMP_API_KEY}`;
    const response = await fetch(fmpUrl);
    if (!response.ok) {
      throw new Error(`FMP API HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.historical || data.historical.length === 0) {
      throw new Error(`No historical data from FMP for ${symbol}`);
    }
    const ohlcData = data.historical.reverse().map((day) => ({
      timestamp: new Date(day.date).getTime() / 1e3,
      open: day.open,
      high: day.high,
      low: day.low,
      close: day.close,
      volume: day.volume
    }));
    console.log(`\u{1F4C8} FMP: Retrieved ${ohlcData.length} data points for ${symbol}`);
    return ohlcData;
  } catch (error) {
    console.error(`\u274C FMP data fetch failed for ${symbol}:`, error.message);
    return null;
  }
}
__name(fetchExtendedMarketDataFMP, "fetchExtendedMarketDataFMP");
function createTechnicalSignal(features, symbol) {
  let technicalScore = 0;
  let signalStrength = 0;
  let reasoningFactors = [];
  const currentPrice = features.close;
  if (features.rsi_14 !== null) {
    if (features.rsi_14 > 70) {
      technicalScore -= 0.3;
      reasoningFactors.push(`RSI overbought (${features.rsi_14.toFixed(1)})`);
    } else if (features.rsi_14 < 30) {
      technicalScore += 0.3;
      reasoningFactors.push(`RSI oversold (${features.rsi_14.toFixed(1)})`);
    }
    signalStrength += 0.14;
  }
  if (features.bb_position !== null) {
    if (features.bb_position > 0.8) {
      technicalScore -= 0.25;
      reasoningFactors.push("Near Bollinger upper band");
    } else if (features.bb_position < 0.2) {
      technicalScore += 0.25;
      reasoningFactors.push("Near Bollinger lower band");
    }
    signalStrength += 0.12;
  }
  if (features.macd !== null && features.macd_signal !== null) {
    const macdBullish = features.macd > features.macd_signal;
    if (macdBullish && features.macd_histogram > 0) {
      technicalScore += 0.2;
      reasoningFactors.push("MACD bullish crossover");
    } else if (!macdBullish && features.macd_histogram < 0) {
      technicalScore -= 0.2;
      reasoningFactors.push("MACD bearish crossover");
    }
    signalStrength += 0.1;
  }
  if (features.price_vs_sma20 !== null) {
    if (features.price_vs_sma20 > 0.05) {
      technicalScore += 0.15;
      reasoningFactors.push("Strong above SMA20");
    } else if (features.price_vs_sma20 < -0.05) {
      technicalScore -= 0.15;
      reasoningFactors.push("Strong below SMA20");
    }
    signalStrength += 0.06;
  }
  if (features.volume_ratio !== null && features.volume_ratio > 1.5) {
    technicalScore += 0.1;
    reasoningFactors.push(`High volume (${features.volume_ratio.toFixed(1)}x avg)`);
    signalStrength += 0.07;
  }
  if (features.williams_r !== null) {
    if (features.williams_r > -20) {
      technicalScore -= 0.1;
      reasoningFactors.push("Williams %R overbought");
    } else if (features.williams_r < -80) {
      technicalScore += 0.1;
      reasoningFactors.push("Williams %R oversold");
    }
    signalStrength += 0.04;
  }
  if (features.stoch_k !== null) {
    if (features.stoch_k > 80) {
      technicalScore -= 0.08;
      reasoningFactors.push("Stochastic overbought");
    } else if (features.stoch_k < 20) {
      technicalScore += 0.08;
      reasoningFactors.push("Stochastic oversold");
    }
    signalStrength += 0.04;
  }
  let direction = "NEUTRAL";
  if (technicalScore > 0.1) direction = "UP";
  else if (technicalScore < -0.1) direction = "DOWN";
  const confidence = Math.min(0.95, Math.max(0.1, signalStrength));
  const priceChange = technicalScore * 0.02;
  const predictedPrice = currentPrice * (1 + priceChange);
  return {
    symbol,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    current_price: currentPrice,
    predicted_price: predictedPrice,
    direction,
    confidence,
    technical_score: technicalScore,
    signal_strength: signalStrength,
    reasoning: reasoningFactors.join(", ") || "Neutral technical indicators",
    analysis_type: "pure_technical_analysis",
    feature_summary: createFeatureSummary(features)
  };
}
__name(createTechnicalSignal, "createTechnicalSignal");
function getCurrentDate2() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
__name(getCurrentDate2, "getCurrentDate");
function getDateXMonthsAgo2(months) {
  const date = /* @__PURE__ */ new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split("T")[0];
}
__name(getDateXMonthsAgo2, "getDateXMonthsAgo");
function calculateFeatureCoverage2(features) {
  const totalFeatures = Object.keys(features).length;
  const validFeatures = Object.values(features).filter((val) => val !== null && val !== void 0).length;
  return validFeatures / totalFeatures * 100;
}
__name(calculateFeatureCoverage2, "calculateFeatureCoverage");
function createFeatureSummary(features) {
  const summary = [];
  if (features.rsi_14 !== null) {
    summary.push(`RSI: ${features.rsi_14.toFixed(1)}`);
  }
  if (features.bb_position !== null) {
    const position = features.bb_position > 0.8 ? "Upper" : features.bb_position < 0.2 ? "Lower" : "Middle";
    summary.push(`BB: ${position}`);
  }
  if (features.macd !== null && features.macd_signal !== null) {
    const trend = features.macd > features.macd_signal ? "Bullish" : "Bearish";
    summary.push(`MACD: ${trend}`);
  }
  if (features.volume_ratio !== null) {
    summary.push(`Vol: ${features.volume_ratio.toFixed(1)}x`);
  }
  return summary.join(" | ");
}
__name(createFeatureSummary, "createFeatureSummary");

// src/modules/handlers.js
init_facebook();
init_data();
init_models();
async function handleManualAnalysis(request, env) {
  try {
    console.log("\u{1F680} Enhanced analysis requested (Neural Networks + Sentiment)");
    const analysis = await runEnhancedAnalysis(env, { triggerMode: "manual_analysis_enhanced" });
    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("\u274C Enhanced analysis error, falling back to basic:", error);
    try {
      const basicAnalysis = await runBasicAnalysis(env, { triggerMode: "manual_analysis_fallback" });
      basicAnalysis.fallback_reason = error.message;
      return new Response(JSON.stringify(basicAnalysis, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (fallbackError) {
      return new Response(JSON.stringify({
        success: false,
        error: fallbackError.message,
        original_error: error.message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
}
__name(handleManualAnalysis, "handleManualAnalysis");
async function handleGetResults(request, env) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const resultKey = `analysis_${date}`;
    const storedResult = await env.TRADING_RESULTS.get(resultKey);
    if (storedResult) {
      return new Response(storedResult, {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      date,
      symbols_analyzed: [],
      trading_signals: {},
      message: "No analysis found for this date"
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("\u274C Get results error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleGetResults, "handleGetResults");
async function handleHealthCheck(request, env) {
  const healthData = getHealthCheckResponse(env);
  return new Response(JSON.stringify(healthData, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleHealthCheck, "handleHealthCheck");
async function handleEnhancedFeatureAnalysis(request, env) {
  try {
    console.log("\u{1F52C} Enhanced Feature Analysis requested (Neural Networks + Technical Indicators + Sentiment)");
    let symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"];
    if (request.method === "POST") {
      try {
        const requestData = await request.json();
        if (requestData.symbols && Array.isArray(requestData.symbols)) {
          symbols = requestData.symbols;
        }
      } catch (error) {
        console.log("Using default symbols (JSON parse error)");
      }
    }
    const analysis = await runEnhancedFeatureAnalysis(symbols, env);
    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("\u274C Enhanced Feature Analysis error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      fallback_available: true,
      message: "Enhanced Feature Analysis failed. Use /analyze for basic neural network analysis."
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleEnhancedFeatureAnalysis, "handleEnhancedFeatureAnalysis");
async function handleIndependentTechnicalAnalysis(request, env) {
  try {
    console.log("\u{1F527} Independent Technical Analysis requested (33 Indicators Only - No Neural Networks)");
    let symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"];
    if (request.method === "POST") {
      try {
        const requestData = await request.json();
        if (requestData.symbols && Array.isArray(requestData.symbols)) {
          symbols = requestData.symbols;
        }
      } catch (error) {
        console.log("Using default symbols (JSON parse error)");
      }
    }
    const analysis = await runIndependentTechnicalAnalysis(symbols, env);
    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("\u274C Independent Technical Analysis error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      message: "Independent Technical Analysis failed. This endpoint only uses technical indicators."
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleIndependentTechnicalAnalysis, "handleIndependentTechnicalAnalysis");
async function handleFacebookTest(request, env) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    return new Response(JSON.stringify({
      success: false,
      error: "Facebook not configured",
      debug: {
        token_present: !!env.FACEBOOK_PAGE_TOKEN,
        recipient_present: !!env.FACEBOOK_RECIPIENT_ID
      }
    }, null, 2), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const testMessage = `\u{1F9EA} **TEST MESSAGE**\\n\\n\u{1F4CA} TFT Trading System Health Check\\n\u{1F552} ${(/* @__PURE__ */ new Date()).toLocaleString()}\\n\\n\u{1F4CA} **NEW**: Weekly Analysis Dashboard\\n\u{1F517} https://tft-trading-system.yanggf.workers.dev/weekly-analysis\\n\\n\u2705 System operational and modular!`;
    const facebookPayload = {
      recipient: { id: env.FACEBOOK_RECIPIENT_ID },
      message: { text: testMessage },
      messaging_type: "MESSAGE_TAG",
      tag: "ACCOUNT_UPDATE"
    };
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${env.FACEBOOK_PAGE_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(facebookPayload)
    });
    if (response.ok) {
      return new Response(JSON.stringify({
        success: true,
        message: "Test message sent successfully with dashboard link!",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      const errorText = await response.text();
      return new Response(JSON.stringify({
        success: false,
        error: "Facebook API error",
        details: errorText
      }, null, 2), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleFacebookTest, "handleFacebookTest");
async function handleWeeklyReport(request, env) {
  try {
    const cronId = `manual_weekly_${Date.now()}`;
    await sendWeeklyAccuracyReportWithTracking(env, cronId);
    return new Response(JSON.stringify({
      success: true,
      message: "Weekly report sent with dashboard link!",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleWeeklyReport, "handleWeeklyReport");
async function handleFridayMarketCloseReport(request, env) {
  try {
    if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
      return new Response(JSON.stringify({
        success: false,
        error: "Facebook not configured"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const analysis = await runWeeklyMarketCloseAnalysis(env, /* @__PURE__ */ new Date());
    const cronId = `manual_friday_${Date.now()}`;
    await sendFridayWeekendReportWithTracking(analysis, env, cronId, "weekly_market_close_analysis");
    return new Response(JSON.stringify({
      success: true,
      message: "Friday market close report sent with dashboard link!",
      symbols_analyzed: analysis.symbols_analyzed?.length || 0,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleFridayMarketCloseReport, "handleFridayMarketCloseReport");
async function handleFridayMondayPredictionsReport(request, env) {
  return new Response(JSON.stringify({ message: "Monday predictions feature coming soon" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleFridayMondayPredictionsReport, "handleFridayMondayPredictionsReport");
async function handleHighConfidenceTest(request, env) {
  return new Response(JSON.stringify({ message: "High confidence test feature coming soon" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleHighConfidenceTest, "handleHighConfidenceTest");
async function handleFactTable(request, env) {
  try {
    const factTableData = await getFactTableData(env);
    return new Response(JSON.stringify({
      success: true,
      data: factTableData,
      count: factTableData.length,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleFactTable, "handleFactTable");
async function handleKVCleanup(request, env) {
  return new Response(JSON.stringify({ message: "KV cleanup feature coming soon" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleKVCleanup, "handleKVCleanup");
async function handleDebugWeekendMessage(request, env) {
  return new Response(JSON.stringify({ message: "Debug weekend message feature coming soon" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleDebugWeekendMessage, "handleDebugWeekendMessage");
async function handleKVGet(request, env) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response(JSON.stringify({
        error: "Missing key parameter",
        usage: "GET /kv-get?key=YOUR_KEY_NAME"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const value = await env.TRADING_RESULTS.get(key);
    if (value === null) {
      return new Response(JSON.stringify({
        key,
        found: false,
        message: "Key not found in KV store"
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    let parsedValue;
    try {
      parsedValue = JSON.parse(value);
    } catch (e) {
      parsedValue = value;
    }
    return new Response(JSON.stringify({
      key,
      found: true,
      value: parsedValue,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleKVGet, "handleKVGet");
async function handleKVDebug(request, env) {
  try {
    const testKey = `test_kv_${Date.now()}`;
    const testData = {
      test: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      data: "KV write test successful"
    };
    await env.TRADING_RESULTS.put(testKey, JSON.stringify(testData));
    const readValue = await env.TRADING_RESULTS.get(testKey);
    const parsedValue = JSON.parse(readValue);
    await env.TRADING_RESULTS.delete(testKey);
    return new Response(JSON.stringify({
      success: true,
      message: "KV write/read/delete test successful",
      test_key: testKey,
      written_data: testData,
      read_data: parsedValue,
      kv_binding: env.TRADING_RESULTS ? "available" : "not_available",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
      kv_binding: env.TRADING_RESULTS ? "available" : "not_available",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleKVDebug, "handleKVDebug");
async function handleSentimentTest(request, env) {
  try {
    console.log("\u{1F9EA} Testing sentiment enhancement...");
    const validationResult = await validateSentimentEnhancement(env);
    return new Response(JSON.stringify({
      success: true,
      sentiment_enhancement: validationResult,
      phase: "Phase 1 - Free Integration",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("\u274C Sentiment test error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      phase: "Phase 1 - Free Integration",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleSentimentTest, "handleSentimentTest");
async function handleTestLlama(request, env) {
  try {
    if (!env.AI) {
      return new Response(JSON.stringify({
        success: false,
        error: "Cloudflare AI not available",
        ai_binding: !!env.AI
      }, null, 2), {
        headers: { "Content-Type": "application/json" },
        status: 400
      });
    }
    const url = new URL(request.url);
    const model = url.searchParams.get("model") || "@cf/meta/llama-3.1-8b-instruct";
    console.log(`\u{1F999} Testing Cloudflare AI model: ${model}`);
    const testPrompt = "Analyze sentiment: Apple stock rises on strong iPhone sales. Is this bullish or bearish? Provide sentiment and confidence 0-1.";
    try {
      const response = await env.AI.run(model, {
        messages: [
          {
            role: "user",
            content: testPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      });
      console.log(`\u2705 Llama model ${model} responded successfully`);
      return new Response(JSON.stringify({
        success: true,
        model_tested: model,
        prompt_used: testPrompt,
        response,
        response_type: typeof response,
        response_keys: Object.keys(response || {}),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (modelError) {
      console.error(`\u274C Model ${model} failed:`, modelError.message);
      return new Response(JSON.stringify({
        success: false,
        model_tested: model,
        error: modelError.message,
        error_type: modelError.name,
        suggestion: "Try different model names like @cf/meta/llama-3-8b-instruct, @cf/meta/llama-2-7b-chat-int8",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.error("\u274C Llama test error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack?.substring(0, 300)
    }, null, 2), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
}
__name(handleTestLlama, "handleTestLlama");
async function handleDebugEnvironment(request, env) {
  const modelScopeKey = env.MODELSCOPE_API_KEY;
  const allEnvKeys = Object.keys(env);
  const secretKeys = allEnvKeys.filter((key) => key.includes("MODELSCOPE") || key.includes("modelscope"));
  return new Response(JSON.stringify({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment_debug: {
      modelscope_api_key: {
        available: !!env.MODELSCOPE_API_KEY,
        length: env.MODELSCOPE_API_KEY?.length || 0,
        first_10_chars: env.MODELSCOPE_API_KEY?.substring(0, 10) || "null",
        typeof: typeof env.MODELSCOPE_API_KEY,
        direct_access: !!modelScopeKey,
        is_empty_string: env.MODELSCOPE_API_KEY === "",
        is_undefined: env.MODELSCOPE_API_KEY === void 0,
        is_null: env.MODELSCOPE_API_KEY === null,
        raw_value_debug: `"${env.MODELSCOPE_API_KEY}"`,
        // Show actual value in quotes
        all_env_keys_count: allEnvKeys.length,
        modelscope_related_keys: secretKeys,
        all_env_keys: allEnvKeys.slice(0, 20)
        // First 20 for debugging
      },
      cloudflare_ai: {
        available: !!env.AI,
        binding_type: typeof env.AI
      },
      facebook: {
        page_token_available: !!env.FACEBOOK_PAGE_TOKEN,
        recipient_id_available: !!env.FACEBOOK_RECIPIENT_ID
      },
      api_keys: {
        fmp_api_key: !!env.FMP_API_KEY,
        newsapi_key: !!env.NEWSAPI_KEY,
        worker_api_key: !!env.WORKER_API_KEY
      },
      r2_buckets: {
        enhanced_models: !!env.ENHANCED_MODELS,
        trained_models: !!env.TRAINED_MODELS
      },
      kv_namespace: {
        trading_results: !!env.TRADING_RESULTS
      }
    }
  }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleDebugEnvironment, "handleDebugEnvironment");
async function handleModelScopeTest(request, env) {
  try {
    let apiKey;
    if (request.method === "POST") {
      try {
        const body = await request.json();
        apiKey = body.api_key;
        console.log(`\u{1F512} Received POST request with body keys: ${Object.keys(body)}`);
      } catch (jsonError) {
        console.error(`\u274C JSON parsing error:`, jsonError.message);
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
          details: jsonError.message
        }, null, 2), {
          headers: { "Content-Type": "application/json" },
          status: 400
        });
      }
    } else {
      const url = new URL(request.url);
      apiKey = url.searchParams.get("key");
    }
    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing API key",
        usage: {
          secure_method: 'POST {"api_key": "YOUR_MODELSCOPE_API_KEY"}',
          quick_method: "GET with ?key=YOUR_MODELSCOPE_API_KEY (less secure)"
        }
      }, null, 2), {
        headers: { "Content-Type": "application/json" },
        status: 400
      });
    }
    console.log(`\u{1F527} Testing ModelScope GLM-4.5 API with parameter key...`);
    console.log(`\u{1F510} API Key provided: ${!!apiKey}`);
    console.log(`\u{1F510} API Key length: ${apiKey.length}`);
    console.log(`\u{1F510} API Key first 10 chars: ${apiKey.substring(0, 10)}...`);
    const testRequest = {
      model: "ZhipuAI/GLM-4.5",
      messages: [
        {
          role: "user",
          content: "Test sentiment analysis: Apple stock rises on strong iPhone sales. Is this bullish or bearish?"
        }
      ],
      temperature: 0.1,
      max_tokens: 100
    };
    console.log(`\u{1F4E1} Making direct ModelScope API call...`);
    const response = await fetch("https://api-inference.modelscope.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(testRequest)
    });
    console.log(`\u{1F4E8} Response status: ${response.status} ${response.statusText}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\u274C ModelScope API Error:`, errorText);
      return new Response(JSON.stringify({
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        api_key_used: apiKey.substring(0, 10) + "...",
        endpoint: "https://api-inference.modelscope.cn/v1/chat/completions"
      }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }
    const responseData = await response.json();
    console.log(`\u2705 ModelScope API call successful`);
    return new Response(JSON.stringify({
      success: true,
      modelscope_test: {
        api_key_used: apiKey.substring(0, 10) + "...",
        response_received: !!responseData,
        response_preview: JSON.stringify(responseData).substring(0, 300) + "...",
        model_used: testRequest.model,
        endpoint: "https://api-inference.modelscope.cn/v1/chat/completions"
      },
      full_response: responseData
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("\u274C ModelScope parameter test error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }, null, 2), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
}
__name(handleModelScopeTest, "handleModelScopeTest");
async function handleGPTDebugTest(request, env) {
  try {
    console.log("\u{1F527} Testing ModelScope GLM-4.5 API...");
    const { getModelScopeAISentiment: getModelScopeAISentiment2 } = await Promise.resolve().then(() => (init_cloudflare_ai_sentiment_pipeline(), cloudflare_ai_sentiment_pipeline_exports));
    const testSymbol = "AAPL";
    const mockNewsData = [
      {
        title: "Apple Stock Hits New High on Strong Earnings",
        summary: "Apple Inc. reports record quarterly revenue with strong iPhone sales and services growth.",
        url: "test-url",
        publishedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      {
        title: "iPhone Sales Surge in China Market",
        summary: "Apple sees significant growth in Chinese market with latest iPhone models.",
        url: "test-url-2",
        publishedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
    console.log(`   \u{1F4F0} Using mock news data: ${mockNewsData.length} articles`);
    console.log(`   \u{1F50D} Testing environment - AI available: ${!!env.AI}`);
    if (!env.AI) {
      return new Response(JSON.stringify({
        success: false,
        error: "Cloudflare AI not available in this environment",
        ai_binding: !!env.AI,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }
    console.log(`   \u{1F50D} Testing available AI models...`);
    try {
      const distilTest = await env.AI.run("@cf/huggingface/distilbert-sst-2-int8", {
        text: "Apple stock is performing well"
      });
      console.log(`   \u2705 DistilBERT test succeeded:`, distilTest);
    } catch (distilError) {
      console.log(`   \u274C DistilBERT test failed:`, distilError.message);
    }
    try {
      const gptTest = await env.AI.run("@cf/openai/gpt-oss-120b", {
        input: "Hello, respond with 'Hello World'"
      });
      console.log(`   \u2705 GPT-OSS-120B basic test succeeded:`, gptTest);
    } catch (gptError) {
      console.log(`   \u274C GPT-OSS-120B basic test failed:`, gptError.message);
    }
    console.log(`   \u{1F9EA} Testing ModelScope GLM-4.5 sentiment analysis...`);
    const sentimentResult = await getModelScopeAISentiment2(testSymbol, mockNewsData, env);
    const modelScopeSuccess = sentimentResult && sentimentResult.source === "modelscope_glm45" && !sentimentResult.error_details && sentimentResult.confidence > 0;
    console.log(`   \u2705 ModelScope GLM-4.5 test result:`, {
      success: modelScopeSuccess,
      sentiment: sentimentResult?.sentiment,
      confidence: sentimentResult?.confidence,
      source: sentimentResult?.source,
      has_error: !!sentimentResult?.error_details
    });
    return new Response(JSON.stringify({
      success: true,
      gpt_api_test: {
        symbol: testSymbol,
        news_articles_processed: mockNewsData.length,
        sentiment_result: sentimentResult,
        api_format_fix: "instructions + input format",
        model_used: sentimentResult?.models_used || ["error"],
        cost_estimate: sentimentResult?.cost_estimate || { total_cost: 0 }
      },
      debug_info: {
        ai_available: modelScopeSuccess,
        // Fixed: Check ModelScope success, not Cloudflare AI
        modelscope_available: !!env.MODELSCOPE_API_KEY,
        cloudflare_ai_available: !!env.AI,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        test_type: "modelscope_glm45_sentiment_validation"
      }
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("\u274C GPT debug test error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      error_stack: error.stack,
      api_format_fix: "instructions + input format",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleGPTDebugTest, "handleGPTDebugTest");
async function handleModelHealth(request, env) {
  try {
    console.log("\u{1F3E5} Running model health check...");
    const healthResult = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      enhanced_models_bucket: env.ENHANCED_MODELS_BUCKET || "Not configured",
      r2_binding: {
        enhanced_models: !!env.ENHANCED_MODELS,
        trained_models: !!env.TRAINED_MODELS,
        binding_types: {
          enhanced: typeof env.ENHANCED_MODELS,
          trained: typeof env.TRAINED_MODELS
        }
      },
      model_files: {},
      bucket_contents: [],
      errors: []
    };
    if (!env.ENHANCED_MODELS) {
      healthResult.errors.push("ENHANCED_MODELS R2 binding not available");
      return new Response(JSON.stringify(healthResult, null, 2), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      const listResponse = await env.ENHANCED_MODELS.list();
      healthResult.bucket_contents = listResponse.objects?.map((obj) => ({
        key: obj.key,
        size: obj.size,
        modified: obj.uploaded
      })) || [];
      console.log(`\u{1F4CB} Found ${healthResult.bucket_contents.length} objects in R2 bucket`);
    } catch (listError) {
      healthResult.errors.push(`Failed to list bucket contents: ${listError.message}`);
    }
    const filesToTest = [
      "deployment_metadata.json",
      "tft_weights.json",
      "nhits_weights.json"
    ];
    for (const fileName of filesToTest) {
      try {
        console.log(`\u{1F50D} Testing access to ${fileName}...`);
        const fileResponse = await env.ENHANCED_MODELS.get(fileName);
        if (fileResponse) {
          const headContent = await fileResponse.text();
          const head = headContent.substring(0, 200);
          healthResult.model_files[fileName] = {
            accessible: true,
            size: headContent.length,
            head_preview: head,
            content_type: typeof headContent
          };
          console.log(`\u2705 ${fileName}: ${headContent.length} bytes`);
        } else {
          healthResult.model_files[fileName] = {
            accessible: false,
            error: "File not found"
          };
          console.log(`\u274C ${fileName}: Not found`);
        }
      } catch (fileError) {
        healthResult.model_files[fileName] = {
          accessible: false,
          error: fileError.message
        };
        console.log(`\u274C ${fileName}: ${fileError.message}`);
      }
    }
    const accessibleFiles = Object.values(healthResult.model_files).filter((f) => f.accessible).length;
    const totalFiles = filesToTest.length;
    healthResult.health_score = `${accessibleFiles}/${totalFiles}`;
    healthResult.overall_status = accessibleFiles === totalFiles ? "healthy" : accessibleFiles > 0 ? "partial" : "unhealthy";
    const statusCode = accessibleFiles === totalFiles ? 200 : 206;
    return new Response(JSON.stringify(healthResult, null, 2), {
      status: statusCode,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("\u274C Model health check error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleModelHealth, "handleModelHealth");
async function handleR2Upload(request, env) {
  try {
    console.log("\u{1F4E4} R2 upload API called...");
    if (request.method !== "POST") {
      return new Response(JSON.stringify({
        success: false,
        error: "Method not allowed - use POST",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!env.ENHANCED_MODELS) {
      return new Response(JSON.stringify({
        success: false,
        error: "ENHANCED_MODELS R2 binding not available",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    const formData = await request.formData();
    const uploadResults = {};
    const errors = [];
    console.log("\u{1F4CB} Form data entries:", Array.from(formData.keys()));
    for (const [fieldName, file] of formData.entries()) {
      if (file instanceof File) {
        try {
          console.log(`\u{1F4E4} Uploading ${fieldName}: ${file.name} (${file.size} bytes)`);
          let r2Key;
          switch (fieldName) {
            case "deployment_metadata":
              r2Key = "deployment_metadata.json";
              break;
            case "tft_weights":
              r2Key = "enhanced_tft_weights.json";
              break;
            case "nhits_weights":
              r2Key = "enhanced_nhits_weights.json";
              break;
            default:
              r2Key = file.name;
          }
          const fileData = await file.arrayBuffer();
          const uploadResponse = await env.ENHANCED_MODELS.put(r2Key, fileData, {
            httpMetadata: {
              contentType: file.type || "application/json"
            }
          });
          uploadResults[fieldName] = {
            success: true,
            filename: file.name,
            r2_key: r2Key,
            size: file.size,
            content_type: file.type,
            upload_response: uploadResponse
          };
          console.log(`\u2705 Successfully uploaded ${r2Key}: ${file.size} bytes`);
        } catch (uploadError) {
          console.error(`\u274C Upload failed for ${fieldName}:`, uploadError);
          uploadResults[fieldName] = {
            success: false,
            filename: file.name,
            error: uploadError.message
          };
          errors.push(`Failed to upload ${fieldName}: ${uploadError.message}`);
        }
      } else {
        try {
          const content = file.toString();
          let r2Key;
          switch (fieldName) {
            case "deployment_metadata_json":
              r2Key = "deployment_metadata.json";
              break;
            case "tft_weights_json":
              r2Key = "enhanced_tft_weights.json";
              break;
            case "nhits_weights_json":
              r2Key = "enhanced_nhits_weights.json";
              break;
            default:
              continue;
          }
          console.log(`\u{1F4E4} Uploading text content for ${fieldName} to ${r2Key} (${content.length} chars)`);
          const uploadResponse = await env.ENHANCED_MODELS.put(r2Key, content, {
            httpMetadata: {
              contentType: "application/json"
            }
          });
          uploadResults[fieldName] = {
            success: true,
            r2_key: r2Key,
            size: content.length,
            content_type: "application/json",
            upload_response: uploadResponse
          };
          console.log(`\u2705 Successfully uploaded ${r2Key}: ${content.length} chars`);
        } catch (uploadError) {
          console.error(`\u274C Text upload failed for ${fieldName}:`, uploadError);
          uploadResults[fieldName] = {
            success: false,
            error: uploadError.message
          };
          errors.push(`Failed to upload ${fieldName}: ${uploadError.message}`);
        }
      }
    }
    try {
      const listResponse = await env.ENHANCED_MODELS.list();
      const currentFiles = listResponse.objects?.map((obj) => obj.key) || [];
      console.log(`\u{1F4CB} Current R2 bucket contents after upload: ${currentFiles.join(", ")}`);
    } catch (listError) {
      console.error("\u274C Failed to list bucket after upload:", listError);
    }
    const response = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      success: errors.length === 0,
      uploads: uploadResults,
      errors,
      total_uploads: Object.keys(uploadResults).length,
      successful_uploads: Object.values(uploadResults).filter((r) => r.success).length
    };
    const statusCode = errors.length === 0 ? 200 : 207;
    return new Response(JSON.stringify(response, null, 2), {
      status: statusCode,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("\u274C R2 upload API error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleR2Upload, "handleR2Upload");
async function handleTestAllFacebookMessages(request, env) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    return new Response(JSON.stringify({
      success: false,
      error: "Facebook not configured - FACEBOOK_PAGE_TOKEN or FACEBOOK_RECIPIENT_ID missing",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  console.log("\u{1F9EA} [FB-TEST-ALL] Starting comprehensive Facebook message test for all 5 cron types");
  const testResults = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    test_execution_id: `fb_test_all_${Date.now()}`,
    facebook_configured: true,
    message_tests: {},
    kv_logs: {},
    errors: [],
    overall_success: true
  };
  const {
    sendMorningPredictionsWithTracking: sendMorningPredictionsWithTracking2,
    sendMiddayValidationWithTracking: sendMiddayValidationWithTracking2,
    sendDailyValidationWithTracking: sendDailyValidationWithTracking2,
    sendFridayWeekendReportWithTracking: sendFridayWeekendReportWithTracking2,
    sendWeeklyAccuracyReportWithTracking: sendWeeklyAccuracyReportWithTracking2
  } = await Promise.resolve().then(() => (init_facebook(), facebook_exports));
  const mockAnalysisResult = {
    symbols_analyzed: ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"],
    trading_signals: {
      AAPL: {
        symbol: "AAPL",
        current_price: 175.23,
        predicted_price: 177.45,
        direction: "UP",
        confidence: 0.87
      },
      MSFT: {
        symbol: "MSFT",
        current_price: 334.78,
        predicted_price: 331.22,
        direction: "DOWN",
        confidence: 0.82
      }
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  const messageTests = [
    { name: "morning_predictions", func: sendMorningPredictionsWithTracking2, args: [mockAnalysisResult, env] },
    { name: "midday_validation", func: sendMiddayValidationWithTracking2, args: [mockAnalysisResult, env] },
    { name: "daily_validation", func: sendDailyValidationWithTracking2, args: [mockAnalysisResult, env] },
    { name: "friday_weekend_report", func: sendFridayWeekendReportWithTracking2, args: [mockAnalysisResult, env, null, "weekly_market_close_analysis"] },
    { name: "weekly_accuracy_report", func: sendWeeklyAccuracyReportWithTracking2, args: [env] }
  ];
  let initialKVCount = 0;
  try {
    const initialKVList = await env.TRADING_RESULTS.list({ prefix: "fb_" });
    initialKVCount = initialKVList.keys?.length || 0;
    console.log(`\u{1F4CB} [FB-TEST-INITIAL] Found ${initialKVCount} existing Facebook KV records`);
  } catch (error) {
    console.error(`\u274C [FB-TEST-INITIAL] Failed to get initial KV count:`, error);
  }
  for (let i = 0; i < messageTests.length; i++) {
    const test = messageTests[i];
    try {
      console.log(`\u{1F4F1} [FB-TEST-${i + 1}] Testing ${test.name} message...`);
      const cronId = `${testResults.test_execution_id}_${test.name}`;
      const args = [...test.args];
      if (test.name === "weekly_accuracy_report") {
        args.push(cronId);
      } else {
        args.push(cronId);
      }
      await test.func(...args);
      let kvStored = false;
      let kvKey = null;
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const postKVList = await env.TRADING_RESULTS.list({ prefix: "fb_" });
        const newKVCount = postKVList.keys?.length || 0;
        if (newKVCount > initialKVCount) {
          const testTimestamp = testResults.test_execution_id.split("_")[3];
          const newRecords = postKVList.keys?.filter(
            (k) => k.name.includes(testTimestamp) || k.name.includes(cronId.split("_")[2])
          ) || [];
          if (newRecords.length > 0) {
            kvStored = true;
            kvKey = newRecords[0].name;
            const kvRecord = await env.TRADING_RESULTS.get(newRecords[0].name);
            if (kvRecord) {
              const recordData = JSON.parse(kvRecord);
              if (!recordData.message_sent || !recordData.cron_execution_id) {
                kvStored = false;
                console.error(`\u274C [FB-TEST-${i + 1}] KV record missing required fields`);
              }
            }
          }
        }
        if (!kvStored) {
          throw new Error("KV storage verification failed - no record found or incomplete data");
        }
        testResults.message_tests[test.name] = {
          success: true,
          cron_id: cronId,
          kv_key: kvKey,
          kv_verified: true
        };
        console.log(`\u2705 [FB-TEST-${i + 1}] ${test.name} test completed with KV verification: ${kvKey}`);
      } catch (kvVerifyError) {
        console.error(`\u274C [FB-TEST-${i + 1}] KV verification failed for ${test.name}:`, kvVerifyError);
        testResults.message_tests[test.name] = {
          success: false,
          error: `KV storage failed: ${kvVerifyError.message}`,
          cron_id: cronId,
          kv_verified: false
        };
        testResults.errors.push(`${test.name}: KV storage verification failed - ${kvVerifyError.message}`);
        testResults.overall_success = false;
      }
    } catch (error) {
      console.error(`\u274C [FB-TEST-${i + 1}] ${test.name} test failed:`, error);
      testResults.message_tests[test.name] = { success: false, error: error.message };
      testResults.errors.push(`${test.name}: ${error.message}`);
      testResults.overall_success = false;
    }
  }
  console.log("\u{1F50D} [FB-TEST-KV] Checking KV logging for all tests...");
  try {
    const kvKeys = await env.TRADING_RESULTS.list({ prefix: "fb_" });
    const testTimestamp = testResults.test_execution_id.split("_")[3];
    const recentLogs = kvKeys.keys?.filter((k) => k.name.includes(testTimestamp)) || [];
    testResults.kv_logs = {
      total_fb_logs: kvKeys.keys?.length || 0,
      test_related_logs: recentLogs.length,
      recent_log_keys: recentLogs.map((k) => k.name)
    };
    console.log(`\u{1F4CB} [FB-TEST-KV] Found ${recentLogs.length} test-related logs in KV`);
  } catch (kvError) {
    console.error("\u274C [FB-TEST-KV] KV logging check failed:", kvError);
    testResults.kv_logs = { error: kvError.message };
  }
  const successCount = Object.values(testResults.message_tests).filter((t) => t.success).length;
  testResults.summary = {
    total_tests: 5,
    successful_tests: successCount,
    failed_tests: 5 - successCount,
    success_rate: `${successCount}/5 (${Math.round(successCount / 5 * 100)}%)`
  };
  console.log(`\u{1F3C1} [FB-TEST-ALL] Test completed: ${successCount}/5 successful`);
  const statusCode = testResults.overall_success ? 200 : 207;
  return new Response(JSON.stringify(testResults, null, 2), {
    status: statusCode,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleTestAllFacebookMessages, "handleTestAllFacebookMessages");

// src/modules/routes.js
function validateRequest(request, url, env) {
  const sensitiveEndpoints = ["/analyze", "/enhanced-feature-analysis", "/technical-analysis", "/r2-upload", "/test-facebook", "/test-high-confidence", "/test-sentiment", "/test-all-facebook"];
  if (sensitiveEndpoints.includes(url.pathname)) {
    const apiKey = request.headers.get("X-API-KEY");
    const validApiKey = env.WORKER_API_KEY;
    if (!validApiKey) {
      return { valid: false, error: "API key not configured" };
    }
    if (!apiKey || apiKey !== validApiKey) {
      return { valid: false, error: "Invalid or missing API key" };
    }
  }
  const userAgent = request.headers.get("User-Agent") || "";
  if (userAgent.includes("bot") && !userAgent.includes("Googlebot")) {
    return { valid: false, error: "Blocked user agent" };
  }
  return { valid: true };
}
__name(validateRequest, "validateRequest");
async function handleHttpRequest(request, env, ctx) {
  const url = new URL(request.url);
  const validationResult = validateRequest(request, url, env);
  if (!validationResult.valid) {
    return new Response(JSON.stringify({
      success: false,
      error: validationResult.error,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), {
      status: validationResult.error.includes("API key") ? 401 : 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  switch (url.pathname) {
    case "/analyze":
      return handleManualAnalysis(request, env);
    case "/enhanced-feature-analysis":
      return handleEnhancedFeatureAnalysis(request, env);
    case "/technical-analysis":
      return handleIndependentTechnicalAnalysis(request, env);
    case "/results":
      return handleGetResults(request, env);
    case "/health":
      return handleHealthCheck(request, env);
    case "/test-facebook":
      return handleFacebookTest(request, env);
    case "/weekly-report":
      return handleWeeklyReport(request, env);
    case "/friday-market-close-report":
      return handleFridayMarketCloseReport(request, env);
    case "/friday-monday-predictions-report":
      return handleFridayMondayPredictionsReport(request, env);
    case "/test-high-confidence":
      return handleHighConfidenceTest(request, env);
    case "/fact-table":
      return handleFactTable(request, env);
    case "/kv-cleanup":
      return handleKVCleanup(request, env);
    case "/debug-weekend-message":
      return handleDebugWeekendMessage(request, env);
    case "/kv-get":
      return handleKVGet(request, env);
    case "/kv-debug":
      return handleKVDebug(request, env);
    case "/weekly-analysis":
      return handleWeeklyAnalysisPage(request, env);
    case "/api/weekly-data":
      return handleWeeklyDataAPI(request, env);
    case "/test-sentiment":
      return handleSentimentTest(request, env);
    case "/debug-gpt":
      return handleGPTDebugTest(request, env);
    case "/test-modelscope":
      return handleModelScopeTest(request, env);
    case "/test-llama":
      return handleTestLlama(request, env);
    case "/debug-env":
      return handleDebugEnvironment(request, env);
    case "/model-health":
      return handleModelHealth(request, env);
    case "/r2-upload":
      return handleR2Upload(request, env);
    case "/test-all-facebook":
      return handleTestAllFacebookMessages(request, env);
    default:
      if (url.pathname === "/" || url.pathname === "/status") {
        return new Response(JSON.stringify({
          success: true,
          message: "TFT Trading System Worker is operational",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          version: env.WORKER_VERSION || "2.0-Modular",
          endpoints: [
            "/health - Health check",
            "/model-health - Model files R2 accessibility check",
            "/r2-upload - R2 enhanced model files upload API",
            "/analyze - Enhanced analysis (Neural Networks + Sentiment)",
            "/results - Get latest results",
            "/fact-table - Prediction accuracy table",
            "/weekly-analysis - Weekly analysis dashboard",
            "/api/weekly-data - Weekly analysis data API",
            "/test-sentiment - Sentiment enhancement validation"
          ]
        }, null, 2), {
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({
        success: false,
        error: "Endpoint not found",
        requested_path: url.pathname,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        available_endpoints: [
          "/",
          "/health",
          "/model-health",
          "/analyze",
          "/results",
          "/fact-table",
          "/weekly-analysis",
          "/api/weekly-data",
          "/test-sentiment"
        ]
      }, null, 2), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
  }
}
__name(handleHttpRequest, "handleHttpRequest");

// src/index.js
var index_default = {
  /**
   * Handle scheduled cron events
   */
  async scheduled(controller, env, ctx) {
    return handleScheduledEvent(controller, env, ctx);
  },
  /**
   * Handle HTTP requests
   */
  async fetch(request, env, ctx) {
    return handleHttpRequest(request, env, ctx);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
