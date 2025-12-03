import type { NewsArticle } from '../types.js';
export interface DACArticlePoolEntry {
    articles: DACNewsArticle[];
    metadata: DACArticlePoolMetadata;
}
export interface DACArticlePoolMetadata {
    fetchedAt: string;
    runWindow: string;
    freshCount: number;
    oldestAgeHours: number;
    duplicatesFiltered: number;
    apiCallsUsed: number;
    source: 'Finnhub' | 'NewsData.io';
}
export interface DACNewsArticle {
    id: string;
    headline: string;
    source: string;
    url: string;
    publishedAt: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    relevanceScore?: number;
    symbols: string[];
    summary?: string;
}
/**
 * Client for accessing DAC Articles Pool via Cloudflare service binding
 */
export declare class DACArticlesPoolClient {
    private readonly dacBackend;
    private readonly apiKey;
    constructor(dacBackend: any, apiKey: string);
    /**
     * Get articles from DAC pool for a symbol using service binding
     */
    getArticles(symbol: string): Promise<DACArticlePoolEntry | null>;
    /**
     * Get latest articles from DAC pool via service binding
     */
    getLatestArticles(symbol: string): Promise<DACArticlePoolEntry | null>;
    /**
     * Check pool health and metrics via service binding
     */
    getPoolMetrics(): Promise<{
        symbolCoverage: number;
        poolSize: number;
        hitRate: number;
        quotaUtilization: number;
    } | null>;
    /**
     * Convert DAC articles to CCT format
     */
    convertToCCTArticles(dacArticles: DACNewsArticle[]): NewsArticle[];
    /**
     * Check if DAC pool is available and healthy via service binding
     */
    checkHealth(): Promise<boolean>;
    /**
     * Batch fetch articles for multiple symbols
     */
    batchGetArticles(symbols: string[]): Promise<Map<string, DACArticlePoolEntry | null>>;
}
/**
 * Create DAC articles pool client instance using service binding
 */
export declare function createDACArticlesPoolClient(env: {
    DAC_BACKEND?: any;
    DAC_ARTICLES_POOL_API_KEY?: string;
}): DACArticlesPoolClient | null;
/**
 * Integration adapter for existing CCT sentiment pipeline
 */
export declare class DACArticlesAdapter {
    private client;
    constructor(env: {
        DAC_BACKEND?: any;
        DAC_ARTICLES_POOL_API_KEY?: string;
    });
    /**
     * Get articles for sentiment analysis
     */
    getArticlesForSentiment(symbol: string): Promise<{
        articles: NewsArticle[];
        source: 'dac_pool' | 'fallback';
        confidencePenalty: number;
        metadata?: DACArticlePoolMetadata;
    }>;
    /**
     * Check if DAC integration is healthy
     */
    isHealthy(): Promise<boolean>;
}
//# sourceMappingURL=dac-articles-pool.d.ts.map