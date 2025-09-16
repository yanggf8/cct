# Model Architecture Backup - 2025-09-16

## Current Status Summary

**CRITICAL FINDING**: System has two separate model implementations:

### 1. Vercel TensorFlow.js Models (Genuine Trained Models) ✅
- **Location**: `vercel-models/api/predict-*.js`
- **Type**: Real TensorFlow.js model loading with trained weights
- **Models**: TFT (37K params), N-HITS (108K params)
- **Training**: 1,888 samples, 62% direction accuracy
- **Status**: **NOT CURRENTLY USED** by Cloudflare Worker

### 2. Cloudflare Internal Models (Algorithmic Simulations) ❌
- **Location**: `src/modules/models.js`
- **Type**: Mathematical simulations of neural network behavior
- **Implementation**: Hardcoded algorithms using Math.sin(), Math.cos(), Math.tanh()
- **Status**: **CURRENTLY ACTIVE** in production

## Backup Files Created

### Vercel Model Files (Genuine Trained Models)
- `vercel-models/api/predict-tft-backup.js` - TensorFlow.js TFT implementation
- `vercel-models/api/predict-nhits-backup.js` - TensorFlow.js N-HITS implementation
- `vercel-models/models-backup/` - Complete trained model weights directory
  - `tft-trained/model.json` (10.6KB architecture)
  - `tft-trained/group1-shard1of1.bin` (148KB weights)
  - `nhits-trained/model.json` (14.6KB architecture)
  - `nhits-trained/group1-shard1of1.bin` (433KB weights)
  - `metadata.json` - Training performance metrics

### Model Training Evidence
```json
{
  "tft": {
    "loss": 0.0010510944994166493,
    "mae": 0.023177603259682655,
    "direction_accuracy": 0.62,
    "parameters": 37099
  },
  "nhits": {
    "loss": 0.0010560699738562107,
    "mae": 0.023616952821612358,
    "direction_accuracy": 0.62,
    "parameters": 108289
  }
}
```

## Architecture Discrepancy

**Problem**: Cloudflare Worker calls internal simulated models instead of genuine trained Vercel models

**Evidence of Simulation in `src/modules/models.js`**:
- Line 19: "Multi-head attention mechanism simulation"
- Line 36: `Math.sin((temporalContext.market_hour - 9.5) / 6.5 * Math.PI)`
- Line 228: `Math.tanh(prediction * 100) * 0.05` - hardcoded mathematical transforms

**Evidence of Real Models in `vercel-models/api/`**:
- Line 32: `tftModel = await tf.loadLayersModel(path);` - loads actual trained weights
- Line 107: `const prediction = model.predict(processedData);` - genuine TensorFlow.js inference

## Recommendation

To use genuine trained models, Cloudflare Worker should:
1. Call Vercel endpoints OR
2. Load models from R2 storage OR
3. Integrate TensorFlow.js directly into Worker

Current system uses sophisticated algorithmic simulations, not learned neural networks.

## Backup Date
2025-09-16 (before any model architecture changes)