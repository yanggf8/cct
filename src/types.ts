
// Cloudflare Workers type stubs
declare global {
  // Extended Cloudflare Workers types
  interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: any): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: any): Promise<any>;
  }
}

// Export DurableObject types from cloudflare:workers
export type { DurableObjectNamespace, DurableObjectState, DurableObjectStorage } from 'cloudflare:workers';

/**
 * Core TypeScript Type Definitions for Dual AI Sentiment Analysis System
 *
 * This file contains all shared interfaces and types used across the sentiment analysis system.
 * Created as part of Phase 5 type safety improvements (2025-10-01).
 */

// ============================================================================
// Cloudflare Environment Interface
// ============================================================================

/**
 * Cloudflare Worker Environment Bindings
 * Replaces all `env: any` usage across the codebase
 */
export interface CloudflareEnvironment {
  // KV Namespace
  TRADING_RESULTS: KVNamespace;
  CACHE_DO_KV?: KVNamespace;  // KV namespace for DO cache persistence

  // R2 Buckets
  TRADING_MODELS?: R2Bucket;
  TRAINED_MODELS?: R2Bucket;

  // AI Binding
  AI: Ai;

  // Durable Objects
  CACHE_DO?: DurableObjectNamespace;

  // Facebook Integration
  FACEBOOK_PAGE_TOKEN?: string;
  FACEBOOK_RECIPIENT_ID?: string;

  // API Keys
  FMP_API_KEY?: string;
  NEWSAPI_KEY?: string;
  WORKER_API_KEY?: string;
  // Real-time data providers
  FRED_API_KEY?: string;            // Primary FRED API key
  FRED_API_KEYS?: string;           // Optional comma-separated list for rotation
  
  // Market data configuration
  YAHOO_FINANCE_RATE_LIMIT?: string; // requests per minute
  RATE_LIMIT_WINDOW?: string;        // window in ms
  MARKET_DATA_CACHE_TTL?: string;    // seconds
  
  // Environment/mode
  ENVIRONMENT?: string;              // 'development' | 'production' | 'staging'
  // Trading Configuration
  TRADING_SYMBOLS?: string;
  SIGNAL_CONFIDENCE_THRESHOLD?: string;

  // Logging Configuration
  LOG_LEVEL?: string;

  // Feature Flags
  STRUCTURED_LOGGING?: string;

  // AI Model Configuration
  GPT_MAX_TOKENS?: string;
  GPT_TEMPERATURE?: string;

  // Webhook URLs
  SLACK_WEBHOOK_URL?: string;
  DISCORD_WEBHOOK_URL?: string;

  // Allow dynamic access to environment variables
  [key: string]: any;
}

// ============================================================================
// Analysis Types
// ============================================================================

/**
 * Sentiment classification from AI models
 */
export type Sentiment = 'bullish' | 'bearish' | 'neutral';

/**
 * Trading signal recommendation
 */
export type Signal = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' | 'AVOID';

/**
 * AI model agreement status
 */
export type AgreementStatus = 'AGREE' | 'PARTIAL_AGREE' | 'DISAGREE';

/**
 * Individual AI model analysis result
 */
export interface ModelAnalysis {
  sentiment: Sentiment;
  confidence: number;
  reasoning?: string;
  articles_analyzed?: number;
}

/**
 * Dual AI model comparison
 */
export interface DualAIComparison {
  agree: AgreementStatus;
  confidence_gap?: number;
  recommendation?: string;
}

/**
 * Complete dual AI signal with both models
 */
export interface DualAISignal {
  symbol: string;
  models: {
    gpt?: ModelAnalysis;
    distilbert?: ModelAnalysis;
  };
  comparison: DualAIComparison;
  final_signal: Signal;
  confidence: number;
  timestamp: string;
}

/**
 * Legacy sentiment layer (for backward compatibility)
 */
export interface SentimentLayer {
  sentiment: Sentiment;
  confidence: number;
  reasoning?: string;
}

/**
 * Analysis result for a single symbol
 */
export interface SymbolAnalysis {
  symbol: string;
  sentiment_layers?: SentimentLayer[];
  models?: {
    gpt?: ModelAnalysis;
    distilbert?: ModelAnalysis;
  };
  comparison?: DualAIComparison;
  final_signal?: Signal;
  confidence: number;
  news_count?: number;
  timestamp: string;
}

/**
 * Complete analysis result for all symbols
 */
export interface AnalysisResult {
  date: string;
  symbols: SymbolAnalysis[];
  summary: {
    total_symbols: number;
    high_confidence_count: number;
    bullish_count: number;
    bearish_count: number;
    neutral_count: number;
    system_status: string;
  };
  metadata: {
    analysis_version: string;
    execution_time_ms?: number;
    timestamp: string;
  };
}

