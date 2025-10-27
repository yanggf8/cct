/**
 * Enhanced Cache API Routes
 * Provides 6 endpoints for testing and monitoring enhanced cache features
 * (Load testing removed - dual cache functionality covered by integration tests)
 */

import { createLogger } from '../modules/logging.js';
import { createCacheManager } from '../modules/cache-manager.js';
import { EnhancedCacheFactory } from '../modules/enhanced-cache-factory.js';

const logger = createLogger('enhanced-cache-routes');

/**
 * Cache warmup data generators
 * These functions create realistic test data for different cache namespaces
 */

function generateMarketDataWarmup(symbols: string[]): Array<{namespace: string, key: string, data: any, ttl?: number}> {
  return symbols.map(symbol => ({
    namespace: 'market_data',
    key: `${symbol}_quote`,
    data: {
      symbol,
      price: 100 + Math.random() * 200,
      volume: Math.floor(Math.random() * 10000000),
      change: (Math.random() - 0.5) * 10,
      changePercent: (Math.random() - 0.5) * 5,
      timestamp: new Date().toISOString(),
      marketCap: Math.floor(Math.random() * 1000000000000),
      pe: Math.random() * 30 + 5
    },
    ttl: 300 // 5 minutes for market data
  }));
}

function generateSentimentAnalysisWarmup(symbols: string[]): Array<{namespace: string, key: string, data: any}> {
  return symbols.map(symbol => ({
    namespace: 'sentiment_analysis',
    key: `${symbol}_sentiment`,
    data: {
      symbol,
      sentiment: Math.random() > 0.5 ? 'bullish' : 'bearish',
      confidence: Math.random() * 0.4 + 0.6, // 0.6-1.0
      score: (Math.random() - 0.5) * 2,
      analysisDate: new Date().toISOString(),
      sources: ['news', 'social', 'technical'],
      modelVersion: 'enhanced-v2'
    }
  }));
}

function generateBasicSentimentWarmup(symbols: string[]): Array<{namespace: string, key: string, data: any}> {
  return symbols.map(symbol => ({
    namespace: 'sentiment_analysis',
    key: `${symbol}_basic_sentiment`,
    data: {
      symbol,
      sentiment: Math.random() > 0.5 ? 'bullish' : 'bearish',
      confidence: Math.random() * 0.3 + 0.5, // 0.5-0.8
      timestamp: new Date().toISOString()
    }
  }));
}

function generateSectorDataWarmup(): Array<{namespace: string, key: string, data: any}> {
  const sectors = [
    'Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer Discretionary',
    'Industrials', 'Materials', 'Utilities', 'Real Estate', 'Communication Services'
  ];

  return sectors.map(sector => ({
    namespace: 'sector_data',
    key: `${sector.toLowerCase().replace(' ', '_')}_snapshot`,
    data: {
      sector,
      performance: (Math.random() - 0.5) * 10,
      volume: Math.floor(Math.random() * 100000000),
      marketCap: Math.floor(Math.random() * 500000000000),
      topStocks: generateRandomStockSymbols(3),
      trend: Math.random() > 0.5 ? 'upward' : 'downward',
      momentum: Math.random() * 2 - 1,
      timestamp: new Date().toISOString()
    }
  }));
}

function generatePredictiveModelsWarmup(): Array<{namespace: string, key: string, data: any}> {
  return [
    {
      namespace: 'ai_results',
      key: 'market_predictions',
      data: {
        shortTerm: {
          direction: Math.random() > 0.5 ? 'bullish' : 'bearish',
          confidence: Math.random() * 0.3 + 0.6,
          timeframe: '1-2 weeks'
        },
        longTerm: {
          direction: Math.random() > 0.4 ? 'bullish' : 'bearish',
          confidence: Math.random() * 0.4 + 0.5,
          timeframe: '3-6 months'
        },
        modelVersion: 'predictive-v3',
        lastTrained: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }
    },
    {
      namespace: 'ai_results',
      key: 'sector_rotation_predictions',
      data: {
        trendingSectors: ['Technology', 'Healthcare', 'Energy'],
        decliningSectors: ['Utilities', 'Real Estate'],
        confidence: Math.random() * 0.3 + 0.6,
        nextRebalance: new Date(Date.now() + 604800000).toISOString() // 1 week from now
      }
    }
  ];
}

