/**
 * Data Validation Layer
 * Provides comprehensive input validation and sanitization for trading system
 */

import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('validation');

// Type definitions
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
export class ValidationError extends Error {
  public field: string;
  public value: any;

  constructor(message: string, field: string, value: any) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Symbol Validation
 */
export function validateSymbol(symbol: any): string {
  if (!symbol || typeof symbol !== 'string') {
    throw new ValidationError('Symbol must be a non-empty string', 'symbol', symbol);
  }

  const cleanSymbol = symbol.trim().toUpperCase();

  // Basic symbol format validation
  if (!/^[A-Z]{1,5}$/.test(cleanSymbol)) {
    throw new ValidationError('Symbol must be 1-5 uppercase letters', 'symbol', symbol);
  }

  return cleanSymbol;
}

/**
 * Symbols Array Validation
 */
export function validateSymbols(symbols: any): string[] {
  if (!Array.isArray(symbols)) {
    throw new ValidationError('Symbols must be an array', 'symbols', symbols);
  }

  if (symbols.length === 0) {
    throw new ValidationError('Symbols array cannot be empty', 'symbols', symbols);
  }

  if (symbols.length > 10) {
    throw new ValidationError('Too many symbols (max 10)', 'symbols', symbols);
  }

  return symbols.map(symbol => validateSymbol(symbol));
}

/**
 * Market Data Validation
 */
export function validateMarketData(marketData: any): MarketDataResponse {
  if (!marketData || typeof marketData !== 'object') {
    throw new ValidationError('Market data must be an object', 'marketData', marketData);
  }

  if (!marketData.success) {
    throw new ValidationError('Market data indicates failure', 'marketData.success', marketData.success);
  }

  if (!marketData.data || !marketData.data.ohlcv) {
    throw new ValidationError('Market data missing OHLCV data', 'marketData.data.ohlcv', marketData.data);
  }

  if (!Array.isArray(marketData.data.ohlcv) || marketData.data.ohlcv.length < 10) {
    throw new ValidationError('Insufficient OHLCV data (minimum 10 points)', 'marketData.data.ohlcv.length', marketData.data.ohlcv?.length);
  }

  // Validate OHLCV structure
  for (let i = 0; i < Math.min(3, marketData.data.ohlcv.length); i++) {
    const candle = marketData.data.ohlcv[i];
    if (!Array.isArray(candle) || candle.length < 5) {
      throw new ValidationError(`Invalid OHLCV candle structure at index ${i}`, 'ohlcv.candle', candle);
    }

    const [open, high, low, close, volume] = candle;
    if (typeof open !== 'number' || typeof high !== 'number' ||
        typeof low !== 'number' || typeof close !== 'number' ||
        typeof volume !== 'number') {
      throw new ValidationError(`Invalid OHLCV data types at index ${i}`, 'ohlcv.types', candle);
    }

    if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) {
      throw new ValidationError(`Invalid OHLCV values at index ${i}`, 'ohlcv.values', candle);
    }

    if (high < Math.max(open, close) || low > Math.min(open, close)) {
      throw new ValidationError(`Inconsistent OHLCV values at index ${i}`, 'ohlcv.consistency', candle);
    }
  }

  return marketData as MarketDataResponse;
}

/**
 * Number Range Validation
 */
export function validateNumberRange(
  value: any,
  field: string,
  min: number,
  max: number
): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${field} must be a valid number`, field, value);
  }

  if (value < min || value > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max}`, field, value);
  }

  return value;
}

/**
 * Percentage Validation (0-100)
 */
export function validatePercentage(value: any, field: string): number {
  return validateNumberRange(value, field, 0, 100);
}

/**
 * Confidence Threshold Validation
 */
export function validateConfidenceThreshold(value: any, field: string): number {
  return validateNumberRange(value, field, 0, 1);
}

/**
 * Date Validation
 */
export function validateDate(date: any): Date {
  if (typeof date !== 'string' && !(date instanceof Date)) {
    throw new ValidationError('Date must be a string or Date object', 'date', date);
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    throw new ValidationError('Invalid date format', 'date', date);
  }

  return parsedDate;
}

/**
 * Optional Field Validation
 */
