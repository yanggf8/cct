#!/bin/bash

# TypeScript Migration Integration Tests
# Tests all newly converted TypeScript modules and endpoints

echo "🧪 TypeScript Migration Integration Tests"
# Check environment variables
if [[ -z "${X_API_KEY:-}" ]]; then
    echo "❌ ERROR: X_API_KEY environment variable is not set"
    echo "Please set X_API_KEY in your .zshrc or export it:"
    echo "  export X_API_KEY=your_api_key"
    exit 1
fi
echo "✅ X_API_KEY is set (length: ${#X_API_KEY})"
# Check environment variables
if [[ -z "${X_API_KEY:-}" ]]; then
    echo "❌ ERROR: X_API_KEY environment variable is not set"
    echo ""
    echo "Current environment variables with API_KEY:"
    env | grep -i api_key || echo "  (none found)"
    echo ""
    echo "Please set X_API_KEY in your .zshrc:"
    echo "  export X_API_KEY=your_api_key"
    echo "  source ~/.zshrc"
    echo ""
    echo "Or set it temporarily:"
    echo "  X_API_KEY=your_api_key ./test-script.sh"
    exit 1
fi
echo "✅ X_API_KEY is set (length: ${#X_API_KEY})"
echo "✅ X_API_KEY is set (length: ${#X_API_KEY})"
echo "=================================="
echo "Testing all newly converted TypeScript modules..."
echo ""

# Configuration
API_BASE="https://tft-trading-system.yanggf.workers.dev"
X_API_KEY="${X_API_KEY:-}"
TIMEOUT=30

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run test
run_test() {
    local test_name="$1"
    local endpoint="$2"
    local expected_field="$3"

    echo -e "${BLUE}Test $TOTAL_TESTS: $test_name${NC}"
    echo "Endpoint: $endpoint"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    # Run curl command
    if response=$(timeout $TIMEOUT curl -s -H "X-API-KEY: $X_API_KEY" "$endpoint" 2>/dev/null); then
        # Check if response contains expected field
        if echo "$response" | jq -e ".$expected_field" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ PASSED${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))

            # Show key data
            echo -e "${BLUE}Key Data:${NC}"
            echo "$response" | jq -e ".$expected_field" 2>/dev/null || echo "N/A"
            echo ""
        else
            echo -e "${RED}❌ FAILED - Missing or invalid $expected_field${NC}"
            echo "Response preview:"
            echo "$response" | head -3
            echo ""
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "${RED}❌ FAILED - Request timeout or error${NC}"
        echo ""
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Function to test HTTP status
run_status_test() {
    local test_name="$1"
    local endpoint="$2"
    local expected_status="$3"

    echo -e "${BLUE}Test $TOTAL_TESTS: $test_name${NC}"
    echo "Endpoint: $endpoint (Expected: $expected_status)"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    # Run curl command
    if status_code=$(timeout $TIMEOUT curl -s -o /dev/null -w "%{http_code}" -H "X-API-KEY: $X_API_KEY" "$endpoint" 2>/dev/null); then
        if [ "$status_code" -eq "$expected_status" ]; then
            echo -e "${GREEN}✅ PASSED${NC} - Status: $status_code"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}❌ FAILED${NC} - Status: $status_code (Expected: $expected_status)"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "${RED}❌ FAILED${NC} - Request timeout or error"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
}

echo "🚀 Starting Integration Tests..."
echo ""

# Test 1: Health Check - Basic system health
run_status_test "System Health Check" "$API_BASE/health" 200

# Test 2: Model Health - AI systems status
run_test "Model Health Check" "$API_BASE/model-health" "models"

# Test 3: Debug Environment - System configuration
run_test "Debug Environment" "$API_BASE/debug-env" "environment"

# Test 4: KV Debug - KV storage operations
run_test "KV Debug Operations" "$API_BASE/kv-debug" "success"

# Test 5: Health Check - Alternative endpoint
run_status_test "Alternative Health Check" "$API_BASE/health" 200

