/**
 * Validation Utilities Module - TypeScript
 * Centralized, type-safe validation functions
 */

import { createLogger } from './logging.js';
import { getEnvConfig, getErrorMessage, SystemConfig } from './config.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('validation-utilities');

// Type Definitions
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
export const RequestValidation = {
  /**
   * Validate HTTP request object
   */
  validateRequest(request: Request): boolean {
    if (!request) {
      throw new Error('Request object is required');
    }

    if (typeof request.method !== 'string') {
      throw new Error('Request method must be a string');
    }

    if (typeof request.url !== 'string') {
      throw new Error('Request URL must be a string');
    }

    return true;
  },

  /**
   * Validate required headers
   */
  validateHeaders(request: Request, requiredHeaders: string[] = []): ValidationHeaders {
    const headers: ValidationHeaders = {};
    request.headers.forEach((value: any, key: any) => {
      headers[key] = value;
    });

    const missing = requiredHeaders.filter(header => !headers[header]);

    if (missing.length > 0) {
      throw new Error(`Missing required headers: ${missing.join(', ')}`);
    }

    return headers;
  },

  /**
   * Validate API key
   */
  validateAPIKey(request: Request, env: CloudflareEnvironment): boolean {
    const apiKey = request.headers.get('X-API-Key');
    const validKey = env.WORKER_API_KEY;

    if (!validKey) {
      // No API key required
      return true;
    }

    if (!apiKey || apiKey !== validKey) {
      throw new Error('Invalid or missing API key');
    }

    return true;
  },

  /**
   * Validate content type
   */
  validateContentType(request: Request, expectedTypes: string[] = ['application/json']): boolean {
    const contentType = request.headers.get('content-type');

    if (!contentType) {
      throw new Error('Content-Type header is required');
    }

    const isValid = expectedTypes.some(type =>
      contentType.toLowerCase().includes(type.toLowerCase())
    );

    if (!isValid) {
      throw new Error(`Invalid content type. Expected: ${expectedTypes.join(', ')}`);
    }

    return true;
  }
};

/**
 * Data Validation Utilities
 */
export const DataValidation = {
  /**
   * Validate trading symbol
   */
  validateSymbol(symbol: string): string {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Symbol is required and must be a string');
    }

    const cleanSymbol = symbol.trim().toUpperCase();

    if (!/^[A-Z]{1,5}$/.test(cleanSymbol)) {
      throw new Error('Symbol must be 1-5 uppercase letters');
    }

    return cleanSymbol;
  },

  /**
   * Validate symbols array
   */
  validateSymbols(symbols: string[]): string[] {
    if (!Array.isArray(symbols)) {
      throw new Error('Symbols must be an array');
    }

    if (symbols.length === 0) {
      throw new Error('Symbols array cannot be empty');
    }

    if (symbols.length > 10) {
      throw new Error('Maximum 10 symbols allowed');
    }

    return symbols.map(symbol => this.validateSymbol(symbol));
  },

  /**
   * Validate date string
   */
  validateDateString(dateStr: string): string {
    if (!dateStr || typeof dateStr !== 'string') {
      throw new Error('Date string is required');
    }

    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoRegex.test(dateStr)) {
      throw new Error('Date must be in YYYY-MM-DD format');
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }

    // Check if date is not in the future (with 1 day grace period for timezone differences)
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 1);

    if (date > maxDate) {
      throw new Error('Date cannot be in the future');
    }

    return dateStr;
  },

  /**
   * Validate confidence threshold
   */
  validateConfidence(confidence: number | string, field: string = 'confidence'): number {
    const num = parseFloat(confidence as string);

    if (isNaN(num)) {
      throw new Error(`${field} must be a number`);
    }

    if (num < 0 || num > 1) {
      throw new Error(`${field} must be between 0 and 1`);
    }

    return num;
  },

  /**
   * Validate numeric range
   */
  validateRange(value: number | string, min: number, max: number, field: string = 'value'): number {
    const num = parseFloat(value as string);

    if (isNaN(num)) {
      throw new Error(`${field} must be a number`);
    }

    if (num < min || num > max) {
      throw new Error(`${field} must be between ${min} and ${max}`);
    }

    return num;
  },

  /**
   * Validate positive integer
   */
  validatePositiveInteger(value: number | string, field: string = 'value'): number {
    const num = parseInt(value as string);

    if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
      throw new Error(`${field} must be a positive integer`);
    }

    return num;
  },

  /**
   * Validate array of strings
   */
  validateStringArray(arr: string[], field: string = 'array'): string[] {
    if (!Array.isArray(arr)) {
      throw new Error(`${field} must be an array`);
    }

    if (arr.length === 0) {
      throw new Error(`${field} cannot be empty`);
    }

    const invalidItems = arr.filter(item => typeof item !== 'string' || item.trim() === '');
    if (invalidItems.length > 0) {
      throw new Error(`${field} contains invalid string values`);
    }

    return arr.map(item => item.trim());
  }
};

