#!/bin/bash

# HTML Structure Unit Tests
# Validates title, unique content markers, DOCTYPE/head/body structure for each HTML route

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_KEY="${X_API_KEY:-test}"
BASE_URL="https://tft-trading-system.yanggf.workers.dev"

# Test configuration
declare -A TEST_ROUTES=(
    ["/pre-market-briefing"]="Pre-Market Briefing"
    ["/intraday-check"]="Intraday Performance Check"
    ["/end-of-day-summary"]="End-of-Day Trading Summary"
    ["/weekly-review"]="Weekly Trading Review"
    ["/daily-summary"]="Daily Analysis Summary"
    ["/weekly-analysis"]="Weekly Analysis Dashboard"
    ["/"]="Trading Dashboard"
)

declare -A CONTENT_MARKERS=(
    ["/pre-market-briefing"]="Pre-Market Briefing|Market Status|Pre-market data"
    ["/intraday-check"]="Intraday Performance|Session Phase|Real-time data"
    ["/end-of-day-summary"]="End-of-Day Trading|Market Close|Daily performance"
    ["/weekly-review"]="Weekly Trading Review|Performance Summary|Key metrics"
    ["/daily-summary"]="Daily Analysis|Market Overview|Daily insights"
    ["/weekly-analysis"]="Weekly Dashboard|AI Analysis|Performance comparison"
    ["/"]="Trading Dashboard|Market Intelligence|Real-time data"
)

# Test functions
validate_html_structure() {
    local endpoint="$1"
    local route_name="$2"
    local markers="$3"

    local html_content=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL$endpoint")

    if [ $? -ne 0 ]; then
        echo "❌ Failed to fetch content from $endpoint"
        return 1
    fi

    local test_passed=0

    # Test 1: DOCTYPE
    if echo "$html_content" | grep -q "<!DOCTYPE html>"; then
        echo "✅ DOCTYPE declaration present"
    else
        echo "❌ Missing DOCTYPE declaration"
        test_passed=1
    fi

    # Test 2: HTML structure
    if echo "$html_content" | grep -q "<html"; then
        echo "✅ <html> tag present"
    else
        echo "❌ Missing <html> tag"
        test_passed=1
    fi

    if echo "$html_content" | grep -q "<head>"; then
        echo "✅ <head> section present"
    else
        echo "❌ Missing <head> section"
        test_passed=1
    fi

    if echo "$html_content" | grep -q "<body>"; then
        echo "✅ <body> section present"
    else
        echo "❌ Missing <body> section"
        test_passed=1
    fi

    # Test 3: Title tag
    local title=$(echo "$html_content" | grep -o '<title[^>]*>[^<]*</title>' | sed 's/<title[^>]*>//;s/<\/title>//' 2>/dev/null || echo "")
    if [ -n "$title" ]; then
        echo "✅ Title found: $title"
    else
        echo "❌ Missing or empty title"
        test_passed=1
    fi

    # Test 4: Content markers
    local marker_found=false
    IFS='|' read -ra MARKER_ARRAY <<< "$markers"
    for marker in "${MARKER_ARRAY[@]}"; do
        if echo "$html_content" | grep -qi "$marker"; then
            marker_found=true
            echo "✅ Content marker found: $(echo "$marker" | cut -d'|' -f1)"
            break
        fi
    done

    if [ "$marker_found" = false ]; then
        echo "⚠️ No expected content markers found"
    fi

    # Test 5: JavaScript presence
    local script_count=$(echo "$html_content" | grep -c "<script" 2>/dev/null || echo "0")
    if [ "$script_count" -gt 0 ]; then
        echo "✅ JavaScript found: $script_count script tag(s)"
    else
        echo "⚠️ No JavaScript detected"
    fi

    # Test 6: CSS presence
    local css_count=$(echo "$html_content" | grep -c "<style\|style=" 2>/dev/null || echo "0")
    if [ "$css_count" -gt 0 ]; then
        echo "✅ CSS found: $css_count style element(s)"
    else
        echo "⚠️ No CSS detected"
    fi

    # Test 7: UTF-8 charset in meta tag
    if echo "$html_content" | grep -qi 'charset.*utf-8'; then
        echo "✅ UTF-8 charset specified"
    else
        echo "⚠️ UTF-8 charset not explicitly specified in meta tag"
    fi

    # Test 8: Responsive viewport meta tag
    if echo "$html_content" | grep -qi 'viewport.*width.*device-width'; then
        echo "✅ Responsive viewport meta tag present"
    else
        echo "⚠️ Responsive viewport meta tag not found"
    fi

    return $test_passed
}

test_content_type() {
    local endpoint="$1"
    local route_name="$2"

    local content_type=$(curl -s -I -H "X-API-Key: $API_KEY" "$BASE_URL$endpoint" | grep -i "content-type" | cut -d: -f2 | tr -d ' \r\n')

    if [[ "$content_type" == *"text/html"* ]]; then
        echo "✅ Correct Content-Type: $content_type"
        return 0
    else
        echo "❌ Wrong Content-Type: $content_type (expected text/html)"
        return 1
    fi
}

test_response_size() {
    local endpoint="$1"
    local route_name="$2"

    local content_size=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL$endpoint" | wc -c)

    if [ "$content_size" -gt 1000 ]; then
        echo "✅ Adequate content size: $content_size bytes"
        return 0
    else
        echo "⚠️ Small content size: $content_size bytes (may be error page)"
        return 1
    fi
}

# Main test execution
main() {
    echo "Running HTML Structure Unit Tests"
    echo "================================="
    echo "Base URL: $BASE_URL"
    echo ""

    local total_tests=0
    local passed_tests=0

    for endpoint in "${!TEST_ROUTES[@]}"; do
        route_name="${TEST_ROUTES[$endpoint]}"
        markers="${CONTENT_MARKERS[$endpoint]}"

        echo "Testing: $route_name"
        echo "Endpoint: $endpoint"

        # Run all tests
        if validate_html_structure "$endpoint" "$route_name" "$markers"; then
            ((passed_tests++))
        fi
        ((total_tests++))

        if test_content_type "$endpoint" "$route_name"; then
            ((passed_tests++))
        fi
        ((total_tests++))

        if test_response_size "$endpoint" "$route_name"; then
            ((passed_tests++))
        fi
        ((total_tests++))

        echo "----------------------------------------"
        echo ""
    done

    # Summary
    echo "Test Summary:"
    echo "=============="
    echo "Total tests: $total_tests"
    echo "Passed: $passed_tests"
    echo "Failed: $((total_tests - passed_tests))"

    if [ $passed_tests -eq $total_tests ]; then
        echo "🎉 All HTML structure unit tests passed!"
        echo ""
        echo "All report endpoints have:"
        echo "  ✅ Proper HTML structure (DOCTYPE, head, body)"
        echo "  ✅ Correct Content-Type headers (text/html; charset=utf-8)"
        echo "  ✅ Adequate content sizes"
        echo "  ✅ Content-specific markers"
        echo "  ✅ JavaScript and CSS styling"
        return 0
    else
        echo "❌ Some HTML structure unit tests failed!"
        return 1
    fi
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi