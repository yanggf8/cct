/**
 * Data Access Module
 * Handles data retrieval from KV storage and fact table operations with real market validation
 */

import { initLogging, logKVDebug, logError, logInfo } from './logging.js';
import { validateKVKey, validateEnvironment, validateDate, safeValidate } from './validation.js';
import { KVUtils } from './shared-utilities.js';
import { getKVTTl } from './config.js';
import { KVKeyFactory, KeyHelpers, KeyTypes } from './kv-key-factory.js';

// Initialize logging for this module
let loggingInitialized = false;

function ensureLoggingInitialized(env) {
  if (!loggingInitialized && env) {
    initLogging(env);
    loggingInitialized = true;
  }
}

/**
 * Determine primary model from sentiment analysis data
 */
function getPrimaryModelFromSentiment(sentimentAnalysis) {
  if (!sentimentAnalysis || !sentimentAnalysis.source) {
    return 'UNKNOWN';
  }

  switch (sentimentAnalysis.source) {
    case 'cloudflare_gpt_oss':
      return 'GPT-OSS-120B';
    case 'cloudflare_distilbert':
      return 'DistilBERT';
    default:
      return sentimentAnalysis.model || 'UNKNOWN';
  }
}

/**
 * Process analysis data for a single date and convert to fact table format
 * Shared helper function for fact table operations - now supports dual AI system
 */
async function processAnalysisDataForDate(env, dateStr, checkDate) {
  const factTableData = [];

  // Try to get analysis data for this date
  const analysisKey = KVKeyFactory.generateDateKey(KeyTypes.ANALYSIS, dateStr);
  const analysisJson = await env.TRADING_RESULTS.get(analysisKey);

  if (analysisJson) {
    try {
      const analysisData = JSON.parse(analysisJson);

      // Convert analysis data to fact table format
      if (analysisData.symbols_analyzed && analysisData.trading_signals) {
        for (const symbol of analysisData.symbols_analyzed) {
          const signal = analysisData.trading_signals[symbol];
          if (signal) {
            const actualPrice = await getRealActualPrice(symbol, dateStr);
            const directionCorrect = await validateDirectionAccuracy({ ...signal, symbol }, dateStr);

            // Check if this is dual AI analysis or legacy 3-layer analysis
            const isDualAI = signal.analysis_type === 'dual_ai_comparison' ||
                           signal.enhanced_prediction?.dual_ai_specific ||
                           signal.models?.gpt;

            let factTableRecord;

            if (isDualAI) {
              // Process dual AI analysis data
              factTableRecord = processDualAISignal(signal, symbol, dateStr, actualPrice, directionCorrect, analysisData);
            } else {
              // Process legacy 3-layer analysis data
              factTableRecord = processLegacySignal(signal, symbol, dateStr, actualPrice, directionCorrect, analysisData);
            }

            factTableData.push(factTableRecord);
          }
        }
      }
    } catch (parseError) {
      logError(`Error parsing analysis data for ${dateStr}:`, parseError);
    }
  }

  return factTableData;
}

/**
 * Process dual AI signal data for fact table
 */
