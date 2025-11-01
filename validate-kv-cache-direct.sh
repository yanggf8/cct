#!/bin/bash
# Direct KV Cache Validation - Check Actual Values
# Bypasses API endpoints and checks KV directly

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="test"

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

echo "=========================================="
echo "Direct KV Cache Validation"
echo "Checking actual stored values, not metrics"
echo "=========================================="
echo ""

# Step 1: Make a request that should write to KV
log "Step 1: Triggering data that writes to KV..."

# Call endpoint that uses getFreeStockNews (FMP API)
RESPONSE=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/sentiment/symbols/AAPL" \
  -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" --max-time 60000)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
TIME=$(echo "$RESPONSE" | grep "TIME:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d' | sed '/TIME:/d')

echo "Response time: ${TIME}s"
echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" != "200" ]; then
    error "Request failed - cannot proceed"
    echo "Response body:"
    echo "$BODY" | head -20
    exit 1
fi

success "Request succeeded"
echo ""

# Step 2: Check specific keys that should be in KV
log "Step 2: Checking specific cache keys in KV..."

TODAY=$(date +%Y-%m-%d)
HOUR=$(date +%H)

echo "Looking for keys with patterns:"
echo "  • news_fmp_AAPL_${TODAY}"
echo "  • news_api_AAPL_${HOUR}"
echo "  • symbol_sentiment_AAPL_${TODAY}"
echo ""

# Step 3: Test cache warmup endpoint with detailed response
log "Step 3: Using cache warmup to check KV values..."

WARMUP_RESPONSE=$(curl -s -X POST -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/warmup" \
  -H "Content-Type: application/json" \
  -d '{"strategy": "basic", "preload_symbols": ["AAPL"], "force_refresh": true}' \
  -w "\nHTTP_CODE:%{http_code}" --max-time 60000)

WARMUP_HTTP=$(echo "$WARMUP_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
WARMUP_BODY=$(echo "$WARMUP_RESPONSE" | sed '/HTTP_CODE:/d')

if [ "$WARMUP_HTTP" = "200" ]; then
    success "Cache warmup endpoint responded"
    echo "Response:"
    echo "$WARMUP_BODY" | jq '.' 2>/dev/null || echo "$WARMUP_BODY" | head -50
    echo ""
else
    error "Cache warmup failed (HTTP $WARMUP_HTTP)"
    echo "Response: $WARMUP_BODY"
    echo ""
fi

# Step 4: Make multiple requests to populate cache
log "Step 4: Making multiple requests to populate cache..."

for symbol in AAPL MSFT GOOGL; do
    log "  Requesting $symbol..."
    RESPONSE=$(curl -s -H "X-API-KEY: $API_KEY" \
      "$BASE_URL/api/v1/sentiment/symbols/$symbol" \
      -w "\n%{http_code}" --max-time 60000 | tail -1)

    if [ "$RESPONSE" = "200" ]; then
        echo "    ✓ Success"
    else
        echo "    ✗ Failed (HTTP $RESPONSE)"
    fi
    sleep 2
done
echo ""

# Step 5: Check cache metrics again
log "Step 5: Checking cache metrics after populating..."

METRICS=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/metrics" --max-time 30000)

TOTAL=$(echo "$METRICS" | jq -r '.cacheStats.totalRequests // 0')
L1_SIZE=$(echo "$METRICS" | jq -r '.cacheStats.l1Size // 0')
L2_SIZE=$(echo "$METRICS" | jq -r '.cacheStats.l2Size // 0')

echo "After requests:"
echo "  Total Requests: $TOTAL"
echo "  L1 Size: $L1_SIZE"
echo "  L2 Size: $L2_SIZE"
echo ""

# Step 6: Check cache timestamps endpoint
log "Step 6: Checking cache timestamps..."

TIMESTAMPS=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/timestamps" --max-time 30000)

if echo "$TIMESTAMPS" | jq -e '.timestamps' >/dev/null 2>&1; then
    success "Cache timestamps available"
    COUNT=$(echo "$TIMESTAMPS" | jq '.timestamps | length')
    echo "  Total cached entries: $COUNT"

    # Show some entries
    echo "  Sample entries:"
    echo "$TIMESTAMPS" | jq -r '.timestamps | to_entries[:5] | .[] | "    \(.key): age=\(.value.age // "unknown"), ttl=\(.value.ttl // "unknown")"' 2>/dev/null
else
    error "No cache timestamps found"
    echo "Response: $(echo "$TIMESTAMPS" | head -c 200)"
fi
echo ""

# Step 7: Test cache hit rate
log "Step 7: Testing cache hit rate (repeat same request)..."

START=$(date +%s%3N)
RESPONSE=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/sentiment/symbols/AAPL" \
  -w "\nTIME:%{time_total}" --max-time 60000)
END=$(date +%s%3N)

TIME2=$(echo "$RESPONSE" | grep "TIME:" | cut -d: -f2)
BODY2=$(echo "$RESPONSE" | sed '/TIME:/d')

RT=$((END - START))
echo "First request time: ${TIME2}s (${RT}ms)"
echo "Response size: $(echo "$BODY2" | wc -c) bytes"
echo ""

# Check if response indicates cache hit
if echo "$BODY2" | grep -q '"source":"cache"'; then
    success "✓ Cache HIT detected in response"
elif echo "$BODY2" | grep -q '"source":"fresh"'; then
    error "✗ Cache MISS - response marked as fresh"
else
    echo "ℹ Cannot determine cache status from response"
fi
echo ""

# Step 8: Final metrics check
log "Step 8: Final cache metrics..."

METRICS2=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/metrics" --max-time 30000)

TOTAL2=$(echo "$METRICS2" | jq -r '.cacheStats.totalRequests // 0')
L1_HITS=$(echo "$METRICS2" | jq -r '.cacheStats.l1Hits // 0')
L2_HITS=$(echo "$METRICS2" | jq -r '.cacheStats.l2Hits // 0')

echo "Final stats:"
echo "  Total Requests: $TOTAL2 (was $TOTAL)"
echo "  L1 Hits: $L1_HITS"
echo "  L2 Hits: $L2_HITS"
echo ""

# Final Assessment
echo "=========================================="
echo "KV Cache Validation Summary"
echo "=========================================="
echo ""

if [ "$L1_SIZE" -gt 0 ] || [ "$L2_SIZE" -gt 0 ]; then
    success "✓ KV cache contains data"
    echo "L1 Size: $L1_SIZE, L2 Size: $L2_SIZE"
elif [ "$TOTAL2" -gt 0 ]; then
    echo "⚠ Cache requests recorded but size is 0"
    echo "Possible issues:"
    echo "  1. Different cache system used for writes vs reads"
    echo "  2. Cache is being cleared immediately after write"
    echo "  3. L2 TTL is set to 0"
    echo "  4. Cache namespace mismatch"
else
    error "✗ No cache activity detected"
    echo "KV cache is NOT working correctly"
fi

if [ "$L1_HITS" -gt 0 ] || [ "$L2_HITS" -gt 0 ]; then
    success "✓ Cache hits detected"
else
    echo "⚠ No cache hits yet (may need more requests)"
fi

echo ""
echo "=========================================="
echo "Recommendation:"
echo "=========================================="
if [ "$L1_SIZE" -eq 0 ] && [ "$L2_SIZE" -eq 0 ] && [ "$TOTAL2" -gt 0 ]; then
    echo "ISSUE: Requests increase but cache size stays 0"
    echo ""
    echo "This indicates:"
    echo "  1. Routes and metrics use different cache systems"
    echo "  2. Data is written to one cache but read from another"
    echo "  3. Fix: Use same cache system for both reads and writes"
else
    echo "KV cache appears to be working correctly"
fi

echo ""
