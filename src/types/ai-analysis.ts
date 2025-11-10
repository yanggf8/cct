/**
 * AI Analysis Type Definitions
 *
 * Comprehensive type definitions for AI analysis results, replacing AI: any patterns.
 * Covers GPT, DistilBERT, and dual AI analysis interfaces.
 */

// ============================================================================
// Base AI Interface
// ============================================================================

/**
 * Cloudflare AI binding interface (replaces AI: any)
 */
export interface CloudflareAI {
  /**
   * GPT-based text generation for sentiment analysis
   */
  run(model: '@cf/meta/llama-3.1-8b-instruct', input: GPTInput): Promise<GPTOutput>;

  /**
   * DistilBERT model for text classification
   */
  run(model: '@cf/huggingface/distilbert-sst-2-int8', input: DistilBERTInput): Promise<DistilBERTOutput>;

  /**
   * Generic model runner for future models
   */
  run<T = any>(model: string, input: any): Promise<T>;
}

/**
 * GPT model input interface
 */
export interface GPTInput {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
}

/**
 * GPT model output interface
 */
export interface GPTOutput {
  response: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason?: 'stop' | 'length' | 'content_filter';
  created?: number;
}

/**
 * DistilBERT model input interface
 */
export interface DistilBERTInput {
  text: string[];
  truncate?: boolean;
}

/**
 * DistilBERT model output interface
 */
export interface DistilBERTOutput {
  label: Array<{
    label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    score: number;
  }>;
  model: string;
  processed_time?: number;
}

// ============================================================================
// Analysis Input Types
// ============================================================================

/**
 * News article for analysis
 */
export interface NewsArticle {
  title: string;
  content: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  author?: string;
  summary?: string;
  relevanceScore?: number;
}

/**
 * Analysis request configuration
 */
export interface AnalysisRequest {
  symbol: string;
  newsArticles: NewsArticle[];
  marketData?: {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    marketCap?: number;
  };
  historicalData?: {
    period: string;
    prices: number[];
    volumes: number[];
  };
  options?: {
    maxArticles?: number;
    includeTechnical?: boolean;
    includeFundamentals?: boolean;
    confidenceThreshold?: number;
  };
}

/**
 * Batch analysis request for multiple symbols
 */
export interface BatchAnalysisRequest {
  symbols: string[];
  marketContext?: {
    overallSentiment: 'bullish' | 'bearish' | 'neutral';
    marketIndices: Array<{
      name: string;
      value: number;
      change: number;
    }>;
    sectorTrends?: Record<string, number>;
  };
  options?: AnalysisRequest['options'];
}

// ============================================================================
// Single Model Analysis Results
// ============================================================================

/**
 * GPT analysis result with detailed reasoning
 */
export interface GPTAnalysisResult {
  model: 'gpt';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  reasoning: string;
  keyPoints: string[];
  riskFactors: string[];
  opportunities: string[];
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  articlesAnalyzed: number;
  processingTime: number;
  metadata: {
    modelVersion: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    processingTimeMs: number;
  };
}

/**
 * DistilBERT analysis result with classification scores
 */
export interface DistilBERTAnalysisResult {
  model: 'distilbert';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  scores: {
    positive: number;
    negative: number;
    neutral: number;
  };
  articlesAnalyzed: number;
  averageConfidence: number;
  processingTime: number;
  metadata: {
    modelVersion: string;
    processedArticles: number;
    processingTimeMs: number;
  };
}

/**
 * Union type for single model analysis results
 */
export type SingleModelAnalysis = GPTAnalysisResult | DistilBERTAnalysisResult;

// ============================================================================
// Dual AI Analysis Types
// ============================================================================

/**
 * Agreement status between AI models
 */
export type AgreementStatus = 'AGREE' | 'PARTIAL_AGREE' | 'DISAGREE';

/**
 * Model comparison result
 */
export interface ModelComparison {
  status: AgreementStatus;
  confidenceGap: number;
  sentimentMatch: boolean;
  recommendationMatch: boolean;
  consensusReasoning: string;
  disagreementReasons?: string[];
  confidence: number;
}

/**
 * Final consolidated recommendation
 */
export interface FinalRecommendation {
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | 'AVOID';
  confidence: number;
  reasoning: string;
  supportingFactors: string[];
  riskFactors: string[];
  timeHorizon: 'short_term' | 'medium_term' | 'long_term';
  conviction: 'high' | 'medium' | 'low';
}

/**
 * Complete dual AI analysis result
 */
export interface DualAIAnalysisResult {
  symbol: string;
  timestamp: string;
  analysis: {
    gpt?: GPTAnalysisResult;
    distilbert?: DistilBERTAnalysisResult;
  };
  comparison: ModelComparison;
  recommendation: FinalRecommendation;
  marketContext: {
    overallSentiment: string;
    marketTrend: 'bullish' | 'bearish' | 'neutral';
    volatility: 'low' | 'medium' | 'high';
    sectorPerformance?: string;
  };
  metadata: {
    totalArticles: number;
    processingTimeMs: number;
    apiCalls: number;
    cacheHits: number;
    analysisVersion: string;
  };
}

// ============================================================================
// Batch Analysis Results
// ============================================================================

/**
 * Single symbol result in batch analysis
 */
export interface BatchSymbolResult {
  symbol: string;
  status: 'success' | 'error';
  analysis?: DualAIAnalysisResult;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  processingTime: number;
}

/**
 * Complete batch analysis result
 */
export interface BatchAnalysisResult {
  timestamp: string;
  requestId: string;
  symbols: string[];
  results: BatchSymbolResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    highConfidenceCount: number;
    bullishCount: number;
    bearishCount: number;
    neutralCount: number;
  };
  marketSummary: {
    overallSentiment: string;
    topBullish: string[];
    topBearish: string[];
    highestConfidence: { symbol: string; confidence: number };
  };
  performance: {
    totalProcessingTime: number;
    averageTimePerSymbol: number;
    cacheHitRate: number;
    rateLimitAvoided: boolean;
  };
}

