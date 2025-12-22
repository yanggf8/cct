// DAC Articles Pool Client
// Integration module for accessing DAC's article pool via Cloudflare service bindings

import { createLogger } from './logging.js';
import type { NewsArticle } from '../types.js';

const logger = createLogger('dac-articles-pool');

// DAC Articles Pool Types (based on DAC implementation)
export interface DACArticlePoolEntry {
  articles: DACNewsArticle[];
  metadata: DACArticlePoolMetadata;
}

export interface DACArticlePoolMetadata {
  fetchedAt: string;           // ISO8601 timestamp
  runWindow: string;            // YYYYMMDDHH
  freshCount: number;           // Articles < 48h old
  oldestAgeHours: number;       // Age of oldest article
  duplicatesFiltered: number;   // Duplicates removed
  apiCallsUsed: number;         // API calls used
  source: 'Finnhub' | 'NewsData.io';
}

export interface DACNewsArticle {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;          // ISO8601
  sentiment?: 'positive' | 'negative' | 'neutral';
  relevanceScore?: number;      // 0-1 relevance
  symbols: string[];            // Related stock symbols
  summary?: string;
}

/**
 * Client for accessing DAC Articles Pool via Cloudflare service binding
 */
export class DACArticlesPoolClient {
  private readonly dacBackend: any;
  private readonly apiKey: string;

  constructor(dacBackend: any, apiKey: string) {
    this.dacBackend = dacBackend;
    this.apiKey = apiKey;
  }

  /**
   * Get articles from DAC pool for a symbol using service binding
   */
  async getArticles(symbol: string): Promise<DACArticlePoolEntry | null> {
    try {
      if (!this.dacBackend) {
        logger.warn('DAC backend service binding not available');
        return null;
      }

      // Call DAC backend directly via service binding
      const request = new Request(`https://dac-backend.workers.dev/api/articles/pool/${encodeURIComponent(symbol)}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'CCT-Service-Binding/1.0'
        }
      });

      const response = await this.dacBackend.fetch(request);

      if (!response.ok) {
        if (response.status === 404) {
          logger.info(`No articles found for ${symbol}`);
          return null;
        }
        throw new Error(`DAC API error: ${response.status} ${response.statusText}`);
      }

      const poolEntry = await response.json() as DACArticlePoolEntry;

      logger.info(`Retrieved articles from DAC pool via service binding`, {
        symbol,
        articleCount: poolEntry.articles.length,
        source: poolEntry.metadata.source,
        freshCount: poolEntry.metadata.freshCount,
        ageHours: poolEntry.metadata.oldestAgeHours,
        method: 'service_binding'
      });

      return poolEntry;

    } catch (error) {
      logger.error(`Failed to get articles for ${symbol} via service binding`, {
        error: error instanceof Error ? error.message : 'Unknown'
      });
      return null;
    }
  }

  /**
   * Get latest articles from DAC pool via service binding
   */
  async getLatestArticles(symbol: string): Promise<DACArticlePoolEntry | null> {
    try {
      if (!this.dacBackend) {
        return null;
      }

      const request = new Request(`https://dac-backend.workers.dev/api/articles/pool/${encodeURIComponent(symbol)}/latest`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      const response = await this.dacBackend.fetch(request);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`DAC API error: ${response.status} ${response.statusText}`);
      }

      return await response.json() as DACArticlePoolEntry;

    } catch (error) {
      logger.error(`Failed to get latest articles for ${symbol}`, {
        error: error instanceof Error ? error.message : 'Unknown'
      });
      return null;
    }
  }

