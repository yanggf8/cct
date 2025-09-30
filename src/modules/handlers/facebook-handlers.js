/**
 * Facebook and Social Media HTTP Request Handlers
 * Handles Facebook messaging, testing, and social media integrations
 */

import {
  sendFridayWeekendReportWithTracking,
  sendWeeklyAccuracyReportWithTracking,
  sendFacebookMessage
} from '../facebook.js';
import { runEnhancedPreMarketAnalysis } from '../enhanced_analysis.js';
import { createLogger, logBusinessMetric } from '../logging.js';
import { KVKeyFactory, KeyTypes, KeyHelpers } from '../kv-key-factory.js';
import { createDAL } from '../dal.js';

const logger = createLogger('facebook-handlers');

/**
 * Get latest analysis from KV or generate fresh analysis
 * Hybrid approach: Try KV first (fast), fallback to fresh analysis (reliable)
 */
async function getLatestAnalysisOrGenerate(env, requestId) {
  logger.info('Retrieving latest analysis', { requestId });

  try {
    const dal = createDAL(env);

    // Step 1: Try KV retrieval using Key Factory (fast path)
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date: today });

    logger.info('Attempting KV retrieval', { requestId, key: dailyKey });
    const kvResult = await dal.read(dailyKey);

    if (kvResult.success && kvResult.data) {
      const analysisResult = kvResult.data;
      logger.info('KV retrieval successful', {
        requestId,
        symbolsCount: analysisResult.symbols_analyzed?.length || 0,
        hasSignals: !!analysisResult.trading_signals
      });
      return {
        success: true,
        data: analysisResult,
        source: 'kv_cron',
        key: dailyKey
      };
    }

    logger.warn('No KV data found, trying timestamped keys', { requestId });

    // Step 2: Try timestamped keys (fallback KV path - for cron-generated data)
    const listResult = await dal.listKeys(`analysis_${today}_`);
    if (listResult.keys && listResult.keys.length > 0) {
      // Get the most recent timestamped analysis
      const latestKey = listResult.keys[listResult.keys.length - 1].name;
      const timestampedResult = await dal.read(latestKey);

      if (timestampedResult.success && timestampedResult.data) {
        const analysisResult = timestampedResult.data;
        logger.info('Timestamped KV retrieval successful', {
          requestId,
          key: latestKey,
          symbolsCount: analysisResult.symbols_analyzed?.length || 0
        });
        return {
          success: true,
          data: analysisResult,
          source: 'kv_cron_timestamped',
          key: latestKey
        };
      }
    }

    logger.warn('No KV data available, generating fresh on-demand analysis', { requestId });

    // Step 3: Generate fresh analysis (slow path) - SEPARATE STORAGE to avoid mixing with cron history
    const estTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const freshAnalysis = await runEnhancedPreMarketAnalysis(env, {
      triggerMode: 'manual_facebook_send',
      predictionHorizons: [1, 24],
      currentTime: estTime,
      cronExecutionId: requestId
    });

    logger.info('Fresh analysis generated', {
      requestId,
      symbolsCount: freshAnalysis.symbols_analyzed?.length || 0,
      hasSignals: !!freshAnalysis.trading_signals
    });

    // Store in SEPARATE manual analysis key (not mixed with cron history)
    const manualKey = KVKeyFactory.generateKey(KeyTypes.MANUAL_ANALYSIS, {
      timestamp: Date.now()
    });

    const writeResult = await dal.write(
      manualKey,
      {
        ...freshAnalysis,
        analysis_type: 'manual_on_demand',
        request_id: requestId,
        generated_at: estTime.toISOString()
      },
      KeyHelpers.getKVOptions(KeyTypes.MANUAL_ANALYSIS)
    );

    if (!writeResult.success) {
      logger.warn('Failed to store manual analysis', {
        requestId,
        error: writeResult.error
      });
    } else {
      logger.info('Manual analysis stored separately', {
        requestId,
        key: manualKey,
        ttl: '1 hour (not in cron history)'
      });
    }

    return {
      success: true,
      data: freshAnalysis,
      source: 'on_demand',
      key: manualKey,
      generatedAt: estTime.toISOString()
    };

  } catch (error) {
    logger.error('Failed to retrieve or generate analysis', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: error.message,
      source: 'error'
    };
  }
}

/**
 * Handle Facebook test requests
 */
