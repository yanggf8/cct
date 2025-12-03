/**
 * Shared Utilities Module - TypeScript
 * Type-safe common functions to reduce code duplication
 */
import { type KeyType } from './kv-key-factory.js';
import type { CloudflareEnvironment } from '../types.js';
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
export declare function generateRequestId(): string;
/**
 * Date Utilities
 */
export declare const DateUtils: {
    /**
     * Get current date in YYYY-MM-DD format
     */
    getTodayString(): string;
    /**
     * Format date for display
     */
    formatDisplayDate(date: string | Date): string;
    /**
     * Get timestamp in ISO format
     */
    getTimestamp(): string;
    /**
     * Check if date is a Friday
     */
    isFriday(date: string | Date): boolean;
    /**
     * Get week key in YYYY-WW format
     */
    getWeekKey(date: string | Date): string;
    /**
     * Get ISO week number
     */
    getWeekNumber(date: Date): number;
};
/**
 * Array Utilities
 */
export declare const ArrayUtils: {
    /**
     * Chunk array into smaller arrays
     */
    chunk<T>(array: T[], size: number): T[][];
    /**
     * Remove duplicates from array
     */
    unique<T>(array: T[]): T[];
    /**
     * Group array by key
     */
    groupBy<T extends Record<string, any>>(array: T[], key: keyof T): Record<string, T[]>;
    /**
     * Sort array by key
     */
    sortBy<T extends Record<string, any>>(array: T[], key: keyof T, direction?: "asc" | "desc"): T[];
};
/**
 * Number Utilities
 */
export declare const NumberUtils: {
    /**
     * Format currency
     */
    formatCurrency(amount: number, currency?: string): string;
    /**
     * Format percentage
     */
    formatPercentage(value: number, decimals?: number): string;
    /**
     * Clamp number between min and max
     */
    clamp(value: number, min: number, max: number): number;
    /**
     * Calculate percentage change
     */
    calculatePercentageChange(oldValue: number, newValue: number): number;
};
/**
 * String Utilities
 */
export declare const StringUtils: {
    /**
     * Capitalize first letter
     */
    capitalize(str: string): string;
    /**
     * Convert to title case
     */
    toTitleCase(str: string): string;
    /**
     * Truncate string with ellipsis
     */
    truncate(str: string, maxLength: number): string;
    /**
     * Sanitize string for HTML (Note: Only works in browser, returns original in worker)
     */
    sanitizeHTML(str: string): string;
    /**
     * Generate slug from string
     */
    slugify(str: string): string;
};
/**
 * Validation Utilities
 */
export declare const ValidationUtils: {
    /**
     * Validate email format
     */
    isValidEmail(email: string): boolean;
    /**
     * Validate URL format
     */
    isValidURL(url: string): boolean;
    /**
     * Validate symbol format
     */
    isValidSymbol(symbol: string): boolean;
    /**
     * Validate confidence threshold (0-1)
     */
    isValidConfidence(confidence: number | string): boolean;
    /**
     * Validate date string (YYYY-MM-DD)
     */
    isValidDateString(dateStr: string): boolean;
};
/**
 * Async Utilities
 */
export declare const AsyncUtils: {
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms: number): Promise<void>;
    /**
     * Retry function with exponential backoff
     */
    retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
    /**
     * Execute with timeout
     */
    withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T>;
    /**
     * Execute tasks in parallel with concurrency limit
     */
    parallel<T>(tasks: (() => Promise<T>)[], concurrency?: number): Promise<T[]>;
};
/**
 * Error Handling Utilities
 */
export declare const ErrorUtils: {
    /**
     * Create standardized error response
     */
    createError(type: string, message?: string, details?: Record<string, any>): ErrorResponse;
    /**
     * Create API error response
     */
    createAPIError(type: string, message: string, requestId: string): ErrorResponse;
    /**
     * Handle async function with error logging
     */
    withErrorHandling<T>(fn: () => Promise<T>, context?: Record<string, any>): Promise<T>;
    /**
     * Wrap function for consistent error handling
     */
    wrap<T extends any[], R>(fn: (...args: T) => Promise<R>, errorHandler?: (error: Error, ...args: T) => R | Promise<R>): (...args: T) => Promise<R>;
    /**
     * Create HTTP error response
     */
    createHTTPErrorResponse(error: Error, status?: number, requestId?: string | null, context?: Record<string, any>): Response;
    /**
     * Create HTTP success response
     */
    createHTTPSuccessResponse(data: any, status?: number, headers?: Record<string, string>): Response;
    /**
     * Log error with context
     */
    logError(error: Error, context?: Record<string, any>, logLevel?: "error" | "warn" | "info"): void;
    /**
     * Handle API endpoint errors consistently
     */
    handleAPIEndpoint(handler: (request: Request, env: CloudflareEnvironment, context: any) => Promise<any>, request: Request, env: CloudflareEnvironment, context?: Record<string, any>): Promise<Response>;
    /**
     * Retry with exponential backoff for specific error types
     */
    retryWithBackoff<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
    /**
     * Create standardized console error message
     */
    consoleError(prefix: string, error: Error, details?: Record<string, any>): void;
};
/**
 * Performance Utilities
 */
