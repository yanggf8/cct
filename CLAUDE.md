# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start (Critical Gotchas)

- **Wrangler auth**: Always `unset CLOUDFLARE_API_TOKEN` before any wrangler command — uses OAuth, not API tokens.
- **API testing**: `$X_API_KEY` is pre-set in the shell — use it directly, never scrape from frontend config.
- **No mock data**: Never fabricate financial numbers or add default/fallback values. Return honest empty state on failure.
- **Ask before deploying**: Always request user approval before `npm run deploy` or any remote D1 migration.
- **Frontend builds**: Must run `npm run build` before deploying frontend changes.

## Development Commands

```bash
# Local dev server
npm run dev

# Type checking
npm run typecheck

# Lint
npm run lint
npm run lint:fix

# Build (frontend + backend)
npm run build

# Build frontend only (faster, skips typecheck)
npm run build:frontend:only

# Tests (Playwright)
npm run test:playwright
npx playwright test tests/performance.spec.js --reporter=list  # single suite

# Verify (pre-deploy gates: html, guards, env bindings, monitoring, mock prevention)
npm run verify

# Staging deploy
npm run deploy:staging
```

> **Wrangler auth**: Always `unset CLOUDFLARE_API_TOKEN` before wrangler commands — auth uses OAuth (browser), not API tokens.

> **Pre-commit hook** (husky): Runs `npm run typecheck` — commits are blocked if TypeScript errors exist.

> **TypeScript config**: `strict: false` in tsconfig.json (no strictNullChecks, no noImplicitAny). This is deliberate — do not enable strict flags without explicit approval.

---

## Architecture

**Runtime**: Cloudflare Workers (TypeScript) with D1 (SQLite), KV, Durable Objects, R2, and Workers AI bindings.

**Request flow**:
```
src/index.ts
  └─ EnhancedRequestHandler (src/modules/enhanced-request-handler.ts)
       ├─ Page routes: /pre-market-briefing, /intraday-check, /end-of-day, /weekly-review
       │    └─ src/modules/handlers/ (briefing, intraday, end-of-day, weekly-review handlers)
       └─ /api/v1/* → handleApiV1Request (src/routes/api-v1.ts)
            ├─ /jobs/*              → jobs-routes.ts
            ├─ /reports/*           → report-routes.ts
            ├─ /data/*              → data-routes.ts
            ├─ /sentiment/*         → sentiment-routes.ts
            ├─ /sector-rotation/*   → sector-rotation-routes.ts
            ├─ /sectors/*           → sector-routes.ts
            ├─ /market-intelligence/* → market-intelligence-routes.ts
            ├─ /market-drivers/*    → market-drivers-routes.ts
            ├─ /predictive/*        → predictive-analytics-routes.ts
            ├─ /technical/*         → technical-routes.ts
            ├─ /analytics/*         → advanced-analytics-routes.ts
            ├─ /backtesting/*       → backtesting-routes.ts
            ├─ /portfolio/symbols/* → portfolio-management-routes.ts (via PortfolioDO)
            ├─ /realtime/*          → realtime-routes.ts
            ├─ /cache/*             → enhanced-cache-routes.ts
            └─ /guards/*            → production-guards-routes.ts
```

**Scheduled jobs** (triggered via GitHub Actions → `POST /api/v1/jobs/trigger`):
```
scheduler.ts → handleScheduledEvent()
  ├─ pre-market     → src/modules/pre-market-data-bridge.ts
  ├─ intraday       → src/modules/report/intraday-analysis.ts
  ├─ end-of-day     → src/modules/report/end-of-day-analysis.ts
  ├─ weekly         → src/modules/report/weekly-review-analysis.ts
  └─ sector-rotation → src/modules/sector-rotation-workflow.ts
```

**Data layer** (all jobs write to D1 via `d1-job-storage.ts`):
- Job lifecycle: `startJobRun()` → `startJobStage()` / `endJobStage()` → `completeJobRun()`
- Run ID format: `${date}_${type}_${uuid}` (e.g. `2026-03-30_pre-market_abc123`)
- Reports stored in `scheduled_job_results` (append-only); latest pointer in `job_date_results`

**Analysis pipeline** (per-symbol, runs inside each job type):
```
News fetch (free_sentiment_pipeline.ts)       ← Finnhub → FMP → NewsAPI → Yahoo (waterfall)
  └─ performDualAIComparison()                ← dual-ai-analysis.ts, runs both models in parallel
       ├─ Primary: circuit breaker → retryAIcall(max 2) → env.AI.run(gpt-oss-120b)
       ├─ Mate:    circuit breaker → retryAIcall(max 2) → env.AI.run(deepseek-r1-32b)
       ├─ checkAgreement() → generateSignal()  ← agree/partial/disagree → action (BUY/SELL/HOLD/SKIP)
       └─ writeSymbolPredictionToD1()          ← pre-market-data-bridge.ts stores to symbol_predictions
```

