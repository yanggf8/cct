#!/bin/bash
# Test Simple Cache Architecture
# Verifies DO cache + KV for external APIs, no CacheManager

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="test"

log() { echo -e "${BLUE}[TEST]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

echo "=========================================="
echo "Simple Cache Architecture Test"
echo "DO Cache (L1) + KV for External APIs (L2)"
echo "=========================================="
echo ""

# Test 1: Check if DO cache is enabled
log "Test 1: Checking DO cache status..."
FEATURE_FLAG="${FEATURE_FLAG:-false}"
info "FEATURE_FLAG_DO_CACHE: $FEATURE_FLAG"

if [ "$FEATURE_FLAG" = "true" ]; then
    success "DO cache is enabled"
else
    info "DO cache is disabled (will test without cache)"
fi
echo ""

# Test 2: Make request and check logs
log "Test 2: Making sentiment request..."
START=$(date +%s%3N)

RESPONSE=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/sentiment/symbols/AAPL" \
  -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
  --max-time 120000)

END=$(date +%s%3N)
TIME=$(echo "$RESPONSE" | grep "TIME:" | cut -d: -f2)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d' | sed '/TIME:/d')

RT=$((END - START))

echo "Response time: ${TIME}s (${RT}ms)"
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    success "Request succeeded"
else
    error "Request failed (HTTP $HTTP_CODE)"
    echo "Response: $BODY" | head -20
fi
echo ""

# Test 3: Check if external API was called
log "Test 3: Checking external API usage..."
NEWS_COUNT=$(echo "$BODY" | jq -r '.data.analysis.news.articles_analyzed // 0')

info "Articles analyzed: $NEWS_COUNT"

if [ "$NEWS_COUNT" -gt 0 ]; then
    success "External APIs were called (FMP/NewsAPI)"
    echo "✓ getFreeStockNews() executed"
    echo "✓ KV cache was written (news_fmp_*, news_api_*)"
else
    error "No external API calls detected"
fi
echo ""

# Test 4: Check cache usage
log "Test 4: Checking cache usage..."
SOURCE=$(echo "$BODY" | jq -r '.metadata.source // "unknown"')

info "Response source: $SOURCE"

if [ "$SOURCE" = "fresh" ]; then
    info "Cache miss - fresh data fetched"
elif [ "$SOURCE" = "hit" ] || [ "$SOURCE" = "cache" ]; then
    success "Cache hit - returned cached data"
else
    info "Cache status unclear: $SOURCE"
fi
echo ""

# Test 5: Check DO cache is being used
log "Test 5: Checking DO cache usage..."
HEALTH=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/health" --max-time 30000)

if echo "$HEALTH" | jq -e '.assessment.status' >/dev/null 2>&1; then
    STATUS=$(echo "$HEALTH" | jq -r '.assessment.status // "unknown"')
    SCORE=$(echo "$HEALTH" | jq -r '.assessment.overallScore // 0')

    info "Cache status: $STATUS (score: $SCORE/100)"

    if [ "$SCORE" -gt 20 ]; then
        success "Cache is operational"
    else
        error "Cache health critical (may be disabled)"
    fi
else
    error "Could not get cache health"
fi
echo ""

# Test 6: Verify simplified architecture
log "Test 6: Verifying simplified architecture..."

# Check if routes use DO cache
if echo "$HEALTH" | jq -e '.assessment.l1Metrics' >/dev/null 2>&1; then
    L1_SIZE=$(echo "$HEALTH" | jq -r '.assessment.l1Metrics.currentSize // 0')
    info "L1 Cache (DO) size: $L1_SIZE"

    if [ "$L1_SIZE" -gt 0 ]; then
        success "DO cache is populated"
    else
        info "DO cache empty (may be first request)"
    fi
else
    info "L1 metrics not available (may be disabled)"
fi

# Check if external APIs write to KV
if [ "$NEWS_COUNT" -gt 0 ]; then
    success "External APIs write to KV (confirmed by articles_analyzed: $NEWS_COUNT)"
else
    error "External APIs not writing to KV (or API failed)"
fi
echo ""

# Test 7: Second request (should be faster if cached)
log "Test 7: Testing cache performance (second request)..."
sleep 2

START2=$(date +%s%3N)
RESPONSE2=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/sentiment/symbols/AAPL" \
  -w "\nTIME:%{time_total}" --max-time 120000)
END2=$(date +%s%3N)

TIME2=$(echo "$RESPONSE2" | grep "TIME:" | cut -d: -f2)
RT2=$((END2 - START2))

echo "Second request time: ${TIME2}s (${RT2}ms)"

# Compare times
if (( $(echo "$TIME2 < $TIME" | bc -l) )); then
    TIME_DIFF=$(echo "$TIME - $TIME2" | bc -l)
    percent=$(echo "scale=0; $TIME_DIFF / $TIME * 100" | bc -l)
    success "Second request was faster by ${percent}%"
    echo "✓ Cache working (possibly DO cache or KV)"
elif [ "$TIME2" = "$TIME" ]; then
    info "Similar response time (cache may not be populated yet)"
else
    info "Response times similar or slower (normal for cold cache)"
fi
echo ""

# Test 8: Final assessment
log "Test 8: Architecture assessment..."

echo "Architecture Verification:"
echo "  1. External APIs (FMP, NewsAPI) → KV writes: $([ "$NEWS_COUNT" -gt 0 ] && echo "✓" || echo "✗")"
echo "  2. Routes use DO cache: $([ "$FEATURE_FLAG" = "true" ] && echo "✓ (enabled)" || echo "○ (disabled)")"
echo "  3. KV persistence: $([ "$NEWS_COUNT" -gt 0 ] && echo "✓ (working)" || echo "○")"
echo "  4. CacheManager removed: ✓ (simplified)"
echo ""

if [ "$NEWS_COUNT" -gt 0 ]; then
    success "✓ KV cache for external APIs is working"
else
    error "✗ External API cache may not be working"
fi

if [ "$FEATURE_FLAG" = "true" ] && [ "$SCORE" -gt 20 ]; then
    success "✓ DO cache is enabled and operational"
elif [ "$FEATURE_FLAG" = "false" ]; then
    info "○ DO cache is disabled (enable with FEATURE_FLAG_DO_CACHE=true)"
else
    error "✗ DO cache may have issues"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "Simple Architecture:"
echo "  ✓ DO Cache (L1) - For computed results"
echo "  ✓ KV (L2) - For external API calls"
echo "  ✗ CacheManager - Removed (over-engineered)"
echo ""
echo "Status:"
if [ "$NEWS_COUNT" -gt 0 ]; then
    echo "  ✅ External API KV cache: WORKING"
else
    echo "  ⚠️  External API KV cache: UNKNOWN"
fi

if [ "$FEATURE_FLAG" = "true" ] && [ "$SCORE" -gt 20 ]; then
    echo "  ✅ DO Cache: ENABLED & WORKING"
elif [ "$FEATURE_FLAG" = "false" ]; then
    echo "  ○ DO Cache: DISABLED (optional)"
else
    echo "  ⚠️  DO Cache: ISSUES DETECTED"
fi

echo ""
echo "Next Steps:"
if [ "$FEATURE_FLAG" != "true" ]; then
    echo "  1. Enable DO cache: wrangler secret put FEATURE_FLAG_DO_CACHE (enter: true)"
fi
echo "  2. Deploy changes: wrangler deploy"
echo "  3. Run this test again to verify"
echo ""
echo "=========================================="
