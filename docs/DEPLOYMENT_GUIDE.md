# 🚀 CCT Deployment Guide

## 📋 Overview

**Enterprise-Grade Market Intelligence System**: Complete deployment guide for the CCT platform featuring dual AI sentiment analysis, RESTful API architecture, multi-level caching, and comprehensive data access modernization.

**Current Version**: Production-Ready System v3.0-Simplified (100% Complete)
**Target Platform**: Cloudflare Workers (Production Grade)
**System Focus**: Fast, streamlined deployment with minimal overhead

## 🎯 Prerequisites

### **🔧 Required Accounts & Services**

#### **Cloudflare Account**
- Cloudflare Workers subscription (Free tier sufficient)
- Custom domain (optional, for professional deployment)
- API token with Workers permissions

#### **External Services**
- **Yahoo Finance API**: Free tier (no API key required)
- **Facebook Messenger** (optional): For notifications
  - Facebook Page
  - Page Access Token
  - Facebook App ID

#### **Development Environment**
- Node.js 18+
- Git
- Cloudflare Wrangler CLI
- Text editor (VS Code recommended)

### **📦 Software Installation**

#### **Install Node.js**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node@18

# Windows
# Download from https://nodejs.org/
```

#### **Install Wrangler CLI**
```bash
# Install globally
npm install -g wrangler

# Verify installation
wrangler --version
```

## ⚙️ Environment Configuration

### **🔑 Environment Variables**

#### **Create `wrangler.toml`**
```toml
name = "tft-trading-system"
main = "src/worker.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Environment Configuration
# Note: API keys should be set as secrets (see Security section)
# Use: wrangler secret put API_KEY
[vars]
TRADING_SYMBOLS = "AAPL,MSFT,GOOGL,TSLA,NVDA"
LOG_LEVEL = "info"
STRUCTURED_LOGGING = "true"

# AI Model Configuration
GPT_MAX_TOKENS = "2000"
GPT_TEMPERATURE = "0.1"
CONFIDENCE_THRESHOLD = "0.7"

# Rate Limiting
YAHOO_FINANCE_RATE_LIMIT = "20"
RATE_LIMIT_WINDOW = "60"

# Cache Configuration
MARKET_DATA_CACHE_TTL = "300"
ANALYSIS_CACHE_TTL = "86400"

# KV Namespaces
[[kv_namespaces]]
binding = "MARKET_ANALYSIS_CACHE"
id = "your_kv_namespace_id"
preview_id = "your_preview_kv_namespace_id"

# R2 Bucket (Optional)
[[r2_buckets]]
binding = "TRADING_MODELS"
bucket_name = "tft-trading-models"

# D1 Database (Optional)
[[d1_databases]]
binding = "TRADING_DB"
database_name = "tft-trading-db"
database_id = "your_d1_database_id"

# Secrets (Configure via CLI)
# [vars]
# FACEBOOK_PAGE_ACCESS_TOKEN = "your_facebook_token"
# FACEBOOK_VERIFY_TOKEN = "your_verify_token"
```

### **🔐 Secure Configuration**

#### **Set Up Secrets**
```bash
# Facebook Integration (Optional)
wrangler secret put FACEBOOK_PAGE_ACCESS_TOKEN
# Enter your Facebook Page Access Token when prompted

wrangler secret put FACEBOOK_VERIFY_TOKEN
# Enter your Facebook Verify Token when prompted

# Additional API Keys (Future Use)
wrangler secret put FMP_API_KEY
# Enter Financial Modeling Prep API Key if needed

wrangler secret put NEWSAPI_KEY
# Enter News API Key if needed
```

#### **Generate Secure API Key**
```bash
# Generate secure API key for your application
openssl rand -hex 32
# Use this value with: wrangler secret put API_KEY
# Or for domain-specific keys:
# wrangler secret put TRADING_API_KEY
# wrangler secret put APP_API_KEY
```

## 🚀 Local Development

### **📦 Project Setup**

#### **Clone and Install**
```bash
# Clone repository
git clone <repository-url>
cd cct

# Install dependencies
npm install

# Configure environment
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml with your configuration
```

#### **Development Server**
```bash
# Start development server
npm run dev

# Test with custom domain
npm run dev:local

# Run tests
npm test

# Build for production
npm run build
```

### **🧪 Local Testing**

#### **Health Checks**
```bash
# Test locally
curl http://localhost:8787/health

