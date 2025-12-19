#!/bin/bash

# CI Schema Enforcement for Test Summary Validation
# Validates test-summary.json against test-summary-schema.json to prevent drift

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCHEMA_FILE="${1:-test-summary-schema.json}"
SUMMARY_FILE="${2:-test-summary.json}"
VALIDATION_MODE="${3:-strict}"  # strict, warn, silent

echo -e "${BLUE}🔍 Test Summary Schema Validation${NC}"
echo "==================================="
echo "Schema File: $SCHEMA_FILE"
echo "Summary File: $SUMMARY_FILE"
echo "Validation Mode: $VALIDATION_MODE"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Validation results tracking
VALIDATION_PASSED=0
VALIDATION_FAILED=0
VALIDATION_WARNINGS=0

log_validation() {
    local test_name="$1"
    local status="$2"
    local message="${3:-}"

    if [[ "$status" == "PASS" ]]; then
        echo -e "✅ ${GREEN}PASS${NC}: $test_name"
        ((VALIDATION_PASSED++))
    elif [[ "$status" == "WARN" ]]; then
        echo -e "⚠️  ${YELLOW}WARN${NC}: $test_name"
        if [[ -n "$message" ]]; then
            echo "   $message"
        fi
        ((VALIDATION_WARNINGS++))
    else
        echo -e "❌ ${RED}FAIL${NC}: $test_name"
        if [[ -n "$message" ]]; then
            echo "   $message"
        fi
        ((VALIDATION_FAILED++))
    fi
}

# Phase 1: File Existence and Accessibility
echo -e "${BLUE}Phase 1: File Accessibility${NC}"
echo "============================="

# Check schema file exists
if [[ -f "$SCHEMA_FILE" ]]; then
    log_validation "Schema file exists" "PASS" "Found $SCHEMA_FILE"
else
    log_validation "Schema file exists" "FAIL" "Missing schema file: $SCHEMA_FILE"
    echo "Error: Schema file is required for validation"
    exit 1
fi

# Check summary file exists
if [[ -f "$SUMMARY_FILE" ]]; then
    log_validation "Summary file exists" "PASS" "Found $SUMMARY_FILE"
else
    log_validation "Summary file exists" "FAIL" "Missing summary file: $SUMMARY_FILE"
    echo "Error: Summary file is required for validation"
    exit 1
fi

# Check files are readable
if [[ -r "$SCHEMA_FILE" ]]; then
    log_validation "Schema file readable" "PASS"
else
    log_validation "Schema file readable" "FAIL" "Cannot read schema file"
    exit 1
fi

if [[ -r "$SUMMARY_FILE" ]]; then
    log_validation "Summary file readable" "PASS"
else
    log_validation "Summary file readable" "FAIL" "Cannot read summary file"
    exit 1
fi

echo ""

# Phase 2: JSON Syntax Validation
echo -e "${BLUE}Phase 2: JSON Syntax Validation${NC}"
echo "=================================="

# Validate JSON syntax for schema file
if jq empty "$SCHEMA_FILE" 2>/dev/null; then
    log_validation "Schema JSON syntax" "PASS"
else
    log_validation "Schema JSON syntax" "FAIL" "Invalid JSON in schema file"
    exit 1
fi

# Validate JSON syntax for summary file
if jq empty "$SUMMARY_FILE" 2>/dev/null; then
    log_validation "Summary JSON syntax" "PASS"
else
    log_validation "Summary JSON syntax" "FAIL" "Invalid JSON in summary file"
    exit 1
fi

echo ""

# Phase 3: Schema Structure Validation
echo -e "${BLUE}Phase 3: Schema Structure Validation${NC}"
echo "======================================"

# Check if schema file has proper structure
SCHEMA_HAS_DRAFT=$(jq -e 'has("$schema")' "$SCHEMA_FILE" 2>/dev/null || echo "false")
SCHEMA_HAS_TITLE=$(jq -e 'has("title")' "$SCHEMA_FILE" 2>/dev/null || echo "false")
SCHEMA_HAS_TYPE=$(jq -e 'has("type")' "$SCHEMA_FILE" 2>/dev/null || echo "false")
SCHEMA_HAS_PROPS=$(jq -e 'has("properties")' "$SCHEMA_FILE" 2>/dev/null || echo "false")

