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
    maxPriceChange: number;
    futureDaysTolerance: number;
    staleDataDays: number;
}
/**
 * Comprehensive data validation for sector rotation analysis
 */
export declare class DataValidator {
    private config;
    constructor(config?: Partial<ValidationConfig>);
    /**
     * Validate OHLCV bar with comprehensive checks
     */
    validateOHLCVBar(bar: any): ValidationResult;
    /**
     * Validate volume with reasonable bounds
     */
    validateVolume(volume: number): ValidationResult;
    /**
     * Validate timestamp
     */
    validateTimestamp(timestamp: number): ValidationResult;
    /**
     * Validate date string
     */
    validateDateString(dateString: string): ValidationResult;
    /**
     * Validate price consistency (OHLC relationships)
     */
    validatePriceConsistency(bar: OHLCVBar): ValidationResult;
    /**
     * Validate sector symbol
     */
    isValidSectorSymbol(symbol: string): boolean;
    /**
     * Validate array of OHLCV bars
     */
    validateOHLCVArray(bars: any[]): ValidationResult;
    /**
     * Get validation configuration
     */
    getConfig(): ValidationConfig;
    /**
     * Update validation configuration
     */
    updateConfig(newConfig: Partial<ValidationConfig>): void;
}
/**
 * Default validator instance with standard configuration
 */
export declare const defaultValidator: DataValidator;
/**
 * Convenience functions for common validation tasks
 */
export declare function validateOHLCVBar(bar: any): ValidationResult;
export declare function validateVolume(volume: number): ValidationResult;
export declare function validateTimestamp(timestamp: number): ValidationResult;
export declare function validateDateString(dateString: string): ValidationResult;
export declare function isValidSectorSymbol(symbol: string): boolean;
//# sourceMappingURL=data-validation.d.ts.map