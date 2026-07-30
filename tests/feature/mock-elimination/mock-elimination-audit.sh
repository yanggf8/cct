#!/bin/bash

# Mock Elimination Audit Script
# Systematically identifies and helps eliminate all mock/placeholder data

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Mock Elimination Audit${NC}"
echo "==========================="
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Results tracking
TOTAL_ISSUES=0
FIXABLE_ISSUES=0
CRITICAL_ISSUES=0

# Create audit report directory
AUDIT_DIR="mock-audit-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$AUDIT_DIR"

echo "📁 Audit directory: $AUDIT_DIR"
echo ""

# Phase 1: Scan for Mock Patterns
echo -e "${BLUE}Phase 1: Scanning for Mock Patterns${NC}"
echo "======================================="

# Critical mock patterns to search for
CRITICAL_PATTERNS=(
    "getMockMacroDrivers"
    "getMockMarketStructure"
    "getMockGeopoliticalRisk"
    "mock-key"
    "demo-key"
    "test-key"
    "coming soon"
    "placeholder"
    "TODO.*data"
    "FIXME.*real"
    "dummy.*data"
)

echo "Searching for critical mock patterns..."

for pattern in "${CRITICAL_PATTERNS[@]}"; do
    echo ""
    echo "🔎 Pattern: $pattern"

    # Search in source files
    MATCHES=$(grep -r -n --include="*.ts" --include="*.js" "$pattern" src/ 2>/dev/null || echo "No matches")

    if [[ "$MATCHES" != "No matches" ]]; then
        echo -e "${RED}❌ FOUND CRITICAL MOCK PATTERN${NC}"
        echo "$MATCHES"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))

        # Save to audit report
        echo "Critical Pattern: $pattern" >> "$AUDIT_DIR/critical-issues.txt"
        echo "$MATCHES" >> "$AUDIT_DIR/critical-issues.txt"
        echo "" >> "$AUDIT_DIR/critical-issues.txt"
    else
        echo -e "${GREEN}✅ No critical matches${NC}"
    fi

    TOTAL_ISSUES=$((TOTAL_ISSUES + 1))
done

echo ""

# Phase 2: Scan for Hardcoded Values
echo -e "${BLUE}Phase 2: Scanning for Hardcoded Values${NC}"
echo "=========================================="

echo "Searching for suspicious hardcoded values..."

# Suspicious price patterns (round numbers, obviously fake)
SUSPICIOUS_PATTERNS=(
    "price.*: *[0-9]+\.0*\$"  # Prices ending in .00
    "price.*: *[0-9]+\.5$"     # Prices ending in .5
    "change.*: *0"             # Zero changes
    "changePercent.*: *0"      # Zero percent changes
    "volume.*: *[0-9]{7,}"     # Round volume numbers
    "confidence.*: [0-9]+\.[0-9]{2}"  # Two-decimal confidence scores
    "rate.*: *[0-9]+\.[0-9]%"  # Simple percentage rates
)

for pattern in "${SUSPICIOUS_PATTERNS[@]}"; do
    echo ""
    echo "🔎 Suspicious Pattern: $pattern"

    MATCHES=$(grep -r -n --include="*.ts" --include="*.js" -E "$pattern" src/ 2>/dev/null || echo "No matches")

    if [[ "$MATCHES" != "No matches" ]]; then
        echo -e "${YELLOW}⚠️  Found suspicious values${NC}"
        echo "$MATCHES" | head -10

        # Save to audit report
        echo "Suspicious Pattern: $pattern" >> "$AUDIT_DIR/suspicious-values.txt"
        echo "$MATCHES" >> "$AUDIT_DIR/suspicious-values.txt"
        echo "" >> "$AUDIT_DIR/suspicious-values.txt"

        FIXABLE_ISSUES=$((FIXABLE_ISSUES + 1))
    fi
done

echo ""

# Phase 3: Scan API Key Configurations
echo -e "${BLUE}Phase 3: API Key Configuration Scan${NC}"
echo "=========================================="

echo "Checking API key configurations..."

# Check for mock/test API keys
API_KEY_PATTERNS=(
    "FRED_API_KEY.*=.*['\"].*mock.*['\"]"
    "FRED_API_KEY.*=.*['\"].*demo.*['\"]"
    "FRED_API_KEY.*=.*['\"].*test.*['\"]"
    "API_KEY.*=.*['\"].*mock.*['\"]"
    "apiKey.*:.*['\"].*demo.*['\"]"
)

for pattern in "${API_KEY_PATTERNS[@]}"; do
    MATCHES=$(grep -r -n --include="*.ts" --include="*.js" -E "$pattern" src/ 2>/dev/null || echo "No matches")

    if [[ "$MATCHES" != "No matches" ]]; then
        echo -e "${RED}❌ FOUND MOCK API KEYS${NC}"
        echo "$MATCHES"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))

        # Save to audit report
        echo "Mock API Keys:" >> "$AUDIT_DIR/api-key-issues.txt"
        echo "$MATCHES" >> "$AUDIT_DIR/api-key-issues.txt"
        echo "" >> "$AUDIT_DIR/api-key-issues.txt"
    fi
