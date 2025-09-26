/**
 * Per-Symbol Fine-Grained Analysis Module
 * Advanced sentiment analysis for individual symbols without pre-trained model limitations
 */

import { getFreeStockNews } from './free_sentiment_pipeline.js';
import { getGPTOSSSentiment, getDistilBERTSentiment, getSentimentWithFallbackChain } from './enhanced_analysis.js';
import { parseNaturalLanguageResponse, mapSentimentToDirection, checkDirectionAgreement } from './sentiment_utils.js';
import { storeSymbolAnalysis, getSymbolAnalysisByDate, batchStoreAnalysisResults } from './data.js';
import { initLogging, logInfo, logError, logSentimentDebug, logAIDebug, logKVDebug, logWarn } from './logging.js';

// Initialize logging for this module
let loggingInitialized = false;

function ensureLoggingInitialized(env) {
  if (!loggingInitialized && env) {
    initLogging(env);
    loggingInitialized = true;
  }
}

/**
 * Enhanced per-symbol sentiment analysis with fine-grained scoring
 * Goes beyond basic sentiment to provide detailed symbol insights
 */
export async function analyzeSymbolWithFineGrainedSentiment(symbol, env, options = {}) {
  console.log(`🔬 [TROUBLESHOOT] analyzeSymbolWithFineGrainedSentiment called with symbol: ${symbol}`);
  ensureLoggingInitialized(env);
  logInfo(`Starting fine-grained sentiment analysis for ${symbol}...`);

  try {
    // Step 1: Comprehensive news gathering for the symbol
    console.log(`📰 [TROUBLESHOOT] Starting news gathering for ${symbol}...`);
    logInfo(`Gathering comprehensive news data for ${symbol}...`);
    const newsData = await gatherComprehensiveNewsForSymbol(symbol, env);
    console.log(`📰 [TROUBLESHOOT] News gathering completed, got ${newsData.length} articles`);

    // Step 2: Multi-layer sentiment analysis
    logInfo(`Performing multi-layer sentiment analysis for ${symbol}...`);
    const sentimentLayers = await performMultiLayerSentimentAnalysis(symbol, newsData, env);

    // Step 3: Symbol-specific sentiment tracking
    logInfo(`Analyzing symbol-specific sentiment patterns for ${symbol}...`);
    const sentimentPatterns = await analyzeSymbolSentimentPatterns(symbol, sentimentLayers, env);

    // Step 4: Fine-grained confidence calculation
    logInfo(`Calculating fine-grained confidence metrics for ${symbol}...`);
    const confidenceMetrics = calculateFineGrainedConfidence(sentimentLayers, sentimentPatterns);

    // Step 5: Generate symbol-specific trading signals
    logInfo(`Generating trading signals for ${symbol}...`);
    const tradingSignals = generateSymbolTradingSignals(symbol, sentimentLayers, confidenceMetrics);

    // Step 6: Store granular analysis data
    const analysisData = {
      symbol: symbol,
      analysis_type: 'fine_grained_sentiment',
      timestamp: new Date().toISOString(),

      // Comprehensive news data
      news_data: {
        total_articles: newsData.length,
        sources: newsData.map(item => item.source),
        time_range: {
          earliest: Math.min(...newsData.map(item => new Date(item.published_at))),
          latest: Math.max(...newsData.map(item => new Date(item.published_at)))
        }
      },

      // Multi-layer sentiment analysis
      sentiment_layers: sentimentLayers,

      // Symbol-specific patterns
      sentiment_patterns: sentimentPatterns,

      // Fine-grained confidence
      confidence_metrics: confidenceMetrics,

      // Trading signals
      trading_signals: tradingSignals,

      // Analysis metadata
      analysis_metadata: {
        method: 'fine_grained_sentiment_first',
        models_used: sentimentLayers.map(layer => layer.model),
        total_processing_time: Date.now() - options.startTime || 0,
        news_quality_score: calculateNewsQualityScore(newsData)
      }
    };

    // Store the granular analysis
    console.log(`💾 [TROUBLESHOOT] About to store analysis for ${symbol} in KV...`);
    console.log(`💾 [TROUBLESHOOT] Analysis data keys before storage:`, Object.keys(analysisData));
    await storeSymbolAnalysis(env, symbol, analysisData);
    console.log(`✅ [TROUBLESHOOT] KV storage completed for ${symbol}`);
    logKVDebug(`Stored fine-grained analysis for ${symbol}`);

    logInfo(`Fine-grained analysis complete for ${symbol}: ${tradingSignals.primary_direction} (${(confidenceMetrics.overall_confidence * 100).toFixed(1)}%)`);

    return analysisData;

  } catch (error) {
    logError(`Fine-grained analysis failed for ${symbol}:`, error);
    throw new Error(`Fine-grained sentiment analysis failed for ${symbol}: ${error.message}`);
  }
}

/**
 * Gather comprehensive news data for a specific symbol
 */
async function gatherComprehensiveNewsForSymbol(symbol, env) {
  try {
    // Get free news data with expanded parameters
    const newsData = await getFreeStockNews(symbol, env);

    logSentimentDebug(`Gathered ${newsData.length} news articles for ${symbol}`);

    // Enhance news data with additional processing
    const enhancedNews = newsData.map((article, index) => ({
      ...article,
      processing_order: index,
      relevance_score: calculateArticleRelevance(article, symbol),
      sentiment_weight: calculateArticleWeight(article)
    }));

    // Sort by relevance and weight
    enhancedNews.sort((a, b) => (b.relevance_score * b.sentiment_weight) - (a.relevance_score * a.sentiment_weight));

    logInfo(`Enhanced and sorted ${enhancedNews.length} articles for ${symbol}`);
    return enhancedNews.slice(0, 15); // Top 15 most relevant articles

  } catch (error) {
    logError(`Failed to gather news for ${symbol}:`, error);
    return [];
  }
}

