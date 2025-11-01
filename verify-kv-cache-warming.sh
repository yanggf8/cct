#!/bin/bash
# Comprehensive KV Cache Warming Verification Script
# Checks actual cache values, not just HTTP 200 responses

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="test"
TIMEOUT=30000

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

echo "=========================================="
echo "KV Cache Warming Verification"
echo "=========================================="
echo ""

# Test 1: Check if cache warmup endpoint exists
log "Test 1: Checking cache warmup endpoint..."
WARMUP_RESPONSE=$(curl -s -X POST -H "X-API-KEY: $API_KEY" "$BASE_URL/api/v1/cache/warmup" -w "\n%{http_code}" --max-time $TIMEOUT)
HTTP_CODE=$(echo "$WARMUP_RESPONSE" | tail -1)
BODY=$(echo "$WARMUP_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    success "Cache warmup endpoint exists and responded"
    echo "Response: $BODY" | head -20
elif [ "$HTTP_CODE" = "404" ]; then
    error "Cache warmup endpoint NOT found (404)"
    warning "This means KV cache cannot be warmed automatically"
else
    warning "Cache warmup endpoint returned: HTTP $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 2: Check cache metrics before warmup
log "Test 2: Checking initial cache metrics..."
METRICS_BEFORE=$(curl -s -H "X-API-KEY: $API_KEY" "$BASE_URL/api/v1/cache/metrics" --max-time $TIMEOUT)

TOTAL_BEFORE=$(echo "$METRICS_BEFORE" | jq -r '.cacheStats.totalRequests // 0')
L1_HITS_BEFORE=$(echo "$METRICS_BEFORE" | jq -r '.cacheStats.l1Hits // 0')
L2_HITS_BEFORE=$(echo "$METRICS_BEFORE" | jq -r '.cacheStats.l2Hits // 0')
L1_SIZE_BEFORE=$(echo "$METRICS_BEFORE" | jq -r '.cacheStats.l1Size // 0')
L2_SIZE_BEFORE=$(echo "$METRICS_BEFORE" | jq -r '.cacheStats.l2Size // 0')

echo "Before warmup:"
echo "  Total Requests: $TOTAL_BEFORE"
echo "  L1 Hits: $L1_HITS_BEFORE"
echo "  L2 Hits: $L2_HITS_BEFORE"
echo "  L1 Size: $L1_SIZE_BEFORE"
echo "  L2 Size: $L2_SIZE_BEFORE"
echo ""

# Test 3: Warm up cache by hitting critical endpoints
log "Test 3: Warming cache manually..."

symbols=("AAPL" "MSFT" "GOOGL" "TSLA" "NVDA")
WARMUP_SUCCESS=0
WARMUP_TOTAL=0

# Warm up symbols list
log "  - Fetching symbols list..."
RESPONSE=$(curl -s -H "X-API-KEY: $API_KEY" "$BASE_URL/api/v1/data/symbols" -w "\n%{http_code}" --max-time $TIMEOUT)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "200" ]; then
    ((WARMUP_SUCCESS++))
    success "    Symbols list fetched"
else
    error "    Symbols list failed: HTTP $HTTP_CODE"
fi
((WARMUP_TOTAL++))
sleep 1

# Warm up sentiment analysis for each symbol
for symbol in "${symbols[@]}"; do
    log "  - Fetching sentiment for $symbol..."
    RESPONSE=$(curl -s -H "X-API-KEY: $API_KEY" "$BASE_URL/api/v1/sentiment/symbols/$symbol" -w "\n%{http_code}" --max-time $TIMEOUT)
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" = "200" ]; then
        ((WARMUP_SUCCESS++))
        success "    $symbol sentiment fetched"
    else
        error "    $symbol sentiment failed: HTTP $HTTP_CODE"
    fi
    ((WARMUP_TOTAL++))
    sleep 1
done

echo ""
log "Warmup results: $WARMUP_SUCCESS/$WARMUP_TOTAL endpoints successful"
echo ""

# Test 4: Check cache metrics after warmup
log "Test 4: Checking cache metrics after warmup..."
sleep 2  # Give cache time to update

METRICS_AFTER=$(curl -s -H "X-API-KEY: $API_KEY" "$BASE_URL/api/v1/cache/metrics" --max-time $TIMEOUT)

TOTAL_AFTER=$(echo "$METRICS_AFTER" | jq -r '.cacheStats.totalRequests // 0')
L1_HITS_AFTER=$(echo "$METRICS_AFTER" | jq -r '.cacheStats.l1Hits // 0')
L2_HITS_AFTER=$(echo "$METRICS_AFTER" | jq -r '.cacheStats.l2Hits // 0')
L1_SIZE_AFTER=$(echo "$METRICS_AFTER" | jq -r '.cacheStats.l1Size // 0')
L2_SIZE_AFTER=$(echo "$METRICS_AFTER" | jq -r '.cacheStats.l2Size // 0')

