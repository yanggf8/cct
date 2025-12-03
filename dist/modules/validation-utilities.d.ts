/**
 * Validation Utilities Module - TypeScript
 * Centralized, type-safe validation functions
 */
import { SystemConfig } from './config.js';
import type { CloudflareEnvironment } from '../types.js';
export interface ValidationHeaders {
    [key: string]: string;
}
export interface TradingSignal {
    symbol: string;
    direction: string;
    current_price: number;
    confidence: number;
    [key: string]: any;
}
export interface AnalysisResults {
    trading_signals: {
        [symbol: string]: TradingSignal;
    };
    [key: string]: any;
}
export interface MarketDataResponse {
    data: {
        ohlcv?: number[][];
        [key: string]: any;
    };
    symbol: string;
    [key: string]: any;
}
export interface EnvironmentValidationResult {
    valid: boolean;
    hasAI: boolean;
    config: SystemConfig;
}
/**
 * Request Validation Utilities
 */
export declare const RequestValidation: {
    /**
     * Validate HTTP request object
     */
    validateRequest(request: Request): boolean;
    /**
     * Validate required headers
     */
    validateHeaders(request: Request, requiredHeaders?: string[]): ValidationHeaders;
    /**
     * Validate API key
     */
    validateAPIKey(request: Request, env: CloudflareEnvironment): boolean;
    /**
     * Validate content type
     */
    validateContentType(request: Request, expectedTypes?: string[]): boolean;
};
/**
 * Data Validation Utilities
 */
export declare const DataValidation: {
    /**
     * Validate trading symbol
     */
    validateSymbol(symbol: string): string;
    /**
     * Validate symbols array
     */
    validateSymbols(symbols: string[]): string[];
    /**
     * Validate date string
     */
    validateDateString(dateStr: string): string;
    /**
     * Validate confidence threshold
     */
    validateConfidence(confidence: number | string, field?: string): number;
    /**
     * Validate numeric range
     */
    validateRange(value: number | string, min: number, max: number, field?: string): number;
    /**
     * Validate positive integer
     */
    validatePositiveInteger(value: number | string, field?: string): number;
    /**
     * Validate array of strings
     */
    validateStringArray(arr: string[], field?: string): string[];
};
/**
 * Environment Validation Utilities
 */
export declare const EnvironmentValidation: {
    /**
     * Validate required environment variables
     */
    validateRequiredEnv(env: CloudflareEnvironment, requiredVars?: string[]): boolean;
    /**
     * Validate KV bindings
     */
    validateKVBindings(env: CloudflareEnvironment): boolean;
    /**
     * Validate R2 bindings
     */
    validateR2Bindings(env: CloudflareEnvironment): boolean;
    /**
     * Validate AI binding
     */
    validateAIBinding(env: CloudflareEnvironment): boolean;
    /**
     * Complete environment validation
     */
    validateEnvironment(env: CloudflareEnvironment): EnvironmentValidationResult;
};
/**
 * Market Data Validation Utilities
 */
export declare const MarketDataValidation: {
    /**
     * Validate OHLCV data structure
     */
    validateOHLCV(ohlcv: number[][]): number[][];
    /**
     * Validate market data response
     */
    validateMarketDataResponse(data: MarketDataResponse): MarketDataResponse;
};
/**
 * Analysis Validation Utilities
 */
export declare const AnalysisValidation: {
    /**
     * Validate trading signal
     */
    validateTradingSignal(signal: any): TradingSignal;
    /**
     * Validate analysis results
     */
    validateAnalysisResults(results: any): AnalysisResults;
};
/**
 * Validation Result Helper
 */
export declare class ValidationResult<T = any> {
    success: boolean;
    data: T | null;
    errors: string[];
    constructor(success: boolean, data?: T | null, errors?: string | string[]);
    /**
     * Create successful validation result
     */
    static success<T>(data: T): ValidationResult<T>;
    /**
     * Create failed validation result
     */
    static failure(errors: string | string[]): ValidationResult;
    /**
     * Check if validation passed
     */
    isValid(): boolean;
    /**
     * Get error messages
     */
    getErrorMessages(): string[];
}
/**
 * Safe validation wrapper
 */
export declare function safeValidate<T>(validator: (data: any) => T, data: any, context?: Record<string, any>): ValidationResult<T>;
declare const _default: {
    RequestValidation: {
        /**
         * Validate HTTP request object
         */
        validateRequest(request: Request): boolean;
        /**
         * Validate required headers
         */
        validateHeaders(request: Request, requiredHeaders?: string[]): ValidationHeaders;
        /**
         * Validate API key
         */
        validateAPIKey(request: Request, env: CloudflareEnvironment): boolean;
        /**
         * Validate content type
         */
        validateContentType(request: Request, expectedTypes?: string[]): boolean;
    };
    DataValidation: {
        /**
         * Validate trading symbol
         */
        validateSymbol(symbol: string): string;
        /**
         * Validate symbols array
         */
        validateSymbols(symbols: string[]): string[];
        /**
         * Validate date string
         */
        validateDateString(dateStr: string): string;
        /**
         * Validate confidence threshold
         */
        validateConfidence(confidence: number | string, field?: string): number;
        /**
         * Validate numeric range
         */
        validateRange(value: number | string, min: number, max: number, field?: string): number;
        /**
         * Validate positive integer
         */
        validatePositiveInteger(value: number | string, field?: string): number;
        /**
         * Validate array of strings
         */
        validateStringArray(arr: string[], field?: string): string[];
    };
    EnvironmentValidation: {
        /**
         * Validate required environment variables
         */
        validateRequiredEnv(env: CloudflareEnvironment, requiredVars?: string[]): boolean;
        /**
         * Validate KV bindings
         */
        validateKVBindings(env: CloudflareEnvironment): boolean;
        /**
         * Validate R2 bindings
         */
        validateR2Bindings(env: CloudflareEnvironment): boolean;
        /**
         * Validate AI binding
         */
        validateAIBinding(env: CloudflareEnvironment): boolean;
        /**
         * Complete environment validation
         */
        validateEnvironment(env: CloudflareEnvironment): EnvironmentValidationResult;
    };
    MarketDataValidation: {
        /**
         * Validate OHLCV data structure
         */
        validateOHLCV(ohlcv: number[][]): number[][];
        /**
         * Validate market data response
         */
        validateMarketDataResponse(data: MarketDataResponse): MarketDataResponse;
    };
    AnalysisValidation: {
        /**
         * Validate trading signal
         */
        validateTradingSignal(signal: any): TradingSignal;
        /**
         * Validate analysis results
         */
        validateAnalysisResults(results: any): AnalysisResults;
    };
    ValidationResult: typeof ValidationResult;
    safeValidate: typeof safeValidate;
};
export default _default;
//# sourceMappingURL=validation-utilities.d.ts.map