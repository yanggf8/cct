/**
 * KV Utility Functions for Hybrid Data Pipeline
 * Handles eventual consistency, atomic status updates, and dependency validation
 */
import { createLogger } from './logging.js';
import { toAppError } from '../types/errors.js';
const logger = createLogger('kv-utils');
/**
 * Get KV value with retry logic for eventual consistency
 */
export async function getWithRetry(key, env, maxRetries = 3, delay = 1000) {
    logger.debug('KV GET operation started', { key, maxRetries, delay });
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await env.MARKET_ANALYSIS_CACHE.get(key);
            if (result) {
                if (i > 0) {
                    logger.info('KV retry successful', { key, attempt: i + 1 });
                }
                else {
                    logger.info('KV GET successful', { key, bytes: result.length });
                }
                return result;
            }
            else {
                logger.debug('KV GET returned null', { key, attempt: i + 1 });
            }
        }
        catch (error) {
            const appError = toAppError(error, { key, attempt: i + 1, operation: 'get' });
            logger.warn('KV operation failed, retrying', {
                key,
                attempt: i + 1,
                error: appError.message,
                category: appError.category,
                retryable: appError.retryable
            });
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
export async function putWithVerification(key, value, env, options = {}) {
    logger.info('KV PUT operation started', {
        key,
        bytes: value.length,
        options: Object.keys(options),
        hasExpirationTtl: !!options.expirationTtl
    });
    try {
        // First attempt to put the value
        await env.MARKET_ANALYSIS_CACHE.put(key, value, options);
        // Verify the put was successful by reading it back
        const verifyKey = await getWithRetry(key, env, 2, 500);
        if (verifyKey === value) {
            logger.info('KV PUT successful and verified', {
                key,
                bytes: value.length,
                verification: 'passed'
            });
            return true;
        }
        else {
            logger.error('KV PUT verification failed - value mismatch', {
                key,
                originalBytes: value.length,
                retrievedBytes: verifyKey?.length || 0
            });
            return false;
        }
    }
    catch (error) {
        logger.error('KV PUT operation failed', {
            key,
            error: (error instanceof Error ? error.message : String(error)),
            bytes: value.length
        });
        throw error;
    }
}
/**
 * Delete KV value with success verification
 */
export async function deleteWithVerification(key, env) {
    logger.info('KV DELETE operation started', { key });
    try {
        // First verify the key exists
        const exists = await env.MARKET_ANALYSIS_CACHE.get(key);
        if (!exists) {
            logger.warn('KV DELETE - key does not exist', { key });
            return true; // Key doesn't exist, consider it "deleted"
        }
        // Delete the key
        await env.MARKET_ANALYSIS_CACHE.delete(key);
        // Verify deletion by trying to read it
        const verify = await env.MARKET_ANALYSIS_CACHE.get(key);
        if (verify === null) {
            logger.info('KV DELETE successful and verified', { key });
            return true;
        }
        else {
            logger.error('KV DELETE verification failed - key still exists', { key });
            return false;
        }
    }
    catch (error) {
        logger.error('KV DELETE operation failed', { key, error: (error instanceof Error ? error.message : String(error)) });
        throw error;
    }
}
/**
 * Log comprehensive KV operation summary
 */
export function logKVOperation(operation, key, success, details = {}) {
    if (success) {
        logger.info('✅ KV OPERATION SUCCESS', {
            operation,
            key,
            ...details,
            timestamp: new Date().toISOString()
        });
    }
    else {
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
export async function getMultipleWithRetry(keys, env) {
    const results = {};
    for (const key of keys) {
        try {
            results[key] = await getWithRetry(key, env);
        }
        catch (error) {
            logger.warn('Failed to get KV key in batch', { key, error: (error instanceof Error ? error.message : String(error)) });
            results[key] = null;
        }
    }
    return results;
}
/**
 * Update job status with atomic individual key approach
 */
export async function updateJobStatus(jobType, date, status, env, metadata = {}) {
    const statusKey = `status:${jobType}:${date}`;
    const statusData = {
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
        }
        else {
            logKVOperation('UPDATE_STATUS', statusKey, false, {
                jobType,
                date,
                status,
                error: 'Verification failed'
            });
        }
    }
    catch (error) {
        logKVOperation('UPDATE_STATUS', statusKey, false, {
            jobType,
            date,
            status,
            error: (error instanceof Error ? error.message : String(error))
        });
        throw error;
    }
}
/**
 * Get job status for a specific job and date
 */
export async function getJobStatus(jobType, date, env) {
    const statusKey = `status:${jobType}:${date}`;
    try {
        const result = await getWithRetry(statusKey, env);
        return JSON.parse(result);
    }
    catch (error) {
        logger.debug('Job status not found', { jobType, date });
        return null;
    }
}
/**
 * Validate that all required dependencies are completed
 */
export async function validateDependencies(date, requiredJobs, env) {
    const statusPromises = requiredJobs.map(jobType => getJobStatus(jobType, date, env));
    const statuses = await Promise.all(statusPromises);
    const missing = [];
    const completed = [];
    requiredJobs.forEach((jobType, index) => {
        const status = statuses[index];
        if (status && status.status === 'done') {
            completed.push(jobType);
        }
        else {
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
//# sourceMappingURL=kv-utils.js.map