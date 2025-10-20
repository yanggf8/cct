/**
 * Enhanced Cache API Routes
 * Provides 6 endpoints for testing and monitoring enhanced cache features
 * (Load testing removed - dual cache functionality covered by integration tests)
 */

import { createLogger } from '../modules/logging.js';
import { createCacheManager } from '../modules/cache-manager.js';

const logger = createLogger('enhanced-cache-routes');

/**
 * Create enhanced cache routes
 */
export function createEnhancedCacheRoutes(env: any) {
  const cacheManager = createCacheManager(env, {
    enabled: true,
    enablePromotion: true,
    enableMetrics: true,
  });

  const routes = [
    {
      path: '/cache-health',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const healthAssessment = await cacheManager.performHealthAssessment();

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            assessment: healthAssessment,
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error) {
          logger.error('Cache health assessment failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Health assessment failed',
            timestamp: new Date().toISOString(),
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/cache-config',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const configSummary = cacheManager.getConfigurationSummary();
          const allConfigs = cacheManager.getAllEnhancedConfigs();

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            environment: configSummary.environment,
            summary: configSummary,
            configurations: allConfigs,
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=300', // 5 minutes
            },
          });
        } catch (error) {
          logger.error('Cache config retrieval failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Configuration retrieval failed',
            timestamp: new Date().toISOString(),
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/cache-metrics',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const stats = cacheManager.getStats();
          const l1Stats = cacheManager.getL1Stats();
          const promotionStats = cacheManager.getPromotionStats();
          const trends = cacheManager.getPerformanceTrends();

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            cacheStats: stats,
            l1Stats: l1Stats,
            promotionStats: promotionStats,
            trends: trends,
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error) {
          logger.error('Cache metrics retrieval failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Metrics retrieval failed',
            timestamp: new Date().toISOString(),
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/cache-promotion',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const promotionStats = cacheManager.getPromotionStats();
          const accessPatterns = cacheManager.getAccessPatterns();

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            enabled: cacheManager.isPromotionEnabled(),
            stats: promotionStats,
            accessPatterns: accessPatterns.slice(0, 10), // Top 10 patterns
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error) {
          logger.error('Cache promotion data retrieval failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Promotion data retrieval failed',
            timestamp: new Date().toISOString(),
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/cache-system-status',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const systemStatus = await cacheManager.getSystemStatus();

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            system: systemStatus,
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error) {
          logger.error('System status retrieval failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'System status retrieval failed',
            timestamp: new Date().toISOString(),
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/cache-warmup',
      method: 'POST',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          // Simulate cache warmup with some test data
          const testDatasets = [
            { namespace: 'sentiment_analysis', key: 'warmup_test', data: { sentiment: 'bullish', confidence: 0.8 } },
            { namespace: 'market_data', key: 'AAPL_warmup', data: { price: 150.0, volume: 1000000 } },
            { namespace: 'ai_results', key: 'model_warmup', data: { prediction: 'uptrend', confidence: 0.9 } },
          ];

          const results = [];
          for (const dataset of testDatasets) {
            await cacheManager.set(dataset.namespace, dataset.key, dataset.data);
            const retrieved = await cacheManager.get(dataset.namespace, dataset.key);
            results.push({
              namespace: dataset.namespace,
              key: dataset.key,
              success: retrieved !== null,
            });
          }

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            message: 'Cache warmup completed',
            results: results,
            cacheStats: cacheManager.getStats(),
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error) {
          logger.error('Cache warmup failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Cache warmup failed',
            timestamp: new Date().toISOString(),
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    ];

  return routes;
}

export default createEnhancedCacheRoutes;