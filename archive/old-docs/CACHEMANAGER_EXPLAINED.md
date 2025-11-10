# Cache System - Durable Objects Architecture

**Last Updated**: 2025-11-07
**Status**: ✅ Production Ready - 100% DO Cache
**Architecture**: Single-layer Durable Objects cache (<1ms latency)

---

## 📋 Overview

The cache system uses **Cloudflare Durable Objects** for persistent, in-memory caching. This provides:

- ✅ **Automatic activation** - Works when DO binding is configured
- ✅ **Zero configuration** - No feature flags or secrets needed
- ✅ **Persistent storage** - SQLite-backed in-memory cache
- ✅ **Global consistency** - Single source of truth per cache instance
- ✅ **Sub-100ms performance** - Fast response times for cached data

---

## 🏗️ Architecture

### **Cache Flow**

```
Request Arrives
    ↓
createCacheInstance(env) called
    ↓
Check: env.CACHE_DO binding exists?
    ↓
YES → DualCacheDO instance returned
    ↓
Durable Object Cache (Persistent in-memory + SQLite)
    ↓ (cache hit)
Return cached data (sub-100ms)
    ↓ (cache miss)
External API (FMP/NewsAPI/Alpha Vantage)
    ↓
Cache result + return
    ↓
NO → null returned
    ↓
Direct API call (no caching)
```

### **Key Components**

1. **DualCacheDO Class** (`src/modules/dual-cache-do.ts`)
   - Durable Object implementation
   - In-memory storage with SQLite persistence
   - Handles get/set/delete/batch operations

2. **createCacheInstance()** Factory function
   - Returns `DualCacheDO | null`
   - Checks for DO binding availability
   - Single source of truth for cache creation

3. **DO Binding** (`wrangler.toml`)
   - Name: `CACHE_DO`
   - Class: `CacheDurableObject`
   - Required for cache to work

---

## 🚀 Usage

### **Basic Cache Operations**

```typescript
import { createCacheInstance } from './modules/dual-cache-do.js';

// Initialize cache (returns DualCacheDO | null)
const cache = createCacheInstance(env, true);

if (cache) {
  // Cache is available - use it
  
  // Get cached data
  const cachedData = await cache.get('my-key');
  
  if (cachedData) {
    console.log('Cache hit!');
    return cachedData;
  }
  
  // Cache miss - fetch from API
  const freshData = await fetchFromAPI();
  
  // Store in cache (TTL in seconds)
  await cache.set('my-key', freshData, 3600); // 1 hour
  
  return freshData;
} else {
  // No cache available - fetch directly
  console.log('Cache disabled, fetching directly');
  return await fetchFromAPI();
}
```

### **Batch Operations**

```typescript
// Get multiple keys at once
const cache = createCacheInstance(env);
if (cache) {
  const results = await cache.mget(['key1', 'key2', 'key3']);
  // Returns: [value1, value2, value3] or null for missing keys
  
  // Set multiple keys at once
  await cache.mset([
    { key: 'key1', value: data1, ttl: 3600 },
    { key: 'key2', value: data2, ttl: 1800 },
    { key: 'key3', value: data3, ttl: 7200 }
  ]);
}
```

### **Cache Health Check**

```typescript
const cache = createCacheInstance(env);
if (cache) {
  const health = await cache.health();
  console.log('Cache status:', health.status);
  console.log('Hit rate:', health.hitRate);
}
```

### **Cache Metrics**

```typescript
const cache = createCacheInstance(env);
if (cache) {
  const metrics = await cache.getMetrics();
  console.log('Total hits:', metrics.hits);
  console.log('Total misses:', metrics.misses);
  console.log('Hit rate:', metrics.hitRate);
}
```

---

## ⚙️ Configuration

### **1. Add DO Binding to wrangler.toml**

```toml
# Durable Objects binding for cache
[[durable_objects.bindings]]
name = "CACHE_DO"
class_name = "CacheDurableObject"

# Migrations
[[migrations]]
tag = "v1"
new_sqlite_classes = ["CacheDurableObject"]
```

