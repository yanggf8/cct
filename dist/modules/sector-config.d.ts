/**
 * Sector Configuration - TypeScript
 * Conservative configuration for sector rotation analysis
 * ZERO dependencies on AI/News APIs - Yahoo Finance data ONLY
 */
export declare const SECTOR_CONFIG: {
    SYMBOLS: string[];
    SECTOR_NAMES: {
        XLK: string;
        XLV: string;
        XLF: string;
        XLY: string;
        XLC: string;
        XLI: string;
        XLP: string;
        XLE: string;
        XLU: string;
        XLRE: string;
        XLB: string;
        SPY: string;
    };
    REFRESH_INTERVALS: {
        MARKET_HOURS: number;
        AFTER_HOURS: number;
        WEEKEND: number;
    };
    CACHE_TTL: {
        L1_MEMORY: number;
        L2_KV: number;
        L3_KV_AFTER_HOURS: number;
    };
    RATE_LIMITING: {
        MAX_CONCURRENT_REQUESTS: number;
        BATCH_DELAY_MS: number;
        RATE_LIMIT_BUFFER: number;
        MAX_RETRIES: number;
        RETRY_DELAY_MS: number;
    };
    TIMEFRAMES: {
        SHORT: string;
        MEDIUM: string;
        LONG: string;
    };
    INDICATORS: {
        OBV: number;
        CMF: number;
        MOMENTUM: number;
        RELATIVE_STRENGTH: number;
    };
    QUADRANT_THRESHOLDS: {
        RS_PERFORMANCE: number;
        MOMENTUM_POSITIVE: number;
        MIN_VOLUME: number;
        STALE_DATA_MINUTES: number;
    };
    VALIDATION: {
        MIN_PRICE: number;
        MAX_PRICE_CHANGE: number;
        MIN_VOLUME: number;
        MAX_SPREAD_BPS: number;
    };
    PERFORMANCE: {
        MAX_FETCH_TIME_MS: number;
        MAX_CALCULATION_TIME_MS: number;
        CACHE_HIT_RATE_TARGET: number;
        SUCCESS_RATE_TARGET: number;
    };
};
export default SECTOR_CONFIG;
//# sourceMappingURL=sector-config.d.ts.map