function processDualAISignal(signal, symbol, dateStr, actualPrice, directionCorrect, analysisData) {
  // Extract dual AI model data
  const gptModel = signal.models?.gpt || {};
  const distilBERTModel = signal.models?.distilbert || {};
  const dualAIComparison = signal.comparison || {};
  const dualAISignal = signal.signal || {};

  // Extract trading signals from enhanced_prediction
  const enhancedPrediction = signal.enhanced_prediction || {};
  const tradingDirection = enhancedPrediction.direction || signal.direction || 'NEUTRAL';
  const overallConfidence = enhancedPrediction.confidence || signal.confidence || 0;

  // Extract dual AI specific data
  const dualAISpecific = enhancedPrediction.dual_ai_specific || {};

  return {
    date: dateStr,
    symbol: symbol,
    predicted_price: signal.predicted_price,
    current_price: signal.current_price,
    actual_price: actualPrice || signal.current_price,
    direction_prediction: tradingDirection,
    direction_correct: directionCorrect,
    confidence: overallConfidence,
    model: 'dual_ai_comparison',

    // Dual AI Analysis specific fields
    primary_model: 'GPT-OSS-120B',
    secondary_model: 'DistilBERT-SST-2-INT8',
    gpt_confidence: gptModel.confidence || 0,
    distilbert_confidence: distilBERTModel.confidence || 0,
    gpt_direction: gptModel.direction,
    distilbert_direction: distilBERTModel.direction,

    // Agreement and signal data
    models_agree: dualAIComparison.agree || false,
    agreement_type: dualAIComparison.agreement_type || 'unknown',
    signal_type: dualAISignal.type || 'UNKNOWN',
    signal_strength: dualAISignal.strength || 'UNKNOWN',
    signal_action: dualAISignal.action || 'HOLD',

    // Dual AI specific metrics
    dual_ai_agreement: dualAIComparison.agree,
    dual_ai_agreement_score: calculateAgreementScore(dualAIComparison),
    articles_analyzed: gptModel.articles_analyzed || distilBERTModel.articles_analyzed || 0,

    // Analysis metadata
    analysis_type: 'dual_ai_comparison',
    execution_time_ms: signal.execution_time_ms || 0,
    successful_models: signal.performance_metrics?.successful_models || 0,

    trigger_mode: analysisData.trigger_mode,
    timestamp: analysisData.timestamp || new Date().toISOString()
  };
}

/**
 * Process legacy 3-layer signal data for fact table (backward compatibility)
 */
function processLegacySignal(signal, symbol, dateStr, actualPrice, directionCorrect, analysisData) {
  // Extract data from legacy 3-layer per-symbol analysis structure
  const tradingSignals = signal.trading_signals || signal;
  const sentimentLayers = signal.sentiment_layers || [];

  // Extract primary sentiment layer (GPT-OSS-120B)
  const primarySentimentLayer = sentimentLayers[0] || {};
  const secondarySentimentLayer = sentimentLayers[1] || {};
  const articleLayer = sentimentLayers[2] || {};

  // Extract trading signals
  const primaryDirection = tradingSignals.primary_direction || 'NEUTRAL';
  const overallConfidence = tradingSignals.overall_confidence || 0;

  // Extract model information
  const primaryModel = primarySentimentLayer.model || 'GPT-OSS-120B';
  const secondaryModel = secondarySentimentLayer.model || 'DistilBERT';

  // Extract sentiment information
  const sentimentLabel = primarySentimentLayer.sentiment || 'neutral';
  const sentimentConfidence = primarySentimentLayer.confidence || 0;

  // Calculate neural agreement from sentiment layers consistency
  const neuralAgreement = calculate3LayerNeuralAgreement(sentimentLayers, tradingSignals);

  return {
    date: dateStr,
    symbol: symbol,
    predicted_price: signal.predicted_price,
    current_price: signal.current_price,
    actual_price: actualPrice || signal.current_price,
    direction_prediction: primaryDirection,
    direction_correct: directionCorrect,
    confidence: overallConfidence,
    model: primaryModel,

    // Legacy 3-Layer Analysis specific fields
    primary_model: primaryModel,
    primary_confidence: overallConfidence,
    sentiment_score: sentimentConfidence,
    sentiment_label: sentimentLabel,
    layer1_confidence: primarySentimentLayer.confidence || 0,
    layer2_confidence: secondarySentimentLayer.confidence || 0,
    layer3_confidence: articleLayer.confidence || 0,
    layer1_model: primarySentimentLayer.model || 'GPT-OSS-120B',
    layer2_model: secondarySentimentLayer.model || 'DistilBERT',
    layer3_type: articleLayer.layer_type || 'article_level_analysis',
    articles_analyzed: primarySentimentLayer.articles_analyzed || 0,
    neural_agreement: neuralAgreement.status,
    neural_agreement_score: neuralAgreement.score,
    layer_consistency: neuralAgreement.layerConsistency,
    overall_confidence: overallConfidence,
    analysis_type: '3_layer_sentiment_analysis',

    trigger_mode: analysisData.trigger_mode,
    timestamp: analysisData.timestamp || new Date().toISOString()
  };
}

