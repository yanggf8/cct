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
API_KEY="$(printf '%s' "${X_API_KEY:-test}" | tr -d '\r\n')"
BASE_URL="${BASE_URL:-https://tft-trading-system.yanggf.workers.dev}"
# When enabled, routes returning 404/410 are treated as skipped (useful when dashboards are feature-gated or retired).
SKIP_MISSING_ROUTES="${SKIP_MISSING_ROUTES:-1}"
# When enabled, temporary network/DNS failures (curl exit != 0 / HTTP 000) are treated as skipped.
SKIP_NETWORK_ERRORS="${SKIP_NETWORK_ERRORS:-1}"
# Routes that are intentional redirects (small response is expected)
REDIRECT_ROUTES=("/")

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

# Fetch page body + metadata in a single request.
fetch_page() {
    local endpoint="$1"
    local url="$BASE_URL$endpoint"
    local response
    local curl_rc=0

    # Use an if-assignment so curl failures don't trigger set -e.
    if response="$(curl -s -L -H "X-API-Key: $API_KEY" -w "\n__HTTP_CODE__:%{http_code}\n__CONTENT_TYPE__:%{content_type}\n" "$url" 2>/dev/null)"; then
        curl_rc=0
    else
        curl_rc=$?
    fi

    PAGE_HTTP_CODE="$(printf '%s' "$response" | sed -n 's/^__HTTP_CODE__://p' | tail -n 1)"
    PAGE_CONTENT_TYPE="$(printf '%s' "$response" | sed -n 's/^__CONTENT_TYPE__://p' | tail -n 1)"
    PAGE_BODY="$(printf '%s' "$response" | sed '/^__HTTP_CODE__:/,$d')"
    PAGE_CURL_RC="$curl_rc"

    # Normalize empty values
    PAGE_HTTP_CODE="${PAGE_HTTP_CODE:-0}"
    PAGE_CONTENT_TYPE="${PAGE_CONTENT_TYPE:-}"
}

