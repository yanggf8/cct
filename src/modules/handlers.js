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

    // Get symbols from request or use default
    let symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];
    
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

    // Get symbols from request or use default
    let symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];
    
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
 * Public ModelScope GLM-4.5 API test
 */
export async function handleGPTDebugTest(request, env) {
  try {
    console.log('🔧 Testing ModelScope GLM-4.5 API...');

    // Import required modules
    const { getModelScopeAISentiment } = await import('./cloudflare_ai_sentiment_pipeline.js');

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
      const gptTest = await env.AI.run('@cf/openai/gpt-oss-120b', {
        input: "Hello, respond with 'Hello World'"
      });
      console.log(`   ✅ GPT-OSS-120B basic test succeeded:`, gptTest);
    } catch (gptError) {
      console.log(`   ❌ GPT-OSS-120B basic test failed:`, gptError.message);
    }

    // Test GLM-4.5 sentiment analysis
    const sentimentResult = await getModelScopeAISentiment(testSymbol, mockNewsData, env);

    return new Response(JSON.stringify({
      success: true,
      gpt_api_test: {
        symbol: testSymbol,
        news_articles_processed: mockNewsData.length,
        sentiment_result: sentimentResult,
        api_format_fix: 'instructions + input format',
        model_used: sentimentResult?.models_used || ['error'],
        cost_estimate: sentimentResult?.cost_estimate || { total_cost: 0 }
      },
      debug_info: {
        ai_available: !!env.AI,
        timestamp: new Date().toISOString(),
        test_type: 'gpt_oss_120b_api_format_validation'
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
      
      await test.func(...args);
      testResults.message_tests[test.name] = { success: true, cron_id: cronId };
      console.log(`✅ [FB-TEST-${i+1}] ${test.name} test completed`);
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
