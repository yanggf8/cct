#!/bin/bash

# TFT Risk Management API - Integration Tests
# Tests the new risk management and regulatory compliance endpoints

set -e

# Configuration
API_BASE="https://tft-trading-system.yanggf.workers.dev"
API_KEY="yanggf"
TIMEOUT=60

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}TFT Risk Management API Test${NC}"
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

    curl_cmd="$curl_cmd -H \"X-API-KEY: $API_KEY\" \"$API_BASE$endpoint\""

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

echo -e "${BLUE}Running Risk Management API Tests...${NC}"
echo ""

# Test 1: Comprehensive Risk Assessment
assessment_data='{
  "portfolio": {
    "portfolioId": "test_portfolio_001",
    "weights": {
      "AAPL": 0.3,
      "MSFT": 0.25,
      "GOOGL": 0.2,
      "TSLA": 0.15,
      "NVDA": 0.1
    },
    "totalValue": 1000000,
    "volatility": 0.18
  },
  "marketData": {
    "vix": 22.5,
    "regime": "BULL_MARKET"
  }
}'

if test_endpoint "POST" "/api/v1/risk/assessment" "$assessment_data" "Comprehensive Risk Assessment"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 2: Market Risk Analysis
market_risk_data='{
  "portfolio": {
    "weights": {
      "AAPL": 0.3,
      "MSFT": 0.25,
      "GOOGL": 0.2,
      "TSLA": 0.15,
      "NVDA": 0.1
    },
    "betas": {
      "AAPL": 1.2,
      "MSFT": 0.9,
      "GOOGL": 1.1,
      "TSLA": 1.8,
      "NVDA": 1.5
    }
  },
  "confidenceLevels": [0.95, 0.99]
}'

if test_endpoint "POST" "/api/v1/risk/market" "$market_risk_data" "Market Risk Analysis"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 3: Concentration Risk Analysis
concentration_data='{
  "portfolio": {
    "weights": {
      "AAPL": 0.3,
      "MSFT": 0.25,
      "GOOGL": 0.2,
      "TSLA": 0.15,
      "NVDA": 0.1
    }
  },
  "sectorMapping": {
    "AAPL": "Technology",
    "MSFT": "Technology",
    "GOOGL": "Technology",
    "TSLA": "Consumer Discretionary",
    "NVDA": "Technology"
  }
}'

if test_endpoint "POST" "/api/v1/risk/concentration" "$concentration_data" "Concentration Risk Analysis"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 4: Liquidity Risk Assessment
liquidity_data='{
  "portfolio": {
    "weights": {
      "AAPL": 0.3,
      "MSFT": 0.25,
      "GOOGL": 0.2,
      "TSLA": 0.15,
      "NVDA": 0.1
    },
    "totalValue": 1000000
  },
  "marketData": {
    "averageDailyVolumes": {
      "AAPL": 50000000,
      "MSFT": 30000000,
      "GOOGL": 25000000,
      "TSLA": 100000000,
      "NVDA": 80000000
    }
  }
}'

if test_endpoint "POST" "/api/v1/risk/liquidity" "$liquidity_data" "Liquidity Risk Assessment"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 5: Advanced Stress Testing
stress_test_data='{
  "portfolio": {
    "portfolioId": "test_portfolio_001",
    "weights": {
      "AAPL": 0.3,
      "MSFT": 0.25,
      "GOOGL": 0.2,
      "TSLA": 0.15,
      "NVDA": 0.1
    },
    "totalValue": 1000000,
    "volatility": 0.18
  },
  "scenarios": [
    {
      "name": "Market Crash",
      "marketShock": -0.30,
      "volatilityShock": 2.0,
      "correlationShock": 0.3,
      "probability": 0.02
    },
    {
      "name": "Recession",
      "marketShock": -0.20,
      "volatilityShock": 1.5,
      "correlationShock": 0.2,
      "probability": 0.10
    },
    {
      "name": "Interest Rate Spike",
      "marketShock": -0.10,
      "volatilityShock": 1.2,
      "correlationShock": 0.1,
      "probability": 0.15
    }
  ]
}'

if test_endpoint "POST" "/api/v1/risk/stress-test" "$stress_test_data" "Advanced Stress Testing"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 6: Regulatory Compliance Check
compliance_data='{
  "portfolio": {
    "portfolioId": "test_portfolio_001",
    "weights": {
      "AAPL": 0.3,
      "MSFT": 0.25,
      "GOOGL": 0.2,
      "TSLA": 0.15,
      "NVDA": 0.1
    },
    "totalValue": 1000000
  },
  "frameworks": ["SEC", "FINRA", "MiFID_II", "Basel_III"],
  "riskLimits": {
    "maxVaR": 0.05,
    "maxConcentration": 0.20,
    "maxLeverage": 2.0
  }
}'

