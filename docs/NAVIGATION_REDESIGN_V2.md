# Navigation Redesign V2: Date-Based Report Hierarchy

**Date**: 2026-01-27
**Status**: Approved for Implementation
**Version**: 2.1

## Overview

Replace the "Today/Yesterday" navigation pattern with a date-based hierarchy showing the last 3 trading days, each containing Pre-Market, Intraday, and End-of-Day reports. Weekly remains a standalone top-level item.

## Design Principles

1. **Market Timezone Authority**: All dates and schedule times are in **US Eastern Time (ET)** regardless of user's configured display timezone
2. **Trading Days Only**: Navigation shows only NYSE trading days (excludes weekends and market holidays)
3. **Status Transparency**: Users can see job status at a glance, including failures and in-progress jobs

## Navigation Structure

```
├── 📊 Reports              ← expandable (no navigation)
│   ├── Jan 27 (Mon)        ← expandable, auto-expanded if most recent
│   │   ├── Pre-Market  ✅
│   │   ├── Intraday    ⏳
│   │   └── End-of-Day  ⏳
│   ├── Jan 24 (Fri)        ← expandable
│   │   ├── Pre-Market  ✅
│   │   ├── Intraday    ✅
│   │   └── End-of-Day  ❌
│   └── Jan 23 (Thu)        ← expandable
│       ├── Pre-Market  ✅
│       ├── Intraday    ✅
│       └── End-of-Day  ✅
├── 📅 Weekly               ← direct link to /weekly-review
```

### Status Indicators
| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | `success` | Report generated successfully |
| ⚠️ | `partial` | Report generated with warnings/fallbacks |
| ❌ | `failed` | Job failed, error details available (hover for details) |
| 🔄 | `running` | Job currently executing |
| ⏳ | `pending` | Not yet scheduled or awaiting execution |
| ➖ | `missing` | Job should have run but no record exists (treated as failed) |

### Error Visibility
- **Hover/Tooltip**: Failed jobs show error summary on hover
- **Click**: Navigates to report page which displays detailed error information
- **Dashboard**: System Status page shows all job failures with full error logs

## URL Pattern

```
/pre-market-briefing?date=YYYY-MM-DD
/intraday-check?date=YYYY-MM-DD
/end-of-day-summary?date=YYYY-MM-DD
/weekly-review
```

## New D1 Entity: `job_date_results`

### Purpose
Materialized summary table optimized for navigation status display. Authoritative source for report status even when `scheduled_job_results` is missing (job failed before snapshot).

### Schema
```sql
CREATE TABLE IF NOT EXISTS job_date_results (
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  status TEXT NOT NULL CHECK(status IN ('success','partial','failed','running')),
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
```

**Note**: `missing` status is computed at query time, not stored in the database.

### Write Semantics
- **Single writer**: Create new `writeJobDateResult()` in `src/modules/d1-job-storage.ts`
- **Upsert pattern**: `INSERT OR REPLACE` for idempotent reruns
- **Lifecycle writes**: Write on job start (`running`) and job completion (`success`/`partial`/`failed`)

