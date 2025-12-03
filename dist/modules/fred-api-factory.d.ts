/**
 * Enhanced FRED API Client Factory
 *
 * Creates and configures FRED API client instances with proper API key management,
 * environment detection, and automatic fallback to mock client when needed.
 *
 * Features:
 * - Automatic API key detection and validation
 * - Environment-aware client creation
 * - Graceful fallback to mock client in development
 * - Circuit breaker integration
 * - Comprehensive error handling
 * - Health check capabilities
 *
 * @author Real-time Data Integration - Phase 1
 * @since 2025-10-14
 */
import { FredApiClient, MockFredApiClient } from './fred-api-client.js';
import type { CloudflareEnvironment } from '../types.js';
/**
 * FRED API Client Factory Options
 */
export interface FredClientFactoryOptions {
    forceMock?: boolean;
    enableLogging?: boolean;
    customApiKey?: string;
    environment?: CloudflareEnvironment;
}
/**
 * Create FRED API client with automatic configuration
 */
export declare function createFredApiClient(env: CloudflareEnvironment, options?: FredClientFactoryOptions): FredApiClient | MockFredApiClient;
/**
 * Create FRED API client with health check
 */
export declare function createFredApiClientWithHealthCheck(env: CloudflareEnvironment, options?: FredClientFactoryOptions): Promise<{
    client: FredApiClient | MockFredApiClient;
    health: any;
}>;
/**
 * Get FRED API client factory for specific environment
 */
export declare function getFredClientFactory(env: CloudflareEnvironment): {
    create: (options?: FredClientFactoryOptions) => FredApiClient | MockFredApiClient;
    createWithHealthCheck: (options?: FredClientFactoryOptions) => Promise<{
        client: FredApiClient | MockFredApiClient;
        health: any;
    }>;
    isRealAPIAvailable: () => boolean;
    getConfiguration: () => {
        fred: {
            apiKey: string;
            baseUrl: string;
            rateLimitDelay: number;
            maxRetries: number;
            cacheEnabled: boolean;
            isRealData: boolean;
        };
        yahooFinance: {
            baseUrl: string;
            rateLimit: number;
            symbols: string[];
            vixSymbol: string;
        };
        refreshIntervals: {
            MARKET_HOURS: number;
            AFTER_HOURS: number;
            WEEKEND: number;
            FRED_ECONOMIC_DATA: number;
            MARKET_STRUCTURE: number;
        };
        isDevelopment: boolean;
        isProduction: boolean;
    };
};
/**
 * Validate FRED API key format
 */
export declare function validateFREDApiKey(apiKey: string): boolean;
/**
 * Test FRED API key validity
 */
export declare function testFREDApiKey(apiKey: string): Promise<boolean>;
/**
 * FRED API Client Manager
 *
 * Manages multiple FRED API clients with different configurations
 */
export declare class FredClientManager {
    private clients;
    private env;
    constructor(env: CloudflareEnvironment);
    /**
     * Get or create a named client
     */
    getClient(name: string, options?: FredClientFactoryOptions): FredApiClient | MockFredApiClient;
    /**
     * Get client with health check
     */
    getClientWithHealthCheck(name: string, options?: FredClientFactoryOptions): Promise<{
        client: FredApiClient | MockFredApiClient;
        health: any;
    }>;
    /**
     * Health check all clients
     */
    healthCheckAll(): Promise<Record<string, any>>;
    /**
     * Clear all clients
     */
    clear(): void;
    /**
     * Get client count
     */
    getClientCount(): number;
}
/**
 * Initialize FRED client manager
 */
export declare function initializeFredClientManager(env: CloudflareEnvironment): FredClientManager;
declare const _default: {
    createFredApiClient: typeof createFredApiClient;
    createFredApiClientWithHealthCheck: typeof createFredApiClientWithHealthCheck;
    getFredClientFactory: typeof getFredClientFactory;
    validateFREDApiKey: typeof validateFREDApiKey;
    testFREDApiKey: typeof testFREDApiKey;
    FredClientManager: typeof FredClientManager;
    initializeFredClientManager: typeof initializeFredClientManager;
};
export default _default;
//# sourceMappingURL=fred-api-factory.d.ts.map