/**
 * Home Dashboard Module
 * Professional trading dashboard following UX/UI design document specifications
 * Role-based hybrid architecture: Dashboard for traders, Console for admins
 */
import type { CloudflareAI } from '../types';
interface Env {
    MARKET_ANALYSIS_CACHE: KVNamespace;
    TRAINED_MODELS: R2Bucket;
    ENHANCED_MODELS: R2Bucket;
    AI: CloudflareAI;
    WORKER_VERSION?: string;
    TRADING_SYMBOLS?: string;
    LOG_LEVEL?: string;
    TIMEZONE?: string;
}
/**
 * Serve the Home Dashboard HTML page
 */
export declare function handleHomeDashboardPage(request: Request, env: Env): Promise<Response>;
export {};
//# sourceMappingURL=home-dashboard.d.ts.map