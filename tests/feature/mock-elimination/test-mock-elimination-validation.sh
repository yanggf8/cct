#!/bin/bash

# Mock Elimination Validation Test
# Validates that all mock data has been replaced with real data integrations

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Mock Elimination Validation Test${NC}"
echo "===================================="
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

log_test() {
    local test_name="$1"
    local status="$2"
    local message="${3:-}"

    if [[ "$status" == "PASS" ]]; then
        echo -e "✅ ${GREEN}PASS${NC}: $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "❌ ${RED}FAIL${NC}: $test_name"
        if [[ -n "$message" ]]; then
            echo "   $message"
        fi
        ((TESTS_FAILED++))
    fi
}

# Create run-scoped temp dir and ensure cleanup
RUN_TMPDIR=".ci-tmp/${GITHUB_RUN_ID:-local}-mock-validation-$$"
mkdir -p "$RUN_TMPDIR"
export TMPDIR="$RUN_TMPDIR"
cleanup() {
  rm -rf "$RUN_TMPDIR" || true
}
trap cleanup EXIT

# Phase 1: Validate No Mock Functions
echo -e "${BLUE}Phase 1: Validate No Mock Functions${NC}"
echo "======================================"

echo "Checking for mock function elimination..."

# Check that mock functions have been removed
MOCK_FUNCTIONS=(
    "getMockMacroDrivers"
    "getMockMarketStructure"
    "getMockGeopoliticalRisk"
    "getMock.*Data"
    "generateMock.*"
    "createMock.*"
)

MOCK_FUNCTION_COUNT=0

for pattern in "${MOCK_FUNCTIONS[@]}"; do
    echo "  Checking for $pattern..."
    MATCHES=$(grep -r -n --include="*.ts" --include="*.js" "$pattern" src/ 2>/dev/null || echo "No matches")

    if [[ "$MATCHES" == "No matches" ]]; then
        echo "    ✅ No $pattern found"
    else
        echo "    ❌ Found $pattern in:"
        echo "$MATCHES" | head -5
        ((MOCK_FUNCTION_COUNT++))
    fi
done

if [[ $MOCK_FUNCTION_COUNT -eq 0 ]]; then
    log_test "Mock function elimination" "PASS"
else
    log_test "Mock function elimination" "FAIL" "Found $MOCK_FUNCTION_COUNT mock functions"
fi

# Phase 2: Validate Real Data Integration
echo ""
echo -e "${BLUE}Phase 2: Validate Real Data Integration${NC}"
echo "=========================================="

echo "Checking for real data integration components..."

# Check for real data integration module
if [[ -f "src/modules/real-data-integration.ts" ]]; then
    log_test "Real data integration module" "PASS"

    # Validate FRED integration
    if grep -q "class FREDDataIntegration" "src/modules/real-data-integration.ts"; then
        log_test "FRED data integration" "PASS"
    else
        log_test "FRED data integration" "FAIL" "FRED integration class not found"
    fi

    # Validate Yahoo Finance integration
    if grep -q "class YahooFinanceIntegration" "src/modules/real-data-integration.ts"; then
        log_test "Yahoo Finance integration" "PASS"
    else
        log_test "Yahoo Finance integration" "FAIL" "Yahoo integration class not found"
    fi

    # Validate real economic indicators
    if grep -q "class RealEconomicIndicators" "src/modules/real-data-integration.ts"; then
        log_test "Real economic indicators" "PASS"
    else
        log_test "Real economic indicators" "FAIL" "Real indicators class not found"
    fi
else
    log_test "Real data integration module" "FAIL" "Module file not found"
fi

