#!/bin/bash

# Cache Economics Test Script
# Tests cost-to-serve intelligence and cache performance metrics
# Phase 3 Implementation: Comprehensive cache economics validation

set -e

# Configuration
API_BASE="${API_BASE:-https://tft-trading-system.yanggf.workers.dev}"
API_KEY="${API_KEY:-test}"
OUTPUT_DIR="test-results/cache-economics"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$OUTPUT_DIR/cache-economics-report-$TIMESTAMP.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
ITERATIONS=10
WARMUP_ITERATIONS=3
CACHE_CATEGORIES=("dashboard" "economics" "guards")

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Initialize test report
init_report() {
    cat > "$REPORT_FILE" << EOF
{
  "test_run": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
    "api_base": "$API_BASE",
    "iterations": $ITERATIONS,
    "warmup_iterations": $WARMUP_ITERATIONS,
    "test_categories": $(printf '%s\n' "${CACHE_CATEGORIES[@]}" | jq -R . | jq -s .)
  },
  "results": {},
  "summary": {},
  "cache_economics": {},
  "performance_metrics": {}
}
EOF
}

# Helper function to make API request with timing
make_request() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="$3"
    local start_time=$(date +%s%N)

    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}\n%{time_total}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: $API_KEY" \
            -d "$data" \
            "$API_BASE$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}\n%{time_total}" \
            -X "$method" \
            -H "X-API-Key: $API_KEY" \
            "$API_BASE$endpoint")
    fi

    local end_time=$(date +%s%N)
    local total_time=$(echo "scale=3; ($end_time - $start_time) / 1000000000" | bc)

    # Parse response
    local http_code=$(echo "$response" | tail -n2 | head -n1)
    local curl_time=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n -2)

    # Return JSON object
    echo "{
        \"http_code\": $http_code,
        \"response_time_ms\": $(echo "scale=3; $curl_time * 1000" | bc),
        \"total_time_ms\": $(echo "scale=3; $total_time * 1000" | bc),
        \"body\": $body,
        \"success\": [ \"$http_code\" = \"200\" ]
    }"
}

# Test dashboard metrics endpoint
test_dashboard_metrics() {
    log "Testing dashboard metrics endpoint..."

    local results=()
    local cache_hit_count=0
    local total_response_time=0

    # Warmup requests
    log "Performing warmup requests..."
    for i in $(seq 1 $WARMUP_ITERATIONS); do
        make_request "/api/v1/dashboard/metrics" > /dev/null
    done

    # Actual test requests
    log "Running $ITERATIONS test requests..."
    for i in $(seq 1 $ITERATIONS); do
        local result=$(make_request "/api/v1/dashboard/metrics")
        results+=("$result")

        if echo "$result" | jq -e '.body.cached == true' > /dev/null; then
            ((cache_hit_count++))
        fi

        local response_time=$(echo "$result" | jq -r '.response_time_ms')
        total_response_time=$(echo "$total_response_time + $response_time" | bc)
    done

    local avg_response_time=$(echo "scale=3; $total_response_time / $ITERATIONS" | bc)
    local cache_hit_rate=$(echo "scale=3; ($cache_hit_count * 100) / $ITERATIONS" | bc)

    # Update report
    jq --argjson results "$(printf '%s\n' "${results[@]}" | jq -s .)" \
       --argjson avg_response_time "$avg_response_time" \
       --argjson cache_hit_rate "$cache_hit_rate" \
       --argjson cache_hit_count "$cache_hit_count" \
       '.results.dashboard_metrics = {
           "requests": $results,
           "average_response_time_ms": $avg_response_time,
           "cache_hit_rate_percent": $cache_hit_rate,
           "cache_hits": $cache_hit_count,
           "total_requests": '$ITERATIONS'
       }' "$REPORT_FILE" > tmp.json && mv tmp.json "$REPORT_FILE"

    if (( $(echo "$cache_hit_rate >= 80" | bc -l) )); then
        success "Dashboard metrics cache hit rate: ${cache_hit_rate}%"
    else
        warning "Dashboard metrics cache hit rate: ${cache_hit_rate}% (target: >=80%)"
    fi

    log "Average response time: ${avg_response_time}ms"
}