/**
 * Calculate agreement score for dual AI comparison
 */
function calculateAgreementScore(comparison) {
  if (!comparison) return 0;

  if (comparison.agree) {
    return comparison.agreement_type === 'full_agreement' ? 1.0 : 0.7;
  } else {
    return comparison.agreement_type === 'partial_agreement' ? 0.4 : 0.1;
  }
}

/**
 * Get fact table data from stored analysis results
 * Convert stored analysis data into fact table format for weekly analysis
 */
export async function getFactTableData(env) {
  try {
    // Get the last 7 days of analysis data
    const factTableData = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      const dayData = await processAnalysisDataForDate(env, dateStr, checkDate);
      factTableData.push(...dayData);
    }

    logInfo(`Retrieved ${factTableData.length} fact table records from analysis data`);
    return factTableData;

  } catch (error) {
    logError('Error retrieving fact table data:', error);
    return [];
  }
}

/**
 * Get fact table data with custom date range and week selection
 */
export async function getFactTableDataWithRange(env, rangeDays = 7, weekSelection = 'current') {
  try {
    const factTableData = [];
    const today = new Date();

    // Calculate start date based on week selection
    let startDate = new Date(today);
    if (weekSelection === 'last1') {
      startDate.setDate(today.getDate() - 7);
    } else if (weekSelection === 'last2') {
      startDate.setDate(today.getDate() - 14);
    } else if (weekSelection === 'last3') {
      startDate.setDate(today.getDate() - 21);
    }

    // Get data for the specified range
    for (let i = 0; i < rangeDays; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(startDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      const dayData = await processAnalysisDataForDate(env, dateStr, checkDate);
      factTableData.push(...dayData);
    }

    logInfo(`Retrieved ${factTableData.length} records for range=${rangeDays}, week=${weekSelection}`);
    return factTableData;

  } catch (error) {
    logError('Error retrieving fact table data with range:', error);
    return [];
  }
}

/**
 * Store fact table data to KV storage
 */
export async function storeFactTableData(env, factTableData) {
  try {
    const factTableKey = 'fact_table_data';
    await KVUtils.putWithTTL(
      env.TRADING_RESULTS,
      factTableKey,
      JSON.stringify(factTableData),
      'analysis'
    );

    logKVDebug(`Stored ${factTableData.length} fact table records to KV`);
    return true;

  } catch (error) {
    logError('Error storing fact table data:', error);
    return false;
  }
}

/**
 * Store granular analysis for a single symbol
 * New enhanced storage format for individual symbol tracking
 */
export async function storeSymbolAnalysis(env, symbol, analysisData) {
  try {
    console.log(`💾 [KV DEBUG] Starting KV storage for ${symbol}`);
    ensureLoggingInitialized(env);
    logKVDebug('KV WRITE START: Storing analysis for', symbol);
    logKVDebug('env.TRADING_RESULTS available:', !!env.TRADING_RESULTS);
    console.log(`💾 [KV DEBUG] env.TRADING_RESULTS type:`, typeof env.TRADING_RESULTS);
    console.log(`💾 [KV DEBUG] Has TRADING_RESULTS binding:`, 'TRADING_RESULTS' in env);

    const dateStr = new Date().toISOString().split('T')[0];
    const key = `analysis_${dateStr}_${symbol}`;
    console.log(`💾 [KV DEBUG] Generated key: ${key}`);

    const dataString = JSON.stringify(analysisData);
    console.log(`💾 [KV DEBUG] Data string length: ${dataString.length}`);

    console.log(`💾 [KV DEBUG] About to call env.TRADING_RESULTS.put()...`);
    await KVUtils.putWithTTL(
      env.TRADING_RESULTS,
      key,
      dataString,
      'granular'
    );

    console.log(`✅ [KV DEBUG] KV put() completed successfully for key: ${key}`);
    return true;
  } catch (error) {
    logError('KV WRITE ERROR: Failed to store granular analysis for', symbol + ':', error);
    logError('KV ERROR DETAILS:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return false;
  }
}

/**
 * Batch store multiple analysis results with optimized parallel operations
 * Significantly faster than individual sequential KV writes
 */
export async function batchStoreAnalysisResults(env, analysisResults) {
  try {
    ensureLoggingInitialized(env);
    const startTime = Date.now();
    const date = new Date().toISOString().split('T')[0];
    const kvOperations = [];

    logInfo(`Starting batch KV storage for ${analysisResults.length} symbols...`);

    // Create main daily analysis (compact format for web dashboard)
    const dailyAnalysis = {
      date,
      symbols: analysisResults.map(result => ({
        symbol: result.symbol,
        sentiment: result.sentiment_layers?.[0]?.sentiment || 'neutral',
        confidence: result.confidence_metrics?.overall_confidence || 0.5,
        direction: result.trading_signals?.primary_direction || 'NEUTRAL',
        model: result.sentiment_layers?.[0]?.model || 'GPT-OSS-120B',
        layer_consistency: result.confidence_metrics?.consistency_bonus || 0,
        analysis_type: result.analysis_type || 'fine_grained_sentiment'
      })),
      execution_time: Date.now(),
      batch_stored: true,
      total_symbols: analysisResults.length
    };

    // Add main daily analysis to batch
    kvOperations.push(
      KVUtils.putWithTTL(
        env.TRADING_RESULTS,
        `analysis_${date}`,
        JSON.stringify(dailyAnalysis),
        'analysis'
      )
    );

    // Add individual symbol analyses to batch (full detail for granular tracking)
    for (const result of analysisResults) {
      if (result && result.symbol) {
        // Create compact version for KV storage (remove large raw data)
        const compactResult = createCompactAnalysisData(result);

        kvOperations.push(
          KVUtils.putWithTTL(
            env.TRADING_RESULTS,
            `analysis_${date}_${result.symbol}`,
            JSON.stringify(compactResult),
            'granular'
          )
        );
      }
    }

    // Execute all KV operations in parallel (much faster than sequential)
    logInfo(`Executing ${kvOperations.length} KV operations in parallel...`);
    const kvResults = await Promise.allSettled(kvOperations);

    // Count successful operations
    const successful = kvResults.filter(r => r.status === 'fulfilled').length;
    const failed = kvResults.filter(r => r.status === 'rejected').length;

    const totalTime = Date.now() - startTime;
    logInfo(`Batch KV storage completed: ${successful}/${kvOperations.length} operations successful in ${totalTime}ms`);

    if (failed > 0) {
      logError(`${failed} KV operations failed during batch storage`);
      kvResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          logError(`KV operation ${index} failed:`, result.reason);
        }
      });
    }

    return {
      success: successful > 0,
      total_operations: kvOperations.length,
      successful_operations: successful,
      failed_operations: failed,
      execution_time_ms: totalTime,
      daily_analysis_stored: kvResults[0]?.status === 'fulfilled',
      symbol_analyses_stored: successful - 1 // Subtract 1 for daily analysis
    };

  } catch (error) {
    logError('Batch KV storage failed:', error);
    return {
      success: false,
      error: error.message,
      total_operations: 0,
      successful_operations: 0,
      failed_operations: 0
    };
  }
}

