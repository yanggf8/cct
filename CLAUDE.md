# CLAUDE.md

## System Overview

**URL**: https://tft-trading-system.yanggf.workers.dev | **Version**: v3.10.25 | **Status**: Production Ready

- Dual AI: GPT-OSS 120B (reasoning) + DeepSeek-R1 32B (reasoning)
- 4-Moment workflow: Pre-Market → Intraday → End-of-Day → Weekly
- Durable Objects cache (<1ms), multi-run job history with `?run_id=`
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

| Group | Key Endpoints |
|-------|---------------|
| **Jobs** | `POST /jobs/pre-market`, `GET /jobs/runs` (public), `GET /jobs/runs/:runId/stages` (public), `GET /jobs/schedule-check` (protected), `DELETE /jobs/runs/:runId` |
| **Reports** | `GET /reports/pre-market`, `GET /reports/intraday?date=YYYY-MM-DD`, `GET /reports/intraday?run_id=...`, `GET /reports/end-of-day`, `GET /reports/status` |
| **Sentiment** | `GET /sentiment/analysis`, `/market` |
| **Data** | `GET /data/health`, `/symbols`, `/system-status`, `POST /data/cache-clear` |

---

## D1 Schema (v2.8)

| Table | Purpose |
|-------|---------|
| `job_executions` | Cron execution history |
| `job_date_results` | Nav summary, `latest_run_id` |
| `job_run_results` | Run history, `run_id`, `status`, `trigger_source` |
| `job_stage_log` | Per-stage timeline with outcomes |
| `scheduled_job_results` | Report content (append-only) |
| `symbol_predictions` | Per-symbol dual model data (`primary_*`/`mate_*` columns) |
| `daily_analysis` | Daily analysis summaries |
| `market_close_data` | Yahoo Finance close prices cached by date (EOD rerun support) |
| `news_fetch_log` | Per-provider fetch diagnostics |
| `weekend_news_cache` | Friday→Monday article cache |
| `news_provider_failures` | Provider error tracking |
| `news_cache_stats` | Cache hit/miss statistics |

**Key**: `scheduled_date` is lookup key only. `run_id`: `${date}_${type}_${uuid}`

### Market Close Data Cache

EOD jobs cache Yahoo Finance data in `market_close_data` on first fetch. Reruns use cached data to ensure consistent accuracy calculations.

```sql
-- Check cached market data for a date
SELECT symbol, close_price, day_change, fetch_status FROM market_close_data WHERE close_date = '2026-02-03';

-- Clear cache to force refetch (use sparingly)
DELETE FROM market_close_data WHERE close_date = '2026-02-03';
```

**Migration**: `wrangler d1 migrations apply cct-predict-jobs --remote`

### D1 Cleanup (Fresh Start)
```sql
DELETE FROM job_executions;
DELETE FROM symbol_predictions;
DELETE FROM daily_analysis;
DELETE FROM job_date_results;
DELETE FROM job_run_results;
DELETE FROM job_stage_log;
DELETE FROM scheduled_job_results;
DELETE FROM market_close_data;
DELETE FROM news_provider_failures;
DELETE FROM news_cache_stats;
DELETE FROM weekend_news_cache;
DELETE FROM news_fetch_log;
```

### D1 Cleanup (Keep Pre-Market for EOD Testing)
```sql
-- Keep specific pre-market run for EOD testing
-- Replace DATE and RUN_ID with actual values
DELETE FROM scheduled_job_results WHERE NOT (scheduled_date = 'DATE' AND report_type = 'pre-market');
DELETE FROM job_run_results WHERE run_id NOT LIKE 'DATE_pre-market_%';
DELETE FROM job_stage_log WHERE run_id NOT LIKE 'DATE_pre-market_%';
DELETE FROM job_date_results WHERE scheduled_date != 'DATE';
DELETE FROM symbol_predictions WHERE prediction_date != 'DATE';
DELETE FROM daily_analysis WHERE analysis_date != 'DATE';
DELETE FROM job_executions;
DELETE FROM market_close_data;
```

---

## Key Files

- `src/modules/cache-durable-object.ts` - DO cache
- `src/modules/config.ts` - Centralized config
- `src/modules/circuit-breaker.ts` - Circuit breaker pattern for external API protection
- `src/modules/d1-job-storage.ts` - D1 queries, `checkScheduledRuns()`
- `src/modules/dual-ai-analysis.ts` - Dual AI sentiment analysis with circuit breaker + retry
- `src/modules/free_sentiment_pipeline.ts` - News fetching with diagnostics
- `src/modules/report/end-of-day-analysis.ts` - End-of-day analysis with enriched signal breakdown
- `src/routes/jobs-routes.ts` - Job triggers/history/schedule-check
- `src/routes/api-v1.ts` - API gateway
- `src/routes/data-routes.ts` - Data endpoints incl. cache-clear
- `public/js/cct-api.js` - Frontend API client

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

# Rollback DO cache
wrangler secret put FEATURE_FLAG_DO_CACHE  # Enter: false
```

---

## Known Issues & TODOs

### EOD Calibration Pipeline

| Issue | Severity | Status |
|-------|----------|--------|
| ET/UTC date mismatch | Critical | Fixed - `targetDate` param added to `generateEndOfDayAnalysis()` |
| Holiday fallback miscalibration | Medium | Fixed - 10-day lookback + validation for no previous trading day |
| Pre-market link 404 | Medium | Fixed - `/pre-market-briefing?run_id=...` |
| Market pulse CSS injection | Medium | Fixed - mapped to fixed class names |
| Failed fetch caching permanent | Low | By design - prevents repeated API failures |
| Confidence threshold semantics | Low | OK - 0.70 (0-1 space) = 70 (0-100 space), normalized internally |
| Neutral handling | Low | By design - neutrals excluded from accuracy metrics |
| Binary up/down (no deadband) | Low | By design - exact 0.0% treated as "down" |

### Pending Migrations

- `schema/migrations/add-market-close-cache.sql` - Creates `market_close_data` table to cache Yahoo Finance close prices per symbol per date. Required for EOD rerun accuracy (Yahoo free API does not reliably serve historical data).
  ```bash
  npx wrangler d1 execute cct-predict-jobs --remote --file=schema/migrations/add-market-close-cache.sql
  ```

---

## Performance Targets

- API: <15ms cached, <500ms uncached
- Cache hit: >70%
- Analysis: <30s for 5 symbols

---

**Last Updated**: 2026-02-04
