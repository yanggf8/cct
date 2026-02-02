# Navigation Redesign V2: Date-Based Report Hierarchy

**Date**: 2026-01-28
**Status**: ✅ Complete
**Version**: 2.3 (Multi-Run Support)
**Implemented**: 2026-01-28

## Overview

Replace the "Today/Yesterday" navigation pattern with a date-based hierarchy showing the last 3 trading days, each containing Pre-Market, Intraday, and End-of-Day reports. Weekly remains a standalone top-level item.

## Design Principles

1. **Market Timezone Authority**: All dates and schedule times are in **US Eastern Time (ET)** regardless of user's configured display timezone
2. **Trading Days Only**: Navigation shows only NYSE trading days (excludes weekends and market holidays)
3. **Status Transparency**: Users can see job status at a glance, including failures and in-progress jobs

## Navigation Structure

```
├── 📊 Reports              ← expandable (no navigation)
│   ├── Jan 28 (Wed)        ← expandable, auto-expanded if most recent
│   │   ├── Pre-Market  ✅
│   │   ├── Intraday    🔄
│   │   └── End-of-Day  ⚪
│   ├── Jan 27 (Tue)        ← expandable
│   │   ├── Pre-Market  ✅
│   │   ├── Intraday    ✅
│   │   └── End-of-Day  ❌
│   └── Jan 26 (Mon)        ← expandable (pre-cutover, n/a)
│       ├── Pre-Market  ➖
│       ├── Intraday    ➖
│       └── End-of-Day  ➖
├── 📅 Weekly               ← direct link to /weekly-review
```

### Status Indicators
| Icon | Status | Meaning |
|------|--------|---------|
| ✅ (checkmark) | `success` | Report generated successfully - all symbols analyzed |
| ⚠️ (warning) | `partial` | Report generated but some symbols failed (>0 success, >0 failed) |
| ❌ (cross) | `failed` | Job ran but failed completely (0 symbols or critical error) |
| 🔄 (spinner) | `running` | Job currently executing |
| ⚪ (circle) | `missed` | Post-cutover date with no row (job never started) |
| ➖ (dash) | `n/a` | Pre-cutover historical data (non-reproducible, not a failure) |

**Partial Status Trigger Conditions:**
- Job completes but `symbols_failed > 0` AND `symbols_successful > 0`
- AI model fallback was used (primary model timeout, secondary succeeded)
- Data source degradation (e.g., news API returned partial results)

### Error Visibility
- **Hover/Tooltip**: Failed jobs show error summary on hover
- **Click**: Navigates to report page which displays detailed error information
- **Dashboard**: System Status page shows all job failures and stage logs

## URL Pattern

```
/pre-market-briefing?date=YYYY-MM-DD
/intraday-check?date=YYYY-MM-DD
/end-of-day-summary?date=YYYY-MM-DD
/weekly-review
```

## D1 Schema: Four-Table Architecture

### Design Rationale
Support **multiple job runs per day** while keeping navigation fast:
- **`job_date_results`**: Summary table for nav (ONE row per date/type = latest status)
- **`job_run_results`**: Run metadata history (multiple rows per date/type = all runs)
- **`job_stage_log`**: Stage timeline per run (references `run_id`)
- **`scheduled_job_results`**: Report content (trading signals, etc.) keyed by `run_id`

This separation allows:
1. Fast nav lookups (query `job_date_results` only)
2. Full run history for debugging/testing (query `job_run_results`)
3. Report pages can load any historical run's **full content** via `?run_id=`

### Critical Design Decision: Fresh Start (True Multi-Run)

This v2.3 migration is intentionally **destructive**: old D1 rows are dropped and not preserved.

**Goal**: allow multiple runs per `(scheduled_date, report_type)` without overwriting.

| Table | Cardinality | Purpose |
|-------|-------------|---------|
| `job_date_results` | 1 row per date/type | Navigation summary (latest status) |
| `job_run_results` | N rows per date/type | Run history (one row per run_id) |
| `job_stage_log` | N rows per run | Stage timeline per run_id |
| `scheduled_job_results` | N rows per date/type | Snapshot history (one row per write; latest chosen by `created_at`) |

### Cutover Definition
Fixed date constant set to deployment day. Any trading date before cutover returns `n/a`. Any trading date on/after cutover with no row returns `missed`.
**Cutover date**: `2026-01-28` (update on actual deploy).

```typescript
// src/modules/trading-calendar.ts
export const NAV_CUTOVER_DATE = '2026-01-28'; // Set to deployment date (update on deploy)

export function getStatusForMissingRow(date: string): 'n/a' | 'missed' {
  return date < NAV_CUTOVER_DATE ? 'n/a' : 'missed';
}
```

### Schema

