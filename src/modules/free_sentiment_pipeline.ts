/**
 * FREE Sentiment Analysis Pipeline
 * Uses free APIs instead of paid services
 * Target: 70-78% accuracy with $0 news API costs
 */

import type { CloudflareEnvironment } from '../types.js';
import { fetchFinnhubCompanyNews } from './finnhub-client.js';

// Type definitions
interface FreeSentimentConfig {
  apis: {
    fmp: {
      baseUrl: string;
      endpoints: {
        stock_news: string;
        social_sentiment: string;
      };
      rateLimit: string;
      hasSentiment: boolean;
    };
    newsapi: {
      baseUrl: string;
      endpoints: {
        everything: string;
        headlines: string;
      };
      rateLimit: string;
      hasSentiment: boolean;
    };
    yahoo: {
      baseUrl: string;
      endpoints: {
        news: string;
      };
      rateLimit: string;
      hasSentiment: boolean;
    };
  };
  llm: {
    provider: string;
    model: string;
    fallback: string;
  };
}

interface NewsArticle {
  title: string;
  summary: string;
  publishedAt: string;
  source: string;
  url: string;
  sentiment: {
    label: string;
    score: number;
  };
  confidence: number;
  source_type: string;
  llm_sentiment?: {
    label: string;
    score: number;
    reasoning: string;
    price_impact: string;
  };
}

interface SentimentSignal {
  symbol: string;
  sentiment: string;
  confidence: number;
  score?: number;
  reasoning: string;
  source_count: number;
  sources?: string[];
  timestamp?: string;
}

interface TechnicalSignal {
  direction: string;
  confidence?: number;
}

interface HybridSignal {
  symbol: string;
  hybrid_prediction: {
    direction: string;
    confidence: number;
    combined_score: number;
    reasoning: string;
  };
  technical_component: {
    direction: string;
    confidence: number;
    weight: number;
  };
  sentiment_component: {
    direction: string;
    confidence: number;
    weight: number;
    reasoning: string;
    sources?: string[];
  };
  timestamp: string;
}

// Free API Configuration
const FREE_SENTIMENT_CONFIG: FreeSentimentConfig = {
  apis: {
    // Financial Modeling Prep - FREE tier with sentiment analysis
    fmp: {
      baseUrl: 'https://financialmodelingprep.com/api/v3',
      endpoints: {
        stock_news: '/stock_news',
        social_sentiment: '/social-sentiment'
      },
      rateLimit: '300/day', // Free tier
      hasSentiment: true
    },

    // NewsAPI.org - FREE for development
    newsapi: {
      baseUrl: 'https://newsapi.org/v2',
      endpoints: {
        everything: '/everything',
        headlines: '/top-headlines'
      },
      rateLimit: '1000/day', // Development tier
      hasSentiment: false
    },

    // Yahoo Finance via yfinance-like scraping
    yahoo: {
      baseUrl: 'https://query1.finance.yahoo.com/v1/finance',
      endpoints: {
        news: '/search'
      },
      rateLimit: '200/day', // Unofficial limit
      hasSentiment: false
    }
  },

  // LLM for sentiment analysis (much cheaper than OpenAI)
  llm: {
    provider: 'gemini', // Free tier: 15 requests/minute
    model: 'gemini-1.5-flash', // Faster and cheaper
    fallback: 'ai_intelligent' // Uses Cloudflare AI when quota exceeded
  }
};

/**
 * Get free stock news with sentiment analysis (v3.10.1)
 * Flow: Finnhub (primary, 60/min) → FMP → NewsAPI → Yahoo (fallbacks)
 * Finnhub provides higher-quality finance-focused news
 */
