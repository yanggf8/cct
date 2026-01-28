#!/bin/bash
# Backfill intraday data for 2026-01-28 using latest pre-market data

cd /home/yanggf/a/cct

echo "🔄 Triggering intraday job to generate fresh data..."
curl -s -X POST "https://tft-trading-system.yanggf.workers.dev/api/v1/jobs/intraday" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: yanggf" \
  -d '{"symbols": ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"]}' | jq '.'

echo ""
echo "✅ Done. Check https://tft-trading-system.yanggf.workers.dev/intraday-check?date=2026-01-28"
