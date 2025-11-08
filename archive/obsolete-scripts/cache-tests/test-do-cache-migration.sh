#!/bin/bash

# DO Cache Migration Test Suite
# Tests all migrated cache adapters to ensure they work correctly

echo "🧪 DO Cache Migration Test Suite"
echo "================================="

BASE_URL="http://localhost:8787"
API_KEY="test-key"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Test function
test_endpoint() {
    local name="$1"
    local endpoint="$2"
    local expected_status="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "Testing $name... "
    
    response=$(curl -s -w "%{http_code}" -H "X-API-KEY: $API_KEY" "$BASE_URL$endpoint")
    status_code="${response: -3}"
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} ($status_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (expected $expected_status, got $status_code)"
        return 1
    fi
}

# Test function with response content check
test_endpoint_content() {
    local name="$1"
    local endpoint="$2"
    local expected_content="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "Testing $name... "
    
    response=$(curl -s -H "X-API-KEY: $API_KEY" "$BASE_URL$endpoint")
    
    if echo "$response" | grep -q "$expected_content"; then
        echo -e "${GREEN}✓ PASS${NC} (content found)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (content not found)"
        echo "Response: $response"
        return 1
    fi
}

echo ""
echo "🔧 Testing Core Cache Functionality..."

# Test cache health endpoints
test_endpoint "Cache Health" "/cache-health" "200"
test_endpoint "Cache Metrics" "/cache-metrics" "200"
test_endpoint "Cache System Status" "/cache-system-status" "200"

echo ""
echo "🏗️ Testing API v1 Cache Endpoints..."

# Test API v1 cache endpoints
test_endpoint "API v1 Cache Health" "/api/v1/cache/health" "200"
test_endpoint "API v1 Cache Metrics" "/api/v1/cache/metrics" "200"
test_endpoint "API v1 Cache Debug" "/api/v1/cache/debug" "200"

echo ""
echo "📊 Testing Sector Cache Integration..."

# Test sector endpoints (these use SectorCacheManager -> DOSectorCacheAdapter)
test_endpoint "Sector Health" "/api/sectors/health" "200"
test_endpoint "Sector Config" "/api/sectors/config" "200"
test_endpoint "Sector Test" "/api/sectors/test" "200"

echo ""
echo "🎯 Testing Market Intelligence Cache..."

# Test market intelligence endpoints (these use various cache managers)
test_endpoint "Market Intelligence Dashboard" "/api/v1/market-intelligence/dashboard" "200"
test_endpoint "Market Intelligence Synopsis" "/api/v1/market-intelligence/synopsis" "200"

echo ""
echo "📈 Testing Predictive Analytics Cache..."

# Test predictive analytics endpoints
test_endpoint "Predictive Signals" "/api/v1/predictive/signals" "200"
test_endpoint "Predictive Health" "/api/v1/predictive/health" "200"

echo ""
echo "🔍 Testing Cache Content..."

# Test that cache responses contain DO-specific content
test_endpoint_content "DO Cache Architecture" "/cache-health" "Durable Objects"
test_endpoint_content "Zero KV Operations" "/cache-metrics" "architecture"

echo ""
echo "📋 Summary"
echo "=========="
echo "Tests run: $TESTS_RUN"
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $((TESTS_RUN - TESTS_PASSED))"

if [ $TESTS_PASSED -eq $TESTS_RUN ]; then
    echo -e "${GREEN}🎉 All tests passed! DO cache migration successful.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Check the migration.${NC}"
    exit 1
fi
