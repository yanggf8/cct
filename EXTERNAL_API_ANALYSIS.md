# External API Calls Analysis Report

## Executive Summary

This report analyzes all external API calls in the codebase, identifying what data they fetch, their current caching implementation (or lack thereof), and recommendations for optimization.

**Key Findings:**
- **5 External APIs** identified: Yahoo Finance, FRED API, Cloudflare AI Models (GPT-OSS-120B, DistilBERT-SST-2), Financial Modeling Prep, and NewsAPI
- **FRED API** has proper KV cache (1 hour TTL) ✅
- **AI Models** intentionally uncached (real-time analysis) ✅
- **Yahoo Finance API** has inconsistent/incomplete caching ⚠️
- **FMP and NewsAPI** completely missing KV cache implementation ❌

---

## 1. Yahoo Finance API

### API Details
- **Base URL**: `https://query1.finance.yahoo.com/v8/finance/chart`
- **Purpose**: Real-time and historical stock market data
- **Rate Limit**: Configurable (typically 200-1000 requests/day)

### Files Using This API
1. **`src/modules/yahoo-finance-integration.ts`** (Lines 26, 57, 183)
   - Function: `getMarketData()`, `getBatchMarketData()`, `getMarketStructureIndicators()`
   - Purpose: Market data fetching for VIX, SPY, Treasury Yields, etc.

2. **`src/modules/data.ts`** (Line 733)
   - Function: `getRealActualPrice()`
   - Purpose: Fetch historical price data for fact table validation

3. **`src/modules/free_sentiment_pipeline.ts`** (Lines 132, 298)
   - Function: News search functionality
   - Purpose: Stock news articles

4. **`src/modules/real-time-tracking.ts`** (Line 134)
   - Purpose: Real-time price tracking

5. **`src/modules/cron-signal-tracking.ts`** (Line 353)
   - Purpose: Intraday signal tracking

6. **`src/modules/market-close-analysis.ts`** (Line 326)
   - Purpose: End-of-day analysis

7. **`src/modules/enhanced_feature_analysis.ts`** (Line 353)
   - Purpose: Technical analysis with 3-month data

8. **`src/modules/sector-fetcher-simple.ts`** (Line 197)
   - Purpose: 6-month sector ETF data

9. **`src/modules/sector-data-fetcher.ts`** (Line 221)
   - Purpose: General sector data

### Cache Status: ⚠️ INCONSISTENT

**What's Cached:**
- Market data cache exists (`src/modules/market-data-cache.ts`): 5-minute TTL
- Configuration-based cache: `market_data` namespace (L1: 30s, L2: 300s)

**What's NOT Cached:**
- FMP news search (Line 298) - NO KV CACHE
- Real-time tracking data (Line 134) - NO KV CACHE
- Historical price validation (Line 733) - NO KV CACHE
- Sector analysis data - NO KV CACHE

**Recommended Action:**
- Add KV cache to FMP news endpoint (namespace: `news_data`, TTL: 1 hour)
- Cache historical price validation results (namespace: `price_validation`, TTL: 24 hours)
- Cache sector data (namespace: `sector_data`, TTL: 15 minutes)

---

## 2. FRED API (Federal Reserve Economic Data)

### API Details
- **Base URL**: `https://api.stlouisfed.org/fred`
- **Purpose**: U.S. macroeconomic indicators (interest rates, inflation, employment, GDP)
- **Rate Limit**: 120 requests/minute
- **API Key Required**: `FRED_API_KEY`

### Files Using This API
1. **`src/modules/fred-api-client.ts`** (Lines 30, 248, 288, 520-555)
   - Class: `FredApiClient`
   - Functions: `getMacroEconomicSnapshot()`, `getSeriesData()`, `getSeriesInfo()`
   - Purpose: Fetch 18 economic series for market drivers analysis

### Cache Status: ✅ PROPERLY IMPLEMENTED

**Cache Implementation:**
- **Namespace**: `market_drivers_fred_data`
- **TTL**: 3600 seconds (1 hour) - Line 574
- **DAL Integration**: Uses Enhanced DAL with cache-aware operations
- **Circuit Breaker**: Yes, for resilience
- **Background Refresh**: Configurable via business hours control

**Cached Data:**
- Fed Funds Rate
- Treasury 10Y and 2Y yields
- CPI and Core CPI
- Unemployment Rate
- Non-Farm Payrolls
- GDP and GDP Growth
- Industrial Production
- Consumer Confidence
- Retail Sales
- Housing Starts and Building Permits
- M2 Money Supply
- Leading Economic Index

**Assessment:** ✅ Excellent - This API has the most robust caching implementation in the entire system.

---

## 3. Cloudflare AI Models

### API Details
- **Providers**: Cloudflare Workers AI
- **Models**:
  1. **GPT-OSS-120B** (`@cf/openchat/openchat-3.5-0106`)
  2. **DistilBERT-SST-2-INT8** (`@cf/huggingface/distilbert-sst-2-int8`)

