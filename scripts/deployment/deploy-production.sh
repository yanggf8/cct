#!/bin/env bash

# Production Deployment Script with Frontend Build
# Inspired by DAC deployment approach with build verification and cache warming
# Ensures we deploy the most recent build, not old cached assets

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/dist"
DEPLOYMENT_URL="https://tft-trading-system.yanggf.workers.dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Timing
DEPLOY_START=$(date +%s)
step_start() { STEP_START=$(date +%s); }
step_end() { local now=$(date +%s); echo -e "${YELLOW}⏱️  [TIMING]${NC} $1 took $((now - STEP_START))s"; }

# Logging
log() { echo -e "${BLUE}📦 [DEPLOY]${NC} $*"; }
success() { echo -e "${GREEN}✅ [SUCCESS]${NC} $*"; }
warning() { echo -e "${YELLOW}⚠️  [WARNING]${NC} $*"; }
error() { echo -e "${RED}❌ [ERROR]${NC} $*"; }

# Environment checks
check_environment() {
    log "Checking deployment environment..."

    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        error "Wrangler CLI not found. Please install with: npm install -g wrangler"
        exit 1
    fi

    # Skip auth check if SKIP_AUTH_CHECK=1 (saves ~7s)
    if [ "${SKIP_AUTH_CHECK:-0}" != "1" ]; then
        if ! wrangler whoami &> /dev/null; then
            log "Not authenticated with Wrangler. Attempting browser authentication..."
            wrangler auth || {
                error "Failed to authenticate with Wrangler"
                exit 1
            }
        fi
    fi

    success "Environment checks passed"
}

# Frontend build with recovery
build_frontend() {
    log "Building frontend assets..."

    cd "$PROJECT_ROOT"

    # Clean previous build
    if [ -d "$BUILD_DIR" ]; then
        log "Cleaning previous build directory..."
        rm -rf "$BUILD_DIR"
    fi

    # Run frontend build with recovery
    attempt_build() {
        log "Running frontend build..."
        npm run build:frontend
    }

    if attempt_build; then
        success "Frontend build completed successfully"
        return 0
    fi

    warning "Frontend build failed. Attempting recovery..."

    # Clear npm cache and retry
    log "Clearing npm cache..."
    npm cache clean --force

    # Reinstall dependencies
    log "Reinstalling dependencies..."
    npm ci --prefer-offline=false --no-audit --no-fund

    if attempt_build; then
        success "Frontend build succeeded after recovery"
        return 0
    fi

    error "Frontend build failed after recovery attempts"
    return 1
}

# Backend build
build_backend() {
    log "Building backend..."

    cd "$PROJECT_ROOT"

    if npm run build:backend; then
        success "Backend build completed successfully"
    else
        error "Backend build failed"
        return 1
    fi
}

# Type checking and validation
validate_build() {
    log "Validating build quality..."

    cd "$PROJECT_ROOT"

    # Run TypeScript checks
    if npm run build:check; then
        success "TypeScript validation passed"
    else
        error "TypeScript validation failed"
        return 1
    fi

    # Verify build artifacts exist
    if [ ! -d "$BUILD_DIR" ]; then
        error "Build directory not found"
        return 1
    fi

    # Check build info
    if [ -f "$BUILD_DIR/build-info.json" ]; then
        local build_time=$(jq -r '.buildTime' "$BUILD_DIR/build-info.json")
        local build_version=$(jq -r '.version' "$BUILD_DIR/build-info.json")
        log "Build time: $build_time"
        log "Build version: $build_version"
    fi

    success "Build validation completed"
    return 0
}

# Deployment
deploy_to_production() {
    log "Deploying to production..."

    cd "$PROJECT_ROOT"

    # Deploy without API token to use browser auth (per DEPLOYMENT_GUIDE.md)
    log "Starting Cloudflare deployment..."

    # Deploy using browser authentication (explicitly target top-level/production environment)
    # We unset CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to ensure we use the local OAuth credentials (wrangler login)
    if env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID node_modules/.bin/wrangler deploy ; then
        success "Deployment completed successfully"
    else
        error "Deployment failed"
        return 1
    fi
}

# Post-deployment verification
verify_deployment() {
    log "Verifying deployment..."
    sleep 1
    curl -s -f "$DEPLOYMENT_URL/api/v1/health" > /dev/null && success "Health check passed" || warning "Health check failed"
    curl -s -f "$DEPLOYMENT_URL/end-of-day-summary" | grep -q "<html" && success "/end-of-day-summary OK"
    curl -s -f "$DEPLOYMENT_URL/weekly-review" | grep -q "<html" && success "/weekly-review OK"
}

# Post-deployment cache warming
warm_cache() {
    log "Warming production cache..."

    # Test various endpoints to warm cache
    local warm_endpoints=(
        "/api/v1/health"
        "/api/v1/guards/health"
        "/dashboard.html"
        "/pre-market-briefing"
    )

    for endpoint in "${warm_endpoints[@]}"; do
        log "Warming: $endpoint"
        curl -s "$DEPLOYMENT_URL$endpoint" > /dev/null || true
    done

    success "Cache warming completed"
}

# Main deployment flow
main() {
    log "Starting production deployment process..."

    # Record deployment start time
    local deployment_start=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Execute deployment pipeline with timing
    step_start; check_environment || exit 1; step_end "check_environment"
    step_start; build_frontend || exit 1; step_end "build_frontend"
    step_start; build_backend || exit 1; step_end "build_backend"
    step_start; validate_build || exit 1; step_end "validate_build"
    step_start; deploy_to_production || exit 1; step_end "deploy_to_production"
    step_start; verify_deployment; step_end "verify_deployment"
    step_start; warm_cache; step_end "warm_cache"
    
    echo -e "${YELLOW}⏱️  [TIMING]${NC} TOTAL: $(($(date +%s) - DEPLOY_START))s"

    # Success
    local deployment_end=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    success "Production deployment completed successfully!"
    log "Deployment started: $deployment_start"
    log "Deployment completed: $deployment_end"
    log "Production URL: $DEPLOYMENT_URL"

    echo ""
    log "🚀 Your application is now live!"
    log "📊 Dashboard: $DEPLOYMENT_URL/dashboard.html"
    log "📈 Pre-market: $DEPLOYMENT_URL/pre-market-briefing"
    log "🔍 Intraday: $DEPLOYMENT_URL/intraday-check"
    log "📋 End-of-day: $DEPLOYMENT_URL/end-of-day-summary"
    log "📊 Weekly: $DEPLOYMENT_URL/weekly-review"
}

# Script options
case "${1:-deploy}" in
    "build-only")
        check_environment
        build_frontend || exit 1
        build_backend || exit 1
        validate_build || exit 1
        success "Build completed. Use '$0 deploy' to deploy."
        ;;
    "deploy")
        main "$@"
        ;;
    "verify")
        verify_deployment
        ;;
    *)
        echo "Usage: $0 [build-only|deploy|verify]"
        echo "  build-only - Build frontend and backend without deploying"
        echo "  deploy      - Full deployment process (default)"
        echo "  verify      - Verify current deployment"
        exit 1
        ;;
esac
