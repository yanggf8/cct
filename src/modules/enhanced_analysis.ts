/**
 * Enhanced Analysis Module with Dual AI Comparison System - TypeScript
 * Simple, transparent dual AI system with GPT-OSS-120B and DistilBERT
 */
import { performDualAIComparison, batchDualAIAnalysis, type DualAIComparisonResult, type BatchDualAIAnalysisResult } from './dual-ai-analysis.js';
import { getFreeStockNews, type NewsArticle } from './free_sentiment_pipeline.js';
import { mapSentimentToDirection } from './sentiment-utils.js';
import { storeSymbolAnalysis, batchStoreAnalysisResults, trackCronHealth } from './data.js';
import { initLogging, logSentimentDebug, logKVDebug, logAIDebug, logSuccess, logError, logInfo, logWarn } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

// Type Definitions
export interface AnalysisOptions {
  triggerMode?: string;
  predictionHorizons?: any;
  currentTime?: Date;
  cronExecutionId?: string;
  marketData?: any;
  symbol?: string;
  [key: string]: any;
}

export interface SentimentResult {
  sentiment: string;
  confidence: number;
  reasoning?: string;
  source_count: number;
  method: string;
  fallback_used?: boolean;
  validation_triggered?: boolean;
  source?: string;
  model?: string;
  analysis_type?: string;
  cost_estimate?: {
    input_tokens: number;
    output_tokens: number;
    total_cost: number;
  };
  score?: number;
  sentiment_distribution?: any;
  processed_items?: number;
  error_details?: string;
}

export interface SentimentSignal {
  symbol: string;
  sentiment_analysis: {
    sentiment: string;
    confidence: number;
    reasoning: string;
    dual_ai_comparison?: any;
    error?: boolean;
    skip_technical?: boolean;
  };
  news_count: number;
  timestamp: string;
  method: string;
}

export interface EnhancedAnalysisResults {
  sentiment_signals: Record<string, SentimentSignal>;
  analysis_time: string;
  trigger_mode: string;
  symbols_analyzed: string[];
  dual_ai_statistics?: any;
  execution_metrics?: {
    total_time_ms: number;
    analysis_enabled: boolean;
    sentiment_sources: string[];
    cloudflare_ai_enabled: boolean;
    analysis_method: string;
  };
}

export interface ValidationResult {
  success: boolean;
  news_count?: number;
  sentiment?: string;
  confidence?: number;
  ai_available?: boolean;
  method?: string;
  debug_info?: any;
  error?: string;
}

export interface ParsedResponse {
  sentiment: string;
  confidence: number;
  reasoning?: string;
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
 * Run enhanced analysis with dual AI comparison system
 * Simple, transparent comparison between GPT-OSS-120B and DistilBERT
 */
export async function runEnhancedAnalysis(env: CloudflareEnvironment, options: AnalysisOptions = {}): Promise<EnhancedAnalysisResults> {
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
export async function getSentimentWithFallbackChain(
  symbol: string,
  newsData: NewsArticle[],
  env: CloudflareEnvironment
): Promise<SentimentResult> {
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

  } catch (error: any) {
    logError(`Sentiment analysis failed for ${symbol}:`, error);
    return {
      sentiment: 'neutral',
      confidence: 0,
      reasoning: `Analysis failed: ${error.message}`,
      source_count: 0,
      method: 'error_fallback',
      error_details: error.message
    };
  }
}

export async function getGPTOSSSentiment(symbol: string, newsData: NewsArticle[], env: CloudflareEnvironment): Promise<SentimentResult> {
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
      .slice(0, 10)
      .map((item: any, i: any) => `${i+1}. ${item.title}\n   ${item.summary || ''}`)
      .join('\n\n');

    const prompt = `Analyze the financial sentiment for ${symbol} stock based on these news headlines:

${newsContext}

Provide a detailed analysis with:
1. Overall sentiment (bullish, bearish, or neutral)
2. Confidence level (0.0 to 1.0)
3. Brief reasoning for the sentiment
4. Key market-moving factors

Be precise and focus on actionable trading insights.`;

    logAIDebug(`Calling Cloudflare AI Gemma Sea Lion for ${symbol}...`);

    const response = await env.AI.run(
      '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
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

    logAIDebug('Gemma Sea Lion response received:', response);

    if (!response || !response.response) {
      throw new Error('Empty response from GPT-OSS-120B');
    }

    const content = response.response;
    logAIDebug('GPT-OSS-120B content:', content);

    // Parse GPT-OSS-120B response
    const analysisData = parseNaturalLanguageResponse(content);

    const result: SentimentResult = {
      ...analysisData,
      source: 'cloudflare_gemma',
      method: 'gemma_sea_lion_primary',
      model: 'gemma-sea-lion-v4-27b-it',
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

  } catch (error: any) {
    logError(`GPT-OSS-120B sentiment analysis failed for ${symbol}:`, error);
    throw new Error(`GPT-OSS-120B analysis failed: ${error.message}`);
  }
}

/**
 * DistilBERT sentiment analysis (final fallback)
 */
export async function getDistilBERTSentiment(symbol: string, newsData: NewsArticle[], env: CloudflareEnvironment): Promise<SentimentResult> {
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
    const sentimentPromises = newsData.slice(0, 8).map(async (newsItem: any, index: any) => {
      try {
        const text = `${newsItem.title}. ${newsItem.summary || ''}`.substring(0, 500);

        const response = await env.AI.run(
          '@cf/huggingface/distilbert-sst-2-int8',
          { text: text }
        );

        const result = response[0] as { label?: string; score?: number };

        return {
          sentiment: result.label?.toLowerCase() || 'neutral',
          confidence: result.score || 0.5,
          score: (result.label === 'POSITIVE' ? result.score : -(result.score || 0)) || 0,
          text_analyzed: text,
          processing_order: index
        };

      } catch (error: any) {
        logError('Individual DistilBERT analysis failed:', error);
        return {
          sentiment: 'neutral',
          confidence: 0,
          score: 0,
          error: (error instanceof Error ? error.message : String(error))
        };
      }
    });

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
      const weight = result.confidence || 0.5;
      const score = result.score || 0;
      totalScore += score * weight;
      totalWeight += weight;

      if (score > 0.1) sentimentCounts.positive++;
      else if (score < -0.1) sentimentCounts.negative++;
      else sentimentCounts.neutral++;
    });

