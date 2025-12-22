/**
 * Enhanced Sentiment Analysis Pipeline with DAC Integration
 * Prioritizes DAC articles pool, falls back to free APIs
 * Uses Durable Objects cache for all operations
 */

import type { CloudflareEnvironment, NewsArticle } from '../types.js';
import { DACArticlesAdapter } from './dac-articles-pool.js';
import { createCacheInstance } from './dual-cache-do.js';
import { DUAL_CACHE_CONFIGS } from './cache-config.js';
import { createLogger } from './logging.js';

const logger = createLogger('enhanced-sentiment-pipeline');

// Enhanced sentiment configuration
interface EnhancedSentimentConfig {
  sources: {
    dac_pool: { priority: number; weight: number; enabled: boolean };
    fmp: { priority: number; weight: number; enabled: boolean };
    newsapi: { priority: number; weight: number; enabled: boolean };
    yahoo: { priority: number; weight: number; enabled: boolean };
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

// Enhanced news article with source metadata
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

// Sentiment analysis result with source tracking
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

// Configuration
const ENHANCED_SENTIMENT_CONFIG: EnhancedSentimentConfig = {
  sources: {
    dac_pool: { priority: 1, weight: 1.2, enabled: true },     // Highest priority, premium weight
    fmp: { priority: 2, weight: 1.0, enabled: true },          // High priority, good sentiment
    newsapi: { priority: 3, weight: 0.8, enabled: true },       // Medium priority
    yahoo: { priority: 4, weight: 0.6, enabled: true }          // Fallback
  },
  llm: {
    provider: 'cloudflare_ai',
    model: '@cf/meta/llama-3.1-8b-instruct',
    fallback: '@hf/thebloke/llamaguard-7b-awq'
  },
  cache: {
    ttl: 3600,        // 1 hour for sentiment analysis
    staleTtl: 1800    // 30 minutes for background refresh
  }
};

/**
 * Enhanced sentiment analysis with DAC articles pool integration
 */
export class EnhancedSentimentPipeline {
  private dacAdapter: DACArticlesAdapter;
  private cache: ReturnType<typeof createCacheInstance> | null;
  private env: CloudflareEnvironment;

  constructor(env: CloudflareEnvironment) {
    this.env = env;
    this.dacAdapter = new DACArticlesAdapter(env);
    this.cache = createCacheInstance(env);
  }

  /**
   * Main sentiment analysis function with DAC priority
   */
  async analyzeSentiment(symbol: string): Promise<EnhancedSentimentResult> {
    const startTime = Date.now();
    logger.info(`Starting sentiment analysis for ${symbol}`);

    try {
      // Check cache first
      const cacheKey = `sentiment:${symbol}:${new Date().getHours()}`;
      if (this.cache) {
        const cached = await this.cache.get(cacheKey, DUAL_CACHE_CONFIGS.STOCK_SENTIMENT);
        if (cached) {
          const result = JSON.parse(cached) as EnhancedSentimentResult;
          logger.info(`Cache hit for ${symbol}`, {
            age: Date.now() - new Date(result.timestamp).getTime()
          });
          return result;
        }
      }

      // Gather articles from all sources with DAC priority
      const articles = await this.gatherArticlesFromSources(symbol);

      if (articles.length === 0) {
        const result: EnhancedSentimentResult = {
          symbol,
          sentiment: 'neutral',
          confidence: 0,
          score: 0,
          reasoning: 'No news articles available from any source',
          sources_used: [],
          article_count: 0,
          quality_metrics: {
            avg_freshness_hours: 0,
            total_confidence_penalty: 0,
            source_diversity: 0
          },
          timestamp: new Date().toISOString()
        };

        await this.cacheResult(cacheKey, result);
        return result;
      }

      // Perform sentiment analysis
      const analysis = await this.performSentimentAnalysis(articles, symbol);

      // Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(articles);

      const result: EnhancedSentimentResult = {
        symbol,
        sentiment: analysis.sentiment,
        confidence: analysis.confidence,
        score: analysis.score,
        reasoning: this.buildReasoning(analysis, articles, qualityMetrics),
        sources_used: [...new Set(articles.map(a => a.source))],
        article_count: articles.length,
        quality_metrics: qualityMetrics,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      await this.cacheResult(cacheKey, result);

      const duration = Date.now() - startTime;
      logger.info(`Analysis complete for ${symbol}`, {
        duration: `${duration}ms`,
        articleCount: articles.length,
        sources: result.sources_used,
        confidence: result.confidence
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Analysis failed for ${symbol}`, {
        error: error instanceof Error ? error.message : 'Unknown',
        duration: `${duration}ms`
      });

      return {
        symbol,
        sentiment: 'neutral',
        confidence: 0,
        score: 0,
        reasoning: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sources_used: [],
        article_count: 0,
        quality_metrics: {
          avg_freshness_hours: 0,
          total_confidence_penalty: 0,
          source_diversity: 0
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Gather articles from multiple sources with DAC priority
   */
  private async gatherArticlesFromSources(symbol: string): Promise<EnhancedNewsArticle[]> {
    const allArticles: EnhancedNewsArticle[] = [];

    // Source 1: DAC Articles Pool (highest priority)
    if (ENHANCED_SENTIMENT_CONFIG.sources.dac_pool.enabled) {
      try {
        const dacResult = await this.dacAdapter.getArticlesForSentiment(symbol);
        if (dacResult.articles.length > 0) {
          const enhancedArticles: EnhancedNewsArticle[] = dacResult.articles.map(article => ({
            ...article,
            source_priority: ENHANCED_SENTIMENT_CONFIG.sources.dac_pool.priority,
            source_weight: ENHANCED_SENTIMENT_CONFIG.sources.dac_pool.weight,
            dac_confidence_penalty: dacResult.confidencePenalty,
            source_metadata: dacResult.metadata ? {
              freshness_hours: dacResult.metadata.oldestAgeHours,
              duplicates_filtered: dacResult.metadata.duplicatesFiltered,
              api_calls_used: dacResult.metadata.apiCallsUsed
            } : undefined
          }));

          allArticles.push(...enhancedArticles);
          logger.info(`Retrieved ${enhancedArticles.length} articles from DAC pool`, {
            symbol,
            source: 'dac_pool',
            penalty: dacResult.confidencePenalty
          });
        }
      } catch (error) {
        logger.warn(`DAC pool failed for ${symbol}`, {
          error: error instanceof Error ? error.message : 'Unknown'
        });
      }
    }

    // Source 2: Financial Modeling Prep (if needed for more articles)
    if (allArticles.length < 10 && ENHANCED_SENTIMENT_CONFIG.sources.fmp.enabled) {
      try {
        const fmpArticles = await this.getFMPArticles(symbol);
        if (fmpArticles.length > 0) {
          allArticles.push(...fmpArticles);
          logger.info(`Retrieved ${fmpArticles.length} articles from FMP`, { symbol });
        }
      } catch (error) {
        logger.warn(`FMP failed for ${symbol}`, {
          error: error instanceof Error ? error.message : 'Unknown'
        });
      }
    }

    // Source 3: NewsAPI (if still needed)
    if (allArticles.length < 15 && ENHANCED_SENTIMENT_CONFIG.sources.newsapi.enabled) {
      try {
        const newsApiArticles = await this.getNewsAPIArticles(symbol);
        if (newsApiArticles.length > 0) {
          allArticles.push(...newsApiArticles);
          logger.info(`Retrieved ${newsApiArticles.length} articles from NewsAPI`, { symbol });
        }
      } catch (error) {
        logger.warn(`NewsAPI failed for ${symbol}`, {
          error: error instanceof Error ? error.message : 'Unknown'
        });
      }
    }

    // Source 4: Yahoo Finance (final fallback)
    if (allArticles.length < 20 && ENHANCED_SENTIMENT_CONFIG.sources.yahoo.enabled) {
      try {
        const yahooArticles = await this.getYahooArticles(symbol);
        if (yahooArticles.length > 0) {
          allArticles.push(...yahooArticles);
          logger.info(`Retrieved ${yahooArticles.length} articles from Yahoo`, { symbol });
        }
      } catch (error) {
        logger.warn(`Yahoo failed for ${symbol}`, {
          error: error instanceof Error ? error.message : 'Unknown'
        });
      }
    }

    // Sort by priority and limit to top 20
    return allArticles
      .sort((a, b) => a.source_priority - b.source_priority)
      .slice(0, 20);
  }

  /**
   * Get articles from FMP with sentiment
   */
  private async getFMPArticles(symbol: string): Promise<EnhancedNewsArticle[]> {
    const apiKey = this.env.FMP_API_KEY;
    if (!apiKey) return [];

    const cacheKey = `fmp_articles:${symbol}:${new Date().getHours()}`;
    if (this.cache) {
      const cached = await this.cache.get(cacheKey, DUAL_CACHE_CONFIGS.NEWS_ARTICLES);
      if (cached) {
        return JSON.parse(cached) as EnhancedNewsArticle[];
      }
    }

    const url = `https://financialmodelingprep.com/api/v3/stock_news?tickers=${symbol}&limit=10&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data)) return [];

    const articles = data.map(item => ({
      title: item.title,
      content: item.text || item.title,
      summary: item.text?.substring(0, 500) || item.title,
      source: item.site,
      url: item.url,
      published_date: item.publishedDate,
      sentiment: this.analyzeTextSentiment(item.title + ' ' + (item.text || '')),
      id: `fmp_${Date.now()}_${Math.random()}`,
      relevance_score: 0.8,
      symbols: [symbol],
      content_length: item.text?.length || 0,
      source_priority: ENHANCED_SENTIMENT_CONFIG.sources.fmp.priority,
      source_weight: ENHANCED_SENTIMENT_CONFIG.sources.fmp.weight
    } as unknown as EnhancedNewsArticle));

    await this.cache?.set(cacheKey, JSON.stringify(articles), DUAL_CACHE_CONFIGS.NEWS_ARTICLES);
    return articles;
  }

  /**
   * Get articles from NewsAPI
   */
  private async getNewsAPIArticles(symbol: string): Promise<EnhancedNewsArticle[]> {
    const apiKey = this.env.NEWSAPI_KEY;
    if (!apiKey) return [];

    const cacheKey = `newsapi_articles:${symbol}:${new Date().getHours()}`;
    if (this.cache) {
      const cached = await this.cache.get(cacheKey, DUAL_CACHE_CONFIGS.NEWS_ARTICLES);
      if (cached) {
        return JSON.parse(cached) as EnhancedNewsArticle[];
      }
    }

    const url = `https://newsapi.org/v2/everything?q=${symbol}&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if ((data as any).status === 'error') return [];

    const articles = ((data as any).articles || []).map((article: any) => ({
      title: article.title,
      content: article.description || article.title,
      summary: article.description || article.title,
      source: article.source.name,
      url: article.url,
      published_date: article.publishedAt,
      sentiment: this.analyzeTextSentiment(article.title + ' ' + (article.description || '')),
      id: `newsapi_${Date.now()}_${Math.random()}`,
      relevance_score: 0.7,
      symbols: [symbol],
      content_length: article.description?.length || 0,
      source_priority: ENHANCED_SENTIMENT_CONFIG.sources.newsapi.priority,
      source_weight: ENHANCED_SENTIMENT_CONFIG.sources.newsapi.weight
    } as unknown as EnhancedNewsArticle));

    await this.cache?.set(cacheKey, JSON.stringify(articles), DUAL_CACHE_CONFIGS.NEWS_ARTICLES);
    return articles;
  }

  /**
   * Get articles from Yahoo Finance
   */
  private async getYahooArticles(symbol: string): Promise<EnhancedNewsArticle[]> {
    const cacheKey = `yahoo_articles:${symbol}:${new Date().getHours()}`;
    if (this.cache) {
      const cached = await this.cache.get(cacheKey, DUAL_CACHE_CONFIGS.NEWS_ARTICLES);
      if (cached) {
        return JSON.parse(cached) as EnhancedNewsArticle[];
      }
    }

    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&lang=en-US&region=US&quotesCount=1&newsCount=10`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)' }
      });
      const data = await response.json() as any;
      const news = data.news || [];

      const articles = news.map((item: any) => ({
        title: item.title,
        content: item.summary || item.title,
        summary: item.summary || item.title,
        source: item.publisher,
        url: item.link,
        published_date: new Date(item.providerPublishTime * 1000).toISOString(),
        sentiment: this.analyzeTextSentiment(item.title + ' ' + (item.summary || '')),
        id: `yahoo_${Date.now()}_${Math.random()}`,
        relevance_score: 0.6,
        symbols: [symbol],
        content_length: item.summary?.length || 0,
        source_priority: ENHANCED_SENTIMENT_CONFIG.sources.yahoo.priority,
        source_weight: ENHANCED_SENTIMENT_CONFIG.sources.yahoo.weight
      } as unknown as EnhancedNewsArticle));

      await this.cache?.set(cacheKey, JSON.stringify(articles), DUAL_CACHE_CONFIGS.NEWS_ARTICLES);
      return articles;

    } catch (error) {
      return [];
    }
  }

  /**
   * Perform sentiment analysis on articles using Cloudflare AI
   */
  private async performSentimentAnalysis(articles: EnhancedNewsArticle[], symbol: string): Promise<{
    sentiment: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    score: number;
  }> {
    if (articles.length === 0) {
      return { sentiment: 'neutral', confidence: 0, score: 0 };
    }

    try {
      // Prepare news summary for AI analysis
      const newsSummary = articles
        .slice(0, 10) // Limit to top 10 for AI processing
        .map(article => `${article.title}: ${(article as any).summary?.substring(0, 200) || ''}`)
        .join('\n\n');

      // Use Cloudflare AI for sentiment analysis
      const ai = this.env.AI;
      if (ai) {
        const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [{
            role: 'user',
            content: `Analyze financial sentiment for ${symbol} based on recent news:

${newsSummary}

Respond with JSON only:
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": 0.75,
  "score": 0.65,
  "reasoning": "Brief explanation of the sentiment analysis"
}`
          }]
        });

        const result = JSON.parse(response.response as string);
        return {
          sentiment: result.sentiment || 'neutral',
          confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
          score: Math.max(-1, Math.min(1, result.score || 0))
        };
      }
    } catch (error) {
      logger.warn('AI analysis failed, using rule-based fallback', {
        error: error instanceof Error ? error.message : 'Unknown'
      });
    }

    // Fallback to rule-based sentiment analysis
    return this.ruleBasedSentiment(articles);
  }

