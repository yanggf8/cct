#!/bin/bash

# Simple KV Usage Tracker
# Shows daily KV operation counts and costs

set -e
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
TIMEOUT=15

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}🔍 Simple KV Usage Tracker${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

# Test API connectivity
echo -e "${YELLOW}Testing API connectivity...${NC}"
if ! curl -s -f -H "X-API-KEY: $X_API_KEY" --max-time $TIMEOUT "$API_URL/health" > /dev/null; then
    echo -e "${RED}ERROR: Cannot connect to API${NC}"
    exit 1
fi
echo -e "${GREEN}✅ API connectivity confirmed${NC}"

# Get current cache metrics
echo -e "\n${YELLOW}Getting current cache metrics...${NC}"
METRICS=$(curl -s -H "X-API-KEY: $X_API_KEY" --max-time $TIMEOUT "$API_URL/cache-metrics")

if [[ $? -ne 0 ]]; then
    echo -e "${RED}ERROR: Cannot get cache metrics${NC}"
    exit 1
fi

# Extract key metrics
TOTAL_REQUESTS=$(echo "$METRICS" | jq -r '.cacheStats.totalRequests // 0')
L1_HITS=$(echo "$METRICS" | jq -r '.cacheStats.l1Hits // 0')
L2_HITS=$(echo "$METRICS" | jq -r '.cacheStats.l2Hits // 0')
MISSES=$(echo "$METRICS" | jq -r '.cacheStats.misses // 0')
L1_HIT_RATE=$(echo "$METRICS" | jq -r '.cacheStats.l1HitRate // 0')
L2_HIT_RATE=$(echo "$METRICS" | jq -r '.cacheStats.l2HitRate // 0')
OVERALL_HIT_RATE=$(echo "$METRICS" | jq -r '.cacheStats.overallHitRate // 0')

echo -e "\n${BLUE}📊 Current Cache Status:${NC}"
printf "${CYAN}%-25s${NC} %s\n" "Total Requests:" "$TOTAL_REQUESTS"
printf "${CYAN}%-25s${NC} %s\n" "L1 Cache Hits:" "$L1_HITS"
printf "${CYAN}%-25s${NC} %s\n" "L2 Cache Hits:" "$L2_HITS"
printf "${CYAN}%-25s${NC} %s\n" "Cache Misses:" "$MISSES"
printf "${CYAN}%-25s${NC} %s\n" "L1 Hit Rate:" "${L1_HIT_RATE}%"
printf "${CYAN}%-25s${NC} %s\n" "L2 Hit Rate:" "${L2_HIT_RATE}%"
printf "${CYAN}%-25s${NC} %s\n" "Overall Hit Rate:" "${OVERALL_HIT_RATE}%"

# Calculate KV operations
CACHE_HITS=$((L1_HITS + L2_HITS))
KV_READS=$((TOTAL_REQUESTS - CACHE_HITS))

echo -e "\n${BLUE}🔍 KV Operations Analysis:${NC}"
printf "${CYAN}%-25s${NC} %s\n" "Total API Requests:" "$TOTAL_REQUESTS"
printf "${CYAN}%-25s${NC} %s\n" "Cache Hits:" "$CACHE_HITS"
printf "${CYAN}%-25s${NC} %s\n" "KV Operations:" "$KV_READS"

# Calculate KV efficiency
if [[ $TOTAL_REQUESTS -gt 0 ]]; then
    KV_EFFICIENCY=$(echo "scale=2; $CACHE_HITS * 100 / $TOTAL_REQUESTS" | bc 2>/dev/null || echo "0")
    printf "${CYAN}%-25s${NC} %s\n" "KV Efficiency:" "${KV_EFFICIENCY}% cache hits"
else
    printf "${CYAN}%-25s${NC} %s\n" "KV Efficiency:" "No data yet"
fi

# Estimate daily usage scenarios
echo -e "\n${YELLOW}📈 Daily Usage Estimates:${NC}"

echo -e "\n${BLUE}Scenario 1: Light Usage (100 requests/day)${NC}"
if [[ $OVERALL_HIT_RATE != "0" ]]; then
    # Use current hit rate
    LIGHT_KV_READS=$(echo "100 * (1 - $OVERALL_HIT_RATE/100)" | bc 2>/dev/null || echo "100")
else
    # Assume 50% hit rate if no data
    LIGHT_KV_READS=50
fi
printf "${CYAN}%-25s${NC} %s\n" "Daily KV Reads:" "$LIGHT_KV_READS"

echo -e "\n${BLUE}Scenario 2: Medium Usage (1,000 requests/day)${NC}"
if [[ $OVERALL_HIT_RATE != "0" ]]; then
    MEDIUM_KV_READS=$(echo "1000 * (1 - $OVERALL_HIT_RATE/100)" | bc 2>/dev/null || echo "1000")
else
    MEDIUM_KV_READS=500
fi
printf "${CYAN}%-25s${NC} %s\n" "Daily KV Reads:" "$MEDIUM_KV_READS"

echo -e "\n${BLUE}Scenario 3: Heavy Usage (10,000 requests/day)${NC}"
if [[ $OVERALL_HIT_RATE != "0" ]]; then
    HEAVY_KV_READS=$(echo "10000 * (1 - $OVERALL_HIT_RATE/100)" | bc 2>/dev/null || echo "10000")
else
    HEAVY_KV_READS=5000
fi
printf "${CYAN}%-25s${NC} %s\n" "Daily KV Reads:" "$HEAVY_KV_READS"

# Cloudflare KV Free Tier Analysis
echo -e "\n${YELLOW}💰 Cloudflare KV Free Tier Analysis:${NC}"
echo -e "${BLUE}Free Tier Limits:${NC}"
echo -e "  • Reads: 10,000,000 per day"
echo -e "  • Writes: 1,000,000 per day"
echo -e "  • Storage: 1GB"

echo -e "\n${BLUE}Usage Impact:${NC}"
if [[ $HEAVY_KV_READS -gt 0 ]]; then
    USAGE_PERCENT=$(echo "scale=4; $HEAVY_KV_READS * 100 / 10000000" | bc 2>/dev/null || echo "0")
    printf "${CYAN}%-25s${NC} %s\n" "Heavy Usage %:" "${USAGE_PERCENT}%"

    if (( $(echo "$USAGE_PERCENT < 1" | bc -l 2>/dev/null || echo "1") )); then
        echo -e "${GREEN}✅ EXCELLENT: Well under 1% of free tier${NC}"
    elif (( $(echo "$USAGE_PERCENT < 5" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "${GREEN}✅ GOOD: Under 5% of free tier${NC}"
    elif (( $(echo "$USAGE_PERCENT < 10" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "${YELLOW}⚠️  MODERATE: Under 10% of free tier${NC}"
    else
        echo -e "${RED}❌ HIGH: Significant portion of free tier${NC}"
    fi
fi

echo -e "\n${YELLOW}🎯 KV Optimization Impact:${NC}"
echo -e "${BLUE}With 70% KV reduction (using optimization plan):${NC}"
if [[ $HEAVY_KV_READS -gt 0 ]]; then
    OPTIMIZED_KV_READS=$(echo "scale=0; $HEAVY_KV_READS * 0.3" | bc 2>/dev/null || echo "0")
    printf "${CYAN}%-25s${NC} %s → %s\n" "Heavy Daily KV:" "$HEAVY_KV_READS" "$OPTIMIZED_KV_READS"
    echo -e "${GREEN}🎉 POTENTIAL SAVINGS: $((HEAVY_KV_READS - OPTIMIZED_KV_READS)) fewer KV operations per day${NC}"
fi

echo -e "\n${YELLOW}💡 Recommendations:${NC}"
echo -e "${CYAN}• Target >70% cache hit rate to minimize KV operations${NC}"
echo -e "${CYAN}• Monitor /cache-metrics endpoint regularly${NC}"
echo -e "${CYAN}• Implement request deduplication to reduce duplicate KV reads${NC}"
echo -e "${CYAN}• Use health check caching to avoid repeated status queries${NC}"

echo -e "\n${GREEN}🔍 Monitor with: curl -H 'X-API-KEY: $X_API_KEY' $API_URL/cache-metrics${NC}"
echo -e "${GREEN}📊 Health check: curl -H 'X-API-KEY: $X_API_KEY' $API_URL/cache-health${NC}"
echo ""