/**
 * Daily Summary and Backfill HTTP Request Handlers
 * Handles daily summary system, backfill operations, and dashboard data
 */
import type { CloudflareEnvironment } from '../../types';
interface SentimentCounts {
    bullish: number;
    bearish: number;
    neutral: number;
}
interface MorningPrediction {
    direction: 'UP' | 'DOWN' | 'NEUTRAL' | 'UNKNOWN';
    confidence: number;
    sentiment: string;
    reasoning: string;
}
interface MiddayUpdate {
    ai_confidence: number;
    technical_confidence: number;
    confidence_difference: number;
    conflict: boolean;
    conflict_severity: 'none' | 'moderate' | 'high';
}
interface DailyValidation {
    predicted_direction: string;
    actual_direction: string;
    correct: boolean | null;
    price_accuracy: number | null;
}
interface NextDayOutlook {
    direction: string;
    confidence: number;
    key_factors: string[];
}
interface ProcessedSymbolData {
    symbol: string;
    morning_prediction: MorningPrediction;
    midday_update: MiddayUpdate;
    daily_validation: DailyValidation;
    next_day_outlook: NextDayOutlook;
    articles_analyzed: number;
    analysis_timestamp: string;
}
interface SummaryMetrics {
    overall_accuracy: number;
    total_predictions: number;
    correct_predictions: number;
    average_confidence: number;
    major_conflicts: string[];
    sentiment_distribution: SentimentCounts;
    system_status: "operational" | "no_data" | "error";
}
interface ChartsData {
    confidence_trend: Array<{
        symbol: string;
        morning: number;
        midday_ai: number;
        midday_technical: number;
    }>;
    accuracy_breakdown: {
        labels: string[];
        predicted: string[];
        conflicts: boolean[];
        confidence_levels: number[];
    };
    conflict_analysis: Array<{
        symbol: string;
        ai_confidence: number;
        technical_confidence: number;
        difference: number;
        severity: string;
    }>;
    generated_for_date: string;
}
interface DailySummary {
    success: boolean;
    date?: string;
    display_date?: string;
    is_trading_day?: boolean;
    generated_at?: string;
    summary?: SummaryMetrics;
    symbols?: ProcessedSymbolData[];
    charts_data?: ChartsData;
    data?: DailySummary;
}
interface BackfillResult {
    date: string;
    status: 'success' | 'skipped' | 'failed';
    total_predictions?: number;
    accuracy?: number;
    is_trading_day: boolean;
    kv_key?: string;
    reason?: string;
    error?: string;
}
interface BackfillSummary {
    backfill_date: string;
    days_requested: number;
    total_dates: number;
    processed: number;
    skipped: number;
    failed: number;
    skip_existing: boolean;
    results: BackfillResult[];
}
interface VerificationDetail {
    date: string;
    status: 'found' | 'missing' | 'error';
    predictions?: number;
    accuracy?: number;
    generated_at?: string;
    is_trading_day?: boolean;
    error?: string;
}
interface VerificationResult {
    verification_date: string;
    days_checked: number;
    found: number;
    missing: number;
    coverage_percentage: number;
    details: VerificationDetail[];
}
interface DailySummaryApiResponse {
    success: boolean;
    data?: DailySummary;
    error?: string;
    provided_date?: string;
    example?: string;
    request_id: string;
    timestamp?: string;
}
interface BackfillApiResponse {
    success: boolean;
    error?: string;
    requested_days?: number;
    maximum_days?: number;
    backfill_result?: BackfillSummary;
    parameters?: {
        days: number;
        skip_existing: boolean;
        trading_days_only?: boolean;
    };
    request_id: string;
    timestamp?: string;
}
interface VerifyBackfillApiResponse {
    success: boolean;
    error?: string;
    requested_days?: number;
    maximum_days?: number;
    verification_result?: VerificationResult;
    parameters?: {
        days_checked: number;
    };
    request_id: string;
    timestamp?: string;
}
/**
 * Handle daily summary API requests
 */
export declare function handleDailySummaryAPI(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle daily summary page requests
 */
export declare function handleDailySummaryPageRequest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle backfill daily summaries requests
 */
export declare function handleBackfillDailySummaries(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle verify backfill requests
 */
export declare function handleVerifyBackfill(request: Request, env: CloudflareEnvironment): Promise<Response>;
export type { DailySummary, BackfillResult, BackfillSummary, VerificationResult, VerificationDetail, DailySummaryApiResponse, BackfillApiResponse, VerifyBackfillApiResponse, ProcessedSymbolData, SummaryMetrics, MorningPrediction, MiddayUpdate, DailyValidation, NextDayOutlook, ChartsData, SentimentCounts };
//# sourceMappingURL=summary-handlers.d.ts.map