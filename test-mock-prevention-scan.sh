#!/bin/bash

# Mock Prevention Scan Script
# Local development version of CI build-time mock prevention

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCAN_MODE="${1:-quick}"  # quick, full, strict
EXEMPTION_PATTERN="${EXEMPTION_PATTERN:-MOCK-EXEMPTION: [A-Z]+-[0-9]+}"

echo "🔍 Mock Prevention Scan"
echo "======================="
echo "Mode: $SCAN_MODE"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Banned patterns with severity levels
declare -A CRITICAL_PATTERNS=(
    ["coming soon"]="Critical placeholder text"
    ["COMING SOON"]="Uppercase placeholder text"
    ["mock data"]="Explicit mock data references"
    ["MOCK DATA"]="Uppercase mock data"
    ["test data"]="Test-only data in production"
    ["TEST DATA"]="Uppercase test data"
    ["lorem ipsum"]="Latin placeholder text"
    ["Lorem ipsum"]="Capitalized placeholder"
    ["not implemented"]="Unimplemented feature markers"
    ["NOT IMPLEMENTED"]="Uppercase unimplemented"
    ["\[\s*TODO\s*\]"]="TODO blocks (should have ticket references)"
)

declare -A WARNING_PATTERNS=(
    ["placeholder"]="Generic placeholder content"
    ["PLACEHOLDER"]="Uppercase placeholder"
    ["example\.com"]="Example domain references"
    ["EXAMPLE\.COM"]="Uppercase example domain"
    ["fake.*timestamp"]="Generated fake timestamps"
    ["FAKE.*timestamp"]="Uppercase fake timestamps"
)

declare -A INFO_PATTERNS=(
    ["console\.log"]="Debug console logs"
    ["console\.warn"]="Debug console warnings"
    ["console\.error"]="Debug console errors"
    ["debugger"]="Debugger statements"
)

# Counters
VIOLATIONS_CRITICAL=0
VIOLATIONS_WARNING=0
VIOLATIONS_INFO=0
EXEMPTIONS_FOUND=0

# Files to scan
SOURCE_FILES=$(find src public -type f \( -name "*.ts" -o -name "*.js" -o -name "*.html" -o -name "*.json" \) 2>/dev/null || true)

if [[ -z "$SOURCE_FILES" ]]; then
    echo "⚠️ No source files found to scan"
    exit 0
fi

echo "📁 Files to scan: $(echo "$SOURCE_FILES" | wc -l)"
echo ""

# Scan function
scan_patterns() {
    local -n patterns_ref=$1
    local severity=$2
    local description=$3

    echo "🔍 Scanning $description..."

    for pattern in "${!patterns_ref[@]}"; do
        local pattern_desc="${patterns_ref[$pattern]}"
        local matches_found=false

        # Use ripgrep if available, otherwise grep
        if command -v rg >/dev/null 2>&1; then
            MATCHES=$(rg -n "$pattern" $SOURCE_FILES --type-add 'web:*.{ts,js,html,json}' -t web 2>/dev/null || true)
        else
            MATCHES=$(grep -rnE "$pattern" $SOURCE_FILES 2>/dev/null || true)
        fi

        if [[ -n "$MATCHES" ]]; then
            matches_found=true

            # Check for exemptions
            exempted_matches=false
            if echo "$MATCHES" | grep -qE "$EXEMPTION_PATTERN"; then
                exempted_matches=true
                EXEMPTION_COUNT=$(echo "$MATCHES" | grep -cE "$EXEMPTION_PATTERN" || echo "0")
                EXEMPTIONS_FOUND=$((EXEMPTIONS_FOUND + EXEMPTION_COUNT))
            fi

            if [[ "$severity" == "critical" && "$exempted_matches" == "true" ]]; then
                # Filter out exempted matches for critical patterns
                NON_EXEMPTED=$(echo "$MATCHES" | grep -vE "$EXEMPTION_PATTERN" || true)
                if [[ -n "$NON_EXEMPTED" ]]; then
                    echo -e "❌ ${RED}CRITICAL${NC}: $pattern_desc - Pattern: $pattern"
                    echo "$NON_EXEMPTED"
                    ((VIOLATIONS_CRITICAL++))
                else
                    echo -e "✅ ${GREEN}EXEMPTED${NC}: $pattern_desc (all matches have valid exemptions)"
                fi
            else
                case $severity in
                    "critical")
                        echo -e "❌ ${RED}CRITICAL${NC}: $pattern_desc - Pattern: $pattern"
                        echo "$MATCHES"
                        ((VIOLATIONS_CRITICAL++))
                        ;;
                    "warning")
                        echo -e "⚠️  ${YELLOW}WARNING${NC}: $pattern_desc - Pattern: $pattern"
                        echo "$MATCHES"
                        ((VIOLATIONS_WARNING++))
                        ;;
                    "info")
                        echo -e "ℹ️  ${BLUE}INFO${NC}: $pattern_desc - Pattern: $pattern"
                        ((VIOLATIONS_INFO++))
                        ;;
                esac
            fi
        fi

        if [[ "$matches_found" == "false" ]]; then
            echo -e "✅ ${GREEN}CLEAN${NC}: $pattern_desc - no matches found"
        fi
    done
}