```sql
-- ============================================================================
-- job_date_results: Summary table for navigation (ONE row per date/type)
-- Navigation queries this table only - always shows LATEST run status
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_date_results (
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  status TEXT NOT NULL CHECK(status IN ('success','partial','failed','running')),
  current_stage TEXT,
  errors_json TEXT,              -- JSON array: ["error1", "error2"]
  warnings_json TEXT,            -- JSON array: ["warning1"]
  executed_at TEXT,              -- ISO timestamp (when job completed or failed)
  started_at TEXT,               -- ISO timestamp (when job started)
  trigger_source TEXT,           -- 'cron' | 'manual' | 'github_actions'
  latest_run_id TEXT,            -- Points to job_run_results(run_id) for latest run
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (scheduled_date, report_type)
);

CREATE INDEX idx_job_date_results_date ON job_date_results(scheduled_date DESC);
CREATE INDEX idx_job_date_results_status ON job_date_results(status) WHERE status = 'running';

-- ============================================================================
-- job_run_results: History table (multiple rows per date/type = all runs)
-- Each job execution creates a new row with unique run_id
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_run_results (
  run_id TEXT PRIMARY KEY,       -- UUID: `${date}_${type}_${timestamp}` e.g. "2026-01-28_pre-market_1706400000000"
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  status TEXT NOT NULL CHECK(status IN ('success','partial','failed','running')),
  current_stage TEXT,
  errors_json TEXT,
  warnings_json TEXT,
  started_at TEXT NOT NULL,
  executed_at TEXT,              -- When job completed (null if running)
  trigger_source TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_job_run_results_lookup ON job_run_results(scheduled_date, report_type, created_at DESC);
CREATE INDEX idx_job_run_results_status ON job_run_results(status) WHERE status = 'running';

-- ============================================================================
-- job_stage_log: Stage timeline per run
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_stage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,          -- Links to job_run_results(run_id)
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  stage TEXT NOT NULL CHECK(stage IN ('init','data_fetch','ai_analysis','storage','finalize')),
  status TEXT CHECK(status IN ('running','success','failed')),
  errors_json TEXT,
  warnings_json TEXT,
  details_json TEXT,             -- JSON: small per-stage summary (counts, ids, flags)
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES job_run_results(run_id)
);

CREATE INDEX idx_job_stage_log_run ON job_stage_log(run_id, stage);
CREATE INDEX idx_job_stage_log_lookup ON job_stage_log(scheduled_date, report_type, stage);

-- ============================================================================
-- scheduled_job_results: Report content snapshots (multi-run)
-- NOTE: report_type is intentionally unconstrained (supports analysis/morning_predictions/etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduled_job_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL,
  report_content TEXT NOT NULL,  -- JSON: trading signals, market pulse, etc.
  metadata TEXT,
  trigger_source TEXT,
  run_id TEXT,                   -- Optional link to job_run_results(run_id)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_scheduled_job_results_lookup ON scheduled_job_results(scheduled_date DESC, report_type, created_at DESC);
CREATE INDEX idx_scheduled_job_results_run ON scheduled_job_results(run_id);
CREATE UNIQUE INDEX idx_scheduled_job_results_run_unique ON scheduled_job_results(run_id);
```

**Note**: Only `success`, `partial`, `failed`, `running` are stored in status tables. `n/a` and `missed` are computed from cutover + presence/absence of a row in `job_date_results`.

### Race Condition Behavior (Documented)

**Scenario**: Two runs for the same date/type overlap:
```
Run A starts (08:30) → latest_run_id = A
Run B starts (08:35) → latest_run_id = B (overwrites A)
Run A completes (08:40) → WHERE latest_run_id = A fails, summary NOT updated
Run B fails (08:42) → summary shows 'failed'
```

**Expected behavior**: The **last-started run** determines the summary status. This is intentional:
- Navigation shows the most recent attempt's status
- Older runs complete silently into `job_run_results` (history preserved)
- Users can still view Run A's successful content via `?run_id=`

**If you need "latest-completed wins"**, change `completeJobRun()` to unconditionally update `job_date_results` (not recommended - leads to status flickering).

### Data Retention & Cleanup

**Policy**: Retain run history for 30 days. Older runs are deleted by cleanup job.

```typescript
// Cleanup function - run daily via GitHub Actions
export async function cleanupOldRuns(env: CloudflareEnvironment, retentionDays = 30): Promise<number> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return 0;

  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  // Delete old runs (cascade to stage_log via FK, delete from scheduled_job_results)
  const result = await db.batch([
    db.prepare(`DELETE FROM job_stage_log WHERE run_id IN (SELECT run_id FROM job_run_results WHERE created_at < ?)`).bind(cutoffDate),
    db.prepare(`DELETE FROM scheduled_job_results WHERE run_id IN (SELECT run_id FROM job_run_results WHERE created_at < ?)`).bind(cutoffDate),
    db.prepare(`DELETE FROM job_run_results WHERE created_at < ?`).bind(cutoffDate)
  ]);

  return result[2].meta?.changes ?? 0;
}
```

