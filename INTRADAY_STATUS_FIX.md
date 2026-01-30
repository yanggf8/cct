# Intraday Job Status Fix - Partial Status for All-Failed Symbols

**Date**: 2026-01-31  
**Status**: ✅ Fixed

## Problem

Intraday job showed `status: 'success'` in job history despite all 5 symbols having incomplete data:
- All symbols: `articles_count: 0`
- All AI models: `status: 'failed'`, `error: 'No data'`
- All comparisons: `status: 'incomplete'`
- Report displayed: "5 Incomplete" with no useful analysis

**Root Cause**: The scheduler only checked for empty symbols array (`symbols.length === 0`) but didn't detect when all symbols had failed/incomplete data.

## Solution

Added logic to detect when all symbols have incomplete data and mark the job as `'partial'` instead of `'success'`.

## Changes Made

### File: `src/modules/scheduler.ts`

**Line 403-420**: Added all-incomplete detection:

```typescript
} else {
  // Check if all symbols have incomplete/failed data
  const allIncomplete = intradayResult.comparisons?.every((comp: any) => 
    comp.comparison?.status === 'incomplete' || 
    comp.intraday?.status === 'failed' ||
    comp.intraday?.articles_count === 0
  );
  
  if (allIncomplete) {
    console.warn(`⚠️ [CRON-INTRADAY] ${cronExecutionId} All symbols incomplete - news fetch failed for all symbols`);
    intradayHasEmptySymbols = true;  // Flag for partial status
  }

  // Transform to scheduler expected shape...
}
```

**Line 868**: Updated warning message:

```typescript
const warnings = (d1ReportType === 'intraday' && intradayHasEmptySymbols)
  ? ['Intraday analysis incomplete - news fetch failed for all symbols or no pre-market data available']
  : undefined;
```

## Detection Logic

The job is now marked as `'partial'` when:

1. **Empty symbols array**: `symbols.length === 0` (existing check)
2. **All symbols incomplete** (new check):
   - `comparison.status === 'incomplete'`, OR
   - `intraday.status === 'failed'`, OR
   - `intraday.articles_count === 0`

## Expected Behavior

### Before Fix
```json
{
  "status": "success",  // ❌ Misleading
  "current_stage": "finalize"
}
```

### After Fix
```json
{
  "status": "partial",  // ✅ Accurate
  "current_stage": "finalize",
  "warnings": ["Intraday analysis incomplete - news fetch failed for all symbols or no pre-market data available"]
}
```

## Dashboard Display

Jobs with `status: 'partial'` will show:
- ⚠️ Warning icon instead of ✅ success
- Warning message in job details
- Clear indication that data is incomplete

## Root Cause of News Fetch Failure

The underlying issue (all symbols returning 0 articles) is likely:
1. **Finnhub API rate limit** - 60 calls/min exceeded
2. **API key issue** - `FINNHUB_API_KEY` not configured or invalid
3. **Network timeout** - All fallbacks (FMP, NewsAPI, Yahoo) also failed
4. **Date/time issue** - Requesting news for future date or invalid range

**Recommendation**: Check Cloudflare Workers logs for the actual news fetch errors during the intraday job execution.

## Testing

```bash
# TypeScript validation
npm run typecheck  # ✅ Passes

# Check next intraday job status
curl -s "https://tft-trading-system.yanggf.workers.dev/api/v1/jobs/runs?report_type=intraday&limit=1" \
  | jq '.data.runs[0] | {status, warnings}'

# Expected when all symbols fail:
# {
#   "status": "partial",
#   "warnings": ["Intraday analysis incomplete - news fetch failed..."]
# }
```

## Related Files

- `src/modules/intraday-data-bridge.ts` - Generates intraday analysis
- `src/modules/free_sentiment_pipeline.ts` - News fetching logic
- `src/modules/handlers/intraday-handlers.ts` - Report rendering

---

**Fix Complete**: Intraday jobs now accurately report `'partial'` status when all symbols have incomplete data.
