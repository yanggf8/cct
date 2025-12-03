/**
 * API v1 Response Formats
 * Standardized response structures for all v1 API endpoints
 * Based on DAC project patterns
 */
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
export declare class ApiResponseFactory {
    static success<T = any>(data: T, metadata?: Record<string, any>): ApiResponse<T>;
    static cached<T = any>(data: T, cacheStatus?: string, metadata?: Record<string, any>): CachedApiResponse<T>;
    static error(error: string, errorCode: string, errorDetails?: Record<string, any>): ErrorApiResponse;
    static paginated<T = any>(data: T, pagination: PaginationInfo, metadata?: Record<string, any>): PaginatedApiResponse<T>;
}
export declare function generateRequestId(): string;
export declare function validateApiKey(request: Request): {
    valid: boolean;
    key: string | null;
};
export declare class ProcessingTimer {
    private startTime;
    constructor();
    getElapsedMs(): number;
    finish(): number;
}
export declare const HttpStatus: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly METHOD_NOT_ALLOWED: 405;
    readonly INTERNAL_SERVER_ERROR: 500;
    readonly SERVICE_UNAVAILABLE: 503;
};
export type HttpStatusType = typeof HttpStatus[keyof typeof HttpStatus];
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
export type MarketSentimentData = MarketSentimentDataInterface;
export type SectorSentimentData = SectorSentimentDataInterface;
export type SymbolsResponse = SymbolsResponseInterface;
export type SystemHealthResponse = SystemHealthResponseInterface;
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
export type DailyReportResponse = DailyReportResponseInterface;
export type WeeklyReportResponse = WeeklyReportResponseInterface;
export type SentimentAnalysisResponse = SentimentAnalysisResponseInterface;
export type SymbolSentimentResponse = SymbolSentimentResponseInterface;
export declare const MarketSentimentDataValue: {};
export declare const SectorSentimentDataValue: {};
export type { ApiResponse, CachedApiResponse, ErrorApiResponse, PaginatedApiResponse, ApiResponseMetadata, PaginationInfo };
//# sourceMappingURL=api-v1-responses.d.ts.map