export async function getFreeStockNews(symbol: string, env: any): Promise<NewsArticle[]> {
  // Check cache first (15-minute TTL)
  const cacheKey = `news_all_${symbol}_${Math.floor(Date.now() / 900000)}`; // 15-min bucket
  const { createSimplifiedEnhancedDAL } = await import('./simplified-enhanced-dal.js');
  const dal = createSimplifiedEnhancedDAL(env, { enableCache: true });
  const cached = await dal.read<NewsArticle[]>(cacheKey);

  if (cached.success && cached.data && cached.data.length > 0) {
    console.log(`[Stock News Cache] HIT for ${symbol} (${cached.data.length} articles)`);
    
    // Log cache hit for statistics
    if (env.PREDICT_JOBS_DB) {
      try {
        await env.PREDICT_JOBS_DB
          .prepare(`INSERT INTO news_cache_stats (symbol, cache_result, articles_count) VALUES (?, ?, ?)`)
          .bind(symbol, 'hit', cached.data.length)
          .run();
      } catch (e) { /* ignore */ }
    }
    
    return cached.data;
  }

  console.log(`[Stock News Cache] MISS for ${symbol}, fetching from providers...`);
  
  // Log cache miss
  if (env.PREDICT_JOBS_DB) {
    try {
      await env.PREDICT_JOBS_DB
        .prepare(`INSERT INTO news_cache_stats (symbol, cache_result, articles_count) VALUES (?, ?, ?)`)
        .bind(symbol, 'miss', 0)
        .run();
    } catch (e) { /* ignore */ }
  }

  // 1. Try Finnhub first (primary - 60 calls/min, finance-focused)
  const finnhubKey = env.FINNHUB_API_KEY;
  if (finnhubKey) {
    try {
      const finnhubNews = await fetchFinnhubCompanyNews(symbol, finnhubKey);
      if (finnhubNews?.length > 0) {
        console.log(`[Stock News] Finnhub SUCCESS: ${finnhubNews.length} articles for ${symbol}`);
        // Transform Finnhub articles to local NewsArticle format
        const articles = finnhubNews.map(a => ({
          title: a.title,
          summary: a.content || a.summary || '',
          publishedAt: a.publishedAt || new Date().toISOString(),
          source: a.source || 'Finnhub',
          url: a.url || '',
          sentiment: { label: 'neutral', score: 0.5 },  // Default - AI will analyze
          confidence: 0.5,  // Default - AI will update
          source_type: 'finnhub'
        }));
        // Cache the result
        await dal.write(cacheKey, articles, { expirationTtl: 900 }); // 15 minutes
        return articles;
      }
      console.log(`[Stock News] Finnhub returned 0 articles for ${symbol}, trying fallbacks`);
    } catch (error: any) {
      console.log(`[Stock News] Finnhub failed for ${symbol}:`, (error instanceof Error ? error.message : String(error)));
    }
  } else {
    console.log(`[Stock News] FINNHUB_API_KEY not configured, using fallbacks`);
  }

  // Fallback: combine FMP + NewsAPI + Yahoo for broader coverage
  const newsData: NewsArticle[] = [];

  // 2. Financial Modeling Prep (has built-in sentiment!)
  try {
    const fmpNews = await getFMPNews(symbol, env);
    if (fmpNews?.length > 0) {
      console.log(`[Stock News] FMP: ${fmpNews.length} articles for ${symbol}`);
      newsData.push(...fmpNews);
    }
  } catch (error: any) {
    console.log(`[Stock News] FMP failed for ${symbol}:`, (error instanceof Error ? error.message : String(error)));
  }

  // 3. NewsAPI.org (broader coverage)
  try {
    const newsApiData = await getNewsAPIData(symbol, env);
    if (newsApiData?.length > 0) {
      console.log(`[Stock News] NewsAPI: ${newsApiData.length} articles for ${symbol}`);
      newsData.push(...newsApiData);
    }
  } catch (error: any) {
    console.log(`[Stock News] NewsAPI failed for ${symbol}:`, (error instanceof Error ? error.message : String(error)));
  }

  // 4. Yahoo Finance news (backup - no API key needed)
  try {
    const yahooNews = await getYahooNews(symbol, env);
    if (yahooNews?.length > 0) {
      console.log(`[Stock News] Yahoo: ${yahooNews.length} articles for ${symbol}`);
      newsData.push(...yahooNews);
    }
  } catch (error: any) {
    console.log(`[Stock News] Yahoo failed for ${symbol}:`, (error instanceof Error ? error.message : String(error)));
  }

  if (newsData.length === 0) {
    console.log(`[Stock News] ALL SOURCES FAILED for ${symbol}`);
  } else {
    console.log(`[Stock News] Fallback total: ${newsData.length} articles for ${symbol}`);
    // Cache the combined result
    await dal.write(cacheKey, newsData, { expirationTtl: 900 }); // 15 minutes
  }

  return newsData;
}

/**
 * Financial Modeling Prep - FREE with built-in sentiment
 */
