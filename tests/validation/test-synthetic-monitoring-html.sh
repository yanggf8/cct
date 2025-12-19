#!/bin/bash

# Synthetic Monitoring for HTML Endpoints
# Monitors HTML report endpoints for availability, performance, and content quality

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_KEY="${X_API_KEY:-test}"
BASE_URL="${CCT_URL:-https://tft-trading-system.yanggf.workers.dev}"
LOG_FILE="synthetic-monitoring-$(date +%Y%m%d).log"

# Test configuration
declare -A HTML_ENDPOINTS=(
    ["/pre-market-briefing"]="Pre-Market Briefing"
    ["/intraday-check"]="Intraday Performance Check"
    ["/end-of-day-summary"]="End-of-Day Trading Summary"
    ["/weekly-review"]="Weekly Trading Review"
    ["/daily-summary"]="Daily Analysis Summary"
    ["/weekly-analysis"]="Weekly Analysis Dashboard"
    ["/"]="Trading Dashboard"
)

# Performance thresholds (ms)
RESPONSE_TIME_WARNING=2000
RESPONSE_TIME_CRITICAL=5000

# Content size thresholds (bytes)
MIN_CONTENT_SIZE=1000
MAX_CONTENT_SIZE=1000000

# Logging function
log_result() {
    local level="$1"
    local endpoint="$2"
    local metric="$3"
    local value="$4"
    local status="$5"

    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$timestamp] [$level] $endpoint - $metric: $value ($status)" | tee -a "$LOG_FILE"
}

# Test endpoint availability and performance
test_endpoint_performance() {
    local endpoint="$1"
    local name="$2"

    echo "Testing: $name"
    echo "Endpoint: $endpoint"

    local start_time=$(date +%s%N)
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL$endpoint" || echo "000")
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

    # Get content size
    local content_size=$(curl -s --max-time 10 "$BASE_URL$endpoint" | wc -c || echo "0")

    # Get content type
    local content_type=$(curl -s -I --max-time 10 "$BASE_URL$endpoint" | grep -i "content-type" | cut -d: -f2 | tr -d ' \r\n' || echo "unknown")

    # Evaluate results
    local status="PASS"
    local issues=()

    # Check HTTP status
    if [[ "$http_code" != "200" ]]; then
        issues+=("HTTP $http_code")
        status="FAIL"
        log_result "ERROR" "$endpoint" "http_status" "$http_code" "FAIL"
    else
        log_result "INFO" "$endpoint" "http_status" "$http_code" "PASS"
    fi

    # Check response time
    if [[ $response_time -gt $RESPONSE_TIME_CRITICAL ]]; then
        issues+=("Response time ${response_time}ms")
        status="FAIL"
        log_result "ERROR" "$endpoint" "response_time_ms" "$response_time" "FAIL"
    elif [[ $response_time -gt $RESPONSE_TIME_WARNING ]]; then
        issues+=("Response time ${response_time}ms")
        if [[ "$status" == "PASS" ]]; then status="WARNING"; fi
        log_result "WARN" "$endpoint" "response_time_ms" "$response_time" "WARNING"
    else
        log_result "INFO" "$endpoint" "response_time_ms" "$response_time" "PASS"
    fi

    # Check content type
    if [[ ! "$content_type" == *"text/html"* ]]; then
        issues+=("Content type: $content_type")
        status="FAIL"
        log_result "ERROR" "$endpoint" "content_type" "$content_type" "FAIL"
    else
        log_result "INFO" "$endpoint" "content_type" "$content_type" "PASS"
    fi

    # Check content size
    if [[ $content_size -lt $MIN_CONTENT_SIZE ]]; then
        issues+=("Content too small: ${content_size} bytes")
        status="FAIL"
        log_result "ERROR" "$endpoint" "content_size_bytes" "$content_size" "FAIL"
    elif [[ $content_size -gt $MAX_CONTENT_SIZE ]]; then
        issues+=("Content too large: ${content_size} bytes")
        if [[ "$status" == "PASS" ]]; then status="WARNING"; fi
        log_result "WARN" "$endpoint" "content_size_bytes" "$content_size" "WARNING"
    else
        log_result "INFO" "$endpoint" "content_size_bytes" "$content_size" "PASS"
    fi

    # Check for HTML structure
    local html_content=$(curl -s --max-time 10 "$BASE_URL$endpoint" || echo "")
    if echo "$html_content" | grep -q "<!DOCTYPE html>" && echo "$html_content" | grep -q "<html"; then
        log_result "INFO" "$endpoint" "html_structure" "valid" "PASS"
    else
        issues+=("Invalid HTML structure")
        status="FAIL"
        log_result "ERROR" "$endpoint" "html_structure" "invalid" "FAIL"
    fi

    # Check for error indicators
    if echo "$html_content" | grep -qi "error\|exception\|500\|404"; then
        issues+=("Error indicators in content")
        if [[ "$status" == "PASS" ]]; then status="WARNING"; fi
        log_result "WARN" "$endpoint" "error_indicators" "found" "WARNING"
    else
        log_result "INFO" "$endpoint" "error_indicators" "none" "PASS"
    fi

    # Output results
    if [[ "$status" == "PASS" ]]; then
        echo -e "✅ ${GREEN}PASS${NC} - ${response_time}ms, ${content_size} bytes"
    elif [[ "$status" == "WARNING" ]]; then
        echo -e "⚠️  ${YELLOW}WARNING${NC} - ${response_time}ms, ${content_size} bytes"
        echo -e "   Issues: ${issues[*]}"
    else
        echo -e "❌ ${RED}FAIL${NC} - ${response_time}ms, ${content_size} bytes"
        echo -e "   Issues: ${issues[*]}"
    fi

    return $([[ "$status" == "PASS" ]] && echo 0 || echo 1)
}

