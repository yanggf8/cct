# Report Sentiment Direction & Confidence Review

**Date**: 2026-02-02  
**Status**: ⚠️ **CRITICAL ISSUE FOUND**

## Executive Summary

All three reports (Pre-market, Intraday, End-of-day) have **inconsistent sentiment data extraction** that prevents clear display of sentiment directions and confidence levels.

### Root Cause

The dual AI analysis returns data in this structure:
```typescript
{
  symbol: "AAPL",
  signal: {
    type: "AGREEMENT" | "DISAGREEMENT" | "ERROR",
    direction: "bullish" | "bearish" | "neutral",  // ← This is the sentiment
    strength: "STRONG" | "MODERATE" | "WEAK" | "FAILED",
    confidence: number | null,  // ← This is the confidence
    reasoning: string,
    action: "BUY" | "SELL" | "HOLD" | "SKIP"
  },
  models: {
    gpt: { direction, confidence, reasoning, error? },
    distilbert: { direction, confidence, reasoning, error? }
  }
}
```

But the report handlers are trying to extract:
```typescript
signal.sentiment_layers?.[0]?.sentiment  // ❌ WRONG - doesn't exist
signal.sentiment_layers?.[0]?.confidence // ❌ WRONG - doesn't exist
```

## Issues by Report

### 1. Pre-Market Report (`handlePreMarketReport`)

**File**: `src/routes/report-routes.ts:562-857`

**Problem Areas**:

#### Line 665-680: Signal extraction logic
```typescript
const allSignals = Object.values(tradingSignals).map((signal: any) => {
  const confidence = signal.confidence_metrics?.overall_confidence ??
    signal.enhanced_prediction?.confidence ??
    signal.sentiment_layers?.[0]?.confidence ??  // ❌ WRONG PATH
    signal.confidence ??
    null;

  // Extract dual model confidence values
  const gemmaConfidence = signal.gemma_confidence ?? null;
  const distilbertConfidence = signal.distilbert_confidence ?? null;
```

**Should be**:
```typescript
const allSignals = Object.values(tradingSignals).map((signal: any) => {
  // Extract from dual AI structure
  const confidence = signal.signal?.confidence ?? 
    signal.models?.gpt?.confidence ?? 
    signal.models?.distilbert?.confidence ?? 
    null;

  const gemmaConfidence = signal.models?.gpt?.confidence ?? null;
  const distilbertConfidence = signal.models?.distilbert?.confidence ?? null;
  const sentiment = signal.signal?.direction ?? 'neutral';
```

#### Line 695-710: Status determination
```typescript
return {
  symbol: signal.symbol,
  sentiment: signal.sentiment_layers?.[0]?.sentiment || 'neutral',  // ❌ WRONG
  confidence,
  gemma_confidence: gemmaConfidence,
  distilbert_confidence: distilbertConfidence,
  status,
  failure_reason: failureReason,
  reason: status === 'success' ? (signal.sentiment_layers?.[0]?.reasoning || '') : failureReason  // ❌ WRONG
};
```

**Should be**:
```typescript
return {
  symbol: signal.symbol,
  sentiment: signal.signal?.direction || 'neutral',  // ✅ CORRECT
  confidence,
  gemma_confidence: gemmaConfidence,
  distilbert_confidence: distilbertConfidence,
  status,
  failure_reason: failureReason,
  reason: status === 'success' ? (signal.signal?.reasoning || '') : failureReason  // ✅ CORRECT
};
```

#### Line 730-770: High confidence signals
Same issue - uses `sentiment_layers?.[0]?.sentiment` instead of `signal.direction`

### 2. Intraday Report (`handleIntradayReport`)

**File**: `src/routes/report-routes.ts:863-976`

**Status**: ✅ **READS FROM D1 DIRECTLY** - No transformation logic

The intraday report reads `report_content` directly from D1 and returns it as-is:
```typescript
const content = typeof snapshot.report_content === 'string' 
  ? JSON.parse(snapshot.report_content) 
  : snapshot.report_content;

response = content;  // ✅ Returns whatever was stored
```

**Dependency**: Relies on the intraday **job** handler to store correct structure.

### 3. End-of-Day Report (`handleEndOfDayReport`)

**File**: `src/routes/report-routes.ts:982-1087`

**Status**: ✅ **USES `getD1FallbackData`** - Delegates to helper function

```typescript
const d1Result = await getD1FallbackData(env, today, 'end-of-day');

if (d1Result?.data) {
  return new Response(
    JSON.stringify(
      ApiResponseFactory.success(d1Result.data, {  // ✅ Returns D1 data as-is
        source: 'd1_snapshot',
        scheduled_date: today,
        is_stale: d1Result.isStale,
        requestId,
        processingTime: timer.finish()
      })
    ),
    { status: HttpStatus.OK, headers }
  );
}
```

