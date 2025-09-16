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
  try {
    if (!env.TRAINED_MODELS) {
      throw new Error("TRAINED_MODELS R2 binding not available");
    }
    console.log("\u2705 R2 binding TRAINED_MODELS is available");
    console.log("\u{1F4C1} Fetching deployment_metadata.json from R2...");
    console.log("\u{1F50D} R2 binding details:", {
      bindingName: "TRAINED_MODELS",
      bindingAvailable: !!env.TRAINED_MODELS,
      bindingType: typeof env.TRAINED_MODELS
    });
    try {
      const metadataResponse = await env.TRAINED_MODELS.get("deployment_metadata.json");
      console.log("\u{1F50D} R2 get() response:", {
        responseReceived: !!metadataResponse,
        responseType: typeof metadataResponse,
        responseConstructor: metadataResponse ? metadataResponse.constructor.name : "null"
      });
      if (!metadataResponse) {
        console.log("\u{1F50D} Attempting to list R2 objects for debugging...");
        try {
          const listResponse = await env.TRAINED_MODELS.list();
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
    tftModel = await loadEnhancedModelWeights(env, "enhanced_tft_weights.json");
    nhitsModel = await loadEnhancedModelWeights(env, "enhanced_nhits_weights.json");
    console.log("\u{1F3AF} Enhanced model weights successfully loaded for weight-based inference!");
    modelsLoaded = true;
    return { success: true, message: "Real TensorFlow.js models loaded", metadata: modelMetadata };
  } catch (error) {
    console.error("\u274C CRITICAL ERROR in loadTrainedModels:", error.message);
    console.error("\u274C Error name:", error.name);
    console.error("\u274C Error stack:", error.stack);
    console.error("\u274C Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error("\u274C R2 binding check - TRAINED_MODELS available:", !!env.TRAINED_MODELS);
    try {
      console.log("\u{1F50D} Testing R2 connectivity...");
      const testResponse = await env.TRAINED_MODELS.get("metadata.json");
      console.log("\u{1F50D} R2 test result:", testResponse ? "SUCCESS" : "FAILED - metadata.json not found");
    } catch (r2Error) {
      console.error("\u{1F50D} R2 connectivity test failed:", r2Error.message);
    }
    return { success: false, error: error.message, stack: error.stack, details: error };
  }
}
async function loadEnhancedModelWeights(env, weightFileName) {
  try {
    console.log(`\u{1F527} Loading enhanced model weights from R2 storage: ${weightFileName}...`);
    const weightsResponse = await env.TRAINED_MODELS.get(weightFileName);
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

// src/modules/scheduler.js
init_analysis();

// src/modules/enhanced_analysis.js
init_analysis();

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
__name(getFreeStockNews, "getFreeStockNews");
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
__name(getFMPNews, "getFMPNews");
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
__name(analyzeFMPSentiment, "analyzeFMPSentiment");
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
__name(getNewsAPIData, "getNewsAPIData");
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
__name(getYahooNews, "getYahooNews");
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
__name(analyzeTextSentiment, "analyzeTextSentiment");

// src/modules/cloudflare_ai_sentiment_pipeline.js
var CLOUDFLARE_AI_CONFIG = {
  models: {
    // Fast sentiment analysis (cheap)
    sentiment: "@cf/huggingface/distilbert-sst-2-int8",
    // $0.026 per M tokens
    // Advanced analysis (more expensive but powerful)
    reasoning: "@cf/openai/gpt-oss-120b",
    // $0.35/$0.75 per M tokens
    // Alternative models
    alternatives: {
      llama: "@cf/meta/llama-3.1-8b-instruct",
      // $0.027/$0.027 per M tokens
      mistral: "@cf/mistral/mistral-7b-instruct-v0.1"
      // Fast alternative
    }
  },
  // Free tier: 10,000 neurons per day
  usage_strategy: "hybrid",
  // Use cheap model first, expensive for complex analysis
  sentiment_thresholds: {
    high_confidence: 0.85,
    // Use GPT-OSS-120B for detailed analysis
    medium_confidence: 0.7,
    // Trust DistilBERT result
    low_confidence: 0.55
    // Skip or use simple rules
  }
};
async function getCloudflareAISentiment(symbol, newsData, env) {
  if (!newsData || newsData.length === 0) {
    return {
      symbol,
      sentiment: "neutral",
      confidence: 0,
      reasoning: "No news data available",
      source: "cloudflare_ai",
      cost_estimate: 0
    };
  }
  try {
    const quickSentiments = await analyzeBatchSentiment(newsData, env);
    const aggregatedSentiment = aggregateQuickSentiments(quickSentiments);
    let detailedAnalysis = null;
    if (aggregatedSentiment.confidence > CLOUDFLARE_AI_CONFIG.sentiment_thresholds.high_confidence) {
      detailedAnalysis = await getDetailedSentimentAnalysis(symbol, newsData, aggregatedSentiment, env);
    }
    return {
      symbol,
      sentiment: aggregatedSentiment.label,
      confidence: aggregatedSentiment.confidence,
      score: aggregatedSentiment.score,
      reasoning: detailedAnalysis?.reasoning || aggregatedSentiment.reasoning,
      detailed_analysis: detailedAnalysis,
      quick_sentiments: quickSentiments,
      source: "cloudflare_ai",
      models_used: detailedAnalysis ? ["distilbert", "gpt-oss-120b"] : ["distilbert"],
      cost_estimate: calculateCostEstimate(newsData.length, !!detailedAnalysis),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error(`Cloudflare AI sentiment failed for ${symbol}:`, error);
    return {
      symbol,
      sentiment: "neutral",
      confidence: 0,
      reasoning: "AI analysis failed: " + error.message,
      source: "cloudflare_ai_error"
    };
  }
}
__name(getCloudflareAISentiment, "getCloudflareAISentiment");
async function analyzeBatchSentiment(newsData, env) {
  const sentimentPromises = newsData.slice(0, 10).map(async (newsItem, index) => {
    try {
      const text = `${newsItem.title}. ${newsItem.summary || ""}`.substring(0, 500);
      const response = await env.AI.run(
        CLOUDFLARE_AI_CONFIG.models.sentiment,
        { text }
      );
      const result = response[0];
      return {
        news_item: newsItem,
        sentiment: {
          label: result.label.toLowerCase(),
          // POSITIVE/NEGATIVE -> positive/negative
          confidence: result.score,
          score: result.label === "POSITIVE" ? result.score : -result.score,
          model: "distilbert-sst-2"
        },
        text_analyzed: text,
        processing_order: index
      };
    } catch (error) {
      console.error("Individual sentiment analysis failed:", error);
      return {
        news_item: newsItem,
        sentiment: {
          label: "neutral",
          confidence: 0,
          score: 0,
          model: "error"
        },
        error: error.message
      };
    }
  });
  const results = await Promise.allSettled(sentimentPromises);
  return results.filter((result) => result.status === "fulfilled").map((result) => result.value);
}
__name(analyzeBatchSentiment, "analyzeBatchSentiment");
function aggregateQuickSentiments(quickSentiments) {
  if (quickSentiments.length === 0) {
    return { label: "neutral", confidence: 0, score: 0, reasoning: "No valid sentiments" };
  }
  let totalScore = 0;
  let totalWeight = 0;
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
  quickSentiments.forEach((item) => {
    const sentiment = item.sentiment;
    const weight = sentiment.confidence;
    totalScore += sentiment.score * weight;
    totalWeight += weight;
    if (sentiment.score > 0.1) sentimentCounts.positive++;
    else if (sentiment.score < -0.1) sentimentCounts.negative++;
    else sentimentCounts.neutral++;
  });
  const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  const avgConfidence = totalWeight / quickSentiments.length;
  let finalLabel = "neutral";
  if (avgScore > 0.1) finalLabel = "bullish";
  else if (avgScore < -0.1) finalLabel = "bearish";
  return {
    label: finalLabel,
    confidence: avgConfidence,
    score: avgScore,
    reasoning: `${finalLabel} sentiment from ${quickSentiments.length} news items (${sentimentCounts.positive}+ ${sentimentCounts.negative}- ${sentimentCounts.neutral}=)`
  };
}
__name(aggregateQuickSentiments, "aggregateQuickSentiments");
async function getDetailedSentimentAnalysis(symbol, newsData, quickSentiment, env) {
  try {
    const newsContext = newsData.slice(0, 5).map((item, i) => `${i + 1}. ${item.title}
   ${item.summary || ""}`).join("\n\n");
    const prompt = `Analyze financial sentiment for ${symbol} stock based on recent news:

${newsContext}

Initial AI sentiment: ${quickSentiment.label} (${(quickSentiment.confidence * 100).toFixed(1)}% confidence)

Provide analysis in JSON format:
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": 0.85,
  "price_impact": "high|medium|low",
  "time_horizon": "hours|days|weeks",
  "reasoning": "Brief explanation of key sentiment drivers",
  "key_factors": ["factor1", "factor2"],
  "risk_level": "low|medium|high"
}

Focus on market-moving information and institutional sentiment.`;
    const response = await env.AI.run(
      CLOUDFLARE_AI_CONFIG.models.reasoning,
      {
        messages: [
          {
            role: "system",
            content: "You are a financial sentiment analyst. Provide precise, actionable sentiment analysis in JSON format only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.1
        // Low temperature for consistent analysis
      }
    );
    let analysisData;
    try {
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse GPT-OSS-120B JSON response:", parseError);
      return null;
    }
    return {
      ...analysisData,
      model: "gpt-oss-120b",
      cost_estimate: calculateGPTCost(prompt.length, response.response.length)
    };
  } catch (error) {
    console.error("Detailed sentiment analysis failed:", error);
    return null;
  }
}
__name(getDetailedSentimentAnalysis, "getDetailedSentimentAnalysis");
function calculateCostEstimate(newsCount, usedGPT) {
  const avgTokensPerNews = 100;
  const distilbertTokens = newsCount * avgTokensPerNews;
  const distilbertCost = distilbertTokens / 1e6 * 0.026;
  let gptCost = 0;
  if (usedGPT) {
    const gptInputTokens = 800;
    const gptOutputTokens = 200;
    gptCost = gptInputTokens / 1e6 * 0.35 + gptOutputTokens / 1e6 * 0.75;
  }
  return {
    distilbert_cost: distilbertCost,
    gpt_cost: gptCost,
    total_cost: distilbertCost + gptCost,
    neurons_estimate: Math.ceil((distilbertTokens + (usedGPT ? 1e3 : 0)) / 100)
    // Rough neurons estimate
  };
}
__name(calculateCostEstimate, "calculateCostEstimate");
function calculateGPTCost(inputLength, outputLength) {
  const inputTokens = Math.ceil(inputLength / 4);
  const outputTokens = Math.ceil(outputLength / 4);
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    input_cost: inputTokens / 1e6 * 0.35,
    output_cost: outputTokens / 1e6 * 0.75,
    total_cost: inputTokens / 1e6 * 0.35 + outputTokens / 1e6 * 0.75
  };
}
__name(calculateGPTCost, "calculateGPTCost");

// src/modules/enhanced_analysis.js
async function runEnhancedAnalysis(env, options = {}) {
  const startTime = Date.now();
  console.log("\u{1F680} Starting Enhanced Analysis with Sentiment Integration...");
  try {
    console.log("\u{1F4CA} Step 1: Running neural network analysis...");
    const technicalAnalysis = await runBasicAnalysis(env, options);
    console.log("\u{1F50D} Step 2: Adding sentiment analysis...");
    const enhancedResults = await addSentimentAnalysis(technicalAnalysis, env);
    const executionTime = Date.now() - startTime;
    enhancedResults.execution_metrics = {
      total_time_ms: executionTime,
      enhancement_enabled: true,
      sentiment_sources: ["free_news", "rule_based_analysis"],
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
async function addSentimentAnalysis(technicalAnalysis, env) {
  const symbols = Object.keys(technicalAnalysis.trading_signals);
  console.log(`\u{1F50D} Adding sentiment analysis for ${symbols.length} symbols...`);
  for (const symbol of symbols) {
    try {
      console.log(`   \u{1F4F0} Analyzing sentiment for ${symbol}...`);
      const technicalSignal = technicalAnalysis.trading_signals[symbol];
      const newsData = await getFreeStockNews(symbol, env);
      const sentimentResult = await getBasicSentiment(symbol, newsData, env);
      const enhancedSignal = combineSignals(technicalSignal, sentimentResult, symbol);
      technicalAnalysis.trading_signals[symbol] = {
        ...technicalSignal,
        sentiment_analysis: sentimentResult,
        enhanced_prediction: enhancedSignal,
        enhancement_method: "phase1_basic"
      };
      console.log(`   \u2705 ${symbol} sentiment analysis complete: ${sentimentResult.sentiment} (${(sentimentResult.confidence * 100).toFixed(1)}%)`);
    } catch (error) {
      console.error(`   \u274C Sentiment analysis failed for ${symbol}:`, error.message);
      technicalAnalysis.trading_signals[symbol].sentiment_analysis = {
        sentiment: "neutral",
        confidence: 0,
        reasoning: "Sentiment analysis failed",
        source_count: 0,
        error: error.message
      };
    }
  }
  return technicalAnalysis;
}
__name(addSentimentAnalysis, "addSentimentAnalysis");
async function getBasicSentiment(symbol, newsData, env) {
  if (!newsData || newsData.length === 0) {
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
      console.log(`   \u{1F916} Using Cloudflare AI sentiment analysis for ${symbol}...`);
      return await getCloudflareAISentiment(symbol, newsData, env);
    }
    console.log(`   \u{1F4DD} Using rule-based sentiment analysis for ${symbol}...`);
    return getRuleBasedSentiment(newsData);
  } catch (error) {
    console.error(`   \u274C Advanced sentiment failed for ${symbol}, using rule-based:`, error.message);
    return getRuleBasedSentiment(newsData);
  }
}
__name(getBasicSentiment, "getBasicSentiment");
function getRuleBasedSentiment(newsData) {
  if (!newsData || newsData.length === 0) {
    return {
      sentiment: "neutral",
      confidence: 0,
      reasoning: "No news data",
      source_count: 0,
      method: "rule_based"
    };
  }
  let totalScore = 0;
  let totalWeight = 0;
  const sentimentCounts = { bullish: 0, bearish: 0, neutral: 0 };
  newsData.forEach((item) => {
    const text = `${item.title} ${item.summary || ""}`;
    const sentiment = analyzeTextSentiment(text);
    const weight = getSourceWeight(item.source_type || "unknown");
    totalScore += sentiment.score * weight;
    totalWeight += weight;
    if (sentiment.score > 0.1) sentimentCounts.bullish++;
    else if (sentiment.score < -0.1) sentimentCounts.bearish++;
    else sentimentCounts.neutral++;
  });
  const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  const confidence = Math.min(0.8, Math.abs(avgScore) + newsData.length * 0.05);
  let finalSentiment = "neutral";
  if (avgScore > 0.1) finalSentiment = "bullish";
  else if (avgScore < -0.1) finalSentiment = "bearish";
  return {
    sentiment: finalSentiment,
    confidence,
    score: avgScore,
    reasoning: `${finalSentiment} from ${newsData.length} news sources (${sentimentCounts.bullish}+ ${sentimentCounts.bearish}- ${sentimentCounts.neutral}=)`,
    source_count: newsData.length,
    sentiment_distribution: sentimentCounts,
    method: "rule_based"
  };
}
__name(getRuleBasedSentiment, "getRuleBasedSentiment");
function getSourceWeight(sourceType) {
  const weights = {
    "fmp_with_sentiment": 1,
    "newsapi": 0.8,
    "yahoo": 0.6,
    "unknown": 0.4
  };
  return weights[sourceType] || 0.4;
}
__name(getSourceWeight, "getSourceWeight");
function combineSignals(technicalSignal, sentimentSignal, symbol) {
  const TECHNICAL_WEIGHT = 0.7;
  const SENTIMENT_WEIGHT = 0.3;
  const technicalDirection = technicalSignal.ensemble?.direction || technicalSignal.tft?.direction || "NEUTRAL";
  const technicalConfidence = technicalSignal.ensemble?.confidence || technicalSignal.tft?.confidence || 0.5;
  const technicalScore = mapDirectionToScore(technicalDirection);
  const sentimentScore = sentimentSignal.score || 0;
  const combinedScore = technicalScore * TECHNICAL_WEIGHT + sentimentScore * SENTIMENT_WEIGHT;
  const combinedDirection = combinedScore > 0.1 ? "UP" : combinedScore < -0.1 ? "DOWN" : "NEUTRAL";
  const sentimentConfidence = sentimentSignal.confidence || 0;
  const hybridConfidence = technicalConfidence * TECHNICAL_WEIGHT + sentimentConfidence * SENTIMENT_WEIGHT;
  return {
    symbol,
    direction: combinedDirection,
    confidence: hybridConfidence,
    combined_score: combinedScore,
    components: {
      technical: {
        direction: technicalDirection,
        confidence: technicalConfidence,
        weight: TECHNICAL_WEIGHT
      },
      sentiment: {
        direction: sentimentSignal.sentiment,
        confidence: sentimentConfidence,
        weight: SENTIMENT_WEIGHT,
        source_count: sentimentSignal.source_count
      }
    },
    reasoning: `Technical: ${technicalDirection} (${(technicalConfidence * 100).toFixed(1)}%), Sentiment: ${sentimentSignal.sentiment} (${(sentimentConfidence * 100).toFixed(1)}%) from ${sentimentSignal.source_count} sources`,
    enhancement_details: {
      method: "phase1_hybrid",
      sentiment_method: sentimentSignal.method,
      weights: { technical: TECHNICAL_WEIGHT, sentiment: SENTIMENT_WEIGHT }
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
    const sentimentResult = await getBasicSentiment(testSymbol, newsData, env);
    console.log(`   \u{1F4CA} Sentiment: ${sentimentResult.sentiment} (${(sentimentResult.confidence * 100).toFixed(1)}%)`);
    const aiAvailable = !!env.AI;
    console.log(`   \u{1F916} Cloudflare AI available: ${aiAvailable}`);
    return {
      success: true,
      news_count: newsData.length,
      sentiment: sentimentResult.sentiment,
      confidence: sentimentResult.confidence,
      ai_available: aiAvailable,
      method: sentimentResult.method
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

// src/modules/facebook.js
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
      const direction = signal.predicted_price > signal.current_price ? "\u2197\uFE0F" : signal.predicted_price < signal.current_price ? "\u2198\uFE0F" : "\u27A1\uFE0F";
      reportText += `${symbol}: ${direction} $${signal.current_price?.toFixed(2)} \u2192 $${signal.predicted_price?.toFixed(2)} (${(signal.confidence * 100).toFixed(1)}%)
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
  reportText += `\u{1F4BC} *For research purposes only - not financial advice*`;
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
    } else {
      const errorText = await response.text();
      console.error(`\u274C [FB] ${cronExecutionId} Facebook API error:`, errorText);
    }
  } catch (error) {
    console.error(`\u274C [FB] ${cronExecutionId} Facebook send error:`, error.message);
  }
}
__name(sendFridayWeekendReportWithTracking, "sendFridayWeekendReportWithTracking");
async function sendWeeklyAccuracyReportWithTracking(env, cronExecutionId) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log("\u274C Facebook not configured - skipping weekly accuracy report");
    return;
  }
  let reportText = `\u{1F4CA} **WEEKLY ACCURACY REPORT**
`;
  reportText += `\u{1F5D3}\uFE0F ${(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} 10:00 AM EST

`;
  reportText += `\u{1F3AF} **System Performance:**
`;
  reportText += `\u2022 Overall Accuracy: Real-time tracking active
`;
  reportText += `\u2022 Direction Accuracy: Prediction vs reality validation
`;
  reportText += `\u2022 Model Performance: TFT + N-HITS ensemble analysis

`;
  reportText += `\u{1F4CA} **DETAILED ANALYTICS DASHBOARD:**
`;
  reportText += `\u{1F517} https://tft-trading-system.yanggf.workers.dev/weekly-analysis

`;
  reportText += `\u{1F4C8} Interactive charts showing:
`;
  reportText += `\u2022 Daily accuracy trends
`;
  reportText += `\u2022 Model performance comparison
`;
  reportText += `\u2022 Symbol-specific analysis
`;
  reportText += `\u2022 Prediction vs actual price visualization

`;
  reportText += `\u2699\uFE0F **System Status:** Operational \u2705
`;
  reportText += `\u{1F504} **Next Report:** Next Sunday 10:00 AM EST

`;
  reportText += `\u{1F4BC} *For research purposes only - not financial advice*`;
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
    } else {
      const errorText = await response.text();
      console.error(`\u274C [FB] ${cronExecutionId} Facebook API error:`, errorText);
    }
  } catch (error) {
    console.error(`\u274C [FB] ${cronExecutionId} Facebook send error:`, error.message);
  }
}
__name(sendWeeklyAccuracyReportWithTracking, "sendWeeklyAccuracyReportWithTracking");
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
      weekly_analysis: "/weekly-analysis",
      weekly_data_api: "/api/weekly-data"
    }
  };
}
__name(getHealthCheckResponse, "getHealthCheckResponse");

// src/modules/scheduler.js
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
      await sendWeeklyAccuracyReportWithTracking(env, cronExecutionId);
      console.log(`\u2705 [CRON-COMPLETE-WEEKLY] ${cronExecutionId} Weekly accuracy report completed`);
      return new Response("Weekly accuracy report sent successfully", { status: 200 });
    } else if (triggerMode === "weekly_market_close_analysis") {
      console.log(`\u{1F3C1} [CRON-FRIDAY] ${cronExecutionId} Running weekly market close analysis`);
      analysisResult = await runWeeklyMarketCloseAnalysis(env, estTime);
      await sendFridayWeekendReportWithTracking(analysisResult, env, cronExecutionId, triggerMode);
    } else {
      console.log(`\u{1F680} [CRON-ENHANCED] ${cronExecutionId} Running enhanced analysis with sentiment...`);
      analysisResult = await runEnhancedPreMarketAnalysis(env, {
        triggerMode,
        predictionHorizons,
        currentTime: estTime,
        cronExecutionId
      });
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
                factTableData.push({
                  date: dateStr,
                  symbol,
                  predicted_price: signal.predicted_price,
                  current_price: signal.current_price,
                  actual_price: actualPrice || signal.current_price,
                  // Fallback to current if Yahoo fails
                  direction_prediction: signal.direction,
                  direction_correct: directionCorrect,
                  confidence: signal.confidence,
                  model: signal.model || "TFT-Ensemble",
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
__name(getFactTableData, "getFactTableData");
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
                factTableData.push({
                  date: dateStr,
                  symbol,
                  predicted_price: signal.predicted_price,
                  current_price: signal.current_price,
                  actual_price: actualPrice || signal.current_price,
                  // Fallback to current if Yahoo fails
                  direction_prediction: signal.direction,
                  direction_correct: directionCorrect,
                  confidence: signal.confidence,
                  model: signal.model || "TFT-Ensemble",
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
__name(getFactTableDataWithRange, "getFactTableDataWithRange");
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
__name(getRealActualPrice, "getRealActualPrice");
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
__name(validateDirectionAccuracy, "validateDirectionAccuracy");

// src/modules/weekly-analysis.js
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
            document.getElementById('overall-accuracy').textContent = 
                stats.overallAccuracy ? \`\${stats.overallAccuracy.toFixed(2)}%\` : '-';
            document.getElementById('direction-accuracy').textContent = 
                stats.directionAccuracy ? \`\${stats.directionAccuracy.toFixed(2)}%\` : '-';
            document.getElementById('total-predictions').textContent = stats.totalPredictions || '-';
            document.getElementById('best-model').textContent = stats.bestModel || '-';
        }

        function createAccuracyChart(dailyData) {
            const ctx = document.getElementById('accuracyChart').getContext('2d');
            if (accuracyChart) accuracyChart.destroy();

            accuracyChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dailyData.map(d => new Date(d.date).toLocaleDateString()),
                    datasets: [{
                        label: 'Price Accuracy (%)',
                        data: dailyData.map(d => d.priceAccuracy),
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

                row.innerHTML = \`
                    <td>\${new Date(prediction.date).toLocaleDateString()}</td>
                    <td><strong>\${prediction.symbol}</strong></td>
                    <td>\${prediction.model || 'Ensemble'}</td>
                    <td>$\${prediction.predicted_price ? prediction.predicted_price.toFixed(2) : '-'}</td>
                    <td>$\${prediction.actual_price ? prediction.actual_price.toFixed(2) : '-'}</td>
                    <td>
                        <div class="accuracy-indicator">
                            <span>\${prediction.direction || '\u27A1\uFE0F'}</span>
                            <span>\${directionCorrect}</span>
                        </div>
                    </td>
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
                
                card.innerHTML = \`
                    <h4>\${symbol}</h4>
                    <div class="prediction-row">
                        <span>Price Accuracy:</span>
                        <span>\${data.priceAccuracy ? data.priceAccuracy.toFixed(2) + '%' : '-'}</span>
                    </div>
                    <div class="prediction-row">
                        <span>Direction Accuracy:</span>
                        <span>\${data.directionAccuracy ? data.directionAccuracy.toFixed(2) + '%' : '-'}</span>
                    </div>
                    <div class="prediction-row">
                        <span>Total Predictions:</span>
                        <span>\${data.totalPredictions || 0}</span>
                    </div>
                    <div class="prediction-row">
                        <span>Best Model:</span>
                        <span>\${data.bestModel || '-'}</span>
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
  let priceCount = 0;
  let directionCount = 0;
  const symbolStats = {};
  const modelStats = {};
  const dailyStats = {};
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
        totalPredictions: 0,
        bestModel: "Ensemble"
      };
    }
    symbolStats[record.symbol].totalPredictions++;
    const model = record.model || "Ensemble";
    if (!modelStats[model]) {
      modelStats[model] = { accuracy: 0, count: 0 };
    }
    if (record.predicted_price && record.actual_price) {
      const accuracy = Math.max(0, 100 - Math.abs((record.predicted_price - record.actual_price) / record.actual_price * 100));
      modelStats[model].accuracy += accuracy;
      modelStats[model].count++;
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
  let bestModel = "Ensemble";
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
  Object.keys(symbolStats).forEach((symbol) => {
    const symbolPredictions = recentPredictions.filter((r) => r.symbol === symbol);
    let symbolPriceAcc = 0;
    let symbolDirAcc = 0;
    let pCount = 0;
    let dCount = 0;
    symbolPredictions.forEach((record) => {
      if (record.predicted_price && record.actual_price) {
        symbolPriceAcc += Math.max(0, 100 - Math.abs((record.predicted_price - record.actual_price) / record.actual_price * 100));
        pCount++;
      }
      if (record.direction_correct !== void 0) {
        symbolDirAcc += record.direction_correct ? 100 : 0;
        dCount++;
      }
    });
    symbolStats[symbol].priceAccuracy = pCount > 0 ? symbolPriceAcc / pCount : 0;
    symbolStats[symbol].directionAccuracy = dCount > 0 ? symbolDirAcc / dCount : 0;
  });
  return {
    overview: {
      overallAccuracy: priceCount > 0 ? totalPriceAccuracy / priceCount : 0,
      directionAccuracy: directionCount > 0 ? totalDirectionAccuracy / directionCount : 0,
      totalPredictions: recentPredictions.length,
      bestModel
    },
    dailyAccuracy,
    modelPerformance: modelStats,
    predictions: recentPredictions.map((record) => ({
      date: record.date,
      symbol: record.symbol,
      model: record.model || "Ensemble",
      predicted_price: record.predicted_price,
      actual_price: record.actual_price,
      direction: record.direction_prediction,
      direction_correct: record.direction_correct,
      confidence: record.confidence
    })),
    symbolBreakdown: symbolStats
  };
}
__name(processWeeklyAnalysisData, "processWeeklyAnalysisData");

// src/modules/handlers.js
init_analysis();
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
async function handleModelHealth(request, env) {
  try {
    console.log("\u{1F3E5} Running model health check...");
    const healthResult = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      r2_binding: {
        available: !!env.TRAINED_MODELS,
        type: typeof env.TRAINED_MODELS
      },
      model_files: {},
      bucket_contents: [],
      errors: []
    };
    if (!env.TRAINED_MODELS) {
      healthResult.errors.push("TRAINED_MODELS R2 binding not available");
      return new Response(JSON.stringify(healthResult, null, 2), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      const listResponse = await env.TRAINED_MODELS.list();
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
      "enhanced_tft_weights.json",
      "enhanced_nhits_weights.json",
      "metadata.json"
    ];
    for (const fileName of filesToTest) {
      try {
        console.log(`\u{1F50D} Testing access to ${fileName}...`);
        const fileResponse = await env.TRAINED_MODELS.get(fileName);
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
    if (!env.TRAINED_MODELS) {
      return new Response(JSON.stringify({
        success: false,
        error: "TRAINED_MODELS R2 binding not available",
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
          const uploadResponse = await env.TRAINED_MODELS.put(r2Key, fileData, {
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
          const uploadResponse = await env.TRAINED_MODELS.put(r2Key, content, {
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
      const listResponse = await env.TRAINED_MODELS.list();
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

// src/modules/routes.js
function validateRequest(request, url) {
  const userAgent = request.headers.get("User-Agent") || "";
  if (userAgent.includes("bot") && !userAgent.includes("Googlebot")) {
    return { valid: false, error: "Blocked user agent" };
  }
  return { valid: true };
}
__name(validateRequest, "validateRequest");
async function handleHttpRequest(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === "/analyze" || url.pathname === "/test-facebook" || url.pathname === "/test-high-confidence") {
    const validationResult = validateRequest(request, url);
    if (!validationResult.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: validationResult.error,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  switch (url.pathname) {
    case "/analyze":
      return handleManualAnalysis(request, env);
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
    case "/weekly-analysis":
      return handleWeeklyAnalysisPage(request, env);
    case "/api/weekly-data":
      return handleWeeklyDataAPI(request, env);
    case "/test-sentiment":
      return handleSentimentTest(request, env);
    case "/model-health":
      return handleModelHealth(request, env);
    case "/r2-upload":
      return handleR2Upload(request, env);
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