# Scan based on mode
case $SCAN_MODE in
    "quick")
        echo "🚀 Quick scan - checking critical patterns only..."
        scan_patterns CRITICAL_PATTERNS "critical" "Critical Patterns"
        ;;
    "full")
        echo "🔬 Full scan - checking all patterns..."
        scan_patterns CRITICAL_PATTERNS "critical" "Critical Patterns"
        echo ""
        scan_patterns WARNING_PATTERNS "warning" "Warning Patterns"
        echo ""
        scan_patterns INFO_PATTERNS "info" "Info Patterns"
        ;;
    "strict")
        echo "🛡️ Strict scan - all patterns with zero tolerance..."
        scan_patterns CRITICAL_PATTERNS "critical" "Critical Patterns"
        echo ""
        scan_patterns WARNING_PATTERNS "critical" "Warning Patterns (treated as critical in strict mode)"
        echo ""
        # Additional strict patterns
        echo "🔍 Scanning Additional Strict Patterns..."
        STRICT_PATTERNS=(
            ["TODO"]="TODO comments (should have ticket references)"
            ["FIXME"]="FIXME comments (should have ticket references)"
            ["HACK"]="HACK comments (should have ticket references)"
            ["XXX"]="XXX comments (should have ticket references)"
        )

        for pattern in "${!STRICT_PATTERNS[@]}"; do
            if command -v rg >/dev/null 2>&1; then
                MATCHES=$(rg -n "$pattern" $SOURCE_FILES --type-add 'web:*.{ts,js,html,json}' -t web 2>/dev/null || true)
            else
                MATCHES=$(grep -rnE "$pattern" $SOURCE_FILES 2>/dev/null || true)
            fi

            if [[ -n "$MATCHES" ]]; then
                # Check if they have ticket references
                NON_REFERENCED=$(echo "$MATCHES" | grep -vE "$EXEMPTION_PATTERN|[A-Z]+-[0-9]+" || true)
                if [[ -n "$NON_REFERENCED" ]]; then
                    echo -e "❌ ${RED}CRITICAL${NC}: TODO/FIXME without ticket reference - Pattern: $pattern"
                    echo "$NON_REFERENCED"
                    ((VIOLATIONS_CRITICAL++))
                else
                    echo -e "✅ ${GREEN}CLEAN${NC}: TODO/FIXME with ticket references"
                fi
            else
                echo -e "✅ ${GREEN}CLEAN${NC}: No TODO/FIXME comments found"
            fi
        done
        ;;
    *)
        echo "❌ Unknown scan mode: $SCAN_MODE"
        echo "Usage: $0 [quick|full|strict]"
        exit 1
        ;;
esac

echo ""
echo "📊 Scan Results Summary"
echo "====================="
echo "Critical Violations: $VIOLATIONS_CRITICAL"
echo "Warning Violations: $VIOLATIONS_WARNING"
echo "Info Violations: $VIOLATIONS_INFO"
echo "Exemptions Found: $EXEMPTIONS_FOUND"
echo "Total Issues: $((VIOLATIONS_CRITICAL + VIOLATIONS_WARNING + VIOLATIONS_INFO))"

# Overall assessment
TOTAL_ISSUES=$((VIOLATIONS_CRITICAL + VIOLATIONS_WARNING + VIOLATIONS_INFO))

if [[ $VIOLATIONS_CRITICAL -gt 0 ]]; then
    echo ""
    echo -e "❌ ${RED}SCAN FAILED${NC} - Critical violations found"
    echo "🚨 Production deployment is BLOCKED until critical violations are resolved"
    echo ""
    echo "To resolve:"
    echo "1. Remove all mock/placeholder content"
    echo "2. Or add proper exemptions with JIRA ticket references:"
    echo "   // MOCK-EXEMPTION: JIRA-123 - Temporary placeholder for X feature"
    exit 1
elif [[ $VIOLATIONS_WARNING -gt 5 ]]; then
    echo ""
    echo -e "⚠️ ${YELLOW}SCAN PASSED WITH WARNINGS${NC} - Multiple warnings found"
    echo "Consider addressing warnings to improve code quality"
    echo ""
    exit 0
elif [[ $TOTAL_ISSUES -eq 0 ]]; then
    echo ""
    echo -e "✅ ${GREEN}SCAN PASSED CLEAN${NC} - No violations found"
    echo "🎉 Code is production-ready!"
    echo ""
    exit 0
else
    echo ""
    echo -e "✅ ${GREEN}SCAN PASSED${NC} - Minor issues found but acceptable"
    echo ""
    exit 0
fi