# Test 6: Test Results Endpoint
run_test "Results Data" "$API_BASE/results" "data"

echo -e "${YELLOW}Testing Handler Endpoints (Converted to TypeScript)${NC}"
echo ""

# Test 7: Pre-Market Briefing (converted from briefing-handlers.js)
run_status_test "Pre-Market Briefing" "$API_BASE/pre-market-briefing" 200

# Test 8: Intraday Check - Refactored Version
run_status_test "Intraday Check (Refactored)" "$API_BASE/intraday-check-refactored" 200

# Test 9: Intraday Check - Decomposed Version
run_status_test "Intraday Check (Decomposed)" "$API_BASE/intraday-check-decomposed" 200

# Test 10: End-of-Day Summary
run_status_test "End-of-Day Summary" "$API_BASE/end-of-day-summary" 200

# Test 11: Weekly Review
run_status_test "Weekly Review" "$API_BASE/weekly-review" 200

echo -e "${YELLOW}Testing Data Endpoints (Converted from http-data-handlers.js)${NC}"
echo ""

# Test 12: Fact Table Data
run_test "Fact Table Data" "$API_BASE/fact-table" "success"

# Test 13: Cron Health Status
run_test "Cron Health" "$API_BASE/cron-health" "data"

# Test 14: KV Get Operation
run_status_test "KV Get Test" "$API_BASE/kv-get?key=test_key" 404

# Test 15: Results Endpoint - Alternative
run_test "Results Alternative" "$API_BASE/results" "data"

echo -e "${YELLOW}Testing Dashboard and Utility Endpoints${NC}"
echo ""

# Test 16: Daily Summary API
run_status_test "Daily Summary API" "$API_BASE/api/daily-summary" 200

# Test 17: Predictive Analytics Dashboard
run_status_test "Predictive Analytics Dashboard" "$API_BASE/predictive-analytics-dashboard" 200

echo -e "${YELLOW}Testing Error Handling${NC}"
echo ""

# Test 18: Invalid Endpoint (should return 404)
run_status_test "Invalid Endpoint" "$API_BASE/invalid-endpoint" 404

# Test 19: Missing API Key (should return 401/403)
if no_api_key_response=$(timeout $TIMEOUT curl -s -o /dev/null -w "%{http_code}" "$API_BASE/kv-debug" 2>/dev/null); then
    if [ "$no_api_key_response" -eq "401" ] || [ "$no_api_key_response" -eq "403" ]; then
        echo -e "${GREEN}✅ Test $TOTAL_TESTS: API Key Authentication${NC} - Status: $no_api_key_response (Expected: 401/403)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ Test $TOTAL_TESTS: API Key Authentication${NC} - Status: $no_api_key_response (Expected: 401/403)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo -e "${RED}❌ Test $TOTAL_TESTS: API Key Authentication${NC} - Request timeout"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
fi
echo ""

# Test 20: Method Not Allowed (POST on GET endpoint)
if post_response=$(timeout $TIMEOUT curl -s -X POST -H "X-API-KEY: $X_API_KEY" "$API_BASE/health" -o /dev/null -w "%{http_code}" 2>/dev/null); then
    if [ "$post_response" -eq "405" ]; then
        echo -e "${GREEN}✅ Test $TOTAL_TESTS: Method Not Allowed${NC} - Status: $post_response (Expected: 405)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ Test $TOTAL_TESTS: Method Not Allowed${NC} - Status: $post_response (Expected: 405)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo -e "${RED}❌ Test $TOTAL_TESTS: Method Not Allowed${NC} - Request timeout"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
fi
echo ""

# Summary
echo -e "${BLUE}📊 Test Results Summary${NC}"
echo "=================================="
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! TypeScript migration successful!${NC}"
    exit 0
else
    echo -e "${RED}❌ $FAILED_TESTS tests failed. Review and fix issues.${NC}"
    exit 1
fi