// ============================================================================
// Historical Analysis Types
// ============================================================================

/**
 * Historical analysis data point
 */
export interface HistoricalAnalysisPoint {
  date: string;
  symbol: string;
  analysis: DualAIAnalysisResult;
  marketData: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  actualPerformance: {
    nextDayChange: number;
    nextWeekChange: number;
    nextMonthChange: number;
  };
}

/**
 * Historical accuracy metrics
 */
export interface AccuracyMetrics {
  timeframe: '1_day' | '1_week' | '1_month';
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  bullishAccuracy: number;
  bearishAccuracy: number;
  neutralAccuracy: number;
  highConfidenceAccuracy: number;
  averageConfidence: number;
  confidenceVsAccuracy: number;
}

/**
 * Performance tracking for analysis accuracy
 */
export interface AnalysisPerformance {
  symbol: string;
  timeframe: string;
  predictions: HistoricalAnalysisPoint[];
  accuracy: AccuracyMetrics[];
  trends: {
    accuracyTrend: 'improving' | 'declining' | 'stable';
    confidenceTrend: 'increasing' | 'decreasing' | 'stable';
    bias?: 'bullish' | 'bearish' | 'neutral';
  };
  recommendations: {
    bestPerformingSentiment: string;
    optimalConfidenceThreshold: number;
    recommendedTimeHorizon: string;
  };
}

// ============================================================================
// AI Analysis Configuration
// ============================================================================

/**
 * AI model configuration
 */
export interface AIModelConfig {
  gpt: {
    model: string;
    maxTokens: number;
    temperature: number;
    topP: number;
    timeoutMs: number;
    retryAttempts: number;
    retryDelayMs: number;
  };
  distilbert: {
    model: string;
    batchSize: number;
    timeoutMs: number;
    retryAttempts: number;
    retryDelayMs: number;
  };
  analysis: {
    minArticles: number;
    maxArticles: number;
    minConfidence: number;
    agreementThreshold: number;
    enableCaching: boolean;
    cacheTTL: number;
  };
}

/**
 * AI analysis context for requests
 */
export interface AIAnalysisContext {
  requestId: string;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  source: 'api' | 'cron' | 'webhook' | 'manual';
  priority: 'low' | 'medium' | 'high';
  config?: Partial<AIModelConfig>;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for GPTAnalysisResult
 */
export function isGPTAnalysisResult(result: any): result is GPTAnalysisResult {
  return result?.model === 'gpt' &&
         typeof result?.sentiment === 'string' &&
         typeof result?.confidence === 'number' &&
         typeof result?.reasoning === 'string';
}

/**
 * Type guard for DistilBERTAnalysisResult
 */
export function isDistilBERTAnalysisResult(result: any): result is DistilBERTAnalysisResult {
  return result?.model === 'distilbert' &&
         typeof result?.sentiment === 'string' &&
         typeof result?.confidence === 'number' &&
         typeof result?.scores === 'object';
}

/**
 * Type guard for SingleModelAnalysis
 */
export function isSingleModelAnalysis(result: any): result is SingleModelAnalysis {
  return isGPTAnalysisResult(result) || isDistilBERTAnalysisResult(result);
}

/**
 * Type guard for DualAIAnalysisResult
 */
export function isDualAIAnalysisResult(result: any): result is DualAIAnalysisResult {
  return result?.symbol &&
         typeof result?.timestamp === 'string' &&
         typeof result?.analysis === 'object' &&
         typeof result?.comparison === 'object' &&
         typeof result?.recommendation === 'object';
}

/**
 * Type guard for BatchAnalysisResult
 */
export function isBatchAnalysisResult(result: any): result is BatchAnalysisResult {
  return result?.timestamp &&
         typeof result?.requestId === 'string' &&
         Array.isArray(result?.results) &&
         typeof result?.summary === 'object';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract sentiment from analysis result
 */
export function getSentiment(result: SingleModelAnalysis | DualAIAnalysisResult): string {
  if (isSingleModelAnalysis(result)) {
    return result.sentiment;
  }
  if (isDualAIAnalysisResult(result)) {
    return result.recommendation.signal.toLowerCase().includes('buy') ? 'bullish' :
           result.recommendation.signal.toLowerCase().includes('sell') ? 'bearish' : 'neutral';
  }
  return 'neutral';
}

/**
 * Extract confidence from analysis result
 */
export function getConfidence(result: SingleModelAnalysis | DualAIAnalysisResult): number {
  if (isSingleModelAnalysis(result)) {
    return result.confidence;
  }
  if (isDualAIAnalysisResult(result)) {
    return result.recommendation.confidence;
  }
  return 0;
}

/**
 * Check if analysis is high confidence
 */
export function isHighConfidence(result: SingleModelAnalysis | DualAIAnalysisResult, threshold = 0.7): boolean {
  return getConfidence(result) >= threshold;
}

/**
 * Get primary recommendation from dual analysis
 */
export function getPrimaryRecommendation(result: DualAIAnalysisResult): string {
  return result.recommendation.signal;
}

/**
 * Get reasoning summary from analysis
 */
export function getReasoningSummary(result: SingleModelAnalysis | DualAIAnalysisResult): string {
  if (isSingleModelAnalysis(result)) {
    return isGPTAnalysisResult(result) ? result.reasoning : `Sentiment: ${result.sentiment} (${(result.confidence * 100).toFixed(1)}%)`;
  }
  if (isDualAIAnalysisResult(result)) {
    return result.recommendation.reasoning;
  }
  return 'No reasoning available';
}