/**
 * Optimized AI Analysis Module - Rate Limit Aware
 *
 * Intelligent AI analysis system that adapts to rate limits by:
 * 1. Using simplified analysis when rate limits are hit
 * 2. Implementing smart caching and batching
 * 3. Graceful degradation to technical analysis
 * 4. Progressive enhancement with fallback strategies
 */
import type { CloudflareEnvironment } from '../types';
export interface OptimizedAnalysisResult {
    symbol: string;
    timestamp: string;
    analysis_type: 'full_ai' | 'technical_fallback' | 'cached';
    sentiment: {
        direction: 'bullish' | 'bearish' | 'neutral';
        confidence: number;
        reasoning: string;
    };
    technical_indicators?: {
        trend: 'uptrend' | 'downtrend' | 'sideways';
        momentum: 'strong' | 'moderate' | 'weak';
        volatility: 'high' | 'medium' | 'low';
    };
    market_data?: {
        current_price: number;
        price_change: number;
        volume: number;
    };
    metadata: {
        processing_time_ms: number;
        cache_hit: boolean;
        model_used: string;
        articles_analyzed?: number;
        rate_limit_hit?: boolean;
    };
}
export interface BatchOptimizedResult {
    results: OptimizedAnalysisResult[];
    summary: {
        total_symbols: number;
        successful_analyses: number;
        cache_hits: number;
        rate_limited: number;
        technical_fallbacks: number;
        average_processing_time: number;
    };
}
/**
 * Optimized AI Analysis Manager
 */
export declare class OptimizedAIAnalyzer {
    private env;
    private dal;
    private requestQueue;
    private processingQueue;
    private lastRequestTime;
    constructor(env: CloudflareEnvironment);
    /**
     * Analyze a single symbol with rate limit awareness
     */
    analyzeSymbol(symbol: string, forceRefresh?: boolean): Promise<OptimizedAnalysisResult>;
    /**
     * Batch analyze multiple symbols with intelligent rate limiting
     */
    analyzeBatch(symbols: string[]): Promise<BatchOptimizedResult>;
    /**
     * Perform AI analysis with rate limit protection
     */
    private performAIAnalysisWithRateLimit;
    /**
     * Perform full AI analysis (GPT only to reduce subrequests)
     */
    private performFullAIAnalysis;
    /**
     * Get news data with retry logic
     */
    private getNewsDataWithRetry;
    /**
     * Get market data
     */
    private getMarketData;
    /**
     * Create technical analysis fallback
     */
    private createTechnicalAnalysis;
    /**
     * Create technical fallback for errors
     */
    private createTechnicalFallback;
    /**
     * Calculate basic technical indicators
     */
    private calculateBasicTechnicals;
    /**
     * Parse GPT response
     */
    private parseGPTResponse;
    /**
     * Intelligent delay based on rate limit status
     */
    private intelligentDelay;
}
/**
 * Analyze multiple symbols with optimized rate limiting
 */
export declare function performOptimizedAnalysis(symbols: string[], env: CloudflareEnvironment): Promise<BatchOptimizedResult>;
/**
 * Analyze single symbol with optimization
 */
export declare function analyzeSingleSymbolOptimized(symbol: string, env: CloudflareEnvironment, forceRefresh?: boolean): Promise<OptimizedAnalysisResult>;
//# sourceMappingURL=optimized-ai-analysis.d.ts.map