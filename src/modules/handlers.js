/**
 * HTTP Request Handlers Module
 * Fully modular handlers without dependencies on monolithic worker
 */

import { runBasicAnalysis, runWeeklyMarketCloseAnalysis } from './analysis.js';
import { getHealthCheckResponse, sendFridayWeekendReportWithTracking, sendWeeklyAccuracyReportWithTracking } from './facebook.js';
import { getFactTableData } from './data.js';
import { runTFTInference, runNHITSInference } from './models.js';

/**
 * Handle manual analysis requests
 */
export async function handleManualAnalysis(request, env) {
  try {
    console.log('🔍 Manual analysis requested');
    
    const analysis = await runBasicAnalysis(env, { triggerMode: 'manual_analysis' });
    
    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Manual analysis error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle get results requests
 */
export async function handleGetResults(request, env) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    // Try to get stored results from KV
    const resultKey = `analysis_${date}`;
    const storedResult = await env.TRADING_RESULTS.get(resultKey);
    
    if (storedResult) {
      return new Response(storedResult, {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Return empty result if not found
    return new Response(JSON.stringify({
      date: date,
      symbols_analyzed: [],
      trading_signals: {},
      message: 'No analysis found for this date'
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Get results error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle health check requests
 */
export async function handleHealthCheck(request, env) {
  const healthData = getHealthCheckResponse(env);
  
  return new Response(JSON.stringify(healthData, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle Facebook test requests
 */
export async function handleFacebookTest(request, env) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Facebook not configured',
      debug: {
        token_present: !!env.FACEBOOK_PAGE_TOKEN,
        recipient_present: !!env.FACEBOOK_RECIPIENT_ID
      }
    }, null, 2), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const testMessage = `🧪 **TEST MESSAGE**\\n\\n📊 TFT Trading System Health Check\\n🕒 ${new Date().toLocaleString()}\\n\\n📊 **NEW**: Weekly Analysis Dashboard\\n🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\\n\\n✅ System operational and modular!`;
    
    const facebookPayload = {
      recipient: { id: env.FACEBOOK_RECIPIENT_ID },
      message: { text: testMessage },
      messaging_type: "MESSAGE_TAG",
      tag: "ACCOUNT_UPDATE"
    };

    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${env.FACEBOOK_PAGE_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facebookPayload)
    });

    if (response.ok) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Test message sent successfully with dashboard link!',
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      const errorText = await response.text();
      return new Response(JSON.stringify({
        success: false,
        error: 'Facebook API error',
        details: errorText
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
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
  try {
    const cronId = `manual_weekly_${Date.now()}`;
    await sendWeeklyAccuracyReportWithTracking(env, cronId);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Weekly report sent with dashboard link!',
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle Friday market close report
 */
export async function handleFridayMarketCloseReport(request, env) {
  try {
    if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Facebook not configured'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const analysis = await runWeeklyMarketCloseAnalysis(env, new Date());
    const cronId = `manual_friday_${Date.now()}`;
    
    await sendFridayWeekendReportWithTracking(analysis, env, cronId, 'weekly_market_close_analysis');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Friday market close report sent with dashboard link!',
      symbols_analyzed: analysis.symbols_analyzed?.length || 0,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle other endpoints with simple responses
 */
export async function handleFridayMondayPredictionsReport(request, env) {
  return new Response(JSON.stringify({ message: 'Monday predictions feature coming soon' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleHighConfidenceTest(request, env) {
  return new Response(JSON.stringify({ message: 'High confidence test feature coming soon' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleFactTable(request, env) {
  try {
    const factTableData = await getFactTableData(env);
    
    return new Response(JSON.stringify({
      success: true,
      data: factTableData,
      count: factTableData.length,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleKVCleanup(request, env) {
  return new Response(JSON.stringify({ message: 'KV cleanup feature coming soon' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleDebugWeekendMessage(request, env) {
  return new Response(JSON.stringify({ message: 'Debug weekend message feature coming soon' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleKVGet(request, env) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    
    if (!key) {
      return new Response(JSON.stringify({
        error: 'Missing key parameter',
        usage: 'GET /kv-get?key=YOUR_KEY_NAME'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const value = await env.TRADING_RESULTS.get(key);
    
    if (value === null) {
      return new Response(JSON.stringify({
        key: key,
        found: false,
        message: 'Key not found in KV store'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    let parsedValue;
    try {
      parsedValue = JSON.parse(value);
    } catch (e) {
      parsedValue = value;
    }
    
    return new Response(JSON.stringify({
      key: key,
      found: true,
      value: parsedValue,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}