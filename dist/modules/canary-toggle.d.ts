/**
 * Canary Toggle System - Gradual Rollout Feature Flags
 * Provides per-route feature flags for safe, gradual feature rollout
 */
import type { CloudflareEnvironment } from '../types.js';
export interface CanaryConfig {
    enabled: boolean;
    percentage: number;
    whitelist: string[];
    blacklist: string[];
    metadata?: Record<string, any>;
}
export interface CanaryContext {
    isInCanary: boolean;
    config: CanaryConfig;
    rolloutPercentage: number;
    userId?: string;
    requestId: string;
    reason?: string;
}
export interface RouteCanaryConfig {
    [route: string]: CanaryConfig;
}
/**
 * Canary Toggle Manager
 * Manages feature flags for gradual rollout
 */
export declare class CanaryToggleManager {
    private env;
    private cache;
    constructor(env: CloudflareEnvironment);
    /**
     * Check if a request should be in the canary group for a specific route
     */
    isInCanary(request: Request, route: string): Promise<CanaryContext>;
    /**
     * Get canary configuration for a specific route
     */
    private getCanaryConfig;
    /**
     * Update canary configuration for a route
     */
    updateCanaryConfig(route: string, config: CanaryConfig): Promise<void>;
    /**
     * Get user ID from request
     */
    private getUserId;
    /**
     * Get request ID from headers or generate one
     */
    private getRequestId;
    /**
     * Check if user is in whitelist
     */
    private isInWhitelist;
    /**
     * Check if user is in blacklist
     */
    private isInBlacklist;
    /**
     * Simple string hashing for consistent hashing
     */
    private hashString;
    /**
     * Consistent hash function (0-99)
     */
    private consistentHash;
    /**
     * Simple pattern matching (supports * wildcards)
     */
    private matchPattern;
    /**
     * Get canary status for all routes
     */
    getAllCanaryStatuses(): Promise<Record<string, CanaryConfig>>;
    /**
     * Enable canary for a route with specific percentage
     */
    enableCanary(route: string, percentage?: number, options?: {
        whitelist?: string[];
        blacklist?: string[];
    }): Promise<void>;
    /**
     * Disable canary for a route
     */
    disableCanary(route: string): Promise<void>;
    /**
     * Clear canary cache
     */
    clearCache(): void;
}
/**
 * Create a canary-aware handler wrapper
 */
export declare function createCanaryHandler(canaryManager: CanaryToggleManager, route: string, canaryHandler: (request: Request, env: CloudflareEnvironment, ctx: any, canaryContext: CanaryContext) => Promise<Response>, stableHandler: (request: Request, env: CloudflareEnvironment, ctx: any) => Promise<Response>): (request: Request, env: CloudflareEnvironment, ctx: any) => Promise<Response>;
//# sourceMappingURL=canary-toggle.d.ts.map