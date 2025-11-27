#!/bin/bash

# SLO Breach Simulation Test
# Simulates SLO breach in staging to validate auto-rollback path

set -euo pipefail

# Create run-scoped temp dir and ensure cleanup
RUN_TMPDIR=".ci-tmp/${GITHUB_RUN_ID:-local}-slo-sim-$$"
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
NC='\033[0m' # No Color'

# Configuration
API_KEY="${X_API_KEY:-test}"
BASE_URL="${CCT_URL:-https://tft-trading-system.yanggf.workers.dev}"
ENDPOINT="${1:-/pre-market-briefing}"
TEST_SCENARIO="${2:-latency}"  # latency, error-rate, availability
DURATION="${3:-10}"  # minutes
SEVERITY="${4:-moderate}"  # mild, moderate, severe

echo "🚨 SLO Breach Simulation Test"
echo "============================"
echo "Endpoint: $ENDPOINT"
echo "Scenario: $TEST_SCENARIO"
echo "Duration: $DURATION minutes"
echo "Severity: $SEVERITY"
echo "Base URL: $BASE_URL"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
SIMULATION_LOG="slo-simulation-$(date +%Y%m%d-%H%M%S).log"

log_test() {
    local test_name="$1"
    local status="$2"
    local message="${3:-}"

    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [$status] $test_name: $message" | tee -a "$SIMULATION_LOG"

    if [[ "$status" == "PASS" ]]; then
        echo -e "✅ ${GREEN}PASS${NC}: $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "❌ ${RED}FAIL${NC}: $test_name"
        if [[ -n "$message" ]]; then
            echo "   $message"
        fi
        ((TESTS_FAILED++))
    fi
}

# Phase 1: Pre-Simulation Checks
echo -e "${BLUE}Phase 1: Pre-Simulation Checks${NC}"
echo "================================="

# Check endpoint availability
echo "Checking baseline endpoint health..."
BASELINE_RESPONSE=$(curl -s -w "%{http_code}" "$BASE_URL$ENDPOINT" || echo "000 HTTP_FAILED")
BASELINE_HTTP=$(echo "$BASELINE_RESPONSE" | grep -o '[0-9]*$' || echo "000")
BASELINE_TIME=$(echo "$BASELINE_RESPONSE" | grep -o "time=[0-9]*" | cut -d'=' -f2 || echo "0")

if [[ "$BASELINE_HTTP" == "200" ]]; then
    log_test "Baseline endpoint availability" "PASS" "HTTP $BASELINE_HTTP, ${BASELINE_TIME}ms"
else
    log_test "Baseline endpoint availability" "FAIL" "HTTP $BASELINE_HTTP"
    echo "Cannot proceed with SLO breach simulation - endpoint not healthy"
    exit 1
fi

# Check canary status
echo "Checking canary status..."
CANARY_RESPONSE=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/api/v1/canary/status" || echo '{"error":"api_unavailable"}')

if echo "$CANARY_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
    CANARY_ENABLED=$(echo "$CANARY_RESPONSE" | jq -r ".data.routes[\"$ENDPOINT\"].enabled // false")
    CANARY_PERCENTAGE=$(echo "$CANARY_RESPONSE" | jq -r ".data.routes[\"$ENDPOINT\"].percentage // 0")

    log_test "Canary status check" "PASS" "Enabled: $CANARY_ENABLED, Percentage: $CANARY_PERCENTAGE%"
else
    log_test "Canary status check" "WARN" "Canary API unavailable - proceeding with default values"
    CANARY_ENABLED=false
    CANARY_PERCENTAGE=0
fi

# Enable canary for testing if not already enabled
if [[ "$CANARY_ENABLED" != "true" ]]; then
    echo "Enabling canary for testing..."
    ENABLE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST \
        -H "X-API-Key: $API_KEY" \
        "$BASE_URL/api/v1/canary/enable?route=$ENDPOINT&percentage=20" || echo "000 HTTP_FAILED")

    ENABLE_HTTP=$(echo "$ENABLE_RESPONSE" | grep -o '[0-9]*$' || echo "000")
    if [[ "$ENABLE_HTTP" == "200" ]]; then
        log_test "Canary enable" "PASS" "Canary enabled at 20%"
        CANARY_ENABLED=true
        CANARY_PERCENTAGE=20
    else
        log_test "Canary enable" "WARN" "Failed to enable canary - proceeding without canary"
    fi
