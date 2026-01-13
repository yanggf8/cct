#!/usr/bin/env bash
# Quick deploy - skip build, deploy current artifacts

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOYMENT_URL="https://tft-trading-system.yanggf.workers.dev"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}➜${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; }
warning() { echo -e "${YELLOW}⚠${NC} $*"; }

cd "$PROJECT_ROOT"

# Use local wrangler if available, fallback to global
WRANGLER_BIN=""
if [ -x "node_modules/.bin/wrangler" ]; then
    WRANGLER_BIN="node_modules/.bin/wrangler"
elif command -v wrangler >/dev/null 2>&1; then
    WRANGLER_BIN="wrangler"
else
    error "wrangler not found. Run: npm install"
    exit 1
fi

SKIP_CONFIRM="${SKIP_CONFIRM:-0}"
[ "${SKIP_CONFIRM}" != "1" ] && [ -z "${CI:-}" ] && {
    log "Quick deploy (no build) - Ctrl+C to cancel..."
    read -t 5 -p "Deploying in 5s... " || true
    echo
}

log "Deploying..."
env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID $WRANGLER_BIN deploy

curl -sf "$DEPLOYMENT_URL/api/v1/data/health" >/dev/null 2>&1 && success "Healthy"
success "Done: $DEPLOYMENT_URL"
warning "Tip: Fix TypeScript errors before next full deploy"
