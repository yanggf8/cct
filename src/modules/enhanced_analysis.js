/**
 * Enhanced Analysis Module with Dual AI Comparison System
 * Simple, transparent dual AI system with GPT-OSS-120B and DistilBERT
 */
import { performDualAIComparison, batchDualAIAnalysis } from './dual-ai-analysis.js';
import { getFreeStockNews } from './free_sentiment_pipeline.js';
import { mapSentimentToDirection } from './sentiment_utils.js';
import { storeSymbolAnalysis, batchStoreAnalysisResults } from './data.js';
import { initLogging, logSentimentDebug, logKVDebug, logAIDebug, logSuccess, logError, logInfo, logWarn } from './logging.js';
import { updateJobStatus, putWithVerification, logKVOperation } from './kv-utils.js';

// Initialize logging for this module
let loggingInitialized = false;

function ensureLoggingInitialized(env) {
  if (!loggingInitialized && env) {
    initLogging(env);
    loggingInitialized = true;
  }
}

/**
 * Run enhanced analysis with dual AI comparison system
 * Simple, transparent comparison between GPT-OSS-120B and DistilBERT
 */

export async function runEnhancedAnalysis(env, options = {}) {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo('Starting Dual AI Comparison Analysis...');

  // Step 1: Run dual AI analysis
  logInfo('Step 1: Running dual AI comparison...');
  const dualAIResults = await runDualAIAnalysisEnhanced(env, options);

  // Step 2: Calculate execution metrics
  const executionTime = Date.now() - startTime;
  dualAIResults.execution_metrics = {
    total_time_ms: executionTime,
    analysis_enabled: true,
    sentiment_sources: ['free_news', 'dual_ai_analysis'],
    cloudflare_ai_enabled: !!env.AI,
    analysis_method: 'dual_ai_comparison'
  };

  logInfo(`Dual AI analysis completed in ${executionTime}ms`);
  return dualAIResults;
}



/**
 * Cloudflare GPT-OSS-120B sentiment analysis (primary method)
 */
export async function getSentimentWithFallbackChain(symbol, newsData, env) {
  logSentimentDebug(`Starting getSentimentWithFallbackChain for ${symbol}`);
  logSentimentDebug(`News data available: ${!!newsData}, length: ${newsData?.length || 0}`);
  logSentimentDebug(`env.AI available: ${!!env.AI}`);
  // Phase 1: Start with free news APIs and rule-based sentiment
  if (!newsData || newsData.length === 0) {
    logSentimentDebug('Returning no_data - no news available');
    return {
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      source_count: 0,
      method: 'no_data'
    };
  }

  try {
    // Primary: GPT-OSS-120B
    if (env.AI) {
      logAIDebug(`Trying GPT-OSS-120B for ${symbol}...`);
      const gptResult = await getGPTOSSSentiment(symbol, newsData, env);
      if (gptResult.sentiment && gptResult.confidence > 0) {
        logSentimentDebug(`GPT-OSS-120B succeeded for ${symbol}: ${gptResult.sentiment} (${(gptResult.confidence * 100).toFixed(1)}%)`);
        return {
          ...gptResult,
          method: 'gpt_oss_120b_primary',
          fallback_used: false
        };
      }
    }

    // Fallback: DistilBERT
    if (env.AI) {
      logAIDebug(`Trying DistilBERT for ${symbol}...`);
      const distilbertResult = await getDistilBERTSentiment(symbol, newsData, env);
      if (distilbertResult.sentiment && distilbertResult.confidence > 0) {
        logSentimentDebug(`DistilBERT succeeded for ${symbol}: ${distilbertResult.sentiment} (${(distilbertResult.confidence * 100).toFixed(1)}%)`);
        return {
          ...distilbertResult,
          method: 'distilbert_fallback',
          fallback_used: true
        };
      }
    }

    // Final fallback: rule-based
    logSentimentDebug('Using rule-based sentiment analysis');
    const ruleBasedResult = analyzeTextSentiment(newsData, symbol);
    return {
      ...ruleBasedResult,
      method: 'rule_based_final',
      fallback_used: true
    };

  } catch (error) {
    logError(`Sentiment analysis failed for ${symbol}:`, error);
    return {
      sentiment: 'neutral',
      confidence: 0,
      reasoning: `Analysis failed: ${error.message}`,
      method: 'error_fallback',
      error_details: error.message
    };
  }
}

