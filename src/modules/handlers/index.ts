/**
 * Handler Modules Index
 * Centralized exports for all domain-specific handlers
 */

// Analysis handlers
export {
  handleManualAnalysis,
  handleEnhancedFeatureAnalysis,
  handleIndependentTechnicalAnalysis,
  handlePerSymbolAnalysis,
  handleSentimentTest,
  handleGenerateMorningPredictions,
  handleStatusManagement,
  handleKVVerificationTest
} from './analysis-handlers.js';

// Data and KV handlers (HTTP endpoints)
export {
  handleGetResults,
  handleFactTable,
  handleCronHealth,
  handleKVDebug,
  handleKVWriteTest,
  handleKVReadTest,
  handleKVGet,
  handleKVAnalysisWriteTest,
  handleKVAnalysisReadTest
} from './http-data-handlers.js';

// Health and monitoring handlers
export {
  handleHealthCheck,
  handleModelHealth,
  handleDebugEnvironment
} from './health-handlers.js';

// Weekly review handlers
export {
  handleWeeklyReview
} from './weekly-review-handlers.js';

// Briefing handlers
export {
  handlePreMarketBriefing
} from './briefing-handlers.js';

// Intraday handlers
export {
  handleIntradayCheck
} from './intraday-handlers.js';

// End-of-day handlers
export {
  handleEndOfDaySummary
} from './end-of-day-handlers.js';

// Daily summary and backfill handlers
export {
  handleDailySummaryAPI,
  handleDailySummaryPageRequest,
  handleBackfillDailySummaries,
  handleVerifyBackfill
} from './summary-handlers.js';
