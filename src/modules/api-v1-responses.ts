/**
 * API v1 Response Formats
 * Standardized response structures for all v1 API endpoints
 * Based on DAC project patterns
 */

// Type definitions
interface ApiResponseMetadata {
  version: string;
  cacheStatus?: string;
  [key: string]: any;
}

interface ApiResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
  metadata: ApiResponseMetadata;
}

interface CachedApiResponse<T = any> extends ApiResponse<T> {
  cached: true;
}

interface ErrorApiResponse {
  success: false;
  error: string;
  error_code: string;
  error_details: Record<string, any>;
  timestamp: string;
}

interface PaginatedApiResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
  pagination: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
  metadata: ApiResponseMetadata;
}

interface PaginationInfo {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

/**
 * Response Factory Functions
 */
export class ApiResponseFactory {
  static success<T = any>(data: T, metadata: Record<string, any> = {}): ApiResponse<T> {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      metadata: {
        version: 'v1',
        ...metadata,
      },
    };

    // Add root-level fields for client compatibility
    if (data && typeof data === 'object') {
      if ('version' in data) {
        (response as any).version = (data as any).version;
      }
      if ('status' in data) {
        (response as any).status = (data as any).status;
      }
      if ('title' in data) {
        (response as any).title = (data as any).title;
      }
      if ('description' in data) {
        (response as any).description = (data as any).description;
      }
    }

    return response;
  }

  static cached<T = any>(data: T, cacheStatus: string = 'hit', metadata: Record<string, any> = {}): CachedApiResponse<T> {
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

  static error(error: string, errorCode: string, errorDetails: Record<string, any> = {}): ErrorApiResponse {
    return {
      success: false,
      error,
      error_code: errorCode,
      error_details: errorDetails,
      timestamp: new Date().toISOString(),
    };
  }

  static paginated<T = any>(
    data: T,
    pagination: PaginationInfo,
    metadata: Record<string, any> = {}
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

// API Key Validation Helper
export function validateApiKey(request: Request, env?: { X_API_KEY?: string }): { valid: boolean; key: string | null } {
  const apiKey = request.headers.get('X-API-Key');

  // If environment is provided, use configured keys
  if (env?.X_API_KEY) {
    const validKeys = env.X_API_KEY.split(',').map(k => k.trim()).filter(Boolean);
    return { valid: validKeys.includes(apiKey || ''), key: apiKey };
  }

  // Fallback for backward compatibility - should not be used in production
  const validKeys = ['demo', 'test'];
  return { valid: validKeys.includes(apiKey || ''), key: apiKey };
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

// Type for HTTP status codes
export type HttpStatusType = typeof HttpStatus[keyof typeof HttpStatus];

// Type definitions for API responses
export interface MarketSentimentDataInterface {
  overall_sentiment: number;
  sentiment_label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
}

export interface SectorSentimentDataInterface {
  sector: string;
  overall_sentiment: number;
  sentiment_label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  symbol_count: number;
}

export interface SymbolsResponseInterface {
  symbols: string[];
  count: number;
  metadata: {
    last_updated: string;
    total_count?: number;
    data_source?: string;
    [key: string]: any;
  };
}

export interface SystemHealthResponseInterface {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    [serviceName: string]: {
      status: 'up' | 'down' | 'degraded';
      response_time_ms?: number;
      last_check: string;
      [key: string]: any;
    };
  };
  uptime_seconds: number;
  version: string;
  [key: string]: any;
}

// Export types for use in routes
export type MarketSentimentData = MarketSentimentDataInterface;
export type SectorSentimentData = SectorSentimentDataInterface;
export type SymbolsResponse = SymbolsResponseInterface;
export type SystemHealthResponse = SystemHealthResponseInterface;

// Type definitions for sentiment response objects
export interface SentimentAnalysisResponseInterface {
  symbols: string[];
  analysis: {
    timestamp: string;
    market_sentiment: {
      overall_sentiment: string;
      sentiment_label: string;
      confidence: number;
    };
    signals: any[];
    overall_confidence: number;
  };
  metadata: {
    analysis_time_ms: number;
    ai_models_used: string[];
    data_sources: string[];
    optimization?: {
      enabled: boolean;
      cacheHitRate: number;
      kvReduction: number;
      timeSaved: number;
      batchEfficiency: number;
      cachedItems: number;
      deduplicationRate: number;
    };
  };
}

export interface SymbolSentimentResponseInterface {
  symbol: string;
  analysis: {
    gpt_analysis: {
      sentiment: string;
      confidence: number;
      reasoning: string;
      model: string;
    };
    distilbert_analysis: {
      sentiment: string;
      confidence: number;
      sentiment_breakdown: {
        positive: number;
        negative: number;
        neutral: number;
      };
      model: string;
    };
    agreement: {
      type: string;
      confidence: number;
      recommendation: string;
    };
  };
  news?: {
    articles_analyzed?: number;
    top_articles?: any[];
    [key: string]: any;
  };
  metadata?: any;
}

// Type definitions for response objects
export interface DailyReportResponseInterface {
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
    sector_performance: any[];
    summary: {
      total_signals: number;
      bullish_signals: number;
      bearish_signals: number;
      accuracy_estimate: number;
    };
    recommendations?: string[];
    [key: string]: any;
  };
}

export interface WeeklyReportResponseInterface {
  week_start: string;
  week_end: string;
  report: {
    weekly_overview: {
      sentiment_trend: string;
      average_confidence: number;
      key_highlights: string[];
    };
    daily_breakdown: Array<{
      date: string;
      sentiment: string;
      signal_count: number;
    }>;
    performance_summary: {
      total_signals: number;
      accuracy_rate: number;
      best_performing_sectors: string[];
      worst_performing_sectors: string[];
    };
    weekly_summary?: any;
    [key: string]: any;
  };
}

// Export interfaces as types
export type DailyReportResponse = DailyReportResponseInterface;
export type WeeklyReportResponse = WeeklyReportResponseInterface;
export type SentimentAnalysisResponse = SentimentAnalysisResponseInterface;
export type SymbolSentimentResponse = SymbolSentimentResponseInterface;

// Compatibility placeholders for JS route imports (with different names to avoid conflicts)
export const MarketSentimentDataValue = {};
export const SectorSentimentDataValue = {};

// Export types for external use
export type {
  ApiResponse,
  CachedApiResponse,
  ErrorApiResponse,
  PaginatedApiResponse,
  ApiResponseMetadata,
  PaginationInfo
};