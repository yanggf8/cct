# D1 Migration Plan: Scheduled Job Results Storage

## 📋 Executive Summary

**Objective**: Finalize D1 as the source of truth for scheduled job results and make dashboards resilient to DO cache evictions by falling back to D1 and re-hydrating cache automatically.

**Current State**: D1 holds `job_executions`, `symbol_predictions`, `daily_analysis`; DO cache is still primary for dashboards. A new `scheduled_job_results` table + snapshot writes/fallbacks are coded but **not deployed**; migration must be applied. KV is not used for job storage (guards remain).
**Target State**: Dashboards read from DO cache with D1 fallback and cache rehydration; report snapshots persisted in D1 (`scheduled_job_results`). KV remains unused for jobs.

**Timeline**: Pending deployment (apply migration + deploy code)
**Risk Level**: Low (additive changes; ensure migration runs before code deploy)

---

## 🎯 Motivation

### Current Limitations with KV (legacy)

| Issue | Impact | D1 Solution |
|-------|--------|-------------|
| **No SQL Queries** | Can't filter by status, date range, or symbols | Full SQL support with WHERE, ORDER BY, JOIN |
| **No Relationships** | Can't link jobs to results efficiently | Foreign keys and normalized tables |
| **Limited History** | Manual pagination, no aggregations | Built-in ordering, COUNT, AVG, SUM |
| **Key-Only Access** | Must know exact key to retrieve data | Query by any field combination |
| **No Transactions** | Can't ensure data consistency | ACID transactions |

### Benefits of D1 (already in use)

✅ **Better Querying**: SQL queries for complex filters and aggregations
✅ **Historical Tracking**: Easy to query job history and trends
✅ **Data Relationships**: Link executions → results → reports
✅ **Cost Efficiency**: Cheaper for read-heavy workloads
✅ **Analytics Ready**: Direct SQL access for reporting and dashboards

---

## 🗄️ Phase 1: Schema (minimal snapshot storage)

**What already exists**: `job_executions`, `symbol_predictions`, `daily_analysis` (unchanged).

**Current migration**: `schema/scheduled-jobs-migration.sql` (idempotent)
```sql
CREATE TABLE IF NOT EXISTS scheduled_job_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_date TEXT NOT NULL,
  report_type TEXT NOT NULL,
  report_content TEXT,
  metadata TEXT,
  trigger_source TEXT DEFAULT 'unknown',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(scheduled_date, report_type)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_results_date ON scheduled_job_results(scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_results_type ON scheduled_job_results(report_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_results_created ON scheduled_job_results(created_at DESC);
```

**Deferred**: Adding columns/FKs on `job_executions` (not required for snapshot storage).

---

## 💻 Phase 2: Implementation (code done, pending deploy)

### Task 1: Migration Script (ready to run)

- **File**: `schema/scheduled-jobs-migration.sql`
- Creates `scheduled_job_results` keyed by `scheduled_date` + `report_type`, with `trigger_source` and `created_at`; no FK to job_executions by design.
- Query/report date uses `scheduled_date`; actual generation time is recorded in `created_at` (and may also be present in payload as `generated_at`).
- Does **not** alter `job_executions` (deferred).

**Apply migration**
```bash
unset CLOUDFLARE_API_TOKEN && npx wrangler d1 execute cct-predict-jobs --remote --file=schema/scheduled-jobs-migration.sql
```

**Verify**
```bash
npx wrangler d1 execute cct-predict-jobs --remote --command "SELECT COUNT(*) FROM scheduled_job_results"
```

**Backfill & Cutover Plan (revised)**
1) Snapshots: write all report snapshots into `scheduled_job_results`; DO cache remains hot path.
2) Reads: on cache miss, read from D1 snapshot/predictions and optionally warm cache if fresh.
3) KV: unused for jobs; cleanup deferred until post-deploy validation.

### Known Caveats (post-migration)
- `scheduled_job_results` is standalone; we do **not** write per-report executions into `job_executions`. The Jobs history endpoint will only show whatever is already in `job_executions` (cron/health) until we add execution writes.
- Intraday/End-of-day fallbacks use predictions-shaped data with `performance.accuracy = 0` and `status = 'tracking'`; dashboards should treat these as partial/stale (accuracy will look zero until real performance data exists).

### Task 2: Create D1 Storage Adapter

**File**: `src/modules/d1-job-storage.ts`

