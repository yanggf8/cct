/**
 * Decomposed Intraday Handler Example
 *
 * This demonstrates how to replace the 932-line intraday-handlers.js
 * with a clean, modular architecture using the new common patterns.
 *
 * BEFORE: 932 lines with mixed concerns (data retrieval, HTML generation, business logic)
 * AFTER: ~200 lines with clear separation of concerns
 */
import type { CloudflareEnvironment } from '../../types';
/**
 * Main decomposed intraday handler
 */
export declare const handleIntradayCheckDecomposed: (request: Request, env: CloudflareEnvironment, ctx: ExecutionContext) => Promise<Response>;
//# sourceMappingURL=intraday-decomposed.d.ts.map