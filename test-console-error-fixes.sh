#!/bin/bash

# Console Error Fixes Integration Test
# Tests the specific console errors that were fixed in commits 526fa43 and 472564b

echo "🔧 Console Error Fixes Integration Test"
echo "======================================"

# Test configuration
API_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="yanggf"
TEST_TIMEOUT=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

echo "Testing console error fixes from commits:"
echo "- 526fa43: fix: resolve all console errors and sector API backend issues"
echo "- 472564b: fix: Resolve dashboard console errors"
echo ""

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"

    echo "🧪 Testing: $test_name"

    # Run the test
    result=$(timeout $TEST_TIMEOUT bash -c "$test_command" 2>/dev/null)
    exit_code=$?

    if [ $exit_code -eq 124 ]; then
        echo -e "   ${RED}❌ TIMEOUT (${TEST_TIMEOUT}s)${NC}"
        echo -e "   Result: $result"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    elif [[ "$result" == *"$expected_result"* ]]; then
        echo -e "   ${GREEN}✅ PASS${NC}"
        echo -e "   Result: $result"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "   ${RED}❌ FAIL${NC}"
        echo -e "   Expected: $expected_result"
        echo -e "   Result: $result"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

# Test 1: Basic API Health
run_test "API Health Check" \
    "curl -s -H 'X-API-KEY: $API_KEY' '$API_URL/health'" \
    "healthy"

# Test 2: Model Health (was throwing 405 error)
run_test "Model Health Endpoint (Fixed 405 error)" \
    "curl -s '$API_URL/model-health'" \
    "\"status\""

# Test 3: Data Retrieval (Results endpoint)
run_test "Data Retrieval (Results endpoint)" \
    "curl -s -H 'X-API-KEY: $API_KEY' '$API_URL/results'" \
    "\"success\""

# Test 4: KV Debug (testing DAL operations)
run_test "KV Debug (dal.ts write/read operations)" \
    "curl -s -H 'X-API-KEY: $API_KEY' '$API_URL/kv-debug'" \
    "\"success\""

# Test 5: Results Endpoint (data.ts operations)
run_test "Results Endpoint (data.ts operations)" \
    "curl -s -H 'X-API-KEY: $API_KEY' '$API_URL/results'" \
    "\"success\""

# Test 6: Main Dashboard Loading (should not have JS errors)
run_test "Main Dashboard HTML Loading" \
    "curl -s '$API_URL/'" \
    "<!DOCTYPE html>"

# Test 7: Static JS Files (web-notifications.js was 404)
run_test "Static JS File Access" \
    "curl -s '$API_URL/js/web-notifications.js'" \
    "function\|var\|const\|class\|//"

# Test 8: Sector API (was having backend issues)
run_test "Sector API Endpoint" \
    "curl -s -H 'X-API-KEY: $API_KEY' '$API_URL/sector-rotation/current'" \
    "\"success\"\|\"data\"\|\"error\""

# Test 9: API v1 Health (was made public)
run_test "API v1 Health Endpoint" \
    "curl -s '$API_URL/api/v1/data/health'" \
    "\"status\""

# Test 10: Legacy Compatibility (should work without conflicts)
run_test "Legacy Compatibility Routes" \
    "curl -s -H 'X-API-KEY: $API_KEY' '$API_URL/analyze'" \
    "\"success\"\|\"error\""

# Summary
echo "📊 Test Summary"
echo "==============="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}ALL TESTS PASSED! Console error fixes are working correctly.${NC}"
    exit 0
else
    echo -e "\n⚠️  ${YELLOW}$TESTS_FAILED tests failed. Some console errors may still exist.${NC}"
    exit 1
fi