# Test API endpoints that support HTML reports
test_api_html_support() {
    echo -e "\n${BLUE}Testing API HTML Support${NC}"
    echo "==============================="

    local test_passed=0
    local test_total=0

    # Test authenticated endpoints with HTML support
    local auth_endpoints=(
        "GET:/api/v1/reports/latest"
        "GET:/api/v1/reports/pre-market"
        "GET:/api/v1/reports/intraday"
        "GET:/api/v1/reports/end-of-day"
        "GET:/api/v1/reports/weekly"
    )

    for endpoint_spec in "${auth_endpoints[@]}"; do
        local method="${endpoint_spec%:*}"
        local endpoint="${endpoint_spec#*:}"

        ((test_total++))

        echo "Testing API endpoint: $method $endpoint"

        local start_time=$(date +%s%N)
        local http_code
        if [[ "$method" == "GET" ]]; then
            http_code=$(curl -s -o /dev/null -w "%{http_code}" \
                -H "X-API-Key: $API_KEY" \
                --max-time 10 \
                "$BASE_URL$endpoint" || echo "000")
        fi
        local end_time=$(date +%s%N)
        local response_time=$(( (end_time - start_time) / 1000000 ))

        if [[ "$http_code" == "200" ]]; then
            echo -e "✅ ${GREEN}API endpoint accessible${NC} - ${response_time}ms"
            log_result "INFO" "$endpoint" "api_response_time_ms" "$response_time" "PASS"
            ((test_passed++))
        else
            echo -e "❌ ${RED}API endpoint failed${NC} - HTTP $http_code"
            log_result "ERROR" "$endpoint" "api_http_status" "$http_code" "FAIL"
        fi
    done

    echo "API HTML Support: $test_passed/$test_total passed"
    return $((test_total - test_passed))
}

