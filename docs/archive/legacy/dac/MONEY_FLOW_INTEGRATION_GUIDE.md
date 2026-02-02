# Money Flow Pool Integration Guide

**Priority**: 1 (High Impact, Low Effort)  
**Estimated Time**: 2-4 hours  
**Benefit**: Eliminates Yahoo Finance API calls for money flow indicators

---

## Overview

This guide walks through integrating DAC's Money Flow Pool into CCT's sentiment analysis pipeline. The Money Flow Pool provides pre-computed CMF/OBV indicators, eliminating the need for Yahoo Finance API calls during runtime.

---

## Step 1: Update wrangler.toml (5 minutes)

Add the Money Flow Pool KV binding:

```toml
# Add to wrangler.toml after existing KV bindings

# Money Flow Pool (from DAC) - Pre-computed CMF/OBV indicators
[[kv_namespaces]]
binding = "MONEY_FLOW_POOL"
id = "your-money-flow-pool-id"  # Get from DAC project
preview_id = "your-preview-id"
```

**Note**: The Money Flow Pool KV namespace is managed by DAC. You'll need to:
1. Get the KV namespace ID from DAC's `wrangler.toml`
2. Or create a new KV namespace and coordinate warming with DAC

---

## Step 2: Create Money Flow Adapter (30 minutes)

Create `src/modules/dac-money-flow-adapter.ts`:

```typescript
/**
 * DAC Money Flow Pool Adapter
 * Provides access to pre-computed money flow indicators via service binding
 */

import type { Env } from '../types';

export interface MoneyFlowIndicators {
  symbol: string;
  cmf: number;                    // Chaikin Money Flow
  obv: number;                    // On-Balance Volume
  trend: 'ACCUMULATION' | 'DISTRIBUTION';
  timestamp: string;
  cached: boolean;
  cacheStatus: 'HIT' | 'MISS';
  cachedAt?: string;
  source?: 'dac_pool' | 'yahoo_finance';
}

interface DACMoneyFlowPoolEntry {
  data: {
    cmf: number;
    obv: number;
    trend: 'ACCUMULATION' | 'DISTRIBUTION';
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

/**
 * Adapter for accessing DAC Money Flow Pool
 */
export class DACMoneyFlowAdapter {
  constructor(
    private dacBackend: Fetcher,
    private apiKey: string
  ) {}

  /**
   * Get money flow indicators from DAC pool
   * Uses admin probe endpoint for direct access
   */
  async getMoneyFlow(
    symbol: string,
    window: '1mo' | '3mo' | '6mo' = '1mo'
  ): Promise<MoneyFlowIndicators | null> {
    try {
      const request = new Request(
        `https://dac-backend/api/admin/moneyflow/probe/${symbol}?window=${window}`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
            'User-Agent': 'CCT-MoneyFlow-Client/1.0'
          }
        }
      );

      const response = await this.dacBackend.fetch(request);

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[DAC_MONEY_FLOW] Pool miss for ${symbol}`);
          return null;
        }
        throw new Error(`DAC API error: ${response.status} ${response.statusText}`);
      }

      const poolEntry = await response.json() as DACMoneyFlowPoolEntry;

      // Convert to CCT format
      return {
        symbol: poolEntry.metadata.symbol,
        cmf: poolEntry.data.cmf,
        obv: poolEntry.data.obv,
        trend: poolEntry.data.trend,
        timestamp: poolEntry.metadata.computedAt,
        cached: true,
        cacheStatus: 'HIT',
        cachedAt: poolEntry.metadata.computedAt,
        source: 'dac_pool'
      };

    } catch (error) {
      console.error(`[DAC_MONEY_FLOW] Error fetching ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Check if DAC Money Flow Pool is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const request = new Request(
        'https://dac-backend/api/admin/moneyflow/status',
        {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const response = await this.dacBackend.fetch(request);
      return response.ok;
    } catch (error) {
      console.error('[DAC_MONEY_FLOW] Health check failed:', error);
      return false;
    }
  }
}

/**
 * Create Money Flow adapter instance
 */
export function createMoneyFlowAdapter(env: Env): DACMoneyFlowAdapter | null {
  if (!env.DAC_BACKEND) {
    console.warn('[DAC_MONEY_FLOW] DAC backend service binding not available');
    return null;
  }

  const apiKey = env.DAC_ARTICLES_POOL_API_KEY || 'yanggf';
  return new DACMoneyFlowAdapter(env.DAC_BACKEND, apiKey);
}
```

---

## Step 3: Update Sentiment Pipeline (45 minutes)

Update your existing money flow fetching logic to use the pool first:

```typescript
// src/modules/money-flow-service.ts (or wherever you fetch money flow)

import { DACMoneyFlowAdapter, createMoneyFlowAdapter, MoneyFlowIndicators } from './dac-money-flow-adapter';
import { fetchMoneyFlowFromYahoo } from './yahoo-finance'; // Your existing Yahoo Finance logic

/**
 * Get money flow indicators with DAC pool fallback
 */
