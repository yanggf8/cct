/**
 * API v1 Router
 * RESTful API endpoints following DAC patterns
 * Delegates to per-domain route handlers and standardizes responses
 */
import type { CloudflareEnvironment } from '../types.js';
interface ApiKeyValidation {
    valid: boolean;
    key: string | null;
}
/**
 * Main v1 API Router
 */
export declare function handleApiV1Request(request: Request, env: CloudflareEnvironment, path: string): Promise<Response>;
/**
 * CORS preflight handler for API v1
 */
export declare function handleApiV1CORS(): Response;
/**
 * Exported helpers used by per-domain route modules
 */
export declare function generateRequestId(): string;
export declare function validateApiKey(request: Request, env: CloudflareEnvironment): ApiKeyValidation;
export declare function parseQueryParams(url: URL): Record<string, string>;
export declare function extractSymbolsParam(params: Record<string, string>): string[];
export {};
//# sourceMappingURL=api-v1.d.ts.map