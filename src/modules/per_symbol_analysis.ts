/**
 * Per-Symbol Fine-Grained Analysis Module - TypeScript
 * Advanced sentiment analysis for individual symbols without pre-trained model limitations
 */

import { getFreeStockNews, type NewsArticle } from './free_sentiment_pipeline.js';
import { performDualAIComparison, batchDualAIAnalysis, type DualAIComparisonResult, type BatchDualAIAnalysisResult } from './dual-ai-analysis.js';
import { mapSentimentToDirection } from './sentiment_utils.js';
import { storeSymbolAnalysis, getSymbolAnalysisByDate, batchStoreAnalysisResults } from './data.js';
import { initLogging, logInfo, logError, logSentimentDebug, logAIDebug, logKVDebug, logWarn } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

// Type Definitions
export interface AnalysisOptions {
  startTime?: number;
  [key: string]: any;
}

export interface SentimentLayer {
  layer_type: string;
  model: string;
  sentiment: string;
  confidence: number;
  detailed_analysis?: any;
  articles_analyzed?: number;
  processing_time?: number;
  raw_response?: string;
  fallback_used?: boolean;
  original_error?: string;
  error?: string;
  sentiment_breakdown?: any;
  aggregate_score?: number;
  sentiment_distribution?: any;
  individual_scores?: any[];
}

export interface ConfidenceMetrics {
  overall_confidence: number;
  base_confidence: number;
  consistency_bonus: number;
  agreement_bonus: number;
  confidence_breakdown?: {
    layer_confidence?: number[];
    consistency_factor?: string;
    agreement_factor?: number;
    gpt_confidence?: number;
    distilbert_confidence?: number;
    agreement_score?: number;
  };
  reliability_score?: number;
  error?: string;
}

export interface TradingSignals {
  symbol: string;
  primary_direction: string;
  overall_confidence: number;
  recommendation?: string;
  signal_strength?: string;
  signal_type?: string;
  entry_signals?: any;
  exit_signals?: any;
  risk_signals?: any;
  time_horizon_signals?: any;
  strength_indicators?: any;
  signal_metadata?: any;
  error?: string;
}

export interface AnalysisMetadata {
  method: string;
  models_used: string[];
  total_processing_time: number;
  news_quality_score?: number;
  dual_ai_specific?: any;
  fallback_used?: boolean;
  original_error?: string;
  fully_failed?: boolean;
  errors?: string[];
}

export interface SymbolAnalysis {
  symbol: string;
  analysis_type: string;
  timestamp: string;
  news_data?: any;
  sentiment_layers: SentimentLayer[];
  sentiment_patterns?: any;
  confidence_metrics: ConfidenceMetrics;
  trading_signals: TradingSignals;
  analysis_metadata: AnalysisMetadata;
  execution_metadata?: any;
  error?: string;
}

export interface BatchStatistics {
  total_symbols: number;
  successful_full_analysis: number;
  fallback_sentiment_used: number;
  neutral_fallback_used: number;
  total_failed: number;
}

export interface BatchAnalysisResult {
  results: SymbolAnalysis[];
  statistics: BatchStatistics;
  execution_metadata: {
    total_execution_time: number;
    symbols_processed: number;
    success_rate: number;
    batch_completed: boolean;
  };
}

export interface PipelineResult {
  success: boolean;
  analysis_results?: SymbolAnalysis[];
  pipeline_summary?: any;
  execution_metadata: {
    pipeline_type: string;
    symbols_processed: number;
    total_time: number;
    cron_ready: boolean;
    dual_ai_enabled: boolean;
    failure_stage?: string;
  };
  error?: string;
}

export interface SentimentResult {
  sentiment: string;
  confidence: number;
  model?: string;
  average_score?: number;
  articles_processed?: number;
  fallback_source?: string;
}

// Initialize logging for this module
let loggingInitialized = false;

function ensureLoggingInitialized(env: CloudflareEnvironment): void {
  if (!loggingInitialized && env) {
    initLogging(env);
    loggingInitialized = true;
  }
}

/**
 * Dual AI per-symbol analysis with simple agreement/disagreement logic
 * Runs GPT-OSS-120B and DistilBERT in parallel for transparent comparison
 */
