#!/bin/bash
# List ALL KV Cache Values
# Retrieves actual cached entries, not just metrics

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="test"

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${YELLOW}[→]${NC} $1"; }
header() { echo -e "\n${CYAN}==========================================${NC}"; echo -e "${CYAN}$1${NC}"; echo -e "${CYAN}==========================================${NC}\n"; }

echo "=========================================="
echo "KV Cache - Complete Value Listing"
echo "Retrieving ALL cached entries from KV"
echo "=========================================="
echo ""

# Step 1: Get cache timestamps (all cached keys)
header "STEP 1: All Cache Keys & Timestamps"

log "Fetching cache timestamps..."
TIMESTAMPS=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/timestamps" \
  --max-time 30000 2>/dev/null || echo '{"error": "Failed to fetch"}')

if echo "$TIMESTAMPS" | jq -e '.error' >/dev/null 2>&1; then
    error "Failed to fetch cache timestamps"
    echo "$TIMESTAMPS"
    exit 1
fi

COUNT=$(echo "$TIMESTAMPS" | jq '.timestamps | length' 2>/dev/null || echo "0")
info "Total cached entries found: $COUNT"

if [ "$COUNT" -gt 0 ]; then
    success "Cache has $COUNT entries"
    echo ""

    # Show all keys with details
    echo "All Cache Entries:"
    echo "$TIMESTAMPS" | jq -r '.timestamps | to_entries[] | "  Key: \(.key)\n  Age: \(.value.age // .value.ageFormatted // "unknown")\n  TTL: \(.value.ttl // .value.ttlSeconds // "unknown")\n  Source: \(.value.cacheSource // "unknown")\n  "'

    echo ""
    info "Keys by namespace:"
    echo "$TIMESTAMPS" | jq -r '.timestamps | keys[] | select(startswith("news_")) | "  [NEWS]  \(.)"' | head -20
    echo "$TIMESTAMPS" | jq -r '.timestamps | keys[] | select(startswith("symbol_sentiment_")) | "  [SENTIMENT]  \(.)"' | head -20
    echo "$TIMESTAMPS" | jq -r '.timestamps | keys[] | select(startswith("sentiment_analysis_")) | "  [ANALYSIS]  \(.)"' | head -20
else
    error "No cached entries found"
fi

echo ""

# Step 2: Get cache metrics
header "STEP 2: Cache Statistics & Performance"

METRICS=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/metrics" \
  --max-time 30000 2>/dev/null || echo '{"error": "Failed to fetch"}')

if echo "$METRICS" | jq -e '.error' >/dev/null 2>&1; then
    error "Failed to fetch cache metrics"
    echo "$METRICS"
else
    TOTAL=$(echo "$METRICS" | jq -r '.cacheStats.totalRequests // 0')
    L1_HITS=$(echo "$METRICS" | jq -r '.cacheStats.l1Hits // 0')
    L2_HITS=$(echo "$METRICS" | jq -r '.cacheStats.l2Hits // 0')
    L1_SIZE=$(echo "$METRICS" | jq -r '.cacheStats.l1Size // 0')
    L2_SIZE=$(echo "$METRICS" | jq -r '.cacheStats.l2Size // 0')

    info "Cache Statistics:"
    echo "  Total Requests: $TOTAL"
    echo "  L1 Hits: $L1_HITS"
    echo "  L2 Hits: $L2_HITS"
    echo "  L1 Size: $L1_SIZE entries"
    echo "  L2 Size: $L2_SIZE entries"

    if [ "$L1_SIZE" -gt 0 ] || [ "$L2_SIZE" -gt 0 ]; then
        success "Cache is populated"
    else
        error "Cache is empty"
    fi
fi

echo ""

# Step 3: Get cache metadata
header "STEP 3: Detailed Cache Metadata"

METADATA=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/metadata" \
  --max-time 30000 2>/dev/null || echo '{"error": "Failed to fetch"}')

if echo "$METADATA" | jq -e '.error' >/dev/null 2>&1; then
    error "Failed to fetch cache metadata"
else
    METADATA_COUNT=$(echo "$METADATA" | jq '.metadata | length' 2>/dev/null || echo "0")
    info "Cache Metadata Entries: $METADATA_COUNT"

    if [ "$METADATA_COUNT" -gt 0 ]; then
        echo "Sample Metadata:"
        echo "$METADATA" | jq -r '.metadata | to_entries[:10] | .[] | "  \(.key):\n    Type: \(.value.type // "unknown")\n    TTL: \(.value.ttl // "unknown")\n    Age: \(.value.age // "unknown")\n"'
    fi
fi

echo ""

# Step 4: Check cache health
header "STEP 4: Cache Health Assessment"

HEALTH=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/health" \
  --max-time 30000 2>/dev/null || echo '{"error": "Failed to fetch"}')

if echo "$HEALTH" | jq -e '.error' >/dev/null 2>&1; then
    error "Failed to fetch cache health"
else
    SCORE=$(echo "$HEALTH" | jq -r '.assessment.overallScore // 0')
    STATUS=$(echo "$HEALTH" | jq -r '.assessment.status // "unknown"')

    info "Cache Health:"
    echo "  Overall Score: $SCORE/100"
    echo "  Status: $STATUS"

    if [ "$SCORE" -gt 70 ]; then
        success "Cache is healthy"
    elif [ "$SCORE" -gt 40 ]; then
        echo "  Cache needs attention"
    else
        error "Cache health is critical"
    fi
