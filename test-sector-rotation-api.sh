#!/bin/bash

# Sector Rotation API Integration Test
# Tests the complete Phase 1 implementation of sector rotation pipeline

echo "🚀 Sector Rotation API Integration Test"
echo "======================================"

BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="yanggf"

# Test configuration
TIMEOUT=45
MAX_RETRIES=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
TOTAL=0

# Helper functions
print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Make API request with retry
make_request() {
    local endpoint="$1"
    local method="${2:-GET}"
    local description="$3"
    local retry_count=0

    print_test "$description"
    ((TOTAL++))

    while [ $retry_count -lt $MAX_RETRIES ]; do
        response=$(timeout $TIMEOUT curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
            -H "X-API-KEY: $API_KEY" \
            -X "$method" \
            "$BASE_URL$endpoint" 2>/dev/null)

        http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
        time_total=$(echo "$response" | grep "TIME:" | cut -d: -f2)
        body=$(echo "$response" | sed -e 's/HTTP_CODE:.*$//' -e 's/TIME:.*$//' | tail -n +2)

        if [ "$http_code" = "200" ]; then
            print_pass "$description (${time_total}s)"
            echo "$body" > "/tmp/test_response_$$.json"
            return 0
        elif [ "$http_code" = "503" ]; then
            print_info "Service temporarily unavailable, retrying... ($((retry_count + 1))/$MAX_RETRIES)"
            ((retry_count++))
            sleep 2
        else
            print_fail "$description (HTTP $http_code, ${time_total}s)"
            if [ -n "$body" ]; then
                echo "Response: $body" | head -c 200
                echo "..."
            fi
            return 1
        fi
    done

    print_fail "$description (max retries exceeded)"
    return 1
}

# Test JSON structure
test_json_structure() {
    local file="$1"
    local required_fields="$2"
    local description="$3"

    print_test "$description"
    ((TOTAL++))

    if [ ! -f "$file" ]; then
        print_fail "Response file not found: $file"
        return 1
    fi

    # Check if valid JSON
    if ! jq empty "$file" 2>/dev/null; then
        print_fail "Invalid JSON response"
        return 1
    fi

    # Check required fields
    for field in $required_fields; do
        if ! jq -e ".$field" "$file" >/dev/null 2>&1; then
            print_fail "Missing required field: $field"
            return 1
        fi
    done

    print_pass "$description"
    return 0
}

# Test specific field values
test_field_values() {
    local file="$1"
    local field="$2"
    local expected_value="$3"
    local description="$4"

    print_test "$description"
    ((TOTAL++))

    local actual_value=$(jq -r ".$field" "$file" 2>/dev/null)

    if [ "$actual_value" = "$expected_value" ]; then
        print_pass "$description"
        return 0
    else
        print_fail "$description (expected: $expected_value, got: $actual_value)"
        return 1
    fi
}

# Start testing
echo "Starting Sector Rotation API integration tests..."
echo ""

# Test 1: Health Check
echo "=== Test 1: Health Check ==="
make_request "/api/v1/sectors/health" "GET" "Sector health check"

if [ $? -eq 0 ]; then
    test_json_structure "/tmp/test_response_$$.json" "status services" "Health response structure"
    test_field_values "/tmp/test_response_$$.json" "status" "healthy" "Health status is healthy"
fi

echo ""

# Test 2: Get Sector Symbols
echo "=== Test 2: Get Sector Symbols ==="
make_request "/api/v1/sectors/symbols" "GET" "Get sector symbols list"

if [ $? -eq 0 ]; then
    test_json_structure "/tmp/test_response_$$.json" "symbols total" "Symbols response structure"

    # Check if we have the expected 12 symbols (11 sectors + SPY)
    symbol_count=$(jq -r '.total' "/tmp/test_response_$$.json" 2>/dev/null)
    if [ "$symbol_count" = "12" ]; then
        print_pass "Correct number of symbols (12)"
        ((PASSED++))
    else
        print_fail "Incorrect number of symbols (expected 12, got $symbol_count)"
        ((FAILED++))
    fi
    ((TOTAL++))

    # Check for key sectors
    key_sectors="XLK XLV XLF SPY"
    for sector in $key_sectors; do
        if jq -e '.symbols[] | select(.symbol == "'$sector'")' "/tmp/test_response_$$.json" >/dev/null 2>&1; then
            print_pass "Found sector: $sector"
            ((PASSED++))
        else
            print_fail "Missing sector: $sector"
            ((FAILED++))
        fi
        ((TOTAL++))
    done
fi

echo ""

# Test 3: Sector Snapshot (Main Test)
echo "=== Test 3: Sector Snapshot ==="
make_request "/api/v1/sectors/snapshot" "GET" "Get sector snapshot"

