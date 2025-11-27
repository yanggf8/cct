#!/bin/bash

# Quick DAC Service Binding Validation
# Simple test to verify DAC integration is working

set -euo pipefail

# Configuration
CCT_URL="https://tft-trading-system.yanggf.workers.dev"
DAC_URL="https://dac-backend.yanggf.workers.dev"
API_KEY="yanggf"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TOTAL=0
PASSED=0
FAILED=0

echo -e "${BLUE}🔌 DAC Service Binding Quick Validation${NC}"
echo "=========================================="

# Test 1: CCT Health
echo -n "1. Testing CCT health... "
((TOTAL++))
if curl -s "$CCT_URL/api/v1/data/health" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
fi

# Test 2: DAC Health
echo -n "2. Testing DAC backend health... "
((TOTAL++))
if curl -s "$DAC_URL/api/health" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
fi

# Test 3: Cache System
echo -n "3. Testing Durable Objects cache... "
((TOTAL++))
if curl -s "$CCT_URL/api/v1/cache/health" | jq -e '.assessment.status == "healthy"' >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
fi

# Test 4: Enhanced Sentiment Health
echo -n "4. Testing enhanced sentiment pipeline... "
((TOTAL++))
if curl -s "$CCT_URL/api/v1/sentiment/health" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
fi

# Test 5: Enhanced Sentiment Configuration
echo -n "5. Testing DAC integration configuration... "
((TOTAL++))
if curl -s "$CCT_URL/api/v1/sentiment/config" | jq -e '.config.dac_integration.enabled == true' >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
fi

# Test 6: Sentiment Analysis Functionality
echo -n "6. Testing sentiment analysis... "
((TOTAL++))
response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d '{"symbol":"AAPL","use_dac_integration":true}' \
    "$CCT_URL/api/v1/sentiment/enhanced" 2>/dev/null)

if echo "$response" | jq -e '.success == true' >/dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC}"
    ((FAILED++))
fi

# Summary
echo ""
echo "=========================================="
echo "Test Summary:"
echo "  Total: $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! DAC integration is working.${NC}"
    exit 0
else
    echo -e "${RED}❌ $FAILED test(s) failed. Check DAC integration.${NC}"
    exit 1
fi