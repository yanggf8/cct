# Test Script Organization Plan

## Current State
- **47+ test scripts** scattered in repository root
- **7 scripts** already in `/scripts/` directory
- Difficult to find and maintain specific test types

## Proposed Structure

```
tests/
├── integration/
│   ├── dac/
│   │   ├── test-dac-integration.sh
│   │   ├── test-dac-integration-simple.sh
│   │   ├── test-dac-quick-validation.sh
│   │   └── test-dac-service-binding-comprehensive.sh
│   ├── frontend/
│   │   ├── test-frontend-integration.sh
│   │   └── test-html-structure-validation.sh
│   ├── data-bridge/
│   │   └── test-pre-market-data-bridge.sh
│   └── test-comprehensive-optimization.sh
│
├── security/
│   ├── test-api-security.sh
│   ├── test-auth-security.sh
│   ├── test-admin-apis-negative.sh
│   ├── test-comprehensive-security-integration.sh
│   ├── run-all-security-tests.sh
│   └── validate-complete-security-implementation.sh
│
├── performance/
│   ├── test-playwright-performance.sh
│   └── test-slo-breach-simulation.sh
│
├── validation/
│   ├── test-data-validation.sh
│   ├── ci-schema-validation.sh
│   ├── test-schema-validation-simple.sh (if exists)
│   ├── test-reports-html-verification.sh
│   ├── test-synthetic-monitoring-html.sh
│   └── validate-environment-bindings.sh
│
├── e2e/
│   ├── test-workflows.sh
│   └── test-release-workflow-dryrun.sh
│
├── regression/
│   ├── run-regression-tests.sh
│   ├── test-final-validation.sh
│   ├── test-simple-validation.sh
│   └── test-all-new-features.sh
│
├── feature/
│   ├── ai-models/
│   │   ├── test-ai-model-stability.sh
│   │   └── test-ai-predictive-api.sh
│   ├── portfolio/
│   │   ├── test-portfolio-api.sh
│   │   ├── test-backtesting-api.sh
│   │   └── test-risk-management-api.sh
│   ├── sector/
│   │   └── test-sector-simple.sh
│   └── mock-elimination/
│       ├── mock-elimination-audit.sh
│       ├── test-mock-elimination-validation.sh
│       └── test-mock-prevention-scan.sh
│
└── chaos/
    └── test-chaos-engineering-staging.sh

scripts/
├── deployment/
│   ├── deploy-production.sh
│   ├── quick-deploy.sh
│   ├── rollback-production.sh
│   └── warmup-cache-after-deployment.sh (move from scripts/)
│
├── test-runners/
│   ├── test-production-guards-smoke.sh
│   ├── test-exemption-report-manual.sh
│   └── generate-test-summary.sh
│
├── utilities/
│   ├── fix-frontend-security.sh
│   ├── fix-test-authentication.sh
│   └── validate-enhanced-cache.sh
│
├── setup/
│   ├── generate-pre-market-data.sh (move from scripts/)
│   └── setup-d1-databases.sh (move from scripts/)
│
└── monitoring/
    ├── test-cache-economics.sh (move from scripts/)
    ├── test-d1-rollups.sh (move from scripts/)
    ├── test-kv-bindings.sh (move from scripts/)
    └── test-storage-adapters.sh (move from scripts/)
```

## Migration Strategy

### Phase 1: Create Directory Structure
1. Create all test directories under `/tests/`
2. Create all script subdirectories under `/scripts/`

### Phase 2: Move Scripts
1. Move scripts to appropriate directories
2. Maintain executable permissions
3. Update shebang lines if needed

### Phase 3: Update References
1. Update GitHub Actions workflows (`.github/workflows/`)
2. Update npm scripts in `package.json`
3. Update documentation references in CLAUDE.md
4. Update any internal script references

### Phase 4: Create Index Files
1. Create `tests/README.md` with test catalog
2. Create `scripts/README.md` with script guide
3. Add run-all scripts for each category

## Benefits

1. **Clear Organization**: Easy to find test types
2. **Better Maintenance**: Grouped by purpose
3. **Scalability**: Easy to add new tests
4. **Documentation**: Clear structure is self-documenting
5. **CI/CD**: Easier to run specific test suites

## Backward Compatibility

During migration, we can:
1. Create symlinks in root for critical scripts
2. Add deprecation warnings in moved scripts
3. Update all references in one commit

## Execution Plan

1. Review and approve this plan
2. Execute migration in single commit
3. Test CI/CD pipelines
4. Update documentation
5. Remove root symlinks after 1 week
