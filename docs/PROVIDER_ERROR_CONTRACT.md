# Provider Error Contract

**Version**: 1.1 (Corrected)
**Date**: 2026-01-14
**Related**: NEWS_PROVIDER_ERROR_HANDLING_SPEC.md
**Corrections**: Call site count updated to 10 (verified via grep)

---

## Overview

This document defines the contract for error tracking across news provider integrations (DAC, FMP, NewsAPI, Yahoo Finance). All provider errors are captured, aggregated, and stored for troubleshooting and monitoring.

---

## Type Definitions

### ProviderError Interface

```typescript
interface ProviderError {
  provider: 'dac_pool' | 'fmp' | 'newsapi' | 'yahoo';
  code?: string;           // HTTP status code or error code
  message: string;         // Human-readable error message
  timestamp: string;       // ISO 8601 timestamp
  retryable: boolean;      // Can this error be retried?
}
```

**Field Descriptions**:

- `provider`: Identifier for the news provider that failed
- `code`: Optional error code (e.g., "404", "429", "TIMEOUT")
- `message`: Descriptive error message (truncated to 200 chars in D1 storage)
- `timestamp`: When the error occurred in ISO 8601 format
- `retryable`: Boolean indicating if retrying might succeed

### FreeStockNewsResult Interface

```typescript
interface FreeStockNewsResult {
  articles: NewsArticle[];
  providerErrors: ProviderError[];
  metadata: {
    totalProviders: number;        // Always 4 (DAC, FMP, NewsAPI, Yahoo)
    successfulProviders: number;   // Count of providers that returned data
    failedProviders: number;       // Count of providers that failed
    cacheHits: number;             // Count of cache hits
  };
}
```

**Usage Context**:
- Returned by `getFreeStockNewsWithErrors()` function
- Replaces simple `NewsArticle[]` return type for error-aware consumers
- Backward compatible via `getFreeStockNews()` wrapper

---

## Error Codes by Provider

### DAC Articles Pool

| Code | Meaning | Retryable | Common Cause |
|------|---------|-----------|--------------|
| `NOT_FOUND` | No articles in pool | ❌ No | Symbol not tracked, pool empty |
| `STALE` | Articles are stale | ⚠️ Maybe | Pool not refreshed recently |
| `FRESHNESS_EXPIRED` | Articles too old | ⚠️ Maybe | Harvest job not running |
| `404` | Symbol not found | ❌ No | Symbol not in article pool |
| `500` | Backend error | ✅ Yes | Temporary backend issue |
| `UNEXPECTED_ERROR` | Unknown error | ✅ Yes | Network, parsing, or logic error |

### FMP (Financial Modeling Prep)

| Code | Meaning | Retryable | Common Cause |
|------|---------|-----------|--------------|
| `401` | Unauthorized | ❌ No | Invalid API key |
| `403` | Forbidden | ❌ No | API key expired or blocked |
| `404` | No news found | ❌ No | Symbol has no recent news |
| `429` | Rate limit exceeded | ✅ Yes (after delay) | Free tier limit (300 req/day) |
| `500` | Server error | ✅ Yes | FMP backend issue |
| `ERROR` | Generic error | ✅ Yes | Network or parsing error |

### NewsAPI.org

| Code | Meaning | Retryable | Common Cause |
|------|---------|-----------|--------------|
| `401` | Unauthorized | ❌ No | Invalid API key |
| `429` | Rate limit exceeded | ✅ Yes (after delay) | Free tier limit (1000 req/day) |
| `426` | Upgrade required | ❌ No | Development tier restrictions |
| `500` | Server error | ✅ Yes | NewsAPI backend issue |
| `NO_DATA` | No articles found | ❌ No | Query returned empty results |
| `ERROR` | Generic error | ✅ Yes | Network or parsing error |

### Yahoo Finance

| Code | Meaning | Retryable | Common Cause |
|------|---------|-----------|--------------|
| `403` | Forbidden | ⚠️ Maybe | Rate limiting or blocking |
| `404` | Symbol not found | ❌ No | Invalid symbol |
| `429` | Rate limit exceeded | ✅ Yes (after delay) | Unofficial API rate limit (~2000/hr) |
| `500` | Server error | ✅ Yes | Yahoo backend issue |
| `TIMEOUT` | Request timeout | ✅ Yes | Network latency |
| `NO_DATA` | No news found | ❌ No | Symbol has no recent news |
| `ERROR` | Generic error | ✅ Yes | Scraping failure |

---

## Usage Examples

### Example 1: Successful Fetch with Partial Failures

