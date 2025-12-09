# DAC External Service Design Review & CCT Integration Opportunities

**Date**: 2025-12-10  
**DAC Version**: v3.9.10  
**CCT Status**: Currently using DAC Article Pool v2.0 (integrated 2025-12-03)

## Executive Summary

DAC has evolved a sophisticated external service architecture with **3 resource pools**, **API adapters with retry/circuit breaker logic**, and **D1-backed quota management**. CCT currently only uses the Article Pool. This document identifies additional integration opportunities.

---

## 1. DAC's Pool Pattern Architecture

### Core Concept: Pre-Computed Resource Caching

DAC uses a "pool pattern" where expensive external API operations are:
1. **Pre-computed** during scheduled warming (GitHub Actions)
2. **Stored in KV** with TTL-based expiration
3. **Read-only at runtime** - zero API calls during user requests

### Available Pools

| Pool | Purpose | Storage | TTL | Warming Schedule | CCT Usage |
|------|---------|---------|-----|------------------|-----------|
| **Article Pool** | News articles (stocks, sectors, categories) | KV + DO | 12h | Daily 13:00 UTC | ✅ **IN USE** |
| **Money Flow Pool** | Pre-computed CMF/OBV indicators | KV | 12h | Daily warming | ❌ **NOT USED** |
| **Stock Article Pool** | Portfolio-based stock articles | KV + DO | 24h | Daily 01:00 UTC | ❌ **NOT USED** |

---

## 2. Money Flow Pool (Priority 1 Opportunity)

### What It Provides

Pre-computed money flow indicators stored in KV:

```typescript
interface MoneyFlowPoolEntry {
  data: {
    cmf: number;                    // Chaikin Money Flow
    obv: number;                    // On-Balance Volume
    trend: 'ACCUMULATION' | 'DISTRIBUTION';  // Binary classification
    latestPrice?: number;
  };
  metadata: {
    symbol: string;
    window: '1mo' | '3mo' | '6mo';
    pointsUsed: number;
    historyFrom: string;
    historyTo: string;
    computedAt: string;
    quality: 'fresh' | 'stale';
    source: 'yahoo';
    version: 1;
  };
}
```

### How It Works

1. **Warming Phase** (GitHub Actions):
   - Historical data pre-warmed via `/api/admin/warm-history`
   - Money flow computed from cached data (no Yahoo API calls)
   - Results stored in `MONEY_FLOW_POOL` KV namespace

2. **Runtime Phase** (User Requests):
   - Read from KV pool (zero API calls)
   - Return pre-computed indicators
   - 12h TTL ensures freshness

### CCT Integration Value

**Current State**: CCT calls Yahoo Finance API for money flow during sentiment analysis

**With Money Flow Pool**:
- ✅ Eliminate Yahoo Finance API calls
- ✅ Faster response times (<10ms vs 500ms+)
- ✅ No rate limiting issues
- ✅ Consistent data quality

### Implementation Effort

**Estimated Time**: 2-4 hours

**Steps**:
1. Add `MONEY_FLOW_POOL` KV binding to `wrangler.toml`
2. Create adapter module: `src/modules/dac-money-flow-adapter.ts`
3. Update sentiment pipeline to use pool
4. Add fallback to Yahoo Finance if pool miss

**Code Example**:

```typescript
// src/modules/dac-money-flow-adapter.ts
export class DACMoneyFlowAdapter {
  async getMoneyFlow(symbol: string): Promise<MoneyFlowIndicators | null> {
    const request = new Request(
      `https://dac-backend/api/admin/moneyflow/probe/${symbol}`,
      {
        method: 'GET',
        headers: { 'X-API-Key': this.apiKey }
      }
    );
    
    const response = await this.dacBackend.fetch(request);
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      cmf: data.data.cmf,
      obv: data.data.obv,
      trend: data.data.trend,
      cached: true,
      cachedAt: data.metadata.computedAt
    };
  }
}
```

---

## 3. Stock Article Pool (Priority 2 Opportunity)

### What It Provides

Portfolio-based article pre-harvest:
- **50 symbols/day budget** (configurable)
- **5 articles per symbol**
- **24h TTL**
- **Emergency fetch write-back**

### CCT Integration Value

**Current State**: CCT uses DAC Article Pool for general stock articles

**With Stock Article Pool**:
- ✅ Portfolio-specific article caching
- ✅ Predictable quota usage
- ✅ Faster portfolio analysis
- ✅ Budget-controlled warming

### Implementation Consideration

CCT already uses DAC Article Pool via service binding. Stock Article Pool is a **subset optimization** for portfolio holdings. Integration would require:

1. Portfolio symbol tracking in CCT
2. Warming coordination with DAC
3. Fallback to general Article Pool

**Recommendation**: Defer until CCT has stable portfolio management.

---

## 4. Adapter Pattern (Architectural Learning)

### DAC's API Adapter Design

All external APIs use centralized adapters with:

#### 4.1 Rate Limiting
```typescript
class YahooApiAgent {
  private lastRequestTime: number = 0;
  private readonly REQUEST_DELAY_MS = 1000;
  
