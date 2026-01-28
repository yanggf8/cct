# Navigation Redesign V2: Date-Based Report Hierarchy

**Date**: 2026-01-28
**Status**: Implemented ✅
**Version**: 2.2

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

## New D1 Entities: `job_date_results` + `job_stage_log`

### Purpose
Materialized summary table optimized for navigation status display. Authoritative source for report status even when `scheduled_job_results` is missing (job failed before snapshot).

### Approach
**Fresh start** - no migration, no backfill. Add tables to `schema.sql` and let them populate naturally as jobs run. Historical dates before cutover display as `n/a`. Post-cutover dates with no row display as `missed` (job never started).

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

### Schema (Summary + Stage Log)
```sql
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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (scheduled_date, report_type)
);

CREATE INDEX idx_job_date_results_date ON job_date_results(scheduled_date DESC);
CREATE INDEX idx_job_date_results_status ON job_date_results(status) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS job_stage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  stage TEXT NOT NULL CHECK(stage IN ('init','data_fetch','ai_analysis','storage','finalize')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (scheduled_date, report_type) REFERENCES job_date_results(scheduled_date, report_type)
);

CREATE INDEX idx_job_stage_log_lookup ON job_stage_log(scheduled_date, report_type, stage);
```

**Note**: Only `success`, `partial`, `failed`, `running` are stored. `n/a` and `missed` are computed from cutover + presence/absence of a row.

### Write Semantics
- **Single writer**: Create new `writeJobDateResult()` in `src/modules/d1-job-storage.ts`
- **Upsert pattern**: `INSERT ... ON CONFLICT DO UPDATE` to preserve `created_at` and avoid wiping `started_at`
- **Lifecycle writes**: Write on job start (`running`) and job completion (`success`/`partial`/`failed`)
- **Stage log**: Append on stage start, update ended_at on stage completion

```typescript
// New function in src/modules/d1-job-storage.ts
export async function writeJobDateResult(
  db: D1Database,
  params: {
    scheduledDate: string;
    reportType: 'pre-market' | 'intraday' | 'end-of-day' | 'weekly';
    status: 'running' | 'success' | 'partial' | 'failed';
    currentStage?: 'init' | 'data_fetch' | 'ai_analysis' | 'storage' | 'finalize';
    errors?: string[];
    warnings?: string[];
    triggerSource: 'cron' | 'manual' | 'github_actions';
  }
): Promise<void> {
  const now = new Date().toISOString();

  if (params.status === 'running') {
    // Job starting - insert with running status (preserve created_at on updates)
    await db.prepare(`
      INSERT INTO job_date_results
      (scheduled_date, report_type, status, started_at, trigger_source, current_stage, updated_at, created_at)
      VALUES (?, ?, 'running', ?, ?, ?, ?, ?)
      ON CONFLICT(scheduled_date, report_type) DO UPDATE SET
        status = excluded.status,
        started_at = excluded.started_at,
        trigger_source = excluded.trigger_source,
        current_stage = excluded.current_stage,
        updated_at = excluded.updated_at
    `).bind(
      params.scheduledDate,
      params.reportType,
      now,
      params.triggerSource,
      params.currentStage ?? 'init',
      now,
      now
    ).run();
  } else {
    // Job completed - update with final status (preserve started_at and created_at)
    await db.prepare(`
      INSERT INTO job_date_results
      (scheduled_date, report_type, status, errors_json, warnings_json, executed_at, trigger_source, current_stage, updated_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(scheduled_date, report_type) DO UPDATE SET
        status = excluded.status,
        errors_json = excluded.errors_json,
        warnings_json = excluded.warnings_json,
        executed_at = excluded.executed_at,
        trigger_source = COALESCE(job_date_results.trigger_source, excluded.trigger_source),
        current_stage = excluded.current_stage,
        updated_at = excluded.updated_at
    `).bind(
      params.scheduledDate,
      params.reportType,
      params.status,
      params.errors ? JSON.stringify(params.errors) : null,
      params.warnings ? JSON.stringify(params.warnings) : null,
      now,
      params.triggerSource,
      params.currentStage ?? 'finalize',
      now,
      now
    ).run();
  }
}
```

```typescript
// Stage log helpers
export async function startJobStage(
  db: D1Database,
  params: { scheduledDate: string; reportType: 'pre-market' | 'intraday' | 'end-of-day' | 'weekly'; stage: 'init' | 'data_fetch' | 'ai_analysis' | 'storage' | 'finalize' }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO job_stage_log (scheduled_date, report_type, stage, started_at)
    VALUES (?, ?, ?, ?)
  `).bind(params.scheduledDate, params.reportType, params.stage, now).run();
}

