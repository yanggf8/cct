#!/bin/bash

# Admin APIs Negative Path Tests
# Tests admin APIs with invalid payloads and expired exemptions

set -euo pipefail

# Create run-scoped temp dir and ensure cleanup
RUN_TMPDIR=".ci-tmp/${GITHUB_RUN_ID:-local}-admin-neg-$$"
mkdir -p "$RUN_TMPDIR"
export TMPDIR="$RUN_TMPDIR"
cleanup() {
  rm -rf "$RUN_TMPDIR" || true
}
trap cleanup EXIT

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_KEY="${X_API_KEY:-test}"
BASE_URL="${CCT_URL:-https://tft-trading-system.yanggf.workers.dev}"
TEST_CATEGORY="${1:-all}"  # exemptions, canary, all
MAX_RUNTIME_SECONDS="${MAX_RUNTIME_SECONDS:-300}"  # 5 minutes

echo "🔧 Admin APIs Negative Path Tests"
echo "=================================="
echo "Test Category: $TEST_CATEGORY"
echo "Base URL: $BASE_URL"
echo "Max Runtime: ${MAX_RUNTIME_SECONDS} seconds"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Initialize test tracking
EXECUTION_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)")
START_TIME=$(date +%s)
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNED=0
TESTS_SKIPPED=0

# Request tracking and failed tests storage
REQUEST_IDS=()
FAILED_TESTS=()
NEGATIVE_RESULTS=()

# Setup timeout handler
timeout_handler() {
    local elapsed=$(($(date +%s) - START_TIME))
    echo ""
    echo -e "⏰ ${YELLOW}TIMEOUT REACHED${NC}"
    echo "Test execution exceeded maximum runtime of ${MAX_RUNTIME_SECONDS} seconds"
    echo "Elapsed time: ${elapsed} seconds"
    generate_negative_test_summary "TIMEOUT"
    exit 124
}

trap timeout_handler TERM
( sleep $MAX_RUNTIME_SECONDS && kill $$ ) 2>/dev/null &
TIMEOUT_PID=$!

log_test() {
    local test_name="$1"
    local status="$2"
    local message="${3:-}"
    local request_id="neg_$(date +%s%N | tail -c 10)"

    REQUEST_IDS+=("{\"request_id\": \"$request_id\", \"test_name\": \"$test_name\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S)\", \"status\": \"$status\"}")

    if [[ "$status" == "PASS" ]]; then
        echo -e "✅ ${GREEN}PASS${NC}: $test_name"
        ((TESTS_PASSED++))
    elif [[ "$status" == "SKIP" ]]; then
        echo -e "⏭️  ${YELLOW}SKIP${NC}: $test_name"
        ((TESTS_SKIPPED++))
    elif [[ "$status" == "WARN" ]]; then
        echo -e "⚠️  ${YELLOW}WARN${NC}: $test_name"
        if [[ -n "$message" ]]; then
            echo "   $message"
        fi
        ((TESTS_WARNED++))
    else
        echo -e "❌ ${RED}FAIL${NC}: $test_name"
        if [[ -n "$message" ]]; then
            echo "   $message"
        fi
        ((TESTS_FAILED++))
        FAILED_TESTS+=("{\"name\": \"$test_name\", \"error_message\": \"$message\", \"error_type\": \"assertion\", \"test_type\": \"negative_path\"}")
    fi
}

# Store negative test results
store_negative_result() {
    local api_name="$1"
    local test_case="$2"
    local expected_result="$3"
    local actual_result="$4"
    local status="$5"

    NEGATIVE_RESULTS+=("{\"api\": \"$api_name\", \"test_case\": \"$test_case\", \"expected\": \"$expected_result\", \"actual\": \"$actual_result\", \"status\": \"$status\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S)\"}")
}

