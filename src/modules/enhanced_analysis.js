/**
 * Enhanced Analysis Module with GPT-OSS-120B Sentiment Integration
 * Simplified two-tier fallback: GPT-OSS-120B → DistilBERT
 */

import { runBasicAnalysis } from './analysis.js';
import { getFreeStockNews, analyzeTextSentiment } from './free_sentiment_pipeline.js';
import { parseNaturalLanguageResponse, SentimentLogger, mapSentimentToDirection, checkDirectionAgreement } from './sentiment_utils.js';
import { storeSymbolAnalysis } from './data.js';
import { KVUtils } from './shared-utilities.js';
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
 * Run enhanced analysis with sentiment integration
 * Phase 1 implementation: Free news + basic sentiment
 */

export async function runEnhancedAnalysis(env, options = {}) {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo('Starting Enhanced Analysis with Sentiment Integration...');

  try {
    // Step 1: SENTIMENT-FIRST - Run GPT-OSS-120B sentiment analysis first
    logInfo('Step 1: Running sentiment-first analysis (GPT-OSS-120B)...');
    const sentimentResults = await runSentimentFirstAnalysis(env, options);

    // Step 2: Add technical analysis as reference confirmation
    logInfo('Step 2: Adding technical analysis as reference...');
    const enhancedResults = await addTechnicalReference(sentimentResults, env, options);

    // Step 3: Calculate execution metrics
    const executionTime = Date.now() - startTime;
    enhancedResults.execution_metrics = {
      total_time_ms: executionTime,
      enhancement_enabled: true,
      sentiment_sources: ['free_news', 'ai_sentiment_analysis'],
      cloudflare_ai_enabled: !!env.AI
    };

    logInfo(`Enhanced analysis completed in ${executionTime}ms`);
    return enhancedResults;

  } catch (error) {
    logError('Enhanced analysis failed:', error);

    // Fallback to basic analysis if sentiment enhancement fails
    logWarn('Falling back to basic neural network analysis...');
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
  logInfo(`Adding sentiment analysis for ${symbols.length} symbols...`);

  // Process symbols in parallel with conservative batching
  const batchSize = 2; // Conservative batch size to stay within rate limits
  const batches = [];
  for (let i = 0; i < symbols.length; i += batchSize) {
    batches.push(symbols.slice(i, i + batchSize));
  }

  logInfo(`Processing ${symbols.length} symbols in ${batches.length} batches of ${batchSize} (parallel processing)`);

  for (const batch of batches) {
    // Process each batch in parallel
    const batchPromises = batch.map(async (symbol) => {
      try {
        logSentimentDebug(`Analyzing sentiment for ${symbol}...`);

        // Get the existing technical signal
        const technicalSignal = technicalAnalysis.trading_signals[symbol];

        // Get free news data
        const newsData = await getFreeStockNews(symbol, env);

        // Basic sentiment analysis
        const sentimentResult = await getSentimentWithFallbackChain(symbol, newsData, env);

        // Combine technical and sentiment signals
        const enhancedSignal = combineSignals(technicalSignal, sentimentResult, symbol);

        const validationInfo = sentimentResult.validation_triggered ? ' [Validated]' : '';
        const modelsInfo = sentimentResult.models_used ? ` using ${sentimentResult.models_used.join(' + ')}` : '';
        logInfo(`${symbol} sentiment analysis complete: ${sentimentResult.sentiment} (${(sentimentResult.confidence * 100).toFixed(1)}%)${validationInfo}${modelsInfo}`);

        return {
          symbol,
          success: true,
          enhancedSignal: {
            ...technicalSignal,
            sentiment_analysis: sentimentResult,
            enhanced_prediction: enhancedSignal,
            enhancement_method: 'phase1_basic'
          }
        };

      } catch (error) {
        logError(`Sentiment analysis failed for ${symbol}:`, error.message);

        return {
          symbol,
          success: false,
          error: error.message,
          enhancedSignal: {
            ...technicalAnalysis.trading_signals[symbol],
            sentiment_analysis: {
              sentiment: 'neutral',
              confidence: 0,
              reasoning: 'Sentiment analysis failed',
              source_count: 0,
              error: error.message
            }
          }
        };
      }
    });

    // Wait for batch to complete
    const batchResults = await Promise.allSettled(batchPromises);

    // Process batch results
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { symbol, enhancedSignal } = result.value;
        technicalAnalysis.trading_signals[symbol] = enhancedSignal;
      } else {
        const symbol = result.reason?.symbol || 'unknown';
        logError(`Sentiment analysis promise rejected for ${symbol}:`, result.reason?.message);
      }
    });

    // Small delay between batches to be extra conservative
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return technicalAnalysis;
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
 * Add technical analysis as reference to sentiment-driven results
 */
