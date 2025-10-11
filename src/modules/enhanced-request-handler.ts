/**
 * Enhanced Request Handler with Data Access Improvements
 * Integrates simplified enhanced DAL and migration management
 */

import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
import { getMigrationManager, migrationMiddleware } from '../routes/migration-manager.js';
import { legacyCompatibilityMiddleware } from '../routes/legacy-compatibility.js';
import { createLogger } from './logging.js';
import { PerformanceMonitor } from './monitoring.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('enhanced-request-handler');

/**
 * Enhanced request handler with DAL improvements and migration support
 */
export class EnhancedRequestHandler {
  private env: CloudflareEnvironment;
  private dal: ReturnType<typeof createSimplifiedEnhancedDAL>;
  private migrationManager: ReturnType<typeof getMigrationManager>;

  constructor(env: CloudflareEnvironment) {
    this.env = env;

    // Initialize enhanced DAL
    this.dal = createSimplifiedEnhancedDAL(env, {
      enableCache: true,
      environment: env.ENVIRONMENT || 'production',
      defaultTTL: 3600,
      maxRetries: 3
    });

    // Initialize migration manager
    this.migrationManager = getMigrationManager(env, {
      enableNewAPI: true,
      enableLegacyCompatibility: true,
      enableABTesting: false, // Start with full legacy compatibility
      newAPITrafficPercentage: 10, // 10% new API traffic initially
      enableMigrationLogging: true,
      enablePerformanceComparison: true,
      endpointSettings: {
        '/health': {
          enabled: true,
          migratePercentage: 100, // Low risk, fully migrate
          forceNewAPI: true
        },
        '/analyze': {
          enabled: true,
          migratePercentage: 25, // High priority, 25% initial
          forceNewAPI: false
        },
        '/results': {
          enabled: true,
          migratePercentage: 10, // Start with 10%
          forceNewAPI: false
        }
      }
    });

    logger.info('Enhanced Request Handler initialized', {
      cacheEnabled: true,
      migrationEnabled: true,
      environment: env.ENVIRONMENT || 'production'
    });
  }