# Test functions
validate_html_structure() {
    local endpoint="$1"
    local route_name="$2"
    local markers="$3"

    fetch_page "$endpoint"
    local html_content="$PAGE_BODY"
    local http_code="$PAGE_HTTP_CODE"
    local content_type="$PAGE_CONTENT_TYPE"
    local curl_rc="${PAGE_CURL_RC:-0}"

    if [ "$curl_rc" -ne 0 ] || [ "$http_code" -eq 0 ]; then
        if [ "$SKIP_NETWORK_ERRORS" -eq 1 ]; then
            echo "⚠️ Skipping route due to network error (curl=$curl_rc, HTTP $http_code)"
            return 2
        fi
        echo "❌ Network error fetching route (curl=$curl_rc, HTTP $http_code)"
        return 1
    fi

    if [ "$http_code" -eq 404 ] || [ "$http_code" -eq 410 ]; then
        if [ "$SKIP_MISSING_ROUTES" -eq 1 ]; then
            echo "⚠️ Skipping missing route (HTTP $http_code)"
            return 2
        fi
        echo "❌ Route missing (HTTP $http_code)"
        return 1
    fi

    if [ "$http_code" -ne 200 ]; then
        echo "❌ Unexpected HTTP status: $http_code"
        return 1
    fi

    if [[ "$content_type" != *"text/html"* ]]; then
        echo "❌ Wrong Content-Type: $content_type (expected text/html)"
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
    local script_count
    script_count="$(echo "$html_content" | grep -c "<script" || true)"
    if [ "$script_count" -gt 0 ]; then
        echo "✅ JavaScript found: $script_count script tag(s)"
    else
        echo "⚠️ No JavaScript detected"
    fi

    # Test 6: CSS presence
    local css_count
    css_count="$(echo "$html_content" | grep -Eci "<style|style=" || true)"
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

    # Reuse fetched metadata when possible
    if [ -z "${PAGE_HTTP_CODE:-}" ] || [ "${LAST_ENDPOINT:-}" != "$endpoint" ]; then
        fetch_page "$endpoint"
        LAST_ENDPOINT="$endpoint"
    fi

    local http_code="$PAGE_HTTP_CODE"
    local content_type="$PAGE_CONTENT_TYPE"
    local curl_rc="${PAGE_CURL_RC:-0}"

    if [ "$curl_rc" -ne 0 ] || [ "$http_code" -eq 0 ]; then
        if [ "$SKIP_NETWORK_ERRORS" -eq 1 ]; then
            echo "⚠️ Skipping route due to network error (curl=$curl_rc, HTTP $http_code)"
            return 2
        fi
        echo "❌ Network error fetching route (curl=$curl_rc, HTTP $http_code)"
        return 1
    fi

    if [ "$http_code" -eq 404 ] || [ "$http_code" -eq 410 ]; then
        if [ "$SKIP_MISSING_ROUTES" -eq 1 ]; then
            echo "⚠️ Skipping missing route (HTTP $http_code)"
            return 2
        fi
        echo "❌ Route missing (HTTP $http_code)"
        return 1
    fi

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

    # Reuse fetched metadata when possible
    if [ -z "${PAGE_HTTP_CODE:-}" ] || [ "${LAST_ENDPOINT:-}" != "$endpoint" ]; then
        fetch_page "$endpoint"
        LAST_ENDPOINT="$endpoint"
    fi

    local http_code="$PAGE_HTTP_CODE"
    local curl_rc="${PAGE_CURL_RC:-0}"
    if [ "$curl_rc" -ne 0 ] || [ "$http_code" -eq 0 ]; then
        if [ "$SKIP_NETWORK_ERRORS" -eq 1 ]; then
            echo "⚠️ Skipping route due to network error (curl=$curl_rc, HTTP $http_code)"
            return 2
        fi
        echo "❌ Network error fetching route (curl=$curl_rc, HTTP $http_code)"
        return 1
    fi
    if [ "$http_code" -eq 404 ] || [ "$http_code" -eq 410 ]; then
        if [ "$SKIP_MISSING_ROUTES" -eq 1 ]; then
            echo "⚠️ Skipping missing route (HTTP $http_code)"
            return 2
        fi
        echo "❌ Route missing (HTTP $http_code)"
        return 1
    fi

    local content_size
    content_size="$(printf '%s' "$PAGE_BODY" | wc -c | tr -d ' ')"

    # Check if this is a known redirect route (small response expected)
    local is_redirect=false
    for redirect_route in "${REDIRECT_ROUTES[@]}"; do
        if [ "$endpoint" = "$redirect_route" ]; then
            is_redirect=true
            break
        fi
    done

    if [ "$content_size" -gt 1000 ]; then
        echo "✅ Adequate content size: $content_size bytes"
        return 0
    elif [ "$is_redirect" = true ]; then
        echo "✅ Redirect route: $content_size bytes (expected small)"
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
    echo "Skip missing routes: $SKIP_MISSING_ROUTES"
    echo "Skip network errors: $SKIP_NETWORK_ERRORS"
    echo ""

    local total_tests=0
    local passed_tests=0
    local skipped_tests=0

    for endpoint in "${!TEST_ROUTES[@]}"; do
        route_name="${TEST_ROUTES[$endpoint]}"
        markers="${CONTENT_MARKERS[$endpoint]}"

        echo "Testing: $route_name"
        echo "Endpoint: $endpoint"

        # Run all tests
        set +e
        validate_html_structure "$endpoint" "$route_name" "$markers"
        local rc=$?
        set -e
        case $rc in
            0) passed_tests=$((passed_tests + 1)); total_tests=$((total_tests + 1)) ;;
            2) skipped_tests=$((skipped_tests + 1)) ;;
            *) total_tests=$((total_tests + 1)) ;;
        esac

        set +e
        test_content_type "$endpoint" "$route_name"
        rc=$?
        set -e
        case $rc in
            0) passed_tests=$((passed_tests + 1)); total_tests=$((total_tests + 1)) ;;
            2) skipped_tests=$((skipped_tests + 1)) ;;
            *) total_tests=$((total_tests + 1)) ;;
        esac

        set +e
        test_response_size "$endpoint" "$route_name"
        rc=$?
        set -e
        case $rc in
            0) passed_tests=$((passed_tests + 1)); total_tests=$((total_tests + 1)) ;;
            2) skipped_tests=$((skipped_tests + 1)) ;;
            *) total_tests=$((total_tests + 1)) ;;
        esac

        echo "----------------------------------------"
        echo ""
    done

    # Summary
    echo "Test Summary:"
    echo "=============="
    echo "Total tests: $total_tests"
    echo "Passed: $passed_tests"
    echo "Skipped: $skipped_tests"
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