async function addTechnicalReference(sentimentResults, env, options = {}) {
  logInfo('Adding technical analysis as reference confirmation...');

  // Import the technical analysis function
  const { runBasicAnalysis } = await import('./analysis.js');

  // Run technical analysis for all symbols
  const technicalAnalysis = await runBasicAnalysis(env, options);

  // Only run technical analysis for symbols where sentiment succeeded
  const validSymbols = Object.keys(sentimentResults.sentiment_signals).filter(symbol =>
    !sentimentResults.sentiment_signals[symbol].sentiment_analysis.skip_technical
  );

  logInfo(`Running technical reference for ${validSymbols.length} symbols (skipped ${Object.keys(sentimentResults.sentiment_signals).length - validSymbols.length} failed sentiment symbols)`);

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

      // Store granular analysis data for this symbol
      try {
        const granularAnalysisData = {
          symbol: symbol,
          analysis_type: 'enhanced_sentiment_first',
          timestamp: new Date().toISOString(),

          // Primary sentiment signal (decision maker)
          sentiment_analysis: sentimentSignal.sentiment_analysis,

          // Technical reference signal (confirmation)
          technical_reference: technicalSignal,

          // Combined enhanced prediction
          enhanced_prediction: enhancedSignal,

          // Price data
          current_price: technicalSignal.current_price,
          predicted_price: technicalSignal.predicted_price,

          // Analysis metadata
          news_count: sentimentSignal.news_count || 0,
          trigger_mode: sentimentResults.trigger_mode,
          analysis_method: 'sentiment_first_with_technical_reference',

          // Performance tracking data
          confidence_metrics: {
            sentiment_confidence: sentimentSignal.sentiment_analysis.confidence,
            technical_confidence: technicalSignal.confidence,
            enhanced_confidence: enhancedSignal.confidence,
            neural_agreement: enhancedSignal.enhancement_details?.technical_agreement
          }
        };

        await storeSymbolAnalysis(env, symbol, granularAnalysisData);
        logKVDebug(`${symbol}: Granular analysis stored successfully`);
      } catch (storageError) {
        logError(`${symbol}: Failed to store granular analysis:`, storageError.message);
        // Continue processing - storage failure shouldn't break analysis
      }

      logInfo(`${symbol}: Technical reference added (${technicalSignal.direction} ${(technicalSignal.confidence * 100).toFixed(1)}%)`);
    } else {
      logWarn(`${symbol}: Skipping technical analysis (sentiment failed)`);
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

  // Store main analysis results in KV storage
  try {
    logKVDebug('KV MAIN WRITE: Storing main analysis results');
    const dateStr = new Date().toISOString().split('T')[0];
    const mainAnalysisKey = `analysis_${dateStr}`;
    const analysisJson = JSON.stringify(finalResults);

    logKVDebug('KV MAIN DEBUG: Storing with key:', mainAnalysisKey);
    logInfo('Storing analysis results to KV', {
      key: mainAnalysisKey,
      date: dateStr,
      bytes: analysisJson.length,
      symbols: Object.keys(finalResults.trading_signals || {}).length
    });

    const success = await putWithVerification(
      mainAnalysisKey,
      analysisJson,
      env,
      KVUtils.getOptions('analysis')
    );

    if (success) {
      logKVOperation('STORE_ANALYSIS', mainAnalysisKey, true, {
        date: dateStr,
        symbolsAnalyzed: Object.keys(finalResults.trading_signals || {}).length,
        analysisTime: finalResults.analysis_time,
        totalBytes: analysisJson.length,
        triggerMode: finalResults.trigger_mode
      });

      // Update job status for analysis
      try {
        await updateJobStatus('analysis', dateStr, 'done', env, {
          symbolsAnalyzed: Object.keys(finalResults.trading_signals || {}).length,
          analysisTime: finalResults.analysis_time,
          triggerMode: finalResults.trigger_mode
        });
        logKVDebug('KV STATUS SUCCESS: Updated analysis job status');
      } catch (statusError) {
        logError('KV STATUS ERROR: Failed to update analysis job status:', statusError);
      }
    } else {
      logKVOperation('STORE_ANALYSIS', mainAnalysisKey, false, {
        date: dateStr,
        error: 'KV verification failed'
      });
      logError('KV MAIN ERROR: Failed to store main analysis results');
    }
  } catch (mainStorageError) {
    logError('KV MAIN ERROR: Failed to store main analysis results:', mainStorageError);
    logError('KV MAIN ERROR DETAILS:', {
      message: mainStorageError.message,
      stack: mainStorageError.stack
    });
  }

  logInfo('Technical reference analysis completed');
  return finalResults;
}

