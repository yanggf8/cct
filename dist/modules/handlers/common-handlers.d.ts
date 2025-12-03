/**
 * Common Handler Patterns and Utilities
 * Shared functionality to reduce code duplication across handlers
 */
import { type DependencyConsistencyResult } from '../kv-consistency.js';
import type { CloudflareEnvironment } from '../../types.js';
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
export type ReportGeneratorFunction<T = any> = (env: CloudflareEnvironment, dateStr: string, context: ReportGeneratorContext) => Promise<T>;
/**
 * Function signature for HTML generators
 */
export type HTMLGeneratorFunction<T = any> = (data: T, dateStr: string, env: CloudflareEnvironment, context: ReportGeneratorContext) => Promise<string>;
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
export type APIFunction<T = any> = (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext, context: {
    requestId: string;
}) => Promise<T>;
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
export type DataRetrieverFunction<T = any> = (key: string, env: CloudflareEnvironment, params: Record<string, string>, context: {
    requestId: string;
}) => Promise<T>;
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
export declare function createReportHandler<T = any>(name: string, dependencies: string[], reportGenerator: ReportGeneratorFunction<T>, htmlGenerator: HTMLGeneratorFunction<T>, options?: ReportHandlerOptions): (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext) => Promise<Response>;
/**
 * Create a standardized API handler with error handling
 *
 * @param name - Handler name
 * @param apiFunction - Main API function
 * @param options - Handler options
 * @returns Handler function
 */
export declare function createAPIHandler<T = any>(name: string, apiFunction: APIFunction<T>, options?: APIHandlerOptions): (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext) => Promise<APIResponse<T>>;
/**
 * Create a standardized data retrieval handler
 *
 * @param name - Handler name
 * @param dataRetriever - Function to retrieve data
 * @param options - Handler options
 * @returns Handler function
 */
export declare function createDataRetrievalHandler<T = any>(name: string, dataRetriever: DataRetrieverFunction<T>, options?: DataRetrievalHandlerOptions): (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext) => Promise<Response>;
/**
 * Standard metrics for dashboard displays
 *
 * @param data - Data object containing metrics
 * @returns Formatted metrics for display
 */
export declare function createStandardMetrics(data: StandardMetricsData): MetricDisplay[];
/**
 * Create a standardized dashboard layout
 *
 * @param title - Dashboard title
 * @param metrics - Metrics array
 * @param mainContent - Main content HTML
 * @param options - Additional options
 * @returns Complete dashboard HTML
 */
export declare function createDashboardLayout(title: string, metrics: MetricDisplay[], mainContent: string, options?: DashboardLayoutOptions): string;
/**
 * Handle common validation patterns
 *
 * @param request - HTTP request
 * @param env - Environment object
 * @param requiredEnvVars - Required environment variables
 * @returns Validation result
 */
export declare function validateRequestEnvironment(request: Request, env: CloudflareEnvironment, requiredEnvVars?: string[]): RequestEnvironmentValidation;
declare const _default: {
    createReportHandler: typeof createReportHandler;
    createAPIHandler: typeof createAPIHandler;
    createDataRetrievalHandler: typeof createDataRetrievalHandler;
    createStandardMetrics: typeof createStandardMetrics;
    createDashboardLayout: typeof createDashboardLayout;
    validateRequestEnvironment: typeof validateRequestEnvironment;
};
export default _default;
//# sourceMappingURL=common-handlers.d.ts.map