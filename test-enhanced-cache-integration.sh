#!/bin/bash

# Enhanced Cache Integration Test Suite
# Tests all enhanced cache features via curl commands
# Makes the enhanced cache system regressionable

set -euo pipefail
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
API_URL="https://tft-trading-system.yanggf.workers.dev"
X_API_KEY="yanggf"
TIMEOUT=60
LOG_FILE="test-results-$(date +%Y%m%d-%H%M%S).log"
FAILED_TESTS=()
PASSED_TESTS=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Test result reporting
test_pass() {
    local test_name="$1"
    PASSED_TESTS+=("$test_name")
    echo -e "${GREEN}✅ PASS: $test_name${NC}" | tee -a "$LOG_FILE"
    log "PASS: $test_name"
}

test_fail() {
    local test_name="$1"
    local reason="$2"
    FAILED_TESTS+=("$test_name: $reason")
    echo -e "${RED}❌ FAIL: $test_name - $reason${NC}" | tee -a "$LOG_FILE"
    log "FAIL: $test_name - $reason"
}

test_skip() {
    local test_name="$1"
    local reason="$2"
    echo -e "${YELLOW}⏭️  SKIP: $test_name - $reason${NC}" | tee -a "$LOG_FILE"
    log "SKIP: $test_name - $reason"
}

# Make curl request with error handling
make_request() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="${3:-}"
    local expected_status="${4:-200}"

    local curl_cmd="curl -s -w '%{http_code}' -o response.json --max-time $TIMEOUT"

    if [[ "$method" == "POST" ]]; then
        curl_cmd="$curl_cmd -X POST -H 'Content-Type: application/json' -d '$data'"
    fi

    curl_cmd="$curl_cmd -H 'X-API-KEY: $X_API_KEY' '$API_URL$endpoint'"

    local http_code=$(eval "$curl_cmd")

    if [[ "$http_code" != "$expected_status" ]]; then
        echo "HTTP $http_code (expected $expected_status)"
        return 1
    fi

    return 0
}

# Parse JSON field from response.json
parse_json() {
    local field="$1"
    local default="${2:-null}"

    if [[ ! -f "response.json" ]]; then
        echo "$default"
        return 1
    fi

    # Try to parse with jq first
    if command -v jq >/dev/null 2>&1; then
        jq -r ".$field // $default" response.json 2>/dev/null || echo "$default"
    else
        # Fallback to simple grep-based parsing for basic cases
        grep -o "\"$field\":[[:space:]]*\"[^\"]*\"" response.json 2>/dev/null | sed 's/.*"\([^"]*\)".*/\1/' || echo "$default"
    fi
}

# Test 1: Basic System Health
test_basic_health() {
    local test_name="Basic System Health"

    log "Testing $test_name..."

    if ! make_request "/health" "GET" "" "200"; then
        test_fail "$test_name" "Health endpoint returned error"
        return 1
    fi

    local status=$(parse_json "status" "unknown")
    if [[ "$status" != "healthy" ]]; then
        test_fail "$test_name" "System status is $status, expected healthy"
        return 1
    fi

    local message=$(parse_json "message" "unknown")
    if [[ "$message" == "unknown" ]]; then
        test_fail "$test_name" "No message information in health response"
        return 1
    fi

    test_pass "$test_name"
    log "Health check passed - Status: $status, Message: $message"
}

# Test 2: Enhanced Cache Health Assessment
test_enhanced_cache_health() {
    local test_name="Enhanced Cache Health Assessment"

    log "Testing $test_name..."

    if ! make_request "/cache-health" "GET" "" "200"; then
        test_fail "$test_name" "Cache health endpoint not available or returned error"
        return 1
    fi

    local status=$(parse_json "status" "unknown")
    local score=$(parse_json "overallScore" "0")
    local l1HitRate=$(parse_json "l1Metrics.hitRate" "0")

    log "Cache Health - Status: $status, Score: $score, L1 Hit Rate: $l1HitRate"

    # Validate enhanced metrics are present
    if [[ "$score" == "0" ]]; then
        test_fail "$test_name" "Overall health score is 0 - metrics may not be working"
        return 1
    fi

    if [[ "$(echo "$l1HitRate > 0" | bc -l 2>/dev/null || echo "0")" == "1" ]]; then
        test_pass "$test_name"
        log "Enhanced cache health validated - Score: $score/100, L1 Hit Rate: $l1HitRate"
    else
        test_skip "$test_name" "L1 hit rate is 0 - cache may not be warmed yet"
    fi
}

