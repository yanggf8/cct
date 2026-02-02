# API Documentation

## Overview
This document is a high-level map of the API surface for the CCT Cloudflare Worker. The complete and current list of endpoints lives in the route modules under `src/routes/` and at the API root response `/api/v1`.

## Base URL
The API base depends on your deployment. For local dev via Wrangler:
- `http://localhost:8787/api/v1`

For deployed environments, use the Worker hostname configured by Wrangler.

## Authentication
- If `X_API_KEY` is configured, non-public `/api/v1/*` endpoints require `X-API-Key`.

Public endpoints always available:
- `/health`
- `/model-health`
- `/api/v1/data/health`
- `/api/v1/reports/status`
- `/api/v1/jobs/history`
- `/api/v1/jobs/runs`

Frontend usage is centralized in `public/js/cct-api.js`:
- Key lookup order: `sessionStorage.cct_api_key` → `localStorage.cct_api_key` → `window.CCT_API_KEY`

## Route Groups
Each group is implemented in `src/routes/*.ts`:
- Sentiment: `/api/v1/sentiment/*`
- Reports: `/api/v1/reports/*`
- Data: `/api/v1/data/*`
- Jobs: `/api/v1/jobs/*`
- Sector rotation: `/api/v1/sector-rotation/*`
- Sectors: `/api/v1/sectors/*`
- Market drivers: `/api/v1/market-drivers/*`
- Market intelligence: `/api/v1/market-intelligence/*`
- Predictive analytics: `/api/v1/predictive/*`
- Technical analysis: `/api/v1/technical/*`
- Advanced analytics: `/api/v1/analytics/*`
- Realtime: `/api/v1/realtime/*`
- Backtesting: `/api/v1/backtesting/*`
- Portfolio: `/api/v1/portfolio/*`
- Risk management: `/api/v1/risk/*`
- Cache: `/api/v1/cache/*`
- Production guards: `/api/v1/guards/*`

## Example Requests
```bash
# Health
curl http://localhost:8787/health

# API root (documents available endpoints)
curl http://localhost:8787/api/v1

# Authenticated request (when X_API_KEY is configured)
curl -H "X-API-Key: $X_API_KEY" http://localhost:8787/api/v1/sentiment/analysis
```

## Related Docs
- `docs/INDEX.md`
- `docs/guides/USER_GUIDE.md`
- `docs/guides/DEPLOYMENT_GUIDE.md`
- `docs/guides/MAINTENANCE_GUIDE.md`

**Last Updated**: 2026-02-02
