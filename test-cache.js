// Quick validation test for sector cache functionality
import { SectorCacheManager } from './src/modules/sector-cache-manager.js';

async function testCacheManager() {
  console.log('Testing SectorCacheManager...');
  
  // Mock DO environment
  const mockDO = {
    get: async (key) => {
      console.log(`Mock DO get: ${key}`);
      return null;
    },
    set: async (key, value, options) => {
      console.log(`Mock DO set: ${key}`, options);
      return true;
    },
    delete: async (key) => {
      console.log(`Mock DO delete: ${key}`);
      return true;
    }
  };

  try {
    const cacheManager = new SectorCacheManager(mockDO);
    
    // Test basic operations
    const testData = { symbol: 'XLK', data: 'test' };
    
    console.log('Testing set operation...');
    await cacheManager.set('test-sector', testData);
    
    console.log('Testing get operation...');
    const result = await cacheManager.get('test-sector');
    
    console.log('Testing metrics...');
    const metrics = await cacheManager.getMetrics();
    
    console.log('Cache test completed successfully');
    return true;
  } catch (error) {
    console.error('Cache test failed:', error.message);
    return false;
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCacheManager().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testCacheManager };
