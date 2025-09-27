/**
 * Data and KV-related HTTP Request Handlers
 * Handles data retrieval, storage, and KV operations
 */

import { getFactTableData, getCronHealthStatus } from '../data.js';
import { createLogger } from '../logging.js';

const logger = createLogger('data-handlers');

/**
 * Handle get results requests
 */
export async function handleGetResults(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Results request received', { requestId });

    // Try to get the latest analysis from KV storage
    const today = new Date().toISOString().split('T')[0];
    const analysisKey = `analysis_${today}`;

    const storedData = await env.TRADING_RESULTS.get(analysisKey);

    if (storedData) {
      const parsedData = JSON.parse(storedData);

      logger.info('Results retrieved from KV storage', {
        requestId,
        analysisKey,
        symbolsFound: parsedData.symbols_analyzed?.length || 0,
        dataSize: storedData.length
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

    const testKey = `test_kv_${Date.now()}`;
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      data: 'KV write test successful'
    };

    // Test KV write
    await env.TRADING_RESULTS.put(testKey, JSON.stringify(testData));
    logger.debug('KV write operation successful', { requestId, testKey });

    // Test KV read
    const retrievedData = await env.TRADING_RESULTS.get(testKey);
    if (!retrievedData) {
      throw new Error('KV read operation failed - data not found');
    }

    const parsedData = JSON.parse(retrievedData);
    logger.debug('KV read operation successful', { requestId, testKey });

    // Test KV delete
    await env.TRADING_RESULTS.delete(testKey);
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

    const testKey = `kv_write_test_${Date.now()}`;
    const testData = {
      test_type: 'write_operation',
      timestamp: new Date().toISOString(),
      data: 'KV write test data'
    };

    await env.TRADING_RESULTS.put(testKey, JSON.stringify(testData));

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

    const data = await env.TRADING_RESULTS.get(key);

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

    const data = await env.TRADING_RESULTS.get(key);

    if (data) {
      const parsedData = JSON.parse(data);

      logger.info('KV get successful', {
        requestId,
        key,
        dataSize: data.length
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