```typescript
const result = await getFreeStockNewsWithErrors('AAPL', env);

// Result:
{
  articles: [
    {
      title: "Apple Reports Record Q4 Earnings",
      summary: "Apple Inc. reported quarterly earnings...",
      publishedAt: "2026-01-14T10:00:00Z",
      source: "Reuters",
      url: "https://...",
      source_type: "dac_pool"
    },
    // ... 9 more articles
  ],
  providerErrors: [
    {
      provider: 'yahoo',
      code: '429',
      message: 'Rate limit exceeded. Retry after 60 seconds',
      timestamp: '2026-01-14T12:00:00Z',
      retryable: true
    }
  ],
  metadata: {
    totalProviders: 4,
    successfulProviders: 3,  // DAC, FMP, NewsAPI succeeded
    failedProviders: 1,      // Yahoo failed
    cacheHits: 2             // FMP and NewsAPI were cached
  }
}
```

**Interpretation**:
- ✅ 10 articles successfully retrieved
- ⚠️ Yahoo Finance failed with rate limit error
- ✅ 3/4 providers succeeded (75% success rate)
- ✅ 2 providers served from cache (reduced API calls)

### Example 2: Complete Failure (All Providers Fail)

```typescript
const result = await getFreeStockNewsWithErrors('INVALID_SYMBOL', env);

// Result:
{
  articles: [],
  providerErrors: [
    {
      provider: 'dac_pool',
      code: 'NOT_FOUND',
      message: 'Symbol not tracked in article pool',
      timestamp: '2026-01-14T12:00:00Z',
      retryable: false
    },
    {
      provider: 'fmp',
      code: '404',
      message: 'No news found for symbol INVALID_SYMBOL',
      timestamp: '2026-01-14T12:00:01Z',
      retryable: false
    },
    {
      provider: 'newsapi',
      code: 'NO_DATA',
      message: 'No articles returned from NewsAPI',
      timestamp: '2026-01-14T12:00:02Z',
      retryable: false
    },
    {
      provider: 'yahoo',
      code: 'NO_DATA',
      message: 'No articles returned from Yahoo Finance',
      timestamp: '2026-01-14T12:00:03Z',
      retryable: false
    }
  ],
  metadata: {
    totalProviders: 4,
    successfulProviders: 0,
    failedProviders: 4,
    cacheHits: 0
  }
}
```

**Interpretation**:
- ❌ Zero articles retrieved
- ❌ All 4 providers failed
- ℹ️ All errors are non-retryable (invalid symbol)
- 🔍 Error details available for troubleshooting

### Example 3: Handling Provider Errors in Application Code

```typescript
async function analyzeSymbol(symbol: string, env: any) {
  const newsResult = await getFreeStockNewsWithErrors(symbol, env);

  // Check if we have enough data
  if (newsResult.articles.length === 0) {
    // Log provider errors for troubleshooting
    logger.error(`No articles for ${symbol}`, {
      providerErrors: newsResult.providerErrors,
      failedProviders: newsResult.metadata.failedProviders
    });

    // Store errors in D1 for monitoring
    await storeProviderErrors(symbol, newsResult.providerErrors);

    // Return null or default analysis
    return {
      symbol,
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      providerErrors: newsResult.providerErrors
    };
  }

  // Check if we should retry based on error types
  const hasRetryableErrors = newsResult.providerErrors.some(e => e.retryable);
  if (newsResult.articles.length < 3 && hasRetryableErrors) {
    logger.warn(`Low article count for ${symbol}, retryable errors detected`, {
      articleCount: newsResult.articles.length,
      retryableErrors: newsResult.providerErrors.filter(e => e.retryable)
    });

    // Could implement retry logic here
    // await retryAfterDelay(symbol, env, 60000); // Retry after 60s
  }

  // Proceed with analysis using available articles
  return performAnalysis(newsResult.articles);
}
```

---

## D1 Storage Format

### Column: `symbol_predictions.error_message`

**Type**: TEXT (JSON string)

**Format**:
```json
{
  "type": "provider_errors",
  "count": 2,
  "errors": [
    {
      "p": "yahoo",
      "c": "429",
      "m": "Rate limit exceeded",
      "t": "2026-01-14",
      "r": true
    },
    {
      "p": "newsapi",
      "c": "NO_DATA",
      "m": "No articles returned from NewsAPI",
      "t": "2026-01-14",
      "r": false
    }
  ]
}
```

**Compact Keys** (to reduce storage size):
- `p` = provider
- `c` = code
- `m` = message (truncated to 200 chars)
- `t` = timestamp (date only, no time)
- `r` = retryable

**Size Guarantee**: Max 10 errors × 300 bytes = 3KB per row

### Querying Provider Errors

