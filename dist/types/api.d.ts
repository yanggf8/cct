/**
 * API Request/Response Type Definitions
 *
 * Comprehensive type definitions for API requests and responses across all endpoints.
 * Provides type safety for API v1 and legacy endpoints.
 */
import { CloudflareEnvironment } from './cloudflare';
/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: ApiError;
    message?: string;
    timestamp: string;
    requestId?: string;
    version?: string;
    metadata?: {
        processingTime?: number;
        cacheHit?: boolean;
        pagination?: PaginationInfo;
        rateLimit?: RateLimitInfo;
    };
}
/**
 * API error information
 */
export interface ApiError {
    code: string;
    message: string;
    details?: any;
    field?: string;
    stack?: string;
}
/**
 * Pagination information
 */
export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}
/**
 * Rate limit information
 */
export interface RateLimitInfo {
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}
/**
 * Request context information
 */
export interface RequestContext {
    requestId: string;
    timestamp: string;
    method: string;
    url: string;
    userAgent?: string;
    ip?: string;
    userId?: string;
    sessionId?: string;
    apiKey?: string;
    env: CloudflareEnvironment;
    cf?: Record<string, any>;
}
/**
 * Base request with common fields
 */
export interface BaseRequest {
    requestId?: string;
    timestamp?: string;
    version?: string;
    metadata?: Record<string, any>;
}
/**
 * Request with symbols array
 */
export interface SymbolsRequest extends BaseRequest {
    symbols: string[];
    options?: {
        includeNews?: boolean;
        includeTechnical?: boolean;
        maxArticles?: number;
        confidenceThreshold?: number;
    };
}
/**
 * Single symbol request
 */
export interface SymbolRequest extends BaseRequest {
    symbol: string;
    options?: {
        includeNews?: boolean;
        includeTechnical?: boolean;
        includeHistorical?: boolean;
        timeframes?: string[];
    };
}
/**
 * Date range request
 */
export interface DateRangeRequest extends BaseRequest {
    startDate?: string;
    endDate?: string;
    date?: string;
    symbols?: string[];
}
/**
 * Analysis request
 */
export interface AnalysisApiRequest extends BaseRequest {
    symbols: string[];
    forceRefresh?: boolean;
    options?: {
        useCache?: boolean;
        timeout?: number;
        retryOnError?: boolean;
    };
}
/**
 * Report generation request
 */
export interface ReportRequest extends BaseRequest {
    type: 'pre-market' | 'intraday' | 'end-of-day' | 'weekly' | 'custom';
    symbols?: string[];
    date?: string;
    options?: {
        format?: 'json' | 'html' | 'pdf';
        includeCharts?: boolean;
        includeTechnical?: boolean;
        emailTo?: string[];
    };
}
/**
 * Cache management request
 */
export interface CacheRequest extends BaseRequest {
    action: 'get' | 'put' | 'delete' | 'clear' | 'warmup' | 'promote';
    key?: string;
    keys?: string[];
    pattern?: string;
    data?: any;
    options?: {
        ttl?: number;
        namespace?: string;
        force?: boolean;
    };
}
/**
 * Sentiment analysis request
 */
export interface SentimentAnalysisRequest extends SymbolsRequest {
    models?: ('gpt' | 'distilbert' | 'both')[];
    newsOnly?: boolean;
    timeframe?: '1d' | '1w' | '1m' | '3m';
}
/**
 * Individual symbol sentiment response
 */
export interface SymbolSentimentResponse {
    symbol: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    reasoning: string;
    models: {
        gpt?: {
            sentiment: string;
            confidence: number;
            reasoning: string;
        };
        distilbert?: {
            sentiment: string;
            confidence: number;
            score: number;
        };
    };
    agreement: 'AGREE' | 'PARTIAL_AGREE' | 'DISAGREE';
    finalSignal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    newsCount: number;
    lastUpdated: string;
}
/**
 * Market-wide sentiment response
 */
export interface MarketSentimentResponse {
    overall: {
        sentiment: string;
        confidence: number;
        trend: 'improving' | 'declining' | 'stable';
    };
    sectors: Array<{
        name: string;
        sentiment: string;
        confidence: number;
        change: number;
    }>;
    summary: {
        bullishCount: number;
        bearishCount: number;
        neutralCount: number;
        totalSymbols: number;
    };
    lastUpdated: string;
}
/**
 * Pre-market briefing response
 */
