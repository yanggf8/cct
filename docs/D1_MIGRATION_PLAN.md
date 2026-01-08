# D1 Migration Plan: Scheduled Job Results Storage

## 📋 Executive Summary

**Objective**: Migrate scheduled job results storage from Cloudflare KV to D1 database for better querying, historical tracking, and data relationships.

**Current State**: Job results stored in KV with key-based access (`analysis_YYYY-MM-DD`)
**Target State**: Job results stored in D1 with SQL querying and relational structure

**Timeline**: 5 weeks (phased rollout with dual-write safety period)
**Risk Level**: Low (dual-write strategy ensures zero data loss)

---

## 🎯 Motivation

### Current Limitations with KV

| Issue | Impact | D1 Solution |
|-------|--------|-------------|
| **No SQL Queries** | Can't filter by status, date range, or symbols | Full SQL support with WHERE, ORDER BY, JOIN |
| **No Relationships** | Can't link jobs to results efficiently | Foreign keys and normalized tables |
| **Limited History** | Manual pagination, no aggregations | Built-in ordering, COUNT, AVG, SUM |
| **Key-Only Access** | Must know exact key to retrieve data | Query by any field combination |
| **No Transactions** | Can't ensure data consistency | ACID transactions |

### Benefits of D1

✅ **Better Querying**: SQL queries for complex filters and aggregations
✅ **Historical Tracking**: Easy to query job history and trends
✅ **Data Relationships**: Link executions → results → reports
✅ **Cost Efficiency**: Cheaper for read-heavy workloads
✅ **Analytics Ready**: Direct SQL access for reporting and dashboards

---

## 🗄️ Phase 1: Schema Design

### ⚠️ CRITICAL: Existing Schema Compatibility

**PREDICT_JOBS_DB already contains**:
- `job_executions` (prediction jobs)
- `symbol_predictions` (prediction results)
- `daily_analysis` (daily summaries)

**Strategy**: **Extend existing tables** with new columns, **do not drop or recreate**.

### Schema Changes (Non-Destructive)

#### 1. Extend `job_executions` - Add columns for scheduled job tracking

**Existing columns** (keep as-is):
- `id`, `job_type`, `status`, `executed_at`, `execution_time_ms`
- `symbols_processed`, `symbols_successful`, `symbols_fallback`, `symbols_failed`
- `success_rate`, `errors`, `created_at`

**New columns to add**:
```sql
-- Add new columns to existing table (non-destructive)
ALTER TABLE job_executions ADD COLUMN execution_date TEXT;
ALTER TABLE job_executions ADD COLUMN report_type TEXT;  -- 'pre-market', 'intraday', 'end-of-day', 'weekly'
ALTER TABLE job_executions ADD COLUMN metadata TEXT;     -- JSON blob for flexible data

-- Add new indexes
CREATE INDEX IF NOT EXISTS idx_job_executions_execution_date ON job_executions(execution_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_executions_report_type ON job_executions(report_type);
```

**Column mapping**:
- `executed_at` → ISO timestamp (already exists)
- `execution_date` → YYYY-MM-DD (new, extracted from executed_at)
- `report_type` → Job type for reports (new)
- `metadata` → Flexible JSON storage (new)

**Example Data**:
```json
{
  "id": 1,
  "job_type": "pre-market",
  "execution_date": "2026-01-08",
  "execution_time": "2026-01-08T12:46:00Z",
  "status": "success",
  "duration_ms": 45000,
  "symbols_processed": 5,
  "symbols_successful": 5,
  "symbols_failed": 0,
  "metadata": "{\"trigger\":\"scheduled\",\"workflow_run_id\":\"20795135155\"}"
}
```

#### 2. Create `scheduled_job_results` - New table for report snapshots

**Why a new table**: Avoid conflicts with existing `symbol_predictions` structure.

```sql
CREATE TABLE IF NOT EXISTS scheduled_job_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_execution_id INTEGER NOT NULL,
  result_type TEXT NOT NULL,        -- 'analysis_detail', 'report_snapshot'
  symbol TEXT,                      -- NULL for report snapshots
  sentiment TEXT,
  confidence REAL,
  direction TEXT,
  reasoning TEXT,
  signals TEXT,                     -- JSON array
  report_content TEXT,              -- Full report JSON (for snapshots)
  html_snapshot TEXT,               -- HTML archive (optional)
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (job_execution_id) REFERENCES job_executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scheduled_results_job ON scheduled_job_results(job_execution_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_results_type ON scheduled_job_results(result_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_results_symbol ON scheduled_job_results(symbol);
```

