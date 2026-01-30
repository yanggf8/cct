# Intraday Report Improvements - Pre-Market Run ID & Partial Status

**Date**: 2026-01-31  
**Status**: ✅ Fixed

## Issues Fixed

### 1. Pre-Market Run ID Not Displayed

**Problem**: Intraday reports didn't show which pre-market run was used for comparison.

**Root Cause**: The `pre_market_run_id` from `IntradayDataBridge` wasn't being passed through to the D1 snapshot.

**Fix**: Added `pre_market_run_id` to the job result in manual intraday job handler.

**File**: `src/routes/jobs-routes.ts` (line ~1157)

```typescript
const jobResult = {
  date: today,
  job_type: 'intraday',
  symbols_analyzed: analysisData.total_symbols,
  on_track_count: analysisData.on_track_count,
  diverged_count: analysisData.diverged_count,
  overall_accuracy: analysisData.overall_accuracy,
  market_status: analysisData.market_status,
  symbols: analysisData.symbols,
  comparisons: analysisData.comparisons,
  pre_market_run_id: analysisData.pre_market_run_id,  // ✅ NEW: Track pre-market source
  timestamp: analysisData.timestamp
};
```

**Result**: Intraday reports will now display "Pre-Market Run: [run_id]" when available.

---

### 2. Intraday Job Marked Success Despite Missing Pre-Market Data

**Problem**: Intraday job showed `status: 'success'` even when all comparisons were incomplete due to missing/failed pre-market data. This defeats the purpose of intraday validation (calibration).

**Root Cause**: Status logic only checked for missing intraday data, not missing pre-market data.

**Fix**: Updated status detection to mark job as `'partial'` when all comparisons are incomplete due to missing pre-market OR intraday data.

**File**: `src/modules/scheduler.ts` (line ~403)

```typescript
// Check if all comparisons are incomplete (either no intraday data OR no pre-market data)
const allIncomplete = intradayResult.comparisons?.every((comp: any) => 
  comp.comparison?.status === 'incomplete' || 
  comp.intraday?.status === 'failed' ||
  comp.intraday?.articles_count === 0 ||
  comp.premarket?.status === 'failed' ||  // ✅ NEW: Check pre-market status
  comp.premarket?.error                    // ✅ NEW: Check pre-market error
);

if (allIncomplete) {
  console.warn(`⚠️ [CRON-INTRADAY] All comparisons incomplete - missing pre-market or intraday data`);
  intradayHasEmptySymbols = true;  // Flag for partial status
}
```

**Warning Message** (line ~868):
```typescript
const warnings = (d1ReportType === 'intraday' && intradayHasEmptySymbols)
  ? ['Intraday analysis incomplete - news fetch failed for all symbols or no pre-market data available']
  : undefined;
```

**Result**: Intraday jobs will show `status: 'partial'` with warning when:
- All symbols have no intraday data (news fetch failed)
- All symbols have no pre-market data to compare against
- Any combination of the above

---

## Expected Behavior

### Scenario 1: Valid Comparison
- Pre-market data: ✅ Available
- Intraday data: ✅ Available
- **Status**: `success`
- **Display**: Shows comparison with pre-market run ID

### Scenario 2: Missing Pre-Market Data
- Pre-market data: ❌ Failed/Missing
- Intraday data: ✅ Available
- **Status**: `partial` ⚠️
- **Warning**: "Intraday analysis incomplete - no pre-market data available"
- **Display**: Shows "No data from pre-market job" for all symbols

### Scenario 3: Missing Intraday Data
- Pre-market data: ✅ Available
- Intraday data: ❌ Failed (0 articles)
- **Status**: `partial` ⚠️
- **Warning**: "Intraday analysis incomplete - news fetch failed for all symbols"
- **Display**: Shows "No data" for intraday analysis

### Scenario 4: Both Missing
- Pre-market data: ❌ Failed/Missing
- Intraday data: ❌ Failed
- **Status**: `partial` ⚠️
- **Warning**: "Intraday analysis incomplete - news fetch failed for all symbols or no pre-market data available"

---

## Testing

```bash
# TypeScript validation
npm run typecheck  # ✅ Passes

# Deploy and test
npm run deploy

# Trigger intraday job
curl -X POST -H "X-API-KEY: $X_API_KEY" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/jobs/intraday

# Check status
curl -s "https://tft-trading-system.yanggf.workers.dev/api/v1/jobs/runs?report_type=intraday&limit=1" \
  | jq '.data.runs[0] | {status, warnings}'

# Check pre-market run ID in report
curl -s "https://tft-trading-system.yanggf.workers.dev/api/v1/jobs/snapshots/$(date +%Y-%m-%d)/intraday" \
  | jq '.data.data.pre_market_run_id'
```

---

## Files Modified

1. `src/routes/jobs-routes.ts` - Added `pre_market_run_id` to job result
2. `src/modules/scheduler.ts` - Enhanced partial status detection for missing pre-market data

---

**Purpose Restored**: Intraday job now correctly reflects its calibration purpose - it's only successful when it can actually validate pre-market predictions.
