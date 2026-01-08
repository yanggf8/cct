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

### Database Tables

#### 1. `job_executions` - Master execution log

```sql
CREATE TABLE job_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL,           -- 'analysis', 'pre-market', 'intraday', 'end-of-day', 'weekly'
  execution_date TEXT NOT NULL,     -- YYYY-MM-DD
  execution_time TEXT NOT NULL,     -- ISO 8601 timestamp
  status TEXT NOT NULL,             -- 'success', 'failure', 'partial'
  duration_ms INTEGER,              -- Execution time in milliseconds
  symbols_processed INTEGER,        -- Number of symbols analyzed
  symbols_successful INTEGER,       -- Number of successful analyses
  symbols_failed INTEGER,           -- Number of failed analyses
  error_message TEXT,               -- Error details if status = 'failure'
  metadata TEXT,                    -- JSON blob for flexible data
  created_at TEXT DEFAULT (datetime('now')),
  
  -- Constraints
  CHECK (status IN ('success', 'failure', 'partial')),
  CHECK (job_type IN ('analysis', 'pre-market', 'intraday', 'end-of-day', 'weekly'))
);

CREATE INDEX idx_job_executions_type_date ON job_executions(job_type, execution_date DESC);
CREATE INDEX idx_job_executions_date ON job_executions(execution_date DESC);
CREATE INDEX idx_job_executions_status ON job_executions(status);
```

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

#### 2. `analysis_results` - Detailed symbol analysis

```sql
CREATE TABLE analysis_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  sentiment TEXT,                   -- 'bullish', 'bearish', 'neutral'
  confidence REAL,                  -- 0.0 to 1.0
  direction TEXT,                   -- 'buy', 'sell', 'hold'
  reasoning TEXT,                   -- AI reasoning text
  signals TEXT,                     -- JSON array of trading signals
  technical_data TEXT,              -- JSON blob for technical indicators
  news_count INTEGER,               -- Number of news articles analyzed
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (execution_id) REFERENCES job_executions(id) ON DELETE CASCADE
);

CREATE INDEX idx_analysis_results_execution ON analysis_results(execution_id);
CREATE INDEX idx_analysis_results_symbol ON analysis_results(symbol);
CREATE INDEX idx_analysis_results_sentiment ON analysis_results(sentiment);
```

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

#### 3. `report_snapshots` - Full report data

```sql
CREATE TABLE report_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id INTEGER NOT NULL,
  report_type TEXT NOT NULL,        -- 'pre-market', 'intraday', 'end-of-day', 'weekly'
  report_date TEXT NOT NULL,        -- YYYY-MM-DD
  content TEXT,                     -- Full report data (JSON)
  html_snapshot TEXT,               -- Optional HTML snapshot for archival
  summary TEXT,                     -- Brief summary for quick display
  high_confidence_count INTEGER,    -- Number of high-confidence signals
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (execution_id) REFERENCES job_executions(id) ON DELETE CASCADE
);

CREATE INDEX idx_report_snapshots_type_date ON report_snapshots(report_type, report_date DESC);
CREATE INDEX idx_report_snapshots_execution ON report_snapshots(execution_id);
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

### Task 1: Create Migration Script

**File**: `schema/scheduled-jobs.sql`

```sql
-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS report_snapshots;
DROP TABLE IF EXISTS analysis_results;
DROP TABLE IF EXISTS job_executions;

-- Create tables (see Phase 1 schema above)
-- ... (full schema)

-- Seed with example data for testing
INSERT INTO job_executions (job_type, execution_date, execution_time, status, duration_ms, symbols_processed)
VALUES ('analysis', '2026-01-08', '2026-01-08T09:00:00Z', 'success', 45000, 5);
```

**Apply Migration**:
```bash
# Production
npx wrangler d1 execute PREDICT_JOBS_DB --remote --file=schema/scheduled-jobs.sql

# Local testing
npx wrangler d1 execute PREDICT_JOBS_DB --local --file=schema/scheduled-jobs.sql
```

### Task 2: Create D1 Storage Adapter

**File**: `src/modules/d1-job-storage.ts`

```typescript
import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('d1-job-storage');

export interface JobExecutionData {
  job_type: 'analysis' | 'pre-market' | 'intraday' | 'end-of-day' | 'weekly';
  execution_date: string;
  execution_time: string;
  status: 'success' | 'failure' | 'partial';
  duration_ms?: number;
  symbols_processed?: number;
  symbols_successful?: number;
  symbols_failed?: number;
  error_message?: string;
  metadata?: Record<string, any>;
}

export interface AnalysisResultData {
  symbol: string;
  sentiment?: string;
  confidence?: number;
  direction?: string;
  reasoning?: string;
  signals?: any[];
  technical_data?: Record<string, any>;
  news_count?: number;
}

export interface ReportSnapshotData {
  report_type: string;
  report_date: string;
  content: any;
  html_snapshot?: string;
  summary?: string;
  high_confidence_count?: number;
}

export class D1JobStorage {
  constructor(private db: D1Database) {}

