/**
 * Router Storage Adapter
 *
 * Routes storage operations to appropriate adapters based on key patterns and storage classes.
 * Supports dual-mode operations for migration scenarios.
 *
 * @version 2.0.0 - Storage Architecture Modernization
 * @since 2025-11-28
 */
import { createLogger } from './logging.js';
const logger = createLogger('router-storage-adapter');
// ============================================================================
// Router Storage Adapter
// ============================================================================
export class RouterStorageAdapter {
    constructor(config) {
        this.name = 'RouterStorageAdapter';
        this.storageClass = 'hot_cache'; // Default, overridden per operation
        this.enabled = true;
        this.stats = {
            totalOperations: 0,
            routerHits: 0,
            routerMisses: 0,
            classStats: {}
        };
        this.config = config;
        // Initialize class stats
        const classes = ['hot_cache', 'warm_cache', 'cold_storage', 'ephemeral'];
        classes.forEach(cls => {
            this.stats.classStats[cls] = { hits: 0, errors: 0 };
        });
    }
    /**
     * Set storage guards for KV operation enforcement
     */
    setStorageGuards(storageGuards) {
        this.storageGuards = storageGuards;
    }
    /**
     * Set metrics collector for instrumentation
     */
    setMetricsCollector(metricsCollector) {
        this.metricsCollector = metricsCollector;
        // Inject metrics collector into all adapters
        if (this.config.adapters.hot) {
            this.config.adapters.hot.setMetricsCollector(metricsCollector);
        }
        if (this.config.adapters.warm) {
            this.config.adapters.warm.setMetricsCollector(metricsCollector);
        }
        if (this.config.adapters.cold) {
            this.config.adapters.cold.setMetricsCollector(metricsCollector);
        }
        if (this.config.adapters.ephemeral) {
            this.config.adapters.ephemeral.setMetricsCollector(metricsCollector);
        }
    }
    // ============================================================================
    // Core Storage Operations
    // ============================================================================
    async get(key) {
        this.stats.totalOperations++;
        try {
            const route = this.resolveRoute(key);
            if (!route.adapter) {
                this.stats.routerMisses++;
                return {
                    success: false,
                    error: `No adapter configured for storage class: ${route.storageClass}`
                };
            }
            this.stats.routerHits++;
            this.stats.classStats[route.storageClass].hits++;
            // Check storage guards before KV operations
            if (this.storageGuards && route.adapter.name.includes('KV')) {
                const guardResult = await this.storageGuards.checkKvOperation('get', key, route.storageClass);
                if (!guardResult.allowed) {
                    logger.warn('Storage guard blocked KV operation', {
                        key,
                        storageClass: route.storageClass,
                        operation: 'get',
                        action: guardResult.action,
                        reason: guardResult.reason
                    });
                    this.stats.classStats[route.storageClass].errors++;
                    return {
                        success: false,
                        error: `Storage guard: ${guardResult.reason || 'KV operation not allowed'}`,
                        metadata: {
                            timestamp: new Date().toISOString(),
                            storageClass: route.storageClass,
                            backend: 'blocked_by_guard'
                        }
                    };
                }
            }
            const startTime = Date.now();
            const result = await route.adapter.get(key);
            const latency = Date.now() - startTime;
            // Add routing metadata
            if (result.metadata) {
                result.metadata.storageClass = route.storageClass;
                result.metadata.backend = route.adapter.name;
            }
            // Check storage guards for latency violations
            if (this.storageGuards && route.adapter.name.includes('KV')) {
                const guardResult = await this.storageGuards.checkKvOperation('get', key, route.storageClass, {
                    latencyMs: latency,
                    caller: 'RouterStorageAdapter'
                });
                if (!guardResult.allowed && guardResult.action === 'error') {
                    this.stats.classStats[route.storageClass].errors++;
                    return {
                        success: false,
                        error: `Storage guard: ${guardResult.reason || 'KV latency exceeded threshold'}`,
                        metadata: {
                            timestamp: new Date().toISOString(),
                            storageClass: route.storageClass,
                            backend: 'blocked_by_guard'
                        }
                    };
                }
            }
            logger.debug('Router GET operation', {
                key,
                storageClass: route.storageClass,
                adapter: route.adapter.name,
                success: result.success,
                latency
            });
            return result;
        }
        catch (error) {
            const route = this.resolveRoute(key);
            this.stats.classStats[route.storageClass].errors++;
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                metadata: {
                    timestamp: new Date().toISOString(),
                    storageClass: route.storageClass,
                    backend: 'router'
                }
            };
        }
    }
    async put(key, value, options) {
        this.stats.totalOperations++;
        try {
            const route = this.resolveRoute(key);
            if (!route.adapter) {
                this.stats.routerMisses++;
                return {
                    success: false,
                    error: `No adapter configured for storage class: ${route.storageClass}`
                };
            }
            this.stats.routerHits++;
            this.stats.classStats[route.storageClass].hits++;
            // Check storage guards before KV operations
            if (this.storageGuards && route.adapter.name.includes('KV')) {
                const guardResult = await this.storageGuards.checkKvOperation('put', key, route.storageClass);
                if (!guardResult.allowed) {
                    logger.warn('Storage guard blocked KV operation', {
                        key,
                        storageClass: route.storageClass,
                        operation: 'put',
                        action: guardResult.action,
                        reason: guardResult.reason
                    });
                    this.stats.classStats[route.storageClass].errors++;
                    return {
                        success: false,
                        error: `Storage guard: ${guardResult.reason || 'KV operation not allowed'}`,
                        metadata: {
                            timestamp: new Date().toISOString(),
                            storageClass: route.storageClass,
                            backend: 'blocked_by_guard'
                        }
                    };
                }
            }
            // Handle dual-mode operations
            if (this.isDualMode(route.storageClass)) {
                return await this.dualPut(route, key, value, options);
            }
            const result = await route.adapter.put(key, value, options);
            // Add routing metadata
            if (result.metadata) {
                result.metadata.storageClass = route.storageClass;
                result.metadata.backend = route.adapter.name;
            }
            logger.debug('Router PUT operation', {
                key,
                storageClass: route.storageClass,
                adapter: route.adapter.name,
                dualMode: this.isDualMode(route.storageClass),
                success: result.success
            });
            return result;
        }
        catch (error) {
            const route = this.resolveRoute(key);
            this.stats.classStats[route.storageClass].errors++;
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                metadata: {
                    timestamp: new Date().toISOString(),
                    storageClass: route.storageClass,
                    backend: 'router'
                }
            };
        }
    }
    async delete(key) {
        this.stats.totalOperations++;
        try {
            const route = this.resolveRoute(key);
            if (!route.adapter) {
                this.stats.routerMisses++;
                return {
                    success: false,
                    error: `No adapter configured for storage class: ${route.storageClass}`
                };
            }
            this.stats.routerHits++;
            this.stats.classStats[route.storageClass].hits++;
            // Check storage guards before KV operations
            if (this.storageGuards && route.adapter.name.includes('KV')) {
                const guardResult = await this.storageGuards.checkKvOperation('delete', key, route.storageClass);
                if (!guardResult.allowed) {
                    logger.warn('Storage guard blocked KV operation', {
                        key,
                        storageClass: route.storageClass,
                        operation: 'delete',
                        action: guardResult.action,
                        reason: guardResult.reason
                    });
                    this.stats.classStats[route.storageClass].errors++;
                    return {
                        success: false,
                        error: `Storage guard: ${guardResult.reason || 'KV operation not allowed'}`,
                        metadata: {
                            timestamp: new Date().toISOString(),
                            storageClass: route.storageClass,
                            backend: 'blocked_by_guard'
                        }
                    };
                }
            }
            // Handle dual-mode operations
            if (this.isDualMode(route.storageClass)) {
                return await this.dualDelete(route, key);
            }
            const result = await route.adapter.delete(key);
            // Add routing metadata
            if (result.metadata) {
                result.metadata.storageClass = route.storageClass;
                result.metadata.backend = route.adapter.name;
            }
            logger.debug('Router DELETE operation', {
                key,
                storageClass: route.storageClass,
                adapter: route.adapter.name,
                dualMode: this.isDualMode(route.storageClass),
                success: result.success
            });
            return result;
        }
        catch (error) {
            this.stats.classStats[this.storageClass].errors++;
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                metadata: {
                    timestamp: new Date().toISOString(),
                    storageClass: this.storageClass,
                    backend: 'router'
                }
            };
        }
    }
    async list(options) {
        this.stats.totalOperations++;
        try {
            // For list operations, we need to query all relevant adapters
            const keys = [];
            const errors = [];
            for (const adapter of this.getActiveAdapters()) {
                try {
                    const result = await adapter.list(options);
                    if (result.success && result.data) {
                        keys.push(...result.data);
                    }
                    else if (result.error) {
                        errors.push(`${adapter.name}: ${result.error}`);
                    }
                }
                catch (error) {
                    errors.push(`${adapter.name}: ${error}`);
                }
            }
            // Remove duplicates and sort
            const uniqueKeys = Array.from(new Set(keys)).sort();
            logger.debug('Router LIST operation', {
                options,
                totalKeys: uniqueKeys.length,
                errors: errors.length
            });
            return {
                success: true,
                data: uniqueKeys,
                metadata: {
                    timestamp: new Date().toISOString(),
                    storageClass: this.storageClass,
                    backend: 'router',
                    adapterErrors: errors.length > 0 ? errors : undefined
                }
            };
        }
        catch (error) {
            this.stats.classStats[this.storageClass].errors++;
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    // ============================================================================
    // Router-Specific Methods
    // ============================================================================
    resolveRoute(key) {
        // Find matching pattern
        const pattern = this.config.keyPatterns.find(p => p.regex.test(key));
        if (!pattern) {
            logger.warn('No pattern match for key', { key });
            return {
                adapter: undefined,
                storageClass: 'hot_cache',
                pattern: { pattern: 'default', regex: /.*/, storageClass: 'hot_cache' }
            };
        }
        // Handle analysis_* recency split
        let storageClass = pattern.storageClass;
        if (key.startsWith('analysis_') && pattern.storageClass === 'hot_cache') {
            storageClass = this.isRecentAnalysis(key) ? 'hot_cache' : 'warm_cache';
        }
        // Get adapter for storage class
        const adapter = this.getAdapter(storageClass);
        return { adapter, storageClass, pattern };
    }
    isRecentAnalysis(key) {
        // Extract date from key like "analysis_2025-11-28"
        const dateMatch = key.match(/analysis_(\d{4}-\d{2}-\d{2})/);
        if (!dateMatch)
            return false;
        const analysisDate = new Date(dateMatch[1]);
        const threshold = new Date();
        threshold.setHours(threshold.getHours() - this.config.recencyThreshold);
        return analysisDate > threshold;
    }
    getAdapter(storageClass) {
        switch (storageClass) {
            case 'hot_cache':
                return this.config.adapters.hot;
            case 'warm_cache':
                return this.config.adapters.warm;
            case 'cold_storage':
                return this.config.adapters.cold;
            case 'ephemeral':
                return this.config.adapters.ephemeral;
            default:
                return this.config.adapters.fallback;
        }
    }
    isDualMode(storageClass) {
        switch (storageClass) {
            case 'hot_cache':
                return this.config.modes.hot_cache === 'dual';
            case 'warm_cache':
                return this.config.modes.warm_cache === 'dual';
            default:
                return false;
        }
    }
    async dualPut(route, key, value, options) {
        const primaryResult = await route.adapter.put(key, value, options);
        if (!primaryResult.success || !this.config.adapters.fallback) {
            return primaryResult;
        }
        try {
            // Write to fallback (legacy KV)
            await this.config.adapters.fallback.put(key, value, options);
            return {
                ...primaryResult,
                metadata: {
                    ...primaryResult.metadata,
                    dualMode: true,
                    fallbackWrite: true
                }
            };
        }
        catch (fallbackError) {
            logger.warn('Fallback write failed in dual mode', {
                key,
                error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
            });
            return primaryResult; // Return primary result even if fallback fails
        }
    }
    async dualDelete(route, key) {
        const primaryResult = await route.adapter.delete(key);
        if (!primaryResult.success || !this.config.adapters.fallback) {
            return primaryResult;
        }
        try {
            // Delete from fallback (legacy KV)
            await this.config.adapters.fallback.delete(key);
            return {
                ...primaryResult,
                metadata: {
                    ...primaryResult.metadata,
                    dualMode: true,
                    fallbackDelete: true
                }
            };
        }
        catch (fallbackError) {
            logger.warn('Fallback delete failed in dual mode', {
                key,
                error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
            });
            return primaryResult; // Return primary result even if fallback fails
        }
    }
    getActiveAdapters() {
        const adapters = [];
        if (this.config.adapters.hot && this.config.modes.hot_cache !== 'disabled') {
            adapters.push(this.config.adapters.hot);
        }
        if (this.config.adapters.warm && this.config.modes.warm_cache !== 'disabled') {
            adapters.push(this.config.adapters.warm);
        }
        if (this.config.adapters.cold && this.config.modes.cold_storage !== 'disabled') {
            adapters.push(this.config.adapters.cold);
        }
        if (this.config.adapters.ephemeral && this.config.modes.ephemeral !== 'disabled') {
            adapters.push(this.config.adapters.ephemeral);
        }
        if (this.config.adapters.fallback) {
            adapters.push(this.config.adapters.fallback);
        }
        return adapters;
    }
    // ============================================================================
    // Lifecycle Management: DO ↔ D1 Promotion/Demotion
    // ============================================================================
    /**
     * Promote data from DO to D1 cold storage
     * Used when hot cache data ages out or needs long-term persistence
     */
    async promoteToDo(key, targetStorageClass = 'cold_storage') {
        const start = Date.now();
        try {
            // Get current data from DO (hot cache)
            const currentRoute = this.routeRequest(key);
            if (currentRoute.storageClass !== 'hot_cache') {
                return {
                    success: false,
                    error: `Can only promote from hot_cache, current class: ${currentRoute.storageClass}`,
                    latency: Date.now() - start
                };
            }
            const getResult = await currentRoute.adapter.get(key);
            if (!getResult.success || !getResult.data) {
                return {
                    success: false,
                    error: 'Source data not found in hot cache',
                    latency: Date.now() - start
                };
            }
            // Route to target storage
            const targetAdapter = targetStorageClass === 'cold_storage'
                ? this.config.adapters.cold
                : this.config.adapters.warm;
            if (!targetAdapter) {
                return {
                    success: false,
                    error: `Target adapter for ${targetStorageClass} not configured`,
                    latency: Date.now() - start
                };
            }
            // Store in target storage with appropriate TTL
            const ttl = targetStorageClass === 'cold_storage' ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // 30d cold, 7d warm
            const putResult = await targetAdapter.put(key, getResult.data, { ttl });
            // If promotion successful, optionally remove from hot cache
            if (putResult.success) {
                logger.info('Data promoted from hot cache', {
                    key,
                    from: 'hot_cache',
                    to: targetStorageClass,
                    ttl
                });
                // Record promotion metrics
                this.recordLifecycleMetrics('promotion', key, 'hot_cache', targetStorageClass, true, Date.now() - start);
                return {
                    success: true,
                    data: getResult.data,
                    latency: Date.now() - start,
                    metadata: {
                        promoted: true,
                        fromClass: 'hot_cache',
                        toClass: targetStorageClass,
                        originalSize: getResult.metadata?.size || 0
                    }
                };
            }
            return putResult;
        }
        catch (error) {
            const latency = Date.now() - start;
            this.recordLifecycleMetrics('promotion', key, 'hot_cache', targetStorageClass, false, latency);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                latency
            };
        }
    }
    /**
     * Demote data from D1 back to DO hot cache
     * Used when cold data is accessed frequently enough to warrant hot caching
     */
    async demoteToDo(key, sourceStorageClass = 'cold_storage') {
        const start = Date.now();
        try {
            // Get current data from cold/warm storage
            const sourceAdapter = sourceStorageClass === 'cold_storage'
                ? this.config.adapters.cold
                : this.config.adapters.warm;
            if (!sourceAdapter) {
                return {
                    success: false,
                    error: `Source adapter for ${sourceStorageClass} not configured`,
                    latency: Date.now() - start
                };
            }
            const getResult = await sourceAdapter.get(key);
            if (!getResult.success || !getResult.data) {
                return {
                    success: false,
                    error: `Source data not found in ${sourceStorageClass}`,
                    latency: Date.now() - start
                };
            }
            // Route to hot cache (DO)
            const hotAdapter = this.config.adapters.hot;
            if (!hotAdapter) {
                return {
                    success: false,
                    error: 'Hot cache adapter not configured',
                    latency: Date.now() - start
                };
            }
            // Store in hot cache with shorter TTL
            const putResult = await hotAdapter.put(key, getResult.data, { ttl: 4 * 60 * 60 }); // 4 hours
            // If demotion successful, optionally remove from cold storage if it was temporary
            if (putResult.success) {
                logger.info('Data demoted to hot cache', {
                    key,
                    from: sourceStorageClass,
                    to: 'hot_cache',
                    ttl: 4 * 60 * 60
                });
                // Record demotion metrics
                this.recordLifecycleMetrics('demotion', key, sourceStorageClass, 'hot_cache', true, Date.now() - start);
                return {
                    success: true,
                    data: getResult.data,
                    latency: Date.now() - start,
                    metadata: {
                        demoted: true,
                        fromClass: sourceStorageClass,
                        toClass: 'hot_cache',
                        originalSize: getResult.metadata?.size || 0
                    }
                };
            }
            return putResult;
        }
        catch (error) {
            const latency = Date.now() - start;
            this.recordLifecycleMetrics('demotion', key, sourceStorageClass, 'hot_cache', false, latency);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                latency
            };
        }
    }
    /**
     * Batch promote multiple keys from hot to cold storage
     * Optimized for bulk operations during cache maintenance
     */
    async batchPromote(keys, targetStorageClass = 'cold_storage') {
        const results = [];
        let successful = 0;
        let failed = 0;
        logger.info('Starting batch promotion', {
            keyCount: keys.length,
            targetStorageClass
        });
        // Process in parallel with reasonable concurrency limit
        const concurrencyLimit = 10;
        for (let i = 0; i < keys.length; i += concurrencyLimit) {
            const batch = keys.slice(i, i + concurrencyLimit);
            const batchPromises = batch.map(key => this.promoteToDo(key, targetStorageClass));
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(result => {
                results.push(result);
                if (result.success) {
                    successful++;
                }
                else {
                    failed++;
                }
            });
        }
        const summary = { successful, failed };
        logger.info('Batch promotion completed', summary);
        return { results, summary };
    }
    /**
     * Get lifecycle statistics for monitoring and optimization
     */
    getLifecycleStats() {
        // Return stats from metrics collector if available
        if (this.metricsCollector) {
            try {
                const promotionStats = this.metricsCollector.getStatsByOperation('lifecycle_promotion') || {};
                const demotionStats = this.metricsCollector.getStatsByOperation('lifecycle_demotion') || {};
                return {
                    promotions: {
                        total: (promotionStats.total || 0),
                        successful: (promotionStats.successful || 0),
                        failed: (promotionStats.failed || 0),
                        avgLatency: (promotionStats.avgLatency || 0)
                    },
                    demotions: {
                        total: (demotionStats.total || 0),
                        successful: (demotionStats.successful || 0),
                        failed: (demotionStats.failed || 0),
                        avgLatency: (demotionStats.avgLatency || 0)
                    },
                    byStorageClass: this.metricsCollector.getStatsByStorageClass?.() || {}
                };
            }
            catch (error) {
                logger.warn('Failed to get lifecycle stats from metrics collector', { error });
            }
        }
        // Fallback empty stats
        return {
            promotions: { total: 0, successful: 0, failed: 0, avgLatency: 0 },
            demotions: { total: 0, successful: 0, failed: 0, avgLatency: 0 },
            byStorageClass: {}
        };
    }
    /**
     * Record lifecycle operation metrics
     */
    recordLifecycleMetrics(operation, key, fromClass, toClass, success, latency) {
        if (!this.metricsCollector) {
            return;
        }
        try {
            const keyspace = this.extractKeyspaceFromKey(key);
            this.metricsCollector.recordOperation(`lifecycle_${operation}`, {
                system: 'CCT',
                layer: 'edge',
                storage_class: toClass,
                keyspace,
                op: 'lifecycle',
                result: success ? 'success' : 'error'
            }, latency, success);
            // Set custom lifecycle metrics
            this.metricsCollector.setGauge(`lifecycle_${operation}_total`, {
                system: 'CCT',
                layer: 'edge',
                storage_class: 'all',
                keyspace
            }, 1);
            this.metricsCollector.setGauge(`lifecycle_${operation}_latency`, {
                system: 'CCT',
                layer: 'edge',
                storage_class: toClass,
                keyspace,
                from_class: fromClass,
                to_class: toClass
            }, latency);
        }
        catch (error) {
            logger.warn('Failed to record lifecycle metrics', {
                operation,
                key,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    /**
     * Extract keyspace from key for metrics (reuse existing logic)
     */
    extractKeyspaceFromKey(key) {
        const parts = key.split('_');
        if (parts.length >= 2) {
            return parts.slice(0, 2).join('_');
        }
        else if (parts.length === 1) {
            return parts[0];
        }
        else {
            return 'unknown';
        }
    }
    // ============================================================================
    // Health and Stats
    // ============================================================================
    async getStats() {
        const adapterStats = new Map();
        for (const adapter of this.getActiveAdapters()) {
            try {
                adapterStats.set(adapter.name, await adapter.getStats());
            }
            catch (error) {
                adapterStats.set(adapter.name, { error: error instanceof Error ? error.message : String(error) });
            }
        }
        return {
            router: {
                totalOperations: this.stats.totalOperations,
                routerHits: this.stats.routerHits,
                routerMisses: this.stats.routerMisses,
                hitRate: this.stats.totalOperations > 0 ? this.stats.routerHits / this.stats.totalOperations : 0
            },
            classStats: this.stats.classStats,
            modes: this.config.modes,
            adapters: Object.fromEntries(adapterStats)
        };
    }
    async healthCheck() {
        const issues = [];
        // Check router configuration
        if (this.config.keyPatterns.length === 0) {
            issues.push('No routing patterns configured');
        }
        // Check each active adapter
        for (const adapter of this.getActiveAdapters()) {
            try {
                const health = await adapter.healthCheck();
                if (!health.healthy) {
                    issues.push(`Adapter ${adapter.name}: ${health.issues.join(', ')}`);
                }
            }
            catch (error) {
                issues.push(`Adapter ${adapter.name} health check failed: ${error}`);
            }
        }
        return {
            healthy: issues.length === 0,
            issues
        };
    }
    async close() {
        const closePromises = this.getActiveAdapters().map(adapter => adapter.close().catch(error => logger.warn('Error closing adapter', { adapter: adapter.name, error })));
        await Promise.all(closePromises);
        logger.debug('RouterStorageAdapter closed');
    }
}
// ============================================================================
// Default Configuration Factory
// ============================================================================
export function createDefaultRouterConfig(env) {
    return {
        modes: {
            hot_cache: 'disabled', // Disabled by default for safety
            warm_cache: 'disabled',
            cold_storage: 'disabled',
            ephemeral: 'disabled'
        },
        keyPatterns: [
            { pattern: '^analysis_.*', regex: /^analysis_/, storageClass: 'hot_cache' },
            { pattern: '^dual_ai_analysis_.*', regex: /^dual_ai_analysis_/, storageClass: 'hot_cache' },
            { pattern: '^market_cache_.*', regex: /^market_cache_/, storageClass: 'hot_cache' },
            { pattern: '^report_cache_.*', regex: /^report_cache_/, storageClass: 'hot_cache' },
            { pattern: '^job_.*_status_.*', regex: /^job_.*_status_/, storageClass: 'ephemeral' },
            { pattern: '^daily_summary_.*', regex: /^daily_summary_/, storageClass: 'cold_storage' },
            { pattern: '^facebook_.*', regex: /^facebook_/, storageClass: 'cold_storage' },
            { pattern: '.*', regex: /.*/, storageClass: 'hot_cache' } // Default
        ],
        recencyThreshold: 24, // 24 hours for analysis hot/warm split
        adapters: {
        // Adapters will be configured based on environment bindings
        }
    };
}
//# sourceMappingURL=router-storage-adapter.js.map