### **2. Deploy**

```bash
wrangler deploy
```

**That's it!** Cache activates automatically when the binding exists.

### **3. Verify Cache is Working**

```bash
# Check cache health endpoint
curl https://your-worker.workers.dev/api/v1/cache/health

# Expected response:
{
  "status": "healthy",
  "enabled": true,
  "hitRate": 0.85,
  "metrics": { ... }
}
```

---

## 🎯 Common Patterns

### **Pattern 1: Try Cache First**

```typescript
async function getData(env: any, symbol: string) {
  const cache = createCacheInstance(env);
  const cacheKey = `stock:${symbol}`;
  
  // Try cache first
  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }
  
  // Fetch from API
  const data = await fetchStockData(symbol);
  
  // Cache for 1 hour
  if (cache) {
    await cache.set(cacheKey, data, 3600);
  }
  
  return data;
}
```

### **Pattern 2: Cache with Error Handling**

```typescript
async function getCachedOrFetch(env: any, key: string, fetcher: () => Promise<any>) {
  const cache = createCacheInstance(env);
  
  try {
    if (cache) {
      const cached = await cache.get(key);
      if (cached) return cached;
    }
    
    const data = await fetcher();
    
    if (cache && data) {
      await cache.set(key, data, 3600).catch(err => 
        console.error('Cache set failed:', err)
      );
    }
    
    return data;
  } catch (error) {
    console.error('Error in getCachedOrFetch:', error);
    throw error;
  }
}
```

### **Pattern 3: Conditional Caching**

```typescript
async function getMarketData(env: any, options: { useCache: boolean }) {
  const cache = options.useCache ? createCacheInstance(env) : null;
  
  if (cache) {
    const cached = await cache.get('market-data');
    if (cached) return cached;
  }
  
  const data = await fetchMarketData();
  
  if (cache) {
    await cache.set('market-data', data, 600); // 10 minutes
  }
  
  return data;
}
```

---

## 📊 Cache Key Naming Conventions

### **Standard Patterns**

```typescript
// Stock data
const key = `stock:${symbol}`;
// Example: "stock:AAPL"

// News articles
const key = `news:${symbol}:${date}`;
// Example: "news:AAPL:2025-01-15"

// Analysis results
const key = `analysis:${symbol}:${type}:${date}`;
// Example: "analysis:AAPL:technical:2025-01-15"

// Sector data
const key = `sector:${sectorName}:${metric}`;
// Example: "sector:technology:performance"

// Market indicators
const key = `market:${indicator}:${timeframe}`;
// Example: "market:vix:daily"
```

### **Best Practices**

- ✅ Use colons (`:`) as separators
- ✅ Include entity type as prefix
- ✅ Use lowercase for consistency
- ✅ Include date/time when data is time-sensitive
- ✅ Keep keys under 100 characters
- ❌ Don't use spaces or special characters
- ❌ Don't include PII or sensitive data in keys

---

## ⏱️ TTL Guidelines

### **Recommended TTLs by Data Type**

| Data Type | TTL | Reason |
|-----------|-----|--------|
| **Real-time prices** | 60s | Changes frequently |
| **Intraday analysis** | 5-10 min | Updates during trading hours |
| **Daily stock data** | 1 hour | Stable during trading day |
| **News articles** | 6-12 hours | Content doesn't change |
| **End-of-day analysis** | 24 hours | Valid until next trading day |
| **Historical data** | 7 days | Rarely changes |
| **Sector performance** | 15 min | Moderate update frequency |
| **Market indicators** | 5 min | Relatively stable |

### **TTL Constants**

```typescript
// Define in your code
export const CACHE_TTL = {
  REALTIME: 60,           // 1 minute
  SHORT: 300,             // 5 minutes
  MEDIUM: 900,            // 15 minutes
  LONG: 3600,             // 1 hour
  DAILY: 86400,           // 24 hours
  WEEKLY: 604800          // 7 days
} as const;

// Usage
await cache.set(key, data, CACHE_TTL.MEDIUM);
```

