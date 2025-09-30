/**
 * HTTP Data Handlers
 * HTTP request handlers for data retrieval, storage, and KV operations
 * Note: This is the HTTP/presentation layer - uses DAL for actual storage operations
 */

import { getFactTableData, getCronHealthStatus } from '../data.js';
import { createLogger } from '../logging.js';
import { KVKeyFactory, KeyTypes, KeyHelpers } from '../kv-key-factory.js';
import { createDAL } from '../dal.js';

const logger = createLogger('http-data-handlers');

/**
 * Handle get results requests
 */
export async function handleGetResults(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Results request received', { requestId });

    const dal = createDAL(env);

    // Try to get the latest analysis from KV storage using DAL
    const today = new Date().toISOString().split('T')[0];
    const analysisKey = `analysis_${today}`;

    const result = await dal.read(analysisKey);

    if (result.success && result.data) {
      const parsedData = result.data;

      logger.info('Results retrieved from KV storage', {
        requestId,
        analysisKey,
        symbolsFound: parsedData.symbols_analyzed?.length || 0
      });

      return new Response(JSON.stringify(parsedData, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      logger.warn('No analysis results found for today', {
        requestId,
        analysisKey,
        suggestion: 'Run /analyze to generate results'
      });

      return new Response(JSON.stringify({
        success: false,
        message: 'No analysis found for today. Run /analyze to generate results.',
        analyzed_date: today,
        request_id: requestId,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    logger.error('Failed to retrieve results', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle fact table requests
 */
export async function handleFactTable(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Fact table request received', { requestId });

    const factTableData = await getFactTableData(env);

    logger.info('Fact table data retrieved', {
      requestId,
      recordsFound: factTableData?.length || 0
    });

    return new Response(JSON.stringify({
      success: true,
      fact_table: factTableData,
      generated_at: new Date().toISOString(),
      request_id: requestId
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Failed to generate fact table', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle cron health check requests
 */
export async function handleCronHealth(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Cron health check requested', { requestId });

    const healthStatus = await getCronHealthStatus(env);

    logger.info('Cron health check completed', {
      requestId,
      status: healthStatus.status,
      lastExecution: healthStatus.last_execution
    });

    return new Response(JSON.stringify({
      success: true,
      cron_health: healthStatus,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Cron health check failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV debug operations
 */
export async function handleKVDebug(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('KV debug operation requested', { requestId });

    const dal = createDAL(env);
    const testKey = `test_kv_${Date.now()}`;
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      data: 'KV write test successful'
    };

    // Test KV write using DAL
    const writeResult = await dal.write(testKey, testData);
    if (!writeResult.success) {
      throw new Error(`KV write failed: ${writeResult.error}`);
    }
    logger.debug('KV write operation successful', { requestId, testKey });

    // Test KV read using DAL
    const readResult = await dal.read(testKey);
    if (!readResult.success || !readResult.data) {
      throw new Error('KV read operation failed - data not found');
    }

    const parsedData = readResult.data;
    logger.debug('KV read operation successful', { requestId, testKey });

    // Test KV delete using DAL
    const deleteResult = await dal.deleteKey(testKey);
    if (!deleteResult.success) {
      logger.warn('KV delete may have failed', { requestId, testKey, error: deleteResult.error });
    }
    logger.debug('KV delete operation successful', { requestId, testKey });

    return new Response(JSON.stringify({
      success: true,
      message: 'KV write/read/delete test successful',
      test_key: testKey,
      written_data: testData,
      read_data: parsedData,
      kv_binding: 'available',
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('KV debug operation failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      kv_binding: typeof env.TRADING_RESULTS !== 'undefined' ? 'available' : 'missing',
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV write test
 */
export async function handleKVWriteTest(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('KV write test requested', { requestId });

    const dal = createDAL(env);
    const testKey = `kv_write_test_${Date.now()}`;
    const testData = {
      test_type: 'write_operation',
      timestamp: new Date().toISOString(),
      data: 'KV write test data'
    };

    const writeResult = await dal.write(testKey, testData);
    if (!writeResult.success) {
      throw new Error(`KV write failed: ${writeResult.error}`);
    }

    logger.info('KV write test successful', { requestId, testKey });

    return new Response(JSON.stringify({
      success: true,
      operation: 'write',
      test_key: testKey,
      test_data: testData,
      next_step: `Use /kv-read-test?key=${testKey} to verify`,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('KV write test failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      operation: 'write',
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV read test
 */
export async function handleKVReadTest(request, env) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  try {
    if (!key) {
      logger.warn('KV read test requested without key parameter', { requestId });
      return new Response(JSON.stringify({
        success: false,
        operation: 'read',
        error: 'Key parameter is required',
        usage: '/kv-read-test?key=YOUR_KEY',
        request_id: requestId
      }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logger.info('KV read test requested', { requestId, key });

    const dal = createDAL(env);
    const result = await dal.read(key);
    const data = result.success && result.data ? JSON.stringify(result.data) : null;

    if (data) {
      const parsedData = JSON.parse(data);

      logger.info('KV read test successful', { requestId, key });

      return new Response(JSON.stringify({
        success: true,
        operation: 'read',
        key: key,
        data: parsedData,
        request_id: requestId,
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      logger.warn('KV read test - key not found', { requestId, key });

      return new Response(JSON.stringify({
        success: false,
        operation: 'read',
        error: 'Key not found in KV storage',
        key: key,
        request_id: requestId,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    logger.error('KV read test failed', {
      requestId,
      key,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      operation: 'read',
      error: error.message,
      key: key,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV get requests
 */
export async function handleKVGet(request, env) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  try {
    if (!key) {
      logger.warn('KV get requested without key parameter', { requestId });
      return new Response(JSON.stringify({
        success: false,
        error: 'Key parameter is required',
        usage: '/kv-get?key=analysis_2025-09-27',
        request_id: requestId
      }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logger.info('KV get requested', { requestId, key });

    const dal = createDAL(env);
    const result = await dal.read(key);

    if (result.success && result.data) {
      const parsedData = result.data;

      logger.info('KV get successful', {
        requestId,
        key
      });

      return new Response(JSON.stringify({
        success: true,
        key: key,
        data: parsedData,
        request_id: requestId,
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      logger.warn('KV get - key not found', { requestId, key });

      return new Response(JSON.stringify({
        success: false,
        error: 'Key not found in KV storage',
        key: key,
        request_id: requestId,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    logger.error('KV get failed', {
      requestId,
      key,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      key: key,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV Analysis Write Test
 * Writes test analysis data using KV Key Factory
 * IMPORTANT: Wait 60+ seconds after write before reading to account for KV eventual consistency
 */
export async function handleKVAnalysisWriteTest(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('KV Analysis Write Test requested', { requestId });

    const today = new Date().toISOString().split('T')[0];
    const analysisKey = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date: today });

    // Create test analysis data matching real structure
    const testAnalysisData = {
      test_mode: true,
      test_request_id: requestId,
      symbols_analyzed: ['AAPL', 'MSFT', 'GOOGL'],
      trading_signals: {
        AAPL: {
          symbol: 'AAPL',
          sentiment_layers: [{
            sentiment: 'bullish',
            confidence: 0.85,
            reasoning: 'Test: Strong technical indicators'
          }]
        },
        MSFT: {
          symbol: 'MSFT',
          sentiment_layers: [{
            sentiment: 'bearish',
            confidence: 0.72,
            reasoning: 'Test: Market correction expected'
          }]
        },
        GOOGL: {
          symbol: 'GOOGL',
          sentiment_layers: [{
            sentiment: 'bullish',
            confidence: 0.78,
            reasoning: 'Test: AI momentum continues'
          }]
        }
      },
      timestamp: new Date().toISOString(),
      data_source: 'kv_write_test'
    };

    logger.info('Writing test analysis to KV', {
      requestId,
      key: analysisKey
    });

    const dal = createDAL(env);

    // Write to KV using DAL with Key Factory TTL
    const writeResult = await dal.write(
      analysisKey,
      testAnalysisData,
      KeyHelpers.getKVOptions(KeyTypes.ANALYSIS)
    );

    if (!writeResult.success) {
      throw new Error(`KV write failed: ${writeResult.error}`);
    }

    logger.info('Test analysis written to KV successfully', {
      requestId,
      key: analysisKey
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Test analysis data written to KV. WAIT 60+ seconds before reading due to KV eventual consistency.',
      kv_key: analysisKey,
      ttl_seconds: 604800, // 7 days from KeyTypes.ANALYSIS
      test_data: testAnalysisData,
      next_steps: [
        '1. Wait 60-90 seconds for KV eventual consistency',
        `2. Read data: GET /results`,
        `3. Or use: GET /kv-get?key=${analysisKey}`
      ],
      request_id: requestId,
      write_timestamp: new Date().toISOString()
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('KV Analysis Write Test failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV Analysis Read Test
 * Reads analysis data to verify KV write (use after 60+ seconds)
 */
export async function handleKVAnalysisReadTest(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('KV Analysis Read Test requested', { requestId });

    const today = new Date().toISOString().split('T')[0];
    const analysisKey = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date: today });

    logger.info('Reading from KV', { requestId, key: analysisKey });

    const dal = createDAL(env);
    const result = await dal.read(analysisKey);

    if (result.success && result.data) {
      const parsedData = result.data;

      logger.info('KV read successful', {
        requestId,
        key: analysisKey,
        isTestData: parsedData.test_mode === true
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Data retrieved from KV successfully',
        kv_key: analysisKey,
        data: parsedData,
        data_size_bytes: data.length,
        is_test_data: parsedData.test_mode === true,
        request_id: requestId,
        read_timestamp: new Date().toISOString()
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      logger.warn('No data found in KV', { requestId, key: analysisKey });

      return new Response(JSON.stringify({
        success: false,
        message: 'No data found. Either: (1) KV write not done yet, (2) Wait longer for eventual consistency (60-90s), or (3) Data expired',
        kv_key: analysisKey,
        request_id: requestId,
        read_timestamp: new Date().toISOString()
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    logger.error('KV Analysis Read Test failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}