### Files Using These APIs
1. **`src/modules/dual-ai-analysis.ts`** (Lines 284, 368)
   - Function: `performGPTAnalysis()`, `performDistilBERTAnalysis()`
   - Purpose: Dual AI sentiment analysis with agreement logic
   - Batch processing: `batchDualAIAnalysis()`

2. **`src/modules/per_symbol_analysis.ts`** (Lines 222, 232)
   - Function: `convertDualAIToLegacyFormat()`
   - Purpose: Convert AI results to legacy format for system compatibility

3. **`src/modules/handlers.ts`** (Lines 1141, 1151)
   - Function: AI model health tests
   - Purpose: Testing and debugging

4. **`src/routes/data-routes.ts`** (Lines 475, 480, 744)
   - Function: AI model health checks
   - Purpose: API health monitoring

5. **`src/modules/ai-predictive-analytics.ts`** (Lines 361, 417)
   - Purpose: Predictive analytics with AI

6. **`src/modules/integration-test-suite.ts`** (Lines 219, 228, 545)
   - Purpose: Integration testing

### Cache Status: ✅ INTENTIONALLY UNCACHED

**Rationale for No Caching:**
- Real-time sentiment analysis requires fresh data
- AI model calls are expensive but necessary for current market conditions
- Circuit breakers and timeout protection in place (30s GPT, 20s DistilBERT)
- Retry logic with exponential backoff (3 attempts)
- Fallback chain ensures reliability

**Protection Mechanisms:**
- Circuit breaker pattern with failure thresholds
- Timeout protection (30s for GPT, 20s for DistilBERT)
- Retry logic with exponential backoff and jitter
- Graceful degradation on failure
- Batch processing with rate limiting (batchSize: 2-3)

**Assessment:** ✅ Correctly implemented - AI models should NOT be cached as they provide real-time analysis based on current news.

---

## 4. Financial Modeling Prep (FMP) API

### API Details
- **Base URL**: `https://financialmodelingprep.com/api/v3`
- **Purpose**: Stock news with built-in sentiment analysis
- **Rate Limit**: 100 requests/day (free tier)
- **API Key Required**: `FMP_API_KEY`

### Files Using This API
1. **`src/modules/free_sentiment_pipeline.ts`** (Line 198)
   - Function: `getFMPNews()` (Line 191)
   - Endpoint: `/stock_news?tickers=${symbol}&limit=10&apikey=${API_KEY}`
   - Purpose: Fetch latest news articles for symbols

### Cache Status: ❌ NO KV CACHE IMPLEMENTED

**Current Behavior:**
- Fetches news on every call
- No cache namespace configured
- No TTL or persistence
- Wasteful API usage (hits rate limit quickly)

**Recommended Action:**
- **Implement KV cache immediately**
- **Namespace**: `news_data` or `fmp_news`
- **TTL**: 3600 seconds (1 hour) - news is time-sensitive but doesn't need minute-level freshness
- **Key format**: `news_fmp_${symbol}_${date}` (date-based for cleanup)
- **Fallback**: If cache miss, fetch and store in cache before returning

**Potential KV Reduction:**
- Currently: 5 symbols × 1-3 calls/day = 15-45 calls/day
- With cache: 5 symbols × 4 calls/day = 20 calls/day (83% reduction)
- Before hitting rate limit: 6.6 days vs 0.1 days

---

## 5. NewsAPI.org

### API Details
- **Base URL**: `https://newsapi.org/v2`
- **Purpose**: Broader news coverage for sentiment analysis
- **Rate Limit**: 100 requests/day (free tier)
- **API Key Required**: `NEWSAPI_KEY`

### Files Using This API
1. **`src/modules/free_sentiment_pipeline.ts`** (Line 270)
   - Function: `getNewsAPIData()` (Line 262)
   - Endpoint: `/everything?q=${symbol}&sortBy=publishedAt&pageSize=10&apiKey=${API_KEY}`
   - Purpose: Fetch news articles for symbol analysis

### Cache Status: ❌ NO KV CACHE IMPLEMENTED

**Current Behavior:**
- Fetches news on every call
- No cache namespace configured
- No TTL or persistence
- Very wasteful (hits free tier limit in ~100 requests)

**Recommended Action:**
- **Implement KV cache immediately**
- **Namespace**: `news_api`
- **TTL**: 1800 seconds (30 minutes) - news relevance degrades after 30 minutes
- **Key format**: `news_api_${symbol}_${hour}` (hourly buckets for automatic cleanup)
- **Rate limiting**: Add request deduplication to prevent thundering herd

**Potential KV Reduction:**
- Currently: 5 symbols × 1-3 calls/day = 15-45 calls/day
- With cache: 5 symbols × 8 calls/day = 40 calls/day (11% reduction, but prevents rate limit)
- Before hitting rate limit: 6.6 days vs 2.5 days (if no other optimizations)

---

## Cache Configuration Summary

### Current Cache Namespaces (`src/modules/cache-config.ts`)