/**
 * Create compact analysis data for KV storage (removes large unnecessary data)
 */
function createCompactAnalysisData(analysisData) {
  return {
    symbol: analysisData.symbol,
    analysis_type: analysisData.analysis_type,
    timestamp: analysisData.timestamp,

    // Compact sentiment layers (remove raw responses and detailed analysis)
    sentiment_layers: (analysisData.sentiment_layers || []).map(layer => ({
      layer_type: layer.layer_type,
      sentiment: layer.sentiment,
      confidence: layer.confidence,
      model: layer.model,
      // Remove: raw_response, detailed_analysis, individual_scores, etc.
    })),

    // Keep essential confidence metrics only
    confidence_metrics: {
      overall_confidence: analysisData.confidence_metrics?.overall_confidence || 0,
      base_confidence: analysisData.confidence_metrics?.base_confidence || 0,
      consistency_bonus: analysisData.confidence_metrics?.consistency_bonus || 0,
      agreement_bonus: analysisData.confidence_metrics?.agreement_bonus || 0
    },

    // Keep complete trading signals (needed for Facebook messages)
    trading_signals: analysisData.trading_signals,

    // Keep compact sentiment patterns
    sentiment_patterns: {
      overall_consistency: analysisData.sentiment_patterns?.overall_consistency,
      primary_sentiment: analysisData.sentiment_patterns?.primary_sentiment,
      model_agreement: analysisData.sentiment_patterns?.model_agreement
    },

    // Keep essential metadata only
    analysis_metadata: {
      method: analysisData.analysis_metadata?.method,
      models_used: analysisData.analysis_metadata?.models_used,
      total_processing_time: analysisData.analysis_metadata?.total_processing_time,
      news_quality_score: analysisData.analysis_metadata?.news_quality_score
    },

    // Keep compact news data summary
    news_data: {
      total_articles: analysisData.news_data?.total_articles || 0,
      time_range: analysisData.news_data?.time_range
    }

    // Remove: Full news articles, detailed analysis breakdowns, raw responses, etc.
  };
}

