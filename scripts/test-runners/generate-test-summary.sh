#!/bin/bash

# Test Summary Generator
# Generates test-summary.json files that conform to test-summary-schema.json

set -euo pipefail

# Create run-scoped temp dir and ensure cleanup for temporary generation assets
RUN_TMPDIR=".ci-tmp/${GITHUB_RUN_ID:-local}-summary-gen-$$"
mkdir -p "$RUN_TMPDIR"
export TMPDIR="$RUN_TMPDIR"
cleanup() {
  # Keep test-summary.json in CWD if generated, remove temp assets
  find "$RUN_TMPDIR" -mindepth 1 -maxdepth 1 -print0 2>/dev/null | xargs -0 rm -rf -- 2>/dev/null || true
  rmdir "$RUN_TMPDIR" 2>/dev/null || true
}
trap cleanup EXIT

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_NAME="${1:-Test Script}"
TEST_VERSION="${2:-1.0.0}"
OUTPUT_FILE="${3:-test-summary.json}"
MODE="${4:-generate}"  # generate, validate, update

echo -e "${BLUE}📝 Test Summary Generator${NC}"
echo "==========================="
echo "Test Name: $TEST_NAME"
echo "Test Version: $TEST_VERSION"
echo "Output File: $OUTPUT_FILE"
echo "Mode: $MODE"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Generate UUID for execution ID
EXECUTION_ID=$(uuidgen 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null || echo "exec-$(date +%s)-$$")

# Environment information
RUNNER_OS="${RUNNER_OS:-$(uname -s)}"
NODE_VERSION="${NODE_VERSION:-$(node --version 2>/dev/null || echo 'N/A')}"
NPM_VERSION="${NPM_VERSION:-$(npm --version 2>/dev/null || echo 'N/A')}"
GIT_COMMIT="${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"
GIT_BRANCH="${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')}"

# Initialize test metrics
START_TIME=$(date +%s)
METRICS_FILE="/tmp/test-metrics-$$"

# Initialize metrics tracking
initialize_metrics() {
    cat > "$METRICS_FILE" << EOF
{
    "tests": [],
    "performance": {},
    "build": {},
    "security": {},
    "compliance": {},
    "request_ids": [],
    "failed_tests": [],
    "warnings": [],
    "recommendations": [],
    "artifacts": {
        "logs": [],
        "reports": [],
        "screenshots": []
    }
}
EOF
}

# Record test start
record_test_start() {
    local test_name="$1"
    local start_time=$(date +%s%3N)

    echo "📊 Starting test: $test_name"

    # Add to metrics
    local temp_file="/tmp/metrics-temp-$$"
    jq --arg name "$test_name" --arg start "$start_time" '.tests += [{"name": $name, "start": ($start | tonumber), "status": "running"}]' "$METRICS_FILE" > "$temp_file"
    mv "$temp_file" "$METRICS_FILE"
}

# Record test completion
record_test_result() {
    local test_name="$1"
    local status="$2"  # PASS, FAIL, WARN, ERROR
    local error_message="${3:-}"
    local duration_ms="${4:-0}"

    local end_time=$(date +%s%3N)

    echo "📊 Recording result: $test_name = $status (${duration_ms}ms)"

    # Update test entry
    local temp_file="/tmp/metrics-temp-$$"
    jq --arg name "$test_name" --arg status "$status" --arg error "$error_message" --arg duration "$duration_ms" --arg end "$end_time" '
        .tests = [.tests[] | if .name == $name then
            . + {"status": $status, "end": ($end | tonumber), "duration_ms": ($duration | tonumber), "error_message": $error}
        else . end]' "$METRICS_FILE" > "$temp_file"
    mv "$temp_file" "$METRICS_FILE"

    # Add to failed tests if applicable
    if [[ "$status" == "FAIL" || "$status" == "ERROR" ]]; then
        jq --arg name "$test_name" --arg error "$error_message" --arg duration "$duration_ms" --arg type "assertion" '
            .failed_tests += [{"name": $name, "error_message": $error, "duration_ms": ($duration | tonumber), "error_type": $type}]' "$METRICS_FILE" > "$temp_file"
        mv "$temp_file" "$METRICS_FILE"
    fi
}

# Add performance metrics
add_performance_metric() {
    local metric_name="$1"
    local value="$2"

    local temp_file="/tmp/metrics-temp-$$"
    jq --arg name "$metric_name" --arg val "$value" '.performance[$name] = ($val | tonumber)' "$METRICS_FILE" > "$temp_file"
    mv "$temp_file" "$METRICS_FILE"
}

