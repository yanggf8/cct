# ModelScope Service Activation Guide

## 🎯 Quick Activation Steps

### **Method 1: Web Platform (Recommended for Cloud)**
1. **Visit**: https://www.modelscope.cn/models/yanggf2/tft-primary-nhits-backup-predictor
2. **Login** to your ModelScope account
3. **Click**: "服务部署" (Service Deployment) button
4. **Select**: "在线推理" (Online Inference)
5. **Configure**:
   ```
   Runtime: Python 3.8+
   Memory: 2GB
   CPU: 2 vCPU (or GPU for better performance)
   Endpoint: /predict
   Auto-scaling: Enable
   ```
6. **Deploy**: Wait for endpoint URL (e.g., `https://xxx.modelscope.cn`)

### **Method 2: Local Testing (CLI)**
```bash
# Start local server for testing
modelscope server --model_id yanggf2/tft-primary-nhits-backup-predictor --revision master --host 0.0.0.0 --port 8000

# Test local endpoint
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "sequence_data": [
      [220.0, 225.0, 218.0, 223.0, 50000000],
      [223.0, 227.0, 221.0, 226.0, 48000000]
    ],
    "symbol": "AAPL"
  }'
```

## 🔧 After Activation

### **Configure Your Trading System**
```python
# Update your cloud trading system
trading_system = CloudIntegratedTradingSystem(
    cloudflare_account_id="your_account_id",
    cloudflare_token="your_token",
    modelscope_endpoint="https://your-real-endpoint.modelscope.cn",  # Replace with real URL
    use_mock_api=False  # Switch to production
)

# Test the connection
health = trading_system.price_predictor.health_check()
print(f"API Health: {health['api_available']}")
```

### **Validate Production API**
```bash
# Test with real API
python integrated_trading_system_cloud.py

# Compare performance
python cloud_vs_local_comparison.py
```

## 🌐 Web Platform Navigation

### **Chinese Interface:**
- **模型服务** = Model Service
- **服务部署** = Service Deployment  
- **在线推理** = Online Inference
- **创建服务** = Create Service
- **部署** = Deploy

### **English Interface (if available):**
- Look for "Deploy", "Create Endpoint", or "Inference Service"
- Click "Deploy Model" or similar button
- Configure runtime settings
- Get endpoint URL

## ⚡ Quick Test Commands

### **Test Local Server:**
```bash
# Health check
curl http://localhost:8000/health

# Prediction test
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"sequence_data": [[100,105,99,103,1000000]], "symbol": "TEST"}'
```

### **Test Cloud Endpoint:**
```bash
# Replace with your real endpoint
ENDPOINT="https://your-endpoint.modelscope.cn"

curl -X POST $ENDPOINT/predict \
  -H "Content-Type: application/json" \
  -d '{
    "sequence_data": [
      [220.0, 225.0, 218.0, 223.0, 50000000],
      [223.0, 227.0, 221.0, 226.0, 48000000]
    ],
    "symbol": "AAPL",
    "request_id": "test_001"
  }'
```

## 📊 Expected Response
```json
{
  "success": true,
  "model_used": "TFT (Primary)",
  "predicted_price": 225.67,
  "current_price": 223.0,
  "price_change": 2.67,
  "price_change_percent": 1.20,
  "direction": "UP",
  "confidence": 0.87,
  "inference_time_ms": 75.0,
  "symbol": "AAPL",
  "deployment": "ModelScope Cloud"
}
```

## 🎯 Success Checklist
- [ ] ModelScope service activated on web platform
- [ ] Endpoint URL obtained
- [ ] Trading system configured with real endpoint
- [ ] Health check passes
- [ ] Sample prediction works
- [ ] Full pipeline test successful

**Your TFT Primary + N-HITS Backup system will be fully cloud-operational once the endpoint is activated!**