  async fetch(url: string): Promise<Response> {
    await this.acquireRateLimitSlot();
    // ... request logic
  }
}
```

#### 4.2 Request Deduplication
```typescript
private pendingRequests: Map<string, Promise<Response>> = new Map();

async fetch(url: string): Promise<Response> {
  const existing = this.pendingRequests.get(url);
  if (existing) return existing; // Deduplicate concurrent requests
  
  const promise = this.executeRequest(url);
  this.pendingRequests.set(url, promise);
  return promise;
}
```

#### 4.3 Retry with Exponential Backoff
```typescript
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  if (response.status === 429) {
    const backoffSeconds = [2, 5, 15][attempt - 1];
    await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));
    continue;
  }
}
```

#### 4.4 Circuit Breaker Pattern
```typescript
if (consecutiveFailures >= threshold) {
  logger.warn('Circuit breaker OPEN - skipping API call');
  return cachedData;
}
```

### CCT Adoption Opportunities

**Current State**: CCT has basic Yahoo Finance integration

**Improvements**:
1. ✅ Centralize Yahoo Finance calls in adapter
2. ✅ Add request deduplication
3. ✅ Implement circuit breaker for FRED API
4. ✅ Add retry logic with backoff

**Example Adapter**:

```typescript
// src/modules/yahoo-finance-adapter.ts
export class YahooFinanceAdapter {
  private pendingRequests = new Map<string, Promise<any>>();
  private lastRequestTime = 0;
  private readonly RATE_LIMIT_MS = 1000;
  
  async fetchHistoricalData(symbol: string, range: string): Promise<any> {
    const cacheKey = `${symbol}:${range}`;
    
    // Deduplication
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }
    
    // Rate limiting
    await this.waitForRateLimit();
    
    // Execute with retry
    const promise = this.executeWithRetry(symbol, range);
    this.pendingRequests.set(cacheKey, promise);
    
