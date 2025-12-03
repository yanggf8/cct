/**
 * Timezone Utilities Module
 * Standardizes all date operations to EST/EDT for trading data consistency
 */
/**
 * Get current date in EST/EDT timezone as YYYY-MM-DD string
 */
export declare function getCurrentDateEST(): string;
/**
 * Get current datetime in EST/EDT timezone as ISO string
 */
export declare function getCurrentDateTimeEST(): string;
/**
 * Validate and normalize date parameter from API requests
 */
export declare function validateDateParameter(dateStr?: string): string;
/**
 * Convert a date string to EST timezone for display
 */
export declare function formatDateForDisplay(dateStr: string): string;
/**
 * Get yesterday's date in EST/EDT timezone
 */
export declare function getYesterdayEST(): string;
/**
 * Get array of date strings for the last N days (including today)
 */
export declare function getLastNDaysEST(days: number): string[];
/**
 * Get KV key for daily summary
 */
export declare function getDailySummaryKVKey(date: string): string;
/**
 * Get KV key for daily analysis
 */
export declare function getDailyAnalysisKVKey(date: string): string;
/**
 * Check if a date is a trading day (weekdays, excluding holidays)
 * Simple implementation - checks if it's a weekday
 */
export declare function isTradingDay(dateStr: string): boolean;
//# sourceMappingURL=timezone-utils.d.ts.map