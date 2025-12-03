/**
 * Shared Utilities Module - TypeScript
 * Type-safe common functions to reduce code duplication
 */
import { createLogger } from './logging.js';
import { getTimeout, getRetryCount, getEnvConfig, getErrorMessage } from './config.js';
import { KVKeyFactory, KeyHelpers } from './kv-key-factory.js';
const logger = createLogger('shared-utilities');
/**
 * Request ID Generation
 */
export function generateRequestId() {
    return crypto.randomUUID();
}
/**
 * Date Utilities
 */
export const DateUtils = {
    /**
     * Get current date in YYYY-MM-DD format
     */
    getTodayString() {
        return new Date().toISOString().split('T')[0];
    },
    /**
     * Format date for display
     */
    formatDisplayDate(date) {
        return new Date(date).toLocaleString();
    },
    /**
     * Get timestamp in ISO format
     */
    getTimestamp() {
        return new Date().toISOString();
    },
    /**
     * Check if date is a Friday
     */
    isFriday(date) {
        const d = date instanceof Date ? date : new Date(date);
        return d.getUTCDay() === 5;
    },
    /**
     * Get week key in YYYY-WW format
     */
    getWeekKey(date) {
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getUTCFullYear();
        const weekNumber = this.getWeekNumber(d);
        return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    },
    /**
     * Get ISO week number
     */
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }
};
/**
 * Array Utilities
 */
export const ArrayUtils = {
    /**
     * Chunk array into smaller arrays
     */
    chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    },
    /**
     * Remove duplicates from array
     */
    unique(array) {
        return Array.from(new Set(array));
    },
    /**
     * Group array by key
     */
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = String(item[key]);
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(item);
            return groups;
        }, {});
    },
    /**
     * Sort array by key
     */
    sortBy(array, key, direction = 'asc') {
        return [...array].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            return direction === 'asc' ? comparison : -comparison;
        });
    }
};
/**
 * Number Utilities
 */
export const NumberUtils = {
    /**
     * Format currency
     */
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },
    /**
     * Format percentage
     */
    formatPercentage(value, decimals = 2) {
        return `${(value * 100).toFixed(decimals)}%`;
    },
    /**
     * Clamp number between min and max
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    /**
     * Calculate percentage change
     */
    calculatePercentageChange(oldValue, newValue) {
        if (oldValue === 0)
            return 0;
        return ((newValue - oldValue) / oldValue) * 100;
    }
};
/**
 * String Utilities
 */
export const StringUtils = {
    /**
     * Capitalize first letter
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
    /**
     * Convert to title case
     */
    toTitleCase(str) {
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    },
    /**
     * Truncate string with ellipsis
     */
    truncate(str, maxLength) {
        if (str.length <= maxLength)
            return str;
        return str.slice(0, maxLength - 3) + '...';
    },
    /**
     * Sanitize string for HTML (Note: Only works in browser, returns original in worker)
     */
    sanitizeHTML(str) {
        // In Cloudflare Workers, document is not available
        // Return escaped version instead
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    },
    /**
     * Generate slug from string
     */
    slugify(str) {
        return str
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }
};
/**
 * Validation Utilities
 */
export const ValidationUtils = {
    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    /**
     * Validate URL format
     */
    isValidURL(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    },
    /**
     * Validate symbol format
     */
    isValidSymbol(symbol) {
        return /^[A-Z]{1,5}$/.test(symbol.toUpperCase());
    },
    /**
     * Validate confidence threshold (0-1)
     */
    isValidConfidence(confidence) {
        const num = parseFloat(confidence);
        return !isNaN(num) && num >= 0 && num <= 1;
    },
    /**
     * Validate date string (YYYY-MM-DD)
     */
    isValidDateString(dateStr) {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateStr))
            return false;
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
    }
};
/**
 * Async Utilities
 */
