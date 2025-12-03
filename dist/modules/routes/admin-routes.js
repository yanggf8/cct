/**
 * Admin Route Definitions
 * Handles administrative, debugging, and testing endpoints
 */
import { handleKVDebug, handleKVWriteTest, handleKVReadTest, handleKVGet, handleKVAnalysisWriteTest, handleKVAnalysisReadTest, handleKVVerificationTest, handleStatusManagement, handleBackfillDailySummaries, handleVerifyBackfill, handleGenerateMorningPredictions, handleDebugEnvironment } from '../handlers/index.js';
/**
 * Register all admin and debugging routes
 */
export function registerAdminRoutes(router) {
    // KV debugging
    router.get('/kv-debug', handleKVDebug);
    router.get('/kv-write-test', handleKVWriteTest);
    router.get('/kv-read-test', handleKVReadTest);
    router.get('/kv-get', handleKVGet);
    router.get('/kv-analysis-write-test', handleKVAnalysisWriteTest);
    router.get('/kv-analysis-read-test', handleKVAnalysisReadTest);
    router.get('/kv-verification-test', handleKVVerificationTest);
    // Status management
    router.get('/status-management', handleStatusManagement);
    // Backfill operations
    router.get('/admin/backfill-daily-summaries', handleBackfillDailySummaries);
    router.get('/admin/verify-backfill', handleVerifyBackfill);
    // Data generation
    router.get('/generate-morning-predictions', handleGenerateMorningPredictions);
    // Environment debugging
    router.get('/debug-env', handleDebugEnvironment);
}
//# sourceMappingURL=admin-routes.js.map