done

# Check if API keys are properly configured
if [[ -f "src/modules/config.ts" ]]; then
    echo ""
    echo "🔎 Checking config.ts for API key usage..."

    # Check for default/mock API keys
    if grep -q "demo-key\|mock-key\|test-key" "src/modules/config.ts"; then
        echo -e "${RED}❌ Config has default mock keys${NC}"
        grep -n "demo-key\|mock-key\|test-key" "src/modules/config.ts"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    else
        echo -e "${GREEN}✅ No mock keys in config${NC}"
    fi
fi

echo ""

# Phase 4: Check Frontend JavaScript
echo -e "${BLUE}Phase 4: Frontend JavaScript Scan${NC}"
echo "===================================="

echo "Scanning frontend JavaScript for mock data..."

if [[ -d "public/js" ]]; then
    # Look for mock data generators
    MOCK_GEN_PATTERNS=(
        "generateMock.*Data"
        "mockData.*="
        "placeholder.*="
        "testData.*="
        "fakeData.*="
    )

    for pattern in "${MOCK_GEN_PATTERNS[@]}"; do
        MATCHES=$(find public/js -name "*.js" -exec grep -l "$pattern" {} \; 2>/dev/null || echo "No matches")

        if [[ "$MATCHES" != "No matches" ]]; then
            echo -e "${YELLOW}⚠️  Found mock data generators:${NC}"
            echo "$MATCHES"

            # Show details for first few files
            for file in $(echo "$MATCHES" | head -3); do
                echo "  📄 $file:"
                grep -n "$pattern" "$file" | head -3
            done

            FIXABLE_ISSUES=$((FIXABLE_ISSUES + 1))
        fi
    done

    # Check for obviously fake data in frontend
    echo ""
    echo "🔎 Checking for obviously fake frontend data..."

    FAKE_DATA_PATTERNS=(
        "price.*:.*Math\.random.*200.*50"  // Random prices in range
        "sentiment.*:.*Math\.random"       // Random sentiment
        "changePercent.*:.*Math\.random"   // Random changes
    )

    for pattern in "${FAKE_DATA_PATTERNS[@]}"; do
        MATCHES=$(find public/js -name "*.js" -exec grep -l "$pattern" {} \; 2>/dev/null || echo "No matches")

        if [[ "$MATCHES" != "No matches" ]]; then
            echo -e "${RED}❌ Found fake data generation:${NC}"
            echo "$MATCHES"
            CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
        fi
    done
else
    echo "📁 No public/js directory found"
fi

echo ""

# Phase 5: Check Test Data Leakage
echo -e "${BLUE}Phase 5: Test Data Leakage Scan${NC}"
echo "==================================="

echo "Checking for test data in production code..."

# Look for test patterns in source files
TEST_LEAKAGE_PATTERNS=(
    "test.*data"
    "fixture.*data"
    "spec.*data"
    "mock.*response"
    "stub.*data"
)

for pattern in "${TEST_LEAKAGE_PATTERNS[@]}"; do
    # Only check src/ directory, not test files
    MATCHES=$(grep -r -n --include="*.ts" --exclude-dir=test --exclude="*test*" "$pattern" src/ 2>/dev/null || echo "No matches")

    if [[ "$MATCHES" != "No matches" ]]; then
        echo -e "${YELLOW}⚠️  Potential test data leakage:${NC}"
        echo "$MATCHES" | head -5
        FIXABLE_ISSUES=$((FIXABLE_ISSUES + 1))
    fi
done

echo ""

# Phase 6: Data Source Validation
echo -e "${BLUE}Phase 6: Data Source Validation${NC}"
echo "=================================="

echo "Checking data source configurations..."

# Check for missing real data sources
DATA_SOURCE_PATTERNS=(
    "dataSource.*:.*static"
    "dataSource.*:.*mock"
    "useMockData.*true"
    "fallbackToMock"
    "development.*true"
)

for pattern in "${DATA_SOURCE_PATTERNS[@]}"; do
    MATCHES=$(grep -r -n --include="*.ts" --include="*.js" -E "$pattern" src/ 2>/dev/null || echo "No matches")

    if [[ "$MATCHES" != "No matches" ]]; then
        echo -e "${YELLOW}⚠️  Non-production data sources:${NC}"
        echo "$MATCHES"
        FIXABLE_ISSUES=$((FIXABLE_ISSUES + 1))
    fi
done

# Check FRED API integration
if [[ -f "src/modules/config.ts" ]]; then
    echo ""
    echo "🔎 Checking FRED API configuration..."

    if grep -q "FRED_API_KEY" "src/modules/config.ts"; then
        echo -e "${GREEN}✅ FRED API key configuration found${NC}"

        # Check if it has proper validation
        if grep -q "demo.*\|mock.*\|test.*" "src/modules/config.ts"; then
            echo -e "${YELLOW}⚠️  FRED key may use mock values${NC}"
        else
            echo -e "${GREEN}✅ FRED key appears properly configured${NC}"
        fi
    else
        echo -e "${RED}❌ No FRED API key configuration${NC}"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    fi