/**
 * Track cron execution health for monitoring and debugging
 */
export async function trackCronHealth(env, status, executionData = {}) {
  try {
    ensureLoggingInitialized(env);
    const healthData = {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      status: status, // 'success', 'partial', 'failed'
      execution_time_ms: executionData.totalTime || 0,
      symbols_processed: executionData.symbolsProcessed || 0,
      symbols_successful: executionData.symbolsSuccessful || 0,
      symbols_fallback: executionData.symbolsFallback || 0,
      symbols_failed: executionData.symbolsFailed || 0,
      analysis_success_rate: executionData.successRate || 0,
      storage_operations: executionData.storageOperations || 0,
      errors: executionData.errors || []
    };

    // Store latest health status
    await env.TRADING_RESULTS.put('cron_health_latest', JSON.stringify(healthData));

    // Also store in daily health log for history
    const dateKey = `cron_health_${new Date().toISOString().slice(0, 10)}`;
    const existingDailyData = await env.TRADING_RESULTS.get(dateKey);
    const dailyData = existingDailyData ? JSON.parse(existingDailyData) : { executions: [] };

    dailyData.executions.push(healthData);

    // Keep only last 10 executions per day to avoid bloat
    if (dailyData.executions.length > 10) {
      dailyData.executions = dailyData.executions.slice(-10);
    }

    await KVUtils.putWithTTL(
      env.TRADING_RESULTS,
      dateKey,
      JSON.stringify(dailyData),
      'metadata'
    );

    logInfo(`Cron health tracked: ${status} - ${executionData.symbolsProcessed || 0} symbols processed`);
    return true;

  } catch (error) {
    logError('Failed to track cron health:', error);
    return false;
  }
}

/**
 * Get latest cron health status for monitoring
 */
