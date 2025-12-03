/**
 * Migration Manager - Phase 5 Implementation
 * Data Access Improvement Plan - Migration Management
 *
 * Comprehensive migration system for gradual transition from legacy to new API
 * with feature flags, A/B testing, and monitoring capabilities.
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Migration configuration
 */
export interface MigrationConfig {
    enableNewAPI: boolean;
    enableLegacyCompatibility: boolean;
    enableABTesting: boolean;
    newAPITrafficPercentage: number;
    legacyEndpointPercentage: number;
    endpointSettings: {
        [endpoint: string]: {
            enabled: boolean;
            migratePercentage: number;
            forceNewAPI: boolean;
            deprecateAfter?: string;
        };
    };
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
export declare class MigrationManager {
    private env;
    private config;
    private dal;
    private migrationEvents;
    private performanceData;
    constructor(env: CloudflareEnvironment, config?: Partial<MigrationConfig>);
    /**
     * Determine if request should use new API based on configuration
     */
    shouldUseNewAPI(request: Request, endpoint?: string): {
        useNewAPI: boolean;
        reason: string;
    };
    /**
     * Generate hash for consistent A/B testing
     */
    private hashRequest;
    /**
     * Record migration event
     */
    recordMigrationEvent(event: Omit<MigrationEvent, 'id' | 'timestamp'>): Promise<void>;
    /**
     * Record performance comparison
     */
    recordPerformanceComparison(endpoint: string, legacyTime: number, newTime: number, legacySuccess: boolean, newSuccess: boolean): Promise<void>;
    /**
     * Get migration statistics
     */
    getMigrationStatistics(): Promise<{
        events: {
            total: number;
            legacyRequests: number;
            newAPIRequests: number;
            errors: number;
            successRate: number;
        };
        performance: PerformanceComparison[];
        legacyUsage: {
            endpoint: string;
            count: number;
            lastUsed: string;
        }[];
        recommendations: string[];
    }>;
    /**
     * Generate migration recommendations
     */
    private generateRecommendations;
    /**
     * Update migration configuration
     */
    updateConfig(newConfig: Partial<MigrationConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): MigrationConfig;
    /**
     * Cleanup old events
     */
    private cleanupOldEvents;
    /**
     * Export migration data for analysis
     */
    exportMigrationData(): Promise<{
        events: MigrationEvent[];
        performance: PerformanceComparison[];
        config: MigrationConfig;
        timestamp: string;
    }>;
}
/**
 * Get or create global migration manager
 */
export declare function getMigrationManager(env: CloudflareEnvironment, config?: Partial<MigrationConfig>): MigrationManager;
/**
 * Middleware to handle migration logic
 */
export declare function migrationMiddleware(request: Request, env: CloudflareEnvironment, endpoint?: string): Promise<{
    useNewAPI: boolean;
    reason: string;
    migrationManager: MigrationManager;
}>;
declare const _default: {
    MigrationManager: typeof MigrationManager;
    getMigrationManager: typeof getMigrationManager;
    migrationMiddleware: typeof migrationMiddleware;
};
export default _default;
//# sourceMappingURL=migration-manager.d.ts.map