/**
 * News Provider Error Aggregation Module
 *
 * Tracks and aggregates errors from all news providers (Finnhub, FMP, NewsAPI, Yahoo).
 * Provides structured error context for troubleshooting and D1 storage.
 *
 * @author News Provider Error Handling - Phase 2
 * @since 2026-01-14
 */

import { createLogger } from './logging.js';

const logger = createLogger('news-provider-error-aggregator');

/**
 * Provider error severity levels
 */
export type ErrorSeverity = 'transient' | 'retryable' | 'permanent' | 'unknown';

/**
 * Provider identifiers
 */
export type NewsProvider = 'Finnhub' | 'FMP' | 'NewsAPI' | 'Yahoo' | 'Unknown';

/**
 * Standardized provider error interface
 */
export interface ProviderError {
  provider: NewsProvider;
  code: string;
  message: string;
  severity: ErrorSeverity;
  retryable: boolean;
  timestamp: number;
  details?: Record<string, any>;
  httpStatus?: number;
  retryCount?: number;
}

/**
 * Aggregated error summary for D1 storage
 */
export interface ErrorSummary {
  totalErrors: number;
  errorsByProvider: Record<NewsProvider, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  retryableErrors: number;
  permanentErrors: number;
  errors: ProviderError[];
  timestamp: number;
}

/**
 * Error codes by provider
 */
export const ErrorCodes = {
  Finnhub: {
    RATE_LIMIT: 'FINNHUB_RATE_LIMIT',
    QUOTA_EXCEEDED: 'FINNHUB_QUOTA_EXCEEDED',
    NOT_FOUND: 'FINNHUB_NOT_FOUND',
    TIMEOUT: 'FINNHUB_TIMEOUT',
    UNKNOWN: 'FINNHUB_UNKNOWN_ERROR',
  },
  FMP: {
    RATE_LIMIT: 'FMP_RATE_LIMIT',
    QUOTA_EXCEEDED: 'FMP_QUOTA_EXCEEDED',
    INVALID_KEY: 'FMP_INVALID_KEY',
    NOT_FOUND: 'FMP_NOT_FOUND',
    TIMEOUT: 'FMP_TIMEOUT',
    UNKNOWN: 'FMP_UNKNOWN_ERROR',
  },
  NewsAPI: {
    RATE_LIMIT: 'NEWSAPI_RATE_LIMIT',
    QUOTA_EXCEEDED: 'NEWSAPI_QUOTA_EXCEEDED',
    INVALID_KEY: 'NEWSAPI_INVALID_KEY',
    NOT_FOUND: 'NEWSAPI_NOT_FOUND',
    TIMEOUT: 'NEWSAPI_TIMEOUT',
    UNKNOWN: 'NEWSAPI_UNKNOWN_ERROR',
  },
  Yahoo: {
    RATE_LIMIT: 'YAHOO_RATE_LIMIT',
    QUOTA_EXCEEDED: 'YAHOO_QUOTA_EXCEEDED',
    NOT_FOUND: 'YAHOO_NOT_FOUND',
    INVALID_SYMBOL: 'YAHOO_INVALID_SYMBOL',
    TIMEOUT: 'YAHOO_TIMEOUT',
    UNKNOWN: 'YAHOO_UNKNOWN_ERROR',
  },
  Unknown: {
    RATE_LIMIT: 'UNKNOWN_RATE_LIMIT',
    QUOTA_EXCEEDED: 'UNKNOWN_QUOTA_EXCEEDED',
    NOT_FOUND: 'UNKNOWN_NOT_FOUND',
    TIMEOUT: 'UNKNOWN_TIMEOUT',
    UNKNOWN: 'UNKNOWN_ERROR',
  },
} as const;

/**
 * Map error details to ProviderError
 */
export function createProviderError(
  provider: NewsProvider,
  code: string,
  message: string,
  details?: Record<string, any>,
  httpStatus?: number,
  retryCount?: number
): ProviderError {
  const severity = determineSeverity(code, httpStatus);
  const retryable = isRetryable(code, httpStatus);

  return {
    provider,
    code,
    message,
    severity,
    retryable,
    timestamp: Date.now(),
    details,
    httpStatus,
    retryCount,
  };
}

/**
 * Determine error severity from code and HTTP status
 */
function determineSeverity(code: string, httpStatus?: number): ErrorSeverity {
  // Transient errors (rate limits, timeouts)
  if (code.includes('RATE_LIMIT') || code.includes('TIMEOUT')) {
    return 'transient';
  }

  // Permanent errors (invalid keys, not found)
  if (code.includes('INVALID_KEY') || code.includes('NOT_FOUND') && !code.includes('QUOTA')) {
    return 'permanent';
  }

  // Retryable based on HTTP status
  if (httpStatus) {
    if (httpStatus === 429) return 'transient'; // Rate limit
    if (httpStatus >= 500) return 'retryable'; // Server errors
    if (httpStatus >= 400 && httpStatus < 500) return 'permanent'; // Client errors
  }

  return 'unknown';
}

/**
 * Check if error is retryable
 */
function isRetryable(code: string, httpStatus?: number): boolean {
  // Transient and retryable severities
  const severity = determineSeverity(code, httpStatus);
  return severity === 'transient' || severity === 'retryable';
}