**Failure propagation**: News providers fail silently (waterfall to next). AI model failure → `confidence: null` → signal filtered out by `usableSignals` check in `scheduler.ts`. If all symbols produce null confidence → `usableSignals === 0` → `analysisResult = null` → job marked failed at `ai_analysis` stage. Circuit breaker opens after 3 failures → subsequent symbols skip that model entirely (60s timeout).

**Storage layers**:
- **D1** (`PREDICT_JOBS_DB`) — Source of truth for all job results, reports, predictions, settings
- **KV** (`MARKET_ANALYSIS_CACHE`) — Articles content storage only (legacy binding kept for health checks)
- **Durable Object** (`CACHE_DO`) — Read-through cache only (<1ms, ephemeral). Not for persistent data

> After dead code audit (2026-03-30): 65 unreachable files (~26K lines) removed. `src/modules/` now has ~90 files, all reachable from entry points. Active execution path: index.ts → enhanced-request-handler.ts → handlers/ + routes/ → report/ + d1-job-storage.ts + dual-ai-analysis.ts.

---

## System Overview

**URL**: https://tft-trading-system.yanggf.workers.dev | **Version**: v3.10.25 | **Status**: Production Ready

- Dual AI: GPT-OSS 120B (reasoning) + DeepSeek-R1 32B (reasoning)
- 4-Moment workflow: Pre-Market → Intraday → End-of-Day → Weekly
- DO cache (<1ms read-through, ephemeral), D1 as source of truth, multi-run job history with `?run_id=`
- Pre-market reports show all analyzed symbols with `high_confidence_count` field

---

## Auth & Security

- **Frontend**: `public/js/config.js` sets `window.CCT_API_KEY`
- **cctApi**: Attaches `X-API-Key` header to all requests (`public/js/cct-api.js`)
- **Server**: Validates via `X_API_KEY` secret; IP rate limiting active
- **Running job protection**: Server blocks deleting `status: 'running'` jobs

## Testing API

- **Shell env var**: `$X_API_KEY` is pre-set — always use it directly, never scrape from frontend config
- **Header**: `X-API-Key` (hyphen) - both `X-API-Key` and `X_API_KEY` work
- **Example**: `curl -H "X-API-Key: $(printf '%s' "$X_API_KEY" | tr -d '\r\n')" https://tft-trading-system.yanggf.workers.dev/api/v1/...`

---

## AI Models

| Model | ID | Note |
|-------|-----|------|
| Primary | `@cf/openai/gpt-oss-120b` | GPT-OSS 120B with `reasoning: { effort: 'high' }` |
| Secondary (Mate) | `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | DeepSeek-R1 32B reasoning model |

- **Config**: `AI_MODEL_DISPLAY` in `src/modules/config.ts` (backend), `CCT_MODELS` in `public/js/config.js` (frontend)
- **Model-agnostic naming**: Code uses `primary`/`mate` (not model-specific names)
- **D1 columns**: `primary_*` and `mate_*` with aliasing layer for backward compat
- **Legacy field names**: `gpt`/`gemma` (primary) and `distilbert` (mate) supported via fallbacks
- On failure: `status: 'failed', confidence: null` - no fake data
- **Circuit breaker**: Per-model (`ai-model-primary`, `ai-model-mate`), threshold=3, wraps retry logic so retries count as one attempt
- **Retry**: Max 2 attempts per AI call; skips retry on circuit breaker and subrequest limit errors
- **End-of-day lineage**: `pre_market_run_id` and `intraday_run_id` in report body + `_d1_metadata`
- **End-of-day signal breakdown**: Per-symbol `primary_confidence`, `mate_confidence`, `primary_reasoning`, `mate_reasoning`, `action`, `signal_reasoning`, `articles_count`
- **End-of-day market data**: Yahoo Finance close prices cached in `market_close_data` table; reruns use cached data
- **EOD date handling**: `generateEndOfDayAnalysis()` accepts `targetDate` param (ET timezone) to avoid UTC/ET mismatch

---

## News Sources (priority order)

1. **Finnhub** (60/min) - Primary, finance-focused
2. **FMP** (300/day) - Has built-in sentiment
3. **NewsAPI** (1000/day) - Broader coverage
4. **Yahoo** - Backup, no API key needed
5. **Weekend Cache** - D1-backed fallback for Monday morning

### News Fetch Diagnostics

When all providers fail, query the `news_fetch_log` table:
```sql
SELECT symbol, fetch_date, finnhub_status, finnhub_error, fmp_status, yahoo_status 
FROM news_fetch_log WHERE total_articles = 0 ORDER BY fetch_date DESC;
```

---

## API v1 (Self-documenting at `/api/v1`)

Full endpoint list: `GET /api/v1` (live) or see route files in `src/routes/`. Key groups: jobs, reports, sentiment, data, sector-rotation, market-intelligence, analytics, portfolio, ops.

### Job Trigger API

```bash
POST /api/v1/jobs/trigger
Header: X-API-Key
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `triggerMode` | string | **Required**. One of: `morning_prediction_alerts`, `midday_validation_prediction`, `next_day_market_prediction`, `weekly_review_analysis`, `sector_rotation_refresh` |
| `scheduledDate` | string | Optional. `YYYY-MM-DD` to override target date (for reruns) |