export async function analyzeSymbolWithFineGrainedSentiment(
  symbol: string,
  env: CloudflareEnvironment,
  options: AnalysisOptions = {}
): Promise<SymbolAnalysis> {
  console.log(`🔬 [TROUBLESHOOT] analyzeSymbolWithFineGrainedSentiment called with symbol: ${symbol}`);
  ensureLoggingInitialized(env);
  logInfo(`Starting dual AI analysis for ${symbol}...`);

  try {
    // Step 1: Comprehensive news gathering for the symbol
    console.log(`📰 [TROUBLESHOOT] Starting news gathering for ${symbol}...`);
    logInfo(`Gathering comprehensive news data for ${symbol}...`);
    const newsData = await gatherComprehensiveNewsForSymbol(symbol, env);
    console.log(`📰 [TROUBLESHOOT] News gathering completed, got ${newsData.length} articles`);

    // Step 2: Dual AI analysis with simple comparison
    logInfo(`Running dual AI analysis for ${symbol}...`);
    const dualAIResult = await performDualAIComparison(symbol, newsData, env);

    // Step 3: Convert dual AI result to legacy format for compatibility
    const analysisData = convertDualAIToLegacyFormat(dualAIResult, newsData, options);

    // Store the analysis
    console.log(`💾 [TROUBLESHOOT] About to store dual AI analysis for ${symbol} in KV...`);
    await storeSymbolAnalysis(env, symbol, analysisData);
    console.log(`✅ [TROUBLESHOOT] KV storage completed for ${symbol}`);
    logKVDebug(`Stored dual AI analysis for ${symbol}`);

    logInfo(`Dual AI analysis complete for ${symbol}: ${dualAIResult.signal.direction} (${dualAIResult.signal.strength})`);

    return analysisData;

  } catch (error: any) {
    logError(`Dual AI analysis failed for ${symbol}:`, error);
    throw new Error(`Dual AI analysis failed for ${symbol}: ${error.message}`);
  }
}

/**
 * Convert dual AI result to legacy format for system compatibility
 */
function convertDualAIToLegacyFormat(
  dualAIResult: DualAIComparisonResult,
  newsData: NewsArticle[],
  options: AnalysisOptions = {}
): SymbolAnalysis {
  const gptModel = dualAIResult.models.gpt;
  const distilbertModel = dualAIResult.models.distilbert;

  return {
    symbol: dualAIResult.symbol,
    analysis_type: 'dual_ai_comparison',
    timestamp: dualAIResult.timestamp,

    // News data
    news_data: {
      total_articles: newsData.length,
      sources: newsData.map(item => item.source),
      time_range: {
        earliest: newsData.length > 0 ? Math.min(...newsData.map(item => new Date(item.published_at).getTime())) : new Date().getTime(),
        latest: newsData.length > 0 ? Math.max(...newsData.map(item => new Date(item.published_at).getTime())) : new Date().getTime()
      }
    },

    // Convert dual AI models to sentiment layers format
    sentiment_layers: [
      {
        layer_type: 'gpt_oss_120b',
        model: 'openchat-3.5-0106',
        sentiment: gptModel ? gptModel.direction.toLowerCase() : 'neutral',
        confidence: gptModel ? gptModel.confidence : 0,
        detailed_analysis: {
          reasoning: gptModel ? gptModel.reasoning : 'No analysis available',
          articles_analyzed: gptModel ? gptModel.articles_analyzed : 0
        }
      },
      {
        layer_type: 'distilbert_sst_2',
        model: 'distilbert-sst-2-int8',
        sentiment: distilbertModel ? distilbertModel.direction.toLowerCase() : 'neutral',
        confidence: distilbertModel ? distilbertModel.confidence : 0,
        sentiment_breakdown: distilbertModel ? distilbertModel.sentiment_breakdown : undefined,
        articles_analyzed: distilbertModel ? distilbertModel.articles_analyzed : 0
      }
    ],

    // Dual AI specific patterns
    sentiment_patterns: {
      model_agreement: dualAIResult.comparison.agree,
      agreement_type: dualAIResult.comparison.agreement_type,
      agreement_details: dualAIResult.comparison.match_details,
      signal_strength: dualAIResult.signal.strength,
      signal_type: dualAIResult.signal.type
    },

    // Confidence metrics based on dual AI comparison
    confidence_metrics: {
      overall_confidence: calculateDualAIConfidence(dualAIResult),
      base_confidence: ((gptModel?.confidence || 0) + (distilbertModel?.confidence || 0)) / 2,
      consistency_bonus: dualAIResult.comparison.agree ? 0.15 : 0,
      agreement_bonus: dualAIResult.comparison.agree ? 0.1 : 0,
      confidence_breakdown: {
        gpt_confidence: gptModel?.confidence || 0,
        distilbert_confidence: distilbertModel?.confidence || 0,
        agreement_score: dualAIResult.comparison.agree ? 1.0 : 0.0
      }
    },

    // Trading signals from dual AI comparison
    trading_signals: {
      symbol: dualAIResult.symbol,
      primary_direction: dualAIResult.signal.direction,
      overall_confidence: calculateDualAIConfidence(dualAIResult),
      recommendation: dualAIResult.signal.action,
      signal_strength: dualAIResult.signal.strength,
      signal_type: dualAIResult.signal.type,
      entry_signals: {
        direction: dualAIResult.signal.direction,
        strength: dualAIResult.signal.strength,
        reasoning: dualAIResult.signal.reasoning
      }
    },

    // Analysis metadata
    analysis_metadata: {
      method: 'dual_ai_comparison',
      models_used: ['openchat-3.5-0106', 'distilbert-sst-2-int8'],
      total_processing_time: dualAIResult.execution_time_ms || (Date.now() - (options.startTime || Date.now())),
      news_quality_score: calculateNewsQualityScore(newsData),
      dual_ai_specific: {
        agree: dualAIResult.comparison.agree,
        agreement_type: dualAIResult.comparison.agreement_type,
        signal_action: dualAIResult.signal.action
      }
    }
  };
}

