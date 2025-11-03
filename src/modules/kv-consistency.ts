/**
 * Enhanced KV Consistency Handler
 * Addresses eventual consistency with read-after-write consistency patterns
 */

import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

// Type definitions
export type StrategyType = 'CRITICAL' | 'STANDARD' | 'BACKGROUND';

export interface RetryStrategy {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number;  // milliseconds
  timeout: number;   // milliseconds
}

export interface ConsistencyConfig {
  MAX_CONSISTENCY_DELAY: number;
  RETRY_STRATEGIES: {
    CRITICAL: RetryStrategy;
    STANDARD: RetryStrategy;
    BACKGROUND: RetryStrategy;
  };
}

export interface ConsistencyOptions {
  strategy?: StrategyType;
  timeout?: number;
  description?: string;
}

export interface AtomicOperationOptions {
  timeout?: number;
  rollbackOnFailure?: boolean;
  consistencyCheck?: (env: CloudflareEnvironment, operationId: string, result: any) => Promise<boolean>;
  rollback?: (env: CloudflareEnvironment, operationId: string, result: any) => Promise<void>;
}

export interface AtomicOperationResult {
  success: boolean;
  result: any;
  consistencyAchieved: boolean;
  error?: string;
}

export interface DependencyConsistencyResult {
  isValid: boolean;
  consistentJobs: string[];
  inconsistentJobs: string[];
}

export type ConsistencyCondition = (env: CloudflareEnvironment, key: string) => Promise<boolean>;

const logger = createLogger('kv-consistency');

/**
 * KV Eventual Consistency Configuration
 */
export const CONSISTENCY_CONFIG: ConsistencyConfig = {
  // Cloudflare KV eventual consistency window (up to 60 seconds)
  MAX_CONSISTENCY_DELAY: 60000, // 60 seconds

  // Retry strategies for different operation types
  RETRY_STRATEGIES: {
    // Critical operations (job status, dependencies) - more aggressive retry
    CRITICAL: {
      maxRetries: 6,
      baseDelay: 500,    // 0.5s base delay
      maxDelay: 10000,   // 10s max delay
      timeout: 30000      // 30s total timeout
    },

    // Standard operations (data retrieval) - moderate retry
    STANDARD: {
      maxRetries: 3,
      baseDelay: 1000,   // 1s base delay
      maxDelay: 5000,    // 5s max delay
      timeout: 15000     // 15s total timeout
    },

    // Background operations (cleanup, monitoring) - conservative retry
    BACKGROUND: {
      maxRetries: 2,
      baseDelay: 2000,   // 2s base delay
      maxDelay: 8000,    // 8s max delay
      timeout: 10000     // 10s total timeout
    }
  }
};

/**
 * Exponential backoff with jitter for retry delays
 */
function calculateBackoffDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter (±20%) to prevent thundering herd
  const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(exponentialDelay + jitter));
}

/**
 * Wait for KV consistency with configurable timeout
 */
