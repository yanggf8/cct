/**
 * Migration Manager - Phase 5 Implementation
 * Data Access Improvement Plan - Migration Management
 *
 * Comprehensive migration system for gradual transition from legacy to new API
 * with feature flags, A/B testing, and monitoring capabilities.
 */

import { createSimplifiedEnhancedDAL } from '../modules/simplified-enhanced-dal.js';
import { createLogger } from '../modules/logging.js';
import { legacyUsageTracker } from './legacy-compatibility.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('migration-manager');

/**
 * Migration configuration
 */
export interface MigrationConfig {
  // Feature flags
  enableNewAPI: boolean;
  enableLegacyCompatibility: boolean;
  enableABTesting: boolean;

  // Migration percentages (0-100)
  newAPITrafficPercentage: number;
  legacyEndpointPercentage: number;

  // Endpoint-specific settings
  endpointSettings: {
    [endpoint: string]: {
      enabled: boolean;
      migratePercentage: number;
      forceNewAPI: boolean;
      deprecateAfter?: string;
    };
  };

  // Monitoring and logging
  enableMigrationLogging: boolean;
  enablePerformanceComparison: boolean;
  migrationEventTTL: number;
}

/**
 * Migration event tracking
 */
export interface MigrationEvent {
  id: string;
  timestamp: string;
  type: 'legacy_request' | 'new_api_request' | 'migration_success' | 'migration_error';
  endpoint: string;
  userId?: string;
  userAgent?: string;
  responseTime: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Performance comparison data
 */
export interface PerformanceComparison {
  endpoint: string;
  legacyAPI: {
    averageResponseTime: number;
    successRate: number;
    totalRequests: number;
  };
  newAPI: {
    averageResponseTime: number;
    successRate: number;
    totalRequests: number;
  };
  improvement: {
    responseTimeImprovement: number;
    successRateImprovement: number;
    overallImprovement: number;
  };
  timestamp: string;
}

/**
 * Migration Manager Class
 */
export class MigrationManager {
  private env: CloudflareEnvironment;
  private config: MigrationConfig;
  private dal: ReturnType<typeof createSimplifiedEnhancedDAL>;
  private migrationEvents: MigrationEvent[] = [];
  private performanceData: Map<string, PerformanceComparison> = new Map();

  constructor(env: CloudflareEnvironment, config: Partial<MigrationConfig> = {}) {
    this.env = env;
    this.config = {
      enableNewAPI: true,
      enableLegacyCompatibility: true,
      enableABTesting: false,
      newAPITrafficPercentage: 50,
      legacyEndpointPercentage: 100,
      endpointSettings: {},
      enableMigrationLogging: true,
      enablePerformanceComparison: true,
      migrationEventTTL: 7 * 24 * 60 * 60, // 7 days
      ...config
    };

    this.dal = createSimplifiedEnhancedDAL(env, {
      enableCache: true,
      environment: env.ENVIRONMENT || 'production'
    });

    logger.info('Migration Manager initialized', {
      newAPIEnabled: this.config.enableNewAPI,
      legacyEnabled: this.config.enableLegacyCompatibility,
      abTestingEnabled: this.config.enableABTesting,
      newAPITrafficPercentage: this.config.newAPITrafficPercentage
    });
  }

  /**
   * Determine if request should use new API based on configuration
   */
  shouldUseNewAPI(
    request: Request,
    endpoint?: string
  ): { useNewAPI: boolean; reason: string } {
    // Check feature flags
    if (!this.config.enableNewAPI) {
      return { useNewAPI: false, reason: 'New API disabled by feature flag' };
    }

    // Check endpoint-specific settings
    if (endpoint && this.config.endpointSettings[endpoint]) {
      const settings = this.config.endpointSettings[endpoint];
      if (settings.forceNewAPI) {
        return { useNewAPI: true, reason: 'Forced new API for endpoint' };
      }
      if (!settings.enabled) {
        return { useNewAPI: false, reason: 'Endpoint disabled' };
      }
    }

    // A/B testing logic
    if (this.config.enableABTesting) {
      const hash = this.hashRequest(request);
      const threshold = this.config.newAPITrafficPercentage / 100;

      if (hash < threshold) {
        return { useNewAPI: true, reason: 'A/B testing selected new API' };
      } else {
        return { useNewAPI: false, reason: 'A/B testing selected legacy API' };
      }
    }

    // Default to new API if enabled
    return { useNewAPI: true, reason: 'Default to new API' };
  }

