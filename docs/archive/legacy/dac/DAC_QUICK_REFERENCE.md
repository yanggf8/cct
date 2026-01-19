# DAC Integration Quick Reference

## Current vs Updated

### API Endpoints

| Type | Current (BROKEN) | Updated (WORKS) |
|------|------------------|-----------------|
| Stock | `/api/articles/pool/AAPL` ❌ | `/api/admin/article-pool/probe/stock/AAPL` ✅ |
| Sector | Not supported ❌ | `/api/admin/article-pool/probe/sector/XLK` ✅ |
| Categories | Not supported ❌ | `/api/admin/article-pool/probe/categories` ✅ |
| Health | Basic ❌ | `/api/admin/article-pool/enhanced-status` ✅ |

### Code Changes

```typescript
// BEFORE (src/modules/free_sentiment_pipeline.ts)
import { DACArticlesAdapter } from './dac-articles-pool.js';
const dacAdapter = new DACArticlesAdapter(env);
if (env.DAC_BACKEND || env.DAC_ARTICLES_POOL_URL) {
  const dacResult = await dacAdapter.getArticlesForSentiment(symbol);
}

// AFTER (src/modules/free_sentiment_pipeline.ts)
import { DACArticlesAdapterV2 } from './dac-articles-pool-v2.js';
const dacAdapter = new DACArticlesAdapterV2(env);
if (env.DAC_BACKEND) {
  const dacResult = await dacAdapter.getArticlesForSentiment(symbol);
}
```

### Response Format

```typescript
// BEFORE (Custom format)
{
  articles: NewsArticle[];
  metadata: {
    fetchedAt: string;
    runWindow: string;
    freshCount: number;
    // ... limited fields
  };
}

// AFTER (DAC v3.7.0+ format)
{
  success: boolean;
  articles: NewsArticle[];
  metadata: {
    fetchedAt: string;
    stale: boolean;           // NEW
    ttlSec: number;           // NEW
    freshCount: number;
    oldestAgeHours: number;
    source: 'Finnhub' | 'NewsData.io' | 'mixed';
    lastErrorAt?: string;     // NEW
    lastErrorCode?: string;   // NEW
  };
  error?: 'NOT_FOUND' | 'STALE' | 'FRESHNESS_EXPIRED' | 'UNEXPECTED_ERROR';
  errorMessage?: string;
}
```

### Service Binding Usage

```typescript
// BEFORE (Wrong URL)
const request = new Request(
  `https://dac-backend.workers.dev/api/articles/pool/${symbol}`,
  { headers: { 'X-API-Key': apiKey } }
);
const response = await env.DAC_BACKEND.fetch(request);

// AFTER (Correct URL)
const request = new Request(
  `https://dac-backend/api/admin/article-pool/probe/stock/${symbol}`,
  { headers: { 'X-API-Key': apiKey } }
);
const response = await env.DAC_BACKEND.fetch(request);
```

## Testing Commands

```bash
# Local testing
npm run dev
curl http://localhost:8787/api/v1/sentiment/symbols/AAPL

# Check source type
curl http://localhost:8787/api/v1/sentiment/symbols/AAPL | jq '.articles[0].source_type'
# Should return: "dac_pool"

# Check metadata
curl http://localhost:8787/api/v1/sentiment/symbols/AAPL | jq '.metadata'
# Should show: freshCount, stale, ttlSec

# Production testing
curl https://tft-trading-system.yanggf.workers.dev/api/v1/sentiment/symbols/AAPL \
  -H "X-API-KEY: your_key"
```

## Log Messages

```bash
# BEFORE (Silent failure or generic errors)
[DAC Pool] HIT for AAPL (5 articles)

# AFTER (Detailed metadata)
[DAC Pool V2] HIT for AAPL (5 articles) {
  freshCount: 4,
  stale: false,
  confidencePenalty: 0
}
```

## Files Changed

1. `src/modules/free_sentiment_pipeline.ts` - Update import & adapter
2. `src/routes/enhanced-sentiment-routes.ts` - Update health check (optional)

## Files Added

1. `src/modules/dac-articles-pool-v2.ts` - New client implementation

## Configuration

```toml
# wrangler.toml
[[services]]
binding = "DAC_BACKEND"
service = "dac-backend"
environment = "production"

[vars]
DAC_ARTICLES_POOL_API_KEY = "yanggf"
```

## Rollback

```bash
# Revert changes in free_sentiment_pipeline.ts
git checkout src/modules/free_sentiment_pipeline.ts

# Redeploy
npm run deploy
```

## Success Indicators

✅ Logs show "DAC Pool V2" messages  
✅ Articles have `source_type: 'dac_pool'`  
✅ Metadata includes `stale`, `ttlSec`, `freshCount`  
✅ No "404 Not Found" errors from DAC  
✅ Confidence penalties calculated correctly  

## Failure Indicators

❌ "DAC backend service binding not available" - Check wrangler.toml  
❌ "DAC API error: 401" - Check API key  
❌ "DAC API error: 404" - Wrong endpoint URL  
❌ No articles returned - DAC pool empty, trigger harvest  

## Support

- Migration Guide: `DAC_MIGRATION_GUIDE.md`
- Technical Review: `DAC_INTEGRATION_REVIEW.md`
- DAC Documentation: `/home/yanggf/a/dac/README.md`
