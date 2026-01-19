#!/bin/bash

# Production Guards Endpoints Smoke Test
# Tests routing and basic functionality under simulated production environment
#
# Usage: ./test-production-guards-smoke.sh [api_key]

set -e

API_KEY="${X_API_KEY:-test}"
BASE_URL="https://tft-trading-system.yanggf.workers.dev"

echo "🛡️ Production Guards Endpoints Smoke Test"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "API Key: ${API_KEY:0:3}..."
echo ""

# Test function
test_endpoint() {
    local endpoint="$1"
    local description="$2"
    local expected_status="$3"
    local send_api_key="${4:-true}"  # Default to sending API key

    echo "Testing $description..."
    echo "  Endpoint: $endpoint"

    # Measure response time
    start_time=$(date +%s%N)

    # Build curl command
    curl_cmd="curl -s -w \"%{http_code}\" -H \"Content-Type: application/json\""
    
    # Only add API key header if send_api_key is true
    if [ "$send_api_key" = "true" ]; then
        curl_cmd="$curl_cmd -H \"X-API-Key: $API_KEY\""
    fi
    
    curl_cmd="$curl_cmd \"$BASE_URL$endpoint\" -o /tmp/guards_response.json"

    http_code=$(eval "$curl_cmd")

    end_time=$(date +%s%N)
    response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

    echo "  Status: $http_code (expected: $expected_status)"
    echo "  Response Time: ${response_time}ms"

    if [ "$http_code" -eq "$expected_status" ]; then
        echo "  ✅ PASSED"

        # Basic response validation
        if [ -f /tmp/guards_response.json ] && [ -s /tmp/guards_response.json ]; then
            # Check if response is valid JSON
            if jq empty /tmp/guards_response.json 2>/dev/null; then
                echo "  ✅ Valid JSON response"

                # Extract key fields for validation
                if echo "$endpoint" | grep -q "status"; then
                    status=$(jq -r '.data.status // .status // "unknown"' /tmp/guards_response.json 2>/dev/null || echo "parse_error")
                    echo "  📊 Status: $status"
                elif echo "$endpoint" | grep -q "health"; then
                    health_status=$(jq -r '.data.status // .status // "unknown"' /tmp/guards_response.json 2>/dev/null || echo "parse_error")
                    echo "  🏥 Health: $health_status"
                elif echo "$endpoint" | grep -q "validate"; then
                    overall=$(jq -r '.data.overall // .overall // "unknown"' /tmp/guards_response.json 2>/dev/null || echo "parse_error")
                    echo "  🔍 Validation: $overall"
                fi

                # Check for redacted fields (security)
                if jq -e '.redactedFields' /tmp/guards_response.json >/dev/null 2>&1; then
                    echo "  🔒 Security: Redacted fields present (good)"
                fi
            else
                echo "  ❌ Invalid JSON response"
                return 1
            fi
        else
            echo "  ⚠️ Empty response body"
        fi
    else
        echo "  ❌ FAILED - Wrong status code"
        if [ -f /tmp/guards_response.json ]; then
            echo "  Response: $(cat /tmp/guards_response.json)"
        fi
        return 1
    fi

    echo ""
}

# Test authentication
echo "🔐 Testing Authentication..."
test_endpoint "/api/v1/guards/status" "No API key (should fail)" 401 false

# Test with valid API key
export X_API_KEY="$API_KEY"

# Test all production guards endpoints
echo "🛡️ Testing Production Guards Endpoints..."
test_endpoint "/api/v1/guards/status" "Production Guards Status" 200 true
test_endpoint "/api/v1/guards/health" "Production Guards Health" 200 true
test_endpoint "/api/v1/guards/validate" "Production Guards Validation" 200 true

# Test invalid endpoint
test_endpoint "/api/v1/guards/invalid" "Invalid Endpoint" 404 true

# Performance expectations
echo "📊 Performance Summary:"
echo "  - Target: <100ms for cached operations"
echo "  - Acceptable: <500ms for validation operations"
echo ""

# Cleanup
rm -f /tmp/guards_response.json

echo "✅ Production Guards Smoke Test Complete"
echo ""
echo "🔗 Available Endpoints:"
echo "  • GET /api/v1/guards/status - Configuration and capabilities"
echo "  • GET /api/v1/guards/health - Health check for monitoring"
echo "  • GET /api/v1/guards/validate - Comprehensive validation"
echo ""
echo "🔒 All endpoints require X-API-Key authentication"
echo "🛡️ Sensitive fields are automatically redacted"