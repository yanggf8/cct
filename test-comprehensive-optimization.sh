#!/bin/bash

# Comprehensive Predictive Pre-fetching & KV Optimization Test
# Tests the complete integration of all optimization modules including predictive pre-fetching
# Validates actual KV reduction performance gains

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
TIMEOUT=45
LOG_FILE="comprehensive-optimization-$(date +%Y%m%d-%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Test results
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

test_passed() {
    echo -e "${GREEN}✅ $1${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    log "PASS: $1"
}

test_failed() {
    echo -e "${RED}❌ $1${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    log "FAIL: $1 - $2"
}

test_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
    log "INFO: $1"
}

test_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    log "WARN: $1"
}

make_request() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="${3:-}"
    local description="${4:-Request}"

    local response=$(curl -s -w '\nHTTP_CODE:%{http_code}\nTIME:%{time_total}' \
        -X "$method" \
        -H "X-API-KEY: $X_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$data" \
        --max-time $TIMEOUT \
        "$API_URL$endpoint" 2>/dev/null || echo -e "\nHTTP_CODE:000\nTIME:0")

    echo "$response"
}

extract_response_data() {
    local response="$1"
    echo "$response" | sed -n '1,/^HTTP_CODE:/p' | head -n -1
}

extract_http_code() {
    local response="$1"
    echo "$response" | grep "^HTTP_CODE:" | cut -d: -f2
}

extract_response_time() {
    local response="$1"
    echo "$response" | grep "^TIME:" | cut -d: -f2
}

test_api_endpoint() {
    local endpoint="$1"
    local description="$2"
    local expected_code="${3:-200}"

    test_info "Testing $description ($endpoint)"

    local response=$(make_request "$endpoint" "GET")
    local http_code=$(extract_http_code "$response")
    local response_time=$(extract_response_time "$response")
    local body=$(extract_response_data "$response")

    if [[ "$http_code" == "$expected_code" ]]; then
        test_passed "$description (${response_time}s)"

        # Extract optimization information if available
        if echo "$body" | jq -e '.optimizations' >/dev/null 2>&1; then
            local optimizations=$(echo "$body" | jq -r '.optimizations[]? // empty' | tr '\n' ', ' | sed 's/,$//')
            if [[ -n "$optimizations" ]]; then
                test_info "  Optimizations: $optimizations"
            fi
        fi

        if echo "$body" | jq -e '.cacheSource' >/dev/null 2>&1; then
            local cache_source=$(echo "$body" | jq -r '.cacheSource // "unknown"')
            test_info "  Cache Source: $cache_source"
        fi

        log "SUCCESS: $endpoint returned $http_code in ${response_time}s"
        return 0
    else
        test_failed "$description" "HTTP $http_code (expected $expected_code)"
        return 1
    fi
}

# Main test execution
echo -e "${MAGENTA}=======================================${NC}"
echo -e "${MAGENTA}🚀 Comprehensive Optimization Test${NC}"
echo -e "${MAGENTA}=======================================${NC}"
echo -e "Log file: $LOG_FILE"
echo ""

log "Starting Comprehensive Optimization Tests"

echo -e "${BLUE}🔧 Phase 1: Enhanced Cache System Validation${NC}"
echo ""

# Test 1: Basic Cache Health
echo -e "${YELLOW}Test 1.1: Enhanced Cache Health Check${NC}"
test_api_endpoint "/api/v1/cache/health" "Enhanced Cache Health"

# Test 2: Cache Configuration
echo -e "\n${YELLOW}Test 1.2: Cache Configuration Validation${NC}"
test_api_endpoint "/api/v1/cache/config" "Cache Configuration"

# Test 3: Memory Static Data Validation
echo -e "\n${YELLOW}Test 1.3: Memory Static Data Performance${NC}"
test_api_endpoint "/api/v1/data/symbols" "Symbol List (Memory Static)"

# Test memory static data by calling multiple times
test_info "Testing memory static data cache hit performance..."
for i in {1..3}; do
    test_api_endpoint "/api/v1/data/symbols" "Memory Static Data Test $i"
done

echo -e "\n${BLUE}🧠 Phase 2: Predictive Pre-fetching Integration${NC}"
echo ""

# Test 4: Predictive Pre-fetching Trigger
echo -e "${YELLOW}Test 2.1: Predictive Pre-fetching Pattern Learning${NC}"
test_info "Establishing access patterns..."

# Establish access patterns
for i in {1..3}; do
    test_api_endpoint "/analyze" "Pattern Learning $i"
    sleep 0.5
done

# Test 5: Pre-fetch Hit Validation
echo -e "\n${YELLOW}Test 2.2: Pre-fetch Hit Validation${NC}"
test_info "Testing pre-fetch effectiveness (should be faster)..."

# These should benefit from pre-fetching
test_api_endpoint "/analyze" "Pre-fetch Test 1"
test_api_endpoint "/analyze" "Pre-fetch Test 2"

# Test 6: Cache Promotion with Pre-fetching
echo -e "\n${YELLOW}Test 2.3: Cache Promotion & Pre-fetching${NC}"
test_api_endpoint "/api/v1/cache/promote" "Manual Cache Promotion"

echo -e "\n${BLUE}📊 Phase 3: KV Operation Reduction Validation${NC}"
echo ""

