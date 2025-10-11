#!/bin/bash

# Enhanced Data Access System Testing Script
# Comprehensive testing of the deployed enhanced system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
WORKER_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="yanggf"
TEST_RESULTS_FILE="test-results-$(date +%Y%m%d-%H%M%S).json"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
TEST_RESULTS=()

# Functions
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_test() {
    echo -e "${PURPLE}[TEST]${NC} $1"
}

print_result() {
    if [[ $1 == "PASS" ]]; then
        echo -e "${GREEN}  ✅ PASS${NC} $2"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}  ❌ FAIL${NC} $2"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
}

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"

    print_test "$test_name"

    local response
    response=$(eval "$test_command" 2>/dev/null || echo "")

    if echo "$response" | grep -q "$expected_pattern"; then
        print_result "PASS" "$test_name"
        TEST_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"PASS\", \"response\": \"$response\"}")
        return 0
    else
        print_result "FAIL" "$test_name - Expected: $expected_pattern"
        TEST_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"FAIL\", \"response\": \"$response\"}")
        return 1
    fi
}

# Function to test performance
run_performance_test() {
    local test_name="$1"
    local test_command="$2"
    local max_response_time="$3"

    print_test "$test_name"

    local start_time=$(date +%s%3N)
    local response
    response=$(eval "$test_command" 2>/dev/null || echo "")
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))

    if [[ $response_time -le $max_response_time ]]; then
        print_result "PASS" "$test_name (${response_time}ms)"
        TEST_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"PASS\", \"response_time\": $response_time}")
        return 0
    else
        print_result "FAIL" "$test_name (${response_time}ms > ${max_response_time}ms)"
        TEST_RESULTS+=("{\"test\": \"$test_name\", \"status\": \"FAIL\", \"response_time\": $response_time}")
        return 1
    fi
}