export interface PreMarketBriefingResponse {
    date: string;
    marketStatus: 'pre-market' | 'open' | 'closed';
    overallSentiment: string;
    topStocks: Array<{
        symbol: string;
        signal: string;
        confidence: number;
        reason: string;
    }>;
    marketOverview: {
        indices: Array<{
            name: string;
            value: number;
            change: number;
            changePercent: number;
        }>;
        futures: Array<{
            name: string;
            value: number;
            change: number;
        }>;
    };
    keyEvents: Array<{
        time: string;
        event: string;
        impact: 'high' | 'medium' | 'low';
    }>;
    riskFactors: string[];
    opportunities: string[];
    dataCompletion: number;
    generatedAt: string;
}
/**
 * Intraday analysis response
 */
export interface IntradayAnalysisResponse {
    timestamp: string;
    marketStatus: string;
    tracking: Array<{
        symbol: string;
        morningSignal: {
            signal: string;
            confidence: number;
            prediction: string;
        };
        currentStatus: {
            price: number;
            change: number;
            changePercent: number;
            performance: 'correct' | 'wrong' | 'pending';
        };
        analysis: {
            sentiment: string;
            confidence: number;
            reasoning: string;
        };
    }>;
    summary: {
        correctPredictions: number;
        wrongPredictions: number;
        pending: number;
        accuracy: number;
    };
}
/**
 * End-of-day summary response
 */
export interface EndOfDaySummaryResponse {
    date: string;
    marketClose: {
        time: string;
        indices: Array<{
            name: string;
            value: number;
            change: number;
            changePercent: number;
        }>;
    };
    performanceReview: Array<{
        symbol: string;
        prediction: string;
        actual: string;
        accuracy: 'correct' | 'wrong' | 'neutral';
        confidence: number;
        priceChange: number;
    }>;
    weeklyPreview: {
        outlook: string;
        keyFactors: string[];
        riskLevel: 'low' | 'medium' | 'high';
    };
}
/**
 * Weekly review response
 */
export interface WeeklyReviewResponse {
    weekEnding: string;
    performanceSummary: {
        totalPredictions: number;
        accuracy: number;
        bullishAccuracy: number;
        bearishAccuracy: number;
        averageConfidence: number;
    };
    bestPerforming: Array<{
        symbol: string;
        accuracy: number;
        predictions: number;
    }>;
    worstPerforming: Array<{
        symbol: string;
        accuracy: number;
        predictions: number;
    }>;
    insights: {
        patterns: string[];
        improvements: string[];
        recommendations: string[];
    };
}
/**
 * Symbol information response
 */
export interface SymbolInfoResponse {
    symbol: string;
    name: string;
    exchange: string;
    sector: string;
    industry: string;
    marketCap: number;
    description?: string;
    website?: string;
    isActive: boolean;
    lastUpdated: string;
}
/**
 * Historical data response
 */
export interface HistoricalDataResponse {
    symbol: string;
    data: Array<{
        date: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        adjustedClose?: number;
    }>;
    metadata: {
        currency: string;
        interval: string;
        firstDate: string;
        lastDate: string;
        totalRecords: number;
    };
}
/**
 * System health response
 */
export interface SystemHealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    uptime: number;
    services: {
        kv: ServiceStatus;
        ai: ServiceStatus;
        r2?: ServiceStatus;
        cache: ServiceStatus;
        externalApis: Record<string, ServiceStatus>;
    };
    performance: {
        averageResponseTime: number;
        requestsPerMinute: number;
        errorRate: number;
        cacheHitRate: number;
    };
    lastCheck: string;
}
export interface ServiceStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime?: number;
    lastCheck: string;
    error?: string;
}
/**
 * Cache health response
 */
export interface CacheHealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    type: 'kv' | 'durable_object' | 'hybrid';
    metrics: {
        hitRate: number;
        missRate: number;
        totalRequests: number;
        averageResponseTime: number;
        cacheSize?: number;
        evictionRate?: number;
    };
    services: {
        primary: CacheServiceStatus;
        fallback?: CacheServiceStatus;
    };
    lastUpdated: string;
}
export interface CacheServiceStatus {
    type: 'kv' | 'durable_object';
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
        hitRate: number;
        averageResponseTime: number;
        totalRequests: number;
    };
    error?: string;
}
/**
 * Cache metrics response
 */
export interface CacheMetricsResponse {
    timeframe: string;
    metrics: {
        requests: {
            total: number;
            hits: number;
            misses: number;
            errors: number;
        };
        performance: {
            averageResponseTime: number;
            p95ResponseTime: number;
            p99ResponseTime: number;
        };
        cache: {
            hitRate: number;
            missRate: number;
            errorRate: number;
        };
    };
    breakdown: Array<{
        endpoint: string;
        requests: number;
        hitRate: number;
        averageResponseTime: number;
    }>;
    trends: {
        hitRateTrend: Array<{
            timestamp: string;
            value: number;
        }>;
        responseTimeTrend: Array<{
            timestamp: string;
            value: number;
        }>;
    };
    generatedAt: string;
}
/**
 * Technical indicators response
 */
