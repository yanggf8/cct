#!/bin/bash

# KV Usage Tracking Test
# Tests daily KV operation counting and cost tracking for budget management
# Helps answer "How many KV operations will I use per day?"

set -euo pipefail
# Check environment variables
if [[ -z "${X_API_KEY:-}" ]]; then
    echo "❌ ERROR: X_API_KEY environment variable is not set"
    echo ""
    echo "Current environment variables with API_KEY:"
    env | grep -i api_key || echo "  (none found)"
    echo ""
    echo "Please set X_API_KEY in your .zshrc:"
    echo "  export X_API_KEY=your_api_key"
    echo "  source ~/.zshrc"
    echo ""
    echo "Or set it temporarily:"
    echo "  X_API_KEY=your_api_key ./test-script.sh"
    exit 1
fi
echo "✅ X_API_KEY is set (length: ${#X_API_KEY})"
echo "✅ X_API_KEY is set (length: 0)"

# Configuration
API_URL="https://tft-trading-system.yanggf.workers.dev"
X_API_KEY="yanggf"
TIMEOUT=30
LOG_FILE="kv-usage-$(date +%Y%m%d-%H%M%S).log"

# Cloudflare KV Free Tier Limits (2025)
KV_READ_LIMIT=10000000  # 10 million reads/day free
KV_WRITE_LIMIT=1000000 # 1 million writes/day free
KV_STORAGE_LIMIT=1000000000 # 1GB storage free
AVERAGE_READ_SIZE=2048  # 2KB average
AVERAGE_WRITE_SIZE=1024  # 1KB average

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Make curl request and measure response
make_request_with_metrics() {
    local endpoint="$1"
    local description="$2"
    local request_count="${3:-1}"

    log "Testing: $description ($request_count requests)"

    # Measure baseline KV operations
    local start_metrics=$(get_cache_metrics)
    local start_reads=$(echo "$start_metrics" | jq -r '.totalRequests // 0')
    local start_l1_hits=$(echo "$start_metrics" | jq -r '.l1Hits // 0')
    local start_l2_hits=$(echo "$start_metrics" | jq -r '.l2Hits // 0')

    # Make requests
    for i in $(seq 1 $request_count); do
        curl -s -w '%{http_code}' -o /dev/null \
            -H "X-API-KEY: $X_API_KEY" \
            --max-time $TIMEOUT \
            "$API_URL$endpoint" > /dev/null
        sleep 0.1  # Small delay between requests
    done

    # Measure final KV operations
    local end_metrics=$(get_cache_metrics)
    local end_reads=$(echo "$end_metrics" | jq -r '.totalRequests // 0')
    local end_l1_hits=$(echo "$end_metrics" | jq -r '.l1Hits // 0')
    local end_l2_hits=$(echo "$end_metrics" | jq -r '.l2Hits // 0')

    # Calculate KV operations
    local total_requests=$((end_reads - start_reads))
    local l1_hits=$((end_l1_hits - start_l1_hits))
    local l2_hits=$((end_l2_hits - start_l2_hits))
    local cache_hits=$((l1_hits + l2_hits))
    local kv_reads=$((total_requests - cache_hits))

    printf "${CYAN}%-40s${NC} %s\n" "$description" "Req: $total_requests, L1: $l1_hits, L2: $l2_hits, KV: $kv_reads"
    log "$description: $total_requests requests, $cache_hits cache hits, $kv_reads KV reads"

    return $kv_reads
}

# Get current cache metrics
get_cache_metrics() {
    curl -s -H "X-API-KEY: $X_API_KEY" \
        --max-time $TIMEOUT \
        "$API_URL/cache-metrics" 2>/dev/null | jq -r '.cacheStats // {}'
}