# Test error handling and fallback pages
test_error_scenarios() {
    echo -e "\n${BLUE}Testing Error Scenarios${NC}"
    echo "=========================="

    local test_passed=0
    local test_total=0

    # Test non-existent endpoint
    ((test_total++))
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/non-existent-page" || echo "000")
    if [[ "$http_code" == "404" ]] || [[ "$http_code" == "200" ]]; then
        echo -e "✅ ${GREEN}404 handling appropriate${NC}"
        ((test_passed++))
        log_result "INFO" "/non-existent-page" "404_handling" "appropriate" "PASS"
    else
        echo -e "❌ ${RED}Unexpected 404 handling${NC} - HTTP $http_code"
        log_result "ERROR" "/non-existent-page" "404_handling" "unexpected" "FAIL"
    fi

    # Test with invalid headers (should still work)
    ((test_total++))
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Invalid-Header: test" \
        --max-time 10 \
        "$BASE_URL/pre-market-briefing" || echo "000")
    if [[ "$http_code" == "200" ]]; then
        echo -e "✅ ${GREEN}Header handling robust${NC}"
        ((test_passed++))
        log_result "INFO" "/pre-market-briefing" "header_handling" "robust" "PASS"
    else
        echo -e "❌ ${RED}Header handling failed${NC} - HTTP $http_code"
        log_result "ERROR" "/pre-market-briefing" "header_handling" "failed" "FAIL"
    fi

    echo "Error Scenarios: $test_passed/$test_total passed"
    return $((test_total - test_passed))
}

# Generate synthetic monitoring report
generate_report() {
    local total_tests="$1"
    local total_passed="$2"
    local total_failed="$3"

    local success_rate=0
    if [[ $total_tests -gt 0 ]]; then
        success_rate=$(( total_passed * 100 / total_tests ))
    fi

    echo -e "\n${BLUE}Synthetic Monitoring Report${NC}"
    echo "==============================="
    echo "Total Tests: $total_tests"
    echo "Passed: $total_passed"
    echo "Failed: $total_failed"
    echo "Success Rate: ${success_rate}%"

    # Categorize results
    if [[ $success_rate -ge 95 ]]; then
        echo -e "Status: 🟢 ${GREEN}EXCELLENT${NC} - All systems operational"
    elif [[ $success_rate -ge 85 ]]; then
        echo -e "Status: 🟡 ${YELLOW}GOOD${NC} - Minor issues detected"
    elif [[ $success_rate -ge 70 ]]; then
        echo -e "Status: 🟠 ${YELLOW}NEEDS ATTENTION${NC} - Significant issues found"
    else
        echo -e "Status: 🔴 ${RED}CRITICAL${NC} - Multiple failures detected"
    fi

    echo "Log file: $LOG_FILE"

    # Return appropriate exit code
    if [[ $success_rate -ge 90 ]]; then
        return 0
    else
        return 1
    fi
}

# Main execution
main() {
    echo "HTML Endpoints Synthetic Monitoring"
    echo "==================================="
    echo "Base URL: $BASE_URL"
    echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo ""

    local total_tests=0
    local total_passed=0
    local total_failed=0

    # Test all HTML endpoints
    echo -e "${BLUE}Testing HTML Endpoints${NC}"
    echo "==========================="

    for endpoint in "${!HTML_ENDPOINTS[@]}"; do
        local name="${HTML_ENDPOINTS[$endpoint]}"

        ((total_tests++))

        if test_endpoint_performance "$endpoint" "$name"; then
            ((total_passed++))
        else
            ((total_failed++))
        fi

        echo "----------------------------------------"
        echo ""
    done

    # Test API HTML support
    local api_tests=0
    local api_passed=0
    if test_api_html_support; then
        api_passed=0
    else
        api_passed=$?
    fi
    api_tests=5
    ((total_tests += api_tests))
    ((total_passed += (api_tests - api_passed)))
    ((total_failed += api_passed))

    # Test error scenarios
    local error_tests=0
    local error_passed=0
    if test_error_scenarios; then
        error_passed=0
    else
        error_passed=$?
    fi
    error_tests=2
    ((total_tests += error_tests))
    ((total_passed += (error_tests - error_passed)))
    ((total_failed += error_passed))

    # Generate final report
    generate_report "$total_tests" "$total_passed" "$total_failed"
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi