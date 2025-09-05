/**
 * Simple Test Client for Mock Edge Functions
 * Tests local Edge Function simulation without ONNX Runtime
 */

// Sample OHLCV data for testing
const sampleOHLCV = [
  ...Array.from({ length: 30 }, (_, i) => {
    const basePrice = 100 + (i * 0.1);
    return {
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      open: basePrice + Math.random() * 2 - 1,
      high: basePrice + Math.random() * 3,
      low: basePrice - Math.random() * 2,
      close: basePrice + Math.random() * 2 - 1,
      volume: Math.floor(Math.random() * 1000000) + 500000
    };
  })
];

async function testMockEndpoint(url = 'http://localhost:3000') {
  console.log('🧪 Testing Mock Edge Function');
  console.log('==============================');
  
  try {
    const response = await fetch(`${url}/api/health`, {
      method: 'GET'
    });
    
    const result = await response.json();
    console.log('✅ Health Check:', result.status);
    console.log('📍 Region:', result.edge?.region);
    
    // Test prediction
    const predResponse = await fetch(`${url}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'AAPL',
        ohlcvData: sampleOHLCV
      })
    });
    
    const predResult = await predResponse.json();
    
    if (predResult.success) {
      console.log('\n📈 Prediction Results:');
      console.log(`   Symbol: ${predResult.symbol}`);
      console.log(`   Current: $${predResult.prediction.currentPrice.toFixed(2)}`);
      console.log(`   Predicted: $${predResult.prediction.prediction.toFixed(2)}`);
      console.log(`   Change: ${predResult.prediction.changePercent.toFixed(2)}%`);
      console.log(`   Confidence: ${(predResult.prediction.confidence * 100).toFixed(1)}%`);
      console.log(`   Latency: ${predResult.performance.totalTimeMs.toFixed(1)}ms`);
    } else {
      console.error('❌ Prediction failed:', predResult.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test
const url = process.argv[2] || 'http://localhost:3000';
testMockEndpoint(url);