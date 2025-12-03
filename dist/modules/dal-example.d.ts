/**
 * Data Access Layer (DAL) Usage Example
 * Shows how to use the TypeScript DAL from JavaScript files
 */
import type { CloudflareEnvironment } from '../types.js';
interface TradingSignal {
    symbol: string;
    sentiment_layers: Array<{
        sentiment: string;
        confidence: number;
        reasoning: string;
    }>;
}
interface AnalysisData {
    symbols_analyzed: string[];
    trading_signals: Record<string, TradingSignal>;
    timestamp: string;
}
interface ExampleResponse {
    success: boolean;
    examples_completed?: number;
    error?: string;
}
/**
 * Example: Using DAL in a handler
 */
export declare function exampleHandler(request: Request, env: CloudflareEnvironment): Promise<Response>;
/**
 * Example: Advanced DAL usage with error handling
 */
export declare function advancedDALExample(env: CloudflareEnvironment): Promise<{
    success: boolean;
    operations: Array<{
        operation: string;
        success: boolean;
        duration?: number;
    }>;
    totalDuration: number;
}>;
/**
 * Example: Error handling patterns with DAL
 */
export declare function errorHandlingExample(env: CloudflareEnvironment): Promise<{
    success: boolean;
    errors: Array<{
        type: string;
        message: string;
        recovered: boolean;
    }>;
}>;
/**
 * Documentation: Replacing direct KV access
 *
 * BEFORE (Direct KV access):
 * ```js
 * const key = `analysis_${date}`;
 * const data = await env.MARKET_ANALYSIS_CACHE.get(key);
 * const parsed = JSON.parse(data);
 * ```
 *
 * AFTER (Using DAL):
 * ```js
 * const dal = createDAL(env);
 * const result = await dal.getAnalysis(date);
 * if (result.success) {
 *   const parsed = result.data;
 * }
 * ```
 *
 * Benefits:
 * - Type safety from TypeScript
 * - Automatic retry logic
 * - Consistent error handling
 * - KV Key Factory integration
 * - Comprehensive logging
 * - Built-in caching support
 * - Read-after-write consistency patterns
 */
declare const _default: {
    exampleHandler: typeof exampleHandler;
    advancedDALExample: typeof advancedDALExample;
    errorHandlingExample: typeof errorHandlingExample;
};
export default _default;
export type { AnalysisData, TradingSignal, ExampleResponse };
//# sourceMappingURL=dal-example.d.ts.map