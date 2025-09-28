/**
 * KV Utility Functions for Hybrid Data Pipeline
 * Handles eventual consistency, atomic status updates, and dependency validation
 */

import { createLogger } from './logging.js';
import { verifyWriteConsistency, verifyStatusConsistency } from './kv-consistency.js';

const logger = createLogger('kv-utils');

/**
 * Get KV value with retry logic for eventual consistency
 * @param {string} key - KV key to retrieve
 * @param {Object} env - Environment object with KV binding
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @param {number} delay - Initial delay between retries in ms (default: 1000)
 * @returns {Promise<string>} KV value as string
 */
export async function getWithRetry(key, env, maxRetries = 3, delay = 1000) {
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
    } catch (error) {
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
 * @param {string} key - KV key to store
 * @param {string} value - Value to store
 * @param {Object} env - Environment object with KV binding
 * @param {Object} options - KV options (expirationTtl, etc.)
 * @returns {Promise<boolean>} True if successful
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
  } catch (error) {
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
 * @param {string} key - KV key to delete
 * @param {Object} env - Environment object with KV binding
 * @returns {Promise<boolean>} True if successful
 */
export async function deleteWithVerification(key, env) {
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
  } catch (error) {
    logger.error('KV DELETE operation failed', { key, error: error.message });
    throw error;
  }
}

/**
 * Log comprehensive KV operation summary
 * @param {string} operation - Operation type (GET/PUT/DELETE)
 * @param {string} key - KV key
 * @param {boolean} success - Whether operation was successful
 * @param {Object} details - Additional details
 */
