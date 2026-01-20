## Dual-Model Data Pipeline Fix Plan

### Objective
Fix all data pipelines to:
1) Record all Gemma and DistilBERT outcomes (success/failure) in D1.
2) Surface both models’ individual results in reports.
3) Show the combined/dual result (agreement status, final signal).

### Files to Modify
| File | Changes |
|------|---------|
| `src/modules/predict-jobs-db.ts` | Add dual-model columns to interfaces and save methods. |
| `src/modules/data.ts` | Add `extractDualModelData()` helper; update store functions to include dual fields. |
| `src/modules/handlers/briefing-handlers.ts` | Update signal cards to display both models and agreement. |
| `src/modules/handlers/intraday-handlers.ts` | Show morning predictions vs current for both models. |
| `src/modules/handlers/end-of-day-handlers.ts` | Include both models’ accuracy and agreement. |
| `src/modules/handlers/weekly-review-handlers.ts` | Aggregate weekly performance per model and agreement. |

### Implementation Plan

#### Phase 1: D1 Write Path Updates
1.1 `predict-jobs-db.ts`
- Extend `SymbolPrediction` with dual-model fields:
  - `gemma_status`, `gemma_error`, `gemma_confidence`, `gemma_response_time_ms`
  - `distilbert_status`, `distilbert_error`, `distilbert_confidence`, `distilbert_response_time_ms`
  - `model_selection_reason`
- Update `savePrediction()` and `savePredictionsBatch()` SQL to write these columns.

1.2 `data.ts`
- Add `extractDualModelData()` to normalize dual AI outputs:
  - Handle DualAIComparisonResult shape (`models.gpt`, `models.distilbert`).
  - Handle pre-market bridge shape (`dual_model.gemma`, `dual_model.distilbert`).
- Update `storeSymbolAnalysis()` and `batchStoreAnalysisResults()` to spread dual-model fields into stored records.

#### Phase 2: Report Handler Updates
2.1 `briefing-handlers.ts`
- `generateSignalCards()` should show:
  - Combined signal (direction + confidence) and agreement badge (AGREE/PARTIAL/DISAGREE).
  - Gemma card: status/direction/confidence/error.
  - DistilBERT card: status/direction/confidence/error.
- Add CSS for dual-model grid layout.

2.2 `intraday-handlers.ts`
- Show both models’ morning predictions vs current sentiment.
- Indicate which model(s) are on-track/diverged.

2.3 `end-of-day-handlers.ts`
- Show both models’ accuracy rates and agreement stats for the day.

2.4 `weekly-review-handlers.ts`
- Aggregate weekly performance per model and show reliability/agreements.

### UI Layout Notes
- Combined card: direction + confidence + agreement badge.
- Child cards: one per model; include status (success/failure), direction, confidence, and error if present.
- Failed models: show status/error and “N/A” for confidence/direction.

### Verification
1) D1 write validation:
```sql
SELECT symbol, gemma_status, gemma_confidence, distilbert_status, distilbert_confidence, model_selection_reason
FROM symbol_predictions
WHERE prediction_date = date('now')
LIMIT 5;
```
2) Pre-market briefing HTML: confirm both models, agreement badge, and errors displayed.
3) End-to-end run: trigger jobs, verify:
   - Failed models show error in report.
   - Agreement/disagreement computed correctly.
   - Combined signal reflects both models.

### Backward Compatibility
- Dual-model columns are already present in D1 (migration applied).
- Handlers must handle null/absent dual fields and display “N/A” gracefully.
- No breaking changes to existing APIs; reports add detail only.

### Optional Follow-ups
- Add unit tests for `extractDualModelData()`.
- Consider shared sentiment normalization and dual-model utilities.
- Document D1 field semantics (symbol_predictions dual-model fields) in API docs.