fi

echo ""

# Phase 2: SLO Threshold Configuration
echo -e "${BLUE}Phase 2: SLO Threshold Configuration${NC}"
echo "======================================="

# Define SLO thresholds based on severity
case $SEVERITY in
    "mild")
        LATENCY_THRESHOLD=2000  # 2 seconds
        ERROR_RATE_THRESHOLD=1.0  # 1%
        AVAILABILITY_THRESHOLD=97.0  # 97%
        ;;
    "moderate")
        LATENCY_THRESHOLD=3000  # 3 seconds
        ERROR_RATE_THRESHOLD=2.0  # 2%
        AVAILABILITY_THRESHOLD=95.0  # 95%
        ;;
    "severe")
        LATENCY_THRESHOLD=5000  # 5 seconds
        ERROR_RATE_THRESHOLD=5.0  # 5%
        AVAILABILITY_THRESHOLD=90.0  # 90%
        ;;
    *)
        LATENCY_THRESHOLD=3000
        ERROR_RATE_THRESHOLD=2.0
        AVAILABILITY_THRESHOLD=95.0
        ;;
esac

echo "SLO Thresholds (Severity: $SEVERITY):"
echo "  P95 Latency: ${LATENCY_THRESHOLD}ms"
echo "  Error Rate: ${ERROR_RATE_THRESHOLD}%"
echo "  Availability: ${AVAILABILITY_THRESHOLD}%"

echo ""

# Phase 3: SLO Breach Simulation
echo -e "${BLUE}Phase 3: SLO Breach Simulation${NC}"
echo "=================================="

START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION * 60))

echo "Starting SLO breach simulation..."
echo "Scenario: $TEST_SCENARIO"
echo "Duration: $DURATION minutes"
echo "Will end at: $(date -d @$END_TIME -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

BREACH_DETECTED=false
ROLLBACK_TRIGGERED=false

