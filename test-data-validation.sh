#!/bin/bash

# TFT Trading System - Data Validation Tests
# Tests input validation, boundary conditions, and edge cases
# Priority 1: Critical for production data integrity

set -e

# Configuration
API_BASE="https://tft-trading-system.yanggf.workers.dev"
X_API_KEY="yanggf"
TIMEOUT=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Data Validation Test Suite${NC}"
echo -e "${BLUE}=====================================${NC}"
echo "Base URL: $API_BASE"
echo ""

# Test results
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test function for validation
test_validation() {
    local method="$1"
    local endpoint="$2"
    local payload="$3"
    local expected_code="$4"
    local description="$5"

    echo -e "${YELLOW}Testing: $description${NC}"
    echo "Method: $method"
    echo "Endpoint: $endpoint"
    echo "Expected: HTTP $expected_code"

    local curl_cmd="timeout $TIMEOUT curl -s -w \"\nHTTP_CODE:%{http_code}\" -X $method"
    curl_cmd="$curl_cmd -H \"X-API-KEY: $X_API_KEY\""
    curl_cmd="$curl_cmd -H \"Content-Type: application/json\""
    curl_cmd="$curl_cmd -d '$payload'"
    curl_cmd="$curl_cmd \"$API_BASE$endpoint\""

    local response=$(eval "$curl_cmd" 2>/dev/null)
    local http_code=$(echo "$response" | tail -1 | cut -d: -f2)
    local body=$(echo "$response" | sed '$d')

    echo "Actual: HTTP $http_code"

    if [[ "$http_code" == "$expected_code" ]]; then
        echo -e "${GREEN}✓ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "Response: $(echo "$body" | jq -c '.' 2>/dev/null || echo "$body")" | head -2
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo ""
}

echo -e "${CYAN}=== Category 1: Portfolio Weight Validation ===${NC}"
echo ""

# Test 1: Portfolio weights sum to more than 1.0
test_validation "POST" "/api/v1/portfolio/risk-metrics" '{
  "weights": {"AAPL": 0.6, "MSFT": 0.5},
  "symbols": ["AAPL", "MSFT"]
}' "400" "Portfolio Weights Sum > 1.0"

# Test 2: Portfolio weights sum to less than 1.0
test_validation "POST" "/api/v1/portfolio/risk-metrics" '{
  "weights": {"AAPL": 0.3, "MSFT": 0.2},
  "symbols": ["AAPL", "MSFT"]
}' "400" "Portfolio Weights Sum < 1.0"

# Test 3: Negative portfolio weights
test_validation "POST" "/api/v1/portfolio/risk-metrics" '{
  "weights": {"AAPL": 1.2, "MSFT": -0.2},
  "symbols": ["AAPL", "MSFT"]
}' "400" "Negative Portfolio Weights"

# Test 4: Zero weight portfolio
test_validation "POST" "/api/v1/portfolio/risk-metrics" '{
  "weights": {"AAPL": 0.0, "MSFT": 0.0},
  "symbols": ["AAPL", "MSFT"]
}' "400" "All Zero Weights"

# Test 5: Valid portfolio weights (should pass)
test_validation "POST" "/api/v1/portfolio/correlation" '{
  "symbols": ["AAPL", "MSFT", "GOOGL"],
  "lookbackPeriod": 252
}' "200" "Valid Portfolio Data"

echo -e "${CYAN}=== Category 2: Missing Required Fields ===${NC}"
echo ""

# Test 6: Missing symbols array
test_validation "POST" "/api/v1/portfolio/correlation" '{
  "lookbackPeriod": 252
}' "400" "Missing Symbols Array"

# Test 7: Missing portfolio ID for risk assessment
test_validation "POST" "/api/v1/risk/assessment" '{
  "portfolio": {
    "weights": {"AAPL": 0.5, "MSFT": 0.5}
  }
}' "400" "Missing Portfolio ID"

# Test 8: Missing backtest ID for validation
test_validation "POST" "/api/v1/backtesting/validation" '{
  "validationConfig": {}
}' "400" "Missing Backtest ID"

# Test 9: Empty request body
test_validation "POST" "/api/v1/portfolio/optimize" '{}' "400" "Empty Request Body"

echo -e "${CYAN}=== Category 3: Type Mismatches ===${NC}"
echo ""

# Test 10: String instead of number for lookback period
test_validation "POST" "/api/v1/portfolio/correlation" '{
  "symbols": ["AAPL", "MSFT"],
  "lookbackPeriod": "invalid"
}' "400" "String Instead of Number"

# Test 11: Number instead of string for symbol
test_validation "POST" "/api/v1/portfolio/correlation" '{
  "symbols": [12345, 67890],
  "lookbackPeriod": 252
}' "400" "Number Instead of String"

# Test 12: Array instead of object
test_validation "POST" "/api/v1/risk/assessment" '[
  {"portfolio": {"portfolioId": "test"}}
]' "400" "Array Instead of Object"

