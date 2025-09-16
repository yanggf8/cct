/**
 * Test script for real TFT and N-HITS models
 */

// Test OHLCV data (similar to health check)
const testOHLCV = [
  [100, 105, 99, 103, 1000000],  // Day 1
  [103, 108, 102, 106, 1200000], // Day 2
  [106, 110, 104, 108, 1100000], // Day 3
  [108, 112, 107, 110, 1300000], // Day 4
  [110, 115, 109, 113, 1150000], // Day 5
  [113, 118, 112, 116, 1400000], // Day 6
  [116, 120, 115, 118, 1250000], // Day 7
  [118, 122, 117, 120, 1350000], // Day 8
  [120, 125, 119, 123, 1450000], // Day 9
  [123, 127, 122, 125, 1300000], // Day 10
  [125, 130, 124, 128, 1500000], // Day 11
  [128, 133, 127, 131, 1400000], // Day 12
  [131, 135, 130, 133, 1300000], // Day 13
  [133, 138, 132, 136, 1600000], // Day 14
  [136, 140, 135, 138, 1450000], // Day 15
  [138, 142, 137, 140, 1350000], // Day 16
  [140, 145, 139, 143, 1700000], // Day 17
  [143, 147, 142, 145, 1500000], // Day 18
  [145, 150, 144, 148, 1600000], // Day 19
  [148, 152, 147, 150, 1550000], // Day 20
  [150, 155, 149, 153, 1800000], // Day 21
  [153, 157, 152, 155, 1650000], // Day 22
  [155, 160, 154, 158, 1700000], // Day 23
  [158, 162, 157, 160, 1600000], // Day 24
  [160, 165, 159, 163, 1900000], // Day 25
  [163, 167, 162, 165, 1750000], // Day 26
  [165, 170, 164, 168, 1800000], // Day 27
  [168, 172, 167, 170, 1700000], // Day 28
  [170, 175, 169, 173, 2000000], // Day 29
  [173, 177, 172, 175, 1850000], // Day 30
];

async function testTFTModel() {
  console.log('🧠 Testing TFT Model...');

  try {
    // Import the TFT model handler
    const { default: tftHandler } = await import('./vercel-models/api/predict-tft.js');

    // Create mock request
    const mockRequest = {
      method: 'POST',
      json: async () => ({
        symbol: 'AAPL',
        ohlcv: testOHLCV,
        options: {
          sequence_length: 30
        }
      })
    };

    const response = await tftHandler(mockRequest);
    const result = await response.json();

    console.log('✅ TFT Model Response:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ TFT Model Error:', error.message);
  }
}

async function testNHITSModel() {
  console.log('🔄 Testing N-HITS Model...');

  try {
    // Import the N-HITS model handler
    const { default: nhitsHandler } = await import('./vercel-models/api/predict-nhits.js');

    // Create mock request
    const mockRequest = {
      method: 'POST',
      json: async () => ({
        symbol: 'AAPL',
        ohlcv: testOHLCV,
        options: {
          sequence_length: 30
        }
      })
    };

    const response = await nhitsHandler(mockRequest);
    const result = await response.json();

    console.log('✅ N-HITS Model Response:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ N-HITS Model Error:', error.message);
  }
}

async function testHealthCheck() {
  console.log('🏥 Testing Health Check...');

  try {
    // Import the health check handler
    const { default: healthHandler } = await import('./vercel-models/api/health.js');

    // Create mock request with URL for health check
    const mockRequest = {
      method: 'GET',
      url: 'http://localhost:3000/api/health'
    };

    const response = await healthHandler(mockRequest);
    const result = await response.json();

    console.log('✅ Health Check Response:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Health Check Error:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Real Model Integration Tests...\n');

  await testTFTModel();
  console.log('\n' + '='.repeat(50) + '\n');

  await testNHITSModel();
  console.log('\n' + '='.repeat(50) + '\n');

  await testHealthCheck();

  console.log('\n✅ All tests completed!');
}

runAllTests().catch(console.error);