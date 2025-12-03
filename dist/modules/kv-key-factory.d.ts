/**
 * KV Key Factory Module - TypeScript
 * Type-safe, centralized key management for all KV operations with standardized naming conventions
 */
/**
 * Key Types Enumeration
 */
export declare const KeyTypes: {
    readonly ANALYSIS: "analysis";
    readonly DUAL_AI_ANALYSIS: "dual_ai_analysis";
    readonly LEGACY_ANALYSIS: "legacy_analysis";
    readonly MANUAL_ANALYSIS: "manual_analysis";
    readonly JOB_STATUS: "job_status";
    readonly PIPELINE_STATUS: "pipeline_status";
    readonly DEPENDENCY_STATUS: "dependency_status";
    readonly SYSTEM_METADATA: "system_metadata";
    readonly JOB_METADATA: "job_metadata";
    readonly PERFORMANCE_METADATA: "performance_metadata";
    readonly DAILY_SUMMARY: "daily_summary";
    readonly MORNING_PREDICTIONS: "morning_predictions";
    readonly INTRADAY_PERFORMANCE: "intraday_performance";
    readonly END_OF_DAY_SUMMARY: "end_of_day_summary";
    readonly WEEKLY_REVIEW: "weekly_review";
    readonly FACEBOOK_MANIFEST: "facebook_manifest";
    readonly FACEBOOK_STATUS: "facebook_status";
    readonly FACEBOOK_DELIVERY: "facebook_delivery";
    readonly TEST_DATA: "test_data";
    readonly DEBUG_DATA: "debug_data";
    readonly VERIFICATION: "verification";
    readonly MARKET_DATA_CACHE: "market_data_cache";
    readonly REPORT_CACHE: "report_cache";
    readonly TEMPORARY: "temporary";
    readonly SECTOR_DATA: "sector_data";
    readonly SECTOR_SNAPSHOT: "sector_snapshot";
    readonly SECTOR_INDICATORS: "sector_indicators";
    readonly SECTOR_PERFORMANCE: "sector_performance";
    readonly SECTOR_RELATIVE_STRENGTH: "sector_relative_strength";
    readonly MARKET_DRIVERS_SNAPSHOT: "market_drivers_snapshot";
    readonly MARKET_DRIVERS_MACRO: "market_drivers_macro";
    readonly MARKET_DRIVERS_MARKET_STRUCTURE: "market_drivers_market_structure";
    readonly MARKET_DRIVERS_GEOPOLITICAL: "market_drivers_geopolitical";
    readonly MARKET_DRIVERS_REGIME: "market_drivers_regime";
    readonly MARKET_DRIVERS_HISTORY: "market_drivers_history";
    readonly MARKET_DRIVERS_FRED_DATA: "market_drivers_fred_data";
    readonly MARKET_DRIVERS_RISK_ASSESSMENT: "market_drivers_risk_assessment";
};
export type KeyType = typeof KeyTypes[keyof typeof KeyTypes];
/**
 * Parsed key information
 */
export interface ParsedKey {
    type: string;
    matches: string[];
}
/**
 * Key information
 */
export interface KeyInfo {
    key: string;
    type: string;
    inferredType: KeyType;
    length: number;
    ttl: number;
    hasDate: boolean;
    hasTimestamp: boolean;
    isDateBased: boolean;
}
/**
 * KV Options
 */
export interface KVOptions {
    expirationTtl?: number;
    expiration?: number;
    metadata?: Record<string, any>;
}
/**
 * KV Key Factory Class
 */
