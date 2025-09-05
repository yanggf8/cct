# Vercel Edge Functions Analysis for TFT + N-HITS Deployment

## Executive Summary

Vercel Edge Functions show **promising potential** for deploying our TFT + N-HITS models via WebAssembly + ONNX Runtime Web, offering a **self-service alternative** to Cloudflare's enterprise-only BYOM.

## Technical Capabilities ✅

### WebAssembly Support
- **Native WASM support** in Edge Functions (2025)
- **2-3x faster** than JavaScript for computational workloads
- **SIMD extensions** for optimized arithmetic operations
- **No enterprise approval required** - self-service deployment

### ONNX Runtime Web Integration
- **ONNX Runtime Web** available for browser/edge deployment
- **Multiple backends**: WebGL, WebGPU, WebNN (GPU), WebAssembly (CPU)
- **Real-time inference** demonstrated in 2025 examples
- **Client-side inference** with no server dependencies

### Recent Success Cases (2025)
- YOLO model deployment with ONNX + WebAssembly + Next.js
- End-to-end real-time pipeline fully client-side
- Preprocessing, inference, and post-processing in <100ms

## Technical Constraints ⚠️

### Code Size Limits
- **Hobby**: 1MB (too small for both models)
- **Pro**: 2MB (tight fit for 0.16MB models + runtime)
- **Enterprise**: 4MB (comfortable margin)

### Runtime Constraints
- **25-second timeout** for response start
- **V8 engine** with limited Node.js APIs
- **No filesystem access** (models must be bundled)
- **No dynamic code execution**

## Deployment Feasibility Analysis

### Our Models vs Vercel Limits

| Model | Size | Vercel Pro (2MB) | Vercel Enterprise (4MB) |
|-------|------|------------------|-------------------------|
| TFT ONNX | 0.13MB | ✅ Fits | ✅ Fits |
| N-HITS ONNX | 0.03MB | ✅ Fits | ✅ Fits |
| Combined | 0.16MB | ✅ Fits | ✅ Fits |
| + ONNX Runtime | ~0.5MB | ⚠️ Tight | ✅ Comfortable |
| + JavaScript logic | ~0.1MB | ⚠️ Very tight | ✅ Good margin |

**Verdict**: **Vercel Pro might work, Enterprise definitely works**

## Implementation Strategy

### Phase 1: Single Model POC
```javascript
// Edge Function with N-HITS model (0.03MB)
import { InferenceSession } from 'onnxruntime-web/webassembly';

export default async function handler(request) {
  const session = await InferenceSession.create(nhitsModel);
  const results = await session.run(inputData);
  return Response.json({ prediction: results });
}
```

### Phase 2: Dual Model Architecture
```javascript
// Parallel execution of both models
const [tftResult, nhitsResult] = await Promise.all([
  tftSession.run(inputData),
  nhitsSession.run(inputData)
]);

// Weighted ensemble: TFT 60%, N-HITS 40%
const ensemble = tftResult * 0.6 + nhitsResult * 0.4;
```

### Phase 3: Performance Optimization
- **WebAssembly compilation** for critical paths
- **SIMD optimization** for matrix operations
- **GPU acceleration** via WebGPU backend

## Advantages Over Cloudflare

| Feature | Vercel Edge | Cloudflare Workers AI BYOM |
|---------|-------------|---------------------------|
| **Deployment** | Self-service | Enterprise approval required |
| **Timeline** | Immediate | 8-12 weeks |
| **Model Support** | Any ONNX via WASM | Custom review per model |
| **Pricing** | Transparent Pro/Enterprise | Enterprise negotiation |
| **Complexity** | Standard web deployment | Custom requirements form |

## Cost Analysis

### Vercel Pricing (Pro Plan)
- **$20/month** base cost
- **$2 per 100k invocations** beyond included
- **No GPU costs** (client-side inference)
- **Global edge deployment** included

### Estimated Monthly Cost (300 req/min)
- 300 req/min × 60 × 24 × 30 = **13M requests/month**
- 13M / 100k = 130 billing units × $2 = **$260/month**
- **Total**: ~$280/month vs $75-150 estimated for ModelScope

**Trade-off**: Higher cost but **immediate deployment** and **no enterprise barriers**

## Technical Risks

### WebAssembly Limitations
- **Memory constraints** in V8 runtime
- **No shared memory** between WASM instances
- **Limited debugging** compared to native deployment

### ONNX Runtime Web Maturity
- **Newer technology** compared to server-side ONNX
- **Browser compatibility** considerations
- **Performance variability** across edge locations

## Recommendation: Dual-Track Approach

### Track 1: Vercel Edge POC (Immediate)
1. **Start with N-HITS model** (0.03MB, minimal risk)
2. **Validate WebAssembly + ONNX Runtime Web** integration
3. **Test performance** and cost at scale
4. **Add TFT model** if POC successful

### Track 2: Cloudflare Enterprise (Parallel)
1. **Continue enterprise contact** process
2. **Use as fallback** if Vercel limitations discovered
3. **Long-term preferred platform** for cost optimization

## Next Steps

1. **Create Vercel Edge POC** with N-HITS model
2. **Benchmark performance** vs current ModelScope
3. **Test WebAssembly compilation** optimization
4. **Evaluate production readiness** within 2 weeks

**Verdict**: Vercel Edge Functions offer a **viable self-service path** for immediate deployment while Cloudflare enterprise approval is pending.