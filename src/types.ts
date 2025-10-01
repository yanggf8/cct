/**
 * Core TypeScript Type Definitions for TFT Trading System
 *
 * This file contains all shared interfaces and types used across the trading system.
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

  // R2 Buckets
  TRADING_MODELS?: R2Bucket;
  TRAINED_MODELS?: R2Bucket;

  // AI Binding
  AI: Ai;

  // Facebook Integration
  FACEBOOK_PAGE_TOKEN?: string;
  FACEBOOK_RECIPIENT_ID?: string;

  // API Keys
  FMP_API_KEY?: string;
  NEWSAPI_KEY?: string;
  WORKER_API_KEY?: string;

  // Trading Configuration
  TRADING_SYMBOLS?: string;
  SIGNAL_CONFIDENCE_THRESHOLD?: string;

  // Logging Configuration
  LOG_LEVEL?: string;
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
// Signal Tracking Types
// ============================================================================

/**
 * Individual signal for tracking
 */
export interface TrackedSignal {
  symbol: string;
  signal: Signal;
  confidence: number;
  sentiment?: Sentiment;
  models?: {
    gpt?: ModelAnalysis;
    distilbert?: ModelAnalysis;
  };
  comparison?: DualAIComparison;
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

  return (
    typeof data.date === 'string' &&
    Array.isArray(data.signals) &&
    typeof data.metadata === 'object' &&
    typeof data.metadata.total_signals === 'number'
  );
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