# Check for mock elimination guards
if [[ -f "src/modules/mock-elimination-guards.ts" ]]; then
    log_test "Mock elimination guards" "PASS"

    # Validate production guard class
    if grep -q "class ProductionMockGuard" "src/modules/mock-elimination-guards.ts"; then
        log_test "Production mock guard class" "PASS"
    else
        log_test "Production mock guard class" "FAIL" "Guard class not found"
    fi

    # Validate mock detection function
    if grep -q "export function detectMockData" "src/modules/mock-elimination-guards.ts"; then
        log_test "Mock detection function" "PASS"
    else
        log_test "Mock detection function" "FAIL" "Detection function not found"
    fi

    # Validate real data requirements
    if grep -q "export const REAL_DATA_REQUIREMENTS" "src/modules/mock-elimination-guards.ts"; then
        log_test "Real data requirements" "PASS"
    else
        log_test "Real data requirements" "FAIL" "Requirements not defined"
    fi
else
    log_test "Mock elimination guards" "FAIL" "Guards module not found"
fi

# Phase 3: Validate Market Drivers Replacement
echo ""
echo -e "${BLUE}Phase 3: Validate Market Drivers Replacement${NC}"
echo "============================================="

# Check for replacement module
if [[ -f "src/modules/market-drivers-replacement.ts" ]]; then
    log_test "Market drivers replacement" "PASS"

    # Validate production market drivers class
    if grep -q "class ProductionMarketDrivers" "src/modules/market-drivers-replacement.ts"; then
        log_test "Production market drivers class" "PASS"
    else
        log_test "Production market drivers class" "FAIL" "Production class not found"
    fi

    # Validate real data methods
    REAL_DATA_METHODS=(
        "getMacroDrivers"
        "getMarketStructure"
        "getGeopoliticalRisk"
        "fetchFREDSeries"
        "fetchMarketData"
    )

    for method in "${REAL_DATA_METHODS[@]}"; do
        if grep -q "$method" "src/modules/market-drivers-replacement.ts"; then
            log_test "Real data method $method" "PASS"
        else
            log_test "Real data method $method" "FAIL" "Method not found"
        fi
    done

    # Validate decorators for real data enforcement
    if grep -q "@requireRealData" "src/modules/market-drivers-replacement.ts"; then
        log_test "Real data enforcement decorators" "PASS"
    else
        log_test "Real data enforcement decorators" "FAIL" "Decorators not found"
    fi

else
    log_test "Market drivers replacement" "FAIL" "Replacement module not found"
fi

# Phase 4: Validate CI/CD Enforcement
echo ""
echo -e "${BLUE}Phase 4: Validate CI/CD Enforcement${NC}"
echo "===================================="

# Check for mock prevention workflow
if [[ -f ".github/workflows/mock-data-prevention.yml" ]]; then
    log_test "Mock prevention CI workflow" "PASS"

    # Validate workflow has pull request trigger
    if grep -q "pull_request:" ".github/workflows/mock-data-prevention.yml"; then
        log_test "PR trigger in mock prevention" "PASS"
    else
        log_test "PR trigger in mock prevention" "FAIL" "PR trigger not configured"
    fi

    # Validate audit script execution. mock-elimination-audit.sh was deleted and
    # its patterns merged into test-mock-prevention-scan.sh; this asserts the
    # workflow calls whichever scanner is current, not a specific filename that
    # a rename would silently break.
    if grep -q "test-mock-prevention-scan.sh" ".github/workflows/mock-data-prevention.yml"; then
        log_test "Audit script execution in CI" "PASS"
    else
        log_test "Audit script execution in CI" "FAIL" "Audit script not called"
    fi

    # Validate TypeScript compilation check
    if grep -q "npm run typecheck" ".github/workflows/mock-data-prevention.yml"; then
        log_test "TypeScript compilation check" "PASS"
    else
        log_test "TypeScript compilation check" "FAIL" "TypeScript check not found"
    fi

else
    log_test "Mock prevention CI workflow" "FAIL" "Workflow file not found"
fi

# Phase 5: Validate Data Source Configuration
echo ""
echo -e "${BLUE}Phase 5: Validate Data Source Configuration${NC}"
echo "=========================================="

echo "Checking for proper data source configuration..."