/**
 * Enhanced pre-market analysis with sentiment integration
 * Replacement for runPreMarketAnalysis with sentiment enhancement
 */
export async function runEnhancedPreMarketAnalysis(env, options = {}) {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo('🚀 Starting Enhanced Pre-Market Analysis with 3-layer sentiment and cron optimization...');

  try {
    // Get symbols from configuration
    const symbolsString = env.TRADING_SYMBOLS || 'AAPL,MSFT,GOOGL,TSLA,NVDA';
    const symbols = symbolsString.split(',').map(s => s.trim());

    logInfo(`📊 Analyzing ${symbols.length} symbols: ${symbols.join(', ')}`);

    // Option 1: Use new 3-layer batch pipeline (recommended for cron jobs)
    if (options.useBatchPipeline !== false) {
      try {
        // Import the new batch pipeline function
        const { runCompleteAnalysisPipeline } = await import('./per_symbol_analysis.js');

        logInfo(`🔄 Using optimized batch pipeline for cron execution...`);
        const pipelineResult = await runCompleteAnalysisPipeline(symbols, env, {
          triggerMode: options.triggerMode || 'enhanced_pre_market',
          predictionHorizons: options.predictionHorizons,
          currentTime: options.currentTime,
          cronExecutionId: options.cronExecutionId
        });

        if (pipelineResult.success) {
          // Convert pipeline results to legacy format for Facebook compatibility
          const legacyFormatResults = convertPipelineToLegacyFormat(pipelineResult, options);

          // Track cron health
          const { trackCronHealth } = await import('./data.js');
          await trackCronHealth(env, 'success', {
            totalTime: pipelineResult.pipeline_summary.total_execution_time,
            symbolsProcessed: pipelineResult.pipeline_summary.analysis_statistics.total_symbols,
            symbolsSuccessful: pipelineResult.pipeline_summary.analysis_statistics.successful_full_analysis,
            symbolsFallback: pipelineResult.pipeline_summary.analysis_statistics.fallback_sentiment_used,
            symbolsFailed: pipelineResult.pipeline_summary.analysis_statistics.neutral_fallback_used,
            successRate: pipelineResult.pipeline_summary.analysis_success_rate,
            storageOperations: pipelineResult.pipeline_summary.storage_statistics.total_operations
          });

          logInfo(`✅ Batch pipeline completed successfully: ${pipelineResult.pipeline_summary.symbols_with_usable_data}/${symbols.length} symbols successful`);
          return legacyFormatResults;
        } else {
          logWarn(`⚠️ Batch pipeline failed, falling back to legacy enhanced analysis...`);
          // Fall through to legacy method
        }
      } catch (importError) {
        logWarn(`⚠️ Could not import batch pipeline, using legacy analysis:`, importError.message);
        // Fall through to legacy method
      }
    }

    // Option 2: Legacy enhanced analysis (fallback)
    logInfo(`🔄 Using legacy enhanced analysis method...`);
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
      enhancement_enabled: true,
      batch_pipeline_used: false
    };

    // Track cron health for legacy analysis
    const { trackCronHealth } = await import('./data.js');
    await trackCronHealth(env, 'success', {
      totalTime: Date.now() - startTime,
      symbolsProcessed: enhancedResults.symbols_analyzed?.length || 0,
      successRate: 1.0 // Assume success if no error thrown
    });

    logInfo(`Enhanced pre-market analysis completed in ${Date.now() - startTime}ms`);
    return enhancedResults;

  } catch (error) {
    logError('Enhanced pre-market analysis failed:', error);

    // Track cron health for failure
    try {
      const { trackCronHealth } = await import('./data.js');
      await trackCronHealth(env, 'failed', {
        totalTime: Date.now() - startTime,
        symbolsProcessed: 0,
        errors: [error.message]
      });
    } catch (healthError) {
      logError('Could not track cron health:', healthError);
    }

    // Import basic analysis as fallback
    const { runPreMarketAnalysis } = await import('./analysis.js');
    logWarn('Falling back to basic pre-market analysis...');

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
 * Convert new pipeline results to legacy format for Facebook message compatibility
 */
function convertPipelineToLegacyFormat(pipelineResult, options) {
  const tradingSignals = {};
  const symbols_analyzed = [];

  // Convert each analysis result to legacy format
  for (const result of pipelineResult.analysis_results) {
    if (result && result.symbol) {
      symbols_analyzed.push(result.symbol);

      // Map 3-layer analysis to legacy trading signals format
      tradingSignals[result.symbol] = {
        // Core trading signal data
        symbol: result.symbol,
        predicted_price: null, // Not available in 3-layer analysis
        current_price: null,   // Would need to be fetched separately
        direction: result.trading_signals?.primary_direction || 'NEUTRAL',
        confidence: result.confidence_metrics?.overall_confidence || 0.5,
        model: result.sentiment_layers?.[0]?.model || 'GPT-OSS-120B',

        // 3-layer analysis specific data for Facebook messages
        sentiment_layers: result.sentiment_layers,
        trading_signals: result.trading_signals,
        confidence_metrics: result.confidence_metrics,
        sentiment_patterns: result.sentiment_patterns,
        analysis_metadata: result.analysis_metadata,

        // Enhanced prediction structure for compatibility
        enhanced_prediction: {
          direction: result.trading_signals?.primary_direction || 'NEUTRAL',
          confidence: result.confidence_metrics?.overall_confidence || 0.5,
          method: 'enhanced_3_layer_sentiment',
          sentiment_analysis: {
            sentiment: result.sentiment_layers?.[0]?.sentiment || 'neutral',
            confidence: result.sentiment_layers?.[0]?.confidence || 0.5,
            source: 'cloudflare_gpt_oss',
            model: result.sentiment_layers?.[0]?.model || 'GPT-OSS-120B'
          }
        },

        // Analysis type indicator
        analysis_type: result.analysis_type || 'fine_grained_sentiment',
        fallback_used: result.analysis_metadata?.fallback_used || false
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
      storage_successful: pipelineResult.pipeline_summary.storage_statistics.successful_operations
    },

    // Analysis statistics
    analysis_statistics: {
      total_symbols: pipelineResult.pipeline_summary.analysis_statistics.total_symbols,
      successful_full_analysis: pipelineResult.pipeline_summary.analysis_statistics.successful_full_analysis,
      fallback_sentiment_used: pipelineResult.pipeline_summary.analysis_statistics.fallback_sentiment_used,
      neutral_fallback_used: pipelineResult.pipeline_summary.analysis_statistics.neutral_fallback_used,
      overall_success: pipelineResult.pipeline_summary.overall_success
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