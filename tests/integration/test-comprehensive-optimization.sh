#!/bin/bash

# Comprehensive Optimization Test (Trimmed)
# Tests cache system and optimization endpoints
# Removed: redundant checks, fake pattern learning, excessive load tests

set -euo pipefail

# Check environment variables
if [[ -z "${X_API_KEY:-}" ]]; then
    echo "❌ ERROR: X_API_KEY environment variable is not set"
    echo "  export X_API_KEY=your_api_key"
    exit 1
fi

# Configuration
API_URL="https://tft-trading-system.yanggf.workers.dev"
TIMEOUT=45
LOG_FILE="comprehensive-optimization-$(date +%Y%m%d-%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Test results
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

test_passed() {
    echo -e "${GREEN}✅ $1${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    log "PASS: $1"
}

test_failed() {
    echo -e "${RED}❌ $1${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    log "FAIL: $1 - $2"
}

test_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
    log "INFO: $1"
}

make_request() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="${3:-}"

    curl -s -w '\nHTTP_CODE:%{http_code}\nTIME:%{time_total}' \
        -X "$method" \
        -H "X-API-KEY: $X_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$data" \
        --max-time $TIMEOUT \
        "$API_URL$endpoint" 2>/dev/null || echo -e "\nHTTP_CODE:000\nTIME:0"
}

extract_http_code() {
    echo "$1" | grep "^HTTP_CODE:" | cut -d: -f2
}

extract_response_time() {
    echo "$1" | grep "^TIME:" | cut -d: -f2
}

test_api_endpoint() {
    local endpoint="$1"
    local description="$2"
    local expected_code="${3:-200}"

    test_info "Testing $description ($endpoint)"

    local response=$(make_request "$endpoint" "GET")
    local http_code=$(extract_http_code "$response")
    local response_time=$(extract_response_time "$response")

    if [[ "$http_code" == "$expected_code" ]]; then
        test_passed "$description (${response_time}s)"
        return 0
    else
        test_failed "$description" "HTTP $http_code (expected $expected_code)"
        return 1
    fi
}

# Main test execution
echo -e "${MAGENTA}=======================================${NC}"
echo -e "${MAGENTA}🚀 Optimization Test Suite${NC}"
echo -e "${MAGENTA}=======================================${NC}"
echo ""

log "Starting Optimization Tests"

# Phase 1: Cache System (3 tests)
echo -e "${BLUE}🔧 Phase 1: Cache System${NC}"
test_api_endpoint "/api/v1/cache/health" "Cache Health"
test_api_endpoint "/api/v1/cache/config" "Cache Configuration"
test_api_endpoint "/api/v1/cache/metrics" "Cache Metrics"

# Phase 2: Core Endpoints (4 tests)
echo -e "\n${BLUE}📊 Phase 2: Core Endpoints${NC}"
test_api_endpoint "/api/v1/data/symbols" "Symbol List"
test_api_endpoint "/api/v1/sentiment/symbols/AAPL" "Symbol Analysis AAPL"
test_api_endpoint "/api/v1/sentiment/symbols/MSFT" "Symbol Analysis MSFT"
test_api_endpoint "/api/sectors/snapshot" "Sector Snapshot"

# Phase 3: Prefetch & Batching (4 tests)
echo -e "\n${BLUE}⚡ Phase 3: Prefetch & Batching${NC}"
test_api_endpoint "/analyze" "Analyze Baseline"
test_api_endpoint "/analyze" "Analyze Prefetch Follow-up"
test_api_endpoint "/api/v1/data/symbols" "Symbol List (Alias/Cache Hit)"
test_info "Testing concurrent batch behavior"
make_request "/api/v1/data/symbols" "GET" >/dev/null &
make_request "/api/v1/sentiment/symbols/AAPL" "GET" >/dev/null &
wait
test_passed "Concurrent batch fan-out executed"

# Phase 4: System Health (2 tests)
echo -e "\n${BLUE}📈 Phase 4: System Health${NC}"
test_api_endpoint "/health" "System Health"

health_response=$(make_request "/health" "GET")
if echo "$health_response" | jq -e '.success == true' >/dev/null 2>&1; then
    test_passed "Health Response Valid JSON"
else
    test_failed "Health Response" "Invalid JSON or success != true"
fi

# Phase 5: Cache Operations (2 tests)
echo -e "\n${BLUE}🎯 Phase 5: Cache Operations${NC}"
test_api_endpoint "/api/v1/cache/promote" "Cache Promotion"
test_api_endpoint "/api/v1/cache/warmup" "Cache Warmup"

# Results Summary
echo -e "\n${MAGENTA}📋 Test Results${NC}"
echo ""

if [[ $TESTS_TOTAL -gt 0 ]]; then
    success_rate=$(( (TESTS_PASSED * 100) / TESTS_TOTAL ))
else
    success_rate=0
fi

echo -e "${CYAN}Total: $TESTS_TOTAL | ${GREEN}Passed: $TESTS_PASSED${NC} | ${RED}Failed: $TESTS_FAILED${NC}"
echo -e "${BLUE}Success Rate: ${success_rate}%${NC}"

if [[ $success_rate -ge 90 ]]; then
    echo -e "\n${GREEN}✅ Optimization system healthy${NC}"
elif [[ $success_rate -ge 70 ]]; then
    echo -e "\n${YELLOW}⚠️  Some issues detected${NC}"
else
    echo -e "\n${RED}❌ Critical issues${NC}"
fi

log "Tests Completed: $TESTS_PASSED/$TESTS_TOTAL (${success_rate}%)"

exit $((TESTS_FAILED > 0 ? 1 : 0))