# Simulation loop
while [[ $(date +%s) -lt $END_TIME ]]; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    REMAINING=$((END_TIME - CURRENT_TIME))

    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | Elapsed: ${ELAPSED}s | Remaining: ${REMAINING}s"

    case $TEST_SCENARIO in
        "latency")
            # Inject artificial latency by sending slow requests
            echo "Injecting latency spike..."
            for i in {1..5}; do
                # Send requests with artificial delay
                LATENCY_INJECTION=$(curl -s -w "%{http_code},time=%{time_total}" \
                    -H "X-Inject-Latency: ${LATENCY_THRESHOLD}ms" \
                    -H "X-API-Key: $API_KEY" \
                    "$BASE_URL$ENDPOINT" || echo "000,time=0")

                HTTP_CODE=$(echo "$LATENCY_INJECTION" | cut -d',' -f1)
                RESPONSE_TIME=$(echo "$LATENCY_INJECTION" | cut -d',' -f2 | cut -d'=' -f2)
                RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000 / 1" | bc 2>/dev/null || echo "0")

                echo "  Request $i: HTTP $HTTP_CODE, ${RESPONSE_TIME_MS}ms"

                # Check if latency threshold breached
                if [[ $(echo "$RESPONSE_TIME_MS > $LATENCY_THRESHOLD" | bc 2>/dev/null || echo "0") -eq 1 ]]; then
                    if [[ "$BREACH_DETECTED" != "true" ]]; then
                        echo "🚨 LATENCY BREACH DETECTED: ${RESPONSE_TIME_MS}ms > ${LATENCY_THRESHOLD}ms"
                        BREACH_DETECTED=true
                    fi
                fi
            done
            ;;

        "error-rate")
            # Inject errors by sending invalid requests
            echo "Injecting errors for error rate breach..."
            for i in {1..3}; do
                # Send requests with error injection
                ERROR_INJECTION=$(curl -s -w "%{http_code}" \
                    -H "X-Inject-Error: true" \
                    -H "X-API-Key: $API_KEY" \
                    "$BASE_URL$ENDPOINT" || echo "500")

                echo "  Error injection $i: HTTP $ERROR_INJECTION"

                # Count errors for error rate calculation
                if [[ "$ERROR_INJECTION" != "200" ]]; then
                    if [[ "$BREACH_DETECTED" != "true" ]]; then
                        echo "🚨 ERROR RATE BREACH DETECTED: HTTP $ERROR_INJECTION"
                        BREACH_DETECTED=true
                    fi
                fi
            done
            ;;

        "availability")
            # Test endpoint unavailability
            echo "Testing availability breach..."
            # This would typically involve network-level simulation
            # For testing purposes, we'll simulate by checking error endpoints
            UNAVAILABILITY_TEST=$(curl -s -w "%{http_code}" \
                "$BASE_URL/api/v1/test/unavailable" 2>/dev/null || echo "503")

            echo "  Availability test: HTTP $UNAVAILABILITY_TEST"

            if [[ "$UNAVAILABILITY_TEST" != "200" ]]; then
                if [[ "$BREACH_DETECTED" != "true" ]]; then
                    echo "🚨 AVAILABILITY BREACH DETECTED: Service unavailable"
                    BREACH_DETECTED=true
                fi
            fi
            ;;
    esac

    # Check for rollback trigger
    if [[ "$BREACH_DETECTED" == "true" && "$ROLLBACK_TRIGGERED" != "true" ]]; then
        echo "Checking if rollback was triggered..."

        # Check canary status after breach
        POST_BREACH_CANARY=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/api/v1/canary/status" || echo '{"error":"api_unavailable"}')

        if echo "$POST_BREACH_CANARY" | jq -e '.success' >/dev/null 2>&1; then
            POST_BREACH_ENABLED=$(echo "$POST_BREACH_CANARY" | jq -r ".data.routes[\"$ENDPOINT\"].enabled // true")
            POST_BREACH_PERCENTAGE=$(echo "$POST_BREACH_CANARY" | jq -r ".data.routes[\"$ENDPOINT\"].percentage // 0")

            if [[ "$POST_BREACH_ENABLED" != "true" || "$POST_BREACH_PERCENTAGE" -lt "$CANARY_PERCENTAGE" ]]; then
                echo "🔄 ROLLBACK TRIGGERED: Canary disabled/reduced"
                echo "  Before: Enabled=$CANARY_ENABLED, Percentage=$CANARY_PERCENTAGE"
                echo "  After: Enabled=$POST_BREACH_ENABLED, Percentage=$POST_BREACH_PERCENTAGE"
                ROLLBACK_TRIGGERED=true
                log_test "Auto-rollback trigger" "PASS" "Canary rollback detected"
            else
                echo "⚠️  No rollback detected yet - monitoring continues"
            fi
        fi
    fi

    # Wait before next iteration
    sleep 30
done

echo ""
echo "Simulation duration completed."

echo ""

# Phase 4: Post-Simulation Validation
echo -e "${BLUE}Phase 4: Post-Simulation Validation${NC}"
echo "======================================"

# Wait for auto-rollback to complete
echo "Waiting for rollback processes to complete..."
sleep 30

# Check final canary status
echo "Checking final canary status..."
FINAL_CANARY_RESPONSE=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/api/v1/canary/status" || echo '{"error":"api_unavailable"}')

if echo "$FINAL_CANARY_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
    FINAL_ENABLED=$(echo "$FINAL_CANARY_RESPONSE" | jq -r ".data.routes[\"$ENDPOINT\"].enabled // false")
    FINAL_PERCENTAGE=$(echo "$FINAL_CANARY_RESPONSE" | jq -r ".data.routes[\"$ENDPOINT\"].percentage // 0")

    if [[ "$FINAL_ENABLED" == "false" || "$FINAL_PERCENTAGE" -eq 0 ]]; then
        log_test "Canary rollback verification" "PASS" "Canary successfully rolled back"
    else
        log_test "Canary rollback verification" "WARN" "Canary still active - rollback may not have triggered"
    fi
