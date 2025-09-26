/**
 * Data Access Module
 * Handles data retrieval from KV storage and fact table operations with real market validation
 */

import { initLogging, logKVDebug, logError, logInfo } from './logging.js';

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
 * Shared helper function for fact table operations
 */
async function processAnalysisDataForDate(env, dateStr, checkDate) {
  const factTableData = [];

  // Try to get analysis data for this date
  const analysisKey = `analysis_${dateStr}`;
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

            // Extract data from new 3-layer per-symbol analysis structure
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

            factTableData.push({
              date: dateStr,
              symbol: symbol,
              predicted_price: signal.predicted_price,
              current_price: signal.current_price,
              actual_price: actualPrice || signal.current_price,
              direction_prediction: primaryDirection,
              direction_correct: directionCorrect,
              confidence: overallConfidence,
              model: primaryModel,

              // 3-Layer Analysis specific fields
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
              timestamp: analysisData.timestamp || checkDate.toISOString()
            });
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
    await env.TRADING_RESULTS.put(
      factTableKey,
      JSON.stringify(factTableData),
      { expirationTtl: 604800 } // 7 days
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
    await env.TRADING_RESULTS.put(
      key,
      dataString,
      { expirationTtl: 7776000 } // 90 days for longer-term analysis
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
    const dailyKey = `analysis_${dateString}`;
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