This repo uses a lightweight snapshot approach:
- `writeD1JobResult(env, scheduledDate, reportType, reportContent, metadata?, triggerSource?)` writes report snapshots into `scheduled_job_results`.
- `readD1ReportSnapshot()` / `getD1LatestReportSnapshot()` provide D1 fallback reads when the DO cache misses.

### Task 3: Update handleManualAnalysis

**File**: `src/modules/handlers/analysis-handlers.ts`

```typescript
// Persist to D1 first (source of truth)
await writeD1JobResult(env, dateStr, 'analysis', analysis, {
  trigger: 'manual_analysis'
}, 'manual-api');

// Warm DO cache for fast reads
const dal = createSimplifiedEnhancedDAL(env);
const analysisKey = `analysis_${dateStr}`;
await dal.write(analysisKey, analysis, { expirationTtl: 86400 });
logger.info('✅ Analysis stored in D1 and DO cache', { dateStr });
```

### Task 4: Update Report Handlers (D1-first with DO cache rehydration)

**Files**: `src/modules/handlers/briefing-handlers.ts`, `intraday-handlers.ts`, `end-of-day-handlers.ts`, `weekly-review-handlers.ts`
- On cache miss, use generic `getD1FallbackData`:
  - Order: D1 snapshot (today) → latest snapshot → D1 predictions (today) → D1 predictions (yesterday, marked `is_stale`, not cached).
  - Cache warm only when fresh (not stale).
- Each handler writes a snapshot to D1 (`scheduled_job_results`) after generating the report.

---

## 🔌 Phase 3: API & Dashboard

### Task 5: Create D1 Query API Endpoints

**File**: `src/routes/jobs-routes.ts`

```typescript
import { Router } from 'itty-router';
import { createD1JobStorage } from '../modules/d1-job-storage.js';

export function registerJobsRoutes(router: Router): void {
  // Get job execution history
  router.get('/api/v1/jobs/history', async (request, env) => {
    const url = new URL(request.url);
    const jobType = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const d1Storage = createD1JobStorage(env);
    const history = await d1Storage.getJobHistory({
      jobType: jobType || undefined,
      status: status || undefined,
      limit
    });

    return new Response(JSON.stringify({
      success: true,
      count: history.length,
      jobs: history
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  });

  // Get latest job by type
  router.get('/api/v1/jobs/latest', async (request, env) => {
    const url = new URL(request.url);
    const jobType = url.searchParams.get('type') || 'analysis';

    const d1Storage = createD1JobStorage(env);
    const job = await d1Storage.getLatestJob(jobType);

    if (!job) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No jobs found'
      }), { status: 404 });
    }

    return new Response(JSON.stringify({
      success: true,
      job
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  });

  // Get job details with results
  router.get('/api/v1/jobs/:id', async (request, env) => {
    const { id } = request.params;
    const d1Storage = createD1JobStorage(env);

    const job = await env.PREDICT_JOBS_DB.prepare(
      'SELECT * FROM job_executions WHERE id = ?'
    ).bind(id).first();

    if (!job) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Job not found'
      }), { status: 404 });
    }

    const results = await d1Storage.getAnalysisResults(parseInt(id));
    const snapshot = await d1Storage.getReportSnapshot(parseInt(id));

    return new Response(JSON.stringify({
      success: true,
      job,
      results,
      snapshot
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  });
}
```

### Task 6: Update Dashboard

**File**: `public/dashboard.html`

```javascript
// Replace GitHub API calls with D1 API calls
async function fetchJobHistory() {
  const response = await fetch('/api/v1/jobs/history?limit=20');
  const data = await response.json();
  return data.jobs;
}

function renderJobHistory(jobs) {
  const container = document.getElementById('job-history');
  
  const html = jobs.map(job => `
    <div class="job-card ${job.status}">
      <div class="job-header">
        <span class="job-type">${job.job_type}</span>
        <span class="job-status">${job.status}</span>
      </div>
      <div class="job-details">
        <div>Date: ${job.scheduled_date}</div>
        <div>Duration: ${job.duration_ms}ms</div>
        <div>Symbols: ${job.symbols_processed}</div>
      </div>
      <a href="/api/v1/jobs/${job.id}" class="view-details">View Details →</a>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

// Initialize
fetchJobHistory().then(renderJobHistory);
```

---

## 🔄 Phase 4: D1 Validation & DO Cache Rehydration

### Goals
- Confirm D1 completeness for recent jobs.
- Ensure DO cache warms from D1 on misses to prevent blank dashboards.

### Steps
1) **Validate recent data in D1**
```bash
npx wrangler d1 execute PREDICT_JOBS_DB --remote --command "
  SELECT job_type, scheduled_date, COUNT(*) AS cnt
  FROM job_executions
  WHERE scheduled_date >= date('now','-14 days')
  GROUP BY job_type, scheduled_date
  ORDER BY scheduled_date DESC, job_type;
