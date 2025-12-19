#!/bin/bash

# Regression Test Runner for DAC Service Binding Integration
# Automated testing with baseline comparison and regression detection

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_SCRIPT="$SCRIPT_DIR/../integration/dac/test-dac-service-binding-comprehensive.sh"
BASELINE_DIR="$SCRIPT_DIR/baselines"
CURRENT_DATE=$(date +%Y%m%d)
REPORT_DIR="$SCRIPT_DIR/test-reports"
CURRENT_REPORT="$REPORT_DIR/dac-regression-report-$CURRENT_DATE.html"
API_URL="https://tft-trading-system.yanggf.workers.dev"
# Use unified X_API_KEY; no insecure defaults
API_KEY="${X_API_KEY:-}"
if [[ -z "$API_KEY" ]]; then
  error "X_API_KEY environment variable is not set (required)"
  exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    log "ERROR: $1"
}

success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
    log "SUCCESS: $1"
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
    log "WARNING: $1"
}

info() {
    echo -e "${BLUE}INFO: $1${NC}"
    log "INFO: $1"
}

# Create directories
create_directories() {
    mkdir -p "$BASELINE_DIR"
    mkdir -p "$REPORT_DIR"
    info "Created directories: $BASELINE_DIR, $REPORT_DIR"
}

# Check dependencies
check_dependencies() {
    info "Checking dependencies..."

    local missing=()

    if ! command -v curl >/dev/null 2>&1; then
        missing+=("curl")
    fi

    if ! command -v jq >/dev/null 2>&1; then
        missing+=("jq")
    fi

    if ! command -v bc >/dev/null 2>&1; then
        missing+=("bc")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        error "Missing dependencies: ${missing[*]}"
        info "Install with: apt-get install ${missing[*]}"
        exit 1
    fi

    success "All dependencies available"
}

# Check API connectivity
check_api_connectivity() {
    info "Checking API connectivity to $API_URL..."

    if curl -s --max-time 10 "$API_URL/health" >/dev/null 2>&1; then
        success "API is reachable"
        return 0
    else
        error "API is not reachable at $API_URL"
        return 1
    fi
}

# Save current test results as baseline
save_baseline() {
    local baseline_name="$1"
    local baseline_file="$BASELINE_DIR/dac-service-binding-baseline-$baseline_name.json"

    info "Saving baseline: $baseline_name"

    # Run the integration test in baseline mode with API_KEY
    if X_API_KEY="$API_KEY" "$TEST_SCRIPT" baseline > /dev/null 2>&1; then
        # Find the most recent JSON report
        local latest_report=$(find "$REPORT_DIR" -name "dac-service-binding-test-*.json" -type f -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)

        if [[ -f "$latest_report" ]]; then
            cp "$latest_report" "$baseline_file"
            # Create symlink for CI compatibility
            local ci_baseline="$BASELINE_DIR/dac-service-binding-baseline.json"
            ln -sf "$(basename "$baseline_file")" "$ci_baseline"
            success "Baseline saved: $baseline_name from $latest_report"
            success "CI baseline symlink created: $ci_baseline -> $baseline_file"
            return 0
        else
            error "Failed to find test report for baseline"
            return 1
        fi
    else
        error "Failed to create baseline: $baseline_name"
        return 1
    fi
}

