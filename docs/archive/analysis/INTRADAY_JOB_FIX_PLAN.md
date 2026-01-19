# Intraday Job Launch Failure - Fix Plan

## Issue Summary
**Root Cause**: Intraday jobs (`midday_validation_prediction`) are running pre-market analysis instead of intraday performance tracking due to missing handler in scheduler.

**Impact**: 
- Intraday reports show pre-market data instead of performance tracking
- D1 database stores wrong data type under `report_type = 'intraday'`
- Accuracy calculations are incorrect
- Users see stale/wrong data on intraday pages

## Technical Analysis

### Current Broken Flow
1. **GitHub Actions** → `POST /api/v1/jobs/trigger` with `triggerMode: 'midday_validation_prediction'`
2. **Scheduler** → `rtdm.refreshIncremental(ctx)` (correct RTDM warmup)
3. **Scheduler** → Falls through to `else` block (missing handler)
4. **Scheduler** → Runs `runEnhancedPreMarketAnalysis()` (WRONG - should be intraday)
5. **Scheduler** → Stores pre-market data with `report_type = 'intraday'` (wrong labeling)
6. **Intraday handlers** → Read wrong data shape from D1 (fails to render correctly)

### Code Locations
- **Problem**: `src/modules/scheduler.ts:150-230`
- **RTDM**: Line 160 - `await rtdm.refreshIncremental(ctx)` (correct)
- **Missing Handler**: Lines 219-230 - Falls through to `else` block
- **D1 Mapping**: Lines 274-282 - `reportTypeMap` maps `midday_validation_prediction → 'intraday'`

### Data Shape Mismatch
**Current (Wrong)**: Pre-market analysis data
```typescript
{
  symbols_analyzed: string[],           // Array of symbol strings
  trading_signals: Record<string, any>, // Detailed trading signals
  pre_market_analysis: { ... },         // Pre-market metadata
  // ... other pre-market fields
}
```

**Required (Correct)**: Intraday analysis data
```typescript
{
  timestamp: string;
  market_status: 'open' | 'closed';
  symbols: IntradayPerformance[];       // Array of objects with symbol details
  overall_accuracy: number;
  on_track_count: number;
  diverged_count: number;
  total_symbols: number;
}
```

## Fix Implementation

### 1. Add Intraday Handler to Scheduler
**File**: `src/modules/scheduler.ts`

**Location**: Between `sector_rotation_refresh` handler and `else` block (around line 219)

**Code to Add**:
```typescript
} else if (triggerMode === 'midday_validation_prediction') {
  // Intraday Performance Check
  console.log(`📊 [CRON-INTRADAY] ${cronExecutionId} Generating intraday analysis`);
  
  const { IntradayDataBridge } = await import('./intraday-data-bridge.js');
  const bridge = new IntradayDataBridge(env);
  const intradayResult = await bridge.generateIntradayAnalysis();
  
  // Transform to scheduler expected shape
  analysisResult = {
    ...intradayResult,
    symbols_analyzed: intradayResult.symbols.map(s => s.symbol), // Extract symbols
    timestamp: intradayResult.timestamp,
    trigger_mode: triggerMode
  };
  
  console.log(`✅ [CRON-INTRADAY] ${cronExecutionId} Intraday analysis completed`);
  
  // Facebook messaging has been migrated to Chrome web notifications
  console.log(`📱 [CRON-FB] ${cronExecutionId} Facebook messaging disabled - using web notifications instead`);
```

### 2. Import Update (if needed)
**File**: `src/modules/scheduler.ts`

**Current imports** (lines 1-10):
```typescript
import { runPreMarketAnalysis, runWeeklyMarketCloseAnalysis } from './analysis.js';
import { runEnhancedAnalysis, runEnhancedPreMarketAnalysis } from './enhanced_analysis.js';
import { generateWeeklyReviewAnalysis } from './report/weekly-review-analysis.js';
import { performSectorRotationAnalysis } from './sector-rotation-workflow.js';
// ... other imports
```

**No import needed**: Using dynamic import `await import('./intraday-data-bridge.js')` to avoid circular dependencies.

### 3. D1 Storage Compatibility
**Already Correct**:
- `reportTypeMap` already maps `midday_validation_prediction → 'intraday'`
- `writeD1JobResult` accepts `any` type for `reportContent`
- Intraday handlers expect `IntradayAnalysisData` shape (matches `IntradayDataBridge` output)

**No changes needed** to D1 storage logic.

## Testing Plan

### 1. Manual Trigger Test
```bash
# Trigger intraday job manually
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your-api-key" \
  -d '{"triggerMode": "midday_validation_prediction"}' \
  https://tft-trading-system.yanggf.workers.dev/api/v1/jobs/trigger
```

**Expected Logs**:
```
📊 [CRON-INTRADAY] {cronExecutionId} Generating intraday analysis
✅ [CRON-INTRADAY] {cronExecutionId} Intraday analysis completed
```

