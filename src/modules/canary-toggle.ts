/**
 * Canary Toggle System - Gradual Rollout Feature Flags
 * Provides per-route feature flags for safe, gradual feature rollout
 */

import { createCache } from './cache-abstraction.js';
import type { CloudflareEnvironment } from '../types.js';

export interface CanaryConfig {
  enabled: boolean;
  percentage: number;  // 0-100, percentage of traffic to canary
  whitelist: string[];  // User IDs, IPs, or request patterns always in canary
  blacklist: string[];  // User IDs, IPs, or request patterns never in canary
  metadata?: Record<string, any>;
}

export interface CanaryContext {
  isInCanary: boolean;
  config: CanaryConfig;
  rolloutPercentage: number;
  userId?: string;
  requestId: string;
  reason?: string;  // Why this request is/isn't in canary
}

export interface RouteCanaryConfig {
  [route: string]: CanaryConfig;
}

/**
 * Canary Toggle Manager
 * Manages feature flags for gradual rollout
 */
export class CanaryToggleManager {
  private env: CloudflareEnvironment;

  constructor(env: CloudflareEnvironment) {
    this.env = env;
  }

  /**
   * Check if a request should be in the canary group for a specific route
   */
  async isInCanary(request: Request, route: string): Promise<CanaryContext> {
    const requestId = this.getRequestId(request);
    const userId = await this.getUserId(request);
    const cacheKey = `canary_ctx:${requestId}:${route}`;
    const doCache = createCache(this.env);

    // Check DO cache first
    const cached = await doCache.get(cacheKey);
    if (cached) {
      return cached as CanaryContext;
    }

    // Get canary configuration for this route
    const config = await this.getCanaryConfig(route);
    const context: CanaryContext = {
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
      await doCache.put(cacheKey, context, { expirationTtl: 60 });
      return context;
    }

    // Check whitelist (always in canary)
    if (this.isInWhitelist(userId, request, config.whitelist)) {
      context.isInCanary = true;
      context.reason = 'whitelisted';
      await doCache.put(cacheKey, context, { expirationTtl: 60 });
      return context;
    }

    // Check blacklist (never in canary)
    if (this.isInBlacklist(userId, request, config.blacklist)) {
      context.reason = 'blacklisted';
      await doCache.put(cacheKey, context, { expirationTtl: 60 });
      return context;
    }

    // Use consistent hashing for percentage-based rollout
    const hash = this.consistentHash(`${userId}:${route}`);
    if (hash < config.percentage) {
      context.isInCanary = true;
      context.reason = 'percentage_rollout';
    } else {
      context.reason = 'percentage_exclude';
    }

    // Cache the result
    await doCache.put(cacheKey, context, { expirationTtl: 60 });
    return context;
  }

