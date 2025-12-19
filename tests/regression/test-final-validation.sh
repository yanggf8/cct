#!/bin/bash

# TFT Trading System - Final Validation Test Suite
# Comprehensive validation of all environment variable changes and documentation updates
# This test ensures our X_API_KEY standardization is working correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
API_URL="https://tft-trading-system.yanggf.workers.dev"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test result reporting
test_pass() {
    local test_name="$1"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
    echo -e "${GREEN}✅ PASS: $test_name${NC}"
}

test_fail() {
    local test_name="$1"
    local reason="$2"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
    echo -e "${RED}❌ FAIL: $test_name - $reason${NC}"
}

test_skip() {
    local test_name="$1"
    local reason="$2"
    ((TOTAL_TESTS++))
    echo -e "${YELLOW}⏭️  SKIP: $test_name - $reason${NC}"
}

echo -e "${CYAN}=====================================${NC}"
echo -e "${CYAN}🎯 Final Validation Test Suite${NC}"
echo -e "${CYAN}=====================================${NC}"
echo -e "${CYAN}Testing all environment variable changes...${NC}"
echo ""

# Check environment variable availability
echo -e "${BLUE}1. Environment Variable Validation${NC}"
if [[ -z "${X_API_KEY:-}" ]]; then
    echo -e "${RED}❌ ERROR: X_API_KEY not found${NC}"
    echo "Please set X_API_KEY in your environment:"
    echo "  export X_API_KEY=\"your_api_key\""
    exit 1
fi
echo -e "${GREEN}✅ X_API_KEY is set (length: ${#X_API_KEY})${NC}"
test_pass "X_API_KEY Environment Variable"

# Test 1: Core API endpoints with X-API-KEY
echo ""
echo -e "${BLUE}2. Core API Endpoint Testing${NC}"

# Test system health
if timeout 10 curl -s -H "X-API-KEY: $X_API_KEY" "$API_URL/health" | jq -e '.status' >/dev/null 2>&1; then
    test_pass "System Health Endpoint"
else
    test_fail "System Health Endpoint" "API not responding or invalid auth"
fi

# Test API v1 endpoints
if timeout 10 curl -s -H "X-API-KEY: $X_API_KEY" "$API_URL/api/v1/data/health" | jq -e '.success' >/dev/null 2>&1; then
    test_pass "API v1 Health Endpoint"
else
    test_fail "API v1 Health Endpoint" "API v1 not responding"
fi

# Test enhanced cache endpoints
if timeout 10 curl -s -H "X-API-KEY: $X_API_KEY" "$API_URL/api/v1/cache/health" | jq -e '.success' >/dev/null 2>&1; then
    test_pass "Enhanced Cache Health Endpoint"
else
    test_fail "Enhanced Cache Health Endpoint" "Cache endpoint not responding"
fi

# Test analysis endpoint
if timeout 15 curl -s -H "X-API-KEY: $X_API_KEY" "$API_URL/analyze" | jq -e '.success' >/dev/null 2>&1; then
    test_pass "Main Analysis Endpoint"
else
    test_fail "Main Analysis Endpoint" "Analysis endpoint not responding"
fi

# Test 2: Authentication validation
echo ""
echo -e "${BLUE}3. Authentication Validation${NC}"

# Test with valid key
if timeout 10 curl -s -H "X-API-KEY: $X_API_KEY" "$API_URL/api/v1/data/health" | jq -e '.success == true' >/dev/null 2>&1; then
    test_pass "Valid X-API-KEY Authentication"
else
    test_fail "Valid X-API-KEY Authentication" "Authentication failing"
fi

# Test with invalid key
if timeout 10 curl -s -H "X-API-KEY: invalid_key" "$API_URL/api/v1/data/health" | jq -e '.success == false' >/dev/null 2>&1; then
    test_pass "Invalid X-API-KEY Rejection"
else
    test_fail "Invalid X-API-KEY Rejection" "Invalid key not properly rejected"
fi

# Test 3: Test script validation
echo ""
echo -e "${BLUE}4. Test Script Environment Validation${NC}"

