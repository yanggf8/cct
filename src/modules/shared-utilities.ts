/**
 * Shared Utilities Module - TypeScript
 * Type-safe common functions to reduce code duplication
 */

import { createLogger } from './logging.js';
import { getTimeout, getRetryCount, getEnvConfig, getErrorMessage } from './config.js';
import { KVKeyFactory, KeyTypes, KeyHelpers, type KeyType } from './kv-key-factory.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('shared-utilities');

// Type Definitions
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  backoffFactor?: number;
  maxDelay?: number;
  retryableErrors?: string[];
}

export interface PerformanceMeasurement<T> {
  result: T;
  durationMs: number;
}

export interface PerformanceTimer {
  stop(): number;
}

export interface ErrorResponse {
  success: false;
  error: {
    type: string;
    message: string;
    timestamp: string;
    request_id?: string;
    [key: string]: any;
  };
}

export interface KVOptions {
  expirationTtl?: number;
  expiration?: number;
  metadata?: Record<string, any>;
}

/**
 * Request ID Generation
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Date Utilities
 */
export const DateUtils = {
  /**
   * Get current date in YYYY-MM-DD format
   */
  getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Format date for display
   */
  formatDisplayDate(date: string | Date): string {
    return new Date(date).toLocaleString();
  },

  /**
   * Get timestamp in ISO format
   */
  getTimestamp(): string {
    return new Date().toISOString();
  },

  /**
   * Check if date is a Friday
   */
  isFriday(date: string | Date): boolean {
    const d = date instanceof Date ? date : new Date(date);
    return d.getUTCDay() === 5;
  },

  /**
   * Get week key in YYYY-WW format
   */
  getWeekKey(date: string | Date): string {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getUTCFullYear();
    const weekNumber = this.getWeekNumber(d);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  },

  /**
   * Get ISO week number
   */
  getWeekNumber(date: Date): number {
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
  chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  /**
   * Remove duplicates from array
   */
  unique<T>(array: T[]): T[] {
    return Array.from(new Set(array));
  },

  /**
   * Group array by key
   */
  groupBy<T extends Record<string, any>>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups: any, item: any) => {
      const group = String(item[key]);
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  },

  /**
   * Sort array by key
   */
  sortBy<T extends Record<string, any>>(
    array: T[],
    key: keyof T,
    direction: 'asc' | 'desc' = 'asc'
  ): T[] {
    return [...array].sort((a: any, b: any) => {
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
  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  /**
   * Format percentage
   */
  formatPercentage(value: number, decimals: number = 2): string {
    return `${(value * 100).toFixed(decimals)}%`;
  },

  /**
   * Clamp number between min and max
   */
  clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  },

  /**
   * Calculate percentage change
   */
  calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return 0;
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
  capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * Convert to title case
   */
  toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt: any) =>
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  },

  /**
   * Truncate string with ellipsis
   */
  truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  },

  /**
   * Sanitize string for HTML (Note: Only works in browser, returns original in worker)
   */
  sanitizeHTML(str: string): string {
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
  slugify(str: string): string {
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
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate URL format
   */
  isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate symbol format
   */
  isValidSymbol(symbol: string): boolean {
    return /^[A-Z]{1,5}$/.test(symbol.toUpperCase());
  },

  /**
   * Validate confidence threshold (0-1)
   */
  isValidConfidence(confidence: number | string): boolean {
    const num = parseFloat(confidence as string);
    return !isNaN(num) && num >= 0 && num <= 1;
  },

  /**
   * Validate date string (YYYY-MM-DD)
   */
  isValidDateString(dateStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;

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
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Retry function with exponential backoff
   */
  async retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const {
      maxRetries = getRetryCount('default'),
      initialDelay = 1000,
      backoffFactor = 2,
      maxDelay = 30000
    } = options;

    let attempt = 0;
    let delay = initialDelay;

    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (error: any) {
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
  async withTimeout<T>(promise: Promise<T>, timeoutMs: number = getTimeout('api_request')): Promise<T> {
    const timeoutPromise = new Promise<T>((_: any, reject: any) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  },

  /**
   * Execute tasks in parallel with concurrency limit
   */
  async parallel<T>(tasks: (() => Promise<T>)[], concurrency: number = 5): Promise<T[]> {
    const results: Promise<T>[] = [];
    const executing = new Set<Promise<T>>();

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
  createError(type: string, message?: string, details: Record<string, any> = {}): ErrorResponse {
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
  createAPIError(type: string, message: string, requestId: string): ErrorResponse {
    return this.createError(type, message, { requestId });
  },

  /**
   * Handle async function with error logging
   */
  async withErrorHandling<T>(fn: () => Promise<T>, context: Record<string, any> = {}): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      logger.error('Async operation failed', {
        error: error.message,
        stack: error.stack,
        context
      });
      throw error;
    }
  },

  /**
   * Wrap function for consistent error handling
   */
  wrap<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    errorHandler?: (error: Error, ...args: T) => R | Promise<R>
  ): (...args: T) => Promise<R> {
    return async (...args: T) => {
      try {
        return await fn(...args);
      } catch (error: any) {
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
  createHTTPErrorResponse(
    error: Error,
    status: number = 500,
    requestId: string | null = null,
    context: Record<string, any> = {}
  ): Response {
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
  createHTTPSuccessResponse(
    data: any,
    status: number = 200,
    headers: Record<string, string> = {}
  ): Response {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers }
    });
  },

  /**
   * Log error with context
   */
  logError(error: Error, context: Record<string, any> = {}, logLevel: 'error' | 'warn' | 'info' = 'error'): void {
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
  async handleAPIEndpoint(
    handler: (request: Request, env: CloudflareEnvironment, context: any) => Promise<any>,
    request: Request,
    env: CloudflareEnvironment,
    context: Record<string, any> = {}
  ): Promise<Response> {
    const requestId = generateRequestId();

    try {
      const result = await handler(request, env, { ...context, requestId });
      return this.createHTTPSuccessResponse({
        ...result,
        request_id: requestId,
        timestamp: DateUtils.getTimestamp()
      });
    } catch (error: any) {
      this.logError(error, { requestId, ...context });
      return this.createHTTPErrorResponse(error, 500, requestId, context);
    }
  },

  /**
   * Retry with exponential backoff for specific error types
   */
  async retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      backoffFactor = 2,
      maxDelay = 30000,
      retryableErrors = ['TIMEOUT', 'NETWORK', 'KV_OPERATION']
    } = options;

    let attempt = 0;
    let delay = initialDelay;

    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (error: any) {
        attempt++;

        if (attempt > maxRetries || !retryableErrors.some(type =>
          error.message.toUpperCase().includes(type) ||
          (error.name && error.name.toUpperCase().includes(type))
        )) {
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
  consoleError(prefix: string, error: Error, details: Record<string, any> = {}): void {
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
  async measure<T>(fn: () => Promise<T>, label: string): Promise<PerformanceMeasurement<T>> {
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
  createTimer(label: string): PerformanceTimer {
    const start = performance.now();

    return {
      stop(): number {
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
  getOptions(keyType: string, customOptions: KVOptions = {}): KVOptions {
    const ttlMap: Record<string, number> = {
      'analysis': (getEnvConfig({}) as any).KV_STORAGE.ANALYSIS_TTL,
      'granular': (getEnvConfig({}) as any).KV_STORAGE.GRANULAR_TTL,
      'daily_summary': (getEnvConfig({}) as any).KV_STORAGE.DAILY_SUMMARY_TTL,
      'status': (getEnvConfig({}) as any).KV_STORAGE.STATUS_TTL,
      'report_cache': (getEnvConfig({}) as any).KV_STORAGE.REPORT_CACHE_TTL,
      'metadata': (getEnvConfig({}) as any).KV_STORAGE.METADATA_TTL
    };

    const ttl = ttlMap[keyType.toLowerCase()] || (getEnvConfig({}) as any).KV_STORAGE.ANALYSIS_TTL;

    return {
      expirationTtl: ttl,
      ...customOptions
    };
  },

  /**
   * Put data with standardized TTL
   */
  async putWithTTL(
    kvStore: any,
    key: string,
    data: string,
    keyType: string = 'analysis',
    customOptions: KVOptions = {}
  ): Promise<void> {
    const options = this.getOptions(keyType, customOptions);
    return await kvStore.put(key, data, options);
  },

  /**
   * Put data using key factory for standardized key management
   */
  async putWithKeyFactory(
    kvStore: any,
    keyTypeEnum: KeyType,
    data: string,
    params: Record<string, any> = {},
    customOptions: KVOptions = {}
  ): Promise<void> {
    const key = KVKeyFactory.generateKey(keyTypeEnum, params);
    const options = KeyHelpers.getKVOptions(keyTypeEnum, customOptions);
    return await kvStore.put(key, data, options);
  },

  /**
   * Get data using key factory
   */
  async getWithKeyFactory(
    kvStore: any,
    keyTypeEnum: KeyType,
    params: Record<string, any> = {}
  ): Promise<string | null> {
    const key = KVKeyFactory.generateKey(keyTypeEnum, params);
    return await kvStore.get(key);
  },

  /**
   * Check if KV operation needs retry based on error
   */
  isRetryableError(error: Error): boolean {
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
  merge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.merge(result[key] || {} as any, source[key] as any);
      } else {
        result[key] = source[key] as any;
      }
    }

    return result;
  },

  /**
   * Get nested value from object with path
   */
  get<T = any>(obj: any, path: string, defaultValue?: T): T | undefined {
    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
      if (result === null || result === undefined) {
        return defaultValue;
      }
      result = result[key];
    }

    return result as T;
  },

  /**
   * Set nested value in object with path
   */
  set<T extends Record<string, any>>(obj: T, path: string, value: any): T {
    const keys = path.split('.');
    let current: any = obj;

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
