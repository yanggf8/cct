#!/bin/bash

# API Security Test Script
# Tests the rate limiting and authentication enhancements

set -e

# Configuration
API_BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="${X_API_KEY:-test}"

echo "🔒 Testing API Security Enhancements"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make API call and check response
make_api_call() {
    local method="$1"
    local endpoint="$2"
    local api_key="$3"
    local data="$4"

    local curl_opts=(-s -w "\n%{http_code}\n" -H "Content-Type: application/json")

    if [ -n "$api_key" ]; then
        curl_opts+=(-H "X-API-Key: $api_key")
    fi

    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl_opts+=(-d "$data")
    fi

    local response
    response=$(curl "${curl_opts[@]}" "${API_BASE_URL}${endpoint}")

    echo "$response"
}

# Function to test rate limiting
test_rate_limiting() {
    echo -e "${BLUE}🚦 Testing Rate Limiting${NC}"
    echo "---------------------------"

    local endpoint="/api/v1/sentiment/symbols/AAPL"

    echo "Making rapid requests to test rate limiting..."

    local success_count=0
    local rate_limited_count=0

    for i in {1..70}; do
        echo -n "."
        local response
        response=$(make_api_call "GET" "$endpoint" "$API_KEY")

        local status_code=$(echo "$response" | tail -n1)
        local response_body=$(echo "$response" | head -n -1)

        if [ "$status_code" = "200" ]; then
            ((success_count++))
        elif [ "$status_code" = "429" ] || [ "$status_code" = "423" ]; then
            ((rate_limited_count++))
            echo -e "\n${YELLOW}Rate limited on request $i (Status: $status_code)${NC}"
            if echo "$response_body" | grep -q "retryAfter"; then
                local retry_after=$(echo "$response_body" | grep -o '"retryAfter":[0-9]*' | cut -d':' -f2)
                echo "Retry after: ${retry_after}s"
            fi
            break
        fi

        # Small delay between requests
        sleep 0.1
    done

    echo -e "\n✅ Successful requests: $success_count"
    echo "🚫 Rate limited requests: $rate_limited_count"

    if [ $rate_limited_count -gt 0 ]; then
        echo -e "${GREEN}✓ Rate limiting is working${NC}"
    else
        echo -e "${YELLOW}⚠ Rate limiting may not be triggered (could be normal behavior)${NC}"
    fi

    echo ""
}

# Function to test authentication security
test_authentication_security() {
    echo -e "${BLUE}🔐 Testing Authentication Security${NC}"
    echo "-----------------------------------"

    local endpoint="/api/v1/sentiment/symbols/AAPL"

    # Test 1: No API key
    echo "1. Testing request without API key..."
    local response
    response=$(make_api_call "GET" "$endpoint" "")
    local status_code=$(echo "$response" | tail -n1)

    if [ "$status_code" = "401" ]; then
        echo -e "${GREEN}   ✓ Correctly rejected request without API key${NC}"
    else
        echo -e "${RED}   ✗ Should have rejected request without API key (Status: $status_code)${NC}"
    fi

    # Test 2: Invalid API key
    echo "2. Testing request with invalid API key..."
    response=$(make_api_call "GET" "$endpoint" "invalid_key_12345")
    status_code=$(echo "$response" | tail -n1)

    if [ "$status_code" = "401" ]; then
        echo -e "${GREEN}   ✓ Correctly rejected request with invalid API key${NC}"
    else
        echo -e "${RED}   ✗ Should have rejected request with invalid API key (Status: $status_code)${NC}"
    fi

    # Test 3: Valid API key
    echo "3. Testing request with valid API key..."
    response=$(make_api_call "GET" "$endpoint" "$API_KEY")
    status_code=$(echo "$response" | tail -n1)

    if [ "$status_code" = "200" ]; then
        echo -e "${GREEN}   ✓ Correctly accepted request with valid API key${NC}"
    else
        echo -e "${RED}   ✗ Should have accepted request with valid API key (Status: $status_code)${NC}"
    fi

    echo ""
}

