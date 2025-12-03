/**
 * Canary Toggle System - Gradual Rollout Feature Flags
 * Provides per-route feature flags for safe, gradual feature rollout
 */
/**
 * Canary Toggle Manager
 * Manages feature flags for gradual rollout
 */
export class CanaryToggleManager {
    constructor(env) {
        this.cache = new Map();
        this.env = env;
    }
    /**
     * Check if a request should be in the canary group for a specific route
     */
    async isInCanary(request, route) {
        const requestId = this.getRequestId(request);
        const userId = await this.getUserId(request);
        const cacheKey = `${requestId}:${route}`;
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        // Get canary configuration for this route
        const config = await this.getCanaryConfig(route);
        const context = {
            requestId,
            userId,
            config,
            rolloutPercentage: config.percentage,
            isInCanary: false,
            reason: 'default_off'
        };
        // Check if canary is globally enabled
        if (!config.enabled) {
            context.reason = 'feature_disabled';
            this.cache.set(cacheKey, context);
            return context;
        }
        // Check whitelist (always in canary)
        if (this.isInWhitelist(userId, request, config.whitelist)) {
            context.isInCanary = true;
            context.reason = 'whitelisted';
            this.cache.set(cacheKey, context);
            return context;
        }
        // Check blacklist (never in canary)
        if (this.isInBlacklist(userId, request, config.blacklist)) {
            context.reason = 'blacklisted';
            this.cache.set(cacheKey, context);
            return context;
        }
        // Use consistent hashing for percentage-based rollout
        const hash = this.consistentHash(`${userId}:${route}`);
        if (hash < config.percentage) {
            context.isInCanary = true;
            context.reason = 'percentage_rollout';
        }
        else {
            context.reason = 'percentage_exclude';
        }
        // Cache the result
        this.cache.set(cacheKey, context);
        return context;
    }
    /**
     * Get canary configuration for a specific route
     */
    async getCanaryConfig(route) {
        try {
            // Try to get from KV first
            const configKey = `canary:${route}`;
            if (this.env.CACHE) {
                const cached = await this.env.CACHE.get(configKey, 'json');
                if (cached) {
                    return cached;
                }
            }
            // Default configuration if not found
            const defaultConfigs = {
                '/pre-market-briefing': {
                    enabled: false,
                    percentage: 0,
                    whitelist: [],
                    blacklist: [],
                    metadata: { description: 'Pre-market briefing HTML report' }
                },
                '/intraday-check': {
                    enabled: false,
                    percentage: 0,
                    whitelist: [],
                    blacklist: [],
                    metadata: { description: 'Intraday performance check HTML report' }
                },
                '/end-of-day-summary': {
                    enabled: false,
                    percentage: 0,
                    whitelist: [],
                    blacklist: [],
                    metadata: { description: 'End-of-day trading summary HTML report' }
                },
                '/weekly-review': {
                    enabled: false,
                    percentage: 0,
                    whitelist: [],
                    blacklist: [],
                    metadata: { description: 'Weekly trading review HTML report' }
                },
                '/daily-summary': {
                    enabled: false,
                    percentage: 0,
                    whitelist: [],
                    blacklist: [],
                    metadata: { description: 'Daily analysis summary HTML report' }
                },
                '/weekly-analysis': {
                    enabled: false,
                    percentage: 0,
                    whitelist: [],
                    blacklist: [],
                    metadata: { description: 'Weekly analysis dashboard HTML report' }
                }
            };
            const config = defaultConfigs[route] || {
                enabled: false,
                percentage: 0,
                whitelist: [],
                blacklist: []
            };
            // Cache the config
            if (this.env.CACHE) {
                await this.env.CACHE.put(configKey, JSON.stringify(config), {
                    expirationTtl: 300 // 5 minutes
                });
            }
            return config;
        }
        catch (error) {
            console.error('Error getting canary config:', error);
            // Fail-safe: return disabled config
            return {
                enabled: false,
                percentage: 0,
                whitelist: [],
                blacklist: []
            };
        }
    }
    /**
     * Update canary configuration for a route
     */
    async updateCanaryConfig(route, config) {
        try {
            const configKey = `canary:${route}`;
            // Validate config
            if (config.percentage < 0 || config.percentage > 100) {
                throw new Error('Canary percentage must be between 0 and 100');
            }
            // Store in KV
            if (this.env.CACHE) {
                await this.env.CACHE.put(configKey, JSON.stringify(config), {
                    expirationTtl: 3600 // 1 hour
                });
            }
            // Clear cache for this route
            for (const [key, value] of this.cache.entries()) {
                if (key.endsWith(`:${route}`)) {
                    this.cache.delete(key);
                }
            }
            console.log(`Updated canary config for ${route}:`, config);
        }
        catch (error) {
            console.error('Error updating canary config:', error);
            throw error;
        }
    }
    /**
     * Get user ID from request
     */
    async getUserId(request) {
        // Try different methods to identify the user
        // 1. API Key (if present)
        const apiKey = request.headers.get('X-API-Key');
        if (apiKey) {
            // Hash the API key for privacy
            return this.hashString(apiKey);
        }
        // 2. Client IP address
        const cf = request.cf;
        if (cf && cf.connecting_ip) {
            return `ip:${cf.connecting_ip}`;
        }
        // 3. User-Agent header (as fallback)
        const userAgent = request.headers.get('User-Agent');
        if (userAgent) {
            return this.hashString(userAgent);
        }
        // 4. Random ID (last resort)
        return this.hashString(this.getRequestId(request));
    }
    /**
     * Get request ID from headers or generate one
     */
    getRequestId(request) {
        return request.headers.get('X-Request-ID') || crypto.randomUUID();
    }
    /**
     * Check if user is in whitelist
     */
    isInWhitelist(userId, request, whitelist) {
        if (!userId || whitelist.length === 0) {
            return false;
        }
        // Direct match
        if (whitelist.includes(userId)) {
            return true;
        }
        // IP-based whitelist
        const cf = request.cf;
        if (cf && cf.connecting_ip && whitelist.includes(`ip:${cf.connecting_ip}`)) {
            return true;
        }
        // Pattern-based whitelist
        for (const pattern of whitelist) {
            if (pattern.includes('*') && this.matchPattern(userId, pattern)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Check if user is in blacklist
     */
    isInBlacklist(userId, request, blacklist) {
        if (!userId || blacklist.length === 0) {
            return false;
        }
        // Direct match
        if (blacklist.includes(userId)) {
            return true;
        }
        // IP-based blacklist
        const cf = request.cf;
        if (cf && cf.connecting_ip && blacklist.includes(`ip:${cf.connecting_ip}`)) {
            return true;
        }
        // Pattern-based blacklist
        for (const pattern of blacklist) {
            if (pattern.includes('*') && this.matchPattern(userId, pattern)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Simple string hashing for consistent hashing
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString();
    }
    /**
     * Consistent hash function (0-99)
     */
    consistentHash(key) {
        const hash = this.hashString(key);
        return hash % 100;
    }
    /**
     * Simple pattern matching (supports * wildcards)
     */
    matchPattern(str, pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(str);
    }
    /**
     * Get canary status for all routes
     */
    async getAllCanaryStatuses() {
        const routes = [
            '/pre-market-briefing',
            '/intraday-check',
            '/end-of-day-summary',
            '/weekly-review',
            '/daily-summary',
            '/weekly-analysis'
        ];
        const statuses = {};
        for (const route of routes) {
            statuses[route] = await this.getCanaryConfig(route);
        }
        return statuses;
    }
    /**
     * Enable canary for a route with specific percentage
     */
    async enableCanary(route, percentage = 10, options = {}) {
        const config = {
            enabled: true,
            percentage,
            whitelist: options.whitelist || [],
            blacklist: options.blacklist || [],
            metadata: {
                enabled_at: new Date().toISOString(),
                enabled_by: 'canary_toggle'
            }
        };
        await this.updateCanaryConfig(route, config);
    }
    /**
     * Disable canary for a route
     */
    async disableCanary(route) {
        const config = await this.getCanaryConfig(route);
        config.enabled = false;
        config.percentage = 0;
        config.metadata = {
            ...config.metadata,
            disabled_at: new Date().toISOString(),
            disabled_by: 'canary_toggle'
        };
        await this.updateCanaryConfig(route, config);
    }
    /**
     * Clear canary cache
     */
    clearCache() {
        this.cache.clear();
    }
}
/**
 * Create a canary-aware handler wrapper
 */
export function createCanaryHandler(canaryManager, route, canaryHandler, stableHandler) {
    return async (request, env, ctx) => {
        const canaryContext = await canaryManager.isInCanary(request, route);
        // Log canary decision for monitoring
        console.log(`Canary decision for ${route}:`, {
            requestId: canaryContext.requestId,
            userId: canaryContext.userId,
            isInCanary: canaryContext.isInCanary,
            reason: canaryContext.reason,
            percentage: canaryContext.rolloutPercentage
        });
        // Add canary headers to response
        const addCanaryHeaders = (response) => {
            response.headers.set('X-Canary-Status', canaryContext.isInCanary ? 'true' : 'false');
            response.headers.set('X-Canary-Route', route);
            response.headers.set('X-Canary-Reason', canaryContext.reason);
            response.headers.set('X-Canary-Percentage', canaryContext.rolloutPercentage.toString());
            return response;
        };
        try {
            if (canaryContext.isInCanary) {
                // Use canary handler
                const response = await canaryHandler(request, env, ctx, canaryContext);
                return addCanaryHeaders(response);
            }
            else {
                // Use stable handler
                const response = await stableHandler(request, env, ctx);
                return addCanaryHeaders(response);
            }
        }
        catch (error) {
            // On error, try fallback to stable handler if canary failed
            if (canaryContext.isInCanary) {
                console.error(`Canary handler failed for ${route}, falling back to stable:`, error);
                try {
                    const response = await stableHandler(request, env, ctx);
                    return addCanaryHeaders(response);
                }
                catch (fallbackError) {
                    console.error(`Both canary and stable handlers failed for ${route}:`, fallbackError);
                    throw fallbackError;
                }
            }
            else {
                throw error;
            }
        }
    };
}
//# sourceMappingURL=canary-toggle.js.map