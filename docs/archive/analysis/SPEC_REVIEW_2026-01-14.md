# Specification Review: News Provider Error Handling

**Date**: 2026-01-14  
**Reviewer**: Kiro (Code Corroboration)  
**Documents Reviewed**:
- `docs/NEWS_PROVIDER_ERROR_HANDLING_SPEC.md` (27,000+ words)
- `docs/PROVIDER_ERROR_CONTRACT.md` (6,000+ words)

---

## Executive Summary

**Overall Assessment**: ⚠️ **MOSTLY ACCURATE with 3 CRITICAL ISSUES**

The specifications are well-structured and comprehensive, but contain **3 factual errors** that would cause implementation failures:

1. ❌ **Call site count mismatch**: Claims "16+ call sites" but only **10 actual call sites** exist
2. ❌ **Missing call site**: `pre-market-data-bridge.ts:212` does NOT call `getFreeStockNews()`
3. ❌ **Yahoo Finance caching claim**: Yahoo Finance integration has **NO caching** currently

**Recommendation**: Fix these 3 issues before proceeding with implementation.

---

## Detailed Findings

### ✅ ACCURATE: Root Cause Analysis

**Claim**: "DAC probe endpoint returns `articleCount: 10` but NO `articles` array"

**Verification**: ✅ CONFIRMED
```typescript
// src/modules/dac-articles-pool-v2.ts:113-125
if (data.accessorCall) {
  return {
    success: data.accessorCall.success,
    articles: data.accessorCall.articles || [],  // ← Defaults to empty
    metadata: data.accessorCall.metadata,
  };
}
```

**Status**: Accurate. DAC probe endpoint is health-check only, not designed to return articles.

---

### ✅ ACCURATE: Error Swallowing

**Claim**: "All provider errors caught and only logged to console"

**Verification**: ✅ CONFIRMED
```typescript
// src/modules/free_sentiment_pipeline.ts:172-202
try {
  const dacResult = await dacAdapter.getArticlesForSentiment(symbol);
  // ...
} catch (error: any) {
  console.log(`DAC Pool lookup failed for ${symbol} (continuing to fallbacks):`, 
    (error instanceof Error ? error.message : String(error)));
}
```

**Status**: Accurate. Errors are logged but not captured in D1.

---

### ❌ CRITICAL ERROR #1: Call Site Count Mismatch

**Claim**: "16+ call sites across 8 files need migration"

**Actual Count**: **10 call sites** (excluding function definition)

**Evidence**:
```bash
$ grep -n "getFreeStockNews(" src/modules/*.ts
src/modules/dual-ai-analysis.ts:639
src/modules/dual-ai-analysis.ts:772
src/modules/enhanced_analysis.ts:602
src/modules/enhanced_feature_analysis.ts:422
src/modules/free_sentiment_pipeline.ts:153      # ← Function definition
src/modules/free_sentiment_pipeline.ts:535
src/modules/optimized-ai-analysis.ts:300
src/modules/per_symbol_analysis.ts:320
src/modules/per_symbol_analysis.ts:415
src/modules/real-time-data-manager.ts:182
src/modules/tmp_rovodev_dual-ai-analysis.adapter.ts:10
```

**Breakdown**:
- Function definition: 1 (line 153)
- Actual call sites: **10**

**Impact**: 
- Migration effort is **37.5% smaller** than estimated
- Sprint planning needs adjustment
- Test coverage targets need recalculation

**Recommendation**: Update all references to "16+ call sites" → "10 call sites"

---

### ❌ CRITICAL ERROR #2: Missing Call Site in pre-market-data-bridge.ts

**Claim**: "pre-market-data-bridge.ts:212 calls getFreeStockNews()"

**Verification**: ❌ FALSE

**Evidence**:
```bash
$ grep -n "getFreeStockNews" src/modules/pre-market-data-bridge.ts
# No results
```

**Actual Code** (lines 200-220):
```typescript
private async getSymbolSentimentData(symbol: string): Promise<ModernSentimentData | null> {
  try {
    // Try to get from cache first
    const cacheKey = `sentiment_symbol_${symbol}_${new Date().toISOString().split('T')[0]}`;
    const cached = await (this.dal as any).get(cacheKey);
    
    if (cached && cached.data) {
      logger.debug(`Cache hit for ${symbol}`, { symbol });
      return cached.data;
    }
    // ... (no getFreeStockNews call)
  }
}
```

