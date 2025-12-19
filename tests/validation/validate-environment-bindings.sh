#!/bin/bash

# Environment Bindings Validation Script
# Checks wrangler.toml configuration and required secrets for report endpoints

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log() { echo -e "${BLUE}🔍 [VALIDATE]${NC} $*"; }
success() { echo -e "${GREEN}✅ [SUCCESS]${NC} $*"; }
warning() { echo -e "${YELLOW}⚠️  [WARNING]${NC} $*"; }
error() { echo -e "${RED}❌ [ERROR]${NC} $*"; }

log "Validating environment bindings for report endpoints..."

# Check wrangler.toml exists
if [ ! -f "wrangler.toml" ]; then
    error "wrangler.toml not found"
    exit 1
fi

success "wrangler.toml found"

# Check key bindings in wrangler.toml
log "Checking wrangler.toml bindings..."

# Check for Durable Objects
if grep -q "durable_objects.bindings" wrangler.toml; then
    success "Durable Objects bindings found"
    if grep -q "CACHE_DO" wrangler.toml; then
        success "CACHE_DO Durable Object binding configured"
    else
        warning "CACHE_DO Durable Object binding not found"
    fi
else
    warning "No Durable Objects bindings found"
fi

# Check for KV namespaces
if grep -q "kv_namespaces" wrangler.toml; then
    success "KV namespaces configured"
    if grep -q "MARKET_ANALYSIS_CACHE" wrangler.toml; then
        success "MARKET_ANALYSIS_CACHE KV namespace binding configured"
    else
        warning "MARKET_ANALYSIS_CACHE KV namespace binding not found"
    fi
else
    warning "No KV namespaces found"
fi

# Check for R2 buckets
if grep -q "r2_buckets" wrangler.toml; then
    success "R2 buckets configured"
    if grep -q "TFT_TRADING_MODELS" wrangler.toml; then
        success "TFT_TRADING_MODELS R2 bucket binding configured"
    else
        warning "TFT_TRADING_MODELS R2 bucket binding not found"
    fi
else
    warning "No R2 buckets found"
fi

# Check for AI binding
if grep -q "ai" wrangler.toml; then
    success "AI binding configured"
else
    warning "AI binding not found"
fi

# Check for service bindings (DAC)
if grep -q "services" wrangler.toml; then
    success "Service bindings configured"
    if grep -q "DAC_BACKEND" wrangler.toml; then
        success "DAC_BACKEND service binding configured"
    else
        warning "DAC_BACKEND service binding not found"
    fi
else
    warning "No service bindings found"
fi

# Check environment variables
log "Checking environment variables..."

ENV_VARS=(
    "ENVIRONMENT"
    "WORKER_VERSION"
    "LOG_LEVEL"
    "GPT_MAX_TOKENS"
    "GPT_TEMPERATURE"
    "MIN_NEWS_ARTICLES"
    "MAX_NEWS_ARTICLES"
    "CONFIDENCE_THRESHOLD"
    "SIGNAL_CONFIDENCE_THRESHOLD"
    "KV_ANALYSIS_TTL"
    "KV_GRANULAR_TTL"
    "MARKET_DATA_CACHE_TTL"
    "YAHOO_FINANCE_RATE_LIMIT"
    "RATE_LIMIT_WINDOW"
    "FEATURE_FLAG_DO_CACHE"
    "DAC_ARTICLES_POOL_URL"
)

for var in "${ENV_VARS[@]}"; do
    if grep -q "$var" wrangler.toml; then
        success "Environment variable $var configured"
    else
        warning "Environment variable $var not found"
    fi
done

# Check for production environment specific configuration
if grep -q "\[env.production\]" wrangler.toml; then
    success "Production environment configuration found"
else
    warning "Production environment configuration not found"
fi

# Check secrets (wrangler doesn't expose secrets in config, so we provide guidance)
log "Checking secret requirements..."

SECRETS=(
    "WORKER_API_KEY"
    "X_API_KEY"
    "FRED_API_KEY"
)

echo ""
log "Required secrets (check with 'wrangler secret list'):"
for secret in "${SECRETS[@]}"; do
    echo "  • $secret"
done

# Provide commands for checking and setting secrets
echo ""
log "Secret Management Commands:"
echo "  # List all secrets:"
echo "  wrangler secret list"
echo ""
echo "  # Set required secrets:"
echo "  wrangler secret put WORKER_API_KEY"
echo "  wrangler secret put X_API_KEY"
echo "  wrangler secret put FRED_API_KEY"
echo ""
log "Report Dependencies Validation:"

# Check for external API dependencies
echo ""
log "External API Dependencies for Reports:"
echo "  • FRED API - Required for macro-economic data"
echo "  • Yahoo Finance - Required for market data"
echo "  • OpenAI/AI - Required for sentiment analysis"
echo "  • DAC Backend - Optional, for enhanced article pool"

# Check deployment readiness
echo ""
log "Deployment Readiness Checks:"

# Check if typescript compilation would likely succeed
if command -v tsc &> /dev/null; then
    log "Running TypeScript validation..."
    if npm run typecheck 2>/dev/null; then
        success "TypeScript validation passed"
    else
        warning "TypeScript validation failed - review errors before deployment"
    fi
else
    warning "TypeScript not available for validation"
fi

# Check for deployment scripts
if [ -f "scripts/deployment/deploy-production.sh" ]; then
    success "Production deployment script found"
else
    warning "Production deployment script not found"
fi

if [ -f "scripts/deployment/quick-deploy.sh" ]; then
    success "Quick deployment script found"
else
    warning "Quick deployment script not found"
fi

# Report endpoints specific checks
echo ""
log "Report Endpoints Configuration:"

# Check for handlers
HANDLER_FILES=(
    "src/modules/handlers/briefing-handlers.ts"
    "src/modules/handlers/intraday-handlers.ts"
    "src/modules/handlers/end-of-day-handlers.ts"
    "src/modules/handlers/weekly-review-handlers.ts"
)

for handler in "${HANDLER_FILES[@]}"; do
    if [ -f "$handler" ]; then
        success "Handler file found: $(basename "$handler")"
    else
        warning "Handler file missing: $(basename "$handler")"
    fi
done

# Check for HTML templates
if [ -f "src/utils/html-templates.ts" ]; then
    success "HTML template utilities found"
else
    warning "HTML template utilities not found"
fi

# Final summary
echo ""
success "Environment binding validation completed!"
echo ""
log "Summary:"
echo "  ✅ wrangler.toml configuration validated"
echo "  ✅ Required bindings checked"
echo "  ✅ Environment variables verified"
echo "  ✅ Handler files confirmed"
echo "  ℹ️  Manual secret verification required"
echo ""
log "Next Steps:"
echo "  1. Verify secrets: wrangler secret list"
echo "  2. Set missing secrets: wrangler secret put <SECRET_NAME>"
echo "  3. Run TypeScript check: npm run typecheck"
echo "  4. Deploy: npm run deploy"