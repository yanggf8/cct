/**
 * Storage Guards Module - Option C Implementation
 *
 * Enforces KV elimination policies for MARKET_ANALYSIS_CACHE in production
 * Provides graduated enforcement modes: WARN -> ERROR -> BLOCK
 * Emits comprehensive metrics for guard violation monitoring
 *
 * @version 1.0.0 - Storage Guard Implementation
 * @since 2025-11-28
 */

import { createLogger } from './logging.js';
import { EnhancedCacheMetricsManager } from './enhanced-cache-metrics.js';
import type { StorageClass } from './storage-adapters.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('storage-guards');

// ============================================================================
// Guard Configuration Types
// ============================================================================

export type GuardMode = 'disabled' | 'warn' | 'error' | 'block';

export interface GuardConfig {
  enabled: boolean;
  mode: GuardMode;
  enforcement: {
    hotCacheOnlyDO: boolean;
    warmCacheOnlyDO: boolean;
    coldStorageAllowD1: boolean;
    ephemeralAllowMemory: boolean;
  };
  thresholds: {
    maxKvOperationsPerMinute: number;
    maxKvReadLatencyMs: number;
    errorRateThreshold: number;
  };
  exceptions: {
    adminBypass: boolean;
    allowedPrefixes: string[];
    maintenanceMode: boolean;
  };
}

export interface GuardViolation {
  timestamp: string;
  storageClass: StorageClass;
  operation: 'get' | 'put' | 'delete' | 'list';
  violationType: 'kv_forbidden' | 'latency_exceeded' | 'rate_limit_exceeded' | 'policy_violation';
  key: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'logged' | 'error' | 'blocked';
  metadata?: {
    latencyMs?: number;
    reason?: string;
    caller?: string;
    fallbackUsed?: boolean;
  };
}

export interface GuardStats {
  totalChecks: number;
  violations: {
    total: number;
    kvForbidden: number;
    latencyExceeded: number;
    rateLimitExceeded: number;
    policyViolations: number;
  };
  actions: {
    logged: number;
    errors: number;
    blocked: number;
  };
  byStorageClass: Record<StorageClass, {
    violations: number;
    blocked: number;
  }>;
  lastViolation?: GuardViolation;
}

// ============================================================================
// Storage Guards Implementation
// ============================================================================

export class StorageGuards {
  private config: GuardConfig;
  private metrics: EnhancedCacheMetricsManager;
  private stats: GuardStats;
  private rateLimiter: Map<string, number[]> = new Map();
  private violationHistory: GuardViolation[] = [];
  private readonly maxViolationHistory = 1000;

  constructor(config: Partial<GuardConfig> = {}, metrics?: EnhancedCacheMetricsManager) {
    this.config = this.mergeConfig(config);
    this.metrics = metrics || new EnhancedCacheMetricsManager();
    this.stats = this.initializeStats();

    logger.info('Storage Guards initialized', {
      mode: this.config.mode,
      enabled: this.config.enabled,
      enforcement: this.config.enforcement
    });
  }