echo "After warmup:"
echo "  Total Requests: $TOTAL_AFTER"
echo "  L1 Hits: $L1_HITS_AFTER"
echo "  L2 Hits: $L2_HITS_AFTER"
echo "  L1 Size: $L1_SIZE_AFTER"
echo "  L2 Size: $L2_SIZE_AFTER"
echo ""

# Test 5: Verify cache hit rate improved
log "Test 5: Verifying cache effectiveness..."

REQ_DIFF=$((TOTAL_AFTER - TOTAL_BEFORE))
L1_DIFF=$((L1_HITS_AFTER - L1_HITS_BEFORE))
L2_DIFF=$((L2_HITS_AFTER - L2_HITS_BEFORE))

echo "Differences:"
echo "  Requests: +$REQ_DIFF"
echo "  L1 Hits: +$L1_DIFF"
echo "  L2 Hits: +$L2_DIFF"
echo ""

if [ "$REQ_DIFF" -gt 0 ]; then
    success "Cache is being used (requests increased)"
else
    error "Cache not being used (no request increase)"
fi

if [ "$L1_SIZE_AFTER" -gt "$L1_SIZE_BEFORE" ] || [ "$L2_SIZE_AFTER" -gt "$L2_SIZE_BEFORE" ]; then
    success "Cache is populated (size increased)"
    echo "  L1 size change: $L1_SIZE_BEFORE → $L1_SIZE_AFTER"
    echo "  L2 size change: $L2_SIZE_BEFORE → $L2_SIZE_AFTER"
else
    warning "Cache may not be populated (sizes unchanged)"
    echo "  L1 size: $L1_SIZE_BEFORE → $L1_SIZE_AFTER"
    echo "  L2 size: $L2_SIZE_BEFORE → $L2_SIZE_AFTER"
fi
echo ""

# Test 6: Test actual cached endpoint performance
log "Test 6: Testing cached endpoint performance..."

START=$(date +%s%3N)
RESPONSE=$(curl -s -H "X-API-KEY: $API_KEY" "$BASE_URL/api/v1/sentiment/symbols/AAPL" --max-time $TIMEOUT)
END=$(date +%s%3N)
RESPONSE_TIME=$((END - START))

HTTP_CODE=$(echo "$RESPONSE" | tail -1 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    success "Cached endpoint responded in ${RESPONSE_TIME}ms"

    # Check if response has real data
    HAS_REAL_DATA=$(echo "$RESPONSE" | jq -r '.data.real_data // false')
    if [ "$HAS_REAL_DATA" = "true" ]; then
        success "Response contains real data (not cached dummy data)"
    else
        warning "Response may not contain real data"
        echo "Sample response structure:"
        echo "$RESPONSE" | jq '.' | head -20
    fi
else
    error "Cached endpoint failed: HTTP $HTTP_CODE"
fi
echo ""

# Test 7: Check cache metadata
log "Test 7: Checking cache metadata..."
METADATA=$(curl -s -H "X-API-KEY: $API_KEY" "$BASE_URL/api/v1/cache/timestamps" --max-time $TIMEOUT)

if echo "$METADATA" | jq -e '.timestamps' >/dev/null 2>&1; then
    success "Cache timestamps available"
    TIMESTAMP_COUNT=$(echo "$METADATA" | jq '.timestamps | length')
    echo "  Cached entries: $TIMESTAMP_COUNT"

    # Show some example timestamps
    echo "  Sample entries:"
    echo "$METADATA" | jq -r '.timestamps | to_entries[:5] | .[] | "    \(.key): \(.value.age // "unknown") ago"' 2>/dev/null || true
else
    warning "Cache timestamps not available"
    echo "Response: $(echo "$METADATA" | head -c 200)"
fi
echo ""

# Final Assessment
echo "=========================================="
echo "KV Cache Warming Assessment"
echo "=========================================="
echo ""

if [ "$L1_SIZE_AFTER" -gt 0 ] || [ "$L2_SIZE_AFTER" -gt 0 ]; then
    success "✓ KV cache IS being warmed and populated"
    echo "  Cache is working and contains data"
else
    error "✗ KV cache is NOT being warmed properly"
    echo "  Cache is empty or not functioning"
    echo ""
    echo "  Possible issues:"
    echo "  1. Cache warmup endpoint not accessible"
    echo "  2. Cache not properly configured"
    echo "  3. KV namespace not bound correctly"
    echo "  4. Cache TTL too short"
fi

if [ "$WARMUP_SUCCESS" -gt 0 ]; then
    echo ""
    echo "  Warmup endpoint accessibility: $WARMUP_SUCCESS/$WARMUP_TOTAL successful"
fi

echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo "1. Review cache configuration in wrangler.toml"
echo "2. Check KV namespace bindings"
echo "3. Verify cache warmup endpoint is accessible"
echo "4. Run GitHub Actions cache warmup workflow"
echo "5. Monitor cache metrics after deployment"
echo ""
