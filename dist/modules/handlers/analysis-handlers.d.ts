import type { CloudflareEnvironment } from '../../types.js';
/**
 * Handle manual analysis requests (Enhanced with sentiment)
 */
export declare const handleManualAnalysis: import("../handler-factory.js").HandlerFunction<Response>;
/**
 * Handle enhanced feature analysis requests
 */
export declare function handleEnhancedFeatureAnalysis(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle independent technical analysis requests
 */
export declare function handleIndependentTechnicalAnalysis(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle per-symbol analysis requests
 */
export declare function handlePerSymbolAnalysis(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle sentiment testing requests
 */
export declare function handleSentimentTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle morning predictions generation from existing analysis data
 */
export declare function handleGenerateMorningPredictions(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle status management for testing the KV pipeline
 */
export declare function handleStatusManagement(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle comprehensive KV verification and logging test
 */
export declare function handleKVVerificationTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
//# sourceMappingURL=analysis-handlers.d.ts.map