  /**
   * Check pool health and metrics via service binding
   */
  async getPoolMetrics(): Promise<{
    symbolCoverage: number;
    poolSize: number;
    hitRate: number;
    quotaUtilization: number;
  } | null> {
    try {
      if (!this.dacBackend) {
        return null;
      }

      const request = new Request('https://dac-backend.workers.dev/api/articles/pool/metrics', {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      const response = await this.dacBackend.fetch(request);

      if (!response.ok) {
        throw new Error(`DAC API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      logger.error('Failed to get pool metrics', {
        error: error instanceof Error ? error.message : 'Unknown'
      });
      return null;
    }
  }

  /**
   * Convert DAC articles to CCT format
   * Preserves DAC metadata (sentiment, relevanceScore, symbols, id) as extra properties
   */
  convertToCCTArticles(dacArticles: DACNewsArticle[]): NewsArticle[] {
    return dacArticles.map(article => ({
      // Required NewsArticle fields
      title: article.headline,
      content: article.summary || article.headline,
      source: article.source,
      url: article.url,
      publishedAt: article.publishedAt,
      summary: article.summary || '',
      // Preserve DAC metadata for downstream processing (both casing conventions)
      sentiment: article.sentiment,
      relevanceScore: article.relevanceScore,
      relevance_score: article.relevanceScore, // snake_case for per_symbol_analysis compatibility
      symbols: article.symbols,
      id: article.id
    } as NewsArticle));
  }

  /**
   * Check if DAC pool is available and healthy via service binding
   */
  async checkHealth(): Promise<boolean> {
    try {
      if (!this.dacBackend) {
        logger.warn('DAC backend service binding not available for health check');
        return false;
      }

      const request = new Request('https://dac-backend.workers.dev/api/health', {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      const response = await this.dacBackend.fetch(request);
      return response.ok;
    } catch (error) {
      logger.error('Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown'
      });
      return false;
    }
  }

  /**
   * Batch fetch articles for multiple symbols
   */
  async batchGetArticles(symbols: string[]): Promise<Map<string, DACArticlePoolEntry | null>> {
    const results = new Map<string, DACArticlePoolEntry | null>();

    // Fetch in parallel with concurrency limit
    const concurrencyLimit = 5;
    for (let i = 0; i < symbols.length; i += concurrencyLimit) {
      const batch = symbols.slice(i, i + concurrencyLimit);

      const promises = batch.map(async (symbol) => {
        const result = await this.getArticles(symbol);
        return { symbol, result };
      });

      const batchResults = await Promise.allSettled(promises);

      batchResults.forEach((promiseResult, index) => {
        const symbol = batch[index];
        if (promiseResult.status === 'fulfilled') {
          results.set(symbol, promiseResult.value.result);
        } else {
          logger.error(`Batch fetch failed for ${symbol}`, {
            error: promiseResult.reason
          });
          results.set(symbol, null);
        }
      });
    }

    return results;
  }

  }

/**
 * Create DAC articles pool client instance using service binding
 */
export function createDACArticlesPoolClient(env: {
  DAC_BACKEND?: any;
  DAC_ARTICLES_POOL_API_KEY?: string;
}): DACArticlesPoolClient | null {
  const dacBackend = env.DAC_BACKEND;
  const apiKey = env.DAC_ARTICLES_POOL_API_KEY || 'yanggf';

  if (!dacBackend) {
    logger.warn('DAC backend service binding not available');
    return null;
  }

  return new DACArticlesPoolClient(dacBackend, apiKey);
}

/**
 * Integration adapter for existing CCT sentiment pipeline
 */
export class DACArticlesAdapter {
  private client: DACArticlesPoolClient | null;

  constructor(env: {
    DAC_BACKEND?: any;
    DAC_ARTICLES_POOL_API_KEY?: string;
  }) {
    this.client = createDACArticlesPoolClient(env);
  }

  /**
   * Get articles for sentiment analysis
   */
  async getArticlesForSentiment(symbol: string): Promise<{
    articles: NewsArticle[];
    source: 'dac_pool' | 'fallback';
    confidencePenalty: number;
    metadata?: DACArticlePoolMetadata;
  }> {
    if (!this.client) {
      return {
        articles: [],
        source: 'fallback',
        confidencePenalty: -20 // Penalty for no DAC integration
      };
    }

    const poolEntry = await this.client.getArticles(symbol);

    if (poolEntry && poolEntry.articles.length > 0) {
      const cctArticles = this.client.convertToCCTArticles(poolEntry.articles);

      // Calculate confidence penalty based on DAC data quality
      let penalty = 0;
      if (poolEntry.metadata.freshCount < 3) penalty -= 10;
      if (poolEntry.metadata.oldestAgeHours > 48) penalty -= 15;
      if (poolEntry.articles.length < 3) penalty -= 20;

      return {
        articles: cctArticles,
        source: 'dac_pool',
        confidencePenalty: penalty,
        metadata: poolEntry.metadata
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