export const AsyncUtils = {
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    /**
     * Retry function with exponential backoff
     */
    async retry(fn, options = {}) {
        const { maxRetries = getRetryCount('default'), initialDelay = 1000, backoffFactor = 2, maxDelay = 30000 } = options;
        let attempt = 0;
        let delay = initialDelay;
        while (attempt <= maxRetries) {
            try {
                return await fn();
            }
            catch (error) {
                attempt++;
                if (attempt > maxRetries) {
                    throw error;
                }
                logger.warn('Retry attempt failed', {
                    attempt,
                    maxRetries,
                    delay,
                    error: error.message
                });
                await this.sleep(delay);
                delay = Math.min(delay * backoffFactor, maxDelay);
            }
        }
        throw new Error('Retry failed'); // Should never reach here
    },
    /**
     * Execute with timeout
     */
    async withTimeout(promise, timeoutMs = getTimeout('api_request')) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
        });
        return Promise.race([promise, timeoutPromise]);
    },
    /**
     * Execute tasks in parallel with concurrency limit
     */
    async parallel(tasks, concurrency = 5) {
        const results = [];
        const executing = new Set();
        for (const task of tasks) {
            if (executing.size >= concurrency) {
                await Promise.race(executing);
            }
            const promise = task().finally(() => executing.delete(promise));
            executing.add(promise);
            results.push(promise);
        }
        return Promise.all(results);
    }
};
/**
 * Error Handling Utilities
 */
