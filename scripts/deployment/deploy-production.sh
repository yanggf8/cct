#!/usr/bin/env bash
# Fast Production Deployment
# Usage: npm run deploy           # Interactive
#        npm run deploy -- --yes  # Skip confirmation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOYMENT_URL="https://tft-trading-system.yanggf.workers.dev"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}➜${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; }

START=$(date +%s)

# Parse args
SKIP_CONFIRM=0
for arg in "$@"; do
    [[ "$arg" == "--yes" || "$arg" == "-y" ]] && SKIP_CONFIRM=1
done

# CI auto-skip
[[ -n "${CI:-}" ]] && SKIP_CONFIRM=1

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

# Git check
if [ "$SKIP_CONFIRM" = "0" ] && [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    error "Uncommitted changes"
    git status --short
    exit 1
fi

# Confirmation
if [ "$SKIP_CONFIRM" = "0" ]; then
    log "Deploy to $DEPLOYMENT_URL?"
    read -p "Press Enter to deploy, Ctrl+C to cancel..."
    echo
fi

# Build
log "Building..."
npm run build &
BUILD_PID=$!

# Show spinner while build runs
spinners=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
i=0
while kill -0 $BUILD_PID 2>/dev/null; do
    printf "\r${BLUE}${spinners[$((i % 10))]}${NC} Building... "
    sleep 0.1
    ((i++))
done

# Wait for build and check result
if wait $BUILD_PID; then
    printf "\r${GREEN}✓${NC} Build complete     \n"
else
    printf "\r${RED}✗${NC} Build failed       \n"
    exit 1
fi

# Deploy
log "Deploying..."
if env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID $WRANGLER_BIN deploy; then
    success "Deployed"
else
    error "Failed"
    exit 1
fi

# Quick health check (use correct endpoint)
if curl -sf "$DEPLOYMENT_URL/api/v1/data/health" >/dev/null 2>&1; then
    success "Healthy"
fi

success "Done in $(($(date +%s) - START))s"
log "URL: $DEPLOYMENT_URL"
