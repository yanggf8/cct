# TFT + N-HITS Financial Prediction on Vercel Edge Functions

Edge-optimized dual model ensemble for financial time series prediction using TFT (Temporal Fusion Transformer) and N-HITS (Neural Hierarchical Interpolation for Time Series) models deployed on Vercel's global edge network.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Vercel CLI: `npm i -g vercel`
- Vercel account

### Local Development
```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Test the deployment
node test/test-client.js
```

### Production Deployment
```bash
# Deploy to Vercel Edge
npm run deploy

# Test production endpoint
node test/test-client.js https://your-deployment.vercel.app
```

## 📡 API Endpoints

### Health Check
```bash
GET /api/health
```
Returns system health, model status, and performance metrics.

### Single Model Prediction (N-HITS)
```bash
POST /api/predict
Content-Type: application/json

{
  "symbol": "AAPL",
  "ohlcvData": [
    {
      "date": "2025-01-01",
      "open": 150.0,
      "high": 152.0,
      "low": 149.0,
      "close": 151.0,
      "volume": 1000000
    }
    // ... 30 days of OHLCV data required
  ]
}
```

### Dual Model Prediction (TFT + N-HITS Ensemble)
```bash
POST /api/predict-dual
Content-Type: application/json

{
  "symbol": "AAPL", 
  "ohlcvData": [...] // Same as single model
}
```

## 🏗️ Architecture

### Edge Deployment
- **Runtime**: Vercel Edge Functions (V8 + WebAssembly)
- **Global Regions**: IAD1, SFO1, FRA1, HND1, SYD1
- **Cold Start**: ~0ms (Edge Runtime optimization)
- **Memory**: Optimized for <2MB code size limit

### Model Architecture
- **TFT Model**: 0.13MB, 30,209 parameters, temporal fusion
- **N-HITS Model**: 0.03MB, 4,989 parameters, hierarchical interpolation
- **Combined**: 0.16MB total, parallel execution
- **Ensemble**: 60% TFT + 40% N-HITS weighted average

### Performance Targets
- **Latency**: <10ms inference per model
- **Throughput**: 300+ requests/minute
- **Availability**: 99.9% global edge network
- **Agreement**: >80% model consensus for high confidence

## 🔧 Technical Implementation

### WebAssembly + ONNX Runtime
```javascript
import { InferenceSession, Tensor } from 'onnxruntime-web/webassembly';

// Model loading (cached)
const session = await InferenceSession.create(modelBuffer);

// Inference execution
const results = await session.run({ input: inputTensor });
```

### Parallel Model Execution
```javascript
const [tftResult, nhitsResult] = await Promise.all([
  tftSession.run(modelInput),
  nhitsSession.run(modelInput)
]);

const ensemble = (tftResult * 0.6) + (nhitsResult * 0.4);
```

### Edge Optimization
- **Model Caching**: Session reuse across invocations
- **Input Preprocessing**: Optimized normalization
- **Parallel Execution**: Concurrent model inference
- **Regional Deployment**: Closest edge for minimal latency

## 📊 Performance Benchmarks

### Expected Performance (Production)
- **Single Model**: 2-5ms inference
- **Dual Model**: 5-10ms parallel execution  
- **Total Response**: 15-25ms end-to-end
- **Cold Start**: <100ms (Edge Runtime)

### Scalability
- **Concurrent Requests**: 100+ per edge region
- **Global Distribution**: 5+ regions
- **Auto-scaling**: Vercel's edge infrastructure
- **Cost**: ~$280/month for 13M requests

## 🧪 Testing

### Local Testing
```bash
# Start development server
npm run dev

# Run test suite
node test/test-client.js

# Expected output:
# 🏥 Health Check: healthy
# 📈 Single Model: ~5ms avg
# 🔄 Dual Model: ~10ms avg
# ⚡ Concurrent: 95%+ success rate
```

### Production Validation
```bash
# Test production deployment
node test/test-client.js https://your-app.vercel.app

# Performance validation:
# - Latency: <25ms total
# - Success Rate: >95%
# - Model Agreement: >80%
```

## 🔒 Security & Compliance

### Data Protection
- **HTTPS Only**: All communications encrypted
- **No Data Storage**: Stateless inference only
- **Input Validation**: Schema validation on all inputs
- **Error Sanitization**: No sensitive data in error responses