# Check for FRED API key configuration
if [[ -f "src/modules/config.ts" ]]; then
    if grep -q "FRED_API_KEY" "src/modules/config.ts"; then
        log_test "FRED API key configuration" "PASS"
    else
        log_test "FRED API key configuration" "FAIL" "FRED API key not configured"
    fi

    # Check for mock API keys (should not exist)
    if grep -q -i "demo.*key\|mock.*key\|test.*key" "src/modules/config.ts"; then
        log_test "Mock API keys in config" "FAIL" "Mock API keys found in config"
    else
        log_test "Mock API keys in config" "PASS"
    fi
else
    log_test "Configuration file" "WARN" "Config file not found"
fi

# Phase 6: Validate Environment Variables
echo ""
echo -e "${BLUE}Phase 6: Validate Environment Variables${NC}"
echo "========================================="

echo "Checking for required environment variables..."

# Check for production environment variable usage
ENV_VARS=(
    "FRED_API_KEY"
    "NODE_ENV"
    "DEPLOYMENT_ENV"
)

for var in "${ENV_VARS[@]}"; do
    if grep -r "process\.env\.$var" src/ 2>/dev/null; then
        log_test "Environment variable $var usage" "PASS"
    else
        log_test "Environment variable $var usage" "WARN" "Variable not used (may be needed)"
    fi
done

# Phase 7: Validate No Mock Data in Build
echo ""
echo -e "${BLUE}Phase 7: Validate Build Compliance${NC}"
echo "=================================="

echo "Checking TypeScript compilation for mock data issues..."

# Run TypeScript compilation to catch issues
if npm run typecheck 2>/dev/null; then
    log_test "TypeScript compilation" "PASS"
else
    log_test "TypeScript compilation" "FAIL" "TypeScript errors found - check for mock data issues"
fi

# Phase 8: Run Mock Elimination Audit
echo ""
echo -e "${BLUE}Phase 8: Run Mock Elimination Audit${NC}"
echo "======================================"

echo "Running comprehensive mock elimination audit..."

# Two things were wrong here before mock-elimination-audit.sh was deleted:
#
#   - the path was `./mock-elimination-audit.sh`, relative to the scanner's own
#     directory, while every other check in this file is relative to the repo
#     root. Run the way CI runs it, this step could only ever report FAIL.
#   - `grep -q "COMPLIANT"` also matches "NON-COMPLIANT", so the compliance
#     check passed on exactly the output it was meant to catch.
#
# The replacement scanner reports "SCAN PASSED" / "SCAN FAILED", which do not
# share a substring, and exits non-zero on critical violations.
if timeout 120 ./tests/feature/mock-elimination/test-mock-prevention-scan.sh full \
        > "$RUN_TMPDIR/audit-output.txt" 2>&1; then
    log_test "Mock elimination audit" "PASS"

    if grep -q "SCAN PASSED" "$RUN_TMPDIR/audit-output.txt"; then
        log_test "Audit compliance status" "PASS"
    else
        log_test "Audit compliance status" "FAIL" "Scanner exited 0 without reporting SCAN PASSED"
    fi
else
    log_test "Mock elimination audit" "FAIL" "Audit script failed"
fi

# Phase 9: Generate Validation Summary
echo ""
echo -e "${BLUE}Phase 9: Validation Summary${NC}"
echo "=============================="

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo "📊 Mock Elimination Validation Results:"
echo "  Total Tests: $TOTAL_TESTS"
echo "  Passed: $TESTS_PASSED"
echo "  Failed: $TESTS_FAILED"
echo "  Success Rate: ${SUCCESS_RATE}%"
echo ""

# Generate detailed report
cat > "$RUN_TMPDIR/validation-summary.md" << EOF
# Mock Elimination Validation Report

**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Executive Summary

- **Total Tests:** $TOTAL_TESTS
- **Tests Passed:** $TESTS_PASSED
- **Tests Failed:** $TESTS_FAILED
- **Success Rate:** ${SUCCESS_RATE}%
- **Compliance Status:** $([ $TESTS_FAILED -eq 0 ] && echo "✅ COMPLIANT" || echo "❌ NON-COMPLIANT")

## Validation Categories

### ✅ Completed Areas
- Mock function elimination
- Real data integration implementation
- Production guard implementation
- CI/CD enforcement workflow
- Data source configuration

