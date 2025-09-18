/**
 * ModelScope GLM-4.5 Sentiment Analysis Pipeline - VERSION 2025-09-18
 * Uses ModelScope GLM-4.5 for sentiment analysis (replacing GPT-OSS-120B)
 * Cost: $0.59 input, $2.19 output per M tokens (30-50% savings vs GPT-OSS-120B)
 * FREE: 2,000 API calls per day (covers all daily analyses)
 */

console.log('🔥 LOADING MODELSCOPE GLM-4.5 SENTIMENT PIPELINE MODULE 2025-09-18');

// Import free news pipeline
import { getFreeStockNews as getNewsData } from './free_sentiment_pipeline.js';
import { parseNaturalLanguageResponse, calculateModelCost } from './sentiment_utils.js';

// ModelScope GLM-4.5 Configuration
const MODELSCOPE_AI_CONFIG = {
  models: {
    // Primary and only model - ModelScope GLM-4.5 (correct model ID)
    primary: 'ZhipuAI/GLM-4.5', // GLM-4.5 model on ModelScope (free tier: 2,000 calls/day)

    // API endpoint for ModelScope
    endpoint: 'https://api-inference.modelscope.cn/v1/chat/completions'
  },

  // Simplified strategy: GLM-4.5 only
  usage_strategy: 'glm_only', // Single model approach for simplicity and cost efficiency

  // GLM-4.5 confidence thresholds
  confidence_levels: {
    high_confidence: 0.85,    // High confidence threshold
    medium_confidence: 0.65,  // Medium confidence threshold
    low_confidence: 0.45      // Minimum acceptable confidence
  }
};

/**
 * ModelScope GLM-4.5 sentiment analysis (primary and only model)
 */
async function getModelScopeAISentiment(symbol, newsData, env) {
  console.log(`🚀 Starting ModelScope GLM-4.5 sentiment analysis for ${symbol}...`);

  if (!newsData || newsData.length === 0) {
    console.log(`   ⚠️ No news data available for ${symbol}`);
    return {
      symbol: symbol,
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      source: 'modelscope_glm45',
      cost_estimate: { total_cost: 0, api_calls: 0 }
    };
  }

  console.log(`   📊 Processing ${newsData.length} news items for ${symbol}`);
  console.log(`   🔍 Environment check: MODELSCOPE_API_KEY available = ${!!env.MODELSCOPE_API_KEY}`);

  try {
    console.log(`   🧠 Using ModelScope GLM-4.5 for ${symbol} sentiment analysis...`);

    // Direct GLM-4.5 analysis
    const glmResult = await getGLM45DirectSentiment(symbol, newsData, env);

    if (!glmResult) {
      console.error(`   ❌ GLM-4.5 returned null result for ${symbol}`);
      throw new Error('GLM-4.5 analysis failed');
    }

    console.log(`   ✅ GLM-4.5 sentiment complete: ${glmResult.sentiment} (${(glmResult.confidence * 100).toFixed(1)}%)`);
    console.log(`   📈 GLM-4.5 reasoning: ${glmResult.reasoning?.substring(0, 100)}...`);

    const finalResult = {
      symbol: symbol,
      sentiment: glmResult.sentiment,
      confidence: glmResult.confidence,
      score: glmResult.sentiment === 'bullish' ? glmResult.confidence :
             glmResult.sentiment === 'bearish' ? -glmResult.confidence : 0,
      reasoning: glmResult.reasoning,

      // GLM-4.5 details
      analysis_details: glmResult,
      source: 'modelscope_glm45',
      models_used: ['glm-4.5'],
      cost_estimate: glmResult.cost_estimate || calculateModelCost('glm-4.5', 800, 300),
      timestamp: new Date().toISOString(),

      // Debug information
      debug_info: {
        news_count: newsData.length,
        api_call_success: true,
        processing_time: new Date().toISOString()
      }
    };

    console.log(`   🎯 Final sentiment result for ${symbol}:`, {
      sentiment: finalResult.sentiment,
      confidence: finalResult.confidence,
      score: finalResult.score,
      cost: finalResult.cost_estimate?.total_cost || 0,
      models: finalResult.models_used
    });

    return finalResult;

  } catch (error) {
    console.error(`   ❌ GLM-4.5 sentiment analysis failed for ${symbol}:`, {
      error_message: error.message,
      error_stack: error.stack,
      news_available: !!newsData,
      news_count: newsData?.length || 0,
      api_key_available: !!env.MODELSCOPE_API_KEY,
      diagnostic_hints: [
        'Empty Response: GLM-4.5 may have hit request/token limits',
        'Content Filtering: Financial news may trigger model content filters',
        'Token Limits: Input size may exceed GLM-4.5 context window',
        'Model Availability: GLM-4.5 may have intermittent availability issues'
      ]
    });

    // Throw error to trigger Llama 3.1 fallback in enhanced_analysis.js
    throw new Error(`GLM-4.5 analysis failed: ${error.message}`);
  }
}

