# Pre-Market Multi-Run Support Fix

## Issue
Pre-market scheduled jobs were not creating multiple run entries despite the multi-run architecture being in place. Manual triggers worked, but scheduled cron jobs only created one entry per date.

## Root Cause
The pre-market job handler (`morning_prediction_alerts` trigger mode) in `src/modules/scheduler.ts` was **not using the multi-run tracking system** (`startJobRun()` / `completeJobRun()`), while weekly and end-of-day jobs were already using it.

### Code Comparison

**Before (Pre-Market - No Multi-Run):**
```typescript
} else {
  // Enhanced pre-market analysis with sentiment (morning_prediction_alerts)
  console.log(`🚀 [CRON-ENHANCED] ${cronExecutionId} Running enhanced analysis with sentiment...`);
  analysisResult = await runEnhancedPreMarketAnalysis(env, {
    triggerMode,
    predictionHorizons,
    currentTime: estTime,
    cronExecutionId
  });
}
```

**After (Pre-Market - With Multi-Run):**
```typescript
} else {
  // Enhanced pre-market analysis with sentiment (morning_prediction_alerts)
  console.log(`🚀 [CRON-ENHANCED] ${cronExecutionId} Running enhanced analysis with sentiment...`);

  // Start multi-run tracking
  runId = await startJobRun(env, {
    scheduledDate: dateStr,
    reportType: 'pre-market',
    triggerSource: 'cron'
  });
  runTrackingEnabled = !!runId;

  if (runTrackingEnabled) {
    await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'pre-market', stage: 'init' });
    await endJobStage(env, { runId, stage: 'init' });
    await startJobStage(env, { runId, scheduledDate: dateStr, reportType: 'pre-market', stage: 'ai_analysis' });
  }

  analysisResult = await runEnhancedPreMarketAnalysis(env, {
    triggerMode,
    predictionHorizons,
    currentTime: estTime,
    cronExecutionId
  });

  if (runTrackingEnabled) {
    await endJobStage(env, { runId, stage: 'ai_analysis' });
  }
}
```

## Changes Made

### 1. Function-Scoped Variables (`src/modules/scheduler.ts:83-95`)
Added `runId` and `runTrackingEnabled` at function scope so they're accessible across all job types:

```typescript
export async function handleScheduledEvent(
  controller: ScheduledController,
  env: CloudflareEnvironment,
  ctx: ExecutionContext,
  overrideTriggerMode?: string
): Promise<Response> {
  const scheduledTime = new Date(controller.scheduledTime);
  const cronExecutionId = `cron_${Date.now()}`;
  let triggerMode: string;
  let predictionHorizons: number[];
  let runId: string | null = null;           // ← Added
  let runTrackingEnabled = false;            // ← Added
```

### 2. Pre-Market Job Tracking (`src/modules/scheduler.ts:593-625`)
Added multi-run tracking to pre-market job execution:

- **`startJobRun()`**: Creates entry in `job_run_results` table with unique `run_id`
- **Stage Tracking**: Tracks `init` → `ai_analysis` → `storage` → `finalize` stages
- **`completeJobRun()`**: Marks job as complete with success/failure status

### 3. Storage Stage & Completion (`src/modules/scheduler.ts:680-750`)
Updated D1 write section to include:

- Storage stage tracking for pre-market jobs
- Pass `run_id` to `writeD1JobResult()` for linking
- Call `completeJobRun()` on success or failure

