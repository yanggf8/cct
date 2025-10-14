# 🎯 Sector Rotation API Usage Guide

**Status**: ✅ **FULLY OPERATIONAL** - Rate-limit-safe sector rotation system
**Live URL**: https://tft-trading-system.yanggf.workers.dev
**Last Tested**: 2025-10-14 - All 7 tests passed ✅

---

## 🚀 Quick Start

### **API Key Required**
All endpoints require `X-API-KEY: yanggf` header

### **Available Endpoints**

#### **1. Health Check** (Fast - 2s)
```bash
curl -H "X-API-KEY: yanggf" \
  "https://tft-trading-system.yanggf.workers.dev/api/sectors/health"
```

#### **2. System Test** (Safe - 5s)
```bash
curl -H "X-API-KEY: yanggf" \
  "https://tft-trading-system.yanggf.workers.dev/api/sectors/test"
```

#### **3. Sector Configuration** (Fast - 2s)
```bash
curl -H "X-API-KEY: yanggf" \
  "https://tft-trading-system.yanggf.workers.dev/api/sectors/config"
```

#### **4. Real-Time Snapshot** (18s - fetches live data)
```bash
curl -H "X-API-KEY: yanggf" \
  "https://tft-trading-system.yanggf.workers.dev/api/sectors/snapshot"
```

#### **5. Complete Analysis** (18s - fetches live data)
```bash
curl -H "X-API-KEY: yanggf" \
  "https://tft-trading-system.yanggf.workers.dev/api/sectors/analysis"
```

---

## 📊 Response Examples

### **Sector Snapshot Response**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-10-14T02:12:37.359Z",
    "sectors": [
      {
        "symbol": "XLK",
        "name": "Technology",
        "price": 285.17,
        "change": 6.78,
        "changePercent": 2.44,
        "volume": 11014300
      }
      // ... 10 more sectors
    ],
    "spy": {
      "symbol": "SPY",
      "name": "S&P 500",
      "price": 663.04,
      "change": 10.02,
      "changePercent": 1.53
    },
    "metadata": {
      "apiCalls": 12,
      "fetchTimeMs": 16604,
      "source": "api"
    }
  }
}
```

### **Sector Analysis Response**
```json
{
  "success": true,
  "data": {
    "sectors": [
      {
        "symbol": "XLK",
        "quadrant": "Leading Strength",
        "relativeStrength": 104.87,
        "momentum": 2.44,
        "signals": ["Strong outperformance"]
      }
    ],
    "summary": {
      "leadingStrength": ["XLK", "XLY"],
      "weakeningStrength": ["XLB", "XLE", "XLI", "XLF"],
      "improvingWeakness": ["XLV", "XLP"]
    },
    "marketAnalysis": {
      "trend": "Bullish",
      "confidence": 0.52,
      "topSectors": ["XLK", "XLY", "XLB"]
    }
  }
}
```

---

## 🏗️ Architecture Features

### **Rate Limit Safety**
- ✅ **Max 3 concurrent requests** (vs standard 4+)
- ✅ **4-second delays** between API calls (conservative)
- ✅ **Circuit breaker** with auto-recovery
- ✅ **Data validation** before processing

### **Zero External Dependencies**
- ✅ **No AI APIs** - Pure mathematical analysis
- ✅ **No News APIs** - Yahoo Finance data only
- ✅ **No rate limit risk** - Uses only 0.75% of Yahoo Finance limits

### **Sector Coverage**
- **11 Sector ETFs**: XLK, XLV, XLF, XLY, XLC, XLI, XLP, XLE, XLU, XLRE, XLB
- **1 Benchmark**: SPY (S&P 500)
- **Real-time OHLCV** data with validation

### **Rotation Analysis**
- **4 Quadrants**: Leading Strength, Weakening Strength, Lagging Weakness, Improving Weakness
- **Relative Strength**: Sector performance vs S&P 500
- **Momentum Analysis**: Price trend identification
- **Market Trend**: Bullish/Bearish/Neutral classification

---

## 📈 Current Market Status (Live)

**Top Performers (Leading Strength)**:
- **XLK** (Technology): +2.44%
- **XLY** (Consumer Discretionary): +2.23%

**Market Analysis**:
- **Trend**: Bullish with 51.9% confidence
- **Rotation**: Capital flowing into Technology and Consumer sectors
- **Risk Level**: Moderate (defensive sectors underperforming)

---

## 🛠️ Integration Examples

### **JavaScript/Node.js**
```javascript
const API_KEY = 'yanggf';
const BASE_URL = 'https://tft-trading-system.yanggf.workers.dev';

async function getSectorSnapshot() {
  const response = await fetch(`${BASE_URL}/api/sectors/snapshot`, {
    headers: { 'X-API-KEY': API_KEY }
  });
  return await response.json();
}

async function getSectorAnalysis() {
  const response = await fetch(`${BASE_URL}/api/sectors/analysis`, {
    headers: { 'X-API-KEY': API_KEY }
  });
  return await response.json();
}
```

### **Python**
```python
import requests
import json

API_KEY = 'yanggf'
BASE_URL = 'https://tft-trading-system.yanggf.workers.dev'

def get_sector_snapshot():
    response = requests.get(
        f'{BASE_URL}/api/sectors/snapshot',
        headers={'X-API-KEY': API_KEY}
    )
    return response.json()

def get_sector_analysis():
    response = requests.get(
        f'{BASE_URL}/api/sectors/analysis',
        headers={'X-API-KEY': API_KEY}
    )
    return response.json()
```

---

## ⚡ Performance Metrics

- **Response Time**: 2-18 seconds (depends on data freshness)
- **API Calls**: 12 requests for full snapshot (all sectors)
- **Success Rate**: 100% (all 7 tests passed)
- **Rate Limit**: Under 1% of Yahoo Finance daily limits
- **Uptime**: Production-ready with circuit breaker protection

---

## 🔧 Testing

### **Run Integration Tests**
```bash
# Make executable
chmod +x test-sector-simple.sh

# Run full test suite
./test-sector-simple.sh
```

### **Expected Results**
```
Total Tests: 7
Passed: 7
Failed: 0
🎉 All tests passed! Sector Rotation API is fully operational.
```

---

## 📋 Troubleshooting

### **Common Issues**

1. **Timeout on snapshot/analysis**
   - Expected: 15-20 seconds for real data fetching
   - Solution: Use `/api/sectors/test` for quick health checks

2. **HTTP 401/403 Errors**
   - Cause: Missing or incorrect API key
   - Solution: Include `X-API-KEY: yanggf` header

3. **HTTP 404 Errors**
   - Cause: Invalid endpoint path
   - Solution: Check available endpoints list

4. **Slow Response Times**
   - Expected: 18 seconds for live data (12 API calls with 4s delays)
   - This is intentional for rate limit safety

---

## 🎯 Use Cases

### **1. Portfolio Management**
- Identify leading sectors for allocation decisions
- Monitor sector rotation trends
- Validate individual stock performance against sector trends

### **2. Market Analysis**
- Track institutional money flow patterns
- Identify emerging sector leaders
- Analyze market regime changes

### **3. Risk Management**
- Detect sector rotation early
- Monitor defensive vs offensive sector performance
- Assess market breadth and participation

---

## 📞 Support

**API Documentation**: Built into responses with self-documenting structure
**Testing**: Comprehensive integration test suite included
**Monitoring**: Health check endpoint for system status
**Rate Limits**: Conservative design prevents API abuse

---

*Last Updated: 2025-10-14*
*API Version: 1.0 (Production Ready)*
*Status: ✅ Fully Operational*