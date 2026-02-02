# Intraday Job Improvements - 2026-01-31

## Changes Made

### 1. Pre-Market Run ID Tracking & Display
**Issue**: Intraday reports didn't show which pre-market run was used for comparison.

**Fix**:
- Added `pre_market_run_id` to intraday job result in manual job handler (`src/routes/jobs-routes.ts`)
- Made pre-market run ID a clickable link to the specific pre-market report (`src/modules/handlers/intraday-handlers.ts`)
- Link format: `/api/v1/reports/pre-market?run_id={full_run_id}`

**Result**: Intraday reports now display and link to the exact pre-market run used for comparison.

---

### 2. Partial Status for Incomplete Comparisons
**Issue**: Intraday jobs showed `status: 'success'` even when all comparisons were incomplete due to missing pre-market data, defeating the job's calibration purpose.

**Fix**:
- Updated status logic in scheduler (`src/modules/scheduler.ts`) to check for missing pre-market data
- Updated status logic in manual job handler (`src/routes/jobs-routes.ts`) to match scheduler behavior
- Jobs now marked as `partial` when all comparisons are incomplete

**Detection Logic**:
```typescript
const allIncomplete = analysisData.comparisons?.every((comp: any) => 
  comp.comparison?.status === 'incomplete' || 
  comp.intraday?.status === 'failed' ||
  comp.intraday?.articles_count === 0 ||
  comp.premarket?.status === 'failed' ||  // NEW
  comp.premarket?.error                    // NEW
);
```

**Result**: Intraday jobs accurately reflect their calibration purpose - only `success` when actual validation is possible.

---

### 3. Legacy Pre-Market Data Support
**Issue**: Old pre-market snapshots without `dual_model` structure were incorrectly marked as "failed" in intraday comparisons.

**Fix**: Added fallback logic in `src/modules/intraday-data-bridge.ts` to treat pre-market data as valid if it has `direction` and `confidence`, even without model status fields.

```typescript
const hasValidData = morning.direction && morning.confidence !== null && morning.confidence > 0;
const bothFailed = !gemmaOk && !distilbertOk && !hasValidData;
```

**Result**: Intraday reports can now use legacy pre-market data for comparisons.

---

### 4. Dashboard Batch Delete Guards
**Issue**: Dashboard could submit `undefined` run_ids to batch delete API.

**Fix**: Added validation in `public/dashboard.html`:
- Checkboxes disabled for rows without valid `run_id`
- Select-all skips invalid rows
- Delete buttons disabled for invalid rows

---

### 5. Delete Endpoint Authentication
**Issue**: Single and batch delete endpoints were publicly accessible despite being destructive operations.

**Fix**: Added `validateApiKey()` to both endpoints in `src/routes/jobs-routes.ts`:
- `DELETE /api/v1/jobs/runs/:runId` - Now requires API key
- `POST /api/v1/jobs/runs/batch-delete` - Now requires API key

---

### 6. SPY Market Pulse Source Attribution
**Issue**: Market pulse always reported `source: 'Finnhub'` even when using fallback sources (FMP/NewsAPI/Yahoo).

**Fix**: Derive actual source from news articles' `source_type` field in `src/modules/pre-market-data-bridge.ts`:
- Reports: `finnhub`, `fmp_with_sentiment`, `newsapi`, `yahoo`, `mixed`, or `unknown`
- Accurate monitoring/analytics attribution

---

## Files Modified

1. `src/routes/jobs-routes.ts` - Pre-market run ID tracking, partial status logic, auth
2. `src/modules/scheduler.ts` - Partial status detection for missing pre-market data
3. `src/modules/handlers/intraday-handlers.ts` - Clickable pre-market run ID link
4. `src/modules/intraday-data-bridge.ts` - Legacy pre-market data support
5. `src/modules/pre-market-data-bridge.ts` - Accurate source attribution
6. `public/dashboard.html` - Batch delete guards

---

## Testing

All changes tested and verified:
- ✅ TypeScript passes (0 errors)
- ✅ Pre-market run ID displays and links correctly
- ✅ Partial status shows when comparisons incomplete
- ✅ Legacy pre-market data works
- ✅ Delete endpoints require authentication
- ✅ Source attribution accurate

---

## API Behavior

### Intraday Job Status
- `success` - All comparisons complete with valid pre-market and intraday data
- `partial` - All comparisons incomplete (missing pre-market or intraday data)
- `failed` - Job execution error

### Pre-Market Report Access
Both endpoints support `?run_id=` parameter:
- `/api/v1/reports/pre-market?run_id={run_id}` - View specific run
- `/api/v1/reports/pre-market?date={date}` - View latest for date

---

**Purpose Restored**: Intraday job now correctly reflects its calibration purpose and provides full traceability to source pre-market runs.