# Estimate daily usage based on current patterns
estimate_daily_usage() {
    echo -e "\n${BLUE}=== Daily Usage Estimation ===${NC}"

    # Get current metrics
    local metrics=$(get_cache_metrics)
    local total_requests=$(echo "$metrics" | jq -r '.totalRequests // 0')
    local l1_hit_rate=$(echo "$metrics" | jq -r '.l1HitRate // 0')
    local l2_hit_rate=$(echo "$metrics" | jq -r '.l2HitRate // 0')
    local overall_hit_rate=$(echo "$metrics" | jq -r '.overallHitRate // 0')

    # Estimate based on different user loads
    echo -e "\n${YELLOW}📊 Usage Estimates by Daily Active Users:${NC}"

    # Light usage (100 requests/day)
    local light_requests=100
    local light_kv_reads=$(echo "scale=2; $light_requests * (1 - $overall_hit_rate/100)" | bc)
    local light_kv_writes=$(echo "scale=2; $light_requests * 0.1" | bc)  # Assume 10% write operations

    # Medium usage (1000 requests/day)
    local medium_requests=1000
    local medium_kv_reads=$(echo "scale=2; $medium_requests * (1 - $overall_hit_rate/100)" | bc)
    local medium_kv_writes=$(echo "scale=2; $medium_requests * 0.1" | bc)

    # Heavy usage (10000 requests/day)
    local heavy_requests=10000
    local heavy_kv_reads=$(echo "scale=2; $heavy_requests * (1 - $overall_hit_rate/100)" | bc)
    local heavy_kv_writes=$(echo "scale=2; $heavy_requests * 0.1" | bc)

    printf "${CYAN}%-20s${NC} %s\n" "Scenario" "Requests/Day | KV Reads/Day | KV Writes/Day | % of Free Tier"
    printf "${CYAN}%-20s${NC} %s\n" "Light (100 users)" "$light_requests | $light_kv_reads | $light_kv_writes | $(echo "scale=4; $light_kv_reads * 100 / $KV_READ_LIMIT" | bc)%"
    printf "${CYAN}%-20s${NC} %s\n" "Medium (1k users)" "$medium_requests | $medium_kv_reads | $medium_kv_writes | $(echo "scale=4; $medium_kv_reads * 100 / $KV_READ_LIMIT" | bc)%"
    printf "${CYAN}%-20s${NC} %s\n" "Heavy (10k users)" "$heavy_requests | $heavy_kv_reads | $heavy_kv_writes | $(echo "scale=4; $heavy_kv_reads * 100 / $KV_READ_LIMIT" | bc)%"
}

# Test current KV efficiency
test_kv_efficiency() {
    echo -e "\n${BLUE}=== Current KV Efficiency Test ===${NC}"

    # Get baseline metrics
    local baseline=$(get_cache_metrics)
    local baseline_requests=$(echo "$baseline" | jq -r '.totalRequests // 0')
    local baseline_hit_rate=$(echo "$baseline" | jq -r '.overallHitRate // 0')

    log "Baseline: $baseline_requests requests, ${baseline_hit_rate}% hit rate"

    # Test analysis endpoint (expensive operation)
    echo -e "\n${YELLOW}Testing expensive analysis operations...${NC}"
    make_request_with_metrics "/analyze" "Sentiment Analysis (Single)" 1

    # Test analysis endpoint multiple times (should use cache)
    echo -e "\n${YELLOW}Testing cache effectiveness...${NC}"
    make_request_with_metrics "/analyze" "Sentiment Analysis (Cached)" 3

    # Test different endpoints
    echo -e "\n${YELLOW}Testing different endpoint types...${NC}"
    make_request_with_metrics "/health" "Health Check" 1
    make_request_with_metrics "/api/v1/data/symbols" "Data Symbols" 1
    make_request_with_metrics "/api/v1/sentiment/market" "Market Sentiment" 1

    # Show efficiency
    local final=$(get_cache_metrics)
    local final_requests=$(echo "$final" | jq -r '.totalRequests // 0')
    local final_hit_rate=$(echo "$final" | jq -r '.overallHitRate // 0')
    local l1_hit_rate=$(echo "$final" | jq -r '.l1HitRate // 0')
    local l2_hit_rate=$(echo "$final" | jq -r '.l2HitRate // 0')

    echo -e "\n${GREEN}📈 Efficiency Results:${NC}"
    printf "${CYAN}%-20s${NC} %s\n" "Total Requests:" "$final_requests"
    printf "${CYAN}%-20s${NC} %s\n" "Overall Hit Rate:" "${final_hit_rate}%"
    printf "${CYAN}%-20s${NC} %s\n" "L1 Hit Rate:" "${l1_hit_rate}%"
    printf "${CYAN}%-20s${NC} %s\n" "L2 Hit Rate:" "${l2_hit_rate}%"

    if (( $(echo "$final_hit_rate > 70" | bc -l) )); then
        echo -e "${GREEN}✅ EXCELLENT: Hit rate > 70% (great KV efficiency)${NC}"
    elif (( $(echo "$final_hit_rate > 50" | bc -l) )); then
        echo -e "${YELLOW}⚠️  GOOD: Hit rate > 50% (decent KV efficiency)${NC}"
    else
        echo -e "${RED}❌ POOR: Hit rate < 50% (needs KV optimization)${NC}"
    fi
}

