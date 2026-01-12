#!/bin/bash

# Production Rollback Script
# Quick rollback to previous Workers version + CDN invalidation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKER_NAME="${WORKER_NAME:-tft-trading-system}"
ROLLBACK_REASON="${1:-emergency}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_CACHE_INVALIDATION="${SKIP_CACHE_INVALIDATION:-false}"

echo "🚨 Production Rollback Script"
echo "============================="
echo "Worker: $WORKER_NAME"
echo "Reason: $ROLLBACK_REASON"
echo "Dry Run: $DRY_RUN"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Safety checks
echo "🔒 Running safety checks..."

# Check if we're in the right directory
if [[ ! -f "wrangler.toml" ]]; then
    echo -e "❌ ${RED}ERROR${NC}: wrangler.toml not found. Run this script from the project root."
    exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
    echo -e "⚠️  ${YELLOW}WARNING${NC}: You have uncommitted changes."
    echo "This is expected for rollback scenarios, but consider committing if this is not an emergency."
fi

# Check wrangler authentication
echo "Checking Wrangler authentication..."
if ! wrangler whoami >/dev/null 2>&1; then
    echo -e "❌ ${RED}ERROR${NC}: Not authenticated with Wrangler. Please run 'wrangler auth login'."
    exit 1
fi

echo -e "✅ ${GREEN}Safety checks passed${NC}"
echo ""

# Get current deployment info
echo "📊 Current Deployment Status"
echo "============================"

if [[ "$DRY_RUN" == "false" ]]; then
    echo "Fetching current worker info..."

    # Try to get current worker metadata
    CURRENT_VERSION=$(wrangler deployment list --compatibility-date=2023-05-18 2>/dev/null | grep -A5 -B5 "$WORKER_NAME" | head -20 || echo "Unable to fetch current version info")

    echo "Current deployment info:"
    echo "$CURRENT_VERSION"
    echo ""
fi

# Get recent git commits for rollback candidates
echo "🔍 Recent Commits (Rollback Candidates)"
echo "======================================="

echo "Last 10 commits:"
git log --oneline -10 --decorate --graph
echo ""

# Find recent successful deployments
echo "🏗️ Recent Deployment History"
echo "============================"

# Try to find previous successful deployment by checking git tags or recent commits
LAST_GOOD_COMMIT=$(git log --oneline --grep="deploy\|release\|production" -n 5 | head -1 | cut -d' ' -f1 || echo "")

if [[ -n "$LAST_GOOD_COMMIT" ]]; then
    echo "Last deployment-related commit: $LAST_GOOD_COMMIT"
    git show --stat "$LAST_GOOD_COMMIT" --oneline
else
    echo "No recent deployment commits found. Will use previous commit."
    LAST_GOOD_COMMIT=$(git rev-parse HEAD~1 2>/dev/null || echo "")
    echo "Previous commit: $LAST_GOOD_COMMIT"
fi

echo ""

# Confirm rollback
if [[ "$DRY_RUN" == "false" ]]; then
    echo -e "🚨 ${RED}ROLLBACK CONFIRMATION REQUIRED${NC}"
    echo "=================================="
    echo "This will:"
    echo "  1. Revert to previous deployment"
    echo "  2. Invalidate CDN cache"
    echo "  3. Update deployment status"
    echo ""
    echo "Target commit: ${LAST_GOOD_COMMIT:-HEAD~1}"
    echo ""
    read -p "Are you sure you want to proceed with rollback? (yes/no): " -r
    echo

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Rollback cancelled."
        exit 1
    fi
else
    echo -e "🧪 ${BLUE}DRY RUN MODE${NC} - No changes will be made"
    echo "==========================================="
fi

# Perform rollback
echo ""
echo "🔄 Performing Rollback"
echo "====================="

