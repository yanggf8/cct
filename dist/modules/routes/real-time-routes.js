/**
 * Real-time Integration Routes
 * Manual controls and status for the Real-time Data Manager
 */
import { initializeRealTimeDataManager } from '../real-time-data-manager.js';
export function registerRealTimeRoutes(router) {
    // POST /api/v1/realtime/refresh - trigger full refresh
    router.post('/api/v1/realtime/refresh', async (request, env, ctx) => {
        try {
            const body = await request.json().catch(() => ({}));
            const rtdm = initializeRealTimeDataManager(env);
            const result = await rtdm.refreshAll({
                priority: body.priority || 'normal',
                reason: body.reason || 'manual',
                symbols: body.symbols,
                incremental: body.incremental === true
            }, ctx);
            return new Response(JSON.stringify({ success: true, result }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        catch (error) {
            return new Response(JSON.stringify({ success: false, error: (error instanceof Error ? error.message : String(error)) }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    });
    // POST /api/v1/realtime/warmup - warm caches for market open
    router.post('/api/v1/realtime/warmup', async (request, env, ctx) => {
        try {
            const body = await request.json().catch(() => ({}));
            const rtdm = initializeRealTimeDataManager(env);
            await rtdm.warmCachesForMarketOpen(body.symbols, ctx);
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        catch (error) {
            return new Response(JSON.stringify({ success: false, error: (error instanceof Error ? error.message : String(error)) }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    });
    // GET /api/v1/realtime/status - freshness summary
    router.get('/api/v1/realtime/status', async (_request, env) => {
        try {
            const rtdm = initializeRealTimeDataManager(env);
            const summary = await rtdm.getFreshnessSummary();
            return new Response(JSON.stringify({ success: true, ...summary }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        catch (error) {
            return new Response(JSON.stringify({ success: false, error: (error instanceof Error ? error.message : String(error)) }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    });
}
//# sourceMappingURL=real-time-routes.js.map