export const ErrorUtils = {
    /**
     * Create standardized error response
     */
    createError(type, message, details = {}) {
        return {
            success: false,
            error: {
                type,
                message: message || getErrorMessage(type),
                timestamp: DateUtils.getTimestamp(),
                ...details
            }
        };
    },
    /**
     * Create API error response
     */
    createAPIError(type, message, requestId) {
        return this.createError(type, message, { requestId });
    },
    /**
     * Handle async function with error logging
     */
    async withErrorHandling(fn, context = {}) {
        try {
            return await fn();
        }
        catch (error) {
            logger.error('Async operation failed', {
                error: (error instanceof Error ? error.message : String(error)),
                stack: error.stack,
                context
            });
            throw error;
        }
    },
    /**
     * Wrap function for consistent error handling
     */
    wrap(fn, errorHandler) {
        return async (...args) => {
            try {
                return await fn(...args);
            }
            catch (error) {
                if (errorHandler) {
                    return errorHandler(error, ...args);
                }
                throw error;
            }
        };
    },
    /**
     * Create HTTP error response
     */
    createHTTPErrorResponse(error, status = 500, requestId = null, context = {}) {
        const errorResponse = {
            success: false,
            error: {
                message: error.message,
                type: error.name || 'UnknownError',
                timestamp: DateUtils.getTimestamp(),
                ...(requestId && { request_id: requestId }),
                ...context
            }
        };
        return new Response(JSON.stringify(errorResponse, null, 2), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    },
    /**
     * Create HTTP success response
     */
    createHTTPSuccessResponse(data, status = 200, headers = {}) {
        return new Response(JSON.stringify(data, null, 2), {
            status,
            headers: { 'Content-Type': 'application/json', ...headers }
        });
    },
    /**
     * Log error with context
     */
    logError(error, context = {}, logLevel = 'error') {
        const errorData = {
            message: error.message,
            name: error.name,
            stack: error.stack,
            timestamp: DateUtils.getTimestamp(),
            context
        };
        logger[logLevel]('Error occurred', errorData);
    },
    /**
     * Handle API endpoint errors consistently
     */
    async handleAPIEndpoint(handler, request, env, context = {}) {
        const requestId = generateRequestId();
        try {
            const result = await handler(request, env, { ...context, requestId });
            return this.createHTTPSuccessResponse({
                ...result,
                request_id: requestId,
                timestamp: DateUtils.getTimestamp()
            });
        }
        catch (error) {
            this.logError(error, { requestId, ...context });
            return this.createHTTPErrorResponse(error, 500, requestId, context);
        }
    },
    /**
     * Retry with exponential backoff for specific error types
     */
    async retryWithBackoff(fn, options = {}) {
        const { maxRetries = 3, initialDelay = 1000, backoffFactor = 2, maxDelay = 30000, retryableErrors = ['TIMEOUT', 'NETWORK', 'KV_OPERATION'] } = options;
        let attempt = 0;
        let delay = initialDelay;
        while (attempt <= maxRetries) {
            try {
                return await fn();
            }
            catch (error) {
                attempt++;
                if (attempt > maxRetries || !retryableErrors.some(type => (error instanceof Error ? error.message : String(error)).toUpperCase().includes(type) ||
                    (error.name && error.name.toUpperCase().includes(type)))) {
                    throw error;
                }
                logger.warn(`Retry attempt ${attempt}/${maxRetries}`, {
                    error: error.message,
                    delay,
                    attempt
                });
                await AsyncUtils.sleep(delay);
                delay = Math.min(delay * backoffFactor, maxDelay);
            }
        }
        throw new Error('Retry failed'); // Should never reach here
    },
    /**
     * Create standardized console error message
     */
    consoleError(prefix, error, details = {}) {
        console.error(`${prefix} ${error.message}`, {
            error: error.message,
            stack: error.stack,
            ...details
        });
    }
};
/**
 * Performance Utilities
 */
export const PerformanceUtils = {
    /**
     * Measure execution time
     */
    async measure(fn, label) {
        const startTime = performance.now();
        const result = await fn();
        const endTime = performance.now();
        logger.debug('Performance measurement', {
            label,
            durationMs: endTime - startTime
        });
        return {
            result,
            durationMs: endTime - startTime
        };
    },
    /**
     * Create performance timer
     */
    createTimer(label) {
        const start = performance.now();
        return {
            stop() {
                const duration = performance.now() - start;
                logger.debug('Timer completed', { label, durationMs: duration });
                return duration;
            }
        };
    }
};
/**
 * KV Storage Utilities
 */
export const KVUtils = {
    /**
     * Get KV options with centralized TTL configuration (legacy - use KeyHelpers.getKVOptions for new code)
     */
    getOptions(keyType, customOptions = {}, env) {
        const defaultTtl = (env ? getEnvConfig(env).KV_STORAGE.ANALYSIS_TTL : 86400);
        const ttlMap = {
            'analysis': defaultTtl,
            'granular': (env ? getEnvConfig(env).KV_STORAGE.GRANULAR_TTL : 86400),
            'daily_summary': (env ? getEnvConfig(env).KV_STORAGE.DAILY_SUMMARY_TTL : 86400),
            'status': (env ? getEnvConfig(env).KV_STORAGE.STATUS_TTL : 3600),
            'report_cache': (env ? getEnvConfig(env).KV_STORAGE.REPORT_CACHE_TTL : 86400),
            'metadata': (env ? getEnvConfig(env).KV_STORAGE.METADATA_TTL : 3600)
        };
        const ttl = ttlMap[keyType.toLowerCase()] || defaultTtl;
        return {
            expirationTtl: ttl,
            ...customOptions
        };
    },
    /**
     * Put data with standardized TTL
     */
    async putWithTTL(kvStore, key, data, keyType = 'analysis', customOptions = {}) {
        const options = this.getOptions(keyType, customOptions);
        return await kvStore.put(key, data, options);
    },
    /**
     * Put data using key factory for standardized key management
     */
    async putWithKeyFactory(kvStore, keyTypeEnum, data, params = {}, customOptions = {}) {
        const key = KVKeyFactory.generateKey(keyTypeEnum, params);
        const options = KeyHelpers.getKVOptions(keyTypeEnum, customOptions);
        return await kvStore.put(key, data, options);
    },
    /**
     * Get data using key factory
     */
    async getWithKeyFactory(kvStore, keyTypeEnum, params = {}) {
        const key = KVKeyFactory.generateKey(keyTypeEnum, params);
        return await kvStore.get(key);
    },
    /**
     * Check if KV operation needs retry based on error
     */
    isRetryableError(error) {
        const retryableErrors = [
            'KV_OPERATION_TIMEOUT',
            'KV_REQUEST_TIMEOUT',
            'KV_STORAGE_FAILURE'
        ];
        return retryableErrors.some(errType => error.message.includes(errType));
    }
};
/**
 * Object Utilities
 */
export const ObjectUtils = {
    /**
     * Deep merge objects
     */
    merge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.merge(result[key] || {}, source[key]);
            }
            else {
                result[key] = source[key];
            }
        }
        return result;
    },
    /**
     * Get nested value from object with path
     */
    get(obj, path, defaultValue) {
        const keys = path.split('.');
        let result = obj;
        for (const key of keys) {
            if (result === null || result === undefined) {
                return defaultValue;
            }
            result = result[key];
        }
        return result;
    },
    /**
     * Set nested value in object with path
     */
    set(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        current[keys[keys.length - 1]] = value;
        return obj;
    }
};
export default {
    DateUtils,
    ArrayUtils,
    NumberUtils,
    StringUtils,
    ValidationUtils,
    AsyncUtils,
    ErrorUtils,
    PerformanceUtils,
    KVUtils,
    ObjectUtils,
    generateRequestId,
    getTodayString: DateUtils.getTodayString.bind(DateUtils)
};
//# sourceMappingURL=shared-utilities.js.map