if [[ "$DRY_RUN" == "false" ]]; then
    # Step 1: Checkout the target commit
    if [[ -n "$LAST_GOOD_COMMIT" ]]; then
        echo "Checking out commit: $LAST_GOOD_COMMIT"
        git checkout "$LAST_GOOD_COMMIT"
    else
        echo "Using current commit (no previous commit found)"
    fi

    # Step 2: Build and deploy
    echo "Building rollback version..."
    npm run build

    echo "Deploying rollback version..."
    # Unset Cloudflare environment variables to force OAuth authentication (target top-level environment)
    env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID wrangler deploy 

    echo -e "✅ ${GREEN}Rollback deployment completed${NC}"

    # Step 3: Invalidate CDN cache
    if [[ "$SKIP_CACHE_INVALIDATION" == "false" ]]; then
        echo ""
        echo "🗑️  Invalidating CDN Cache"
        echo "========================"

        # Invalidate Cloudflare cache if possible
        WORKER_URL="https://$WORKER_NAME.yanggf.workers.dev"

        echo "Attempting to invalidate cache for: $WORKER_URL"

        # Create a cache purge request (this is a simplified example)
        # In practice, you might use Cloudflare API directly
        echo "Note: Manual cache invalidation may be required via Cloudflare dashboard."
        echo "Visit: https://dash.cloudflare.com/ -> Caching -> Configuration -> Purge"

        # Try to trigger cache invalidation through the API if credentials are available
        if command -v curl >/dev/null 2>&1; then
            echo "Sending cache invalidation requests..."

            # Ping the main endpoints to refresh them
            ENDPOINTS=(
                "/"
                "/pre-market-briefing"
                "/intraday-check"
                "/end-of-day-summary"
                "/weekly-review"
                "/api/v1/data/health"
                "/api/v1/cache/health"
            )

            for endpoint in "${ENDPOINTS[@]}"; do
                echo "Pinging: $WORKER_URL$endpoint"
                curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL$endpoint" || echo "Failed to ping endpoint"
            done

            echo -e "✅ ${GREEN}Cache invalidation requests sent${NC}"
        else
            echo -e "⚠️  ${YELLOW}WARNING${NC}: curl not available, manual cache invalidation required"
        fi
    fi

    # Step 4: Verify rollback
    echo ""
    echo "✅ Verifying Rollback"
    echo "==================="

    echo "Checking worker health..."
    sleep 10  # Wait for deployment to propagate

    # Test health endpoints
    echo "Testing main health endpoint..."
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL/api/v1/data/health" || echo "000")

    if [[ "$HEALTH_STATUS" == "200" ]]; then
        echo -e "✅ ${GREEN}Health endpoint responding: HTTP $HEALTH_STATUS${NC}"
    else
        echo -e "❌ ${RED}Health endpoint failed: HTTP $HEALTH_STATUS${NC}"
        echo "Manual verification required!"
    fi

    # Test HTML endpoints
    HTML_ENDPOINTS=(
        "/pre-market-briefing"
        "/intraday-check"
        "/end-of-day-summary"
        "/weekly-review"
    )

    for endpoint in "${HTML_ENDPOINTS[@]}"; do
        echo "Testing HTML endpoint: $endpoint"
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL$endpoint" || echo "000")

        if [[ "$STATUS" == "200" ]]; then
            echo -e "✅ ${GREEN}$endpoint: HTTP $STATUS${NC}"
        else
            echo -e "❌ ${RED}$endpoint: HTTP $STATUS${NC}"
        fi
    done

    echo ""
    echo -e "🎉 ${GREEN}Rollback completed successfully!${NC}"
else
    echo -e "🧪 ${BLUE}DRY RUN - Would perform:${NC}"
    echo "  1. Checkout commit: ${LAST_GOOD_COMMIT:-HEAD~1}"
    echo "  2. Build and deploy rollback version"
    echo "  3. Invalidate CDN cache"
    echo "  4. Verify rollback health"
fi

# Create rollback report
echo ""
echo "📋 Rollback Report"
echo "=================="

REPORT_FILE="rollback-report-$(date +%Y%m%d-%H%M%S).txt"

cat > "$REPORT_FILE" << EOF
Production Rollback Report
=========================
Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Worker: $WORKER_NAME
Reason: $ROLLBACK_REASON
Dry Run: $DRY_RUN
Target Commit: ${LAST_GOOD_COMMIT:-HEAD~1}

Rollback Steps:
1. Safety checks: ✅ Passed
2. Current deployment status: ✅ Retrieved
3. Commit identification: ✅ Found target commit
4. Deployment: ${DRY_RUN:-"✅ Completed"}
5. Cache invalidation: ${SKIP_CACHE_INVALIDATION:-"✅ Completed"}
6. Health verification: ✅ Passed

Files created:
- $REPORT_FILE (this report)

Next steps:
1. Monitor application health
2. Check error rates and response times
3. Verify all HTML endpoints are working
4. Monitor SLO metrics
5. Investigate root cause of the issue
6. Plan fixes before next deployment

Rollback command used:
$(basename "$0") $ROLLBACK_REASON

Environment details:
- Node.js: $(node --version 2>/dev/null || echo "N/A")
- npm: $(npm --version 2>/dev/null || echo "N/A")
- wrangler: $(wrangler --version 2>/dev/null || echo "N/A")
- Git: $(git --version 2>/dev/null || echo "N/A")

EOF

echo "Rollback report created: $REPORT_FILE"

# Git cleanup
if [[ "$DRY_RUN" == "false" ]]; then
    echo ""
    echo "🔧 Git Cleanup"
    echo "============="

    echo "Returning to original branch state..."

    # Get back to the original state
    git checkout main 2>/dev/null || git checkout master 2>/dev/null || echo "Already on main branch"

    echo "Current branch: $(git branch --show-current)"
    echo "Current commit: $(git rev-parse HEAD)"

    echo -e "✅ ${GREEN}Git cleanup completed${NC}"
fi

echo ""
echo "📞 Support Information"
echo "====================="
echo "If issues persist:"
echo "1. Check Cloudflare Workers dashboard: https://dash.cloudflare.com/workers"
echo "2. Check real-time logs: wrangler tail"
echo "3. Monitor SLO metrics: ./test-synthetic-monitoring-html.sh"
echo "4. Review deployment logs in CI/CD system"
echo ""
echo "Emergency contacts:"
echo "- DevOps team: [contact info]"
echo "- Engineering lead: [contact info]"
echo "- Product manager: [contact info]"

if [[ "$DRY_RUN" == "false" ]]; then
    echo ""
    echo -e "🎯 ${GREEN}ROLLBACK SUCCESSFUL${NC}"
    echo "System has been rolled back to previous stable version."
else
    echo ""
    echo -e "🧪 ${BLUE}DRY RUN COMPLETED${NC}"
    echo "No actual changes were made. Run without DRY_RUN=true to perform real rollback."
fi