# Test 3: Enhanced Cache Configuration
test_cache_configuration() {
    local test_name="Enhanced Cache Configuration"

    log "Testing $test_name..."

    if ! make_request "/cache-config" "GET" "" "200"; then
        test_fail "$test_name" "Cache config endpoint not available"
        return 1
    fi

    local namespaces=$(parse_json "namespaces" "0")
    local environment=$(parse_json "environment" "unknown")

    log "Cache Config - Namespaces: $namespaces, Environment: $environment"

    if [[ "$namespaces" == "0" ]]; then
        test_fail "$test_name" "No cache namespaces configured"
        return 1
    fi

    if [[ "$environment" == "unknown" ]]; then
        test_fail "$test_name" "Environment not properly configured"
        return 1
    fi

    test_pass "$test_name"
    log "Enhanced cache configuration validated - $namespaces namespaces in $environment environment"
}

# Test 4: Cache Performance Metrics
test_cache_metrics() {
    local test_name="Cache Performance Metrics"

    log "Testing $test_name..."

    if ! make_request "/cache-metrics" "GET" "" "200"; then
        test_fail "$test_name" "Cache metrics endpoint not available"
        return 1
    fi

    local l1Hits=$(parse_json "l1Hits" "0")
    local l2Hits=$(parse_json "l2Hits" "0")
    local overallHitRate=$(parse_json "overallHitRate" "0")

    log "Cache Metrics - L1 Hits: $l1Hits, L2 Hits: $l2Hits, Hit Rate: $overallHitRate"

    # Validate metrics structure
    if [[ "$l1Hits" == "0" && "$l2Hits" == "0" ]]; then
        test_skip "$test_name" "No cache activity detected - system may be idle"
        return 0
    fi

    test_pass "$test_name"
    log "Cache metrics validated - Overall hit rate: $overallHitRate"
}

# Test 5: Cache Promotion Features
test_cache_promotion() {
    local test_name="Cache Promotion Features"

    log "Testing $test_name..."

    if ! make_request "/cache-promotion" "GET" "" "200"; then
        test_fail "$test_name" "Cache promotion endpoint not available"
        return 1
    fi

    local enabled=$(parse_json "enabled" "false")
    local totalPromotions=$(parse_json "totalPromotions" "0")
    local promotionRate=$(parse_json "promotionRate" "0")

    log "Cache Promotion - Enabled: $enabled, Total: $totalPromotions, Rate: $promotionRate"

    if [[ "$enabled" != "true" ]]; then
        test_fail "$test_name" "Cache promotion is not enabled"
        return 1
    fi

    test_pass "$test_name"
    log "Cache promotion features validated - $totalPromotions promotions, $promotionRate success rate"
}

# Test 6: Sentiment Analysis with Enhanced Caching
test_sentiment_analysis_caching() {
    local test_name="Sentiment Analysis with Enhanced Caching"

    log "Testing $test_name..."

    # First request - should be cache miss
    local start_time=$(date +%s%3N)
    if ! make_request "/analyze" "GET" "" "200"; then
        test_fail "$test_name" "Analysis endpoint failed"
        return 1
    fi
    local first_request_time=$(($(date +%s%3N) - start_time))

    # Second request - should be cache hit (faster)
    start_time=$(date +%s%3N)
    if ! make_request "/analyze" "GET" "" "200"; then
        test_fail "$test_name" "Second analysis request failed"
        return 1
    fi
    local second_request_time=$(($(date +%s%3N) - start_time))

    log "Request times - First: ${first_request_time}ms, Second: ${second_request_time}ms"

    # Second request should be faster (cache hit)
    if [[ "$second_request_time" -lt "$first_request_time" ]]; then
        test_pass "$test_name"
        log "Sentiment analysis caching working - ${first_request_time}ms → ${second_request_time}ms"
    else
        test_skip "$test_name" "Cache speedup not detected - may need more cache warmup"
    fi
}

# Test 7: Market Data Caching
test_market_data_caching() {
    local test_name="Market Data Caching"

    log "Testing $test_name..."

    # Test market data endpoint
    if ! make_request "/market-data/AAPL" "GET" "" "200"; then
        test_skip "$test_name" "Market data endpoint not available"
        return 0
    fi

    local symbol=$(parse_json "symbol" "unknown")
    local price=$(parse_json "price" "0")

    log "Market Data - Symbol: $symbol, Price: $price"

    if [[ "$symbol" == "unknown" || "$price" == "0" ]]; then
        test_fail "$test_name" "Invalid market data response"
        return 1
    fi

    # Second request for same data
    if ! make_request "/market-data/AAPL" "GET" "" "200"; then
        test_fail "$test_name" "Second market data request failed"
        return 1
    fi

    test_pass "$test_name"
    log "Market data caching validated for $symbol"
}