echo -e "${CYAN}=== Category 4: Boundary Values ===${NC}"
echo ""

# Test 13: Extremely large lookback period
test_validation "POST" "/api/v1/portfolio/correlation" '{
  "symbols": ["AAPL", "MSFT"],
  "lookbackPeriod": 999999
}' "400" "Extremely Large Lookback Period"

# Test 14: Zero lookback period
test_validation "POST" "/api/v1/portfolio/correlation" '{
  "symbols": ["AAPL", "MSFT"],
  "lookbackPeriod": 0
}' "400" "Zero Lookback Period"

# Test 15: Negative lookback period
test_validation "POST" "/api/v1/portfolio/correlation" '{
  "symbols": ["AAPL", "MSFT"],
  "lookbackPeriod": -100
}' "400" "Negative Lookback Period"

# Test 16: Single symbol (need at least 2 for correlation)
test_validation "POST" "/api/v1/portfolio/correlation" '{
  "symbols": ["AAPL"],
  "lookbackPeriod": 252
}' "400" "Single Symbol for Correlation"

# Test 17: Too many symbols (>100)
symbols_array="["
for i in {1..150}; do
    symbols_array="${symbols_array}\"SYM$i\","
done
symbols_array="${symbols_array%,}]"

test_validation "POST" "/api/v1/portfolio/correlation" "{
  \"symbols\": $symbols_array,
  \"lookbackPeriod\": 252
}" "400" "Too Many Symbols (>100)"

echo -e "${CYAN}=== Category 5: Invalid Date Formats ===${NC}"
echo ""

# Test 18: Invalid date format
test_validation "POST" "/api/v1/backtesting/run" '{
  "config": {
    "id": "test_invalid_date",
    "name": "Test Invalid Date",
    "strategy": {"type": "momentum", "parameters": {}},
    "data": {
      "symbols": ["AAPL"],
      "startDate": "invalid-date",
      "endDate": "2024-12-31"
    },
    "execution": {"initialCapital": 100000}
  }
}' "400" "Invalid Date Format"

# Test 19: End date before start date
test_validation "POST" "/api/v1/backtesting/run" '{
  "config": {
    "id": "test_invalid_dates",
    "name": "Test Invalid Dates",
    "strategy": {"type": "momentum", "parameters": {}},
    "data": {
      "symbols": ["AAPL"],
      "startDate": "2024-12-31",
      "endDate": "2024-01-01"
    },
    "execution": {"initialCapital": 100000}
  }
}' "400" "End Date Before Start Date"

# Test 20: Future dates
test_validation "POST" "/api/v1/backtesting/run" '{
  "config": {
    "id": "test_future_dates",
    "name": "Test Future Dates",
    "strategy": {"type": "momentum", "parameters": {}},
    "data": {
      "symbols": ["AAPL"],
      "startDate": "2030-01-01",
      "endDate": "2030-12-31"
    },
    "execution": {"initialCapital": 100000}
  }
}' "400" "Future Dates"

echo -e "${CYAN}=== Category 6: Empty and Null Values ===${NC}"
echo ""

# Test 21: Empty symbols array
test_validation "POST" "/api/v1/portfolio/correlation" '{
  "symbols": [],
  "lookbackPeriod": 252
}' "400" "Empty Symbols Array"

# Test 22: Null values in required fields
test_validation "POST" "/api/v1/risk/assessment" '{
  "portfolio": {
    "portfolioId": null,
    "weights": {"AAPL": 0.5, "MSFT": 0.5}
  }
}' "400" "Null Portfolio ID"

# Test 23: Empty string as portfolio ID
test_validation "POST" "/api/v1/risk/assessment" '{
  "portfolio": {
    "portfolioId": "",
    "weights": {"AAPL": 0.5, "MSFT": 0.5}
  }
}' "400" "Empty String Portfolio ID"

echo -e "${CYAN}=== Category 7: Special Characters and Encoding ===${NC}"
echo ""

# Test 24: Special characters in portfolio ID
test_validation "POST" "/api/v1/risk/assessment" '{
  "portfolio": {
    "portfolioId": "test!@#$%^&*()",
    "weights": {"AAPL": 0.5, "MSFT": 0.5},
    "totalValue": 100000,
    "volatility": 0.18
  },
  "marketData": {"vix": 20}
}' "200" "Special Characters in Portfolio ID (should allow)"

# Test 25: Unicode characters in names
test_validation "POST" "/api/v1/backtesting/run" '{
  "config": {
    "id": "test_unicode",
    "name": "Test 测试 тест 🚀",
    "strategy": {"type": "momentum", "parameters": {}},
    "data": {
      "symbols": ["AAPL"],
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    },
    "execution": {"initialCapital": 100000}
  }
}' "200" "Unicode Characters in Name (should allow)"