"
```

2) **Spot-check a specific date**
```bash
TARGET_DATE=2026-01-08
npx wrangler d1 execute PREDICT_JOBS_DB --remote --command "
  SELECT * FROM job_executions 
  WHERE scheduled_date = '$TARGET_DATE' AND job_type = 'pre-market'
  ORDER BY executed_at DESC
  LIMIT 1;
"
```

3) **Rehydrate DO cache for a date (manual)**
```bash
# Fetch from D1
npx wrangler d1 execute PREDICT_JOBS_DB --remote --command "
  SELECT id, scheduled_date FROM job_executions 
  WHERE scheduled_date = '$TARGET_DATE' 
    AND job_type = 'pre-market' 
  ORDER BY executed_at DESC LIMIT 1;
"

# Call API to rebuild cache (preferred)
curl -X POST -H "X-API-KEY: $X_API_KEY" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/sentiment/analysis
```

4) **Automate warm-after-write**
- After storing to D1, immediately write the same payload to DO cache (`analysis_<date>`) with 24h TTL.
- On read, if DO cache misses, fetch from D1 and re-write the cache.

## 🧪 Phase 5: Testing & Validation

**Test Checklist**:

1. **Schema Validation**
   ```bash
   # Verify tables exist
   npx wrangler d1 execute PREDICT_JOBS_DB --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
   
   # Check indexes
   npx wrangler d1 execute PREDICT_JOBS_DB --remote --command "SELECT * FROM sqlite_master WHERE type='index'"
   ```

2. **Write Tests**
   ```bash
   # Trigger manual analysis
   curl -X GET https://tft-trading-system.yanggf.workers.dev/api/v1/sentiment/analysis
   
   # Verify D1 storage
   npx wrangler d1 execute PREDICT_JOBS_DB --remote --command "SELECT * FROM job_executions ORDER BY id DESC LIMIT 1"
   ```

3. **Read Tests**
   ```bash
   # Test API endpoints
   curl https://tft-trading-system.yanggf.workers.dev/api/v1/jobs/latest?type=analysis
   curl https://tft-trading-system.yanggf.workers.dev/api/v1/jobs/history?limit=10
   ```

4. **Report Generation**
   ```bash
   # Verify reports use D1 data
   curl https://tft-trading-system.yanggf.workers.dev/pre-market-briefing
   ```

5. **Dashboard Display**
   - Open dashboard in browser
   - Verify job history displays
   - Check status indicators
   - Test detail links

---

## 📅 Rollout Timeline

### Week 1: Foundation & Backup
- ✅ **CRITICAL**: Backup existing D1 data
- ✅ Design and review non-destructive schema changes
- ❌ Create migration script (ALTER-only + `scheduled_job_results`) - **NOT DONE**: `schema/scheduled-jobs-migration.sql` does not exist
- ❌ Test migration on local D1 - **NOT DONE**
- ❌ Apply to staging environment - **NOT DONE**
- ⚠️ Create D1 storage adapter module - **PARTIAL**: `src/modules/d1-job-storage.ts` created for reads only

### Week 2: Cache Resilience & API
- ❌ Update `handleManualAnalysis` to write to D1 then warm DO cache - **NOT DONE**: still writes to DAL/DO cache only
- ⚠️ Update report handlers to read D1 on DO miss and rehydrate cache - **PARTIAL**: pre-market only, code not deployed
- ❌ Create D1 query API endpoints - **NOT DONE**
- ❌ Deploy to staging and run UAT - **NOT DONE**

### Week 3: Production Deployment
- ❌ **CRITICAL**: Backup production D1 before deployment - **NOT DONE**
- ❌ Apply migration to production D1 - **NOT DONE**: no `scheduled_job_results` table
- ❌ Deploy code with D1-first + DO cache warm paths - **NOT DONE**
- ❌ Monitor D1 performance and cache eviction alerts - **NOT DONE**
- ❌ Spot-check 14-day history in D1 - **NOT DONE**

### Week 4: Cleanup
- ❌ Remove any remaining KV references for scheduled jobs - **NOT DONE**
- ❌ Keep DO cache warming in place; tune TTL/capacity as needed - **NOT DONE**
- ❌ Document operational runbook for cache eviction recovery - **NOT DONE**

---

## 📊 Current State (2026-01-09)

| Component | Status | Notes |
|-----------|--------|-------|
| D1 tables | ⚠️ Partial | `job_executions`, `symbol_predictions`, `daily_analysis` exist; NO `scheduled_job_results` |
| D1 writes | ⚠️ Partial | Cron health + predictions only; NO report snapshots |
| D1 reads | ⚠️ Partial | Pre-market fallback code ready (not deployed); other reports NO |
| Cache warm-after-write | ❌ Missing | Not implemented |
| KV cleanup | ❌ Pending | Guards still in code |

---

## 🎯 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Data Completeness** | 100% | All jobs stored in D1 |
| **Query Performance** | <50ms | P95 latency for history queries |
| **Reliability** | 99.9% | D1 write success rate |
| **Cache Resilience** | 0 blank dashboards | DO cache auto-rehydrated from D1 on miss |
| **Dashboard Load Time** | <2s | Time to display job history |

---

## ⚠️ Risk Mitigation

### Risk 1: D1 Unavailability
**Mitigation**: DO cache contains the most recent run; on D1 outage serve last cached payload and surface warning. Keep D1 writes queued/retried with backoff.

### Risk 2: Schema Changes Needed
**Mitigation**: Use `metadata` JSON column for flexible data. Can add columns later without breaking changes.

### Risk 3: Performance Degradation
**Mitigation**: Indexes on all query paths. Monitor P95 latency. Rollback plan ready.

### Risk 4: Data Loss
**Mitigation**: D1 has automatic backups. Daily exports before deployments; DO cache warming ensures user-visible data persists for the latest run even if D1 is recovering.

---

## 🔄 Rollback Plan

### Immediate Rollback (if critical issues arise)

**Trigger Conditions**:
- D1 write success rate < 95%
- Query latency P95 > 200ms
- Data corruption detected
- Existing tables damaged

**Rollback Steps**:

1. **Stop D1 Writes** (5 minutes)
   ```typescript
   // Emergency feature flag
   const ENABLE_D1_WRITES = false;  // Set to false
   ```

2. **Serve from DO Cache / Last Known Good** (5 minutes)
   ```typescript
   // Skip D1 reads, rely on cached payloads
   const USE_D1_READS = false;  // Set to false
   ```

3. **Restore from Backup** (if data corruption)
   ```bash
   # Restore job_executions from backup
   npx wrangler d1 execute PREDICT_JOBS_DB --remote --file=backup_restore.sql
   ```

4. **Verify System Health**
   ```bash
   # Verify existing tables intact
   npx wrangler d1 execute PREDICT_JOBS_DB --remote --command "
     SELECT COUNT(*) FROM symbol_predictions;
     SELECT COUNT(*) FROM daily_analysis;
   "
   ```

### Data Recovery

**If existing tables were damaged**:

```sql
-- Restore from backup JSON files
-- (Created in Week 1, Step 1 of migration)

