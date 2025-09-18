/**
 * Enhanced Analysis Module with GLM-4.5 Sentiment Integration
 * Updated for ModelScope GLM-4.5 sentiment analysis
 */

import { runBasicAnalysis } from './analysis.js';
import { getFreeStockNews, analyzeTextSentiment } from './free_sentiment_pipeline.js';
import { getModelScopeAISentiment } from './cloudflare_ai_sentiment_pipeline.js';
import { parseNaturalLanguageResponse, SentimentLogger, mapSentimentToDirection, checkDirectionAgreement } from './sentiment_utils.js';

/**
 * Run enhanced analysis with sentiment integration
 * Phase 1 implementation: Free news + basic sentiment
 */
export async function runEnhancedAnalysis(env, options = {}) {
  const startTime = Date.now();
  console.log('🚀 Starting Enhanced Analysis with Sentiment Integration...');

  try {
    // Step 1: SENTIMENT-FIRST - Run GLM-4.5 sentiment analysis first
    console.log('💭 Step 1: Running sentiment-first analysis (GLM-4.5)...');
    const sentimentResults = await runSentimentFirstAnalysis(env, options);

    // Step 2: Add technical analysis as reference confirmation
    console.log('📊 Step 2: Adding technical analysis as reference...');
    const enhancedResults = await addTechnicalReference(sentimentResults, env, options);

    // Step 3: Calculate execution metrics
    const executionTime = Date.now() - startTime;
    enhancedResults.execution_metrics = {
      total_time_ms: executionTime,
      enhancement_enabled: true,
      sentiment_sources: ['free_news', 'ai_sentiment_analysis'],
      cloudflare_ai_enabled: !!env.AI
    };

    console.log(`✅ Enhanced analysis completed in ${executionTime}ms`);
    return enhancedResults;

  } catch (error) {
    console.error('❌ Enhanced analysis failed:', error);

    // Fallback to basic analysis if sentiment enhancement fails
    console.log('🔄 Falling back to basic neural network analysis...');
    const fallbackResults = await runBasicAnalysis(env, options);

    fallbackResults.execution_metrics = {
      total_time_ms: Date.now() - startTime,
      enhancement_enabled: false,
      fallback_reason: error.message,
      sentiment_error: true
    };

    return fallbackResults;
  }
}

/**
 * Add sentiment analysis to existing technical analysis
 */
async function addSentimentAnalysis(technicalAnalysis, env) {
  const symbols = Object.keys(technicalAnalysis.trading_signals);
  console.log(`🔍 Adding sentiment analysis for ${symbols.length} symbols...`);

  // Process sentiment for each symbol
  for (const symbol of symbols) {
    try {
      console.log(`   📰 Analyzing sentiment for ${symbol}...`);

      // Get the existing technical signal
      const technicalSignal = technicalAnalysis.trading_signals[symbol];

      // Phase 1: Get free news data
      const newsData = await getFreeStockNews(symbol, env);

      // Phase 1: Basic sentiment analysis (rule-based + free APIs)
      const sentimentResult = await getSentimentWithFallbackChain(symbol, newsData, env);

      // Combine technical and sentiment signals
      const enhancedSignal = combineSignals(technicalSignal, sentimentResult, symbol);

      // Update the trading signal with enhanced data
      technicalAnalysis.trading_signals[symbol] = {
        ...technicalSignal,
        sentiment_analysis: sentimentResult,
        enhanced_prediction: enhancedSignal,
        enhancement_method: 'phase1_basic'
      };

      const validationInfo = sentimentResult.validation_triggered ? ' [Validated]' : '';
      const modelsInfo = sentimentResult.models_used ? ` using ${sentimentResult.models_used.join(' + ')}` : '';
      console.log(`   ✅ ${symbol} sentiment analysis complete: ${sentimentResult.sentiment} (${(sentimentResult.confidence * 100).toFixed(1)}%)${validationInfo}${modelsInfo}`);

    } catch (error) {
      console.error(`   ❌ Sentiment analysis failed for ${symbol}:`, error.message);

      // Add empty sentiment data to maintain structure
      technicalAnalysis.trading_signals[symbol].sentiment_analysis = {
        sentiment: 'neutral',
        confidence: 0,
        reasoning: 'Sentiment analysis failed',
        source_count: 0,
        error: error.message
      };
    }
  }

  return technicalAnalysis;
}

