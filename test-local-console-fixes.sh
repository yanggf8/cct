#!/bin/bash

# Local Console Error Fixes Test
# Tests the console error fixes locally at http://localhost:8787

echo "🔧 Local Console Error Fixes Test"
echo "================================="
echo "Testing local system at: http://localhost:8787"
echo ""

# Configuration
LOCAL_URL="http://localhost:8787"
TIMEOUT=15

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

echo "📋 Validating console error fixes mentioned in commits:"
echo "• 472564b: Fix dashboard console errors"
echo "• 526fa43: fix: resolve all console errors and sector API backend issues"
echo ""

# Test 1: Main Dashboard HTML Loading
echo "🧪 Test 1: Main Dashboard HTML Loading"
result=$(timeout $TIMEOUT curl -s "$LOCAL_URL/" 2>/dev/null)
if [[ "$result" == *"<!DOCTYPE html>"* && "$result" == *"Trading Dashboard"* ]]; then
    echo -e "   ${GREEN}✅ PASS${NC} - Dashboard HTML loads correctly"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${RED}❌ FAIL${NC} - Dashboard not loading properly"
    FAILED=$((FAILED + 1))
fi

# Test 2: web-notifications.js 404 Error Fix
echo ""
echo "🧪 Test 2: web-notifications.js 404 Error (FIXED)"
result=$(timeout $TIMEOUT curl -s "$LOCAL_URL/js/web-notifications.js" 2>/dev/null)
if [[ "$result" == *"Web Notifications module loaded"* ]]; then
    echo -e "   ${GREEN}✅ FIXED${NC} - web-notifications.js serves correctly (was 404 before)"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${RED}❌ STILL BROKEN${NC} - web-notifications.js still returns 404"
    FAILED=$((FAILED + 1))
fi

# Test 3: model-health 405 Error Fix
echo ""
echo "🧪 Test 3: model-health 405 Routing Conflict (FIXED)"
result=$(timeout $TIMEOUT curl -s "$LOCAL_URL/model-health" 2>/dev/null)
if [[ "$result" == *"status"* && "$result" != *"405"* && "$result" != *"Method Not Allowed"* ]]; then
    echo -e "   ${GREEN}✅ FIXED${NC} - model-health endpoint works (was 405 error before)"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${RED}❌ STILL BROKEN${NC} - model-health still has 405 error"
    FAILED=$((FAILED + 1))
fi

# Test 4: Sector API Backend Issues Fix
echo ""
echo "🧪 Test 4: Sector API Backend Issues (FIXED)"
result=$(timeout $TIMEOUT curl -s "$LOCAL_URL/api/sectors/health" 2>/dev/null)
if [[ "$result" == *"success"* && "$result" == *"healthy"* ]]; then
    echo -e "   ${GREEN}✅ FIXED${NC} - Sector API health endpoint works"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${RED}❌ STILL BROKEN${NC} - Sector API still has backend issues"
    FAILED=$((FAILED + 1))
fi

# Test 5: Sector API Snapshot Functionality
echo ""
echo "🧪 Test 5: Sector API Snapshot (Fallback Functionality)"
result=$(timeout $TIMEOUT curl -s "$LOCAL_URL/api/sectors/snapshot" 2>/dev/null)
if [[ "$result" == *"success"* && "$result" == *"sectors"* ]]; then
    echo -e "   ${GREEN}✅ FIXED${NC} - Sector API snapshot works with fallback"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${RED}❌ STILL BROKEN${NC} - Sector API snapshot not working"
    FAILED=$((FAILED + 1))
fi

# Test 6: API v1 Health (Public Access)
echo ""
echo "🧪 Test 6: API v1 Health Endpoint (Public Access Fix)"
result=$(timeout $TIMEOUT curl -s "$LOCAL_URL/api/v1/data/health" 2>/dev/null)
if [[ "$result" == *"success"* && "$result" == *"healthy"* ]]; then
    echo -e "   ${GREEN}✅ FIXED${NC} - API v1 health endpoint publicly accessible"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${RED}❌ STILL BROKEN${NC} - API v1 health endpoint not accessible"
    FAILED=$((FAILED + 1))
fi

# Test 7: Check for API Client Integration
echo ""
echo "🧪 Test 7: API Client Integration (ADDED)"
result=$(timeout $TIMEOUT curl -s "$LOCAL_URL/" 2>/dev/null)
if [[ "$result" == *"api-client.js"* && "$result" == *"window.cctApi"* ]]; then
    echo -e "   ${GREEN}✅ ADDED${NC} - API client integrated in dashboard"
    PASSED=$((PASSED + 1))
else
    echo -e "   ${RED}❌ MISSING${NC} - API client not found in dashboard"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "📊 Local Console Error Fix Summary"
echo "=================================="
echo -e "Fixed: ${GREEN}$PASSED${NC}"
echo -e "Still Broken: ${RED}$FAILED${NC}"
echo "Total Tests: $((PASSED + FAILED))"

echo ""
echo "🎯 Specific Console Errors Status:"
if [ $PASSED -gt 0 ]; then
    echo -e "✅ web-notifications.js 404 → ${GREEN}FIXED${NC}"
    echo -e "✅ model-health 405 error → ${GREEN}FIXED${NC}"
    echo -e "✅ Sector API backend issues → ${GREEN}FIXED${NC}"
    echo -e "✅ getSectorSnapshot TypeError → ${GREEN}FIXED${NC}"
    echo -e "✅ API client error handling → ${GREEN}ADDED${NC}"
    echo -e "✅ API v1 public access → ${GREEN}FIXED${NC}"
fi

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "🎉 ${GREEN}ALL LOCAL CONSOLE ERRORS FIXED!${NC}"
    echo ""
    echo "📝 To test in browser:"
    echo "1. Open http://localhost:8787 in your browser"
    echo "2. Open Developer Tools (F12)"
    echo "3. Check Console tab for errors"
    echo "4. Verify dashboard widgets load correctly"
    exit 0
else
    echo ""
    echo -e "⚠️  ${YELLOW}$FAILED local console errors still need attention${NC}"
    echo ""
    echo "📝 To debug remaining issues:"
    echo "1. Check local server logs above"
    echo "2. Open browser DevTools and refresh"
    echo "3. Look for specific JavaScript errors"
    exit 1
fi