-- 1. Drop damaged tables (only if necessary)
DROP TABLE IF EXISTS scheduled_job_results;

-- 2. Restore job_executions from backup
-- (Manual process using backup_job_executions_YYYYMMDD.json)

-- 3. Restore symbol_predictions from backup
-- (Manual process using backup_symbol_predictions_YYYYMMDD.json)

-- 4. Verify restoration
SELECT COUNT(*) FROM job_executions;
SELECT COUNT(*) FROM symbol_predictions;
SELECT COUNT(*) FROM daily_analysis;
```

### Post-Rollback Analysis

1. **Identify Root Cause**
   - Review D1 error logs
   - Check migration script for issues
   - Analyze performance metrics

2. **Fix Issues in Staging**
   - Apply fixes to staging environment
   - Re-test migration thoroughly
   - Validate with production-like data

3. **Plan Re-Migration**
   - Address identified issues
   - Update migration plan
   - Schedule new deployment window

---

## 📊 Cost Analysis

- KV is no longer in use for scheduled jobs; DO cache + D1 stay within current free-tier limits.
- D1 writes/reads for scheduled jobs remain negligible (<1MB storage, low query volume).
- Monitor for D1 tier changes; if growth increases, add monthly report using `wrangler d1 analytics`.

---

## 📝 Next Steps

1. **Review this plan** with team
2. **Approve schema design**
3. **Create GitHub issue** for tracking
4. **Assign tasks** to implementation phases
5. **Set up staging environment** for testing
6. **Begin Week 1 implementation**

---

**Document Version**: 1.1
**Last Updated**: 2026-01-08 (cache eviction resilience update)
**Author**: AI Assistant
**Status**: Draft - Pending Review
