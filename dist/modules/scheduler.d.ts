/**
 * Cron Scheduler Module - TypeScript
 * Handles all scheduled events (cron triggers) - fully modular
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Type Definitions
 */
export interface ScheduledController {
    scheduledTime: number | string | Date;
    cron?: string;
}
export interface AnalysisResult {
    symbols_analyzed?: string[];
    trading_signals?: Record<string, any>;
    timestamp?: string;
    trigger_mode?: string;
    cron_execution_id?: string;
    last_updated?: string;
    [key: string]: any;
}
export interface CronResponse {
    success: boolean;
    trigger_mode?: string;
    symbols_analyzed?: number;
    execution_id?: string;
    timestamp?: string;
    error?: string;
}
export interface SlackAlert {
    text: string;
    attachments?: Array<{
        color: string;
        fields: Array<{
            title: string;
            value: string;
            short: boolean;
        }>;
    }>;
}
/**
 * Handle scheduled cron events
 */
export declare function handleScheduledEvent(controller: ScheduledController, env: CloudflareEnvironment, ctx: ExecutionContext): Promise<Response>;
//# sourceMappingURL=scheduler.d.ts.map