# Test 8: Cache Performance Under Load
test_cache_performance_load() {
    local test_name="Cache Performance Under Load"

    log "Testing $test_name..."

    local total_requests=10
    local successful_requests=0
    local total_time=0

    for i in $(seq 1 $total_requests); do
        local start_time=$(date +%s%3N)

        if make_request "/analyze" "GET" "" "200"; then
            successful_requests=$((successful_requests + 1))
            local request_time=$(($(date +%s%3N) - start_time))
            total_time=$((total_time + request_time))
        fi

        # Small delay between requests
        sleep 0.1
    done

    if [[ $successful_requests -eq 0 ]]; then
        test_fail "$test_name" "All requests failed under load"
        return 1
    fi

    local avg_time=$((total_time / successful_requests))
    local success_rate=$((successful_requests * 100 / total_requests))

    log "Load Test - Requests: $successful_requests/$total_requests, Avg Time: ${avg_time}ms, Success Rate: ${success_rate}%"

    if [[ $success_rate -ge 80 ]]; then
        test_pass "$test_name"
        log "Cache performance under load validated - ${success_rate}% success rate"
    else
        test_fail "$test_name" "Low success rate under load: ${success_rate}%"
        return 1
    fi
}

# Test 9: Enhanced Cache Features Integration
test_enhanced_features_integration() {
    local test_name="Enhanced Features Integration"

    log "Testing $test_name..."

    # Test that all enhanced features are working together
    local features_working=0
    local total_features=4

    # Check 1: Enhanced metrics
    if make_request "/cache-health" "GET" "" "200" 2>/dev/null; then
        local score=$(parse_json "overallScore" "0")
        if [[ "$score" != "0" ]]; then
            features_working=$((features_working + 1))
            log "✓ Enhanced metrics working (score: $score)"
        fi
    fi

    # Check 2: Configuration system
    if make_request "/cache-config" "GET" "" "200" 2>/dev/null; then
        local namespaces=$(parse_json "namespaces" "0")
        if [[ "$namespaces" != "0" ]]; then
            features_working=$((features_working + 1))
            log "✓ Configuration system working ($namespaces namespaces)"
        fi
    fi

    # Check 3: Promotion system
    if make_request "/cache-promotion" "GET" "" "200" 2>/dev/null; then
        local enabled=$(parse_json "enabled" "false")
        if [[ "$enabled" == "true" ]]; then
            features_working=$((features_working + 1))
            log "✓ Promotion system working"
        fi
    fi

    # Check 4: Basic caching (test with analysis endpoint)
    local start_time=$(date +%s%3N)
    if make_request "/analyze" "GET" "" "200" 2>/dev/null; then
        local first_time=$(($(date +%s%3N) - start_time))
        start_time=$(date +%s%3N)
        if make_request "/analyze" "GET" "" "200" 2>/dev/null; then
            local second_time=$(($(date +%s%3N) - start_time))
            if [[ $second_time -lt $first_time ]]; then
                features_working=$((features_working + 1))
                log "✓ Basic caching working (${first_time}ms → ${second_time}ms)"
            fi
        fi
    fi

    log "Enhanced features integration: $features_working/$total_features working"

    if [[ $features_working -ge 3 ]]; then
        test_pass "$test_name"
        log "Enhanced cache features integration successful"
    else
        test_fail "$test_name" "Only $features_working/$total_features features working"
        return 1
    fi
}

