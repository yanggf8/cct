# Security & Data Integrity Fixes

**Date**: 2026-01-31  
**Status**: ✅ Complete

## Issues Addressed

### 1. High: Hard-coded Finnhub Source Attribution

**Problem**: Market pulse always reported `source: 'Finnhub'` even when `getFreeStockNews()` fell back to FMP/NewsAPI/Yahoo, causing misattribution in monitoring/analytics.

**Fix**: Derive actual source from news articles' `source_type` field.

**Changes** (`src/modules/pre-market-data-bridge.ts`):
```typescript
// Derive actual source from news articles
const sourceTypes = new Set(spyNews.map(n => n.source_type).filter(Boolean));
const actualSource = sourceTypes.size === 1 
  ? Array.from(sourceTypes)[0]     // Single source: 'finnhub', 'fmp_with_sentiment', 'newsapi', 'yahoo'
  : sourceTypes.size > 1 
    ? 'mixed'                       // Multiple sources
    : 'unknown';                    // No source_type metadata
```

**Result**: Market pulse now accurately reports:
- `finnhub` - When Finnhub is used
- `fmp_with_sentiment` - When FMP fallback is used
- `newsapi` - When NewsAPI fallback is used
- `yahoo` - When Yahoo Finance fallback is used
- `mixed` - When multiple sources are combined
- `unknown` - When source metadata is missing

---

### 2. Medium: Dashboard Batch Delete Missing run_id Guard

**Problem**: Batch delete UI could include `undefined` run_ids in selection and submit them to API, causing errors.

**Fix**: Guard against missing/undefined run_ids in selection logic and disable checkboxes for invalid rows.

**Changes** (`public/dashboard.html`):

1. **Select All Function**:
```javascript
// Only select runs with valid run_id
jobRuns.forEach(run => {
  if (run.run_id && run.status !== 'running') {
    selectedRunIds.add(run.run_id);
  }
});

// Guard checkbox updates
document.querySelectorAll('.run-checkbox').forEach(cb => {
  const runId = cb.dataset.runId;
  if (runId && runId !== 'undefined') {
    cb.checked = selectedRunIds.has(runId);
  }
});
```

2. **Row Rendering**:
```javascript
const hasRunId = run.run_id && run.run_id !== 'undefined';
const isChecked = hasRunId && selectedRunIds.has(run.run_id);

// Disable checkbox and delete button for invalid run_ids
<input type="checkbox" ... ${!hasRunId || isRunning ? 'disabled' : ''} ...>
<button class="delete-btn" ... ${!hasRunId || isRunning ? 'disabled' : ''}>🗑️</button>
```

**Result**: 
- Checkboxes disabled for rows without valid run_id
- Delete buttons disabled for rows without valid run_id
- Select-all skips invalid rows
- No `undefined` values submitted to API

---

### 3. Medium: Batch Delete Endpoint Lacks Auth

**Problem**: Batch delete endpoint (`POST /api/v1/jobs/runs/batch-delete`) was publicly accessible despite being destructive (50 runs per call), increasing blast radius.

**Fix**: Added API key validation to both single and batch delete endpoints.

**Changes** (`src/routes/jobs-routes.ts`):

1. **Single Delete** (`handleDeleteJobRun`):
```typescript
async function handleDeleteJobRun(
  env: CloudflareEnvironment,
  runId: string,
  headers: Record<string, string>,
  requestId: string,
  timer: ProcessingTimer,
  request: Request  // Added parameter
): Promise<Response> {
  // Validate API key for destructive operation
  const auth = validateApiKey(request, env);
  if (!auth.valid) {
    return new Response(
      JSON.stringify(ApiResponseFactory.error('Unauthorized', 'UNAUTHORIZED', { requestId })),
      { status: HttpStatus.UNAUTHORIZED, headers }
    );
  }
  // ... rest of function
}
```

2. **Batch Delete** (`handleBatchDeleteJobRuns`):
```typescript
async function handleBatchDeleteJobRuns(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string,
  timer: ProcessingTimer
): Promise<Response> {
  // Validate API key for destructive batch operation
  const auth = validateApiKey(request, env);
  if (!auth.valid) {
    return new Response(
      JSON.stringify(ApiResponseFactory.error('Unauthorized', 'UNAUTHORIZED', { requestId })),
      { status: HttpStatus.UNAUTHORIZED, headers }
    );
  }
  // ... rest of function
}
```

**Result**:
- Both delete endpoints now require valid `X-API-Key` header
- Returns `401 Unauthorized` if key is missing or invalid
- Consistent with other protected endpoints
- Reduces destructive blast radius for unauthorized access

---

## Testing

```bash
# TypeScript validation
npm run typecheck  # ✅ Passes

# Test source attribution
curl -H "X-API-KEY: $X_API_KEY" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/reports/pre-market \
  | jq '.market_pulse.source'

# Test delete auth (should fail without key)
curl -X DELETE https://tft-trading-system.yanggf.workers.dev/api/v1/jobs/runs/test-run-id
# Expected: 401 Unauthorized

# Test delete auth (should work with key)
curl -X DELETE -H "X-API-KEY: $X_API_KEY" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/jobs/runs/test-run-id
```

---

## Security Impact

| Endpoint | Before | After |
|----------|--------|-------|
| `DELETE /api/v1/jobs/runs/:runId` | ⚠️ Public | ✅ Protected (API key required) |
| `POST /api/v1/jobs/runs/batch-delete` | ⚠️ Public | ✅ Protected (API key required) |

**Blast Radius Reduction**:
- Single delete: 1 run per call (now protected)
- Batch delete: Up to 50 runs per call (now protected)
- Unauthorized users can no longer delete job history

---

## Open Questions Resolved

1. **Source attribution**: Now accurately reports actual news source (finnhub/fmp/newsapi/yahoo/mixed/unknown)
2. **Batch delete auth**: Now gated with API key validation, consistent with security policy

---

**All Issues Fixed**: TypeScript passes, security hardened, data integrity improved.
