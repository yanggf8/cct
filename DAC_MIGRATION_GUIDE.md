# DAC Article Pool V2 Migration Guide

**Target**: Update CCT to use DAC v3.7.0+ Article Pool V2 architecture  
**Effort**: ~30 minutes  
**Risk**: Low (backward compatible, can rollback easily)

## Overview

CCT currently calls non-existent DAC endpoints via service binding. This guide updates CCT to use DAC's actual admin probe endpoints.

## Files to Update

1. `src/modules/free_sentiment_pipeline.ts` - Update DAC adapter usage
2. `src/routes/enhanced-sentiment-routes.ts` - Update health checks (optional)

## Step-by-Step Migration

### Step 1: Add New Client (5 min)

The new client is already created at `src/modules/dac-articles-pool-v2.ts`.

**Verify it exists**:
```bash
ls -la src/modules/dac-articles-pool-v2.ts
```

### Step 2: Update Sentiment Pipeline (10 min)

**File**: `src/modules/free_sentiment_pipeline.ts`

**Current code**:
```typescript
import { DACArticlesAdapter } from './dac-articles-pool.js';

// Inside fetchNewsArticles function
const dacAdapter = new DACArticlesAdapter(env);
if (env.DAC_BACKEND || env.DAC_ARTICLES_POOL_URL) {
  const dacResult = await dacAdapter.getArticlesForSentiment(symbol);
  if (dacResult.source === 'dac_pool' && dacResult.articles.length > 0) {
    // ... use articles
  }
}
```

**Updated code**:
```typescript
// Change import
import { DACArticlesAdapterV2 } from './dac-articles-pool-v2.js';

// Inside fetchNewsArticles function
const dacAdapter = new DACArticlesAdapterV2(env);
if (env.DAC_BACKEND) {  // Only check service binding
  const dacResult = await dacAdapter.getArticlesForSentiment(symbol);
  if (dacResult.source === 'dac_pool' && dacResult.articles.length > 0) {
    console.log(`[DAC Pool V2] HIT for ${symbol} (${dacResult.articles.length} articles)`, {
      freshCount: dacResult.metadata?.freshCount,
      stale: dacResult.metadata?.stale,
      confidencePenalty: dacResult.confidencePenalty
    });
    return dacResult.articles.map(article => ({
      title: article.title,
      source: article.source,
      url: article.url,
      published_date: article.published_date || article.publishedAt,
      summary: article.summary || '',
      sentiment: article.sentiment || 'neutral',
      source_type: 'dac_pool'
    }));
  }
}
```

**Exact changes**:
1. Line ~30: Change `import { DACArticlesAdapter }` to `import { DACArticlesAdapterV2 }`
2. Line ~40: Change `new DACArticlesAdapter(env)` to `new DACArticlesAdapterV2(env)`
3. Line ~42: Change `if (env.DAC_BACKEND || env.DAC_ARTICLES_POOL_URL)` to `if (env.DAC_BACKEND)`
4. Add logging for metadata (optional but recommended)

### Step 3: Update Enhanced Sentiment Routes (5 min) - OPTIONAL

**File**: `src/routes/enhanced-sentiment-routes.ts`

**Find this section** (around line 80-100):
```typescript
const overallHealthy = health.dac_pool && health.cache && ...
```

**Update to**:
```typescript
import { createDACArticlesPoolClientV2 } from '../modules/dac-articles-pool-v2.js';

// In health check handler
const dacClient = createDACArticlesPoolClientV2(c.env);
const dacHealthy = dacClient ? await dacClient.checkHealth() : false;

const overallHealthy = dacHealthy && health.cache && ...

// Update response
dac_articles_pool: {
  status: dacHealthy ? 'healthy' : 'unhealthy',
  url: 'service-binding',
  version: 'v2'
}
```

### Step 4: Test the Changes (10 min)

**Test 1: Local Development**
```bash
# Start local dev server
npm run dev

# Test sentiment analysis
curl http://localhost:8787/api/v1/sentiment/symbols/AAPL
```

**Test 2: Check DAC Integration**
```bash
# Check if articles are coming from DAC pool
curl http://localhost:8787/api/v1/sentiment/symbols/AAPL | jq '.articles[0].source_type'
# Should return: "dac_pool"
```

