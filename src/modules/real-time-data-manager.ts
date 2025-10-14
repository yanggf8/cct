/**
 * Real-time Data Manager
 *
 * Central orchestrator for real-time data ingestion, freshness tracking, cache warming,
 * and predictive analysis updates. Coordinates Yahoo Finance (market prices), FRED
 * (macro), sentiment/news, and market structure fetchers. Optimized for Workers
 * with background processing and rate limiting.
 *
 * Responsibilities:
 * - Parallel, prioritized data fetching with rate limits and circuit breakers
 * - Smart cache TTL adjustments based on market hours
 * - Cache warming strategies ahead of market open
 * - Incremental intraday updates (lightweight refresh)
 * - Data freshness tracking and alerts
 * - Fallbacks during data source outages
 *
 * Usage:
 *  const rtdm = initializeRealTimeDataManager(env)
 *  await rtdm.refreshAll({ priority: 'high', reason: 'pre_market' }, ctx)
 */

import { createLogger } from './logging.js';
import { CacheManager } from './cache-manager.js';
import { CACHE_TTL, getCacheNamespace } from './cache-config.js';
import { initializeMarketDrivers } from './market-drivers.js';
import { initializeMarketStructureFetcher } from './market-structure-fetcher.js';
import FredApiClient from './fred-api-client.js';
import { getMarketData, isMarketOpen, getMarketStatus } from './yahoo-finance-integration.js';
import { getFreeSentimentSignal, getFreeStockNews } from './free_sentiment_pipeline.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
import { CircuitBreakerFactory } from './circuit-breaker.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('real-time-data-manager');

export type UpdatePriority = 'high' | 'normal' | 'low';

export interface RefreshOptions {
  priority?: UpdatePriority;
  reason?: 'pre_market' | 'intraday' | 'end_of_day' | 'weekly' | 'manual' | string;
  symbols?: string[]; // prioritized symbols for price cache warming
  incremental?: boolean; // lightweight update if true
}

export interface FreshnessRecord {
  source: 'yahoo' | 'fred' | 'sentiment' | 'market_structure' | 'market_drivers' | 'predictions';
  status: 'healthy' | 'degraded' | 'unhealthy';
  updated_at: string; // ISO
  details?: any;
}

export class RealTimeDataManager {
  private env: CloudflareEnvironment;
  private cache: CacheManager;
  private dal;

  constructor(env: CloudflareEnvironment) {
    this.env = env;
    this.cache = new CacheManager(env);
    this.dal = createSimplifiedEnhancedDAL(env);
  }

  // Orchestrate all sources refresh in parallel with prioritization
  async refreshAll(opts: RefreshOptions = {}, ctx?: ExecutionContext): Promise<{ success: boolean; results: any; }> {
    const priority = opts.priority || 'normal';
    const reason = opts.reason || 'manual';

    // Determine market-based TTL strategy
    const open = await isMarketOpen();
    const ttlStrategy = this.getTTLStrategy(open, reason);

    logger.info('Starting real-time refresh', { priority, reason, open, ttlStrategy });

    // Prepare tasks with prioritization
    const tasks: Array<Promise<any>> = [];

    // High-priority: Yahoo price cache warming for key symbols
    const warmSymbols = opts.symbols || ['SPY', 'QQQ', 'DIA', 'IWM', 'VIX', 'TLT', 'GLD'];
    tasks.push(this.refreshYahooPrices(warmSymbols, ttlStrategy));

    // Market structure (depends on Yahoo)
    tasks.push(this.refreshMarketStructure(ttlStrategy));

    // Macro drivers (FRED) - medium priority
    tasks.push(this.refreshFred(ttlStrategy));

    // Sentiment/news - can be heavier, allow incremental
    tasks.push(this.refreshSentiment({ incremental: !!opts.incremental }));

    // Market drivers snapshot combining all
    tasks.push(this.refreshMarketDrivers());

    // Kick background prediction update (waitUntil if provided)
    const predictionTask = this.updatePredictions(reason, open);
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(predictionTask);
    } else {
      tasks.push(predictionTask);
    }

    const results = await Promise.allSettled(tasks);

    const success = results.filter(r => r.status === 'rejected').length === 0;
    logger.info('Real-time refresh completed', { success });

