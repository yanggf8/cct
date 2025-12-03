/**
 * Report Route Definitions
 * Handles all comprehensive trading report endpoints
 */
import { handlePreMarketBriefing } from '../handlers/briefing-handlers.js';
import { handleIntradayCheck } from '../handlers/intraday-handlers.js';
import { handleEndOfDaySummary } from '../handlers/end-of-day-handlers.js';
import { handleWeeklyReview } from '../handlers/weekly-review-handlers.js';
import { handleWeeklyAnalysisPage, handleWeeklyDataAPI } from '../weekly-analysis.js';
import { handleDailySummaryAPI, handleDailySummaryPageRequest } from '../handlers/index.js';
/**
 * Register all report routes
 */
export function registerReportRoutes(router) {
    // 4 Moment Comprehensive Reports
    router.get('/pre-market-briefing', handlePreMarketBriefing);
    router.get('/intraday-check', handleIntradayCheck);
    router.get('/end-of-day-summary', handleEndOfDaySummary);
    router.get('/weekly-review', handleWeeklyReview);
    // Legacy weekly analysis
    router.get('/weekly-analysis', handleWeeklyAnalysisPage);
    // Data APIs
    router.get('/api/weekly-data', handleWeeklyDataAPI);
    router.get('/api/daily-summary', handleDailySummaryAPI);
    // Daily summary dashboard
    router.get('/daily-summary', handleDailySummaryPageRequest);
}
//# sourceMappingURL=report-routes.js.map