/**
 * Batch sentiment analysis using DistilBERT (cheap and fast)
 */
async function analyzeBatchSentiment(newsData, env) {
  const sentimentPromises = newsData.slice(0, 10).map(async (newsItem, index) => {
    try {
      // Combine title and summary for analysis
      const text = `${newsItem.title}. ${newsItem.summary || ''}`.substring(0, 500);

      // Use Cloudflare AI DistilBERT model
      const response = await env.AI.run(
        CLOUDFLARE_AI_CONFIG.models.sentiment,
        { text: text }
      );

      // DistilBERT returns array with label and score
      const result = response[0];

      return {
        news_item: newsItem,
        sentiment: {
          label: result.label.toLowerCase(), // POSITIVE/NEGATIVE -> positive/negative
          confidence: result.score,
          score: result.label === 'POSITIVE' ? result.score : -result.score,
          model: 'distilbert-sst-2'
        },
        text_analyzed: text,
        processing_order: index
      };

    } catch (error) {
      console.error('Individual sentiment analysis failed:', error);
      return {
        news_item: newsItem,
        sentiment: {
          label: 'neutral',
          confidence: 0,
          score: 0,
          model: 'error'
        },
        error: error.message
      };
    }
  });

  // Wait for all sentiment analyses with timeout
  const results = await Promise.allSettled(sentimentPromises);

  return results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);
}

/**
 * Aggregate quick sentiment results
 */
function aggregateQuickSentiments(quickSentiments) {
  if (quickSentiments.length === 0) {
    return { label: 'neutral', confidence: 0, score: 0, reasoning: 'No valid sentiments' };
  }

  // Calculate weighted average sentiment
  let totalScore = 0;
  let totalWeight = 0;
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };

  quickSentiments.forEach(item => {
    const sentiment = item.sentiment;
    const weight = sentiment.confidence; // Weight by confidence

    totalScore += sentiment.score * weight;
    totalWeight += weight;

    // Count sentiment types
    if (sentiment.score > 0.1) sentimentCounts.positive++;
    else if (sentiment.score < -0.1) sentimentCounts.negative++;
    else sentimentCounts.neutral++;
  });

  const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  const avgConfidence = totalWeight / quickSentiments.length;

  // Determine final sentiment label
  let finalLabel = 'neutral';
  if (avgScore > 0.1) finalLabel = 'bullish';
  else if (avgScore < -0.1) finalLabel = 'bearish';

  return {
    label: finalLabel,
    confidence: avgConfidence,
    score: avgScore,
    reasoning: `${finalLabel} sentiment from ${quickSentiments.length} news items (${sentimentCounts.positive}+ ${sentimentCounts.negative}- ${sentimentCounts.neutral}=)`
  };
}

/**
 * Direct GLM-4.5 sentiment analysis (primary engine)
 */
