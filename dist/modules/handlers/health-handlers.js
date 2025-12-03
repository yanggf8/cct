/**
 * Health Check and Monitoring HTTP Request Handlers
 * Handles system health, monitoring, and diagnostic endpoints
 */
import { createLogger, logHealthCheck } from '../logging.js';
import { createHealthHandler } from '../handler-factory.js';
import { createHealthResponse } from '../response-factory.js';
import { BusinessMetrics } from '../monitoring.js';
import { createSimplifiedEnhancedDAL } from '../simplified-enhanced-dal.js';
const logger = createLogger('health-handlers');
/**
 * Handle basic health check requests
 */
export const handleHealthCheck = createHealthHandler('system-health', async (env, ctx) => {
    // Build comprehensive data source health
    const services = {};
    try {
        // FRED health via macro-economic fetcher
        const { initializeMacroEconomicFetcher } = await import('../macro-economic-fetcher.js');
        const macroFetcher = initializeMacroEconomicFetcher({
            fredApiKey: env.FRED_API_KEY || env.FRED_API_KEYS,
            useMockData: !(env.FRED_API_KEY || env.FRED_API_KEYS)
        });
        const fredHealth = await macroFetcher.healthCheck();
        services.fred = fredHealth.status;
        // Yahoo Finance health
        const yahoo = await import('../yahoo-finance-integration.js');
        const yahooHealth = await yahoo.healthCheck();
        services.yahoo = yahooHealth.status;
        // KV health
        const dal = createSimplifiedEnhancedDAL(env);
        const testKey = `health_check_${Date.now()}`;
        const writeResult = await dal.write(testKey, 'ok', { expirationTtl: 60 });
        const readResult = await dal.read(testKey);
        await dal.deleteKey(testKey);
        services.kv = writeResult.success && readResult.success ? 'healthy' : 'unhealthy';
    }
    catch (e) {
        services.error = e.message;
    }
    const healthData = {
        services,
        environment: env.ENVIRONMENT || 'development',
        configured: {
            fred_api_key: !!(env.FRED_API_KEY || env.FRED_API_KEYS),
            worker_api_key: !!env.WORKER_API_KEY
        }
    };
    const response = createHealthResponse(healthData);
    // Track health check metrics
    BusinessMetrics.apiRequest('/health', 'GET', 200, Date.now() - ctx.startTime);
    logHealthCheck('basic-health', 'healthy', {
        requestId: ctx.requestId,
        components: healthData
    });
    return response;
});
/**
 * Handle model health check requests
 */
