#!/bin/bash

# TFT AI Predictive Analytics API - Integration Tests
# Tests the new AI-powered predictive analytics endpoints

set -e

# Configuration
API_BASE="https://tft-trading-system.yanggf.workers.dev"
X_API_KEY="yanggf"
TIMEOUT=90

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}TFT AI Predictive Analytics API Test${NC}"
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

echo -e "${BLUE}Running AI Predictive Analytics API Tests...${NC}"
echo ""

# Test 1: Get Trading Signals
if test_endpoint "GET" "/api/v1/predictive/signals" "" "Get Trading Signals"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 2: Get Market Patterns
if test_endpoint "GET" "/api/v1/predictive/patterns" "" "Get Market Patterns"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 3: Get AI Insights
if test_endpoint "GET" "/api/v1/predictive/insights" "" "Get AI Insights"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 3: Get Market Patterns
if test_endpoint "GET" "/api/v1/predictive/patterns" "" "Get Market Patterns"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 4: Get AI Insights
if test_endpoint "GET" "/api/v1/predictive/insights" "" "Get AI Insights"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 5: Get Market Forecast
forecast_data='{
  "timeframe": "1w",
  "indicators": ["technical", "fundamental", "sentiment", "volatility"],
  "confidence": 70
}'

if test_endpoint "POST" "/api/v1/predictive/forecast" "$forecast_data" "Get Market Forecast"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 6: AI Model Health Check
if test_endpoint "GET" "/api/v1/predictive/health" "" "AI Model Health Check"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 7: Ensemble Prediction
ensemble_data='{
  "models": ["gpt_oss_120b", "distilbert"],
  "predictionType": "sector_rotation",
  "timeframe": "1w",
  "consensus": true
}'

if test_endpoint "POST" "/api/v1/predictive/ensemble" "$ensemble_data" "Ensemble Prediction"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 8: Symbol-Specific Prediction
symbol_prediction_data='{
  "symbol": "AAPL",
  "predictionType": "price_direction",
  "timeframe": "3d",
  "includeIndicators": ["technical", "sentiment", "volume"]
}'

if test_endpoint "POST" "/api/v1/predictive/symbol" "$symbol_prediction_data" "Symbol-Specific Prediction"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 9: Prediction Accuracy Analysis
accuracy_data='{
  "timeframe": "1w",
  "lookbackPeriod": 90,
  "models": ["gpt_oss_120b", "distilbert"]
}'

if test_endpoint "POST" "/api/v1/predictive/accuracy" "$accuracy_data" "Prediction Accuracy Analysis"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 10: Market Regime Prediction
regime_data='{
  "features": ["volatility", "trend", "correlation", "volume"],
  "lookbackPeriod": 60,
  "confidenceThreshold": 75
}'

if test_endpoint "POST" "/api/v1/predictive/regime" "$regime_data" "Market Regime Prediction"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 11: Volatility Forecast
volatility_data='{
  "symbol": "SPY",
  "timeframe": "1w",
  "method": "garch",
  "confidenceInterval": 0.95
}'

if test_endpoint "POST" "/api/v1/predictive/volatility" "$volatility_data" "Volatility Forecast"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 12: Sentiment-Enhanced Prediction
sentiment_prediction_data='{
  "symbols": ["AAPL", "MSFT", "GOOGL"],
  "sentimentWeight": 0.3,
  "technicalWeight": 0.4,
  "fundamentalWeight": 0.3,
  "timeframe": "1w"
}'

if test_endpoint "POST" "/api/v1/predictive/sentiment-enhanced" "$sentiment_prediction_data" "Sentiment-Enhanced Prediction"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# Test 13: Invalid Endpoint (Error Handling)
echo -e "${YELLOW}Testing error handling...${NC}"
echo "Endpoint: /api/v1/predictive/invalid"
error_response=$(timeout 30 curl -s \
    -H "X-API-KEY: $X_API_KEY" \
    -w "\nHTTP_CODE:%{http_code}" \
    "$API_BASE/api/v1/predictive/invalid" 2>/dev/null)

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
echo -e "${BLUE}AI Predictive Analytics API Test Results${NC}"
echo -e "${BLUE}=====================================${NC}"
echo "Total Tests: $TESTS_TOTAL"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo "Failed: $((TESTS_TOTAL - TESTS_PASSED))"

if [[ $TESTS_PASSED -eq $TESTS_TOTAL ]]; then
    echo -e "\n${GREEN}🎉 All AI predictive analytics API tests passed!${NC}"
    echo ""
    echo -e "${BLUE}Available AI Predictive Analytics Endpoints:${NC}"
    echo "• POST /api/v1/predictive/generate - Generate market prediction"
    echo "• GET /api/v1/predictive/signals - Get trading signals"
    echo "• GET /api/v1/predictive/patterns - Get market patterns"
    echo "• GET /api/v1/predictive/insights - Get AI insights"
    echo "• POST /api/v1/predictive/forecast - Get market forecast"
    echo "• GET /api/v1/predictive/health - AI model health check"
    echo "• POST /api/v1/predictive/ensemble - Ensemble prediction"
    echo "• POST /api/v1/predictive/symbol - Symbol-specific prediction"
    echo "• POST /api/v1/predictive/accuracy - Prediction accuracy analysis"
    echo "• POST /api/v1/predictive/regime - Market regime prediction"
    echo "• POST /api/v1/predictive/volatility - Volatility forecast"
    echo "• POST /api/v1/predictive/sentiment-enhanced - Sentiment-enhanced prediction"
    echo ""
    echo -e "${BLUE}AI Models Integrated:${NC}"
    echo "• GPT-OSS-120B - Complex reasoning and analysis"
    echo "• DistilBERT-SST-2 - Fast sentiment classification"
    echo "• Dual AI consensus and disagreement detection"
    echo "• Confidence scoring and uncertainty quantification"
    echo ""
    echo -e "${BLUE}Prediction Types:${NC}"
    echo "• Market direction (bullish/bearish/neutral/volatile)"
    echo "• Sector rotation analysis"
    echo "• Volatility forecasting"
    echo "• Regime transition prediction"
    echo "• Price movement magnitude prediction"
    echo ""
    echo -e "${BLUE}Timeframes Supported:${NC}"
    echo "• 1d (1 day)"
    echo "• 3d (3 days)"
    echo "• 1w (1 week)"
    echo "• 2w (2 weeks)"
    echo "• 1m (1 month)"
    exit 0
else
    echo -e "\n${RED}❌ Some AI predictive analytics API tests failed.${NC}"
    exit 1
fi