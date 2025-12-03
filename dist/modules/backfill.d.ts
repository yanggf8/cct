/**
 * Historical Data Backfill Module
 * Creates daily summaries for historical dates to make system immediately useful
 */
/**
 * Backfill daily summaries for the last N days
 * @param {Object} env - Cloudflare environment
 * @param {number} days - Number of days to backfill (default: 30)
 * @param {boolean} skipExisting - Skip dates that already have summaries (default: true)
 * @returns {Object} Backfill results
 */
export declare function backfillDailySummaries(env: any, days?: number, skipExisting?: boolean): Promise<{
    backfill_date: string;
    days_requested: number;
    total_dates: number;
    processed: number;
    skipped: number;
    failed: number;
    skip_existing: boolean;
    results: any[];
}>;
/**
 * Backfill summaries for trading days only (skip weekends)
 * @param {Object} env - Cloudflare environment
 * @param {number} tradingDays - Number of trading days to backfill
 * @returns {Object} Backfill results
 */
export declare function backfillTradingDaysOnly(env: any, tradingDays?: number): Promise<{
    backfill_date: string;
    trading_days_requested: number;
    trading_days_found: number;
    processed: number;
    failed: number;
    results: any[];
}>;
/**
 * Verify backfill results by checking KV storage
 * @param {Object} env - Cloudflare environment
 * @param {number} days - Number of recent days to verify
 * @returns {Object} Verification results
 */
export declare function verifyBackfill(env: any, days?: number): Promise<{
    verification_date: string;
    days_checked: number;
    found: number;
    missing: number;
    coverage_percentage: number;
    details: any[];
}>;
//# sourceMappingURL=backfill.d.ts.map