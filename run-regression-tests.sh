#!/bin/bash

# Regression Test Runner for Enhanced Cache System
# Automated testing with baseline comparison and regression detection

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_SCRIPT="$SCRIPT_DIR/test-enhanced-cache-integration.sh"
BASELINE_DIR="$SCRIPT_DIR/baselines"
CURRENT_DATE=$(date +%Y%m%d)
REPORT_DIR="$SCRIPT_DIR/reports"
CURRENT_REPORT="$REPORT_DIR/regression-report-$CURRENT_DATE.html"
API_URL="https://tft-trading-system.yanggf.workers.dev"

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
    local baseline_file="$BASELINE_DIR/baseline-$baseline_name.json"

    info "Saving baseline: $baseline_name"

    # Run the integration test and capture results
    if "$TEST_SCRIPT" > "$baseline_file.tmp" 2>&1; then
        mv "$baseline_file.tmp" "$baseline_file"

        # Extract key metrics from baseline
        local metrics=$(extract_metrics_from_log "$baseline_file")
        echo "$metrics" > "${baseline_file%.json}.metrics"

        success "Baseline saved: $baseline_name"
        return 0
    else
        error "Failed to create baseline: $baseline_name"
        rm -f "$baseline_file.tmp"
        return 1
    fi
}

# Extract key metrics from test log
extract_metrics_from_log() {
    local log_file="$1"

    # Extract key metrics using grep and awk
    local passed=$(grep -c "✅ PASS:" "$log_file" || echo "0")
    local failed=$(grep -c "❌ FAIL:" "$log_file" || echo "0")
    local skipped=$(grep -c "⏭️  SKIP:" "$log_file" || echo "0")
    local total=$((passed + failed + skipped))

    # Extract performance metrics
    local cache_hit_rate=$(grep "L1 Hit Rate:" "$log_file" | tail -1 | grep -o "[0-9.]*%" | head -1 || echo "N/A")
    local health_score=$(grep "Score:" "$log_file" | grep -o "[0-9]*" | head -1 || echo "N/A")
    local ops_per_sec=$(grep "ops/sec" "$log_file" | grep -o "[0-9.]*" | head -1 || echo "N/A")

    cat <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "tests": {
    "total": $total,
    "passed": $passed,
    "failed": $failed,
    "skipped": $skipped,
    "success_rate": $(echo "scale=2; $passed * 100 / $total" | bc -l)
  },
  "performance": {
    "cache_hit_rate": "$cache_hit_rate",
    "health_score": "$health_score",
    "ops_per_second": "$ops_per_sec"
  }
}
EOF
}

# Compare current results with baseline
compare_with_baseline() {
    local baseline_name="$1"
    local baseline_file="$BASELINE_DIR/baseline-$baseline_name.json"
    local baseline_metrics="${baseline_file%.json}.metrics"

    if [[ ! -f "$baseline_file" ]]; then
        warning "Baseline not found: $baseline_name"
        return 1
    fi

    info "Comparing with baseline: $baseline_name"

    # Run current tests
    local current_results="$REPORT_DIR/current-test-$CURRENT_DATE.log"
    "$TEST_SCRIPT" > "$current_results" 2>&1
    local current_exit_code=$?

    # Extract current metrics
    local current_metrics=$(extract_metrics_from_log "$current_results")

    # Load baseline metrics
    local baseline_data=$(cat "$baseline_metrics")

    # Compare metrics
    local comparison=$(compare_metrics "$baseline_data" "$current_metrics")

    # Generate comparison report
    generate_comparison_report "$baseline_name" "$baseline_data" "$current_metrics" "$comparison" "$current_results"

    # Check for regressions
    if [[ $current_exit_code -eq 0 ]]; then
        if has_regression "$comparison"; then
            warning "Performance regression detected compared to baseline: $baseline_name"
            return 2
        else
            success "No regressions detected compared to baseline: $baseline_name"
            return 0
        fi
    else
        error "Current tests failed - regression detected"
        return 3
    fi
}

# Compare metrics between baseline and current
compare_metrics() {
    local baseline="$1"
    local current="$2"

    # Parse JSON values (simplified parsing without jq dependency)
    local baseline_success_rate=$(echo "$baseline" | grep -o '"success_rate": [0-9.]*' | cut -d: -f2 | tr -d ' ')
    local current_success_rate=$(echo "$current" | grep -o '"success_rate": [0-9.]*' | cut -d: -f2 | tr -d ' ')

    local baseline_health=$(echo "$baseline" | grep -o '"health_score": "[^"]*"' | cut -d: -f2 | tr -d '" ')
    local current_health=$(echo "$current" | grep -o '"health_score": "[^"]*"' | cut -d: -f2 | tr -d '" ')

    local baseline_ops=$(echo "$baseline" | grep -o '"ops_per_second": "[^"]*"' | cut -d: -f2 | tr -d '" ')
    local current_ops=$(echo "$current" | grep -o '"ops_per_second": "[^"]*"' | cut -d: -f2 | tr -d '" ')

    cat <<EOF
{
  "success_rate": {
    "baseline": $baseline_success_rate,
    "current": $current_success_rate,
    "change": $(echo "scale=2; $current_success_rate - $baseline_success_rate" | bc -l)
  },
  "health_score": {
    "baseline": "$baseline_health",
    "current": "$current_health",
    "improved": $(echo "$baseline_health" | grep -q "^[0-9]" && echo "$current_health" | grep -q "^[0-9]" && echo "$current_health > $baseline_health" | bc -l || echo "1")
  },
  "ops_per_second": {
    "baseline": "$baseline_ops",
    "current": "$current_ops",
    "improved": $(echo "$baseline_ops" | grep -q "^[0-9]" && echo "$current_ops" | grep -q "^[0-9]" && echo "$current_ops > $baseline_ops" | bc -l || echo "1")
  }
}
EOF
}

# Check if regression exists
has_regression() {
    local comparison="$1"

    # Check for significant performance degradation
    local success_rate_change=$(echo "$comparison" | grep -o '"change": [^,]*' | cut -d: -f2 | tr -d ' ')

    # Regression if success rate dropped by more than 10%
    if (( $(echo "$success_rate_change < -10" | bc -l) )); then
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
    info "Available baselines:"
    if [[ -d "$BASELINE_DIR" && -n "$(ls -A "$BASELINE_DIR" 2>/dev/null)" ]]; then
        for baseline in "$BASELINE_DIR"/baseline-*.metrics; do
            if [[ -f "$baseline" ]]; then
                local name=$(basename "$baseline" .metrics | sed 's/baseline-//')
                local timestamp=$(grep -o '"timestamp": "[^"]*"' "$baseline" | cut -d: -f2 | tr -d '"')
                local success_rate=$(grep -o '"success_rate": [0-9.]*' "$baseline" | cut -d: -f2 | tr -d ' ')
                echo "  - $name (timestamp: $timestamp, success rate: ${success_rate}%)"
            fi
        done
    else
        echo "  No baselines found"
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