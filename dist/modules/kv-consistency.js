/**
 * Enhanced KV Consistency Handler
 * Addresses eventual consistency with read-after-write consistency patterns
 */
import { createLogger } from './logging.js';
const logger = createLogger('kv-consistency');
/**
 * KV Eventual Consistency Configuration
 */
export const CONSISTENCY_CONFIG = {
    // Cloudflare KV eventual consistency window (up to 60 seconds)
    MAX_CONSISTENCY_DELAY: 60000, // 60 seconds
    // Retry strategies for different operation types
    RETRY_STRATEGIES: {
        // Critical operations (job status, dependencies) - more aggressive retry
        CRITICAL: {
            maxRetries: 6,
            baseDelay: 500, // 0.5s base delay
            maxDelay: 10000, // 10s max delay
            timeout: 30000 // 30s total timeout
        },
        // Standard operations (data retrieval) - moderate retry
        STANDARD: {
            maxRetries: 3,
            baseDelay: 1000, // 1s base delay
            maxDelay: 5000, // 5s max delay
            timeout: 15000 // 15s total timeout
        },
        // Background operations (cleanup, monitoring) - conservative retry
        BACKGROUND: {
            maxRetries: 2,
            baseDelay: 2000, // 2s base delay
            maxDelay: 8000, // 8s max delay
            timeout: 10000 // 10s total timeout
        }
    }
};
/**
 * Exponential backoff with jitter for retry delays
 */
function calculateBackoffDelay(attempt, baseDelay, maxDelay) {
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // Add jitter (±20%) to prevent thundering herd
    const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(exponentialDelay + jitter));
}
/**
 * Wait for KV consistency with configurable timeout
 */
export async function waitForConsistency(key, condition, env, options = {}) {
    const { strategy = 'STANDARD', timeout = CONSISTENCY_CONFIG.RETRY_STRATEGIES.STANDARD.timeout, description = 'KV consistency' } = options;
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
        }
        catch (error) {
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
export async function verifyWriteConsistency(key, expectedValue, env, options = {}) {
    return waitForConsistency(key, async (env, key) => {
        const actualValue = await env.MARKET_ANALYSIS_CACHE.get(key);
        return actualValue === expectedValue;
    }, env, {
        strategy: 'CRITICAL',
        description: `Write verification for ${key}`,
        ...options
    });
}
/**
 * Status consistency pattern for job status updates
 */
export async function verifyStatusConsistency(date, jobType, expectedStatus, env) {
    const statusKey = `job_status_${date}`;
    return waitForConsistency(statusKey, async (env, key) => {
        const statusData = await env.MARKET_ANALYSIS_CACHE.get(key);
        if (!statusData)
            return false;
        const status = JSON.parse(statusData);
        return status[jobType] === expectedStatus;
    }, env, {
        strategy: 'CRITICAL',
        description: `Status consistency for ${jobType} on ${date}`
    });
}
/**
 * Dependency consistency pattern for multi-job pipelines
 */
export async function verifyDependencyConsistency(date, dependencies, env) {
    const statusKey = `job_status_${date}`;
    const results = {
        isValid: false,
        consistentJobs: [],
        inconsistentJobs: []
    };
    await waitForConsistency(statusKey, async (env, key) => {
        try {
            const statusData = await env.MARKET_ANALYSIS_CACHE.get(key);
            if (!statusData)
                return false;
            const status = JSON.parse(statusData);
            let allConsistent = true;
            for (const jobType of dependencies) {
                if (status[jobType] === 'done') {
                    results.consistentJobs.push(jobType);
                }
                else {
                    results.inconsistentJobs.push(jobType);
                    allConsistent = false;
                }
            }
            results.isValid = allConsistent;
            return allConsistent;
        }
        catch (error) {
            logger.debug('Dependency consistency check failed', {
                date,
                error: (error instanceof Error ? error.message : String(error))
            });
            return false;
        }
    }, env, {
        strategy: 'CRITICAL',
        description: `Dependency consistency for ${date}`
    });
    return results;
}
/**
 * Atomic-like operation pattern for complex KV operations
 */
export async function executeAtomicLikeOperation(operationId, operation, env, options = {}) {
    const { timeout = CONSISTENCY_CONFIG.MAX_CONSISTENCY_DELAY, rollbackOnFailure = true } = options;
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
        const consistencyAchieved = await waitForConsistency(operationId, async (env, key) => {
            // Operation-specific consistency check
            if (options.consistencyCheck) {
                return await options.consistencyCheck(env, operationId, result);
            }
            // Default consistency check - assume successful if operation completed
            return true;
        }, env, {
            timeout,
            description: `Atomic operation ${operationId}`
        });
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
        }
        else {
            logger.warn('Atomic-like operation completed without consistency', {
                operationId,
                duration: Date.now() - startTime
            });
            if (rollbackOnFailure && options.rollback) {
                try {
                    await options.rollback(env, operationId, result);
                    logger.info('Rollback completed', { operationId });
                }
                catch (rollbackError) {
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
    }
    catch (error) {
        logger.error('Atomic-like operation failed', {
            operationId,
            error: (error instanceof Error ? error.message : String(error)),
            duration: Date.now() - startTime
        });
        if (rollbackOnFailure && options.rollback) {
            try {
                await options.rollback(env, operationId, null);
                logger.info('Rollback completed after error', { operationId });
            }
            catch (rollbackError) {
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
export function getConsistencyConfig(operationType) {
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
export function createExistenceCheck(expectedValue) {
    return async (env, key) => {
        try {
            const value = await env.MARKET_ANALYSIS_CACHE.get(key);
            if (expectedValue !== undefined) {
                return value === expectedValue;
            }
            return value !== null && value !== undefined;
        }
        catch (error) {
            logger.debug('Existence check failed', { key, error: error.message });
            return false;
        }
    };
}
/**
 * Helper function to create a consistency check function for JSON data
 */
export function createJsonCheck(validator) {
    return async (env, key) => {
        try {
            const value = await env.MARKET_ANALYSIS_CACHE.get(key);
            if (!value)
                return false;
            const data = JSON.parse(value);
            return validator(data);
        }
        catch (error) {
            logger.debug('JSON consistency check failed', { key, error: error.message });
            return false;
        }
    };
}
/**
 * Batch consistency verification for multiple keys
 */
export async function verifyBatchConsistency(checks, env) {
    const results = await Promise.allSettled(checks.map(async ({ key, condition, options }) => {
        const consistent = await waitForConsistency(key, condition, env, options);
        return { key, consistent };
    }));
    return results.map(result => {
        if (result.status === 'fulfilled') {
            return result.value;
        }
        else {
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
// Note: Types are already exported via 'export interface' and 'export type' declarations above
//# sourceMappingURL=kv-consistency.js.map