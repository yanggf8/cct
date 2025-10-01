/**
 * @deprecated This module has been consolidated into dal.ts
 *
 * MIGRATION NOTICE (2025-10-01):
 * ===============================
 * All functionality from kv-storage-manager.js has been moved to dal.ts
 * with enhanced type safety, retry logic, and consistent error handling.
 *
 * Migration Guide:
 * ----------------
 * OLD: import { kvStorageManager } from './kv-storage-manager.js';
 * NEW: import { createDAL } from './dal.js';
 *
 * OLD: await kvStorageManager.storeHighConfidenceSignals(env, date, signals);
 * NEW: const dal = createDAL(env);
 *      await dal.storeHighConfidenceSignals(date, signals);
 *
 * Method Mapping:
 * ---------------
 * kvStorageManager.storeHighConfidenceSignals() → dal.storeHighConfidenceSignals()
 * kvStorageManager.getHighConfidenceSignals()   → dal.getHighConfidenceSignals()
 * kvStorageManager.updateSignalTracking()       → dal.updateSignalTracking()
 * kvStorageManager.getSignalTracking()          → dal.getSignalTracking()
 * kvStorageManager.storeMarketPrices()          → dal.storeMarketPrices()
 * kvStorageManager.getMarketPrices()            → dal.getMarketPrices()
 * kvStorageManager.storeDailyReport()           → dal.storeDailyReport()
 * kvStorageManager.getDailyReport()             → dal.getDailyReport()
 * kvStorageManager.getPerformanceStats()        → dal.getPerformanceStats()
 * kvStorageManager.clearCache()                 → dal.clearCache()
 *
 * Benefits of Migration:
 * ----------------------
 * ✅ Type safety with TypeScript
 * ✅ Automatic retry logic with exponential backoff
 * ✅ Consistent error handling and logging
 * ✅ Better cache management
 * ✅ Unified data access layer
 *
 * This file will be removed in a future release.
 */

console.warn('[DEPRECATED] kv-storage-manager.js is deprecated. Please migrate to dal.ts');

// Re-export from dal.ts for backwards compatibility (temporary)
export { createDAL, TTL_CONFIG } from './dal.js';

// Legacy compatibility wrapper
export class KVStorageManager {
  constructor() {
    console.warn('KVStorageManager is deprecated. Use createDAL() instead.');
  }
}

export const kvStorageManager = new KVStorageManager();

// Export legacy constants for compatibility
export const KV_KEYS = {
  HIGH_CONFIDENCE_SIGNALS: (date) => `high_confidence_signals_${date}`,
  SIGNAL_TRACKING: (date) => `signal_tracking_${date}`,
  SIGNAL_PERFORMANCE: (date) => `signal_performance_${date}`,
  MARKET_PRICES: (symbol) => `market_prices_${symbol}`,
  INTRADAY_DATA: (date) => `intraday_data_${date}`,
  PRE_MARKET_BRIEFING: (date) => `pre_market_briefing_${date}`,
  INTRADAY_CHECK: (date) => `intraday_check_${date}`,
  END_OF_DAY_SUMMARY: (date) => `end_of_day_summary_${date}`,
  WEEKLY_SIGNALS: (weekStart) => `weekly_signals_${weekStart}`,
  WEEKLY_PERFORMANCE: (weekStart) => `weekly_performance_${weekStart}`,
  WEEKLY_REVIEW: (weekStart) => `weekly_review_${weekStart}`,
  SYSTEM_CONFIG: 'system_config',
  PERFORMANCE_METRICS: 'performance_metrics',
  SIGNAL_THRESHOLDS: 'signal_thresholds'
};
