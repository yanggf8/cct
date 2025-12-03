/**
 * HTTP Data Handlers
 * HTTP request handlers for data retrieval, storage, and KV operations
 * Note: This is the HTTP/presentation layer - uses DAL for actual storage operations
 */
import type { CloudflareEnvironment } from '../../types';
/**
 * Handle get results requests
 */
export declare function handleGetResults(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle fact table requests
 */
export declare function handleFactTable(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle cron health status requests
 */
export declare function handleCronHealth(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle KV debug requests for testing and diagnostics
 */
export declare function handleKVDebug(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle KV write test requests
 */
export declare function handleKVWriteTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle KV read test requests
 */
export declare function handleKVReadTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle KV get requests for specific keys
 */
export declare function handleKVGet(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle KV analysis write test requests
 */
export declare function handleKVAnalysisWriteTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle KV analysis read test requests
 */
export declare function handleKVAnalysisReadTest(request: Request, env: CloudflareEnvironment): Promise<Response>;
//# sourceMappingURL=http-data-handlers.d.ts.map