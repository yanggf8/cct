#!/bin/bash
# Test script to verify cache metrics show real values after fix
# This confirms routes and metrics use the same cache system

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="test"
TIMEOUT=60000

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

echo "=========================================="
echo "Cache Metrics Fix Verification"
echo "=========================================="
echo ""

# Step 1: Get initial cache metrics
log "Step 1: Checking initial cache metrics..."
METRICS_BEFORE=$(curl -s -H "X-API-KEY: $API_KEY" "$BASE_URL/api/v1/cache/metrics" --max-time $TIMEOUT)

TOTAL_BEFORE=$(echo "$METRICS_BEFORE" | jq -r '.cacheStats.totalRequests // 0')
L1_SIZE_BEFORE=$(echo "$METRICS_BEFORE" | jq -r '.cacheStats.l1Size // 0')
L2_SIZE_BEFORE=$(echo "$METRICS_BEFORE" | jq -r '.cacheStats.l2Size // 0')

echo "Before requests:"
echo "  Total Requests: $TOTAL_BEFORE"
echo "  L1 Size: $L1_SIZE_BEFORE"
echo "  L2 Size: $L2_SIZE_BEFORE"
echo ""

# Step 2: Make requests to populate cache
log "Step 2: Making requests to populate cache..."

symbols=("AAPL" "MSFT" "GOOGL" "TSLA" "NVDA")
SUCCESS_COUNT=0

for symbol in "${symbols[@]}"; do
    log "  Requesting sentiment for $symbol..."
    RESPONSE=$(curl -s -H "X-API-KEY: $API_KEY" "$BASE_URL/api/v1/sentiment/symbols/$symbol" -w "\n%{http_code}" --max-time $TIMEOUT)
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ]; then
        ((SUCCESS_COUNT++))
        echo "    ✓ Success"
    else
        echo "    ✗ Failed (HTTP $HTTP_CODE)"
    fi
    sleep 1
done

echo ""
log "Requests completed: $SUCCESS_COUNT/${#symbols[@]} successful"
echo ""

# Step 3: Check cache metrics after requests
log "Step 3: Checking cache metrics after requests..."
sleep 2  # Give cache time to update

METRICS_AFTER=$(curl -s -H "X-API-KEY: $API_KEY" "$BASE_URL/api/v1/cache/metrics" --max-time $TIMEOUT)

TOTAL_AFTER=$(echo "$METRICS_AFTER" | jq -r '.cacheStats.totalRequests // 0')
L1_SIZE_AFTER=$(echo "$METRICS_AFTER" | jq -r '.cacheStats.l1Size // 0')
L2_SIZE_AFTER=$(echo "$METRICS_AFTER" | jq -r '.cacheStats.l2Size // 0')
L1_HITS_AFTER=$(echo "$METRICS_AFTER" | jq -r '.cacheStats.l1Hits // 0')
L2_HITS_AFTER=$(echo "$METRICS_AFTER" | jq -r '.cacheStats.l2Hits // 0')

echo "After requests:"
echo "  Total Requests: $TOTAL_AFTER"
echo "  L1 Hits: $L1_HITS_AFTER"
echo "  L2 Hits: $L2_HITS_AFTER"
echo "  L1 Size: $L1_SIZE_AFTER"
echo "  L2 Size: $L2_SIZE_AFTER"
echo ""

# Step 4: Verify fix worked
log "Step 4: Verifying cache metrics fix..."

DIFF_TOTAL=$((TOTAL_AFTER - TOTAL_BEFORE))
DIFF_L1=$((L1_SIZE_AFTER - L1_SIZE_BEFORE))
DIFF_L2=$((L2_SIZE_AFTER - L2_SIZE_BEFORE))

echo "Changes:"
echo "  Total Requests: +$DIFF_TOTAL"
echo "  L1 Size: +$DIFF_L1"
echo "  L2 Size: +$DIFF_L2"
echo ""

if [ "$DIFF_TOTAL" -gt 0 ] || [ "$DIFF_L1" -gt 0 ] || [ "$DIFF_L2" -gt 0 ]; then
    success "✓ Cache metrics now show real values!"
    echo ""
    success "The fix is working - routes and metrics now use the same cache system"
    echo ""

    if [ "$L1_SIZE_AFTER" -gt 0 ] || [ "$L2_SIZE_AFTER" -gt 0 ]; then
        success "✓ KV cache is being populated"
    else
        warning "⚠ Cache requests increased but size is still 0 (may need more time)"
    fi

    if [ "$L1_HITS_AFTER" -gt 0 ] || [ "$L2_HITS_AFTER" -gt 0 ]; then
        success "✓ Cache hits detected"
    fi

elif [ "$SUCCESS_COUNT" -gt 0 ]; then
    error "✗ Requests succeeded but cache metrics still show 0"
    echo ""
    echo "Possible issues:"
    echo "1. Cache not enabled in CacheManager"
    echo "2. L2 TTL is 0"
    echo "3. Routes still using old cache system"
    echo ""
    echo "Please check logs for 'Using Enhanced Cache Manager'"
else
    error "✗ Requests failed - cannot test cache metrics"
fi

# Step 5: Test cache warmup endpoint
log ""
log "Step 5: Testing cache warmup endpoint..."
WARMUP_RESPONSE=$(curl -s -X POST -H "X-API-KEY: $API_KEY" "$BASE_URL/api/v1/cache/warmup" \
    -H "Content-Type: application/json" \
    -d '{"strategy": "basic", "preload_symbols": ["AAPL"]}' \
    -w "\n%{http_code}" --max-time $TIMEOUT)

HTTP_CODE=$(echo "$WARMUP_RESPONSE" | tail -1)
BODY=$(echo "$WARMUP_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    success "✓ Cache warmup endpoint works (HTTP 200)"
else
    error "✗ Cache warmup failed (HTTP $HTTP_CODE)"
    echo "Response: $BODY" | head -c 200
fi

# Final Assessment
echo ""
echo "=========================================="
echo "Fix Verification Summary"
echo "=========================================="
echo ""

if [ "$DIFF_TOTAL" -gt 0 ] && [ "$SUCCESS_COUNT" -gt 0 ]; then
    success "✓ CACHE METRICS FIX VERIFIED"
    echo ""
    echo "Routes and metrics now use the same cache system:"
    echo "  • Routes use: CacheManager (EnhancedCacheFactory)"
    echo "  • Metrics read from: CacheManager"
    echo "  • Result: Metrics show real cache activity"
    echo ""
    echo "Expected behavior:"
    echo "  • KV cache populated via routes"
    echo "  • Metrics reflect actual cache usage"
    echo "  • Cache warmup endpoint functional"
    echo "  • No more '0 values' in cache metrics"
else
    error "✗ Cache metrics still show 0"
    echo ""
    echo "Next steps:"
    echo "1. Check if CacheManager is properly initialized"
    echo "2. Verify L2 cache is enabled"
    echo "3. Check logs for 'Using Enhanced Cache Manager'"
    echo "4. Ensure L2 TTL > 0"
fi

echo ""
echo "=========================================="
