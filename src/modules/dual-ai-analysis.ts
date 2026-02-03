// @ts-ignore - Suppressing TypeScript errors

/**
 * Dual AI Comparison Analysis Module - TypeScript
 * Simple, transparent dual AI system that runs two models side-by-side
 * and reports whether they agree or disagree with clear decision rules.
 * 
 * MODEL NAMING CONVENTION:
 * - "primary" field = GPT-OSS 120B (@cf/openai/gpt-oss-120b)
 * - "mate" field = DeepSeek-R1 (@cf/deepseek-ai/deepseek-r1-distill-qwen-32b)
 */

import { getFreeStockNews, type NewsArticle } from './free_sentiment_pipeline.js';
import { getFreeStockNewsWithErrorTracking, type NewsFetchResult } from './free-stock-news-with-error-tracking.js';
import type { ErrorSummary } from './news-provider-error-aggregator.js';
import { parseNaturalLanguageResponse, mapSentimentToDirection } from './sentiment-utils.js';
import { initLogging, logInfo, logError, logAIDebug } from './logging.js';
import { CircuitBreakerFactory } from './circuit-breaker.js';
import { executeOptimizedBatch } from './enhanced-batch-operations.js';
import { handleAIError, handleError } from '../utils/error-handling-migration.js';
import type { CloudflareEnvironment, CloudflareAI } from '../types.js';

// Type Definitions
export type Direction = 'up' | 'down' | 'neutral' | 'bullish' | 'bearish';
export type AgreementType = 'full_agreement' | 'partial_agreement' | 'disagreement' | 'error';
export type SignalType = 'AGREEMENT' | 'PARTIAL_AGREEMENT' | 'DISAGREEMENT' | 'ERROR';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'FAILED';
export type SignalAction = 'STRONG_BUY' | 'BUY' | 'WEAK_BUY' | 'STRONG_SELL' | 'SELL' | 'WEAK_SELL' | 'CONSIDER' | 'HOLD' | 'AVOID' | 'SKIP';

