/**
 * Business Intelligence Dashboard Routes
 * Provides endpoints for real-time BI dashboards and cost-to-serve intelligence
 * Phase 3 Implementation: Scaffolding foundation for operational health monitoring
 */

import { createLogger } from '../../modules/logging.js';
import { ApiResponseFactory, HttpStatus } from '../../modules/api-v1-responses.js';
import { createCacheInstance } from '../../modules/dual-cache-do.js';
import { getMetricsConfig } from '../../modules/config.js';
import { StorageGuards, type GuardConfig } from '../../modules/storage-guards.js';
import type { CloudflareEnvironment } from '../../types.js';

const logger = createLogger('dashboard-routes');

// Cache configuration for dashboard data
const DASHBOARD_CACHE_TTL = 300; // 5 minutes for real-time dashboard data
const ECONOMICS_CACHE_TTL = 3600; // 1 hour for cost-to-serve data

interface DashboardMetrics {
  operational_health: {
    overall_score: number;
    api_response_time: number;
    cache_hit_rate: number;
    error_rate: number;
    throughput: number;
  };
  system_performance: {
    cpu_utilization: number;
    memory_usage: number;
    storage_utilization: number;
    network_latency: number;
  };
  business_metrics: {
    daily_requests: number;
    cost_per_request: number;
    data_volume_processed: number;
    active_users: number;
  };
  guard_status: {
    violations_total: number;
    active_violations: number;
    critical_alerts: number;
    last_violation_time: string | null;
  };
  last_updated: string;
}

interface CostToServeMetrics {
  storage_costs: {
    durable_objects: number;
    kv_storage: number;
    d1_database: number;
    total_storage: number;
  };
  compute_costs: {
    api_requests: number;
    ai_processing: number;
    data_processing: number;
    total_compute: number;
  };
  bandwidth_costs: {
    data_transfer: number;
    cdn_usage: number;
    total_bandwidth: number;
  };
  total_monthly_cost: number;
  cost_per_request: number;
  cost_efficiency_score: number;
  projected_monthly_cost: number;
  last_updated: string;
}

interface GuardViolationData {
  violations: Array<{
    id: string;
    type: 'storage' | 'rate_limit' | 'performance' | 'security';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    metric_value: number;
    threshold_value: number;
    timestamp: string;
    resolved: boolean;
    resolution_time?: string;
  }>;
  summary: {
    total_violations: number;
    active_violations: number;
    critical_violations: number;
    violation_rate: number;
    mttr: number; // Mean Time To Resolution in minutes
  };
  last_updated: string;
}

/**
 * Generate sample dashboard metrics for demonstration
 */
function generateSampleDashboardMetrics(): DashboardMetrics {
  const now = new Date().toISOString();

  return {
    operational_health: {
      overall_score: 92.5,
      api_response_time: 145, // ms
      cache_hit_rate: 94.2, // %
      error_rate: 0.8, // %
      throughput: 1250 // requests/minute
    },
    system_performance: {
      cpu_utilization: 65.3, // %
      memory_usage: 71.8, // %
      storage_utilization: 58.9, // %
      network_latency: 28 // ms
    },
    business_metrics: {
      daily_requests: 125000,
      cost_per_request: 0.0008, // $0.0008 per request
      data_volume_processed: 2.8, // GB
      active_users: 342
    },
    guard_status: {
      violations_total: 15,
      active_violations: 2,
      critical_alerts: 0,
      last_violation_time: '2025-01-15T14:32:00Z'
    },
    last_updated: now
  };
}

/**
 * Generate sample cost-to-serve metrics for demonstration
 */
function generateSampleCostToServeMetrics(): CostToServeMetrics {
  const now = new Date().toISOString();

  return {
    storage_costs: {
      durable_objects: 12.50,
      kv_storage: 8.75,
      d1_database: 15.20,
      total_storage: 36.45
    },
    compute_costs: {
      api_requests: 24.80,
      ai_processing: 67.30,
      data_processing: 18.90,
      total_compute: 111.00
    },
    bandwidth_costs: {
      data_transfer: 14.60,
      cdn_usage: 9.25,
      total_bandwidth: 23.85
    },
    total_monthly_cost: 171.30,
    cost_per_request: 0.0008,
    cost_efficiency_score: 87.5,
    projected_monthly_cost: 178.90,
    last_updated: now
  };
}