**Note**: `job_date_results` is NOT cleaned - it always retains the latest status per date (for navigation).

### Stale Job Handling (Updated for Multi-Run)

`markStaleJobsAsFailed()` must update **both** tables:

```typescript
export async function markStaleJobsAsFailed(env: CloudflareEnvironment): Promise<number> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return 0;

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Update both history table and summary table
  const results = await db.batch([
    // 1. Update stale runs in history table
    db.prepare(`
      UPDATE job_run_results
      SET status = 'failed', errors_json = '["Job stalled - marked failed after 30 minutes"]', executed_at = ?
      WHERE status = 'running' AND started_at < ?
    `).bind(now, thirtyMinutesAgo),

    // 2. Update summary table where latest_run_id points to a stale run
    db.prepare(`
      UPDATE job_date_results
      SET status = 'failed', errors_json = '["Job stalled - marked failed after 30 minutes"]', executed_at = ?, updated_at = ?
      WHERE status = 'running' AND started_at < ?
    `).bind(now, now, thirtyMinutesAgo)
  ]);

  return (results[0].meta?.changes ?? 0) + (results[1].meta?.changes ?? 0);
}
```

### Write Semantics (Multi-Run)

**Job Start Flow:**
1. Generate `run_id`: `${scheduledDate}_${reportType}_${Date.now()}`
2. INSERT into `job_run_results` (running status)
3. UPSERT `job_date_results` with `latest_run_id` pointing to new run
4. INSERT init stage into `job_stage_log` with `run_id`

**Job Completion Flow:**
1. UPDATE `job_run_results` with final status/errors
2. UPSERT `job_date_results` to reflect latest status
3. UPDATE final stage in `job_stage_log`

**Key Invariants:**
- `job_date_results` always reflects the **latest** run's status
- `job_run_results` preserves **all** runs (insert-only, never overwrite)
- `job_stage_log` is scoped to `run_id` (each run has its own timeline)

```typescript
// src/modules/d1-job-storage.ts

/**
 * Generate unique run ID for job execution
 */
export function generateRunId(scheduledDate: string, reportType: ReportType): string {
  return `${scheduledDate}_${reportType}_${Date.now()}`;
}

/**
 * Start a new job run - creates entries in both history and summary tables
 * Returns the run_id for use in subsequent calls
 */
export async function startJobRun(
  env: CloudflareEnvironment,
  params: {
    scheduledDate: string;
    reportType: ReportType;
    triggerSource: JobTriggerSource;
  }
): Promise<string | null> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return null;

  const runId = generateRunId(params.scheduledDate, params.reportType);
  const now = new Date().toISOString();

  try {
    // 1. Insert into history table (job_run_results)
    await db.prepare(`
      INSERT INTO job_run_results
      (run_id, scheduled_date, report_type, status, current_stage, started_at, trigger_source)
      VALUES (?, ?, ?, 'running', 'init', ?, ?)
    `).bind(runId, params.scheduledDate, params.reportType, now, params.triggerSource).run();

    // 2. Upsert summary table (job_date_results) - always points to latest run
    await db.prepare(`
      INSERT INTO job_date_results
      (scheduled_date, report_type, status, current_stage, started_at, trigger_source, latest_run_id, updated_at, created_at)
      VALUES (?, ?, 'running', 'init', ?, ?, ?, ?, ?)
      ON CONFLICT(scheduled_date, report_type) DO UPDATE SET
        status = 'running',
        current_stage = 'init',
        started_at = excluded.started_at,
        trigger_source = excluded.trigger_source,
        latest_run_id = excluded.latest_run_id,
        updated_at = excluded.updated_at,
        errors_json = NULL,
        warnings_json = NULL,
        executed_at = NULL
    `).bind(params.scheduledDate, params.reportType, now, params.triggerSource, runId, now, now).run();

    return runId;
  } catch (error) {
    logger.error('startJobRun failed', { error: (error as Error).message, ...params });
    return null;
  }
}

/**
 * Complete a job run - updates both history and summary tables
 */
export async function completeJobRun(
  env: CloudflareEnvironment,
  params: {
    runId: string;
    scheduledDate: string;
    reportType: ReportType;
    status: 'success' | 'partial' | 'failed';
    currentStage?: JobStage;
    errors?: string[];
    warnings?: string[];
  }
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return false;

  const now = new Date().toISOString();
  const errorsJson = params.errors ? JSON.stringify(params.errors) : null;
  const warningsJson = params.warnings ? JSON.stringify(params.warnings) : null;

  try {
    // 1. Update history table (job_run_results)
    await db.prepare(`
      UPDATE job_run_results
      SET status = ?, current_stage = ?, errors_json = ?, warnings_json = ?, executed_at = ?
      WHERE run_id = ?
    `).bind(params.status, params.currentStage ?? 'finalize', errorsJson, warningsJson, now, params.runId).run();

    // 2. Update summary table (job_date_results) - only if this is still the latest run
    await db.prepare(`
      UPDATE job_date_results
      SET status = ?, current_stage = ?, errors_json = ?, warnings_json = ?, executed_at = ?, updated_at = ?
      WHERE scheduled_date = ? AND report_type = ? AND latest_run_id = ?
    `).bind(params.status, params.currentStage ?? 'finalize', errorsJson, warningsJson, now, now,
            params.scheduledDate, params.reportType, params.runId).run();

    return true;
  } catch (error) {
    logger.error('completeJobRun failed', { error: (error as Error).message, ...params });
    return false;
  }
}

/**
 * Update current stage for a run
 */
export async function updateRunStage(
  env: CloudflareEnvironment,
  runId: string,
  scheduledDate: string,
  reportType: ReportType,
  stage: JobStage
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return false;

  const now = new Date().toISOString();

  try {
    // Update both tables
    await db.batch([
      db.prepare(`UPDATE job_run_results SET current_stage = ? WHERE run_id = ?`).bind(stage, runId),
      db.prepare(`UPDATE job_date_results SET current_stage = ?, updated_at = ? WHERE scheduled_date = ? AND report_type = ? AND latest_run_id = ?`)
        .bind(stage, now, scheduledDate, reportType, runId)
    ]);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Start a job stage - append to job_stage_log with run_id
 */
export async function startJobStage(
  env: CloudflareEnvironment,
  params: {
    runId: string;
    scheduledDate: string;
    reportType: ReportType;
    stage: JobStage;
  }
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return false;

  const now = new Date().toISOString();
  try {
    await db.prepare(`
      INSERT INTO job_stage_log (run_id, scheduled_date, report_type, stage, status, started_at)
      VALUES (?, ?, ?, ?, 'running', ?)
    `).bind(params.runId, params.scheduledDate, params.reportType, params.stage, now).run();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * End a job stage - update ended_at by run_id
 */
export async function endJobStage(
  env: CloudflareEnvironment,
  params: {
    runId: string;
    stage: JobStage;
  }
): Promise<boolean> {
  const db = env.PREDICT_JOBS_DB;
  if (!db) return false;

  const now = new Date().toISOString();
  try {
    await db.prepare(`
      UPDATE job_stage_log
      SET ended_at = ?, status = 'success'
      WHERE run_id = ? AND stage = ? AND ended_at IS NULL
    `).bind(now, params.runId, params.stage).run();
    return true;
  } catch (error) {
    return false;
  }
}
```

