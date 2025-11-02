/**
 * Data Validation Layer for Sector Rotation Analysis
 *
 * Provides comprehensive validation for OHLCV data and other market data
 * Ensures data quality before caching and processing
 *
 * Key Features:
 * - OHLCV bar validation with comprehensive checks
 * - Volume validation with reasonable bounds
 * - Price data consistency validation
 * - Date and timestamp validation
 * - Sector symbol validation
 *
 * @author Sector Rotation Pipeline v1.3
 * @since 2025-10-10
 */

export interface OHLCVBar {
  symbol: string;
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: any;
}

export interface ValidationConfig {
  minPrice: number;
  maxPrice: number;
  minVolume: number;
  maxVolume: number;
  maxPriceChange: number; // Maximum % change in single day
  futureDaysTolerance: number; // Days in future to allow
  staleDataDays: number; // Maximum age of data
}

/**
 * Comprehensive data validation for sector rotation analysis
 */
export class DataValidator {
  private config: ValidationConfig;

  constructor(config?: Partial<ValidationConfig>) {
    this.config = {
      minPrice: 0.01,
      maxPrice: 100000,
      minVolume: 0,
      maxVolume: 1000000000, // 1B shares
      maxPriceChange: 0.5, // 50% max daily change
      futureDaysTolerance: 1, // Allow 1 day in future for timezone differences
      staleDataDays: 7, // Data older than 7 days is stale
      ...config
    };
  }