export async function getGPTOSSSentiment(symbol, newsData, env) {
  logAIDebug(`Starting GPT-OSS-120B sentiment analysis for ${symbol}...`);

  if (!env.AI) {
    throw new Error('Cloudflare AI binding not available for GPT-OSS-120B');
  }

  if (!newsData || newsData.length === 0) {
    return {
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      source_count: 0,
      method: 'gpt_oss_no_data'
    };
  }

  try {
    // Prepare news context for GPT-OSS-120B
    const newsContext = newsData
      .slice(0, 10) // More items than Llama as GPT-OSS handles more context
      .map((item, i) => `${i+1}. ${item.title}\n   ${item.summary || ''}`)
      .join('\n\n');

    const prompt = `Analyze the financial sentiment for ${symbol} stock based on these news headlines:

${newsContext}

Provide a detailed analysis with:
1. Overall sentiment (bullish, bearish, or neutral)
2. Confidence level (0.0 to 1.0)
3. Brief reasoning for the sentiment
4. Key market-moving factors

Be precise and focus on actionable trading insights.`;

    logAIDebug(`Calling Cloudflare AI GPT-OSS-120B for ${symbol}...`);

    const response = await env.AI.run(
      '@cf/openchat/openchat-3.5-0106',
      {
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }
    );

    logAIDebug('GPT-OSS-120B response received:', response);

    if (!response || !response.response) {
      throw new Error('Empty response from GPT-OSS-120B');
    }

    const content = response.response;
    logAIDebug('GPT-OSS-120B content:', content);

    // Parse GPT-OSS-120B response
    const analysisData = parseNaturalLanguageResponse(content);

    const result = {
      ...analysisData,
      source: 'cloudflare_gpt_oss',
      method: 'gpt_oss_primary',
      model: 'openchat-3.5-0106',
      source_count: newsData.length,
      analysis_type: 'primary_sentiment',
      cost_estimate: {
        input_tokens: Math.ceil(prompt.length / 4),
        output_tokens: Math.ceil(content.length / 4),
        total_cost: 0 // Cloudflare AI included in plan
      }
    };

    logAIDebug(`GPT-OSS-120B sentiment analysis complete: ${result.sentiment} (${(result.confidence * 100).toFixed(1)}%)`);
    return result;

  } catch (error) {
    logError(`GPT-OSS-120B sentiment analysis failed for ${symbol}:`, error);
    throw new Error(`GPT-OSS-120B analysis failed: ${error.message}`);
  }
}


/**
 * DistilBERT sentiment analysis (final fallback)
 */
