/**
 * Enhanced Cache Configuration System
 * Inspired by DAC implementation with centralized, environment-aware configs
 * Replaces scattered cache settings with unified configuration management
 */
/**
 * DAC-inspired constants for L2 cache management
 */
export declare const TEN_YEARS_TTL = 315360000;
export declare const DEFAULT_REFRESH_THRESHOLD = 600;
export declare const BUSINESS_HOURS_START = 9;
export declare const BUSINESS_HOURS_END = 17;
/**
 * Enhanced cache configuration for each namespace
 */
export interface EnhancedCacheConfig {
    l1TTL: number;
    l1MaxSize?: number;
    l1MemoryMB?: number;
    l1GracePeriod?: number;
    l2TTL: number;
    persistToL2: boolean;
    enableBackgroundRefresh?: boolean;
    refreshThreshold?: number;
    businessHoursOnly?: boolean;
    enableStats: boolean;
    priority: 'high' | 'medium' | 'low';
    description: string;
}
/**
 * Cache namespace with enhanced configuration
 */
export interface EnhancedCacheNamespace {
    name: string;
    prefix: string;
    config: EnhancedCacheConfig;
    version: string;
}
/**
 * Environment-specific cache configurations
 */
export interface EnvironmentCacheConfigs {
    development: Record<string, EnhancedCacheConfig>;
    production: Record<string, EnhancedCacheConfig>;
    test: Record<string, EnhancedCacheConfig>;
}
/**
 * Centralized enhanced cache configurations
 * Inspired by DAC's DUAL_CACHE_CONFIGS approach
 */
export declare const ENHANCED_CACHE_CONFIGS: EnvironmentCacheConfigs;
/**
 * Get current environment from environment variables
 */
export declare function getCurrentEnvironment(): 'development' | 'production' | 'test';
/**
 * Get cache configuration for current environment
 */
export declare function getCacheConfig(namespace: string): EnhancedCacheConfig;
/**
 * Get all cache configurations for current environment
 */
export declare function getAllCacheConfigs(): Record<string, EnhancedCacheConfig>;
/**
 * Get cache namespaces with configurations for current environment
 */
export declare function getCacheNamespaces(): EnhancedCacheNamespace[];
/**
 * Validate cache configuration
 */
export declare function validateCacheConfig(config: EnhancedCacheConfig): {
    valid: boolean;
    errors: string[];
};
/**
 * Cache configuration manager
 */
export declare class EnhancedCacheConfigManager {
    private environment;
    constructor(environment?: 'development' | 'production' | 'test');
    /**
     * Get configuration for a specific namespace
     */
    getConfig(namespace: string): EnhancedCacheConfig;
    /**
     * Get all configurations
     */
    getAllConfigs(): Record<string, EnhancedCacheConfig>;
    /**
     * Get environment
     */
    getEnvironment(): string;
    /**
     * Validate all configurations
     */
    validateAllConfigs(): {
        namespace: string;
        valid: boolean;
        errors: string[];
    }[];
    /**
     * Get configuration summary for logging/debugging
     */
    getConfigSummary(): {
        environment: string;
        namespaces: number;
        avgL1TTL: number;
        avgL2TTL: number;
        totalMemoryMB: number;
    };
}
/**
 * Create enhanced cache configuration manager
 */
export declare function createEnhancedCacheConfigManager(environment?: 'development' | 'production' | 'test'): EnhancedCacheConfigManager;
declare const _default: {
    ENHANCED_CACHE_CONFIGS: EnvironmentCacheConfigs;
    getCacheConfig: typeof getCacheConfig;
    getAllCacheConfigs: typeof getAllCacheConfigs;
    getCacheNamespaces: typeof getCacheNamespaces;
    validateCacheConfig: typeof validateCacheConfig;
    EnhancedCacheConfigManager: typeof EnhancedCacheConfigManager;
    createEnhancedCacheConfigManager: typeof createEnhancedCacheConfigManager;
};
export default _default;
//# sourceMappingURL=enhanced-cache-config.d.ts.map