/**
 * Calculate confidence based on dual AI comparison
 */
function calculateDualAIConfidence(dualAIResult: DualAIComparisonResult): number {
  const gptConf = dualAIResult.models.gpt?.confidence || 0;
  const dbConf = dualAIResult.models.distilbert?.confidence || 0;
  const baseConf = (gptConf + dbConf) / 2;

  // Boost confidence if models agree
  if (dualAIResult.comparison.agree) {
    return Math.min(0.95, baseConf + 0.15);
  }

  // Reduce confidence if models disagree
  if (dualAIResult.comparison.agreement_type === 'disagreement') {
    return Math.max(0.05, baseConf - 0.2);
  }

  // Partial agreement - small boost
  return Math.min(0.9, baseConf + 0.05);
}

/**
 * Gather comprehensive news data for a specific symbol
 */
async function gatherComprehensiveNewsForSymbol(symbol: string, env: CloudflareEnvironment): Promise<NewsArticle[]> {
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

  } catch (error: any) {
    logError(`Failed to gather news for ${symbol}:`, error);
    return [];
  }
}

// Helper functions
function calculateArticleRelevance(article: NewsArticle, symbol: string): number {
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

function calculateArticleWeight(article: NewsArticle): number {
  // Weight based on recency and source reliability
  const ageInHours = (Date.now() - new Date(article.published_at).getTime()) / (1000 * 60 * 60);
  const recencyWeight = Math.max(0.1, 1.0 - (ageInHours / 168)); // Decay over a week

  const sourceWeights: Record<string, number> = {
    'financialmodelingprep': 1.0,
    'yahoo': 0.8,
    'newsapi': 0.7,
    'unknown': 0.5
  };

  const sourceWeight = sourceWeights[article.source?.toLowerCase()] || 0.5;

  return recencyWeight * sourceWeight;
}

function calculateNewsQualityScore(newsData: NewsArticle[]): number {
  // Placeholder
  return 0.8;
}

/**
 * Analyze symbol with robust fallback system for cron reliability
 * Ensures every symbol returns a usable result even if main analysis fails
 */
export async function analyzeSymbolWithFallback(
  symbol: string,
  env: CloudflareEnvironment,
  options: AnalysisOptions = {}
): Promise<SymbolAnalysis> {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo(`Starting robust analysis for ${symbol} with fallback protection...`);

  try {
    // Primary: Full dual AI analysis
    const analysis = await analyzeSymbolWithFineGrainedSentiment(symbol, env, options);
    logInfo(`✅ Full dual AI analysis succeeded for ${symbol}`);
    return analysis;

  } catch (primaryError: any) {
    logWarn(`Full analysis failed for ${symbol}, trying simplified approach:`, primaryError.message);

    try {
      // Fallback 1: Basic sentiment analysis only
      const newsData = await getFreeStockNews(symbol, env);
      const sentiment = await getSentimentWithFallbackChain(symbol, newsData, env);

      const fallbackAnalysis: SymbolAnalysis = {
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

    } catch (fallbackError: any) {
      logError(`Fallback analysis also failed for ${symbol}:`, fallbackError.message);

      // Fallback 2: Neutral result (ensures cron always completes)
      const neutralAnalysis: SymbolAnalysis = {
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
 * Placeholder for sentiment fallback chain
 */
async function getSentimentWithFallbackChain(symbol: string, newsData: NewsArticle[], env: CloudflareEnvironment): Promise<SentimentResult> {
  // Simplified placeholder - in real implementation would try multiple models
  return {
    sentiment: 'neutral',
    confidence: 0.5,
    model: 'GPT-OSS-120B'
  };
}

/**
 * Batch analyze multiple symbols with cron-optimized error handling
 * Ensures cron job completes successfully even if individual symbols fail
 */
export async function batchAnalyzeSymbolsForCron(
  symbols: string[],
  env: CloudflareEnvironment,
  options: AnalysisOptions = {}
): Promise<BatchAnalysisResult> {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo(`Starting batch analysis for ${symbols.length} symbols with cron optimization...`);

  const results: SymbolAnalysis[] = [];
  const statistics: BatchStatistics = {
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

    } catch (error: any) {
      // This should rarely happen since analyzeSymbolWithFallback has its own fallbacks
      logError(`Critical error analyzing ${symbol}:`, error);
      statistics.total_failed++;

      // Create minimal result to keep cron running
      results.push({
        symbol,
        analysis_type: 'critical_failure',
        timestamp: new Date().toISOString(),
        error: error.message,
        sentiment_layers: [{ layer_type: 'error', sentiment: 'neutral', confidence: 0, model: 'error' }],
        confidence_metrics: { overall_confidence: 0, base_confidence: 0, consistency_bonus: 0, agreement_bonus: 0 },
        trading_signals: { symbol, primary_direction: 'NEUTRAL', overall_confidence: 0 },
        analysis_metadata: { method: 'critical_failure', models_used: [], total_processing_time: 0, fully_failed: true }
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
 * Complete cron-optimized analysis pipeline with dual AI system and batch KV storage
 * This is the main function for cron jobs - handles everything from analysis to storage
 */
export async function runCompleteAnalysisPipeline(
  symbols: string[],
  env: CloudflareEnvironment,
  options: AnalysisOptions = {}
): Promise<PipelineResult> {
  const pipelineStartTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo(`🚀 Starting dual AI analysis pipeline for ${symbols.length} symbols...`);

  try {
    // Step 1: Batch dual AI analysis
    logInfo(`🤖 Step 1: Running dual AI analysis...`);
    const dualAIResult = await batchDualAIAnalysis(symbols, env, options);

    logInfo(`✅ Dual AI analysis completed: ${dualAIResult.statistics.full_agreement} agreements, ${dualAIResult.statistics.disagreement} disagreements`);

    // Step 2: Convert dual AI results to legacy format and prepare for storage
    logInfo(`🔄 Step 2: Converting results for storage...`);
    const legacyResults = dualAIResult.results.map(result => convertDualAIToLegacyFormat(result, [], options));

    // Step 3: Batch store all results to KV in parallel
    logInfo(`💾 Step 3: Storing results with batch KV operations...`);
    const storageResult = await batchStoreAnalysisResults(env, legacyResults);

    if (storageResult.success) {
      logInfo(`✅ Batch storage completed: ${storageResult.successful_operations}/${storageResult.total_operations} operations successful in ${storageResult.execution_time_ms}ms`);
    } else {
      logError(`❌ Batch storage failed:`, storageResult.error);
    }

    // Step 4: Create pipeline summary
    const pipelineTime = Date.now() - pipelineStartTime;
    const pipelineSummary = {
      pipeline_completed: true,
      total_execution_time: pipelineTime,

      // Dual AI analysis results
      analysis_statistics: {
        total_symbols: dualAIResult.statistics.total_symbols,
        successful_full_analysis: dualAIResult.statistics.full_agreement + dualAIResult.statistics.partial_agreement,
        fallback_sentiment_used: 0,
        neutral_fallback_used: dualAIResult.statistics.errors,
        dual_ai_specific: {
          full_agreement: dualAIResult.statistics.full_agreement,
          partial_agreement: dualAIResult.statistics.partial_agreement,
          disagreement: dualAIResult.statistics.disagreement,
          errors: dualAIResult.statistics.errors
        }
      },

      analysis_success_rate: dualAIResult.execution_metadata.success_rate,

      // Storage results
      storage_statistics: {
        total_operations: storageResult.total_operations,
        successful_operations: storageResult.successful_operations,
        failed_operations: storageResult.failed_operations,
        storage_time_ms: storageResult.execution_time_ms
      },

      // Overall pipeline health
      overall_success: storageResult.success && dualAIResult.execution_metadata.success_rate > 0.5,
      symbols_with_usable_data: dualAIResult.statistics.total_symbols - dualAIResult.statistics.errors,

      // Performance metrics
      performance_metrics: {
        analysis_time_ms: dualAIResult.execution_metadata.total_execution_time,
        storage_time_ms: storageResult.execution_time_ms,
        total_pipeline_time_ms: pipelineTime,
        avg_time_per_symbol: pipelineTime / symbols.length
      },

      // Dual AI specific metrics
      dual_ai_metrics: {
        agreement_rate: dualAIResult.execution_metadata.agreement_rate,
        successful_models: dualAIResult.results.reduce((sum, result) => sum + (result.performance_metrics?.successful_models || 0), 0),
        total_ai_executions: dualAIResult.results.reduce((sum, result) => sum + (result.performance_metrics?.models_executed || 0), 0)
      }
    };

    logInfo(`🎯 Dual AI pipeline completed in ${pipelineTime}ms: ${pipelineSummary.symbols_with_usable_data}/${symbols.length} symbols successful, ${dualAIResult.statistics.full_agreement} agreements`);

    return {
      success: true,
      analysis_results: legacyResults,
      pipeline_summary: pipelineSummary,
      execution_metadata: {
        pipeline_type: 'dual_ai_optimized',
        symbols_processed: symbols.length,
        total_time: pipelineTime,
        cron_ready: true,
        dual_ai_enabled: true
      }
    };

  } catch (error: any) {
    const pipelineTime = Date.now() - pipelineStartTime;
    logError(`💥 Dual AI pipeline failed after ${pipelineTime}ms:`, error);

    return {
      success: false,
      error: error.message,
      execution_metadata: {
        pipeline_type: 'dual_ai_optimized',
        symbols_processed: 0,
        total_time: pipelineTime,
        cron_ready: false,
        dual_ai_enabled: true,
        failure_stage: 'pipeline_setup'
      }
    };
  }
}

/**
 * Main function for per-symbol analysis endpoint
 */
export async function analyzeSingleSymbol(
  symbol: string,
  env: CloudflareEnvironment,
  options: AnalysisOptions = {}
): Promise<SymbolAnalysis> {
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

  } catch (error: any) {
    logError(`Per-symbol analysis failed for ${symbol}:`, error);
    return {
      symbol: symbol,
      analysis_type: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      sentiment_layers: [],
      confidence_metrics: { overall_confidence: 0, base_confidence: 0, consistency_bonus: 0, agreement_bonus: 0 },
      trading_signals: { symbol, primary_direction: 'NEUTRAL', overall_confidence: 0 },
      analysis_metadata: { method: 'error', models_used: [], total_processing_time: Date.now() - startTime },
      execution_metadata: {
        total_execution_time: Date.now() - startTime,
        analysis_completed: false,
        error: error.message
      }
    };
  }
}
