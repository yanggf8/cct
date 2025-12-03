/**
 * Production Guards - Runtime Mock Detection and Prevention
 *
 * Provides utilities to detect and prevent mock data usage in production environments.
 * Enforces strict data integrity and prevents accidental fallback to synthetic data.
 *
 * Features:
 * - Runtime mock detection in API responses
 * - Production-only validation middleware
 * - Data source verification and tracking
 * - Automatic failure on mock data detection
 *
 * @author Sprint 1-B - Macro/FRED Strict Mode Implementation
 * @since 2025-01-XX
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Production guard configuration
 */
export interface ProductionGuardOptions {
    strictMode?: boolean;
    environment?: CloudflareEnvironment;
    allowedMockSources?: string[];
    failOnMock?: boolean;
}
/**
 * Data source verification result
 */
export interface DataSourceVerification {
    isReal: boolean;
    source: string;
    confidence: number;
    flags: string[];
}
/**
 * Production guards class for runtime mock detection
 */
export declare class ProductionGuards {
    private options;
    private isProduction;
    constructor(options?: ProductionGuardOptions);
    /**
     * Verify API response contains real data (not mock)
     */
    verifyApiResponse(response: any, endpoint: string): DataSourceVerification;
    /**
     * Detect if response contains mock data patterns
     */
    private isMockResponse;
    /**
     * Extract data source information from response
     */
    private extractDataSource;
    /**
     * Validate data quality indicators
     */
    private validateDataQuality;
    /**
     * Middleware function to wrap API handlers with production guards
     */
    createMiddleware(endpoint: string): (response: any) => any;
    /**
     * Check if the current environment allows mock data
     */
    allowsMockData(): boolean;
    /**
     * Get current guard configuration
     */
    getConfiguration(): {
        isProduction: boolean;
        strictMode: boolean;
        failOnMock: boolean;
        allowedMockSources: string[];
    };
}
/**
 * Create production guards instance
 */
export declare function createProductionGuards(options?: ProductionGuardOptions): ProductionGuards;
/**
 * Default production guards instance for production use
 */
export declare const defaultProductionGuards: ProductionGuards;
//# sourceMappingURL=production-guards.d.ts.map