```typescript
// New function in src/modules/d1-job-storage.ts
export async function writeJobDateResult(
  db: D1Database,
  params: {
    scheduledDate: string;
    reportType: 'pre-market' | 'intraday' | 'end-of-day' | 'weekly';
    status: 'running' | 'success' | 'partial' | 'failed';
    errors?: string[];
    warnings?: string[];
    triggerSource: 'cron' | 'manual' | 'github_actions';
  }
): Promise<void> {
  const now = new Date().toISOString();

  if (params.status === 'running') {
    // Job starting - insert with running status
    await db.prepare(`
      INSERT OR REPLACE INTO job_date_results
      (scheduled_date, report_type, status, started_at, trigger_source, updated_at)
      VALUES (?, ?, 'running', ?, ?, ?)
    `).bind(
      params.scheduledDate,
      params.reportType,
      now,
      params.triggerSource,
      now
    ).run();
  } else {
    // Job completed - update with final status
    await db.prepare(`
      INSERT OR REPLACE INTO job_date_results
      (scheduled_date, report_type, status, errors_json, warnings_json, executed_at, trigger_source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      params.scheduledDate,
      params.reportType,
      params.status,
      params.errors ? JSON.stringify(params.errors) : null,
      params.warnings ? JSON.stringify(params.warnings) : null,
      now,
      params.triggerSource,
      now
    ).run();
  }
}
```

## New API Endpoint

### `GET /api/v1/reports/status`

**Authentication**: None (public endpoint - status information is not sensitive)

**Caching**:
- DO cache with 60-second TTL during market hours
- 5-minute TTL outside market hours
- Cache key: `nav_status_${days}`

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | number | 3 | Number of trading days to return (max 10) |

**Response**:
```json
{
  "success": true,
  "data": {
    "2026-01-27": {
      "label": "Jan 27 (Mon)",
      "pre-market": { "status": "success", "executed_at": "2026-01-27T12:33:14Z" },
      "intraday": { "status": "running", "started_at": "2026-01-27T17:00:05Z" },
      "end-of-day": { "status": "pending" }
    },
    "2026-01-24": {
      "label": "Jan 24 (Fri)",
      "pre-market": { "status": "success", "executed_at": "2026-01-24T12:31:00Z" },
      "intraday": { "status": "success", "executed_at": "2026-01-24T16:02:00Z" },
      "end-of-day": { "status": "failed", "errors": ["AI model timeout"], "executed_at": "2026-01-24T20:06:00Z" }
    },
    "2026-01-23": {
      "label": "Jan 23 (Thu)",
      "pre-market": { "status": "success", "executed_at": "2026-01-23T12:30:00Z" },
      "intraday": { "status": "success", "executed_at": "2026-01-23T16:01:00Z" },
      "end-of-day": { "status": "success", "executed_at": "2026-01-23T20:05:00Z" }
    }
  },
  "meta": {
    "timezone": "America/New_York",
    "generated_at": "2026-01-27T17:05:00Z"
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
2. If row missing AND current time (ET) < scheduled time → `pending`
3. If row missing AND current time (ET) > scheduled time + 30min grace → `missing`
4. If row has `running` status for >30 minutes → treat as `failed` (stale)

**Schedule Times (US Eastern Time)**:
| Report Type | Scheduled Time | Grace Period |
|-------------|----------------|--------------|
| pre-market | 8:30 AM ET | 30 min |
| intraday | 12:00 PM ET | 30 min |
| end-of-day | 4:05 PM ET | 30 min |

**Note**: Schedule times are fixed in ET. The 30-minute grace period prevents false `missing` status if jobs run slightly late.

## Trading Day Calculation

### Module: `src/modules/trading-calendar.ts`

```typescript
// NYSE market holidays for 2026 (update annually)
const NYSE_HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
];

export function isTradingDay(date: string): boolean {
  const d = new Date(date + 'T12:00:00-05:00'); // Noon ET
  const dayOfWeek = d.getDay();

  // Weekend check
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  // Holiday check
  if (NYSE_HOLIDAYS_2026.includes(date)) return false;

  return true;
}

export function getLastNTradingDays(n: number, fromDate?: string): string[] {
  const result: string[] = [];
  const current = fromDate ? new Date(fromDate) : new Date();

  while (result.length < n) {
    const dateStr = current.toISOString().split('T')[0];
    if (isTradingDay(dateStr)) {
      result.push(dateStr);
    }
    current.setDate(current.getDate() - 1);
  }

  return result;
}
```

**Maintenance**: Update `NYSE_HOLIDAYS_YYYY` array each December for the upcoming year. Consider fetching from external calendar API for automation.

## Frontend Changes

### `public/js/nav.js`

1. **Remove**: "Today" and "Yesterday" top-level items
2. **Add**: "Reports" expandable section with date sub-items
3. **Fetch**: Call `/api/v1/reports/status?days=3` on page load
4. **Poll**: Refresh status every 60 seconds during market hours (9:30 AM - 4:00 PM ET)
5. **Render**: Date items with weekday suffix, status icons per report

### Status Icon Rendering
```javascript
const STATUS_ICONS = {
  success: '✅',
  partial: '⚠️',
  failed: '❌',
  running: '🔄',
  pending: '⏳',
  missing: '➖'
};

function renderStatusIcon(status, errors) {
  const icon = STATUS_ICONS[status] || '❓';
  const tooltip = errors?.length ? errors.join(', ') : '';
  return `<span class="status-icon" title="${tooltip}">${icon}</span>`;
}
```

### Navigation Behavior
| Element | Click Action |
|---------|--------------|
| Reports | Toggle expand/collapse |
| Date (Jan 27 Mon) | Toggle expand/collapse |
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
    // Fallback: show dates with all pending status
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

  Browser                    Worker                    D1 + DO Cache
  ┌──────────┐          ┌─────────────┐          ┌─────────────────┐
  │  nav.js  │──GET────▶│ /api/v1/    │──check──▶│   DO Cache      │
  │          │          │ reports/    │          │   (60s TTL)     │
  │          │          │ status      │          └────────┬────────┘
  │          │          │             │                   │
  │          │          │             │◀──hit─────────────┘
  │          │          │             │
  │          │          │             │──miss──▶┌─────────────────┐
  │          │          │             │         │ job_date_results│
  │          │          │             │◀────────│ (D1 query)      │
  │          │◀──JSON───│             │         └─────────────────┘
  │          │          │             │
  │  Render  │          │  Compute    │
  │  Icons   │          │  pending/   │
  │          │          │  missing    │
  └──────────┘          └─────────────┘
```

## Implementation Tasks

### Phase 1: Database & Core
- [ ] Create migration script: `migrations/007_job_date_results.sql`
- [ ] Create `src/modules/trading-calendar.ts` with NYSE holidays
- [ ] Create `writeJobDateResult()` in `src/modules/d1-job-storage.ts`
- [ ] Apply migration to production D1
- [ ] Add writes to job executors (pre-market, intraday, end-of-day jobs)

### Phase 2: API
- [ ] Create `GET /api/v1/reports/status` endpoint in `src/routes/report-routes.ts`
- [ ] Implement trading day calculation using `trading-calendar.ts`
- [ ] Implement status resolution logic with grace period
- [ ] Add DO cache layer (60s TTL market hours, 5min outside)
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

## Migration Notes

- Existing `scheduled_job_results` remains unchanged (report content storage)
- Existing `job_executions` remains unchanged (fine-grain event log)
- `job_date_results` is new summary table optimized for nav status queries
- No breaking changes to existing report URLs
- Job executors need updates to call `writeJobDateResult()` on start and completion

### Migration Script: `migrations/007_job_date_results.sql`

```sql
-- Navigation status summary table
CREATE TABLE IF NOT EXISTS job_date_results (
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('pre-market','intraday','end-of-day','weekly')),
  status TEXT NOT NULL CHECK(status IN ('success','partial','failed','running')),
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

-- Backfill from existing job_executions (optional, run once)
-- INSERT OR IGNORE INTO job_date_results (scheduled_date, report_type, status, executed_at, trigger_source)
-- SELECT scheduled_date, job_type, status, created_at, 'backfill'
-- FROM job_executions
-- WHERE job_type IN ('pre-market', 'intraday', 'end-of-day', 'weekly')
-- GROUP BY scheduled_date, job_type
-- HAVING created_at = MAX(created_at);
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
# Verify old nav works
curl -s https://tft-trading-system.yanggf.workers.dev/ | grep -E "Today|Yesterday"

# Verify reports still load
curl -s "https://tft-trading-system.yanggf.workers.dev/pre-market-briefing?date=2026-01-27"
```

## Open Questions

1. **Holiday Calendar Maintenance**: Manual update each year, or fetch from external API?
2. **Backfill Strategy**: Should we backfill `job_date_results` from `job_executions` for historical dates?
3. **Weekly Report Date**: Weekly spans multiple days - what date should it show in nav? (Suggestion: Sunday of that week)
