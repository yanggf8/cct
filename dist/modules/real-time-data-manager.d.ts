/**
 * Real-time Data Manager
 *
 * Central orchestrator for real-time data ingestion, freshness tracking, cache warming,
 * and predictive analysis updates. Coordinates Yahoo Finance (market prices), FRED
 * (macro), sentiment/news, and market structure fetchers. Optimized for Workers
 * with background processing and rate limiting.
 *
 * Responsibilities:
 * - Parallel, prioritized data fetching with rate limits and circuit breakers
 * - Smart cache TTL adjustments based on market hours
 * - Cache warming strategies ahead of market open
 * - Incremental intraday updates (lightweight refresh)
 * - Data freshness tracking and alerts
 * - Fallbacks during data source outages
 *
 * Usage:
 *  const rtdm = initializeRealTimeDataManager(env)
 *  await rtdm.refreshAll({ priority: 'high', reason: 'pre_market' }, ctx)
 */
import type { CloudflareEnvironment } from '../types.js';
export type UpdatePriority = 'high' | 'normal' | 'low';
export interface RefreshOptions {
    priority?: UpdatePriority;
    reason?: 'pre_market' | 'intraday' | 'end_of_day' | 'weekly' | 'manual' | string;
    symbols?: string[];
    incremental?: boolean;
}
export interface FreshnessRecord {
    source: 'yahoo' | 'fred' | 'sentiment' | 'market_structure' | 'market_drivers' | 'predictions';
    status: 'healthy' | 'degraded' | 'unhealthy';
    updated_at: string;
    details?: any;
}
export declare class RealTimeDataManager {
    private env;
    private cache;
    private dal;
    constructor(env: CloudflareEnvironment);
    refreshAll(opts?: RefreshOptions, ctx?: ExecutionContext): Promise<{
        success: boolean;
        results: any;
    }>;
    refreshIncremental(ctx?: ExecutionContext): Promise<{
        success: boolean;
        results: any;
    }>;
    warmCachesForMarketOpen(symbols?: string[], ctx?: ExecutionContext): Promise<void>;
    private refreshYahooPrices;
    private refreshFred;
    private refreshSentiment;
    private refreshMarketStructure;
    private refreshMarketDrivers;
    private updatePredictions;
    private recordFreshness;
    private getTTLStrategy;
    getFreshnessSummary(): Promise<{
        updated: FreshnessRecord[];
    }>;
}
export declare function initializeRealTimeDataManager(env: CloudflareEnvironment): RealTimeDataManager;
export default RealTimeDataManager;
//# sourceMappingURL=real-time-data-manager.d.ts.map