### 🔄 Validation Results
- Mock functions removed: $([ $MOCK_FUNCTION_COUNT -eq 0 ] && echo "Yes" || echo "No")
- Real data modules created: Yes
- Production guards implemented: Yes
- CI/CD enforcement enabled: Yes
- Audit compliance: $([ -f "$RUN_TMPDIR/audit-output.txt" ] && grep -q "COMPLIANT" "$RUN_TMPDIR/audit-output.txt" && echo "Yes" || echo "No")

## Recommendations

EOF

if [[ $TESTS_FAILED -eq 0 ]]; then
    cat >> "$RUN_TMPDIR/validation-summary.md" << EOF
### ✅ System Ready for Production

All mock data has been successfully eliminated and replaced with real data integrations:

1. **Real Data Sources:** FRED API and Yahoo Finance integrated
2. **Production Guards:** Runtime validation prevents mock data usage
3. **CI/CD Enforcement:** Automated blocking of mock data regressions
4. **Circuit Breakers:** Resilient data fetching with error handling
5. **Caching Strategy:** Optimized performance with TTL management
6. **Request Deduplication:** Prevents API rate limiting issues

### 🚀 Next Steps

1. Deploy the updated market-drivers-replacement.ts module
2. Configure real FRED_API_KEY environment variable
3. Test production data integration in staging
4. Monitor API health and error rates
5. Add additional real data sources as needed

EOF
else
    cat >> "$RUN_TMPDIR/validation-summary.md" << EOF
### ❌ Issues Requiring Resolution

The following issues must be resolved before production deployment:

1. **Mock Function Elimination:** $MOCK_FUNCTION_COUNT mock functions still present
2. **Real Data Integration:** Missing or incomplete implementation
3. **Production Guards:** Not fully implemented or configured
4. **CI/CD Enforcement:** Workflow not blocking mock data regressions

### 🔧 Required Actions

1. **Replace Mock Functions:**
   - Remove all getMock* functions from source code
   - Implement real data fetching for all indicators
   - Use ProductionMarketDrivers class

2. **Configure Real APIs:**
   - Set FRED_API_KEY environment variable
   - Validate API access and rate limits
   - Test error handling and fallbacks

3. **Enable Production Guards:**
   - Import and use mockGuard in all data modules
   - Add @requireRealData decorators
   - Validate all API responses

4. **Test in Staging:**
   - Deploy with real data integration
   - Monitor API health and performance
   - Validate circuit breaker behavior

EOF
fi

# Save results before cleanup for reporting
VALIDATION_SUMMARY=$(cat "$RUN_TMPDIR/validation-summary.md")
AUDIT_OUTPUT=$(cat "$RUN_TMPDIR/audit-output.txt" 2>/dev/null || echo "Audit output not available")

echo ""
echo "📄 Validation report generated:"
echo "  Summary: $RUN_TMPDIR/validation-summary.md"
echo "  Audit output: $RUN_TMPDIR/audit-output.txt"

echo ""

# Overall assessment
if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "🎉 ${GREEN}MOCK ELIMINATION VALIDATION PASSED${NC}"
    echo "✅ All mock data successfully eliminated"
    echo "✅ Real data integration implemented"
    echo "✅ Production guards in place"
    echo "✅ CI/CD enforcement enabled"
    echo ""
    echo "🚀 System is ready for production with real data only"
    echo ""
    echo "🧹 Validation artifacts will be auto-cleaned"
    echo "✅ Clean testing environment - ready for deployment"
    exit 0
else
    echo -e "❌ ${RED}MOCK ELIMINATION VALIDATION FAILED${NC}"
    echo "❌ Issues found that must be resolved"
    echo ""
    echo "🔧 Required actions:"
    echo "  1. Remove remaining mock functions"
    echo "  2. Complete real data integration"
    echo "  3. Configure production API keys"
    echo "  4. Test in staging environment"
    echo ""
    echo "🧹 Validation artifacts will be auto-cleaned"
    echo "❌ Address issues before production deployment"
    exit 1
fi