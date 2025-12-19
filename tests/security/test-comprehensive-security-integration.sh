#!/bin/bash

# Comprehensive Security Integration Test Suite
# Tests all P0/P1 security fixes implemented in the CCT trading system
# Covers authentication, input validation, rate limiting, and security monitoring

set -e

# Configuration
API_BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="${X_API_KEY:-test}"
TEST_TIMEOUT=30

echo "🔒 COMPREHENSIVE SECURITY INTEGRATION TESTS"
echo "=========================================="
echo "Testing all P0/P1 security fixes"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to log test result
log_test() {
    local test_name="$1"
    local status="$2"
    local details="$3"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        [ -n "$details" ] && echo "     $details"
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        [ -n "$details" ] && echo "     $details"
    fi
}

# Function to make API call with timeout
make_api_call() {
    local method="$1"
    local endpoint="$2"
    local api_key="$3"
    local data="$4"
    local expected_status="$5"

    local curl_opts=(-s -w "\n%{http_code}\n" --max-time $TEST_TIMEOUT -H "Content-Type: application/json")

    if [ -n "$api_key" ]; then
        curl_opts+=(-H "X-API-Key: $api_key")
    fi

    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl_opts+=(-d "$data")
    fi

    local response
    response=$(timeout $((TEST_TIMEOUT + 5)) curl "${curl_opts[@]}" "${API_BASE_URL}${endpoint}" 2>/dev/null || echo -e "\n000")

    echo "$response"
}

echo -e "${CYAN}🔍 Test Environment Setup${NC}"
echo "============================="

# Test 1: Environment Validation
echo -e "\n${BLUE}1. Environment Validation${NC}"
echo "---------------------------"

if [ -z "$X_API_KEY" ]; then
    log_test "API Key Environment Variable" "FAIL" "X_API_KEY not set"
    echo -e "${YELLOW}⚠ WARNING: Using test API key - some tests may fail${NC}"
    API_KEY="test_key_for_validation"
else
    log_test "API Key Environment Variable" "PASS" "X_API_KEY is set (length: ${#X_API_KEY})"
fi

# Test 2: API Connectivity
echo -e "\n${BLUE}2. API Connectivity Test${NC}"
echo "----------------------------"

connectivity_response=$(make_api_call "GET" "/api/v1" "" "" "")
connectivity_status=$(echo "$connectivity_response" | tail -n1)

if [ "$connectivity_status" = "200" ]; then
    log_test "API Connectivity" "PASS" "API is responding"
else
    log_test "API Connectivity" "FAIL" "API returned status: $connectivity_status"
    echo -e "${RED}❌ Cannot proceed with tests - API is not accessible${NC}"
    exit 1
fi

echo -e "\n${CYAN}🔐 P0 CRITICAL: Authentication Security Tests${NC}"
echo "============================================"

# Test 3: P0 - No API Key
echo -e "\n${BLUE}3. Authentication: No API Key${NC}"
echo "-----------------------------------"

no_key_response=$(make_api_call "GET" "/api/v1/sentiment/symbols/AAPL" "" "" "")
no_key_status=$(echo "$no_key_response" | tail -n1)

if [ "$no_key_status" = "401" ]; then
    log_test "No API Key Rejection" "PASS" "Correctly returned 401 Unauthorized"
else
    log_test "No API Key Rejection" "FAIL" "Expected 401, got $no_key_status"
fi

# Test 4: P0 - Invalid API Key
echo -e "\n${BLUE}4. Authentication: Invalid API Key${NC}"
echo "-------------------------------------"

invalid_key_response=$(make_api_call "GET" "/api/v1/sentiment/symbols/AAPL" "invalid_key_12345" "" "")
invalid_key_status=$(echo "$invalid_key_response" | tail -n1)

if [ "$invalid_key_status" = "401" ]; then
    log_test "Invalid API Key Rejection" "PASS" "Correctly returned 401 Unauthorized"
else
    log_test "Invalid API Key Rejection" "FAIL" "Expected 401, got $invalid_key_status"
fi

# Test 5: P0 - Valid API Key (if environment key is available)
echo -e "\n${BLUE}5. Authentication: Valid API Key${NC}"
echo "------------------------------------"

if [ "$X_API_KEY" != "test" ]; then
    valid_key_response=$(make_api_call "GET" "/api/v1/sentiment/symbols/AAPL" "$X_API_KEY" "" "")
    valid_key_status=$(echo "$valid_key_response" | tail -n1)

    if [ "$valid_key_status" = "200" ] || [ "$valid_key_status" = "404" ]; then
        log_test "Valid API Key Acceptance" "PASS" "API key accepted (status: $valid_key_status)"
    else
        log_test "Valid API Key Acceptance" "FAIL" "Expected 200/404, got $valid_key_status"
    fi
else
    log_test "Valid API Key Acceptance" "SKIP" "No production API key available for testing"
fi

echo -e "\n${CYAN}🛡️ P1 CRITICAL: Input Validation Tests${NC}"
echo "====================================="

# Test 6: P1 - Script Injection
echo -e "\n${BLUE}6. Input Validation: Script Injection${NC}"
echo "-----------------------------------------"