# Add warning
add_warning() {
    local test_name="$1"
    local warning_message="$2"
    local warning_type="${3:-configuration}"
    local recommendation="${4:-}"

    local temp_file="/tmp/metrics-temp-$$"
    jq --arg test "$test_name" --arg message "$warning_message" --arg type "$warning_type" --arg rec "$recommendation" '
        .warnings += [{"test_name": $test, "warning_message": $message, "warning_type": $type, "recommendation": $rec}]' "$METRICS_FILE" > "$temp_file"
    mv "$temp_file" "$METRICS_FILE"
}

# Add recommendation
add_recommendation() {
    local category="$1"
    local priority="$2"
    local title="$3"
    local description="$4"
    local effort="${5:-}"

    local temp_file="/tmp/metrics-temp-$$"
    jq --arg cat "$category" --arg pri "$priority" --arg ttl "$title" --arg desc "$description" --arg eff "$effort" '
        .recommendations += [{"category": $cat, "priority": $pri, "title": $ttl, "description": $desc, "estimated_effort": $eff}]' "$METRICS_FILE" > "$temp_file"
    mv "$temp_file" "$METRICS_FILE"
}

# Generate final test summary
generate_summary() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))

    # Calculate test statistics
    local total_tests=$(jq '.tests | length' "$METRICS_FILE")
    local tests_passed=$(jq '.tests[] | select(.status == "PASS") | length' "$METRICS_FILE")
    local tests_failed=$(jq '.tests[] | select(.status == "FAIL" or .status == "ERROR") | length' "$METRICS_FILE")
    local tests_warned=$(jq '.tests[] | select(.status == "WARN") | length' "$METRICS_FILE")
    local tests_skipped=$(jq '.tests[] | select(.status == "SKIP") | length' "$METRICS_FILE")

    # Calculate success rate
    local success_rate=0
    if [[ $total_tests -gt 0 ]]; then
        success_rate=$((tests_passed * 100 / total_tests))
    fi

    # Determine overall status
    local overall_status="PASS"
    if [[ $tests_failed -gt 0 ]]; then
        overall_status="FAIL"
    elif [[ $tests_warned -gt 0 ]]; then
        overall_status="WARN"
    fi

    # Calculate performance metrics
    local slowest_test=$(jq -r '.tests[] | select(.duration_ms) | "\(.duration_ms) \(.name)"' "$METRICS_FILE" | sort -nr | head -1 | cut -d' ' -f2- || echo "N/A")
    local fastest_test=$(jq -r '.tests[] | select(.duration_ms) | "\(.duration_ms) \(.name)"' "$METRICS_FILE" | sort -n | head -1 | cut -d' ' -f2- || echo "N/A")
    local avg_duration=$(jq -r '[.tests[] | select(.duration_ms) | .duration_ms] | add / (.tests | length) // 0' "$METRICS_FILE")

    # Generate final summary JSON
    cat > "$OUTPUT_FILE" << EOF
{
  "test_metadata": {
    "test_name": "$TEST_NAME",
    "test_version": "$TEST_VERSION",
    "execution_id": "$EXECUTION_ID",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "duration_seconds": $duration,
    "environment": {
      "runner_os": "$RUNNER_OS",
      "node_version": "$NODE_VERSION",
      "npm_version": "$NPM_VERSION",
      "git_commit": "$GIT_COMMIT",
      "git_branch": "$GIT_BRANCH",
      "test_mode": "validation"
    }
  },
  "test_results": {
    "total_tests": $total_tests,
    "tests_passed": $tests_passed,
    "tests_failed": $tests_failed,
    "tests_skipped": $tests_skipped,
    "tests_warned": $tests_warned,
    "success_rate": $success_rate,
    "overall_status": "$overall_status"
  },
  "key_metrics": {
    "performance": {
      "slowest_test": {
        "name": "$(echo "$slowest_test" | sed 's/^[0-9]* //')",
        "duration_ms": $(echo "$slowest_test" | cut -d' ' -f1 || echo "0"),
        "status": "completed"
      },
      "fastest_test": {
        "name": "$(echo "$fastest_test" | sed 's/^[0-9]* //')",
        "duration_ms": $(echo "$fastest_test" | cut -d' ' -f1 || echo "0"),
        "status": "completed"
      },
      "average_test_duration_ms": $avg_duration
    },
    "build_metrics": {
      "build_duration_seconds": $(jq -r '.build.duration // 0' "$METRICS_FILE"),
      "build_artifact_size_bytes": $(jq -r '.build.artifact_size // 0' "$METRICS_FILE"),
      "build_artifact_count": $(jq -r '.build.artifact_count // 0' "$METRICS_FILE")
    },
    "security_metrics": {
      "vulnerabilities_found": $(jq -r '.security.vulnerabilities // 0' "$METRICS_FILE"),
      "high_severity_vulns": $(jq -r '.security.high_severity // 0' "$METRICS_FILE"),
      "dependencies_scanned": $(jq -r '.security.dependencies_scanned // 0' "$METRICS_FILE")
    },
    "compliance_metrics": {
      "exemptions_found": $(jq -r '.compliance.exemptions_found // 0' "$METRICS_FILE"),
      "exemptions_expired": $(jq -r '.compliance.exemptions_expired // 0' "$METRICS_FILE"),
      "policy_violations": $(jq -r '.compliance.policy_violations // 0' "$METRICS_FILE")
    }
  },
  "request_ids": $(jq '.request_ids' "$METRICS_FILE"),
  "failed_tests": $(jq '.failed_tests' "$METRICS_FILE"),
  "warnings": $(jq '.warnings' "$METRICS_FILE"),
  "recommendations": $(jq '.recommendations' "$METRICS_FILE"),
  "artifacts": {
    "logs": $(jq '.artifacts.logs' "$METRICS_FILE"),
    "reports": $(jq '.artifacts.reports' "$METRICS_FILE"),
    "screenshots": $(jq '.artifacts.screenshots' "$METRICS_FILE")
  },
  "ci_annotations": {
    "pull_request_comments": [],
    "check_run_annotations": [
      {
        "name": "Test Summary Validation",
        "status": "completed",
        "conclusion": "$overall_status",
        "title": "$TEST_NAME - $overall_status",
        "summary": "Test execution completed with ${success_rate}% success rate. ${tests_passed} passed, ${tests_failed} failed, ${tests_warned} warned."
      }
    ]
  }
}
EOF

    echo "✅ Test summary generated: $OUTPUT_FILE"
}