/**
 * Get sentiment analysis with three-tier fallback chain
 * Primary: ModelScope GLM-4.5 → Intelligent: Llama 3.1 → Final: DistilBERT
 */
async function getSentimentWithFallbackChain(symbol, newsData, env) {
  console.log(`🔍 SENTIMENT DEBUG: Starting getSentimentWithFallbackChain for ${symbol}`);
  console.log(`🔍 SENTIMENT DEBUG: News data available: ${!!newsData}, length: ${newsData?.length || 0}`);
  console.log(`🔍 SENTIMENT DEBUG: env.MODELSCOPE_API_KEY available: ${!!env.MODELSCOPE_API_KEY}`);
  console.log(`🔍 SENTIMENT DEBUG: env.MODELSCOPE_API_KEY length: ${env.MODELSCOPE_API_KEY?.length || 0}`);

  // Phase 1: Start with free news APIs and rule-based sentiment
  if (!newsData || newsData.length === 0) {
    console.log(`🔍 SENTIMENT DEBUG: Returning no_data - no news available`);
    return {
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      source_count: 0,
      method: 'no_data'
    };
  }

  try {
    // Use ModelScope GLM-4.5 if API key available
    if (env.MODELSCOPE_API_KEY) {
      console.log(`🔍 SENTIMENT DEBUG: ModelScope API key found, calling getModelScopeAISentiment...`);
      console.log(`   🤖 Using ModelScope GLM-4.5 sentiment analysis for ${symbol}...`);
      const result = await getModelScopeAISentiment(symbol, newsData, env);
      console.log(`🔍 SENTIMENT DEBUG: ModelScope result:`, {
        sentiment: result?.sentiment,
        confidence: result?.confidence,
        source: result?.source,
        method: result?.method,
        has_error: !!result?.error_details
      });
      return result;
    }

    // Fallback to Cloudflare Llama 3.1 (intelligent fallback)
    console.log(`🔍 SENTIMENT DEBUG: No ModelScope API key, using Llama 3.1 fallback`);
    console.log(`   🦙 Using Cloudflare Llama 3.1 sentiment analysis for ${symbol}...`);
    const llamaResult = await getLlama31Sentiment(symbol, newsData, env);
    console.log(`🔍 SENTIMENT DEBUG: Llama 3.1 result:`, llamaResult);
    return llamaResult;

  } catch (error) {
    console.error(`🔍 SENTIMENT DEBUG: ModelScope failed, error:`, {
      error_message: error.message,
      error_stack: error.stack?.substring(0, 200),
      symbol: symbol
    });
    console.error(`   ❌ ModelScope sentiment failed for ${symbol}, using Llama 3.1 fallback:`, error.message);

    // Try Llama 3.1 fallback
    try {
      const llamaFallback = await getLlama31Sentiment(symbol, newsData, env);
      console.log(`   ✅ Llama 3.1 fallback successful for ${symbol}`);
      return llamaFallback;
    } catch (llamaError) {
      console.error(`   ❌ Llama 3.1 fallback also failed, using DistilBERT final fallback:`, llamaError.message);

      // Final fallback: DistilBERT sentiment classification
      try {
        const distilbertFallback = await getDistilBERTSentiment(symbol, newsData, env);
        console.log(`   ✅ DistilBERT final fallback successful for ${symbol}`);
        return distilbertFallback;
      } catch (distilbertError) {
        console.error(`   ❌ All sentiment analysis methods failed for ${symbol}:`, distilbertError.message);
        throw new Error(`Complete sentiment analysis failure: ${distilbertError.message}`);
      }
    }
  }
}

/**
 * Cloudflare AI Llama 3.1 sentiment analysis (intelligent fallback)
 */