**Dependency**: Relies on `getD1FallbackData` and the EOD **job** handler to store correct structure.

## Data Flow Analysis

### Current Flow (Broken)

```
Dual AI Analysis
  ↓ (returns signal.direction, signal.confidence)
Job Handler (Pre-market/Intraday/EOD)
  ↓ (stores to D1 as trading_signals)
D1 Storage
  ↓ (report_content JSON)
Report Handler
  ↓ (tries to read sentiment_layers[0].sentiment) ❌ MISMATCH
Response
```

### Expected Flow (Fixed)

```
Dual AI Analysis
  ↓ (returns signal.direction, signal.confidence)
Job Handler
  ↓ (stores signal.direction as sentiment, signal.confidence as confidence)
D1 Storage
  ↓ (normalized structure)
Report Handler
  ↓ (reads signal.direction or sentiment_layers[0].sentiment with fallback)
Response
  ↓ (clear sentiment + confidence)
```

## Verification Checklist

### ✅ Data Source Migration Complete
- [x] Pre-market: Reads from D1 only (no KV)
- [x] Intraday: Reads from D1 only (no KV)
- [x] End-of-day: Reads from D1 only (no KV)

### ❌ Sentiment Direction & Confidence Display
- [ ] Pre-market: **BROKEN** - Wrong extraction path
- [ ] Intraday: **DEPENDS ON JOB** - Need to verify job handler
- [ ] End-of-day: **DEPENDS ON JOB** - Need to verify job handler

## Required Fixes

### ✅ Fix 1: Pre-Market Report Handler (COMPLETED)

**File**: `src/routes/report-routes.ts`

**Lines fixed**: 665-680, 695-710, 730-770

**Changes applied**:
```typescript
// NEW (CORRECT) - with fallback for backward compatibility
signal.signal?.direction ?? signal.sentiment_layers?.[0]?.sentiment
signal.signal?.confidence ?? signal.models?.gpt?.confidence
signal.signal?.reasoning ?? signal.sentiment_layers?.[0]?.reasoning

// Dual model confidence
signal.models?.gpt?.confidence ?? signal.gemma_confidence
signal.models?.distilbert?.confidence ?? signal.distilbert_confidence
```

### ✅ Fix 2: Pre-Market Job Handler (COMPLETED)

**File**: `src/modules/pre-market-data-bridge.ts`

**Changes applied**:
- `generatePreMarketAnalysis` now stores dual AI structure in `signal` and `models` fields
- Maintains `sentiment_layers` for backward compatibility
- Success, skipped, and failed symbols all use consistent structure

**New structure**:
```typescript
{
  symbol: "AAPL",
  signal: {
    direction: "bullish" | "bearish" | "neutral",
    confidence: number | null,
    reasoning: string,
    action: "BUY" | "SELL" | "HOLD" | "SKIP",
    type: "AGREEMENT" | "ERROR"
  },
  models: {
    gpt: { direction, confidence, reasoning },
    distilbert: { direction, confidence, reasoning }
  },
  sentiment_layers: [...],  // Legacy format
  dual_model: {...}
}
```

### ⏳ Fix 3: Verify Other Job Handlers (PENDING)

Need to check:
1. ✅ `handlePreMarketJob` - Fixed via pre-market-data-bridge.ts
2. ⏳ `handleIntradayJob` (jobs-routes.ts:1099-1315)
3. ⏳ `handleEndOfDayJob` (need to find this)

## Testing Requirements

After fixes, verify:

1. **Pre-market report** shows:
   - ✅ Clear sentiment direction (bullish/bearish/neutral)
   - ✅ Confidence level (0.0-1.0 or null)
   - ✅ Dual model confidence (GPT + DistilBERT)
   - ✅ Status (success/failed)
   - ✅ Reasoning text

2. **Intraday report** shows:
   - ✅ Symbol-by-symbol sentiment
   - ✅ Confidence levels
   - ✅ Prediction accuracy tracking

3. **End-of-day report** shows:
   - ✅ Daily sentiment summary
   - ✅ Confidence levels
   - ✅ Tomorrow outlook with confidence

## Recommendation

**Priority**: 🔴 **CRITICAL** - Fix immediately

**Approach**:
1. Fix pre-market report handler first (most complex)
2. Verify job handlers store correct structure
3. Add fallback logic for backward compatibility
4. Test all three reports with real data
5. Document the correct data structure in types.ts

**Estimated Effort**: 2-3 hours

---

**Next Steps**:
1. Review this document with user
2. Get approval to proceed with fixes
3. Implement fixes in order of priority
4. Test with next cron run (20:05 UTC for EOD)
