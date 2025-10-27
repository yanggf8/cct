/**
 * Enhanced Cache Configuration System
 * Inspired by DAC implementation with centralized, environment-aware configs
 * Replaces scattered cache settings with unified configuration management
 */

/**
 * Enhanced cache configuration for each namespace
 */
export interface EnhancedCacheConfig {
  // Layer 1 (HashCache) configuration
  l1TTL: number; // Time to live in seconds for L1 cache
  l1MaxSize?: number; // Maximum number of entries in L1
  l1MemoryMB?: number; // Maximum memory usage in MB for L1
  l1GracePeriod?: number; // Grace period for serving stale data (seconds)

  // Layer 2 (KV) configuration
  l2TTL: number; // Time to live in seconds for L2 cache
  persistToL2: boolean; // Whether to persist to L2 (KV) cache

  // Performance settings
  enableStats: boolean; // Enable detailed statistics
  priority: 'high' | 'medium' | 'low'; // Cache priority for eviction

  // Description for documentation
  description: string; // Human-readable description
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
export const ENHANCED_CACHE_CONFIGS: EnvironmentCacheConfigs = {
  development: {
    // Sentiment analysis results (AI-generated, expensive)
    sentiment_analysis: {
      l1TTL: 300,      // 5 minutes in dev (faster iteration)
      l1GracePeriod: 900, // 15 minutes - AI computation is expensive
      l2TTL: 86400,    // 24 hours persistent
      persistToL2: true,
      l1MaxSize: 50,
      l1MemoryMB: 5,
      enableStats: true,
      priority: 'high',
      description: 'AI sentiment analysis results with market sentiment scores',
    },

    // Real-time market data (fast changing)
    market_data: {
      l1TTL: 30,       // 30 seconds (real-time data)
      l1GracePeriod: 30, // 30 seconds - minimal grace for real-time data
      l2TTL: 180,      // 3 minutes persistent
      persistToL2: true,
      l1MaxSize: 200,
      l1MemoryMB: 3,
      enableStats: true,
      priority: 'high',
      description: 'Real-time market quotes and price data',
    },

    // Sector analysis data (medium-term relevance)
    sector_data: {
      l1TTL: 120,      // 2 minutes
      l1GracePeriod: 180, // 3 minutes - sector data changes slowly
      l2TTL: 86400,    // 24 hours persistent
      persistToL2: true,
      l1MaxSize: 100,
      l1MemoryMB: 4,
      enableStats: true,
      priority: 'medium',
      description: 'Sector rotation analysis and sector performance data',
    },

    // Generated reports (user-facing, stable)
    reports: {
      l1TTL: 600,      // 10 minutes
      l1GracePeriod: 1800, // 30 minutes - reports are historical, stable data
      l2TTL: 86400,    // 24 hours persistent
      persistToL2: true,
      l1MaxSize: 30,
      l1MemoryMB: 8,
      enableStats: true,
      priority: 'medium',
      description: 'Generated analysis reports and user-facing content',
    },

    // API responses (rate limit protection)
    api_responses: {
      l1TTL: 60,       // 1 minute
      l2TTL: 86400,    // 24 hours persistent
      persistToL2: true,
      l1MaxSize: 150,
      l1MemoryMB: 2,
      enableStats: true,
      priority: 'low',
      description: 'External API responses for rate limit protection',
    },

    // News articles (external API, rate limited)
    news_articles: {
      l1TTL: 900,      // 15 minutes
      l2TTL: 86400,    // 24 hours persistent
      persistToL2: true,
      l1MaxSize: 100,
      l1MemoryMB: 10,
      enableStats: true,
      priority: 'high',
      description: 'External news articles and headlines (rate limited)',
    },

    // AI model results (expensive computation)
    ai_results: {
      l1TTL: 1800,     // 30 minutes
      l2TTL: 7200,     // 2 hours persistent
      persistToL2: true,
      l1MaxSize: 25,
      l1MemoryMB: 15,
      enableStats: true,
      priority: 'high',
      description: 'AI model inference results (expensive computation)',
    },
  },

  production: {
    // Production-optimized configs with longer TTLs
    sentiment_analysis: {
      l1TTL: 900,      // 15 minutes (production stability)
      l1GracePeriod: 1800, // 30 minutes - AI computation is expensive in production
      l2TTL: 86400,    // 24 hours persistent
      persistToL2: true,
      l1MaxSize: 100,
      l1MemoryMB: 10,
      enableStats: true,
      priority: 'high',
      description: 'AI sentiment analysis results with market sentiment scores',
    },

    market_data: {
      l1TTL: 60,       // 1 minute (still real-time but more stable)
      l1GracePeriod: 60, // 1 minute - minimal grace for real-time data
      l2TTL: 86400,    // 24 hours persistent
      persistToL2: true,
      l1MaxSize: 500,
      l1MemoryMB: 8,
      enableStats: true,
      priority: 'high',
      description: 'Real-time market quotes and price data',
    },

    sector_data: {
      l1TTL: 300,      // 5 minutes
      l1GracePeriod: 600, // 10 minutes - sector data changes slowly in production
      l2TTL: 86400,    // 24 hours persistent
      persistToL2: true,
      l1MaxSize: 200,
      l1MemoryMB: 6,
      enableStats: true,
      priority: 'medium',
      description: 'Sector rotation analysis and sector performance data',
    },

    reports: {
      l1TTL: 1800,     // 30 minutes
      l1GracePeriod: 3600, // 1 hour - reports are historical, very stable
      l2TTL: 7200,     // 2 hours persistent
      persistToL2: true,
      l1MaxSize: 100,
      l1MemoryMB: 20,
      enableStats: true,
      priority: 'medium',
      description: 'Generated analysis reports and user-facing content',
    },

    api_responses: {
      l1TTL: 180,      // 3 minutes
      l2TTL: 86400,    // 24 hours persistent
      persistToL2: true,
      l1MaxSize: 300,
      l1MemoryMB: 5,
      enableStats: true,
      priority: 'low',
      description: 'External API responses for rate limit protection',
    },

    news_articles: {
      l1TTL: 900,      // 15 minutes
      l2TTL: 86400,    // 24 hours persistent
      persistToL2: true,
      l1MaxSize: 200,
      l1MemoryMB: 20,
      enableStats: true,
      priority: 'high',
      description: 'External news articles and headlines (rate limited)',
    },

    ai_results: {
      l1TTL: 3600,     // 1 hour
      l2TTL: 14400,    // 4 hours persistent
      persistToL2: true,
      l1MaxSize: 50,
      l1MemoryMB: 25,
      enableStats: true,
      priority: 'high',
      description: 'AI model inference results (expensive computation)',
    },
  },

  test: {
    // Test environment with minimal TTLs
    sentiment_analysis: {
      l1TTL: 5,        // 5 seconds for fast testing
      l2TTL: 30,       // 30 seconds persistent
      persistToL2: true,
      l1MaxSize: 10,
      l1MemoryMB: 1,
      enableStats: true,
      priority: 'medium',
      description: 'Test sentiment analysis results',
    },

    market_data: {
      l1TTL: 2,        // 2 seconds
      l2TTL: 10,       // 10 seconds persistent
      persistToL2: true,
      l1MaxSize: 20,
      l1MemoryMB: 1,
      enableStats: true,
      priority: 'medium',
      description: 'Test market data',
    },

    sector_data: {
      l1TTL: 5,        // 5 seconds
      l2TTL: 30,       // 30 seconds persistent
      persistToL2: true,
      l1MaxSize: 15,
      l1MemoryMB: 1,
      enableStats: true,
      priority: 'low',
      description: 'Test sector data',
    },

    reports: {
      l1TTL: 10,       // 10 seconds
      l2TTL: 60,       // 1 minute persistent
      persistToL2: true,
      l1MaxSize: 5,
      l1MemoryMB: 2,
      enableStats: true,
      priority: 'low',
      description: 'Test reports',
    },

    api_responses: {
      l1TTL: 3,        // 3 seconds
      l2TTL: 15,       // 15 seconds persistent
      persistToL2: true,
      l1MaxSize: 25,
      l1MemoryMB: 1,
      enableStats: true,
      priority: 'low',
      description: 'Test API responses',
    },

    news_articles: {
      l1TTL: 5,        // 5 seconds
      l2TTL: 30,       // 30 seconds persistent
      persistToL2: true,
      l1MaxSize: 15,
      l1MemoryMB: 2,
      enableStats: true,
      priority: 'medium',
      description: 'Test news articles',
    },

    ai_results: {
      l1TTL: 8,        // 8 seconds
      l2TTL: 60,       // 1 minute persistent
      persistToL2: true,
      l1MaxSize: 8,
      l1MemoryMB: 2,
      enableStats: true,
      priority: 'medium',
      description: 'Test AI results',
    },
  },
};

/**
 * Get current environment from environment variables
 */
export function getCurrentEnvironment(): 'development' | 'production' | 'test' {
  const env = typeof globalThis !== 'undefined' && (globalThis as any).ENV
    ? (globalThis as any).ENV
    : 'development';

  switch (env.toLowerCase()) {
    case 'production':
    case 'prod':
      return 'production';
    case 'test':
    case 'testing':
      return 'test';
    default:
      return 'development';
  }
}

/**
 * Get cache configuration for current environment
 */
export function getCacheConfig(namespace: string): EnhancedCacheConfig {
  const environment = getCurrentEnvironment();
  const configs = ENHANCED_CACHE_CONFIGS[environment];

  if (!configs[namespace]) {
    // Fallback to development config if namespace not found
    const fallbackConfig = ENHANCED_CACHE_CONFIGS.development.market_data;
    console.warn(`Cache namespace '${namespace}' not found for environment '${environment}', using fallback config`);
    return fallbackConfig;
  }

  return configs[namespace];
}

/**
 * Get all cache configurations for current environment
 */
export function getAllCacheConfigs(): Record<string, EnhancedCacheConfig> {
  const environment = getCurrentEnvironment();
  return ENHANCED_CACHE_CONFIGS[environment];
}

/**
 * Get cache namespaces with configurations for current environment
 */
export function getCacheNamespaces(): EnhancedCacheNamespace[] {
  const environment = getCurrentEnvironment();
  const configs = ENHANCED_CACHE_CONFIGS[environment];

  return Object.entries(configs).map(([name, config]) => ({
    name,
    prefix: name,
    config,
    version: '2.0', // Enhanced cache version
  }));
}

/**
 * Validate cache configuration
 */
export function validateCacheConfig(config: EnhancedCacheConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.l1TTL <= 0) {
    errors.push('L1 TTL must be greater than 0');
  }

