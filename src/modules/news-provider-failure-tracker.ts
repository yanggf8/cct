/**
 * News Provider Failure Tracking
 * Logs provider failures to D1 for debugging and monitoring
 */

import type { CloudflareEnvironment } from '../types.js';

export interface ProviderFailureLog {
  symbol: string;
  provider: 'DAC' | 'Finnhub' | 'FMP' | 'NewsAPI' | 'Yahoo';
  error_type: 'timeout' | 'rate_limit' | 'no_data' | 'api_error' | 'network_error';
  error_message: string;
  request_context?: Record<string, any>;
  job_type?: 'pre-market' | 'intraday' | 'end-of-day';
  run_id?: string;
}

/**
 * Log a provider failure to D1
 */
export async function logProviderFailure(
  env: CloudflareEnvironment,
  failure: ProviderFailureLog
): Promise<void> {
  if (!env.PREDICT_JOBS_DB) {
    console.warn('[Provider Failure] D1 not available, skipping log');
    return;
  }

  try {
    await env.PREDICT_JOBS_DB
      .prepare(`
        INSERT INTO news_provider_failures 
        (symbol, provider, error_type, error_message, request_context, job_type, run_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        failure.symbol,
        failure.provider,
        failure.error_type,
        failure.error_message,
        failure.request_context ? JSON.stringify(failure.request_context) : null,
        failure.job_type || null,
        failure.run_id || null
      )
      .run();

    console.log(`[Provider Failure] Logged ${failure.provider} failure for ${failure.symbol}`);
  } catch (error) {
    console.error('[Provider Failure] Failed to log to D1:', error);
  }
}

/**
 * Batch log multiple provider failures
 */
export async function logProviderFailures(
  env: CloudflareEnvironment,
  failures: ProviderFailureLog[]
): Promise<void> {
  if (!env.PREDICT_JOBS_DB || failures.length === 0) return;

  try {
    const batch = failures.map(f =>
      env.PREDICT_JOBS_DB!.prepare(`
        INSERT INTO news_provider_failures 
        (symbol, provider, error_type, error_message, request_context, job_type, run_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        f.symbol,
        f.provider,
        f.error_type,
        f.error_message,
        f.request_context ? JSON.stringify(f.request_context) : null,
        f.job_type || null,
        f.run_id || null
      )
    );

    await env.PREDICT_JOBS_DB.batch(batch);
    console.log(`[Provider Failure] Logged ${failures.length} failures to D1`);
  } catch (error) {
    console.error('[Provider Failure] Failed to batch log to D1:', error);
  }
}
