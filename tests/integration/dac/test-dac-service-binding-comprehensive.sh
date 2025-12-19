#!/bin/bash

# Comprehensive DAC Service Binding Integration Test Suite
# Tests DAC integration through Cloudflare service bindings (not HTTP)
# Validates service binding functionality, performance, and regression prevention

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CCT_URL="${CCT_URL:-https://tft-trading-system.yanggf.workers.dev}"
DAC_URL="${DAC_URL:-https://dac-backend.yanggf.workers.dev}"
# Use unified X_API_KEY; no insecure defaults
API_KEY="${X_API_KEY:-}"
if [[ -z "$API_KEY" ]]; then
  echo "❌ ERROR: X_API_KEY environment variable is not set (required for authenticated tests)" >&2
  echo "Set it via: export X_API_KEY=your_api_key" >&2
  exit 1
fi
TEST_SYMBOLS=("AAPL" "MSFT" "GOOGL" "TSLA" "NVDA" "META" "AMZN" "NFLX")
REPORT_DIR="$SCRIPT_DIR/test-reports"
BASELINE_DIR="$SCRIPT_DIR/baselines"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORT_DIR/dac-service-binding-test-$TIMESTAMP.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Results tracking
declare -a TEST_RESULTS=()
declare -a PERFORMANCE_METRICS=()

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$REPORT_FILE.log"
}

info() {
    echo -e "${BLUE}ℹ️  INFO: $1${NC}"
    log "INFO: $1"
}

success() {
    echo -e "${GREEN}✅ SUCCESS: $1${NC}"
    log "SUCCESS: $1"
    ((PASSED_TESTS++))
}

fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    log "FAIL: $1"
    ((FAILED_TESTS++))
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
    log "WARNING: $1"
}

skip() {
    echo -e "${PURPLE}SKIP: $1${NC}"
    log "SKIP: $1"
    ((SKIPPED_TESTS++))
}

# Performance tracking
start_timer() {
    echo $(($(date +%s%N) / 1000000))
}

end_timer() {
    local start_time=$1
    local end_time=$(($(date +%s%N) / 1000000))
    echo $((end_time - start_time))
}

record_performance() {
    local test_name="$1"
    local duration="$2"
    local status="$3"

    PERFORMANCE_METRICS+=("{\"test\":\"$test_name\",\"duration_ms\":$duration,\"status\":\"$status\",\"timestamp\":\"$(date -Iseconds)\"}")
}

# Initialize test environment
init_test_environment() {
    info "Initializing DAC Service Binding test environment..."

    # Create directories
    mkdir -p "$REPORT_DIR" "$BASELINE_DIR"

    # Initialize report file
    cat > "$REPORT_FILE" <<EOF
{
  "test_suite": "DAC Service Binding Integration Tests",
  "timestamp": "$(date -Iseconds)",
  "cct_url": "$CCT_URL",
  "dac_url": "$DAC_URL",
  "test_symbols": [$(printf '"%s",' "${TEST_SYMBOLS[@]}" | sed 's/,$//')],
  "environment": {
    "node": "$(node --version)",
    "wrangler": "$(wrangler --version 2>/dev/null | head -1 || echo 'not available')",
    "platform": "$(uname -s)",
    "shell": "$0"
  },
  "tests": []
}
EOF

    info "Test environment initialized"
}

# Test helpers
test_api_endpoint() {
    local url="$1"
    local test_name="$2"
    local expected_status="${3:-200}"
    local auth_header="${4:-}"

    ((TOTAL_TESTS++))

    local headers=()
    if [[ -n "$auth_header" ]]; then
        headers+=(-H "$auth_header")
    fi

    info "Testing: $test_name"

    local start_time=$(start_timer)
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" "${headers[@]}" "$url" 2>/dev/null)
    local end_time=$(end_timer "$start_time")

    local body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]{3}$//')
    local status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')

    if [[ "$status" -eq "$expected_status" ]]; then
        success "$test_name (${end_time}ms)"
        record_performance "$test_name" "$end_time" "PASS"
        TEST_RESULTS+=("{\"name\":\"$test_name\",\"status\":\"PASS\",\"duration_ms\":$end_time,\"http_status\":$status}")
        return 0
    else
        fail "$test_name (HTTP $status, expected $expected_status)"
        record_performance "$test_name" "$end_time" "FAIL"
        TEST_RESULTS+=("{\"name\":\"$test_name\",\"status\":\"FAIL\",\"duration_ms\":$end_time,\"http_status\":$status,\"error\":\"HTTP $status != $expected_status\"}")
        echo "  Response body: $body" | head -3
        return 1
    fi
}

