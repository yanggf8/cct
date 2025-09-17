/**
 * Cloudflare AI Sentiment Analysis Pipeline
 * Uses Cloudflare Workers AI for sentiment analysis
 * Cost: $0.026-$0.75 per M tokens (vs $150/month OpenAI)
 * FREE: 10,000 neurons per day
 */

// Import free news pipeline
import { getFreeStockNews as getNewsData } from './free_sentiment_pipeline.js';

// Cloudflare AI Configuration
const CLOUDFLARE_AI_CONFIG = {
  models: {
    // Fast sentiment analysis (cheap)
    sentiment: '@cf/huggingface/distilbert-sst-2-int8', // $0.026 per M tokens

    // Advanced analysis - GPT-OSS-120B for superior reasoning
    reasoning: '@cf/openai/gpt-oss-120b', // $0.35/$0.75 per M tokens (superior intelligence)

    // Alternative models (removed - using GPT-OSS-120B directly)
    alternatives: {}
  },

  // Free tier: 10,000 neurons per day
  usage_strategy: 'hybrid', // Use cheap model first, expensive for complex analysis

  sentiment_thresholds: {
    needs_validation: 0.70,  // Use GPT-OSS-120B for validation when DistilBERT uncertain
    trust_primary: 0.75,     // Trust DistilBERT alone
    high_confidence: 0.85    // Flag for extra weight in final predictions
  }
};

/**
 * Direct GPT-OSS-120B sentiment analysis (no DistilBERT needed)
 */