export async function getMoneyFlowIndicators(
  env: Env,
  symbol: string,
  window: '1mo' | '3mo' | '6mo' = '1mo'
): Promise<MoneyFlowIndicators> {
  // Strategy 1: Try DAC Money Flow Pool (fastest, no API calls)
  const dacAdapter = createMoneyFlowAdapter(env);
  
  if (dacAdapter) {
    try {
      const poolResult = await dacAdapter.getMoneyFlow(symbol, window);
      
      if (poolResult) {
        console.log(`[MONEY_FLOW] ✅ DAC Pool HIT for ${symbol} (CMF: ${poolResult.cmf.toFixed(3)}, Trend: ${poolResult.trend})`);
        return poolResult;
      }
      
      console.log(`[MONEY_FLOW] ⚠️  DAC Pool MISS for ${symbol}, falling back to Yahoo Finance`);
    } catch (error) {
      console.error(`[MONEY_FLOW] DAC Pool error for ${symbol}:`, error);
    }
  }

  // Strategy 2: Fallback to Yahoo Finance (slower, API call)
  console.log(`[MONEY_FLOW] 📊 Fetching from Yahoo Finance for ${symbol}`);
  
  try {
    const yahooResult = await fetchMoneyFlowFromYahoo(env, symbol, window);
    
    return {
      ...yahooResult,
      cached: false,
      cacheStatus: 'MISS',
      source: 'yahoo_finance'
    };
  } catch (error) {
    console.error(`[MONEY_FLOW] Yahoo Finance error for ${symbol}:`, error);
    
    // Return neutral indicators on complete failure
    return {
      symbol,
      cmf: 0,
      obv: 0,
      trend: 'ACCUMULATION',
      timestamp: new Date().toISOString(),
      cached: false,
      cacheStatus: 'MISS',
      source: 'yahoo_finance'
    };
  }
}
```

---

## Step 4: Update TypeScript Types (10 minutes)

Add Money Flow Pool types to `src/types/cloudflare.ts`:

```typescript
export interface Env {
  // ... existing bindings
  
  // DAC Integration
  DAC_BACKEND?: Fetcher;
  DAC_ARTICLES_POOL_API_KEY?: string;
  MONEY_FLOW_POOL?: KVNamespace;  // ← Add this
}
```

---

## Step 5: Add Integration Tests (30 minutes)

Create `tests/dac-money-flow-integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { DACMoneyFlowAdapter } from '../src/modules/dac-money-flow-adapter';
import { getMoneyFlowIndicators } from '../src/modules/money-flow-service';

describe('DAC Money Flow Pool Integration', () => {
  let env: Env;
  let adapter: DACMoneyFlowAdapter;

  beforeAll(() => {
    // Setup test environment
    env = getMiniflareBindings();
    adapter = new DACMoneyFlowAdapter(
      env.DAC_BACKEND!,
      env.DAC_ARTICLES_POOL_API_KEY || 'yanggf'
    );
  });

  it('should fetch money flow from DAC pool', async () => {
    const result = await adapter.getMoneyFlow('AAPL', '1mo');
    
    expect(result).toBeDefined();
    expect(result?.symbol).toBe('AAPL');
    expect(result?.cmf).toBeTypeOf('number');
    expect(result?.obv).toBeTypeOf('number');
    expect(result?.trend).toMatch(/ACCUMULATION|DISTRIBUTION/);
    expect(result?.cached).toBe(true);
    expect(result?.source).toBe('dac_pool');
  });

  it('should return null for unknown symbols', async () => {
    const result = await adapter.getMoneyFlow('UNKNOWN_SYMBOL_XYZ', '1mo');
    
    expect(result).toBeNull();
  });

  it('should fallback to Yahoo Finance on pool miss', async () => {
    const result = await getMoneyFlowIndicators(env, 'RARE_SYMBOL', '1mo');
    
    expect(result).toBeDefined();
    expect(result.symbol).toBe('RARE_SYMBOL');
    expect(result.source).toBe('yahoo_finance');
  });

  it('should handle different time windows', async () => {
    const windows: Array<'1mo' | '3mo' | '6mo'> = ['1mo', '3mo', '6mo'];
    
    for (const window of windows) {
      const result = await adapter.getMoneyFlow('AAPL', window);
      
      if (result) {
        expect(result.symbol).toBe('AAPL');
        expect(result.cached).toBe(true);
      }
    }
  });

  it('should check pool health', async () => {
    const isHealthy = await adapter.checkHealth();
    
    expect(isHealthy).toBe(true);
  });
});
```

---

## Step 6: Update Sentiment Analysis (20 minutes)

Integrate money flow into your sentiment analysis:

```typescript
// src/modules/sentiment-analysis.ts