export function logKVOperation(operation, key, success, details = {}) {
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
 * @param {string[]} keys - Array of KV keys to retrieve
 * @param {Object} env - Environment object with KV binding
 * @returns {Promise<Object>} Object with key-value pairs
 */
export async function getMultipleWithRetry(keys, env) {
  const results = {};

  for (const key of keys) {
    try {
      results[key] = await getWithRetry(key, env);
    } catch (error) {
      logger.warn('Failed to get KV key in batch', { key, error: error.message });
      results[key] = null;
    }
  }

  return results;
}

/**
 * Update job status with atomic individual key approach
 * @param {string} jobType - Type of job (analysis, morning_predictions, etc.)
 * @param {string} date - Date string in YYYY-MM-DD format
 * @param {string} status - Status value (pending, running, done, failed)
 * @param {Object} env - Environment object with KV binding
 * @param {Object} metadata - Optional metadata to include
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
    } else {
      logKVOperation('UPDATE_STATUS', statusKey, false, {
        jobType,
        date,
        status,
        error: 'Verification failed'
      });
    }
  } catch (error) {
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
 * @param {string} jobType - Type of job
 * @param {string} date - Date string in YYYY-MM-DD format
 * @param {Object} env - Environment object with KV binding
 * @returns {Promise<Object|null>} Status object or null if not found
 */
export async function getJobStatus(jobType, date, env) {
  const statusKey = `status:${jobType}:${date}`;

  try {
    const result = await getWithRetry(statusKey, env);
    return JSON.parse(result);
  } catch (error) {
    logger.debug('Job status not found', { jobType, date });
    return null;
  }
}

/**
 * Validate that all required dependencies are completed
 * @param {string} date - Date string in YYYY-MM-DD format
 * @param {string[]} requiredJobs - Array of job types that must be completed
 * @param {Object} env - Environment object with KV binding
 * @returns {Promise<Object>} Object with validation result and any missing dependencies
 */
export async function validateDependencies(date, requiredJobs, env) {
  const statusPromises = requiredJobs.map(jobType =>
    getJobStatus(jobType, date, env)
  );

  const statuses = await Promise.all(statusPromises);
  const missing = [];
  const completed = [];

  requiredJobs.forEach((jobType, index) => {
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

/**
 * Get comprehensive daily status for all jobs
 * @param {string} date - Date string in YYYY-MM-DD format
 * @param {Object} env - Environment object with KV binding
 * @returns {Promise<Object>} Daily status summary
 */
export async function getDailyStatus(date, env) {
  const jobTypes = [
    'analysis',
    'morning_predictions',
    'intraday_tracking',
    'eod_summary'
  ];

  const statusPromises = jobTypes.map(jobType =>
    getJobStatus(jobType, date, env)
  );

  const statuses = await Promise.all(statusPromises);
  const dailyStatus = {};
  const allDone = [];

  jobTypes.forEach((jobType, index) => {
    const status = statuses[index];
    dailyStatus[jobType] = status || { status: 'missing', timestamp: null };

    if (status && status.status === 'done') {
      allDone.push(jobType);
    }
  });

  const overall = allDone.length === jobTypes.length ? 'completed' :
                   allDone.length > 0 ? 'partial' : 'missing';

  return {
    date,
    overall,
    completionRate: `${allDone.length}/${jobTypes.length}`,
    jobs: dailyStatus,
    completedJobs: allDone,
    missingJobs: jobTypes.filter(job => !allDone.includes(job))
  };
}

/**
 * Check if a date is a Friday (for weekly input creation)
 * @param {Date|string} date - Date object or date string
 * @returns {boolean} True if the date is a Friday
 */
export function isFriday(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getUTCDay() === 5; // 5 = Friday
}

/**
 * Get week key in YYYY-WW format
 * @param {Date|string} date - Date object or date string
 * @returns {string} Week key (e.g., "2025-W40")
 */
export function getWeekKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getUTCFullYear();
  const weekNumber = getWeekNumber(d);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Get ISO week number
 * @param {Date} date - Date object
 * @returns {number} Week number (1-53)
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Get trading week dates (Monday to Friday)
 * @param {Date|string} date - Date object or date string (should be a Friday)
 * @returns {string[]} Array of date strings for the trading week
 */
export function getTradingWeekDates(date) {
  const d = date instanceof Date ? date : new Date(date);

  // Find the Monday of this week
  const monday = new Date(d);
  const day = monday.getUTCDay();
  const diff = monday.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
  monday.setUTCDate(diff);

  const weekDates = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + i);
    weekDates.push(date.toISOString().split('T')[0]);
  }

  return weekDates;
}

/**
 * Create weekly input key with pre-aggregated EOD summary keys
 * @param {string} fridayDate - Friday date string in YYYY-MM-DD format
 * @param {Object} env - Environment object with KV binding
 * @returns {Promise<Object>} Weekly input data
 */
export async function createWeeklyInput(fridayDate, env) {
  const weekKey = getWeekKey(fridayDate);
  const weekDates = getTradingWeekDates(fridayDate);
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

  logger.info('Creating weekly input', { weekKey, fridayDate });

  // Get EOD summary keys for the week
  const eodSummaries = {};
  for (let i = 0; i < weekDates.length; i++) {
    const date = weekDates[i];
    const status = await getJobStatus('eod_summary', date, env);

    if (status && status.status === 'done') {
      eodSummaries[dayNames[i]] = `eod_summary:${date}`;
      logger.debug('EOD summary found for weekly input', { date, dayName: dayNames[i] });
    } else {
      logger.warn('EOD summary missing for weekly input', { date, dayName: dayNames[i] });
    }
  }

  const weeklyInput = {
    week_start_date: weekDates[0],
    week_end_date: weekDates[4],
    eod_summaries,
    status: 'ready',
    created_at: new Date().toISOString(),
    week_number: weekKey,
    total_eod_summaries: Object.keys(eodSummaries).length
  };

  try {
    await env.TRADING_RESULTS.put(`weekly_input:${weekKey}`, JSON.stringify(weeklyInput));
    logger.info('Weekly input created successfully', {
      weekKey,
      eodCount: Object.keys(eodSummaries).length
    });

    return weeklyInput;
  } catch (error) {
    logger.error('Failed to create weekly input', { weekKey, error: error.message });
    throw error;
  }
}

/**
 * Get weekly input data with fallback to on-demand building
 * @param {string} weekKey - Week key in YYYY-WW format
 * @param {Object} env - Environment object with KV binding
 * @returns {Promise<Object>} Weekly input data
 */
export async function getWeeklyInput(weekKey, env) {
  try {
    const result = await getWithRetry(`weekly_input:${weekKey}`, env);
    return JSON.parse(result);
  } catch (error) {
    logger.info('Weekly input not found, building on-demand', { weekKey });
    return await buildWeeklyInputOnDemand(weekKey, env);
  }
}

/**
 * Build weekly input on-demand if pre-aggregated data is missing
 * @param {string} weekKey - Week key in YYYY-WW format
 * @param {Object} env - Environment object with KV binding
 * @returns {Promise<Object>} Weekly input data
 */
async function buildWeeklyInputOnDemand(weekKey, env) {
  const [year, week] = weekKey.split('-W');
  const weekNumber = parseInt(week);

  // Calculate the Friday of the requested week
  const janFirst = new Date(Date.UTC(parseInt(year), 0, 1));
  const daysOffset = (weekNumber - 1) * 7 - (janFirst.getUTCDay() || 7) + 1;
  const friday = new Date(Date.UTC(parseInt(year), 0, janFirst.getUTCDate() + daysOffset + 4));

  return await createWeeklyInput(friday.toISOString().split('T')[0], env);
}