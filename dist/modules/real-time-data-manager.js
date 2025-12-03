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
import { DOCacheAdapter } from './do-cache-adapter.js';
import { CACHE_TTL, getCacheNamespace } from './cache-config.js';
import { initializeMarketDrivers } from './market-drivers.js';
import { initializeMarketStructureFetcher } from './market-structure-fetcher.js';
import FredApiClient from './fred-api-client.js';
import { getMarketData, isMarketOpen } from './yahoo-finance-integration.js';
import { getFreeSentimentSignal, getFreeStockNews } from './free_sentiment_pipeline.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
const logger = createLogger('real-time-data-manager');
export class RealTimeDataManager {
    constructor(env) {
        this.env = env;
        this.cache = new DOCacheAdapter(env);
        this.dal = createSimplifiedEnhancedDAL(env);
    }
    // Orchestrate all sources refresh in parallel with prioritization
    async refreshAll(opts = {}, ctx) {
        const priority = opts.priority || 'normal';
        const reason = opts.reason || 'manual';
        // Determine market-based TTL strategy
        const open = await isMarketOpen();
        const ttlStrategy = this.getTTLStrategy(open, reason);
        logger.info('Starting real-time refresh', { priority, reason, open, ttlStrategy });
        // Prepare tasks with prioritization
        const tasks = [];
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
        }
        else {
            tasks.push(predictionTask);
        }
        const results = await Promise.allSettled(tasks);
        const success = results.filter(r => r.status === 'rejected').length === 0;
        logger.info('Real-time refresh completed', { success });
        return { success, results };
    }
    // Lightweight intraday refresh for changing conditions
    async refreshIncremental(ctx) {
        return this.refreshAll({ priority: 'high', reason: 'intraday', incremental: true }, ctx);
    }
    // Pre-market cache warming strategy
    async warmCachesForMarketOpen(symbols, ctx) {
        const warmSymbols = symbols || ['SPY', 'QQQ', 'DIA', 'IWM', 'VIX', 'TLT', 'XLF', 'XLK', 'XLE'];
        const ttl = { l1: CACHE_TTL.SHORT, l2: CACHE_TTL.MEDIUM };
        await this.refreshYahooPrices(warmSymbols, ttl);
        await this.refreshMarketStructure(ttl);
    }
    // Refresh Yahoo Finance prices for a list of symbols with caching
    async refreshYahooPrices(symbols, ttl) {
        const start = Date.now();
        const namespace = getCacheNamespace('market_data');
        // Fetch in limited parallel to respect rate limits
        const concurrency = 4;
        let index = 0;
        const errors = [];
        async function worker() {
            while (index < symbols.length) {
                const i = index++;
                const symbol = symbols[i];
                try {
                    const data = await getMarketData(symbol);
                    if (data) {
                        await this.cache.set(namespace.name, `price:${symbol}`, data, ttl);
                    }
                }
                catch (e) {
                    errors.push(`${symbol}:${e.message}`);
                }
                // small jitter
                await new Promise(r => setTimeout(r, 100 + Math.random() * 150));
            }
        }
        const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, () => worker.call(this));
        await Promise.allSettled(workers);
        const duration = Date.now() - start;
        const status = errors.length === 0 ? 'healthy' : (errors.length < symbols.length ? 'degraded' : 'unhealthy');
        const record = { source: 'yahoo', status, updated_at: new Date().toISOString(), details: { symbols, duration, errors } };
        await this.recordFreshness(record);
        return record;
    }
    // Refresh FRED macro snapshot via client with its own caching
    async refreshFred(ttl) {
        try {
            const fred = new FredApiClient({ apiKey: this.env.FRED_API_KEY });
            const snapshot = await fred.getMacroEconomicSnapshot();
            // Store to cache manager for quick access
            const ns = getCacheNamespace('macro_data');
            await this.cache.set(ns.name, 'macro:snapshot', snapshot, { l1: ttl.l1, l2: CACHE_TTL.EXTENDED });
            const record = { source: 'fred', status: 'healthy', updated_at: new Date().toISOString(), details: { series: snapshot.metadata?.seriesCount, cacheHit: snapshot.metadata?.cacheHit } };
            await this.recordFreshness(record);
            return record;
        }
        catch (e) {
            const record = { source: 'fred', status: 'unhealthy', updated_at: new Date().toISOString(), details: { error: e.message } };
            await this.recordFreshness(record);
            return record;
        }
    }
    // Refresh sentiment/news signals
    async refreshSentiment(opts = {}) {
        try {
            // Use a broad market symbol list for sentiment relevance if not incremental
            const symbols = opts.incremental ? ['SPY', 'QQQ'] : ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'AMZN'];
            const news = await Promise.allSettled(symbols.map(s => getFreeStockNews(s, this.env)));
            const signals = await Promise.allSettled(symbols.map(s => getFreeSentimentSignal(s, this.env)));
            const ns = getCacheNamespace('market_data');
            await this.cache.set(ns.name, 'sentiment:latest', { news, signals, incremental: !!opts.incremental, timestamp: new Date().toISOString() }, { l1: CACHE_TTL.SHORT, l2: CACHE_TTL.MEDIUM });
            const record = { source: 'sentiment', status: 'healthy', updated_at: new Date().toISOString(), details: { symbols, incremental: !!opts.incremental } };
            await this.recordFreshness(record);
            return record;
        }
        catch (e) {
            const record = { source: 'sentiment', status: 'unhealthy', updated_at: new Date().toISOString(), details: { error: e.message } };
            await this.recordFreshness(record);
            return record;
        }
    }
    // Refresh market structure (uses Yahoo internally)
    async refreshMarketStructure(ttl) {
        try {
            const fetcher = initializeMarketStructureFetcher({
                environment: this.env,
                enableCaching: true
            });
            const ms = await fetcher.fetchMarketStructure();
            const ns = getCacheNamespace('market_data');
            await this.cache.set(ns.name, 'market_structure:current', ms, ttl);
            const record = { source: 'market_structure', status: 'healthy', updated_at: new Date().toISOString(), details: { health: await fetcher.healthCheck() } };
            await this.recordFreshness(record);
            return record;
        }
        catch (e) {
            const record = { source: 'market_structure', status: 'unhealthy', updated_at: new Date().toISOString(), details: { error: e.message } };
            await this.recordFreshness(record);
            return record;
        }
    }
    // Build market drivers snapshot combining macro, structure, regime
    async refreshMarketDrivers() {
        try {
            const drivers = initializeMarketDrivers(this.env);
            const snapshot = await drivers.getMarketDriversSnapshot();
            const ns = getCacheNamespace('market_data');
            await this.cache.set(ns.name, 'market_drivers:snapshot', snapshot, { l1: CACHE_TTL.MEDIUM, l2: CACHE_TTL.EXTENDED });
            const record = { source: 'market_drivers', status: 'healthy', updated_at: new Date().toISOString(), details: { timestamp: snapshot.timestamp, marketHealth: snapshot.marketHealth } };
            await this.recordFreshness(record);
            return record;
        }
        catch (e) {
            const record = { source: 'market_drivers', status: 'unhealthy', updated_at: new Date().toISOString(), details: { error: e.message } };
            await this.recordFreshness(record);
            return record;
        }
    }
    // Trigger predictive analytics update in background
    async updatePredictions(reason, open) {
        try {
            // Prediction generation is lightweight wrapper via predictive analytics routes/module
            // For now we mark predictions freshness and allow consumers to compute lazily on request.
            const ns = getCacheNamespace('analysis_data');
            await this.cache.set(ns.name, 'predictions:marker', { reason, marketOpen: open, timestamp: new Date().toISOString() }, { l1: CACHE_TTL.SHORT, l2: open ? CACHE_TTL.MEDIUM : CACHE_TTL.LONG });
            const record = { source: 'predictions', status: 'healthy', updated_at: new Date().toISOString(), details: { reason, marketOpen: open } };
            await this.recordFreshness(record);
            return record;
        }
        catch (e) {
            const record = { source: 'predictions', status: 'degraded', updated_at: new Date().toISOString(), details: { error: e.message, reason } };
            await this.recordFreshness(record);
            return record;
        }
    }
    // Store freshness records for monitoring/alerts
    async recordFreshness(record) {
        try {
            const key = `freshness:${record.source}`;
            await this.dal.write(key, record, { expirationTtl: 24 * 3600 });
        }
        catch (e) {
            logger.warn('Failed to record freshness', { source: record.source, error: e?.message });
        }
    }
    // TTL adjustments by market hours and reason
    getTTLStrategy(open, reason) {
        if (!open) {
            // Pre/post market: longer L2, short L1 for user responsiveness
            return { l1: CACHE_TTL.SHORT, l2: reason === 'pre_market' ? CACHE_TTL.LONG : CACHE_TTL.MEDIUM };
        }
        // Market open: very short L1 to keep things fresh, short L2 to allow quick invalidation
        return { l1: CACHE_TTL.INSTANT, l2: CACHE_TTL.SHORT };
    }
    // Expose freshness status
    async getFreshnessSummary() {
        const sources = ['yahoo', 'fred', 'sentiment', 'market_structure', 'market_drivers', 'predictions'];
        const records = [];
        for (const s of sources) {
            const rec = await this.dal.read(`freshness:${s}`);
            if (rec)
                records.push(rec);
        }
        return { updated: records };
    }
}
export function initializeRealTimeDataManager(env) {
    return new RealTimeDataManager(env);
}
export default RealTimeDataManager;
//# sourceMappingURL=real-time-data-manager.js.map