---

## 🔍 Debugging

### **Check if Cache is Available**

```typescript
const cache = createCacheInstance(env);
console.log('Cache available:', cache !== null);
```

### **Log Cache Operations**

```typescript
const cache = createCacheInstance(env);
if (cache) {
  console.log('Checking cache for key:', key);
  const result = await cache.get(key);
  console.log('Cache result:', result ? 'HIT' : 'MISS');
}
```

### **View Cache Metrics**

```bash
# Hit cache metrics endpoint
curl https://your-worker.workers.dev/api/v1/cache/metrics

# Response includes:
# - Total hits
# - Total misses
# - Hit rate percentage
# - Keys count
# - Memory usage
```

### **Common Issues**

#### **Cache Always Returns Null**

**Problem:** `createCacheInstance(env)` returns `null`

**Solutions:**
1. Check `wrangler.toml` has DO binding:
   ```toml
   [[durable_objects.bindings]]
   name = "CACHE_DO"
   class_name = "CacheDurableObject"
   ```

2. Verify deployment included DO:
   ```bash
   wrangler deploy
   ```

3. Check logs for errors:
   ```bash
   wrangler tail
   ```

#### **Cache Not Persisting**

**Problem:** Data disappears after worker restart

**Cause:** Durable Objects store data persistently, but very short TTLs may expire quickly.

**Solution:** Increase TTL or check if TTL is being set correctly.

#### **Slow Cache Performance**

**Problem:** Cache operations taking too long

**Solutions:**
1. Check DO location (may be far from user)
2. Reduce data size being cached
3. Use batch operations for multiple keys
4. Check metrics for high miss rate

---

## 📈 Performance Optimization

### **1. Use Batch Operations**

```typescript
// ❌ BAD: Multiple individual calls
for (const key of keys) {
  results.push(await cache.get(key));
}

// ✅ GOOD: Single batch call
const results = await cache.mget(keys);
```

### **2. Cache Expensive Operations**

```typescript
// Cache complex analysis results
const analysisKey = `analysis:${symbol}:${date}`;
const cached = await cache?.get(analysisKey);

if (!cached) {
  const result = await performExpensiveAnalysis(symbol);
  await cache?.set(analysisKey, result, CACHE_TTL.DAILY);
  return result;
}

return cached;
```

### **3. Use Appropriate TTLs**

```typescript
// Don't cache real-time data for too long
await cache.set('price:AAPL', price, 60); // 1 minute

// Cache stable data longer
await cache.set('history:AAPL', history, 86400); // 24 hours
```

### **4. Implement Cache Warming**

```typescript
// Pre-populate cache with common queries
async function warmCache(env: any) {
  const cache = createCacheInstance(env);
  if (!cache) return;
  
  const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN'];
  
  for (const symbol of symbols) {
    const data = await fetchStockData(symbol);
    await cache.set(`stock:${symbol}`, data, 3600);
  }
}
```

---

## 🔐 Security Considerations

### **1. Don't Cache Sensitive Data**

```typescript
// ❌ BAD: Caching user-specific data
await cache.set(`user:${userId}:portfolio`, portfolioData, 3600);

// ✅ GOOD: Cache public market data only
await cache.set(`market:indices`, indicesData, 300);
```

### **2. Validate Cached Data**

```typescript
const cached = await cache?.get(key);

if (cached) {
  // Validate structure and content
  if (isValidData(cached)) {
    return cached;
  } else {
    // Invalid cached data - remove it
    await cache.delete(key);
  }
}
```

### **3. Use Cache Namespacing**

```typescript
// Separate cache keys by environment
const env = process.env.ENVIRONMENT || 'dev';
const key = `${env}:stock:${symbol}`;
```

---

## 📚 API Reference

### **createCacheInstance(env, useDO?)**

Creates a cache instance if DO binding is available.

**Parameters:**
- `env: any` - Environment object containing bindings
- `useDO?: boolean` - Whether to use DO cache (default: `true`)

**Returns:** `DualCacheDO | null`

