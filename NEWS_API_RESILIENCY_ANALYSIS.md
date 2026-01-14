# News API Resiliency Analysis & Implementation Plan

**Date**: 2026-01-14  
**Status**: Corroboration Complete

## Executive Summary

Analysis of the codebase confirms the proposed resiliency plan is **well-aligned** with existing infrastructure. Key findings:

✅ **Already Implemented**: Circuit breakers, basic rate limiting, DAC service binding  
⚠️ **Partially Implemented**: Caching (exists but needs tuning), error logging (exists but incomplete)  
❌ **Missing**: Token-bucket rate limiters per provider, provider-specific backoff, structured error capture in D1

---

## Current State Assessment

### 1. DAC Integration ✅ Partially Complete

**File**: `src/modules/dac-articles-pool-v2.ts`

**What Exists**:
- Service binding to DAC backend via `Fetcher`
- Admin probe endpoint: `/api/admin/article-pool/probe/stock/:symbol`
- Error handling for NOT_FOUND, STALE, FRESHNESS_EXPIRED
- Metadata extraction (freshCount, oldestAgeHours, source)

**Issue Identified**:
```typescript
// Line 113-125: Probe endpoint returns nested structure
if (data.accessorCall) {
  return {
    success: data.accessorCall.success,
    articles: data.accessorCall.articles || [],  // ← Can be empty array!
    metadata: data.accessorCall.metadata,
  };
}
```

**Problem**: `success=true` but `articles.length === 0` is **not treated as an error**. This causes silent failures.

**Fix Required**:
```typescript
if (data.accessorCall) {
  const articles = data.accessorCall.articles || [];
  
  // Fail fast if success but no articles
  if (data.accessorCall.success && articles.length === 0) {
    return {
      success: false,
      articles: [],
      error: 'EMPTY_RESPONSE',
      errorMessage: `DAC returned success but 0 articles for ${symbol}`
    };
  }
  
  return {
    success: data.accessorCall.success,
    articles,
    metadata: data.accessorCall.metadata,
    error: data.accessorCall.error,
    errorMessage: data.accessorCall.errorMessage
  };
}
```

---

### 2. Rate Limiting ⚠️ Needs Enhancement

**File**: `src/modules/rate-limiter.ts`

**What Exists**:
- Simple sliding window rate limiter
- Yahoo Finance: 20 req/min (configurable)
- Fallback API: 10 req/min
- `rateLimitedFetch()` wrapper function

**Gaps**:
1. **No per-provider limiters** - FMP, NewsAPI, Yahoo share same limiter
2. **No token bucket** - Uses simple counter, no burst handling
3. **No 429 detection** - Doesn't react to HTTP 429 responses
4. **No quota tracking** - Can't warn at 70%/85%/95% thresholds

**Current Implementation**:
```typescript
class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private requests: number[];  // ← Simple timestamp array

  isAllowed(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    return false;
  }
}
```

**Required Enhancement**: Token bucket with per-provider configs

---

### 3. Circuit Breakers ✅ Fully Implemented

**File**: `src/modules/circuit-breaker.ts`

**What Exists**:
- Full circuit breaker with CLOSED/OPEN/HALF_OPEN states
- Configurable failure thresholds (default: 5 failures)
- Auto-recovery testing (HALF_OPEN with 5 test calls)
- Comprehensive metrics tracking
- `CircuitBreakerFactory` for creating named breakers

**Status**: **Production-ready**, just needs integration with news fetchers

---

### 4. Caching ⚠️ Exists But Needs Tuning

**File**: `src/modules/free_sentiment_pipeline.ts`

**What Exists**:
```typescript
// FMP: Daily cache key
const cacheKey = `news_fmp_${symbol}_${new Date().toISOString().split('T')[0]}`;
await dal.write(cacheKey, newsArticles, { expirationTtl: 3600 }); // 1 hour

// NewsAPI: Hourly cache key
const hour = new Date().getHours();
const cacheKey = `news_api_${symbol}_${hour}`;
await dal.write(cacheKey, newsArticles, { expirationTtl: 1800 }); // 30 min

// Yahoo: No caching (returns empty array on error)
```

**Issues**:
1. **Inconsistent TTLs** - FMP: 1h, NewsAPI: 30min, Yahoo: none
2. **No deduplication** - Concurrent requests for same symbol hit API multiple times
3. **No cache metadata** - Can't track hit/miss rates or adjust confidence

**Recommended TTLs** (based on provider freshness):
- **DAC**: 5-10 min (real-time priority)
- **FMP**: 10 min (good freshness, 300 req/day limit)
- **NewsAPI**: 30 min (free tier: ~1-2 req/min)
- **Yahoo**: 1 hour (best-effort, unofficial API)

---

### 5. Error Logging ⚠️ Incomplete

**File**: `src/modules/free_sentiment_pipeline.ts` (Lines 172-202)

