/**
 * Enhanced Cache Factory
 * Creates either standard or optimized cache manager based on configuration
 * Enables seamless switching between legacy and optimized systems
 */

import { CacheManager } from './cache-manager.js';
import { EnhancedOptimizedCacheManager } from './enhanced-optimized-cache-manager.js';
import { OptimizedCacheConfig } from './optimized-cache-config.js';

export interface OptimizedCacheSettings {
  enableKeyAliasing: boolean;
  enableBatchOperations: boolean;
  enableMemoryStaticData: boolean;
  enablePredictivePrefetching: boolean;
  enableVectorizedProcessing: boolean;
  enableMonitoring: boolean;
}

export interface CacheManagerFactory {
  createCacheManager(env: any, options?: any): CacheManager | EnhancedOptimizedCacheManager;
  createOptimizedCacheManager(env: any, config?: Partial<OptimizedCacheSettings>): EnhancedOptimizedCacheManager;
  isOptimizationEnabled(): boolean;
}

/**
 * Cache Manager Factory Implementation
 */
export class EnhancedCacheFactoryImpl implements CacheManagerFactory {
  private static instance: EnhancedCacheFactoryImpl;
  private optimizationConfig: OptimizedCacheConfig;

  private constructor() {
    this.optimizationConfig = OptimizedCacheConfig.getInstance();
  }

  static getInstance(): EnhancedCacheFactoryImpl {
    if (!EnhancedCacheFactoryImpl.instance) {
      EnhancedCacheFactoryImpl.instance = new EnhancedCacheFactoryImpl();
    }
    return EnhancedCacheFactoryImpl.instance;
  }

  /**
   * Create cache manager based on environment and configuration
   */
  createCacheManager(env: any, options?: any): CacheManager | EnhancedOptimizedCacheManager {
    const config = this.optimizationConfig.getSettings();

    // Check if optimizations are explicitly enabled or if we're in development
    const shouldUseOptimized =
      options.enableOptimized ||
      this.isOptimizationEnabled() ||
      env?.ENABLE_KV_OPTIMIZATIONS === 'true' ||
      env?.USE_ENHANCED_CACHE === 'true' ||
      env?.CACHE_OPTIMIZATION_LEVEL === 'high';

    if (shouldUseOptimized) {
      console.log('🚀 Creating Enhanced Optimized Cache Manager with all KV reduction features');
      return EnhancedOptimizedCacheManager.getInstance(env, {
        enableKeyAliasing: config.enableKeyAliasing,
        enableBatchOperations: config.enableBatchOperations,
        enableMemoryStaticData: config.enableMemoryStaticData,
        enablePredictivePrefetching: config.enablePredictivePrefetching,
        enableVectorizedProcessing: config.enableVectorizedProcessing,
        enableMonitoring: config.enableMonitoring
      });
    }

    console.log('📊 Creating Standard Cache Manager (legacy compatibility)');
    return new CacheManager(env, options);
  }

  /**
   * Create optimized cache manager explicitly
   */
  createOptimizedCacheManager(env: any, config?: Partial<OptimizedCacheSettings>): EnhancedOptimizedCacheManager {
    console.log('🎯 Creating Explicit Optimized Cache Manager with configuration:', config);

    return EnhancedOptimizedCacheManager.getInstance(env, {
      enableKeyAliasing: true,
      enableBatchOperations: true,
      enableMemoryStaticData: true,
      enablePredictivePrefetching: true,
      enableVectorizedProcessing: true,
      enableMonitoring: true,
      ...config
    });
  }

  /**
   * Check if optimization is enabled via environment variable
   */
  isOptimizationEnabled(): boolean {
    // In Cloudflare Workers, check if available in the current context
    try {
      return typeof globalThis !== 'undefined' &&
             (globalThis as any).ENABLE_KV_OPTIMIZATIONS === 'true' ||
             (globalThis as any).USE_ENHANCED_CACHE === 'true' ||
             (globalThis as any).CACHE_OPTIMIZATION_LEVEL === 'high';
    } catch {
      // Fallback: assume optimizations are enabled for production
      return true;
    }
  }

  /**
   * Get optimization status summary
   */
  getOptimizationStatus(): {
    enabled: boolean;
    features: string[];
    settings: any;
    projection: {
      currentKV: number;
      optimizedKV: number;
      reduction: number;
      percentage: string;
    };
  } {
    const config = this.optimizationConfig.getSettings();
    const featuresObj = this.optimizationConfig.getOptimizationFeatures();
    const projectionObj = this.optimizationConfig.getKVReductionProjection();

    // Convert features object to array
    const features = Array.isArray(featuresObj) ? featuresObj : 
      (typeof featuresObj === 'object' && featuresObj !== null) ? 
        Object.values(featuresObj).filter(v => typeof v === 'string') as string[] : [];

    // Ensure projection has correct structure
    const projection = {
      currentKV: projectionObj?.currentDailyKV || projectionObj?.currentKV || 0,
      optimizedKV: projectionObj?.optimizedDailyKV || projectionObj?.optimizedKV || 0,
      reduction: projectionObj?.percentageReduction || projectionObj?.reduction || 0,
      percentage: projectionObj?.percentage || `${projectionObj?.percentageReduction || 0}%`
    };

    return {
      enabled: this.isOptimizationEnabled(),
      features,
      settings: config,
      projection
    };
  }

  /**
   * Enable/disable optimizations dynamically
   */
  setOptimizationEnabled(enabled: boolean): void {
    if (enabled) {
      console.log('🚀 Enabling KV Optimizations');
      try {
        (globalThis as any).ENABLE_KV_OPTIMIZATIONS = 'true';
      } catch {
        // Ignore if globalThis is not available
      }
    } else {
      console.log('📊 Disabling KV Optimizations');
      try {
        delete (globalThis as any).ENABLE_KV_OPTIMIZATIONS;
      } catch {
        // Ignore if globalThis is not available
      }
    }
  }

  /**
   * Get cache manager type information
   */
  getCacheManagerType(env: any): {
    type: 'standard' | 'optimized';
    features: string[];
    reason: string;
  } {
    const shouldUseOptimized = this.isOptimizationEnabled();

    if (shouldUseOptimized) {
      return {
        type: 'optimized',
        features: [
          'Cache Key Aliasing (25-30% reduction)',
          'Batch KV Operations (15-20% reduction)',
          'Memory-Only Static Data (10-15% reduction)',
          'Predictive Pre-fetching (15-20% reduction)',
          'Vectorized Processing (30-40% reduction)',
          'Real-time Monitoring and Analytics'
        ],
        reason: 'Optimization enabled or development environment'
      };
    }

    return {
      type: 'standard',
      features: [
        'Enhanced Multi-Level Caching (L1/L2)',
        'Intelligent Cache Promotion',
        'Real-time Health Monitoring',
        'Comprehensive Metrics Collection',
        'DAC Best Practices Implementation'
      ],
      reason: 'Production standard cache system'
    };
  }
}

// Export the singleton instance
export const EnhancedCacheFactory = EnhancedCacheFactoryImpl.getInstance();