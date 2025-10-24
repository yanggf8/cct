# 🚀 Deployment & Setup Guide

## Overview

This guide provides comprehensive instructions for deploying and configuring the Enterprise AI Trading Intelligence System in production environments.

## Table of Contents

1. [Prerequisites](#prerequisites) - System requirements
2. [Environment Setup](#environment-setup) - Required variables and API keys
3. [Installation](#installation) - Deployment steps
4. [Configuration](#configuration) - System configuration
5. [Security Setup](#security-setup) - API key authentication
6. [Verification](#verification) - Testing deployment
7. [Maintenance](#maintenance) - Ongoing operations
8. [Troubleshooting](#troubleshooting) - Common issues and solutions

## Prerequisites

### System Requirements
- **Cloudflare Workers Account**: Active account with Workers enabled
- **Node.js**: Version 18+ (18+ recommended)
- **npm**: Latest stable version
- **Git**: For cloning repository

### Required Permissions
- **Cloudflare Workers**: Deploy Workers permission
- **R2 Storage**: Access to R2 buckets for model files
- **KV Storage**: Access to KV namespaces for data storage

### API Requirements
- **Financial APIs**: Yahoo Finance API (for market data)
- **AI Services**: Access to GPT-OSS-120B and DistilBERT models
- **Optional**: FRED API (for market drivers)

## Environment Setup

### Required Environment Variables

**Security Variables:**
```bash
# Primary API key (REQUIRED)
API_KEY=your_production_api_key_here

# Optional: Domain-specific API key
TRADING_API_KEY=your_trading_specific_key

# Optional: General application API key
APP_API_KEY=your_app_api_key

# Multiple API keys (comma-separated)
API_KEYS=key1,key2,key3
```

**Configuration Variables:**
```bash
# System version
WORKER_VERSION=2.0

# Timezone
TIMEZONE=America/New_York

# Trading symbols (comma-separated)
TRADING_SYMBOLS=AAPL,MSFT,GOOGL,TSLA,NVDA

# Logging level
LOG_LEVEL=info
```

## Installation

### Clone Repository
```bash
git clone https://github.com/your-username/cct.git
cd cct
```

### Install Dependencies
```bash
npm install
```

### Verify Dependencies
```bash
# Check for TypeScript migration completion
npm run build

# Verify all dependencies are installed
npm run test:dependencies
```

### Local Development Setup
```bash
# Set up environment variable for local development
export X_API_KEY="your_api_key"

# Start local development server with Miniflare
npm run dev
```

The local development server will be available at `http://localhost:8787` with:
- Local KV storage simulation
- R2 bucket simulation
- AI binding connectivity
- Hot reload development
- Health endpoint debugging capabilities

## Configuration

### Cloudflare Workers Setup

1. **Install Wrangler CLI**
```bash
npm install -g wrangler
```

2. **Authentication**
```bash
# Login to Cloudflare
wrangler auth login

# Verify authentication
wrangler whoami
```

3. **Configure Environment Variables**
```bash
# Using wrangler.toml (recommended)
wrangler secret put API_KEY "your_production_api_key"

# Or using individual commands
wrangler secret put TRADING_API_KEY "your_trading_key"
wrangler secret put APP_API_KEY "your_app_key"
```

4. **KV Namespace Setup**
```bash
# Verify KV namespace is configured
wrangler kv:namespace list
```

**Required KV Namespaces:**
- `TRADING_RESULTS` - Analysis results and daily data
- `TRAINED_MODELS` - Trained model files (R2 bucket: `tft-trading-models`)

### R2 Bucket Setup
```bash
# Verify R2 bucket is configured
wrangler r2 bucket list
```

**Required R2 Buckets:**
- `TRAINED_MODELS` - Primary model storage
- `ENHANCED_MODELS` - Enhanced model storage (optional)

## Security Setup

### API Key Management

#### Production API Key Setup
```bash
# Set primary API key
wrangler secret put API_KEY "your_secure_production_key"

# Verify configuration
wrangler secret list
```

#### API Key Security Best Practices
- **Never commit API keys** to version control
- **Use environment variables** instead of hardcoded values
- **Rotate API keys regularly** (recommended every 90 days)
- **Use different keys** for development vs production
- **Monitor API key usage** through Cloudflare dashboard

#### Supported Authentication Methods
The system uses the `X-API-KEY` header for authentication:

```bash
# Example requests with API key
curl -H "X-API-KEY: your_api_key" \
  https://tft-trading-system.yanggf.workers.dev/analyze

# Without API key (will return 401)
curl https://tft-trading-system.yanggf.workers.dev/analyze
```

**Authentication Details:**
- **Header**: `X-API-KEY` (case-insensitive)
- **Environment Variables**: `API_KEY`, `TRADING_API_KEY`, `APP_API_KEY`, `API_KEYS`
- **Error Response**: `{"success": false, "error": "API key required for this endpoint"}`
- **Status Code**: 401 Unauthorized

## Deployment

### Deploy to Production
```bash
# Deploy using Wrangler
wrangler deploy

# Deploy with specific environment
wrangler deploy --env production

# Verify deployment
wrangler tail
```

### Deployment Verification
```bash
# Test system health
curl https://tft-trading-system.yanggf.workers.dev/health

# Test API v1 documentation
curl https://tft-trading-system.yanggf.workers.dev/api/v1

# Test main analysis endpoint
curl -H "X-API-KEY: your_api_key" \
  https://tft-trading-system.yanggf.workers.dev/analyze

# Test enhanced cache system
curl -H "X-API-KEY: your_api_key" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/cache/health
```

### Post-Deployment Checklist

- [ ] **URL accessible**: `https://tft-trading-system.yanggf.workers.dev`
- [ ] **Health endpoint**: Returns `{"status": "healthy"}`
- [ ] **API v1 docs**: Publicly accessible at `/api/v1`
- [ ] **Main analysis**: Works with API key authentication
- [ ] **Cache system**: Enhanced caching endpoints responding correctly
- [ ] **Authentication**: Proper API key validation working
- [ ] **Error handling**: Appropriate 401/404/500 responses
- [ ] **Performance**: Response times under 1 second for cached endpoints

## Verification

### Health Check
```bash
# Basic health endpoint
curl https://tft-trading-system.yanggf.workers.dev/health

# Expected response
{"success": true, "status": "healthy", "version": "2.0-enhanced"}
```

### API Key Authentication Test
```bash
# Test without API key (should fail)
curl https://tft-trading-system.yanggf.workers.dev/results

# Expected response
{"success": false, "error": "API key required for this endpoint"}

# Test with API key (should succeed)
curl -H "X-API-KEY: your_api_key" \
  https://tft-trading-system.yanggf.workers.dev/results

# Expected response
{"success": true, "data": {...}, "timestamp": "..."}
```

### Enhanced Cache System Test
```bash
# Test cache health monitoring
curl -H "X-API-KEY: your_api_key" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/cache/health

# Expected response
{
  "success": true,
  "data": {
    "cache_health": {
      "enabled": true,
      "l1_cache": {...},
      "l2_cache": {...},
      "health_score": 85
    }
  }
}
```

### Performance Test
```bash
# Test cached vs uncached performance
time curl https://tft-trading-system.yanggf.workers.dev/api/v1/data/symbols
# First request (cache miss) should be ~200-500ms
# Second request (cache hit) should be ~5-15ms
```

## Maintenance

### Monitoring and Logging

#### Real-time Monitoring
```bash
# View live logs
wrangler tail --format=pretty

# Monitor specific endpoints
wrangler tail --format=pretty --search="ERROR"

# Check system metrics
curl -H "X-API-KEY: your_api_key" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/cache/metrics
```

#### Log Analysis
- **Performance**: Monitor response times and cache hit rates
- **Security**: Track failed authentication attempts
- **Errors**: Monitor 5xx error rates
- **Usage**: Track API endpoint usage patterns

### Updates and Maintenance

#### Update System
```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm update

# Deploy with minimal downtime
wrangler deploy
```

#### Backup and Recovery

#### Data Backup
```bash
# KV data backup (manual export)
wrangler kv:namespace list --preview=false  # Export current KV data

# R2 model backup
wrangler r2 object list tft-trading-models  # Verify model files
```

#### Configuration Backup
```bash
# Backup wrangler.toml
cp wrangler.toml wrangler.toml.backup

# Backup environment documentation
cp -r docs/ deployment-docs-backup/
```

## Troubleshooting

### Common Issues and Solutions

#### Deployment Issues
```bash
# Issue: Build failures
# Solution: Check TypeScript migration
npm run build

# Issue: Memory exceeded errors
# Solution: Check for memory leaks in analysis functions
# Reduce MAX_NEWS_ARTICLES in wrangler.toml

# Issue: API key authentication failures
# Solution: Verify environment variables
wrangler secret list
# Check for typos in variable names
# Verify API key is correctly set
```

#### Performance Issues
```bash
# Issue: Slow response times
# Solution: Check cache hit rates
curl -H "X-API-KEY: your_api_key" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/cache/metrics

# Issue: High error rates
# Solution: Monitor AI model timeout settings
# Check GPT_MAX_TOKENS and GPT_TEMPERATURE
# Reduce concurrent requests
```

#### Function-Specific Issues

```bash
# Issue: AI model timeouts
# Solution: Monitor specific model performance
curl -H "X-API-KEY: your_api_key" \
  "https://tft-trading-system.yanggf.workers.dev/model-health"

# Issue: KV storage failures
# Solution: Check KV namespace configuration
wrangler kv:namespace list
# Verify namespace bindings in wrangler.toml
```

### Support and Debugging

#### Debug Mode
```bash
# Enable verbose logging
wrangler tail --format=pretty --search="DEBUG"

# Test specific endpoints
curl -v "https://tft-trading-system.yanggf.workers.dev/analyze-symbol?symbol=AAPL"
```

#### Performance Profiling
```bash
# Time specific operations
time curl -H "X-API-KEY: your_api_key" \
  "https://tft-trading-system.yanggf.workers.dev/api/v1/cache/metrics"

# Analyze performance patterns
wrangler tail --format=json | jq '.duration_ms' | sort -n
```

## Security Considerations

### Production Security
- ✅ **Multi-source API key validation**
- ✅ **Case-insensitive header handling**
- ✅ **No hardcoded production secrets**
- ✅ **Proper 401/404/500 error responses**
- ✅ **Enterprise-grade authentication**

### API Rate Limiting
```bash
# Rate limits are enforced automatically
# Yahoo Finance: 20 requests/minute
# AI models: Timeouts prevent abuse
# KV operations: Batching reduces load
```

### Data Protection
- **Encryption**: All data in transit encrypted (HTTPS)
- **Access Control**: API key authentication required
- **Data Retention**: KV data retained per TTL settings
- **Backup**: Regular KV and model backups recommended

---

## 📞 Need Help?

### Documentation Resources
- [API Reference](API_DOCUMENTATION.md) - Complete endpoint documentation
- [System Features](docs/SYSTEM_FEATURES.md) - Current capabilities
- [Maintenance Guide](docs/MAINTENANCE_GUIDE.md) - Operations manual

### Support
Check existing documentation and GitHub issues for common problems:
- [Documentation](docs/) - Complete guides and references
- [GitHub Issues](https://github.com/your-username/cct/issues) - Community support
- [System Logs](#monitoring-and-logging) - Real-time debugging

---

**Last Updated**: 2025-10-23
**Version**: v1.0
**System Status**: Production-Ready Enterprise AI Trading System