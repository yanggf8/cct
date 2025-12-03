/**
 * Enhanced Sentiment Analysis Pipeline with DAC Integration
 * Prioritizes DAC articles pool, falls back to free APIs
 * Uses Durable Objects cache for all operations
 */
import type { CloudflareEnvironment, NewsArticle } from '../types.js';
interface EnhancedSentimentConfig {
    sources: {
        dac_pool: {
            priority: number;
            weight: number;
            enabled: boolean;
        };
        fmp: {
            priority: number;
            weight: number;
            enabled: boolean;
        };
        newsapi: {
            priority: number;
            weight: number;
            enabled: boolean;
        };
        yahoo: {
            priority: number;
            weight: number;
            enabled: boolean;
        };
    };
    llm: {
        provider: string;
        model: string;
        fallback: string;
    };
    cache: {
        ttl: number;
        staleTtl: number;
    };
}
interface EnhancedNewsArticle extends NewsArticle {
    source_priority: number;
    source_weight: number;
    source_metadata?: {
        freshness_hours?: number;
        duplicates_filtered?: number;
        api_calls_used?: number;
    };
    dac_confidence_penalty?: number;
}
interface EnhancedSentimentResult {
    symbol: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    score: number;
    reasoning: string;
    sources_used: string[];
    article_count: number;
    quality_metrics: {
        avg_freshness_hours: number;
        total_confidence_penalty: number;
        source_diversity: number;
    };
    timestamp: string;
}
/**
 * Enhanced sentiment analysis with DAC articles pool integration
 */
export declare class EnhancedSentimentPipeline {
    private dacAdapter;
    private cache;
    private env;
    constructor(env: CloudflareEnvironment);
    /**
     * Gather articles from multiple sources with DAC priority
     */
    private gatherArticlesFromSources;
    /**
     * Get articles from FMP with sentiment
     */
    private getFMPArticles;
    /**
     * Get articles from NewsAPI
     */
    private getNewsAPIArticles;
    /**
     * Get articles from Yahoo Finance
     */
    private getYahooArticles;
    /**
     * Perform sentiment analysis on articles using Cloudflare AI
     */
    private performSentimentAnalysis;
    /**
     * Rule-based sentiment analysis fallback
     */
    private ruleBasedSentiment;
    /**
     * Get sentiment score from label
     */
    private getSentimentScore;
    /**
     * Calculate quality metrics
     */
    private calculateQualityMetrics;
    /**
     * Build detailed reasoning
     */
    private buildReasoning;
    /**
     * Cache analysis result
     */
    private cacheResult;
    /**
     * Check health of all sources
     */
    checkHealth(): Promise<{
        dac_pool: boolean;
        cache: boolean;
        fmp_available: boolean;
        newsapi_available: boolean;
    }>;
    private checkFMPHealth;
    private checkNewsAPIHealth;
}
export declare function createEnhancedSentimentPipeline(env: CloudflareEnvironment): EnhancedSentimentPipeline;
export type { EnhancedNewsArticle, EnhancedSentimentResult, EnhancedSentimentConfig };
//# sourceMappingURL=enhanced-sentiment-pipeline.d.ts.map