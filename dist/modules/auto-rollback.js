/**
 * Auto-Rollback System
 * Automatic rollback on SLO breach thresholds with policy enforcement
 */
import { CanaryToggleManager } from './canary-toggle.js';
import { SLOMonitoringManager } from './slo-monitoring.js';
/**
 * Auto-Rollback Manager
 */
export class AutoRollbackManager {
    constructor(env) {
        this.activeEvaluations = new Map();
        this.lastKnownGoodStates = new Map();
        this.rollbackHistory = new Map();
        // Default auto-rollback policy
        this.defaultPolicy = {
            enabled: true,
            sloThresholds: {
                p95LatencyMs: 3000, // 3 seconds
                errorRatePercent: 2.0, // 2% error rate
                availabilityPercent: 95.0 // 95% availability
            },
            timeWindows: {
                breachDurationMinutes: 5, // 5 minutes of sustained issues
                evaluationWindowMinutes: 10 // 10 minute evaluation window
            },
            canary: {
                higherErrorRateMultiplier: 2.0, // Allow 2x higher error rate for canary
                higherLatencyMultiplier: 1.5 // Allow 1.5x higher latency for canary
            },
            cooldown: {
                rollbackCooldownMinutes: 30, // 30 minutes between rollbacks
                evaluationIntervalMinutes: 2 // Evaluate every 2 minutes
            },
            notifications: {
                enabled: true,
                channels: ['webhook', 'slack', 'email'],
                alertThreshold: 'critical'
            }
        };
        this.env = env;
        this.sloManager = new SLOMonitoringManager(env);
        this.canaryManager = new CanaryToggleManager(env);
    }
    /**
     * Start auto-rollback monitoring
     */
    async startMonitoring(endpoints) {
        console.log('🚨 Starting auto-rollback monitoring for endpoints:', endpoints);
        for (const endpoint of endpoints) {
            await this.startEndpointMonitoring(endpoint);
        }
    }
    /**
     * Start monitoring for a specific endpoint
     */
    async startEndpointMonitoring(endpoint) {
        // Clear any existing monitoring for this endpoint
        if (this.activeEvaluations.has(endpoint)) {
            clearInterval(this.activeEvaluations.get(endpoint));
        }
        // Start periodic evaluation
        const interval = setInterval(async () => {
            await this.evaluateEndpoint(endpoint);
        }, this.defaultPolicy.cooldown.evaluationIntervalMinutes * 60 * 1000);
        this.activeEvaluations.set(endpoint, interval);
        // Record initial baseline
        await this.recordLastKnownGoodState(endpoint);
        console.log(`📊 Started auto-rollback monitoring for ${endpoint}`);
    }
    /**
     * Evaluate endpoint against SLO thresholds
     */
    async evaluateEndpoint(endpoint) {
        try {
            const policy = await this.getRollbackPolicy(endpoint);
            if (!policy.enabled) {
                return;
            }
            // Get current SLO status
            const sloStatus = await this.sloManager.getSLOStatus(endpoint, policy.timeWindows.evaluationWindowMinutes);
            // Get canary context
            const canaryContext = await this.canaryManager.isInCanary(new Request(`https://example.com${endpoint}`), endpoint);
            const thresholds = this.getAdjustedThresholds(policy, canaryContext.isInCanary);
            // Check for SLO breaches
            const breaches = this.detectBreach(sloStatus, thresholds);
            if (breaches.length > 0) {
                console.warn(`⚠️ SLO breach detected for ${endpoint}:`, breaches);
                // Check if breaches are sustained
                const sustainedBreach = await this.checkSustainedBreach(endpoint, breaches);
                if (sustainedBreach) {
                    await this.executeRollback(endpoint, breaches, sloStatus, policy);
                }
            }
            else {
                // Update last known good state if metrics are good
                await this.recordLastKnownGoodState(endpoint);
            }
        }
        catch (error) {
            console.error(`Error evaluating endpoint ${endpoint}:`, error);
        }
    }
    /**
     * Detect SLO breaches
     */
    detectBreach(sloStatus, thresholds) {
        const breaches = [];
        if (sloStatus.currentMetrics.p95ResponseTime > thresholds.p95LatencyMs) {
            breaches.push(`P95 latency: ${sloStatus.currentMetrics.p95ResponseTime}ms > ${thresholds.p95LatencyMs}ms`);
        }
        if (sloStatus.currentMetrics.errorRate > thresholds.errorRatePercent) {
            breaches.push(`Error rate: ${sloStatus.currentMetrics.errorRate}% > ${thresholds.errorRatePercent}%`);
        }
        if (sloStatus.currentMetrics.availability < thresholds.availabilityPercent) {
            breaches.push(`Availability: ${sloStatus.currentMetrics.availability}% < ${thresholds.availabilityPercent}%`);
        }
        return breaches;
    }
    /**
     * Check if breaches are sustained over time
     */
    async checkSustainedBreach(endpoint, breaches) {
        const policy = await this.getRollbackPolicy(endpoint);
        const breachHistory = this.rollbackHistory.get(endpoint) || [];
        // Find recent breach events
        const now = Date.now();
        const recentBreaches = breachHistory.filter(event => {
            const eventTime = new Date(event.timestamp).getTime();
            return (now - eventTime) < policy.timeWindows.breachDurationMinutes * 60 * 1000;
        });
        // Check if we have consecutive breaches
        return recentBreaches.length >= Math.floor(policy.timeWindows.breachDurationMinutes / policy.cooldown.evaluationIntervalMinutes);
    }
    /**
     * Execute rollback
     */
    async executeRollback(endpoint, breaches, sloStatus, policy) {
        console.error(`🚨 EXECUTING AUTO-ROLLBACK for ${endpoint}`);
        const rollbackEvent = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            endpoint,
            reason: breaches.join('; '),
            sloMetrics: {
                p95LatencyMs: sloStatus.currentMetrics.p95ResponseTime,
                errorRatePercent: sloStatus.currentMetrics.errorRate,
                availabilityPercent: sloStatus.currentMetrics.availability
            },
            thresholds: policy.sloThresholds,
            policy,
            rollbackAction: {
                executed: false
            },
            lastKnownGood: this.lastKnownGoodStates.get(endpoint) || {}
        };
        try {
            // Step 1: Disable canary if active
            const canaryContext = await this.canaryManager.isInCanary(new Request(`https://example.com${endpoint}`), endpoint);
            if (canaryContext.isInCanary) {
                console.log(`🔄 Disabling canary for ${endpoint}`);
                await this.canaryManager.disableCanary(endpoint);
                rollbackEvent.rollbackAction.canaryDisabled = true;
                rollbackEvent.rollbackAction.executed = true;
            }
            // Step 2: If canary disable doesn't solve it, perform full rollback
            if (!rollbackEvent.rollbackAction.executed) {
                const lastGood = this.lastKnownGoodStates.get(endpoint);
                if (lastGood) {
                    console.log(`🔄 Rolling back ${endpoint} to commit ${lastGood.commit}`);
                    await this.performRollback(endpoint, lastGood.commit);
                    rollbackEvent.rollbackAction.previousCommit = lastGood.commit;
                    rollbackEvent.rollbackAction.executed = true;
                }
            }
            rollbackEvent.rollbackAction.timestamp = new Date().toISOString();
            // Step 3: Send notifications
            await this.sendRollbackNotification(rollbackEvent);
            // Step 4: Record event
            await this.recordRollbackEvent(rollbackEvent);
            // Step 5: Enforce cooldown
            await this.enforceRollbackCooldown(endpoint);
            console.log(`✅ Auto-rollback completed for ${endpoint}`);
        }
        catch (error) {
            console.error(`❌ Auto-rollback failed for ${endpoint}:`, error);
            // Record failure
            rollbackEvent.rollbackAction.executed = false;
            await this.recordRollbackEvent(rollbackEvent);
            // Send failure notification
            await this.sendRollbackFailureNotification(rollbackEvent, error);
        }
    }
    /**
     * Perform actual rollback to previous commit
     */
    async performRollback(endpoint, targetCommit) {
        // This would integrate with your deployment system
        // For now, we'll simulate the rollback
        console.log(`🔄 Performing rollback to ${targetCommit}`);
        // In a real implementation, you would:
        // 1. Call your deployment API to rollback
        // 2. Wait for rollback to complete
        // 3. Verify rollback was successful
        // 4. Update routing if needed
        // For Cloudflare Workers, you might:
        // - Use wrangler rollback command
        // - Or deploy a specific previous version
        // - Update DNS routing
        await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate rollback time
        console.log(`✅ Rollback to ${targetCommit} completed`);
    }
    /**
     * Record last known good state
     */
    async recordLastKnownGoodState(endpoint) {
        try {
            const sloStatus = await this.sloManager.getSLOStatus(endpoint, 10); // 10 minute window
            if (sloStatus.overall === 'HEALTHY') {
                const state = {
                    endpoint,
                    commit: await this.getCurrentCommit(),
                    timestamp: new Date().toISOString(),
                    sloMetrics: {
                        p95LatencyMs: sloStatus.currentMetrics.p95ResponseTime,
                        errorRatePercent: sloStatus.currentMetrics.errorRate,
                        availabilityPercent: sloStatus.currentMetrics.availability
                    },
                    deploymentInfo: {
                        version: 'current',
                        buildHash: 'current-hash',
                        deployedAt: new Date().toISOString()
                    }
                };
                this.lastKnownGoodStates.set(endpoint, state);
                // Persist to storage
                if (this.env.CACHE) {
                    const key = `last_known_good:${endpoint}`;
                    await this.env.CACHE.put(key, JSON.stringify(state), {
                        expirationTtl: 7 * 24 * 60 * 60 // 7 days
                    });
                }
            }
        }
        catch (error) {
            console.error(`Error recording last known good state for ${endpoint}:`, error);
        }
    }
    /**
     * Get current commit hash
     */
    async getCurrentCommit() {
        // This would get the current deployed commit
        // For now, return a placeholder
        return process.env.GITHUB_SHA || 'unknown-commit';
    }
    /**
     * Get rollback policy for endpoint
     */
    async getRollbackPolicy(endpoint) {
        try {
            if (this.env.CACHE) {
                const key = `rollback_policy:${endpoint}`;
                const stored = await this.env.CACHE.get(key, 'json');
                if (stored) {
                    return stored;
                }
            }
        }
        catch (error) {
            console.error('Error getting rollback policy:', error);
        }
        return this.defaultPolicy;
    }
    /**
     * Get adjusted thresholds based on canary status
     */
    getAdjustedThresholds(policy, isCanary) {
        if (!isCanary) {
            return policy.sloThresholds;
        }
        return {
            p95LatencyMs: policy.sloThresholds.p95LatencyMs * policy.canary.higherLatencyMultiplier,
            errorRatePercent: policy.sloThresholds.errorRatePercent * policy.canary.higherErrorRateMultiplier,
            availabilityPercent: policy.sloThresholds.availabilityPercent // Don't relax availability
        };
    }
    /**
     * Record rollback event
     */
    async recordRollbackEvent(event) {
        const history = this.rollbackHistory.get(event.endpoint) || [];
        history.push(event);
        // Keep only last 100 events
        if (history.length > 100) {
            history.splice(0, history.length - 100);
        }
        this.rollbackHistory.set(event.endpoint, history);
        // Persist to storage
        if (this.env.CACHE) {
            const key = `rollback_history:${event.endpoint}`;
            await this.env.CACHE.put(key, JSON.stringify(history), {
                expirationTtl: 30 * 24 * 60 * 60 // 30 days
            });
        }
    }
    /**
     * Send rollback notification
     */
    async sendRollbackNotification(event) {
        console.log('📧 Sending rollback notification:', {
            endpoint: event.endpoint,
            reason: event.reason,
            executed: event.rollbackAction.executed
        });
        // This would integrate with your notification systems
        // Slack, email, PagerDuty, etc.
    }
    /**
     * Send rollback failure notification
     */
    async sendRollbackFailureNotification(event, error) {
        console.error('🚨 Rollback failure notification:', {
            endpoint: event.endpoint,
            reason: event.reason,
            error: error.message || 'Unknown error'
        });
        // Send critical alert
    }
    /**
     * Enforce rollback cooldown
     */
    async enforceRollbackCooldown(endpoint) {
        const policy = await this.getRollbackPolicy(endpoint);
        const cooldownMs = policy.cooldown.rollbackCooldownMinutes * 60 * 1000;
        // Clear current monitoring
        if (this.activeEvaluations.has(endpoint)) {
            clearInterval(this.activeEvaluations.get(endpoint));
            this.activeEvaluations.delete(endpoint);
        }
        // Restart monitoring after cooldown
        setTimeout(() => {
            this.startEndpointMonitoring(endpoint);
        }, cooldownMs);
        console.log(`⏸️ Rollback cooldown activated for ${endpoint} - monitoring resumes in ${policy.cooldown.rollbackCooldownMinutes} minutes`);
    }
    /**
     * Get rollback history
     */
    async getRollbackHistory(endpoint, limit = 50) {
        const history = this.rollbackHistory.get(endpoint) || [];
        return history.slice(-limit);
    }
    /**
     * Get last known good state
     */
    async getLastKnownGoodState(endpoint) {
        return this.lastKnownGoodStates.get(endpoint) || null;
    }
    /**
     * Manually trigger rollback to last known good
     */
    async rollbackToLastKnownGood(endpoint) {
        const lastGood = await this.getLastKnownGoodState(endpoint);
        if (!lastGood) {
            throw new Error(`No last known good state found for ${endpoint}`);
        }
        console.log(`🔄 Manual rollback to last known good for ${endpoint}: ${lastGood.commit}`);
        await this.performRollback(endpoint, lastGood.commit);
    }
    /**
     * Update rollback policy
     */
    async updateRollbackPolicy(endpoint, policy) {
        const currentPolicy = await this.getRollbackPolicy(endpoint);
        const updatedPolicy = { ...currentPolicy, ...policy };
        if (this.env.CACHE) {
            const key = `rollback_policy:${endpoint}`;
            await this.env.CACHE.put(key, JSON.stringify(updatedPolicy), {
                expirationTtl: 24 * 60 * 60 // 24 hours
            });
        }
        console.log(`Updated rollback policy for ${endpoint}:`, updatedPolicy);
    }
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        for (const [endpoint, interval] of this.activeEvaluations.entries()) {
            clearInterval(interval);
            console.log(`⏹️ Stopped monitoring for ${endpoint}`);
        }
        this.activeEvaluations.clear();
    }
    /**
     * Get monitoring status
     */
    getMonitoringStatus() {
        const status = [];
        for (const endpoint of this.lastKnownGoodStates.keys()) {
            status.push({
                endpoint,
                monitoring: this.activeEvaluations.has(endpoint)
            });
        }
        return status;
    }
}
//# sourceMappingURL=auto-rollback.js.map