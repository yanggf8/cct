/**
 * Business Intelligence Dashboard Routes
 * Provides endpoints for real-time BI dashboards and cost-to-serve intelligence
 * Phase 3 Implementation: Live data wired to monitoring systems (no fake samples)
 */

import { createLogger } from '../../modules/logging.js';
import { ApiResponseFactory, HttpStatus } from '../../modules/api-v1-responses.js';
import { createCacheInstance } from '../../modules/dual-cache-do.js';
import { initializeRealTimeMonitoring, type Alert } from '../../modules/real-time-monitoring.js';
import type { CloudflareEnvironment } from '../../types.js';

const logger = createLogger('dashboard-routes');

// Cache TTL hints (responses are generated live, TTL is advisory for clients)
const DASHBOARD_CACHE_TTL = 300; // 5 minutes
const ECONOMICS_CACHE_TTL = 3600; // 1 hour

interface DashboardMetrics {
  operational_health: {
    overall_score: number;
    api_response_time: number;
    cache_hit_rate: number;
    error_rate: number;
    throughput: number;
    real_data_available?: boolean;
    cpu_utilization?: number | null;
    memory_usage?: number | null;
    storage_utilization?: number | null;
    network_latency?: number | null;
  };
  system_performance?: {
    cpu_utilization?: number | null;
    memory_usage?: number | null;
    storage_utilization?: number | null;
    network_latency?: number | null;
  };
  business_metrics: {
    daily_requests: number;
    cost_per_request: number | null;
    data_volume_processed: number | null;
    active_users: number | null;
  };
  guard_status: {
    violations_total: number;
    active_violations: number;
    critical_alerts: number;
    last_violation_time: string | null;
  };
  last_updated: string;
  source?: 'live' | 'fallback';
}

interface CostToServeMetrics {
  storage_costs: Record<string, number | null> | null;
  compute_costs: Record<string, number | null> | null;
  bandwidth_costs: Record<string, number | null> | null;
  total_monthly_cost: number | null;
  cost_per_request: number | null;
  cost_efficiency_score: number | null;
  projected_monthly_cost: number | null;
  last_updated: string;
  data_available: boolean;
  notes?: string;
  usage_sample?: {
    requests_per_minute: number;
  };
}

interface GuardViolationData {
  violations: Array<{
    id: string;
    type: 'storage' | 'rate_limit' | 'performance' | 'security';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    metric_value: number | null;
    threshold_value: number | null;
    timestamp: string;
    resolved: boolean;
    resolution_time?: string;
  }>;
  summary: {
    total_violations: number;
    active_violations: number;
    critical_violations: number;
    violation_rate: number | null;
    mttr: number | null; // Mean Time To Resolution in minutes
  };
  pagination: {
    total_count: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  last_updated: string;
  data_source?: string;
}

function normalizeHitRate(value?: number | null): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }

  return value > 1 ? value : value * 100;
}

function mapAlertSeverity(alert: Alert): GuardViolationData['violations'][number]['severity'] {
  switch (alert.type) {
    case 'critical':
      return 'critical';
    case 'warning':
      return 'high';
    default:
      return 'medium';
  }
}

function mapAlertCategory(alert: Alert): GuardViolationData['violations'][number]['type'] {
  switch (alert.category) {
    case 'performance':
      return 'performance';
    case 'data_quality':
      return 'storage';
    case 'system':
      return 'security';
    default:
      return 'rate_limit';
  }
}

// Singleton monitoring instance per isolate to accumulate alerts/history
let monitoringInstance: ReturnType<typeof initializeRealTimeMonitoring> | null = null;

function getMonitoringInstance(env: CloudflareEnvironment) {
  if (!monitoringInstance) {
    monitoringInstance = initializeRealTimeMonitoring(env, {
      alertingEnabled: true,
      performanceTrackingEnabled: true,
      metricsRetentionHours: 6
    });
  }
  return monitoringInstance;
}

async function getMonitoringSnapshot(env: CloudflareEnvironment) {
  const monitoring = getMonitoringInstance(env);

  const dashboard = await monitoring.getDashboardData();
  const cache = createCacheInstance(env);
  const cacheStats = cache ? await cache.getStats() : null;

  return { dashboard, cacheStats };
}

function buildGuardSummary(alerts: Alert[]): DashboardMetrics['guard_status'] {
  const latestViolationTime = alerts.length > 0
    ? alerts
      .map(alert => alert.timestamp)
      .sort()
      .reverse()[0]
    : null;

  return {
    violations_total: alerts.length,
    active_violations: alerts.filter(alert => !alert.resolved).length,
    critical_alerts: alerts.filter(alert => alert.type === 'critical').length,
    last_violation_time: latestViolationTime || null
  };
}

function buildGuardViolations(
  alerts: Alert[],
  options: { activeOnly: boolean; severity?: string; limit: number; offset: number }
): GuardViolationData {
  let violations = alerts.map(alert => ({
    id: alert.id,
    type: mapAlertCategory(alert),
    severity: mapAlertSeverity(alert),
    description: alert.message,
    metric_value: alert.metadata?.value ?? null,
    threshold_value: alert.metadata?.threshold ?? null,
    timestamp: alert.timestamp,
    resolved: alert.resolved,
    resolution_time: alert.resolved_at
  }));

  if (options.activeOnly) {
    violations = violations.filter(v => !v.resolved);
  }

  if (options.severity) {
    violations = violations.filter(v => v.severity === options.severity);
  }

  const totalCount = violations.length;
  const paginated = violations.slice(options.offset, options.offset + options.limit);

  return {
    violations: paginated,
    summary: {
      total_violations: violations.length,
      active_violations: violations.filter(v => !v.resolved).length,
      critical_violations: violations.filter(v => v.severity === 'critical').length,
      violation_rate: null,
      mttr: null
    },
    pagination: {
      total_count: totalCount,
      limit: options.limit,
      offset: options.offset,
      has_more: options.offset + options.limit < totalCount
    },
    last_updated: new Date().toISOString(),
    data_source: 'live'
  };
}

