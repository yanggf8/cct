# KV Cache Cleanup Policy (DO-First Architecture)

Status: Adopted (2025-11-01)
Owner: Platform / Caching

Overview
- We have migrated to a DO-first cache with graceful KV fallback. Legacy KV cache entries may still exist from previous versions and from rare fallbacks.
- This policy defines safe removal of legacy, date-stamped KV cache while preserving durable records.

Key Principles
- DO-first: All cache-oriented reads/writes route through the cache abstraction. KV is retained only for listing and durable records.
- Safety-first cleanup: Default to dry-run with explicit prefixes and a retention window.
- Guarded access: All cleanup operations require DIAGNOSTICS_ENABLED=true and a valid x-admin-key.

Cleanup Targets (default prefixes)
- analysis_*
- news_fmp_*
- granular_*

Retention Window
- Default: 14 days
- Only keys with recognizable dates older than retentionDays are considered for deletion.
- Undated keys are ignored by default (assumed durable).

How Cleanup Works
1) Helper: src/modules/kv-cleanup.ts
   - Lists keys by prefix using KV list
   - Parses dates from keys (YYYY-MM-DD at end or _YYYY-MM-DD_ in middle)
   - Filters keys older than retentionDays
   - Dry-run: returns counts and samples; Execute: deletes and returns results

2) Admin Endpoint (guarded)
   - POST /api/v1/data/kv-cleanup
   - Headers: x-admin-key=<ADMIN_KEY>
   - Requires: DIAGNOSTICS_ENABLED=true
   - Body:
     {
       "prefixes": ["analysis_", "news_fmp_"],
       "retentionDays": 14,
       "dryRun": true,
       "limitPerPrefix": 5000
     }

3) Nightly Dry-Run (recommended)
- Run at 03:00 UTC via GitHub Actions calling the admin endpoint.
- Keep DIAGNOSTICS_ENABLED=false by default; toggle to true during the job.
- Review logs; switch dryRun=false when comfortable.

Security
- DIAGNOSTICS_ENABLED defaults to "false" in wrangler config
- ADMIN_KEY must be set via wrangler secret put ADMIN_KEY
- All admin endpoints are 403 without valid key or when diagnostics are disabled

Rollback / Disable
- If an anomaly is detected, keep dry-run only and investigate prefixes and retention parameters.

Appendix: Related Endpoints
- GET /api/v1/data/cache-metrics (protected) → returns cache source and stats
- POST /api/v1/data/kv-cleanup (protected) → dry-run/execute cleanup

