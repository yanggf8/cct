/**
 * Core Analysis Module - TypeScript
 * ✅ GPT-OSS-120B POWERED: Advanced AI analysis using Cloudflare's built-in AI models
 * Uses state-of-the-art language models for market sentiment and trading signal generation
 */
import type { CloudflareEnvironment, SentimentLayer, TrackedSignal } from '../types.js';
export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    totalEntries: number;
}
export interface TradingSignal {
    direction: 'up' | 'down' | 'neutral' | 'hold';
    target_price?: number;
    current_price: number;
    confidence: number;
    reasoning: string;
    timestamp?: Date | string;
    technical_indicators?: Record<string, number | string>;
    market_conditions?: string | Record<string, number | string>;
    tags?: string[];
    sentiment_layers?: SentimentLayer[];
    model_type?: string;
}
export interface SymbolAnalysisResult {
    symbol: string;
    direction: 'up' | 'down' | 'neutral' | 'hold';
    current_price: number;
    predicted_price: number;
    confidence: number;
    reasoning: string;
    model_type: string;
    timestamp: Date;
    technical_indicators: Record<string, number | string>;
    market_conditions: string | Record<string, number | string>;
    sentiment_layers?: SentimentLayer[];
    tags?: string[];
}
export interface PerformanceMetrics {
    success_rate: number;
    total_symbols: number;
    successful_analyses: number;
    failed_analyses: number;
    cache_stats?: {
        hit_rate: number;
        cache_hits: number;
        cache_misses: number;
        total_entries: number;
    };
}
export interface AnalysisResults {
    symbols_analyzed: string[];
    trading_signals: Record<string, SymbolAnalysisResult>;
    analysis_time: string;
    trigger_mode: string;
    performance_metrics: PerformanceMetrics;
}
export interface AnalysisOptions {
    triggerMode?: string;
}
export interface MarketDataResponse {
    success: boolean;
    data?: {
        symbol: string;
        current_price: number;
        ohlcv: number[][];
        last_updated: string;
    };
    error?: string;
}
export interface DualAIStatistics {
    agreement_rate?: number;
    confidence_gap?: number;
    model_consistency?: number;
}
export interface ExecutionMetrics {
    total_time_ms?: number;
    model_time_ms?: number;
    data_fetch_time_ms?: number;
}
export interface EnhancedAnalysisResult {
    trading_signals?: TradingSignal[];
    overall_sentiment?: string | {
        sentiment: string;
        confidence: number;
    };
    market_conditions?: string | Record<string, number | string>;
    sentiment_signals?: Record<string, number | string>;
    analysis_time?: string;
    trigger_mode?: string;
    symbols_analyzed?: string[];
    dual_ai_statistics?: DualAIStatistics;
    execution_metrics?: ExecutionMetrics;
}
export interface HighConfidenceSignal {
    id: string;
    symbol: string;
    prediction: 'up' | 'down' | 'neutral' | 'hold';
    confidence: number;
    currentPrice: number;
    predictedPrice: number;
    timestamp: string;
    status: 'pending' | 'tracking' | 'completed' | 'failed';
    analysisData: {
        sentiment_layers: SentimentLayer[];
        market_conditions: string | Record<string, number | string>;
        reasoning: string;
        tags: string[];
    };
    tracking: {
        morningSignal: {
            prediction: string;
            confidence: number;
            generatedAt: string;
        };
        intradayPerformance: PerformanceData | null;
        endOfDayPerformance: PerformanceData | null;
        weeklyPerformance: PerformanceData | null;
    };
}
export interface HighConfidenceSignalsData {
    date: string;
    signals: HighConfidenceSignal[];
    metadata: {
        totalSignals: number;
        highConfidenceSignals: number;
        averageConfidence: number;
        generatedAt: string;
        symbols: string[];
    };
}
export interface SignalTracking {
    morningSignal: {
        prediction: string;
        confidence: number;
        generatedAt: string;
    };
    intradayPerformance: PerformanceData | null;
    endOfDayPerformance: PerformanceData | null;
    weeklyPerformance: PerformanceData | null;
}
export interface SignalTrackingData {
    date: string;
    signals: TrackedSignal[];
    lastUpdated: string;
}
export interface PerformanceData {
    status?: string;
    [key: string]: any;
}
/**
 * Run comprehensive analysis
 * ✅ GENUINE DUAL AI: Real GPT-OSS-120B + DistilBERT-SST-2 models with agreement logic
 */
export declare function runBasicAnalysis(env: CloudflareEnvironment, options?: AnalysisOptions): Promise<AnalysisResults>;
/**
 * Run weekend market close analysis
 */
export declare function runWeeklyMarketCloseAnalysis(env: CloudflareEnvironment, currentTime: Date): Promise<AnalysisResults>;
/**
 * Run pre-market analysis
 */
export declare function runPreMarketAnalysis(env: CloudflareEnvironment, options?: AnalysisOptions): Promise<AnalysisResults>;
/**
 * Get high-confidence signals for intraday tracking
 */
export declare function getHighConfidenceSignalsForTracking(env: CloudflareEnvironment, date: Date): Promise<HighConfidenceSignal[]>;
/**
 * Update signal performance tracking
 */
export declare function updateSignalPerformanceTracking(env: CloudflareEnvironment, signalId: string, performanceData: PerformanceData, date: Date): Promise<void>;
//# sourceMappingURL=analysis.d.ts.map