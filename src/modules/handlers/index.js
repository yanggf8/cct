/**
 * Handler Modules Index
 * Centralized exports for all domain-specific handlers
 */

// Common handler patterns and utilities
export {
  createReportHandler,
  createAPIHandler,
  createDataRetrievalHandler,
  createStandardMetrics,
  createDashboardLayout,
  validateRequestEnvironment
} from './common-handlers.js';

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

// Weekly report handlers (non-Facebook)
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

// Web notification handlers (replaces Facebook integration)
export {
  handleNotificationSubscription,
  handleNotificationUnsubscription,
  handleNotificationPreferences,
  handleNotificationHistory,
  handleTestNotification,
  handleNotificationStatus
} from './web-notification-handlers.js';

// Daily summary and backfill handlers
export {
  handleDailySummaryAPI,
  handleDailySummaryPageRequest,
  handleBackfillDailySummaries,
  handleVerifyBackfill
} from './summary-handlers.js';

// Refactored handler examples
export {
  handleIntradayCheckRefactored,
  handleIntradayCheckEnhanced
} from './intraday-refactored.js';

// Decomposed handler examples (replaces 932-line monolithic file)
export {
  handleIntradayCheckDecomposed,
  handleIntradayCheckConsistent
} from './intraday-decomposed.js';

// Professional dashboard handlers
export {
  handleProfessionalDashboard
} from './dashboard-handlers.js';