**Trigger mode → job type mapping:**

| triggerMode | Job Type | UTC Time |
|-------------|----------|----------|
| `morning_prediction_alerts` | pre-market | 12:30 |
| `midday_validation_prediction` | intraday | 16:00 |
| `next_day_market_prediction` | end-of-day | 20:05 |
| `weekly_review_analysis` | weekly | 14:00 Sun |
| `sector_rotation_refresh` | sector-rotation | 13:30 |

**Example:**
```bash
curl -X POST "https://tft-trading-system.yanggf.workers.dev/api/v1/jobs/trigger" \
  -H "X-API-Key: $(printf '%s' "$X_API_KEY" | tr -d '\r\n')" \
  -H "Content-Type: application/json" \
  -d '{"triggerMode": "next_day_market_prediction", "scheduledDate": "2026-02-03"}'
```

---

## D1 Schema (v2.8)

**Full schema**: `schema/current-schema.sql` (dumped from D1, 14 tables, 34 indexes)

| Table | Purpose |
|-------|---------|
| `job_executions` | Cron execution history |
| `job_date_results` | Nav summary, `latest_run_id` |
| `job_run_results` | Run history, `run_id`, `status`, `trigger_source` |
| `job_stage_log` | Per-stage timeline with outcomes |
| `scheduled_job_results` | Report content (append-only) |
| `symbol_predictions` | Per-symbol dual model data (**actual columns**: `gemma_*` = primary, `distilbert_*` = mate) |
| `daily_analysis` | Daily analysis summaries |
| `market_close_data` | Yahoo Finance close prices cached by date (EOD rerun support) |
| `news_fetch_log` | Per-provider fetch diagnostics |
| `weekend_news_cache` | Friday→Monday article cache |
| `news_provider_failures` | Provider error tracking |
| `news_cache_stats` | Cache hit/miss statistics |
| `report_snapshots` | Report content snapshots |
| `settings` | Key-value settings |

**Key**: `scheduled_date` is lookup key only. `run_id`: `${date}_${type}_${uuid}`

**Column name aliasing**: D1 has legacy column names (`gemma_*`, `distilbert_*`) for dual model data. Code aliases these to `primary_*`/`mate_*` via `extractDualModelData()` in `src/modules/data.ts`.

### Market Close Data Cache

EOD jobs cache Yahoo Finance data in `market_close_data` on first fetch. Reruns use cached data to ensure consistent accuracy calculations.

```sql
-- Check cached market data for a date
SELECT symbol, close_price, day_change, fetch_status FROM market_close_data WHERE close_date = '2026-02-03';

-- Clear cache to force refetch (use sparingly)
DELETE FROM market_close_data WHERE close_date = '2026-02-03';
```

### Applying Migrations

`schema/current-schema.sql` is the source of truth for table/index state. Apply new migrations via:

```bash
unset CLOUDFLARE_API_TOKEN && npx wrangler d1 execute cct-predict-jobs --remote --file=schema/migrations/<file>.sql
```

### D1 Cleanup Recipes

<details><summary>Fresh Start (delete all data)</summary>

```sql
DELETE FROM job_executions; DELETE FROM symbol_predictions; DELETE FROM daily_analysis;
DELETE FROM job_date_results; DELETE FROM job_run_results; DELETE FROM job_stage_log;
DELETE FROM scheduled_job_results; DELETE FROM market_close_data;
DELETE FROM news_provider_failures; DELETE FROM news_cache_stats;
DELETE FROM weekend_news_cache; DELETE FROM news_fetch_log;
```
</details>

<details><summary>Keep Pre-Market for EOD Testing (replace DATE with YYYY-MM-DD)</summary>

```sql
DELETE FROM scheduled_job_results WHERE NOT (scheduled_date = 'DATE' AND report_type = 'pre-market');
DELETE FROM job_run_results WHERE run_id NOT LIKE 'DATE_pre-market_%';
DELETE FROM job_stage_log WHERE run_id NOT LIKE 'DATE_pre-market_%';
DELETE FROM job_date_results WHERE scheduled_date != 'DATE';
DELETE FROM symbol_predictions WHERE prediction_date != 'DATE';
DELETE FROM daily_analysis WHERE analysis_date != 'DATE';
DELETE FROM job_executions; DELETE FROM market_close_data;
```
</details>

