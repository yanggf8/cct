/**
 * Enhanced Sentiment Analysis Routes
 * Provides sentiment analysis with DAC articles pool integration
 */
import { Hono } from 'hono';
import { createEnhancedSentimentPipeline } from '../modules/enhanced-sentiment-pipeline.js';
import { logger } from '../modules/logger.js';
const app = new Hono();
/**
 * Enhanced sentiment analysis with DAC articles pool integration
 */
app.post('/enhanced', async (c) => {
    try {
        const { symbol, use_dac_integration = true } = await c.req.json();
        if (!symbol || typeof symbol !== 'string') {
            return c.json({
                error: 'Symbol is required and must be a string'
            }, 400);
        }
        // Validate symbol format
        if (!/^[A-Z]{1,5}$/.test(symbol.toUpperCase())) {
            return c.json({
                error: 'Invalid symbol format. Use stock tickers like AAPL, MSFT, etc.'
            }, 400);
        }
        const upperSymbol = symbol.toUpperCase();
        logger.info('ENHANCED_SENTIMENT_API', `Processing sentiment request`, {
            symbol: upperSymbol,
            use_dac_integration,
            user_agent: c.req.header('User-Agent')
        });
        // Create enhanced sentiment pipeline
        const pipeline = createEnhancedSentimentPipeline(c.env);
        // Perform sentiment analysis
        const result = await pipeline.analyzeSentiment(upperSymbol);
        logger.success('ENHANCED_SENTIMENT_API', `Analysis complete`, {
            symbol: upperSymbol,
            sentiment: result.sentiment,
            confidence: result.confidence,
            articleCount: result.article_count,
            sourcesUsed: result.sources_used
        });
        return c.json({
            success: true,
            data: result,
            metadata: {
                symbol: upperSymbol,
                analyzed_at: new Date().toISOString(),
                dac_integration_enabled: use_dac_integration,
                cache_backend: 'durable_objects'
            }
        });
    }
    catch (error) {
        logger.error('ENHANCED_SENTIMENT_API', 'Analysis failed', {
            error: error instanceof Error ? error.message : 'Unknown',
            stack: error instanceof Error ? error.stack : undefined
        });
        return c.json({
            success: false,
            error: 'Sentiment analysis failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});
/**
 * Batch sentiment analysis for multiple symbols
 */
app.post('/batch', async (c) => {
    try {
        const { symbols, use_dac_integration = true } = await c.req.json();
        if (!Array.isArray(symbols) || symbols.length === 0) {
            return c.json({
                error: 'Symbols array is required and must not be empty'
            }, 400);
        }
        // Limit batch size
        if (symbols.length > 10) {
            return c.json({
                error: 'Batch size limited to 10 symbols per request'
            }, 400);
        }
        // Validate each symbol
        const invalidSymbols = symbols.filter(s => typeof s !== 'string' || !/^[A-Z]{1,5}$/.test(s.toUpperCase()));
        if (invalidSymbols.length > 0) {
            return c.json({
                error: `Invalid symbols: ${invalidSymbols.join(', ')}. Use stock tickers like AAPL, MSFT, etc.`
            }, 400);
        }
        const upperSymbols = symbols.map(s => s.toUpperCase());
        logger.info('ENHANCED_SENTIMENT_API', `Processing batch sentiment request`, {
            symbolCount: upperSymbols.length,
            symbols: upperSymbols,
            use_dac_integration
        });
        // Create pipeline
        const pipeline = createEnhancedSentimentPipeline(c.env);
        // Process in parallel with concurrency limit
        const concurrencyLimit = 3;
        const results = [];
        for (let i = 0; i < upperSymbols.length; i += concurrencyLimit) {
            const batch = upperSymbols.slice(i, i + concurrencyLimit);
            const batchPromises = batch.map(async (symbol) => {
                try {
                    const result = await pipeline.analyzeSentiment(symbol);
                    return { symbol, success: true, data: result };
                }
                catch (error) {
                    logger.error('ENHANCED_SENTIMENT_API', `Batch analysis failed for ${symbol}`, {
                        error: error instanceof Error ? error.message : 'Unknown'
                    });
                    return {
                        symbol,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach((promiseResult) => {
                if (promiseResult.status === 'fulfilled') {
                    results.push(promiseResult.value);
                }
                else {
                    logger.error('ENHANCED_SENTIMENT_API', 'Batch promise rejected', {
                        error: promiseResult.reason
                    });
                }
            });
        }
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        logger.info('ENHANCED_SENTIMENT_API', `Batch analysis complete`, {
            total: results.length,
            success: successCount,
            failures: failureCount
        });
        return c.json({
            success: true,
            data: results,
            metadata: {
                analyzed_at: new Date().toISOString(),
                total_symbols: upperSymbols.length,
                successful_analyses: successCount,
                failed_analyses: failureCount,
                dac_integration_enabled: use_dac_integration,
                cache_backend: 'durable_objects'
            }
        });
    }
    catch (error) {
        logger.error('ENHANCED_SENTIMENT_API', 'Batch analysis failed', {
            error: error instanceof Error ? error.message : 'Unknown'
        });
        return c.json({
            success: false,
            error: 'Batch sentiment analysis failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});
/**
 * Health check for enhanced sentiment system
 */
app.get('/health', async (c) => {
    try {
        const pipeline = createEnhancedSentimentPipeline(c.env);
        const health = await pipeline.checkHealth();
        const overallHealthy = health.dac_pool && health.cache &&
            (health.fmp_available || health.newsapi_available);
        return c.json({
            success: true,
            healthy: overallHealthy,
            components: {
                dac_articles_pool: {
                    status: health.dac_pool ? 'healthy' : 'unhealthy',
                    url: c.env.DAC_ARTICLES_POOL_URL || 'not_configured'
                },
                durable_objects_cache: {
                    status: health.cache ? 'healthy' : 'unhealthy',
                    backend: 'sqlite_persistent'
                },
                external_apis: {
                    fmp_available: health.fmp_available,
                    newsapi_available: health.newsapi_available
                }
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger.error('ENHANCED_SENTIMENT_API', 'Health check failed', {
            error: error instanceof Error ? error.message : 'Unknown'
        });
        return c.json({
            success: false,
            healthy: false,
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        }, 500);
    }
});
/**
 * Get configuration for enhanced sentiment analysis
 */
app.get('/config', async (c) => {
    try {
        return c.json({
            success: true,
            config: {
                dac_integration: {
                    enabled: true,
                    url: c.env.DAC_ARTICLES_POOL_URL || 'https://dac-backend.yanggf.workers.dev',
                    has_api_key: !!c.env.DAC_ARTICLES_POOL_API_KEY
                },
                cache: {
                    backend: 'durable_objects',
                    ttl_seconds: 3600,
                    stale_ttl_seconds: 1800
                },
                sources: {
                    dac_pool: { priority: 1, weight: 1.2, enabled: true },
                    fmp: { priority: 2, weight: 1.0, enabled: true },
                    newsapi: { priority: 3, weight: 0.8, enabled: true },
                    yahoo: { priority: 4, weight: 0.6, enabled: true }
                },
                limits: {
                    max_articles_per_analysis: 20,
                    max_batch_size: 10,
                    concurrent_analysis_limit: 3
                }
            }
        });
    }
    catch (error) {
        return c.json({
            success: false,
            error: 'Failed to get configuration'
        }, 500);
    }
});
export default app;
//# sourceMappingURL=enhanced-sentiment-routes.js.map