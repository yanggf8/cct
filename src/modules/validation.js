/**
 * Data Validation Layer
 * Provides comprehensive input validation and sanitization for trading system
 */

import { createLogger } from './logging.js';

const logger = createLogger('validation');

/**
 * Validation Error Class
 */
export class ValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Symbol Validation
 */
export function validateSymbol(symbol) {
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
export function validateSymbols(symbols) {
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
export function validateMarketData(marketData) {
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
      throw new ValidationError(`Inconsistent OHLC values at index ${i}`, 'ohlcv.consistency', candle);
    }
  }

  return marketData;
}

/**
 * Analysis Data Validation
 */
export function validateAnalysisData(analysisData) {
  if (!analysisData || typeof analysisData !== 'object') {
    throw new ValidationError('Analysis data must be an object', 'analysisData', analysisData);
  }

  if (!analysisData.symbols_analyzed || !Array.isArray(analysisData.symbols_analyzed)) {
    throw new ValidationError('Analysis data missing symbols_analyzed array', 'symbols_analyzed', analysisData.symbols_analyzed);
  }

  if (!analysisData.trading_signals || typeof analysisData.trading_signals !== 'object') {
    throw new ValidationError('Analysis data missing trading_signals object', 'trading_signals', analysisData.trading_signals);
  }

  // Validate each symbol has corresponding trading signals
  for (const symbol of analysisData.symbols_analyzed) {
    if (!analysisData.trading_signals[symbol]) {
      throw new ValidationError(`Missing trading signals for symbol ${symbol}`, 'trading_signals', symbol);
    }
  }

  return analysisData;
}

/**
 * Confidence Score Validation
 */
export function validateConfidence(confidence) {
  if (typeof confidence !== 'number') {
    throw new ValidationError('Confidence must be a number', 'confidence', confidence);
  }

  if (confidence < 0 || confidence > 1) {
    throw new ValidationError('Confidence must be between 0 and 1', 'confidence', confidence);
  }

  return confidence;
}

/**
 * Date Validation
 */
export function validateDate(date) {
  if (!date) {
    throw new ValidationError('Date is required', 'date', date);
  }

  let validDate;
  if (typeof date === 'string') {
    validDate = new Date(date);
  } else if (date instanceof Date) {
    validDate = date;
  } else {
    throw new ValidationError('Date must be a string or Date object', 'date', date);
  }

  if (isNaN(validDate.getTime())) {
    throw new ValidationError('Invalid date format', 'date', date);
  }

  // Check if date is too far in the past or future
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  if (validDate < oneYearAgo || validDate > oneYearFromNow) {
    throw new ValidationError('Date must be within one year of current date', 'date', date);
  }

  return validDate;
}

/**
 * KV Key Validation
 */
export function validateKVKey(key) {
  if (!key || typeof key !== 'string') {
    throw new ValidationError('KV key must be a non-empty string', 'key', key);
  }

  const cleanKey = key.trim();

  if (cleanKey.length === 0) {
    throw new ValidationError('KV key cannot be empty', 'key', key);
  }

  if (cleanKey.length > 512) {
    throw new ValidationError('KV key too long (max 512 characters)', 'key', key);
  }

  // Basic key format validation
  if (!/^[a-zA-Z0-9_.-]+$/.test(cleanKey)) {
    throw new ValidationError('KV key contains invalid characters', 'key', key);
  }

  return cleanKey;
}

/**
 * Environment Variables Validation
 */
export function validateEnvironment(env) {
  if (!env || typeof env !== 'object') {
    throw new ValidationError('Environment must be an object', 'env', env);
  }

  // Validate required bindings
  if (!env.TRADING_RESULTS) {
    throw new ValidationError('Missing TRADING_RESULTS KV binding', 'env.TRADING_RESULTS', env.TRADING_RESULTS);
  }

  if (!env.AI) {
    throw new ValidationError('Missing AI binding', 'env.AI', env.AI);
  }

  return env;
}

/**
 * HTTP Request Validation
 */
export function validateRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new ValidationError('Request must be an object', 'request', request);
  }

  if (!request.method || typeof request.method !== 'string') {
    throw new ValidationError('Request missing method', 'request.method', request.method);
  }

  if (!request.url || typeof request.url !== 'string') {
    throw new ValidationError('Request missing URL', 'request.url', request.url);
  }

  return request;
}

/**
 * Sanitize HTML Content
 */
export function sanitizeHTML(html) {
  if (typeof html !== 'string') {
    throw new ValidationError('HTML content must be a string', 'html', html);
  }

  // Basic HTML sanitization - remove dangerous elements
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '') // Remove event handlers
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

/**
 * Validate and sanitize user input
 */
export function validateUserInput(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    throw new ValidationError('Input must be a string', 'input', input);
  }

  const sanitized = input.trim();

  if (sanitized.length > maxLength) {
    throw new ValidationError(`Input too long (max ${maxLength} characters)`, 'input.length', sanitized.length);
  }

  // Remove potentially dangerous characters
  return sanitized.replace(/[<>\"'&]/g, '');
}

/**
 * Safe validation wrapper that logs errors
 */
export function safeValidate(validationFn, data, fallback = null) {
  try {
    return validationFn(data);
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.warn('Validation failed', {
        field: error.field,
        value: error.value,
        message: error.message
      });
    } else {
      logger.error('Unexpected validation error', { error: error.message });
    }
    return fallback;
  }
}

/**
 * Validate trading system configuration
 */
export function validateTradingConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new ValidationError('Config must be an object', 'config', config);
  }

  if (config.TRADING_SYMBOLS) {
    const symbols = config.TRADING_SYMBOLS.split(',').map(s => s.trim());
    validateSymbols(symbols);
  }

  if (config.LOG_LEVEL && !['error', 'warn', 'info', 'debug'].includes(config.LOG_LEVEL)) {
    throw new ValidationError('Invalid log level', 'LOG_LEVEL', config.LOG_LEVEL);
  }

  return config;
}