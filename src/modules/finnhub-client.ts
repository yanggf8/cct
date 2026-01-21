/**
 * Finnhub API Client for CCT
 * Primary news source for stock sentiment (60 calls/min free tier)
 * Ported from DAC backend/src/utils/finnhub-api.ts
 */

import type { NewsArticle } from '../types.js';

const FINNHUB_API_URL = 'https://finnhub.io/api/v1';

export interface FinnhubNewsItem {
  category: string;
  datetime: number;  // Unix timestamp
  headline: string;
  id: number;
  image: string;
  related: string;  // Stock symbol
  source: string;
  summary: string;
  url: string;
}

/**
 * Fetch company news from Finnhub API
 * @param symbol Stock symbol (e.g., AAPL)
 * @param apiKey Finnhub API key
 * @param daysBack Number of days to look back (default: 30)
 * @returns Array of news articles
 */
export async function fetchFinnhubCompanyNews(
  symbol: string,
  apiKey: string,
  daysBack: number = 30
): Promise<NewsArticle[]> {
  try {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    const from = fromDate.toISOString().split('T')[0];
    const to = toDate.toISOString().split('T')[0];

    const url = `${FINNHUB_API_URL}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`;

    console.log(`[Finnhub] Fetching company news for ${symbol}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error(`[Finnhub] Rate limit exceeded for ${symbol}`);
        throw new Error('RATE_LIMIT: Finnhub rate limit exceeded');
      }
      console.error(`[Finnhub] Failed to fetch news for ${symbol}: ${response.status}`);
      return [];
    }

    const data: FinnhubNewsItem[] = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.log(`[Finnhub] No news available for ${symbol}`);
      return [];
    }

    // Convert Finnhub format to NewsArticle format
    const articles: NewsArticle[] = data
      .filter(item => item.headline && item.summary)
      .map(item => ({
        title: item.headline,
        content: item.summary,  // Required field - use summary as content
        summary: item.summary,
        source: item.source,
        publishedAt: new Date(item.datetime * 1000).toISOString(),
        url: item.url,
      }));

    console.log(`[Finnhub] Fetched ${articles.length} articles for ${symbol}`);

    return articles;
  } catch (error) {
    console.error(`[Finnhub] Error fetching news for ${symbol}:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}