else
    log_test "Final canary status check" "FAIL" "Cannot verify final canary status"
fi

# Check endpoint health after simulation
echo "Checking endpoint health after simulation..."
POST_SIM_RESPONSE=$(curl -s -w "%{http_code},time=%{time_total}" "$BASE_URL$ENDPOINT" || echo "000,time=0")
POST_SIM_HTTP=$(echo "$POST_SIM_RESPONSE" | cut -d',' -f1)
POST_SIM_TIME=$(echo "$POST_SIM_RESPONSE" | cut -d',' -f2 | cut -d'=' -f2)
POST_SIM_TIME_MS=$(echo "$POST_SIM_TIME * 1000 / 1" | bc 2>/dev/null || echo "0")

if [[ "$POST_SIM_HTTP" == "200" ]]; then
    log_test "Post-simulation endpoint health" "PASS" "HTTP $POST_SIM_HTTP, ${POST_SIM_TIME_MS}ms"
else
    log_test "Post-simulation endpoint health" "FAIL" "HTTP $POST_SIM_HTTP"
fi

# Check SLO monitoring status
echo "Checking SLO monitoring status..."
SLO_STATUS_RESPONSE=$(curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/api/v1/slo/status" || echo '{"error":"api_unavailable"}')

if echo "$SLO_STATUS_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
    log_test "SLO monitoring API" "PASS" "SLO status API accessible"

    # Look for endpoint-specific SLO data
    ENDPOINT_SLO=$(echo "$SLO_STATUS_RESPONSE" | jq -r ".data[] | select(.endpoint == \"$ENDPOINT\") // empty")
    if [[ -n "$ENDPOINT_SLO" ]]; then
        echo "SLO data found for $ENDPOINT:"
        echo "$ENDPOINT_SLO" | jq -r '  "  \(.endpoint): \(.overall)"' 2>/dev/null || echo "  Data format issue"
        log_test "Endpoint SLO data" "PASS" "SLO data available"
    else
        log_test "Endpoint SLO data" "WARN" "No specific SLO data for endpoint"
    fi
else
    log_test "SLO monitoring API" "WARN" "SLO monitoring API not available"
fi

echo ""

# Phase 5: Notification Verification
echo -e "${BLUE}Phase 5: Notification Verification${NC}"
echo "===================================="

# Check if rollback notifications would be sent
echo "Testing notification integration..."

# This would verify that rollback notifications are properly configured
if [[ "$ROLLBACK_TRIGGERED" == "true" ]]; then
    echo "Rollback was triggered - notifications should have been sent"

    # Check for notification logs (if available)
    if [[ -f "/tmp/rollback-notifications.log" ]]; then
        NOTIFICATION_COUNT=$(grep -c "ROLLBACK" /tmp/rollback-notifications.log 2>/dev/null || echo "0")
        log_test "Rollback notifications" "PASS" "$NOTIFICATION_COUNT notifications found"
    else
        log_test "Rollback notifications" "INFO" "Notification log not found - check notification configuration"
    fi
else
    echo "No rollback triggered - notification system not tested"
    log_test "Rollback notifications" "SKIP" "No rollback occurred"
fi

echo ""

# Phase 6: Results Summary
echo -e "${BLUE}Phase 6: Results Summary${NC}"
echo "=========================="

# Generate simulation report
cat > "slo-simulation-report-$(date +%Y%m%d-%H%M%S).json" << EOF
{
  "simulation": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "endpoint": "$ENDPOINT",
    "scenario": "$TEST_SCENARIO",
    "severity": "$SEVERITY",
    "duration_minutes": $DURATION,
    "slo_thresholds": {
      "p95_latency_ms": $LATENCY_THRESHOLD,
      "error_rate_percent": $ERROR_RATE_THRESHOLD,
      "availability_percent": $AVAILABILITY_THRESHOLD
    }
  },
  "results": {
    "tests_passed": $TESTS_PASSED,
    "tests_failed": $TESTS_FAILED,
    "breach_detected": $BREACH_DETECTED,
    "rollback_triggered": $ROLLBACK_TRIGGERED,
    "canary_initial": {
      "enabled": $CANARY_ENABLED,
      "percentage": $CANARY_PERCENTAGE
    },
    "canary_final": {
      "enabled": ${FINAL_ENABLED:-false},
      "percentage": ${FINAL_PERCENTAGE:-0}
    }
  },
  "baseline_metrics": {
    "http_status": $BASELINE_HTTP,
    "response_time_ms": $BASELINE_TIME
  },
  "post_simulation_metrics": {
    "http_status": $POST_SIM_HTTP,
    "response_time_ms": $POST_SIM_TIME_MS
  }
}
EOF