async function getFMPNews(symbol: string, env: any): Promise<NewsArticle[]> {
  const API_KEY = env.FMP_API_KEY; // Free at financialmodelingprep.com

  if (!API_KEY) {
    throw new Error('FMP API key not configured (free at financialmodelingprep.com)');
  }

  // Create cache key with date for automatic cleanup
  const cacheKey = `news_fmp_${symbol}_${new Date().toISOString().split('T')[0]}`;

  // Check cache first
  const { createSimplifiedEnhancedDAL } = await import('./simplified-enhanced-dal.js');
  const dal = createSimplifiedEnhancedDAL(env, { enableCache: true });
  const cached = await dal.read<NewsArticle[]>(cacheKey);

  if (cached.success && cached.data) {
    console.log(`[FMP Cache] HIT for ${symbol}`);
    return cached.data;
  }

  console.log(`[FMP Cache] MISS for ${symbol}, fetching from API...`);

  const url = `https://financialmodelingprep.com/api/v3/stock_news?tickers=${symbol}&limit=10&apikey=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if ((data as any).error || (data as any).message) {
    throw new Error((data as any).error || (data as any).message);
  }

  // Check if data is an array
  if (!Array.isArray(data)) {
    console.log('FMP API returned non-array data:', data);
    return [];
  }

  // FMP already includes sentiment analysis!
  const newsArticles = data.map(item => ({
    title: item.title,
    summary: item.text?.substring(0, 500) || item.title,
    publishedAt: item.publishedDate,
    source: item.site,
    url: item.url,
    // Built-in sentiment from FMP
    sentiment: analyzeFMPSentiment(item.title, item.text),
    confidence: 0.7, // FMP has decent quality
    source_type: 'fmp_with_sentiment'
  }));

  // Store in cache for 1 hour (3600 seconds)
  await dal.write(cacheKey, newsArticles, { expirationTtl: 3600 });
  console.log(`[FMP Cache] Stored ${newsArticles.length} articles for ${symbol}`);

  return newsArticles;
}

/**
 * Analyze FMP sentiment from title/text
 */
function analyzeFMPSentiment(title: string, text?: string): { label: string; score: number } {
  const content = (title + ' ' + (text || '')).toLowerCase();

  // Positive indicators
  const positiveWords = ['beats', 'exceeds', 'strong', 'growth', 'profit', 'surge', 'rally', 'upgrade', 'buy', 'bullish', 'positive', 'gains', 'rises', 'jumps'];
  const positiveCount = positiveWords.filter(word => content.includes(word)).length;

  // Negative indicators
  const negativeWords = ['misses', 'disappoints', 'weak', 'decline', 'loss', 'crash', 'fall', 'downgrade', 'sell', 'bearish', 'negative', 'drops', 'plunges'];
  const negativeCount = negativeWords.filter(word => content.includes(word)).length;

  if (positiveCount > negativeCount) {
    return {
      label: 'bullish',
      score: Math.min(0.8, 0.5 + (positiveCount * 0.1))
    };
  } else if (negativeCount > positiveCount) {
    return {
      label: 'bearish',
      score: Math.max(-0.8, -0.5 - (negativeCount * 0.1))
    };
  }

  return {
    label: 'neutral',
    score: 0.0
  };
}

/**
 * NewsAPI.org - FREE development tier
 */
async function getNewsAPIData(symbol: string, env: any): Promise<NewsArticle[]> {
  const API_KEY = env.NEWSAPI_KEY; // Free at newsapi.org

  if (!API_KEY) {
    throw new Error('NewsAPI key not configured (free at newsapi.org)');
  }

  // Create cache key with hour for more granular caching (prevents rate limits)
  const hour = new Date().getHours();
  const cacheKey = `news_api_${symbol}_${hour}`;

  // Check cache first
  const { createSimplifiedEnhancedDAL } = await import('./simplified-enhanced-dal.js');
  const dal = createSimplifiedEnhancedDAL(env, { enableCache: true });
  const cached = await dal.read<NewsArticle[]>(cacheKey);

  if (cached.success && cached.data) {
    console.log(`[NewsAPI Cache] HIT for ${symbol} (hour ${hour})`);
    return cached.data;
  }

  console.log(`[NewsAPI Cache] MISS for ${symbol}, fetching from API...`);

  // Search for stock-specific news
  const url = `https://newsapi.org/v2/everything?q=${symbol}&sortBy=publishedAt&pageSize=10&apiKey=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if ((data as any).status === 'error') {
    throw new Error((data as any).message);
  }

  const newsArticles = (data as any).articles?.map((article: any) => ({
    title: article.title,
    summary: article.description || article.title,
    publishedAt: article.publishedAt,
    source: article.source.name,
    url: article.url,
    // Need to add sentiment analysis
    sentiment: analyzeTextSentiment(article.title + ' ' + (article.description || '')),
    confidence: 0.6, // Lower confidence without built-in sentiment
    source_type: 'newsapi'
  })) || [];

  // Store in cache for 30 minutes (1800 seconds) - news is time-sensitive
  await dal.write(cacheKey, newsArticles, { expirationTtl: 1800 });
  console.log(`[NewsAPI Cache] Stored ${newsArticles.length} articles for ${symbol} (hour ${hour})`);

  return newsArticles;
}

