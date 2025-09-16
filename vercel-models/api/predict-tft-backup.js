/**
 * TFT Neural Network Inference Endpoint - LOADS TRAINED WEIGHTS
 * This loads the actual trained model from Colab training
 */

import * as tf from '@tensorflow/tfjs';

// Global model instance
let tftModel = null;
let isModelReady = false;

// Load the trained model (THIS IS THE KEY FIX)
async function loadTrainedModel() {
  if (!tftModel && !isModelReady) {
    console.log('🧠 Loading trained TFT model...');

    try {
      // Multiple path attempts for Vercel Edge Functions
      const possiblePaths = [
        './models/tft-trained/model.json',
        '../models/tft-trained/model.json',
        'models/tft-trained/model.json',
        '/models/tft-trained/model.json'
      ];

      console.log('🔍 Attempting to load model from possible paths...');

      let loadError = null;
      for (const path of possiblePaths) {
        try {
          console.log(`   🔄 Trying path: ${path}`);
          tftModel = await tf.loadLayersModel(path);
          isModelReady = true;
          console.log(`   ✅ Successfully loaded from: ${path}`);
          break;
        } catch (error) {
          console.log(`   ❌ Failed path ${path}: ${error.message}`);
          loadError = error;
          continue;
        }
      }

      if (!tftModel) {
        throw new Error(`All model paths failed. Last error: ${loadError?.message}`);
      }

      console.log('✅ Trained TFT model loaded successfully');
      console.log(`   📊 Model inputs: ${JSON.stringify(tftModel.inputs.map(i => i.shape))}`);
      console.log(`   🎯 Model outputs: ${JSON.stringify(tftModel.outputs.map(o => o.shape))}`);

    } catch (error) {
      console.error('❌ Failed to load trained TFT model:', error);
      console.error('❌ Error details:', error.name, error.message);
      throw error;
    }
  }

  return tftModel;
}

export default async function handler(req, res) {
  console.log('🧠 TFT endpoint called:', req.method, new Date().toISOString());

  if (req.method !== 'POST') {
    console.log('❌ Wrong method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📋 Request body received:', JSON.stringify(req.body, null, 2));
    const { symbol, ohlcv, options = {} } = req.body;

    console.log(`✅ Symbol: ${symbol}, OHLCV length: ${ohlcv?.length}, Is array: ${Array.isArray(ohlcv)}`);

    if (!symbol || !ohlcv || !Array.isArray(ohlcv)) {
      console.log('❌ Validation failed - missing required fields');
      return res.status(400).json({
        error: 'Invalid input. Required: symbol, ohlcv array'
      });
    }

    if (ohlcv.length < 30) {
      console.log(`❌ Insufficient data: ${ohlcv.length} < 30 required`);
      return res.status(400).json({
        error: 'Insufficient data. Minimum 30 days of OHLCV required for TFT neural network'
      });
    }

    console.log('✅ Validation passed, loading TFT model...');

    const startTime = Date.now();

    // Load the TRAINED model (not create new one!)
    console.log('🔄 Attempting to load trained TFT model...');
    const model = await loadTrainedModel();
    console.log('✅ Model loaded successfully!');

    console.log(`🧠 Running trained TFT neural network inference for ${symbol}...`);

    // Prepare data for trained model
    console.log('📊 Preparing data for trained model...');
    const processedData = prepareDataForTrainedModel(ohlcv);
    console.log(`✅ Data prepared, tensor shape: ${processedData.shape}`);

    // Run inference with trained weights
    console.log('🔮 Running model prediction...');
    const prediction = model.predict(processedData);
    const predictionValue = await prediction.data();
    console.log('✅ Prediction completed:', Array.from(predictionValue));

    // Convert to price prediction
    const currentPrice = ohlcv[ohlcv.length - 1][3];
    const predictedChange = predictionValue[0]; // The trained model outputs price change
    const predictedPrice = currentPrice * (1 + predictedChange);

    // Calculate confidence (you could enhance this based on model uncertainty)
    const confidence = calculateTrainedModelConfidence(predictionValue[0], ohlcv);

    const inferenceTime = Date.now() - startTime;

    // Cleanup tensors
    prediction.dispose();
    processedData.dispose();

    return res.status(200).json({
      success: true,
      symbol,
      model: 'Trained-TFT-Neural-Network',
      neural_network: true,
      trained_weights: true,
      prediction: {
        predicted_price: Number(predictedPrice.toFixed(2)),
        predicted_change: Number(predictedChange.toFixed(6)),
        confidence: Number(confidence.toFixed(4)),
        direction: predictedPrice > currentPrice ? 'UP' : predictedPrice < currentPrice ? 'DOWN' : 'NEUTRAL'
      },
      metadata: {
        model_type: 'Trained Temporal Fusion Transformer',
        inference_time_ms: inferenceTime,
        trained_model: true,
        model_loaded_from: '/models/tft-trained/model.json',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ TFT Neural Network Error:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });

    return res.status(500).json({
      success: false,
      error: error.message,
      model: 'Trained-TFT-Neural-Network',
      neural_network: true,
      error_details: {
        name: error.name,
        stack: error.stack?.split('\n')[0] // First line of stack trace
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Prepare data for the trained model (must match training preprocessing)
 */
function prepareDataForTrainedModel(ohlcv) {
  // Take last 30 days as sequence (matching training)
  const sequence = ohlcv.slice(-30);

  // Extract OHLCV features + add price change
  const features = [];
  let prevClose = sequence[0][3];

  for (let i = 0; i < sequence.length; i++) {
    const [open, high, low, close, volume] = sequence[i];
    const priceChange = (close - prevClose) / prevClose;

    features.push([
      open / 1000,      // Scale down
      high / 1000,
      low / 1000,
      close / 1000,
      volume / 1000000, // Scale down volume
      priceChange       // Price change feature
    ]);

    prevClose = close;
  }

  // Convert to tensor with correct shape [1, 30, 6] for batch inference
  return tf.tensor3d([features], [1, 30, 6]);
}

/**
 * Calculate confidence for trained model predictions
 */
function calculateTrainedModelConfidence(prediction, ohlcv) {
  // Enhanced confidence based on prediction magnitude and market conditions
  const recentVolatility = calculateVolatility(ohlcv.slice(-10));

  // Lower confidence for extreme predictions or high volatility
  const magnitudeScore = Math.exp(-Math.abs(prediction) * 10);
  const volatilityScore = Math.exp(-recentVolatility * 100);

  // Trained model confidence range: 70-95%
  const baseConfidence = 0.7 + (magnitudeScore * volatilityScore * 0.25);

  return Math.min(0.95, Math.max(0.7, baseConfidence));
}

/**
 * Calculate volatility for confidence assessment
 */
function calculateVolatility(ohlcv) {
  const prices = ohlcv.map(candle => candle[3]);
  const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

  return Math.sqrt(variance);
}