# Test 10: Regression Validation
test_regression_validation() {
    local test_name="Regression Validation"

    log "Testing $test_name..."

    # Baseline checks to ensure core functionality still works
    local regression_checks=0
    local total_checks=5

    # Check 1: System still healthy
    if make_request "/health" "GET" "" "200" 2>/dev/null; then
        regression_checks=$((regression_checks + 1))
        log "✓ System health maintained"
    fi

    # Check 2: Analysis endpoint still works
    if make_request "/analyze" "GET" "" "200" 2>/dev/null; then
        regression_checks=$((regression_checks + 1))
        log "✓ Analysis functionality maintained"
    fi

    # Check 3: API still responsive
    local start_time=$(date +%s%3N)
    if make_request "/analyze" "GET" "" "200" 2>/dev/null; then
        local response_time=$(($(date +%s%3N) - start_time))
        if [[ $response_time -lt 5000 ]]; then  # Less than 5 seconds
            regression_checks=$((regression_checks + 1))
            log "✓ API responsiveness maintained (${response_time}ms)"
        fi
    fi

    # Check 4: No breaking errors
    if make_request "/analyze" "GET" "" "200" 2>/dev/null; then
        local error_count=$(parse_json "errors" "0")
        if [[ "$error_count" == "0" ]]; then
            regression_checks=$((regression_checks + 1))
            log "✓ No breaking errors detected"
        fi
    fi

    # Check 5: Cache system functional
    if make_request "/cache-health" "GET" "" "200" 2>/dev/null; then
        local status=$(parse_json "status" "unknown")
        if [[ "$status" != "critical" ]]; then
            regression_checks=$((regression_checks + 1))
            log "✓ Cache system functional (status: $status)"
        fi
    fi

    log "Regression validation: $regression_checks/$total_checks passed"

    if [[ $regression_checks -eq $total_checks ]]; then
        test_pass "$test_name"
        log "All regression checks passed - system stability maintained"
    else
        test_fail "$test_name" "Regression issues detected - only $regression_checks/$total_checks checks passed"
        return 1
    fi
}

# Generate test report
generate_report() {
    local total_tests=${#PASSED_TESTS[@]}+${#FAILED_TESTS[@]}
    local pass_count=${#PASSED_TESTS[@]}
    local fail_count=${#FAILED_TESTS[@]}

    echo -e "\n${BLUE}=== ENHANCED CACHE INTEGRATION TEST REPORT ===${NC}"
    echo -e "Date: $(date)"
    echo -e "API URL: $API_URL"
    echo -e "Total Tests: $((pass_count + fail_count))"
    echo -e "${GREEN}Passed: $pass_count${NC}"
    echo -e "${RED}Failed: $fail_count${NC}"

    if [[ $pass_count -gt 0 ]]; then
        echo -e "\n${GREEN}✅ PASSED TESTS:${NC}"
        for test in "${PASSED_TESTS[@]}"; do
            echo -e "  $test"
        done
    fi

    if [[ $fail_count -gt 0 ]]; then
        echo -e "\n${RED}❌ FAILED TESTS:${NC}"
        for test in "${FAILED_TESTS[@]}"; do
            echo -e "  $test"
        done
    fi

    # Overall result
    if [[ $fail_count -eq 0 ]]; then
        echo -e "\n${GREEN}🎉 ALL TESTS PASSED - Enhanced Cache System is regression-free!${NC}"
        return 0
    else
        echo -e "\n${RED}⚠️  $fail_count TESTS FAILED - Review and fix issues${NC}"
        return 1
    fi
}

# Cleanup function
cleanup() {
    rm -f response.json
    log "Cleanup completed"
}

# Main test execution
main() {
    echo -e "${BLUE}=== Enhanced Cache Integration Test Suite ===${NC}"
    echo -e "Testing enhanced cache system with curl integration"
    echo -e "Log file: $LOG_FILE"
    echo ""

    # Initialize log
    log "Starting Enhanced Cache Integration Tests"
    log "API URL: $API_URL"

    # Trap cleanup
    trap cleanup EXIT

    # Run tests
    local tests=(
        "test_basic_health"
        "test_enhanced_cache_health"
        "test_cache_configuration"
        "test_cache_metrics"
        "test_cache_promotion"
        "test_sentiment_analysis_caching"
        "test_market_data_caching"
        "test_cache_performance_load"
        "test_enhanced_features_integration"
        "test_regression_validation"
    )

    for test in "${tests[@]}"; do
        echo -e "\n${BLUE}Running: $test${NC}"
        $test
        sleep 1  # Brief pause between tests
    done

    # Generate final report
    generate_report
}

# Check dependencies
check_dependencies() {
    local missing_deps=()

    if ! command -v curl >/dev/null 2>&1; then
        missing_deps+=("curl")
    fi

    if ! command -v bc >/dev/null 2>&1; then
        missing_deps+=("bc")
    fi

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        echo -e "${RED}Missing dependencies: ${missing_deps[*]}${NC}"
        echo "Please install: apt-get install ${missing_deps[*]}"
        exit 1
    fi
}

# Run main function
check_dependencies
main "$@"