### Financial Compliance
- **Audit Trail**: Request/response logging available
- **Rate Limiting**: Built-in Vercel protections
- **Regional Compliance**: EU/US/APAC deployment options
- **SLA**: Vercel Enterprise 99.99% uptime

## 📈 Monitoring & Observability

### Built-in Metrics
- **Response Time**: Per-request latency tracking
- **Success Rate**: Error rate monitoring
- **Model Agreement**: Ensemble confidence scoring
- **Regional Performance**: Per-edge metrics

### Health Endpoints
- `/api/health`: System status and model readiness
- **Metrics**: Memory usage, model status, performance
- **Alerts**: Integration with monitoring systems

## 🚀 Deployment Guide

### Step 1: Setup Vercel Project
```bash
# Initialize Vercel project
vercel init

# Link to existing project or create new
vercel --prod
```

### Step 2: Configure Environment
```bash
# Set production environment variables (if needed)
vercel env add PRODUCTION_MODE
```

### Step 3: Deploy Edge Functions
```bash
# Production deployment
npm run deploy

# Verify deployment
curl https://your-app.vercel.app/api/health
```

### Step 4: Performance Testing
```bash
# Load testing
node test/test-client.js https://your-app.vercel.app

# Monitor via Vercel dashboard
vercel logs --follow
```

## 💡 Usage Examples

### JavaScript/Node.js Client
```javascript
const response = await fetch('https://your-app.vercel.app/api/predict-dual', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symbol: 'AAPL',
    ohlcvData: ohlcvSequence // 30 days of OHLCV data
  })
});

const { prediction } = await response.json();
console.log(`Ensemble: $${prediction.ensemble.prediction.toFixed(2)}`);
console.log(`Confidence: ${(prediction.ensemble.confidence * 100).toFixed(1)}%`);
```

### Python Client
```python
import requests

response = requests.post('https://your-app.vercel.app/api/predict-dual', 
                        json={
                            'symbol': 'AAPL',
                            'ohlcvData': ohlcv_sequence
                        })

result = response.json()
print(f"Prediction: ${result['prediction']['ensemble']['prediction']:.2f}")
```

### cURL Example
```bash
curl -X POST https://your-app.vercel.app/api/predict-dual \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "ohlcvData": [...]
  }'
```

## 🎯 Advantages Over Alternatives

### vs Cloudflare Workers AI BYOM
- ✅ **Self-service deployment** (no enterprise approval)
- ✅ **Immediate availability** (no 8-12 week wait)
- ✅ **Transparent pricing** (no enterprise negotiation)
- ❌ **Higher cost** (~$280 vs ~$150/month)

### vs ModelScope Cloud
- ✅ **Edge deployment** (global latency optimization)
- ✅ **No external dependencies** (self-contained)
- ✅ **Better reliability** (no Chinese service dependencies)
- ✅ **Easier integration** (direct API calls)

### vs AWS Lambda@Edge
- ✅ **Simpler deployment** (no AWS infrastructure management)
- ✅ **Better developer experience** (Vercel ecosystem)
- ✅ **Faster cold starts** (Edge Runtime optimization)
- ❌ **Less customization** (less infrastructure control)

## 🛠️ Customization

### Model Updates
To update models, replace ONNX files and redeploy:
```bash
# Update model files in /models directory
# Redeploy
npm run deploy
```

### Ensemble Configuration
Modify weights in model configuration:
```javascript
const MODEL_CONFIG = {
  ensemble: {
    tftWeight: 0.7,    // Increase TFT influence
    nhitsWeight: 0.3   // Decrease N-HITS influence
  }
};
```

### Regional Deployment
Configure specific regions in `vercel.json`:
```json
{
  "functions": {
    "api/*.js": {
      "runtime": "edge",
      "regions": ["iad1", "sfo1", "fra1"]
    }
  }
}
```

## 📞 Support & Maintenance

### Production Monitoring
- **Health Checks**: Automated `/api/health` monitoring
- **Performance Alerts**: Latency threshold notifications
- **Error Tracking**: Vercel integrated error reporting
- **Usage Analytics**: Request volume and success metrics

### Maintenance Schedule
- **Model Updates**: Monthly performance review
- **Dependency Updates**: Quarterly security updates
- **Performance Optimization**: Ongoing latency improvements
- **Cost Optimization**: Monthly usage analysis

---

**Ready for production deployment with sub-25ms global latency and 99.9% availability! 🚀**