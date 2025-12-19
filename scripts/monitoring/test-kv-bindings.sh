#!/bin/bash

# Test KV Binding Configuration and Direct KV Operations
# This script tests the new KV self-test and bindings endpoints
# to validate that KV namespace bindings are correctly configured

set -e  # Exit on error

# Configuration
BASE_URL="${BASE_URL:-https://tft-trading-system.yanggf.workers.dev}"
API_KEY="${X_API_KEY:-test}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo ""
echo "======================================================================"
echo "  KV Binding Configuration Test Suite"
echo "======================================================================"
echo ""
echo "Base URL: $BASE_URL"
echo "API Key: ${API_KEY:0:8}..."
echo ""

# Function to print test result
print_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC} - $test_name"
        [ -n "$message" ] && echo "  $message"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}✗ FAIL${NC} - $test_name"
        [ -n "$message" ] && echo "  $message"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠ WARN${NC} - $test_name"
        [ -n "$message" ] && echo "  $message"
    else
        echo -e "${BLUE}ℹ INFO${NC} - $test_name"
        [ -n "$message" ] && echo "  $message"
    fi
}

# Test 1: Environment Bindings Endpoint
echo ""
echo "======================================================================"
echo "Test 1: Environment Bindings Discovery"
echo "======================================================================"
echo ""

BINDINGS_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/data/bindings")