**NOT Expected**:
```
🚀 [CRON-ENHANCED] {cronExecutionId} Running enhanced analysis with sentiment...
```

### 2. D1 Data Verification
```sql
-- Check D1 data
SELECT report_type, json_extract(report_content, '$.symbols[0].symbol') as first_symbol,
       json_extract(report_content, '$.overall_accuracy') as accuracy
FROM scheduled_job_results 
WHERE execution_date = DATE('now') 
  AND report_type = 'intraday'
ORDER BY created_at DESC LIMIT 1;
```

**Expected**: Returns intraday data with `symbols` array and `overall_accuracy`

**NOT Expected**: Returns pre-market data with `trading_signals` and `pre_market_analysis`

### 3. Frontend Verification
1. Navigate to `/intraday-check` or `/intraday-check?tz=Asia/Taipei`
2. Verify page shows intraday performance tracking (not pre-market analysis)
3. Check for:
   - Model health status (On Track/Divergence/Off Track)
   - Live accuracy percentage
   - Divergence tracking table
   - On-track signals table

### 4. GitHub Actions Test
1. Wait for scheduled intraday run (12:00 PM ET / 16:00 UTC)
2. Check GitHub Actions logs for correct branch execution
3. Verify Teams notification shows intraday analysis

## Rollback Plan

### If Fix Causes Issues:
1. **Revert scheduler changes** to original state
2. **Temporary workaround**: Update GitHub Actions to call direct intraday endpoint:
   ```yaml
   # In .github/workflows/trading-system.yml
   elif [[ "$CURRENT_TIME" >= "15:45" && "$CURRENT_TIME" <= "16:15" ]]; then
     echo "analysis_type=intraday" >> $GITHUB_OUTPUT
     echo "endpoint=/api/v1/jobs/intraday" >> $GITHUB_OUTPUT  # Changed from /trigger
     echo "description=Intraday Performance Check - Real-time tracking"
   ```

## Success Criteria

### Primary (Must Have)
- [ ] Intraday jobs run `IntradayDataBridge.generateIntradayAnalysis()` not `runEnhancedPreMarketAnalysis()`
- [ ] D1 stores correct intraday data shape under `report_type = 'intraday'`
- [ ] `/intraday-check` page shows intraday performance tracking
- [ ] No regression in pre-market or end-of-day jobs

### Secondary (Should Have)
- [ ] Logs show correct intraday branch execution
- [ ] GitHub Actions intraday schedule works correctly
- [ ] Teams notifications show intraday analysis results

### Tertiary (Nice to Have)
- [ ] Update API documentation to note intraday job behavior
- [ ] Add intraday-specific error handling in scheduler

## Timeline

### Phase 1: Implementation (15 minutes)
1. Apply scheduler fix
2. Test manual trigger
3. Verify D1 data

### Phase 2: Validation (30 minutes)
1. Test frontend intraday page
2. Verify all job types still work
3. Run build and type checks

### Phase 3: Deployment (5 minutes)
1. Deploy to staging
2. Final verification
3. Deploy to production

### Phase 4: Monitoring (24 hours)
1. Monitor next scheduled intraday run
2. Check error logs
3. Verify Teams notifications

## Dependencies

### Required
- `IntradayDataBridge` class must be functional (confirmed working)
- D1 `scheduled_job_results` table must exist (confirmed exists)
- RTDM `refreshIncremental` must work (confirmed working)

### Optional
- No documentation updates required (but recommended)
- No GitHub Actions changes required

## Risk Assessment

### Low Risk
- Fix only adds new code path, doesn't modify existing logic
- Uses existing `IntradayDataBridge` class (already tested)
- Dynamic import avoids circular dependencies
- Rollback is simple revert

### Medium Risk
- Data shape transformation could have edge cases
- Scheduler error handling needs verification

### Mitigations
- Thorough testing of transformation logic
- Add try-catch around intraday branch
- Monitor error logs after deployment

## Implementation Notes

1. **Keep existing RTDM warmup** - already correct (`rtdm.refreshIncremental(ctx)`)
2. **Use dynamic import** - avoids adding to top-level imports
3. **Maintain logging pattern** - use `cronExecutionId` for traceability
4. **Preserve Facebook messaging comment** - for consistency
5. **No changes to `reportTypeMap`** - already correct

## Post-Fix Verification Checklist

- [ ] Manual trigger shows intraday logs
- [ ] D1 contains correct intraday data shape
- [ ] Frontend intraday page renders correctly
- [ ] Pre-market jobs still work
- [ ] End-of-day jobs still work
- [ ] Weekly review jobs still work
- [ ] Sector rotation jobs still work
- [ ] No new TypeScript errors
- [ ] Build succeeds
- [ ] GitHub Actions scheduled run works

## Contact Points

- **Primary**: Development team
- **Secondary**: Operations monitoring
- **Emergency rollback**: Git revert to previous commit

---
*Last Updated: 2026-01-15*  
*Status: Ready for Implementation*  
*Priority: High (Critical bug affecting intraday functionality)*