#!/bin/bash

# Market Drivers API Integration Test Script
# Tests all Market Drivers endpoints with proper authentication

API_BASE="https://tft-trading-system.yanggf.workers.dev"
API_KEY="yanggf"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}=====================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=====================================${NC}"
}

print_test() {
    echo -e "\n${YELLOW}Testing: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_TESTS++))
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_TESTS++))
}

# Test function
test_endpoint() {
    local endpoint="$1"
    local description="$2"
    local expected_field="$3"

    print_test "$description"
    ((TOTAL_TESTS++))

    echo "GET $endpoint"

    # Make the API call with timeout
    response=$(timeout 30 curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "X-API-KEY: $API_KEY" \
        -H "Content-Type: application/json" \
        "$API_BASE$endpoint")

    # Extract HTTP status and body
    http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
    body=$(echo "$response" | sed -e 's/HTTP_STATUS:[0-9]*$//')

    echo "HTTP Status: $http_status"

    if [ "$http_status" = "200" ]; then
        # Check if expected field exists in response
        if echo "$body" | jq -e ".data.$expected_field" > /dev/null 2>&1; then
            print_success "✓ $description - HTTP $http_status"

            # Show sample of response data
            echo "Response sample:"
            echo "$body" | jq -r ".data.$expected_field | if type == \"object\" then keys[] else . end" | head -3 | sed 's/^/  - /'
        else
            print_error "✗ $description - Missing expected field: $expected_field"
            echo "Response body:"
            echo "$body" | head -5
        fi
    else
        print_error "✗ $description - HTTP $http_status"
        echo "Response body:"
        echo "$body" | head -5
    fi
}

# Enhanced test for complex endpoints
test_enhanced_endpoint() {
    local endpoint="$1"
    local description="$2"
    local fields=("${!3}") # Array of expected fields

    print_test "$description"
    ((TOTAL_TESTS++))

    echo "GET $endpoint"

    response=$(timeout 45 curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -H "X-API-KEY: $API_KEY" \
        -H "Content-Type: application/json" \
        "$API_BASE$endpoint")

    http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
    body=$(echo "$response" | sed -e 's/HTTP_STATUS:[0-9]*$//')

    echo "HTTP Status: $http_status"

    if [ "$http_status" = "200" ]; then
        # Check multiple fields
        all_fields_exist=true
        for field in "${fields[@]}"; do
            if ! echo "$body" | jq -e "$field" > /dev/null 2>&1; then
                all_fields_exist=false
                break
            fi
        done

        if [ "$all_fields_exist" = true ]; then
            print_success "✓ $description - HTTP $http_status"

            # Show response structure
            echo "Response structure:"
            echo "$body" | jq -r 'paths(scalars) as $p | $p | join(".")' | head -5 | sed 's/^/  - /'
        else
            print_error "✗ $description - Missing expected fields"
            echo "Expected one of: ${fields[*]}"
            echo "Response body:"
            echo "$body" | head -5
        fi
    else
        print_error "✗ $description - HTTP $http_status"
        echo "Response body:"
        echo "$body" | head -5
    fi
}

# Start testing
print_header "Market Drivers API Integration Tests"
echo "API Base: $API_BASE"
echo "API Key: $API_KEY"
echo "Started at: $(date)"

# Test 1: API Root - Check Market Drivers endpoints are listed
print_header "API Root Documentation Test"
((TOTAL_TESTS++))

print_test "API root endpoint lists Market Drivers endpoints"
response=$(timeout 15 curl -s -w "\nHTTP_STATUS:%{http_code}" "$API_BASE/api/v1")
http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
body=$(echo "$response" | sed -e 's/HTTP_STATUS:[0-9]*$//')

if [ "$http_status" = "200" ] && echo "$body" | jq -e ".data.available_endpoints.market_drivers" > /dev/null 2>&1; then
    print_success "✓ API root lists Market Drivers endpoints"
    echo "Available Market Drivers endpoints:"
    echo "$body" | jq -r '.data.available_endpoints.market_drivers | to_entries[] | "  - \(.key): \(.value)"'
else
    print_error "✗ API root missing Market Drivers endpoints"
fi

# Test 2: Market Drivers Health Check
print_header "System Health Tests"
test_endpoint "/api/v1/market-drivers/health" "Market Drivers System Health" "status"

# Test 3: Basic Market Drivers Snapshot
print_header "Market Drivers Snapshot Tests"
test_endpoint "/api/v1/market-drivers/snapshot" "Complete Market Drivers Snapshot" "regime"

# Test 4: Enhanced Market Drivers Snapshot
print_header "Enhanced Market Drivers Tests"
((TOTAL_TESTS++))
print_test "Enhanced Market Drivers Snapshot with full analysis"

