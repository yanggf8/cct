// @ts-ignore - Suppressing TypeScript errors

/**
 * Dual AI Comparison Analysis Module - TypeScript
 * Simple, transparent dual AI system that runs GPT-OSS-120B and DistilBERT side-by-side
 * and reports whether they agree or disagree with clear decision rules.
 */

import { getFreeStockNews, type NewsArticle } from './free_sentiment_pipeline.js';
import { parseNaturalLanguageResponse, mapSentimentToDirection } from './sentiment-utils.js';
import { initLogging, logInfo, logError, logAIDebug } from './logging.js';
import { CircuitBreakerFactory } from './circuit-breaker.js';
import { executeOptimizedBatch } from './enhanced-batch-operations.js';
import { handleAIError, handleError } from '../utils/error-handling-migration.js';
import type { CloudflareEnvironment, CloudflareAI } from '../types.js';

// Type Definitions
export type Direction = 'up' | 'down' | 'neutral' | 'bullish' | 'bearish' | 'UNCLEAR';
export type AgreementType = 'full_agreement' | 'partial_agreement' | 'disagreement' | 'error';
export type SignalType = 'AGREEMENT' | 'PARTIAL_AGREEMENT' | 'DISAGREEMENT' | 'ERROR';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'FAILED';
export type SignalAction = 'STRONG_BUY' | 'BUY' | 'WEAK_BUY' | 'STRONG_SELL' | 'SELL' | 'WEAK_SELL' | 'CONSIDER' | 'HOLD' | 'AVOID' | 'SKIP';

export interface ModelResult {
  model: string;
  direction: Direction;
  confidence: number;
  reasoning: string;
  response_time_ms?: number;
  error?: string;
  raw_response?: string;
  articles_analyzed?: number;
  analysis_type?: string;
  sentiment_breakdown?: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  individual_results?: Array<{
    index: number;
    sentiment: string;
    confidence: number;
    title?: string;
    error?: string;
  }>;
}

export interface AgreementDetails {
  match_direction?: Direction;
  confidence_spread?: number;
  gpt_direction?: Direction;
  distilbert_direction?: Direction;
  dominant_direction?: Direction;
  error?: string;
}

export interface Agreement {
  agree: boolean;
  type: AgreementType;
  details: AgreementDetails;
}

export interface Signal {
  type: SignalType;
  direction: Direction;
  strength: SignalStrength;
  reasoning: string;
  action: SignalAction;
  source_models?: string[]; // Which models contributed to this signal
}

export interface PerformanceMetrics {
  total_time: number;
  models_executed: number;
  successful_models: number;
}

export interface DualAIComparisonResult {
  symbol: string;
  timestamp: string;
  execution_time_ms?: number;
  error?: string;
  models: {
    gpt: ModelResult | null;
    distilbert: ModelResult | null;
  };
  comparison: {
    agree: boolean;
    agreement_type: AgreementType;
    match_details: AgreementDetails;
  };
  signal: Signal;
  performance_metrics?: PerformanceMetrics;
}

export interface BatchAnalysisResult {
  symbol: string;
  success: boolean;
  result?: DualAIComparisonResult;
  newsCount?: number;
  error?: string;
}

export interface BatchStatistics {
  total_symbols: number;
  full_agreement: number;
  partial_agreement: number;
  disagreement: number;
  errors: number;
}

export interface BatchDualAIAnalysisResult {
  results: DualAIComparisonResult[];
  statistics: BatchStatistics;
  execution_metadata: {
    total_execution_time: number;
    symbols_processed: number;
    agreement_rate: number;
    success_rate: number;
  };
}

export interface BatchAnalysisOptions {
  [key: string]: any;
}

/**
 * Extract text from AI response - handles multiple formats
 */
function extractAIResponseText(response: any): string {
  if (!response) return '';
  
  // OpenAI-compatible format (Gemma Sea Lion)
  if (response.choices?.[0]?.message?.content) {
    return response.choices[0].message.content;
  }
  
  // Legacy format (openchat)
  if (response.response) {
    return response.response;
  }
  
  // Direct string
  if (typeof response === 'string') {
    return response;
  }
  
  return JSON.stringify(response);
}

// Initialize logging for this module
let loggingInitialized = false;

function ensureLoggingInitialized(env: CloudflareEnvironment): void {
  if (!loggingInitialized && env) {
    initLogging(env);
    loggingInitialized = true;
  }
}

