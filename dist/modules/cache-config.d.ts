/**
 * Cache Configuration Module - TypeScript
 * Centralized cache namespace and TTL configuration
 * Phase 2: Enhanced Caching System - Data Access Improvement Plan
 */
import type { CacheNamespace, CacheLevelConfig } from './cache-manager.js';
/**
 * Default cache TTL configurations (in seconds)
 */
export declare const CACHE_TTL: {
    readonly INSTANT: 15;
    readonly SHORT: 60;
    readonly MEDIUM: 300;
    readonly LONG: 1800;
    readonly EXTENDED: 3600;
    readonly DAILY: 86400;
    readonly WEEKLY: 604800;
};
/**
 * Cache level configurations
 */
export declare const CACHE_LEVELS: {
    readonly L1_SMALL: CacheLevelConfig;
    readonly L1_MEDIUM: CacheLevelConfig;
    readonly L1_LARGE: CacheLevelConfig;
    readonly L2_SHORT: CacheLevelConfig;
    readonly L2_MEDIUM: CacheLevelConfig;
    readonly L2_LONG: CacheLevelConfig;
};
/**
 * Predefined cache namespaces
 */
export declare const CACHE_NAMESPACES: Record<string, CacheNamespace>;
/**
 * Cache strategy presets for different use cases
 */
export declare const CACHE_STRATEGIES: {
    readonly REALTIME: {
        readonly l1TTL: 15;
        readonly l2TTL: 60;
        readonly l1MaxSize: 50;
        readonly aggressiveRefresh: true;
    };
    readonly INTERACTIVE: {
        readonly l1TTL: 60;
        readonly l2TTL: 300;
        readonly l1MaxSize: 100;
        readonly aggressiveRefresh: false;
    };
    readonly BATCH: {
        readonly l1TTL: 300;
        readonly l2TTL: 1800;
        readonly l1MaxSize: 200;
        readonly aggressiveRefresh: false;
    };
    readonly REFERENCE: {
        readonly l1TTL: 1800;
        readonly l2TTL: 86400;
        readonly l1MaxSize: 500;
        readonly aggressiveRefresh: false;
    };
};
/**
 * Cache invalidation strategies
 */
export declare const CACHE_INVALIDATION: {
    readonly TIME_BASED: "time_based";
    readonly MANUAL: "manual";
    readonly EVENT_DRIVEN: "event_driven";
    readonly TAG_BASED: "tag_based";
};
/**
 * Cache tags for grouped invalidation
 */
export declare const CACHE_TAGS: {
    readonly SENTIMENT: "sentiment";
    readonly MARKET_DATA: "market_data";
    readonly SECTOR_DATA: "sector_data";
    readonly REPORTS: "reports";
    readonly API_RESPONSES: "api_responses";
    readonly USER_DATA: "user_data";
    readonly SYSTEM_CONFIG: "system_config";
};
/**
 * Environment-specific cache configurations
 */
export declare function getCacheConfigForEnvironment(env: string): {
    enabled: boolean;
    defaultL1MaxSize: number;
    l1Enabled: boolean;
    l2Enabled: boolean;
    debugMode: boolean;
};
/**
 * Get cache namespace by name
 */
export declare function getCacheNamespace(name: string): CacheNamespace | null;
/**
 * Get all cache namespace names
 */
export declare function getCacheNamespaceNames(): string[];
/**
 * Validate cache configuration
 */
export declare function validateCacheNamespace(namespace: CacheNamespace): {
    valid: boolean;
    errors: string[];
};
/**
 * Create custom cache namespace
 */
export declare function createCacheNamespace(config: {
    name: string;
    prefix: string;
    l1TTL: number;
    l2TTL: number;
    l1MaxSize?: number;
    version?: string;
}): CacheNamespace;
/**
 * Cache performance monitoring configuration
 */
export declare const CACHE_MONITORING: {
    readonly detailedMetrics: true;
    readonly metricsInterval: 60;
    readonly healthChecks: true;
    readonly healthCheckInterval: 300;
    readonly thresholds: {
        readonly minHitRate: 0.7;
        readonly maxErrorRate: 0.05;
        readonly maxResponseTime: 100;
        readonly maxEvictionRate: 0.1;
    };
};
declare const _default: {
    CACHE_TTL: {
        readonly INSTANT: 15;
        readonly SHORT: 60;
        readonly MEDIUM: 300;
        readonly LONG: 1800;
        readonly EXTENDED: 3600;
        readonly DAILY: 86400;
        readonly WEEKLY: 604800;
    };
    CACHE_LEVELS: {
        readonly L1_SMALL: CacheLevelConfig;
        readonly L1_MEDIUM: CacheLevelConfig;
        readonly L1_LARGE: CacheLevelConfig;
        readonly L2_SHORT: CacheLevelConfig;
        readonly L2_MEDIUM: CacheLevelConfig;
        readonly L2_LONG: CacheLevelConfig;
    };
    CACHE_NAMESPACES: Record<string, CacheNamespace>;
    CACHE_STRATEGIES: {
        readonly REALTIME: {
            readonly l1TTL: 15;
            readonly l2TTL: 60;
            readonly l1MaxSize: 50;
            readonly aggressiveRefresh: true;
        };
        readonly INTERACTIVE: {
            readonly l1TTL: 60;
            readonly l2TTL: 300;
            readonly l1MaxSize: 100;
            readonly aggressiveRefresh: false;
        };
        readonly BATCH: {
            readonly l1TTL: 300;
            readonly l2TTL: 1800;
            readonly l1MaxSize: 200;
            readonly aggressiveRefresh: false;
        };
        readonly REFERENCE: {
            readonly l1TTL: 1800;
            readonly l2TTL: 86400;
            readonly l1MaxSize: 500;
            readonly aggressiveRefresh: false;
        };
    };
    CACHE_INVALIDATION: {
        readonly TIME_BASED: "time_based";
        readonly MANUAL: "manual";
        readonly EVENT_DRIVEN: "event_driven";
        readonly TAG_BASED: "tag_based";
    };
    CACHE_TAGS: {
        readonly SENTIMENT: "sentiment";
        readonly MARKET_DATA: "market_data";
        readonly SECTOR_DATA: "sector_data";
        readonly REPORTS: "reports";
        readonly API_RESPONSES: "api_responses";
        readonly USER_DATA: "user_data";
        readonly SYSTEM_CONFIG: "system_config";
    };
    getCacheConfigForEnvironment: typeof getCacheConfigForEnvironment;
    getCacheNamespace: typeof getCacheNamespace;
    getCacheNamespaceNames: typeof getCacheNamespaceNames;
    validateCacheNamespace: typeof validateCacheNamespace;
    createCacheNamespace: typeof createCacheNamespace;
    CACHE_MONITORING: {
        readonly detailedMetrics: true;
        readonly metricsInterval: 60;
        readonly healthChecks: true;
        readonly healthCheckInterval: 300;
        readonly thresholds: {
            readonly minHitRate: 0.7;
            readonly maxErrorRate: 0.05;
            readonly maxResponseTime: 100;
            readonly maxEvictionRate: 0.1;
        };
    };
};
export default _default;
//# sourceMappingURL=cache-config.d.ts.map