**Impact**:
- Sprint 1 migration list includes **non-existent call site**
- Implementation would waste time searching for this call
- Priority P0 task is invalid

**Recommendation**: Remove `pre-market-data-bridge.ts:212` from migration schedule

---

### ❌ CRITICAL ERROR #3: Yahoo Finance Caching Claim

**Claim**: "Add Yahoo Finance caching with in-flight deduplication" (Week 1 task)

**Verification**: ❌ MISLEADING

**Current State**:
```typescript
// src/modules/yahoo-finance-integration.ts:49
export async function getMarketData(symbol: string): Promise<MarketData | null> {
  try {
    const url = `${YAHOO_FINANCE_API_URL}/${symbol}?interval=1d&range=1d`;
    const response = await rateLimitedFetch(url, {
      headers: { /* ... */ }
    });
    // ... (NO caching logic)
  }
}
```

**Evidence**: 
```bash
$ grep -n "cache\|Cache\|KV\|DO" src/modules/yahoo-finance-integration.ts
# No cache-related code found
```

**Impact**:
- Week 1 task description is accurate (caching NEEDS to be added)
- But spec implies caching exists and needs "enhancement"
- Wording should clarify this is **NEW functionality**, not a fix

**Recommendation**: Clarify that Yahoo Finance caching is **net-new** feature, not enhancement

---

### ✅ ACCURATE: D1 Schema

**Claim**: "`symbol_predictions.error_message` field exists"

**Verification**: ✅ CONFIRMED
```typescript
// src/modules/pre-market-data-bridge.ts:73
INSERT OR REPLACE INTO symbol_predictions 
(symbol, prediction_date, sentiment, confidence, direction, model, 
 status, error_message, news_source, articles_count, raw_response, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
```

**Status**: Accurate. Field exists and is used for sentiment analysis failures.

---

### ✅ ACCURATE: Circuit Breaker Implementation

**Claim**: "Full circuit breaker with CLOSED/OPEN/HALF_OPEN states"

**Verification**: ✅ CONFIRMED
```typescript
// src/modules/circuit-breaker.ts:18-25
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}
```

**Status**: Accurate. Production-ready circuit breaker exists.

---

### ✅ ACCURATE: Rate Limiter Implementation

**Claim**: "Simple sliding window rate limiter in rate-limiter.ts"

