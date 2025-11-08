#!/bin/bash
# Quick KV Cache Listing - Minimal output, just the facts

BASE_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="test"

echo "=========================================="
echo "KV Cache - Quick List"
echo "=========================================="
echo ""

# Get cache timestamps
TIMESTAMPS=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/timestamps" --max-time 30000 2>/dev/null)

COUNT=$(echo "$TIMESTAMPS" | jq '.timestamps | length' 2>/dev/null || echo "0")

echo "Total cached entries: $COUNT"
echo ""

if [ "$COUNT" -gt 0 ]; then
    echo "All cached keys:"
    echo "$TIMESTAMPS" | jq -r '.timestamps | keys[]' 2>/dev/null | nl

    echo ""
    echo "By type:"
    echo "  news_fmp_*: $(echo "$TIMESTAMPS" | jq -r '.timestamps | keys[] | select(startswith("news_fmp_")) | length' 2>/dev/null)"
    echo "  news_api_*: $(echo "$TIMESTAMPS" | jq -r '.timestamps | keys[] | select(startswith("news_api_")) | length' 2>/dev/null)"
    echo "  symbol_sentiment_*: $(echo "$TIMESTAMPS" | jq -r '.timestamps | keys[] | select(startswith("symbol_sentiment_")) | length' 2>/dev/null)"
    echo ""

    echo "Sample entry details:"
    echo "$TIMESTAMPS" | jq -r '.timestamps | to_entries[0] | "Key: \(.key)\n  Age: \(.value.age // .value.ageFormatted // "unknown")\n  TTL: \(.value.ttl // "unknown")\n  Source: \(.value.cacheSource // "unknown")"'
else
    echo "❌ No cached entries found"
fi

echo ""
echo "=========================================="

# Also show metrics
METRICS=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/v1/cache/metrics" --max-time 30000 2>/dev/null)

echo ""
echo "Cache Statistics:"
echo "  Total Requests: $(echo "$METRICS" | jq -r '.cacheStats.totalRequests // 0')"
echo "  L1 Hits: $(echo "$METRICS" | jq -r '.cacheStats.l1Hits // 0')"
echo "  L2 Hits: $(echo "$METRICS" | jq -r '.cacheStats.l2Hits // 0')"
echo "  L1 Size: $(echo "$METRICS" | jq -r '.cacheStats.l1Size // 0')"
echo "  L2 Size: $(echo "$METRICS" | jq -r '.cacheStats.l2Size // 0')"
echo "=========================================="