**Example:**
```typescript
const cache = createCacheInstance(env, true);
```

---

### **cache.get(key)**

Retrieves a value from the cache.

**Parameters:**
- `key: string` - Cache key

**Returns:** `Promise<any | null>`

**Example:**
```typescript
const data = await cache.get('stock:AAPL');
```

---

### **cache.set(key, value, ttl?)**

Stores a value in the cache.

**Parameters:**
- `key: string` - Cache key
- `value: any` - Value to cache (must be JSON-serializable)
- `ttl?: number` - Time to live in seconds (default: 3600)

**Returns:** `Promise<void>`

**Example:**
```typescript
await cache.set('stock:AAPL', stockData, 3600);
```

---

### **cache.delete(key)**

Removes a value from the cache.

**Parameters:**
- `key: string` - Cache key

**Returns:** `Promise<void>`

**Example:**
```typescript
await cache.delete('stock:AAPL');
```

---

### **cache.mget(keys)**

Retrieves multiple values at once.

**Parameters:**
- `keys: string[]` - Array of cache keys

**Returns:** `Promise<any[]>` - Array of values (null for missing keys)

**Example:**
```typescript
const values = await cache.mget(['stock:AAPL', 'stock:GOOGL']);
```

---

### **cache.mset(items)**

Stores multiple values at once.

**Parameters:**
- `items: Array<{ key: string, value: any, ttl?: number }>` - Array of items to cache

**Returns:** `Promise<void>`

**Example:**
```typescript
await cache.mset([
  { key: 'stock:AAPL', value: appleData, ttl: 3600 },
  { key: 'stock:GOOGL', value: googleData, ttl: 3600 }
]);
```

---

### **cache.health()**

Returns cache health status.

**Returns:** `Promise<{ status: string, hitRate?: number, metrics?: any }>`

**Example:**
```typescript
const health = await cache.health();
console.log(health.status); // "healthy" | "degraded" | "unavailable"
```

---

### **cache.getMetrics()**

Returns detailed cache metrics.

**Returns:** `Promise<{ hits: number, misses: number, hitRate: number, ... }>`

**Example:**
```typescript
const metrics = await cache.getMetrics();
console.log(`Hit rate: ${metrics.hitRate}%`);
```

---

## 🎯 Migration from Legacy Cache

If you have old code using the legacy `CacheManager`:

### **Before (Legacy)**
```typescript
import { CacheManager } from './modules/cache-manager.js';

const cacheManager = new CacheManager(env.CACHE_KV);
const data = await cacheManager.get('key');
await cacheManager.set('key', data, 3600);
```

### **After (Durable Objects)**
```typescript
import { createCacheInstance } from './modules/dual-cache-do.js';

const cache = createCacheInstance(env);
if (cache) {
  const data = await cache.get('key');
  await cache.set('key', data, 3600);
}
```

**Key Differences:**
- ✅ Use factory function instead of constructor
- ✅ Check if cache exists before using
- ✅ No KV namespace needed
- ✅ No feature flags or secrets required

---

## 📖 Additional Resources

- **Deployment Guide**: [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)
- **Simplification Summary**: [CACHE_SIMPLIFICATION_SUMMARY.md](CACHE_SIMPLIFICATION_SUMMARY.md)
- **System Features**: [docs/SYSTEM_FEATURES.md](docs/SYSTEM_FEATURES.md)

---

## ✅ Summary

**The cache system is:**
- ✅ **Simple** - One function, one binding, zero configuration
- ✅ **Fast** - Sub-100ms response times for cached data
- ✅ **Reliable** - Persistent storage with automatic activation
- ✅ **Scalable** - Durable Objects handle global distribution
- ✅ **Type-safe** - Full TypeScript support

**To use it:**
1. Add DO binding to `wrangler.toml`
2. Call `createCacheInstance(env)`
3. Use `cache.get()` / `cache.set()` / etc.
4. That's it! ✨

---

*Last updated: 2025-01-XX*  
*Cache Architecture: Durable Objects (Single-layer)*