# Test with API key
curl -H "X-API-KEY: your_api_key" http://localhost:8787/analyze

# Test model health
curl http://localhost:8787/model-health
```

#### **KV Testing (Local)**
```bash
# Use wrangler dev with KV preview
wrangler dev --local --kv-preview

# Test KV operations
curl -H "X-API-KEY: your_api_key" http://localhost:8787/kv-debug
```

## 🌐 Production Deployment

### **🚀 First-Time Deployment**

#### **Step 1: Authenticate with Cloudflare**
```bash
# Login to Cloudflare
wrangler login

# Verify authentication
wrangler whoami
```

#### **Step 2: Create KV Namespace**
```bash
# Create production KV namespace
wrangler kv:namespace create "MARKET_ANALYSIS_CACHE"

# Create preview KV namespace
wrangler kv:namespace create "MARKET_ANALYSIS_CACHE" --preview

# Update wrangler.toml with the returned IDs
```

#### **Step 3: Configure Domain (Optional)**
```bash
# Add custom domain
wrangler custom-domains add your-domain.com

# List custom domains
wrangler custom-domains list
```

#### **Step 4: Deploy to Production**
```bash
# Full deployment (build + deploy, with confirmation)
npm run deploy

# Skip confirmation (for CI/CD or quick deploys)
npm run deploy -- --yes

# Or deploy without API token (uses browser auth)
env -u CLOUDFLARE_API_TOKEN npx wrangler deploy

# Verify deployment
curl -H "X-API-KEY: your_api_key" https://your-subdomain.your-accounts-domain.workers.dev/health
```

#### **Deployment Options**
```bash
# Standard deployment (build + deploy + confirm)
npm run deploy

# Quick deployment (no build, uses current artifacts)
npm run deploy:quick

# Frontend-only deployment
npm run deploy:frontend

# Frontend-only, skip backend build
npm run deploy:frontend:only

# Wrangler deploy only (no script wrapper)
npm run deploy:only
```

#### **Rollback**
```bash
# Rollback to previous good commit
./scripts/deployment/rollback-production.sh
```

### **🔄 Update Deployment**

#### **Standard Update Process**
```bash
# 1. Commit your changes
git add .
git commit -m "Description of changes"

# 2. Deploy
npm run deploy

# 3. Verify
curl https://tft-trading-system.yanggf.workers.dev/api/v1/health
```

#### **Quick Hotfix (Skip Build)**
```bash
# For emergency fixes when you're sure artifacts are current
npm run deploy:quick
```

#### **Rollback**
```bash
# Rollback to previous commit
./scripts/deployment/rollback-production.sh

# Manual rollback
git log --oneline -5              # Find previous commit
git checkout <commit-hash>        # Checkout
npm run build                     # Build
npm run deploy -- --yes          # Deploy
git checkout -                    # Return to branch
```

## 🔍 Deployment Verification

### **✅ Post-Deployment Checklist**

#### **System Health Verification**
```bash
# 1. Basic Health Check
curl -H "X-API-KEY: your_api_key" https://your-domain.workers.dev/health

# Expected Response:
# {
#   "success": true,
#   "status": "healthy",
#   "version": "2.0-Modular"
# }

# 2. AI Model Health
curl -H "X-API-KEY: your_api_key" https://your-domain.workers.dev/model-health

# 3. KV Storage Test
curl -H "X-API-KEY: your_api_key" https://your-domain.workers.dev/kv-debug

# 4. Analysis Test
timeout 30 curl -H "X-API-KEY: your_api_key" https://your-domain.workers.dev/analyze-symbol?symbol=AAPL
```

#### **Performance Verification**
```bash
# Test single symbol performance (should be <12s)
timeout 20 curl -s -H "X-API-KEY: your_api_key" "https://your-domain.workers.dev/analyze-symbol?symbol=AAPL"

# Test multi-symbol performance (should be <30s)
timeout 45 curl -s -H "X-API-KEY: your_api_key" "https://your-domain.workers.dev/analyze"

# Test 4-tier reporting system
curl -H "X-API-KEY: your_api_key" https://your-domain.workers.dev/pre-market-briefing
curl -H "X-API-KEY: your_api_key" https://your-domain.workers.dev/intraday-check
curl -H "X-API-KEY: your_api_key" https://your-domain.workers.dev/end-of-day-summary
curl -H "X-API-KEY: your_api_key" https://your-domain.workers.dev/weekly-review        # This week
curl -H "X-API-KEY: your_api_key" "https://your-domain.workers.dev/weekly-review?week=last"  # Last week
```

#### **Security Verification**
```bash
# Test API key security
curl -H "X-API-KEY: invalid_key" https://your-domain.workers.dev/health
# Should return 401 Unauthorized

