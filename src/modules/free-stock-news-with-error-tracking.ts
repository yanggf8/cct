/**
 * Free Stock News with Error Tracking
 *
 * Wrapper around getFreeStockNews that aggregates provider errors
 * for D1 storage and troubleshooting.
 *
 * @author News Provider Error Handling - Phase 2
 * @since 2026-01-14
 */

import type { CloudflareEnvironment } from '../types.js';
import { getFreeStockNews } from './free_sentiment_pipeline.js';
import {
  createProviderError,
  aggregateProviderErrors,
  serializeErrorSummary,
  logErrorSummary,
  extractProviderError,
  type ProviderError,
  type ErrorSummary,
  type NewsProvider,
} from './news-provider-error-aggregator.js';

/**
 * Result from news fetch with error tracking
 */
export interface NewsFetchResult {
  articles: any[];
  errorSummary: ErrorSummary | null;
  providerErrors: ProviderError[];
  success: boolean;
}

/**
 * Fetch stock news with comprehensive error tracking
 *
 * Tracks errors from all 4 providers (DAC, FMP, NewsAPI, Yahoo)
 * and aggregates them for D1 storage and troubleshooting.
 *
 * @param symbol Stock symbol
 * @param env Cloudflare environment
 * @returns News fetch result with articles and error summary
 */
export async function getFreeStockNewsWithErrorTracking(
  symbol: string,
  env: CloudflareEnvironment
): Promise<NewsFetchResult> {
  const providerErrors: ProviderError[] = [];
  let articles: any[] = [];

  // Track DAC errors (only actual failures, not "not configured" or "miss")
  if (env.DAC_BACKEND) {
    try {
      const { DACArticlesAdapterV2 } = await import('./dac-articles-pool-v2.js');
      const dacAdapter = new DACArticlesAdapterV2({
        DAC_BACKEND: env.DAC_BACKEND as any,
        X_API_KEY: env.X_API_KEY
      });
      const dacResult = await dacAdapter.getArticlesForSentiment(symbol);

      if (dacResult.source === 'dac_pool') {
        if (dacResult.articles.length > 0) {
          articles = dacResult.articles;
          console.log(`[Error Tracking] DAC Pool SUCCESS for ${symbol} (${dacResult.articles.length} articles)`);
        }
        // DAC_NOT_FOUND is expected behavior (no articles), not an error - don't track
      }
      // DAC_FALLBACK is expected behavior (pool miss), not an error - don't track
    } catch (error: unknown) {
      // Only track actual DAC failures (exceptions)
      providerErrors.push(extractProviderError('DAC', error, `getArticlesForSentiment(${symbol})`));
    }
  }
  // DAC_UNAVAILABLE is expected (not configured), not an error - don't track

  // If DAC succeeded, return early (highest priority)
  if (articles.length > 0) {
    const summary = aggregateProviderErrors(providerErrors);
    logErrorSummary(summary, `DAC SUCCESS for ${symbol}`);

    return {
      articles,
      errorSummary: summary.totalErrors > 0 ? summary : null,
      providerErrors,
      success: true,
    };
  }

  // Track fallback provider errors (FMP, NewsAPI, Yahoo)
  // These are called inside getFreeStockNews, so we wrap it with try-catch
  try {
    articles = await getFreeStockNews(symbol, env);

    if (articles.length > 0) {
      // Some provider succeeded - identify which one
      const source = articles[0]?.source_type || 'unknown';
      const provider = mapSourceToProvider(source);
      console.log(`[Error Tracking] ${provider} SUCCESS for ${symbol} (${articles.length} articles)`);
      // Don't track "NOT_USED" for other providers - that's expected behavior
    }
    // No articles = all providers failed, but getFreeStockNews logs errors already
    // Don't double-track errors here to avoid false positives
  } catch (error: unknown) {
    // Catastrophic error in getFreeStockNews itself - this IS an error
    providerErrors.push(extractProviderError('Unknown', error, `getFreeStockNews(${symbol})`));
  }

  // Aggregate all errors
  const summary = aggregateProviderErrors(providerErrors);
  logErrorSummary(summary, symbol);

  return {
    articles,
    errorSummary: summary.totalErrors > 0 ? summary : null,
    providerErrors,
    success: articles.length > 0,
  };
}

/**
 * Map source_type to NewsProvider enum
 */
function mapSourceToProvider(source: string): NewsProvider {
  const sourceLower = source.toLowerCase();

  if (sourceLower.includes('fmp') || sourceLower.includes('financial modeling')) {
    return 'FMP';
  }
  if (sourceLower.includes('newsapi') || sourceLower.includes('news api')) {
    return 'NewsAPI';
  }
  if (sourceLower.includes('yahoo') || sourceLower.includes('finance')) {
    return 'Yahoo';
  }
  if (sourceLower.includes('dac')) {
    return 'DAC';
  }

  return 'Unknown';
}

/**
 * Format error summary for D1 storage
 */
export function formatErrorSummaryForD1(summary: ErrorSummary | null): string | null {
  if (!summary || summary.totalErrors === 0) {
    return null;
  }
  return serializeErrorSummary(summary);
}

/**
 * Check if news fetch should proceed based on error summary
 */
export function shouldProceedWithAnalysis(result: NewsFetchResult): boolean {
  if (!result.success) {
    return false;
  }

  // Allow analysis if any provider succeeded
  // Even with errors, partial data is better than nothing
  return result.articles.length > 0;
}

/**
 * Get confidence penalty based on error summary
 */
export function calculateErrorPenalty(result: NewsFetchResult): number {
  if (!result.errorSummary) {
    return 0;
  }

  const summary = result.errorSummary;
  let penalty = 0;

  // Penalty for provider failures
  if (summary.errorsByProvider.DAC > 0) penalty -= 5;
  if (summary.errorsByProvider.FMP > 0) penalty -= 3;
  if (summary.errorsByProvider.NewsAPI > 0) penalty -= 3;
  if (summary.errorsByProvider.Yahoo > 0) penalty -= 2;

  // Penalty for permanent errors
  penalty -= summary.permanentErrors * 10;

  // Penalty for high error rate
  if (summary.totalErrors > 5) penalty -= 5;

  return Math.max(-50, penalty); // Cap at -50
}

export default {
  getFreeStockNewsWithErrorTracking,
  formatErrorSummaryForD1,
  shouldProceedWithAnalysis,
  calculateErrorPenalty,
};
