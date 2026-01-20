#!/bin/bash

# Weekly Review Pipeline & Parameter Regression Test
# Verifies the full lifecycle: Trigger -> D1 Write -> Parameterized UI Read

set -euo pipefail

# Configuration
API_URL="${API_URL:-https://tft-trading-system.yanggf.workers.dev}"
API_KEY="${X_API_KEY:-}"

if [[ -z "$API_KEY" ]]; then
  echo "Error: X_API_KEY environment variable is not set"
  exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 1. Trigger Weekly Job
log "Triggering manual weekly_review_analysis job..."
TRIGGER_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/jobs/trigger" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"triggerMode": "weekly_review_analysis"}')

if echo "$TRIGGER_RESPONSE" | grep -q "success":true; then
  log "Job triggered successfully"
else
  error "Failed to trigger job: $TRIGGER_RESPONSE"
fi

# 2. Verify Structured D1 Snapshot via API
log "Verifying latest weekly snapshot..."
# Wait a moment for D1 eventual consistency/processing if needed
sleep 2

LATEST_RESPONSE=$(curl -s "$API_URL/api/v1/jobs/latest?type=weekly")
EXECUTION_DATE=$(echo "$LATEST_RESPONSE" | jq -r '.data.executionDate // .executionDate')

if [[ "$EXECUTION_DATE" == "null" ]]; then
  error "Could not find latest weekly execution date"
fi

log "Latest weekly execution date: $EXECUTION_DATE"

# 3. Test Parameter: ?week=last
log "Testing parameter: ?week=last"
WEEK_LAST_HTML=$(curl -s -L "$API_URL/weekly-review?week=last")

if echo "$WEEK_LAST_HTML" | grep -q "Weekly Trading Review"; then
  log "UI verified for ?week=last"
else
  error "UI check failed for ?week=last (HTML missing title)"
fi

# Verify Dual Model Stats in HTML
if echo "$WEEK_LAST_HTML" | grep -q "AI Model Performance" && echo "$WEEK_LAST_HTML" | grep -q "Gemma Sea Lion"; then
  log "Dual model statistics found in HTML"
else
  warn "Dual model statistics section NOT found in HTML - check if job data includes modelStats"
fi

# 4. Test Parameter: Specific Date
# Calculate a recent Sunday (simplified shell logic)
log "Testing parameter: ?week=$EXECUTION_DATE"
SPECIFIC_DATE_HTML=$(curl -s -L "$API_URL/weekly-review?week=$EXECUTION_DATE")

if echo "$SPECIFIC_DATE_HTML" | grep -q "Weekly Trading Review"; then
  log "UI verified for specific week date"
else
  error "UI check failed for ?week=$EXECUTION_DATE"
fi

# 5. D1 Alignment Check (if jq is available and we can peek into the JSON) 
log "Validating D1 data alignment..."
HAS_MODEL_STATS=$(echo "$LATEST_RESPONSE" | jq '.data.data.modelStats != null')

if [[ "$HAS_MODEL_STATS" == "true" ]]; then
  log "D1 snapshot includes structured model performance data"
else
  warn "D1 snapshot missing modelStats - check weekly-review-analysis.ts logic"
fi

log "Regression tests completed successfully!"
