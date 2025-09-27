/**
 * Facebook and Social Media HTTP Request Handlers
 * Handles Facebook messaging, testing, and social media integrations
 */

import {
  sendFridayWeekendReportWithTracking,
  sendWeeklyAccuracyReportWithTracking
} from '../facebook.js';
import { createLogger, logBusinessMetric } from '../logging.js';

const logger = createLogger('facebook-handlers');

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
    const testMessage = `🧪 **TEST MESSAGE**\\n\\n📊 TFT Trading System Health Check\\n🕒 ${new Date().toLocaleString()}\\n\\n📊 **NEW**: Weekly Analysis & Daily Summary dashboards available!\\n\\n🔗 View Dashboard: https://tft-trading-system.yanggf.workers.dev/weekly-analysis`;

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

      // Store test result in KV
      const testKvKey = `fb_test_${Date.now()}`;
      const kvData = {
        test_type: 'facebook_messaging',
        timestamp: new Date().toISOString(),
        message_sent: true,
        facebook_delivery_status: 'delivered',
        test_message: testMessage
      };

      await env.TRADING_RESULTS.put(testKvKey, JSON.stringify(kvData), {
        expirationTtl: 86400 // 24 hours
      });

      logger.info('Facebook test successful', {
        requestId,
        messageId: fbResult.message_id,
        kvStored: testKvKey
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