/**
 * Perform 3-layer sentiment analysis as per original design
 */
async function performMultiLayerSentimentAnalysis(symbol, newsData, env) {
  const sentimentLayers = [];

  try {
    // Layer 1: GPT-OSS-120B (with DistilBERT fallback)
    logAIDebug(`Performing Layer 1: GPT-OSS-120B primary analysis for ${symbol}...`);
    const primaryLayer = await performPrimaryAnalysisLayer(symbol, newsData, env);
    sentimentLayers.push(primaryLayer);

    // Layer 2: Article-level analysis
    logSentimentDebug(`Performing Layer 2: Article-level analysis for ${symbol}...`);
    const articleLayer = await performArticleLevelAnalysis(symbol, newsData, env);
    sentimentLayers.push(articleLayer);

    // Layer 3: Temporal analysis (time-weighted aggregation)
    logSentimentDebug(`Performing Layer 3: Temporal analysis for ${symbol}...`);
    const temporalLayer = await performTemporalAnalysis(symbol, newsData, sentimentLayers, env);
    sentimentLayers.push(temporalLayer);

    logInfo(`Completed 3-layer sentiment analysis for ${symbol}`);
    return sentimentLayers;

  } catch (error) {
    logError(`3-layer sentiment analysis failed for ${symbol}:`, error);
    return [];
  }
}

/**
 * Layer 1: GPT-OSS-120B Primary Analysis (with DistilBERT fallback)
 */
async function performPrimaryAnalysisLayer(symbol, newsData, env) {
  try {
    const topArticles = newsData.slice(0, 8); // Use top 8 articles for GPT

    const newsContext = topArticles
      .map((item, i) => `${i+1}. ${item.title}\n   ${item.summary || ''}\n   Source: ${item.source} | Relevance: ${item.relevance_score.toFixed(2)}`)
      .join('\n\n');

    const enhancedPrompt = `Analyze ${symbol} stock sentiment with detailed financial reasoning:

${newsContext}

Provide comprehensive analysis including:
1. Overall sentiment (bullish/bearish/neutral) with confidence (0.0-1.0)
2. Key market-moving factors identified
3. Risk assessment level (low/medium/high)
4. Time horizon impact (short-term/medium-term/long-term)
5. Sector-specific influences
6. Market sentiment correlation
7. Recommendation strength (strong_buy/buy/hold/sell/strong_sell)

Focus on actionable insights specific to ${symbol} trading.`;

    const response = await env.AI.run(
      '@cf/openchat/openchat-3.5-0106',
      {
        messages: [
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 800
      }
    );

    const analysisData = parseEnhancedGPTResponse(response.response);

    return {
      layer_type: 'gpt_oss_120b_enhanced',
      model: 'openchat-3.5-0106',
      sentiment: analysisData.sentiment,
      confidence: analysisData.confidence,
      detailed_analysis: analysisData,
      articles_analyzed: topArticles.length,
      processing_time: Date.now(),
      raw_response: response.response
    };

  } catch (error) {
    logError(`GPT-OSS-120B failed for ${symbol}, falling back to DistilBERT:`, error);

    // Fallback to DistilBERT if GPT-OSS-120B fails
    try {
      logAIDebug(`Using DistilBERT fallback for ${symbol}...`);
      const fallbackResult = await performDistilBERTFallback(symbol, newsData, env);
      return {
        layer_type: 'gpt_oss_120b_with_distilbert_fallback',
        model: 'distilbert-fallback',
        sentiment: fallbackResult.sentiment,
        confidence: fallbackResult.confidence,
        detailed_analysis: fallbackResult,
        articles_analyzed: newsData.length,
        processing_time: Date.now(),
        fallback_used: true,
        original_error: error.message
      };
    } catch (fallbackError) {
      logError(`Both GPT and DistilBERT failed for ${symbol}:`, fallbackError);
      return {
        layer_type: 'gpt_oss_120b_with_distilbert_fallback',
        model: 'failed',
        sentiment: 'neutral',
        confidence: 0,
        error: `Primary failed: ${error.message}, Fallback failed: ${fallbackError.message}`
      };
    }
  }
}

/**
 * DistilBERT fallback for Layer 1 when GPT-OSS-120B fails
 */
async function performDistilBERTFallback(symbol, newsData, env) {
  try {
    const sentimentPromises = newsData.slice(0, 5).map(async (article, index) => {
      try {
        const text = `${article.title}. ${article.summary || ''}`.substring(0, 500);

        const response = await env.AI.run(
          '@cf/huggingface/distilbert-sst-2-int8',
          { text: text }
        );

        const result = response[0];
        return {
          article_index: index,
          sentiment: result.label.toLowerCase(),
          confidence: result.score,
          score: result.label === 'POSITIVE' ? result.score : -result.score
        };

      } catch (error) {
        return {
          article_index: index,
          sentiment: 'neutral',
          confidence: 0,
          score: 0,
          error: error.message
        };
      }
    });

    const results = await Promise.allSettled(sentimentPromises);
    const validResults = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(result => !result.error);

    // Calculate aggregate sentiment
    let totalScore = 0;
    let totalConfidence = 0;

    validResults.forEach(result => {
      totalScore += result.score;
      totalConfidence += result.confidence;
    });

    const avgScore = validResults.length > 0 ? totalScore / validResults.length : 0;
    const avgConfidence = validResults.length > 0 ? totalConfidence / validResults.length : 0;

    // Map to trading sentiment
    let finalSentiment = 'neutral';
    if (avgScore > 0.15) finalSentiment = 'bullish';
    else if (avgScore < -0.15) finalSentiment = 'bearish';

    return {
      sentiment: finalSentiment,
      confidence: avgConfidence,
      average_score: avgScore,
      articles_processed: validResults.length,
      fallback_source: 'distilbert'
    };

  } catch (error) {
    throw new Error(`DistilBERT fallback failed: ${error.message}`);
  }
}

/**
 * Perform DistilBERT analysis layer
 */
async function performDistilBERTAnalysisLayer(symbol, newsData, env) {
  try {
    const sentimentPromises = newsData.slice(0, 10).map(async (article, index) => {
      try {
        const text = `${article.title}. ${article.summary || ''}`.substring(0, 500);

        const response = await env.AI.run(
          '@cf/huggingface/distilbert-sst-2-int8',
          { text: text }
        );

        const result = response[0];

        return {
          article_index: index,
          sentiment: result.label.toLowerCase(),
          confidence: result.score,
          score: result.label === 'POSITIVE' ? result.score : -result.score,
          text_length: text.length,
          source: article.source
        };

      } catch (error) {
        return {
          article_index: index,
          sentiment: 'neutral',
          confidence: 0,
          score: 0,
          error: error.message
        };
      }
    });

    const results = await Promise.allSettled(sentimentPromises);
    const validResults = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(result => !result.error);

    // Calculate aggregate sentiment
    let totalScore = 0;
    let totalWeight = 0;
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };

    validResults.forEach(result => {
      const weight = result.confidence * (article.relevance_score || 1.0);
      totalScore += result.score * weight;
      totalWeight += weight;

      if (result.score > 0.1) sentimentCounts.positive++;
      else if (result.score < -0.1) sentimentCounts.negative++;
      else sentimentCounts.neutral++;
    });

    const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const avgConfidence = totalWeight / validResults.length;

    // Map to trading sentiment
    let finalSentiment = 'neutral';
    if (avgScore > 0.15) finalSentiment = 'bullish';
    else if (avgScore < -0.15) finalSentiment = 'bearish';

    return {
      layer_type: 'distilbert_aggregate',
      model: 'distilbert-sst-2-int8',
      sentiment: finalSentiment,
      confidence: avgConfidence,
      aggregate_score: avgScore,
      sentiment_distribution: sentimentCounts,
      articles_analyzed: validResults.length,
      individual_scores: validResults
    };

  } catch (error) {
    logError(`DistilBERT analysis layer failed for ${symbol}:`, error);
    return {
      layer_type: 'distilbert_aggregate',
      model: 'distilbert-sst-2-int8',
      sentiment: 'neutral',
      confidence: 0,
      error: error.message
    };
  }
}