# Test input validation
curl -H "X-API-KEY: your_api_key" "https://your-domain.workers.dev/analyze-symbol?symbol=INVALID"
# Should handle gracefully
```

### **📊 Performance Monitoring**

#### **Real-time Monitoring**
```bash
# Monitor deployment logs
wrangler tail --format=pretty

# Monitor errors only
wrangler tail --format=pretty --search="ERROR|WARN|CRITICAL"

# Monitor performance
wrangler tail --format=pretty --search="performance|timeout|slow"
```

#### **Automated Testing**
```bash
# Automated health check script
#!/bin/bash
# health_check.sh

# X_API_KEY should be set in environment (e.g., in .zshrc)
# export X_API_KEY="your_api_key"
DOMAIN="https://your-domain.workers.dev"

echo "=== Deployment Health Check ==="

# Test system health
echo "1. Testing system health..."
curl -s -H "X-API-KEY: $X_API_KEY" "$DOMAIN/health" | jq '.status'

# Test AI models
echo "2. Testing AI models..."
curl -s -H "X-API-KEY: $X_API_KEY" "$DOMAIN/model-health" | jq '.overall_status'

# Test analysis performance
echo "3. Testing analysis performance..."
start_time=$(date +%s)
timeout 30 curl -s -H "X-API-KEY: $X_API_KEY" "$DOMAIN/analyze-symbol?symbol=AAPL" > /dev/null
end_time=$(date +%s)
duration=$((end_time - start_time))
echo "Analysis completed in ${duration}s"

echo "=== Health Check Complete ==="
```

## 🔧 Advanced Configuration

### **🌍 Multi-Environment Deployment**

#### **Staging Environment**
```bash
# Create staging environment
wrangler kv:namespace create "MARKET_ANALYSIS_CACHE_STAGING"
wrangler kv:namespace create "MARKET_ANALYSIS_CACHE_STAGING" --preview

# Deploy to staging
wrangler deploy --env staging

# Test staging
curl -H "X-API-KEY: staging_key" https://tft-trading-system-staging.your-subdomain.workers.dev/health
```

#### **Production Environment**
```bash
# Deploy to production
wrangler deploy

# Test production
curl -H "X-API-KEY: production_key" https://tft-trading-system.your-subdomain.workers.dev/health
```

### **🔄 CI/CD Pipeline**

#### **GitHub Actions Example**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test

    - name: Build
      run: npm run build

    - name: Deploy to Cloudflare Workers
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### **🔄 GitHub Actions Scheduling System**

#### **Current Architecture**
All prediction scheduling jobs run via GitHub Actions, **NOT** Cloudflare cron:

**Primary Workflow**: `.github/workflows/trading-system.yml`
- **🌅 Pre-Market**: Mon-Fri 8:30 AM ET (12:30 UTC) - Morning predictions
- **🔄 Intraday**: Mon-Fri 12:00 PM ET (16:00 UTC) - Performance validation  
- **🌆 End-of-Day**: Mon-Fri 4:05 PM ET (20:05 UTC) - Market close analysis
- **📊 Weekly**: Sunday 10:00 AM ET (14:00 UTC) - Pattern analysis

#### **Workflow Configuration**
```yaml
# Key secrets required:
# - X_API_KEY: API key for trading system authentication
# - TEAMS_WEBHOOK_URL: Microsoft Teams notification webhook (optional)

