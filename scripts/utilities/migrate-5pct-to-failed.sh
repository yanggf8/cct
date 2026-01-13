#!/bin/bash
# Migrate 5% confidence values to failed status in D1
# This updates existing records where confidence = 0.05 (fake fallback) to mark as failed

set -e

echo "🔄 Migrating 5% confidence records to failed status..."

# Get all records with report_content containing confidence values around 0.05
# We'll use the Cloudflare API to run the migration

cat << 'EOF'
-- Run this SQL manually via wrangler d1 execute:
-- npx wrangler d1 execute cct-predict-jobs --remote --command "SQL_HERE"

-- Note: D1 doesn't support JSON functions well, so we need to do this via API
-- The migration will be done via a one-time API endpoint

To migrate:
1. Deploy the updated code first
2. Call: POST /api/v1/data/migrate-5pct-to-failed
   with X-API-KEY header

This will:
- Find all signals with confidence between 0.04 and 0.06 (5% range)
- Update them to: confidence: null, status: "failed", failure_reason: "legacy_fallback_data"
EOF

echo ""
echo "Alternative: Run the migration endpoint after deploy"
echo "curl -X POST -H 'X-API-KEY: \$X_API_KEY' https://tft-trading-system.yanggf.workers.dev/api/v1/data/migrate-5pct-to-failed"
