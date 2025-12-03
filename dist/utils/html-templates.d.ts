/**
 * HTML Template Utilities
 * Provides fallback HTML templates for empty states and error conditions
 * Ensures graceful degradation when data is unavailable
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Generate empty state HTML with warning badge
 */
export declare function generateEmptyStateHTML(options: {
    title: string;
    reportType: string;
    message?: string;
    diagnosticsLink?: string;
    requestId?: string;
}): string;
/**
 * Generate error state HTML with error details
 */
export declare function generateErrorStateHTML(options: {
    title: string;
    error: string;
    reportType: string;
    requestId?: string;
    showRetry?: boolean;
}): string;
/**
 * Generate security headers for HTML responses
 */
export declare function getSecurityHeaders(): Record<string, string>;
/**
 * Add cache headers for HTML responses
 */
export declare function getCacheHeaders(isStatic?: boolean): Record<string, string>;
/**
 * Create a safe report handler with fallback HTML
 */
export declare function createSafeReportHandler(options: {
    title: string;
    reportType: string;
    generateReportHTML: () => Promise<string>;
    env: CloudflareEnvironment;
    isStatic?: boolean;
}): (request: Request) => Promise<Response>;
//# sourceMappingURL=html-templates.d.ts.map