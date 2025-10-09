/**
 * Cache Configuration Module - TypeScript
 * Centralized cache namespace and TTL configuration
 * Phase 2: Enhanced Caching System - Data Access Improvement Plan
 */

import type { CacheNamespace, CacheLevelConfig } from './cache-manager.js';

/**
 * Default cache TTL configurations (in seconds)
 */
export const CACHE_TTL = {
  INSTANT: 15,        // 15 seconds - real-time data
  SHORT: 60,          // 1 minute - frequent updates
  MEDIUM: 300,        // 5 minutes - periodic data
  LONG: 1800,         // 30 minutes - stable data
  EXTENDED: 3600,     // 1 hour - reference data
  DAILY: 86400,       // 24 hours - daily reports
  WEEKLY: 604800,     // 1 week - weekly summaries
} as const;

/**
 * Cache level configurations
 */
export const CACHE_LEVELS = {
  // L1 Memory Cache - Fast access, small size
  L1_SMALL: {
    name: 'l1_small',
    ttl: CACHE_TTL.SHORT,
    maxSize: 50,
    enabled: true
  } as CacheLevelConfig,

  L1_MEDIUM: {
    name: 'l1_medium',
    ttl: CACHE_TTL.MEDIUM,
    maxSize: 100,
    enabled: true
  } as CacheLevelConfig,

  L1_LARGE: {
    name: 'l1_large',
    ttl: CACHE_TTL.LONG,
    maxSize: 200,
    enabled: true
  } as CacheLevelConfig,

  // L2 KV Cache - Larger capacity, persistent
  L2_SHORT: {
    name: 'l2_short',
    ttl: CACHE_TTL.MEDIUM,
    enabled: true
  } as CacheLevelConfig,

  L2_MEDIUM: {
    name: 'l2_medium',
    ttl: CACHE_TTL.EXTENDED,
    enabled: true
  } as CacheLevelConfig,

  L2_LONG: {
    name: 'l2_long',
    ttl: CACHE_TTL.DAILY,
    enabled: true
  } as CacheLevelConfig,
} as const;

/**
 * Predefined cache namespaces
 */