  /**
   * Validate OHLCV bar with comprehensive checks
   */
  validateOHLCVBar(bar: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    if (!bar || typeof bar !== 'object') {
      errors.push('OHLCV bar must be an object');
      return { isValid: false, errors, warnings };
    }

    // Symbol validation
    if (!bar.symbol || typeof bar.symbol !== 'string') {
      errors.push('Symbol is required and must be a string');
    } else if (!this.isValidSectorSymbol(bar.symbol)) {
      warnings.push(`Symbol ${bar.symbol} is not a recognized sector ETF`);
    }

    // Timestamp validation
    if (!bar.timestamp || typeof bar.timestamp !== 'number') {
      errors.push('Timestamp is required and must be a number');
    } else {
      const timestampValidation = this.validateTimestamp(bar.timestamp);
      errors.push(...timestampValidation.errors);
      warnings.push(...timestampValidation.warnings);
    }

    // Date validation
    if (!bar.date || typeof bar.date !== 'string') {
      errors.push('Date is required and must be a string');
    } else {
      const dateValidation = this.validateDateString(bar.date);
      errors.push(...dateValidation.errors);
      warnings.push(...dateValidation.warnings);
    }

    // Price validation
    const priceFields = ['open', 'high', 'low', 'close'];
    for (const field of priceFields) {
      if (bar[field] === undefined || bar[field] === null) {
        errors.push(`${field} price is required`);
      } else if (typeof bar[field] !== 'number' || isNaN(bar[field])) {
        errors.push(`${field} price must be a valid number`);
      } else if (bar[field] < this.config.minPrice) {
        errors.push(`${field} price ${bar[field]} is below minimum ${this.config.minPrice}`);
      } else if (bar[field] > this.config.maxPrice) {
        errors.push(`${field} price ${bar[field]} is above maximum ${this.config.maxPrice}`);
      }
    }

    // Price consistency validation
    if (bar.open && bar.high && bar.low && bar.close) {
      const priceConsistency = this.validatePriceConsistency(bar);
      errors.push(...priceConsistency.errors);
      warnings.push(...priceConsistency.warnings);
    }

    // Volume validation
    if (bar.volume === undefined || bar.volume === null) {
      errors.push('Volume is required');
    } else if (typeof bar.volume !== 'number' || isNaN(bar.volume)) {
      errors.push('Volume must be a valid number');
    } else {
      const volumeValidation = this.validateVolume(bar.volume);
      errors.push(...volumeValidation.errors);
      warnings.push(...volumeValidation.warnings);
    }

    // Adjusted close validation (optional)
    if (bar.adjustedClose !== undefined && bar.adjustedClose !== null) {
      if (typeof bar.adjustedClose !== 'number' || isNaN(bar.adjustedClose)) {
        errors.push('Adjusted close must be a valid number');
      } else if (bar.adjustedClose < this.config.minPrice) {
        errors.push(`Adjusted close ${bar.adjustedClose} is below minimum ${this.config.minPrice}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: bar
    };
  }

  /**
   * Validate volume with reasonable bounds
   */
  validateVolume(volume: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (volume < this.config.minVolume) {
      errors.push(`Volume ${volume} is below minimum ${this.config.minVolume}`);
    }

    if (volume > this.config.maxVolume) {
      warnings.push(`Volume ${volume} is unusually high (>${this.config.maxVolume})`);
    }

    // Check for negative volume
    if (volume < 0) {
      errors.push('Volume cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: volume
    };
  }

  /**
   * Validate timestamp
   */
  validateTimestamp(timestamp: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const now = Date.now();
    const timestampDate = new Date(timestamp);

    // Check if timestamp is in reasonable range
    if (timestamp < 0) {
      errors.push('Timestamp cannot be negative');
    }

    // Check if timestamp is too far in future
    const daysInFuture = (timestamp - now) / (1000 * 60 * 60 * 24);
    if (daysInFuture > this.config.futureDaysTolerance) {
      errors.push(`Timestamp is ${daysInFuture.toFixed(1)} days in future`);
    } else if (daysInFuture > 0) {
      warnings.push(`Timestamp is ${daysInFuture.toFixed(1)} days in future`);
    }

    // Check if data is stale
    const daysOld = (now - timestamp) / (1000 * 60 * 60 * 24);
    if (daysOld > this.config.staleDataDays) {
      warnings.push(`Data is ${daysOld.toFixed(1)} days old (stale threshold: ${this.config.staleDataDays} days)`);
    }

    // Check for reasonable timestamp (after 1990)
    const minTimestamp = new Date('1990-01-01').getTime();
    if (timestamp < minTimestamp) {
      errors.push('Timestamp is before 1990 (too old for market data)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: timestamp
    };
  }

  /**
   * Validate date string
   */
  validateDateString(dateString: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const date = new Date(dateString);

      if (isNaN(date.getTime())) {
        errors.push(`Invalid date format: ${dateString}`);
        return { isValid: false, errors, warnings };
      }

      // Check for reasonable date format (YYYY-MM-DD preferred)
      const isoFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!isoFormatRegex.test(dateString)) {
        warnings.push(`Date format ${dateString} is not in ISO format (YYYY-MM-DD)`);
      }

      // Validate timestamp consistency
      const timestampValidation = this.validateTimestamp(date.getTime());
      errors.push(...timestampValidation.errors);
      warnings.push(...timestampValidation.warnings);

    } catch (error: unknown) {
      errors.push(`Date parsing error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: dateString
    };
  }

  /**
   * Validate price consistency (OHLC relationships)
   */
  validatePriceConsistency(bar: OHLCVBar): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { open, high, low, close } = bar;

    // High should be >= all other prices
    if (high < open) {
      errors.push(`High (${high}) cannot be less than open (${open})`);
    }
    if (high < close) {
      errors.push(`High (${high}) cannot be less than close (${close})`);
    }
    if (high < low) {
      errors.push(`High (${high}) cannot be less than low (${low})`);
    }

    // Low should be <= all other prices
    if (low > open) {
      errors.push(`Low (${low}) cannot be greater than open (${open})`);
    }
    if (low > close) {
      errors.push(`Low (${low}) cannot be greater than close (${close})`);
    }

    // Check for extreme price changes
    const dayChange = Math.abs(close - open) / open;
    if (dayChange > this.config.maxPriceChange) {
      warnings.push(`Daily change ${((dayChange * 100).toFixed(2))}% exceeds ${((this.config.maxPriceChange * 100).toFixed(2))}% threshold`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: bar
    };
  }

  /**
   * Validate sector symbol
   */
  isValidSectorSymbol(symbol: string): boolean {
    const validSectorSymbols = new Set([
      // SPDR Sector ETFs
      'XLK', // Technology
      'XLV', // Health Care
      'XLF', // Financials
      'XLY', // Consumer Discretionary
      'XLC', // Communication Services
      'XLI', // Industrial
      'XLP', // Consumer Staples
      'XLE', // Energy
      'XLU', // Utilities
      'XLRE', // Real Estate
      'XLB', // Materials
      // Benchmark
      'SPY'  // S&P 500
    ]);

    return validSectorSymbols.has(symbol.toUpperCase());
  }

  /**
   * Validate array of OHLCV bars
   */
  validateOHLCVArray(bars: any[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validBars: OHLCVBar[] = [];

    if (!Array.isArray(bars)) {
      errors.push('Input must be an array');
      return { isValid: false, errors, warnings };
    }

    if (bars.length === 0) {
      errors.push('Array cannot be empty');
      return { isValid: false, errors, warnings };
    }

    bars.forEach((bar: any, index: any) => {
      const validation = this.validateOHLCVBar(bar);
      if (validation.isValid) {
        validBars.push(bar);
      } else {
        errors.push(`Bar ${index}: ${validation.errors.join(', ')}`);
      }
      warnings.push(...validation.warnings.map(w => `Bar ${index}: ${w}`));
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: validBars
    };
  }

  /**
   * Get validation configuration
   */
  getConfig(): ValidationConfig {
    return { ...this.config };
  }

  /**
   * Update validation configuration
   */
  updateConfig(newConfig: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Default validator instance with standard configuration
 */
export const defaultValidator = new DataValidator();

/**
 * Convenience functions for common validation tasks
 */
export function validateOHLCVBar(bar: any): ValidationResult {
  return defaultValidator.validateOHLCVBar(bar);
}

export function validateVolume(volume: number): ValidationResult {
  return defaultValidator.validateVolume(volume);
}

export function validateTimestamp(timestamp: number): ValidationResult {
  return defaultValidator.validateTimestamp(timestamp);
}

export function validateDateString(dateString: string): ValidationResult {
  return defaultValidator.validateDateString(dateString);
}

export function isValidSectorSymbol(symbol: string): boolean {
  return defaultValidator.isValidSectorSymbol(symbol);
}