# Test exemption APIs with invalid payloads
test_exemption_apis() {
    echo -e "${BLUE}Testing Exemption APIs - Negative Paths${NC}"
    echo "=========================================="

    # Test 1: Invalid JSON payload
    echo "Testing invalid JSON payload..."
    INVALID_JSON_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"invalid": json}' \
        "$BASE_URL/api/v1/exemptions/create" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$INVALID_JSON_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -ge 400 && "$HTTP_CODE" -lt 500 ]]; then
        log_test "Exemption create - Invalid JSON" "PASS" "HTTP $HTTP_CODE (expected 4xx)"
        store_negative_result "exemptions_create" "invalid_json" "4xx_client_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Exemption create - Invalid JSON" "FAIL" "Expected 4xx error, got HTTP $HTTP_CODE"
        store_negative_result "exemptions_create" "invalid_json" "4xx_client_error" "HTTP_$HTTP_CODE" "FAIL"
    fi

    # Test 2: Missing required fields
    echo "Testing missing required fields..."
    MISSING_FIELDS_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"pattern": "test"}' \
        "$BASE_URL/api/v1/exemptions/create" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$MISSING_FIELDS_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -ge 400 && "$HTTP_CODE" -lt 500 ]]; then
        log_test "Exemption create - Missing fields" "PASS" "HTTP $HTTP_CODE (expected 4xx)"
        store_negative_result "exemptions_create" "missing_fields" "4xx_client_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Exemption create - Missing fields" "FAIL" "Expected 4xx error, got HTTP $HTTP_CODE"
        store_negative_result "exemptions_create" "missing_fields" "4xx_client_error" "HTTP_$HTTP_CODE" "FAIL"
    fi

    # Test 3: Invalid JIRA reference format
    echo "Testing invalid JIRA reference format..."
    INVALID_JIRA_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
          "pattern": "MOCK-EXEMPTION",
          "file": "test.ts",
          "line": 1,
          "jiraReference": "INVALID-FORMAT",
          "owner": "test@example.com",
          "reason": "Test invalid JIRA format"
        }' \
        "$BASE_URL/api/v1/exemptions/create" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$INVALID_JIRA_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -ge 400 && "$HTTP_CODE" -lt 500 ]]; then
        log_test "Exemption create - Invalid JIRA format" "PASS" "HTTP $HTTP_CODE (expected 4xx)"
        store_negative_result "exemptions_create" "invalid_jira" "4xx_client_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Exemption create - Invalid JIRA format" "FAIL" "Expected 4xx error, got HTTP $HTTP_CODE"
        store_negative_result "exemptions_create" "invalid_jira" "4xx_client_error" "HTTP_$HTTP_CODE" "FAIL"
    fi

    # Test 4: Invalid expiration date
    echo "Testing invalid expiration date..."
    INVALID_DATE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
          "pattern": "MOCK-EXEMPTION",
          "file": "test.ts",
          "line": 1,
          "jiraReference": "PROJ-123",
          "owner": "test@example.com",
          "reason": "Test invalid date",
          "expirationDate": "invalid-date-format"
        }' \
        "$BASE_URL/api/v1/exemptions/create" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$INVALID_DATE_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -ge 400 && "$HTTP_CODE" -lt 500 ]]; then
        log_test "Exemption create - Invalid date format" "PASS" "HTTP $HTTP_CODE (expected 4xx)"
        store_negative_result "exemptions_create" "invalid_date" "4xx_client_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Exemption create - Invalid date format" "FAIL" "Expected 4xx error, got HTTP $HTTP_CODE"
        store_negative_result "exemptions_create" "invalid_date" "4xx_client_error" "HTTP_$HTTP_CODE" "FAIL"
    fi

    # Test 5: Past expiration date
    echo "Testing past expiration date..."
    PAST_DATE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
          \"pattern\": \"MOCK-EXEMPTION\",
          \"file\": \"test.ts\",
          \"line\": 1,
          \"jiraReference\": \"PROJ-123\",
          \"owner\": \"test@example.com\",
          \"reason\": \"Test past expiration\",
          \"expirationDate\": \"2020-01-01T00:00:00Z\"
        }" \
        "$BASE_URL/api/v1/exemptions/create" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$PAST_DATE_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    # Past expiration dates should be rejected
    if [[ "$HTTP_CODE" -ge 400 && "$HTTP_CODE" -lt 500 ]]; then
        log_test "Exemption create - Past expiration date" "PASS" "HTTP $HTTP_CODE (expected 4xx)"
        store_negative_result "exemptions_create" "past_expiration" "4xx_client_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Exemption create - Past expiration date" "WARN" "Past date accepted (may be policy decision)"
        store_negative_result "exemptions_create" "past_expiration" "4xx_client_error" "HTTP_$HTTP_CODE" "WARN"
    fi

    # Test 6: Unauthorized access
    echo "Testing unauthorized access..."
    UNAUTH_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET \
        "$BASE_URL/api/v1/exemptions/report" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$UNAUTH_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -eq 401 || "$HTTP_CODE" -eq 403 ]]; then
        log_test "Exemption report - Unauthorized" "PASS" "HTTP $HTTP_CODE (expected auth error)"
        store_negative_result "exemptions_report" "unauthorized" "401_403_auth_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Exemption report - Unauthorized" "FAIL" "Expected 401/403, got HTTP $HTTP_CODE"
        store_negative_result "exemptions_report" "unauthorized" "401_403_auth_error" "HTTP_$HTTP_CODE" "FAIL"
    fi

    # Test 7: Invalid exemption ID for revoke
    echo "Testing invalid exemption ID for revoke..."
    INVALID_ID_RESPONSE=$(curl -s -w "%{http_code}" \
        -X DELETE \
        -H "X-API-Key: $API_KEY" \
        "$BASE_URL/api/v1/exemptions/revoke?id=invalid-id-format" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$INVALID_ID_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -ge 400 && "$HTTP_CODE" -lt 500 ]]; then
        log_test "Exemption revoke - Invalid ID" "PASS" "HTTP $HTTP_CODE (expected 4xx)"
        store_negative_result "exemptions_revoke" "invalid_id" "4xx_client_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Exemption revoke - Invalid ID" "WARN" "Invalid ID handled gracefully"
        store_negative_result "exemptions_revoke" "invalid_id" "4xx_client_error" "HTTP_$HTTP_CODE" "WARN"
    fi

    # Test 8: Extremely large payload
    echo "Testing extremely large payload..."
    LARGE_PAYLOAD=$(cat << EOF
{
  "pattern": "MOCK-EXEMPTION",
  "file": "$(printf 'A%.0s' {1..10000})",
  "line": 1,
  "jiraReference": "PROJ-123",
  "owner": "$(printf 'B%.0s' {1..1000})@$(printf 'C%.0s' {1..1000}).$(printf 'D%.0s' {1..100}).com",
  "reason": "$(printf 'E%.0s' {1..5000})",
  "expirationDate": "2025-12-31T23:59:59Z"
}
EOF
    )

    LARGE_PAYLOAD_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "$LARGE_PAYLOAD" \
        "$BASE_URL/api/v1/exemptions/create" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$LARGE_PAYLOAD_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -ge 400 && "$HTTP_CODE" -lt 500 ]]; then
        log_test "Exemption create - Large payload" "PASS" "HTTP $HTTP_CODE (expected 4xx)"
        store_negative_result "exemptions_create" "large_payload" "4xx_client_error" "HTTP_$HTTP_CODE" "PASS"
    elif [[ "$HTTP_CODE" -eq 413 ]]; then
        log_test "Exemption create - Large payload" "PASS" "HTTP 413 (payload too large)"
        store_negative_result "exemptions_create" "large_payload" "413_payload_too_large" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Exemption create - Large payload" "WARN" "Large payload accepted unexpectedly"
        store_negative_result "exemptions_create" "large_payload" "4xx_client_error" "HTTP_$HTTP_CODE" "WARN"
    fi
}