response=$(timeout 60 curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "X-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    "$API_BASE/api/v1/market-drivers/snapshot/enhanced")

http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
body=$(echo "$response" | sed -e 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $http_status"

if [ "$http_status" = "200" ]; then
    # Check for enhanced analysis fields
    if echo "$body" | jq -e ".data.basic.regime" > /dev/null 2>&1 && \
       echo "$body" | jq -e ".data.enhancedMacro" > /dev/null 2>&1 && \
       echo "$body" | jq -e ".data.enhancedRegime" > /dev/null 2>&1; then
        print_success "✓ Enhanced Market Drivers Snapshot - HTTP $http_status"

        # Show regime analysis sample
        echo "Enhanced Regime Analysis:"
        echo "$body" | jq -r '.data.enhancedRegime | {
          currentRegime,
          confidence,
          regimeStrength: .regimeStrength.overall,
          transitionRisk: .transitionRisk.probability
        } | to_entries[] | "  \(.key): \(.value)"'
    else
        print_error "✗ Enhanced Market Drivers Snapshot - Missing enhanced fields"
    fi
else
    print_error "✗ Enhanced Market Drivers Snapshot - HTTP $http_status"
fi

# Test 5: Individual Component Tests
print_header "Individual Component Tests"

# Macroeconomic Drivers
test_endpoint "/api/v1/market-drivers/macro" "Macroeconomic Drivers Analysis" "macro"

# Market Structure
test_endpoint "/api/v1/market-drivers/market-structure" "Market Structure Indicators" "market_structure"

# Market Regime
test_endpoint "/api/v1/market-drivers/regime" "Market Regime Classification" "regime"

# Geopolitical Risk
test_endpoint "/api/v1/market-drivers/geopolitical" "Geopolitical Risk Analysis" "geopolitical"

# Test 6: Historical Data
print_header "Historical Data Tests"
test_endpoint "/api/v1/market-drivers/history?days=7" "Market Drivers 7-Day History" "data"

# Test 7: Query Parameter Tests
print_header "Query Parameter Tests"
((TOTAL_TESTS++))
print_test "Market Drivers Snapshot with cache disabled"

response=$(timeout 30 curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "X-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    "$API_BASE/api/v1/market-drivers/snapshot?cache=false")

http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
body=$(echo "$response" | sed -e 's/HTTP_STATUS:[0-9]*$//')

if [ "$http_status" = "200" ]; then
    print_success "✓ Market Drivers Snapshot with cache disabled"
    echo "Cache setting response:"
    echo "$body" | jq -r '.metadata.source // "unknown"'
else
    print_error "✗ Market Drivers Snapshot with cache disabled - HTTP $http_status"
fi

# Test 8: Authentication Test
print_header "Authentication Tests"
((TOTAL_TESTS++))
print_test "Market Drivers endpoint without API key (should fail)"

response=$(timeout 15 curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "Content-Type: application/json" \
    "$API_BASE/api/v1/market-drivers/health")

http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)

if [ "$http_status" = "401" ]; then
    print_success "✓ Authentication properly enforced - HTTP $http_status"
else
    print_error "✗ Authentication not enforced - HTTP $http_status (expected 401)"
fi

# Test 9: Error Handling Test
print_header "Error Handling Tests"
((TOTAL_TESTS++))
print_test "Invalid Market Drivers endpoint (should return 404)"

response=$(timeout 15 curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "X-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    "$API_BASE/api/v1/market-drivers/invalid")

http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)

if [ "$http_status" = "404" ]; then
    print_success "✓ Invalid endpoint properly handled - HTTP $http_status"
else
    print_error "✗ Invalid endpoint not handled correctly - HTTP $http_status (expected 404)"
fi

# Test 10: Performance Test
print_header "Performance Tests"
((TOTAL_TESTS++))
print_test "Market Drivers API response time"

start_time=$(date +%s%N)
response=$(timeout 30 curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "X-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    "$API_BASE/api/v1/market-drivers/snapshot")
end_time=$(date +%s%N)
duration_ms=$(( (end_time - start_time) / 1000000 ))

http_status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)

if [ "$http_status" = "200" ] && [ $duration_ms -lt 30000 ]; then
    print_success "✓ Market Drivers API response time: ${duration_ms}ms (< 30s)"
elif [ "$http_status" = "200" ]; then
    print_success "✓ Market Drivers API response time: ${duration_ms}ms (slow but successful)"
else
    print_error "✗ Market Drivers API performance test failed - HTTP $http_status"
fi

# Final Results
print_header "Integration Test Results"
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
echo "Success Rate: $success_rate%"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All Market Drivers API tests passed!${NC}"
    echo "The Market Drivers system is fully operational."
    exit 0
else
    echo -e "\n${YELLOW}⚠️  Some tests failed. Review the output above.${NC}"
    exit 1
fi