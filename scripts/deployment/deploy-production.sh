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

# Checks (fast)
command -v wrangler >/dev/null 2>&1 || { error "wrangler not found"; exit 1; }

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

# Deploy (predeploy hook in package.json handles build)
log "Deploying..."
if env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID wrangler deploy; then
    success "Deployed"
else
    error "Failed"
    exit 1
fi

# Quick health check
curl -sf "$DEPLOYMENT_URL/api/v1/health" >/dev/null 2>&1 && success "Healthy"

success "Done in $(($(date +%s) - START))s"