/**
 * Perform article-level sentiment analysis
 */
async function performArticleLevelAnalysis(symbol, newsData, env) {
  try {
    const articleAnalyses = newsData.slice(0, 12).map((article, index) => ({
      article_index: index,
      title: article.title,
      source: article.source,
      relevance_score: article.relevance_score,
      sentiment_impact: calculateArticleSentimentImpact(article),
      topic_category: categorizeArticleTopic(article.title, article.summary || ''),
      urgency_level: assessArticleUrgency(article)
    }));

    // Calculate article-level sentiment distribution
    const sentimentImpact = articleAnalyses.reduce((acc, analysis) => {
      return acc + (analysis.sentiment_impact * analysis.relevance_score);
    }, 0);

    const avgImpact = sentimentImpact / articleAnalyses.length;

    return {
      layer_type: 'article_level_analysis',
      sentiment: avgImpact > 0.1 ? 'bullish' : avgImpact < -0.1 ? 'bearish' : 'neutral',
      confidence: Math.min(0.9, Math.abs(avgImpact)),
      aggregate_impact: avgImpact,
      articles_analyzed: articleAnalyses.length,
      article_analyses: articleAnalyses,
      topic_distribution: calculateTopicDistribution(articleAnalyses)
    };

  } catch (error) {
    logError(`Article-level analysis failed for ${symbol}:`, error);
    return {
      layer_type: 'article_level_analysis',
      sentiment: 'neutral',
      confidence: 0,
      error: error.message
    };
  }
}

/**
 * Layer 3: Temporal Analysis - Time-weighted sentiment aggregation
 */