# Test economics endpoint
test_economics() {
    log "Testing economics endpoint..."

    local results=()
    local cache_hit_count=0
    local total_response_time=0

    # Warmup requests
    log "Performing warmup requests..."
    for i in $(seq 1 $WARMUP_ITERATIONS); do
        make_request "/api/v1/dashboard/economics" > /dev/null
    done

    # Actual test requests
    log "Running $ITERATIONS test requests..."
    for i in $(seq 1 $ITERATIONS); do
        local result=$(make_request "/api/v1/dashboard/economics")
        results+=("$result")

        if echo "$result" | jq -e '.body.cached == true' > /dev/null; then
            ((cache_hit_count++))
        fi

        local response_time=$(echo "$result" | jq -r '.response_time_ms')
        total_response_time=$(echo "$total_response_time + $response_time" | bc)
    done

    local avg_response_time=$(echo "scale=3; $total_response_time / $ITERATIONS" | bc)
    local cache_hit_rate=$(echo "scale=3; ($cache_hit_count * 100) / $ITERATIONS" | bc)

    # Update report
    jq --argjson results "$(printf '%s\n' "${results[@]}" | jq -s .)" \
       --argjson avg_response_time "$avg_response_time" \
       --argjson cache_hit_rate "$cache_hit_rate" \
       --argjson cache_hit_count "$cache_hit_count" \
       '.results.economics = {
           "requests": $results,
           "average_response_time_ms": $avg_response_time,
           "cache_hit_rate_percent": $cache_hit_rate,
           "cache_hits": $cache_hit_count,
           "total_requests": '$ITERATIONS'
       }' "$REPORT_FILE" > tmp.json && mv tmp.json "$REPORT_FILE"

    if (( $(echo "$cache_hit_rate >= 80" | bc -l) )); then
        success "Economics cache hit rate: ${cache_hit_rate}%"
    else
        warning "Economics cache hit rate: ${cache_hit_rate}% (target: >=80%)"
    fi

    log "Average response time: ${avg_response_time}ms"
}

# Test guard violations endpoint
test_guard_violations() {
    log "Testing guard violations endpoint..."

    local results=()
    local cache_hit_count=0
    local total_response_time=0

    # Test with different parameters
    local test_params=(
        ""
        "?active_only=true"
        "?severity=critical"
        "?limit=10"
    )

    for params in "${test_params[@]}"; do
        log "Testing with parameters: $params"

        # Warmup requests
        for i in $(seq 1 $WARMUP_ITERATIONS); do
            make_request "/api/v1/dashboard/guards$params" > /dev/null
        done

        # Actual test requests
        for i in $(seq 1 $ITERATIONS); do
            local result=$(make_request "/api/v1/dashboard/guards$params")
            results+=("$result")

            if echo "$result" | jq -e '.body.cached == true' > /dev/null; then
                ((cache_hit_count++))
            fi

            local response_time=$(echo "$result" | jq -r '.response_time_ms')
            total_response_time=$(echo "$total_response_time + $response_time" | bc)
        done
    done

    local total_requests=$((${#test_params[@]} * ITERATIONS))
    local avg_response_time=$(echo "scale=3; $total_response_time / $total_requests" | bc)
    local cache_hit_rate=$(echo "scale=3; ($cache_hit_count * 100) / $total_requests" | bc)

    # Update report
    jq --argjson results "$(printf '%s\n' "${results[@]}" | jq -s .)" \
       --argjson avg_response_time "$avg_response_time" \
       --argjson cache_hit_rate "$cache_hit_rate" \
       --argjson cache_hit_count "$cache_hit_count" \
       --argjson total_requests "$total_requests" \
       '.results.guard_violations = {
           "requests": $results,
           "average_response_time_ms": $avg_response_time,
           "cache_hit_rate_percent": $cache_hit_rate,
           "cache_hits": $cache_hit_count,
           "total_requests": $total_requests,
           "test_parameters": $(printf '%s\n' "${test_params[@]}" | jq -R . | jq -s .)
       }' "$REPORT_FILE" > tmp.json && mv tmp.json "$REPORT_FILE"

    if (( $(echo "$cache_hit_rate >= 75" | bc -l) )); then
        success "Guard violations cache hit rate: ${cache_hit_rate}%"
    else
        warning "Guard violations cache hit rate: ${cache_hit_rate}% (target: >=75%)"
    fi

    log "Average response time: ${avg_response_time}ms"
}

# Test cache refresh functionality
test_cache_refresh() {
    log "Testing cache refresh functionality..."

    # Get initial metrics
    local initial_result=$(make_request "/api/v1/dashboard/metrics")
    local initial_cached=$(echo "$initial_result" | jq -r '.body.cached')

    # Force cache refresh
    log "Triggering cache refresh..."
    local refresh_result=$(make_request "/api/v1/dashboard/refresh" "POST" '{"targets": ["metrics"]}')

    if echo "$refresh_result" | jq -e '.success' > /dev/null; then
        success "Cache refresh triggered successfully"
    else
        error "Cache refresh failed"
        return 1
    fi

    # Get metrics after refresh (should not be cached)
    local after_refresh_result=$(make_request "/api/v1/dashboard/metrics")
    local after_cached=$(echo "$after_refresh_result" | jq -r '.body.cached')

    # Update report
    jq --argjson initial_cached "$initial_cached" \
       --argjson after_cached "$after_cached" \
       --argjson refresh_result "$refresh_result" \
       '.results.cache_refresh = {
           "initial_cached": $initial_cached,
           "after_refresh_cached": $after_cached,
           "refresh_result": $refresh_result,
           "success": ($after_cached == false)
       }' "$REPORT_FILE" > tmp.json && mv tmp.json "$REPORT_FILE"

    if [ "$after_cached" = "false" ]; then
        success "Cache refresh working correctly (data no longer cached)"
    else
        warning "Cache refresh may not be working correctly"
    fi
}

# Test dashboard health endpoint
test_dashboard_health() {
    log "Testing dashboard health endpoint..."

    local result=$(make_request "/api/v1/dashboard/health")

    if echo "$result" | jq -e '.success' > /dev/null; then
        success "Dashboard health endpoint working"

        # Extract health metrics
        local status=$(echo "$result" | jq -r '.body.data.status')
        local uptime=$(echo "$result" | jq -r '.body.data.uptime')
        local components=$(echo "$result" | jq '.body.data.components')

        log "System status: $status"
        log "Uptime: ${uptime}s"

        # Update report
        jq --argjson result "$result" \
           '.results.dashboard_health = {
               "success": true,
               "status": $result.body.data.status,
               "uptime": $result.body.data.uptime,
               "components": $result.body.data.components,
               "response_time_ms": $result.response_time_ms
           }' "$REPORT_FILE" > tmp.json && mv tmp.json "$REPORT_FILE"
    else
        error "Dashboard health endpoint failed"
        jq --argjson result "$result" \
           '.results.dashboard_health = {
               "success": false,
               "error": $result.body,
               "response_time_ms": $result.response_time_ms
           }' "$REPORT_FILE" > tmp.json && mv tmp.json "$REPORT_FILE"
    fi
}

