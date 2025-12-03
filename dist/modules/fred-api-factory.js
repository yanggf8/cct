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
import { getAPIConfiguration, isRealAPIAvailable } from './config.js';
import { createLogger } from './logging.js';
const logger = createLogger('fred-api-factory');
/**
 * Create FRED API client with automatic configuration
 */
export function createFredApiClient(env, options = {}) {
    const { forceMock = false, enableLogging = true, customApiKey, environment } = options;
    // Get API configuration
    const apiConfig = getAPIConfiguration(env);
    const isRealAPI = isRealAPIAvailable(env);
    // Force mock mode if requested or if no real API is available
    if (forceMock || !isRealAPI) {
        if (enableLogging) {
            logger.info('Creating mock FRED API client', {
                reason: forceMock ? 'forced' : 'no-real-api-key',
                isDevelopment: apiConfig.isDevelopment,
                hasApiKey: !!apiConfig.fred.apiKey
            });
        }
        return new MockFredApiClient();
    }
    // Use custom API key if provided
    const apiKey = customApiKey || apiConfig.fred.apiKey;
    if (!apiKey) {
        logger.warn('No FRED API key available, falling back to mock client');
        return new MockFredApiClient();
    }
    // Create real FRED API client
    const clientOptions = {
        apiKey,
        baseUrl: apiConfig.fred.baseUrl,
        rateLimitDelay: apiConfig.fred.rateLimitDelay,
        maxRetries: apiConfig.fred.maxRetries,
        cacheEnabled: apiConfig.fred.cacheEnabled,
        defaultStartDate: getDefaultStartDate()
    };
    if (enableLogging) {
        logger.info('Creating real FRED API client', {
            baseUrl: apiConfig.fred.baseUrl,
            rateLimitDelay: apiConfig.fred.rateLimitDelay,
            maxRetries: apiConfig.fred.maxRetries,
            cacheEnabled: apiConfig.fred.cacheEnabled,
            apiKeyLength: apiKey.length,
            isProduction: apiConfig.isProduction
        });
    }
    try {
        return new FredApiClient(clientOptions);
    }
    catch (error) {
        logger.error('Failed to create FRED API client, falling back to mock:', error);
        return new MockFredApiClient();
    }
}
/**
 * Create FRED API client with health check
 */
export async function createFredApiClientWithHealthCheck(env, options = {}) {
    const client = createFredApiClient(env, options);
    try {
        const health = await client.healthCheck();
        logger.info('FRED API client health check completed', {
            status: health.status,
            isMock: client instanceof MockFredApiClient,
            details: health.details
        });
        return { client, health };
    }
    catch (error) {
        logger.error('FRED API client health check failed:', { error: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) });
        // If health check fails for real client, fall back to mock
        if (!(client instanceof MockFredApiClient)) {
            logger.warn('Health check failed, switching to mock FRED client');
            const mockClient = new MockFredApiClient();
            return {
                client: mockClient,
                health: {
                    status: 'unhealthy',
                    error: error instanceof Error ? error.message : String(error),
                    fallback: 'mock-client'
                }
            };
        }
        return {
            client,
            health: {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error)
            }
        };
    }
}
/**
 * Get FRED API client factory for specific environment
 */
export function getFredClientFactory(env) {
    return {
        create: (options) => createFredApiClient(env, options),
        createWithHealthCheck: (options) => createFredApiClientWithHealthCheck(env, options),
        isRealAPIAvailable: () => isRealAPIAvailable(env),
        getConfiguration: () => getAPIConfiguration(env)
    };
}
/**
 * Validate FRED API key format
 */
export function validateFREDApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string')
        return false;
    // FRED API keys are typically 32 characters alphanumeric
    const keyPattern = /^[a-zA-Z0-9]{32}$/;
    return keyPattern.test(apiKey);
}
/**
 * Test FRED API key validity
 */
export async function testFREDApiKey(apiKey) {
    try {
        const client = new FredApiClient({ apiKey });
        const health = await client.healthCheck();
        return health.status === 'healthy';
    }
    catch (error) {
        logger.error('FRED API key test failed:', { error: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) });
        return false;
    }
}
/**
 * Get default start date for FRED data (2 years ago)
 */
function getDefaultStartDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);
    return date.toISOString().split('T')[0];
}
/**
 * FRED API Client Manager
 *
 * Manages multiple FRED API clients with different configurations
 */
export class FredClientManager {
    constructor(env) {
        this.clients = new Map();
        this.env = env;
    }
    /**
     * Get or create a named client
     */
    getClient(name, options) {
        if (!this.clients.has(name)) {
            const client = createFredApiClient(this.env, options);
            this.clients.set(name, client);
        }
        return this.clients.get(name);
    }
    /**
     * Get client with health check
     */
    async getClientWithHealthCheck(name, options) {
        const client = this.getClient(name, options);
        const health = await client.healthCheck();
        return { client, health };
    }
    /**
     * Health check all clients
     */
    async healthCheckAll() {
        const results = {};
        for (const [name, client] of this.clients) {
            try {
                results[name] = await client.healthCheck();
            }
            catch (error) {
                results[name] = {
                    status: 'unhealthy',
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
        return results;
    }
    /**
     * Clear all clients
     */
    clear() {
        this.clients.clear();
    }
    /**
     * Get client count
     */
    getClientCount() {
        return this.clients.size;
    }
}
/**
 * Initialize FRED client manager
 */
export function initializeFredClientManager(env) {
    return new FredClientManager(env);
}
export default {
    createFredApiClient,
    createFredApiClientWithHealthCheck,
    getFredClientFactory,
    validateFREDApiKey,
    testFREDApiKey,
    FredClientManager,
    initializeFredClientManager
};
//# sourceMappingURL=fred-api-factory.js.map