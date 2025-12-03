import type { CloudflareEnvironment } from '../types.js';
interface AnalysisOptions {
    includeTechnical?: boolean;
    timeHorizon?: string;
    confidenceThreshold?: number;
}
interface AnalysisMetadata {
    request_timestamp: string;
    analysis_type: string;
    options_used: AnalysisOptions;
    processing_complete: boolean;
}
interface HealthData {
    success: boolean;
    status: string;
    message: string;
    services: {
        web_notifications: string;
        ai_models: string;
        data_sources: string;
    };
}
interface KVTestResult {
    success: boolean;
    operation: string;
    test_key?: string;
    written_data?: any;
    read_data?: any;
    key?: string;
    found?: boolean;
    value?: any;
    raw_value_length?: number;
    kv_binding: string;
    message?: string;
    error?: string;
    stack?: string;
    note?: string;
    timestamp: string;
}
interface ModelHealthResult {
    timestamp: string;
    enhanced_models_bucket: string;
    r2_binding: {
        enhanced_models: boolean;
        trained_models: boolean;
        binding_types: {
            enhanced: string;
            trained: string;
        };
    };
    model_files: {
        [key: string]: any;
    };
    bucket_contents: Array<{
        key: string;
        size: number;
        modified: string;
    }>;
    errors: string[];
    health_score?: string;
    overall_status?: string;
}
interface FacebookTestResult {
    timestamp: string;
    test_execution_id: string;
    facebook_configured: boolean;
    message_tests: {
        [key: string]: any;
    };
    kv_logs: {
        [key: string]: any;
    };
    errors: string[];
    overall_success: boolean;
    summary?: {
        total_tests: number;
        successful_tests: number;
        failed_tests: number;
        success_rate: string;
    };
}
interface DailySummaryResponse {
    success: boolean;
    date: string;
    data: any;
    api_version: string;
    timestamp: string;
}
interface BackfillResponse {
    success: boolean;
    backfill_result?: any;
    verification_result?: any;
    parameters?: {
        days?: number;
        skip_existing?: boolean;
        trading_days_only?: boolean;
        days_checked?: number;
    };
    timestamp: string;
    error?: string;
}
/**
 * Handle manual analysis requests (Phase 1: Enhanced with sentiment)
 */
export declare function handleManualAnalysis(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle get results requests
 */
export declare function handleGetResults(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle health check requests
 */
export declare function handleHealthCheck(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle Enhanced Feature Analysis requests (Neural Networks + 33 Technical Indicators + Sentiment)
 */
export declare function handleEnhancedFeatureAnalysis(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle Independent Technical Analysis requests (33 Technical Indicators Only)
 */
export declare function handleIndependentTechnicalAnalysis(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle Facebook test requests
 */
export declare function handleFacebookTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle weekly report requests
 */
export declare function handleWeeklyReport(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle Friday market close report
 */
export declare function handleFridayMarketCloseReport(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle other endpoints with simple responses
 */
export declare function handleFridayMondayPredictionsReport(request: Request, env: CloudflareEnvironment): Promise<Response>;
export declare function handleHighConfidenceTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
export declare function handleFactTable(request: Request, env: CloudflareEnvironment): Promise<Response>;
export declare function handleKVCleanup(request: Request, env: CloudflareEnvironment): Promise<Response>;
export declare function handleDebugWeekendMessage(request: Request, env: CloudflareEnvironment): Promise<Response>;
export declare function handleKVGet(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle KV debug - test KV writing functionality
 */
export declare function handleKVDebug(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle KV write test - ONLY test KV writing functionality
 */
export declare function handleKVWriteTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle KV read test - ONLY test KV reading functionality
 */
export declare function handleKVReadTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle sentiment enhancement testing (Phase 1 validation)
 */
export declare function handleSentimentTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Test Cloudflare AI Llama models
 */
export declare function handleTestLlama(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Debug environment variables and API keys
 */
export declare function handleDebugEnvironment(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Test ModelScope API with parameter-provided key
 */
export declare function handleModelScopeTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Public Sentiment Analysis System test
 */
export declare function handleSentimentDebugTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle model health check - verify R2 model files accessibility
 */
export declare function handleModelHealth(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle R2 upload for enhanced model files
 */
export declare function handleR2Upload(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Test All 5 Facebook Message Types (with comprehensive logging)
 */
export declare function handleTestAllFacebookMessages(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle cron health monitoring requests
 */
export declare function handleCronHealth(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle per-symbol fine-grained analysis requests
 */
export declare function handlePerSymbolAnalysis(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle daily summary API requests
 * Provides JSON data for daily summary pages
 */
export declare function handleDailySummaryAPI(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle historical data backfill requests (admin endpoint)
 */
export declare function handleBackfillDailySummaries(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle backfill verification requests (admin endpoint)
 */
export declare function handleVerifyBackfill(request: Request, env: CloudflareEnvironment): Promise<Response>;
export type { AnalysisOptions, AnalysisMetadata, HealthData, KVTestResult, ModelHealthResult, FacebookTestResult, DailySummaryResponse, BackfillResponse };
//# sourceMappingURL=handlers.d.ts.map