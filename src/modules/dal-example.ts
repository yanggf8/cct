/**
 * Data Access Layer (DAL) Usage Example
 * Shows how to use the TypeScript DAL from JavaScript files
 */

import { createDAL } from './dal.js';
import type { CloudflareEnvironment } from '../types.js';

// Type definitions for the example data
interface TradingSignal {
  symbol: string;
  sentiment_layers: Array<{
    sentiment: string;
    confidence: number;
    reasoning: string;
  }>;
}

interface AnalysisData {
  symbols_analyzed: string[];
  trading_signals: Record<string, TradingSignal>;
  timestamp: string;
}

interface ExampleResponse {
  success: boolean;
  examples_completed?: number;
  error?: string;
}

/**
 * Example: Using DAL in a handler
 */
export async function exampleHandler(request: Request, env: CloudflareEnvironment): Promise<Response> {
  // Create DAL instance
  const dal = createDAL(env);

  try {
    // Example 1: Read today's analysis
    const today = new Date().toISOString().split('T')[0];
    const readResult = await dal.getAnalysis(today);

    if (readResult.success && readResult.data) {
      console.log('Analysis found:', {
        symbols: readResult.data.symbols_analyzed.length,
        source: readResult.source
      });
    } else {
      console.log('No analysis found:', readResult.error);
    }

    // Example 2: Store new analysis
    const analysisData: AnalysisData = {
      symbols_analyzed: ['AAPL', 'MSFT'],
      trading_signals: {
        AAPL: {
          symbol: 'AAPL',
          sentiment_layers: [{
            sentiment: 'bullish',
            confidence: 0.85,
            reasoning: 'Strong momentum'
          }]
        }
      },
      timestamp: new Date().toISOString()
    };

    const writeResult = await dal.storeAnalysis(today, analysisData);
    if (writeResult.success) {
      console.log('Analysis stored:', writeResult.key);
    }

    // Example 3: Store manual analysis (on-demand)
    const timestamp = Date.now();
    const manualResult = await dal.storeManualAnalysis(timestamp, analysisData);
    console.log('Manual analysis stored:', manualResult.key);

    // Example 4: List keys
    const keys = await dal.listKeys('analysis_2025-09');
    console.log('Found keys:', keys.keys.length);

    // Example 5: Generic read/write
    const customData = { custom: 'data' };
    await dal.write('custom_key', customData, { expirationTtl: 3600 });
    const customRead = await dal.read('custom_key');

    const response: ExampleResponse = {
      success: true,
      examples_completed: 5
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    const errorResponse: ExampleResponse = {
      success: false,
      error: error.message
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Example: Advanced DAL usage with error handling
 */
export async function advancedDALExample(env: CloudflareEnvironment): Promise<{
  success: boolean;
  operations: Array<{ operation: string; success: boolean; duration?: number }>;
  totalDuration: number;
}> {
  const dal = createDAL(env);
  const operations: Array<{ operation: string; success: boolean; duration?: number }> = [];
  const startTime = Date.now();

  try {
    // Operation 1: Batch analysis storage
    console.log('=== Batch Analysis Storage Example ===');
    const batchStart = Date.now();

    const batchData = {
      batch_id: `batch_${Date.now()}`,
      analyses: ['AAPL', 'MSFT', 'GOOGL'].map(symbol => ({
        symbol,
        confidence: Math.random() * 0.3 + 0.7,
        sentiment: Math.random() > 0.5 ? 'bullish' : 'bearish',
        timestamp: new Date().toISOString()
      }))
    };

    const batchResult = await dal.write(`batch_${Date.now()}`, batchData, {
      expirationTtl: 86400 // 24 hours
    });

    operations.push({
      operation: 'batch_storage',
      success: batchResult.success,
      duration: Date.now() - batchStart
    });

    // Operation 2: Conditional read with cache
    console.log('=== Conditional Read with Cache Example ===');
    const cacheStart = Date.now();

    const cacheKey = `cache_analysis_${new Date().toISOString().split('T')[0]}`;
    const cacheResult = await dal.read(cacheKey);

    if (!cacheResult.success) {
      // Simulate fetching fresh data and caching it
      const freshData = {
        symbols_analyzed: ['NVDA', 'TSLA'],
        cache_timestamp: new Date().toISOString(),
        source: 'fresh_fetch'
      };

      const cacheWriteResult = await dal.write(cacheKey, freshData, {
        expirationTtl: 3600 // 1 hour
      });

      operations.push({
        operation: 'cache_miss_and_write',
        success: cacheWriteResult.success,
        duration: Date.now() - cacheStart
      });
    } else {
      operations.push({
        operation: 'cache_hit',
        success: true,
        duration: Date.now() - cacheStart
      });
    }

    // Operation 3: Atomic-like operation simulation
    console.log('=== Atomic-like Operation Example ===');
    const atomicStart = Date.now();

    const atomicKey = `atomic_${Date.now()}`;
    const transactionData = {
      transaction_id: atomicKey,
      steps: ['validate', 'process', 'store'],
      current_step: 'validate',
      status: 'in_progress'
    };

    // Step 1: Initialize transaction
    await dal.write(atomicKey, transactionData);

    // Step 2: Process step
    transactionData.current_step = 'process';
    await dal.write(atomicKey, transactionData);

    // Step 3: Complete transaction
    transactionData.current_step = 'store';
    transactionData.status = 'completed';
    const atomicResult = await dal.write(atomicKey, transactionData);

    operations.push({
      operation: 'atomic_transaction',
      success: atomicResult.success,
      duration: Date.now() - atomicStart
    });

    // Operation 4: Pattern-based key listing
    console.log('=== Pattern-based Key Listing Example ===');
    const listStart = Date.now();

    const listResult = await dal.listKeys('analysis_');
    const filteredKeys = listResult.keys.filter(key =>
      key.includes('2025') && !key.includes('manual')
    );

    operations.push({
      operation: 'pattern_based_listing',
      success: listResult.success,
      duration: Date.now() - listStart
    });

    console.log(`Listed ${filteredKeys.length} keys matching pattern`);

    // Operation 5: Data validation and cleanup
    console.log('=== Data Validation and Cleanup Example ===');
    const cleanupStart = Date.now();

    const oldKeys = listResult.keys.filter(key => {
      const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const keyDate = new Date(dateMatch[1]);
        const daysOld = (Date.now() - keyDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysOld > 30; // Clean up data older than 30 days
      }
      return false;
    });

    let cleanupCount = 0;
    for (const oldKey of oldKeys.slice(0, 5)) { // Limit cleanup for demo
      try {
        await env.TRADING_RESULTS.delete(oldKey);
        cleanupCount++;
      } catch (error: unknown) {
        console.warn(`Failed to cleanup key ${oldKey}:`, error);
      }
    }

    operations.push({
      operation: 'data_cleanup',
      success: true,
      duration: Date.now() - cleanupStart
    });

    console.log(`Cleaned up ${cleanupCount} old keys`);

    return {
      success: true,
      operations,
      totalDuration: Date.now() - startTime
    };

  } catch (error: any) {
    console.error('Advanced DAL example failed:', error);
    return {
      success: false,
      operations,
      totalDuration: Date.now() - startTime
    };
  }
}

/**
 * Example: Error handling patterns with DAL
 */
export async function errorHandlingExample(env: CloudflareEnvironment): Promise<{
  success: boolean;
  errors: Array<{ type: string; message: string; recovered: boolean }>;
}> {
  const dal = createDAL(env);
  const errors: Array<{ type: string; message: string; recovered: boolean }> = [];

  try {
    // Example 1: Handling missing data gracefully
    console.log('=== Missing Data Handling Example ===');
    const futureDate = '2099-12-31'; // Future date with no data
    const missingResult = await dal.getAnalysis(futureDate);

    if (!missingResult.success) {
      errors.push({
        type: 'missing_data',
        message: missingResult.error || 'Data not found',
        recovered: true
      });

      // Recovery: Use default data
      console.log('Using default data for missing analysis');
    }

    // Example 2: Handling write failures
    console.log('=== Write Failure Handling Example ===');
    try {
      // Try to write with invalid data (simulated)
      const invalidData = null as any;
      const writeResult = await dal.write('test_invalid', invalidData);

      if (!writeResult.success) {
        errors.push({
          type: 'write_failure',
          message: writeResult.error || 'Write operation failed',
          recovered: false
        });
      }
    } catch (writeError: any) {
      errors.push({
        type: 'write_exception',
        message: writeError.message,
        recovered: true // Exception caught and handled
      });
    }

    // Example 3: Handling read-after-write consistency
    console.log('=== Read-After-Write Consistency Example ===');
    const testKey = `consistency_test_${Date.now()}`;
    const testData = { test: 'data', timestamp: Date.now() };

    // Write data
    const writeResult = await dal.write(testKey, testData);

    if (writeResult.success) {
      // Immediately try to read back (may fail due to eventual consistency)
      let readAttempts = 0;
      const maxAttempts = 3;
      let consistencyAchieved = false;

      while (readAttempts < maxAttempts && !consistencyAchieved) {
        readAttempts++;

        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        const readResult = await dal.read(testKey);
        if (readResult.success && readResult.data) {
          const readData = readResult.data as typeof testData;
          if (readData.timestamp === testData.timestamp) {
            consistencyAchieved = true;
            console.log(`Consistency achieved after ${readAttempts} attempts`);
          }
        }
      }

      if (!consistencyAchieved) {
        errors.push({
          type: 'consistency_timeout',
          message: 'Read-after-write consistency not achieved',
          recovered: false
        });
      }
    }

    // Example 4: Handling large data operations
    console.log('=== Large Data Handling Example ===');
    try {
      const largeData = {
        symbols: Array.from({ length: 1000 }, (_: any, i: any) => ({
          symbol: `SYM${i.toString().padStart(4, '0')}`,
          data: Array.from({ length: 100 }, (_: any, j: any) => ({
            timestamp: Date.now() - j * 1000,
            value: Math.random() * 100
          }))
        }))
      };

      const largeDataKey = `large_data_${Date.now()}`;
      const largeWriteResult = await dal.write(largeDataKey, largeData, {
        expirationTtl: 3600
      });

      if (!largeWriteResult.success) {
        errors.push({
          type: 'large_data_failure',
          message: 'Failed to write large dataset',
          recovered: true // Can implement chunking strategy
        });
      }

    } catch (largeDataError: any) {
      errors.push({
        type: 'large_data_exception',
        message: largeDataError.message,
        recovered: false
      });
    }

    return {
      success: true,
      errors
    };

  } catch (error: any) {
    console.error('Error handling example failed:', error);
    return {
      success: false,
      errors: [{
        type: 'global_error',
        message: error.message,
        recovered: false
      }]
    };
  }
}

/**
 * Documentation: Replacing direct KV access
 *
 * BEFORE (Direct KV access):
 * ```js
 * const key = `analysis_${date}`;
 * const data = await env.TRADING_RESULTS.get(key);
 * const parsed = JSON.parse(data);
 * ```
 *
 * AFTER (Using DAL):
 * ```js
 * const dal = createDAL(env);
 * const result = await dal.getAnalysis(date);
 * if (result.success) {
 *   const parsed = result.data;
 * }
 * ```
 *
 * Benefits:
 * - Type safety from TypeScript
 * - Automatic retry logic
 * - Consistent error handling
 * - KV Key Factory integration
 * - Comprehensive logging
 * - Built-in caching support
 * - Read-after-write consistency patterns
 */

export default {
  exampleHandler,
  advancedDALExample,
  errorHandlingExample
};

// Export types for external use
export type {
  AnalysisData,
  TradingSignal,
  ExampleResponse
};