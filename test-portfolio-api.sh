#!/bin/bash

# TFT Portfolio Optimization API - Integration Tests
# Tests the new portfolio optimization endpoints

set -e
# Check environment variables
if [[ -z "${X_API_KEY:-}" ]]; then
    echo "❌ ERROR: X_API_KEY environment variable is not set"
    echo "Please set X_API_KEY in your .zshrc or export it:"
    echo "  export X_API_KEY=your_api_key"
    exit 1
fi
echo "✅ X_API_KEY is set (length: 0)"
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
echo "✅ X_API_KEY is set (length: 0)"

# Configuration
API_BASE="https://tft-trading-system.yanggf.workers.dev"
X_API_KEY="yanggf"
TIMEOUT=60

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}TFT Portfolio Optimization API Test${NC}"
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

echo -e "${BLUE}Running Portfolio Optimization API Tests...${NC}"
echo ""

# Test 1: Calculate Correlation Matrix
correlation_data='{
  "symbols": ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"],
  "lookbackPeriod": 252,
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}'

if test_endpoint "POST" "/api/v1/portfolio/correlation" "$correlation_data" "Calculate Correlation Matrix"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 2: Optimize Portfolio - Max Sharpe
optimize_sharpe_data='{
  "symbols": ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"],
  "objective": "MAX_SHARPE",
  "lookbackPeriod": 252,
  "constraints": {
    "minWeight": 0.01,
    "maxWeight": 0.4,
    "riskFreeRate": 0.02
  }
}'

if test_endpoint "POST" "/api/v1/portfolio/optimize" "$optimize_sharpe_data" "Optimize Portfolio - Max Sharpe"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 3: Optimize Portfolio - Min Volatility
optimize_vol_data='{
  "symbols": ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"],
  "objective": "MIN_VOLATILITY",
  "lookbackPeriod": 252,
  "constraints": {
    "minWeight": 0.01,
    "maxWeight": 0.4
  }
}'

if test_endpoint "POST" "/api/v1/portfolio/optimize" "$optimize_vol_data" "Optimize Portfolio - Min Volatility"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 4: Calculate Efficient Frontier
efficient_frontier_data='{
  "symbols": ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"],
  "lookbackPeriod": 252,
  "numPortfolios": 50,
  "constraints": {
    "minWeight": 0.01,
    "maxWeight": 0.4
  }
}'

if test_endpoint "POST" "/api/v1/portfolio/efficient-frontier" "$efficient_frontier_data" "Calculate Efficient Frontier"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 5: Calculate Risk Metrics
risk_metrics_data='{
  "portfolio": {
    "weights": {
      "AAPL": 0.3,
      "MSFT": 0.25,
      "GOOGL": 0.2,
      "TSLA": 0.15,
      "NVDA": 0.1
    },
    "lookbackPeriod": 252
  },
  "confidenceLevels": [0.95, 0.99],
  "timeHorizons": [1, 5, 10]
}'

if test_endpoint "POST" "/api/v1/portfolio/risk-metrics" "$risk_metrics_data" "Calculate Risk Metrics"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 6: Stress Test
stress_test_data='{
  "portfolio": {
    "weights": {
      "AAPL": 0.3,
      "MSFT": 0.25,
      "GOOGL": 0.2,
      "TSLA": 0.15,
      "NVDA": 0.1
    }
  },
  "scenarios": [
    {
      "name": "Market Crash",
      "marketShock": -0.3,
      "volatilityShock": 2.0,
      "correlationShock": 0.3
    },
    {
      "name": "Recession",
      "marketShock": -0.2,
      "volatilityShock": 1.5,
      "correlationShock": 0.2
    }
  ]
}'

if test_endpoint "POST" "/api/v1/portfolio/stress-test" "$stress_test_data" "Portfolio Stress Test"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 7: Performance Attribution
attribution_data='{
  "portfolio": {
    "weights": {
      "AAPL": 0.3,
      "MSFT": 0.25,
      "GOOGL": 0.2,
      "TSLA": 0.15,
      "NVDA": 0.1
    }
  },
  "benchmark": "SPY",
  "lookbackPeriod": 252,
  "attributionMethod": "brinson_fachler"
}'

if test_endpoint "POST" "/api/v1/portfolio/attribution" "$attribution_data" "Performance Attribution"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 8: Comprehensive Analytics
analytics_data='{
  "symbols": ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"],
  "lookbackPeriod": 252,
  "analyses": [
    "correlation_analysis",
    "risk_metrics",
    "performance_attribution",
    "factor_exposure"
  ]
}'

if test_endpoint "POST" "/api/v1/portfolio/analytics" "$analytics_data" "Comprehensive Portfolio Analytics"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 9: Invalid Endpoint (Error Handling)
echo -e "${YELLOW}Testing error handling...${NC}"
echo "Endpoint: /api/v1/portfolio/invalid"
error_response=$(timeout 30 curl -s \
    -H "X-API-KEY: $X_API_KEY" \
    -w "\nHTTP_CODE:%{http_code}" \
    "$API_BASE/api/v1/portfolio/invalid" 2>/dev/null)

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
echo -e "${BLUE}Portfolio Optimization API Test Results${NC}"
echo -e "${BLUE}=====================================${NC}"
echo "Total Tests: $TESTS_TOTAL"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo "Failed: $((TESTS_TOTAL - TESTS_PASSED))"

if [[ $TESTS_PASSED -eq $TESTS_TOTAL ]]; then
    echo -e "\n${GREEN}🎉 All portfolio optimization API tests passed!${NC}"
    echo ""
    echo -e "${BLUE}Available Portfolio Optimization Endpoints:${NC}"
    echo "• POST /api/v1/portfolio/correlation - Calculate correlation matrix"
    echo "• POST /api/v1/portfolio/optimize - Optimize portfolio"
    echo "• POST /api/v1/portfolio/efficient-frontier - Calculate efficient frontier"
    echo "• POST /api/v1/portfolio/risk-metrics - Calculate risk metrics"
    echo "• POST /api/v1/portfolio/stress-test - Stress testing"
    echo "• POST /api/v1/portfolio/attribution - Performance attribution"
    echo "• POST /api/v1/portfolio/analytics - Comprehensive analytics"
    echo ""
    echo -e "${BLUE}Optimization Objectives:${NC}"
    echo "• MAX_SHARPE - Maximum Sharpe ratio"
    echo "• MIN_VOLATILITY - Minimum volatility"
    echo "• RISK_PARITY - Risk parity allocation"
    echo "• EQUAL_WEIGHT - Equal weighting"
    echo ""
    echo -e "${BLUE}Features Tested:${NC}"
    echo "• Multi-asset correlation analysis"
    echo "• Portfolio optimization algorithms"
    echo "• Efficient frontier calculation"
    echo "• Risk metrics (VaR, CVaR, beta)"
    echo "• Stress testing scenarios"
    echo "• Performance attribution analysis"
    exit 0
else
    echo -e "\n${RED}❌ Some portfolio optimization API tests failed.${NC}"
    exit 1
fi