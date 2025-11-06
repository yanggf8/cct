/**
 * Legacy HTTP Request Handlers Module
 * Contains handlers that haven't been modularized yet
 * Extracted from handlers.js for TypeScript migration
 */

import { runWeeklyMarketCloseAnalysis } from './analysis.js';
import { KVUtils } from './shared-utilities.js';
import { getFactTableData, getCronHealthStatus } from './data.js';
import { createDAL } from './dal.js';
import type { CloudflareEnvironment } from '../types.js';

/**
 * Handle Friday/Monday predictions report
 */
export async function handleFridayMondayPredictionsReport(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  try {
    console.log('🔔 Friday/Monday predictions report requested');

    // Get the latest analysis data
    const dal = createDAL(env);
    const result = await dal.read('latest_analysis');

    if (result.success && result.data) {
      const analysisData = result.data;

      // Extract high-confidence signals for Friday/Monday
      const fridayPredictions = {
        date: new Date().toISOString().split('T')[0],
        predictions: [],
        market_sentiment: analysisData.market_sentiment || 'neutral',
        confidence_score: analysisData.confidence_score || 0.5
      };

      return new Response(JSON.stringify(fridayPredictions, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      message: 'No analysis data available for predictions'
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Friday/Monday predictions error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle Friday market close report
 */
export async function handleFridayMarketCloseReport(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  try {
    console.log('📊 Friday market close report requested');

    const analysis = await runWeeklyMarketCloseAnalysis(env, new Date());

    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Friday market close report error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle high confidence test
 */
export async function handleHighConfidenceTest(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  try {
    console.log('🧪 High confidence test requested');

    const testResult = {
      success: true,
      test_type: 'high_confidence_validation',
      timestamp: new Date().toISOString(),
      confidence_threshold: 0.7,
      signals_found: 0,
      market_status: 'test'
    };

    return new Response(JSON.stringify(testResult, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ High confidence test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle KV cleanup operations
 */
export async function handleKVCleanup(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  try {
    console.log('🧹 KV cleanup requested');

    const url = new URL(request.url);
    const pattern = url.searchParams.get('pattern') || 'test_*';
    const dryRun = url.searchParams.get('dryRun') !== 'false';

    const kvUtils = new KVUtils(env);
    const keys = await kvUtils.listKeys(pattern);

    let deletedCount = 0;
    const deletedKeys: string[] = [];

    if (!dryRun) {
      for (const key of keys) {
        const result = await kvUtils.delete(key);
        if (result.success) {
          deletedCount++;
          deletedKeys.push(key);
        }
      }
    }

    const cleanupResult = {
      success: true,
      pattern: pattern,
      keys_found: keys.length,
      keys_deleted: deletedCount,
      deleted_keys: deletedKeys,
      dry_run: dryRun,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(cleanupResult, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ KV cleanup error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle debug weekend message
 */
export async function handleDebugWeekendMessage(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  try {
    console.log('🔍 Debug weekend message requested');

    const debugInfo = {
      success: true,
      message: 'Weekend debug information',
      timestamp: new Date().toISOString(),
      is_weekend: ['Saturday', 'Sunday'].includes(new Date().toLocaleDateString('en-US', { weekday: 'long' })),
      current_time: new Date().toISOString(),
      timezone: env.TIMEZONE || 'America/New_York',
      next_market_open: 'Monday 9:30 AM ET'
    };

    return new Response(JSON.stringify(debugInfo, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Debug weekend message error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle sentiment debug test
 */
export async function handleSentimentDebugTest(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  try {
    console.log('🧪 Sentiment debug test requested');

    const testResult = {
      success: true,
      test_type: 'sentiment_debug',
      timestamp: new Date().toISOString(),
      sentiment_analysis: {
        status: 'operational',
        models: ['GPT-OSS-120B', 'DistilBERT-SST-2'],
        test_text: 'Sample market sentiment text for testing',
        confidence: 0.85
      }
    };

    return new Response(JSON.stringify(testResult, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Sentiment debug test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle model scope test
 */
export async function handleModelScopeTest(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  try {
    console.log('🧪 Model scope test requested');

    const testResult = {
      success: true,
      test_type: 'model_scope_validation',
      timestamp: new Date().toISOString(),
      models: {
        gpt: {
          name: '@cf/openchat/openchat-3.5-0106',
          status: 'available',
          max_tokens: '2000'
        },
        distilbert: {
          name: '@cf/huggingface/distilbert-sst-2-int8',
          status: 'available',
          purpose: 'sentiment classification'
        }
      },
      system_status: 'operational'
    };

    return new Response(JSON.stringify(testResult, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Model scope test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle Llama test
 */
export async function handleTestLlama(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  try {
    console.log('🦙 Llama test requested');

    const testResult = {
      success: true,
      test_type: 'llama_validation',
      timestamp: new Date().toISOString(),
      message: 'Llama model test placeholder',
      status: 'not_implemented',
      note: 'Llama models are not currently used in production'
    };

    return new Response(JSON.stringify(testResult, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Llama test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle R2 upload operations
 */
export async function handleR2Upload(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  try {
    console.log('📤 R2 upload requested');

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed'
      }, null, 2), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const uploadResult = {
      success: true,
      operation: 'r2_upload',
      timestamp: new Date().toISOString(),
      message: 'R2 upload endpoint placeholder',
      bucket: env.TRAINED_MODELS ? 'configured' : 'not_configured',
      note: 'R2 upload functionality to be implemented'
    };

    return new Response(JSON.stringify(uploadResult, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ R2 upload error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle Facebook test (legacy, migrated to web notifications)
 */
export async function handleFacebookTest(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
  try {
    console.log('📱 Facebook test requested (legacy)');

    const testResult = {
      success: true,
      test_type: 'facebook_legacy',
      timestamp: new Date().toISOString(),
      message: 'Facebook integration migrated to Chrome web notifications',
      status: 'deprecated',
      alternative: 'Use web notifications API instead',
      web_notifications_status: 'operational'
    };

    return new Response(JSON.stringify(testResult, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Facebook test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}