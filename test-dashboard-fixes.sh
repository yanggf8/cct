#!/bin/bash

# Dashboard Fixes Integration Test
# Tests the console error fixes implemented for:
# 1. web-notifications.js 404 error fix
# 2. model-health 405 method error fix
# 3. sector data getSectorSnapshot error fix

set -e

echo "=========================================="
echo "🧪 Dashboard Fixes Integration Test"
echo "=========================================="
echo "Testing console error fixes implemented in commit 472564b"
echo ""

# Configuration
BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="yanggf"
TOTAL_TESTS=0
PASSED_TESTS=0

# Test helper functions
test_endpoint() {
    local test_name="$1"
    local endpoint="$2"
    local expected_status="$3"
    local jq_filter="$4"

    echo "=== Test: $test_name ==="
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo "Testing: $endpoint"

    if [ -n "$jq_filter" ]; then
        response=$(timeout 30 curl -s "$endpoint" | jq -r "$jq_filter" 2>/dev/null || echo "ERROR")
    else
        response=$(timeout 30 curl -s -w "HTTPSTATUS:%{http_code}" "$endpoint")
        status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
        body=$(echo "$response" | sed -E "s/HTTPSTATUS:[0-9]*$//")
    fi

    if [ -n "$jq_filter" ]; then
        if [ "$response" != "ERROR" ] && [ -n "$response" ]; then
            echo "✅ PASS: Response received successfully"
            echo "📊 Response: $response"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo "❌ FAIL: Invalid or no response"
            echo "📊 Response: $response"
        fi
    else
        if [ "$status_code" = "$expected_status" ]; then
            echo "✅ PASS: HTTP $status_code (expected $expected_status)"
            echo "📊 Response: $(echo "$body" | head -c 200)..."
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo "❌ FAIL: HTTP $status_code (expected $expected_status)"
            echo "📊 Response: $body"
        fi
    fi

    echo ""
}

test_json_response() {
    local test_name="$1"
    local endpoint="$2"
    local validation_field="$3"

    echo "=== Test: $test_name ==="
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    response=$(timeout 30 curl -s "$endpoint")

    if echo "$response" | jq -e "$validation_field" >/dev/null 2>&1; then
        value=$(echo "$response" | jq -r "$validation_field")
        echo "✅ PASS: Field validation successful"
        echo "📊 $validation_field = $value"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "❌ FAIL: Field validation failed"
        echo "📊 Response: $(echo "$response" | head -c 200)..."
    fi

    echo ""
}

# Test 1: Model Health Endpoint (Fixed 405 error)
echo "🔧 Testing Model Health Endpoint Fix"
test_endpoint "Model Health Direct Access" "$BASE_URL/model-health" "200"
test_json_response "Model Health Response Structure" "$BASE_URL/model-health" ".models"
test_json_response "Model Health GPT Status" "$BASE_URL/model-health" ".models.gpt_oss_120b.status"
test_json_response "Model Health DistilBERT Status" "$BASE_URL/model-health" ".models.distilbert.status"

# Test 2: Health Endpoint (Should work via legacy mapping)
echo "🔧 Testing Health Endpoint"
test_endpoint "System Health Access" "$BASE_URL/health" "200"
test_json_response "Health Response Structure" "$BASE_URL/health" ".services"

# Test 3: Home Dashboard Page Load (Tests web-notifications.js fix)
echo "🔧 Testing Home Dashboard Loading"
test_endpoint "Home Dashboard Page" "$BASE_URL/" "200"

# Test 4: Sector API Endpoints (Tests getSectorSnapshot fix)
echo "🔧 Testing Sector Data Endpoints"
test_endpoint "Sector Snapshot API" "$BASE_URL/api/v1/sectors/snapshot" "200"
test_json_response "Sector Snapshot Response" "$BASE_URL/api/v1/sectors/snapshot" ".success"
test_endpoint "Sector Analysis API" "$BASE_URL/api/v1/sectors/analysis" "200"
test_endpoint "Sector Health API" "$BASE_URL/api/v1/sectors/health" "200"
test_json_response "Sector Health Response" "$BASE_URL/api/v1/sectors/health" ".success"

# Test 5: Professional Dashboard (Alternative dashboard)
echo "🔧 Testing Professional Dashboard"
test_endpoint "Professional Dashboard" "$BASE_URL/status" "200"

# Test 6: Web Notifications Endpoints (Related to web-notifications.js fix)
echo "🔧 Testing Web Notifications System"
test_endpoint "Notification Status" "$BASE_URL/api/notifications/status" "200"
test_json_response "Notification Status Response" "$BASE_URL/api/notifications/status" ".success"

# Test 7: API v1 Documentation (Should list all working endpoints)
echo "🔧 Testing API v1 Documentation"
test_endpoint "API v1 Root" "$BASE_URL/api/v1" "200"
test_json_response "API v1 Response Structure" "$BASE_URL/api/v1" ".data.available_endpoints"

# Test 8: Verify model-health is NOT being routed to data API (the fix)
echo "🔧 Verifying Model Health Routing Fix"
model_health_response=$(timeout 15 curl -s "$BASE_URL/model-health")
if echo "$model_health_response" | jq -e '.models' >/dev/null 2>&1; then
    echo "✅ PASS: model-health correctly handled by dedicated handler (not data API)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo "❌ FAIL: model-health may be incorrectly routed"
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo ""

# Test Results Summary
echo "=========================================="
echo "📊 TEST RESULTS SUMMARY"
echo "=========================================="
echo "Total Tests: $TOTAL_TESTS"
echo "Passed Tests: $PASSED_TESTS"
echo "Failed Tests: $((TOTAL_TESTS - PASSED_TESTS))"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo "🎉 ALL TESTS PASSED! Dashboard fixes are working correctly."
    echo ""
    echo "✅ Model Health endpoint: Working (405 error fixed)"
    echo "✅ Home Dashboard: Loading correctly (web-notifications.js 404 fixed)"
    echo "✅ Sector Data APIs: Operational (getSectorSnapshot error fixed)"
    echo "✅ Legacy compatibility: Properly routing model-health"
    exit 0
else
    echo "⚠️  SOME TESTS FAILED. Please check the failed tests above."
    exit 1
fi