async function getCloudflareAISentiment(symbol, newsData, env) {
  console.log(`🚀 Starting Cloudflare AI sentiment analysis for ${symbol}...`);

  if (!newsData || newsData.length === 0) {
    console.log(`   ⚠️ No news data available for ${symbol}`);
    return {
      symbol: symbol,
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      source: 'cloudflare_ai_direct',
      cost_estimate: { total_cost: 0, neurons_estimate: 0 }
    };
  }

  console.log(`   📊 Processing ${newsData.length} news items for ${symbol}`);
  console.log(`   🔍 Environment check: AI available = ${!!env.AI}`);

  try {
    console.log(`   🧠 Using GPT-OSS-120B directly for ${symbol} sentiment analysis...`);

    // Direct GPT-OSS-120B analysis (skip DistilBERT entirely)
    const gptResult = await getGPTDirectSentiment(symbol, newsData, env);

    if (!gptResult) {
      console.error(`   ❌ GPT-OSS-120B returned null result for ${symbol}`);
      throw new Error('GPT-OSS-120B analysis failed');
    }

    console.log(`   ✅ GPT sentiment complete: ${gptResult.sentiment} (${(gptResult.confidence * 100).toFixed(1)}%)`);
    console.log(`   📈 GPT reasoning: ${gptResult.reasoning?.substring(0, 100)}...`);

    const finalResult = {
      symbol: symbol,
      sentiment: gptResult.sentiment,
      confidence: gptResult.confidence,
      score: gptResult.sentiment === 'bullish' ? gptResult.confidence :
             gptResult.sentiment === 'bearish' ? -gptResult.confidence : 0,
      reasoning: gptResult.reasoning,

      // GPT details
      analysis_details: gptResult,
      source: 'cloudflare_ai_direct_gpt',
      models_used: ['gpt-oss-120b'],
      cost_estimate: gptResult.cost_estimate || calculateGPTCost(800, 300), // Use actual or estimated tokens
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
    console.error(`   ❌ GPT sentiment analysis failed for ${symbol}:`, {
      error_message: error.message,
      error_stack: error.stack,
      news_available: !!newsData,
      news_count: newsData?.length || 0,
      ai_available: !!env.AI
    });

    return {
      symbol: symbol,
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'GPT analysis failed: ' + error.message,
      source: 'cloudflare_ai_error',
      cost_estimate: { total_cost: 0, neurons_estimate: 0 },
      error_details: {
        error_message: error.message,
        timestamp: new Date().toISOString()
      }
    };
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
 * Direct GPT-OSS-120B sentiment analysis (primary engine)
 */
async function getGPTDirectSentiment(symbol, newsData, env) {
  try {
    console.log(`   🧠 Starting GPT-OSS-120B sentiment analysis for ${symbol}...`);
    console.log(`   🔧 Debug info:`, {
      symbol: symbol,
      news_count: newsData.length,
      ai_binding: !!env.AI,
      model_config: CLOUDFLARE_AI_CONFIG.models.reasoning
    });

    // Prepare context for GPT-OSS-120B
    const newsContext = newsData
      .slice(0, 10) // Top 10 news items
      .map((item, i) => `${i+1}. ${item.title}\n   ${item.summary || ''}`)
      .join('\n\n');

    console.log(`   📰 Processing ${newsData.length} news items (showing top 10)`);
    console.log(`   📝 News context length: ${newsContext.length} characters`);

    const instructions = "You are a senior financial analyst specializing in sentiment analysis. Provide precise, actionable sentiment analysis in JSON format only. Focus on market-moving information and institutional sentiment.";

    const input = `Analyze financial sentiment for ${symbol} stock based on recent news:

${newsContext}

Provide your analysis in this exact JSON format:
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": 0.85,
  "price_impact": "high|medium|low",
  "time_horizon": "hours|days|weeks",
  "reasoning": "Brief explanation of key sentiment drivers",
  "key_factors": ["factor1", "factor2", "factor3"],
  "market_context": "Brief market condition assessment"
}`;

    // Try multiple API formats for GPT-OSS-120B
    console.log(`   🔧 Testing GPT-OSS-120B API formats...`);

    let response;
    let apiParams;
    let formatUsed;

    try {
      // GPT-OSS-120B without agent mode - just input parameter
      const combinedInput = `${instructions}\n\n${input}`;

      apiParams = {
        input: combinedInput,
        max_tokens: 400,
        temperature: 0.1
      };

      console.log(`   📡 Using GPT-OSS-120B with input-only format (non-agent):`, {
        model: CLOUDFLARE_AI_CONFIG.models.reasoning,
        combined_input_length: combinedInput.length,
        api_params: apiParams
      });

      console.log(`   🚀 Making AI.run call with input-only format...`);
      response = await env.AI.run(
        CLOUDFLARE_AI_CONFIG.models.reasoning,
        apiParams
      );
      console.log(`   ✅ AI.run call completed successfully with input-only format`);

      console.log(`   📊 Raw response received:`, {
        response_type: typeof response,
        response_constructor: response?.constructor?.name,
        response_keys: Object.keys(response || {}),
        response_has_data: !!response,
        raw_response: response
      });
      formatUsed = 'gpt_input_only_non_agent';

    } catch (gptError) {
      console.error(`   ❌ GPT-OSS-120B API call failed:`, {
        error_message: gptError.message,
        error_name: gptError.name,
        error_stack: gptError.stack,
        error_details: gptError,
        api_params_used: apiParams,
        model_used: CLOUDFLARE_AI_CONFIG.models.reasoning,
        ai_binding_available: !!env.AI
      });
      throw new Error(`GPT-OSS-120B analysis failed: ${gptError.message}`);
    }

    console.log(`   ✅ AI response received using ${formatUsed}:`, {
      format_used: formatUsed,
      response_type: typeof response,
      response_keys: Object.keys(response || {}),
      response_length: response?.response?.length || 0,
      full_response: response
    });

    // Parse the GPT-OSS-120B response
    let analysisData;
    try {
      // GPT-OSS-120B format: response.output array contains the text
      let responseText = '';

      if (typeof response === 'string') {
        // Direct string response
        responseText = response;
        console.log(`   📊 Direct string response:`, responseText.substring(0, 200) + '...');
      } else if (response?.response) {
        // GPT-OSS-120B standard response format
        responseText = response.response;
        console.log(`   📊 Using response property:`, responseText.substring(0, 200) + '...');
      } else if (response?.output && Array.isArray(response.output)) {
        // Extract text from output array - check multiple possible properties
        console.log(`   📊 Inspecting output array structure:`, response.output);
        responseText = response.output.map(item => {
          // Try multiple possible text properties
          const text = item.content || item.text || item.message || item.response || JSON.stringify(item);
          console.log(`   📋 Output item:`, item, `→ Extracted text:`, text);
          return text;
        }).join('');
        console.log(`   📊 Extracted from output array:`, responseText.substring(0, 200) + '...');
      } else if (typeof response === 'string') {
        // Direct string response
        responseText = response;
        console.log(`   📊 Direct string response:`, responseText.substring(0, 200) + '...');
      }

      if (!responseText) {
        throw new Error('No response text found in API response');
      }

      console.log(`   🔍 Response text to parse (${formatUsed}):`, responseText.substring(0, 500) + '...');

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(`   📋 JSON match found:`, jsonMatch[0].substring(0, 200) + '...');
        analysisData = JSON.parse(jsonMatch[0]);
        console.log(`   ✅ JSON parsed successfully:`, analysisData);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('   ❌ Failed to parse AI JSON response:', {
        error: parseError.message,
        format_used: formatUsed,
        response_preview: response?.response?.substring(0, 300) || 'No response text',
        response_structure: response
      });
      return null;
    }

    // GPT-OSS-120B was used
    const modelUsed = 'gpt-oss-120b';

    const result = {
      ...analysisData,
      model: modelUsed,
      analysis_type: 'direct_sentiment',
      cost_estimate: calculateGPTCost(input.length, response.response?.length || 0),
      api_debug: {
        format_used: formatUsed,
        model_used: modelUsed,
        input_tokens_estimate: Math.ceil(input.length / 4),
        response_length: response.response?.length || 0,
        api_call_success: true,
        final_api_params: apiParams
      }
    };

    console.log(`   🎯 Final GPT sentiment result:`, {
      sentiment: result.sentiment,
      confidence: result.confidence,
      reasoning_preview: result.reasoning?.substring(0, 100) + '...',
      cost_estimate: result.cost_estimate
    });

    return result;

  } catch (error) {
    console.error('   ❌ Direct GPT sentiment analysis failed:', {
      error_message: error.message,
      error_stack: error.stack,
      symbol: symbol,
      news_count: newsData?.length || 0
    });
    return null;
  }
}

/**
 * GPT-OSS-120B validation for uncertain DistilBERT results (DEPRECATED - keeping for fallback)
 */
async function getGPTValidation(symbol, newsData, primarySentiment, env) {
  try {
    console.log(`   🔍 Starting GPT-OSS-120B validation for ${symbol}...`);

    // Prepare context for GPT-OSS-120B
    const newsContext = newsData
      .slice(0, 5) // Top 5 news items
      .map((item, i) => `${i+1}. ${item.title}\n   ${item.summary || ''}`)
      .join('\n\n');

    console.log(`   📰 Validation processing ${newsData.length} news items (showing top 5)`);
    console.log(`   🎯 Primary sentiment to validate: ${primarySentiment.label} (${(primarySentiment.confidence * 100).toFixed(1)}%)`);

    const instructions = "You are a financial sentiment analyst specializing in validation. Provide precise, actionable sentiment validation in JSON format only.";

    const input = `Validate sentiment analysis for ${symbol} stock. DistilBERT is uncertain.

${newsContext}

DistilBERT result: ${primarySentiment.label} (${(primarySentiment.confidence * 100).toFixed(1)}% confidence)

Provide your independent validation in this exact JSON format:
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": 0.80,
  "agrees_with_primary": true,
  "reasoning": "Brief explanation for validation decision",
  "key_disagreements": ["reason1", "reason2"],
  "validation_strength": "strong|moderate|weak"
}

Focus on confirming or correcting the primary analysis.`;

    // Try multiple API formats for GPT-OSS-120B validation
    console.log(`   🔧 Testing GPT-OSS-120B validation API formats...`);

    let response;
    let apiParams;
    let formatUsed;

    try {
      // Format 1: instructions + input (as documented)
      apiParams = {
        instructions: instructions,
        input: input,
        max_tokens: 300,
        temperature: 0.1
      };

      console.log(`   📡 Validation Format 1 (instructions + input):`, {
        model: CLOUDFLARE_AI_CONFIG.models.reasoning,
        instructions_length: instructions.length,
        input_length: input.length,
        max_tokens: apiParams.max_tokens
      });

      response = await env.AI.run(
        CLOUDFLARE_AI_CONFIG.models.reasoning,
        apiParams
      );
      formatUsed = 'instructions_input';

    } catch (format1Error) {
      console.log(`   ⚠️ Validation Format 1 failed:`, format1Error.message);

      try {
        // Format 2: Just input (simple format)
        apiParams = {
          input: `${instructions}\n\n${input}`,
          max_tokens: 300,
          temperature: 0.1
        };

        console.log(`   📡 Validation Format 2 (input only):`, {
          input_length: apiParams.input.length,
          max_tokens: apiParams.max_tokens
        });

        response = await env.AI.run(
          CLOUDFLARE_AI_CONFIG.models.reasoning,
          apiParams
        );
        formatUsed = 'input_only';

      } catch (format2Error) {
        console.log(`   ⚠️ Validation Format 2 failed:`, format2Error.message);

        // Format 3: requests array format
        apiParams = {
          requests: [{
            input: input,
            instructions: instructions,
            max_tokens: 300,
            temperature: 0.1
          }]
        };

        console.log(`   📡 Validation Format 3 (requests array)`);

        response = await env.AI.run(
          CLOUDFLARE_AI_CONFIG.models.reasoning,
          apiParams
        );
        formatUsed = 'requests_array';
      }
    }

    console.log(`   ✅ GPT-OSS-120B validation response received using ${formatUsed}:`, {
      format_used: formatUsed,
      response_type: typeof response,
      response_keys: Object.keys(response || {}),
      response_length: response?.response?.length || 0,
      response_preview: response?.response?.substring(0, 200) + '...'
    });

    // Parse the response
    let analysisData;
    try {
      // Check response structure
      const responseText = response?.response || response?.text || response;
      if (!responseText) {
        throw new Error('No response text found in validation API response');
      }

      console.log(`   🔍 Validation response text to parse:`, responseText.substring(0, 300) + '...');

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log(`   📋 Validation JSON match found:`, jsonMatch[0].substring(0, 150) + '...');
        analysisData = JSON.parse(jsonMatch[0]);
        console.log(`   ✅ Validation JSON parsed successfully:`, analysisData);
      } else {
        throw new Error('No JSON found in validation response');
      }
    } catch (parseError) {
      console.error('   ❌ Failed to parse GPT-OSS-120B validation JSON response:', {
        error: parseError.message,
        response_preview: response?.response?.substring(0, 300) || 'No response text',
        response_structure: response
      });
      return null;
    }

    const result = {
      ...analysisData,
      model: 'gpt-oss-120b',
      validation_type: 'gpt_validation',
      cost_estimate: calculateGPTCost(input.length, response.response?.length || 0),
      validation_debug: {
        format_used: formatUsed,
        primary_sentiment: primarySentiment.label,
        primary_confidence: primarySentiment.confidence,
        validation_success: true,
        api_params_used: apiParams
      }
    };

    console.log(`   🎯 Final GPT validation result:`, {
      sentiment: result.sentiment,
      confidence: result.confidence,
      agrees_with_primary: result.agrees_with_primary,
      validation_strength: result.validation_strength,
      cost_estimate: result.cost_estimate
    });

    return result;

  } catch (error) {
    console.error('   ❌ GPT validation failed:', {
      error_message: error.message,
      error_stack: error.stack,
      symbol: symbol,
      primary_sentiment: primarySentiment?.label,
      news_count: newsData?.length || 0
    });
    return null;
  }
}

/**
 * Resolve sentiment using validation approach
 */
function resolveWithValidation(primarySentiment, validationResult) {
  if (!validationResult) {
    return primarySentiment;
  }

  // Check agreement between DistilBERT and GPT-OSS-120B
  const primaryLabel = primarySentiment.label;
  const validationLabel = validationResult.sentiment;
  const agreementDetected = validationResult.agrees_with_primary ||
    (primaryLabel === validationLabel) ||
    (primaryLabel === 'bullish' && validationLabel === 'bullish') ||
    (primaryLabel === 'bearish' && validationLabel === 'bearish');

  if (agreementDetected) {
    // Agreement: Boost confidence
    const boostedConfidence = Math.min(0.90, Math.max(primarySentiment.confidence, validationResult.confidence) + 0.15);

    return {
      sentiment: validationResult.sentiment,
      confidence: boostedConfidence,
      score: validationResult.sentiment === 'bullish' ? boostedConfidence :
             validationResult.sentiment === 'bearish' ? -boostedConfidence : 0,
      reasoning: `Validated: ${validationResult.reasoning} (Models agree: DistilBERT + GPT-OSS-120B)`,
      resolution_method: 'validation_agreement',
      agreement_detected: true,
      confidence_boost: 0.15
    };
  } else {
    // Disagreement: Conservative neutral approach
    console.log(`   ⚠️ Model disagreement: DistilBERT=${primaryLabel}, GPT=${validationLabel}`);

    return {
      sentiment: 'neutral',
      confidence: 0.50,
      score: 0,
      reasoning: `Model disagreement detected (DistilBERT: ${primaryLabel}, GPT: ${validationLabel}). Using conservative neutral.`,
      resolution_method: 'validation_disagreement',
      agreement_detected: false,
      disagreement_details: {
        distilbert: primaryLabel,
        gpt: validationLabel,
        key_disagreements: validationResult.key_disagreements || []
      }
    };
  }
}

/**
 * Calculate estimated cost for direct GPT usage
 */
function calculateCostEstimate(newsCount, usedGPT = true) {
  // Direct GPT-OSS-120B cost only (no DistilBERT)
  if (usedGPT) {
    // GPT-OSS-120B cost: $0.35 input + $0.75 output per M tokens
    const avgTokensPerNews = 120; // More detailed analysis per news item
    const basePromptTokens = 300; // System prompt + instructions
    const gptInputTokens = basePromptTokens + (newsCount * avgTokensPerNews);
    const gptOutputTokens = 300; // Detailed JSON response

    const inputCost = (gptInputTokens / 1000000) * 0.35;
    const outputCost = (gptOutputTokens / 1000000) * 0.75;
    const totalCost = inputCost + outputCost;

    return {
      input_tokens: gptInputTokens,
      output_tokens: gptOutputTokens,
      input_cost: inputCost,
      output_cost: outputCost,
      total_cost: totalCost,
      neurons_estimate: Math.ceil((gptInputTokens + gptOutputTokens) / 100) // Rough neurons estimate
    };
  }

  return {
    total_cost: 0,
    neurons_estimate: 0
  };
}

function calculateGPTCost(inputLength, outputLength) {
  const inputTokens = Math.ceil(inputLength / 4); // Rough token estimate
  const outputTokens = Math.ceil(outputLength / 4);

  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    input_cost: (inputTokens / 1000000) * 0.35,
    output_cost: (outputTokens / 1000000) * 0.75,
    total_cost: (inputTokens / 1000000) * 0.35 + (outputTokens / 1000000) * 0.75
  };
}

/**
 * Integrate Cloudflare AI sentiment with technical analysis
 */
async function generateCloudflareAIHybrid(symbol, technicalSignal, newsData, env) {
  // Get Cloudflare AI sentiment analysis
  const sentimentSignal = await getCloudflareAISentiment(symbol, newsData, env);

  // Combine with technical analysis
  const hybridSignal = combineSignalsCloudflareAI(technicalSignal, sentimentSignal, symbol);

  return hybridSignal;
}

/**
 * Combine technical and Cloudflare AI sentiment signals
 */
function combineSignalsCloudflareAI(technicalSignal, sentimentSignal, symbol) {
  // Weight allocation based on sentiment confidence
  let TECHNICAL_WEIGHT = 0.65;
  let SENTIMENT_WEIGHT = 0.35;

  // Increase sentiment weight if high confidence and detailed analysis available
  if (sentimentSignal.confidence > 0.8 && sentimentSignal.detailed_analysis) {
    TECHNICAL_WEIGHT = 0.55;
    SENTIMENT_WEIGHT = 0.45;
  }

  // Convert signals to scores
  const technicalScore = mapDirectionToScore(technicalSignal.direction);
  const sentimentScore = sentimentSignal.score || 0;

  // Calculate weighted prediction
  const combinedScore = (technicalScore * TECHNICAL_WEIGHT) + (sentimentScore * SENTIMENT_WEIGHT);
  const combinedDirection = combinedScore > 0.1 ? 'UP' : combinedScore < -0.1 ? 'DOWN' : 'FLAT';

  // Calculate hybrid confidence
  const technicalConfidence = technicalSignal.confidence || 0.5;
  const sentimentConfidence = sentimentSignal.confidence || 0.3;
  const hybridConfidence = (technicalConfidence * TECHNICAL_WEIGHT) + (sentimentConfidence * SENTIMENT_WEIGHT);

  return {
    symbol: symbol,
    hybrid_prediction: {
      direction: combinedDirection,
      confidence: hybridConfidence,
      combined_score: combinedScore,
      reasoning: `Technical: ${technicalSignal.direction} (${(technicalConfidence*100).toFixed(1)}%), AI Sentiment: ${sentimentSignal.sentiment} (${(sentimentConfidence*100).toFixed(1)}%) using ${sentimentSignal.models_used?.join(' + ')}`
    },
    technical_component: {
      direction: technicalSignal.direction,
      confidence: technicalConfidence,
      weight: TECHNICAL_WEIGHT
    },
    sentiment_component: {
      direction: sentimentSignal.sentiment,
      confidence: sentimentConfidence,
      weight: SENTIMENT_WEIGHT,
      reasoning: sentimentSignal.reasoning,
      models_used: sentimentSignal.models_used,
      cost_estimate: sentimentSignal.cost_estimate
    },
    cloudflare_ai: {
      detailed_analysis: sentimentSignal.detailed_analysis,
      quick_sentiments: sentimentSignal.quick_sentiments,
      cost_estimate: sentimentSignal.cost_estimate
    },
    timestamp: new Date().toISOString()
  };
}

function mapDirectionToScore(direction) {
  const mapping = {
    'UP': 0.8,
    'DOWN': -0.8,
    'FLAT': 0.0,
    'NEUTRAL': 0.0
  };
  return mapping[direction?.toUpperCase()] || 0.0;
}

/**
 * Complete sentiment analysis pipeline for integration
 */
async function runCloudflareAISentimentAnalysis(symbol, env) {
  try {
    // 1. Get news data (using free APIs)
    const newsData = await getFreeStockNews(symbol, env);

    // 2. Analyze with Cloudflare AI
    const sentimentResult = await getCloudflareAISentiment(symbol, newsData, env);

    return sentimentResult;

  } catch (error) {
    console.error(`Cloudflare AI sentiment analysis failed for ${symbol}:`, error);
    return {
      symbol: symbol,
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'Analysis pipeline failed',
      source: 'cloudflare_ai_error'
    };
  }
}

// Helper function to get free news - use imported function
async function getFreeStockNews(symbol, env) {
  return await getNewsData(symbol, env);
}

// Export for Cloudflare Workers
export {
  getCloudflareAISentiment,
  generateCloudflareAIHybrid,
  runCloudflareAISentimentAnalysis,
  CLOUDFLARE_AI_CONFIG
};