  /**
   * Generate hash for consistent A/B testing
   */
  private hashRequest(request: Request): number {
    const userAgent = request.headers.get('User-Agent') || '';
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '';
    const timestamp = new Date().toISOString().split('T')[0]; // Daily consistency

    const str = `${userAgent}-${ip}-${timestamp}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash) / Math.pow(2, 31); // Normalize to 0-1
  }

  /**
   * Record migration event
   */
  async recordMigrationEvent(event: Omit<MigrationEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: MigrationEvent = {
      id: `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...event
    };

    this.migrationEvents.push(fullEvent);

    // Store in database for persistence
    try {
      await this.dal.write(`migration_event_${fullEvent.id}`, fullEvent, {
        expirationTtl: this.config.migrationEventTTL
      });
    } catch (error: unknown) {
      logger.warn('Failed to store migration event', { error });
    }

    // Log if enabled
    if (this.config.enableMigrationLogging) {
      logger.info('Migration event recorded', {
        type: fullEvent.type,
        endpoint: fullEvent.endpoint,
        success: fullEvent.success,
        responseTime: fullEvent.responseTime,
        reason: event.metadata?.reason
      });
    }

    // Cleanup old events
    this.cleanupOldEvents();
  }

  /**
   * Record performance comparison
   */
  async recordPerformanceComparison(
    endpoint: string,
    legacyTime: number,
    newTime: number,
    legacySuccess: boolean,
    newSuccess: boolean
  ): Promise<void> {
    const comparison: PerformanceComparison = {
      endpoint,
      legacyAPI: {
        averageResponseTime: legacyTime,
        successRate: legacySuccess ? 100 : 0,
        totalRequests: 1
      },
      newAPI: {
        averageResponseTime: newTime,
        successRate: newSuccess ? 100 : 0,
        totalRequests: 1
      },
      improvement: {
        responseTimeImprovement: ((legacyTime - newTime) / legacyTime) * 100,
        successRateImprovement: (newSuccess ? 100 : 0) - (legacySuccess ? 100 : 0),
        overallImprovement: 0 // Calculated below
      },
      timestamp: new Date().toISOString()
    };

    // Calculate overall improvement
    comparison.improvement.overallImprovement = (
      comparison.improvement.responseTimeImprovement * 0.7 +
      comparison.improvement.successRateImprovement * 0.3
    );

    // Update existing or add new comparison
    const existing = this.performanceData.get(endpoint);
    if (existing) {
      // Weighted average with existing data
      const totalLegacyRequests = existing.legacyAPI.totalRequests + 1;
      const totalNewRequests = existing.newAPI.totalRequests + 1;

      comparison.legacyAPI.averageResponseTime =
        (existing.legacyAPI.averageResponseTime * existing.legacyAPI.totalRequests + legacyTime) / totalLegacyRequests;
      comparison.legacyAPI.successRate =
        (existing.legacyAPI.successRate * existing.legacyAPI.totalRequests + (legacySuccess ? 100 : 0)) / totalLegacyRequests;
      comparison.legacyAPI.totalRequests = totalLegacyRequests;

      comparison.newAPI.averageResponseTime =
        (existing.newAPI.averageResponseTime * existing.newAPI.totalRequests + newTime) / totalNewRequests;
      comparison.newAPI.successRate =
        (existing.newAPI.successRate * existing.newAPI.totalRequests + (newSuccess ? 100 : 0)) / totalNewRequests;
      comparison.newAPI.totalRequests = totalNewRequests;
    }

    this.performanceData.set(endpoint, comparison);

    // Store in database
    try {
      await this.dal.write(`performance_comparison_${endpoint}`, comparison, {
        expirationTtl: this.config.migrationEventTTL
      });
    } catch (error: unknown) {
      logger.warn('Failed to store performance comparison', { error, endpoint });
    }
  }