export function validateOptionalField<T>(
  value: any,
  validator: (val: any) => T,
  field: string
): T | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  try {
    return validator(value);
  } catch (error: unknown) {
    throw new ValidationError(`Invalid ${field}: ${error.message}`, field, value);
  }
}

/**
 * Request Body Validation
 */
export function validateRequestBody(body: any, requiredFields: string[] = []): Record<string, any> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a valid object', 'body', body);
  }

  const validated: Record<string, any> = {};

  for (const field of requiredFields) {
    if (!(field in body)) {
      throw new ValidationError(`Missing required field: ${field}`, field, undefined);
    }
    validated[field] = body[field];
  }

  return { ...validated, ...body };
}

/**
 * API Key Validation
 */
export function validateApiKey(apiKey: any, validKeys: string[] = ['yanggf', 'demo', 'test']): string {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new ValidationError('API key must be provided', 'apiKey', apiKey);
  }

  if (!validKeys.includes(apiKey)) {
    throw new ValidationError('Invalid API key', 'apiKey', apiKey);
  }

  return apiKey;
}

/**
 * Array Validation with Type Checking
 */
export function validateArray<T>(
  value: any,
  itemValidator: (item: any) => T,
  field: string,
  options: {
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
  } = {}
): T[] {
  const { minLength = 0, maxLength = 100, allowEmpty = false } = options;

  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be an array`, field, value);
  }

  if (!allowEmpty && value.length === 0) {
    throw new ValidationError(`${field} array cannot be empty`, field, value);
  }

  if (value.length < minLength) {
    throw new ValidationError(`${field} array too short (min ${minLength} items)`, field, value);
  }

  if (value.length > maxLength) {
    throw new ValidationError(`${field} array too long (max ${maxLength} items)`, field, value);
  }

  return value.map((item: any, index: any) => {
    try {
      return itemValidator(item);
    } catch (error: any) {
      throw new ValidationError(`Invalid item at index ${index} in ${field}: ${error.message}`, `${field}[${index}]`, item);
    }
  });
}

// Export types for external use
export type {
  OHLCVCandle,
  MarketDataResponse
};

/**
 * Validate Cloudflare Environment
 */
export function validateEnvironment(env: CloudflareEnvironment): void {
  if (!env) {
    throw new ValidationError('Environment object is required', 'env', env);
  }

  if (!env.TRADING_RESULTS) {
    throw new ValidationError('TRADING_RESULTS KV namespace is required', 'env.TRADING_RESULTS', env.TRADING_RESULTS);
  }

  // Optional validations
  if (env.FMP_API_KEY && typeof env.FMP_API_KEY !== 'string') {
    throw new ValidationError('FMP_API_KEY must be a string', 'env.FMP_API_KEY', typeof env.FMP_API_KEY);
  }

  if (env.NEWSAPI_KEY && typeof env.NEWSAPI_KEY !== 'string') {
    throw new ValidationError('NEWSAPI_KEY must be a string', 'env.NEWSAPI_KEY', typeof env.NEWSAPI_KEY);
  }
}

/**
 * Validate Request Object
 */
export function validateRequest(request: Request): void {
  if (!request) {
    throw new ValidationError('Request object is required', 'request', request);
  }

  if (!(request instanceof Request)) {
    throw new ValidationError('Invalid request object', 'request', typeof request);
  }
}

/**
 * Validate KV Key Format
 */
export function validateKVKey(key: string): string {
  if (!key || typeof key !== 'string') {
    throw new ValidationError('KV key must be a non-empty string', 'key', key);
  }

  // Basic key format validation
  if (key.length > 512) {
    throw new ValidationError('KV key too long (max 512 characters)', 'key', key);
  }

  // Prevent invalid characters that could cause KV issues
  if (/[<>:"\\|?*]/.test(key)) {
    throw new ValidationError('KV key contains invalid characters', 'key', key);
  }

  return key.trim();
}

/**
 * Safe Validation Wrapper - returns error message instead of throwing
 */
export function safeValidate<T>(
  value: any,
  validator: (val: any) => T,
  context: string = 'validation'
): { success: boolean; result?: T; error?: string } {
  try {
    const result = validator(value);
    return { success: true, result };
  } catch (error: any) {
    logger.warn(`Safe validation failed for ${context}`, {
      error: error.message,
      value: value
    });
    return { success: false, error: error.message };
  }
}