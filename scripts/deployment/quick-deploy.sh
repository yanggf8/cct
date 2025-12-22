#!/bin/env bash

# Quick Deployment Script - Skip TypeScript checks for immediate deployment
# Use this when you need to deploy immediately despite TypeScript errors

set -euo pipefail

# Configuration
DEPLOYMENT_URL="https://tft-trading-system.yanggf.workers.dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log() { echo -e "${BLUE}🚀 [QUICK-DEPLOY]${NC} $*"; }
success() { echo -e "${GREEN}✅ [SUCCESS]${NC} $*"; }
warning() { echo -e "${YELLOW}⚠️  [WARNING]${NC} $*"; }
error() { echo -e "${RED}❌ [ERROR]${NC} $*"; }

log "Starting quick deployment (TypeScript checks bypassed)..."

# Set environment for production deployment
export ENVIRONMENT="production"

log "Deploying with OAuth authentication (unsetting API tokens)..."

# Deploy using OAuth approach (unset both tokens to force browser auth, target top-level environment)
if env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID npx wrangler deploy; then
    success "Deployment completed successfully!"
else
    error "Deployment failed"
    exit 1
fi

# Quick verification
sleep 3
log "Quick verification of deployment..."

if curl -s -f "$DEPLOYMENT_URL/api/v1/health" > /dev/null; then
    success "Health check passed"
else
    warning "Health check failed - deployment may still be propagating"
fi

# Test HTML report endpoints
log "Testing HTML report endpoints..."

test_endpoint() {
    local endpoint="$1"
    local description="$2"

    if curl -s -f "$DEPLOYMENT_URL$endpoint" | grep -q "<!DOCTYPE html\|<html"; then
        success "$description - HTML ✓"
    else
        warning "$description - may need time to propagate"
    fi
}

test_endpoint "/pre-market-briefing" "Pre-Market Briefing"
test_endpoint "/intraday-check" "Intraday Check"
test_endpoint "/end-of-day-summary" "End-of-Day Summary"
test_endpoint "/weekly-review" "Weekly Review"

success "Quick deployment completed!"
log "Production URL: $DEPLOYMENT_URL"
log "Dashboard: $DEPLOYMENT_URL/dashboard.html"

warning "Note: TypeScript errors were bypassed. Fix them before production use."
echo ""
log "🌐 Your HTML reports should now be live!"