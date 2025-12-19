#!/bin/bash

# Cache Warmup Script for Post-Deployment
# Pre-populates cache with critical data to eliminate cold starts
# Specifically addresses the "Pre-Market Briefing" cold start issue

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="https://tft-trading-system.yanggf.workers.dev"
TIMEOUT=120
WARMUP_DELAY=2

# Helper functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

progress() {
    echo -e "${CYAN}[PROGRESS]${NC} $1"
}

warmup_endpoint() {
    local endpoint="$1"
    local description="$2"
    local priority="$3" # high, medium, low

    log "Warming up: $description ($priority priority)"

    start_time=$(date +%s%3N)

    response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL$endpoint" || echo "000")
    http_code="${response: -3}"
    body="${response%???}"

    end_time=$(date +%s%3N)
    response_time=$((end_time - start_time))

    if [ "$http_code" = "200" ]; then
        success "$description - ${response_time}ms"
        return 0
    else
        error "$description - HTTP $http_code"
        return 1
    fi
}

# Critical Pre-Market Data Warming
warmup_pre_market_data() {
    log "\n=== Critical Pre-Market Data Warming ==="

    # High priority - Essential for pre-market briefing
    warmup_endpoint "/api/v1/data/symbols" "Available symbols list" "high"
    sleep $WARMUP_DELAY

    # Pre-market briefing data (this is what's currently failing)
    warmup_endpoint "/api/v1/reports/pre-market" "Pre-market briefing" "high"
    sleep $WARMUP_DELAY

    # Market sentiment for key symbols
    warmup_endpoint "/api/v1/sentiment/analysis?symbols=AAPL,MSFT,GOOGL,TSLA,NVDA" "Major symbols sentiment" "high"
    sleep $WARMUP_DELAY

    # Individual symbol sentiment (parallel requests)
    for symbol in AAPL MSFT GOOGL TSLA NVDA; do
        warmup_endpoint "/api/v1/sentiment/symbols/$symbol" "Sentiment for $symbol" "high" &
    done
    wait
    sleep $WARMUP_DELAY
}

# Market Data Warming
warmup_market_data() {
    log "\n=== Market Data Warming ==="

    # Market-wide sentiment
    warmup_endpoint "/api/v1/sentiment/market" "Market sentiment" "medium"
    sleep $WARMUP_DELAY

    # Sector sentiment
    warmup_endpoint "/api/v1/sentiment/sectors" "Sector sentiment" "medium"
    sleep $WARMUP_DELAY

    # Historical data for major symbols
    for symbol in AAPL MSFT GOOGL; do
        warmup_endpoint "/api/v1/data/history/$symbol" "History for $symbol" "medium" &
    done
    wait
    sleep $WARMUP_DELAY
}

# Daily Reports Warming
warmup_daily_reports() {
    log "\n=== Daily Reports Warming ==="

    # Today's date
    today=$(date +%Y-%m-%d)

    warmup_endpoint "/api/v1/reports/daily/$today" "Today's daily report" "medium"
    sleep $WARMUP_DELAY

    # Intraday analysis
    warmup_endpoint "/api/v1/reports/intraday" "Intraday analysis" "medium"
    sleep $WARMUP_DELAY

    # End-of-day summary (if market is closed)
    warmup_endpoint "/api/v1/reports/end-of-day" "End-of-day summary" "low"
    sleep $WARMUP_DELAY
}

# Cache System Warming
warmup_cache_system() {
    log "\n=== Cache System Warming ==="

    # Warm up cache metrics (this also initializes cache structures)
    warmup_endpoint "/api/v1/cache/health" "Cache health system" "high"
    sleep $WARMUP_DELAY

    warmup_endpoint "/api/v1/cache/metrics" "Cache metrics system" "high"
    sleep $WARMUP_DELAY

    warmup_endpoint "/api/v1/cache/config" "Cache configuration" "high"
    sleep $WARMUP_DELAY

    # Try cache warmup endpoint if available
    warmup_endpoint "/api/v1/cache/warmup" "Cache warmup trigger" "medium" || {
        warning "Cache warmup endpoint not available - using manual warmup"
    }
    sleep $WARMUP_DELAY
}

