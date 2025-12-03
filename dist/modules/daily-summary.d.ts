/**
 * Daily Summary Module
 * Generates comprehensive daily analysis summaries with KV persistence
 */
import type { CloudflareEnvironment } from '../types.js';
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
    date: string;
    display_date: string;
    is_trading_day: boolean;
    generated_at: string;
    summary: SummaryMetrics;
    symbols: ProcessedSymbolData[];
    charts_data: ChartsData;
}
interface AnalysisRecord {
    symbol: string;
    trading_signals?: any;
    sentiment_layers?: Array<{
        sentiment?: string;
        confidence?: number;
        reasoning?: string;
    }>;
    articles_analyzed?: number;
    timestamp?: string;
}
/**
 * Generate daily summary data structure
 */
export declare function generateDailySummary(dateStr: string, env: CloudflareEnvironment): Promise<DailySummary>;
/**
 * Retrieve daily summary from KV storage or generate if not exists
 */
export declare function getDailySummary(dateStr: string, env: CloudflareEnvironment): Promise<DailySummary>;
export type { SentimentCounts, MorningPrediction, MiddayUpdate, DailyValidation, NextDayOutlook, ProcessedSymbolData, SummaryMetrics, ChartsData, DailySummary, AnalysisRecord };
//# sourceMappingURL=daily-summary.d.ts.map