export declare class KVKeyFactory {
    /**
     * Generate a key for a specific type with parameters
     */
    static generateKey(keyType: KeyType, params?: Record<string, any>): string;
    /**
     * Generate date-based keys with automatic date handling
     */
    static generateDateKey(keyType: KeyType, date?: Date | string | null, additionalParams?: Record<string, any>): string;
    /**
     * Generate keys for job status tracking
     */
    static generateJobStatusKey(jobName: string, date?: Date | string | null): string;
    /**
     * Generate keys for pipeline status tracking
     */
    static generatePipelineStatusKey(pipelineName: string, timestamp?: number | null): string;
    /**
     * Generate keys for Facebook messaging
     */
    static generateFacebookKey(messageType: string, date?: Date | string | null, messageId?: string | null): string;
    /**
     * Generate keys for Market Drivers data
     */
    static generateMarketDriversKey(dataType: string, date?: Date | string | null, additionalParams?: Record<string, any>): string;
    /**
     * Generate test keys for health checks
     */
    static generateTestKey(component: string): string;
    /**
     * Get TTL for a specific key type
     */
    static getTTL(keyType: KeyType): number;
    /**
     * Parse a key to extract its components
     */
    static parseKey(key: string): ParsedKey;
    /**
     * Get all keys for a specific date range
     */
    static generateDateRangeKeys(keyType: KeyType, startDate: Date | string, endDate: Date | string): string[];
    /**
     * Sanitize values for use in keys
     */
    static sanitizeValue(value: any): string;
    /**
     * Validate key format
     */
    static validateKey(key: string): void;
    /**
     * Get key statistics and information
     */
    static getKeyInfo(key: string): KeyInfo;
    /**
     * Infer key type from key pattern
     */
    static inferKeyType(key: string): KeyType;
}
/**
 * Helper functions for common key operations
 */
export declare const KeyHelpers: {
    /**
     * Get today's analysis key
     */
    getTodayAnalysisKey: () => string;
    /**
     * Get today's dual AI analysis key
     */
    getTodayDualAIKey: () => string;
    /**
     * Get today's Facebook manifest key
     */
    getTodayFacebookManifestKey: () => string;
    /**
     * Get job status key for today
     */
    getJobStatusKey: (jobName: string) => string;
    /**
     * Get Facebook message key for today
     */
    getFacebookKey: (messageType: string) => string;
    /**
     * Sector Rotation Helper Functions (NEW - Rovodev production fixes)
     */
    /**
     * Get sector data key for symbol
     */
    getSectorDataKey: (symbol: string, timestamp?: number) => string;
    /**
     * Get sector snapshot key for date
     */
    getSectorSnapshotKey: (date?: Date | string) => string;
    /**
     * Get sector indicators key for symbol and date
     */
    getSectorIndicatorsKey: (symbol: string, date?: Date | string) => string;
    /**
     * Get sector performance key for date
     */
    getSectorPerformanceKey: (date?: Date | string) => string;
    /**
     * Get sector relative strength key for symbol and date
     */
    getSectorRelativeStrengthKey: (symbol: string, date?: Date | string) => string;
    /**
     * Get TTL options for KV operations
     */
    getKVOptions: (keyType: KeyType, additionalOptions?: KVOptions) => KVOptions;
    /**
     * Market Drivers Helper Functions (NEW - Phase 2 implementation)
     */
    /**
     * Get market drivers snapshot key for date
     */
    getMarketDriversSnapshotKey: (date?: Date | string) => string;
    /**
     * Get market drivers macro data key for date
     */
    getMarketDriversMacroKey: (date?: Date | string) => string;
    /**
     * Get market drivers market structure key for date
     */
    getMarketDriversMarketStructureKey: (date?: Date | string) => string;
    /**
     * Get market drivers geopolitical risk key for date
     */
    getMarketDriversGeopoliticalKey: (date?: Date | string) => string;
    /**
     * Get market drivers regime analysis key for date
     */
    getMarketDriversRegimeKey: (date?: Date | string) => string;
    /**
     * Get market drivers history key for date and regime type
     */
    getMarketDriversHistoryKey: (date: Date | string, regimeType: string) => string;
    /**
     * Get FRED data key for series and date
     */
    getMarketDriversFredDataKey: (series: string, date?: Date | string) => string;
    /**
     * Get market drivers risk assessment key for date
     */
    getMarketDriversRiskAssessmentKey: (date?: Date | string) => string;
};
export default KVKeyFactory;
//# sourceMappingURL=kv-key-factory.d.ts.map