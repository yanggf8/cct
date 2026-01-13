#!/usr/bin/env bash
# Quick Deployment Script - Immediate deployment without builds
# Use for hotfixes when you need to deploy immediately

set -euo pipefail

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-utils.sh"

log "🚀 Quick Deploy (bypassing build checks)"
log "⚠️  Use only for emergency hotfixes!"

# Quick confirmation
[ "${SKIP_CONFIRM:-0}" != "1" ] && confirm_deployment

# Deploy immediately (no build)
log "Deploying current state..."
if env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID npx wrangler deploy; then
    success "Deployment completed"
else
    error "Deployment failed"
    exit 1
fi

# Quick verification
sleep 3
log "Running quick verification..."

health_check "/api/v1/health" "Health check" 10 || warning "Health check failed - may still be propagating"

# Test HTML endpoints
for endpoint in "/pre-market-briefing" "/intraday-check" "/end-of-day-summary" "/weekly-review"; do
    if curl -sf "$DEPLOYMENT_URL$endpoint" | grep -q "<!DOCTYPE html\\|<html"; then
        success "$endpoint - OK"
    else
        warning "$endpoint - may need time to propagate"
    fi
done

warning "⚠️  Reminder: Fix TypeScript errors before next production deploy"
print_summary "success"