/**
 * Environment Validation Utilities
 */
export const EnvironmentValidation = {
  /**
   * Validate required environment variables
   */
  validateRequiredEnv(env: CloudflareEnvironment, requiredVars: string[] = []): boolean {
    const missing = requiredVars.filter(varName => !env[varName]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return true;
  },

  /**
   * Validate KV bindings
   */
  validateKVBindings(env: CloudflareEnvironment): boolean {
    if (!env.TRADING_RESULTS) {
      throw new Error('TRADING_RESULTS KV binding is required');
    }

    return true;
  },

  /**
   * Validate R2 bindings
   */
  validateR2Bindings(env: CloudflareEnvironment): boolean {
    if (!env.TRAINED_MODELS) {
      throw new Error('TRAINED_MODELS R2 binding is required');
    }

    return true;
  },

  /**
   * Validate AI binding
   */
  validateAIBinding(env: CloudflareEnvironment): boolean {
    if (!env.AI) {
      logger.warn('AI binding not available - some features may be limited');
      return false;
    }

    return true;
  },

  /**
   * Complete environment validation
   */
  validateEnvironment(env: CloudflareEnvironment): EnvironmentValidationResult {
    const config = getEnvConfig(env);
    const errors: string[] = [];

    try {
      this.validateRequiredEnv(env, [
        'TRADING_SYMBOLS',
        'LOG_LEVEL',
        'TIMEZONE'
      ]);
    } catch (error: any) {
      errors.push(error.message);
    }

    try {
      this.validateKVBindings(env);
    } catch (error: any) {
      errors.push(error.message);
    }

    try {
      this.validateR2Bindings(env);
    } catch (error: any) {
      errors.push(error.message);
    }

    // AI binding is optional
    const hasAI = this.validateAIBinding(env);

    if (errors.length > 0) {
      throw new Error(`Environment validation failed: ${errors.join('; ')}`);
    }

    return {
      valid: true,
      hasAI,
      config
    };
  }
};

/**
 * Market Data Validation Utilities
 */
export const MarketDataValidation = {
  /**
   * Validate OHLCV data structure
   */
  validateOHLCV(ohlcv: number[][]): number[][] {
    if (!Array.isArray(ohlcv)) {
      throw new Error('OHLCV data must be an array');
    }

    if (ohlcv.length === 0) {
      throw new Error('OHLCV data cannot be empty');
    }

    // Validate each candle
    for (let i = 0; i < ohlcv.length; i++) {
      const candle = ohlcv[i];

      if (!Array.isArray(candle) || candle.length !== 6) {
        throw new Error(`Candle ${i} must have 6 values [timestamp, open, high, low, close, volume]`);
      }

      const [timestamp, open, high, low, close, volume] = candle;

      // Validate timestamp
      if (typeof timestamp !== 'number' || timestamp < 0) {
        throw new Error(`Candle ${i} has invalid timestamp`);
      }

      // Validate price values
      [open, high, low, close].forEach((price: any, idx: any) => {
        if (typeof price !== 'number' || price < 0) {
          const fields = ['open', 'high', 'low', 'close'];
          throw new Error(`Candle ${i} has invalid ${fields[idx]}: ${price}`);
        }
      });

      // Validate price relationships
      if (high < Math.max(open, close)) {
        throw new Error(`Candle ${i}: high must be >= max(open, close)`);
      }

      if (low > Math.min(open, close)) {
        throw new Error(`Candle ${i}: low must be <= min(open, close)`);
      }

      // Validate volume
      if (typeof volume !== 'number' || volume < 0) {
        throw new Error(`Candle ${i} has invalid volume`);
      }
    }

    return ohlcv;
  },

  /**
   * Validate market data response
   */
  validateMarketDataResponse(data: MarketDataResponse): MarketDataResponse {
    if (!data || typeof data !== 'object') {
      throw new Error('Market data response must be an object');
    }

    if (!data.data || typeof data.data !== 'object') {
      throw new Error('Market data response must have a data object');
    }

    if (!data.symbol || typeof data.symbol !== 'string') {
      throw new Error('Market data response must have a symbol');
    }

    if (data.data.ohlcv) {
      this.validateOHLCV(data.data.ohlcv);
    }

    return data;
  }
};

/**
 * Analysis Validation Utilities
 */
export const AnalysisValidation = {
  /**
   * Validate trading signal
   */
  validateTradingSignal(signal: any): TradingSignal {
    if (!signal || typeof signal !== 'object') {
      throw new Error('Trading signal must be an object');
    }

    const required = ['symbol', 'direction', 'current_price', 'confidence'];
    const missing = required.filter(field => !(field in signal));

    if (missing.length > 0) {
      throw new Error(`Trading signal missing required fields: ${missing.join(', ')}`);
    }

    // Validate symbol
    DataValidation.validateSymbol(signal.symbol);

    // Validate direction
    const validDirections = ['BULLISH', 'BEARISH', 'NEUTRAL'];
    if (!validDirections.includes(signal.direction.toUpperCase())) {
      throw new Error(`Invalid direction: ${signal.direction}`);
    }

    // Validate current price
    if (typeof signal.current_price !== 'number' || signal.current_price <= 0) {
      throw new Error('Current price must be a positive number');
    }

    // Validate confidence
    DataValidation.validateConfidence(signal.confidence, 'signal confidence');

    return {
      ...signal,
      symbol: signal.symbol.toUpperCase(),
      direction: signal.direction.toUpperCase()
    };
  },

  /**
   * Validate analysis results
   */
  validateAnalysisResults(results: any): AnalysisResults {
    if (!results || typeof results !== 'object') {
      throw new Error('Analysis results must be an object');
    }

    if (!results.trading_signals || typeof results.trading_signals !== 'object') {
      throw new Error('Analysis results must have trading_signals object');
    }

    // Validate each trading signal
    Object.entries(results.trading_signals).forEach(([symbol, signal]) => {
      this.validateTradingSignal(signal);
    });

    return results as AnalysisResults;
  }
};

/**
 * Validation Result Helper
 */
export class ValidationResult<T = any> {
  public success: boolean;
  public data: T | null;
  public errors: string[];

  constructor(success: boolean, data: T | null = null, errors: string | string[] = []) {
    this.success = success;
    this.data = data;
    this.errors = Array.isArray(errors) ? errors : [errors];
  }

  /**
   * Create successful validation result
   */
  static success<T>(data: T): ValidationResult<T> {
    return new ValidationResult(true, data);
  }

  /**
   * Create failed validation result
   */
  static failure(errors: string | string[]): ValidationResult {
    return new ValidationResult(false, null, errors);
  }

  /**
   * Check if validation passed
   */
  isValid(): boolean {
    return this.success;
  }

  /**
   * Get error messages
   */
  getErrorMessages(): string[] {
    return this.errors.map(error =>
      typeof error === 'object' ? (error as any).message || JSON.stringify(error) : error
    );
  }
}

/**
 * Safe validation wrapper
 */
export function safeValidate<T>(
  validator: (data: any) => T,
  data: any,
  context: Record<string, any> = {}
): ValidationResult<T> {
  try {
    const result = validator(data);
    return ValidationResult.success(result);
  } catch (error: any) {
    logger.warn('Validation failed', {
      error: error.message,
      context,
      data: typeof data === 'object' ? JSON.stringify(data) : data
    });
    return ValidationResult.failure(error.message);
  }
}

export default {
  RequestValidation,
  DataValidation,
  EnvironmentValidation,
  MarketDataValidation,
  AnalysisValidation,
  ValidationResult,
  safeValidate
};
