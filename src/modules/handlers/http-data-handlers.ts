/**
 * HTTP Data Handlers
 * HTTP request handlers for data retrieval, storage, and KV operations
 * Note: This is the HTTP/presentation layer - uses DAL for actual storage operations
 */

import { getFactTableData, getCronHealthStatus } from '../data.js';
import { createLogger } from '../logging.js';
import { KVKeyFactory, KeyTypes, KeyHelpers } from '../kv-key-factory.js';
import { createDAL } from '../dal.js';
import type { CloudflareEnvironment } from '../../../types.js';

const logger = createLogger('http-data-handlers');

/**
 * Handle get results requests
 */
export async function handleGetResults(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
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
        error: 'No analysis results found for today',
        analysisKey,
        suggestion: 'Run /analyze to generate results',
        requestId
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    logger.error('Error retrieving results', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to retrieve results',
      message: error.message,
      requestId
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle fact table requests
 */
export async function handleFactTable(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Fact table request received', { requestId });

    const factTableData = await getFactTableData(env);

    logger.info('Fact table data retrieved', {
      requestId,
      recordCount: factTableData.length
    });

    return new Response(JSON.stringify({
      success: true,
      data: factTableData,
      count: factTableData.length,
      requestId
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    logger.error('Error retrieving fact table', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to retrieve fact table',
      message: error.message,
      requestId
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle cron health status requests
 */
export async function handleCronHealth(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Cron health request received', { requestId });

    const healthData = await getCronHealthStatus(env);

    logger.info('Cron health data retrieved', {
      requestId,
      jobsCount: Object.keys(healthData.jobs || {}).length
    });

    return new Response(JSON.stringify({
      success: true,
      data: healthData,
      requestId
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    logger.error('Error retrieving cron health', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to retrieve cron health status',
      message: error.message,
      requestId
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV debug requests for testing and diagnostics
 */
export async function handleKVDebug(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    logger.info('KV debug request received', { requestId });

    const dal = createDAL(env);

    // Test KV operations
    const testKey = `debug_test_${Date.now()}`;
    const testValue = {
      requestId,
      timestamp: new Date().toISOString(),
      message: 'KV debug test'
    };

    // Test write
    const writeResult = await dal.write(testKey, testValue, { expirationTtl: 300 });

    // Test read
    const readResult = await dal.read(testKey);

    // Test delete
    const deleteResult = await dal.deleteKey(testKey);

    const debugInfo = {
      success: true,
      requestId,
      kv_binding: !!env.TRADING_RESULTS,
      operations: {
        write: writeResult.success,
        read: readResult.success,
        delete: deleteResult.success
      },
      test_key: testKey,
      test_value: testValue,
      write_timestamp: writeResult.timestamp,
      read_timestamp: readResult.timestamp,
      delete_timestamp: deleteResult.timestamp
    };

    logger.info('KV debug operations completed', {
      requestId,
      allOperationsSuccessful: writeResult.success && readResult.success && deleteResult.success
    });

    return new Response(JSON.stringify(debugInfo, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    logger.error('Error in KV debug operations', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'KV debug operations failed',
      message: error.message,
      requestId
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV write test requests
 */
export async function handleKVWriteTest(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    logger.info('KV write test request received', { requestId });

    const dal = createDAL(env);

    // Test data
    const testData = {
      requestId,
      operation: 'kv_write_test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test write operation',
        randomValue: Math.random(),
        nested: {
          level1: {
            level2: 'deeply nested value'
          }
        }
      }
    };

    // Use KVKeyFactory for proper key generation
    const testKey = KVKeyFactory.generateKey(KeyTypes.SYSTEM_METADATA, {
      component: 'kv_write_test',
      requestId
    });

    // Write test data
    const writeResult = await dal.write(testKey, testData, { expirationTtl: 3600 });

    logger.info('KV write test completed', {
      requestId,
      testKey,
      writeSuccess: writeResult.success,
      writeTimestamp: writeResult.timestamp
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'KV write test completed successfully',
      requestId,
      testKey,
      writeResult: {
        success: writeResult.success,
        timestamp: writeResult.timestamp
      },
      testData
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    logger.error('Error in KV write test', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'KV write test failed',
      message: error.message,
      requestId
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV read test requests
 */
export async function handleKVReadTest(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    logger.info('KV read test request received', { requestId });

    const dal = createDAL(env);
    const url = new URL(request.url);
    const testKey = url.searchParams.get('key');

    if (!testKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameter: key',
        requestId
      }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Read test data
    const readResult = await dal.read(testKey);

    logger.info('KV read test completed', {
      requestId,
      testKey,
      readSuccess: readResult.success,
      hasData: !!readResult.data
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'KV read test completed',
      requestId,
      testKey,
      readResult: {
        success: readResult.success,
        hasData: !!readResult.data,
        data: readResult.data,
        timestamp: readResult.timestamp
      }
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    logger.error('Error in KV read test', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'KV read test failed',
      message: error.message,
      requestId
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV get requests for specific keys
 */
export async function handleKVGet(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    logger.info('KV get request received', { requestId });

    const dal = createDAL(env);
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (!key) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameter: key',
        requestId,
        usage: '?key=<your-key-name>'
      }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get value
    const getResult = await dal.read(key);

    if (getResult.success && getResult.data) {
      logger.info('KV get successful', {
        requestId,
        key,
        hasData: true
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Value retrieved successfully',
        requestId,
        key,
        data: getResult.data,
        timestamp: getResult.timestamp
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      logger.warn('KV get - key not found', {
        requestId,
        key
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Key not found',
        message: `The key '${key}' does not exist in KV storage`,
        requestId,
        key
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    logger.error('Error in KV get', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'KV get operation failed',
      message: error.message,
      requestId
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV analysis write test requests
 */
export async function handleKVAnalysisWriteTest(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    logger.info('KV analysis write test request received', { requestId });

    const dal = createDAL(env);

    // Test analysis data
    const testAnalysisData = {
      requestId,
      operation: 'analysis_write_test',
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      analysis_type: 'test_analysis',
      symbols_analyzed: ['AAPL', 'MSFT', 'GOOGL'],
      results: {
        total_signals: 3,
        successful_predictions: 2,
        accuracy: 0.67,
        confidence_level: 0.85
      },
      metadata: {
        test_mode: true,
        generated_by: 'kv_analysis_write_test'
      }
    };

    // Generate proper analysis key
    const analysisKey = KVKeyFactory.generateKey(KeyTypes.ANALYSIS_RESULT, {
      date: testAnalysisData.date,
      type: 'test'
    });

    // Write analysis data
    const writeResult = await dal.write(analysisKey, testAnalysisData, {
      expirationTtl: KeyHelpers.getExpirationTtl(KeyTypes.ANALYSIS_RESULT)
    });

    logger.info('KV analysis write test completed', {
      requestId,
      analysisKey,
      writeSuccess: writeResult.success,
      writeTimestamp: writeResult.timestamp
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'KV analysis write test completed successfully',
      requestId,
      analysisKey,
      writeResult: {
        success: writeResult.success,
        timestamp: writeResult.timestamp
      },
      testData: testAnalysisData
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    logger.error('Error in KV analysis write test', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'KV analysis write test failed',
      message: error.message,
      requestId
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV analysis read test requests
 */
export async function handleKVAnalysisReadTest(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    logger.info('KV analysis read test request received', { requestId });

    const dal = createDAL(env);
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Generate proper analysis key
    const analysisKey = KVKeyFactory.generateKey(KeyTypes.ANALYSIS_RESULT, {
      date,
      type: 'test'
    });

    // Read analysis data
    const readResult = await dal.read(analysisKey);

    if (readResult.success && readResult.data) {
      logger.info('KV analysis read test successful', {
        requestId,
        analysisKey,
        hasData: true
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Analysis data retrieved successfully',
        requestId,
        analysisKey,
        date,
        data: readResult.data,
        timestamp: readResult.timestamp
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      logger.warn('KV analysis read test - no data found', {
        requestId,
        analysisKey,
        date
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Analysis data not found',
        message: `No analysis data found for date: ${date}`,
        requestId,
        analysisKey,
        date,
        suggestion: 'Run the analysis write test first'
      }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    logger.error('Error in KV analysis read test', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'KV analysis read test failed',
      message: error.message,
      requestId
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}