    promise.finally(() => this.pendingRequests.delete(cacheKey));
    return promise;
  }
  
  private async executeWithRetry(symbol: string, range: string, maxRetries = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`https://query1.finance.yahoo.com/...`);
        
        if (response.ok) return await response.json();
        
        if (response.status === 429 && attempt < maxRetries) {
          const backoff = [2, 5, 15][attempt - 1] * 1000;
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
}
```

---

## 5. Quota Management System (Priority 3 Opportunity)

### DAC's Quota Architecture

#### 5.1 D1 Database Tracking
```sql
CREATE TABLE quota_usage (
  id INTEGER PRIMARY KEY,
  service TEXT NOT NULL,
  date TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  limit INTEGER NOT NULL,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### 5.2 Real-Time Monitoring
- `/api/quota` - Current usage across all services
- `/api/quota/diagnostics` - Detailed service health
- `/api/quota/warming-history` - Historical warming results

#### 5.3 Budget Allocation
```typescript
interface QuotaBudget {
  dailyLimit: number;
  allocations: {
    scheduled: number;    // GitHub Actions warming
    emergency: number;    // Runtime fallback
    onDemand: number;     // Manual triggers
  };
  metrics: {
    emergencyUsed: number;
    lastEmergencyCall: string;
  };
}
```

### CCT Integration Value

**Current State**: CCT has basic quota tracking in `quota-monitor.ts`

**With DAC-Style Quota Management**:
- ✅ Historical usage analysis
- ✅ Budget allocation tracking
- ✅ Alerting on quota exhaustion
- ✅ Service health monitoring

### Implementation Effort

**Estimated Time**: 4-6 hours

**Steps**:
1. Create D1 tables for quota tracking
2. Implement quota recording middleware
3. Build quota dashboard endpoints
4. Add alerting thresholds

---

## 6. Service Binding Pattern (Already Adopted)

### What CCT Already Uses

✅ **Direct Worker-to-Worker Communication**:
```typescript
// wrangler.toml
[[services]]
binding = "DAC_BACKEND"
service = "dac-backend"
entrypoint = "handleRequest"

// Usage
const response = await env.DAC_BACKEND.fetch(request);
```

### Benefits Realized

- ✅ No HTTP overhead
- ✅ No public endpoint exposure
- ✅ Automatic authentication
- ✅ Sub-millisecond latency

---

## 7. Implementation Priorities

### Priority 1: Money Flow Pool Integration
**Impact**: High (eliminates Yahoo Finance API calls)  
**Effort**: Low (2-4 hours)  
**Risk**: Low (fallback to existing Yahoo Finance)

**Action Items**:
1. Add `MONEY_FLOW_POOL` KV binding
2. Create `dac-money-flow-adapter.ts`
3. Update sentiment pipeline
4. Add integration tests

### Priority 2: Sector/Category Articles
**Impact**: Medium (richer market context)  
**Effort**: Low (1-2 hours)  
**Risk**: Low (already using Article Pool)

**Action Items**:
1. Use existing DAC client's `getSectorArticles()`
2. Use existing DAC client's `getCategoryArticles()`
3. Integrate into market drivers analysis

### Priority 3: Quota Management Enhancement
**Impact**: Medium (better observability)  
**Effort**: Medium (4-6 hours)  
**Risk**: Low (non-critical feature)

**Action Items**:
1. Create D1 quota tables
2. Implement quota middleware
3. Build dashboard endpoints
4. Add alerting

### Priority 4: Adapter Pattern Adoption
**Impact**: Medium (better resilience)  
**Effort**: Medium (6-8 hours)  
**Risk**: Medium (refactoring existing code)

**Action Items**:
1. Create `yahoo-finance-adapter.ts`
2. Add request deduplication
3. Implement circuit breaker
4. Migrate existing calls

---

## 8. Architectural Patterns to Adopt

### 8.1 Pool Pattern
**Concept**: Pre-compute expensive operations, store in KV, read-only at runtime

**CCT Applications**:
- Market drivers pre-computation
- Sector rotation pre-analysis
- Technical indicators caching

### 8.2 Adapter Pattern
**Concept**: Centralized API clients with retry, rate limiting, deduplication

**CCT Applications**:
- Yahoo Finance adapter
- FRED API adapter
- News API adapter

### 8.3 Dual Storage Architecture
**Concept**: KV for consumer-facing cache (auto-expiring), DO for tracking/state (persistent)

**CCT Applications**:
- Analysis results in KV (7-day TTL)
- System state in DO (persistent)
- Quota tracking in D1 (historical)

### 8.4 Semantic Health Endpoints
**Concept**: Different health endpoints for different consumers

**DAC Example**:
- `/health` - UI-friendly (always 200, rich payload)
- `/health/ready` - Infrastructure (200/503 for load balancers)
- `/health/yahoo-finance` - Service-specific health

**CCT Adoption**:
```typescript
// /health - UI dashboard
GET /health → { status: 'healthy', services: [...], timestamp: '...' }

// /health/ready - Kubernetes probes
GET /health/ready → 200 OK or 503 Service Unavailable

// /health/yahoo-finance - Circuit breaker status
GET /health/yahoo-finance → { circuitBreaker: 'CLOSED', hitRate: 95% }
```

---

## 9. Code Examples

### 9.1 Money Flow Pool Integration

```typescript
// src/modules/dac-money-flow-adapter.ts
import type { Env } from '../types';

export interface MoneyFlowIndicators {
  cmf: number;
  obv: number;
  trend: 'ACCUMULATION' | 'DISTRIBUTION';
  cached: boolean;
  cachedAt?: string;
}

export class DACMoneyFlowAdapter {
  constructor(
    private dacBackend: Fetcher,
    private apiKey: string
  ) {}

  async getMoneyFlow(symbol: string): Promise<MoneyFlowIndicators | null> {
    try {
      const request = new Request(
        `https://dac-backend/api/admin/moneyflow/probe/${symbol}`,
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
        console.warn(`[DAC_MONEY_FLOW] Pool miss for ${symbol}`);
        return null;
      }

      const data = await response.json() as any;

      return {
        cmf: data.data.cmf,
        obv: data.data.obv,
        trend: data.data.trend,
        cached: true,
        cachedAt: data.metadata.computedAt
      };

    } catch (error) {
      console.error(`[DAC_MONEY_FLOW] Error for ${symbol}:`, error);
      return null;
    }
  }
}

