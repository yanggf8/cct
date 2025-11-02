/**
 * KV Utility Functions for Hybrid Data Pipeline
 * Handles eventual consistency, atomic status updates, and dependency validation
 */

import { createLogger } from './logging.js';
import { verifyWriteConsistency, verifyStatusConsistency } from './kv-consistency.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('kv-utils');

// Type definitions
interface KVOperationOptions {
  expirationTtl?: number;
  [key: string]: any;
}

interface JobStatusData {
  status: string;
  timestamp: string;
  [key: string]: any;
}

interface DependencyValidationResult {
  isValid: boolean;
  completed: string[];
  missing: string[];
  completionRate: number;
  date: string;
  requiredJobs: string[];
}

/**
 * Get KV value with retry logic for eventual consistency
 */
export async function getWithRetry(
  key: string,
  env: CloudflareEnvironment,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<string> {
  logger.debug('KV GET operation started', { key, maxRetries, delay });

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await env.TRADING_RESULTS.get(key);
      if (result) {
        if (i > 0) {
          logger.info('KV retry successful', { key, attempt: i + 1 });
        } else {
          logger.info('KV GET successful', { key, bytes: result.length });
        }
        return result;
      } else {
        logger.debug('KV GET returned null', { key, attempt: i + 1 });
      }
    } catch (error: any) {
      logger.warn('KV operation failed, retrying', { key, attempt: i + 1, error: error.message });
    }

    if (i < maxRetries - 1) {
      const retryDelay = delay * Math.pow(2, i); // Exponential backoff
      logger.debug('Waiting before retry', { key, delay: retryDelay });
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  logger.error('KV GET failed after all retries', { key, maxRetries });
  throw new Error(`KV key ${key} not found after ${maxRetries} retries`);
}

/**
 * Put KV value with success verification
 */
export async function putWithVerification(
  key: string,
  value: string,
  env: CloudflareEnvironment,
  options: KVOperationOptions = {}
): Promise<boolean> {
  logger.info('KV PUT operation started', {
    key,
    bytes: value.length,
    options: Object.keys(options),
    hasExpirationTtl: !!options.expirationTtl
  });

  try {
    // First attempt to put the value
    await env.TRADING_RESULTS.put(key, value, options);

    // Verify the put was successful by reading it back
    const verifyKey = await getWithRetry(key, env, 2, 500);

    if (verifyKey === value) {
      logger.info('KV PUT successful and verified', {
        key,
        bytes: value.length,
        verification: 'passed'
      });
      return true;
    } else {
      logger.error('KV PUT verification failed - value mismatch', {
        key,
        originalBytes: value.length,
        retrievedBytes: verifyKey?.length || 0
      });
      return false;
    }
  } catch (error: any) {
    logger.error('KV PUT operation failed', {
      key,
      error: error.message,
      bytes: value.length
    });
    throw error;
  }
}

/**
 * Delete KV value with success verification
 */
export async function deleteWithVerification(
  key: string,
  env: CloudflareEnvironment
): Promise<boolean> {
  logger.info('KV DELETE operation started', { key });

  try {
    // First verify the key exists
    const exists = await env.TRADING_RESULTS.get(key);

    if (!exists) {
      logger.warn('KV DELETE - key does not exist', { key });
      return true; // Key doesn't exist, consider it "deleted"
    }

    // Delete the key
    await env.TRADING_RESULTS.delete(key);

    // Verify deletion by trying to read it
    const verify = await env.TRADING_RESULTS.get(key);

    if (verify === null) {
      logger.info('KV DELETE successful and verified', { key });
      return true;
    } else {
      logger.error('KV DELETE verification failed - key still exists', { key });
      return false;
    }
  } catch (error: any) {
    logger.error('KV DELETE operation failed', { key, error: error.message });
    throw error;
  }
}

/**
 * Log comprehensive KV operation summary
 */
export function logKVOperation(
  operation: string,
  key: string,
  success: boolean,
  details: Record<string, any> = {}
): void {
  if (success) {
    logger.info('✅ KV OPERATION SUCCESS', {
      operation,
      key,
      ...details,
      timestamp: new Date().toISOString()
    });
  } else {
    logger.error('❌ KV OPERATION FAILED', {
      operation,
      key,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get multiple KV values with batch retry logic
 */
export async function getMultipleWithRetry(
  keys: string[],
  env: CloudflareEnvironment
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};

  for (const key of keys) {
    try {
      results[key] = await getWithRetry(key, env);
    } catch (error: any) {
      logger.warn('Failed to get KV key in batch', { key, error: error.message });
      results[key] = null;
    }
  }

  return results;
}

/**
 * Update job status with atomic individual key approach
 */
export async function updateJobStatus(
  jobType: string,
  date: string,
  status: string,
  env: CloudflareEnvironment,
  metadata: Record<string, any> = {}
): Promise<void> {
  const statusKey = `status:${jobType}:${date}`;
  const statusData: JobStatusData = {
    status,
    timestamp: new Date().toISOString(),
    ...metadata
  };

  logger.info('Updating job status', {
    jobType,
    date,
    status,
    key: statusKey,
    metadataKeys: Object.keys(metadata)
  });

  try {
    const success = await putWithVerification(statusKey, JSON.stringify(statusData), env, {
      expirationTtl: 7 * 24 * 60 * 60 // 7 days TTL
    });

    if (success) {
      logKVOperation('UPDATE_STATUS', statusKey, true, {
        jobType,
        date,
        status,
        metadataSize: Object.keys(metadata).length
      });
    } else {
      logKVOperation('UPDATE_STATUS', statusKey, false, {
        jobType,
        date,
        status,
        error: 'Verification failed'
      });
    }
  } catch (error: any) {
    logKVOperation('UPDATE_STATUS', statusKey, false, {
      jobType,
      date,
      status,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get job status for a specific job and date
 */
export async function getJobStatus(
  jobType: string,
  date: string,
  env: CloudflareEnvironment
): Promise<JobStatusData | null> {
  const statusKey = `status:${jobType}:${date}`;

  try {
    const result = await getWithRetry(statusKey, env);
    return JSON.parse(result);
  } catch (error: any) {
    logger.debug('Job status not found', { jobType, date });
    return null;
  }
}

/**
 * Validate that all required dependencies are completed
 */
export async function validateDependencies(
  date: string,
  requiredJobs: string[],
  env: CloudflareEnvironment
): Promise<DependencyValidationResult> {
  const statusPromises = requiredJobs.map(jobType =>
    getJobStatus(jobType, date, env)
  );

  const statuses = await Promise.all(statusPromises);
  const missing: string[] = [];
  const completed: string[] = [];

  requiredJobs.forEach((jobType: any, index: any) => {
    const status = statuses[index];
    if (status && status.status === 'done') {
      completed.push(jobType);
    } else {
      missing.push(jobType);
    }
  });

  const isValid = missing.length === 0;

  logger.info('Dependency validation completed', {
    date,
    isValid,
    requiredJobs,
    completed,
    missing,
    completionRate: `${completed.length}/${requiredJobs.length}`
  });

  return {
    isValid,
    completed,
    missing,
    completionRate: completed.length / requiredJobs.length,
    date,
    requiredJobs
  };
}

// Export types for external use
export type {
  KVOperationOptions,
  JobStatusData,
  DependencyValidationResult
};