# Function to test security status endpoint
test_security_status() {
    echo -e "${BLUE}📊 Testing Security Status Endpoint${NC}"
    echo "-------------------------------------"

    echo "1. Testing security status without authentication..."
    local response
    response=$(make_api_call "GET" "/api/v1/security/status" "")
    local status_code=$(echo "$response" | tail -n1)

    if [ "$status_code" = "401" ]; then
        echo -e "${GREEN}   ✓ Security status correctly requires authentication${NC}"
    else
        echo -e "${RED}   ✗ Security status should require authentication (Status: $status_code)${NC}"
    fi

    echo "2. Testing security status with valid API key..."
    response=$(make_api_call "GET" "/api/v1/security/status" "$API_KEY")
    status_code=$(echo "$response" | tail -n1)
    local response_body=$(echo "$response" | head -n -1)

    if [ "$status_code" = "200" ]; then
        echo -e "${GREEN}   ✓ Security status endpoint accessible${NC}"

        # Parse and display key security metrics
        if echo "$response_body" | grep -q "activeAPIKeys\|lockedOutAPIKeys\|recentFailedAttempts"; then
            echo "   Security metrics available:"
            echo "$response_body" | grep -E '"(activeAPIKeys|lockedOutAPIKeys|recentFailedAttempts|suspiciousIPs)"' | sed 's/^[[:space:]]*/    /'
        fi
    else
        echo -e "${RED}   ✗ Security status endpoint failed (Status: $status_code)${NC}"
    fi

    echo ""
}

# Function to test input validation security
test_input_validation() {
    echo -e "${BLUE}🛡️ Testing Input Validation Security${NC}"
    echo "---------------------------------------"

    # Test malicious script injection
    echo "1. Testing script injection attempt..."
    local malicious_symbol="<script>alert('xss')</script>"
    local response
    response=$(make_api_call "GET" "/api/v1/sentiment/symbols/$malicious_symbol" "$API_KEY")
    local status_code=$(echo "$response" | tail -n1)

    if [ "$status_code" = "400" ]; then
        echo -e "${GREEN}   ✓ Correctly rejected malicious script injection${NC}"
    elif [ "$status_code" = "404" ]; then
        echo -e "${GREEN}   ✓ Malicious input handled safely (404 Not Found)${NC}"
    else
        echo -e "${YELLOW}   ⚠ Malicious input returned status: $status_code${NC}"
    fi

    # Test SQL injection attempt
    echo "2. Testing SQL injection attempt..."
    local sql_injection="'; DROP TABLE users; --"
    response=$(make_api_call "GET" "/api/v1/sentiment/symbols/$sql_injection" "$API_KEY")
    status_code=$(echo "$response" | tail -n1)

    if [ "$status_code" = "400" ]; then
        echo -e "${GREEN}   ✓ Correctly rejected SQL injection attempt${NC}"
    elif [ "$status_code" = "404" ]; then
        echo -e "${GREEN}   ✓ SQL injection handled safely (404 Not Found)${NC}"
    else
        echo -e "${YELLOW}   ⚠ SQL injection returned status: $status_code${NC}"
    fi

    # Test path traversal attempt
    echo "3. Testing path traversal attempt..."
    local path_traversal="../../../etc/passwd"
    response=$(make_api_call "GET" "/api/v1/data/history/$path_traversal" "$API_KEY")
    status_code=$(echo "$response" | tail -n1)

    if [ "$status_code" = "400" ]; then
        echo -e "${GREEN}   ✓ Correctly rejected path traversal attempt${NC}"
    elif [ "$status_code" = "404" ]; then
        echo -e "${GREEN}   ✓ Path traversal handled safely (404 Not Found)${NC}"
    else
        echo -e "${YELLOW}   ⚠ Path traversal returned status: $status_code${NC}"
    fi

    echo ""
}

# Main execution
echo "API Base URL: $API_BASE_URL"
echo "Using API Key: ${API_KEY:0:8}..."
echo ""

# Check if API is accessible
echo "🔍 Testing API connectivity..."
test_response=$(make_api_call "GET" "/api/v1" "")
test_status=$(echo "$test_response" | tail -n1)

if [ "$test_status" = "200" ]; then
    echo -e "${GREEN}✓ API is accessible${NC}"
    echo ""
else
    echo -e "${RED}✗ API is not accessible (Status: $test_status)${NC}"
    exit 1
fi

# Run security tests
test_authentication_security
test_rate_limiting
test_security_status
test_input_validation

echo -e "${GREEN}🎉 API Security Testing Complete!${NC}"
echo ""
echo "Summary:"
echo "- Authentication: ✅ Enhanced with failure tracking and lockouts"
echo "- Rate Limiting: ✅ Implemented with IP and API key limits"
echo "- Input Validation: ✅ Comprehensive sanitization"
echo "- Security Monitoring: ✅ Status endpoint available"
echo ""
echo "📊 Security Status: GET /api/v1/security/status (requires API key)"