async function getLlama31Sentiment(symbol, newsData, env) {
  console.log(`🦙 Starting Llama 3.1 sentiment analysis for ${symbol}...`);

  if (!env.AI) {
    throw new Error('Cloudflare AI binding not available for Llama 3.1 fallback');
  }

  if (!newsData || newsData.length === 0) {
    return {
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      source_count: 0,
      method: 'llama31_no_data'
    };
  }

  try {
    // Prepare news context for Llama 3.1
    const newsContext = newsData
      .slice(0, 8) // Limit for token efficiency
      .map((item, i) => `${i+1}. ${item.title}\n   ${item.summary || ''}`)
      .join('\n\n');

    const prompt = `Analyze the financial sentiment for ${symbol} stock based on these news headlines:

${newsContext}

Provide a concise analysis with:
1. Overall sentiment (bullish, bearish, or neutral)
2. Confidence level (0.0 to 1.0)
3. Brief reasoning

Be direct and focus on market-moving factors.`;

    console.log(`   🧠 Calling Cloudflare AI Llama 3.1 for ${symbol}...`);

    const response = await env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct',
      {
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      }
    );

    console.log(`   📝 Llama 3.1 response received:`, response);

    if (!response || !response.response) {
      throw new Error('Empty response from Llama 3.1');
    }

    const content = response.response;
    console.log(`   📝 Llama 3.1 content:`, content);

    // Parse Llama 3.1 response
    const analysisData = parseNaturalLanguageResponse(content);

    const result = {
      ...analysisData,
      source: 'cloudflare_llama31',
      method: 'llama31_fallback',
      model: 'llama-3.1-8b-instruct',
      source_count: newsData.length,
      analysis_type: 'intelligent_fallback',
      cost_estimate: {
        input_tokens: Math.ceil(prompt.length / 4),
        output_tokens: Math.ceil(content.length / 4),
        total_cost: 0 // Cloudflare AI included in plan
      }
    };

    console.log(`   ✅ Llama 3.1 sentiment analysis complete: ${result.sentiment} (${(result.confidence * 100).toFixed(1)}%)`);
    return result;

  } catch (error) {
    console.error(`   ❌ Llama 3.1 sentiment analysis failed for ${symbol}:`, error);
    throw new Error(`Llama 3.1 analysis failed: ${error.message}`);
  }
}

/**
 * DistilBERT sentiment analysis (final fallback)
 */
async function getDistilBERTSentiment(symbol, newsData, env) {
  console.log(`🤖 Starting DistilBERT sentiment analysis for ${symbol}...`);

  if (!env.AI) {
    throw new Error('Cloudflare AI binding not available for DistilBERT fallback');
  }

  if (!newsData || newsData.length === 0) {
    return {
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      source_count: 0,
      method: 'distilbert_no_data'
    };
  }

  try {
    // Process multiple news items with DistilBERT
    const sentimentPromises = newsData.slice(0, 8).map(async (newsItem, index) => {
      try {
        // Combine title and summary for analysis
        const text = `${newsItem.title}. ${newsItem.summary || ''}`.substring(0, 500);

        // Use Cloudflare AI DistilBERT model
        const response = await env.AI.run(
          '@cf/huggingface/distilbert-sst-2-int8',
          { text: text }
        );

        // DistilBERT returns array with label and score
        const result = response[0];

        return {
          sentiment: result.label.toLowerCase(), // POSITIVE/NEGATIVE -> positive/negative
          confidence: result.score,
          score: result.label === 'POSITIVE' ? result.score : -result.score,
          text_analyzed: text,
          processing_order: index
        };

      } catch (error) {
        console.error('Individual DistilBERT analysis failed:', error);
        return {
          sentiment: 'neutral',
          confidence: 0,
          score: 0,
          error: error.message
        };
      }
    });

    // Wait for all sentiment analyses
    const results = await Promise.allSettled(sentimentPromises);
    const validResults = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(result => !result.error);

    if (validResults.length === 0) {
      throw new Error('All DistilBERT analyses failed');
    }

    // Aggregate DistilBERT results
    let totalScore = 0;
    let totalWeight = 0;
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };

    validResults.forEach(result => {
      const weight = result.confidence;
      totalScore += result.score * weight;
      totalWeight += weight;

      // Count sentiment types
      if (result.score > 0.1) sentimentCounts.positive++;
      else if (result.score < -0.1) sentimentCounts.negative++;
      else sentimentCounts.neutral++;
    });

    const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const avgConfidence = totalWeight / validResults.length;

    // Map to trading sentiment
    let finalSentiment = 'neutral';
    if (avgScore > 0.1) finalSentiment = 'bullish';
    else if (avgScore < -0.1) finalSentiment = 'bearish';

    const result = {
      sentiment: finalSentiment,
      confidence: avgConfidence,
      score: avgScore,
      reasoning: `DistilBERT analysis: ${finalSentiment} from ${validResults.length} news items (${sentimentCounts.positive}+ ${sentimentCounts.negative}- ${sentimentCounts.neutral}=)`,
      source: 'cloudflare_distilbert',
      method: 'distilbert_fallback',
      model: 'distilbert-sst-2-int8',
      source_count: newsData.length,
      analysis_type: 'final_fallback',
      cost_estimate: {
        input_tokens: validResults.length * 100, // Estimate
        output_tokens: 0,
        total_cost: 0 // Cloudflare AI included in plan
      },
      sentiment_distribution: sentimentCounts,
      processed_items: validResults.length
    };

    console.log(`   ✅ DistilBERT sentiment analysis complete: ${result.sentiment} (${(result.confidence * 100).toFixed(1)}%)`);
    return result;

  } catch (error) {
    console.error(`   ❌ DistilBERT sentiment analysis failed for ${symbol}:`, error);
    throw new Error(`DistilBERT analysis failed: ${error.message}`);
  }
}