if [[ "$SCHEMA_HAS_DRAFT" == "true" ]]; then
    log_validation "Schema has $schema field" "PASS"
else
    log_validation "Schema has $schema field" "WARN" "Missing \$schema specification"
fi

if [[ "$SCHEMA_HAS_TITLE" == "true" ]]; then
    log_validation "Schema has title field" "PASS"
else
    log_validation "Schema has title field" "WARN" "Missing title specification"
fi

if [[ "$SCHEMA_HAS_TYPE" == "true" ]]; then
    log_validation "Schema has type field" "PASS"
else
    log_validation "Schema has type field" "FAIL" "Missing type specification"
    exit 1
fi

if [[ "$SCHEMA_HAS_PROPS" == "true" ]]; then
    log_validation "Schema has properties field" "PASS"
else
    log_validation "Schema has properties field" "FAIL" "Missing properties specification"
    exit 1
fi

echo ""

# Phase 4: Required Fields Validation
echo -e "${BLUE}Phase 4: Required Fields Validation${NC}"
echo "========================================"

# Check schema required fields
SCHEMA_REQUIRED=$(jq -r '.required // [] | join(",")' "$SCHEMA_FILE" 2>/dev/null)
if [[ -n "$SCHEMA_REQUIRED" && "$SCHEMA_REQUIRED" != "," ]]; then
    log_validation "Schema defines required fields" "PASS" "Required: $SCHEMA_REQUIRED"
else
    log_validation "Schema defines required fields" "WARN" "No required fields defined"
fi

# Check if summary file has required top-level fields
SUMMARY_HAS_METADATA=$(jq -e 'has("test_metadata")' "$SUMMARY_FILE" 2>/dev/null || echo "false")
SUMMARY_HAS_RESULTS=$(jq -e 'has("test_results")' "$SUMMARY_FILE" 2>/dev/null || echo "false")

if [[ "$SUMMARY_HAS_METADATA" == "true" ]]; then
    log_validation "Summary has test_metadata" "PASS"
else
    log_validation "Summary has test_metadata" "FAIL" "Missing required test_metadata section"
    if [[ "$VALIDATION_MODE" == "strict" ]]; then
        exit 1
    fi
fi

if [[ "$SUMMARY_HAS_RESULTS" == "true" ]]; then
    log_validation "Summary has test_results" "PASS"
else
    log_validation "Summary has test_results" "FAIL" "Missing required test_results section"
    if [[ "$VALIDATION_MODE" == "strict" ]]; then
        exit 1
    fi
fi

echo ""

# Phase 5: Data Type Validation
echo -e "${BLUE}Phase 5: Data Type Validation${NC}"
echo "================================="

# Validate test_metadata structure and types
if [[ "$SUMMARY_HAS_METADATA" == "true" ]]; then
    METADATA_TYPE=$(jq -r '.test_metadata.type // "unknown"' "$SUMMARY_FILE" 2>/dev/null)
    if [[ "$METADATA_TYPE" == "object" ]]; then
        log_validation "test_metadata type is object" "PASS"
    else
        log_validation "test_metadata type is object" "FAIL" "Expected object, got $METADATA_TYPE"
    fi

    # Check required metadata fields
    METADATA_FIELDS=("test_name" "execution_id" "timestamp" "duration_seconds")
    for field in "${METADATA_FIELDS[@]}"; do
        FIELD_EXISTS=$(jq -e ".test_metadata.has(\"$field\")" "$SUMMARY_FILE" 2>/dev/null || echo "false")
        if [[ "$FIELD_EXISTS" == "true" ]]; then
            log_validation "Metadata has $field" "PASS"
        else
            log_validation "Metadata has $field" "WARN" "Missing recommended field: $field"
        fi
    done
fi

