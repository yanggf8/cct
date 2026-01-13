#!/usr/bin/env bash
# Production Rollback Script
# Quick rollback to previous deployment with cache invalidation

set -euo pipefail

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-utils.sh"

# Configuration
WORKER_NAME="${WORKER_NAME:-tft-trading-system}"
ROLLBACK_REASON="${1:-emergency}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_CACHE_INVALIDATION="${SKIP_CACHE_INVALIDATION:-false}"

# Safety checks
log "🚨 Production Rollback: $ROLLBACK_REASON"

check_dependencies || exit 1
check_auth || exit 1

# Git state check
if [ -f "wrangler.toml" ]; then
    success "Project directory verified"
else
    error "wrangler.toml not found. Run from project root."
    exit 1
fi

# Show recent commits
log "\n🔍 Recent Commits (Rollback Candidates)"
git log --oneline -10 --decorate --graph || true

# Find last good commit
LAST_GOOD=$(git log --oneline --grep="deploy\\|release" -n 1 2>/dev/null | cut -d' ' -f1 || echo "HEAD~1")
log "\nTarget rollback commit: $LAST_GOOD"

# Dry run check
if [ "$DRY_RUN" = "true" ]; then
    warning "🧪 DRY RUN MODE - No changes will be made"
    log "Would checkout: $LAST_GOOD"
    log "Would build and deploy rollback version"
    exit 0
fi

# Confirmation
echo ""
read -p "Rollback to $LAST_GOOD? (yes/no): " -r
echo
[[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]] && { log "Rollback cancelled"; exit 0; }

# Perform rollback
log "🔄 Performing rollback..."

# Checkout target commit
if [ -n "$LAST_GOOD" ]; then
    log "Checking out: $LAST_GOOD"
    git checkout "$LAST_GOOD"
fi

# Build
log "Building rollback version..."
cd "$PROJECT_ROOT"
npm run build >/dev/null 2>&1 || {
    error "Build failed - aborting rollback"
    git checkout - 2>/dev/null || git checkout main 2>/dev/null || true
    exit 1
}

# Deploy
log "Deploying rollback version..."
if env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID wrangler deploy; then
    success "Rollback deployed"
else
    error "Deployment failed"
    git checkout - 2>/dev/null || git checkout main 2>/dev/null || true
    exit 1
fi

# Verification
log "✅ Verifying rollback..."
sleep 10

health_check "/api/v1/health" "Health endpoint" 10 || {
    error "Health check failed - manual verification required"
}

# Return to original state
log "\n🔧 Returning to original branch..."
git checkout - 2>/dev/null || git checkout main 2>/dev/null || git checkout master 2>/dev/null || true

success "✅ Rollback complete!"
print_summary "success"