export async function endJobStage(
  db: D1Database,
  params: { scheduledDate: string; reportType: 'pre-market' | 'intraday' | 'end-of-day' | 'weekly'; stage: 'init' | 'data_fetch' | 'ai_analysis' | 'storage' | 'finalize' }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE job_stage_log
    SET ended_at = ?
    WHERE scheduled_date = ? AND report_type = ? AND stage = ? AND ended_at IS NULL
  `).bind(now, params.scheduledDate, params.reportType, params.stage).run();
}
```

## New API Endpoint

### `GET /api/v1/reports/status`

**Authentication**: None (public endpoint - status information is not sensitive)

**Caching**:
- HTTP caching via `Cache-Control` with 60-second TTL during market hours
- 5-minute TTL outside market hours

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
      "pre-market": { "status": "success", "executed_at": "2026-01-28T13:33:14Z" },
      "intraday": { "status": "running", "started_at": "2026-01-28T17:00:05Z" },
      "end-of-day": { "status": "missed" }
    },
    "2026-01-27": {
      "label": "Jan 27 (Tue)",
      "pre-market": { "status": "success", "executed_at": "2026-01-27T13:31:00Z" },
      "intraday": { "status": "success", "executed_at": "2026-01-27T17:02:00Z" },
      "end-of-day": { "status": "failed", "current_stage": "ai_analysis", "errors": ["Gemma model timeout after 30s"], "executed_at": "2026-01-27T21:06:00Z" }
    },
    "2026-01-26": {
      "label": "Jan 26 (Mon)",
      "pre-market": { "status": "n/a" },
      "intraday": { "status": "n/a" },
      "end-of-day": { "status": "n/a" }
    }
  },
	  "meta": {
	    "timezone": "America/New_York",
	    "cutover_date": "2026-01-28",
	    "generated_at": "2026-01-28T17:05:00Z"
	  }
	}
```

**Error Response** (API failure):
```json
{
  "success": false,
  "error": "Database unavailable",
  "fallback": true,
  "data": {}
}
```

**Status Resolution Logic**:
1. If row exists in `job_date_results` → return stored status
2. If no row exists AND date < cutover → `n/a`
3. If no row exists AND date ≥ cutover → `missed`
4. If row has `running` status for >30 minutes → treat as `failed` (stale job)

**Notes**:
- The API returns only trading days from the trading calendar. Weekends and holidays never appear.
- **Read-only endpoint**: Stale job cleanup is performed by authenticated job handlers (`/api/v1/jobs/pre-market`, `/api/v1/jobs/intraday`), not this public endpoint. This prevents write amplification and abuse from unauthenticated requests.

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

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           JOB EXECUTION FLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

  GitHub Actions / Cron                    D1 Database
  ┌─────────────────┐                 ┌─────────────────────┐
  │  Trigger Job    │                 │  job_date_results   │
  │  (pre-market)   │                 │                     │
  └────────┬────────┘                 │  scheduled_date     │
           │                          │  report_type        │
           ▼                          │  status             │
  ┌─────────────────┐    INSERT       │  errors_json        │
  │  Job Starts     │───(running)────▶│  started_at         │
  │                 │                 │                     │
  └────────┬────────┘                 └──────────┬──────────┘
           │                                     │
           ▼                                     │
  ┌─────────────────┐                           │
  │  AI Analysis    │                           │
  │  Data Fetch     │                           │
  └────────┬────────┘                           │
           │                                     │
           ▼                                     │
  ┌─────────────────┐    UPDATE                 │
  │  Job Completes  │──(success/fail)──────────▶│
  │                 │                           │
  └─────────────────┘                           │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         NAVIGATION FETCH FLOW                           │
└─────────────────────────────────────────────────────────────────────────┘

  Browser                    Worker                    D1 + HTTP Cache
  ┌──────────┐          ┌─────────────┐          ┌─────────────────┐
  │  nav.js  │──GET────▶│ /api/v1/    │──check──▶│  HTTP Cache     │
  │          │          │ reports/    │          │  Cache-Control  │
  │          │          │ status      │          └────────┬────────┘
  │          │          │             │                   │
  │          │          │             │◀──cached──────────┘
  │          │          │             │
  │          │          │             │──miss──▶┌─────────────────┐
  │          │          │             │         │ job_date_results│
  │          │          │             │◀────────│ (D1 query)      │
  │          │◀──JSON───│             │         └─────────────────┘
  │          │          │             │
  │  Render  │          │  Return     │
  │  Icons   │          │  status /   │
  │          │          │  n/a /      │
  │          │          │  missed     │
  └──────────┘          └─────────────┘
```