## API Endpoints

### `GET /api/v1/reports/status` (Navigation Status)

**Purpose**: Fast lookup for navigation display - returns **latest** run status per date/type.

**Authentication**: None (public, read-only)

**Caching**: `Cache-Control` with 60s TTL during market hours, 5min otherwise

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | number | 3 | Number of trading days to return (max 10) |

**Response**:
```json
{
  "success": true,
  "data": {
    "2026-01-28": {
      "label": "Jan 28 (Wed)",
      "pre-market": { "status": "success", "executed_at": "2026-01-28T13:33:14Z", "run_id": "2026-01-28_pre-market_1706400000000" },
      "intraday": { "status": "running", "started_at": "2026-01-28T17:00:05Z", "current_stage": "ai_analysis" },
      "end-of-day": { "status": "missed" }
    },
    "2026-01-27": {
      "label": "Jan 27 (Tue)",
      "pre-market": { "status": "success", "executed_at": "2026-01-27T13:31:00Z", "run_id": "2026-01-27_pre-market_1706313060000" },
      "intraday": { "status": "success", "executed_at": "2026-01-27T17:02:00Z" },
      "end-of-day": { "status": "failed", "current_stage": "ai_analysis", "errors": ["Gemma model timeout after 30s"] }
    }
  },
  "meta": {
    "timezone": "America/New_York",
    "cutover_date": "2026-01-28",
    "generated_at": "2026-01-28T17:05:00Z"
  }
}
```

**Status Resolution Logic**:
1. If row exists in `job_date_results` → return stored status (latest run)
2. If no row exists AND date < cutover → `n/a`
3. If no row exists AND date ≥ cutover → `missed`
4. If row has `running` status for >30 minutes → treat as `failed` (stale job)

**Notes**:
- Queries `job_date_results` only (summary table) - fast O(1) per date
- **Read-only**: Stale cleanup performed by authenticated job handlers only

---

### `GET /api/v1/jobs/runs` (Run History)

**Purpose**: Query all job runs for a specific date/type - supports viewing historical runs.