if test_endpoint "POST" "/api/v1/risk/compliance" "$compliance_data" "Regulatory Compliance Check"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 7: Risk Limits Monitoring
limits_data='{
  "portfolio": {
    "portfolioId": "test_portfolio_001",
    "weights": {
      "AAPL": 0.3,
      "MSFT": 0.25,
      "GOOGL": 0.2,
      "TSLA": 0.15,
      "NVDA": 0.1
    },
    "totalValue": 1000000,
    "volatility": 0.18
  },
  "riskLimits": {
    "maxVaR": 0.05,
    "maxConcentration": 0.20,
    "maxSectorWeight": 0.30,
    "maxLeverage": 2.0,
    "minLiquidityRatio": 0.15,
    "maxCorrelation": 0.7
  }
}'

if test_endpoint "POST" "/api/v1/risk/limits" "$limits_data" "Risk Limits Monitoring"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 8: Comprehensive Risk Analytics
analytics_data='{
  "portfolio": {
    "portfolioId": "test_portfolio_001",
    "weights": {
      "AAPL": 0.3,
      "MSFT": 0.25,
      "GOOGL": 0.2,
      "TSLA": 0.15,
      "NVDA": 0.1
    },
    "totalValue": 1000000,
    "volatility": 0.18
  },
  "analyses": [
    "market_risk",
    "concentration_risk",
    "liquidity_risk",
    "stress_testing",
    "compliance_check"
  ],
  "timeHorizons": [1, 5, 10, 22]
}'

if test_endpoint "POST" "/api/v1/risk/analytics" "$analytics_data" "Comprehensive Risk Analytics"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 9: Risk Health Check
if test_endpoint "GET" "/api/v1/risk/health" "" "Risk Management Health Check"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 10: Invalid Endpoint (Error Handling)
echo -e "${YELLOW}Testing error handling...${NC}"
echo "Endpoint: /api/v1/risk/invalid"
error_response=$(timeout 30 curl -s \
    -H "X-API-KEY: $API_KEY" \
    -w "\nHTTP_CODE:%{http_code}" \
    "$API_BASE/api/v1/risk/invalid" 2>/dev/null)

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
echo -e "${BLUE}Risk Management API Test Results${NC}"
echo -e "${BLUE}=====================================${NC}"
echo "Total Tests: $TESTS_TOTAL"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo "Failed: $((TESTS_TOTAL - TESTS_PASSED))"

if [[ $TESTS_PASSED -eq $TESTS_TOTAL ]]; then
    echo -e "\n${GREEN}🎉 All risk management API tests passed!${NC}"
    echo ""
    echo -e "${BLUE}Available Risk Management Endpoints:${NC}"
    echo "• POST /api/v1/risk/assessment - Comprehensive risk assessment"
    echo "• POST /api/v1/risk/market - Market risk analysis"
    echo "• POST /api/v1/risk/concentration - Concentration risk analysis"
    echo "• POST /api/v1/risk/liquidity - Liquidity risk assessment"
    echo "• POST /api/v1/risk/stress-test - Advanced stress testing"
    echo "• POST /api/v1/risk/compliance - Regulatory compliance check"
    echo "• POST /api/v1/risk/limits - Risk limits monitoring"
    echo "• POST /api/v1/risk/analytics - Comprehensive risk analytics"
    echo "• GET /api/v1/risk/health - Risk management health check"
    echo ""
    echo -e "${BLUE}Risk Categories Covered:${NC}"
    echo "• Market Risk (VaR, CVaR, beta, volatility)"
    echo "• Credit Risk (default probability, spreads)"
    echo "• Concentration Risk (asset, sector, geographic)"
    echo "• Liquidity Risk (market impact, funding)"
    echo "• Model Risk (accuracy, stability, validation)"
    echo "• Regulatory Risk (SEC, FINRA, MiFID II, Basel III)"
    echo ""
    echo -e "${BLUE}Advanced Features:${NC}"
    echo "• Monte Carlo simulation"
    echo "• Stress testing scenarios"
    echo "• Regulatory compliance frameworks"
    echo "• Risk limits and alerts"
    exit 0
else
    echo -e "\n${RED}❌ Some risk management API tests failed.${NC}"
    exit 1
fi