script_injection="<script>alert('xss')</script>"
script_response=$(make_api_call "GET" "/api/v1/sentiment/symbols/$script_injection" "$API_KEY" "" "")
script_status=$(echo "$script_response" | tail -n1)

if [ "$script_status" = "400" ] || [ "$script_status" = "404" ]; then
    log_test "Script Injection Prevention" "PASS" "Malicious script blocked (status: $script_status)"
else
    log_test "Script Injection Prevention" "FAIL" "Expected 400/404, got $script_status"
fi

# Test 7: P1 - SQL Injection
echo -e "\n${BLUE}7. Input Validation: SQL Injection${NC}"
echo "----------------------------------------"

sql_injection="'; DROP TABLE users; --"
sql_response=$(make_api_call "GET" "/api/v1/sentiment/symbols/$sql_injection" "$API_KEY" "" "")
sql_status=$(echo "$sql_response" | tail -n1)

if [ "$sql_status" = "400" ] || [ "$sql_status" = "404" ]; then
    log_test "SQL Injection Prevention" "PASS" "SQL injection blocked (status: $sql_status)"
else
    log_test "SQL Injection Prevention" "FAIL" "Expected 400/404, got $sql_status"
fi

# Test 8: P1 - Path Traversal
echo -e "\n${BLUE}8. Input Validation: Path Traversal${NC}"
echo "---------------------------------------"

path_traversal="../../../etc/passwd"
path_response=$(make_api_call "GET" "/api/v1/data/history/$path_traversal" "$API_KEY" "" "")
path_status=$(echo "$path_response" | tail -n1)

if [ "$path_status" = "400" ] || [ "$path_status" = "404" ]; then
    log_test "Path Traversal Prevention" "PASS" "Path traversal blocked (status: $path_status)"
else
    log_test "Path Traversal Prevention" "FAIL" "Expected 400/404, got $path_status"
fi

# Test 9: P1 - Invalid Symbol Format
echo -e "\n${BLUE}9. Input Validation: Invalid Symbol${NC}"
echo "--------------------------------------"

invalid_symbol="INVALID123456789"
symbol_response=$(make_api_call "GET" "/api/v1/sentiment/symbols/$invalid_symbol" "$API_KEY" "" "")
symbol_status=$(echo "$symbol_response" | tail -n1)

if [ "$symbol_status" = "400" ]; then
    log_test "Invalid Symbol Validation" "PASS" "Invalid symbol rejected (status: $symbol_status)"
else
    log_test "Invalid Symbol Validation" "FAIL" "Expected 400, got $symbol_status"
fi

# Test 10: P1 - Batch Request Validation
echo -e "\n${BLUE}10. Input Validation: Batch Request${NC}"
echo "----------------------------------------"

malicious_batch='{"symbols": ["<script>", "'; DROP TABLE", "AAPL"]}'
batch_response=$(make_api_call "POST" "/api/v1/technical/analysis" "$API_KEY" "$malicious_batch" "")
batch_status=$(echo "$batch_response" | tail -n1)

if [ "$batch_status" = "400" ]; then
    log_test "Malicious Batch Validation" "PASS" "Malicious batch rejected (status: $batch_status)"
else
    log_test "Malicious Batch Validation" "FAIL" "Expected 400, got $batch_status"
fi

echo -e "\n${CYAN}🚦 P1 CRITICAL: Rate Limiting Tests${NC}"
echo "===================================="

# Test 11: P1 - Rate Limiting
echo -e "\n${BLUE}11. Rate Limiting: API Key Throttling${NC}"
echo "-------------------------------------------"

echo "Testing rate limiting with rapid requests..."
rate_limited=0
success_requests=0

for i in {1..65}; do
    rate_test_response=$(make_api_call "GET" "/api/v1/sentiment/symbols/AAPL" "$API_KEY" "" "")
    rate_test_status=$(echo "$rate_test_response" | tail -n1)

    if [ "$rate_test_status" = "429" ] || [ "$rate_test_status" = "423" ]; then
        rate_limited=1
        break
    elif [ "$rate_test_status" = "200" ] || [ "$rate_test_status" = "404" ]; then
        success_requests=$((success_requests + 1))
    fi

    # Small delay to avoid overwhelming the API
    sleep 0.1
done

if [ $rate_limited -eq 1 ]; then
    log_test "Rate Limiting" "PASS" "Rate limiting triggered after $success_requests requests"
else
    log_test "Rate Limiting" "PARTIAL" "Made $success_requests requests without rate limiting (may be normal)"
fi

echo -e "\n${CYAN}📊 Security Monitoring Tests${NC}"
echo "==============================="

# Test 12: Security Status Endpoint
echo -e "\n${BLUE}12. Security Monitoring: Status Endpoint${NC}"
echo "-----------------------------------------------"

# Test without authentication
status_no_auth_response=$(make_api_call "GET" "/api/v1/security/status" "" "" "")
status_no_auth_status=$(echo "$status_no_auth_response" | tail -n1)

if [ "$status_no_auth_status" = "401" ]; then
    log_test "Security Status Authentication" "PASS" "Security endpoint requires authentication"