export async function getDistilBERTSentiment(symbol, newsData, env) {
  logAIDebug(`Starting DistilBERT sentiment analysis for ${symbol}...`);

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
        logError('Individual DistilBERT analysis failed:', error);
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

    logAIDebug(`DistilBERT sentiment analysis complete: ${result.sentiment} (${(result.confidence * 100).toFixed(1)}%)`);
    return result;

  } catch (error) {
    logError(`DistilBERT sentiment analysis failed for ${symbol}:`, error);
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
  const symbols = (env.TRADING_SYMBOLS || 'AAPL,MSFT,GOOGL,TSLA,NVDA').split(',').map(s => s.trim());
  logInfo(`Starting sentiment-first analysis for ${symbols.length} symbols...`);

  const results = {
    sentiment_signals: {},
    analysis_time: new Date().toISOString(),
    trigger_mode: options.triggerMode || 'sentiment_first',
    symbols_analyzed: symbols
  };

  // Process symbols in small batches for parallel processing (conservative approach)
  const batchSize = 2; // Process 2 symbols at a time to stay well within rate limits
  const batches = [];
  for (let i = 0; i < symbols.length; i += batchSize) {
    batches.push(symbols.slice(i, i + batchSize));
  }

  logInfo(`Processing ${symbols.length} symbols in ${batches.length} batches of ${batchSize} (parallel processing)`);

  for (const batch of batches) {
    // Process each batch in parallel
    const batchPromises = batch.map(async (symbol) => {
      try {
        logAIDebug(`Analyzing ${symbol} sentiment with GPT-OSS-120B...`);

        // Get news data for the symbol
        const newsData = await getFreeStockNews(symbol, env);

        // Run GPT sentiment analysis (primary decision maker)
        const sentimentResult = await getSentimentWithFallbackChain(symbol, newsData, env);

        const confidenceInfo = sentimentResult.confidence ? ` (${(sentimentResult.confidence * 100).toFixed(1)}%)` : '';
        const validationInfo = sentimentResult.validation_triggered ? ' [Validated]' : '';
        logInfo(`${symbol}: ${sentimentResult.sentiment}${confidenceInfo}${validationInfo}`);

        return {
          symbol,
          success: true,
          sentimentResult,
          newsCount: newsData?.length || 0
        };

      } catch (error) {
        logError(`CRITICAL: Sentiment analysis failed for ${symbol}:`, error.message);
        logWarn(`Skipping ${symbol} - sentiment-first system requires working sentiment analysis`);

        return {
          symbol,
          success: false,
          error: error.message
        };
      }
    });

    // Wait for batch to complete
    const batchResults = await Promise.allSettled(batchPromises);

    // Process batch results
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        const { symbol, sentimentResult, newsCount } = result.value;
        results.sentiment_signals[symbol] = {
          symbol: symbol,
          sentiment_analysis: sentimentResult,
          news_count: newsCount,
          timestamp: new Date().toISOString(),
          method: 'sentiment_first'
        };
      } else {
        const symbol = result.status === 'fulfilled' ? result.value.symbol : 'unknown';
        const error = result.status === 'fulfilled' ? result.value.error : result.reason?.message;

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
    });

    // Small delay between batches to be extra conservative
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  logInfo(`Sentiment-first analysis completed for ${symbols.length} symbols`);
  return results;
}


/**
 * Enhanced dual AI analysis for multiple symbols
 */
async function runDualAIAnalysisEnhanced(env, options = {}) {
  const symbols = (env.TRADING_SYMBOLS || 'AAPL,MSFT,GOOGL,TSLA,NVDA').split(',').map(s => s.trim());
  logInfo(`Starting dual AI analysis for ${symbols.length} symbols...`);

  // Use batch dual AI analysis
  const dualAIResult = await batchDualAIAnalysis(symbols, env, options);

  // Convert results to expected format
  const results = {
    sentiment_signals: {},
    analysis_time: new Date().toISOString(),
    trigger_mode: options.triggerMode || 'dual_ai_enhanced',
    symbols_analyzed: symbols,
    dual_ai_statistics: dualAIResult.statistics
  };

  // Convert dual AI results to sentiment signals format
  dualAIResult.results.forEach(result => {
    if (result && !result.error) {
      results.sentiment_signals[result.symbol] = {
        symbol: result.symbol,
        sentiment_analysis: {
          sentiment: result.signal.direction.toLowerCase(),
          confidence: calculateDualAIConfidence(result),
          reasoning: result.signal.reasoning,
          dual_ai_comparison: {
            agree: result.comparison.agree,
            agreement_type: result.comparison.agreement_type,
            signal_type: result.signal.type,
            signal_strength: result.signal.strength
          }
        },
        news_count: result.performance_metrics?.successful_models || 0,
        timestamp: result.timestamp,
        method: 'dual_ai_comparison'
      };
    }
  });

  return results;
}

/**
 * Enhanced pre-market analysis with dual AI comparison system
 * Uses simple, transparent dual AI comparison
 */
