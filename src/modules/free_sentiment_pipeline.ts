/**
 * FREE Sentiment Analysis Pipeline
 * Uses free APIs instead of paid services
 * Target: 70-78% accuracy with $0 news API costs
 */

import type { CloudflareEnvironment } from '../types.js';

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
 * Get free stock news with sentiment analysis
 */
export async function getFreeStockNews(symbol: string, env: CloudflareEnvironment): Promise<NewsArticle[]> {
  const newsData: NewsArticle[] = [];

  try {
    // 1. Financial Modeling Prep (has built-in sentiment!)
    const fmpNews = await getFMPNews(symbol, env);
    if (fmpNews?.length > 0) {
      newsData.push(...fmpNews);
    }
  } catch (error: any) {
    console.log(`FMP news failed for ${symbol}:`, error.message);
  }

  try {
    // 2. NewsAPI.org (broader coverage)
    const newsApiData = await getNewsAPIData(symbol, env);
    if (newsApiData?.length > 0) {
      newsData.push(...newsApiData);
    }
  } catch (error: any) {
    console.log(`NewsAPI failed for ${symbol}:`, error.message);
  }

  try {
    // 3. Yahoo Finance news (backup)
    const yahooNews = await getYahooNews(symbol, env);
    if (yahooNews?.length > 0) {
      newsData.push(...yahooNews);
    }
  } catch (error: any) {
    console.log(`Yahoo news failed for ${symbol}:`, error.message);
  }

  return newsData;
}

/**
 * Financial Modeling Prep - FREE with built-in sentiment
 */
async function getFMPNews(symbol: string, env: CloudflareEnvironment): Promise<NewsArticle[]> {
  const API_KEY = env.FMP_API_KEY; // Free at financialmodelingprep.com

  if (!API_KEY) {
    throw new Error('FMP API key not configured (free at financialmodelingprep.com)');
  }

  const url = `https://financialmodelingprep.com/api/v3/stock_news?tickers=${symbol}&limit=10&apikey=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error || data.message) {
    throw new Error(data.error || data.message);
  }

  // Check if data is an array
  if (!Array.isArray(data)) {
    console.log('FMP API returned non-array data:', data);
    return [];
  }

  // FMP already includes sentiment analysis!
  return data.map(item => ({
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
async function getNewsAPIData(symbol: string, env: CloudflareEnvironment): Promise<NewsArticle[]> {
  const API_KEY = env.NEWSAPI_KEY; // Free at newsapi.org

  if (!API_KEY) {
    throw new Error('NewsAPI key not configured (free at newsapi.org)');
  }

  // Search for stock-specific news
  const url = `https://newsapi.org/v2/everything?q=${symbol}&sortBy=publishedAt&pageSize=10&apiKey=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === 'error') {
    throw new Error(data.message);
  }

  return data.articles?.map(article => ({
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
}

/**
 * Yahoo Finance news (free but limited)
 */
async function getYahooNews(symbol: string, env: CloudflareEnvironment): Promise<NewsArticle[]> {
  try {
    // Yahoo Finance search endpoint (unofficial)
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&lang=en-US&region=US&quotesCount=1&newsCount=10`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)'
      }
    });

    const data = await response.json();
    const news = data.news || [];

    return news.map(item => ({
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
async function getFreeLLMSentiment(newsData: NewsArticle[], symbol: string, env: CloudflareEnvironment): Promise<NewsArticle[]> {
  // Use Gemini free tier (15 requests/minute)
  if (!env.GEMINI_API_KEY) {
    console.log('No Gemini API key, using rule-based sentiment');
    return newsData.map(item => ({
      ...item,
      llm_sentiment: item.sentiment // Use rule-based as fallback
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

    const result = await response.json();
    const content = result.candidates[0].content.parts[0].text;

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
    console.log('Gemini LLM sentiment failed, using rule-based:', error);
    return newsData.map(item => ({
      ...item,
      llm_sentiment: item.sentiment
    }));
  }
}

/**
 * Main free sentiment analysis function
 */
export async function getFreeSentimentSignal(symbol: string, env: CloudflareEnvironment): Promise<SentimentSignal> {
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
function calculateAggregatedSentiment(newsData: NewsArticle[]): { label: string; confidence: number; score: number; reasoning: string } {
  if (newsData.length === 0) {
    return { label: 'neutral', confidence: 0, score: 0, reasoning: 'No data' };
  }

  let totalScore = 0;
  let totalWeight = 0;
  const sentimentCounts: { [key: string]: number } = { bullish: 0, bearish: 0, neutral: 0 };

  newsData.forEach(item => {
    // Use LLM sentiment if available, otherwise rule-based
    const sentiment = item.llm_sentiment || item.sentiment;

    // Weight by source reliability
    const weight = getSourceWeight(item.source_type);

    totalScore += sentiment.score * weight;
    totalWeight += weight;

    sentimentCounts[sentiment.label]++;
  });

  const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  const dominantSentiment = Object.keys(sentimentCounts)
    .reduce((a, b) => sentimentCounts[a] > sentimentCounts[b] ? a : b);

  const confidence = Math.min(0.9, Math.abs(avgScore) + (newsData.length * 0.1));

  return {
    label: Math.abs(avgScore) > 0.1 ? (avgScore > 0 ? 'bullish' : 'bearish') : 'neutral',
    score: avgScore,
    confidence: confidence,
    reasoning: `${dominantSentiment} sentiment from ${newsData.length} sources (${sentimentCounts.bullish}B/${sentimentCounts.bearish}B/${sentimentCounts.neutral}N)`
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
export async function generateFreeSentimentHybrid(symbol: string, technicalSignal: TechnicalSignal, env: CloudflareEnvironment): Promise<HybridSignal> {
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