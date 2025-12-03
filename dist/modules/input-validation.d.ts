/**
 * Comprehensive Input Validation Module
 * Enterprise-grade validation for all API endpoints and data inputs
 * Phase 1: Critical Fixes - Data Access Improvement Plan
 */
/**
 * Validation result interface
 */
export interface ValidationResult {
    isValid: boolean;
    error?: string;
    sanitizedValue?: any;
}
/**
 * Stock symbol validation
 */
export declare class SymbolValidator {
    static readonly SYMBOL_PATTERN: RegExp;
    static readonly MAX_SYMBOLS = 50;
    static validate(symbol: string): ValidationResult;
    static validateMultiple(symbols: string[]): ValidationResult;
}
/**
 * Date validation
 */
export declare class DateValidator {
    static readonly DATE_PATTERN: RegExp;
    static readonly MIN_DATE = "2010-01-01";
    static readonly MAX_DATE: string;
    static validate(date: string): ValidationResult;
    static validateDateRange(startDate: string, endDate: string): ValidationResult;
}
/**
 * Number validation
 */
export declare class NumberValidator {
    static validate(value: any, options?: {
        min?: number;
        max?: number;
        isInteger?: boolean;
        isPositive?: boolean;
    }): ValidationResult;
    static validatePercentage(value: any): ValidationResult;
    static validateConfidence(value: any): ValidationResult;
}
/**
 * String validation
 */
export declare class StringValidator {
    static validate(value: any, options?: {
        minLength?: number;
        maxLength?: number;
        pattern?: RegExp;
        allowEmpty?: boolean;
    }): ValidationResult;
    static validateApiKey(key: string): ValidationResult;
    static validateReportType(type: string): ValidationResult;
}
/**
 * Array validation
 */
export declare class ArrayValidator {
    static validate(value: any, options?: {
        minLength?: number;
        maxLength?: number;
        itemValidator?: (item: any) => ValidationResult;
    }): ValidationResult;
}
/**
 * Portfolio data validation
 */
export declare class PortfolioValidator {
    static validateWeights(weights: Record<string, number>): ValidationResult;
}
/**
 * Comprehensive request validator
 */
export declare class RequestValidator {
    static validateSentimentRequest(params: {
        symbols?: string[];
        date?: string;
    }): ValidationResult;
    static validateBacktestRequest(params: {
        symbols: string[];
        startDate: string;
        endDate: string;
        strategy?: any;
    }): ValidationResult;
    static validatePortfolioRequest(params: {
        symbols: string[];
        weights?: Record<string, number>;
        objective?: string;
    }): ValidationResult;
}
/**
 * Input sanitization utilities
 */
export declare class InputSanitizer {
    static sanitizeString(input: string): string;
    static sanitizeNumber(input: any): number | null;
    static sanitizeApiKey(input: string): string;
}
/**
 * Main validation function
 */
export declare function validateInput(input: any, type: string, options?: any): ValidationResult;
declare const _default: {
    SymbolValidator: typeof SymbolValidator;
    DateValidator: typeof DateValidator;
    NumberValidator: typeof NumberValidator;
    StringValidator: typeof StringValidator;
    ArrayValidator: typeof ArrayValidator;
    PortfolioValidator: typeof PortfolioValidator;
    RequestValidator: typeof RequestValidator;
    InputSanitizer: typeof InputSanitizer;
    validateInput: typeof validateInput;
};
export default _default;
//# sourceMappingURL=input-validation.d.ts.map