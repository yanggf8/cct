#!/usr/bin/env node

const BASE_URL = 'https://sector-cache-test.yanggf.workers.dev';

async function testEndpoint(path, description) {
  console.log(`\n🧪 ${description}`);
  const start = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}${path}`);
    const duration = Date.now() - start;
    const data = await response.json();
    
    console.log(`   Status: ${response.status} (${duration}ms)`);
    console.log(`   Success: ${data.success}`);
    
    if (data.metadata?.cached !== undefined) {
      console.log(`   Cache: ${data.metadata.cached ? 'HIT' : 'MISS'}`);
    }
    
    if (data.data?.services?.cacheManager) {
      console.log(`   Cache Manager: ${data.data.services.cacheManager.status}`);
    }
    
    return { success: data.success, duration, cached: data.metadata?.cached };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function validateCache() {
  console.log('🚀 Validating DO-backed cache in production...');
  
  // Test health endpoint
  await testEndpoint('/api/v1/sectors/health', 'Health Check');
  
  // Test symbols endpoint  
  await testEndpoint('/api/v1/sectors/symbols', 'Symbols List');
  
  // Test cache performance with snapshot
  console.log('\n📊 Cache Performance Test:');
  
  const first = await testEndpoint('/api/v1/sectors/snapshot', 'First Request (Cache Miss)');
  await new Promise(r => setTimeout(r, 1000));
  
  const second = await testEndpoint('/api/v1/sectors/snapshot', 'Second Request (Cache Hit)');
  
  if (first.success && second.success) {
    const speedup = first.duration / second.duration;
    console.log(`\n⚡ Performance: ${speedup.toFixed(1)}x speedup on cache hit`);
  }
  
  console.log('\n✅ Production validation completed');
  console.log(`🌐 Worker URL: ${BASE_URL}`);
}

validateCache().catch(console.error);
