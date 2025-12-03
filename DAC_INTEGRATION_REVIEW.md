# DAC Article Pool Integration Review

**Date**: 2025-12-03  
**Status**: ⚠️ **OUTDATED** - CCT needs updates for DAC v3.7.0+ Article Pool V2

## 🚀 Quick Fix (Minimal Changes)

Since CCT uses Cloudflare service binding (`DAC_BACKEND`), the fastest fix is to update the endpoint URLs:

**File**: `src/modules/dac-articles-pool.ts`

```typescript
// ❌ CURRENT (WRONG)
const request = new Request(
  `https://dac-backend.workers.dev/api/articles/pool/${symbol}`,
  ...
);

// ✅ FIX (Use DAC admin endpoint)
const request = new Request(
  `https://dac-backend/api/admin/article-pool/probe/stock/${symbol}`,
  {
    method: 'GET',
    headers: {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json'
    }
  }
);
```

**Available DAC Admin Endpoints** (via service binding):
- `GET /api/admin/article-pool/probe/stock/:symbol` - Get stock articles
- `GET /api/admin/article-pool/probe/sector/:sector` - Get sector articles  
- `GET /api/admin/article-pool/probe/categories` - Get all category articles
- `GET /api/admin/article-pool/enhanced-status` - Pool health & quota
- `GET /api/admin/article-pool/summary` - Pool statistics

This requires **X-API-Key** header authentication (already configured in CCT).

---

## Executive Summary

CCT's DAC integration is **outdated** and needs updates to align with DAC's major Article Pool V2 refactoring (v3.7.0+). The current implementation uses legacy patterns that don't match DAC's new architecture.

**Note**: CCT uses Cloudflare service binding (`DAC_BACKEND`) for direct Worker-to-Worker calls to DAC.

### Critical Issues

1. **Wrong API Endpoints**: CCT calls non-existent `/api/articles/pool/:symbol` via service binding
2. **Outdated Types**: Missing v3.7.0+ type definitions (PoolKey, CategoryName, etc.)
3. **No Accessor Pattern**: Not using DAC's standardized `article-pool-accessors` module
4. **Missing Features**: No support for sectors/categories, only stocks
5. **Incorrect Service Binding Usage**: Calling wrong internal routes

---

## DAC Article Pool V2 Architecture (v3.7.0+)

### Key Changes

**1. Unified Pool System**
- **Stock Articles**: `stock:AAPL` (existing)
- **Sector Articles**: `sector:XLK` (new)
- **Category Articles**: `category:Geopolitical` (new)

**2. Accessor Pattern**
```typescript
// DAC's standardized accessors
import { 
  getArticlePoolStock,
  getArticlePoolSector,
  getArticlePoolCategories 
} from './article-pool-accessors';

