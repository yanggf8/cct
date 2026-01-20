# Dual-Model Pipeline Implementation (2026-01-21)

## Overview
- Captures both Gemma and DistilBERT outcomes in D1, reports, and diagnostics so we can trace agreement, errors, and confidence per model.
- Completes the plan in `DUAL_MODEL_PIPELINE_PLAN.md` by wiring storage, report rendering, and health checks.

## What Changed
- **D1 writes**: `SymbolPrediction` now persists `gemma_status/error/confidence/response_time_ms`, `distilbert_status/error/confidence/response_time_ms`, and `model_selection_reason` in `predict-jobs-db.ts` save paths (single and batch).
- **Data extraction**: `data.ts` `extractDualModelData()` normalizes dual-model payloads (DualAIComparisonResult, pre-market bridge) and spreads them into D1 writes.
- **Report UI**:
  - `briefing-handlers.ts`, `intraday-handlers.ts`, `end-of-day-handlers.ts`, `weekly-review-handlers.ts` show combined signal plus per-model cards/badges with status, direction, confidence, and errors.
  - Agreement badge highlights AGREE/PARTIAL/DISAGREE.
- **Diagnostics**: `GET /api/v1/diagnostics/ai-models` returns circuit breaker health and recent D1 model stats.

## Backward Compatibility
- Null-safe rendering: reports fall back to “N/A” when a model is absent.
- Existing records without dual columns continue to render (dual fields optional in UI).
- Migration already applied; no schema changes required beyond dual-model columns.

## Verification
- TypeScript build passes after interface and SQL updates.
- Manual checks: pre-market reports render dual-model cards; diagnostics endpoint returns model health and recent counts.
- D1 inspection shows both model columns populated for new runs (`symbol_predictions`).

## Follow-Ups
- Consider extending symbol-level dual-model writes to non pre-market jobs (currently rely on `scheduled_job_results` JSON).
- Add unit tests for `extractDualModelData()` and agreement badge rendering.
