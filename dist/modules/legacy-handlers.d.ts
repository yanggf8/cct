/**
 * Legacy HTTP Request Handlers Module
 * Contains handlers that haven't been modularized yet
 * Extracted from handlers.js for TypeScript migration
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Handle Friday/Monday predictions report
 */
export declare function handleFridayMondayPredictionsReport(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle Friday market close report
 */
export declare function handleFridayMarketCloseReport(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle high confidence test
 */
export declare function handleHighConfidenceTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle KV cleanup operations
 */
export declare function handleKVCleanup(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle debug weekend message
 */
export declare function handleDebugWeekendMessage(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle sentiment debug test
 */
export declare function handleSentimentDebugTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle model scope test
 */
export declare function handleModelScopeTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle Llama test
 */
export declare function handleTestLlama(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle R2 upload operations
 */
export declare function handleR2Upload(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle Facebook test (legacy, migrated to web notifications)
 */
export declare function handleFacebookTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
//# sourceMappingURL=legacy-handlers.d.ts.map