// Usage in sentiment pipeline
export async function getMoneyFlowIndicators(
  env: Env,
  symbol: string
): Promise<MoneyFlowIndicators> {
  // Try DAC pool first
  if (env.DAC_BACKEND) {
    const adapter = new DACMoneyFlowAdapter(
      env.DAC_BACKEND,
      env.DAC_ARTICLES_POOL_API_KEY || 'yanggf'
    );
    
    const poolResult = await adapter.getMoneyFlow(symbol);
    if (poolResult) {
      console.log(`[MONEY_FLOW] Using DAC pool for ${symbol}`);
      return poolResult;
    }
  }

  // Fallback to Yahoo Finance
  console.log(`[MONEY_FLOW] Falling back to Yahoo Finance for ${symbol}`);
  return await fetchMoneyFlowFromYahoo(env, symbol);
}
```

### 9.2 Sector Articles Integration

```typescript
// src/modules/market-drivers-enhanced.ts
export async function getMarketDriversWithSectorContext(
  env: Env
): Promise<MarketDriversAnalysis> {
  const dacClient = createDACArticlesPoolClientV2(env);
  
  if (!dacClient) {
    return getMarketDriversLegacy(env);
  }

  // Get category articles (Geopolitical, Monetary, Economic, Market)
  const categories = await dacClient.getCategoryArticles();

  // Get sector articles for top 3 sectors
  const topSectors = ['XLK', 'XLF', 'XLE'];
  const sectorArticles = await Promise.all(
    topSectors.map(sector => dacClient.getSectorArticles(sector))
  );

  // Combine for comprehensive market analysis
  return {
    categories: categories.categories,
    sectors: Object.fromEntries(
      topSectors.map((sector, i) => [sector, sectorArticles[i]])
    ),
    timestamp: new Date().toISOString()
  };
}
```

---

## 10. Testing Strategy

### 10.1 Money Flow Pool Tests

```typescript
// tests/dac-money-flow-integration.test.ts
describe('DAC Money Flow Pool Integration', () => {
  it('should fetch money flow from pool', async () => {
    const adapter = new DACMoneyFlowAdapter(env.DAC_BACKEND, apiKey);
    const result = await adapter.getMoneyFlow('AAPL');
    
    expect(result).toBeDefined();
    expect(result.cmf).toBeTypeOf('number');
    expect(result.trend).toMatch(/ACCUMULATION|DISTRIBUTION/);
    expect(result.cached).toBe(true);
  });

  it('should fallback to Yahoo Finance on pool miss', async () => {
    const result = await getMoneyFlowIndicators(env, 'UNKNOWN_SYMBOL');
    
    expect(result).toBeDefined();
    expect(result.cached).toBe(false);
  });
});
```

### 10.2 Adapter Pattern Tests

```typescript
// tests/yahoo-finance-adapter.test.ts
describe('Yahoo Finance Adapter', () => {
  it('should deduplicate concurrent requests', async () => {
    const adapter = new YahooFinanceAdapter();
    
    const [result1, result2] = await Promise.all([
      adapter.fetchHistoricalData('AAPL', '1mo'),
      adapter.fetchHistoricalData('AAPL', '1mo')
    ]);
    
    expect(result1).toEqual(result2);
    expect(adapter.getRequestCount()).toBe(1); // Only 1 API call
  });

  it('should retry on rate limit', async () => {
    const adapter = new YahooFinanceAdapter();
    
    // Mock 429 response
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 429 }));
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: 'ok' })));
    
    const result = await adapter.fetchHistoricalData('AAPL', '1mo');
    
    expect(result).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
```

---

## 11. Deployment Checklist

### Phase 1: Money Flow Pool (Week 1)
- [ ] Add `MONEY_FLOW_POOL` KV binding to `wrangler.toml`
- [ ] Create `dac-money-flow-adapter.ts`
- [ ] Update sentiment pipeline
- [ ] Add integration tests
- [ ] Deploy to staging
- [ ] Validate with 10 symbols
- [ ] Deploy to production

### Phase 2: Sector/Category Articles (Week 2)
- [ ] Update market drivers module
- [ ] Add sector context to analysis
- [ ] Add category context to reports
- [ ] Update frontend to display sector articles
- [ ] Deploy to staging
- [ ] Deploy to production

### Phase 3: Quota Management (Week 3-4)
- [ ] Create D1 quota tables
- [ ] Implement quota middleware
- [ ] Build dashboard endpoints
- [ ] Add alerting thresholds
- [ ] Deploy to staging
- [ ] Deploy to production

---

## 12. Conclusion

DAC's external service architecture provides **proven patterns** for:
1. ✅ **Resource pooling** - Pre-compute expensive operations
2. ✅ **API resilience** - Retry, circuit breaker, deduplication
3. ✅ **Quota management** - Historical tracking, budget allocation
4. ✅ **Service binding** - Direct Worker-to-Worker communication

**Immediate Action**: Integrate Money Flow Pool (2-4 hours, high impact)

**Next Steps**: Adopt adapter pattern for Yahoo Finance and FRED APIs

**Long-term**: Implement comprehensive quota management with D1 tracking
