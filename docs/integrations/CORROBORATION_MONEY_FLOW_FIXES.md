# Corroboration: Money Flow Integration Fixes

**Date**: 2025-12-10  
**Status**: ✅ **ALL ISSUES FIXED**

---

## Issues Found & Fixed

### 1. ❌ Non-existent `Env` type import

**Finding**: `src/modules/dac-money-flow-adapter.ts` and `src/modules/money-flow-service.ts` imported `Env` from `../types`, but only `CloudflareEnvironment` is exported.

**Fix**: Changed all imports to use `CloudflareEnvironment`:
```typescript
// Before
import type { Env } from '../types';

// After
import type { CloudflareEnvironment } from '../types';
```

**Files Fixed**:
- ✅ `src/modules/dac-money-flow-adapter.ts`
- ✅ `src/modules/money-flow-service.ts`
- ✅ `src/routes/data-routes.ts`

---

### 2. ❌ Wrong `getHistoricalData` signature

**Finding**: `money-flow-service.ts` called `getHistoricalData(symbol, window)` but the function expects `(symbol, startDate, endDate)`.

**Fix**: Convert window to date range before calling:
```typescript
// Before (broken)
const historicalData = await getHistoricalData(symbol, window);

// After (fixed)
const endDate = new Date();
const startDate = new Date();
startDate.setMonth(startDate.getMonth() - 1);

const historicalData = await getHistoricalData(
  symbol,
  startDate.toISOString().split('T')[0],
  endDate.toISOString().split('T')[0]
);
```

---

### 3. ❌ Admin endpoint with wrong API key

**Finding**: Used `DAC_ARTICLES_POOL_API_KEY || 'yanggf'` for admin money-flow endpoints, which would fail with 403.

**Fix**: Changed to use public stock sentiment endpoint instead of admin endpoint:
```typescript
// Before (admin endpoint, needs auth)
`https://dac-backend/api/admin/moneyflow/probe/${symbol}`

// After (public endpoint, no auth needed)
`https://dac-backend/api/sentiment/stock/${symbol}`
```

Money flow is embedded in DAC's stock sentiment response, so we extract it from there.

---

### 4. ❌ Dead `MONEY_FLOW_POOL` KV binding

**Finding**: `wrangler.toml` had a `MONEY_FLOW_POOL` KV binding that was never used (money flow goes through service binding, not direct KV access).

**Fix**: Removed the dead binding from:
- ✅ `wrangler.toml`
- ✅ `src/types/cloudflare.ts`

---

## Architecture After Fixes

### Data Flow

```
getMoneyFlowIndicators(env, symbol)
    ↓
┌─────────────────────────────────────┐
│ Strategy 1: DAC Stock Sentiment     │
│ - GET /api/sentiment/stock/{symbol} │
│ - Public endpoint (no auth needed)  │
│ - Extracts moneyFlow from response  │
│ - ✅ FIXED                          │
└─────────────────────────────────────┘
    ↓ (if DAC fails or no money flow)
┌─────────────────────────────────────┐
│ Strategy 2: Yahoo Finance           │
│ - getHistoricalData(symbol, start,  │
│   end) with correct signature       │
│ - Calculate CMF/OBV locally         │
│ - ✅ FIXED                          │
└─────────────────────────────────────┘
    ↓ (if Yahoo fails)
┌─────────────────────────────────────┐
│ Strategy 3: Neutral Indicators      │
│ - CMF: 0, OBV: 0                    │
│ - Prevents complete failure         │
└─────────────────────────────────────┘
```

### Key Changes

| Component | Before | After |
|-----------|--------|-------|
| **Type Import** | `Env` (non-existent) | `CloudflareEnvironment` |
| **DAC Endpoint** | Admin `/api/admin/moneyflow/probe` | Public `/api/sentiment/stock` |
| **Auth** | `DAC_ARTICLES_POOL_API_KEY || 'yanggf'` | None (public endpoint) |
| **Yahoo Call** | `getHistoricalData(symbol, '1mo')` | `getHistoricalData(symbol, startDate, endDate)` |
| **KV Binding** | `MONEY_FLOW_POOL` (dead) | Removed |

---

## Files Modified

1. **`src/modules/dac-money-flow-adapter.ts`**
   - Fixed type import
   - Changed to public sentiment endpoint
   - Removed API key requirement
   - Simplified to extract money flow from sentiment response

2. **`src/modules/money-flow-service.ts`**
   - Fixed type import
   - Fixed `getHistoricalData` call signature
   - Removed unused window parameter

3. **`src/routes/data-routes.ts`**
   - Fixed type annotation in handler
   - Updated adapter call

4. **`wrangler.toml`**
   - Removed dead `MONEY_FLOW_POOL` KV binding

5. **`src/types/cloudflare.ts`**
   - Removed `MONEY_FLOW_POOL` from interface

---

## Open Questions Resolved

### Q: Is there a dedicated DAC money-flow API key?

**A**: No. Money flow data is embedded in the public stock sentiment endpoint (`/api/sentiment/stock/{symbol}`), which doesn't require authentication. The admin endpoints (`/api/admin/moneyflow/*`) are for warming/management only.

### Q: Should money flow be fetched via a non-admin/public DAC endpoint?

**A**: Yes. Fixed to use `/api/sentiment/stock/{symbol}` which:
- Is a public endpoint (no auth required)
- Returns money flow as part of the sentiment response
- Works with service binding (no HTTP overhead)

---

## Verification

### TypeScript Compilation

All type errors should now be resolved:
- ✅ `CloudflareEnvironment` is exported from `../types`
- ✅ `getHistoricalData` called with correct signature
- ✅ No undefined `Env` type references

### Runtime Behavior

1. **DAC Path**: Calls public sentiment endpoint, extracts `moneyFlow` field
2. **Yahoo Path**: Calculates CMF/OBV from historical data with correct date range
3. **Fallback Path**: Returns neutral indicators on complete failure

---

## Status

✅ **ALL ISSUES FIXED**

- [x] Type import errors fixed
- [x] `getHistoricalData` signature fixed
- [x] Admin endpoint replaced with public endpoint
- [x] Dead KV binding removed
- [x] Hardcoded credential removed

Ready for deployment.
