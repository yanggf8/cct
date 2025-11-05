#!/usr/bin/env node

// DO Environment Cache Test
console.log('🧪 Testing DO-backed sector cache...\n');

const testEndpoints = [
  '/api/v1/sectors/snapshot',
  '/api/v1/sectors/health', 
  '/api/v1/sectors/symbols'
];

async function testEndpoint(url, baseUrl = 'http://localhost:8787') {
  const fullUrl = `${baseUrl}${url}`;
  const start = Date.now();
  
  try {
    const response = await fetch(fullUrl);
    const duration = Date.now() - start;
    const data = await response.json();
    
    console.log(`✅ ${url}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Time: ${duration}ms`);
    console.log(`   Cache: ${data.cached ? 'HIT' : 'MISS'}`);
    
    if (data.metadata?.cacheStats) {
      const stats = data.metadata.cacheStats;
      console.log(`   Hit Rate: ${((stats.hits / stats.totalRequests) * 100).toFixed(1)}%`);
    }
    
    return { success: true, duration, cached: data.cached };
  } catch (error) {
    console.log(`❌ ${url}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runCacheTest() {
  console.log('Testing cache performance (2 requests per endpoint):\n');
  
  for (const endpoint of testEndpoints) {
    console.log(`Testing ${endpoint}:`);
    
    // First request (should be cache MISS)
    const first = await testEndpoint(endpoint);
    await new Promise(r => setTimeout(r, 100));
    
    // Second request (should be cache HIT)
    const second = await testEndpoint(endpoint);
    
    if (first.success && second.success) {
      const speedup = first.duration / second.duration;
      console.log(`   Speedup: ${speedup.toFixed(1)}x faster on cache hit\n`);
    } else {
      console.log('   ⚠️  Cache test incomplete\n');
    }
  }
}

// Check if wrangler dev is running
async function checkDevServer() {
  try {
    const response = await fetch('http://localhost:8787/api/v1/sectors/health');
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const isRunning = await checkDevServer();
  
  if (!isRunning) {
    console.log('❌ Wrangler dev server not running');
    console.log('\nStart with: wrangler dev --local');
    console.log('Then run: node test-do-cache.js\n');
    process.exit(1);
  }
  
  await runCacheTest();
  
  console.log('🎉 DO cache testing completed');
  console.log('\nNext: Check wrangler logs for DO operations');
}

main().catch(console.error);
