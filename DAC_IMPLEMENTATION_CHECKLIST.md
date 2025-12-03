# DAC Integration Update - Implementation Checklist

**Estimated Time**: 30 minutes  
**Difficulty**: Easy  
**Risk**: Low (can rollback in 2 minutes)

## Pre-Implementation (5 min)

- [ ] Read `DAC_UPDATE_SUMMARY.md` (executive overview)
- [ ] Read `DAC_QUICK_REFERENCE.md` (side-by-side comparison)
- [ ] Verify new client exists: `ls src/modules/dac-articles-pool-v2.ts`
- [ ] Backup current code: `git commit -am "backup before DAC v2 migration"`

## Implementation (10 min)

### File 1: `src/modules/free_sentiment_pipeline.ts`

- [ ] **Line ~30**: Change import
  ```typescript
  - import { DACArticlesAdapter } from './dac-articles-pool.js';
  + import { DACArticlesAdapterV2 } from './dac-articles-pool-v2.js';
  ```

- [ ] **Line ~40**: Change adapter instantiation
  ```typescript
  - const dacAdapter = new DACArticlesAdapter(env);
  + const dacAdapter = new DACArticlesAdapterV2(env);
  ```

- [ ] **Line ~42**: Simplify service binding check
  ```typescript
  - if (env.DAC_BACKEND || env.DAC_ARTICLES_POOL_URL) {
  + if (env.DAC_BACKEND) {
  ```

- [ ] **Optional**: Add enhanced logging after line ~45
  ```typescript
  console.log(`[DAC Pool V2] HIT for ${symbol} (${dacResult.articles.length} articles)`, {
    freshCount: dacResult.metadata?.freshCount,
    stale: dacResult.metadata?.stale,
    confidencePenalty: dacResult.confidencePenalty
  });
  ```

### File 2: `src/routes/enhanced-sentiment-routes.ts` (OPTIONAL)

- [ ] Add import at top
  ```typescript
  import { createDACArticlesPoolClientV2 } from '../modules/dac-articles-pool-v2.js';
  ```

- [ ] Update health check (find `dac_articles_pool` section)
  ```typescript
  const dacClient = createDACArticlesPoolClientV2(c.env);
  const dacHealthy = dacClient ? await dacClient.checkHealth() : false;
  
  dac_articles_pool: {
    status: dacHealthy ? 'healthy' : 'unhealthy',
    url: 'service-binding',
    version: 'v2'
  }
  ```

## Testing (10 min)

### Local Testing

- [ ] Start dev server: `npm run dev`
- [ ] Test sentiment endpoint:
  ```bash
  curl http://localhost:8787/api/v1/sentiment/symbols/AAPL
  ```
- [ ] Verify source type:
  ```bash
  curl http://localhost:8787/api/v1/sentiment/symbols/AAPL | jq '.articles[0].source_type'
  # Expected: "dac_pool"
  ```
- [ ] Check logs for "DAC Pool V2" messages
- [ ] Verify metadata exists:
  ```bash
  curl http://localhost:8787/api/v1/sentiment/symbols/AAPL | jq '.metadata'
  # Expected: { freshCount, stale, ttlSec, ... }
  ```

### Production Testing

- [ ] Deploy: `npm run deploy`
- [ ] Test production endpoint:
  ```bash
  curl https://tft-trading-system.yanggf.workers.dev/api/v1/sentiment/symbols/AAPL \
    -H "X-API-KEY: your_key"
  ```
- [ ] Check production logs in Cloudflare dashboard
- [ ] Verify no 404 errors from DAC
- [ ] Test multiple symbols (AAPL, MSFT, GOOGL)

## Verification (5 min)

### Success Criteria

- [ ] ✅ No TypeScript errors
- [ ] ✅ No runtime errors in logs
- [ ] ✅ Articles returned with `source_type: 'dac_pool'`
- [ ] ✅ Metadata includes `stale`, `ttlSec`, `freshCount`
- [ ] ✅ Logs show "DAC Pool V2" messages
- [ ] ✅ Confidence penalties calculated correctly
- [ ] ✅ No "404 Not Found" errors from DAC

### Performance Check

- [ ] Response time < 500ms (cached)
- [ ] Response time < 2s (uncached)
- [ ] Article count > 0 for major symbols
- [ ] Fresh article count > 0

## Troubleshooting

### Issue: "DAC backend service binding not available"

- [ ] Check `wrangler.toml` has service binding:
  ```toml
  [[services]]
  binding = "DAC_BACKEND"
  service = "dac-backend"
  environment = "production"
  ```
- [ ] Redeploy: `npm run deploy`

### Issue: "DAC API error: 401"

- [ ] Check API key is set:
  ```bash
  wrangler secret list
  # Should show: DAC_ARTICLES_POOL_API_KEY
  ```
- [ ] Update if needed:
  ```bash
  wrangler secret put DAC_ARTICLES_POOL_API_KEY
  # Enter: yanggf
  ```

### Issue: "No articles found for AAPL"

- [ ] Check DAC pool has data:
  ```bash
  curl https://dac-backend.yanggf.workers.dev/api/admin/article-pool/summary \
    -H "X-API-Key: yanggf"
  ```
- [ ] Trigger DAC harvest if empty:
  ```bash
  curl -X POST https://dac-backend.yanggf.workers.dev/api/admin/article-pool/harvest \
    -H "X-API-Key: yanggf"
  ```

### Issue: Articles have `stale: true`

- [ ] This is normal if data is >12h old
- [ ] Confidence penalty is automatically applied
- [ ] Articles are still usable
- [ ] Wait for next DAC harvest (daily at 13:00 UTC)

## Rollback (if needed)

- [ ] Revert changes:
  ```bash
  git checkout src/modules/free_sentiment_pipeline.ts
  git checkout src/routes/enhanced-sentiment-routes.ts
  ```
- [ ] Redeploy: `npm run deploy`
- [ ] Verify old behavior restored

## Post-Implementation

- [ ] Update CHANGELOG.md with changes
- [ ] Commit changes:
  ```bash
  git add .
  git commit -m "feat: Update DAC integration to v3.7.0+ Article Pool V2"
  ```
- [ ] Push to repository
- [ ] Monitor production logs for 24 hours
- [ ] Document any issues encountered

## Optional Enhancements (Future)

- [ ] Add sector article support
- [ ] Add category article support
- [ ] Add DAC quota monitoring to dashboard
- [ ] Add DAC pool metrics to health endpoint
- [ ] Add alerting for DAC pool failures

## Sign-Off

- [ ] Implementation completed by: ________________
- [ ] Date: ________________
- [ ] Testing verified by: ________________
- [ ] Production deployment confirmed: ________________
- [ ] No issues observed after 24h: ________________

## Notes

_Add any observations, issues, or improvements here:_

---

**Total Time Spent**: _______ minutes  
**Issues Encountered**: _______  
**Rollback Required**: Yes / No  
**Overall Success**: ⭐⭐⭐⭐⭐
