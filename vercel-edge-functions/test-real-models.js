/**
 * Test Real Model Edge Functions
 * Validates real TFT + N-HITS model integration
 */

// Sample OHLCV data for testing real models
const sampleOHLCV = [
  ...Array.from({ length: 30 }, (_, i) => {
    const basePrice = 150 + (i * 0.2); // More realistic base price
    const volatility = 0.02; // 2% daily volatility
    const trend = 0.001; // 0.1% daily trend
    
    return {
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      open: basePrice + (Math.random() - 0.5) * basePrice * volatility,
      high: basePrice * (1 + Math.random() * volatility + trend),
      low: basePrice * (1 - Math.random() * volatility),
      close: basePrice * (1 + (Math.random() - 0.5) * volatility + trend),
      volume: Math.floor(Math.random() * 2000000) + 1000000 // 1-3M volume
    };
  })
];

class RealModelTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.testResults = [];
  }

  async testRealSingleModel(symbol = 'AAPL', iterations = 3) {
    console.log(`\n📈 Testing Real N-HITS Model (${iterations} iterations)...`);
    
    const times = [];
    const predictions = [];
    
    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        
        const response = await fetch(`${this.baseUrl}/api/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: symbol,
            ohlcvData: sampleOHLCV
          })
        });
        
        const result = await response.json();
        const totalTime = performance.now() - startTime;
        
        if (result.success) {
          times.push(totalTime);
          predictions.push(result.prediction.prediction);
          
          if (i === 0) {
            console.log(`   Real Model: ${result.model?.type || 'unknown'}`);
            console.log(`   Architecture: ${result.model?.architecture || 'N-HITS'}`);
            console.log(`   Parameters: ${result.model?.parameters || 'unknown'}`);
            console.log(`   Prediction: $${result.prediction.prediction.toFixed(2)}`);
            console.log(`   Current: $${result.prediction.currentPrice.toFixed(2)}`);
            console.log(`   Change: ${result.prediction.changePercent.toFixed(2)}%`);
            console.log(`   Confidence: ${(result.prediction.confidence * 100).toFixed(1)}%`);
            console.log(`   Model Load: ${result.performance?.modelLoadTimeMs || 'N/A'}ms`);
            console.log(`   Inference: ${result.performance?.inferenceTimeMs || 'N/A'}ms`);
          }
        } else {
          console.error(`   ❌ Real model test ${i + 1} failed:`, result.error);
        }
      } catch (error) {
        console.error(`   ❌ Real model test ${i + 1} error:`, error.message);
      }
    }
    
    if (times.length > 0) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      console.log(`   📊 Real Model Performance (${times.length}/${iterations} successful):`);
      console.log(`      Average: ${avgTime.toFixed(1)}ms`);
      console.log(`      Min: ${minTime.toFixed(1)}ms`);
      console.log(`      Max: ${maxTime.toFixed(1)}ms`);
      
      this.testResults.push({
        test: 'real_single_model',
        avgTime,
        minTime,
        maxTime,
        successRate: times.length / iterations,
        modelType: 'real_nhits'
      });
    }
  }

  async testRealDualModel(symbol = 'AAPL', iterations = 3) {
    console.log(`\n🔄 Testing Real Dual TFT + N-HITS Models (${iterations} iterations)...`);
    
    const times = [];
    const predictions = [];
    const agreements = [];
    
    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        
        const response = await fetch(`${this.baseUrl}/api/predict-dual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: symbol,
            ohlcvData: sampleOHLCV
          })
        });
        
        const result = await response.json();
        const totalTime = performance.now() - startTime;
        
        if (result.success) {
          times.push(totalTime);
          predictions.push(result.prediction.ensemble.prediction);
          agreements.push(result.prediction.metrics.modelAgreement);
          
          if (i === 0) {
            console.log(`   Models: ${result.models?.type || 'unknown'} dual ensemble`);
            console.log(`   TFT Params: ${result.models?.tft?.parameters || 'unknown'}`);
            console.log(`   N-HITS Params: ${result.models?.nhits?.parameters || 'unknown'}`);
            console.log(`   Ensemble: $${result.prediction.ensemble.prediction.toFixed(2)}`);
            console.log(`   TFT: $${result.prediction.individual.tft.prediction.toFixed(2)} (${(result.prediction.individual.tft.weight * 100).toFixed(0)}%)`);
            console.log(`   N-HITS: $${result.prediction.individual.nhits.prediction.toFixed(2)} (${(result.prediction.individual.nhits.weight * 100).toFixed(0)}%)`);
            console.log(`   Agreement: ${(result.prediction.metrics.modelAgreement * 100).toFixed(1)}%`);
            console.log(`   Confidence: ${(result.prediction.ensemble.confidence * 100).toFixed(1)}%`);
            console.log(`   Inference: ${result.performance?.inferenceTimeMs || 'N/A'}ms`);
          }
        } else {
          console.error(`   ❌ Real dual test ${i + 1} failed:`, result.error);
        }
      } catch (error) {
        console.error(`   ❌ Real dual test ${i + 1} error:`, error.message);
      }
    }
    
    if (times.length > 0) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const avgAgreement = agreements.reduce((a, b) => a + b, 0) / agreements.length;
      
      console.log(`   📊 Real Dual Performance (${times.length}/${iterations} successful):`);
      console.log(`      Average: ${avgTime.toFixed(1)}ms`);
      console.log(`      Min: ${minTime.toFixed(1)}ms`);
      console.log(`      Max: ${maxTime.toFixed(1)}ms`);
      console.log(`      Model Agreement: ${(avgAgreement * 100).toFixed(1)}%`);
      
      this.testResults.push({
        test: 'real_dual_model',
        avgTime,
        minTime,
        maxTime,
        avgAgreement,
        successRate: times.length / iterations,
        modelType: 'real_tft_nhits'
      });
    }
  }

  async testHealthEndpoint() {
    console.log('🏥 Testing Health Check...');
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      const result = await response.json();
      
      console.log(`   Status: ${result.status}`);
      console.log(`   Models: TFT(${result.models?.tft?.status || 'unknown'}), N-HITS(${result.models?.nhits?.status || 'unknown'})`);
      console.log(`   Region: ${result.edge?.region}`);
      console.log(`   Capabilities: WASM(${result.capabilities?.webAssembly}), ONNX(${result.capabilities?.onnxRuntime})`);
      
      return result;
    } catch (error) {
      console.error('   ❌ Health check failed:', error.message);
      return null;
    }
  }

  printRealModelSummary() {
    console.log('\n📋 Real Model Test Summary:');
    console.log('==========================');
    
    this.testResults.forEach(result => {
      console.log(`${result.test.toUpperCase().replace('_', ' ')}:`);
      console.log(`  Model Type: ${result.modelType}`);
      if (result.avgTime) {
        console.log(`  Avg Time: ${result.avgTime.toFixed(1)}ms`);
      }
      if (result.successRate !== undefined) {
        console.log(`  Success Rate: ${(result.successRate * 100).toFixed(1)}%`);
      }
      if (result.avgAgreement !== undefined) {
        console.log(`  Model Agreement: ${(result.avgAgreement * 100).toFixed(1)}%`);
      }
      console.log('');
    });
    
    const avgLatency = this.testResults
      .filter(r => r.avgTime)
      .reduce((sum, r) => sum + r.avgTime, 0) / this.testResults.filter(r => r.avgTime).length;
    
    console.log(`🎯 Overall Real Model Performance:`);
    console.log(`   Average Latency: ${avgLatency?.toFixed(1) || 'N/A'}ms`);
    console.log(`   Edge Target (<100ms): ${avgLatency < 100 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Model Authenticity: ${this.testResults.some(r => r.modelType.includes('real')) ? '✅ REAL MODELS' : '❌ MOCK MODELS'}`);
  }

  async runRealModelTests(baseUrl) {
    if (baseUrl) this.baseUrl = baseUrl;
    
    console.log('🚀 Real Model Edge Functions Test Suite');
    console.log(`📡 Testing: ${this.baseUrl}`);
    console.log('=======================================');
    
    await this.testHealthEndpoint();
    await this.testRealSingleModel();
    await this.testRealDualModel();
    
    this.printRealModelSummary();
  }
}

// CLI usage
if (typeof module !== 'undefined' && require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const tester = new RealModelTester();
  
  tester.runRealModelTests(baseUrl).catch(console.error);
}

export default RealModelTester;