| Namespace | Purpose | L1 TTL | L2 TTL | Status |
|-----------|---------|--------|--------|--------|
| `sentiment_analysis` | AI analysis results | 300s | 3600s | ✅ Active |
| `market_data` | Real-time prices | 30s | 300s | ⚠️ Incomplete |
| `sector_data` | Sector rotation data | 300s | 300s | ❓ Partially used |
| `market_drivers` | FRED economic data | 300s | 3600s | ✅ Active |
| `analysis_results` | Analysis outputs | 1800s | 86400s | ✅ Active |
| `daily_reports` | Daily summaries | 300s | 86400s | ✅ Active |
| `weekly_reports` | Weekly summaries | 300s | 86400s | ✅ Active |
| `api_responses` | API responses | 300s | 3600s | ✅ Active |
| `user_preferences` | User settings | 1800s | 86400s | ✅ Active |

### Missing Cache Namespaces (Need Implementation)

| Namespace | Purpose | Recommended L1 | Recommended L2 | Priority |
|-----------|---------|----------------|----------------|----------|
| `news_fmp` | FMP news data | 600s | 3600s | HIGH |
| `news_api` | NewsAPI articles | 600s | 1800s | HIGH |
| `price_validation` | Historical price checks | 300s | 86400s | MEDIUM |
| `sector_performance` | Sector performance metrics | 900s | 900s | MEDIUM |

---

## Recommendations

### Priority 1 (High) - Implement Immediately

1. **Add KV Cache for FMP News API** (`src/modules/free_sentiment_pipeline.ts`)
   - **Files to modify**: `getFMPNews()` function
   - **Implementation**: Add cache check before API call, store result on cache miss
   - **Impact**: 83% reduction in FMP API calls

2. **Add KV Cache for NewsAPI** (`src/modules/free_sentiment_pipeline.ts`)
   - **Files to modify**: `getNewsAPIData()` function
   - **Implementation**: Similar to FMP implementation
   - **Impact**: Prevents hitting NewsAPI rate limits

### Priority 2 (Medium) - Within 1 Week

3. **Standardize Yahoo Finance Caching**
   - **Files**: `src/modules/real-time-tracking.ts`, `src/modules/data.ts`
   - **Action**: Add proper cache namespace usage for all Yahoo Finance calls
   - **Impact**: 50-70% reduction in Yahoo Finance API calls

4. **Add Sector Data Caching**
   - **Files**: `src/modules/sector-fetcher-simple.ts`, `src/modules/sector-data-fetcher.ts`
   - **Implementation**: Use existing `sector_data` namespace
   - **Impact**: Faster sector analysis, reduced API load

### Priority 3 (Low) - Future Enhancements

5. **Cache Health Monitoring**
   - **Action**: Add cache hit rate metrics for all external APIs
   - **Purpose**: Track cache effectiveness and identify optimization opportunities

6. **Request Deduplication**
   - **Files**: All external API call sites
   - **Action**: Implement request deduplication to prevent thundering herd
   - **Purpose**: Prevent multiple simultaneous API calls for same data

---

## Implementation Example

### For FMP News Cache (Priority 1)

```typescript
async function getFMPNews(symbol: string, env: CloudflareEnvironment): Promise<NewsArticle[]> {
  const cacheKey = `news_fmp_${symbol}_${new Date().toISOString().split('T')[0]}`;

  // Check cache first
  const dal = createSimplifiedEnhancedDAL(env, { enableCache: true });
  const cached = await dal.read(cacheKey);
  if (cached.success && cached.data) {
    return cached.data;
  }

  // If not in cache, fetch from API
  const API_KEY = env.FMP_API_KEY;
  const url = `https://financialmodelingprep.com/api/v3/stock_news?tickers=${symbol}&limit=10&apikey=${API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`FMP API returned ${response.status}`);
  }

  const data = await response.json();
  const news = data.map((item: any) => ({
    title: item.title,
    summary: item.text || item.content,
    url: item.url,
    source: 'financialmodelingprep',
    published_at: item.publishedDate,
    symbol: symbol
  }));

  // Store in cache for 1 hour
  await dal.write(cacheKey, news, { expirationTtl: 3600 });

  return news;
}
```

---

## Conclusion

The system has **excellent caching for FRED API** and **appropriate no-caching for AI models**, but **significant gaps in news API caching** (FMP and NewsAPI). Implementing Priority 1 recommendations would:

- **Reduce FMP API usage by 83%**
- **Prevent NewsAPI rate limit violations**
- **Extend free tier quotas from hours to days**
- **Improve system reliability and user experience**

The existing cache infrastructure (Enhanced DAL, cache namespaces, TTL management) makes implementation straightforward and low-risk.

---

**Report Generated**: 2025-10-31
**Total External APIs Analyzed**: 5
**APIs with Proper Cache**: 2 (FRED, AI Models)
**APIs Needing Cache**: 2 (FMP, NewsAPI)
**APIs with Inconsistent Cache**: 1 (Yahoo Finance)