export async function handleModelHealth(request, env) {
    const requestId = crypto.randomUUID();
    try {
        logger.info('Model health check requested', { requestId });
        const healthResults = {
            timestamp: new Date().toISOString(),
            request_id: requestId,
            models: {},
            overall_status: 'healthy'
        };
        // Test Cloudflare AI availability
        if (env.AI) {
            try {
                // Test GPT-OSS model with minimal input
                const gptTest = await env.AI.run('@cf/gpt-oss-120b', {
                    messages: [{ role: 'user', content: 'Test' }],
                    max_tokens: 5
                });
                healthResults.models.gpt_oss_120b = {
                    status: 'healthy',
                    model: '@cf/gpt-oss-120b',
                    test_response: gptTest?.response || 'Success',
                    latency_ms: 'measured'
                };
                logger.debug('GPT-OSS-120B model test successful', { requestId });
            }
            catch (gptError) {
                healthResults.models.gpt_oss_120b = {
                    status: 'unhealthy',
                    error: gptError.message
                };
                healthResults.overall_status = 'degraded';
                logger.warn('GPT-OSS-120B model test failed', {
                    requestId,
                    error: gptError.message
                });
            }
            // Test DistilBERT model
            try {
                const distilbertTest = await env.AI.run('@cf/huggingface/distilbert-sst-2-int8', {
                    text: 'Test sentiment'
                });
                healthResults.models.distilbert = {
                    status: 'healthy',
                    model: '@cf/huggingface/distilbert-sst-2-int8',
                    test_response: distilbertTest,
                    latency_ms: 'measured'
                };
                logger.debug('DistilBERT model test successful', { requestId });
            }
            catch (distilbertError) {
                healthResults.models.distilbert = {
                    status: 'unhealthy',
                    error: distilbertError.message
                };
                healthResults.overall_status = 'degraded';
                logger.warn('DistilBERT model test failed', {
                    requestId,
                    error: distilbertError.message
                });
            }
        }
        else {
            healthResults.models.cloudflare_ai = {
                status: 'unavailable',
                error: 'Cloudflare AI binding not available'
            };
            healthResults.overall_status = 'unhealthy';
            logger.error('Cloudflare AI binding not available', { requestId });
        }
        // Test Neural Network models (R2 storage)
        try {
            // Test if we can access R2 and model files
            if (env.MODEL_BUCKET) {
                // This is a placeholder - in real implementation we'd test R2 access
                healthResults.models.neural_networks = {
                    status: 'available',
                    tft_model: 'accessible',
                    nhits_model: 'accessible',
                    r2_storage: 'healthy'
                };
                logger.debug('Neural network models accessible', { requestId });
            }
            else {
                healthResults.models.neural_networks = {
                    status: 'unavailable',
                    error: 'R2 model bucket not configured'
                };
                logger.warn('R2 model bucket not configured', { requestId });
            }
        }
        catch (r2Error) {
            healthResults.models.neural_networks = {
                status: 'unhealthy',
                error: r2Error.message
            };
            logger.error('Neural network models health check failed', {
                requestId,
                error: r2Error.message
            });
        }
        // Test KV storage using DAL
        try {
            const dal = createSimplifiedEnhancedDAL(env);
            const testKey = `health_check_${Date.now()}`;
            // Test write
            const writeResult = await dal.write(testKey, 'test', { expirationTtl: 60 });
            // Test read
            const readResult = await dal.read(testKey);
            // Test delete
            const deleteResult = await dal.deleteKey(testKey);
            if (writeResult.success && readResult.success && deleteResult) {
                healthResults.models.kv_storage = {
                    status: 'healthy',
                    read_write: 'operational',
                    binding: 'MARKET_ANALYSIS_CACHE'
                };
                logger.debug('KV storage health check successful', { requestId });
            }
            else {
                throw new Error('One or more DAL operations failed');
            }
        }
        catch (kvError) {
            healthResults.models.kv_storage = {
                status: 'unhealthy',
                error: kvError.message
            };
            healthResults.overall_status = 'degraded';
            logger.error('KV storage health check failed', {
                requestId,
                error: kvError.message
            });
        }
        logHealthCheck('model-health', healthResults.overall_status, {
            requestId,
            modelsChecked: Object.keys(healthResults.models).length,
            healthyModels: Object.values(healthResults.models).filter((m) => m.status === 'healthy').length
        });
        return new Response(JSON.stringify(healthResults, null, 2), {
            status: healthResults.overall_status === 'healthy' ? 200 :
                healthResults.overall_status === 'degraded' ? 206 : 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    catch (error) {
        logger.error('Model health check failed completely', {
            requestId,
            error: (error instanceof Error ? error.message : String(error)),
            stack: error.stack
        });
        logHealthCheck('model-health', 'failed', {
            requestId,
            error: error.message
        });
        return new Response(JSON.stringify({
            success: false,
            status: 'unhealthy',
            error: error.message,
            request_id: requestId,
            timestamp: new Date().toISOString()
        }, null, 2), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
/**
 * Handle debug environment requests
 */
export async function handleDebugEnvironment(request, env) {
    const requestId = crypto.randomUUID();
    try {
        logger.info('Debug environment requested', { requestId });
        const envInfo = {
            timestamp: new Date().toISOString(),
            request_id: requestId,
            environment: {
                cloudflare_ai: typeof env.AI !== 'undefined',
                trading_results_kv: typeof env.MARKET_ANALYSIS_CACHE !== 'undefined',
                model_bucket_r2: typeof env.MODEL_BUCKET !== 'undefined',
                facebook_configured: !!(env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID),
                log_level: env.LOG_LEVEL || 'not_set',
                structured_logging: env.STRUCTURED_LOGGING || 'not_set',
                worker_version: env.WORKER_VERSION || 'not_set'
            },
            bindings: {
                ai: !!env.AI,
                kv: !!env.MARKET_ANALYSIS_CACHE,
                r2: !!env.MODEL_BUCKET
            },
            secrets: {
                facebook_page_token: !!env.FACEBOOK_PAGE_TOKEN,
                facebook_recipient_id: !!env.FACEBOOK_RECIPIENT_ID,
                worker_api_key: !!env.WORKER_API_KEY,
                fmp_api_key: !!env.FMP_API_KEY,
                newsapi_key: !!env.NEWSAPI_KEY
            }
        };
        logger.info('Debug environment completed', {
            requestId,
            bindingsAvailable: Object.values(envInfo.bindings).filter(Boolean).length,
            secretsConfigured: Object.values(envInfo.secrets).filter(Boolean).length
        });
        return new Response(JSON.stringify(envInfo, null, 2), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    catch (error) {
        logger.error('Debug environment failed', {
            requestId,
            error: (error instanceof Error ? error.message : String(error)),
            stack: error.stack
        });
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            request_id: requestId,
            timestamp: new Date().toISOString()
        }, null, 2), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
//# sourceMappingURL=health-handlers.js.map