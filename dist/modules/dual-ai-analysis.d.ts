/**
 * Dual AI Comparison Analysis Module - TypeScript
 * Simple, transparent dual AI system that runs GPT-OSS-120B and DistilBERT side-by-side
 * and reports whether they agree or disagree with clear decision rules.
 */
import { type NewsArticle } from './free_sentiment_pipeline.js';
import type { CloudflareEnvironment } from '../types.js';
export type Direction = 'up' | 'down' | 'neutral' | 'bullish' | 'bearish' | 'UNCLEAR';
export type AgreementType = 'full_agreement' | 'partial_agreement' | 'disagreement' | 'error';
export type SignalType = 'AGREEMENT' | 'PARTIAL_AGREEMENT' | 'DISAGREEMENT' | 'ERROR';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'FAILED';
export type SignalAction = 'STRONG_BUY' | 'BUY' | 'WEAK_BUY' | 'STRONG_SELL' | 'SELL' | 'WEAK_SELL' | 'CONSIDER' | 'HOLD' | 'AVOID' | 'SKIP';
export interface ModelResult {
    model: string;
    direction: Direction;
    confidence: number;
    reasoning: string;
    error?: string;
    raw_response?: string;
    articles_analyzed?: number;
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
    gpt_direction?: Direction;
    distilbert_direction?: Direction;
    dominant_direction?: Direction;
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
        gpt: ModelResult | null;
        distilbert: ModelResult | null;
    };
    comparison: {
        agree: boolean;
        agreement_type: AgreementType;
        match_details: AgreementDetails;
    };
    signal: Signal;
    performance_metrics?: PerformanceMetrics;
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
 * Main dual AI comparison function
 * Runs both AI models in parallel and provides simple comparison
 */
export declare function performDualAIComparison(symbol: string, newsData: NewsArticle[], env: CloudflareEnvironment): Promise<DualAIComparisonResult>;
/**
 * Batch dual AI analysis for multiple symbols
 */
export declare function batchDualAIAnalysis(symbols: string[], env: CloudflareEnvironment, options?: BatchAnalysisOptions): Promise<BatchDualAIAnalysisResult>;
/**
 * Enhanced batch dual AI analysis with optimized caching and deduplication
 * Provides 50-70% reduction in API calls and KV operations
 */
export declare function enhancedBatchDualAIAnalysis(symbols: string[], env: CloudflareEnvironment, options?: BatchAnalysisOptions & {
    enableOptimizedBatch?: boolean;
    cacheKey?: string;
    batchSize?: number;
}): Promise<BatchDualAIAnalysisResult & {
    optimization?: any;
}>;
//# sourceMappingURL=dual-ai-analysis.d.ts.map