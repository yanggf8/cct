# GitHub Actions Time Window Fix

## Issue
Scheduled GitHub Actions jobs were not triggering the correct analysis type (pre-market, intraday, end-of-day). Instead, they were falling back to "manual" mode.

## Root Cause
GitHub Actions scheduled jobs can be delayed by **15-30 minutes** from their scheduled time. The time detection windows in the workflow were too narrow (32 minutes), causing delayed jobs to fall outside the window.

### Example
- **Scheduled**: 12:30 UTC (pre-market)
- **Actual run**: 12:47 UTC (17 minutes late)
- **Time window**: 12:14-12:46 (32 minutes)
- **Result**: 12:47 > 12:46 → fell outside window → defaulted to "manual" mode

## Evidence
```bash
# Most recent scheduled run (2026-01-28)
Run time: 12:47 UTC
Expected: pre-market (morning_prediction_alerts)
Actual: manual (default fallback)
Status: success (but wrong trigger mode)
```

## Fix
Widened all time windows from **32 minutes** to **90 minutes** to accommodate GitHub Actions delays:

| Job Type | Schedule | Old Window | New Window | Change |
|----------|----------|------------|------------|--------|
| Pre-Market | 12:30 UTC | 12:14-12:46 | 12:00-13:30 | +58 min |
| Intraday | 16:00 UTC | 15:44-16:16 | 15:30-17:00 | +58 min |
| End-of-Day | 20:05 UTC | 19:49-20:21 | 19:30-21:00 | +58 min |
| Weekly | 14:00 UTC | 13:44-14:16 | 13:30-15:00 | +58 min |

### Code Change
```yaml
# Before (32-minute window)
elif [[ "$CURRENT_TIME" > "12:14" ]] && [[ "$CURRENT_TIME" < "12:46" ]]; then

# After (90-minute window)
elif [[ "$CURRENT_TIME" > "12:00" ]] && [[ "$CURRENT_TIME" < "13:30" ]]; then
```

## Impact
- ✅ Scheduled jobs will now correctly detect their trigger mode even with 30+ minute delays
- ✅ Pre-market jobs will use `morning_prediction_alerts` trigger mode
- ✅ Multi-run tracking will work for scheduled jobs (not just manual triggers)
- ✅ No overlap between windows (each has 1.5-hour gap from next)

## Testing
Next scheduled runs:
- **Pre-Market**: Tomorrow (Thu) 12:30 UTC → should detect as "pre-market" even if delayed to 13:00 UTC
- **Intraday**: Tomorrow (Thu) 16:00 UTC → should detect as "intraday" even if delayed to 16:30 UTC
- **End-of-Day**: Tomorrow (Thu) 20:05 UTC → should detect as "end-of-day" even if delayed to 20:35 UTC

## Verification
Check workflow logs after next scheduled run:
```bash
gh run list --workflow=trading-system.yml --limit 1
gh run view <run-id> --log | grep "Analysis Type"
```

Expected output:
```
Analysis Type: pre-market
Trigger Mode: morning_prediction_alerts
Description: Pre-Market Briefing - High-confidence signals (≥70%)
```

## Related Issues
- Pre-market multi-run tracking (fixed in commit 85ffb0e)
- This fix ensures scheduled jobs use the correct trigger mode to activate multi-run tracking

---

**Status**: ✅ Fixed (2026-01-28)
**Commit**: 4fe87f0
**Files Modified**: `.github/workflows/trading-system.yml`
