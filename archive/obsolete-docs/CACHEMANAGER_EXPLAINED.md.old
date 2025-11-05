# CacheManager - What Is It & What Is It Used For?

## 🎯 What is CacheManager?

`CacheManager` is a **dual-layer caching system** designed to speed up API responses by storing frequently requested data.

**Location**: `src/modules/cache-manager.ts`

---

## 🏗️ Architecture

### Two-Tier Caching System

```
┌─────────────────────────────────────────────┐
│  L1 Cache (In-Memory)                       │
│  • Type: Map in worker memory               │
│  • Speed: <1ms                              │
│  • Size: 1000 entries max                   │
│  • TTL: 15 minutes                          │
│  • Grace Period: 10 minutes                 │
│  • Purpose: Instant responses               │
└─────────────────────────────────────────────┘
                    ↓ Promotion
┌─────────────────────────────────────────────┐
│  L2 Cache (KV Namespace)                    │
│  • Type: Cloudflare KV storage              │
│  • Speed: 10-50ms                           │
│  • Size: Unlimited                          │
│  • TTL: 10 years (effectively infinite)     │
│  • Purpose: Persistent cache                │
└─────────────────────────────────────────────┘
```

---

## 📋 What Does It Cache?

### Cache Namespaces

CacheManager organizes cached data by **namespace**:

1. **`sentiment_analysis`** - Sentiment analysis results
   - Keys: `symbol_sentiment_AAPL_2025-11-01`
   - Stores: AI analysis results, recommendations, confidence scores

2. **`market_data`** - Stock market data
   - Keys: `market_data_AAPL_quote`
   - Stores: Stock prices, volume, market cap

3. **`reports`** - Generated reports
   - Keys: `reports_daily_2025-11-01`
   - Stores: Daily/weekly market reports

4. **`ai_results`** - AI processing results
   - Keys: `ai_results_GPT_analysis_AAPL`
   - Stores: GPT/DistilBERT analysis outputs

### Example Cache Keys

```
sentiment_analysis:symbol_sentiment_AAPL_2025-11-01
sentiment_analysis:symbol_sentiment_MSFT_2025-11-01
market_data:AAPL_quote
reports:daily_2025-11-01
```

---

## ⚡ How It Works

### Cache Flow

```
1. Request comes in
   ↓
2. Check L1 cache (in-memory)
   ├─ Hit? → Return instantly (<1ms)
   └─ Miss? → Continue
   ↓
3. Check L2 cache (KV)
   ├─ Hit? → Return data (10-50ms)
   │        + Promote to L1
   └─ Miss? → Continue
   ↓
4. Fetch fresh data (expensive operation)
   ↓
5. Store in L1 + L2
   ↓
6. Return to user
```

### Key Operations

**get(key, namespace)**
```typescript
// Retrieve cached data
const result = await cacheManager.get('symbol_sentiment_AAPL', 'sentiment_analysis');
// Returns: { data: {...}, source: 'l1' | 'l2' | 'fresh', hit: true | false }
```

**set(key, data, namespace, ttl)**
```typescript
// Store data in cache
await cacheManager.set('AAPL_sentiment', analysisResult, 'sentiment_analysis', 3600);
// Stores in both L1 and L2
```

---

## 🎯 What Is CacheManager Used For?

### 1. **Speed Up API Responses**
- **Without cache**: 5-30 seconds (fetch data, run AI analysis)
- **With cache**: <15ms (return cached result)

### 2. **Reduce External API Calls**
- FMP API: 100 requests/day → 5-20 requests/day (80% reduction)
- NewsAPI: 100 requests/day → 10-40 requests/day (60% reduction)
- Yahoo Finance: Rate limit protection

### 3. **Reduce AI Processing**
- GPT analysis: 30 seconds per symbol → 0 seconds (if cached)
- DistilBERT: 20 seconds per symbol → 0 seconds (if cached)

### 4. **Improve User Experience**
- Instant page loads
- No waiting for data processing
- Smooth dashboard experience

---

## 📊 Cache Manager Statistics

### What Gets Tracked

```typescript
interface CacheStats {
  totalRequests: number;    // Total cache accesses
  l1Hits: number;           // L1 cache hits
  l2Hits: number;           // L2 cache hits
  misses: number;           // Cache misses
  l1HitRate: number;        // L1 hit percentage
  l2HitRate: number;        // L2 hit percentage
  l1Size: number;           // L1 entries count
  l2Size: number;           // L2 entries count
  evictions: number;        // Items evicted
  errors: number;           // Cache errors
}
```

### Health Assessment

CacheManager also provides health checks:
- **Score**: 0-100 rating
- **Status**: healthy | warning | critical
- **Insights**: Performance analysis
- **Recommendations**: Optimization suggestions

---

## 🔧 Where Is CacheManager Used?

### 1. **Sentiment Analysis Routes**
```typescript
// routes/sentiment-routes.ts
const cacheKey = `symbol_sentiment_${symbol}_${date}`;
const cached = await cacheManager.get(cacheKey, 'sentiment_analysis');
if (cached.hit) {
  return cached.data; // Fast response
}
// ... fetch fresh data
await cacheManager.set(cacheKey, result, 'sentiment_analysis', 3600);
```

### 2. **Market Data Routes**
```typescript
// Fetch stock quote
const cached = await cacheManager.get(`${symbol}_quote`, 'market_data');
if (cached.hit) {
  return cached.data; // Instant price data
}
```

### 3. **Cache Management Endpoints**
```typescript
// api/v1/cache/health  - Health assessment
// api/v1/cache/metrics - Statistics
// api/v1/cache/config  - Configuration
// api/v1/cache/warmup  - Pre-populate cache
```

---

## 🚨 Why CacheManager Showed 0

### The Problem

**CacheManager was NEVER USED** by the routes!

**What happened**:
1. ✅ Routes used `createSimplifiedEnhancedDAL()` instead
2. ✅ DAL wrote to KV (news_fmp_AAPL_* keys)
3. ❌ CacheManager.read from empty cache (symbol_sentiment_AAPL_* keys)
4. ❌ Metrics read from CacheManager stats = 0

**Result**: CacheManager did nothing, showed 0 entries

### The Fix

Changed routes to use CacheManager:
```typescript
// Before
cacheInstance = createSimplifiedEnhancedDAL(env, {...});

// After
const cacheFactory = EnhancedCacheFactory.getInstance();
cacheInstance = cacheFactory.createCacheManager(env, { enableOptimized: true });
```

**Impact**: Routes and CacheManager now work together

---

## 🎯 Bottom Line

### What is CacheManager?
A **dual-layer caching system** that stores computed results to speed up API responses.

### What is it used for?
1. **Cache sentiment analysis results** - Avoid re-running AI
2. **Cache market data** - Avoid rate limits
3. **Cache reports** - Fast report generation
4. **Track cache performance** - Monitor hit rates, sizes, health

### Why was it showing 0?
Routes weren't using it - they used a different cache system (DAL)

### What's the fix?
Make routes use CacheManager (our fix does this)

---

## 📁 Key Files

- `src/modules/cache-manager.ts` - Main implementation
- `src/routes/enhanced-cache-routes.ts` - Cache management endpoints
- `src/routes/sentiment-routes.ts` - Routes that use cache (FIXED)

---

**Summary**: CacheManager is the system's **performance accelerator** - it stores expensive operations to make future requests instant. It was just not being used! ✅
