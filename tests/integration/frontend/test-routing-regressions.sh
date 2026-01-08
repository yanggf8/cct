#!/bin/bash

# Frontend Routing Regression Guard
# Ensures HTML pages and static assets keep working after router changes

set -euo pipefail

BASE_URL="${CCT_URL:-https://tft-trading-system.yanggf.workers.dev}"
API_KEY="${X_API_KEY:-}"
TIMEOUT="${TIMEOUT:-20}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL=0
PASSED=0

print_header() {
  echo -e "\n${BLUE}$1${NC}"
  echo "----------------------------------------"
}

record_result() {
  local ok=$1
  local label=$2
  TOTAL=$((TOTAL + 1))
  if [ "$ok" = "true" ]; then
    PASSED=$((PASSED + 1))
    echo -e "${GREEN}✅ $label${NC}"
  else
    echo -e "${RED}❌ $label${NC}"
  fi
}

fetch() {
  local url="$1"
  timeout "$TIMEOUT" curl -s -L -w "\nHTTP_CODE:%{http_code}" "$url" || true
}

check_html() {
  local path="$1"
  local label="$2"
  local response
  response=$(fetch "$BASE_URL$path")
  local status
  status=$(echo "$response" | tail -1 | cut -d: -f2)
  local body
  body=$(echo "$response" | sed '$d')

  if [ "$status" = "200" ] && echo "$body" | grep -q "<!DOCTYPE html>"; then
    record_result "true" "$label"
  else
    echo "  Expected: 200 HTML, Got: $status"
    record_result "false" "$label"
  fi
}

check_static() {
  local path="$1"
  local label="$2"
  local response
  response=$(fetch "$BASE_URL$path")
  local status
  status=$(echo "$response" | tail -1 | cut -d: -f2)

  if [ "$status" = "200" ]; then
    record_result "true" "$label"
  else
    echo "  Expected: 200, Got: $status"
    record_result "false" "$label"
  fi
}

check_api_health() {
  local response
  if [ -n "$API_KEY" ]; then
    response=$(timeout "$TIMEOUT" curl -s -w "\nHTTP_CODE:%{http_code}" -H "X-API-Key: $API_KEY" "$BASE_URL/api/v1/data/health" || true)
  else
    response=$(timeout "$TIMEOUT" curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/api/v1/data/health" || true)
  fi
  local status
  status=$(echo "$response" | tail -1 | cut -d: -f2)
  local body
  body=$(echo "$response" | sed '$d')

  if [ "$status" = "200" ] && echo "$body" | jq -e '.success == true' >/dev/null 2>&1; then
    record_result "true" "API health reachable (guards auth/public changes)"
  else
    echo "  Health response: $body"
    record_result "false" "API health reachable (guards auth/public changes)"
  fi
}

echo -e "${YELLOW}🛡️  Frontend Routing Regression Guard${NC}"
echo "Base URL: $BASE_URL"
if [ -n "$API_KEY" ]; then
  echo "Using provided X_API_KEY for protected calls"
else
  echo "No X_API_KEY set; running public-only checks for API health"
fi

print_header "HTML entry points"
check_html "/" "Root dashboard still served"
check_html "/dashboard.html" "Dashboard HTML available"
check_html "/predictive-analytics.html" "Predictive analytics page served"

print_header "Static assets"
check_static "/js/nav.js" "Left nav script served"
check_static "/js/cct-api.js" "API client bundle served"
check_static "/css/nav.css" "Nav stylesheet served"

print_header "API guardrails"
check_api_health

echo -e "\n${BLUE}Summary${NC}"
echo "Passed: $PASSED / $TOTAL"

if [ "$PASSED" -ne "$TOTAL" ]; then
  echo -e "${RED}Routing regression detected. See failures above.${NC}"
  exit 1
else
  echo -e "${GREEN}All routing checks passed.${NC}"
fi