export async function waitForConsistency(
  key: string,
  condition: ConsistencyCondition,
  env: CloudflareEnvironment,
  options: ConsistencyOptions = {}
): Promise<boolean> {
  const {
    strategy = 'STANDARD',
    timeout = CONSISTENCY_CONFIG.RETRY_STRATEGIES.STANDARD.timeout,
    description = 'KV consistency'
  } = options;

  const config = CONSISTENCY_CONFIG.RETRY_STRATEGIES[strategy];
  const startTime = Date.now();
  let attempt = 0;

  logger.info('Starting consistency wait', {
    key,
    strategy,
    timeout,
    description
  });

  while (Date.now() - startTime < timeout) {
    try {
      const result = await condition(env, key);
      if (result) {
        const elapsed = Date.now() - startTime;
        logger.info('Consistency achieved', {
          key,
          attempt,
          elapsed,
          description
        });
        return true;
      }
    } catch (error: any) {
      logger.debug('Consistency check failed', {
        key,
        attempt,
        error: (error instanceof Error ? error.message : String(error))
      });
    }

    attempt++;
    if (attempt >= config.maxRetries) {
      break;
    }

    const delay = calculateBackoffDelay(attempt, config.baseDelay, config.maxDelay);
    logger.debug('Waiting for consistency retry', {
      key,
      attempt,
      delay,
      description
    });

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  const elapsed = Date.now() - startTime;
  logger.warn('Consistency timeout', {
    key,
    attempt,
    elapsed,
    timeout,
    description
  });

  return false;
}

/**
 * Read-after-write consistency pattern for critical operations
 */
export async function verifyWriteConsistency(
  key: string,
  expectedValue: string,
  env: CloudflareEnvironment,
  options: ConsistencyOptions = {}
): Promise<boolean> {
  return waitForConsistency(
    key,
    async (env: CloudflareEnvironment, key: string) => {
      const actualValue = await env.TRADING_RESULTS.get(key);
      return actualValue === expectedValue;
    },
    env,
    {
      strategy: 'CRITICAL',
      description: `Write verification for ${key}`,
      ...options
    }
  );
}

/**
 * Status consistency pattern for job status updates
 */
export async function verifyStatusConsistency(
  date: string,
  jobType: string,
  expectedStatus: string,
  env: CloudflareEnvironment
): Promise<boolean> {
  const statusKey = `job_status_${date}`;

  return waitForConsistency(
    statusKey,
    async (env: CloudflareEnvironment, key: string) => {
      const statusData = await env.TRADING_RESULTS.get(key);
      if (!statusData) return false;

      const status = JSON.parse(statusData);
      return status[jobType] === expectedStatus;
    },
    env,
    {
      strategy: 'CRITICAL',
      description: `Status consistency for ${jobType} on ${date}`
    }
  );
}

/**
 * Dependency consistency pattern for multi-job pipelines
 */
export async function verifyDependencyConsistency(
  date: string,
  dependencies: string[],
  env: CloudflareEnvironment
): Promise<DependencyConsistencyResult> {
  const statusKey = `job_status_${date}`;
  const results: DependencyConsistencyResult = {
    isValid: false,
    consistentJobs: [],
    inconsistentJobs: []
  };

  await waitForConsistency(
    statusKey,
    async (env: CloudflareEnvironment, key: string) => {
      try {
        const statusData = await env.TRADING_RESULTS.get(key);
        if (!statusData) return false;

        const status = JSON.parse(statusData);
        let allConsistent = true;

        for (const jobType of dependencies) {
          if (status[jobType] === 'done') {
            results.consistentJobs.push(jobType);
          } else {
            results.inconsistentJobs.push(jobType);
            allConsistent = false;
          }
        }

        results.isValid = allConsistent;
        return allConsistent;
      } catch (error: any) {
        logger.debug('Dependency consistency check failed', {
          date,
          error: (error instanceof Error ? error.message : String(error))
        });
        return false;
      }
    },
    env,
    {
      strategy: 'CRITICAL',
      description: `Dependency consistency for ${date}`
    }
  );

  return results;
}

/**
 * Atomic-like operation pattern for complex KV operations
 */
export async function executeAtomicLikeOperation(
  operationId: string,
  operation: (env: CloudflareEnvironment) => Promise<any>,
  env: CloudflareEnvironment,
  options: AtomicOperationOptions = {}
): Promise<AtomicOperationResult> {
  const {
    timeout = CONSISTENCY_CONFIG.MAX_CONSISTENCY_DELAY,
    rollbackOnFailure = true
  } = options;

  const startTime = Date.now();
  logger.info('Starting atomic-like operation', {
    operationId,
    timeout,
    rollbackOnFailure
  });

  try {
    // Execute the operation
    const result = await operation(env);

    // Verify consistency with timeout
    const consistencyAchieved = await waitForConsistency(
      operationId,
      async (env: CloudflareEnvironment, key: string) => {
        // Operation-specific consistency check
        if (options.consistencyCheck) {
          return await options.consistencyCheck(env, operationId, result);
        }
        // Default consistency check - assume successful if operation completed
        return true;
      },
      env,
      {
        timeout,
        description: `Atomic operation ${operationId}`
      }
    );

    if (consistencyAchieved) {
      logger.info('Atomic-like operation completed with consistency', {
        operationId,
        duration: Date.now() - startTime
      });

      return {
        success: true,
        result,
        consistencyAchieved: true
      };
    } else {
      logger.warn('Atomic-like operation completed without consistency', {
        operationId,
        duration: Date.now() - startTime
      });

      if (rollbackOnFailure && options.rollback) {
        try {
          await options.rollback(env, operationId, result);
          logger.info('Rollback completed', { operationId });
        } catch (rollbackError: any) {
          logger.error('Rollback failed', {
            operationId,
            error: rollbackError.message
          });
        }
      }

      return {
        success: false,
        result,
        consistencyAchieved: false
      };
    }

  } catch (error: any) {
    logger.error('Atomic-like operation failed', {
      operationId,
      error: (error instanceof Error ? error.message : String(error)),
      duration: Date.now() - startTime
    });

    if (rollbackOnFailure && options.rollback) {
      try {
        await options.rollback(env, operationId, null);
        logger.info('Rollback completed after error', { operationId });
      } catch (rollbackError: any) {
        logger.error('Rollback failed after error', {
          operationId,
          error: rollbackError.message
        });
      }
    }

    return {
      success: false,
      result: null,
      consistencyAchieved: false,
      error: error.message
    };
  }
}

/**
 * Get consistency configuration for different operation types
 */
export function getConsistencyConfig(operationType: string): RetryStrategy {
  switch (operationType) {
    case 'job_status':
    case 'dependency_validation':
      return CONSISTENCY_CONFIG.RETRY_STRATEGIES.CRITICAL;

    case 'data_retrieval':
    case 'analysis_storage':
      return CONSISTENCY_CONFIG.RETRY_STRATEGIES.STANDARD;

    case 'cleanup':
    case 'monitoring':
      return CONSISTENCY_CONFIG.RETRY_STRATEGIES.BACKGROUND;

    default:
      return CONSISTENCY_CONFIG.RETRY_STRATEGIES.STANDARD;
  }
}

/**
 * Helper function to create a consistency check function for KV existence
 */
export function createExistenceCheck(expectedValue?: string): ConsistencyCondition {
  return async (env: CloudflareEnvironment, key: string): Promise<boolean> => {
    try {
      const value = await env.TRADING_RESULTS.get(key);
      if (expectedValue !== undefined) {
        return value === expectedValue;
      }
      return value !== null && value !== undefined;
    } catch (error: unknown) {
      logger.debug('Existence check failed', { key, error: (error as Error).message });
      return false;
    }
  };
}

/**
 * Helper function to create a consistency check function for JSON data
 */
export function createJsonCheck<T = any>(
  validator: (data: T) => boolean
): ConsistencyCondition {
  return async (env: CloudflareEnvironment, key: string): Promise<boolean> => {
    try {
      const value = await env.TRADING_RESULTS.get(key);
      if (!value) return false;

      const data = JSON.parse(value) as T;
      return validator(data);
    } catch (error: unknown) {
      logger.debug('JSON consistency check failed', { key, error: (error as Error).message });
      return false;
    }
  };
}

/**
 * Batch consistency verification for multiple keys
 */
export async function verifyBatchConsistency(
  checks: Array<{ key: string; condition: ConsistencyCondition; options?: ConsistencyOptions }>,
  env: CloudflareEnvironment
): Promise<Array<{ key: string; consistent: boolean; error?: string }>> {
  const results = await Promise.allSettled(
    checks.map(async ({ key, condition, options }) => {
      const consistent = await waitForConsistency(key, condition, env, options);
      return { key, consistent };
    })
  );

  return results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        key: 'unknown',
        consistent: false,
        error: result.reason?.message || 'Unknown error'
      };
    }
  });
}

export default {
  waitForConsistency,
  verifyWriteConsistency,
  verifyStatusConsistency,
  verifyDependencyConsistency,
  executeAtomicLikeOperation,
  getConsistencyConfig,
  createExistenceCheck,
  createJsonCheck,
  verifyBatchConsistency,
  CONSISTENCY_CONFIG
};

// Export types for external use
export type {
  RetryStrategy,
  ConsistencyConfig,
  ConsistencyOptions,
  AtomicOperationOptions,
  AtomicOperationResult,
  DependencyConsistencyResult,
  ConsistencyCondition
};