/**
 * Generate sample guard violation data for demonstration
 */
function generateSampleGuardViolationData(): GuardViolationData {
  const now = new Date().toISOString();

  return {
    violations: [
      {
        id: 'guard-001',
        type: 'performance',
        severity: 'medium',
        description: 'API response time exceeded 200ms threshold',
        metric_value: 245,
        threshold_value: 200,
        timestamp: '2025-01-27T10:15:00Z',
        resolved: true,
        resolution_time: '2025-01-27T10:22:00Z'
      },
      {
        id: 'guard-002',
        type: 'storage',
        severity: 'low',
        description: 'Cache hit rate below 90% threshold',
        metric_value: 87.3,
        threshold_value: 90,
        timestamp: '2025-01-27T09:45:00Z',
        resolved: true,
        resolution_time: '2025-01-27T10:30:00Z'
      },
      {
        id: 'guard-003',
        type: 'rate_limit',
        severity: 'high',
        description: 'Rate limit violations detected from IP range',
        metric_value: 125,
        threshold_value: 100,
        timestamp: '2025-01-27T08:20:00Z',
        resolved: false
      }
    ],
    summary: {
      total_violations: 15,
      active_violations: 2,
      critical_violations: 0,
      violation_rate: 0.12, // violations per hour
      mttr: 18.5 // minutes
    },
    last_updated: now
  };
}

/**
 * GET /api/v1/dashboard/metrics - Get overall dashboard metrics
 */
export async function getDashboardMetrics(
  request: Request,
  env: CloudflareEnvironment,
  ctx: ExecutionContext,
  headers: Record<string, string>
): Promise<Response> {
  try {
    logger.info('Fetching dashboard metrics');

    const cache = createCacheInstance(env);
    const cacheKey = 'dashboard:metrics:overall';

    // Try to get from cache first
    const cachedMetrics = await cache.get(cacheKey);
    if (cachedMetrics) {
      logger.debug('Dashboard metrics retrieved from cache', { cacheKey });
      const body = ApiResponseFactory.success(cachedMetrics, {
        requestId: headers['X-Request-ID'],
        cached: true
      });
      return new Response(JSON.stringify(body), {
        status: HttpStatus.OK,
        headers
      });
    }

    // Generate fresh metrics
    const metrics = generateSampleDashboardMetrics();

    // Cache the results
    await cache.set(cacheKey, metrics, DASHBOARD_CACHE_TTL);

    logger.info('Dashboard metrics generated and cached', { cacheKey });

    const body = ApiResponseFactory.success(metrics, {
      requestId: headers['X-Request-ID'],
      cached: false,
      ttl: DASHBOARD_CACHE_TTL
    });

    return new Response(JSON.stringify(body), {
      status: HttpStatus.OK,
      headers
    });

  } catch (error: any) {
    logger.error('Error fetching dashboard metrics', {
      error: error.message,
      stack: error.stack
    });

    const body = ApiResponseFactory.error(
      'Failed to fetch dashboard metrics',
      'DASHBOARD_METRICS_ERROR',
      {
        requestId: headers['X-Request-ID'],
        message: error.message
      }
    );

    return new Response(JSON.stringify(body), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers
    });
  }
}

/**
 * GET /api/v1/dashboard/economics - Get cost-to-serve metrics
 */