  /**
   * Handle HTTP request with enhanced features
   */
  async handleRequest(request: Request, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const startTime = Date.now();

    // Start performance monitoring
    const monitor = PerformanceMonitor.monitorRequest(request);

    try {
      // Check for legacy endpoint compatibility
      const legacyResponse = await legacyCompatibilityMiddleware(request, this.env);
      if (legacyResponse) {
        monitor.complete(legacyResponse);
        return legacyResponse;
      }

      // Apply migration logic for non-legacy endpoints
      const { useNewAPI, reason } = await migrationMiddleware(request, this.env, url.pathname);

      // Route based on migration decision
      if (useNewAPI) {
        return await this.handleNewAPIRequest(request, monitor, reason);
      } else {
        return await this.handleLegacyRequest(request, monitor, reason);
      }

    } catch (error: any) {
      logger.error('Enhanced request handler failed', {
        path: url.pathname,
        error: error.message,
        stack: error.stack,
        responseTime: Date.now() - startTime
      });

      const errorResponse = new Response(JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString(),
        enhanced_system: true
      }, null, 2), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Enhanced-System': 'true'
        }
      });

      monitor.complete(errorResponse);
      return errorResponse;
    }
  }

  /**
   * Handle new API requests with enhanced DAL
   */
  private async handleNewAPIRequest(
    request: Request,
    monitor: any,
    reason: string
  ): Promise<Response> {
    const url = new URL(request.url);
    const startTime = Date.now();

    logger.info('Handling new API request', {
      path: url.pathname,
      method: request.method,
      reason
    });

    try {
      // Route to enhanced handlers
      let response: Response;

      switch (url.pathname) {
        case '/api/v1/data/health':
          response = await this.handleEnhancedHealthCheck();
          break;

        case '/api/v1/data/dal-status':
          response = await this.handleDALStatus();
          break;

        case '/api/v1/data/migration-status':
          response = await this.handleMigrationStatus();
          break;

        case '/api/v1/data/performance-test':
          response = await this.handlePerformanceTest();
          break;

        case '/api/v1/data/cache-clear':
          response = await this.handleCacheClear(request);
          break;

        default:
          // For endpoints not yet implemented in new API,
          // fall back to original handlers with enhanced DAL injection
          response = await this.handleFallbackRequest(request, reason);
          break;
      }

      // Add enhanced system headers
      response.headers.set('X-Enhanced-System', 'true');
      response.headers.set('X-API-Version', 'v1');
      response.headers.set('X-Migration-Reason', reason);

      monitor.complete(response);

      // Record migration event
      await this.migrationManager.recordMigrationEvent({
        type: 'new_api_request',
        endpoint: url.pathname,
        responseTime: Date.now() - startTime,
        success: response.ok,
        metadata: {
          reason,
          responseStatus: response.status
        }
      });

      return response;

    } catch (error: any) {
      logger.error('New API request failed', {
        path: url.pathname,
        error: error.message,
        reason
      });

      await this.migrationManager.recordMigrationEvent({
        type: 'migration_error',
        endpoint: url.pathname,
        responseTime: Date.now() - startTime,
        success: false,
        error: error.message,
        metadata: { reason }
      });

      throw error;
    }
  }

  /**
   * Handle legacy requests with enhanced monitoring
   */
  private async handleLegacyRequest(
    request: Request,
    monitor: any,
    reason: string
  ): Promise<Response> {
    const url = new URL(request.url);
    const startTime = Date.now();

    logger.info('Handling legacy request', {
      path: url.pathname,
      method: request.method,
      reason
    });

    // Import original handler dynamically
    const { handleHttpRequest } = await import('./routes.js');

    try {
      const response = await handleHttpRequest(request, this.env, null);

      // Add migration headers
      response.headers.set('X-Enhanced-System', 'true');
      response.headers.set('X-API-Version', 'legacy');
      response.headers.set('X-Migration-Reason', reason);

      monitor.complete(response);

      // Record migration event
      await this.migrationManager.recordMigrationEvent({
        type: 'legacy_request',
        endpoint: url.pathname,
        responseTime: Date.now() - startTime,
        success: response.ok,
        metadata: {
          reason,
          responseStatus: response.status
        }
      });

      return response;

    } catch (error: any) {
      await this.migrationManager.recordMigrationEvent({
        type: 'migration_error',
        endpoint: url.pathname,
        responseTime: Date.now() - startTime,
        success: false,
        error: error.message,
        metadata: { reason }
      });

      throw error;
    }
  }

  /**
   * Handle fallback requests for endpoints not yet in new API
   */
  private async handleFallbackRequest(request: Request, reason: string): Promise<Response> {
    // Import original handler and enhance it with DAL injection
    const { handleHttpRequest } = await import('./routes.js');

    // Temporarily inject enhanced DAL into environment for handlers
    const enhancedEnv = {
      ...this.env,
      enhancedDAL: this.dal,
      migrationManager: this.migrationManager
    };

    return await handleHttpRequest(request, enhancedEnv, null);
  }

  /**
   * Enhanced health check with DAL and migration status
   */
  private async handleEnhancedHealthCheck(): Promise<Response> {
    const dalStats = this.dal.getPerformanceStats();
    const migrationConfig = this.migrationManager.getConfig();

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      system: {
        status: 'healthy',
        enhanced_dal: true,
        migration_system: true,
        version: '2.0-enhanced'
      },
      performance: {
        cache: dalStats.cache,
        operations: dalStats.performance
      },
      migration: {
        enabled: migrationConfig.enableNewAPI,
        legacy_compatibility: migrationConfig.enableLegacyCompatibility,
        new_api_percentage: migrationConfig.newAPITrafficPercentage,
        ab_testing: migrationConfig.enableABTesting
      },
      endpoints: {
        api_v1: '/api/v1/*',
        legacy_compatibility: 'Enabled',
        monitoring: '/api/v1/data/*'
      }
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * DAL status endpoint
   */
  private async handleDALStatus(): Promise<Response> {
    const stats = this.dal.getPerformanceStats();

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      dal: {
        type: 'Simplified Enhanced DAL',
        cache_enabled: true,
        performance: stats
      },
      cache: {
        hit_rate: `${Math.round(stats.cache.hitRate * 100)}%`,
        total_operations: stats.cache.hits + stats.cache.misses,
        cache_size: stats.performance.cacheSize
      }
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Migration status endpoint
   */
  private async handleMigrationStatus(): Promise<Response> {
    const stats = await this.migrationManager.getMigrationStatistics();

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      migration: stats,
      config: this.migrationManager.getConfig()
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Performance test endpoint
   */
  private async handlePerformanceTest(): Promise<Response> {
    const testKey = `performance_test_${Date.now()}`;
    const testData = {
      test_id: testKey,
      timestamp: new Date().toISOString(),
      data: 'Performance test data for enhanced DAL validation'
    };

    // Test write performance
    const writeStart = Date.now();
    const writeResult = await this.dal.write(testKey, testData);
    const writeTime = Date.now() - writeStart;

    // Test read performance
    const readStart = Date.now();
    const readResult = await this.dal.read(testKey);
    const readTime = Date.now() - readStart;

    // Test cache performance
    const cacheStart = Date.now();
    const cacheResult = await this.dal.read(testKey);
    const cacheTime = Date.now() - cacheStart;

    // Cleanup
    await this.dal.deleteKey(testKey);

    const dalStats = this.dal.getPerformanceStats();

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      performance_test: {
        write: {
          success: writeResult.success,
          response_time: writeResult.responseTime || writeTime
        },
        read: {
          success: readResult.success,
          cached: readResult.cached,
          cache_source: readResult.cacheSource,
          response_time: readResult.responseTime || readTime
        },
        cache: {
          success: cacheResult.success,
          cached: cacheResult.cached,
          cache_source: cacheResult.cacheSource,
          response_time: cacheResult.responseTime || cacheTime
        }
      },
      overall_performance: dalStats
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Cache clear endpoint
   */
  private async handleCacheClear(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const namespace = url.searchParams.get('namespace');

    if (namespace) {
      this.dal.clearCache();
      // Note: In simplified DAL, clearCache clears all cache
      // For namespace-specific clearing, would need enhanced implementation
    } else {
      this.dal.clearCache();
    }

    const stats = this.dal.getPerformanceStats();

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      message: namespace
        ? `Cache cleared for all data (namespace support simplified)`
        : 'All cache cleared',
      cache_status: stats
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Create enhanced request handler instance
 */
export function createEnhancedRequestHandler(env: CloudflareEnvironment): EnhancedRequestHandler {
  return new EnhancedRequestHandler(env);
}

export default EnhancedRequestHandler;