export const CACHE_NAMESPACES: Record<string, CacheNamespace> = {
  // Sentiment Analysis Data
  sentiment_analysis: {
    name: 'sentiment_analysis',
    prefix: 'sentiment_analysis',
    l1Config: CACHE_LEVELS.L1_MEDIUM,
    l2Config: CACHE_LEVELS.L2_MEDIUM,
    version: '1.0'
  },

  // Market Data (real-time stock prices)
  market_data: {
    name: 'market_data',
    prefix: 'market_data',
    l1Config: CACHE_LEVELS.L1_SMALL,
    l2Config: CACHE_LEVELS.L2_SHORT,
    version: '1.0'
  },

  // Sector Data
  sector_data: {
    name: 'sector_data',
    prefix: 'sector_data',
    l1Config: CACHE_LEVELS.L1_MEDIUM,
    l2Config: CACHE_LEVELS.L2_SHORT,
    version: '1.0'
  },

  // Market Drivers Data
  market_drivers: {
    name: 'market_drivers',
    prefix: 'market_drivers',
    l1Config: CACHE_LEVELS.L1_MEDIUM,
    l2Config: CACHE_LEVELS.L2_MEDIUM,
    version: '1.0'
  },

  // Analysis Results
  analysis_results: {
    name: 'analysis_results',
    prefix: 'analysis_results',
    l1Config: CACHE_LEVELS.L1_LARGE,
    l2Config: CACHE_LEVELS.L2_LONG,
    version: '1.0'
  },

  // Daily Reports
  daily_reports: {
    name: 'daily_reports',
    prefix: 'daily_reports',
    l1Config: CACHE_LEVELS.L1_MEDIUM,
    l2Config: CACHE_LEVELS.L2_LONG,
    version: '1.0'
  },

  // Weekly Reports
  weekly_reports: {
    name: 'weekly_reports',
    prefix: 'weekly_reports',
    l1Config: CACHE_LEVELS.L1_MEDIUM,
    l2Config: CACHE_LEVELS.L2_LONG,
    version: '1.0'
  },

  // API Responses (standardized responses)
  api_responses: {
    name: 'api_responses',
    prefix: 'api_responses',
    l1Config: CACHE_LEVELS.L1_MEDIUM,
    l2Config: CACHE_LEVELS.L2_MEDIUM,
    version: '1.0'
  },

  // User Preferences
  user_preferences: {
    name: 'user_preferences',
    prefix: 'user_preferences',
    l1Config: CACHE_LEVELS.L1_LARGE,
    l2Config: CACHE_LEVELS.L2_LONG,
    version: '1.0'
  },

  // System Configuration
  system_config: {
    name: 'system_config',
    prefix: 'system_config',
    l1Config: CACHE_LEVELS.L1_LARGE,
    l2Config: CACHE_LEVELS.L2_LONG,
    version: '1.0'
  },

  // Historical Data
  historical_data: {
    name: 'historical_data',
    prefix: 'historical_data',
    l1Config: {
      name: 'l1_historical',
      ttl: CACHE_TTL.LONG,
      maxSize: 100,
      enabled: false // Historical data is large, skip L1
    },
    l2Config: CACHE_LEVELS.L2_LONG,
    version: '1.0'
  },

  // Health and Monitoring Data
  health_monitoring: {
    name: 'health_monitoring',
    prefix: 'health_monitoring',
    l1Config: CACHE_LEVELS.L1_SMALL,
    l2Config: CACHE_LEVELS.L2_SHORT,
    version: '1.0'
  },

  // Notification Data
  notifications: {
    name: 'notifications',
    prefix: 'notifications',
    l1Config: CACHE_LEVELS.L1_MEDIUM,
    l2Config: CACHE_LEVELS.L2_MEDIUM,
    version: '1.0'
  },

  // External API Cache (third-party API responses)
  external_api: {
    name: 'external_api',
    prefix: 'external_api',
    l1Config: CACHE_LEVELS.L1_SMALL,
    l2Config: CACHE_LEVELS.L2_MEDIUM,
    version: '1.0'
  },

  // Computation Results (heavy calculations)
  computation_results: {
    name: 'computation_results',
    prefix: 'computation_results',
    l1Config: CACHE_LEVELS.L1_LARGE,
    l2Config: CACHE_LEVELS.L2_LONG,
    version: '1.0'
  }
} as const;

/**
 * Cache strategy presets for different use cases
 */
export const CACHE_STRATEGIES = {
  // Real-time data strategy - minimal caching
  REALTIME: {
    l1TTL: CACHE_TTL.INSTANT,
    l2TTL: CACHE_TTL.SHORT,
    l1MaxSize: 50,
    aggressiveRefresh: true
  },

  // Interactive data strategy - balanced caching
  INTERACTIVE: {
    l1TTL: CACHE_TTL.SHORT,
    l2TTL: CACHE_TTL.MEDIUM,
    l1MaxSize: 100,
    aggressiveRefresh: false
  },

  // Batch processing strategy - longer caching
  BATCH: {
    l1TTL: CACHE_TTL.MEDIUM,
    l2TTL: CACHE_TTL.LONG,
    l1MaxSize: 200,
    aggressiveRefresh: false
  },

  // Reference data strategy - maximum caching
  REFERENCE: {
    l1TTL: CACHE_TTL.LONG,
    l2TTL: CACHE_TTL.DAILY,
    l1MaxSize: 500,
    aggressiveRefresh: false
  }
} as const;

/**
 * Cache invalidation strategies
 */
export const CACHE_INVALIDATION = {
  // Time-based invalidation
  TIME_BASED: 'time_based',

  // Manual invalidation
  MANUAL: 'manual',

  // Event-driven invalidation
  EVENT_DRIVEN: 'event_driven',

  // Tag-based invalidation
  TAG_BASED: 'tag_based'
} as const;

/**
 * Cache tags for grouped invalidation
 */
export const CACHE_TAGS = {
  SENTIMENT: 'sentiment',
  MARKET_DATA: 'market_data',
  SECTOR_DATA: 'sector_data',
  REPORTS: 'reports',
  API_RESPONSES: 'api_responses',
  USER_DATA: 'user_data',
  SYSTEM_CONFIG: 'system_config'
} as const;

/**
 * Environment-specific cache configurations
 */
