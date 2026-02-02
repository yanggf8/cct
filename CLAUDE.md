# CLAUDE.md

## System Overview

**URL**: https://tft-trading-system.yanggf.workers.dev | **Version**: v3.10.22 | **Status**: Production Ready

- Dual AI: GPT-OSS 120B (reasoning) + DeepSeek-R1 32B (reasoning)
- 4-Moment workflow: Pre-Market → Intraday → End-of-Day → Weekly
- Durable Objects cache (<1ms), multi-run job history with `?run_id=`

---

## Auth & Security

- **Frontend**: `public/js/config.js` sets `window.CCT_API_KEY`
- **cctApi**: Attaches `X-API-Key` header to all requests (`public/js/cct-api.js`)
- **Server**: Validates via `X_API_KEY` secret; IP rate limiting active
- **Running job protection**: Server blocks deleting `status: 'running'` jobs

## Testing API

- **Header**: `X-API-Key` (hyphen) - both `X-API-Key` and `X_API_KEY` work
- **Example**: `curl -H "X-API-Key: $KEY" https://tft-trading-system.yanggf.workers.dev/api/v1/...`

---

## AI Models

| Model | ID | Note |
|-------|-----|------|
| Primary | `@cf/openai/gpt-oss-120b` | Native `reasoning: { effort: 'high' }`, paid ($0.35/$0.75 per M tokens) |
| Secondary | `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | `<think>` reasoning prompt, free tier |

- **Config**: `AI_MODEL_DISPLAY` in `src/modules/config.ts` (backend), `CCT_MODELS` in `public/js/config.js` (frontend)
- **Legacy field names**: `gpt` (primary) and `distilbert` (secondary) kept in D1/API for backward compat
- On failure: `status: 'failed', confidence: null` - no fake data

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
| **Data** | `GET /data/health`, `/symbols`, `/system-status` |

---

## D1 Schema (v2.6)

| Table | Purpose |
|-------|---------|
| `job_date_results` | Nav summary, `latest_run_id` |
| `job_run_results` | Run history, `run_id`, `status`, `trigger_source` |
| `job_stage_outcomes` | Per-stage timeline with outcomes |
| `scheduled_job_results` | Report content (append-only) |
| `symbol_predictions` | Per-symbol dual model data |
| `news_fetch_log` | Per-provider fetch diagnostics (NEW) |
| `weekend_news_cache` | Friday→Monday article cache (NEW) |

**Key**: `scheduled_date` is lookup key only. `run_id`: `${date}_${type}_${uuid}`

---

## Key Files

- `src/modules/cache-durable-object.ts` - DO cache
- `src/modules/config.ts` - Centralized config
- `src/modules/d1-job-storage.ts` - D1 queries, `checkScheduledRuns()`
- `src/modules/free_sentiment_pipeline.ts` - News fetching with diagnostics
- `src/routes/jobs-routes.ts` - Job triggers/history/schedule-check
- `src/routes/api-v1.ts` - API gateway
- `public/js/cct-api.js` - Frontend API client

---

## GitHub Actions Scheduling

- Cron triggers: pre-market (12:30 UTC), intraday (16:00 UTC), end-of-day (20:05 UTC), weekly (14:00 UTC Sun)
- Detection uses `github.event.schedule` cron matching (not time-window)
- Schedule compliance: `GET /api/v1/jobs/schedule-check?date=YYYY-MM-DD` (requires API key)
- Workflow file: `.github/workflows/trading-system.yml`

---

## Deployment

**⚠️ ALWAYS ask for user approval before deploying.**

```bash
# Standard (interactive)
npm run deploy

# Non-interactive (recommended)
npm run deploy -- --yes

# Frontend only
npm run deploy:frontend:only

# Rollback DO cache
wrangler secret put FEATURE_FLAG_DO_CACHE  # Enter: false
```

---

## Performance Targets

- API: <15ms cached, <500ms uncached
- Cache hit: >70%
- Analysis: <30s for 5 symbols

---

**Last Updated**: 2026-02-03
