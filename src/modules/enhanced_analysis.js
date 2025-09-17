/**
 * Enhanced Analysis Module with Sentiment Integration
 * Phase 1: Basic sentiment enhancement using free APIs + Cloudflare AI
 */

import { runBasicAnalysis } from './analysis.js';
import { getFreeStockNews, analyzeTextSentiment } from './free_sentiment_pipeline.js';
import { getCloudflareAISentiment } from './cloudflare_ai_sentiment_pipeline.js';

/**
 * Run enhanced analysis with sentiment integration
 * Phase 1 implementation: Free news + basic sentiment
 */
export async function runEnhancedAnalysis(env, options = {}) {
  const startTime = Date.now();
  console.log('🚀 Starting Enhanced Analysis with Sentiment Integration...');

  try {
    // Step 1: Run existing neural network analysis (TFT + N-HITS)
    console.log('📊 Step 1: Running neural network analysis...');
    const technicalAnalysis = await runBasicAnalysis(env, options);

    // Step 2: Add sentiment analysis for each symbol
    console.log('🔍 Step 2: Adding sentiment analysis...');
    const enhancedResults = await addSentimentAnalysis(technicalAnalysis, env);

    // Step 3: Calculate execution metrics
    const executionTime = Date.now() - startTime;
    enhancedResults.execution_metrics = {
      total_time_ms: executionTime,
      enhancement_enabled: true,
      sentiment_sources: ['free_news', 'rule_based_analysis'],
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
      const sentimentResult = await getBasicSentiment(symbol, newsData, env);

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
 * Get basic sentiment analysis (Phase 1 implementation)
 */
async function getBasicSentiment(symbol, newsData, env) {
  // Phase 1: Start with free news APIs and rule-based sentiment
  if (!newsData || newsData.length === 0) {
    return {
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      source_count: 0,
      method: 'no_data'
    };
  }

  try {
    // Use Cloudflare AI if available (Phase 1 Week 2)
    if (env.AI) {
      console.log(`   🤖 Using Cloudflare AI sentiment analysis for ${symbol}...`);
      return await getCloudflareAISentiment(symbol, newsData, env);
    }

    // Fallback to rule-based sentiment (Phase 1 Week 1)
    console.log(`   📝 Using rule-based sentiment analysis for ${symbol}...`);
    return getRuleBasedSentiment(newsData);

  } catch (error) {
    console.error(`   ❌ Advanced sentiment failed for ${symbol}, using rule-based:`, error.message);
    return getRuleBasedSentiment(newsData);
  }
}

/**
 * Rule-based sentiment analysis (fallback method)
 */
function getRuleBasedSentiment(newsData) {
  if (!newsData || newsData.length === 0) {
    return {
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'No news data',
      source_count: 0,
      method: 'rule_based'
    };
  }

  let totalScore = 0;
  let totalWeight = 0;
  const sentimentCounts = { bullish: 0, bearish: 0, neutral: 0 };

  newsData.forEach(item => {
    // Analyze title and summary
    const text = `${item.title} ${item.summary || ''}`;
    const sentiment = analyzeTextSentiment(text);

    // Weight by source reliability
    const weight = getSourceWeight(item.source_type || 'unknown');

    totalScore += sentiment.score * weight;
    totalWeight += weight;

    // Count sentiment types
    if (sentiment.score > 0.1) sentimentCounts.bullish++;
    else if (sentiment.score < -0.1) sentimentCounts.bearish++;
    else sentimentCounts.neutral++;
  });

  const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  const confidence = Math.min(0.8, Math.abs(avgScore) + (newsData.length * 0.05));

  let finalSentiment = 'neutral';
  if (avgScore > 0.1) finalSentiment = 'bullish';
  else if (avgScore < -0.1) finalSentiment = 'bearish';

  return {
    sentiment: finalSentiment,
    confidence: confidence,
    score: avgScore,
    reasoning: `${finalSentiment} from ${newsData.length} news sources (${sentimentCounts.bullish}+ ${sentimentCounts.bearish}- ${sentimentCounts.neutral}=)`,
    source_count: newsData.length,
    sentiment_distribution: sentimentCounts,
    method: 'rule_based'
  };
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
  // Phase 1 weights: Enhanced approach with validation-based sentiment
  const TECHNICAL_WEIGHT = 0.60;
  const SENTIMENT_WEIGHT = 0.40;

  // Extract technical prediction
  const technicalDirection = technicalSignal.ensemble?.direction || technicalSignal.tft?.direction || 'NEUTRAL';
  const technicalConfidence = technicalSignal.ensemble?.confidence || technicalSignal.tft?.confidence || 0.5;

  // Convert to numerical scores
  const technicalScore = mapDirectionToScore(technicalDirection);
  const sentimentScore = sentimentSignal.score || 0;

  // Calculate weighted combination
  const combinedScore = (technicalScore * TECHNICAL_WEIGHT) + (sentimentScore * SENTIMENT_WEIGHT);
  const combinedDirection = combinedScore > 0.1 ? 'UP' : combinedScore < -0.1 ? 'DOWN' : 'NEUTRAL';

  // Calculate hybrid confidence
  const sentimentConfidence = sentimentSignal.confidence || 0;
  const hybridConfidence = (technicalConfidence * TECHNICAL_WEIGHT) + (sentimentConfidence * SENTIMENT_WEIGHT);

  return {
    symbol: symbol,
    direction: combinedDirection,
    confidence: hybridConfidence,
    combined_score: combinedScore,

    components: {
      technical: {
        direction: technicalDirection,
        confidence: technicalConfidence,
        weight: TECHNICAL_WEIGHT
      },
      sentiment: {
        direction: sentimentSignal.sentiment,
        confidence: sentimentConfidence,
        weight: SENTIMENT_WEIGHT,
        source_count: sentimentSignal.source_count
      }
    },

    reasoning: `Technical: ${technicalDirection} (${(technicalConfidence * 100).toFixed(1)}%), Sentiment: ${sentimentSignal.sentiment} (${(sentimentConfidence * 100).toFixed(1)}%) ${sentimentSignal.models_used ? 'using ' + sentimentSignal.models_used.join(' + ') : 'from ' + (sentimentSignal.source_count || 0) + ' sources'}`,

    enhancement_details: {
      method: 'phase1_validation_hybrid',
      sentiment_method: sentimentSignal.method || (sentimentSignal.models_used ? 'cloudflare_ai_validation' : 'rule_based'),
      weights: { technical: TECHNICAL_WEIGHT, sentiment: SENTIMENT_WEIGHT },
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

    // Test sentiment analysis
    const sentimentResult = await getBasicSentiment(testSymbol, newsData, env);
    console.log(`   📊 Sentiment: ${sentimentResult.sentiment} (${(sentimentResult.confidence * 100).toFixed(1)}%)`);

    // Test Cloudflare AI availability
    const aiAvailable = !!env.AI;
    console.log(`   🤖 Cloudflare AI available: ${aiAvailable}`);

    return {
      success: true,
      news_count: newsData.length,
      sentiment: sentimentResult.sentiment,
      confidence: sentimentResult.confidence,
      ai_available: aiAvailable,
      method: sentimentResult.method
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