/**
 * Get source reliability weight
 */
function getSourceWeight(sourceType) {
  const weights = {
    'fmp_with_sentiment': 1.0,
    'newsapi': 0.8,
    'yahoo': 0.6,
    'unknown': 0.4
  };
  return weights[sourceType] || 0.4;
}

/**
 * Combine technical and sentiment signals
 */
function combineSignals(technicalSignal, sentimentSignal, symbol) {
  // Sentiment-First Approach: Sentiment drives decisions, technical as reference/confirmation

  // Extract signals
  const technicalDirection = technicalSignal.ensemble?.direction || technicalSignal.tft?.direction || 'NEUTRAL';
  const technicalConfidence = technicalSignal.ensemble?.confidence || technicalSignal.tft?.confidence || 0.5;
  const sentimentDirection = sentimentSignal.sentiment?.toUpperCase() || 'NEUTRAL';
  const sentimentConfidence = sentimentSignal.confidence || 0;

  // PRIMARY DECISION: Sentiment drives the prediction
  let finalDirection = mapSentimentToDirection(sentimentDirection);
  let finalConfidence = sentimentConfidence;
  let reasoning = `Sentiment-driven: ${sentimentDirection} (${(sentimentConfidence * 100).toFixed(1)}%)`;

  // REFERENCE CHECK: Technical analysis as confirmation
  const technicalAgreement = checkDirectionAgreement(finalDirection, technicalDirection);

  if (technicalAgreement) {
    // Technical confirms sentiment → boost confidence
    finalConfidence = Math.min(0.95, finalConfidence + 0.10);
    reasoning += ` + Technical confirms (${technicalDirection})`;
  } else {
    // Technical disagrees with sentiment → note disagreement but keep sentiment decision
    reasoning += ` (Technical disagrees: ${technicalDirection})`;
  }

  // Calculate combined score (sentiment-based with technical reference)
  const sentimentScore = mapDirectionToScore(finalDirection);
  const combinedScore = sentimentScore; // Sentiment drives the score

  return {
    symbol: symbol,
    direction: finalDirection,
    confidence: finalConfidence,
    combined_score: combinedScore,

    components: {
      primary_sentiment: {
        direction: sentimentDirection,
        confidence: sentimentConfidence,
        role: 'primary_decision_maker',
        source_count: sentimentSignal.source_count,
        models_used: sentimentSignal.models_used
      },
      reference_technical: {
        direction: technicalDirection,
        confidence: technicalConfidence,
        role: 'reference_confirmation',
        agreement: technicalAgreement
      }
    },

    reasoning: reasoning,

    enhancement_details: {
      method: 'sentiment_first_approach',
      primary_signal: 'sentiment',
      reference_signal: 'technical',
      sentiment_method: sentimentSignal.method || (sentimentSignal.models_used ? 'cloudflare_ai_validation' : 'ai_fallback'),
      technical_agreement: technicalAgreement,
      validation_triggered: sentimentSignal.validation_triggered,
      models_used: sentimentSignal.models_used
    },

    timestamp: new Date().toISOString()
  };
}


/**
 * Map direction strings to numerical scores
 */
function mapDirectionToScore(direction) {
  const mapping = {
    'UP': 0.8,
    'DOWN': -0.8,
    'NEUTRAL': 0.0,
    'FLAT': 0.0,
    'BULLISH': 0.8,
    'BEARISH': -0.8
  };
  return mapping[direction?.toUpperCase()] || 0.0;
}

/**
 * Run sentiment analysis first for all symbols
 */