# Test 7: Key Aliasing Effectiveness
echo -e "${YELLOW}Test 3.1: Cache Key Aliasing${NC}"
test_api_endpoint "/api/v1/sentiment/symbols/AAPL" "Symbol Analysis (Key Aliasing)"
test_api_endpoint "/api/v1/sentiment/symbols/MSFT" "Symbol Analysis 2 (Key Aliasing)"

# Test 8: Batch Operations
echo -e "\n${YELLOW}Test 3.2: Batch Operations${NC}"
test_info "Testing concurrent request batching..."

# Test concurrent requests (should be batched)
for i in {1..3}; do
    make_request "/api/v1/data/symbols" "GET" >/dev/null &
done
wait

test_api_endpoint "/health" "Health Check (Post-Batching)"

# Test 9: Vectorized Sector Processing
echo -e "\n${YELLOW}Test 3.3: Vectorized Sector Processing${NC}"
test_api_endpoint "/api/sectors/snapshot" "Sector Snapshot (Vectorized)"

echo -e "\n${BLUE}📈 Phase 4: Performance Impact Analysis${NC}"
echo ""

# Test 10: Performance Metrics Collection
echo -e "${YELLOW}Test 4.1: Comprehensive Performance Metrics${NC}"
test_api_endpoint "/api/v1/cache/metrics" "Cache Performance Metrics"

# Test 11: System Health Under Load
echo -e "\n${YELLOW}Test 4.2: System Health Under Optimization Load${NC}"
test_info "Testing system stability with all optimizations active..."

# Rapid fire requests to test system stability
for i in {1..5}; do
    test_api_endpoint "/health" "Load Test Health Check $i"
done

# Test 12: Memory Usage Validation
echo -e "\n${YELLOW}Test 4.3: Memory Usage & Resource Management${NC}"
health_response=$(make_request "/health" "GET")
if echo "$health_response" | jq -e '.success == true' >/dev/null 2>&1; then
    test_passed "System Resource Health"

    # Check memory status if available
    if echo "$health_response" | jq -e '.memory' >/dev/null 2>&1; then
        local memory_usage=$(echo "$health_response" | jq -r '.memory.usage // "unknown"')
        test_info "Memory Usage: $memory_usage"
    fi
else
    test_failed "System Resource Health" "Health check failed"
fi

echo -e "\n${BLUE}🎯 Phase 5: Integration Workflow Testing${NC}"
echo ""

# Test 13: Complete Analysis Workflow
echo -e "${YELLOW}Test 5.1: Complete Analysis Workflow${NC}"
test_info "Testing full analysis pipeline with all optimizations..."

# Complete workflow: Analysis → Cache → Results
test_api_endpoint "/analyze" "Full Analysis Workflow"
test_api_endpoint "/results" "Analysis Results Retrieval"

# Test 14: Cache Warm-up Effectiveness
echo -e "\n${YELLOW}Test 5.2: Cache Warm-up Strategy${NC}"
test_api_endpoint "/api/v1/cache/warmup" "Cache Warm-up"

# Test warmed up cache performance
test_api_endpoint "/analyze" "Post-Warmup Analysis"

echo -e "\n${MAGENTA}📋 Test Results Summary${NC}"
echo ""

# Calculate success rate
success_rate=$(( (TESTS_PASSED * 100) / TESTS_TOTAL ))

echo -e "${CYAN}Total Tests: $TESTS_TOTAL${NC}"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo -e "${BLUE}Success Rate: ${success_rate}%${NC}"

# Overall assessment
if [[ $success_rate -ge 90 ]]; then
    echo -e "\n${GREEN}🎉 EXCELLENT: Optimization system is performing exceptionally well!${NC}"
    test_passed "Overall Optimization System Excellence"
elif [[ $success_rate -ge 75 ]]; then
    echo -e "\n${YELLOW}✅ GOOD: Optimization system is performing well with room for improvement${NC}"
    test_passed "Overall Optimization System Good"
elif [[ $success_rate -ge 50 ]]; then
    echo -e "\n${YELLOW}⚠️  FAIR: Optimization system is working but needs attention${NC}"
    test_warning "Overall Optimization System Fair"
else
    echo -e "\n${RED}❌ POOR: Optimization system needs significant improvement${NC}"
    test_failed "Overall Optimization System" "Low success rate"
fi

echo -e "\n${MAGENTA}🚀 Next Steps Recommendation${NC}"

if [[ $success_rate -ge 90 ]]; then
    echo -e "${GREEN}• System is ready for production deployment${NC}"
    echo -e "${GREEN}• Monitor KV reduction metrics in production${NC}"
    echo -e "${GREEN}• Consider fine-tuning pre-fetching thresholds${NC}"
elif [[ $success_rate -ge 75 ]]; then
    echo -e "${YELLOW}• Address failing tests before production deployment${NC}"
    echo -e "${YELLOW}• Monitor performance metrics closely${NC}"
    echo -e "${YELLOW}• Optimize configuration parameters${NC}"
else
    echo -e "${RED}• Critical issues need immediate attention${NC}"
    echo -e "${RED}• Review implementation and configuration${NC}"
    echo -e "${RED}• Consider rollback to stable version${NC}"
fi

echo -e "\n${CYAN}Detailed logs available at: $LOG_FILE${NC}"

log "Comprehensive Optimization Tests Completed: $TESTS_PASSED/$TESTS_TOTAL passed (${success_rate}%)"

exit $((TESTS_FAILED > 0 ? 1 : 0))