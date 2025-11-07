/**
 * Common Handler Patterns and Utilities
 * Shared functionality to reduce code duplication across handlers
 */

import { createLogger } from '../logging.js';
import { createHandler, type EnhancedContext } from '../handler-factory.js';
import {
  generateCompletePage,
  generateWaitingDisplay,
  generateErrorDisplay,
  generateMetricsGrid,
  generateSuccessDisplay
} from '../html-generators.js';
import { validateDependencies, type DependencyValidationResult } from '../kv-utils.js';
import { verifyDependencyConsistency, type DependencyConsistencyResult } from '../kv-consistency.js';
import type { CloudflareEnvironment } from '../../types.js';

const logger = createLogger('common-handlers');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Options for creating report handlers
 */
export interface ReportHandlerOptions {
  /** Report title displayed in UI */
  title?: string;
  /** Report description */
  description?: string;
  /** Enable performance metrics collection */
  enableMetrics?: boolean;
  /** Handler timeout in milliseconds */
  timeout?: number;
}

/**
 * Context passed to report generators
 */
export interface ReportGeneratorContext {
  /** Unique request identifier */
  requestId: string;
  /** Additional metadata */
  [key: string]: any;
}

/**
 * Function signature for report data generators
 */
export type ReportGeneratorFunction<T = any> = (
  env: CloudflareEnvironment,
  dateStr: string,
  context: ReportGeneratorContext
) => Promise<T>;

/**
 * Function signature for HTML generators
 */
export type HTMLGeneratorFunction<T = any> = (
  data: T,
  dateStr: string,
  env: CloudflareEnvironment,
  context: ReportGeneratorContext
) => Promise<string>;

/**
 * Waiting display data structure
 */
export interface WaitingDisplayData {
  missing: string[];
  completionRate: number;
  consistencyResults?: DependencyConsistencyResult | null;
}

/**
 * Error display data structure
 */
export interface ErrorDisplayData {
  error: string;
  requestId: string;
  timestamp: string;
}

/**
 * Options for creating API handlers
 */
export interface APIHandlerOptions {
  /** Enable authentication checks */
  enableAuth?: boolean;
  /** List of required URL parameters */
  requiredParams?: string[];
  /** Enable performance metrics collection */
  enableMetrics?: boolean;
  /** Handler timeout in milliseconds */
  timeout?: number;
}

/**
 * API function signature
 */
export type APIFunction<T = any> = (
  request: Request,
  env: CloudflareEnvironment,
  ctx: ExecutionContext,
  context: { requestId: string }
) => Promise<T>;

/**
 * API response structure
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  requestId: string;
  timestamp: string;
}

/**
 * Options for creating data retrieval handlers
 */
export interface DataRetrievalHandlerOptions {
  /** Function to generate KV key from parameters */
  keyFormat?: (params: Record<string, string>) => string;
  /** Default value if data not found */
  defaultValue?: any;
  /** Optional TTL for cached data in seconds */
  ttl?: number;
  /** Enable performance metrics collection */
  enableMetrics?: boolean;
}

/**
 * Data retriever function signature
 */
export type DataRetrieverFunction<T = any> = (
  key: string,
  env: CloudflareEnvironment,
  params: Record<string, string>,
  context: { requestId: string }
) => Promise<T>;

/**
 * Standard metrics data structure
 */
export interface StandardMetricsData {
  accuracy?: number;
  accuracyTrend?: 'Up' | 'Down' | 'Stable';
  totalSignals?: number;
  signalsTrend?: 'Up' | 'Down' | 'Stable';
  highConfidenceSignals?: number;
  confidenceTrend?: 'Up' | 'Down' | 'Stable';
  processingTime?: number;
  timeTrend?: 'Up' | 'Down' | 'Optimal';
}

/**
 * Metric display structure
 */
export interface MetricDisplay {
  label: string;
  value: string | number;
  trend: string;
  trendColor: string;
}

/**
 * Navigation tab structure
 */