**Test 3: Check Logs**
Look for these log messages:
```
[DAC Pool V2] HIT for AAPL (5 articles)
```

**Test 4: Verify Metadata**
```bash
curl http://localhost:8787/api/v1/sentiment/symbols/AAPL | jq '.metadata'
# Should show: freshCount, stale, ttlSec, etc.
```

### Step 5: Deploy (5 min)

```bash
# Deploy to production
npm run deploy

# Verify production
curl https://tft-trading-system.yanggf.workers.dev/api/v1/sentiment/symbols/AAPL \
  -H "X-API-KEY: your_key"
```

## Verification Checklist

- [ ] New client file exists: `src/modules/dac-articles-pool-v2.ts`
- [ ] Import updated in `free_sentiment_pipeline.ts`
- [ ] Adapter class name updated to `DACArticlesAdapterV2`
- [ ] Service binding check updated (removed URL fallback)
- [ ] Local testing passes
- [ ] Logs show "DAC Pool V2" messages
- [ ] Articles have `source_type: 'dac_pool'`
- [ ] Metadata includes `freshCount`, `stale`, etc.
- [ ] Production deployment successful
- [ ] Production testing passes

## Rollback Plan

If issues occur, rollback is simple:

**Revert Step 2 changes**:
```typescript
// Change back to old import
import { DACArticlesAdapter } from './dac-articles-pool.js';

// Change back to old adapter
const dacAdapter = new DACArticlesAdapter(env);
if (env.DAC_BACKEND || env.DAC_ARTICLES_POOL_URL) {
  // ... old code
}
```

**Redeploy**:
```bash
npm run deploy
```

## What's Different?

| Aspect | Old (V1) | New (V2) |
|--------|----------|----------|
| **Endpoint** | `/api/articles/pool/:symbol` (doesn't exist) | `/api/admin/article-pool/probe/stock/:symbol` (exists) |
| **Response** | Custom format | DAC `ArticlePoolResponse` format |
| **Metadata** | Limited | Full v3.7.0+ metadata (freshCount, stale, ttlSec) |
| **Error Handling** | Basic | Typed errors (NOT_FOUND, STALE, etc.) |
| **Sectors** | Not supported | Supported via `getSectorArticles()` |
| **Categories** | Not supported | Supported via `getCategoryArticles()` |
| **Health Check** | Basic | Enhanced with quota & provider status |

## Benefits

1. **Works Immediately**: Uses actual DAC endpoints that exist
2. **Better Metadata**: Access to freshness, staleness, TTL info
3. **Better Errors**: Typed error responses for debugging
4. **Future-Ready**: Supports sectors & categories (v3.7.0+)
5. **Better Monitoring**: Enhanced status with quota tracking

## Troubleshooting

### Issue: "DAC backend service binding not available"

**Cause**: `DAC_BACKEND` not configured in `wrangler.toml`

**Fix**: Add service binding:
```toml
[[services]]
binding = "DAC_BACKEND"
service = "dac-backend"
environment = "production"
```

### Issue: "DAC API error: 401"

**Cause**: Invalid API key

**Fix**: Update API key:
```bash
wrangler secret put DAC_ARTICLES_POOL_API_KEY
# Enter: yanggf
```

### Issue: "No articles found for AAPL"

**Cause**: DAC pool doesn't have articles for that symbol yet

**Fix**: Trigger DAC harvest:
```bash
curl -X POST https://dac-backend.yanggf.workers.dev/api/admin/article-pool/harvest \
  -H "X-API-Key: yanggf"
```

### Issue: Articles have `stale: true`

**Cause**: DAC pool data is >12h old

**Fix**: This is normal. Articles are still usable, just apply confidence penalty (already handled in code).

## Next Steps (Optional Enhancements)

1. **Add Sector Support**: Use `getSectorArticles()` for sector rotation analysis
2. **Add Category Support**: Use `getCategoryArticles()` for market drivers
3. **Add Quota Monitoring**: Display DAC quota status in CCT dashboard
4. **Add Pool Metrics**: Show pool health in CCT health endpoint

## Questions?

- Check DAC documentation: `/home/yanggf/a/dac/README.md`
- Review DAC types: `/home/yanggf/a/dac/backend/src/types/article-pool.ts`
- Check DAC admin routes: `/home/yanggf/a/dac/backend/src/routes/article-pool-admin-routes.ts`