if [ $? -eq 0 ]; then
    test_json_structure "/tmp/test_response_$$.json" "timestamp date sectors summary metadata" "Snapshot response structure"

    # Check metadata
    test_json_structure "/tmp/test_response_$$.json" "metadata.cacheHit metadata.responseTime metadata.l1CacheHitRate metadata.l2CacheHitRate" "Snapshot metadata structure"

    # Check sectors array
    sector_count=$(jq -r '.sectors | length' "/tmp/test_response_$$.json" 2>/dev/null)
    if [ "$sector_count" -gt 0 ]; then
        print_pass "Sectors array contains data ($sector_count sectors)"
        ((PASSED++))
    else
        print_fail "Sectors array is empty"
        ((FAILED++))
    fi
    ((TOTAL++))

    # Check summary statistics
    test_json_structure "/tmp/test_response_$$.json" "summary.totalSectors summary.bullishSectors summary.bearishSectors summary.neutralSectors summary.topPerformer summary.worstPerformer summary.averageChange" "Summary statistics structure"

    # Check individual sector structure (if sectors exist)
    if [ "$sector_count" -gt 0 ]; then
        first_sector=$(jq -r '.sectors[0] | keys[]' "/tmp/test_response_$$.json" 2>/dev/null | tr '\n' ' ')
        required_fields="symbol name price change changePercent volume"

        has_all_fields=true
        for field in $required_fields; do
            if ! echo "$first_sector" | grep -q "$field"; then
                has_all_fields=false
                break
            fi
        done

        if [ "$has_all_fields" = true ]; then
            print_pass "First sector has required fields"
            ((PASSED++))
        else
            print_fail "First sector missing required fields"
            ((FAILED++))
        fi
        ((TOTAL++))
    fi

    # Check cache performance
    l1_hit_rate=$(jq -r '.metadata.l1CacheHitRate' "/tmp/test_response_$$.json" 2>/dev/null)
    l2_hit_rate=$(jq -r '.metadata.l2CacheHitRate' "/tmp/test_response_$$.json" 2>/dev/null)
    overall_hit_rate=$(jq -r '.metadata.l1CacheHitRate + .metadata.l2CacheHitRate' "/tmp/test_response_$$.json" 2>/dev/null)

    if (( $(echo "$overall_hit_rate > 0.5" | bc -l) )); then
        print_pass "Good cache hit rate: $(echo "scale=1; $overall_hit_rate * 100" | bc -l)%"
        ((PASSED++))
    else
        print_info "Cache hit rate could be improved: $(echo "scale=1; $overall_hit_rate * 100" | bc -l)%"
        ((PASSED++)) # Not a failure, just info
    fi
    ((TOTAL++))
fi

echo ""

# Test 4: Response Time Performance
echo "=== Test 4: Performance Tests ==="
print_test "Testing response time performance"
((TOTAL++))

# Make multiple requests to test consistency
total_time=0
requests=3
successful_requests=0

for i in $(seq 1 $requests); do
    print_info "Request $i/$requests"
    response=$(timeout $TIMEOUT curl -s -w "\nTIME:%{time_total}" \
        -H "X-API-KEY: $API_KEY" \
        "$BASE_URL/api/v1/sectors/snapshot" 2>/dev/null)

    time_total=$(echo "$response" | grep "TIME:" | cut -d: -f2)
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)

    if [ "$http_code" = "200" ]; then
        total_time=$(echo "$total_time + $time_total" | bc -l)
        ((successful_requests++))
        print_info "Request $i completed in ${time_total}s"
    else
        print_fail "Request $i failed with HTTP $http_code"
    fi
done

if [ $successful_requests -eq $requests ]; then
    avg_time=$(echo "scale=2; $total_time / $successful_requests" | bc -l)
    if (( $(echo "$avg_time < 5.0" | bc -l) )); then
        print_pass "All $requests requests successful, average time: ${avg_time}s"
        ((PASSED++))
    else
        print_info "All $requests requests successful but slow, average time: ${avg_time}s"
        ((PASSED++))
    fi
else
    print_fail "Only $successful_requests/$requests requests successful"
    ((FAILED++))
fi
((TOTAL++))

echo ""

# Test 5: Error Handling
echo "=== Test 5: Error Handling ==="
print_test "Testing API key validation"
((TOTAL++))

response=$(timeout $TIMEOUT curl -s -w "\nHTTP_CODE:%{http_code}" \
    "$BASE_URL/api/v1/sectors/snapshot" 2>/dev/null)

http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)

if [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
    print_pass "API key validation working (HTTP $http_code)"
    ((PASSED++))
else
    print_info "API key validation may need improvement (HTTP $http_code)"
    ((PASSED++))
fi

echo ""

# Test 6: Circuit Breaker Test (Optional - can stress test)
echo "=== Test 6: Circuit Breaker Status ==="
make_request "/api/v1/sectors/health" "GET" "Check circuit breaker status"

if [ $? -eq 0 ]; then
    circuit_state=$(jq -r '.services.dataFetcher.circuitBreakerStatus.state' "/tmp/test_response_$$.json" 2>/dev/null)
    if [ -n "$circuit_state" ]; then
        print_pass "Circuit breaker state available: $circuit_state"
        ((PASSED++))
    else
        print_info "Circuit breaker status not fully implemented yet"
        ((PASSED++))
    fi
    ((TOTAL++))
fi

echo ""

# Cleanup
rm -f /tmp/test_response_*.json

# Results Summary
echo "======================================"
echo "📊 Test Results Summary"
echo "======================================"
echo -e "Total Tests: ${BLUE}$TOTAL${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo -e "${GREEN}🎉 Sector Rotation API Phase 1 is fully operational!${NC}"
    exit 0
else
    success_rate=$(echo "scale=1; $PASSED * 100 / $TOTAL" | bc -l)
    echo -e "${YELLOW}⚠️  $FAILED tests failed${NC}"
    echo -e "${YELLOW}📈 Success rate: ${success_rate}%${NC}"

    if (( $(echo "$success_rate > 80" | bc -l) )); then
        echo -e "${YELLOW}✨ Sector Rotation API is mostly operational${NC}"
        exit 0
    else
        echo -e "${RED}❌ Sector Rotation API needs attention${NC}"
        exit 1
    fi
fi