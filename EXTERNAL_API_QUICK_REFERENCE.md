# External API Quick Reference

## Summary Table

| API Service | Purpose | Files | Cache Status | Namespace | TTL | Action Needed |
|------------|---------|-------|--------------|-----------|-----|---------------|
| **Yahoo Finance** | Market data (prices, VIX, etc.) | 9 files | ⚠️ Inconsistent | `market_data` | L1: 30s, L2: 300s | Standardize all endpoints |
| **FRED API** | Economic data (rates, CPI, GDP) | 1 file | ✅ Complete | `market_drivers_fred_data` | 3600s | None |
| **GPT-OSS-120B** | AI sentiment analysis | 6 files | ✅ Intentionally uncached | N/A | N/A | None |
| **DistilBERT-SST-2** | AI sentiment classification | 6 files | ✅ Intentionally uncached | N/A | N/A | None |
| **FMP API** | Stock news with sentiment | 1 file | ❌ **Missing** | `news_fmp` | 3600s | **Implement immediately** |
| **NewsAPI.org** | News articles | 1 file | ❌ **Missing** | `news_api` | 1800s | **Implement immediately** |

---

## Critical Findings

### ❌ Missing Cache Implementation (HIGH PRIORITY)

#### 1. FMP API (`src/modules/free_sentiment_pipeline.ts`, Line 198)
```typescript
// Current: NO CACHE
const url = `https://financialmodelingprep.com/api/v3/stock_news?tickers=${symbol}&limit=10&apikey=${API_KEY}`;

// RECOMMENDED: Add cache
const cacheKey = `news_fmp_${symbol}_${new Date().toISOString().split('T')[0]}`;
const cached = await dal.read(cacheKey);
if (cached.success) return cached.data;
```

**Impact**: 83% reduction in API calls (15-45/day → 5-20/day)

#### 2. NewsAPI (`src/modules/free_sentiment_pipeline.ts`, Line 270)
```typescript
// Current: NO CACHE
const url = `https://newsapi.org/v2/everything?q=${symbol}&sortBy=publishedAt&pageSize=10&apiKey=${API_KEY}`;

// RECOMMENDED: Add cache
const cacheKey = `news_api_${symbol}_${hour}`;
const cached = await dal.read(cacheKey);
```

**Impact**: Prevents hitting 100 requests/day rate limit

### ⚠️ Inconsistent Cache Usage

#### Yahoo Finance API - Used in 9 files but cache is inconsistent
- **Cached**: Market structure indicators (VIX, SPY, Treasury yields)
- **NOT Cached**: News search (Line 298), Real-time tracking (Line 134), Price validation (Line 733)

**Files needing cache updates:**
- `src/modules/free_sentiment_pipeline.ts` (Line 298) - News search
- `src/modules/data.ts` (Line 733) - Historical price validation
- `src/modules/real-time-tracking.ts` (Line 134) - Real-time tracking

### ✅ Properly Implemented

#### FRED API - Excellent caching
- **Cache**: Full macro economic snapshot (18 economic series)
- **TTL**: 1 hour (appropriate for economic data)
- **Circuit Breaker**: Yes
- **DAL Integration**: Yes

#### AI Models - Correctly uncached
- **GPT-OSS-120B**: Real-time analysis, circuit breaker + timeout protection
- **DistilBERT-SST-2**: Real-time classification, circuit breaker + timeout protection
- **Rationale**: AI analysis requires fresh data based on current market conditions

---

## File-by-File Breakdown

| File Path | API Call | Line | Cache Status | Namespace |
|-----------|----------|------|--------------|-----------|
| `src/modules/yahoo-finance-integration.ts` | Yahoo Finance | 57 | ✅ Cached | `market_data` |
| `src/modules/free_sentiment_pipeline.ts` | FMP News | 198 | ❌ No cache | NONE |
| `src/modules/free_sentiment_pipeline.ts` | NewsAPI | 270 | ❌ No cache | NONE |
| `src/modules/free_sentiment_pipeline.ts` | Yahoo Finance | 298 | ❌ No cache | NONE |
| `src/modules/data.ts` | Yahoo Finance | 733 | ❌ No cache | NONE |
| `src/modules/fred-api-client.ts` | FRED API | 248 | ✅ Cached | `market_drivers_fred_data` |
| `src/modules/real-time-tracking.ts` | Yahoo Finance | 134 | ❌ No cache | NONE |
| `src/modules/cron-signal-tracking.ts` | Yahoo Finance | 353 | ⚠️ Unknown | Unknown |
| `src/modules/market-close-analysis.ts` | Yahoo Finance | 326 | ⚠️ Unknown | Unknown |
| `src/modules/enhanced_feature_analysis.ts` | Yahoo Finance | 353 | ⚠️ Unknown | Unknown |
| `src/modules/dual-ai-analysis.ts` | GPT-OSS-120B | 284 | ✅ Uncached (correct) | N/A |
| `src/modules/dual-ai-analysis.ts` | DistilBERT | 368 | ✅ Uncached (correct) | N/A |

---

## Implementation Priority

### 🚨 Priority 1 (This Week)
1. **FMP News Cache** - `src/modules/free_sentiment_pipeline.ts:191-221`
   - Add cache key: `news_fmp_${symbol}_${date}`
   - TTL: 3600s (1 hour)
   - Impact: 83% API reduction

2. **NewsAPI Cache** - `src/modules/free_sentiment_pipeline.ts:262-292`
   - Add cache key: `news_api_${symbol}_${hour}`
   - TTL: 1800s (30 minutes)
   - Impact: Prevents rate limit violations

### ⚠️ Priority 2 (Next Week)
3. **Standardize Yahoo Finance** - Update 3 functions without cache
4. **Add price validation cache** - `src/modules/data.ts:733`

### 💡 Priority 3 (Future)
5. Add cache metrics dashboard
6. Implement request deduplication

---

## Cache Namespace Reference

### Existing (Active)
```
sentiment_analysis: L1 300s, L2 3600s
market_data: L1 30s, L2 300s
market_drivers: L1 300s, L2 3600s
analysis_results: L1 1800s, L2 86400s
daily_reports: L1 300s, L2 86400s
weekly_reports: L1 300s, L2 86400s
```

### New (Recommended)
```
news_fmp: L1 600s, L2 3600s      [PRIORITY 1]
news_api: L1 600s, L2 1800s      [PRIORITY 1]
price_validation: L1 300s, L2 86400s  [PRIORITY 2]
sector_performance: L1 900s, L2 900s  [PRIORITY 2]
```

---

## Estimated Impact

### Before Cache Implementation
- **FMP API**: 15-45 calls/day → Rate limit hit in 2-3 days
- **NewsAPI**: 15-45 calls/day → Rate limit hit in 2-3 days
- **Total free tier usage**: 30-90 calls/day

### After Cache Implementation
- **FMP API**: 5-20 calls/day → Rate limit hit in 5-10 days
- **NewsAPI**: 8-40 calls/day → Rate limit hit in 2.5-12.5 days
- **Total free tier usage**: 13-60 calls/day (33-50% reduction)

### With Request Deduplication
- **Total free tier usage**: 10-50 calls/day (up to 83% reduction)

---

## Next Steps

1. **Today**: Implement FMP and NewsAPI caches (2-3 hours work)
2. **This Week**: Standardize Yahoo Finance cache usage
3. **Next Week**: Add monitoring and metrics
4. **Future**: Implement predictive caching and deduplication

---

**Last Updated**: 2025-10-31