**Authentication**: Public (read-only)

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | No | Date in YYYY-MM-DD format |
| `type` | string | No | Report type: `pre-market`, `intraday`, `end-of-day`, `weekly` |
| `limit` | number | No | Max runs to return (default 50, max 200) |

**Response**:
```json
{
  "success": true,
  "data": {
    "runs": [
      {
        "run_id": "2026-01-28_pre-market_1706410000000",
        "status": "success",
        "started_at": "2026-01-28T14:33:00Z",
        "executed_at": "2026-01-28T14:35:22Z",
        "trigger_source": "manual"
      },
      {
        "run_id": "2026-01-28_pre-market_1706400000000",
        "status": "failed",
        "started_at": "2026-01-28T13:30:00Z",
        "executed_at": "2026-01-28T13:32:15Z",
        "trigger_source": "github_actions",
        "errors": ["Rate limit exceeded"]
      }
    ],
    "count": 2,
    "limit": 50
  }
}
```

**Use Cases**:
- Debugging: "Why did the 8:30 AM run fail?"
- Testing: "I want to see results from my test run, not the scheduled one"
- Audit: "Show me all runs for this date"

---

### `DELETE /api/v1/jobs/runs/:runId` (Delete Run)

**Purpose**: Delete a run and its associated stage log + snapshot rows (admin/debug).

**Authentication**: Required (`X-API-Key`)

### Report Page URL Pattern (Updated)

Report pages now accept optional `run_id` parameter:

```
/pre-market-briefing?date=YYYY-MM-DD              # Load latest run (default)
/pre-market-briefing?date=YYYY-MM-DD&run_id=...   # Load specific run

/intraday-check?date=YYYY-MM-DD
/intraday-check?date=YYYY-MM-DD&run_id=...

/end-of-day-summary?date=YYYY-MM-DD
/end-of-day-summary?date=YYYY-MM-DD&run_id=...
```

**Behavior**:
- No `run_id` → load latest run's data from `scheduled_job_results` (latest `created_at`)
- With `run_id` → load that specific run's snapshot (if exists)
- Invalid `run_id` → fall back to date-based behavior

## Trading Day Calculation

### Module: `src/modules/trading-calendar.ts`

```typescript
// NYSE market holidays for 2025, 2026, 2027 (update annually each December)
const NYSE_HOLIDAYS_2025 = ['2025-01-01', '2025-01-20', ...]; // Full list in source
const NYSE_HOLIDAYS_2026 = ['2026-01-01', '2026-01-19', ...]; // Full list in source
const NYSE_HOLIDAYS_2027 = ['2027-01-01', '2027-01-18', ...]; // Full list in source

const NYSE_HOLIDAYS = new Set([...NYSE_HOLIDAYS_2025, ...NYSE_HOLIDAYS_2026, ...NYSE_HOLIDAYS_2027]);

export function isTradingDay(date: string): boolean {
  const d = new Date(date + 'T12:00:00-05:00'); // Noon ET to avoid DST issues
  const dayOfWeek = d.getDay();

  // Weekend check (0 = Sunday, 6 = Saturday)
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  // Holiday check
  if (NYSE_HOLIDAYS.has(date)) return false;

  return true;
}

export function getLastNTradingDays(n: number, fromDate?: string): string[] {
  const result: string[] = [];

  // Helper to format date as YYYY-MM-DD in ET
  const formatDateET = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Parse fromDate or use current date in ET
  let current: Date;
  if (fromDate) {
    current = new Date(fromDate + 'T12:00:00-05:00');
  } else {
    current = getCurrentTimeET();
  }

  // Iterate backwards until we have N trading days
  while (result.length < n) {
    const dateStr = formatDateET(current);
    if (isTradingDay(dateStr)) {
      result.push(dateStr);
    }
    current.setDate(current.getDate() - 1);
  }

  return result;
}

// Uses Intl.DateTimeFormat().formatToParts() to avoid fragile locale string parsing
export function getCurrentTimeET(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  return new Date(
    parseInt(get('year'), 10),
    parseInt(get('month'), 10) - 1,
    parseInt(get('day'), 10),
    parseInt(get('hour'), 10),
    parseInt(get('minute'), 10),
    parseInt(get('second'), 10)
  );
}
```

**Maintenance**: Update `NYSE_HOLIDAYS_YYYY` arrays each December for the upcoming year. 2025-2027 holidays are pre-populated. Consider fetching from external calendar API for automation.

## Frontend Changes

### `public/js/nav.js`

1. **Remove**: "Today" and "Yesterday" top-level items
2. **Add**: "Reports" expandable section with date sub-items
3. **Fetch**: Call `/api/v1/reports/status?days=3` on page load
4. **Poll**: Refresh status on a dynamic interval (60s during market hours, 5min otherwise), computed in **ET** via `Intl.DateTimeFormat().formatToParts()`
5. **Render**: Date items with weekday suffix, status icons per report