  /**
   * Rule-based sentiment analysis fallback
   */
  private ruleBasedSentiment(articles: EnhancedNewsArticle[]): {
    sentiment: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    score: number;
  } {
    let totalScore = 0;
    let totalWeight = 0;

    articles.forEach(article => {
      const sentimentScore = this.getSentimentScore((article as any).sentiment || 'neutral');
      const weight = (article as any).source_weight || 1.0;

      totalScore += sentimentScore * weight;
      totalWeight += weight;
    });

    const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const confidence = Math.min(0.9, Math.abs(avgScore) + (articles.length * 0.05));

    return {
      sentiment: Math.abs(avgScore) > 0.15 ? (avgScore > 0 ? 'bullish' : 'bearish') : 'neutral',
      confidence: confidence,
      score: avgScore
    };
  }

  /**
   * Get sentiment score from label
   */
  private getSentimentScore(sentiment: string): number {
    const scores: { [key: string]: number } = {
      'bullish': 0.8,
      'positive': 0.7,
      'buy': 0.6,
      'bearish': -0.8,
      'negative': -0.7,
      'sell': -0.6,
      'neutral': 0
    };
    return scores[sentiment.toLowerCase()] || 0;
  }

  /**
   * Simple sentiment analysis for headlines
   */
  private analyzeTextSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
    const content = text.toLowerCase();

