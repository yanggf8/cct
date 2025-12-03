/**
 * Enhanced Worker Entry Point with Data Access Improvements
 * Integrates simplified enhanced DAL and migration management
 *
 * This is the enhanced version of index.js with all improvements from the
 * Data Access Improvement Plan (5 phases complete)
 */
import type { CloudflareEnvironment } from './types.js';
interface EnhancedWorkerAPI {
    scheduled(event: any, env: CloudflareEnvironment, ctx: ExecutionContext): Promise<any>;
    fetch(request: Request, env: CloudflareEnvironment, ctx: ExecutionContext): Promise<Response>;
}
interface SystemStatus {
    status: 'operational' | 'error';
    version: string;
    timestamp: string;
    dal?: any;
    migration?: any;
    error?: string;
}
declare const _default: EnhancedWorkerAPI;
export default _default;
/**
 * Development helper: Reset enhanced handler cache
 */
export declare function resetEnhancedHandler(): void;
/**
 * Development helper: Get system status
 */
export declare function getSystemStatus(env: CloudflareEnvironment): Promise<SystemStatus>;
//# sourceMappingURL=index-enhanced.d.ts.map