else
    log_test "Security Status Authentication" "FAIL" "Expected 401, got $status_no_auth_status"
fi

# Test with authentication
if [ "$X_API_KEY" != "test" ]; then
    status_auth_response=$(make_api_call "GET" "/api/v1/security/status" "$X_API_KEY" "" "")
    status_auth_status=$(echo "$status_auth_response" | tail -n1)
    status_body=$(echo "$status_auth_response" | head -n -1)

    if [ "$status_auth_status" = "200" ]; then
        log_test "Security Status Accessibility" "PASS" "Security endpoint accessible"

        # Check for expected security metrics
        if echo "$status_body" | grep -q "activeAPIKeys\|lockedOutAPIKeys\|recentFailedAttempts"; then
            log_test "Security Status Metrics" "PASS" "Security metrics available"
        else
            log_test "Security Status Metrics" "PARTIAL" "Security metrics may be incomplete"
        fi
    else
        log_test "Security Status Accessibility" "FAIL" "Expected 200, got $status_auth_status"
    fi
else
    log_test "Security Status Accessibility" "SKIP" "No production API key available"
fi

echo -e "\n${CYAN}🔒 Additional Security Tests${NC}"
echo "============================="

# Test 13: CORS Security Headers
echo -e "\n${BLUE}13. CORS Security Headers${NC}"
echo "----------------------------"

cors_response=$(curl -s -I --max-time $TEST_TIMEOUT "$API_BASE_URL/api/v1" 2>/dev/null || echo "")
cors_headers=$(echo "$cors_response" | grep -i "access-control\|content-security-policy\|x-frame-options")

if [ -n "$cors_headers" ]; then
    log_test "CORS Security Headers" "PASS" "Security headers present"
else
    log_test "CORS Security Headers" "PARTIAL" "Consider adding CORS headers"
fi

# Test 14: HTTP Methods Security
echo -e "\n${BLUE}14. HTTP Methods Security${NC}"
echo "------------------------------"

# Test unsupported methods
methods_response=$(curl -s -w "%{http_code}" -X DELETE --max-time $TEST_TIMEOUT "$API_BASE_URL/api/v1/sentiment/symbols/AAPL" 2>/dev/null || echo "000")

if [ "$methods_response" = "405" ] || [ "$methods_response" = "401" ]; then
    log_test "HTTP Method Security" "PASS" "Unsupported methods rejected (status: $methods_response)"
else
    log_test "HTTP Method Security" "PARTIAL" "DELETE method returned: $methods_response"
fi

# Test 15: Large Payload Protection
echo -e "\n${BLUE}15. Large Payload Protection${NC}"
echo "----------------------------------"

large_payload='{"symbols": ['$(for i in {1..1000}; do echo -n '"SYMBOL'$i'",'; done)']}'
large_response=$(make_api_call "POST" "/api/v1/technical/analysis" "$API_KEY" "$large_payload" "")
large_status=$(echo "$large_response" | tail -n1)

if [ "$large_status" = "413" ] || [ "$large_status" = "400" ]; then
    log_test "Large Payload Protection" "PASS" "Large payload rejected (status: $large_status)"
else
    log_test "Large Payload Protection" "PARTIAL" "Large payload returned: $large_status"
fi

echo -e "\n${CYAN}📋 Test Results Summary${NC}"
echo "======================"

echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

success_rate=0
if [ $TOTAL_TESTS -gt 0 ]; then
    success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
fi

echo -e "Success Rate: $success_rate%"

if [ $success_rate -ge 80 ]; then
    echo -e "\n${GREEN}🎉 SECURITY INTEGRATION TESTS: PASSED${NC}"
    echo -e "${GREEN}✅ Security implementation is working correctly${NC}"
    exit_code=0
elif [ $success_rate -ge 60 ]; then
    echo -e "\n${YELLOW}⚠️  SECURITY INTEGRATION TESTS: PARTIAL${NC}"
    echo -e "${YELLOW}⚠️  Some security features may need attention${NC}"
    exit_code=1
else
    echo -e "\n${RED}❌ SECURITY INTEGRATION TESTS: FAILED${NC}"
    echo -e "${RED}❌ Critical security issues need immediate attention${NC}"
    exit_code=2
fi

echo -e "\n${CYAN}📝 Recommendations${NC}"
echo "=================="

if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${YELLOW}• Review failed tests and fix security issues${NC}"
    echo -e "${YELLOW}• Ensure all security modules are properly deployed${NC}"
    echo -e "${YELLOW}• Verify environment variables are correctly set${NC}"
fi

echo -e "${GREEN}• Run this test suite regularly to validate security${NC}"
echo -e "${GREEN}• Monitor security status endpoint in production${NC}"
echo -e "${GREEN}• Keep security documentation up to date${NC}"

echo -e "\n${CYAN}🔗 Next Steps${NC}"
echo "=============="
echo -e "1. Deploy security fixes to production"
echo -e "2. Run this test suite against production"
echo -e "3. Monitor security metrics dashboard"
echo -e "4. Schedule regular security audits"
echo -e "5. Update security test cases for new features"

exit $exit_code