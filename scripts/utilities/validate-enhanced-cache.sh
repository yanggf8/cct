#!/bin/bash
#
# Enhanced Cache System Validation — smoke test against the deployed worker.
#
# Two things were wrong with the previous version, and together they are why
# enhanced-cache-tests.yml failed 100 runs in a row without ever telling anyone
# what was broken:
#
#   1. Every endpoint it called had moved. /health, /cache-health, /cache-config
#      and the rest now live under /api/v1/... and the old paths return 404.
#      Five of the nine checks printed a green tick unconditionally, with no
#      assertion at all, so a suite hitting nothing but 404s still ended with
#      "🎉 Enhanced Cache System is Production Ready!".
#
#   2. It never emitted the "✅ PASS:" / "❌ FAIL:" markers the workflow greps
#      for, never wrote the test-results-*.log the workflow looks for, and
#      never exited non-zero. The workflow's parse step therefore always took
#      its "No test results found" branch and set ALL_TESTS_PASSED=false.
#
# /cache-test-load has no replacement under /api/v1 and its check is dropped
# rather than pointed at a guess.

set -euo pipefail

API_URL="${API_URL:-https://tft-trading-system.yanggf.workers.dev}"

# Was the literal key, in a public repo. Fail loudly rather than sending an
# empty header and reporting every endpoint as unhealthy.
API_KEY="${API_KEY:-${X_API_KEY:-}}"
if [[ -z "$API_KEY" ]]; then
    echo "❌ X_API_KEY is not set — export it, or run with API_KEY=..." >&2
    exit 2
fi

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

pass() { echo -e "${GREEN}✅ PASS: $1${NC}"; PASSED=$((PASSED + 1)); }
fail() { echo -e "${RED}❌ FAIL: $1${NC}"; FAILED=$((FAILED + 1)); }

# get <path> — GET and echo the body. Never aborts the run: a dead endpoint is
# a result to report, not a reason to stop testing the others.
get() { curl -s --max-time 20 -H "X-API-KEY: $API_KEY" "$API_URL$1" || echo '{}'; }

# expect <name> <actual> <wanted> — the whole assertion vocabulary.
expect() {
    if [[ "$2" == "$3" ]]; then
        pass "$1"
    else
        fail "$1 (got '$2', want '$3')"
    fi
}

echo -e "${BLUE}=== Enhanced Cache System Validation ===${NC}"
echo "API: $API_URL"
echo ""

echo -e "${BLUE}1. API health${NC}"
expect "API health" "$(get /api/v1/data/health | jq -r '.system.status // "error"')" "healthy"

echo -e "${BLUE}2. Cache health${NC}"
cache_health_body=$(get /api/v1/cache/health)
expect "Cache health endpoint" "$(echo "$cache_health_body" | jq -r '.success // false')" "true"
cache_status=$(echo "$cache_health_body" | jq -r '.assessment.status // "error"')
cache_score=$(echo "$cache_health_body" | jq -r '.assessment.overallScore // 0')
echo "   assessment: $cache_status, score $cache_score/100"

echo -e "${BLUE}3. Cache configuration${NC}"
cache_config_body=$(get /api/v1/cache/config)
expect "Cache config endpoint" "$(echo "$cache_config_body" | jq -r '.success // false')" "true"
cache_env=$(echo "$cache_config_body" | jq -r '.environment // "error"')
echo "   environment: $cache_env"

echo -e "${BLUE}4. Cache metrics${NC}"
cache_metrics_body=$(get /api/v1/cache/metrics)
expect "Cache metrics endpoint" "$(echo "$cache_metrics_body" | jq -r '.success // false')" "true"
total_requests=$(echo "$cache_metrics_body" | jq -r '.cacheStats.totalRequests // 0')
l1_hits=$(echo "$cache_metrics_body" | jq -r '.cacheStats.l1Hits // 0')
echo "   $total_requests requests, $l1_hits L1 hits"

echo -e "${BLUE}5. Cache promotion${NC}"
# `enabled` is a setting, not a health signal — it reads false in production
# today. Assert the endpoint answers; report the flag.
promotion_body=$(get /api/v1/cache/promote)
expect "Cache promotion endpoint" "$(echo "$promotion_body" | jq -r '.success // false')" "true"
echo "   enabled: $(echo "$promotion_body" | jq -r '.enabled // false')"

echo -e "${BLUE}6. Cache warmup${NC}"
# Warmup is deliberately blocked in production unless ALLOW_CACHE_WARMUP is
# set, and it answers `success: false` with that explanation. Asserting
# success==true would mark the intended production configuration as a failure,
# so a refusal-by-design counts as a pass and anything else does not.
warmup_body=$(curl -s --max-time 30 -X POST -H "X-API-KEY: $API_KEY" "$API_URL/api/v1/cache/warmup" || echo '{}')
warmup_ok=$(echo "$warmup_body" | jq -r '.success // false')
warmup_err=$(echo "$warmup_body" | jq -r '.error // ""')
if [[ "$warmup_ok" == "true" ]]; then
    pass "Cache warmup"
elif [[ "$warmup_err" == "Cache warmup is disabled" ]]; then
    pass "Cache warmup (disabled by configuration, as expected in production)"
else
    fail "Cache warmup (success=$warmup_ok, error='$warmup_err')"
fi

echo -e "${BLUE}7. Cache system status${NC}"
expect "Cache enabled" "$(get /api/v1/cache/status | jq -r '.system.enabled // false')" "true"

echo ""
echo -e "${BLUE}=== Summary ===${NC}"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""
echo -e "${BLUE}📊 Metrics:${NC}"
echo "- Cache health score: $cache_score/100"
echo "- Total cache requests: $total_requests"
echo "- L1 cache hits: $l1_hits"
echo "- Environment: $cache_env"

if [[ $FAILED -gt 0 ]]; then
    echo ""
    echo -e "${RED}❌ $FAILED check(s) failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All $PASSED checks passed${NC}"