**Relationship to existing tables**:
- `symbol_predictions` → Keep for prediction-specific data
- `daily_analysis` → Keep for daily summaries
- `scheduled_job_results` → New, for scheduled job outputs

**Example Data**:
```json
{
  "id": 1,
  "execution_id": 1,
  "symbol": "AAPL",
  "sentiment": "bullish",
  "confidence": 0.85,
  "direction": "buy",
  "reasoning": "Strong earnings beat with positive guidance",
  "signals": "[{\"type\":\"momentum\",\"strength\":0.8}]",
  "news_count": 12
}
```

#### 3. Keep existing tables unchanged

**No changes to**:
- `symbol_predictions` - Prediction job results (existing)
- `daily_analysis` - Daily summaries (existing)

**Schema coexistence**:
```
PREDICT_JOBS_DB
├── job_executions (extended with new columns)
├── symbol_predictions (unchanged - prediction jobs)
├── daily_analysis (unchanged - daily summaries)
└── scheduled_job_results (new - scheduled job outputs)
```

**Example Data**:
```json
{
  "id": 1,
  "execution_id": 1,
  "report_type": "pre-market",
  "report_date": "2026-01-08",
  "summary": "5 high-confidence signals, bullish market outlook",
  "high_confidence_count": 5,
  "content": "{\"signals\":[...],\"market_overview\":{...}}"
}
```

---

## 💻 Phase 2: Implementation

### Task 1: Create Non-Destructive Migration Script

**File**: `schema/scheduled-jobs-migration.sql`

```sql
-- ============================================
-- NON-DESTRUCTIVE MIGRATION
-- Extends existing PREDICT_JOBS_DB schema
-- DOES NOT drop or recreate existing tables
-- ============================================

-- Step 1: Backup existing data (manual step before running)
-- Run: npx wrangler d1 execute PREDICT_JOBS_DB --remote --command "SELECT * FROM job_executions" > backup_job_executions.json

-- Step 2: Add new columns to existing job_executions table
ALTER TABLE job_executions ADD COLUMN execution_date TEXT;
ALTER TABLE job_executions ADD COLUMN report_type TEXT;
ALTER TABLE job_executions ADD COLUMN metadata TEXT;

-- Step 3: Backfill execution_date from executed_at for existing rows
UPDATE job_executions 
SET execution_date = date(executed_at)
WHERE execution_date IS NULL;

-- Step 4: Create new table for scheduled job results
CREATE TABLE IF NOT EXISTS scheduled_job_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_execution_id INTEGER NOT NULL,
  result_type TEXT NOT NULL,
  symbol TEXT,
  sentiment TEXT,
  confidence REAL,
  direction TEXT,
  reasoning TEXT,
  signals TEXT,
  report_content TEXT,
  html_snapshot TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (job_execution_id) REFERENCES job_executions(id) ON DELETE CASCADE
);

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_job_executions_execution_date ON job_executions(execution_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_executions_report_type ON job_executions(report_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_results_job ON scheduled_job_results(job_execution_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_results_type ON scheduled_job_results(result_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_results_symbol ON scheduled_job_results(symbol);

-- Step 6: Verify migration
SELECT 'Migration complete. Existing tables preserved:' AS status;
SELECT COUNT(*) AS job_executions_count FROM job_executions;
SELECT COUNT(*) AS symbol_predictions_count FROM symbol_predictions;
SELECT COUNT(*) AS daily_analysis_count FROM daily_analysis;
SELECT COUNT(*) AS scheduled_job_results_count FROM scheduled_job_results;
```

**Apply Migration (with safety checks)**:
```bash
# 1. BACKUP FIRST (critical!)
npx wrangler d1 execute PREDICT_JOBS_DB --remote --command "SELECT * FROM job_executions" > backup_job_executions_$(date +%Y%m%d).json
npx wrangler d1 execute PREDICT_JOBS_DB --remote --command "SELECT * FROM symbol_predictions" > backup_symbol_predictions_$(date +%Y%m%d).json

# 2. Test on local first
npx wrangler d1 execute PREDICT_JOBS_DB --local --file=schema/scheduled-jobs-migration.sql

# 3. Verify local migration
npx wrangler d1 execute PREDICT_JOBS_DB --local --command "SELECT name FROM sqlite_master WHERE type='table'"

# 4. Apply to production (only after local verification)
npx wrangler d1 execute PREDICT_JOBS_DB --remote --file=schema/scheduled-jobs-migration.sql

# 5. Verify production migration
npx wrangler d1 execute PREDICT_JOBS_DB --remote --command "SELECT COUNT(*) FROM job_executions"
```