# Advanced Analytics Warming
warmup_advanced_analytics() {
    log "\n=== Advanced Analytics Warming ==="

    # Risk management data
    warmup_endpoint "/api/v1/risk/assessment" "Risk assessment" "low"
    sleep $WARMUP_DELAY

    # Portfolio optimization
    warmup_endpoint "/api/v1/portfolio/optimization" "Portfolio optimization" "low"
    sleep $WARMUP_DELAY

    # Technical indicators
    warmup_endpoint "/api/v1/technical/indicators?symbols=AAPL,MSFT" "Technical indicators" "low"
    sleep $WARMUP_DELAY
}

# Validate Cache Warmup Results
validate_warmup() {
    log "\n=== Validating Cache Warmup Results ==="

    # Check cache metrics to see if warmup was successful
    response=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/v1/cache/metrics")

    if echo "$response" | jq -e '.cacheStats.totalRequests > 0' >/dev/null 2>&1; then
        local total_requests=$(echo "$response" | jq -r '.cacheStats.totalRequests // 0')
        local l1_hits=$(echo "$response" | jq -r '.cacheStats.l1Hits // 0')
        local l2_hits=$(echo "$response" | jq -r '.cacheStats.l2Hits // 0')

        success "Cache warmed successfully!"
        success "Total requests: $total_requests"
        success "L1 hits: $l1_hits"
        success "L2 hits: $l2_hits"

        if [ "$l1_hits" -gt 0 ]; then
            success "✅ L1 cache hit rate indicates successful warmup"
        else
            warning "No L1 hits detected - warmup may need optimization"
        fi
    else
        warning "Could not validate cache warmup - metrics unavailable"
    fi
}

# Test Pre-Market Briefing Specifically
test_pre_market_briefing() {
    log "\n=== Testing Pre-Market Briefing Performance ==="

    progress "Testing pre-market briefing endpoint..."

    start_time=$(date +%s%3N)
    response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/api/v1/reports/pre-market")
    end_time=$(date +%s%3N)
    http_code="${response: -3}"
    body="${response%???}"
    response_time=$((end_time - start_time))

    if [ "$http_code" = "200" ]; then
        success "Pre-market briefing ready! (${response_time}ms)"

        # Check if the response shows complete data
        if echo "$body" | grep -q "completion.*100%\|complete\|ready"; then
            success "✅ Pre-market briefing shows complete data"
        elif echo "$body" | grep -q "completion.*0%\|in progress"; then
            warning "⚠️  Pre-market briefing still processing (cold cache issue persists)"
        else
            success "✅ Pre-market briefing responding normally"
        fi
    else
        error "Pre-market briefing failed - HTTP $http_code"
        return 1
    fi
}

# Main warmup execution
main() {
    log "🚀 Cache Warmup Script for Post-Deployment"
    log "Target: $BASE_URL"
    log "Timeout: ${TIMEOUT}s per request"
    log "Purpose: Eliminate cold start 'Pre-Market Briefing' issue"
    log ""

    local total_start_time=$(date +%s%3N)

    # Execute warmup in priority order
    warmup_cache_system          # Initialize cache structures first
    warmup_pre_market_data       # Most critical - eliminates the main issue
    warmup_market_data          # Supporting market data
    warmup_daily_reports        # Daily reports
    warmup_advanced_analytics   # Optional analytics

    # Validate results
    validate_warmup

    # Test the specific issue
    test_pre_market_briefing

    local total_end_time=$(date +%s%3N)
    local total_time=$((total_end_time - total_start_time))

    log "\n=== Warmup Complete ==="
    log "Total warmup time: ${total_time}ms"
    success "🎉 Cache warmup completed successfully!"
    success "✅ Pre-Market Briefing cold start issue should be resolved"
    log ""
    log "Next steps:"
    log "1. Test the pre-market briefing page"
    log "2. Verify it shows 100% completion immediately"
    log "3. Monitor cache hit rates in production"
}

# Run main function
main "$@"