  /**
   * Main guard check point - called before each KV operation
   */
  async checkKvOperation(
    operation: 'get' | 'put' | 'delete' | 'list',
    key: string,
    storageClass: StorageClass,
    metadata?: { latencyMs?: number; caller?: string }
  ): Promise<{ allowed: boolean; action: 'logged' | 'error' | 'blocked'; reason?: string }> {
    // Short-circuit if guards are disabled
    if (!this.config.enabled || this.config.mode === 'disabled') {
      return { allowed: true, action: 'logged' };
    }

    this.stats.totalChecks++;

    // Check for admin bypass
    if (this.config.exceptions.adminBypass && metadata?.caller?.includes('admin')) {
      logger.debug('Admin bypass for KV operation', { key, operation, caller: metadata.caller });
      return { allowed: true, action: 'logged' };
    }

    // Check maintenance mode exception
    if (this.config.exceptions.maintenanceMode) {
      logger.warn('KV operation allowed in maintenance mode', { key, operation, storageClass });
      this.recordViolation({
        timestamp: new Date().toISOString(),
        storageClass,
        operation,
        violationType: 'policy_violation',
        key,
        severity: 'medium',
        action: 'logged',
        metadata: { reason: 'maintenance_mode_exception', caller: metadata?.caller }
      });
      return { allowed: true, action: 'logged', reason: 'maintenance_mode_exception' };
    }

    // Check for allowed prefixes
    if (this.isAllowedPrefix(key)) {
      logger.debug('KV operation allowed by prefix exception', { key, operation });
      return { allowed: true, action: 'logged' };
    }

    // Core storage class enforcement
    const violation = this.checkStorageClassPolicy(operation, storageClass, key, metadata);
    if (violation) {
      return this.handleViolation(violation);
    }

    // Rate limiting checks
    const rateViolation = this.checkRateLimits(key, operation);
    if (rateViolation) {
      return this.handleViolation(rateViolation);
    }

    // Latency checks (if provided)
    if (metadata?.latencyMs && metadata.latencyMs > this.config.thresholds.maxKvReadLatencyMs) {
      const latencyViolation: GuardViolation = {
        timestamp: new Date().toISOString(),
        storageClass,
        operation,
        violationType: 'latency_exceeded',
        key,
        severity: 'medium',
        action: this.config.mode === 'block' ? 'blocked' : this.config.mode === 'warn' ? 'logged' : 'error',
        metadata: {
          latencyMs: metadata.latencyMs,
          reason: `Latency ${metadata.latencyMs}ms exceeds threshold ${this.config.thresholds.maxKvReadLatencyMs}ms`,
          caller: metadata.caller
        }
      };
      return this.handleViolation(latencyViolation);
    }

    // No violations found
    return { allowed: true, action: 'logged' };
  }

  /**
   * Check storage class policy violations
   */
  private checkStorageClassPolicy(
    operation: string,
    storageClass: StorageClass,
    key: string,
    metadata?: { latencyMs?: number; caller?: string }
  ): GuardViolation | null {
    let isViolation = false;
    let reason = '';

    switch (storageClass) {
      case 'hot_cache':
        if (this.config.enforcement.hotCacheOnlyDO) {
          isViolation = true;
          reason = 'KV operations forbidden for hot_cache - must use DO';
        }
        break;

      case 'warm_cache':
        if (this.config.enforcement.warmCacheOnlyDO) {
          isViolation = true;
          reason = 'KV operations forbidden for warm_cache - must use DO';
        }
        break;

      case 'cold_storage':
        if (!this.config.enforcement.coldStorageAllowD1) {
          isViolation = true;
          reason = 'KV operations for cold_storage require D1 - must use D1Adapter';
        }
        break;

      case 'ephemeral':
        if (!this.config.enforcement.ephemeralAllowMemory) {
          isViolation = true;
          reason = 'KV operations for ephemeral require memory - must use MemoryAdapter';
        }
        break;
    }

    if (isViolation) {
      return {
        timestamp: new Date().toISOString(),
        storageClass,
        operation: operation as any,
        violationType: 'kv_forbidden',
        key,
        severity: storageClass === 'hot_cache' || storageClass === 'warm_cache' ? 'high' : 'medium',
        action: this.config.mode === 'block' ? 'blocked' : this.config.mode === 'warn' ? 'logged' : 'error',
        metadata: { reason, caller: metadata?.caller }
      };
    }

    return null;
  }

  /**
   * Check rate limiting violations
   */
  private checkRateLimits(key: string, operation: string): GuardViolation | null {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    const windowKey = `${operation}:${key.substring(0, 10)}`; // Limit by operation + key prefix

    // Clean old entries
    if (!this.rateLimiter.has(windowKey)) {
      this.rateLimiter.set(windowKey, []);
    }
    const timestamps = this.rateLimiter.get(windowKey)!;

    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(t => t > windowStart);
    this.rateLimiter.set(windowKey, validTimestamps);

    // Check rate limit
    if (validTimestamps.length >= this.config.thresholds.maxKvOperationsPerMinute) {
      return {
        timestamp: new Date().toISOString(),
        storageClass: 'hot_cache', // Default to hot_cache for rate violations
        operation: operation as any,
        violationType: 'rate_limit_exceeded',
        key,
        severity: 'medium',
        action: this.config.mode === 'block' ? 'blocked' : this.config.mode === 'warn' ? 'logged' : 'error',
        metadata: {
          reason: `Rate limit exceeded: ${validTimestamps.length} operations/min > ${this.config.thresholds.maxKvOperationsPerMinute}`
        }
      };
    }

    // Record this operation
    validTimestamps.push(now);
    return null;
  }

