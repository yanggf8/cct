#!/bin/bash

# Fix Test Authentication Script
# Removes hardcoded API keys and standardizes authentication across all test scripts

set -e

echo "🔧 Fixing Test Authentication Issues"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
files_fixed=0
files_checked=0
issues_found=0

echo -e "${BLUE}🔍 Scanning test files for authentication issues...${NC}"
echo ""

# Function to fix a single file
fix_file() {
    local file="$1"
    local temp_file=$(mktemp)

    echo "Processing: $file"

    # Copy file to temp location
    cp "$file" "$temp_file"

    local changes_made=false

    # Fix 1: Remove hardcoded API keys
    if grep -q 'X_API_KEY="[^"]*"' "$temp_file"; then
        echo "  ❌ Found hardcoded API key"
        sed -i 's/X_API_KEY="[^"]*"/X_API_KEY="${X_API_KEY:-}"/g' "$temp_file"
        echo "  ✅ Fixed hardcoded API key"
        changes_made=true
        issues_found=$((issues_found + 1))
    fi

    # Fix 2: Remove fallback hardcoded keys
    if grep -q 'X_API_KEY="${X_API_KEY:-[^}]*}"' "$temp_file"; then
        echo "  ❌ Found fallback hardcoded API key"
        sed -i 's/X_API_KEY="${X_API_KEY:-[^}]*}"/X_API_KEY="${X_API_KEY}"/g' "$temp_file"
        echo "  ✅ Fixed fallback API key"
        changes_made=true
        issues_found=$((issues_found + 1))
    fi

    # Fix 3: Fix the X_API_KEY length check logic error
    if grep -q 'length: 0' "$temp_file"; then
        echo "  ❌ Found logic error in length check"
        sed -i 's/length: 0/length: ${#X_API_KEY}/g' "$temp_file"
        echo "  ✅ Fixed length check logic"
        changes_made=true
        issues_found=$((issues_found + 1))
    fi

    # Fix 4: Standardize environment variable check
    if grep -q 'X_API_KEY.*length.*0' "$temp_file"; then
        echo "  ❌ Found inconsistent environment check"
        sed -i 's/echo "✅ X_API_KEY is set (length: 0)"/if [[ -n "${X_API_KEY:-}" ]]; then\
        echo "✅ X_API_KEY is set (length: ${#X_API_KEY})"\
    else\
        echo "❌ X_API_KEY environment variable is not set"\
        exit 1\
    fi/g' "$temp_file"
        echo "  ✅ Fixed environment check logic"
        changes_made=true
        issues_found=$((issues_found + 1))
    fi

    # Apply changes if any were made
    if [ "$changes_made" = true ]; then
        mv "$temp_file" "$file"
        echo "  📝 Changes applied"
        files_fixed=$((files_fixed + 1))
    else
        echo "  ✅ No issues found"
        rm "$temp_file"
    fi

    files_checked=$((files_checked + 1))
    echo ""
}

# Find all test files
echo -e "${BLUE}📁 Finding test files...${NC}"
test_files=$(find . -name "test*.sh" -type f | sort)

if [ -z "$test_files" ]; then
    echo -e "${RED}❌ No test files found${NC}"
    exit 1
fi

echo -e "${GREEN}Found $(echo "$test_files" | wc -l) test files${NC}"
echo ""

# Process each test file
for file in $test_files; do
    if [ -f "$file" ]; then
        fix_file "$file"
    fi
done

echo -e "${BLUE}📊 Fix Summary${NC}"
echo "==============="
echo -e "Files checked: $files_checked"
echo -e "Files fixed: $files_fixed"
echo -e "Issues resolved: $issues_found"

if [ $files_fixed -gt 0 ]; then
    echo -e "\n${GREEN}🎉 Authentication fixes completed!${NC}"
    echo -e "${GREEN}✅ All hardcoded API keys removed from test scripts${NC}"
    echo -e "${GREEN}✅ Environment variable authentication standardized${NC}"
    echo -e "${GREEN}✅ Logic errors fixed${NC}"
else
    echo -e "\n${YELLOW}⚠ No authentication issues found${NC}"
fi

echo -e "\n${BLUE}📋 Next Steps${NC}"
echo "============"
echo "1. Review the changes with: git diff"
echo "2. Test the fixes: X_API_KEY=your_key ./run-all-security-tests.sh"
echo "3. Commit the changes: git add . && git commit -m 'Fix hardcoded API keys in test scripts'"
echo "4. Run full test suite to validate"

echo -e "\n${CYAN}🔍 Verification${NC}"
echo "=============="

# Verification: Check for any remaining issues
echo -e "${BLUE}Checking for remaining hardcoded API keys...${NC}"
remaining_issues=$(grep -r 'X_API_KEY="[^"]*"' test*.sh 2>/dev/null | wc -l)

if [ "$remaining_issues" -gt 0 ]; then
    echo -e "${RED}❌ Still found $remaining_issues hardcoded API keys${NC}"
    echo -e "${RED}Please review these files manually:${NC}"
    grep -rn 'X_API_KEY="[^"]*"' test*.sh 2>/dev/null || true
else
    echo -e "${GREEN}✅ No hardcoded API keys remaining${NC}"
fi

echo -e "${BLUE}Checking for fallback hardcoded keys...${NC}"
remaining_fallbacks=$(grep -r 'X_API_KEY="${X_API_KEY:-[^}]*}"' test*.sh 2>/dev/null | wc -l)

if [ "$remaining_fallbacks" -gt 0 ]; then
    echo -e "${RED}❌ Still found $remaining_fallbacks fallback hardcoded keys${NC}"
    echo -e "${RED}Please review these files manually:${NC}"
    grep -rn 'X_API_KEY="${X_API_KEY:-[^}]*}"' test*.sh 2>/dev/null || true
else
    echo -e "${GREEN}✅ No fallback hardcoded keys remaining${NC}"
fi

echo -e "\n${CYAN}🎯 Security Status${NC}"
echo "=================="

if [ "$remaining_issues" -eq 0 ] && [ "$remaining_fallbacks" -eq 0 ]; then
    echo -e "${GREEN}🏆 ALL AUTHENTICATION ISSUES RESOLVED${NC}"
    echo -e "${GREEN}✅ Test suite is now security-compliant${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ SOME ISSUES STILL EXIST${NC}"
    echo -e "${YELLOW}⚠ Please review remaining issues manually${NC}"
    exit 1
fi