  if (config.l2TTL <= 0) {
    errors.push('L2 TTL must be greater than 0');
  }

  if (config.l1TTL > config.l2TTL) {
    errors.push('L1 TTL should not be greater than L2 TTL');
  }

  if (config.l1MaxSize && config.l1MaxSize <= 0) {
    errors.push('L1 max size must be greater than 0');
  }

  if (config.l1MemoryMB && config.l1MemoryMB <= 0) {
    errors.push('L1 memory limit must be greater than 0');
  }

  if (!['high', 'medium', 'low'].includes(config.priority)) {
    errors.push('Priority must be high, medium, or low');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Cache configuration manager
 */
export class EnhancedCacheConfigManager {
  private environment: 'development' | 'production' | 'test';

  constructor(environment?: 'development' | 'production' | 'test') {
    this.environment = environment || getCurrentEnvironment();
  }

  /**
   * Get configuration for a specific namespace
   */
  getConfig(namespace: string): EnhancedCacheConfig {
    const configs = ENHANCED_CACHE_CONFIGS[this.environment];
    return configs[namespace] || ENHANCED_CACHE_CONFIGS.development.market_data;
  }

  /**
   * Get all configurations
   */
  getAllConfigs(): Record<string, EnhancedCacheConfig> {
    return ENHANCED_CACHE_CONFIGS[this.environment];
  }

  /**
   * Get environment
   */
  getEnvironment(): string {
    return this.environment;
  }

  /**
   * Validate all configurations
   */
  validateAllConfigs(): { namespace: string; valid: boolean; errors: string[] }[] {
    const configs = this.getAllConfigs();
    return Object.entries(configs).map(([namespace, config]) => ({
      namespace,
      ...validateCacheConfig(config),
    }));
  }

  /**
   * Get configuration summary for logging/debugging
   */
  getConfigSummary(): {
    environment: string;
    namespaces: number;
    avgL1TTL: number;
    avgL2TTL: number;
    totalMemoryMB: number;
  } {
    const configs = this.getAllConfigs();
    const namespaces = Object.keys(configs);

    const avgL1TTL = namespaces.reduce((sum, ns) => sum + configs[ns].l1TTL, 0) / namespaces.length;
    const avgL2TTL = namespaces.reduce((sum, ns) => sum + configs[ns].l2TTL, 0) / namespaces.length;
    const totalMemoryMB = namespaces.reduce((sum, ns) => sum + (configs[ns].l1MemoryMB || 0), 0);

    return {
      environment: this.environment,
      namespaces: namespaces.length,
      avgL1TTL: Math.round(avgL1TTL),
      avgL2TTL: Math.round(avgL2TTL),
      totalMemoryMB,
    };
  }
}

/**
 * Create enhanced cache configuration manager
 */
export function createEnhancedCacheConfigManager(
  environment?: 'development' | 'production' | 'test'
): EnhancedCacheConfigManager {
  return new EnhancedCacheConfigManager(environment);
}

export default {
  ENHANCED_CACHE_CONFIGS,
  getCacheConfig,
  getAllCacheConfigs,
  getCacheNamespaces,
  validateCacheConfig,
  EnhancedCacheConfigManager,
  createEnhancedCacheConfigManager,
};