export interface NavigationTab {
  id: string;
  label: string;
  active?: boolean;
  url?: string;
}

/**
 * Dashboard layout options
 */
export interface DashboardLayoutOptions {
  /** Dashboard subtitle */
  subtitle?: string;
  /** Dashboard status */
  status?: string;
  /** Navigation tabs */
  tabs?: NavigationTab[];
}

/**
 * Request environment validation result
 */
export interface RequestEnvironmentValidation {
  isValid: boolean;
  errors: string[];
}

// ============================================================================
// Report Handler Creation
// ============================================================================

/**
 * Create a standardized report handler with dependency validation
 *
 * @param name - Handler name
 * @param dependencies - Required dependencies
 * @param reportGenerator - Function to generate report data
 * @param htmlGenerator - Function to generate HTML from data
 * @param options - Handler options
 * @returns Handler function
 */
export function createReportHandler<T = any>(
  name: string,
  dependencies: string[],
  reportGenerator: ReportGeneratorFunction<T>,
  htmlGenerator: HTMLGeneratorFunction<T>,
  options: ReportHandlerOptions = {}
): (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext) => Promise<Response> {
  const {
    title,
    description,
    enableMetrics = true,
    timeout = 30000
  } = options;

  return createHandler(name, async (request: Request, env: CloudflareEnvironment, ctx: EnhancedContext): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    logger.info(`📊 [${name.toUpperCase()}] Starting report generation`, {
      requestId,
      date: dateStr,
      dependencies
    });

    try {
      // Enhanced dependency validation with consistency checking
      logger.debug(`🔗 [${name.toUpperCase()}] Checking dependencies`, { requestId, dependencies });

      const validation: DependencyValidationResult = await validateDependencies(dateStr, dependencies, env);

      if (!validation.isValid) {
        logger.warn(`⚠️ [${name.toUpperCase()}] Dependencies not satisfied`, {
          requestId,
          missing: validation.missing,
          completionRate: validation.completionRate
        });

        // For enhanced consistency, try KV consistency check
        let consistencyResults: DependencyConsistencyResult | null = null;
        try {
          consistencyResults = await verifyDependencyConsistency(dateStr, dependencies, env);
          logger.debug(`🔄 [${name.toUpperCase()}] KV consistency check results`, {
            requestId,
            consistentJobs: consistencyResults.consistentJobs,
            inconsistentJobs: consistencyResults.inconsistentJobs
          });
        } catch (consistencyError: any) {
          logger.debug(`🔄 [${name.toUpperCase()}] KV consistency check failed`, {
            requestId,
            error: consistencyError.message
          });
        }

        const waitingContent: string = generateWaitingDisplay(
          `${name.replace(/-/g, ' ').toUpperCase()} - Waiting for Required Data`,
          {
            missing: validation.missing,
            completionRate: validation.completionRate,
            consistencyResults
          } as WaitingDisplayData
        );

        return new Response(generateCompletePage(title, description, waitingContent), {
          headers: { 'Content-Type': 'text/html' }
        });
      }

      logger.debug(`✅ [${name.toUpperCase()}] Dependencies satisfied, generating report`, { requestId });

      // Generate report data
      const reportData: T = await reportGenerator(env, dateStr, { requestId });

      // Generate HTML from report data
      const content: string = await htmlGenerator(reportData, dateStr, env, { requestId });

      logger.info(`✅ [${name.toUpperCase()}] Report generated successfully`, {
        requestId,
        duration: Date.now() - startTime,
        dataSize: content.length
      });

      return new Response(generateCompletePage(title, description, content), {
        headers: { 'Content-Type': 'text/html' }
      });

    } catch (error: any) {
      logger.error(`❌ [${name.toUpperCase()}] Report generation failed`, {
        requestId,
        error: error.message,
        stack: error.stack
      });

      const errorContent: string = generateErrorDisplay(
        `Failed to generate ${name.replace(/-/g, ' ')} report`,
        {
          error: error.message,
          requestId,
          timestamp: new Date().toISOString()
        } as ErrorDisplayData
      );

      return new Response(generateCompletePage(title, description, errorContent, 'Error'), {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }, {
    enableMetrics,
    timeout
  });
}

// ============================================================================
// API Handler Creation
// ============================================================================

/**
 * Create a standardized API handler with error handling
 *
 * @param name - Handler name
 * @param apiFunction - Main API function
 * @param options - Handler options
 * @returns Handler function
 */
export function createAPIHandler<T = any>(
  name: string,
  apiFunction: APIFunction<T>,
  options: APIHandlerOptions = {}
): (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext) => Promise<APIResponse<T>> {
  const {
    enableAuth = false,
    requiredParams = [],
    enableMetrics = true,
    timeout = 30000
  } = options;

  return (createHandler(name, async (request: Request, env: CloudflareEnvironment, ctx: EnhancedContext): Promise<APIResponse<T>> => {
    const requestId = crypto.randomUUID();

    logger.info(`🔧 [${name.toUpperCase()}] API request started`, {
      requestId,
      method: request.method,
      url: request.url
    });

    try {
      // Validate required parameters
      const url = new URL(request.url);
      const missingParams: string[] = requiredParams.filter(param => !url.searchParams.get(param));

      if (missingParams.length > 0) {
        logger.warn(`⚠️ [${name.toUpperCase()}] Missing required parameters`, {
          requestId,
          missingParams
        });

        return {
          success: false,
          error: `Missing required parameters: ${missingParams.join(', ')}`,
          requestId,
          timestamp: new Date().toISOString()
        };
      }

      // Execute API function
      const result: T = await apiFunction(request, env, ctx, { requestId });

      logger.info(`✅ [${name.toUpperCase()}] API request completed`, {
        requestId,
        duration: Date.now() - (ctx.startTime || Date.now())
      });

      return {
        success: true,
        data: result,
        requestId,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      logger.error(`❌ [${name.toUpperCase()}] API request failed`, {
        requestId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        requestId,
        timestamp: new Date().toISOString()
      };
    }
  }), {
    enableAuth,
    enableMetrics,
    timeout
  }) as any;
}

// ============================================================================
// Data Retrieval Handler Creation
// ============================================================================

/**
 * Create a standardized data retrieval handler
 *
 * @param name - Handler name
 * @param dataRetriever - Function to retrieve data
 * @param options - Handler options
 * @returns Handler function
 */
export function createDataRetrievalHandler<T = any>(
  name: string,
  dataRetriever: DataRetrieverFunction<T>,
  options: DataRetrievalHandlerOptions = {}
): (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext) => Promise<Response> {
  const {
    keyFormat, // Function to generate KV key from parameters
    defaultValue, // Default value if data not found
    ttl, // Optional TTL for cached data
    enableMetrics = true
  } = options;

  return createHandler(name, async (request: Request, env: CloudflareEnvironment): Promise<Response> => {
    const requestId = crypto.randomUUID();

    logger.info(`📥 [${name.toUpperCase()}] Data retrieval started`, {
      requestId,
      url: request.url
    });

    try {
      const url = new URL(request.url);
      const params: Record<string, string> = Object.fromEntries(url.searchParams);

      // Generate key based on parameters
      const key: string = keyFormat ? keyFormat(params) : `${name}_${JSON.stringify(params)}`;

      // Try to retrieve data
      const data: T = await dataRetriever(key, env, params, { requestId });

      if (!data && defaultValue !== undefined) {
        logger.info(`📥 [${name.toUpperCase()}] Using default value`, { requestId, key });
        return new Response(JSON.stringify(defaultValue), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      logger.info(`✅ [${name.toUpperCase()}] Data retrieved successfully`, {
        requestId,
        key,
        dataSize: JSON.stringify(data).length
      });

      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': ttl ? `public, max-age=${ttl}` : 'no-cache'
        }
      });

    } catch (error: any) {
      logger.error(`❌ [${name.toUpperCase()}] Data retrieval failed`, {
        requestId,
        error: error.message
      });

      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        requestId,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }, {
    enableMetrics
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Standard metrics for dashboard displays
 *
 * @param data - Data object containing metrics
 * @returns Formatted metrics for display
 */
export function createStandardMetrics(data: StandardMetricsData): MetricDisplay[] {
  const metrics: MetricDisplay[] = [];

  if (data.accuracy !== undefined) {
    metrics.push({
      label: 'Accuracy',
      value: `${Math.round(data.accuracy * 100)}%`,
      trend: data.accuracyTrend || 'Stable',
      trendColor: data.accuracyTrend === 'Up' ? '#2ecc71' : data.accuracyTrend === 'Down' ? '#e74c3c' : '#6c757d'
    });
  }

  if (data.totalSignals !== undefined) {
    metrics.push({
      label: 'Total Signals',
      value: data.totalSignals,
      trend: data.signalsTrend || 'Stable',
      trendColor: data.signalsTrend === 'Up' ? '#2ecc71' : data.signalsTrend === 'Down' ? '#e74c3c' : '#6c757d'
    });
  }

  if (data.highConfidenceSignals !== undefined) {
    metrics.push({
      label: 'High Confidence',
      value: data.highConfidenceSignals,
      trend: data.confidenceTrend || 'Stable',
      trendColor: data.confidenceTrend === 'Up' ? '#2ecc71' : data.confidenceTrend === 'Down' ? '#e74c3c' : '#6c757d'
    });
  }

  if (data.processingTime !== undefined) {
    metrics.push({
      label: 'Processing Time',
      value: `${data.processingTime}ms`,
      trend: data.timeTrend || 'Optimal',
      trendColor: data.timeTrend === 'Up' ? '#e74c3c' : data.timeTrend === 'Down' ? '#2ecc71' : '#6c757d'
    });
  }

  return metrics;
}

/**
 * Create a standardized dashboard layout
 *
 * @param title - Dashboard title
 * @param metrics - Metrics array
 * @param mainContent - Main content HTML
 * @param options - Additional options
 * @returns Complete dashboard HTML
 */
export function createDashboardLayout(
  title: string,
  metrics: MetricDisplay[],
  mainContent: string,
  options: DashboardLayoutOptions = {}
): string {
  const {
    subtitle = '',
    status = 'Operational',
    tabs = null
  } = options;

  let content = '';

  // Add navigation tabs if provided
  if (tabs) {
    // Note: generateNavigationTabs would need to be implemented in html-generators
    // content += generateNavigationTabs(tabs);
  }

  // Add metrics grid if metrics provided
  if (metrics.length > 0) {
    content += generateMetricsGrid(metrics);
  }

  // Add main content
  content += mainContent;

  return generateCompletePage(
    title,
    subtitle || `${title} - TFT Trading System Dashboard`,
    content,
    status
  );
}

/**
 * Handle common validation patterns
 *
 * @param request - HTTP request
 * @param env - Environment object
 * @param requiredEnvVars - Required environment variables
 * @returns Validation result
 */
export function validateRequestEnvironment(
  request: Request,
  env: CloudflareEnvironment,
  requiredEnvVars: string[] = []
): RequestEnvironmentValidation {
  const errors: string[] = [];

  // Check required environment variables
  for (const varName of requiredEnvVars) {
    if (!env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Check API key for sensitive operations
  const apiKey = request.headers.get('X-API-Key');
  if (requiredEnvVars.includes('WORKER_API_KEY') && (!apiKey || apiKey !== env.WORKER_API_KEY)) {
    errors.push('Invalid or missing API key');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  createReportHandler,
  createAPIHandler,
  createDataRetrievalHandler,
  createStandardMetrics,
  createDashboardLayout,
  validateRequestEnvironment
};

// Types are already exported inline - no need for redundant export block