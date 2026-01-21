// DAC Articles Pool Client V2
// Updated for DAC v3.7.0+ Article Pool V2 architecture
// Uses Cloudflare service binding for direct Worker-to-Worker calls

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
export class DACArticlesPoolClientV2 {
  private readonly dacBackend: Fetcher;
  private readonly apiKey: string;

  constructor(dacBackend: Fetcher, apiKey: string) {
    this.dacBackend = dacBackend;
    this.apiKey = apiKey;
  }

  /**
   * Get stock articles via service binding
   * Uses DAC admin accessor endpoint: /api/admin/article-pool/accessor/stock/:symbol
   * Returns full articles array (not just metadata like probe endpoint)
   */
  async getStockArticles(symbol: string): Promise<ArticlePoolResponse> {
    try {
      const request = new Request(
        `/api/admin/article-pool/accessor/stock/${symbol}`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
            'User-Agent': 'CCT-Service-Binding/2.0'
          }
        }
      );

      const response = await this.dacBackend.fetch(request);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            articles: [],
            error: 'NOT_FOUND',
            errorMessage: `No articles found for ${symbol}`
          };
        }
        throw new Error(`DAC API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;

      // DAC accessor endpoint returns direct structure (not nested like probe)
      // Note: metadata can be undefined - let getArticlesForSentiment handle defaults via || operators
      return {
        success: data.success || false,
        articles: data.articles || [],
        metadata: data.metadata, // Pass through as-is (can be undefined)
        error: data.error,
        errorMessage: data.errorMessage
      };

    } catch (error) {
      console.error(`[DAC_POOL_V2] Failed to get articles for ${symbol}:`, error);
      return {
        success: false,
        articles: [],
        error: 'UNEXPECTED_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get sector articles (v3.7.0+)
   * Uses DAC admin probe endpoint: /api/admin/article-pool/probe/sector/:sector
   */
  async getSectorArticles(sector: string): Promise<ArticlePoolResponse> {
    try {
      const request = new Request(
        `/api/admin/article-pool/probe/sector/${sector}`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const response = await this.dacBackend.fetch(request);

      if (!response.ok) {
        return {
          success: false,
          articles: [],
          error: 'NOT_FOUND',
          errorMessage: `No articles found for sector ${sector}`
        };
      }

      return await response.json();

    } catch (error) {
      console.error(`[DAC_POOL_V2] Failed to get sector articles for ${sector}:`, error);
      return {
        success: false,
        articles: [],
        error: 'UNEXPECTED_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get market index articles (v3.10.0+)
   * Uses DAC admin accessor endpoint: /api/admin/article-pool/accessor/market/:symbol
   * For SPY, QQQ, DIA, IWM market sentiment
   */
  async getMarketArticles(symbol: string): Promise<ArticlePoolResponse> {
    try {
      const request = new Request(
        `/api/admin/article-pool/accessor/market/${symbol.toUpperCase()}`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
            'User-Agent': 'CCT-Service-Binding/2.0'
          }
        }
      );

      const response = await this.dacBackend.fetch(request);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            articles: [],
            error: 'NOT_FOUND',
            errorMessage: `No articles found for market index ${symbol}`
          };
        }
        throw new Error(`DAC API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;

      return {
        success: data.success || false,
        articles: data.articles || [],
        metadata: data.metadata,
        error: data.error,
        errorMessage: data.errorMessage
      };

    } catch (error) {
      console.error(`[DAC_POOL_V2] Failed to get market articles for ${symbol}:`, error);
      return {
        success: false,
        articles: [],
        error: 'UNEXPECTED_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all category articles (v3.7.0+)
   * Uses DAC admin probe endpoint: /api/admin/article-pool/probe/categories
   */
  async getCategoryArticles(): Promise<CategoriesResponse> {
    try {
      const request = new Request(
        `/api/admin/article-pool/probe/categories`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const response = await this.dacBackend.fetch(request);

      if (!response.ok) {
        throw new Error(`DAC API error: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('[DAC_POOL_V2] Failed to get category articles:', error);
      return {
        success: false,
        categories: {
          Geopolitical: { success: false, articles: [], error: 'UNEXPECTED_ERROR' },
          Monetary: { success: false, articles: [], error: 'UNEXPECTED_ERROR' },
          Economic: { success: false, articles: [], error: 'UNEXPECTED_ERROR' },
          Market: { success: false, articles: [], error: 'UNEXPECTED_ERROR' }
        },
        fetchedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Get pool health and quota status (v3.8.0+)
   * Uses DAC admin endpoint: /api/admin/article-pool/enhanced-status
   */
  async getEnhancedStatus(): Promise<PoolEnhancedStatus | null> {
    try {
      const request = new Request(
        `/api/admin/article-pool/enhanced-status`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const response = await this.dacBackend.fetch(request);

      if (!response.ok) {
        throw new Error(`DAC API error: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('[DAC_POOL_V2] Failed to get enhanced status:', error);
      return null;
    }
  }

  /**
   * Check if DAC pool is available and healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const request = new Request('/health', {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      const response = await this.dacBackend.fetch(request);
      return response.ok;
    } catch (error) {
      console.error('[DAC_POOL_V2] Health check failed:', error);
      return false;
    }
  }
}

/**
 * Create DAC articles pool client instance using service binding
 */
export function createDACArticlesPoolClientV2(env: {
  DAC_BACKEND?: Fetcher | undefined;
  X_API_KEY?: string;
}): DACArticlesPoolClientV2 | null {
  const dacBackend = env.DAC_BACKEND;
  const apiKey = env.X_API_KEY;

  if (!dacBackend) {
    console.warn('[DAC_POOL_V2] DAC backend service binding not available');
    return null;
  }

  if (!apiKey) {
    console.error('[DAC_POOL_V2] X_API_KEY secret not configured');
    return null;
  }

  return new DACArticlesPoolClientV2(dacBackend, apiKey);
}

/**
 * Calculate confidence penalty based on article pool quality
 */
export function calculateConfidencePenalty(
  articleCount: number,
  freshCount: number,
  isStale: boolean
): number {
  let penalty = 0;

  // Penalty for stale data
  if (isStale) penalty -= 15;

  // Penalty for low fresh article count
  if (freshCount < 3) penalty -= 10;

  // Penalty for low total article count
  if (articleCount < 3) penalty -= 20;

  return penalty;
}

/**
 * Integration adapter for existing CCT sentiment pipeline
 */
export class DACArticlesAdapterV2 {
  private client: DACArticlesPoolClientV2 | null;

  constructor(env: {
    DAC_BACKEND?: Fetcher | undefined;
    X_API_KEY?: string;
  }) {
    this.client = createDACArticlesPoolClientV2(env);
  }

  /**
   * Get articles for sentiment analysis
   */
  async getArticlesForSentiment(symbol: string): Promise<{
    articles: NewsArticle[];
    source: 'dac_pool' | 'fallback';
    confidencePenalty: number;
    metadata?: any;
  }> {
    if (!this.client) {
      return {
        articles: [],
        source: 'fallback',
        confidencePenalty: -20 // Penalty for no DAC integration
      };
    }

    const poolResult = await this.client.getStockArticles(symbol);

    if (poolResult.success && poolResult.articles.length > 0) {
      // Calculate confidence penalty based on DAC data quality
      const penalty = calculateConfidencePenalty(
        poolResult.articles.length,
        poolResult.metadata?.freshCount || 0,
        poolResult.metadata?.stale || false
      );

      return {
        articles: poolResult.articles,
        source: 'dac_pool',
        confidencePenalty: penalty,
        metadata: poolResult.metadata
      };
    }

    return {
      articles: [],
      source: 'fallback',
      confidencePenalty: -10 // Small penalty for pool miss
    };
  }

  /**
   * Check if DAC integration is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.client) return false;
    return await this.client.checkHealth();
  }
}
