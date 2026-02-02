# CCT - AI Trading Intelligence (Cloudflare Workers)

## Overview
CCT is a Cloudflare Workers codebase for AI-assisted market intelligence: sentiment analysis, report generation, dashboards, and operational tooling. The core worker lives in `src/`, Durable Objects are in `src/modules/`, and the public UI is in `public/`.

Key characteristics:
- Dual-model sentiment pipeline (primary GPT-OSS 120B, secondary DeepSeek-R1 32B)
- Durable Objects cache as the primary fast path
- D1-backed job storage for reports and runs (with KV fallback)
- Multi-run tracking across scheduled job types
- Polling-based dashboards (SSE disabled)

## Project Layout
- `src/` - Worker handlers and route modules
- `src/routes/` - API v1 route handlers by domain
- `src/modules/` - Durable Objects and shared services
- `public/` - Dashboard assets and static UI
- `docs/` - Guides, architecture notes, and references
- `tests/` - Playwright specs and test scripts
- `scripts/` - Operational and utility scripts

## API Quick Start
Base path for APIs is `/api/v1`. Route groups are organized by domain:
- Sentiment: `/api/v1/sentiment/*`
- Reports: `/api/v1/reports/*`
- Data: `/api/v1/data/*`
- Jobs: `/api/v1/jobs/*`
- Sector rotation: `/api/v1/sector-rotation/*` and `/api/v1/sectors/*`
- Market intelligence: `/api/v1/market-intelligence/*`
- Market drivers: `/api/v1/market-drivers/*`
- Predictive analytics: `/api/v1/predictive/*`
- Technical analysis: `/api/v1/technical/*`
- Advanced analytics: `/api/v1/analytics/*`
- Realtime: `/api/v1/realtime/*`
- Backtesting: `/api/v1/backtesting/*`
- Portfolio: `/api/v1/portfolio/*`
- Risk management: `/api/v1/risk/*`
- Cache: `/api/v1/cache/*`
- Production guards: `/api/v1/guards/*`

For a complete list, see `src/routes/` and the API root response at `/api/v1`.

## Authentication
- If `X_API_KEY` is configured in the environment, non-public `/api/v1/*` endpoints require `X-API-Key`.
- Dashboards use `public/js/cct-api.js`, which looks for the key in `sessionStorage.cct_api_key`, then `localStorage.cct_api_key`, then `window.CCT_API_KEY`.
- Public endpoints include `/health`, `/model-health`, `/api/v1/data/health`, `/api/v1/reports/status`, `/api/v1/jobs/history`, and `/api/v1/jobs/runs`.

## Development
```bash
npm install
npm run dev
```

Deployment and testing:
- `npm run deploy`
- `npm run deploy:frontend` or `npm run deploy:frontend:only`
- `npm run test:playwright`
- `npm run test:performance` or `npm run test:workflows`

Wrangler auth uses OAuth for this repo:
```bash
unset CLOUDFLARE_API_TOKEN && npx wrangler <command>
```

## Documentation
Start with `docs/INDEX.md`, then follow the relevant guide:
- `docs/guides/USER_GUIDE.md`
- `docs/guides/DEPLOYMENT_GUIDE.md`
- `docs/guides/MAINTENANCE_GUIDE.md`
- `API_DOCUMENTATION.md`

## Data and Scheduling Notes
- `scheduled_job_results.scheduled_date` is a write-time tag; the frontend `?date=YYYY-MM-DD` is passed through verbatim.
- Multi-run tracking is used across job types with `startJobRun()` and `completeJobRun()`.
- Prediction job storage is in D1 (`job_executions`, `symbol_predictions`, `daily_analysis`) with KV fallback.

## Model Policy
- Primary model: `@cf/openai/gpt-oss-120b`
- Secondary model: `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`
- Deprecated: `@cf/openchat/openchat-3.5-0106`, `@cf/aisingapore/gemma-sea-lion-v4-27b-it`

**Last Updated**: 2026-02-02
