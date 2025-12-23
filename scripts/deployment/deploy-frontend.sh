#!/bin/env bash
# Frontend-only deployment script
# Deploys only public/ assets without full backend rebuild

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOYMENT_URL="https://tft-trading-system.yanggf.workers.dev"
SKIP_BACKEND=false

# Parse args
[[ "${1:-}" == "--skip-backend" ]] && SKIP_BACKEND=true

cd "$PROJECT_ROOT"

echo "🎨 Frontend Deployment"

# Build frontend
echo "📦 Building frontend assets..."
npm run build:frontend:only

# Optional backend build
if [ "$SKIP_BACKEND" = false ]; then
    echo "🔧 Building backend..."
    npm run build:backend
fi

# Deploy
echo "🚀 Deploying to Cloudflare..."
env -u CLOUDFLARE_API_TOKEN npx wrangler deploy

echo "✅ Frontend deployed to $DEPLOYMENT_URL"
echo "📊 Dashboard: $DEPLOYMENT_URL/dashboard.html"