**What Exists**:
```typescript
try {
  const dacResult = await dacAdapter.getArticlesForSentiment(symbol);
  // ...
} catch (error: any) {
  console.log(`DAC Pool lookup failed for ${symbol} (continuing to fallbacks):`, 
    (error instanceof Error ? error.message : String(error)));
}
```

**Issues**:
1. **Console.log only** - Errors not captured in D1
2. **No structured logging** - Can't query by provider/error type
3. **No aggregation** - Can't detect patterns (e.g., "FMP 429 for last 10 requests")

**D1 Schema Exists** (`symbol_predictions.error_message`):
```typescript
// src/modules/pre-market-data-bridge.ts:73
INSERT OR REPLACE INTO symbol_predictions 
(symbol, prediction_date, sentiment, confidence, direction, model, 
 status, error_message, news_source, articles_count, raw_response, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
```

**Gap**: News fetching errors are **not written to D1**, only sentiment analysis failures.

---

## Implementation Plan

### Phase 1: Immediate DAC Fix (1-2 hours)

**Priority**: CRITICAL  
**Files**: `src/modules/dac-articles-pool-v2.ts`, `src/modules/free_sentiment_pipeline.ts`

1. **Add empty response detection** in DAC adapter (see fix above)
2. **Add contract test** in `tests/integration/dac/`
   ```typescript
   test('DAC returns non-empty articles for AAPL', async () => {
     const result = await dacClient.getStockArticles('AAPL');
     expect(result.success).toBe(true);
     expect(result.articles.length).toBeGreaterThan(0);
     expect(result.metadata).toBeDefined();
   });
   ```
3. **Update fallback logic** to log DAC empty responses as errors

### Phase 2: Token Bucket Rate Limiters (3-4 hours)

**Priority**: HIGH  
**Files**: `src/modules/rate-limiter.ts` (new: `provider-rate-limiters.ts`)

**Create per-provider limiters**:
```typescript
interface ProviderConfig {
  name: string;
  maxRequestsPerMinute: number;
  maxRequestsPerDay?: number;
  burstSize: number;
  refillRate: number; // tokens per second
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  dac: { name: 'DAC', maxRequestsPerMinute: 60, burstSize: 10, refillRate: 1 },
  fmp: { name: 'FMP', maxRequestsPerMinute: 5, maxRequestsPerDay: 300, burstSize: 3, refillRate: 0.083 },
  newsapi: { name: 'NewsAPI', maxRequestsPerMinute: 2, maxRequestsPerDay: 1000, burstSize: 2, refillRate: 0.033 },
  yahoo: { name: 'Yahoo', maxRequestsPerMinute: 3, burstSize: 2, refillRate: 0.05 }
};

class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private config: ProviderConfig;
  
  async acquire(): Promise<boolean> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
  
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.config.burstSize,
      this.tokens + elapsed * this.config.refillRate
    );
    this.lastRefill = now;
  }
}
```

### Phase 3: Exponential Backoff + Circuit Breakers (2-3 hours)

**Priority**: HIGH  
**Files**: `src/modules/free_sentiment_pipeline.ts`

**Integrate circuit breakers**:
```typescript
import { CircuitBreakerFactory } from './circuit-breaker.js';

const dacBreaker = CircuitBreakerFactory.create('dac-articles', {
  failureThreshold: 3,
  openTimeout: 30000, // 30s
  successThreshold: 2
});

const fmpBreaker = CircuitBreakerFactory.create('fmp-news', {
  failureThreshold: 5,
  openTimeout: 60000, // 1min
  successThreshold: 3
});

async function getFMPNews(symbol: string, env: any): Promise<NewsArticle[]> {
  return await fmpBreaker.execute(async () => {
    // Existing FMP logic with 429 detection
    const response = await fetch(url);
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(`FMP rate limit: retry after ${retryAfter}s`);
    }
    
    // ... rest of logic
  });
}
```

**Add exponential backoff**:
```typescript
async function fetchWithBackoff(
  fetcher: () => Promise<Response>,
  maxRetries: number = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetcher();
      if (response.status === 429) {
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Phase 4: Enhanced Error Capture (2 hours)

**Priority**: MEDIUM  
**Files**: `src/modules/free_sentiment_pipeline.ts`, `src/modules/pre-market-data-bridge.ts`

**Capture news fetching errors in D1**:
```typescript
async function getFreeStockNews(symbol: string, env: any): Promise<NewsArticle[]> {
  const errors: Array<{ provider: string; error: string }> = [];
  const newsData: NewsArticle[] = [];
  
  // Try DAC
  try {
    const dacResult = await dacAdapter.getArticlesForSentiment(symbol);
    if (dacResult.success && dacResult.articles.length > 0) {
      return dacResult.articles;
    }
    errors.push({ provider: 'dac', error: dacResult.errorMessage || 'Empty response' });
  } catch (error: any) {
    errors.push({ provider: 'dac', error: error.message });
  }
  
  // Try FMP, NewsAPI, Yahoo...
  // (similar error capture)
  
  // If all failed, write to D1
  if (newsData.length === 0) {
    await writeNewsFailureToD1(env, symbol, errors);
  }
  
  return newsData;
}