### Task 2: Create D1 Storage Adapter

**File**: `src/modules/d1-scheduled-job-storage.ts`

```typescript
import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('d1-scheduled-job-storage');

export interface ScheduledJobExecutionData {
  job_type: string;
  execution_date: string;           // YYYY-MM-DD
  report_type?: string;             // 'pre-market', 'intraday', etc.
  status: 'success' | 'failure' | 'partial';
  execution_time_ms?: number;
  symbols_processed?: number;
  symbols_successful?: number;
  symbols_failed?: number;
  errors?: string;
  metadata?: Record<string, any>;
}

export interface ScheduledJobResultData {
  result_type: 'analysis_detail' | 'report_snapshot';
  symbol?: string;
  sentiment?: string;
  confidence?: number;
  direction?: string;
  reasoning?: string;
  signals?: any[];
  report_content?: any;
  html_snapshot?: string;
}

export class D1ScheduledJobStorage {
  constructor(private db: D1Database) {}

  /**
   * Store scheduled job execution
   */
  async storeJobExecution(data: ScheduledJobExecutionData): Promise<number> {
    const result = await this.db.prepare(`
      INSERT INTO job_executions (
        job_type, execution_date, report_type, executed_at, status,
        execution_time_ms, symbols_processed, symbols_successful, symbols_failed,
        errors, metadata
      ) VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.job_type,
      data.execution_date,
      data.report_type || null,
      data.status,
      data.execution_time_ms || null,
      data.symbols_processed || null,
      data.symbols_successful || null,
      data.symbols_failed || null,
      data.errors || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    ).run();

    logger.info('Scheduled job execution stored', { 
      executionId: result.meta.last_row_id,
      jobType: data.job_type,
      reportType: data.report_type
    });

    return result.meta.last_row_id as number;
  }

  /**
   * Store job results (analysis details or report snapshot)
   */
  async storeJobResults(executionId: number, results: ScheduledJobResultData[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO scheduled_job_results (
        job_execution_id, result_type, symbol, sentiment, confidence,
        direction, reasoning, signals, report_content, html_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const batch = results.map(r => stmt.bind(
      executionId,
      r.result_type,
      r.symbol || null,
      r.sentiment || null,
      r.confidence || null,
      r.direction || null,
      r.reasoning || null,
      r.signals ? JSON.stringify(r.signals) : null,
      r.report_content ? JSON.stringify(r.report_content) : null,
      r.html_snapshot || null
    ));

    await this.db.batch(batch);

    logger.info('Job results stored', { executionId, count: results.length });
  }

  /**
   * Get latest job by type and report type
   */
  async getLatestJob(jobType: string, reportType?: string): Promise<any | null> {
    let query = 'SELECT * FROM job_executions WHERE job_type = ?';
    const bindings: any[] = [jobType];

    if (reportType) {
      query += ' AND report_type = ?';
      bindings.push(reportType);
    }

    query += ' ORDER BY executed_at DESC LIMIT 1';

    const result = await this.db.prepare(query).bind(...bindings).first();
    return result;
  }

  /**
   * Get job results for an execution
   */
  async getJobResults(executionId: number, resultType?: string): Promise<any[]> {
    let query = 'SELECT * FROM scheduled_job_results WHERE job_execution_id = ?';
    const bindings: any[] = [executionId];

    if (resultType) {
      query += ' AND result_type = ?';
      bindings.push(resultType);
    }

    const result = await this.db.prepare(query).bind(...bindings).all();
    return result.results || [];
  }
}

/**
 * Factory function
 */
export function createD1ScheduledJobStorage(env: CloudflareEnvironment): D1ScheduledJobStorage {
  if (!env.PREDICT_JOBS_DB) {
    throw new Error('PREDICT_JOBS_DB binding not found');
  }
  return new D1ScheduledJobStorage(env.PREDICT_JOBS_DB);
}
```

### Task 3: Update handleManualAnalysis

**File**: `src/modules/handlers/analysis-handlers.ts`

```typescript
// Add D1 storage after KV write
const dal = createSimplifiedEnhancedDAL(env);
const analysisKey = `analysis_${dateStr}`;
await dal.write(analysisKey, analysis, { expirationTtl: 86400 });

// NEW: Store in D1
try {
  const d1Storage = createD1JobStorage(env);
  
  // Store job execution
  const executionId = await d1Storage.storeJobExecution({
    job_type: 'analysis',
    execution_date: dateStr,
    execution_time: new Date().toISOString(),
    status: 'success',
    duration_ms: analysis.execution_metrics?.total_time_ms,
    symbols_processed: analysis.symbols_analyzed?.length || 0,
    symbols_successful: analysis.symbols_analyzed?.length || 0,
    symbols_failed: 0
  });

  // Store analysis results
  if (analysis.symbols_analyzed && analysis.symbols_analyzed.length > 0) {
    const results = analysis.symbols_analyzed.map(symbol => ({
      symbol,
      sentiment: (analysis as any)[symbol]?.sentiment,
      confidence: (analysis as any)[symbol]?.confidence,
      direction: (analysis as any)[symbol]?.direction,
      reasoning: (analysis as any)[symbol]?.reasoning
    }));
    await d1Storage.storeAnalysisResults(executionId, results);
  }

  logger.info('✅ Analysis stored in D1', { executionId, dateStr });
} catch (d1Error) {
  logger.error('❌ Failed to store in D1 (non-fatal)', { error: String(d1Error) });
  // Continue - KV storage is primary during migration
}
```

### Task 4: Update Report Handlers

**File**: `src/modules/handlers/briefing-handlers.ts`

```typescript
// Try D1 first, fallback to KV
let briefingData: any = null;

try {
  const d1Storage = createD1JobStorage(env);
  const latestJob = await d1Storage.getLatestJob('analysis');
  
  if (latestJob && latestJob.execution_date === dateStr) {
    const results = await d1Storage.getAnalysisResults(latestJob.id);
    briefingData = {
      date: dateStr,
      analysis: { symbols_analyzed: results.map(r => r.symbol) },
      // Transform D1 data to expected format
    };
    logger.info('✅ Data retrieved from D1', { executionId: latestJob.id });
  }
} catch (d1Error) {
  logger.warn('⚠️ D1 read failed, falling back to KV', { error: String(d1Error) });
}

// Fallback to KV if D1 fails or has no data
if (!briefingData) {
  briefingData = await getPreMarketBriefingData(env, today);
}
```

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
        <div>Date: ${job.execution_date}</div>
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

## 🔄 Phase 4: KV→D1 Data Backfill

### Critical: Backfill Existing KV Data

**Problem**: KV currently holds analysis data with keys like `analysis_2026-01-08`. This data must be migrated to D1.

### Backfill Strategy

#### Step 1: Identify KV Keys to Migrate

```bash
# List all analysis keys in KV
npx wrangler kv:key list --namespace-id=321593c6717448dfb24ea2bd48cde1fa --prefix="analysis_"
```

#### Step 2: Create Backfill Script

**File**: `scripts/backfill-kv-to-d1.ts`

```typescript
import { createSimplifiedEnhancedDAL } from '../src/modules/simplified-enhanced-dal.js';
import { createD1ScheduledJobStorage } from '../src/modules/d1-scheduled-job-storage.js';

async function backfillKVToD1(env: any) {
  const dal = createSimplifiedEnhancedDAL(env);
  const d1Storage = createD1ScheduledJobStorage(env);
  
  // Get last 30 days of analysis data from KV
  const today = new Date();
  const backfillDays = 30;
  
  for (let i = 0; i < backfillDays; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const analysisKey = `analysis_${dateStr}`;
    const result = await dal.read(analysisKey);
    
    if (result.success && result.data) {
      console.log(`Backfilling ${dateStr}...`);
      
      // Store in D1
      const executionId = await d1Storage.storeJobExecution({
        job_type: 'analysis',
        execution_date: dateStr,
        report_type: 'backfill',
        status: 'success',
        symbols_processed: result.data.symbols_analyzed?.length || 0,
        metadata: { source: 'kv_backfill', original_key: analysisKey }
      });
      
      // Store results if available
      if (result.data.symbols_analyzed) {
        const results = result.data.symbols_analyzed.map((symbol: string) => ({
          result_type: 'analysis_detail' as const,
          symbol,
          sentiment: (result.data as any)[symbol]?.sentiment,
          confidence: (result.data as any)[symbol]?.confidence
        }));
        
        await d1Storage.storeJobResults(executionId, results);
      }
      
      console.log(`✅ Backfilled ${dateStr} (execution_id: ${executionId})`);
    } else {
      console.log(`⏭️  No data for ${dateStr}`);
    }
  }
  
  console.log('Backfill complete!');
}

// Run backfill
backfillKVToD1(process.env).catch(console.error);
```

#### Step 3: Run Backfill

```bash
# Dry run (local D1)
npx tsx scripts/backfill-kv-to-d1.ts --dry-run

# Production backfill
npx tsx scripts/backfill-kv-to-d1.ts --production

# Verify backfill
npx wrangler d1 execute PREDICT_JOBS_DB --remote --command "
  SELECT execution_date, COUNT(*) as count 
  FROM job_executions 
  WHERE metadata LIKE '%kv_backfill%' 
  GROUP BY execution_date 
  ORDER BY execution_date DESC
"
```

### Backfill Validation

```sql
-- Check backfilled data
SELECT 
  execution_date,
  job_type,
  report_type,
  symbols_processed,
  status
FROM job_executions
WHERE metadata LIKE '%kv_backfill%'
ORDER BY execution_date DESC
LIMIT 10;

-- Verify results were stored
SELECT 
  je.execution_date,
  COUNT(sjr.id) as result_count
FROM job_executions je
LEFT JOIN scheduled_job_results sjr ON je.id = sjr.job_execution_id
WHERE je.metadata LIKE '%kv_backfill%'
GROUP BY je.execution_date
ORDER BY je.execution_date DESC;
```

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
- ✅ Create migration script (ALTER TABLE, not DROP)
- ✅ Test migration on local D1
- ✅ Apply to staging environment
- ✅ Create D1 storage adapter module

### Week 2: Backfill & Dual-Write
- ✅ Create and test KV→D1 backfill script
- ✅ Run backfill for last 30 days of data
- ✅ Verify backfilled data integrity
- ✅ Update `handleManualAnalysis` to write to D1
- ✅ Update report handlers to read from D1 (with KV fallback)
- ✅ Deploy to staging

### Week 3: API & Dashboard
- ✅ Create D1 query API endpoints
- ✅ Update dashboard to use D1 APIs
- ✅ Deploy to staging
- ✅ User acceptance testing

### Week 4: Production Deployment
- ✅ **CRITICAL**: Backup production D1 before deployment
- ✅ Apply migration to production D1
- ✅ Run production backfill
- ✅ Deploy code with dual-write enabled
- ✅ Monitor D1 performance and reliability
- ✅ Verify data consistency between D1 and KV

### Week 5: Cutover & Cleanup
- ✅ Verify D1 has complete data for past 7 days
- ✅ Switch to D1-only writes (remove KV writes)
- ✅ Keep KV reads as fallback for 30 days
- ✅ Monitor for issues
- ✅ Remove KV code after validation period

---

## 🎯 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Data Completeness** | 100% | All jobs stored in D1 |
| **Query Performance** | <50ms | P95 latency for history queries |
| **Reliability** | 99.9% | D1 write success rate |
| **Cost Reduction** | 30% | Reduced KV read operations |
| **Dashboard Load Time** | <2s | Time to display job history |

---

## ⚠️ Risk Mitigation

### Risk 1: D1 Unavailability
**Mitigation**: Dual-write to both D1 and KV during migration period. KV serves as backup.

### Risk 2: Schema Changes Needed
**Mitigation**: Use `metadata` JSON column for flexible data. Can add columns later without breaking changes.

### Risk 3: Performance Degradation
**Mitigation**: Indexes on all query paths. Monitor P95 latency. Rollback plan ready.

### Risk 4: Data Loss
**Mitigation**: D1 has automatic backups. KV data retained for 30 days post-cutover.

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

2. **Switch to KV-Only Reads** (5 minutes)
   ```typescript
   // Skip D1 reads, go straight to KV
   const USE_D1_READS = false;  // Set to false
   ```

3. **Restore from Backup** (if data corruption)
   ```bash
   # Restore job_executions from backup
   npx wrangler d1 execute PREDICT_JOBS_DB --remote --file=backup_restore.sql
   ```

4. **Verify System Health**
   ```bash
   # Check KV is working
   curl https://tft-trading-system.yanggf.workers.dev/api/v1/reports/pre-market
   
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

### Current KV Costs (Estimated)
- **Writes**: ~100/day × $0.50/million = $0.0015/day
- **Reads**: ~500/day × $0.50/million = $0.0075/day
- **Total**: ~$0.27/month

### Projected D1 Costs
- **Writes**: ~100/day × $0.00/million = $0.00/day (free tier)
- **Reads**: ~500/day × $0.00/million = $0.00/day (free tier)
- **Storage**: <1MB = $0.00/month (free tier)
- **Total**: ~$0.00/month (within free tier limits)

**Savings**: ~$0.27/month (100% reduction)

---

## 📝 Next Steps

1. **Review this plan** with team
2. **Approve schema design**
3. **Create GitHub issue** for tracking
4. **Assign tasks** to implementation phases
5. **Set up staging environment** for testing
6. **Begin Week 1 implementation**

---

**Document Version**: 1.0
**Last Updated**: 2026-01-08
**Author**: AI Assistant
**Status**: Draft - Pending Review
