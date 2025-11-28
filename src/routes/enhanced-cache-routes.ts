/**
 * Enhanced Cache API Routes
 * Provides 6 endpoints for testing and monitoring enhanced cache features
 * (Load testing removed - dual cache functionality covered by integration tests)
 */

import { createLogger } from '../modules/logging.js';
import { createCacheInstance } from '../modules/dual-cache-do.js';
import { getMetricsConfig } from '../modules/config.js';
import { StorageGuards, type GuardConfig } from '../modules/storage-guards.js';

const logger = createLogger('enhanced-cache-routes');

/**
 * Helper functions for timestamp formatting
 */

function formatAge(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

function formatTimeRemaining(expiresAt: string): string {
  const now = Date.now();
  const expiryTime = new Date(expiresAt).getTime();
  const remainingMs = expiryTime - now;

  if (remainingMs <= 0) {
    return 'Expired';
  }

  const remainingSeconds = Math.floor(remainingMs / 1000);
  return formatAge(remainingSeconds);
}

function getFreshnessStatus(timestampInfo: any): string {
  if (timestampInfo.isWithinGracePeriod) {
    return 'FRESH_IN_GRACE';
  } else if (timestampInfo.isStale) {
    return 'STALE';
  } else {
    return 'FRESH';
  }
}

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
  // Use Durable Objects cache if available
  // External APIs use KV cache independently
  const cacheManager = createCacheInstance(env, true);
  if (cacheManager) {
    logger.info('Using Durable Objects cache (L1)');
  } else {
    // Cache endpoints work without cache
    logger.info('Cache disabled (L1 not available)');
  }

  const routes = [
    {
      path: '/cache-health',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          // Return basic health if cache is disabled
          if (!cacheManager) {
            return new Response(JSON.stringify({
              success: true,
              timestamp: new Date().toISOString(),
              assessment: {
                status: 'disabled',
                overallScore: 0,
                l1Metrics: { enabled: false },
                l2Metrics: { enabled: false },
                message: 'Cache is disabled (DO cache not enabled)'
              }
            }), {
              headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
            });
          }

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
        } catch (error: unknown) {
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
          // Return basic config if cache is disabled
          if (!cacheManager) {
            return new Response(JSON.stringify({
              success: true,
              timestamp: new Date().toISOString(),
              environment: env.ENVIRONMENT || 'production',
              config: {
                enabled: false,
                l1Cache: { enabled: false },
                l2Cache: { enabled: false, namespace: 'MARKET_ANALYSIS_CACHE' },
                message: 'Cache is disabled (DO cache not enabled)'
              }
            }), {
              headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
            });
          }

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
        } catch (error: unknown) {
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
          // Return zero metrics if cache is disabled
          if (!cacheManager) {
            return new Response(JSON.stringify({
              success: true,
              timestamp: new Date().toISOString(),
              cacheStats: {
                totalRequests: 0,
                l1Hits: 0,
                l2Hits: 0,
                misses: 0,
                l1Size: 0,
                l2Size: 0
              },
              l1Stats: {
                hits: 0,
                misses: 0,
                currentSize: 0,
                currentMemoryMB: 0,
                hitRate: 0
              },
              message: 'Cache is disabled (DO cache not enabled)'
            }), {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
              },
            });
          }

          const stats = cacheManager.getStats();
          const l1Stats = cacheManager.getL1Stats();
          const l1DetailedInfo = cacheManager.getL1DetailedInfo();
          const promotionStats = cacheManager.getPromotionStats();
          const trends = cacheManager.getPerformanceTrends();

          // Calculate timestamp statistics
          const timestampStats = {
            totalEntries: l1Stats.currentSize,
            oldestEntry: l1Stats.oldestEntry ? formatAge(l1Stats.oldestEntry) : 'N/A',
            newestEntry: l1Stats.newestEntry ? formatAge(l1Stats.newestEntry) : 'N/A',
            averageAge: l1DetailedInfo.averageAge ? formatAge(Math.floor(l1DetailedInfo.averageAge)) : 'N/A',
            memoryUsage: l1DetailedInfo.currentMemoryMB.toFixed(2) + ' MB',
            hitRate: Math.round(l1Stats.hitRate * 100) + '%',
            evictions: l1Stats.evictions
          };

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            cacheStats: stats,
            l1Stats: l1Stats,
            l1DetailedInfo: l1DetailedInfo,
            promotionStats: promotionStats,
            trends: trends,
            timestampStats: timestampStats,
            features: {
              timestampsEnabled: true,
              staleWhileRevalidate: cacheManager.l1Cache.isStaleWhileRevalidateEnabled(),
              gracePeriodSeconds: 600 // 10 minutes
            }
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: unknown) {
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
          // Return disabled status if cache is disabled
          if (!cacheManager) {
            return new Response(JSON.stringify({
              success: true,
              timestamp: new Date().toISOString(),
              enabled: false,
              stats: { totalPromotions: 0, successfulPromotions: 0 },
              accessPatterns: [],
              message: 'Cache is disabled (DO cache not enabled)'
            }), {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
              },
            });
          }

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
        } catch (error: unknown) {
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
          // Return disabled status if cache is disabled
          if (!cacheManager) {
            return new Response(JSON.stringify({
              success: true,
              timestamp: new Date().toISOString(),
              system: {
                status: 'disabled',
                enabled: false,
                l1Cache: { enabled: false },
                l2Cache: { enabled: true, namespace: 'MARKET_ANALYSIS_CACHE' },
                message: 'Cache is disabled (DO cache not enabled)'
              }
            }), {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
              },
            });
          }

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
        } catch (error: unknown) {
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
          const body = (await request.json().catch(() => ({}))) as any;
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
          let warmup_datasets: Array<{namespace: string, key: string, data: any, ttl?: number}> = [];

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
              await cacheManager.setWithNamespace(dataset.namespace, dataset.key, dataset.data, dataset.ttl);

              // Verify the data was cached
              const retrieved = await cacheManager.getWithNamespace(dataset.namespace, dataset.key);

              results.push({
                namespace: dataset.namespace,
                key: dataset.key,
                success: retrieved !== null,
                data_size: JSON.stringify(dataset.data).length,
                ttl: dataset.ttl || 'default'
              });
            } catch (error: unknown) {
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
              estimated_size_kb: Math.round(results.reduce((sum: any, r: any) => sum + (r.data_size || 0), 0) / 1024)
            }
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: unknown) {
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

    {
      path: '/cache-timestamps',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const url = new URL(request.url);
          const namespace = url.searchParams.get('namespace') || 'sentiment_analysis';
          const key = url.searchParams.get('key');

          if (!key) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing required parameter: key',
              timestamp: new Date().toISOString(),
              usage: 'GET /cache-timestamps?namespace=sentiment_analysis&key=AAPL_sentiment'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Get timestamp information
          const timestampInfo = cacheManager.getTimestampInfo(namespace, key);

          if (!timestampInfo) {
            return new Response(JSON.stringify({
              success: true,
              timestamp: new Date().toISOString(),
              message: 'No cache entry found',
              namespace,
              key: `${namespace}:${key}`,
              cached: false
            }), {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
              },
            });
          }

          // Get L1 cache stats for additional context
          const l1Stats = cacheManager.getL1Stats();
          const l1DetailedInfo = cacheManager.getL1DetailedInfo();

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            namespace,
            key: `${namespace}:${key}`,
            cached: true,
            timestampInfo: {
              l1Timestamp: timestampInfo.l1Timestamp,
              l2Timestamp: timestampInfo.l2Timestamp,
              cacheSource: timestampInfo.cacheSource,
              ageSeconds: timestampInfo.ageSeconds,
              ttlSeconds: timestampInfo.ttlSeconds,
              expiresAt: timestampInfo.expiresAt,
              isStale: timestampInfo.isStale,
              isWithinGracePeriod: timestampInfo.isWithinGracePeriod,
              ageFormatted: formatAge(timestampInfo.ageSeconds),
              timeRemaining: formatTimeRemaining(timestampInfo.expiresAt),
              freshnessStatus: getFreshnessStatus(timestampInfo)
            },
            cacheContext: {
              l1TotalEntries: l1Stats.currentSize,
              l1HitRate: Math.round(l1Stats.hitRate * 100),
              l1Evictions: l1Stats.evictions,
              memoryUsage: l1DetailedInfo.currentMemoryMB.toFixed(2) + ' MB'
            }
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: unknown) {
          logger.error('Cache timestamp check failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to retrieve cache timestamp information',
            timestamp: new Date().toISOString(),
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/cache-debug',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const url = new URL(request.url);
          const namespace = url.searchParams.get('namespace') || 'sentiment_analysis';
          const key = url.searchParams.get('key');

          if (!key) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing required parameter: key',
              timestamp: new Date().toISOString(),
              usage: 'GET /cache-debug?namespace=sentiment_analysis&key=AAPL_sentiment'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Get comprehensive cache debug information
          const timestampInfo = cacheManager.getTimestampInfo(namespace, key);
          // @ts-ignore - Cache stats from external adapter
          const cacheStats = cacheManager.getStats();
          // @ts-ignore - L1 stats from external adapter
          const l1Stats = cacheManager.getL1Stats();
          // @ts-ignore - Health assessment from external adapter
          const healthAssessment = await cacheManager.performHealthAssessment();

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            debugInfo: {
              namespace,
              key: `${namespace}:${key}`,
              cacheStatus: timestampInfo ? 'FOUND' : 'NOT_FOUND',
              timestampInfo: timestampInfo || null,
              cacheStatistics: {
                totalRequests: (cacheStats as any).totalRequests,
                l1Hits: (cacheStats as any).l1Hits,
                l2Hits: (cacheStats as any).l2Hits,
                misses: (cacheStats as any).misses,
                l1HitRate: Math.round((cacheStats as any).l1HitRate * 100),
                l2HitRate: Math.round((cacheStats as any).l2HitRate * 100),
                overallHitRate: Math.round((cacheStats as any).overallHitRate * 100),
                currentL1Size: (cacheStats as any).l1Size,
                currentL2Size: (cacheStats as any).l2Size
              },
              healthStatus: {
                overallScore: (healthAssessment as any).assessment.overallScore,
                status: (healthAssessment as any).assessment.status,
                issues: (healthAssessment as any).assessment.issues,
                recommendations: (healthAssessment as any).assessment.recommendations
              }
            }
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: unknown) {
          logger.error('Cache debug failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to retrieve cache debug information',
            timestamp: new Date().toISOString(),
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/cache-deduplication',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const url = new URL(request.url);
          const details = url.searchParams.get('details') === 'true';

          // Get deduplication statistics
          const deduplicationStats = cacheManager.getDeduplicationStats();
          const cacheInfo = details ? cacheManager.getDeduplicationCacheInfo() : null;
          const pendingRequests = details ? cacheManager.getDeduplicationPendingRequests() : null;

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            deduplication: {
              enabled: true,
              statistics: {
                totalRequests: deduplicationStats.totalRequests,
                deduplicatedRequests: deduplicationStats.deduplicatedRequests,
                cacheHits: deduplicationStats.cacheHits,
                pendingRequests: deduplicationStats.pendingRequests,
                timeoutRequests: deduplicationStats.timeoutRequests,
                deduplicationRate: Math.round(deduplicationStats.deduplicationRate * 100),
                averageResponseTime: Math.round(deduplicationStats.averageResponseTime),
                memoryUsage: deduplicationStats.memoryUsage,
                kvReduction: Math.round(deduplicationStats.deduplicationRate * 100) + '%'
              },
              configuration: {
                maxPendingRequests: 1000,
                requestTimeoutMs: 30000,
                cacheTimeoutMs: 300000,
                enableMetrics: true,
                enableLogging: true
              },
              performance: {
                totalRequestsServed: deduplicationStats.totalRequests,
                requestsSavedFromDuplicateCalls: deduplicationStats.deduplicatedRequests,
                requestsSavedFromCache: deduplicationStats.cacheHits,
                totalSavings: deduplicationStats.deduplicatedRequests + deduplicationStats.cacheHits,
                estimatedKvSavings: Math.round((deduplicationStats.deduplicatedRequests + deduplicationStats.cacheHits) * 0.8) + ' KV operations'
              }
            },
            ...(details && {
              detailedInfo: {
                cache: cacheInfo,
                pendingRequests: pendingRequests
              }
            })
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: unknown) {
          logger.error('Cache deduplication stats failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to retrieve deduplication statistics',
            timestamp: new Date().toISOString(),
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    // ============================================================================
    // DAC-Aligned Metrics Endpoints (Option B Implementation)
    // ============================================================================

    {
      path: '/cache/metrics',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          // Check metrics configuration and safety controls
          const metricsConfig = getMetricsConfig(env);
          if (!metricsConfig.enabled) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Metrics endpoint disabled',
              message: 'Set STORAGE_ADAPTER_ENABLED=true to enable metrics',
              timestamp: new Date().toISOString()
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          if (!metricsConfig.json.enabled) {
            return new Response(JSON.stringify({
              success: false,
              error: 'JSON metrics format disabled',
              message: 'Set METRICS_JSON_ENABLED=true to enable JSON metrics',
              timestamp: new Date().toISOString()
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const url = new URL(request.url);
          const format = url.searchParams.get('format') || 'json';

          // Initialize metrics manager with configuration
          const { EnhancedCacheMetricsManager } = await import('../modules/enhanced-cache-metrics.js');
          const metricsManager = new EnhancedCacheMetricsManager({
            sampleRate: metricsConfig.collection.sampleRate,
            maxRecentOperations: metricsConfig.collection.maxOperations
          });

          // Check if storage adapters are enabled and have metrics
          if (env.STORAGE_ADAPTER_ENABLED === 'true') {
            try {
              // Initialize router adapter and inject metrics collector
              const { RouterAdapter } = await import('../modules/router-storage-adapter.js');

              // Create instances and inject metrics collector
              const router = new RouterAdapter(env);
              router.setMetricsCollector(metricsManager);

              // Collect adapter health statistics
              const adapterStats = await router.getAdapterStats();

              // Update gauges with adapter statistics
              Object.entries(adapterStats).forEach(([adapterName, stats]: [string, any]) => {
                if (stats.enabled) {
                  metricsManager.setGauge('adapter_operations_total', {
                    layer: stats.storageClass === 'cold_storage' ? 'kv' : 'do',
                    storage_class: stats.storageClass,
                    keyspace: 'market_analysis_cache'
                  }, stats.totalOperations);

                  metricsManager.setGauge('adapter_hit_rate', {
                    layer: stats.storageClass === 'cold_storage' ? 'kv' : 'do',
                    storage_class: stats.storageClass,
                    keyspace: 'market_analysis_cache'
                  }, stats.hits / Math.max(stats.totalOperations, 1));

                  metricsManager.setGauge('adapter_avg_latency_ms', {
                    layer: stats.storageClass === 'cold_storage' ? 'kv' : 'do',
                    storage_class: stats.storageClass,
                    keyspace: 'market_analysis_cache'
                  }, stats.avgLatency);
                }
              });
            } catch (adapterError) {
              logger.warn('Failed to collect adapter metrics', { error: adapterError });
            }
          }

          // Get metrics snapshot
          const metricsSnapshot = metricsManager.toJSON();

          if (format === 'prometheus') {
            // Return Prometheus format
            const prometheusMetrics = metricsManager.renderPrometheus();
            return new Response(prometheusMetrics, {
              headers: {
                'Content-Type': 'text/plain; version=0.0.4',
                'Cache-Control': 'no-cache',
              },
            });
          }

          // Return JSON format (default)
          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            metrics: metricsSnapshot,
            storage_adapters: {
              enabled: env.STORAGE_ADAPTER_ENABLED === 'true',
              hot_cache_mode: env.HOT_CACHE_MODE || 'disabled',
              warm_cache_mode: env.WARM_CACHE_MODE || 'disabled',
              cold_storage_mode: env.COLD_STORAGE_MODE || 'disabled',
              ephemeral_mode: env.EPHEMERAL_MODE || 'disabled'
            }
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: unknown) {
          logger.error('Cache metrics failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to retrieve cache metrics',
            timestamp: new Date().toISOString(),
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/cache/metrics.prom',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          // Check metrics configuration and safety controls
          const metricsConfig = getMetricsConfig(env);
          if (!metricsConfig.enabled) {
            return new Response('# Metrics disabled\n# Set STORAGE_ADAPTER_ENABLED=true to enable metrics', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            });
          }

          if (!metricsConfig.prometheus.enabled) {
            return new Response('# Prometheus metrics disabled\n# Set METRICS_PROMETHEUS_ENABLED=true to enable', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            });
          }

          // Initialize metrics manager with configuration
          const { EnhancedCacheMetricsManager } = await import('../modules/enhanced-cache-metrics.js');
          const metricsManager = new EnhancedCacheMetricsManager({
            sampleRate: metricsConfig.collection.sampleRate,
            maxRecentOperations: metricsConfig.collection.maxOperations
          });

          // Check if storage adapters are enabled and have metrics
          if (env.STORAGE_ADAPTER_ENABLED === 'true') {
            try {
              // Initialize router adapter and inject metrics collector
              const { RouterAdapter } = await import('../modules/router-storage-adapter.js');

              // Create instances and inject metrics collector
              const router = new RouterAdapter(env);
              router.setMetricsCollector(metricsManager);

              // Collect adapter health statistics
              const adapterStats = await router.getAdapterStats();

              // Update gauges with adapter statistics
              Object.entries(adapterStats).forEach(([adapterName, stats]: [string, any]) => {
                if (stats.enabled) {
                  metricsManager.setGauge('adapter_operations_total', {
                    layer: stats.storageClass === 'cold_storage' ? 'kv' : 'do',
                    storage_class: stats.storageClass,
                    keyspace: 'market_analysis_cache'
                  }, stats.totalOperations);

                  metricsManager.setGauge('adapter_hit_rate', {
                    layer: stats.storageClass === 'cold_storage' ? 'kv' : 'do',
                    storage_class: stats.storageClass,
                    keyspace: 'market_analysis_cache'
                  }, stats.hits / Math.max(stats.totalOperations, 1));

                  metricsManager.setGauge('adapter_avg_latency_ms', {
                    layer: stats.storageClass === 'cold_storage' ? 'kv' : 'do',
                    storage_class: stats.storageClass,
                    keyspace: 'market_analysis_cache'
                  }, stats.avgLatency);
                }
              });
            } catch (adapterError) {
              logger.warn('Failed to collect adapter metrics for Prometheus', { error: adapterError });
            }
          }

          // Return Prometheus format
          const prometheusMetrics = metricsManager.renderPrometheus();
          return new Response(prometheusMetrics, {
            headers: {
              'Content-Type': 'text/plain; version=0.0.4',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: unknown) {
          logger.error('Cache metrics (Prometheus) failed', { error });
          return new Response(`# Error generating metrics\n${error instanceof Error ? error.message : 'Unknown error'}`, {
            status: 500,
            headers: { 'Content-Type': 'text/plain' },
          });
        }
      },
    },

    // ============================================================================
    // Production Guard Drill Endpoints (Option C Implementation)
    // ============================================================================

    {
      path: '/production-guards/health',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          // Initialize storage guards from environment
          const guardConfig = StorageGuards.fromEnvironment(env);
          const guards = new StorageGuards(guardConfig);

          const stats = guards.getStats();
          const config = guards.getConfiguration ? guards.getConfiguration() : null;

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            guards: {
              enabled: guardConfig.enabled,
              mode: guardConfig.mode,
              enforcement: guardConfig.enforcement,
              thresholds: guardConfig.thresholds,
              exceptions: guardConfig.exceptions
            },
            statistics: {
              totalChecks: stats.totalChecks,
              violations: stats.violations,
              actions: stats.actions,
              byStorageClass: stats.byStorageClass,
              lastViolation: stats.lastViolation
            },
            recentViolations: guards.getRecentViolations(10)
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: unknown) {
          logger.error('Production guards health check failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to retrieve production guards status',
            timestamp: new Date().toISOString(),
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/production-guards/drill',
      method: 'POST',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const body = await request.json() as {
            operation?: 'get' | 'put' | 'delete' | 'list';
            key?: string;
            storageClass?: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
            mode?: 'disabled' | 'warn' | 'error' | 'block';
            latencyMs?: number;
            caller?: string;
          };

          const {
            operation = 'get',
            key = 'drill_test_analysis_AAPL_2024-01-01',
            storageClass = 'hot_cache',
            mode = 'warn',
            latencyMs,
            caller = 'admin_drill'
          } = body;

          // Validate inputs
          if (!key || !storageClass) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing required fields: key, storageClass',
              timestamp: new Date().toISOString()
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Initialize guards with drill mode
          const guardConfig: GuardConfig = {
            enabled: true,
            mode,
            enforcement: {
              hotCacheOnlyDO: true,
              warmCacheOnlyDO: true,
              coldStorageAllowD1: true,
              ephemeralAllowMemory: true
            },
            thresholds: {
              maxKvOperationsPerMinute: 100,
              maxKvReadLatencyMs: 50,
              errorRateThreshold: 0.05
            },
            exceptions: {
              adminBypass: false, // Disable admin bypass for drill
              allowedPrefixes: [], // No allowed prefixes for drill
              maintenanceMode: false
            }
          };

          const guards = new StorageGuards(guardConfig);
          const beforeStats = guards.getStats();

          // Run the drill
          const startTime = Date.now();
          const result = await guards.checkKvOperation(operation, key, storageClass, {
            latencyMs: latencyMs || 25,
            caller
          });
          const drillDuration = Date.now() - startTime;

          const afterStats = guards.getStats();
          const newViolations = afterStats.violations.total - beforeStats.violations.total;

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            drill: {
              operation,
              key,
              storageClass,
              mode,
              latencyMs,
              caller,
              duration: drillDuration
            },
            result: {
              allowed: result.allowed,
              action: result.action,
              reason: result.reason
            },
            statistics: {
              before: {
                totalChecks: beforeStats.totalChecks,
                violations: beforeStats.violations.total
              },
              after: {
                totalChecks: afterStats.totalChecks,
                violations: afterStats.violations.total
              },
              newViolations
            },
            guardState: {
              enabled: guardConfig.enabled,
              mode: guardConfig.mode,
              enforcement: guardConfig.enforcement
            }
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: unknown) {
          logger.error('Production guard drill failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Drill execution failed',
            timestamp: new Date().toISOString(),
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/production-guards/simulate-kv-violation',
      method: 'POST',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const body = await request.json() as {
            storageClass?: 'hot_cache' | 'warm_cache';
            key?: string;
            mode?: 'warn' | 'error' | 'block';
          };

          const {
            storageClass = 'hot_cache',
            key = 'test_forbidden_kv_operation',
            mode = 'warn'
          } = body;

          // Initialize guards with strict KV enforcement
          const guardConfig: GuardConfig = {
            enabled: true,
            mode,
            enforcement: {
              hotCacheOnlyDO: storageClass === 'hot_cache',
              warmCacheOnlyDO: storageClass === 'warm_cache',
              coldStorageAllowD1: true,
              ephemeralAllowMemory: true
            },
            thresholds: {
              maxKvOperationsPerMinute: 10, // Low for testing
              maxKvReadLatencyMs: 25,
              errorRateThreshold: 0.01
            },
            exceptions: {
              adminBypass: false,
              allowedPrefixes: [],
              maintenanceMode: false
            }
          };

          const guards = new StorageGuards(guardConfig);

          // Simulate multiple KV operations to trigger rate limiting
          const results = [];
          for (let i = 0; i < 15; i++) {
            const testKey = `${key}_${i}`;
            const result = await guards.checkKvOperation('get', testKey, storageClass, {
              caller: 'simulate_kv_drill'
            });
            results.push({
              key: testKey,
              allowed: result.allowed,
              action: result.action,
              reason: result.reason
            });
          }

          const finalStats = guards.getStats();
          const blockedCount = results.filter(r => !r.allowed).length;

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            drill: {
              type: 'simulate_kv_violation',
              storageClass,
              mode,
              totalOperations: results.length,
              blockedOperations: blockedCount,
              violationRate: blockedCount / results.length
            },
            results,
            statistics: {
              totalChecks: finalStats.totalChecks,
              violations: finalStats.violations,
              byStorageClass: finalStats.byStorageClass
            }
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: unknown) {
          logger.error('KV violation simulation failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Simulation failed',
            timestamp: new Date().toISOString(),
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/production-guards/config',
      method: 'POST',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const body = await request.json() as {
            mode?: 'disabled' | 'warn' | 'error' | 'block';
            hotCacheOnlyDO?: boolean;
            warmCacheOnlyDO?: boolean;
            coldStorageAllowD1?: boolean;
            ephemeralAllowMemory?: boolean;
            maxKvOpsPerMinute?: number;
            maxKvLatencyMs?: number;
            maintenanceMode?: boolean;
          };

          // Initialize current guards
          const currentConfig = StorageGuards.fromEnvironment(env);
          const guards = new StorageGuards(currentConfig);

          // Apply configuration updates
          const updates: Partial<GuardConfig> = {};
          if (body.mode !== undefined) updates.mode = body.mode;
          if (body.hotCacheOnlyDO !== undefined) {
            updates.enforcement = { ...currentConfig.enforcement, hotCacheOnlyDO: body.hotCacheOnlyDO };
          }
          if (body.warmCacheOnlyDO !== undefined) {
            updates.enforcement = { ...currentConfig.enforcement, warmCacheOnlyDO: body.warmCacheOnlyDO };
          }
          if (body.coldStorageAllowD1 !== undefined) {
            updates.enforcement = { ...currentConfig.enforcement, coldStorageAllowD1: body.coldStorageAllowD1 };
          }
          if (body.ephemeralAllowMemory !== undefined) {
            updates.enforcement = { ...currentConfig.enforcement, ephemeralAllowMemory: body.ephemeralAllowMemory };
          }
          if (body.maxKvOpsPerMinute !== undefined) {
            updates.thresholds = { ...currentConfig.thresholds, maxKvOperationsPerMinute: body.maxKvOpsPerMinute };
          }
          if (body.maxKvLatencyMs !== undefined) {
            updates.thresholds = { ...currentConfig.thresholds, maxKvReadLatencyMs: body.maxKvLatencyMs };
          }
          if (body.maintenanceMode !== undefined) {
            updates.exceptions = { ...currentConfig.exceptions, maintenanceMode: body.maintenanceMode };
          }

          guards.updateConfig(updates);

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            message: 'Guard configuration updated',
            updates: Object.keys(updates),
            newConfig: {
              mode: body.mode || currentConfig.mode,
              enforcement: {
                hotCacheOnlyDO: body.hotCacheOnlyDO ?? currentConfig.enforcement.hotCacheOnlyDO,
                warmCacheOnlyDO: body.warmCacheOnlyDO ?? currentConfig.enforcement.warmCacheOnlyDO,
                coldStorageAllowD1: body.coldStorageAllowD1 ?? currentConfig.enforcement.coldStorageAllowD1,
                ephemeralAllowMemory: body.ephemeralAllowMemory ?? currentConfig.enforcement.ephemeralAllowMemory
              },
              thresholds: {
                maxKvOperationsPerMinute: body.maxKvOpsPerMinute ?? currentConfig.thresholds.maxKvOperationsPerMinute,
                maxKvReadLatencyMs: body.maxKvLatencyMs ?? currentConfig.thresholds.maxKvReadLatencyMs
              },
              maintenanceMode: body.maintenanceMode ?? currentConfig.exceptions.maintenanceMode
            }
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: unknown) {
          logger.error('Guard configuration update failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Configuration update failed',
            timestamp: new Date().toISOString(),
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    // ============================================================================
    // Operations Endpoints - D1 Cold Storage Integration
    // ============================================================================

    {
      path: '/ops/cache-rollups',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const url = new URL(request.url);
          const day = url.searchParams.get('day'); // Format: YYYY-MM-DD
          const keyspace = url.searchParams.get('keyspace');
          const storageClass = url.searchParams.get('storageClass') as 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral' | null;

          // Import D1 cold storage module
          const { D1ColdStorage } = await import('../modules/d1-storage.js');

          if (!env.ANALYTICS_DB) {
            return new Response(JSON.stringify({
              success: false,
              error: 'ANALYTICS_DB not configured',
              timestamp: new Date().toISOString()
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const d1Storage = new D1ColdStorage(env.ANALYTICS_DB);
          const result = await d1Storage.getRollups(day || undefined, keyspace || undefined, storageClass || undefined);

          if (!result.success) {
            return new Response(JSON.stringify({
              success: false,
              error: result.error,
              timestamp: new Date().toISOString()
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Calculate summary statistics
          const rollups = result.rollups || [];
          const summary = {
            totalRollups: rollups.length,
            totalHits: rollups.reduce((sum, r) => sum + r.hits, 0),
            totalMisses: rollups.reduce((sum, r) => sum + r.misses, 0),
            totalErrors: rollups.reduce((sum, r) => sum + r.errors, 0),
            avgHitRate: rollups.length > 0 ?
              rollups.reduce((sum, r) => sum + (r.hits / (r.hits + r.misses)), 0) / rollups.length : 0,
            totalEgressBytes: rollups.reduce((sum, r) => sum + r.egress_bytes, 0),
            totalComputeMs: rollups.reduce((sum, r) => sum + r.compute_ms, 0)
          };

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            query: { day, keyspace, storageClass },
            summary,
            rollups
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=300', // 5 minute cache
            },
          });
        } catch (error: unknown) {
          logger.error('Cache rollups retrieval failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to retrieve cache rollups',
            timestamp: new Date().toISOString(),
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/ops/cache-rollups',
      method: 'POST',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const body = await request.json() as {
            day: string; // Format: YYYY-MM-DD
            keyspace: string;
            storageClass: 'hot_cache' | 'warm_cache' | 'cold_storage' | 'ephemeral';
            metrics: {
              hits: number;
              misses: number;
              errors: number;
              totalOperations: number;
              latencies: number[];
              egressBytes: number;
              computeMs: number;
            };
          };

          // Import D1 cold storage module
          const { D1ColdStorage } = await import('../modules/d1-storage.js');

          if (!env.ANALYTICS_DB) {
            return new Response(JSON.stringify({
              success: false,
              error: 'ANALYTICS_DB not configured',
              timestamp: new Date().toISOString()
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const d1Storage = new D1ColdStorage(env.ANALYTICS_DB);
          const result = await d1Storage.upsertRollup(
            body.day,
            body.keyspace,
            body.storageClass,
            body.metrics
          );

          if (result.success) {
            return new Response(JSON.stringify({
              success: true,
              timestamp: new Date().toISOString(),
              message: 'Cache rollup upserted successfully',
              data: {
                day: body.day,
                keyspace: body.keyspace,
                storageClass: body.storageClass,
                totalOperations: body.metrics.totalOperations,
                hitRate: body.metrics.hits / (body.metrics.hits + body.metrics.misses)
              }
            }), {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
              },
            });
          } else {
            return new Response(JSON.stringify({
              success: false,
              error: result.error,
              timestamp: new Date().toISOString()
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        } catch (error: unknown) {
          logger.error('Cache rollup upsert failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to upsert cache rollup',
            timestamp: new Date().toISOString(),
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/ops/storage/lookup',
      method: 'GET',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const url = new URL(request.url);
          const key = url.searchParams.get('key');
          const includeMetadata = url.searchParams.get('includeMetadata') === 'true';

          if (!key) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing required parameter: key',
              timestamp: new Date().toISOString()
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Import router and D1 modules
          const { RouterStorageAdapter, createDefaultRouterConfig } = await import('../modules/router-storage-adapter.js');
          const { D1ColdStorage } = await import('../modules/d1-storage.js');
          const { createStorageGuards } = await import('../modules/storage-guards.js');

          // Initialize router with environment configuration
          const routerConfig = createDefaultRouterConfig(env);
          const router = new RouterStorageAdapter(routerConfig);

          // Set up guards and metrics if available
          const guards = createStorageGuards();
          router.setStorageGuards(guards);

          // Route the request to determine storage class
          const route = router.routeRequest(key);

          let result = {
            key,
            storageClass: route.storageClass,
            adapter: route.adapter.name,
            found: false,
            data: null,
            metadata: null,
            error: null
          };

          try {
            // Attempt to retrieve the data
            const getResult = await route.adapter.get(key, { includeMetadata });
            result.found = getResult.success;
            result.data = getResult.data;
            result.metadata = getResult.metadata;
            result.error = getResult.error;
          } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown retrieval error';
          }

          // Add routing information
          result.routing = {
            matchedPattern: route.pattern?.pattern || 'default',
            adapterConfigured: !!route.adapter,
            fallbackAvailable: !!routerConfig.adapters.fallback
          };

          // Include guard information if applicable
          if (result.storageClass !== 'cold_storage') {
            const guardCheck = await guards.checkKvOperation('get', key, route.storageClass);
            result.guardCheck = {
              allowed: guardCheck.allowed,
              action: guardCheck.action,
              reason: guardCheck.reason
            };
          }

          return new Response(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            lookup: result
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': includeMetadata ? 'no-cache' : 'public, max-age=60',
            },
          });
        } catch (error: unknown) {
          logger.error('Storage lookup failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Storage lookup failed',
            timestamp: new Date().toISOString(),
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },

    {
      path: '/ops/storage/lookup',
      method: 'DELETE',
      handler: async (request: Request, env: any, ctx: ExecutionContext) => {
        try {
          const url = new URL(request.url);
          const key = url.searchParams.get('key');

          if (!key) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing required parameter: key',
              timestamp: new Date().toISOString()
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Import router and D1 modules
          const { RouterStorageAdapter, createDefaultRouterConfig } = await import('../modules/router-storage-adapter.js');
          const { D1ColdStorage } = await import('../modules/d1-storage.js');
          const { createStorageGuards } = await import('../modules/storage-guards.js');

          // Initialize router with environment configuration
          const routerConfig = createDefaultRouterConfig(env);
          const router = new RouterStorageAdapter(routerConfig);

          // Set up guards
          const guards = createStorageGuards();
          router.setStorageGuards(guards);

          // Route the request to determine storage class
          const route = router.routeRequest(key);

          // Check guard permissions first
          const guardCheck = await guards.checkKvOperation('delete', key, route.storageClass);
          if (!guardCheck.allowed) {
            return new Response(JSON.stringify({
              success: false,
              error: `Operation blocked by storage guard: ${guardCheck.reason}`,
              guardAction: guardCheck.action,
              timestamp: new Date().toISOString()
            }), {
              status: guardCheck.action === 'blocked' ? 403 : 429,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // Attempt to delete from the routed storage
          const deleteResult = await route.adapter.delete(key);

          return new Response(JSON.stringify({
            success: deleteResult.success,
            timestamp: new Date().toISOString(),
            deletion: {
              key,
              storageClass: route.storageClass,
              adapter: route.adapter.name,
              deleted: deleteResult.deleted,
              error: deleteResult.error
            }
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: unknown) {
          logger.error('Storage deletion failed', { error });
          return new Response(JSON.stringify({
            success: false,
            error: 'Storage deletion failed',
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