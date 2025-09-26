/**
 * Per-Symbol Fine-Grained Analysis Module
 * Advanced sentiment analysis for individual symbols without pre-trained model limitations
 */

import { getFreeStockNews } from './free_sentiment_pipeline.js';
import { getGPTOSSSentiment, getDistilBERTSentiment } from './enhanced_analysis.js';
import { parseNaturalLanguageResponse, mapSentimentToDirection, checkDirectionAgreement } from './sentiment_utils.js';
import { storeSymbolAnalysis, getSymbolAnalysisByDate } from './data.js';
import { initLogging, logInfo, logError, logSentimentDebug, logAIDebug, logKVDebug } from './logging.js';

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
 * Perform multi-layer sentiment analysis
 */
async function performMultiLayerSentimentAnalysis(symbol, newsData, env) {
  const sentimentLayers = [];

  try {
    // Layer 1: GPT-OSS-120B Primary Analysis
    if (env.AI) {
      logAIDebug(`Performing GPT-OSS-120B analysis for ${symbol}...`);
      const gptLayer = await performGPTAnalysisLayer(symbol, newsData, env);
      sentimentLayers.push(gptLayer);
    }

    // Layer 2: DistilBERT Cross-Validation
    if (env.AI) {
      logAIDebug(`Performing DistilBERT analysis for ${symbol}...`);
      const distilbertLayer = await performDistilBERTAnalysisLayer(symbol, newsData, env);
      sentimentLayers.push(distilbertLayer);
    }

    // Layer 3: Article-by-Article Sentiment Breakdown
    logSentimentDebug(`Performing article-level sentiment analysis for ${symbol}...`);
    const articleLayer = await performArticleLevelAnalysis(symbol, newsData, env);
    sentimentLayers.push(articleLayer);

    
    logInfo(`Completed ${sentimentLayers.length} sentiment layers for ${symbol}`);
    return sentimentLayers;

  } catch (error) {
    logError(`Multi-layer sentiment analysis failed for ${symbol}:`, error);
    return [];
  }
}

/**
 * Perform GPT-OSS-120B analysis layer with enhanced prompts
 */
async function performGPTAnalysisLayer(symbol, newsData, env) {
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
    logError(`GPT analysis layer failed for ${symbol}:`, error);
    return {
      layer_type: 'gpt_oss_120b_enhanced',
      model: 'openchat-3.5-0106',
      sentiment: 'neutral',
      confidence: 0,
      error: error.message
    };
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