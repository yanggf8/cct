#!/usr/bin/env bash
# Verify the report endpoints read the store the pipeline actually writes.
#
# The pipeline writes to D1 (`scheduled_job_results` / `symbol_predictions`)
# and to nothing else. For a long time three readers looked in the DO cache
# for `daily_report_<date>` / `analysis_<date>`, keys no writer has ever
# created, so the weekly report answered with a week of zero-signal days
# instead of the signals sitting in D1.
#
# Baseline before the fix (2026-08-04):
#   weekly  -> Trading days: 7, Total signals: 0
#   daily   -> NO_DATA for every date
#
# Expected after: the weekly report counts only days that have a D1 snapshot,
# and its signal total matches those snapshots.
set -u

BASE="${CCT_BASE:-https://tft-trading-system.yanggf.workers.dev}"
KEY="${CCT_API_KEY:-yanggf}"
fail=0

get() { curl -s -m 30 -H "X-API-Key: $KEY" "$BASE$1"; }

# A completed week, regenerated rather than served from cache: entries written
# while the cache read was broken hold seven zero-signal days.
echo "== weekly 2026-W31 =="
get "/api/v1/reports/weekly/2026-W31?nocache=true" | python3 -c '
import sys, json
d = json.load(sys.stdin)
if not d.get("success"):
    print("FAIL weekly: request unsuccessful:", d.get("error")); sys.exit(1)
r = d["data"]["report"]
days = r["daily_breakdown"]
total = r["performance_summary"]["total_signals"]
for day in days:
    print("  %s  %-8s signals=%s" % (day["date"], day["sentiment"], day["signal_count"]))
print("  trading days=%d total signals=%s" % (len(days), total))
if total == 0:
    print("FAIL weekly: zero signals across the whole week"); sys.exit(1)
if sum(x["signal_count"] for x in days) != total:
    print("FAIL weekly: daily breakdown does not sum to the total"); sys.exit(1)
print("OK weekly")
' || fail=1

# The date is a path segment, not a query param — `?date=` silently falls
# through to the latest-report route.
echo "== daily (a date with a known D1 snapshot) =="
get "/api/v1/reports/daily/2026-07-30" | python3 -c '
import sys, json
d = json.load(sys.stdin)
if not d.get("success"):
    print("FAIL daily: ", d.get("error_code"), d.get("error")); sys.exit(1)
sa = d["data"]["report"]["symbol_analysis"]
print("  symbols=%s" % [s["symbol"] for s in sa])
if not sa:
    print("FAIL daily: no symbols in report"); sys.exit(1)
print("OK daily")
' || fail=1

echo "== no route may smuggle a DAL error object into a success envelope =="
for p in /api/v1/reports/weekly /api/v1/reports/daily/2026-07-30 /api/v1/reports/pre-market; do
  body=$(get "$p")
  if printf '%s' "$body" | grep -q '"error":"Data not found in DO cache"'; then
    echo "  FAIL $p: leaked a DAL miss into the response"
    fail=1
  else
    echo "  OK $p"
  fi
done

exit $fail