HTTP_CODE=$(echo "$BINDINGS_RESPONSE" | tail -n1)
BODY=$(echo "$BINDINGS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    print_result "Bindings endpoint responds" "PASS" "HTTP $HTTP_CODE"

    # Parse response
    SUCCESS=$(echo "$BODY" | jq -r '.success // false')
    BINDING_COUNT=$(echo "$BODY" | jq -r '.data.binding_count // 0')
    KV_NAMESPACES=$(echo "$BODY" | jq -r '.data.kv_namespaces // []' | jq -r 'join(", ")')
    MARKET_ANALYSIS_CACHE_EXISTS=$(echo "$BODY" | jq -r '.data.critical_bindings_status.MARKET_ANALYSIS_CACHE // false')

    echo ""
    echo "Binding Discovery Results:"
    echo "  Total bindings: $BINDING_COUNT"
    echo "  KV namespaces: $KV_NAMESPACES"
    echo "  MARKET_ANALYSIS_CACHE exists: $MARKET_ANALYSIS_CACHE_EXISTS"
    echo ""

    if [ "$MARKET_ANALYSIS_CACHE_EXISTS" = "true" ]; then
        print_result "MARKET_ANALYSIS_CACHE binding exists" "PASS"
    else
        print_result "MARKET_ANALYSIS_CACHE binding exists" "FAIL" "CRITICAL: KV namespace not bound"
    fi

    # Show all bindings for debugging
    echo ""
    echo "All Available Bindings:"
    echo "$BODY" | jq -r '.data.bindings | to_entries[] | "  - \(.key): \(.value.type)"'
    echo ""
else
    print_result "Bindings endpoint responds" "FAIL" "HTTP $HTTP_CODE"
    echo "Response: $BODY"
fi

# Test 2: KV Self-Test Endpoint
echo ""
echo "======================================================================"
echo "Test 2: Direct KV Operations Self-Test"
echo "======================================================================"
echo ""

KV_TEST_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/data/kv-self-test")

HTTP_CODE=$(echo "$KV_TEST_RESPONSE" | tail -n1)
BODY=$(echo "$KV_TEST_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "500" ]; then
    print_result "KV self-test endpoint responds" "PASS" "HTTP $HTTP_CODE"

    # Parse response
    OVERALL_STATUS=$(echo "$BODY" | jq -r '.data.overall_status // "UNKNOWN"')
    ALL_TESTS_PASSED=$(echo "$BODY" | jq -r '.data.all_tests_passed // false')
    CRITICAL_TESTS_PASSED=$(echo "$BODY" | jq -r '.data.critical_tests_passed // false')

    echo ""
    echo "KV Self-Test Results:"
    echo "  Overall status: $OVERALL_STATUS"
    echo "  All tests passed: $ALL_TESTS_PASSED"
    echo "  Critical tests passed: $CRITICAL_TESTS_PASSED"
    echo ""

    # Test details
    echo "Detailed Test Results:"

    # Binding check
    BINDING_SUCCESS=$(echo "$BODY" | jq -r '.data.test_details.binding_check.success // false')
    BINDING_MSG=$(echo "$BODY" | jq -r '.data.test_details.binding_check.message // ""')
    if [ "$BINDING_SUCCESS" = "true" ]; then
        print_result "1. Binding check" "PASS" "$BINDING_MSG"
    else
        print_result "1. Binding check" "FAIL" "$BINDING_MSG"
    fi

    # Write test
    WRITE_SUCCESS=$(echo "$BODY" | jq -r '.data.test_details.write_test.success // false')
    WRITE_MSG=$(echo "$BODY" | jq -r '.data.test_details.write_test.message // ""')
    if [ "$WRITE_SUCCESS" = "true" ]; then
        print_result "2. KV write (put)" "PASS" "$WRITE_MSG"
    else
        print_result "2. KV write (put)" "FAIL" "$WRITE_MSG"
        WRITE_ERROR=$(echo "$BODY" | jq -r '.data.test_details.write_test.error // ""')
        [ -n "$WRITE_ERROR" ] && echo "     Error: $WRITE_ERROR"
    fi

    # Read test
    READ_SUCCESS=$(echo "$BODY" | jq -r '.data.test_details.read_test.success // false')
    READ_MSG=$(echo "$BODY" | jq -r '.data.test_details.read_test.message // ""')
    if [ "$READ_SUCCESS" = "true" ]; then
        print_result "3. KV read (get)" "PASS" "$READ_MSG"
    else
        print_result "3. KV read (get)" "FAIL" "$READ_MSG"
        READ_ERROR=$(echo "$BODY" | jq -r '.data.test_details.read_test.error // ""')
        [ -n "$READ_ERROR" ] && echo "     Error: $READ_ERROR"
    fi

    # List test
    LIST_SUCCESS=$(echo "$BODY" | jq -r '.data.test_details.list_test.success // false')
    LIST_MSG=$(echo "$BODY" | jq -r '.data.test_details.list_test.message // ""')
    LIST_FOUND=$(echo "$BODY" | jq -r '.data.test_details.list_test.found // false')
    if [ "$LIST_SUCCESS" = "true" ]; then
        if [ "$LIST_FOUND" = "true" ]; then
            print_result "4. KV list" "PASS" "$LIST_MSG"
        else
            print_result "4. KV list" "WARN" "$LIST_MSG (list works but key not found)"
        fi
    else
        print_result "4. KV list" "FAIL" "$LIST_MSG"
    fi

    # Delete test
    DELETE_SUCCESS=$(echo "$BODY" | jq -r '.data.test_details.delete_test.success // false')
    DELETE_MSG=$(echo "$BODY" | jq -r '.data.test_details.delete_test.message // ""')
    if [ "$DELETE_SUCCESS" = "true" ]; then
        print_result "5. KV delete" "PASS" "$DELETE_MSG"
    else
        print_result "5. KV delete" "FAIL" "$DELETE_MSG"
    fi

    # Cleanup verify
    CLEANUP_SUCCESS=$(echo "$BODY" | jq -r '.data.test_details.cleanup_verify.success // false')
    CLEANUP_MSG=$(echo "$BODY" | jq -r '.data.test_details.cleanup_verify.message // ""')
    if [ "$CLEANUP_SUCCESS" = "true" ]; then
        print_result "6. Cleanup verification" "PASS" "$CLEANUP_MSG"
    else
        print_result "6. Cleanup verification" "WARN" "$CLEANUP_MSG"
    fi

    echo ""
    echo "Recommendations:"
    echo "$BODY" | jq -r '.data.recommendations[] // [] | "  - \(.)"'
    echo ""

    # Overall assessment
    if [ "$ALL_TESTS_PASSED" = "true" ]; then
        print_result "Overall KV self-test" "PASS" "All KV operations working correctly"
    elif [ "$CRITICAL_TESTS_PASSED" = "true" ]; then
        print_result "Overall KV self-test" "WARN" "Critical operations work, some non-critical tests failed"
    else
        print_result "Overall KV self-test" "FAIL" "CRITICAL: Core KV operations failing"
    fi

else
    print_result "KV self-test endpoint responds" "FAIL" "HTTP $HTTP_CODE"
    echo "Response: $BODY"
fi

# Test Summary
echo ""
echo "======================================================================"
echo "Test Summary"
echo "======================================================================"
echo ""
echo "Total tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review failed tests above"
    echo "  2. Check wrangler.toml KV namespace bindings"
    echo "  3. Verify KV namespace ID matches actual Cloudflare KV namespace"
    echo "  4. Ensure deployment used correct wrangler config file"
    echo "  5. Check Cloudflare dashboard for KV namespace status"
    echo ""
    exit 1
fi
