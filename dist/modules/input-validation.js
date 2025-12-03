/**
 * Comprehensive Input Validation Module
 * Enterprise-grade validation for all API endpoints and data inputs
 * Phase 1: Critical Fixes - Data Access Improvement Plan
 */
import { createLogger } from './logging.js';
const logger = createLogger('input-validation');
/**
 * Stock symbol validation
 */
export class SymbolValidator {
    static validate(symbol) {
        if (!symbol || typeof symbol !== 'string') {
            return {
                isValid: false,
                error: 'Symbol is required and must be a string'
            };
        }
        const sanitized = symbol.toUpperCase().trim();
        if (!this.SYMBOL_PATTERN.test(sanitized)) {
            return {
                isValid: false,
                error: 'Invalid symbol format. Must be 1-5 uppercase letters (e.g., AAPL, MSFT)'
            };
        }
        return {
            isValid: true,
            sanitizedValue: sanitized
        };
    }
    static validateMultiple(symbols) {
        if (!Array.isArray(symbols)) {
            return {
                isValid: false,
                error: 'Symbols must be an array'
            };
        }
        if (symbols.length === 0) {
            return {
                isValid: false,
                error: 'At least one symbol is required'
            };
        }
        if (symbols.length > this.MAX_SYMBOLS) {
            return {
                isValid: false,
                error: `Maximum ${this.MAX_SYMBOLS} symbols allowed per request`
            };
        }
        const validated = [];
        const errors = [];
        for (const symbol of symbols) {
            const result = this.validate(symbol);
            if (result.isValid) {
                validated.push(result.sanitizedValue);
            }
            else {
                errors.push(`${symbol}: ${result.error}`);
            }
        }
        if (errors.length > 0) {
            return {
                isValid: false,
                error: `Invalid symbols: ${errors.join(', ')}`
            };
        }
        // Remove duplicates and limit to MAX_SYMBOLS
        const uniqueSymbols = [...new Set(validated)].slice(0, this.MAX_SYMBOLS);
        return {
            isValid: true,
            sanitizedValue: uniqueSymbols
        };
    }
}
SymbolValidator.SYMBOL_PATTERN = /^[A-Z]{1,5}$/;
SymbolValidator.MAX_SYMBOLS = 50;
/**
 * Date validation
 */
export class DateValidator {
    static validate(date) {
        if (!date || typeof date !== 'string') {
            return {
                isValid: false,
                error: 'Date is required and must be a string'
            };
        }
        if (!this.DATE_PATTERN.test(date)) {
            return {
                isValid: false,
                error: 'Invalid date format. Use YYYY-MM-DD (e.g., 2024-01-15)'
            };
        }
        const parsedDate = new Date(date + 'T00:00:00.000Z');
        if (isNaN(parsedDate.getTime())) {
            return {
                isValid: false,
                error: 'Invalid date value'
            };
        }
        if (date < this.MIN_DATE) {
            return {
                isValid: false,
                error: `Date cannot be earlier than ${this.MIN_DATE}`
            };
        }
        if (date > this.MAX_DATE) {
            return {
                isValid: false,
                error: `Date cannot be later than ${this.MAX_DATE}`
            };
        }
        return {
            isValid: true,
            sanitizedValue: date
        };
    }
    static validateDateRange(startDate, endDate) {
        const startResult = this.validate(startDate);
        if (!startResult.isValid) {
            return startResult;
        }
        const endResult = this.validate(endDate);
        if (!endResult.isValid) {
            return endResult;
        }
        const start = new Date(startDate + 'T00:00:00.000Z');
        const end = new Date(endDate + 'T00:00:00.000Z');
        if (start >= end) {
            return {
                isValid: false,
                error: 'Start date must be earlier than end date'
            };
        }
        const maxDaysDiff = 365 * 5; // 5 years max
        const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > maxDaysDiff) {
            return {
                isValid: false,
                error: `Date range cannot exceed ${maxDaysDiff} days`
            };
        }
        return {
            isValid: true,
            sanitizedValue: { startDate, endDate }
        };
    }
}
DateValidator.DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
DateValidator.MIN_DATE = '2010-01-01';
DateValidator.MAX_DATE = new Date().toISOString().split('T')[0];
/**
 * Number validation
 */
