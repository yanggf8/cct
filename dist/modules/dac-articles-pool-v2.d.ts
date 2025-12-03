import type { NewsArticle } from '../types.js';
/**
 * DAC Article Pool Response (v3.7.0+)
 */
export interface ArticlePoolResponse {
    success: boolean;
    articles: NewsArticle[];
    metadata?: {
        fetchedAt: string;
        stale: boolean;
        ttlSec: number;
        freshCount: number;
        oldestAgeHours: number;
        source: 'Finnhub' | 'NewsData.io' | 'mixed';
        lastErrorAt?: string;
        lastErrorCode?: string;
    };
    error?: 'NOT_FOUND' | 'STALE' | 'FRESHNESS_EXPIRED' | 'UNEXPECTED_ERROR';
    errorMessage?: string;
}
/**
 * DAC Categories Response (v3.7.0+)
 */
export interface CategoriesResponse {
    success: boolean;
    categories: {
        Geopolitical: ArticlePoolResponse;
        Monetary: ArticlePoolResponse;
        Economic: ArticlePoolResponse;
        Market: ArticlePoolResponse;
    };
    fetchedAt: string;
}
/**
 * DAC Pool Enhanced Status (v3.8.0+)
 */
export interface PoolEnhancedStatus {
    success: boolean;
    timestamp: string;
    quota: {
        limit: number;
        used: number;
        remaining: number;
        resetAt: string;
        utilizationPercent: number;
        status: 'healthy' | 'warning' | 'critical' | 'exhausted';
    };
    providerHealth: {
        isHealthy: boolean;
        status: 'healthy' | 'degraded' | 'failed' | 'unknown';
        consecutiveFailures: number;
    };
    summary: {
        totalPools: number;
        freshPools: number;
        stalePools: number;
        quotaUtilization: number;
        recommendation: string;
    };
}
/**
 * Client for accessing DAC Article Pool via Cloudflare service binding
 * Updated for DAC v3.7.0+ architecture
 */
export declare class DACArticlesPoolClientV2 {
    private readonly dacBackend;
    private readonly apiKey;
    constructor(dacBackend: Fetcher, apiKey: string);
    /**
     * Get stock articles via service binding
     * Uses DAC admin probe endpoint: /api/admin/article-pool/probe/stock/:symbol
     */
    getStockArticles(symbol: string): Promise<ArticlePoolResponse>;
    /**
     * Get sector articles (v3.7.0+)
     * Uses DAC admin probe endpoint: /api/admin/article-pool/probe/sector/:sector
     */
    getSectorArticles(sector: string): Promise<ArticlePoolResponse>;
    /**
     * Get all category articles (v3.7.0+)
     * Uses DAC admin probe endpoint: /api/admin/article-pool/probe/categories
     */
    getCategoryArticles(): Promise<CategoriesResponse>;
    /**
     * Get pool health and quota status (v3.8.0+)
     * Uses DAC admin endpoint: /api/admin/article-pool/enhanced-status
     */
    getEnhancedStatus(): Promise<PoolEnhancedStatus | null>;
    /**
     * Check if DAC pool is available and healthy
     */
    checkHealth(): Promise<boolean>;
}
/**
 * Create DAC articles pool client instance using service binding
 */
export declare function createDACArticlesPoolClientV2(env: {
    DAC_BACKEND?: Fetcher;
    DAC_ARTICLES_POOL_API_KEY?: string;
}): DACArticlesPoolClientV2 | null;
/**
 * Calculate confidence penalty based on article pool quality
 */
export declare function calculateConfidencePenalty(articleCount: number, freshCount: number, isStale: boolean): number;
/**
 * Integration adapter for existing CCT sentiment pipeline
 */
export declare class DACArticlesAdapterV2 {
    private client;
    constructor(env: {
        DAC_BACKEND?: Fetcher;
        DAC_ARTICLES_POOL_API_KEY?: string;
    });
    /**
     * Get articles for sentiment analysis
     */
    getArticlesForSentiment(symbol: string): Promise<{
        articles: NewsArticle[];
        source: 'dac_pool' | 'fallback';
        confidencePenalty: number;
        metadata?: any;
    }>;
    /**
     * Check if DAC integration is healthy
     */
    isHealthy(): Promise<boolean>;
}
//# sourceMappingURL=dac-articles-pool-v2.d.ts.map