  /**
   * Handle detected violations based on guard mode
   */
  private handleViolation(violation: GuardViolation): { allowed: boolean; action: 'logged' | 'error' | 'blocked'; reason?: string } {
    this.recordViolation(violation);

    switch (this.config.mode) {
      case 'warn':
        logger.warn('Guard violation - WARN mode', {
          key: violation.key,
          storageClass: violation.storageClass,
          operation: violation.operation,
          violationType: violation.violationType,
          reason: violation.metadata?.reason
        });
        return { allowed: true, action: 'logged', reason: violation.metadata?.reason };

      case 'error':
        logger.error('Guard violation - ERROR mode', {
          key: violation.key,
          storageClass: violation.storageClass,
          operation: violation.operation,
          violationType: violation.violationType,
          reason: violation.metadata?.reason
        });
        violation.action = 'error';
        return { allowed: false, action: 'error', reason: violation.metadata?.reason };

      case 'block':
        logger.error('Guard violation - BLOCK mode', {
          key: violation.key,
          storageClass: violation.storageClass,
          operation: violation.operation,
          violationType: violation.violationType,
          reason: violation.metadata?.reason
        });
        violation.action = 'blocked';
        return { allowed: false, action: 'blocked', reason: violation.metadata?.reason };

      default:
        return { allowed: true, action: 'logged' };
    }
  }

  /**
   * Record violation and update statistics
   */
  private recordViolation(violation: GuardViolation): void {
    // Update local statistics
    this.stats.violations.total++;
    this.stats.byStorageClass[violation.storageClass].violations++;

    switch (violation.violationType) {
      case 'kv_forbidden':
        this.stats.violations.kvForbidden++;
        break;
      case 'latency_exceeded':
        this.stats.violations.latencyExceeded++;
        break;
      case 'rate_limit_exceeded':
        this.stats.violations.rateLimitExceeded++;
        break;
      case 'policy_violation':
        this.stats.violations.policyViolations++;
        break;
    }

    this.stats.actions[violation.action]++;

    // Add to history
    this.violationHistory.push(violation);
    if (this.violationHistory.length > this.maxViolationHistory) {
      this.violationHistory.shift();
    }

    this.stats.lastViolation = violation;

    // Emit metrics - map 'delete' to 'del' for dashboard compatibility
    const opLabel = violation.operation === 'delete' ? 'del' : violation.operation as 'get' | 'put' | 'del' | 'list';
    this.metrics.recordOperation(opLabel, {
      system: 'CCT',
      layer: 'edge',
      storage_class: violation.storageClass,
      keyspace: this.extractKeyspace(violation.key),
      op: opLabel,
      result: 'violation'
    }, 0, false);

    this.setGuardMetrics();
  }

  /**
   * Update guard-specific metrics
   */
  private setGuardMetrics(): void {
    this.metrics.setGauge('guard_violations_total', {
      system: 'CCT',
      layer: 'edge',
      storage_class: 'all',
      keyspace: 'market_analysis_cache'
    }, this.stats.violations.total);

    this.metrics.setGauge('guard_checks_total', {
      system: 'CCT',
      layer: 'edge',
      storage_class: 'all',
      keyspace: 'market_analysis_cache'
    }, this.stats.totalChecks);
  }

  /**
   * Check if key matches allowed prefix exceptions
   */
  private isAllowedPrefix(key: string): boolean {
    return this.config.exceptions.allowedPrefixes.some(prefix => key.startsWith(prefix));
  }

  /**
   * Extract keyspace from key for metrics
   */
  private extractKeyspace(key: string): string {
    const parts = key.split('_');
    if (parts.length >= 2) {
      return parts.slice(0, 2).join('_');
    } else if (parts.length === 1) {
      return parts[0];
    } else {
      return 'unknown';
    }
  }

  /**
   * Get current guard statistics
   */
  getStats(): GuardStats {
    return { ...this.stats };
  }

  /**
   * Get recent violations
   */
  getRecentViolations(limit: number = 50): GuardViolation[] {
    return this.violationHistory.slice(-limit);
  }

  /**
   * Update guard configuration
   */
  updateConfig(updates: Partial<GuardConfig>): void {
    const oldMode = this.config.mode;
    this.config = this.mergeConfig(updates);

    logger.info('Guard configuration updated', {
      oldMode,
      newMode: this.config.mode,
      updates: Object.keys(updates)
    });
  }