**Example 1: Get errors for a specific symbol**
```sql
SELECT
  symbol,
  json_extract(error_message, '$.count') as error_count,
  json_extract(error_message, '$.errors') as errors
FROM symbol_predictions
WHERE symbol = 'AAPL'
  AND error_message IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

**Example 2: Provider error rate over time**
```sql
SELECT
  date(created_at) as date,
  json_extract(error_message, '$.count') as avg_errors,
  COUNT(*) as affected_symbols,
  COUNT(*) * 100.0 / (
    SELECT COUNT(*)
    FROM symbol_predictions
    WHERE date(created_at) = date(sp.created_at)
  ) as error_rate_pct
FROM symbol_predictions sp
WHERE error_message IS NOT NULL
  AND json_extract(error_message, '$.type') = 'provider_errors'
  AND created_at >= date('now', '-30 days')
GROUP BY date(created_at)
ORDER BY date DESC;
```

**Example 3: Retryable vs non-retryable errors**
```sql
SELECT
  json_extract(e.value, '$.p') as provider,
  json_extract(e.value, '$.r') as retryable,
  COUNT(*) as error_count
FROM symbol_predictions sp,
     json_each(json_extract(sp.error_message, '$.errors')) as e
WHERE sp.error_message IS NOT NULL
  AND sp.created_at >= date('now', '-7 days')
GROUP BY provider, retryable
ORDER BY provider, retryable;
```

---

## Migration Guide

### Phase 1: Add New Function (No Breaking Changes)

**Week 2, Day 1**

Keep the old function as a backward-compatible wrapper:

```typescript
// OLD FUNCTION - Keep for backward compatibility
/**
 * @deprecated Use getFreeStockNewsWithErrors for error tracking
 * This function will be removed in v3.0
 */
export async function getFreeStockNews(
  symbol: string,
  env: any
): Promise<NewsArticle[]> {
  const result = await getFreeStockNewsWithErrors(symbol, env);
  return result.articles; // Drop error details for legacy consumers
}

// NEW FUNCTION - Use this for error-aware code
export async function getFreeStockNewsWithErrors(
  symbol: string,
  env: any
): Promise<FreeStockNewsResult> {
  // Implementation with error tracking
}
```

**Result**: Zero breaking changes, existing code continues to work

### Phase 2: Migrate High-Volume Call Sites

**Week 2-3**

Update files that handle the most traffic:

1. `src/modules/dual-ai-analysis.ts` (lines 639, 772)
2. `src/modules/per_symbol_analysis.ts` (lines 320, 415)
3. `src/modules/pre-market-data-bridge.ts` (line 212)

**Migration Pattern**:

```typescript
// BEFORE
const newsData = await getFreeStockNews(symbol, env);
if (newsData.length === 0) {
  return null; // Silent failure
}

// AFTER
const newsResult = await getFreeStockNewsWithErrors(symbol, env);
if (newsResult.articles.length === 0) {
  // Log errors for troubleshooting
  logger.warn(`No articles for ${symbol}`, {
    providerErrors: newsResult.providerErrors,
    failedProviders: newsResult.metadata.failedProviders
  });

  // Store in D1 for monitoring
  await storeProviderErrors(symbol, newsResult.providerErrors);

  return null;
}

// Use articles as before
const newsData = newsResult.articles;
```

### Phase 3: Migrate Remaining Call Sites + Deprecate

**Week 3**

Update remaining files:

1. `src/modules/optimized-ai-analysis.ts`
2. `src/modules/enhanced_analysis.ts`
3. `src/modules/enhanced_feature_analysis.ts`
4. `src/modules/free_sentiment_pipeline.ts` (internal call)
5. `src/modules/real-time-data-manager.ts`
6. `src/modules/tmp_rovodev_dual-ai-analysis.adapter.ts` (deprecate/remove)

**Note**: Removed `sector-rotation-workflow.ts` - no call site found in codebase verification.

### Phase 4: Monitor & Maintain

**Week 4+**

Add deprecation warning:

```typescript
export async function getFreeStockNews(symbol: string, env: any): Promise<NewsArticle[]> {
  // Log deprecation warning
  logger.warn('DEPRECATED: getFreeStockNews called. Migrate to getFreeStockNewsWithErrors', {
    symbol,
    caller: new Error().stack // Capture call stack for tracking
  });

  const result = await getFreeStockNewsWithErrors(symbol, env);
  return result.articles;
}
```

Remove after 2 sprints of deprecation warnings.

---

## Testing Guidelines

### Unit Tests

Test error aggregation logic:

```typescript
describe('ProviderError aggregation', () => {
  it('should aggregate errors from all providers', async () => {
    // Mock all providers to fail
    const result = await getFreeStockNewsWithErrors('TEST', mockEnv);

    expect(result.providerErrors).toHaveLength(4);
    expect(result.metadata.failedProviders).toBe(4);
  });

  it('should mark rate limit errors as retryable', async () => {
    // Mock 429 error
    const result = await getFreeStockNewsWithErrors('TEST', mockEnv);

    const rateLimitError = result.providerErrors.find(e => e.code === '429');
    expect(rateLimitError?.retryable).toBe(true);
  });
});
```

### Integration Tests

Test end-to-end error flow:

```bash
# Trigger job with intentional failure
curl -X POST "https://api/v1/jobs/pre-market" \
  -d '{"symbols": ["INVALID_SYMBOL"]}'

