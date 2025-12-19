#!/bin/bash

# Test script to verify reports menu items return HTML pages (not JSON)
# Tests that frontend report endpoints serve proper HTML pages for browser display

set -e

API_KEY="${X_API_KEY:-test}"
BASE_URL="https://tft-trading-system.yanggf.workers.dev"

echo "🌐 Reports HTML Verification Test"
echo "================================="
echo "Base URL: $BASE_URL"
echo "API Key: ${API_KEY:0:3}..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local endpoint="$1"
    local description="$2"

    echo "Testing $description..."
    echo "  Endpoint: $endpoint"

    # Make request
    response=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL$endpoint")
    http_code=$(curl -s -w "%{http_code}" -o /dev/null -H "X-API-Key: $API_KEY" "$BASE_URL$endpoint")

    echo "  HTTP Status: $http_code"

    if [ "$http_code" -eq 200 ]; then
        # Check if response is HTML (what we want)
        if echo "$response" | grep -q "<!DOCTYPE html>\|<html"; then
            echo -e "  ${GREEN}✅ HTML response (correct)${NC}"

            # Extract key HTML information
            title=$(echo "$response" | grep -o '<title[^>]*>[^<]*</title>' | sed 's/<title[^>]*>//;s/<\/title>//' 2>/dev/null || echo "No title")
            echo "  📄 Title: $title"

            # Check for common HTML structure elements
            if echo "$response" | grep -q "<head>"; then
                echo "  ✅ Has <head> section"
            fi

            if echo "$response" | grep -q "<body>"; then
                echo "  ✅ Has <body> section"
            fi

            # Check for JavaScript content
            if echo "$response" | grep -q "<script"; then
                script_count=$(echo "$response" | grep -c "<script" || echo "0")
                echo "  📜 JavaScript scripts: $script_count"
            fi

            # Check for CSS styling
            if echo "$response" | grep -q "style.*{" || echo "$response" | grep -q "<style"; then
                echo "  🎨 CSS styling present"
            fi

            # Report specific content validation
            if echo "$endpoint" | grep -q "pre-market"; then
                if echo "$response" | grep -qi "pre.*market\|morning\|briefing"; then
                    echo "  📈 Pre-market content detected"
                fi
            elif echo "$endpoint" | grep -q "intraday"; then
                if echo "$response" | grep -qi "intraday\|real.*time\|session"; then
                    echo "  ⏰ Intraday content detected"
                fi
            elif echo "$endpoint" | grep -q "end-of-day"; then
                if echo "$response" | grep -qi "end.*day\|close\|summary"; then
                    echo "  🕐 End-of-day content detected"
                fi
            elif echo "$endpoint" | grep -q "weekly"; then
                if echo "$response" | grep -qi "weekly\|week.*review\|analysis"; then
                    echo "  📅 Weekly content detected"
                fi
            elif echo "$endpoint" | grep -q "daily-summary"; then
                if echo "$response" | grep -qi "daily.*summary\|today\|overview"; then
                    echo "  📊 Daily summary content detected"
                fi
            fi

        else
            # Check if it's JSON (what we don't want for frontend pages)
            if echo "$response" | jq empty 2>/dev/null; then
                echo -e "  ${RED}❌ JSON response (should be HTML for frontend)${NC}"
                echo "  🚨 This endpoint should return HTML pages!"
                return 1
            else
                echo -e "  ${YELLOW}⚠️ Neither HTML nor JSON response${NC}"
                echo "  Response preview: ${response:0:200}..."
                return 1
            fi
        fi
    else
        echo -e "  ${RED}❌ HTTP Error: $http_code${NC}"
        return 1
    fi

    echo ""
}

# Test all frontend report endpoints
echo "🌐 Testing Frontend Report Endpoints (should return HTML):"
echo "=========================================================="

test_endpoint "/pre-market-briefing" "Pre-Market Briefing HTML Page"
test_endpoint "/intraday-check" "Intraday Check HTML Page"
test_endpoint "/end-of-day-summary" "End-of-Day Summary HTML Page"
test_endpoint "/weekly-review" "Weekly Review HTML Page"
test_endpoint "/daily-summary" "Daily Summary HTML Page"

# Additional endpoint tests
echo ""
echo "📊 Testing Additional Report Endpoints:"
echo "====================================="

test_endpoint "/weekly-analysis" "Weekly Analysis HTML Page"
test_endpoint "/" "Root Dashboard HTML Page"

# Test error handling and graceful degradation
echo ""
echo "🛡️ Testing Error Handling and Graceful Degradation:"
echo "================================================="

test_endpoint "/pre-market-briefing?error=test" "Error State Handling"
test_endpoint "/intraday-check?missing=true" "Empty State Handling"

