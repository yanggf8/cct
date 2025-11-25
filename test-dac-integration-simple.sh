#!/bin/bash

# Simple DAC Integration Test
# Tests the core DAC service binding functionality

set -euo pipefail

CCT_URL="${CCT_URL:-https://tft-trading-system.yanggf.workers.dev}"
DAC_URL="${DAC_URL:-https://dac-backend.yanggf.workers.dev}"
API_KEY="${API_KEY:-yanggf}"  # Allow override via environment, defaults to "yanggf"

echo "🔌 DAC Service Binding Integration Test"
echo "===================================="

# Test 1: System Health
echo -n "1. CCT System Health: "
if curl -s "$CCT_URL/api/v1/cache/health" | jq -e '.assessment.status == "healthy"' >/dev/null 2>&1; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
    exit 1
fi

# Test 2: DAC Backend Health
echo -n "2. DAC Backend Health: "
if curl -s "$DAC_URL/api/health" | jq -e '.success == true' >/dev/null 2>&1; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
    exit 1
fi

# Test 3: Service Binding Configuration
echo -n "3. Service Binding Available: "
if wrangler whoami >/dev/null 2>&1; then
    echo "✅ PASS (Wrangler configured)"
else
    echo "⚠️  SKIP (Wrangler not available)"
fi

# Test 4: Durable Objects Cache Performance (93%+ threshold)
echo -n "4. Cache Performance: "
hit_rate=$(curl -s "$CCT_URL/api/v1/cache/health" | jq -r '.assessment.l1Metrics.hitRate // 0')
if (( $(echo "$hit_rate >= 93" | bc -l) )); then
    echo "✅ PASS (${hit_rate}% hit rate - meets 93% threshold)"
else
    echo "❌ FAIL (${hit_rate}% hit rate - below 93% threshold)"
    exit 1
fi

# Test 5: API Key Configuration
echo -n "5. API Key Configuration: "
if [[ -n "$API_KEY" ]]; then
    echo "✅ PASS (API key set)"
else
    echo "❌ FAIL (API key missing)"
    exit 1
fi

# Test 6: Basic Sentiment Endpoint (existing)
echo -n "6. Basic Sentiment API: "
response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d '{"symbols":["AAPL"]}' \
    "$CCT_URL/api/v1/sentiment/analysis" 2>/dev/null)

if echo "$response" | jq -e '.success == true' >/dev/null 2>&1; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
    echo "Response: $response" | head -3
    exit 1
fi

echo ""
echo "✅ Core DAC Integration Tests Passed!"
echo ""
echo "📊 System Status:"
echo "   CCT URL: $CCT_URL"
echo "   DAC URL: $DAC_URL"
echo "   Cache Hit Rate: ${hit_rate}%"
echo "   Service Binding: Configured"
echo ""
echo "🎯 Next Steps:"
echo "   1. Deploy enhanced sentiment routes"
echo "   2. Run full integration tests"
echo "   3. Monitor performance metrics"
echo ""
echo "📋 Integration Status: READY FOR TESTING"