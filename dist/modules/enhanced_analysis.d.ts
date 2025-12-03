import { type NewsArticle } from './free_sentiment_pipeline.js';
import type { CloudflareEnvironment } from '../types.js';
export interface AnalysisOptions {
    triggerMode?: string;
    predictionHorizons?: any;
    currentTime?: Date;
    cronExecutionId?: string;
    marketData?: any;
    symbol?: string;
    [key: string]: any;
}
export interface SentimentResult {
    sentiment: string;
    confidence: number;
    reasoning?: string;
    source_count: number;
    method: string;
    fallback_used?: boolean;
    validation_triggered?: boolean;
    source?: string;
    model?: string;
    analysis_type?: string;
    cost_estimate?: {
        input_tokens: number;
        output_tokens: number;
        total_cost: number;
    };
    score?: number;
    sentiment_distribution?: any;
    processed_items?: number;
    error_details?: string;
}
export interface SentimentSignal {
    symbol: string;
    sentiment_analysis: {
        sentiment: string;
        confidence: number;
        reasoning: string;
        dual_ai_comparison?: any;
        error?: boolean;
        skip_technical?: boolean;
    };
    news_count: number;
    timestamp: string;
    method: string;
}
export interface EnhancedAnalysisResults {
    sentiment_signals: Record<string, SentimentSignal>;
    analysis_time: string;
    trigger_mode: string;
    symbols_analyzed: string[];
    dual_ai_statistics?: any;
    execution_metrics?: {
        total_time_ms: number;
        analysis_enabled: boolean;
        sentiment_sources: string[];
        cloudflare_ai_enabled: boolean;
        analysis_method: string;
    };
}
export interface ValidationResult {
    success: boolean;
    news_count?: number;
    sentiment?: string;
    confidence?: number;
    ai_available?: boolean;
    method?: string;
    debug_info?: any;
    error?: string;
}
export interface ParsedResponse {
    sentiment: string;
    confidence: number;
    reasoning?: string;
}
/**
 * Run enhanced analysis with dual AI comparison system
 * Simple, transparent comparison between GPT-OSS-120B and DistilBERT
 */
export declare function runEnhancedAnalysis(env: CloudflareEnvironment, options?: AnalysisOptions): Promise<EnhancedAnalysisResults>;
/**
 * Cloudflare GPT-OSS-120B sentiment analysis (primary method)
 */
export declare function getSentimentWithFallbackChain(symbol: string, newsData: NewsArticle[], env: CloudflareEnvironment): Promise<SentimentResult>;
export declare function getGPTOSSSentiment(symbol: string, newsData: NewsArticle[], env: CloudflareEnvironment): Promise<SentimentResult>;
/**
 * DistilBERT sentiment analysis (final fallback)
 */
export declare function getDistilBERTSentiment(symbol: string, newsData: NewsArticle[], env: CloudflareEnvironment): Promise<SentimentResult>;
/**
 * Enhanced pre-market analysis with dual AI comparison system
 */
export declare function runEnhancedPreMarketAnalysis(env: CloudflareEnvironment, options?: AnalysisOptions): Promise<any>;
/**
 * Phase 1 validation: Check if sentiment enhancement is working
 */
export declare function validateSentimentEnhancement(env: CloudflareEnvironment): Promise<ValidationResult>;
//# sourceMappingURL=enhanced_analysis.d.ts.map