### Status Icon Rendering
```javascript
const STATUS_ICONS = {
  success: '✅',
  partial: '⚠️',
  failed: '❌',
  running: '🔄',
  missed: '⚪',
  'n/a': '➖'
};

function renderStatusIcon(status, errors) {
  const icon = STATUS_ICONS[status] || '➖';
  const tooltip = status === 'n/a'
    ? 'No data (pre-cutover)'
    : status === 'missed'
      ? 'Job never started (post-cutover)'
      : (errors?.length ? errors.join(', ') : '');
  return `<span class="status-icon" title="${tooltip}">${icon}</span>`;
}
```

### Navigation Behavior
| Element | Click Action |
|---------|--------------|
| Reports | Toggle expand/collapse |
| Date (e.g., Jan 28 Wed) | Toggle expand/collapse |
| Pre-Market | Navigate to `/pre-market-briefing?date=YYYY-MM-DD` |
| Intraday | Navigate to `/intraday-check?date=YYYY-MM-DD` |
| End-of-Day | Navigate to `/end-of-day-summary?date=YYYY-MM-DD` |
| Weekly | Navigate to `/weekly-review` |

### Default State
- "Reports" section expanded on load
- Most recent trading day auto-expanded
- Other dates collapsed
- Collapsed state persisted in `localStorage`

### Error Handling (API Failure)
```javascript
async function fetchNavStatus() {
  try {
    const res = await fetch('/api/v1/reports/status?days=3');
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch (e) {
    console.warn('Nav status fetch failed, using fallback', e);
    // Fallback: no status data available
    return { success: false, data: {}, fallback: true };
  }
}
```

### Mobile Responsiveness
- Expandable sections work via tap (same as click)
- Touch targets minimum 44x44px
- Collapsed by default on screens < 768px width
- Swipe gestures not required (tap to expand/collapse)

## Data Flow Diagram (v2.3 - Multi-Run)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      JOB EXECUTION FLOW (Multi-Run)                     │
└─────────────────────────────────────────────────────────────────────────┘

  GitHub Actions / Manual                         D1 Database
  ┌─────────────────┐                    ┌────────────────────────────────┐
  │  Trigger Job    │                    │                                │
  │  (pre-market)   │                    │  job_run_results (HISTORY)     │
  └────────┬────────┘                    │  ├─ run_id (PK)                │
           │                             │  ├─ scheduled_date             │
           ▼                             │  ├─ status                     │
  ┌─────────────────┐                    │  └─ started_at, executed_at    │
  │  Generate       │                    │                                │
  │  run_id         │                    │  job_date_results (SUMMARY)    │
  │  (unique ID)    │                    │  ├─ (date, type) PK            │
  └────────┬────────┘                    │  ├─ status (latest)            │
           │                             │  └─ latest_run_id ─────────────┼──┐
           ▼                             │                                │  │
  ┌─────────────────┐    INSERT          │  job_stage_log (TIMELINE)      │  │
  │  Job Starts     │───────────────────▶│  ├─ run_id (FK) ◀──────────────┼──┘
  │  startJobRun()  │    run_results     │  ├─ stage                      │
  │                 │    + date_results  │  └─ started_at, ended_at       │
  └────────┬────────┘    + stage_log     └────────────────────────────────┘
           │
           ▼
  ┌─────────────────┐
  │  AI Analysis    │    updateRunStage()
  │  Data Fetch     │───────────────────▶ UPDATE stage in all tables
  │  (stages)       │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐    completeJobRun()
  │  Job Completes  │───────────────────▶ UPDATE run_results + date_results
  │  success/fail   │                     (date_results only if still latest)
  └─────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         NAVIGATION FETCH FLOW                           │
└─────────────────────────────────────────────────────────────────────────┘

  Browser                    Worker                         D1
  ┌──────────┐          ┌─────────────┐          ┌──────────────────────┐
  │  nav.js  │──GET────▶│ /api/v1/    │──query──▶│  job_date_results    │
  │          │          │ reports/    │          │  (summary table)     │
  │          │          │ status      │          │  ONE row per date    │
  │          │◀──JSON───│             │◀─────────│  Fast O(n) lookup    │
  │  Render  │          └─────────────┘          └──────────────────────┘
  │  Icons   │
  └──────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         RUN HISTORY FETCH FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

  Browser/Debug              Worker                         D1
  ┌──────────┐          ┌─────────────┐          ┌──────────────────────┐
  │  Report  │──GET────▶│ /api/v1/    │──query──▶│  job_run_results     │
  │  Page    │          │ reports/    │          │  (history table)     │
  │          │          │ runs?date=  │          │  ALL runs for date   │
  │          │◀──JSON───│ &type=      │◀─────────│  Ordered by time     │
  │  Show    │          └─────────────┘          └──────────────────────┘
  │  History │
  └──────────┘
           │
           │  User selects specific run
           ▼
  ┌──────────┐          ┌─────────────┐          ┌──────────────────────┐
  │  Report  │──GET────▶│ /report     │──query──▶│ scheduled_job_results│
  │  ?run_id │          │ ?run_id=    │          │ + job_run_results    │
  │          │◀─────────│             │◀─────────│ + job_stage_log      │
  │  Display │          └─────────────┘          └──────────────────────┘
  │  Run     │
  └──────────┘
