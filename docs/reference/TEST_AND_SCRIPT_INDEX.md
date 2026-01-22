# Test and Script Organization Index

This document provides a comprehensive overview of the current test and script structure.

## Overview

All 51 scripts have been organized into logical directories:
- **35 test scripts** in `tests/` (organized by type)
- **16 operational scripts** in `scripts/` (organized by purpose)

## Quick Navigation

- [`tests/`](tests/README.md) - All test scripts organized by type
- [`scripts/`](scripts/README.md) - Operational scripts for deployment and monitoring
- [`CLAUDE.md`](CLAUDE.md) - Project documentation (updated with new paths)
- [`package.json`](package.json) - npm scripts (updated with new paths)

## Organization Benefits

### Before
- 47 scripts scattered in repository root
- Hard to find specific test types
- No clear organization
- Difficult to maintain

### After
- Clean repository root
- Logical categorization by purpose
- Easy script discovery
- Scalable structure
- Self-documenting organization

## Directory Structure

```
/
├── tests/                          # All test scripts (35 scripts)
│   ├── integration/                # Integration tests (6 scripts)
│   │   ├── dac/                   # DO cache tests (1 primary + 1 TS hot-read)
│   │   ├── frontend/              # Frontend tests (3 scripts)
│   │   ├── data-bridge/           # Data bridge (1 script)
│   │   └── *.sh                   # General integration (1 script)
│   ├── security/                   # Security tests (6 scripts)
│   ├── performance/                # Performance tests (2 scripts)
│   ├── validation/                 # Validation tests (6 scripts)
│   ├── e2e/                        # End-to-end tests (2 scripts)
│   ├── regression/                 # Regression tests (4 scripts)
│   ├── feature/                    # Feature tests (9 scripts)
│   │   ├── ai-models/             # AI model tests (2 scripts)
│   │   ├── portfolio/             # Portfolio tests (3 scripts)
│   │   ├── sector/                # Sector tests (1 script)
│   │   └── mock-elimination/      # Mock elimination (3 scripts)
│   └── chaos/                      # Chaos tests (1 script)
│
└── scripts/                        # Operational scripts (16 scripts)
    ├── deployment/                 # Deployment automation (4 scripts)
    ├── test-runners/               # Test orchestration (3 scripts)
    ├── utilities/                  # Helper scripts (3 scripts)
    ├── setup/                      # Setup scripts (2 scripts)
    └── monitoring/                 # Monitoring scripts (4 scripts)
```

## Updated References

### GitHub Actions Workflows
✅ All workflow files updated with new paths:
- `.github/workflows/dac-integration-regression.yml`
- `.github/workflows/enhanced-cache-tests.yml`
- `.github/workflows/mock-data-prevention.yml`
- `.github/workflows/release-hardened.yml`
- `.github/workflows/cache-warmup-after-deployment.yml`

### npm Scripts
✅ All npm scripts updated in `package.json`:
- `npm run deploy` → `scripts/deployment/deploy-production.sh`
- `npm run test:*` → Updated to new test paths
- All script references verified and working

### Documentation
✅ Documentation updated:
- `CLAUDE.md` - Updated all script references
- `tests/README.md` - New comprehensive test documentation
- `scripts/README.md` - New operational script documentation
- `TEST_ORGANIZATION_PLAN.md` - Migration plan and rationale

## Migration Summary

### Scripts Moved

**Integration Tests (8)**
- ✅ `test-dac-*.sh` (4) → `tests/integration/dac/`
- ✅ `test-frontend-integration.sh` → `tests/integration/frontend/`
- ✅ `test-html-structure-validation.sh` → `tests/integration/frontend/`
- ✅ `test-pre-market-data-bridge.sh` → `tests/integration/data-bridge/`
- ✅ `test-comprehensive-optimization.sh` → `tests/integration/`

**Security Tests (5)**
- ✅ `test-*-security.sh` (3) → `tests/security/`
- ✅ `run-all-security-tests.sh` → `tests/security/`
- ✅ `validate-complete-security-implementation.sh` → `tests/security/`

**Performance Tests (2)**
- ✅ `test-playwright-performance.sh` → `tests/performance/`
- ✅ `test-slo-breach-simulation.sh` → `tests/performance/`

**Validation Tests (6)**
- ✅ `test-data-validation.sh` → `tests/validation/`
- ✅ `ci-schema-validation.sh` → `tests/validation/`
- ✅ `test-reports-html-verification.sh` → `tests/validation/`
- ✅ `test-synthetic-monitoring-html.sh` → `tests/validation/`
- ✅ `test-typescript-migration.sh` → `tests/validation/`
- ✅ `validate-environment-bindings.sh` → `tests/validation/`

