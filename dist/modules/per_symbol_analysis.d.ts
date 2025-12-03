/**
 * Per-Symbol Fine-Grained Analysis Module - TypeScript
 * Advanced sentiment analysis for individual symbols without pre-trained model limitations
 */
import type { CloudflareEnvironment } from '../types.js';
export interface AnalysisOptions {
    startTime?: number;
    [key: string]: any;
}
export interface SentimentLayer {
    layer_type: string;
    model: string;
    sentiment: string;
    confidence: number;
    detailed_analysis?: any;
    articles_analyzed?: number;
    processing_time?: number;
    raw_response?: string;
    fallback_used?: boolean;
    original_error?: string;
    error?: string;
    sentiment_breakdown?: any;
    aggregate_score?: number;
    sentiment_distribution?: any;
    individual_scores?: any[];
}
export interface ConfidenceMetrics {
    overall_confidence: number;
    base_confidence: number;
    consistency_bonus: number;
    agreement_bonus: number;
    confidence_breakdown?: {
        layer_confidence?: number[];
        consistency_factor?: string;
        agreement_factor?: number;
        gpt_confidence?: number;
        distilbert_confidence?: number;
        agreement_score?: number;
    };
    reliability_score?: number;
    error?: string;
}
export interface TradingSignals {
    symbol: string;
    primary_direction: string;
    overall_confidence: number;
    recommendation?: string;
    signal_strength?: string;
    signal_type?: string;
    entry_signals?: any;
    exit_signals?: any;
    risk_signals?: any;
    time_horizon_signals?: any;
    strength_indicators?: any;
    signal_metadata?: any;
    error?: string;
}
export interface AnalysisMetadata {
    method: string;
    models_used: string[];
    total_processing_time: number;
    news_quality_score?: number;
    dual_ai_specific?: any;
    fallback_used?: boolean;
    original_error?: string;
    fully_failed?: boolean;
    errors?: string[];
}
export interface SymbolAnalysis {
    symbol: string;
    analysis_type: string;
    timestamp: string;
    news_data?: any;
    sentiment_layers: SentimentLayer[];
    sentiment_patterns?: any;
    confidence_metrics: ConfidenceMetrics;
    trading_signals: TradingSignals;
    analysis_metadata: AnalysisMetadata;
    execution_metadata?: any;
    error?: string;
}
export interface BatchStatistics {
    total_symbols: number;
    successful_full_analysis: number;
    fallback_sentiment_used: number;
    neutral_fallback_used: number;
    total_failed: number;
}
export interface BatchAnalysisResult {
    results: SymbolAnalysis[];
    statistics: BatchStatistics;
    execution_metadata: {
        total_execution_time: number;
        symbols_processed: number;
        success_rate: number;
        batch_completed: boolean;
    };
}
export interface PipelineResult {
    success: boolean;
    analysis_results?: SymbolAnalysis[];
    pipeline_summary?: any;
    execution_metadata: {
        pipeline_type: string;
        symbols_processed: number;
        total_time: number;
        cron_ready: boolean;
        dual_ai_enabled: boolean;
        failure_stage?: string;
    };
    error?: string;
}
export interface SentimentResult {
    sentiment: string;
    confidence: number;
    model?: string;
    average_score?: number;
    articles_processed?: number;
    fallback_source?: string;
}
/**
 * Dual AI per-symbol analysis with simple agreement/disagreement logic
 * Runs GPT-OSS-120B and DistilBERT in parallel for transparent comparison
 */
export declare function analyzeSymbolWithFineGrainedSentiment(symbol: string, env: CloudflareEnvironment, options?: AnalysisOptions): Promise<SymbolAnalysis>;
/**
 * Analyze symbol with robust fallback system for cron reliability
 * Ensures every symbol returns a usable result even if main analysis fails
 */
export declare function analyzeSymbolWithFallback(symbol: string, env: CloudflareEnvironment, options?: AnalysisOptions): Promise<SymbolAnalysis>;
/**
 * Batch analyze multiple symbols with cron-optimized error handling
 * Ensures cron job completes successfully even if individual symbols fail
 */
export declare function batchAnalyzeSymbolsForCron(symbols: string[], env: CloudflareEnvironment, options?: AnalysisOptions): Promise<BatchAnalysisResult>;
/**
 * Complete cron-optimized analysis pipeline with dual AI system and batch KV storage
 * This is the main function for cron jobs - handles everything from analysis to storage
 */
export declare function runCompleteAnalysisPipeline(symbols: string[], env: CloudflareEnvironment, options?: AnalysisOptions): Promise<PipelineResult>;
/**
 * Main function for per-symbol analysis endpoint
 */
export declare function analyzeSingleSymbol(symbol: string, env: CloudflareEnvironment, options?: AnalysisOptions): Promise<SymbolAnalysis>;
//# sourceMappingURL=per_symbol_analysis.d.ts.map