// Get AI model circuit breakers
function getAICircuitBreakers() {
  return {
    gpt: CircuitBreakerFactory.getInstance('ai-model-gpt', {
      failureThreshold: 3,
      successThreshold: 2,
      openTimeout: 60000, // 1 minute
      halfOpenTimeout: 30000, // 30 seconds
      halfOpenMaxCalls: 3,
      resetTimeout: 300000 // 5 minutes
    }),
    distilbert: CircuitBreakerFactory.getInstance('ai-model-distilbert', {
      failureThreshold: 3,
      successThreshold: 2,
      openTimeout: 60000, // 1 minute
      halfOpenTimeout: 30000, // 30 seconds
      halfOpenMaxCalls: 3,
      resetTimeout: 300000 // 5 minutes
    })
  };
}

/**
 * Main dual AI comparison function
 * Runs both AI models in parallel and provides simple comparison
 */
export async function performDualAIComparison(
  symbol: string,
  newsData: NewsArticle[],
  env: CloudflareEnvironment
): Promise<DualAIComparisonResult> {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo(`Starting dual AI comparison for ${symbol}...`);

  try {
    // Run both AI models independently and in parallel
    const [gptResult, distilBERTResult] = await Promise.all([
      performGPTAnalysis(symbol, newsData, env),
      performDistilBERTAnalysis(symbol, newsData, env)
    ]);

    // Simple agreement check
    const agreement = checkAgreement(gptResult as any, distilBERTResult);

    // Generate trading signal based on simple rules
    const signal = generateSignal(agreement as any, gptResult, distilBERTResult);

    const executionTime = Date.now() - startTime;

    return {
      symbol,
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTime,

      // Individual model results
      models: {
        gpt: gptResult,
        distilbert: distilBERTResult
      },

      // Simple comparison
      comparison: {
        agree: agreement.agree,
        agreement_type: agreement.type,
        match_details: agreement.details
      },

      // Clear signal based on agreement
      signal: signal,

      // Performance tracking
      performance_metrics: {
        total_time: executionTime,
        models_executed: 2,
        successful_models: [gptResult, distilBERTResult].filter(r => !r.error).length
      }
    };

  } catch (error: any) {
    logError(`Dual AI comparison failed for ${symbol}:`, error);
    return {
      symbol,
      timestamp: new Date().toISOString(),
      error: error.message,
      models: { gpt: null, distilbert: null },
      comparison: { agree: false, agreement_type: 'error', match_details: { error: error.message } },
      signal: { type: 'ERROR', direction: 'UNCLEAR', strength: 'FAILED', action: 'SKIP', reasoning: `Analysis failed: ${error.message}`, source_models: [] }
    };
  }
}

/**
 * Retry utility for AI calls with exponential backoff
 */
async function retryAIcall<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === maxRetries - 1) throw error;

      // Don't retry on certain errors
      if ((error instanceof Error ? error.message : String(error)).includes('invalid') || (error instanceof Error ? error.message : String(error)).includes('authentication')) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * GPT Analysis with timeout protection and retry logic
 */