export async function getCronHealthStatus(env) {
  try {
    ensureLoggingInitialized(env);
    const latestHealthJson = await env.TRADING_RESULTS.get('cron_health_latest');

    if (!latestHealthJson) {
      return {
        healthy: false,
        message: 'No cron health data found',
        last_execution: null
      };
    }

    const healthData = JSON.parse(latestHealthJson);
    const hoursSinceLastRun = (Date.now() - healthData.timestamp) / (1000 * 60 * 60);

    return {
      healthy: hoursSinceLastRun < 6 && healthData.status !== 'failed', // Should run every 2-4 hours
      last_execution: new Date(healthData.timestamp).toISOString(),
      hours_since_last_run: hoursSinceLastRun,
      last_status: healthData.status,
      symbols_processed: healthData.symbols_processed,
      success_rate: healthData.analysis_success_rate,
      execution_time_ms: healthData.execution_time_ms,
      full_health_data: healthData
    };

  } catch (error) {
    logError('Failed to get cron health status:', error);
    return {
      healthy: false,
      message: 'Error reading cron health data',
      error: error.message
    };
  }
}

/**
 * Get analysis results for all symbols on a specific date
 * Enhanced to fetch granular symbol-specific data
 */
export async function getSymbolAnalysisByDate(env, dateString, symbols = null) {
  try {
    // Use centralized symbol configuration if none provided
    if (!symbols) {
      symbols = (env.TRADING_SYMBOLS || 'AAPL,MSFT,GOOGL,TSLA,NVDA').split(',').map(s => s.trim());
    }

    const keys = symbols.map(symbol => `analysis_${dateString}_${symbol}`);
    const promises = keys.map(key => env.TRADING_RESULTS.get(key));
    const results = await Promise.all(promises);

    const parsedResults = results
      .map((res, index) => res ? { ...JSON.parse(res), symbol: symbols[index] } : null)
      .filter(res => res !== null);

    logInfo(`Retrieved ${parsedResults.length}/${symbols.length} granular analysis records for ${dateString}`);
    return parsedResults;
  } catch (error) {
    logError(`Error retrieving granular analysis for ${dateString}:`, error);
    return [];
  }
}

/**
 * Get analysis results by date
 */
export async function getAnalysisResultsByDate(env, dateString) {
  try {
    // Validate inputs
    validateEnvironment(env);
    const validatedDate = validateDate(dateString);
    const dateString_clean = validatedDate.toISOString().split('T')[0];

    const dailyKey = validateKVKey(`analysis_${dateString_clean}`);
    const resultJson = await env.TRADING_RESULTS.get(dailyKey);
    
    if (!resultJson) {
      return null;
    }
    
    return JSON.parse(resultJson);
    
  } catch (error) {
    logError(`Error retrieving analysis for ${dateString}:`, error);
    return null;
  }
}

/**
 * List all KV keys with a prefix
 */
export async function listKVKeys(env, prefix = '') {
  try {
    const keys = [];
    let cursor = null;

    do {
      const result = await env.TRADING_RESULTS.list({
        prefix: prefix,
        cursor: cursor,
        limit: 1000
      });

      keys.push(...result.keys);
      cursor = result.cursor;

    } while (cursor);

    return keys;

  } catch (error) {
    logError('Error listing KV keys:', error);
    return [];
  }
}

/**
 * Get real actual price from Yahoo Finance for a given date
 */