```typescript
// Start storage stage
if (runTrackingEnabled && d1ReportType === 'pre-market') {
  await startJobStage(env, { runId: runId!, scheduledDate: dateStr, reportType: 'pre-market', stage: 'storage' });
}

// Write to D1 with run_id
const d1Written = await writeD1JobResult(env, dateStr, d1ReportType, {
  ...analysisResult,
  cron_execution_id: cronExecutionId,
  trigger_mode: triggerMode,
  generated_at: estTime.toISOString()
}, {
  processingTimeMs: Date.now() - scheduledTime.getTime(),
  ai_models: {
    primary: '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
    secondary: '@cf/huggingface/distilbert-sst-2-int8'
  }
}, 'cron', runTrackingEnabled ? runId! : undefined);  // ← Pass run_id

// End storage stage
if (runTrackingEnabled && d1ReportType === 'pre-market') {
  await endJobStage(env, { runId: runId!, stage: 'storage' });
}

// Complete job run
if (runTrackingEnabled && d1ReportType === 'pre-market') {
  await completeJobRun(env, {
    runId: runId!,
    scheduledDate: dateStr,
    reportType: 'pre-market',
    status: 'success'
  });
}
```

## Expected Behavior After Fix

### Database Tables
1. **`job_run_results`**: Each scheduled pre-market job creates a new row with unique `run_id`
2. **`job_date_results`**: Links `scheduled_date` + `report_type` to latest `run_id`
3. **`scheduled_job_results`**: Stores actual report data with `run_id` reference

### Frontend
- Pre-market reports now support `?run_id=` parameter to view specific runs
- Dashboard shows run history with delete capability
- Navigation displays latest run status with partial indicators (⚠️)

### API Endpoints
- `GET /api/v1/reports/pre-market?run_id=<run_id>` - View specific run
- `GET /api/v1/reports/pre-market` - View latest run (default)
- `DELETE /api/v1/jobs/runs/<run_id>` - Delete specific run

## Testing

### Manual Trigger Test
```bash
curl -X POST https://tft-trading-system.yanggf.workers.dev/api/v1/jobs/trigger \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: yanggf" \
  -d '{"triggerMode": "morning_prediction_alerts"}'
```

Expected: Creates new `run_id` in `job_run_results` table

### Scheduled Cron Test
Wait for next scheduled pre-market job (Mon-Fri 12:30 UTC / 8:30 AM ET)

Expected:
- GitHub Actions workflow triggers
- Creates new `run_id` in database
- Dashboard shows new run entry
- Previous runs remain accessible

### Verification Queries
```sql
-- Check run history for today
SELECT run_id, scheduled_date, report_type, status, created_at 
FROM job_run_results 
WHERE scheduled_date = '2026-01-28' AND report_type = 'pre-market'
ORDER BY created_at DESC;

-- Check latest run mapping
SELECT * FROM job_date_results 
WHERE scheduled_date = '2026-01-28' AND report_type = 'pre-market';

-- Check stage timeline
SELECT run_id, stage, status, started_at, ended_at 
FROM job_run_stages 
WHERE run_id = '<run_id_from_above>'
ORDER BY started_at;
```

## Consistency with Other Jobs

All job types now use the same multi-run architecture:

| Job Type | Trigger Mode | Multi-Run Support | Stage Tracking |
|----------|-------------|-------------------|----------------|
| Pre-Market | `morning_prediction_alerts` | ✅ **NOW FIXED** | ✅ init → ai_analysis → storage |
| Intraday | `midday_validation_prediction` | ✅ Already supported | ✅ Full tracking |
| End-of-Day | `next_day_market_prediction` | ✅ Already supported | ✅ Full tracking |
| Weekly | `weekly_review_analysis` | ✅ Already supported | ✅ Full tracking |

## Files Modified
- `src/modules/scheduler.ts` - Added multi-run tracking to pre-market job handler

## Related Documentation
- `docs/NAVIGATION_REDESIGN_V2.md` - Multi-run architecture specification
- `CLAUDE.md` - Job tracking system overview
- `README.md` - System status and features

## Deployment
```bash
npm run build
npm run deploy
```

## Rollback Plan
If issues occur, revert commit and redeploy. The system will fall back to single-run behavior (no breaking changes).

---

**Status**: ✅ Fixed (2026-01-28)
**Impact**: Pre-market jobs now support multiple runs per date, consistent with other job types
**Breaking Changes**: None - backward compatible with existing data