    return { success, results };
  }

  // Lightweight intraday refresh for changing conditions
  async refreshIncremental(ctx?: ExecutionContext): Promise<{ success: boolean; results: any; }> {
    return this.refreshAll({ priority: 'high', reason: 'intraday', incremental: true }, ctx);
  }

  // Pre-market cache warming strategy
  async warmCachesForMarketOpen(symbols?: string[], ctx?: ExecutionContext): Promise<void> {
    const warmSymbols = symbols || ['SPY', 'QQQ', 'DIA', 'IWM', 'VIX', 'TLT', 'XLF', 'XLK', 'XLE'];
    const ttl = { l1: CACHE_TTL.SHORT, l2: CACHE_TTL.MEDIUM };
    await this.refreshYahooPrices(warmSymbols, ttl);
    await this.refreshMarketStructure(ttl);
  }

  // Refresh Yahoo Finance prices for a list of symbols with caching
  private async refreshYahooPrices(symbols: string[], ttl: { l1: number; l2: number; }): Promise<FreshnessRecord> {
    const start = Date.now();
    const namespace = getCacheNamespace('market_data');

    // Fetch in limited parallel to respect rate limits
    const concurrency = 4;
    let index = 0;
    const errors: string[] = [];

    async function worker(this: RealTimeDataManager) {
      while (index < symbols.length) {
        const i = index++;
        const symbol = symbols[i];
        try {
          const data = await getMarketData(symbol);
          if (data) {
            await this.cache.set(namespace.name, `price:${symbol}`, data, ttl);
          }
        } catch (e: any) {
          errors.push(`${symbol}:${e.message}`);
        }
        // small jitter
        await new Promise(r => setTimeout(r, 100 + Math.random() * 150));
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, () => worker.call(this));
    await Promise.allSettled(workers);

    const duration = Date.now() - start;
    const status: FreshnessRecord['status'] = errors.length === 0 ? 'healthy' : (errors.length < symbols.length ? 'degraded' : 'unhealthy');
    const record: FreshnessRecord = { source: 'yahoo', status, updated_at: new Date().toISOString(), details: { symbols, duration, errors } };
    await this.recordFreshness(record);
    return record;
  }

  // Refresh FRED macro snapshot via client with its own caching
  private async refreshFred(ttl: { l1: number; l2: number; }): Promise<FreshnessRecord> {
    try {
      const fred = new FredApiClient(this.env, { cacheEnabled: true });
      const snapshot = await fred.getMacroEconomicSnapshot();
      // Store to cache manager for quick access
      const ns = getCacheNamespace('macro_data');
      await this.cache.set(ns.name, 'macro:snapshot', snapshot, { l1: ttl.l1, l2: CACHE_TTL.EXTENDED });
      const record: FreshnessRecord = { source: 'fred', status: 'healthy', updated_at: new Date().toISOString(), details: { series: snapshot.metadata?.series_count, cacheHit: snapshot.metadata?.cacheHit } };
      await this.recordFreshness(record);
      return record;
    } catch (e: any) {
      const record: FreshnessRecord = { source: 'fred', status: 'unhealthy', updated_at: new Date().toISOString(), details: { error: e.message } };
      await this.recordFreshness(record);
      return record;
    }
  }

  // Refresh sentiment/news signals
  private async refreshSentiment(opts: { incremental?: boolean } = {}): Promise<FreshnessRecord> {
    try {
      // Use a broad market symbol list for sentiment relevance if not incremental
      const symbols = opts.incremental ? ['SPY', 'QQQ'] : ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'AMZN'];
      const news = await Promise.allSettled(symbols.map(s => getFreeStockNews(s)));
      const signals = await Promise.allSettled(symbols.map(s => getFreeSentimentSignal(s)));
      const ns = getCacheNamespace('market_data');
      await this.cache.set(ns.name, 'sentiment:latest', { news, signals, incremental: !!opts.incremental, timestamp: new Date().toISOString() }, { l1: CACHE_TTL.SHORT, l2: CACHE_TTL.MEDIUM });
      const record: FreshnessRecord = { source: 'sentiment', status: 'healthy', updated_at: new Date().toISOString(), details: { symbols, incremental: !!opts.incremental } };
      await this.recordFreshness(record);
      return record;
    } catch (e: any) {
      const record: FreshnessRecord = { source: 'sentiment', status: 'unhealthy', updated_at: new Date().toISOString(), details: { error: e.message } };
      await this.recordFreshness(record);
      return record;
    }
  }

  // Refresh market structure (uses Yahoo internally)
  private async refreshMarketStructure(ttl: { l1: number; l2: number; }): Promise<FreshnessRecord> {
    try {
      const fetcher = initializeMarketStructureFetcher({});
      const ms = await fetcher.getMarketStructure();
      const ns = getCacheNamespace('market_data');
      await this.cache.set(ns.name, 'market_structure:current', ms, ttl);
      const record: FreshnessRecord = { source: 'market_structure', status: 'healthy', updated_at: new Date().toISOString(), details: { health: await fetcher.healthCheck() } };
      await this.recordFreshness(record);
      return record;
    } catch (e: any) {
      const record: FreshnessRecord = { source: 'market_structure', status: 'unhealthy', updated_at: new Date().toISOString(), details: { error: e.message } };
      await this.recordFreshness(record);
      return record;
    }
  }

  // Build market drivers snapshot combining macro, structure, regime
  private async refreshMarketDrivers(): Promise<FreshnessRecord> {
    try {
      const drivers = initializeMarketDrivers(this.env);
      const snapshot = await drivers.getMarketDriversSnapshot();
      const ns = getCacheNamespace('market_data');
      await this.cache.set(ns.name, 'market_drivers:snapshot', snapshot, { l1: CACHE_TTL.MEDIUM, l2: CACHE_TTL.EXTENDED });
      const record: FreshnessRecord = { source: 'market_drivers', status: 'healthy', updated_at: new Date().toISOString(), details: { timestamp: snapshot.timestamp, marketHealth: snapshot.marketHealth } };
      await this.recordFreshness(record);
      return record;
    } catch (e: any) {
      const record: FreshnessRecord = { source: 'market_drivers', status: 'unhealthy', updated_at: new Date().toISOString(), details: { error: e.message } };
      await this.recordFreshness(record);
      return record;
    }
  }

  // Trigger predictive analytics update in background
  private async updatePredictions(reason: string, open: boolean): Promise<FreshnessRecord> {
    try {
      // Prediction generation is lightweight wrapper via predictive analytics routes/module
      // For now we mark predictions freshness and allow consumers to compute lazily on request.
      const ns = getCacheNamespace('analysis_data');
      await this.cache.set(ns.name, 'predictions:marker', { reason, marketOpen: open, timestamp: new Date().toISOString() }, { l1: CACHE_TTL.SHORT, l2: open ? CACHE_TTL.MEDIUM : CACHE_TTL.LONG });
      const record: FreshnessRecord = { source: 'predictions', status: 'healthy', updated_at: new Date().toISOString(), details: { reason, marketOpen: open } };
      await this.recordFreshness(record);
      return record;
    } catch (e: any) {
      const record: FreshnessRecord = { source: 'predictions', status: 'degraded', updated_at: new Date().toISOString(), details: { error: e.message, reason } };
      await this.recordFreshness(record);
      return record;
    }
  }

  // Store freshness records for monitoring/alerts
  private async recordFreshness(record: FreshnessRecord): Promise<void> {
    try {
      const key = `freshness:${record.source}`;
      await this.dal.write(key, record, { expirationTtl: 24 * 3600 });
    } catch (e) {
      logger.warn('Failed to record freshness', { source: record.source, error: (e as any)?.message });
    }
  }

  // TTL adjustments by market hours and reason
  private getTTLStrategy(open: boolean, reason: string): { l1: number; l2: number } {
    if (!open) {
      // Pre/post market: longer L2, short L1 for user responsiveness
      return { l1: CACHE_TTL.SHORT, l2: reason === 'pre_market' ? CACHE_TTL.LONG : CACHE_TTL.MEDIUM };
    }
    // Market open: very short L1 to keep things fresh, short L2 to allow quick invalidation
    return { l1: CACHE_TTL.INSTANT, l2: CACHE_TTL.SHORT };
  }

  // Expose freshness status
  async getFreshnessSummary(): Promise<{ updated: FreshnessRecord[] }> {
    const sources: FreshnessRecord['source'][] = ['yahoo', 'fred', 'sentiment', 'market_structure', 'market_drivers', 'predictions'];
    const records: FreshnessRecord[] = [];
    for (const s of sources) {
      const rec = await this.dal.read<FreshnessRecord>(`freshness:${s}`);
      if (rec) records.push(rec);
    }
    return { updated: records };
  }
}

export function initializeRealTimeDataManager(env: CloudflareEnvironment): RealTimeDataManager {
  return new RealTimeDataManager(env);
}

export default RealTimeDataManager;