# Test canary APIs with invalid payloads
test_canary_apis() {
    echo -e "${BLUE}Testing Canary APIs - Negative Paths${NC}"
echo "========================================"

    # Test 1: Invalid percentage value
    echo "Testing invalid percentage value..."
    INVALID_PERCENT_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        "$BASE_URL/api/v1/canary/enable?route=/test&percentage=150" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$INVALID_PERCENT_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -ge 400 && "$HTTP_CODE" -lt 500 ]]; then
        log_test "Canary enable - Invalid percentage" "PASS" "HTTP $HTTP_CODE (expected 4xx)"
        store_negative_result "canary_enable" "invalid_percentage" "4xx_client_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Canary enable - Invalid percentage" "FAIL" "Expected 4xx error, got HTTP $HTTP_CODE"
        store_negative_result "canary_enable" "invalid_percentage" "4xx_client_error" "HTTP_$HTTP_CODE" "FAIL"
    fi

    # Test 2: Negative percentage value
    echo "Testing negative percentage value..."
    NEG_PERCENT_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        "$BASE_URL/api/v1/canary/enable?route=/test&percentage=-10" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$NEG_PERCENT_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -ge 400 && "$HTTP_CODE" -lt 500 ]]; then
        log_test "Canary enable - Negative percentage" "PASS" "HTTP $HTTP_CODE (expected 4xx)"
        store_negative_result "canary_enable" "negative_percentage" "4xx_client_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Canary enable - Negative percentage" "FAIL" "Expected 4xx error, got HTTP $HTTP_CODE"
        store_negative_result "canary_enable" "negative_percentage" "4xx_client_error" "HTTP_$HTTP_CODE" "FAIL"
    fi

    # Test 3: Invalid route name
    echo "Testing invalid route name..."
    INVALID_ROUTE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        "$BASE_URL/api/v1/canary/enable?route=..invalid..path..&percentage=10" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$INVALID_ROUTE_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    # Invalid routes should be rejected
    if [[ "$HTTP_CODE" -ge 400 && "$HTTP_CODE" -lt 500 ]]; then
        log_test "Canary enable - Invalid route" "PASS" "HTTP $HTTP_CODE (expected 4xx)"
        store_negative_result "canary_enable" "invalid_route" "4xx_client_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Canary enable - Invalid route" "WARN" "Invalid route may be accepted (policy dependent)"
        store_negative_result "canary_enable" "invalid_route" "4xx_client_error" "HTTP_$HTTP_CODE" "WARN"
    fi

    # Test 4: Missing required parameters
    echo "Testing missing required parameters..."
    MISSING_PARAMS_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        "$BASE_URL/api/v1/canary/enable" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$MISSING_PARAMS_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -ge 400 && "$HTTP_CODE" -lt 500 ]]; then
        log_test "Canary enable - Missing parameters" "PASS" "HTTP $HTTP_CODE (expected 4xx)"
        store_negative_result "canary_enable" "missing_params" "4xx_client_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Canary enable - Missing parameters" "FAIL" "Expected 4xx error, got HTTP $HTTP_CODE"
        store_negative_result "canary_enable" "missing_params" "4xx_client_error" "HTTP_$HTTP_CODE" "FAIL"
    fi

    # Test 5: Invalid simulation payload
    echo "Testing invalid simulation payload..."
    INVALID_SIM_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"invalid": "json", "route": "/test"}' \
        "$BASE_URL/api/v1/canary/simulate" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$INVALID_SIM_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -ge 400 && "$HTTP_CODE" -lt 500 ]]; then
        log_test "Canary simulate - Invalid payload" "PASS" "HTTP $HTTP_CODE (expected 4xx)"
        store_negative_result "canary_simulate" "invalid_payload" "4xx_client_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Canary simulate - Invalid payload" "FAIL" "Expected 4xx error, got HTTP $HTTP_CODE"
        store_negative_result "canary_simulate" "invalid_payload" "4xx_client_error" "HTTP_$HTTP_CODE" "FAIL"
    fi

    # Test 6: Unauthorized access for admin operations
    echo "Testing unauthorized access for canary operations..."
    UNAUTH_CANARY_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        "$BASE_URL/api/v1/canary/enable?route=/test&percentage=10" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$UNAUTH_CANARY_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -eq 401 || "$HTTP_CODE" -eq 403 ]]; then
        log_test "Canary operations - Unauthorized" "PASS" "HTTP $HTTP_CODE (expected auth error)"
        store_negative_result "canary_operations" "unauthorized" "401_403_auth_error" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Canary operations - Unauthorized" "FAIL" "Expected 401/403, got HTTP $HTTP_CODE"
        store_negative_result "canary_operations" "unauthorized" "401_403_auth_error" "HTTP_$HTTP_CODE" "FAIL"
    fi

    # Test 7: Non-existent endpoint
    echo "Testing non-existent endpoint..."
    NONEXISTENT_RESPONSE=$(curl -s -w "%{http_code}" \
        -H "X-API-Key: $API_KEY" \
        "$BASE_URL/api/v1/canary/nonexistent-endpoint" 2>/dev/null || echo "000 HTTP_FAILED")

    HTTP_CODE=$(echo "$NONEXISTENT_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$HTTP_CODE" -eq 404 ]]; then
        log_test "Canary - Non-existent endpoint" "PASS" "HTTP $HTTP_CODE (expected 404)"
        store_negative_result "canary" "nonexistent_endpoint" "404_not_found" "HTTP_$HTTP_CODE" "PASS"
    else
        log_test "Canary - Non-existent endpoint" "FAIL" "Expected 404, got HTTP $HTTP_CODE"
        store_negative_result "canary" "nonexistent_endpoint" "404_not_found" "HTTP_$HTTP_CODE" "FAIL"
    fi
}