export async function analyzeSentiment(
  env: Env,
  symbol: string
): Promise<SentimentAnalysis> {
  // ... existing article fetching logic
  
  // Get money flow indicators (now using DAC pool)
  const moneyFlow = await getMoneyFlowIndicators(env, symbol, '1mo');
  
  // Adjust confidence based on money flow source
  let confidenceAdjustment = 0;
  
  if (moneyFlow.source === 'dac_pool') {
    confidenceAdjustment += 5; // Bonus for using cached data
  }
  
  // Use money flow in analysis
  const analysis = {
    symbol,
    sentiment: calculateSentiment(articles),
    moneyFlow: {
      trend: moneyFlow.trend,
      cmf: moneyFlow.cmf,
      obv: moneyFlow.obv,
      source: moneyFlow.source
    },
    confidence: baseConfidence + confidenceAdjustment,
    timestamp: new Date().toISOString()
  };
  
  return analysis;
}
```

---

## Step 7: Add Monitoring Endpoint (15 minutes)

Create an endpoint to monitor Money Flow Pool usage:

```typescript
// src/routes/monitoring-routes.ts

app.get('/api/v1/monitoring/money-flow-pool', async (c) => {
  const env = c.env;
  const adapter = createMoneyFlowAdapter(env);
  
  if (!adapter) {
    return c.json({
      success: false,
      error: 'DAC Money Flow Pool not configured'
    }, 503);
  }
  
  const isHealthy = await adapter.checkHealth();
  
  // Test with a known symbol
  const testResult = await adapter.getMoneyFlow('AAPL', '1mo');
  
  return c.json({
    success: true,
    status: isHealthy ? 'healthy' : 'degraded',
    pool: {
      available: !!testResult,
      testSymbol: 'AAPL',
      testResult: testResult ? {
        cmf: testResult.cmf,
        trend: testResult.trend,
        cachedAt: testResult.cachedAt
      } : null
    },
    timestamp: new Date().toISOString()
  });
});
```

---

## Step 8: Deploy and Validate (30 minutes)

### 8.1 Deploy to Staging

```bash
# Deploy to staging
npm run deploy:staging

# Test the monitoring endpoint
curl https://tft-trading-system-staging.yanggf.workers.dev/api/v1/monitoring/money-flow-pool

# Test with a known symbol
curl https://tft-trading-system-staging.yanggf.workers.dev/api/v1/sentiment/symbols/AAPL
```

### 8.2 Validate Pool Usage

Check logs for pool hit/miss patterns:

```bash
# Should see logs like:
# [MONEY_FLOW] ✅ DAC Pool HIT for AAPL (CMF: 0.123, Trend: ACCUMULATION)
# [MONEY_FLOW] ⚠️  DAC Pool MISS for RARE_SYMBOL, falling back to Yahoo Finance
```

### 8.3 Deploy to Production

```bash
# Deploy to production
npm run deploy

# Monitor for 24 hours
# Check error rates
# Validate response times improved
```

---

## Validation Checklist

- [ ] `wrangler.toml` updated with `MONEY_FLOW_POOL` binding
- [ ] `dac-money-flow-adapter.ts` created and tested
- [ ] Sentiment pipeline updated to use pool
- [ ] TypeScript types updated
- [ ] Integration tests passing
- [ ] Monitoring endpoint working
- [ ] Deployed to staging
- [ ] Validated pool hits for common symbols
- [ ] Validated fallback for rare symbols
- [ ] Deployed to production
- [ ] Monitoring shows reduced Yahoo Finance calls

---

## Expected Results

### Before Integration
- **Yahoo Finance API calls**: 50-100/day for money flow
- **Response time**: 500-1000ms per symbol
- **Rate limiting**: Occasional 429 errors

### After Integration
- **Yahoo Finance API calls**: 5-10/day (only for pool misses)
- **Response time**: 10-50ms per symbol (from pool)
- **Rate limiting**: Eliminated for cached symbols

---

## Troubleshooting

### Pool Always Returns Null

**Cause**: Money Flow Pool not warmed in DAC

**Solution**:
1. Check DAC warming schedule (GitHub Actions)
2. Manually trigger warming: `POST /api/admin/moneyflow/warm`
3. Verify symbols are in DAC's tracking list

### Service Binding Not Working

**Cause**: `DAC_BACKEND` binding not configured

**Solution**:
1. Verify `wrangler.toml` has `[[services]]` binding
2. Check DAC backend is deployed
3. Test with: `curl https://dac-backend.yanggf.workers.dev/health`

### High Fallback Rate

**Cause**: Pool TTL expired or symbols not tracked

**Solution**:
1. Check DAC warming frequency (should be daily)
2. Add symbols to DAC tracking list
3. Consider increasing pool TTL in DAC

---

## Next Steps

After successful Money Flow Pool integration:

1. **Monitor for 1 week** - Validate stability and performance
2. **Integrate Sector Articles** - Use DAC's sector article pool
3. **Add Category Articles** - Use DAC's category article pool (Geopolitical, Monetary, Economic, Market)
4. **Implement Quota Dashboard** - Track API usage across all services

---

## References

- [DAC Integration Opportunities](./DAC_INTEGRATION_OPPORTUNITIES.md)
- [DAC Money Flow Pool Source](../dac/backend/src/modules/money-flow-pool.ts)
- [DAC Admin Routes](../dac/backend/src/routes/money-flow-admin-routes.ts)