# Manual triggers supported:
# - workflow_dispatch: On-demand analysis execution
```

#### **Migration Benefits**
- ✅ **Unlimited Schedules**: No 3-cron restriction (Cloudflare free tier)
- ✅ **100% Free**: Uses 175/2000 monthly GitHub Actions minutes
- ✅ **Enhanced Monitoring**: Full execution logging + Teams notifications
- ✅ **No Timeout**: Unlimited execution time vs 30-second Cloudflare limit
- ✅ **Cost Elimination**: Removed $0.20/month Durable Object requirement

#### **Cloudflare Cron Status: DISABLED**
- **wrangler.toml**: Lines 68-69 commented out (scheduled triggers disabled)
- **Legacy Code**: `scheduler.ts` maintained for reference only
- **All Scheduling**: Managed exclusively through GitHub Actions

#### **Monitoring & Alerts**
- **GitHub Actions Console**: Full execution logs and debugging
- **Teams Notifications**: Success/failure alerts with analysis details
- **Health Checks**: Multi-system monitoring (core + predictive + market intelligence)
- **Performance Tracking**: Execution time and success rate metrics

**Note**: Deployment and scheduling are now decoupled - deploy via Wrangler, schedule via GitHub Actions.

## 🔐 Security Best Practices

### **🛡️ Production Security**

#### **API Key Management**
```bash
# Use environment variables for sensitive data
wrangler secret put SENSITIVE_API_KEY

# Never commit secrets to version control
# Add to .gitignore
echo "wrangler.toml" >> .gitignore
echo ".env" >> .gitignore
echo "*.key" >> .gitignore
```

#### **Access Control**
```bash
# Limit API key permissions
# Use separate keys for different environments

# Regular key rotation (quarterly)
wrangler secret put FACEBOOK_PAGE_ACCESS_TOKEN
# Update with new token

# Monitor for unauthorized access
wrangler tail --format=pretty --search="unauthorized|401"
```

#### **Input Validation**
```bash
# Test input sanitization
curl -H "X-API-KEY: $X_API_KEY" -X POST \
     -H "Content-Type: application/json" \
     -d '{"symbol": "<script>alert(1)</script>"}' \
     https://your-domain.workers.dev/analyze-symbol
# Should sanitize and handle gracefully
```

## 📊 Performance Optimization

### **⚡ Production Performance**

#### **Rate Limiting Configuration**
```toml
# In wrangler.toml
[vars]
YAHOO_FINANCE_RATE_LIMIT = "20"      # Requests per minute
RATE_LIMIT_WINDOW = "60"              # Window in seconds
BATCH_SIZE = "2"                      # Symbols per batch
BATCH_DELAY = "1500"                  # Delay between batches (ms)
```

#### **Cache Optimization**
```toml
[vars]
MARKET_DATA_CACHE_TTL = "300"         # 5 minutes
ANALYSIS_CACHE_TTL = "86400"          # 24 hours
REPORT_CACHE_TTL = "1800"             # 30 minutes
MAX_CACHE_SIZE = "100"                # LRU cache size
```

#### **Memory Management**
```toml
[vars]
CACHE_TTL = "300000"                  # 5 minutes in milliseconds
MAX_CACHE_ENTRIES = "100"             # LRU cache limit
CLEANUP_INTERVAL = "60000"            # Cleanup interval (ms)
```

## 🚨 Troubleshooting

### **🔍 Common Deployment Issues**

#### **Issue 1: KV Namespace Not Found**
```bash
# Error: KV namespace not found
# Solution: Create KV namespace and update wrangler.toml
wrangler kv:namespace create "MARKET_ANALYSIS_CACHE"
wrangler kv:namespace create "MARKET_ANALYSIS_CACHE" --preview
```

#### **Issue 2: API Key Authentication Failure**
```bash
# Error: 401 Unauthorized
# Solution: Verify API key in request headers
curl -H "X-API-KEY: your_actual_api_key" https://your-domain.workers.dev/health
```

#### **Issue 3: Deployment Timeout**
```bash
# Error: Deployment timeout
# Solution: Check file size and optimize
npm run build
# Ensure bundle size is <25MB (Cloudflare limit)
```

#### **Issue 4: Facebook Integration Not Working**
```bash
# Error: Facebook API errors
# Solution: Verify tokens and webhook configuration
wrangler secret put FACEBOOK_PAGE_ACCESS_TOKEN
# Update with valid token from Facebook Developers
```

### **📊 Performance Issues**

#### **Slow Analysis Times**
```bash
# Monitor performance
wrangler tail --format=pretty --search="performance|slow|timeout"

# Check rate limiting
wrangler tail --format=pretty --search="rate_limit|delay"

# Verify cache performance
wrangler tail --format=pretty --search="cache_hit|cache_miss"
```

## 📈 Scaling Considerations

### **🔄 Horizontal Scaling**

#### **Multiple Workers**
```bash
# Deploy multiple instances for load balancing
wrangler deploy
# Cloudflare automatically handles scaling

