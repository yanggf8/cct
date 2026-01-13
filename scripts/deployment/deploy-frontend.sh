#!/usr/bin/env bash
# Frontend-only deployment script
# Deploys public/ assets without full backend rebuild

set -euo pipefail

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-utils.sh"

SKIP_BACKEND=false

# Parse args
for arg in "$@"; do
    case $arg in
        --skip-backend) SKIP_BACKEND=true ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-backend    Skip backend build"
            echo "  --help, -h        Show this help"
            exit 0
            ;;
    esac
done

log "🎨 Frontend Deployment"

# Build frontend
log "📦 Building frontend assets..."
cd "$PROJECT_ROOT"

if ! npm run build:frontend:only; then
    error "Frontend build failed"
    exit 1
fi

# Optional backend build
if [ "$SKIP_BACKEND" = false ]; then
    log "🔧 Building backend..."
    if ! npm run build:backend; then
        error "Backend build failed"
        exit 1
    fi
fi

# Deploy
log "🚀 Deploying to Cloudflare..."
if env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID npx wrangler deploy; then
    success "Deployment completed"
else
    error "Deployment failed"
    exit 1
fi

# Quick verification
sleep 2
health_check "/api/v1/health" "Health check"

success "✅ Frontend deployed to $DEPLOYMENT_URL"
log "📊 Dashboard: $DEPLOYMENT_URL/dashboard.html"
