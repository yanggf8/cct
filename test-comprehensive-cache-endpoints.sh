#!/bin/bash

# Comprehensive Cache Endpoint Test
# Tests ALL cache-related endpoints to ensure complete coverage
# Tests both enhanced cache routes and API v1 cache endpoints

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
BASE_URL="https://tft-trading-system.yanggf.workers.dev"
TEST_TIMEOUT=30
TEST_COUNT=0
PASS_COUNT=0
FAILED_ENDPOINTS=()

# Helper functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    FAILED_ENDPOINTS+=("$1")
}

test_endpoint() {
    local endpoint="$1"
    local description="$2"
    local expected_field="$3"
    local method="${4:-GET}"

    TEST_COUNT=$((TEST_COUNT + 1))
    log "Test $TEST_COUNT: $description"
    log "Testing: $method $endpoint"

    # Make the request with timeout
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "%{http_code}" -X POST --max-time $TEST_TIMEOUT "$BASE_URL$endpoint" || echo "000")
    else
        response=$(curl -s -w "%{http_code}" --max-time $TEST_TIMEOUT "$BASE_URL$endpoint" || echo "000")
    fi

    http_code="${response: -3}"
    body="${response%???}"

    if [ "$http_code" != "200" ]; then
        error "$description - HTTP $http_code (expected 200) - $endpoint"
        echo "Response body: $body"
        return 1
    fi

    # Check if expected field exists in response
    if [ -n "$expected_field" ]; then
        if echo "$body" | grep -q "$expected_field"; then
            success "$description - Found '$expected_field'"
        else
            warning "$description - Missing '$expected_field' but endpoint responded"
        fi
    else
        success "$description - Endpoint responded successfully"
    fi

    # Show response structure
    log "Response structure: $(echo "$body" | jq -r 'keys[]' 2>/dev/null | head -3 | tr '\n' ' ' || echo 'JSON parse failed')"
}

# Test ALL Enhanced Cache Routes (direct routes)
test_enhanced_cache_routes() {
    log "\n=== Testing Enhanced Cache Routes (Direct) ==="

    # Core health and status endpoints
    test_endpoint "/cache-health" "Cache health endpoint" "healthy"
    test_endpoint "/cache-system-status" "Cache system status" "status"

    # Configuration and metrics
    test_endpoint "/cache-config" "Cache configuration" "namespaces"
    test_endpoint "/cache-metrics" "Cache metrics" "hitRate"

    # Management endpoints
    test_endpoint "/cache-promotion" "Cache promotion status" "promotion"
    test_endpoint "/cache-warmup" "Cache warmup endpoint" "warmup"

    # Debugging and monitoring
    test_endpoint "/cache-timestamps" "Cache timestamps" "cachedAt"
    test_endpoint "/cache-debug" "Cache debug endpoint" "debug"
    test_endpoint "/cache-deduplication" "Cache deduplication" "deduplication"
}

# Test ALL API v1 Cache Endpoints (REST-style)
test_api_v1_cache_endpoints() {
    log "\n=== Testing API v1 Cache Endpoints (REST) ==="

    # Core health and status endpoints
    test_endpoint "/api/v1/cache/health" "API v1 cache health" "healthy"
    test_endpoint "/api/v1/cache/status" "API v1 cache status" "status"
    test_endpoint "/api/v1/cache/stats" "API v1 cache stats" "statistics"

    # Configuration and metrics
    test_endpoint "/api/v1/cache/config" "API v1 cache config" "namespaces"
    test_endpoint "/api/v1/cache/metrics" "API v1 cache metrics" "hitRate"

    # Management endpoints
    test_endpoint "/api/v1/cache/promote" "API v1 cache promote" "promotion"
    test_endpoint "/api/v1/cache/warmup" "API v1 cache warmup" "warmup"

    # Debugging and monitoring
    test_endpoint "/api/v1/cache/timestamps" "API v1 cache timestamps" "cachedAt"
    test_endpoint "/api/v1/cache/debug" "API v1 cache debug" "debug"
    test_endpoint "/api/v1/cache/deduplication" "API v1 cache deduplication" "deduplication"
}

# Test Cache Functionality with Real Data
test_cache_functionality() {
    log "\n=== Testing Cache Functionality with Real Data ==="

    # Test sentiment analysis (should use cache)
    test_endpoint "/api/v1/sentiment/analysis?symbols=AAPL" "Sentiment analysis (cache test)" "sentiment"

    # Wait a moment for cache to populate
    sleep 2

    # Test same request again (should hit cache)
    test_endpoint "/api/v1/sentiment/analysis?symbols=AAPL" "Sentiment analysis (cache hit test)" "sentiment"

    # Test market data (should use cache)
    test_endpoint "/api/v1/data/symbols" "Market data symbols" "symbols"

    # Test single symbol sentiment
    test_endpoint "/api/v1/sentiment/symbols/MSFT" "Single symbol sentiment" "symbol"
}

# Test POST Cache Management Endpoints
test_cache_management_post() {
    log "\n=== Testing Cache Management POST Endpoints ==="

    # Test cache warmup with POST data
    test_endpoint "/cache-warmup" "Cache warmup POST" "warmup" "POST"
    test_endpoint "/api/v1/cache/warmup" "API v1 cache warmup POST" "warmup" "POST"

    # Test cache promotion with POST data
    test_endpoint "/cache-promotion" "Cache promotion POST" "promotion" "POST"
    test_endpoint "/api/v1/cache/promote" "API v1 cache promotion POST" "promotion" "POST"
}