  /**
   * Store job execution record
   */
  async storeJobExecution(data: JobExecutionData): Promise<number> {
    const result = await this.db.prepare(`
      INSERT INTO job_executions (
        job_type, execution_date, execution_time, status,
        duration_ms, symbols_processed, symbols_successful, symbols_failed,
        error_message, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.job_type,
      data.execution_date,
      data.execution_time,
      data.status,
      data.duration_ms || null,
      data.symbols_processed || null,
      data.symbols_successful || null,
      data.symbols_failed || null,
      data.error_message || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    ).run();

    logger.info('Job execution stored', { 
      executionId: result.meta.last_row_id,
      jobType: data.job_type,
      status: data.status
    });

    return result.meta.last_row_id as number;
  }

  /**
   * Store analysis results for a job execution
   */
  async storeAnalysisResults(executionId: number, results: AnalysisResultData[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO analysis_results (
        execution_id, symbol, sentiment, confidence, direction,
        reasoning, signals, technical_data, news_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const batch = results.map(r => stmt.bind(
      executionId,
      r.symbol,
      r.sentiment || null,
      r.confidence || null,
      r.direction || null,
      r.reasoning || null,
      r.signals ? JSON.stringify(r.signals) : null,
      r.technical_data ? JSON.stringify(r.technical_data) : null,
      r.news_count || null
    ));

    await this.db.batch(batch);

    logger.info('Analysis results stored', { 
      executionId,
      count: results.length
    });
  }

  /**
   * Store report snapshot
   */
  async storeReportSnapshot(executionId: number, data: ReportSnapshotData): Promise<void> {
    await this.db.prepare(`
      INSERT INTO report_snapshots (
        execution_id, report_type, report_date, content,
        html_snapshot, summary, high_confidence_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      executionId,
      data.report_type,
      data.report_date,
      JSON.stringify(data.content),
      data.html_snapshot || null,
      data.summary || null,
      data.high_confidence_count || null
    ).run();

    logger.info('Report snapshot stored', { 
      executionId,
      reportType: data.report_type
    });
  }

  /**
   * Get latest job execution by type
   */
  async getLatestJob(jobType: string): Promise<any | null> {
    const result = await this.db.prepare(`
      SELECT * FROM job_executions
      WHERE job_type = ?
      ORDER BY execution_time DESC
      LIMIT 1
    `).bind(jobType).first();

    return result;
  }

  /**
   * Get job execution history with filters
   */
  async getJobHistory(filters: {
    jobType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<any[]> {
    let query = 'SELECT * FROM job_executions WHERE 1=1';
    const bindings: any[] = [];

    if (filters.jobType) {
      query += ' AND job_type = ?';
      bindings.push(filters.jobType);
    }

    if (filters.status) {
      query += ' AND status = ?';
      bindings.push(filters.status);
    }

    if (filters.startDate) {
      query += ' AND execution_date >= ?';
      bindings.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND execution_date <= ?';
      bindings.push(filters.endDate);
    }

    query += ' ORDER BY execution_time DESC LIMIT ?';
    bindings.push(filters.limit || 50);

    const result = await this.db.prepare(query).bind(...bindings).all();
    return result.results || [];
  }

  /**
   * Get analysis results for a job execution
   */
  async getAnalysisResults(executionId: number): Promise<any[]> {
    const result = await this.db.prepare(`
      SELECT * FROM analysis_results
      WHERE execution_id = ?
      ORDER BY symbol
    `).bind(executionId).all();

    return result.results || [];
  }

  /**
   * Get report snapshot for a job execution
   */
  async getReportSnapshot(executionId: number): Promise<any | null> {
    const result = await this.db.prepare(`
      SELECT * FROM report_snapshots
      WHERE execution_id = ?
    `).bind(executionId).first();

    return result;
  }
}

/**
 * Factory function to create D1JobStorage instance
 */
export function createD1JobStorage(env: CloudflareEnvironment): D1JobStorage {
  if (!env.PREDICT_JOBS_DB) {
    throw new Error('PREDICT_JOBS_DB binding not found');
  }
  return new D1JobStorage(env.PREDICT_JOBS_DB);
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

## 🧪 Phase 4: Testing & Validation

### Task 7: Test Migration

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

### Week 1: Foundation
- ✅ Design and review schema
- ✅ Create migration script
- ✅ Apply to staging environment
- ✅ Create D1 storage adapter module

### Week 2: Dual-Write Implementation
- ✅ Update `handleManualAnalysis` to write to D1
- ✅ Update report handlers to read from D1 (with KV fallback)
- ✅ Deploy to staging
- ✅ Run integration tests

### Week 3: API & Dashboard
- ✅ Create D1 query API endpoints
- ✅ Update dashboard to use D1 APIs
- ✅ Deploy to staging
- ✅ User acceptance testing

### Week 4: Production Deployment
- ✅ Deploy to production with dual-write enabled
- ✅ Monitor D1 performance and reliability
- ✅ Verify data consistency between D1 and KV
- ✅ Collect metrics (latency, error rate, cost)

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

If issues arise during migration:

1. **Immediate**: Switch reads back to KV-only
2. **Short-term**: Disable D1 writes, continue KV-only
3. **Investigation**: Analyze D1 errors and performance
4. **Fix**: Address issues in staging environment
5. **Retry**: Re-enable D1 with fixes applied

**Rollback Trigger Conditions**:
- D1 write success rate < 95%
- Query latency P95 > 200ms
- Data inconsistency detected
- Critical bug in D1 storage adapter

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