## Implementation Tasks

### Phase 1: Database & Core
- [ ] Add `job_date_results` + `job_stage_log` tables to `schema.sql` (no migration, fresh start)
- [ ] Create `src/modules/trading-calendar.ts` with NYSE holidays
- [ ] Create `writeJobDateResult()` in `src/modules/d1-job-storage.ts`
- [ ] Create stage log helpers (`startJobStage`, `endJobStage`)
- [ ] Add writes to job executors (pre-market, intraday, end-of-day jobs)

### Phase 2: API
- [ ] Create `GET /api/v1/reports/status` endpoint in `src/routes/report-routes.ts`
- [ ] Implement trading day calculation using `trading-calendar.ts`
- [ ] Implement status resolution logic with cutover + missed
- [ ] Set `Cache-Control` TTL (60s market hours, 5min otherwise)
- [ ] Add to API documentation (`/api/v1`)

### Phase 3: Frontend
- [ ] Update `public/js/nav.js` with new hierarchical structure
- [ ] Add status fetch on page load
- [ ] Add polling during market hours (60s interval)
- [ ] Implement expand/collapse with localStorage persistence
- [ ] Add status icons with tooltip rendering
- [ ] Update `public/css/style.css` for nested nav items
- [ ] Add mobile responsive styles
- [ ] Add fallback UI for API errors

### Phase 4: Testing
- [ ] Update `tests/integration/frontend/test-routing-regressions.sh`
- [ ] Add `tests/feature/test-nav-status-api.sh`
- [ ] Add `tests/feature/test-trading-calendar.sh`
- [ ] Verify status icons render correctly across browsers
- [ ] Test mobile expand/collapse behavior

## Schema Addition (No Migration)

**Approach**: Fresh start - no migration, no backfill. Table starts empty and populates as jobs run.

- Existing `scheduled_job_results` remains unchanged (report content storage)
- Existing `job_executions` remains unchanged (fine-grain event log)
- `job_date_results` is new summary table optimized for nav status queries
- No breaking changes to existing report URLs
- Job executors need updates to call `writeJobDateResult()` on start and completion

**Behavior after deployment**:
- Pre-cutover dates with no record show `n/a` (non-reproducible, not a failure)
- Post-cutover dates with no record show `missed` (job never started)
- As new jobs execute, statuses populate naturally (success/partial/failed/running)
- Full status visibility achieved within 1-2 trading days

### Add to `schema.sql`

```sql
-- Navigation status summary table (fresh start, no historical data)
CREATE TABLE IF NOT EXISTS job_date_results (
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  status TEXT NOT NULL CHECK(status IN ('success','partial','failed','running')),
  current_stage TEXT,
  errors_json TEXT,
  warnings_json TEXT,
  executed_at TEXT,
  started_at TEXT,
  trigger_source TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (scheduled_date, report_type)
);

CREATE INDEX IF NOT EXISTS idx_job_date_results_date ON job_date_results(scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_date_results_status ON job_date_results(status) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS job_stage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  stage TEXT NOT NULL CHECK(stage IN ('init','data_fetch','ai_analysis','storage','finalize')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (scheduled_date, report_type) REFERENCES job_date_results(scheduled_date, report_type)
);

CREATE INDEX IF NOT EXISTS idx_job_stage_log_lookup ON job_stage_log(scheduled_date, report_type, stage);
```

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
