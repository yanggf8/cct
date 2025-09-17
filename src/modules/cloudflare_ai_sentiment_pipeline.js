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

    // Advanced analysis (more expensive but powerful)
    reasoning: '@cf/openai/gpt-oss-120b', // $0.35/$0.75 per M tokens

    // Alternative models
    alternatives: {
      llama: '@cf/meta/llama-3.1-8b-instruct', // $0.027/$0.027 per M tokens
      mistral: '@cf/mistral/mistral-7b-instruct-v0.1' // Fast alternative
    }
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
 * Main Cloudflare AI sentiment analysis function with validation approach
 */
async function getCloudflareAISentiment(symbol, newsData, env) {
  if (!newsData || newsData.length === 0) {
    return {
      symbol: symbol,
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      source: 'cloudflare_ai',
      cost_estimate: { total_cost: 0, neurons_estimate: 0 }
    };
  }

  try {
    // 1. Primary sentiment analysis with DistilBERT (fast & cheap)
    const quickSentiments = await analyzeBatchSentiment(newsData, env);
    const primarySentiment = aggregateQuickSentiments(quickSentiments);

    console.log(`   🤖 DistilBERT sentiment: ${primarySentiment.label} (${(primarySentiment.confidence * 100).toFixed(1)}%)`);

    // 2. Validation logic: Use GPT-OSS-120B only when DistilBERT is uncertain
    let validationResult = null;
    let finalSentiment = primarySentiment;
    let modelsUsed = ['distilbert'];
    let costEstimate = calculateCostEstimate(newsData.length, false);

    if (primarySentiment.confidence < CLOUDFLARE_AI_CONFIG.sentiment_thresholds.needs_validation) {
      console.log(`   ⚠️  Low confidence (${(primarySentiment.confidence * 100).toFixed(1)}%), requesting GPT validation...`);

      validationResult = await getGPTValidation(symbol, newsData, primarySentiment, env);

      if (validationResult) {
        finalSentiment = resolveWithValidation(primarySentiment, validationResult);
        modelsUsed = ['distilbert', 'gpt-oss-120b'];
        costEstimate = calculateCostEstimate(newsData.length, true);

        console.log(`   ✅ Validation complete: ${finalSentiment.sentiment} (${(finalSentiment.confidence * 100).toFixed(1)}%)`);
      }
    } else {
      console.log(`   ✅ High confidence, using DistilBERT result directly`);
    }

    return {
      symbol: symbol,
      sentiment: finalSentiment.sentiment || finalSentiment.label,
      confidence: finalSentiment.confidence,
      score: finalSentiment.score,
      reasoning: finalSentiment.reasoning,

      // Validation details
      primary_sentiment: primarySentiment,
      validation_result: validationResult,
      validation_triggered: !!validationResult,

      // Technical details
      quick_sentiments: quickSentiments,
      source: 'cloudflare_ai_validation',
      models_used: modelsUsed,
      cost_estimate: costEstimate,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`   ❌ Cloudflare AI sentiment failed for ${symbol}:`, error);
    return {
      symbol: symbol,
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'AI analysis failed: ' + error.message,
      source: 'cloudflare_ai_error',
      cost_estimate: { total_cost: 0, neurons_estimate: 0 }
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
 * GPT-OSS-120B validation for uncertain DistilBERT results
 */
async function getGPTValidation(symbol, newsData, primarySentiment, env) {
  try {
    // Prepare context for GPT-OSS-120B
    const newsContext = newsData
      .slice(0, 5) // Top 5 news items
      .map((item, i) => `${i+1}. ${item.title}\n   ${item.summary || ''}`)
      .join('\n\n');

    const prompt = `Validate sentiment analysis for ${symbol} stock. DistilBERT is uncertain.

${newsContext}

DistilBERT result: ${primarySentiment.label} (${(primarySentiment.confidence * 100).toFixed(1)}% confidence)

As a validation expert, provide your independent analysis in JSON format:
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": 0.80,
  "agrees_with_primary": true,
  "reasoning": "Brief explanation for validation decision",
  "key_disagreements": ["reason1", "reason2"],
  "validation_strength": "strong|moderate|weak"
}

Focus on confirming or correcting the primary analysis.`;

    // Call GPT-OSS-120B for detailed analysis
    const response = await env.AI.run(
      CLOUDFLARE_AI_CONFIG.models.reasoning,
      {
        messages: [
          {
            role: 'system',
            content: 'You are a financial sentiment analyst. Provide precise, actionable sentiment analysis in JSON format only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.1 // Low temperature for consistent analysis
      }
    );

    // Parse the response
    let analysisData;
    try {
      // Extract JSON from response
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse GPT-OSS-120B JSON response:', parseError);
      return null;
    }

    return {
      ...analysisData,
      model: 'gpt-oss-120b',
      validation_type: 'gpt_validation',
      cost_estimate: calculateGPTCost(prompt.length, response.response.length)
    };

  } catch (error) {
    console.error('GPT validation failed:', error);
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
 * Calculate estimated cost for Cloudflare AI usage
 */
function calculateCostEstimate(newsCount, usedGPT) {
  // DistilBERT cost: $0.026 per M tokens
  const avgTokensPerNews = 100; // Estimated tokens per news item
  const distilbertTokens = newsCount * avgTokensPerNews;
  const distilbertCost = (distilbertTokens / 1000000) * 0.026;

  let gptCost = 0;
  if (usedGPT) {
    // GPT-OSS-120B cost: $0.35 input + $0.75 output per M tokens
    const gptInputTokens = 800; // Estimated prompt tokens
    const gptOutputTokens = 200; // Estimated response tokens
    gptCost = (gptInputTokens / 1000000) * 0.35 + (gptOutputTokens / 1000000) * 0.75;
  }

  return {
    distilbert_cost: distilbertCost,
    gpt_cost: gptCost,
    total_cost: distilbertCost + gptCost,
    neurons_estimate: Math.ceil((distilbertTokens + (usedGPT ? 1000 : 0)) / 100) // Rough neurons estimate
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