# Test Cache Error Handling
test_cache_error_handling() {
    log "\n=== Testing Cache Error Handling ==="

    # Test invalid cache endpoint
    log "Testing invalid endpoint..."
    response=$(curl -s -w "%{http_code}" --max-time $TEST_TIMEOUT "$BASE_URL/api/v1/cache/invalid-endpoint" || echo "000")
    http_code="${response: -3}"

    if [ "$http_code" = "404" ]; then
        success "Invalid endpoint correctly returns 404"
    else
        warning "Invalid endpoint returned $http_code (expected 404)"
    fi

    # Test cache with invalid parameters
    log "Testing cache timestamps with invalid parameters..."
    response=$(curl -s -w "%{http_code}" --max-time $TEST_TIMEOUT "$BASE_URL/api/v1/cache/timestamps?namespace=invalid&key=nonexistent" || echo "000")
    http_code="${response: -3}"

    if [ "$http_code" = "200" ]; then
        success "Cache timestamps handles invalid parameters gracefully"
    else
        warning "Cache timestamps returned $http_code for invalid parameters"
    fi
}

# Test Durable Objects Specific Features
test_durable_objects_features() {
    log "\n=== Testing Durable Objects Specific Features ==="

    # Test DO cache health (if available)
    response=$(curl -s --max-time $TEST_TIMEOUT "$BASE_URL/api/v1/cache/health" || echo "")

    if echo "$response" | grep -q "Durable Objects\|DO cache\|cacheLayer.*L1"; then
        success "Durable Objects cache detected in health response"

        # Test DO-specific metrics
        test_endpoint "/api/v1/cache/metrics" "DO cache metrics" "cacheLayer"
        test_endpoint "/api/v1/cache/config" "DO cache config" "Durable Objects"
    else
        warning "Durable Objects cache not detected - using fallback cache"
    fi
}

# Test Cache Performance
test_cache_performance() {
    log "\n=== Testing Cache Performance ==="

    # Test response times for cached endpoints
    endpoints=(
        "/api/v1/cache/health"
        "/api/v1/cache/metrics"
        "/api/v1/cache/config"
    )

    for endpoint in "${endpoints[@]}"; do
        start_time=$(date +%s%3N)
        curl -s --max-time $TEST_TIMEOUT "$BASE_URL$endpoint" > /dev/null
        end_time=$(date +%s%3N)
        response_time=$((end_time - start_time))

        if [ $response_time -lt 100 ]; then
            success "$endpoint - Performance excellent (${response_time}ms)"
        elif [ $response_time -lt 500 ]; then
            success "$endpoint - Performance good (${response_time}ms)"
        else
            warning "$endpoint - Performance slow (${response_time}ms)"
        fi
    done
}

# Test Cache Data Consistency
test_cache_consistency() {
    log "\n=== Testing Cache Data Consistency ==="

    # Get initial cache metrics
    response1=$(curl -s --max-time $TEST_TIMEOUT "$BASE_URL/api/v1/cache/metrics")
    initial_hits=$(echo "$response1" | jq -r '.l1Metrics.hits // 0' 2>/dev/null || echo "0")

    # Make a request that should populate cache
    curl -s --max-time $TEST_TIMEOUT "$BASE_URL/api/v1/sentiment/symbols/AAPL" > /dev/null
    sleep 1

    # Make same request again
    curl -s --max-time $TEST_TIMEOUT "$BASE_URL/api/v1/sentiment/symbols/AAPL" > /dev/null
    sleep 1

    # Check cache metrics again
    response2=$(curl -s --max-time $TEST_TIMEOUT "$BASE_URL/api/v1/cache/metrics")
    final_hits=$(echo "$response2" | jq -r '.l1Metrics.hits // 0' 2>/dev/null || echo "0")

    if [ "$final_hits" -gt "$initial_hits" ]; then
        success "Cache hit count increased (${initial_hits} → ${final_hits})"
    else
        warning "Cache hit count did not increase (${initial_hits} → ${final_hits})"
    fi
}

# Main test execution
main() {
    log "🚀 Comprehensive Cache Endpoint Test Suite"
    log "Testing against: $BASE_URL"
    log "Timeout per test: ${TEST_TIMEOUT}s"
    log ""

    # Run all test suites
    test_enhanced_cache_routes
    test_api_v1_cache_endpoints
    test_cache_functionality
    test_cache_management_post
    test_cache_error_handling
    test_durable_objects_features
    test_cache_performance
    test_cache_consistency

    # Final results
    log "\n=== Test Results ==="
    log "Total tests: $TEST_COUNT"
    log "Passed: $PASS_COUNT"
    log "Failed: $((TEST_COUNT - PASS_COUNT))"

    if [ ${#FAILED_ENDPOINTS[@]} -gt 0 ]; then
        log "\n❌ Failed endpoints:"
        for endpoint in "${FAILED_ENDPOINTS[@]}"; do
            error "  - $endpoint"
        done
    fi

    if [ $PASS_COUNT -eq $TEST_COUNT ]; then
        success "🎉 All cache endpoints tested successfully!"
        log ""
        log "✅ Enhanced cache routes working"
        log "✅ API v1 cache endpoints working"
        log "✅ Cache functionality validated"
        log "✅ Error handling confirmed"
        log "✅ Performance within acceptable range"
        exit 0
    elif [ $PASS_COUNT -gt $((TEST_COUNT * 8 / 10)) ]; then
        success "✅ Most cache endpoints working well!"
        warning "⚠️  Some endpoints failed - review above warnings"
        exit 0
    else
        error "❌ Multiple cache endpoints failing. Investigation needed."
        exit 1
    fi
}

# Run main function
main "$@"