function generateReportsWarmup(): Array<{namespace: string, key: string, data: any}> {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);

  return [
    {
      namespace: 'reports',
      key: 'daily_summary',
      data: {
        date: yesterday.toISOString().split('T')[0],
        marketStatus: 'closed',
        summary: 'Market showed mixed performance with technology stocks leading gains.',
        keyHighlights: [
          'S&P 500: +0.8%',
          'NASDAQ: +1.2%',
          'Dow Jones: -0.3%'
        ],
        topPerformers: generateRandomStockSymbols(5),
        worstPerformers: generateRandomStockSymbols(3),
        sentiment: 'neutral',
        reportType: 'daily'
      }
    },
    {
      namespace: 'reports',
      key: 'pre_market_briefing',
      data: {
        date: today.toISOString().split('T')[0],
        marketStatus: 'pre-market',
        expectedMoves: ['Technology stocks to open higher', 'Energy sector facing pressure'],
        keyEvents: ['Fed minutes release', 'Earnings reports from major tech companies'],
        globalMarkets: {
          'Asia': 'Mixed',
          'Europe': 'Slightly positive'
        },
        reportType: 'pre_market'
      }
    }
  ];
}

function generateWeeklyReportsWarmup(): Array<{namespace: string, key: string, data: any}> {
  const lastWeek = new Date(Date.now() - 7 * 86400000);

  return [
    {
      namespace: 'reports',
      key: 'weekly_market_review',
      data: {
        weekEnding: lastWeek.toISOString().split('T')[0],
        weeklyPerformance: {
          'S&P 500': Math.random() * 4 - 2,
          'NASDAQ': Math.random() * 5 - 2.5,
          'Dow Jones': Math.random() * 3 - 1.5
        },
        sectorAnalysis: {
          best: 'Technology',
          worst: 'Utilities'
        },
        marketThemes: [
          'AI-driven growth continued',
          'Interest rate concerns eased',
          'Energy prices stabilized'
        ],
        outlook: 'cautiously optimistic',
        reportType: 'weekly'
      }
    }
  ];
}

function generateComprehensiveDataWarmup(symbols: string[]): Array<{namespace: string, key: string, data: any}> {
  return [
    ...generateMarketDataWarmup(symbols),
    ...generateBasicSentimentWarmup(symbols),
    ...generateSectorDataWarmup(),
    ...generateReportsWarmup()
  ];
}

