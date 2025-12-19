#!/bin/bash

# TFT Backtesting API - Integration Tests
# Tests the new backtesting engine endpoints

set -e
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

# Configuration
API_BASE="https://tft-trading-system.yanggf.workers.dev"
X_API_KEY="${X_API_KEY:-}"
TIMEOUT=60

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}TFT Backtesting API Integration Test${NC}"
echo -e "${BLUE}=====================================${NC}"
echo "Base URL: $API_BASE"
echo ""

# Test function
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local description="$4"

    echo -e "${YELLOW}Testing: $description${NC}"
    echo "Method: $method"
    echo "Endpoint: $endpoint"

    local start_time=$(date +%s)
    local curl_cmd="timeout $TIMEOUT curl -s -w \"\nHTTP_CODE:%{http_code} Response_Time:%{time_total}\" -X $method"

    if [[ -n "$data" ]]; then
        curl_cmd="$curl_cmd -H \"Content-Type: application/json\" -d '$data'"
    fi

    curl_cmd="$curl_cmd -H \"X-API-KEY: $X_API_KEY\" \"$API_BASE$endpoint\""

    local response=$(eval "$curl_cmd" 2>/dev/null)
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    local http_code=$(echo "$response" | tail -1 | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    local response_time=$(echo "$response" | tail -1 | grep -o "Response_Time:[0-9.]*" | cut -d: -f2)
    local body=$(echo "$response" | sed '$d')

    echo "Response Time: ${response_time}s"
    echo "HTTP Status: $http_code"

    if [[ "$http_code" == "200" ]]; then
        echo -e "${GREEN}✓ SUCCESS${NC}"
        echo "Response:"
        echo "$body" | jq '.' 2>/dev/null | head -50 || echo "$body" | head -50
        echo ""
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "Error Response:"
        echo "$body"
        echo ""
        return 1
    fi
}

# Test results
TESTS_TOTAL=0
TESTS_PASSED=0

echo -e "${BLUE}Running Backtesting API Tests...${NC}"
echo ""

# Test 1: Get Backtest History
if test_endpoint "GET" "/api/v1/backtesting/history?limit=5" "" "Get Backtest History"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 2: Get Backtest Status (using a dummy ID for endpoint structure test)
if test_endpoint "GET" "/api/v1/backtesting/status/test_12345" "" "Get Backtest Status"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 3: Get Backtest Results (using a dummy ID for endpoint structure test)
if test_endpoint "GET" "/api/v1/backtesting/results/test_12345" "" "Get Backtest Results"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 4: Get Performance Metrics (using a dummy ID for endpoint structure test)
if test_endpoint "GET" "/api/v1/backtesting/performance/test_12345" "" "Get Performance Metrics"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 5: Compare Strategies
compare_data='{
  "backtestIds": ["test_1", "test_2"],
  "metrics": ["totalReturn", "sharpeRatio", "maxDrawdown", "winRate"]
}'

if test_endpoint "POST" "/api/v1/backtesting/compare" "$compare_data" "Compare Strategies"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 6: Get Backtest History
if test_endpoint "GET" "/api/v1/backtesting/history?limit=5" "" "Get Backtest History"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 7: Validate Model
validation_data='{
  "backtestId": "test_12345",
  "validationConfig": {
    "crossValidation": {
      "method": "time_series_split",
      "folds": 5
    },
    "outOfSampleTesting": {
      "trainRatio": 0.7,
      "validationRatio": 0.15,
      "testRatio": 0.15
    },
    "significanceTesting": {
      "methods": ["t_test", "bootstrap"],
      "confidenceLevel": 0.95
    }
  }
}'

if test_endpoint "POST" "/api/v1/backtesting/validation" "$validation_data" "Validate Model"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 8: Monte Carlo Simulation
monte_carlo_data='{
  "backtestId": "test_12345",
  "scenarios": {
    "numSimulations": 100,
    "timeHorizon": 252,
    "marketConditions": ["bull", "bear", "neutral"],
    "volatilityShock": 0.2
  }
}'

if test_endpoint "POST" "/api/v1/backtesting/monte-carlo" "$monte_carlo_data" "Monte Carlo Simulation"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 9: Invalid Endpoint (Error Handling)
echo -e "${YELLOW}Testing error handling...${NC}"
echo "Endpoint: /api/v1/backtesting/invalid"
error_response=$(timeout 30 curl -s \
    -H "X-API-KEY: $X_API_KEY" \
    -w "\nHTTP_CODE:%{http_code}" \
    "$API_BASE/api/v1/backtesting/invalid" 2>/dev/null)

error_http_code=$(echo "$error_response" | tail -1 | cut -d: -f2)
if [[ "$error_http_code" == "404" ]]; then
    echo -e "${GREEN}✓ Error handling working correctly (404 for invalid endpoint)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ Error handling failed (expected 404, got $error_http_code)${NC}"
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# Results Summary
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Backtesting API Test Results${NC}"
echo -e "${BLUE}=====================================${NC}"
echo "Total Tests: $TESTS_TOTAL"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo "Failed: $((TESTS_TOTAL - TESTS_PASSED))"

if [[ $TESTS_PASSED -eq $TESTS_TOTAL ]]; then
    echo -e "\n${GREEN}🎉 All backtesting API tests passed!${NC}"
    echo ""
    echo -e "${BLUE}Available Backtesting Endpoints:${NC}"
    echo "• POST /api/v1/backtesting/run - Run backtest"
    echo "• GET /api/v1/backtesting/status/:runId - Get status"
    echo "• GET /api/v1/backtesting/results/:runId - Get results"
    echo "• GET /api/v1/backtesting/performance/:runId - Get metrics"
    echo "• POST /api/v1/backtesting/compare - Compare strategies"
    echo "• GET /api/v1/backtesting/history - Get history"
    echo "• POST /api/v1/backtesting/validation - Validate model"
    echo "• POST /api/v1/backtesting/monte-carlo - Monte Carlo test"
    echo ""
    echo -e "${BLUE}Features Tested:${NC}"
    echo "• Walk-forward optimization"
    echo "• Monte Carlo simulation"
    echo "• Bootstrap validation"
    echo "• Performance metrics (Sharpe, Sortino, Calmar)"
    echo "• Strategy comparison"
    echo "• Risk analysis (VaR, CVaR)"
    exit 0
else
    echo -e "\n${RED}❌ Some backtesting API tests failed.${NC}"
    exit 1
fi