  /**
   * Get canary configuration for a specific route
   */
  async getCanaryConfig(route: string): Promise<CanaryConfig> {
    try {
      // Try to get from cache first
      const configKey = `canary:${route}`;
      const doCache = createCache(this.env);
      const cached = await doCache.get(configKey);
      if (cached) {
        return cached as CanaryConfig;
      }

      // Default configuration if not found
      const defaultConfigs: Record<string, CanaryConfig> = {
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
      await doCache.put(configKey, config, { expirationTtl: 300 });

      return config;

    } catch (error) {
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
  async updateCanaryConfig(route: string, config: CanaryConfig): Promise<void> {
    try {
      const configKey = `canary:${route}`;

      // Validate config
      if (config.percentage < 0 || config.percentage > 100) {
        throw new Error('Canary percentage must be between 0 and 100');
      }

      // Store in cache
      const doCache = createCache(this.env);
      await doCache.put(configKey, config, { expirationTtl: 3600 });

      // Note: Context cache entries will expire naturally (60s TTL)

      console.log(`Updated canary config for ${route}:`, config);

    } catch (error) {
      console.error('Error updating canary config:', error);
      throw error;
    }
  }

  /**
   * Get user ID from request
   */
  private async getUserId(request: Request): Promise<string> {
    // Try different methods to identify the user

    // 1. API Key (if present)
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey) {
      // Hash the API key for privacy
      return String(this.hashString(apiKey));
    }

    // 2. Client IP address
    const cf = (request as any).cf;
    if (cf && cf.connecting_ip) {
      return `ip:${cf.connecting_ip}`;
    }

    // 3. User-Agent header (as fallback)
    const userAgent = request.headers.get('User-Agent');
    if (userAgent) {
      return String(this.hashString(userAgent));
    }

    // 4. Random ID (last resort)
    return String(this.hashString(this.getRequestId(request)));
  }

  /**
   * Get request ID from headers or generate one
   */
  private getRequestId(request: Request): string {
    return request.headers.get('X-Request-ID') || crypto.randomUUID();
  }

  /**
   * Check if user is in whitelist
   */
  private isInWhitelist(userId: string | undefined, request: Request, whitelist: string[]): boolean {
    if (!userId || whitelist.length === 0) {
      return false;
    }

    // Direct match
    if (whitelist.includes(userId)) {
      return true;
    }

    // IP-based whitelist
    const cf = (request as any).cf;
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
  private isInBlacklist(userId: string | undefined, request: Request, blacklist: string[]): boolean {
    if (!userId || blacklist.length === 0) {
      return false;
    }

    // Direct match
    if (blacklist.includes(userId)) {
      return true;
    }

    // IP-based blacklist
    const cf = (request as any).cf;
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
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Consistent hash function (0-99)
   */
  private consistentHash(key: string): number {
    const hash = this.hashString(key);
    return hash % 100;
  }

  /**
   * Simple pattern matching (supports * wildcards)
   */
  private matchPattern(str: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(str);
  }

  /**
   * Get canary status for all routes
   */
  async getAllCanaryStatuses(): Promise<Record<string, CanaryConfig>> {
    const routes = [
      '/pre-market-briefing',
      '/intraday-check',
      '/end-of-day-summary',
      '/weekly-review',
      '/daily-summary',
      '/weekly-analysis'
    ];

    const statuses: Record<string, CanaryConfig> = {};

    for (const route of routes) {
      statuses[route] = await this.getCanaryConfig(route);
    }

    return statuses;
  }

  /**
   * Enable canary for a route with specific percentage
   */
  async enableCanary(route: string, percentage: number = 10, options: {
    whitelist?: string[];
    blacklist?: string[];
  } = {}): Promise<void> {
    const config: CanaryConfig = {
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
  async disableCanary(route: string): Promise<void> {
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
   * Clear canary cache (no-op, DO cache entries expire via TTL)
   */
  clearCache(): void {
    // DO cache entries expire naturally via TTL
  }
}

/**
 * Create a canary-aware handler wrapper
 */
export function createCanaryHandler(
  canaryManager: CanaryToggleManager,
  route: string,
  canaryHandler: (request: Request, env: CloudflareEnvironment, ctx: any, canaryContext: CanaryContext) => Promise<Response>,
  stableHandler: (request: Request, env: CloudflareEnvironment, ctx: any) => Promise<Response>
) {
  return async (request: Request, env: CloudflareEnvironment, ctx: any): Promise<Response> => {
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
    const addCanaryHeaders = (response: Response): Response => {
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
      } else {
        // Use stable handler
        const response = await stableHandler(request, env, ctx);
        return addCanaryHeaders(response);
      }
    } catch (error) {
      // On error, try fallback to stable handler if canary failed
      if (canaryContext.isInCanary) {
        console.error(`Canary handler failed for ${route}, falling back to stable:`, error);
        try {
          const response = await stableHandler(request, env, ctx);
          return addCanaryHeaders(response);
        } catch (fallbackError) {
          console.error(`Both canary and stable handlers failed for ${route}:`, fallbackError);
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }
  };
}