export declare const PerformanceUtils: {
    /**
     * Measure execution time
     */
    measure<T>(fn: () => Promise<T>, label: string): Promise<PerformanceMeasurement<T>>;
    /**
     * Create performance timer
     */
    createTimer(label: string): PerformanceTimer;
};
/**
 * KV Storage Utilities
 */
export declare const KVUtils: {
    /**
     * Get KV options with centralized TTL configuration (legacy - use KeyHelpers.getKVOptions for new code)
     */
    getOptions(keyType: string, customOptions?: KVOptions, env?: CloudflareEnvironment): KVOptions;
    /**
     * Put data with standardized TTL
     */
    putWithTTL(kvStore: any, key: string, data: string, keyType?: string, customOptions?: KVOptions): Promise<void>;
    /**
     * Put data using key factory for standardized key management
     */
    putWithKeyFactory(kvStore: any, keyTypeEnum: KeyType, data: string, params?: Record<string, any>, customOptions?: KVOptions): Promise<void>;
    /**
     * Get data using key factory
     */
    getWithKeyFactory(kvStore: any, keyTypeEnum: KeyType, params?: Record<string, any>): Promise<string | null>;
    /**
     * Check if KV operation needs retry based on error
     */
    isRetryableError(error: Error): boolean;
};
/**
 * Object Utilities
 */