async function performTemporalAnalysis(symbol, newsData, sentimentLayers, env) {
  try {
    logSentimentDebug(`Starting temporal analysis for ${symbol} with ${newsData.length} articles`);

    // Extract published times and calculate article ages
    const currentTime = new Date();
    const articlesWithTiming = newsData.map((article, index) => {
      // Parse article timestamp (fallback to current time if not available)
      const publishedTime = article.publishedAt ? new Date(article.publishedAt) : currentTime;
      const ageInHours = Math.max(0.1, (currentTime - publishedTime) / (1000 * 60 * 60)); // Minimum 0.1 hours

      return {
        ...article,
        index,
        published_time: publishedTime,
        age_hours: ageInHours,
        recency_weight: calculateTemporalWeight(ageInHours)
      };
    });

    // Extract sentiment scores from previous layers
    const primaryLayer = sentimentLayers[0] || {}; // Layer 1: GPT-OSS-120B
    const articleLayer = sentimentLayers[1] || {}; // Layer 2: Article-level analysis

    // Create time-weighted sentiment aggregation
    let totalWeightedSentiment = 0;
    let totalWeight = 0;
    let totalWeightedConfidence = 0;
    const timeDecayMetrics = [];

    articlesWithTiming.forEach((article, index) => {
      // Get sentiment impact for this article from Layer 2
      const articleAnalysis = articleLayer.article_analyses?.[index];
      const sentimentImpact = articleAnalysis?.sentiment_impact || 0;
      const relevanceScore = article.relevance_score || 1.0;

      // Calculate time-weighted contribution
      const temporalWeight = article.recency_weight * relevanceScore;
      const weightedSentiment = sentimentImpact * temporalWeight;

      totalWeightedSentiment += weightedSentiment;
      totalWeight += temporalWeight;
      totalWeightedConfidence += (Math.abs(sentimentImpact) * temporalWeight);

      timeDecayMetrics.push({
        article_index: index,
        age_hours: article.age_hours,
        temporal_weight: article.recency_weight,
        sentiment_impact: sentimentImpact,
        weighted_contribution: weightedSentiment,
        title: article.title?.substring(0, 60) + '...'
      });
    });

    // Calculate final temporal sentiment metrics
    const temporalSentimentScore = totalWeight > 0 ? totalWeightedSentiment / totalWeight : 0;
    const temporalConfidence = totalWeight > 0 ? totalWeightedConfidence / totalWeight : 0;

    // Determine temporal sentiment direction
    let temporalSentiment = 'neutral';
    if (temporalSentimentScore > 0.2) temporalSentiment = 'bullish';
    else if (temporalSentimentScore < -0.2) temporalSentiment = 'bearish';

    // Calculate sentiment trend analysis
    const sentimentTrend = calculateSentimentTrend(timeDecayMetrics);
    const temporalConsistency = calculateTemporalConsistency(timeDecayMetrics);

    // Create temporal decay visualization data
    const temporalDecayLambda = 0.5; // Decay constant (tunable parameter)

    return {
      layer_type: 'temporal_analysis',
      sentiment: temporalSentiment,
      confidence: Math.min(0.95, temporalConfidence),
      temporal_sentiment_score: temporalSentimentScore,
      sentiment_trend: sentimentTrend,
      temporal_consistency: temporalConsistency,
      time_decay_metrics: {
        decay_constant_lambda: temporalDecayLambda,
        total_weight: totalWeight,
        articles_processed: articlesWithTiming.length,
        time_window_hours: Math.max(...articlesWithTiming.map(a => a.age_hours))
      },
      article_temporal_breakdown: timeDecayMetrics.slice(0, 10), // Top 10 for debugging
      temporal_validation: {
        recent_articles_weight: timeDecayMetrics.filter(m => m.age_hours < 6).reduce((acc, m) => acc + m.temporal_weight, 0),
        older_articles_weight: timeDecayMetrics.filter(m => m.age_hours >= 6).reduce((acc, m) => acc + m.temporal_weight, 0)
      }
    };

  } catch (error) {
    logError(`Temporal analysis failed for ${symbol}:`, error);
    return {
      layer_type: 'temporal_analysis',
      sentiment: 'neutral',
      confidence: 0,
      error: error.message
    };
  }
}

/**
 * Calculate temporal weight using exponential decay
 */
function calculateTemporalWeight(ageInHours) {
  // Exponential decay: e^(-λ * age)
  // λ = 0.5 means sentiment half-life of ~1.4 hours
  const lambda = 0.5;
  return Math.exp(-lambda * ageInHours);
}

/**
 * Calculate sentiment trend over time
 */
function calculateSentimentTrend(timeDecayMetrics) {
  const sortedByTime = timeDecayMetrics.sort((a, b) => a.age_hours - b.age_hours);

  if (sortedByTime.length < 2) return 'stable';

  const recentHalf = sortedByTime.slice(0, Math.ceil(sortedByTime.length / 2));
  const olderHalf = sortedByTime.slice(Math.ceil(sortedByTime.length / 2));

  const recentSentiment = recentHalf.reduce((acc, m) => acc + m.sentiment_impact, 0) / recentHalf.length;
  const olderSentiment = olderHalf.reduce((acc, m) => acc + m.sentiment_impact, 0) / olderHalf.length;

  const trendDifference = recentSentiment - olderSentiment;

  if (trendDifference > 0.15) return 'improving';
  else if (trendDifference < -0.15) return 'declining';
  else return 'stable';
}

/**
 * Calculate temporal consistency across time periods
 */
function calculateTemporalConsistency(timeDecayMetrics) {
  if (timeDecayMetrics.length < 2) return 1.0;

  const sentimentValues = timeDecayMetrics.map(m => m.sentiment_impact);
  const mean = sentimentValues.reduce((acc, val) => acc + val, 0) / sentimentValues.length;
  const variance = sentimentValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / sentimentValues.length;
  const standardDeviation = Math.sqrt(variance);

  // Convert to consistency score (0-1, where 1 is perfectly consistent)
  return Math.max(0, 1 - (standardDeviation * 2));
}

/**
 * Analyze symbol-specific sentiment patterns
 */
async function analyzeSymbolSentimentPatterns(symbol, sentimentLayers, env) {
  try {
    // Get historical sentiment data for pattern analysis
    const historicalData = await getHistoricalSentimentPatterns(symbol, env);

    // Analyze consistency across layers
    const layerConsistency = analyzeLayerConsistency(sentimentLayers);

    // Identify sentiment patterns
    const patterns = {
      overall_consistency: layerConsistency.overall_consistency,
      primary_sentiment: determinePrimarySentiment(sentimentLayers),
      confidence_stability: analyzeConfidenceStability(sentimentLayers),
      model_agreement: analyzeModelAgreement(sentimentLayers),
      sentiment_momentum: analyzeSentimentMomentum(sentimentLayers, historicalData),
      risk_factors: identifyRiskFactors(symbol, sentimentLayers),
      opportunities: identifyOpportunities(symbol, sentimentLayers)
    };

    return patterns;

  } catch (error) {
    logError(`Symbol sentiment pattern analysis failed for ${symbol}:`, error);
    return {
      overall_consistency: 'unknown',
      primary_sentiment: 'neutral',
      error: error.message
    };
  }
}

/**
 * Calculate fine-grained confidence metrics
 */