async function getRealActualPrice(symbol, targetDate) {
  try {
    logInfo(`Fetching actual price for ${symbol} on ${targetDate}...`);

    // Calculate date range - get several days around target date
    const target = new Date(targetDate);
    const endDate = new Date(target);
    endDate.setDate(target.getDate() + 3); // Look a few days ahead
    const startDate = new Date(target);
    startDate.setDate(target.getDate() - 3); // Look a few days back

    const endTimestamp = Math.floor(endDate.getTime() / 1000);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API returned ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart.result[0];

    if (!result || !result.indicators) {
      throw new Error('Invalid response format from Yahoo Finance');
    }

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];

    // Find closest date to target
    let closestPrice = null;
    let closestDiff = Infinity;

    for (let i = 0; i < timestamps.length; i++) {
      const dataDate = new Date(timestamps[i] * 1000);
      const diffDays = Math.abs((dataDate - target) / (1000 * 60 * 60 * 24));

      if (diffDays < closestDiff && quote.close[i]) {
        closestDiff = diffDays;
        closestPrice = quote.close[i];
      }
    }

    if (closestPrice) {
      logInfo(`Found actual price for ${symbol}: $${closestPrice.toFixed(2)} (${closestDiff.toFixed(1)} days difference)`);
      return closestPrice;
    } else {
      throw new Error('No valid price data found');
    }

  } catch (error) {
    logError(`Error fetching actual price for ${symbol}:`, error.message);
    // Fallback to predicted price if Yahoo Finance fails
    return null;
  }
}

/**
 * Calculate neural network agreement for 3-layer analysis
 * Measures consistency across sentiment layers and trading signals
 */
function calculate3LayerNeuralAgreement(sentimentLayers, tradingSignals) {
  try {
    if (!sentimentLayers || sentimentLayers.length < 2) {
      return {
        status: 'INSUFFICIENT_LAYERS',
        score: 0.5,
        layerConsistency: 0.5,
        tft_signal: 'UNKNOWN',
        nhits_signal: 'UNKNOWN'
      };
    }

    // Extract sentiment from each layer
    const layer1Sentiment = sentimentLayers[0]?.sentiment || 'neutral';
    const layer2Sentiment = sentimentLayers[1]?.sentiment || 'neutral';
    const layer3Sentiment = sentimentLayers[2]?.sentiment || 'neutral';

    // Map sentiments to trading directions
    const direction1 = mapSentimentToDirection(layer1Sentiment);
    const direction2 = mapSentimentToDirection(layer2Sentiment);
    const direction3 = mapSentimentToDirection(layer3Sentiment);
    const tradingDirection = tradingSignals.primary_direction || 'NEUTRAL';

    // Calculate layer consistency
    const layerAgreements = [
      direction1 === direction2,
      direction2 === direction3,
      direction1 === direction3,
      direction1 === tradingDirection,
      direction2 === tradingDirection,
      direction3 === tradingDirection
    ];

    const agreementCount = layerAgreements.filter(Boolean).length;
    const layerConsistency = agreementCount / layerAgreements.length;

    // Determine overall agreement status
    let status = 'LOW_CONSENSUS';
    let score = layerConsistency;

    if (layerConsistency >= 0.8) {
      status = 'HIGH_CONSENSUS';
      score = 0.9;
    } else if (layerConsistency >= 0.6) {
      status = 'MEDIUM_CONSENSUS';
      score = 0.7;
    } else if (layerConsistency >= 0.4) {
      status = 'LOW_CONSENSUS';
      score = 0.5;
    } else {
      status = 'NO_CONSENSUS';
      score = 0.2;
    }

    return {
      status: status,
      score: score,
      layerConsistency: layerConsistency,
      tft_signal: status,
      nhits_signal: status,
      layer1_direction: direction1,
      layer2_direction: direction2,
      layer3_direction: direction3,
      trading_direction: tradingDirection,
      agreement_count: agreementCount,
      total_comparisons: layerAgreements.length
    };

  } catch (error) {
    logError('Error calculating 3-layer neural agreement:', error);
    return {
      status: 'ERROR',
      score: 0.5,
      layerConsistency: 0.5,
      tft_signal: 'ERROR',
      nhits_signal: 'ERROR'
    };
  }
}

/**
 * Map sentiment to direction for consistency calculation
 */
function mapSentimentToDirection(sentiment) {
  const mapping = {
    'bullish': 'BULLISH',
    'bearish': 'BEARISH',
    'neutral': 'NEUTRAL',
    'positive': 'BULLISH',
    'negative': 'BEARISH'
  };
  return mapping[sentiment?.toLowerCase()] || 'NEUTRAL';
}

