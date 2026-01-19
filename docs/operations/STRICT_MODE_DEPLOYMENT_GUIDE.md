# Strict Mode Deployment Guide

## Overview

Sprint 1-B implements production-grade mock data prevention through strict mode enforcement. This guide ensures production deployments are protected from mock data leakage.

## Environment Configuration

### Required Environment Variables

**Production Environment:**
```bash
# Must be set to "production" for strict mode activation
ENVIRONMENT = "production"
```

**Required Secrets:**
```bash
# FRED API integration (required in strict mode)
FRED_API_KEY=your_fred_api_key

# API authentication
X_API_KEY=your_api_key
```

### Deployment Configuration (wrangler.toml)

```toml
[env.production]
ENVIRONMENT = "production"
```

## Strict Mode Behavior

### Production Environment (ENVIRONMENT="production")
- ✅ **Mock Data Forbidden**: All mock/fallback data rejected
- ✅ **FRED API Key Required**: Strict validation at initialization
- ✅ **Fail-Fast Errors**: Immediate rejection of invalid configurations
- ✅ **Runtime Verification**: Active monitoring of all API responses

### Development Environment (ENVIRONMENT="development")
- ⚠️ **Mock Data Allowed**: Mock/fallback data permitted for development
- ✅ **Flexible Configuration**: Development-friendly settings
- ✅ **Debug Features**: Debug endpoints and tools available
- ✅ **Verbose Logging**: Detailed logging for troubleshooting

## Implementation Verification

### Pre-Deployment Checklist

Before deploying to production, verify:

1. **Environment Detection**:
   ```bash
   # Test environment variable
   curl -H "X-API-Key: $X_API_KEY" \
        "https://tft-trading-system.yanggf.workers.dev/api/v1/config" \
        | jq '.environment'
   ```

2. **FRED API Configuration**:
   ```bash
   # Verify FRED integration
   curl -H "X-API-Key: $X_API_KEY" \
        "https://tft-trading-system.yanggf.workers.dev/api/v1/macro-health" \
        | jq '.fred_integration'
   ```

3. **Production Guards Status**:
   ```bash
   # Test production guards
   npm run test:strict-guards
   ```

4. **Smoke Test Guards Endpoints**:
   ```bash
   # Test endpoint routing and functionality
   ./test-production-guards-smoke.sh
   ```

5. **Endpoint 404 Behavior**:
   ```bash
   # Verify coming-soon endpoints return 404
   curl -I "https://tft-trading-system.yanggf.workers.dev/monday-predictions" \
        -H "X-API-Key: $X_API_KEY"
   ```

## Runtime Validation

### Production Guards Verification

The system automatically validates:
- **Mock Pattern Detection**: Blocks "coming soon", "placeholder", "test data", etc.
- **Data Source Verification**: Validates metadata and source information
- **Quality Assessment**: Detects suspicious data patterns
- **Timestamp Validation**: Checks for unrealistic timestamps

### Monitoring Endpoints

Add these to your monitoring system:

```bash
# Health check endpoint (production-safe)
GET /api/v1/health

# System status with strict mode info
GET /api/v1/system/status

# Production guards endpoints (require authentication)
GET /api/v1/guards/status     # Configuration and capabilities
GET /api/v1/guards/health     # Health check for monitoring systems
GET /api/v1/guards/validate   # Comprehensive validation testing
```

### Security Notes

- **Authentication Required**: All `/api/v1/guards/*` endpoints require `X-API-Key`
- **Data Redaction**: Sensitive fields (API keys, tokens) are automatically redacted
- **Access Control**: Consider IP restrictions for production monitoring
- **Rate Limiting**: Standard API rate limits apply to guard endpoints

## Troubleshooting

### Common Issues

**Error: "Production strict mode: FRED API failure"**
```bash
# Check FRED API key
wrangler secret list | grep FRED

# Verify FRED API key format
# Should be alphanumeric string, not URL
```

**Error: "Production strict mode: Mock data detected"**
```bash
# Check response for mock indicators
grep -r "coming soon\|placeholder\|test data" src/
```

**Error: "404 Feature not found"**
```bash
# Verify endpoint exists in development
curl -H "X-API-Key: test" \
     "https://tft-trading-system.yanggf.workers.dev/debug-weekend-message"
```

## CI/CD Integration

### Add to GitHub Actions

```yaml
# .github/workflows/deploy-prod.yml
- name: Validate Production Mode
  run: |
    npm run test:strict-guards

- name: Verify Environment Variables
  run: |
    if [ "$ENVIRONMENT" != "production" ]; then
      echo "❌ Environment not set to production"
      exit 1
    fi

- name: Check Required Secrets
  run: |
    if [ -z "$FRED_API_KEY" ]; then
      echo "❌ FRED_API_KEY not set"
      exit 1
    fi
```

### Pre-Deploy Validation Script

```bash
#!/bin/bash
# validate-production-deploy.sh

echo "🚀 Validating Production Deployment..."

# Check environment
if [ "$ENVIRONMENT" != "production" ]; then
  echo "❌ ERROR: ENVIRONMENT must be 'production' for strict mode"
  exit 1
fi

# Check secrets
if [ -z "$FRED_API_KEY" ]; then
  echo "❌ ERROR: FRED_API_KEY required for strict mode"
  exit 1
fi

# Run guardrail tests
echo "🛡️ Running strict mode guardrail tests..."
npm run test:strict-guards

if [ $? -ne 0 ]; then
  echo "❌ ERROR: Guardrail tests failed - deployment blocked"
  exit 1
fi

echo "✅ Production deployment validation passed"
echo "🚀 Ready to deploy with strict mode protection"
```

## Rollback Procedures

If strict mode causes issues, you can temporarily disable it:

```bash
# Method 1: Environment Override
ENVIRONMENT="development" wrangler deploy

# Method 2: Feature Flag (if implemented)
wrangler secret put STRICT_MODE_DISABLED "true"

# Method 3: Rollback Code Changes
git revert <commit-hash>
wrangler deploy
```

## Best Practices

### Development
1. **Always test in development first** before production deployment
2. **Use mock data intentionally** for testing edge cases
3. **Validate real data integration** with actual API responses
4. **Monitor guard performance** in production

### Production
1. **Never deploy with placeholder data** or hardcoded values
2. **Validate all data sources** before deployment
3. **Monitor guard performance** and error rates
4. **Have rollback procedures** ready for emergency situations

### Operations
1. **Monitor error logs** for strict mode violations
2. **Set up alerts** for production guard failures
3. **Regular security audits** of data integrity
4. **Document all changes** that affect data flow

## Emergency Procedures

### If Production Fails with Mock Data Errors

1. **Immediate Rollback**:
   ```bash
   # Rollback to last known good deployment
   git log --oneline -n 5
   git revert <last-good-commit>
   wrangler deploy
   ```

2. **Debug Mode Deployment**:
   ```bash
   # Temporary development deployment for debugging
   ENVIRONMENT="development" wrangler deploy
   ```

3. **Investigation Steps**:
   - Check application logs for specific error messages
   - Verify FRED API status and key validity
   - Review recent code changes for mock data introduction
   - Run guardrail tests to identify issues

---

**Last Updated**: 2025-01-XX
**Version**: Sprint 1-B - Macro/FRED Strict Mode Implementation