# Validate test_results structure and types
if [[ "$SUMMARY_HAS_RESULTS" == "true" ]]; then
    RESULTS_TYPE=$(jq -r '.test_results.type // "unknown"' "$SUMMARY_FILE" 2>/dev/null)
    if [[ "$RESULTS_TYPE" == "object" ]]; then
        log_validation "test_results type is object" "PASS"
    else
        log_validation "test_results type is object" "FAIL" "Expected object, got $RESULTS_TYPE"
    fi

    # Check numeric fields in test_results
    NUMERIC_FIELDS=("total_tests" "tests_passed" "tests_failed" "success_rate")
    for field in "${NUMERIC_FIELDS[@]}"; do
        FIELD_TYPE=$(jq -r ".test_results.$field | type" "$SUMMARY_FILE" 2>/dev/null || echo "null")
        if [[ "$FIELD_TYPE" == "number" ]]; then
            log_validation "test_results.$field is numeric" "PASS"
        else
            log_validation "test_results.$field is numeric" "WARN" "Expected number, got $FIELD_TYPE"
        fi
    done

    # Validate overall_status enum
    STATUS_VALUE=$(jq -r '.test_results.overall_status // ""' "$SUMMARY_FILE" 2>/dev/null)
    VALID_STATUSES=("PASS" "FAIL" "WARN" "ERROR" "TIMEOUT")
    if [[ " ${VALID_STATUSES[*]} " =~ " $STATUS_VALUE " ]]; then
        log_validation "overall_status is valid" "PASS" "Status: $STATUS_VALUE"
    else
        log_validation "overall_status is valid" "WARN" "Invalid status: $STATUS_VALUE"
    fi
fi

echo ""

# Phase 6: Business Logic Validation
echo -e "${BLUE}Phase 6: Business Logic Validation${NC}"
echo "======================================"

# Validate test count consistency
if [[ "$SUMMARY_HAS_RESULTS" == "true" ]]; then
    TOTAL_TESTS=$(jq -r '.test_results.total_tests // 0' "$SUMMARY_FILE" 2>/dev/null)
    TESTS_PASSED=$(jq -r '.test_results.tests_passed // 0' "$SUMMARY_FILE" 2>/dev/null)
    TESTS_FAILED=$(jq -r '.test_results.tests_failed // 0' "$SUMMARY_FILE" 2>/dev/null)
    TESTS_SKIPPED=$(jq -r '.test_results.tests_skipped // 0' "$SUMMARY_FILE" 2>/dev/null)

    # Calculate expected total
    EXPECTED_TOTAL=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))

    if [[ "$TOTAL_TESTS" -eq "$EXPECTED_TOTAL" ]]; then
        log_validation "Test count consistency" "PASS" "$TESTS_PASSED + $TESTS_FAILED + $TESTS_SKIPPED = $TOTAL_TESTS"
    else
        log_validation "Test count consistency" "WARN" "Count mismatch: expected $EXPECTED_TOTAL, got $TOTAL_TESTS"
    fi

    # Validate success rate calculation
    if [[ "$TOTAL_TESTS" -gt 0 ]]; then
        CALCULATED_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))
        REPORTED_RATE=$(jq -r '.test_results.success_rate // 0' "$SUMMARY_FILE" 2>/dev/null)

        if [[ "$REPORTED_RATE" -eq "$CALCULATED_RATE" ]]; then
            log_validation "Success rate accuracy" "PASS" "Calculated: ${CALCULATED_RATE}%, Reported: ${REPORTED_RATE}%"
        else
            log_validation "Success rate accuracy" "WARN" "Rate mismatch: calculated ${CALCULATED_RATE}%, reported ${REPORTED_RATE}%"
        fi
    else
        log_validation "Success rate calculation" "WARN" "Zero total tests, cannot validate success rate"
    fi
fi

echo ""

# Phase 7: Advanced Validation (Schema Compliance)
echo -e "${BLUE}Phase 7: Advanced Schema Validation${NC}"
echo "======================================"

# Try to validate against schema using jq (limited validation)
echo "Performing advanced schema validation..."