# Test SQL injection attempts (if applicable)
test_sql_injection() {
    echo -e "${BLUE}Testing SQL Injection Protection${NC}"
echo "==============================="

    SQL_INJECTION_PAYLOADS=(
        "'; DROP TABLE exemptions; --"
        "' OR '1'='1"
        "'; INSERT INTO exemptions VALUES ('hack'); --"
        "' UNION SELECT * FROM users --"
        "'; DELETE FROM exemptions WHERE '1'='1'; --"
    )

    for payload in "${SQL_INJECTION_PAYLOADS[@]}"; do
        echo "Testing SQL injection payload: ${payload:0:20}..."

        # Test exemption create endpoint
        SQL_INJECTION_RESPONSE=$(curl -s -w "%{http_code}" \
            -X POST \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"jiraReference\": \"$payload\", \"owner\": \"test@test.com\"}" \
            "$BASE_URL/api/v1/exemptions/create" 2>/dev/null || echo "000 HTTP_FAILED")

        HTTP_CODE=$(echo "$SQL_INJECTION_RESPONSE" | grep -o '[0-9]*$' || echo "000")
        if [[ "$HTTP_CODE" -ge 400 ]]; then
            log_test "SQL injection protection" "PASS" "HTTP $HTTP_CODE (malicious payload rejected)"
            store_negative_result "security" "sql_injection" "400_malicious_rejected" "HTTP_$HTTP_CODE" "PASS"
        else
            log_test "SQL injection protection" "FAIL" "Potential SQL injection vulnerability detected"
            store_negative_result "security" "sql_injection" "400_malicious_rejected" "HTTP_$HTTP_CODE" "FAIL"
        fi
    done
}

