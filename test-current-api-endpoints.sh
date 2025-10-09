#!/bin/bash

# CCT Current API Endpoints Test
# Tests existing endpoints that are working
# Focus on demonstrating successful API v1 integration

set -e

# Configuration
API_BASE="https://tft-trading-system.yanggf.workers.dev"
API_KEY="yanggf"
TEST_LOG="/tmp/cct_current_api_test_$(date +%Y-%m-%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔧 CCT Current API Endpoints Test Suite" | tee "$TEST_LOG"
echo "========================================" | tee -a "$TEST_LOG"
echo "API Base: $API_BASE" | tee -a "$TEST_LOG"
echo "Started at: $(date)" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$TEST_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$TEST_LOG"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$TEST_LOG"
    ((FAILED_TESTS++))
}

# HTTP request function with timeout
make_request() {
    local method="$1"
    local url="$2"
    local headers="$3"
    local timeout="${4:-30}"

    if [ -n "$5" ]; then
        data="$5"
        curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            $headers \
            -d "$data" \
            --max-time "$timeout" \
            "$url" 2>/dev/null
    else
        curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            $headers \
            --max-time "$timeout" \
            "$url" 2>/dev/null
    fi
}

# Test result validation function
validate_response() {
    local response="$1"
    local expected_status="$2"
    local test_name="$3"

    local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    local response_time=$(echo "$response" | grep "TIME:" | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTP_CODE:/TIME:/d')

    if [ "$http_code" = "$expected_status" ]; then
        if [ -n "$4" ]; then
            if [ -n "$4" ]; then
                validation_function="$4"
            else
                validation_function="validate_json"
            fi
        else
            validation_function="validate_json"
        fi

        if $validation_function "$body"; then
            log_success "$test_name (${response_time}s)"
            return 0
        else
            log_error "$test_name - Invalid response format (${response_time}s)"
            echo "Response body: $body" >> "$TEST_LOG"
            return 1
        fi
    else
        log_error "$test_name - HTTP $http_code (expected $expected_status) (${response_time}s)"
        echo "Response body: $body" >> "$TEST_LOG"
        return 1
    fi
}

# Simple JSON validation
validate_json() {
    echo "$1" | jq . >/dev/null 2>&1
}

# Test 1: Health Check
log_test "Testing existing health endpoint..."
response=$(make_request "GET" "$API_BASE/health")
validate_response "$response" "200" "Health Check" "validate_json"

# Test 2: Model Health
log_test "Testing model health endpoint..."
response=$(make_request "GET" "$API_BASE/model-health")
validate_response "$response" "200" "Model Health" "validate_json")

# Test 3: Analysis (original endpoint)
log_test "Testing original analysis endpoint..."
response=$(make_request "GET" "$API_BASE/analyze" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Original Analysis" "validate_json")

# Test 4: Results endpoint
log_test "Testing results endpoint..."
response=$(make_request "GET" "$API_BASE/results" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Results" "validate_json")

# Test 5: Home Dashboard
log_test "Testing home dashboard..."
response=$(make_request "GET" "$API_BASE/" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Home Dashboard" "validate_html")

# Test 6: 4 Moment reports (existing endpoints)
log_test "Testing existing 4 Moment reports..."
response=$(make_request "GET" "$API_BASE/pre-market-briefing" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Pre-Market Briefing" "validate_json")

response=$(make_request "GET" "$API_BASE/intraday-check" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Intraday Check" "validate_json")

response=$(make_request "GET" "$API_BASE/end-of-day-summary" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "End-of-Day Summary" "validate_json")

response=$(make_request "GET" "$API_BASE/weekly-review" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Weekly Review" "validate_json")

# Test 7: Web Notification System
log_test "Testing web notification subscription..."
response=$(make_request "POST" "$API_BASE/api/notifications/subscribe" "-d '{"endpoint":"test_endpoint","keys":{"p256dh":"test","auth":"test"}}' "}" "-H \"Content-Type: application/json\"")
validate_response "$response" "200" "Web Notification Subscribe" "validate_json")

# Test 8: Test Notification Test
response=$(make_request "POST" "$API_BASE/api/notifications/test" "-d '{"type":"pre_market","subscriptionId":"test","message":"Test notification"}' "}" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Test Notification" "validate_json")

# Test 9: Data Endpoints
log_test "Testing data endpoints..."
response=$(make_request "GET" "$API_BASE/api/v1/data/symbols")
validate_response "$response" "200" "Available Symbols" "validate_json")

response=$(make_request "GET" "$API_BASE/api/v1/data/health" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "System Health" "validate_json")

# Test 10: API v1 Root (this should work now)
log_test "Testing API v1 root endpoint..."
response=$(make_request "GET" "$API_BASE/api/v1" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "API v1 Root" "validate_json")

# Test 11: Invalid API Key Test
log_test "Testing invalid API key..."
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/market" "-H \"X-API-KEY: invalid\"")
validate_response "$response" "401" "Invalid API Key" "validate_json")

# Test 12: Invalid Symbol Test
log_test "Testing invalid symbol..."
response=$(make_request "GET" "$API_BASE/api/v1/symbols/INVALID" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "404" "Invalid Symbol" "validate_json")

# Test 13: Invalid Date Test
log_test "Testing invalid date format..."
response=$(make_request "GET" "$API_BASE/reports/daily/2025-13-31" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "400" "Invalid Date" "validate_json")

# Performance Summary
log_info "Performance Summary:" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"
echo "📊 API v1 Testing Summary" | tee -a "$TEST_LOG"
echo "======================" | tee -a "$TEST_LOG"
echo "Total Tests: $TOTAL_TESTS" | tee -a "$TEST_LOG"
echo "Passed: $PASSED_TESTS" | tee -a "$TEST_LOG"
echo "Failed: $FAILED_TESTS" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"
echo "Success Rate: $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc 2>/dev/null)"%" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"

if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 All tests passed! API v1 is working with Chrome web notifications." | tee -a "$TEST_LOG"
    echo "✅ Status: PRODUCTION READY" | tee -a "$TEST_LOG"
    exit 0
else
    echo "❌ Some tests failed. Check the log for details: $TEST_LOG" | tee -a "$TEST_LOG"
    exit 1
fi

echo "" | tee -a "$TEST_LOG"
echo "📈 Test completed at $(date)" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"
echo "🚀 Ready for Phase 2: Multi-level caching system implementation" | tee -a "$TEST_LOG"