export interface ModelResult {
  model: string;
  direction: Direction;
  confidence: number | null;  // null = failed/no data, number = valid confidence
  reasoning: string;
  response_time_ms?: number;
  error?: string;
  raw_response?: string;
  articles_analyzed?: number;
  articles_titles?: string[];
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
  primary_direction?: Direction;
  mate_direction?: Direction;
  dominant_direction?: Direction;
  winner_model?: 'primary' | 'mate';
  winner_confidence?: number | null;
  loser_confidence?: number | null;
  primary_confidence?: number | null;
  mate_confidence?: number | null;
  is_tie?: boolean;
  is_perfect_tie?: boolean;
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
    primary: ModelResult | null;
    mate: ModelResult | null;
  };
  comparison: {
    agree: boolean;
    agreement_type: AgreementType;
    match_details: AgreementDetails;
  };
  signal: Signal;
  performance_metrics?: PerformanceMetrics;
  news_fetch_errors?: ErrorSummary | null;  // Tracks which news providers failed (DAC/FMP/NewsAPI/Yahoo)
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
    primary: CircuitBreakerFactory.getInstance('ai-model-primary', {
      failureThreshold: 3,
      successThreshold: 2,
      openTimeout: 60000, // 1 minute
      halfOpenTimeout: 30000, // 30 seconds
      halfOpenMaxCalls: 3,
      resetTimeout: 300000 // 5 minutes
    }),
    mate: CircuitBreakerFactory.getInstance('ai-model-mate', {
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
    const [primaryResult, mateResult] = await Promise.all([
      performPrimaryAnalysis(symbol, newsData, env),
      performMateAnalysis(symbol, newsData, env)
    ]);

    // Simple agreement check
    const agreement = checkAgreement(primaryResult as any, mateResult);

    // Generate trading signal based on simple rules
    const signal = generateSignal(agreement as any, primaryResult, mateResult);

    const executionTime = Date.now() - startTime;

    return {
      symbol,
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTime,

      // Individual model results
      models: {
        primary: primaryResult,
        mate: mateResult
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
        successful_models: [primaryResult, mateResult].filter(r => !r.error).length
      }
    };

  } catch (error: any) {
    logError(`Dual AI comparison failed for ${symbol}:`, error);
    return {
      symbol,
      timestamp: new Date().toISOString(),
      error: error.message,
      models: { primary: null, mate: null },
      comparison: { agree: false, agreement_type: 'error', match_details: { error: error.message } },
      signal: { type: 'ERROR', direction: 'neutral', strength: 'FAILED', action: 'SKIP', reasoning: `Analysis failed: ${error.message}`, source_models: [] }
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
 * Primary Model Analysis (GPT-OSS 120B) with timeout protection and retry logic
 */
async function performPrimaryAnalysis(symbol: string, newsData: NewsArticle[], env: CloudflareEnvironment): Promise<ModelResult> {
  if (!newsData || newsData.length === 0) {
    return {
      model: 'gpt-oss-120b',
      direction: 'neutral',
      confidence: null,  // null = no data/failed
      reasoning: 'No news data available',
      error: 'No data'
    };
  }

  try {
    const callStart = Date.now();
    const topArticles = newsData.slice(0, 5);
    const newsContext = topArticles
      .map((item: any, i: any) => `${i+1}. ${item.title}\n   ${item.summary || ''}\n   Source: ${item.source}`)
      .join('\n\n');

    const prompt = `You are a financial analyst specializing in ${symbol}.
Analyze each headline step by step:
- What does this mean for the stock price?
- Is it positive, negative, or truly neutral for investors?
- Consider earnings, guidance, market positioning, and risk factors.
Do NOT default to neutral - take a position based on evidence.

Analyze these financial news articles for ${symbol}:

${newsContext}

Based on your reasoning, respond with ONLY this JSON format:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0.XX,
  "reasoning": "brief explanation of key factors"
}`;

    // Add circuit breaker, timeout protection and retry logic
    const circuitBreaker = getAICircuitBreakers().primary;
    const response = await retryAIcall(async () => {
      return await circuitBreaker.execute(async () => {
        return await Promise.race([
          env.AI.run('@cf/openai/gpt-oss-120b', {
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 800,
            reasoning: { effort: 'high', summary: 'concise' }
          } as any),
          new Promise((_: any, reject: any) =>
            setTimeout(() => reject(new Error('AI model timeout')), 45000) // 45s timeout for reasoning model
          )
        ]);
      });
    });

    // Extract response text - handle both formats
    const responseText = extractAIResponseText(response);
    const analysisData = parseNaturalLanguageResponse(responseText);
    const responseTimeMs = Date.now() - callStart;

    return {
      model: 'gpt-oss-120b',
      direction: mapSentimentToDirection(analysisData.sentiment) as Direction,
      confidence: analysisData.confidence,
      reasoning: analysisData.reasoning || 'No detailed reasoning provided',
      raw_response: responseText,
      articles_analyzed: topArticles.length,
      articles_titles: topArticles.map((a: any) => a.title).filter(Boolean),
      analysis_type: 'contextual_analysis',
      response_time_ms: responseTimeMs
    };

  } catch (error: any) {
    logError(`Primary model analysis failed for ${symbol}:`, error);

    // Handle timeout and circuit breaker specifically
    if (error.message === 'AI model timeout') {
      return {
        model: 'gpt-oss-120b',
        direction: 'neutral',
        confidence: null,  // null = failed
        reasoning: 'Model timed out - temporary issue',
        error: 'TIMEOUT'
      };
    }

    if (error.message.includes('Circuit breaker is OPEN')) {
      return {
        model: 'gpt-oss-120b',
        direction: 'neutral',
        confidence: null,  // null = failed
        reasoning: 'AI model temporarily unavailable - circuit breaker active',
        error: 'CIRCUIT_BREAKER_OPEN'
      };
    }

    return {
      model: 'gpt-oss-120b',
      direction: 'neutral',
      confidence: null,  // null = failed
      reasoning: `Analysis failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Mate Model Analysis (DeepSeek-R1) with timeout protection and retry logic
 * Uses reasoning-focused prompt for financial sentiment analysis
 */
async function performMateAnalysis(symbol: string, newsData: NewsArticle[], env: CloudflareEnvironment): Promise<ModelResult> {
  if (!newsData || newsData.length === 0) {
    return {
      model: 'deepseek-r1-32b',
      direction: 'neutral',
      confidence: null,
      reasoning: 'No news data available',
      error: 'No data'
    };
  }

  try {
    const callStart = Date.now();
    const topArticles = newsData.slice(0, 5);
    const newsContext = topArticles
      .map((item: any, i: any) => `${i+1}. ${item.title}\n   ${item.summary || ''}\n   Source: ${item.source}`)
      .join('\n\n');

    const prompt = `<think>
You are analyzing financial news for ${symbol} to determine market sentiment.
Consider: earnings impact, analyst sentiment, market positioning, risk factors.
Think step by step about what each headline means for investors.
</think>

Analyze these financial news articles for ${symbol}:

${newsContext}

Based on your analysis, respond with ONLY this JSON format:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0.XX,
  "reasoning": "brief explanation of key factors"
}`;

    const circuitBreaker = getAICircuitBreakers().mate;
    const response = await retryAIcall(async () => {
      return await circuitBreaker.execute(async () => {
        return await Promise.race([
          env.AI.run('@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', {
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 800
          }),
          new Promise((_: any, reject: any) =>
            setTimeout(() => reject(new Error('DeepSeek-R1 model timeout')), 45000)
          )
        ]);
      });
    });

    const responseText = extractAIResponseText(response);
    const analysisData = parseNaturalLanguageResponse(responseText);
    const responseTimeMs = Date.now() - callStart;

    return {
      model: 'deepseek-r1-32b',
      direction: mapSentimentToDirection(analysisData.sentiment) as Direction,
      confidence: analysisData.confidence,
      reasoning: analysisData.reasoning || 'No detailed reasoning provided',
      raw_response: responseText,
      articles_analyzed: topArticles.length,
      articles_titles: topArticles.map((a: any) => a.title).filter(Boolean),
      analysis_type: 'reasoning_analysis',
      response_time_ms: responseTimeMs
    };

  } catch (error: any) {
    logError(`Mate model analysis failed for ${symbol}:`, error);

    if (error.message.includes('timeout')) {
      return {
        model: 'deepseek-r1-32b',
        direction: 'neutral',
        confidence: null,
        reasoning: 'Model timed out - temporary issue',
        error: 'TIMEOUT'
      };
    }

    if (error.message.includes('Circuit breaker is OPEN')) {
      return {
        model: 'deepseek-r1-32b',
        direction: 'neutral',
        confidence: null,
        reasoning: 'AI model temporarily unavailable - circuit breaker active',
        error: 'CIRCUIT_BREAKER_OPEN'
      };
    }

    return {
      model: 'deepseek-r1-32b',
      direction: 'neutral',
      confidence: null,
      reasoning: `Analysis failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Simple Agreement Check
 * IMPORTANT: If both models have null confidence (no data case), this is NOT agreement - it's failure
 */
function checkAgreement(primaryResult: ModelResult, mateResult: ModelResult): Agreement {
  const primaryDir = primaryResult.direction;
  const mateDir = mateResult.direction;
  const primaryConf = primaryResult.confidence;
  const mateConf = mateResult.confidence;

  // Check for no-data failure: both models have null confidence or both have errors
  const bothNoData = (primaryConf === null && mateConf === null) ||
                     (primaryResult.error === 'No data' && mateResult.error === 'No data');

  if (bothNoData) {
    return {
      agree: false,
      type: 'error',
      details: {
        error: 'No news data available - both models failed to analyze',
        primary_direction: primaryDir,
        mate_direction: mateDir
      }
    };
  }

  // Full agreement: same direction AND at least one model has meaningful confidence (not null)
  if (primaryDir === mateDir && (primaryConf !== null || mateConf !== null)) {
    const primaryScore = primaryConf ?? -1;
    const mateScore = mateConf ?? -1;
    const winnerIsPrimary = primaryScore >= mateScore;
    const winnerModel: 'primary' | 'mate' = winnerIsPrimary ? 'primary' : 'mate';
    const winnerConfidence = winnerIsPrimary ? primaryConf : mateConf;
    const loserConfidence = winnerIsPrimary ? mateConf : primaryConf;
    const isPerfectTie = primaryScore === mateScore && primaryScore !== -1;
    return {
      agree: true,
      type: 'full_agreement',
      details: {
        match_direction: primaryDir,
        confidence_spread: Math.abs((primaryConf ?? 0) - (mateConf ?? 0)),
        winner_model: winnerModel,
        winner_confidence: winnerConfidence ?? null,
        loser_confidence: loserConfidence ?? null,
        is_perfect_tie: isPerfectTie
      }
    };
  }

  // Partial agreement: neutral vs directional
  if (primaryDir === 'neutral' || mateDir === 'neutral') {
    return {
      agree: false,
      type: 'partial_agreement',
      details: {
        primary_direction: primaryDir,
        mate_direction: mateDir,
        dominant_direction: primaryDir === 'neutral' ? mateDir : primaryDir
      }
    };
  }

  // Full disagreement: opposite directions -> pick higher confidence winner
  const primaryScore = primaryConf ?? -1;
  const mateScore = mateConf ?? -1;
  
  // Check for equal-confidence disagreement (true tie)
  if (primaryScore === mateScore && primaryScore !== -1) {
    return {
      agree: false,
      type: 'disagreement',
      details: {
        primary_direction: primaryDir,
        mate_direction: mateDir,
        primary_confidence: primaryConf,
        mate_confidence: mateConf,
        is_tie: true
      }
    };
  }
  
  const winnerIsPrimary = primaryScore > mateScore;
  const winnerModel: 'primary' | 'mate' = winnerIsPrimary ? 'primary' : 'mate';
  const matchDirection = winnerIsPrimary ? primaryDir : mateDir;

  return {
    agree: true,
    type: 'full_agreement',
    details: {
      match_direction: matchDirection,
      confidence_spread: Math.abs((primaryConf ?? 0) - (mateConf ?? 0)),
      primary_direction: primaryDir,
      mate_direction: mateDir,
      winner_model: winnerModel,
      winner_confidence: winnerIsPrimary ? primaryConf ?? null : mateConf ?? null,
      loser_confidence: winnerIsPrimary ? mateConf ?? null : primaryConf ?? null
    }
  };
}

/**
 * Simple Signal Generation Rules
 * IMPORTANT: Returns FAILED status when no data available
 */
function generateSignal(agreement: Agreement, primaryResult: ModelResult, mateResult: ModelResult): Signal {
  const primaryOk = !primaryResult.error && primaryResult.confidence !== null && primaryResult.confidence > 0;
  const mateOk = !mateResult.error && mateResult.confidence !== null && mateResult.confidence > 0;

  // Track which models actually contributed
  const sourceModels: string[] = [];
  if (primaryOk) sourceModels.push('gpt-oss-120b');
  if (mateOk) sourceModels.push('deepseek-r1-32b');

  // Handle error/no-data case first - this is a FAILURE, not a weak signal
  if (agreement.type === 'error' || (!primaryOk && !mateOk)) {
    return {
      type: 'ERROR',
      direction: 'neutral',
      strength: 'FAILED',
      reasoning: agreement.details.error || 'No news data available - analysis failed',
      action: 'SKIP',
      source_models: []
    };
  }

  if (agreement.agree) {
    const details = agreement.details as AgreementDetails;
    const winnerModel = details.winner_model || 'primary';
    const direction = details.match_direction || primaryResult.direction;
    const winnerConfidence = winnerModel === 'primary' ? primaryResult.confidence : mateResult.confidence;
    const loserConfidence = winnerModel === 'primary' ? mateResult.confidence : primaryResult.confidence;
    const confidenceSpread = Math.abs((winnerConfidence ?? 0) - (loserConfidence ?? 0));
    return {
      type: 'AGREEMENT',
      direction,
      strength: calculateAgreementStrength(winnerConfidence),
      reasoning: `Higher-confidence winner (${winnerModel}) on ${direction} sentiment (spread ${confidenceSpread.toFixed(2)})`,
      action: getActionForAgreement(direction, winnerConfidence),
      source_models: sourceModels
    };
  }

  if (agreement.type === 'partial_agreement') {
    const directionalModel = primaryResult.direction === 'neutral' ? mateResult : primaryResult;
    return {
      type: 'PARTIAL_AGREEMENT',
      direction: directionalModel.direction,
      strength: 'MODERATE',
      reasoning: `Mixed signals: ${(agreement.details as any).primary_direction} vs ${(agreement.details as any).mate_direction}`,
      action: directionalModel.confidence > 0.7 ? 'CONSIDER' : 'HOLD',
      source_models: sourceModels
    };
  }

  // Handle disagreement
  const details = agreement.details as any;
  if (details.is_tie) {
    // Equal confidence, different directions -> true tie
    return {
      type: 'DISAGREEMENT',
      direction: 'neutral',
      strength: 'WEAK',
      reasoning: `Models disagree with equal confidence (${(details.primary_confidence ?? 0).toFixed(2)}): Primary ${details.primary_direction}, Mate ${details.mate_direction}. No clear signal.`,
      action: 'HOLD',
      source_models: sourceModels
    };
  }

  return {
    type: 'DISAGREEMENT',
    direction: 'neutral',
    strength: 'WEAK',
    reasoning: `Models disagree: Primary says ${primaryResult.direction}, Mate says ${mateResult.direction}`,
    action: 'AVOID',
    source_models: sourceModels
  };
}

/**
 * Action rules for agreement signals
 */
function getActionForAgreement(direction: Direction, confidence: number | null): SignalAction {
  const effectiveConfidence = confidence ?? 0;

  if (effectiveConfidence >= 0.8) {
    return direction === 'bullish' ? 'STRONG_BUY' : 'STRONG_SELL';
  } else if (effectiveConfidence >= 0.6) {
    return direction === 'bullish' ? 'BUY' : 'SELL';
  } else {
    return direction === 'bullish' ? 'WEAK_BUY' : 'WEAK_SELL';
  }
}

/**
 * Calculate agreement strength
 */
function calculateAgreementStrength(confidence: number | null): SignalStrength {
  if (confidence === null) return 'FAILED';

  if (confidence >= 0.8) return 'STRONG';
  if (confidence >= 0.6) return 'MODERATE';
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
  const jobContext = options.jobContext as { job_type?: 'pre-market' | 'intraday' | 'end-of-day'; run_id?: string } | undefined;

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

      // Get news data with error tracking (tracks which providers failed)
      const newsFetchResult = await getFreeStockNewsWithErrorTracking(symbol, env, jobContext);

      // Run dual AI comparison with rate limit retry
      const dualAIResult = await performDualAIComparisonWithRetry(symbol, newsFetchResult.articles, env);

      // Add news fetch error tracking to result
      dualAIResult.news_fetch_errors = newsFetchResult.errorSummary;

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
        models: { primary: null, mate: null },
        comparison: { agree: false, agreement_type: 'error', match_details: { error: error.message } },
        signal: { type: 'ERROR', direction: 'neutral', strength: 'FAILED', action: 'SKIP', reasoning: `Analysis failed: ${error.message}`, source_models: [] }
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
      const primaryFailed = result.models?.primary?.error;
      const mateFailed = result.models?.mate?.error;
      
      if (primaryFailed && mateFailed && attempt < maxRetries - 1) {
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

        // Get news data with error tracking (tracks which providers failed)
        const newsFetchResult = await getFreeStockNewsWithErrorTracking(symbol, env);

        // Run dual AI comparison
        const dualAIResult = await performDualAIComparison(symbol, newsFetchResult.articles, env);

        // Add news fetch error tracking to result
        dualAIResult.news_fetch_errors = newsFetchResult.errorSummary;

        return {
          symbol,
          success: !dualAIResult.error,
          result: dualAIResult,
          newsCount: newsFetchResult.articles?.length || 0
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
        models: { primary: null, mate: null },
        comparison: { agree: false, agreement_type: 'error', match_details: { error: item.error } },
        signal: { type: 'ERROR', direction: 'neutral', strength: 'FAILED', action: 'SKIP', reasoning: `Enhanced batch analysis failed: ${item.error || 'Unknown error'}`, source_models: [] }
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
