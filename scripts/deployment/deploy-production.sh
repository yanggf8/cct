#!/usr/bin/env bash
# Production Deployment Script with Frontend Build
# Enhanced with pre-flight checks, confirmation, and parallel cache warming

set -euo pipefail

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-utils.sh"

# Parse arguments
SKIP_CONFIRM="${SKIP_CONFIRM:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
VERIFY_ONLY="${VERIFY_ONLY:-0}"

for arg in "$@"; do
    case $arg in
        --yes|-y) SKIP_CONFIRM=1 ;;
        --no-build) SKIP_BUILD=1 ;;
        --verify) VERIFY_ONLY=1 ;;
    esac
done

# Environment checks
check_environment() {
    step_start
    log "Checking deployment environment..."

    check_dependencies || return 1
    check_auth || return 1
    check_git_state || return 1

    success "Environment checks passed"
    step_end "check_environment"
}

# Frontend build
build_frontend() {
    [ "$SKIP_BUILD" = "1" ] && { log "Skipping frontend build (--no-build)"; return 0; }

    step_start
    log "Building frontend assets..."

    cd "$PROJECT_ROOT"

    # Clean previous build
    [ -d "$BUILD_DIR" ] && rm -rf "$BUILD_DIR"

    # Build with recovery
    if npm run build:frontend 2>/dev/null; then
        generate_build_info
        success "Frontend build completed"
        step_end "build_frontend"
        return 0
    fi

    warning "Build failed, attempting recovery..."

    # Recovery: clean cache and rebuild
    npm cache clean --force >/dev/null 2>&1 || true
    npm ci --prefer-offline --no-audit --no-fund >/dev/null 2>&1 || true

    if npm run build:frontend 2>/dev/null; then
        generate_build_info
        success "Frontend build succeeded after recovery"
        step_end "build_frontend"
        return 0
    fi

    error "Frontend build failed"
    return 1
}

# Backend build
build_backend() {
    [ "$SKIP_BUILD" = "1" ] && { log "Skipping backend build (--no-build)"; return 0; }

    step_start
    log "Building backend..."

    cd "$PROJECT_ROOT"

    if npm run build:backend 2>/dev/null; then
        success "Backend build completed"
        step_end "build_backend"
        return 0
    fi

    error "Backend build failed"
    return 1
}

# Validate build
validate_build() {
    step_start
    log "Validating build..."

    [ ! -d "$BUILD_DIR" ] && { error "Build directory not found"; return 1; }

    # Check build-info.json
    if [ -f "$BUILD_DIR/build-info.json" ]; then
        local build_time=$(jq -r '.buildTime // "unknown"' "$BUILD_DIR/build-info.json")
        local git_commit=$(jq -r '.gitCommit // "unknown"' "$BUILD_DIR/build-info.json")
        log "Build: $git_commit at $build_time"
    fi

    success "Build validation passed"
    step_end "validate_build"
    return 0
}

# Deploy
deploy_to_production() {
    step_start
    log "Deploying to Cloudflare Workers..."

    cd "$PROJECT_ROOT"

    # Use browser auth (unset API tokens)
    if env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID node_modules/.bin/wrangler deploy; then
        success "Deployment completed"
        step_end "deploy_to_production"
        return 0
    fi

    error "Deployment failed"
    return 1
}

# Verify deployment
verify_deployment() {
    step_start
    log "Verifying deployment..."

    sleep 2  # Wait for propagation

    local failures=0

    health_check "/api/v1/health" "Health check" || failures=$((failures + 1))
    health_check "/api/v1/cache/health" "Cache health" || failures=$((failures + 1))

    # Quick HTML checks
    curl -s "$DEPLOYMENT_URL/end-of-day-summary" 2>/dev/null | grep -q "<html" && \
        success "/end-of-day-summary OK" || { warning "/end-of-day-summary check failed"; failures=$((failures + 1)); }
    curl -s "$DEPLOYMENT_URL/weekly-review" 2>/dev/null | grep -q "<html" && \
        success "/weekly-review OK" || warning "/weekly-review check failed"

    if [ $failures -eq 0 ]; then
        success "All health checks passed"
    else
        warning "$failures health check(s) failed"
    fi

    step_end "verify_deployment"
}

# Warm cache (parallel)
warm_cache() {
    step_start
    warm_cache_parallel
    step_end "warm_cache"
}

# Main deployment flow
main() {
    log "Starting production deployment..."

    if [ "$VERIFY_ONLY" = "1" ]; then
        verify_deployment
        print_summary "success"
        return 0
    fi

    # Pre-deployment
    check_environment || { print_summary "failed"; exit 1; }

    # Build (unless skipped)
    if [ "$SKIP_BUILD" = "0" ]; then
        build_frontend || { print_summary "failed"; exit 1; }
        build_backend || { print_summary "failed"; exit 1; }
        validate_build || { print_summary "failed"; exit 1; }
    fi

    # Confirmation (unless skipped)
    [ "$SKIP_CONFIRM" = "0" ] && confirm_deployment

    # Deploy
    deploy_to_production || { print_summary "failed"; exit 1; }

    # Post-deployment
    verify_deployment
    warm_cache

    # Tag successful deployment
    tag_deployment 2>/dev/null || true

    print_summary "success"
}

# Script modes
case "${1:-deploy}" in
    "build-only")
        SKIP_CONFIRM=1
        check_environment
        build_frontend || exit 1
        build_backend || exit 1
        validate_build || exit 1
        success "Build complete. Use '$0 deploy' to deploy."
        ;;
    "deploy")
        main "$@"
        ;;
    "verify")
        VERIFY_ONLY=1 main "$@"
        ;;
    *)
        echo "Usage: $0 [build-only|deploy|verify] [options]"
        echo ""
        echo "Commands:"
        echo "  build-only  Build without deploying"
        echo "  deploy      Full deployment (default)"
        echo "  verify      Verify current deployment"
        echo ""
        echo "Options:"
        echo "  --yes, -y       Skip confirmation prompt"
        echo "  --no-build      Skip build step"
        echo "  --verify        Only verify (no deploy)"
        echo ""
        echo "Environment:"
        echo "  SKIP_CONFIRM=1  Auto-confirm deployment"
        echo "  SKIP_AUTH_CHECK=1  Skip authentication check"
        echo "  SKIP_BUILD=1    Skip build step"
        exit 1
        ;;
esac