export async function getCostToServeMetrics(
  request: Request,
  env: CloudflareEnvironment,
  ctx: ExecutionContext,
  headers: Record<string, string>
): Promise<Response> {
  try {
    logger.info('Fetching cost-to-serve metrics');

    const cache = createCacheInstance(env);
    const cacheKey = 'dashboard:economics:cost_to_serve';

    // Try to get from cache first
    const cachedEconomics = await cache.get(cacheKey);
    if (cachedEconomics) {
      logger.debug('Cost-to-serve metrics retrieved from cache', { cacheKey });
      const body = ApiResponseFactory.success(cachedEconomics, {
        requestId: headers['X-Request-ID'],
        cached: true
      });
      return new Response(JSON.stringify(body), {
        status: HttpStatus.OK,
        headers
      });
    }

    // Generate fresh cost-to-serve data
    const economics = generateSampleCostToServeMetrics();

    // Cache the results
    await cache.set(cacheKey, economics, ECONOMICS_CACHE_TTL);

    logger.info('Cost-to-serve metrics generated and cached', { cacheKey });

    const body = ApiResponseFactory.success(economics, {
      requestId: headers['X-Request-ID'],
      cached: false,
      ttl: ECONOMICS_CACHE_TTL
    });

    return new Response(JSON.stringify(body), {
      status: HttpStatus.OK,
      headers
    });

  } catch (error: any) {
    logger.error('Error fetching cost-to-serve metrics', {
      error: error.message,
      stack: error.stack
    });

    const body = ApiResponseFactory.error(
      'Failed to fetch cost-to-serve metrics',
      'ECONOMICS_METRICS_ERROR',
      {
        requestId: headers['X-Request-ID'],
        message: error.message
      }
    );

    return new Response(JSON.stringify(body), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers
    });
  }
}

/**
 * GET /api/v1/dashboard/guards - Get guard violation monitoring data
 */
export async function getGuardViolationData(
  request: Request,
  env: CloudflareEnvironment,
  ctx: ExecutionContext,
  headers: Record<string, string>
): Promise<Response> {
  try {
    logger.info('Fetching guard violation data');

    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Parse query parameters
    const activeOnly = queryParams.active_only === 'true';
    const severity = queryParams.severity as string; // low, medium, high, critical
    const limit = parseInt(queryParams.limit || '50');
    const offset = parseInt(queryParams.offset || '0');

    const cache = createCacheInstance(env);
    const cacheKey = `dashboard:guards:violations:${activeOnly}:${severity}:${limit}:${offset}`;

    // Try to get from cache first
    const cachedViolations = await cache.get(cacheKey);
    if (cachedViolations) {
      logger.debug('Guard violation data retrieved from cache', { cacheKey });
      const body = ApiResponseFactory.success(cachedViolations, {
        requestId: headers['X-Request-ID'],
        cached: true
      });
      return new Response(JSON.stringify(body), {
        status: HttpStatus.OK,
        headers
      });
    }

    // Generate fresh guard violation data
    let violationData = generateSampleGuardViolationData();

    // Apply filters
    if (activeOnly) {
      violationData.violations = violationData.violations.filter(v => !v.resolved);
    }

    if (severity) {
      violationData.violations = violationData.violations.filter(v => v.severity === severity);
    }

    // Apply pagination
    const totalCount = violationData.violations.length;
    violationData.violations = violationData.violations.slice(offset, offset + limit);

    const paginatedData = {
      ...violationData,
      pagination: {
        total_count: totalCount,
        limit,
        offset,
        has_more: offset + limit < totalCount
      }
    };

    // Cache the filtered results
    await cache.set(cacheKey, paginatedData, DASHBOARD_CACHE_TTL);

    logger.info('Guard violation data generated and cached', { cacheKey });

    const body = ApiResponseFactory.success(paginatedData, {
      requestId: headers['X-Request-ID'],
      cached: false,
      ttl: DASHBOARD_CACHE_TTL
    });

    return new Response(JSON.stringify(body), {
      status: HttpStatus.OK,
      headers
    });

  } catch (error: any) {
    logger.error('Error fetching guard violation data', {
      error: error.message,
      stack: error.stack
    });

    const body = ApiResponseFactory.error(
      'Failed to fetch guard violation data',
      'GUARD_VIOLATION_ERROR',
      {
        requestId: headers['X-Request-ID'],
        message: error.message
      }
    );

    return new Response(JSON.stringify(body), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers
    });
  }
}

/**
 * GET /api/v1/dashboard/health - Get dashboard system health
 */