# Test that each test script has environment checks
SCRIPTS_CHECKED=0
SCRIPTS_WITH_CHECKS=0

for script in /home/yanggf/a/cct/test-*.sh; do
    if [[ -f "$script" ]]; then
        ((SCRIPTS_CHECKED++))
        if grep -q "Check.*X_API_KEY\|Missing.*X_API_KEY" "$script"; then
            ((SCRIPTS_WITH_CHECKS++))
        fi
    fi
done

if [[ $SCRIPTS_WITH_CHECKS -eq $SCRIPTS_CHECKED ]]; then
    test_pass "All Test Scripts Have X_API_KEY Checks" "$SCRIPTS_WITH_CHECKS/$SCRIPTS_CHECKED"
else
    test_fail "Test Scripts Missing X_API_KEY Checks" "$SCRIPTS_WITH_CHECKS/$SCRIPTS_CHECKED have checks"
fi

# Test 4: Documentation validation
echo ""
echo -e "${BLUE}5. Documentation Validation${NC}"

# Check that documentation files use X_API_KEY instead of hardcoded values
if ! grep -r 'API_KEY.*yanggf' /home/yanggf/a/cct/*.md 2>/dev/null | grep -v "X_API_KEY"; then
    test_pass "Documentation Uses X_API_KEY (no hardcoded API_KEY)"
else
    test_fail "Documentation Still Contains Hardcoded API_KEY"
fi

# Check that JavaScript examples use environment variables
if grep -r "process.env.X_API_KEY" /home/yanggf/a/cct/*.md 2>/dev/null >/dev/null; then
    test_pass "JavaScript Examples Use Environment Variables"
else
    test_fail "JavaScript Examples Missing Environment Variables"
fi

# Check that Python examples use environment variables
if grep -r "os.environ\['X_API_KEY'\]" /home/yanggf/a/cct/*.md 2>/dev/null >/dev/null; then
    test_pass "Python Examples Use Environment Variables"
else
    test_fail "Python Examples Missing Environment Variables"
fi

# Test 5: Security validation
echo ""
echo -e "${BLUE}6. Security Validation${NC}"

# Ensure no hardcoded API keys in test scripts
if ! grep -r '"yanggf"' /home/yanggf/a/cct/test-*.sh 2>/dev/null | grep -v "X_API_KEY.*yanggf"; then
    test_pass "No Hardcoded API Keys in Test Scripts"
else
    test_fail "Test Scripts Still Contain Hardcoded API Keys"
fi

# Ensure test scripts don't have API_KEY exports
if ! grep -r "export API_KEY" /home/yanggf/a/cct/test-*.sh 2>/dev/null; then
    test_pass "No API_KEY Exports in Test Scripts"
else
    test_fail "Test Scripts Still Export API_KEY"
fi

# Test 6: Performance validation
echo ""
echo -e "${BLUE}7. Performance Validation${NC}"

# Test cache performance
START_TIME=$(date +%s%N)
timeout 10 curl -s -H "X-API-KEY: $X_API_KEY" "$API_URL/api/v1/data/health" >/dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 )) # Convert to milliseconds

if [[ $RESPONSE_TIME -lt 1000 ]]; then
    test_pass "API Response Time < 1000ms (${RESPONSE_TIME}ms)"
else
    test_fail "API Response Time Too Slow (${RESPONSE_TIME}ms)" "Response should be under 1 second"
fi

# Final summary
echo ""
echo -e "${CYAN}=====================================${NC}"
echo -e "${CYAN}📊 Test Results Summary${NC}"
echo -e "${CYAN}=====================================${NC}"
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"

SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
echo -e "Success Rate: ${SUCCESS_RATE}%"

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}Environment variable standardization is complete and working correctly.${NC}"
    echo ""
    echo -e "${BLUE}✅ System Status:${NC}"
    echo -e "  - X_API_KEY authentication: Working"
    echo -e "  - All API endpoints: Operational"
    echo -e "  - Test scripts: Environment validated"
    echo -e "  - Documentation: Standardized"
    echo -e "  - Security: No hardcoded keys"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  Some tests failed. Please review the failures above.${NC}"
    exit 1
fi