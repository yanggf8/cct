/**
 * Optimized Cache Configuration
 * Enables all KV reduction optimizations for production deployment
 * Manages feature flags and optimization settings
 */

export interface OptimizedCacheSettings {
  // Main optimization toggles
  enableKeyAliasing: boolean;
  enableBatchOperations: boolean;
  enableMemoryStaticData: boolean;
  enablePredictivePrefetching: boolean;
  enableVectorizedProcessing: boolean;

  // Performance settings
  maxMemoryBudgetMB: number;
  preFetchThreshold: number;
  batchSizes: {
    high: number;
    medium: number;
    low: number;
  };

  // Threshold settings
  cacheHitRateTarget: number;
  kvOperationReductionTarget: number;
  enableMonitoring: boolean;

  // Development/Production flags
  debugMode: boolean;
  enableOptimizationLogging: boolean;
}

/**
 * Optimized Cache Configuration Manager
 * Centralized configuration for all KV optimization features
 */
export class OptimizedCacheConfig {
  private static instance: OptimizedCacheConfig;
  private settings: OptimizedCacheSettings;

  private constructor() {
    // Default to all optimizations enabled
    this.settings = {
      enableKeyAliasing: true,
      enableBatchOperations: true,
      enableMemoryStaticData: true,
      enablePredictivePrefetching: true,
      enableVectorizedProcessing: true,

      maxMemoryBudgetMB: 50, // 50MB for all optimizations
      preFetchThreshold: 3,
      batchSizes: {
        high: 5,
        medium: 10,
        low: 25
      },

      cacheHitRateTarget: 85, // Target 85% cache hit rate
      kvOperationReductionTarget: 85, // Target 85% KV operation reduction
      enableMonitoring: true,

      debugMode: (((globalThis as any).process?.env?.NODE_ENV) === 'development'),
      enableOptimizationLogging: true
    };
  }

  static getInstance(): OptimizedCacheConfig {
    if (!OptimizedCacheConfig.instance) {
      OptimizedCacheConfig.instance = new OptimizedCacheConfig();
    }
    return OptimizedCacheConfig.instance;
  }

  /**
   * Get all current settings
   */
  getSettings(): OptimizedCacheSettings {
    return { ...this.settings };
  }