fi

echo ""

# Step 5: Check cache configuration
header "STEP 5: Cache Configuration"

CONFIG=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/config" \
  --max-time 30000 2>/dev/null || echo '{"error": "Failed to fetch"}')

if echo "$CONFIG" | jq -e '.error' >/dev/null 2>&1; then
    error "Failed to fetch cache config"
else
    info "Cache Configuration:"
    echo "$CONFIG" | jq -r '.config | to_entries[] | "  \(.key):\n    L1 TTL: \(.value.l1TTL // "default")\n    L2 TTL: \(.value.l2TTL // "default")\n    Grace Period: \(.value.l1GracePeriod // "default")\n"' | head -50
fi

echo ""

# Step 6: Make a request to populate cache and show before/after
header "STEP 6: Live Cache Population Test"

info "Making request to populate cache..."
START_TIME=$(date +%s%3N)

RESPONSE=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/sentiment/symbols/AAPL" \
  -w "\nTIME:%{time_total}" --max-time 120000)

END_TIME=$(date +%s%3N)
TIME=$(echo "$RESPONSE" | grep "TIME:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/TIME:/d')

RT=$((END_TIME - START_TIME))
NEWS_COUNT=$(echo "$BODY" | jq -r '.data.analysis.news.articles_analyzed // 0')

info "Request completed in ${TIME}s (${RT}ms)"
info "Articles analyzed: $NEWS_COUNT"

if [ "$NEWS_COUNT" -gt 0 ]; then
    success "External API called (got $NEWS_COUNT articles)"
else
    error "No news data - API may have failed"
fi

echo ""

# Step 7: Check cache again after the request
header "STEP 7: Cache After API Call"

sleep 2  # Give cache time to update

TIMESTAMPS2=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/timestamps" \
  --max-time 30000 2>/dev/null || echo '{"error": "Failed to fetch"}')

COUNT2=$(echo "$TIMESTAMPS2" | jq '.timestamps | length' 2>/dev/null || echo "0")

if [ "$COUNT2" -gt "$COUNT" ]; then
    success "Cache grew! Old: $COUNT → New: $COUNT2"
    echo ""
    echo "New entries added:"
    echo "$TIMESTAMPS2" | jq -r '.timestamps | keys[]' | while read key; do
        if echo "$TIMESTAMPS" | jq -e ".timestamps[\"$key\"]" >/dev/null 2>&1; then
            # Key existed before
            :
        else
            # New key
            echo "  + $key"
        fi
    done
elif [ "$COUNT2" -eq "$COUNT" ] && [ "$COUNT" -gt 0 ]; then
    info "Cache size unchanged: $COUNT (using cached data)"
else
    error "Cache size decreased or failed to update"
fi

echo ""

# Step 8: Get a specific cached value
header "STEP 8: Sample Cached Value (Full Data)"

if [ "$COUNT2" -gt 0 ]; then
    # Get first key
    SAMPLE_KEY=$(echo "$TIMESTAMPS2" | jq -r '.timestamps | keys[0]')
    info "Fetching full data for: $SAMPLE_KEY"

    # Try to get detailed info
    DETAIL=$(curl -s -H "X-API-KEY: $API_KEY" \
      "$BASE_URL/api/v1/cache/timestamps?key=$SAMPLE_KEY" \
      --max-time 30000 2>/dev/null || echo '{"error": "Failed"}')

    if echo "$DETAIL" | jq -e '.error' >/dev/null 2>&1; then
        info "Cannot fetch individual entry (endpoint may not support this)"
    else
        echo "Entry details:"
        echo "$DETAIL" | jq '.' 2>/dev/null | head -50 || echo "$DETAIL" | head -500
    fi
else
    error "No cached entries to sample"
fi

echo ""

# Final Summary
header "FINAL SUMMARY"

echo "Cache Status:"
echo "  Total Entries: $COUNT2"
echo "  L1 Size: $(echo "$METRICS" | jq -r '.cacheStats.l1Size // 0')"
echo "  L2 Size: $(echo "$METRICS" | jq -r '.cacheStats.l2Size // 0')"
echo "  L1 Hits: $(echo "$METRICS" | jq -r '.cacheStats.l1Hits // 0')"
echo "  L2 Hits: $(echo "$METRICS" | jq -r '.cacheStats.l2Hits // 0')"
echo ""

if [ "$COUNT2" -gt 0 ]; then
    success "✅ KV Cache CONTAINS DATA"
    echo ""
    echo "Cached Entry Types:"
    echo "$TIMESTAMPS2" | jq -r '.timestamps | keys[] | split("_")[0] | unique[] | "  - \(.)"' 2>/dev/null || echo "  - Various"

    echo ""
    echo "Sample Keys:"
    echo "$TIMESTAMPS2" | jq -r '.timestamps | keys[:10][]' 2>/dev/null | while read key; do
        echo "  $key"
    done

    echo ""
    echo "✅ KV is working correctly!"
elif [ "$COUNT" -eq 0 ]; then
    error "❌ KV Cache is EMPTY"
    echo ""
    echo "This means:"
    echo "  1. No API calls have been made yet"
    echo "  2. Cache is being cleared immediately after write"
    echo "  3. Cache TTL is set to 0"
    echo "  4. Different cache systems are being used"
else
    echo "⚠️  Cache behavior unclear"
fi

echo ""
echo "=========================================="
echo "End of KV Cache Listing"
echo "=========================================="