async function buildDashboardMetrics(env: CloudflareEnvironment): Promise<DashboardMetrics> {
  const { dashboard, cacheStats } = await getMonitoringSnapshot(env);
  const systemMetrics = dashboard.system_metrics;

  const cacheHitRate = normalizeHitRate(cacheStats?.hitRate ?? systemMetrics.data_quality.cache_hit_rate);
  const dailyRequests = systemMetrics.performance.requests_per_minute * 60 * 24;

  const metrics: DashboardMetrics = {
    operational_health: {
      overall_score: systemMetrics.system_health.overall_score,
      api_response_time: systemMetrics.performance.average_response_time_ms,
      cache_hit_rate: cacheHitRate,
      error_rate: systemMetrics.performance.error_rate,
      throughput: systemMetrics.performance.requests_per_minute,
      real_data_available: systemMetrics.data_quality.real_data_available,
      cpu_utilization: null,
      memory_usage: null,
      storage_utilization: cacheStats?.totalEntries ?? null,
      network_latency: null
    },
    system_performance: {
      cpu_utilization: null,
      memory_usage: null,
      storage_utilization: cacheStats?.totalEntries ?? null,
      network_latency: null
    },
    business_metrics: {
      daily_requests: dailyRequests,
      cost_per_request: env.COST_PER_REQUEST ? Number(env.COST_PER_REQUEST) : null,
      data_volume_processed: null,
      active_users: null
    },
    guard_status: buildGuardSummary(dashboard.active_alerts),
    last_updated: dashboard.timestamp,
    source: 'live'
  };

  return metrics;
}

async function buildCostToServeMetrics(env: CloudflareEnvironment): Promise<CostToServeMetrics> {
  const { dashboard } = await getMonitoringSnapshot(env);
  const requestsPerMinute = dashboard.system_metrics.performance.requests_per_minute || 0;
  const costPerRequestEnv = env.COST_PER_REQUEST || env.DASHBOARD_COST_PER_REQUEST;
  const costPerRequestRaw = costPerRequestEnv ? Number(costPerRequestEnv) : null;
  const costPerRequest = costPerRequestRaw !== null && Number.isFinite(costPerRequestRaw) ? costPerRequestRaw : null;

  const monthlyRequests = requestsPerMinute * 60 * 24 * 30;
  const totalMonthlyCost = costPerRequest !== null
    ? Number((monthlyRequests * costPerRequest).toFixed(4))
    : null;

  return {
    storage_costs: null,
    compute_costs: null,
    bandwidth_costs: null,
    total_monthly_cost: totalMonthlyCost,
    cost_per_request: costPerRequest,
    cost_efficiency_score: null,
    projected_monthly_cost: totalMonthlyCost,
    last_updated: dashboard.timestamp,
    data_available: costPerRequest !== null,
    notes: costPerRequest
      ? 'Calculated from live request volume and COST_PER_REQUEST'
      : 'COST_PER_REQUEST not configured or invalid; returning live volume without cost breakdown',
    usage_sample: {
      requests_per_minute: requestsPerMinute
    }
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

    const metrics = await buildDashboardMetrics(env);

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

    const economics = await buildCostToServeMetrics(env);

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

    const activeOnly = queryParams.active_only === 'true';
    const severity = queryParams.severity as string;
    const limit = parseInt(queryParams.limit || '50', 10);
    const offset = parseInt(queryParams.offset || '0', 10);

    const { dashboard } = await getMonitoringSnapshot(env);
    const guardData = buildGuardViolations(dashboard.active_alerts, {
      activeOnly,
      severity,
      limit,
      offset
    });

    const body = ApiResponseFactory.success(guardData, {
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

    const { dashboard, cacheStats } = await getMonitoringSnapshot(env);
    const systemMetrics = dashboard.system_metrics;

    const health = {
      status: systemMetrics.system_health.status,
      version: '3.0.0',
      uptime: Math.floor((systemMetrics.uptime_ms || 0) / 1000),
      timestamp: new Date().toISOString(),
      components: {
        api: { status: systemMetrics.api_health.fred_api, response_time: systemMetrics.performance.average_response_time_ms },
        cache: { status: systemMetrics.api_health.cache_system, hit_rate: normalizeHitRate(cacheStats?.hitRate ?? systemMetrics.data_quality.cache_hit_rate) },
        database: { status: 'unknown', connection_time: null },
        ai_models: { status: systemMetrics.api_health.ai_models, response_time: systemMetrics.performance.average_response_time_ms }
      },
      metrics: {
        requests_per_minute: systemMetrics.performance.requests_per_minute,
        error_rate: systemMetrics.performance.error_rate,
        memory_usage: null,
        disk_usage: cacheStats?.memoryUsage ?? null
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
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const targets = (queryParams.targets || 'all').split(',').map(t => t.trim());

    logger.info('Dashboard refresh requested', { targets });

    // No server-side cache is used for dashboard responses, so nothing to clear.
    const body = ApiResponseFactory.success({
      refreshed_at: new Date().toISOString(),
      targets_requested: targets,
      message: 'Dashboard responses are generated live; no cached entries were cleared.'
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
