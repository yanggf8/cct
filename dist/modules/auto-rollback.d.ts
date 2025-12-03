/**
 * Auto-Rollback System
 * Automatic rollback on SLO breach thresholds with policy enforcement
 */
import type { CloudflareEnvironment } from '../types.js';
export interface AutoRollbackPolicy {
    enabled: boolean;
    sloThresholds: {
        p95LatencyMs: number;
        errorRatePercent: number;
        availabilityPercent: number;
    };
    timeWindows: {
        breachDurationMinutes: number;
        evaluationWindowMinutes: number;
    };
    canary: {
        higherErrorRateMultiplier: number;
        higherLatencyMultiplier: number;
    };
    cooldown: {
        rollbackCooldownMinutes: number;
        evaluationIntervalMinutes: number;
    };
    notifications: {
        enabled: boolean;
        channels: string[];
        alertThreshold: 'warning' | 'critical';
    };
}
export interface RollbackEvent {
    id: string;
    timestamp: string;
    endpoint: string;
    reason: string;
    sloMetrics: {
        p95LatencyMs: number;
        errorRatePercent: number;
        availabilityPercent: number;
    };
    thresholds: {
        p95LatencyMs: number;
        errorRatePercent: number;
        availabilityPercent: number;
    };
    policy: AutoRollbackPolicy;
    rollbackAction: {
        executed: boolean;
        previousCommit?: string;
        canaryDisabled?: boolean;
        timestamp?: string;
    };
    lastKnownGood: {
        commit?: string;
        timestamp?: string;
        metrics?: any;
    };
}
export interface LastKnownGoodState {
    endpoint: string;
    commit: string;
    timestamp: string;
    sloMetrics: {
        p95LatencyMs: number;
        errorRatePercent: number;
        availabilityPercent: number;
    };
    deploymentInfo: {
        version: string;
        buildHash: string;
        deployedAt: string;
    };
}
/**
 * Auto-Rollback Manager
 */
export declare class AutoRollbackManager {
    private env;
    private sloManager;
    private canaryManager;
    private activeEvaluations;
    private lastKnownGoodStates;
    private rollbackHistory;
    private readonly defaultPolicy;
    constructor(env: CloudflareEnvironment);
    /**
     * Start auto-rollback monitoring
     */
    startMonitoring(endpoints: string[]): Promise<void>;
    /**
     * Start monitoring for a specific endpoint
     */
    private startEndpointMonitoring;
    /**
     * Evaluate endpoint against SLO thresholds
     */
    private evaluateEndpoint;
    /**
     * Detect SLO breaches
     */
    private detectBreach;
    /**
     * Check if breaches are sustained over time
     */
    private checkSustainedBreach;
    /**
     * Execute rollback
     */
    private executeRollback;
    /**
     * Perform actual rollback to previous commit
     */
    private performRollback;
    /**
     * Record last known good state
     */
    private recordLastKnownGoodState;
    /**
     * Get current commit hash
     */
    private getCurrentCommit;
    /**
     * Get rollback policy for endpoint
     */
    private getRollbackPolicy;
    /**
     * Get adjusted thresholds based on canary status
     */
    private getAdjustedThresholds;
    /**
     * Record rollback event
     */
    private recordRollbackEvent;
    /**
     * Send rollback notification
     */
    private sendRollbackNotification;
    /**
     * Send rollback failure notification
     */
    private sendRollbackFailureNotification;
    /**
     * Enforce rollback cooldown
     */
    private enforceRollbackCooldown;
    /**
     * Get rollback history
     */
    getRollbackHistory(endpoint: string, limit?: number): Promise<RollbackEvent[]>;
    /**
     * Get last known good state
     */
    getLastKnownGoodState(endpoint: string): Promise<LastKnownGoodState | null>;
    /**
     * Manually trigger rollback to last known good
     */
    rollbackToLastKnownGood(endpoint: string): Promise<void>;
    /**
     * Update rollback policy
     */
    updateRollbackPolicy(endpoint: string, policy: Partial<AutoRollbackPolicy>): Promise<void>;
    /**
     * Stop monitoring
     */
    stopMonitoring(): void;
    /**
     * Get monitoring status
     */
    getMonitoringStatus(): {
        endpoint: string;
        monitoring: boolean;
    }[];
}
//# sourceMappingURL=auto-rollback.d.ts.map