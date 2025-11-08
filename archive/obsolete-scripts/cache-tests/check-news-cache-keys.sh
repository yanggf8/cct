#!/bin/bash
# Check if News API cache keys exist in KV
# Specifically looks for keys written by getFreeStockNews()

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="test"

log() { echo -e "${BLUE}[CHECK]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

echo "=========================================="
echo "News API Cache Key Validation"
echo "Checking if getFreeStockNews() writes to KV"
echo "=========================================="
echo ""

TODAY=$(date +%Y-%m-%d)
HOUR=$(date +%H)

log "Looking for cache keys that should exist:"
echo "  1. news_fmp_AAPL_$TODAY (FMP News API cache)"
echo "  2. news_api_AAPL_$HOUR (NewsAPI cache)"
echo "  3. symbol_sentiment_AAPL_$TODAY (Route cache)"
echo ""

# Test endpoint that uses getFreeStockNews
log "Step 1: Trigger getFreeStockNews() by requesting AAPL sentiment..."

RESPONSE=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/sentiment/symbols/AAPL" \
  -w "\nHTTP_CODE:%{http_code}" --max-time 120000)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

if [ "$HTTP_CODE" != "200" ]; then
    error "Request failed (HTTP $HTTP_CODE)"
    echo "Response: $BODY"
    exit 1
fi

success "Request succeeded"
echo ""

# Check if response indicates news was fetched
NEWS_COUNT=$(echo "$BODY" | jq -r '.data.analysis.news.articles_analyzed // 0')
info "Articles analyzed in response: $NEWS_COUNT"

if [ "$NEWS_COUNT" -gt 0 ]; then
    success "News data was fetched (articles_analyzed: $NEWS_COUNT)"
else
    error "No news data in response (articles_analyzed: $NEWS_COUNT)"
fi

echo ""
log "Step 2: Check if news cache keys were created..."

# Check the timestamp endpoint for news-related entries
TIMESTAMPS=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/timestamps" --max-time 30000)

if echo "$TIMESTAMPS" | jq -e '.timestamps' >/dev/null 2>&1; then
    COUNT=$(echo "$TIMESTAMPS" | jq '.timestamps | length')
    echo "  Total cached entries found: $COUNT"

    # Look for news-related keys
    FMP_KEYS=$(echo "$TIMESTAMPS" | jq -r '.timestamps | keys[] | select(startswith("news_fmp_")) | @json' 2>/dev/null | wc -l)
    API_KEYS=$(echo "$TIMESTAMPS" | jq -r '.timestamps | keys[] | select(startswith("news_api_")) | @json' 2>/dev/null | wc -l)
    SENTIMENT_KEYS=$(echo "$TIMESTAMPS" | jq -r '.timestamps | keys[] | select(startswith("symbol_sentiment_")) | @json' 2>/dev/null | wc -l)

    echo ""
    info "Key breakdown:"
    echo "  news_fmp_* keys: $FMP_KEYS"
    echo "  news_api_* keys: $API_KEYS"
    echo "  symbol_sentiment_* keys: $SENTIMENT_KEYS"
    echo ""

    if [ "$FMP_KEYS" -gt 0 ] || [ "$API_KEYS" -gt 0 ]; then
        success "✓ News API cache keys exist in KV"
        echo ""
        echo "Sample news cache keys:"
        echo "$TIMESTAMPS" | jq -r '.timestamps | keys[] | select(startswith("news_")) | "  \(.): \(.timestamp // .age)"' | head -10
    else
        error "✗ No news API cache keys found"
    fi

    if [ "$SENTIMENT_KEYS" -gt 0 ]; then
        success "✓ Sentiment analysis cache keys exist"
        echo ""
        echo "Sample sentiment cache keys:"
        echo "$TIMESTAMPS" | jq -r '.timestamps | keys[] | select(startswith("symbol_sentiment_")) | "  \(.): \(.timestamp // .age)"' | head -5
    else
        error "✗ No sentiment analysis cache keys found"
    fi

else
    error "Could not get cache timestamps"
    echo "Response: $(echo "$TIMESTAMPS" | head -c 200)"
fi

echo ""
log "Step 3: Verify cache metrics match actual data..."

METRICS=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/metrics" --max-time 30000)

L2_SIZE=$(echo "$METRICS" | jq -r '.cacheStats.l2Size // 0')

if [ "$L2_SIZE" -gt 0 ]; then
    success "Cache metrics show L2 size: $L2_SIZE"
else
    error "Cache metrics show L2 size: $L2_SIZE (empty!)"
fi

echo ""
log "Step 4: Make another request to test cache hit..."

START=$(date +%s%3N)
RESPONSE2=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/sentiment/symbols/AAPL" \
  -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" --max-time 120000)
END=$(date +%s%3N)

TIME_TOTAL=$(echo "$RESPONSE2" | grep "TIME:" | cut -d: -f2)
RT=$((END - START))

echo "Second request time: ${TIME_TOTAL}s (${RT}ms)"

if [ "$TIME_TOTAL" -lt "5" ]; then
    success "✓ Fast response (< 5s) - likely cached"
elif [ "$TIME_TOTAL" -lt "30" ]; then
    info "Moderate response (${TIME_TOTAL}s) - may be cached"
else
    error "✗ Slow response (${TIME_TOTAL}s) - likely not cached"
fi

echo ""
log "Step 5: Final verification..."

METRICS2=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/metrics" --max-time 30000)

L1_HITS=$(echo "$METRICS2" | jq -r '.cacheStats.l1Hits // 0')
L2_HITS=$(echo "$METRICS2" | jq -r '.cacheStats.l2Hits // 0')
TOTAL=$(echo "$METRICS2" | jq -r '.cacheStats.totalRequests // 0')

echo "Cache performance:"
echo "  Total Requests: $TOTAL"
echo "  L1 Hits: $L1_HITS"
echo "  L2 Hits: $L2_HITS"

if [ "$L1_HITS" -gt 0 ] || [ "$L2_HITS" -gt 0 ]; then
    success "✓ Cache is working - hits recorded"
else
    error "✗ No cache hits detected"
fi

echo ""
echo "=========================================="
echo "VERDICT"
echo "=========================================="
echo ""

if [ "$FMP_KEYS" -gt 0 ] || [ "$API_KEYS" -gt 0 ]; then
    echo "✅ KV IS being written by external APIs (getFreeStockNews)"
    echo "   News cache keys found: $((FMP_KEYS + API_KEYS))"
    echo ""
    if [ "$SENTIMENT_KEYS" -gt 0 ]; then
        echo "✅ Routes are reading from the same cache"
        echo "   Sentiment cache keys found: $SENTIMENT_KEYS"
        echo ""
        echo "✅ Cache system is working correctly!"
    else
        echo "❌ Routes and news APIs use DIFFERENT cache systems"
        echo "   News APIs write to one cache"
        echo "   Routes read from another cache"
        echo ""
        echo "🔧 FIX NEEDED: Unify cache systems"
    fi
else
    echo "❌ KV is NOT being written by external APIs"
    echo "   No news cache keys found"
    echo ""
    echo "Possible causes:"
    echo "  1. External APIs not being called"
    echo "  2. API keys missing (FMP_API_KEY, NEWSAPI_KEY)"
    echo "  3. getFreeStockNews() failing"
    echo "  4. KV writes failing silently"
fi

echo ""
echo "=========================================="
