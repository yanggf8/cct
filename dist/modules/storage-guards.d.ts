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
import { EnhancedCacheMetricsManager } from './enhanced-cache-metrics.js';
import type { StorageClass } from './storage-adapters.js';
import type { CloudflareEnvironment } from '../types.js';
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
export declare class StorageGuards {
    private config;
    private metrics;
    private stats;
    private rateLimiter;
    private violationHistory;
    private readonly maxViolationHistory;
    constructor(config?: Partial<GuardConfig>, metrics?: EnhancedCacheMetricsManager);
    /**
     * Main guard check point - called before each KV operation
     */
    checkKvOperation(operation: 'get' | 'put' | 'delete' | 'list', key: string, storageClass: StorageClass, metadata?: {
        latencyMs?: number;
        caller?: string;
    }): Promise<{
        allowed: boolean;
        action: 'logged' | 'error' | 'blocked';
        reason?: string;
    }>;
    /**
     * Check storage class policy violations
     */
    private checkStorageClassPolicy;
    /**
     * Check rate limiting violations
     */
    private checkRateLimits;
    /**
     * Handle detected violations based on guard mode
     */
    private handleViolation;
    /**
     * Record violation and update statistics
     */
    private recordViolation;
    /**
     * Update guard-specific metrics
     */
    private setGuardMetrics;
    /**
     * Check if key matches allowed prefix exceptions
     */
    private isAllowedPrefix;
    /**
     * Extract keyspace from key for metrics
     */
    private extractKeyspace;
    /**
     * Get current guard statistics
     */
    getStats(): GuardStats;
    /**
     * Get recent violations
     */
    getRecentViolations(limit?: number): GuardViolation[];
    /**
     * Update guard configuration
     */
    updateConfig(updates: Partial<GuardConfig>): void;
    /**
     * Reset guard statistics
     */
    resetStats(): void;
    /**
     * Merge default configuration with provided overrides
     */
    private mergeConfig;
    /**
     * Initialize guard statistics
     */
    private initializeStats;
    /**
     * Create guard configuration from environment
     */
    static fromEnvironment(env: CloudflareEnvironment): GuardConfig;
}
/**
 * Create storage guards instance
 */
export declare function createStorageGuards(config?: Partial<GuardConfig>, metrics?: EnhancedCacheMetricsManager): StorageGuards;
/**
 * Default storage guards instance for production use
 */
export declare const defaultStorageGuards: StorageGuards;
//# sourceMappingURL=storage-guards.d.ts.map