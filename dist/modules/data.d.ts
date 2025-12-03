/**
 * Data Access Module - TypeScript
 * Handles data retrieval from KV storage and fact table operations with real market validation
 */
import type { CloudflareEnvironment } from '../types.js';
export interface FactTableRecord {
    date: string;
    symbol: string;
    predicted_price: number | null;
    current_price: number | null;
    actual_price: number | null;
    direction_prediction: string;
    direction_correct: boolean;
    confidence: number;
    model: string;
    primary_model: string;
    secondary_model: string;
    gpt_confidence: number;
    distilbert_confidence: number;
    gpt_direction?: string;
    distilbert_direction?: string;
    models_agree: boolean;
    agreement_type: string;
    signal_type: string;
    signal_strength: string;
    signal_action: string;
    dual_ai_agreement?: boolean;
    dual_ai_agreement_score: number;
    articles_analyzed: number;
    analysis_type: string;
    execution_time_ms: number;
    successful_models: number;
    trigger_mode?: string;
    timestamp: string;
}
export interface DailyAnalysis {
    date: string;
    symbols: Array<{
        symbol: string;
        sentiment: string;
        confidence: number;
        direction: string;
        model: string;
        layer_consistency: number;
        analysis_type: string;
    }>;
    execution_time: number;
    batch_stored: boolean;
    total_symbols: number;
}
export interface BatchStoreResult {
    success: boolean;
    total_operations: number;
    successful_operations: number;
    failed_operations: number;
    execution_time_ms?: number;
    daily_analysis_stored?: boolean;
    symbol_analyses_stored?: number;
    error?: string;
}
export interface CronHealthData {
    timestamp: number;
    date: string;
    status: 'success' | 'partial' | 'failed';
    execution_time_ms: number;
    symbols_processed: number;
    symbols_successful: number;
    symbols_fallback: number;
    symbols_failed: number;
    analysis_success_rate: number;
    storage_operations: number;
    errors: string[];
}
export interface CronHealthStatus {
    healthy: boolean;
    last_execution?: string | null;
    hours_since_last_run?: number;
    last_status?: string;
    symbols_processed?: number;
    success_rate?: number;
    execution_time_ms?: number;
    full_health_data?: CronHealthData;
    message?: string;
    error?: string;
}
export interface CompactAnalysisData {
    symbol: string;
    analysis_type: string;
    timestamp: string;
    sentiment_layers: Array<{
        layer_type: string;
        sentiment: string;
        confidence: number;
        model: string;
    }>;
    confidence_metrics: {
        overall_confidence: number;
        base_confidence: number;
        consistency_bonus: number;
        agreement_bonus: number;
    };
    trading_signals: any;
    sentiment_patterns: {
        overall_consistency?: string;
        primary_sentiment?: string;
        model_agreement?: boolean;
    };
    analysis_metadata: {
        method: string;
        models_used: string[];
        total_processing_time: number;
        news_quality_score?: number;
    };
    news_data: {
        total_articles: number;
        time_range?: any;
    };
}
/**
 * Get fact table data from stored analysis results
 */
export declare function getFactTableData(env: CloudflareEnvironment): Promise<FactTableRecord[]>;
/**
 * Get fact table data with custom date range and week selection
 */
export declare function getFactTableDataWithRange(env: CloudflareEnvironment, rangeDays?: number, weekSelection?: string): Promise<FactTableRecord[]>;
/**
 * Store fact table data to KV storage
 */
export declare function storeFactTableData(env: CloudflareEnvironment, factTableData: FactTableRecord[]): Promise<boolean>;
/**
 * Store granular analysis for a single symbol
 */
export declare function storeSymbolAnalysis(env: CloudflareEnvironment, symbol: string, analysisData: any): Promise<boolean>;
/**
 * Batch store multiple analysis results with optimized parallel operations
 */
export declare function batchStoreAnalysisResults(env: CloudflareEnvironment, analysisResults: any[]): Promise<BatchStoreResult>;
/**
 * Track cron execution health for monitoring and debugging
 */
export declare function trackCronHealth(env: CloudflareEnvironment, status: 'success' | 'partial' | 'failed', executionData?: any): Promise<boolean>;
/**
 * Get latest cron health status for monitoring
 */
export declare function getCronHealthStatus(env: CloudflareEnvironment): Promise<CronHealthStatus>;
/**
 * Get analysis results for all symbols on a specific date
 */
export declare function getSymbolAnalysisByDate(env: CloudflareEnvironment, dateString: string, symbols?: string[] | null): Promise<any[]>;
/**
 * Get analysis results by date
 */
export declare function getAnalysisResultsByDate(env: CloudflareEnvironment, dateString: string): Promise<any | null>;
/**
 * List all KV keys with a prefix
 */
export declare function listKVKeys(env: CloudflareEnvironment, prefix?: string): Promise<any[]>;
//# sourceMappingURL=data.d.ts.map