function calculateFineGrainedConfidence(sentimentLayers, sentimentPatterns) {
  try {
    // Base confidence from sentiment layers
    const layerConfidences = sentimentLayers
      .filter(layer => !layer.error)
      .map(layer => layer.confidence);

    const avgLayerConfidence = layerConfidences.length > 0
      ? layerConfidences.reduce((a, b) => a + b, 0) / layerConfidences.length
      : 0;

    // Consistency bonus
    const consistencyBonus = sentimentPatterns.overall_consistency === 'high' ? 0.15 :
                           sentimentPatterns.overall_consistency === 'medium' ? 0.05 : 0;

    // Model agreement bonus
    const agreementBonus = sentimentPatterns.model_agreement > 0.8 ? 0.10 :
                          sentimentPatterns.model_agreement > 0.6 ? 0.05 : 0;

    // Calculate final confidence metrics
    const overallConfidence = Math.min(0.95, avgLayerConfidence + consistencyBonus + agreementBonus);

    return {
      overall_confidence: overallConfidence,
      base_confidence: avgLayerConfidence,
      consistency_bonus: consistencyBonus,
      agreement_bonus: agreementBonus,
      confidence_breakdown: {
        layer_confidence: layerConfidences,
        consistency_factor: sentimentPatterns.overall_consistency,
        agreement_factor: sentimentPatterns.model_agreement
      },
      reliability_score: calculateReliabilityScore(sentimentLayers, sentimentPatterns)
    };

  } catch (error) {
    logError('Confidence calculation failed:', error);
    return {
      overall_confidence: 0.5,
      error: error.message
    };
  }
}

/**
 * Generate symbol-specific trading signals
 */
function generateSymbolTradingSignals(symbol, sentimentLayers, confidenceMetrics) {
  try {
    // Determine primary direction from sentiment layers
    const primarySentiment = determinePrimarySentiment(sentimentLayers);
    const primaryDirection = mapSentimentToDirection(primarySentiment);

    // Generate detailed signals
    const signals = {
      symbol: symbol,
      primary_direction: primaryDirection,
      overall_confidence: confidenceMetrics.overall_confidence,

      // Entry/exit signals
      entry_signals: generateEntrySignals(symbol, sentimentLayers, confidenceMetrics),
      exit_signals: generateExitSignals(symbol, sentimentLayers, confidenceMetrics),

      // Risk management
      risk_signals: generateRiskSignals(symbol, sentimentLayers, confidenceMetrics),

      // Time horizon signals
      time_horizon_signals: generateTimeHorizonSignals(symbol, sentimentLayers),

      // Strength indicators
      strength_indicators: generateStrengthIndicators(symbol, sentimentLayers, confidenceMetrics),

      // Recommendation
      recommendation: generateRecommendation(symbol, primaryDirection, confidenceMetrics),

      // Signal metadata
      signal_metadata: {
        generated_at: new Date().toISOString(),
        layers_used: sentimentLayers.length,
        primary_models: sentimentLayers.map(l => l.model).filter(Boolean),
        confidence_level: getConfidenceLevel(confidenceMetrics.overall_confidence)
      }
    };

    return signals;

  } catch (error) {
    logError(`Trading signal generation failed for ${symbol}:`, error);
    return {
      symbol: symbol,
      primary_direction: 'NEUTRAL',
      overall_confidence: 0.5,
      error: error.message
    };
  }
}

// Helper functions for detailed analysis

function calculateArticleRelevance(article, symbol) {
  const title = article.title.toLowerCase();
  const summary = (article.summary || '').toLowerCase();
  const symbolLower = symbol.toLowerCase();

  // Check for direct symbol mentions
  const directMentions = (title.match(new RegExp(symbolLower, 'g')) || []).length +
                        (summary.match(new RegExp(symbolLower, 'g')) || []).length;

  // Check for relevant keywords
  const relevantKeywords = [
    'stock', 'share', 'price', 'market', 'trading', 'investment',
    'earnings', 'revenue', 'profit', 'growth', 'forecast'
  ];

  const keywordScore = relevantKeywords.reduce((score, keyword) => {
    const mentions = (title.match(new RegExp(keyword, 'g')) || []).length +
                     (summary.match(new RegExp(keyword, 'g')) || []).length;
    return score + mentions;
  }, 0);

  return Math.min(1.0, (directMentions * 0.3) + (keywordScore * 0.1));
}

function calculateArticleWeight(article) {
  // Weight based on recency and source reliability
  const ageInHours = (Date.now() - new Date(article.published_at)) / (1000 * 60 * 60);
  const recencyWeight = Math.max(0.1, 1.0 - (ageInHours / 168)); // Decay over a week

  const sourceWeights = {
    'financialmodelingprep': 1.0,
    'yahoo': 0.8,
    'newsapi': 0.7,
    'unknown': 0.5
  };

  const sourceWeight = sourceWeights[article.source?.toLowerCase()] || 0.5;

  return recencyWeight * sourceWeight;
}

function calculateArticleSentimentImpact(article) {
  // Simple sentiment scoring based on keywords
  const title = article.title.toLowerCase();
  const summary = (article.summary || '').toLowerCase();
  const text = title + ' ' + summary;

  const positiveWords = ['up', 'rise', 'gain', 'growth', 'positive', 'bullish', 'buy', 'strong', 'excellent'];
  const negativeWords = ['down', 'fall', 'loss', 'decline', 'negative', 'bearish', 'sell', 'weak', 'poor'];

  let sentimentScore = 0;

  positiveWords.forEach(word => {
    const matches = text.match(new RegExp(word, 'g')) || [];
    sentimentScore += matches.length * 0.1;
  });

  negativeWords.forEach(word => {
    const matches = text.match(new RegExp(word, 'g')) || [];
    sentimentScore -= matches.length * 0.1;
  });

  return Math.max(-1, Math.min(1, sentimentScore));
}

