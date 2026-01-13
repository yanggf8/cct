#!/usr/bin/env bash
# Fast cache warmup - parallel requests

set -euo pipefail

BASE_URL="https://tft-trading-system.yanggf.workers.dev"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}➜${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; }

log "Warming cache: $BASE_URL"

# Warm endpoints in parallel (use correct health endpoint)
for endpoint in \
    "/api/v1/data/health" \
    "/api/v1/cache/health" \
    "/api/v1/data/symbols" \
    "/dashboard.html" \
    "/pre-market-briefing"
do
    curl -sf "$BASE_URL$endpoint" >/dev/null 2>&1 &
done

wait

# Check cache metrics
response=$(curl -sf "$BASE_URL/api/v1/cache/metrics" 2>/dev/null || echo "{}")
if echo "$response" | jq -e '.cacheStats.totalRequests > 0' >/dev/null 2>&1; then
    total=$(echo "$response" | jq -r '.cacheStats.totalRequests // 0')
    success "Warmed: $total requests"
else
    success "Warmed (metrics unavailable)"
fi