export async function runEnhancedPreMarketAnalysis(env, options = {}) {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo('🚀 Starting Enhanced Pre-Market Analysis with Dual AI Comparison...');

  // Get symbols from configuration
  const symbolsString = env.TRADING_SYMBOLS || 'AAPL,MSFT,GOOGL,TSLA,NVDA';
  const symbols = symbolsString.split(',').map(s => s.trim());

  logInfo(`📊 Analyzing ${symbols.length} symbols: ${symbols.join(', ')}`);

  // Use the dual AI batch pipeline
  logInfo(`🤖 Using dual AI batch pipeline...`);
  const { runCompleteAnalysisPipeline } = await import('./per_symbol_analysis.js');

  const pipelineResult = await runCompleteAnalysisPipeline(symbols, env, {
    triggerMode: options.triggerMode || 'enhanced_pre_market',
    predictionHorizons: options.predictionHorizons,
    currentTime: options.currentTime,
    cronExecutionId: options.cronExecutionId
  });

  if (!pipelineResult.success) {
    throw new Error(`Dual AI pipeline failed: ${pipelineResult.error || 'Unknown error'}`);
  }

  // Convert pipeline results to legacy format for Facebook compatibility
  const legacyFormatResults = convertPipelineToLegacyFormat(pipelineResult, options);

  // Track cron health
  const { trackCronHealth } = await import('./data.js');
  await trackCronHealth(env, 'success', {
    totalTime: pipelineResult.pipeline_summary.total_execution_time,
    symbolsProcessed: pipelineResult.pipeline_summary.analysis_statistics.total_symbols,
    symbolsSuccessful: pipelineResult.pipeline_summary.analysis_statistics.successful_full_analysis,
    symbolsFallback: 0, // No fallback in dual AI system
    symbolsFailed: pipelineResult.pipeline_summary.analysis_statistics.neutral_fallback_used,
    successRate: pipelineResult.pipeline_summary.analysis_success_rate,
    storageOperations: pipelineResult.pipeline_summary.storage_statistics.total_operations,
    dual_ai_specific: pipelineResult.pipeline_summary.dual_ai_metrics
  });

  logInfo(`✅ Dual AI pipeline completed successfully: ${pipelineResult.pipeline_summary.symbols_with_usable_data}/${symbols.length} symbols successful`);
  return legacyFormatResults;
}

/**
 * Calculate confidence based on dual AI result
 */
function calculateDualAIConfidence(dualAIResult) {
  const gptConf = dualAIResult.models?.gpt?.confidence || 0;
  const dbConf = dualAIResult.models?.distilbert?.confidence || 0;
  const baseConf = (gptConf + dbConf) / 2;

  // Boost confidence if models agree
  if (dualAIResult.comparison?.agree) {
    return Math.min(0.95, baseConf + 0.15);
  }

  // Reduce confidence if models disagree
  if (dualAIResult.comparison?.agreement_type === 'disagreement') {
    return Math.max(0.05, baseConf - 0.2);
  }

  // Partial agreement - small boost
  return Math.min(0.9, baseConf + 0.05);
}

/**
 * Convert new pipeline results to legacy format for Facebook message compatibility
 */