function generateRandomStockSymbols(count: number): string[] {
  const stockPool = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'JNJ', 'V',
    'PG', 'UNH', 'HD', 'MA', 'PYPL', 'DIS', 'NFLX', 'ADBE', 'CRM', 'INTC'
  ];

  const shuffled = [...stockPool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Create enhanced cache routes
 */
export function createEnhancedCacheRoutes(env: any) {
  // Use enhanced cache factory to create appropriate cache manager
    const cacheManager = EnhancedCacheFactory.createCacheManager(env, {
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
          const body = await request.json().catch(() => ({}));
          const {
            strategy = 'comprehensive',
            namespaces = [],
            preload_symbols = ['AAPL', 'MSFT', 'GOOGL'],
            force_refresh = false
          } = body;

          logger.info('Starting enhanced cache warmup', {
            strategy,
            namespaces: namespaces.length || 'all',
            symbols_count: preload_symbols.length,
            force_refresh
          });

          const results = [];
          const warmup_start = Date.now();

          // Enhanced warmup strategies
          let warmup_datasets = [];

          switch (strategy) {
            case 'comprehensive':
            case 'deep_refresh':
              warmup_datasets = [
                ...generateMarketDataWarmup(preload_symbols),
                ...generateSentimentAnalysisWarmup(preload_symbols),
                ...generateSectorDataWarmup(),
                ...generatePredictiveModelsWarmup(),
                ...generateReportsWarmup()
              ];
              break;

            case 'pre_market':
              warmup_datasets = [
                ...generateMarketDataWarmup(['SPY', 'QQQ', 'DIA', 'IWM']),
                ...generateSectorDataWarmup(),
                ...generateBasicSentimentWarmup(['SPY', 'QQQ'])
              ];
              break;

            case 'midday_refresh':
              warmup_datasets = [
                ...generateMarketDataWarmup(preload_symbols.slice(0, 5)),
                ...generateSentimentAnalysisWarmup(preload_symbols.slice(0, 3))
              ];
              break;

            case 'evening_refresh':
              warmup_datasets = [
                ...generateSentimentAnalysisWarmup(['SPY', 'QQQ', 'VTI']),
                ...generateSectorDataWarmup(),
                ...generateReportsWarmup()
              ];
              break;

            case 'weekend_maintenance':
              warmup_datasets = [
                ...generateComprehensiveDataWarmup(['SPY', 'QQQ', 'VTI', 'VOO']),
                ...generateSectorDataWarmup(),
                ...generateWeeklyReportsWarmup()
              ];
              break;

            default:
              warmup_datasets = [
                { namespace: 'sentiment_analysis', key: 'warmup_test', data: { sentiment: 'bullish', confidence: 0.8 } },
                { namespace: 'market_data', key: 'AAPL_warmup', data: { price: 150.0, volume: 1000000 } },
                { namespace: 'ai_results', key: 'model_warmup', data: { prediction: 'uptrend', confidence: 0.9 } },
              ];
          }

          // Filter by specified namespaces if provided
          if (namespaces.length > 0) {
            warmup_datasets = warmup_datasets.filter(dataset => namespaces.includes(dataset.namespace));
          }

          // Execute warmup
          for (const dataset of warmup_datasets) {
            try {
              // Set in cache with appropriate TTL based on namespace
              await cacheManager.set(dataset.namespace, dataset.key, dataset.data);

              // Verify the data was cached
              const retrieved = await cacheManager.get(dataset.namespace, dataset.key);

              results.push({
                namespace: dataset.namespace,
                key: dataset.key,
                success: retrieved !== null,
                data_size: JSON.stringify(dataset.data).length,
                ttl: dataset.ttl || 'default'
              });
            } catch (error) {
              logger.error(`Failed to warm cache entry: ${dataset.namespace}:${dataset.key}`, { error });
              results.push({
                namespace: dataset.namespace,
                key: dataset.key,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }

          const warmup_duration = Date.now() - warmup_start;
          const successful_warmups = results.filter(r => r.success).length;
          const total_warmups = results.length;

          logger.info('Cache warmup completed', {
            strategy,
            successful: successful_warmups,
            total: total_warmups,
            duration_ms: warmup_duration,
            success_rate: `${Math.round(successful_warmups / total_warmups * 100)}%`
          });

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            message: 'Enhanced cache warmup completed',
            strategy: strategy,
            results: {
              successful: successful_warmups,
              total: total_warmups,
              success_rate: Math.round(successful_warmups / total_warmups * 100),
              duration_ms: warmup_duration,
              entries: results.slice(0, 10), // Return first 10 for brevity
              namespaces_warmed: [...new Set(results.map(r => r.namespace))]
            },
            cacheStats: cacheManager.getStats(),
            l2CacheInfo: {
              ttl_hours: 24,
              total_entries: results.length,
              estimated_size_kb: Math.round(results.reduce((sum, r) => sum + (r.data_size || 0), 0) / 1024)
            }
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error) {
          logger.error('Enhanced cache warmup failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Cache warmup failed',
            timestamp: new Date().toISOString(),
            details: error instanceof Error ? error.message : 'Unknown error'
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