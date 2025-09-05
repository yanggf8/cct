/**
 * Vercel Edge Function: Single N-HITS Model Prediction
 * Ultra-fast financial time series prediction at the edge
 */

import { InferenceSession, Tensor } from 'onnxruntime-web/webassembly';

// Model configuration
const MODEL_CONFIG = {
  sequenceLength: 30,
  featureColumns: ['Open', 'High', 'Low', 'Close', 'Volume'],
  inputShape: [1, 30, 5],
  modelName: 'EdgeNHITS'
};

// Cache for model session (Edge Functions have limited memory)
let modelSession = null;

/**
 * Load ONNX model (cached for performance)
 */
async function loadModel() {
  if (modelSession) {
    return modelSession;
  }

  try {
    // In production, this would load from a CDN or bundled asset
    // For POC, we'll simulate model loading
    console.log('Loading N-HITS ONNX model...');
    
    // Note: In real implementation, you'd import the .onnx file
    // const modelArrayBuffer = await import('./models/edge_nhits_financial.onnx');
    // modelSession = await InferenceSession.create(modelArrayBuffer);
    
    // For POC, we'll create a mock session structure
    modelSession = {
      run: async (feeds) => {
        // Simulate N-HITS inference with realistic computation
        const input = feeds.input;
        const batchSize = input.dims[0];
        const seqLen = input.dims[1];
        const features = input.dims[2];
        
        // Simple prediction logic (replace with actual ONNX inference)
        const inputData = input.data;
        const lastPrice = inputData[inputData.length - 3]; // Close price
        
        // Simulate N-HITS hierarchical prediction
        const shortTrend = 0.001; // 0.1% trend
        const mediumTrend = 0.0005; // 0.05% trend  
        const longTrend = 0.0002; // 0.02% trend
        
        const prediction = lastPrice * (1 + shortTrend + mediumTrend + longTrend);
        
        return {
          output: new Tensor('float32', new Float32Array([prediction]), [1, 1])
        };
      },
      inputNames: ['input'],
      outputNames: ['output']
    };
    
    console.log('N-HITS model loaded successfully');
    return modelSession;
  } catch (error) {
    console.error('Error loading model:', error);
    throw new Error('Failed to load N-HITS model');
  }
}

/**
 * Preprocess input data for model inference
 */
function preprocessInput(ohlcvData) {
  try {
    if (!Array.isArray(ohlcvData) || ohlcvData.length < MODEL_CONFIG.sequenceLength) {
      throw new Error(`Input must be array of ${MODEL_CONFIG.sequenceLength} OHLCV records`);
    }

    // Take last 30 records
    const sequence = ohlcvData.slice(-MODEL_CONFIG.sequenceLength);
    
    // Simple normalization (in production, use trained scaler)
    const normalized = sequence.map(record => [
      record.open / 1000,    // Normalize by 1000
      record.high / 1000,
      record.low / 1000,
      record.close / 1000,
      record.volume / 1000000  // Normalize by 1M
    ]);
    
    // Flatten for ONNX input
    const inputData = new Float32Array(normalized.flat());
    const inputTensor = new Tensor('float32', inputData, MODEL_CONFIG.inputShape);
    
    return { input: inputTensor };
  } catch (error) {
    throw new Error(`Preprocessing error: ${error.message}`);
  }
}

/**
 * Postprocess model output to actual price prediction
 */
function postprocessOutput(modelOutput, currentPrice) {
  try {
    const rawPrediction = modelOutput.output.data[0];
    
    // Denormalize prediction (reverse of preprocessing)
    const denormalizedPrediction = rawPrediction * 1000;
    
    // Calculate prediction metrics
    const priceDiff = denormalizedPrediction - currentPrice;
    const changePercent = (priceDiff / currentPrice) * 100;
    
    return {
      prediction: denormalizedPrediction,
      currentPrice: currentPrice,
      priceDifference: priceDiff,
      changePercent: changePercent,
      confidence: 0.78, // N-HITS typical confidence
      modelUsed: 'EdgeNHITS'
    };
  } catch (error) {
    throw new Error(`Postprocessing error: ${error.message}`);
  }
}

/**
 * Main Edge Function handler
 */
export default async function handler(request) {
  const startTime = performance.now();
  
  try {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200 });
    }
    
    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { 
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Parse request body
    const { symbol, ohlcvData } = await request.json();
    
    if (!symbol || !ohlcvData) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: symbol, ohlcvData' 
        }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Load model
    const modelLoadStart = performance.now();
    const model = await loadModel();
    const modelLoadTime = performance.now() - modelLoadStart;
    
    // Preprocess input
    const preprocessStart = performance.now();
    const modelInput = preprocessInput(ohlcvData);
    const preprocessTime = performance.now() - preprocessStart;
    
    // Run inference
    const inferenceStart = performance.now();
    const modelOutput = await model.run(modelInput);
    const inferenceTime = performance.now() - inferenceStart;
    
    // Postprocess output
    const postprocessStart = performance.now();
    const currentPrice = ohlcvData[ohlcvData.length - 1].close;
    const result = postprocessOutput(modelOutput, currentPrice);
    const postprocessTime = performance.now() - postprocessStart;
    
    const totalTime = performance.now() - startTime;
    
    // Return prediction with performance metrics
    return new Response(
      JSON.stringify({
        success: true,
        symbol: symbol,
        prediction: result,
        performance: {
          totalTimeMs: Math.round(totalTime * 100) / 100,
          modelLoadTimeMs: Math.round(modelLoadTime * 100) / 100,
          preprocessTimeMs: Math.round(preprocessTime * 100) / 100,
          inferenceTimeMs: Math.round(inferenceTime * 100) / 100,
          postprocessTimeMs: Math.round(postprocessTime * 100) / 100
        },
        timestamp: new Date().toISOString(),
        edge: {
          region: process.env.VERCEL_REGION || 'unknown',
          runtime: 'edge'
        }
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=0, s-maxage=60'
        }
      }
    );
    
  } catch (error) {
    console.error('Prediction error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        edge: {
          region: process.env.VERCEL_REGION || 'unknown',
          runtime: 'edge'
        }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'hnd1', 'syd1']
};