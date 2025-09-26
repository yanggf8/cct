/**
 * HTTP Request Handlers Module
 * Fully modular handlers without dependencies on monolithic worker
 */

import { runBasicAnalysis, runWeeklyMarketCloseAnalysis } from './analysis.js';
import { runEnhancedAnalysis, validateSentimentEnhancement } from './enhanced_analysis.js';
import { runEnhancedFeatureAnalysis } from './enhanced_feature_analysis.js';
import { runIndependentTechnicalAnalysis } from './independent_technical_analysis.js';
import { getHealthCheckResponse, sendFridayWeekendReportWithTracking, sendWeeklyAccuracyReportWithTracking } from './facebook.js';
import { getFactTableData } from './data.js';
import { runTFTInference, runNHITSInference } from './models.js';
import { analyzeSingleSymbol } from './per_symbol_analysis.js';

/**
 * Handle manual analysis requests (Phase 1: Enhanced with sentiment)
 */
export async function handleManualAnalysis(request, env) {
  try {
    console.log('🚀 Enhanced analysis requested (Neural Networks + Sentiment)');

    // Use enhanced analysis with sentiment integration
    const analysis = await runEnhancedAnalysis(env, { triggerMode: 'manual_analysis_enhanced' });

    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Enhanced analysis error, falling back to basic:', error);

    try {
      // Fallback to basic analysis if enhanced fails
      const basicAnalysis = await runBasicAnalysis(env, { triggerMode: 'manual_analysis_fallback' });
      basicAnalysis.fallback_reason = error.message;

      return new Response(JSON.stringify(basicAnalysis, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (fallbackError) {
      return new Response(JSON.stringify({
        success: false,
        error: fallbackError.message,
        original_error: error.message,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
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
 * Handle Enhanced Feature Analysis requests (Neural Networks + 33 Technical Indicators + Sentiment)
 */
export async function handleEnhancedFeatureAnalysis(request, env) {
  try {
    console.log('🔬 Enhanced Feature Analysis requested (Neural Networks + Technical Indicators + Sentiment)');

    // Get symbols from request or use centralized configuration
    let symbols = (env.TRADING_SYMBOLS || 'AAPL,MSFT,GOOGL,TSLA,NVDA').split(',').map(s => s.trim());
    
    if (request.method === 'POST') {
      try {
        const requestData = await request.json();
        if (requestData.symbols && Array.isArray(requestData.symbols)) {
          symbols = requestData.symbols;
        }
      } catch (error) {
        console.log('Using default symbols (JSON parse error)');
      }
    }

    // Run enhanced feature analysis
    const analysis = await runEnhancedFeatureAnalysis(symbols, env);

    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Enhanced Feature Analysis error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      fallback_available: true,
      message: 'Enhanced Feature Analysis failed. Use /analyze for basic neural network analysis.'
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle Independent Technical Analysis requests (33 Technical Indicators Only)
 */
export async function handleIndependentTechnicalAnalysis(request, env) {
  try {
    console.log('🔧 Independent Technical Analysis requested (33 Indicators Only - No Neural Networks)');

    // Get symbols from request or use centralized configuration
    let symbols = (env.TRADING_SYMBOLS || 'AAPL,MSFT,GOOGL,TSLA,NVDA').split(',').map(s => s.trim());
    
    if (request.method === 'POST') {
      try {
        const requestData = await request.json();
        if (requestData.symbols && Array.isArray(requestData.symbols)) {
          symbols = requestData.symbols;
        }
      } catch (error) {
        console.log('Using default symbols (JSON parse error)');
      }
    }

    // Run independent technical analysis (NO neural networks)
    const analysis = await runIndependentTechnicalAnalysis(symbols, env);

    return new Response(JSON.stringify(analysis, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Independent Technical Analysis error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      message: 'Independent Technical Analysis failed. This endpoint only uses technical indicators.'
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle Facebook test requests
 */
export async function handleFacebookTest(request, env) {
  console.log(`🧪 [FB-TEST] Starting Facebook test function`);

  // Check configuration
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log(`❌ [FB-TEST] Facebook configuration missing`);
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
  console.log(`✅ [FB-TEST] Facebook configuration verified`);

  // Check KV storage binding
  console.log(`🔍 [FB-TEST] Checking KV storage binding...`);
  if (!env.TRADING_RESULTS) {
    console.log(`❌ [FB-TEST] TRADING_RESULTS KV binding not available`);
    return new Response(JSON.stringify({
      success: false,
      error: 'KV storage not configured'
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  console.log(`✅ [FB-TEST] KV storage binding verified`);

  try {
    console.log(`📤 [FB-TEST] Preparing to send Facebook message with UPDATE tag...`);
    const testMessage = `🧪 **TEST MESSAGE**\\n\\n📊 TFT Trading System Health Check\\n🕒 ${new Date().toLocaleString()}\\n\\n📊 **NEW**: Weekly Analysis Dashboard\\n🔗 https://tft-trading-system.yanggf.workers.dev/weekly-analysis\\n\\n✅ System operational and modular!`;

    const facebookPayload = {
      recipient: { id: env.FACEBOOK_RECIPIENT_ID },
      message: { text: testMessage },
      messaging_type: "MESSAGE_TAG",
      tag: "CONFIRMED_EVENT_UPDATE"
    };

    console.log(`📤 [FB-TEST] Sending Facebook API request...`);
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${env.FACEBOOK_PAGE_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facebookPayload)
    });

    if (response.ok) {
      console.log(`✅ [FB-TEST] Facebook message sent successfully`);

      // Test KV storage
      console.log(`💾 [FB-TEST] Testing KV storage...`);
      const testKvKey = `fb_test_${Date.now()}`;
      const testKvData = {
        test_type: 'facebook_messaging',
        timestamp: new Date().toISOString(),
        message_sent: true,
        facebook_delivery_status: 'delivered',
        test_message: testMessage.substring(0, 100) + '...'
      };

      try {
        await env.TRADING_RESULTS.put(
          testKvKey,
          JSON.stringify(testKvData),
          { expirationTtl: 604800 }
        );
        console.log(`✅ [FB-TEST] KV storage test successful: ${testKvKey}`);

        // Verify KV storage by reading it back
        const storedData = await env.TRADING_RESULTS.get(testKvKey);
        let kvStatus = {
          success: false,
          key: testKvKey,
          message: 'KV verification failed'
        };

        if (storedData) {
          console.log(`✅ [FB-TEST] KV storage verification successful`);
          kvStatus = {
            success: true,
            key: testKvKey,
            data: JSON.parse(storedData),
            message: 'KV storage successful'
          };
        } else {
          console.log(`❌ [FB-TEST] KV storage verification failed - data not found`);
        }

        // Return independent status for both operations
        return new Response(JSON.stringify({
          success: true, // Overall operation successful
          message: 'Facebook test completed with independent status reporting',
          facebook_status: {
            success: true,
            message: 'Facebook message sent successfully'
          },
          kv_status: kvStatus,
          timestamp: new Date().toISOString()
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (kvError) {
        console.error(`❌ [FB-TEST] KV storage test failed:`, kvError);

        // Return independent status - Facebook worked, KV failed
        return new Response(JSON.stringify({
          success: true, // Overall operation completed (with partial failure)
          message: 'Facebook test completed - Facebook succeeded, KV failed',
          facebook_status: {
            success: true,
            message: 'Facebook message sent successfully'
          },
          kv_status: {
            success: false,
            error: kvError.message,
            error_details: {
              name: kvError.name,
              message: kvError.message,
              stack: kvError.stack
            },
            message: 'KV storage operation failed'
          },
          timestamp: new Date().toISOString()
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      const errorText = await response.text();
      console.error(`❌ [FB-TEST] Facebook API error:`, errorText);
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

/**
 * Handle KV debug - test KV writing functionality
 */
export async function handleKVDebug(request, env) {
  try {
    const testKey = `test_kv_${Date.now()}`;
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      data: "KV write test successful"
    };

    // Test KV write
    await env.TRADING_RESULTS.put(testKey, JSON.stringify(testData));

    // Test KV read back
    const readValue = await env.TRADING_RESULTS.get(testKey);
    const parsedValue = JSON.parse(readValue);

    // Clean up test key
    await env.TRADING_RESULTS.delete(testKey);

    return new Response(JSON.stringify({
      success: true,
      message: "KV write/read/delete test successful",
      test_key: testKey,
      written_data: testData,
      read_data: parsedValue,
      kv_binding: env.TRADING_RESULTS ? "available" : "not_available",
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
      kv_binding: env.TRADING_RESULTS ? "available" : "not_available",
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle sentiment enhancement testing (Phase 1 validation)
 */
export async function handleSentimentTest(request, env) {
  try {
    console.log('🧪 Testing sentiment enhancement...');

    const validationResult = await validateSentimentEnhancement(env);

    return new Response(JSON.stringify({
      success: true,
      sentiment_enhancement: validationResult,
      phase: 'Phase 1 - Free Integration',
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Sentiment test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      phase: 'Phase 1 - Free Integration',
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Test Cloudflare AI Llama models
 */
export async function handleTestLlama(request, env) {
  try {
    if (!env.AI) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cloudflare AI not available',
        ai_binding: !!env.AI
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const url = new URL(request.url);
    const model = url.searchParams.get('model') || '@cf/meta/llama-3.1-8b-instruct';

    console.log(`🦙 Testing Cloudflare AI model: ${model}`);

    const testPrompt = 'Analyze sentiment: Apple stock rises on strong iPhone sales. Is this bullish or bearish? Provide sentiment and confidence 0-1.';

    try {
      const response = await env.AI.run(model, {
        messages: [
          {
            role: 'user',
            content: testPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      });

      console.log(`✅ Llama model ${model} responded successfully`);

      return new Response(JSON.stringify({
        success: true,
        model_tested: model,
        prompt_used: testPrompt,
        response: response,
        response_type: typeof response,
        response_keys: Object.keys(response || {}),
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (modelError) {
      console.error(`❌ Model ${model} failed:`, modelError.message);

      return new Response(JSON.stringify({
        success: false,
        model_tested: model,
        error: modelError.message,
        error_type: modelError.name,
        suggestion: 'Try different model names like @cf/meta/llama-3-8b-instruct, @cf/meta/llama-2-7b-chat-int8',
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Llama test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack?.substring(0, 300)
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

/**
 * Debug environment variables and API keys
 */
export async function handleDebugEnvironment(request, env) {
  // Additional debugging - check multiple ways to access the secret
  const modelScopeKey = env.MODELSCOPE_API_KEY;
  const allEnvKeys = Object.keys(env);
  const secretKeys = allEnvKeys.filter(key => key.includes('MODELSCOPE') || key.includes('modelscope'));

  return new Response(JSON.stringify({
    timestamp: new Date().toISOString(),
    environment_debug: {
      modelscope_api_key: {
        available: !!env.MODELSCOPE_API_KEY,
        length: env.MODELSCOPE_API_KEY?.length || 0,
        first_10_chars: env.MODELSCOPE_API_KEY?.substring(0, 10) || 'null',
        typeof: typeof env.MODELSCOPE_API_KEY,
        direct_access: !!modelScopeKey,
        is_empty_string: env.MODELSCOPE_API_KEY === '',
        is_undefined: env.MODELSCOPE_API_KEY === undefined,
        is_null: env.MODELSCOPE_API_KEY === null,
        raw_value_debug: `"${env.MODELSCOPE_API_KEY}"`, // Show actual value in quotes
        all_env_keys_count: allEnvKeys.length,
        modelscope_related_keys: secretKeys,
        all_env_keys: allEnvKeys.slice(0, 20) // First 20 for debugging
      },
      cloudflare_ai: {
        available: !!env.AI,
        binding_type: typeof env.AI
      },
      facebook: {
        page_token_available: !!env.FACEBOOK_PAGE_TOKEN,
        recipient_id_available: !!env.FACEBOOK_RECIPIENT_ID
      },
      api_keys: {
        fmp_api_key: !!env.FMP_API_KEY,
        newsapi_key: !!env.NEWSAPI_KEY,
        worker_api_key: !!env.WORKER_API_KEY
      },
      r2_buckets: {
        enhanced_models: !!env.ENHANCED_MODELS,
        trained_models: !!env.TRAINED_MODELS
      },
      kv_namespace: {
        trading_results: !!env.TRADING_RESULTS
      }
    }
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Test ModelScope API with parameter-provided key
 */
export async function handleModelScopeTest(request, env) {
  try {
    let apiKey;

    // Accept API key via POST body (more secure) or URL parameter (convenience)
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        apiKey = body.api_key;
        console.log(`🔒 Received POST request with body keys: ${Object.keys(body)}`);
      } catch (jsonError) {
        console.error(`❌ JSON parsing error:`, jsonError.message);
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body',
          details: jsonError.message
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' },
          status: 400
        });
      }
    } else {
      const url = new URL(request.url);
      apiKey = url.searchParams.get('key');
    }

    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing API key',
        usage: {
          secure_method: 'POST {"api_key": "YOUR_MODELSCOPE_API_KEY"}',
          quick_method: 'GET with ?key=YOUR_MODELSCOPE_API_KEY (less secure)'
        }
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log(`🔧 Testing ModelScope GLM-4.5 API with parameter key...`);
    console.log(`🔐 API Key provided: ${!!apiKey}`);
    console.log(`🔐 API Key length: ${apiKey.length}`);
    console.log(`🔐 API Key first 10 chars: ${apiKey.substring(0, 10)}...`);

    // Test ModelScope GLM-4.5 API directly
    const testRequest = {
      model: 'ZhipuAI/GLM-4.5',
      messages: [
        {
          role: 'user',
          content: 'Test sentiment analysis: Apple stock rises on strong iPhone sales. Is this bullish or bearish?'
        }
      ],
      temperature: 0.1,
      max_tokens: 100
    };

    console.log(`📡 Making direct ModelScope API call...`);
    const response = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testRequest)
    });

    console.log(`📨 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ModelScope API Error:`, errorText);
      return new Response(JSON.stringify({
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        api_key_used: apiKey.substring(0, 10) + '...',
        endpoint: 'https://api-inference.modelscope.cn/v1/chat/completions'
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const responseData = await response.json();
    console.log(`✅ ModelScope API call successful`);

    return new Response(JSON.stringify({
      success: true,
      modelscope_test: {
        api_key_used: apiKey.substring(0, 10) + '...',
        response_received: !!responseData,
        response_preview: JSON.stringify(responseData).substring(0, 300) + '...',
        model_used: testRequest.model,
        endpoint: 'https://api-inference.modelscope.cn/v1/chat/completions'
      },
      full_response: responseData
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ ModelScope parameter test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

/**
 * Public Sentiment Analysis System test
 */
export async function handleSentimentDebugTest(request, env) {
  try {
    console.log('🔧 Testing Sentiment Analysis System...');

    // Import required modules
    const { getSentimentWithFallbackChain } = await import('./enhanced_analysis.js');

    // Test with minimal news data
    const testSymbol = 'AAPL';
    const mockNewsData = [
      {
        title: "Apple Stock Hits New High on Strong Earnings",
        summary: "Apple Inc. reports record quarterly revenue with strong iPhone sales and services growth.",
        url: "test-url",
        publishedAt: new Date().toISOString()
      },
      {
        title: "iPhone Sales Surge in China Market",
        summary: "Apple sees significant growth in Chinese market with latest iPhone models.",
        url: "test-url-2",
        publishedAt: new Date().toISOString()
      }
    ];

    console.log(`   📰 Using mock news data: ${mockNewsData.length} articles`);
    console.log(`   🔍 Testing environment - AI available: ${!!env.AI}`);

    if (!env.AI) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cloudflare AI not available in this environment',
        ai_binding: !!env.AI,
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Test multiple models to isolate the issue
    console.log(`   🔍 Testing available AI models...`);

    // Test 1: Working DistilBERT model
    try {
      const distilTest = await env.AI.run('@cf/huggingface/distilbert-sst-2-int8', {
        text: "Apple stock is performing well"
      });
      console.log(`   ✅ DistilBERT test succeeded:`, distilTest);
    } catch (distilError) {
      console.log(`   ❌ DistilBERT test failed:`, distilError.message);
    }

    // Test 2: GPT-OSS-120B with basic input
    try {
      const gptTest = await env.AI.run('@cf/openchat/openchat-3.5-0106', {
        messages: [{ role: 'user', content: 'Hello, respond with Hello World' }],
        temperature: 0.1,
        max_tokens: 50
      });
      console.log(`   ✅ GPT-OSS-120B basic test succeeded:`, gptTest);
    } catch (gptError) {
      console.log(`   ❌ GPT-OSS-120B basic test failed:`, gptError.message);
    }

    // Test sentiment analysis with enhanced logging
    console.log(`   🧪 Testing sentiment analysis system...`);
    const sentimentResult = await getSentimentWithFallbackChain(testSymbol, mockNewsData, env);

    // Check if sentiment analysis actually succeeded
    const sentimentSuccess = sentimentResult &&
                             sentimentResult.sentiment &&
                             !sentimentResult.error_details &&
                             sentimentResult.confidence > 0;

    console.log(`   ✅ Sentiment analysis test result:`, {
      success: sentimentSuccess,
      sentiment: sentimentResult?.sentiment,
      confidence: sentimentResult?.confidence,
      source: sentimentResult?.source,
      has_error: !!sentimentResult?.error_details
    });

    return new Response(JSON.stringify({
      success: true,
      sentiment_api_test: {
        symbol: testSymbol,
        news_articles_processed: mockNewsData.length,
        sentiment_result: sentimentResult,
        model_used: sentimentResult?.models_used || ['error'],
        cost_estimate: sentimentResult?.cost_estimate || { total_cost: 0 }
      },
      debug_info: {
        ai_available: sentimentSuccess,
        cloudflare_ai_available: !!env.AI,
        timestamp: new Date().toISOString(),
        test_type: 'sentiment_analysis_validation'
      }
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ GPT debug test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      error_stack: error.stack,
      api_format_fix: 'instructions + input format',
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle model health check - verify R2 model files accessibility
 */
export async function handleModelHealth(request, env) {
  try {
    console.log('🏥 Running model health check...');

    const healthResult = {
      timestamp: new Date().toISOString(),
      enhanced_models_bucket: env.ENHANCED_MODELS_BUCKET || 'Not configured',
      r2_binding: {
        enhanced_models: !!env.ENHANCED_MODELS,
        trained_models: !!env.TRAINED_MODELS,
        binding_types: {
          enhanced: typeof env.ENHANCED_MODELS,
          trained: typeof env.TRAINED_MODELS
        }
      },
      model_files: {},
      bucket_contents: [],
      errors: []
    };

    if (!env.ENHANCED_MODELS) {
      healthResult.errors.push('ENHANCED_MODELS R2 binding not available');
      return new Response(JSON.stringify(healthResult, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // List all objects in bucket
    try {
      const listResponse = await env.ENHANCED_MODELS.list();
      healthResult.bucket_contents = listResponse.objects?.map(obj => ({
        key: obj.key,
        size: obj.size,
        modified: obj.uploaded
      })) || [];
      console.log(`📋 Found ${healthResult.bucket_contents.length} objects in R2 bucket`);
    } catch (listError) {
      healthResult.errors.push(`Failed to list bucket contents: ${listError.message}`);
    }

    // Test access to enhanced model files
    const filesToTest = [
      'deployment_metadata.json',
      'tft_weights.json',
      'nhits_weights.json'
    ];

    for (const fileName of filesToTest) {
      try {
        console.log(`🔍 Testing access to ${fileName}...`);
        const fileResponse = await env.ENHANCED_MODELS.get(fileName);

        if (fileResponse) {
          // Read first 200 characters to verify content
          const headContent = await fileResponse.text();
          const head = headContent.substring(0, 200);

          healthResult.model_files[fileName] = {
            accessible: true,
            size: headContent.length,
            head_preview: head,
            content_type: typeof headContent
          };
          console.log(`✅ ${fileName}: ${headContent.length} bytes`);
        } else {
          healthResult.model_files[fileName] = {
            accessible: false,
            error: 'File not found'
          };
          console.log(`❌ ${fileName}: Not found`);
        }
      } catch (fileError) {
        healthResult.model_files[fileName] = {
          accessible: false,
          error: fileError.message
        };
        console.log(`❌ ${fileName}: ${fileError.message}`);
      }
    }

    // Calculate health score
    const accessibleFiles = Object.values(healthResult.model_files).filter(f => f.accessible).length;
    const totalFiles = filesToTest.length;
    healthResult.health_score = `${accessibleFiles}/${totalFiles}`;
    healthResult.overall_status = accessibleFiles === totalFiles ? 'healthy' :
                                 accessibleFiles > 0 ? 'partial' : 'unhealthy';

    const statusCode = accessibleFiles === totalFiles ? 200 : 206;

    return new Response(JSON.stringify(healthResult, null, 2), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Model health check error:', error);
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
 * Handle R2 upload for enhanced model files
 */
export async function handleR2Upload(request, env) {
  try {
    console.log('📤 R2 upload API called...');

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed - use POST',
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!env.ENHANCED_MODELS) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ENHANCED_MODELS R2 binding not available',
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse form data for file uploads
    const formData = await request.formData();
    const uploadResults = {};
    const errors = [];

    console.log('📋 Form data entries:', Array.from(formData.keys()));

    // Handle multiple file uploads
    for (const [fieldName, file] of formData.entries()) {
      if (file instanceof File) {
        try {
          console.log(`📤 Uploading ${fieldName}: ${file.name} (${file.size} bytes)`);

          // Determine the R2 key based on field name
          let r2Key;
          switch (fieldName) {
            case 'deployment_metadata':
              r2Key = 'deployment_metadata.json';
              break;
            case 'tft_weights':
              r2Key = 'enhanced_tft_weights.json';
              break;
            case 'nhits_weights':
              r2Key = 'enhanced_nhits_weights.json';
              break;
            default:
              r2Key = file.name;
          }

          // Upload to R2
          const fileData = await file.arrayBuffer();
          const uploadResponse = await env.ENHANCED_MODELS.put(r2Key, fileData, {
            httpMetadata: {
              contentType: file.type || 'application/json'
            }
          });

          uploadResults[fieldName] = {
            success: true,
            filename: file.name,
            r2_key: r2Key,
            size: file.size,
            content_type: file.type,
            upload_response: uploadResponse
          };

          console.log(`✅ Successfully uploaded ${r2Key}: ${file.size} bytes`);

        } catch (uploadError) {
          console.error(`❌ Upload failed for ${fieldName}:`, uploadError);
          uploadResults[fieldName] = {
            success: false,
            filename: file.name,
            error: uploadError.message
          };
          errors.push(`Failed to upload ${fieldName}: ${uploadError.message}`);
        }
      } else {
        // Handle non-file form fields (like JSON strings)
        try {
          const content = file.toString();
          let r2Key;

          switch (fieldName) {
            case 'deployment_metadata_json':
              r2Key = 'deployment_metadata.json';
              break;
            case 'tft_weights_json':
              r2Key = 'enhanced_tft_weights.json';
              break;
            case 'nhits_weights_json':
              r2Key = 'enhanced_nhits_weights.json';
              break;
            default:
              continue; // Skip unknown text fields
          }

          console.log(`📤 Uploading text content for ${fieldName} to ${r2Key} (${content.length} chars)`);

          const uploadResponse = await env.ENHANCED_MODELS.put(r2Key, content, {
            httpMetadata: {
              contentType: 'application/json'
            }
          });

          uploadResults[fieldName] = {
            success: true,
            r2_key: r2Key,
            size: content.length,
            content_type: 'application/json',
            upload_response: uploadResponse
          };

          console.log(`✅ Successfully uploaded ${r2Key}: ${content.length} chars`);

        } catch (uploadError) {
          console.error(`❌ Text upload failed for ${fieldName}:`, uploadError);
          uploadResults[fieldName] = {
            success: false,
            error: uploadError.message
          };
          errors.push(`Failed to upload ${fieldName}: ${uploadError.message}`);
        }
      }
    }

    // Verify uploads by checking bucket contents
    try {
      const listResponse = await env.ENHANCED_MODELS.list();
      const currentFiles = listResponse.objects?.map(obj => obj.key) || [];
      console.log(`📋 Current R2 bucket contents after upload: ${currentFiles.join(', ')}`);
    } catch (listError) {
      console.error('❌ Failed to list bucket after upload:', listError);
    }

    const response = {
      timestamp: new Date().toISOString(),
      success: errors.length === 0,
      uploads: uploadResults,
      errors: errors,
      total_uploads: Object.keys(uploadResults).length,
      successful_uploads: Object.values(uploadResults).filter(r => r.success).length
    };

    const statusCode = errors.length === 0 ? 200 : 207; // 207 = Multi-Status (partial success)

    return new Response(JSON.stringify(response, null, 2), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ R2 upload API error:', error);
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
 * Test All 5 Facebook Message Types (with comprehensive logging)
 */
export async function handleTestAllFacebookMessages(request, env) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    return new Response(JSON.stringify({
      success: false,
      error: "Facebook not configured - FACEBOOK_PAGE_TOKEN or FACEBOOK_RECIPIENT_ID missing",
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  console.log("🧪 [FB-TEST-ALL] Starting comprehensive Facebook message test for all 5 cron types");

  const testResults = {
    timestamp: new Date().toISOString(),
    test_execution_id: `fb_test_all_${Date.now()}`,
    facebook_configured: true,
    message_tests: {},
    kv_logs: {},
    errors: [],
    overall_success: true
  };

  // Import the Facebook functions we need to test
  const { 
    sendMorningPredictionsWithTracking,
    sendMiddayValidationWithTracking, 
    sendDailyValidationWithTracking,
    sendFridayWeekendReportWithTracking,
    sendWeeklyAccuracyReportWithTracking 
  } = await import("./facebook.js");

  // Create mock analysis result for testing
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

  // Test all 5 message types
  const messageTests = [
    { name: "morning_predictions", func: sendMorningPredictionsWithTracking, args: [mockAnalysisResult, env] },
    { name: "midday_validation", func: sendMiddayValidationWithTracking, args: [mockAnalysisResult, env] },
    { name: "daily_validation", func: sendDailyValidationWithTracking, args: [mockAnalysisResult, env] },
    { name: "friday_weekend_report", func: sendFridayWeekendReportWithTracking, args: [mockAnalysisResult, env, null, "weekly_market_close_analysis"] },
    { name: "weekly_accuracy_report", func: sendWeeklyAccuracyReportWithTracking, args: [env] }
  ];

  // Get KV count before testing
  let initialKVCount = 0;
  try {
    const initialKVList = await env.TRADING_RESULTS.list({ prefix: "fb_" });
    initialKVCount = initialKVList.keys?.length || 0;
    console.log(`📋 [FB-TEST-INITIAL] Found ${initialKVCount} existing Facebook KV records`);
  } catch (error) {
    console.error(`❌ [FB-TEST-INITIAL] Failed to get initial KV count:`, error);
  }

  for (let i = 0; i < messageTests.length; i++) {
    const test = messageTests[i];
    try {
      console.log(`📱 [FB-TEST-${i+1}] Testing ${test.name} message...`);
      const cronId = `${testResults.test_execution_id}_${test.name}`;

      // Add cronId to args
      const args = [...test.args];
      if (test.name === "weekly_accuracy_report") {
        args.push(cronId);
      } else {
        args.push(cronId);
      }

      // Execute function
      await test.func(...args);

      // Verify KV storage success
      let kvStored = false;
      let kvKey = null;
      try {
        // Wait a moment for KV to be available
        await new Promise(resolve => setTimeout(resolve, 100));

        const postKVList = await env.TRADING_RESULTS.list({ prefix: "fb_" });
        const newKVCount = postKVList.keys?.length || 0;

        if (newKVCount > initialKVCount) {
          // Find the new KV record
          const testTimestamp = testResults.test_execution_id.split("_")[3];
          const newRecords = postKVList.keys?.filter(k =>
            k.name.includes(testTimestamp) ||
            k.name.includes(cronId.split("_")[2])
          ) || [];

          if (newRecords.length > 0) {
            kvStored = true;
            kvKey = newRecords[0].name;

            // Verify the record contains expected data
            const kvRecord = await env.TRADING_RESULTS.get(newRecords[0].name);
            if (kvRecord) {
              const recordData = JSON.parse(kvRecord);
              if (!recordData.message_sent || !recordData.cron_execution_id) {
                kvStored = false;
                console.error(`❌ [FB-TEST-${i+1}] KV record missing required fields`);
              }
            }
          }
        }

        if (!kvStored) {
          throw new Error("KV storage verification failed - no record found or incomplete data");
        }

        testResults.message_tests[test.name] = {
          success: true,
          cron_id: cronId,
          kv_key: kvKey,
          kv_verified: true
        };
        console.log(`✅ [FB-TEST-${i+1}] ${test.name} test completed with KV verification: ${kvKey}`);

      } catch (kvVerifyError) {
        console.error(`❌ [FB-TEST-${i+1}] KV verification failed for ${test.name}:`, kvVerifyError);
        testResults.message_tests[test.name] = {
          success: false,
          error: `KV storage failed: ${kvVerifyError.message}`,
          cron_id: cronId,
          kv_verified: false
        };
        testResults.errors.push(`${test.name}: KV storage verification failed - ${kvVerifyError.message}`);
        testResults.overall_success = false;
      }

    } catch (error) {
      console.error(`❌ [FB-TEST-${i+1}] ${test.name} test failed:`, error);
      testResults.message_tests[test.name] = { success: false, error: error.message };
      testResults.errors.push(`${test.name}: ${error.message}`);
      testResults.overall_success = false;
    }
  }

  // Check KV logs
  console.log("🔍 [FB-TEST-KV] Checking KV logging for all tests...");
  try {
    const kvKeys = await env.TRADING_RESULTS.list({ prefix: "fb_" });
    const testTimestamp = testResults.test_execution_id.split("_")[3];
    const recentLogs = kvKeys.keys?.filter(k => k.name.includes(testTimestamp)) || [];
    testResults.kv_logs = {
      total_fb_logs: kvKeys.keys?.length || 0,
      test_related_logs: recentLogs.length,
      recent_log_keys: recentLogs.map(k => k.name)
    };
    console.log(`📋 [FB-TEST-KV] Found ${recentLogs.length} test-related logs in KV`);
  } catch (kvError) {
    console.error("❌ [FB-TEST-KV] KV logging check failed:", kvError);
    testResults.kv_logs = { error: kvError.message };
  }

  // Summary
  const successCount = Object.values(testResults.message_tests).filter(t => t.success).length;
  testResults.summary = {
    total_tests: 5,
    successful_tests: successCount,
    failed_tests: 5 - successCount,
    success_rate: `${successCount}/5 (${Math.round(successCount/5*100)}%)`
  };

  console.log(`🏁 [FB-TEST-ALL] Test completed: ${successCount}/5 successful`);

  const statusCode = testResults.overall_success ? 200 : 207; // 207 = Multi-Status

  return new Response(JSON.stringify(testResults, null, 2), {
    status: statusCode,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * Handle per-symbol fine-grained analysis requests
 */
export async function handlePerSymbolAnalysis(request, env) {
  try {
    console.log('🔍 Per-symbol fine-grained analysis requested');

    // Get symbol from URL query parameters
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol');

    if (!symbol) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Symbol parameter is required',
        example: '/analyze-symbol?symbol=AAPL',
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate symbol format (basic validation)
    if (!/^[A-Z]{1,5}$/.test(symbol.toUpperCase())) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid symbol format. Use 1-5 uppercase letters (e.g., AAPL, MSFT)',
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get optional analysis parameters
    const options = {
      includeTechnical: url.searchParams.get('include-technical') === 'true',
      timeHorizon: url.searchParams.get('time-horizon') || 'short',
      confidenceThreshold: parseFloat(url.searchParams.get('confidence-threshold')) || 0.6
    };

    console.log(`🎯 Analyzing symbol: ${symbol.toUpperCase()} with options:`, options);

    // Perform fine-grained per-symbol analysis
    const analysis = await analyzeSingleSymbol(symbol.toUpperCase(), env, options);

    return new Response(JSON.stringify({
      success: true,
      symbol: symbol.toUpperCase(),
      analysis: analysis,
      execution_metadata: {
        request_timestamp: new Date().toISOString(),
        analysis_type: 'fine_grained_per_symbol',
        options_used: options,
        processing_complete: !analysis.error
      }
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Per-symbol analysis error:', error);

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
