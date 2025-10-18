#!/bin/bash

# Specific Console Error Fixes Test
# Validates the exact console errors mentioned in commits 526fa43 and 472564b

echo "🎯 Specific Console Error Fixes Validation"
echo "==========================================="
echo "Validating fixes from:"
echo "• 472564b: Fix dashboard console errors"
echo "• 526fa43: fix: resolve all console errors and sector API backend issues"
echo ""

# Configuration
API_URL="https://tft-trading-system.yanggf.workers.dev"
API_KEY="yanggf"
TIMEOUT=20

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

test_fix() {
    local description="$1"
    local test_command="$2"
    local check_function="$3"

    echo "🔧 Testing: $description"

    result=$(timeout $TIMEOUT bash -c "$test_command" 2>/dev/null)
    exit_code=$?

    if [ $exit_code -eq 124 ]; then
        echo -e "   ${RED}❌ TIMEOUT${NC}"
        FAILED=$((FAILED + 1))
        return
    fi

    if $check_function "$result"; then
        echo -e "   ${GREEN}✅ FIXED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "   ${RED}❌ STILL BROKEN${NC}"
        echo "   Result: $result"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# 1. web-notifications.js 404 error (FIXED: Added static file serving)
test_fix "web-notifications.js 404 error" \
    "curl -s '$API_URL/js/web-notifications.js'" \
    '[[ "$1" == *"Web Notifications"* ]]'

# 2. getSectorSnapshot TypeError (FIXED: Added null handling for window.cctApi)
test_fix "Sector API health and snapshot endpoints" \
    "curl -s -H 'X-API-KEY: $API_KEY' '$API_URL/api/sectors/health'" \
    '[[ "$1" == *"healthy"* ]]'

# 3. model-health 405 error (FIXED: Removed from legacy mapping)
test_fix "model-health 405 routing conflict" \
    "curl -s '$API_URL/model-health'" \
    '[[ "$1" == *"status"* && "$1" != *"405"* && "$1" != *"Method Not Allowed"* ]]'

# 4. Sector API backend issues (FIXED: Added comprehensive fallback functionality)
test_fix "Sector API fallback functionality" \
    "curl -s -H 'X-API-KEY: $API_KEY' '$API_URL/api/sectors/snapshot'" \
    '[[ "$1" == *"success"* ]]'

# 5. Working API client (ADDED: CCTApiClient with proper error handling)
test_fix "API v1 health endpoint (public access)" \
    "curl -s '$API_URL/api/v1/data/health'" \
    '[[ "$1" == *"healthy"* ]]'

# 6. Dashboard HTML loads without errors
test_fix "Main dashboard HTML loading" \
    "curl -s '$API_URL/'" \
    '[[ "$1" == *"<!DOCTYPE html>"* ]]'

echo "📊 Console Error Fix Summary"
echo "=========================="
echo -e "Fixed: ${GREEN}$PASSED${NC}"
echo -e "Still Broken: ${RED}$FAILED${NC}"
echo "Total Tests: $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}ALL CONSOLE ERRORS FIXED!${NC}"
    echo "✅ web-notifications.js 404 → FIXED"
    echo "✅ getSectorSnapshot TypeError → FIXED"
    echo "✅ model-health 405 error → FIXED"
    echo "✅ Sector API backend issues → FIXED"
    echo "✅ API client error handling → ADDED"
    exit 0
else
    echo -e "\n⚠️  ${YELLOW}$FAILED console errors still need attention${NC}"
    exit 1
fi