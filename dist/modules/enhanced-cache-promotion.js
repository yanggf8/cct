/**
 * Enhanced Cache Promotion System
 * Inspired by DAC implementation with intelligent L2→L1 warming
 * Provides automatic cache promotion with smart strategies
 */
import { createLogger } from './logging.js';
const logger = createLogger('enhanced-cache-promotion');
/**
 * Enhanced cache promotion manager
 * Implements intelligent L2→L1 cache warming strategies
 */
export class EnhancedCachePromotionManager {
    constructor() {
        this.enabled = true;
        this.accessHistory = new Map();
        this.stats = {
            totalPromotions: 0,
            successfulPromotions: 0,
            failedPromotions: 0,
            promotionsByStrategy: {
                immediate: 0,
                conditional: 0,
                lazy: 0,
                predictive: 0,
            },
            promotionRate: 0,
            avgPromotionTime: 0,
            memorySaved: 0,
        };
        logger.info('Enhanced Cache Promotion Manager initialized');
    }
    /**
     * Make promotion decision based on context and strategy
     */
    async shouldPromote(context) {
        if (!this.enabled) {
            return {
                shouldPromote: false,
                strategy: 'immediate',
                reason: 'Promotion manager disabled',
                priority: 0,
            };
        }
        // Update access history
        this.updateAccessHistory(context);
        // Determine strategy based on namespace priority and data characteristics
        const strategy = this.determineStrategy(context);
        const decision = await this.evaluatePromotion(context, strategy);
        this.stats.totalPromotions++;
        logger.debug('Promotion decision', {
            key: context.key.substring(0, 50),
            namespace: context.namespace,
            shouldPromote: decision.shouldPromote,
            strategy: decision.strategy,
            reason: decision.reason,
            priority: decision.priority,
        });
        return decision;
    }
    /**
     * Promote data to L1 cache with intelligent handling
     */
    async promoteToL1(l1Cache, context, decision) {
        const startTime = Date.now();
        try {
            if (!decision.shouldPromote) {
                return false;
            }
            // Check if we have space in L1 cache
            const l1Stats = l1Cache.getStats();
            const estimatedSize = context.dataSize || this.estimateDataSize(context.data);
            // Intelligent memory management
            if (!this.shouldFitInL1(l1Stats, estimatedSize, context.config)) {
                logger.debug('Skipping promotion - L1 memory constraints', {
                    currentMemoryMB: l1Stats.currentMemoryMB,
                    dataSize: estimatedSize,
                    namespace: context.namespace,
                });
                this.stats.failedPromotions++;
                return false;
            }
            // Set in L1 cache with appropriate TTL
            const ttl = this.calculatePromotionTTL(context, decision);
            await l1Cache.set(context.key, context.data, ttl);
            const promotionTime = Date.now() - startTime;
            this.updatePromotionStats(decision.strategy, promotionTime, true);
            logger.debug('Successfully promoted to L1', {
                key: context.key.substring(0, 50),
                namespace: context.namespace,
                ttl,
                promotionTime,
                strategy: decision.strategy,
            });
            return true;
        }
        catch (error) {
            this.updatePromotionStats(decision.strategy, Date.now() - startTime, false);
            logger.error('Promotion failed', {
                key: context.key.substring(0, 50),
                namespace: context.namespace,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
    /**
     * Determine promotion strategy based on context
     */
    determineStrategy(context) {
        const { config, accessCount, namespace } = context;
        // High priority data gets immediate promotion
        if (config.priority === 'high') {
            return 'immediate';
        }
        // Frequently accessed data gets conditional promotion
        if (accessCount > 3) {
            return 'conditional';
        }
        // Real-time data gets immediate promotion
        if (namespace.includes('market') || namespace.includes('realtime')) {
            return 'immediate';
        }
        // AI results get predictive promotion
        if (namespace.includes('ai') || namespace.includes('sentiment')) {
            return 'predictive';
        }
        // Default to lazy promotion
        return 'lazy';
    }
    /**
     * Evaluate promotion decision for specific strategy
     */
    async evaluatePromotion(context, strategy) {
        const { accessCount, config, dataSize, namespace } = context;
        switch (strategy) {
            case 'immediate':
                return {
                    shouldPromote: true,
                    strategy: 'immediate',
                    reason: 'High priority or real-time data',
                    priority: 90,
                    estimatedLifespan: config.l1TTL,
                };
            case 'conditional':
                const shouldPromoteConditional = accessCount >= 2 || config.priority === 'medium';
                return {
                    shouldPromote: shouldPromoteConditional,
                    strategy: 'conditional',
                    reason: shouldPromoteConditional
                        ? 'Repeated access or medium priority'
                        : 'Insufficient access patterns',
                    priority: shouldPromoteConditional ? 60 : 20,
                    estimatedLifespan: shouldPromoteConditional ? config.l1TTL * 0.8 : config.l1TTL * 0.3,
                };
            case 'lazy':
                const accessHistory = this.accessHistory.get(context.key);
                const timeSinceFirstAccess = accessHistory
                    ? Date.now() - accessHistory.firstAccess
                    : 0;
                // Promote if accessed multiple times over time
                const shouldPromoteLazy = accessCount >= 3 && timeSinceFirstAccess > 60000; // 1 minute
                return {
                    shouldPromote: shouldPromoteLazy,
                    strategy: 'lazy',
                    reason: shouldPromoteLazy
                        ? 'Consistent access over time'
                        : 'Insufficient access history',
                    priority: shouldPromoteLazy ? 40 : 10,
                    estimatedLifespan: shouldPromoteLazy ? config.l1TTL * 0.6 : 0,
                };
            case 'predictive':
                const predictedUsefulness = this.predictUsefulness(context);
                return {
                    shouldPromote: predictedUsefulness > 0.5,
                    strategy: 'predictive',
                    reason: `Predicted usefulness: ${(predictedUsefulness * 100).toFixed(1)}%`,
                    priority: Math.round(predictedUsefulness * 80),
                    estimatedLifespan: Math.round(config.l1TTL * predictedUsefulness),
                };
            default:
                return {
                    shouldPromote: false,
                    strategy: 'lazy',
                    reason: 'Unknown strategy',
                    priority: 0,
                };
        }
    }
    /**
     * Predict data usefulness based on patterns
     */
    predictUsefulness(context) {
        let score = 0.5; // Base score
        // Access frequency scoring
        const accessScore = Math.min(context.accessCount / 5, 1) * 0.3;
        score += accessScore;
        // Namespace-specific scoring
        if (context.namespace.includes('market'))
            score += 0.2; // Market data is valuable
        if (context.namespace.includes('sentiment'))
            score += 0.15; // Sentiment analysis is useful
        if (context.namespace.includes('ai'))
            score += 0.1; // AI results are moderately useful
        if (context.namespace.includes('reports'))
            score += 0.25; // Reports are very useful
        // Time-based scoring
        const accessHistory = this.accessHistory.get(context.key);
        if (accessHistory) {
            const timeSinceLastAccess = Date.now() - accessHistory.lastAccess;
            const recencyScore = Math.max(0, 1 - (timeSinceLastAccess / 300000)) * 0.1; // 5 minutes window
            score += recencyScore;
        }
        return Math.min(score, 1);
    }
    /**
     * Update access history for tracking patterns
     */
    updateAccessHistory(context) {
        const existing = this.accessHistory.get(context.key);
        const now = Date.now();
        if (existing) {
            existing.count++;
            existing.lastAccess = now;
        }
        else {
            this.accessHistory.set(context.key, {
                count: 1,
                lastAccess: now,
                firstAccess: now,
            });
        }
        // Cleanup old access history (keep only last hour)
        const cutoff = now - 3600000; // 1 hour ago
        for (const [key, history] of this.accessHistory.entries()) {
            if (history.lastAccess < cutoff) {
                this.accessHistory.delete(key);
            }
        }
    }
    /**
     * Check if data should fit in L1 cache
     */
    shouldFitInL1(l1Stats, dataSize, config) {
        // Check memory constraints
        const maxMemoryMB = config.l1MemoryMB || 10;
        const currentMemoryMB = l1Stats.currentMemoryMB || 0;
        const dataMemoryMB = dataSize / (1024 * 1024);
        if (currentMemoryMB + dataMemoryMB > maxMemoryMB * 0.8) { // Use 80% threshold
            return false;
        }
        // Check size constraints
        const maxSize = config.l1MaxSize || 100;
        const currentSize = l1Stats.currentSize || 0;
        if (currentSize >= maxSize * 0.8) { // Use 80% threshold
            return false;
        }
        return true;
    }
    /**
     * Calculate appropriate TTL for promoted data
     */
    calculatePromotionTTL(context, decision) {
        const baseTTL = context.config.l1TTL;
        const priorityMultiplier = decision.priority / 100; // 0-1 multiplier
        // Adjust TTL based on priority and estimated lifespan
        let adjustedTTL = baseTTL * priorityMultiplier;
        // Use estimated lifespan if available
        if (decision.estimatedLifespan) {
            adjustedTTL = Math.min(adjustedTTL, decision.estimatedLifespan);
        }
        // Ensure minimum TTL
        const minTTL = 30; // 30 seconds minimum
        adjustedTTL = Math.max(adjustedTTL, minTTL);
        return Math.round(adjustedTTL);
    }
    /**
     * Estimate data size in bytes
     */
    estimateDataSize(data) {
        try {
            const json = JSON.stringify(data);
            return json.length * 2; // UTF-16 rough estimate
        }
        catch {
            return 1024; // 1KB fallback
        }
    }
    /**
     * Update promotion statistics
     */
    updatePromotionStats(strategy, promotionTime, success) {
        this.stats.promotionsByStrategy[strategy]++;
        if (success) {
            this.stats.successfulPromotions++;
        }
        else {
            this.stats.failedPromotions++;
        }
        // Update average promotion time
        const totalPromotions = this.stats.successfulPromotions + this.stats.failedPromotions;
        this.stats.avgPromotionTime =
            (this.stats.avgPromotionTime * (totalPromotions - 1) + promotionTime) / totalPromotions;
        // Update promotion rate
        this.stats.promotionRate = totalPromotions > 0
            ? this.stats.successfulPromotions / totalPromotions
            : 0;
    }
    /**
     * Get promotion statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalPromotions: 0,
            successfulPromotions: 0,
            failedPromotions: 0,
            promotionsByStrategy: {
                immediate: 0,
                conditional: 0,
                lazy: 0,
                predictive: 0,
            },
            promotionRate: 0,
            avgPromotionTime: 0,
            memorySaved: 0,
        };
        this.accessHistory.clear();
        logger.info('Promotion statistics reset');
    }
    /**
     * Enable/disable promotion manager
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        logger.info(`Promotion manager ${enabled ? 'enabled' : 'disabled'}`);
    }
    /**
     * Check if promotion manager is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Get access patterns for debugging
     */
    getAccessPatterns() {
        const now = Date.now();
        return Array.from(this.accessHistory.entries()).map(([key, history]) => ({
            key: key.length > 50 ? key.substring(0, 47) + '...' : key,
            count: history.count,
            lastAccess: history.lastAccess,
            firstAccess: history.firstAccess,
            age: now - history.firstAccess,
        })).sort((a, b) => b.count - a.count); // Sort by access count
    }
    /**
     * Cleanup old access history
     */
    cleanup() {
        const now = Date.now();
        const cutoff = now - 3600000; // 1 hour ago
        let removed = 0;
        for (const [key, history] of this.accessHistory.entries()) {
            if (history.lastAccess < cutoff) {
                this.accessHistory.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            logger.debug(`Cleaned up ${removed} old access history entries`);
        }
    }
}
/**
 * Global promotion manager instance
 */
let globalPromotionManager = null;
/**
 * Get or create global promotion manager
 */
export function getPromotionManager() {
    if (!globalPromotionManager) {
        globalPromotionManager = new EnhancedCachePromotionManager();
    }
    return globalPromotionManager;
}
/**
 * Create enhanced cache promotion manager
 */
export function createEnhancedCachePromotionManager() {
    return new EnhancedCachePromotionManager();
}
export default EnhancedCachePromotionManager;
//# sourceMappingURL=enhanced-cache-promotion.js.map