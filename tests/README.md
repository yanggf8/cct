# Test Suite Organization

This directory contains all test scripts organized by type and purpose for easy discovery and maintenance.

## Directory Structure

```
tests/
├── integration/           # Integration & system tests
│   ├── dac/              # Durable Objects cache integration
│   ├── frontend/         # Frontend integration tests
│   ├── data-bridge/      # Data bridge integration
│   └── *.sh              # General integration tests
├── security/             # Security & authentication tests
├── performance/          # Performance & load tests
├── validation/           # Data & schema validation
├── e2e/                  # End-to-end workflow tests
├── regression/           # Regression test suites
├── feature/              # Feature-specific tests
│   ├── ai-models/        # AI model tests
│   ├── portfolio/        # Portfolio feature tests
│   ├── sector/           # Sector analysis tests
│   └── mock-elimination/ # Mock data elimination
└── chaos/                # Chaos engineering tests
```

## Quick Reference

### Integration Tests (`integration/`)

**DAC Integration (`integration/dac/`)**
- `test-dac-service-binding-comprehensive.sh` - Primary DO cache/service binding suite (25+ scenarios)
- `test-do-hot-read.ts` - Hot read validation for Durable Objects

**Frontend Integration (`integration/frontend/`)**
- `test-frontend-integration.sh` - Frontend API integration tests
- `test-html-structure-validation.sh` - HTML structure and content validation
- `test-routing-regressions.sh` - Guard rails for static assets and HTML routing

**Data Bridge (`integration/data-bridge/`)**
- `test-pre-market-data-bridge.sh` - Pre-market data integration testing

**General Integration**
- `test-comprehensive-optimization.sh` - Comprehensive system optimization tests

### Security Tests (`security/`)

- `test-api-security.sh` - API security validation
- `test-auth-security.sh` - Authentication security tests
- `test-comprehensive-security-integration.sh` - Full security integration suite
- `run-all-security-tests.sh` - Run all security tests
- `validate-complete-security-implementation.sh` - Security implementation validation

### Performance Tests (`performance/`)

- `test-playwright-performance.sh` - Playwright-based performance tests
- `test-slo-breach-simulation.sh` - SLO breach simulation and monitoring

### Validation Tests (`validation/`)

- `test-data-validation.sh` - Data integrity and validation
- `ci-schema-validation.sh` - CI schema validation
- `test-reports-html-verification.sh` - HTML report verification
- `test-synthetic-monitoring-html.sh` - Synthetic monitoring for HTML endpoints
- `test-typescript-migration.sh` - TypeScript migration validation
- `validate-environment-bindings.sh` - Environment binding validation

### End-to-End Tests (`e2e/`)

- `test-workflows.sh` - End-to-end user workflows
- `test-release-workflow-dryrun.sh` - Release workflow dry run

### Regression Tests (`regression/`)

- `run-regression-tests.sh` - Comprehensive regression test suite
- `test-final-validation.sh` - Final validation before release
- `test-simple-validation.sh` - Simple validation tests
- `test-all-new-features.sh` - Test all new features

### Feature Tests (`feature/`)

**AI Models (`feature/ai-models/`)**
- `test-ai-model-stability.sh` - AI model stability and reliability tests
- `test-ai-predictive-api.sh` - Predictive API testing

**Portfolio (`feature/portfolio/`)**
- `test-portfolio-api.sh` - Portfolio API tests
- `test-backtesting-api.sh` - Backtesting functionality
- `test-risk-management-api.sh` - Risk management API tests

**Sector Analysis (`feature/sector/`)**
- `test-sector-simple.sh` - Simple sector analysis tests

**Mock Elimination (`feature/mock-elimination/`)**
- `mock-elimination-audit.sh` - Audit for mock data usage
- `test-mock-elimination-validation.sh` - Validate mock data removal
- `test-mock-prevention-scan.sh` - Prevent new mock data introduction

### Chaos Engineering (`chaos/`)

- `test-chaos-engineering-staging.sh` - Chaos engineering tests for staging

## Common Test Commands

### Run via npm scripts
```bash
# Performance tests
npm run test:performance
npm run test:performance-all

# Integration tests
npm run test:integration
npm run test:html-structure

# Security tests
npm run test:guards-smoke

# Validation tests
npm run test:validate-environment
npm run test:synthetic-monitoring
npm run test:mock-prevention

# Workflows
npm run test:workflows
```

### Run directly
```bash
# Integration tests
./tests/integration/dac/test-dac-service-binding-comprehensive.sh
./tests/integration/data-bridge/test-pre-market-data-bridge.sh

# Security suite
./tests/security/run-all-security-tests.sh

# Regression tests
./tests/regression/run-regression-tests.sh

# E2E tests
./tests/e2e/test-workflows.sh
```

## Test Coverage

- **Total Tests**: 152+ tests across 10 comprehensive suites
- **Coverage**: 93% (A-Grade)
- **Categories**:
  - Functional: 42+ tests (70+ API endpoints)
  - AI Stability: 10 tests
  - Security: 17+ tests
  - Data Validation: 35+ tests
  - Workflow: 5 end-to-end scenarios
  - Frontend Integration: 15 tests
  - Cache Metrics: 10 tests
  - Enhanced Cache: 8 integration tests

## CI/CD Integration

All test scripts are integrated with GitHub Actions workflows:
- `.github/workflows/dac-integration-regression.yml` - DAC tests
- `.github/workflows/enhanced-cache-tests.yml` - Cache tests
- `.github/workflows/mock-data-prevention.yml` - Mock prevention
- `.github/workflows/release-hardened.yml` - Release validation

## Best Practices

1. **Run tests locally** before pushing
2. **Use quick validation** scripts for rapid feedback
3. **Run comprehensive suites** before major releases
4. **Check test reports** in `test-reports/` directory
5. **Update baselines** when intentional changes are made

## Contributing

When adding new tests:
1. Place in appropriate category directory
2. Follow naming convention: `test-<feature>-<type>.sh`
3. Make executable: `chmod +x <script>.sh`
4. Update this README
5. Add to relevant CI/CD workflow
6. Update npm scripts if needed

## Support

For issues or questions about specific tests, refer to:
- Individual test script comments
- `CLAUDE.md` for system documentation
- Test reports in `test-reports/` directory