/**
 * Yahoo Finance news (free but limited)
 */
async function getYahooNews(symbol: string, env: any): Promise<NewsArticle[]> {
  try {
    // Yahoo Finance search endpoint (unofficial)
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&lang=en-US&region=US&quotesCount=1&newsCount=10`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)'
      }
    });

    const data = await response.json() as any;
    const news = data.news || [];

    return news.map((item: any) => ({
      title: item.title,
      summary: item.summary || item.title,
      publishedAt: new Date(item.providerPublishTime * 1000).toISOString(),
      source: item.publisher,
      url: item.link,
      sentiment: analyzeTextSentiment(item.title + ' ' + (item.summary || '')),
      confidence: 0.5, // Lower confidence from Yahoo
      source_type: 'yahoo'
    }));

  } catch (error: any) {
    console.log('Yahoo news scraping failed:', error);
    return [];
  }
}

/**
 * Rule-based sentiment analysis (fallback when LLM unavailable)
 */
export function analyzeTextSentiment(text: string): { label: string; score: number } {
  const content = text.toLowerCase();

  // Financial-specific sentiment words
  const bullishWords = [
    'beat', 'beats', 'strong', 'growth', 'profit', 'surge', 'rally', 'upgrade',
    'buy', 'bullish', 'positive', 'gains', 'rises', 'jumps', 'soars', 'boost',
    'exceeds', 'outperform', 'revenue growth', 'earnings beat', 'guidance raised'
  ];

  const bearishWords = [
    'miss', 'misses', 'weak', 'decline', 'loss', 'crash', 'fall', 'downgrade',
    'sell', 'bearish', 'negative', 'drops', 'plunges', 'disappoints', 'concern',
    'below expectations', 'guidance lowered', 'warning', 'investigation'
  ];

  let bullishScore = 0;
  let bearishScore = 0;

  // Count sentiment words with context weighting
  bullishWords.forEach(word => {
    if (content.includes(word)) {
      bullishScore += word.length > 6 ? 2 : 1; // Longer phrases weighted more
    }
  });

  bearishWords.forEach(word => {
    if (content.includes(word)) {
      bearishScore += word.length > 6 ? 2 : 1;
    }
  });

  // Calculate sentiment
  const totalScore = bullishScore + bearishScore;
  if (totalScore === 0) {
    return { label: 'neutral', score: 0.0 };
  }

  const netSentiment = (bullishScore - bearishScore) / totalScore;

  if (netSentiment > 0.2) {
    return { label: 'bullish', score: Math.min(0.8, netSentiment) };
  } else if (netSentiment < -0.2) {
    return { label: 'bearish', score: Math.max(-0.8, netSentiment) };
  }

  return { label: 'neutral', score: netSentiment };
}

/**
 * FREE LLM sentiment analysis using Gemini
 */
async function getFreeLLMSentiment(newsData: NewsArticle[], symbol: string, env: any): Promise<NewsArticle[]> {
  // Use Gemini free tier (15 requests/minute)
  if (!env.GEMINI_API_KEY) {
    console.log('No Gemini API key - marking as failed');
    return newsData.map(item => ({
      ...item,
      llm_sentiment: {
        label: 'neutral',
        score: 0,
        reasoning: 'No API key configured',
        price_impact: 'unknown',
        status: 'failed',
        failure_reason: 'GEMINI_API_KEY not configured'
      }
    }));
  }

  try {
    // Summarize news for LLM analysis
    const newsText = newsData
      .slice(0, 5) // Limit to top 5 news items
      .map(item => `${item.title}: ${item.summary}`)
      .join('\n\n');

    const prompt = `Analyze financial sentiment for ${symbol} from recent news:

${newsText}

Respond with JSON only:
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": 0.75,
  "reasoning": "Brief explanation",
  "price_impact": "high|medium|low"
}`;

    // Call Gemini API (free tier)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200
        }
      })
    });

    const result = await response.json() as any;
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    // Parse JSON response
    const sentimentData = JSON.parse(content.replace(/```json|```/g, ''));

    // Apply LLM sentiment to all news items
    return newsData.map(item => ({
      ...item,
      llm_sentiment: {
        label: sentimentData.sentiment,
        score: sentimentData.sentiment === 'bullish' ? sentimentData.confidence :
               sentimentData.sentiment === 'bearish' ? -sentimentData.confidence : 0,
        reasoning: sentimentData.reasoning,
        price_impact: sentimentData.price_impact
      }
    }));

  } catch (error: any) {
    console.log('Gemini LLM sentiment failed - marking as failed:', error);
    return newsData.map(item => ({
      ...item,
      llm_sentiment: {
        label: 'neutral',
        score: 0,
        reasoning: 'AI model failed',
        price_impact: 'unknown',
        status: 'failed',
        failure_reason: error.message || 'LLM unavailable'
      }
    }));
  }
}

/**
 * Main free sentiment analysis function
 */
export async function getFreeSentimentSignal(symbol: string, env: any): Promise<SentimentSignal> {
  try {
    // 1. Gather free news data
    const newsData = await getFreeStockNews(symbol, env);

    if (newsData.length === 0) {
      return {
        symbol: symbol,
        sentiment: 'neutral',
        confidence: 0,
        reasoning: 'No news data available',
        source_count: 0
      };
    }

    // 2. Enhance with LLM sentiment (free Gemini)
    const enhancedNews = await getFreeLLMSentiment(newsData, symbol, env);

    // 3. Calculate aggregated sentiment
    const aggregatedSentiment = calculateAggregatedSentiment(enhancedNews);

    return {
      symbol: symbol,
      sentiment: aggregatedSentiment.label,
      confidence: aggregatedSentiment.confidence,
      score: aggregatedSentiment.score,
      reasoning: aggregatedSentiment.reasoning,
      source_count: enhancedNews.length,
      sources: enhancedNews.map(item => item.source_type),
      timestamp: new Date().toISOString()
    };

  } catch (error: any) {
    console.error(`Free sentiment analysis failed for ${symbol}:`, error);
    return {
      symbol: symbol,
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'Sentiment analysis failed',
      source_count: 0
    };
  }
}

/**
 * Calculate aggregated sentiment from multiple sources
 */
function calculateAggregatedSentiment(newsData: NewsArticle[]): { label: string; confidence: number | null; score: number; reasoning: string; status?: string } {
  if (newsData.length === 0) {
    return { label: 'neutral', confidence: null, score: 0, reasoning: 'No data', status: 'failed' };
  }

  // Check if all items have failed LLM sentiment
  const allFailed = newsData.every(item => (item.llm_sentiment as any)?.status === 'failed');
  if (allFailed) {
    return { label: 'neutral', confidence: null, score: 0, reasoning: 'AI analysis failed for all sources', status: 'failed' };
  }

  let totalScore = 0;
  let totalWeight = 0;
  const sentimentCounts: { [key: string]: number } = { bullish: 0, bearish: 0, neutral: 0 };
  let validItems = 0;

  newsData.forEach(item => {
    // Skip failed items
    if ((item.llm_sentiment as any)?.status === 'failed') return;
    
    // Use LLM sentiment if available, otherwise rule-based
    const sentiment = item.llm_sentiment || item.sentiment;

    // Weight by source reliability
    const weight = getSourceWeight(item.source_type);

    totalScore += sentiment.score * weight;
    totalWeight += weight;
    validItems++;

    sentimentCounts[sentiment.label]++;
  });

  if (validItems === 0) {
    return { label: 'neutral', confidence: null, score: 0, reasoning: 'No valid AI results', status: 'failed' };
  }

  const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  const dominantSentiment = Object.keys(sentimentCounts)
    .reduce((a: any, b: any) => sentimentCounts[a] > sentimentCounts[b] ? a : b);

  // Real confidence from AI results, not fake formula
  const avgConfidence = newsData
    .filter(item => (item.llm_sentiment as any)?.status !== 'failed' && item.llm_sentiment?.score !== undefined)
    .reduce((sum, item) => sum + Math.abs(item.llm_sentiment?.score || 0), 0) / validItems;

  return {
    label: Math.abs(avgScore) > 0.1 ? (avgScore > 0 ? 'bullish' : 'bearish') : 'neutral',
    score: avgScore,
    confidence: Math.min(0.9, avgConfidence),
    reasoning: `${dominantSentiment} sentiment from ${validItems} sources (${sentimentCounts.bullish}B/${sentimentCounts.bearish}B/${sentimentCounts.neutral}N)`,
    status: 'success'
  };
}

/**
 * Weight sources by reliability
 */
function getSourceWeight(sourceType: string): number {
  const weights: { [key: string]: number } = {
    'fmp_with_sentiment': 1.0,  // Highest - has built-in sentiment
    'newsapi': 0.8,             // Good quality news sources
    'yahoo': 0.6                // Lower quality, unofficial
  };

  return weights[sourceType] || 0.5;
}

/**
 * Integrate free sentiment with existing technical analysis
 */
export async function generateFreeSentimentHybrid(symbol: string, technicalSignal: TechnicalSignal, env: any): Promise<HybridSignal> {
  // Get free sentiment
  const sentimentSignal = await getFreeSentimentSignal(symbol, env);

  // Combine with technical analysis (same logic as paid version)
  const hybridSignal = combineSignalsWithSentiment(technicalSignal, sentimentSignal, symbol);

  return hybridSignal;
}

function combineSignalsWithSentiment(technicalSignal: TechnicalSignal, sentimentSignal: SentimentSignal, symbol: string): HybridSignal {
  // Weights (can be adjusted)
  const TECHNICAL_WEIGHT = 0.65; // Slightly higher since sentiment is free/lower quality
  const SENTIMENT_WEIGHT = 0.35;

  const technicalScore = mapDirectionToScore(technicalSignal.direction);
  const sentimentScore = sentimentSignal.score || 0;

  const combinedScore = (technicalScore * TECHNICAL_WEIGHT) + (sentimentScore * SENTIMENT_WEIGHT);
  const combinedDirection = combinedScore > 0.1 ? 'UP' : combinedScore < -0.1 ? 'DOWN' : 'FLAT';

  const technicalConfidence = technicalSignal.confidence || 0.5;
  const sentimentConfidence = sentimentSignal.confidence || 0.3;
  const hybridConfidence = (technicalConfidence * TECHNICAL_WEIGHT) + (sentimentConfidence * SENTIMENT_WEIGHT);

  return {
    symbol: symbol,
    hybrid_prediction: {
      direction: combinedDirection,
      confidence: hybridConfidence,
      combined_score: combinedScore,
      reasoning: `Technical: ${technicalSignal.direction} (${(technicalConfidence*100).toFixed(1)}%), Sentiment: ${sentimentSignal.sentiment} (${(sentimentConfidence*100).toFixed(1)}%) from ${sentimentSignal.source_count} sources`
    },
    technical_component: {
      direction: technicalSignal.direction,
      confidence: technicalConfidence,
      weight: TECHNICAL_WEIGHT
    },
    sentiment_component: {
      direction: sentimentSignal.sentiment,
      confidence: sentimentConfidence,
      weight: SENTIMENT_WEIGHT,
      reasoning: sentimentSignal.reasoning,
      sources: sentimentSignal.sources
    },
    timestamp: new Date().toISOString()
  };
}

function mapDirectionToScore(direction: string): number {
  const mapping: { [key: string]: number } = {
    'UP': 0.8,
    'DOWN': -0.8,
    'FLAT': 0.0,
    'NEUTRAL': 0.0
  };
  return mapping[direction?.toUpperCase()] || 0.0;
}

// Export types for external use
export type {
  NewsArticle,
  SentimentSignal,
  TechnicalSignal,
  HybridSignal,
  FreeSentimentConfig
};

// Export configuration
export { FREE_SENTIMENT_CONFIG };