    const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const avgConfidence = totalWeight / validResults.length;

    // Map to trading sentiment
    let finalSentiment = 'neutral';
    if (avgScore > 0.1) finalSentiment = 'bullish';
    else if (avgScore < -0.1) finalSentiment = 'bearish';

    const result: SentimentResult = {
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
        input_tokens: validResults.length * 100,
        output_tokens: 0,
        total_cost: 0
      },
      sentiment_distribution: sentimentCounts,
      processed_items: validResults.length
    };

    logAIDebug(`DistilBERT sentiment analysis complete: ${result.sentiment} (${(result.confidence * 100).toFixed(1)}%)`);
    return result;

  } catch (error: any) {
    logError(`DistilBERT sentiment analysis failed for ${symbol}:`, error);
    throw new Error(`DistilBERT analysis failed: ${error.message}`);
  }
}

/**
 * Enhanced dual AI analysis for multiple symbols
 */
async function runDualAIAnalysisEnhanced(env: CloudflareEnvironment, options: AnalysisOptions = {}): Promise<EnhancedAnalysisResults> {
  const symbols = (env.TRADING_SYMBOLS || 'AAPL,MSFT,GOOGL,TSLA,NVDA').split(',').map((s: string) => s.trim());
  logInfo(`Starting dual AI analysis for ${symbols.length} symbols...`);

  // Use batch dual AI analysis
  const dualAIResult = await batchDualAIAnalysis(symbols, env, options);

  // Convert results to expected format
  const results: EnhancedAnalysisResults = {
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
 */
export async function runEnhancedPreMarketAnalysis(env: CloudflareEnvironment, options: AnalysisOptions = {}): Promise<any> {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo('🚀 Starting Enhanced Pre-Market Analysis with Dual AI Comparison...');

  const symbolsString = env.TRADING_SYMBOLS || 'AAPL,MSFT,GOOGL,TSLA,NVDA';
  const symbols = symbolsString.split(',').map((s: string) => s.trim());

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
  await trackCronHealth(env, 'success', {
    totalTime: pipelineResult.pipeline_summary.total_execution_time,
    symbolsProcessed: pipelineResult.pipeline_summary.analysis_statistics.total_symbols,
    symbolsSuccessful: pipelineResult.pipeline_summary.analysis_statistics.successful_full_analysis,
    symbolsFallback: 0,
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
function calculateDualAIConfidence(dualAIResult: DualAIComparisonResult): number {
  const gptConf = dualAIResult.models?.gpt?.confidence || 0;
  const dbConf = dualAIResult.models?.distilbert?.confidence || 0;
  const baseConf = (gptConf + dbConf) / 2;

  if (dualAIResult.comparison?.agree) {
    return Math.min(0.95, baseConf + 0.15);
  }

  if (dualAIResult.comparison?.agreement_type === 'disagreement') {
    return Math.max(0.05, baseConf - 0.2);
  }

  return Math.min(0.9, baseConf + 0.05);
}

/**
 * Convert new pipeline results to legacy format for Facebook message compatibility
 */
function convertPipelineToLegacyFormat(pipelineResult: any, options: AnalysisOptions): any {
  const tradingSignals: Record<string, any> = {};
  const symbols_analyzed: string[] = [];

  for (const result of pipelineResult.analysis_results) {
    if (result && result.symbol) {
      symbols_analyzed.push(result.symbol);

      tradingSignals[result.symbol] = {
        symbol: result.symbol,
        predicted_price: null,
        current_price: null,
        direction: result.trading_signals?.primary_direction || 'NEUTRAL',
        confidence: result.confidence_metrics?.overall_confidence || 0.5,
        model: 'dual_ai_comparison',

        sentiment_layers: result.sentiment_layers,
        trading_signals: result.trading_signals,
        confidence_metrics: result.confidence_metrics,
        sentiment_patterns: result.sentiment_patterns,
        analysis_metadata: result.analysis_metadata,

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

        analysis_type: result.analysis_type || 'dual_ai_comparison',
        fallback_used: false
      };
    }
  }

  return {
    symbols_analyzed,
    trading_signals: tradingSignals,

    pre_market_analysis: {
      trigger_mode: options.triggerMode,
      prediction_horizons: options.predictionHorizons,
      execution_time_ms: pipelineResult.pipeline_summary.total_execution_time,
      enhancement_enabled: true,
      batch_pipeline_used: true,
      symbols_processed: pipelineResult.pipeline_summary.analysis_statistics.total_symbols,
      success_rate: pipelineResult.pipeline_summary.analysis_success_rate,
      performance_metrics: pipelineResult.pipeline_summary.performance_metrics,
      storage_operations: pipelineResult.pipeline_summary.storage_statistics.total_operations,
      storage_successful: pipelineResult.pipeline_summary.storage_statistics.successful_operations,
      dual_ai_metrics: pipelineResult.pipeline_summary.dual_ai_metrics
    },

    analysis_statistics: {
      total_symbols: pipelineResult.pipeline_summary.analysis_statistics.total_symbols,
      successful_full_analysis: pipelineResult.pipeline_summary.analysis_statistics.successful_full_analysis,
      fallback_sentiment_used: 0,
      neutral_fallback_used: pipelineResult.pipeline_summary.analysis_statistics.neutral_fallback_used,
      overall_success: pipelineResult.pipeline_summary.overall_success,
      dual_ai_specific: pipelineResult.pipeline_summary.analysis_statistics.dual_ai_specific
    }
  };
}

/**
 * Phase 1 validation: Check if sentiment enhancement is working
 */
export async function validateSentimentEnhancement(env: CloudflareEnvironment): Promise<ValidationResult> {
  const testSymbol = 'AAPL';
  logInfo(`Testing sentiment enhancement for ${testSymbol}...`);

  try {
    const newsData = await getFreeStockNews(testSymbol, env);
    logInfo(`News data: ${newsData.length} articles found`);

    const sentimentResult = await getSentimentWithFallbackChain(testSymbol, newsData, env);
    logInfo(`Sentiment: ${sentimentResult.sentiment} (${(sentimentResult.confidence * 100).toFixed(1)}%)`);

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
      ai_available: gptSuccess,
      method: sentimentResult.method || sentimentResult.source || 'unknown',
      debug_info: {
        cloudflare_ai_available: !!env.AI,
        sentiment_source: sentimentResult.source,
        sentiment_method: sentimentResult.method,
        has_error_details: !!sentimentResult.error_details,
        result_confidence: sentimentResult.confidence
      }
    };

  } catch (error: any) {
    logError('Sentiment enhancement validation failed:', error);
    return {
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      ai_available: !!env.AI
    };
  }
}

/**
 * Helper: Parse natural language response
 */
function parseNaturalLanguageResponse(content: string): ParsedResponse {
  // Simplified parsing - extract sentiment and confidence
  const sentimentMatch = content.match(/(bullish|bearish|neutral)/i);
  const confidenceMatch = content.match(/confidence[:\s]*(\d*\.?\d+)/i);

  return {
    sentiment: sentimentMatch ? sentimentMatch[1].toLowerCase() : 'neutral',
    confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
    reasoning: content.substring(0, 200)
  };
}

/**
 * Helper: Analyze text sentiment (rule-based fallback)
 */
function analyzeTextSentiment(newsData: NewsArticle[], symbol: string): SentimentResult {
  const bullishKeywords = ['up', 'rise', 'gain', 'growth', 'positive', 'bullish', 'buy', 'strong'];
  const bearishKeywords = ['down', 'fall', 'loss', 'decline', 'negative', 'bearish', 'sell', 'weak'];

  let bullishCount = 0;
  let bearishCount = 0;

  newsData.forEach(article => {
    const text = `${article.title} ${article.summary || ''}`.toLowerCase();
    bullishKeywords.forEach(kw => { if (text.includes(kw)) bullishCount++; });
    bearishKeywords.forEach(kw => { if (text.includes(kw)) bearishCount++; });
  });

  const totalCount = bullishCount + bearishCount;
  let sentiment = 'neutral';
  let confidence = 0.3;

  if (totalCount > 0) {
    if (bullishCount > bearishCount) {
      sentiment = 'bullish';
      confidence = Math.min(0.7, bullishCount / totalCount);
    } else if (bearishCount > bullishCount) {
      sentiment = 'bearish';
      confidence = Math.min(0.7, bearishCount / totalCount);
    }
  }

  return {
    sentiment,
    confidence,
    reasoning: `Rule-based analysis: ${bullishCount} bullish, ${bearishCount} bearish keywords`,
    source_count: newsData.length,
    method: 'rule_based'
  };
}