    const bullishWords = ['beat', 'beats', 'strong', 'growth', 'profit', 'surge', 'rally', 'upgrade', 'buy', 'bullish', 'positive', 'gains', 'rises', 'jumps'];
    const bearishWords = ['miss', 'misses', 'weak', 'decline', 'loss', 'crash', 'fall', 'downgrade', 'sell', 'bearish', 'negative', 'drops', 'plunges'];

    const bullishCount = bullishWords.filter(word => content.includes(word)).length;
    const bearishCount = bearishWords.filter(word => content.includes(word)).length;

    if (bullishCount > bearishCount) return 'bullish';
    if (bearishCount > bullishCount) return 'bearish';
    return 'neutral';
  }

  /**
   * Calculate quality metrics
   */
  private calculateQualityMetrics(articles: EnhancedNewsArticle[]): {
    avg_freshness_hours: number;
    total_confidence_penalty: number;
    source_diversity: number;
  } {
    const now = Date.now();
    let totalFreshnessHours = 0;
    let totalPenalty = 0;
    const sources = new Set<string>();

    articles.forEach(article => {
      // Calculate freshness
      const publishedTime = new Date((article as any).published_date || article.publishedAt || Date.now()).getTime();
      const ageHours = (now - publishedTime) / (1000 * 60 * 60);
      totalFreshnessHours += ageHours;

      // Accumulate penalties
      totalPenalty += (article as any).dac_confidence_penalty || 0;

      // Track source diversity
      sources.add(article.source || 'unknown');
    });

    return {
      avg_freshness_hours: articles.length > 0 ? totalFreshnessHours / articles.length : 0,
      total_confidence_penalty: totalPenalty,
      source_diversity: sources.size
    };
  }

  /**
   * Build detailed reasoning
   */
  private buildReasoning(analysis: any, articles: EnhancedNewsArticle[], metrics: any): string {
    const sourceBreakdown = articles.reduce((acc, article) => {
      acc[article.source] = (acc[article.source] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const sourceList = Object.entries(sourceBreakdown)
      .map(([source, count]) => `${count} from ${source}`)
      .join(', ');

    return `${analysis.sentiment} sentiment from ${articles.length} articles (${sourceList}). ` +
           `Average article age: ${metrics.avg_freshness_hours.toFixed(1)} hours. ` +
           `Source diversity: ${metrics.source_diversity} sources. ` +
           (analysis.reasoning || '');
  }

  /**
   * Cache analysis result
   */
  private async cacheResult(cacheKey: string, result: EnhancedSentimentResult): Promise<void> {
    if (this.cache) {
      try {
        await this.cache.set(cacheKey, JSON.stringify(result), DUAL_CACHE_CONFIGS.STOCK_SENTIMENT);
      } catch (error) {
        logger.warn('Failed to cache result', {
          error: error instanceof Error ? error.message : 'Unknown'
        });
      }
    }
  }

  /**
   * Check health of all sources
   */
  async checkHealth(): Promise<{
    dac_pool: boolean;
    cache: boolean;
    fmp_available: boolean;
    newsapi_available: boolean;
  }> {
    const [dacHealthy, fmpAvailable, newsapiAvailable] = await Promise.allSettled([
      this.dacAdapter.isHealthy(),
      this.checkFMPHealth(),
      this.checkNewsAPIHealth()
    ]);

    return {
      dac_pool: dacHealthy.status === 'fulfilled' ? dacHealthy.value : false,
      cache: !!this.cache,
      fmp_available: fmpAvailable.status === 'fulfilled' ? fmpAvailable.value : false,
      newsapi_available: newsapiAvailable.status === 'fulfilled' ? newsapiAvailable.value : false
    };
  }

  private async checkFMPHealth(): Promise<boolean> {
    try {
      const response = await fetch('https://financialmodelingprep.com/api/v3/stock_news?limit=1&apikey= test');
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkNewsAPIHealth(): Promise<boolean> {
    try {
      const response = await fetch('https://newsapi.org/v2/top-headlines?country=us&apiKey=test');
      return response.status !== 401; // 401 means API is available but auth failed
    } catch {
      return false;
    }
  }
}

// Export factory function
export function createEnhancedSentimentPipeline(env: CloudflareEnvironment): EnhancedSentimentPipeline {
  return new EnhancedSentimentPipeline(env);
}

// Export types
export type { EnhancedNewsArticle, EnhancedSentimentResult, EnhancedSentimentConfig };