# Check if all required fields from schema are present in summary
SCHEMA_REQUIRED_FIELDS=$(jq -r '.required // []' "$SCHEMA_FILE" 2>/dev/null)
if [[ "$SCHEMA_REQUIRED_FIELDS" != "[]" && "$SCHEMA_REQUIRED_FIELDS" != "," ]]; then
    echo "$SCHEMA_REQUIRED_FIELDS" | jq -r '.[]' 2>/dev/null | while read -r required_field; do
        if [[ -n "$required_field" ]]; then
            FIELD_PRESENT=$(jq -e "has(\"$required_field\")" "$SUMMARY_FILE" 2>/dev/null || echo "false")
            if [[ "$FIELD_PRESENT" == "true" ]]; then
                log_validation "Required field $required_field present" "PASS"
            else
                log_validation "Required field $required_field present" "FAIL" "Missing required field from schema"
                if [[ "$VALIDATION_MODE" == "strict" ]]; then
                    exit 1
                fi
            fi
        fi
    done
fi

# Validate data types against schema properties
SCHEMA_PROPERTIES=$(jq -r '.properties // {}' "$SCHEMA_FILE" 2>/dev/null)
if [[ "$SCHEMA_PROPERTIES" != "{}" && "$SCHEMA_PROPERTIES" != "null" ]]; then
    echo "$SCHEMA_PROPERTIES" | jq -r 'keys[]' 2>/dev/null | while read -r prop_name; do
        if [[ -n "$prop_name" ]]; then
            EXPECTED_TYPE=$(jq -r ".properties.$prop_name.type // \"unknown\"" "$SCHEMA_FILE" 2>/dev/null)
            ACTUAL_TYPE=$(jq -r ".$prop_name.type // \"unknown\"" "$SUMMARY_FILE" 2>/dev/null)

            if [[ "$EXPECTED_TYPE" == "$ACTUAL_TYPE" ]]; then
                log_validation "Property $prop_name type match" "PASS" "$EXPECTED_TYPE"
            elif [[ "$ACTUAL_TYPE" == "unknown" ]]; then
                log_validation "Property $prop_name type match" "WARN" "Property missing in summary"
            else
                log_validation "Property $prop_name type match" "WARN" "Expected $EXPECTED_TYPE, got $ACTUAL_TYPE"
            fi
        fi
    done
fi

echo ""

# Phase 8: Validation Results Summary
echo -e "${BLUE}Phase 8: Validation Results${NC}"
echo "============================="

TOTAL_VALIDATIONS=$((VALIDATION_PASSED + VALIDATION_FAILED + VALIDATION_WARNINGS))
SUCCESS_RATE=$((VALIDATION_PASSED * 100 / TOTAL_VALIDATIONS))

echo "📊 Validation Summary:"
echo "  Total Checks: $TOTAL_VALIDATIONS"
echo "  Passed: $VALIDATION_PASSED"
echo "  Failed: $VALIDATION_FAILED"
echo "  Warnings: $VALIDATION_WARNINGS"
echo "  Success Rate: ${SUCCESS_RATE}%"
echo ""

# Overall assessment
if [[ "$VALIDATION_FAILED" -eq 0 ]]; then
    if [[ "$VALIDATION_WARNINGS" -eq 0 ]]; then
        echo -e "🎉 ${GREEN}SCHEMA VALIDATION PASSED${NC}"
        echo "✅ All schema requirements satisfied"
        echo "✅ No warnings or errors detected"
        echo "✅ Test summary is fully compliant"
        echo ""
        echo "Validation completed successfully!"
        exit 0
    else
        echo -e "⚠️  ${YELLOW}VALIDATION PASSED WITH WARNINGS${NC}"
        echo "✅ All required validations passed"
        echo "⚠️  $VALIDATION_WARNINGS warning(s) detected"
        echo ""
        echo "Review warnings before proceeding."
        exit 0
    fi
elif [[ "$VALIDATION_MODE" == "strict" ]]; then
    echo -e "❌ ${RED}SCHEMA VALIDATION FAILED${NC}"
    echo "❌ $VALIDATION_FAILED validation(s) failed"
    echo "❌ Strict mode - blocking continuation"
    echo ""
    echo "Fix schema violations before proceeding."
    exit 1
else
    echo -e "⚠️  ${YELLOW}VALIDATION FAILED${NC}"
    echo "❌ $VALIDATION_FAILED validation(s) failed"
    echo "⚠️  Non-strict mode - allowing continuation"
    echo ""
    echo "Recommend fixing schema violations."
    exit 0
fi