# Validate generated summary
validate_summary() {
    if [[ ! -f "$OUTPUT_FILE" ]]; then
        echo "❌ Output file not found: $OUTPUT_FILE"
        return 1
    fi

    # Validate JSON syntax
    if ! jq empty "$OUTPUT_FILE" 2>/dev/null; then
        echo "❌ Invalid JSON in output file"
        return 1
    fi

    # Validate against schema
    echo "🔍 Validating generated summary against schema..."
    ./ci-schema-validation.sh test-summary-schema.json "$OUTPUT_FILE" "warn"

    echo "✅ Summary validation completed"
}

# Main execution
case "$MODE" in
    "generate")
        echo "🚀 Generating test summary template..."
        initialize_metrics
        generate_summary
        validate_summary
        ;;
    "validate")
        echo "🔍 Validating existing test summary..."
        validate_summary
        ;;
    "update")
        echo "📝 Updating existing test summary..."
        if [[ -f "$OUTPUT_FILE" ]]; then
            # Update timestamp and execution metadata
            local temp_file="/tmp/summary-temp-$$"
            jq --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg exec_id "$EXECUTION_ID" '
                .test_metadata.timestamp = $timestamp |
                .test_metadata.execution_id = $exec_id |
                .test_metadata.duration_seconds = (now | floor - (.test_metadata.timestamp | fromdateiso8601 | floor))' "$OUTPUT_FILE" > "$temp_file"
            mv "$temp_file" "$OUTPUT_FILE"
            echo "✅ Test summary updated"
            validate_summary
        else
            echo "❌ No existing test summary found at: $OUTPUT_FILE"
            exit 1
        fi
        ;;
    *)
        echo "❌ Invalid mode: $MODE"
        echo "Valid modes: generate, validate, update"
        exit 1
        ;;
esac

# Cleanup
rm -f "$METRICS_FILE" "/tmp/metrics-temp-$$" "/tmp/summary-temp-$$" 2>/dev/null || true

echo ""
echo "📋 Test Summary Generator completed successfully!"
echo "Output: $OUTPUT_FILE"
echo "Schema compliance: ✅ Validated"