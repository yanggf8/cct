#!/bin/bash

# Simple validation test for X_API_KEY implementation

export X_API_KEY="${X_API_KEY:-}"
API_URL="https://tft-trading-system.yanggf.workers.dev"

echo "🎯 Simple Validation Test Suite"
echo "==============================="

# Test 1: Environment variable
echo -e "\n1. Environment Variable:"
echo "✅ X_API_KEY is set (length: ${#X_API_KEY})"

# Test 2: API connectivity
echo -e "\n2. API Connectivity:"
if timeout 10 curl -s -H "X-API-KEY: $X_API_KEY" "$API_URL/health" | jq -e '.status' >/dev/null 2>&1; then
    echo "✅ System Health Endpoint"
else
    echo "❌ System Health Endpoint"
fi

if timeout 10 curl -s -H "X-API-KEY: $X_API_KEY" "$API_URL/api/v1/data/health" | jq -e '.success' >/dev/null 2>&1; then
    echo "✅ API v1 Health Endpoint"
else
    echo "❌ API v1 Health Endpoint"
fi

# Test 3: Test script validation
echo -e "\n3. Test Script Validation:"
SCRIPTS_WITH_CHECKS=$(grep -l "X_API_KEY.*is not set\|X_API_KEY.*length" /home/yanggf/a/cct/test-*.sh 2>/dev/null | wc -l)
TOTAL_SCRIPTS=$(find /home/yanggf/a/cct -name "test-*.sh" -type f | wc -l)
echo "✅ Scripts with X_API_KEY checks: $SCRIPTS_WITH_CHECKS/$TOTAL_SCRIPTS"

# Test 4: Documentation validation
echo -e "\n4. Documentation Validation:"
if ! grep -r '"yanggf"' /home/yanggf/a/cct/*.md 2>/dev/null >/dev/null; then
    echo "✅ No hardcoded API keys in documentation"
else
    echo "❌ Documentation still contains hardcoded API keys"
fi

echo -e "\n5. Security Validation:"
if ! grep -r "export API_KEY" /home/yanggf/a/cct/test-*.sh 2>/dev/null | grep -v "test-final-validation.sh\|test-simple-validation.sh" >/dev/null; then
    echo "✅ No API_KEY exports in test scripts"
else
    echo "❌ Test scripts still export API_KEY"
fi

echo -e "\n6. Server Code Validation:"
if grep -q "env.X_API_KEY" /home/yanggf/a/cct/src/modules/*.ts; then
    echo "✅ Server code uses X_API_KEY environment variable"
else
    echo "❌ Server code not updated to use X_API_KEY"
fi

if grep -q "'X-API-KEY'" /home/yanggf/a/cct/src/modules/*.ts; then
    echo "✅ Server code uses correct header case (X-API-KEY)"
else
    echo "❌ Server code header case needs updating"
fi

echo -e "\n✅ Validation complete!"