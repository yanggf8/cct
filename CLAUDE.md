# CLAUDE.md

Guidance for Claude Code when working with this repository.

## System Overview

**Production URL**: https://tft-trading-system.yanggf.workers.dev
**Version**: v3.10.18 | **Test Coverage**: 93% | **Status**: Production Ready

**Core Features**:
- Dual AI sentiment analysis (Gemma Sea Lion 27B + DistilBERT-SST-2)
- 4-Moment workflow: Pre-Market → Intraday → End-of-Day → Weekly
- Market Pulse: SPY sentiment via Finnhub pipeline (unified with other symbols)
- Multi-run job history with `?run_id=` access
- Durable Objects cache (<1ms), zero KV operations

---

## Security Policy (No Auth Phase)

**Decision Date**: 2026-01-29

All endpoints are currently public until real login/auth is implemented:
- All `/api/v1/jobs/*` endpoints public (api-auth-middleware.ts:21-23)
- Settings endpoints public
- IP rate limiting active (api-security.ts:440-447)

---

## AI Model Policy

| Model | ID | Use |
|-------|-----|-----|
| Primary | `@cf/aisingapore/gemma-sea-lion-v4-27b-it` | Contextual analysis |
| Secondary | `@cf/huggingface/distilbert-sst-2-int8` | Fast classification |
| **DEPRECATED** | `@cf/openchat/openchat-3.5-0106` | DO NOT USE |

**Rules**:
- Sequential processing with 2-3s delays between symbols
- On failure: return `status: 'failed', confidence: null` - no fake data
- API key via `X_API_KEY` env variable - never hardcode

---

## API v1 Architecture

Self-documenting at `/api/v1`. Key endpoint groups:

| Group | Count | Key Endpoints |
|-------|-------|---------------|
| **Jobs** (PUBLIC) | 7 | `POST /jobs/pre-market`, `GET /jobs/runs`, `DELETE /jobs/runs/:runId`, `POST /jobs/runs/batch-delete` |
| **Reports** | 8 | `GET /reports/pre-market`, `/intraday`, `/end-of-day`, `/status` |
| **Sentiment** | 4 | `GET /sentiment/analysis`, `/market`, `/sectors` |
| **Market Drivers** | 9 | `GET /market-drivers/snapshot`, `/regime`, `/macro` |
| **Data** | 10 | `GET /data/health`, `/symbols`, `/system-status` |
| **Cache** | 7 | `GET /cache/health`, `/metrics` |

**Frontend Client**: `public/js/cct-api.js` - singleton `cctApi` with retry logic

---

## D1 Schema (v2.4)

**Report types**: `pre-market`, `intraday`, `end-of-day`, `weekly`, `sector-rotation`

| Table | Purpose |
|-------|---------|
| `job_date_results` | Navigation summary (1 row per date/type), `latest_run_id` |
| `job_run_results` | Run history (multiple per date), `run_id`, `status`, `trigger_source` |
| `job_stage_log` | Stage timeline per run |
| `scheduled_job_results` | Report content snapshots (append-only) |
| `symbol_predictions` | Per-symbol analysis with dual model data |

**Data flow**:
```
Trigger → startJobRun() → job_run_results + job_date_results
    → Analysis → symbol_predictions
    → completeJobRun() → scheduled_job_results
    → Report page: ?run_id= for specific run
```

**Key contracts**:
- `scheduled_date` is a lookup key only - no reinterpretation
- `run_id` format: `${date}_${type}_${uuid}`
- Upsert: `INSERT...ON CONFLICT DO UPDATE`

---

## Key Files

**Core Modules**:
- `src/modules/cache-durable-object.ts` - DO persistent cache
- `src/modules/pre-market-data-bridge.ts` - Pre-market integration
- `src/modules/config.ts` - Centralized configuration
- `src/modules/market-drivers-replacement.ts` - Market drivers (DO-backed)

**Routes**:
- `src/routes/report-routes.ts` - Report endpoints
- `src/routes/jobs-routes.ts` - Job triggers and history
- `src/routes/api-v1.ts` - API v1 gateway

**Tests** (51 scripts in `tests/` and `scripts/`):
- `tests/integration/dac/test-dac-service-binding-comprehensive.sh` - Primary DAC test
- `tests/regression/run-regression-tests.sh` - 5% threshold enforcement

---

## Development Guidelines

**Code Standards**:
- TypeScript for all new modules
- Centralized config in `src/modules/config.ts`
- Feature flag: `FEATURE_FLAG_DO_CACHE`

**Performance Targets**:
- API: <15ms cached, <500ms uncached
- Cache hit rate: >70%
- Analysis: <30s for 5-symbol batch

**News Sources** (priority order):
1. Finnhub (primary) - 60 calls/min
2. FMP - 300/day
3. NewsAPI - 1000/day
4. Yahoo - no key needed

---

## Deployment

### Approval Required
**ALWAYS ask for user approval before deploying.**

1. Complete code changes
2. Run `npm run build`
3. Present summary to user
4. **WAIT for explicit approval**
5. Then deploy

### Deploy Commands
```bash
# Standard deployment (requires user auth)
env -u CLOUDFLARE_API_TOKEN npx wrangler deploy

# Full deployment
npm run deploy

# Frontend only (fastest for UI)
npm run deploy:frontend:only
```

### Validation
```bash
./tests/integration/dac/test-dac-service-binding-comprehensive.sh
./tests/integration/data-bridge/test-pre-market-data-bridge.sh
```

### Rollback
```bash
wrangler secret put FEATURE_FLAG_DO_CACHE
# Enter: false
```

---

## Test Commands

```bash
npm run test:performance     # Playwright performance
npm run test:workflows       # E2E workflows
./tests/integration/dac/test-dac-service-binding-comprehensive.sh
./scripts/monitoring/test-cache-economics.sh
```

---

**Last Updated**: 2026-01-31