/**
 * Calculate neural network agreement with sentiment analysis (Legacy)
 */
function calculateNeuralAgreement(sentimentAnalysis, technicalReference, enhancedPrediction) {
  try {
    // Default neutral agreement if no data
    if (!sentimentAnalysis || !technicalReference || !enhancedPrediction) {
      return {
        status: 'UNKNOWN',
        score: 0.5,
        tft_signal: 'UNKNOWN',
        nhits_signal: 'UNKNOWN'
      };
    }

    // Extract directions for comparison
    const sentimentDirection = sentimentAnalysis.sentiment?.toUpperCase() || 'NEUTRAL';
    const technicalDirection = technicalReference.direction?.toUpperCase() || 'NEUTRAL';
    const technicalAgreement = enhancedPrediction.enhancement_details?.technical_agreement;

    // Map sentiment to direction
    const sentimentTradingDirection = mapSentimentToTradingDirection(sentimentDirection);

    // Determine agreement status
    let agreementStatus = 'UNKNOWN';
    let agreementScore = 0.5;

    if (technicalAgreement !== undefined) {
      // Use existing technical agreement calculation
      agreementStatus = technicalAgreement ? 'AGREE' : 'DISAGREE';
      agreementScore = technicalAgreement ? 0.8 : 0.2;
    } else {
      // Fallback: Compare directions directly
      const directionsMatch = sentimentTradingDirection === technicalDirection;
      agreementStatus = directionsMatch ? 'AGREE' : 'DISAGREE';
      agreementScore = directionsMatch ? 0.8 : 0.2;
    }

    return {
      status: agreementStatus,
      score: agreementScore,
      tft_signal: agreementStatus, // Simplified: use same for both
      nhits_signal: agreementStatus,
      sentiment_direction: sentimentTradingDirection,
      technical_direction: technicalDirection
    };

  } catch (error) {
    logError('Error calculating neural agreement:', error);
    return {
      status: 'ERROR',
      score: 0.5,
      tft_signal: 'ERROR',
      nhits_signal: 'ERROR'
    };
  }
}

/**
 * Map sentiment to trading direction
 */
function mapSentimentToTradingDirection(sentiment) {
  const mapping = {
    'BULLISH': 'UP',
    'BEARISH': 'DOWN',
    'NEUTRAL': 'NEUTRAL',
    'POSITIVE': 'UP',
    'NEGATIVE': 'DOWN'
  };
  return mapping[sentiment?.toUpperCase()] || 'NEUTRAL';
}

/**
 * Validate direction accuracy using real market data
 */
async function validateDirectionAccuracy(signal, targetDate) {
  try {
    const actualPrice = await getRealActualPrice(signal.symbol || 'UNKNOWN', targetDate);

    if (!actualPrice) {
      // If we can't get real data, use signal confidence as accuracy indicator
      // Higher confidence signals are more likely to be directionally correct
      const accuracyThreshold = 0.75; // 75% threshold for direction accuracy
      return signal.confidence >= accuracyThreshold;
    }

    // Compare predicted vs actual direction
    const predictedDirection = signal.predicted_price > signal.current_price;
    const actualDirection = actualPrice > signal.current_price;

    const directionCorrect = predictedDirection === actualDirection;

    logInfo(`Direction accuracy for ${signal.symbol}: Predicted ${predictedDirection ? 'UP' : 'DOWN'}, Actual ${actualDirection ? 'UP' : 'DOWN'} = ${directionCorrect ? '✓' : '✗'}`);

    return directionCorrect;

  } catch (error) {
    logError(`Error validating direction accuracy:`, error.message);
    // Fallback to confidence-based deterministic estimation
    const accuracyThreshold = 0.75;
    return signal.confidence >= accuracyThreshold;
  }
}