```

## Implementation Tasks

### Phase 1: Database & Core (v2.2 - Complete ✅)
- [x] Add `job_date_results` + `job_stage_log` tables to `schema.sql`
- [x] Create `src/modules/trading-calendar.ts` with NYSE holidays
- [x] Create `writeJobDateResult()` in `src/modules/d1-job-storage.ts`
- [x] Create stage log helpers (`startJobStage`, `endJobStage`)
- [x] Add writes to job executors (pre-market, intraday)
- [x] Fix `INSERT...ON CONFLICT DO UPDATE` to preserve timestamps
- [x] Fix `getCurrentTimeET()` to use `formatToParts()`
- [x] Fix nav.js polling to use ET timezone
- [x] Move stale cleanup to authenticated job handlers

### Phase 2: Multi-Run Support (v2.3 - Complete ✅)

**Database Migration:**
- [x] Schema deployed with 4-table architecture
- [x] `job_date_results` with `latest_run_id` column
- [x] `job_run_results` table for run history
- [x] `job_stage_log` with `run_id` foreign key
- [x] `scheduled_job_results` with `run_id` indexing

**Backend Implementation:**
- [x] Implement `generateRunId()`, `startJobRun()`, `completeJobRun()`
- [x] Update `startJobStage()` / `endJobStage()` to use `run_id`
- [x] Update `markStaleJobsAsFailed()` for multi-run
- [x] Update job executors: pre-market, intraday, weekly, end-of-day
- [x] Update `writeD1JobResult()` to pass `run_id`
- [x] Add `readD1ReportSnapshotByRunId()` for run_id lookups
- [x] Implement partial status logic (symbols failed/diverged)

**API Endpoints:**
- [x] `GET /api/v1/jobs/runs` - Run history with filtering
- [x] `DELETE /api/v1/jobs/runs/:runId` - Delete specific run
- [x] `/api/v1/reports/status` includes `run_id` in response

**Frontend:**
- [x] Report pages accept `?run_id=` parameter (pre-market, intraday, end-of-day)
- [x] Dashboard shows `run_id` with delete capability
- [ ] Run selector dropdown (deferred - manual URL access sufficient)

### Phase 3: API (v2.2 - Complete ✅)
- [x] Create `GET /api/v1/reports/status` endpoint
- [x] Implement trading day calculation
- [x] Implement status resolution logic with cutover + missed
- [x] Set `Cache-Control` TTL (60s market hours, 5min otherwise)
- [x] Read-only public endpoint (no writes)

### Phase 4: Frontend (v2.2 - Complete ✅)
- [x] Update `public/js/nav.js` with hierarchical structure
- [x] Add status fetch on page load
- [x] Add dynamic polling (re-evaluate interval each poll)
- [x] Implement expand/collapse with localStorage persistence
- [x] Add status icons with tooltip rendering
- [x] Update CSS for nested nav items
- [x] Add fallback UI for API errors

### Phase 5: Frontend Multi-Run (v2.3 - Partial)
- [x] Report pages support `?run_id=` parameter for direct access
- [x] Dashboard shows run history with run_id display
- [ ] Run selector dropdown (deferred - low priority)
- [ ] Run comparison view (future enhancement)

### Phase 6: Testing (Ongoing)
- [x] Core multi-run functionality verified
- [x] API endpoints tested via curl
- [ ] Formal test scripts (low priority)

## Schema Addition (v2.3 - Four Tables)

**Approach**: Migration required from v2.2. New tables created, existing `scheduled_job_results` modified.

**Table Purposes**:
| Table | Purpose | Cardinality | Change in v2.3 |
|-------|---------|-------------|----------------|
| `job_date_results` | Nav status lookup (latest) | 1 row per date/type | Add `latest_run_id` |
| `job_run_results` | Run metadata history | N rows per date/type | **NEW** |
| `job_stage_log` | Stage timeline per run | N rows per run | Add `run_id` FK |
| `scheduled_job_results` | Report content | N rows per date/type | **Change PK to `run_id`** |

**Existing table unchanged**:
- `job_executions` - fine-grain event log (no changes needed)

**Behavior after deployment**:
- Pre-cutover dates with no record show `n/a` (non-reproducible)
- Post-cutover dates with no record show `missed` (job never started)
- Each job run creates new rows in `job_run_results` AND `scheduled_job_results`
- `job_date_results` always reflects latest run (fast nav lookup)
- Report pages can load any historical run's **full content** via `?run_id=`

---

## Schema Transition: v2.2 → v2.3

**Approach**: Drop old tables, create new schema compatible with existing code. Fresh start, no data migration.

### Schema Transition SQL

```sql
-- ============================================================================
-- Schema Transition: v2.2 → v2.3 (Fresh Start)
-- Drop old tables, create new schema compatible with existing code
-- ============================================================================