// ============================================================================
// Enhanced Feature Analysis Types
// ============================================================================

/**
 * Market data structure
 */
export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

/**
 * Enhanced signal from enhanced feature analysis
 */
export interface EnhancedSignal {
  signal: Signal;
  confidence: number;
  feature_contribution: { [key: string]: number };
  sentiment?: Sentiment;
  reasoning?: string;
}

/**
 * System performance metrics
 */
export interface SystemPerformance {
  accuracy: number;
  avg_confidence: number;
  feature_coverage: number;
}

/**
 * Methodology information
 */
export interface Methodology {
  neural_networks: string;
  technical_features: string;
  sentiment_analysis: string;
}

/**
 * Enhanced feature analysis result
 */
export interface EnhancedFeatureAnalysisResult {
  timestamp: string;
  analysis_type: string;
  feature_count: number;
  symbols_analyzed: string[];
  trading_signals: { [symbol: string]: EnhancedSignal | any };
  system_performance: SystemPerformance;
  methodology: Methodology;
}

/**
 * Alias for backward compatibility
 */
// Note: This is defined in enhanced_feature_analysis.ts to avoid circular imports

// ============================================================================
// Signal Tracking Types
// ============================================================================

/**
 * Individual signal for tracking
 */
export interface TrackedSignal {
  id: string;
  symbol: string;
  signal: Signal;
  confidence: number;
  sentiment?: Sentiment;
  models?: {
    gpt?: ModelAnalysis;
    distilbert?: ModelAnalysis;
  };
  comparison?: DualAIComparison;
  // Additional properties for signal tracking
  prediction: string;
  currentPrice: number;
  status: string;
  tracking: {
    morningSignal: {
      prediction: string;
      confidence: number;
      generatedAt: string;
    };
    intradayPerformance: any;
    endOfDayPerformance: any;
    weeklyPerformance: any;
  };
}

/**
 * Signal tracking data structure
 */
export interface SignalTrackingData {
  date: string;
  signals: TrackedSignal[];
  metadata: {
    total_signals: number;
    high_confidence_count: number;
    timestamp: string;
  };
}

/**
 * Signal performance tracking
 */
export interface SignalPerformance {
  symbol: string;
  predicted_signal: Signal;
  actual_performance?: 'correct' | 'wrong' | 'pending';
  confidence: number;
  price_change?: number;
  timestamp: string;
}

// ============================================================================
// Message Tracking Types
// ============================================================================

/**
 * Supported messaging platforms
 */
export type MessagePlatform = 'facebook' | 'telegram' | 'slack' | 'discord' | 'email' | 'sms' | 'webhook' | 'other';

/**
 * Message delivery status
 */
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'retrying';

/**
 * Message type classification
 */
export type MessageType =
  | 'morning_predictions'
  | 'midday_update'
  | 'end_of_day_summary'
  | 'friday_weekend_report'
  | 'weekly_accuracy_report'
  | 'alert'
  | 'notification'
  | 'system'
  | 'other';

/**
 * Message tracking record
 */
export interface MessageTracking {
  tracking_id: string;
  platform: MessagePlatform;
  message_type: MessageType;
  recipient_id: string;
  status: MessageStatus;
  platform_message_id?: string;
  error_message?: string;
  error_count: number;
  created_at: string;
  updated_at: string;
  sent_at?: string;
  delivered_at?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// KV Storage Types
// ============================================================================

/**
 * KV operation result
 */
export interface KVResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  source?: 'cache' | 'kv' | 'error';
}

/**
 * KV read result with typed data
 */
export interface KVReadResult<T> extends KVResult<T> {
  data?: T;
}

/**
 * KV write result
 */
export interface KVWriteResult extends KVResult {
  key?: string;
}

/**
 * KV list result
 */
export interface KVListResult extends KVResult {
  keys?: Array<{ name: string; expiration?: number; metadata?: any }>;
  cursor?: string;
  list_complete?: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API success response
 */
export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
  timestamp?: string;
}

/**
 * Standard API error response
 */
export interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
  timestamp?: string;
}

/**
 * API response union type
 */
export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// ============================================================================
// Health Check Types
// ============================================================================

/**
 * Service health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual service health
 */
export interface ServiceHealth {
  status: HealthStatus;
  message?: string;
  last_check?: string;
}

/**
 * System health response
 */
