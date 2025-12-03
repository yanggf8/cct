/**
 * Enhanced Cache Promotion System
 * Inspired by DAC implementation with intelligent L2→L1 warming
 * Provides automatic cache promotion with smart strategies
 */
import type { EnhancedCacheConfig } from './enhanced-cache-config.js';
import type { EnhancedHashCache } from './enhanced-hash-cache.js';
/**
 * Cache promotion strategies
 */
export type PromotionStrategy = 'immediate' | 'conditional' | 'lazy' | 'predictive';
/**
 * Promotion decision context
 */
export interface PromotionContext {
    key: string;
    namespace: string;
    accessCount: number;
    lastAccess: number;
    data: any;
    dataSize: number;
    config: EnhancedCacheConfig;
}
/**
 * Promotion decision result
 */
export interface PromotionDecision {
    shouldPromote: boolean;
    strategy: PromotionStrategy;
    reason: string;
    priority: number;
    estimatedLifespan?: number;
}
/**
 * Cache promotion statistics
 */
export interface PromotionStats {
    totalPromotions: number;
    successfulPromotions: number;
    failedPromotions: number;
    promotionsByStrategy: Record<PromotionStrategy, number>;
    promotionRate: number;
    avgPromotionTime: number;
    memorySaved: number;
}
/**
 * Enhanced cache promotion manager
 * Implements intelligent L2→L1 cache warming strategies
 */
export declare class EnhancedCachePromotionManager {
    private stats;
    private accessHistory;
    private enabled;
    constructor();
    /**
     * Make promotion decision based on context and strategy
     */
    shouldPromote(context: PromotionContext): Promise<PromotionDecision>;
    /**
     * Promote data to L1 cache with intelligent handling
     */
    promoteToL1(l1Cache: EnhancedHashCache<any>, context: PromotionContext, decision: PromotionDecision): Promise<boolean>;
    /**
     * Determine promotion strategy based on context
     */
    private determineStrategy;
    /**
     * Evaluate promotion decision for specific strategy
     */
    private evaluatePromotion;
    /**
     * Predict data usefulness based on patterns
     */
    private predictUsefulness;
    /**
     * Update access history for tracking patterns
     */
    private updateAccessHistory;
    /**
     * Check if data should fit in L1 cache
     */
    private shouldFitInL1;
    /**
     * Calculate appropriate TTL for promoted data
     */
    private calculatePromotionTTL;
    /**
     * Estimate data size in bytes
     */
    private estimateDataSize;
    /**
     * Update promotion statistics
     */
    private updatePromotionStats;
    /**
     * Get promotion statistics
     */
    getStats(): PromotionStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Enable/disable promotion manager
     */
    setEnabled(enabled: boolean): void;
    /**
     * Check if promotion manager is enabled
     */
    isEnabled(): boolean;
    /**
     * Get access patterns for debugging
     */
    getAccessPatterns(): Array<{
        key: string;
        count: number;
        lastAccess: number;
        firstAccess: number;
        age: number;
    }>;
    /**
     * Cleanup old access history
     */
    cleanup(): void;
}
/**
 * Get or create global promotion manager
 */
export declare function getPromotionManager(): EnhancedCachePromotionManager;
/**
 * Create enhanced cache promotion manager
 */
export declare function createEnhancedCachePromotionManager(): EnhancedCachePromotionManager;
export default EnhancedCachePromotionManager;
//# sourceMappingURL=enhanced-cache-promotion.d.ts.map