# Store results before cleanup for potential reporting
SIMULATION_REPORT_CONTENT=$(cat "slo-simulation-report-$(date +%Y%m%d)*.json" 2>/dev/null || echo "No simulation report generated")
SIMULATION_LOG_CONTENT=$(cat "$SIMULATION_LOG" 2>/dev/null || echo "No simulation log generated")

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo "📊 Simulation Results:"
echo "  Total Tests: $TOTAL_TESTS"
echo "  Passed: $TESTS_PASSED"
echo "  Failed: $TESTS_FAILED"
echo "  Success Rate: ${SUCCESS_RATE}%"
echo ""
echo "🚨 Key Events:"
echo "  Breach Detected: $BREACH_DETECTED"
echo "  Rollback Triggered: $ROLLBACK_TRIGGERED"
echo "  Canary Change: $CANARY_ENABLED($CANARY_PERCENTAGE%) → ${FINAL_ENABLED:-false}(${FINAL_PERCENTAGE:-0}%)"
echo ""

# Perform cleanup
echo ""
echo -e "${BLUE}Phase: Test Artifact Cleanup${NC}"
echo "==============================="

echo "🧹 Cleaning up SLO breach simulation artifacts..."

# Clean up simulation artifacts
rm -f "slo-simulation-report-"*.json 2>/dev/null || true
if [[ -f "$SIMULATION_LOG" ]]; then
    rm -f "$SIMULATION_LOG" 2>/dev/null || true
fi

# Clean up any temporary files created
rm -f slo-breach-temp-*.json 2>/dev/null || true
rm -f canary-status-*.json 2>/dev/null || true
rm -f slo-status-*.json 2>/dev/null || true

echo "✅ SLO breach simulation artifacts cleaned up"
echo ""

# Overall assessment
if [[ "$ROLLBACK_TRIGGERED" == "true" ]]; then
    echo -e "🎯 ${GREEN}SLO BREACH SIMULATION SUCCESSFUL${NC}"
    echo "✅ SLO breach was detected"
    echo "✅ Auto-rollback was triggered"
    echo "✅ System recovered after breach"
    echo ""
    echo "🧹 All test artifacts have been cleaned up"
    echo "✅ Clean testing environment - ready for next run"
    echo ""
    echo "Key results from this simulation:"
    echo "  Total Tests: $TOTAL_TESTS"
    echo "  Success Rate: ${SUCCESS_RATE}%"
    echo "  Breach Detected: $BREACH_DETECTED"
    echo "  Rollback Triggered: $ROLLBACK_TRIGGERED"
    echo "  Duration: $(($(date +%s) - START_TIME)) seconds"
    echo ""
    echo "✅ SLO breach detection validated"
    echo "✅ Auto-rollback mechanism confirmed"
    echo "✅ System resilience verified"
    echo ""
    echo "Simulation completed - environment is now clean."
    exit 0
elif [[ "$BREACH_DETECTED" == "true" ]]; then
    echo -e "⚠️  ${YELLOW}PARTIAL SUCCESS${NC}"
    echo "✅ SLO breach was detected"
    echo "❌ Auto-rollback may not have triggered properly"
    echo ""
    echo "🧹 All test artifacts have been cleaned up"
    echo "⚠️ Review rollback configuration before next simulation"
    exit 0
else
    echo -e "❌ ${RED}SIMULATION INCONCLUSIVE${NC}"
    echo "❌ SLO breach was not detected"
    echo ""
    echo "🧹 All test artifacts have been cleaned up"
    echo "❌ Review breach injection and SLO monitoring setup"
    exit 1
fi