export async function getDashboardHealth(
  request: Request,
  env: CloudflareEnvironment,
  ctx: ExecutionContext,
  headers: Record<string, string>
): Promise<Response> {
  try {
    logger.info('Checking dashboard system health');

    const health = {
      status: 'healthy',
      version: '3.0.0',
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      timestamp: new Date().toISOString(),
      components: {
        api: { status: 'healthy', response_time: 45 },
        cache: { status: 'healthy', hit_rate: 94.2 },
        database: { status: 'healthy', connection_time: 12 },
        ai_models: { status: 'healthy', response_time: 850 }
      },
      metrics: {
        requests_per_minute: 1250,
        error_rate: 0.8,
        memory_usage: 71.8,
        disk_usage: 58.9
      }
    };

    const body = ApiResponseFactory.success(health, {
      requestId: headers['X-Request-ID']
    });

    return new Response(JSON.stringify(body), {
      status: HttpStatus.OK,
      headers
    });

  } catch (error: any) {
    logger.error('Error checking dashboard health', {
      error: error.message,
      stack: error.stack
    });

    const body = ApiResponseFactory.error(
      'Failed to check dashboard health',
      'DASHBOARD_HEALTH_ERROR',
      {
        requestId: headers['X-Request-ID'],
        message: error.message
      }
    );

    return new Response(JSON.stringify(body), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers
    });
  }
}

/**
 * POST /api/v1/dashboard/refresh - Force refresh dashboard data
 */
export async function refreshDashboardData(
  request: Request,
  env: CloudflareEnvironment,
  ctx: ExecutionContext,
  headers: Record<string, string>
): Promise<Response> {
  try {
    logger.info('Force refreshing dashboard data');

    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Parse refresh targets
    const targets = (queryParams.targets || 'all').split(',').map(t => t.trim());

    const cache = createCacheInstance(env);
    const refreshResults: Array<{ target: string; success: boolean; message: string }> = [];

    for (const target of targets) {
      try {
        let cacheKey: string;
        switch (target) {
          case 'metrics':
            cacheKey = 'dashboard:metrics:overall';
            await cache.delete(cacheKey);
            refreshResults.push({ target, success: true, message: 'Metrics cache cleared' });
            break;
          case 'economics':
            cacheKey = 'dashboard:economics:cost_to_serve';
            await cache.delete(cacheKey);
            refreshResults.push({ target, success: true, message: 'Economics cache cleared' });
            break;
          case 'guards':
            // Clear all guard-related cache keys
            const guardKeys = await cache.getKeys('dashboard:guards:*');
            for (const key of guardKeys) {
              await cache.delete(key);
            }
            refreshResults.push({ target, success: true, message: `${guardKeys.length} guard cache entries cleared` });
            break;
          case 'all':
            const allKeys = await cache.getKeys('dashboard:*');
            for (const key of allKeys) {
              await cache.delete(key);
            }
            refreshResults.push({ target, success: true, message: `${allKeys.length} dashboard cache entries cleared` });
            break;
          default:
            refreshResults.push({ target, success: false, message: `Unknown target: ${target}` });
        }
      } catch (error: any) {
        refreshResults.push({ target, success: false, message: error.message });
      }
    }

    logger.info('Dashboard refresh completed', { targets, refreshResults });

    const body = ApiResponseFactory.success({
      refreshed_at: new Date().toISOString(),
      targets_requested: targets,
      results: refreshResults
    }, {
      requestId: headers['X-Request-ID']
    });

    return new Response(JSON.stringify(body), {
      status: HttpStatus.OK,
      headers
    });

  } catch (error: any) {
    logger.error('Error refreshing dashboard data', {
      error: error.message,
      stack: error.stack
    });

    const body = ApiResponseFactory.error(
      'Failed to refresh dashboard data',
      'DASHBOARD_REFRESH_ERROR',
      {
        requestId: headers['X-Request-ID'],
        message: error.message
      }
    );

    return new Response(JSON.stringify(body), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers
    });
  }
}

// Export route handlers for dashboard endpoints
export const dashboardRouteHandlers = {
  'GET /api/v1/dashboard/metrics': getDashboardMetrics,
  'GET /api/v1/dashboard/economics': getCostToServeMetrics,
  'GET /api/v1/dashboard/guards': getGuardViolationData,
  'GET /api/v1/dashboard/health': getDashboardHealth,
  'POST /api/v1/dashboard/refresh': refreshDashboardData,
};