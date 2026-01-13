#!/bin/bash
# Shared deployment utilities
# Source this in other deployment scripts: source ./scripts/deployment/lib/deploy-utils.sh

# Colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export NC='\033[0m'

# Configuration
export PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"
export DEPLOYMENT_URL="${DEPLOYMENT_URL:-https://tft-trading-system.yanggf.workers.dev}"
export BUILD_DIR="${BUILD_DIR:-$PROJECT_ROOT/dist}"

# Timing
export DEPLOY_START=$(date +%s)

step_start() { STEP_START=$(date +%s); }
step_end() {
    local now=$(date +%s)
    local duration=$((now - STEP_START))
    echo -e "${YELLOW}⏱️  [TIMING]${NC} $1 took ${duration}s"
}

# Logging functions
log() { echo -e "${BLUE}📦 [DEPLOY]${NC} $*"; }
success() { echo -e "${GREEN}✅ [SUCCESS]${NC} $*"; }
warning() { echo -e "${YELLOW}⚠️  [WARNING]${NC} $*"; }
error() { echo -e "${RED}❌ [ERROR]${NC} $*"; }
progress() { echo -e "${CYAN}[PROGRESS]${NC} $*"; }

# Dependency checks
check_dependencies() {
    local missing=()

    command -v wrangler >/dev/null 2>&1 || missing+=("wrangler")
    command -v curl >/dev/null 2>&1 || missing+=("curl")
    command -v jq >/dev/null 2>&1 || missing+=("jq")

    if [ ${#missing[@]} -gt 0 ]; then
        error "Missing dependencies: ${missing[*]}"
        log "Install with: npm install -g wrangler && sudo apt-get install -y curl jq"
        return 1
    fi

    success "All dependencies available"
    return 0
}

# Pre-flight git checks
check_git_state() {
    log "Checking git state..."

    # Check if we're in a git repo
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        warning "Not in a git repository, skipping git checks"
        return 0
    fi

    # Check for uncommitted changes
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        error "You have uncommitted changes:"
        git status --short
        echo ""
        read -p "Continue anyway? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log "Deployment cancelled"
            exit 1
        fi
    fi

    # Show current branch and commit
    local branch=$(git branch --show-current 2>/dev/null || echo "unknown")
    local commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local commit_msg=$(git log -1 --pretty='%s' 2>/dev/null || echo "unknown")

    log "Branch: $branch"
    log "Commit: $commit - $commit_msg"

    # Warn if not on main/master
    if [[ "$branch" != "main" && "$branch" != "master" ]]; then
        warning "You are on branch '$branch', not main/master"
        read -p "Continue anyway? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log "Deployment cancelled"
            exit 1
        fi
    fi

    success "Git state check passed"
}

# Authentication check
check_auth() {
    # Skip if explicitly requested
    [ "${SKIP_AUTH_CHECK:-0}" = "1" ] && return 0

    log "Checking Cloudflare authentication..."
    if ! wrangler whoami &>/dev/null; then
        log "Not authenticated. Running wrangler auth..."
        wrangler auth || {
            error "Authentication failed"
            return 1
        }
    fi
    success "Authenticated"
}

# Build info generation
generate_build_info() {
    local build_info_file="$BUILD_DIR/build-info.json"

    mkdir -p "$BUILD_DIR"

    cat > "$build_info_file" << EOF
{
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "gitCommit": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')",
  "gitBranch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "gitMessage": $(git log -1 --pretty='%s' 2>/dev/null | jq -Rs . || echo '"unknown"'),
  "builder": "${USER:-unknown}",
  "nodeVersion": "$(node --version 2>/dev/null || echo 'unknown')",
  "environment": "${ENVIRONMENT:-production}"
}
EOF

    log "Build info written to $build_info_file"
}

# Deployment confirmation
confirm_deployment() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           READY TO DEPLOY TO PRODUCTION                 ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    log "Target: $DEPLOYMENT_URL"
    log "Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
    log "Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
    echo ""
    read -p "Deploy now? (yes/no): " -r
    echo

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Deployment cancelled"
        exit 0
    fi
}

# Tag deployment
tag_deployment() {
    local tag_name="deploy-$(date +%Y%m%d-%H%M%S)"

    log "Tagging deployment as $tag_name"
    git tag -a "$tag_name" -m "Deployment at $(date -u)" 2>/dev/null || true
    success "Tagged as $tag_name"
}

# Health check
health_check() {
    local endpoint="$1"
    local description="${2:-Health check}"
    local timeout="${3:-30}"

    local response=$(curl -s -w "%{http_code}" --max-time "$timeout" "$DEPLOYMENT_URL$endpoint" 2>/dev/null || echo "000")
    local http_code="${response: -3}"

    if [ "$http_code" = "200" ]; then
        success "$description - OK"
        return 0
    else
        error "$description - HTTP $http_code"
        return 1
    fi
}

# Parallel cache warming
warm_cache_parallel() {
    log "Warming cache with parallel requests..."

    local endpoints=(
        "/api/v1/health:Health endpoint"
        "/api/v1/cache/health:Cache health"
        "/api/v1/data/symbols:Symbols list"
        "/dashboard.html:Dashboard"
        "/pre-market-briefing:Pre-market briefing"
    )

    local pids=()

    for item in "${endpoints[@]}"; do
        IFS=: read -r endpoint desc <<< "$item"
        log "Warming: $desc"
        curl -s "$DEPLOYMENT_URL$endpoint" >/dev/null 2>&1 &
        pids+=($!)
    done

    # Wait for all background jobs
    for pid in "${pids[@]}"; do
        wait "$pid" 2>/dev/null || true
    done

    success "Cache warming completed"
}

# Summary report
print_summary() {
    local deploy_status="$1"

    local deploy_end=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local total_time=$(($(date +%s) - DEPLOY_START))

    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║              DEPLOYMENT SUMMARY                         ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ "$deploy_status" = "success" ]; then
        success "Status: SUCCESS"
    else
        error "Status: FAILED"
    fi

    log "Started: $(date -u -d @$DEPLOY_START +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -r $DEPLOY_START)"
    log "Completed: $deploy_end"
    log "Total time: ${total_time}s"
    log "URL: $DEPLOYMENT_URL"
    echo ""
    log "Quick links:"
    log "  Dashboard:   $DEPLOYMENT_URL/dashboard.html"
    log "  Pre-market:  $DEPLOYMENT_URL/pre-market-briefing"
    log "  Intraday:    $DEPLOYMENT_URL/intraday-check"
    log "  End-of-day:  $DEPLOYMENT_URL/end-of-day-summary"
    log "  Weekly:      $DEPLOYMENT_URL/weekly-review"
    echo ""
}

# Export functions for use in subshells
export -f log success warning error progress
export -f step_start step_end
export -f check_dependencies check_git_state check_auth
export -f generate_build_info confirm_deployment tag_deployment
export -f health_check warm_cache_parallel print_summary