# Test content-type headers
echo ""
echo "🔍 Testing Content-Type Headers:"
echo "================================"

check_content_type() {
    local endpoint="$1"
    local description="$2"
    local expected_content_type="$3"

    echo "Testing $description..."
    content_type=$(curl -s -I -H "X-API-Key: $API_KEY" "$BASE_URL$endpoint" | grep -i "content-type" | cut -d: -f2 | tr -d ' \r\n')

    if [[ "$content_type" == *"$expected_content_type"* ]]; then
        echo "  ✅ Content-Type: $content_type"
    else
        echo "  ❌ Wrong Content-Type: $content_type (expected: $expected_content_type)"
    fi
    echo ""
}

check_content_type "/pre-market-briefing" "Pre-Market Content-Type" "text/html"
check_content_type "/intraday-check" "Intraday Content-Type" "text/html"
check_content_type "/api/v1/guards/status" "API v1 Content-Type" "application/json"

# Test response times
echo ""
echo "⏱️ Testing Response Times:"
echo "========================="

measure_response_time() {
    local endpoint="$1"
    local description="$2"
    local max_acceptable="$3"

    echo "Testing $description..."

    start_time=$(date +%s%N)
    http_code=$(curl -s -w "%{http_code}" -o /dev/null -H "X-API-Key: $API_KEY" "$BASE_URL$endpoint")
    end_time=$(date +%s%N)

    response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

    echo "  Response Time: ${response_time}ms"

    if [ "$http_code" -eq 200 ]; then
        if [ "$response_time" -le "$max_acceptable" ]; then
            echo "  ✅ Performance acceptable (<${max_acceptable}ms)"
        else
            echo "  ⚠️ Slow response (>${max_acceptable}ms)"
        fi
    else
        echo "  ❌ HTTP Error: $http_code"
    fi
    echo ""
}

measure_response_time "/weekly-analysis" "Weekly Analysis Performance" 5000
measure_response_time "/" "Dashboard Performance" 3000
measure_response_time "/api/v1/guards/health" "API Health Performance" 1000

# Test authentication behavior
echo ""
echo "🔐 Testing Authentication:"
echo "========================="

echo "Testing without API key..."
unauth_status=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/pre-market-briefing")
if [ "$unauth_status" -eq 401 ] || [ "$unauth_status" -eq 403 ]; then
    echo "  ✅ Properly rejects unauthenticated requests ($unauth_status)"
else
    echo "  ⚠️ May allow unauthenticated requests ($unauth_status)"
fi

# Test request ID headers
echo ""
echo "🆔 Testing Request ID Headers:"
echo "============================"

test_request_id() {
    local endpoint="$1"
    local description="$2"

    request_id=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL$endpoint" | jq -r '.requestId // .headers."X-Request-ID" // .request_id // "none"' 2>/dev/null || echo "parse_error")

    if [[ "$request_id" != "none" && "$request_id" != "parse_error" && ${#request_id} -gt 10 ]]; then
        echo "  ✅ $description - Request ID: ${request_id:0:8}..."
    else
        echo "  ⚠️ $description - Request ID missing or invalid"
    fi
}

test_request_id "/pre-market-briefing" "Pre-Market Request ID"
test_request_id "/api/v1/guards/status" "API Status Request ID"

# Test HTML structure validation
echo ""
echo "🏗️ Testing HTML Structure:"
echo "========================"

validate_html_structure() {
    local endpoint="$1"
    local description="$2"

    html_content=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL$endpoint")

    if echo "$html_content" | grep -q "<!DOCTYPE html>"; then
        echo "  ✅ $description - Has DOCTYPE"
    else
        echo "  ❌ $description - Missing DOCTYPE"
    fi

    if echo "$html_content" | grep -q "<title>"; then
        echo "  ✅ $description - Has title tag"
    else
        echo "  ❌ $description - Missing title tag"
    fi

    if echo "$html_content" | grep -q "<script"; then
        script_count=$(echo "$html_content" | grep -c "<script")
        echo "  ✅ $description - Has $script_count script tags"
    else
        echo "  ⚠️ $description - No JavaScript detected"
    fi
}

validate_html_structure "/weekly-analysis" "Weekly Analysis HTML"
validate_html_structure "/" "Dashboard HTML"

echo "✅ Reports HTML Verification Complete"
echo ""
echo "📋 Summary:"
echo "  • All frontend report endpoints should return HTML pages"
echo "  • Pages should include proper HTML structure (head, body, title)"
echo "  • JavaScript and CSS should be embedded for interactive features"
echo "  • Content should be specific to each report type"
echo "  • Pages should be suitable for browser display"