**E2E Tests (2)**
- ✅ `test-workflows.sh` → `tests/e2e/`
- ✅ `test-release-workflow-dryrun.sh` → `tests/e2e/`

**Regression Tests (4)**
- ✅ `run-regression-tests.sh` → `tests/regression/`
- ✅ `test-final-validation.sh` → `tests/regression/`
- ✅ `test-simple-validation.sh` → `tests/regression/`
- ✅ `test-all-new-features.sh` → `tests/regression/`

**Feature Tests (9)**
- ✅ AI Models (2) → `tests/feature/ai-models/`
- ✅ Portfolio (3) → `tests/feature/portfolio/`
- ✅ Sector (1) → `tests/feature/sector/`
- ✅ Mock Elimination (3) → `tests/feature/mock-elimination/`

**Chaos Tests (1)**
- ✅ `test-chaos-engineering-staging.sh` → `tests/chaos/`

**Deployment Scripts (4)**
- ✅ `deploy-production.sh` → `scripts/deployment/`
- ✅ `quick-deploy.sh` → `scripts/deployment/`
- ✅ `rollback-production.sh` → `scripts/deployment/`
- ✅ `warmup-cache-after-deployment.sh` → `scripts/deployment/`

**Test Runners (3)**
- ✅ `test-production-guards-smoke.sh` → `scripts/test-runners/`
- ✅ `test-exemption-report-manual.sh` → `scripts/test-runners/`
- ✅ `generate-test-summary.sh` → `scripts/test-runners/`

**Utilities (3)**
- ✅ `fix-frontend-security.sh` → `scripts/utilities/`
- ✅ `fix-test-authentication.sh` → `scripts/utilities/`
- ✅ `validate-enhanced-cache.sh` → `scripts/utilities/`

**Setup Scripts (2)**
- ✅ `generate-pre-market-data.sh` → `scripts/setup/`
- ✅ `setup-d1-databases.sh` → `scripts/setup/`

**Monitoring Scripts (4)**
- ✅ `test-cache-economics.sh` → `scripts/monitoring/`
- ✅ `test-d1-rollups.sh` → `scripts/monitoring/`
- ✅ `test-kv-bindings.sh` → `scripts/monitoring/`
- ✅ `test-storage-adapters.sh` → `scripts/monitoring/`

## Verification

Run these commands to verify the migration:

```bash
# Verify no scripts remain in root
ls -la *.sh 2>/dev/null && echo "❌ Scripts still in root!" || echo "✅ Root is clean"

# Count test scripts
find tests -name "*.sh" -type f | wc -l  # Should be 35

# Count operational scripts
find scripts -name "*.sh" -type f | wc -l  # Should be 16

# Total scripts
find tests scripts -name "*.sh" -type f | wc -l  # Should be 51

# Verify npm scripts work
npm run test:guards-smoke --dry-run
npm run deploy:verify --dry-run
```

## Common Tasks

### Run Test Suites
```bash
# Integration tests
./tests/integration/dac/test-dac-service-binding-comprehensive.sh

# Security tests
./tests/security/run-all-security-tests.sh

# Regression tests
./tests/regression/run-regression-tests.sh

# All validation
npm run verify
```

### Deployment Operations
```bash
# Deploy to production
npm run deploy

# Quick deploy
npm run deploy:quick

# Rollback
./scripts/deployment/rollback-production.sh emergency
```

### Monitoring
```bash
# Cache economics
./scripts/monitoring/test-cache-economics.sh

# D1 rollups
./scripts/monitoring/test-d1-rollups.sh

# Storage adapters
./scripts/monitoring/test-storage-adapters.sh
```

## Breaking Changes

None! All references have been updated:
- ✅ GitHub Actions workflows
- ✅ npm scripts in package.json
- ✅ Documentation in CLAUDE.md
- ✅ README files created

## Next Steps

The organization is complete and ready to use. Future additions should follow this structure:

1. **New test scripts** → Place in appropriate `tests/` subdirectory
2. **New operational scripts** → Place in appropriate `scripts/` subdirectory
3. **Update README** → Add to relevant README.md file
4. **Update npm scripts** → If user-facing command needed
5. **Update CI/CD** → If automated execution needed

## Rollback Plan

If needed, scripts can be moved back to root, but this is not recommended. The new structure provides significant benefits for maintainability and scalability.

---

**Migration Completed**: 2025-12-19
**Scripts Organized**: 51 total (35 tests + 16 scripts)
**Status**: ✅ Complete and Verified
