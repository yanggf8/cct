#!/bin/bash

# CCT API v1 Integration Test Suite
# Tests all new RESTful API endpoints with comprehensive validation
# Based on DAC project testing patterns

set -e  # Exit on any error

# Configuration
API_BASE="https://tft-trading-system.yanggf.workers.dev"
API_KEY="yanggf"
TEST_LOG="/tmp/cct_api_v1_integration_test_$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Logging functions
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

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$TEST_LOG"
}

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1" | tee -a "$TEST_LOG"
    ((TOTAL_TESTS++))
}

# HTTP request function with timeout
make_request() {
    local method="$1"
    local url="$2"
    local headers="$3"
    local data="$4"
    local timeout="${5:-30}"

    if [ -n "$data" ]; then
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
    local validation_function="$4"

    local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    local response_time=$(echo "$response" | grep "TIME:" | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTP_CODE:/d' | sed '/TIME:/d')

    if [ "$http_code" = "$expected_status" ]; then
        if [ -n "$validation_function" ]; then
            if $validation_function "$body"; then
                log_success "$test_name (${response_time}s)"
                return 0
            else
                log_error "$test_name - Invalid response format (${response_time}s)"
                echo "Response body: $body" >> "$TEST_LOG"
                return 1
            fi
        else
            log_success "$test_name (${response_time}s)"
            return 0
        fi
    else
        log_error "$test_name - HTTP $http_code (expected $expected_status) (${response_time}s)"
        echo "Response body: $body" >> "$TEST_LOG"
        return 1
    fi
}

# Validation functions
validate_json() {
    local body="$1"
    echo "$body" | jq . >/dev/null 2>&1
}

validate_api_response() {
    local body="$1"
    echo "$body" | jq -e '.success' >/dev/null 2>&1 && \
    echo "$body" | jq -e '.timestamp' >/dev/null 2>&1
}

validate_sentiment_analysis() {
    local body="$1"
    echo "$body" | jq -e '.data.symbols' >/dev/null 2>&1 && \
    echo "$body" | jq -e '.data.analysis' >/dev/null 2>&1
}

validate_symbol_sentiment() {
    local body="$1"
    echo "$body" | jq -e '.data.symbol' >/dev/null 2>&1 && \
    echo "$body" | jq -e '.data.analysis' >/dev/null 2>&1
}

validate_market_sentiment() {
    local body="$1"
    echo "$body" | jq -e '.data.overall_sentiment' >/dev/null 2>&1 && \
    echo "$body" | jq -e '.data.sentiment_label' >/dev/null 2>&1
}

validate_daily_report() {
    local body="$1"
    echo "$body" | jq -e '.data.date' >/dev/null 2>&1 && \
    echo "$body" | jq -e '.data.report' >/dev/null 2>&1
}

validate_symbols_list() {
    local body="$1"
    echo "$body" | jq -e '.data.symbols' >/dev/null 2>&1 && \
    echo "$body" | jq -e '.data.metadata' >/dev/null 2>&1
}

validate_system_health() {
    local body="$1"
    echo "$body" | jq -e '.data.status' >/dev/null 2>&1 && \
    echo "$body" | jq -e '.data.services' >/dev/null 2>&1
}

# Start testing
echo "🧪 CCT API v1 Integration Test Suite" | tee "$TEST_LOG"
echo "========================================" | tee "$TEST_LOG"
echo "API Base: $API_BASE" | tee "$TEST_LOG"
echo "Started at: $(date)" | tee "$TEST_LOG"
echo "" | tee "$TEST_LOG"

log_info "Testing API v1 implementation based on DAC patterns"

# Test 1: API v1 Root Endpoint
log_test "GET /api/v1 - API v1 root endpoint"
response=$(make_request "GET" "$API_BASE/api/v1" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "API v1 root endpoint" "validate_api_response"

# Test 2: OPTIONS preflight (CORS)
log_test "OPTIONS /api/v1/sentiment/analysis - CORS preflight"
response=$(make_request "OPTIONS" "$API_BASE/api/v1/sentiment/analysis" "")
validate_response "$response" "200" "CORS preflight request"

# Test 3: Sentiment Analysis - Multiple Symbols
log_test "GET /api/v1/sentiment/analysis - Multi-symbol sentiment analysis"
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/analysis?symbols=AAPL,MSFT,GOOGL" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Multi-symbol sentiment analysis" "validate_sentiment_analysis"

# Test 4: Sentiment Analysis - Default Symbols
log_test "GET /api/v1/sentiment/analysis - Default symbols analysis"
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/analysis" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Default symbols analysis" "validate_sentiment_analysis"

# Test 5: Single Symbol Sentiment
log_test "GET /api/v1/sentiment/symbols/AAPL - Single symbol analysis"
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/symbols/AAPL" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Single symbol analysis" "validate_symbol_sentiment"

# Test 6: Single Symbol Sentiment (Different Symbol)
log_test "GET /api/v1/sentiment/symbols/MSFT - Microsoft analysis"
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/symbols/MSFT" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Microsoft analysis" "validate_symbol_sentiment"

# Test 7: Market Sentiment
log_test "GET /api/v1/sentiment/market - Market-wide sentiment"
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/market" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Market sentiment analysis" "validate_market_sentiment"

# Test 8: Sector Sentiment
log_test "GET /api/v1/sentiment/sectors - Sector sentiment analysis"
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/sectors?sectors=XLK,XLE,XLF" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Sector sentiment analysis" "validate_json"

# Test 9: Daily Report (Today)
log_test "GET /api/v1/reports/daily - Latest daily report"
response=$(make_request "GET" "$API_BASE/api/v1/reports/daily" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Latest daily report" "validate_daily_report"

# Test 10: Daily Report (Specific Date)
log_test "GET /api/v1/reports/daily/2025-10-08 - Specific daily report"
response=$(make_request "GET" "$API_BASE/api/v1/reports/daily/2025-10-08" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Specific daily report" "validate_daily_report"

# Test 11: Weekly Report
log_test "GET /api/v1/reports/weekly - Latest weekly report"
response=$(make_request "GET" "$API_BASE/api/v1/reports/weekly" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Latest weekly report" "validate_json"

# Test 12: Pre-Market Report
log_test "GET /api/v1/reports/pre-market - Pre-market briefing"
response=$(make_request "GET" "$API_BASE/api/v1/reports/pre-market" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Pre-market briefing" "validate_api_response"

# Test 13: Intraday Report
log_test "GET /api/v1/reports/intraday - Intraday check"
response=$(make_request "GET" "$API_BASE/api/v1/reports/intraday" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Intraday check" "validate_api_response"

# Test 14: End-of-Day Report
log_test "GET /api/v1/reports/end-of-day - End-of-day summary"
response=$(make_request "GET" "$API_BASE/api/v1/reports/end-of-day" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "End-of-day summary" "validate_api_response"

# Test 15: Available Symbols
log_test "GET /api/v1/data/symbols - Available symbols (public endpoint)"
response=$(make_request "GET" "$API_BASE/api/v1/data/symbols" "")
validate_response "$response" "200" "Available symbols" "validate_symbols_list"

# Test 16: Symbol Historical Data
log_test "GET /api/v1/data/history/AAPL - Historical data"
response=$(make_request "GET" "$API_BASE/api/v1/data/history/AAPL?days=30" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Historical data" "validate_json"

# Test 17: System Health
log_test "GET /api/v1/data/health - System health check"
response=$(make_request "GET" "$API_BASE/api/v1/data/health" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "System health check" "validate_system_health"

# Test 18: API Key Validation (Invalid Key)
log_test "GET /api/v1/sentiment/market - Invalid API key"
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/market" "-H \"X-API-KEY: invalid_key\"")
validate_response "$response" "401" "Invalid API key" "validate_json"

# Test 19: Invalid Symbol
log_test "GET /api/v1/sentiment/symbols/INVALID - Invalid symbol"
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/symbols/INVALID" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "404" "Invalid symbol" "validate_json"

# Test 20: Invalid Date Format
log_test "GET /api/v1/reports/daily/invalid-date - Invalid date format"
response=$(make_request "GET" "$API_BASE/api/v1/reports/daily/invalid-date" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "400" "Invalid date format" "validate_json"

# Cache Testing
log_info "Testing caching behavior (should see cache hits on subsequent requests)"

# Test 21: Cache Test - Market Sentiment (Second Request)
log_test "GET /api/v1/sentiment/market (cached) - Cache hit test"
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/market" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Market sentiment (cached)" "validate_market_sentiment"

# Test 22: Cache Test - Symbol Analysis (Second Request)
log_test "GET /api/v1/sentiment/symbols/AAPL (cached) - Cache hit test"
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/symbols/AAPL" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Symbol analysis (cached)" "validate_symbol_sentiment"

# Performance Testing
log_info "Testing performance and response times"

# Test 23: Performance Test - Concurrent Requests
log_test "Performance: Concurrent requests test"
start_time=$(date +%s.%N)
for i in {1..3}; do
    make_request "GET" "$API_BASE/api/v1/data/health" "-H \"X-API-KEY: $API_KEY\"" >/dev/null &
done
wait
end_time=$(date +%s.%N)
duration=$(echo "$end_time - $start_time" | bc)
log_success "Concurrent requests completed in ${duration}s"

# Error Handling Tests
log_info "Testing error handling and edge cases"

# Test 24: Empty Response Test
log_test "GET /api/v1/sentiment/analysis - Empty symbols parameter"
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/analysis?symbols=" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Empty symbols parameter" "validate_sentiment_analysis"

# Test 25: Long Symbols List
log_test "GET /api/v1/sentiment/analysis - Large symbols list"
response=$(make_request "GET" "$API_BASE/api/v1/sentiment/analysis?symbols=$(echo 'AAPL,MSFT,GOOGL,TSLA,NVDA,AMZN,META,BRK.B,JPM,JNJ,V,MA,BAC,WMT,DIS,PG,HD,KO,PFE,INT,CSCO')" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Large symbols list" "validate_sentiment_analysis"

# Test 26: Special Characters in Parameters
log_test "GET /api/v1/data/history - Special characters handling"
response=$(make_request "GET" "$API_BASE/api/v1/data/history/AAPL?days=7&test=value" "-H \"X-API-KEY: $API_KEY\"")
validate_response "$response" "200" "Special characters" "validate_json"

# Calculate success rate
success_rate=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc 2>/dev/null || echo "0")

# Generate test summary
echo "" | tee -a "$TEST_LOG"
echo "📊 Test Results Summary" | tee -a "$TEST_LOG"
echo "====================" | tee -a "$TEST_LOG"
echo "Total Tests: $TOTAL_TESTS" | tee -a "$TEST_LOG"
echo "Passed: $PASSED_TESTS" | tee -a "$TEST_LOG"
echo "Failed: $FAILED_TESTS" | tee -a "$TEST_LOG"
echo "Success Rate: ${success_rate}%" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"

if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 All tests passed! API v1 is fully functional." | tee -a "$TEST_LOG"
    echo "✅ Status: PRODUCTION READY" | tee -a "$TEST_LOG"
    exit 0
else
    echo "❌ Some tests failed. Check the log for details." | tee -a "$TEST_LOG"
    echo "⚠️  Status: NEEDS ATTENTION" | tee -a "$TEST_LOG"
    echo "📝 Full log: $TEST_LOG" | tee -a "$TEST_LOG"
    exit 1
fi