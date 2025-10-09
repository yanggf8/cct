/**
 * API v1 Response Formats
 * Standardized response structures for all v1 API endpoints
 * Based on DAC project patterns
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  timestamp: string;
  metadata?: ResponseMetadata;
}

export interface ResponseMetadata {
  source?: string;
  ttl?: number;
  version?: string;
  requestId?: string;
  processingTime?: number;
  cacheStatus?: 'hit' | 'miss' | 'stale';
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface PaginatedApiResponse<T> extends ApiResponse<T> {
  pagination?: PaginationMetadata;
}

// Response Types for Different Endpoints

export interface SentimentAnalysisResponse {
  symbols: string[];
  analysis: {
    timestamp: string;
    market_sentiment: MarketSentimentData;
    sector_sentiment?: SectorSentimentData;
    signals: TradingSignal[];
    overall_confidence: number;
  };
  metadata: {
    analysis_time_ms: number;
    ai_models_used: string[];
    data_sources: string[];
  };
}

export interface MarketSentimentData {
  overall_sentiment: number; // -1.0 to 1.0
  sentiment_label: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  confidence: number; // 0.0 to 1.0
  breakdown?: {
    monetary_policy: { sentiment: number; label: string; context: string };
    geopolitical: { sentiment: number; label: string; context: string };
    economic: { sentiment: number; label: string; context: string };
    market: { sentiment: number; label: string; context: string };
  };
}

export interface SectorSentimentData {
  sectors: SectorAnalysis[];
  timestamp: string;
}

export interface SectorAnalysis {
  symbol: string;
  name: string;
  sentiment: number; // -1.0 to 1.0
  sentiment_label: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  confidence: number;
  ai_context: string;
  news_count: number;
  price_change?: number;
  volume?: number;
}

export interface SymbolSentimentResponse {
  symbol: string;
  analysis: {
    gpt_analysis: {
      sentiment: 'bullish' | 'bearish' | 'neutral';
      confidence: number;
      reasoning: string;
      model: string;
    };
    distilbert_analysis: {
      sentiment: 'positive' | 'negative' | 'neutral';
      confidence: number;
      sentiment_breakdown: {
        positive: number;
        negative: number;
        neutral: number;
      };
      model: string;
    };
    agreement: {
      type: 'AGREE' | 'PARTIAL_AGREE' | 'DISAGREE';
      confidence: number;
      recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    };
  };
  market_data?: {
    price: number;
    change: number;
    change_percent: number;
    volume: number;
    timestamp: string;
  };
  news: {
    articles_analyzed: number;
    top_articles: Array<{
      title: string;
      source: string;
      sentiment: string;
      relevance: number;
    }>;
  };
}

export interface TradingSignal {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  sentiment_score: number;
  price_target?: number;
  time_horizon: 'short' | 'medium' | 'long';
}

export interface DailyReportResponse {
  date: string;
  report: {
    market_overview: {
      sentiment: string;
      confidence: number;
      key_factors: string[];
    };
    symbol_analysis: Array<{
      symbol: string;
      sentiment: string;
      signal: string;
      confidence: number;
      reasoning: string;
    }>;
    sector_performance: Array<{
      sector: string;
      performance: number;
      sentiment: string;
    }>;
    recommendations: Array<{
      symbol: string;
      action: string;
      reason: string;
    }>;
  };
  metadata: {
    generation_time: string;
    analysis_duration_ms: number;
    data_quality_score: number;
  };
}

export interface WeeklyReportResponse {
  week: string;
  start_date: string;
  end_date: string;
  report: {
    weekly_summary: {
      overall_sentiment: string;
      weekly_return: number;
      volatility: number;
      key_events: string[];
    };
    symbol_performance: Array<{
      symbol: string;
      weekly_return: number;
      sentiment_accuracy: number;
      signals_generated: number;
      success_rate: number;
    }>;
    patterns: {
      bullish_patterns: string[];
      bearish_patterns: string[];
      neutral_periods: string[];
    };
    outlook: {
      next_week_sentiment: string;
      confidence: number;
      key_factors: string[];
    };
  };
}

export interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    ai_models: {
      gpt_oss_120b: 'healthy' | 'degraded' | 'unhealthy';
      distilbert: 'healthy' | 'degraded' | 'unhealthy';
    };
    data_sources: {
      yahoo_finance: 'healthy' | 'degraded' | 'unhealthy';
      news_api: 'healthy' | 'degraded' | 'unhealthy';
    };
    storage: {
      kv_storage: 'healthy' | 'degraded' | 'unhealthy';
      cache: 'healthy' | 'degraded' | 'unhealthy';
    };
  };
  metrics: {
    uptime_percentage: number;
    average_response_time_ms: number;
    error_rate_percentage: number;
    cache_hit_rate: number;
  };
  alerts: Array<{
    level: 'info' | 'warning' | 'critical';
    service: string;
    message: string;
    timestamp: string;
  }>;
}

export interface SymbolsResponse {
  symbols: Array<{
    symbol: string;
    name: string;
    sector?: string;
    market_cap?: number;
    price?: number;
    exchange: string;
    currency: string;
  }>;
  metadata: {
    total_count: number;
    last_updated: string;
    data_source: string;
  };
}

// Error Response Types
export interface ErrorResponse extends ApiResponse<never> {
  success: false;
  error: string;
  error_code?: string;
  error_details?: Record<string, any>;
}

// Response Factory Functions
export class ApiResponseFactory {
  static success<T>(
    data: T,
    metadata?: Partial<ResponseMetadata>
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      metadata: {
        version: 'v1',
        ...metadata,
      },
    };
  }

  static cached<T>(
    data: T,
    cacheStatus: 'hit' | 'stale' = 'hit',
    metadata?: Partial<ResponseMetadata>
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      cached: true,
      timestamp: new Date().toISOString(),
      metadata: {
        version: 'v1',
        cacheStatus,
        ...metadata,
      },
    };
  }

  static error(
    error: string,
    errorCode?: string,
    errorDetails?: Record<string, any>
  ): ErrorResponse {
    return {
      success: false,
      error,
      error_code: errorCode,
      error_details: errorDetails,
      timestamp: new Date().toISOString(),
    };
  }

  static paginated<T>(
    data: T,
    pagination: PaginationMetadata,
    metadata?: Partial<ResponseMetadata>
  ): PaginatedApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      pagination,
      metadata: {
        version: 'v1',
        ...metadata,
      },
    };
  }
}

// Request ID Generator
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Processing Time Tracker
export class ProcessingTimer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }

  finish(): number {
    return this.getElapsedMs();
  }
}

// HTTP Status Codes
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;