test_json_response() {
    local url="$1"
    local test_name="$2"
    local json_path="$3"
    local expected_value="$4"
    local auth_header="$5"

    ((TOTAL_TESTS++))

    local headers=()
    if [[ -n "$auth_header" ]]; then
        headers+=(-H "$auth_header" -H "Content-Type: application/json")
    fi

    info "Testing: $test_name (JSON validation)"

    local start_time=$(start_timer)
    local response=$(curl -s "${headers[@]}" "$url" 2>/dev/null)
    local end_time=$(end_timer "$start_time")

    # Test if response is valid JSON
    if ! echo "$response" | jq . >/dev/null 2>&1; then
        fail "$test_name - Invalid JSON response"
        record_performance "$test_name" "$end_time" "FAIL"
        TEST_RESULTS+=("{\"name\":\"$test_name\",\"status\":\"FAIL\",\"duration_ms\":$end_time,\"error\":\"Invalid JSON\"}")
        return 1
    fi

    # Test JSON path value
    local actual_value=$(echo "$response" | jq -r "$json_path" 2>/dev/null)

    if [[ "$actual_value" == "$expected_value" ]]; then
        success "$test_name - JSON path $json_path = $expected_value (${end_time}ms)"
        record_performance "$test_name" "$end_time" "PASS"
        TEST_RESULTS+=("{\"name\":\"$test_name\",\"status\":\"PASS\",\"duration_ms\":$end_time,\"json_path\":\"$json_path\",\"expected\":\"$expected_value\",\"actual\":\"$actual_value\"}")
        return 0
    else
        fail "$test_name - JSON path $json_path = '$actual_value', expected '$expected_value'"
        record_performance "$test_name" "$end_time" "FAIL"
        TEST_RESULTS+=("{\"name\":\"$test_name\",\"status\":\"FAIL\",\"duration_ms\":$end_time,\"json_path\":\"$json_path\",\"expected\":\"$expected_value\",\"actual\":\"$actual_value\"}")
        return 1
    fi
}

# Test suites
test_system_connectivity() {
    info "=== System Connectivity Tests ==="

    # Test CCT system health
    test_api_endpoint "$CCT_URL/api/v1/data/health" "CCT API Health Check" 200

    # Test DAC system health (direct HTTP for comparison)
    test_api_endpoint "$DAC_URL/api/health" "DAC Backend Health Check" 200

    # Test CCT cache system
    test_json_response "$CCT_URL/api/v1/cache/health" "CCT Cache Health" ".assessment.status" "healthy"

    # Test DAC availability through service binding (indirect test)
    test_api_endpoint "$CCT_URL/api/v1/sentiment/health" "Enhanced Sentiment Health" 200
}

