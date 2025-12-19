#!/bin/bash

# Master Security Test Runner
# Executes all security-related test suites in the correct order
# Provides comprehensive security validation coverage

set -e

echo "🔒 CCT TRADING SYSTEM - MASTER SECURITY TEST SUITE"
echo "=================================================="
echo "Running all security tests to validate P0/P1 fixes"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

# Function to run test suite
run_test_suite() {
    local test_script="$1"
    local test_name="$2"
    local description="$3"

    echo -e "\n${CYAN}🧪 Running: $test_name${NC}"
    echo -e "${BLUE}Description: $description${NC}"
    echo -e "${BLUE}Script: $test_script${NC}"
    echo "----------------------------------------"

    if [ ! -f "$test_script" ]; then
        echo -e "${RED}❌ Test script not found: $test_script${NC}"
        FAILED_SUITES=$((FAILED_SUITES + 1))
        return 1
    fi

    if [ ! -x "$test_script" ]; then
        echo -e "${YELLOW}⚠ Making script executable: $test_script${NC}"
        chmod +x "$test_script"
    fi

    TOTAL_SUITES=$((TOTAL_SUITES + 1))

    # Run the test with timeout and capture results
    echo "Starting test execution..."
    start_time=$(date +%s)

    if timeout 300 ./"$test_script" 2>&1; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        echo -e "\n${GREEN}✅ PASSED: $test_name${NC} (${duration}s)"
        PASSED_SUITES=$((PASSED_SUITES + 1))
        return 0
    else
        exit_code=$?
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        echo -e "\n${RED}❌ FAILED: $test_name${NC} (${duration}s, exit code: $exit_code)"
        FAILED_SUITES=$((FAILED_SUITES + 1))
        return 1
    fi
}

# Function to display final results
display_results() {
    echo -e "\n${CYAN}📊 SECURITY TEST SUITE SUMMARY${NC}"
    echo "=================================="
    echo -e "Total Test Suites: $TOTAL_SUITES"
    echo -e "${GREEN}Passed: $PASSED_SUITES${NC}"
    echo -e "${RED}Failed: $FAILED_SUITES${NC}"

    success_rate=0
    if [ $TOTAL_SUITES -gt 0 ]; then
        success_rate=$(( (PASSED_SUITES * 100) / TOTAL_SUITES ))
    fi

    echo -e "Success Rate: $success_rate%"

    if [ $FAILED_SUITES -eq 0 ]; then
        echo -e "\n${GREEN}🎉 ALL SECURITY TESTS PASSED!${NC}"
        echo -e "${GREEN}✅ Security implementation is validated and ready${NC}"
        echo -e "\n${CYAN}📋 Next Steps:${NC}"
        echo -e "1. Deploy security enhancements to production"
        echo -e "2. Run tests against production environment"
        echo -e "3. Monitor security metrics dashboard"
        echo -e "4. Schedule regular security test executions"
        return 0
    else
        echo -e "\n${RED}❌ SOME SECURITY TESTS FAILED${NC}"
        echo -e "${RED}⚠️ Review failed tests before production deployment${NC}"
        echo -e "\n${YELLOW}📋 Troubleshooting:${NC}"
        echo -e "1. Check API connectivity and environment variables"
        echo -e "2. Verify all security modules are deployed"
        echo -e "3. Review test logs for specific error details"
        echo -e "4. Fix identified security issues"
        echo -e "5. Re-run failed test suites"
        return 1
    fi
}

# Pre-flight checks
echo -e "${BLUE}🔍 Pre-flight Environment Checks${NC}"
echo "-----------------------------------"

# Check if we're in the right directory
if [ ! -f "wrangler.toml" ] || [ ! -d "src" ]; then
    echo -e "${RED}❌ Not in CCT project directory${NC}"
    echo -e "${YELLOW}Please navigate to the CCT project root${NC}"
    exit 1
fi

# Check environment variables
if [ -z "$X_API_KEY" ]; then
    echo -e "${YELLOW}⚠ WARNING: X_API_KEY environment variable not set${NC}"
    echo -e "${YELLOW}Some tests may fail or be skipped${NC}"
    echo -e "${YELLOW}Set it with: export X_API_KEY=your_api_key${NC}"
else
    echo -e "${GREEN}✅ X_API_KEY is set (length: ${#X_API_KEY})${NC}"
fi

# Check network connectivity
echo -e "${BLUE}Testing network connectivity...${NC}"
if curl -s --max-time 10 "https://tft-trading-system.yanggf.workers.dev/api/v1" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API connectivity confirmed${NC}"
else
    echo -e "${YELLOW}⚠ API connectivity issues detected${NC}"
    echo -e "${YELLOW}Some tests may fail due to network issues${NC}"
fi

echo ""
echo -e "${CYAN}🚀 Starting Security Test Execution${NC}"
echo "===================================="

# Execute test suites in order of importance

# 1. Core Authentication Tests
run_test_suite "test-auth-security.sh" \
    "Authentication Security Tests" \
    "Validates hardcoded API key fixes and authentication workflows"

# 2. Input Validation Tests
run_test_suite "test-api-security.sh" \
    "API Security Tests" \
    "Tests input validation, sanitization, and basic security features"

# 3. Comprehensive Security Integration Tests
run_test_suite "test-comprehensive-security-integration.sh" \
    "Comprehensive Security Integration" \
    "Complete security validation covering all P0/P1 fixes"

# 4. Additional Security-Related Tests (if they exist)
if [ -f "test-data-validation.sh" ]; then
    run_test_suite "test-data-validation.sh" \
        "Data Validation Tests" \
        "Validates data handling and validation security"
fi

# 5. Final validation summary
display_results

echo -e "\n${CYAN}📚 Additional Resources${NC}"
echo "======================"
echo -e "📖 Security Documentation:"
echo -e "   • docs/SECURITY_VALIDATION_CHECKLIST.md"
echo -e "   • docs/SECURITY_DEPLOYMENT_GUIDE.md"
echo -e "   • docs/SECURITY_TEST_COVERAGE_ANALYSIS.md"
echo -e ""
echo -e "🔧 Individual Test Scripts:"
echo -e "   • ./test-auth-security.sh"
echo -e "   • ./test-api-security.sh"
echo -e "   • ./test-comprehensive-security-integration.sh"
echo -e ""
echo -e "📊 Security Monitoring:"
echo -e "   • GET /api/v1/security/status (requires API key)"
echo -e "   • Check logs for security events"
echo -e "   • Monitor rate limiting effectiveness"

exit_code=$?
echo -e "\n${CYAN}Test execution completed at $(date)${NC}"
exit $exit_code