# Cost analysis
analyze_costs() {
    echo -e "\n${BLUE}=== KV Cost Analysis ===${NC}"

    local metrics=$(get_cache_metrics)
    local current_reads=$(echo "$metrics" | jq -r '.totalRequests // 0')
    local current_writes=$(echo "$metrics" | jq -r '.l1Size' 2>/dev/null || echo "0")  # Proxy for writes

    # Calculate daily estimates based on current hit rate
    local hit_rate=$(echo "$metrics" | jq -r '.overallHitRate // 0')
    local daily_requests=1000  # Assumption
    local daily_reads=$(echo "scale=2; $daily_requests * (1 - $hit_rate/100)" | bc)
    local daily_writes=$(echo "scale=2; $daily_requests * 0.05" | bc)  # Assume 5% writes

    echo -e "\n${YELLOW}Daily Estimates (1000 requests/day):${NC}"
    printf "${CYAN}%-25s${NC} %s\n" "Daily KV Reads:" "$daily_reads"
    printf "${CYAN}%-25s${NC} %s\n" "Daily KV Writes:" "$daily_writes"
    printf "${CYAN}%-25s${NC} %s\n" "Read Usage (% of free):" "$(echo "scale=6; $daily_reads * 100 / $KV_READ_LIMIT" | bc)%"
    printf "${CYAN}%-25s${NC} %s\n" "Write Usage (% of free):" "$(echo "scale=6; $daily_writes * 100 / $KV_WRITE_LIMIT" | bc)%"

    # Monthly estimates
    local monthly_reads=$((daily_reads * 30))
    local monthly_writes=$((daily_writes * 30))

    echo -e "\n${YELLOW}Monthly Estimates:${NC}"
    printf "${CYAN}%-25s${NC} %s\n" "Monthly KV Reads:" "$monthly_reads"
    printf "${CYAN}%-25s${NC} %s\n" "Monthly KV Writes:" "$monthly_writes"

    # Cost analysis (beyond free tier)
    if (( monthly_reads > KV_READ_LIMIT )); then
        local paid_reads=$((monthly_reads - KV_READ_LIMIT))
        echo -e "${RED}⚠️  WARNING: Exceeds free tier by $paid_reads reads/month${NC}"
        echo -e "${RED}   Paid reads cost: \$${paid_reads} per month${NC}"  # $0.50 per 1000 reads (example)
    else
        echo -e "${GREEN}✅ WITHIN FREE TIER: No monthly KV costs${NC}"
    fi

    if (( monthly_writes > KV_WRITE_LIMIT )); then
        local paid_writes=$((monthly_writes - KV_WRITE_LIMIT))
        echo -e "${RED}⚠️  WARNING: Exceeds free tier by $paid_writes writes/month${NC}"
        echo -e "${RED}   Paid writes cost: \$${paid_writes} per month${NC}"  # $0.50 per 1000 writes (example)
    fi
}

# Main test execution
main() {
    echo -e "${CYAN}======================================${NC}"
    echo -e "${CYAN}🔍 KV Usage Tracking Test Suite${NC}"
    echo -e "${CYAN}======================================${NC}"
    echo -e "Log file: $LOG_FILE"
    echo ""

    # Check dependencies
    if ! command -v jq >/dev/null 2>&1; then
        echo -e "${RED}ERROR: jq is required for JSON parsing${NC}"
        echo "Install with: sudo apt-get install jq"
        exit 1
    fi

    if ! command -v bc >/dev/null 2>&1; then
        echo -e "${RED}ERROR: bc is required for calculations${NC}"
        echo "Install with: sudo apt-get install bc"
        exit 1
    fi

    # Test basic connectivity
    echo -e "${YELLOW}Testing API connectivity...${NC}"
    if ! curl -s -f -H "X-API-KEY: $X_API_KEY" --max-time $TIMEOUT "$API_URL/health" > /dev/null; then
        echo -e "${RED}ERROR: Cannot connect to API${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ API connectivity confirmed${NC}"

    # Run tests
    test_kv_efficiency
    estimate_daily_usage
    analyze_costs

    echo -e "\n${GREEN}🎯 Recommendations:${NC}"
    echo -e "${CYAN}• Target >70% cache hit rate for optimal KV efficiency${NC}"
    echo -e "${CYAN}• Monitor /cache-metrics endpoint regularly for usage trends${NC}"
    echo -e "${CYAN}• Implement request deduplication to reduce KV operations${NC}"
    echo -e "${CYAN}• Use health check caching to avoid repeated KV status reads${NC}"
    echo -e "${CYAN}• Consider selective KV persistence for rate-limit-free data${NC}"

    echo -e "\n${GREEN}📋 Log saved to: $LOG_FILE${NC}"
}

# Run main function
main "$@"