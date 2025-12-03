/**
 * Data Validation Layer
 * Provides comprehensive input validation and sanitization for trading system
 */
import type { CloudflareEnvironment } from '../types.js';
interface OHLCVCandle {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
interface MarketDataResponse {
    success: boolean;
    data: {
        ohlcv: OHLCVCandle[];
        [key: string]: any;
    };
    [key: string]: any;
}
/**
 * Validation Error Class
 */
export declare class ValidationError extends Error {
    field: string;
    value: any;
    constructor(message: string, field: string, value: any);
}
/**
 * Symbol Validation
 */
export declare function validateSymbol(symbol: any): string;
/**
 * Symbols Array Validation
 */
export declare function validateSymbols(symbols: any): string[];
/**
 * Market Data Validation
 */
export declare function validateMarketData(marketData: any): MarketDataResponse;
/**
 * Number Range Validation
 */
export declare function validateNumberRange(value: any, field: string, min: number, max: number): number;
/**
 * Percentage Validation (0-100)
 */
export declare function validatePercentage(value: any, field: string): number;
/**
 * Confidence Threshold Validation
 */
export declare function validateConfidenceThreshold(value: any, field: string): number;
/**
 * Date Validation
 */
export declare function validateDate(date: any): Date;
/**
 * Optional Field Validation
 */
export declare function validateOptionalField<T>(value: any, validator: (val: any) => T, field: string): T | undefined;
/**
 * Request Body Validation
 */
export declare function validateRequestBody(body: any, requiredFields?: string[]): Record<string, any>;
/**
 * API Key Validation
 */
export declare function validateApiKey(apiKey: any, validKeys?: string[]): string;
/**
 * Array Validation with Type Checking
 */
export declare function validateArray<T>(value: any, itemValidator: (item: any) => T, field: string, options?: {
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
}): T[];
export type { OHLCVCandle, MarketDataResponse };
/**
 * Validate Cloudflare Environment
 */
export declare function validateEnvironment(env: CloudflareEnvironment): void;
/**
 * Validate Request Object
 */
export declare function validateRequest(request: Request): void;
/**
 * Validate KV Key Format
 */
export declare function validateKVKey(key: string): string;
/**
 * Safe Validation Wrapper - returns error message instead of throwing
 */
export declare function safeValidate<T>(value: any, validator: (val: any) => T, context?: string): {
    success: boolean;
    result?: T;
    error?: string;
};
//# sourceMappingURL=validation.d.ts.map