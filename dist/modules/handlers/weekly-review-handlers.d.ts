/**
 * Weekly Review Handler
 * Analyzes high-confidence signal accuracy patterns and provides comprehensive weekly insights
 */
import type { CloudflareEnvironment } from '../../types';
/**
 * Generate Weekly Review Page
 */
export declare const handleWeeklyReview: import("../handler-factory.js").HandlerFunction<Response>;
/**
 * Send weekly review with tracking (cron job integration)
 */
export declare function sendWeeklyReviewWithTracking(analysisResult: any, env: CloudflareEnvironment, cronExecutionId: string): Promise<void>;
//# sourceMappingURL=weekly-review-handlers.d.ts.map