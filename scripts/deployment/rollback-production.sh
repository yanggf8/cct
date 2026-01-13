#!/usr/bin/env bash
# Fast rollback to previous commit

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}➜${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; }

DEPLOYMENT_URL="https://tft-trading-system.yanggf.workers.dev"

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

# Find previous good commit
LAST_GOOD=$(git log --oneline -5 | grep -i "deploy\|release" | head -1 | cut -d' ' -f1)
[[ -z "$LAST_GOOD" ]] && LAST_GOOD="HEAD~1"

log "Rollback to: $LAST_GOOD"
git log --oneline -3 "$LAST_GOOD"

read -p "Rollback to $LAST_GOOD? (y/n): " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && { log "Cancelled"; exit 0; }

# Checkout and deploy
log "Checking out $LAST_GOOD..."
git checkout "$LAST_GOOD"

log "Building..."
npm run build >/dev/null 2>&1 || { error "Build failed"; git checkout -; exit 1; }

log "Deploying..."
env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID $WRANGLER_BIN deploy

# Verify
curl -sf "$DEPLOYMENT_URL/api/v1/data/health" >/dev/null 2>&1 && success "Healthy"

# Return to master
log "Returning to master branch..."
git checkout - 2>/dev/null || git checkout master 2>/dev/null || git checkout main 2>/dev/null || true

success "Rolled back: $DEPLOYMENT_URL"