---

## Key Files

- `src/modules/cache-durable-object.ts` - DO cache
- `src/modules/config.ts` - Centralized config
- `src/modules/circuit-breaker.ts` - Circuit breaker pattern for external API protection
- `src/modules/d1-job-storage.ts` - D1 queries, `checkScheduledRuns()`
- `src/modules/dual-ai-analysis.ts` - Dual AI sentiment analysis with circuit breaker + retry
- `src/modules/free_sentiment_pipeline.ts` - News fetching with diagnostics
- `src/modules/enhanced-sentiment-pipeline.ts` - DAC articles pool priority pipeline with quality metrics
- `src/modules/report/end-of-day-analysis.ts` - End-of-day analysis with enriched signal breakdown
- `src/routes/jobs-routes.ts` - Job triggers/history/schedule-check
- `src/routes/api-v1.ts` - API gateway
- `src/routes/sentiment-routes.ts` - Sentiment endpoints incl. fine-grained and enhanced
- `src/routes/data-routes.ts` - Data endpoints incl. cache-clear
- `public/js/cct-api.js` - Frontend API client
- `schema/current-schema.sql` - D1 schema dump (tables + indexes)
- `schema/migrations/` - Applied D1 migrations

---

## GitHub Actions Scheduling

- **Exclusive scheduler**: GitHub Actions only (Cloudflare cron disabled via `crons = []` in wrangler.toml)
- Cron triggers: pre-market (12:30 UTC), intraday (16:00 UTC), end-of-day (20:05 UTC), weekly (14:00 UTC Sun)
- Detection uses `github.event.schedule` cron matching (not time-window)
- Schedule compliance: `GET /api/v1/jobs/schedule-check?date=YYYY-MM-DD` (requires API key)
- Workflow file: `.github/workflows/trading-system.yml`

---

## Deployment

**⚠️ ALWAYS ask for user approval before deploying.**

**⚠️ Wrangler uses OAuth (browser login), NOT API tokens. Unset CLOUDFLARE_API_TOKEN before running wrangler commands.**

```bash
# Standard (interactive)
npm run deploy

# Non-interactive (recommended)
npm run deploy -- --yes

# Frontend only
npm run deploy:frontend:only

# D1 migrations (user must run manually)
npx wrangler d1 execute cct-predict-jobs --remote --file=schema/migrations/<migration>.sql

# Staging (uses separate D1 database: cct-predict-jobs-staging)
npm run deploy:staging

# Rollback DO cache
wrangler secret put FEATURE_FLAG_DO_CACHE  # Enter: false
```

---

## Known Issues & TODOs

### Workers Subrequest Limit (50/invocation)

Cloudflare Workers free/bundled plan allows **50 subrequests per invocation**. Each `fetch()` to an external URL and each `env.AI.run()` call counts as one subrequest. D1 queries and KV reads do **not** count.

**Root cause (fixed 2026-03-24)**: RTDM warmup (`warmCachesForMarketOpen` + `refreshAll`) was consuming ~30 subrequests before analysis started, leaving only ~20 for AI model calls. With 5 symbols × 2 models = 10 subrequests minimum, plus news fetches, the limit was hit mid-analysis, causing GOOGL/TSLA to fail with `"Too many subrequests"` → all signals returned `null` confidence → `usableSignals = 0` → job failed.

**Fix**: RTDM warmup disabled for all job types in `src/modules/scheduler.ts`. Analysis modules fetch their own data independently and do not use the RTDM-populated DO cache.

### EOD Pipeline — By-Design Behaviors

- **Failed fetch caching is permanent** — prevents repeated API failures on reruns.
- **Confidence threshold**: 0.70 (0-1 space) = 70 (0-100 space), normalized internally.
- **Neutrals excluded** from accuracy metrics.
- **Binary up/down**: exact 0.0% treated as "down" (no deadband).

### Job Stage Tracking

- `current_stage` in `job_run_results` reflects where the job actually failed.
- `/api/v1/data/system-status` model health uses `test_type: 'ping'` — connectivity only, not a full reasoning pipeline test.

### Schema Refresh
```bash
# Dump current D1 schema (tables + indexes) to file after applying migrations
unset CLOUDFLARE_API_TOKEN && npx wrangler d1 execute cct-predict-jobs --remote \
  --command "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type DESC, name" \
  | jq -r '.[] .results[] .sql' > schema/current-schema.sql
```

---

## Performance Targets

- API: <15ms cached, <500ms uncached
- Cache hit: >70%
- Analysis: <30s for 5 symbols

---

**Last Updated**: 2026-04-08 (added analysis pipeline flow, failure propagation docs; trimmed self-documenting API table; collapsed cleanup recipes)