  /**
   * Update specific settings
   */
  updateSettings(newSettings: Partial<OptimizedCacheSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get environment-specific settings
   */
  getEnvironmentSettings(): OptimizedCacheSettings {
    const baseSettings = { ...this.settings };

    if (this.settings.debugMode) {
      return {
        ...baseSettings,
        maxMemoryBudgetMB: 100, // More memory for development
        enableOptimizationLogging: true,
        preFetchThreshold: 1, // More aggressive in development
        cacheHitRateTarget: 90, // Higher target in development
      };
    }

    // Production optimizations
    if (((globalThis as any).process?.env?.NODE_ENV) === 'production') {
      return {
        ...baseSettings,
        maxMemoryBudgetMB: 30, // Conservative memory for production
        enableOptimizationLogging: false, // Reduce logging overhead
        preFetchThreshold: 5, // More conservative in production
        cacheHitRateTarget: 80, // Realistic target for production
      };
    }

    return baseSettings;
  }

  /**
   * Get optimization feature summary
   */
  getOptimizationFeatures(): {
    totalFeatures: number;
    enabledFeatures: string[];
    estimatedKVReduction: string;
    estimatedMemoryUsage: string;
  } {
    const features = [];
    let totalReduction = 0;
    let memoryUsage = '0MB';

    if (this.settings.enableKeyAliasing) {
      features.push('Cache Key Aliasing (25-30% reduction)');
      totalReduction += 25;
      memoryUsage = `${memoryUsage} + 5MB`; // Estimate 5MB for key mapping
    }

    if (this.settings.enableBatchOperations) {
      features.push('Batch KV Operations (15-20% reduction)');
      totalReduction += 15;
      memoryUsage = `${memoryUsage} + 2MB`; // Estimate 2MB for batching
    }

    if (this.settings.enableMemoryStaticData) {
      features.push('Memory-Only Static Data (10-15% reduction)');
      totalReduction += 10;
      memoryUsage = `${memoryUsage} + 20MB`; // 20MB for static data
    }

    if (this.settings.enablePredictivePrefetching) {
      features.push('Predictive Pre-fetching (15-20% reduction)');
      totalReduction += 15;
      memoryUsage = `${memoryUsage} + 10MB`; // 10MB for pre-fetch cache
    }

    if (this.settings.enableVectorizedProcessing) {
      features.push('Vectorized Sector Processing (30-40% reduction)');
      totalReduction += 30;
      memoryUsage = `${memoryUsage} + 5MB`; // 5MB for processing
    }

    return {
      totalFeatures: features.length,
      enabledFeatures: features,
      estimatedKVReduction: `${totalReduction}%`,
      estimatedMemoryUsage: memoryUsage
    };
  }

  /**
   * Validate configuration
   */
  validateConfiguration(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check memory budget
    if (this.settings.maxMemoryBudgetMB > 100) {
      errors.push('Memory budget exceeds 100MB limit');
    }

    if (this.settings.maxMemoryBudgetMB < 20) {
      warnings.push('Memory budget below 20MB may limit optimization effectiveness');
    }

    // Check batch sizes
    if (this.settings.batchSizes.high < 1 || this.settings.batchSizes.high > 50) {
      errors.push('High priority batch size must be 1-50');
    }

    if (this.settings.batchSizes.low < this.settings.batchSizes.high) {
      errors.push('Low priority batch size must be >= high priority batch size');
    }

    // Check targets
    if (this.settings.cacheHitRateTarget > 95) {
      warnings.push('Cache hit rate target above 95% may be unrealistic');
    }

    if (this.settings.kvOperationReductionTarget > 90) {
      warnings.push('KV operation reduction target above 90% may be unrealistic');
    }

    // Check pre-fetch threshold
    if (this.settings.preFetchThreshold < 1 || this.settings.preFetchThreshold > 10) {
      errors.push('Pre-fetch threshold must be 1-10');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get configuration for specific environment
   */
  getEnvironmentConfiguration(env: 'development' | 'staging' | 'production'): OptimizedCacheSettings {
    const config = this.getEnvironmentSettings();

    // Environment-specific overrides
    switch (env) {
      case 'development':
        return {
          ...config,
          enableOptimizationLogging: true,
          debugMode: true
        };

      case 'staging':
        return {
          ...config,
          maxMemoryBudgetMB: 40,
          cacheHitRateTarget: 83,
          preFetchThreshold: 2
        };

      case 'production':
        return {
          ...config,
          maxMemoryBudgetMB: 30,
          enableOptimizationLogging: false,
          preFetchThreshold: 5,
          batchSizes: {
            high: 3,
            medium: 8,
            low: 15
          }
        };

      default:
        return config;
    }
  }

  /**
   * Export configuration for monitoring
   */
  exportConfiguration(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      settings: this.settings,
      validation: this.validateConfiguration(),
      features: this.getOptimizationFeatures(),
      environment: (((globalThis as any).process?.env?.NODE_ENV) || 'development')
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Get KV operation reduction projection
   */
  getKVReductionProjection(): {
    currentDailyKV: number;
    optimizedDailyKV: number;
    percentageReduction: number;
    costSavings: string;
  } {
    // Conservative estimates based on typical usage
    const currentDailyKV = 5000; // 5,000 KV ops/day
    const baseOptimization = 0.70; // 70% reduction from original plan
    const additionalOptimization = parseFloat(this.getOptimizationFeatures().estimatedKVReduction.replace('%', '')) / 100;
    const totalOptimization = baseOptimization + additionalOptimization;

    const optimizedDailyKV = Math.round(currentDailyKV * (1 - totalOptimization));

    return {
      currentDailyKV,
      optimizedDailyKV,
      percentageReduction: Math.round(totalOptimization * 100),
      costSavings: totalOptimization > 0.8 ? 'Massive' : totalOptimization > 0.6 ? 'High' : totalOptimization > 0.4 ? 'Medium' : 'Modest'
    };
  }
}