fi

echo ""

# Phase 7: Generate Summary Report
echo -e "${BLUE}Phase 7: Audit Summary${NC}"
echo "======================"

# Calculate totals
TOTAL_SCANNED=$(( ${#CRITICAL_PATTERNS[@]} + ${#SUSPICIOUS_PATTERNS[@]} + ${#API_KEY_PATTERNS[@]} ))

# Create summary report
cat > "$AUDIT_DIR/audit-summary.md" << EOF
# Mock Elimination Audit Report

**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Audit Directory:** $AUDIT_DIR

## Executive Summary

- **Total Issues Found:** $TOTAL_ISSUES
- **Critical Issues:** $CRITICAL_ISSUES
- **Fixable Issues:** $FIXABLE_ISSUES
- **Compliance Status:** $([ $CRITICAL_ISSUES -eq 0 ] && echo "✅ COMPLIANT" || echo "❌ NON-COMPLIANT")

## Issue Categories

### Critical Issues ($CRITICAL_ISSUES)
- Mock API keys in configuration
- Mock data generation functions
- "Coming soon" placeholder responses
- Test data leakage to production

### Fixable Issues ($FIXABLE_ISSUES)
- Suspicious hardcoded values
- Random data generation in frontend
- Non-production data sources
- Missing real data integration

## Files with Issues

EOF

# Add files with critical issues to summary
if [[ -f "$AUDIT_DIR/critical-issues.txt" ]]; then
    echo "" >> "$AUDIT_DIR/audit-summary.md"
    echo "### Critical Issue Files" >> "$AUDIT_DIR/audit-summary.md"
    grep -o "src/[^:]*" "$AUDIT_DIR/critical-issues.txt" | sort -u | while read file; do
        echo "- $file" >> "$AUDIT_DIR/audit-summary.md"
    done
fi

# Add files with suspicious values to summary
if [[ -f "$AUDIT_DIR/suspicious-values.txt" ]]; then
    echo "" >> "$AUDIT_DIR/audit-summary.md"
    echo "### Files with Suspicious Values" >> "$AUDIT_DIR/audit-summary.md"
    grep -o "src/[^:]*" "$AUDIT_DIR/suspicious-values.txt" | sort -u | while read file; do
        echo "- $file" >> "$AUDIT_DIR/audit-summary.md"
    done
fi

# Add recommendations
cat >> "$AUDIT_DIR/audit-summary.md" << EOF

## Recommendations

### Immediate Actions (Critical)
1. Replace all mock API keys with environment variables
2. Remove "coming soon" placeholder responses
3. Eliminate mock data generation functions
4. Move test data to proper test directories

### Short-term Actions (Fixable)
1. Replace hardcoded values with API calls
2. Implement real data validation
3. Add mock detection guards
4. Configure production data sources

### Long-term Actions
1. Implement comprehensive data source monitoring
2. Add automated mock detection in CI/CD
3. Create data source compliance dashboard
4. Regular mock elimination audits

## Next Steps

1. Review detailed issues in audit files
2. Create tickets for each critical issue
3. Implement real data replacements
4. Add production guards to prevent regressions
5. Run follow-up audit after fixes
EOF

echo "📊 Audit Results:"
echo "  Total Patterns Scanned: $TOTAL_SCANNED"
echo "  Total Issues Found: $TOTAL_ISSUES"
echo "  Critical Issues: $CRITICAL_ISSUES"
echo "  Fixable Issues: $FIXABLE_ISSUES"
echo ""
echo "📁 Detailed reports saved to: $AUDIT_DIR/"
echo "  - critical-issues.txt"
echo "  - suspicious-values.txt"
echo "  - api-key-issues.txt"
echo "  - audit-summary.md"

echo ""

# Phase 8: Compliance Assessment
echo -e "${BLUE}Phase 8: Compliance Assessment${NC}"
echo "================================="

if [[ $CRITICAL_ISSUES -eq 0 ]]; then
    echo -e "🎉 ${GREEN}PRODUCTION READY${NC}"
    echo "✅ No critical mock data issues found"
    echo "✅ System appears compliant with real data requirements"

    if [[ $FIXABLE_ISSUES -eq 0 ]]; then
        echo "✅ No suspicious values detected"
        echo "✅ Complete mock elimination achieved"
    else
        echo -e "${YELLOW}⚠️  Minor improvements possible${NC}"
        echo "  Some suspicious values found - review recommended"
    fi

    COMPLIANCE_STATUS="COMPLIANT"
    exit 0
else
    echo -e "❌ ${RED}NOT PRODUCTION READY${NC}"
    echo "❌ Critical mock data issues must be resolved"
    echo "❌ System not compliant with real data policy"

    echo ""
    echo "🚨 Immediate Actions Required:"
    echo "  1. Replace all mock API keys with real values"
    echo "  2. Remove mock data generation functions"
    echo "  3. Eliminate 'coming soon' placeholder responses"
    echo "  4. Move test data to appropriate test directories"

    COMPLIANCE_STATUS="NON-COMPLIANT"
    exit 1
fi