# Verify D1 storage
wrangler d1 execute PREDICT_JOBS_DB --remote \
  --command "SELECT error_message FROM symbol_predictions WHERE symbol='INVALID_SYMBOL'"

# Expected: JSON with provider errors
```

### Contract Tests

Verify error structure:

```typescript
describe('ProviderError contract', () => {
  it('should have required fields', async () => {
    const result = await getFreeStockNewsWithErrors('AAPL', env);

    result.providerErrors.forEach(error => {
      expect(error).toHaveProperty('provider');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('timestamp');
      expect(error).toHaveProperty('retryable');

      // Validate types
      expect(['dac_pool', 'fmp', 'newsapi', 'yahoo']).toContain(error.provider);
      expect(typeof error.message).toBe('string');
      expect(typeof error.retryable).toBe('boolean');
    });
  });
});
```

---

## Monitoring & Alerting

### Dashboard Queries

**Provider Error Rate**:
```sql
SELECT
  json_extract(e.value, '$.p') as provider,
  COUNT(*) as error_count,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM symbol_predictions WHERE created_at >= date('now', '-7 days')) as error_rate_pct
FROM symbol_predictions sp,
     json_each(json_extract(sp.error_message, '$.errors')) as e
WHERE sp.created_at >= date('now', '-7 days')
GROUP BY provider
ORDER BY error_count DESC;
```

**Retryable Error Trends**:
```sql
SELECT
  date(created_at) as date,
  COUNT(*) as total_errors,
  SUM(CASE WHEN json_extract(e.value, '$.r') = 1 THEN 1 ELSE 0 END) as retryable_errors
FROM symbol_predictions sp,
     json_each(json_extract(sp.error_message, '$.errors')) as e
WHERE sp.created_at >= date('now', '-30 days')
GROUP BY date
ORDER BY date DESC;
```

### Alert Thresholds

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High Error Rate | >10% symbols with errors | Warning | Check provider status |
| Provider Down | Single provider >50% error rate | Critical | Investigate API |
| Rate Limit Hit | 429 errors >5 in 1 hour | Warning | Reduce request frequency |
| Zero Articles | 100% symbols with 0 articles | Critical | Check all providers |

---

## Best Practices

### DO: Error Handling

✅ **Always log provider errors**
```typescript
if (result.providerErrors.length > 0) {
  logger.warn('Provider errors detected', {
    symbol,
    errors: result.providerErrors
  });
}
```

✅ **Store errors in D1 for troubleshooting**
```typescript
await writeSymbolPredictionToD1(env, symbol, date, {
  status: 'success',
  providerErrors: result.providerErrors
});
```

✅ **Check retryable flag before retrying**
```typescript
const retryable = result.providerErrors.filter(e => e.retryable);
if (retryable.length > 0) {
  await scheduleRetry(symbol, 60000); // Retry after 60s
}
```

### DON'T: Anti-Patterns

❌ **Don't ignore provider errors**
```typescript
// BAD
const articles = await getFreeStockNews(symbol, env);
// No visibility into why articles might be empty
```

❌ **Don't retry non-retryable errors**
```typescript
// BAD
for (const error of result.providerErrors) {
  await retryProvider(error.provider); // Wastes API quota
}
```

❌ **Don't log full error objects to console**
```typescript
// BAD - Clutters logs
console.log('Errors:', result.providerErrors);

// GOOD - Structured logging
logger.error('Provider errors', {
  symbol,
  errorCount: result.providerErrors.length,
  providers: result.providerErrors.map(e => e.provider)
});
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-14 | Initial contract definition |
| 1.1 | 2026-01-14 | **CORRECTIONS**: Updated call site count to 10 (verified), removed sector-rotation-workflow.ts, updated timeline to 3 weeks |

---

## Related Documents

- [NEWS_PROVIDER_ERROR_HANDLING_SPEC.md](./NEWS_PROVIDER_ERROR_HANDLING_SPEC.md) - Implementation specification
- [CLAUDE.md](../CLAUDE.md) - Project documentation
- [DAC_INTEGRATION_REVIEW.md](./DAC_INTEGRATION_REVIEW.md) - DAC integration details

---

**End of Contract**
