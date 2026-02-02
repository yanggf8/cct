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
  providerFailures?: Array<{ provider: string; error_type: string; error_message: string }>;
  success: boolean;
}

/**
 * Fetch stock news with comprehensive error tracking
 *
 * Uses free providers: Finnhub → FMP → NewsAPI → Yahoo
 * Tracks errors for D1 storage and troubleshooting.
 *
 * @param symbol Stock symbol
 * @param env Cloudflare environment
 * @returns News fetch result with articles and error summary
 */
export async function getFreeStockNewsWithErrorTracking(
  symbol: string,
  env: CloudflareEnvironment,
  jobContext?: { job_type?: 'pre-market' | 'intraday' | 'end-of-day'; run_id?: string }
): Promise<NewsFetchResult> {
  const providerErrors: ProviderError[] = [];
  const providerFailures: Array<{ provider: string; error_type: string; error_message: string }> = [];
  let articles: any[] = [];

  // Fetch news from free providers (Finnhub → FMP → NewsAPI → Yahoo)
  try {
    articles = await getFreeStockNews(symbol, env);

    if (articles.length > 0) {
      // Some provider succeeded - identify which one
      const source = articles[0]?.source_type || 'unknown';
      const provider = mapSourceToProvider(source);
      console.log(`[Error Tracking] ${provider} SUCCESS for ${symbol} (${articles.length} articles)`);
    }
  } catch (error: unknown) {
    // Catastrophic error in getFreeStockNews itself
    providerErrors.push(extractProviderError('Unknown', error, `getFreeStockNews(${symbol})`));
  }

  // Aggregate all errors
  const summary = aggregateProviderErrors(providerErrors);
  logErrorSummary(summary, symbol);

  return {
    articles,
    errorSummary: summary.totalErrors > 0 ? summary : null,
    providerErrors,
    providerFailures,
    success: articles.length > 0,
  };
}

/**
 * Map source_type to NewsProvider enum
 */
function mapSourceToProvider(source: string): NewsProvider {
  const sourceLower = source.toLowerCase();

  if (sourceLower.includes('finnhub')) {
    return 'Finnhub';
  }
  if (sourceLower.includes('fmp') || sourceLower.includes('financial modeling')) {
    return 'FMP';
  }
  if (sourceLower.includes('newsapi') || sourceLower.includes('news api')) {
    return 'NewsAPI';
  }
  if (sourceLower.includes('yahoo') || sourceLower.includes('finance')) {
    return 'Yahoo';
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
  if (summary.errorsByProvider.Finnhub > 0) penalty -= 3;
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