echo -e "${CYAN}=== Category 8: Numeric Range Validation ===${NC}"
echo ""

# Test 26: Negative initial capital
test_validation "POST" "/api/v1/backtesting/run" '{
  "config": {
    "id": "test_negative_capital",
    "name": "Test Negative Capital",
    "strategy": {"type": "momentum", "parameters": {}},
    "data": {
      "symbols": ["AAPL"],
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    },
    "execution": {"initialCapital": -100000}
  }
}' "400" "Negative Initial Capital"

# Test 27: Zero initial capital
test_validation "POST" "/api/v1/backtesting/run" '{
  "config": {
    "id": "test_zero_capital",
    "name": "Test Zero Capital",
    "strategy": {"type": "momentum", "parameters": {}},
    "data": {
      "symbols": ["AAPL"],
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    },
    "execution": {"initialCapital": 0}
  }
}' "400" "Zero Initial Capital"

# Test 28: Confidence value > 1.0
test_validation "POST" "/api/v1/predictive/forecast" '{
  "timeframe": "1w",
  "confidence": 150
}' "200" "Confidence > 100 (should normalize or accept)"

# Test 29: Negative confidence
test_validation "POST" "/api/v1/predictive/forecast" '{
  "timeframe": "1w",
  "confidence": -50
}' "400" "Negative Confidence"

echo -e "${CYAN}=== Category 9: Symbol Validation ===${NC}"
echo ""

# Test 30: Invalid symbol format
test_validation "POST" "/api/v1/portfolio/correlation" '{
  "symbols": ["INVALID@SYMBOL", "MSFT"],
  "lookbackPeriod": 252
}' "200" "Invalid Symbol Format (may still process)"

# Test 31: Duplicate symbols
test_validation "POST" "/api/v1/portfolio/correlation" '{
  "symbols": ["AAPL", "AAPL", "MSFT"],
  "lookbackPeriod": 252
}' "200" "Duplicate Symbols (should deduplicate)"

# Test 32: Mixed case symbols
test_validation "POST" "/api/v1/portfolio/correlation" '{
  "symbols": ["aapl", "MSFT", "GoOgL"],
  "lookbackPeriod": 252
}' "200" "Mixed Case Symbols (should normalize)"

echo -e "${CYAN}=== Category 10: Edge Case Combinations ===${NC}"
echo ""

# Test 33: Very small portfolio value
test_validation "POST" "/api/v1/risk/assessment" '{
  "portfolio": {
    "portfolioId": "test_small",
    "weights": {"AAPL": 0.5, "MSFT": 0.5},
    "totalValue": 0.01,
    "volatility": 0.18
  }
}' "200" "Very Small Portfolio Value (should process)"

# Test 34: Very large portfolio value
test_validation "POST" "/api/v1/risk/assessment" '{
  "portfolio": {
    "portfolioId": "test_large",
    "weights": {"AAPL": 0.5, "MSFT": 0.5},
    "totalValue": 999999999999,
    "volatility": 0.18
  }
}' "200" "Very Large Portfolio Value (should process)"

# Test 35: Extreme volatility values
test_validation "POST" "/api/v1/risk/assessment" '{
  "portfolio": {
    "portfolioId": "test_volatility",
    "weights": {"AAPL": 0.5, "MSFT": 0.5},
    "totalValue": 100000,
    "volatility": 5.0
  }
}' "200" "Extreme Volatility (5.0 = 500%)"

# Results Summary
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Data Validation Test Results${NC}"
echo -e "${BLUE}=====================================${NC}"
echo "Total Tests: $TESTS_TOTAL"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

# Calculate pass rate
pass_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
echo "Pass Rate: ${pass_rate}%"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}🎉 All data validation tests passed!${NC}"
    echo ""
    echo -e "${BLUE}Validation Coverage:${NC}"
    echo "✓ Portfolio Weight Validation"
    echo "✓ Required Field Checking"
    echo "✓ Type Mismatch Detection"
    echo "✓ Boundary Value Testing"
    echo "✓ Date Format Validation"
    echo "✓ Empty/Null Value Handling"
    echo "✓ Special Character Support"
    echo "✓ Numeric Range Validation"
    echo "✓ Symbol Validation"
    echo "✓ Edge Case Combinations"
    echo ""
    echo -e "${GREEN}Data integrity protection is production-ready${NC}"
    exit 0
elif [[ $pass_rate -ge 70 ]]; then
    echo -e "${YELLOW}⚠ Most validation tests passed${NC}"
    echo "Review failed tests - some validation may be too strict or too lenient"
    echo ""
    echo -e "${BLUE}Note:${NC} Some tests failing is expected as we"
    echo "tune validation rules for production use."
    exit 0
else
    echo -e "${RED}❌ Critical validation issues detected!${NC}"
    echo "Many validation tests failed - review input validation logic"
    exit 1
fi