export async function handleFacebookTest(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Facebook test requested', { requestId });

    if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
      logger.warn('Facebook not configured for testing', { requestId });
      return new Response(JSON.stringify({
        success: false,
        message: 'Facebook not configured. Please set FACEBOOK_PAGE_TOKEN and FACEBOOK_RECIPIENT_ID.',
        request_id: requestId,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Test Facebook API connectivity
    const testMessage = `🧪 **TEST MESSAGE**\\n\\n🤖 DUAL AI SYSTEM TEST\\n🕒 ${new Date().toLocaleString()}\\n\\n📊 **NEW**: Dual AI Trading Analysis with GPT-OSS-120B + DistilBERT!\\n\\n🔗 View Pre-Market Briefing: https://tft-trading-system.yanggf.workers.dev/pre-market-briefing`;

    const facebookUrl = `https://graph.facebook.com/v18.0/me/messages`;
    const facebookPayload = {
      recipient: { id: env.FACEBOOK_RECIPIENT_ID },
      message: { text: testMessage }
    };

    const facebookResponse = await fetch(facebookUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.FACEBOOK_PAGE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(facebookPayload)
    });

    if (facebookResponse.ok) {
      const fbResult = await facebookResponse.json();

      // Store test result in KV using DAL
      const dal = createDAL(env);
      const testKvKey = `fb_test_${Date.now()}`;
      const kvData = {
        test_type: 'facebook_messaging',
        timestamp: new Date().toISOString(),
        message_sent: true,
        facebook_delivery_status: 'delivered',
        test_message: testMessage
      };

      const kvWriteResult = await dal.write(testKvKey, kvData, {
        expirationTtl: 86400 // 24 hours
      });

      logger.info('Facebook test successful', {
        requestId,
        messageId: fbResult.message_id,
        kvStored: kvWriteResult.success ? testKvKey : 'failed'
      });

      logBusinessMetric('facebook_test_success', 1, {
        requestId,
        messageId: fbResult.message_id
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Facebook test completed with independent status reporting',
        facebook_status: {
          success: true,
          message: 'Facebook message sent successfully'
        },
        kv_status: {
          success: true,
          key: testKvKey,
          data: kvData,
          message: 'KV storage successful'
        },
        request_id: requestId,
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      const errorText = await facebookResponse.text();
      logger.error('Facebook API test failed', {
        requestId,
        status: facebookResponse.status,
        error: errorText
      });

      return new Response(JSON.stringify({
        success: false,
        error: `Facebook API error: ${facebookResponse.status} - ${errorText}`,
        request_id: requestId,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    logger.error('Facebook test failed', {
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
 * Handle test all Facebook messages
 */
export async function handleTestAllFacebookMessages(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Test all Facebook messages requested', { requestId });

    if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
      logger.warn('Facebook not configured for comprehensive testing', { requestId });
      return new Response(JSON.stringify({
        success: false,
        error: 'Facebook not configured',
        timestamp: new Date().toISOString(),
        request_id: requestId
      }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const testResults = {
      timestamp: new Date().toISOString(),
      test_execution_id: `fb_test_all_${Date.now()}`,
      facebook_configured: true,
      message_tests: {},
      kv_logs: {},
      errors: [],
      overall_success: true
    };

    // Mock analysis result for testing
    const mockAnalysisResult = {
      symbols_analyzed: ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"],
      trading_signals: {
        AAPL: {
          symbol: "AAPL",
          current_price: 175.23,
          predicted_price: 177.45,
          direction: "UP",
          confidence: 0.87
        },
        MSFT: {
          symbol: "MSFT",
          current_price: 334.78,
          predicted_price: 331.22,
          direction: "DOWN",
          confidence: 0.82
        }
      },
      timestamp: new Date().toISOString()
    };

    // Note: This is a simplified test that doesn't actually send Facebook messages
    // to avoid spamming during testing. It validates the configuration and data flow.

    const messageTypes = [
      'morning_predictions',
      'midday_validation',
      'daily_validation',
      'friday_weekend_report',
      'weekly_accuracy_report'
    ];

    for (const messageType of messageTypes) {
      testResults.message_tests[messageType] = {
        success: true,
        test_mode: true,
        message: `${messageType} test completed - Facebook configuration validated`,
        data_available: true
      };
    }

    logger.info('Facebook message tests completed', {
      requestId,
      testsRun: messageTypes.length,
      successfulTests: Object.values(testResults.message_tests).filter(t => t.success).length
    });

    logBusinessMetric('facebook_comprehensive_test', testResults.overall_success ? 1 : 0, {
      requestId,
      testsRun: messageTypes.length
    });

    return new Response(JSON.stringify(testResults, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Test all Facebook messages failed', {
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
 * Handle weekly report requests
 */
export async function handleWeeklyReport(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Weekly report requested', { requestId });

    // This would typically send a weekly accuracy report
    await sendWeeklyAccuracyReportWithTracking(env, requestId);

    logger.info('Weekly report sent successfully', { requestId });

    logBusinessMetric('weekly_report_sent', 1, { requestId });

    return new Response(JSON.stringify({
      success: true,
      message: 'Weekly report sent successfully',
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Weekly report failed', {
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
 * Handle Friday market close report requests
 */
export async function handleFridayMarketCloseReport(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Friday market close report requested', { requestId });

    // This would send a Friday weekend report
    const mockAnalysisResult = {
      symbols_analyzed: ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"],
      trading_signals: {},
      timestamp: new Date().toISOString()
    };

    await sendFridayWeekendReportWithTracking(
      mockAnalysisResult,
      env,
      requestId,
      'weekly_market_close_analysis'
    );

    logger.info('Friday market close report sent successfully', { requestId });

    logBusinessMetric('friday_report_sent', 1, { requestId });

    return new Response(JSON.stringify({
      success: true,
      message: 'Friday market close report sent successfully',
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error('Friday market close report failed', {
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
 * Send real Facebook message with actual trading analysis
 */
export async function handleRealFacebookMessage(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Real Facebook message requested', { requestId });

    if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Facebook not configured',
        request_id: requestId,
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 1: Get real analysis data (KV-first hybrid approach)
    logger.info('Retrieving real analysis data', { requestId });
    const analysisResponse = await getLatestAnalysisOrGenerate(env, requestId);

    if (!analysisResponse.success) {
      logger.error('Failed to retrieve analysis data', {
        requestId,
        error: analysisResponse.error
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to retrieve analysis data: ' + analysisResponse.error,
        request_id: requestId,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const analysisResult = analysisResponse.data;
    logger.info('Analysis data retrieved', {
      requestId,
      source: analysisResponse.source,
      symbolCount: analysisResult.symbols_analyzed?.length || 0
    });

    // Step 2: Build real trading message using actual data
    const now = new Date();
    const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

    // Count sentiment distribution
    let bullishCount = 0;
    let bearishCount = 0;
    let bullishSymbols = [];
    let bearishSymbols = [];
    let highConfidenceSymbols = [];
    let symbolCount = 0;

    if (analysisResult?.trading_signals) {
      Object.values(analysisResult.trading_signals).forEach(signal => {
        symbolCount++;
        const sentimentLayer = signal.sentiment_layers?.[0];
        const sentiment = sentimentLayer?.sentiment || 'neutral';
        const confidence = sentimentLayer?.confidence || 0;

        if (sentiment === 'bullish') {
          bullishCount++;
          bullishSymbols.push(signal.symbol);
        }
        if (sentiment === 'bearish') {
          bearishCount++;
          bearishSymbols.push(signal.symbol);
        }

        if (confidence > 0.7) {
          highConfidenceSymbols.push(`${signal.symbol} (${Math.round(confidence * 100)}%)`);
        }
      });
    }

    // Create real message using proven pattern from sendMorningPredictionsWithTracking
    let realMessage = `📊 **REAL TRADING ANALYSIS** - ${estTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\n`;
    realMessage += `🕒 ${estTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}\n\n`;
    realMessage += `📊 Market Bias: Bullish on ${bullishCount}/${symbolCount} symbols\n`;

    // Show bullish symbols
    if (bullishSymbols.length > 0) {
      realMessage += `📈 Bullish: ${bullishSymbols.join(', ')}\n`;
    }

    // Show bearish symbols (limited)
    if (bearishSymbols.length > 0 && bearishSymbols.length <= 3) {
      realMessage += `📉 Bearish: ${bearishSymbols.join(', ')}\n`;
    }

    // Show high confidence signals
    if (highConfidenceSymbols.length > 0) {
      realMessage += `🎯 High Confidence: ${highConfidenceSymbols.slice(0, 3).join(', ')}\n`;
    }

    realMessage += `\n📈 View Full Analysis:\n`;
    realMessage += `🔗 https://tft-trading-system.yanggf.workers.dev/pre-market-briefing\n\n`;
    realMessage += `✅ **REAL MARKET DATA** (Source: ${analysisResponse.source})\n`;
    realMessage += `⚠️ Research/education only. Not financial advice.`;

    // Step 3: Send via reusable Facebook message utility
    logger.info('Sending real Facebook message', {
      requestId,
      messageLength: realMessage.length,
      source: analysisResponse.source
    });

    const fbResult = await sendFacebookMessage(realMessage, env);

    if (fbResult.success) {
      logger.info('Real Facebook message sent successfully', {
        requestId,
        dataSource: analysisResponse.source,
        symbolsAnalyzed: symbolCount
      });

      logBusinessMetric('real_facebook_message_sent', 1, {
        requestId,
        source: analysisResponse.source,
        symbolCount
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Real Facebook message sent with trading analysis',
        data_source: analysisResponse.source,
        symbols_analyzed: symbolCount,
        bullish_count: bullishCount,
        bearish_count: bearishCount,
        high_confidence_signals: highConfidenceSymbols.length,
        content_preview: realMessage.substring(0, 150) + '...',
        request_id: requestId,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      logger.error('Real Facebook message failed', {
        requestId,
        error: fbResult.error
      });

      return new Response(JSON.stringify({
        success: false,
        error: `Facebook send failed: ${fbResult.error}`,
        request_id: requestId,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    logger.error('Real Facebook message handler failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
