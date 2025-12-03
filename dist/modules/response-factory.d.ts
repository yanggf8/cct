/**
 * Response Factory Module - TypeScript
 * Type-safe, standardized API response formatting for consistent client interaction
 */
export interface ResponseMetadata {
    timestamp: string;
    requestId?: string;
    service?: string;
    [key: string]: any;
}
export interface SuccessResponseOptions {
    status?: number;
    headers?: Record<string, string>;
    requestId?: string | null;
    service?: string | null;
}
export interface ErrorResponseOptions {
    status?: number;
    headers?: Record<string, string>;
    requestId?: string | null;
    service?: string | null;
    details?: any;
}
export interface HealthResponseOptions {
    status?: number;
    requestId?: string | null;
}
export interface Pagination {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
}
export interface DataResponseOptions {
    requestId?: string | null;
    service?: string | null;
    totalCount?: number | null;
    processingTime?: number | null;
}
export interface CronResponseOptions {
    cronExecutionId?: string | null;
    triggerMode?: string | null;
    symbolsAnalyzed?: number;
    duration?: number | null;
}
export interface AnalysisResponseOptions {
    requestId?: string | null;
    symbolsAnalyzed?: number;
    processingTime?: number | null;
    confidence?: number | null;
}
export interface RedirectResponseOptions {
    status?: number;
    temporary?: boolean;
}
export interface StreamingResponseOptions {
    contentType?: string;
    headers?: Record<string, string>;
}
export interface CORSResponseOptions {
    origin?: string;
    methods?: string;
    headers?: string;
}
export interface SuccessResponse {
    success: true;
    data: any;
    metadata: ResponseMetadata;
}
export interface ErrorResponse {
    success: false;
    error: {
        message: string;
        code: string;
        status: number;
        details: any;
    };
    metadata: ResponseMetadata;
}
/**
 * Create a successful API response with standardized format
 */
export declare function createSuccessResponse(data: any, metadata?: Record<string, any>, options?: SuccessResponseOptions): Response;
/**
 * Create an error response with standardized format
 */
export declare function createErrorResponse(error: Error | string, options?: ErrorResponseOptions): Response;
/**
 * Create a health check response
 */
export declare function createHealthResponse(healthData: any, options?: HealthResponseOptions): Response;
/**
 * Create a data API response with pagination support
 */
export declare function createDataResponse(data: any, pagination?: Pagination | null, options?: DataResponseOptions): Response;
/**
 * Create a cron execution response
 */
export declare function createCronResponse(executionData: any, options?: CronResponseOptions): Response;
/**
 * Create an analysis response with confidence metrics
 */
export declare function createAnalysisResponse(analysisData: any, options?: AnalysisResponseOptions): Response;
/**
 * Create a redirect response
 */
export declare function createRedirectResponse(location: string, options?: RedirectResponseOptions): Response;
/**
 * Create a streaming response for large data
 */
export declare function createStreamingResponse(dataStream: ReadableStream, options?: StreamingResponseOptions): Response;
/**
 * Create CORS-enabled response
 */
export declare function createCORSResponse(response: Response, options?: CORSResponseOptions): Response;
/**
 * Handle OPTIONS preflight requests
 */
export declare function createOptionsResponse(options?: CORSResponseOptions): Response;
//# sourceMappingURL=response-factory.d.ts.map