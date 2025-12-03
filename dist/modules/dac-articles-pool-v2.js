// DAC Articles Pool Client V2
// Updated for DAC v3.7.0+ Article Pool V2 architecture
// Uses Cloudflare service binding for direct Worker-to-Worker calls
/**
 * Client for accessing DAC Article Pool via Cloudflare service binding
 * Updated for DAC v3.7.0+ architecture
 */
export class DACArticlesPoolClientV2 {
    constructor(dacBackend, apiKey) {
        this.dacBackend = dacBackend;
        this.apiKey = apiKey;
    }
    /**
     * Get stock articles via service binding
     * Uses DAC admin probe endpoint: /api/admin/article-pool/probe/stock/:symbol
     */
    async getStockArticles(symbol) {
        try {
            const request = new Request(`https://dac-backend/api/admin/article-pool/probe/stock/${symbol}`, {
                method: 'GET',
                headers: {
                    'X-API-Key': this.apiKey,
                    'Content-Type': 'application/json',
                    'User-Agent': 'CCT-Service-Binding/2.0'
                }
            });
            const response = await this.dacBackend.fetch(request);
            if (!response.ok) {
                if (response.status === 404) {
                    return {
                        success: false,
                        articles: [],
                        error: 'NOT_FOUND',
                        errorMessage: `No articles found for ${symbol}`
                    };
                }
                throw new Error(`DAC API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            // DAC probe endpoint returns nested structure, extract accessor result
            if (data.accessorCall) {
                return {
                    success: data.accessorCall.success,
                    articles: data.accessorCall.articles || [],
                    metadata: data.accessorCall.metadata,
                    error: data.accessorCall.error,
                    errorMessage: data.accessorCall.errorMessage
                };
            }
            // Fallback to direct response format
            return {
                success: data.success || false,
                articles: data.articles || [],
                metadata: data.metadata,
                error: data.error,
                errorMessage: data.errorMessage
            };
        }
        catch (error) {
            console.error(`[DAC_POOL_V2] Failed to get articles for ${symbol}:`, error);
            return {
                success: false,
                articles: [],
                error: 'UNEXPECTED_ERROR',
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Get sector articles (v3.7.0+)
     * Uses DAC admin probe endpoint: /api/admin/article-pool/probe/sector/:sector
     */
    async getSectorArticles(sector) {
        try {
            const request = new Request(`https://dac-backend/api/admin/article-pool/probe/sector/${sector}`, {
                method: 'GET',
                headers: {
                    'X-API-Key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });
            const response = await this.dacBackend.fetch(request);
            if (!response.ok) {
                return {
                    success: false,
                    articles: [],
                    error: 'NOT_FOUND',
                    errorMessage: `No articles found for sector ${sector}`
                };
            }
            return await response.json();
        }
        catch (error) {
            console.error(`[DAC_POOL_V2] Failed to get sector articles for ${sector}:`, error);
            return {
                success: false,
                articles: [],
                error: 'UNEXPECTED_ERROR',
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Get all category articles (v3.7.0+)
     * Uses DAC admin probe endpoint: /api/admin/article-pool/probe/categories
     */
    async getCategoryArticles() {
        try {
            const request = new Request(`https://dac-backend/api/admin/article-pool/probe/categories`, {
                method: 'GET',
                headers: {
                    'X-API-Key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });
            const response = await this.dacBackend.fetch(request);
            if (!response.ok) {
                throw new Error(`DAC API error: ${response.status}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('[DAC_POOL_V2] Failed to get category articles:', error);
            return {
                success: false,
                categories: {
                    Geopolitical: { success: false, articles: [], error: 'UNEXPECTED_ERROR' },
                    Monetary: { success: false, articles: [], error: 'UNEXPECTED_ERROR' },
                    Economic: { success: false, articles: [], error: 'UNEXPECTED_ERROR' },
                    Market: { success: false, articles: [], error: 'UNEXPECTED_ERROR' }
                },
                fetchedAt: new Date().toISOString()
            };
        }
    }
    /**
     * Get pool health and quota status (v3.8.0+)
     * Uses DAC admin endpoint: /api/admin/article-pool/enhanced-status
     */
    async getEnhancedStatus() {
        try {
            const request = new Request(`https://dac-backend/api/admin/article-pool/enhanced-status`, {
                method: 'GET',
                headers: {
                    'X-API-Key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });
            const response = await this.dacBackend.fetch(request);
            if (!response.ok) {
                throw new Error(`DAC API error: ${response.status}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('[DAC_POOL_V2] Failed to get enhanced status:', error);
            return null;
        }
    }
    /**
     * Check if DAC pool is available and healthy
     */
    async checkHealth() {
        try {
            const request = new Request('https://dac-backend/health', {
                method: 'GET',
                headers: {
                    'X-API-Key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });
            const response = await this.dacBackend.fetch(request);
            return response.ok;
        }
        catch (error) {
            console.error('[DAC_POOL_V2] Health check failed:', error);
            return false;
        }
    }
}
/**
 * Create DAC articles pool client instance using service binding
 */
export function createDACArticlesPoolClientV2(env) {
    const dacBackend = env.DAC_BACKEND;
    const apiKey = env.DAC_ARTICLES_POOL_API_KEY || 'yanggf';
    if (!dacBackend) {
        console.warn('[DAC_POOL_V2] DAC backend service binding not available');
        return null;
    }
    return new DACArticlesPoolClientV2(dacBackend, apiKey);
}
/**
 * Calculate confidence penalty based on article pool quality
 */
export function calculateConfidencePenalty(articleCount, freshCount, isStale) {
    let penalty = 0;
    // Penalty for stale data
    if (isStale)
        penalty -= 15;
    // Penalty for low fresh article count
    if (freshCount < 3)
        penalty -= 10;
    // Penalty for low total article count
    if (articleCount < 3)
        penalty -= 20;
    return penalty;
}
/**
 * Integration adapter for existing CCT sentiment pipeline
 */
export class DACArticlesAdapterV2 {
    constructor(env) {
        this.client = createDACArticlesPoolClientV2(env);
    }
    /**
     * Get articles for sentiment analysis
     */
    async getArticlesForSentiment(symbol) {
        if (!this.client) {
            return {
                articles: [],
                source: 'fallback',
                confidencePenalty: -20 // Penalty for no DAC integration
            };
        }
        const poolResult = await this.client.getStockArticles(symbol);
        if (poolResult.success && poolResult.articles.length > 0) {
            // Calculate confidence penalty based on DAC data quality
            const penalty = calculateConfidencePenalty(poolResult.articles.length, poolResult.metadata?.freshCount || 0, poolResult.metadata?.stale || false);
            return {
                articles: poolResult.articles,
                source: 'dac_pool',
                confidencePenalty: penalty,
                metadata: poolResult.metadata
            };
        }
        return {
            articles: [],
            source: 'fallback',
            confidencePenalty: -10 // Small penalty for pool miss
        };
    }
    /**
     * Check if DAC integration is healthy
     */
    async isHealthy() {
        if (!this.client)
            return false;
        return await this.client.checkHealth();
    }
}
//# sourceMappingURL=dac-articles-pool-v2.js.map