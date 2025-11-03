/**
 * DAL Migration Examples - Phase 4 Implementation
 * Data Access Improvement Plan - Migration Guide
 *
 * This file demonstrates how to migrate from the original DAL
 * to the simplified enhanced DAL with zero breaking changes.
 */

import { createDAL, type AnalysisData } from './dal.js';
import { createSimplifiedEnhancedDAL, type CacheAwareResult } from './simplified-enhanced-dal.js';
import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('dal-migration');

/**
 * Example 1: Basic Migration - Read Operations
 *
 * BEFORE: Original DAL
 * AFTER: Simplified Enhanced DAL with cache awareness
 */
export async function exampleMigration_ReadAnalysis(env: CloudflareEnvironment) {
  logger.info('=== Example 1: Read Analysis Migration ===');

  // BEFORE: Original DAL
  const originalDAL = createDAL(env);
  const originalResult = await originalDAL.getAnalysis('2025-01-10');

  console.log('Original DAL Result:', {
    success: originalResult.success,
    hasData: !!originalResult.data,
    source: originalResult.source,
    key: originalResult.key
  });

  // AFTER: Simplified Enhanced DAL
  const enhancedDAL = createSimplifiedEnhancedDAL(env, {
    enableCache: true,
    environment: 'production'
  });

  const enhancedResult = await enhancedDAL.getAnalysis('2025-01-10');

  console.log('Enhanced DAL Result:', {
    success: enhancedResult.success,
    hasData: !!enhancedResult.data,
    cached: enhancedResult.cached,
    cacheSource: enhancedResult.cacheSource,
    responseTime: enhancedResult.responseTime,
    timestamp: enhancedResult.timestamp
  });

  // Second call should be cached
  const cachedResult = await enhancedDAL.getAnalysis('2025-01-10');
  console.log('Cached Result:', {
    success: cachedResult.success,
    cached: cachedResult.cached,
    cacheSource: cachedResult.cacheSource,
    responseTime: cachedResult.responseTime
  });
}

/**
 * Example 2: Write Operations with Cache Invalidation
 */
export async function exampleMigration_StoreAnalysis(env: CloudflareEnvironment) {
  logger.info('=== Example 2: Write Analysis Migration ===');

  const enhancedDAL = createSimplifiedEnhancedDAL(env);

  const sampleAnalysis: AnalysisData = {
    test_mode: false,
    symbols_analyzed: ['AAPL', 'MSFT', 'GOOGL'],
    trading_signals: {
      'AAPL': {
        symbol: 'AAPL',
        sentiment_layers: [{
          sentiment: 'bullish',
          confidence: 85,
          reasoning: 'Strong technical indicators',
          model: 'GPT-OSS-120B',
          source: 'news_analysis'
        }]
      }
    },
    timestamp: new Date().toISOString(),
    data_source: 'api_test',
    analysis_type: 'daily_sentiment'
  };

  // Store analysis (invalidates cache automatically)
  const storeResult = await enhancedDAL.storeAnalysis('2025-01-10', sampleAnalysis);

  console.log('Store Result:', {
    success: storeResult.success,
    cached: storeResult.cached,
    responseTime: storeResult.responseTime,
    timestamp: storeResult.timestamp
  });

  // Verify cache is cleared by reading again
  const verifyResult = await enhancedDAL.getAnalysis('2025-01-10');
  console.log('Verify Result (should be from KV):', {
    cached: verifyResult.cached,
    cacheSource: verifyResult.cacheSource
  });
}

/**
 * Example 3: Signal Tracking Operations
 */
