# Neural Network Training and Deployment Guide

## Overview
This guide walks you through training genuine TFT and N-HITS neural networks in Google Colab and deploying them to Vercel.

## Step 1: Train Models in Google Colab

### 1.1 Upload Notebook
1. Open [Google Colab](https://colab.research.google.com/)
2. Upload `Neural_Network_Training.ipynb`
3. Enable GPU: Runtime → Change runtime type → GPU (T4)

### 1.2 Run Training
1. Run all cells in the notebook
2. This will:
   - Fetch 2 years of real market data for AAPL, MSFT, GOOGL, TSLA, NVDA
   - Create training sequences
   - Train both TFT and N-HITS models
   - Export trained models in TensorFlow.js format
   - Download `trained_models.zip`

### 1.3 Expected Output
```
TFT Model: ~50,000 parameters
N-HITS Model: ~100,000 parameters
Training time: ~10-15 minutes on GPU
Direction accuracy: 55-65% (better than random)
```

## Step 2: Deploy Trained Models to Vercel

### 2.1 Extract and Upload Models
1. Extract `trained_models.zip`
2. You'll get:
   ```
   models/
   ├── tft-trained/
   │   ├── model.json
   │   └── group1-shard1of1.bin
   ├── nhits-trained/
   │   ├── model.json
   │   └── group1-shard1of1.bin
   └── metadata.json
   ```
3. Upload the entire `models/` folder to your Vercel project root

### 2.2 Update Inference Endpoints
1. Replace `predict-tft.js` with `predict-tft-trained.js`
2. Replace `predict-nhits.js` with `predict-nhits-trained.js`
3. These new endpoints will load the trained weights instead of creating new models

### 2.3 Deploy to Vercel
```bash
cd vercel-models
npx vercel --prod
```

## Step 3: Update Cloudflare Worker

### 3.1 Update Analysis Module
Update the URLs in `/home/yanggf/a/cct/src/modules/analysis.js`:

```javascript
// Change from:
const tftUrl = env.TFT_MODEL_URL || 'https://cct-grzm1e1gb-yang-goufangs-projects.vercel.app/api/predict-tft';

// To:
const tftUrl = env.TFT_MODEL_URL || 'https://cct-grzm1e1gb-yang-goufangs-projects.vercel.app/api/predict-tft-trained';

// Same for N-HITS:
const nhitsUrl = env.NHITS_MODEL_URL || 'https://cct-grzm1e1gb-yang-goufangs-projects.vercel.app/api/predict-nhits-trained';
```

### 3.2 Deploy Worker
```bash
cd /home/yanggf/a/cct
npx wrangler deploy
```

## Step 4: Testing

### 4.1 Test Individual Models
```bash
# Test TFT
curl -X POST https://your-vercel-app.vercel.app/api/predict-tft-trained \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "ohlcv": [...30_days_of_data...]}'

# Test N-HITS
curl -X POST https://your-vercel-app.vercel.app/api/predict-nhits-trained \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "ohlcv": [...30_days_of_data...]}'
```

### 4.2 Test Full System
```bash
# Test complete system
curl https://tft-trading-system.yanggf.workers.dev/analyze
```

You should see responses with:
- `"trained_weights": true`
- `"trained_model": true`
- `"model_loaded_from": "/models/tft-trained/model.json"`

## Key Differences

### Before (Untrained Models)
```javascript
// Created new model with random weights
tftModel = new TemporalFusionTransformer({...});
tftModel.buildModel(); // Random initialization
```

### After (Trained Models)
```javascript
// Load trained weights from disk
tftModel = await tf.loadLayersModel('/models/tft-trained/model.json');
// Model now has learned patterns from real data
```

## Verification Checklist

- [ ] Models trained in Colab with real data
- [ ] `trained_models.zip` downloaded and extracted
- [ ] Models uploaded to Vercel project
- [ ] Inference endpoints updated to load trained models
- [ ] Vercel project redeployed
- [ ] Cloudflare worker updated with new URLs
- [ ] System returns `"trained_weights": true`
- [ ] Predictions show learned patterns (not random)

## Troubleshooting

### Model Loading Errors
- Ensure `models/` folder is in Vercel project root
- Check that `model.json` and `.bin` files are uploaded
- Verify file paths match in the code

### Training Issues
- Enable GPU in Colab for faster training
- If training fails, reduce batch size or epochs
- Ensure sufficient data (2 years recommended)

### Performance Issues
- Direction accuracy should be >55% (better than random 50%)
- If accuracy is poor, retrain with more data or different parameters

## Success Indicators

When everything works correctly, you'll see:
1. **Colab**: Successful training with >55% direction accuracy
2. **Vercel**: Model loading messages in logs
3. **Production**: `"trained_model": true` in API responses
4. **Predictions**: Realistic price changes based on learned patterns

This completes the transformation from random-weight models to genuinely trained neural networks!