# Monitor performance across instances
wrangler tail --format=pretty --search="instance|worker"
```

#### **Geographic Distribution**
```bash
# Cloudflare Workers automatically run globally
# Monitor performance by region
wrangler tail --format=pretty --search="region|location"
```

### **💾 Storage Scaling**

#### **KV Storage Limits**
- **Free Tier**: 100,000 reads/day, 1,000 writes/day
- **Paid Tier**: Higher limits available

#### **R2 Storage (Optional)**
```bash
# Configure R2 for large file storage
wrangler r2 bucket create tft-trading-models
# Update wrangler.toml with R2 configuration
```

## 📞 Support & Maintenance

### **🔧 Ongoing Maintenance**

#### **Regular Tasks**
- **Daily**: Monitor system health and performance
- **Weekly**: Review logs and optimize performance
- **Monthly**: Update dependencies and rotate secrets
- **Quarterly**: Security audit and performance review

#### **Monitoring Setup**
```bash
# Set up log monitoring
wrangler tail --format=pretty --search="ERROR|WARN|CRITICAL"

# Create monitoring dashboard
# Use Cloudflare Analytics or external monitoring tools
```

#### **Backup Procedures**
```bash
# KV data backup (automated through versioning)
# Configuration backup
git add wrangler.toml
git commit -m "Configuration backup"
git push
```

---

## 🛠️ Troubleshooting

### **Common Deployment Issues (Resolved 2025-12-10)**

#### **Import Path Errors**
Cloudflare Workers requires `.js` extensions in imports, not `.ts`:
```typescript
// ❌ Wrong
import { something } from './module.ts';

// ✅ Correct
import { something } from './module.js';
```

#### **process.env Not Available**
Workers don't have Node.js `process.env` at module initialization:
```typescript
// ❌ Wrong - fails at module load
const API_KEY = process.env.API_KEY;

// ✅ Correct - access env in request handler
export default {
  async fetch(request, env) {
    const apiKey = env.API_KEY;
  }
}
```

#### **setInterval in Global Scope**
Workers don't support `setInterval` at module level:
```typescript
// ❌ Wrong - causes deployment failure
setInterval(() => cleanup(), 60000);

// ✅ Correct - use alarm() in Durable Objects or scheduled handlers
```

#### **TypeScript Decorators**
Use modern decorator syntax for Workers compatibility:
```typescript
// ❌ Legacy decorators may fail
@decorator
class MyClass {}

// ✅ Ensure tsconfig has correct decorator settings
// Or use function wrappers instead
```

#### **Browser Auth for Deployment**
If API token issues occur, use browser authentication:
```bash
env -u CLOUDFLARE_API_TOKEN wrangler deploy
```

#### **FRED API Graceful Degradation**
Enable fallback when FRED API is unavailable:
```bash
wrangler secret put FRED_ALLOW_DEGRADATION
# Enter: true
```

---

## 🎯 Success Metrics

### **📊 Deployment Success Indicators**

#### **Technical Metrics**
- **Deployment Time**: <5 minutes
- **Health Check**: All services healthy
- **Performance**: Within benchmark targets
- **Error Rate**: <1%

#### **Business Metrics**
- **System Availability**: >99.9%
- **Response Times**: Sub-12s analysis
- **User Satisfaction**: Positive feedback
- **Reliability**: Zero critical incidents

---

**Last Updated: 2026-01-13 | Version: v3.0-Simplified**

*This deployment guide should be followed for all production deployments and updated as the system evolves.*

## 📦 Deployment Scripts Reference

### Scripts Overview
```
scripts/deployment/
├── deploy-production.sh      # Main deployment script (65 lines)
├── deploy-frontend.sh         # Frontend-only deployment (35 lines)
├── quick-deploy.sh            # Quick deploy, no build (33 lines)
├── rollback-production.sh     # Rollback to previous commit (45 lines)
└── warmup-cache-after-deployment.sh  # Cache warming (38 lines)
```

### npm Scripts
| Command | Description |
|---------|-------------|
| `npm run deploy` | Build + deploy (with confirmation) |
| `npm run deploy -- --yes` | Deploy without confirmation |
| `npm run deploy:quick` | Deploy current artifacts (no build) |
| `npm run deploy:frontend` | Build frontend + backend + deploy |
| `npm run deploy:frontend:only` | Build frontend only + deploy |
| `npm run deploy:only` | Wrangler deploy (no build) |