export declare const ObjectUtils: {
    /**
     * Deep merge objects
     */
    merge<T extends Record<string, any>>(target: T, source: Partial<T>): T;
    /**
     * Get nested value from object with path
     */
    get<T = any>(obj: any, path: string, defaultValue?: T): T | undefined;
    /**
     * Set nested value in object with path
     */
    set<T extends Record<string, any>>(obj: T, path: string, value: any): T;
};
declare const _default: {
    DateUtils: {
        /**
         * Get current date in YYYY-MM-DD format
         */
        getTodayString(): string;
        /**
         * Format date for display
         */
        formatDisplayDate(date: string | Date): string;
        /**
         * Get timestamp in ISO format
         */
        getTimestamp(): string;
        /**
         * Check if date is a Friday
         */
        isFriday(date: string | Date): boolean;
        /**
         * Get week key in YYYY-WW format
         */
        getWeekKey(date: string | Date): string;
        /**
         * Get ISO week number
         */
        getWeekNumber(date: Date): number;
    };
    ArrayUtils: {
        /**
         * Chunk array into smaller arrays
         */
        chunk<T>(array: T[], size: number): T[][];
        /**
         * Remove duplicates from array
         */
        unique<T>(array: T[]): T[];
        /**
         * Group array by key
         */
        groupBy<T extends Record<string, any>>(array: T[], key: keyof T): Record<string, T[]>;
        /**
         * Sort array by key
         */
        sortBy<T extends Record<string, any>>(array: T[], key: keyof T, direction?: "asc" | "desc"): T[];
    };
    NumberUtils: {
        /**
         * Format currency
         */
        formatCurrency(amount: number, currency?: string): string;
        /**
         * Format percentage
         */
        formatPercentage(value: number, decimals?: number): string;
        /**
         * Clamp number between min and max
         */
        clamp(value: number, min: number, max: number): number;
        /**
         * Calculate percentage change
         */
        calculatePercentageChange(oldValue: number, newValue: number): number;
    };
    StringUtils: {
        /**
         * Capitalize first letter
         */
        capitalize(str: string): string;
        /**
         * Convert to title case
         */
        toTitleCase(str: string): string;
        /**
         * Truncate string with ellipsis
         */
        truncate(str: string, maxLength: number): string;
        /**
         * Sanitize string for HTML (Note: Only works in browser, returns original in worker)
         */
        sanitizeHTML(str: string): string;
        /**
         * Generate slug from string
         */
        slugify(str: string): string;
    };
    ValidationUtils: {
        /**
         * Validate email format
         */
        isValidEmail(email: string): boolean;
        /**
         * Validate URL format
         */
        isValidURL(url: string): boolean;
        /**
         * Validate symbol format
         */
        isValidSymbol(symbol: string): boolean;
        /**
         * Validate confidence threshold (0-1)
         */
        isValidConfidence(confidence: number | string): boolean;
        /**
         * Validate date string (YYYY-MM-DD)
         */
        isValidDateString(dateStr: string): boolean;
    };
    AsyncUtils: {
        /**
         * Sleep for specified milliseconds
         */
        sleep(ms: number): Promise<void>;
        /**
         * Retry function with exponential backoff
         */
        retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
        /**
         * Execute with timeout
         */
        withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T>;
        /**
         * Execute tasks in parallel with concurrency limit
         */
        parallel<T>(tasks: (() => Promise<T>)[], concurrency?: number): Promise<T[]>;
    };
    ErrorUtils: {
        /**
         * Create standardized error response
         */
        createError(type: string, message?: string, details?: Record<string, any>): ErrorResponse;
        /**
         * Create API error response
         */
        createAPIError(type: string, message: string, requestId: string): ErrorResponse;
        /**
         * Handle async function with error logging
         */
        withErrorHandling<T>(fn: () => Promise<T>, context?: Record<string, any>): Promise<T>;
        /**
         * Wrap function for consistent error handling
         */
        wrap<T extends any[], R>(fn: (...args: T) => Promise<R>, errorHandler?: (error: Error, ...args: T) => R | Promise<R>): (...args: T) => Promise<R>;
        /**
         * Create HTTP error response
         */
        createHTTPErrorResponse(error: Error, status?: number, requestId?: string | null, context?: Record<string, any>): Response;
        /**
         * Create HTTP success response
         */
        createHTTPSuccessResponse(data: any, status?: number, headers?: Record<string, string>): Response;
        /**
         * Log error with context
         */
        logError(error: Error, context?: Record<string, any>, logLevel?: "error" | "warn" | "info"): void;
        /**
         * Handle API endpoint errors consistently
         */
        handleAPIEndpoint(handler: (request: Request, env: CloudflareEnvironment, context: any) => Promise<any>, request: Request, env: CloudflareEnvironment, context?: Record<string, any>): Promise<Response>;
        /**
         * Retry with exponential backoff for specific error types
         */
        retryWithBackoff<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
        /**
         * Create standardized console error message
         */
        consoleError(prefix: string, error: Error, details?: Record<string, any>): void;
    };
    PerformanceUtils: {
        /**
         * Measure execution time
         */
        measure<T>(fn: () => Promise<T>, label: string): Promise<PerformanceMeasurement<T>>;
        /**
         * Create performance timer
         */
        createTimer(label: string): PerformanceTimer;
    };
    KVUtils: {
        /**
         * Get KV options with centralized TTL configuration (legacy - use KeyHelpers.getKVOptions for new code)
         */
        getOptions(keyType: string, customOptions?: KVOptions, env?: CloudflareEnvironment): KVOptions;
        /**
         * Put data with standardized TTL
         */
        putWithTTL(kvStore: any, key: string, data: string, keyType?: string, customOptions?: KVOptions): Promise<void>;
        /**
         * Put data using key factory for standardized key management
         */
        putWithKeyFactory(kvStore: any, keyTypeEnum: KeyType, data: string, params?: Record<string, any>, customOptions?: KVOptions): Promise<void>;
        /**
         * Get data using key factory
         */
        getWithKeyFactory(kvStore: any, keyTypeEnum: KeyType, params?: Record<string, any>): Promise<string | null>;
        /**
         * Check if KV operation needs retry based on error
         */
        isRetryableError(error: Error): boolean;
    };
    ObjectUtils: {
        /**
         * Deep merge objects
         */
        merge<T extends Record<string, any>>(target: T, source: Partial<T>): T;
        /**
         * Get nested value from object with path
         */
        get<T = any>(obj: any, path: string, defaultValue?: T): T | undefined;
        /**
         * Set nested value in object with path
         */
        set<T extends Record<string, any>>(obj: T, path: string, value: any): T;
    };
    generateRequestId: typeof generateRequestId;
    getTodayString: any;
};
export default _default;
//# sourceMappingURL=shared-utilities.d.ts.map