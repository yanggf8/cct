/**
 * Handler Factory Module
 * Standardized handler creation with built-in logging, monitoring, and error handling
 */
import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';
interface HandlerOptions {
    timeout?: number;
    enableMetrics?: boolean;
    enableAuth?: boolean;
    requiredAuth?: boolean;
}
interface ValidationSchema {
    required?: string[];
    [key: string]: any;
}
interface EnhancedContext extends ExecutionContext {
    requestId: string;
    logger: ReturnType<typeof createLogger>;
    startTime: number;
    userAgent: string;
    cronExecutionId?: string;
    estTime?: Date;
    scheduledTime?: Date;
    validatedBody?: any;
}
interface HandlerFunction<T = Response> {
    (request: Request, env: CloudflareEnvironment, ctx: EnhancedContext): Promise<T>;
}
interface CronHandlerFunction {
    (controller: ScheduledController, env: CloudflareEnvironment, ctx: EnhancedContext): Promise<any>;
}
interface HealthCheckFunction {
    (env: CloudflareEnvironment, ctx: EnhancedContext): Promise<Record<string, any>>;
}
interface APIResponse {
    success: boolean;
    error?: string;
    requestId?: string;
    service?: string;
    timestamp?: string;
    status?: string;
    [key: string]: any;
}
interface CronContext extends ExecutionContext {
    cronExecutionId: string;
    logger: ReturnType<typeof createLogger>;
    estTime: Date;
    scheduledTime: Date;
}
/**
 * Create a standardized handler with built-in logging and monitoring
 */
export declare function createHandler<T = Response>(serviceName: string, handlerFn: HandlerFunction<T>, options?: HandlerOptions): HandlerFunction<T | Response>;
/**
 * Create a cron handler with specialized cron monitoring
 */
export declare function createCronHandler(serviceName: string, cronHandlerFn: CronHandlerFunction): (controller: ScheduledController, env: CloudflareEnvironment, ctx: ExecutionContext) => Promise<any>;
/**
 * Create an API handler with built-in request validation
 */
export declare function createAPIHandler(serviceName: string, apiHandlerFn: HandlerFunction, validationSchema?: ValidationSchema | null): HandlerFunction;
/**
 * Create a health check handler with system diagnostics
 */
export declare function createHealthHandler(serviceName: string, healthCheckFn: HealthCheckFunction): HandlerFunction;
/**
 * Create a batch handler for processing multiple items
 */
export declare function createBatchHandler<T = any>(serviceName: string, batchHandlerFn: (items: T[], env: CloudflareEnvironment, ctx: EnhancedContext) => Promise<any>, options?: {
    maxBatchSize?: number;
    timeout?: number;
    enableMetrics?: boolean;
}): HandlerFunction;
/**
 * Create a cached handler with built-in caching support
 */
export declare function createCachedHandler<T = any>(serviceName: string, handlerFn: HandlerFunction<T>, options?: {
    cacheKey?: (request: Request) => string;
    cacheTTL?: number;
    enableMetrics?: boolean;
}): HandlerFunction<T | Response>;
export type { HandlerOptions, ValidationSchema, EnhancedContext, HandlerFunction, CronHandlerFunction, HealthCheckFunction, APIResponse, CronContext };
//# sourceMappingURL=handler-factory.d.ts.map