export interface SystemHealth {
  success: boolean;
  status: HealthStatus;
  version: string;
  services: {
    kv?: ServiceHealth;
    ai?: ServiceHealth;
    r2?: ServiceHealth;
    cron?: ServiceHealth;
  };
  timestamp: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * System configuration
 */
export interface SystemConfig {
  tradingSymbols: string[];
  ttl: {
    analysis: number;
    granular: number;
    daily_summary: number;
    status: number;
    report_cache: number;
    metadata: number;
  };
  retry: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    timeout: number;
  };
  analysis: {
    minNewsArticles: number;
    maxNewsArticles: number;
    confidenceThreshold: number;
    signalConfidenceThreshold: number;
  };
  market: {
    dataCacheTTL: number;
    yahooFinanceRateLimit: number;
    rateLimitWindow: number;
  };
}

// ============================================================================
// Cron Types
// ============================================================================

/**
 * Cron execution context
 */
export interface CronContext {
  scheduledTime: number;
  cron: string;
}

/**
 * Cron execution result
 */
export interface CronExecutionResult {
  success: boolean;
  cron_type: string;
  execution_id: string;
  execution_time_ms?: number;
  error?: string;
  timestamp: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type guard helper
 */
export type TypeGuard<T> = (value: any) => value is T;

/**
 * Async function type
 */
export type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;

/**
 * Retry options
 */
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  timeout?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

// ============================================================================
// Type Guard Functions
// ============================================================================

/**
 * Type guard for SignalTrackingData
 */
export function isSignalTrackingData(value: unknown): value is SignalTrackingData {
  if (!value || typeof value !== 'object') return false;
  const data = value as any;

  // Check basic structure
  const hasValidDate = typeof data.date === 'string';
  const hasValidSignals = Array.isArray(data.signals);

  if (!hasValidDate || !hasValidSignals) return false;

  // Check signal structure - ensure they have required TrackedSignal properties
  const hasValidSignalStructure = data.signals.length === 0 || data.signals.every((signal: any) =>
    typeof signal.id === 'string' &&
    typeof signal.symbol === 'string' &&
    typeof signal.prediction === 'string' &&
    typeof signal.confidence === 'number' &&
    typeof signal.currentPrice === 'number' &&
    typeof signal.status === 'string' &&
    typeof signal.tracking === 'object'
  );

  if (!hasValidSignalStructure) return false;

  // Check for either metadata (from types.ts) or lastUpdated (from analysis.ts)
  const hasMetadata = typeof data.metadata === 'object' && typeof data.metadata.total_signals === 'number';
  const hasLastUpdated = typeof data.lastUpdated === 'string';

  return hasMetadata || hasLastUpdated;
}

/**
 * Type guard for AnalysisResult
 */
export function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== 'object') return false;
  const data = value as any;

  return (
    typeof data.date === 'string' &&
    Array.isArray(data.symbols) &&
    typeof data.summary === 'object' &&
    typeof data.summary.total_symbols === 'number' &&
    typeof data.metadata === 'object'
  );
}

/**
 * Type guard for DualAISignal
 */
export function isDualAISignal(value: unknown): value is DualAISignal {
  if (!value || typeof value !== 'object') return false;
  const data = value as any;

  return (
    typeof data.symbol === 'string' &&
    typeof data.models === 'object' &&
    typeof data.comparison === 'object' &&
    typeof data.final_signal === 'string' &&
    typeof data.confidence === 'number'
  );
}

/**
 * Type guard for MessageTracking
 */
export function isMessageTracking(value: unknown): value is MessageTracking {
  if (!value || typeof value !== 'object') return false;
  const data = value as any;

  return (
    typeof data.tracking_id === 'string' &&
    typeof data.platform === 'string' &&
    typeof data.message_type === 'string' &&
    typeof data.recipient_id === 'string' &&
    typeof data.status === 'string' &&
    typeof data.error_count === 'number'
  );
}

/**
 * Type guard for SymbolAnalysis
 */
export function isSymbolAnalysis(value: unknown): value is SymbolAnalysis {
  if (!value || typeof value !== 'object') return false;
  const data = value as any;

  return (
    typeof data.symbol === 'string' &&
    typeof data.confidence === 'number' &&
    typeof data.timestamp === 'string'
  );
}

/**
 * Type guard for KVResult
 */
export function isKVResult<T>(value: unknown): value is KVResult<T> {
  if (!value || typeof value !== 'object') return false;
  const data = value as any;

  return (
    typeof data.success === 'boolean' &&
    (data.data !== undefined || data.error !== undefined)
  );
}

/**
 * Type guard for ApiResponse
 */
export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  if (!value || typeof value !== 'object') return false;
  const data = value as any;

  return typeof data.success === 'boolean';
}

/**
 * Type guard for SystemHealth
 */
export function isSystemHealth(value: unknown): value is SystemHealth {
  if (!value || typeof value !== 'object') return false;
  const data = value as any;

  return (
    typeof data.success === 'boolean' &&
    typeof data.status === 'string' &&
    typeof data.version === 'string' &&
    typeof data.services === 'object'
  );
}

