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

import { FredApiClient, MockFredApiClient, type FredApiClientOptions } from './fred-api-client.js';
import { getAPIConfiguration, isRealAPIAvailable } from './config.js';
import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('fred-api-factory');

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
export function createFredApiClient(
  env: CloudflareEnvironment,
  options: FredClientFactoryOptions = {}
): FredApiClient | MockFredApiClient {
  const {
    forceMock = false,
    enableLogging = true,
    customApiKey,
    environment
  } = options;

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
  const clientOptions: FredApiClientOptions = {
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
  } catch (error) {
    logger.error('Failed to create FRED API client, falling back to mock:', error);
    return new MockFredApiClient();
  }
}

/**
 * Create FRED API client with health check
 */
export async function createFredApiClientWithHealthCheck(
  env: CloudflareEnvironment,
  options: FredClientFactoryOptions = {}
): Promise<{ client: FredApiClient | MockFredApiClient; health: any }> {
  const client = createFredApiClient(env, options);

  try {
    const health = await client.healthCheck();

    logger.info('FRED API client health check completed', {
      status: health.status,
      isMock: client instanceof MockFredApiClient,
      details: health.details
    });

    return { client, health };
  } catch (error) {
    logger.error('FRED API client health check failed:', error);

    // If health check fails for real client, fall back to mock
    if (!(client instanceof MockFredApiClient)) {
      logger.warn('Health check failed, switching to mock FRED client');
      const mockClient = new MockFredApiClient();
      return {
        client: mockClient,
        health: {
          status: 'unhealthy',
          error: error.message,
          fallback: 'mock-client'
        }
      };
    }

    return {
      client,
      health: {
        status: 'unhealthy',
        error: error.message
      }
    };
  }
}

/**
 * Get FRED API client factory for specific environment
 */
export function getFredClientFactory(env: CloudflareEnvironment) {
  return {
    create: (options?: FredClientFactoryOptions) => createFredApiClient(env, options),
    createWithHealthCheck: (options?: FredClientFactoryOptions) =>
      createFredApiClientWithHealthCheck(env, options),
    isRealAPIAvailable: () => isRealAPIAvailable(env),
    getConfiguration: () => getAPIConfiguration(env)
  };
}

/**
 * Validate FRED API key format
 */
export function validateFREDApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') return false;

  // FRED API keys are typically 32 characters alphanumeric
  const keyPattern = /^[a-zA-Z0-9]{32}$/;
  return keyPattern.test(apiKey);
}

/**
 * Test FRED API key validity
 */
export async function testFREDApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new FredApiClient({ apiKey });
    const health = await client.healthCheck();
    return health.status === 'healthy';
  } catch (error) {
    logger.error('FRED API key test failed:', error);
    return false;
  }
}

/**
 * Get default start date for FRED data (2 years ago)
 */
function getDefaultStartDate(): string {
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
  private clients: Map<string, FredApiClient | MockFredApiClient> = new Map();
  private env: CloudflareEnvironment;

  constructor(env: CloudflareEnvironment) {
    this.env = env;
  }

  /**
   * Get or create a named client
   */
  getClient(name: string, options?: FredClientFactoryOptions): FredApiClient | MockFredApiClient {
    if (!this.clients.has(name)) {
      const client = createFredApiClient(this.env, options);
      this.clients.set(name, client);
    }
    return this.clients.get(name)!;
  }

  /**
   * Get client with health check
   */
  async getClientWithHealthCheck(name: string, options?: FredClientFactoryOptions): Promise<{
    client: FredApiClient | MockFredApiClient;
    health: any;
  }> {
    const client = this.getClient(name, options);
    const health = await client.healthCheck();
    return { client, health };
  }

  /**
   * Health check all clients
   */
  async healthCheckAll(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const [name, client] of this.clients) {
      try {
        results[name] = await client.healthCheck();
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    return results;
  }

  /**
   * Clear all clients
   */
  clear(): void {
    this.clients.clear();
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

/**
 * Initialize FRED client manager
 */
export function initializeFredClientManager(env: CloudflareEnvironment): FredClientManager {
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