export function getCacheConfigForEnvironment(env: string): {
  enabled: boolean;
  defaultL1MaxSize: number;
  l1Enabled: boolean;
  l2Enabled: boolean;
  debugMode: boolean;
} {
  const baseConfig = {
    enabled: true,
    defaultL1MaxSize: 1000,
    l1Enabled: true,
    l2Enabled: true,
    debugMode: false
  };

  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        debugMode: true,
        defaultL1MaxSize: 100
      };

    case 'testing':
      return {
        ...baseConfig,
        enabled: false, // Disable cache in tests
        debugMode: true
      };

    case 'staging':
      return {
        ...baseConfig,
        defaultL1MaxSize: 500,
        debugMode: true
      };

    case 'production':
      return {
        ...baseConfig,
        defaultL1MaxSize: 2000,
        debugMode: false
      };

    default:
      return baseConfig;
  }
}

/**
 * Get cache namespace by name
 */
export function getCacheNamespace(name: string): CacheNamespace | null {
  return CACHE_NAMESPACES[name] || null;
}

/**
 * Get all cache namespace names
 */
export function getCacheNamespaceNames(): string[] {
  return Object.keys(CACHE_NAMESPACES);
}

/**
 * Validate cache configuration
 */
export function validateCacheNamespace(namespace: CacheNamespace): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!namespace.name || typeof namespace.name !== 'string') {
    errors.push('Namespace name is required and must be a string');
  }

  if (!namespace.prefix || typeof namespace.prefix !== 'string') {
    errors.push('Namespace prefix is required and must be a string');
  }

  if (!namespace.version || typeof namespace.version !== 'string') {
    errors.push('Namespace version is required and must be a string');
  }

  if (!namespace.l1Config || !namespace.l2Config) {
    errors.push('Both L1 and L2 configurations are required');
  }

  if (namespace.l1Config.ttl <= 0) {
    errors.push('L1 TTL must be greater than 0');
  }

  if (namespace.l2Config.ttl <= 0) {
    errors.push('L2 TTL must be greater than 0');
  }

  if (namespace.l1Config.maxSize && namespace.l1Config.maxSize <= 0) {
    errors.push('L1 max size must be greater than 0');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create custom cache namespace
 */
export function createCacheNamespace(config: {
  name: string;
  prefix: string;
  l1TTL: number;
  l2TTL: number;
  l1MaxSize?: number;
  version?: string;
}): CacheNamespace {
  const {
    name,
    prefix,
    l1TTL,
    l2TTL,
    l1MaxSize = 100,
    version = '1.0'
  } = config;

  const namespace: CacheNamespace = {
    name,
    prefix,
    l1Config: {
      name: `${name}_l1`,
      ttl: l1TTL,
      maxSize: l1MaxSize,
      enabled: true
    },
    l2Config: {
      name: `${name}_l2`,
      ttl: l2TTL,
      enabled: true
    },
    version
  };

  const validation = validateCacheNamespace(namespace);
  if (!validation.valid) {
    throw new Error(`Invalid cache namespace: ${validation.errors.join(', ')}`);
  }

  return namespace;
}

/**
 * Cache performance monitoring configuration
 */
export const CACHE_MONITORING = {
  // Enable detailed metrics collection
  detailedMetrics: true,

  // Metrics collection interval (seconds)
  metricsInterval: 60,

  // Enable cache health checks
  healthChecks: true,

  // Health check interval (seconds)
  healthCheckInterval: 300,

  // Performance thresholds
  thresholds: {
    minHitRate: 0.7,        // 70% minimum hit rate
    maxErrorRate: 0.05,     // 5% maximum error rate
    maxResponseTime: 100,   // 100ms maximum response time
    maxEvictionRate: 0.1    // 10% maximum eviction rate
  }
} as const;

export default {
  CACHE_TTL,
  CACHE_LEVELS,
  CACHE_NAMESPACES,
  CACHE_STRATEGIES,
  CACHE_INVALIDATION,
  CACHE_TAGS,
  getCacheConfigForEnvironment,
  getCacheNamespace,
  getCacheNamespaceNames,
  validateCacheNamespace,
  createCacheNamespace,
  CACHE_MONITORING
};