// ============================================================================
// Sector Rotation Types
// ============================================================================

/**
 * Sector rotation analysis result
 */
export interface SectorRotationResult {
  timestamp: string;
  analysisDate: string;
  marketConditions: {
    overallTrend: 'bull' | 'bear' | 'neutral';
    volatility: 'low' | 'medium' | 'high';
    riskOn: boolean;
  };
  etfAnalyses: Array<{
    symbol: string;
    name: string;
    sentiment: {
      overall: 'bullish' | 'bearish' | 'neutral';
      confidence: number;
      reasoning: string;
      model: string;
    };
    technicalIndicators: {
      rsi: number;
      macd: number;
      movingAvg50: number;
      movingAvg200: number;
      trend: 'uptrend' | 'downtrend' | 'sideways';
    };
    performanceMetrics: {
      daily: number;
      weekly: number;
      monthly: number;
      ytd: number;
      volatility: number;
    };
    newsSentiment: {
      positiveCount: number;
      negativeCount: number;
      neutralCount: number;
      topHeadlines: string[];
    };
    rotationSignal: {
      strength: 'strong' | 'moderate' | 'weak';
      direction: 'inflow' | 'outflow' | 'neutral';
      reasoning: string;
    };
  }>;
  topSectors: {
    inflow: string[];
    outflow: string[];
  };
  rotationSignals: {
    leadingSector: string;
    laggingSector: string;
    emergingSectors: string[];
    decliningSectors: string[];
  };
  executionMetrics: {
    totalProcessingTime: number;
    averageTimePerETF: number;
    cacheHitRate: number;
    rateLimitAvoided: boolean;
  };
}

// ============================================================================
// Report and Analysis Helper Types
// ============================================================================

/**
 * Signal structure used in reports
 */
export interface ReportSignal {
  sentiment_layers?: SentimentLayer[];
  recommendation?: string;
  [key: string]: any;
}

/**
 * Request body for endpoints that accept symbols array
 */
export interface SymbolsRequestBody {
  symbols?: string[];
  [key: string]: any;
}

/**
 * Primary sentiment result from sentiment layers
 */
export interface PrimarySentimentResult {
  sentiment: string;
  confidence: number;
  reasoning: string;
}

/**
 * Safely extract primary sentiment from sentiment layers
 * @param layers - Optional array of sentiment layers
 * @returns Primary sentiment with defaults if layers are missing or empty
 */
export function getPrimarySentiment(layers?: SentimentLayer[]): PrimarySentimentResult {
  if (!layers || layers.length === 0) {
    return {
      sentiment: 'NEUTRAL',
      confidence: 0,
      reasoning: 'No sentiment data available'
    };
  }

  // Find layer with highest confidence
  const primaryLayer = layers.reduce((prev, current) =>
    (current.confidence > prev.confidence) ? current : prev
  );

  return {
    sentiment: primaryLayer.sentiment,
    confidence: primaryLayer.confidence,
    reasoning: primaryLayer.reasoning || 'Automated sentiment analysis'
  };
}

// ============================================================================
// Utility Types and Functions
// ============================================================================

/**
 * DeepPartial - makes all properties of a type recursively partial
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * NonEmptyArray - ensures an array has at least one element
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * SafeGet - safely get nested object property with default value
 */
export function safeGet<T>(obj: any, path: string, defaultValue: T): T {
  try {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
      if (result === null || result === undefined) {
        return defaultValue;
      }
      result = result[key];
    }
    return result !== undefined && result !== null ? result : defaultValue;
  } catch (error) {
    return defaultValue;
  }
}

/**
 * AssertNonEmpty - runtime check that array is not empty
 */
export function assertNonEmpty<T>(array: T[], message = 'Array must not be empty'): NonEmptyArray<T> {
  if (array.length === 0) {
    throw new Error(message);
  }
  // @ts-ignore - Type assertion for non-empty array
  return array as NonEmptyArray<T>;
}

/**
 * Apply defaults to partial options object
 */
export function applyDefaults<T>(partial: Partial<T>, defaults: T): T {
  return { ...defaults, ...partial };
}

/**
 * Normalize input to array - handles single item, array, or undefined
 */
export function asArray<T>(input: T | T[] | undefined | null): T[] {
  if (input === undefined || input === null) {
    return [];
  }
  return Array.isArray(input) ? input : [input];
}

/**
 * Type guard for non-empty arrays
 */
export function isNonEmpty<T>(arr?: T[]): arr is NonEmptyArray<T> {
  return Array.isArray(arr) && arr.length > 0;
}
