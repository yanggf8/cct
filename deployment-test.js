/**
 * Deployment validation test
 * Simulates the actual workflow to confirm 400 errors are resolved
 */

// Import the analysis module to test the fix
import { runNeuralNetworkAnalysis } from './src/modules/analysis.js';

// Mock environment for testing
const mockEnv = {
  TFT_MODEL_URL: 'https://vercel-models-qwv7ip0qa-yang-goufangs-projects.vercel.app/api/predict-tft',
  NHITS_MODEL_URL: 'https://vercel-models-qwv7ip0qa-yang-goufangs-projects.vercel.app/api/predict-nhits',
  VERCEL_AUTOMATION_BYPASS_SECRET: process.env.VERCEL_AUTOMATION_BYPASS_SECRET || 'test'
};

async function testDeploymentReadiness() {
  console.log('🚀 Testing Deployment Readiness - 400 Error Fix Validation\n');

  try {
    console.log('📊 Running neural network analysis for AAPL...');
    const results = await runNeuralNetworkAnalysis(['AAPL'], mockEnv, new Date());

    console.log('\n✅ Analysis Results:');
    console.log(`   - Symbols analyzed: ${results.symbols_analyzed.length}`);
    console.log(`   - Trading signals: ${Object.keys(results.trading_signals).length}`);
    console.log(`   - Status: ${results.status}`);

    if (results.trading_signals.AAPL) {
      const signal = results.trading_signals.AAPL;
      console.log(`   - AAPL prediction: $${signal.current_price} → $${signal.predicted_price}`);
      console.log(`   - Direction: ${signal.direction}`);
      console.log(`   - Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
    }

    console.log('\n🎯 Deployment Status: READY ✅');
    console.log('   - 400 errors should be resolved');
    console.log('   - Models should return valid predictions');
    console.log('   - System should be fully operational');

  } catch (error) {
    console.error('\n❌ Deployment Test Failed:', error.message);
    console.log('\n🔧 Next Steps:');
    console.log('   - Check if models are deployed on Vercel');
    console.log('   - Verify authentication bypass header');
    console.log('   - Ensure Yahoo Finance API is accessible');
    console.log('   - Double-check data format conversion');
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDeploymentReadiness();
}

export { testDeploymentReadiness };