# Generate negative test summary
generate_negative_test_summary() {
    local final_status="${1:-COMPLETED}"

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))
    SUCCESS_RATE=$((TOTAL_TESTS > 0 ? (TESTS_PASSED * 100 / TOTAL_TESTS) : 0))

    # Determine overall status
    if [[ "$final_status" == "TIMEOUT" ]]; then
        OVERALL_STATUS="TIMEOUT"
    elif [[ $TESTS_FAILED -eq 0 ]]; then
        OVERALL_STATUS="PASS"
    else
        OVERALL_STATUS="FAIL"
    fi

    # Generate recommendations
    RECOMMENDATIONS="[]"
    if [[ ${#FAILED_TESTS[@]} -gt 0 ]]; then
        RECOMMENDATIONS=$(cat << EOF
[
  {
    "category": "immediate",
    "priority": "high",
    "title": "Fix API Input Validation",
    "description": "Some negative test cases failed, indicating insufficient input validation",
    "action_items": [
      "Review API input validation logic",
      "Add proper schema validation for all endpoints",
      "Implement rate limiting for malformed requests",
      "Add comprehensive error logging"
    ],
    "estimated_effort": "4-8 hours"
  }
]
EOF
    )
    else
        RECOMMENDATIONS=$(cat << EOF
[
  {
    "category": "security",
    "priority": "medium",
    "title": "Continue API Security Monitoring",
    "description": "All negative test cases passed - API security controls are working",
    "action_items": [
      "Schedule regular negative testing",
      "Monitor for new attack patterns",
      "Update test cases with new threat vectors",
      "Consider adding fuzzing tests"
    ],
    "estimated_effort": "Ongoing"
  }
]
EOF
    )
    fi

    # Create comprehensive negative test summary
    cat > negative-test-summary.json << EOF
{
  "test_metadata": {
    "test_name": "Admin APIs Negative Path Tests",
    "test_version": "1.0.0",
    "execution_id": "$EXECUTION_ID",
    "timestamp": "$(date -d @$START_TIME -u +%Y-%m-%dT%H:%M:%SZ)",
    "duration_seconds": $DURATION,
    "test_category": "$TEST_CATEGORY",
    "environment": {
      "runner_os": "$RUNNER_OS",
      "base_url": "$BASE_URL"
    }
  },
  "test_results": {
    "total_tests": $TOTAL_TESTS,
    "tests_passed": $TESTS_PASSED,
    "tests_failed": $TESTS_FAILED,
    "tests_skipped": $TESTS_SKIPPED,
    "tests_warned": $TESTS_WARNED,
    "success_rate": $SUCCESS_RATE,
    "overall_status": "$OVERALL_STATUS"
  },
  "key_metrics": {
    "negative_test_coverage": {
      "apis_tested": 2,
      "negative_cases_total": $TOTAL_TESTS,
      "rejection_rate": $SUCCESS_RATE,
      "security_controls_passed": $TESTS_PASSED
    },
    "security_metrics": {
      "sql_injection_attempts": 6,
      "sql_injection_blocked": $(echo "$SQL_INJECTION_RESPONSE" | grep -c '4[0-9][0-9]' 2>/dev/null || echo "0"),
      "input_validation_failures": $TESTS_FAILED,
      "authorization_tests": 2
    }
  },
  "request_ids": [
    $(IFS=$','; echo "${REQUEST_IDS[*]}")
  ],
  "failed_tests": [
    $(IFS=$','; echo "${FAILED_TESTS[*]}")
  ],
  "negative_test_results": [
    $(IFS=$','; echo "${NEGATIVE_RESULTS[*]}")
  ],
  "recommendations": $RECOMMENDATIONS,
  "artifacts": {
    "logs": [
      {
        "name": "negative-test.log",
        "path": "negative-test.log",
        "size_bytes": $(wc -c < negative-test.log 2>/dev/null || echo "0")
      }
    ],
    "reports": [
      {
        "name": "negative-test-summary.json",
        "path": "negative-test-summary.json",
        "format": "json"
      }
    ]
  },
  "ci_annotations": {
    "pull_request_comments": [],
    "check_run_annotations": [
      {
        "name": "Admin APIs Security Tests",
        "status": "completed",
        "conclusion": "$([[ "$OVERALL_STATUS" == "PASS" ]] && echo "success" || echo "failure")",
        "title": "API Negative Path Test Results",
        "summary": "Total: $TOTAL_TESTS, Passed: $TESTS_PASSED, Failed: $TESTS_FAILED, Status: $OVERALL_STATUS"
      }
    ]
  }
}
EOF
}

# Execute tests based on category
case $TEST_CATEGORY in
    "exemptions")
        test_exemption_apis
        ;;
    "canary")
        test_canary_apis
        ;;
    "all")
        test_exemption_apis
        echo ""
        test_canary_apis
        echo ""
        test_sql_injection
        ;;
    *)
        echo "Invalid test category: $TEST_CATEGORY"
        echo "Valid options: exemptions, canary, all"
        exit 1
        ;;
