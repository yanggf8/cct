# Failure Report Display Enhancement

**Date**: 2026-01-29  
**Status**: ✅ Complete

## Problem

When clicking on a failed end-of-day report, users could not see:
1. The failure reason/error messages
2. The job progress log showing which stage failed
3. Any warnings that occurred during execution

The dashboard showed the status (❌ Failed) but the actual report page had no diagnostic information.

## Solution

Enhanced the end-of-day report handler to display comprehensive failure diagnostics when viewing a failed or partial job run.

## Changes Made

### 1. Backend Changes (`src/modules/handlers/end-of-day-handlers.ts`)

#### Added Helper Functions
- `fetchJobRunDetails()` - Fetches status, current_stage, errors_json, warnings_json from `job_run_results` table
- `fetchJobStageLog()` - Fetches complete stage timeline from `job_stage_log` table
- `formatErrorsJson()` - Formats error JSON for human-readable display

#### Enhanced Report Generation
- Modified `handleEndOfDaySummary()` to fetch job run details when `run_id` is present
- Passes failure information to HTML generator
- Embeds stage log data to avoid extra API calls

### 2. Frontend Changes (HTML/CSS/JS in end-of-day-handlers.ts)

#### New Failure Section
Displays when job status is 'failed' or 'partial':
- **Status Badge**: Visual indicator (❌ Failed / ⚠️ Partial Success)
- **Last Stage**: Shows which stage the job was in when it failed
- **Errors Section**: Formatted display of all errors with symbol/stage context
- **Warnings Section**: Display of warnings (if any)
- **Job Progress Log**: Timeline of all stages with:
  - Stage icons (🚀 Init, 📥 Data Fetch, 🤖 AI Analysis, 💾 Storage, ✅ Finalize)
  - Start times
  - Duration for completed stages
  - Visual status indicators (green=completed, yellow=running, red=failed)

#### Styling
- Red-themed failure section with semi-transparent background
- Monospace error logs with syntax highlighting
- Timeline-style stage display with color-coded borders
- Responsive layout

#### JavaScript
- Fetches stage log from API endpoint `/api/v1/jobs/runs/:runId/stages`
- Falls back to embedded data if available (performance optimization)
- Renders stage timeline with time formatting and duration calculations

### 3. API Changes (`src/routes/jobs-routes.ts`)

#### New Endpoint
```
GET /api/v1/jobs/runs/:runId/stages
```

**Purpose**: Fetch stage log for a specific job run  
**Access**: Public (no auth required)  
**Response**:
```json
{
  "success": true,
  "data": {
    "runId": "...",
    "stages": [
      {
        "stage": "init",
        "started_at": "2026-01-29T01:30:00Z",
        "ended_at": "2026-01-29T01:30:01Z"
      },
      ...
    ],
    "count": 5
  }
}
```

## Database Schema Used

### Tables
1. **job_run_results** - Contains:
   - `status` - success/failed/partial/running
   - `current_stage` - Last stage executed
   - `errors_json` - Array of error objects
   - `warnings_json` - Array of warning objects

2. **job_stage_log** - Contains:
   - `run_id` - Links to job_run_results
   - `stage` - Stage name (init/data_fetch/ai_analysis/storage/finalize)
   - `started_at` - Stage start timestamp
   - `ended_at` - Stage end timestamp (null if still running)

## User Experience

### Before
- Click failed report → See empty/stale data
- No indication of what went wrong
- No way to debug issues

### After
- Click failed report → See comprehensive failure diagnostics:
  - Clear status indicator
  - Exact error messages with context
  - Complete stage timeline showing where it failed
  - Duration metrics for performance analysis
  - Warnings that may have contributed to failure

## Example Display

```
🔍 Job Execution Details

Status: ❌ Failed
Last Stage: ai_analysis

❌ Errors
1. AAPL: AI model timeout after 30s
2. MSFT: Rate limit exceeded - retry after 60s
3. GOOGL: Invalid response from sentiment API

⚠️ Warnings
1. Cache miss for 3/5 symbols
2. Fallback to legacy data source for TSLA

📋 Job Progress Log
🚀 Initialization     1:30:00 AM (0.5s)    ✓
📥 Data Fetch        1:30:01 AM (2.3s)    ✓
🤖 AI Analysis       1:30:03 AM (45.2s)   ✗ Failed
💾 Storage           -                    Not started
✅ Finalization      -                    Not started
```

## Testing

1. **Build**: ✅ No TypeScript errors
2. **Manual Testing Required**:
   - Trigger a job that will fail (e.g., invalid symbols)
   - Click the failed job from dashboard
   - Verify failure section displays
   - Verify stage log shows correct timeline
   - Verify errors are formatted correctly

## Future Enhancements

1. Apply same pattern to other report types (pre-market, intraday, weekly)
2. Add retry button for failed jobs
3. Add symbol-level failure breakdown
4. Add performance metrics visualization
5. Add export functionality for error logs

## Files Modified

1. `src/modules/handlers/end-of-day-handlers.ts` - Main changes
2. `src/routes/jobs-routes.ts` - New API endpoint

## Rollout

- ✅ TypeScript compilation successful
- ⏳ Deploy to staging for testing
- ⏳ Verify with real failed jobs
- ⏳ Apply pattern to other report handlers
- ⏳ Deploy to production

---

**Note**: This enhancement only affects the end-of-day report. The same pattern should be applied to pre-market, intraday, and weekly reports for consistency.
