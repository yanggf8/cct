# Duplicate Job Runs Investigation (2026-01-30)

## Issue Summary

Dashboard shows duplicate job runs for the same date and type:
- **2026-01-29 Pre-Market**: 2 runs (12:31 UTC, 12:48 UTC)
- **2026-01-29 Intraday**: 2 runs (16:01 UTC, 16:18 UTC)
- **2026-01-28 End-of-Day**: 2 runs

## Root Cause

Jobs are being triggered from **multiple sources**, not just GitHub Actions:

### Confirmed Triggers

1. **GitHub Actions (Scheduled)** ✅ Expected
   - Pre-market: 12:30 UTC daily
   - Intraday: 16:00 UTC daily
   - End-of-day: 20:05 UTC daily
   - Weekly: 14:00 UTC Sunday

2. **Manual API Calls** ⚠️ Unexpected
   - Someone/something is calling `/api/v1/jobs/trigger` or individual job endpoints
   - Historically, runs created via the scheduler path were always recorded as `trigger_source: "cron"`, even when invoked via `/api/v1/jobs/trigger` (so older DB rows can’t reliably distinguish GitHub Actions vs manual callers using DB fields alone)

### Evidence from 2026-01-29

**Pre-Market Runs:**
```
09:08:08 UTC - Manual (stuck in "running")
09:08:24 UTC - Manual (stuck in "running")  
09:08:31 UTC - Manual (success)
12:31:32 UTC - GitHub Actions cron ✅ (success)
12:48:34 UTC - Manual (success) ⚠️ DUPLICATE
```

**Intraday Runs:**
```
16:01:31 UTC - trigger_source: "cron" but NO GitHub Actions run ⚠️
16:18:28 UTC - GitHub Actions cron ✅ (success)
```

**GitHub Actions History:**
```
2026-01-29T12:47:40Z - Pre-market (scheduled)
2026-01-29T16:18:28Z - Intraday (scheduled)
2026-01-29T20:14:32Z - End-of-day (scheduled)
```

## Analysis

### Mystery: 16:01 UTC Intraday Run

The **16:01:31 UTC** intraday run shows `trigger_source: "cron"` but:
- GitHub Actions only ran at **16:18:28 UTC**
- No Cloudflare cron triggers in `wrangler.toml`
- 17 minutes **before** the scheduled GitHub Actions run

Important: prior to 2026-01-30, the scheduler code path hard-coded `trigger_source = "cron"` for runs started inside `handleScheduledEvent()`, including runs invoked via `/api/v1/jobs/trigger`. That means `trigger_source: "cron"` on older rows does **not** prove Cloudflare cron.

**Possible Sources (still plausible):**
1. **External automation** calling `/api/v1/jobs/trigger` (or direct job endpoints)
2. **GitHub Actions retry/delay** causing a second call later
3. **Cloudflare Scheduled Event** triggers (if configured outside the repo)

### Pattern

All duplicate runs occur **15-20 minutes apart**:
- Pre-market: 12:31 → 12:48 (17 minutes)
- Intraday: 16:01 → 16:18 (17 minutes)

This suggests a **retry mechanism** or **secondary scheduler**.

## Fix Applied

Added instrumentation to identify the caller of `/api/v1/jobs/trigger` and ensure runs are attributed correctly:
- Log derived trigger source (via `detectTriggerSource()`), explicit `X-Trigger-Source`, `User-Agent`, `CF-Ray`, timestamp
- Pass the derived source into the scheduler so `startJobRun()` records `trigger_source` as `github_actions` vs `manual` vs `cron`

This will help identify the source of duplicate triggers in future runs.

### Code Change

```typescript
const detectedTriggerSource = detectTriggerSource(request);
const navTriggerSource = mapTriggerSource(detectedTriggerSource);
logger.info('Job trigger request', { detectedTriggerSource, navTriggerSource, /* ... */ });

const result = await handleScheduledEvent(controller, env, ctx, triggerMode, navTriggerSource);
```

## Next Steps

1. **Deploy the logging fix** and monitor next scheduled run
2. **Check Cloudflare dashboard** for hidden cron triggers:
   ```bash
   unset CLOUDFLARE_API_TOKEN && npx wrangler triggers list
   ```
3. **Review worker logs** after next run to see derived trigger source + headers
4. **Check for external automations** - Any scripts or services calling the API?

## Temporary Workaround

If duplicates continue, you can:
1. **Delete duplicate runs** using dashboard "Delete" button
2. **Add deduplication logic** - Check if a run already exists for the same date/type within 30 minutes
3. **Rate limit** `/api/v1/jobs/trigger` - Only allow one run per date/type per hour

## Questions to Investigate

1. ❓ Is there a Cloudflare cron trigger not visible in `wrangler.toml`?
2. ❓ Is there an external service (monitoring, health check) calling the API?
3. ❓ Are there multiple GitHub Actions workflows triggering the same job?
4. ❓ Is GitHub Actions retrying failed runs automatically?

---

**Date**: 2026-01-30
**Status**: 🔍 Under Investigation
**Impact**: Medium - Duplicate runs waste resources but don't affect data quality
