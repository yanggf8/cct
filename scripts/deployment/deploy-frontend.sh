#!/usr/bin/env bash
# Fast frontend deployment

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOYMENT_URL="https://tft-trading-system.yanggf.workers.dev"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}➜${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; }

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

SKIP_BACKEND=false
[[ "${1:-}" == "--skip-backend" ]] && SKIP_BACKEND=true

log "Building frontend..."
npm run build:frontend:only || { error "Build failed"; exit 1; }

if [ "$SKIP_BACKEND" = false ]; then
    log "Building backend..."
    npm run build:backend || { error "Backend build failed"; exit 1; }
fi

log "Deploying..."
env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID $WRANGLER_BIN deploy

curl -sf "$DEPLOYMENT_URL/api/v1/data/health" >/dev/null 2>&1 && success "Healthy"
success "Done: $DEPLOYMENT_URL"