// Usage
const result = await getArticlePoolStock(env, 'AAPL', { 
  includeStale: true,
  minFreshSec: 21600 // 6h
});
```

**3. Response Structure**
```typescript
interface ArticlePoolResponse {
  success: boolean;
  articles: NewsArticle[];
  metadata?: {
    fetchedAt: string;
    stale: boolean;
    ttlSec: number;
    lastErrorAt?: string;
    lastErrorCode?: string;
  };
  error?: 'NOT_FOUND' | 'STALE' | 'FRESHNESS_EXPIRED' | 'UNEXPECTED_ERROR';
  errorMessage?: string;
}
```

**4. Admin Endpoints** (for monitoring)
- `GET /api/admin/article-pool/summary` - Pool statistics
- `POST /api/admin/article-pool/harvest` - Manual harvest
- `GET /api/admin/article-pool/enhanced-status` - Quota & provider health

---

## Current CCT Implementation Issues

### File: `src/modules/dac-articles-pool.ts`

#### Issue 1: Wrong API Endpoints via Service Binding
```typescript
// ❌ WRONG - These endpoints don't exist in DAC
const request = new Request(
  `https://dac-backend.workers.dev/api/articles/pool/${symbol}`,
  ...
);
const response = await this.dacBackend.fetch(request);
```

**DAC Reality**: No `/api/articles/pool/:symbol` endpoint exists. DAC exposes:
- **Admin endpoints**: `/api/admin/article-pool/*` (protected, for monitoring)
- **Test endpoint**: `/api/test-article-pool` (dev-only)
- **Internal accessors**: `getArticlePoolStock()` (not exposed as HTTP endpoint)

**Service Binding Solution**: Since CCT uses service binding, we need DAC to expose internal accessor endpoints OR CCT should call DAC's admin endpoints with proper authentication.

#### Issue 2: Outdated Type Definitions
```typescript
// ❌ MISSING v3.7.0+ types
export interface DACArticlePoolEntry {
  articles: DACNewsArticle[];
  metadata: DACArticlePoolMetadata;
}
```

**Missing**:
- `PoolKey` type (`stock:SYMBOL | sector:SYMBOL | category:NAME`)
- `ArticlePoolResponse` interface
- `ArticlePoolAccessorOptions`
- Enhanced metadata fields (`version`, `ttlSec`, `stale`, `lastErrorAt`)

#### Issue 3: No Accessor Pattern
```typescript
// ❌ CCT uses HTTP requests
const response = await this.dacBackend.fetch(request);

// ✅ DAC uses direct accessors
const result = await getArticlePoolStock(env, symbol, options);
```

#### Issue 4: Limited Scope
```typescript
// ❌ Only supports stock articles
async getArticles(symbol: string): Promise<DACArticlePoolEntry | null>

// ✅ Should support all pool types
- getArticlePoolStock(env, 'AAPL')
- getArticlePoolSector(env, 'XLK')
- getArticlePoolCategories(env) // All 4 categories
```

---

## Recommended Updates

### 1. Update Type Definitions

**File**: `src/modules/dac-articles-pool.ts`

```typescript
// Import DAC v3.7.0+ types
import type {
  PoolKey,
  CategoryName,
  SectorSymbol,
  ArticlePoolEntry,
  ArticlePoolMetadata,
  ArticlePoolResponse,
  ArticlePoolAccessorOptions
} from '../types/dac-article-pool';

// Remove outdated DACArticlePoolEntry, use ArticlePoolEntry
```

### 2. Implement Correct Service Binding Pattern

**Current CCT Implementation** (WRONG):
```typescript
// ❌ Calls non-existent endpoint
const request = new Request(
  `https://dac-backend.workers.dev/api/articles/pool/${symbol}`,
  { headers: { 'X-API-Key': this.apiKey } }
);
const response = await this.dacBackend.fetch(request);
```

**Solution A: Use DAC Admin Endpoints** (Recommended - No DAC changes needed)
```typescript
export class DACArticlesPoolClient {
  private readonly dacBackend: Fetcher;
  private readonly apiKey: string;

  constructor(dacBackend: Fetcher, apiKey: string) {
    this.dacBackend = dacBackend;
    this.apiKey = apiKey;
  }

  /**
   * Get stock articles via service binding to DAC admin endpoint
   */
  async getStockArticles(
    symbol: string,
    options?: { includeStale?: boolean; minFreshSec?: number }
  ): Promise<ArticlePoolResponse> {
    try {
      // Call DAC's admin probe endpoint via service binding
      const request = new Request(
        `https://dac-backend/api/admin/article-pool/probe/stock/${symbol}`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

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
        throw new Error(`DAC API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform DAC admin response to ArticlePoolResponse format
      return {
        success: data.success,
        articles: data.articles || [],
        metadata: data.metadata,
        error: data.error,
        errorMessage: data.errorMessage
      };

    } catch (error) {
      logger.error('DAC_POOL', `Failed to get articles for ${symbol}`, {
        error: error instanceof Error ? error.message : 'Unknown'
      });
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
   */
  async getSectorArticles(
    sector: string,
    options?: { includeStale?: boolean }
  ): Promise<ArticlePoolResponse> {
    const request = new Request(
      `https://dac-backend/api/admin/article-pool/probe/sector/${sector}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    const response = await this.dacBackend.fetch(request);
    return await response.json();
  }

  /**
   * Get all category articles (v3.7.0+)
   */
  async getCategoryArticles(): Promise<{
    success: boolean;
    categories: {
      Geopolitical: ArticlePoolResponse;
      Monetary: ArticlePoolResponse;
      Economic: ArticlePoolResponse;
      Market: ArticlePoolResponse;
    };
  }> {
    const request = new Request(
      `https://dac-backend/api/admin/article-pool/probe/categories`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    const response = await this.dacBackend.fetch(request);
    return await response.json();
  }

  /**
   * Get pool health and quota status
   */
  async getEnhancedStatus(): Promise<any> {
    const request = new Request(
      `https://dac-backend/api/admin/article-pool/enhanced-status`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    const response = await this.dacBackend.fetch(request);
    return await response.json();
  }
}
```

**Solution B: Add Public Endpoints to DAC** (Requires DAC changes)

If you want cleaner separation, add public consumption endpoints to DAC:

```typescript
// In DAC: backend/src/index.ts
// Add new public endpoints for service binding consumers

if (path.startsWith('/api/pool/')) {
  // GET /api/pool/stock/:symbol
  if (path.match(/^\/api\/pool\/stock\/([A-Z]+)$/)) {
    const symbol = path.split('/').pop()!;
    const result = await getArticlePoolStock(env, symbol, { includeStale: true });
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // GET /api/pool/sector/:sector
  if (path.match(/^\/api\/pool\/sector\/([A-Z]+)$/)) {
    const sector = path.split('/').pop()!;
    const result = await getArticlePoolSector(env, sector as SectorSymbol);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // GET /api/pool/categories
  if (path === '/api/pool/categories') {
    const result = await getArticlePoolCategories(env);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

**Recommendation**: Use **Solution A** (admin endpoints) - no DAC changes needed, works immediately.

### 3. Add Sector & Category Support

```typescript
export class DACArticlesPoolClient {
  /**
   * Get sector articles (v3.7.0+)
   */
  async getSectorArticles(
    sector: SectorSymbol,
    options?: ArticlePoolAccessorOptions
  ): Promise<ArticlePoolResponse> {
    // Similar to getStockArticles but for sectors
  }

  /**
   * Get all category articles (v3.7.0+)
   */
  async getCategoryArticles(
    options?: ArticlePoolAccessorOptions
  ): Promise<{
    success: boolean;
    categories: {
      [K in CategoryName]: ArticlePoolResponse;
    };
  }> {
    // Fetch all 4 categories: Geopolitical, Monetary, Economic, Market
  }
}
```

### 4. Update Integration Adapter

**File**: `src/modules/free_sentiment_pipeline.ts`

```typescript
// Current usage
const dacAdapter = new DACArticlesAdapter(env);
const dacResult = await dacAdapter.getArticlesForSentiment(symbol);

// ✅ Update to use new client
const dacClient = new DACArticlesPoolClient(env);
const poolResult = await dacClient.getStockArticles(symbol, {
  includeStale: true,
  minFreshSec: 21600 // 6h freshness
});

if (poolResult.success && poolResult.articles.length > 0) {
  // Calculate confidence penalty based on metadata
  const penalty = calculateConfidencePenalty(
    poolResult.articles.length,
    poolResult.metadata?.freshCount || 0,
    poolResult.metadata?.stale || false
  );
  
  return {
    articles: poolResult.articles,
    source: 'dac_pool',
    confidencePenalty: penalty,
    metadata: poolResult.metadata
  };
}
```

### 5. Add Health Monitoring

```typescript
export class DACArticlesPoolClient {
  /**
   * Check pool health and quota status (v3.8.0+)
   */
  async getEnhancedStatus(): Promise<{
    success: boolean;
    quota: QuotaInfo;
    providerHealth: ProviderHealth;
    summary: {
      totalPools: number;
      freshPools: number;
      stalePools: number;
      quotaUtilization: number;
      recommendation: string;
    };
  }> {
    const url = this.env.DAC_ARTICLES_POOL_URL || 
                'https://dac-backend.yanggf.workers.dev';
    
    const response = await fetch(
      `${url}/api/admin/article-pool/enhanced-status`,
      {
        headers: {
          'X-API-Key': this.env.DAC_ARTICLES_POOL_API_KEY || 'yanggf'
        }
      }
    );

    return await response.json();
  }
}
```

---

## Migration Plan

### Phase 1: Type Definitions (1 hour)
1. Create `src/types/dac-article-pool.ts` with v3.7.0+ types
2. Update imports in `dac-articles-pool.ts`
3. Remove outdated type definitions

### Phase 2: Client Refactor (2 hours)
1. Implement new `DACArticlesPoolClient` with accessor pattern
2. Add service binding + HTTP fallback support
3. Add sector & category support
4. Update error handling to match `ArticlePoolResponse`

### Phase 3: Integration Update (1 hour)
1. Update `free_sentiment_pipeline.ts` to use new client
2. Update confidence penalty calculation
3. Add metadata tracking

### Phase 4: Testing (1 hour)
1. Test service binding path (if available)
2. Test HTTP fallback path
3. Test error handling (NOT_FOUND, STALE, etc.)
4. Verify confidence penalties

### Phase 5: Monitoring (30 min)
1. Add health check integration
2. Add quota monitoring
3. Update dashboard to show DAC pool status

---

## Testing Checklist

- [ ] Service binding works (if `DAC_BACKEND` configured)
- [ ] HTTP fallback works (without service binding)
- [ ] Stock articles fetch correctly
- [ ] Sector articles fetch correctly (new)
- [ ] Category articles fetch correctly (new)
- [ ] Stale data handling works
- [ ] Confidence penalties calculated correctly
- [ ] Error responses handled gracefully
- [ ] Health monitoring works
- [ ] Quota tracking works

---

## Configuration Updates

### Environment Variables

**Current**:
```bash
DAC_BACKEND=<service-binding>  # Optional
DAC_ARTICLES_POOL_API_KEY=yanggf
```

**Add**:
```bash
DAC_ARTICLES_POOL_URL=https://dac-backend.yanggf.workers.dev  # HTTP fallback
DAC_POOL_MIN_FRESH_SEC=21600  # 6h freshness threshold
DAC_POOL_INCLUDE_STALE=true   # Allow stale data
```

### Wrangler Configuration

**File**: `wrangler.toml`

```toml
# Service binding (preferred)
[[services]]
binding = "DAC_BACKEND"
service = "dac-backend"
environment = "production"

# Environment variables
[vars]
DAC_ARTICLES_POOL_URL = "https://dac-backend.yanggf.workers.dev"
DAC_POOL_MIN_FRESH_SEC = "21600"
DAC_POOL_INCLUDE_STALE = "true"
```

---

## Benefits of Update

1. **Correctness**: Uses actual DAC endpoints that exist
2. **Performance**: Direct DO access via service binding (faster)
3. **Reliability**: HTTP fallback for environments without service binding
4. **Features**: Access to sectors & categories (not just stocks)
5. **Monitoring**: Quota & provider health tracking
6. **Type Safety**: v3.7.0+ type definitions prevent errors
7. **Maintainability**: Aligned with DAC's architecture patterns

---

## References

- **DAC README**: `/home/yanggf/a/dac/README.md`
- **Article Pool Types**: `/home/yanggf/a/dac/backend/src/types/article-pool.ts`
- **Accessors**: `/home/yanggf/a/dac/backend/src/modules/article-pool-accessors.ts`
- **Admin Routes**: `/home/yanggf/a/dac/backend/src/routes/article-pool-admin-routes.ts`
- **Stock Sentiment**: `/home/yanggf/a/dac/backend/src/modules/stock-sentiment.ts` (reference implementation)

---

## Next Steps

1. **Review this document** with team
2. **Prioritize migration** (recommend Phase 1-3 as MVP)
3. **Create feature branch**: `feature/dac-article-pool-v2`
4. **Implement changes** following migration plan
5. **Test thoroughly** using checklist
6. **Deploy to staging** first
7. **Monitor metrics** before production rollout