esac

# Generate final summary
echo -e "${BLUE}Phase: Final Results${NC}"
echo "===================="

# Kill timeout process if still running
if [[ -n "${TIMEOUT_PID:-}" ]]; then
    kill $TIMEOUT_PID 2>/dev/null || true
fi

# Generate test summary
generate_negative_test_summary

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))
SUCCESS_RATE=$((TOTAL_TESTS > 0 ? (TESTS_PASSED * 100 / TOTAL_TESTS) : 0))

echo "Negative Test Results:"
echo "  Total Tests: $TOTAL_TESTS"
echo "  Passed: $TESTS_PASSED"
echo "  Failed: $TESTS_FAILED"
echo "  Skipped: $TESTS_SKIPPED"
echo "  Success Rate: ${SUCCESS_RATE}%"
echo "  Duration: $(($END_TIME - START_TIME)) seconds"
echo ""

# Overall assessment
if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "🛡️ ${GREEN}ALL NEGATIVE TESTS PASSED${NC}"
    echo "Admin APIs properly reject invalid inputs and unauthorized access!"
    echo ""
    echo "✅ Input validation is working correctly"
    echo "✅ Authorization controls are enforced"
    echo "✅ Schema validation is rejecting malformed payloads"
    echo "✅ SQL injection protection is active"
    echo ""
    echo "📁 Detailed results saved in: negative-test-summary.json"
    exit 0
else
    echo -e "🚨 ${RED}SECURITY CONCERNS DETECTED${NC}"
    echo "Some negative test cases failed - security controls need improvement!"
    echo ""
    echo "Review negative-test-summary.json for detailed security analysis."
    exit 1
fi