# CLAUDE.md

## System Overview

**URL**: https://tft-trading-system.yanggf.workers.dev | **Version**: v3.10.19 | **Status**: Production Ready

- Dual AI: Gemma Sea Lion 27B + DistilBERT-SST-2
- 4-Moment workflow: Pre-Market → Intraday → End-of-Day → Weekly
- Durable Objects cache (<1ms), multi-run job history with `?run_id=`

---

## Auth & Security

- **Frontend**: `public/js/config.js` sets `window.CCT_API_KEY`
- **cctApi**: Attaches `X-API-Key` header to all requests (`public/js/cct-api.js`)
- **Server**: Validates via `X_API_KEY` secret; IP rate limiting active
- **Running job protection**: Server blocks deleting `status: 'running'` jobs

---

## AI Models

| Model | ID | Note |
|-------|-----|------|
| Primary | `@cf/aisingapore/gemma-sea-lion-v4-27b-it` | Contextual analysis |
| Secondary | `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | Reasoning (SOTA) |
| ~~Deprecated~~ | `@cf/huggingface/distilbert-sst-2-int8` | Replaced by DeepSeek-R1 |

On failure: `status: 'failed', confidence: null` - no fake data.

---

## API v1 (Self-documenting at `/api/v1`)

| Group | Key Endpoints |
|-------|---------------|
| **Jobs** (PUBLIC) | `POST /jobs/pre-market`, `GET /jobs/runs`, `DELETE /jobs/runs/:runId` |
| **Reports** | `GET /reports/pre-market`, `/intraday`, `/end-of-day`, `/status` |
| **Sentiment** | `GET /sentiment/analysis`, `/market` |
| **Data** | `GET /data/health`, `/symbols`, `/system-status` |

---

## D1 Schema (v2.4)

| Table | Purpose |
|-------|---------|
| `job_date_results` | Nav summary, `latest_run_id` |
| `job_run_results` | Run history, `run_id`, `status`, `trigger_source` |
| `scheduled_job_results` | Report content (append-only) |
| `symbol_predictions` | Per-symbol dual model data |

**Key**: `scheduled_date` is lookup key only. `run_id`: `${date}_${type}_${uuid}`

---

## Key Files

- `src/modules/cache-durable-object.ts` - DO cache
- `src/modules/config.ts` - Centralized config
- `src/routes/jobs-routes.ts` - Job triggers/history
- `src/routes/api-v1.ts` - API gateway
- `public/js/cct-api.js` - Frontend API client

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

## News Sources (priority)

1. Finnhub (60/min) → 2. FMP (300/day) → 3. NewsAPI (1000/day) → 4. Yahoo

---

## Performance Targets

- API: <15ms cached, <500ms uncached
- Cache hit: >70%
- Analysis: <30s for 5 symbols

---

**Last Updated**: 2026-01-31