export interface TechnicalIndicatorsResponse {
    symbol: string;
    timestamp: string;
    indicators: {
        trend: {
            sma20: number;
            sma50: number;
            sma200: number;
            ema12: number;
            ema26: number;
        };
        momentum: {
            rsi: number;
            macd: {
                macd: number;
                signal: number;
                histogram: number;
            };
            stochastic: {
                k: number;
                d: number;
            };
        };
        volatility: {
            bollinger: {
                upper: number;
                middle: number;
                lower: number;
            };
            atr: number;
        };
        volume: {
            obv: number;
            vwap: number;
            ad: number;
        };
    };
    signals: Array<{
        indicator: string;
        signal: 'buy' | 'sell' | 'neutral';
        strength: 'weak' | 'moderate' | 'strong';
        reasoning: string;
    }>;
    overallSignal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    confidence: number;
}
/**
 * Sector rotation analysis response
 */
export interface SectorRotationResponse {
    timestamp: string;
    marketConditions: {
        overallTrend: 'bull' | 'bear' | 'neutral';
        volatility: 'low' | 'medium' | 'high';
        riskOn: boolean;
    };
    sectors: Array<{
        symbol: string;
        name: string;
        sentiment: {
            overall: string;
            confidence: number;
            reasoning: string;
        };
        technical: {
            trend: string;
            strength: number;
            momentum: number;
        };
        performance: {
            daily: number;
            weekly: number;
            monthly: number;
            ytd: number;
        };
        rotationSignal: {
            direction: 'inflow' | 'outflow' | 'neutral';
            strength: 'weak' | 'moderate' | 'strong';
            reasoning: string;
        };
    }>;
    summary: {
        topSectors: string[];
        bottomSectors: string[];
        rotationLeader: string;
        rotationLaggard: string;
    };
    recommendations: Array<{
        sector: string;
        action: string;
        reasoning: string;
        confidence: number;
    }>;
}
/**
 * Validation error response
 */
export interface ValidationErrorResponse {
    success: false;
    error: {
        code: 'VALIDATION_ERROR';
        message: string;
        details: Array<{
            field: string;
            message: string;
            value?: any;
        }>;
    };
    timestamp: string;
    requestId?: string;
}
/**
 * Not found error response
 */
export interface NotFoundErrorResponse {
    success: false;
    error: {
        code: 'NOT_FOUND';
        message: string;
        details?: {
            resource: string;
            identifier: string;
        };
    };
    timestamp: string;
    requestId?: string;
}
/**
 * Rate limit error response
 */
export interface RateLimitErrorResponse {
    success: false;
    error: {
        code: 'RATE_LIMIT_EXCEEDED';
        message: string;
        details: {
            limit: number;
            windowMs: number;
            resetTime: number;
            retryAfter: number;
        };
    };
    timestamp: string;
    requestId?: string;
}
/**
 * Server error response
 */
export interface ServerErrorResponse {
    success: false;
    error: {
        code: 'INTERNAL_SERVER_ERROR';
        message: string;
        details?: {
            errorId: string;
            timestamp: string;
            stack?: string;
        };
    };
    timestamp: string;
    requestId?: string;
}
/**
 * Union of all error response types
 */
export type ErrorResponse = ValidationErrorResponse | NotFoundErrorResponse | RateLimitErrorResponse | ServerErrorResponse;
/**
 * Union of all success response types
 */
export type SuccessResponse = ApiResponse<SymbolSentimentResponse[]> | ApiResponse<MarketSentimentResponse> | ApiResponse<PreMarketBriefingResponse> | ApiResponse<IntradayAnalysisResponse> | ApiResponse<EndOfDaySummaryResponse> | ApiResponse<WeeklyReviewResponse> | ApiResponse<SymbolInfoResponse> | ApiResponse<HistoricalDataResponse> | ApiResponse<SystemHealthResponse> | ApiResponse<CacheHealthResponse> | ApiResponse<CacheMetricsResponse> | ApiResponse<TechnicalIndicatorsResponse> | ApiResponse<SectorRotationResponse>;
/**
 * Type guard for error response
 */
export declare function isErrorResponse(response: any): response is ErrorResponse;
/**
 * Type guard for success response
 */
export declare function isSuccessResponse<T>(response: any): response is ApiResponse<T>;
/**
 * Create success response
 */
export declare function createSuccessResponse<T>(data: T, metadata?: ApiResponse['metadata']): ApiResponse<T>;
/**
 * Create error response
 */
export declare function createErrorResponse(code: string, message: string, details?: any): ErrorResponse;
//# sourceMappingURL=api.d.ts.map