#!/usr/bin/env bash
# Cache Warmup Script for Post-Deployment
# Pre-populates cache with critical data using parallel requests

set -euo pipefail

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-utils.sh"

# Configuration
TIMEOUT="${WARMUP_TIMEOUT:-120}"
WARMUP_DELAY="${WARMUP_DELAY:-1}"
PARALLEL="${WARMUP_PARALLEL:-true}"

warm_endpoint() {
    local endpoint="$1"
    local description="$2"

    log "Warming: $description"

    local start_time=$(date +%s%3N)
    local http_code=$(curl -s -w "%{http_code}" --max-time "$TIMEOUT" "$DEPLOYMENT_URL$endpoint" 2>/dev/null || echo "000")
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))

    if [ "$http_code" = "200" ]; then
        success "$description - ${response_time}ms"
        return 0
    else
        error "$description - HTTP $http_code"
        return 1
    fi
}

warm_priority_endpoints() {
    log "\n=== Priority Endpoints (High) ==="

    local endpoints=(
        "/api/v1/health:Health"
        "/api/v1/cache/health:Cache health"
        "/api/v1/data/symbols:Symbols"
        "/api/v1/reports/pre-market:Pre-market briefing"
    )

    if [ "$PARALLEL" = "true" ]; then
        local pids=()
        for item in "${endpoints[@]}"; do
            IFS=: read -r endpoint desc <<< "$item"
            warm_endpoint "$endpoint" "$desc" &
            pids+=($!)
        done
        wait "${pids[@]}" 2>/dev/null || true
    else
        for item in "${endpoints[@]}"; do
            IFS=: read -r endpoint desc <<< "$item"
            warm_endpoint "$endpoint" "$desc"
            sleep "$WARMUP_DELAY"
        done
    fi
}

warm_sentiment_endpoints() {
    log "\n=== Sentiment Endpoints (Medium) ==="

    local symbols="AAPL,MSFT,GOOGL,TSLA,NVDA"
    warm_endpoint "/api/v1/sentiment/analysis?symbols=$symbols" "Market sentiment"

    # Individual symbols in parallel
    if [ "$PARALLEL" = "true" ]; then
        local pids=()
        for symbol in AAPL MSFT GOOGL TSLA NVDA; do
            warm_endpoint "/api/v1/sentiment/symbols/$symbol" "$symbol sentiment" &
            pids+=($!)
        done
        wait "${pids[@]}" 2>/dev/null || true
    fi
}

warm_report_endpoints() {
    log "\n=== Report Endpoints (Medium) ==="

    warm_endpoint "/dashboard.html" "Dashboard"
    warm_endpoint "/pre-market-briefing" "Pre-market HTML"
    warm_endpoint "/intraday-check" "Intraday HTML"
    warm_endpoint "/end-of-day-summary" "End-of-day HTML"
    warm_endpoint "/weekly-review" "Weekly HTML"
}

validate_warmup() {
    log "\n=== Validation ==="

    local response=$(curl -s --max-time "$TIMEOUT" "$DEPLOYMENT_URL/api/v1/cache/metrics" 2>/dev/null || echo "{}")

    if echo "$response" | jq -e '.cacheStats.totalRequests > 0' >/dev/null 2>&1; then
        local total=$(echo "$response" | jq -r '.cacheStats.totalRequests // 0')
        local l1=$(echo "$response" | jq -r '.cacheStats.l1Hits // 0')
        success "Cache warmed: $total requests, $l1 L1 hits"
    else
        warning "Could not validate cache metrics"
    fi
}

main() {
    log "🚀 Cache Warmup - $DEPLOYMENT_URL"
    log "Parallel: $PARALLEL | Timeout: ${TIMEOUT}s"
    log ""

    local total_start=$(date +%s%3N)

    warm_priority_endpoints
    warm_sentiment_endpoints
    warm_report_endpoints
    validate_warmup

    local total_end=$(date +%s%3N)
    local total_time=$((total_end - total_start))

    success "✅ Warmup complete in ${total_time}ms"
}

main "$@"