async function getGLM45DirectSentiment(symbol, newsData, env) {
  try {
    console.log(`   🧠 🔥 ModelScope GLM-4.5 VERSION 2025-09-18 - Starting GLM-4.5 sentiment analysis for ${symbol}...`);
    console.log(`   🔧 Debug info:`, {
      symbol: symbol,
      news_count: newsData.length,
      api_key_available: !!env.MODELSCOPE_API_KEY,
      model_config: MODELSCOPE_AI_CONFIG.models.primary
    });

    // Prepare context for GLM-4.5
    const newsContext = newsData
      .slice(0, 10) // Top 10 news items
      .map((item, i) => `${i+1}. ${item.title}\n   ${item.summary || ''}`)
      .join('\n\n');

    console.log(`   📰 Processing ${newsData.length} news items (showing top 10)`);
    console.log(`   📝 News context length: ${newsContext.length} characters`);

    const prompt = `Analyze the financial sentiment for ${symbol} stock based on these news headlines:

${newsContext}

Please provide:
1. Overall sentiment (bullish, bearish, or neutral)
2. Confidence level (0.0 to 1.0)
3. Key reasoning for the sentiment
4. Price impact assessment (high, medium, low)

Be concise and focus on market-moving factors.`;

    console.log(`   🔧 Calling ModelScope GLM-4.5 API...`);

    const apiParams = {
      model: MODELSCOPE_AI_CONFIG.models.primary,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    };

    console.log(`   📡 Using ModelScope GLM-4.5 API:`, {
      endpoint: MODELSCOPE_AI_CONFIG.models.endpoint,
      model: MODELSCOPE_AI_CONFIG.models.primary,
      prompt_length: prompt.length,
      api_params: apiParams
    });

    console.log(`   🚀 Making fetch call to ModelScope GLM-4.5...`);
    console.log(`   🔐 API Key available: ${!!env.MODELSCOPE_API_KEY}`);
    console.log(`   🔐 API Key length: ${env.MODELSCOPE_API_KEY?.length || 0} characters`);
    console.log(`   🔐 API Key first 10 chars: ${env.MODELSCOPE_API_KEY?.substring(0, 10) || 'null'}...`);
    console.log(`   📡 Request URL: ${MODELSCOPE_AI_CONFIG.models.endpoint}`);
    console.log(`   📡 Request Model: ${MODELSCOPE_AI_CONFIG.models.primary}`);
    console.log(`   📡 Request Body: ${JSON.stringify(apiParams).substring(0, 200)}...`);

    const response = await fetch(MODELSCOPE_AI_CONFIG.models.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.MODELSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(apiParams)
    });

    console.log(`   📨 Response status: ${response.status} ${response.statusText}`);
    console.log(`   📨 Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);

    if (!response.ok) {
      const errorText = await response.text();

      // Enhanced rate limiting detection
      const isRateLimit = response.status === 429 ||
                         response.status === 503 ||
                         errorText.toLowerCase().includes('rate limit') ||
                         errorText.toLowerCase().includes('too many requests') ||
                         errorText.toLowerCase().includes('quota exceeded');

      const rateLimitHeaders = {
        'x-ratelimit-limit': response.headers.get('x-ratelimit-limit'),
        'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
        'x-ratelimit-reset': response.headers.get('x-ratelimit-reset'),
        'retry-after': response.headers.get('retry-after')
      };

      console.error(`   ❌ ModelScope API Error Response:`, {
        status: response.status,
        statusText: response.statusText,
        is_rate_limit: isRateLimit,
        rate_limit_headers: rateLimitHeaders,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
        diagnostic_hints: isRateLimit ? [
          'RATE LIMITING DETECTED - ModelScope API quota exceeded',
          'Consider implementing sequential calls instead of parallel',
          'Check ModelScope dashboard for usage limits',
          'Implement exponential backoff retry strategy'
        ] : [
          'API authentication - Check MODELSCOPE_API_KEY validity',
          'Model availability - GLM-4.5 may be temporarily unavailable',
          'Request format - Check API parameters and model name'
        ]
      });

      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}${isRateLimit ? ' [RATE_LIMIT_DETECTED]' : ''}`);
    }

    const responseData = await response.json();
    console.log(`   ✅ GLM-4.5 API call completed successfully`);

    console.log(`   📊 GLM-4.5 response received:`, {
      response_type: typeof responseData,
      has_choices: !!responseData.choices,
      choices_length: responseData.choices?.length || 0,
      has_usage: !!responseData.usage,
      full_response_preview: JSON.stringify(responseData).substring(0, 500) + '...'
    });

    // Add comprehensive response validation logging
    if (!responseData) {
      console.error(`   ❌ GLM-4.5 returned null/undefined response`);
      throw new Error('Null response from GLM-4.5 API');
    }

    if (typeof responseData !== 'object') {
      console.error(`   ❌ GLM-4.5 returned non-object response:`, typeof responseData);
      throw new Error('Invalid response type from GLM-4.5 API');
    }

    // Parse GLM-4.5 response (OpenAI-compatible format)
    if (!responseData.choices || responseData.choices.length === 0) {
      throw new Error('No choices returned from GLM-4.5 API');
    }

    const content = responseData.choices[0].message.content;
    console.log(`   📝 GLM-4.5 content (full):`, content);
    console.log(`   📝 GLM-4.5 content length:`, content?.length || 0);

    // Parse GLM-4.5 response (handle both JSON and natural language)
    let analysisData;
    try {
      // First try JSON parsing
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(`   📋 JSON found in GLM-4.5 response:`, jsonMatch[0].substring(0, 200) + '...');
        analysisData = JSON.parse(jsonMatch[0]);
        console.log(`   ✅ GLM-4.5 JSON parsed successfully:`, analysisData);
      } else if (content && content.length > 0) {
        // Parse natural language response
        console.log(`   📝 Parsing natural language response from GLM-4.5`);
        analysisData = parseNaturalLanguageResponse(content);
        console.log(`   ✅ GLM-4.5 natural language parsed:`, analysisData);
      } else {
        throw new Error('Empty response from GLM-4.5');
      }
    } catch (parseError) {
      console.error('   ❌ Failed to parse GLM-4.5 response:', {
        error: parseError.message,
        content_preview: content.substring(0, 300),
        content_length: content?.length || 0
      });
      throw new Error(`Response parsing failed: ${parseError.message}`);
    }

    // Build result with GLM-4.5 data
    const result = {
      ...analysisData,
      model: 'glm-4.5',
      analysis_type: 'direct_sentiment',
      cost_estimate: calculateModelCost('glm-4.5', Math.ceil(prompt.length / 4), Math.ceil(content.length / 4)),
      usage_details: responseData.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      api_debug: {
        format_used: 'modelscope_openai_compatible',
        model_used: 'glm-4.5',
        input_tokens_estimate: Math.ceil(prompt.length / 4),
        response_length: content.length,
        api_call_success: true,
        final_api_params: apiParams,
        text_extraction_success: true
      }
    };

    console.log(`   🎯 Final GLM-4.5 sentiment result:`, {
      sentiment: result.sentiment,
      confidence: result.confidence,
      reasoning_preview: result.reasoning?.substring(0, 100) + '...',
      cost_estimate: result.cost_estimate
    });

    return result;

  } catch (error) {
    console.error('   ❌ GLM-4.5 sentiment analysis failed:', {
      error_message: error.message,
      error_stack: error.stack,
      symbol: symbol,
      news_count: newsData?.length || 0
    });
    throw new Error(`GLM-4.5 analysis failed: ${error.message}`);
  }
}



/**
 * Complete sentiment analysis pipeline for integration (GLM-4.5 only)
 */
async function runModelScopeAISentimentAnalysis(symbol, env) {
  try {
    // 1. Get news data (using free APIs)
    const newsData = await getFreeStockNews(symbol, env);

    // 2. Analyze with ModelScope GLM-4.5
    const sentimentResult = await getModelScopeAISentiment(symbol, newsData, env);

    return sentimentResult;

  } catch (error) {
    console.error(`ModelScope GLM-4.5 sentiment analysis failed for ${symbol}:`, error);
    return {
      symbol: symbol,
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'Analysis pipeline failed',
      source: 'modelscope_error'
    };
  }
}

// Helper function to get free news - use imported function
async function getFreeStockNews(symbol, env) {
  return await getNewsData(symbol, env);
}

// Export for Cloudflare Workers (updated for GLM-4.5)
export {
  getModelScopeAISentiment,
  runModelScopeAISentimentAnalysis,
  MODELSCOPE_AI_CONFIG
};