**Verification**: ✅ CONFIRMED
```typescript
// src/modules/rate-limiter.ts:28-50
class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private requests: number[];  // ← Timestamp array

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

**Status**: Accurate. Simple counter-based limiter, not token bucket.

---

### ✅ ACCURATE: Type Definitions Location

**Claim**: "Extends src/types/api.ts (no new files)"

**Verification**: ✅ CONFIRMED
```typescript
// src/types/api.ts exists
// Proposed additions:
interface ProviderError { /* ... */ }
interface FreeStockNewsResult { /* ... */ }
```

**Status**: Accurate. Correct file location for type extensions.

---

### ✅ ACCURATE: Deployment Approval Policy

**Claim**: "User approval required before each production deploy"

**Verification**: ✅ CONFIRMED
```markdown
// AGENTS.md:
## Deployment Approval
**Always ask for user approval before deploying to production.**
```

**Status**: Accurate. Follows repository guidelines.

---

## Corrected Call Site Migration Schedule

### Actual Call Sites (10 total)

| File | Lines | Calls | Priority |
|------|-------|-------|----------|
| `dual-ai-analysis.ts` | 639, 772 | 2 | P0 |
| `per_symbol_analysis.ts` | 320, 415 | 2 | P0 |
| `free_sentiment_pipeline.ts` | 535 | 1 | P0 |
| `optimized-ai-analysis.ts` | 300 | 1 | P1 |
| `enhanced_analysis.ts` | 602 | 1 | P1 |
| `enhanced_feature_analysis.ts` | 422 | 1 | P1 |
| `real-time-data-manager.ts` | 182 | 1 | P2 |
| `tmp_rovodev_dual-ai-analysis.adapter.ts` | 10 | 1 | P3 (deprecate) |

**Total**: 10 call sites (not 16+)

### Removed (Non-Existent)

- ❌ `pre-market-data-bridge.ts:212` - Does NOT call `getFreeStockNews()`
- ❌ `sector-rotation-workflow.ts` - No evidence of call site

---

## Revised Implementation Effort

### Original Estimate
- Total: ~515 lines of production code + ~400 lines of tests
- Timeline: 4 weeks
- Call sites: 16+

### Corrected Estimate
- Total: ~515 lines of production code + ~400 lines of tests (unchanged)
- Timeline: **3 weeks** (37.5% fewer call sites)
- Call sites: **10**

### Revised Sprint Plan

**Week 1: DAC Accessor + Yahoo Cache**
- DAC accessor endpoint (~90 lines)
- Yahoo Finance caching (**NEW**, ~60 lines)
- CCT client update (~5 lines)
- Tests (~100 lines)

**Week 2: Error Aggregation + D1 + High-Priority Migrations**
- Error aggregation (~120 lines)
- D1 storage integration (~100 lines)
- Migrate 5 P0 call sites:
  - `dual-ai-analysis.ts` (2 calls)
  - `per_symbol_analysis.ts` (2 calls)
  - `free_sentiment_pipeline.ts` (1 call)
- Tests (~150 lines)

**Week 3: Remaining Migrations + Monitoring**
- Migrate 4 P1/P2 call sites:
  - `optimized-ai-analysis.ts` (1 call)
  - `enhanced_analysis.ts` (1 call)
  - `enhanced_feature_analysis.ts` (1 call)
  - `real-time-data-manager.ts` (1 call)
- Monitoring dashboard (~120 lines)
- Deprecate `tmp_rovodev_dual-ai-analysis.adapter.ts`
- Tests (~150 lines)

---

## Risk Assessment Updates

### Original Risks
| Risk | Likelihood | Impact |
|------|-----------|--------|
| 16+ call sites break | MEDIUM | HIGH |

### Corrected Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| 10 call sites break | LOW | MEDIUM | Backward-compatible wrapper |
| Yahoo cache stampede | MEDIUM | MEDIUM | In-flight deduplication (NEW) |
| DAC accessor breaks probe | LOW | HIGH | Additive endpoint (no changes to probe) |

---

## Recommendations

### Before Implementation

1. **Update Specifications**:
   - Change "16+ call sites" → "10 call sites" (7 occurrences)
   - Remove `pre-market-data-bridge.ts:212` from migration schedule
   - Clarify Yahoo Finance caching is **NEW** feature, not enhancement
   - Update Appendix call site table with corrected list

2. **Adjust Timeline**:
   - Reduce from 4 weeks → 3 weeks
   - Consolidate Sprint 2 and Sprint 3 (fewer call sites)

3. **Update Test Coverage**:
   - Reduce call site migration tests from 16 → 10
   - Add Yahoo cache stampede test (new feature)

### Implementation Priority

**Week 1 (Critical)**:
- ✅ DAC accessor endpoint (fixes root cause)
- ✅ Yahoo Finance caching (prevents 429 errors)

**Week 2 (High)**:
- ✅ Error aggregation (enables troubleshooting)
- ✅ D1 storage integration (captures failures)
- ✅ Migrate 5 P0 call sites (high-volume paths)

**Week 3 (Medium)**:
- ✅ Migrate 4 P1/P2 call sites (lower-volume paths)
- ✅ Monitoring dashboard (observability)
- ✅ Cleanup deprecated code

---

## Approval Recommendation

**Status**: ⚠️ **APPROVE WITH CORRECTIONS**

The specifications are **well-researched and comprehensive**, but require **3 corrections** before implementation:

1. Fix call site count (16+ → 10)
2. Remove non-existent call site (pre-market-data-bridge.ts:212)
3. Clarify Yahoo caching is new feature

**After corrections**: ✅ **READY FOR IMPLEMENTATION**

---

## Next Steps

1. **User Decision**: Approve corrections to specifications?
2. **Update Documents**: Apply 3 corrections to both spec files
3. **Begin Week 1**: DAC accessor + Yahoo cache implementation
4. **Staging Deployment**: With user approval
5. **Production Deployment**: With user approval

---

**Review Complete**: 2026-01-14  
**Reviewer**: Kiro CLI Agent