test_durable_objects_cache() {
    info "=== Durable Objects Cache Tests ==="

    # Test cache health and metrics
    test_json_response "$CCT_URL/api/v1/cache/health" "Cache Health Status" ".assessment.status" "healthy"
    test_json_response "$CCT_URL/api/v1/cache/health" "Cache Overall Score" ".assessment.overallScore" "100"
    test_json_response "$CCT_URL/api/v1/cache/health" "L1 Cache Enabled" ".assessment.l1Metrics.enabled" "true"

    # Test L1 cache hit rate (93%+ threshold)
    ((TOTAL_TESTS++))
    info "Testing L1 cache hit rate (93%+ threshold)..."

    local hit_rate=$(curl -s "$CCT_URL/api/v1/cache/health" | jq -r '.assessment.l1Metrics.hitRate // 0')

    if [[ "$hit_rate" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
        if (( $(echo "$hit_rate >= 93" | bc -l) )); then
            success "L1 Cache Hit Rate: ${hit_rate}% (meets 93% threshold)"
            record_performance "L1 Cache Hit Rate" "$hit_rate" "PASS"
            TEST_RESULTS+=("{\"name\":\"L1 Cache Hit Rate\",\"status\":\"PASS\",\"hit_rate\":$hit_rate,\"threshold\":93}")
        else
            fail "L1 Cache Hit Rate: ${hit_rate}% (below 93% threshold)"
            record_performance "L1 Cache Hit Rate" "$hit_rate" "FAIL"
            TEST_RESULTS+=("{\"name\":\"L1 Cache Hit Rate\",\"status\":\"FAIL\",\"hit_rate\":$hit_rate,\"threshold\":93}")
        fi
    else
        fail "L1 Cache Hit Rate: Invalid value '$hit_rate'"
        TEST_RESULTS+=("{\"name\":\"L1 Cache Hit Rate\",\"status\":\"FAIL\",\"error\":\"Invalid hit rate value\"}")
    fi

    # Test cache configuration
    test_api_endpoint "$CCT_URL/api/v1/cache/config" "Cache Configuration" 200

    # Test cache performance with multiple requests
    info "Testing cache performance with multiple requests..."

    local total_time=0
    for i in {1..5}; do
        local start=$(start_timer)
        curl -s "$CCT_URL/api/v1/data/symbols" >/dev/null
        local duration=$(end_timer "$start")
        total_time=$((total_time + duration))
    done

    local avg_time=$((total_time / 5))

    ((TOTAL_TESTS++))
    if [[ $avg_time -lt 100 ]]; then
        success "Cache performance average: ${avg_time}ms (<100ms target)"
        record_performance "Cache Performance Average" "$avg_time" "PASS"
        TEST_RESULTS+=("{\"name\":\"Cache Performance Average\",\"status\":\"PASS\",\"duration_ms\":$avg_time,\"target\":\"<100ms\"}")
    else
        warning "Cache performance average: ${avg_time}ms (>100ms target)"
        record_performance "Cache Performance Average" "$avg_time" "WARN"
        TEST_RESULTS+=("{\"name\":\"Cache Performance Average\",\"status\":\"WARN\",\"duration_ms\":$avg_time,\"target\":\"<100ms\"}")
    fi
}

test_service_binding_integration() {
    info "=== DAC Service Binding Integration Tests ==="

    # Test if service binding is configured (check enhanced sentiment health)
    test_api_endpoint "$CCT_URL/api/v1/sentiment/health" "Service Binding Health Check" 200

    # Test enhanced sentiment configuration
    test_json_response "$CCT_URL/api/v1/sentiment/config" "Enhanced Sentiment Config" ".config.dac_integration.enabled" "true"
    test_json_response "$CCT_URL/api/v1/sentiment/config" "DAC URL Configured" ".config.dac_integration.url" "https://dac-backend.yanggf.workers.dev"

    # Test DAC API key configuration
    test_json_response "$CCT_URL/api/v1/sentiment/config" "DAC API Key Present" ".config.dac_integration.has_api_key" "true"
}

test_service_binding_latency() {
    info "=== Service Binding Latency Tests ==="

    # Test direct service binding latency with lightweight endpoint
    info "Measuring service binding latency over 10 requests..."

    local -a durations=()
    local total_time=0
    local successful_requests=0

    for i in {1..10}; do
        local start=$(start_timer)
        local response=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$CCT_URL/api/v1/sentiment/health" 2>/dev/null)
        local duration=$(end_timer "$start")

        local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)

        if [[ "$http_code" == "200" ]]; then
            durations+=("$duration")
            total_time=$((total_time + duration))
            ((successful_requests++))
        fi
    done

    if [[ $successful_requests -eq 0 ]]; then
        ((TOTAL_TESTS++))
        fail "Service binding latency test failed - no successful requests"
        TEST_RESULTS+=("{\"name\":\"Service Binding Latency\",\"status\":\"FAIL\",\"error\":\"No successful requests\"}")
        return 1
    fi

    # Calculate average (p50 approximation)
    local avg_latency=$((total_time / successful_requests))

    # Sort durations for p95 calculation
    IFS=$'\n' sorted_durations=($(sort -n <<<"${durations[*]}"))
    unset IFS

    local p95_index=$(( (successful_requests * 95) / 100 ))
    local p95_latency=${sorted_durations[$p95_index]:-$avg_latency}

    ((TOTAL_TESTS++))
    info "Service binding latency: p50=${avg_latency}ms, p95=${p95_latency}ms"

    if [[ $avg_latency -lt 100 ]]; then
        if [[ $p95_latency -lt 200 ]]; then
            success "Service binding latency: p50=${avg_latency}ms (<100ms target), p95=${p95_latency}ms"
            record_performance "Service Binding Latency p50" "$avg_latency" "PASS"
            TEST_RESULTS+=("{\"name\":\"Service Binding Latency\",\"status\":\"PASS\",\"p50_ms\":$avg_latency,\"p95_ms\":$p95_latency,\"target_p50\":\"<100ms\",\"successful_requests\":$successful_requests}")
        else
            fail "Service binding latency: p50=${avg_latency}ms (PASS), but p95=${p95_latency}ms (>200ms)"
            record_performance "Service Binding Latency p50" "$avg_latency" "FAIL"
            TEST_RESULTS+=("{\"name\":\"Service Binding Latency\",\"status\":\"FAIL\",\"p50_ms\":$avg_latency,\"p95_ms\":$p95_latency,\"error\":\"p95 above 200ms\"}")
        fi
    else
        fail "Service binding latency: p50=${avg_latency}ms (>=100ms threshold)"
        record_performance "Service Binding Latency p50" "$avg_latency" "FAIL"
        TEST_RESULTS+=("{\"name\":\"Service Binding Latency\",\"status\":\"FAIL\",\"p50_ms\":$avg_latency,\"p95_ms\":$p95_latency,\"target_p50\":\"<100ms\"}")
    fi
}

test_enhanced_sentiment_pipeline() {
    info "=== Enhanced Sentiment Pipeline Tests ==="

    # Test single symbol sentiment analysis
    local test_symbol="AAPL"

    ((TOTAL_TESTS++))
    info "Testing enhanced sentiment analysis for $test_symbol"

    local start_time=$(start_timer)
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $API_KEY" \
        -d "{\"symbol\":\"$test_symbol\",\"use_dac_integration\":true}" \
        "$CCT_URL/api/v1/sentiment/enhanced" 2>/dev/null)
    local end_time=$(end_timer "$start_time")

    # Test if response is valid JSON
    if echo "$response" | jq . >/dev/null 2>&1; then
        local success=$(echo "$response" | jq -r '.success // false')
        local symbol=$(echo "$response" | jq -r '.data.symbol // null')

        if [[ "$success" == "true" && "$symbol" == "$test_symbol" ]]; then
            success "Enhanced sentiment analysis for $test_symbol (${end_time}ms)"
            record_performance "Enhanced Sentiment $test_symbol" "$end_time" "PASS"
            TEST_RESULTS+=("{\"name\":\"Enhanced Sentiment $test_symbol\",\"status\":\"PASS\",\"duration_ms\":$end_time,\"symbol\":\"$test_symbol\"}")
        else
            fail "Enhanced sentiment analysis failed for $test_symbol"
            record_performance "Enhanced Sentiment $test_symbol" "$end_time" "FAIL"
            TEST_RESULTS+=("{\"name\":\"Enhanced Sentiment $test_symbol\",\"status\":\"FAIL\",\"duration_ms\":$end_time,\"symbol\":\"$test_symbol\",\"response\":\"$response\"}")
        fi
    else
        fail "Enhanced sentiment analysis returned invalid JSON for $test_symbol"
        record_performance "Enhanced Sentiment $test_symbol" "$end_time" "FAIL"
        TEST_RESULTS+=("{\"name\":\"Enhanced Sentiment $test_symbol\",\"status\":\"FAIL\",\"duration_ms\":$end_time,\"symbol\":\"$test_symbol\",\"error\":\"Invalid JSON\"}")
    fi

    # Test batch sentiment analysis
    ((TOTAL_TESTS++))
    info "Testing batch sentiment analysis for 3 symbols"

    start_time=$(start_timer)
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $API_KEY" \
        -d '{"symbols":["AAPL","MSFT","GOOGL"],"use_dac_integration":true}' \
        "$CCT_URL/api/v1/sentiment/batch" 2>/dev/null)
    end_time=$(end_timer "$start_time")

    if echo "$response" | jq . >/dev/null 2>&1; then
        local success=$(echo "$response" | jq -r '.success // false')
        local total=$(echo "$response" | jq -r '.metadata.total_symbols // 0')

        if [[ "$success" == "true" && "$total" -eq 3 ]]; then
            success "Batch sentiment analysis for 3 symbols (${end_time}ms)"
            record_performance "Batch Sentiment 3 Symbols" "$end_time" "PASS"
            TEST_RESULTS+=("{\"name\":\"Batch Sentiment 3 Symbols\",\"status\":\"PASS\",\"duration_ms\":$end_time,\"symbol_count\":3}")
        else
            fail "Batch sentiment analysis failed (expected 3 symbols, got $total)"
            record_performance "Batch Sentiment 3 Symbols" "$end_time" "FAIL"
            TEST_RESULTS+=("{\"name\":\"Batch Sentiment 3 Symbols\",\"status\":\"FAIL\",\"duration_ms\":$end_time\",\"expected\":3,\"actual\":$total}")
        fi
    else
        fail "Batch sentiment analysis returned invalid JSON"
        record_performance "Batch Sentiment 3 Symbols" "$end_time" "FAIL"
        TEST_RESULTS+=("{\"name\":\"Batch Sentiment 3 Symbols\",\"status\":\"FAIL\",\"duration_ms\":$end_time,\"error\":\"Invalid JSON\"}")
    fi
}

test_error_handling() {
    info "=== Error Handling Tests ==="

    # Test invalid API key
    ((TOTAL_TESTS++))
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-API-Key: invalid_key" \
        -d '{"symbol":"AAPL","use_dac_integration":true}' \
        "$CCT_URL/api/v1/sentiment/enhanced" 2>/dev/null)

    if echo "$response" | jq . >/dev/null 2>&1; then
        local success=$(echo "$response" | jq -r '.success // true')
        if [[ "$success" == "false" ]]; then
            success "Invalid API key properly rejected"
            TEST_RESULTS+=("{\"name\":\"Invalid API Key Test\",\"status\":\"PASS\"}")
        else
            fail "Invalid API key was accepted"
            TEST_RESULTS+=("{\"name\":\"Invalid API Key Test\",\"status\":\"FAIL\",\"error\":\"Should have failed\"}")
        fi
    else
        skip "Invalid API key test - invalid response"
    fi

    # Test invalid symbol format
    ((TOTAL_TESTS++))
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $API_KEY" \
        -d '{"symbol":"INVALID123","use_dac_integration":true}' \
        "$CCT_URL/api/v1/sentiment/enhanced" 2>/dev/null)

    if echo "$response" | jq . >/dev/null 2>&1; then
        local success=$(echo "$response" | jq -r '.success // true')
        if [[ "$success" == "false" ]]; then
            success "Invalid symbol format properly rejected"
            TEST_RESULTS+=("{\"name\":\"Invalid Symbol Test\",\"status\":\"PASS\"}")
        else
            fail "Invalid symbol format was accepted"
            TEST_RESULTS+=("{\"name\":\"Invalid Symbol Test\",\"status\":\"FAIL\",\"error\":\"Should have failed\"}")
        fi
    else
        skip "Invalid symbol test - invalid response"
    fi

    # Test missing required fields
    ((TOTAL_TESTS++))
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $API_KEY" \
        -d '{"use_dac_integration":true}' \
        "$CCT_URL/api/v1/sentiment/enhanced" 2>/dev/null)

    if echo "$response" | jq . >/dev/null 2>&1; then
        local success=$(echo "$response" | jq -r '.success // true')
        if [[ "$success" == "false" ]]; then
            success "Missing symbol field properly rejected"
            TEST_RESULTS+=("{\"name\":\"Missing Field Test\",\"status\":\"PASS\"}")
        else
            fail "Missing symbol field was accepted"
            TEST_RESULTS+=("{\"name\":\"Missing Field Test\",\"status\":\"FAIL\",\"error\":\"Should have failed\"}")
        fi
    else
        skip "Missing field test - invalid response"
    fi
}

test_performance_benchmarks() {
    info "=== Performance Benchmark Tests ==="

    # Test concurrent requests
    local concurrent_requests=5
    local pids=()
    local start_time=$(start_timer)

    info "Testing $concurrent_requests concurrent requests..."

    for i in $(seq 1 $concurrent_requests); do
        (
            curl -s -X POST \
                -H "Content-Type: application/json" \
                -H "X-API-Key: $API_KEY" \
                -d '{"symbol":"AAPL","use_dac_integration":true}' \
                "$CCT_URL/api/v1/sentiment/enhanced" >/dev/null 2>&1
        ) &
        pids+=($!)
    done

    # Wait for all requests to complete
    for pid in "${pids[@]}"; do
        wait "$pid"
    done

    local total_time=$(end_timer "$start_time")
    local avg_time=$((total_time / concurrent_requests))

    ((TOTAL_TESTS++))
    if [[ $avg_time -lt 2000 ]]; then  # 2 second target per request
        success "Concurrent requests average: ${avg_time}ms (<2000ms target)"
        record_performance "Concurrent Requests" "$avg_time" "PASS"
        TEST_RESULTS+=("{\"name\":\"Concurrent Requests\",\"status\":\"PASS\",\"duration_ms\":$avg_time,\"concurrent_count\":$concurrent_requests}")
    else
        warning "Concurrent requests average: ${avg_time}ms (>2000ms target)"
        record_performance "Concurrent Requests" "$avg_time" "WARN"
        TEST_RESULTS+=("{\"name\":\"Concurrent Requests\",\"status\":\"WARN\",\"duration_ms\":$avg_time,\"concurrent_count\":$concurrent_requests}")
    fi

    # Test cache performance improvement
    info "Testing cache performance with repeated requests..."

    # First request (cache miss)
    local first_time=$(start_timer)
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $API_KEY" \
        -d '{"symbol":"MSFT","use_dac_integration":true}' \
        "$CCT_URL/api/v1/sentiment/enhanced" >/dev/null 2>&1
    local first_duration=$(end_timer "$first_time")

    # Second request (should be cache hit)
    local second_time=$(start_timer)
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $API_KEY" \
        -d '{"symbol":"MSFT","use_dac_integration":true}' \
        "$CCT_URL/api/v1/sentiment/enhanced" >/dev/null 2>&1
    local second_duration=$(end_timer "$second_time")

    ((TOTAL_TESTS++))
    if [[ $second_duration -lt $((first_duration / 2)) ]]; then
        success "Cache performance improvement: First ${first_duration}ms, Second ${second_duration}ms"
        record_performance "Cache Performance Test" "$second_duration" "PASS"
        TEST_RESULTS+=("{\"name\":\"Cache Performance Test\",\"status\":\"PASS\",\"first_duration_ms\":$first_duration,\"second_duration_ms\":$second_duration}")
    else
        warning "Cache performance may not be optimal: First ${first_duration}ms, Second ${second_duration}ms"
        record_performance "Cache Performance Test" "$second_duration" "WARN"
        TEST_RESULTS+=("{\"name\":\"Cache Performance Test\",\"status\":\"WARN\",\"first_duration_ms\":$first_duration,\"second_duration_ms\":$second_duration}")
    fi
}

test_data_integrity() {
    info "=== Data Integrity Tests ==="

    # Test sentiment analysis returns required fields
    ((TOTAL_TESTS++))
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $API_KEY" \
        -d '{"symbol":"AAPL","use_dac_integration":true}' \
        "$CCT_URL/api/v1/sentiment/enhanced" 2>/dev/null)

    if echo "$response" | jq . >/dev/null 2>&1; then
        local required_fields=("success" "data" "metadata")
        local missing_fields=()

        for field in "${required_fields[@]}"; do
            if ! echo "$response" | jq -e ".$field" >/dev/null 2>&1; then
                missing_fields+=("$field")
            fi
        done

        if [[ ${#missing_fields[@]} -eq 0 ]]; then
            success "Response contains all required fields"
            TEST_RESULTS+=("{\"name\":\"Required Fields Test\",\"status\":\"PASS\"}")
        else
            fail "Response missing fields: ${missing_fields[*]}"
            TEST_RESULTS+=("{\"name\":\"Required Fields Test\",\"status\":\"FAIL\",\"missing_fields\":\"${missing_fields[*]}\"}")
        fi
    else
        fail "Invalid JSON response for data integrity test"
        TEST_RESULTS+=("{\"name\":\"Required Fields Test\",\"status\":\"FAIL\",\"error\":\"Invalid JSON\"}")
    fi

    # Test sentiment data types
    ((TOTAL_TESTS++))
    if echo "$response" | jq . >/dev/null 2>&1; then
        local sentiment=$(echo "$response" | jq -r '.data.sentiment // null')
        local confidence=$(echo "$response" | jq -r '.data.confidence // null')
        local symbol=$(echo "$response" | jq -r '.data.symbol // null')

        # Check if sentiment is valid
        local valid_sentiments=("bullish" "bearish" "neutral")
        local sentiment_valid=false

        for valid in "${valid_sentiments[@]}"; do
            if [[ "$sentiment" == "$valid" ]]; then
                sentiment_valid=true
                break
            fi
        done

        if [[ "$sentiment_valid" == true && "$confidence" =~ ^[0-9]+(\.[0-9]+)?$ && "$symbol" == "AAPL" ]]; then
            success "Data types are valid and consistent"
            TEST_RESULTS+=("{\"name\":\"Data Types Test\",\"status\":\"PASS\",\"sentiment\":\"$sentiment\",\"confidence\":$confidence,\"symbol\":\"$symbol\"}")
        else
            fail "Data types validation failed"
            TEST_RESULTS+=("{\"name\":\"Data Types Test\",\"status\":\"FAIL\",\"sentiment\":\"$sentiment\",\"confidence\":$confidence,\"symbol\":\"$symbol\"}")
        fi
    else
        skip "Data types test - invalid response"
    fi
}

# Regression detection
compare_with_baseline() {
    local baseline_file="$BASELINE_DIR/dac-service-binding-baseline.json"

    if [[ -f "$baseline_file" ]]; then
        info "Comparing with baseline performance..."

        # Load baseline metrics
        local baseline_success_rate=$(jq -r '.summary.success_rate' "$baseline_file" 2>/dev/null || echo "0")

        # Calculate current success rate
        local current_success_rate=0
        if [[ $TOTAL_TESTS -gt 0 ]]; then
            current_success_rate=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l)
        fi

        # Check for regression
        local success_rate_diff=$(echo "$current_success_rate - $baseline_success_rate" | bc -l)

        ((TOTAL_TESTS++))
        if (( $(echo "$success_rate_diff >= -5" | bc -l) )); then
            success "No regression detected: Current $current_success_rate%, Baseline $baseline_success_rate%"
            TEST_RESULTS+=("{\"name\":\"Regression Test\",\"status\":\"PASS\",\"current_rate\":$current_success_rate,\"baseline_rate\":$baseline_success_rate,\"diff\":$success_rate_diff}")
        else
            fail "Regression detected: Current $current_success_rate%, Baseline $baseline_success_rate% (${success_rate_diff}% change, >5% regression threshold)"
            TEST_RESULTS+=("{\"name\":\"Regression Test\",\"status\":\"FAIL\",\"current_rate\":$current_success_rate,\"baseline_rate\":$baseline_success_rate,\"diff\":$success_rate_diff,\"threshold\":-5}")
        fi
    else
        info "No baseline found for comparison"
    fi
}

# Generate comprehensive report
generate_report() {
    local success_rate=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        success_rate=$(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l)
    fi

    # Update report file with results
    local temp_file=$(mktemp)
    jq --arg total "$TOTAL_TESTS" \
       --arg passed "$PASSED_TESTS" \
       --arg failed "$FAILED_TESTS" \
       --arg skipped "$SKIPPED_TESTS" \
       --arg success_rate "$success_rate" \
       --arg timestamp "$(date -Iseconds)" \
       '.summary = {
           "total_tests": ($total | tonumber),
           "passed": ($passed | tonumber),
           "failed": ($failed | tonumber),
           "skipped": ($skipped | tonumber),
           "success_rate": ($success_rate | tonumber)
       } | .completed_at = $timestamp |
       .tests = $tests' \
       "$REPORT_FILE" > "$temp_file"

    # Add test results
    jq --argjson tests "[$(IFS=','; echo "${TEST_RESULTS[*]}")]" \
       '.tests = $tests' \
       "$temp_file" > "$REPORT_FILE"

    # Add performance metrics
    jq --argjson metrics "[$(IFS=','; echo "${PERFORMANCE_METRICS[*]}")]" \
       '.performance_metrics = $metrics' \
       "$REPORT_FILE" > "$temp_file"

    mv "$temp_file" "$REPORT_FILE"

    # Generate human-readable summary
    cat <<EOF

${BLUE}DAC Service Binding Integration Test Summary${NC}
================================================================

Test Results:
   Total Tests: $TOTAL_TESTS
   Passed: $PASSED_TESTS
   Failed: $FAILED_TESTS
   Skipped: $SKIPPED_TESTS
   Success Rate: $success_rate%

Performance:
   Report: $REPORT_FILE
   Log: $REPORT_FILE.log

System URLs:
   CCT System: $CCT_URL
   DAC Backend: $DAC_URL

${GREEN}Integration Status: Service Binding $success_rate${NC}
EOF
}

# Save baseline
save_baseline() {
    local baseline_file="$BASELINE_DIR/dac-service-binding-baseline.json"

    info "Saving current test results as baseline..."

    cp "$REPORT_FILE" "$baseline_file"

    success "Baseline saved to $baseline_file"
}

# Main execution
main() {
    local command="${1:-run}"
    local option="${2:-}"

    case "$command" in
        "baseline")
            init_test_environment
            test_system_connectivity
            test_durable_objects_cache
            test_service_binding_integration
            test_service_binding_latency
            test_enhanced_sentiment_pipeline
            test_error_handling
            test_performance_benchmarks
            test_data_integrity
            compare_with_baseline
            generate_report
            save_baseline
            ;;
        "run")
            init_test_environment
            test_system_connectivity
            test_durable_objects_cache
            test_service_binding_integration
            test_service_binding_latency
            test_enhanced_sentiment_pipeline
            test_error_handling
            test_performance_benchmarks
            test_data_integrity
            compare_with_baseline
            generate_report
            ;;
        "quick")
            init_test_environment
            test_system_connectivity
            test_service_binding_integration
            test_service_binding_latency
            test_enhanced_sentiment_pipeline
            generate_report
            ;;
        "help"|"--help"|"-h")
            cat <<EOF
DAC Service Binding Integration Test Suite

Usage: $0 <command> [options]

Commands:
  run                    Run full test suite (default)
  baseline              Run tests and save as baseline
  quick                  Run quick integration tests only
  help                   Show this help

Examples:
  $0                     # Run full test suite
  $0 baseline            # Save results as baseline
  $0 quick               # Quick integration check

Environment Variables:
  CCT_URL               Override CCT URL (default: $CCT_URL)
  DAC_URL               Override DAC URL (default: $DAC_URL)

EOF
            ;;
        *)
            echo "Unknown command: $command"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac

    # Exit with appropriate code
    if [[ $FAILED_TESTS -gt 0 ]]; then
        exit 1
    elif [[ $SKIPPED_TESTS -gt $((TOTAL_TESTS / 2)) ]]; then
        exit 2
    else
        exit 0
    fi
}

# Run main function
main "$@"