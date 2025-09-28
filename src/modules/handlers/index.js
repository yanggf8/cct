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
  handleGenerateMorningPredictions
} from './analysis-handlers.js';

// Data and KV handlers
export {
  handleGetResults,
  handleFactTable,
  handleCronHealth,
  handleKVDebug,
  handleKVWriteTest,
  handleKVReadTest,
  handleKVGet
} from './data-handlers.js';

// Health and monitoring handlers
export {
  handleHealthCheck,
  handleModelHealth,
  handleDebugEnvironment
} from './health-handlers.js';

// Facebook and social media handlers
export {
  handleFacebookTest,
  handleTestAllFacebookMessages,
  handleWeeklyReport,
  handleFridayMarketCloseReport
} from './facebook-handlers.js';

// Daily summary and backfill handlers
export {
  handleDailySummaryAPI,
  handleDailySummaryPageRequest,
  handleBackfillDailySummaries,
  handleVerifyBackfill
} from './summary-handlers.js';