/**
 * Aggregate multiple provider errors into summary
 */
export function aggregateProviderErrors(errors: ProviderError[]): ErrorSummary {
  const summary: ErrorSummary = {
    totalErrors: errors.length,
    errorsByProvider: {
      Finnhub: 0,
      FMP: 0,
      NewsAPI: 0,
      Yahoo: 0,
      Unknown: 0,
    },
    errorsBySeverity: {
      transient: 0,
      retryable: 0,
      permanent: 0,
      unknown: 0,
    },
    retryableErrors: 0,
    permanentErrors: 0,
    errors,
    timestamp: Date.now(),
  };

  for (const error of errors) {
    // Count by provider
    summary.errorsByProvider[error.provider]++;

    // Count by severity
    summary.errorsBySeverity[error.severity]++;

    // Count retryable vs permanent
    if (error.retryable) {
      summary.retryableErrors++;
    } else if (error.severity === 'permanent') {
      summary.permanentErrors++;
    }
  }

  return summary;
}

/**
 * Convert error summary to JSON for D1 storage
 */
export function serializeErrorSummary(summary: ErrorSummary): string {
  return JSON.stringify(summary);
}

/**
 * Parse error summary from D1 storage
 */
export function deserializeErrorSummary(json: string): ErrorSummary | null {
  try {
    return JSON.parse(json) as ErrorSummary;
  } catch (error) {
    logger.error('Failed to deserialize error summary:', { error });
    return null;
  }
}

/**
 * Format error summary for logging
 */
export function formatErrorSummary(summary: ErrorSummary): string {
  const parts = [
    `Total Errors: ${summary.totalErrors}`,
    `By Provider: Finnhub=${summary.errorsByProvider.Finnhub}, FMP=${summary.errorsByProvider.FMP}, NewsAPI=${summary.errorsByProvider.NewsAPI}, Yahoo=${summary.errorsByProvider.Yahoo}`,
    `By Severity: transient=${summary.errorsBySeverity.transient}, retryable=${summary.errorsBySeverity.retryable}, permanent=${summary.errorsBySeverity.permanent}`,
    `Retryable: ${summary.retryableErrors}, Permanent: ${summary.permanentErrors}`,
  ];

  return parts.join(' | ');
}

/**
 * Log error summary with appropriate level
 */
export function logErrorSummary(summary: ErrorSummary, context?: string): void {
  const formatted = formatErrorSummary(summary);

  if (summary.permanentErrors > 0) {
    logger.error(`[Error Summary]${context ? ` ${context}` : ''} ${formatted}`);
  } else if (summary.totalErrors > 0) {
    logger.warn(`[Error Summary]${context ? ` ${context}` : ''} ${formatted}`);
  } else {
    logger.debug(`[Error Summary]${context ? ` ${context}` : ''} No errors`);
  }
}

/**
 * Extract provider error from caught exception
 */
export function extractProviderError(
  provider: NewsProvider,
  error: unknown,
  context?: string
): ProviderError {
  if (error instanceof Error) {
    // Try to extract error code from message
    const message = error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('429')) {
      return createProviderError(
        provider,
        ErrorCodes[provider]?.RATE_LIMIT || 'RATE_LIMIT',
        error.message,
        { context },
        429
      );
    }

    if (message.includes('quota') || message.includes('exceeded')) {
      return createProviderError(
        provider,
        ErrorCodes[provider]?.QUOTA_EXCEEDED || 'QUOTA_EXCEEDED',
        error.message,
        { context },
        429
      );
    }

    if (message.includes('not found') || message.includes('404')) {
      return createProviderError(
        provider,
        ErrorCodes[provider]?.NOT_FOUND || 'NOT_FOUND',
        error.message,
        { context },
        404
      );
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return createProviderError(
        provider,
        ErrorCodes[provider]?.TIMEOUT || 'TIMEOUT',
        error.message,
        { context }
      );
    }

    // Generic error
    return createProviderError(
      provider,
      ErrorCodes[provider]?.UNKNOWN || 'UNKNOWN',
      error.message,
      { context }
    );
  }

  // Unknown error type
  return createProviderError(
    provider,
    ErrorCodes.Unknown.UNKNOWN,
    String(error),
    { context }
  );
}

/**
 * Check if all providers failed
 */
export function allProvidersFailed(summary: ErrorSummary): boolean {
  return (
    summary.errorsByProvider.Finnhub > 0 &&
    summary.errorsByProvider.FMP > 0 &&
    summary.errorsByProvider.NewsAPI > 0 &&
    summary.errorsByProvider.Yahoo > 0
  );
}

/**
 * Check if any provider succeeded (no errors from that provider)
 */
export function anyProviderSucceeded(summary: ErrorSummary): boolean {
  const totalProviders = 4; // Finnhub, FMP, NewsAPI, Yahoo
  const failedProviders = Object.entries(summary.errorsByProvider).filter(([_, count]) => count > 0).length;

  return failedProviders < totalProviders;
}

export default {
  createProviderError,
  aggregateProviderErrors,
  serializeErrorSummary,
  deserializeErrorSummary,
  formatErrorSummary,
  logErrorSummary,
  extractProviderError,
  allProvidersFailed,
  anyProviderSucceeded,
};