# Extract key metrics from JSON report
extract_metrics_from_report() {
    local report_file="$1"

    if [[ ! -f "$report_file" ]]; then
        echo "{}"
        return 1
    fi

    # Extract metrics using jq
    jq '{
        timestamp: .timestamp,
        tests: .summary,
        performance: {
            avg_duration: (.performance_metrics | map(select(.status == "PASS")) | map(.duration_ms) | add / length),
            cache_hit_rate: (.tests[] | select(.name == "L1 Cache Hit Rate") | .hit_rate // null),
            service_binding_p50: (.tests[] | select(.name == "Service Binding Latency") | .p50_ms // null)
        }
    }' "$report_file" 2>/dev/null || echo "{}"
}

# Compare current results with baseline
compare_with_baseline() {
    local baseline_name="$1"
    local baseline_file="$BASELINE_DIR/dac-service-binding-baseline-$baseline_name.json"

    if [[ ! -f "$baseline_file" ]]; then
        warning "Baseline not found: $baseline_name"
        return 1
    fi

    info "Comparing with baseline: $baseline_name"

    # Run current tests with API_KEY
    X_API_KEY="$API_KEY" "$TEST_SCRIPT" run > /dev/null 2>&1
    local current_exit_code=$?

    # Find the most recent test report
    local current_report=$(find "$REPORT_DIR" -name "dac-service-binding-test-*.json" -type f -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)

    if [[ ! -f "$current_report" ]]; then
        error "Failed to find current test report"
        return 3
    fi

    # Extract metrics
    local baseline_metrics=$(extract_metrics_from_report "$baseline_file")
    local current_metrics=$(extract_metrics_from_report "$current_report")

    # Compare metrics
    local comparison=$(compare_metrics "$baseline_metrics" "$current_metrics")

    # Generate comparison report
    generate_comparison_report "$baseline_name" "$baseline_metrics" "$current_metrics" "$comparison" "$current_report"

    # Enforce hard thresholds in addition to regression
    local current_cache_hit=$(echo "$current_metrics" | jq -r '.performance.cache_hit_rate // 0')
    local current_p50=$(echo "$current_metrics" | jq -r '.performance.service_binding_p50 // 999999')

    if (( $(echo "$current_cache_hit < 93" | bc -l) )); then
        error "Cache hit rate below threshold: ${current_cache_hit}% (<93%)"
        return 2
    fi
    if (( $(echo "$current_p50 >= 100" | bc -l) )); then
        error "Service binding p50 latency above threshold: ${current_p50}ms (>=100ms)"
        return 2
    fi

    # Check for regressions (5% threshold)
    if has_regression "$comparison"; then
        error "Performance regression detected (>5% degradation) compared to baseline: $baseline_name"
        return 2
    else
        success "No regressions detected and thresholds met compared to baseline: $baseline_name"
        return 0
    fi
}

# Compare metrics between baseline and current using jq
compare_metrics() {
    local baseline="$1"
    local current="$2"

    # Use jq to extract success rates and performance metrics
    local baseline_success_rate=$(echo "$baseline" | jq -r '.tests.success_rate // 0')
    local current_success_rate=$(echo "$current" | jq -r '.tests.success_rate // 0')

    local baseline_avg_duration=$(echo "$baseline" | jq -r '.performance.avg_duration // 0')
    local current_avg_duration=$(echo "$current" | jq -r '.performance.avg_duration // 0')

    local baseline_cache_hit_rate=$(echo "$baseline" | jq -r '.performance.cache_hit_rate // 0')
    local current_cache_hit_rate=$(echo "$current" | jq -r '.performance.cache_hit_rate // 0')

    local baseline_latency=$(echo "$baseline" | jq -r '.performance.service_binding_p50 // 0')
    local current_latency=$(echo "$current" | jq -r '.performance.service_binding_p50 // 0')

    local success_rate_change=$(echo "scale=2; $current_success_rate - $baseline_success_rate" | bc -l)

    cat <<EOF
{
  "success_rate": {
    "baseline": $baseline_success_rate,
    "current": $current_success_rate,
    "change": $success_rate_change
  },
  "performance": {
    "avg_duration_ms": {
      "baseline": $baseline_avg_duration,
      "current": $current_avg_duration,
      "change": $(echo "scale=2; $current_avg_duration - $baseline_avg_duration" | bc -l)
    },
    "cache_hit_rate": {
      "baseline": $baseline_cache_hit_rate,
      "current": $current_cache_hit_rate,
      "change": $(echo "scale=2; $current_cache_hit_rate - $baseline_cache_hit_rate" | bc -l)
    },
    "service_binding_p50": {
      "baseline": $baseline_latency,
      "current": $current_latency,
      "change": $(echo "scale=2; $current_latency - $baseline_latency" | bc -l)
    }
  }
}
EOF
}

# Check if regression exists (5% threshold for success rate)
has_regression() {
    local comparison="$1"

    # Check for significant performance degradation
    local success_rate_change=$(echo "$comparison" | jq -r '.success_rate.change // 0')

    # Regression if success rate dropped by more than 5%
    if (( $(echo "$success_rate_change < -5" | bc -l) )); then
        return 0
    fi

    return 1
}

# Generate HTML comparison report
generate_comparison_report() {
    local baseline_name="$1"
    local baseline_metrics="$2"
    local current_metrics="$3"
    local comparison="$4"
    local current_log="$5"

    local report_html="$CURRENT_REPORT"

    # Extract values for report
    local baseline_success_rate=$(echo "$baseline_metrics" | grep -o '"success_rate": [0-9.]*' | cut -d: -f2 | tr -d ' ')
    local current_success_rate=$(echo "$current_metrics" | grep -o '"success_rate": [0-9.]*' | cut -d: -f2 | tr -d ' ')
    local success_rate_change=$(echo "$comparison" | grep -o '"change": [0-9.-]*' | cut -d: -f2 | tr -d ' ')

    local baseline_health=$(echo "$baseline_metrics" | grep -o '"health_score": "[^"]*"' | cut -d: -f2 | tr -d '" ')
    local current_health=$(echo "$current_metrics" | grep -o '"health_score": "[^"]*"' | cut -d: -f2 | tr -d '" ')

    local baseline_ops=$(echo "$baseline_metrics" | grep -o '"ops_per_second": "[^"]*"' | cut -d: -f2 | tr -d '" ')
    local current_ops=$(echo "$current_metrics" | grep -o '"ops_per_second": "[^"]*"' | cut -d: -f2 | tr -d '" ')

    # Determine status
    local status="PASS"
    local status_color="green"
    if has_regression "$comparison"; then
        status="REGRESSION"
        status_color="red"
    elif (( $(echo "$success_rate_change < -5" | bc -l) )); then
        status="WARNING"
        status_color="orange"
    fi

    # Generate HTML report
    cat > "$report_html" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Enhanced Cache Regression Report - $CURRENT_DATE</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .status { font-size: 24px; font-weight: bold; color: $status_color; }
        .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .metric { background: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #ddd; }
        .metric.improvement { border-left-color: green; }
        .metric.regression { border-left-color: red; }
        .log { background: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 12px; max-height: 400px; overflow-y: auto; }
        .change { font-weight: bold; }
        .positive { color: green; }
        .negative { color: red; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Enhanced Cache System Regression Report</h1>
        <div class="status">$status</div>
        <p>Generated: $(date)</p>
        <p>Baseline: $baseline_name | API: $API_URL</p>
    </div>

    <h2>Test Results Comparison</h2>
    <table>
        <tr><th>Metric</th><th>Baseline</th><th>Current</th><th>Change</th><th>Status</th></tr>
        <tr>
            <td>Success Rate</td><td>${baseline_success_rate}%</td><td>${current_success_rate}%</td>
            <td class="change $(echo "$success_rate_change > 0" | bc -l | grep -q "1" && echo "positive" || echo "negative")">${success_rate_change}%</td>
            <td>$(echo "$success_rate_change >= -5" | bc -l | grep -q "1" && echo "✅ Good" || echo "⚠️ Check")</td>
        </tr>
        <tr>
            <td>Health Score</td><td>$baseline_health</td><td>$current_health</td>
            <td>-</td>
            <td>$(echo "$current_health" | grep -q "^[0-9]" && echo "$current_health >= $baseline_health" | bc -l | grep -q "1" && echo "✅ Good" || echo "⚠️ Check")</td>
        </tr>
        <tr>
            <td>Performance</td><td>$baseline_ops ops/sec</td><td>$current_ops ops/sec</td>
            <td>-</td>
            <td>$(echo "$current_ops" | grep -q "^[0-9]" && echo "$current_ops >= $baseline_ops" | bc -l | grep -q "1" && echo "✅ Good" || echo "⚠️ Check")</td>
        </tr>
    </table>

    <h2>Latest Test Log</h2>
    <div class="log">
EOF

    # Add recent log entries
    tail -50 "$current_log" | sed 's/&/&amp;/g; s/</&lt;/g; s/>/&gt;/g' >> "$report_html"

    cat >> "$report_html" <<EOF
    </div>

    <div class="header">
        <p><small>Regression Report generated by Enhanced Cache Test Suite</small></p>
    </div>
</body>
</html>
EOF

    success "Regression report generated: $report_html"
}

# List available baselines
list_baselines() {
    info "Available DAC baselines:"
    if [[ -d "$BASELINE_DIR" && -n "$(ls -A "$BASELINE_DIR" 2>/dev/null)" ]]; then
        # Show active CI baseline first
        local ci_baseline="$BASELINE_DIR/dac-service-binding-baseline.json"
        if [[ -f "$ci_baseline" ]] && [[ -L "$ci_baseline" ]]; then
            local target=$(readlink "$ci_baseline")
            local name=$(basename "$target" .json | sed 's/dac-service-binding-baseline-//')
            local timestamp=$(jq -r '.timestamp // "unknown"' "$ci_baseline")
            local success_rate=$(jq -r '.summary.success_rate // 0' "$ci_baseline")
            echo "  → $name (ACTIVE for CI, timestamp: $timestamp, success rate: ${success_rate}%)"
        fi

        # Show all named baselines
        for baseline in "$BASELINE_DIR"/dac-service-binding-baseline-*.json; do
            if [[ -f "$baseline" ]]; then
                local name=$(basename "$baseline" .json | sed 's/dac-service-binding-baseline-//')
                local timestamp=$(jq -r '.timestamp // "unknown"' "$baseline")
                local success_rate=$(jq -r '.summary.success_rate // 0' "$baseline")
                if [[ "$ci_baseline" && "$(readlink "$ci_baseline" 2>/dev/null)" == "$(basename "$baseline")" ]]; then
                    # Skip the active one since we already showed it
                    continue
                fi
                echo "  - $name (timestamp: $timestamp, success rate: ${success_rate}%)"
            fi
        done
    else
        echo "  No DAC baselines found"
    fi
}

# Show usage
show_usage() {
    cat <<EOF
Enhanced Cache Regression Test Runner

Usage: $0 <command> [options]

Commands:
  baseline <name>           Save current test results as baseline
  compare <name>            Compare current results with baseline
  run                       Run integration tests only
  report                    Generate HTML report (requires comparison)
  list                      List available baselines
  help                      Show this help

Examples:
  $0 baseline v1.0          # Create baseline named 'v1.0'
  $0 compare v1.0           # Compare current results with v1.0 baseline
  $0 run                    # Just run tests without comparison

Environment Variables:
  API_URL                   Override API URL (default: $API_URL)
  API_KEY                   Override API key (default: yanggf)

EOF
}

# Main execution
main() {
    local command="${1:-}"
    local arg="${2:-}"

    case "$command" in
        "baseline")
            if [[ -z "$arg" ]]; then
                error "Baseline name required"
                show_usage
                exit 1
            fi
            create_directories
            check_dependencies
            check_api_connectivity
            save_baseline "$arg"
            ;;
        "compare")
            if [[ -z "$arg" ]]; then
                error "Baseline name required for comparison"
                list_baselines
                exit 1
            fi
            create_directories
            check_dependencies
            check_api_connectivity
            compare_with_baseline "$arg"
            ;;
        "run")
            check_dependencies
            check_api_connectivity
            info "Running integration tests..."
            "$TEST_SCRIPT"
            ;;
        "list")
            list_baselines
            ;;
        "report")
            if [[ -f "$CURRENT_REPORT" ]]; then
                info "Opening report: $CURRENT_REPORT"
                if command -v xdg-open >/dev/null 2>&1; then
                    xdg-open "$CURRENT_REPORT"
                elif command -v open >/dev/null 2>&1; then
                    open "$CURRENT_REPORT"
                else
                    info "Report available at: $CURRENT_REPORT"
                fi
            else
                error "No report found. Run comparison first."
                exit 1
            fi
            ;;
        "help"|"--help"|"-h")
            show_usage
            ;;
        *)
            error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"