  /**
   * Get migration statistics
   */
  async getMigrationStatistics(): Promise<{
    events: {
      total: number;
      legacyRequests: number;
      newAPIRequests: number;
      errors: number;
      successRate: number;
    };
    performance: PerformanceComparison[];
    legacyUsage: { endpoint: string; count: number; lastUsed: string }[];
    recommendations: string[];
  }> {
    const totalEvents = this.migrationEvents.length;
    const legacyRequests = this.migrationEvents.filter(e => e.type === 'legacy_request').length;
    const newAPIRequests = this.migrationEvents.filter(e => e.type === 'new_api_request').length;
    const errors = this.migrationEvents.filter(e => !e.success).length;
    const successRate = totalEvents > 0 ? ((totalEvents - errors) / totalEvents) * 100 : 0;

    const performance = Array.from(this.performanceData.values());
    const legacyUsage = legacyUsageTracker.getUsageStats();

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      totalEvents,
      legacyRequests,
      newAPIRequests,
      successRate,
      performance
    );

    return {
      events: {
        total: totalEvents,
        legacyRequests,
        newAPIRequests,
        errors,
        successRate
      },
      performance,
      legacyUsage,
      recommendations
    };
  }

  /**
   * Generate migration recommendations
   */
  private generateRecommendations(
    totalEvents: number,
    legacyRequests: number,
    newAPIRequests: number,
    successRate: number,
    performance: PerformanceComparison[]
  ): string[] {
    const recommendations: string[] = [];

    if (totalEvents < 100) {
      recommendations.push('Collect more data before making migration decisions');
    }

    if (legacyRequests > newAPIRequests * 2) {
      recommendations.push('Consider increasing newAPI traffic percentage for faster migration');
    }

    if (successRate < 95) {
      recommendations.push('Investigate and fix errors before proceeding with migration');
    }

    const avgImprovement = performance.length > 0
      ? performance.reduce((sum: any, p: any) => sum + p.improvement.overallImprovement, 0) / performance.length
      : 0;

    if (avgImprovement > 20) {
      recommendations.push('New API shows significant performance improvement - consider full migration');
    } else if (avgImprovement < -10) {
      recommendations.push('New API performance is lower - investigate optimization before migration');
    }

    const highUsageLegacy = legacyUsageTracker.getUsageStats()
      .filter(u => u.count > 50);

    if (highUsageLegacy.length > 0) {
      recommendations.push(`High-usage legacy endpoints detected: ${highUsageLegacy.map(u => u.endpoint).join(', ')}`);
    }

    return recommendations;
  }

  /**
   * Update migration configuration
   */
  updateConfig(newConfig: Partial<MigrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Migration configuration updated', { newConfig });
  }

  /**
   * Get current configuration
   */
  getConfig(): MigrationConfig {
    return { ...this.config };
  }

  /**
   * Cleanup old events
   */
  private cleanupOldEvents(): void {
    const cutoffTime = Date.now() - (this.config.migrationEventTTL * 1000);
    this.migrationEvents = this.migrationEvents.filter(event =>
      new Date(event.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * Export migration data for analysis
   */
  async exportMigrationData(): Promise<{
    events: MigrationEvent[];
    performance: PerformanceComparison[];
    config: MigrationConfig;
    timestamp: string;
  }> {
    return {
      events: [...this.migrationEvents],
      performance: Array.from(this.performanceData.values()),
      config: this.getConfig(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Global migration manager instance
 */
let globalMigrationManager: MigrationManager | null = null;

/**
 * Get or create global migration manager
 */
export function getMigrationManager(
  env: CloudflareEnvironment,
  config?: Partial<MigrationConfig>
): MigrationManager {
  if (!globalMigrationManager) {
    globalMigrationManager = new MigrationManager(env, config);
  }
  return globalMigrationManager;
}

/**
 * Middleware to handle migration logic
 */
export async function migrationMiddleware(
  request: Request,
  env: CloudflareEnvironment,
  endpoint?: string
): Promise<{
  useNewAPI: boolean;
  reason: string;
  migrationManager: MigrationManager;
}> {
  const migrationManager = getMigrationManager(env);

  const decision = migrationManager.shouldUseNewAPI(request, endpoint);

  // Record decision for analytics
  await migrationManager.recordMigrationEvent({
    type: decision.useNewAPI ? 'new_api_request' : 'legacy_request',
    endpoint: endpoint || request.url,
    responseTime: 0, // Will be updated after response
    success: true,
    metadata: {
      reason: decision.reason,
      userAgent: request.headers.get('User-Agent'),
      method: request.method
    }
  });

  return {
    useNewAPI: decision.useNewAPI,
    reason: decision.reason,
    migrationManager
  };
}

export default {
  MigrationManager,
  getMigrationManager,
  migrationMiddleware
};