export async function exampleMigration_SignalTracking(env: CloudflareEnvironment) {
  logger.info('=== Example 3: Signal Tracking Migration ===');

  const enhancedDAL = createSimplifiedEnhancedDAL(env);

  // Store high-confidence signals
  const signals = [
    {
      symbol: 'AAPL',
      prediction: 'up' as const,
      confidence: 92,
      reasoning: 'Strong momentum with positive news sentiment'
    },
    {
      symbol: 'MSFT',
      prediction: 'neutral' as const,
      confidence: 78,
      reasoning: 'Mixed signals with balanced risk/reward'
    }
  ];

  const storeSignalsResult = await enhancedDAL.storeHighConfidenceSignals('2025-01-10', signals);
  console.log('Store Signals Result:', {
    success: storeSignalsResult.success,
    responseTime: storeSignalsResult.responseTime
  });

  // Get signals (should be cached on second call)
  const getSignalsResult1 = await enhancedDAL.getHighConfidenceSignals('2025-01-10');
  console.log('Get Signals (Call 1):', {
    success: getSignalsResult1.success,
    cached: getSignalsResult1.cached,
    signalCount: getSignalsResult1.data?.signals.length
  });

  const getSignalsResult2 = await enhancedDAL.getHighConfidenceSignals('2025-01-10');
  console.log('Get Signals (Call 2 - Cached):', {
    success: getSignalsResult2.success,
    cached: getSignalsResult2.cached,
    responseTime: getSignalsResult2.responseTime
  });

  // Update signal tracking
  const updateResult = await enhancedDAL.updateSignalTracking(
    'signal_001',
    {
      status: 'active',
      confidence: 94,
      actual: 'up',
      accuracy: 0.98
    },
    '2025-01-10'
  );

  console.log('Update Tracking Result:', {
    success: updateResult.success,
    responseTime: updateResult.responseTime
  });
}

/**
 * Example 4: Performance Comparison
 */
export async function exampleMigration_PerformanceComparison(env: CloudflareEnvironment) {
  logger.info('=== Example 4: Performance Comparison ===');

  const originalDAL = createDAL(env);
  const enhancedDAL = createSimplifiedEnhancedDAL(env);

  // Test multiple operations
  const iterations = 5;
  const testDate = '2025-01-10';

  console.log(`Testing ${iterations} read operations...`);

  // Original DAL performance
  const originalStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    await originalDAL.getAnalysis(testDate);
  }
  const originalTime = Date.now() - originalStart;

  // Enhanced DAL performance (includes caching)
  const enhancedStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    await enhancedDAL.getAnalysis(testDate);
  }
  const enhancedTime = Date.now() - enhancedStart;

  console.log('Performance Comparison:', {
    original: {
      totalTime: originalTime,
      avgTime: Math.round(originalTime / iterations)
    },
    enhanced: {
      totalTime: enhancedTime,
      avgTime: Math.round(enhancedTime / iterations)
    },
    improvement: Math.round(((originalTime - enhancedTime) / originalTime) * 100)
  });

  // Enhanced DAL statistics
  const stats = enhancedDAL.getPerformanceStats();
  console.log('Enhanced DAL Statistics:', stats);
}

/**
 * Example 5: Batch Operations
 */
export async function exampleMigration_BatchOperations(env: CloudflareEnvironment) {
  logger.info('=== Example 5: Batch Operations ===');

  const enhancedDAL = createSimplifiedEnhancedDAL(env);

  // Store multiple reports
  const reports = [
    { type: 'pre-market' as const, data: { summary: 'Pre-market analysis complete' } },
    { type: 'intraday' as const, data: { summary: 'Intraday analysis complete' } },
    { type: 'end-of-day' as const, data: { summary: 'End-of-day analysis complete' } }
  ];

  console.log('Storing multiple reports...');
  const batchStart = Date.now();

  for (const report of reports) {
    const result = await enhancedDAL.storeDailyReport(report.type, '2025-01-10', report.data);
    console.log(`Store ${report.type} report:`, {
      success: result.success,
      responseTime: result.responseTime
    });
  }

  const batchTime = Date.now() - batchStart;
  console.log(`Batch store time: ${batchTime}ms`);

  // Read all reports (some should be cached)
  console.log('Reading all reports...');
  const readStart = Date.now();

  for (const report of reports) {
    const result = await enhancedDAL.getDailyReport(report.type, '2025-01-10');
    console.log(`Get ${report.type} report:`, {
      success: result.success,
      cached: result.cached,
      responseTime: result.responseTime
    });
  }

  const readTime = Date.now() - readStart;
  console.log(`Batch read time: ${readTime}ms`);

  // Final statistics
  const finalStats = enhancedDAL.getPerformanceStats();
  console.log('Final Performance Stats:', finalStats);
}