# Calculate cache economics metrics
calculate_cache_economics() {
    log "Calculating cache economics metrics..."

    # Extract data from results
    local dashboard_response_time=$(jq -r '.results.dashboard_metrics.average_response_time_ms // 0' "$REPORT_FILE")
    local economics_response_time=$(jq -r '.results.economics.average_response_time_ms // 0' "$REPORT_FILE")
    local guards_response_time=$(jq -r '.results.guard_violations.average_response_time_ms // 0' "$REPORT_FILE")

    local dashboard_cache_rate=$(jq -r '.results.dashboard_metrics.cache_hit_rate_percent // 0' "$REPORT_FILE")
    local economics_cache_rate=$(jq -r '.results.economics.cache_hit_rate_percent // 0' "$REPORT_FILE")
    local guards_cache_rate=$(jq -r '.results.guard_violations.cache_hit_rate_percent // 0' "$REPORT_FILE")

    # Calculate combined metrics
    local total_requests=$(jq -r '.results.dashboard_metrics.total_requests + .results.economics.total_requests + .results.guard_violations.total_requests' "$REPORT_FILE")
    local avg_response_time=$(echo "scale=3; ($dashboard_response_time + $economics_response_time + $guards_response_time) / 3" | bc)
    local avg_cache_rate=$(echo "scale=3; ($dashboard_cache_rate + $economics_cache_rate + $guards_cache_rate) / 3" | bc)

    # Estimate cost savings (simplified model)
    # Assuming cached requests are 50ms faster than uncached
    local avg_uncached_time=200  # Estimated average for uncached requests
    local time_saved_per_request=$(echo "scale=3; $avg_uncached_time - ($avg_response_time * (1 - $avg_cache_rate / 100))" | bc)
    local total_time_saved=$(echo "scale=3; $total_requests * $time_saved_per_request / 1000" | bc) # Convert to seconds

    # Estimate bandwidth savings (simplified)
    local avg_response_size=5000  # bytes (estimated)
    local bandwidth_saved=$(echo "scale=3; $total_requests * $avg_cache_rate / 100 * $avg_response_size / 1024" | bc) # KB

    # Update cache economics section
    jq --argjson total_requests "$total_requests" \
       --argjson avg_response_time "$avg_response_time" \
       --argjson avg_cache_rate "$avg_cache_rate" \
       --argjson time_saved "$total_time_saved" \
       --argjson bandwidth_saved "$bandwidth_saved" \
       '.cache_economics = {
           "total_requests_tested": $total_requests,
           "average_response_time_ms": $avg_response_time,
           "average_cache_hit_rate_percent": $avg_cache_rate,
           "estimated_time_saved_seconds": $time_saved,
           "estimated_bandwidth_saved_kb": $bandwidth_saved,
           "cost_efficiency_score": ($avg_cache_rate > 85),
           "performance_grade": (
             if $avg_cache_rate >= 90 then "A"
             elif $avg_cache_rate >= 80 then "B"
             elif $avg_cache_rate >= 70 then "C"
             else "D"
             end
           )
       }' "$REPORT_FILE" > tmp.json && mv tmp.json "$REPORT_FILE"

    log "Total requests tested: $total_requests"
    log "Average response time: ${avg_response_time}ms"
    log "Average cache hit rate: ${avg_cache_rate}%"
    log "Estimated time saved: ${total_time_saved}s"
    log "Estimated bandwidth saved: ${bandwidth_saved}KB"

    # Performance grading
    if (( $(echo "$avg_cache_rate >= 90" | bc -l) )); then
        success "Excellent cache performance! Grade: A"
    elif (( $(echo "$avg_cache_rate >= 80" | bc -l) )); then
        success "Good cache performance. Grade: B"
    elif (( $(echo "$avg_cache_rate >= 70" | bc -l) )); then
        warning "Fair cache performance. Grade: C"
    else
        error "Poor cache performance. Grade: D"
    fi
}