export class NumberValidator {
    static validate(value, options = {}) {
        const { min, max, isInteger, isPositive } = options;
        if (typeof value !== 'number' || isNaN(value)) {
            return {
                isValid: false,
                error: 'Value must be a valid number'
            };
        }
        if (isInteger && !Number.isInteger(value)) {
            return {
                isValid: false,
                error: 'Value must be an integer'
            };
        }
        if (isPositive && value <= 0) {
            return {
                isValid: false,
                error: 'Value must be positive'
            };
        }
        if (min !== undefined && value < min) {
            return {
                isValid: false,
                error: `Value must be at least ${min}`
            };
        }
        if (max !== undefined && value > max) {
            return {
                isValid: false,
                error: `Value must be no more than ${max}`
            };
        }
        return {
            isValid: true,
            sanitizedValue: value
        };
    }
    static validatePercentage(value) {
        return this.validate(value, {
            min: 0,
            max: 100,
            isPositive: true
        });
    }
    static validateConfidence(value) {
        return this.validate(value, {
            min: 0,
            max: 100,
            isInteger: false,
            isPositive: false
        });
    }
}
/**
 * String validation
 */
export class StringValidator {
    static validate(value, options = {}) {
        const { minLength, maxLength, pattern, allowEmpty = false } = options;
        if (typeof value !== 'string') {
            return {
                isValid: false,
                error: 'Value must be a string'
            };
        }
        const trimmed = value.trim();
        if (!allowEmpty && trimmed.length === 0) {
            return {
                isValid: false,
                error: 'Value cannot be empty'
            };
        }
        if (minLength && trimmed.length < minLength) {
            return {
                isValid: false,
                error: `Value must be at least ${minLength} characters long`
            };
        }
        if (maxLength && trimmed.length > maxLength) {
            return {
                isValid: false,
                error: `Value cannot exceed ${maxLength} characters`
            };
        }
        if (pattern && !pattern.test(trimmed)) {
            return {
                isValid: false,
                error: 'Value format is invalid'
            };
        }
        return {
            isValid: true,
            sanitizedValue: trimmed
        };
    }
    static validateApiKey(key) {
        return this.validate(key, {
            minLength: 3,
            maxLength: 100,
            pattern: /^[a-zA-Z0-9_-]+$/,
            allowEmpty: false
        });
    }
    static validateReportType(type) {
        const validTypes = ['pre-market', 'intraday', 'end-of-day', 'weekly', 'daily'];
        if (!validTypes.includes(type)) {
            return {
                isValid: false,
                error: `Invalid report type. Must be one of: ${validTypes.join(', ')}`
            };
        }
        return {
            isValid: true,
            sanitizedValue: type
        };
    }
}
/**
 * Array validation
 */
export class ArrayValidator {
    static validate(value, options = {}) {
        const { minLength, maxLength, itemValidator } = options;
        if (!Array.isArray(value)) {
            return {
                isValid: false,
                error: 'Value must be an array'
            };
        }
        if (minLength !== undefined && value.length < minLength) {
            return {
                isValid: false,
                error: `Array must contain at least ${minLength} items`
            };
        }
        if (maxLength !== undefined && value.length > maxLength) {
            return {
                isValid: false,
                error: `Array cannot contain more than ${maxLength} items`
            };
        }
        if (itemValidator) {
            const errors = [];
            const validated = [];
            for (let i = 0; i < value.length; i++) {
                const result = itemValidator(value[i]);
                if (result.isValid) {
                    validated.push(result.sanitizedValue);
                }
                else {
                    errors.push(`Item ${i}: ${result.error}`);
                }
            }
            if (errors.length > 0) {
                return {
                    isValid: false,
                    error: `Invalid array items: ${errors.join(', ')}`
                };
            }
            return {
                isValid: true,
                sanitizedValue: validated
            };
        }
        return {
            isValid: true,
            sanitizedValue: value
        };
    }
}
/**
 * Portfolio data validation
 */
export class PortfolioValidator {
    static validateWeights(weights) {
        if (!weights || typeof weights !== 'object') {
            return {
                isValid: false,
                error: 'Weights must be an object'
            };
        }
        const entries = Object.entries(weights);
        if (entries.length === 0) {
            return {
                isValid: false,
                error: 'At least one weight must be provided'
            };
        }
        if (entries.length > 50) {
            return {
                isValid: false,
                error: 'Portfolio cannot contain more than 50 positions'
            };
        }
        let totalWeight = 0;
        const errors = [];
        for (const [symbol, weight] of entries) {
            // Validate symbol
            const symbolResult = SymbolValidator.validate(symbol);
            if (!symbolResult.isValid) {
                errors.push(`${symbol}: ${symbolResult.error}`);
                continue;
            }
            // Validate weight
            const weightResult = NumberValidator.validate(weight, {
                min: 0,
                max: 1,
                isPositive: false
            });
            if (!weightResult.isValid) {
                errors.push(`${symbol} weight: ${weightResult.error}`);
                continue;
            }
            totalWeight += weight;
        }
        if (errors.length > 0) {
            return {
                isValid: false,
                error: errors.join(', ')
            };
        }
        // Check total weight (allowing small floating point errors)
        if (Math.abs(totalWeight - 1.0) > 0.01) {
            return {
                isValid: false,
                error: `Portfolio weights must sum to 1.0 (current sum: ${totalWeight.toFixed(4)})`
            };
        }
        return {
            isValid: true,
            sanitizedValue: weights
        };
    }
}
/**
 * Comprehensive request validator
 */
