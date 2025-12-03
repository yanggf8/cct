/**
 * Legacy Compatibility Layer - Phase 5 Implementation
 * Data Access Improvement Plan - Backward Compatibility
 *
 * Provides seamless migration from legacy endpoints to new API v1 endpoints
 * with zero breaking changes and deprecation warnings.
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Legacy endpoint mapping configuration
 * Note: Test endpoints and direct handlers are excluded from legacy compatibility
 * They should be handled directly by their respective handlers, not mapped to API v1
 */
declare const LEGACY_MAPPINGS: {
    readonly '/analyze': "/api/v1/sentiment/analysis";
    readonly '/analyze-symbol': "/api/v1/sentiment/symbols";
    readonly '/health': "/api/v1/data/health";
    readonly '/api/daily-summary': "/api/v1/reports/daily";
    readonly '/weekly-analysis': "/api/v1/reports/weekly/latest";
};
/**
 * Handle legacy endpoint with automatic forwarding
 */
export declare function handleLegacyEndpoint(request: Request, env: CloudflareEnvironment, oldPath: string): Promise<Response>;
/**
 * Check if request is for a legacy endpoint
 */
export declare function isLegacyEndpoint(path: string): boolean;
/**
 * Get new endpoint path for legacy endpoint
 */
export declare function getNewEndpointPath(legacyPath: string): string | null;
/**
 * Get all legacy mappings
 */
export declare function getLegacyMappings(): typeof LEGACY_MAPPINGS;
/**
 * Middleware to handle legacy compatibility
 */
export declare function legacyCompatibilityMiddleware(request: Request, env: CloudflareEnvironment): Promise<Response> | null;
/**
 * Legacy endpoint usage statistics
 */
declare class LegacyUsageTracker {
    private usage;
    recordUsage(endpoint: string): void;
    getUsageStats(): {
        endpoint: string;
        count: number;
        lastUsed: string;
    }[];
    clearUsage(): void;
}
export declare const legacyUsageTracker: LegacyUsageTracker;
/**
 * Enhanced legacy handler with usage tracking
 */
export declare function handleLegacyEndpointWithTracking(request: Request, env: CloudflareEnvironment, oldPath: string): Promise<Response>;
declare const _default: {
    handleLegacyEndpoint: typeof handleLegacyEndpoint;
    handleLegacyEndpointWithTracking: typeof handleLegacyEndpointWithTracking;
    isLegacyEndpoint: typeof isLegacyEndpoint;
    getNewEndpointPath: typeof getNewEndpointPath;
    getLegacyMappings: typeof getLegacyMappings;
    legacyCompatibilityMiddleware: typeof legacyCompatibilityMiddleware;
    legacyUsageTracker: LegacyUsageTracker;
    LEGACY_MAPPINGS: {
        readonly '/analyze': "/api/v1/sentiment/analysis";
        readonly '/analyze-symbol': "/api/v1/sentiment/symbols";
        readonly '/health': "/api/v1/data/health";
        readonly '/api/daily-summary': "/api/v1/reports/daily";
        readonly '/weekly-analysis': "/api/v1/reports/weekly/latest";
    };
    DEPRECATION_CONFIG: {
        enabled: boolean;
        warningHeader: string;
        newEndpointHeader: string;
        sunsetDate: string;
        migrationGuide: string;
    };
};
export default _default;
//# sourceMappingURL=legacy-compatibility.d.ts.map