# Generate final summary
generate_summary() {
    log "Generating final summary..."

    # Calculate overall metrics
    local avg_cache_rate=$(jq -r '.cache_economics.average_cache_hit_rate_percent // 0' "$REPORT_FILE")
    local avg_response_time=$(jq -r '.cache_economics.average_response_time_ms // 0' "$REPORT_FILE")
    local performance_grade=$(jq -r '.cache_economics.performance_grade // "F"' "$REPORT_FILE")
    local total_tests=4
    local passed_tests=0

    # Check if cache hit rate meets targets
    if (( $(echo "$avg_cache_rate >= 80" | bc -l) )); then
        ((passed_tests++))
    fi

    if (( $(echo "$avg_response_time <= 200" | bc -l) )); then
        ((passed_tests++))
    fi

    # Check dashboard health
    local health_ok=$(jq -r '.results.dashboard_health.success // false' "$REPORT_FILE")
    if [ "$health_ok" = "true" ]; then
        ((passed_tests++))
    fi

    # Check cache refresh
    local refresh_ok=$(jq -r '.results.cache_refresh.success // false' "$REPORT_FILE")
    if [ "$refresh_ok" = "true" ]; then
        ((passed_tests++))
    fi

    local test_pass_rate=$(echo "scale=3; ($passed_tests * 100) / $total_tests" | bc)

    # Update summary
    jq --argjson total_tests "$total_tests" \
       --argjson passed_tests "$passed_tests" \
       --argjson test_pass_rate "$test_pass_rate" \
       --arg performance_grade "$performance_grade" \
       '.summary = {
           "total_tests_run": $total_tests,
           "tests_passed": $passed_tests,
           "test_pass_rate_percent": $test_pass_rate,
           "performance_grade": $performance_grade,
           "overall_success": ($test_pass_rate >= 75),
           "recommendations": [
             if ($test_pass_rate < 75) then "Improve overall test performance" else null end,
             if (.cache_economics.average_cache_hit_rate_percent < 85) then "Optimize cache hit rates" else null end,
             if (.cache_economics.average_response_time_ms > 200) then "Reduce response times" else null end
           ] | map(select(. != null))
       }' "$REPORT_FILE" > tmp.json && mv tmp.json "$REPORT_FILE"

    # Print summary
    echo
    log "=== CACHE ECONOMICS TEST SUMMARY ==="
    log "Tests Passed: $passed_tests/$total_tests"
    log "Test Pass Rate: ${test_pass_rate}%"
    log "Performance Grade: $performance_grade"
    log "Average Cache Hit Rate: ${avg_cache_rate}%"
    log "Average Response Time: ${avg_response_time}ms"

    if (( $(echo "$test_pass_rate >= 75" | bc -l) )); then
        success "Overall test result: PASSED"
    else
        error "Overall test result: FAILED"
    fi

    log "Report saved to: $REPORT_FILE"
}

# Check dependencies
check_dependencies() {
    local missing_deps=()

    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi

    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi

    if ! command -v bc &> /dev/null; then
        missing_deps+=("bc")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        error "Missing dependencies: ${missing_deps[*]}"
        error "Please install the missing tools and try again."
        exit 1
    fi
}

# Main execution
main() {
    log "Starting Cache Economics Test..."
    log "API Base: $API_BASE"
    log "Report will be saved to: $REPORT_FILE"

    # Check dependencies
    check_dependencies

    # Initialize report
    init_report

    # Run tests
    test_dashboard_metrics
    test_economics
    test_guard_violations
    test_cache_refresh
    test_dashboard_health

    # Calculate economics
    calculate_cache_economics

    # Generate summary
    generate_summary

    log "Cache economics test completed!"
}

# Run main function
main "$@"