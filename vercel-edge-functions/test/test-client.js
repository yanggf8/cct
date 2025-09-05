/**
 * Test Client for Vercel Edge Functions
 * Validates TFT + N-HITS edge deployment performance
 */

// Sample OHLCV data for testing
const sampleOHLCV = [
  // Generate 30 days of sample data
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

class EdgeFunctionTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.testResults = [];
  }

  async testHealthCheck() {
    console.log('🏥 Testing Health Check...');
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      const result = await response.json();
      
      console.log(`   Status: ${result.status}`);
      console.log(`   Models: TFT(${result.models.tft.status}), N-HITS(${result.models.nhits.status})`);
      console.log(`   Region: ${result.edge.region}`);
      console.log(`   Response Time: ${result.performance.responseTimeMs}ms`);
      
      return result;
    } catch (error) {
      console.error('   ❌ Health check failed:', error.message);
      return null;
    }
  }

  async testSingleModel(symbol = 'AAPL', iterations = 5) {
    console.log(`\n📈 Testing Single N-HITS Model (${iterations} iterations)...`);
    
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
            console.log(`   Prediction: $${result.prediction.prediction.toFixed(2)}`);
            console.log(`   Change: ${result.prediction.changePercent.toFixed(2)}%`);
            console.log(`   Confidence: ${(result.prediction.confidence * 100).toFixed(1)}%`);
          }
        } else {
          console.error(`   ❌ Request ${i + 1} failed:`, result.error);
        }
      } catch (error) {
        console.error(`   ❌ Request ${i + 1} error:`, error.message);
      }
    }
    
    if (times.length > 0) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      console.log(`   📊 Performance (${times.length}/${iterations} successful):`);
      console.log(`      Average: ${avgTime.toFixed(1)}ms`);
      console.log(`      Min: ${minTime.toFixed(1)}ms`);
      console.log(`      Max: ${maxTime.toFixed(1)}ms`);
      
      this.testResults.push({
        test: 'single_model',
        avgTime,
        minTime,
        maxTime,
        successRate: times.length / iterations
      });
    }
  }

  async testDualModel(symbol = 'AAPL', iterations = 5) {
    console.log(`\n🔄 Testing Dual TFT + N-HITS Model (${iterations} iterations)...`);
    
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
            console.log(`   Ensemble: $${result.prediction.ensemble.prediction.toFixed(2)}`);
            console.log(`   TFT: $${result.prediction.individual.tft.prediction.toFixed(2)} (${(result.prediction.individual.tft.weight * 100).toFixed(0)}%)`);
            console.log(`   N-HITS: $${result.prediction.individual.nhits.prediction.toFixed(2)} (${(result.prediction.individual.nhits.weight * 100).toFixed(0)}%)`);
            console.log(`   Agreement: ${(result.prediction.metrics.modelAgreement * 100).toFixed(1)}%`);
            console.log(`   Confidence: ${(result.prediction.ensemble.confidence * 100).toFixed(1)}%`);
          }
        } else {
          console.error(`   ❌ Request ${i + 1} failed:`, result.error);
        }
      } catch (error) {
        console.error(`   ❌ Request ${i + 1} error:`, error.message);
      }
    }
    
    if (times.length > 0) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const avgAgreement = agreements.reduce((a, b) => a + b, 0) / agreements.length;
      
      console.log(`   📊 Performance (${times.length}/${iterations} successful):`);
      console.log(`      Average: ${avgTime.toFixed(1)}ms`);
      console.log(`      Min: ${minTime.toFixed(1)}ms`);
      console.log(`      Max: ${maxTime.toFixed(1)}ms`);
      console.log(`      Model Agreement: ${(avgAgreement * 100).toFixed(1)}%`);
      
      this.testResults.push({
        test: 'dual_model',
        avgTime,
        minTime,
        maxTime,
        avgAgreement,
        successRate: times.length / iterations
      });
    }
  }

  async testConcurrentRequests(concurrency = 5) {
    console.log(`\n⚡ Testing Concurrent Requests (${concurrency} parallel)...`);
    
    const startTime = performance.now();
    
    const promises = Array.from({ length: concurrency }, (_, i) =>
      fetch(`${this.baseUrl}/api/predict-dual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: `TEST${i}`,
          ohlcvData: sampleOHLCV
        })
      })
      .then(r => r.json())
      .catch(e => ({ success: false, error: e.message }))
    );
    
    try {
      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      const successful = results.filter(r => r.success).length;
      
      console.log(`   📊 Concurrent Performance:`);
      console.log(`      Total Time: ${totalTime.toFixed(1)}ms`);
      console.log(`      Success Rate: ${successful}/${concurrency} (${((successful/concurrency)*100).toFixed(1)}%)`);
      console.log(`      Avg per Request: ${(totalTime/concurrency).toFixed(1)}ms`);
      
      this.testResults.push({
        test: 'concurrent',
        totalTime,
        successRate: successful / concurrency,
        avgPerRequest: totalTime / concurrency
      });
    } catch (error) {
      console.error('   ❌ Concurrent test failed:', error.message);
    }
  }

  printSummary() {
    console.log('\n📋 Test Summary:');
    console.log('================');
    
    this.testResults.forEach(result => {
      console.log(`${result.test.toUpperCase()}:`);
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
    
    console.log(`🎯 Overall Average Latency: ${avgLatency.toFixed(1)}ms`);
    console.log(`✅ Edge deployment target (<100ms): ${avgLatency < 100 ? 'PASSED' : 'FAILED'}`);
  }

  async runAllTests(baseUrl) {
    if (baseUrl) this.baseUrl = baseUrl;
    
    console.log('🚀 Vercel Edge Functions Test Suite');
    console.log(`📡 Testing: ${this.baseUrl}`);
    console.log('=====================================');
    
    await this.testHealthCheck();
    await this.testSingleModel();
    await this.testDualModel();
    await this.testConcurrentRequests();
    
    this.printSummary();
  }
}

// CLI usage
if (typeof module !== 'undefined' && require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const tester = new EdgeFunctionTester();
  
  tester.runAllTests(baseUrl).catch(console.error);
}

export default EdgeFunctionTester;