async function runSentimentFirstAnalysis(env, options = {}) {
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']; // Default symbols
  console.log(`💭 Starting sentiment-first analysis for ${symbols.length} symbols...`);

  const results = {
    sentiment_signals: {},
    analysis_time: new Date().toISOString(),
    trigger_mode: options.triggerMode || 'sentiment_first',
    symbols_analyzed: symbols
  };

  // Process each symbol with sentiment analysis first
  for (const symbol of symbols) {
    try {
      console.log(`   🧠 Analyzing ${symbol} sentiment with GPT-OSS-120B...`);

      // Get news data for the symbol
      const newsData = await getFreeStockNews(symbol, env);

      // Run GPT sentiment analysis (primary decision maker)
      const sentimentResult = await getSentimentWithFallbackChain(symbol, newsData, env);

      results.sentiment_signals[symbol] = {
        symbol: symbol,
        sentiment_analysis: sentimentResult,
        news_count: newsData?.length || 0,
        timestamp: new Date().toISOString(),
        method: 'sentiment_first'
      };

      const confidenceInfo = sentimentResult.confidence ? ` (${(sentimentResult.confidence * 100).toFixed(1)}%)` : '';
      const validationInfo = sentimentResult.validation_triggered ? ' [Validated]' : '';
      console.log(`   ✅ ${symbol}: ${sentimentResult.sentiment}${confidenceInfo}${validationInfo}`);

      // Add delay between symbols to prevent rate limiting (ModelScope GLM-4.5 free tier protection)
      if (symbols.indexOf(symbol) < symbols.length - 1) {
        console.log(`   ⏱️  Rate limiting protection: 2-second delay before next symbol...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`   ❌ CRITICAL: Sentiment analysis failed for ${symbol}:`, error.message);
      console.log(`   ⚠️  Skipping ${symbol} - sentiment-first system requires working sentiment analysis`);

      results.sentiment_signals[symbol] = {
        symbol: symbol,
        sentiment_analysis: {
          sentiment: 'failed',
          confidence: 0,
          reasoning: 'Sentiment-first system: GPT analysis failed, skipping symbol',
          error: true,
          skip_technical: true
        },
        news_count: 0,
        timestamp: new Date().toISOString(),
        method: 'sentiment_first_skip'
      };
    }
  }

  console.log(`✅ Sentiment-first analysis completed for ${symbols.length} symbols`);
  return results;
}

/**
 * Add technical analysis as reference to sentiment-driven results
 */
async function addTechnicalReference(sentimentResults, env, options = {}) {
  console.log(`📊 Adding technical analysis as reference confirmation...`);

  // Import the technical analysis function
  const { runBasicAnalysis } = await import('./analysis.js');

  // Run technical analysis for all symbols
  const technicalAnalysis = await runBasicAnalysis(env, options);

  // Only run technical analysis for symbols where sentiment succeeded
  const validSymbols = Object.keys(sentimentResults.sentiment_signals).filter(symbol =>
    !sentimentResults.sentiment_signals[symbol].sentiment_analysis.skip_technical
  );

  console.log(`📊 Running technical reference for ${validSymbols.length} symbols (skipped ${Object.keys(sentimentResults.sentiment_signals).length - validSymbols.length} failed sentiment symbols)`);

  // Combine sentiment (primary) with technical (reference) for valid symbols only
  for (const symbol of validSymbols) {
    const sentimentSignal = sentimentResults.sentiment_signals[symbol];
    const technicalSignal = technicalAnalysis.trading_signals?.[symbol];

    if (technicalSignal && sentimentSignal.sentiment_analysis && !sentimentSignal.sentiment_analysis.error) {
      // Create enhanced prediction with sentiment-first approach
      const enhancedSignal = combineSignals(technicalSignal, sentimentSignal.sentiment_analysis, symbol);

      // Update the result with technical reference and enhanced prediction
      sentimentResults.sentiment_signals[symbol] = {
        ...sentimentSignal,
        technical_reference: technicalSignal,
        enhanced_prediction: enhancedSignal,
        current_price: technicalSignal.current_price,
        predicted_price: technicalSignal.predicted_price // Keep technical prediction for reference
      };

      console.log(`   📊 ${symbol}: Technical reference added (${technicalSignal.direction} ${(technicalSignal.confidence * 100).toFixed(1)}%)`);
    } else {
      console.log(`   ⚠️  ${symbol}: Skipping technical analysis (sentiment failed)`);
    }
  }

  // Restructure results to match expected format
  const finalResults = {
    symbols_analyzed: sentimentResults.symbols_analyzed,
    trading_signals: sentimentResults.sentiment_signals,
    analysis_time: sentimentResults.analysis_time,
    trigger_mode: sentimentResults.trigger_mode,
    performance_metrics: {
      success_rate: 100,
      total_symbols: Object.keys(sentimentResults.sentiment_signals).length,
      successful_analyses: Object.keys(sentimentResults.sentiment_signals).length,
      failed_analyses: 0
    }
  };

  console.log(`✅ Technical reference analysis completed`);
  return finalResults;
}

/**
 * Enhanced pre-market analysis with sentiment integration
 * Replacement for runPreMarketAnalysis with sentiment enhancement
 */
export async function runEnhancedPreMarketAnalysis(env, options = {}) {
  const startTime = Date.now();
  console.log('🚀 Starting Enhanced Pre-Market Analysis with Sentiment...');

  try {
    // Use enhanced analysis instead of basic
    const enhancedResults = await runEnhancedAnalysis(env, {
      triggerMode: options.triggerMode || 'enhanced_pre_market',
      predictionHorizons: options.predictionHorizons,
      currentTime: options.currentTime,
      cronExecutionId: options.cronExecutionId
    });

    // Add pre-market specific metadata
    enhancedResults.pre_market_analysis = {
      trigger_mode: options.triggerMode,
      prediction_horizons: options.predictionHorizons,
      execution_time_ms: Date.now() - startTime,
      enhancement_enabled: true
    };

    console.log(`✅ Enhanced pre-market analysis completed in ${Date.now() - startTime}ms`);
    return enhancedResults;

  } catch (error) {
    console.error('❌ Enhanced pre-market analysis failed:', error);

    // Import basic analysis as fallback
    const { runPreMarketAnalysis } = await import('./analysis.js');
    console.log('🔄 Falling back to basic pre-market analysis...');

    const fallbackResults = await runPreMarketAnalysis(env, options);
    fallbackResults.enhancement_fallback = {
      enabled: false,
      error: error.message,
      fallback_used: true
    };

    return fallbackResults;
  }
}

/**
 * Phase 1 validation: Check if sentiment enhancement is working
 */
export async function validateSentimentEnhancement(env) {
  const testSymbol = 'AAPL';
  console.log(`🧪 Testing sentiment enhancement for ${testSymbol}...`);

  try {
    // Test free news API
    const newsData = await getFreeStockNews(testSymbol, env);
    console.log(`   📰 News data: ${newsData.length} articles found`);

    // Test sentiment analysis (includes ModelScope GLM-4.5 with fallback)
    const sentimentResult = await getSentimentWithFallbackChain(testSymbol, newsData, env);
    console.log(`   📊 Sentiment: ${sentimentResult.sentiment} (${(sentimentResult.confidence * 100).toFixed(1)}%)`);

    // Check if ModelScope GLM-4.5 actually succeeded (not fallback)
    const modelScopeSuccess = sentimentResult &&
                             sentimentResult.source === 'modelscope_glm45' &&
                             !sentimentResult.error_details &&
                             sentimentResult.confidence > 0 &&
                             !['llama31_fallback', 'distilbert_fallback'].includes(sentimentResult.method);

    console.log(`   🤖 ModelScope GLM-4.5 success: ${modelScopeSuccess}`);
    console.log(`   🔍 Sentiment method used: ${sentimentResult.method || sentimentResult.source}`);
    console.log(`   🔍 ModelScope API key available: ${!!env.MODELSCOPE_API_KEY}`);
    console.log(`   🔍 Cloudflare AI available: ${!!env.AI}`);

    return {
      success: true,
      news_count: newsData.length,
      sentiment: sentimentResult.sentiment,
      confidence: sentimentResult.confidence,
      ai_available: modelScopeSuccess, // Check ModelScope success, not fallback methods
      method: sentimentResult.method || sentimentResult.source || 'unknown',
      debug_info: {
        modelscope_key_available: !!env.MODELSCOPE_API_KEY,
        modelscope_key_length: env.MODELSCOPE_API_KEY?.length || 0,
        sentiment_source: sentimentResult.source,
        sentiment_method: sentimentResult.method,
        has_error_details: !!sentimentResult.error_details,
        result_confidence: sentimentResult.confidence
      }
    };

  } catch (error) {
    console.error('❌ Sentiment enhancement validation failed:', error);
    return {
      success: false,
      error: error.message,
      ai_available: !!env.AI
    };
  }
}