async function writeNewsFailureToD1(
  env: CloudflareEnvironment,
  symbol: string,
  errors: Array<{ provider: string; error: string }>
): Promise<void> {
  if (!env.PREDICT_JOBS_DB) return;
  
  const errorSummary = errors.map(e => `${e.provider}: ${e.error}`).join('; ');
  
  await env.PREDICT_JOBS_DB.prepare(`
    INSERT OR REPLACE INTO symbol_predictions 
    (symbol, prediction_date, status, error_message, articles_count, created_at)
    VALUES (?, ?, 'failed', ?, 0, datetime('now'))
  `).bind(symbol, new Date().toISOString().split('T')[0], errorSummary).run();
}
```

### Phase 5: Observability & Alerting (3-4 hours)

**Priority**: MEDIUM  
**Files**: New `src/modules/news-api-metrics.ts`, `src/routes/monitoring-routes.ts`

**Metrics to track**:
```typescript
interface NewsAPIMetrics {
  provider: string;
  requests_total: number;
  requests_429: number;
  requests_success: number;
  requests_failed: number;
  cache_hits: number;
  cache_misses: number;
  circuit_breaker_state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  quota_used: number;
  quota_limit: number;
  quota_utilization_percent: number;
}
```

**Alert thresholds**:
- Quota ≥70%: Warning
- Quota ≥85%: Critical
- Quota ≥95%: Emergency
- Circuit breaker OPEN for >5min: Critical
- 429 rate >10% of requests: Warning

### Phase 6: Testing & Validation (2-3 hours)

**Priority**: HIGH  
**Files**: `tests/integration/news-api-resiliency.test.ts`

**Test scenarios**:
1. DAC returns empty articles → fallback to FMP
2. FMP returns 429 → exponential backoff → circuit breaker opens
3. All providers fail → error written to D1 with all failure reasons
4. Token bucket prevents burst → requests queued
5. Cache hit → no API call made
6. Concurrent requests for same symbol → deduplicated

---

## Deployment Strategy

### Pre-Deployment Checklist

1. ✅ Run integration tests: `npm run test:integration`
2. ✅ Run Playwright suite: `npm run test:playwright`
3. ✅ Verify D1 schema: `wrangler d1 execute PREDICT_JOBS_DB --command "PRAGMA table_info(symbol_predictions)"`
4. ✅ Check DAC backend health: `curl -H "X-API-Key: $API_KEY" https://dac-backend/health`
5. ✅ Verify wrangler.toml bindings (DAC_BACKEND, PREDICT_JOBS_DB)

### Staging Deployment

```bash
# Deploy to staging first
unset CLOUDFLARE_API_TOKEN
npx wrangler deploy --env staging

# Monitor for 1 hour
# Check D1 for error_message population
wrangler d1 execute PREDICT_JOBS_DB --env staging --command \
  "SELECT symbol, error_message, articles_count FROM symbol_predictions WHERE prediction_date = date('now') LIMIT 20"

# Check circuit breaker states
curl https://staging.tft-trading-system.yanggf.workers.dev/api/v1/monitoring/circuit-breakers
```

### Production Deployment

**⚠️ REQUIRES USER APPROVAL** (per AGENTS.md guidelines)

```bash
# After staging validation + user approval
unset CLOUDFLARE_API_TOKEN
npx wrangler deploy --env production
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DAC empty response breaks reports | HIGH | HIGH | Phase 1 fix + contract test |
| FMP rate limit (300/day) exhausted | MEDIUM | HIGH | Token bucket + caching + fallbacks |
| NewsAPI free tier insufficient | MEDIUM | MEDIUM | Aggressive caching (30min TTL) + fallback |
| Yahoo unofficial API breaks | LOW | LOW | Best-effort only, not critical path |
| Circuit breaker false positives | LOW | MEDIUM | Tune thresholds in staging |

---

## Success Metrics

**Target State** (after full implementation):

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| News fetch success rate | ~0% (all failing) | ≥95% | ❌ |
| Cache hit rate | Unknown | ≥70% | ⚠️ |
| 429 error rate | Unknown | <5% | ⚠️ |
| D1 error capture | 0% | 100% | ❌ |
| Circuit breaker coverage | 0% | 100% | ❌ |
| Mean time to detect (MTTD) | Hours | <5min | ❌ |

---

## Conclusion

The proposed resiliency plan is **well-aligned** with existing infrastructure. Key actions:

1. **Immediate**: Fix DAC empty response handling (Phase 1)
2. **High Priority**: Implement token bucket rate limiters (Phase 2) + circuit breakers (Phase 3)
3. **Medium Priority**: Enhanced error capture (Phase 4) + observability (Phase 5)
4. **Validation**: Comprehensive testing (Phase 6) before production deployment

**Estimated Total Effort**: 15-20 hours  
**Recommended Timeline**: 2-3 days with staging validation

**Next Step**: Await user approval to proceed with Phase 1 (DAC fix).
