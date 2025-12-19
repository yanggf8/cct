# Scripts Directory

This directory contains operational and utility scripts organized by purpose for deployment, testing, monitoring, and maintenance.

## Directory Structure

```
scripts/
├── deployment/           # Deployment automation
├── test-runners/         # Test orchestration scripts
├── utilities/            # Helper and utility scripts
├── setup/                # Setup and initialization
└── monitoring/           # Production monitoring
```

## Script Categories

### Deployment (`deployment/`)

**Production Deployment**
- `deploy-production.sh` - Main production deployment script
  - Runs TypeScript checks, builds, and deploys
  - Usage: `./scripts/deployment/deploy-production.sh [build-only|verify]`
  - npm: `npm run deploy`

**Quick Deployment**
- `quick-deploy.sh` - Fast deployment for minor changes
  - Skips some validation steps for speed
  - Usage: `./scripts/deployment/quick-deploy.sh`
  - npm: `npm run deploy:quick`

**Rollback**
- `rollback-production.sh` - Emergency production rollback
  - Usage: `./scripts/deployment/rollback-production.sh [emergency]`

**Cache Warmup**
- `warmup-cache-after-deployment.sh` - Warm cache after deployment
  - Prevents cold start issues
  - Automatically runs via GitHub Actions

### Test Runners (`test-runners/`)

**Production Guards**
- `test-production-guards-smoke.sh` - Smoke tests for production guards
  - Validates guard system functionality
  - npm: `npm run test:guards-smoke`

**Exemption Reports**
- `test-exemption-report-manual.sh` - Manual exemption report generation
  - For special case testing scenarios

**Test Summary**
- `generate-test-summary.sh` - Generate comprehensive test summary
  - Aggregates results from multiple test suites
  - Creates unified test reports

### Utilities (`utilities/`)

**Security Fixes**
- `fix-frontend-security.sh` - Fix frontend security issues
  - Removes hardcoded credentials
  - Updates authentication patterns

**Authentication Fixes**
- `fix-test-authentication.sh` - Fix test authentication issues
  - Repairs authentication in test scripts

**Cache Validation**
- `validate-enhanced-cache.sh` - Validate enhanced cache implementation
  - npm: `npm run test:cache`
  - Checks cache health and performance

### Setup (`setup/`)

**Pre-Market Data**
- `generate-pre-market-data.sh` - Generate pre-market data
  - Populates cache with pre-market data
  - Useful for testing and development

**Database Setup**
- `setup-d1-databases.sh` - Setup D1 databases
  - Creates and migrates D1 databases
  - Initializes schema and seed data

### Monitoring (`monitoring/`)

**Cache Economics**
- `test-cache-economics.sh` - Cost-to-serve intelligence validation
  - Tests cost analysis across storage, compute, bandwidth
  - Phase 3 BI Dashboard feature
  - Validates efficiency scoring

**D1 Rollups**
- `test-d1-rollups.sh` - Aggregation query testing
  - Tests D1 database rollup queries
  - Validates aggregation performance
  - Phase 3 dashboard feature

**KV Bindings**
- `test-kv-bindings.sh` - Test KV namespace bindings
  - Validates KV configuration
  - Tests read/write operations

**Storage Adapters**
- `test-storage-adapters.sh` - Test storage adapter implementations
  - Validates storage layer abstraction
  - Tests multiple storage backends

## Common Usage Patterns

### Deployment Workflow

```bash
# Standard production deployment
npm run deploy

# Quick deployment (minor changes)
npm run deploy:quick

# Build only (no deploy)
npm run deploy:build-only

# Verify deployment
npm run deploy:verify

# Emergency rollback
./scripts/deployment/rollback-production.sh emergency
```

### Monitoring and Validation

```bash
# Cache validation
npm run test:cache

# Production guards smoke test
npm run test:guards-smoke

# Cache economics (Phase 3)
./scripts/monitoring/test-cache-economics.sh

# D1 rollups testing (Phase 3)
./scripts/monitoring/test-d1-rollups.sh

# KV bindings
./scripts/monitoring/test-kv-bindings.sh

# Storage adapters
./scripts/monitoring/test-storage-adapters.sh
```

### Setup and Initialization

```bash
# Setup D1 databases
./scripts/setup/setup-d1-databases.sh

# Generate pre-market data
./scripts/setup/generate-pre-market-data.sh

# Warm cache after deployment
./scripts/deployment/warmup-cache-after-deployment.sh
```

### Utility Operations

```bash
# Fix frontend security
./scripts/utilities/fix-frontend-security.sh

# Fix test authentication
./scripts/utilities/fix-test-authentication.sh

# Validate cache
./scripts/utilities/validate-enhanced-cache.sh
```

## CI/CD Integration

These scripts are used in GitHub Actions workflows:

**Deployment Workflows**
- `.github/workflows/cache-warmup-after-deployment.yml` - Cache warmup
- Auto-deploys on push to main/master

**Test Workflows**
- `.github/workflows/dac-integration-regression.yml` - Uses test-runners
- `.github/workflows/enhanced-cache-tests.yml` - Uses monitoring scripts

## Environment Variables

Most scripts use these environment variables:

```bash
# Required
X_API_KEY           # API authentication key
CCT_URL            # Target deployment URL

# Optional
CLOUDFLARE_API_TOKEN        # For wrangler operations
CLOUDFLARE_ACCOUNT_ID       # Cloudflare account ID
FEATURE_FLAG_DO_CACHE      # Enable/disable DO cache
```

## Script Permissions

All scripts should be executable:

```bash
# Make all scripts executable
find scripts -name "*.sh" -exec chmod +x {} \;
```

## Error Handling

Scripts follow these conventions:
- Exit code 0: Success
- Exit code 1: General failure
- Exit code 2: Configuration error
- Exit code 3: Deployment failure

## Logging

Scripts output to:
- **stdout**: Normal operation logs
- **stderr**: Error messages
- **Files**: Some scripts create log files in project root or `test-reports/`

## Best Practices

1. **Always use npm scripts** when available for better portability
2. **Check script documentation** at the top of each file
3. **Run validation scripts** before deployment
4. **Keep monitoring scripts** in regular rotation
5. **Review logs** after running deployment scripts

## Troubleshooting

**Deployment Issues**
```bash
# Verify environment
./scripts/utilities/validate-enhanced-cache.sh

# Check deployment
npm run deploy:verify

# Rollback if needed
./scripts/deployment/rollback-production.sh emergency
```

**Cache Issues**
```bash
# Validate cache
npm run test:cache

# Test cache economics
./scripts/monitoring/test-cache-economics.sh

# Test KV bindings
./scripts/monitoring/test-kv-bindings.sh
```

**Database Issues**
```bash
# Re-setup databases
./scripts/setup/setup-d1-databases.sh

# Test D1 rollups
./scripts/monitoring/test-d1-rollups.sh
```

## Contributing

When adding new scripts:
1. Place in appropriate category directory
2. Follow naming convention
3. Make executable with `chmod +x`
4. Add documentation header in script
5. Update this README
6. Add to npm scripts if user-facing
7. Update relevant CI/CD workflows

## Related Documentation

- `tests/README.md` - Test suite documentation
- `CLAUDE.md` - Project documentation
- Individual script headers - Detailed usage

## Support

For script issues:
1. Check script header comments
2. Review error messages
3. Verify environment variables
4. Check CI/CD workflow logs
5. Consult project documentation
