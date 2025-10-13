#!/bin/bash

# Comprehensive API Test Suite for CCT Trading System
# Tests all 30+ endpoints systematically
# Usage: ./comprehensive-api-test-suite.sh

set -e

# Configuration
BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="yanggf"
TIMEOUT=30
LOG_FILE="api-test-results-$(date +%Y%m%d-%H%M%S).log"

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
SKIPPED_TESTS=0

# Logging function
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Test function
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    local jq_filter="$6"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -e "\n${BLUE}Testing $TOTAL_TESTS: $name${NC}" | tee -a "$LOG_FILE"
    echo "Method: $method, Endpoint: $endpoint" | tee -a "$LOG_FILE"

    local curl_cmd="timeout $TIMEOUT curl -s"

    if [[ "$method" == "POST" ]]; then
        curl_cmd="$curl_cmd -X POST -H 'Content-Type: application/json' -H 'X-API-KEY: $API_KEY' -d '$data'"
    else
        curl_cmd="$curl_cmd -H 'X-API-KEY: $API_KEY'"
    fi

    curl_cmd="$curl_cmd '$BASE_URL$endpoint'"

    local response
    local http_status

    # Execute curl and capture response
    if response=$(eval "$curl_cmd" 2>/dev/null); then
        # Try to get HTTP status from response or assume 200
        if echo "$response" | jq -e '.status' >/dev/null 2>&1; then
            http_status=$(echo "$response" | jq -r '.status // 200')
        else
            http_status=200
        fi

        # Check if response contains success field
        local success
        if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
            success=$(echo "$response" | jq -r '.success')
        else
            success="unknown"
        fi

        # Apply JQ filter if provided
        if [[ -n "$jq_filter" ]]; then
            local filtered_response
            if filtered_response=$(echo "$response" | jq -r "$jq_filter" 2>/dev/null); then
                echo "Filtered Response: $filtered_response" | tee -a "$LOG_FILE"
            else
                log "${YELLOW}⚠️  JQ filter failed${NC}"
            fi
        fi

        # Check expected status
        local status_match=false
        if [[ -n "$expected_status" ]]; then
            case "$expected_status" in
                "success")
                    [[ "$success" == "true" ]] && status_match=true
                    ;;
                "error")
                    [[ "$success" == "false" ]] && status_match=true
                    ;;
                "any")
                    status_match=true
                    ;;
            esac
        else
            status_match=true
        fi

        if [[ "$status_match" == "true" ]]; then
            log "${GREEN}✅ PASSED${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            log "${RED}❌ FAILED - Expected status: $expected_status, Got: $success${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi

    else
        log "${RED}❌ FAILED - Request timeout or connection error${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Test categories
echo -e "${BLUE}CCT Trading System - Comprehensive API Test Suite${NC}" | tee "$LOG_FILE"
echo "Base URL: $BASE_URL" | tee -a "$LOG_FILE"
echo "API Key: $API_KEY" | tee -a "$LOG_FILE"
echo "Started at: $(date)" | tee -a "$LOG_FILE"
echo "======================================" | tee -a "$LOG_FILE"

# 1. System Health Endpoints
echo -e "\n${YELLOW}🏥 SYSTEM HEALTH ENDPOINTS${NC}" | tee -a "$LOG_FILE"

test_endpoint "Legacy Health Check" "GET" "/health" "" "success"
test_endpoint "API v1 Health Check" "GET" "/api/v1/data/health" "" "success"
test_endpoint "Model Health Check" "GET" "/model-health" "" "success"
test_endpoint "API v1 Model Health" "GET" "/api/v1/data/health?model=true" "" "success"
test_endpoint "API v1 Cron Health" "GET" "/api/v1/data/health?cron=true" "" "success"

# 2. Sentiment Analysis Endpoints
echo -e "\n${YELLOW}📊 SENTIMENT ANALYSIS ENDPOINTS${NC}" | tee -a "$LOG_FILE"

test_endpoint "Legacy Analyze" "POST" "/analyze" '{"symbols":["AAPL","MSFT","GOOGL"]}' "success"
test_endpoint "API v1 Sentiment Analysis" "GET" "/api/v1/sentiment/analysis?symbols=AAPL,MSFT" "" "success"
test_endpoint "API v1 Symbol Analysis" "GET" "/api/v1/sentiment/symbols/AAPL" "" "success"
test_endpoint "API v1 Market Sentiment" "GET" "/api/v1/sentiment/market" "" "success"
test_endpoint "API v1 Sector Sentiment" "GET" "/api/v1/sentiment/sectors" "" "success"

# 3. Report Endpoints
echo -e "\n${YELLOW}📋 REPORT ENDPOINTS${NC}" | tee -a "$LOG_FILE"

test_endpoint "Legacy Results" "GET" "/results" "" "success"
test_endpoint "API v1 Daily Report" "GET" "/api/v1/reports/daily/latest" "" "success"
test_endpoint "API v1 Weekly Report" "GET" "/api/v1/reports/weekly/latest" "" "success"
test_endpoint "Legacy Pre-Market" "GET" "/pre-market-briefing" "" "success"
test_endpoint "Legacy Intraday" "GET" "/intraday-check" "" "success"
test_endpoint "Legacy End-of-Day" "GET" "/end-of-day-summary" "" "success"
test_endpoint "Legacy Weekly Review" "GET" "/weekly-review" "" "success"

# 4. Data Access Endpoints
echo -e "\n${YELLOW}💾 DATA ACCESS ENDPOINTS${NC}" | tee -a "$LOG_FILE"

test_endpoint "API v1 Available Symbols" "GET" "/api/v1/data/symbols" "" "success"
test_endpoint "API v1 Symbol History" "GET" "/api/v1/data/history/AAPL?days=30" "" "success"
test_endpoint "API v1 KV Debug" "GET" "/kv-debug" "" "success"
test_endpoint "API v1 KV Test" "GET" "/kv-verification-test" "" "success"

# 5. Sector Rotation Endpoints
echo -e "\n${YELLOW}🔄 SECTOR ROTATION ENDPOINTS${NC}" | tee -a "$LOG_FILE"

test_endpoint "Sector Rotation Results" "GET" "/api/v1/sector-rotation/results" "" "success"
test_endpoint "Sector Rotation Sectors" "GET" "/api/v1/sector-rotation/sectors" "" "success"
test_endpoint "Sector Rotation ETF Analysis" "GET" "/api/v1/sector-rotation/etf/XLK" "" "success"

# 6. Market Drivers Endpoints
echo -e "\n${YELLOW}🚀 MARKET DRIVERS ENDPOINTS${NC}" | tee -a "$LOG_FILE"

test_endpoint "Market Drivers Snapshot" "GET" "/api/v1/market-drivers/snapshot" "" "success"
test_endpoint "Market Drivers Enhanced Snapshot" "GET" "/api/v1/market-drivers/snapshot/enhanced" "" "success"
test_endpoint "Market Drivers Macro" "GET" "/api/v1/market-drivers/macro" "" "success"
test_endpoint "Market Drivers Regime" "GET" "/api/v1/market-drivers/regime" "" "success"

# 7. Market Intelligence Endpoints
echo -e "\n${YELLOW}🧠 MARKET INTELLIGENCE ENDPOINTS${NC}" | tee -a "$LOG_FILE"

test_endpoint "Market Intelligence Dashboard" "GET" "/api/v1/market-intelligence/dashboard" "" "success"
test_endpoint "Market Intelligence Synopsis" "GET" "/api/v1/market-intelligence/synopsis" "" "success"
test_endpoint "Market Intelligence Top Picks" "GET" "/api/v1/market-intelligence/top-picks" "" "success"
test_endpoint "Market Intelligence Risk Report" "GET" "/api/v1/market-intelligence/risk-report" "" "success"

# 8. Predictive Analytics Endpoints
echo -e "\n${YELLOW}🔮 PREDICTIVE ANALYTICS ENDPOINTS${NC}" | tee -a "$LOG_FILE"

test_endpoint "Predictive Signals" "GET" "/api/v1/predictive/signals" "" "success"
test_endpoint "Predictive Patterns" "GET" "/api/v1/predictive/patterns" "" "success"
test_endpoint "Predictive Insights" "GET" "/api/v1/predictive/insights" "" "success"
test_endpoint "Predictive Forecast" "GET" "/api/v1/predictive/forecast" "" "success"
test_endpoint "Predictive Health" "GET" "/api/v1/predictive/health" "" "success"

# 9. Test Endpoints
echo -e "\n${YELLOW}🧪 TEST ENDPOINTS${NC}" | tee -a "$LOG_FILE"

test_endpoint "Test Sentiment" "GET" "/test-sentiment" "" "success"
test_endpoint "Test Facebook/Notifications" "GET" "/test-facebook" "" "success"

# 10. API Root and Documentation
echo -e "\n${YELLOW}📖 API DOCUMENTATION ENDPOINTS${NC}" | tee -a "$LOG_FILE"

test_endpoint "API v1 Root" "GET" "/api/v1" "" "success"

# 11. Performance Tests
echo -e "\n${YELLOW}⚡ PERFORMANCE TESTS${NC}" | tee -a "$LOG_FILE"

test_endpoint "Performance Test" "GET" "/api/v1/data/performance-test" "" "success"

# Calculate results
echo -e "\n${BLUE}=====================================${NC}" | tee -a "$LOG_FILE"
echo -e "${BLUE}TEST RESULTS SUMMARY${NC}" | tee -a "$LOG_FILE"
echo -e "${BLUE}=====================================${NC}" | tee -a "$LOG_FILE"

echo "Total Tests: $TOTAL_TESTS" | tee -a "$LOG_FILE"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}" | tee -a "$LOG_FILE"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}" | tee -a "$LOG_FILE"
echo -e "Skipped: ${YELLOW}$SKIPPED_TESTS${NC}" | tee -a "$LOG_FILE"

# Calculate success rate
if [[ $TOTAL_TESTS -gt 0 ]]; then
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "Success Rate: $SUCCESS_RATE%" | tee -a "$LOG_FILE"
else
    echo "Success Rate: N/A" | tee -a "$LOG_FILE"
fi

echo "Test completed at: $(date)" | tee -a "$LOG_FILE"
echo "Full log saved to: $LOG_FILE" | tee -a "$LOG_FILE"

# Exit with appropriate code
if [[ $FAILED_TESTS -gt 0 ]]; then
    echo -e "\n${RED}⚠️  Some tests failed. Check the log for details.${NC}"
    exit 1
else
    echo -e "\n${GREEN}🎉 All tests passed successfully!${NC}"
    exit 0
fi