export class RequestValidator {
    static validateSentimentRequest(params) {
        const errors = [];
        if (params.symbols) {
            const symbolsResult = SymbolValidator.validateMultiple(params.symbols);
            if (!symbolsResult.isValid) {
                errors.push(`Symbols: ${symbolsResult.error}`);
            }
        }
        if (params.date) {
            const dateResult = DateValidator.validate(params.date);
            if (!dateResult.isValid) {
                errors.push(`Date: ${dateResult.error}`);
            }
        }
        if (errors.length > 0) {
            return {
                isValid: false,
                error: errors.join('; ')
            };
        }
        return {
            isValid: true,
            sanitizedValue: params
        };
    }
    static validateBacktestRequest(params) {
        // Validate symbols
        const symbolsResult = SymbolValidator.validateMultiple(params.symbols);
        if (!symbolsResult.isValid) {
            return symbolsResult;
        }
        // Validate date range
        const dateRangeResult = DateValidator.validateDateRange(params.startDate, params.endDate);
        if (!dateRangeResult.isValid) {
            return dateRangeResult;
        }
        return {
            isValid: true,
            sanitizedValue: {
                symbols: symbolsResult.sanitizedValue,
                startDate: params.startDate,
                endDate: params.endDate,
                strategy: params.strategy
            }
        };
    }
    static validatePortfolioRequest(params) {
        // Validate symbols
        const symbolsResult = SymbolValidator.validateMultiple(params.symbols);
        if (!symbolsResult.isValid) {
            return symbolsResult;
        }
        // Validate weights if provided
        if (params.weights) {
            const weightsResult = PortfolioValidator.validateWeights(params.weights);
            if (!weightsResult.isValid) {
                return weightsResult;
            }
        }
        // Validate objective if provided
        if (params.objective) {
            const validObjectives = ['MAX_SHARPE', 'MIN_VOLATILITY', 'RISK_PARITY', 'EQUAL_WEIGHT'];
            if (!validObjectives.includes(params.objective)) {
                return {
                    isValid: false,
                    error: `Invalid objective. Must be one of: ${validObjectives.join(', ')}`
                };
            }
        }
        return {
            isValid: true,
            sanitizedValue: params
        };
    }
}
/**
 * Input sanitization utilities
 */
export class InputSanitizer {
    static sanitizeString(input) {
        if (typeof input !== 'string')
            return '';
        return input
            .trim()
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
            .substring(0, 10000); // Limit length
    }
    static sanitizeNumber(input) {
        const num = Number(input);
        return isNaN(num) ? null : num;
    }
    static sanitizeApiKey(input) {
        if (typeof input !== 'string')
            return '';
        return input
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '') // Only allow alphanumeric, underscore, dash
            .substring(0, 100);
    }
}
/**
 * Main validation function
 */
export function validateInput(input, type, options) {
    try {
        switch (type) {
            case 'symbol':
                return SymbolValidator.validate(input);
            case 'symbols':
                return SymbolValidator.validateMultiple(input);
            case 'date':
                return DateValidator.validate(input);
            case 'dateRange':
                return DateValidator.validateDateRange(input.startDate, input.endDate);
            case 'number':
                return NumberValidator.validate(input, options);
            case 'percentage':
                return NumberValidator.validatePercentage(input);
            case 'confidence':
                return NumberValidator.validateConfidence(input);
            case 'string':
                return StringValidator.validate(input, options);
            case 'apiKey':
                return StringValidator.validateApiKey(input);
            case 'reportType':
                return StringValidator.validateReportType(input);
            case 'array':
                return ArrayValidator.validate(input, options);
            case 'portfolio':
                return PortfolioValidator.validateWeights(input);
            case 'sentimentRequest':
                return RequestValidator.validateSentimentRequest(input);
            case 'backtestRequest':
                return RequestValidator.validateBacktestRequest(input);
            case 'portfolioRequest':
                return RequestValidator.validatePortfolioRequest(input);
            default:
                return {
                    isValid: false,
                    error: `Unknown validation type: ${type}`
                };
        }
    }
    catch (error) {
        logger.error('Validation error', { type, input, error: error instanceof Error ? error.message : String(error) });
        return {
            isValid: false,
            error: 'Validation failed due to internal error'
        };
    }
}
export default {
    SymbolValidator,
    DateValidator,
    NumberValidator,
    StringValidator,
    ArrayValidator,
    PortfolioValidator,
    RequestValidator,
    InputSanitizer,
    validateInput
};
//# sourceMappingURL=input-validation.js.map