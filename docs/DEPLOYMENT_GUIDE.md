# 🚀 CCT Deployment Guide

## 📋 Overview

**Enterprise-Grade Market Intelligence System**: Complete deployment guide for the CCT platform featuring dual AI sentiment analysis, RESTful API architecture, multi-level caching, and comprehensive data access modernization.

**Current Version**: Data Access Improvement Plan Phase 3 Complete (60%)
**Target Platform**: Cloudflare Workers (Production Grade)
**System Focus**: Data Access Modernization with DAC patterns

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
[vars]
WORKER_API_KEY = "your_secure_api_key_here"
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
binding = "TRADING_RESULTS"
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
# Use this as your WORKER_API_KEY value
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
wrangler kv:namespace create "TRADING_RESULTS"

# Create preview KV namespace
wrangler kv:namespace create "TRADING_RESULTS" --preview

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
# Deploy without API token (uses browser auth)
env -u CLOUDFLARE_API_TOKEN npx wrangler deploy

# Verify deployment
curl -H "X-API-KEY: your_api_key" https://your-subdomain.your-accounts-domain.workers.dev/health
```

### **🔄 Update Deployment**

#### **Standard Update Process**
```bash
# 1. Test changes locally
npm run build
npm test

# 2. Deploy to production
env -u CLOUDFLARE_API_TOKEN npx wrangler deploy

# 3. Verify deployment
curl -H "X-API-KEY: your_api_key" https://your-domain.workers.dev/health

# 4. Monitor for issues
wrangler tail --format=pretty --since=5m
```

#### **Rollback if Needed**
```bash
# View recent commits
git log --oneline -5

# Checkout previous version
git checkout <previous-commit-hash>

# Redeploy
env -u CLOUDFLARE_API_TOKEN npx wrangler deploy

# Verify rollback
curl -H "X-API-KEY: your_api_key" https://your-domain.workers.dev/health
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
curl -H "X-API-KEY: your_api_key" https://your-domain.workers.dev/weekly-review
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

API_KEY="your_api_key"
DOMAIN="https://your-domain.workers.dev"

echo "=== Deployment Health Check ==="

# Test system health
echo "1. Testing system health..."
curl -s -H "X-API-KEY: $API_KEY" "$DOMAIN/health" | jq '.status'

# Test AI models
echo "2. Testing AI models..."
curl -s -H "X-API-KEY: $API_KEY" "$DOMAIN/model-health" | jq '.overall_status'

# Test analysis performance
echo "3. Testing analysis performance..."
start_time=$(date +%s)
timeout 30 curl -s -H "X-API-KEY: $API_KEY" "$DOMAIN/analyze-symbol?symbol=AAPL" > /dev/null
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
wrangler kv:namespace create "TRADING_RESULTS_STAGING"
wrangler kv:namespace create "TRADING_RESULTS_STAGING" --preview

# Deploy to staging
wrangler deploy --env staging

# Test staging
curl -H "X-API-KEY: staging_key" https://tft-trading-system-staging.your-subdomain.workers.dev/health
```

#### **Production Environment**
```bash
# Deploy to production
wrangler deploy --env production

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
curl -H "X-API-KEY: your_key" -X POST \
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
wrangler kv:namespace create "TRADING_RESULTS"
wrangler kv:namespace create "TRADING_RESULTS" --preview
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
wrangler deploy --env production
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

**Last Updated: 2025-10-01 | Version: e650aa19-c631-474e-8da8-b3144d373ae5**

*This deployment guide should be followed for all production deployments and updated as the system evolves.*