  /**
   * Reset guard statistics
   */
  resetStats(): void {
    this.stats = this.initializeStats();
    this.violationHistory = [];
    this.rateLimiter.clear();
    logger.info('Guard statistics reset');
  }

  /**
   * Merge default configuration with provided overrides
   */
  private mergeConfig(config: Partial<GuardConfig>): GuardConfig {
    return {
      enabled: config.enabled ?? true,
      mode: config.mode ?? 'warn',
      enforcement: {
        hotCacheOnlyDO: config.enforcement?.hotCacheOnlyDO ?? true,
        warmCacheOnlyDO: config.enforcement?.warmCacheOnlyDO ?? true,
        coldStorageAllowD1: config.enforcement?.coldStorageAllowD1 ?? true,
        ephemeralAllowMemory: config.enforcement?.ephemeralAllowMemory ?? true,
        ...config.enforcement
      },
      thresholds: {
        maxKvOperationsPerMinute: config.thresholds?.maxKvOperationsPerMinute ?? 100,
        maxKvReadLatencyMs: config.thresholds?.maxKvReadLatencyMs ?? 50,
        errorRateThreshold: config.thresholds?.errorRateThreshold ?? 0.05,
        ...config.thresholds
      },
      exceptions: {
        adminBypass: config.exceptions?.adminBypass ?? true,
        allowedPrefixes: config.exceptions?.allowedPrefixes ?? ['system_', 'config_', 'health_'],
        maintenanceMode: config.exceptions?.maintenanceMode ?? false,
        ...config.exceptions
      }
    };
  }

  /**
   * Initialize guard statistics
   */
  private initializeStats(): GuardStats {
    return {
      totalChecks: 0,
      violations: {
        total: 0,
        kvForbidden: 0,
        latencyExceeded: 0,
        rateLimitExceeded: 0,
        policyViolations: 0
      },
      actions: {
        logged: 0,
        errors: 0,
        blocked: 0
      },
      byStorageClass: {
        hot_cache: { violations: 0, blocked: 0 },
        warm_cache: { violations: 0, blocked: 0 },
        cold_storage: { violations: 0, blocked: 0 },
        ephemeral: { violations: 0, blocked: 0 }
      }
    };
  }

  /**
   * Create guard configuration from environment
   */
  static fromEnvironment(env: CloudflareEnvironment): GuardConfig {
    const mode = (env.STORAGE_GUARDS_MODE || 'warn') as GuardMode;

    return {
      enabled: env.STORAGE_GUARDS_ENABLED === 'true',
      mode,
      enforcement: {
        hotCacheOnlyDO: env.HOT_CACHE_DO_ONLY !== 'false',
        warmCacheOnlyDO: env.WARM_CACHE_DO_ONLY !== 'false',
        coldStorageAllowD1: env.COLD_STORAGE_ALLOW_D1 !== 'false',
        ephemeralAllowMemory: env.EPHEMERAL_ALLOW_MEMORY !== 'false'
      },
      thresholds: {
        maxKvOperationsPerMinute: parseInt(env.GUARD_MAX_KV_OPS_PER_MINUTE || '100', 10),
        maxKvReadLatencyMs: parseInt(env.GUARD_MAX_KV_LATENCY_MS || '50', 10),
        errorRateThreshold: parseFloat(env.GUARD_ERROR_RATE_THRESHOLD || '0.05')
      },
      exceptions: {
        adminBypass: env.GUARD_ADMIN_BYPASS !== 'false',
        allowedPrefixes: (env.GUARD_ALLOWED_PREFIXES || 'system_,config_,health_').split(',').map(p => p.trim()),
        maintenanceMode: env.GUARD_MAINTENANCE_MODE === 'true'
      }
    };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): GuardConfig {
    return this.config;
  }
}

/**
 * Create storage guards instance
 */
export function createStorageGuards(config: Partial<GuardConfig> = {}, metrics?: EnhancedCacheMetricsManager): StorageGuards {
  return new StorageGuards(config, metrics);
}

/**
 * Default storage guards instance for production use
 */
export const defaultStorageGuards = createStorageGuards({
  mode: 'warn',
  enforcement: {
    hotCacheOnlyDO: true,
    warmCacheOnlyDO: true,
    coldStorageAllowD1: true,
    ephemeralAllowMemory: true
  }
});