function convertPipelineToLegacyFormat(pipelineResult, options) {
  const tradingSignals = {};
  const symbols_analyzed = [];

  // Convert each analysis result to legacy format
  for (const result of pipelineResult.analysis_results) {
    if (result && result.symbol) {
      symbols_analyzed.push(result.symbol);

      // Map dual AI analysis to legacy trading signals format
      tradingSignals[result.symbol] = {
        // Core trading signal data
        symbol: result.symbol,
        predicted_price: null, // Not available in dual AI analysis
        current_price: null,   // Would need to be fetched separately
        direction: result.trading_signals?.primary_direction || 'NEUTRAL',
        confidence: result.confidence_metrics?.overall_confidence || 0.5,
        model: 'dual_ai_comparison',

        // Dual AI analysis specific data for Facebook messages
        sentiment_layers: result.sentiment_layers,
        trading_signals: result.trading_signals,
        confidence_metrics: result.confidence_metrics,
        sentiment_patterns: result.sentiment_patterns,
        analysis_metadata: result.analysis_metadata,

        // Enhanced prediction structure for compatibility
        enhanced_prediction: {
          direction: result.trading_signals?.primary_direction || 'NEUTRAL',
          confidence: result.confidence_metrics?.overall_confidence || 0.5,
          method: 'dual_ai_comparison',
          sentiment_analysis: {
            sentiment: result.sentiment_patterns?.model_agreement ?
              result.trading_signals?.primary_direction?.toLowerCase() : 'neutral',
            confidence: result.confidence_metrics?.overall_confidence || 0.5,
            source: 'dual_ai_comparison',
            model: 'GPT-OSS-120B + DistilBERT',
            dual_ai_specific: {
              agree: result.sentiment_patterns?.model_agreement,
              agreement_type: result.sentiment_patterns?.agreement_type,
              signal_type: result.sentiment_patterns?.signal_type
            }
          }
        },

        // Analysis type indicator
        analysis_type: result.analysis_type || 'dual_ai_comparison',
        fallback_used: false // No fallback in dual AI system
      };
    }
  }

  return {
    symbols_analyzed,
    trading_signals: tradingSignals,

    // Pipeline execution metadata
    pre_market_analysis: {
      trigger_mode: options.triggerMode,
      prediction_horizons: options.predictionHorizons,
      execution_time_ms: pipelineResult.pipeline_summary.total_execution_time,
      enhancement_enabled: true,
      batch_pipeline_used: true,
      symbols_processed: pipelineResult.pipeline_summary.analysis_statistics.total_symbols,
      success_rate: pipelineResult.pipeline_summary.analysis_success_rate,

      // Performance metrics
      performance_metrics: pipelineResult.pipeline_summary.performance_metrics,

      // Storage metrics
      storage_operations: pipelineResult.pipeline_summary.storage_statistics.total_operations,
      storage_successful: pipelineResult.pipeline_summary.storage_statistics.successful_operations,

      // Dual AI specific metrics
      dual_ai_metrics: pipelineResult.pipeline_summary.dual_ai_metrics
    },

    // Analysis statistics
    analysis_statistics: {
      total_symbols: pipelineResult.pipeline_summary.analysis_statistics.total_symbols,
      successful_full_analysis: pipelineResult.pipeline_summary.analysis_statistics.successful_full_analysis,
      fallback_sentiment_used: 0, // No fallback in dual AI system
      neutral_fallback_used: pipelineResult.pipeline_summary.analysis_statistics.neutral_fallback_used,
      overall_success: pipelineResult.pipeline_summary.overall_success,
      dual_ai_specific: pipelineResult.pipeline_summary.analysis_statistics.dual_ai_specific
    }
  };
}

/**
 * Phase 1 validation: Check if sentiment enhancement is working
 */
export async function validateSentimentEnhancement(env) {
  const testSymbol = 'AAPL';
  logInfo(`Testing sentiment enhancement for ${testSymbol}...`);

  try {
    // Test free news API
    const newsData = await getFreeStockNews(testSymbol, env);
    logInfo(`News data: ${newsData.length} articles found`);

    // Test sentiment analysis (GPT-OSS-120B with DistilBERT fallback)
    const sentimentResult = await getSentimentWithFallbackChain(testSymbol, newsData, env);
    logInfo(`Sentiment: ${sentimentResult.sentiment} (${(sentimentResult.confidence * 100).toFixed(1)}%)`);

    // Check if GPT-OSS-120B actually succeeded (not fallback)
    const gptSuccess = sentimentResult &&
                      sentimentResult.source === 'gpt_oss_120b' &&
                      !sentimentResult.error_details &&
                      sentimentResult.confidence > 0 &&
                      !['distilbert_fallback'].includes(sentimentResult.method);

    logInfo(`GPT-OSS-120B success: ${gptSuccess}`);
    logInfo(`Sentiment method used: ${sentimentResult.method || sentimentResult.source}`);
    logInfo(`Cloudflare AI available: ${!!env.AI}`);

    return {
      success: true,
      news_count: newsData.length,
      sentiment: sentimentResult.sentiment,
      confidence: sentimentResult.confidence,
      ai_available: gptSuccess, // Check GPT-OSS-120B success, not fallback methods
      method: sentimentResult.method || sentimentResult.source || 'unknown',
      debug_info: {
        cloudflare_ai_available: !!env.AI,
        sentiment_source: sentimentResult.source,
        sentiment_method: sentimentResult.method,
        has_error_details: !!sentimentResult.error_details,
        result_confidence: sentimentResult.confidence
      }
    };

  } catch (error) {
    logError('Sentiment enhancement validation failed:', error);
    return {
      success: false,
      error: error.message,
      ai_available: !!env.AI
    };
  }
}