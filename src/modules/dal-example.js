/**
 * Data Access Layer (DAL) Usage Example
 * Shows how to use the TypeScript DAL from JavaScript files
 */

import { createDAL } from './dal.js';

/**
 * Example: Using DAL in a handler
 */
export async function exampleHandler(request, env) {
  // Create DAL instance
  const dal = createDAL(env);

  try {
    // Example 1: Read today's analysis
    const today = new Date().toISOString().split('T')[0];
    const readResult = await dal.getAnalysis(today);

    if (readResult.success) {
      console.log('Analysis found:', {
        symbols: readResult.data.symbols_analyzed.length,
        source: readResult.source
      });
    } else {
      console.log('No analysis found:', readResult.error);
    }

    // Example 2: Store new analysis
    const analysisData = {
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

    return new Response(JSON.stringify({
      success: true,
      examples_completed: 5
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Example: Replacing direct KV access
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
 */