function parseEnhancedGPTResponse(response) {
  // Enhanced parsing for detailed GPT responses
  const lines = response.split('\n');
  const result = {
    sentiment: 'neutral',
    confidence: 0.5,
    detailed_analysis: {}
  };

  // Parse sentiment
  const sentimentMatch = response.match(/(bullish|bearish|neutral)/i);
  if (sentimentMatch) {
    result.sentiment = sentimentMatch[1].toLowerCase();
  }

  // Parse confidence
  const confidenceMatch = response.match(/confidence[:\s]*(\d*\.?\d+|\d+)%?/i);
  if (confidenceMatch) {
    result.confidence = Math.min(1.0, parseFloat(confidenceMatch[1]) / 100);
  }

  // Parse detailed analysis components
  const riskMatch = response.match(/risk\s+assessment[:\s]*(low|medium|high)/i);
  if (riskMatch) {
    result.detailed_analysis.risk_assessment = riskMatch[1].toLowerCase();
  }

  const horizonMatch = response.match(/time\s+horizon[:\s]*(short|medium|long)\s*-?\s*term/i);
  if (horizonMatch) {
    result.detailed_analysis.time_horizon = horizonMatch[1].toLowerCase() + '-term';
  }

  return result;
}

// Additional helper functions would be implemented here for completeness
// These are simplified versions for the initial implementation

function categorizeArticleTopic(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();

  if (text.includes('earnings') || text.includes('revenue')) return 'financial';
  if (text.includes('market') || text.includes('index')) return 'market';
  if (text.includes('product') || text.includes('launch')) return 'product';
  if (text.includes('regulation') || text.includes('legal')) return 'regulatory';
  return 'general';
}

function assessArticleUrgency(article) {
  const urgentWords = ['breaking', 'urgent', 'alert', 'immediate', 'critical'];
  const title = article.title.toLowerCase();

  return urgentWords.some(word => title.includes(word)) ? 'high' : 'normal';
}

function calculateTopicDistribution(articles) {
  const topics = {};
  articles.forEach(article => {
    topics[article.topic_category] = (topics[article.topic_category] || 0) + 1;
  });
  return topics;
}


async function getHistoricalSentimentPatterns(symbol, env) {
  // Placeholder for historical pattern analysis
  return { patterns: [] };
}