/**
 * Example 6: Error Handling and Fallbacks
 */
export async function exampleMigration_ErrorHandling(env: CloudflareEnvironment) {
  logger.info('=== Example 6: Error Handling ===');

  const enhancedDAL = createSimplifiedEnhancedDAL(env, {
    maxRetries: 2,
    enableCache: true
  });

  // Test non-existent data
  const notFoundResult = await enhancedDAL.getAnalysis('9999-99-99');
  console.log('Not Found Result:', {
    success: notFoundResult.success,
    error: notFoundResult.error,
    cached: notFoundResult.cached,
    responseTime: notFoundResult.responseTime
  });

  // Test generic operations
  const genericRead = await enhancedDAL.read('unknown_key');
  console.log('Generic Read (Unknown):', {
    success: genericRead.success,
    error: genericRead.error,
    cached: genericRead.cached
  });

  // Test list operations
  const listResult = await enhancedDAL.listKeys('analysis_', 10);
  console.log('List Keys Result:', {
    keyCount: listResult.keys.length,
    hasCursor: !!listResult.cursor
  });

  // Test delete operations
  const deleteResult = await enhancedDAL.deleteKey('test_key_to_delete');
  console.log('Delete Result:', {
    success: deleteResult.success,
    error: deleteResult.error
  });
}

/**
 * Complete Migration Example - All scenarios
 */
export async function runCompleteMigrationExample(env: CloudflareEnvironment) {
  logger.info('🚀 Starting Complete DAL Migration Example');

  try {
    await exampleMigration_ReadAnalysis(env);
    console.log('\n');

    await exampleMigration_StoreAnalysis(env);
    console.log('\n');

    await exampleMigration_SignalTracking(env);
    console.log('\n');

    await exampleMigration_PerformanceComparison(env);
    console.log('\n');

    await exampleMigration_BatchOperations(env);
    console.log('\n');

    await exampleMigration_ErrorHandling(env);
    console.log('\n');

    logger.info('✅ Complete DAL Migration Example finished successfully');

  } catch (error: any) {
    logger.error('❌ Migration example failed', { error: (error instanceof Error ? error.message : String(error)), stack: error.stack });
  }
}

/**
 * Migration Helper - Check Compatibility
 */
export function checkMigrationCompatibility(): {
  originalDALMethods: string[];
  enhancedDALMethods: string[];
  compatibility: string[];
} {
  const originalDAL = createDAL({} as any);
  const enhancedDAL = createSimplifiedEnhancedDAL({} as any);

  const originalMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(originalDAL))
    .filter(name => typeof (originalDAL as any)[name] === 'function' && name !== 'constructor');

  const enhancedMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(enhancedDAL))
    .filter(name => typeof (enhancedDAL as any)[name] === 'function' && name !== 'constructor');

  const compatibility = originalMethods.filter(method => Object.keys(enhancedDAL).includes(method));

  return {
    originalDALMethods: originalMethods,
    enhancedDALMethods: enhancedMethods,
    compatibility
  };
}

export default {
  runCompleteMigrationExample,
  exampleMigration_ReadAnalysis,
  exampleMigration_StoreAnalysis,
  exampleMigration_SignalTracking,
  exampleMigration_PerformanceComparison,
  exampleMigration_BatchOperations,
  exampleMigration_ErrorHandling,
  checkMigrationCompatibility
};