async function performGPTAnalysis(symbol: string, newsData: NewsArticle[], env: CloudflareEnvironment): Promise<ModelResult> {
  if (!newsData || newsData.length === 0) {
    return {
      model: 'gpt-oss-120b',
      direction: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      error: 'No data'
    };
  }

  try {
    const callStart = Date.now();
    const topArticles = newsData.slice(0, 8);
    const newsContext = topArticles
      .map((item: any, i: any) => `${i+1}. ${item.title}\n   ${item.summary || ''}\n   Source: ${item.source}`)
      .join('\n\n');

    const prompt = `As a financial analyst specializing in ${symbol}, analyze these news articles and respond in this exact JSON format:

{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0.XX,  // decimal between 0.0 and 1.0, REQUIRED
  "reasoning": "brief explanation"
}

${newsContext}

Respond ONLY with valid JSON, no other text.`;

    // Add circuit breaker, timeout protection and retry logic
    const circuitBreaker = getAICircuitBreakers().gpt;
    const response = await retryAIcall(async () => {
      return await circuitBreaker.execute(async () => {
        return await Promise.race([
          env.AI.run('@cf/aisingapore/gemma-sea-lion-v4-27b-it', {
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 600
          }),
          new Promise((_: any, reject: any) =>
            setTimeout(() => reject(new Error('AI model timeout')), 30000) // 30s timeout
          )
        ]);
      });
    });

    // Extract response text - handle both formats
    const responseText = extractAIResponseText(response);
    const analysisData = parseNaturalLanguageResponse(responseText);
    const responseTimeMs = Date.now() - callStart;

    return {
      model: 'gemma-sea-lion-27b',
      direction: mapSentimentToDirection(analysisData.sentiment) as Direction,
      confidence: analysisData.confidence,
      reasoning: analysisData.reasoning || 'No detailed reasoning provided',
      raw_response: responseText,
      articles_analyzed: topArticles.length,
      analysis_type: 'contextual_analysis',
      response_time_ms: responseTimeMs
    };

  } catch (error: any) {
    logError(`GPT analysis failed for ${symbol}:`, error);

    // Handle timeout and circuit breaker specifically
    if (error.message === 'AI model timeout') {
      return {
        model: 'gpt-oss-120b',
        direction: 'neutral',
        confidence: 0,
        reasoning: 'Model timed out - temporary issue',
        error: 'TIMEOUT'
      };
    }

    if (error.message.includes('Circuit breaker is OPEN')) {
      return {
        model: 'gpt-oss-120b',
        direction: 'neutral',
        confidence: 0,
        reasoning: 'AI model temporarily unavailable - circuit breaker active',
        error: 'CIRCUIT_BREAKER_OPEN'
      };
    }

    return {
      model: 'gpt-oss-120b',
      direction: 'neutral',
      confidence: 0,
      reasoning: `Analysis failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * DistilBERT Analysis with timeout protection and retry logic
 */
async function performDistilBERTAnalysis(symbol: string, newsData: NewsArticle[], env: CloudflareEnvironment): Promise<ModelResult> {
  if (!newsData || newsData.length === 0) {
    return {
      model: 'distilbert-sst-2-int8',
      direction: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      error: 'No data'
    };
  }

  try {
    const callStart = Date.now();
    const results = await Promise.all(
      newsData.slice(0, 10).map(async (article: any, index: any) => {
        try {
          const text = `${article.title}. ${article.summary || ''}`.substring(0, 500);

          // Add circuit breaker, timeout protection and retry logic for each article
          const circuitBreaker = getAICircuitBreakers().distilbert;
          const response = await retryAIcall(async () => {
            return await circuitBreaker.execute(async () => {
              return await Promise.race([
                env.AI.run(
                  '@cf/huggingface/distilbert-sst-2-int8',
                  { text: text }
                ),
                new Promise((_: any, reject: any) =>
                  setTimeout(() => reject(new Error('DistilBERT model timeout')), 20000) // 20s timeout
                )
              ]);
            });
          });

          const result = (Array.isArray(response) ? response[0] : response) as { label?: string; score?: number };
          // DistilBERT returns [{label: "NEGATIVE", score}, {label: "POSITIVE", score}]
          // Find the label with highest score
          let bestResult = result;
          if (Array.isArray(response) && response.length > 1) {
            bestResult = response.reduce((best: any, curr: any) => 
              (curr.score || 0) > (best.score || 0) ? curr : best
            );
          }
          return {
            index,
            sentiment: bestResult.label?.toLowerCase() || 'neutral',
            confidence: bestResult.score || 0.5,
            title: (article as any).title.substring(0, 100)
          };
        } catch (error: any) {
          // Handle timeout specifically
          if ((error instanceof Error ? error.message : String(error)) === 'DistilBERT model timeout') {
            return { index, sentiment: 'neutral', confidence: 0, error: 'TIMEOUT' };
          }
          return { index, sentiment: 'neutral', confidence: 0, error: error.message };
        }
      })
    );

    // Simple aggregation
    const validResults = results.filter(r => !r.error);
    const bullishCount = validResults.filter(r => r.sentiment === 'positive').length;
    const bearishCount = validResults.filter(r => r.sentiment === 'negative').length;

    let direction: Direction = 'neutral';
    if (bullishCount > bearishCount * 1.5) direction = 'bullish';
    else if (bearishCount > bullishCount * 1.5) direction = 'bearish';

    const avgConfidence = validResults.reduce((sum: any, r: any) => sum + r.confidence, 0) / validResults.length;
    const responseTimeMs = Date.now() - callStart;

    return {
      model: 'distilbert-sst-2-int8',
      direction: mapSentimentToDirection(direction) as Direction,
      confidence: avgConfidence,
      reasoning: `Sentiment classification based on ${validResults.length} articles`,
      articles_analyzed: validResults.length,
      sentiment_breakdown: {
        bullish: bullishCount,
        bearish: bearishCount,
        neutral: validResults.length - bullishCount - bearishCount
      },
      individual_results: validResults,
      analysis_type: 'sentiment_classification',
      response_time_ms: responseTimeMs
    };

  } catch (error: any) {
    logError(`DistilBERT analysis failed for ${symbol}:`, error);

    // Handle timeout and circuit breaker specifically
    if (error.message.includes('timeout')) {
      return {
        model: 'distilbert-sst-2-int8',
        direction: 'neutral',
        confidence: 0,
        reasoning: 'Model timed out - temporary issue',
        error: 'TIMEOUT'
      };
    }

    if (error.message.includes('Circuit breaker is OPEN')) {
      return {
        model: 'distilbert-sst-2-int8',
        direction: 'neutral',
        confidence: 0,
        reasoning: 'AI model temporarily unavailable - circuit breaker active',
        error: 'CIRCUIT_BREAKER_OPEN'
      };
    }

    return {
      model: 'distilbert-sst-2-int8',
      direction: 'neutral',
      confidence: 0,
      reasoning: `Analysis failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Simple Agreement Check
 */
function checkAgreement(gptResult: ModelResult, distilBERTResult: ModelResult): Agreement {
  const gptDir = gptResult.direction;
  const dbDir = distilBERTResult.direction;

  // Full agreement: same direction
  if (gptDir === dbDir) {
    return {
      agree: true,
      type: 'full_agreement',
      details: {
        match_direction: gptDir,
        confidence_spread: Math.abs(gptResult.confidence - distilBERTResult.confidence)
      }
    };
  }

  // Partial agreement: neutral vs directional
  if (gptDir === 'neutral' || dbDir === 'neutral') {
    return {
      agree: false,
      type: 'partial_agreement',
      details: {
        gpt_direction: gptDir,
        distilbert_direction: dbDir,
        dominant_direction: gptDir === 'neutral' ? dbDir : gptDir
      }
    };
  }

  // Full disagreement: opposite directions
  return {
    agree: false,
    type: 'disagreement',
    details: {
      gpt_direction: gptDir,
      distilbert_direction: dbDir,
      confidence_spread: Math.abs(gptResult.confidence - distilBERTResult.confidence)
    }
  };
}

/**
 * Simple Signal Generation Rules
 */
function generateSignal(agreement: Agreement, gptResult: ModelResult, distilBERTResult: ModelResult): Signal {
  const gptOk = !gptResult.error && gptResult.confidence > 0;
  const dbOk = !distilBERTResult.error && distilBERTResult.confidence > 0;
  
  // Track which models actually contributed
  const sourceModels: string[] = [];
  if (gptOk) sourceModels.push('gemma-sea-lion-v4-27b-it');
  if (dbOk) sourceModels.push('distilbert-sst-2-int8');

  if (agreement.agree) {
    return {
      type: 'AGREEMENT',
      direction: gptResult.direction,
      strength: calculateAgreementStrength(gptResult.confidence, distilBERTResult.confidence),
      reasoning: `Both AI models agree on ${gptResult.direction} sentiment`,
      action: getActionForAgreement(gptResult.direction, gptResult.confidence, distilBERTResult.confidence),
      source_models: sourceModels
    };
  }

  if (agreement.type === 'partial_agreement') {
    const directionalModel = gptResult.direction === 'neutral' ? distilBERTResult : gptResult;
    return {
      type: 'PARTIAL_AGREEMENT',
      direction: directionalModel.direction,
      strength: 'MODERATE',
      reasoning: `Mixed signals: ${(agreement.details as any).gpt_direction} vs ${(agreement.details as any).distilbert_direction}`,
      action: directionalModel.confidence > 0.7 ? 'CONSIDER' : 'HOLD',
      source_models: sourceModels
    };
  }

  return {
    type: 'DISAGREEMENT',
    direction: 'UNCLEAR',
    strength: 'WEAK',
    reasoning: `Models disagree: GPT says ${gptResult.direction}, DistilBERT says ${distilBERTResult.direction}`,
    action: 'AVOID',
    source_models: sourceModels
  };
}

/**
 * Action rules for agreement signals
 */
function getActionForAgreement(direction: Direction, gptConfidence: number, dbConfidence: number): SignalAction {
  const avgConfidence = (gptConfidence + dbConfidence) / 2;

  if (avgConfidence >= 0.8) {
    return direction === 'bullish' ? 'STRONG_BUY' : 'STRONG_SELL';
  } else if (avgConfidence >= 0.6) {
    return direction === 'bullish' ? 'BUY' : 'SELL';
  } else {
    return direction === 'bullish' ? 'WEAK_BUY' : 'WEAK_SELL';
  }
}

/**
 * Calculate agreement strength
 */
function calculateAgreementStrength(gptConfidence: number, dbConfidence: number): SignalStrength {
  const avgConfidence = (gptConfidence + dbConfidence) / 2;
  if (avgConfidence >= 0.8) return 'STRONG';
  if (avgConfidence >= 0.6) return 'MODERATE';
  return 'WEAK';
}

/**
 * Batch dual AI analysis for multiple symbols
 */
export async function batchDualAIAnalysis(
  symbols: string[],
  env: CloudflareEnvironment,
  options: BatchAnalysisOptions = {}
): Promise<BatchDualAIAnalysisResult> {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo(`Starting batch dual AI analysis for ${symbols.length} symbols (sequential mode)...`);

  const results: DualAIComparisonResult[] = [];
  const statistics: BatchStatistics = {
    total_symbols: symbols.length,
    full_agreement: 0,
    partial_agreement: 0,
    disagreement: 0,
    errors: 0
  };

  // Process symbols SEQUENTIALLY to avoid rate limits
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    
    try {
      logAIDebug(`Analyzing ${symbol} (${i + 1}/${symbols.length}) with dual AI...`);

      // Get news data
      const newsData = await getFreeStockNews(symbol, env);

      // Run dual AI comparison with rate limit retry
      const dualAIResult = await performDualAIComparisonWithRetry(symbol, newsData, env);

      // Track statistics
      if (dualAIResult.error) {
        statistics.errors++;
      } else if ((dualAIResult.comparison as any).agree) {
        statistics.full_agreement++;
      } else if ((dualAIResult.comparison as any).agreement_type === 'partial_agreement') {
        statistics.partial_agreement++;
      } else {
        statistics.disagreement++;
      }

      results.push(dualAIResult);

    } catch (error: any) {
      logError(`Dual AI analysis failed for ${symbol}:`, error);
      statistics.errors++;
      results.push({
        symbol,
        timestamp: new Date().toISOString(),
        error: error.message,
        models: { gpt: null, distilbert: null },
        comparison: { agree: false, agreement_type: 'error', match_details: { error: error.message } },
        signal: { type: 'ERROR', direction: 'UNCLEAR', strength: 'FAILED', action: 'SKIP', reasoning: `Analysis failed: ${error.message}`, source_models: [] }
      });
    }

    // Delay between symbols to respect rate limits (3s base + jitter)
    if (i < symbols.length - 1) {
      const delay = 3000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  const totalTime = Date.now() - startTime;
  logInfo(`Batch dual AI analysis completed in ${totalTime}ms: ${statistics.full_agreement} agreements, ${statistics.errors} errors`);

  return {
    results,
    statistics,
    execution_metadata: {
      total_execution_time: totalTime,
      symbols_processed: results.length,
      agreement_rate: statistics.full_agreement / symbols.length,
      success_rate: (symbols.length - statistics.errors) / symbols.length
    }
  };
}

/**
 * Perform dual AI comparison with rate limit aware retry
 */
async function performDualAIComparisonWithRetry(
  symbol: string,
  newsData: NewsArticle[],
  env: CloudflareEnvironment,
  maxRetries: number = 3
): Promise<DualAIComparisonResult> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await performDualAIComparison(symbol, newsData, env);
      
      // Check if we got rate limited (both models failed)
      const gptFailed = result.models?.gpt?.error;
      const dbFailed = result.models?.distilbert?.error;
      
      if (gptFailed && dbFailed && attempt < maxRetries - 1) {
        // Both failed - likely rate limited, wait and retry
        const waitTime = (attempt + 1) * 5000 + Math.random() * 2000; // 5s, 10s, 15s + jitter
        logInfo(`Rate limit detected for ${symbol}, waiting ${Math.round(waitTime/1000)}s before retry ${attempt + 2}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Check for rate limit error
      if (error.message?.includes('rate') || error.message?.includes('429') || error.message?.includes('quota')) {
        const waitTime = (attempt + 1) * 5000 + Math.random() * 2000;
        logInfo(`Rate limit error for ${symbol}, waiting ${Math.round(waitTime/1000)}s before retry ${attempt + 2}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Enhanced batch dual AI analysis with optimized caching and deduplication
 * Provides 50-70% reduction in API calls and KV operations
 */
export async function enhancedBatchDualAIAnalysis(
  symbols: string[],
  env: CloudflareEnvironment,
  options: BatchAnalysisOptions & {
    enableOptimizedBatch?: boolean;
    cacheKey?: string;
    batchSize?: number;
  } = {}
): Promise<BatchDualAIAnalysisResult & { optimization?: any }> {
  const startTime = Date.now();
  ensureLoggingInitialized(env);

  // If optimization is disabled, use original function
  if (!options.enableOptimizedBatch) {
    return await batchDualAIAnalysis(symbols,  env,  options);
  }

  logInfo(`Starting enhanced batch dual AI analysis for ${symbols.length} symbols with optimization...`);

  // Create cache key for batch
  const cacheKey = options.cacheKey || `batch_dual_ai_${symbols.join(',')}_${new Date().toISOString().split('T')[0]}`;

  // Prepare batch items for optimized processing
  const batchItems = symbols.map(symbol => ({
    key: symbol,
    operation: async () => {
      try {
        logAIDebug(`Analyzing ${symbol} with enhanced batch dual AI...`);

        // Get news data
        const newsData = await getFreeStockNews(symbol,  env);

        // Run dual AI comparison
        const dualAIResult = await performDualAIComparison(symbol,  newsData,  env);

        return {
          symbol,
          success: !dualAIResult.error,
          result: dualAIResult,
          newsCount: newsData?.length || 0
        };

      } catch (error: any) {
        logError(`Enhanced batch dual AI analysis failed for ${symbol}:`, error);
        return {
          symbol,
          success: false,
          error: error.message
        };
      }
    }
  }));

  // Execute optimized batch operation
  const batchResult = await executeOptimizedBatch(env,  batchItems,  {
    batchSize: options.batchSize || 3, // Conservative for AI rate limits
    cacheKey,
    customTTL: 3600, // 1 hour cache for AI analysis results
    enableCache: true
  });

  // Process results and create standard format
  const results: DualAIComparisonResult[] = [];
  const statistics: BatchStatistics = {
    total_symbols: symbols.length,
    full_agreement: 0,
    partial_agreement: 0,
    disagreement: 0,
    errors: 0
  };

  for (const item of batchResult.items) {
    if (item.success && item.data) {
      const analysisData = item.data as any;

      if (analysisData.result) {
        results.push(analysisData.result);

        // Track statistics
        if ((analysisData.result as any).error) {
          statistics.errors++;
        } else if ((analysisData.result as any).comparison.agree) {
          statistics.full_agreement++;
        } else if ((analysisData.result as any).comparison.agreement_type === 'partial_agreement') {
          statistics.partial_agreement++;
        } else {
          statistics.disagreement++;
        }
      }
    } else {
      // Create error result
      results.push({
        symbol: item.key,
        timestamp: new Date().toISOString(),
        error: item.error || 'Unknown error',
        models: { gpt: null, distilbert: null },
        comparison: { agree: false, agreement_type: 'error', match_details: { error: item.error } },
        signal: { type: 'ERROR', direction: 'UNCLEAR', strength: 'FAILED', action: 'SKIP', reasoning: `Enhanced batch analysis failed: ${item.error || 'Unknown error'}`, source_models: [] }
      });
      statistics.errors++;
    }
  }

  const totalTime = Date.now() - startTime;
  logInfo(`Enhanced batch dual AI analysis completed in ${totalTime}ms: ${statistics.full_agreement} agreements, ${statistics.disagreement} disagreements`);

  return {
    results,
    statistics,
    execution_metadata: {
      total_execution_time: totalTime,
      symbols_processed: results.length,
      agreement_rate: statistics.full_agreement / symbols.length,
      success_rate: (symbols.length - statistics.errors) / symbols.length
    },
    optimization: {
      enabled: true,
      statistics: batchResult.statistics,
      performance: batchResult.performance,
      cacheHitRate: batchResult.statistics.cacheHitRate,
      kvReduction: batchResult.statistics.kvReduction,
      timeSaved: batchResult.statistics.cachedItems * 2000, // Estimate 2s saved per cached item
      batchEfficiency: Math.round(((batchResult.statistics.successfulItems / (batchResult.statistics.totalItems)) * 100))
    }
  };
}
