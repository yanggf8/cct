#!/bin/bash
# Test EOD rerun accuracy: verifies market close caching works correctly
# Usage: ./scripts/test-runners/test-eod-rerun.sh [YYYY-MM-DD]
#
# Prerequisites:
#   - $X_API_KEY env var set
#   - Pre-market data exists for the target date
#   - D1 market_close_data table created

set -euo pipefail

API_BASE="https://tft-trading-system.yanggf.workers.dev/api/v1"
DATE="${1:-$(date +%Y-%m-%d)}"
API_KEY=$(printf '%s' "$X_API_KEY" | tr -d '\r\n')

header() { echo -e "\n=== $1 ==="; }
api() {
  curl -sf -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" "$@"
}

header "1. Check pre-market data for $DATE"
PRE_MARKET=$(api "$API_BASE/reports/pre-market?date=$DATE" | jq -r '.data.symbols_analyzed // .symbols_analyzed // "null"')
if [ "$PRE_MARKET" = "null" ] || [ -z "$PRE_MARKET" ]; then
  echo "ERROR: No pre-market data for $DATE"
  exit 1
fi
echo "Pre-market: $PRE_MARKET symbols"

header "2. Run EOD job #1 (first run - fetches from Yahoo)"
RUN1=$(api -X POST "$API_BASE/jobs/trigger" \
  -d "{\"triggerMode\": \"next_day_market_prediction\", \"scheduledDate\": \"$DATE\"}")
RUN1_SUCCESS=$(echo "$RUN1" | jq -r '.success')
RUN1_SYMBOLS=$(echo "$RUN1" | jq -r '.data.result' | jq -r '.symbols_analyzed // "?"')
echo "Run 1: success=$RUN1_SUCCESS, symbols=$RUN1_SYMBOLS"

if [ "$RUN1_SUCCESS" != "true" ]; then
  echo "ERROR: First EOD run failed"
  echo "$RUN1" | jq .
  exit 1
fi

header "3. Check market_close_data cache"
CACHE_COUNT=$(unset CLOUDFLARE_API_TOKEN && npx wrangler d1 execute cct-predict-jobs --remote \
  --command "SELECT COUNT(*) as count FROM market_close_data WHERE close_date = '$DATE'" 2>/dev/null \
  | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
echo "Cached entries: $CACHE_COUNT"

if [ "$CACHE_COUNT" = "0" ]; then
  echo "ERROR: No data cached in market_close_data"
  exit 1
fi

header "4. Run EOD job #2 (rerun - should use cache)"
RUN2=$(api -X POST "$API_BASE/jobs/trigger" \
  -d "{\"triggerMode\": \"next_day_market_prediction\", \"scheduledDate\": \"$DATE\"}")
RUN2_SUCCESS=$(echo "$RUN2" | jq -r '.success')
RUN2_SYMBOLS=$(echo "$RUN2" | jq -r '.data.result' | jq -r '.symbols_analyzed // "?"')
echo "Run 2: success=$RUN2_SUCCESS, symbols=$RUN2_SYMBOLS"

header "5. Verify cache not duplicated"
CACHE_COUNT2=$(unset CLOUDFLARE_API_TOKEN && npx wrangler d1 execute cct-predict-jobs --remote \
  --command "SELECT COUNT(*) as count FROM market_close_data WHERE close_date = '$DATE'" 2>/dev/null \
  | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
echo "Cached entries after rerun: $CACHE_COUNT2"

if [ "$CACHE_COUNT" = "$CACHE_COUNT2" ]; then
  echo "PASS: Cache stable ($CACHE_COUNT entries, no duplicates)"
else
  echo "FAIL: Cache count changed ($CACHE_COUNT -> $CACHE_COUNT2)"
  exit 1
fi

header "6. View EOD report"
EOD_REPORT=$(api "$API_BASE/reports/end-of-day?date=$DATE")
ACCURACY=$(echo "$EOD_REPORT" | jq -r '.data.overallAccuracy // .overallAccuracy // "N/A"')
CORRECT=$(echo "$EOD_REPORT" | jq -r '.data.correctCalls // .correctCalls // "N/A"')
WRONG=$(echo "$EOD_REPORT" | jq -r '.data.wrongCalls // .wrongCalls // "N/A"')
GRADE=$(echo "$EOD_REPORT" | jq -r '.data.modelGrade // .modelGrade // "N/A"')
echo "Accuracy: $ACCURACY% | Correct: $CORRECT | Wrong: $WRONG | Grade: $GRADE"

header "RESULT"
echo "All checks passed for $DATE"
echo "  - Pre-market data: $PRE_MARKET symbols"
echo "  - Market close cached: $CACHE_COUNT entries"
echo "  - Cache stable on rerun: YES"
echo "  - Accuracy: $ACCURACY% (Grade $GRADE)"