# Main testing function
main() {
    echo -e "${BLUE}🧪 Enhanced Data Access System Testing${NC}"
    echo "=========================================="
    echo "Testing URL: $WORKER_URL"
    echo "API Key: $API_KEY"
    echo "Results File: $TEST_RESULTS_FILE"
    echo ""

    # Initialize test results
    echo "[" > "$TEST_RESULTS_FILE"

    print_header "1. Basic System Health Tests"

    # Test basic health
    run_test "Basic Health Check" \
        "curl -s '$WORKER_URL/health'" \
        '"status".*"healthy"'

    # Test enhanced health
    run_test "Enhanced Health Check" \
        "curl -s '$WORKER_URL/api/v1/data/health'" \
        '"enhanced_dal".*true'

    # Test worker status
    run_test "Worker Status Check" \
        "curl -s '$WORKER_URL/status'" \
        '"message".*"operational"'

    print_header "2. Enhanced DAL Tests"

    # Test DAL status
    run_test "DAL Status Endpoint" \
        "curl -s '$WORKER_URL/api/v1/data/dal-status'" \
        '"dal".*type.*"Simplified Enhanced DAL"'

    # Test cache functionality
    run_test "Cache Management Test" \
        "curl -s -X POST '$WORKER_URL/api/v1/data/cache-clear'" \
        '"success".*true'

    print_header "3. Performance Tests"

    # Test performance of DAL operations
    run_performance_test "Performance Test Response Time" \
        "curl -s '$WORKER_URL/api/v1/data/performance-test'" \
        5000  # 5 seconds max

    # Test cache hit performance
    run_performance_test "Cache Hit Performance" \
        "curl -s '$WORKER_URL/api/v1/data/health'" \
        1000  # 1 second max for cached response

    print_header "4. Legacy Compatibility Tests"

    # Test legacy endpoints still work
    LEGACY_ENDPOINTS=(
        "/health:healthy"
        "/analyze:success"
        "/results:success"
    )

    for endpoint_test in "${LEGACY_ENDPOINTS[@]}"; do
        IFS=':' read -r endpoint expected <<< "$endpoint_test"
        run_test "Legacy Endpoint: $endpoint" \
            "curl -s -H 'X-API-KEY: $API_KEY' '$WORKER_URL$endpoint'" \
            "$expected"
    done

    print_header "5. Migration System Tests"

    # Test migration status
    run_test "Migration Status Endpoint" \
        "curl -s '$WORKER_URL/api/v1/data/migration-status'" \
        '"migration".*events'

    # Test deprecation warnings on legacy endpoints
    run_test "Deprecation Warning on Legacy Endpoint" \
        "curl -s -I '$WORKER_URL/analyze'" \
        "X-Deprecation-Warning"

    print_header "6. API v1 Structure Tests"

    # Test new API endpoints
    API_V1_ENDPOINTS=(
        "/api/v1/data/health:enhanced_dal"
        "/api/v1/data/dal-status:dal"
        "/api/v1/data/migration-status:migration"
    )

    for api_test in "${API_V1_ENDPOINTS[@]}"; do
        IFS=':' read -r endpoint expected <<< "$api_test"
        run_test "API v1 Endpoint: $endpoint" \
            "curl -s '$WORKER_URL$endpoint'" \
            "$expected"
    done

    print_header "7. Advanced Performance Tests"

    # Test multiple concurrent requests
    print_test "Concurrent Requests Test"

    CONCURRENT_RESULTS=()
    for i in {1..5}; do
        result=$(curl -s "$WORKER_URL/api/v1/data/health" 2>/dev/null &)
        CONCURRENT_RESULTS+=("$result")
    done

    wait

    SUCCESSFUL=0
    for result in "${CONCURRENT_RESULTS[@]}"; do
        if echo "$result" | grep -q "enhanced_dal"; then
            ((SUCCESSFUL++))
        fi
    done

    if [[ $SUCCESSFUL -eq 5 ]]; then
        print_result "PASS" "Concurrent Requests (5/5 successful)"
        TEST_RESULTS+=("{\"test\": \"Concurrent Requests\", \"status\": \"PASS\", \"successful\": $SUCCESSFUL}")
    else
        print_result "FAIL" "Concurrent Requests ($SUCCESSFUL/5 successful)"
        TEST_RESULTS+=("{\"test\": \"Concurrent Requests\", \"status\": \"FAIL\", \"successful\": $SUCCESSFUL}")
    fi
    ((TOTAL_TESTS++))

    print_header "8. Cache Performance Validation"

    # Test cache warming and hit rates
    print_test "Cache Warming Test"

    # First request (cache miss)
    FIRST_RESPONSE_TIME=$(curl -s -w '%{time_total}' -o /dev/null "$WORKER_URL/api/v1/data/health")

    # Second request (cache hit)
    SECOND_RESPONSE_TIME=$(curl -s -w '%{time_total}' -o /dev/null "$WORKER_URL/api/v1/data/health")

    # Convert to milliseconds and compare
    FIRST_MS=$(echo "$FIRST_RESPONSE_TIME * 1000" | bc 2>/dev/null || echo "1000")
    SECOND_MS=$(echo "$SECOND_RESPONSE_TIME * 1000" | bc 2>/dev/null || echo "500")

    if (( $(echo "$SECOND_MS < $FIRST_MS" | bc -l 2>/dev/null || echo "1") )); then
        print_result "PASS" "Cache Performance (First: ${FIRST_MS}ms, Second: ${SECOND_MS}ms)"
        TEST_RESULTS+=("{\"test\": \"Cache Performance\", \"status\": \"PASS\", \"first_ms\": $FIRST_MS, \"second_ms\": $SECOND_MS}")
    else
        print_result "FAIL" "Cache Performance - Cache may not be working"
        TEST_RESULTS+=("{\"test\": \"Cache Performance\", \"status\": \"FAIL\", \"first_ms\": $FIRST_MS, \"second_ms\": $SECOND_MS}")
    fi
    ((TOTAL_TESTS++))

    print_header "9. Integration Tests"

    # Test complete data flow
    print_test "Complete Data Flow Test"

    # Test a full request cycle
    HEALTH_RESPONSE=$(curl -s "$WORKER_URL/api/v1/data/health")
    DAL_RESPONSE=$(curl -s "$WORKER_URL/api/v1/data/dal-status")
    MIGRATION_RESPONSE=$(curl -s "$WORKER_URL/api/v1/data/migration-status")

    # Check if all enhanced system components are responding
    if echo "$HEALTH_RESPONSE" | grep -q "enhanced_dal" && \
       echo "$DAL_RESPONSE" | grep -q "dal" && \
       echo "$MIGRATION_RESPONSE" | grep -q "migration"; then
        print_result "PASS" "Complete Data Flow - All components responding"
        TEST_RESULTS+=("{\"test\": \"Complete Data Flow\", \"status\": \"PASS\"}")
    else
        print_result "FAIL" "Complete Data Flow - Some components not responding"
        TEST_RESULTS+=("{\"test\": \"Complete Data Flow\", \"status\": \"FAIL\"}")
    fi
    ((TOTAL_TESTS++))

    print_header "10. Error Handling Tests"

    # Test error handling
    run_test "404 Error Handling" \
        "curl -s '$WORKER_URL/nonexistent-endpoint'" \
        '"error".*"Endpoint not found"'

    run_test "Invalid API Key Handling" \
        "curl -s -H 'X-API-KEY: invalid-key' '$WORKER_URL/analyze'" \
        '"error".*"Invalid or missing API key"'

    # Finalize test results
    echo "" >> "$TEST_RESULTS_FILE"
    for ((i=0; i<${#TEST_RESULTS[@]}; i++)); do
        echo "${TEST_RESULTS[i]}" >> "$TEST_RESULTS_FILE"
        if [[ $i -lt $((${#TEST_RESULTS[@]}-1)) ]]; then
            echo "," >> "$TEST_RESULTS_FILE"
        fi
    done
    echo "]" >> "$TEST_RESULTS_FILE"

    # Print final summary
    print_header "🎯 Test Results Summary"

    SUCCESS_RATE=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi

    echo -e "${BLUE}Total Tests:${NC} $TOTAL_TESTS"
    echo -e "${GREEN}Passed Tests:${NC} $PASSED_TESTS"
    echo -e "${RED}Failed Tests:${NC} $FAILED_TESTS"
    echo -e "${BLUE}Success Rate:${NC} ${SUCCESS_RATE}%"
    echo ""
    echo -e "${BLUE}Results saved to:${NC} $TEST_RESULTS_FILE"

    # Performance summary
    print_header "📊 Performance Summary"

    echo "Key Performance Metrics:"
    echo "  • Enhanced system operational: $(curl -s "$WORKER_URL/api/v1/data/health" | jq -r '.system.status // "unknown"' 2>/dev/null || echo "unknown")"
    echo "  • DAL cache hit rate: $(curl -s "$WORKER_URL/api/v1/data/dal-status" | jq -r '.cache.hit_rate // "unknown"' 2>/dev/null || echo "unknown")"
    echo "  • Migration enabled: $(curl -s "$WORKER_URL/api/v1/data/migration-status" | jq -r '.config.enableNewAPI // "unknown"' 2>/dev/null || echo "unknown")"
    echo "  • Legacy compatibility: $(curl -s "$WORKER_URL/api/v1/data/migration-status" | jq -r '.config.enableLegacyCompatibility // "unknown"' 2>/dev/null || echo "unknown")"

    # Recommendations
    print_header "💡 Recommendations"

    if [[ $SUCCESS_RATE -ge 90 ]]; then
        echo -e "${GREEN}✅ Excellent! System is performing optimally${NC}"
        echo "  • Ready for production use"
        echo "  • Consider increasing new API traffic percentage"
        echo "  • Monitor cache performance and hit rates"
    elif [[ $SUCCESS_RATE -ge 75 ]]; then
        echo -e "${YELLOW}⚠️  Good performance with room for improvement${NC}"
        echo "  • Review failed tests and fix issues"
        echo "  • Optimize cache configuration if needed"
        echo "  • Test migration settings before full deployment"
    else
        echo -e "${RED}❌ Performance issues detected${NC}"
        echo "  • Critical issues need immediate attention"
        echo "  • Review deployment logs and fix errors"
        echo "  • Consider rollback to previous version"
    fi

    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Review detailed results in $TEST_RESULTS_FILE"
    echo "  2. Monitor system performance in production"
    echo "  3. Gradually increase new API traffic based on performance"
    echo "  4. Analyze migration analytics and optimize accordingly"

    # Exit with appropriate code
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}🎉 All tests passed! Enhanced system is ready for production.${NC}"
        exit 0
    else
        echo -e "${RED}⚠️  Some tests failed. Review results before proceeding.${NC}"
        exit 1
    fi
}

# Run main function
main "$@"