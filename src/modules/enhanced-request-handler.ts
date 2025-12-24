// @ts-ignore - Suppressing TypeScript errors

/**
 * Enhanced Request Handler with Data Access Improvements
 * Integrates simplified enhanced DAL and migration management
 */

import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
import { getMigrationManager, migrationMiddleware } from '../routes/migration-manager.js';
import { legacyCompatibilityMiddleware } from '../routes/legacy-compatibility.js';
import { authenticateRequest, unauthorizedResponse } from './api-auth-middleware.js';
import { createLogger } from './logging.js';
import { PerformanceMonitor } from './monitoring.js';
import { createCacheInstance, type CacheDO } from './cache-do.js';
import { handleApiV1Request } from '../routes/api-v1.js';
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
  async handleRequest(request: Request, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const startTime = Date.now();

    // Start performance monitoring
    const monitor = PerformanceMonitor.monitorRequest(request);

    try {
      // Centralized authentication check
      const auth = authenticateRequest(request, this.env);
      if (!auth.authenticated) {
        const response = unauthorizedResponse(auth.reason || 'unauthorized');
        monitor.complete(response);
        return response;
      }

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
        return await this.handleNewAPIRequest(request, monitor, ctx, reason);
      } else {
        return await this.handleLegacyRequest(request, monitor, ctx, reason);
      }

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.error('Enhanced request handler failed', {
        path: url.pathname,
        error: message,
        stack,
        responseTime: Date.now() - startTime
      });

      const errorResponse = new Response(JSON.stringify({
        success: false,
        error: 'Internal server error',
        message,
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
    ctx: ExecutionContext,
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
      // Auth already checked centrally in handleRequest()
      
      // Route to enhanced handlers
      let response: Response;

      switch (url.pathname) {
        case '/api/v1':
          // API v1 root documentation - public access
          response = await this.handleAPIv1Root();
          break;

        case '/results':
          // Legacy results endpoint - requires API key
          response = await this.handleResults(request);
          break;

        case '/api/v1/data/health':
          // Health check - public access
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
          response = await this.handleFallbackRequest(request, ctx, reason);
          break;
      }

      // Add enhanced system headers while preserving existing Content-Type
      (response as any).headers.set('X-Enhanced-System', 'true');
      (response as any).headers.set('X-API-Version', 'v1');
      (response as any).headers.set('X-Migration-Reason', reason);

      // Ensure proper Content-Type for HTML responses
      const contentType = (response as any).headers.get('Content-Type') || '';
      if (contentType.includes('text/html')) {
        (response as any).headers.set('Content-Type', 'text/html; charset=utf-8');
      }

      monitor.complete(response);

      // Record migration event
      await (this as any).migrationManager.recordMigrationEvent({
        type: 'new_api_request',
        endpoint: url.pathname,
        responseTime: Date.now() - startTime,
        success: (response as any).ok,
        metadata: {
          reason,
          responseStatus: (response as any).status
        }
      });

      return response;

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('New API request failed', {
        path: url.pathname,
        error: message,
        reason
      });

      await (this as any).migrationManager.recordMigrationEvent({
        type: 'migration_error',
        endpoint: url.pathname,
        responseTime: Date.now() - startTime,
        success: false,
        error: message,
        metadata: { reason }
      });

      throw error;
    }
  }

  /**
   * Handle API v1 root documentation endpoint
   */
  private async handleAPIv1Root(): Promise<Response> {
    // Import the API response factory
    const { ApiResponseFactory } = await import('../modules/api-v1-responses.js');

    const apiData = {
      title: 'CCT API v1',
      version: '(1 as any).00',
      description: 'RESTful API for dual AI sentiment analysis, sector rotation, and market drivers intelligence',
      available_endpoints: {
        sentiment: {
          analysis: 'GET /api/v1/sentiment/analysis',
          symbol: 'GET /api/v1/sentiment/symbols/:symbol',
          market: 'GET /api/v1/sentiment/market',
          sectors: 'GET /api/v1/sentiment/sectors',
        },
        reports: {
          daily: 'GET /api/v1/reports/daily/:date',
          weekly: 'GET /api/v1/reports/weekly/:week',
          pre_market: 'GET /api/v1/reports/pre-market',
          intraday: 'GET /api/v1/reports/intraday',
          end_of_day: 'GET /api/v1/reports/end-of-day',
        },
        data: {
          symbols: 'GET /api/v1/data/symbols',
          history: 'GET /api/v1/data/history/:symbol',
          health: 'GET /api/v1/data/health',
        },
        enhanced_cache: {
          health: 'GET /api/v1/cache/health',
          metrics: 'GET /api/v1/cache/metrics',
          config: 'GET /api/v1/cache/config',
          promote: 'POST /api/v1/cache/promote',
          warmup: 'POST /api/v1/cache/warmup',
        }
      },
      enhanced_system: true
    };

    const body = ApiResponseFactory.success(apiData, {
      endpoint: '/api/v1',
      public_access: true,
      enhanced_system: true
    });

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Enhanced-System': 'true',
        'X-API-Version': 'v1'
      }
    });
  }

  /**
   * Handle results endpoint (legacy compatibility)
   */
  private async handleResults(request: Request): Promise<Response> {
    // Import response factory and data functions
    const { ApiResponseFactory } = await import('../modules/api-v1-responses.js');
    const { getAnalysisResultsByDate } = await import('../modules/data.js');

    // Validate API key for sensitive endpoint
    const apiKey = (request as any).headers.get('X-API-KEY');
    // Use X_API_KEY environment variable consistently
    const configuredApiKeys = this.env.API_KEYS ? this.env.API_KEYS.split(',') : [];
    const validKeys = [this.env.X_API_KEY, ...configuredApiKeys];

    if (!apiKey || !validKeys.includes(apiKey)) {
      const body = ApiResponseFactory.error(
        'API key required for this endpoint',
        'UNAUTHORIZED',
        { requires_api_key: true }
      );

      return new Response(JSON.stringify(body), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'X-Enhanced-System': 'true'
        }
      });
    }

    try {
      const url = new URL(request.url);
      const requestedDate = (url as any).searchParams.get('date') || new Date().toISOString().split('T')[0];

      // Get results using enhanced DAL
      const results = await getAnalysisResultsByDate(this.env, requestedDate);

      if (!results) {
        const body = ApiResponseFactory.error(
          'No results found for the requested date',
          'NOT_FOUND',
          { requested_date: requestedDate }
        );

        return new Response(JSON.stringify(body), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'X-Enhanced-System': 'true'
          }
        });
      }

      const body = ApiResponseFactory.success(results, {
        endpoint: '/results',
        requested_date: requestedDate,
        enhanced_system: true,
        api_key_validated: true
      });

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Enhanced-System': 'true',
          'X-API-Version': 'v1'
        }
      });

    } catch (error: any) {
      const body = ApiResponseFactory.error(
        'Failed to retrieve results',
        'INTERNAL_ERROR',
        { error_message: (error instanceof Error ? error.message : String(error)) }
      );

      return new Response(JSON.stringify(body), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Enhanced-System': 'true'
        }
      });
    }
  }

  /**
   * Handle legacy requests with enhanced monitoring
   */
  private async handleLegacyRequest(
    request: Request,
    monitor: any,
    ctx: ExecutionContext,
    reason: string
  ): Promise<Response> {
    const url = new URL(request.url);
    const startTime = Date.now();

    logger.info('Handling legacy request', {
      path: url.pathname,
      method: request.method,
      reason
    });

try {
      // Handle request directly with enhanced logic
      const response = await this.handleDirectRequest(request, ctx);

      // Add migration headers while preserving existing Content-Type
      (response as any).headers.set('X-Enhanced-System', 'true');
      (response as any).headers.set('X-API-Version', 'legacy');
      (response as any).headers.set('X-Migration-Reason', reason);

      // Ensure proper Content-Type for HTML responses
      const contentType = (response as any).headers.get('Content-Type') || '';
      if (contentType.includes('text/html')) {
        (response as any).headers.set('Content-Type', 'text/html; charset=utf-8');
      }

      monitor.complete(response);

      // Record migration event
      await (this as any).migrationManager.recordMigrationEvent({
        type: 'legacy_request',
        endpoint: url.pathname,
        responseTime: Date.now() - startTime,
        success: (response as any).ok,
        metadata: {
          reason,
          responseStatus: (response as any).status
        }
      });

      return response;

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await (this as any).migrationManager.recordMigrationEvent({
        type: 'migration_error',
        endpoint: url.pathname,
        responseTime: Date.now() - startTime,
        success: false,
        error: message,
        metadata: { reason }
      });

      throw error;
    }
  }

  /**
   * Handle request directly with enhanced logic
   */
  private async handleDirectRequest(request: Request, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route /api/v1/* to api-v1 router
    if (path.startsWith('/api/v1')) {
      return handleApiV1Request(request, this.env, path);
    }

    // Default 404
    return new Response(JSON.stringify({ error: 'Not found', path }), { 
      status: 404, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  /**
   * Handle fallback requests for endpoints not yet in new API
   */
  private async handleFallbackRequest(request: Request, ctx: ExecutionContext, reason: string): Promise<Response> {
    // Handle request directly with enhanced logic
    return await this.handleDirectRequest(request, ctx);
  }

  /**
   * Enhanced health check with DAL and migration status
   */
  private async handleEnhancedHealthCheck(): Promise<Response> {
    const dalStats = (this as any).dal.getPerformanceStats();
    const migrationConfig = (this as any).migrationManager.getConfig();

    // Create DO cache instance to get comprehensive cache metrics
    let cacheData = null;
    try {
      const cacheManager = createCacheInstance(this.env, true);

      // Get comprehensive cache statistics from DO cache
      let cacheStats: any = {
        enabled: false,
        hitRate: 0,
        size: 0,
        hits: 0,
        misses: 0,
        overallHitRate: 0,
        l1HitRate: 0,
        l2HitRate: 0,
        l1Size: 0,
        totalRequests: 0,
        l1Hits: 0,
        l2Hits: 0,
        evictions: 0
      };
      let cacheHealthStatus: any = { enabled: false, status: 'disabled', namespaces: [], metricsHealth: {} };

      if (cacheManager) {
        try {
          const metadata = await cacheManager.getMetadata({ namespace: 'global' } as any);
          const stats = await cacheManager.getStats();

          cacheStats = {
            enabled: true,
            hitRate: stats.hitRate || 0,
            size: stats.size || 0,
            hits: stats.hits || 0,
            misses: stats.misses || 0,
            overallHitRate: stats.hitRate || 0,
            l1HitRate: stats.hitRate || 0,
            l2HitRate: 0, // DO cache doesn't have L2
            l1Size: stats.size || 0
          };

          cacheHealthStatus = {
            enabled: true,
            status: 'healthy',
            namespaces: Object.keys(metadata || {}),
            metricsHealth: {}
          };
        } catch (error) {
          logger.warn('Failed to get DO cache stats', { error });
        }
      }

      const cacheMetricsStats = {
        overall: { hitRate: cacheStats.overallHitRate || 0, totalRequests: cacheStats.totalRequests || 0 },
        layers: {
          l1: { hitRate: cacheStats.l1HitRate || 0, hits: cacheStats.l1Hits || 0, misses: cacheStats.misses || 0 },
          l2: { hitRate: cacheStats.l2HitRate || 0, hits: cacheStats.l2Hits || 0, misses: 0 }
        },
        health: { issues: [] as string[] },
        namespaces: cacheHealthStatus.namespaces || []
      };

      cacheData = {
        enabled: cacheHealthStatus.enabled,
        status: cacheHealthStatus.status,
        hitRate: cacheStats.overallHitRate,
        l1HitRate: cacheStats.l1HitRate,
        l2HitRate: cacheStats.l2HitRate,
        l1Size: cacheStats.l1Size,
        totalRequests: cacheStats.totalRequests,
        l1Hits: cacheStats.l1Hits,
        l2Hits: cacheStats.l2Hits,
        misses: cacheStats.misses,
        evictions: cacheStats.evictions,
        namespaces: cacheHealthStatus.namespaces,
        metricsHealth: cacheHealthStatus.metricsHealth,
        detailedMetrics: {
          overallHitRate: (cacheMetricsStats as any).overall.hitRate,
          totalRequests: (cacheMetricsStats as any).overall.totalRequests,
          l1HitRate: (cacheMetricsStats as any).layers.l1.hitRate,
          l1Hits: (cacheMetricsStats as any).layers.l1.hits,
          l1Misses: (cacheMetricsStats as any).layers.l1.misses,
          l2HitRate: (cacheMetricsStats as any).layers.l2.hitRate,
          l2Hits: (cacheMetricsStats as any).layers.l2.hits,
          l2Misses: (cacheMetricsStats as any).layers.l2.misses,
          issues: (cacheMetricsStats as any).health.issues,
          namespaces: cacheMetricsStats.namespaces
        }
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get cache metrics', { error: message });
      cacheData = {
        enabled: false,
        status: 'error',
        error: message
      };
    }

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
      cache: cacheData,
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
    const stats = (this as any).dal.getPerformanceStats();

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      dal: {
        type: 'Simplified Enhanced DAL',
        cache_enabled: true,
        performance: stats
      },
      cache: {
        hit_rate: `${Math.round((stats as any).cache.hitRate * 100)}%`,
        total_operations: (stats as any).cache.hits + (stats as any).cache.misses,
        cache_size: (stats as any).performance.cacheSize
      }
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Migration status endpoint
   */
  private async handleMigrationStatus(): Promise<Response> {
    const stats = await (this as any).migrationManager.getMigrationStatistics();

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      migration: stats,
      config: (this as any).migrationManager.getConfig()
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
    const writeResult = await (this as any).dal.write(testKey, testData);
    const writeTime = Date.now() - writeStart;

    // Test read performance
    const readStart = Date.now();
    const readResult = await (this as any).dal.read(testKey);
    const readTime = Date.now() - readStart;

    // Test cache performance
    const cacheStart = Date.now();
    const cacheResult = await (this as any).dal.read(testKey);
    const cacheTime = Date.now() - cacheStart;

    // Cleanup
    await (this as any).dal.deleteKey(testKey);

    const dalStats = (this as any).dal.getPerformanceStats();

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
    const namespace = (url as any).searchParams.get('namespace');

    if (namespace) {
      (this as any).dal.clearCache();
      // Note: In simplified DAL, clearCache clears all cache
      // For namespace-specific clearing, would need enhanced implementation
    } else {
      (this as any).dal.clearCache();
    }

    const stats = (this as any).dal.getPerformanceStats();

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

  /**
   * Expose DAL performance stats for external diagnostics.
   */
  public getDalPerformanceStats(): any {
    return (this as any).dal.getPerformanceStats();
  }

  /**
   * Expose migration statistics for external diagnostics.
   */
  public async getMigrationStatistics(): Promise<any> {
    return await (this as any).migrationManager.getMigrationStatistics();
  }
}

/**
 * Create enhanced request handler instance
 */
export function createEnhancedRequestHandler(env: CloudflareEnvironment): EnhancedRequestHandler {
  return new EnhancedRequestHandler(env);
}

export default EnhancedRequestHandler;