-- Step 1: Drop old tables
DROP TABLE IF EXISTS job_stage_log;
DROP TABLE IF EXISTS job_date_results;
DROP TABLE IF EXISTS job_run_results;
DROP TABLE IF EXISTS scheduled_job_results;

-- Step 2: Create v2.3 schema (compatible with existing code)

-- Navigation summary (latest status per date/type)
CREATE TABLE job_date_results (
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  status TEXT NOT NULL CHECK(status IN ('success','partial','failed','running')),
  current_stage TEXT,
  errors_json TEXT,
  warnings_json TEXT,
  executed_at TEXT,
  started_at TEXT,
  trigger_source TEXT,
  latest_run_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (scheduled_date, report_type)
);

CREATE INDEX idx_job_date_results_date ON job_date_results(scheduled_date DESC);
CREATE INDEX idx_job_date_results_status ON job_date_results(status) WHERE status = 'running';

-- Run history (NEW - multiple runs per date/type)
CREATE TABLE job_run_results (
  run_id TEXT PRIMARY KEY,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  status TEXT NOT NULL CHECK(status IN ('success','partial','failed','running')),
  current_stage TEXT,
  errors_json TEXT,
  warnings_json TEXT,
  started_at TEXT NOT NULL,
  executed_at TEXT,
  trigger_source TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_job_run_results_lookup ON job_run_results(scheduled_date, report_type, created_at DESC);
CREATE INDEX idx_job_run_results_status ON job_run_results(status) WHERE status = 'running';

-- Stage timeline (run_id nullable for backward compatibility)
CREATE TABLE job_stage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  stage TEXT NOT NULL CHECK(stage IN ('init','data_fetch','ai_analysis','storage','finalize')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_job_stage_log_run ON job_stage_log(run_id, stage);
CREATE INDEX idx_job_stage_log_lookup ON job_stage_log(scheduled_date, report_type, stage);

-- Report content (PK unchanged, run_id added as optional)
CREATE TABLE scheduled_job_results (
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  report_content TEXT NOT NULL,
  metadata TEXT,
  trigger_source TEXT,
  run_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (scheduled_date, report_type)
);

CREATE INDEX idx_scheduled_job_results_lookup ON scheduled_job_results(scheduled_date, report_type, created_at DESC);
CREATE INDEX idx_scheduled_job_results_run ON scheduled_job_results(run_id);
```

### Verify Schema

```bash
wrangler d1 execute PREDICT_JOBS_DB --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
# Expected: job_date_results, job_run_results, job_stage_log, scheduled_job_results
```

### Post-Transition Behavior

- All historical data cleared (fresh start)
- Existing code works unchanged (`run_id` columns nullable)
- Navigation shows `n/a` for pre-cutover dates, `missed` for post-cutover
- New job runs populate tables normally

## Rollback Plan

### Level 1: Frontend Only (Quick)
If nav rendering issues:
1. Revert `public/js/nav.js` to previous version
2. `job_date_results` table and API remain (unused but harmless)
3. Deploy frontend-only: `npm run deploy:frontend:only`

### Level 2: API Disable
If API causes errors:
1. Add feature flag check in `report-routes.ts`:
   ```typescript
   if (!env.FEATURE_NAV_STATUS_API) {
     return new Response(JSON.stringify({ success: false, disabled: true }), { status: 503 });
   }
   ```
2. Set `wrangler secret put FEATURE_NAV_STATUS_API` to `false`

### Level 3: Full Rollback
If database issues:
1. Revert nav.js (Level 1)
2. Remove `writeJobDateResult()` calls from job executors
3. Table can remain (no queries hitting it)

### Recovery Verification
After rollback:
```bash
# Verify nav loads without errors
curl -s https://tft-trading-system.yanggf.workers.dev/ | grep -q "Reports" && echo "Nav OK"

# Verify reports still load
curl -s "https://tft-trading-system.yanggf.workers.dev/pre-market-briefing?date=2026-01-27"
```

## Resolved Decisions

1. **Holiday Calendar Maintenance**: Manual update each December for next year. 2025, 2026, 2027 holidays pre-populated. Consider NYSE API integration as future enhancement.
2. **Weekly Report Date**: Use Friday of that week (end-of-week) as the `scheduled_date` for weekly reports. Weekly uses `/weekly-review` URL (no date param in nav).