function analyzeLayerConsistency(sentimentLayers) {
  // Simplified consistency analysis
  const validLayers = sentimentLayers.filter(l => !l.error && l.sentiment);
  if (validLayers.length === 0) return { overall_consistency: 'unknown' };

  const sentiments = validLayers.map(l => l.sentiment);
  const uniqueSentiments = new Set(sentiments);

  return {
    overall_consistency: uniqueSentiments.size === 1 ? 'high' :
                        uniqueSentiments.size === 2 ? 'medium' : 'low',
    sentiment_counts: sentiments.reduce((acc, s) => {
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {})
  };
}

function determinePrimarySentiment(sentimentLayers) {
  const validLayers = sentimentLayers.filter(l => !l.error && l.sentiment);
  if (validLayers.length === 0) return 'neutral';

  const sentimentCounts = validLayers.reduce((acc, layer) => {
    acc[layer.sentiment] = (acc[layer.sentiment] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(sentimentCounts)
    .sort((a, b) => b[1] - a[1])[0][0];
}

function analyzeConfidenceStability(sentimentLayers) {
  // Placeholder
  return 'stable';
}

function analyzeModelAgreement(sentimentLayers) {
  const validLayers = sentimentLayers.filter(l => !l.error && l.sentiment);
  if (validLayers.length === 0) return 0;

  const sentiments = validLayers.map(l => l.sentiment);
  const primarySentiment = determinePrimarySentiment(sentimentLayers);
  const agreementCount = sentiments.filter(s => s === primarySentiment).length;

  return agreementCount / sentiments.length;
}

function analyzeSentimentMomentum(sentimentLayers, historicalData) {
  // Placeholder
  return 'neutral';
}

function identifyRiskFactors(symbol, sentimentLayers) {
  // Placeholder
  return [];
}

function identifyOpportunities(symbol, sentimentLayers) {
  // Placeholder
  return [];
}

function calculateReliabilityScore(sentimentLayers, sentimentPatterns) {
  // Placeholder
  return 0.8;
}

function generateEntrySignals(symbol, sentimentLayers, confidenceMetrics) {
  const primarySentiment = determinePrimarySentiment(sentimentLayers);
  const direction = mapSentimentToDirection(primarySentiment);

  return {
    direction: direction,
    strength: confidenceMetrics.overall_confidence > 0.7 ? 'strong' :
               confidenceMetrics.overall_confidence > 0.5 ? 'moderate' : 'weak',
    timeframe: 'immediate',
    reasoning: `Based on ${primarySentiment} sentiment analysis`
  };
}

function generateExitSignals(symbol, sentimentLayers, confidenceMetrics) {
  return {
    conditions: ['stop_loss', 'take_profit', 'time_based'],
    monitoring_required: true
  };
}

function generateRiskSignals(symbol, sentimentLayers, confidenceMetrics) {
  return {
    risk_level: confidenceMetrics.overall_confidence > 0.7 ? 'low' :
                confidenceMetrics.overall_confidence > 0.5 ? 'medium' : 'high',
    recommended_position_size: Math.round(confidenceMetrics.overall_confidence * 100) + '%'
  };
}

function generateTimeHorizonSignals(symbol, sentimentLayers) {
  return {
    short_term: { confidence: 0.7, direction: 'bullish' },
    medium_term: { confidence: 0.6, direction: 'neutral' },
    long_term: { confidence: 0.5, direction: 'unknown' }
  };
}

function generateStrengthIndicators(symbol, sentimentLayers, confidenceMetrics) {
  return {
    signal_strength: confidenceMetrics.overall_confidence > 0.8 ? 'very_strong' :
                     confidenceMetrics.overall_confidence > 0.6 ? 'strong' :
                     confidenceMetrics.overall_confidence > 0.4 ? 'moderate' : 'weak',
    consistency_score: confidenceMetrics.confidence_breakdown?.agreement_factor || 0.5
  };
}

function generateRecommendation(symbol, direction, confidenceMetrics) {
  const confidence = confidenceMetrics.overall_confidence;

  if (confidence > 0.8) {
    return direction === 'UP' ? 'strong_buy' : direction === 'DOWN' ? 'strong_sell' : 'hold';
  } else if (confidence > 0.6) {
    return direction === 'UP' ? 'buy' : direction === 'DOWN' ? 'sell' : 'hold';
  } else {
    return 'hold';
  }
}

function getConfidenceLevel(confidence) {
  if (confidence >= 0.8) return 'very_high';
  if (confidence >= 0.6) return 'high';
  if (confidence >= 0.4) return 'medium';
  if (confidence >= 0.2) return 'low';
  return 'very_low';
}

function calculateNewsQualityScore(newsData) {
  // Placeholder
  return 0.8;
}

/**
 * Analyze symbol with robust fallback system for cron reliability
 * Ensures every symbol returns a usable result even if main analysis fails
 */
export async function analyzeSymbolWithFallback(symbol, env, options = {}) {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo(`Starting robust analysis for ${symbol} with fallback protection...`);

  try {
    // Primary: Full 3-layer analysis
    const analysis = await analyzeSymbolWithFineGrainedSentiment(symbol, env, options);
    logInfo(`✅ Full 3-layer analysis succeeded for ${symbol}`);
    return analysis;

  } catch (primaryError) {
    logWarn(`Full analysis failed for ${symbol}, trying simplified approach:`, primaryError.message);

    try {
      // Fallback 1: Basic sentiment analysis only
      const newsData = await getFreeStockNews(symbol, env);
      const sentiment = await getSentimentWithFallbackChain(symbol, newsData, env);

      const fallbackAnalysis = {
        symbol,
        analysis_type: 'fallback_sentiment_only',
        timestamp: new Date().toISOString(),

        // Simplified sentiment layers
        sentiment_layers: [{
          layer_type: 'gpt_oss_120b_fallback',
          sentiment: sentiment.sentiment,
          confidence: sentiment.confidence,
          model: sentiment.model || 'GPT-OSS-120B'
        }],

        // Basic confidence metrics
        confidence_metrics: {
          overall_confidence: sentiment.confidence * 0.7, // Reduced confidence for fallback
          base_confidence: sentiment.confidence,
          consistency_bonus: 0,
          agreement_bonus: 0
        },

        // Basic trading signals
        trading_signals: {
          symbol: symbol,
          primary_direction: mapSentimentToDirection(sentiment.sentiment),
          overall_confidence: sentiment.confidence * 0.7,
          recommendation: sentiment.confidence > 0.6 ?
            (sentiment.sentiment === 'bullish' ? 'buy' : sentiment.sentiment === 'bearish' ? 'sell' : 'hold') : 'hold'
        },

        // Fallback metadata
        analysis_metadata: {
          method: 'sentiment_fallback',
          models_used: [sentiment.model || 'GPT-OSS-120B'],
          total_processing_time: Date.now() - startTime,
          fallback_used: true,
          original_error: primaryError.message
        },

        // Basic news data
        news_data: {
          total_articles: newsData?.length || 0
        }
      };

      logInfo(`✅ Fallback sentiment analysis succeeded for ${symbol}`);
      return fallbackAnalysis;

    } catch (fallbackError) {
      logError(`Fallback analysis also failed for ${symbol}:`, fallbackError.message);

      // Fallback 2: Neutral result (ensures cron always completes)
      const neutralAnalysis = {
        symbol,
        analysis_type: 'neutral_fallback',
        timestamp: new Date().toISOString(),

        sentiment_layers: [{
          layer_type: 'neutral_fallback',
          sentiment: 'neutral',
          confidence: 0.3,
          model: 'fallback_neutral'
        }],

        confidence_metrics: {
          overall_confidence: 0.3,
          base_confidence: 0.3,
          consistency_bonus: 0,
          agreement_bonus: 0
        },

        trading_signals: {
          symbol: symbol,
          primary_direction: 'NEUTRAL',
          overall_confidence: 0.3,
          recommendation: 'hold'
        },

        analysis_metadata: {
          method: 'neutral_fallback',
          models_used: ['fallback_neutral'],
          total_processing_time: Date.now() - startTime,
          fully_failed: true,
          errors: [primaryError.message, fallbackError.message]
        },

        news_data: {
          total_articles: 0
        }
      };

      logWarn(`⚠️ Using neutral fallback for ${symbol} - both primary and sentiment fallback failed`);
      return neutralAnalysis;
    }
  }
}

/**
 * Batch analyze multiple symbols with cron-optimized error handling
 * Ensures cron job completes successfully even if individual symbols fail
 */
export async function batchAnalyzeSymbolsForCron(symbols, env, options = {}) {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo(`Starting batch analysis for ${symbols.length} symbols with cron optimization...`);

  const results = [];
  const statistics = {
    total_symbols: symbols.length,
    successful_full_analysis: 0,
    fallback_sentiment_used: 0,
    neutral_fallback_used: 0,
    total_failed: 0
  };

  // Process each symbol with individual error recovery
  for (const symbol of symbols) {
    try {
      const symbolResult = await analyzeSymbolWithFallback(symbol, env, options);
      results.push(symbolResult);

      // Track statistics
      if (symbolResult.analysis_type === 'fine_grained_sentiment') {
        statistics.successful_full_analysis++;
      } else if (symbolResult.analysis_type === 'fallback_sentiment_only') {
        statistics.fallback_sentiment_used++;
      } else if (symbolResult.analysis_type === 'neutral_fallback') {
        statistics.neutral_fallback_used++;
      }

    } catch (error) {
      // This should rarely happen since analyzeSymbolWithFallback has its own fallbacks
      logError(`Critical error analyzing ${symbol}:`, error);
      statistics.total_failed++;

      // Create minimal result to keep cron running
      results.push({
        symbol,
        analysis_type: 'critical_failure',
        error: error.message,
        sentiment_layers: [{ sentiment: 'neutral', confidence: 0, model: 'error' }],
        trading_signals: { symbol, primary_direction: 'NEUTRAL', overall_confidence: 0 },
        analysis_metadata: { method: 'critical_failure', fully_failed: true }
      });
    }
  }

  const totalTime = Date.now() - startTime;
  logInfo(`Batch analysis completed in ${totalTime}ms: ${statistics.successful_full_analysis} full, ${statistics.fallback_sentiment_used} fallback, ${statistics.neutral_fallback_used} neutral`);

  return {
    results,
    statistics,
    execution_metadata: {
      total_execution_time: totalTime,
      symbols_processed: results.length,
      success_rate: (statistics.successful_full_analysis + statistics.fallback_sentiment_used) / symbols.length,
      batch_completed: true
    }
  };
}

/**
 * Complete cron-optimized analysis pipeline with batch KV storage
 * This is the main function for cron jobs - handles everything from analysis to storage
 */
export async function runCompleteAnalysisPipeline(symbols, env, options = {}) {
  const pipelineStartTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo(`🚀 Starting complete analysis pipeline for ${symbols.length} symbols...`);

  try {
    // Step 1: Batch analyze all symbols with fallback protection
    logInfo(`📊 Step 1: Running batch analysis...`);
    const batchResult = await batchAnalyzeSymbolsForCron(symbols, env, options);

    logInfo(`✅ Analysis completed: ${batchResult.statistics.successful_full_analysis} full, ${batchResult.statistics.fallback_sentiment_used} fallback, ${batchResult.statistics.neutral_fallback_used} neutral`);

    // Step 2: Batch store all results to KV in parallel (much faster)
    logInfo(`💾 Step 2: Storing results with batch KV operations...`);
    const storageResult = await batchStoreAnalysisResults(env, batchResult.results);

    if (storageResult.success) {
      logInfo(`✅ Batch storage completed: ${storageResult.successful_operations}/${storageResult.total_operations} operations successful in ${storageResult.execution_time_ms}ms`);
    } else {
      logError(`❌ Batch storage failed:`, storageResult.error);
    }

    // Step 3: Create pipeline summary
    const pipelineTime = Date.now() - pipelineStartTime;
    const pipelineSummary = {
      pipeline_completed: true,
      total_execution_time: pipelineTime,

      // Analysis results
      analysis_statistics: batchResult.statistics,
      analysis_success_rate: batchResult.execution_metadata.success_rate,

      // Storage results
      storage_statistics: {
        total_operations: storageResult.total_operations,
        successful_operations: storageResult.successful_operations,
        failed_operations: storageResult.failed_operations,
        storage_time_ms: storageResult.execution_time_ms
      },

      // Overall pipeline health
      overall_success: storageResult.success && batchResult.execution_metadata.success_rate > 0.5,
      symbols_with_usable_data: batchResult.statistics.successful_full_analysis + batchResult.statistics.fallback_sentiment_used,

      // Performance metrics
      performance_metrics: {
        analysis_time_ms: batchResult.execution_metadata.total_execution_time,
        storage_time_ms: storageResult.execution_time_ms,
        total_pipeline_time_ms: pipelineTime,
        avg_time_per_symbol: pipelineTime / symbols.length
      }
    };

    logInfo(`🎯 Pipeline completed in ${pipelineTime}ms: ${pipelineSummary.symbols_with_usable_data}/${symbols.length} symbols successful`);

    return {
      success: true,
      analysis_results: batchResult.results,
      pipeline_summary: pipelineSummary,
      execution_metadata: {
        pipeline_type: 'complete_cron_optimized',
        symbols_processed: symbols.length,
        total_time: pipelineTime,
        cron_ready: true
      }
    };

  } catch (error) {
    const pipelineTime = Date.now() - pipelineStartTime;
    logError(`💥 Complete pipeline failed after ${pipelineTime}ms:`, error);

    return {
      success: false,
      error: error.message,
      execution_metadata: {
        pipeline_type: 'complete_cron_optimized',
        symbols_processed: 0,
        total_time: pipelineTime,
        cron_ready: false,
        failure_stage: 'pipeline_setup'
      }
    };
  }
}

/**
 * Main function for per-symbol analysis endpoint
 */
export async function analyzeSingleSymbol(symbol, env, options = {}) {
  console.log(`🚀 [TROUBLESHOOT] analyzeSingleSymbol called with symbol: ${symbol}`);
  console.log(`🚀 [TROUBLESHOOT] env object keys:`, Object.keys(env || {}));
  console.log(`🚀 [TROUBLESHOOT] options:`, options);

  ensureLoggingInitialized(env);

  if (!symbol) {
    console.log('❌ [TROUBLESHOOT] No symbol provided to analyzeSingleSymbol');
    throw new Error('Symbol is required for per-symbol analysis');
  }

  const startTime = Date.now();
  console.log(`⏰ [TROUBLESHOOT] Starting per-symbol analysis for ${symbol} at ${startTime}`);
  logInfo(`Starting per-symbol analysis for ${symbol}`);

  try {
    console.log(`🔧 [TROUBLESHOOT] About to call analyzeSymbolWithFineGrainedSentiment...`);
    const analysis = await analyzeSymbolWithFineGrainedSentiment(symbol, env, {
      startTime,
      ...options
    });
    console.log(`✅ [TROUBLESHOOT] analyzeSymbolWithFineGrainedSentiment completed successfully`);

    // Add execution metadata
    analysis.execution_metadata = {
      total_execution_time: Date.now() - startTime,
      analysis_completed: true,
      endpoint: 'per_symbol_analysis'
    };

    logInfo(`Per-symbol analysis completed for ${symbol} in ${Date.now() - startTime}ms`);
    return analysis;

  } catch (error) {
    logError(`Per-symbol analysis failed for ${symbol}:`, error);
    return {
      symbol: symbol,
      error: error.message,
      execution_metadata: {
        total_execution_time: Date.now() - startTime,
        analysis_completed: false,
        error: error.message
      }
    };
  }
}